import ScreenSaver
import WebKit

// Hosts the Odle photo scene: the screen saver's own page (web/index.html,
// only the landscape canvas) and the shared scene assets, copied into the
// bundle's Resources/web folder.
//
// It uses the legacy in-process WebView on purpose: WKWebView renders in a
// separate process and its layers never show up inside the screen saver
// host, which is itself a remote view, so the screen stays black.
@objc(OdleSaverView)
final class OdleSaverView: ScreenSaverView, WebFrameLoadDelegate {

  private var webView: WebView?

  // Covers the page with a spinner until the scene is on screen, which
  // takes a few seconds while the photos load.
  private var waitingView: WaitingView?
  private var readyTimer: Timer?
  private var inputWatch: Timer?
  private var layerWatch: Timer?
  private var powerWatch: Timer?
  private var settings = OdleSettings.load()
  private var configSheet: OdleConfigSheet?
  // A display that is not animated shows the first frame of the scene.
  private var frozen = false
  private static let readyTimeout: TimeInterval = 20

  override init?(frame: NSRect, isPreview: Bool) {
    super.init(frame: frame, isPreview: isPreview)
    // The page animates itself with requestAnimationFrame.
    animationTimeInterval = 1.0
    setUpWebView()

    // Since macOS 14 legacyScreenSaver keeps running after the saver is
    // dismissed, and when it is reused for the next run the screen stays
    // black: quit it when the full screen saver stops, so every run starts
    // from a fresh process (this also stops it using the CPU in the
    // background). Every instance gets the notification, so the thumbnail
    // in System Settings ignores it. When the saver started from inactivity
    // locks the screen, unlocking it ends the saver as well.
    for name in ["com.apple.screensaver.willstop", "com.apple.screenIsUnlocked"] {
      DistributedNotificationCenter.default().addObserver(
        self,
        selector: #selector(screenSaverWillStop),
        name: NSNotification.Name(name),
        object: nil
      )
    }

    // The saver started from inactivity (hosted by the wallpaper agent, one
    // view per display) gets none of those notifications. Any input ends a
    // screen saver, so input after the start means it is over; but when the
    // screen is locked the scene stays behind the password prompt, so the
    // process waits until the screen is unlocked.
    if !isPreview {
      let started = Date()
      var inputSeen = false
      inputWatch = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
        let anyInput = CGEventType(rawValue: ~0)!
        let idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: anyInput)
        let running = Date().timeIntervalSince(started)
        if running > 3 && idle < running - 2 && !inputSeen {
          inputSeen = true
        }
        if inputSeen && !Self.screenIsLocked() {
          exit(0)
        }
      }
      RunLoop.main.add(inputWatch!, forMode: .common)
    }

    // With the screen locked the displays may go to sleep while the scene is
    // still on: pause it until they wake up.
    let workspace = NSWorkspace.shared.notificationCenter
    workspace.addObserver(self, selector: #selector(screensDidSleep), name: NSWorkspace.screensDidSleepNotification, object: nil)
    workspace.addObserver(self, selector: #selector(screensDidWake), name: NSWorkspace.screensDidWakeNotification, object: nil)
  }

  private static func screenIsLocked() -> Bool {
    guard let session = CGSessionCopyCurrentDictionary() as? [String: Any] else { return false }
    return session["CGSSessionScreenIsLocked"] as? Bool ?? false
  }

  @objc private func screensDidSleep() {
    setScenePaused(true)
  }

  @objc private func screensDidWake() {
    setScenePaused(false)
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setUpWebView()
  }

  deinit {
    DistributedNotificationCenter.default().removeObserver(self)
    NSWorkspace.shared.notificationCenter.removeObserver(self)
  }

  private func setUpWebView() {
    let bundle = Bundle(for: OdleSaverView.self)
    guard
      let webFolder = bundle.resourceURL?.appendingPathComponent("web", isDirectory: true)
    else { return }

    let preferences = WebPreferences(identifier: "com.codingful.odle-saver")!
    preferences.isJavaScriptEnabled = true

    guard let webView = WebView(frame: bounds, frameName: nil, groupName: nil) else { return }
    webView.preferences = preferences
    webView.autoresizingMask = [.width, .height]
    webView.drawsBackground = false
    webView.frameLoadDelegate = self
    webView.wantsLayer = true
    addSubview(webView)
    self.webView = webView

    // WebKit sets up its layers again whenever it likes, so they are kept
    // cheap by this timer rather than by animateOneFrame, which macOS does
    // not always call.
    layerWatch?.invalidate()
    layerWatch = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
      self?.keepLayersCheap()
    }
    RunLoop.main.add(layerWatch!, forMode: .common)
    Self.forceVisible(webView)
    loadScene(from: webFolder)

    // The frame rate follows the power source: the page reads it every frame.
    powerWatch?.invalidate()
    powerWatch = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
      self?.applyFramesPerSecond()
    }
    RunLoop.main.add(powerWatch!, forMode: .common)
  }

  // Reads the options and loads the page with them, behind the spinner.
  private func loadScene(from webFolder: URL) {
    guard let webView = webView else { return }
    showWaiting()
    settings = OdleSettings.load()
    frozen = false
    // resourceURL is relative to the bundle: URLComponents would drop the base.
    let index = webFolder.appendingPathComponent("index.html").absoluteURL
    var page = URLComponents(url: index, resolvingAgainstBaseURL: false)
    page?.percentEncodedQuery = settings.pageQuery
    webView.mainFrame.load(URLRequest(url: page?.url ?? index))
  }

  // After OK in the options the thumbnail in System Settings shows the new
  // choices at once, instead of keeping the scene it started with.
  private func reloadScene() {
    guard let webFolder = Bundle(for: OdleSaverView.self).resourceURL?
      .appendingPathComponent("web", isDirectory: true) else { return }
    loadScene(from: webFolder)
  }

  private func applyFramesPerSecond() {
    var fps = settings.framesPerSecond
    if settings.reduceOnBattery && OdleSettings.onBattery() {
      fps = min(fps, OdleSettings.batteryFramesPerSecond)
    }
    _ = webView?.stringByEvaluatingJavaScript(from: "window.__odleFPS = \(fps)")
  }

  // With the option on, only the display with the menu bar keeps moving: once
  // the scene is shown the others stop on that frame. The preview in System
  // Settings always moves.
  private func freezeIfSecondaryDisplay() {
    guard !isPreview, settings.animateOnlyMainDisplay, let screen = window?.screen,
          screen != NSScreen.screens.first else { return }
    frozen = true
    setScenePaused(true)
  }

  private func showWaiting() {
    waitingView?.removeFromSuperview()
    let waitingView = WaitingView(frame: bounds)
    waitingView.autoresizingMask = [.width, .height]
    addSubview(waitingView)
    self.waitingView = waitingView

    let started = Date()
    readyTimer?.invalidate()
    readyTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
      guard let self, let webView = self.webView else { return }
      let ready = webView.stringByEvaluatingJavaScript(from: "String(window.__odleSaverReady === true)")
      if ready == "true" || Date().timeIntervalSince(started) > Self.readyTimeout {
        self.hideWaiting()
        self.applyFramesPerSecond()
        if ready == "true" {
          // Let the first frames reach the screen before stopping.
          DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.freezeIfSecondaryDisplay()
          }
        }
      }
    }
  }

  private func hideWaiting() {
    readyTimer?.invalidate()
    readyTimer = nil
    guard let waitingView = waitingView else { return }
    self.waitingView = nil
    NSAnimationContext.runAnimationGroup({ context in
      context.duration = 0.8
      waitingView.animator().alphaValue = 0
    }, completionHandler: {
      waitingView.removeFromSuperview()
    })
  }

  @objc private func screenSaverWillStop() {
    guard !isPreview else { return }
    exit(0)
  }

  override func startAnimation() {
    super.startAnimation()
    if webView == nil {
      setUpWebView()
    }
    setScenePaused(false)
  }

  override func stopAnimation() {
    super.stopAnimation()
    setScenePaused(true)
  }

  private func setScenePaused(_ paused: Bool) {
    if frozen && !paused { return }
    _ = webView?.stringByEvaluatingJavaScript(from: "window.__odleSaverPause && window.__odleSaverPause(\(paused))")
  }

  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    keepLayersCheap()
  }

  override func animateOneFrame() {
    if let webView = webView {
      Self.forceVisible(webView)
    }
    keepLayersCheap()
  }

  // WebKit copies the canvas into its layers on the CPU at every frame. At
  // Retina scale and in the display color space that saturates the CPU (and
  // a saturated process shows a black screen): render at one pixel per point
  // (the GPU scales the layers up) and keep the window in sRGB like the
  // canvas. WebKit's own layers are not touched: it rebuilds them at will.
  private func keepLayersCheap() {
    if let window = window, window.colorSpace != .sRGB {
      window.colorSpace = .sRGB
    }
    guard let webView = webView else { return }
    let customScale = NSSelectorFromString("_setCustomBackingScaleFactor:")
    if webView.responds(to: customScale) {
      typealias ScaleSetter = @convention(c) (AnyObject, Selector, CGFloat) -> Void
      unsafeBitCast(webView.method(for: customScale), to: ScaleSetter.self)(webView, customScale, 1)
    }
  }

  // The screen saver window is hosted in another process and never looks
  // visible to WebKit, which then marks the page hidden and stops
  // requestAnimationFrame: tell it the page is visible.
  private static func forceVisible(_ webView: WebView) {
    let occlusion = NSSelectorFromString("setWindowOcclusionDetectionEnabled:")
    let isVisible = NSSelectorFromString("_setIsVisible:")
    let visibility = NSSelectorFromString("_setVisibilityState:isInitialState:")
    typealias BoolSetter = @convention(c) (AnyObject, Selector, Bool) -> Void
    typealias StateSetter = @convention(c) (AnyObject, Selector, Int, Bool) -> Void

    if webView.responds(to: occlusion) {
      unsafeBitCast(webView.method(for: occlusion), to: BoolSetter.self)(webView, occlusion, false)
    }
    if webView.responds(to: isVisible) {
      unsafeBitCast(webView.method(for: isVisible), to: BoolSetter.self)(webView, isVisible, true)
    }
    if webView.responds(to: visibility) {
      // WebPageVisibilityStateVisible
      unsafeBitCast(webView.method(for: visibility), to: StateSetter.self)(webView, visibility, 0, false)
    }
  }

  override var hasConfigureSheet: Bool { true }
  override var configureSheet: NSWindow? {
    let sheet = OdleConfigSheet()
    sheet.onSave = { [weak self] in self?.reloadScene() }
    configSheet = sheet
    return sheet.window
  }

  // The legacy WebView paints the canvas on the CPU, and the page redraws the
  // whole scene on every frame: render at one pixel per point (the canvas
  // then matches its 1x layer and the GPU scales it up) and cap the frame
  // rate (window.__odleFPS, set from the options), otherwise the main thread
  // is saturated. With two displays there are two scenes in the same process.

  // Runs before the page scripts.
  private var pageSetupScript: String { Self.pageSetupScript(framesPerSecond: settings.framesPerSecond) }

  private static func pageSetupScript(framesPerSecond: Int) -> String { """
    // The photos are loaded when the page sends photo-scene-ready, and the
    // scene is on the canvas a frame later: then the waiting view can go.
    window.addEventListener("photo-scene-ready", () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__odleSaverReady = true;
      }));
    });
    Object.defineProperty(window, "devicePixelRatio", { get: () => 1 });
    (() => {
      const nativeFrame = window.requestAnimationFrame.bind(window);
      window.__odleFPS = \(framesPerSecond);
      let last = 0;
      // While paused the callbacks wait here, without asking for frames.
      let paused = false;
      const parked = [];
      window.__odleSaverPause = value => {
        paused = value;
        if (!paused) parked.splice(0).forEach(wait => nativeFrame(wait));
      };
      window.requestAnimationFrame = callback => nativeFrame(function wait(time) {
        if (paused) { parked.push(wait); return; }
        const interval = 1000 / window.__odleFPS;
        // Every callback of the frame that is let through runs: comparing
        // with that frame's own time keeps them from starving each other.
        // An early callback waits on a timer rather than asking for the next
        // frame, which would keep WebKit repainting the view at full rate.
        if (time !== last && time - last < interval - 4) {
          setTimeout(() => nativeFrame(wait), Math.max(0, interval - (time - last) - 8));
          return;
        }
        last = time;
        callback(time);
      });
    })();
    """ }

  // MARK: WebFrameLoadDelegate

  func webView(_ sender: WebView!, didClearWindowObject windowObject: WebScriptObject!, for frame: WebFrame!) {
    guard frame == sender.mainFrame else { return }
    windowObject.evaluateWebScript(pageSetupScript)
  }
}

