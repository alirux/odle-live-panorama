# Photographic inhabitants

The photographic scene includes a hut, its barn and benches, three static Alpine
cows, solar opening hours, chimney smoke, evening window lights and dawn mist.
Objects use the same 1672 × 941 coordinate system and cover crop as the
panorama. A local meadow clearing supports both the main hut and the left barn.
The entire building group now occupies the right meadow. Architecture and
supporting ground are generated together, so the barn and main house share
continuous foundations and contact shadows. The path passes in front of them.
Colour grading is cached. Smoke and drifting mist freeze when the browser
requests reduced motion.

Solar opening hours and dawn mist were adapted from
`homepage_montagna`. The model lives in
`core/assets/photo-life-model.js`; the renderer and accessible exploration buttons
live in `core/assets/photo-life.js`. Opening times follow the selected observer's
local time. Cows keep fixed poses and positions, with no movement, pose
transitions or alternating visits. Daylight controls their visibility.

The browser remembers a collapsed welcome panel and a dismissed phone
rotation suggestion. Objects can be explored by pointer, touch or keyboard.
Sun distance is labelled as a mean; Moon distance uses the existing lunar
calculation in Earth radii multiplied by 6378.14 km.

## Assets

The images described here are in `core/assets/photo/`.

`hut.webp` and `cows.webp` were generated with the built-in ImageGen
tool with transparent backgrounds, then encoded as WebP at quality 90,
preserving dimensions and alpha. Full-resolution PNG originals remain in
the Codex generated-images directory. The cow atlas supplies fixed standing,
grazing and resting poses for two coats. Each row has its own ground
baseline. `hut-meadow.webp` is the earlier discarded isolated terrace.

`hut-door-day.webp` and `hut-door-sunset.webp` are ImageGen
edits of the landscape with the hut built into the right meadow. Only a
500 × 280 region at original image coordinates (990,480) is sampled into
the scene, with a soft elliptical
edge. The evening correction is composed before blending the day and
sunset exposures, avoiding ghost trees during the transition. This local
rendering mask keeps the terrain change limited to the hut's clearing.
The grassy shoulder uses the surrounding meadow's colour and detail scale;
no separate grass or building cutout is drawn. The renderer adds chimney
smoke at the new building coordinates. Windows and shutters retain their
original photographic details, without closing overlays; in the evening the
glass lights up (see below). Narrow viewport
cropping retains the complete building group. Earlier `hut.webp`,
`hut-meadow.webp`, `clearing-day.webp` and `clearing-sunset.webp` assets are
retained as historical iterations and are no longer loaded.

The hut is an artistic representation inspired by Malga Casnago, not an
architectural reproduction of the actual building.

## Evening window lights

From sunset to 23:00 local time the four hut windows glow with warm lamp
light. The schedule is `windowLamps()` in `core/assets/photo-life-model.js`:
each room switches on when the sun drops below its own altitude (1°, -0.5°,
-2° and -3.5°) and off at its own bedtime (22:30, 22:45, 22:55 and 23:00, the
last when the hut closes). Mornings stay dark. A switched lamp reaches its
brightness in a fraction of a second, so changes never pop; the glow is faint
while the sky is still bright and full once night has fallen.

Nothing is painted over the windows. `glassLayer()` in
`core/assets/photo-life.js` builds the lit glass from the plate itself with
canvas blend modes only (no pixel reads, so it also works from `file://` in
the screen saver): inverting the hut region makes the dark panes bright and
the pale frames, crossbars and plaster dark, the result is turned grey,
raised to a high contrast and tinted by a lamp gradient brightest near the
top. The real window bars therefore stay in front of the light. The summer
and winter plates each give their own layer, blended with the snow cover.
The two narrow gable windows are seen at a slant and catch daylight in the
photograph, so a narrow lit strip with a transom bar stands in for them.

Around the glass, enlarged faint copies of the pane spill onto the frame and
the sill, a soft halo sits in the night air, and a pool of light falls on the
meadow in front, stronger on snow. The left window flickers a little, like a
stove or a candle; the others only breathe. Reduced motion stops the flicker
and the fade.

## Earlier generation prompts

### Hut

