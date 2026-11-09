// Self-check for the Cougar radar scope layout rule (cougar-scope-layout.js). Run:
// `node cougar-scope-layout.test.js`.
const assert = require('assert');
const L = require('./cougar-scope-layout.js');

const FCR = { stock: { w: 520, h: 600 }, crop: { x: 50, y: 62, w: 420, h: 478 } };
const HSD = { stock: { w: 600, h: 600 }, crop: { x: 70, y: 70, w: 460, h: 460 } };

for (const P of [FCR, HSD]) {
  // Every Cougar pane: whichever arrangement is picked draws the scope at least as large as the stock
  // page did, and the wide one is a real gain in the short panes.
  for (const [w, h] of [[980, 808], [980, 538], [980, 403], [980, 268], [498, 487], [498, 323], [498, 243], [498, 162]]) {
    const l = L.layoutFor(w, h, P.stock, P.crop);
    const stock = Math.min(w / P.stock.w, h / P.stock.h);
    assert.ok(l.scale >= stock - 1e-9, w + 'x' + h + ': scope smaller than stock');
    assert.ok(l.fs >= 12, w + 'x' + h + ': text too small');
    if (l.wide) assert.ok(2 * l.colW + 2 * l.pad < w, w + 'x' + h + ': columns leave no scope');
  }
  const short = L.layoutFor(980, 268, P.stock, P.crop);
  assert.ok(short.wide && short.scale > 1.15 * Math.min(980 / P.stock.w, 268 / P.stock.h), 'short pane: wide pays off');
}
// A tall, narrow pane keeps the stock page: the columns would cost more width than the crop saves.
assert.strictEqual(L.layoutFor(300, 700, FCR.stock, FCR.crop).wide, false);

// viewportFor maps viewBox units to panel px, origin and letterbox included.
{
  const vb = FCR.crop, v = L.viewportFor(vb, 100, 0, 420, 478);   // the box exactly fits the crop
  assert.ok(Math.abs(v.s - 1) < 1e-9);
  assert.ok(Math.abs(v.ox + vb.x * v.s - 100) < 1e-9, 'crop left edge at the box left');
  assert.ok(Math.abs(v.oy + vb.y * v.s - 0) < 1e-9, 'crop top edge at the box top');
  const w = L.viewportFor({ x: 0, y: 0, w: 520, h: 600 }, 0, 0, 1040, 600);   // letterboxed sideways
  assert.ok(Math.abs(w.s - 1) < 1e-9 && Math.abs(w.ox - 260) < 1e-9 && w.oy === 0);
}

// splitReadout stacks a spaced-out readout line.
assert.deepStrictEqual(L.splitReadout('RNG 12   ALT 9300   HDG 045'), ['RNG 12', 'ALT 9300', 'HDG 045']);
assert.deepStrictEqual(L.splitReadout('LOCK 2'), ['LOCK 2']);
assert.deepStrictEqual(L.splitReadout(''), []);

console.log('cougar-scope-layout: all checks passed');
