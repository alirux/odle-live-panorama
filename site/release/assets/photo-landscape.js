/* Photographic scene. Astronomy lives in odle-astronomy.js; this module only projects
 * and draws it. The landscape is an artistic panorama, not a surveyed camera.
 * See docs/scene/README.md for the plate source and projection assumptions. */
(() => {
  const WIDTH = 1672, HEIGHT = 941;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const smooth = (lo, hi, v) => {
    const t = clamp((v - lo) / (hi - lo));
    return t * t * (3 - 2 * t);
  };

  // Skyline traced in plate pixels. Used only to occlude celestial bodies;
  // the photograph itself is never cut or stretched into a polygonal terrain.
  const ridge = [
    [0,425],[17,430],[38,419],[68,414],[92,416],[115,408],[144,401],
    [166,405],[180,404],[195,411],[221,403],[248,418],[264,426],
    [281,400],[290,375],[300,366],[305,354],[316,359],[326,356],
    [333,334],[341,337],[347,350],[356,333],[369,319],[381,287],
    [386,257],[393,250],[400,258],[405,251],[416,267],[421,277],
    [438,290],[448,309],[461,334],[476,323],[485,343],[497,320],
    [502,293],[511,275],[524,284],[534,263],[548,269],[556,243],
    [566,215],[578,197],[591,185],[604,180],[618,171],[625,174],
    [638,166],[646,179],[653,176],[666,192],[678,212],[688,232],
    [699,239],[709,224],[716,197],[725,175],[732,171],[737,184],
    [743,176],[751,192],[758,209],[767,218],[770,178],[778,175],
    [788,188],[799,202],[808,194],[817,205],[825,216],[829,210],
    [838,238],[848,266],[856,274],[862,269],[872,294],[879,282],
    [891,302],[900,294],[908,320],[916,300],[927,321],[938,298],
    [946,317],[955,325],[962,358],[970,354],[980,334],[990,325],
    [1004,312],[1023,297],[1033,317],[1048,346],[1060,327],
    [1071,312],[1078,276],[1086,249],[1095,243],[1102,249],
    [1105,242],[1114,268],[1121,292],[1131,281],[1140,310],
    [1150,304],[1161,288],[1172,255],[1182,244],[1189,243],
    [1195,264],[1203,286],[1210,274],[1217,253],[1235,241],
    [1244,240],[1253,247],[1264,270],[1273,295],[1285,268],
    [1295,264],[1306,272],[1317,287],[1325,283],[1339,300],
    [1359,309],[1370,350],[1383,363],[1398,351],[1409,377],
    [1421,389],[1434,414],[1456,410],[1478,416],[1501,426],
    [1520,422],[1540,408],[1567,401],[1582,404],[1607,415],
    [1631,403],[1647,400],[1672,407]
  ];

  class PhotoLandscape {
    constructor() {
      this.ready = false;
      this.failed = false;
      this.cache = document.createElement('canvas');
      this.cacheKey = '';
      this.winter = new Image();
      this.winterReady = false;
      this.winter.onload = () => { this.winterReady = true; this.cacheKey = ''; };
      this.winter.onerror = () => { console.warn('Unable to load winter landscape'); };
      this.winter.src = 'assets/photo/odle-winter.webp';
      this.day = new Image();
      this.sunset = new Image();
      this.clearingDay = new Image();
      this.clearingSunset = new Image();
      this.clearingLayers = new Map();
      const load = (image, src) => new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = src;
      });
      Promise.all([
        load(this.day, 'assets/photo/odle-day.webp'),
        load(this.sunset, 'assets/photo/odle-sunset.webp'),
        load(this.clearingDay, 'assets/photo/hut-door-day.webp'),
        load(this.clearingSunset, 'assets/photo/hut-door-sunset.webp')
      ]).then(() => {
        this.ready = true;
        window.dispatchEvent(new Event('photo-scene-ready'));
      }).catch(() => {
        this.failed = true;
        window.dispatchEvent(new Event('photo-scene-ready'));
      });
    }

    get active() { return this.ready; }

    clearingLayer(image) {
      if (this.clearingLayers.has(image)) return this.clearingLayers.get(image);
      // Only this small region of the edited plate enters the panorama.
      // The feathered edge preserves the original scenery everywhere else.
      const area = { x: 990, y: 480, w: 500, h: 280 };
      const layer = document.createElement('canvas');
      layer.width = area.w; layer.height = area.h;
      const c = layer.getContext('2d');
      c.drawImage(image, area.x / WIDTH * image.width, area.y / HEIGHT * image.height,
        area.w / WIDTH * image.width, area.h / HEIGHT * image.height, 0, 0, area.w, area.h);
      c.globalCompositeOperation = 'destination-in';
      c.translate(area.w / 2,area.h / 2); c.scale(area.w / 2,area.h / 2);
      const edge = c.createRadialGradient(0,0,0,0,0,1);
      edge.addColorStop(0,'rgba(255,255,255,1)');
      edge.addColorStop(.90,'rgba(255,255,255,1)');
      edge.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle = edge; c.fillRect(-1,-1,2,2);
      const result = { ...area, canvas: layer };
      this.clearingLayers.set(image,result);
      return result;
    }

    drawClearing(ctx, rect, image) {
      const layer = this.clearingLayer(image);
      ctx.drawImage(layer.canvas, rect.x + layer.x * rect.scale,
        rect.y + layer.y * rect.scale, layer.w * rect.scale, layer.h * rect.scale);
    }

    eveningPlate() {
      if (this.sunsetWithClearing) return this.sunsetWithClearing;
      const plate = document.createElement('canvas');
      plate.width = WIDTH; plate.height = HEIGHT;
      const c = plate.getContext('2d');
      c.drawImage(this.sunset,0,0,WIDTH,HEIGHT);
      this.drawClearing(c,{x:0,y:0,scale:1},this.clearingSunset);
      this.sunsetWithClearing = plate;
      return plate;
    }

    layout(w, h) {
      const scale = Math.max(w / WIDTH, h / HEIGHT);
      const visibleWidth = w / scale;
      const margin = Math.max(0,Math.min(16,(visibleWidth - 424) / 2));
      // Shift the crop just enough to retain the complete hut on narrow views.
      const focusX = Math.max(WIDTH / 2,1454 + margin - visibleWidth / 2);
      const x = Math.max(w - WIDTH * scale,Math.min(0,w / 2 - focusX * scale));
      return { x, y: (h - HEIGHT * scale) / 2,
        w: WIDTH * scale, h: HEIGHT * scale, scale };
    }

    project(position, w, h) {
      const rect = this.layout(w, h);
      // South-facing cylindrical panorama: east at the left, west at right.
      // Northern bodies stay out of view instead of folding into the south.
      const az = ((position.azimuth * 180 / Math.PI) % 360 + 360) % 360;
      return {
        x: (rect.x + (az - 90) / 180 * rect.w) / w,
        y: (rect.y + (.55 - position.altitude / 90) * rect.h) / h
      };
    }

    skylineY(x) {
      if (x <= 0) return ridge[0][1];
      for (let i = 1; i < ridge.length; i++) {
        if (x <= ridge[i][0]) {
          const [ax, ay] = ridge[i - 1], [bx, by] = ridge[i];
          return ay + (by - ay) * (x - ax) / (bx - ax);
        }
      }
      return ridge[ridge.length - 1][1];
    }

    isSky(x, y, w, h) {
      const rect = this.layout(w, h);
      return x >= 0 && x <= w && y >= 0 && y <= h &&
        (y - rect.y) / rect.scale < this.skylineY((x - rect.x) / rect.scale);
    }

    clipSky(ctx, w, h) {
      const rect = this.layout(w, h);
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y);
      ctx.lineTo(rect.x + rect.w, rect.y);
      for (let i = ridge.length - 1; i >= 0; i--) {
        ctx.lineTo(rect.x + ridge[i][0] * rect.scale,
          rect.y + (ridge[i][1] - 1) * rect.scale);
      }
      ctx.closePath();
      ctx.clip();
    }

    drawBase(ctx, w, h, dpr, state, season) {
      const winter = this.winterReady ? (season?.snow || 0) : 0;
      const altitude = state.sunAltitude;
      const warmth = (1 - smooth(7, 28, altitude)) * smooth(-12, -2, altitude);
      const night = 1 - smooth(-15, -2, altitude);
      const dusk = 1 - smooth(-10, 5, altitude);
      // Cache the expensive photographic layers; animation redraws one bitmap.
      const density = Math.min(dpr, 2, 2560 / w);
      const key = [w, h, density, Math.round(warmth * 100),
        Math.round(night * 100), Math.round(dusk * 100), Math.round(winter * 1000)].join(':');
      if (key !== this.cacheKey) {
        this.cacheKey = key;
        this.cache.width = Math.round(w * density);
        this.cache.height = Math.round(h * density);
        const c = this.cache.getContext('2d');
        c.setTransform(density, 0, 0, density, 0, 0);
        const rect = this.layout(w, h);
        c.drawImage(this.day, rect.x, rect.y, rect.w, rect.h);
        this.drawClearing(c,rect,this.clearingDay);
        c.globalAlpha = warmth;
        c.drawImage(this.eveningPlate(), rect.x, rect.y, rect.w, rect.h);
        c.globalAlpha = 1;
        if (winter > 0) {
          c.globalAlpha = winter;
          c.drawImage(this.winter, rect.x, rect.y, rect.w, rect.h);
          c.globalAlpha = 1;
          c.fillStyle = `rgba(240,163,95,${warmth * winter * .18})`;
          c.fillRect(0, 0, w, h);
        }
        c.globalCompositeOperation = 'multiply';
        // Moonlit photographic exposure: keep rock and forest detail readable.
        // The sky receives its own darker wash below, preserving night contrast.
        c.fillStyle = `rgba(66,94,140,${night * .70})`;
        c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = `rgba(12,23,43,${dusk * .20 + night * .14})`;
        c.fillRect(0, 0, w, h);
        // Fade continuously around the peaks: a hard skyline mask makes
        // small tracing differences visible when the terrain is brighter.
        const sky = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h * .58);
        sky.addColorStop(0, `rgba(2,7,21,${night * .85})`);
        sky.addColorStop(.4, `rgba(8,18,35,${night * .65})`);
        sky.addColorStop(.72, `rgba(14,29,51,${night * .25})`);
        sky.addColorStop(1, 'rgba(14,29,51,0)');
        c.fillStyle = sky;
        c.fillRect(0, 0, w, h);
      }
      ctx.drawImage(this.cache, 0, 0, w, h);
    }

    // Both disks are enlarged for readability: their centers follow the
    // calculated coordinates, their sizes are artistic. Hotspots reuse them.
    sunRadius(w, h) { return Math.max(4, this.layout(w, h).w * .0075); }
    moonRadius(w, h) { return Math.max(3.6, this.layout(w, h).w * .0068); }

    drawSun(ctx, w, h, state) {
      if (state.sunAltitude < -.833) return;
      const x = state.sunX * w, y = state.sunY * h;
      const radius = this.sunRadius(w, h);
      if (x < -radius || x > w + radius || y < -radius || y > h + radius) return;
      const visible = this.isSky(x, y - radius, w, h);
      if (!visible) return;
      ctx.save();
      this.clipSky(ctx, w, h);
      const glowRadius = radius * 9;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, 'rgba(255,246,204,.7)');
      glow.addColorStop(.10, 'rgba(255,224,157,.30)');
      glow.addColorStop(.35, 'rgba(255,191,116,.12)');
      glow.addColorStop(1, 'rgba(255,177,103,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = glow;
      ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = state.sunAltitude < 5 ? '#fff0c6' : '#fffced';
      ctx.shadowColor = '#fff2c5';
      ctx.shadowBlur = radius * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawMoon(ctx, w, h, state, phasePath) {
      if (state.moonVisibility < .01 || state.moonAltitude < 0) return;
      const x = state.moonX * w, y = state.moonY * h;
      if (!this.isSky(x, y, w, h)) return;
      const radius = this.moonRadius(w, h);
      ctx.save();
      this.clipSky(ctx, w, h);
      ctx.globalAlpha = state.moonVisibility;
      ctx.fillStyle = '#e0e7ec';
      ctx.shadowColor = '#b9cfe7';
      ctx.shadowBlur = radius * 2;
      phasePath(x, y, radius, state.moonDisplayPhase);
      ctx.fill();
      ctx.restore();
    }

    clipCloudSky(ctx,w,h,season) {
      const summer = window.PhotoSkyline.summer;
      const winter = this.winterReady ? window.PhotoSkyline.winter : summer;
      const amount = this.winterReady ? (season?.snow || 0) : 0;
      const rect = this.layout(w,h);
      ctx.beginPath(); ctx.moveTo(rect.x,rect.y); ctx.lineTo(rect.x+rect.w,rect.y);
      for (let x = WIDTH-1; x >= 0; x--) {
        const y = summer[x] * (1-amount) + winter[x] * amount;
        ctx.lineTo(rect.x+(x+.5)*rect.scale,rect.y+y*rect.scale);
      }
      ctx.closePath(); ctx.clip();
    }

    drawOvercast(ctx, w, h, state, options) {
      const cover = window.PhotoSeasons.cloudCover(options.season, options.simMs);
      if (cover <= 0) return;
      const light = smooth(-15, 12, state.sunAltitude);
      const key = Math.round(light * 50);
      if (!this.cloudPlate || this.cloudKey !== key) {
        this.cloudKey = key;
        this.cloudPlate = document.createElement('canvas');
        this.cloudPlate.width = 836; this.cloudPlate.height = 471;
        const c = this.cloudPlate.getContext('2d');
        const tone = value => Math.round(value * (.10 + light * .90));
        const sky = c.createLinearGradient(0,0,0,471);
        sky.addColorStop(0, `rgb(${tone(119)},${tone(130)},${tone(143)})`);
        sky.addColorStop(1, `rgb(${tone(200)},${tone(206)},${tone(210)})`);
        c.fillStyle = sky; c.fillRect(0,0,836,471);
        // Broad overlapping banks give the opaque sky soft cloud structure.
        for (let i = 0; i < 42; i++) {
          const x = ((Math.sin(i * 127.1 + 31) * 43758.5453) % 1 + 1) % 1 * 1000 - 80;
          const y = ((Math.sin(i * 269.5 + 17) * 22578.1459) % 1 + 1) % 1 * 520 - 30;
          c.save(); c.translate(x,y); c.scale(150 + i % 4 * 30,35 + i % 5 * 10);
          const cloud = c.createRadialGradient(0,0,0,0,0,1);
          const shade = tone(i % 3 === 0 ? 80 : 230);
          cloud.addColorStop(0, `rgba(${shade},${shade},${shade},.22)`);
          cloud.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
          c.fillStyle = cloud; c.fillRect(-1,-1,2,2); c.restore();
        }
      }
      ctx.save();
      ctx.fillStyle = `rgba(65,79,96,${cover * .19 * light})`;
      ctx.fillRect(0,0,w,h);
      this.clipCloudSky(ctx,w,h,options.season);
      ctx.globalAlpha = cover;
      const rect = this.layout(w,h);
      ctx.drawImage(this.cloudPlate,rect.x,rect.y,rect.w,rect.h * .57);
      ctx.restore();
    }

    drawWinterWeather(ctx, w, h, time, state, options) {
      const season = options.season;
      if (!this.winterReady || !season || season.amount <= 0 || options.reducedMotion) return;
      const snow = window.PhotoSeasons.snowfall(season, options.simMs);
      const rect = this.layout(w, h);
      ctx.save();
      // Sparkles stay on the snowy foreground and disappear without sunlight.
      const sunlight = smooth(0, 18, state.sunAltitude) * season.snow * (1 - window.PhotoSeasons.cloudCover(season, options.simMs));
      ctx.strokeStyle = '#fffef0';
      ctx.lineWidth = .7;
      for (let i = 0; i < 48 && sunlight > .01; i++) {
        const x = rect.x + ((i * 317.13 + 83) % 1672) * rect.scale;
        const y = rect.y + (790 + (i * 67.7 % 151)) * rect.scale;
        const pulse = Math.pow(Math.max(0, Math.sin(time * .0016 + i * 2.39)), 20);
        ctx.globalAlpha = sunlight * pulse * .8;
        const r = (1.2 + i % 3) * rect.scale;
        ctx.beginPath(); ctx.moveTo(x-r,y); ctx.lineTo(x+r,y);
        ctx.moveTo(x,y-r); ctx.lineTo(x,y+r); ctx.stroke();
      }
      if (snow > .001) {
        ctx.fillStyle = '#edf5ff';
        const count = Math.min(220, Math.round(w * h / 6500));
        for (let i = 0; i < count; i++) {
          const depth = .35 + (i % 11) / 11;
          const seconds = time / 1000;
          const seedX = ((Math.sin(i * 127.1 + 31) * 43758.5453) % 1 + 1) % 1;
          const seedY = ((Math.sin(i * 269.5 + 17) * 22578.1459) % 1 + 1) % 1;
          const x = ((seedX * (w + 40) + seconds * 12 * depth + Math.sin(seconds * .4 + i) * 16) % (w + 40) + w + 40) % (w + 40) - 20;
          const y = ((seedY * (h + 30) + seconds * 32 * depth) % (h + 30) + h + 30) % (h + 30) - 15;
          ctx.globalAlpha = snow * (.3 + depth * .4) * (.45 + state.daylight * .55);
          ctx.beginPath(); ctx.arc(x,y,.7 + depth * 1.5,0,Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    drawMist(ctx, w, h, time, state) {
      const rect = this.layout(w, h);
      const dawn = window.PhotoLifeModel.dawnMist(state.sunAltitude,state.sunAzimuth);
      const strength = .025 + .035 * (1 - smooth(0, 25, state.sunAltitude)) + dawn * .20;
      ctx.save();
      // Gentle air movement; photographic trees and rocks retain their detail.
      for (let i = 0; i < 3; i++) {
        const x = rect.x + rect.w * (.18 + i * .31 + Math.sin(time * .000012 + i) * .025);
        const y = rect.y + rect.h * (.60 + i * .035);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(rect.w * .20, rect.h * (.025 + dawn * .013));
        const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        fog.addColorStop(0, `rgba(203,218,233,${strength * (.25 + state.daylight * .75)})`);
        fog.addColorStop(1, 'rgba(203,218,233,0)');
        ctx.fillStyle = fog;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
      ctx.restore();
    }
  }
  window.photoScene = new PhotoLandscape();
})();
