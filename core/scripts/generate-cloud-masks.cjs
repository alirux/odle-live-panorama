/* Builds the cloud masks of the three photographic plates:
 *   assets/photo/clouds-day.png, clouds-sunset.png, clouds-winter.png
 * Each is a greyscale image at a quarter of the plate size: white is thick
 * cloud, black is clear sky (and everything below the mountains). The scene
 * dims the sun, the moon, the stars and the planets where a cloud lies in front.
 *
 * Usage: node core/scripts/generate-cloud-masks.cjs
 * Needs only `dwebp` (from the libwebp tools) to decode the plates.
 * Rebuild after replacing a plate or after changing photo-skyline.js.
 * Hand corrections live in cloud-mask-corrections.cjs and are applied last,
 * so they survive a rebuild; the PNGs themselves can also be retouched, but
 * a rebuild overwrites them. */
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const skyline = require('../assets/photo-skyline.js');
const corrections = require('./cloud-mask-corrections.cjs');
const WIDTH = 1672, HEIGHT = 941, SCALE = 4;
const OUT_W = Math.ceil(WIDTH / SCALE), OUT_H = Math.ceil(HEIGHT / SCALE);
// Rows this close above the mountain edge are left out: the edge itself
// blends rock into sky and would read as cloud.
const EDGE_MARGIN = 3;

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function decode(file) {
  const pam = execFileSync('dwebp',[file,'-pam','-o','-'],{stdio:['ignore','pipe','ignore'],maxBuffer:1 << 26});
  const header = pam.subarray(0,200).toString('latin1');
  const end = header.indexOf('ENDHDR\n') + 7;
  const width = +header.match(/WIDTH (\d+)/)[1], height = +header.match(/HEIGHT (\d+)/)[1];
  if (width !== WIDTH || height !== HEIGHT) throw new Error(`${file}: expected ${WIDTH}x${HEIGHT}, got ${width}x${height}`);
  return pam.subarray(end,end + WIDTH * HEIGHT * 4);
}

const isSky = (edge, x, y) => y < edge[x] - EDGE_MARGIN;

/* Blue sky against white or grey cloud (day and winter plates). For each
 * 8 px cell the clear sky colour is the bluest tenth of the cells around it,
 * about 320 px wide: the sky changes colour across the panorama as well as
 * with height. Cloud density is how much a pixel falls short of that blue. */
function colourMask(px, edge) {
  const cell = 8, rx = 20, ry = 3, pct = .9;
  const metric = i => px[i + 2] - px[i];
  const cw = Math.ceil(WIDTH / cell), ch = Math.ceil(HEIGHT / cell);
  const cells = new Float32Array(cw * ch).fill(NaN);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    let sum = 0, n = 0;
    for (let y = cy * cell; y < Math.min(HEIGHT,cy * cell + cell); y++)
      for (let x = cx * cell; x < Math.min(WIDTH,cx * cell + cell); x++)
        if (isSky(edge,x,y)) { sum += metric((y * WIDTH + x) * 4); n++; }
    if (n > cell * cell / 2) cells[cy * cw + cx] = sum / n;
  }
  const reference = new Float32Array(cw * ch).fill(NaN);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    const values = [];
    for (let y = Math.max(0,cy - ry); y <= Math.min(ch - 1,cy + ry); y++)
      for (let x = Math.max(0,cx - rx); x <= Math.min(cw - 1,cx + rx); x++) {
        const v = cells[y * cw + x];
        if (!Number.isNaN(v)) values.push(v);
      }
    if (values.length < 8) continue;
    values.sort((a,b) => a - b);
    reference[cy * cw + cx] = Math.max(15,values[Math.floor((values.length - 1) * pct)]);
  }
  const mask = new Float32Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (!isSky(edge,x,y)) continue;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let ref = reference[cy * cw + cx];
    if (Number.isNaN(ref)) ref = reference[Math.max(0,cy - 1) * cw + cx];
    if (Number.isNaN(ref)) continue;
    mask[y * WIDTH + x] = clamp((1 - metric((y * WIDTH + x) * 4) / ref - .12) / .5);
  }
  return mask;
}

