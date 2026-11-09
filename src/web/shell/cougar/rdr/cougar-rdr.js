// The COUGAR layout's FCR page (cougar-rdr.html): CougarScope over pages/rdr/rdr.js. The crop is the
// B-scope frame (60..460 x 70..510 in rdr.js's geometry) with the ownship caret under it.
CougarScope.init({
  panel: document.querySelector('.rdr-panel'),
  svg: document.querySelector('.rdr-scope'),
  stockVB: { x: 0, y: 0, w: 520, h: 600 },
  crop: function () { return { x: 50, y: 62, w: 420, h: 478 }; },
  left: [
    { ids: ['rdr-mode'], cls: 'big' },
    { ids: ['rdr-range'] },
    { ids: ['rdr-azl', 'rdr-azr'], join: ' / ', cls: 'dim' },
  ],
  right: [
    { ids: ['rdr-lk'] },
    { ids: ['rdr-r1'], cls: 'lock' },
    { ids: ['rdr-r2'], cls: 'lock', split: true },
  ],
});
