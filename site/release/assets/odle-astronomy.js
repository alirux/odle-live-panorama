/* Astronomy for the Odle scene: positions of the Sun, the Moon, the planets
 * and the ISS orbit elements, star catalogues, Moon phase shapes and the
 * time zone arithmetic they need. Pure functions and data, shared by the site
 * and the screen saver through odle-scene.js. */
(function (root) {

function clamp(
  value,
  min,
  max
) {

  return Math.max(
    min,
    Math.min(max, value)
  );
}


function smoothstep(
  edge0,
  edge1,
  value
) {

  const t =
    clamp(
      (value - edge0) /
      (edge1 - edge0),
      0,
      1
    );

  return t * t * (3 - 2 * t);
}


const DEG =
  Math.PI / 180;

const RAD =
  180 / Math.PI;


function normalizeDegrees(value) {

  return (
    (value % 360) +
    360
  ) % 360;
}


function normalizeSignedDegrees(value) {

  const normalized =
    normalizeDegrees(value);

  return normalized > 180
    ? normalized - 360
    : normalized;
}


function sinDegrees(value) {

  return Math.sin(value * DEG);
}


function julianDate(date) {

  return date.getTime() /
    86400000 +
    2440587.5;
}


function horizontalPosition(
  rightAscension,
  declination,
  jd,
  latitude,
  longitude
) {

  const centuries =
    (jd - 2451545) / 36525;

  const siderealDegrees =
    normalizeDegrees(
      280.46061837 +
      360.98564736629 *
      (jd - 2451545) +
      .000387933 * centuries * centuries -
      centuries * centuries * centuries /
      38710000 +
      longitude
    );

  const hourAngle =
    normalizeSignedDegrees(
      siderealDegrees -
      rightAscension * RAD
    ) * DEG;

  const latitudeRadians =
    latitude * DEG;

  const altitude =
    Math.asin(
      Math.sin(latitudeRadians) *
      Math.sin(declination) +
      Math.cos(latitudeRadians) *
      Math.cos(declination) *
      Math.cos(hourAngle)
    );

  const azimuth =
    normalizeDegrees(
      (
        Math.atan2(
          Math.sin(hourAngle),
          Math.cos(hourAngle) *
          Math.sin(latitudeRadians) -
          Math.tan(declination) *
          Math.cos(latitudeRadians)
        ) +
        Math.PI
      ) * RAD
    ) * DEG;

  return {
    altitude:altitude * RAD,
    azimuth
  };
}


function sunPosition(
  date,
  latitude,
  longitude
) {

  const jd =
    julianDate(date);

  const days =
    jd - 2451545;

  const meanLongitude =
    normalizeDegrees(
      280.460 +
      .9856474 * days
    );

  const meanAnomaly =
    normalizeDegrees(
      357.528 +
      .9856003 * days
    );

  const eclipticLongitude =
    normalizeDegrees(
      meanLongitude +
      1.915 * sinDegrees(meanAnomaly) +
      .020 * sinDegrees(2 * meanAnomaly)
    ) * DEG;

  const obliquity =
    (23.439 - .0000004 * days) * DEG;

  const rightAscension =
    Math.atan2(
      Math.cos(obliquity) *
      Math.sin(eclipticLongitude),
      Math.cos(eclipticLongitude)
    );

  const declination =
    Math.asin(
      Math.sin(obliquity) *
      Math.sin(eclipticLongitude)
    );

  return {
    ...horizontalPosition(
      rightAscension,
      declination,
      jd,
      latitude,
      longitude
    ),
    eclipticLongitude:
      eclipticLongitude * RAD
  };
}


function refineSolarCrossing(
  startMilliseconds,
  endMilliseconds,
  latitude,
  longitude,
  rising
) {

  const horizonAltitude =
    -.833;

  let low =
    startMilliseconds;

  let high =
    endMilliseconds;

  for (
    let iteration = 0;
    iteration < 18;
    iteration += 1
  ) {

    const middle =
      (low + high) / 2;

    const middleAltitude =
      sunPosition(
        new Date(middle),
        latitude,
        longitude
      ).altitude;

    if (
      rising
        ? middleAltitude >= horizonAltitude
        : middleAltitude < horizonAltitude
    ) {

      high = middle;

    } else {

      low = middle;

    }

  }

  return new Date(
    (low + high) / 2
  );
}


function moonPosition(
  date,
  latitude,
  longitude
) {

  const jd =
    julianDate(date);

  const days =
    jd - 2451543.5;

  const node =
    normalizeDegrees(
      125.1228 -
      .0529538083 * days
    );

  const inclination =
    5.1454;

  const periapsis =
    normalizeDegrees(
      318.0634 +
      .1643573223 * days
    );

  const eccentricity =
    .0549;

  const meanAnomaly =
    normalizeDegrees(
      115.3654 +
      13.0649929509 * days
    );

  const meanAnomalyRadians =
    meanAnomaly * DEG;

  let eccentricAnomaly =
    meanAnomalyRadians +
    eccentricity *
    Math.sin(meanAnomalyRadians) *
    (
      1 +
      eccentricity *
      Math.cos(meanAnomalyRadians)
    );

  for (
    let iteration = 0;
    iteration < 3;
    iteration++
  ) {

    eccentricAnomaly -=
      (
        eccentricAnomaly -
        eccentricity *
        Math.sin(eccentricAnomaly) -
        meanAnomalyRadians
      ) /
      (
        1 -
        eccentricity *
        Math.cos(eccentricAnomaly)
      );
  }

  const orbitalX =
    60.2666 *
    (
      Math.cos(eccentricAnomaly) -
      eccentricity
    );

  const orbitalY =
    60.2666 *
    Math.sqrt(
      1 -
      eccentricity * eccentricity
    ) *
    Math.sin(eccentricAnomaly);

  const trueAnomaly =
    Math.atan2(
      orbitalY,
      orbitalX
    ) * RAD;

  const radius =
    Math.hypot(
      orbitalX,
      orbitalY
    );

  const nodeRadians =
    node * DEG;

  const latitudeArgument =
    (trueAnomaly + periapsis) * DEG;

  const inclinationRadians =
    inclination * DEG;

  const eclipticX =
    radius *
    (
      Math.cos(nodeRadians) *
      Math.cos(latitudeArgument) -
      Math.sin(nodeRadians) *
      Math.sin(latitudeArgument) *
      Math.cos(inclinationRadians)
    );

  const eclipticY =
    radius *
    (
      Math.sin(nodeRadians) *
      Math.cos(latitudeArgument) +
      Math.cos(nodeRadians) *
      Math.sin(latitudeArgument) *
      Math.cos(inclinationRadians)
    );

  const eclipticZ =
    radius *
    Math.sin(latitudeArgument) *
    Math.sin(inclinationRadians);

  let eclipticLongitude =
    Math.atan2(
      eclipticY,
      eclipticX
    ) * RAD;

  let eclipticLatitude =
    Math.atan2(
      eclipticZ,
      Math.hypot(eclipticX, eclipticY)
    ) * RAD;


  // Main lunar perturbations: enough for the visual motion
  // without adding an external dependency.

  const solarMeanAnomaly =
    normalizeDegrees(
      356.0470 +
      .9856002585 * days
    );

  const solarLongitude =
    normalizeDegrees(
      282.9404 +
      .0000470935 * days +
      solarMeanAnomaly
    );

  const lunarLongitude =
    normalizeDegrees(
      node +
      periapsis +
      meanAnomaly
    );

  const elongation =
    normalizeDegrees(
      lunarLongitude -
      solarLongitude
    );

  const latitudeArgumentMean =
    normalizeDegrees(
      lunarLongitude -
      node
    );

  eclipticLongitude +=
    -1.274 * sinDegrees(meanAnomaly - 2 * elongation) +
    .658 * sinDegrees(2 * elongation) -
    .186 * sinDegrees(solarMeanAnomaly) -
    .059 * sinDegrees(2 * meanAnomaly - 2 * elongation) -
    .057 * sinDegrees(meanAnomaly - 2 * elongation + solarMeanAnomaly) +
    .053 * sinDegrees(meanAnomaly + 2 * elongation) +
    .046 * sinDegrees(2 * elongation - solarMeanAnomaly) +
    .041 * sinDegrees(meanAnomaly - solarMeanAnomaly) -
    .035 * sinDegrees(elongation) -
    .031 * sinDegrees(meanAnomaly + solarMeanAnomaly) -
    .015 * sinDegrees(2 * latitudeArgumentMean - 2 * elongation) +
    .011 * sinDegrees(meanAnomaly - 4 * elongation);

  eclipticLatitude +=
    -.173 * sinDegrees(latitudeArgumentMean - 2 * elongation) -
    .055 * sinDegrees(meanAnomaly - latitudeArgumentMean - 2 * elongation) -
    .046 * sinDegrees(meanAnomaly + latitudeArgumentMean - 2 * elongation) +
    .033 * sinDegrees(latitudeArgumentMean + 2 * elongation) +
    .017 * sinDegrees(2 * meanAnomaly + latitudeArgumentMean);

  const eclipticLongitudeRadians =
    eclipticLongitude * DEG;

  const eclipticLatitudeRadians =
    eclipticLatitude * DEG;

  const obliquity =
    (23.4393 - .0000003563 * days) * DEG;

  const equatorialX =
    Math.cos(eclipticLongitudeRadians) *
    Math.cos(eclipticLatitudeRadians);

  const equatorialY =
    Math.sin(eclipticLongitudeRadians) *
    Math.cos(eclipticLatitudeRadians) *
    Math.cos(obliquity) -
    Math.sin(eclipticLatitudeRadians) *
    Math.sin(obliquity);

  const equatorialZ =
    Math.sin(eclipticLongitudeRadians) *
    Math.cos(eclipticLatitudeRadians) *
    Math.sin(obliquity) +
    Math.sin(eclipticLatitudeRadians) *
    Math.cos(obliquity);

  const rightAscension =
    Math.atan2(
      equatorialY,
      equatorialX
    );

  const declination =
    Math.atan2(
      equatorialZ,
      Math.hypot(
        equatorialX,
        equatorialY
      )
    );

  return {
    ...horizontalPosition(
      rightAscension,
      declination,
      jd,
      latitude,
      longitude
    ),
    eclipticLongitude,
    distance:radius
  };
}


function lunarPhaseState(
  sun,
  moon,
  latitude
) {

  const phase =
    normalizeDegrees(
      moon.eclipticLongitude -
      sun.eclipticLongitude
    ) / 360;

  const illumination =
    (1 - Math.cos(phase * Math.PI * 2)) / 2;

  return {
    phase,
    illumination,
    displayPhase:
      latitude >= 0
        ? phase
        : (1 - phase) % 1,
    sizeScale:
      clamp(
        60.2666 / moon.distance,
        .90,
        1.10
      ),
    iconIndex:
      Math.round(phase * 8) % 8
  };
}


function moonPhasePoints(
  x,
  y,
  radius,
  displayPhase,
  steps = 48
) {

  const illumination =
    (1 - Math.cos(displayPhase * Math.PI * 2)) / 2;

  const waxing =
    displayPhase <= .5;

  const points = [];

  for (
    let index = 0;
    index <= steps;
    index += 1
  ) {

    const vertical =
      -radius + radius * 2 * index / steps;

    const halfWidth =
      Math.sqrt(
        Math.max(
          0,
          radius * radius -
          vertical * vertical
        )
      );

    points.push([
      x + (waxing ? halfWidth : -halfWidth),
      y + vertical
    ]);
  }

  for (
    let index = steps;
    index >= 0;
    index -= 1
  ) {

    const vertical =
      -radius + radius * 2 * index / steps;

    const halfWidth =
      Math.sqrt(
        Math.max(
          0,
          radius * radius -
          vertical * vertical
        )
      );

    const terminator =
      waxing
        ? (1 - 2 * illumination) * halfWidth
        : (-1 + 2 * illumination) * halfWidth;

    points.push([
      x + terminator,
      y + vertical
    ]);
  }

  return points;
}


function moonPhaseSvgPath(
  displayPhase
) {

  const points =
    moonPhasePoints(
      10,
      10,
      7.5,
      displayPhase,
      28
    );

  return points
    .map(
      (point,index) =>
        `${index === 0 ? "M" : "L"}${
          point[0].toFixed(2)
        } ${point[1].toFixed(2)}`
    )
    .join(" ") + " Z";
}


function angularSeparationDegrees(
  first,
  second
) {

  const firstAltitude =
    first.altitude * DEG;

  const secondAltitude =
    second.altitude * DEG;

  const cosine =
    Math.sin(firstAltitude) *
    Math.sin(secondAltitude) +
    Math.cos(firstAltitude) *
    Math.cos(secondAltitude) *
    Math.cos(
      first.azimuth -
      second.azimuth
    );

  return Math.acos(
    clamp(cosine,-1,1)
  ) * RAD;
}


function zonedDateParts(date,timeZone) {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
      hour:"2-digit",
      minute:"2-digit",
      second:"2-digit",
      hourCycle:"h23"
    }
  ).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(part => part.type !== "literal")
      .map(part => [part.type,Number(part.value)])
  );
}

