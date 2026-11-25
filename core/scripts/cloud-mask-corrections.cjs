/* Hand corrections applied by generate-cloud-masks.cjs after the automatic
 * detection, so they survive every regeneration of the masks.
 *
 * Each entry paints a soft ellipse on one plate's mask, in plate pixels
 * (1672 x 941, the same coordinates as photo-skyline.js):
 *   { plate: 'day' | 'sunset' | 'winter',
 *     x, y,          centre
 *     rx, ry,        radii
 *     density,       0 = clear sky, 1 = thick cloud
 *     note }         why the correction is there
 * Inside the ellipse the mask moves towards `density`; the last 30% of the
 * radius fades back to the detected value, so no hard edge appears. */
module.exports = [
];
