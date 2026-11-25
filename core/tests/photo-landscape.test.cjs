const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function scene(fail = false) {
  const events = [];
  const context = vm.createContext({
    window: { dispatchEvent: e => events.push(e.type) },
    document: { createElement: () => ({}) },
    location: { search: '' }, URLSearchParams, Event,
    Image: class { set src(value) { queueMicrotask(() => fail ? this.onerror() : this.onload()); } }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/photo-landscape.js'), 'utf8'), context);
  return { renderer: context.window.photoScene, events };
}

function astronomy() {
  return require('../assets/odle-astronomy.js').sunPosition;
}

test('real solar calculation responds to time, longitude and polar seasons', () => {
  const sun = astronomy();
  const noon = sun(new Date('2026-03-20T12:00:00Z'), 0, 0);
  const midnight = sun(new Date('2026-03-20T00:00:00Z'), 0, 0);
  assert.ok(noon.altitude > 87 && noon.altitude <= 90);
  assert.ok(midnight.altitude < -87);
  assert.ok(sun(new Date('2026-03-20T12:00:00Z'),0,90).altitude < 3);
  assert.ok(sun(new Date('2026-12-21T11:00:00Z'),69.65,18.96).altitude < 0);
  assert.ok(sun(new Date('2026-06-21T23:00:00Z'),69.65,18.96).altitude > 0);
  const morning = sun(new Date('2026-09-15T07:00:00Z'),46.6419,11.7187);
  const evening = sun(new Date('2026-09-15T16:00:00Z'),46.6419,11.7187);
  assert.ok(morning.azimuth < Math.PI && evening.azimuth > Math.PI);
  assert.ok(evening.altitude > 13 && evening.altitude < 15);
});

test('panorama orders east/south/west and never folds the north into view', () => {
  const {renderer:r} = scene();
  const project = degrees => r.project({azimuth:degrees*Math.PI/180,altitude:30},1672,941);
  assert.equal(project(90).x,0);
  assert.equal(project(180).x,.5);
  assert.equal(project(270).x,1);
  assert.ok(project(0).x < 0 && project(359).x > 1);
  assert.ok(r.project({azimuth:Math.PI,altitude:60},1672,941).y < project(180).y);
});

test('portrait cropping preserves the photograph aspect ratio and projects the same scene', () => {
  const {renderer:r} = scene();
  const rect = r.layout(390,844);
  assert.ok(rect.w >= 390 && rect.h >= 844);
  assert.ok(Math.abs(rect.w/rect.h - 1672/941) < 1e-10);
  const point = r.project({azimuth:Math.PI,altitude:20},390,844);
  assert.ok(Math.abs(point.x - (rect.x + 836 * rect.scale) / 390) < 1e-10);
  const hutLeft = rect.x + 1030 * rect.scale, hutRight = rect.x + 1454 * rect.scale;
  assert.ok(hutLeft >= 0 && hutRight <= 390);
  const panel = r.layout(1216,1319);
  assert.ok(panel.x + 1030 * panel.scale >= 0);
  assert.ok(panel.x + 1454 * panel.scale <= 1216);
  assert.ok(r.project({azimuth:270*Math.PI/180,altitude:10},390,844).x > 1);
});

test('terrain hides the sun while open sky shows it; no sun at night', () => {
  const {renderer:r} = scene();
  let discs = 0;
  const ctx = new Proxy({}, {get:(_,key) => key === 'createRadialGradient'
    ? () => ({addColorStop(){}})
    : key === 'arc' ? () => { discs++; } : () => {}});
  assert.ok(r.isSky(640,120,1672,941));
  assert.ok(!r.isSky(640,230,1672,941));
  r.drawSun(ctx,1672,941,{sunAltitude:20,sunX:640/1672,sunY:230/941});
  assert.equal(discs,0);
  r.drawSun(ctx,1672,941,{sunAltitude:40,sunX:640/1672,sunY:120/941});
  assert.equal(discs,1);
  r.drawSun(ctx,1672,941,{sunAltitude:-10,sunX:.5,sunY:.1});
  assert.equal(discs,1);
});

test('images activate photo mode and report failed loading', async () => {
  const good = scene(); const bad = scene(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(good.renderer.active,true);
  assert.equal(bad.renderer.active,false);
  assert.equal(bad.renderer.failed,true);
  assert.deepEqual(good.events,['photo-scene-ready']);
  assert.equal(good.renderer.winterReady,true);
  assert.equal(bad.renderer.winterReady,false);
});

test('cloud mask uses dense photographic boundaries instead of the coarse astronomy polygon', () => {
  const profile = require('../assets/photo-skyline.js');
  const {renderer:r} = scene();
  for (const edge of [profile.summer,profile.winter]) {
    assert.equal(edge.length,1672);
    assert.ok(edge.every(y=>Number.isFinite(y) && y>100 && y<500));
  }
  const scope = vm.createContext({window:{PhotoSkyline:profile},document:{createElement:()=>({})}});
  vm.runInContext(fs.readFileSync(path.join(root,'assets/photo-landscape.js'),'utf8')
    .replace('new PhotoLandscape()', 'Object.create(PhotoLandscape.prototype)'),scope);
  const renderer = scope.window.photoScene;
  renderer.winterReady = true;
  for (const [w,h] of [[1672,941],[390,844]]) for (const amount of [0,.5,1]) {
    const points = [];
    renderer.clipCloudSky({beginPath(){},moveTo(){},lineTo(x,y){points.push([x,y]);},closePath(){},clip(){}},w,h,{amount});
    const rect = renderer.layout(w,h);
    assert.equal(points.length,1673);
    const x = 580, point = points[1672-x];
    const expected = profile.summer[x]*(1-amount)+profile.winter[x]*amount;
    assert.ok(Math.abs(point[1]-(rect.y+expected*rect.scale))<1e-8);
  }
  assert.ok(Math.abs(profile.winter[580]-r.skylineY(580))>3);
});

test('sun and moon hide behind the photographic edge, not the coarse trace', () => {
  const profile = require('../assets/photo-skyline.js');
  const scope = vm.createContext({window:{PhotoSkyline:profile},document:{createElement:()=>({})}});
  vm.runInContext(fs.readFileSync(path.join(root,'assets/photo-landscape.js'),'utf8')
    .replace('new PhotoLandscape()', 'Object.create(PhotoLandscape.prototype)'),scope);
  const r = scope.window.photoScene;
  const rect = r.layout(1672,941);
  const at = (x,y) => r.isSky(rect.x + x * rect.scale, rect.y + y * rect.scale, 1672, 941);
  // In the notch at plate column 460 the hand trace runs at y 332 while the
  // rock rises to y 308: a body at y 320 sits on the rock and must stay hidden.
  assert.ok(r.skylineY(460) > 330 && profile.summer[460] < 310);
  assert.equal(at(460,320),false);
  assert.equal(at(460,300),true);
  // Each mountain column is widened by two on both sides, closing hairline cracks.
  const edge = r.skyEdge();
  for (let x = 2; x < 1670; x++) {
    assert.ok(edge[x] <= Math.min(...profile.summer.slice(x-2,x+3)) + 1e-9);
  }
  // Winter blends towards its own edge, as the plates do.
  r.winterReady = true; r.snow = 1;
  assert.equal(r.skyEdge()[690], Math.min(...profile.winter.slice(688,693)));
});

// Reads the 8 bit greyscale PNGs written by generate-cloud-masks.cjs (filter 0 rows).
function readGreyPng(file) {
  const zlib = require('node:zlib');
  const bytes = fs.readFileSync(file);
  let offset = 8, width = 0, height = 0; const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('latin1',offset + 4,offset + 8);
    const data = bytes.subarray(offset + 8,offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); assert.equal(data[8],8); assert.equal(data[9],0); }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const rows = zlib.inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    assert.equal(rows[y * (width + 1)],0);
    pixels.set(rows.subarray(y * (width + 1) + 1,(y + 1) * (width + 1)),y * width);
  }
  return {w:width,h:height,data:pixels};
}

test('cloud masks cover the sky of each plate and stay black below the mountains', () => {
  const profile = require('../assets/photo-skyline.js');
  for (const [plate,edge] of [['day',profile.summer],['sunset',profile.summer],['winter',profile.winter]]) {
    const mask = readGreyPng(path.join(root,`assets/photo/clouds-${plate}.png`));
    assert.deepEqual([mask.w,mask.h],[418,236]);
    let below = 0, cloudy = 0, sky = 0;
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
      // One mask pixel covers four plate columns: compare against their extremes.
      const columns = edge.slice(x * 4,x * 4 + 4);
      const v = mask.data[y * mask.w + x];
      if (y * 4 > Math.max(...columns)) below = Math.max(below,v);
      else if (y * 4 + 4 < Math.min(...columns) - 4) { sky++; if (v > 160) cloudy++; }
    }
    assert.equal(below,0,`${plate}: cloud below the mountains`);
    // Every plate has both thick clouds and open sky.
    assert.ok(cloudy / sky > .1 && cloudy / sky < .7,`${plate}: ${cloudy}/${sky}`);
  }
});

