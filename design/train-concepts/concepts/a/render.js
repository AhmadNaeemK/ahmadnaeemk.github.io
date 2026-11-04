/* Concept A renderer: a transit map seen from above. */
(function () {
  'use strict';
  const RW = window.RailWorld;
  const canvas = document.querySelector('.map__canvas');
  const ROOT = canvas.closest('[data-concept]') || document.documentElement;
  const ctx = canvas.getContext('2d');
  const X0 = -24, VW = 768;
  let Y0 = -66, VH = 300, compact = false;
  const LINE = ['--marigold', '--tomato', '--teal', '--plum', '--cobalt'];
  let T = {}, dark = false, scale = 1, dpr = 1;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let saved = null; try { saved = localStorage.getItem('rail-livery'); } catch (e) {}
  const world = RW.createWorld({ livery: saved || 'metro', startStopped: reduce, seed: 11 });

  function readTokens() {
    const names = ['--bg', '--surface', '--ink', '--muted', '--rule', '--track-under', '--platform', '--shadow', '--lit', ...LINE];
    T = {}; names.forEach(n => (T[n] = RW.cssVar(n, ROOT)));
  }
  RW.bindTheme(d => { dark = d; requestAnimationFrame(readTokens); });
  readTokens();

  function resize() {
    const w = canvas.clientWidth || 768;
    // phones: no billboard (the HTML line shows instead), so drop the empty sky above the bridge
    compact = w < 600; Y0 = compact ? -28 : -66; VH = compact ? 262 : 300;
    canvas.style.aspectRatio = VW + ' / ' + VH;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = w / VW;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * VH / VW * dpr);
  }
  new ResizeObserver(resize).observe(canvas); resize();

  function pathOf(seg) {
    if (seg.type === 'line') { ctx.moveTo(seg.x0, seg.y0); ctx.lineTo(seg.x1, seg.y1); }
    else if (seg.type === 'arc') {
      ctx.moveTo(seg.cx + seg.r * Math.cos(seg.t0), seg.cy + seg.r * Math.sin(seg.t0));
      ctx.arc(seg.cx, seg.cy, seg.r, seg.t0, seg.t1, seg.t1 < seg.t0);
    }
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  // ---------- static layers ----------
  function drawGrid() {
    ctx.fillStyle = T['--rule'];
    for (let x = 0; x <= 720; x += 24) for (let y = -12; y <= 228; y += 24) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, RW.TAU); ctx.fill(); }
  }
  function drawUnderground() {
    ctx.save(); ctx.setLineDash([3, 4]); ctx.lineWidth = 2; ctx.strokeStyle = T['--track-under']; ctx.lineCap = 'round';
    for (const t of world.tunnels) {
      const a = t.from, b = t.to;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(a.x + a.dx * 26, a.y + a.dy * 26, b.x - b.dx * 26, b.y - b.dy * 26, b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawPlatforms(elevated) {
    for (const st of world.stations) {
      if (!!st.elevated !== elevated) continue;
      const p = st.platform;
      ctx.fillStyle = T['--platform']; ctx.strokeStyle = T['--ink']; ctx.lineWidth = 1.4;
      if (elevated) { ctx.fillStyle = T['--shadow']; rrect(p.x + 2, p.y + 3, p.w, p.h, 3); ctx.fill(); ctx.fillStyle = T['--platform']; }
      if (p.type === 'rect') { rrect(p.x, p.y, p.w, p.h, 3); }
      else { ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, RW.TAU); }
      ctx.fill(); ctx.stroke();
      // platform edge markings
      ctx.save(); ctx.strokeStyle = T['--marigold']; ctx.lineWidth = 1.6;
      if (p.type === 'rect') { ctx.beginPath(); if (st.id === 'sky') { ctx.moveTo(p.x + 3, p.y + 1.8); ctx.lineTo(p.x + p.w - 3, p.y + 1.8); } else { ctx.moveTo(p.x + p.w - 1.8, p.y + 3); ctx.lineTo(p.x + p.w - 1.8, p.y + p.h - 3); } ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r - 2, 0, RW.TAU); ctx.stroke(); }
      ctx.restore();
    }
  }
  function drawLetters() {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    world.letters.forEach((L, i) => {
      ctx.strokeStyle = T[LINE[i]]; ctx.lineWidth = 11;
      ctx.beginPath(); L.parts.forEach(pathOf); ctx.stroke();
    });
  }
  function drawPortals() {
    // portal glyph: a small arch over the track end, opening towards the tunnel
    ctx.strokeStyle = T['--ink']; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (const p of world.portals) {
      const a = Math.atan2(p.dy, p.dx);
      ctx.beginPath(); ctx.arc(p.x, p.y, 8.5, a - Math.PI / 2, a + Math.PI / 2, true); ctx.stroke();
    }
  }
  function colorAt(x) { return T[LINE[x < 120 ? 0 : x < 260 ? 1 : x < 460 ? 2 : x < 600 ? 3 : 4]]; }
  function drawBridge() {
    ctx.lineCap = 'round';
    const g = ctx.createLinearGradient(140, 0, 720, 0);
    g.addColorStop(0, T['--tomato']); g.addColorStop(1, T['--cobalt']);
    ctx.save(); ctx.translate(3, 6); ctx.strokeStyle = T['--shadow']; ctx.lineWidth = 15; ctx.filter = 'blur(2px)';
    ctx.beginPath(); world.bridge.forEach(pathOf); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = T['--ink']; ctx.lineWidth = 16; ctx.beginPath(); world.bridge.forEach(pathOf); ctx.stroke();
    ctx.strokeStyle = T['--bg']; ctx.lineWidth = 12.5; ctx.stroke();
    ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.stroke();
  }
  function drawStationMarks() {
    for (const st of world.stations) {
      // mark sits beside the middle of a stopped train
      const p = world.pointAt(st.s - world.trainLength / 2);
      ctx.fillStyle = T['--surface']; ctx.strokeStyle = T['--ink']; ctx.lineWidth = 2.4;
      const nx = -Math.sin(p.a), ny = Math.cos(p.a);
      const sgn = ((st.cx - p.x) * nx + (st.cy - p.y) * ny) >= 0 ? 1 : -1;
      ctx.beginPath(); ctx.arc(p.x + nx * sgn * 9.5, p.y + ny * sgn * 9.5, 2.6, 0, RW.TAU); ctx.fill(); ctx.stroke();
    }
  }

  // ---------- moving things ----------
  function drawPeople(list) {
    for (const p of list) {
      if (p.alpha <= 0) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      const bob = p.moving ? Math.sin(p.phase * 2) * 0.35 : 0;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.roundRect(p.x - 1.5, p.y - 0.6 + bob, 3, 3.4, 1); ctx.fill();
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(p.x, p.y - 1.9 + bob, 1.25, 0, RW.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function carShape(c, W) {
    const L = c.len, h = W / 2;
    ctx.beginPath();
    if (c.kind === 'nose') {
      ctx.moveTo(-L / 2, -h); ctx.lineTo(L / 2 - 13, -h); ctx.quadraticCurveTo(L / 2 + 1, -h * 0.4, L / 2, 0);
      ctx.quadraticCurveTo(L / 2 + 1, h * 0.4, L / 2 - 13, h); ctx.lineTo(-L / 2, h); ctx.closePath();
    } else if (c.kind === 'cab' || (c.kind === 'loco' && world.liveryId === 'toy')) {
      ctx.roundRect(-L / 2, -h, L, W, [2, 4.5, 4.5, 2]);
    } else ctx.roundRect(-L / 2, -h, L, W, 2);
  }

  function passengerDots(c, x0, x1, y0, y1) {
    const n = c.passengers.length; if (!n) return;
    const cols = Math.ceil(Math.min(n, 6) / 2), dx = (x1 - x0) / Math.max(cols, 3);
    c.passengers.slice(0, 6).forEach((p, k) => {
      ctx.fillStyle = p.color;
      const col = k >> 1, row = k & 1;
      ctx.fillRect(x0 + dx * (col + 0.25), y0 + (row ? (y1 - y0) / 2 + 0.2 : 0.2), Math.min(2.4, dx * 0.6), (y1 - y0) / 2 - 0.4);
    });
  }

  function drawCar(c) {
    const C = world.livery.colors, W = 10, L = c.len, id = world.liveryId;
    const win = dark ? T['--lit'] : C.window;
    ctx.save();
    if (c.clip) {
      const P = c.clip, tx = -P.ny, ty = P.nx, F = 600;
      ctx.beginPath(); ctx.moveTo(P.x + tx * F, P.y + ty * F); ctx.lineTo(P.x - tx * F, P.y - ty * F);
      ctx.lineTo(P.x - tx * F + P.nx * F, P.y - ty * F + P.ny * F); ctx.lineTo(P.x + tx * F + P.nx * F, P.y + ty * F + P.ny * F); ctx.clip();
    }
    // shadow grows with height on the bridge
    const lift = 1 + c.z * 0.32;
    ctx.save(); ctx.translate(c.x + 1.2 * lift, c.y + 2 * lift); ctx.rotate(c.a); if (c.rev) ctx.scale(-1, 1);
    ctx.fillStyle = T['--shadow']; carShape(c, W); ctx.fill(); ctx.restore();

    ctx.translate(c.x, c.y); ctx.rotate(c.a); if (c.rev) ctx.scale(-1, 1);
    const coachCol = id === 'toy' ? (c.i % 2 ? C.coach : C.coach2) : (C.coach || C.body);

    if (c.kind === 'loco') {
      // cab at the back, boiler forward, chimney at the front
      ctx.fillStyle = C.roof; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, 10, W, 2); ctx.fill();
      ctx.fillStyle = C.body; ctx.beginPath(); ctx.roundRect(-L / 2 + 9, -W / 2 + 1.3, L - 9, W - 2.6, id === 'toy' ? 4 : [1, 3.5, 3.5, 1]); ctx.fill();
      ctx.strokeStyle = C.trim; ctx.lineWidth = 0.9;
      for (let x = -L / 2 + 13; x < L / 2 - 4; x += 5) { ctx.beginPath(); ctx.moveTo(x, -W / 2 + 1.5); ctx.lineTo(x, W / 2 - 1.5); ctx.stroke(); }
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(L / 2 - 6, 0, 2.3, 0, RW.TAU); ctx.fill();
      ctx.fillStyle = C.trim; ctx.beginPath(); ctx.arc(L / 2 - 13, 0, 1.6, 0, RW.TAU); ctx.fill();
      ctx.fillStyle = win; ctx.fillRect(-L / 2 + 2, -W / 2 + 2, 2, W - 4);
    } else if (c.kind === 'tender') {
      ctx.fillStyle = C.body; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 1.5); ctx.fill();
      ctx.fillStyle = '#1c1714'; ctx.fillRect(-L / 2 + 2, -W / 2 + 2, L - 4, W - 4);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let k = 0; k < 7; k++) ctx.fillRect(-L / 2 + 3 + (k * 7 % (L - 6)), -W / 2 + 2.6 + (k * 3 % 5), 1, 1);
    } else {
      const body = c.kind === 'coach' ? coachCol : C.body;
      ctx.fillStyle = body; carShape(c, W); ctx.fill();
      // side stripes
      ctx.fillStyle = C.trim;
      const front = c.kind === 'nose' ? L / 2 - 12 : L / 2 - 1;
      ctx.fillRect(-L / 2 + 1, -W / 2 + 0.6, front + L / 2 - 1, 1.3); ctx.fillRect(-L / 2 + 1, W / 2 - 1.9, front + L / 2 - 1, 1.3);
      // glass roof strip with passengers
      const x0 = -L / 2 + 3, x1 = (c.kind === 'coach' ? L / 2 - 3 : c.kind === 'nose' ? L / 2 - 15 : L / 2 - 7);
      ctx.fillStyle = id === 'steam' || id === 'heritage' ? C.coachRoof : win;
      ctx.beginPath(); ctx.roundRect(x0, -2.3, x1 - x0, 4.6, 1.2); ctx.fill();
      passengerDots(c, x0 + 0.5, x1 - 0.5, -2, 2);
      if (c.kind === 'cab' || c.kind === 'nose') { // windscreen
        ctx.fillStyle = win; ctx.beginPath();
        if (c.kind === 'nose') ctx.ellipse(L / 2 - 8, 0, 3.2, 2.6, 0, 0, RW.TAU); else ctx.roundRect(L / 2 - 4.5, -3.2, 2.6, 6.4, 1);
        ctx.fill();
      }
      if (id === 'toy') { ctx.fillStyle = C.coachRoof; ctx.fillRect(-L / 2 + 2, -W / 2 - 0.6, L - 4, 1); }
    }
    ctx.restore();
  }

  function drawPuffs() {
    for (const p of world.puffs) {
      const t = p.life / p.max;
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.fillStyle = dark ? '#d8cdc2' : '#ffffff';
      ctx.beginPath(); ctx.arc(p.x - p.z * 0.25, p.y - p.z * 0.45, p.r, 0, RW.TAU); ctx.fill();
      ctx.globalAlpha = (1 - t) * 0.35; ctx.strokeStyle = T['--muted']; ctx.lineWidth = 0.5; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const ITEMS = RW.nowItems(ROOT);
  const FK = '600 12px Overpass, system-ui, sans-serif', FV = '700 13px Overpass, system-ui, sans-serif', FL = '800 11px Overpass, system-ui, sans-serif';
  function drawBillboard() {
    if (compact || !ITEMS.length) return;
    ctx.font = FK; const kw = Math.max(...ITEMS.map(([k]) => ctx.measureText(k).width));
    ctx.font = FV; const vw = Math.max(...ITEMS.map(([, v]) => ctx.measureText(v).width));
    ctx.font = FL; const lw = ctx.measureText('Right now').width + 12;
    const h = 34, w = 6 + lw + 14 + kw + 8 + vw + 16, x = 430 - w / 2, y = -58;
    ctx.strokeStyle = T['--ink']; ctx.lineWidth = 3; ctx.lineCap = 'butt';
    [x + 40, x + w - 40].forEach(lx => { ctx.beginPath(); ctx.moveTo(lx, y + h); ctx.lineTo(lx, -7); ctx.stroke(); });
    ctx.fillStyle = T['--shadow']; rrect(x + 3, y + 5, w, h, 6); ctx.fill();
    ctx.fillStyle = T['--ink']; rrect(x - 3, y - 3, w + 6, h + 6, 8); ctx.fill();
    ctx.fillStyle = '#21140E'; rrect(x, y, w, h, 5); ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = T['--tomato']; rrect(x + 6, y + 6, lw, h - 12, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = FL; ctx.fillText('Right now', x + 12, y + h / 2 + 1);
    const tx = x + lw + 20;
    const tw = x + w - 6 - (tx - 4);
    if (!RW.reduceMotion) {
      // desktop and tablet: the whole list rolls past
      const segs = [];
      ITEMS.forEach(([k, v]) => { segs.push({ text: k + '  ', font: FK, color: '#E9D8C4' }, { text: v, font: FV, color: '#FFB648' }, { text: '      ·      ', font: FK, color: '#8C6A50' }); });
      ctx.save(); ctx.beginPath(); ctx.rect(tx - 4, y + 3, tw, h - 6); ctx.clip();
      ctx.shadowColor = 'rgba(255,182,72,.5)'; ctx.shadowBlur = 3;
      RW.marqueeSegments(ctx, segs, tx, y + h / 2 + 1, tw, world.time, 26, 0);
      ctx.restore();
    } else {
      const { i, a } = RW.nowCycle(world.time, ITEMS.length, 5), [k, v] = ITEMS[i];
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = '#E9D8C4'; ctx.font = FK; ctx.fillText(k, tx, y + h / 2 + 1);
      ctx.fillStyle = '#FFB648'; ctx.shadowColor = 'rgba(255,182,72,.6)'; ctx.shadowBlur = 4; ctx.font = FV; ctx.fillText(v, tx + kw + 8, y + h / 2 + 1);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    for (let gx = tx - 4; gx < x + w - 4; gx += 2.2) ctx.fillRect(gx, y + 3, .7, h - 6);
  }
  function frame() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -X0 * dpr * scale, -Y0 * dpr * scale);
    ctx.clearRect(X0, Y0, VW, VH);
    drawGrid(); drawUnderground(); drawPlatforms(false); drawLetters(); drawPortals(); drawStationMarks();
    drawPeople(world.people.filter(p => !p.station.elevated));
    world.cars.filter(c => !c.hidden && c.z < 0.5).forEach(drawCar);
    drawBillboard(); drawBridge(); drawPlatforms(true);
    drawPeople(world.people.filter(p => p.station.elevated));
    world.cars.filter(c => !c.hidden && c.z >= 0.5).forEach(drawCar);
    drawPuffs();
  }

  RW.bindControls(world, canvas.closest('[data-concept]') || document);
  RW.bindCanvasInput(world, canvas, (x, y) => ({ x: x / scale + X0, y: y / scale + Y0 }));
  RW.bindPageHelpers();
  RW.runLoop(world, frame, canvas);
})();
