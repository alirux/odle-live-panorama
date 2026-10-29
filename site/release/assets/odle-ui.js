/* The site's interface around the Odle scene: status panel, tooltips,
 * time and place controls, globe, language, fullscreen and the idle fade of
 * the panels. The scene itself is core/assets/odle-scene.js; this file only
 * talks to it through window.odleScene. */
(() => {

const scene = window.odleScene;

const {
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
  updateAstronomy
} = scene;

const {
  DEG,
  RAD,
  clamp,
  moonPhaseSvgPath,
  normalizeSignedDegrees,
  smoothstep,
  sunPosition,
  zonedDateTimeMilliseconds,
  zonedDateTimeValue
} = OdleAstronomy;

const skyStatus =
  document.querySelector("#sky-status");


const issStatus =
  document.querySelector("#iss-status");

const planetStatus =
  document.querySelector("#planet-status");

const statusDate =
  document.querySelector("#status-date");

const statusTime =
  document.querySelector("#status-time");

const statusTimezone =
  document.querySelector("#status-timezone");

const statusSunrise =
  document.querySelector("#status-sunrise");

const statusSunset =
  document.querySelector("#status-sunset");

const statusMoonPhaseWrap =
  document.querySelector("#status-moon-phase-wrap");

const statusMoonPhase =
  document.querySelector("#status-moon-phase");

const statusCoordinates =
  document.querySelector("#status-coordinates");

const starTooltip =
  document.querySelector("#star-tooltip");

const starTooltipName =
  document.querySelector("#star-tooltip-name");

const starTooltipType =
  document.querySelector("#star-tooltip-type");

const starTooltipDistance =
  document.querySelector("#star-tooltip-distance");

const issTooltip =
  document.querySelector("#iss-tooltip");

const issTooltipDistance =
  document.querySelector("#iss-tooltip-distance");

const planetTooltip =
  document.querySelector("#planet-tooltip");

const planetTooltipName =
  document.querySelector("#planet-tooltip-name");

const planetTooltipType =
  document.querySelector("#planet-tooltip-type");

const planetTooltipDistance =
  document.querySelector("#planet-tooltip-distance");

const planetTooltipSunDistance =
  document.querySelector("#planet-tooltip-sun-distance");

const planetTooltipDiameter =
  document.querySelector("#planet-tooltip-diameter");

const planetTooltipYear =
  document.querySelector("#planet-tooltip-year");

const moonLandingTooltip =
  document.querySelector("#moon-landing-tooltip");

const peakTooltip =
  document.querySelector("#peak-tooltip");

const peakTooltipName =
  document.querySelector("#peak-tooltip-name");

const peakTooltipElevation =
  document.querySelector("#peak-tooltip-elevation");

const simulationControls =
  document.querySelector("#simulation-controls");

const introPanel =
  document.querySelector("#intro-panel");

const introToggle =
  document.querySelector("#intro-toggle");

const scenePanel =
  document.querySelector("#scene-panel");


const sceneForm =
  document.querySelector("#scene-form");

const controlCancel =
  document.querySelector("#control-cancel");

const controlDatetime =
  document.querySelector("#control-datetime");

const controlLatitude =
  document.querySelector("#control-latitude");

const controlLongitude =
  document.querySelector("#control-longitude");

const coordinateGlobe =
  document.querySelector("#coordinate-globe");

const coordinateGlobeContext =
  coordinateGlobe.getContext("2d");

const knownLocation =
  document.querySelector("#known-location");

const controlRewind =
  document.querySelector("#control-rewind");

const controlPause =
  document.querySelector("#control-pause");

const controlForward =
  document.querySelector("#control-forward");

const controlNow =
  document.querySelector("#control-now");

const controlScene =
  document.querySelector("#control-scene");

const controlLanguage =
  document.querySelector("#intro-language");

const languageLabel =
  document.querySelector("#intro-language-label");

const controlGeolocate =
  document.querySelector("#control-geolocate");

const introPrivacy =
  document.querySelector("#intro-privacy");

const introHelp =
  document.querySelector("#intro-help");

const geolocateNote =
  document.querySelector("#geolocate-note");

const geolocatePrivacy =
  document.querySelector("#geolocate-privacy");

const controlFullscreen =
  document.querySelector("#control-fullscreen");

const sceneCompass =
  document.querySelector("#scene-compass");

const compassWest =
  document.querySelector("#compass-west");


let pointerX =
  -10000;

let pointerY =
  -10000;

let pointerDirection =
  1;

let moonLandingHovered =
  false;

const CELESTIAL_NEARBY_RADIUS =
  92;

let pointerAllowsStarHover =
  true;

let touchPinnedTooltipKey =
  null;

let touchHitTesting =
  false;

let touchStart =
  null;


function tooltipKey() {
  if (photoLife.key()) return photoLife.key();
  if (scene.hoveredStar) return `star:${scene.hoveredStar.name}`;
  if (scene.issHovered) return "iss";
  if (scene.hoveredPlanet) return `planet:${scene.hoveredPlanet.id}`;
  if (moonLandingHovered) return "moon-landing";
  if (scene.peakHovered) return `peak:${scene.peakHovered.id}`;
  return null;
}


function hideAllInteractiveTooltips() {
  photoLife.hide();
  hideStarTooltip();
  hideIssTooltip();
  hidePlanetTooltip();
  hideMoonLandingTooltip();
  hidePeakTooltip();
}


function updateInteractiveTooltips(clientX,clientY) {
  updateStarHover(clientX,clientY);
  updateIssHover(clientX,clientY);
  updatePlanetHover(clientX,clientY);
  updateMoonLandingHover(clientX,clientY);
  updatePeakHover(clientX,clientY);
  updatePhotoLifeHover(clientX,clientY);
}

function updatePhotoLifeHover(clientX,clientY) {
  if (document.activeElement?.matches(".photo-life-target:focus-visible")) return;
  photoLife.hover(clientX,clientY,touchHitTesting,pointerAllowsStarHover);
  if (photoLife.key()) {
    hideStarTooltip(); hideIssTooltip(); hidePlanetTooltip();
    hideMoonLandingTooltip(); hidePeakTooltip();
  }
}


// Keeps the tooltip pinned to the same object while stars, planets,
// the ISS and the Moon move. The pin keeps the identity, not the old
// finger coordinates; it is released only when the object is no longer visible.
function refreshTouchPinnedTooltip() {

  const pinnedKey =
    touchPinnedTooltipKey;

  if (!pinnedKey) return;

  let refresh =
    null;

  if (pinnedKey.startsWith("photo:")) {
    const id = pinnedKey.slice(6);
    if (photoLife.point(id)) refresh = () => photoLife.show(id);
  } else if (pinnedKey.startsWith("star:")) {
    const name = pinnedKey.slice(5);
    const star = scene.starScreenPositions.find(item => item.name === name);
    if (star) refresh = () => updateStarHover(X(star.x),Y(star.y));
  } else if (pinnedKey === "iss") {
    refresh = () => updateIssHover(X(scene.issState.x),Y(scene.issState.y));
  } else if (pinnedKey.startsWith("planet:")) {
    const id = pinnedKey.slice(7);
    const planet = scene.planetStates.find(item => item.id === id);
    if (planet) refresh = () => updatePlanetHover(X(planet.x),Y(planet.y));
  } else if (pinnedKey === "moon-landing") {
    refresh = () => updateMoonLandingHover(
      scene.moonLandingState.x,
      scene.moonLandingState.y
    );
  } else if (pinnedKey.startsWith("peak:")) {
    const id = pinnedKey.slice(5);
    const peak = peakStates.find(item => item.id === id);
    if (peak) refresh = () => updatePeakHover(X(peak.x),Y(peak.y));
  }

  if (!refresh) {
    touchPinnedTooltipKey = null;
    hideAllInteractiveTooltips();
    return;
  }

  const previousPointerPermission =
    pointerAllowsStarHover;

  pointerAllowsStarHover = true;
  touchHitTesting = true;

  try {
    refresh();
  } finally {
    touchHitTesting = false;
    pointerAllowsStarHover = previousPointerPermission;
  }

  if (tooltipKey() !== pinnedKey) {
    touchPinnedTooltipKey = null;
  }
}


window.addEventListener(
  "pointermove",
  event => {

    const movement =
      Math.hypot(
        event.movementX || 0,
        event.movementY || 0
      );


    pointerX =
      event.clientX;

    pointerY =
      event.clientY;

    pointerAllowsStarHover =
      !(
        event.target instanceof Element &&
        event.target.closest(
          ".intro, .sky-status, .star-tooltip, .simulation-controls"
        )
      );

    if (event.pointerType !== "touch") {
      touchPinnedTooltipKey = null;
      updateInteractiveTooltips(
        event.clientX,
        event.clientY
      );
    }


    if (
      Math.abs(event.movementX) > 1
    ) {

      pointerDirection =
        Math.sign(event.movementX);
    }


    if (
      !reducedMotion.matches &&
      pointerAllowsStarHover
    ) {

      scene.pointerWind =
        Math.max(
          scene.pointerWind,
          .42 +
          Math.min(1, movement / 30) * .58
        );
    }
  },
  { passive:true }
);


window.addEventListener(
  "pointerdown",
  event => {
    if (event.pointerType !== "touch") return;

    touchStart = {
      pointerId:event.pointerId,
      x:event.clientX,
      y:event.clientY
    };
  },
  { passive:true }
);


window.addEventListener(
  "pointerup",
  event => {
    if (
      event.pointerType !== "touch" ||
      !touchStart ||
      touchStart.pointerId !== event.pointerId
    ) return;

    const moved = Math.hypot(
      event.clientX - touchStart.x,
      event.clientY - touchStart.y
    );

    touchStart = null;

    if (moved > 14) return;

    pointerAllowsStarHover =
      !(
        event.target instanceof Element &&
        event.target.closest(
          ".intro, .sky-status, .star-tooltip, .simulation-controls"
        )
      );

    if (!pointerAllowsStarHover) return;

    pointerX = event.clientX;
    pointerY = event.clientY;

    const previousKey =
      touchPinnedTooltipKey;

    hideAllInteractiveTooltips();

    touchHitTesting = true;
    updateInteractiveTooltips(
      event.clientX,
      event.clientY
    );
    touchHitTesting = false;

    const nextKey = tooltipKey();

    if (nextKey && nextKey === previousKey) {
      hideAllInteractiveTooltips();
      touchPinnedTooltipKey = null;
      return;
    }

    touchPinnedTooltipKey = nextKey;
  },
  { passive:true }
);


window.addEventListener(
  "pointercancel",
  event => {
    if (
      touchStart &&
      touchStart.pointerId === event.pointerId
    ) {
      touchStart = null;
    }
  },
  { passive:true }
);


window.addEventListener(
  "pointerleave",
  () => {

    if (touchPinnedTooltipKey) return;

    pointerX =
      -10000;

    pointerY =
      -10000;

    hideAllInteractiveTooltips();
  }
);


function mixColor(
  from,
  to,
  amount,
  alpha = 1
) {

  const t =
    clamp(amount, 0, 1);

  const values =
    from.map(
      (value, index) =>
        Math.round(
          value +
          (to[index] - value) * t
        )
    );

  return `rgba(${values[0]},${values[1]},${values[2]},${alpha})`;
}

function mixColorValues(from,to,amount) {
  const t = clamp(amount,0,1);
  return from.map(
    (value,index) => Math.round(value + (to[index] - value) * t)
  );
}

function sunsetDirectionBias() {
  return smoothstep(
    .08,
    .82,
    clamp(-Math.sin(scene.celestialState.sunAzimuth),0,1)
  );
}

const interfaceText = {
  it:{
    pageTitle:"Home Page di Lirux",
    welcome:"Benvenuto",
    tagline:"Uno spazio <em>interattivo</em> tra montagne, stelle e... codice",
    links:"Collegamenti",
    projectsLabel:"Guarda i miei progetti", aboutLabel:"Chi sono", licence:"Licenza",
    collapsePanel:"Riduci il pannello", expandPanel:"Mostra il pannello",
    useMyLocation:"Usa la mia posizione",
    locationFailed:"Posizione non disponibile. Inseriscila a mano o scegli il punto sul mappamondo.",
    help:"Aiuto",
    privacy:"Privacy",
    locationNote:"Serve solo a calcolare il cielo dal tuo punto di vista. Resta nel browser e non viene condivisa con nessuno.",
    enterFullscreen:"Schermo intero", exitFullscreen:"Esci da schermo intero",
    controls:"Controlli della simulazione",
    compass:"Bussola prospettica: la scena guarda verso sud",
    landscape:"Paesaggio interattivo: gli abeti oscillano al vento e reagiscono al movimento del puntatore",
    dateTime:"Data e ora", applyDateTime:"Imposta data e ora",
    scenePanel:"Quando e dove", applyScene:"Applica data, ora e coordinate",
    cancelScene:"Annulla e chiudi",
    globe:"Mappamondo interattivo: trascina per ruotare e seleziona un punto",
    globeHint:"trascina · seleziona", knownLocations:"Località note",
    chooseLocation:"Seleziona una località…",
    latitude:"Latitudine", longitude:"Longitudine", applyCoordinates:"Imposta coordinate",
    rewind:"Indietro veloce", pause:"Pausa", resume:"Riprendi", forward:"Avanti veloce",
    realtimeRate:"Continua da questo istante alla velocità reale",
    now:"Torna al tempo attuale e ripristina lo scorrimento del tempo reale",
    switchLanguage:"Switch to English", sunrise:"Alba", sunset:"Tramonto", timeZone:"Fuso orario della località",
    type:"Tipo", distance:"Distanza", altitude:"Quota", period:"Periodo",
    inclination:"Inclinazione", speed:"Velocità", fromEarth:"Dalla Terra",
    fromSun:"Dal Sole", diameter:"Diametro", year:"Anno", mission:"Missione",
    place:"Luogo", landing:"Allunaggio", coordinates:"Coordinate", height:"Altezza",
    issName:"Stazione Spaziale Internazionale", aboutAltitude:"circa 418 km",
    issPeriod:"92,97 minuti", aboutSpeed:"circa 27.600 km/h",
    tranquilitySea:"Mare della Tranquillità", landingDate:"20 luglio 1969",
    landingCoordinates:"0,674° N · 23,473° E",
    visiblePlanets:"Pianeti visibili", noPlanets:"Nessun pianeta sopra l'orizzonte nel cielo scuro",
    issVisible:"ISS visibile, distanza", issBelow:"ISS sotto l'orizzonte",
    millionKm:"milioni di km", lightYears:"anni luce",
    phaseLabels:["Luna nuova","Falce crescente","Primo quarto","Gibbosa crescente","Luna piena","Gibbosa calante","Ultimo quarto","Falce calante"],
    continentLabels:["Nord America","Sud America","Europa","Africa","Asia","Australia"]
  },
  en:{
    pageTitle:"Lirux's Home Page",
    welcome:"Welcome",
    tagline:"An <em>interactive</em> space among mountains, stars and... code",
    links:"Links",
    projectsLabel:"Have a look at my projects", aboutLabel:"About me", licence:"Licence",
    collapsePanel:"Minimise the panel", expandPanel:"Show the panel",
    useMyLocation:"Use my location",
    locationFailed:"Location unavailable. Enter it by hand or pick the point on the globe.",
    help:"Help",
    privacy:"Privacy",
    locationNote:"Only used to work out the sky from where you are. It stays in your browser and is shared with nobody.",
    enterFullscreen:"Full screen", exitFullscreen:"Leave full screen",
    controls:"Simulation controls",
    compass:"Perspective compass: the scene faces south",
    landscape:"Interactive landscape: fir trees sway in the wind and respond to pointer movement",
    dateTime:"Date and time", applyDateTime:"Set date and time",
    scenePanel:"When and where", applyScene:"Apply date, time and coordinates",
    cancelScene:"Cancel and close",
    globe:"Interactive globe: drag to rotate and select a point",
    globeHint:"drag · select", knownLocations:"Known locations",
    chooseLocation:"Choose a location…",
    latitude:"Latitude", longitude:"Longitude", applyCoordinates:"Set coordinates",
    rewind:"Fast rewind", pause:"Pause", resume:"Resume", forward:"Fast forward",
    realtimeRate:"Continue from this instant at real-time speed",
    now:"Return to the current time and restore real-time flow",
    switchLanguage:"Passa all’italiano", sunrise:"Sunrise", sunset:"Sunset", timeZone:"Location time zone",
    type:"Type", distance:"Distance", altitude:"Altitude", period:"Period",
    inclination:"Inclination", speed:"Speed", fromEarth:"From Earth",
    fromSun:"From the Sun", diameter:"Diameter", year:"Year", mission:"Mission",
    place:"Location", landing:"Landing", coordinates:"Coordinates", height:"Elevation",
    issName:"International Space Station", aboutAltitude:"about 418 km",
    issPeriod:"92.97 minutes", aboutSpeed:"about 27,600 km/h",
    tranquilitySea:"Sea of Tranquility", landingDate:"20 July 1969",
    landingCoordinates:"0.674° N · 23.473° E",
    visiblePlanets:"Visible planets", noPlanets:"No planets above the horizon in the dark sky",
    issVisible:"ISS visible, distance", issBelow:"ISS below the horizon",
    millionKm:"million km", lightYears:"light-years",
    phaseLabels:["New moon","Waxing crescent","First quarter","Waxing gibbous","Full moon","Waning gibbous","Last quarter","Waning crescent"],
    continentLabels:["North America","South America","Europe","Africa","Asia","Australia"]
  }
};

function text(key) {
  return interfaceText[scene.currentLanguage][key];
}

function interfaceLocale() {
  return scene.currentLanguage === "en" ? "en-GB" : "it-IT";
}

function setButtonLabel(button,label) {
  button.title = label;
  button.setAttribute("aria-label",label);
}

function setTooltipLabels(tooltip,labels) {
  tooltip.querySelectorAll(".star-tooltip-label").forEach((element,index) => {
    if (labels[index]) element.textContent = labels[index];
  });
}

function peakElevationLabel(elevation) {
  const separator = scene.currentLanguage === "en" ? "," : ".";
  return `${Math.round(elevation)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g,separator)} m`;
}

const knownLocationNames = {
  "46.6419,11.7187":{it:"Val di Funes",en:"Val di Funes"},
  "45.4642,9.1900":{it:"Milano",en:"Milan"},
  "52.3676,4.9041":{it:"Amsterdam",en:"Amsterdam"},
  "37.9838,23.7275":{it:"Atene",en:"Athens"},
  "44.7866,20.4489":{it:"Belgrado",en:"Belgrade"},
  "52.5200,13.4050":{it:"Berlino",en:"Berlin"},
  "46.9480,7.4474":{it:"Berna",en:"Bern"},
  "50.8476,4.3572":{it:"Bruxelles",en:"Brussels"},
  "44.4268,26.1025":{it:"Bucarest",en:"Bucharest"},
  "47.4979,19.0402":{it:"Budapest",en:"Budapest"},
  "-33.9249,18.4241":{it:"Città del Capo",en:"Cape Town"},
  "55.6761,12.5683":{it:"Copenaghen",en:"Copenhagen"},
  "-23.0234,-67.7538":{it:"Deserto di Atacama",en:"Atacama Desert"},
  "53.3498,-6.2603":{it:"Dublino",en:"Dublin"},
  "60.1699,24.9384":{it:"Helsinki",en:"Helsinki"},
  "33.6844,73.0479":{it:"Islamabad",en:"Islamabad"},
  "50.4501,30.5234":{it:"Kiev",en:"Kyiv"},
  "38.7223,-9.1393":{it:"Lisbona",en:"Lisbon"},
  "51.5074,-0.1278":{it:"Londra",en:"London"},
  "34.0522,-118.2437":{it:"Los Angeles",en:"Los Angeles"},
  "40.4168,-3.7038":{it:"Madrid",en:"Madrid"},
  "19.8207,-155.4681":{it:"Mauna Kea",en:"Mauna Kea"},
  "40.7128,-74.0060":{it:"New York",en:"New York"},
  "28.6139,77.2090":{it:"Nuova Delhi",en:"New Delhi"},
  "59.9139,10.7522":{it:"Oslo",en:"Oslo"},
  "48.8566,2.3522":{it:"Parigi",en:"Paris"},
  "39.9042,116.4074":{it:"Pechino",en:"Beijing"},
  "50.0755,14.4378":{it:"Praga",en:"Prague"},
  "-0.1807,-78.4678":{it:"Quito",en:"Quito"},
  "64.1466,-21.9426":{it:"Reykjavík",en:"Reykjavík"},
  "41.9028,12.4964":{it:"Roma",en:"Rome"},
  "1.3521,103.8198":{it:"Singapore",en:"Singapore"},
  "59.3293,18.0686":{it:"Stoccolma",en:"Stockholm"},
  "-33.8688,151.2093":{it:"Sydney",en:"Sydney"},
  "35.6762,139.6503":{it:"Tokyo",en:"Tokyo"},
  "43.6532,-79.3832":{it:"Toronto",en:"Toronto"},
  "69.6492,18.9553":{it:"Tromsø",en:"Tromsø"},
  "-54.8019,-68.3030":{it:"Ushuaia",en:"Ushuaia"},
  "52.2297,21.0122":{it:"Varsavia",en:"Warsaw"},
  "48.2082,16.3738":{it:"Vienna",en:"Vienna"},
  "45.8150,15.9819":{it:"Zagabria",en:"Zagreb"}
};

function applyInterfaceLanguage() {
  document.documentElement.lang = scene.currentLanguage;
  document.title = text("pageTitle");
  document.querySelector(".intro h1").textContent = text("welcome");
  document.querySelector(".intro p").innerHTML = text("tagline");
  document.querySelector(".intro-links").setAttribute("aria-label",text("links"));
  setButtonLabel(introToggle,text(introPanel.classList.contains("is-collapsed") ? "expandPanel" : "collapsePanel"));
  simulationControls.setAttribute("aria-label",text("controls"));
  canvas.setAttribute("aria-label",text("landscape"));
  canvas.title = text("landscape");
  sceneCompass.setAttribute("aria-label",text("compass"));
  compassWest.textContent = scene.currentLanguage === "en" ? "W" : "O";

  document.querySelector('label[for="control-datetime"]').textContent = text("dateTime");
  coordinateGlobe.setAttribute("aria-label",text("globe"));
  document.querySelector(".coordinate-globe-hint").textContent = text("globeHint");
  document.querySelector('label[for="known-location"]').textContent = text("knownLocations");
  controlGeolocate.textContent = text("useMyLocation");
  introPrivacy.href = scene.currentLanguage === "en" ? "/privacy.html?lang=en" : "/privacy.html";
  document.querySelector("#intro-help-label").textContent = text("help");
  const labels = document.querySelectorAll(".intro-links-label");
  labels[0].textContent = text("projectsLabel");
  labels[1].textContent = text("aboutLabel");
  const licenceLink = document.querySelector("#intro-licence");
  licenceLink.textContent = text("licence");
  licenceLink.href = scene.currentLanguage === "en" ? "/licence.html?lang=en" : "/licence.html";
  document.querySelector("#intro-version").title = scene.currentLanguage === "en" ? "Artistic version" : "Versione artistica";
  introHelp.href = scene.currentLanguage === "en" ? "/help.html?lang=en" : "/help.html";
  geolocateNote.textContent = text("locationNote");
  geolocatePrivacy.textContent = text("privacy");
  geolocatePrivacy.href = introPrivacy.href;
  setButtonLabel(controlFullscreen,text(isFullscreen() ? "exitFullscreen" : "enterFullscreen"));
  document.querySelector('label[for="control-latitude"]').textContent = text("latitude");
  document.querySelector('label[for="control-longitude"]').textContent = text("longitude");
  setButtonLabel(sceneForm.querySelector(".control-apply"),text("applyScene"));
  setButtonLabel(controlCancel,text("cancelScene"));

  Array.from(knownLocation.options).forEach(option => {
    option.textContent = option.value
      ? knownLocationNames[option.value][scene.currentLanguage]
      : text("chooseLocation");
  });

  setButtonLabel(controlRewind,text("rewind"));
  setButtonLabel(controlForward,text("forward"));
  setButtonLabel(controlNow,text("now"));
  setButtonLabel(controlScene,text("scenePanel"));
  setButtonLabel(controlLanguage,text("switchLanguage"));
  languageLabel.textContent = scene.currentLanguage === "en" ? "Italiano" : "English";

  setTooltipLabels(starTooltip,[text("type"),text("distance")]);
  issTooltip.querySelector("strong").textContent = text("issName");
  setTooltipLabels(issTooltip,[text("distance"),text("altitude"),text("period"),text("inclination"),text("speed")]);
  const issValues = issTooltip.querySelectorAll(".star-tooltip-row > span:last-child");
  issValues[1].textContent = text("aboutAltitude");
  issValues[2].textContent = text("issPeriod");
  issValues[4].textContent = text("aboutSpeed");
  setTooltipLabels(planetTooltip,[text("type"),text("fromEarth"),text("fromSun"),text("diameter"),text("year")]);
  setTooltipLabels(moonLandingTooltip,[text("mission"),text("place"),text("landing"),text("coordinates")]);
  setTooltipLabels(peakTooltip,[text("height")]);
  const labelledPeak = scene.peakHovered || peakStates[0];
  peakTooltipName.textContent = scene.currentLanguage === "en"
    ? labelledPeak.enName
    : labelledPeak.name;
  peakTooltipElevation.textContent =
    peakElevationLabel(labelledPeak.elevation);
  const landingValues = moonLandingTooltip.querySelectorAll(".star-tooltip-row > span:last-child");
  landingValues[1].textContent = text("tranquilitySea");
  landingValues[2].textContent = text("landingDate");
  landingValues[3].textContent = text("landingCoordinates");

  const solarEvents = document.querySelectorAll(".solar-event");
  solarEvents[0].title = text("sunrise");
  solarEvents[1].title = text("sunset");
  updateControlState();
  drawCoordinateGlobe();
}

let observerManuallySet =
  false;


function formatClockTime(date,timeZone) {

  return date
    ? date.toLocaleTimeString(
        interfaceLocale(),
        {
          timeZone,
          hour:"2-digit",
          minute:"2-digit",
          hour12:false
        }
      )
    : "—";
}


function applyInterfaceColors(daylight) {

  const root =
    document.documentElement;

  // The landscape colours stay continuous, but the interface
  // avoids the range of mid greys where text and panels
  // blended together at twilight.
  const interfaceDaylight =
    daylight >= .84 ? 1 : 0;

  const twilightContrast =
    clamp(
      scene.celestialState.twilight *
      (.62 + sunsetDirectionBias() * .38),
      0,
      1
    );

  const controlsBase =
    mixColorValues(
      [9,17,31],
      [255,255,255],
      interfaceDaylight
    );

  const controlsTextBase =
    mixColorValues(
      [238,243,244],
      [48,66,61],
      interfaceDaylight
    );

  root.style.setProperty(
    "--body-bg",
    mixColor(
      [8,16,30],
      [231,238,233],
      daylight
    )
  );

  root.style.setProperty(
    "--text-color",
    mixColor(
      [238,243,244],
      [48,66,61],
      interfaceDaylight
    )
  );

  root.style.setProperty(
    "--panel-bg",
    mixColor(
      [9,17,31],
      [255,255,255],
      interfaceDaylight,
      .58 - interfaceDaylight * .30
    )
  );

  root.style.setProperty(
    "--controls-bg",
    mixColor(
      controlsBase,
      [27,42,43],
      twilightContrast * .78,
      .58 - interfaceDaylight * .30 + twilightContrast * .18
    )
  );

  root.style.setProperty(
    "--controls-text",
    mixColor(
      controlsTextBase,
      [248,250,247],
      twilightContrast * .92
    )
  );

  root.style.setProperty(
    "--controls-border",
    mixColor(
      [222,233,244],
      [255,255,255],
      interfaceDaylight,
      .20 + interfaceDaylight * .32 + twilightContrast * .22
    )
  );

  root.style.setProperty(
    "--intro-panel-bg",
    mixColor(
      [9,17,31],
      [255,255,255],
      interfaceDaylight,
      .46 - interfaceDaylight * .28
    )
  );

  root.style.setProperty(
    "--panel-border",
    mixColor(
      [222,233,244],
      [255,255,255],
      interfaceDaylight,
      .20 + interfaceDaylight * .32
    )
  );

  root.style.setProperty(
    "--panel-shadow",
    mixColor(
      [0,5,17],
      [57,74,66],
      interfaceDaylight,
      .34 - interfaceDaylight * .27
    )
  );

  root.style.setProperty(
    "--status-text",
    mixColor(
      [232,240,247],
      [34,53,47],
      interfaceDaylight
    )
  );

  root.style.setProperty(
    "--status-bg",
    mixColor(
      [6,16,31],
      [250,252,246],
      interfaceDaylight,
      .55 + interfaceDaylight * .27
    )
  );

  root.style.setProperty(
    "--status-border",
    mixColor(
      [205,225,245],
      [255,255,255],
      interfaceDaylight,
      .20 + interfaceDaylight * .52
    )
  );

  root.style.setProperty(
    "--status-shadow",
    mixColor(
      [0,5,17],
      [35,52,45],
      interfaceDaylight,
      .32 - interfaceDaylight * .14
    )
  );
}


const globeContinents = [
  // Nord America
  [[-168,72],[-152,70],[-142,62],[-132,56],[-126,49],[-124,40],[-117,32],[-108,25],[-100,20],[-91,19],[-84,24],[-81,31],[-74,39],[-67,45],[-59,52],[-66,59],[-82,64],[-98,70],[-120,73],[-143,70]],
  // America centrale
  [[-100,20],[-91,19],[-86,16],[-83,10],[-79,8],[-77,12],[-84,18],[-92,22]],
  // Sud America
  [[-81,12],[-73,10],[-66,5],[-59,7],[-50,2],[-42,-2],[-35,-8],[-39,-19],[-45,-31],[-52,-44],[-61,-55],[-68,-50],[-71,-36],[-68,-24],[-76,-15],[-78,-2]],
  // Groenlandia
  [[-53,60],[-47,67],[-43,78],[-31,83],[-20,76],[-25,66],[-38,59]],
  // Penisola iberica
  [[-10,36],[-9,43],[-4,44],[1,43],[3,41],[3,36],[-2,36]],
  // Western and central Europe
  [[-5,44],[-5,49],[-2,51],[-4,55],[0,58],[5,55],[9,55],[13,54],[18,55],[23,53],[30,55],[36,51],[31,46],[25,44],[20,40],[15,42],[12,45],[8,44],[3,43]],
  // Gran Bretagna
  [[-6,50],[-5,55],[-7,58],[-3,59],[1,53],[-1,50]],
  // Irlanda
  [[-10,51],[-10,55],[-7,56],[-6,52]],
  // Islanda
  [[-24,64],[-22,67],[-14,67],[-13,64],[-19,63]],
  // Italia
  [[7,44],[9,46],[13,46],[13,43],[16,41],[18,40],[17,38],[15,38],[13,42],[10,43]],
  // Sicilia
  [[12,38],[15,38],[16,37],[13,36]],
  // Balkans and Greece
  [[14,46],[20,47],[27,45],[29,41],[24,38],[23,35],[21,37],[19,41],[16,42]],
  // Scandinavia
  [[5,57],[5,63],[8,69],[13,72],[18,70],[20,65],[24,60],[29,60],[31,67],[27,70],[20,72],[14,69],[16,60]],
  // Africa
  [[-17,36],[-7,37],[4,36],[15,35],[25,32],[34,30],[42,17],[51,11],[49,2],[43,-12],[36,-25],[27,-34],[17,-35],[11,-28],[7,-17],[0,-8],[-8,5],[-15,19]],
  // Asia
  [[30,42],[38,53],[32,62],[49,70],[69,75],[92,76],[113,72],[132,65],[151,59],[166,52],[162,44],[146,40],[136,34],[124,25],[120,16],[108,7],[96,10],[88,20],[75,24],[63,28],[53,36],[42,40]],
  // Penisola arabica
  [[35,30],[48,30],[57,23],[53,13],[44,12],[39,20]],
  // India
  [[67,25],[78,29],[89,22],[84,13],[77,7],[72,16]],
  // Indocina
  [[94,24],[108,22],[108,12],[103,2],[98,8]],
  // Giappone
  [[130,32],[136,35],[142,44],[146,45],[141,36],[135,31]],
  // Australia
  [[112,-11],[125,-12],[137,-11],[151,-19],[154,-29],[147,-39],[132,-43],[116,-35],[112,-24]],
  // Madagascar
  [[47,-13],[50,-18],[49,-27],[45,-25],[44,-17]],
  // Nuova Zelanda
  [[166,-35],[174,-41],[178,-47],[171,-45]],
  // Antarctica in two sectors to avoid the date line seam
  [[-180,-69],[-150,-72],[-120,-74],[-90,-72],[-60,-68],[-30,-72],[0,-74],[0,-90],[-180,-90]],
  [[0,-74],[35,-70],[70,-69],[105,-73],[140,-71],[180,-69],[180,-90],[0,-90]]
];

const globeContinentLabels = [
  [0,45,-105],
  [1,-18,-59],
  [2,52,15],
  [3,4,20],
  [4,47,90],
  [5,-25,135]
];

let globeViewLatitude = 0;
let globeViewLongitude = 0;
let globeDragging = false;
let globePointerId = null;
let globeLastX = 0;
let globeLastY = 0;
let globeDragDistance = 0;


function projectGlobePoint(
  latitude,
  longitude
) {

  const latitudeRadians = latitude * DEG;
  const viewLatitude = globeViewLatitude * DEG;
  const longitudeDelta =
    normalizeSignedDegrees(longitude - globeViewLongitude) * DEG;

  const cosLatitude = Math.cos(latitudeRadians);
  const sinLatitude = Math.sin(latitudeRadians);
  const cosViewLatitude = Math.cos(viewLatitude);
  const sinViewLatitude = Math.sin(viewLatitude);

  return {
    x:cosLatitude * Math.sin(longitudeDelta),
    y:
      cosViewLatitude * sinLatitude -
      sinViewLatitude * cosLatitude * Math.cos(longitudeDelta),
    z:
      sinViewLatitude * sinLatitude +
      cosViewLatitude * cosLatitude * Math.cos(longitudeDelta)
  };
}


function drawGlobeLine(
  points,
  centerX,
  centerY,
  radius,
  close = false,
  fill = false
) {

  const renderPoints = close
    ? densifyGlobePoints(points)
    : points;

  const projected = renderPoints.map(([longitude,latitude]) => {
    const point = projectGlobePoint(latitude,longitude);
    return {
      visible:point.z >= 0,
      x:centerX + point.x * radius,
      y:centerY - point.y * radius
    };
  });

  const hiddenIndex = projected.findIndex(point => !point.visible);

  coordinateGlobeContext.beginPath();

  if (!close) {
    let drawing = false;

    for (const point of projected) {
      if (!point.visible) {
        drawing = false;
        continue;
      }

      if (!drawing) {
        coordinateGlobeContext.moveTo(point.x,point.y);
        drawing = true;
      } else {
        coordinateGlobeContext.lineTo(point.x,point.y);
      }
    }

  } else if (hiddenIndex === -1) {
    projected.forEach((point,index) => {
      if (index === 0) {
        coordinateGlobeContext.moveTo(point.x,point.y);
      } else {
        coordinateGlobeContext.lineTo(point.x,point.y);
      }
    });
    coordinateGlobeContext.closePath();

  } else {
    let segment = [];

    const closeVisibleSegment = () => {
      if (segment.length < 2) {
        segment = [];
        return;
      }

      coordinateGlobeContext.moveTo(segment[0].x,segment[0].y);
      for (let index = 1; index < segment.length; index += 1) {
        coordinateGlobeContext.lineTo(segment[index].x,segment[index].y);
      }

      const first = segment[0];
      const last = segment[segment.length - 1];
      const startAngle = Math.atan2(first.y - centerY,first.x - centerX);
      const endAngle = Math.atan2(last.y - centerY,last.x - centerX);
      const signedArc =
        ((startAngle - endAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

      coordinateGlobeContext.arc(
        centerX,
        centerY,
        radius,
        endAngle,
        startAngle,
        signedArc < 0
      );
      coordinateGlobeContext.closePath();
      segment = [];
    };

    for (let offset = 1; offset <= projected.length; offset += 1) {
      const point = projected[(hiddenIndex + offset) % projected.length];

      if (point.visible) {
        segment.push(point);
      } else {
        closeVisibleSegment();
      }
    }

    closeVisibleSegment();
  }

  if (fill) coordinateGlobeContext.fill();
  coordinateGlobeContext.stroke();
}


function densifyGlobePoints(points) {

  const dense = [];

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const longitudeDelta = normalizeSignedDegrees(next[0] - current[0]);
    const latitudeDelta = next[1] - current[1];
    const steps = Math.max(
      2,
      Math.ceil(
        Math.max(
          Math.abs(longitudeDelta),
          Math.abs(latitudeDelta)
        ) / 3
      )
    );

    for (let step = 0; step < steps; step += 1) {
      const amount = step / steps;
      dense.push([
        normalizeSignedDegrees(current[0] + longitudeDelta * amount),
        current[1] + latitudeDelta * amount
      ]);
    }
  }

  return dense;
}


function drawCoordinateGlobe() {

  const globeContext = coordinateGlobeContext;
  const width = coordinateGlobe.width;
  const height = coordinateGlobe.height;
  const centerX = width * .5;
  const centerY = height * .47;
  const radius = Math.min(width,height) * .405;
  const daylight = scene.celestialState.daylight;

  globeContext.clearRect(0,0,width,height);
  globeContext.save();

  globeContext.shadowColor =
    `rgba(0,8,20,${.35 - daylight * .18})`;
  globeContext.shadowBlur = 24;
  globeContext.shadowOffsetY = 8;

  const ocean = globeContext.createRadialGradient(
    centerX - radius * .34,
    centerY - radius * .38,
    radius * .08,
    centerX,
    centerY,
    radius * 1.05
  );

  ocean.addColorStop(0,
    daylight > .5 ? "#b8d8df" : "#4a7191");
  ocean.addColorStop(.64,
    daylight > .5 ? "#6fa2ae" : "#244966");
  ocean.addColorStop(1,
    daylight > .5 ? "#3f7380" : "#102b47");

  globeContext.fillStyle = ocean;
  globeContext.beginPath();
  globeContext.arc(centerX,centerY,radius,0,Math.PI * 2);
  globeContext.fill();

  globeContext.shadowBlur = 0;
  globeContext.shadowOffsetY = 0;
  globeContext.beginPath();
  globeContext.arc(centerX,centerY,radius,0,Math.PI * 2);
  globeContext.clip();

  globeContext.strokeStyle =
    daylight > .5
      ? "rgba(245,252,248,.24)"
      : "rgba(216,235,255,.20)";
  globeContext.lineWidth = 1.1;

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const points = [];
    for (let longitude = -180; longitude <= 180; longitude += 4) {
      points.push([longitude,latitude]);
    }
    drawGlobeLine(points,centerX,centerY,radius);
  }

  for (let longitude = -150; longitude <= 180; longitude += 30) {
    const points = [];
    for (let latitude = -88; latitude <= 88; latitude += 3) {
      points.push([longitude,latitude]);
    }
    drawGlobeLine(points,centerX,centerY,radius);
  }

  const land = globeContext.createLinearGradient(
    0,
    centerY - radius,
    0,
    centerY + radius
  );

  if (daylight > .5) {
    land.addColorStop(0,"rgba(181,193,141,.96)");
    land.addColorStop(.48,"rgba(111,143,101,.96)");
    land.addColorStop(1,"rgba(82,119,91,.98)");
  } else {
    land.addColorStop(0,"rgba(126,145,119,.96)");
    land.addColorStop(.52,"rgba(77,112,96,.97)");
    land.addColorStop(1,"rgba(49,85,77,.98)");
  }

  globeContext.fillStyle = land;
  globeContext.strokeStyle =
    daylight > .5
      ? "rgba(231,239,210,.62)"
      : "rgba(181,210,190,.58)";
  globeContext.lineWidth = 1.7;

  for (const continent of globeContinents) {
    drawGlobeLine(continent,centerX,centerY,radius,true,true);
  }

  globeContext.save();
  globeContext.textAlign = "center";
  globeContext.textBaseline = "middle";
  globeContext.font =
    `600 ${Math.max(16,radius * .083)}px Inter, system-ui, sans-serif`;
  globeContext.fillStyle =
    daylight > .5
      ? "rgba(31,63,54,.70)"
      : "rgba(225,237,224,.65)";
  globeContext.shadowColor =
    daylight > .5
      ? "rgba(255,255,245,.72)"
      : "rgba(4,17,29,.76)";
  globeContext.shadowBlur = 3;

  for (const [labelIndex,latitude,longitude] of globeContinentLabels) {
    const point = projectGlobePoint(latitude,longitude);
    if (point.z < .30) continue;

    globeContext.fillText(
      text("continentLabels")[labelIndex],
      centerX + point.x * radius,
      centerY - point.y * radius
    );
  }

  globeContext.restore();

  const atmosphericRim = globeContext.createRadialGradient(
    centerX,
    centerY,
    radius * .68,
    centerX,
    centerY,
    radius
  );
  atmosphericRim.addColorStop(0,"rgba(220,242,255,0)");
  atmosphericRim.addColorStop(.78,"rgba(220,242,255,.02)");
  atmosphericRim.addColorStop(1,
    daylight > .5
      ? "rgba(230,250,255,.26)"
      : "rgba(174,218,248,.22)");
  globeContext.fillStyle = atmosphericRim;
  globeContext.beginPath();
  globeContext.arc(centerX,centerY,radius,0,Math.PI * 2);
  globeContext.fill();

  // Number("") is 0, so an emptied field used to drop the marker on the null
  // the Gulf of Guinea: any redraw while a field was blank, a language switch
  // among them, looked like the selection had jumped to Africa. A field with
  // nothing in it means "unchanged", so fall back to where the observer is.
  const selectedLatitude =
    coordinateFieldValue(controlLatitude,scene.observer.latitude);

  const selectedLongitude =
    coordinateFieldValue(controlLongitude,scene.observer.longitude);

  if (
    Number.isFinite(selectedLatitude) &&
    Number.isFinite(selectedLongitude)
  ) {
    const selected = projectGlobePoint(selectedLatitude,selectedLongitude);

    if (selected.z >= 0) {
      const markerX = centerX + selected.x * radius;
      const markerY = centerY - selected.y * radius;

      globeContext.shadowColor = "rgba(255,220,122,.92)";
      globeContext.shadowBlur = 10;
      globeContext.fillStyle = "#ffe08a";
      globeContext.strokeStyle = "rgba(30,56,70,.88)";
      globeContext.lineWidth = 2;
      globeContext.beginPath();
      globeContext.arc(markerX,markerY,7,0,Math.PI * 2);
      globeContext.fill();
      globeContext.stroke();
    }
  }

  globeContext.restore();

  globeContext.strokeStyle =
    daylight > .5
      ? "rgba(255,255,255,.72)"
      : "rgba(220,236,255,.58)";
  globeContext.lineWidth = 2;
  globeContext.beginPath();
  globeContext.arc(centerX,centerY,radius,0,Math.PI * 2);
  globeContext.stroke();
}


function coordinateFieldValue(
  input,
  fallback
) {

  const raw =
    input.value.trim();

  if (
    raw === ""
  ) {

    return fallback;
  }

  const value =
    Number(raw);

  return Number.isFinite(value)
    ? value
    : fallback;
}


function centerGlobeOn(
  latitude,
  longitude
) {
  globeViewLatitude = clamp(latitude,-82,82);
  globeViewLongitude = normalizeSignedDegrees(longitude);
  drawCoordinateGlobe();
}


function selectCoordinatesOnGlobe(event) {

  const bounds = coordinateGlobe.getBoundingClientRect();
  const scaleX = coordinateGlobe.width / bounds.width;
  const scaleY = coordinateGlobe.height / bounds.height;
  const centerX = coordinateGlobe.width * .5;
  const centerY = coordinateGlobe.height * .47;
  const radius = Math.min(
    coordinateGlobe.width,
    coordinateGlobe.height
  ) * .405;
  const x = (event.clientX - bounds.left) * scaleX;
  const y = (event.clientY - bounds.top) * scaleY;
  const normalizedX = (x - centerX) / radius;
  const normalizedY = -(y - centerY) / radius;
  const rhoSquared = normalizedX * normalizedX + normalizedY * normalizedY;

  if (rhoSquared > 1) return;

  const z = Math.sqrt(Math.max(0,1 - rhoSquared));
  const viewLatitude = globeViewLatitude * DEG;
  const latitude = Math.asin(
    normalizedY * Math.cos(viewLatitude) +
    z * Math.sin(viewLatitude)
  );
  const longitude = globeViewLongitude * DEG + Math.atan2(
    normalizedX,
    z * Math.cos(viewLatitude) -
    normalizedY * Math.sin(viewLatitude)
  );

  controlLatitude.value = (latitude * RAD).toFixed(4);
  controlLongitude.value = normalizeSignedDegrees(longitude * RAD).toFixed(4);
  knownLocation.value = "";
  drawCoordinateGlobe();
}


coordinateGlobe.addEventListener("pointerdown",event => {
  globeDragging = true;
  globePointerId = event.pointerId;
  globeLastX = event.clientX;
  globeLastY = event.clientY;
  globeDragDistance = 0;
  coordinateGlobe.setPointerCapture(event.pointerId);
  coordinateGlobe.classList.add("dragging");
});

coordinateGlobe.addEventListener("pointermove",event => {
  if (!globeDragging || event.pointerId !== globePointerId) return;

  const deltaX = event.clientX - globeLastX;
  const deltaY = event.clientY - globeLastY;
  globeLastX = event.clientX;
  globeLastY = event.clientY;
  globeDragDistance += Math.hypot(deltaX,deltaY);
  globeViewLongitude = normalizeSignedDegrees(
    globeViewLongitude - deltaX * .72
  );
  globeViewLatitude = clamp(
    globeViewLatitude + deltaY * .58,
    -82,
    82
  );
  drawCoordinateGlobe();
});

coordinateGlobe.addEventListener("pointerup",event => {
  if (!globeDragging || event.pointerId !== globePointerId) return;

  globeDragging = false;
  coordinateGlobe.classList.remove("dragging");
  coordinateGlobe.releasePointerCapture(event.pointerId);

  if (globeDragDistance < 5) {
    selectCoordinatesOnGlobe(event);
  }
});

coordinateGlobe.addEventListener("pointercancel",() => {
  globeDragging = false;
  coordinateGlobe.classList.remove("dragging");
});

knownLocation.addEventListener("change",() => {
  if (!knownLocation.value) return;

  const [latitude,longitude] = knownLocation.value
    .split(",")
    .map(Number);

  controlLatitude.value = latitude.toFixed(4);
  controlLongitude.value = longitude.toFixed(4);
  centerGlobeOn(latitude,longitude);
});

controlLatitude.addEventListener("change",() => {
  const latitude = coordinateFieldValue(controlLatitude,scene.observer.latitude);
  const longitude = coordinateFieldValue(controlLongitude,scene.observer.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    knownLocation.value = "";
    centerGlobeOn(latitude,longitude);
  }
});

controlLongitude.addEventListener("change",() => {
  const latitude = coordinateFieldValue(controlLatitude,scene.observer.latitude);
  const longitude = coordinateFieldValue(controlLongitude,scene.observer.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    knownLocation.value = "";
    centerGlobeOn(latitude,longitude);
  }
});


function closeControlPanels() {

  scenePanel.classList.remove(
    "open"
  );

  controlScene.setAttribute(
    "aria-expanded",
    "false"
  );

  setTransportDisabled(false);
}


// while the panel is open the scene it edits must hold still, so the transport
// and the view controls are locked out until it is applied or dismissed
function setTransportDisabled(disabled) {

  [
    controlRewind,
    controlPause,
    controlForward,
    controlNow,
    controlFullscreen
  ].forEach(
    button => {

      button.disabled =
        disabled;
    }
  );
}


function toggleControlPanel(
  panel,
  button
) {

  const shouldOpen =
    !panel.classList.contains("open");

  closeControlPanels();

  if (
    shouldOpen
  ) {

    panel.classList.add(
      "open"
    );

    button.setAttribute(
      "aria-expanded",
      "true"
    );
  }

  setTransportDisabled(shouldOpen);
}


function updateControlState() {

  // the three transport buttons are one speed selector: exactly one of them
  // lights up, for the speed currently running. "Now" is a jump, not a mode,
  // so it never stays lit; pausing simply leaves none of them lit.
  const states = [
    [controlRewind,scene.playbackRate < 0],
    [controlPause,scene.playbackRate === 1],
    [controlForward,scene.playbackRate > 1]
  ];

  states.forEach(
    ([button,active]) => {

      button.classList.toggle(
        "active",
        active
      );

      if (
        button === controlPause
      ) {

        // the label already flips between Pausa and Riprendi, so announcing a
        // pressed state on top of it would say the same thing twice, and
        // contradict it: "Riprendi, premuto"
        return;
      }

      button.setAttribute(
        "aria-pressed",
        active ? "true" : "false"
      );
    }
  );

  const paused =
    scene.playbackRate === 0;

  // the icon has to track pause, while the highlight above tracks 1x speed
  controlPause.classList.toggle(
    "paused",
    paused
  );

  controlPause.title =
    paused ? text("resume") : text("pause");

  controlPause.setAttribute(
    "aria-label",
    paused ? text("resume") : text("pause")
  );
}


function setPlaybackRate(rate) {

  scene.followRealTime =
    false;

  scene.playbackRate =
    rate;

  scene.simulationLastRealMilliseconds =
    Date.now();

  scene.nextAstronomyUpdate =
    0;

  updateControlState();

  updateAstronomy(true);
}


function returnToCurrentTime() {

  scene.followRealTime =
    true;

  scene.playbackRate =
    1;

  scene.simulationTimeMilliseconds =
    Date.now();

  scene.simulationLastRealMilliseconds =
    Date.now();

  closeControlPanels();

  updateControlState();

  updateAstronomy(true);
}


controlRewind.addEventListener(
  "click",
  () => setPlaybackRate(
    scene.playbackRate < 0 ? 1 : -3600
  )
);

controlForward.addEventListener(
  "click",
  () => setPlaybackRate(
    scene.playbackRate > 1 ? 1 : 3600
  )
);


controlPause.addEventListener(
  "click",
  () => setPlaybackRate(
    scene.playbackRate === 0 ? 1 : 0
  )
);

controlNow.addEventListener(
  "click",
  returnToCurrentTime
);

function setIntroCollapsed(collapsed) {

  introPanel.classList.toggle(
    "is-collapsed",
    collapsed
  );

  introToggle.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );

  setButtonLabel(
    introToggle,
    text(collapsed ? "expandPanel" : "collapsePanel")
  );
}


function storedIntroCollapsed() {
  try { return localStorage.getItem("lirux-intro-collapsed") === "1"; }
  catch (_) { return false; }
}
introToggle.addEventListener("click", () => {
  const collapsed = !introPanel.classList.contains("is-collapsed");
  setIntroCollapsed(collapsed);
  try { localStorage.setItem("lirux-intro-collapsed", collapsed ? "1" : "0"); } catch (_) {}
});

function isFullscreen() {

  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement
  );
}