Use case: photorealistic-natural. Asset type: transparent landscape compositing
cutout for an interactive realistic fairy-tale Dolomites panorama. Create a
small South Tyrolean alpine mountain hut inspired by Malga Casnago, attached
lower timber barn on its LEFT, two modest wooden picnic benches on its RIGHT.
One storey, weathered pale plaster, aged timber gables, grey brown shingle
roof, chimney slightly right of centre, blue-grey shutters OPEN, three dark
unlit rectangular front windows. Camera looks slightly down from a distant
hillside, sees front and right side, architectural roof visible, perspective
natural not isometric. Fine photographic texture with subtly enchanted
pastoral mood, neutral soft daylight from upper right, restrained natural
colours. Entire complete building group in middle of wide canvas with
transparent margin. No terrain, no mountains, no sky, no grass rectangle, no
ground patch, no people, no animals, no text, no smoke, no glow. Genuine
transparent background and crisp alpha edges. Designed to appear about 140
pixels wide in a detailed panorama.

### Cow atlas

Use case: photorealistic-natural. Asset type: transparent sprite atlas for
small alpine cows in a realistic fairy-tale Dolomites landscape. A precise 3
columns by 2 rows grid of SIX isolated complete cow cutouts, each centered
within its equal cell, large transparent gaps between cells, genuine alpha
background. Top row: same Alpine brown cow in (column 1) standing side
profile facing RIGHT, (column 2) grazing side profile facing RIGHT head
lowered to ground, (column 3) lying ruminating side profile facing RIGHT legs
tucked underneath. Bottom row: same cream white Alpine cow with small brown
patches, same three poses in same order. All views show front/right side
very slightly from above, natural anatomy and fur, small horns, soft diffuse
daylight from upper right, neutral lighting, photographic detailed textures,
pastoral mood. Hooves/bottom of resting body align to the same baseline 85
percent down each cell; subject occupies at most 80 percent cell width and
65 percent cell height. No scenery, grass, ground, baked shadow, text,
labels, frames, borders or accessories. Exactly six distinct sprites, no
overlapping cells.

### Meadow support correction

Use case: precise-object-edit. Edit target: this transparent alpine hut cutout. Preserve exactly the same canvas 1536x1024, camera perspective, architectural position and scale, stone plaster, timber, roofing, chimney, three front window locations, open blue-grey shutters, barn on LEFT, benches on RIGHT. Change ONLY the ground support directly underneath the entire building group: add a natural softly irregular alpine grass terrace and earth embankment that supports the whole hut and barn, particularly the LEFT barn which must NOT float. The terrace has a slightly downward sloping grass top following the building footprint from barn floor at y690 to main hut floor at y790, with a raised grassy downhill bank below, extending down to about y880. Fill beneath the entire barn on the left with grassy earth, seamlessly tucked behind and below its stone foundation. Add soft contact shadows where walls meet grass. This is a small natural patch of alpine meadow with fine mixed grass, subtle limestone stones, uneven feathered vegetation edges, a little meadow earth visible on the downhill left bank. It should blend into a sunlit photographic Dolomites meadow when composited at small scale. Ground extends only slightly beyond building footprint, roughly x25 to x1500, no large foreground island, no clean oval or rectangle. Neutral diffuse daylight consistent with the hut. Keep all background outside this narrow added ground patch genuinely transparent, no sky, mountains, large scenery, text, people, animals, smoke or window glow. Preserve the roof and chimney exactly.

### Integrated clearing, daylight

Use case: precise-object-edit. Edit target: the supplied 1672x941 Dolomites landscape plate. Keep its exact framing, composition, mountain silhouette, skies, lighting, perspective and every object outside a SMALL meadow clearing near the middle-right. Primary request: remodel only the grass terrain at original-image pixel x790 to1040, y595 to730, to make a small naturally continuous gently sloping meadow clearing suitable for an alpine hut at x810 to990 with its left barn floor at (825,630) and main building floor at (955,642). There is NO BUILDING in this image and none should be added. Remove the few firs INSIDE this tiny clearing footprint, replacing their entirety with softly detailed meadow matching surrounding grass. Keep foreground firs outside this local clearing and the winding path on the right unchanged. Make the soil support a natural broad gentle hillside shoulder seamlessly connected to the existing pasture, especially at the left barn footprint. No distinct cliff, raised island, rock ledge, stone retaining wall, sharp terrace rim or isolated patch. Preserve the original softly painterly photographic fairy-tale style, same mid-distance softness and warm olive/lime grass colour, no high frequency flower or rock textures. The terrain immediately around the future hut must look like the SAME EXISTING pasture continuing under it, with subtle natural slope shading. No hut, people, animals, smoke, text, new paths or sun. Everything outside x770to1060,y570to750 must stay unchanged. Output the same exact 16:9 aspect and full framing as reference.

### Integrated clearing, sunset

