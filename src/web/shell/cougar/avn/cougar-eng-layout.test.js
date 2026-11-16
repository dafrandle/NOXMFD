// Self-check for the Cougar ENG card layout rule (cougar-eng-layout.js). Run: `node cougar-eng-layout.test.js`.
const assert = require('assert');
const L = require('./cougar-eng-layout.js');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} != ${b}`);

// A long box sets the dials side by side, a tall one stacks them (diagonal gains nothing from 2:1 on).
assert.strictEqual(L.dialArrangement(400, 200).arrangement, 'row');
assert.strictEqual(L.dialArrangement(200, 400).arrangement, 'column');
assert.strictEqual(L.dialArrangement(400, 200).dial, 200);
assert.strictEqual(L.dialArrangement(200, 400).dial, 200);
assert.strictEqual(L.dialArrangement(600, 200).arrangement, 'row');

// A square box puts them in opposite corners: 2 - sqrt(2) of the side, ~17% over side by side.
const sq = L.dialArrangement(200, 200);
assert.strictEqual(sq.arrangement, 'diagonal');
near(sq.dial, 400 - Math.sqrt(2 * 200 * 200), 'square diagonal');
// The two circles, each against its corner's two sides, just touch: centre distance == diameter.
for (const [w, h] of [[200, 200], [209, 296], [475, 441], [110, 117]]) {
  const d = L.diagonalDial(w, h);
  if (d < Math.min(w, h)) near(Math.hypot(w - d, h - d), d, `${w}x${h} circles touch`);
}

// Diagonal must win by DIAGONAL_GAIN px; a smaller gain keeps the tidy row/column.
assert.strictEqual(L.dialArrangement(209, 122).arrangement, 'row');      // diagonal only ~0.7px larger
assert.strictEqual(L.dialArrangement(231, 441).arrangement, 'column');   // ~0.4px larger

// Whichever is picked draws at least as large as each other way, over a spread of box shapes.
for (const [w, h] of [[480, 470], [220, 460], [200, 290], [96, 120], [160, 60], [470, 120], [90, 300], [300, 90], [233, 194], [110, 117]]) {
  const r = L.dialArrangement(w, h);
  const ways = [Math.min(w / 2, h), Math.min(w, h / 2), L.diagonalDial(w, h)];
  assert.ok(r.dial >= Math.max(...ways) - L.DIAGONAL_GAIN, `${w}x${h}`);
  assert.ok(r.dial >= Math.max(ways[0], ways[1]), `${w}x${h}`);
}

// Under DIAL_MIN every way: bars. At exactly DIAL_MIN: still dials.
assert.strictEqual(L.dialArrangement(99, 81).arrangement, 'bars');            // best is diagonal ~53
assert.strictEqual(L.dialArrangement(110, 117).arrangement, 'diagonal');      // diagonal ~67 rescues it from bars
assert.strictEqual(L.dialArrangement(120, 60).arrangement, 'row');            // 60 side by side
assert.strictEqual(L.dialArrangement(60, 120).arrangement, 'column');         // 60 stacked
assert.strictEqual(L.dialArrangement(118, 59).arrangement, 'bars');
assert.strictEqual(L.dialArrangement(100, 100, 40).arrangement, 'diagonal');  // floor is a parameter

// No box yet (0 or missing size): bars, never NaN dials.
assert.strictEqual(L.dialArrangement(0, 0).arrangement, 'bars');
assert.strictEqual(L.dialArrangement(NaN, 100).arrangement, 'bars');

// ── ENG grid: the throttle/heat line across the middle of the cards ──
const cellsOf = (g) => g.cells.map(c => c.col + ':' + c.row).join(' ');
// Ibis-like: 4 cards, 2 a side, one abreast -> ENG1/ENG3 on top, the line, ENG2/ENG4 below.
const ibis = L.engineGrid(2, 2, 1);
assert.deepStrictEqual([ibis.columns, ibis.rows, ibis.lineRow], [2, 3, 2]);
assert.strictEqual(cellsOf(ibis), '1:1 1:3 2:1 2:3');
// Tarantula: 8 cards, 4 a side, two abreast -> four on top, the line, four below, sides kept.
const tar = L.engineGrid(4, 4, 2);
assert.deepStrictEqual([tar.columns, tar.rows, tar.lineRow], [4, 3, 2]);
assert.strictEqual(cellsOf(tar), '1:1 2:1 1:3 2:3 3:1 4:1 3:3 4:3');
// Three engines (2 left, 1 right): the right side's lone card stays on top; its bottom cell is empty.
const three = L.engineGrid(2, 1, 1);
assert.strictEqual(cellsOf(three), '1:1 1:3 2:1');
assert.strictEqual(three.lineRow, 2);
// Six a side, two abreast (three rows a side): two rows above the line, one below.
const twelve = L.engineGrid(6, 6, 2);
assert.deepStrictEqual([twelve.above, twelve.below, twelve.lineRow, twelve.rows], [2, 1, 3, 4]);
assert.ok(twelve.cells.every(c => c.row !== twelve.lineRow), 'no card on the line');
// Every card gets its own cell.
for (const [l, r, c] of [[2, 2, 1], [4, 4, 2], [2, 1, 1], [3, 2, 2], [6, 6, 2]]) {
  const g = L.engineGrid(l, r, c);
  assert.strictEqual(new Set(g.cells.map(x => x.col + ':' + x.row)).size, l + r, `${l}+${r}`);
  assert.ok(g.cells.every(x => x.row !== g.lineRow && x.col >= 1 && x.col <= g.columns), `${l}+${r}`);
}

// ── FUEL band ──
// A tall-enough band stacks (dial + readouts on top, tanks below); a short, wide one stays in a row.
assert.strictEqual(L.fuelArrangement(485, 514, 120).arrangement, 'stacked');   // full view
assert.strictEqual(L.fuelArrangement(485, 252, 120).arrangement, 'row');       // 50/50
assert.strictEqual(L.fuelArrangement(485, 165, 120).arrangement, 'row');       // small pane
// The dial it reports is the larger of the two layouts, and stacked must win by STACK_GAIN.
for (const [w, h, r] of [[485, 514, 120], [485, 339, 120], [485, 252, 120], [485, 165, 120], [870, 900, 160], [300, 600, 110]]) {
  const f = L.fuelArrangement(w, h, r);
  const P = L.FUEL_PAD, G = L.FUEL_GAP;
  const row = Math.min(0.3 * (w - 2 * P), h - 2 * P);
  const stacked = Math.min(w - r - G - 2 * P, (h - G) / 2 - 2 * P);
  assert.strictEqual(f.arrangement, stacked >= row + L.STACK_GAIN ? 'stacked' : 'row', `${w}x${h}`);
  assert.ok(f.dial >= row, `${w}x${h}`);
}
// Wide readouts eat into the stacked dial: a band that stacks with narrow readouts can stay a row.
assert.strictEqual(L.fuelArrangement(300, 340, 60).arrangement, 'stacked');
assert.strictEqual(L.fuelArrangement(300, 340, 250).arrangement, 'row');
// No box yet: a row with a 0 dial, never NaN or negative.
assert.deepStrictEqual(L.fuelArrangement(0, 0, 0), { arrangement: 'row', dial: 0 });

console.log('cougar-eng-layout: all checks passed');