test('clouds blend like the plates and dim the bodies behind them', () => {
  const {renderer:r} = scene();
  const flat = value => ({w:2,h:2,data:new Uint8Array(4).fill(value)});
  r.cloudMasks = {day:flat(0),sunset:flat(255),winter:flat(102)};
  r.cloudMix = {warmth:0,winter:0};
  assert.equal(r.cloudDensity(500,100,1672,941),0);
  r.cloudMix = {warmth:.5,winter:0};
  assert.ok(Math.abs(r.cloudDensity(500,100,1672,941) - .5) < 1e-9);
  r.cloudMix = {warmth:.5,winter:1};
  assert.ok(Math.abs(r.cloudDensity(500,100,1672,941) - .4) < 1e-9);

  const diskAlpha = cloud => {
    r.cloudMasks = {day:flat(Math.round(cloud * 255))}; r.cloudMix = {warmth:0,winter:0};
    let alpha = null;
    const ctx = new Proxy({globalAlpha:1}, {
      get:(target,key) => key === 'createRadialGradient' ? () => ({addColorStop(){}})
        : key === 'arc' ? () => { alpha = target.globalAlpha; }
        : key in target ? target[key] : () => {},
      set:(target,key,value) => { target[key] = value; return true; }
    });
    r.drawSun(ctx,1672,941,{sunAltitude:40,sunX:640/1672,sunY:120/941});
    return alpha;
  };
  assert.equal(diskAlpha(0),1);
  // A thick cloud leaves only a faint disk; the glow keeps the position readable.
  assert.ok(Math.abs(diskAlpha(1) - .1) < 1e-9);
});

test('sun and moon disks are enlarged for readability and scale with the panorama', () => {
  const { renderer } = scene();
  for (const [w, h] of [[1280, 720], [1920, 1080], [390, 844]]) {
    const width = renderer.layout(w, h).w;
    assert.ok(renderer.sunRadius(w, h) >= Math.max(4, width * .0075) - 1e-9);
    assert.ok(renderer.moonRadius(w, h) > Math.max(1.5, width * .52 / 360) * 1.7);
    assert.ok(renderer.moonRadius(w, h) < renderer.sunRadius(w, h));
  }
});
