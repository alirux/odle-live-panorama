/* Solar opening hours and dawn mist adapted from homepage_montagna.
 * Cows have fixed poses and fixed positions in the photographic pasture. */
(function (root) {
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hutSchedule(hour, sunriseHour = 6, sunsetHour = 20) {
    const shuttersOpen = hour >= Math.max(0, sunriseHour - 2) && hour < 23;
    return { shuttersOpen, lightsOn: shuttersOpen &&
      (hour < sunriseHour + 1 || hour >= sunsetHour - 1) };
  }
  // Evening lamps: each room lights up once the sun has dropped below its
  // own altitude threshold and goes dark at its bedtime, the last at 23:00
  // when the hut closes. Mornings stay dark: the lamps belong to the evening.
  const WINDOW_LAMPS = [
    { id: 'stube', on: 1, off: 23 },
    { id: 'kitchen', on: -.5, off: 22 + 55 / 60 },
    { id: 'chamber', on: -2, off: 22.75 },
    { id: 'loft', on: -3.5, off: 22.5 }
  ];
  function windowLamps(hour, altitude) {
    return WINDOW_LAMPS.map(lamp => hour >= 12 && hour < lamp.off && altitude < lamp.on ? 1 : 0);
  }
  function dawnMist(altitude, azimuth) {
    return smooth(-9, -5, altitude) * (1 - smooth(3, 9, altitude)) *
      smooth(.08, .82, clamp(Math.sin(azimuth)));
  }
  function worldToScreen(rect, x, y) {
    return { x: rect.x + x * rect.scale, y: rect.y + y * rect.scale };
  }
  const BOUNDS = { left: 1140, right: 1370, top: 677, bottom: 740 };
  const COWS = [
    { name: 'Carolina', coat: 0, x: 1164, y: 684, facing: 1, state: 'graze' },
    { name: 'Bruna', coat: 0, x: 1224, y: 740, facing: -1, state: 'stand' },
    { name: 'Bianca', coat: 1, x: 1296, y: 681, facing: 1, state: 'graze' },
    { name: 'Alma', coat: 1, x: 1338, y: 715, facing: -1, state: 'lying' }
  ];
  function makeCow(index) {
    return { ...COWS[index], id: `cow${index}` };
  }
  const model = { clamp, smooth, hutSchedule, windowLamps, WINDOW_LAMPS, dawnMist, worldToScreen, makeCow, BOUNDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.PhotoLifeModel = model;
})(typeof window === 'undefined' ? globalThis : window);
