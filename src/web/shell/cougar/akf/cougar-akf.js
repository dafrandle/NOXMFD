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
    const l = CougarAkfLayout.layoutFor(window.innerWidth, window.innerHeight);
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
})();
