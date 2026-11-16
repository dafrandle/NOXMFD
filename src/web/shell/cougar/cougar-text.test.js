// Self-check for the Cougar text height (cougar-text.js). Run: `node cougar-text.test.js`.
const assert = require('assert');
const T = require('./cougar-text.js');

// The 1/3 pane at the windows measured in the shell: 615x600 -> 173px, 1000x1000 -> 302px.
assert.ok(Math.abs(T.thirdPaneHeight(600) - 174) < 2);
assert.ok(Math.abs(T.thirdPaneHeight(1000) - 302.7) < 2);
// The label band clamps at 36 and 46px.
assert.strictEqual(T.thirdPaneHeight(300), (300 - 72) / 3);
assert.strictEqual(T.thirdPaneHeight(2000), (2000 - 92) / 3);
assert.strictEqual(T.thirdPaneHeight(0), 0);
assert.strictEqual(T.thirdPaneHeight(undefined), 0);

// Inside the shell: the top window's height; on its own: its own.
const top = { innerHeight: 600, document: { querySelector: () => ({}) } };
top.top = top;
const inShell = { innerHeight: 260, top: top };
assert.ok(Math.abs(T.textHeight(inShell) - 174) < 2);
const alone = { innerHeight: 260 };
alone.top = alone;
assert.strictEqual(T.textHeight(alone), 260);
const blocked = { innerHeight: 300, get top() { throw new Error('cross-origin'); } };
assert.strictEqual(T.textHeight(blocked), 300);

console.log('cougar-text: all checks passed');
