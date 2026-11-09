// Self-check for the Cougar auto-scroll rule (cougar-autoscroll.js). Run: `node cougar-autoscroll.test.js`.
const assert = require('assert');
const L = require('./cougar-autoscroll.js');

function run(max, speed, seconds, dt) {
  let s = { phase: 'top', pos: 0, t: 0 };
  const seen = [];
  for (let t = 0; t < seconds; t += dt) { s = L.scrollStep(s, dt, max, speed); seen.push(s); }
  return seen;
}
// Content that fits never moves.
assert.ok(run(0, 20, 30, 0.1).every(s => s.pos === 0));
assert.ok(run(-5, 20, 30, 0.1).every(s => s.pos === 0));

// One cycle: hold at the top, glide to the bottom, hold, back to the top.
{
  const max = 100, speed = 20, dt = 0.05;
  const seen = run(max, speed, L.HOLD_TOP + max / speed + L.HOLD_BOTTOM + 1, dt);
  const atTop = seen.filter(s => s.t < L.HOLD_TOP - dt && s.phase === 'top');
  assert.ok(atTop.length > 0 && atTop.every(s => s.pos === 0), 'holds at the top first');
  assert.ok(seen.some(s => s.phase === 'down' && s.pos > 0 && s.pos < max), 'glides');
  assert.ok(seen.some(s => s.phase === 'bottom' && s.pos === max), 'reaches and holds the bottom');
  const back = seen.findIndex((s, i) => i > 0 && seen[i - 1].phase === 'bottom' && s.phase === 'top');
  assert.ok(back > 0 && seen[back].pos === 0, 'returns to the top');
  // Never past the range, never backwards while gliding.
  assert.ok(seen.every(s => s.pos >= 0 && s.pos <= max));
  for (let i = 1; i < seen.length; i++)
    if (seen[i].phase === 'down' && seen[i - 1].phase === 'down') assert.ok(seen[i].pos >= seen[i - 1].pos);
}

// The range shrinking under it (content removed) clamps instead of overshooting.
{
  let s = { phase: 'down', pos: 80, t: 1 };
  s = L.scrollStep(s, 0.1, 50, 20);
  assert.ok(s.pos <= 50);
}

console.log('cougar-autoscroll: all checks passed');
