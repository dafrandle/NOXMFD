// The COUGAR layout's TGT LIST page (cougar-tgt-list.html): enemy contacts, filtered and ordered by
// CougarTgtList, one per frame key, each drawn beside its key with a line to it. A key press locks or
// unlocks its contact (target.select / target.deselect, as FCR/HSD/MAP do); a long press locks every
// contact on the page, or unlocks them all once they all are. The shell's rockers step the filter
// and the page.
(function () {
  const M = CougarTgtList;
  const panel = document.getElementById('tl-panel');
  const entriesEl = document.getElementById('tl-entries');
  const linesEl = document.getElementById('tl-lines');
  const filterEl = document.getElementById('tl-filter');
  const pageEl = document.getElementById('tl-page');
  const centre = document.getElementById('tl-centre');
  const SVG = 'http://www.w3.org/2000/svg';

  let frame = null, rings = [], td = [];
  let pane = 'full', sideY = null;
  let filter = 0, pageIndex = 0;
  let items = [];
  let lastState = '';   // what the shell last heard (only changes are sent)
  // A lock or unlock just sent shows at once, until a frame confirms it (or a short time passes).
  const pending = new Map();
  const PENDING_MS = 1500;

  function slotKeys() {
    if (pane === 'top') return ['T1', 'T2', 'T3', 'T4', 'T5'];
    if (pane === 'bottom') return ['B1', 'B2', 'B3', 'B4', 'B5'];
    return ['T1', 'T2', 'T3', 'T4', 'T5', 'B1', 'B2', 'B3', 'B4', 'B5', 'L5', 'R5'];
  }

  function lockedNow(c) {
    const p = pending.get(c.id);
    if (p && performance.now() - p.at < PENDING_MS && p.locked !== c.locked) return p.locked;
    pending.delete(c.id);
    return c.locked;
  }

  function fmtRange(m) {
    const metric = !frame || frame.metric !== false;
    const v = metric ? m / 1000 : m / 1852;
    return (v < 10 ? v.toFixed(1) : Math.round(v)) + (metric ? ' km' : ' nm');
  }
  function pad3(deg) { return String(Math.round(deg) % 360).padStart(3, '0') + '°'; }

  function tags(c) {
    const t = [];
    if (c.rwrTier === 2) t.push(['LCK', 'threat']);
    else if (c.rwrTier === 1) t.push(['TRK', 'threat']);
    else if (c.rwrTier === 0) t.push(['SRC', 'warn']);
    if (c.inRing) t.push(['IN RNG', 'threat']);
    if (c.close) t.push(['CLOSE', 'threat']);
    else if (c.six) t.push(['SIX', 'threat']);
    else if (c.hot && (c.c === 'a' || c.ac)) t.push(['HOT', 'warn']);
    if (c.td) t.push(['TD', 'info']);
    // Datalink-only (no friendly sensor sees it now) counts as stale here too.
    if (c.stale || c.datalink) t.push(['STALE', 'dim']);
    if (c.jammed) t.push(['JAM', 'dim']);
    return t;
  }

  function render() {
    const inputs = {
      contacts: frame && Array.isArray(frame.contacts) ? frame.contacts : [],
      own: { x: frame && frame.world ? frame.world.x : 0, z: frame && frame.world ? frame.world.z : 0, hdg: frame ? frame.hdg || 0 : 0 },
      rwr: frame && Array.isArray(frame.rwr) ? frame.rwr : [],
      rings: rings, td: td,
    };
    const list = M.build(inputs, filter);
    const keys = slotKeys();
    const pg = M.page(list, pageIndex, pane === 'full' ? M.PER_PAGE.full : M.PER_PAGE.split);
    pageIndex = pg.page;
    items = pg.items.map(function (c) { return Object.assign({}, c, { locked: lockedNow(c) }); });

    const f = M.FILTERS[((filter % M.FILTERS.length) + M.FILTERS.length) % M.FILTERS.length];
    filterEl.textContent = f.label;
    pageEl.textContent = 'PAGE ' + (pg.page + 1) + '/' + pg.pages + ' · ' + list.length + (list.length === 1 ? ' CONTACT' : ' CONTACTS');
    panel.classList.toggle('pane-top', pane === 'top');
    panel.classList.toggle('pane-bottom', pane === 'bottom');
    layout(keys);

    const state = { mfd: true, type: 'list-state', filter: f.label, page: pg.page, pages: pg.pages,
                    count: list.length, slots: items.map(function (c) { return { locked: c.locked }; }) };
    const key = JSON.stringify(state);
    if (key !== lastState) { lastState = key; window.parent.postMessage(state, '*'); }
  }

  // Each entry beside its key: under a top key, over a bottom key, in from a side key, and a line
  // from the key's point on the pane edge to the entry. Its tags hang out of it as a list on the side
  // away from its key: below a top-row entry, above a bottom-row one and above L5/R5's, which sit
  // high enough to clear the bottom row's tags.
  const PILL_H = 17, PILL_ROOM = 3 * PILL_H;
  function layout(keys) {
    const W = panel.clientWidth, H = panel.clientHeight;
    const col = W / 5, lead = 12, gap = 4;
    const full = pane === 'full';
    const entryH = full
      ? Math.max(56, Math.min(86, Math.floor((H - 2 * lead - 2 * PILL_ROOM - 48) / 2)))
      : Math.max(56, Math.min(86, H - 2 * lead - PILL_ROOM - 44));
    // Whole pixels, so the tags' text (see pills) lands on pixel columns.
    const entryW = Math.floor(col - 2 * gap);
    entriesEl.textContent = '';
    while (linesEl.firstChild) linesEl.removeChild(linesEl.firstChild);
    linesEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const bottomY = H - lead - entryH;

    keys.forEach(function (key, i) {
      const c = items[i];
      if (!c) return;
      const n = +key.slice(1) - 1;
      let x, y, kx, ky, lx, ly, pillsDown;
      if (key[0] === 'T') { x = Math.round(n * col + gap); y = lead; kx = (n + 0.5) * col; ky = 0; lx = kx; ly = y; pillsDown = true; }
      else if (key[0] === 'B') { x = Math.round(n * col + gap); y = bottomY; kx = (n + 0.5) * col; ky = H; lx = kx; ly = y + entryH; pillsDown = false; }
      else {
        // L5 / R5: above the bottom row's tags, with room for their own above them.
        ky = sideY != null ? sideY : H * 0.9;
        y = Math.max(lead + entryH + PILL_ROOM + gap + PILL_ROOM, bottomY - PILL_ROOM - gap - entryH);
        x = key === 'L5' ? lead : Math.round(W - lead - entryW);
        kx = key === 'L5' ? 0 : W;
        lx = key === 'L5' ? x : x + entryW;
        ly = y + entryH / 2;
        pillsDown = false;
      }
      entriesEl.appendChild(entry(c, x, y, entryW, entryH));
      const t = tags(c);
      if (t.length) entriesEl.appendChild(pills(t, x, pillsDown ? y + entryH + 2 : null, pillsDown ? null : H - y + 2, entryW));
      const line = document.createElementNS(SVG, 'line');
      line.setAttribute('x1', kx); line.setAttribute('y1', ky);
      line.setAttribute('x2', lx); line.setAttribute('y2', ly);
      line.setAttribute('class', c.locked ? 'locked' : '');
      linesEl.appendChild(line);
    });

    // The centre block between the rows' tags (or below / above a split pane's single row).
    const top = pane === 'bottom' ? lead : lead + entryH + PILL_ROOM + gap;
    const bottom = pane === 'top' ? H - lead : bottomY - PILL_ROOM - gap;
    centre.style.top = top + 'px';
    centre.style.height = Math.max(0, bottom - top) + 'px';
    // Too short for the three lines (a 1/3 pane): filter and page on one line, no hint, so the text
    // keeps clear of the tags and the split line.
    centre.classList.remove('tight');
    if (centre.scrollHeight > centre.clientHeight) centre.classList.add('tight');
  }

  // An entry's vertical budget (.tl-entry's CSS): border + padding, a name / range line, the icon row,
  // and the bearing circle's size range.
  const ENTRY_CHROME = 7, ENTRY_LINE = 13, ICON_H = 18, BRG_MIN = 12, BRG_MAX = 22, ROW_GAP = 4;

  // What each unit's /icon gave: 'missing' once it has failed, so a rebuild (every frame) draws the
  // square straight away instead of a fresh image that's blank until its request fails again.
  const iconState = {};

  // An entry, top to bottom: the unit's icon (a hollow square when there's none) when the entry has
  // room for it, its name, its range, and a circle whose radius points at its bearing relative to the
  // nose (up = dead ahead), with the bearing beside it.
  function entry(c, x, y, w, h) {
    const el = document.createElement('div');
    // Its RWR state behind it (locking us / tracking us), whether or not we've selected it.
    el.className = 'tl-entry' + (c.locked ? ' locked' : '') +
      (c.rwrTier === 2 ? ' locking-us' : c.rwrTier === 1 ? ' tracking-us' : '') +
      (c.stale || c.datalink ? ' dim' : '');
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.width = w + 'px'; el.style.height = h + 'px';

    // Room left under the name and range: the icon only if the bearing circle still gets its minimum.
    const avail = h - ENTRY_CHROME - 2 * ENTRY_LINE;
    const showIcon = avail >= ICON_H + BRG_MIN + ROW_GAP;
    let iconBox = null;
    if (showIcon) {
      iconBox = document.createElement('div');
      iconBox.className = 'tl-icon-box';
      const noIcon = function () {
        const sq = document.createElement('span');
        sq.className = 'tl-noicon';
        return sq;
      };
      if (iconState[c.name] === 'missing') iconBox.appendChild(noIcon());
      else {
        const icon = document.createElement('img');
        icon.className = 'tl-icon';
        icon.alt = '';
        icon.onerror = function () { iconState[c.name] = 'missing'; icon.replaceWith(noIcon()); };
        icon.src = '/icon?type=' + encodeURIComponent(c.name);
        iconBox.appendChild(icon);
      }
    }

    const name = document.createElement('div');
    name.className = 'tl-name';
    name.textContent = c.name || '?';
    const range = document.createElement('div');
    range.className = 'tl-range';
    range.textContent = fmtRange(c.range);

    const brg = document.createElement('div');
    brg.className = 'tl-brg';
    const size = Math.max(BRG_MIN, Math.min(BRG_MAX, avail - (showIcon ? ICON_H : 0) - ROW_GAP));
    const r = size / 2 - 1, cx = size / 2, cy = size / 2, a = c.rel * Math.PI / 180;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('aria-hidden', 'true');
    function svgEl(tag, attrs, cls) {
      const e = document.createElementNS(SVG, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (cls) e.setAttribute('class', cls);
      svg.appendChild(e);
    }
    svgEl('circle', { cx: cx, cy: cy, r: r });
    svgEl('line', { x1: cx, y1: cy - r, x2: cx, y2: cy - r + 2.5 }, 'nose');
    svgEl('line', { x1: cx, y1: cy, x2: (cx + r * Math.sin(a)).toFixed(2), y2: (cy - r * Math.cos(a)).toFixed(2) }, 'dir');
    brg.appendChild(svg);
    const num = document.createElement('span');
    num.textContent = pad3(c.bearing);
    brg.appendChild(num);

    if (iconBox) el.append(iconBox);
    el.append(name, range, brg);
    return el;
  }

  // The tags as a list hanging out of the entry: down from its bottom edge (top) or up from its top
  // edge (bottom: distance from the pane's bottom). Each tag's text is centred by a whole-pixel left
  // pad (its letters are TAG_ADV px apart, see .tl-tag) so no letter straddles two pixel columns.
  const TAG_ADV = 7;
  function pills(t, x, top, bottom, w) {
    const el = document.createElement('div');
    el.className = 'tl-pills' + (bottom != null ? ' up' : '');
    el.style.left = x + 'px';
    el.style.width = w + 'px';
    if (top != null) el.style.top = top + 'px';
    else el.style.bottom = bottom + 'px';
    t.forEach(function (tg) {
      const p = document.createElement('span');
      p.className = 'tl-tag ' + tg[1];
      p.textContent = tg[0];
      p.style.paddingLeft = Math.max(0, Math.floor((w - 2 - tg[0].length * TAG_ADV) / 2)) + 'px';
      el.appendChild(p);
    });
    return el;
  }

  function send(id, lock) {
    pending.set(id, { locked: lock, at: performance.now() });
    sendCommand(lock ? 'target.select' : 'target.deselect', { id: id }).catch(function () { pending.delete(id); render(); });
  }
  function pick(slot) {
    const c = items[slot];
    if (!c) return;
    send(c.id, !c.locked);
    render();
  }
  function pickAll() {
    const t = M.pageToggle(items);
    t.select.forEach(function (id) { send(id, true); });
    t.deselect.forEach(function (id) { send(id, false); });
    render();
  }

  window.addEventListener('message', function (e) {
    const m = e.data;
    if (!m || m.mfd !== true) return;
    if (m.type === 'map-frame') { if (m.data) { frame = m.data; render(); } return; }
    if (m.type === 'hsd') { rings = Array.isArray(m.threats) ? m.threats : []; return; }
    if (m.type === 'td-state-push') {
      const st = (m.data && m.data.state) || {};
      const ids = Object.keys(st.assignments || {}).map(Number);
      (st.designated || []).forEach(function (d) { ids.push(typeof d === 'object' && d ? d.id : d); });
      td = ids.filter(function (id) { return id > 0; });
      render();
      return;
    }
    if (m.type === 'list-pane') { pane = m.pane || 'full'; sideY = typeof m.sideY === 'number' ? m.sideY : null; render(); return; }
    switch (m.action) {
      case 'list-pick':        pick(m.slot | 0); break;
      case 'list-pick-all':    pickAll(); break;
      case 'list-filter-prev': filter--; pageIndex = 0; render(); break;
      case 'list-filter-next': filter++; pageIndex = 0; render(); break;
      case 'list-page-prev':   pageIndex--; render(); break;
      case 'list-page-next':   pageIndex++; render(); break;
    }
  });
  window.addEventListener('resize', render);
  render();
})();
