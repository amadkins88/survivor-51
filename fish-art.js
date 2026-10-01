/* Reef art: procedural tropical fish, drawn in detail.
   Pure drawing, no state, no timers. Used by fish.js on the site and by
   fish-sheet.html for visual review.

   Each fish renders into its own offscreen sprite at full opacity, then the
   sprite is composited onto the reef at the low alpha that keeps the school
   behind the text. One alpha for the whole fish avoids the bright stacking
   that happens when translucent fins overlap the body.

   Coordinates: a point [x, y] is x times the fish length (0 = centre, 0.5 =
   snout, -0.5 = tail base) and y in half-heights (1 = top or bottom of the
   body ellipse). */
(function (root) {
  const TAU = Math.PI * 2;

  /* ---------------- helpers ---------------- */

  function lerp(a, b, t) { return a + (b - a) * t; }

  function rgba(hex, a) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // Closed Catmull-Rom path through a list of [x, y] points.
  function smoothPath(ctx, ps) {
    const n = ps.length;
    ctx.moveTo(ps[0][0], ps[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = ps[(i - 1 + n) % n], p1 = ps[i], p2 = ps[(i + 1) % n], p3 = ps[(i + 2) % n];
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]);
    }
    ctx.closePath();
  }

  // Point at parameter t (0..1) along an open polyline.
  function along(ps, t) {
    const n = ps.length - 1;
    const f = Math.max(0, Math.min(1, t)) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const u = f - i;
    return [lerp(ps[i][0], ps[i + 1][0], u), lerp(ps[i][1], ps[i + 1][1], u)];
  }

  // The stretch of a rail between two x values, sampled evenly (xA is forward).
  function railBetween(ps, xA, xB, n) {
    const N = n || 9;
    const tFor = (x) => {
      for (let i = 0; i < ps.length - 1; i++) {
        const a = ps[i], b = ps[i + 1];
        if ((x <= a[0] && x >= b[0]) || (x >= a[0] && x <= b[0])) {
          const d = b[0] - a[0];
          const u = Math.abs(d) < 1e-6 ? 0 : (x - a[0]) / d;
          return (i + u) / (ps.length - 1);
        }
      }
      return x > ps[0][0] ? 0 : 1;
    };
    const t0 = tFor(xA), t1 = tFor(xB);
    const out = [];
    for (let i = 0; i <= N; i++) out.push(along(ps, lerp(t0, t1, i / N)));
    return out;
  }

  /* ---------------- scale texture ---------------- */

  const tileCache = new Map();

  function scalePattern(ctx, col) {
    let p = tileCache.get(col);
    if (p) return p;
    const t = document.createElement('canvas');
    t.width = 14; t.height = 14;
    const g = t.getContext('2d');
    g.strokeStyle = col;
    g.globalAlpha = 0.55;
    g.lineWidth = 0.9;
    for (let row = -1; row < 3; row++) {
      for (let col2 = -1; col2 < 3; col2++) {
        const x = col2 * 7 + (row % 2 ? 3.5 : 0), y = row * 7;
        g.beginPath();
        g.arc(x, y, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      }
    }
    p = ctx.createPattern(t, 'repeat');
    tileCache.set(col, p);
    return p;
  }

  /* ---------------- shapes ---------------- */

  const SHAPES = {
    deep: {
      top: [[.50, .10], [.42, -.40], [.28, -.78], [.06, -.90], [-.16, -.83], [-.32, -.58], [-.42, -.24]],
      bot: [[.50, .10], [.44, .44], [.32, .76], [.10, .88], [-.12, .82], [-.30, .58], [-.42, .24]]
    },
    slender: {
      top: [[.50, .04], [.42, -.34], [.28, -.60], [.06, -.70], [-.18, -.64], [-.34, -.44], [-.42, -.22]],
      bot: [[.50, .04], [.44, .28], [.30, .54], [.08, .62], [-.16, .56], [-.32, .40], [-.42, .20]]
    },
    flat: {
      top: [[.50, .02], [.40, -.44], [.24, -.78], [.02, -.86], [-.20, -.78], [-.34, -.56], [-.42, -.26]],
      bot: [[.50, .02], [.42, .42], [.26, .74], [.04, .82], [-.18, .76], [-.32, .54], [-.42, .24]]
    },
    whale: {
      top: [[.50, -.22], [.44, -.60], [.36, -.80], [.24, -.92], [.08, -.99], [-.08, -.95], [-.20, -.88], [-.30, -.78], [-.40, -.62], [-.46, -.42], [-.50, -.18]],
      bot: [[.50, .22], [.45, .62], [.36, .84], [.22, .95], [.04, .99], [-.12, .95], [-.24, .87], [-.34, .76], [-.42, .58], [-.47, .36], [-.50, .16]]
    }
  };

  /* ---------------- species ---------------- */

  const SPECIES = [
    {
      id: 'clown', name: 'Clownfish', len: 54, h: 27,
      body: ['#e0551a', '#f2762c', '#f9a355'],
      fin: '#f0863c', tailFill: '#f2762c', tailEdge: '#c85a1c', edge: '#8f3a12',
      shape: 'deep',
      bars: [{ x: .18, w: .10, c: '#fbf7ec', edge: '#191410' },
             { x: .50, w: .085, c: '#fbf7ec', edge: '#191410' },
             { x: .81, w: .075, c: '#fbf7ec', edge: '#191410' }],
      dorsal: { from: .26, to: -.34, rays: 10,
        edge: [[.26, -.95], [.14, -1.30], [.00, -1.34], [-.03, -1.10], [-.16, -1.22], [-.34, -.95]] },
      anal: { from: -.04, to: -.32, rays: 6, edge: [[-.04, 1.02], [-.16, 1.12], [-.32, .86]] },
      pelvic: { from: .18, to: .02, rays: 5, edge: [[.18, 1.02], [.06, 1.24], [-.02, 1.00]] },
      pectoral: { at: [.14, .10], a0: -.30, a1: .95, r: .34, rays: 7 },
      tail: { len: .30, spread: .62, concavity: .10, pow: 2.2, rays: 11 },
      eye: [.34, -.22, .21],
      bow: .07
    },
    {
      id: 'bluetang', name: 'Blue tang', len: 66, h: 34,
      body: ['#1c4a9e', '#2f6fd0', '#69a3e6'],
      fin: '#2a5cb0', tailFill: '#f2c62e', tailEdge: '#c9a018', edge: '#153a76',
      shape: 'deep',
      marks: [{ type: 'blob', x: .36, y: .04, rx: .26, ry: .40, rot: -.18, c: '#12285a' },
              { type: 'band', x: .86, w: .09, c: '#f2c62e' }],
      dorsal: { from: .34, to: -.36, rays: 12,
        edge: [[.34, -.86], [.20, -1.16], [.02, -1.26], [-.18, -1.16], [-.36, -.84]] },
      anal: { from: -.06, to: -.36, rays: 7, edge: [[-.06, 1.02], [-.20, 1.18], [-.36, .84]] },
      pelvic: { from: .16, to: .00, rays: 5, edge: [[.16, 1.00], [.04, 1.26], [-.06, 1.00]] },
      pectoral: { at: [.16, .06], a0: -.20, a1: 1.05, r: .30, rays: 8, col: '#f2d268', alpha: .45 },
      tail: { len: .32, spread: .58, concavity: .46, pow: 1.8, rays: 12 },
      eye: [.38, -.20, .19]
    },
    {
      id: 'anthias', name: 'Sea goldie', len: 44, h: 22,
      body: ['#c93e63', '#e0637f', '#f4a6b8'],
      fin: '#ef8ba4', tailFill: '#e0637f', tailEdge: '#b73a5c', edge: '#a8324f',
      shape: 'slender',
      marks: [{ type: 'stripe', y: -.14, h: .20, a: .5, c: '#b2305a' }],
      dorsal: { from: .28, to: -.30, rays: 9,
        edge: [[.28, -.72], [.16, -1.34], [.04, -1.44], [-.12, -1.16], [-.30, -.78]] },
      anal: { from: -.04, to: -.30, rays: 6, edge: [[-.04, .86], [-.16, .96], [-.30, .70]] },
      pelvic: { from: .20, to: .04, rays: 5, edge: [[.20, .92], [.08, 1.30], [-.02, .98]] },
      pectoral: { at: [.18, .06], a0: -.25, a1: 1.05, r: .34, rays: 7, col: '#f4a6b8', alpha: .45 },
      tail: { len: .36, spread: .52, concavity: .52, pow: 1.7, tipExt: .16, rays: 11 },
      eye: [.34, -.16, .24]
    },
    {
      id: 'idol', name: 'Moorish idol', len: 82, h: 38,
      body: ['#f7efdd', '#eee2cb', '#fbf7ec'],
      fin: '#e59a2b', tailFill: '#e2652a', tailEdge: '#b74e1c', edge: '#a99a76',
      shape: 'flat',
      bars: [{ x: .20, w: .11, c: '#171512' }, { x: .55, w: .14, c: '#e2652a' }, { x: .82, w: .10, c: '#171512' }],
      dorsal: { from: .30, to: -.36, rays: 12,
        edge: [[.30, -.86], [.10, -1.90], [-.10, -2.10], [-.36, -1.00]] },
      anal: { from: -.04, to: -.36, rays: 7, edge: [[-.04, 1.00], [-.18, 1.40], [-.36, .86]] },
      pelvic: { from: .18, to: .02, rays: 5, edge: [[.18, 1.00], [.04, 1.34], [-.04, 1.00]] },
      pectoral: { at: [.16, .08], a0: -.20, a1: 1.00, r: .28, rays: 7 },
      tail: { len: .26, spread: .52, concavity: .12, pow: 2.0, rays: 10 },
      eye: [.40, -.14, .18]
    },
    {
      id: 'tang', name: 'Yellow tang', len: 64, h: 36,
      body: ['#e8b42a', '#f0c02c', '#f9e08f'],
      fin: '#2e8b8b', tailFill: '#e8b430', tailEdge: '#c2951c', edge: '#b0851c',
      shape: 'flat',
      marks: [{ type: 'stripe', y: .02, h: .10, a: .3, c: '#c99a14' }],
      dorsal: { from: .32, to: -.36, rays: 12,
        edge: [[.32, -.88], [.16, -1.30], [-.02, -1.42], [-.20, -1.24], [-.36, -.90]] },
      anal: { from: -.02, to: -.36, rays: 7, edge: [[-.02, 1.04], [-.20, 1.30], [-.36, .88]] },
      pelvic: { from: .18, to: .02, rays: 5, edge: [[.18, 1.00], [.04, 1.30], [-.04, 1.00]] },
      pectoral: { at: [.14, .10], a0: -.30, a1: .95, r: .30, rays: 7 },
      tail: { len: .26, spread: .56, concavity: .10, pow: 2.0, rays: 10 },
      eye: [.44, -.18, .18]
    },
    {
      id: 'sergeant', name: 'Sergeant major', len: 58, h: 28,
      body: ['#dcd8c6', '#e9e6d8', '#f6f3e9'],
      fin: '#c9c2ab', tailFill: '#e0dccb', tailEdge: '#bdb69f', edge: '#9d9683',
      shape: 'slender',
      bars: [{ x: .14, w: .055, c: '#20201d' }, { x: .32, w: .055, c: '#20201d' },
             { x: .50, w: .055, c: '#20201d' }, { x: .68, w: .055, c: '#20201d' },
             { x: .86, w: .055, c: '#20201d' }],
      dorsal: { from: .26, to: -.32, rays: 11,
        edge: [[.26, -.74], [.10, -1.10], [-.08, -1.02], [-.20, -1.06], [-.32, -.72]] },
      anal: { from: -.02, to: -.30, rays: 6, edge: [[-.02, .86], [-.16, .94], [-.30, .68]] },
      pelvic: { from: .18, to: .02, rays: 5, edge: [[.18, .88], [.06, 1.10], [-.02, .86]] },
      pectoral: { at: [.14, .08], a0: -.30, a1: .95, r: .28, rays: 7 },
      tail: { len: .24, spread: .55, concavity: .30, pow: 1.8, rays: 10 },
      eye: [.36, -.16, .20]
    },
    {
      id: 'emperor', name: 'Emperor angelfish', len: 68, h: 36,
      body: ['#2f3f88', '#3b4f9e', '#7a8ccb'],
      fin: '#2b3a7d', tailFill: '#e8b430', tailEdge: '#c2951c', edge: '#232f66',
      shape: 'flat',
      bars: [{ x: .34, w: .16, c: '#e8b430' }, { x: .62, w: .14, c: '#1b1b22' }, { x: .86, w: .10, c: '#e8b430' }],
      dorsal: { from: .30, to: -.34, rays: 11,
        edge: [[.30, -.88], [.06, -1.30], [-.14, -1.22], [-.34, -.92]] },
      anal: { from: -.02, to: -.34, rays: 7, edge: [[-.02, 1.00], [-.16, 1.24], [-.34, .88]] },
      pelvic: { from: .18, to: .02, rays: 5, edge: [[.18, .98], [.06, 1.22], [-.02, .96]] },
      pectoral: { at: [.16, .08], a0: -.25, a1: 1.00, r: .30, rays: 7 },
      tail: { len: .28, spread: .55, concavity: .20, pow: 2.0, rays: 11 },
      eye: [.40, -.16, .19]
    },
    {
      id: 'butterfly', name: 'Copperband butterflyfish', len: 58, h: 34,
      body: ['#f7f1de', '#f1e8d2', '#fcf8ee'],
      fin: '#f0c02c', tailFill: '#f7f1de', tailEdge: '#ded4ba', edge: '#b8ad91',
      shape: 'flat',
      bars: [{ x: .24, w: .065, c: '#e5623a' }, { x: .42, w: .065, c: '#e5623a' },
             { x: .60, w: .065, c: '#e5623a' }, { x: .78, w: .065, c: '#e5623a' }],
      spot: true,
      dorsal: { from: .32, to: -.34, rays: 11,
        edge: [[.32, -.84], [.08, -1.34], [-.20, -1.16], [-.34, -.86]] },
      anal: { from: -.02, to: -.34, rays: 6, edge: [[-.02, .98], [-.16, 1.20], [-.34, .84]] },
      pelvic: { from: .18, to: .02, rays: 5, edge: [[.18, .94], [.06, 1.18], [-.02, .92]] },
      pectoral: { at: [.16, .08], a0: -.25, a1: 1.00, r: .26, rays: 7 },
      tail: { len: .22, spread: .60, concavity: 0, pow: 2.0, rays: 10 },
      eye: [.38, -.20, .22]
    },
    {
      id: 'whale', name: 'Humpback whale', kind: 'whale',
      len: 340, h: 168,
      back: '#6f92b4', mid: '#bdd2e4', belly: '#eaf3fa',
      fin: '#9dbcd4', finEdge: '#6f92b4',
      pecFill: '#ffffff', pecEdge: '#a7c4da',
      flukeFill: '#b8cee0', flukeEdge: '#eaf3fa',
      edge: '#7d9cba',
      shape: 'whale',
      dorsal: { from: -.06, to: -.24, peak: -.19 },
      fluke: { len: .32, spread: .66, notch: .40, pow: 1.5, tipExt: .16 },
      pec: { at: [.22, .30], rot: 0.55, len: .62 },
      blow: [.29, -.75],
      blowSize: [5.2, 2.4],
      eye: [.37, -.26, .12],
      flank: [],
      mottle: []
    }
  ];

  for (const sp of SPECIES) {
    const sh = SHAPES[sp.shape];
    sp.top = sh.top;
    sp.bot = sh.bot;
    sp.bodyPts = sh.top.concat([[-.47, 0]], sh.bot.slice().reverse());
  }

  /* ---------------- geometry for one frame ---------------- */

  function geom(f, sp, time) {
    const L = f.len, hh = f.h * 0.5;
    const q = time * f.tail + f.phase;
    const amp = L * 0.052 * (1 + f.excite * 0.9);
    const bend = (xu) => {
      const back = Math.max(0, 0.5 - xu);
      return amp * Math.pow(back, 1.45) * Math.sin(q - back * 2.5);
    };
    const T = (p) => [p[0] * L, p[1] * hh + bend(p[0])];

    const yA = bend(-0.40), yB = bend(-0.52);
    const tailAngle = -Math.atan2(yB - yA, 0.12 * L) + Math.sin(q - 1.0) * 0.10 * (1 + f.excite);

    return { L: L, hh: hh, q: q, bend: bend, T: T, tailAngle: tailAngle };
  }

  /* ---------------- fin drawing ---------------- */

  // Ribbon fin between a base rail (on the body) and an outer edge rail.
  function ribbedFin(g, base, edge, rays, fill, rayCol, opts) {
    const o = opts || {};
    const n = o.samples || 14;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = along(edge, i / n);
      if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
    }
    for (let i = n; i >= 0; i--) {
      const p = along(base, i / n);
      g.lineTo(p[0], p[1]);
    }
    g.closePath();
    const bm = along(base, 0.5), em = along(edge, 0.5);
    const grd = g.createLinearGradient(bm[0], bm[1], em[0], em[1]);
    grd.addColorStop(0, rgba(fill, o.baseAlpha === undefined ? 0.92 : o.baseAlpha));
    grd.addColorStop(1, rgba(fill, o.tipAlpha === undefined ? 0.46 : o.tipAlpha));
    g.fillStyle = grd;
    g.save();
    g.clip();
    g.fill();
    g.globalAlpha = o.rayAlpha === undefined ? 0.28 : o.rayAlpha;
    g.strokeStyle = rayCol || 'rgba(0,0,0,0.6)';
    g.lineWidth = o.rayW || 1;
    for (let i = 1; i < rays; i++) {
      const t = i / rays;
      const b = along(base, t), e = along(edge, t);
      g.beginPath();
      g.moveTo(b[0], b[1]);
      g.lineTo(lerp(b[0], e[0], 1.04), lerp(b[1], e[1], 1.04));
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Radiating fan fin (pectoral).
  function fanFin(g, at, a0, a1, r, rays, fill, opts) {
    const o = opts || {};
    const N = 10, edge = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = lerp(a0, a1, u);
      const rr = r * (0.72 + 0.34 * Math.sin(Math.PI * u));
      edge.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    g.beginPath();
    g.moveTo(0, 0);
    for (const p of edge) g.lineTo(p[0], p[1]);
    g.closePath();
    const fg = g.createRadialGradient(0, 0, r * 0.08, 0, 0, r * 1.05);
    fg.addColorStop(0, rgba(fill, 0.92));
    fg.addColorStop(1, rgba(fill, o.alpha === undefined ? 0.42 : o.alpha));
    g.fillStyle = fg;
    g.save();
    g.clip();
    g.fill();
    g.globalAlpha = 0.32;
    g.strokeStyle = o.rayCol || 'rgba(0,0,0,0.55)';
    g.lineWidth = 0.9;
    for (let i = 1; i < rays; i++) {
      const a = lerp(a0, a1, i / rays);
      const rr = r * 1.05;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Caudal fin: r(u) shrinks toward the middle by concavity, tips can stream.
  function caudalFin(g, spec, L, hh, rayc, edgeCol) {
    const N = 26, pts = [];
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      const a = u * spec.spread;
      const r = spec.len * (1 - spec.concavity * (1 - Math.pow(Math.abs(u), spec.pow)))
              + (spec.tipExt || 0) * Math.pow(Math.abs(u), 6);
      pts.push([-Math.cos(a) * r * L, Math.sin(a) * r * hh]);
    }
    g.beginPath();
    g.moveTo(0, 0);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.closePath();
    g.save();
    g.clip();
    const tg = g.createLinearGradient(0, 0, -spec.len * L, 0);
    tg.addColorStop(0, rgba(rayc, 0.95));
    tg.addColorStop(1, rgba(rayc, 0.55));
    g.fillStyle = tg;
    g.fill();
    g.globalAlpha = 0.26;
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 0.9;
    for (let i = 0; i < pts.length; i += 2) {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(pts[i][0] * 1.03, pts[i][1] * 1.03);
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
    // softer trailing edge
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokeStyle = edgeCol;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.6;
    g.stroke();
    g.globalAlpha = 1;
  }

  /* Broad notched fluke, angled so both lobes read. This is the shape that says
     whale; a slim fish-style tail was the main thing making it read as a fish. */
  function flukeFin(g, spec, L, hh, fill, edgeCol) {
    const pts = [
      [0.04, 0.00], [-0.06, -0.34], [-0.16, -0.72], [-0.24, -1.02],
      [-0.16, -0.60], [-0.13, -0.06], [-0.16, 0.60], [-0.24, 1.02],
      [-0.16, 0.72], [-0.06, 0.34]
    ].map(p => [p[0] * L, p[1] * hh]);

    g.beginPath();
    smoothPath(g, pts);
    const tg = g.createLinearGradient(0, -1.02 * hh, 0, 1.02 * hh);
    tg.addColorStop(0, rgba(fill, 0.92));
    tg.addColorStop(0.5, rgba(fill, 0.62));
    tg.addColorStop(1, rgba(fill, 0.94));
    g.fillStyle = tg;
    g.fill();
    g.strokeStyle = edgeCol;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.5;
    g.stroke();
    g.globalAlpha = 1;

    /* ridge line down each lobe */
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 1;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-0.10 * L, s * 0.36 * hh, -0.20 * L, s * 0.82 * hh);
      g.stroke();
    }
  }

  /* ---------------- the whale ---------------- */

  function paintWhale(g, f, sp, time) {
    const L = f.len, hh = f.h * 0.5;
    const q = time * 0.55 + f.phase;
    const amp = L * 0.020 * (1 + f.excite * 0.8);
    const bend = (xu) => {
      const back = Math.max(0, 0.5 - xu);
      return amp * Math.pow(back, 1.5) * Math.sin(q - back * 2.0);
    };
    const T = (p) => [p[0] * L, p[1] * hh + bend(p[0])];
    const bodyPx = sp.bodyPts.map(T);

    /* fluke, behind the body */
    g.save();
    g.translate(-0.44 * L, bend(-0.44));
    g.rotate(-Math.atan2(bend(-0.40) - bend(-0.52), 0.12 * L) + Math.sin(q - 0.9) * 0.10 * (1 + f.excite));
    flukeFin(g, sp.fluke, L, hh, sp.flukeFill, sp.flukeEdge);
    g.restore();

    /* small hooked dorsal fin, set on the hump */
    g.beginPath();
    g.moveTo(sp.dorsal.from * L, -0.90 * hh + bend(sp.dorsal.from));
    g.quadraticCurveTo((sp.dorsal.from - 0.06) * L, -1.38 * hh + bend(sp.dorsal.peak),
                       sp.dorsal.peak * L, -1.30 * hh + bend(sp.dorsal.peak));
    g.quadraticCurveTo((sp.dorsal.peak - 0.03) * L, -1.04 * hh + bend(sp.dorsal.peak),
                       sp.dorsal.to * L, -0.84 * hh + bend(sp.dorsal.to));
    g.closePath();
    g.fillStyle = sp.fin;
    g.fill();
    g.strokeStyle = sp.finEdge;
    g.globalAlpha = 0.6;
    g.lineWidth = 1.2;
    g.stroke();
    g.globalAlpha = 1;

    /* body with countershading */
    g.save();
    g.beginPath();
    smoothPath(g, bodyPx);
    const bg = g.createLinearGradient(0, -hh * 1.06, 0, hh * 1.06);
    bg.addColorStop(0, sp.back);
    bg.addColorStop(0.45, sp.mid);
    bg.addColorStop(1, sp.belly);
    g.fillStyle = bg;
    g.fill();

    g.save();
    g.clip();

    /* pale flank patches, the humpback mottle */
    g.fillStyle = 'rgba(255,255,255,0.20)';
    for (const pt of sp.flank || []) {
      g.beginPath();
      g.ellipse(pt[0] * L, pt[1] * hh + bend(pt[0]), pt[2] * L, pt[3] * hh, 0, 0, TAU);
      g.fill();
    }

    /* speckle on the belly */
    g.fillStyle = 'rgba(255,255,255,0.13)';
    for (const pt of sp.mottle || []) {
      g.beginPath();
      g.ellipse(pt[0] * L, pt[1] * hh + bend(pt[0]), pt[2] * L, pt[3] * hh, 0, 0, TAU);
      g.fill();
    }

    /* pale belly wash */
    const bg2 = g.createLinearGradient(0, hh * 0.05, 0, hh * 0.98);
    bg2.addColorStop(0, 'rgba(255,255,255,0)');
    bg2.addColorStop(1, 'rgba(255,255,255,0.26)');
    g.fillStyle = bg2;
    g.fill();

    /* throat pleats: short, low, well under the jaw so they cannot read as gills */
    g.strokeStyle = 'rgba(28,44,60,0.26)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const y = hh * (0.40 + i * 0.09);
      g.beginPath();
      g.moveTo(0.42 * L, y + bend(0.42));
      g.quadraticCurveTo(0.28 * L, y + hh * 0.06 + bend(0.28), 0.14 * L, y + hh * 0.02 + bend(0.14));
      g.stroke();
    }

    g.restore();   /* end body clip */

    g.strokeStyle = sp.edge;
    g.globalAlpha = 0.50;
    g.lineWidth = 1.5;
    g.beginPath();
    smoothPath(g, bodyPx);
    g.stroke();
    g.globalAlpha = 1;
    g.restore();   /* end body save */

    /* long pectoral flipper, pale underside, knobbled leading edge */
    const pec = sp.pec;
    g.save();
    g.translate(pec.at[0] * L, pec.at[1] * hh + bend(pec.at[0]));
    g.rotate(pec.rot + Math.sin(time * 0.6 + f.phase) * 0.08);
    const pl = pec.len * L;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-0.16 * pl, 0.30 * pl, -0.46 * pl, 0.62 * pl);
    g.quadraticCurveTo(-0.60 * pl, 0.78 * pl, -0.74 * pl, 0.88 * pl);
    g.quadraticCurveTo(-0.60 * pl, 0.70 * pl, -0.56 * pl, 0.50 * pl);
    g.quadraticCurveTo(-0.40 * pl, 0.20 * pl, -0.10 * pl, 0.02 * pl);
    g.closePath();
    const pg = g.createLinearGradient(0, 0, -0.6 * pl, 0.7 * pl);
    pg.addColorStop(0, rgba(sp.mid, 0.92));
    pg.addColorStop(1, rgba(sp.pecFill, 0.96));
    g.fillStyle = pg;
    g.fill();
    g.strokeStyle = sp.pecEdge;
    g.globalAlpha = 0.6;
    g.lineWidth = 1.2;
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 1; i <= 4; i++) {
      const u = i / 5;
      g.beginPath();
      g.arc(-0.34 * pl * u, 0.42 * pl * u, 1.6, 0, TAU);
      g.fill();
    }
    g.restore();

    /* blowhole, dark with a wet highlight */
    g.fillStyle = 'rgba(15,25,35,0.50)';
    g.beginPath();
    g.ellipse(sp.blow[0] * L, sp.blow[1] * hh + bend(sp.blow[0]), sp.blowSize[0], sp.blowSize[1], 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.ellipse(sp.blow[0] * L - 1.5, sp.blow[1] * hh + bend(sp.blow[0]) - 1.5, sp.blowSize[0] * 0.5, sp.blowSize[1] * 0.4, 0, 0, TAU);
    g.fill();

    /* eye */
    const ex = sp.eye[0] * L, ey = sp.eye[1] * hh + bend(sp.eye[0]), er = sp.eye[2] * hh;
    g.fillStyle = '#f2f7fb';
    g.beginPath(); g.arc(ex, ey, er * 1.15, 0, TAU); g.fill();
    g.fillStyle = '#132030';
    g.beginPath(); g.arc(ex + er * 0.10, ey, er * 0.72, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(ex - er * 0.35, ey - er * 0.35, er * 0.26, 0, TAU); g.fill();

    /* long gape line from the snout back under the jaw */
    g.strokeStyle = 'rgba(16,28,40,0.42)';
    g.lineWidth = 1.8;
    g.beginPath();
    const m0 = [0.10 * L, 0.52 * hh + bend(0.10)];
    const m1 = [0.50 * L, 0.10 * hh + bend(0.50)];
    g.moveTo(m0[0], m0[1]);
    g.quadraticCurveTo(0.40 * L, 0.40 * hh + bend(0.40), m1[0], m1[1]);
    g.stroke();
  }

  /* Breaching humpback, drawn to match the reference photo: body arced up out
     of the water, head down, wide spread fluke at the top, a long pale
     pectoral, spray. The pose is the whole point: a spread fluke cannot be
     mistaken for a fish tail, which is exactly what the side-on swimmer kept
     getting read as. f.breach runs 0 (settled) to 1 (fully out). */
  function paintWhaleBreach(g, f, sp, time) {
    const L = f.len;
    const u = Math.max(0, Math.min(1, f.breach || 0));
    const env = Math.sin(Math.PI * u);          /* 0 at the edges, 1 at the apex */

    /* spine, snout (lower right) up to the tail stock (upper left), with a
       half-thickness per point so the body comes out thick and chunky */
    const spine = [
      [ 0.43,  0.54], [ 0.32,  0.36], [ 0.20,  0.19], [ 0.06,  0.02],
      [-0.08, -0.14], [-0.20, -0.29], [-0.29, -0.43], [-0.34, -0.55]
    ];
    const thick = [0.090, 0.148, 0.166, 0.163, 0.145, 0.120, 0.092, 0.052];
    const N = spine.length;
    const P = spine.map(p => [p[0] * L, p[1] * L]);
    const top = [], bot = [], nrm = [];
    for (let i = 0; i < N; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      const nx = -ty, ny = tx;                 /* points to the dorsal (outer) side */
      nrm.push([nx, ny]);
      const t = thick[i] * L;
      top.push([P[i][0] + nx * t, P[i][1] + ny * t]);
      bot.push([P[i][0] - nx * t, P[i][1] - ny * t]);
    }
    const mid = Math.floor(N / 2);

    g.save();
    g.rotate(-0.14 + 0.05 * Math.sin(time * 0.7 + f.phase) - 0.10 * (1 - env));

    /* ---- fluke, behind the body ---- */
    const sX = P[N - 1][0], sY = P[N - 1][1];
    const backA = Math.atan2(sY - P[N - 2][1], sX - P[N - 2][0]);
    const flap = Math.sin(time * 1.05 + f.phase) * 0.06 * (0.5 + env);
    g.save();
    g.translate(sX, sY);
    g.rotate(backA - Math.PI + flap);
    const Lf = 0.82 * L, Hf = 0.48 * L;
    flukeFin(g, sp.fluke, Lf, Hf, sp.flukeFill, sp.flukeEdge);
    /* fluke detail, clipped to the fluke so nothing floats off it */
    const fpoly = [[0.04, 0], [-0.06, -0.34], [-0.16, -0.72], [-0.24, -1.02], [-0.16, -0.60],
                   [-0.13, -0.06], [-0.16, 0.60], [-0.24, 1.02], [-0.16, 0.72], [-0.06, 0.34]]
                  .map(p => [p[0] * Lf, p[1] * Hf]);
    g.save();
    g.beginPath(); smoothPath(g, fpoly); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(-0.15 * Lf, s * 0.72 * Hf, 0.09 * Lf, 0.30 * Hf, s * 0.35, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(226,221,206,0.6)';
    for (let i = 0; i < 6; i++) {
      const s = i < 3 ? -1 : 1;
      const u = 0.05 + (i % 3) * 0.06;
      g.beginPath(); g.arc(-u * Lf, s * (0.30 + (i % 3) * 0.16) * Hf, 1.3, 0, TAU); g.fill();
    }
    g.restore();
    g.restore();

    /* ---- body ---- */
    const body = top.concat(bot.slice().reverse());
    g.beginPath();
    smoothPath(g, body);
    const bg = g.createLinearGradient(top[mid][0], top[mid][1], bot[mid][0], bot[mid][1]);
    bg.addColorStop(0, sp.back);
    bg.addColorStop(0.44, sp.mid);
    bg.addColorStop(1, sp.belly);
    g.fillStyle = bg;
    g.fill();

    g.save();
    g.clip();

    /* pale throat and belly wash; humpbacks are white underneath */
    const wash = g.createLinearGradient(bot[mid][0], bot[mid][1], top[mid][0], top[mid][1]);
    wash.addColorStop(0, 'rgba(255,255,255,0.42)');
    wash.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    wash.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = wash;
    g.fill();

    /* skin noise. irregular specks, not fish scales, so it reads as hide */
    for (let i = 0; i < 52; i++) {
      const s = 0.06 + (i / 52) * 0.86;
      const pt = along(P, s);
      const j = Math.round(s * (N - 1));
      const t = thick[j] * L;
      const side = (((i * 37) % 11) / 11) * 2 - 1;
      const rr = 1.6 + ((i * 13) % 5) * 0.7;
      g.fillStyle = side > 0 ? 'rgba(40,62,86,0.15)' : 'rgba(255,255,255,0.10)';
      g.beginPath();
      g.ellipse(pt[0] + nrm[j][0] * t * side * 0.72, pt[1] + nrm[j][1] * t * side * 0.72,
                rr, rr * 0.7, 0, 0, TAU);
      g.fill();
    }

    /* pale pigment blotches, the humpback mottle */
    g.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 10; i++) {
      const s = 0.20 + (i / 10) * 0.68;
      const pt = along(P, s);
      const j = Math.round(s * (N - 1));
      const t = thick[j] * L;
      const side = (((i * 29) % 7) / 7) * 1.6 - 0.8;
      const rr = 4.0 + ((i * 17) % 6) * 1.2;
      g.beginPath();
      g.ellipse(pt[0] + nrm[j][0] * t * side, pt[1] + nrm[j][1] * t * side, rr, rr * 0.6, 0, 0, TAU);
      g.fill();
    }

    /* ventral throat pleats, the long grooves from chin to belly */
    g.strokeStyle = 'rgba(46,68,92,0.30)';
    g.lineWidth = 1.3;
    for (let i = 0; i < 9; i++) {
      const s0 = 0.05 + i * 0.085;
      const s1 = Math.min(0.92, s0 + 0.20);
      const a = along(P, s0);
      const b = along(bot, s0);
      const c = along(bot, s1);
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo(b[0], b[1], c[0], c[1]);
      g.stroke();
    }
    g.restore();

    /* wet sheen running along the back */
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.20)';
    g.lineWidth = 3.0;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const s = 0.08 + i * 0.10;
      const p = along(top, s);
      const j = Math.round(s * (N - 1));
      const q = [p[0] - nrm[j][0] * thick[j] * L * 0.30, p[1] - nrm[j][1] * thick[j] * L * 0.30];
      if (i === 0) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]);
    }
    g.stroke();
    g.restore();

    /* outline */
    g.strokeStyle = sp.edge;
    g.globalAlpha = 0.42;
    g.lineWidth = 1.5;
    g.beginPath();
    smoothPath(g, body);
    g.stroke();
    g.globalAlpha = 1;

    /* small hooked dorsal, set on the hump near the tail stock, attached
       along the back rail so it cannot read as a stray speck */
    {
      const a = along(top, 0.74), b = along(top, 0.90);
      const nn = nrm[6];
      const h = 0.105 * L;
      const ax = (a[0] + b[0]) / 2, ay = (a[1] + b[1]) / 2;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo(ax + nn[0] * h * 0.7, ay + nn[1] * h * 0.7,
                         ax + nn[0] * h * 0.9 + nn[1] * h * 0.5, ay + nn[1] * h * 0.9 - nn[0] * h * 0.5);
      g.quadraticCurveTo(b[0] + nn[0] * h * 0.5, b[1] + nn[1] * h * 0.5, b[0], b[1]);
      g.closePath();
      g.fillStyle = sp.fin;
      g.fill();
      g.strokeStyle = sp.finEdge; g.globalAlpha = 0.5; g.lineWidth = 1.1; g.stroke();
      g.globalAlpha = 1;
      /* light leading edge on the fin */
      g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 1.0;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo(ax + nn[0] * h * 0.7, ay + nn[1] * h * 0.7,
                         ax + nn[0] * h * 0.9 + nn[1] * h * 0.5, ay + nn[1] * h * 0.9 - nn[0] * h * 0.5);
      g.stroke();
    }

    /* long pale pectoral flipper, out toward the belly side */
    {
      const i = 2, p = P[i], n = nrm[i];
      const dir = Math.atan2(-n[1], -n[0]) + 0.6 + Math.sin(time * 0.8 + f.phase) * 0.10;
      g.save();
      g.translate(p[0] - n[0] * thick[i] * L * 0.3, p[1] - n[1] * thick[i] * L * 0.3);
      g.rotate(dir);
      const pl = 0.66 * L;
      const pecPath = () => {
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(0.16 * pl, -0.16 * pl, 0.48 * pl, -0.34 * pl);
        g.quadraticCurveTo(0.68 * pl, -0.46 * pl, 0.86 * pl, -0.48 * pl);
        g.quadraticCurveTo(0.72 * pl, -0.30 * pl, 0.62 * pl, -0.10 * pl);
        g.quadraticCurveTo(0.40 * pl, 0.02 * pl, 0.12 * pl, 0.04 * pl);
        g.closePath();
      };
      pecPath();
      const pg = g.createLinearGradient(0, 0, 0.8 * pl, -0.4 * pl);
      pg.addColorStop(0, rgba(sp.mid, 0.95));
      pg.addColorStop(1, rgba(sp.pecFill, 0.98));
      g.fillStyle = pg;
      g.fill();
      g.save();
      pecPath();
      g.clip();
      /* white blade with a faint dark top edge */
      g.fillStyle = 'rgba(255,255,255,0.24)';
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(0.30 * pl, 0.06 * pl, 0.70 * pl, 0.16 * pl);
      g.lineTo(0.70 * pl, -0.14 * pl);
      g.quadraticCurveTo(0.34 * pl, -0.18 * pl, 0, 0);
      g.fill();
      /* knobbly leading edge, the humpback pec tubercles */
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 1; k <= 7; k++) {
        const s = k / 8;
        g.beginPath(); g.arc(0.80 * pl * s, -0.44 * pl * s, 1.9, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.40)';
      for (let k = 1; k <= 4; k++) {
        const s = k / 5;
        g.beginPath(); g.arc(0.44 * pl * s, -0.20 * pl * s, 1.6, 0, TAU); g.fill();
      }
      g.restore();
      g.strokeStyle = sp.pecEdge; g.globalAlpha = 0.6; g.lineWidth = 1.2; pecPath(); g.stroke();
      g.globalAlpha = 1;
      g.restore();
    }

    /* head details: eye low on the head, blowhole and tubercles on top, gape line */
    {
      const he = along(P, 0.13);
      const en = nrm[1];
      const ex = he[0] - en[0] * thick[1] * L * 0.42;
      const ey = he[1] - en[1] * thick[1] * L * 0.42;
      g.fillStyle = '#f2f7fb';
      g.beginPath(); g.arc(ex, ey, 5.0, 0, TAU); g.fill();
      g.fillStyle = '#132030';
      g.beginPath(); g.arc(ex + 0.8, ey, 3.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(ex - 1.3, ey - 1.5, 1.3, 0, TAU); g.fill();

      /* blowhole on the top of the head, raised rim */
      const bpr = along(top, 0.10);
      const bpi = Math.round(0.10 * (N - 1));
      const bp = [bpr[0] - nrm[bpi][0] * thick[bpi] * L * 0.35,
                  bpr[1] - nrm[bpi][1] * thick[bpi] * L * 0.35];
      g.fillStyle = 'rgba(15,25,35,0.45)';
      g.beginPath(); g.ellipse(bp[0], bp[1], 3.2, 1.7, -0.6, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 0.9;
      g.beginPath(); g.ellipse(bp[0] - 0.6, bp[1] - 0.6, 3.2, 1.7, -0.6, 0, TAU); g.stroke();

      /* tubercles (the knobs on a humpback snout), tucked just inside the rail */
      g.fillStyle = 'rgba(30,50,70,0.22)';
      for (let i = 0; i < 6; i++) {
        const si = 0.03 + i * 0.028;
        const p = along(P, si);
        const j = Math.round(si * (N - 1));
        const kx = p[0] + nrm[j][0] * thick[j] * L * 0.55;
        const ky = p[1] + nrm[j][1] * thick[j] * L * 0.55;
        g.beginPath(); g.arc(kx, ky, 1.6, 0, TAU); g.fill();
      }

      const m0 = P[0], m1 = along(bot, 0.13);
      g.strokeStyle = 'rgba(16,28,40,0.42)';
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(m0[0], m0[1]);
      g.quadraticCurveTo((m0[0] + m1[0]) / 2 + 8, (m0[1] + m1[1]) / 2, m1[0], m1[1]);
      g.stroke();
    }

    g.restore();

    /* spray, only while it is out of the water */
    if (env > 0.02) {
      const base = along(P, 0.06);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + time * 0.5;
        const rad = (0.08 + 0.16 * (((i * 7) % 5) / 5)) * L * (0.5 + env * 0.8);
        const px = base[0] + Math.cos(a) * rad * 0.9;
        const py = base[1] + Math.sin(a) * rad * 0.55 - env * 0.14 * L;
        const r = (1.6 + ((i * 3) % 4)) * (0.5 + env);
        g.fillStyle = 'rgba(232,242,250,' + (0.15 * env).toFixed(3) + ')';
        g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
      }
    }
  }

  /* Top-down humpback: broad back, long pectorals, wide notched fluke.
     Seen from above, because the side-on view kept reading as a big fish. */
  function paintWhaleTop(g, f, sp, time) {
    const L = f.len, hh = f.h * 0.5;
    const q = time * 0.5 + f.phase;
    const amp = L * 0.030 * (1 + f.excite * 0.8);
    const sway = (xu) => {
      const back = Math.max(0, 0.5 - xu);
      return amp * Math.pow(back, 1.4) * Math.sin(q - back * 2.0);
    };
    const P = (x, y) => [x * L, y * hh + sway(x)];

    /* fluke, behind everything */
    const fluke = [
      [-0.44, 0.00], [-0.52, -0.30], [-0.58, -0.74], [-0.67, -1.12],
      [-0.53, -0.62], [-0.47, -0.16], [-0.44, -0.02],
      [-0.47, 0.16], [-0.53, 0.62], [-0.67, 1.12],
      [-0.58, 0.74], [-0.52, 0.30]
    ].map(p => P(p[0], p[1]));
    g.beginPath();
    smoothPath(g, fluke);
    const fgr = g.createLinearGradient(0, -1.12 * hh, 0, 1.12 * hh);
    fgr.addColorStop(0, rgba(sp.flukeEdge, 0.85));
    fgr.addColorStop(0.5, rgba(sp.flukeFill, 0.9));
    fgr.addColorStop(1, rgba(sp.flukeEdge, 0.85));
    g.fillStyle = fgr;
    g.fill();
    g.strokeStyle = sp.edge;
    g.globalAlpha = 0.45;
    g.lineWidth = 1.3;
    g.stroke();
    g.globalAlpha = 1;

    /* long pectoral flippers, one per side */
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(...P(0.22, s * 0.26));
      g.quadraticCurveTo(...P(0.06, s * 0.74), ...P(-0.12, s * 1.12));
      g.quadraticCurveTo(...P(-0.17, s * 1.24), ...P(-0.24, s * 1.16));
      g.quadraticCurveTo(...P(-0.12, s * 0.68), ...P(0.02, s * 0.26));
      g.closePath();
      const pg = g.createLinearGradient(0, 0, -0.18 * L, s * 1.1 * hh);
      pg.addColorStop(0, rgba(sp.mid, 0.9));
      pg.addColorStop(1, rgba(sp.pecFill, 0.95));
      g.fillStyle = pg;
      g.fill();
      g.strokeStyle = sp.pecEdge;
      g.globalAlpha = 0.5;
      g.lineWidth = 1.1;
      g.stroke();
      g.globalAlpha = 1;
    }

    /* body */
    const out = [
      [0.50, 0.00], [0.485, -0.12], [0.45, -0.24], [0.40, -0.34], [0.32, -0.42],
      [0.22, -0.47], [0.10, -0.50], [-0.02, -0.48], [-0.13, -0.41], [-0.23, -0.32],
      [-0.31, -0.24], [-0.39, -0.16], [-0.46, -0.08], [-0.50, -0.02],
      [-0.50, 0.02], [-0.46, 0.08], [-0.39, 0.16], [-0.31, 0.24], [-0.23, 0.32],
      [-0.13, 0.41], [-0.02, 0.48], [0.10, 0.50], [0.22, 0.47], [0.32, 0.42],
      [0.40, 0.34], [0.45, 0.24], [0.485, 0.12]
    ].map(p => P(p[0], p[1]));

    g.save();
    g.beginPath();
    smoothPath(g, out);
    const bg = g.createLinearGradient(0, -hh, 0, hh);
    bg.addColorStop(0, sp.back);
    bg.addColorStop(0.5, sp.mid);
    bg.addColorStop(1, sp.back);
    g.fillStyle = bg;
    g.fill();

    g.save();
    g.clip();

    /* pale sooty mottle along the flanks */
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (const pt of [[0.30, -0.20, 0.08, 0.16], [0.30, 0.20, 0.08, 0.16],
                      [0.02, -0.34, 0.14, 0.12], [0.02, 0.34, 0.14, 0.12],
                      [-0.20, -0.22, 0.10, 0.10], [-0.20, 0.22, 0.10, 0.10]]) {
      g.beginPath();
      g.ellipse(pt[0] * L, pt[1] * hh + sway(pt[0]), pt[2] * L, pt[3] * hh, 0, 0, TAU);
      g.fill();
    }

    /* rostral ridge down the head */
    g.strokeStyle = 'rgba(20,34,50,0.35)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0.47 * L, sway(0.47));
    g.quadraticCurveTo(0.36 * L, sway(0.36), 0.24 * L, sway(0.24));
    g.stroke();

    /* tubercles on the rostrum, a row per side */
    g.fillStyle = 'rgba(20,34,50,0.34)';
    for (let i = 0; i < 4; i++) {
      const x = 0.46 - i * 0.05;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(x * L, s * 0.14 * hh + sway(x), 1.6, 0, TAU);
        g.fill();
      }
    }

    /* blowhole pair */
    g.fillStyle = 'rgba(12,22,32,0.55)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(0.30 * L, s * 0.055 * hh + sway(0.30), 4.0, 2.0, 0.5, 0, TAU);
      g.fill();
    }

    /* pale splash guard behind the blowholes */
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath();
    g.ellipse(0.24 * L, sway(0.24), 0.07 * L, 0.10 * hh, 0, 0, TAU);
    g.fill();

    g.restore();   /* end clip */

    g.strokeStyle = sp.edge;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.5;
    g.beginPath();
    smoothPath(g, out);
    g.stroke();
    g.globalAlpha = 1;
    g.restore();   /* end body */

    /* eyes, one per side */
    for (const s of [-1, 1]) {
      const ex = 0.36 * L, ey = s * 0.40 * hh + sway(0.36), er = 0.045 * hh;
      g.fillStyle = '#eef4f9';
      g.beginPath(); g.arc(ex, ey, er * 1.2, 0, TAU); g.fill();
      g.fillStyle = '#132030';
      g.beginPath(); g.arc(ex, ey, er * 0.7, 0, TAU); g.fill();
    }
  }

  /* Whale seen from above: broad head, solid wide fluke, long pectorals, no fish fins. */
  function paintWhaleTop2(g, f, sp, time) {
    const L = f.len, hh = f.h * 0.5;
    const q = time * 0.5 + f.phase;
    const amp = L * 0.035 * (1 + f.excite * 0.8);
    const sway = (xu) => {
      const back = Math.max(0, 0.5 - xu);
      return amp * Math.pow(back, 1.4) * Math.sin(q - back * 2.0);
    };
    const P = (x, y) => [x * L, y * hh + sway(x)];

    /* fluke: one solid wide blade with a central notch */
    const fluke = [
      [-0.40, -0.08], [-0.50, -0.45], [-0.56, -0.80], [-0.60, -1.10],
      [-0.38, -0.60], [-0.26, -0.15], [-0.24, 0.00],
      [-0.26, 0.15], [-0.38, 0.60], [-0.60, 1.10],
      [-0.56, 0.80], [-0.50, 0.45], [-0.40, 0.08]
    ].map(p => P(p[0], p[1]));
    g.beginPath();
    smoothPath(g, fluke);
    g.fillStyle = sp.flukeFill;
    g.fill();
    g.strokeStyle = sp.edge;
    g.globalAlpha = 0.45;
    g.lineWidth = 1.3;
    g.stroke();
    g.globalAlpha = 1;

    /* pectoral flippers, one per side */
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(...P(0.18, s * 0.30));
      g.quadraticCurveTo(...P(0.02, s * 0.80), ...P(-0.16, s * 1.22));
      g.quadraticCurveTo(...P(-0.24, s * 1.34), ...P(-0.32, s * 1.24));
      g.quadraticCurveTo(...P(-0.16, s * 0.74), ...P(-0.02, s * 0.28));
      g.closePath();
      g.fillStyle = sp.pecFill;
      g.fill();
      g.strokeStyle = sp.pecEdge;
      g.globalAlpha = 0.5;
      g.lineWidth = 1.1;
      g.stroke();
      g.globalAlpha = 1;
    }

    /* body: broad rounded head, straight flanks, narrow tail stock */
    const out = [
      [0.50, 0.00], [0.46, -0.26], [0.38, -0.42], [0.26, -0.50], [0.10, -0.52],
      [-0.04, -0.48], [-0.14, -0.38], [-0.24, -0.28], [-0.34, -0.18], [-0.44, -0.09],
      [-0.50, -0.03], [-0.50, 0.03], [-0.44, 0.09], [-0.34, 0.18], [-0.24, 0.28],
      [-0.14, 0.38], [-0.04, 0.48], [0.10, 0.52], [0.26, 0.50], [0.38, 0.42], [0.46, 0.26]
    ].map(p => P(p[0], p[1]));

    g.beginPath();
    smoothPath(g, out);
    g.fillStyle = sp.mid;
    g.fill();

    g.save();
    g.clip();

    /* darker flanks, lighter centre ridge */
    const rg = g.createLinearGradient(0, -hh * 0.55, 0, hh * 0.55);
    rg.addColorStop(0, 'rgba(20,40,60,0.16)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    rg.addColorStop(1, 'rgba(20,40,60,0.16)');
    g.fillStyle = rg;
    g.fillRect(-L, -hh, 2 * L, 2 * hh);

    /* tubercles, one short row per side of the rostrum */
    g.fillStyle = 'rgba(24,44,64,0.35)';
    for (let i = 0; i < 4; i++) {
      const x = 0.44 - i * 0.05;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(x * L, s * 0.12 * hh + sway(x), 1.6, 0, TAU);
        g.fill();
      }
    }

    /* blowhole pair */
    g.fillStyle = 'rgba(12,24,36,0.6)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(0.30 * L, s * 0.055 * hh + sway(0.30), 4.0, 1.8, s * 0.5, 0, TAU);
      g.fill();
    }

    g.restore();

    g.strokeStyle = sp.edge;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.5;
    g.beginPath();
    smoothPath(g, out);
    g.stroke();
    g.globalAlpha = 1;

    /* eyes */
    for (const s of [-1, 1]) {
      const ex = 0.36 * L, ey = s * 0.38 * hh + sway(0.36), er = 0.045 * hh;
      g.fillStyle = 'rgba(12,24,36,0.75)';
      g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
    }
  }

  /* ---------------- the fish ---------------- */

  let SPRITE_DPR = 1;

  function spriteFor(f) {
    /* the breaching pose is tall, so whales get a roomier sprite */
    const pad = f.sp && f.sp.kind === 'whale' ? 2.7 : 1.9;
    const side = Math.ceil(f.len * pad * SPRITE_DPR / 2) * 2;
    let s = f._sprite;
    if (!s || s.width !== side) {
      s = document.createElement('canvas');
      s.width = s.height = side;
      f._sprite = s;
    }
    return s;
  }

  function paint(g, f, sp, time) {
    const G = geom(f, sp, time);
    const L = G.L, hh = G.hh, T = G.T;
    const bodyPx = sp.bodyPts.map(T);

    /* tail, behind everything */
    g.save();
    g.translate(-0.45 * L, G.bend(-0.45));
    g.rotate(G.tailAngle);
    caudalFin(g, sp.tail, L, hh, sp.tailFill || sp.fin, sp.tailEdge);
    g.restore();

    /* dorsal, anal, pelvic: bases hidden behind the body */
    const dorsBase = railBetween(sp.top, sp.dorsal.from, sp.dorsal.to).map(T);
    const dorsEdge = sp.dorsal.edge.map(T);
    ribbedFin(g, dorsBase, dorsEdge, sp.dorsal.rays, sp.fin, sp.edge, { rayAlpha: 0.24, rayW: 1 });

    const analBase = railBetween(sp.bot, sp.anal.from, sp.anal.to).map(T);
    ribbedFin(g, analBase, sp.anal.edge.map(T), sp.anal.rays, sp.fin, sp.edge, { rayAlpha: 0.22 });

    const pelvBase = railBetween(sp.bot, sp.pelvic.from, sp.pelvic.to).map(T);
    ribbedFin(g, pelvBase, sp.pelvic.edge.map(T), sp.pelvic.rays, sp.fin, sp.edge, { rayAlpha: 0.22 });

    /* body */
    g.save();
    g.beginPath();
    smoothPath(g, bodyPx);

    const bg = g.createLinearGradient(0, -hh * 1.05, 0, hh * 1.05);
    bg.addColorStop(0, sp.body[0]);
    bg.addColorStop(0.5, sp.body[1]);
    bg.addColorStop(1, sp.body[2]);
    g.fillStyle = bg;
    g.fill();

    g.save();
    g.clip();

    /* scale texture */
    g.globalAlpha = 0.5;
    g.fillStyle = scalePattern(g, sp.edge);
    g.fill();
    g.globalAlpha = 1;

    /* markings */
    /* bands bow around the body instead of running straight down it */
    const bowStroke = (x, w, col, bow) => {
      const bx = (x - 0.5) * L, by = G.bend(x);
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineCap = 'butt';
      g.beginPath();
      g.moveTo(bx, -hh * 1.3 + by);
      g.quadraticCurveTo(bx + (bow === undefined ? (sp.bow === undefined ? 0.06 : sp.bow) : bow) * L, by, bx, hh * 1.3 + by);
      g.stroke();
    };
    for (const b of sp.bars || []) {
      const bw = b.w * L;
      if (b.edge) bowStroke(b.x, bw + 2.6, b.edge, b.bow);
      bowStroke(b.x, bw, b.c, b.bow);
    }
    for (const m of sp.marks || []) {
      if (m.type === 'band') {
        bowStroke(m.x, m.w * L, m.c, m.bow);
      } else if (m.type === 'blob') {
        g.save();
        g.translate(m.x * L, m.y * hh + G.bend(m.x));
        g.rotate(m.rot || 0);
        g.fillStyle = m.c;
        g.beginPath();
        g.ellipse(0, 0, m.rx * L, m.ry * hh, 0, 0, TAU);
        g.fill();
        g.restore();
      } else if (m.type === 'stripe') {
        const y = m.y * hh, hgt = m.h * hh;
        const grd = g.createLinearGradient(0, y - hgt, 0, y + hgt);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(0.5, m.c);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = m.a;
        g.fillStyle = grd;
        g.fillRect(-L * 0.5, y - hgt, L, hgt * 2);
        g.globalAlpha = 1;
      }
    }

    /* eyespot on the tail of the butterflyfish */
    if (sp.spot) {
      g.fillStyle = '#20201d';
      g.beginPath();
      g.arc(-L * 0.34, -hh * 0.06 + G.bend(-0.34), hh * 0.20, 0, TAU);
      g.fill();
      g.fillStyle = '#f7f1de';
      g.beginPath();
      g.arc(-L * 0.34, -hh * 0.06 + G.bend(-0.34), hh * 0.10, 0, TAU);
      g.fill();
    }

    /* sheen along the upper flank */
    const sheen = [[.34, -.62], [.10, -.76], [-.18, -.62], [-.30, -.30], [-.02, -.34], [.26, -.34]].map(T);
    const sg = g.createLinearGradient(0, -hh * 0.95, 0, -hh * 0.1);
    sg.addColorStop(0, 'rgba(255,255,255,0.30)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.beginPath();
    smoothPath(g, sheen);
    g.fill();

    /* belly shading */
    const bg2 = g.createLinearGradient(0, hh * 0.15, 0, hh * 0.95);
    bg2.addColorStop(0, 'rgba(0,0,0,0)');
    bg2.addColorStop(1, 'rgba(0,0,0,0.20)');
    g.fillStyle = bg2;
    g.fill();

    /* gill cover */
    g.strokeStyle = 'rgba(0,0,0,0.30)';
    g.lineWidth = 1.3;
    g.beginPath();
    const gA = [0.32 * L, -0.60 * hh + G.bend(0.32)];
    const gB = [0.20 * L, -0.02 * hh + G.bend(0.20)];
    const gC = [0.30 * L, 0.50 * hh + G.bend(0.30)];
    g.moveTo(gA[0], gA[1]);
    g.quadraticCurveTo(gB[0], gB[1], gC[0], gC[1]);
    g.stroke();

    /* lateral line */
    g.strokeStyle = 'rgba(0,0,0,0.20)';
    g.lineWidth = 0.9;
    g.setLineDash([3, 4]);
    g.beginPath();
    const l0 = [0.26 * L, -0.22 * hh + G.bend(0.26)];
    const l1 = [-0.10 * L, 0.02 * hh + G.bend(-0.10)];
    const l2 = [-0.36 * L, -0.10 * hh + G.bend(-0.36)];
    g.moveTo(l0[0], l0[1]);
    g.quadraticCurveTo(l1[0], l1[1], l2[0], l2[1]);
    g.stroke();
    g.setLineDash([]);

    g.restore();   /* end body clip */

    /* outline for definition */
    g.strokeStyle = sp.edge;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.2;
    g.beginPath();
    smoothPath(g, bodyPx);
    g.stroke();
    g.globalAlpha = 1;

    /* pectoral fin over the flank */
    const pec = sp.pectoral;
    g.save();
    g.translate(pec.at[0] * L, pec.at[1] * hh + G.bend(pec.at[0]));
    g.rotate(Math.sin(time * f.tail * 1.3 + f.phase) * 0.22);
    fanFin(g, null, pec.a0, pec.a1, pec.r * L, pec.rays,
           pec.col || sp.fin, { alpha: pec.alpha === undefined ? 0.55 : pec.alpha, rayCol: sp.edge });
    g.restore();

    /* eye */
    const ex = sp.eye[0] * L, ey = sp.eye[1] * hh + G.bend(sp.eye[0]), er = sp.eye[2] * hh;
    g.fillStyle = '#fbf7ec';
    g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.arc(ex, ey, er * 0.82, 0, TAU); g.fill();
    g.fillStyle = '#171512';
    g.beginPath(); g.arc(ex + er * 0.16, ey, er * 0.55, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(ex - er * 0.28, ey - er * 0.30, er * 0.26, 0, TAU); g.fill();

    /* mouth */
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1.1;
    g.beginPath();
    const m0 = [0.44 * L, 0.02 * hh + G.bend(0.44)];
    const m1 = [0.50 * L, 0.10 * hh + G.bend(0.50)];
    g.moveTo(m0[0], m0[1]);
    g.quadraticCurveTo((m0[0] + m1[0]) / 2, m1[1] + 2, m1[0], m1[1]);
    g.stroke();

    g.restore();   /* end body save */
  }

  /* Draw one fish. f needs: x, y, angle, len, h, k, phase, tail, excite, sp. */
  function drawFish(ctx, f, time, alphaScale) {
    SPRITE_DPR = Math.min(root.devicePixelRatio || 1, 2);
    const s = spriteFor(f);
    const side = s.width / SPRITE_DPR;
    const g = s.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, s.width, s.height);
    g.setTransform(SPRITE_DPR, 0, 0, SPRITE_DPR, s.width / 2, s.height / 2);
    g.globalAlpha = 1;
    if (f.sp.kind === 'whale') {
      if (f.breach > 0.001) paintWhaleBreach(g, f, f.sp, time);
      else paintWhale(g, f, f.sp, time);
    } else paint(g, f, f.sp, time);

    const alpha = (0.19 + Math.min(0.17, f.k * 0.14)) * (alphaScale === undefined ? 1 : alphaScale);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle + (f.pitch || 0));
    if (Math.cos(f.angle) < 0) ctx.scale(1, -1);
    ctx.globalAlpha = alpha;
    ctx.drawImage(s, -side / 2, -side / 2, side, side);
    ctx.restore();
  }

  root.ReefArt = { SPECIES, drawFish };
})(window);
