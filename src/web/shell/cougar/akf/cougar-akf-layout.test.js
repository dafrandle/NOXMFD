// Self-check for the Cougar AKF layout rule (cougar-akf-layout.js). Run: `node cougar-akf-layout.test.js`.
const assert = require('assert');
const L = require('./cougar-akf-layout.js');

assert.strictEqual(L.layoutFor(980, 700).size, 'tall');
assert.strictEqual(L.layoutFor(460, 300).size, 'tall');
assert.strictEqual(L.layoutFor(460, 299).size, 'short');
assert.strictEqual(L.layoutFor(460, 145).size, 'short');

// Across the Cougar pane range, text stays readable and the feeds keep enough lines to be a feed.
for (const w of [460, 700, 980]) {
  for (let h = 760; h >= 140; h -= 10) {
    const l = L.layoutFor(w, h);
    assert.ok(l.lineFs >= 13, w + 'x' + h + ': feed text too small');
    assert.ok(l.labelFs >= 10 && l.statFs >= 12, w + 'x' + h + ': captions/stats too small');
    assert.ok(L.feedLines(l, h) >= 3, w + 'x' + h + ': fewer than three feed lines (' + L.feedLines(l, h) + ')');
  }
}

// The short pane reads bigger than the stock page did there: pages/akf's feed text is
// clamp(11px, 1.9vmin, 15px), which a 145px-tall pane pins at 11.
assert.ok(L.layoutFor(460, 145).lineFs > 11);
{
  // Every pane reads at the 1/3 pane's size (textH).
  const sizes = [522, 347, 260, 173].map(h => L.layoutFor(493, h, 174));
  assert.ok(sizes.every(l => l.lineFs === sizes[3].lineFs && l.statFs === sizes[3].statFs && l.labelFs === sizes[3].labelFs), 'same text in every pane');
  assert.strictEqual(sizes[0].size, 'tall');
}
assert.ok(L.layoutFor(980, 285).lineFs >= 18);
assert.ok(L.layoutFor(980, 400).lineFs >= 17);   // the 50/50 pane

// A narrow pane caps the feed text so names aren't cut short as soon.
assert.ok(L.layoutFor(380, 760).lineFs <= 15);

console.log('cougar-akf-layout: all checks passed');