function zonedDateTimeValue(milliseconds,timeZone) {
  const parts = zonedDateParts(
    new Date(milliseconds),
    timeZone
  );
  const pad = value => String(value).padStart(2,"0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function zonedDateTimeMilliseconds(value,timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) return NaN;

  const target = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );

  let instant = target;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedDateParts(new Date(instant),timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    instant += target - represented;
  }

  return instant;
}


// JPL mean orbital elements, valid for this preview from 1800 to 2050.
// The aim is a believable geocentric position, not a precision ephemeris.
const planetCatalog = [
  {
    id:"mercury", name:"Mercurio", enName:"Mercury", type:"Pianeta roccioso", enType:"Rocky planet",
    diameter:4879, orbitalPeriod:"88 giorni", enOrbitalPeriod:"88 days", radius:3.25, referenceDistance:1,
    colors:["#d7cec0","#877e73"], brightness:.62,
    base:[.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593],
    rate:[.00000037,.00001906,-.00594749,149472.67411175,.16047689,-.12534081]
  },
  {
    id:"venus", name:"Venere", enName:"Venus", type:"Pianeta roccioso", enType:"Rocky planet",
    diameter:12104, orbitalPeriod:"224,7 giorni", enOrbitalPeriod:"224.7 days", radius:5.25, referenceDistance:1,
    colors:["#fff1b8","#cfae68"], brightness:1,
    base:[.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255],
    rate:[.00000390,-.00004107,-.00078890,58517.81538729,.00268329,-.27769418]
  },
  {
    id:"mars", name:"Marte", enName:"Mars", type:"Pianeta roccioso", enType:"Rocky planet",
    diameter:6779, orbitalPeriod:"687 giorni", enOrbitalPeriod:"687 days", radius:4.15, referenceDistance:1.5,
    colors:["#e89463","#8e3f2f"], brightness:.76,
    base:[1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],
    rate:[.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343]
  },
  {
    id:"jupiter", name:"Giove", enName:"Jupiter", type:"Gigante gassoso", enType:"Gas giant",
    diameter:139820, orbitalPeriod:"11,86 anni", enOrbitalPeriod:"11.86 years", radius:8.1, referenceDistance:5,
    colors:["#ead5ae","#9f7858"], brightness:.98,
    base:[5.20288700,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],
    rate:[-.00011607,-.00013253,-.00183714,3034.74612775,.21252668,.20469106]
  },
  {
    id:"saturn", name:"Saturno", enName:"Saturn", type:"Gigante gassoso · anelli", enType:"Gas giant · rings",
    diameter:116460, orbitalPeriod:"29,45 anni", enOrbitalPeriod:"29.45 years", radius:7.05, referenceDistance:9,
    colors:["#f1d99d","#aa8753"], brightness:.86, rings:true,
    base:[9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],
    rate:[-.00125060,-.00050991,.00193609,1222.49362201,-.41897216,-.28867794]
  },
  {
    id:"uranus", name:"Urano", enName:"Uranus", type:"Gigante ghiacciato", enType:"Ice giant",
    diameter:50724, orbitalPeriod:"84 anni", enOrbitalPeriod:"84 years", radius:5.25, referenceDistance:19,
    colors:["#b7edf0","#579fa9"], brightness:.54, thinRings:true,
    base:[19.18916464,.04725744,.77263783,313.23810451,170.95427630,74.01692503],
    rate:[-.00196176,-.00004397,-.00242939,428.48202785,.40805281,.04240589]
  },
  {
    id:"neptune", name:"Nettuno", enName:"Neptune", type:"Gigante ghiacciato", enType:"Ice giant",
    diameter:49244, orbitalPeriod:"164,8 anni", enOrbitalPeriod:"164.8 years", radius:5, referenceDistance:30,
    colors:["#79aaf2","#2452a0"], brightness:.48,
    base:[30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],
    rate:[.00026291,.00005105,.00035372,218.45945325,-.32241464,-.00508664]
  }
];

