// Self-check for the Cougar ENG marker colours (cougar-eng-contrast.js). Run: `node cougar-eng-contrast.test.js`.
const assert = require('assert');
const C = require('./cougar-eng-contrast.js');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.6, `${msg}: ${a} != ${b}`);
const rgb = (r, g, b, a) => ({ r, g, b, a: a === undefined ? 1 : a });

// Contrast ratio: the WCAG extremes and symmetry.
assert.ok(Math.abs(C.contrast(C.WHITE, C.BLACK) - 21) < 1e-9);
assert.ok(Math.abs(C.contrast(C.WHITE, C.WHITE) - 1) < 1e-9);
assert.strictEqual(C.contrast(rgb(10, 200, 30), rgb(90, 20, 200)), C.contrast(rgb(90, 20, 200), rgb(10, 200, 30)));

// Compositing: an opaque top layer wins, a half-transparent one averages, the bottom is taken as opaque.
assert.deepStrictEqual(C.composite([rgb(0, 0, 0), rgb(200, 100, 50)]), rgb(200, 100, 50));
const half = C.composite([rgb(0, 0, 0), rgb(200, 100, 50, 0.5)]);
near(half.r, 100, 'r'); near(half.g, 50, 'g'); near(half.b, 25, 'b');
assert.strictEqual(C.composite([rgb(10, 20, 30, 0.2)]).a, 1);
assert.deepStrictEqual(C.composite([rgb(0, 0, 0), null, rgb(5, 5, 5)]), rgb(5, 5, 5));   // missing layers skipped
assert.deepStrictEqual(C.composite([]), rgb(0, 0, 0));

// Gradient sampling: ends and the middle stop, and halfway between two stops.
const stops = [rgb(0, 255, 0), rgb(255, 255, 0), rgb(255, 0, 0)];
assert.deepStrictEqual(C.along(stops, 0), rgb(0, 255, 0));
assert.deepStrictEqual(C.along(stops, 0.5), rgb(255, 255, 0));
assert.deepStrictEqual(C.along(stops, 1), rgb(255, 0, 0));
assert.deepStrictEqual(C.along(stops, 2), rgb(255, 0, 0));                     // clamped
near(C.along(stops, 0.25).r, 127.5, 'quarter r');

// Marker: white over dark, black over light, and over a dark/light split the colour whose worse side
// is better.
assert.strictEqual(C.bestMarker([rgb(0, 0, 0)]), C.WHITE);
assert.strictEqual(C.bestMarker([rgb(240, 240, 240)]), C.BLACK);
// Amber beside near-black: white's worse side (~1.9 against the amber) beats black's (~1.1 against
// the near-black).
const split = [rgb(255, 170, 0), rgb(20, 20, 20)];
assert.strictEqual(C.bestMarker(split), C.WHITE);
const score = (m) => Math.min(...split.map(bg => C.contrast(m, bg)));
assert.ok(score(C.bestMarker(split)) >= score(C.WHITE) && score(C.bestMarker(split)) >= score(C.BLACK));
// Throttle-like: a 40% white fill over black on one side, bare black on the other -> white.
const fill = C.composite([rgb(0, 0, 0), rgb(230, 235, 239, 0.4)]);
assert.strictEqual(C.bestMarker([fill, rgb(0, 0, 0)]), C.WHITE);
// Heat-like: a bright 75% amber lit side over a dim track -> whichever scores better, never worse.
const lit = C.composite([rgb(0, 0, 0), rgb(255, 170, 0, 0.75)]);
const pick = C.bestMarker([lit]);
assert.strictEqual(pick, C.BLACK);
// The heat bar's amber fill as it shows on screen (#ffaa00 at 75% over the dark scale, ~#C78A00):
// black stands out ~7:1, white ~3:1, so a marker judged against the fill under it is black.
assert.strictEqual(C.bestMarker([rgb(0xc7, 0x8a, 0x00)]), C.BLACK);
assert.ok(C.contrast(C.BLACK, rgb(0xc7, 0x8a, 0x00)) > 7 && C.contrast(C.WHITE, rgb(0xc7, 0x8a, 0x00)) < 3.1);
// Other candidates can be offered; the best worst-case one is returned.
const green = rgb(0, 255, 0);
assert.strictEqual(C.bestMarker([rgb(0, 0, 0)], [rgb(40, 40, 40), green]), green);

assert.strictEqual(C.css(rgb(12.4, 99.6, 255)), 'rgb(12, 100, 255)');

console.log('cougar-eng-contrast: all checks passed');
