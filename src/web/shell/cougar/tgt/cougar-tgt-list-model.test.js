// Self-check for the Cougar target list (cougar-tgt-list-model.js). Run: `node cougar-tgt-list-model.test.js`.
const assert = require('assert');
const L = require('./cougar-tgt-list-model.js');

const ids = (list) => list.map(c => c.id);
const byId = (label) => L.FILTERS.findIndex(f => f.label === label);

// Filter order: the threats, the threats ahead, then what's ahead first; LOCKED last.
assert.deepStrictEqual(L.FILTERS.map(f => f.label),
  ['THREAT AIR', 'THREAT GND', 'THREAT GND AHEAD', 'THREAT AIR AHEAD', 'AHEAD AIR', 'AHEAD GND', 'AIR',
   'SAM/AAA', 'RADAR', 'GROUND', 'SHIP', 'BLDG', 'TD', 'ALL', 'LOCKED']);

// Bearing: clockwise from north (+z).
assert.strictEqual(Math.round(L.bearing(0, 0, 0, 10)), 0);
assert.strictEqual(Math.round(L.bearing(0, 0, 10, 0)), 90);
assert.strictEqual(Math.round(L.bearing(0, 0, 0, -10)), 180);
assert.strictEqual(Math.round(L.bearing(0, 0, -10, 0)), 270);
assert.strictEqual(L.wrap180(350), -10);
assert.strictEqual(L.wrap180(-190), 170);

// We're at the origin heading north.
const own = { x: 0, z: 0, hdg: 0 };
const C = (id, x, z, extra) => Object.assign({ id: id, t: 'U' + id, x: x, z: z, h: 0, f: 2 }, extra);
const contacts = [
  C(1, 0, 20000, { c: 'a', h: 180 }),                 // aircraft ahead, flying at us (hot)
  C(2, 0, 5000, { c: 'a', h: 0 }),                    // aircraft ahead, flying away
  C(3, 15000, 0, { c: 'g', k: 'R_SAM' }),             // SAM off the right wing
  C(4, -3000, 0, { c: 'g', k: 'TRUCK' }),             // truck, close, abeam
  C(5, 0, -8000, { c: 'g', k: 'MBT' }),               // tank behind
  C(6, 0, 30000, { c: 'g', k: 'RDR' }),               // radar far ahead
  C(7, 2000, 2000, { c: 's' }),                       // ship
  C(8, 1000, 9000, { c: 'b' }),                       // building, ahead
  C(9, 0, 3000, { c: 'g', k: 'MBT', dl: 1 }),         // datalink-only tank, close
  C(10, 0, 2500, { c: 'g', k: 'MBT', dl: 1, st: 1 }), // stale tank, closest
  C(11, 0, 4000, { c: 'g', k: 'AFV', tg: 1 }),        // locked IFV
  C(12, 100, 100, { f: 1, c: 'g' }),                  // friendly: never listed
];
const inputs = { contacts, own, rwr: [{ id: 3, tr: 2 }, { id: 6, tr: 0 }, { id: 1, tr: 1 }], rings: [{ id: 3, r: 20000 }], td: [5, 7] };

const enriched = L.enrich(inputs);
assert.strictEqual(enriched.length, 11, 'enemies only');
const e1 = enriched.find(c => c.id === 1), e3 = enriched.find(c => c.id === 3);
assert.ok(e1.hot && !enriched.find(c => c.id === 2).hot, 'hot = flying at us');
assert.ok(e3.inRing && e3.rwrTier === 2);
assert.strictEqual(Math.round(enriched.find(c => c.id === 3).rel), 90);

