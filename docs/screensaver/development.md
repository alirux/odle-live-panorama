# Development notes

How the screen saver is built and why. For building, installing and options see the [screen saver guide](README.md). Paths below are relative to the repository root.

## Layout

| File | Contents |
|---|---|
| `screensaver/Sources/OdleSaverView.swift` | The main view `OdleSaverView` and the waiting view `WaitingView` |
| `screensaver/Sources/OdleSettings.swift` | The options, stored in `ScreenSaverDefaults`, and the parameters passed to the page |
| `screensaver/Sources/OdleConfigSheet.swift` | The options sheet |
| `screensaver/Info.plist` | Display name, identifier `com.codingful.odle-saver`, principal class `OdleSaverView` |
| `screensaver/Resources/thumbnail*.png` | Thumbnail for the System Settings gallery |
| `screensaver/Tools/TestHost.swift` | A program that loads the bundle in an ordinary window, for testing |
| `screensaver/build.sh` | Build, signing and installation |
| `screensaver/web/index.html` | The screen saver's page: the `#landscape` canvas and the scene scripts, nothing else |
| `core/assets/` | The shared scene, also used by the site |
| `docs/screensaver/` | This documentation and the user guide |

## Build

`screensaver/build.sh`:

1. compiles the sources in `Sources/` for x86_64 and arm64 and merges them into a universal binary, linked as a loadable bundle (`-Xlinker -bundle`);
2. copies `Info.plist`, the thumbnails from `Resources/` and the repository's `LICENSE`, `LICENSE-CONTENT.txt` and `NOTICE`;
3. copies `screensaver/web/index.html` and `core/assets/` into `Contents/Resources/web/`, without Markdown notes and style sheets (`photo-life.css` styles the site's tooltips);
4. signs the bundle with a local signature (`codesign --sign -`);
5. with `--install`, removes versions installed under earlier names (`Odle.saver`, `Odle - Dolomites - Italy.saver`), copies the new one and quits the `legacyScreenSaver` processes, so macOS loads the updated version.

The gallery thumbnail in System Settings (`screensaver/Resources/thumbnail.png` at 180×116 and `screensaver/Resources/thumbnail@2x.png` at 360×232) is a fixed image: if the scene changes a lot it has to be redone, for example from a snapshot taken with the test host (see [Testing without locking the Mac](#testing-without-locking-the-mac)).

## Options

The choices are stored in `ScreenSaverDefaults` (module `com.codingful.odle-saver`) and read every time the scene starts (`screensaver/Sources/OdleSettings.swift`, sheet in `screensaver/Sources/OdleConfigSheet.swift`). After OK the view that opened the sheet (the preview in System Settings) loads the page again with the new choices. The frame rate reaches the page as `window.__odleFPS`, read on every frame; the battery check runs every 30 s through IOKit.

The page receives the values as parameters: `lat`, `lon`, `place`, `previewTime`, `previewLive=1`, `timeSpeed` and `noAnna=1` (`previewLive=1`: real time starting from `previewTime`; `timeSpeed`: the clock runs that many times faster, from `previewTime` or from now).

## How it works

### The page inside the screen saver

`OdleSaverView` is a `ScreenSaverView` that loads `Resources/web/index.html` into a WebKit1 `WebView`. That page is the screen saver's own (`screensaver/web/index.html`): the `#landscape` canvas, the shared scene scripts and `odleScene.startScene()`, with no panels, tooltips or pointer handlers, and the cursor hidden by its style sheet. The site's interface (`site/assets/odle-ui.js`) is never loaded, so nothing has to be hidden and the mouse moving over the System Settings thumbnail lights up nothing.

Before the page scripts run, a setup script (injected in `webView(_:didClearWindowObject:for:)`):

* forces `devicePixelRatio` to 1;
* replaces `requestAnimationFrame` with a version capped at the frame rate from the options (`window.__odleFPS`), which can be paused;
* sets `window.__odleSaverReady` two frames after the page's `photo-scene-ready` event, that is when the scene has really been drawn.

Unless the options choose a place, the sky follows the real time as seen from Santa Maddalena, the scene's default observer.

### Initial wait

Loading the photos takes a few seconds. Meanwhile `WaitingView` covers everything in black with a rotating white arc (Core Animation, at no CPU cost). It fades out as soon as the page reports that the scene is ready, and after 20 seconds at the latest.

### Start, pause and end

| Event | What happens |
|---|---|
| `startAnimation` | The scene resumes (if it was paused) |
| `stopAnimation` | The scene pauses: no frames, zero CPU |
| `com.apple.screensaver.willstop` or `com.apple.screenIsUnlocked` | The full screen instance quits its process |
| User input after the start, screen not locked | The full screen instance quits its process |
| User input after the start, screen locked | The scene keeps running behind the password prompt; the process quits after unlocking |
| Displays go to sleep / wake up | The scene pauses / resumes |

The thumbnail in System Settings (`isPreview`) never quits the process: it only pauses.

## Problems found and choices made

Each choice below fixes a real problem, almost always a black screen or a CPU at 100%. Before changing one, reread the reason.

### WebKit1 instead of WKWebView

`WKWebView` draws in a separate process and hands remote layers to the screen. The screen saver itself runs in a remote view (the `legacyScreenSaver` process), and the second hop gets lost: preview and screen saver stayed black even though the page was drawing. The WebKit1 `WebView` draws in the same process, so the image reaches the screen. Apple has deprecated this API: it works today, a future macOS version may remove it.

With WebKit1 a user style sheet passed as a `data:` URL is ignored: styles for the screen saver belong in its page, `screensaver/web/index.html`.

### Page forced "visible"

The screen saver window is hosted in another process and WebKit never sees it as visible: the page is marked hidden and `requestAnimationFrame` never runs. `forceVisible` uses three private `WebView` methods (`setWindowOcclusionDetectionEnabled:`, `_setIsVisible:`, `_setVisibilityState:isInitialState:`) to declare it visible.

### Layers at scale 1 and in sRGB

With WebKit compositing, the canvas is copied into a layer on every frame. By default the layer is 16 bit HDR, at Retina resolution and in the display color space: the conversion takes a whole core. A saturated process can no longer draw, and when macOS reuses it the screen stays black.

`keepLayersCheap` asks WebKit to render at one pixel per point (private method `_setCustomBackingScaleFactor:`) and puts the window in sRGB, like the canvas. The GPU does the scaling up to the Retina display. A timer calls it every 0.25 seconds, because WebKit recreates its layers whenever it likes and macOS does not always call `animateOneFrame`.

Tried and discarded:

* **Changing WebKit's layers directly** (`contentsFormat`, `contentsScale`): on large displays WebKit splits the content into tiles and rebuilds them while they are being walked, and the process crashed.
* **Turning compositing off**: no more HDR layers, but copying into the view and scaling in software cost more.
* **Capping the canvas resolution below the display's**: it cost more, because the scaling happened on the CPU, and it pixelated small details such as the helicopter.

### Frame rate cap without needless redraws

The page redraws the whole scene on every frame: without a cap the main thread saturates. The limiter lets through all requests of the same frame (otherwise the page's main loop starves the other animations, including the scene ready signal). An early request waits on a timer instead of asking for another frame right away: otherwise WebKit keeps redrawing the view at full speed.

### Quitting the process

Since macOS 14 the `legacyScreenSaver` process stays alive after the screen saver closes and is reused for the next start. On that reuse the scene no longer appeared: from the second time on everything was black. That is why the full screen instance quits its own process, and every start begins clean.

The stop signal, however, arrives only in some cases:

* the System Settings **Preview** runs in a `ScreenSaverEngine` process and receives `com.apple.screensaver.willstop`;
* the screen saver **started by inactivity** is hosted by the wallpaper agent (Activity Monitor shows it as `legacyScreenSaver (Wallpaper)`), creates one view per display in the same process and receives no notification.

For the second case, every second `CGEventSource.secondsSinceLastEventType` tells whether there has been input since the start: any input closes a screen saver, so if there was some, the screen saver is over.

There is one exception: if the screen saver started with the screen locked, the first input brings up the password prompt and macOS leaves the scene in the background. Quitting the process at once left black behind the prompt. So after an input the process quits only once the screen is no longer locked (`CGSSessionScreenIsLocked` from `CGSessionCopyCurrentDictionary`); on unlocking, `com.apple.screensaver.willstop` arrives as well.

If the password prompt stays up and the displays go to sleep, `NSWorkspace.screensDidSleepNotification` pauses the scene and `screensDidWakeNotification` resumes it: with the displays off it uses no CPU.

The stop notification reaches every instance, the System Settings thumbnail included: so the thumbnail ignores it and only pauses on `stopAnimation`.

## CPU usage

Measured on 2026-10-24 on an Intel Mac, with the screen saver visible:

| Situation | CPU |
|---|---|
| 1440×900 display, test host | 11-15% |
| 2560×1440 display, test host | about 27% |
| Two displays (1680×1050 and 2560×1440), real screen saver | about 55% in total |
| After quitting | 0%: the process no longer exists |
| Thumbnail in System Settings, paused | 0% |

The scene runs at about 20 actual fps.

## Testing without locking the Mac

Starting the real screen saver (for example with `open -a ScreenSaverEngine`) triggers the password lock: avoid it during development.

For testing there is `screensaver/Tools/TestHost.swift`, which loads the bundle in an ordinary window and prints CPU, page and canvas sizes. Compile it after `build.sh`, which empties the `build/` folder on every build. From `screensaver/`:

```bash
xcrun swiftc -o build/testhost Tools/TestHost.swift -framework ScreenSaver -framework WebKit
build/testhost "build/Odle Dolomites Italy.saver" 2560 1440 10 build/snapshot.png
```

Things to keep in mind:

* the host creates the view as a preview, because a full screen instance quits its process at the first input, that is as soon as the Mac is used;
* the window sits behind the others but on screen: off screen there is no display refresh and the CPU numbers come out wrong;
* the snapshot (`cacheDisplay`) does not capture Core Animation layers, such as the arc of the waiting view.

To see what happens in the real screen saver you need a temporary log: inside the sandbox, `NSTemporaryDirectory()` maps to `~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/tmp/`. Install a build that writes there, start the screen saver from System Settings (Preview) or by inactivity, then read the file. The system screenshot does not capture the screen saver window.

To see where a `legacyScreenSaver` process that stayed alive spends its time: `sample <pid> 3`.
