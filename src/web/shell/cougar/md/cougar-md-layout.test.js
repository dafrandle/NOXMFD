// Self-check for the Cougar MD page sizing rule (cougar-md-layout.js). Run: `node cougar-md-layout.test.js`.
const assert = require('assert');
const L = require('./cougar-md-layout.js');

assert.strictEqual(L.layoutFor(980, 700).size, 'tall');
assert.strictEqual(L.layoutFor(980, 300).size, 'tall');
assert.strictEqual(L.layoutFor(980, 299).size, 'short');
assert.strictEqual(L.layoutFor(460, 145).size, 'short');

for (const w of [460, 700, 980]) {
  for (let h = 760; h >= 140; h -= 10) {
    const l = L.layoutFor(w, h);
    assert.ok(l.fs >= 13, w + 'x' + h + ': body text too small');
    assert.ok(l.smallFs >= 11, w + 'x' + h + ': secondary text too small');
    assert.ok(l.titleFs > l.fs && l.bigFs > l.fs, w + 'x' + h + ': title/figure not above body');
  }
}
// Above the stock pages' floors where it matters: the stock body text is clamp(10-11px, ~2vmin, 14-15px),
// so a short pane read at 10-11px and a 50/50 pane at about 8px of vmin over its floor.
assert.ok(L.layoutFor(460, 145).fs >= 13);
assert.ok(L.layoutFor(980, 285).fs >= 18);
assert.ok(L.layoutFor(980, 400).fs >= 16);
assert.ok(L.layoutFor(980, 800).fs >= 20);
assert.ok(L.layoutFor(380, 800).fs <= 16, 'narrow pane caps the text');

console.log('cougar-md-layout: all checks passed');