Use case: precise-object-edit. Image 1 is the sunset panorama EDIT TARGET; image 2 is the DAYLIGHT REFERENCE for the corrected meadow clearing. Change ONLY the local meadow clearing in image 1 at original 1672x941 coordinates x790to1040,y595to730, matching exactly the cleared trees and gentle continuous grass shoulder of image 2. Preserve the sunset target's original warm olive grass colours, soft mid-distance texture, orange evening light, distant haze, and shadows. The new clearing must look like the same existing pasture continuing under a future hut, with no isolated island, no rocky ledge, no sharply bounded different-texture patch. No buildings or animals should appear in this image. All mountain peaks, sky, clouds, foreground firs outside the clearing, path, composition and full image framing MUST stay identical to image 1. Output same 16:9 framing. Match local geometry to image 2 without changing anything elsewhere.

## Integrated building generation prompts

### Daylight

Use case: compositing. Image 1 is the original 1672x941 Dolomites panorama EDIT TARGET. Image 2 is the architectural reference for a rustic Malga Casnago hut, its timber barn on the left and picnic benches on the right. Integrate ONE complete small hut group directly into Image 1 at original-image coordinates x1050 to1220, main roof around y580, building foundations around y655. This is distinctly to the RIGHT of the panorama centre and to the right of the main winding path. Keep group total width about170 pixels. Camera is the panorama's hillside viewpoint. Rebuild the local meadow around x1020to1280,y560to725 to provide a single coherent, gently sloping, grassy clearing beneath BOTH the barn and main building. Remove ALL fir trees within the hut footprint, and route the small path branch naturally around the FRONT of the clearing, never under walls. The barn left foundation and main house right foundation must both physically touch solid grassy ground, with continuous soil immediately under every wall. Match foundation elevations to the ground, add convincing contact shadows and a continuous gentle grassy slope, with no floating left barn, no foreground tree under walls, no cutout island, no separate rocky platform. Blend architecture detail softness, colours, shadows and light with the existing landscape, realistic with a subtle fairy-tale mood. Three front windows must be dark/unlit, shutters open, chimney visible, no smoke. Preserve entire original Odle mountains and skyline, skies, clouds, main foreground path, all trees outside the clearing and framing exactly. No cows, people, animals, text or sun disk. Do not include the transparent reference's background. The outcome must be ONE coherent landscape photograph with the hut built into its terrain, not a sharp architectural cutout over grass. Output SAME EXACT 1672x941 framing.

### Sunset relighting

Use case: lighting-weather. Image 1 is the EDIT TARGET, a Dolomites daylight panorama with ONE rustic hut already physically integrated into its meadow on the right. Image 2 is the sunset LIGHTING REFERENCE ONLY. Relight image1 to image2's soft orange sunset sky, warm limestone mountains, golden olive grass, subtle valley haze. ABSOLUTELY preserve exact target hut position, size, architecture, every roof and window, barn foundations touching the grass, benches, chimney, path geometry, clearing grass geometry, exact surrounding tree silhouettes, mountain skyline, camera, composition and 1672x941 full framing. Do not move, resize, redraw or add buildings. Keep the hut's three FRONT windows unlit dark glass with open blue-grey shutters; the website will draw its lights separately. No smoke, sun disk, moon, stars, text, people or cows. Same viewpoint and 16:9 dimensions. Modify illumination and colours only. The building must stay naturally integrated with its ground and contact shadows.

## Static figures and occasional flights

`nebbia.webp`, `deer.webp`, `keepers.webp`, `paraglider.webp` and
`helicopter.webp` were generated with ImageGen on transparent backgrounds
and encoded as WebP at quality 90. Their alpha margins are measured once
on load. No ground figure is animated. Nebbia and the hut keepers appear
during opening hours in daylight. Selva and Ghianda appear within about
90 minutes of local sunrise and sunset. Names and schedules adapt the
illustrated scene, while these photographic assets are new.

The helicopter spans 29 panorama pixels, half its initial width.
Flights use ambient animation time: a 65-second helicopter passage starts
25 seconds into each five-minute cycle; a 130-second paraglider passage
starts at 150 seconds. The two do not overlap. They appear only with the
Sun above 5 degrees, never while time is sped up, and are hidden by the
photographic skyline. Reduced
motion freezes the ambient clock. `flightPreview=helicopter` or
`flightPreview=paraglider` starts mid-flight and continues moving for visual checks.
The module is `core/assets/photo-visitors.js`; all figures have keyboard-accessible
exploration cards. No additional guests are included.

### nebbia

Photorealistic transparent cutout for a realistic fairy-tale Dolomites panorama: ONE fluffy white Alpine sheepdog lying relaxed, head raised looking left, entire body and paws visible, viewed slightly from above from hillside distance, three-quarter side view. Natural proportions, soft neutral daylight, subtle warm fur, no collar text, no ground, scenery or baked shadow. Centered with generous transparent margins.