let introCollapsedBeforeFullscreen =
  storedIntroCollapsed();


function updateFullscreenState() {

  const on =
    isFullscreen();

  document.body.classList.toggle(
    "fullscreen",
    on
  );

  controlFullscreen.classList.toggle(
    "active",
    on
  );

  setButtonLabel(
    controlFullscreen,
    text(on ? "exitFullscreen" : "enterFullscreen")
  );

  // going full screen is a request to see the scene, so the panel folds away
  // and the compass steps aside; leaving puts the panel back as it was found
  if (
    on
  ) {

    introCollapsedBeforeFullscreen =
      introPanel.classList.contains("is-collapsed");

    setIntroCollapsed(true);

  } else {

    setIntroCollapsed(introCollapsedBeforeFullscreen);
  }

  // Switching surface can produce different pointer events across
  // browsers. Always restart from a single clean inactivity timer.
  noteUserActivity();
}


// iPhone Safari has no Fullscreen API at all, so the button only shows up
// where the browser can actually honour it
if (
  document.documentElement.requestFullscreen ||
  document.documentElement.webkitRequestFullscreen
) {

  controlFullscreen.hidden =
    false;
}


controlFullscreen.addEventListener(
  "click",
  () => {

    const root =
      document.documentElement;

    if (
      isFullscreen()
    ) {

      (
        document.exitFullscreen ||
        document.webkitExitFullscreen
      ).call(document);

    } else {

      (
        root.requestFullscreen ||
        root.webkitRequestFullscreen
      ).call(root);
    }
  }
);


