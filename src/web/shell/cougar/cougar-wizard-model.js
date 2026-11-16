// The Cougar binding wizard's steps (docs/cougar-mfd.md, OSB binding): which frame input it asks for
// next, and its undo / redo. Pure: no DOM, no plugin, so cougar-wizard-model.test.js pins it in Node.
// cougar-wizard.js drives it from the plugin's capture results and sends the commands it implies.
//
// The wizard walks the 28 inputs once, clockwise round the frame then the four rockers (ORDER, the
// same names as the plugin's CougarBindStore.Inputs). Each step is bound (a press arrived), or
// skipped: always allowed on a face key, and on a rocker half only if it is already bound (rockers are
// required, so one can be kept but not left empty). BACK undoes the last step and returns to it; REDO
// re-applies it. An undone bind reports the button it had before, a redone one the button it got, so
// the caller can set it back directly.
(function (root) {
  const ORDER = [
    'T1', 'T2', 'T3', 'T4', 'T5', 'R1', 'R2', 'R3', 'R4', 'R5',
    'B5', 'B4', 'B3', 'B2', 'B1', 'L5', 'L4', 'L3', 'L2', 'L1',
    'tl-', 'tl+', 'tr-', 'tr+', 'bl-', 'bl+', 'br-', 'br+',
  ];
  function isRocker(input) { return /^(tl|tr|bl|br)[-+]$/.test(String(input)); }

  function createModel() {
    let index = 0, history = [], redoStack = [];
    return {
      // Starts over at the first input.
      start: function () { index = 0; history = []; redoStack = []; },
      // The input to bind now, or null once every input has been visited.
      current: function () { return index < ORDER.length ? ORDER[index] : null; },
      step: function () { return index; },
      // May the current input be left as it is? `binds` maps input -> button for this profile.
      canSkip: function (binds) {
        const cur = this.current();
        if (cur === null) return false;
        return !isRocker(cur) || (binds && binds[cur] != null);
      },
      // The current input was just bound: `prev` is its button before (null = none), `next` now.
      bound: function (prev, next) {
        const cur = this.current();
        if (cur === null) return;
        history.push({ input: cur, prev: prev == null ? null : prev, next: next, skipped: false });
        redoStack = [];
        index++;
      },
      skip: function (binds) {
        if (!this.canSkip(binds)) return false;
        history.push({ input: this.current(), skipped: true });
        redoStack = [];
        index++;
        return true;
      },
      canBack: function () { return history.length > 0; },
      canRedo: function () { return redoStack.length > 0; },
      // Undoes the last step and makes its input current again. Returns the step ({ input, prev,
      // next, skipped }) so the caller can restore `prev` for a bind; null if there is none.
      back: function () {
        const e = history.pop();
        if (!e) return null;
        redoStack.push(e);
        index = ORDER.indexOf(e.input);
        return e;
      },
      // Re-applies the last undone step and moves past it. Returns it (restore `next` for a bind).
      redo: function () {
        const e = redoStack.pop();
        if (!e) return null;
        history.push(e);
        index = ORDER.indexOf(e.input) + 1;
        return e;
      },
    };
  }

  const api = { ORDER: ORDER, isRocker: isRocker, createModel: createModel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarWizardModel = api;
})(typeof self !== 'undefined' ? self : this);
