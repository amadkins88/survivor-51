/* Reef art — pure fish drawing, no state, no timers.
   Used by fish.js on the site, and by the species sheet for visual review. */
(function (root) {
  const SPECIES = [
    { id: 'idol', name: 'Moorish idol', len: 82, h: 36, body: ['#f7efdd', '#eee2cb', '#fbf7ec'],
      fin: '#e59a2b', tail: '#e2652a', dorsal: 21,
      bars: [{ x: .18, w: .10, c: '#171512' }, { x: .52, w: .14, c: '#e2652a' }, { x: .80, w: .09, c: '#171512' }] },
    { id: 'clown', name: 'Clownfish', len: 54, h: 27, body: ['#f0722a', '#e5623a', '#f79a45'],
      fin: '#f3a95c', tail: '#f0722a', dorsal: 11,
      bars: [{ x: .18, w: .09, c: '#fbf7ec', edge: '#171512' },
             { x: .52, w: .08, c: '#fbf7ec', edge: '#171512' },
             { x: .83, w: .07, c: '#fbf7ec', edge: '#171512' }] },
    { id: 'tang', name: 'Yellow tang', len: 64, h: 35, body: ['#f0c02c', '#e8b430', '#f7dd86'],
      fin: '#2e8b8b', tail: '#e8b430', dorsal: 17, bars: [] },
    { id: 'bluetang', name: 'Blue tang', len: 66, h: 33, body: ['#2f6fd0', '#2456a8', '#4b8ada'],
      fin: '#2456a8', tail: '#f0c02c', dorsal: 13,
      bars: [{ x: .62, w: .22, c: '#132a52' }, { x: .88, w: .06, c: '#f0c02c' }] },
    { id: 'sergeant', name: 'Sergeant major', len: 58, h: 27, body: ['#e9e6d8', '#dcd7c4', '#f4f1e6'],
      fin: '#c9c2ab', tail: '#e0dccb', dorsal: 11,
      bars: [{ x: .14, w: .055, c: '#20201d' }, { x: .32, w: .055, c: '#20201d' },
             { x: .50, w: .055, c: '#20201d' }, { x: .68, w: .055, c: '#20201d' },
             { x: .86, w: .055, c: '#20201d' }] },
    { id: 'emperor', name: 'Emperor angelfish', len: 68, h: 36, body: ['#3b4f9e', '#30408a', '#6a7dc0'],
      fin: '#2b3a7d', tail: '#e8b430', dorsal: 16,
      bars: [{ x: .30, w: .15, c: '#e8b430' }, { x: .56, w: .13, c: '#20201d' }, { x: .82, w: .10, c: '#e8b430' }] },
    { id: 'butterfly', name: 'Copperband butterflyfish', len: 56, h: 34, body: ['#f7f1de', '#f1e8d2', '#fcf8ee'],
      fin: '#f0c02c', tail: '#f7f1de', dorsal: 13,
      bars: [{ x: .24, w: .065, c: '#e5623a' }, { x: .42, w: .065, c: '#e5623a' },
             { x: .60, w: .065, c: '#e5623a' }, { x: .78, w: .065, c: '#e5623a' }], spot: true },
    { id: 'anthias', name: 'Sea goldie', len: 42, h: 23, body: ['#e0637f', '#d24f6e', '#f0899f'],
      fin: '#f0899f', tail: '#e0637f', dorsal: 10, bars: [] }
  ];

  /* Draw one fish. f needs: x, y, angle, len, h, k, phase, tail, excite, sp (species). */
  function drawFish(ctx, f, time, alphaScale) {
    const sp = f.sp, L = f.len, Hh = f.h;
    const alpha = (0.55 + Math.min(0.42, f.k * 0.40)) * (alphaScale === undefined ? 1 : alphaScale);

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    if (Math.cos(f.angle) < 0) ctx.scale(1, -1);
    ctx.globalAlpha = alpha;

    const wag = Math.sin(time * f.tail + f.phase) * (0.18 + f.excite * 0.5);
    const breatheFin = Math.sin(time * f.tail * 0.9 + f.phase + 1.1) * 0.10;

    // caudal fin
    ctx.save();
    ctx.translate(-L * 0.45, 0);
    ctx.rotate(wag);
    ctx.fillStyle = sp.tail;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-L * 0.17, -Hh * 0.60, -L * 0.35, -Hh * 0.78);
    ctx.quadraticCurveTo(-L * 0.25, 0, -L * 0.35, Hh * 0.78);
    ctx.quadraticCurveTo(-L * 0.17, Hh * 0.60, 0, 0);
    ctx.fill();
    ctx.restore();

    // dorsal fin
    ctx.save();
    ctx.rotate(breatheFin * 0.6);
    ctx.fillStyle = sp.fin;
    ctx.globalAlpha = alpha * 0.92;
    ctx.beginPath();
    ctx.moveTo(L * 0.26, -Hh * 0.30);
    ctx.quadraticCurveTo(L * 0.02, -Hh * 0.26 - sp.dorsal * f.k, -L * 0.30, -Hh * 0.33);
    ctx.quadraticCurveTo(-L * 0.04, -Hh * 0.16, L * 0.26, -Hh * 0.30);
    ctx.fill();
    ctx.restore();

    // body
    const g = ctx.createLinearGradient(0, -Hh * 0.6, 0, Hh * 0.6);
    g.addColorStop(0, sp.body[0]);
    g.addColorStop(0.58, sp.body[1]);
    g.addColorStop(1, sp.body[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.5, Hh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // bands / bars, clipped to the body
    if (sp.bars.length) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.5, Hh * 0.5, 0, 0, Math.PI * 2);
      ctx.clip();
      for (const b of sp.bars) {
        const bx = (b.x - 0.5) * L, bw = b.w * L;
        if (b.edge) {
          ctx.fillStyle = b.edge;
          ctx.fillRect(bx - bw / 2 - 1.6, -Hh * 0.55, bw + 3.2, Hh * 1.1);
        }
        ctx.fillStyle = b.c;
        ctx.fillRect(bx - bw / 2, -Hh * 0.55, bw, Hh * 1.1);
      }
      ctx.restore();
    }

    // false eyespot (butterflyfish)
    if (sp.spot) {
      ctx.fillStyle = '#20201d';
      ctx.beginPath(); ctx.arc(-L * 0.36, -Hh * 0.05, Hh * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f7f1de';
      ctx.beginPath(); ctx.arc(-L * 0.36, -Hh * 0.05, Hh * 0.10, 0, Math.PI * 2); ctx.fill();
    }

    // pectoral fin
    ctx.save();
    ctx.translate(L * 0.10, Hh * 0.10);
    ctx.rotate(0.5 + Math.sin(time * f.tail * 1.3 + f.phase) * 0.22);
    ctx.fillStyle = sp.fin;
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-L * 0.05, Hh * 0.28, -L * 0.19, Hh * 0.29);
    ctx.quadraticCurveTo(-L * 0.09, Hh * 0.09, 0, 0);
    ctx.fill();
    ctx.restore();

    // eye
    ctx.fillStyle = '#fbf7ec';
    ctx.beginPath(); ctx.arc(L * 0.33, -Hh * 0.12, Hh * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#171512';
    ctx.beginPath(); ctx.arc(L * 0.345, -Hh * 0.12, Hh * 0.065, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  root.ReefArt = { SPECIES, drawFish };
})(window);
