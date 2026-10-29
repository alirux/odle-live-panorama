# Odle Dolomites Italy wallpaper

Two dynamic macOS wallpapers with the photographic Odle scene, one for summer and one for winter. Each one is a single HEIC file with about twenty pictures of the same day: the night, eight steps of the Sun rising, the day, the Sun in the sky in mid morning and mid afternoon, and eight steps of the Sun setting. macOS shows the picture whose Sun position is closest to the Sun where the Mac is, so the light on the desktop follows the day.

The wallpaper is also what macOS shows on the login window and on the lock screen. That matters with FileVault: after a restart the screen saver cannot run before the first login, and the wallpaper is the only Odle you see there.

## Download and install

The ready files are attached to the [GitHub releases](https://github.com/alirux/odle-live-panorama/releases/latest); the instructions to set them are in [`wallpaper/release/README.md`](../../wallpaper/release/README.md).

## Build

Building needs Xcode or the Command Line Tools, for `swiftc`; it was built on macOS 15.8, Intel. From the repository root:

```bash
wallpaper/build.sh
```

It creates, in `wallpaper/build/`:

* `Odle Dolomites Italy Summer.heic` (5 July 2026, 20 pictures)
* `Odle Dolomites Italy Winter.heic` (8 January 2026, 19 pictures)

Both days have a waning Moon, about 70% lit, in the sky at night and at dawn: a full Moon would look wrong too often, since the picture shows that day's Moon whatever the real one is.

Options:

* `--frames` also keeps every picture as a PNG in `wallpaper/build/frames/`, useful to check them.
* `--release` also copies the two files into `wallpaper/release/` as `Odle-Dolomites-Italy-Summer.heic` and `...-Winter.heic`, ready to attach to a GitHub release (see [Publishing a release](../../README.md#publishing-a-release)). They are not tracked by git. Use it once the pictures have been checked.

A build takes about three minutes. While it runs, a borderless window sits behind the other windows: leave it there.

The wallpapers are pictures of the scene, not a copy of it: after changing `core/` or `wallpaper/web/`, build them again, and with `--release` and a new GitHub release to publish the change.

## How it is made

`wallpaper/web/index.html` is the scene alone, like the screen saver page, frozen at the instant in `?previewTime=`. `wallpaper/web/frames.js` picks the instants for one day at Santa Maddalena from the Sun's altitude. The scene's light changes between −15° (the end of the night) and +28° (the end of the warm light in `photo-landscape.js`), most of all near the horizon, so the pictures are where the Sun crosses −14°, −9°, −5°, −2°, +1°, +6°, +14° and +21°, rising and setting, plus the lowest Sun for the night and the highest for the day.

Above +28° the scene looks the same for hours, so the day is a single picture used by three Sun positions: the crossings of +28° in the morning and in the afternoon and the highest Sun. Without the two extra positions macOS would pick a twilight picture with the Sun high in the sky, because it would be the closest one. In winter the Sun stays below +28° and the day picture has noon alone.

The panorama faces south, from east at the left edge to west at the right, and the ridge hides the low Sun: at sunrise and sunset the Sun is behind the mountains or out of the picture. So two more pictures show it, in the middle of the minutes when its whole disk is in the sky (`sunInView`, with the scene's own projection and skyline), one in the morning and one in the afternoon. In July that is around 10:00 and 16:30 local time, high in the corners; in January only after noon, between the peaks, so winter has the afternoon one alone. Each instant is moved by up to six minutes to a moment when the winter sky is clear (`photo-seasons.js` repeats its flurries every 720 seconds), so no picture freezes falling snow.

`wallpaper/Sources/main.swift` opens the page in a 1920 × 1200 point `WKWebView` drawing at twice that size, so the pictures are 3840 × 2400. For each instant with its own picture it loads the page, waits for 40 frames drawn after the photos have loaded (enough for the figures to appear too), reads the canvas and finally writes the HEIC. The first picture carries the XMP property `apple_desktop:solar`: a binary property list, in base64, with the altitude and azimuth of each Sun position and the picture it shows (`si`, so several positions can share a picture), and the pictures for Light and Dark (`ap`).

Things that were needed for the canvas to be drawn at all:

* The page draws with timers instead of `requestAnimationFrame`: WebKit stops the animation frames for a covered window.
* The tool opts out of App Nap and turns off WebKit's hidden page timer throttling, process suppression and window occlusion detection (private setters, skipped if missing). Without them the first picture came out and the next ones were blank or timed out.
* `allowFileAccessFromFileURLs`: the scene reads the pixels of its sprites, which a file page may not do otherwise.

## Known limitations

* In winter, sunrise and sunset look much like daytime: the scene has a single snowy photograph, with no sunset version. Dusk, evening and night still change, but the pictures from +1° to +21° are nearly the same.
* The pictures are 16:10. On a 16:9 display macOS fills the screen by cutting a little off the top and bottom.
* The source photographs are 1672 pixels wide, so above 4K the pictures do not gain detail.
* People and animals are wherever the scene puts them at that instant, and the Moon is that day's Moon.
* The Sun and the Moon are as small as in the scene, about 15 points on the screen.