[
  "fullscreenchange",
  "webkitfullscreenchange"
].forEach(
  event => document.addEventListener(event,updateFullscreenState)
);


if (
  "geolocation" in navigator
) {

  controlGeolocate.hidden =
    false;
}


controlGeolocate.addEventListener(
  "click",
  () => {

    requestObserverLocation();
  }
);


controlLanguage.addEventListener(
  "click",
  () => {
    scene.currentLanguage = scene.currentLanguage === "it" ? "en" : "it";

    const url = new URL(window.location.href);
    if (scene.currentLanguage === "en") {
      url.searchParams.set("lang","en");
    } else {
      url.searchParams.delete("lang");
    }
    window.history.replaceState(null,"",url);

    applyInterfaceLanguage();
    updateAstronomy(true);
  }
);

controlScene.addEventListener(
  "click",
  () => {

    controlDatetime.value =
      zonedDateTimeValue(
        scene.simulationTimeMilliseconds,
        coordinateTimeZone(
          scene.observer.latitude,
          scene.observer.longitude
        )
      );

    controlLatitude.value =
      scene.observer.latitude.toFixed(4);

    controlLongitude.value =
      scene.observer.longitude.toFixed(4);

    const observerValue =
      `${scene.observer.latitude.toFixed(4)},${scene.observer.longitude.toFixed(4)}`;

    knownLocation.value =
      Array.from(knownLocation.options)
        .some(option => option.value === observerValue)
        ? observerValue
        : "";

    centerGlobeOn(
      scene.observer.latitude,
      scene.observer.longitude
    );

    toggleControlPanel(
      scenePanel,
      controlScene
    );
  }
);

