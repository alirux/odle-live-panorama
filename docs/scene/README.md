# Odle photographic scene

The two 1672 × 941 WebP plates in `core/assets/photo/` are project assets generated with the built-in
ImageGen tool. They contain no solar disk: the canvas draws it from the existing
solar ephemeris. They preserve the reference landscape's composition.

## Source and license

Mountain reference: [Gruppo delle Odle dalla malga Geisleralm, Luca Lorenzi](https://commons.wikimedia.org/wiki/File:Gruppo_delle_Odle_dalla_malga_Geisleralm.jpg),
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
The resulting landscape was generated and its lighting/sky were modified.
These derived image assets are provided under CC BY-SA 3.0. This does not change
the license of the website's code. A visible attribution is included in Help
and in the photographic scene, alongside the AI disclosure. The AI disclosure and source attribution open in the credits section of the
existing welcome panel. There is no separate overlay on the panorama.

## Rendering

- `odle-day.webp`: neutral daytime plate.
- `odle-sunset.webp`: warm sunset plate without the fixed sun.
- Solar altitude blends the plates; a cool grade produces twilight and night.
- A manually traced silhouette clips celestial bodies behind the mountain ridge.
- Images use aspect-preserving cover cropping, including on portrait screens.
- Celestial projection: 180° azimuth panorama centered on south, east on the
  left, west on the right; altitude zero at 55% image height, 90° spanning one
  image height. Northern objects and bodies outside the crop stay off screen.
- The solar disk is enlarged for readability, matching the reference's mood:
  radius 0.6% of the plate width (minimum 3 px). Its center is calculated.
- This is an artistic panorama, not a registered geographic photograph. Solar
  altitude/azimuth are calculated, but mountain angular heights and photographic
  shading are not measured. Trees do not bend and clouds are baked into the
  plates; the additional mist sways only while time runs at real speed,
  respecting reduced motion.
- The photographic base is cached by viewport and lighting bucket. Images total
  approximately 944 KB. No remote service is needed at runtime.
- If the images fail to load, the canvas shows a plain dark background. The
  older hand-drawn version of the landscape was removed on 2026-10-27; it is
  still in the git history.

## Modules

The scene is shared by the site and the screen saver. Every file below is a
plain script (no build step), loaded in this order:

| File | Role |
|---|---|
| `core/assets/tz-lookup.js` | Time zone of a coordinate |
| `core/assets/photo-seasons.js`, `photo-skyline.js`, `photo-landscape.js` | Seasons, sky boundaries and the photographic plates (`window.photoScene`) |
| `core/assets/photo-life-model.js`, `photo-visitors.js`, `photo-life.js` | The hut, the cows, the visitors and the flights (`window.photoLife`); the tooltip and exploration buttons only exist on pages that provide `#photo-life-tooltip` |
| `core/assets/odle-astronomy.js` | Pure astronomy and catalogues: Sun, Moon, planets, ISS orbit, stars, Moon phase shapes, zoned dates (`window.OdleAstronomy`, also `require`-able by the tests) |
| `core/assets/odle-scene.js` | The engine (`window.odleScene`): the clock, the observer, the sky state, the star, planet and ISS positions, the frame loop drawing on `#landscape` |
| `site/assets/odle-ui.js` | Site only: status panel, tooltips, time and place controls, globe, language, fullscreen, idle panels |

The engine starts with `odleScene.startScene()`. A page around it plugs in
through `odleScene.hooks`, which the engine calls after each astronomy update
(`astronomy`, `planets`, `iss`) and after every frame (`frame`); by default they
do nothing. The engine state that a page reads or changes (for example
`observer`, `simulationTimeMilliseconds`, `playbackRate`, the hovered bodies)
is exposed as accessors on `odleScene`, so assignments reach the engine's own
variables. The screen saver page loads everything except `odle-ui.js`.

## Preview

From the repository root: `node site/scripts/serve.cjs` (port 8765)

- `/?previewTime=2026-09-15T10:00:00Z`: day
- `/?previewTime=2026-09-15T16:00:00Z`: evening, sun to the right
- `/?previewTime=2026-09-15T22:00:00Z`: night
- `/?previewTime=2026-09-15T04:00:00Z&timeLapse=90`: 24 hours in 90 seconds
- `/?timeSpeed=24`: the clock runs 24 times faster from now (a day in an hour); with `previewTime` it starts from that instant

Tests: `node --test core/tests/photo-landscape.test.cjs`.

## Final ImageGen prompts

### Sunset plate

Use case: precise-object-edit. Prepare this exact photograph as a background plate for a dynamic website which draws its own moving sun. Remove ONLY the small bright solar disk on the right and its localized bright yellow circular halo, replacing that small region with seamless natural peach sunset sky matching the adjacent clouds and sky. Everything else MUST stay unchanged: entire exact Odle mountain silhouette, mountain position and scale, all rock textures, forest, path, meadow, mist, overall warm evening lighting and cloud arrangement. Same exact 1672x941 framing / 16:9 aspect ratio. No sun disk anywhere, no moon, no stars, no text. Preserve photographic quality. This is a minimal inpainting edit, not a new composition.

### Day plate

Use case: lighting-weather. Relight this exact landscape photograph to natural bright daytime, blue sky with soft white clouds, neutral pale grey limestone, sunlit fresh green meadows and forests. It is an aligned day plate for a crossfade: absolutely preserve EVERY object's geometry and exact screen position, the exact mountain skyline, rock formations, scree, trees, winding gravel path, cloud layout and framing. Change lighting and colors only. Natural realistic diffuse daylight, subtle light from the upper right, no orange sunset tint. Sky blue, clouds white, rocks natural pale limestone grey, detailed green foliage. No visible sun or moon anywhere because a dynamic sun will be drawn separately. No added or removed objects, no text, same 16:9 dimensions as reference. Preserve fine photographic texture; no stylization.

## Summit identification

The source photograph has named annotation rectangles, but its reconstruction
changes the contours. The definitive anchors use the user's two marked points
in the 1872 × 1319 panorama: Furchetta (642,250), Sass Rigais (790,240).
Inverting the photographic cover transform gives plate coordinates
Furchetta was subsequently refined to the skyline summit at (638,166);
Sass Rigais remains at (731.840788,171.220622).
Identity is looked up by peak id, then projected through the same cover
transform as the photograph, including portrait crops.
