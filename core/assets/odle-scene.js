/* The Odle scene engine: the clock, the sky computed for the observer, the
 * photographic landscape and its life, drawn on the #landscape canvas. It runs
 * on any page that has that canvas and loads photo-*.js and odle-astronomy.js
 * first: the site adds its interface through window.odleScene, the screen
 * saver shows the scene alone. Nothing moves until startScene() is called. */
(() => {

const {
  DEG,
  angularSeparationDegrees,
  brightStarCatalog,
  clamp,
  earthOrbit,
  faintStarCatalog,
  greenwichSiderealRadians,
  heliocentricPlanetVector,
  horizontalPosition,
  issOrbit,
  julianDate,
  lunarPhaseState,
  moonPhasePoints,
  moonPosition,
  planetCatalog,
  refineSolarCrossing,
  smoothstep,
  sunPosition,
  zonedDateParts,
  zonedDateTimeMilliseconds
} = OdleAstronomy;

let photoLifeOptions = {};

const canvas =
  document.querySelector("#landscape");

const ctx =
  canvas.getContext("2d");


let W = 0;
let H = 0;
let DPR = 1;


const reducedMotion =
  window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

let pointerWind =
  0;

let hoveredStar =
  null;

let issHovered =
  false;

let hoveredPlanet =
  null;

let peakHovered =
  null;

let peakProximities =
  new Map();

const peakStates = [
  {
    id:"furchetta",
    name:"Furchetta",
    enName:"Furchetta",
    x:.388,
    y:.163,
    elevation:3025
  },
  {
    id:"sass-rigais",
    name:"Sass Rigais",
    enName:"Sass Rigais",
    x:.615,
    y:.180,
    elevation:3025
  }
];

let moonLandingState = {
  visible:false,
  x:-10000,
  y:-10000,
  radius:0
};

let nearbyStarWeights =
  new Map();

let nearbyPlanetWeights =
  new Map();


// ============================================================
// RESIZE
// ============================================================

function resize() {

  DPR =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  W =
    window.innerWidth;

  H =
    window.innerHeight;


  canvas.width =
    Math.round(W * DPR);

  canvas.height =
    Math.round(H * DPR);


  canvas.style.width =
    W + "px";

  canvas.style.height =
    H + "px";


  ctx.setTransform(
    DPR,
    0,
    0,
    DPR,
    0,
    0
  );
}


window.addEventListener(
  "resize",
  resize
);

resize();


// ============================================================
// HELPERS
// ============================================================

function X(v) {
  return W * v;
}

function Y(v) {
  return H * v;
}


const previewParameters =
  new URLSearchParams(
    window.location.search
  );

// ?lat=..&lon=..&place=.. moves the observer (the screen saver uses it)
const defaultObserver = (() => {
  const latitude = Number(previewParameters.get("lat"));
  const longitude = Number(previewParameters.get("lon"));
  if (
    previewParameters.get("lat") !== null &&
    previewParameters.get("lon") !== null &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  ) {
    return {
      latitude,
      longitude,
      source:previewParameters.get("place") || "manuale"
    };
  }
  return {
    latitude:46.6419,
    longitude:11.7187,
    source:"Santa Maddalena"
  };
})();

let currentLanguage =
  previewParameters.get("lang") === "en"
    ? "en"
    : "it";

function browserTimeZoneId() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function coordinateTimeZone(latitude,longitude) {
  try {
    return typeof tzlookup === "function"
      ? tzlookup(latitude,longitude)
      : browserTimeZoneId();
  } catch {
    return browserTimeZoneId();
  }
}

function observerTimeZone(date) {
  const zone = coordinateTimeZone(
    observer.latitude,
    observer.longitude
  );
  const shortName = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:zone,
      timeZoneName:"short"
    }
  ).formatToParts(date).find(part => part.type === "timeZoneName")?.value || "UTC";

  return { zone, shortName };
}

const previewTimeParameter =
  previewParameters.get("previewTime");

const previewTimeMilliseconds =
  previewTimeParameter
    ? Date.parse(previewTimeParameter)
    : NaN;

const timeLapseSeconds =
  Number(
    previewParameters.get("timeLapse")
  );

const timeLapseEnabled =
  Number.isFinite(timeLapseSeconds) &&
  timeLapseSeconds > 0;

const timeLapseDurationMilliseconds =
  Math.max(
    15,
    Math.min(180,timeLapseSeconds)
  ) * 1000;

// A steady speed-up of the clock (24 = a day in an hour), slower than the
// time-lapse, which squeezes a whole day into a few minutes at most.
const timeSpeed =
  Number(
    previewParameters.get("timeSpeed")
  );

const timeSpeedEnabled =
  !timeLapseEnabled &&
  Number.isFinite(timeSpeed) &&
  timeSpeed > 1;

