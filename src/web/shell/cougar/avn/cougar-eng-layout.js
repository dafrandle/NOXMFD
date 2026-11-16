// Layout rules for the COUGAR layout's ENG and FUEL pages (cougar-eng.js). Pure: no DOM, so
// cougar-eng-layout.test.js pins them in Node.
//
// ── ENG: an engine card's dials (dialArrangement) ──
// A card's two dials (RPM and THR/PWR) share the box under its name and HP bar, w x h. Three ways to
// place them, each dial a circle of diameter:
//   row       side by side             min(w/2, h)
//   column    one above the other      min(w, h/2)
//   diagonal  in opposite corners      (w + h) - sqrt(2wh), capped at min(w, h): the size at which
//             the two circles, each touching its corner's two sides, just touch each other
// The card takes whichever draws the dials largest, from the box it actually has, whatever the pane or
// the number of engines. Diagonal beats both only in a box near square (up to ~17% in a square one;
// nothing from 2:1 on), and wins only by at least DIAGONAL_GAIN px, so a card isn't set askew for a
// pixel. When even the best is under DIAL_MIN px, a dial is too small to read and the card shows each
// as a line instead: label, bar, value ('bars').
//
// ── ENG: where the cards and the throttle/heat line go (engineGrid) ──
// avn.js puts the first `left` cards left of centre and the rest right, `cols` abreast a side
// (AvnEngPolicy.pedestalSplit / sideColumns). With one or two cards the throttle/heat line runs under
// them. With more, the cards make rows, and the line runs across the middle of them: after the first
// half of the rows (rounded up), so the cards keep their sides and their order, and a side with fewer
// cards leaves its last cells empty rather than straddling the line. Rows and columns are 1-based
// grid lines; the line's own row is `lineRow`.
//
// ── FUEL: the fuel band (fuelArrangement) ──
// The band holds the fuel dial, a bar per tank and the burn / endurance / range readouts, in a box
// w x h. Two ways to lay it out:
//   row      all three side by side, as pages/avn: the dial gets 30% of the inner width (avn.css), so
//            min(0.3 * (w - 2P), h - 2P)
//   stacked  two sections: the dial and the readouts side by side on top, the tank bars across the
//            whole width below; the top takes half the height, so the dial is
//            min(w - readsW - G - 2P, (h - G) / 2 - 2P)
// with P a section's padding, G the gap between the sections and readsW the readouts' own width (they
// never shrink). The band takes whichever draws the dial larger; stacked only by at least STACK_GAIN
// px, since it also halves the tank bars.
(function (root) {
  const DIAL_MIN = 60;
  const DIAGONAL_GAIN = 2;

  function diagonalDial(w, h) {
    return Math.max(0, Math.min(w, h, (w + h) - Math.sqrt(2 * w * h)));
  }

  function dialArrangement(w, h, min) {
    const floor = typeof min === 'number' ? min : DIAL_MIN;
    const row = Math.min(w / 2, h);
    const column = Math.min(w, h / 2);
    const diagonal = diagonalDial(w, h);
    let best = row >= column ? { arrangement: 'row', dial: row } : { arrangement: 'column', dial: column };
    if (diagonal >= best.dial + DIAGONAL_GAIN) best = { arrangement: 'diagonal', dial: diagonal };
    if (!(best.dial >= floor)) return { arrangement: 'bars', dial: best.dial };
    return best;
  }

  function engineGrid(left, right, cols) {
    const c = Math.max(1, cols | 0);
    const rows = Math.max(Math.ceil(left / c), Math.ceil(right / c), 1);
    const above = Math.ceil(rows / 2);
    const place = function (i, first) {
      const r = Math.floor(i / c);
      return { col: first + (i % c), row: r < above ? r + 1 : r + 2 };
    };
    const cells = [];
    for (let i = 0; i < left; i++) cells.push(place(i, 1));
    for (let j = 0; j < right; j++) cells.push(place(j, 1 + c));
    return { columns: 2 * c, rows: rows + 1, above: above, below: rows - above, lineRow: above + 1, cells: cells };
  }

  const FUEL_PAD = 6, FUEL_GAP = 4, STACK_GAIN = 2;
  function fuelArrangement(w, h, readsW) {
    const row = Math.max(0, Math.min(0.3 * (w - 2 * FUEL_PAD), h - 2 * FUEL_PAD));
    const stacked = Math.max(0, Math.min(w - readsW - FUEL_GAP - 2 * FUEL_PAD, (h - FUEL_GAP) / 2 - 2 * FUEL_PAD));
    return stacked >= row + STACK_GAIN ? { arrangement: 'stacked', dial: stacked } : { arrangement: 'row', dial: row };
  }

  const api = { DIAL_MIN: DIAL_MIN, DIAGONAL_GAIN: DIAGONAL_GAIN, diagonalDial: diagonalDial, dialArrangement: dialArrangement,
                engineGrid: engineGrid, FUEL_PAD: FUEL_PAD, FUEL_GAP: FUEL_GAP, STACK_GAIN: STACK_GAIN, fuelArrangement: fuelArrangement };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarEngLayout = api;
})(typeof self !== 'undefined' ? self : this);