// nothing in the panel touches the observer until the form is submitted, so
// closing it is a real cancel: the fields are refilled from the live state
// the next time it opens
controlCancel.addEventListener(
  "click",
  closeControlPanels
);


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      scenePanel.classList.contains("open")
    ) {

      closeControlPanels();
      controlScene.focus();
    }
  }
);


sceneForm.addEventListener(
  "submit",
  event => {

    event.preventDefault();

    // coordinates first: the timestamp below is read in the observer's time
    // zone, so a submit that moves both must interpret the time at the new place
    const latitude =
      Number(controlLatitude.value);

    const longitude =
      Number(controlLongitude.value);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {

      observerManuallySet =
        true;

      scene.observer = {
        latitude,
        longitude,
        source:"manuale"
      };

      scene.solarEventsCache.key =
        "";
    }

    const selectedTime =
      zonedDateTimeMilliseconds(
        controlDatetime.value,
        coordinateTimeZone(
          scene.observer.latitude,
          scene.observer.longitude
        )
      );

    closeControlPanels();

    // The field is prefilled to the minute, so a submit that only moved the
    // coordinates comes back with the same instant. Applying it anyway would
    // pin the clock and drop out of real time for no reason.
    const timeMoved =
      Number.isFinite(selectedTime) &&
      Math.abs(selectedTime - scene.simulationTimeMilliseconds) >= 60000;

    if (
      timeMoved
    ) {

      // whatever was running keeps running, from the newly chosen instant
      const rate =
        scene.playbackRate;

      scene.simulationTimeMilliseconds =
        selectedTime;

      setPlaybackRate(rate);

    } else {

      updateAstronomy(true);
    }
  }
);

