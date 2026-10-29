/* Calendar seasons use the scene's local civil date, including simulated time. */
(function (root) {
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const DAY = 86400000;
  function at(parts) {
    const { year, month, day, hour = 0, minute = 0, second = 0 } = parts;
    const date = Date.UTC(year, month - 1, day, hour, minute, second);
    const winterYear = month < 7 ? year - 1 : year;
    const start = Date.UTC(winterYear, 11, 1);
    const end = Date.UTC(winterYear + 1, 1, 1);
    const arriving = date >= start - 7 * DAY && date < start;
    const melting = date >= end && date < end + 7 * DAY;
    const amount = arriving ? smooth((date - start + 7 * DAY) / (7 * DAY))
      : melting ? 1 - smooth((date - end) / (7 * DAY))
      : date >= start && date < end ? 1 : 0;
    // A photo crossfade reads as faded grass below ~40%: visible snow leads the calendar.
    const snow = 1 - (1 - amount) * (1 - amount);
    return { amount, snow, arriving, melting, cows: 1 - smooth(snow / .3), clothing: smooth(snow / .5) };
  }
  function snowfall(season, milliseconds) {
    if (!season || season.amount <= 0 || season.accelerated) return 0;
    // Quiet intervals separate flurries; autumn accumulation gets longer showers.
    const cycle = ((milliseconds / 1000 % 720) + 720) % 720;
    const duration = season.arriving ? 310 : season.melting ? 65 : 130;
    return smooth(cycle / 18) * (1 - smooth((cycle - duration + 25) / 25))
      * smooth(season.snow / .25) * (season.melting ? .35 : 1);
  }
  function cloudCover(season, milliseconds) {
    if (!season || season.amount <= 0 || season.accelerated) return 0;
    const cycle = ((milliseconds / 1000 % 720) + 720) % 720;
    const duration = season.arriving ? 310 : season.melting ? 65 : 130;
    // Clouds arrive before the first flakes and clear after the last ones;
    // a thin first dusting only brings a light veil.
    const veil = smooth(season.snow / .2);
    if (cycle <= duration) return veil;
    return veil * Math.max(1 - smooth((cycle - duration) / 45), smooth((cycle - 675) / 30));
  }
  const api = { at, snowfall, cloudCover };
  if (typeof module !== 'undefined') module.exports = api;
  else root.PhotoSeasons = api;
})(typeof window !== 'undefined' ? window : globalThis);
