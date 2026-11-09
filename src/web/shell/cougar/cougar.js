// COUGAR layout (docs/cougar-mfd.md): a window sized to sit behind a physical F-16-style OSB frame,
// every label beside the frame button that presses it.
//
// Built on the F-35 layout's portal model (f35.js makePortal): a portal is one independent MFD screen —
// a page frame, the state that belongs to that screen, and the labels it puts on its keys. Here a
// portal is a pane of the page area, one in full view and two stacked in a split, and its labels go
// into the shared OSB ring (cougar-osb.js says which keys each pane owns) instead of a grid of its own.
// f35.js is not modified for this layout, so the portal is an adapted copy rather than a shared module.
//
// Data path, as on the F-35: #map-tap owns the only EventSource('/stream') and posts the derived
// per-page slices up here; the shell caches them and each portal replays what its page needs.
(function () {
  const O       = CougarOsb;
  const NAV     = NavModel.NAV;
  const glass   = document.getElementById('glass');
  const panesEl = document.getElementById('panes');
  const mapTap  = document.getElementById('map-tap');

  // ── Profile ──────────────────────────────────────────────────────────────────────────
  // A window is one physical MFD, named in its URL (?mfd=LEFT). The name keys everything this window
  // keeps: its arrangement, its pin and its display settings. localStorage is shared by every window on
  // the origin, which is why the name lives in the URL rather than in storage.
  const PROFILES_KEY = 'cougar-profiles';
  const profile = O.profileName(new URLSearchParams(location.search).get('mfd'));

  function readJson(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function profileList() {
    const l = readJson(PROFILES_KEY);
    return Array.isArray(l) ? l.filter(function (n) { return typeof n === 'string' && O.profileName(n) === n && n; }) : [];
  }
  function openProfile(name) {
    const n = O.profileName(name);
    if (!n) return;
    const list = profileList();
    if (list.indexOf(n) === -1) { list.push(n); writeJson(PROFILES_KEY, list); }
    const url = new URL(location.href);
    url.searchParams.set('mfd', n);
    location.replace(url.toString());
  }

  // The `layout` key is what the CLASSIC and F-35 head guards read to redirect a fresh load. Leaving
  // for one of them records it, as the F-35 does; this document never reads it.
  function setLayout(name) { try { localStorage.setItem('layout', name); } catch (e) {} }

  if (!profile) {
    // No telemetry until the window knows which MFD it is.
    mapTap.remove();
    const picker = document.getElementById('picker');
    const listEl = document.getElementById('picker-list');
    profileList().forEach(function (n) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = n;
      b.addEventListener('click', function () { openProfile(n); });
      li.appendChild(b);
      listEl.appendChild(li);
    });
    document.getElementById('picker-new').addEventListener('submit', function (e) {
      e.preventDefault();
      openProfile(document.getElementById('picker-name').value);
    });
    document.querySelectorAll('.picker-link').forEach(function (a) {
      a.addEventListener('click', function () { setLayout(a.dataset.layout); });
    });
    picker.hidden = false;
    document.getElementById('picker-name').focus();
    return;
  }
  document.title = 'NO XMFD — ' + profile;
  const PROFILE_KEY = 'cougar-profile:' + profile;

  // ── Pages and feeds (as f35.js) ───────────────────────────────────────────────────────
  // The F-35's page table, with LYT told which shell hosts it. MAIN maps to no page (`null`): its
  // destinations are the OSB labels themselves.
  // WPN, the AVN pages, FCR/HSD, AKF and the MD text pages are this layout's own (wpn/, avn/, rdr/,
  // akf/, md/), laid out from a Cougar pane.
  const PAGES = Object.assign({}, LayoutPages.F35, {
    lyt: '/lyt?cougar',
    wpn: '/assets/shell/cougar/wpn/cougar-wpn.html',
    adi: '/assets/shell/cougar/avn/cougar-adi.html',
    avn: '/assets/shell/cougar/avn/cougar-eng.html',
    hsi: '/assets/shell/cougar/avn/cougar-hsi.html',
    afm: '/assets/shell/cougar/avn/cougar-sys.html',
    rdr: '/assets/shell/cougar/rdr/cougar-rdr.html',
    hsd: '/assets/shell/cougar/rdr/cougar-hsd.html',
    akf: '/assets/shell/cougar/akf/cougar-akf.html',
    bdf: '/assets/shell/cougar/md/cougar-bdf.html',
    pal: '/assets/shell/cougar/md/cougar-bdf.html?pal',
    obj: '/assets/shell/cougar/md/cougar-obj.html',
    mis: '/assets/shell/cougar/md/cougar-mis.html',
  });

  const PAGE_FEEDS = {
    avn: ['avn'],
    afm: ['avn'],
    adi: ['adi'],
    hsi: ['adi', 'mapinfo', 'wpt-routes'],
    rwr: ['rwr', 'mw'],
    tgt: ['tgt', 'targets', 'sqd-state', 'td-state-push'],
    td: ['targets', 'sqd-state', 'td-state-push'],
    tgp: ['tgp', 'sysdmg-push'],
    hud: ['hud-options-push'],
    wpn: ['loadout', 'cm'],
    bdf: ['bdf'],
    pal: ['pal'],
    mis: ['mis'],
    obj: ['obj'],
    akf: ['akf'],
    rdr: ['rdr', 'sysdmg-push'],
    hsd: ['hsd', 'mapinfo', 'rdr', 'wpt-routes', 'sysdmg-push'],
    wpt: ['mapinfo', 'wpt-routes', 'sqd-state'],
    rtd: ['mapinfo', 'wpt-routes'],
    spd: ['mapinfo', 'wpt-routes'],
    map: ['map-frame', 'wpt-routes'],
    sqd: ['sqd-state', 'server-players-push'],
    ui: ['themes-push'],
  };
  const FEED_AS = { targets: 'tgt-targets' };
  const DERIVED = { loadout: true };
  const PAD_CURSOR_PAGES = { map: true, tgt: true, td: true, hud: true, rdr: true, wpt: true, rtd: true, spd: true, sqd: true, akf: true, doc: true, hsd: true, tgp: true };

  // MAIN's destinations beyond NAV's, as on the other layouts (f35.js MAIN_EXTRAS).
  const MAIN_EXTRAS = [
    { label: 'CFG', action: 'hud' },
    { label: 'MD', action: 'akf' },
    { label: 'RDR', action: 'rdr' },
    { label: 'SQD', action: 'sqd' },
  ];

  const MAP_ACTIONS = { flw: 'toggle-follow', zin: 'zoom-in', zout: 'zoom-out', grid: 'toggle-grid', slew: 'slew-toggle',
                        'rng-in': 'zoom-in', 'rng-out': 'zoom-out',
                        'rt-next': 'route-next', 'rt-prev': 'route-prev',
                        'wpt-next': 'waypoint-next', 'wpt-prev': 'waypoint-prev',
                        'hsd-mode': 'hsd-mode',
                        'doc-indx': 'doc-indx', 'doc-next': 'doc-next', 'doc-prev': 'doc-prev' };
  const MASTER_ARMS_ACTIONS = { 'master-arms-on': true, 'master-arms-off': false };
  const COMBAT_MODE_ACTIONS = { 'combat-mode-aa': 'aa', 'combat-mode-ag': 'ag' };
  const HOLD_MS = 500;   // matches the other layouts' press-and-hold
  const TGP_VIEW_ACTIONS = { 'tgp-view-stv': true, 'tgp-view-wtv': false };
  const TGP_IR_ACTIONS = { 'tgp-ir-on': true, 'tgp-ir-off': false };
  const TGP_ONESHOT = { 'tgp-manual-toggle': 'tgp.manual-toggle', 'tgp-point-track': 'tgp.point-track',
                        'tgp-manual-reset': 'tgp.manual-reset', 'tgp-mark-steerpoint': 'tgp.mark-steerpoint' };
  const TGP_ZOOM_STEP_INITIAL_DELAY_MS = 350;
  const TGP_ZOOM_STEP_REPEAT_MS = 150;

  // Pictures rather than content a label could cover: in full view they reach under the label ring and
  // the labels sit over them on a scrim (f35.js FULL_BLEED). 'all' takes the whole glass; 'top' keeps
  // clear of the bottom row only, for a page whose own text runs along its bottom edge (MAP's scale and
  // readouts). TGP is absent: its picture carries text all round, so it stays inside the ring; so are
  // FCR and HSD, whose readout columns (rdr/cougar-scope.js) would sit under the side labels.
  const FULL_BLEED = { map: 'top', rwr: 'all' };

  const WPN_MAX_DISPLAY = 5;

  function has(page) { return Object.prototype.hasOwnProperty.call(PAGES, page) || ExtNav.isExtensionPage(page); }
  function feedsFor(page) { return PAGE_FEEDS[page] || (ExtNav.isExtensionPage(page) ? ['ext_' + page] : []); }
  function canDo(action) {
    return has(action) || (action in MAP_ACTIONS) || (action in MASTER_ARMS_ACTIONS) ||
           (action in COMBAT_MODE_ACTIONS) || (action in TGP_VIEW_ACTIONS) || (action in TGP_IR_ACTIONS) ||
           (action in TGP_ONESHOT);
  }

  const slices = Object.create(null);   // the tap's latest message, by type — shared by all portals

  // ── OSB ring ─────────────────────────────────────────────────────────────────────────
  const osbEls = {};
  function osbPlace(id) {
    const n = Number(id.slice(1));
    switch (id[0]) {
      case 'T': return { row: 1, col: n + 1 };
      case 'B': return { row: 7, col: n + 1 };
      case 'L': return { row: n + 1, col: 1 };
      default:  return { row: n + 1, col: 7 };
    }
  }
  O.ALL.forEach(function (id) {
    const el = document.createElement('div');
    const p = osbPlace(id);
    el.className = 'osb';
    el.dataset.osb = id;
    el.style.gridRow = String(p.row);
    el.style.gridColumn = String(p.col);
    glass.appendChild(el);
    osbEls[id] = el;
  });
  const rockerEls = {};
  document.querySelectorAll('.rocker').forEach(function (el) { rockerEls[el.dataset.rocker] = el; });

  // The side columns are as wide as their widest label (as f35.js fitOsb sizes the F-35's columns),
  // so the page area gets the rest.
  function fitSide() {
    let w = 0;
    O.LEFT.concat(O.RIGHT).forEach(function (id) {
      osbEls[id].querySelectorAll('.nav-item').forEach(function (n) { w = Math.max(w, n.scrollWidth, n.offsetWidth); });
    });
    Object.keys(rockerEls).forEach(function (k) {
      rockerEls[k].querySelectorAll('.rocker-halves').forEach(function (n) { w = Math.max(w, n.scrollWidth); });
    });
    const next = Math.max(48, Math.ceil(w) + 6) + 'px';
    if (glass.style.getPropertyValue('--side') === next) return false;
    glass.style.setProperty('--side', next);
    return true;
  }

  function makeButton(label, action, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nav-item' + (cls ? ' ' + cls : '');
    b.textContent = label;
    if (action) b.dataset.action = action;
    return b;
  }

  // ── Portal ───────────────────────────────────────────────────────────────────────────
  // One independent MFD screen in one pane: its page frame, the state that belongs to this screen,
  // and its labels on the keys its pane owns. Adapted from f35.js makePortal.
  function makePortal(onNavRendered) {
    const el    = document.createElement('div');
    const frame = document.createElement('iframe');
    // MAIN has no page of its own (its destinations are the labels), so the pane names the MFD instead:
    // with two or more frames on the desk, the window says which one it is.
    const ident = document.createElement('div');
    el.className    = 'pane';
    frame.className = 'page-frame';
    frame.title     = 'page';
    ident.className = 'pane-ident';
    ident.innerHTML = '<div class="pane-ident-brand">NO XMFD</div><div class="pane-ident-name"></div>';
    ident.querySelector('.pane-ident-name').textContent = profile;
    el.appendChild(frame);
    el.appendChild(ident);
    wireLayoutKeydown(frame);

    let pane        = 'full';
    let currentPage = null;
    let navPage     = 0;     // page of an overflowing label list (MAIN in a split pane)
    let navPages    = 1;
    let wpnPage     = 0;
    let wpnNavKey   = '';
    let wpnSelSeen  = null;
    let followOn    = false;
    let gridOn      = false;
    let slewOn      = false;
    let docView     = 'index';

    // See f35.js pendingNavHoldClear: a hold in progress when the labels are rebuilt must be stopped,
    // or its timer outlives the button it belongs to.
    let pendingHoldClear = null;
    function trackHold(stopFn) {
      const stop = function () { stopFn(); if (pendingHoldClear === stop) pendingHoldClear = null; };
      return stop;
    }

    function frameWin() { return frame.contentWindow; }
    function isMapWin(w) { return currentPage === 'map' && w === frameWin(); }
    function ownKeys() { return O.PANE_SLOTS[pane]; }

    // ── Feeds (f35.js) ─────────────────────────────────────────────────────────────────
    function forwardSlice(type) {
      if (DERIVED[type]) return forwardWpn();
      if (currentPage === 'hsd' && (type === 'hsd' || type === 'mapinfo' || type === 'rdr')) return forwardHsd();
      if (type === 'avn' && currentPage === 'afm') return forwardAfm();
      const w = frameWin(), m = slices[type];
      if (!w || !m) return;
      if (type.indexOf('ext_') === 0) { w.postMessage({ mfd: true, type: 'ext', data: m.data }, '*'); return; }
      w.postMessage(FEED_AS[type] ? Object.assign({}, m, { type: FEED_AS[type] }) : m, '*');
    }
    function forwardAfm() {
      const w = frameWin(), m = slices.avn;
      if (!w || !m) return;
      w.postMessage({ mfd: true, type: 'afm', name: m.name, parts: m.parts, failures: m.failures, pylons: m.pylons,
                      gearDown: m.gearDown, radar: m.radar, guns: m.guns, ignition: m.ignition,
                      assist: m.assist, turret: m.turret, nvg: m.nvg, navLights: m.navLights,
                      loadout: slices.loadout ? slices.loadout.items : null }, '*');
    }
    function forwardHsd() {
      const w = frameWin(), hsd = slices.hsd || {}, mapinfo = slices.mapinfo || {}, rdr = slices.rdr || {};
      if (!w) return;
      w.postMessage({ mfd: true, type: 'hsd', metric: !!hsd.metric, hdg: mapinfo.hdg || 0,
                      ownX: mapinfo.x || 0, ownZ: mapinfo.z || 0,
                      radarPresent: !!rdr.present, radarRange: rdr.range || 0, radarCone: rdr.cone || 0,
                      items: Array.isArray(hsd.items) ? hsd.items : [],
                      threats: Array.isArray(hsd.threats) ? hsd.threats : [],
                      focusedTargetId: hsd.focusedTargetId || 0 }, '*');
    }
    function onSlice(type) {
      if (feedsFor(currentPage).indexOf(type) !== -1) forwardSlice(type);
      if (type === 'tgp' && currentPage === 'tgp') markTgp();
    }
    function forwardToPage() {
      feedsFor(currentPage).forEach(forwardSlice);
      // A fresh document has a fresh listener; resend cursor focus if this pane holds it (f35.js).
      if (PAD_CURSOR_PAGES[currentPage] && focusedCursorWindow() === frameWin())
        frameWin().postMessage({ mfd: true, action: 'cursor-focus', on: true }, '*');
    }

    // ── WPN ────────────────────────────────────────────────────────────────────────────
    // This layout's own WPN page (wpn/cougar-wpn.html) lays itself out from its pane and selects a
    // weapon when its row is tapped, so the shell only hands it a page of weapons. Selecting a weapon
    // from a frame button is Stage 4 of the plan.
    function wpnList()  { return (slices.loadout && slices.loadout.items) || []; }
    function wpnState() { return F35WpnPaging.wpnPaging(wpnList(), wpnPage, WPN_MAX_DISPLAY); }
    function forwardWpn() {
      const w = frameWin(), lo = slices.loadout;
      if (!w || !lo) return;
      if (lo.selWeapon && lo.selWeapon !== wpnSelSeen) {
        wpnSelSeen = lo.selWeapon;
        const i = wpnList().findIndex(function (it) { return it.n === lo.selWeapon; });
        if (i >= 0) wpnPage = Math.floor(i / WPN_MAX_DISPLAY);
      }
      const st = wpnState();
      wpnPage = st.page;
      w.postMessage({ mfd: true, type: 'wpn', items: st.visible, selWeapon: lo.selWeapon,
                      softGun: lo.softGun || null, softRel: lo.softRel || null,
                      masterArmsOn: lo.masterArmsOn !== false, hasLoadout: wpnList().length > 0,
                      page: st.maxPage > 0 ? st.page + 1 : 1, pages: st.maxPage + 1 }, '*');
      const key = st.page + '|' + st.maxPage + '|' + st.visible.map(function (it) { return it.n; }).join(',');
      if (currentPage === 'wpn' && key !== wpnNavKey) { wpnNavKey = key; renderNav(); }
      if (currentPage === 'wpn') { markMasterArms(); markCombatMode(); }
    }

    // ── Labels ─────────────────────────────────────────────────────────────────────────
    // What this screen puts on its keys, in fill order. Rocker actions (+/- and paging) are left out:
    // they live on the rockers. Pages whose keys must not move pin them (CougarOsb.FULL_PINS).
    function mapNavItems() {
      const byAction = {};
      (NAV.map || []).forEach(function (item) { byAction[item.action] = item; });
      const wptData = WaypointsStore.load();
      const hasRoutes = wptData.routes.length > 0;
      const hasActiveRoute = !!WaypointsStore.getActiveRoute();
      const hasSteerPoints = (wptData.steerPoints || []).length > 0;
      const left = SplitSlots.MAP_FULL_LEFT.map(function (a) { return Object.assign({}, byAction[a]); });
      const right = SplitSlots.mapFullRight(hasRoutes, hasActiveRoute, hasSteerPoints).map(function (a) {
        const item = Object.assign({}, byAction[a]);
        item.label = SplitSlots.mapActionLabel(a, item.label, hasActiveRoute);
        return item;
      });
      return left.concat(right);
    }
    function itemsFor(page) {
      let items;
      if (page === 'wpn') {
        items = [{ label: 'MAIN', action: 'main' },
                 { label: 'ARM', action: 'master-arms-on' }, { label: 'SAFE', action: 'master-arms-off' },
                 { label: 'A/A', action: 'combat-mode-aa' }, { label: 'A/G', action: 'combat-mode-ag' }];
      } else if (page === 'map') {
        items = mapNavItems();
      } else if (page === 'tgp') {
        items = (NAV.tgp || []).slice().concat([
          { label: 'MAN', action: 'tgp-manual-toggle' }, { label: 'TRK', action: 'tgp-point-track' },
          { label: 'RST', action: 'tgp-manual-reset' }, { label: 'WTV', action: 'tgp-view-wtv' },
          { label: 'STV', action: 'tgp-view-stv' }, { label: 'CLR', action: 'tgp-ir-off' },
          { label: 'IR', action: 'tgp-ir-on' }, { label: 'STP', action: 'tgp-mark-steerpoint' }]);
      } else if (page === 'doc') {
        items = (NAV.doc || []).slice();
        if (docView === 'image') items.push({ label: 'INDX', action: 'doc-indx' });
      } else if (page === 'main') {
        items = (NAV.main || []).concat(MAIN_EXTRAS);
      } else {
        items = (NAV[page] || []).slice();
      }
      const onRocker = O.rockerActions(page);
      return O.order(page, items).filter(function (item) { return item && onRocker.indexOf(item.action) === -1; })
        .map(function (item) {
          const pin = O.pinFor(page, pane, item.action);
          return pin ? Object.assign({}, item, { osb: pin }) : item;
        });
    }

    function mapSend(action) {
      const w = frameWin();
      if (w) w.postMessage({ mfd: true, action: action }, '*');
    }
    function mark(action, on, cls) {
      const b = labelFor(action);
      if (b) b.classList.toggle(cls || 'on', !!on);
    }
    function labelFor(action) {
      for (let i = 0; i < ownKeys().length; i++) {
        const b = osbEls[ownKeys()[i]].querySelector('.nav-item[data-action="' + action + '"]');
        if (b) return b;
      }
      return null;
    }
    function setFollow(on) { followOn = on; mark('flw', followOn); }
    function setGrid(on) { gridOn = on; mark('grid', gridOn); }
    function setSlew(on) { slewOn = on; mark('slew', slewOn, 'blink'); }
    function setDocView(view) {
      const v = view === 'image' ? 'image' : 'index';
      if (v === docView) return;
      docView = v;
      if (currentPage === 'doc') renderNav();
    }
    function markMasterArms() {
      const armed = !(slices.loadout && slices.loadout.masterArmsOn === false);
      mark('master-arms-on', armed);
      mark('master-arms-off', !armed);
    }
    function markCombatMode() {
      const mode = (slices.loadout && slices.loadout.combatMode) || 'all';
      Object.keys(COMBAT_MODE_ACTIONS).forEach(function (a) { mark(a, COMBAT_MODE_ACTIONS[a] === mode); });
    }
    function markTgp() {
      const s = slices.tgp, data = s && s.data;
      const m = TgpMarks.tgpMarks(data ? data.cnt : 0, s && s.manual, data && data.ir, s && s.stv);
      mark('tgp-manual-toggle', m.man);
      mark('tgp-view-wtv', m.wtv); mark('tgp-view-stv', m.stv);
      mark('tgp-ir-off', m.clr);   mark('tgp-ir-on', m.ir);
    }

    function dispatch(action) {
      if (action === 'ext') {
        showPage('ext');
        ExtNav.load(NAV).then(function () { if (currentPage === 'ext') renderNav(); });
        return;
      }
      if (action in MAP_ACTIONS)         { mapSend(MAP_ACTIONS[action]); return; }
      if (action in MASTER_ARMS_ACTIONS) { sendCommand('master-arms.set', { on: MASTER_ARMS_ACTIONS[action] }).catch(function () {}); return; }
      if (action in COMBAT_MODE_ACTIONS) { sendCommand('combat-mode.set', { group: COMBAT_MODE_ACTIONS[action] }).catch(function () {}); return; }
      if (action in TGP_VIEW_ACTIONS)    { sendCommand('tgp.view.set', { on: TGP_VIEW_ACTIONS[action] }).catch(function () {}); return; }
      if (action in TGP_IR_ACTIONS)      { sendCommand('tgp.ir.set', { on: TGP_IR_ACTIONS[action] }).catch(function () {}); return; }
      if (action in TGP_ONESHOT)         { sendCommand(TGP_ONESHOT[action]).catch(function () {}); return; }
      if (has(action)) showPage(action);
    }

    // A label with a press-and-hold alternative (f35.js renderNav): tap does `action`, holding does
    // onHold instead.
    function wireHold(b, action, onHold) {
      let holdTimer = null, holdFired = false;
      const clearHold = trackHold(function () { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
      b.addEventListener('pointerdown', function () {
        holdFired = false;
        pendingHoldClear = clearHold;
        holdTimer = setTimeout(function () { holdFired = true; onHold(); }, HOLD_MS);
      });
      b.addEventListener('pointerup', clearHold);
      b.addEventListener('pointercancel', clearHold);
      b.addEventListener('pointerleave', clearHold);
      b.addEventListener('click', function () { if (!holdFired) dispatch(action); });
    }

    function clearOwnKeys() { ownKeys().forEach(function (id) { osbEls[id].textContent = ''; }); }

    function renderNav() {
      if (pendingHoldClear) { pendingHoldClear(); pendingHoldClear = null; }
      clearOwnKeys();
      const res = O.place(itemsFor(currentPage), pane, navPage);
      navPage = res.page;
      navPages = res.pages;
      res.placed.forEach(function (p) {
        const item = p.item;
        const wired = canDo(item.action);
        const b = makeButton(item.label, item.action, (wired ? '' : 'pending') + (item.mark ? ' on' : ''));
        if (!wired) b.disabled = true;
        else if (item.action in COMBAT_MODE_ACTIONS) wireHold(b, item.action, function () { sendCommand('combat-mode.set', { group: 'all' }).catch(function () {}); });
        else if (item.action === 'wpt-prev') wireHold(b, item.action, function () { mapSend('waypoint-reset'); });
        else if (item.action === 'slew') wireHold(b, item.action, function () { mapSend('slew-keypad'); });
        else b.addEventListener('click', function () { dispatch(item.action); });
        osbEls[p.osb].appendChild(b);
      });
      setFollow(followOn);
      setGrid(gridOn);
      setSlew(slewOn);
      if (currentPage === 'wpn') { markMasterArms(); markCombatMode(); }
      if (currentPage === 'tgp') markTgp();
      if (onNavRendered) onNavRendered(api);
    }

    // ── Rockers ────────────────────────────────────────────────────────────────────────
    // This page's +/- (the pane's left rocker) and its paging (the right one), or null for blank.
    function stepTgpZoom(dir) { sendCommand('tgp.zoom.step', { index: dir }).catch(function () {}); }
    function rockerPM() {
      const r = O.ROCKER_PM[currentPage];
      if (!r) return null;
      function send(action, dir) {
        if (currentPage === 'tgp') return function () { stepTgpZoom(dir); };
        if (action in MAP_ACTIONS) return function () { mapSend(MAP_ACTIONS[action]); };
        return function () { mapSend(action); };   // scroll pages take zoom-in/zoom-out as down/up
      }
      return { caption: r.caption,
               minus: { label: r.minusLabel, run: send(r.minus, -1), repeat: currentPage === 'tgp' },
               plus:  { label: r.plusLabel,  run: send(r.plus, 1),   repeat: currentPage === 'tgp' } };
    }
    function rockerPaging() {
      if (currentPage === 'wpn') {
        const st = wpnState();
        if (st.maxPage < 1) return null;
        return { caption: 'PAGE ' + (st.page + 1) + '/' + (st.maxPage + 1),
                 prev: st.page > 0 ? function () { wpnPage = st.page - 1; forwardWpn(); } : null,
                 next: st.page < st.maxPage ? function () { wpnPage = st.page + 1; forwardWpn(); } : null };
      }
      if (currentPage === 'doc' && docView === 'image') {
        return { caption: 'DOC',
                 prev: function () { mapSend('doc-prev'); }, next: function () { mapSend('doc-next'); } };
      }
      if (navPages > 1) {
        return { caption: 'PAGE ' + (navPage + 1) + '/' + navPages,
                 prev: navPage > 0 ? function () { navPage -= 1; renderNav(); } : null,
                 next: navPage < navPages - 1 ? function () { navPage += 1; renderNav(); } : null };
      }
      return null;
    }

    function showPage(name) {
      if (!has(name)) return;
      currentPage = name;
      navPage = 0;
      wpnNavKey = '';
      if (name === 'doc') docView = 'index';
      ident.hidden = name !== 'main';
      LayoutPages.navigateFrame(frame, PAGES[name] || (ExtNav.isExtensionPage(name) ? '/ext/' + name : 'about:blank'));
      forwardToPage();
      renderNav();
    }

    frame.addEventListener('load', forwardToPage);

    const api = {
      el: el,
      showPage: showPage,
      onSlice: onSlice,
      isMapWin: isMapWin,
      setFollow: setFollow,
      setGrid: setGrid,
      setSlew: setSlew,
      setDocView: setDocView,
      page: function () { return currentPage; },
      frameWin: frameWin,
      // Which keys this portal owns. Changing it moves the labels; the caller re-renders. A portal that
      // hasn't shown a page yet has drawn nothing, and must not clear keys another portal is using.
      setPane: function (p) { if (currentPage !== null) clearOwnKeys(); pane = p; },
      pane: function () { return pane; },
      // The SOI cursor's targets: this portal's enabled labels in key order.
      navItems: function () {
        const out = [];
        ownKeys().forEach(function (id) {
          const b = osbEls[id].querySelector('.nav-item:not([disabled])');
          if (b) out.push(b);
        });
        return out;
      },
      cursorWin: function () { return PAD_CURSOR_PAGES[currentPage] ? frameWin() : null; },
      refreshNav: renderNav,
      rockerPM: rockerPM,
      rockerPaging: rockerPaging,
      destroy: function () {
        if (currentPage === 'tgp') console.info('[NOXMFD TGP] Cougar pane destroyed while showing TGP.');
        if (pendingHoldClear) { pendingHoldClear(); pendingHoldClear = null; }
        clearOwnKeys();
        el.remove();
      },
    };
    return api;
  }

  // ── The glass: arrangement ────────────────────────────────────────────────────────────
  // Full view is one portal on every page key; a split is two, the top one on the top row and the
  // upper side keys, the bottom one on the bottom row and the lower side keys. `split` is null in full
  // view, else the variant ('tw' | 'h' | 'bw', CougarOsb.SPLIT_SHARE).
  let portals = [];
  let split = null;

  function applySplitSizes() {
    if (!split) { if (portals[0]) portals[0].el.style.flexGrow = '1'; return; }
    const share = O.SPLIT_SHARE[split];
    portals[0].el.style.flexGrow = String(share);
    portals[1].el.style.flexGrow = String(1 - share);
  }

  // FULL_BLEED applies in full view only: a split pane keeps clear of the label rows.
  function syncFullBleed() {
    const bleed = (!split && portals[0] && FULL_BLEED[portals[0].page()]) || '';
    glass.classList.toggle('full-bleed', !!bleed);
    glass.classList.toggle('bleed-top', bleed === 'top');
  }

  function addPortal(at, pane, page) {
    const p = makePortal(onNavRendered);
    p.setPane(pane);
    portals.splice(at, 0, p);
    panesEl.insertBefore(p.el, panesEl.children[at] || null);
    p.showPage(page && has(page) ? page : 'main');
    return p;
  }

  // Go to an arrangement. A portal that survives keeps its page and everything on it; the one a
  // split adds opens on MAIN, as the other layouts' new panes do.
  function setSplit(next) {
    if (next === split && portals.length) return;
    if (!next) {
      while (portals.length > 1) portals.pop().destroy();
      split = null;
      if (!portals.length) addPortal(0, 'full', 'main');
      else { portals[0].setPane('full'); portals[0].refreshNav(); }
    } else {
      const wasSplit = !!split;
      split = next;
      if (!wasSplit) {
        if (!portals.length) addPortal(0, 'top', 'main');
        else { portals[0].setPane('top'); portals[0].refreshNav(); }
        addPortal(1, 'bottom', 'main');
      }
    }
    refreshGlass();
  }

  function refreshGlass() {
    applySplitSizes();
    syncFullBleed();
    renderShellKeys();
    renderRockers();
    fitSide();
    reportPanes();
    renderSoiRing();
    renderSoiCursor();
    renderPin();
  }

  // ── Shell keys ────────────────────────────────────────────────────────────────────────
  function splitIcon(share) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 26 20');
    svg.setAttribute('class', 'split-icon');
    svg.setAttribute('aria-hidden', 'true');
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', '1'); r.setAttribute('y', '1'); r.setAttribute('width', '24'); r.setAttribute('height', '18');
    svg.appendChild(r);
    if (share) {
      const y = String(1 + 18 * share);
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', '1'); l.setAttribute('x2', '25'); l.setAttribute('y1', y); l.setAttribute('y2', y);
      svg.appendChild(l);
    }
    return svg;
  }
  const SHELL_TITLE = { full: 'Full view', pin: 'Pin', swap: 'Swap',
                        'split-tw': 'Split, top pane wide', split: 'Split 50/50', 'split-bw': 'Split, bottom pane wide' };
  function renderShellKeys() {
    Object.keys(O.SHELL_KEYS).forEach(function (id) {
      const act = O.SHELL_KEYS[id];
      const cell = osbEls[id];
      cell.textContent = '';
      const b = makeButton('', 'shell-' + act, 'shell-key');
      b.title = SHELL_TITLE[act];
      b.setAttribute('aria-label', SHELL_TITLE[act]);
      if (act === 'full') b.appendChild(splitIcon(0));
      else if (act in O.SPLITS) b.appendChild(splitIcon(O.SPLIT_SHARE[O.SPLITS[act]]));
      else b.textContent = act === 'pin' ? 'PIN' : 'SWAP';
      if (act === 'full') b.classList.toggle('on', !split);
      if (act in O.SPLITS) b.classList.toggle('on', split === O.SPLITS[act]);
      b.addEventListener('click', function () { onShellKey(act); });
      cell.appendChild(b);
    });
    renderPin();
  }
  function onShellKey(act) {
    if (act === 'full') setSplit(null);
    else if (act in O.SPLITS) setSplit(O.SPLITS[act]);
    else if (act === 'pin') {
      const here = captureArrangement();
      if (!LayoutPin.pinnable(here)) return;
      setPin(pinnedLayout && LayoutPin.sameArrangement(here, pinnedLayout) ? null : here);
    } else if (act === 'swap') {
      const step = LayoutPin.swapStep(captureArrangement(), pinnedLayout, swapPartner);
      if (!step) return;
      swapPartner = step.partner;
      applyArrangement(step.to);
    }
    saveProfileSoon();
  }

  // ── Rockers ──────────────────────────────────────────────────────────────────────────
  // Top rockers belong to the top (or only) pane, bottom rockers to the bottom pane; in full view the
  // bottom pair is the display's contrast and brightness. Left is +/-, right is paging.
  let display = { brightness: 1, contrast: 1 };
  function applyDisplay() {
    glass.style.setProperty('--brightness', String(display.brightness));
    glass.style.setProperty('--contrast', String(display.contrast));
  }
  function stepDisplayKind(kind, dir) {
    display[kind] = O.stepDisplay(kind, display[kind], dir);
    applyDisplay();
    renderRockers();
    saveProfileSoon();
  }

  // Each rocker's caption and two halves are built once and updated in place. renderRockers runs on
  // every loadout tick (WPN's page count), several times a second: rebuilding the buttons there would
  // drop any press whose pointerdown and pointerup land on different elements, and strand a held
  // repeat whose button vanished before its pointerup.
  //
  // A half's action is read from the corner's current spec at press time, so an update between press
  // and release can't run a stale action. half: { label, run, repeat? }; a missing run is inert. A
  // repeating half (TGP zoom) steps once on press and then repeats while held, as the F-35's on-screen
  // Z+/Z- do.
  const rockers = {};
  function stopRepeat(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
  function makeRockerHalf(r, which) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rocker-half';
    const half = function () { return r.spec && r.spec[which]; };
    b.addEventListener('pointerdown', function () {
      const h = half();
      if (!h || !h.run || !h.repeat) return;
      stopRepeat(r);
      h.run();
      r.timer = setTimeout(function rep() {
        const cur = half();
        if (!cur || !cur.run || !cur.repeat) { r.timer = null; return; }
        cur.run();
        r.timer = setTimeout(rep, TGP_ZOOM_STEP_REPEAT_MS);
      }, TGP_ZOOM_STEP_INITIAL_DELAY_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { stopRepeat(r); }); });
    b.addEventListener('click', function (e) {
      const h = half();
      if (!h || !h.run) return;
      // A repeating half already stepped on pointerdown; only a click with no pointer behind it
      // (SOI select, keyboard) steps here.
      if (h.repeat && e.detail !== 0) return;
      h.run();
    });
    return b;
  }
  Object.keys(rockerEls).forEach(function (corner) {
    const el = rockerEls[corner];
    const r = { spec: null, timer: null, cap: document.createElement('div'), row: document.createElement('div') };
    r.cap.className = 'rocker-caption';
    r.row.className = 'rocker-halves';
    r.minus = makeRockerHalf(r, 'minus');
    r.plus = makeRockerHalf(r, 'plus');
    r.row.append(r.minus, r.plus);
    el.append(r.cap, r.row);
    rockers[corner] = r;
  });
  function setHalf(b, h) {
    const label = h ? h.label : '';
    if (b.textContent !== label) b.textContent = label;
    b.disabled = !h || !h.run;
  }
  function fillRocker(corner, spec) {
    const r = rockers[corner];
    // A held repeat stops when its rocker changes meaning (the pane left TGP).
    if (!spec || !r.spec || spec.caption !== r.spec.caption) stopRepeat(r);
    r.spec = spec;
    rockerEls[corner].classList.toggle('blank', !spec);
    const cap = spec ? spec.caption : '';
    if (r.cap.textContent !== cap) r.cap.textContent = cap;
    setHalf(r.minus, spec && spec.minus);
    setHalf(r.plus, spec && spec.plus);
  }
  function pmSpec(p) { return p ? p.rockerPM() : null; }
  function pagingSpec(p) {
    const pg = p ? p.rockerPaging() : null;
    if (!pg) return null;
    return { caption: pg.caption, minus: { label: '◀', run: pg.prev }, plus: { label: '▶', run: pg.next } };
  }
  function displaySpec(kind) {
    const pct = Math.round(display[kind] * 100) + '%';
    return { caption: (kind === 'contrast' ? 'CON ' : 'BRT ') + pct,
             minus: { label: '−', run: function () { stepDisplayKind(kind, -1); } },
             plus:  { label: '+', run: function () { stepDisplayKind(kind, 1); } } };
  }
  function renderRockers() {
    const top = portals[0], bottom = split ? portals[1] : null;
    fillRocker('tl', pmSpec(top));
    fillRocker('tr', pagingSpec(top));
    // Full view: brightness bottom-left, contrast bottom-right, where the F-16-style frames put them.
    fillRocker('bl', split ? pmSpec(bottom) : displaySpec('brightness'));
    fillRocker('br', split ? pagingSpec(bottom) : displaySpec('contrast'));
  }

  // ── SOI (as f35.js, a surface being one pane) ─────────────────────────────────────────
  let soiPane = -1, soiCursor = -1, myCid = '';
  function reportPanes() {
    if (!myCid) return;
    sendCommand('soi.panes', { cid: myCid, n: portals.length }).catch(function () {});
    reportSoiPage();
  }
  function focusedPortal() { return (soiPane >= 0 && soiPane < portals.length) ? portals[soiPane] : null; }
  function renderSoiRing() {
    const fp = focusedPortal();
    portals.forEach(function (p) { p.el.classList.toggle('soi', p === fp); });
  }
  function reportSoiPage() {
    const fp = focusedPortal();
    if (!fp || !myCid) return;
    sendCommand('soi.page', { cid: myCid, n: soiPane, wname: fp.page() || '' }).catch(function () {});
  }
  function renderSoiCursor() {
    O.ALL.forEach(function (id) {
      osbEls[id].querySelectorAll('.nav-item.cursor').forEach(function (b) { b.classList.remove('cursor'); });
    });
    const fp = focusedPortal();
    if (!fp || soiCursor < 0) return;
    const items = fp.navItems();
    if (!items.length) { soiCursor = -1; return; }
    if (soiCursor >= items.length) soiCursor = items.length - 1;
    items[soiCursor].classList.add('cursor');
  }
  function setSoiCursor(i) { soiCursor = i; renderSoiCursor(); }
  function onSoiFocus(m) {
    const prev = soiPane;
    soiPane = m.focused ? (typeof m.pane === 'number' ? m.pane : 0) : -1;
    if (soiPane !== prev) soiCursor = -1;
    renderSoiRing();
    renderSoiCursor();
    syncCursorFocus();
    reportSoiPage();
  }
  function onSoiAct(act) {
    const fp = focusedPortal();
    if (!fp) return;
    const items = fp.navItems();
    if (!items.length) { setSoiCursor(-1); return; }
    if (act === 'select') {
      if (soiCursor >= 0 && soiCursor < items.length) {
        const before = fp.page();
        items[soiCursor].click();
        if (fp.page() !== before) setSoiCursor(-1); else renderSoiCursor();
      }
      return;
    }
    const dir = act === 'up' ? -1 : 1;
    if (soiCursor < 0) setSoiCursor(dir > 0 ? 0 : items.length - 1);
    else setSoiCursor(((soiCursor + dir) % items.length + items.length) % items.length);
  }
  // A portal rebuilt its labels (page change, paging): the rockers, the full-bleed state, the side
  // width and the pin all follow its page.
  function onNavRendered(p) {
    syncFullBleed();
    renderRockers();
    fitSide();
    renderPin();
    saveProfileSoon();
    if (p !== focusedPortal()) return;
    renderSoiCursor();
    syncCursorFocus();
    reportSoiPage();
  }

  let cursorFocusTarget = null;
  function focusedCursorWindow() {
    const fp = focusedPortal();
    return fp ? fp.cursorWin() : null;
  }
  function syncCursorFocus() {
    const target = focusedCursorWindow();
    if (target === cursorFocusTarget) return;
    if (cursorFocusTarget) cursorFocusTarget.postMessage({ mfd: true, action: 'cursor-focus', on: false }, '*');
    if (target) target.postMessage({ mfd: true, action: 'cursor-focus', on: true }, '*');
    cursorFocusTarget = target;
  }

  // ── PIN / SWAP and saved layouts ───────────────────────────────────────────────────────
  // An arrangement in CLASSIC's shape ({splitMode, splitVariant, pages}), so the shared LayoutPin rule
  // and the LYT page's thumbnails read it. Cougar's variants ('tw', 'h', 'bw') are its own; LYT draws
  // the wide ones as its plain top/bottom split.
  let pinnedLayout = null, swapPartner = null;
  function captureArrangement() {
    return split ? { splitMode: true, splitVariant: split, pages: portals.map(function (p) { return p.page(); }) }
                 : { splitMode: false, pages: [portals[0] ? portals[0].page() : 'main'] };
  }
  function setPin(arr) { pinnedLayout = arr; swapPartner = null; renderPin(); }
  function renderPin() {
    const on = pinnedLayout !== null && portals.length > 0 &&
               LayoutPin.sameArrangement(captureArrangement(), pinnedLayout);
    const pin = osbEls.L3.querySelector('.nav-item');
    const swap = osbEls.L4.querySelector('.nav-item');
    if (pin) pin.classList.toggle('on', on);
    if (swap) swap.disabled = pinnedLayout === null;
  }
  function validArrangement(a) {
    if (!a || !Array.isArray(a.pages) || !a.pages.length) return null;
    if (!a.splitMode) return { splitMode: false, pages: [String(a.pages[0])] };
    const v = a.splitVariant in O.SPLIT_SHARE ? a.splitVariant : 'h';
    return { splitMode: true, splitVariant: v, pages: [String(a.pages[0]), String(a.pages[1] || 'main')] };
  }
  // LayoutPin.pinFromState knows CLASSIC's variants only, so a Cougar pin is read back here.
  function pinFromState(state) {
    const a = validArrangement(state && state.pinnedLayout);
    return a && LayoutPin.pinnable(a) ? a : null;
  }
  function applyArrangement(state) {
    const a = validArrangement(state) || { splitMode: false, pages: ['main'] };
    while (portals.length) portals.pop().destroy();
    split = a.splitMode ? a.splitVariant : null;
    if (split) { addPortal(0, 'top', a.pages[0]); addPortal(1, 'bottom', a.pages[1]); }
    else addPortal(0, 'full', a.pages[0]);
    refreshGlass();
  }
  function captureLayoutState() { return Object.assign(captureArrangement(), { pinnedLayout: pinnedLayout }); }
  function applyLayoutState(state) {
    applyArrangement(state);
    if (state && Array.isArray(state.soi)) {
      state.soi.forEach(function (on, pane) { sendCommand('soi.include', { cid: myCid, n: pane, on: on !== false }).catch(function () {}); });
    }
    setPin(pinFromState(state));
    saveProfileSoon();
  }
  function soiSurfaces() {
    const labels = split ? ['Include TOP pane in SOI', 'Include BOTTOM pane in SOI'] : ['Include full view in SOI'];
    return { cid: myCid, labels: labels, names: labels };
  }
  const { loadSlotAct, loadById, handleLayoutKeydown, wireLayoutKeydown } =
    LayoutKeydown.makeLayoutKeydownHandlers('cougar', captureLayoutState, applyLayoutState, soiSurfaces);

  // ── Profile persistence ───────────────────────────────────────────────────────────────
  let saveTimer = null;
  function saveProfile() {
    if (!portals.length) return;
    writeJson(PROFILE_KEY, Object.assign(captureLayoutState(), { display: display }));
  }
  function saveProfileSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProfile, 300);
  }
  window.addEventListener('pagehide', saveProfile);

  // ── LYT ──────────────────────────────────────────────────────────────────────────────
  function onLytAct(portal, m) {
    if (m.act === 'cougar') portal.showPage('main');
    else if (m.act === 'classic') { setLayout('classic'); location.href = '/'; }
    else if (m.act === 'f35') { setLayout('f35'); location.href = '/f35'; }
    else if (m.act === 'load' && typeof m.id === 'string') loadById(m.id);
  }

  // ── Message pump (as f35.js) ──────────────────────────────────────────────────────────
  const connLostBanner = document.getElementById('conn-lost-banner');
  const connLostBannerCtrl = ConnLostBanner.createController({
    onShow: function () { connLostBanner.hidden = false; },
    onHide: function () { connLostBanner.hidden = true; },
  });
  document.getElementById('conn-lost-dismiss').addEventListener('click', connLostBannerCtrl.dismiss);

  window.addEventListener('message', function (e) {
    const m = e.data;
    if (!m || m.mfd !== true || typeof m.type !== 'string') return;
    if (m.type === 'follow') { portals.forEach(function (p) { if (p.isMapWin(e.source)) p.setFollow(!!m.on); }); return; }
    if (m.type === 'grid')   { portals.forEach(function (p) { if (p.isMapWin(e.source)) p.setGrid(!!m.on); }); return; }
    if (m.type === 'slew')   { portals.forEach(function (p) { if (p.isMapWin(e.source)) p.setSlew(!!m.on); }); return; }
    if (m.type === 'wpt-routes-request') {
      if (e.source) e.source.postMessage({ mfd: true, type: 'wpt-routes', data: WaypointsStore.load() }, '*');
      return;
    }
    if (m.type === 'doc-view') { portals.forEach(function (p) { if (p.frameWin() === e.source) p.setDocView(m.view); }); return; }
    if (m.type === 'lyt-act') {
      portals.forEach(function (p) { if (p.page() === 'lyt' && p.frameWin() === e.source) onLytAct(p, m); });
      return;
    }

    if (e.source !== mapTap.contentWindow) return;

    if (m.type === 'soi-cid') { myCid = m.cid || ''; reportPanes(); return; }
    if (m.type === 'soi')     { onSoiFocus(m); return; }
    if (m.type === 'soi-act') { onSoiAct(m.act); return; }
    if (m.type === 'cursor' || m.type === 'cursor-select' || m.type === 'cursor-held') {
      const w = focusedCursorWindow();
      if (!w) return;
      if (m.type === 'cursor') w.postMessage({ mfd: true, action: 'cursor', x: m.x || 0, y: m.y || 0 }, '*');
      else if (m.type === 'cursor-select') w.postMessage({ mfd: true, action: 'cursor-select' }, '*');
      else w.postMessage({ mfd: true, action: 'cursor-held', held: !!m.held }, '*');
      return;
    }
    if (m.type === 'map-act' && loadSlotAct(m.act)) return;
    if (m.type === 'map-act') {
      const w = focusedCursorWindow();
      if (w) w.postMessage({ mfd: true, action: m.act }, '*');
      return;
    }

    if (m.type === 'themes-push') ThemeLive.apply(window, m.data && m.data.css);
    if (m.type === 'status') connLostBannerCtrl.update(m.cls);

    slices[m.type] = m;
    portals.forEach(function (p) { p.onSlice(m.type); });
    // WPN's page count lives on the right rocker.
    if (m.type === 'loadout') renderRockers();
  });
  mapTap.contentWindow.postMessage({ mfd: true, action: 'sysdmg-request' }, '*');

  document.fonts.ready.then(fitSide);
  // Label sizes follow the window height, so the side columns refit too.
  window.addEventListener('resize', fitSide);

  // MAP's route keys follow the navigation library (f35.js).
  window.addEventListener('wptroutes:changed', function () {
    slices['wpt-routes'] = { mfd: true, type: 'wpt-routes', data: WaypointsStore.load() };
    portals.forEach(function (p) {
      p.onSlice('wpt-routes');
      if (p.page() === 'map') p.refreshNav();
    });
  });

  window.addEventListener('keydown', handleLayoutKeydown);
  wireLayoutKeydown(mapTap);

  // ── Boot ─────────────────────────────────────────────────────────────────────────────
  const extNavLoaded = ExtNav.load(NAV);
  TdNav.start(NAV);
  const saved = readJson(PROFILE_KEY);
  if (saved && saved.display) {
    display = { brightness: O.stepDisplay('brightness', saved.display.brightness, 0),
                contrast: O.stepDisplay('contrast', saved.display.contrast, 0) };
  }
  applyDisplay();
  if (profileList().indexOf(profile) === -1) writeJson(PROFILES_KEY, profileList().concat([profile]));
  // A restored pane on an extension page needs the manifest first, or has() rejects the page.
  if (saved) extNavLoaded.catch(function () {}).then(function () { applyLayoutState(saved); });
  else applyArrangement(null);
})();
