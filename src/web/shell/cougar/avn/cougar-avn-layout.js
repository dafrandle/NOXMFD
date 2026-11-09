// Layout rule for the COUGAR layout's ADI and HSI pages (cougar-adi.html, cougar-hsi.html). Pure: no
// DOM, so cougar-avn-layout.test.js pins it in Node.
//
// Both are one SVG drawn in the 890px-glass units of pages/adi and pages/hsi, scaled to the pane by
// the viewBox, with the instrument in the middle and its readouts in the corners. That arrangement is
// taller than wide; in the short, wide pane of a stacked split the pane's height sets the scale, and
// the corner readouts shrink to a few px. Two arrangements of the same drawing:
//   tall — the stock one.
//   wide — the readouts in a column either side of the instrument, a step bigger, so the pane's
//          height goes to the instrument and the readouts get the column's full height.
// The instrument itself never moves; only the readouts and the viewBox change. A pane takes whichever
// arrangement draws the instrument larger.
(function (root) {
  // Each instrument: its two viewBoxes, its readouts' positions per arrangement, and the caption
  // class per arrangement. A readout is a caption (null: none in this arrangement) over a value, at
  // { x, y, a } with a = 'start' | 'middle' | 'end'; `cls` is the value's class. The '.wide' classes
  // (each page's own <style>) are the step-up sizes.
  function side(x, y, gap, a, cls) {
    return { cap: { x: x, y: y, a: a }, val: { x: x, y: y + gap, a: a }, cls: cls };
  }

  // ADI: the ball, its AoA/VVI bars and the slip tube span x 40..850, y 165..745. Wide: four rows a
  // side, flight data the pilot scans most (heading, speed / altitude, climb) on top.
  const ADI_ROW = [205, 350, 495, 640], ADI_GAP = 58, ADI_L = 10, ADI_R = 880;
  const ADI = {
    view: { tall: { x: 56, y: 14, w: 778, h: 862 }, wide: { x: -320, y: 155, w: 1530, h: 595 } },
    capCls: { tall: 'adi-label', wide: 'adi-label wide' },
    pos: {
      tall: {
        hdg:  { cap: null,                          val: { x: 445, y: 46,  a: 'middle' }, cls: 'adi-heading' },
        tas:  { cap: null,                          val: { x: 445, y: 110, a: 'middle' }, cls: 'adi-value big' },
        vs:   { cap: null,                          val: { x: 445, y: 772, a: 'middle' }, cls: 'adi-value' },
        alt:  { cap: null,                          val: { x: 445, y: 838, a: 'middle' }, cls: 'adi-value big' },
        mach: { cap: { x: 64,  y: 40,  a: 'start' }, val: { x: 64,  y: 88,  a: 'start' }, cls: 'adi-value' },
        g:    { cap: { x: 826, y: 40,  a: 'end' },   val: { x: 826, y: 88,  a: 'end' },   cls: 'adi-value' },
        aoa:  { cap: { x: 64,  y: 768, a: 'start' }, val: { x: 64,  y: 816, a: 'start' }, cls: 'adi-value' },
        ralt: { cap: { x: 826, y: 768, a: 'end' },   val: { x: 826, y: 816, a: 'end' },   cls: 'adi-value' },
        gmax: { x: 826, y: 118, a: 'end' },
      },
      wide: {
        hdg:  side(ADI_L, ADI_ROW[0], ADI_GAP, 'end',   'adi-value wide'),
        tas:  side(ADI_L, ADI_ROW[1], ADI_GAP, 'end',   'adi-value big wide'),
        mach: side(ADI_L, ADI_ROW[2], ADI_GAP, 'end',   'adi-value wide'),
        aoa:  side(ADI_L, ADI_ROW[3], ADI_GAP, 'end',   'adi-value wide'),
        alt:  side(ADI_R, ADI_ROW[0], ADI_GAP, 'start', 'adi-value big wide'),
        vs:   side(ADI_R, ADI_ROW[1], ADI_GAP, 'start', 'adi-value wide'),
        g:    side(ADI_R, ADI_ROW[2], ADI_GAP, 'start', 'adi-value wide'),
        ralt: side(ADI_R, ADI_ROW[3], ADI_GAP, 'start', 'adi-value wide'),
        gmax: { x: ADI_R + 150, y: ADI_ROW[2] + ADI_GAP, a: 'start' },
      },
    },
  };

  // HSI: the heading box, lubber line, compass card and turn-trend arc span x 91..799, y 44..824.
  // Wide: navigation to the target on the left (where to, its bearing, how far, how long), the course
  // and own flight on the right — the same sides as the stock corners.
  const HSI_ROW = [120, 315, 510, 705], HSI_GAP = 66, HSI_L = 60, HSI_R = 830;
  const HSI = {
    view: { tall: { x: 56, y: 14, w: 778, h: 862 }, wide: { x: -260, y: 30, w: 1400, h: 805 } },
    capCls: { tall: 'hsi-label', wide: 'hsi-label wide' },
    pos: {
      tall: {
        to:   side(64,  40,  48, 'start', 'hsi-value nav'),
        brg:  side(64,  128, 48, 'start', 'hsi-value nav'),
        crs:  side(826, 40,  48, 'end',   'hsi-value course'),
        xtk:  side(826, 128, 48, 'end',   'hsi-value course'),
        dist: side(64,  734, 48, 'start', 'hsi-value nav'),
        ete:  side(64,  816, 48, 'start', 'hsi-value nav'),
        turn: side(826, 734, 48, 'end',   'hsi-value'),
        tas:  side(826, 816, 48, 'end',   'hsi-value'),
      },
      wide: {
        to:   side(HSI_L, HSI_ROW[0], HSI_GAP, 'end',   'hsi-value nav wide'),
        brg:  side(HSI_L, HSI_ROW[1], HSI_GAP, 'end',   'hsi-value nav wide'),
        dist: side(HSI_L, HSI_ROW[2], HSI_GAP, 'end',   'hsi-value nav wide'),
        ete:  side(HSI_L, HSI_ROW[3], HSI_GAP, 'end',   'hsi-value nav wide'),
        crs:  side(HSI_R, HSI_ROW[0], HSI_GAP, 'start', 'hsi-value course wide'),
        xtk:  side(HSI_R, HSI_ROW[1], HSI_GAP, 'start', 'hsi-value course wide'),
        turn: side(HSI_R, HSI_ROW[2], HSI_GAP, 'start', 'hsi-value wide'),
        tas:  side(HSI_R, HSI_ROW[3], HSI_GAP, 'start', 'hsi-value wide'),
      },
    },
  };

  const INSTRUMENTS = { adi: ADI, hsi: HSI };

  // The drawing's scale in a w x h pane for one arrangement (SVG meet: the tighter axis wins).
  function scaleFor(name, size, w, h) {
    const v = INSTRUMENTS[name].view[size];
    return Math.min(Math.max(0, w || 0) / v.w, Math.max(0, h || 0) / v.h);
  }

  // layoutFor(name, w, h) -> { size: 'tall' | 'wide', viewBox: 'x y w h', scale, pos, capCls }
  function layoutFor(name, w, h) {
    const ins = INSTRUMENTS[name];
    const size = scaleFor(name, 'wide', w, h) > scaleFor(name, 'tall', w, h) ? 'wide' : 'tall';
    const v = ins.view[size];
    return { size: size, viewBox: v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h, scale: scaleFor(name, size, w, h),
             pos: ins.pos[size], capCls: ins.capCls[size] };
  }

  const api = { INSTRUMENTS: INSTRUMENTS, scaleFor: scaleFor, layoutFor: layoutFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarAvnLayout = api;
})(typeof self !== 'undefined' ? self : this);