### deer

Photorealistic transparent cutout for a realistic fairy-tale Alpine landscape: ONE roe deer doe and her small spotted fawn standing together, side three-quarter view facing right, alert gentle posture, entire bodies and all hooves visible at shared ground line. Viewed slightly from above from a hillside, soft neutral daylight, natural anatomy and brown fur. Pair centered with transparent margins. No scenery, grass, ground or baked shadow, no text.

### keepers

Photorealistic transparent cutout for a realistic fairy-tale South Tyrolean mountain hut scene: ONE middle-aged male Alpine dairy farmer and his wife standing comfortably together, entire bodies and shoes visible at the same baseline, slightly from above hillside viewpoint. Man wears muted earth-tone work trousers, boots, checked shirt and rustic felt hat, wife wears muted burgundy traditional everyday dress with pale apron and boots. Both relaxed natural poses, looking toward meadow, no waving or tools. Small-scale distant people asset, restrained photographic realism, soft neutral daylight, no exaggerated features, no guests. Centered transparent margins. No ground, scenery, baked shadow or text.

### paraglider

Photorealistic isolated transparent cutout of ONE distant paraglider in flight, curved muted red and cream fabric wing fully inflated, suspension lines connected accurately to ONE tiny seated pilot below. Viewed from a distant hillside side three-quarter angle, canopy runs horizontally. Entire wing and pilot contained with generous transparent margins. Natural photographic details suitable for small sprite in realistic fairy-tale Dolomites panorama. Neutral daylight, no mountains, sky, clouds, shadows, logos or text.

### helicopter

Photorealistic transparent cutout of ONE small Alpine rescue helicopter in flight facing RIGHT, full side three-quarter view from distant hillside slightly below aircraft. Muted red and cream body, clear cabin windows, landing skids, tail rotor and main rotor visible with subtle motion blur. Entire aircraft including rotor contained with generous transparent margins. Natural photographic realism for a small sprite in realistic fairy-tale Dolomites panorama. Neutral daylight. No scenery, sky, mountains, logos, text, people outside cabin or baked shadows.

## Central entrance correction

The two `hut-door` plates replace the middle window with a full-height
wooden door behind the static keepers. Original `hut-integrated` plates
are preserved. Cow sprite width is now 64 panorama pixels instead of 42,
with fixed poses. The keepers are named Albert and Benedikta. They span 36 pixels and stand by the central door.
Bruna, the foreground standing brown cow, is excluded from the renderer.
Carolina, Bianca and Alma retain their positions. Nebbia rests
at (1249,683), beside the keepers’ feet, and is drawn after the couple
so its body appears in front of their legs. Ground
figures are drawn before the nearer cows, preserving their depth ordering.

The following prompt was applied separately to daylight and sunset plates:

Use case: precise-object-edit. Edit this exact 1672x941 Dolomites panorama. Change ONLY the MIDDLE of the three front windows on the alpine hut at the right, original-image window centre about x1243,y620. Replace that middle window and its shutters with a natural full-height dark weathered wooden ENTRANCE DOOR, door top y606 and bottom touching the house foundations at y665, width about27 pixels, stone or timber doorframe and subtle stone threshold. The two other front windows on either side remain exactly unchanged. The central door must be clearly visible behind future hut keepers standing at x1243,y675, and aligned with the facade perspective. Preserve exact building position, scale, roofs, barn, chimney, benches, grass, surrounding trees, path, mountains, clouds, sky, original lighting and all full-image geometry. Same exact framing and dimensions. No people, animals, smoke, text, extra buildings or glowing lights. Door detail should have the same photographic realistic fairy-tale style, sharpness and light as the existing building. Do not change anything outside the narrow central entrance area.

## Verification and previews

Run `node --test core/tests/*.test.cjs` from the project directory. Tests cover
solar projection, terrain occlusion, image fallback, local opening hours,
window lamps, dawn mist, portrait placement and fixed cow positions.

Preview routes:

- `/?previewTime=2026-09-15T10:07:00Z`: daylight with the static herd.
- `/?previewTime=2026-09-15T16:40:00Z`: sunset with the original photographic windows.
- `/?previewTime=2026-10-27T16:15:00Z`: dusk, the first three windows lit.
- `/?previewTime=2026-10-27T18:30:00Z`: evening, all four windows lit.
- `/?previewTime=2027-01-20T19:00:00Z`: winter evening, light on the snow.
- `/?previewTime=2026-09-15T21:10:00Z`: hut closed after 23:00 locally, lights off.
- `/?previewTime=2026-09-25T19:00:00Z`: visible Moon with an exploration card.
