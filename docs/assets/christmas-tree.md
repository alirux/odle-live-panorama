# Christmas tree

From December 1 a spruce stands in the clearing beside the hut. Its decorations
arrive one day at a time: garland on the 2nd, the first strings of bulbs on the
3rd, ornaments on the 4th, more bulbs on the 5th and more ornaments on the 6th.
The tip star is added on December 7, and that evening at sunset the lights come
on. They stay on every night until sunrise. The tree is taken away at sunrise
on January 8.

Code: `drawChristmasTree` in `core/assets/photo-life.js`. Calendar:
`christmasDay` in `core/assets/photo-seasons.js`. Tests:
`core/tests/christmas-tree.test.cjs`.

## Assets

Both plates are WebP at 512 × 768, made with `cwebp` from 1024 × 1536 PNG
originals. They are requested only while the tree can appear (December 1 to
January 8), so the rest of the year they cost no download.

### `core/assets/photo/christmas-tree.webp`

Created with the built-in image generation tool.

Generation prompt: Photorealistic alpine Norway spruce, full tree about four
meters tall, for compositing beside a snowy Dolomites chalet. Natural irregular
branches, dark green needles, fresh snow clumps, diffuse cool winter daylight
from upper left. Full tree on transparent background, no ornaments, lights,
star, pot, text or ground. Decorations rendered separately by the scene.

Final extraction prompt: Preserve the photographic snowy spruce. Remove all
background and halo, with zero opacity outside the needles, branches, snow and
trunk and through branch gaps. Keep the full tree.

```sh
cwebp -resize 512 768 -q 86 -alpha_q 100 -m 6 christmas-tree.png -o christmas-tree.webp
```

### `core/assets/photo/christmas-lights.webp`

A photographic light emission pass, generated with the built-in image tool
using the tree as reference.

Prompt: Create a photographic light emission pass in the exact tree framing, on
black. Render only tiny realistic white Christmas LEDs along five loosely draped
swags, with subtle localized snow reflections. Ice white and soft ivory,
pinpoint cores and small optical halos. No colored bulbs, star, ambient tree
illumination, backdrop or text. Preserve tree placement for screen compositing.

```sh
cwebp -resize 512 768 -q 95 -m 6 christmas-lights.png -o christmas-lights.webp
```

The scene finds the bulbs in this plate at run time (92 bright cores), so a new
export must keep the cores above the detection threshold: check that the count
does not change.

## How it is drawn

- **Grade.** The photograph is sharper and greener than the painted spruces
  around it. `tinted` takes away some saturation (more at night) and adds a pale
  daylight haze, so the tree sits among them.
- **Snow drift.** A soft mound, in the blue of the shaded snow nearby, covers
  the cut of the trunk. It goes through the same tint as the photographs.
- **Daytime decorations.** Gold garlands, warm white unlit bulbs, red and gold
  ornaments with a highlight, and a gold star. Their colours follow the same
  dusk and night tint as the plates.
- **Lights.** Each bright core in the emission plate owns a patch of its halo
  and snow reflection, excluding neighbouring cores. Four extra swags sit
  between the five original ones, widening with the tree; their bulbs use only
  the core and halo, since the reflection belongs to the original spot. Every
  bulb twinkles with its own phase and a period between 1.6 and 4.6 seconds,
  between 12% and 90% opacity, so the strings never go dark; every 11 seconds
  a wave of light runs down the tree and lifts the bulbs it crosses. Reduced
  motion holds a steady 70%.
- **Star.** Once lit, the star breathes on two rhythms (2.7 and 7.3 seconds):
  its halo grows and brightens, and when both rhythms peak it flashes four
  thin rays. Reduced motion holds it halfway.
- **Glow.** While lit, the tree silhouette is added in warm light at low
  opacity, brighter towards the trunk, and a faint pool of light lies on the
  snow.

The PNG originals are kept outside the repository.
