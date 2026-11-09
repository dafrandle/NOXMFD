// Self-check for the Cougar ADI/HSI layout rule (cougar-avn-layout.js). Run: `node cougar-avn-layout.test.js`.
const assert = require('assert');
const L = require('./cougar-avn-layout.js');

for (const name of ['adi', 'hsi']) {
  // Full view and the large pane of a split keep the stock arrangement; short, wide panes go wide.
  assert.strictEqual(L.layoutFor(name, 980, 700).size, 'tall', name);
  assert.strictEqual(L.layoutFor(name, 460, 460).size, 'tall', name);
  assert.strictEqual(L.layoutFor(name, 980, 285).size, 'wide', name);
  assert.strictEqual(L.layoutFor(name, 980, 400).size, 'wide', name);   // 50/50

  // Whichever arrangement is picked draws at least as large as the other.
  for (const [w, h] of [[980, 700], [980, 470], [980, 285], [460, 460], [460, 230], [460, 170], [1400, 300]]) {
    const l = L.layoutFor(name, w, h);
    const other = l.size === 'tall' ? 'wide' : 'tall';
    assert.ok(l.scale >= L.scaleFor(name, other, w, h), name + ' ' + w + 'x' + h + ': picked the smaller drawing');
  }
}
assert.ok(L.scaleFor('adi', 'wide', 980, 285) > 1.3 * L.scaleFor('adi', 'tall', 980, 285), 'ADI: wide pays off in a short pane');

// Every readout sits inside its viewBox, with room for its longest text. Monospace at about 0.6em a
// character; CHARS is each readout's longest value.
const FS = {
  'adi-value big': 56, 'adi-value': 44, 'adi-heading': 32, 'adi-value wide': 50, 'adi-value big wide': 60,
  'adi-label': 20, 'adi-label wide': 26,
  'hsi-value nav': 44, 'hsi-value course': 44, 'hsi-value': 44,
  'hsi-value nav wide': 64, 'hsi-value course wide': 64, 'hsi-value wide': 64,
  'hsi-label': 20, 'hsi-label wide': 32,
};
const CHARS = {
  adi: { hdg: 4, tas: 9, vs: 10, alt: 8, mach: 4, g: 4, aoa: 6, ralt: 5 },
  hsi: { to: 6, brg: 4, crs: 4, xtk: 6, dist: 5, ete: 7, turn: 6, tas: 4 },
};
const CAP_CHARS = 8;   // "R-ALT FT", "TURN °/S", "DIST NM"
function extent(p, chars, fs) {
  const width = chars * 0.6 * fs;
  const x0 = p.a === 'end' ? p.x - width : p.a === 'middle' ? p.x - width / 2 : p.x;
  return { x0: x0, x1: x0 + width, y0: p.y - fs * 0.8, y1: p.y + fs * 0.2 };
}
function inside(box, v, what) {
  assert.ok(box.x0 >= v.x && box.x1 <= v.x + v.w, what + ': x out of view');
  assert.ok(box.y0 >= v.y && box.y1 <= v.y + v.h, what + ': y out of view');
}
for (const name of ['adi', 'hsi']) {
  const ins = L.INSTRUMENTS[name];
  for (const size of ['tall', 'wide']) {
    const v = ins.view[size], pos = ins.pos[size];
    for (const k in CHARS[name]) {
      const r = pos[k];
      assert.ok(r, name + ' ' + size + ' has ' + k);
      inside(extent(r.val, CHARS[name][k], FS[r.cls]), v, name + ' ' + size + ' ' + k + ' value');
      if (r.cap) inside(extent(r.cap, CAP_CHARS, FS[ins.capCls[size]]), v, name + ' ' + size + ' ' + k + ' caption');
    }
    if (pos.gmax) inside(extent(pos.gmax, 8, FS[ins.capCls[size]]), v, name + ' ' + size + ' gmax');
  }
}

// The wide columns stay clear of each instrument.
const CLEAR = { adi: [40, 850], hsi: [91, 799] };
for (const name of ['adi', 'hsi']) {
  const pos = L.INSTRUMENTS[name].pos.wide;
  for (const k in CHARS[name]) {
    const p = pos[k].val;
    if (p.a === 'end') assert.ok(p.x <= CLEAR[name][0], name + ' ' + k + ' left column clear');
    else assert.ok(p.x >= CLEAR[name][1], name + ' ' + k + ' right column clear');
  }
}

console.log('cougar-avn-layout: all checks passed');