// Gaussian blur of one float channel, approximated by three box passes.
function blur(src, sigma) {
  const sizes = (() => {
    const ideal = Math.sqrt(12 * sigma * sigma / 3 + 1);
    let lower = Math.floor(ideal); if (lower % 2 === 0) lower--;
    const upper = lower + 2;
    const m = Math.round((12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4));
    return [0,1,2].map(i => i < m ? lower : upper);
  })();
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const pass = (from, to, r, horizontal) => {
    const lines = horizontal ? HEIGHT : WIDTH, length = horizontal ? WIDTH : HEIGHT;
    const at = (line, i) => horizontal ? line * WIDTH + i : i * WIDTH + line;
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      for (let i = -r - 1; i < r; i++) sum += from[at(line,clamp(i,0,length - 1))];
      for (let i = 0; i < length; i++) {
        sum += from[at(line,Math.min(length - 1,i + r))] - from[at(line,Math.max(0,i - r - 1))];
        to[at(line,i)] = sum / (2 * r + 1);
      }
    }
  };
  for (const size of sizes) {
    const r = (size - 1) / 2;
    pass(a,b,r,true); pass(b,a,r,false);
  }
  return a;
}

/* Sunset plate: the sky runs from pink to orange and the lit clouds share its
 * colours, so colour alone cannot separate them. Clouds carry structure
 * (rims, highlights, shadows) while clear sky is a smooth gradient: density
 * follows the local contrast against a broad blur of the sky. */
function contrastMask(px, edge) {
  const lum = new Float32Array(WIDTH * HEIGHT), warm = new Float32Array(WIDTH * HEIGHT);
  for (let x = 0; x < WIDTH; x++) {
    // Below the edge, repeat the sky just above it so rock does not bleed in.
    const top = Math.max(0,Math.floor(edge[x]) - 4);
    for (let y = 0; y < HEIGHT; y++) {
      const i = ((y > top ? top : y) * WIDTH + x) * 4;
      lum[y * WIDTH + x] = (px[i] + px[i + 1] + px[i + 2]) / 3;
      warm[y * WIDTH + x] = px[i] - px[i + 2];
    }
  }
  const lumBlur = blur(lum,22), warmBlur = blur(warm,22);
  const raw = new Float32Array(WIDTH * HEIGHT);
  for (let i = 0; i < raw.length; i++) {
    const base = Math.max(30,lumBlur[i]);
    const v = (Math.abs(lum[i] - lumBlur[i]) + Math.abs(warm[i] - warmBlur[i])) / base;
    raw[i] = clamp(v * 1.5 - .05);
  }
  const smooth = blur(raw,7);
  const mask = new Float32Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (!isSky(edge,x,y)) continue;
    mask[y * WIDTH + x] = clamp((Math.min(1,smooth[y * WIDTH + x] * 1.8) - .12) / .3);
  }
  return mask;
}

function applyCorrections(mask, plate) {
  for (const c of corrections.filter(entry => entry.plate === plate)) {
    for (let y = Math.max(0,Math.floor(c.y - c.ry)); y <= Math.min(HEIGHT - 1,Math.ceil(c.y + c.ry)); y++)
      for (let x = Math.max(0,Math.floor(c.x - c.rx)); x <= Math.min(WIDTH - 1,Math.ceil(c.x + c.rx)); x++) {
        const r = Math.hypot((x - c.x) / c.rx,(y - c.y) / c.ry);
        if (r >= 1) continue;
        const weight = r < .7 ? 1 : 1 - (r - .7) / .3;
        const i = y * WIDTH + x;
        mask[i] += (c.density - mask[i]) * weight;
      }
  }
}

function downsample(mask) {
  const out = new Uint8Array(OUT_W * OUT_H);
  for (let oy = 0; oy < OUT_H; oy++) for (let ox = 0; ox < OUT_W; ox++) {
    let sum = 0, n = 0;
    for (let y = oy * SCALE; y < Math.min(HEIGHT,oy * SCALE + SCALE); y++)
      for (let x = ox * SCALE; x < Math.min(WIDTH,ox * SCALE + SCALE); x++) { sum += mask[y * WIDTH + x]; n++; }
    out[oy * OUT_W + ox] = Math.round(sum / n * 255);
  }
  return out;
}

function png(grey, width, height) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type,'latin1'),data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length,body,crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width,0); header.writeUInt32BE(height,4);
  header[8] = 8; header[9] = 0; // 8 bit greyscale
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) rows.set(grey.subarray(y * width,(y + 1) * width),y * (width + 1) + 1);
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),
    chunk('IDAT',zlib.deflateSync(rows,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
}

for (const [plate,file,edge,detect] of [
  ['day','odle-day.webp',skyline.summer,colourMask],
  ['sunset','odle-sunset.webp',skyline.summer,contrastMask],
  ['winter','odle-winter.webp',skyline.winter,colourMask]
]) {
  const mask = detect(decode(path.join(root,'assets/photo',file)),edge);
  applyCorrections(mask,plate);
  const out = path.join(root,'assets/photo',`clouds-${plate}.png`);
  fs.writeFileSync(out,png(downsample(mask),OUT_W,OUT_H));
  console.log(`${path.relative(root,out)}  ${OUT_W}x${OUT_H}`);
}
