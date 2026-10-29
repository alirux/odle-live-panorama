/* Photographic inhabitants share the panorama's cover transform and lighting.
 * The original landscape plates remain intact. */
(() => {
  const M = window.PhotoLifeModel;
  const HUT = { x: 1030, y: 511, width: 424, height: 160, chimneyX: 1320, chimneyY: 512 };
  // Glass of the hut windows in plate pixels, in the order of
  // PhotoLifeModel.WINDOW_LAMPS: the two front windows, then the two narrow
  // ones on the gable wall, seen at a slant. pool is the patch of ground in
  // front that the window lights; flicker is the lamp's unsteadiness.
  const WINDOWS = [
    { x: 1175.5, y: 604.5, w: 19, h: 26, pool: [1185, 669, 22, 8], flicker: .09 },
    { x: 1288, y: 613, w: 19, h: 25, pool: [1298, 674, 22, 8], flicker: .035 },
    { x: 1366, y: 610, w: 6, h: 24, pool: [1404, 664, 15, 4], flicker: .03, slant: true },
    { x: 1389, y: 608, w: 7.5, h: 21, pool: [1424, 662, 15, 4], flicker: .03, slant: true }
  ];
  const GLASS = { x: 1168, y: 598, w: 236, h: 46, density: 3 };
  // Painted Tyrolean heart: red wood, cream dotted border and a white flower.
  const BADGES = {
    edelweiss: '<img src="assets/photo/edelweiss.webp" width="28" height="28" alt="" decoding="async">',
    'tyrolean-heart': `<svg viewBox="0 0 24 22" width="15" height="14">
      <path d="M12 21C5 15.5 1 11.6 1 7c0-3.4 2.6-6 5.8-6C9 1 10.9 2.2 12 4c1.1-1.8 3-3 5.2-3C20.4 1 23 3.6 23 7c0 4.6-4 8.5-11 14z" fill="#b8242c" stroke="#f3e4c4" stroke-width="1.1"/>
      <path d="M12 21C5 15.5 1 11.6 1 7c0-3.4 2.6-6 5.8-6C9 1 10.9 2.2 12 4c1.1-1.8 3-3 5.2-3C20.4 1 23 3.6 23 7c0 4.6-4 8.5-11 14z" fill="none" stroke="#f3e4c4" stroke-width="1" stroke-linecap="round" stroke-dasharray="0 2.2" transform="translate(12 10) scale(.74) translate(-12 -10)"/>
      <g transform="translate(12 9.6)" fill="#fffaf0">${[0, 60, 120, 180, 240, 300].map(angle =>
        `<ellipse cy="-2.3" rx="1.05" ry="1.8" transform="rotate(${angle})"/>`).join('')}
        <circle r="1.05" fill="#f0c24b"/></g></svg>`
  };
  const badge = id => {
    const element = document.createElement('span');
    element.className = 'photo-life-badge' + (id === 'edelweiss' ? ' photo-life-badge-flower' : '');
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = BADGES[id];
    return element;
  };
  class PhotoLife {
    constructor() {
      this.assets = {};
      this.tints = new Map();
      this.glass = new Map();
      this.lampLevels = M.WINDOW_LAMPS.map(() => 0);
      this.cows = [0, 2, 3].map(i => M.makeCow(i));
      this.hotspots = [];
      this.hovered = null;
      this.buttons = new Map();
      // Tooltip, exploration buttons and rotate hint exist only on pages that
      // provide #photo-life-tooltip (the site); the screen saver page draws only.
      this.tooltip = document.querySelector('#photo-life-tooltip');
      if (this.tooltip) {
        this.name = this.tooltip.querySelector('strong');
        this.details = this.tooltip.querySelector('.photo-life-details');
      }
      for (const [name, src] of Object.entries({ cows: 'assets/photo/cows.webp' })) {
        const image = new Image();
        image.onload = () => { this.assets[name] = image; };
        image.onerror = () => { console.warn(`Unable to load landscape asset: ${src}`); };
        image.src = src;
      }
      this.rotateHint = document.querySelector('#photo-rotate-hint');
      if (this.rotateHint) {
        try { this.rotateHint.hidden = localStorage.getItem('lirux-photo-rotate-dismissed') === '1'; } catch (_) {}
        this.rotateHint.querySelector('button').addEventListener('click', () => {
          this.rotateHint.hidden = true;
          try { localStorage.setItem('lirux-photo-rotate-dismissed', '1'); } catch (_) {}
        });
      }
    }
    key() { return this.hovered ? `photo:${this.hovered}` : null; }
    hide() {
      this.hovered = null;
      if (!this.tooltip) return;
      this.tooltip.classList.remove('visible');
      this.tooltip.setAttribute('aria-hidden', 'true');
    }
    point(id) { return this.hotspots.find(item => item.id === id); }
    hover(x, y, touch, allowed = true) {
      if (!allowed) { this.hide(); return; }
      const hits = this.hotspots.filter(p => Math.hypot(x - p.x, y - p.y) < p.radius + (touch ? 12 : 0));
      hits.sort((a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y));
      if (hits.length) this.show(hits[0].id);
      else this.hide();
    }
    show(id) {
      if (!this.tooltip) return;
      const p = this.point(id);
      if (!p) { this.hide(); return; }
      this.hovered = id;
      const contentKey = JSON.stringify([p.name,p.rows,p.title]);
      if (contentKey !== this.tooltipContentKey) {
      this.tooltipContentKey = contentKey;
      // An optional title mixes text and badges; the plain name stays for assistive technology.
      if (p.title) this.name.replaceChildren(...p.title.map(part => BADGES[part.badge] ? badge(part.badge) : part));
      else this.name.textContent = p.name;
      this.details.replaceChildren();
      for (const [label, value] of p.rows) {
        const row = document.createElement('div');
        row.className = 'star-tooltip-row';
        const key = document.createElement('span'), text = document.createElement('span');
        key.textContent = label; text.textContent = value;
        row.append(key, text); this.details.append(row);
      }
      }
      this.tooltip.classList.add('visible');
      this.tooltip.setAttribute('aria-hidden', 'false');
      const width = this.tooltip.offsetWidth || 220, height = this.tooltip.offsetHeight || 100;
      this.tooltip.style.left = `${M.clamp(p.x + 16, 8, Math.max(8, this.w - width - 8))}px`;
      this.tooltip.style.top = `${M.clamp(p.y - height - 14, 8, Math.max(8, this.h - height - 8))}px`;
    }
    syncButtons(en) {
      if (!this.tooltip) return;
      const active = new Set();
      for (const p of this.hotspots) {
        if (p.x < 0 || p.x > this.w || p.y < 0 || p.y > this.h) continue;
        active.add(p.id);
        let button = this.buttons.get(p.id);
        if (!button) {
          button = document.createElement('button');
          button.type = 'button'; button.className = 'photo-life-target';
          button.setAttribute('aria-describedby', 'photo-life-tooltip');
          button.addEventListener('focus', () => this.show(p.id));
          button.addEventListener('blur', () => this.hide());
          button.addEventListener('click', e => { if (e.detail === 0) this.show(p.id); });
          button.addEventListener('keydown', e => { if (e.key === 'Escape') { this.hide(); button.blur(); } });
          document.body.append(button); this.buttons.set(p.id, button);
        }
        button.hidden = false;
        button.setAttribute('aria-label', `${en ? 'Explore' : 'Scopri'} ${p.name}`);
        const size = Math.max(24, p.radius * 1.5);
        const box = [Math.round(p.x - size / 2), Math.round(p.y - size / 2), Math.round(size)].join(':');
        if (button.dataset.box !== box) {
          button.dataset.box = box;
          button.style.left = `${Math.round(p.x - size / 2)}px`;
          button.style.top = `${Math.round(p.y - size / 2)}px`;
          button.style.width = button.style.height = `${Math.round(size)}px`;
        }
        if (document.activeElement === button && button.matches(':focus-visible')) this.show(p.id);
      }
      for (const [id, button] of this.buttons) button.hidden = !active.has(id);
      if (this.rotateHint) {
        this.rotateHint.querySelector('span').textContent = en
          ? 'Rotate your phone to explore the whole panorama.' : 'Ruota il telefono per esplorare tutto il panorama.';
        this.rotateHint.querySelector('button').setAttribute('aria-label', en ? 'Dismiss suggestion' : 'Chiudi il suggerimento');
      }
      if (this.hovered && !this.point(this.hovered)) this.hide();
    }
    tinted(name, state) {
      const night = 1 - M.smooth(-15, -2, state.sunAltitude);
      const dusk = 1 - M.smooth(-10, 5, state.sunAltitude);
      const warmth = (1 - M.smooth(7, 28, state.sunAltitude)) * M.smooth(-12, -2, state.sunAltitude);
      const key = [name, Math.round(night * 30), Math.round(dusk * 30), Math.round(warmth * 20)].join(':');
      if (this.tints.has(key)) return this.tints.get(key);
      const source = this.assets[name], plate = document.createElement('canvas');
      plate.width = 768;
      plate.height = Math.round(plate.width * source.height / source.width);
      const c = plate.getContext('2d');
      c.drawImage(source, 0, 0, plate.width, plate.height);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(227,147,72,${warmth * .16})`;
      c.fillRect(0, 0, plate.width, plate.height);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = `rgba(66,94,140,${night * .70})`;
      c.fillRect(0, 0, plate.width, plate.height);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(12,23,43,${dusk * .20 + night * .14})`;
      c.fillRect(0, 0, plate.width, plate.height);
      // Multiply can fill empty pixels. Restore the original alpha silhouette.
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(source, 0, 0, plate.width, plate.height);
      if (this.tints.size > 12) this.tints.delete(this.tints.keys().next().value);
      this.tints.set(key, plate);
      return plate;
    }
    shadow(ctx, x, y, rx, ry, alpha) {
      ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, `rgba(23,34,25,${alpha})`);
      gradient.addColorStop(1, 'rgba(23,34,25,0)');
      ctx.fillStyle = gradient; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    }
    drawHutDetails(ctx, state, time, schedule, reduced, season) {
      const winter = season?.snow || 0;
      if (!schedule.shuttersOpen && winter <= 0) return;
      const clock = reduced ? 1200 : time;
      const chimneyX = HUT.chimneyX - winter * 2;
      const chimneyY = HUT.chimneyY - winter * 2;
      const daylight = M.smooth(-8, 8, state.sunAltitude);
      const night = 1 - M.smooth(-15, -2, state.sunAltitude);
      const dusk = 1 - M.smooth(-10, 5, state.sunAltitude);
      // A grey core stays readable against snow; lighter edges soften the plume.
      // Without snow the plume rises against the pale scree in daylight, so
      // the summer smoke is darker there or it would vanish.
      const shade = Math.round(194 - daylight * (12 + (1 - winter) * 80));
      // Moonlit exposure close to the photo plates: slightly lighter than the
      // snow behind it, so the plume stays readable without glowing at night.
      const veil = dusk * .20 + night * .10;
      const lit = (value, channel) => {
        const tone = value * (1 - night * .6 + night * .6 * [66, 94, 140][channel] / 255);
        return Math.round(tone * (1 - veil) + [12, 23, 43][channel] * veil);
      };
      const rgb = value => [0, 1, 2].map(channel => lit(value[channel], channel)).join(',');
      const core = rgb([shade, shade + 5, shade + 9]), edge = rgb([shade + 26, shade + 30, shade + 33]);
      // The summer plume of the open hut is a little smaller than the winter
      // one but must still read at the scale of the hut; full snow keeps the
      // winter values.
      const strength = (schedule.shuttersOpen ? .6 - winter * .02 : winter * .58) * (1 - night * .2);
      const count = 22 + Math.round(winter * 10);
      const height = 80 + winter * 30;
      ctx.save();
      ctx.globalAlpha = 1;
      for (let i = 0; i < count; i++) {
        const phase = ((clock * .000065 + i / count) % 1 + 1) % 1;
        const drift = phase * (10 + winter * 25);
        const curl = Math.sin(phase * 9 - clock * .0004) * phase * (3 + winter * 7);
        const x = chimneyX + drift + curl;
        const y = chimneyY - phase * height;
        const r = 2.5 + phase * (12 + winter * 6);
        const opacity = strength * (1 - M.smooth(.25, 1, phase));
        ctx.save(); ctx.translate(x, y); ctx.scale(1, 1.5);
        const smoke = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        smoke.addColorStop(0, `rgba(${core},${opacity})`);
        smoke.addColorStop(.45, `rgba(${edge},${opacity * .65})`);
        smoke.addColorStop(1, `rgba(${edge},0)`);
        ctx.fillStyle = smoke; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
      }
      ctx.restore();
    }
    // The lit glass is taken from the photograph itself: inverting the plate
    // turns the dark panes bright and the pale frames, crossbars and walls
    // dark, so the light sits behind the real window bars.
    glassLayer(image) {
      if (this.glass.has(image)) return this.glass.get(image);
      const { x, y, w, h, density } = GLASS;
      const layer = document.createElement('canvas');
      layer.width = w * density; layer.height = h * density;
      const c = layer.getContext('2d');
      c.scale(density, density);
      c.drawImage(image, x / 1672 * image.width, y / 941 * image.height,
        w / 1672 * image.width, h / 941 * image.height, 0, 0, w, h);
      c.globalCompositeOperation = 'difference';
      const blends = c.globalCompositeOperation === 'difference';
      if (blends) {
        c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
        // Grey first, so blue reflections do not turn green under the lamp.
        c.globalCompositeOperation = 'saturation';
        c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
        // Raise the contrast: glass stays bright, frames and plaster fall away.
        const copy = document.createElement('canvas');
        copy.width = layer.width; copy.height = layer.height;
        for (let i = 0; i < 3; i++) {
          copy.getContext('2d').clearRect(0, 0, copy.width, copy.height);
          copy.getContext('2d').drawImage(layer, 0, 0);
          c.globalCompositeOperation = 'multiply';
          c.drawImage(copy, 0, 0, w, h);
        }
        c.globalCompositeOperation = 'lighter';
        c.drawImage(layer, 0, 0, w, h);
        c.drawImage(layer, 0, 0, w, h);
      } else c.clearRect(0, 0, w, h);
      // The slanted gable windows catch the daylight in the photograph, so
      // their glass cannot be read from it: a narrow lit strip stands in.
      c.globalCompositeOperation = 'source-over';
      for (const pane of WINDOWS) {
        if (!pane.slant && blends) continue;
        c.fillStyle = '#000';
        c.fillRect(pane.x - x, pane.y - y, pane.w, pane.h);
        const strip = c.createLinearGradient(pane.x - x, 0, pane.x - x + pane.w, 0);
        strip.addColorStop(0, 'rgba(255,255,255,.12)');
        strip.addColorStop(.4, 'rgba(255,255,255,.62)');
        strip.addColorStop(1, 'rgba(255,255,255,.28)');
        c.fillStyle = strip;
        c.fillRect(pane.x - x + .8, pane.y - y + .8, pane.w - 1.6, pane.h - 1.6);
        // The transom bar of the window.
        c.fillStyle = '#000';
        c.fillRect(pane.x - x, pane.y - y + pane.h * .42, pane.w, .9);
      }
      // Warm interior, brightest where a lamp would hang.
      c.globalCompositeOperation = blends ? 'multiply' : 'source-atop';
      for (const pane of WINDOWS) {
        const cx = pane.x - x + pane.w / 2, cy = pane.y - y + pane.h * .35;
        const lamp = c.createRadialGradient(cx, cy, 0, cx, cy, pane.h * .95);
        lamp.addColorStop(0, '#ffd890');
        lamp.addColorStop(.5, '#f39a46');
        lamp.addColorStop(1, '#a9481a');
        c.fillStyle = lamp; c.fillRect(pane.x - x - 2, pane.y - y - 2, pane.w + 4, pane.h + 4);
      }
      const panes = WINDOWS.map(pane => {
        const piece = document.createElement('canvas');
        piece.width = Math.ceil(pane.w * density); piece.height = Math.ceil(pane.h * density);
        piece.getContext('2d').drawImage(layer, (pane.x - x) * density, (pane.y - y) * density,
          pane.w * density, pane.h * density, 0, 0, piece.width, piece.height);
        return piece;
      });
      this.glass.set(image, panes);
      return panes;
    }
    drawWindowLights(ctx, scene, state, options) {
      const reduced = options.reducedMotion;
      const time = options.animationTime;
      const step = this.lampTime === undefined ? 1e9 : Math.max(0, time - this.lampTime);
      this.lampTime = time;
      const targets = M.windowLamps(options.hour, state.sunAltitude);
      // A lamp switched on or off takes a moment to reach its brightness.
      const ease = reduced ? 1 : 1 - Math.exp(-step / 220);
      this.lampLevels = this.lampLevels.map((level, i) => level + (targets[i] - level) * ease);
      if (!this.lampLevels.some(level => level > .002) || !scene.clearingDay.complete) return;
      // The same glow reads faintly at sunset and fully once night has fallen.
      const dark = .3 + .7 * (1 - M.smooth(-9, 2, state.sunAltitude));
      const winter = scene.winterReady ? (options.season?.snow || 0) : 0;
      const plates = [[this.glassLayer(scene.clearingDay), 1 - winter]];
      if (winter > 0) plates.push([this.glassLayer(scene.winter), winter]);
      const clock = reduced ? 0 : time;
      ctx.save();
      WINDOWS.forEach((pane, i) => {
        const level = this.lampLevels[i];
        if (level <= .002) return;
        // Slow, irregular breathing of a flame or an old bulb.
        const flicker = 1 + pane.flicker * (Math.sin(clock * .0017 + i * 2.1) * .5 +
          Math.sin(clock * .0041 + i * 4.7) * .3 + Math.sin(clock * .0113 + i) * .2);
        const glow = level * dark * flicker;
        const cx = pane.x + pane.w / 2, cy = pane.y + pane.h / 2;
        // Light falling out onto the meadow, stronger on snow.
        const [px, py, rx, ry] = pane.pool;
        ctx.globalCompositeOperation = 'screen';
        ctx.save(); ctx.translate(px, py); ctx.scale(rx, ry);
        const pool = ctx.createRadialGradient(0, -.3, 0, 0, 0, 1);
        const spill = glow * (.30 + winter * .14);
        pool.addColorStop(0, `rgba(255,170,88,${spill})`);
        pool.addColorStop(.45, `rgba(255,170,88,${spill * .45})`);
        pool.addColorStop(1, 'rgba(255,170,88,0)');
        ctx.fillStyle = pool; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
        // A soft halo in the night air around the glass.
        const radius = Math.max(pane.w, pane.h) * 1.15;
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        halo.addColorStop(0, `rgba(255,180,100,${glow * .28})`);
        halo.addColorStop(.4, `rgba(255,150,72,${glow * .09})`);
        halo.addColorStop(1, 'rgba(255,160,80,0)');
        ctx.fillStyle = halo; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.globalCompositeOperation = 'lighter';
        for (const [panes, weight] of plates) {
          if (weight <= .001) continue;
          // Enlarged faint copies spill the light onto the frame and the sill.
          for (const [grow, alpha] of [[1.35, .10], [1.14, .22], [1, 1]]) {
            ctx.globalAlpha = Math.min(1, glow * weight * alpha);
            ctx.drawImage(panes[i], cx - pane.w * grow / 2, cy - pane.h * grow / 2 + (grow - 1) * pane.h * .12,
              pane.w * grow, pane.h * grow);
          }
        }
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    }
    drawCowPose(ctx, atlas, cow, state, alpha) {
      if (alpha < .001) return;
      const column = state === 'lying' ? 2 : state === 'graze' ? 1 : 0;
      const sw = atlas.width / 3, sh = atlas.height / 2;
      const width = 64 + (cow.y - M.BOUNDS.top) * .09, height = width * sh / sw;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cow.x, cow.y); ctx.scale(cow.facing, 1);
      // Atlas hooves sit at 90% of each cell. Keep the ground fixed in every pose.
      const baseline = cow.coat ? .812 : .90;
      const top = -height * baseline;
      ctx.drawImage(atlas, column * sw, cow.coat * sh, sw, sh, -width / 2, top, width, height);
      ctx.restore();
    }
    frame(ctx, scene, w, h, state, options) {
      this.w = w; this.h = h;
      const en = options.language === 'en';
      this.hotspots = [];
      if (!scene.active) { this.hide(); this.syncButtons(en); return; }
      const rect = scene.layout(w,h);
      const hutSchedule = M.hutSchedule(options.hour, options.sunriseHour, options.sunsetHour);
      ctx.save(); ctx.translate(rect.x, rect.y); ctx.scale(rect.scale, rect.scale);
      this.drawWindowLights(ctx, scene, state, options);
      this.drawHutDetails(ctx, state, options.animationTime, hutSchedule, options.reducedMotion, options.season);
      window.photoVisitors.ground(this,ctx,rect,state,options,hutSchedule);
      const pastureVisibility = M.smooth(-2, 6, state.sunAltitude) * (options.season?.cows ?? 1);
      if (this.assets.cows && pastureVisibility > .005) {
        const atlas = this.tinted('cows', state);
        for (const cow of [...this.cows].sort((a,b) => a.y - b.y)) {
          ctx.save(); ctx.globalAlpha = pastureVisibility;
          this.shadow(ctx, cow.x, cow.y, 26, 4, .32);
          this.drawCowPose(ctx, atlas, cow, cow.state, 1);
          ctx.restore();
          if (pastureVisibility > .35) {
            const p = M.worldToScreen(rect, cow.x, cow.y - 10);
            this.hotspots.push({ ...p, id: cow.id, radius: Math.max(9, 18 * rect.scale), name: cow.name,
              rows: [[en ? 'Alpine cow' : 'Mucca alpina', en ? 'Moo!' : 'Muuuu!']] });
          }
        }
      }
      ctx.restore();
      window.photoVisitors.flights(this,ctx,scene,rect,state,options);
      const sunRadius = scene.sunRadius(w, h);
      if (state.sunAltitude >= -.833 && scene.isSky(state.sunX * w, state.sunY * h - sunRadius, w, h)) {
        this.hotspots.push({ id: 'sun', x: state.sunX * w, y: state.sunY * h, radius: sunRadius,
          name: en ? 'Sun' : 'Sole', rows: [
            [en ? 'Type' : 'Tipo', en ? 'Yellow dwarf G2V' : 'Nana gialla G2V'],
            [en ? 'Altitude' : 'Altezza', `${state.sunAltitude.toFixed(1)}°`],
            [en ? 'Azimuth' : 'Azimut', `${(state.sunAzimuth * 180 / Math.PI).toFixed(1)}°`],
            [en ? 'Mean distance' : 'Distanza media', en ? '149.6 million km' : '149,6 milioni di km'] ] });
      }
      if (state.moonVisibility >= .01 && state.moonAltitude >= 0 && scene.isSky(state.moonX * w, state.moonY * h, w, h)) {
        this.hotspots.push({ id: 'moon', x: state.moonX * w, y: state.moonY * h, radius: Math.max(8, scene.moonRadius(w, h) * 1.6),
          name: en ? 'Moon' : 'Luna', rows: [
            [en ? 'Phase' : 'Fase', options.phaseLabel],
            [en ? 'Illumination' : 'Illuminazione', `${Math.round(state.moonIllumination * 100)}%`],
            [en ? 'Altitude' : 'Altezza', `${state.moonAltitude.toFixed(1)}°`],
            [en ? 'Distance' : 'Distanza', `${Math.round(state.moonDistanceKm).toLocaleString(en ? 'en-GB' : 'it-IT')} km`] ] });
      }
      this.syncButtons(en);
    }
  }
  window.photoLife = new PhotoLife();
})();