let simulationTimeMilliseconds =
  Number.isFinite(previewTimeMilliseconds)
    ? previewTimeMilliseconds
    : Date.now();

let simulationLastRealMilliseconds =
  Date.now();

let followRealTime =
  !timeLapseEnabled &&
  !timeSpeedEnabled &&
  !Number.isFinite(previewTimeMilliseconds);

let playbackRate =
  timeLapseEnabled
    ? 24 * 60 * 60 * 1000 /
      timeLapseDurationMilliseconds
    : timeSpeedEnabled
      ? Math.min(3600,timeSpeed)
    : Number.isFinite(previewTimeMilliseconds) &&
      previewParameters.get("previewLive") !== "1"
      ? 0
      : 1;

let observer = {
  ...defaultObserver
};

let solarEventsCache = {
  key:"",
  sunrise:null,
  sunset:null
};

let nextAstronomyUpdate =
  0;

let celestialState = {
  sunAltitude:-20,
  sunAzimuth:Math.PI,
  moonAltitude:-20,
  moonAzimuth:Math.PI,
  daylight:0,
  twilight:0,
  starVisibility:1,
  sunVisibility:0,
  moonVisibility:0,
  moonPhase:0,
  moonIllumination:0,
  moonSizeScale:1,
  sunX:.5,
  sunY:.43,
  moonX:.5,
  moonY:.43
};


function solarEventsFor(
  date,
  latitude,
  longitude,
  timeZone
) {

  const local =
    zonedDateParts(date,timeZone);

  const cacheKey =
    `${local.year}-${
      local.month
    }-${
      local.day
    }-${timeZone}-${
      latitude.toFixed(5)
    }-${
      longitude.toFixed(5)
    }`;

  if (
    solarEventsCache.key === cacheKey
  ) {

    return solarEventsCache;
  }

  const pad = value => String(value).padStart(2,"0");
  const dayStart = zonedDateTimeMilliseconds(
    `${local.year}-${pad(local.month)}-${pad(local.day)}T00:00`,
    timeZone
  );
  const nextDay = new Date(
    Date.UTC(local.year,local.month - 1,local.day + 1)
  );
  const dayEnd = zonedDateTimeMilliseconds(
    `${nextDay.getUTCFullYear()}-${pad(nextDay.getUTCMonth() + 1)}-${pad(nextDay.getUTCDate())}T00:00`,
    timeZone
  );

  const horizonAltitude =
    -.833;

  const sampleCount =
    288;

  let sunrise =
    null;

  let sunset =
    null;

  let previousTime =
    dayStart;

  let previousAltitude =
    sunPosition(
      new Date(previousTime),
      latitude,
      longitude
    ).altitude;

  for (
    let index = 1;
    index <= sampleCount;
    index += 1
  ) {

    const sampleTime =
      dayStart +
      (
        dayEnd - dayStart
      ) *
      index /
      sampleCount;

    const sampleAltitude =
      sunPosition(
        new Date(sampleTime),
        latitude,
        longitude
      ).altitude;

    if (
      !sunrise &&
      previousAltitude < horizonAltitude &&
      sampleAltitude >= horizonAltitude
    ) {

      sunrise =
        refineSolarCrossing(
          previousTime,
          sampleTime,
          latitude,
          longitude,
          true
        );
    }

    if (
      !sunset &&
      previousAltitude >= horizonAltitude &&
      sampleAltitude < horizonAltitude
    ) {

      sunset =
        refineSolarCrossing(
          previousTime,
          sampleTime,
          latitude,
          longitude,
          false
        );
    }

    previousTime =
      sampleTime;

    previousAltitude =
      sampleAltitude;
  }

  solarEventsCache = {
    key:cacheKey,
    sunrise,
    sunset
  };

  return solarEventsCache;
}


function moonPhasePath(
  x,
  y,
  radius,
  displayPhase
) {

  const points =
    moonPhasePoints(
      x,
      y,
      radius,
      displayPhase,
      64
    );

  ctx.beginPath();

  points.forEach(
    (point,index) => {

      if (index === 0) {

        ctx.moveTo(
          point[0],
          point[1]
        );

      } else {

        ctx.lineTo(
          point[0],
          point[1]
        );
      }
    }
  );

  ctx.closePath();
}


function projectCelestialBody(position) {

  if (photoScene.active) return photoScene.project(position,W,H);

  const altitude =
    clamp(
      position.altitude,
      -6,
      90
    );

  return {
    x:.5 +
      Math.sin(
        position.azimuth -
        Math.PI
      ) * .455,
    y:.43 -
      (
        (altitude + 6) / 96
      ) * .37
  };
}


