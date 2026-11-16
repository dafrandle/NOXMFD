// The text height the COUGAR layout's text pages (the MD pages, AKF) size their text from: the 1/3
// pane of a stacked split, whatever pane they are in, so a page reads the same in full view, a 2/3
// pane, a 50/50 one or the 1/3 one, and a bigger pane shows more lines rather than bigger ones.
// Pure, so cougar-text.test.js pins it in Node; textHeight() reads the window it is given.
(function (root) {
  // The shell's label rows (cougar.css .glass --band: clamp(36px, 6.5vh, 46px)), top and bottom; the
  // page area between them splits 1/3 : 2/3 in the stacked splits.
  function thirdPaneHeight(windowHeight) {
    const h = Math.max(0, windowHeight || 0);
    const band = Math.min(46, Math.max(36, h * 0.065));
    return Math.max(0, (h - 2 * band) / 3);
  }

  // From a page inside the Cougar shell: the shell's window is the top one. A page opened on its own
  // (or one the browser won't let read its top window) sizes from its own height instead.
  function textHeight(win) {
    try {
      if (win.top && win.top !== win && win.top.document.querySelector('.glass')) return thirdPaneHeight(win.top.innerHeight);
    } catch (e) { /* not readable */ }
    return win.innerHeight;
  }

  const api = { thirdPaneHeight: thirdPaneHeight, textHeight: textHeight };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarText = api;
})(typeof self !== 'undefined' ? self : this);
