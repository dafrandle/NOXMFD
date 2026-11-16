// Self-check for the Cougar binding wizard's steps (cougar-wizard-model.js). Run: `node cougar-wizard-model.test.js`.
const assert = require('assert');
const W = require('./cougar-wizard-model.js');

// 28 inputs, clockwise round the frame then the rockers, no repeats.
assert.strictEqual(W.ORDER.length, 28);
assert.strictEqual(new Set(W.ORDER).size, 28);
assert.deepStrictEqual(W.ORDER.slice(0, 6), ['T1', 'T2', 'T3', 'T4', 'T5', 'R1']);
assert.deepStrictEqual(W.ORDER.slice(10, 11), ['B5']);
assert.deepStrictEqual(W.ORDER.slice(20), ['tl-', 'tl+', 'tr-', 'tr+', 'bl-', 'bl+', 'br-', 'br+']);
assert.ok(W.isRocker('br+') && !W.isRocker('B1') && !W.isRocker('t1-'));

const m = W.createModel();
m.start();
assert.strictEqual(m.current(), 'T1');

// Bind, skip, then undo both and redo.
m.bound(null, 0);                         // T1 -> 0
assert.strictEqual(m.current(), 'T2');
assert.ok(m.skip({}));                    // face key: may skip
assert.strictEqual(m.current(), 'T3');
let e = m.back();
assert.deepStrictEqual(e, { input: 'T2', skipped: true });
assert.strictEqual(m.current(), 'T2');
e = m.back();
assert.deepStrictEqual(e, { input: 'T1', prev: null, next: 0, skipped: false });   // caller restores prev (none)
assert.strictEqual(m.current(), 'T1');
assert.ok(!m.canBack() && m.canRedo());
e = m.redo();
assert.strictEqual(e.next, 0);
assert.strictEqual(m.current(), 'T2');
// A new step after an undo drops what could be redone.
m.bound(7, 1);
assert.ok(!m.canRedo());
assert.strictEqual(m.current(), 'T3');

// Rockers: no skipping an unbound half; an already-bound one can be kept.
for (let i = m.step(); i < 20; i++) m.skip({});
assert.strictEqual(m.current(), 'tl-');
assert.ok(!m.canSkip({}));
assert.ok(!m.skip({}));
assert.strictEqual(m.current(), 'tl-');
assert.ok(m.canSkip({ 'tl-': 20 }));
assert.ok(m.skip({ 'tl-': 20 }));
assert.strictEqual(m.current(), 'tl+');

// Done once every input is visited.
for (const input of W.ORDER.slice(m.step())) { assert.strictEqual(m.current(), input); m.bound(null, 30); }
assert.strictEqual(m.current(), null);
assert.ok(!m.canSkip({}));
m.bound(null, 1);                         // ignored once done
assert.strictEqual(m.current(), null);
assert.strictEqual(m.back().input, 'br+');   // and BACK still reaches the last step

// start() resets.
m.start();
assert.strictEqual(m.current(), 'T1');
assert.ok(!m.canBack() && !m.canRedo());

console.log('cougar-wizard-model: all checks passed');
