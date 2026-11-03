// The Cougar layout's OSB frame (docs/cougar-mfd.md), as data. Pure: no DOM, so cougar-osb.test.js
// pins it in Node.
//
// The frame is an F-16-style MFD: five OSBs per side and a rocker at each corner. OSBs are named by
// edge and position, T1-T5 and B1-B5 left to right, L1-L5 and R1-R5 top to bottom. Rockers are named
// by corner only (tl/tr/bl/br): Thrustmaster and WinWing label them differently.
//
// The grid is rotated against CLASSIC's: the shell keys take the middle three of each side column and
// page labels take the top and bottom rows, so a stacked split gives each pane its own row plus the end
// key of each side column on its side — seven keys. Paging and +/- live on the rockers, which are
// required bindings, so no face key is ever spent on them.
(function (root) {
  const TOP    = ['T1', 'T2', 'T3', 'T4', 'T5'];
  const BOTTOM = ['B1', 'B2', 'B3', 'B4', 'B5'];
  const LEFT   = ['L1', 'L2', 'L3', 'L4', 'L5'];
  const RIGHT  = ['R1', 'R2', 'R3', 'R4', 'R5'];
  const ALL    = TOP.concat(BOTTOM, LEFT, RIGHT);

  // The shell's own keys: arrangement on the left, split presets on the right.
  const SHELL_KEYS = {
    L2: 'full',
    L3: 'pin',
    L4: 'swap',
    R2: 'split-tw',   // top pane wide (2:1)
    R3: 'split',      // 50/50
    R4: 'split-bw',   // bottom pane wide (1:2)
  };

  // Split presets: the top pane's share of the height. 'full' is the unsplit view.
  const SPLITS = { 'split-tw': 'tw', 'split': 'h', 'split-bw': 'bw' };
  const SPLIT_SHARE = { tw: 2 / 3, h: 1 / 2, bw: 1 / 3 };

  // The keys a pane owns, in the order a page's items fill them. A page's first item (MAIN on nearly
  // every page) is always the top-left key of its pane. Full view fills the top row and the upper side
  // keys before the bottom row, so a page's first seven items sit on the same keys in full view as in
  // the top pane of a split, and its last ones (settings, see PRIORITY) fall to the bottom row.
  const PANE_SLOTS = {
    full:   TOP.concat(['L1', 'R1'], BOTTOM, ['L5', 'R5']),
    top:    TOP.concat(['L1', 'R1']),
    bottom: BOTTOM.concat(['L5', 'R5']),
  };

  // The order a page's items fill its keys, by action: the most-used first, settings last. A pane
  // holds seven keys, so the first seven are what a split pane shows without paging. Actions not
  // listed (an extension's own page on MAIN, say) follow the listed ones in their given order.
  //   main — the flight pages, then mission data, squads, extensions, and CFG last.
  //   map/tgp — controls before their CFG page. Full view pins these pages' keys instead (FULL_PINS),
  //             so this order is what a split pane flows.
  const PRIORITY = {
    main: ['map', 'tgp', 'wpn', 'rdr', 'rwr', 'tgt', 'adi', 'akf', 'sqd', 'ext', 'hud'],
    map:  ['main', 'flw', 'grid', 'wpt', 'slew', 'rt-next', 'rt-prev', 'wpt-next', 'wpt-prev', 'mapcfg'],
    tgp:  ['main', 'tgp-manual-toggle', 'tgp-point-track', 'tgp-manual-reset', 'tgp-mark-steerpoint',
           'tgp-view-wtv', 'tgp-view-stv', 'tgp-ir-off', 'tgp-ir-on', 'tgpcfg'],
  };
  function order(page, items) {
    const pri = PRIORITY[page];
    if (!pri) return (items || []).slice();
    const rank = function (item) { const i = pri.indexOf(item.action); return i === -1 ? pri.length : i; };
    return (items || []).map(function (item, i) { return { item: item, i: i }; })
      .sort(function (a, b) { return rank(a.item) - rank(b.item) || a.i - b.i; })
      .map(function (x) { return x.item; });
  }

  // Which pane each corner rocker belongs to in a split. In full view the bottom pair is the
  // display's own brightness (bottom-left) and contrast (bottom-right) instead.
  const ROCKER_PANE = { tl: 'top', tr: 'top', bl: 'bottom', br: 'bottom' };

  // A page's natural +/-, which goes on its pane's left rocker instead of two face keys. `minus` and
  // `plus` are the page's own actions; the shell decides how to send them. A page with no entry has
  // a blank rocker.
  //   map      — zoom, the same Z-/Z+ NAV.map carries
  //   rdr/hsd  — range, NAV's R-/R+ (rng-out widens, rng-in narrows)
  //   tgp      — manual camera zoom steps
  //   scroll   — pages that scroll on the PAD cursor's zoom-in/zoom-out (down/up)
  const SCROLL = { caption: 'SCRL', minus: 'zoom-out', plus: 'zoom-in', minusLabel: '▲', plusLabel: '▼' };
  const ROCKER_PM = {
    map: { caption: 'ZOOM',  minus: 'zout',          plus: 'zin',          minusLabel: 'Z-', plusLabel: 'Z+' },
    rdr: { caption: 'RANGE', minus: 'rng-out',       plus: 'rng-in',       minusLabel: 'R-', plusLabel: 'R+' },
    hsd: { caption: 'RANGE', minus: 'rng-out',       plus: 'rng-in',       minusLabel: 'R-', plusLabel: 'R+' },
    tgp: { caption: 'ZOOM',  minus: 'tgp-zoom-out',  plus: 'tgp-zoom-in',  minusLabel: 'Z-', plusLabel: 'Z+' },
    tgt: SCROLL, td: SCROLL, hud: SCROLL, wpt: SCROLL, rtd: SCROLL, spd: SCROLL, sqd: SCROLL, doc: SCROLL,
  };

  // Actions a page's rocker already carries, so they never also take a face key.
  function rockerActions(page) {
    const r = ROCKER_PM[page];
    return r ? [r.minus, r.plus] : [];
  }

  // Place a page's items on a pane's keys.
  //   items — [{label, action, osb?}]; an item with `osb` is pinned to that key (it must be one the
  //           pane owns), the rest fill the remaining keys in order.
  //   pane  — 'full' | 'top' | 'bottom'
  //   page  — 0-indexed page of the flowed items, clamped
  // Returns { placed: [{osb, item}], page, pages }. Pinned items show on every page; only the
  // flowed ones are paged, a pane's free keys at a time. Paging is the rocker's job, so it costs no key.
  function place(items, pane, page) {
    const slots = PANE_SLOTS[pane] || PANE_SLOTS.full;
    const pinned = [], flowed = [];
    (items || []).forEach(function (item) {
      if (item.osb && slots.indexOf(item.osb) !== -1) pinned.push(item);
      else if (!item.osb) flowed.push(item);
    });
    const taken = pinned.map(function (item) { return item.osb; });
    const free = slots.filter(function (s) { return taken.indexOf(s) === -1; });
    const per = Math.max(1, free.length);
    const pages = Math.max(1, Math.ceil(flowed.length / per));
    const cur = Math.min(Math.max(page | 0, 0), pages - 1);
    const placed = pinned.map(function (item) { return { osb: item.osb, item: item }; });
    flowed.slice(cur * per, cur * per + per).forEach(function (item, i) {
      placed.push({ osb: free[i], item: item });
    });
    return { placed: placed, page: cur, pages: pages };
  }

  // Pinned placements for pages whose keys must not move when an item comes or goes. A physical key
  // is learned by position, so MAP's route keys keep their buttons even while hidden for want of a
  // route. Keyed by action; pane 'full' only — a split pane flows them instead.
  // Settings take the bottom-right key (B5), as on MAIN.
  const FULL_PINS = {
    map: { main: 'T1', flw: 'T2', grid: 'T3', wpt: 'T4', slew: 'T5',
           'rt-next': 'B1', 'rt-prev': 'B2', 'wpt-next': 'B3', 'wpt-prev': 'B4', mapcfg: 'B5' },
    tgp: { main: 'T1', 'tgp-manual-toggle': 'T2', 'tgp-point-track': 'T3', 'tgp-manual-reset': 'T4', 'tgp-mark-steerpoint': 'T5',
           'tgp-view-wtv': 'B1', 'tgp-view-stv': 'B2', 'tgp-ir-off': 'B3', 'tgp-ir-on': 'B4', tgpcfg: 'B5' },
    wpn: { main: 'T1', 'master-arms-on': 'B1', 'master-arms-off': 'B2', 'combat-mode-aa': 'B4', 'combat-mode-ag': 'B5' },
  };

  function pinFor(page, pane, action) {
    if (pane !== 'full') return undefined;
    const pins = FULL_PINS[page];
    return pins ? pins[action] : undefined;
  }

  // Step a bounded display setting (brightness, contrast) by one notch, rounded so repeated steps
  // don't drift in floating point.
  const DISPLAY = {
    brightness: { min: 0.2, max: 1.3, step: 0.1, def: 1 },
    contrast:   { min: 0.5, max: 1.5, step: 0.1, def: 1 },
  };
  function stepDisplay(kind, value, dir) {
    const d = DISPLAY[kind];
    const v = typeof value === 'number' && isFinite(value) ? value : d.def;
    const next = Math.round((v + dir * d.step) * 10) / 10;
    return Math.min(d.max, Math.max(d.min, next));
  }

  // A profile name from the URL or the picker: trimmed, upper-cased, letters/digits/space/-/_ only,
  // at most 24 characters. '' means no usable name.
  function profileName(raw) {
    return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 24);
  }

  const api = {
    TOP: TOP, BOTTOM: BOTTOM, LEFT: LEFT, RIGHT: RIGHT, ALL: ALL,
    SHELL_KEYS: SHELL_KEYS, SPLITS: SPLITS, SPLIT_SHARE: SPLIT_SHARE,
    PANE_SLOTS: PANE_SLOTS, ROCKER_PANE: ROCKER_PANE, ROCKER_PM: ROCKER_PM, FULL_PINS: FULL_PINS,
    PRIORITY: PRIORITY, DISPLAY: DISPLAY,
    rockerActions: rockerActions, order: order, place: place, pinFor: pinFor, stepDisplay: stepDisplay, profileName: profileName,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarOsb = api;
})(typeof self !== 'undefined' ? self : this);
