// The COUGAR layout's radar scope pages (cougar-rdr.html, cougar-hsd.html): the stock page script
// (pages/rdr/rdr.js or pages/hsd/hsd.js) runs unchanged; CougarScope.init lays it out to the pane by
// CougarScopeLayout. In the wide arrangement the SVG is cropped to the scope and sits between two
// text columns that mirror the page's own SVG readouts (which are hidden there), so the readouts are
// sized for the pane instead of scaled down with the drawing.
//
// The stock scripts map panel px to viewBox units through a global viewport() (and HSD's cursor clamp
// through scopeRectPx()), written for their stock, uncropped viewBox filling the panel. Both are
// classic scripts, so their top-level functions are globals every stock caller finds by name: init
// replaces viewport() with one for whatever viewBox and box the SVG has now, and, for a page whose
// clamp rect is the whole viewBox (`ownsScopeRect`), scopeRectPx() too. Clicks, the PAD cursor, its
// gate and the cursor zoom all keep hitting what's drawn under them.
(function (root) {
  // cfg: {
  //   panel, svg     the page's panel element and its scope <svg>
  //   stockVB        the stock viewBox { x, y, w, h }
  //   crop()         the scope-only viewBox for the page's current state
  //   left, right    the columns' lines: [{ ids: [source text element ids], join, cls, split }]
  //                  join: separator between the ids' texts; cls: 'big' | 'dim' | 'lock';
  //                  split: stack a spaced-out readout (CougarScopeLayout.splitReadout) as lines
  //   ownsScopeRect  replace scopeRectPx() as well (its clamp rect is the whole viewBox)
  // }
  function init(cfg) {
    const L = CougarScopeLayout;
    const body = document.body, panel = cfg.panel, svg = cfg.svg;
    let vb = cfg.stockVB, box = { left: 0, top: 0, W: 0, H: 0 }, laidOut = '';

    root.viewport = function () { return L.viewportFor(vb, box.left, box.top, box.W, box.H); };
    if (cfg.ownsScopeRect) {
      root.scopeRectPx = function () {
        const v = root.viewport();
        return { dx: v.ox + vb.x * v.s, dy: v.oy + vb.y * v.s, dw: vb.w * v.s, dh: vb.h * v.s };
      };
    }

    function apply() {
      const W = panel.clientWidth, H = panel.clientHeight;
      const crop = cfg.crop();
      const l = L.layoutFor(W, H, cfg.stockVB, crop);
      vb = l.wide ? crop : cfg.stockVB;
      box = l.wide ? { left: l.pad + l.colW, top: l.pad, W: W - 2 * (l.pad + l.colW), H: H - 2 * l.pad }
                   : { left: 0, top: 0, W: W, H: H };
      const key = [l.wide, vb.x, vb.y, vb.w, vb.h, box.left, box.top, box.W, box.H, l.fs].join(',');
      if (key === laidOut) return;
      laidOut = key;
      body.classList.toggle('scope-wide', l.wide);
      body.style.setProperty('--scope-fs', l.fs + 'px');
      body.style.setProperty('--scope-col', l.colW + 'px');
      body.style.setProperty('--scope-pad', l.pad + 'px');
      svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
      if (l.wide) {
        svg.style.position = 'absolute';
        svg.style.left = box.left + 'px';
        svg.style.top = box.top + 'px';
        svg.style.width = box.W + 'px';
        svg.style.height = box.H + 'px';
      } else {
        svg.style.position = svg.style.left = svg.style.top = svg.style.width = svg.style.height = '';
      }
    }

    // ── columns ──────────────────────────────────────────────────────────────────────────
    function column(side, lines) {
      const col = document.createElement('div');
      col.className = 'scope-col ' + side;
      panel.appendChild(col);
      return lines.map(function (line) {
        const holder = document.createElement('div');
        holder.className = 'scope-item' + (line.cls ? ' ' + line.cls : '');
        col.appendChild(holder);
        return { line: line, holder: holder, sources: line.ids.map(function (id) { return document.getElementById(id); }) };
      });
    }
    const items = column('left', cfg.left || []).concat(column('right', cfg.right || []));

    function sync() {
      items.forEach(function (it) {
        const text = it.sources.map(function (el) { return el ? el.textContent : ''; })
          .filter(Boolean).join(it.line.join || ' ');
        const parts = it.line.split ? L.splitReadout(text) : (text ? [text] : []);
        if (it.holder.dataset.text === parts.join('\n')) return;
        it.holder.dataset.text = parts.join('\n');
        it.holder.textContent = '';
        parts.forEach(function (p) {
          const row = document.createElement('div');
          row.textContent = p;
          it.holder.appendChild(row);
        });
      });
    }
    // The stock scripts write their readouts as text into the SVG; mirror them as they change.
    let queued = false;
    const observer = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; sync(); });
    });
    items.forEach(function (it) {
      it.sources.forEach(function (el) { if (el) observer.observe(el, { childList: true, characterData: true, subtree: true }); });
    });

    // The pane's size is this page's viewport. A window resize can arrive mid-way through a split
    // change, before the pane has its final size, so the panel's own size is watched as well. The
    // crop can follow page state (HSD's CEN/DEP), which changes on a message.
    root.addEventListener('resize', apply);
    if (typeof ResizeObserver === 'function') new ResizeObserver(function () { apply(); }).observe(panel);
    root.addEventListener('message', function () { apply(); });
    apply();
    sync();
  }

  root.CougarScope = { init: init };
})(typeof self !== 'undefined' ? self : this);