function separateStylizedBodies(
  sunScreen,
  moonScreen,
  sun,
  moon
) {

  const angularSeparation =
    angularSeparationDegrees(
      sun,
      moon
    );

  const possibleEclipse =
    angularSeparation <= .62;

  if (
    possibleEclipse ||
    sun.altitude <= -5 ||
    moon.altitude <= -6 ||
    W <= 0 ||
    H <= 0
  ) {

    return {
      ...moonScreen,
      angularSeparation,
      visuallySeparated:false
    };
  }

  let deltaX =
    (moonScreen.x - sunScreen.x) * W;

  let deltaY =
    (moonScreen.y - sunScreen.y) * H;

  let distance =
    Math.hypot(
      deltaX,
      deltaY
    );

  const minimumDistance =
    Math.max(
      38,
      Math.min(W, H) * .055
    ) +
    Math.max(
      29,
      Math.min(W, H) * .047
    ) +
    8;

  if (
    distance >= minimumDistance
  ) {

    return {
      ...moonScreen,
      angularSeparation,
      visuallySeparated:false
    };
  }

  if (
    distance < .001
  ) {

    deltaX =
      Math.sin(
        moon.azimuth -
        sun.azimuth
      ) || 1;

    deltaY =
      -(
        moon.altitude -
        sun.altitude
      );

    distance =
      Math.hypot(
        deltaX,
        deltaY
      );
  }

  const shift =
    minimumDistance - distance;

  const directionX =
    deltaX / distance;

  const directionY =
    deltaY / distance;

  return {
    x:clamp(
      moonScreen.x +
      directionX * shift / W,
      .035,
      .965
    ),
    y:clamp(
      moonScreen.y +
      directionY * shift / H,
      .035,
      .47
    ),
    angularSeparation,
    visuallySeparated:true
  };
}

let planetStates = [];


function planetHorizontalPosition(body, date, earthVector) {

  const jd = julianDate(date);
  const centuries = (jd - 2451545) / 36525;
  const planetVector = heliocentricPlanetVector(body, centuries);
  const x = planetVector.x - earthVector.x;
  const y = planetVector.y - earthVector.y;
  const z = planetVector.z - earthVector.z;
  const distanceAu = Math.hypot(x,y,z);
  const sunDistanceAu = Math.hypot(
    planetVector.x,
    planetVector.y,
    planetVector.z
  );
  const earthDistanceAu = Math.hypot(
    earthVector.x,
    earthVector.y,
    earthVector.z
  );
  const obliquity = (23.43928 - .0130042 * centuries) * DEG;
  const equatorialY = y * Math.cos(obliquity) - z * Math.sin(obliquity);
  const equatorialZ = y * Math.sin(obliquity) + z * Math.cos(obliquity);
  const rightAscension = Math.atan2(equatorialY,x);
  const declination = Math.atan2(
    equatorialZ,
    Math.hypot(x,equatorialY)
  );
  const phaseCosine = clamp(
    (
      sunDistanceAu * sunDistanceAu +
      distanceAu * distanceAu -
      earthDistanceAu * earthDistanceAu
    ) / (2 * sunDistanceAu * distanceAu),
    -1,
    1
  );

  return {
    ...horizontalPosition(
      rightAscension,
      declination,
      jd,
      observer.latitude,
      observer.longitude
    ),
    distanceAu,
    sunDistanceAu,
    illumination:(1 + phaseCosine) * .5
  };
}


function updatePlanetPositions(date) {

  const centuries = (julianDate(date) - 2451545) / 36525;
  const earthVector = heliocentricPlanetVector(earthOrbit, centuries);

  planetStates = planetCatalog.map(body => {
    const position = planetHorizontalPosition(body,date,earthVector);
    const screen = projectCelestialBody(position);
    const horizonVisibility = smoothstep(-2,4,position.altitude);
    const darkness = celestialState.starVisibility;
    const visibility =
      horizonVisibility *
      clamp(darkness * body.brightness,0,1);
    const distanceScale = clamp(
      body.referenceDistance / position.distanceAu,
      .72,
      1.32
    );

    return {
      ...body,
      ...position,
      x:screen.x,
      y:screen.y,
      visibility,
      displayRadius:body.radius * distanceScale
    };
  });

  hooks.planets(planetStates);
}


