const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../assets/photo-seasons.js');
const M = require('../assets/photo-life-model.js');

// The whole renderer runs in a bare context; the helpers that need a real
// canvas are replaced, and the drawing calls are counted.
function renderer() {
  const scope = vm.createContext({
    window:{PhotoLifeModel:M}, console,
    document:{querySelector:() => null},
    Image:class { set src(value) { scope.requests.push(value); } },
    requests:[]
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/photo-life.js'),'utf8'),scope);
  return {life:scope.window.photoLife, requests:scope.requests};
}

function render(month, day, hour, overrides = {}, loaded = true) {
  const {life, requests} = renderer();
  const calls = {trees:0, mounds:0, bulbs:0, balls:0, garlands:0, tips:0, branchGlow:0, grades:[]};
  const ctx = new Proxy({}, {get(target,name) {
    if (name === 'globalAlpha') return target.globalAlpha;
    if (name === 'drawImage') return (image, ...args) => {
      if (args.length === 8) (calls.photoLevels ||= []).push(ctx.globalAlpha);
      else if (image.kind === 'christmasTree') calls.trees++;
      else if (image.kind === 'christmasMound') calls.mounds++;
      else if (image.kind === 'glow') calls.branchGlow++;
    };
    if (name === 'arc') return (x,y,r) => { if (r === 1.4) calls.balls++; else if (r === .45) calls.bulbs++; };
    if (name === 'quadraticCurveTo') return () => calls.garlands++;
    if (name === 'closePath') return () => calls.tips++;
    if (name === 'createRadialGradient') return () => ({addColorStop(){calls.glow = (calls.glow || 0)+1;}});
    return () => {};
  }});
  Object.assign(life, {
    tinted(name, _state, grade) { if (grade) calls.grades.push(grade); return {kind:name}; },
    shadow() {}, christmasMound() { return {}; }, christmasGlow() { return {kind:'glow'}; },
    christmasBulbs() { return Array.from({length:65},() => ({image:{width:36,height:36},x:0,y:0,width:.07,height:.05})); }
  });
  if (loaded) Object.assign(life.assets, {christmasTree:{}, christmasLights:{}});
  life.drawChristmasTree(ctx,{sunAltitude:hour >= 17 || hour < 8 ? -20 : 15}, {
    season:S.at({year:month === 1 ? 2027 : 2026,month,day,hour}),
    hour,sunriseHour:8,sunsetHour:17,animationTime:1234,reducedMotion:false,...overrides
  });
  return {...calls, requests};
}

test('each December day adds the scheduled decorations, with the tip last', () => {
  const expected = [[0,0,0,0],[5,0,0,0],[5,27,0,0],[5,27,6,0],[5,60,6,0],[5,60,10,0],[5,60,10,1]];
  for (let day=1;day<=7;day++) {
    const c=render(12,day,12);
    assert.equal(c.trees,1);
    assert.equal(c.mounds,1);
    assert.deepEqual([c.garlands,c.bulbs,c.balls,c.tips],expected[day-1]);
    assert.ok(!c.glow);
    assert.equal(c.photoLevels,undefined);
  }
});

test('lights start on December 7 at sunset and stay on past midnight until sunrise', () => {
  for (const args of [[12,6,20],[12,7,4],[12,7,16.99],[12,8,8],[1,7,12]]) {
    const c = render(...args);
    assert.ok(!c.glow && !c.photoLevels && !c.branchGlow,args.join('/'));
  }
  for (const args of [[12,7,17],[12,7,23.99],[12,8,0],[12,8,7.99],[12,31,23],[1,1,0],[1,8,7.99]]) {
    const c = render(...args);
    assert.ok(c.glow,args.join('/'));
    assert.equal(c.photoLevels.length,65,args.join('/'));
    assert.equal(c.branchGlow,1,args.join('/'));
  }
});

test('lit strings replace the unlit garlands, the ornaments stay', () => {
  const c = render(12,10,22);
  assert.deepEqual([c.garlands,c.bulbs,c.balls,c.tips],[0,0,10,1]);
});

test('tree exists only from December 1 until the January 8 sunrise', () => {
  for (const args of [[11,30,23],[1,8,8],[1,8,20],[1,9,0],[2,1,12]]) assert.equal(render(...args).trees,0);
  assert.equal(render(12,1,0).trees,1);
  assert.equal(render(1,8,7.99).trees,1);
});

test('the tree plates are downloaded only during the season', () => {
  assert.deepEqual(render(11,30,12,{},false).requests,['assets/photo/cows.webp']);
  assert.deepEqual(render(7,15,12,{},false).requests,['assets/photo/cows.webp']);
  const december = render(12,1,12,{},false);
  assert.deepEqual(december.requests,['assets/photo/cows.webp','assets/photo/christmas-tree.webp','assets/photo/christmas-lights.webp']);
  assert.equal(december.trees,0);
});

test('the photograph is muted to sit among the painted spruces', () => {
  const [grade] = render(12,10,12).grades;
  assert.ok(grade.mute > 0 && grade.nightMute > 0 && grade.haze > 0);
});

test('each bulb twinkles on its own and never goes dark', () => {
  const a = render(12,8,22,{animationTime:0});
  const b = render(12,8,22,{animationTime:4000});
  assert.notDeepEqual(a.photoLevels,b.photoLevels);
  assert.ok(new Set(a.photoLevels).size > 1);
  assert.ok(a.photoLevels.every(v => v >= .3 && v <= .96));
  assert.deepEqual(render(12,8,22,{reducedMotion:true}).photoLevels,Array(65).fill(.7));
});