let geolocateNoteResetTimer = null;

function requestObserverLocation() {

  if (
    Number.isFinite(previewTimeMilliseconds)
  ) {

    return;
  }

  if (
    !("geolocation" in navigator) ||
    controlGeolocate.disabled
  ) {

    return;
  }

  controlGeolocate.disabled = true;
  window.clearTimeout(geolocateNoteResetTimer);
  geolocateNote.textContent = text("locationNote");

  navigator.geolocation.getCurrentPosition(
    position => {

      controlGeolocate.disabled = false;

      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      controlLatitude.value = latitude.toFixed(4);
      controlLongitude.value = longitude.toFixed(4);
      knownLocation.value = "";
      centerGlobeOn(latitude,longitude);
    },
    () => {

      controlGeolocate.disabled = false;
      geolocateNote.textContent = text("locationFailed");

      geolocateNoteResetTimer = window.setTimeout(
        () => { geolocateNote.textContent = text("locationNote"); },
        5000
      );
    },
    {
      enableHighAccuracy:false,
      timeout:7000,
      maximumAge:3600000
    }
  );
}


function hideStarTooltip(
  clearNearby = true
) {

  scene.hoveredStar =
    null;

  if (
    clearNearby
  ) {

    scene.nearbyStarWeights =
      new Map();

    document.body.classList.remove(
      "star-nearby"
    );
  }

  starTooltip.classList.remove(
    "visible"
  );

  starTooltip.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "star-hovering"
  );
}


