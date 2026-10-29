// Loads the screen saver bundle in an ordinary window, so it can be tried
// without starting the real screen saver (which locks the Mac).
//
// Build:  xcrun swiftc -o build/testhost Tools/TestHost.swift -framework ScreenSaver -framework WebKit
// Run:    build/testhost "build/Odle Dolomites Italy.saver" [width height [seconds [snapshot.png]]]
//
// The view is created as a preview: a full screen instance quits its process
// at the first mouse or keyboard input, which would end the test as soon as
// the Mac is used. The window sits behind the other windows but on screen:
// off screen there is no display refresh and the CPU numbers are wrong.
import AppKit
import ScreenSaver
import WebKit

func findWebView(_ view: NSView) -> WebView? {
  if let webView = view as? WebView { return webView }
  for subview in view.subviews {
    if let webView = findWebView(subview) { return webView }
  }
  return nil
}

let arguments = CommandLine.arguments
guard arguments.count >= 2, let bundle = Bundle(path: arguments[1]), bundle.load(),
      let saverClass = bundle.principalClass as? ScreenSaverView.Type else {
  print("usage: testhost <bundle.saver> [width height [seconds [snapshot.png]]]")
  exit(2)
}
let width = arguments.count > 3 ? Double(arguments[2]) ?? 1440 : 1440
let height = arguments.count > 3 ? Double(arguments[3]) ?? 900 : 900
let seconds = arguments.count > 4 ? Double(arguments[4]) ?? 10 : 10
let snapshotPath = arguments.count > 5 ? arguments[5] : nil

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let frame = NSRect(x: 0, y: 0, width: width, height: height)
let window = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
window.setFrame(frame, display: false)
guard let saver = saverClass.init(frame: frame, isPreview: true) else { exit(1) }
window.contentView = saver
window.orderBack(nil)
saver.startAnimation()

// CPU is measured over the second half of the run, after the photos load.
var cpuAtHalf = clock()
DispatchQueue.main.asyncAfter(deadline: .now() + seconds / 2) { cpuAtHalf = clock() }
DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
  let cpu = Double(clock() - cpuAtHalf) / Double(CLOCKS_PER_SEC) / (seconds / 2) * 100
  let page = findWebView(saver)?.stringByEvaluatingJavaScript(from: """
    (() => {
      const canvas = document.getElementById("landscape");
      try { return location.href + " fps " + window.__odleFPS + " " + innerWidth + "x" + innerHeight + ", canvas " + canvas.width + "x" + canvas.height +
        ", ready " + (window.__odleSaverReady === true); } catch (e) { return "err " + e + " " + location.href; }
    })()
    """) ?? "no web view"
  print(String(format: "cpu %.0f%%, page %@", cpu, page))
  if let snapshotPath, let image = saver.bitmapImageRepForCachingDisplay(in: saver.bounds) {
    saver.cacheDisplay(in: saver.bounds, to: image)
    try? image.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: snapshotPath))
  }
  exit(0)
}
app.run()
