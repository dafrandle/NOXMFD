// Layout rule for the COUGAR layout's WPN page (cougar-wpn.html). Pure: no DOM, so
// cougar-wpn-layout.test.js pins it in Node.
//
// A Cougar pane is about as wide as the frame's window, and anywhere from that tall (full view) down
// to about a third of it (the small pane of a wide split): roughly 460x460 down to 460x170. The CLASSIC
// WPN page places itself against bezel geometry and assumes a full-height or half-height pane, so this
// page sizes itself from its own box instead, in three steps:
//   tall  — countermeasures as two titled blocks; five weapon rows, name over ammo; the selected
//           weapon's image on the right.
//   mid   — countermeasures on one line; five weapon rows, name and ammo on one line; the image.
//   short — countermeasures on one line; weapons in two columns of three, name over ammo; no image.
(function (root) {
  // px of pane height. Two-line rows (tall) fit down to about 280; below that the one-line rows (mid)
  // read bigger, until five of them no longer fit.
  const TALL_MIN = 280;
  const MID_MIN  = 220;
  const IMAGE_MIN_W = 300;   // narrower panes give the list the whole width
  // The image column's share of the width. Mid rows put name and ammo on one line, so they need more
  // of the width; the image turns upright there and needs only about a quarter.
  const IMAGE_SHARE = { tall: 0.36, mid: 0.24 };
  const PAD = 6;             // list padding, top + bottom each

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // layoutFor(w, h) -> {
  //   size:  'tall' | 'mid' | 'short'
  //   cmH:   countermeasures band height
  //   cols, rows: the weapon grid (cols * rows >= 5, the shell's page of weapons)
  //   rowH:  one weapon cell's height
  //   nameFs, ammoFs: font sizes for a weapon's name and its ammo line
  //   cmFs, cmTitleFs: countermeasure readout and title sizes
  //   imageW: the image column's width (0 = no image); rotate: whether the 2:1 image turns upright
  // }
  function layoutFor(w, h) {
    w = Math.max(0, w || 0);
    h = Math.max(0, h || 0);
    const size = h >= TALL_MIN ? 'tall' : h >= MID_MIN ? 'mid' : 'short';
    const cmH = size === 'tall' ? Math.round(clamp(h * 0.17, 56, 84)) : Math.round(clamp(h * 0.13, 24, 34));
    const cols = size === 'short' ? 2 : 1;
    const rows = size === 'short' ? 3 : 5;
    const listH = Math.max(0, h - cmH - 2 * PAD);
    const rowH = listH / rows;
    // A one-line row (mid) can give the name more of its height than a two-line one, but shares the
    // width with the ammo line: past 16px the longest names ("30mm Rotary Cannon") no longer fit.
    const nameFs = Math.round(size === 'mid' ? clamp(rowH * 0.42, 12, 16) : clamp(rowH * 0.36, 12, 26));
    const ammoFs = Math.round(clamp(nameFs * 0.72, 10, 18));
    const cmFs = Math.round(size === 'tall' ? clamp(cmH * 0.48, 20, 40) : clamp(cmH * 0.58, 13, 20));
    const cmTitleFs = Math.round(size === 'tall' ? clamp(cmH * 0.2, 11, 16) : clamp(cmFs * 0.75, 10, 14));
    const imageW = size !== 'short' && w >= IMAGE_MIN_W ? Math.round(w * IMAGE_SHARE[size]) : 0;
    // The source images are 2:1 landscape. Turned upright they fill a tall box better.
    const rotate = imageW > 0 && listH > imageW;
    return { size: size, cmH: cmH, cols: cols, rows: rows, rowH: rowH, nameFs: nameFs, ammoFs: ammoFs,
             cmFs: cmFs, cmTitleFs: cmTitleFs, imageW: imageW, rotate: rotate };
  }

  const api = { TALL_MIN: TALL_MIN, MID_MIN: MID_MIN, IMAGE_MIN_W: IMAGE_MIN_W, layoutFor: layoutFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarWpnLayout = api;
})(typeof self !== 'undefined' ? self : this);