function translatedStarType(type) {
  if (scene.currentLanguage !== "en") return type;

  const translations = [
    ["Sequenza principale","Main-sequence star"],
    ["Supergigante blu","Blue supergiant"],
    ["Supergigante bianca","White supergiant"],
    ["Supergigante gialla","Yellow supergiant"],
    ["Supergigante rossa","Red supergiant"],
    ["Supergigante arancione","Orange supergiant"],
    ["Supergigante","Supergiant"],
    ["Gigante luminosa","Bright giant"],
    ["Gigante blu-bianca","Blue-white giant"],
    ["Gigante blu","Blue giant"],
    ["Gigante bianca","White giant"],
    ["Gigante bianco-azzurra","Blue-white giant"],
    ["Gigante arancione","Orange giant"],
    ["Gigante rossa","Red giant"],
    ["Subgigante blu","Blue subgiant"],
    ["Subgigante bianca","White subgiant"],
    ["Subgigante","Subgiant"],
    ["Sistema di giganti gialle","Yellow-giant system"],
    ["Sistema binario a eclisse","Eclipsing binary system"],
    ["Sistema binario di giganti","Binary giant system"],
    ["Sistema binario","Binary system"],
    ["Sistema multiplo","Multiple-star system"],
    ["Stella peculiare","Chemically peculiar star"],
    ["classi","classes"],
    ["classe","class"]
  ];

  return translations.reduce(
    (result,[italian,english]) => result.replace(italian,english),
    type
  );
}

function translatedStarName(name) {
  if (scene.currentLanguage !== "en") return name;

  return ({
    Sirio:"Sirius", Canopo:"Canopus", Arturo:"Arcturus", Procione:"Procyon",
    Polluce:"Pollux", Regolo:"Regulus", Castore:"Castor", Polare:"Polaris"
  })[name] || name;
}