function updateAstronomy(
  force = false
) {

  const clockMilliseconds =
    Date.now();

  if (
    !force &&
    clockMilliseconds < nextAstronomyUpdate
  ) {

    return;
  }

  nextAstronomyUpdate =
    clockMilliseconds +
    (
      followRealTime
        ? 1000
        : playbackRate === 0
          ? 1000
          : 50
    );

  const elapsedRealMilliseconds =
    Math.max(
      0,
      clockMilliseconds -
      simulationLastRealMilliseconds
    );

  simulationLastRealMilliseconds =
    clockMilliseconds;

  if (
    followRealTime
  ) {

    simulationTimeMilliseconds =
      clockMilliseconds;

  } else if (
    playbackRate !== 0
  ) {

    simulationTimeMilliseconds +=
      elapsedRealMilliseconds *
      playbackRate;
  }

  const nowMilliseconds =
    simulationTimeMilliseconds;

  const now =
    new Date(nowMilliseconds);

  const sun =
    sunPosition(
      now,
      observer.latitude,
      observer.longitude
    );

  const moon =
    moonPosition(
      now,
      observer.latitude,
      observer.longitude
    );

  const lunarPhase =
    lunarPhaseState(
      sun,
      moon,
      observer.latitude
    );

  const sunScreen =
    projectCelestialBody(sun);

  const projectedMoonScreen =
    projectCelestialBody(moon);

  const moonScreen =
    photoScene.active ? {
      ...projectedMoonScreen,
      angularSeparation:angularSeparationDegrees(sun,moon),
      visuallySeparated:false
    } : separateStylizedBodies(
      sunScreen,
      projectedMoonScreen,
      sun,
      moon
    );

  const daylight =
    smoothstep(
      -8,
      4,
      sun.altitude
    );

  const twilight =
    clamp(
      1 -
      Math.abs(sun.altitude) / 10,
      0,
      1
    );

  celestialState = {
    sunAltitude:sun.altitude,
    sunAzimuth:sun.azimuth,
    moonDistanceKm:moon.distance * 6378.14,
    moonAltitude:moon.altitude,
    moonAzimuth:moon.azimuth,
    sunMoonSeparation:
      moonScreen.angularSeparation,
    moonVisuallySeparated:
      moonScreen.visuallySeparated,
    daylight,
    twilight,
    starVisibility:
      1 -
      smoothstep(
        -10,
        -3,
        sun.altitude
      ),
    sunVisibility:
      smoothstep(
        -5,
        -.4,
        sun.altitude
      ),
    moonVisibility:
      smoothstep(
        -6,
        2,
        moon.altitude
      ) *
      (
        1 - daylight * .66
      ),
    moonPhase:
      lunarPhase.phase,
    moonDisplayPhase:
      lunarPhase.displayPhase,
    moonIllumination:
      lunarPhase.illumination,
    moonSizeScale:
      lunarPhase.sizeScale,
    sunX:sunScreen.x,
    sunY:sunScreen.y,
    moonX:moonScreen.x,
    moonY:moonScreen.y
  };

  updatePhotoReadout();

  updateStarPositions(
    julianDate(now)
  );

  updatePlanetPositions(now);

  updateIssPosition(now);

  const timeZone =
    observerTimeZone(now);

  const solarEvents =
    solarEventsFor(
      now,
      observer.latitude,
      observer.longitude,
      timeZone.zone
    );

  const localParts = zonedDateParts(now,timeZone.zone);
  const sunriseParts = solarEvents.sunrise ? zonedDateParts(solarEvents.sunrise,timeZone.zone) : null;
  const sunsetParts = solarEvents.sunset ? zonedDateParts(solarEvents.sunset,timeZone.zone) : null;
  photoLifeOptions = {
    simMs:nowMilliseconds,
    // the snow cover follows the date, but flurries and their clouds pause
    // while time is sped up: they would only flicker
    season:{
      ...PhotoSeasons.at(localParts),
      accelerated:!followRealTime && Math.abs(playbackRate) > 1
    },
    hour:localParts.hour + localParts.minute / 60,
    sunriseHour:sunriseParts ? sunriseParts.hour + sunriseParts.minute / 60 : 6,
    sunsetHour:sunsetParts ? sunsetParts.hour + sunsetParts.minute / 60 : 20,
    sunrise:solarEvents.sunrise ? solarEvents.sunrise.getTime() : NaN,
    sunset:solarEvents.sunset ? solarEvents.sunset.getTime() : NaN
  };

  hooks.astronomy({ now, lunarPhase, daylight, timeZone, solarEvents });
}

let issState = {
  visibility:0,
  x:.5,
  y:.2,
  angle:0,
  range:1000
};


