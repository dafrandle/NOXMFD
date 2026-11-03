// Self-check for the Cougar OSB frame (cougar-osb.js). Run: `node cougar-osb.test.js`.
const assert = require('assert');
const O = require('./cougar-osb.js');
const NAV = require('../shared/nav-model.js').NAV;

// 20 OSBs, each named once.
assert.strictEqual(O.ALL.length, 20);
assert.strictEqual(new Set(O.ALL).size, 20);

// Shell keys are the middle three of each side column, and never a pane's key.
assert.deepStrictEqual(Object.keys(O.SHELL_KEYS).sort(), ['L2', 'L3', 'L4', 'R2', 'R3', 'R4']);
Object.keys(O.PANE_SLOTS).forEach(function (pane) {
  O.PANE_SLOTS[pane].forEach(function (osb) {
    assert.ok(!(osb in O.SHELL_KEYS), pane + ' owns shell key ' + osb);
    assert.ok(O.ALL.indexOf(osb) !== -1, pane + ' owns unknown key ' + osb);
  });
});

// Full view has 14 page keys; a stacked pane has 7, and the two panes split the 14 between them.
assert.strictEqual(O.PANE_SLOTS.full.length, 14);
assert.strictEqual(O.PANE_SLOTS.top.length, 7);
assert.strictEqual(O.PANE_SLOTS.bottom.length, 7);
assert.deepStrictEqual(O.PANE_SLOTS.top.concat(O.PANE_SLOTS.bottom).sort(), O.PANE_SLOTS.full.slice().sort());
// Each pane's first key is the top-left of its own area.
assert.strictEqual(O.PANE_SLOTS.top[0], 'T1');
assert.strictEqual(O.PANE_SLOTS.bottom[0], 'B1');

// Split presets: every split shell key names a share, wide-top > half > wide-bottom.
Object.keys(O.SPLITS).forEach(function (k) { assert.ok(O.SPLIT_SHARE[O.SPLITS[k]] > 0, k); });
assert.ok(O.SPLIT_SHARE.tw > O.SPLIT_SHARE.h && O.SPLIT_SHARE.h > O.SPLIT_SHARE.bw);

// place(): flowed items fill in order; overflow pages instead of spilling.
const items = (n) => Array.from({ length: n }, (_, i) => ({ label: 'I' + i, action: 'a' + i }));
let r = O.place(items(5), 'full', 0);
assert.deepStrictEqual(r.placed.map((p) => p.osb), ['T1', 'T2', 'T3', 'T4', 'T5']);
assert.strictEqual(r.pages, 1);
r = O.place(items(9), 'top', 0);
assert.strictEqual(r.pages, 2);
assert.strictEqual(r.placed.length, 7);
r = O.place(items(9), 'top', 1);
assert.deepStrictEqual(r.placed.map((p) => p.item.label), ['I7', 'I8']);
assert.deepStrictEqual(r.placed.map((p) => p.osb), ['T1', 'T2']);
// Clamped.
assert.strictEqual(O.place(items(9), 'top', 99).page, 1);
assert.strictEqual(O.place(items(3), 'top', -4).page, 0);

// Pinned items keep their key on every page and take it out of the flow.
r = O.place([{ label: 'P', action: 'p', osb: 'T3' }].concat(items(7)), 'top', 0);
assert.ok(r.placed.some((p) => p.osb === 'T3' && p.item.label === 'P'));
assert.strictEqual(r.placed.filter((p) => p.osb === 'T3').length, 1);
assert.strictEqual(r.pages, 2);   // 7 flowed into 6 free keys
r = O.place([{ label: 'P', action: 'p', osb: 'T3' }].concat(items(7)), 'top', 1);
assert.ok(r.placed.some((p) => p.osb === 'T3'));
// A pin on a key the pane doesn't own is dropped, not misplaced.
r = O.place([{ label: 'X', action: 'x', osb: 'B1' }], 'top', 0);
assert.strictEqual(r.placed.length, 0);

// The first seven keys of full view are the top pane's seven, so a page's first seven items sit on
// the same keys either way.
assert.deepStrictEqual(O.PANE_SLOTS.full.slice(0, 7), O.PANE_SLOTS.top);

// MAIN's full list fits full view without paging; a stacked pane pages it.
const MAIN_EXTRAS = [{ label: 'CFG', action: 'hud' }, { label: 'MD', action: 'akf' },
                     { label: 'RDR', action: 'rdr' }, { label: 'SQD', action: 'sqd' }];
