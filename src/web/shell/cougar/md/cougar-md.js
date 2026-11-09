// The COUGAR layout's MD text pages (cougar-bdf/obj/mis.html): applies CougarMdLayout to the stock
// page beside it. The stock page script runs unchanged; this sets the sizes as CSS variables
// (--md-*), marks the short arrangement (body.md-short) for the page's own stylesheet, and
// auto-scrolls the boxes named by <body data-autoscroll="selector, ..."> (CougarAutoscroll) whenever
// their content is taller than they are.
(function () {
  const L = CougarMdLayout;
  const body = document.body;
  const VARS = { pad: '--md-pad', gap: '--md-gap', fs: '--md-fs', smallFs: '--md-small-fs',
                 titleFs: '--md-title-fs', bigFs: '--md-big-fs', iconPx: '--md-icon' };
  let layout = null;
  function applyLayout() {
    layout = L.layoutFor(window.innerWidth, window.innerHeight);
    for (const k in VARS) body.style.setProperty(VARS[k], layout[k] + 'px');
    body.classList.toggle('md-short', layout.size === 'short');
    body.classList.toggle('md-tall', layout.size === 'tall');
  }
  applyLayout();

  // ── auto-scroll ────────────────────────────────────────────────────────────────────────
  (body.dataset.autoscroll || '').split(',').map(function (sel) { return sel.trim(); }).filter(Boolean)
    .map(function (sel) { return document.querySelector(sel); }).filter(Boolean)
    .forEach(function (el) { CougarAutoscroll.attach(el, function () { return layout.fs * 0.9; }); });

  // The pane's size is this page's viewport, so a split preset or a window change arrives as a resize.
  window.addEventListener('resize', applyLayout);
  // A window resize can arrive mid-way through a split change, before the pane has its final size,
  // so the page's own box is watched as well.
  if (typeof ResizeObserver === 'function') new ResizeObserver(function () { applyLayout(); }).observe(document.documentElement);
})();