function updateStarHover(
  clientX,
  clientY
) {
  if (photoScene.active && !photoScene.isSky(clientX,clientY,scene.W,scene.H)) {
    hideStarTooltip();
    return;
  }


  if (
    !pointerAllowsStarHover ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    scene.celestialState.starVisibility < .08
  ) {

    hideStarTooltip();

    return;
  }

  let nearest =
    null;

  let nearestDistance =
    touchHitTesting ? 30 : 15;

  const nearby = [];

  for (
    let index = 0;
    index < scene.starScreenPositions.length;
    index += 1
  ) {

    const star =
      scene.starScreenPositions[index];

    if (
      !star.name ||
      star.horizonVisibility < .18
    ) {

      continue;
    }

    const distance =
      Math.hypot(
        X(star.x) - clientX,
        Y(star.y) - clientY
      );

    if (
      distance < CELESTIAL_NEARBY_RADIUS
    ) {

      nearby.push({
        star,
        distance,
        weight:
          1 - distance / CELESTIAL_NEARBY_RADIUS
      });
    }

    if (
      distance < nearestDistance
    ) {

      nearest =
        star;

      nearestDistance =
        distance;
    }
  }

  nearby.sort(
    (first,second) =>
      first.distance -
      second.distance
  );

  scene.nearbyStarWeights =
    new Map(
      nearby
        .slice(0,5)
        .map(item => [
          item.star.name,
          item.weight
        ])
    );

  document.body.classList.toggle(
    "star-nearby",
    scene.nearbyStarWeights.size > 0
  );

  if (
    !nearest
  ) {

    hideStarTooltip(false);

    return;
  }

  scene.hoveredStar =
    nearest;

  starTooltipName.textContent =
    translatedStarName(nearest.name);

  starTooltipType.textContent =
    translatedStarType(nearest.type);

  starTooltipDistance.textContent =
    `${nearest.distance.toLocaleString(
      interfaceLocale(),
      { maximumFractionDigits:1 }
    )} ${text("lightYears")}`;

  starTooltip.classList.add(
    "visible"
  );

  starTooltip.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "star-hovering"
  );

  const tooltipWidth =
    starTooltip.offsetWidth || 220;

  const tooltipHeight =
    starTooltip.offsetHeight || 72;

  const left =
    clamp(
      clientX + 15,
      8,
      scene.W - tooltipWidth - 8
    );

  const top =
    clamp(
      clientY - tooltipHeight - 12,
      8,
      scene.H - tooltipHeight - 8
    );

  starTooltip.style.left =
    `${left}px`;

  starTooltip.style.top =
    `${top}px`;
}


function hideIssTooltip() {

  scene.issHovered =
    false;

  issTooltip.classList.remove(
    "visible"
  );

  issTooltip.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "iss-hovering"
  );
}


function updateIssHover(
  clientX,
  clientY
) {
  if (photoScene.active && !photoScene.isSky(clientX,clientY,scene.W,scene.H)) {
    hideIssTooltip();
    return;
  }


  if (
    !pointerAllowsStarHover ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    scene.issState.visibility < .06
  ) {

    hideIssTooltip();

    return;
  }

  const iconScale =
    clamp(
      1500 / scene.issState.range,
      .68,
      1.22
    );

  const distance =
    Math.hypot(
      X(scene.issState.x) - clientX,
      Y(scene.issState.y) - clientY
    );

  if (
    distance >
      22 + iconScale * 8 +
      (touchHitTesting ? 12 : 0)
  ) {

    hideIssTooltip();

    return;
  }

  hideStarTooltip();

  scene.issHovered =
    true;

  issTooltipDistance.textContent =
    `${Math.round(
      scene.issState.range
    ).toLocaleString(interfaceLocale())} km`;

  issTooltip.classList.add(
    "visible"
  );

  issTooltip.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "iss-hovering"
  );

  const tooltipWidth =
    issTooltip.offsetWidth || 230;

  const tooltipHeight =
    issTooltip.offsetHeight || 120;

  const left =
    clamp(
      clientX + 16,
      8,
      scene.W - tooltipWidth - 8
    );

  const top =
    clamp(
      clientY - tooltipHeight - 12,
      8,
      scene.H - tooltipHeight - 8
    );

  issTooltip.style.left =
    `${left}px`;

  issTooltip.style.top =
    `${top}px`;
}


function hidePlanetTooltip(
  clearNearby = true
) {

  scene.hoveredPlanet = null;

  if (clearNearby) {
    scene.nearbyPlanetWeights = new Map();
    document.body.classList.remove("planet-nearby");
  }

  planetTooltip.classList.remove(
    "visible"
  );

  planetTooltip.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "planet-hovering"
  );
}


function updatePlanetHover(
  clientX,
  clientY
) {
  if (photoScene.active && !photoScene.isSky(clientX,clientY,scene.W,scene.H)) {
    hidePlanetTooltip();
    return;
  }


  if (
    !pointerAllowsStarHover ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  ) {
    hidePlanetTooltip();
    return;
  }

  let nearest = null;
  let nearestDistance = Infinity;
  const nearby = [];

  for (const planet of scene.planetStates) {
    if (planet.visibility < .06) continue;

    const distance = Math.hypot(
      X(planet.x) - clientX,
      Y(planet.y) - clientY
    );

    const hitRadius = Math.max(
      touchHitTesting ? 34 : 24,
      planet.displayRadius + 13
    );

    if (distance < CELESTIAL_NEARBY_RADIUS) {
      nearby.push({
        planet,
        distance,
        weight:1 - distance / CELESTIAL_NEARBY_RADIUS
      });
    }

    if (distance < hitRadius && distance < nearestDistance) {
      nearest = planet;
      nearestDistance = distance;
    }
  }

  scene.nearbyPlanetWeights =
    new Map(
      nearby
        .sort((first,second) => first.distance - second.distance)
        .slice(0,5)
        .map(item => [item.planet.id,item.weight])
    );

  document.body.classList.toggle(
    "planet-nearby",
    scene.nearbyPlanetWeights.size > 0
  );

  if (!nearest) {
    hidePlanetTooltip(false);
    return;
  }

  hideStarTooltip();
  hideIssTooltip();

  scene.hoveredPlanet = nearest;
  planetTooltipName.textContent = scene.currentLanguage === "en" ? nearest.enName : nearest.name;
  planetTooltipType.textContent = scene.currentLanguage === "en" ? nearest.enType : nearest.type;
  planetTooltipDistance.textContent =
    `${(nearest.distanceAu * 149.5978707).toLocaleString(
      interfaceLocale(),
      { maximumFractionDigits:1 }
    )} ${text("millionKm")}`;
  planetTooltipSunDistance.textContent =
    `${nearest.sunDistanceAu.toLocaleString(
      interfaceLocale(),
      { minimumFractionDigits:2, maximumFractionDigits:2 }
    )} ${scene.currentLanguage === "en" ? "AU" : "UA"}`;
  planetTooltipDiameter.textContent =
    `${nearest.diameter.toLocaleString(interfaceLocale())} km`;
  planetTooltipYear.textContent = scene.currentLanguage === "en" ? nearest.enOrbitalPeriod : nearest.orbitalPeriod;

  planetTooltip.classList.add("visible");
  planetTooltip.setAttribute("aria-hidden","false");
  document.body.classList.add("planet-hovering");

  const tooltipWidth = planetTooltip.offsetWidth || 230;
  const tooltipHeight = planetTooltip.offsetHeight || 92;
  const left = clamp(clientX + 16,8,scene.W - tooltipWidth - 8);
  const top = clamp(clientY - tooltipHeight - 12,8,scene.H - tooltipHeight - 8);

  planetTooltip.style.left = `${left}px`;
  planetTooltip.style.top = `${top}px`;
}


function hideMoonLandingTooltip() {

  moonLandingHovered = false;
  moonLandingTooltip.classList.remove("visible");
  moonLandingTooltip.setAttribute("aria-hidden","true");
  document.body.classList.remove("moon-landing-hovering");
}


function updateMoonLandingHover(
  clientX,
  clientY
) {

  if (
    !pointerAllowsStarHover ||
    !scene.moonLandingState.visible ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  ) {
    hideMoonLandingTooltip();
    return;
  }

  const distance = Math.hypot(
    scene.moonLandingState.x - clientX,
    scene.moonLandingState.y - clientY
  );

  // Same highlight radius as the named stars (updateStarHover),
  // with both mouse and touch.
  if (
    distance > (touchHitTesting ? 30 : 15)
  ) {
    hideMoonLandingTooltip();
    return;
  }

  hideStarTooltip();
  hideIssTooltip();
  hidePlanetTooltip();

  moonLandingHovered = true;
  moonLandingTooltip.classList.add("visible");
  moonLandingTooltip.setAttribute("aria-hidden","false");
  document.body.classList.add("moon-landing-hovering");

  const tooltipWidth = moonLandingTooltip.offsetWidth || 230;
  const tooltipHeight = moonLandingTooltip.offsetHeight || 116;
  const left = clamp(clientX + 16,8,scene.W - tooltipWidth - 8);
  const top = clamp(clientY - tooltipHeight - 12,8,scene.H - tooltipHeight - 8);

  moonLandingTooltip.style.left = `${left}px`;
  moonLandingTooltip.style.top = `${top}px`;
}


function hidePeakTooltip(
  clearProximity = true
) {
  scene.peakHovered = null;
  if (clearProximity) scene.peakProximities = new Map();
  peakTooltip.classList.remove("visible");
  peakTooltip.setAttribute("aria-hidden","true");
  document.body.classList.remove("peak-hovering");
}


