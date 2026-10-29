// Renders the Odle scene at the instants planned by web/frames.js and packs
// the pictures into a dynamic HEIC wallpaper: macOS shows the picture of the
// Sun position closest to the Sun where the Mac is, and in Light or Dark
// appearance the noon or the night picture.
//
// Usage: render <web dir> <day YYYY-MM-DD> <out.heic> [--frames <dir>]
//        (--frames also keeps every frame as a PNG)
//
// The page runs in a window behind the other windows but on screen: off
// screen WebKit stops the animation frames and the canvas is never drawn.
import AppKit
import ImageIO
import UniformTypeIdentifiers
import WebKit

// Size of the page in points; the page draws at twice this (see index.html).
let pageSize = NSSize(width: 1920, height: 1200)
// Santa Maddalena, the observer of the scene (odle-scene.js).
let latitude = 46.6419
let longitude = 11.7187

struct Frame: Decodable {
  let name: String
  let time: String
  let altitude: Double
  let azimuth: Double
  // The frame whose picture this Sun position uses: itself, or the day's.
  let image: String
}

final class Loader: NSObject, WKNavigationDelegate {
  private var finished: CheckedContinuation<Void, Error>?

  func load(_ url: URL, root: URL, in webView: WKWebView) async throws {
    try await withCheckedThrowingContinuation { continuation in
      finished = continuation
      webView.loadFileURL(url, allowingReadAccessTo: root)
    }
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    finished?.resume()
    finished = nil
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    finished?.resume(throwing: error)
    finished = nil
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    finished?.resume(throwing: error)
    finished = nil
  }
}

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

let arguments = CommandLine.arguments
guard arguments.count >= 4 else {
  fail("usage: render <web dir> <day YYYY-MM-DD> <out.heic> [--frames <dir>]")
}
let webRoot = URL(fileURLWithPath: arguments[1], isDirectory: true).standardizedFileURL
let day = arguments[2]
let output = URL(fileURLWithPath: arguments[3])
let framesDirectory = arguments.count >= 6 && arguments[4] == "--frames"
  ? URL(fileURLWithPath: arguments[5], isDirectory: true) : nil

