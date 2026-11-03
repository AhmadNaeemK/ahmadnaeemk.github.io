/* Concept B renderer: a model railway diorama in a gentle oblique view (ground squashed by K, height lifts up). */
(function () {
  'use strict';
  const RW = window.RailWorld, TAU = RW.TAU;
  const canvas = document.querySelector('.layout__canvas');
  const ROOT = canvas.closest('[data-concept]') || document.documentElement;
  const HERO = canvas.closest('[data-rail-hero]');
  const ctx = canvas.getContext('2d');
  const K = 0.7, VX0 = -50, VW = 820;
  let VY0 = -84, VH = 282, compact = false;
  let T = {}, night = false, scale = 1, dpr = 1, staticLayer = null;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let saved = null; try { saved = localStorage.getItem('rail-livery'); } catch (e) {}
  const world = RW.createWorld({ livery: saved || 'steam', startStopped: reduce, seed: 23 });

  const TOKENS = ['--grass', '--grass2', '--ballast', '--ballast2', '--sleeper', '--rail', '--rail-hi', '--stone', '--stone2', '--shadow', '--glass',
    '--lamp', '--wood', '--wood2', '--mustard', '--brick', '--moss', '--ink', '--paper', '--bg', '--teal', '--cobalt', '--tomato', '--plum'];
  function readTokens() { T = {}; TOKENS.forEach(n => (T[n] = RW.cssVar(n, ROOT))); staticLayer = null; }
  RW.bindTheme(d => { night = d; requestAnimationFrame(readTokens); });
  readTokens();

  function resize() {
    const w = canvas.clientWidth || VW;
    compact = w < 600; VY0 = compact ? -64 : -84; VH = compact ? 262 : 282;
    if (HERO) HERO.dataset.now = compact ? 'html' : 'board';
    canvas.style.aspectRatio = VW + ' / ' + VH;
    dpr = Math.min(window.devicePixelRatio || 1, 2); scale = w / VW;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * VH / VW * dpr); staticLayer = null;
  }
  new ResizeObserver(resize).observe(canvas); resize();

  // ---------- helpers ----------
  const Y = (y, z) => y * K - (z || 0);
  function shade(hex, k) {
    if (hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
    r = Math.min(255, r * k) | 0; g = Math.min(255, g * k) | 0; b = Math.min(255, b * k) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function pathOf(c, seg, off) {
    off = off || 0;
    if (seg.type === 'line') {
      const nx = -(seg.y1 - seg.y0) / seg.len, ny = (seg.x1 - seg.x0) / seg.len;
      c.moveTo(seg.x0 + nx * off, seg.y0 + ny * off); c.lineTo(seg.x1 + nx * off, seg.y1 + ny * off);
    } else if (seg.type === 'arc') {
      const r = seg.r + off;
      c.moveTo(seg.cx + r * Math.cos(seg.t0), seg.cy + r * Math.sin(seg.t0));
      c.arc(seg.cx, seg.cy, r, seg.t0, seg.t1, seg.t1 < seg.t0);
    }
  }
  const groundParts = world.letters.flatMap(l => l.parts);

  // ---------- decor (curated positions, seeded details) ----------
  const R = rng(99);
  const TREE_COLS = ['#7E8C35', '#C68A2A', '#A9542B', '#8F9A3C', '#D2A13A'];
  const decor = [];
  [[188, 52], [236, 78], [340, 36], [462, 72], [516, 42], [552, 84], [640, 52], [684, 86], [-28, 120], [-22, 196], [752, 150], [748, 208],
   [200, 232], [322, 236], [408, 228], [498, 234], [538, 224], [652, 234], [-10, 30], [760, 40]].forEach(([x, y], i) =>
    decor.push({ type: i >= 12 && i < 18 ? 'bush' : 'tree', x, y, s: 0.85 + R() * 0.4, col: TREE_COLS[(R() * TREE_COLS.length) | 0], col2: TREE_COLS[(R() * TREE_COLS.length) | 0] }));
  decor.push({ type: 'house', x: 298, y: 66, w: 26, d: 14, h: 11, roof: '#B8442F' });
  decor.push({ type: 'house', x: 404, y: 58, w: 20, d: 13, h: 9, roof: '#7E3B6F' });
  decor.push({ type: 'house', x: 600, y: 64, w: 22, d: 13, h: 10, roof: '#34609F' });
  [[107, 46], [366, 16], [106, 140]].forEach(([x, y]) => decor.push({ type: 'lamp', x, y }));
  // station furniture
  decor.push({ type: 'canopy', x: 116, y: 88, w: 13, d: 13, z: 3, h: 11 });
  decor.push({ type: 'kiosk', x: 670, y: 150 }, { type: 'kiosk', x: 530, y: 150 });
  // tunnel hills
  const topPortals = world.portals.filter(p => p.dy < -0.5), botPortals = world.portals.filter(p => p.dy > 0.5);
  botPortals.forEach(p => decor.push({ type: 'hill', x: p.x, y: p.y + 40, px: p.x, py: p.y }));

  // ---------- static layer: board, ground, track, bridge, platforms ----------
  function drawStatic(c) {
    // board edge and top
    const top = -34, bot = 246;
    const g = c.createLinearGradient(0, Y(bot), 0, Y(bot) + 16);
    g.addColorStop(0, T['--wood']); g.addColorStop(1, T['--wood2']);
    c.fillStyle = g; c.beginPath(); c.roundRect(-40, Y(bot) - 12, 800, 28, [0, 0, 10, 10]); c.fill();
    c.save(); c.scale(1, K);
    c.fillStyle = T['--grass']; c.beginPath(); c.roundRect(-40, top, 800, bot - top, 18); c.fill();
    const r = rng(5);
    c.save(); c.beginPath(); c.roundRect(-40, top, 800, bot - top, 18); c.clip();
    // soft field patches and grass tufts
    for (let i = 0; i < 14; i++) { c.fillStyle = T['--grass2']; c.globalAlpha = .35; c.beginPath(); c.ellipse(-20 + r() * 760, r() * 240 - 20, 30 + r() * 50, 14 + r() * 20, 0, 0, TAU); c.fill(); }
    c.globalAlpha = 1; c.strokeStyle = T['--grass2']; c.lineWidth = 1;
    for (let i = 0; i < 700; i++) { const x = -34 + r() * 788, y = top + 4 + r() * (bot - top - 8); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - .5) * 2, y - 3); c.stroke(); }
    const fl = ['#F2C14E', '#E86A5A', '#FFF1D8', '#D98AB8'];
    for (let i = 0; i < 90; i++) { c.fillStyle = fl[i % 4]; c.globalAlpha = night ? .35 : .9; c.fillRect(-34 + r() * 788, top + 4 + r() * (bot - top - 8), 1.6, 1.6); }
    c.globalAlpha = 1; c.restore();
    // pond inside the first a
    c.fillStyle = shade(T['--teal'], night ? .6 : 1.05); c.beginPath(); c.ellipse(50, 152, 24, 21, 0, 0, TAU); c.fill();
    c.strokeStyle = T['--stone']; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.2; c.beginPath(); c.arc(44, 146, 10, Math.PI * 1.1, Math.PI * 1.5); c.stroke();
    // ballast
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.save(); c.translate(0, 2.2 / K); c.strokeStyle = T['--ballast2']; c.lineWidth = 16; c.beginPath(); groundParts.forEach(s => pathOf(c, s)); c.stroke(); c.restore();
    c.strokeStyle = T['--ballast']; c.lineWidth = 15; c.beginPath(); groundParts.forEach(s => pathOf(c, s)); c.stroke();
    // sleepers
    c.strokeStyle = T['--sleeper']; c.lineWidth = 2.4; c.lineCap = 'butt';
    for (const s of groundParts) for (const p of RW.sample(s, 5.5)) {
      const nx = -Math.sin(p.a) * 6, ny = Math.cos(p.a) * 6; c.beginPath(); c.moveTo(p.x + nx, p.y + ny); c.lineTo(p.x - nx, p.y - ny); c.stroke();
    }
    // rails
    for (const off of [-3.4, 3.4]) {
      c.strokeStyle = T['--rail']; c.lineWidth = 1.5; c.beginPath(); groundParts.forEach(s => pathOf(c, s, off)); c.stroke();
      c.strokeStyle = T['--rail-hi']; c.lineWidth = .5; c.beginPath(); groundParts.forEach(s => pathOf(c, s, off - .4)); c.stroke();
    }
    // tunnel mouths behind the letters (top portals): dark interior first
    c.restore();
    for (const p of topPortals) { c.fillStyle = '#1a1210'; archPath(c, p); c.fill(); }
    // ground platforms
    for (const st of world.stations) if (!st.elevated) platform(c, st, 3);
    drawBridge(c);
    platform(c, world.stations.find(s => s.elevated), 16);
  }
  function archPath(c, p) {
    const X = p.x, B = Y(p.y) + 0.5, w = 7.5, h = 13;
    c.beginPath(); c.moveTo(X - w, B); c.lineTo(X - w, B - h + w); c.arc(X, B - h + w, w, Math.PI, 0); c.lineTo(X + w, B); c.closePath();
  }
  function platform(c, st, z) {
    const pl = st.platform;
    if (pl.type === 'rect') {
      if (z > 8) { // posts down to the ground
        c.fillStyle = T['--stone2'];
        for (let x = pl.x + 6; x < pl.x + pl.w; x += 30) c.fillRect(x - 1.5, Y(pl.y + pl.h, z), 3, z);
      }
      c.fillStyle = shade(T['--stone'], .8); c.fillRect(pl.x, Y(pl.y + pl.h, z), pl.w, 3);
      c.fillStyle = T['--stone']; c.fillRect(pl.x, Y(pl.y, z), pl.w, pl.h * K);
      c.fillStyle = T['--mustard']; const e = st.id === 'sky' ? [pl.x, Y(pl.y, z), pl.w, 1.2] : [pl.x + pl.w - 1.6, Y(pl.y, z), 1.6, pl.h * K]; c.fillRect(...e);
    } else {
      c.fillStyle = shade(T['--stone'], .8); c.beginPath(); c.ellipse(pl.cx, Y(pl.cy, z) + 2.5, pl.r, pl.r * K, 0, 0, TAU); c.fill();
      c.fillStyle = T['--stone']; c.beginPath(); c.ellipse(pl.cx, Y(pl.cy, z), pl.r, pl.r * K, 0, 0, TAU); c.fill();
      c.strokeStyle = T['--mustard']; c.lineWidth = 1.2; c.beginPath(); c.ellipse(pl.cx, Y(pl.cy, z), pl.r - 1.5, (pl.r - 1.5) * K, 0, 0, TAU); c.stroke();
    }
  }
  function bridgeSamples(step) {
    const out = [];
    world.bridge.forEach(seg => RW.sample(seg, step).forEach(p => { p.seg = seg; p.z = world.elevationAt(p); out.push(p); }));
    return out;
  }
  function drawBridge(c) {
    const pts = bridgeSamples(2);
    const H = 16;
    // viaduct wall with arches along the straight span
    c.fillStyle = T['--stone2'];
    c.beginPath(); c.moveTo(160, Y(7));
    for (const p of pts) if (p.seg.type === 'line') c.lineTo(p.x, Y(7, p.z));
    c.lineTo(700, Y(7)); c.closePath();
    for (let x = 190; x < 690; x += 50) { // arch holes, counter-wound
      const w = 17, top = Y(7, 9);
      c.moveTo(x + w, Y(7)); c.lineTo(x + w, top + w * 0.5); c.ellipse(x, top + w * 0.5, w, w * 0.5, 0, 0, Math.PI, true); c.lineTo(x - w, Y(7)); c.closePath();
    }
    c.fill('evenodd');
    c.strokeStyle = shade(T['--stone2'], .82); c.lineWidth = .6;
    for (let z = 3; z < H; z += 3.2) { c.beginPath(); c.moveTo(160, Y(7, z)); c.lineTo(700, Y(7, z)); c.stroke(); }
    // deck: top surface and front face
    const L = [], Rt = [];
    for (const p of pts) { const nx = -Math.sin(p.a), ny = Math.cos(p.a); L.push([p.x + nx * 8, p.y + ny * 8, p.z]); Rt.push([p.x - nx * 8, p.y - ny * 8, p.z]); }
    const front = L.map((q, i) => (q[1] > Rt[i][1] ? q : Rt[i])), back = L.map((q, i) => (q[1] > Rt[i][1] ? Rt[i] : q));
    c.fillStyle = shade(T['--stone2'], .9); c.beginPath();
    front.forEach((q, i) => (i ? c.lineTo(q[0], Y(q[1], q[2])) : c.moveTo(q[0], Y(q[1], q[2]))));
    for (let i = front.length - 1; i >= 0; i--) c.lineTo(front[i][0], Y(front[i][1], front[i][2] - 3));
    c.fill();
    c.fillStyle = T['--ballast']; c.beginPath();
    back.forEach((q, i) => (i ? c.lineTo(q[0], Y(q[1], q[2])) : c.moveTo(q[0], Y(q[1], q[2]))));
    for (let i = front.length - 1; i >= 0; i--) c.lineTo(front[i][0], Y(front[i][1], front[i][2]));
    c.fill();
    // sleepers and rails on the deck
    c.strokeStyle = T['--sleeper']; c.lineWidth = 2.2;
    bridgeSamples(5.5).forEach(p => { const nx = -Math.sin(p.a) * 6, ny = Math.cos(p.a) * 6; c.beginPath(); c.moveTo(p.x + nx, Y(p.y + ny, p.z)); c.lineTo(p.x - nx, Y(p.y - ny, p.z)); c.stroke(); });
    for (const off of [-3.4, 3.4]) {
      c.strokeStyle = T['--rail']; c.lineWidth = 1.4; c.beginPath();
      pts.forEach((p, i) => { const x = p.x - Math.sin(p.a) * off, y = Y(p.y + Math.cos(p.a) * off, p.z); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
    // parapet
    c.strokeStyle = shade(T['--stone'], 1.05); c.lineWidth = 1.2; c.beginPath();
    front.forEach((q, i) => (i ? c.lineTo(q[0], Y(q[1], q[2] + 1.5)) : c.moveTo(q[0], Y(q[1], q[2] + 1.5)))); c.stroke();
  }

  // ---------- objects ----------
  function tree(o) {
    const X = o.x, B = Y(o.y), s = o.s;
    ctx.fillStyle = T['--shadow']; ctx.beginPath(); ctx.ellipse(X + 3, B, 7 * s, 3 * s, 0, 0, TAU); ctx.fill();
    if (o.type === 'bush') {
      ctx.fillStyle = shade(o.col, night ? .45 : .85); ctx.beginPath(); ctx.ellipse(X, B - 3 * s, 7 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(o.col, night ? .55 : 1.05); ctx.beginPath(); ctx.ellipse(X - 1.5, B - 4.5 * s, 4.5 * s, 3 * s, 0, 0, TAU); ctx.fill();
      return;
    }
    ctx.fillStyle = shade('#6A4632', night ? .6 : 1); ctx.fillRect(X - 1.2, B - 9 * s, 2.4, 9 * s);
    const k = night ? .45 : 1;
    ctx.fillStyle = shade(o.col, .8 * k); ctx.beginPath(); ctx.arc(X + 1.5, B - 12 * s, 7.5 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(o.col, 1 * k); ctx.beginPath(); ctx.arc(X - 1.5, B - 15 * s, 6.5 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(o.col2, 1.1 * k); ctx.beginPath(); ctx.arc(X - 2.5, B - 18.5 * s, 4 * s, 0, TAU); ctx.fill();
  }
  function house(o) {
    const { x, y, w, d, h } = o, x0 = x - w / 2, x1 = x + w / 2, yb = y + d / 2, yf = y + d / 2;
    const yback = y - d / 2;
    ctx.fillStyle = T['--shadow']; ctx.fillRect(x0 + 2, Y(yf) - 1, w + 4, 3);
    // front wall
    ctx.fillStyle = night ? '#5b4a44' : '#F2E2C8'; ctx.fillRect(x0, Y(yf, h), w, h);
    // right wall
    ctx.fillStyle = night ? '#4a3c38' : '#DCC7A8';
    ctx.beginPath(); ctx.moveTo(x1, Y(yf)); ctx.lineTo(x1, Y(yf, h)); ctx.lineTo(x1, Y(yback, h)); ctx.lineTo(x1, Y(yback)); ctx.closePath(); ctx.fill();
    // roof: front slope and gable
    const ridge = h + 7;
    ctx.fillStyle = shade(o.roof, night ? .55 : 1);
    ctx.beginPath(); ctx.moveTo(x0 - 2, Y(yf + 1, h - 1)); ctx.lineTo(x1 + 2, Y(yf + 1, h - 1)); ctx.lineTo(x1 + 2, Y(y, ridge)); ctx.lineTo(x0 - 2, Y(y, ridge)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(o.roof, night ? .42 : .78);
    ctx.beginPath(); ctx.moveTo(x1, Y(yf, h)); ctx.lineTo(x1, Y(y, ridge - 1)); ctx.lineTo(x1, Y(yback, h)); ctx.closePath(); ctx.fill();
    // windows and door
    ctx.fillStyle = night ? T['--lamp'] : '#3A3F49';
    ctx.fillRect(x0 + 3, Y(yf, h - 3), 3.5, 3); ctx.fillRect(x1 - 6.5, Y(yf, h - 3), 3.5, 3);
    ctx.fillStyle = shade(o.roof, .7); ctx.fillRect(x - 1.8, Y(yf, 5.5), 3.6, 5.5);
    void yb;
  }
  function lamp(o) {
    ctx.fillStyle = '#3B3330'; ctx.fillRect(o.x - .6, Y(o.y, 14), 1.2, 14);
    ctx.fillStyle = night ? T['--lamp'] : '#E9D9B8'; ctx.beginPath(); ctx.arc(o.x, Y(o.y, 15), 1.8, 0, TAU); ctx.fill();
  }
  function canopy(o) {
    ctx.fillStyle = '#4A3A34';
    ctx.fillRect(o.x + 2, Y(o.y + o.d - 2, o.z + o.h), 1.2, o.h); ctx.fillRect(o.x + o.w - 3, Y(o.y + o.d - 2, o.z + o.h), 1.2, o.h);
    ctx.fillStyle = shade(T['--brick'], night ? .6 : 1); ctx.fillRect(o.x - 1, Y(o.y, o.z + o.h + 2), o.w + 2, o.d * K);
    ctx.fillStyle = shade(T['--brick'], night ? .45 : .75); ctx.fillRect(o.x - 1, Y(o.y + o.d, o.z + o.h + 2), o.w + 2, 2);
  }
  function kiosk(o) {
    ctx.fillStyle = '#4A3A34'; ctx.fillRect(o.x - .7, Y(o.y, 14), 1.4, 11);
    ctx.fillStyle = shade(T['--mustard'], night ? .6 : 1); ctx.beginPath(); ctx.ellipse(o.x, Y(o.y, 15), 9, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(T['--mustard'], night ? .45 : .78); ctx.beginPath(); ctx.ellipse(o.x, Y(o.y, 14.4), 9, 4, 0, 0, Math.PI); ctx.fill();
  }
  function hill(o, withHole) {
    const X = o.px, cy = withHole ? Y(o.py - 14) - 5 : Y(o.py + 17) - 6, ry = withHole ? 14.5 : 15;
    const g = ctx.createRadialGradient(X - 6, cy - 6, 2, X, cy, 24);
    g.addColorStop(0, shade(T['--grass'], 1.12)); g.addColorStop(1, shade(T['--grass'], .78));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, cy, 21, ry, 0, 0, TAU);
    if (withHole) { archSub(o); ctx.fill('evenodd'); } else ctx.fill();
    // a few rocks
    ctx.fillStyle = shade(T['--stone'], night ? .7 : .95);
    [[-9, -4, 2.4], [7, -7, 1.8], [11, 3, 2]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(X + dx, cy + dy, r, 0, TAU); ctx.fill(); });
    if (withHole) { ctx.strokeStyle = T['--stone']; ctx.lineWidth = 2.6; archPath(ctx, { x: X, y: o.py }); ctx.stroke(); }
  }
  function archSub(o) {
    const X = o.px, B = Y(o.py) + 0.5, w = 7.5, h = 13;
    ctx.moveTo(X + w, B); ctx.lineTo(X + w, B - h + w); ctx.arc(X, B - h + w, w, 0, Math.PI, true); ctx.lineTo(X - w, B); ctx.closePath();
  }
  function person(p) {
    if (p.alpha <= 0) return;
    const z = p.station && p.station.elevated ? 16 : 3, bob = p.moving ? Math.abs(Math.sin(p.phase * 2)) * .6 : 0;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.fillStyle = p.color; ctx.fillRect(p.x - 1.2, Y(p.y, z + 3.6 + bob), 2.4, 3.6);
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(p.x, Y(p.y, z + 4.8 + bob), 1.15, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------- train ----------
  function toWorldPt(c, lx, ly) {
    const cs = Math.cos(c.a), sn = Math.sin(c.a), x = c.rev ? -lx : lx;
    return [c.x + cs * x - sn * ly, c.y + sn * x + cs * ly, c.z + c.pitch * (x / (c.len * 0.76 || 1))];
  }
  // prism: local footprint pts, base height, height, colours. Returns visible side faces for decoration.
  function prism(c, pts, zb, h, col, topCol) {
    const W = pts.map(([lx, ly]) => toWorldPt(c, lx, ly));
    const cx = W.reduce((s, p) => s + p[0], 0) / W.length, cyy = W.reduce((s, p) => s + p[1], 0) / W.length;
    const faces = [];
    for (let i = 0; i < W.length; i++) {
      const a = W[i], b = W[(i + 1) % W.length];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cyy) < 0) { nx = -nx; ny = -ny; }
      if (ny <= 0.02) continue;
      ctx.fillStyle = shade(col, (0.72 + 0.16 * ny - 0.12 * nx) * dimK);
      ctx.beginPath(); ctx.moveTo(a[0], Y(a[1], a[2] + zb)); ctx.lineTo(b[0], Y(b[1], b[2] + zb)); ctx.lineTo(b[0], Y(b[1], b[2] + zb + h)); ctx.lineTo(a[0], Y(a[1], a[2] + zb + h)); ctx.closePath(); ctx.fill();
      faces.push({ a, b, l, nx, ny });
    }
    ctx.fillStyle = shade(topCol || col, (topCol ? 1 : 1.08) * dimK);
    ctx.beginPath(); W.forEach((p, i) => (i ? ctx.lineTo(p[0], Y(p[1], p[2] + zb + h)) : ctx.moveTo(p[0], Y(p[1], p[2] + zb + h)))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,18,12,.45)'; ctx.lineWidth = .45; ctx.stroke();
    return faces;
  }
  function windows(faces, zb, z0, z1, passengers, glass) {
    for (const f of faces) {
      if (f.l < 14) continue;
      const n = Math.floor((f.l - 4) / 4.5);
      for (let k = 0; k < n; k++) {
        const t0 = (2.5 + k * 4.5) / f.l, t1 = t0 + 3 / f.l;
        const P = t => [f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t, f.a[2] + (f.b[2] - f.a[2]) * t];
        const p0 = P(t0), p1 = P(t1);
        ctx.fillStyle = glass;
        ctx.beginPath(); ctx.moveTo(p0[0], Y(p0[1], p0[2] + zb + z0)); ctx.lineTo(p1[0], Y(p1[1], p1[2] + zb + z0)); ctx.lineTo(p1[0], Y(p1[1], p1[2] + zb + z1)); ctx.lineTo(p0[0], Y(p0[1], p0[2] + zb + z1)); ctx.closePath(); ctx.fill();
        const who = passengers && passengers[k];
        if (who) { ctx.fillStyle = who.color; ctx.beginPath(); ctx.moveTo(p0[0] + .5, Y(p0[1], p0[2] + zb + z0)); ctx.lineTo(p1[0] - .5, Y(p1[1], p1[2] + zb + z0)); ctx.lineTo(p1[0] - .5, Y(p1[1], p1[2] + zb + z0 + 1.6)); ctx.lineTo(p0[0] + .5, Y(p0[1], p0[2] + zb + z0 + 1.6)); ctx.fill(); }
      }
    }
  }
  const rect = (x0, x1, w) => [[x0, -w / 2], [x1, -w / 2], [x1, w / 2], [x0, w / 2]];
  let dimK = 1;
  function car(c) {
    dimK = night ? 0.7 : 1;
    const C = world.livery.colors, id = world.liveryId, L = c.len, Wd = 11, zb = 2.5;
    const glass = night ? T['--lamp'] : (C.window && id !== 'toy' ? '#3A3F49' : C.window);
    ctx.save();
    if (c.clip && c.clip.ny > 0.5) { ctx.beginPath(); ctx.rect(VX0, Y(c.clip.y) - 13, VW, VH); ctx.clip(); }
    // shadow
    const sh = rect(-L / 2, L / 2, Wd).map(([lx, ly]) => toWorldPt(c, lx + 1.5, ly + 1.5));
    ctx.fillStyle = T['--shadow']; ctx.beginPath(); sh.forEach((p, i) => (i ? ctx.lineTo(p[0], Y(p[1], p[2] + 1)) : ctx.moveTo(p[0], Y(p[1], p[2] + 1)))); ctx.fill();
    const coachCol = id === 'toy' ? (c.i % 2 ? C.coach : C.coach2) : (C.coach || C.body);
    if (c.kind === 'coach' || c.kind === 'cab') {
      const col = c.kind === 'coach' ? coachCol : C.body;
      const f = prism(c, rect(-L / 2, L / 2, Wd), zb, 9, col, C.coachRoof && c.kind === 'coach' ? C.coachRoof : C.roof);
      windows(f, zb, 4, 7, c.passengers, glass);
      // livery stripe
      ctx.strokeStyle = C.trim; ctx.lineWidth = 1;
      for (const fc of f) if (fc.l > 14) { ctx.beginPath(); ctx.moveTo(fc.a[0], Y(fc.a[1], fc.a[2] + zb + 2.3)); ctx.lineTo(fc.b[0], Y(fc.b[1], fc.b[2] + zb + 2.3)); ctx.stroke(); }
      if (c.kind === 'cab') {
        const ws = rect(L / 2 - 3, L / 2 - 0.4, Wd - 3).map(([lx, ly]) => toWorldPt(c, lx, ly));
        ctx.fillStyle = glass; ctx.beginPath(); ws.forEach((p, i) => (i ? ctx.lineTo(p[0], Y(p[1], p[2] + zb + 9.05)) : ctx.moveTo(p[0], Y(p[1], p[2] + zb + 9.05)))); ctx.fill();
      }
    } else if (c.kind === 'nose') {
      const h = Wd / 2;
      const pts = [[-L / 2, -h], [L / 2 - 13, -h], [L / 2 - 5, -h * .62], [L / 2, 0], [L / 2 - 5, h * .62], [L / 2 - 13, h], [-L / 2, h]];
      const f = prism(c, pts, zb, 8.5, C.body, C.roof);
      windows(f.filter(x => x.l > 15), zb, 4, 6.5, c.passengers, glass);
      ctx.strokeStyle = C.trim; ctx.lineWidth = 1.3;
      for (const fc of f) { ctx.beginPath(); ctx.moveTo(fc.a[0], Y(fc.a[1], fc.a[2] + zb + 2.5)); ctx.lineTo(fc.b[0], Y(fc.b[1], fc.b[2] + zb + 2.5)); ctx.stroke(); }
      const ws = [[L / 2 - 11, -3], [L / 2 - 5, -2], [L / 2 - 5, 2], [L / 2 - 11, 3]].map(([lx, ly]) => toWorldPt(c, lx, ly));
      ctx.fillStyle = glass; ctx.beginPath(); ws.forEach((p, i) => (i ? ctx.lineTo(p[0], Y(p[1], p[2] + zb + 8.55)) : ctx.moveTo(p[0], Y(p[1], p[2] + zb + 8.55)))); ctx.fill();
    } else if (c.kind === 'tender') {
      prism(c, rect(-L / 2, L / 2, Wd), zb, 7.5, C.body, '#1d1714');
    } else if (c.kind === 'loco') {
      prism(c, rect(-L / 2, L / 2, Wd), zb - 0.5, 2, '#2a2220');
      const parts = [
        { x: -L / 2 + 5, draw: () => { const f = prism(c, rect(-L / 2, -L / 2 + 10, Wd), zb + 1.5, 10, id === 'toy' ? C.coach2 : C.roof, id === 'toy' ? C.roof : shade(C.roof, 1.3)); windows(f.filter(x => x.l > 9).map(x => ({ ...x, l: 14 })), zb + 1.5, 5, 8, null, glass); } },
        { x: 2, draw: () => { prism(c, rect(-L / 2 + 10, L / 2 - 5, Wd - 3), zb + 1.5, 8, C.body); } },
        { x: L / 2 - 3, draw: () => { prism(c, rect(L / 2 - 5, L / 2 - .5, Wd - 3), zb + 1.5, 8, C.accent); } },
        { x: L / 2 - 6, draw: () => { prism(c, rect(L / 2 - 7.5, L / 2 - 4.5, 3), zb + 9.5, 4.5, id === 'toy' ? C.trim : '#231c1a'); } },
        { x: 0, draw: () => { prism(c, rect(-1.5, 1.5, 3), zb + 9.5, 2.2, C.trim); } },
      ];
      // draw back to front relative to the viewer
      parts.map(p => ({ ...p, depth: toWorldPt(c, p.x, 0)[1] })).sort((a, b) => a.depth - b.depth).forEach(p => p.draw());
    }
    ctx.restore();
  }

  function puffs() {
    for (const p of world.puffs) {
      const t = p.life / p.max;
      ctx.globalAlpha = (1 - t) * (night ? .35 : .7);
      ctx.fillStyle = night ? '#9c94a8' : '#FFFBF4';
      ctx.beginPath(); ctx.arc(p.x, Y(p.y, p.z), p.r * 1.1, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function glows() {
    if (!night) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,200,110,${a})`); g.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    decor.forEach(o => { if (o.type === 'lamp') glow(o.x, Y(o.y, 15), 22, .35); if (o.type === 'house') glow(o.x, Y(o.y + o.d / 2, 6), 18, .16); if (o.type === 'kiosk') glow(o.x, Y(o.y, 12), 26, .18); });
    for (const c of world.cars) {
      if (c.hidden) continue;
      glow(c.x, Y(c.y, c.z + 7), 14, .1);
      if (c.i === 0 && !(c.clip && c.clip.ny > .5)) {
        const f = toWorldPt(c, c.len / 2 + 12, 0);
        glow(f[0], Y(f[1], f[2] + 3), 16, .22);
      }
    }
    ctx.restore();
  }

  // ---------- "right now" billboard behind the bridge ----------
  const ITEMS = RW.nowItems(ROOT).map(([k, v]) => [k.toUpperCase(), v.toUpperCase()]);
  const BF = '"Big Shoulders Display", "Arial Narrow", sans-serif';
  function billboard() {
    if (compact || !ITEMS.length) return;
    ctx.textBaseline = 'middle';
    ctx.font = `700 12px ${BF}`; const kw = Math.max(...ITEMS.map(([k]) => ctx.measureText(k).width));
    ctx.font = `800 15px ${BF}`; const vw = Math.max(...ITEMS.map(([, v]) => ctx.measureText(v).width));
    ctx.font = `800 12px ${BF}`; const lw = ctx.measureText('RIGHT NOW').width + 12;
    const by = -24, z0 = 24, h = 30, w = 8 + lw + 12 + kw + 8 + vw + 14, x = 410 - w / 2;
    const top = Y(by, z0 + h), bot = Y(by, z0);
    ctx.fillStyle = shade('#6A4632', night ? .6 : 1);
    [x + 30, x + w - 30].forEach(px => ctx.fillRect(px - 2, bot, 4, Y(by, 0) - bot));
    ctx.fillStyle = shade(T['--wood'], night ? .7 : 1); ctx.beginPath(); ctx.roundRect(x - 4, top - 4, w + 8, h + 8, 3); ctx.fill();
    ctx.fillStyle = '#1E1612'; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = T['--brick']; ctx.fillRect(x + 4, top + 4, lw, h - 8);
    ctx.fillStyle = '#FFF6EA'; ctx.font = `800 12px ${BF}`; ctx.fillText('RIGHT NOW', x + 10, top + h / 2 + 1);
    const tx = x + lw + 16, tw = x + w - 4 - (tx - 4);
    {
      const segs = [];
      ITEMS.forEach(([k, v]) => { segs.push({ text: k + '  ', font: `700 12px ${BF}`, color: '#CDBCA6' }, { text: v, font: `800 15px ${BF}`, color: '#FFD77A' }, { text: '      ·      ', font: `700 12px ${BF}`, color: '#8C7A66' }); });
      ctx.save(); ctx.beginPath(); ctx.rect(tx - 4, top + 2, tw, h - 4); ctx.clip();
      RW.marqueeSegments(ctx, segs, tx, top + h / 2 + 1, tw, world.time, 24, 0);
      ctx.restore();
    }
    for (let bx = x + 8; bx < x + w; bx += 18) {
      ctx.fillStyle = night ? T['--lamp'] : '#E9D9B8'; ctx.beginPath(); ctx.arc(bx, top - 6, 1.4, 0, TAU); ctx.fill();
      if (night) { const g = ctx.createRadialGradient(bx, top - 6, 0, bx, top - 6, 9); g.addColorStop(0, 'rgba(255,200,110,.35)'); g.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, top - 6, 9, 0, TAU); ctx.fill(); }
    }
  }

  // ---------- frame ----------
  function frame() {
    const S = dpr * scale;
    if (!staticLayer) {
      staticLayer = document.createElement('canvas'); staticLayer.width = canvas.width; staticLayer.height = canvas.height;
      const c = staticLayer.getContext('2d'); c.setTransform(S, 0, 0, S, -VX0 * S, -VY0 * S); drawStatic(c);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(staticLayer, 0, 0);
    ctx.setTransform(S, 0, 0, S, -VX0 * S, -VY0 * S);
    const items = decor.map(o => ({ y: o.y, o }));
    world.people.forEach(p => items.push({ y: p.y + (p.station && p.station.elevated ? 0 : 0.1), p }));
    world.cars.forEach(c => { if (!c.hidden) items.push({ y: c.y + (c.z > 1 ? -2 : 0), c }); });
    items.sort((a, b) => a.y - b.y);
    billboard();
    for (const it of items) {
      if (it.c) car(it.c);
      else if (it.p) person(it.p);
      else { const o = it.o; ({ tree, bush: tree, house, lamp, canopy, kiosk, hill: x => hill(x, false) })[o.type](o); }
    }
    topPortals.forEach(p => hill({ px: p.x, py: p.y }, true));
    puffs();
    glows();
  }

  RW.bindControls(world, canvas.closest('[data-concept]') || document);
  world.hitTrain = (x, y, r) => world.cars.some(c => !c.hidden && Math.hypot(c.x - x, Y(c.y, c.z + 6) - y * K) < (r || 16) * .8);
  RW.bindCanvasInput(world, canvas, (x, y) => ({ x: x / scale + VX0, y: (y / scale + VY0) / K }));
  RW.bindPageHelpers();
  RW.runLoop(world, frame, canvas);
})();