const earthOrbit = {
  base:[1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],
  rate:[.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0]
};


function heliocentricPlanetVector(body, centuries) {

  const values = body.base.map(
    (value,index) => value + body.rate[index] * centuries
  );

  const [a,e,inclinationDegrees,meanLongitude,perihelionLongitude,nodeLongitude] =
    values;

  const meanAnomaly =
    normalizeSignedDegrees(meanLongitude - perihelionLongitude) * DEG;

  let eccentricAnomaly = meanAnomaly;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    eccentricAnomaly -=
      (eccentricAnomaly - e * Math.sin(eccentricAnomaly) - meanAnomaly) /
      (1 - e * Math.cos(eccentricAnomaly));
  }

  const orbitalX = a * (Math.cos(eccentricAnomaly) - e);
  const orbitalY = a * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly);
  const argument = (perihelionLongitude - nodeLongitude) * DEG;
  const node = nodeLongitude * DEG;
  const inclination = inclinationDegrees * DEG;

  const cosArgument = Math.cos(argument);
  const sinArgument = Math.sin(argument);
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);

  return {
    x:
      (cosArgument * cosNode - sinArgument * sinNode * cosInclination) * orbitalX +
      (-sinArgument * cosNode - cosArgument * sinNode * cosInclination) * orbitalY,
    y:
      (cosArgument * sinNode + sinArgument * cosNode * cosInclination) * orbitalX +
      (-sinArgument * sinNode + cosArgument * cosNode * cosInclination) * orbitalY,
    z:
      sinArgument * sinInclination * orbitalX +
      cosArgument * sinInclination * orbitalY
  };
}


