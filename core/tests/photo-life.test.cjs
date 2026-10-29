const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/photo-life-model.js');

test('hut follows local sunrise, sunset and the 23:00 closing time', () => {
  assert.deepEqual(M.hutSchedule(4, 7, 19), { shuttersOpen: false, lightsOn: false });
  assert.deepEqual(M.hutSchedule(5, 7, 19), { shuttersOpen: true, lightsOn: true });
  assert.deepEqual(M.hutSchedule(12, 7, 19), { shuttersOpen: true, lightsOn: false });
  assert.deepEqual(M.hutSchedule(18, 7, 19), { shuttersOpen: true, lightsOn: true });
  assert.deepEqual(M.hutSchedule(23, 7, 19), { shuttersOpen: false, lightsOn: false });
});

test('window lamps light up one by one at dusk and are all off at 23:00', () => {
  // Afternoon sun: all dark.
  assert.deepEqual(M.windowLamps(16, 5), [0, 0, 0, 0]);
  // Sun on the horizon: only the first room.
  assert.deepEqual(M.windowLamps(17, .5), [1, 0, 0, 0]);
  assert.deepEqual(M.windowLamps(17.3, -3), [1, 1, 1, 0]);
  assert.deepEqual(M.windowLamps(20, -25), [1, 1, 1, 1]);
  // Bedtime: the rooms go dark in turn, the last at 23:00.
  assert.deepEqual(M.windowLamps(22.6, -40), [1, 1, 1, 0]);
  assert.deepEqual(M.windowLamps(22.95, -40), [1, 0, 0, 0]);
  assert.deepEqual(M.windowLamps(23, -40), [0, 0, 0, 0]);
  // Before dawn the hut stays dark.
  assert.deepEqual(M.windowLamps(5, -10), [0, 0, 0, 0]);
});

test('dawn fog clears as the sun rises and does not repeat at sunset', () => {
  assert.ok(M.dawnMist(-3, Math.PI / 2) > .8);
  assert.equal(M.dawnMist(15, Math.PI / 2), 0);
  assert.equal(M.dawnMist(-3, Math.PI * 1.5), 0);
});

test('inhabitants retain their position in the photograph when cropped to portrait', () => {
  const scale = 844 / 941;
  const rect = { x: 390 / 2 - 1240 * scale, y: 0, scale };
  const point = M.worldToScreen(rect, 1246, 599);
  assert.ok(point.x > 0 && point.x < 390);
  assert.ok(Math.abs((point.x - rect.x) / scale - 1246) < 1e-10);
  assert.equal(point.y / scale, 599);
});

test('cows keep fixed poses and locations within the pasture across reloads', () => {
  const first = Array.from({ length: 4 }, (_, i) => M.makeCow(i));
  const second = Array.from({ length: 4 }, (_, i) => M.makeCow(i));
  assert.deepEqual(first, second);
  for (const cow of first) {
    assert.ok(cow.x >= M.BOUNDS.left && cow.x <= M.BOUNDS.right);
    assert.ok(cow.y >= M.BOUNDS.top && cow.y <= M.BOUNDS.bottom);
    assert.ok(['stand','graze','lying'].includes(cow.state));
  }
  first[0].x = 0;
  assert.notEqual(M.makeCow(0).x, 0);
});

test('winter smoke remains attached to the chimney, visible after closing and still with reduced motion', () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const scope = {window:{PhotoLifeModel:M}};
  const source = fs.readFileSync(path.join(__dirname,'../assets/photo-life.js'),'utf8');
  vm.runInNewContext(source.replace('new PhotoLife()', 'Object.create(PhotoLife.prototype)'),scope);
  const render = (time,reduced,amount) => {
    const puffs = [];
    const ctx = {save(){},restore(){},scale(){},fillRect(){},
      translate(x,y){puffs.push({x,y,stops:[]});},
      createRadialGradient(){return {addColorStop(at,color){puffs[puffs.length-1].stops.push({at,color});}};}};
    scope.window.photoLife.drawHutDetails(ctx,{sunAltitude:20},time,{shuttersOpen:false},reduced,{amount,snow:amount});
    return puffs;
  };
  for (const time of [0,6000,17000,30000]) {
    const puffs = render(time,false,1);
    assert.ok(puffs.length > 20);
    assert.ok(puffs.some(p => Math.abs(p.x-1318)<5 && Math.abs(p.y-510)<5));
    assert.ok(puffs.some(p => p.y<430));
    assert.ok(puffs.some(p => Number(p.stops[0].color.split(',').at(-1).replace(')','')) > .5));
  }
  assert.deepEqual(render(0,true,1),render(30000,true,1));
  assert.notDeepEqual(render(0,false,1),render(6000,false,1));
  assert.deepEqual(render(6000,false,0),[]);
});

test('night smoke takes the moonlit tint of the scene instead of glowing white', () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const scope = {window:{PhotoLifeModel:M}};
  const source = fs.readFileSync(path.join(__dirname,'../assets/photo-life.js'),'utf8');
  vm.runInNewContext(source.replace('new PhotoLife()', 'Object.create(PhotoLife.prototype)'),scope);
  const core = sunAltitude => {
    const colors = [];
    const ctx = {save(){},restore(){},scale(){},fillRect(){},translate(){},
      createRadialGradient(){return {addColorStop(at,color){if (at === 0) colors.push(color);}};}};
    scope.window.photoLife.drawHutDetails(ctx,{sunAltitude},0,{shuttersOpen:false},true,{amount:1,snow:1});
    const [r,g,b,a] = colors[0].slice(5,-1).split(',').map(Number);
    return {r,g,b,a};
  };
  const day = core(20), night = core(-30);
  assert.ok(night.r < day.r * .45 && night.g < day.g * .55);
  assert.ok(night.b > night.r);
  assert.ok(night.a < day.a);
});
