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

  // Coarse skyline traced by hand in plate pixels. It is only the guide that
  // core/scripts/generate-photo-skyline.cjs refines into PhotoSkyline, the dense
  // edge that actually occludes the sky: between its points this polyline cuts
  // through the notches between peaks, so bodies drawn against it showed in
  // front of the rock. The photograph itself is never cut or reshaped.
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
    [1359,309],[1370,350],[1383,363],[1398,351],[1407,346],
    [1411,353],[1415,362],[1419,361],[1422,368],[1427,372],
    [1431,380],[1434,381],[1438,383],[1440,390],[1441,401],
    [1456,410],[1478,416],[1501,426],
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
      // Cloud masks of the three plates (white = thick cloud), built by
      // core/scripts/generate-cloud-masks.cjs. The photographic clouds are fixed,
      // so bodies behind them are dimmed and diffused rather than hidden.
      this.cloudMasks = {};
      this.cloudMix = { warmth: 0, winter: 0 };
      for (const [name, src] of [
        ['day', 'assets/photo/clouds-day.png'],
        ['sunset', 'assets/photo/clouds-sunset.png'],
        ['winter', 'assets/photo/clouds-winter.png']
      ]) {
        const image = new Image();
        image.onload = () => { this.cloudMasks[name] = this.readCloudMask(image); this.cacheKey = ''; };
        image.onerror = () => { console.warn('Unable to load cloud mask', src); };
        image.src = src;
      }
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

    readCloudMask(image) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const c = canvas.getContext('2d', { willReadFrequently: true });
        c.drawImage(image, 0, 0);
        const rgba = c.getImageData(0, 0, image.width, image.height).data;
        const data = new Uint8Array(image.width * image.height);
        for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
        return { w: image.width, h: image.height, data };
      } catch (error) {
        console.warn('Unable to read cloud mask', error);
        return null;
      }
    }

    // Cloud density in front of a plate point, 0 (clear) to 1 (thick), blended
    // across the plates exactly as drawBase blends the photographs.
    plateCloud(px, py) {
      const sample = mask => {
        if (!mask) return 0;
        const u = clamp(px / WIDTH * mask.w - .5, 0, mask.w - 1);
        const v = clamp(py / HEIGHT * mask.h - .5, 0, mask.h - 1);
        const x0 = Math.floor(u), y0 = Math.floor(v);
        const x1 = Math.min(mask.w - 1, x0 + 1), y1 = Math.min(mask.h - 1, y0 + 1);
        const fx = u - x0, fy = v - y0, d = mask.data, w = mask.w;
        const top = d[y0 * w + x0] * (1 - fx) + d[y0 * w + x1] * fx;
        const bottom = d[y1 * w + x0] * (1 - fx) + d[y1 * w + x1] * fx;
        return (top * (1 - fy) + bottom * fy) / 255;
      };
      const { warmth, winter } = this.cloudMix;
      const masks = this.cloudMasks;
      const summer = sample(masks.day) * (1 - warmth) + sample(masks.sunset) * warmth;
      return winter > 0 ? summer * (1 - winter) + sample(masks.winter) * winter : summer;
    }

    // Screen point version, for stars, planets and the station.
    cloudDensity(x, y, w, h) {
      const rect = this.layout(w, h);
      return this.plateCloud((x - rect.x) / rect.scale, (y - rect.y) / rect.scale);
    }

    // Average over a disk, so the sun and the moon fade smoothly into a cloud
    // instead of switching when their centre crosses its edge.
    diskCloud(x, y, radius, w, h) {
      let sum = this.cloudDensity(x, y, w, h);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        sum += this.cloudDensity(x + Math.cos(angle) * radius * .8, y + Math.sin(angle) * radius * .8, w, h);
      }
      return sum / 7;
    }

    // The cloud masks blended for the current light, at mask resolution: the
    // alpha is the cloud density, the colour the night sky. drawBase lays it
    // over the photographic clouds at night; the disks are cut out by it.
    // Returns null where no canvas is available (tests) or no mask loaded.
    cloudLayer() {
      const ref = this.cloudMasks.day || this.cloudMasks.sunset || this.cloudMasks.winter;
      if (!ref) return null;
      const { warmth, winter } = this.cloudMix;
      const key = [Object.keys(this.cloudMasks).length, Math.round(warmth * 50), Math.round(winter * 50)].join(':');
      if (this.cloudLayerKey === key) return this.cloudLayerCanvas;
      let canvas = null;
      try {
        canvas = document.createElement('canvas');
        canvas.width = ref.w; canvas.height = ref.h;
        const c = canvas.getContext('2d');
        const image = c.createImageData(ref.w, ref.h);
        for (let y = 0; y < ref.h; y++) for (let x = 0; x < ref.w; x++) {
          const i = (y * ref.w + x) * 4;
          image.data[i] = 10; image.data[i + 1] = 20; image.data[i + 2] = 38;
          image.data[i + 3] = Math.round(255 * this.plateCloud((x + .5) / ref.w * WIDTH, (y + .5) / ref.h * HEIGHT));
        }
        c.putImageData(image, 0, 0);
      } catch (_) {
        canvas = null;
      }
      this.cloudLayerKey = key;
      this.cloudLayerCanvas = canvas;
      return canvas;
    }

    // Draws a disk through the clouds: the part over open sky stays sharp and
    // the part behind a cloud fades, following the cloud's own outline.
    // `draw` paints in screen coordinates; `extent` bounds what it paints.
    // Returns false when the layer is unavailable, so the caller draws directly.
    drawBehindClouds(ctx, x, y, extent, w, h, draw) {
      const clouds = this.cloudLayer();
      if (!clouds) return false;
      const transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
      const pixel = Math.max(1, transform ? Math.hypot(transform.a, transform.b) : 1);
      const size = Math.ceil(extent * 2);
      if (!this.diskLayer) this.diskLayer = document.createElement('canvas');
      const layer = this.diskLayer;
      layer.width = Math.ceil(size * pixel); layer.height = Math.ceil(size * pixel);
      const c = layer.getContext('2d');
      c.setTransform(pixel, 0, 0, pixel, -(x - extent) * pixel, -(y - extent) * pixel);
      draw(c);
      c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = .9;
      c.shadowBlur = 0;
      const rect = this.layout(w, h);
      c.drawImage(clouds, rect.x, rect.y, rect.w, rect.h);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.drawImage(layer, x - extent, y - extent, size, size);
      ctx.restore();
      return true;
    }

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

    // Dense photographic sky edge for the current season, one value per plate
    // column. The traced profile sometimes drops into a hairline crack in the
    // rock, so the mountain is widened by SKY_EDGE_GROW columns on each side:
    // a body may hide a little early, but never shows in front of a peak.
    skyEdge() {
      const profile = typeof window !== 'undefined' && window.PhotoSkyline;
      if (!profile) return null;
      const amount = Math.round(clamp(this.winterReady ? this.snow || 0 : 0) * 100) / 100;
      if (this.skyEdgeCache && this.skyEdgeAmount === amount) return this.skyEdgeCache;
      const SKY_EDGE_GROW = 2;
      const blended = profile.summer.map((y, x) => y * (1 - amount) + profile.winter[x] * amount);
      this.skyEdgeCache = blended.map((_, x) => {
        let top = Infinity;
        for (let i = Math.max(0, x - SKY_EDGE_GROW); i <= Math.min(WIDTH - 1, x + SKY_EDGE_GROW); i++) {
          top = Math.min(top, blended[i]);
        }
        return top;
      });
      this.skyEdgeAmount = amount;
      return this.skyEdgeCache;
    }

    isSky(x, y, w, h) {
      const rect = this.layout(w, h);
      if (!(x >= 0 && x <= w && y >= 0 && y <= h)) return false;
      const px = (x - rect.x) / rect.scale, py = (y - rect.y) / rect.scale;
      const edge = this.skyEdge();
      if (!edge) return py < this.skylineY(px);
      return py < edge[Math.max(0, Math.min(WIDTH - 1, Math.floor(px)))];
    }

    clipSky(ctx, w, h) {
      const rect = this.layout(w, h);
      const edge = this.skyEdge();
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y);
      ctx.lineTo(rect.x + rect.w, rect.y);
      if (edge) {
        // Step along each column so a peak is never shaved by a diagonal.
        for (let x = WIDTH - 1; x >= 0; x--) {
          const y = rect.y + edge[x] * rect.scale;
          ctx.lineTo(rect.x + (x + 1) * rect.scale, y);
          ctx.lineTo(rect.x + x * rect.scale, y);
        }
      } else {
        for (let i = ridge.length - 1; i >= 0; i--) {
          ctx.lineTo(rect.x + ridge[i][0] * rect.scale,
            rect.y + (ridge[i][1] - 1) * rect.scale);
        }
      }
      ctx.closePath();
      ctx.clip();
    }

    drawBase(ctx, w, h, dpr, state, season) {
      const winter = this.winterReady ? (season?.snow || 0) : 0;
      // The sky edge follows the same summer to winter blend as the plates.
      this.snow = season?.snow || 0;
      const altitude = state.sunAltitude;
      const warmth = (1 - smooth(7, 28, altitude)) * smooth(-12, -2, altitude);
      const night = 1 - smooth(-15, -2, altitude);
      const dusk = 1 - smooth(-10, 5, altitude);
      // The cloud masks follow the same blend as the plates drawn below.
      this.cloudMix = { warmth, winter };
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
        // At night the daylight clouds of the photographs would glow against
        // the dark sky and sit in front of the stars: fold them into the sky.
        const veil = night > .01 ? this.cloudLayer() : null;
        if (veil) {
          c.globalAlpha = night * .35;
          c.drawImage(veil, rect.x, rect.y, rect.w, rect.h);
          c.globalAlpha = 1;
        }
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
      // Behind a cloud the disk fades along the cloud's outline while the glow
      // spreads and a warm spot tints the cloud, so the cloud reads as lit from
      // behind and the sun's position stays readable.
      const cloud = this.diskCloud(x, y, radius, w, h);
      ctx.save();
      this.clipSky(ctx, w, h);
      const glowRadius = radius * 9 * (1 + cloud * .6);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, 'rgba(255,246,204,.7)');
      glow.addColorStop(.10, 'rgba(255,224,157,.30)');
      glow.addColorStop(.35, 'rgba(255,191,116,.12)');
      glow.addColorStop(1, 'rgba(255,177,103,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1 - cloud * .2;
      ctx.fillStyle = glow;
      ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
      ctx.globalCompositeOperation = 'source-over';
      if (cloud > .02) {
        // Screen light cannot brighten a white cloud: a warm tint can.
        const spotRadius = radius * 3;
        const spot = ctx.createRadialGradient(x, y, 0, x, y, spotRadius);
        spot.addColorStop(0, 'rgba(255,232,170,.55)');
        spot.addColorStop(.45, 'rgba(255,222,160,.22)');
        spot.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.globalAlpha = cloud;
        ctx.fillStyle = spot;
        ctx.fillRect(x - spotRadius, y - spotRadius, spotRadius * 2, spotRadius * 2);
        ctx.globalAlpha = 1;
      }
      const disk = c => {
        c.fillStyle = state.sunAltitude < 5 ? '#fff0c6' : '#fffced';
        c.shadowColor = '#fff2c5';
        c.shadowBlur = radius * 1.5;
        c.beginPath();
        c.arc(x, y, radius, 0, Math.PI * 2);
        c.fill();
      };
      if (!this.drawBehindClouds(ctx, x, y, radius * 3, w, h, disk)) {
        ctx.globalAlpha = 1 - cloud * .9;
        disk(ctx);
      }
      ctx.restore();
    }

    drawMoon(ctx, w, h, state, phasePath) {
      if (state.moonVisibility < .01 || state.moonAltitude < 0) return;
      const x = state.moonX * w, y = state.moonY * h;
      if (!this.isSky(x, y, w, h)) return;
      const radius = this.moonRadius(w, h);
      const cloud = this.diskCloud(x, y, radius, w, h);
      ctx.save();
      this.clipSky(ctx, w, h);
      if (cloud > .02) {
        // The cloud catches the moonlight: a soft halo marks where it is.
        const haloRadius = radius * 5;
        const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
        halo.addColorStop(0, 'rgba(214,228,240,.35)');
        halo.addColorStop(1, 'rgba(214,228,240,0)');
        ctx.globalAlpha = state.moonVisibility * cloud * (state.moonIllumination ?? 1);
        ctx.fillStyle = halo;
        ctx.fillRect(x - haloRadius, y - haloRadius, haloRadius * 2, haloRadius * 2);
      }
      const points = window.OdleAstronomy?.moonPhasePoints;
      const disk = (c, fade = 0) => {
        c.globalAlpha = state.moonVisibility * (1 - fade);
        c.fillStyle = '#e0e7ec';
        c.shadowColor = '#b9cfe7';
        c.shadowBlur = radius * 2;
        if (c === ctx || !points) phasePath(x, y, radius, state.moonDisplayPhase);
        else {
          // phasePath draws on the scene's own context, so the layer gets its own path.
          c.beginPath();
          points(x, y, radius, state.moonDisplayPhase, 64)
            .forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py));
          c.closePath();
        }
        c.fill();
      };
      if (!points || !this.drawBehindClouds(ctx, x, y, radius * 4, w, h, c => disk(c))) {
        disk(ctx, cloud * .85);
      }
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