function issHorizontalPosition(date) {

  const elapsed =
    date.getTime() -
    issOrbit.epoch;

  const argument =
    issOrbit.argumentAtEpoch +
    elapsed * issOrbit.meanMotion;

  const cosNode =
    Math.cos(issOrbit.ascendingNode);

  const sinNode =
    Math.sin(issOrbit.ascendingNode);

  const cosInclination =
    Math.cos(issOrbit.inclination);

  const sinInclination =
    Math.sin(issOrbit.inclination);

  const orbitalX =
    issOrbit.orbitalRadius *
    Math.cos(argument);

  const orbitalY =
    issOrbit.orbitalRadius *
    Math.sin(argument);

  const satelliteX =
    cosNode * orbitalX -
    sinNode * cosInclination * orbitalY;

  const satelliteY =
    sinNode * orbitalX +
    cosNode * cosInclination * orbitalY;

  const satelliteZ =
    sinInclination * orbitalY;

  const jd =
    julianDate(date);

  const observerAngle =
    greenwichSiderealRadians(jd) +
    observer.longitude * DEG;

  const observerLatitude =
    observer.latitude * DEG;

  const observerRadius =
    6371;

  const observerX =
    observerRadius *
    Math.cos(observerLatitude) *
    Math.cos(observerAngle);

  const observerY =
    observerRadius *
    Math.cos(observerLatitude) *
    Math.sin(observerAngle);

  const observerZ =
    observerRadius *
    Math.sin(observerLatitude);

  const relativeX =
    satelliteX - observerX;

  const relativeY =
    satelliteY - observerY;

  const relativeZ =
    satelliteZ - observerZ;

  const range =
    Math.hypot(
      relativeX,
      relativeY,
      relativeZ
    );

  const rightAscension =
    Math.atan2(
      relativeY,
      relativeX
    );

  const declination =
    Math.asin(
      relativeZ / range
    );

  return {
    ...horizontalPosition(
      rightAscension,
      declination,
      jd,
      observer.latitude,
      observer.longitude
    ),
    range
  };
}


function updateIssPosition(date) {

  const position =
    issHorizontalPosition(date);

  const futurePosition =
    issHorizontalPosition(
      new Date(date.getTime() + 8000)
    );

  const screen =
    projectCelestialBody(position);

  const futureScreen =
    projectCelestialBody(futurePosition);

  issState = {
    visibility:
      smoothstep(
        0,
        5,
        position.altitude
      ) *
      celestialState.starVisibility,
    x:screen.x,
    y:screen.y,
    angle:
      Math.atan2(
        futureScreen.y - screen.y,
        futureScreen.x - screen.x
      ),
    range:position.range
  };

  hooks.iss(issState,position);
}


const stars = [
  ...brightStarCatalog,
  ...faintStarCatalog
];

let starScreenPositions = [];


const spectralColors = {
  O:"#9ebcff",
  B:"#b6d0ff",
  A:"#e1eaff",
  F:"#fff4dc",
  G:"#ffe29b",
  K:"#ffbd7b",
  M:"#ff8a72"
};


function updateStarPositions(jd) {

  starScreenPositions =
    stars.map(
      star => {

        const position =
          horizontalPosition(
            star.rightAscension,
            star.declination,
            jd,
            observer.latitude,
            observer.longitude
          );

        const screen =
          projectCelestialBody(position);

        return {
          ...star,
          x:screen.x,
          y:screen.y,
          horizonVisibility:
            smoothstep(
              -4,
              3,
              position.altitude
            )
        };
      }
    );
}


function drawPlanetSphere(planet,radius) {

  const gradient = ctx.createRadialGradient(
    -radius * .36,
    -radius * .42,
    radius * .12,
    0,
    0,
    radius * 1.12
  );

  gradient.addColorStop(0,planet.colors[0]);
  gradient.addColorStop(.72,planet.colors[0]);
  gradient.addColorStop(1,planet.colors[1]);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0,0,radius,0,Math.PI * 2);
  ctx.fill();
}


