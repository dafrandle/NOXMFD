// The COUGAR layout's ENG and FUEL pages (cougar-eng.html): pages/avn/avn.js unchanged, with one of
// its functions wrapped.
//
// `?fuel` makes the page FUEL: cougar-eng.css then shows the fuel band and hides the engine row, and
// without it the page is ENG, the other way round.
//
// avn.js is a classic script, so its functions are globals every stock caller finds by name:
//   paintAvnGauge        the stock paint, then the value it drew as --v on the gauge, which the bar a
//                        small engine card shows in place of its dials (cougar-eng.css) fills to.
//   buildAvnEngineCards  the stock build, then each card's status chip and HP readout moved into one
//                        pill in its header (.cougar-pill, cougar-eng.css), and each card watched for
//                        its size (below). avn.js keeps writing both by their own references.
// The throttle and heat bars need nothing here: avn.js already sets --thr, --ab and --heat for its
// own lever and tape.
//
// Per card, from the space its dials have (CougarEngLayout.dialArrangement): side by side, stacked or
// in opposite corners, whichever draws them largest, or as bars when even that is too small; one
// class on the card, .dials-row / .dials-column / .dials-diagonal / .bars (cougar-eng.css), and for
// diagonal the dial size as --dial on the dials box. That box keeps its size whichever is set (flex:
// 1 1 0 in the card body, diagonal dials positioned inside it), so nothing feeds back into its own
// measurement.
//
// Telemetry can arrive while this page is still loading: avn.js is ready and listening before the
// browser has fetched this file, so the stock code can already have built the engine cards (unwrapped)
// by the time this runs, and it won't build them again while the engines stay the same. So the end of
// this file decorates any cards already built and repaints once; decorating is idempotent.
(function () {
  if (/[?&]fuel\b/.test(location.search)) document.documentElement.classList.add('cougar-fuel');

  const stockPaintGauge = paintAvnGauge;
  paintAvnGauge = function (gaugeEl, value01) {
    stockPaintGauge.apply(this, arguments);
    const v = typeof value01 === 'number' && value01 >= 0 ? Math.min(1, value01) : 0;
    gaugeEl.style.setProperty('--v', String(v));
  };

  const ARRANGEMENTS = { row: 'dials-row', column: 'dials-column', diagonal: 'dials-diagonal', bars: 'bars' };
  function fitCard(card) {
    const dials = card && card.querySelector('.avn-engine-dials');
    if (!dials || !dials.clientWidth || !dials.clientHeight) return;
    const r = CougarEngLayout.dialArrangement(dials.clientWidth, dials.clientHeight);
    Object.keys(ARRANGEMENTS).forEach(function (k) { card.classList.toggle(ARRANGEMENTS[k], k === r.arrangement); });
    dials.style.setProperty('--dial', Math.floor(r.dial) + 'px');
  }
  const watcher = new ResizeObserver(function (entries) {
    entries.forEach(function (e) { fitCard(e.target.closest('.avn-engine')); });
  });
  // More than two cards: the throttle/heat line goes across the middle of them
  // (CougarEngLayout.engineGrid). The two side columns stop being boxes of their own
  // (.ped-middle, cougar-eng.css) so their cards and the line share one grid on .avn-top.
  const engTop = document.getElementById('avn-top');
  const engPedestal = document.getElementById('avn-pedestal');
  function placeCards() {
    const sides = [avnSideL, avnSideR];
    const cards = sides.map(function (s) { return Array.prototype.slice.call(s.children); });
    const middle = cards[0].length + cards[1].length > 2;
    engTop.classList.toggle('ped-middle', middle);
    if (!middle) {
      engTop.style.gridTemplateColumns = engTop.style.gridTemplateRows = '';
      engPedestal.style.gridRow = '';
      cards[0].concat(cards[1]).forEach(function (el) { el.style.gridArea = ''; });
      return;
    }
    const cols = parseInt(avnSideL.style.getPropertyValue('--cols'), 10) || 1;
    const g = CougarEngLayout.engineGrid(cards[0].length, cards[1].length, cols);
    const band = function (n) { return n > 0 ? 'repeat(' + n + ', minmax(0, 1fr))' : ''; };
    engTop.style.gridTemplateColumns = band(g.columns);
    engTop.style.gridTemplateRows = [band(g.above), 'auto', band(g.below)].join(' ').trim();
    engPedestal.style.gridRow = String(g.lineRow);
    cards[0].concat(cards[1]).forEach(function (el, i) { el.style.gridArea = g.cells[i].row + ' / ' + g.cells[i].col; });
  }

  function decorateCards() {
    placeCards();
    avnEngineCards.forEach(function (c) {
      if (c.el.querySelector('.cougar-pill')) return;
      const pill = document.createElement('span');
      pill.className = 'cougar-pill';
      pill.appendChild(c.chip);
      pill.appendChild(c.hpVal);
      c.el.querySelector('.avn-engine-head').appendChild(pill);
      watcher.observe(c.el.querySelector('.avn-engine-body'));   // observing twice is a no-op
    });
  }
  // FUEL: the fuel band in a row or in two sections (CougarEngLayout.fuelArrangement), from its own
  // box and the readouts' width; .fuel-stacked (cougar-eng.css). The band's box is the same either
  // way (it fills the pane), so the class can't feed back into its own measurement.
  const fuelBand = document.querySelector('.avn-fuel');
  const fuelReads = document.querySelector('.avn-reads');
  function fitFuel() {
    if (!fuelBand.clientWidth || !fuelBand.clientHeight) return;
    const r = CougarEngLayout.fuelArrangement(fuelBand.clientWidth, fuelBand.clientHeight, fuelReads.getBoundingClientRect().width);
    fuelBand.classList.toggle('fuel-stacked', r.arrangement === 'stacked');
  }
  new ResizeObserver(fitFuel).observe(fuelBand);
  new ResizeObserver(fitFuel).observe(fuelReads);   // the readouts widen as their numbers grow

  const stockBuildCards = buildAvnEngineCards;
  buildAvnEngineCards = function () {
    stockBuildCards.apply(this, arguments);
    decorateCards();
  };

  // ── Marker colours ─────────────────────────────────────────────────────────────────
  // paintAvnPedestal: the stock paint, then the colour (CougarEngContrast.bestMarker) of each fixed
  // mark the fills move past, against the bar under it. The MIL detent straddles a fixed boundary,
  // so it has to stand out on both sides of it. Each heat tick is judged on its own against the bar
  // at that tick, so the fill turns each one as it passes it; a tick's place on the bar is read from
  // where it is drawn (upright or across). The leading edges that move with a fill (the throttle
  // handle, the heat pointer) keep one colour (cougar-eng.css).
  // What the bar shows at a point is rebuilt from the same layers cougar-eng.css paints:
  //   throttle  track (--no-ink), the above-MIL zone (--cougar-ab-zone) past the MIL boundary, and
  //             the fill (--cougar-thr-fill) below the throttle value
  //   heat      the panel, the scale (green -> yellow -> red at .avn-heat-scale's opacity), and the
  //             lit fill (its own colour, the game's heat colour, at .avn-heat-lit's opacity) below
  //             the heat value
  // Colours are read from the page's own tokens, resolved to rgba through a 1x1 canvas, so they
  // follow the theme.
  const X = CougarEngContrast;
  const SIDE = 0.01;   // how far from a marker the bar is sampled (fraction of its length)
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const pixel = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const parsed = new Map();
  function rgba(cssColor) {
    let c = parsed.get(cssColor);
    if (c) return c;
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = 'transparent';   // a value fillStyle rejects then reads as nothing, not the last colour
    pixel.fillStyle = cssColor;
    pixel.fillRect(0, 0, 1, 1);
    const d = pixel.getImageData(0, 0, 1, 1).data;
    c = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    if (parsed.size > 64) parsed.clear();
    parsed.set(cssColor, c);
    return c;
  }
  function token(value) {
    probe.style.color = '';
    probe.style.color = value;
    return rgba(getComputedStyle(probe).color);
  }
  function cssNumber(el, name, fallback) {
    const v = parseFloat(el.style.getPropertyValue(name));
    return isFinite(v) ? v : fallback;
  }
  function sides(at) {
    return [at - SIDE, at + SIDE].filter(function (x) { return x >= 0 && x <= 1; });
  }

  const heatScaleEl = document.querySelector('.avn-heat-scale');
  const heatTicks = Array.prototype.slice.call(document.querySelectorAll('.avn-heat-tick'));
  function paintMarkers() {
    const ink = token('var(--no-ink)'), panel = token('var(--no-bg)');
    const thrFill = token('var(--cougar-thr-fill)'), abZone = token('var(--cougar-ab-zone)');
    const thr = 1 - cssNumber(avnLever, '--thr', 1);
    const boundary = avnLever.classList.contains('has-ab') ? 1 - cssNumber(avnLever, '--ab', 0) : null;
    function throttleAt(x) {
      return X.composite([ink, boundary !== null && x > boundary ? abZone : null, x < thr ? thrFill : null]);
    }
    if (boundary !== null) avnLever.style.setProperty('--cougar-detent', X.css(X.bestMarker(sides(boundary).map(throttleAt))));

    const heat = cssNumber(avnHeatTape, '--heat', 0);
    const scaleAlpha = parseFloat(getComputedStyle(heatScaleEl).opacity) || 0;
    const stops = [token('var(--no-green)'), token('var(--no-hsd-yellow)'), token('var(--no-red)')];
    const litStyle = getComputedStyle(avnHeatLit);
    const lit = X.withAlpha(rgba(litStyle.backgroundColor), parseFloat(litStyle.opacity) || 0);
    function heatAt(x) {
      return X.composite([panel, X.withAlpha(X.along(stops, x), scaleAlpha), x < heat ? lit : null]);
    }

    const tape = avnHeatTape.getBoundingClientRect();
    if (!tape.width || !tape.height) return;
    const across = tape.width > tape.height;
    heatTicks.forEach(function (tick) {
      const r = tick.getBoundingClientRect();
      const at = across ? (r.left + r.width / 2 - tape.left) / tape.width
                        : 1 - (r.top + r.height / 2 - tape.top) / tape.height;
      tick.style.setProperty('--cougar-tick', X.css(X.bestMarker([heatAt(at)])));
    });
  }
  const stockPaintPedestal = paintAvnPedestal;
  paintAvnPedestal = function () {
    stockPaintPedestal.apply(this, arguments);
    paintMarkers();
  };

  // Cards (and paint) from telemetry that arrived before this file ran (see the top).
  decorateCards();
  if (avnData.name) paintAvn();
})();
