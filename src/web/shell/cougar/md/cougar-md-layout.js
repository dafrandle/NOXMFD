// Sizing rule for the COUGAR layout's MD text pages (BDF/PAL, OBJ, MIS). Pure: no
// DOM, so cougar-md-layout.test.js pins it in Node.
//
// The stock pages size their text from vmin, which in the short, wide pane of a stacked split is
// the pane's height: everything falls to its 9-11px floor. These pages size it from the pane instead,
// in two steps:
//   tall  — the stock arrangement, text scaled to the pane.
//   short — the page's own compact arrangement (a title row dropped, stats folded onto one line).
// Whatever still doesn't fit scrolls by itself (cougar-autoscroll.js).
(function (root) {
  const TALL_MIN = 300;      // px of pane height for each page's stock arrangement

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // layoutFor(w, h) -> { size: 'tall' | 'short', pad, gap, fs, smallFs, titleFs, bigFs, iconPx }
  //   fs is body text (list rows, description, section names); smallFs secondary text (captions,
  //   sub-rows, status); titleFs a page's title; bigFs a headline figure; iconPx a unit icon's box.
  function layoutFor(w, h) {
    w = Math.max(0, w || 0);
    h = Math.max(0, h || 0);
    const size = h >= TALL_MIN ? 'tall' : 'short';
    const tall = size === 'tall';
    // A narrow pane can't carry the bigger sizes across a row: names are truncated sooner.
    const widthCap = w < 400 ? 16 : 22;
    const fs = Math.round(tall ? clamp(h * 0.04, 15, widthCap) : clamp(h * 0.09, 13, Math.min(widthCap, 18)));
    return {
      size: size,
      pad: Math.round(tall ? clamp(h * 0.02, 6, 14) : clamp(h * 0.03, 4, 8)),
      gap: Math.round(tall ? clamp(h * 0.014, 4, 12) : 4),
      fs: fs,
      smallFs: Math.round(clamp(fs * 0.8, 11, 17)),
      titleFs: Math.round(fs * 1.15),
      bigFs: Math.round(fs * 1.3),
      iconPx: Math.round(fs * (tall ? 2.2 : 1.4)),
    };
  }

  const api = { TALL_MIN: TALL_MIN, layoutFor: layoutFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarMdLayout = api;
})(typeof self !== 'undefined' ? self : this);
