// Auto-scroll for the COUGAR layout's pages: a box whose content is taller than it scrolls by itself,
// so a pilot reads it without a hand free. scrollStep is the pure rule (cougar-autoscroll.test.js pins
// it in Node); attach() runs it on a box in the browser.
//
// The cycle: hold at the top, glide down at the caller's speed, hold at the bottom, jump back to the
// top. Holds are long enough to read the first and last lines; the glide is slow enough to read while
// it moves. A wheel, touch or drag on the box hands it to the user: it stays where they leave it until
// RESUME_MS after their last input, then glides on from there. A scroll this code didn't make
// (scrollbar drag, keyboard) counts the same.
(function (root) {
  const HOLD_TOP = 3, HOLD_BOTTOM = 3;   // seconds
  const RESUME_MS = 8000;

  //   s     — { phase: 'top' | 'down' | 'bottom', pos, t } (t: seconds spent in this phase)
  //   dt    — seconds since the last step
  //   max   — the box's scroll range (scrollHeight - clientHeight); <= 0 means it fits
  // Returns the next state; `pos` is the scroll offset to show.
  function scrollStep(s, dt, max, speed) {
    if (!(max > 0)) return { phase: 'top', pos: 0, t: 0 };
    const t = s.t + dt;
    if (s.phase === 'top') return t >= HOLD_TOP ? { phase: 'down', pos: 0, t: 0 } : { phase: 'top', pos: 0, t: t };
    if (s.phase === 'down') {
      const pos = Math.min(max, s.pos + speed * dt);
      return pos >= max ? { phase: 'bottom', pos: max, t: 0 } : { phase: 'down', pos: pos, t: t };
    }
    return t >= HOLD_BOTTOM ? { phase: 'top', pos: 0, t: 0 } : { phase: 'bottom', pos: max, t: t };
  }

  // ── browser ────────────────────────────────────────────────────────────────────────────
  // One animation loop for every attached box, running only while one of them overflows. Content
  // arrives and changes by message, so a slow check starts the loop when something overflows; the
  // loop stops itself once nothing does.
  const boxes = [];
  let running = false, last = 0, checking = null;
  const range = function (el) { return el.scrollHeight - el.clientHeight; };

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let any = false;
    boxes.forEach(function (b) {
      const max = range(b.el);
      if (max <= 1) {
        if (b.s.pos) b.el.scrollTop = 0;
        b.s = { phase: 'top', pos: 0, t: 0 };
        b.set = 0;
        return;
      }
      any = true;
      if (Math.abs(b.el.scrollTop - b.set) > 2) b.userUntil = now + RESUME_MS;
      if (now < b.userUntil) {
        b.s = { phase: 'down', pos: b.el.scrollTop, t: 0 };   // pick up from wherever the user left it
        b.set = b.el.scrollTop;
        return;
      }
      b.s = scrollStep(b.s, dt, max, b.speed());
      b.el.scrollTop = b.s.pos;
      b.set = b.el.scrollTop;
    });
    if (any) requestAnimationFrame(frame); else running = false;
  }

  function check() {
    if (running || !boxes.some(function (b) { return range(b.el) > 1; })) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // attach(el, speed): auto-scroll `el`; speed() gives the glide in px/s, read each frame so it can
  // follow the page's text size.
  function attach(el, speed) {
    const box = { el: el, speed: speed, s: { phase: 'top', pos: 0, t: 0 }, set: 0, userUntil: 0 };
    const hand = function () { box.userUntil = performance.now() + RESUME_MS; };
    ['wheel', 'pointerdown', 'touchstart'].forEach(function (ev) { el.addEventListener(ev, hand, { passive: true }); });
    boxes.push(box);
    if (!checking) {
      checking = setInterval(check, 1000);
      window.addEventListener('resize', check);
    }
    check();
  }

  const api = { HOLD_TOP: HOLD_TOP, HOLD_BOTTOM: HOLD_BOTTOM, RESUME_MS: RESUME_MS, scrollStep: scrollStep, attach: attach };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarAutoscroll = api;
})(typeof self !== 'undefined' ? self : this);
