// Layout rule for the COUGAR layout's AKF page (cougar-akf.html). Pure: no DOM, so
// cougar-akf-layout.test.js pins it in Node.
//
// pages/akf sizes its text from vmin, which in the short, wide pane of a stacked split is the pane's
// height: every size bottoms out at its floor, and the header, both feeds and three stat cards stack
// into a strip a few lines tall. This page sizes text from the pane instead, in two steps:
//   tall  — the stock arrangement: title row with the DETAILED/COMPACT switch, the two feeds, and the
//           three stat cards (session kills, funds, rank) along the bottom.
//   short — no title row (the AKF label above the pane already names it); the feeds take the height,
//           and the stats fold into one line along the bottom: kill counts with short names, net
//           funds, rank, and the density switch at its end.
(function (root) {
  const TALL_MIN = 300;      // px of pane height for the title row and the stat cards

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // layoutFor(w, h) -> {
  //   size:    'tall' | 'short'
  //   pad:     panel padding; gap: space between the panel's rows
  //   titleFs: the title row (tall only)
  //   labelFs: section captions (ALL, PLAYER, SESSION KILLS, ...)
  //   lineFs:  a feed line; lineH: its height, gap included
  //   statFs:  stat readouts; rankFs: the rank figure (tall: its own card)
  //   stripH:  the stats band's height (short: the one-line strip)
  // }
  function layoutFor(w, h) {
    w = Math.max(0, w || 0);
    h = Math.max(0, h || 0);
    const size = h >= TALL_MIN ? 'tall' : 'short';
    const tall = size === 'tall';
    const pad = Math.round(tall ? clamp(h * 0.02, 6, 14) : clamp(h * 0.03, 4, 8));
    const gap = Math.round(tall ? clamp(h * 0.012, 4, 10) : 4);
    // A narrow pane can't carry the bigger sizes across a feed column: names are truncated sooner.
    const widthCap = w < 400 ? 15 : 20;
    const lineFs = Math.round(tall ? clamp(h * 0.045, 14, widthCap) : clamp(h * 0.085, 13, Math.min(widthCap, 18)));
    const labelFs = Math.round(clamp(lineFs * 0.72, 10, 14));
    const statFs = Math.round(tall ? clamp(h * 0.035, 14, 18) : clamp(h * 0.075, 12, 16));
    const rankFs = Math.round(tall ? clamp(h * 0.055, 24, 40) : statFs);
    const titleFs = Math.round(clamp(h * 0.035, 15, 24));
    const lineGap = Math.round(clamp(lineFs * 0.3, 3, 6));
    const lineH = Math.round(lineFs * 1.35) + lineGap;
    // Tall: three cards, the tallest being SESSION KILLS (caption + two rows of counts) or FUNDS
    // (caption + three rows). Short: one line of stats with a hairline above it.
    const stripH = tall ? Math.round(labelFs * 1.6 + 3 * statFs * 1.6 + gap) : Math.round(statFs * 1.7);
    return { size: size, pad: pad, gap: gap, titleFs: titleFs, labelFs: labelFs, lineFs: lineFs,
             lineGap: lineGap, lineH: lineH, statFs: statFs, rankFs: rankFs, stripH: stripH };
  }

  // Feed lines that fit a pane under this layout (both feeds share the height).
  function feedLines(l, h) {
    const title = l.size === 'tall' ? Math.round(l.titleFs * 1.6) + l.gap : 0;
    const caption = Math.round(l.labelFs * 1.6) + 4;
    const room = h - 2 * l.pad - title - caption - l.gap - l.stripH;
    return Math.max(0, Math.floor(room / l.lineH));
  }

  const api = { TALL_MIN: TALL_MIN, layoutFor: layoutFor, feedLines: feedLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarAkfLayout = api;
})(typeof self !== 'undefined' ? self : this);