const MAIN_ITEMS = NAV.main.concat(MAIN_EXTRAS);
assert.ok(MAIN_ITEMS.length <= O.PANE_SLOTS.full.length);
assert.strictEqual(O.place(MAIN_ITEMS, 'full', 0).pages, 1);
assert.ok(O.place(MAIN_ITEMS, 'top', 0).pages > 1);

// MAIN's priority names every destination, so none falls to the unranked tail.
MAIN_ITEMS.forEach((i) => assert.ok(O.PRIORITY.main.indexOf(i.action) !== -1, 'MAIN priority misses ' + i.action));
// MAIN: the flight pages take the first seven keys in either view; settings land on the bottom row.
const FLIGHT = ['map', 'tgp', 'wpn', 'rdr', 'rwr', 'tgt', 'adi'];
const ordered = O.order('main', MAIN_ITEMS);
const fullMain = O.place(ordered, 'full', 0).placed;
const keyOf = (placed, action) => (placed.find((p) => p.item.action === action) || {}).osb;
FLIGHT.forEach((a) => assert.ok(O.PANE_SLOTS.top.indexOf(keyOf(fullMain, a)) !== -1, a + ' not in the first seven'));
assert.ok(/^B/.test(keyOf(fullMain, 'hud')), 'CFG not on the bottom row');
assert.deepStrictEqual(O.place(ordered, 'top', 0).placed.map((p) => p.item.action).sort(), FLIGHT.slice().sort());
// Unranked items keep their order after the ranked ones.
assert.deepStrictEqual(O.order('main', [{ action: 'x1' }, { action: 'hud' }, { action: 'x2' }, { action: 'map' }]).map((i) => i.action),
                       ['map', 'hud', 'x1', 'x2']);
// A page with no priority keeps its order.
assert.deepStrictEqual(O.order('rdr', NAV.rdr).map((i) => i.action), NAV.rdr.map((i) => i.action));
// MAP and TGP keep their settings last, in a split pane's flow and on full view's bottom-right key.
assert.strictEqual(O.PRIORITY.map[O.PRIORITY.map.length - 1], 'mapcfg');
assert.strictEqual(O.PRIORITY.tgp[O.PRIORITY.tgp.length - 1], 'tgpcfg');
assert.strictEqual(O.FULL_PINS.map.mapcfg, 'B5');
assert.strictEqual(O.FULL_PINS.tgp.tgpcfg, 'B5');

// Every pinned page key is a key full view owns, used once per page, and names a real action
// (NAV's, or the shell's own for TGP/WPN).
Object.keys(O.FULL_PINS).forEach(function (page) {
  const pins = O.FULL_PINS[page];
  const keys = Object.keys(pins).map((a) => pins[a]);
  assert.strictEqual(new Set(keys).size, keys.length, page + ' pins a key twice');
  keys.forEach((k) => assert.ok(O.PANE_SLOTS.full.indexOf(k) !== -1, page + ' pins non-page key ' + k));
  assert.strictEqual(O.pinFor(page, 'top', Object.keys(pins)[0]), undefined, 'pins are full view only');
});
// MAP: every NAV.map action is either pinned or on the rocker — nothing is unreachable.
NAV.map.forEach(function (item) {
  assert.ok(item.action in O.FULL_PINS.map || O.rockerActions('map').indexOf(item.action) !== -1,
            'MAP action ' + item.action + ' has no key');
});
// RDR/HSD rocker actions are NAV's own R+/R-.
['rdr', 'hsd'].forEach(function (p) {
  O.rockerActions(p).forEach((a) => assert.ok(NAV[p].some((i) => i.action === a), p + ' rocker ' + a));
});

// Display steps stay in range and don't drift.
assert.strictEqual(O.stepDisplay('brightness', 1, -1), 0.9);
assert.strictEqual(O.stepDisplay('brightness', 0.2, -1), 0.2);
assert.strictEqual(O.stepDisplay('contrast', 1.5, 1), 1.5);
assert.strictEqual(O.stepDisplay('contrast', undefined, 1), 1.1);
let v = 1;
for (let i = 0; i < 7; i++) v = O.stepDisplay('brightness', v, -1);
assert.strictEqual(v, 0.3);

// Profile names.
assert.strictEqual(O.profileName('  left mfd '), 'LEFT MFD');
assert.strictEqual(O.profileName('<script>'), 'SCRIPT');
assert.strictEqual(O.profileName(null), '');
assert.strictEqual(O.profileName('x'.repeat(40)).length, 24);

console.log('cougar-osb: all assertions passed');
