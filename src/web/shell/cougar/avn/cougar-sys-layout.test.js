// Self-check for the Cougar SYS layout rule (cougar-sys-layout.js). Run: `node cougar-sys-layout.test.js`.
const assert = require('assert');
const L = require('./cougar-sys-layout.js');

// ── layoutFor ───────────────────────────────────────────────────────────────────────────
// Across the Cougar pane range — full view, the two splits' panes, large and small windows — the
// status chips fit the height, the drawing keeps its share of the width, and the columns add up.
for (const w of [460, 498, 700, 980, 1400]) {
  for (let h = 120; h <= 900; h += 10) {
    const l = L.layoutFor(w, h, 7);
    const what = w + 'x' + h;
    const chip = L.CHIP[l.icons ? 'icon' : 'text'];
    assert.ok(l.fs >= 12, what + ': text too small');
    assert.strictEqual(l.statusCols * l.statusRows, 8, what + ': eight chips');
    if (h >= 140) {
      assert.ok(l.statusRows * l.fs * chip.h + (l.statusRows - 1) * L.GAP <= l.statusH, what + ': status runs off');
      assert.ok(l.statusH + (l.bandH ? l.bandH + L.GAP : 0) <= h - 2 * L.PAD, what + ': band overlaps the status');
      assert.ok(l.middleW >= w * L.MIDDLE_MIN, what + ': middle squeezed (' + Math.round(l.middleW) + ')');
    }
    assert.strictEqual(l.middleL + l.middleW + l.middleR, w, what + ': columns add up');
  }
}

// Weapons below once the height makes the drawing larger that way; beside in the short panes, and in
// the top-wide pane, where the drawing is limited by height and a band would shrink it.
assert.strictEqual(L.layoutFor(980, 808, 7).weapons, 'below');   // full view, large window
assert.strictEqual(L.layoutFor(498, 487, 7).weapons, 'below');   // full view, small window
assert.strictEqual(L.layoutFor(980, 538, 7).weapons, 'side');
assert.strictEqual(L.layoutFor(980, 268, 7).weapons, 'side');
assert.strictEqual(L.layoutFor(498, 162, 7).weapons, 'side');
// The band is sized for the list: more weapons, more lines (up to its cap).
assert.ok(L.layoutFor(980, 808, 12).bandH > L.layoutFor(980, 808, 2).bandH);

// Icons where there's room, text where there isn't.
assert.strictEqual(L.layoutFor(980, 808, 7).icons, true);    // full view, large window
assert.strictEqual(L.layoutFor(980, 538, 7).icons, true);    // top-wide split's large pane
assert.strictEqual(L.layoutFor(498, 487, 7).icons, true);    // full view, small window
assert.strictEqual(L.layoutFor(498, 162, 7).icons, false);   // bottom-wide split's small pane, small window
// One column of eight where the height allows it, two of four where it doesn't.
assert.strictEqual(L.layoutFor(980, 808).statusCols, 1);
assert.strictEqual(L.layoutFor(498, 162).statusCols, 2);
// Bigger panes read bigger.
assert.ok(L.layoutFor(980, 808).fs > L.layoutFor(498, 162).fs);

// ── weaponLines ─────────────────────────────────────────────────────────────────────────
// Pylon mode: each pylon's weapon in its state; empty pylons (no weapon) leave no line.
assert.deepStrictEqual(L.weaponLines({ pylons: [
  { n: 'P1', s: 'armed', w: 'IRM-S2' }, { n: 'P2', s: 'empty' }, { n: 'P3', s: 'exhausted', w: 'PAB-250' },
] }, false), [{ t: 'IRM-S2', s: 'armed' }, { t: 'PAB-250', s: 'exhausted' }]);
// Loadout mode: every weapon, armed while it has ammo.
assert.deepStrictEqual(L.weaponLines({ loadout: [{ n: '20mm Autocannon', a: 120 }, { n: 'AGM-68', a: 0 }] }, true),
  [{ t: '20mm Autocannon', s: 'armed' }, { t: 'AGM-68', s: 'exhausted' }]);
// Missing data reads as no weapons.
assert.deepStrictEqual(L.weaponLines(null, false), []);
assert.deepStrictEqual(L.weaponLines({ pylons: null }, false), []);
assert.deepStrictEqual(L.weaponLines({ loadout: null }, true), []);

console.log('cougar-sys-layout: all checks passed');