// ============================================================
// STARS
// ============================================================

const issOrbit = {
  epoch:
    Date.UTC(2026,0,1) +
    242.85334329 * 86400000,
  inclination:
    51.6312 * DEG,
  ascendingNode:
    285.5874 * DEG,
  argumentAtEpoch:
    (94.2999 + 265.8567) * DEG,
  meanMotion:
    15.48953200 * Math.PI * 2 /
    86400000,
  orbitalRadius:
    6371 + 418
};


function greenwichSiderealRadians(jd) {

  const centuries =
    (jd - 2451545) / 36525;

  return normalizeDegrees(
    280.46061837 +
    360.98564736629 *
    (jd - 2451545) +
    .000387933 * centuries * centuries -
    centuries * centuries * centuries /
    38710000
  ) * DEG;
}

const brightStarDetails = [
  ["Sirio","Sequenza principale · A1 V",8.6],
  ["Canopo","Supergigante · A9 II",310],
  ["Arturo","Gigante arancione · K1.5 III",36.7],
  ["Vega","Sequenza principale · A0 V",25],
  ["Capella","Sistema di giganti gialle",42.9],
  ["Rigel","Supergigante blu · B8 Ia",860],
  ["Procione","Subgigante · F5 IV-V",11.5],
  ["Achernar","Sequenza principale · B6 V",139],
  ["Betelgeuse","Supergigante rossa · M1-2 Ia",550],
  ["Hadar","Gigante blu · B1 III",390],
  ["Altair","Sequenza principale · A7 V",16.7],
  ["Acrux","Sistema multiplo · classe B",320],
  ["Aldebaran","Gigante arancione · K5 III",65.3],
  ["Antares","Supergigante rossa · M1.5 Iab",550],
  ["Spica","Sistema binario · classe B",250],
  ["Polluce","Gigante arancione · K0 III",33.7],
  ["Fomalhaut","Sequenza principale · A3 V",25.1],
  ["Deneb","Supergigante bianca · A2 Ia",2615],
  ["Mimosa","Gigante blu · B0.5 III",280],
  ["Regolo","Sequenza principale · B7 V",79.3],
  ["Adhara","Gigante luminosa · B2 II",430],
  ["Castore","Sistema multiplo · classe A",51],
  ["Gacrux","Gigante rossa · M3.5 III",88.6],
  ["Shaula","Subgigante blu · B2 IV",570],
  ["Bellatrix","Gigante blu · B2 III",250],
  ["Elnath","Gigante blu-bianca · B7 III",134],
  ["Miaplacidus","Subgigante bianca · A2 IV",113],
  ["Alnilam","Supergigante blu · B0 Ia",2000],
  ["Alnair","Sequenza principale · B7 V",101],
  ["Alioth","Gigante bianca · A1 III-IV",83],
  ["Dubhe","Gigante arancione · K0 III",123],
  ["Mirfak","Supergigante gialla · F5 Ib",590],
  ["Wezen","Supergigante gialla · F8 Ia",1600],
  ["Sargas","Gigante luminosa · F1 II",270],
  ["Kaus Australis","Gigante bianco-azzurra · B9.5 III",143],
  ["Avior","Sistema binario · classi K e B",630],
  ["Alkaid","Sequenza principale · B3 V",104],
  ["Menkalinan","Subgigante bianca · A1 IV",81],
  ["Atria","Gigante arancione · K2 II-III",390],
  ["Alhena","Subgigante bianca · A0 IV",109],
  ["Peacock","Subgigante blu · B2 IV",179],
  ["Polare","Supergigante gialla · F7 Ib",447],
  ["Hamal","Gigante arancione · K2 III",66],
  ["Diphda","Gigante arancione · K0 III",96],
  ["Mizar","Sistema multiplo · classe A",83],
  ["Merak","Sequenza principale · A1 V",79.7],
  ["Alpheratz","Stella peculiare · B9 p",97],
  ["Schedar","Gigante arancione · K0 III",228],
  ["Markab","Gigante blu-bianca · B9 III",133],
  ["Algol","Sistema binario a eclisse",93],
  ["Denebola","Sequenza principale · A3 V",36],
  ["Algieba","Sistema binario di giganti",130],
  ["Rasalhague","Gigante bianca · A5 III",48.6],
  ["Kochab","Gigante arancione · K4 III",131],
  ["Alphecca","Sequenza principale · A0 V",75],
  ["Enif","Supergigante arancione · K2 Ib",690],
  ["Caph","Subgigante · F2 III-IV",55]
];

