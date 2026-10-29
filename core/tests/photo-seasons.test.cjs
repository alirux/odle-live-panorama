const {test} = require('node:test');
const assert = require('node:assert/strict');
const S = require('../assets/photo-seasons.js');
const at = (month, day, hour = 0, year = 2026) => S.at({year, month, day, hour});

test('winter includes all of December and January across year boundaries', () => {
  for (const year of [2024, 2026, 2027]) {
    assert.equal(at(12, 1, 0, year).amount, 1);
    assert.equal(at(12, 31, 23, year).amount, 1);
    assert.equal(at(1, 1, 0, year + 1).amount, 1);
    assert.equal(at(1, 31, 23, year + 1).amount, 1);
    assert.equal(at(2, 8, 0, year + 1).amount, 0);
  }
});
test('seven-day transitions are continuous, monotonic and reversible', () => {
  let previous = 0;
  for (let hour = 0; hour <= 168; hour++) {
    const arriving = at(11, 24, hour);
    const melting = at(2, 1, hour);
    assert.ok(arriving.amount >= previous);
    assert.ok(Math.abs(arriving.amount + melting.amount - 1) < 1e-12);
    assert.ok(arriving.amount - previous < .01);
    previous = arriving.amount;
  }
  assert.equal(at(11, 27, 12).amount, .5);
  assert.equal(at(2, 4, 12).amount, .5);
});
test('remaining months stay summer; cows and clothing follow snow coverage', () => {
  for (let month = 3; month <= 10; month++) {
    assert.equal(at(month, 15).amount, 0);
    assert.equal(at(month, 15).cows, 1);
    assert.equal(at(month, 15).clothing, 0);
  }
  assert.equal(at(12, 15).cows, 0);
  assert.equal(at(12, 15).clothing, 1);
});
test('snowfall has quiet intervals and longer showers during accumulation', () => {
  let arriving = 0, winter = 0;
  for (let second = 0; second < 720; second++) {
    arriving += S.snowfall(at(11, 29), second * 1000);
    winter += S.snowfall(at(12, 15), second * 1000);
    assert.equal(S.snowfall(at(6, 15), second * 1000), 0);
  }
  assert.ok(arriving > winter * 2);
  assert.equal(S.snowfall(at(12, 15), 500000), 0);
  assert.ok(S.snowfall(at(12, 15), 60000) > .9);
  assert.equal(S.snowfall(at(12, 15), -660000), S.snowfall(at(12, 15), 60000));
});


test('opaque cloud cover precedes snow, lasts through every shower and clears afterwards', () => {
  for (const season of [at(11,25),at(11,29),at(12,15),at(2,6)]) {
    const veil = S.cloudCover(season,60000);
    for (let second = 0; second < 720; second++) {
      const clouds = S.cloudCover(season,second * 1000);
      assert.ok(clouds >= 0 && clouds <= 1);
      assert.ok(clouds >= S.snowfall(season,second * 1000));
      if (S.snowfall(season,second * 1000) > .001) assert.equal(clouds,veil);
    }
    assert.equal(S.cloudCover(season,710000),veil);
    assert.equal(S.cloudCover(season,500000),0);
  }
  for (const season of [at(11,29),at(12,15),at(2,6)]) assert.equal(S.cloudCover(season,60000),1);
  assert.equal(S.cloudCover(at(6,15),60000),0);
});
test('visible snow leads the calendar; cows and overcast follow what is visible', () => {
  for (const [first, last] of [[at(11,24,12), at(2,7,12)], [at(11,26,11), at(2,5,13)]]) {
    assert.ok(Math.abs(first.snow - last.snow) < .02);
  }
  // Two days into the arrival the ground must already read as snowy and the pasture empty.
  assert.ok(at(11,26,11).snow > .45);
  assert.equal(at(11,26,11).cows, 0);
  // The first and last days keep the herd out under a sky that is only lightly veiled.
  for (const season of [at(11,24,11), at(2,7,11)]) {
    assert.ok(season.snow < .06);
    assert.ok(season.cows > .9);
    assert.ok(S.cloudCover(season,60000) < .25);
  }
  for (let hour = 0; hour <= 168; hour++) {
    const season = at(11, 24, hour);
    assert.ok(season.snow >= season.amount);
  }
});
test('no snowfall or snow clouds while time is sped up, the snow cover stays', () => {
  const season = {...at(12, 15), accelerated: true};
  assert.equal(S.snowfall(season, 60000), 0);
  assert.equal(S.cloudCover(season, 60000), 0);
  assert.equal(season.snow, 1);
  assert.ok(S.snowfall(at(12, 15), 60000) > .9);
});