// Black cover with a thin spinning arc in the middle. Core Animation runs
// it in the render server, so it costs nothing while the page loads.
final class WaitingView: NSView {

  private let spinner = CAShapeLayer()

  override init(frame: NSRect) {
    super.init(frame: frame)
    wantsLayer = true
    layer?.backgroundColor = NSColor.black.cgColor

    spinner.fillColor = nil
    spinner.strokeColor = NSColor(white: 1, alpha: 0.75).cgColor
    spinner.lineCap = .round
    spinner.strokeStart = 0
    spinner.strokeEnd = 0.28
    layer?.addSublayer(spinner)
    layoutSpinner()

    let spin = CABasicAnimation(keyPath: "transform.rotation.z")
    spin.fromValue = 0
    spin.toValue = -2 * Double.pi
    spin.duration = 1.1
    spin.repeatCount = .infinity
    spinner.add(spin, forKey: "spin")
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not used")
  }

  override func layout() {
    super.layout()
    layoutSpinner()
  }

  private func layoutSpinner() {
    let diameter = max(14, min(44, bounds.height * 0.05))
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    spinner.bounds = CGRect(x: 0, y: 0, width: diameter, height: diameter)
    spinner.position = CGPoint(x: bounds.midX, y: bounds.midY)
    spinner.lineWidth = max(1.5, diameter / 16)
    spinner.path = CGPath(ellipseIn: spinner.bounds.insetBy(dx: spinner.lineWidth, dy: spinner.lineWidth), transform: nil)
    CATransaction.commit()
  }
}
