// Layout rule for the COUGAR layout's radar scope pages, FCR and HSD (cougar-rdr.html,
// cougar-hsd.html). Pure: no DOM, so cougar-scope-layout.test.js pins it in Node.
//
// pages/rdr and pages/hsd are each one SVG (520x600 and 600x600) scaled to the pane, with the scope in
// the middle and its readouts (mode, range, lock count, the focused lock's data) drawn as SVG text
// above and below it. In a pane that's wider than the drawing, the pane's height sets the scale: the
// scope shrinks and its readouts drop to a few px. The wide arrangement crops the SVG to the scope
// alone and shows the readouts as text in a column either side, sized for the pane:
//   [mode / range]   scope   [locks / focused lock]
// A pane takes whichever arrangement draws the scope larger.
(function (root) {
  const PAD = 6;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Scale of a w x h box drawn into a W x H area (SVG meet: the tighter axis wins).
  function fit(W, H, w, h) { return Math.min(Math.max(0, W) / w, Math.max(0, H) / h); }

  // layoutFor(w, h, stockVB, cropVB) -> { wide, fs, colW, pad, scale }
  //   stockVB / cropVB   { w, h } of the stock viewBox and of the scope-only crop
  //   fs     the side columns' font size; colW each column's width
  //   scale  the scope's px per viewBox unit in the picked arrangement
  function layoutFor(w, h, stockVB, cropVB) {
    w = Math.max(0, w || 0);
    h = Math.max(0, h || 0);
    const fs = Math.round(clamp(h * 0.06, 12, w < 600 ? 14 : 20));
    const colW = Math.round(clamp(w * 0.18, fs * 6.5, fs * 11));
    const stock = fit(w, h, stockVB.w, stockVB.h);
    const wide = fit(w - 2 * colW - 2 * PAD, h - 2 * PAD, cropVB.w, cropVB.h);
    return wide > stock
      ? { wide: true, fs: fs, colW: colW, pad: PAD, scale: wide }
      : { wide: false, fs: fs, colW: 0, pad: 0, scale: stock };
  }

  // The SVG's xMidYMid-meet transform for a viewBox { x, y, w, h } drawn into a box at (left, top)
  // of size W x H, as the stock pages' viewport() reports it: px = ox + vx * s, py = oy + vy * s,
  // in panel px. A cropped viewBox's origin folds into ox/oy, so every stock caller that maps with
  // ox/oy/s stays right.
  function viewportFor(vb, left, top, W, H) {
    const s = fit(W, H, vb.w, vb.h);
    return { s: s, ox: left + (W - vb.w * s) / 2 - vb.x * s, oy: top + (H - vb.h * s) / 2 - vb.y * s };
  }

  // Splits a readout line the stock pages space out with runs of spaces ("RNG 12   ALT 9300   HDG
  // 045") into the parts a narrow column stacks.
  function splitReadout(text) {
    return String(text || '').split(/\s{2,}/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  const api = { PAD: PAD, layoutFor: layoutFor, viewportFor: viewportFor, splitReadout: splitReadout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarScopeLayout = api;
})(typeof self !== 'undefined' ? self : this);
