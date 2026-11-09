// The COUGAR layout's HSD page (cougar-hsd.html): CougarScope over pages/hsd/hsd.js. The crop follows
// hsd.js's mode: CEN centres the rings (radius 220 about 300,300), DEP puts ownship low (500) under
// rings that run the viewBox's full width.
CougarScope.init({
  panel: document.querySelector('.hsd-panel'),
  svg: document.querySelector('.hsd-scope'),
  stockVB: { x: 0, y: 0, w: 600, h: 600 },
  crop: function () {
    return mode === 'dep' ? { x: 0, y: 70, w: 600, h: 530 } : { x: 70, y: 70, w: 460, h: 460 };
  },
  left: [
    { ids: ['hsd-range'], cls: 'big' },
    { ids: ['hsd-r1'], cls: 'lock' },
    { ids: ['hsd-r2'], cls: 'lock', split: true },
  ],
  right: [
    { ids: ['hsd-link'] },
    { ids: ['hsd-locks'] },
  ],
  // hsd.js's cursor clamp is its whole viewBox, so it follows the crop too.
  ownsScopeRect: true,
});
