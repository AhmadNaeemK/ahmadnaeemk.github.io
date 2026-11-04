/* RailWorld: shared simulation for the "ahmad" railway.
 * World units: baseline y=200, x-height y=100, ascender y=0. Letters span x 0..720.
 * Renderers only read world state; all motion, stations and passengers live here. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;

  // ---------- geometry ----------
  function line(x0, y0, x1, y1, kind) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    return { type: 'line', kind: kind || 'track', x0, y0, x1, y1, len,
      at(d) { const t = d / len; return { x: x0 + dx * t, y: y0 + dy * t, a }; } };
  }
  function arc(cx, cy, r, t0, t1, kind) {
    const len = Math.abs(t1 - t0) * r, s = Math.sign(t1 - t0);
    return { type: 'arc', kind: kind || 'track', cx, cy, r, t0, t1, len,
      at(d) {
        const th = t0 + s * d / r;
        return { x: cx + r * Math.cos(th), y: cy + r * Math.sin(th),
          a: Math.atan2(Math.cos(th) * s, -Math.sin(th) * s) };
      } };
  }
  const UNDER = 36;     // track continues this far past a portal before going fully hidden
  const HIDDEN = 50;    // time spent underground, in world units
  function tunnel(px, py, dx, dy, qx, qy, ex, ey) {
    const len = UNDER * 2 + HIDDEN;
    const inP = { x: px, y: py, nx: -dx, ny: -dy };
    const outP = { x: qx, y: qy, nx: ex, ny: ey };
    return { type: 'tunnel', kind: 'tunnel', len,
      from: { x: px, y: py, dx, dy }, to: { x: qx, y: qy, dx: ex, dy: ey },
      at(d) {
        if (d < UNDER) return { x: px + dx * d, y: py + dy * d, a: Math.atan2(dy, dx), portal: inP, under: d };
        if (d > UNDER + HIDDEN) {
          const r = len - d;
          return { x: qx - ex * r, y: qy - ey * r, a: Math.atan2(ey, ex), portal: outP, under: r };
        }
        return null;
      } };
  }
  function sample(seg, step) {
    const n = Math.max(2, Math.ceil(seg.len / (step || 2)));
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(seg.at(seg.len * i / n));
    return pts;
  }

  // ---------- the letters (drawing geometry) ----------
  const PI = Math.PI;
  const letters = [
    { ch: 'a', x: 0,   parts: [line(100, 100, 100, 200), arc(50, 150, 50, 0, TAU)] },
    { ch: 'h', x: 140, parts: [line(140, 20, 140, 200), arc(190, 150, 50, PI, TAU), line(240, 150, 240, 200)] },
    { ch: 'm', x: 280, parts: [line(280, 140, 280, 200), arc(320, 140, 40, PI, TAU), line(360, 140, 360, 200),
                               arc(400, 140, 40, PI, TAU), line(440, 140, 440, 200)] },
    { ch: 'a', x: 480, parts: [line(580, 100, 580, 200), arc(530, 150, 50, 0, TAU)] },
    { ch: 'd', x: 620, parts: [line(720, 20, 720, 200), arc(670, 150, 50, 0, TAU)] },
  ];
  const bridge = [arc(160, 20, 20, PI, PI * 1.5, 'bridge'), line(160, 0, 700, 0, 'bridge'), arc(700, 20, 20, PI * 1.5, TAU, 'bridge')];

  // ---------- the route: one closed loop ----------
  const U = [0, -1], D = [0, 1];
  const route = [
    line(100, 200, 100, 150), arc(50, 150, 50, 0, -TAU), line(100, 150, 100, 100),
    tunnel(100, 100, ...U, 140, 200, ...U),
    line(140, 200, 140, 20), ...bridge,
    line(720, 20, 720, 150), arc(670, 150, 50, 0, TAU), line(720, 150, 720, 200),
    tunnel(720, 200, ...D, 580, 200, ...U),
    line(580, 200, 580, 150), arc(530, 150, 50, 0, -TAU), line(580, 150, 580, 100),
    tunnel(580, 100, ...U, 440, 200, ...U),
    line(440, 200, 440, 140), arc(400, 140, 40, 0, -PI), line(360, 140, 360, 200),
    tunnel(360, 200, ...D, 280, 200, ...U),
    line(280, 200, 280, 140), arc(320, 140, 40, PI, TAU), line(360, 140, 360, 200),
    tunnel(360, 200, ...D, 240, 200, ...U),
    line(240, 200, 240, 150), arc(190, 150, 50, 0, -PI), line(140, 150, 140, 200),
    tunnel(140, 200, ...D, 100, 200, ...U),
  ];
  const starts = [];
  let total = 0;
  for (const seg of route) { starts.push(total); total += seg.len; }
  function segIndexAt(s) {
    let lo = 0, hi = route.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= s) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function pointAt(s) {
    s = ((s % total) + total) % total;
    const i = segIndexAt(s);
    const p = route[i].at(s - starts[i]);
    if (p) p.seg = route[i];
    return p;
  }
  const sOf = (segIdx, d) => starts[segIdx] + d;

  // portals (deduped) for renderers: dir points INTO the tunnel
  const portals = [];
  const tunnels = [];
  for (const seg of route) {
    if (seg.type !== 'tunnel') continue;
    tunnels.push({ from: seg.from, to: seg.to });
    const add = (x, y, dx, dy) => { if (!portals.some(p => p.x === x && p.y === y)) portals.push({ x, y, dx, dy }); };
    add(seg.from.x, seg.from.y, seg.from.dx, seg.from.dy);
    add(seg.to.x, seg.to.y, -seg.to.dx, -seg.to.dy);
  }

  // ---------- stations (decorative) ----------
  const stations = [
    { id: 'stem',   s: sOf(4, 154),        platform: { type: 'rect', x: 113, y: 52, w: 18, h: 78 } },
    { id: 'sky',    s: sOf(6, 300),        platform: { type: 'rect', x: 372, y: 7, w: 100, h: 11 }, elevated: true },
    { id: 'dbowl',  s: sOf(9, PI * 50),    platform: { type: 'circle', cx: 670, cy: 150, r: 29 } },
    { id: 'abowl',  s: sOf(13, PI * 50),   platform: { type: 'circle', cx: 530, cy: 150, r: 29 } },
  ];
  for (const st of stations) {
    const p = pointAt(st.s); st.x = p.x; st.y = p.y; st.a = p.a;
    const pl = st.platform;
    st.cx = pl.type === 'rect' ? pl.x + pl.w / 2 : pl.cx;
    st.cy = pl.type === 'rect' ? pl.y + pl.h / 2 : pl.cy;
  }
  function randomIn(pl, rnd, pad) {
    pad = pad || 2;
    if (pl.type === 'rect') return { x: pl.x + pad + rnd() * (pl.w - pad * 2), y: pl.y + pad + rnd() * (pl.h - pad * 2) };
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * (pl.r - pad);
    return { x: pl.cx + Math.cos(a) * r, y: pl.cy + Math.sin(a) * r };
  }

  // ---------- liveries ----------
  // kind: loco | cab | coach | tender | nose. Renderers decide the look per kind.
  const LIVERIES = {
    metro:    { name: 'Metro', cars: [['cab', 26], ['coach', 26], ['cab', 26, true]], gap: 3,
                colors: { body: '#F1E9DC', trim: '#D4502F', window: '#2B2F38', roof: '#D9CFC0', accent: '#E8A33D' } },
    bullet:   { name: 'Bullet', cars: [['nose', 32], ['coach', 26], ['coach', 26], ['nose', 32, true]], gap: 2,
                colors: { body: '#FAF7F0', trim: '#2F5FA8', window: '#1E2A3A', roof: '#E9E3D6', accent: '#E3B65A' } },
    steam:    { name: 'Steam', cars: [['loco', 30], ['tender', 16], ['coach', 26], ['coach', 26]], gap: 3, smoke: true,
                colors: { body: '#2F4A3A', trim: '#C9A24A', window: '#F3D9A0', roof: '#24382C', accent: '#B5402E', coach: '#8A5A3C', coachRoof: '#6E4630' } },
    heritage: { name: 'Crimson', cars: [['loco', 30], ['tender', 16], ['coach', 26], ['coach', 26], ['coach', 26]], gap: 3, smoke: true,
                colors: { body: '#B3262E', trim: '#E3B65A', window: '#F6DDA6', roof: '#2A1A1A', accent: '#1C1414', coach: '#8E1F2C', coachRoof: '#3A2326' } },
    toy:      { name: 'Toy', cars: [['loco', 24], ['coach', 22], ['coach', 22]], gap: 4, smoke: false,
                colors: { body: '#E0452B', trim: '#F4C430', window: '#2E86C1', roof: '#2E86C1', accent: '#3FA34D', coach: '#F4C430', coach2: '#2E86C1', coachRoof: '#E0452B' } },
  };

  const PALETTE = ['#E4572E', '#F3A712', '#29A39A', '#7B4B94', '#2F6EBA', '#E86A92', '#7FB800', '#FF8C42', '#3CBBB1', '#C1292E'];
  const SKIN = ['#F2D0B1', '#D9A779', '#B07A50', '#8A5A3B', '#5E3B26'];

  function mulberry(seed) {
    return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // ---------- world ----------
  function createWorld(opts) {
    opts = opts || {};
    const rnd = mulberry(opts.seed || 7);
    const SPEEDS = [0.5, 1, 1.6, 2.3];
    const CRUISE = 52, ACCEL = 26, DECEL = 34, WALK = 16;

    const w = {
      letters, bridge, route, portals, tunnels, stations, total, pointAt, sample, LIVERIES,
      speedIndex: 1, userStopped: !!opts.startStopped, v: 0, head: 0,
      mode: 'run', dwell: 0, lastStation: null, time: 0,
      cars: [], people: [], puffs: [], livery: null, liveryId: null,
      listeners: new Set(),
    };

    function emit() { w.listeners.forEach(fn => fn(w)); }
    w.onChange = fn => { w.listeners.add(fn); return () => w.listeners.delete(fn); };

    function newPerson(x, y, station) {
      return { x, y, tx: x, ty: y, color: PALETTE[(rnd() * PALETTE.length) | 0], skin: SKIN[(rnd() * SKIN.length) | 0],
        state: 'wait', station, alpha: 0, idle: rnd() * 3, delay: 0, car: null, phase: rnd() * TAU };
    }
    function otherStation(st) { const o = stations.filter(x => x !== st); return o[(rnd() * o.length) | 0]; }

    w.setLivery = function (id) {
      const L = LIVERIES[id] || LIVERIES.metro;
      const old = w.cars.flatMap(c => c.passengers);
      w.livery = L; w.liveryId = id;
      w.cars = L.cars.map(([kind, len, rev], i) => ({ i, kind, len, rev: !!rev, passengers: [], x: 0, y: 0, a: 0, hidden: false, clip: null, z: 0 }));
      const seats = w.cars.filter(c => c.kind === 'coach' || c.kind === 'cab' || c.kind === 'nose');
      old.forEach((p, k) => seats.length && seats[k % seats.length].passengers.push(p));
      w.trainLength = L.cars.reduce((t, c) => t + c[1], 0) + L.gap * (L.cars.length - 1);
      layoutCars();
      emit();
    };
    w.capacity = c => (c.kind === 'coach' ? 6 : (c.kind === 'cab' || c.kind === 'nose') ? 4 : 0);

    w.toggleStop = function (force) {
      w.userStopped = typeof force === 'boolean' ? force : !w.userStopped; emit();
    };
    w.setSpeed = function (i) { w.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, i)); if (w.userStopped) w.userStopped = false; emit(); };
    w.speeds = SPEEDS;

    function layoutCars() {
      let front = w.head;
      for (const c of w.cars) {
        const center = front - c.len / 2;
        const b = c.len * 0.38;
        const pf = pointAt(center + b), pb = pointAt(center - b);
        if (!pf || !pb) { c.hidden = true; c.clip = null; }
        else {
          c.hidden = false;
          c.x = (pf.x + pb.x) / 2; c.y = (pf.y + pb.y) / 2;
          c.a = Math.atan2(pf.y - pb.y, pf.x - pb.x);
          c.clip = pf.portal || pb.portal || null;
          // elevation for 2.5D renderers: on the bridge
          const zf = elevation(pf), zb = elevation(pb);
          c.z = (zf + zb) / 2; c.pitch = zf - zb;
        }
        front = center - c.len / 2 - w.livery.gap;
      }
    }
    function elevation(p) {
      if (!p.seg || p.seg.kind !== 'bridge') return 0;
      // ramp: full height along the straight span, easing on the end arcs
      const H = 16;
      if (p.seg.type === 'line') {
        const t = Math.min(p.x - 160, 700 - p.x);
        return H * Math.min(1, 0.55 + t / 90);
      }
      const far = p.x < 400 ? (p.x - 140) / 20 : (720 - p.x) / 20;
      return H * 0.55 * Math.max(0, Math.min(1, far));
    }
    w.elevationAt = elevation;

    function nextStation() {
      let best = null, bd = Infinity;
      for (const st of stations) {
        let d = (st.s - w.head + total) % total;
        if (st === w.lastStation && d > total - 5) continue;
        if (st === w.lastStation && d < 1) d += total;
        if (d < bd) { bd = d; best = st; }
      }
      return { st: best, d: bd };
    }

    function door(c, st) {
      const nx = -Math.sin(c.a), ny = Math.cos(c.a);
      const sgn = ((st.cx - c.x) * nx + (st.cy - c.y) * ny) >= 0 ? 1 : -1;
      return { x: c.x + nx * sgn * 6.5, y: c.y + ny * sgn * 6.5 };
    }

    function arrive(st) {
      w.mode = 'dwell'; w.dwell = 0; w.lastStation = st; w.v = 0;
      // alight
      for (const c of w.cars) {
        if (c.hidden) continue;
        const stay = [];
        for (const p of c.passengers) {
          if (p.dest === st && rnd() < 0.9) {
            const d = door(c, st), t = randomIn(st.platform, rnd, 3);
            const q = newPerson(d.x, d.y, st); q.color = p.color; q.skin = p.skin; q.alpha = 1;
            q.tx = t.x; q.ty = t.y; q.state = 'alight'; q.delay = rnd() * 0.6; q.leaveIn = 1 + rnd() * 2;
            w.people.push(q);
          } else stay.push(p);
        }
        c.passengers = stay;
      }
      // board
      const free = w.cars.filter(c => !c.hidden && w.capacity(c) > 0);
      for (const p of w.people) {
        if (p.station !== st || p.state !== 'wait') continue;
        if (rnd() < 0.15) continue; // some people are waiting for another train
        let best = null, bd = Infinity;
        for (const c of free) {
          const room = w.capacity(c) - c.passengers.length - w.people.filter(o => o.car === c).length;
          if (room <= 0) continue;
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < bd) { bd = d; best = c; }
        }
        if (!best) continue;
        const d = door(best, st);
        p.state = 'board'; p.car = best; p.tx = d.x; p.ty = d.y; p.delay = 0.3 + rnd() * 0.9;
      }
      emit();
    }

    function updatePeople(dt) {
      // spawn
      for (const st of stations) {
        const waiting = w.people.filter(p => p.station === st && p.state === 'wait').length;
        st.spawn = (st.spawn || 0) - dt;
        if (waiting < 6 && st.spawn <= 0) {
          const p0 = randomIn(st.platform, rnd, 3);
          w.people.push(newPerson(p0.x, p0.y, st));
          st.spawn = 2 + rnd() * 4;
        }
      }
      for (const p of w.people) {
        p.phase += dt * 6;
        if (p.delay > 0) { p.delay -= dt; continue; }
        if (p.state === 'wait') {
          p.alpha = Math.min(1, p.alpha + dt * 1.5);
          p.idle -= dt;
          if (p.idle <= 0) { const t = randomIn(p.station.platform, rnd, 3); p.tx = t.x; p.ty = t.y; p.idle = 2 + rnd() * 5; }
        }
        if (p.state === 'alight' || p.state === 'leave') {
          p.leaveIn -= dt;
          if (p.state === 'alight' && p.leaveIn <= 0) { p.state = 'leave'; }
          if (p.state === 'leave') p.alpha -= dt * 0.7;
        }
        const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
        const sp = (p.state === 'wait' ? WALK * 0.35 : WALK) * dt;
        if (dist > 0.01) { const k = Math.min(1, sp / dist); p.x += dx * k; p.y += dy * k; }
        p.moving = dist > 0.3;
        if (p.state === 'board' && dist < 0.6) {
          p.car.passengers.push({ color: p.color, skin: p.skin, dest: otherStation(p.station) });
          p.dead = true;
        }
      }
      w.people = w.people.filter(p => !p.dead && p.alpha > -0.01 || p.state === 'wait');
      w.people = w.people.filter(p => !(p.state === 'leave' && p.alpha <= 0));
    }

    function updatePuffs(dt) {
      if (w.livery.smoke && w.cars[0] && !w.cars[0].hidden && w.mode !== 'dwell') {
        const c = w.cars[0];
        w.puffAcc = (w.puffAcc || 0) + dt * (2 + w.v * 0.12);
        while (w.puffAcc > 1) {
          w.puffAcc -= 1;
          const off = c.rev ? -c.len * 0.3 : c.len * 0.3;
          w.puffs.push({ x: c.x + Math.cos(c.a) * off, y: c.y + Math.sin(c.a) * off, z: c.z + 12, r: 2.2, life: 0, max: 1.6 + rnd() * 0.8,
            vx: (rnd() - 0.5) * 4 - Math.cos(c.a) * w.v * 0.15, vy: (rnd() - 0.5) * 4 - Math.sin(c.a) * w.v * 0.15 });
        }
      } else if (w.livery.smoke && w.mode === 'dwell' && w.cars[0] && !w.cars[0].hidden && rnd() < dt * 1.2) {
        const c = w.cars[0], off = c.len * 0.3;
        w.puffs.push({ x: c.x + Math.cos(c.a) * off, y: c.y + Math.sin(c.a) * off, z: c.z + 12, r: 2, life: 0, max: 2.4, vx: (rnd() - .5) * 2, vy: (rnd() - .5) * 2 });
      }
      for (const p of w.puffs) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += 9 * dt; p.r += dt * 3.2; }
      w.puffs = w.puffs.filter(p => p.life < p.max);
    }

    w.update = function (dt) {
      dt = Math.max(0, Math.min(dt, 0.05)); // rAF can report a time just before a resumed loop's start
      w.time += dt;
      const vmax = CRUISE * SPEEDS[w.speedIndex];
      if (w.mode === 'dwell') {
        w.dwell += dt;
        const boarding = w.people.some(p => p.state === 'board');
        if ((w.dwell > 2.4 && !boarding) || w.dwell > 8) {
          for (const p of w.people) if (p.state === 'board') { p.state = 'wait'; p.car = null; p.idle = 0; }
          if (!w.userStopped) { w.mode = 'run'; emit(); }
        }
      } else {
        const { st, d } = nextStation();
        let target = w.userStopped ? 0 : vmax;
        const brakeV = Math.sqrt(2 * DECEL * Math.max(0, d));
        if (w.v < target) w.v = Math.min(target, w.v + ACCEL * dt);
        else w.v = Math.max(target, w.v - DECEL * 1.3 * dt);
        if (!w.userStopped && w.v > brakeV) w.v = Math.max(brakeV, 3);
        const step = w.v * dt;
        if (st && step >= d) { w.head = st.s; layoutCars(); arrive(st); }
        else w.head = (w.head + step) % total;
      }
      layoutCars();
      updatePeople(dt);
      updatePuffs(dt);
    };

    w.hitTrain = function (x, y, r) {
      r = r || 16;
      return w.cars.some(c => !c.hidden && Math.hypot(c.x - x, c.y - y) < r);
    };

    // initial state: a few waiting, some aboard, train approaching the first station
    w.setLivery(opts.livery || 'metro');
    w.head = stations[0].s - 70;
    for (const st of stations) {
      for (let k = 0; k < 3 + (rnd() * 3 | 0); k++) { const p0 = randomIn(st.platform, rnd, 3); const p = newPerson(p0.x, p0.y, st); p.alpha = 1; w.people.push(p); }
    }
    for (const c of w.cars) {
      const n = (w.capacity(c) * rnd() * 0.7) | 0;
      for (let k = 0; k < n; k++) c.passengers.push({ color: PALETTE[(rnd() * PALETTE.length) | 0], skin: SKIN[(rnd() * SKIN.length) | 0], dest: stations[(rnd() * stations.length) | 0] });
    }
    w.v = opts.startStopped ? 0 : CRUISE;
    layoutCars();
    return w;
  }

  // ---------- page wiring shared by every concept ----------
  function bindControls(world, root) {
    root = root || document;
    const toggle = root.querySelector('[data-rail-toggle]');
    const speedBtns = [...root.querySelectorAll('[data-rail-speed]')];
    const livBtns = [...root.querySelectorAll('[data-rail-livery]')];
    function sync() {
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(world.userStopped));
        toggle.dataset.state = world.userStopped ? 'stop' : 'go';
        const label = toggle.querySelector('[data-rail-label]');
        if (label) label.textContent = world.userStopped ? 'Start the train' : 'Stop the train';
        toggle.setAttribute('aria-label', world.userStopped ? 'Start the train' : 'Stop the train');
      }
      speedBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.railSpeed === world.speedIndex && !world.userStopped)));
      livBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.railLivery === world.liveryId)));
    }
    toggle && toggle.addEventListener('click', () => world.toggleStop());
    speedBtns.forEach(b => b.addEventListener('click', () => world.setSpeed(+b.dataset.railSpeed)));
    livBtns.forEach(b => b.addEventListener('click', () => { world.setLivery(b.dataset.railLivery); try { localStorage.setItem('rail-livery', b.dataset.railLivery); } catch (e) {} }));
    world.onChange(sync); sync();
  }

  function bindCanvasInput(world, canvas, toWorld) {
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      const p = toWorld(e.clientX - r.left, e.clientY - r.top);
      canvas.style.cursor = world.hitTrain(p.x, p.y) ? 'pointer' : '';
    });
    canvas.addEventListener('click', e => {
      const r = canvas.getBoundingClientRect();
      const p = toWorld(e.clientX - r.left, e.clientY - r.top);
      if (world.hitTrain(p.x, p.y, 20)) world.toggleStop();
    });
    const hero = canvas.closest('[data-rail-hero]') || canvas.parentElement;
    hero.addEventListener('keydown', e => {
      if (e.target.closest('button, a, input')) return;
      if (e.key === ' ') { e.preventDefault(); world.toggleStop(); }
      if (e.key === 'ArrowRight' || e.key === '+') world.setSpeed(world.speedIndex + 1);
      if (e.key === 'ArrowLeft' || e.key === '-') world.setSpeed(world.speedIndex - 1);
    });
  }

  function runLoop(world, draw, canvas) {
    let last = performance.now(), visible = true, raf = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    function frame(t) {
      const dt = (t - last) / 1000; last = t;
      world.update(dt);
      draw(world, dt);
      raf = visible ? requestAnimationFrame(frame) : 0;
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        visible = es[0].isIntersecting && !document.hidden;
        if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
    draw(world, 0);
    raf = requestAnimationFrame(frame);
    return { reduce: reduce.matches };
  }

  // theme: system by default, toggle overrides and is remembered for this viewer
  // theme: system by default, the toggle overrides and is remembered for this viewer.
  // Safe to call once per renderer: buttons are bound once and every caller is notified.
  const themeSubs = [];
  let themeBound = false;
  function bindTheme(onChange) {
    const root = document.documentElement;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : mq.matches;
    const sync = () => {
      document.querySelectorAll('[data-theme-toggle]').forEach(b => { b.setAttribute('aria-pressed', String(isDark())); b.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); });
      themeSubs.forEach(fn => fn(isDark()));
    };
    if (!themeBound) {
      themeBound = true;
      try { const t = localStorage.getItem('rail-theme'); if (t === 'light' || t === 'dark') root.dataset.theme = t; } catch (e) {}
      document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
        root.dataset.theme = isDark() ? 'light' : 'dark';
        try { localStorage.setItem('rail-theme', root.dataset.theme); } catch (e) {}
        sync();
      }));
      mq.addEventListener('change', sync);
    }
    if (onChange) themeSubs.push(onChange);
    sync();
    return isDark;
  }

  // page helpers: copy email, CV download through the viewer when available
  let helpersBound = false;
  function bindPageHelpers() {
    if (helpersBound) return; helpersBound = true;
    document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      const text = b.dataset.copy, label = b.querySelector('[data-copy-label]') || b;
      const old = label.textContent;
      try { await navigator.clipboard.writeText(text); label.textContent = 'Copied'; }
      catch (e) {
        const el = (b.closest('[data-concept]') || document).querySelector('[data-copy-target]');
        if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        label.textContent = 'Press Ctrl+C';
      }
      setTimeout(() => (label.textContent = old), 1800);
    }));
    let dl = null;
    if (window.claude && window.claude.use) window.claude.use('downloads').then(x => (dl = x)).catch(() => {});
    document.querySelectorAll('[data-cv]').forEach(a => a.addEventListener('click', async e => {
      if (!dl) return; // normal link on the real site
      e.preventDefault();
      try {
        const blob = await (await fetch(a.getAttribute('href'))).blob();
        await dl.save({ filename: 'Ahmad_Naeem_CV.pdf', data: blob });
      } catch (err) { /* viewer declined or saving is unavailable */ }
    }));
    const y = document.querySelector('[data-year]'); if (y) y.textContent = new Date().getFullYear();
  }

  function cssVar(name, el) { return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim(); }


  // "Right now" billboard: text comes from the page's ticker markup so content lives in one place
  function nowText(root) {
    const items = [...(root || document).querySelectorAll('.now__list:not([aria-hidden]) li:not([aria-hidden])')]
      .map(li => li.textContent.replace(/\s+/g, ' ').trim());
    return items.join('   ·   ');
  }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function nowItems(root) {
    return [...(root || document).querySelectorAll('.now__list:not([aria-hidden]) li:not([aria-hidden])')]
      .map(li => [li.querySelector('.now__k').textContent.trim(), li.querySelector('.now__v').textContent.trim()]);
  }
  // which item the billboard shows at time t, and its opacity (fades between items; hard swap with reduced motion)
  function nowCycle(t, n, period) {
    period = period || 5;
    n = Math.max(1, n); t = Math.max(0, t);
    const ph = t / period, i = ((Math.floor(ph) % n) + n) % n, f = ph - Math.floor(ph), edge = 0.1;
    let a = 1;
    if (!reduceMotion && n > 1) a = f < edge ? f / edge : f > 1 - edge ? (1 - f) / edge : 1;
    return { i, a };
  }
  // draws text scrolling left inside [x, x + w]; caller sets font, colour and clip
  function marquee(ctx, text, x, baseline, w, t, speed) {
    const gap = ctx.measureText('      ').width, tw = ctx.measureText(text).width + gap;
    const off = reduceMotion ? 0 : (t * speed) % tw;
    for (let k = -off; k < w; k += tw) ctx.fillText(text, x + k, baseline);
  }
  global.RailWorld = { createWorld, bindControls, bindCanvasInput, runLoop, bindTheme, bindPageHelpers, cssVar, sample, LIVERIES, TAU, nowText, marquee, nowItems, nowCycle };
})(window);