function updatePeakHover(
  clientX,
  clientY
) {

  if (
    !pointerAllowsStarHover ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  ) {
    hidePeakTooltip();
    return;
  }

  let nearestPeak = null;
  let nearestDistance = Infinity;
  const proximities = new Map();

  for (const peak of peakStates) {
    const distance = Math.hypot(
      X(peak.x) - clientX,
      Y(peak.y) - clientY
    );

    const proximity =
      clamp(1 - distance / 64,0,1);

    if (proximity > 0) {
      proximities.set(peak.id,proximity);
    }

    if (distance < nearestDistance) {
      nearestPeak = peak;
      nearestDistance = distance;
    }
  }

  scene.peakProximities = proximities;

  if (nearestDistance > (touchHitTesting ? 34 : 24)) {
    hidePeakTooltip(false);
    return;
  }

  hideStarTooltip();
  hideIssTooltip();
  hidePlanetTooltip();
  hideMoonLandingTooltip();

  scene.peakHovered = nearestPeak;
  scene.peakProximities.set(nearestPeak.id,1);
  peakTooltipName.textContent = scene.currentLanguage === "en"
    ? nearestPeak.enName
    : nearestPeak.name;
  peakTooltipElevation.textContent =
    peakElevationLabel(nearestPeak.elevation);
  peakTooltip.classList.add("visible");
  peakTooltip.setAttribute("aria-hidden","false");
  document.body.classList.add("peak-hovering");

  const tooltipWidth = peakTooltip.offsetWidth || 180;
  const tooltipHeight = peakTooltip.offsetHeight || 58;
  const left = clamp(clientX + 16,8,scene.W - tooltipWidth - 8);
  const top = clamp(clientY - tooltipHeight - 12,8,scene.H - tooltipHeight - 8);

  peakTooltip.style.left = `${left}px`;
  peakTooltip.style.top = `${top}px`;
}


// ============================================================
// PANEL FADE AFTER POINTER INACTIVITY
// ============================================================

// The panels over the drawing fade out after a few
// seconds without mouse activity; at the first activity (mouse or touch)
// only those that were visible before the fade come back.
const PANELS_IDLE_MS =
  4000;

const autoHidePanels =
  [
    sceneCompass,
    introPanel,
    simulationControls,
    skyStatus
  ];

let panelsIdleTimer =
  null;

let panelsHidden =
  false;

let panelsToRestore =
  [];


function panelIsShown(panel) {

  return Boolean(
    panel &&
    getComputedStyle(panel).display !== "none"
  );
}


// True while the user is really using a panel. A plain :hover or
// the focus left by a click do not count: in full screen they can stay on
// the entry button indefinitely and prevent the fade forever.
function panelInteractionActive() {

  if (scenePanel.classList.contains("open")) return true;
  if (introPanel.matches(":hover")) return true;

  const active =
    document.activeElement;

  if (
    active &&
    active !== document.body &&
    autoHidePanels.some(panel => panel.contains(active)) &&
    active.matches(":focus-visible")
  ) return true;

  return false;
}


function hideIdlePanels() {

  if (panelsHidden || panelInteractionActive()) {
    scheduleIdlePanels();
    return;
  }

  panelsToRestore =
    autoHidePanels.filter(panelIsShown);

  panelsToRestore.forEach(
    panel => panel.classList.add("ui-faded")
  );

  panelsHidden =
    true;
}


function showIdlePanels() {

  if (!panelsHidden) return;

  panelsToRestore.forEach(
    panel => panel.classList.remove("ui-faded")
  );

  panelsToRestore =
    [];

  panelsHidden =
    false;
}


function scheduleIdlePanels() {

  window.clearTimeout(panelsIdleTimer);

  panelsIdleTimer =
    window.setTimeout(hideIdlePanels, PANELS_IDLE_MS);
}


function noteUserActivity() {

  showIdlePanels();

  scheduleIdlePanels();
}


[
  "pointermove",
  "pointerdown",
  "touchstart",
  "wheel",
  "keydown"
].forEach(
  eventName => window.addEventListener(
    eventName,
    noteUserActivity,
    { passive:true }
  )
);


scheduleIdlePanels();


applyInterfaceLanguage();
setIntroCollapsed(storedIntroCollapsed());

updateControlState();

Object.assign(hooks,{
  astronomy:showAstronomy,
  planets:showPlanets,
  iss:showIss,
  frame:afterFrame
});
startScene();

// Reproducible preset used to update the ISS image in the help page.
// It does not change the normal experience: it is enabled only with ?helpShot=iss.
if (previewParameters.get("helpShot") === "iss") {
  setIntroCollapsed(true);

  const searchStart = scene.simulationTimeMilliseconds;
  let bestShot = null;

  // We look for a few days of night passes: the ISS must appear high
  // and far from the mountains, so that it is really visible in the help image.
  for (let minute = 0; minute <= 7 * 24 * 60; minute += 1) {
    const candidateTime = searchStart + minute * 60000;
    const candidateDate = new Date(candidateTime);
    const position = issHorizontalPosition(candidateDate);
    const sun = sunPosition(
      candidateDate,
      scene.observer.latitude,
      scene.observer.longitude
    );

    if (position.altitude < 28 || sun.altitude > -4) continue;

    const projected = projectCelestialBody(position);
    const score =
      Math.abs(projected.x - .5) * 1.35 +
      Math.abs(projected.y - .22) +
      (90 - position.altitude) / 240;

    if (!bestShot || score < bestShot.score) {
      bestShot = { time:candidateTime, score };
    }
  }

  if (bestShot) {
    scene.simulationTimeMilliseconds = bestShot.time;
    updateAstronomy(true);
  }

  updateIssHover(X(scene.issState.x),Y(scene.issState.y));
  touchPinnedTooltipKey = "iss";
}


// Clock, place and sky readouts, refreshed after every astronomy update of
// the scene.
function showAstronomy({ now, lunarPhase, daylight, timeZone, solarEvents }) {

  if (!touchPinnedTooltipKey) {
    updateStarHover(
      pointerX,
      pointerY
    );

    updateIssHover(
      pointerX,
      pointerY
    );

    updatePlanetHover(
      pointerX,
      pointerY
    );
  }

  const animatedTime =
    now.toLocaleTimeString(
      interfaceLocale(),
      {
        timeZone:timeZone.zone,
        hour:"2-digit",
        minute:"2-digit",
        hour12:false
      }
    );

  const animatedDate =
    now.toLocaleDateString(
      interfaceLocale(),
      {
        timeZone:timeZone.zone,
        day:"2-digit",
        month:"2-digit",
        year:"2-digit"
      }
    );

  const placeEntry =
    knownLocationNames[
      `${scene.observer.latitude.toFixed(4)},${scene.observer.longitude.toFixed(4)}`
    ];

  const placeLabel =
    placeEntry
      ? placeEntry[scene.currentLanguage]
      : "";

  const latitudeLabel =
    `${Math.abs(scene.observer.latitude).toFixed(3)}° ${
      scene.observer.latitude >= 0 ? "N" : "S"
    }`;

  const longitudeLabel =
    `${Math.abs(scene.observer.longitude).toFixed(3)}° ${
      scene.observer.longitude >= 0 ? "E" : scene.currentLanguage === "en" ? "W" : "O"
    }`;

  const sunriseTime =
    formatClockTime(solarEvents.sunrise,timeZone.zone);

  const sunsetTime =
    formatClockTime(solarEvents.sunset,timeZone.zone);

  scene.photoLifeOptions.phaseLabel =
    text("phaseLabels")[lunarPhase.iconIndex];

  statusDate.textContent =
    animatedDate;

  statusTime.textContent =
    animatedTime;

  statusTimezone.textContent =
    timeZone.shortName;

  statusTimezone.title =
    `${text("timeZone")}: ${timeZone.zone}`;

  statusSunrise.textContent =
    sunriseTime;

  statusSunset.textContent =
    sunsetTime;

  statusMoonPhase.setAttribute(
    "d",
    moonPhaseSvgPath(
      lunarPhase.displayPhase
    )
  );

  const phaseLabel =
    text("phaseLabels")[lunarPhase.iconIndex];

  statusMoonPhaseWrap.setAttribute(
    "aria-label",
    phaseLabel
  );

  // a named place carries its coordinates in brackets, signed and without the
  // hemisphere letters, which is what makes both fit on the one row; the full
  // form stays in the tooltip and in the label read out to assistive tech
  statusCoordinates.textContent =
    placeLabel
      ? `${placeLabel} (${scene.observer.latitude.toFixed(2)}, ${scene.observer.longitude.toFixed(2)})`
      : `${latitudeLabel}, ${longitudeLabel}`;

  statusCoordinates.title =
    placeLabel
      ? `${placeLabel} · ${latitudeLabel}, ${longitudeLabel}`
      : "";

  skyStatus.setAttribute(
    "aria-label",
    `${animatedDate}, ${animatedTime}, ${text("timeZone").toLowerCase()} ${timeZone.shortName} (${timeZone.zone}), ${text("sunrise").toLowerCase()} ${sunriseTime}, ${text("sunset").toLowerCase()} ${
      sunsetTime
    }, ${phaseLabel}, ${placeLabel ? placeLabel + ", " : ""}${text("coordinates").toLowerCase()} ${latitudeLabel}, ${longitudeLabel}`
  );

  applyInterfaceColors(daylight);
}


// The list of visible planets in the status panel.
function showPlanets(planetStates) {
  const visibleNames = planetStates
    .filter(planet => planet.visibility > .06)
    .map(planet => scene.currentLanguage === "en" ? planet.enName : planet.name);

  planetStatus.textContent = visibleNames.length
    ? `${text("visiblePlanets")}: ${visibleNames.join(", ")}`
    : text("noPlanets");
  planetStatus.dataset.visibleCount = `${visibleNames.length}`;
  planetStatus.dataset.visible = visibleNames.join(",");
}


// The ISS line in the status panel.
function showIss(issState,position) {
  issStatus.textContent =
    issState.visibility > .001
      ? `${text("issVisible")} ${Math.round(
          position.range
        )} km`
      : text("issBelow");

  issStatus.dataset.visible =
    issState.visibility > .001
      ? "true"
      : "false";

  issStatus.dataset.x =
    issState.x.toFixed(4);

  issStatus.dataset.y =
    issState.y.toFixed(4);
}


// Hover and pinned tooltips follow the moving figures on every frame.
function afterFrame() {
  if (!touchPinnedTooltipKey) updatePhotoLifeHover(pointerX,pointerY);
  refreshTouchPinnedTooltip();
}

})();