function drawPlanetDetails(planet,radius) {

  if (planet.id === "jupiter") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0,0,radius,0,Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = .42;
    ctx.strokeStyle = "#966b4f";
    ctx.lineWidth = Math.max(.75,radius * .14);
    [-.44,-.08,.32].forEach(offset => {
      ctx.beginPath();
      ctx.moveTo(-radius * 1.1,radius * offset);
      ctx.quadraticCurveTo(0,radius * (offset + .08),radius * 1.1,radius * offset);
      ctx.stroke();
    });
    ctx.fillStyle = "#aa6247";
    ctx.beginPath();
    ctx.ellipse(radius * .36,radius * .32,radius * .18,radius * .09,-.12,0,Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (planet.id === "mars") {
    ctx.globalAlpha = .30;
    ctx.fillStyle = "#682e27";
    ctx.beginPath();
    ctx.arc(radius * .22,-radius * .14,radius * .22,0,Math.PI * 2);
    ctx.fill();
  }

  if (planet.id === "neptune") {
    ctx.globalAlpha = .34;
    ctx.strokeStyle = "#d6e7ff";
    ctx.lineWidth = Math.max(.6,radius * .12);
    ctx.beginPath();
    ctx.moveTo(-radius * .75,radius * .18);
    ctx.lineTo(radius * .75,radius * .08);
    ctx.stroke();
  }
}


function drawPlanets(time) {

  for (const planet of planetStates) {
    if (planet.visibility <= .001) continue;

    const x = X(planet.x);
    const y = Y(planet.y);
    const radius = planet.displayRadius;
    const pulse = .94 + Math.sin(time * .0007 + planet.radius) * .06;

    if (photoScene.active) {
      if (!photoScene.isSky(x,y,W,H)) continue;
      ctx.save();
      ctx.globalAlpha = planet.visibility;
      ctx.fillStyle = planet.colors[0];
      ctx.shadowColor = planet.colors[0];
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(x,y,.6 + planet.brightness * .7,0,Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.translate(x,y);
    ctx.globalAlpha = planet.visibility;
    ctx.shadowColor = planet.colors[0];
    ctx.shadowBlur = 4 + planet.brightness * 6;

    if (planet.rings || planet.thinRings) {
      ctx.save();
      ctx.rotate(-.28);
      ctx.strokeStyle = planet.rings ? "#dec48d" : "#9dd9df";
      ctx.lineWidth = planet.rings
        ? Math.max(1.15,radius * .27)
        : Math.max(.55,radius * .10);
      ctx.globalAlpha *= planet.rings ? .78 : .42;
      ctx.beginPath();
      ctx.ellipse(0,0,radius * (planet.rings ? 1.82 : 1.52),radius * .48,0,0,Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowBlur = 5 + planet.brightness * 5;
    drawPlanetSphere(planet,radius * pulse);
    ctx.shadowBlur = 0;
    drawPlanetDetails(planet,radius * pulse);

    const nearbyWeight =
      nearbyPlanetWeights.get(planet.id) || 0;

    if (nearbyWeight) {
      ctx.globalAlpha =
        planet.visibility *
        (.16 + nearbyWeight * .54);

      ctx.strokeStyle =
        planet.colors[0];

      ctx.lineWidth =
        .65 + nearbyWeight * .45;

      ctx.beginPath();
      ctx.arc(
        0,
        0,
        radius +
          (planet.rings ? 9 : 6) +
          (1 - nearbyWeight) * 3,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    if (hoveredPlanet && hoveredPlanet.id === planet.id) {
      ctx.globalAlpha = planet.visibility * .78;
      ctx.strokeStyle = "rgba(238,246,255,.94)";
      ctx.lineWidth = .85;
      ctx.beginPath();
      ctx.arc(0,0,radius + (planet.rings ? 9 : 6),0,Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}


function drawStars(time) {

  const visibility =
    celestialState.starVisibility;

  if (
    visibility <= .001
  ) {

    return;
  }

  ctx.save();


  for (
    let index = 0;
    index < starScreenPositions.length;
    index++
  ) {

    const star =
      starScreenPositions[index];

    if (
      star.horizonVisibility <= .001
    ) {

      continue;
    }

    const pulse =
      .5 +
      Math.sin(
        time * star.speed +
        star.phase
      ) * .5;

    const brightness =
      .55 +
      Math.pow(pulse, 2.4) * .45;

    const x =
      X(star.x);

    const y =
      Y(star.y);

    const radius =
      clamp(
        2.28 -
        (star.magnitude + 1.5) * .34,
        .42,
        2.28
      ) *
      (.82 + pulse * .28);

    const luminosity =
      clamp(
        1.06 -
        (star.magnitude + 1.46) * .125,
        .30,
        1
      );

    const starColor =
      spectralColors[star.spectralClass] ||
      spectralColors.F;


    ctx.globalAlpha =
      brightness *
      visibility *
      star.horizonVisibility *
      luminosity;

    ctx.fillStyle =
      starColor;

    ctx.shadowColor =
      starColor;

    ctx.shadowBlur =
      clamp(
        (2.15 - star.magnitude) * 3.4,
        0,
        12
      ) *
      visibility;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      radius,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.shadowBlur =
      0;


    const nearbyWeight =
      star.name
        ? nearbyStarWeights.get(star.name)
        : 0;

    if (
      nearbyWeight
    ) {

      ctx.globalAlpha =
        visibility *
        star.horizonVisibility *
        (.16 + nearbyWeight * .54);

      ctx.strokeStyle =
        starColor;

      ctx.lineWidth =
        .65 + nearbyWeight * .45;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        radius + 5.5 +
        (1 - nearbyWeight) * 3,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }


    if (
      star.magnitude < .8
    ) {

      ctx.globalAlpha =
        visibility *
        star.horizonVisibility *
        luminosity *
        (.68 + pulse * .25);

      ctx.fillStyle =
        "rgba(255,255,255,.96)";

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        Math.max(.55,radius * .42),
        0,
        Math.PI * 2
      );

      ctx.fill();
    }


    if (
      hoveredStar &&
      hoveredStar.name === star.name
    ) {

      ctx.globalAlpha =
        visibility *
        star.horizonVisibility * .55;

      ctx.strokeStyle =
        "rgba(231,241,255,.92)";

      ctx.lineWidth =
        .8;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        radius + 5,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }


    if (
      star.magnitude < 1.7 &&
      pulse > .58
    ) {

      ctx.globalAlpha =
        brightness *
        visibility *
        star.horizonVisibility * .42;

      ctx.strokeStyle =
        starColor;

      ctx.lineWidth =
        .7;

      ctx.beginPath();

      ctx.moveTo(
        x - radius * 3.1,
        y
      );

      ctx.lineTo(
        x + radius * 3.1,
        y
      );

      ctx.moveTo(
        x,
        y - radius * 3.1
      );

      ctx.lineTo(
        x,
        y + radius * 3.1
      );

      ctx.stroke();
    }
  }


  ctx.restore();
}


// In the photograph the station is a bright point with two short panels along
// its direction of motion and a small label: recognisable, yet as discreet as
// the sky around it. The drawn icon of drawIss would dominate the panorama.
function drawPhotoIss() {
  if (issState.visibility <= .001) return;
  const x = X(issState.x), y = Y(issState.y);
  ctx.save();
  ctx.globalAlpha = issState.visibility;
  ctx.translate(x,y);
  ctx.rotate(issState.angle);
  ctx.strokeStyle = "rgba(186,214,240,.95)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-7,0); ctx.lineTo(-3,0);
  ctx.moveTo(3,0); ctx.lineTo(7,0);
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.shadowColor = "rgba(214,232,255,.95)";
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.arc(0,0,1.9,0,Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  if (issHovered) {
    // The open card covers the label; the ring marks the station instead.
    ctx.strokeStyle = "rgba(210,232,255,.8)";
    ctx.lineWidth = .9;
    ctx.beginPath();
    ctx.arc(x,y,12,0,Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.globalAlpha = issState.visibility * .82;
    ctx.fillStyle = "#e9f3ff";
    ctx.font = "600 7px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("ISS",x + 6,y - 3);
  }
  ctx.restore();
}


function drawPeakHotspot(time) {

  if (peakProximities.size === 0) return;

  for (const peak of peakStates) {
    const proximity =
      peakProximities.get(peak.id) || 0;

    if (proximity <= .001) continue;

    const x = X(peak.x);
    const y = Y(peak.y);
    const pulse = peakHovered?.id === peak.id
      ? 1 + Math.sin(time * .004) * .10
      : 1;

    ctx.save();
    ctx.globalAlpha = proximity;
    ctx.shadowColor = celestialState.daylight > .45
      ? "rgba(79,62,38,.46)"
      : "rgba(214,232,255,.72)";
    ctx.shadowBlur = 7;
    ctx.fillStyle = celestialState.daylight > .45
      ? "rgba(255,244,207,.96)"
      : "rgba(224,238,255,.96)";
    ctx.strokeStyle = celestialState.daylight > .45
      ? "rgba(75,57,36,.72)"
      : "rgba(12,28,53,.76)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x,y,3.2 * pulse,0,Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}


// Photographic mode shares the original clock, location and celestial catalog.

function updatePhotoPeaks() {
  const rect = photoScene.layout(W,H);
  // Summit positions transferred from the user’s marked panorama.
  const points = { furchetta: [638,166], "sass-rigais": [731.840788,171.220622] };
  peakStates.forEach(peak => {
    const [x,y] = points[peak.id];
    peak.x = (rect.x + x * rect.scale) / W;
    peak.y = (rect.y + y * rect.scale) / H;
  });
}

function updatePhotoReadout() {
  const en = currentLanguage === "en";
  if (photoScene.active) {
    const description = en
      ? "Photographic Odle landscape with calculated sun position and light changing with the time of day"
      : "Paesaggio fotografico delle Odle con posizione del sole calcolata e luce che cambia con l’ora";
    canvas.setAttribute("aria-label",description);
    canvas.title = description;
  }
}

window.addEventListener("photo-scene-ready",() => updateAstronomy(true));
window.addEventListener("resize",() => {
  if (photoScene.active) {
    photoScene.drawWinterWeather(ctx,W,H,cloudTime,celestialState,{
      ...photoLifeOptions, reducedMotion:reducedMotion.matches
    });
    updatePhotoPeaks();
    updateAstronomy(true);
  }
});

// ============================================================
// ANIMATION
// ============================================================

let last =
  performance.now();

let cloudTime =
  0;


// Sways the valley mist, only while the clock runs at real speed: with the
// time sped up, paused or rewound the mist stays still. The clouds in the sky
// are part of the photo and never move. Kept separate from cloudTime, which
// paces the star twinkle, the forest sway and the rest of the idle motion.
let mistDrift =
  0;


function frame(now) {

  const delta =
    Math.min(
      now - last,
      40
    );


  last =
    now;


  updateAstronomy();


  const timeRate =
    followRealTime
      ? 1
      : playbackRate;


  // "Reduce motion" is aimed at ambient movement, so the idle drift and the
  // twinkle stay frozen under it.
  if (
    !reducedMotion.matches
  ) {

    cloudTime +=
      delta * 1.25;

    pointerWind *=
      Math.pow(
        .985,
        delta / 20.004
      );

  }


  if (
    !reducedMotion.matches &&
    timeRate === 1
  ) {

    mistDrift +=
      delta * 1.25;
  }


  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  if (photoScene.active) {
    photoScene.drawBase(ctx,W,H,DPR,celestialState,photoLifeOptions.season);
    ctx.save();
    photoScene.clipSky(ctx,W,H);
    drawStars(cloudTime);
    drawPlanets(cloudTime);
    drawPhotoIss();
    ctx.restore();
    photoScene.drawSun(ctx,W,H,celestialState);
    photoScene.drawMoon(ctx,W,H,celestialState,moonPhasePath);
    photoScene.drawOvercast(ctx,W,H,celestialState,photoLifeOptions);
    moonLandingState.visible = false;
    photoLife.frame(ctx,photoScene,W,H,celestialState,{
      ...photoLifeOptions, now, animationTime:cloudTime, language:currentLanguage,
      reducedMotion:reducedMotion.matches
    });
    photoScene.drawMist(ctx,W,H,mistDrift,celestialState);
    photoScene.drawWinterWeather(ctx,W,H,cloudTime,celestialState,{
      ...photoLifeOptions, reducedMotion:reducedMotion.matches
    });
    updatePhotoPeaks();
    drawPeakHotspot(cloudTime);
  } else {
    ctx.fillStyle = "#102235";
    ctx.fillRect(0,0,W,H);
  }

  hooks.frame();


  requestAnimationFrame(
    frame
  );
}


// ============================================================
// SCENE HOOKS AND START
// ============================================================

// Engine side: the page around the scene plugs its readouts in here; without
// a page (the screen saver) they do nothing.
const hooks = {
  astronomy() {},
  planets() {},
  iss() {},
  frame() {}
};

function startScene() {
  updateAstronomy(true);
  requestAnimationFrame(frame);
}

// What the page around the scene can use. The state is exposed through
// accessors, so assignments reach the engine's own variables.
window.odleScene = {
  X,
  Y,
  canvas,
  coordinateTimeZone,
  hooks,
  issHorizontalPosition,
  peakStates,
  previewParameters,
  previewTimeMilliseconds,
  projectCelestialBody,
  reducedMotion,
  startScene,
  updateAstronomy,
  get H() { return H; }, set H(value) { H = value; },
  get W() { return W; }, set W(value) { W = value; },
  get celestialState() { return celestialState; }, set celestialState(value) { celestialState = value; },
  get currentLanguage() { return currentLanguage; }, set currentLanguage(value) { currentLanguage = value; },
  get followRealTime() { return followRealTime; }, set followRealTime(value) { followRealTime = value; },
  get hoveredPlanet() { return hoveredPlanet; }, set hoveredPlanet(value) { hoveredPlanet = value; },
  get hoveredStar() { return hoveredStar; }, set hoveredStar(value) { hoveredStar = value; },
  get issHovered() { return issHovered; }, set issHovered(value) { issHovered = value; },
  get issState() { return issState; }, set issState(value) { issState = value; },
  get moonLandingState() { return moonLandingState; }, set moonLandingState(value) { moonLandingState = value; },
  get nearbyPlanetWeights() { return nearbyPlanetWeights; }, set nearbyPlanetWeights(value) { nearbyPlanetWeights = value; },
  get nearbyStarWeights() { return nearbyStarWeights; }, set nearbyStarWeights(value) { nearbyStarWeights = value; },
  get nextAstronomyUpdate() { return nextAstronomyUpdate; }, set nextAstronomyUpdate(value) { nextAstronomyUpdate = value; },
  get observer() { return observer; }, set observer(value) { observer = value; },
  get peakHovered() { return peakHovered; }, set peakHovered(value) { peakHovered = value; },
  get peakProximities() { return peakProximities; }, set peakProximities(value) { peakProximities = value; },
  get photoLifeOptions() { return photoLifeOptions; }, set photoLifeOptions(value) { photoLifeOptions = value; },
  get planetStates() { return planetStates; }, set planetStates(value) { planetStates = value; },
  get playbackRate() { return playbackRate; }, set playbackRate(value) { playbackRate = value; },
  get pointerWind() { return pointerWind; }, set pointerWind(value) { pointerWind = value; },
  get simulationLastRealMilliseconds() { return simulationLastRealMilliseconds; }, set simulationLastRealMilliseconds(value) { simulationLastRealMilliseconds = value; },
  get simulationTimeMilliseconds() { return simulationTimeMilliseconds; }, set simulationTimeMilliseconds(value) { simulationTimeMilliseconds = value; },
  get solarEventsCache() { return solarEventsCache; }, set solarEventsCache(value) { solarEventsCache = value; },
  get starScreenPositions() { return starScreenPositions; }, set starScreenPositions(value) { starScreenPositions = value; }
};

})();
