/* Reef — tropical fish drifting behind the page. Click a fish, the school scatters.
   Art lives in fish-art.js (window.ReefArt). No dependencies.
   The canvas sits at z-index 0 with pointer-events:none, so links, buttons and text
   all keep working; clicks are hit-tested in JS against the fish positions. */
(() => {
  const cvs = document.getElementById('reef');
  if (!cvs) return;
  const ART = window.ReefArt;
  if (!ART) return;
  const ctx = cvs.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, S = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.round(W * dpr);
    cvs.height = Math.round(H * dpr);
    S = Math.max(0.72, Math.min(1.25, W / 1100));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const f of fishes) {
      f.x = Math.min(Math.max(f.x, 12), W - 12);
      f.y = Math.min(Math.max(f.y, 12), H - 12);
    }
    for (const w of whales) {
      w.x = Math.min(Math.max(w.x, 12), W - 12);
      w.y = Math.min(Math.max(w.y, 12), H - 12);
    }
  }

  const fishes = [];
  const whales = [];

  /* Three fish only: one orange, one blue, one pink. The cream and silver species
     washed out the white text, and the yellow tang plus the emperor angelfish came
     out on request too. Everything stays defined in fish-art.js, just unlisted
     here, so bringing one back is a one-line change. */
  const POOL = ART.SPECIES.filter(s => ['clown', 'bluetang', 'anthias'].includes(s.id));

  /* One humpback, always. Big, slow, and faint, so it reads as a shadow behind the school. */
  const WHALE = ART.SPECIES.find(s => s.id === 'whale');

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // one of each, so you always get the orange, the blue and the pink
  function loadout() {
    const bag = [];
    while (bag.length < COUNT()) {
      for (const s of shuffle(POOL.slice())) {
        if (bag.length >= COUNT()) break;
        bag.push(s);
      }
    }
    return bag;
  }

  const COUNT = () => 3;

  function makeFish(sp) {
    const k = S * (0.86 + Math.random() * 0.58);
    return {
      sp,
      len: sp.len * k, h: sp.h * k, k,
      x: Math.random() * W,
      y: H * 0.10 + Math.random() * H * 0.80,
      angle: (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7,
      speed: (13 + Math.random() * 15) * S,
      ix: 0, iy: 0, excite: 0,
      phase: Math.random() * Math.PI * 2,
      tail: 4.2 + Math.random() * 2.4,
      wander: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
      ry: 0
    };
  }

  function populate() {
    fishes.length = 0;
    for (const sp of loadout()) fishes.push(makeFish(sp));
    fishes.sort((a, b) => a.len - b.len);   // big fish in front
    for (const f of fishes) f.ry = f.y;
    whales.length = 0;
    if (WHALE) whales.push(makeWhale());
    for (const w of whales) w.ry = w.y;
  }

  function makeWhale() {
    const sp = WHALE;
    const k = S * (0.94 + Math.random() * 0.22);
    return {
      sp: sp,
      len: sp.len * k, h: sp.h * k, k: 0,
      x: Math.random() * W,
      y: H * 0.22 + Math.random() * H * 0.46,
      angle: Math.random() < 0.5 ? 0 : Math.PI,
      speed: (9 + Math.random() * 6) * S,
      ix: 0, iy: 0, excite: 0,
      phase: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
      spout: 0, nextSpout: 8 + Math.random() * 14,
      ry: 0
    };
  }

  function updateWhale(w, dt, time) {
    const decay = Math.exp(-dt * 1.5);
    w.ix *= decay; w.iy *= decay;
    w.excite *= Math.exp(-dt * 0.6);
    w.x += (Math.cos(w.angle) * w.speed * (1 + w.excite * 1.6) + w.ix) * dt;
    w.y += (Math.sin(w.angle) * w.speed * 0.2 + Math.sin(time * 0.11 + w.bob) * 3.2 * S + w.iy) * dt;

    const m = w.len * 0.75;
    if (Math.cos(w.angle) >= 0 && w.x > W + m) w.x = -m;
    else if (Math.cos(w.angle) < 0 && w.x < -m) w.x = W + m;

    const y0 = H * 0.14, y1 = H * 0.86;
    if (w.y < y0) w.y += (y0 - w.y) * Math.min(1, dt * 0.8);
    if (w.y > y1) w.y -= (w.y - y1) * Math.min(1, dt * 0.8);

    w.ry = w.y;

    if (w.spout > 0) {
      w.spout = Math.max(0, w.spout - dt);
    } else {
      w.nextSpout -= dt;
      if (w.nextSpout <= 0) { w.spout = 1.8; w.nextSpout = 16 + Math.random() * 18; }
    }
  }

  function drawSpout(ctx, w, t) {
    if (w.spout <= 0) return;
    const prog = (1.8 - w.spout) / 1.8;
    const env = Math.sin(Math.PI * prog);
    if (env <= 0.01) return;

    const bx = 0.30 * w.len, by = -0.70 * (w.h * 0.5);
    const ca = Math.cos(w.angle), sa = Math.sin(w.angle);
    const flip = ca < 0 ? -1 : 1;
    const hx = w.x + bx * ca - (by * flip) * sa;
    const hy = w.ry + bx * sa + (by * flip) * ca;

    ctx.save();
    ctx.fillStyle = '#e8f2fa';
    for (let i = 0; i < 7; i++) {
      const u = i / 6;
      const rise = prog * (26 + i * 15) * S;
      const spread = (i - 3) * 5.5 * S + Math.sin(t * 1.5 + i * 1.7) * 2.2 * S;
      const r = (3.0 + i * 1.8) * S * (0.6 + prog * 0.7);
      ctx.globalAlpha = 0.17 * env * (1 - u * 0.5);
      ctx.beginPath();
      ctx.arc(hx + spread, hy - rise, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function angleLerp(a, b, t) {
    let d = (b - a + Math.PI) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    d -= Math.PI;
    return a + d * t;
  }

  function update(f, dt, time) {
    f.wander += dt * (0.26 + f.excite * 1.5);
    const drift = Math.sin(f.wander) * 0.5 + Math.sin(f.wander * 1.63 + 2.1) * 0.32;
    let target = f.angle + drift * dt * 1.15;

    const m = Math.min(W, H) * 0.13;
    let sx = 0, sy = 0;
    if (f.x < m) sx = 1; else if (f.x > W - m) sx = -1;
    if (f.y < m) sy = 1; else if (f.y > H - m) sy = -1;
    if (sx || sy) target = angleLerp(target, Math.atan2(sy, sx), Math.min(1, dt * 2.2));

    f.angle = angleLerp(f.angle, target, Math.min(1, dt * 1.6));

    const decay = Math.exp(-dt * 1.5);
    f.ix *= decay; f.iy *= decay;
    f.excite *= Math.exp(-dt * 0.95);

    const sp = f.speed * (1 + f.excite * 2.0);
    f.x += (Math.cos(f.angle) * sp + f.ix) * dt;
    f.y += (Math.sin(f.angle) * sp * 0.72 + f.iy) * dt;

    f.ry = f.y + Math.sin(time * 0.65 + f.bob) * 5 * S;
  }

  function scatter(cx, cy) {
    for (const f of fishes) {
      const dx = f.x - cx, dy = f.ry - cy;
      const d = Math.max(38, Math.hypot(dx, dy));
      const power = 620 * S * Math.exp(-d / 240);
      f.ix += (dx / d) * power;
      f.iy += (dy / d) * power * 0.8;
      f.angle = angleLerp(f.angle, Math.atan2(dy, dx), 0.7);
      f.excite = Math.min(1.4, f.excite + 1.0 * Math.exp(-d / 320));
    }
  }

  window.addEventListener('pointerdown', (e) => {
    if (reduce || e.button) return;
    for (const w of whales) {
      const dx = e.clientX - w.x, dy = e.clientY - w.ry;
      const rad = w.len * 0.42;
      if (dx * dx + dy * dy <= rad * rad) { w.spout = 1.8; w.excite = Math.min(1.2, w.excite + 0.9); return; }
    }
    for (const f of fishes) {
      const dx = e.clientX - f.x, dy = e.clientY - f.ry;
      const rad = f.len * 0.6 + 16;
      if (dx * dx + dy * dy <= rad * rad) { scatter(e.clientX, e.clientY); return; }
    }
  }, { passive: true });

  let last = performance.now(), t = 0, raf = 0, running = true;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    ctx.clearRect(0, 0, W, H);
    for (const w of whales) { updateWhale(w, dt, t); ART.drawFish(ctx, w, t, 0.62); drawSpout(ctx, w, t); }
    for (const f of fishes) { update(f, dt, t); ART.drawFish(ctx, f, t); }
    if (running) raf = requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!reduce && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  window.addEventListener('resize', resize, { passive: true });

  resize();      // W/H/S must be known before fish are placed
  populate();

  if (reduce) {
    ctx.clearRect(0, 0, W, H);
    for (const w of whales) ART.drawFish(ctx, w, 0, 0.62);
    for (const f of fishes.slice(0, 8)) { update(f, 0.016, 0); ART.drawFish(ctx, f, 0, 0.85); }
  } else {
    raf = requestAnimationFrame(frame);
  }
})();
