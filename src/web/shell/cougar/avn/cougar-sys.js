// The COUGAR layout's SYS page (cougar-sys.html): pages/afm/afm.js unchanged, with a few of its
// functions wrapped. Every pane is laid out across (CougarSysLayout): the status toggles as a block of
// chips on the left (with their icons where the pane has room), the name and the top-down drawing in
// the middle, and the weapons as a text list that scrolls by itself (CougarAutoscroll), on the right
// in a short pane or in a band across the bottom where that draws the aircraft larger.
//
// afm.js is a classic script, so its functions and the state they read are globals shared with this
// one, and every stock caller finds a wrapper by name:
//   layoutAfmFrame   the three columns, in place of the stock stack. The stock painters (damage,
//                    failures) keep working on the drawing it places.
//   renderAfm        the stock render, then the side columns' visibility (hidden with no aircraft).
//   paintAfmPylons / paintAfmLoadout   the stock paint, then the weapon list from the same data.
// The status chips are the stock toggle buttons, moved into the status block, so their lit states
// (and clicks, the mouse fallback) are the stock ones.
(function () {
  const stock = { render: renderAfm, pylons: paintAfmPylons, loadout: paintAfmLoadout };
  const body = document.body;

  const status = document.createElement('div');
  status.className = 'sys-status';
  const weapons = document.createElement('div');
  weapons.className = 'sys-weapons';
  const weaponList = document.createElement('div');
  weaponList.className = 'sys-weapon-list';
  weapons.appendChild(weaponList);
  afmPanel.appendChild(status);
  afmPanel.appendChild(weapons);

  AFM_FLAGS.forEach(function (f) { status.appendChild(f.el); });
  let layout = { fs: 13 };
  CougarAutoscroll.attach(weapons, function () { return layout.fs * 0.9; });

  window.layoutAfmFrame = function () {
    const panel = afmPanel.getBoundingClientRect();
    const lines = CougarSysLayout.weaponLines(afmData, afmLoadoutMode());
    layout = CougarSysLayout.layoutFor(panel.width, panel.height, lines.length);
    body.classList.toggle('sys-icons', layout.icons);
    body.classList.toggle('sys-below', layout.weapons === 'below');
    layoutColumns(panel, layout);
    paintWeapons(true);
  };

  window.renderAfm = function () {
    stock.render();
    syncColumns();
  };
  window.paintAfmPylons = function (force) {
    stock.pylons(force);
    paintWeapons(force);
  };
  window.paintAfmLoadout = function (force) {
    stock.loadout(force);
    paintWeapons(force);
  };

  function syncColumns() {
    status.hidden = weapons.hidden = !afmData.name;
  }
  // afm.js's own first render (its empty state) ran before this script; match it.
  syncColumns();

  // afm.js re-renders on a window resize, which can arrive mid-way through a split change before the
  // pane has its final size; the panel's own size is watched as well.
  if (typeof ResizeObserver === 'function') new ResizeObserver(function () { window.renderAfm(); }).observe(afmPanel);

  function layoutColumns(panel, l) {
    const set = function (name, v) { afmPanel.style.setProperty(name, v); };
    set('--sys-pad', l.pad + 'px');
    set('--sys-fs', l.fs + 'px');
    set('--sys-name-fs', l.nameFs + 'px');
    set('--sys-left', l.middleL + 'px');
    set('--sys-right', l.middleR + 'px');

    status.style.width = l.leftW + 'px';
    status.style.height = l.statusH + 'px';
    status.style.gridTemplateColumns = 'repeat(' + l.statusCols + ', minmax(0, 1fr))';
    // Beside the drawing: a column on the right. Below: a band across the bottom.
    weapons.style.width = l.weapons === 'side' ? l.rightW + 'px' : '';
    weapons.style.height = l.weapons === 'below' ? l.bandH + 'px' : '';

    fitAfmName(l.middleW - 2 * AFM_NAME_PAD);
    const top = (afmHeaderEl.getBoundingClientRect().bottom - panel.top) + 2;
    afmFrame.style.top    = top + 'px';
    afmFrame.style.bottom = 'auto';
    afmFrame.style.height = Math.max(0, l.pad + l.statusH - top) + 'px';
  }

  // Rebuilds the list when its lines change; recolours in place when only a state does.
  let weaponsKey = null;
  function paintWeapons(force) {
    const lines = CougarSysLayout.weaponLines(afmData, afmLoadoutMode());
    const key = JSON.stringify(lines);
    if (!force && key === weaponsKey) return;
    weaponsKey = key;
    if (weaponList.children.length !== lines.length) {
      weaponList.textContent = '';
      lines.forEach(function () {
        const row = document.createElement('div');
        row.className = 'sys-weapon';
        weaponList.appendChild(row);
      });
    }
    lines.forEach(function (line, i) {
      const row = weaponList.children[i];
      if (row.textContent !== line.t) row.textContent = line.t;
      row.style.color = AFM_PYLON_COLOR[line.s] || AFM_PYLON_COLOR.empty;
    });
    markSeparators();
  }

  // In the band, a pipe goes between two weapons on the same line, never at a line's start. Where
  // a line wraps is the browser's call, so: pipe every weapon after the first, then drop the pipe
  // from each one that starts a line. Dropping a pipe narrows its weapon, which can pull it back
  // onto the line above, so repeat until nothing moves (a few passes at most).
  function markSeparators() {
    const rows = Array.prototype.slice.call(weaponList.children);
    const below = body.classList.contains('sys-below');
    rows.forEach(function (row, i) { row.classList.toggle('sep', below && i > 0); });
    if (!below) return;
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let i = 1; i < rows.length; i++) {
        const sameLine = rows[i].offsetTop === rows[i - 1].offsetTop;
        if (rows[i].classList.contains('sep') !== sameLine) { rows[i].classList.toggle('sep', sameLine); changed = true; }
      }
      if (!changed) break;
    }
  }
})();
