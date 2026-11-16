// The Cougar binding wizard's screen (docs/cougar-mfd.md, OSB binding), started from MAIN for this
// window's profile. A panel over the page area says which frame input to press, the key or rocker half
// itself is marked on the glass, and each press the plugin captures moves it on. Steps, skip rules and
// undo/redo are CougarWizardModel's; the plugin does the capture (cougar.arm) and reports each result
// in its "cougar" state (live.capture: result, seq, the input it was "done" for, a conflict's owner).
//
// Also the frame's re-pair: one press on whichever frame should drive this profile now.
//
// opts: { profile, glass, target(input) -> element to mark, send(cmd, args), onChange() }
(function (root) {
  const M = root.CougarWizardModel;

  function create(opts) {
    const model = M.createModel();
    let mode = null;          // null | 'bind' | 'pair'
    let state = null;         // the plugin's last "cougar" state
    let lastSeq = -1;         // the capture result seq already handled
    let armedPrev = null;     // the current input's button when it was armed (for undo)
    let note = '';            // conflict / wrong-frame message for the current step
    let marked = null;

    const panel = document.createElement('div');
    panel.className = 'wizard';
    panel.hidden = true;
    opts.glass.appendChild(panel);

    function me() {
      const list = state && Array.isArray(state.profiles) ? state.profiles : [];
      for (let i = 0; i < list.length; i++) if (list[i] && list[i].name === opts.profile) return list[i];
      return null;
    }
    function binds() { const p = me(); return (p && p.binds) || {}; }
    function capture() { return (state && state.live && state.live.capture) || {}; }

    function mark(input) {
      if (marked) marked.classList.remove('bind-target');
      marked = input ? opts.target(input) : null;
      if (marked) marked.classList.add('bind-target');
    }

    function armCurrent() {
      note = '';
      const cur = model.current();
      if (cur === null) { close(); return; }
      armedPrev = binds()[cur] != null ? binds()[cur] : null;
      opts.send('cougar.arm', { wname: opts.profile, bind: cur });
      mark(cur);
      render();
    }

    function close() {
      opts.send('cougar.cancel', {});
      mode = null;
      note = '';
      mark(null);
      panel.hidden = true;
      opts.onChange();
    }

    function button(label, onClick, enabled, cls) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wizard-btn' + (cls ? ' ' + cls : '');
      b.textContent = label;
      b.disabled = enabled === false;
      b.addEventListener('click', onClick);
      return b;
    }

    function render() {
      panel.textContent = '';
      panel.hidden = !mode;
      if (!mode) return;
      const title = document.createElement('div');
      title.className = 'wizard-title';
      const msg = document.createElement('div');
      msg.className = 'wizard-msg';
      const sub = document.createElement('div');
      sub.className = 'wizard-sub';
      const row = document.createElement('div');
      row.className = 'wizard-row';
      if (mode === 'pair') {
        title.textContent = 'PAIR FRAME — ' + opts.profile;
        msg.textContent = 'Press any button on the frame for ' + opts.profile;
        sub.textContent = 'Its bound buttons stay as they are.';
        row.append(button('CANCEL', close));
      } else {
        const cur = model.current();
        const b = binds();
        title.textContent = 'BIND FRAME — ' + opts.profile + '  (' + (model.step() + 1) + ' / ' + M.ORDER.length + ')';
        msg.textContent = 'Press the frame button for ' + describe(cur);
        sub.textContent = b[cur] != null ? 'Now: button ' + b[cur] + '. Press it again, or another.' : 'Not bound yet.';
        row.append(button('BACK', back, model.canBack()), button('REDO', redo, model.canRedo()),
                   button(M.isRocker(cur) ? (b[cur] != null ? 'KEEP' : 'REQUIRED') : (b[cur] != null ? 'KEEP' : 'SKIP'), skip, model.canSkip(b)),
                   button('DONE', close, true, 'wizard-done'));
      }
      panel.append(title, msg, sub);
      if (note) {
        const n = document.createElement('div');
        n.className = 'wizard-note';
        n.textContent = note;
        panel.appendChild(n);
        if (capture().result === 'conflict' && mode === 'bind') panel.appendChild(button('BIND ANYWAY', function () { opts.send('cougar.force', {}); }, true, 'wizard-force'));
      }
      if (state && state.live && state.live.bgInput === false) {
        const hint = document.createElement('div');
        hint.className = 'wizard-hint';
        hint.textContent = 'In flight, the frame works only while the game window has focus. KEY: "input when game unfocused" lifts that.';
        panel.appendChild(hint);
      }
      panel.appendChild(row);
    }

    function describe(input) {
      const r = /^(tl|tr|bl|br)([-+])$/.exec(input || '');
      if (!r) return input;
      const corner = { tl: 'top-left', tr: 'top-right', bl: 'bottom-left', br: 'bottom-right' }[r[1]];
      return 'the ' + corner + ' rocker, ' + (r[2] === '-' ? 'left (−) half' : 'right (+) half');
    }

    function back() {
      const e = model.back();
      if (e && !e.skipped) opts.send('cougar.set', { wname: opts.profile, bind: e.input, index: e.prev == null ? -1 : e.prev });
      armCurrent();
    }
    function redo() {
      const e = model.redo();
      if (e && !e.skipped) opts.send('cougar.set', { wname: opts.profile, bind: e.input, index: e.next });
      armCurrent();
    }
    function skip() { if (model.skip(binds())) armCurrent(); }

    function onState(data) {
      state = data;
      const cap = capture();
      if (mode && typeof cap.seq === 'number' && cap.seq !== lastSeq) {
        const fresh = lastSeq >= 0;
        lastSeq = cap.seq;
        const done = cap.done || {};
        if (fresh && mode === 'pair' && cap.result === 'paired' && done.profile === opts.profile) { close(); return; }
        if (fresh && mode === 'bind') {
          if (cap.result === 'bound' && done.profile === opts.profile && done.input === model.current()) {
            model.bound(armedPrev, binds()[model.current()]);
            armCurrent();
            return;
          }
          if (cap.result === 'conflict' && cap.owner) note = 'That button is already ' + cap.owner.profile + ' ' + describe(cap.owner.input) + '. Press another, or bind it here anyway.';
          else if (cap.result === 'other-device') note = 'That button is on another frame. Press one on the frame for ' + opts.profile + ', or re-pair it from MAIN.';
        }
      }
      if (mode) render();
    }

    return {
      active: function () { return mode !== null; },
      state: function (data) { onState(data); opts.onChange(); },
      latest: function () { return state; },
      me: me,
      startBind: function () {
        if (!state) return;
        mode = 'bind';
        lastSeq = typeof capture().seq === 'number' ? capture().seq : -1;
        model.start();
        armCurrent();
        opts.onChange();
      },
      startPair: function () {
        if (!state) return;
        mode = 'pair';
        lastSeq = typeof capture().seq === 'number' ? capture().seq : -1;
        note = '';
        mark(null);
        opts.send('cougar.arm', { wname: opts.profile, bind: 'pair' });
        render();
        opts.onChange();
      },
      cancel: close,
    };
  }

  root.CougarWizardUi = { create: create };
})(typeof self !== 'undefined' ? self : this);