// THREAT AIR: the aircraft tracking us (and hot); the one flying away, off the RWR, isn't.
assert.deepStrictEqual(ids(L.build(inputs, byId('THREAT AIR'))), [1]);
// THREAT GND: the SAM locking us (we're in its ring), then the radar searching us.
assert.deepStrictEqual(ids(L.build(inputs, byId('THREAT GND'))), [3, 6]);
// THREAT GND AHEAD: of what's ahead, only the radar searching us counts (the SAM is abeam; tanks,
// the building and the IFV aren't air defence or on the RWR).
assert.deepStrictEqual(ids(L.build(inputs, byId('THREAT GND AHEAD'))), [6]);
// THREAT AIR AHEAD: THREAT AIR, ahead only.
assert.deepStrictEqual(ids(L.build(inputs, byId('THREAT AIR AHEAD'))), [1]);
// AHEAD AIR / AHEAD GND: within 30 deg of the nose, nearest first; datalink, then stale, last.
assert.deepStrictEqual(ids(L.build(inputs, byId('AHEAD AIR'))), [2, 1]);
assert.deepStrictEqual(ids(L.build(inputs, byId('AHEAD GND'))), [11, 8, 6, 9, 10]);
{
  // Surface ahead: locking us, then tracking, then inside its ring, then a ring we're flying toward
  // (or a SAM with no ring sent yet), then only searching; a missile and a SAM behind never count.
  const ahead = [
    C(21, 0, 30000, { c: 'g', k: 'RDR' }),             // searching us
    C(22, 0, 40000, { c: 'g', k: 'R_SAM' }),            // ring ahead, not inside it
    C(23, 0, 45000, { c: 'g', k: 'IR_SAM' }),           // SAM, no ring sent
    C(24, 0, 9000, { c: 'g', k: 'R_SAM' }),             // inside its ring
    C(25, 0, 50000, { c: 's' }),                        // ship tracking us
    C(26, 0, 60000, { c: 'g', k: 'AAA' }),              // locking us
    C(27, 0, 1000, { c: 'm' }),                         // missile
    C(28, 0, -5000, { c: 'g', k: 'R_SAM' }),            // behind
    C(29, 0, 2000, { c: 'g', k: 'MBT' }),               // tank: not a threat to an aircraft here
    C(30, 0, 70000, { c: 'a', h: 180 }),                // hot aircraft: the air filters'
    C(31, 0, 10000, { c: 'a', h: 0 }),                  // aircraft searching us, flying away
  ];
  const inp = { contacts: ahead, own, rwr: [{ id: 21, tr: 0 }, { id: 25, tr: 1 }, { id: 26, tr: 2 }, { id: 31, tr: 0 }],
                rings: [{ id: 22, r: 10000 }, { id: 24, r: 12000 }, { id: 28, r: 20000 }], td: [] };
  assert.deepStrictEqual(ids(L.build(inp, byId('THREAT GND AHEAD'))), [26, 25, 24, 22, 23, 21]);
  // Air: hot before only searching, though further.
  assert.deepStrictEqual(ids(L.build(inp, byId('THREAT AIR AHEAD'))), [30, 31]);
  // THREAT AIR (any direction): on our six (behind, close, hot) ranks above hot ahead; one behind
  // but outside the danger range, or behind and not hot, isn't on our six.
  const six = ahead.concat([
    C(32, 0, -8000, { c: 'a', h: 0 }),                  // behind, 8 km, flying at us: our six
    C(33, 0, -30000, { c: 'a', h: 0 }),                 // behind, 30 km, hot: just hot
    C(34, 0, -6000, { c: 'a', h: 180 }),                // behind, close, flying away: not listed
    C(35, 1500, 0, { c: 'a', h: 0 }),                   // 1.5 km abeam, flying away, silent: danger close
  ]);
  const inpSix = Object.assign({}, inp, { contacts: six });
  const e = L.enrich(inpSix);
  assert.ok(e.find(c => c.id === 32).six && !e.find(c => c.id === 33).six && !e.find(c => c.id === 34).six);
  assert.ok(!e.find(c => c.id === 30).six, 'hot but ahead');
  // Danger close (within 2 km, any heading) first, then our six, hot (nearer first), searching.
  assert.ok(e.find(c => c.id === 35).close && !e.find(c => c.id === 32).close);
  assert.deepStrictEqual(ids(L.build(inpSix, byId('THREAT AIR'))), [35, 32, 33, 30, 31]);   // hot: nearer first
  // THREAT GND (any direction): the SAM behind counts once we're inside its ring; a ring we're only
  // flying toward doesn't (that's THREAT GND AHEAD's).
  assert.deepStrictEqual(ids(L.build(inp, byId('THREAT GND'))), [26, 25, 28, 24, 21]);
}
// AIR: the one tracking us first, though further.
assert.deepStrictEqual(ids(L.build(inputs, byId('AIR'))), [1, 2]);
// SAM/AAA: subtype or a threat ring.
assert.deepStrictEqual(ids(L.build(inputs, byId('SAM/AAA'))), [3]);
// RADAR: everything on the RWR (the SAM, the aircraft tracking us, the radar), by range.
assert.deepStrictEqual(ids(L.build(inputs, byId('RADAR'))), [3, 1, 6]);
// GROUND: air defence, then radar, then armour/artillery (tank behind, AFV), then trucks; unreliable last.
assert.deepStrictEqual(ids(L.build(inputs, byId('GROUND'))), [3, 6, 5, 11, 4, 9, 10]);
assert.deepStrictEqual(ids(L.build(inputs, byId('SHIP'))), [7]);
assert.deepStrictEqual(ids(L.build(inputs, byId('BLDG'))), [8]);
assert.deepStrictEqual(ids(L.build(inputs, byId('TD'))), [7, 5]);
assert.strictEqual(L.build(inputs, byId('ALL')).length, 11);
assert.deepStrictEqual(ids(L.build(inputs, byId('LOCKED'))), [11]);
// The index wraps either way.
assert.deepStrictEqual(ids(L.build(inputs, -1)), [11]);
assert.deepStrictEqual(ids(L.build(inputs, L.FILTERS.length)), [1]);

// Paging: 12 a page in full view, 5 in a split pane.
const many = Array.from({ length: 27 }, (_, i) => ({ id: i + 1 }));
assert.deepStrictEqual(L.page(many, 0, L.PER_PAGE.full).pages, 3);
assert.deepStrictEqual(ids(L.page(many, 2, L.PER_PAGE.full).items), [25, 26, 27]);
assert.strictEqual(L.page(many, 9, L.PER_PAGE.split).page, 5, 'clamped to the last page');
assert.strictEqual(L.page([], 0, 12).pages, 1);

// Long-press: lock all on the page, or unlock all once they all are.
assert.deepStrictEqual(L.pageToggle([{ id: 1, locked: true }, { id: 2, locked: false }]), { select: [2], deselect: [] });
assert.deepStrictEqual(L.pageToggle([{ id: 1, locked: true }, { id: 2, locked: true }]), { select: [], deselect: [1, 2] });
assert.deepStrictEqual(L.pageToggle([]), { select: [], deselect: [] });

console.log('cougar-tgt-list-model: all checks passed');
