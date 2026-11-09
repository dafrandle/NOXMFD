// The COUGAR layout's ADI page (cougar-adi.html): pages/adi/adi.js's instrument, with its readouts
// placed by CougarAvnLayout so the pane's shape picks the arrangement (tall: the stock one; wide:
// readouts in a column either side of the ball). The ball, bars and slip tube are drawn exactly as
// pages/adi draws them; only the readout positions and the viewBox follow the pane, re-applied on
// every resize (a split preset or a window change resizes this page's viewport).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('adi-svg');
  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  const CX = 445, CY = 440, R = 235;
  const K = 6;                     // px per degree of pitch
  // ponytail: 10 px per degree of sideslip, clamped to the tube; tune once flown in game.
  const SLIP_PX_PER_DEG = 10, SLIP_MAX_PX = 79;
  const BAR_HALF = 235, BAR_TOP = CY - BAR_HALF;   // both bars centre on the horizon line
  const AOA_MAX = 30;                    // the game's AoA indicator clamps at +/-30 degrees
  const D2R = Math.PI / 180;
  const polar = (r, a) => [CX + r * Math.sin(a * D2R), CY - r * Math.cos(a * D2R)];
  const barY = (v, max) => CY - Math.max(-max, Math.min(max, v)) / max * BAR_HALF;

  el('circle', { cx: CX, cy: CY, r: R }, el('clipPath', { id: 'adi-ball-clip' }, el('defs', {}, svg)));

  // ── attitude ball ─────────────────────────────────────────────────────────────────────────
  const ball = el('g', {}, el('g', { 'clip-path': 'url(#adi-ball-clip)' }, svg));
  el('rect', { x: -1000, y: CY - 3000, width: 3000, height: 3000, class: 'adi-sky' }, ball);
  el('rect', { x: -1000, y: CY, width: 3000, height: 3000, class: 'adi-ground' }, ball);
  el('line', { x1: -1000, y1: CY, x2: 2000, y2: CY, class: 'adi-horizon' }, ball);
  for (let p = -90; p <= 90; p += 5) {
    if (p === 0) continue;
    const y = CY - p * K, w = p % 10 === 0 ? 66 : 30;
    el('line', { x1: CX - w, y1: y, x2: CX + w, y2: y, class: 'adi-rung' }, ball);
    if (p % 10 === 0) for (const s of [-1, 1])
      el('text', { x: CX + s * 92, y: y + 8, class: 'adi-rung-label' }, ball, Math.abs(p));
  }
  el('circle', { cx: CX, cy: CY, r: R, class: 'adi-rim' }, svg);
  for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const big = a % 30 === 0;
    const [x1, y1] = polar(R + 4, a), [x2, y2] = polar(R + (big ? 28 : 16), a);
    el('line', { x1, y1, x2, y2, class: 'adi-bank', 'stroke-width': big ? 3.6 : 2.2 }, svg);
  }
  const skyPointer = el('path', { d: `M${CX} ${CY - R + 3} l-14 26 h28 z`, class: 'adi-pointer' }, svg);
  el('path', { d: `M${CX - 134} ${CY} h86 l22 22 M${CX + 134} ${CY} h-86 l-22 22`, class: 'adi-symbol' }, svg);
  el('rect', { x: CX - 7.5, y: CY - 7.5, width: 15, height: 15, class: 'adi-symbol-dot' }, svg);
  const SY = CY + R + 14;
  el('rect', { x: CX - 92, y: SY, width: 184, height: 32, rx: 16, class: 'adi-slip-tube' }, svg);
  for (const s of [-1, 1]) el('line', { x1: CX + s * 20, y1: SY, x2: CX + s * 20, y2: SY + 32, class: 'adi-slip-mark' }, svg);
  const slipBall = el('circle', { cx: CX, cy: SY + 16, r: 13, class: 'adi-slip-ball' }, svg);

  // ── side bars: AoA (left, labels outside) and VVI (right, labels outside) ──────────────────
  // Rebuilt only when the scale changes (the VVI's follows the unit setting).
  function bar(tubeX, labelsLeft, header) {
    el('text', { x: tubeX + 16, y: BAR_TOP - 16, class: 'adi-label mid' }, svg, header);
    el('rect', { x: tubeX, y: BAR_TOP, width: 32, height: 2 * BAR_HALF, class: 'adi-bar' }, svg);
    const scale = el('g', {}, svg);
    const unit = el('text', { x: tubeX + 16, y: BAR_TOP + 2 * BAR_HALF + 30, class: 'adi-unit mid' }, svg);
    // Pointer: a line across the tube and a triangle on the ball side, pointing at the scale.
    const pointer = el('g', {}, svg);
    el('line', { x1: tubeX - 4, y1: 0, x2: tubeX + 36, y2: 0, class: 'adi-bar-line' }, pointer);
    el('path', { d: labelsLeft ? `M${tubeX + 34} 0 l16 -11 v22 z` : `M${tubeX - 2} 0 l-16 -11 v22 z`, class: 'adi-pointer' }, pointer);
    let builtKey = null;
    return {
      scale(max, tick, every, unitText) {
        unit.textContent = unitText;
        const key = max + '/' + tick + '/' + every;
        if (key === builtKey) return;
        builtKey = key;
        scale.textContent = '';
        for (let v = -max; v <= max + 1e-9; v += tick) {
          const y = barY(v, max), major = Math.abs(v % every) < 1e-9;
          const len = v === 0 ? 32 : major ? 16 : 9;
          const x1 = labelsLeft ? tubeX : tubeX + 32 - len;
          el('line', { x1, y1: y, x2: x1 + len, y2: y, class: v === 0 ? 'adi-tick zero' : major ? 'adi-tick' : 'adi-tick-minor' }, scale);
          if (major) el('text', { x: labelsLeft ? tubeX - 8 : tubeX + 40, y: y + 7, class: 'adi-bar-label' + (labelsLeft ? ' end' : '') }, scale, Math.abs(v));
        }
      },
      move(v, max) {
        pointer.style.display = v == null ? 'none' : '';
        if (v != null) pointer.setAttribute('transform', `translate(0 ${barY(v, max)})`);
      },
    };
  }
  const aoaBar = bar(92, true, 'AOA');
  const vviBar = bar(766, false, 'VVI');
  aoaBar.scale(AOA_MAX, 5, 10, 'DEG');

  // ── readouts ───────────────────────────────────────────────────────────────────────────
  // Each one a caption over a value. Heading, speed, climb and altitude have no caption in the tall
  // arrangement, as on the stock page; the wide one names them, since they leave their stock places.
  function readout(key, caption) {
    return { key: key,
             label: el('text', { class: 'adi-label' }, svg, caption),
             value: el('text', { class: 'adi-value' }, svg, '—') };
  }
  const hdgR = readout('hdg', 'HDG'), tasR = readout('tas', 'SPD');
  const vsR = readout('vs', 'V/S'), altR = readout('alt', 'ALT');
  const mach = readout('mach', 'MACH'), g = readout('g', 'G');
  const aoa = readout('aoa', 'AOA'), ralt = readout('ralt', 'R-ALT');
  const hdg = hdgR.value, tas = tasR.value, vs = vsR.value, alt = altR.value;
  const gMax = el('text', { class: 'adi-label' }, svg, '');
  const READOUTS = [hdgR, tasR, vsR, altR, mach, g, aoa, ralt];

  const ANCHOR = { start: '', middle: ' mid', end: ' end' };
  function place(t, p, cls) {
    t.setAttribute('x', p.x);
    t.setAttribute('y', p.y);
    t.setAttribute('class', cls + ANCHOR[p.a]);
  }
  let laidOut = null;
  function applyLayout() {
    const l = CougarAvnLayout.layoutFor('adi', window.innerWidth, window.innerHeight);
    if (l.size === laidOut) return;
    laidOut = l.size;
    svg.setAttribute('viewBox', l.viewBox);
    READOUTS.forEach(function (r) {
      const p = l.pos[r.key];
      place(r.value, p.val, p.cls);
      r.label.style.display = p.cap ? '' : 'none';
      if (p.cap) place(r.label, p.cap, l.capCls);
    });
    place(gMax, l.pos.gmax, l.capCls);
  }

  // ── state ───────────────────────────────────────────────────────────────────────────────
  let units = AdiMath.units(false);
  let maxG = null;
  const target = { pitch: 0, roll: 0, slip: 0, aoa: null, vvi: null };
  const shown = { pitch: 0, roll: 0, slip: 0, aoa: null, vvi: null };
  let running = false, last = 0, first = true;

  function draw() {
    ball.setAttribute('transform', `rotate(${-shown.roll} ${CX} ${CY}) translate(0 ${shown.pitch * K})`);
    skyPointer.setAttribute('transform', `rotate(${-shown.roll} ${CX} ${CY})`);
    slipBall.setAttribute('cx', CX + Math.max(-SLIP_MAX_PX, Math.min(SLIP_MAX_PX, shown.slip * SLIP_PX_PER_DEG)));
    aoaBar.move(shown.aoa, AOA_MAX);
    vviBar.move(shown.vvi, units.vvi.max);
  }

  const near = (a, b) => (a == null || b == null ? a === b : Math.abs(a - b) < 0.01);
  function settled() {
    return near(shown.pitch, target.pitch) && Math.abs(AdiMath.angleDelta(shown.roll, target.roll)) < 0.01 &&
           near(shown.slip, target.slip) && near(shown.aoa, target.aoa) && near(shown.vvi, target.vvi);
  }
  const ease = (from, to, dt) => (to == null || from == null ? to : AdiMath.approach(from, to, dt));

  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    shown.pitch = AdiMath.approach(shown.pitch, target.pitch, dt);
    shown.roll = AdiMath.approachAngle(shown.roll, target.roll, dt);
    shown.slip = AdiMath.approach(shown.slip, target.slip, dt);
    shown.aoa = ease(shown.aoa, target.aoa, dt);
    shown.vvi = ease(shown.vvi, target.vvi, dt);
    draw();
    if (settled()) { running = false; return; }
    requestAnimationFrame(frame);
  }

  function kick() {
    if (first) { Object.assign(shown, target); first = false; draw(); return; }
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  const fixed = (v, n, suffix) => (v == null ? '—' : v.toFixed(n) + (suffix || ''));
  const withUnit = (v, unit) => (v == null ? '—' : Math.round(v) + ' ' + unit);

  function apply(m) {
    if (m.present !== true) {
      maxG = null;
      Object.assign(target, { pitch: 0, roll: 0, slip: 0, aoa: null, vvi: null });
      for (const t of [hdg, tas, vs, alt, mach.value, g.value, aoa.value, ralt.value]) t.textContent = '—';
      gMax.textContent = '';
      kick();
      return;
    }
    units = AdiMath.units(m.metric);
    vviBar.scale(units.vvi.max, units.vvi.tick, units.vvi.every, units.vvi.unit);
    target.pitch = m.pitch || 0;
    target.roll = m.roll || 0;
    target.slip = m.beta || 0;
    target.aoa = m.aoa;
    target.vvi = m.vs == null ? null : m.vs * units.vvi.k;
    if (m.g != null) maxG = maxG == null ? m.g : Math.max(maxG, m.g);

    hdg.textContent = m.hdg == null ? '—' : WptRoute.formatBearing(m.hdg);
    tas.textContent = withUnit(m.tas == null ? null : m.tas * units.spd.k, units.spd.unit);
    vs.textContent = m.vs == null ? '—'
      : AdiMath.signed(Math.round(m.vs * units.vs.k / units.vs.round) * units.vs.round) + ' ' + units.vs.unit;
    alt.textContent = withUnit(m.alt == null ? null : m.alt * units.alt.k, units.alt.unit);
    mach.value.textContent = fixed(m.mach, 2);
    g.value.textContent = fixed(m.g, 1);
    gMax.textContent = maxG == null ? '' : 'MAX ' + maxG.toFixed(1);
    aoa.value.textContent = fixed(m.aoa, 1, '°');
    ralt.label.textContent = 'R-ALT ' + units.alt.unit;
    ralt.value.textContent = m.agl == null ? '—' : String(Math.round(m.agl * units.alt.k));
    kick();
  }

  window.addEventListener('message', function (e) {
    const m = e.data;
    if (m && m.mfd === true && m.type === 'adi') apply(m);
  });

  window.addEventListener('resize', applyLayout);
  // A window resize can arrive mid-way through a split change, before the pane has its final size,
  // so the page's own box is watched as well.
  if (typeof ResizeObserver === 'function') new ResizeObserver(function () { applyLayout(); }).observe(document.documentElement);
  applyLayout();
  vviBar.scale(units.vvi.max, units.vvi.tick, units.vvi.every, units.vvi.unit);
  draw();
})();
