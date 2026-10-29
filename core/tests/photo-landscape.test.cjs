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

test('sun and moon disks are enlarged for readability and scale with the panorama', () => {
  const { renderer } = scene();
  for (const [w, h] of [[1280, 720], [1920, 1080], [390, 844]]) {
    const width = renderer.layout(w, h).w;
    assert.ok(renderer.sunRadius(w, h) >= Math.max(4, width * .0075) - 1e-9);
    assert.ok(renderer.moonRadius(w, h) > Math.max(1.5, width * .52 / 360) * 1.7);
    assert.ok(renderer.moonRadius(w, h) < renderer.sunRadius(w, h));
  }
});
