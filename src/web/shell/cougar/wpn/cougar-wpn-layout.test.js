// Self-check for the Cougar WPN layout rule (cougar-wpn-layout.js). Run: `node cougar-wpn-layout.test.js`.
const assert = require('assert');
const L = require('./cougar-wpn-layout.js');

// Steps across the Cougar pane range.
assert.strictEqual(L.layoutFor(460, 460).size, 'tall');
assert.strictEqual(L.layoutFor(460, 280).size, 'tall');
assert.strictEqual(L.layoutFor(460, 279).size, 'mid');
assert.strictEqual(L.layoutFor(460, 220).size, 'mid');
assert.strictEqual(L.layoutFor(460, 219).size, 'short');
assert.strictEqual(L.layoutFor(460, 170).size, 'short');

// Every height from 460 down to 170 fits the shell's page of five weapons, with readable text, and
// the bands add up to no more than the pane.
for (let h = 460; h >= 170; h -= 5) {
  const l = L.layoutFor(460, h);
  assert.ok(l.cols * l.rows >= 5, h + ': room for five weapons');
  assert.ok(l.nameFs >= 12 && l.ammoFs >= 10, h + ': text too small');
  assert.ok(l.cmH + l.rows * l.rowH <= h, h + ': overflows the pane');
  // A two-line cell (name over ammo) needs both lines to fit; a one-line row needs the name to.
  const need = l.size === 'mid' ? l.nameFs * 1.2 : l.nameFs * 1.2 + l.ammoFs * 1.2 + 4;
  assert.ok(l.rowH >= need, h + ': row ' + l.rowH.toFixed(1) + 'px under ' + need.toFixed(1));
}

// The image shows tall and mid, upright while its column is taller than wide; never short.
assert.ok(L.layoutFor(460, 460).imageW > 0);
assert.strictEqual(L.layoutFor(460, 460).rotate, true);
assert.ok(L.layoutFor(460, 240).imageW > 0);
assert.strictEqual(L.layoutFor(460, 240).rotate, true);   // 194px tall list vs a 110px column
// Mid leaves the one-line rows more of the width than tall does.
assert.ok(L.layoutFor(460, 240).imageW < L.layoutFor(460, 400).imageW);
assert.strictEqual(L.layoutFor(460, 170).imageW, 0);
// A narrow pane gives the list the whole width.
assert.strictEqual(L.layoutFor(280, 460).imageW, 0);

// Short splits the weapons into two columns.
assert.deepStrictEqual([L.layoutFor(460, 170).cols, L.layoutFor(460, 170).rows], [2, 3]);
assert.deepStrictEqual([L.layoutFor(460, 460).cols, L.layoutFor(460, 460).rows], [1, 5]);

// Garbage in, a usable layout out.
assert.strictEqual(L.layoutFor(undefined, NaN).size, 'short');

console.log('cougar-wpn-layout: all assertions passed');
