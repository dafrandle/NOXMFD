// The COUGAR layout's AKF page (cougar-akf.html): applies CougarAkfLayout to the stock AKF markup.
// pages/akf/akf.js runs unchanged beside it; this only sets sizes and, in the short arrangement,
// moves the DETAILED/COMPACT switch to the end of the stats strip (the title row it lives in is
// hidden there) and swaps the kill types to their short names. Moving the switch keeps its element,
// so akf.js's listener and the PAD cursor's hover target are unaffected.
(function () {
  const body = document.body;
  const header = document.getElementById('akf-header');
  const stats = document.getElementById('akf-stats');
  const toggle = document.getElementById('akf-density-toggle');
  const killTypes = Array.prototype.slice.call(document.querySelectorAll('.akf-kill-type'));
  killTypes.forEach(function (t) { t.dataset.long = t.textContent; });

  const VARS = ['pad', 'gap', 'titleFs', 'labelFs', 'lineFs', 'lineGap', 'statFs', 'rankFs'];
  const cssName = function (k) { return '--akf-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); };

  let size = null;
  function applyLayout() {
    const l = CougarAkfLayout.layoutFor(window.innerWidth, window.innerHeight, CougarText.textHeight(window));
    VARS.forEach(function (k) { body.style.setProperty(cssName(k), l[k] + 'px'); });
    if (l.size === size) return;
    size = l.size;
    const short = size === 'short';
    body.classList.toggle('akf-short', short);
    (short ? stats : header).appendChild(toggle);
    killTypes.forEach(function (t) { t.textContent = short ? t.dataset.short : t.dataset.long; });
  }

  // The pane's size is this page's viewport, so a split preset or a window change arrives as a resize.
  window.addEventListener('resize', applyLayout);
  // A window resize can arrive mid-way through a split change, before the pane has its final size,
  // so the page's own box is watched as well.
  if (typeof ResizeObserver === 'function') new ResizeObserver(function () { applyLayout(); }).observe(document.documentElement);
  applyLayout();

  // The feed starts COMPACT here (pages/akf starts DETAILED). akf.js is a module, so its `compact`
  // isn't reachable; once it has run (load fires after module scripts), the switch is pressed once,
  // through akf.js's own handler. The switch still toggles as usual; nothing is saved either way.
  // Every change is reported to the shell (akf-compact), whose CMPT key mirrors it.
  function reportCompact() {
    if (window.parent !== window) window.parent.postMessage({ mfd: true, type: 'akf-compact', on: toggle.classList.contains('slide-right') }, '*');
  }
  // After akf.js's own click handler (registered later, by the module) has flipped the switch.
  toggle.addEventListener('click', function () { setTimeout(reportCompact, 0); });
  window.addEventListener('load', function () {
    if (!toggle.classList.contains('slide-right')) toggle.click();
    else reportCompact();
  });

  // The ALL/PLAYER divider, a step at a time, from the shell's rocker (akf-split-left / -right): a
  // short press-move-release on the stock resizer, so akf.js's own drag does the work, collapsing a
  // feed past its minimum as a drag would. A collapsed side is restored by the half pointing away
  // from it (a tap on the collapsed resizer, akf.js's restore).
  const feeds = document.getElementById('akf-feeds');
  const resizer = document.getElementById('akf-resizer');
  const SPLIT_STEP = 0.1;   // of the feeds' usable width
  function pointer(type, x, y) {
    resizer.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }));
  }
  function moveDivider(dir) {
    const r = resizer.getBoundingClientRect(), f = feeds.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const leftCollapsed = resizer.classList.contains('collapsed-all');
    const rightCollapsed = resizer.classList.contains('collapsed-player');
    if (leftCollapsed || rightCollapsed) {
      if ((leftCollapsed && dir > 0) || (rightCollapsed && dir < 0)) { pointer('pointerdown', cx, cy); pointer('pointerup', cx, cy); }
      return;
    }
    const x = cx + dir * SPLIT_STEP * (f.width - r.width);
    pointer('pointerdown', cx, cy);
    pointer('pointermove', x, cy);
    pointer('pointerup', x, cy);
  }
  window.addEventListener('message', function (e) {
    const m = e.data;
    if (!m || m.mfd !== true) return;
    if (m.action === 'akf-compact') toggle.click();
    else if (m.action === 'akf-split-left') moveDivider(-1);
    else if (m.action === 'akf-split-right') moveDivider(1);
  });
})();
