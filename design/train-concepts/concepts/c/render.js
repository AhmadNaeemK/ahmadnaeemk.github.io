/* Concept C renderer: a top-down pixel town drawn into a small buffer and scaled up with hard pixels. */
(function () {
  'use strict';
  const RW = window.RailWorld, TAU = RW.TAU;
  const canvas = document.querySelector('.screen__canvas');
  const ROOT = canvas.closest('[data-concept]') || document.documentElement;
  const HERO = canvas.closest('[data-rail-hero]');
  const ctx = canvas.getContext('2d');
  const X0 = -24, WW = 768;
  let Y0 = -66, WH = 302, compact = false;
  let BW = 384, BH = 132, s = 0.5, px = 3, night = false;
  let img = null, buf = null, base = null, needStatic = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let saved = null; try { saved = localStorage.getItem('rail-livery'); } catch (e) {}
  const world = RW.createWorld({ livery: saved || 'toy', startStopped: reduce, seed: 31 });

  // ---------- palettes ----------
  const DAY = { grass: '#96B258', grassD: '#86A24C', grassL: '#A9C268', water: '#4FA3B0', waterL: '#8CD3D6', ballast: '#B49A80', ballastD: '#9C8268',
    sleeper: '#7A4E32', rail: '#5E5A62', railL: '#9C98A0', stone: '#D4C3A5', stoneD: '#A89478', plankA: '#C99A62', plankB: '#B78850', seam: '#8A6040', edge: '#F2C230',
    hill: '#6E9244', hillD: '#5A7C38', mouth: '#1E1612', shoulder: '#C7B27A', outline: '#2B1D1A', glass: '#2F3A4A', trunk: '#6A4630', smoke: '#FFF8EE',
    roofs: ['#C8463C', '#7A4A82', '#4F86C9'], wall: '#F3DDB0', trees: ['#7E9C3A', '#C68A2A', '#B0552C', '#93A83E', '#D9A43A'], flowers: ['#F2C14E', '#E8665A', '#FFF3DA', '#D98AB8'], lamp: '#F6E7C0' };
  const NIGHT = { grass: '#3C5A3E', grassD: '#334E36', grassL: '#46664A', water: '#2C5D78', waterL: '#4D86A0', ballast: '#5E5666', ballastD: '#4C4554',
    sleeper: '#3E2C2A', rail: '#8E8AA0', railL: '#B4B0C6', stone: '#6B6480', stoneD: '#544E66', plankA: '#6E5246', plankB: '#5E443A', seam: '#3E2C26', edge: '#E0B040',
    hill: '#2E4632', hillD: '#263B2A', mouth: '#0A0810', shoulder: '#4E5A40', outline: '#0E0B18', glass: '#FFD86B', trunk: '#3E2C26', smoke: '#A8A2B8',
    roofs: ['#7E3A3A', '#563A62', '#3A5482'], wall: '#7D6A6A', trees: ['#46602E', '#7A5A2A', '#6E3A26', '#55642E', '#806430'], flowers: ['#8E7A3A', '#7A4A48', '#8A8690', '#7A5A70'], lamp: '#FFD86B' };
  let P = DAY;

  const rgbCache = {};
  function rgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    const n = parseInt(hex.slice(1), 16);
    return (rgbCache[hex] = [n >> 16, n >> 8 & 255, n & 255]);
  }
  const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
  const C = hex => { const c = rgb(hex); return pack(c[0], c[1], c[2]); };
  function dimC(hex, k) { const c = rgb(hex); return pack(Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0); }
  function set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < BW && y < BH) buf[y * BW + x] = c; }
  function darken(x, y, k) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const v = buf[y * BW + x];
    buf[y * BW + x] = pack((v & 255) * k | 0, (v >> 8 & 255) * k | 0, (v >> 16 & 255) * k | 0);
  }
  function lighten(x, y, add) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const v = buf[y * BW + x];
    buf[y * BW + x] = pack(Math.min(255, (v & 255) + add[0]), Math.min(255, (v >> 8 & 255) + add[1]), Math.min(255, (v >> 16 & 255) + add[2]));
  }
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const bx = x => (x - X0) * s, by = y => (y - Y0) * s;

  function disc(cx, cy, r, fn) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + .5 - cx, y + .5 - cy);
        if (d <= r) fn(x, y, d);
      }
  }

  // ---------- sizing ----------
  function resize() {
    const avail = canvas.parentElement.clientWidth;
    if (!avail) return; // hidden: size again when shown
    px = avail >= 900 ? 3 : avail >= 520 ? 2 : 1;
    compact = avail < 600; Y0 = compact ? -28 : -66; WH = compact ? 264 : 302;
    if (HERO) HERO.dataset.now = compact ? 'html' : 'board';
    BW = Math.floor(avail / px); BH = Math.round(BW * WH / WW); s = BW / WW;
    canvas.width = BW; canvas.height = BH;
    canvas.style.width = BW * px + 'px'; canvas.style.height = BH * px + 'px';
    img = ctx.createImageData(BW, BH); buf = new Uint32Array(img.data.buffer); base = new Uint32Array(BW * BH);
    needStatic = true;
  }
  new ResizeObserver(resize).observe(canvas.parentElement); resize();
  RW.bindTheme(d => { night = d; P = d ? NIGHT : DAY; needStatic = true; });

  // ---------- decor ----------
  const TREES = [[188, 52], [236, 78], [340, 36], [462, 72], [516, 42], [552, 84], [640, 52], [684, 86], [-12, 120], [-10, 196], [745, 150], [742, 208],
    [-8, 30], [748, 40], [190, 228], [322, 232], [410, 228], [500, 230], [652, 230]];
  const HOUSES = [[298, 66, 26, 16, 0], [404, 58, 20, 14, 1], [600, 64, 22, 15, 2]];
  const LAMPS = [[107, 46], [106, 140], [480, 22], [690, 100]];

  function track(parts, opt) {
    const hb = Math.max(2.5, 7.5 * s), gr = Math.max(1.5, 3.4 * s), sl = Math.max(2, 6 * s), sp = Math.max(2.5, 5.5 * s);
    const pts = [];
    for (const seg of parts) {
      const n = Math.ceil(seg.len * s / 0.4);
      for (let i = 0; i <= n; i++) { const p = seg.at(seg.len * i / n); pts.push({ x: bx(p.x), y: by(p.y), nx: -Math.sin(p.a), ny: Math.cos(p.a), d: i * 0.4 }); }
    }
    if (opt && opt.shadow) {
      const seen = new Set();
      for (const p of pts) for (let t = -hb - 1.5; t <= hb + 1.5; t += .5) {
        const x = Math.round(p.x + p.nx * t + 2), y = Math.round(p.y + p.ny * t + 4), key = y * BW + x;
        if (!seen.has(key)) { seen.add(key); darken(x, y, .62); }
      }
    } else {
      // a worn dirt shoulder makes the letters read from a distance
      const sh = C(P.shoulder);
      for (const p of pts) for (let t = -hb - 1.5; t <= hb + 1.5; t += .5) { const x = Math.round(p.x + p.nx * t), y = Math.round(p.y + p.ny * t); if (hash(x, y) > .25) set(x, y, sh); }
    }
    const bal = opt && opt.deck ? dimC(P.stone, 1.05) : C(P.ballast), balD = opt && opt.deck ? C(P.stone) : C(P.ballastD);
    for (const p of pts) for (let t = -hb; t <= hb; t += .5) { const x = Math.round(p.x + p.nx * t), y = Math.round(p.y + p.ny * t); set(x, y, hash(x, y) < .3 ? balD : bal); }
    if (opt && opt.deck) for (const p of pts) for (const t of [-hb - 1.5, -hb - .5, hb + .5, hb + 1.5]) { const x = Math.round(p.x + p.nx * t), y = Math.round(p.y + p.ny * t); set(x, y, C(P.stoneD)); }
    const sc = C(P.sleeper);
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      acc += 0.4; if (acc < sp) continue; acc = 0;
      const p = pts[i]; for (let t = -sl; t <= sl; t += .5) set(Math.round(p.x + p.nx * t), Math.round(p.y + p.ny * t), sc);
    }
    const rc = C(P.rail);
    for (const p of pts) { set(Math.round(p.x + p.nx * gr), Math.round(p.y + p.ny * gr), rc); set(Math.round(p.x - p.nx * gr), Math.round(p.y - p.ny * gr), rc); }
  }

  function tree(wx, wy, r, k) {
    const cx = bx(wx), cy = by(wy), R = Math.max(3, r * s), col = P.trees[k % P.trees.length];
    disc(cx + 2, cy + 2, R, (x, y) => darken(x, y, .72));
    const cD = dimC(col, .78), cL = dimC(col, 1.18), cO = C(P.outline);
    disc(cx, cy, R, (x, y, d) => {
      const lx = x + .5 - cx, ly = y + .5 - cy;
      set(x, y, d > R - 1 ? cO : (lx + ly > R * .5 ? cD : (lx + ly < -R * .6 ? cL : C(col))));
    });
  }

  function buildStatic() {
    buf = base;
    const g = C(P.grass), gD = C(P.grassD), gL = C(P.grassL);
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const h = hash(x, y), big = hash((x / 9) | 0, (y / 7) | 0);
      buf[y * BW + x] = h < .07 ? gD : h > .955 ? gL : (big < .18 ? gD : g);
    }
    for (let i = 0; i < 140; i++) { const x = hash(i, 7) * BW, y = hash(i, 13) * BH; set(x, y, C(P.flowers[i % 4])); }
    // pond in the first a
    const pc = { x: bx(50), y: by(152) }, pr = 23 * s;
    disc(pc.x, pc.y, pr + 1, (x, y, d) => set(x, y, d > pr ? C(P.stoneD) : (hash(x, y) < .06 ? C(P.waterL) : C(P.water))));
    for (let k = 0; k < 5; k++) set(pc.x - 4 + k, pc.y - 3, C(P.waterL));
    // track
    track(world.letters.flatMap(l => l.parts));
    // platforms
    for (const st of world.stations) {
      const pl = st.platform;
      if (pl.type === 'rect') {
        const x0 = Math.round(bx(pl.x)), y0 = Math.round(by(pl.y)), x1 = Math.round(bx(pl.x + pl.w)), y1 = Math.round(by(pl.y + pl.h));
        if (st.elevated) for (let y = y0 + 2; y <= y1 + 3; y++) for (let x = x0 + 2; x <= x1 + 2; x++) darken(x, y, .7);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || y === y0 || x === x1 || y === y1;
          set(x, y, edge ? C(P.seam) : ((st.elevated ? x : y) % 2 ? C(P.plankA) : C(P.plankB)));
        }
        if (st.id === 'sky') for (let x = x0 + 1; x < x1; x++) set(x, y0 + 1, C(P.edge)); else for (let y = y0 + 1; y < y1; y++) set(x1 - 1, y, C(P.edge));
      } else {
        const cx = bx(pl.cx), cy = by(pl.cy), r = pl.r * s;
        disc(cx, cy, r, (x, y, d) => set(x, y, d > r - 1 ? C(P.stoneD) : d > r - 2 ? C(P.edge) : ((x + y) % 4 < 2 ? C(P.stone) : C(P.stoneD))));
        disc(cx, cy, Math.max(2, 4.5 * s * 2), (x, y, d) => set(x, y, d > 3.2 * s * 2 ? C(P.stoneD) : C(P.water)));
        set(cx, cy - 1, C(P.waterL));
      }
    }
    // bridge: shadow, stone deck with parapets, track on top
    track(world.bridge, { shadow: true, deck: true });
    for (const seg of world.bridge) {
      const n = Math.ceil(seg.len * s / 4);
      for (let i = 0; i <= n; i++) { const p = seg.at(seg.len * i / n); const hb = Math.max(2.5, 7.5 * s) + 1; set(bx(p.x) - Math.sin(p.a) * hb, by(p.y) + Math.cos(p.a) * hb, C(P.stone)); }
    }
    // houses
    for (const [x, y, w, h, k] of HOUSES) {
      const x0 = Math.round(bx(x - w / 2)), y0 = Math.round(by(y - h / 2)), x1 = Math.round(bx(x + w / 2)), y1 = Math.round(by(y + h / 2));
      for (let yy = y0 + 2; yy <= y1 + 2; yy++) for (let xx = x0 + 2; xx <= x1 + 2; xx++) darken(xx, yy, .7);
      const roof = P.roofs[k], mid = (y0 + y1) >> 1;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const edge = xx === x0 || xx === x1 || yy === y0 || yy === y1;
        set(xx, yy, edge ? C(P.outline) : yy === mid ? dimC(roof, 1.25) : yy < mid ? dimC(roof, 1.08) : dimC(roof, .82));
      }
      set(x1 - 3, y0 + 1, C(P.outline)); set(x1 - 3, y0 + 2, C(P.outline)); set(x1 - 4, y0 + 1, C(P.outline));
      if (night) { set(x0 + 2, y1 + 1, C(P.lamp)); set(x1 - 2, y1 + 1, C(P.lamp)); }
    }
    // trees
    TREES.forEach(([x, y], i) => tree(x, y, i >= 14 ? 6 : 9 + (i % 3) * 1.5, i));
    // lamps
    for (const [x, y] of LAMPS) { set(bx(x), by(y), C(P.outline)); set(bx(x), by(y) - 1, C(P.lamp)); }
    // tunnel mounds with dark mouths
    for (const p of world.portals) {
      const cx = bx(p.x + p.dx * 14), cy = by(p.y + p.dy * 14), R = 14 * s + 1;
      const mx = bx(p.x), my = by(p.y), mr = Math.max(3, 7.5 * s + 1);
      disc(cx, cy, R, (x, y, d) => {
        const ahead = (x + .5 - mx) * p.dx + (y + .5 - my) * p.dy;
        if (ahead < 0) return;
        set(x, y, d > R - 1 ? C(P.outline) : (hash(x, y) < .25 ? C(P.stoneD) : (d > R - 2.2 ? C(P.hillD) : C(P.hill))));
      });
      disc(mx, my, mr + 1, (x, y, d) => {
        const ahead = (x + .5 - mx) * p.dx + (y + .5 - my) * p.dy;
        if (ahead < 0) return;
        set(x, y, d > mr ? C(P.stone) : C(P.mouth));
      });
    }
    needStatic = false;
  }

  // ---------- dynamic ----------
  function carPixel(c, uw, vw) {
    const L = c.len, W = 10.5, h = W / 2, id = world.liveryId, Lv = world.livery.colors;
    const edgeU = 0.95 / s, edgeV = 0.95 / s;
    let half = h;
    if (c.kind === 'nose' && uw > L / 2 - 12) half = h * Math.sqrt(Math.max(0, (L / 2 - uw) / 12));
    if (Math.abs(uw) > L / 2 || Math.abs(vw) > half) return null;
    const dimK = night ? .72 : 1;
    if (Math.abs(uw) > L / 2 - edgeU || Math.abs(vw) > half - edgeV) return C(P.outline);
    const glass = night ? C('#FFD86B') : C(id === 'toy' ? Lv.window : '#2F3A4A');
    if (c.kind === 'loco') {
      if (uw < -L / 2 + 9) return Math.abs(uw + L / 2 - 2.5) < 1.2 ? glass : dimC(id === 'toy' ? Lv.coach2 : Lv.roof, dimK * 1.1);
      if (Math.hypot(uw - (L / 2 - 6), vw) < 2.4) return dimC(id === 'toy' ? Lv.trim : '#231c1a', dimK);
      if (Math.hypot(uw - (L / 2 - 13), vw) < 1.8) return dimC(Lv.trim, dimK);
      if (Math.abs(vw) > h - 1.6) return dimC('#2a2220', dimK);
      if (id !== 'toy' && Math.abs(((uw + 50) % 5) - 2.5) < .5) return dimC(Lv.trim, dimK * .9);
      return dimC(Lv.body, dimK * (vw < 0 ? 1.12 : 1));
    }
    if (c.kind === 'tender') return Math.abs(uw) < L / 2 - 2 && Math.abs(vw) < h - 2 ? dimC(hash(uw * 3 | 0, vw * 3 | 0) < .2 ? '#4a423c' : '#1d1714', 1) : dimC(Lv.body, dimK);
    const body = c.kind === 'coach' ? (id === 'toy' ? (c.i % 2 ? Lv.coach : Lv.coach2) : (Lv.coach || Lv.body)) : Lv.body;
    if ((c.kind === 'cab' && uw > L / 2 - 4) || (c.kind === 'nose' && uw > L / 2 - 10 && uw < L / 2 - 5)) return Math.abs(vw) < half - 1.4 ? glass : dimC(body, dimK);
    if (Math.abs(vw) < 1.8 && Math.abs(uw) < L / 2 - 3) {
      const span = L - 6, k = Math.floor((uw + L / 2 - 3) / (span / 6)), who = c.passengers[k];
      return who ? C(who.color) : glass;
    }
    if (Math.abs(vw) > h - 2.4) return dimC(Lv.trim, dimK);
    return dimC(body, dimK * (vw < 0 ? 1.1 : 1));
  }

  function drawCar(c) {
    const cx = bx(c.x), cy = by(c.y), cs = Math.cos(c.a), sn = Math.sin(c.a), R = c.len * s / 2 + 3;
    const lift = c.z > 0.5 ? 2 : 1;
    const inClip = (ix, iy) => {
      if (!c.clip) return true;
      const wx = X0 + (ix + .5) / s, wy = Y0 + (iy + .5) / s;
      return (wx - c.clip.x) * c.clip.nx + (wy - c.clip.y) * c.clip.ny >= 0;
    };
    const local = (ix, iy) => {
      const dx = ix + .5 - cx, dy = iy + .5 - cy;
      let u = (dx * cs + dy * sn) / s; const v = (-dx * sn + dy * cs) / s;
      if (c.rev) u = -u;
      return [u, v];
    };
    for (let iy = Math.floor(cy - R); iy <= Math.ceil(cy + R); iy++) for (let ix = Math.floor(cx - R); ix <= Math.ceil(cx + R); ix++) {
      const [u, v] = local(ix - lift, iy - lift - (c.z > .5 ? 1 : 0));
      if (Math.abs(u) <= c.len / 2 && Math.abs(v) <= 5.25 && inClip(ix, iy)) darken(ix, iy, .72);
    }
    for (let iy = Math.floor(cy - R); iy <= Math.ceil(cy + R); iy++) for (let ix = Math.floor(cx - R); ix <= Math.ceil(cx + R); ix++) {
      if (!inClip(ix, iy)) continue;
      const [u, v] = local(ix, iy);
      const col = carPixel(c, u, v);
      if (col !== null) buf[(iy * BW + ix) | 0] !== undefined && set(ix, iy, col);
    }
  }

  function drawPerson(p, t) {
    if (p.alpha <= 0) return;
    const x = Math.round(bx(p.x)), y = Math.round(by(p.y));
    if (p.alpha < .6 && (x + y + t) % 2) return;
    const step = p.moving && (Math.floor(p.phase * 1.5) % 2);
    set(x, y + (step ? 0 : 0), C(p.color));
    set(x, y - 1, C(p.skin));
    if (px === 1) set(x, y + 1, C(p.color));
  }

  function drawPuffs(t) {
    for (const q of world.puffs) {
      const k = q.life / q.max, r = Math.max(1, q.r * s * 1.2), cx = bx(q.x), cy = by(q.y - q.z * 0.6);
      const col = C(P.smoke);
      disc(cx, cy, r, (x, y) => { if (k < .45 || (x + y + t) % 2 === 0) if (k < .85) set(x, y, col); });
    }
  }

  function glow(cx, cy, r, add) {
    disc(cx, cy, r, (x, y, d) => { if ((x + y) % 2 === 0 || d < r * .45) lighten(x, y, add); });
  }

  // ---------- "right now" billboard ----------
  const ITEMS = RW.nowItems(ROOT).map(([k, v]) => [k.toUpperCase(), v.toUpperCase()]);
  let BB = null;
  function billboardBox() {
    const lab = textWidth('NOW') + 9, kw = Math.max(...ITEMS.map(([k]) => textWidth(k))), vw = Math.max(...ITEMS.map(([, v]) => textWidth(v)));
    const w = lab + 6 + kw + 5 + vw + 6, h = 17, cx = Math.round(bx(430));
    const x0 = cx - (w >> 1), y0 = Math.round(by(-58));
    return { x0, y0, x1: x0 + w, y1: y0 + h, lab: x0 + lab, kx: x0 + lab + 6, vx: x0 + lab + 6 + kw + 5 };
  }
  function billboardFrame() {
    if (compact || !ITEMS.length) return;
    BB = billboardBox();
    const { x0, y0, x1, y1, lab } = BB, legY = Math.round(by(-8));
    for (const lx of [x0 + 6, x1 - 6]) for (let y = y1; y <= legY; y++) { set(lx, y, C(P.outline)); set(lx + 1, y, C(P.sleeper)); }
    for (let y = y0 + 2; y <= y1 + 2; y++) for (let x = x0 + 2; x <= x1 + 2; x++) darken(x, y, .7);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      set(x, y, edge ? C(P.outline) : (x < lab ? C('#C8463C') : C('#1E1612')));
    }
    if (night) for (let x = x0 + 3; x < x1; x += 6) set(x, y0 - 1, C(P.lamp));
  }
  // 5x7 bitmap font so the billboard text stays on the pixel grid
  const GLYPHS = {
    A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
    D: '11100 10010 10001 10001 10001 10010 11100', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '111 010 010 010 010 010 111',
    J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
    P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
    V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
    0: '01110 10001 10011 10101 11001 10001 01110', 1: '010 110 010 010 010 010 111', 2: '01110 10001 00001 00010 00100 01000 11111',
    3: '11111 00010 00100 00010 00001 10001 01110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
    6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
    9: '01110 10001 10001 01111 00001 00010 01100',
    "'": '1 1 0 0 0 0 0', '-': '000 000 000 111 000 000 000', '.': '0 0 0 0 0 0 1', '·': '0 0 0 1 0 0 0', ':': '0 0 1 0 0 1 0',
    ',': '00 00 00 00 00 01 10', '!': '1 1 1 1 1 0 1', '?': '01110 10001 00001 00010 00100 00000 00100',
    '&': '01100 10010 10100 01000 10101 10010 01101', '/': '00001 00010 00010 00100 01000 01000 10000',
    '(': '001 010 100 100 100 010 001', ')': '100 010 001 001 001 010 100', ' ': '000 000 000 000 000 000 000',
  };
  const GL = {};
  for (const k in GLYPHS) GL[k] = GLYPHS[k].split(' ');
  const glyph = ch => GL[ch] || GL[ch.toUpperCase()] || GL[' '];
  const textWidth = str => [...str].reduce((w, ch) => w + glyph(ch)[0].length + 1, 0);
  function pixelText(str, x, y, col, x0, x1, keep) {
    for (const ch of str) {
      const g = glyph(ch), w = g[0].length;
      if (x + w >= x0 && x <= x1)
        for (let r = 0; r < 7; r++) for (let c = 0; c < w; c++)
          if (g[r][c] === '1' && x + c >= x0 && x + c <= x1 && (!keep || keep(x + c, y + r))) set(x + c, y + r, col);
      x += w + 1;
    }
  }
  function billboardText() {
    if (compact || !BB) return;
    const { x0, y0, y1, lab, kx, x1 } = BB, ty = Math.round((y0 + y1) / 2 - 3);
    pixelText('NOW', Math.round((x0 + lab) / 2 - textWidth('NOW') / 2), ty, C('#FFF6E4'), x0 + 1, lab - 1);
    // roll the whole list along the pixel grid
    const parts = []; ITEMS.forEach(([k, v]) => parts.push([k + ' ', '#C9B79A'], [v, '#FFC94A'], ['   ·   ', '#8C7A66']));
    const span = parts.reduce((w, [t]) => w + textWidth(t), 0);
    const off = Math.floor(world.time * 14) % span;
    for (let start = kx - off; start < x1 - 2; start += span) {
      let cx = start;
      for (const [t, col] of parts) { pixelText(t, cx, ty, C(col), kx, x1 - 2); cx += textWidth(t); }
    }
  }

  let tick = 0;
  function frame() {
    if (!img) return;
    if (needStatic) buildStatic();
    buf = new Uint32Array(img.data.buffer);
    buf.set(base);
    tick = (tick + 1) % 60;
    const t = tick >> 3;
    const ground = world.people.filter(p => !p.station.elevated), up = world.people.filter(p => p.station.elevated);
    ground.forEach(p => drawPerson(p, t));
    world.cars.filter(c => !c.hidden && c.z < .5).forEach(drawCar);
    up.forEach(p => drawPerson(p, t));
    world.cars.filter(c => !c.hidden && c.z >= .5).forEach(drawCar);
    drawPuffs(t);
    if (night) {
      for (const [x, y] of LAMPS) glow(bx(x), by(y), 9 * s * 2, [40, 32, 10]);
      for (const c of world.cars) if (!c.hidden && c.i === 0 && !c.clip) {
        const d = c.rev ? -1 : 1, fx = c.x + Math.cos(c.a) * d * (c.len / 2 + 8), fy = c.y + Math.sin(c.a) * d * (c.len / 2 + 8);
        glow(bx(fx), by(fy), 6 * s * 2, [46, 40, 16]);
      }
    }
    billboardFrame();
    billboardText();
    ctx.putImageData(img, 0, 0);
  }

  RW.bindControls(world, canvas.closest('[data-concept]') || document);
  RW.bindCanvasInput(world, canvas, (x, y) => ({ x: x / (px * s) + X0, y: y / (px * s) + Y0 }));
  RW.bindPageHelpers();
  RW.runLoop(world, frame, canvas);
})();
