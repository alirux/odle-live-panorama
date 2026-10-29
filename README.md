# Odle

A photographic panorama of the Odle peaks in Val di Funes under a live sky. Sun, Moon, planets, stars and the ISS are computed for the real moment and place; the light moves from dawn to night, winter brings snow, and people and animals come to the mountain hut on their own schedules.

![The Odle scene](docs/preview.jpg)

The scene is shipped as three separate products, built from the same sources:

* **The site**: Alberto Lirussi's interactive home page, where the sky can be explored with the pointer, with help, licence and privacy pages in Italian and English.
* **The screen saver** "Odle Dolomites Italy" for macOS: only the landscape, with no panels, controls or tooltips.
* **The wallpapers** for macOS, summer and winter: dynamic HEIC files whose light follows the Sun during the day.

## Layout

| Path | Contents |
|---|---|
| `core/` | The shared scene: scripts, styles and images (`core/assets/`), their tests (`core/tests/`) and the skyline generator (`core/scripts/`) |
| `site/` | The site: the pages, the interface script `site/assets/odle-ui.js`, the site-only assets (`site/assets/help/`, licence page styles), the local server and the release script; `site/release/` is the published copy |
| `screensaver/` | The screen saver: its page (`screensaver/web/`), Swift sources, `Info.plist`, thumbnails, test host and `build.sh`; `screensaver/release/` holds the install instructions |
| `wallpaper/` | The wallpapers: their page and frame planner (`wallpaper/web/`), the Swift renderer and `build.sh`; `wallpaper/release/` holds the instructions to set them |
| `docs/` | Documentation: `docs/scene/`, `docs/site/`, `docs/screensaver/`, `docs/wallpaper/` |

No product keeps a copy of the scene: all of them load it from `core/`. The engine (`core/assets/odle-scene.js`) draws the scene on a `#landscape` canvas and knows nothing about the page around it. The site wraps it in its interface (`site/index.html` and `site/assets/odle-ui.js`); the screen saver and the wallpapers have their own pages with the canvas alone (`screensaver/web/index.html`, `wallpaper/web/index.html`). How the modules fit together is in [docs/scene/README.md](docs/scene/README.md#modules).

## The site

It is a static site (HTML, CSS and JavaScript, with no framework and no remote services at run time). The pages use absolute paths (`/help.html`) and load the scene from `/assets/`, so run them through the local server, which serves `site/` with `core/` beneath it:

```bash
node site/scripts/serve.cjs
```

Then open <http://127.0.0.1:8765/>. Some parameters useful for testing:

| Parameter | Effect |
|---|---|
| `lang=en` | Page in English |
| `previewTime=2026-09-15T16:40:00Z` | Scene at a precise instant (UTC) |
| `timeLapse=90` | A whole day in 90 seconds |
| `flightPreview=helicopter` or `paraglider` | Starts a flight right away |
| `noAnna=1` | Removes the girl from the scene |

To publish:

```bash
node site/scripts/build-release.cjs
```

The script recreates `site/release/` with only the files the site loads: the pages, the icons, the licence files and the assets referenced by HTML, CSS and JavaScript (from `site/` or `core/`), including the sprites that `core/assets/photo-visitors.js` loads by name. If a page references a file that does not exist, the script stops and lists it. The contents of `site/release/` are what goes on the server.

## The screen saver

Requires macOS 12 or later and Xcode or the Command Line Tools.

```bash
screensaver/build.sh            # creates screensaver/build/Odle Dolomites Italy.saver
screensaver/build.sh --install  # also copies it into ~/Library/Screen Savers
screensaver/build.sh --release  # also zips it into screensaver/release/ for a GitHub release
```

Then pick it in System Settings → Screen Saver, under "Other". The bundle contains its own copy of the scene: after changing `core/` or `screensaver/web/`, rebuild it.

The ready screen saver is attached to the [GitHub releases](https://github.com/alirux/odle-live-panorama/releases/latest), with the steps to install it in [screensaver/release/README.md](screensaver/release/README.md). The options and the known limitations are described in [docs/screensaver/README.md](docs/screensaver/README.md).

## The wallpapers

The ready files, for macOS 10.14 or later, are attached to the [GitHub releases](https://github.com/alirux/odle-live-panorama/releases/latest): download one, keep it in a folder such as Pictures, add it in System Settings → Wallpaper → Add Photo and choose Dynamic. The step by step instructions are in [wallpaper/release/README.md](wallpaper/release/README.md); how they are made is in [docs/wallpaper/README.md](docs/wallpaper/README.md). The wallpaper is also what macOS shows on the login window and the lock screen.

Building them requires Xcode or the Command Line Tools:

```bash
wallpaper/build.sh            # creates wallpaper/build/Odle Dolomites Italy Summer.heic and ... Winter.heic
wallpaper/build.sh --release  # also copies them into wallpaper/release/ for a GitHub release
```

## Publishing a release

The screen saver ZIP and the wallpapers are not kept in git: they are attached to a [GitHub release](https://github.com/alirux/odle-live-panorama/releases/latest). Build them with `--release`, then create the release with the [GitHub CLI](https://cli.github.com/):

```bash
screensaver/build.sh --release
wallpaper/build.sh --release
gh release create v1.0 --title "Odle 1.0" screensaver/release/*.saver.zip wallpaper/release/*.heic
```

The install instructions link to `releases/latest/download/`, so they always point to the newest release; keep the asset names as the build scripts write them.

## Tests

Only Node.js and its test runner are needed:

```bash
node --test core/tests/*.test.cjs
```

## Documentation

* [docs/scene/README.md](docs/scene/README.md): the photographic scene, the source of the landscape and the sky projection.
* [docs/scene/LIFE.md](docs/scene/LIFE.md): the hut, the cows, the characters and the flights.
* [docs/scene/WINTER.md](docs/scene/WINTER.md), [SLED.md](docs/scene/SLED.md), [ANNA.md](docs/scene/ANNA.md), [EDELWEISS.md](docs/scene/EDELWEISS.md): winter, the sled, the girl and the edelweiss.
* [docs/site/TEXTS-IT-EN.md](docs/site/TEXTS-IT-EN.md): every text of the site in Italian and English.
* [docs/screensaver/README.md](docs/screensaver/README.md): installing and using the screen saver.
* [docs/screensaver/development.md](docs/screensaver/development.md): how the screen saver works and why, CPU usage, testing without locking the Mac.
* [docs/wallpaper/README.md](docs/wallpaper/README.md): building and using the wallpapers, and how they are made.

## Licence

* Code (site, scene, screen saver and wallpapers): [Apache License 2.0](LICENSE).
* Original prose: [CC BY-NC-SA 4.0](LICENSE-CONTENT.txt).
* Landscape and derived images: CC BY-SA 3.0. They were generated and reworked with artificial intelligence from the photograph [“Gruppo delle Odle dalla malga Geisleralm” by Luca Lorenzi](https://commons.wikimedia.org/wiki/File:Gruppo_delle_Odle_dalla_malga_Geisleralm.jpg) (Wikimedia Commons, CC BY-SA 3.0).

The details are in [NOTICE](NOTICE) and on the site's [licence.html](site/licence.html) page.