// Calls a private WebKit setter that takes a BOOL, if this macOS has it.
func setPrivateFlag(_ object: NSObject, _ selectorName: String, _ value: Bool) {
  let selector = NSSelectorFromString(selectorName)
  guard let method = class_getInstanceMethod(type(of: object), selector) else { return }
  typealias Setter = @convention(c) (NSObject, Selector, Bool) -> Void
  unsafeBitCast(method_getImplementation(method), to: Setter.self)(object, selector, value)
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
// A background tool with a hidden window is a candidate for App Nap, which
// stops the page's timers between one frame and the next.
let activity = ProcessInfo.processInfo.beginActivity(options: .userInitiated, reason: "Rendering the wallpaper")
let window = NSWindow(contentRect: NSRect(origin: .zero, size: pageSize),
                      styleMask: [.borderless], backing: .buffered, defer: false)
let configuration = WKWebViewConfiguration()
// The scene reads image pixels (sprite margins); file pages need this to do it.
configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
// A covered window counts as a hidden page: WebKit would slow its timers
// down and suspend its process.
setPrivateFlag(configuration.preferences, "_setHiddenPageDOMTimerThrottlingEnabled:", false)
setPrivateFlag(configuration.preferences, "_setPageVisibilityBasedProcessSuppressionEnabled:", false)
let webView = WKWebView(frame: NSRect(origin: .zero, size: pageSize), configuration: configuration)
setPrivateFlag(webView, "_setWindowOcclusionDetectionEnabled:", false)
let loader = Loader()
webView.navigationDelegate = loader
window.contentView = webView
window.orderBack(nil)

func pageURL(_ query: String) -> URL {
  var components = URLComponents(url: webRoot.appendingPathComponent("index.html"), resolvingAgainstBaseURL: false)!
  components.query = query
  return components.url!
}

@MainActor
func evaluate(_ script: String) async throws -> Any? {
  try await webView.evaluateJavaScript(script)
}

@MainActor
func render(_ frame: Frame) async throws -> CGImage {
  try await loader.load(pageURL("previewTime=\(frame.time)"), root: webRoot, in: webView)
  // Frames drawn since the photos loaded: enough for the figures' sprites to
  // load and appear too (see index.html).
  let start = Date()
  while (try await evaluate("window.odleWallpaperDrawn") as? Int ?? 0) < 40 {
    if Date().timeIntervalSince(start) > 30 { fail("the scene was not drawn for \(frame.name)") }
    try await Task.sleep(for: .milliseconds(100))
  }
  guard let dataURL = try await evaluate("document.getElementById('landscape').toDataURL('image/png')") as? String,
        let comma = dataURL.firstIndex(of: ","),
        let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
        let source = CGImageSourceCreateWithData(data as CFData, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fail("could not read the canvas for \(frame.name)")
  }
  return image
}

// The XMP property macOS reads: a base64 binary property list with each Sun
// position and the picture it shows ("si"), and the Light/Dark pictures ("ap").
// pictures are the names of the frames that have a picture, in file order.
func solarMetadata(_ frames: [Frame], pictures: [String]) throws -> CGImageMetadata {
  let index = { (name: String) in pictures.firstIndex(of: name) ?? 0 }
  let list: [String: Any] = [
    "ap": ["l": index("noon"), "d": index("night")],
    "si": frames.map { frame in
      ["i": index(frame.image), "a": frame.altitude, "z": frame.azimuth] as [String: Any]
    }
  ]
  let plist = try PropertyListSerialization.data(fromPropertyList: list, format: .binary, options: 0)
  let metadata = CGImageMetadataCreateMutable()
  let namespace = "http://ns.apple.com/namespace/1.0/" as CFString
  let prefix = "apple_desktop" as CFString
  guard CGImageMetadataRegisterNamespaceForPrefix(metadata, namespace, prefix, nil),
        let tag = CGImageMetadataTagCreate(namespace, prefix, "solar" as CFString, .string,
                                           plist.base64EncodedString() as CFString),
        CGImageMetadataSetTagWithPath(metadata, nil, "apple_desktop:solar" as CFString, tag) else {
    fail("could not create the solar metadata")
  }
  return metadata
}

func writePNG(_ image: CGImage, to url: URL) {
  guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
  CGImageDestinationAddImage(destination, image, nil)
  CGImageDestinationFinalize(destination)
}

Task { @MainActor in
  do {
    try await loader.load(pageURL(""), root: webRoot, in: webView)
    guard let json = try await evaluate(
      "JSON.stringify(odleWallpaper.plan('\(day)', \(latitude), \(longitude)))") as? String,
          let frames = try? JSONDecoder().decode([Frame].self, from: Data(json.utf8)), !frames.isEmpty else {
      fail("could not plan the frames for \(day)")
    }
    if let framesDirectory {
      try FileManager.default.createDirectory(at: framesDirectory, withIntermediateDirectories: true)
    }
    var pictures: [String] = []
    var images: [CGImage] = []
    for frame in frames {
      let line = frame.name.padding(toLength: 13, withPad: " ", startingAt: 0)
        + String(format: " %@  sun %6.2f° alt %6.2f° az", frame.time, frame.altitude, frame.azimuth)
      guard frame.image == frame.name else {
        print("\(line)  picture of \(frame.image)")
        continue
      }
      let image = try await render(frame)
      print("\(line)  picture \(images.count), \(image.width)x\(image.height)")
      if let framesDirectory {
        writePNG(image, to: framesDirectory.appendingPathComponent(String(format: "%02d-%@.png", images.count, frame.name)))
      }
      pictures.append(frame.name)
      images.append(image)
    }
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.heic.identifier as CFString,
                                                            images.count, nil) else {
      fail("could not create \(output.path)")
    }
    let options = [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary
    CGImageDestinationAddImageAndMetadata(destination, images[0], try solarMetadata(frames, pictures: pictures), options)
    for image in images.dropFirst() { CGImageDestinationAddImage(destination, image, options) }
    guard CGImageDestinationFinalize(destination) else { fail("could not write \(output.path)") }
    print("Wrote \(output.path)")
    exit(0)
  } catch {
    fail("\(error)")
  }
}
app.run()