const brightStarSpectralClasses = [
  "A","A","K","A","G","B","F","B","M","B",
  "A","B","K","M","B","K","A","A","B","B",
  "B","A","M","B","B","B","A","B","B","A",
  "K","F","F","F","B","K","B","A","K","A",
  "B","F","K","K","A","A","B","K","B","B",
  "A","K","A","K","A","K","F"
];

const brightStarCatalog = [
  [6.752,-16.716,-1.46], [6.399,-52.695,-.74],
  [14.261,19.182,-.05], [18.615,38.783,.03],
  [5.279,45.998,.08], [5.243,-8.202,.13],
  [7.655,5.225,.34], [1.628,-57.237,.46],
  [5.919,7.407,.50], [14.064,-60.373,.61],
  [19.846,8.868,.76], [12.443,-63.099,.77],
  [4.599,16.509,.86], [16.490,-26.432,.96],
  [13.420,-11.161,.98], [7.755,28.026,1.14],
  [22.961,-29.622,1.16], [20.691,45.280,1.25],
  [12.795,-59.689,1.25], [10.139,11.967,1.35],
  [6.977,-28.972,1.50], [7.577,31.888,1.58],
  [12.519,-57.113,1.59], [17.560,-37.104,1.62],
  [5.419,6.350,1.64], [5.438,28.608,1.65],
  [9.220,-69.717,1.67], [5.603,-1.202,1.69],
  [22.137,-46.961,1.74], [12.900,55.959,1.76],
  [11.062,61.751,1.79], [3.405,49.861,1.79],
  [7.140,-26.393,1.83], [17.622,-42.997,1.86],
  [18.402,-34.385,1.79], [8.376,-59.509,1.86],
  [13.792,49.313,1.86], [5.992,44.947,1.90],
  [16.811,-69.028,1.91], [6.628,16.399,1.93],
  [20.428,-56.735,1.94], [2.530,89.264,1.98],
  [2.119,23.462,2.00], [.727,-17.987,2.02],
  [13.399,54.925,2.23], [11.031,56.382,2.37],
  [.140,29.090,2.06], [.675,56.537,2.24],
  [23.079,15.205,2.49], [3.136,40.956,2.12],
  [11.818,14.572,2.14], [10.333,19.842,2.28],
  [17.582,12.560,2.08], [14.845,74.155,2.08],
  [15.578,26.715,2.23], [21.736,9.875,2.38],
  [.153,59.150,2.27]
].map(
  (star,index) => ({
    name:brightStarDetails[index][0],
    type:brightStarDetails[index][1],
    distance:brightStarDetails[index][2],
    spectralClass:
      brightStarSpectralClasses[index],
    rightAscension:star[0] * 15 * DEG,
    declination:star[1] * DEG,
    magnitude:star[2],
    warm:index % 7 === 0,
    phase:index * 1.73,
    speed:.00068 +
      (index % 7) * .000073
  })
);


