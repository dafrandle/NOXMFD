// Layout rule for the COUGAR layout's SYS page (cougar-sys.html). Pure: no DOM, so
// cougar-sys-layout.test.js pins it in Node.
//
// pages/afm stacks everything vertically: the aircraft name, the toggles (two columns of four beside
// the top-down drawing, or a 4-across band above it), the drawing, the front view and the pylon
// boxes. In a Cougar pane that stack doesn't fit: in the short pane of a split the toggles run off
// the pane and the weapon boxes crowd the drawing out, and in the larger panes the toggles are click
// targets a pilot behind an OSB frame never uses. Every Cougar pane lays the page out across instead,
// with the weapons as a text list either beside the drawing or in a band under everything:
//   side:   [status]  name / drawing  [weapons]        below:  [status]  name / drawing
//                                                               [ weapons, wrapping across ]
// whichever draws the aircraft larger — beside in a short pane, below once there's height to spare.
// The status chips are the stock toggle buttons restyled: with their icon where the pane has room,
// as text where it doesn't; one column of eight or two of four. The weapon list scrolls by itself when
// it runs past its space. The front view and the pylon boxes are left out.
(function (root) {
  const PAD = 6;            // px from the pane's edges
  const GAP = 4;            // px between status chips
  const STATUS = 8;
  // A chip's size in its font size: text (the lamp dot, a six-letter name like LIGHTS at ~3.6em,
  // padding) or with the icon ahead of it.
  const CHIP = { text: { w: 5.8, h: 1.6 }, icon: { w: 7.5, h: 2.1 } };
  // The middle column (the drawing) keeps at least this share of the width.
  const MIDDLE_MIN = 0.35;
  const FS_MIN = 12;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // layoutFor(w, h, nWeapons) -> { pad, fs, nameFs, icons, statusCols, statusRows, leftW,
  //                                weapons, rightW, bandH, middleL, middleR, middleW, middleH, statusH }
  //   fs        the status chips' and weapon list's font size
  //   icons     whether the chips show their icons
  //   weapons   'side' (a column on the right, rightW wide) | 'below' (a band across the bottom,
  //             bandH tall, sized for nWeapons)
  //   middleL / middleR  px from the pane's left / right edge to the middle column
  //   middleH   the middle column's height under the name; statusH the status block's height
  function layoutFor(w, h, nWeapons) {
    w = Math.max(0, w || 0);
    h = Math.max(0, h || 0);
    const n = Math.max(1, nWeapons || 0);
    // As large as the pane allows; a step smaller at a time when no arrangement fits at that size.
    let fs = Math.round(clamp(Math.min(h * 0.075, w * 0.028), FS_MIN, 20));
    for (;;) {
      const side = arrangeAt(w, h, fs, 'side', n), below = arrangeAt(w, h, fs, 'below', n);
      const pick = side && below ? (drawSize(below) > drawSize(side) ? below : side) : side || below;
      if (pick || fs <= FS_MIN) return pick || arrangeAt(w, h, FS_MIN, 'side', n, true);
      fs--;
    }
  }

  // The drawing's size in the middle column, taking it as about square (top-down airframes are).
  function drawSize(l) { return Math.min(l.middleW, l.middleH); }

  // A weapon name runs about 13 characters; with the gap to the next, about 15 at 0.6em each.
  const WEAPON_EM = 9;
  const BAND_LINES_MAX = 3;
  const LINE_H = 1.25, LINE_GAP = 0.25;   // em: the list's line height and the gap between lines

  // The first status arrangement that fits at font size fs with the weapons `where` (icons in one
  // column, icons in two, text in one, text in two), or null; with `anyway`, the last one whether it
  // fits or not.
  function arrangeAt(w, h, fs, where, n, anyway) {
    const clear = Math.round(fs * 0.8);
    const nameH = Math.round(clamp(h * 0.06, 12, 26) * 1.5) + 4;
    let rightW = 0, bandH = 0;
    if (where === 'side') {
      rightW = Math.round(clamp(w * 0.26, fs * 8, fs * 13));
    } else {
      const perLine = Math.max(1, Math.floor((w - 2 * PAD) / (fs * WEAPON_EM)));
      const lines = Math.min(BAND_LINES_MAX, Math.ceil(n / perLine));
      bandH = Math.ceil(lines * fs * LINE_H + (lines - 1) * fs * LINE_GAP) + GAP;
    }
    const statusH = h - 2 * PAD - (bandH ? bandH + GAP : 0);
    const tries = [['icon', 1], ['icon', 2], ['text', 1], ['text', 2]];
    for (let i = 0; i < tries.length; i++) {
      const kind = tries[i][0], cols = tries[i][1], rows = STATUS / cols;
      const chipW = Math.round(fs * CHIP[kind].w);
      const leftW = cols * chipW + (cols - 1) * GAP;
      const middleL = PAD + leftW + clear;
      // Below, the middle runs to the pane's right edge: the whole width the status block leaves.
      const middleR = where === 'side' ? PAD + rightW + clear : PAD;
      const middleW = Math.max(0, w - middleL - middleR);
      const fits = rows * fs * CHIP[kind].h + (rows - 1) * GAP <= statusH && middleW >= w * MIDDLE_MIN;
      if (fits || (anyway && i === tries.length - 1)) {
        return {
          pad: PAD, fs: fs, nameFs: Math.round(clamp(h * 0.06, 12, 26)),
          icons: kind === 'icon', statusCols: cols, statusRows: rows, leftW: leftW, statusH: statusH,
          weapons: where, rightW: rightW, bandH: bandH,
          middleL: middleL, middleR: middleR, middleW: middleW,
          middleH: Math.max(0, statusH - nameH),
        };
      }
    }
    return null;
  }

  // The weapon list, from the same 'afm' data the stock pylon boxes show: one line per pylon's
  // weapon in its state ('armed' | 'exhausted' | 'empty'), or, for an airframe with no pylon
  // markers (loadoutMode, pages/afm's afmLoadoutMode), one per loadout weapon, armed while it has
  // ammo left. -> [{ t, s }]
  function weaponLines(data, loadoutMode) {
    if (!data) return [];
    if (loadoutMode) {
      return (Array.isArray(data.loadout) ? data.loadout : []).filter(function (it) { return it && it.n; })
        .map(function (it) { return { t: it.n, s: it.a > 0 ? 'armed' : 'exhausted' }; });
    }
    return (Array.isArray(data.pylons) ? data.pylons : []).filter(function (p) { return p && p.w; })
      .map(function (p) { return { t: p.w, s: p.s || 'empty' }; });
  }

  const api = { PAD: PAD, GAP: GAP, CHIP: CHIP, MIDDLE_MIN: MIDDLE_MIN, FS_MIN: FS_MIN, drawSize: drawSize, layoutFor: layoutFor, weaponLines: weaponLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarSysLayout = api;
})(typeof self !== 'undefined' ? self : this);
