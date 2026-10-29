# Winter version

The scene follows the date and time zone of the simulation, including accelerated or reversed playback.

- 24 to 30 November: snow builds up gradually.
- 1 December to 31 January inclusive: full winter.
- 1 to 7 February: gradual thaw.
- 8 February to 23 November: summer scene. There is no intermediate season.

The transition uses a smooth seven day curve. The cows disappear in the first part of the build-up and come back towards the end of the thaw. The hut keepers switch to Tyrolean winter clothes, keeping their position and interactions.

Snowfalls follow twelve minute cycles of the simulation, fading in and out: they last about five minutes during the build-up, two minutes in full winter and one minute during the thaw. The flakes move with the animation clock. Sparkles appear only with the sun above the horizon and fade during snowfalls. The system preference for reduced motion turns off the animated flakes and sparkles.

The snowy landscape keeps the responsive crop and takes the sunset and night lighting. The new images load separately, without blocking the summer panorama if a winter resource is unavailable.

## Assets and generation

Generated with the built-in ImageGen tool on 23 October 2026, then converted to WebP (quality 90). The landscape derives from `hut-door-day.webp` and keeps the attribution and CC BY-SA 3.0 licence given in README.md. The keepers derive from `keepers.webp`; the new cutout keeps its transparency.

- `odle-winter.webp`: snow on the mountains, firs, meadow, hut and table; icicles under the eaves; ice on the path.
- `keepers-winter.webp`: Albert and Benedikta in heavy Tyrolean clothes, scarves, gloves and boots.

### Landscape prompt

Use case: lighting-weather. Edit target: the supplied alpine landscape panorama. Create its snowy midwinter version for a seasonal crossfade animation. Keep EXACT identical framing, aspect ratio, camera, mountain skyline silhouettes, all tree positions, hut shape and position, door and window positions, chimney, path alignment and sky. Do not move any objects. Cover the mountains' slopes and ledges, fir boughs, meadow, hut roof and picnic table with natural thick white snow, crisp cool blue shadows and sunlit sparkling crystals. Add clearly visible translucent icicles hanging down from the hut roof eaves. The existing winding path remains distinguishable with some smooth glazed ice patches reflecting pale blue. Preserve exposed rock on the steepest faces. Beautiful realistic alpine winter sunshine matching original light direction. No cows, no people, no falling snow (animated separately), no extra buildings, no text. Save output as a local image file and return the file path.

### Keepers prompt

Use case: identity-preserve. Edit target: supplied transparent cutout of two alpine hut keepers. Keep both exact identities, faces, gazes, side-by-side positions, overall pose, relative height and full body framing with visible boots. Dress them in traditional Tyrolean WINTER clothing: man in thick dark forest-green loden jacket over knit wool waistcoat, long warm brown trousers, wool scarf, gloves and sturdy winter boots, retaining his traditional Tyrolean hat; woman in warm burgundy traditional dress with full long sleeves, fitted wool jacket, thick knitted shawl/scarf, warm stockings, gloves and winter boots. Realistic natural fabric, warm and authentic alpine appearance. Isolated cutout on genuinely transparent background, no scenery, snow, platform, shadows, text, border or other people. Preserve empty transparent margins.

## Verification

Run `node --test core/tests/*.test.cjs`. To preview, open the site through a local HTTP server and set the date and time in the "When and where" panel: 27 November at noon for the transition, 15 December at noon for winter, 4 February for the thaw, 15 June for summer.

## Weather and chimney

No helicopters or paragliders fly during snowfalls. Cloud cover arrives before the flakes and thins out after the snowfall: it hides the blue sky and the celestial bodies, dims the light on the landscape and turns off the sparkles. The clouds stay visible with reduced motion too.

In winter the chimney smokes even when the hut is closed. The plume grows gradually denser and taller as the cold season arrives. In summer it smokes only while the hut is open, with a slightly smaller plume that is darker by day, so it stays visible against the pale scree behind the chimney. With reduced motion it stays still.

Sky coverage uses separate photographic profiles for summer and winter, with one sample per column of the original image. The simplified astronomical profile stays separate. This avoids bands of blue sky and polygonal cuts along the peaks. The profiles are stored in `core/assets/photo-skyline.js`; after replacing the panoramas they are regenerated with `node core/scripts/generate-photo-skyline.cjs` (development dependency: `@napi-rs/canvas`). They are not computed during the animation.