const faintStarCatalog =
  Array.from(
    { length:96 },
    (_,index) => {

      const seedA =
        Math.sin((index + 61) * 127.1) * 43758.5453;

      const seedB =
        Math.sin((index + 61) * 311.7) * 24634.6345;

      const seedC =
        Math.sin((index + 61) * 73.3) * 56445.2341;

      const unitA =
        seedA - Math.floor(seedA);

      const unitB =
        seedB - Math.floor(seedB);

      const unitC =
        seedC - Math.floor(seedC);

      return {
        rightAscension:
          unitA * Math.PI * 2,
        declination:
          Math.asin(unitB * 2 - 1),
        magnitude:
          2.7 + unitC * 2.1,
        spectralClass:
          ["A","F","G","K","B"][(
            index * 7
          ) % 5],
        phase:index * 1.39,
        speed:.00062 +
          (index % 9) * .000052
      };
    }
  );

const api = {
  clamp,
  smoothstep,
  DEG,
  RAD,
  normalizeDegrees,
  normalizeSignedDegrees,
  sinDegrees,
  julianDate,
  horizontalPosition,
  sunPosition,
  refineSolarCrossing,
  moonPosition,
  lunarPhaseState,
  moonPhasePoints,
  moonPhaseSvgPath,
  angularSeparationDegrees,
  zonedDateParts,
  zonedDateTimeValue,
  zonedDateTimeMilliseconds,
  planetCatalog,
  earthOrbit,
  heliocentricPlanetVector,
  issOrbit,
  greenwichSiderealRadians,
  brightStarDetails,
  brightStarSpectralClasses,
  brightStarCatalog,
  faintStarCatalog
};
if (typeof module !== 'undefined') module.exports = api;
else root.OdleAstronomy = api;
})(typeof window !== 'undefined' ? window : globalThis);
