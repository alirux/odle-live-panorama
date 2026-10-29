/* Picks the instants of the wallpaper frames for one day: the night, the Sun
 * rising and setting through the altitudes where the scene's light changes,
 * and the day. Each frame carries the Sun's position, which macOS compares
 * with the Sun where the Mac is. */
(function (root) {
  const A = root.OdleAstronomy;
  const MINUTE = 60000;
  // The scene's light changes between -15° (end of the night) and +28° (end
  // of the warm light, photo-landscape.js), most of all near the horizon.
  const TWILIGHT = [-14, -9, -5, -2, 1, 6, 14, 21];
  // Above this the scene looks the same all day: one picture, several Sun
  // positions, so that macOS never picks a twilight frame by mistake.
  const FULL_DAY = 28;
  // Winter flurries repeat every 720 s (photo-seasons.js); 420 s into the
  // cycle the sky is clear in every season, so no frame freezes falling snow.
  const WEATHER_CYCLE = 720000;
  const CLEAR_SKY = 420000;

  // Whether the whole Sun disk is in the sky of the picture: the panorama
  // faces south and the ridge hides it (photo-landscape.js).
  function sunInView(sun) {
    const { W, H } = root.odleScene;
    const position = root.odleScene.projectCelestialBody(sun);
    const radius = root.photoScene.sunRadius(W, H);
    const x = position.x * W, y = position.y * H;
    return x > 3 * radius && x < W - 3 * radius && y > 3 * radius &&
      root.photoScene.isSky(x, y + radius, W, H);
  }

  function clearSky(t) {
    const offset = ((t - CLEAR_SKY) % WEATHER_CYCLE + WEATHER_CYCLE) % WEATHER_CYCLE;
    return offset > WEATHER_CYCLE / 2 ? t + WEATHER_CYCLE - offset : t - offset;
  }

  // Each frame: { name, time, altitude, azimuth, image }, where image is the
  // name of the frame whose picture it uses (its own, or the day's).
  function plan(day, latitude, longitude) {
    const noonGuess = Date.parse(day + 'T12:00:00Z') - longitude / 15 * 3600000;
    const samples = [];
    for (let t = noonGuess - 720 * MINUTE; t <= noonGuess + 720 * MINUTE; t += MINUTE) {
      samples.push({ t, ...A.sunPosition(new Date(t), latitude, longitude) });
    }
    const highest = samples.reduce((a, b) => b.altitude > a.altitude ? b : a);
    const lowest = samples.reduce((a, b) => b.altitude < a.altitude ? b : a);
    // First crossing of an altitude before noon (rising) or after it (setting).
    const crossing = (altitude, rising) => {
      for (let i = 0; i + 1 < samples.length; i++) {
        const a = samples[i], b = samples[i + 1];
        if (rising ? b.t > highest.t : a.t < highest.t) continue;
        if (rising ? a.altitude < altitude && b.altitude >= altitude
                   : a.altitude > altitude && b.altitude <= altitude) return a.t;
      }
      return null;
    };
    // In the middle of the minutes the Sun is in view, in the morning and in
    // the afternoon: the day pictures that show it.
    const inView = samples.filter(sample => sunInView(sample));
    const middle = list => list.length ? list[Math.floor(list.length / 2)].t : null;
    const sunMorning = middle(inView.filter(sample => sample.t < highest.t));
    const sunAfternoon = middle(inView.filter(sample => sample.t > highest.t));
    const label = altitude => (altitude > 0 ? '+' : '') + altitude;
    const times = [
      ['night', lowest.t, 'night'],
      ...TWILIGHT.map(altitude => ['rise' + label(altitude), crossing(altitude, true)]),
      ['morning', crossing(FULL_DAY, true), 'noon'],
      ['sun-morning', sunMorning],
      ['noon', highest.t, 'noon'],
      ['sun-afternoon', sunAfternoon],
      ['afternoon', crossing(FULL_DAY, false), 'noon'],
      ...TWILIGHT.slice().reverse().map(altitude => ['set' + label(altitude), crossing(altitude, false)])
    ];
    return times.filter(([, t]) => t !== null).sort((a, b) => a[1] - b[1]).map(([name, t, image = name]) => {
      const time = clearSky(Math.round(t / 1000) * 1000);
      const sun = A.sunPosition(new Date(time), latitude, longitude);
      // sunPosition gives the azimuth in radians; macOS wants degrees from north.
      return { name, time: new Date(time).toISOString(), altitude: sun.altitude, azimuth: sun.azimuth * A.RAD, image };
    });
  }

  root.odleWallpaper = { plan };
})(window);
