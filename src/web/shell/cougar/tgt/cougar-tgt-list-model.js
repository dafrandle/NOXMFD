// The COUGAR layout's target LIST (cougar-tgt-list.js): which enemy contacts a filter shows, in what
// order, a page at a time. Pure: no DOM, so cougar-tgt-list-model.test.js pins it in Node.
//
// There can be a hundred or more enemy contacts; a filter's job is to put the ones that matter now in
// its first 10-20 slots. Each filter is a set (which contacts) and an order (most important first).
// Across every filter, a datalink-only contact sorts after the ones a friendly sensor sees now, and a
// stale one (its position no longer trusted) after those: the least reliable to lock go last. Ties go
// to the nearer contact.
//
// Inputs (build):
//   contacts  the frame's contacts (TelemetryJson): {id, t, x, z, h, f, tg, dl, st, jm, c, k, ac, ...}
//             f = 2 is enemy; c the game's category (a aircraft, m missile, g ground, s ship, b
//             building), k its subtype (vehicles: TRUCK UGV LCV AFV MBT ART AAA IR_SAM R_SAM RDR)
//   own       {x, z, hdg}: the player's position and heading
//   rwr       the RWR's emitters [{id, tr}]: tr 0 search, 1 track, 2 lock (we are its target)
//   rings     air-defence threat rings [{id, r}]: r the unit's engagement range in metres (HSD)
//   td        ids the squad has designated (leader's assignments, a member's pending designations)
(function (root) {
  const AHEAD_DEG = 30;        // AHEAD: within this many degrees of the nose
  const HOT_DEG = 30;          // an aircraft is "hot" when heading within this of straight at us
  // An aircraft "on our six": behind us (more than SIX_DEG off the nose), within SIX_RANGE, and hot.
  const SIX_DEG = 90, SIX_RANGE = 15000;
  // "Danger close": any aircraft within this, whatever its heading or position.
  const CLOSE_RANGE = 2000;
  const PER_PAGE = { full: 12, split: 5 };

  function sub(c) { return String(c.k || '').toUpperCase(); }
  const SAM_SUBS = ['AAA', 'IR_SAM', 'R_SAM'];
  // GROUND: air defence and radars first (they shoot back / see you), then armour and artillery,
  // then the rest (UGV, LCV, TRUCK).
  const GROUND_RANK = { R_SAM: 0, IR_SAM: 0, AAA: 0, RDR: 1, MBT: 2, ART: 2, AFV: 3 };

  function isAir(c) { return c.c === 'a' || (!c.c && !!c.ac); }
  // Surface: ground units, ships and buildings (not aircraft, not missiles).
  function isSurface(c) { return !isAir(c) && c.c !== 'm'; }
  function isAhead(c) { return Math.abs(c.rel) <= AHEAD_DEG; }
  // Surface air defence: a threat ring, or a SAM/AAA subtype whose ring the HSD hasn't sent.
  function isAirDefence(c) { return c.ringR > 0 || (c.c === 'g' && SAM_SUBS.indexOf(sub(c)) >= 0); }

  // The threat filters. Air: an aircraft on the RWR, flying at us, or danger close; danger close,
  // lock, track, on our six, hot, searching.
  // Surface: a unit on the RWR or with us inside its ring; lock, track, inside its ring, searching.
  // Ahead, surface also counts air defence whose ring we're flying toward, before we're inside it
  // (ranked after inside-its-ring).
  function threatAir(c) { return isAir(c) && (c.rwrTier >= 0 || c.hot || c.close); }
  function threatAirRank(c) {
    if (c.close) return 0;
    if (c.rwrTier === 2) return 1;
    if (c.rwrTier === 1) return 2;
    if (c.six) return 3;
    if (c.hot) return 4;
    return 5;
  }
  function threatGnd(c) { return isSurface(c) && (c.rwrTier >= 0 || c.inRing); }
  function threatGndRank(c) {
    if (c.rwrTier === 2) return 0;
    if (c.rwrTier === 1) return 1;
    if (c.inRing) return 2;
    if (isAirDefence(c)) return 3;
    return 4;
  }
  function byRange() { return 0; }

  // Each filter: label, which contacts (keep), and its own importance rank (lower first; the
  // reliability tier and range then break ties).
  const FILTERS = [
    { id: 'threat-air', label: 'THREAT AIR', keep: threatAir, rank: threatAirRank },
    { id: 'threat-gnd', label: 'THREAT GND', keep: threatGnd, rank: threatGndRank },
    { id: 'threat-gnd-ahead', label: 'THREAT GND AHEAD',
      keep: function (c) { return isAhead(c) && (threatGnd(c) || (isSurface(c) && isAirDefence(c))); },
      rank: threatGndRank },
    { id: 'threat-air-ahead', label: 'THREAT AIR AHEAD',
      keep: function (c) { return isAhead(c) && threatAir(c); },
      rank: threatAirRank },
    { id: 'ahead-air', label: 'AHEAD AIR',
      keep: function (c) { return isAhead(c) && isAir(c); },
      rank: byRange },
    { id: 'ahead-gnd', label: 'AHEAD GND',
      keep: function (c) { return isAhead(c) && isSurface(c); },
      rank: byRange },
    { id: 'air', label: 'AIR',
      keep: isAir,
      rank: function (c) { return c.rwrTier >= 1 ? 0 : c.hot ? 1 : 2; } },
    { id: 'sam', label: 'SAM/AAA',
      keep: isAirDefence,
      rank: function (c) { return c.inRing ? 0 : 1; } },
    { id: 'radar', label: 'RADAR',
      keep: function (c) { return c.rwrTier >= 0 || sub(c) === 'RDR'; },
      rank: function (c) { return c.rwrTier >= 0 ? 0 : 1; } },
    { id: 'ground', label: 'GROUND',
      keep: function (c) { return c.c === 'g'; },
      rank: function (c) { const r = GROUND_RANK[sub(c)]; return r === undefined ? 4 : r; } },
    { id: 'ship', label: 'SHIP',
      keep: function (c) { return c.c === 's'; },
      rank: byRange },
    { id: 'bldg', label: 'BLDG',
      keep: function (c) { return c.c === 'b'; },
      rank: byRange },
    { id: 'td', label: 'TD',
      keep: function (c) { return c.td; },
      rank: byRange },
    { id: 'all', label: 'ALL',
      keep: function () { return true; },
      rank: byRange },
    { id: 'locked', label: 'LOCKED',
      keep: function (c) { return c.locked; },
      rank: byRange },
  ];

  function wrap180(deg) { return ((deg % 360) + 540) % 360 - 180; }

  // Bearing from (x1, z1) to (x2, z2), degrees clockwise from north (+z), as the map draws it.
  function bearing(x1, z1, x2, z2) { return ((Math.atan2(x2 - x1, z2 - z1) * 180 / Math.PI) + 360) % 360; }

  // Every enemy contact, with what the filters look at worked out once.
  function enrich(inputs) {
    const own = inputs.own || { x: 0, z: 0, hdg: 0 };
    const rwr = Object.create(null);
    (inputs.rwr || []).forEach(function (e) {
      if (e && e.id) rwr[e.id] = Math.max(rwr[e.id] == null ? -1 : rwr[e.id], typeof e.tr === 'number' ? e.tr : 0);
    });
    const rings = Object.create(null);
    (inputs.rings || []).forEach(function (t) { if (t && t.id) rings[t.id] = t.r || 0; });
    const td = Object.create(null);
    (inputs.td || []).forEach(function (id) { td[id] = true; });
    const out = [];
    (inputs.contacts || []).forEach(function (c) {
      if (!c || c.f !== 2 || !c.id) return;
      const dx = c.x - own.x, dz = c.z - own.z;
      const range = Math.hypot(dx, dz);
      const brg = bearing(own.x, own.z, c.x, c.z);
      const back = bearing(c.x, c.z, own.x, own.z);   // from the contact to us
      const ringR = rings[c.id] || 0;
      const rel = wrap180(brg - (own.hdg || 0));
      const hot = typeof c.h === 'number' && Math.abs(wrap180(c.h - back)) <= HOT_DEG;
      out.push({
        id: c.id, name: c.t || '', c: c.c || '', k: c.k || '', ac: !!c.ac,
        range: range, bearing: brg, rel: rel, hot: hot,
        six: hot && isAir({ c: c.c || '', ac: !!c.ac }) && Math.abs(rel) > SIX_DEG && range <= SIX_RANGE,
        close: isAir({ c: c.c || '', ac: !!c.ac }) && range <= CLOSE_RANGE,
        rwrTier: rwr[c.id] == null ? -1 : rwr[c.id],
        ringR: ringR, inRing: ringR > 0 && range <= ringR,
        td: !!td[c.id],
        locked: !!c.tg, datalink: !!c.dl, stale: !!c.st, jammed: !!c.jm,
        sp: c.sp || '', al: c.al || '',
      });
    });
    return out;
  }

  function reliability(c) { return c.stale ? 2 : c.datalink ? 1 : 0; }

  // The contacts filter `index` shows, most important first.
  function build(inputs, index) {
    const f = FILTERS[((index % FILTERS.length) + FILTERS.length) % FILTERS.length];
    const list = enrich(inputs).filter(f.keep);
    list.sort(function (a, b) {
      return (reliability(a) - reliability(b)) || (f.rank(a) - f.rank(b)) || (a.range - b.range) || (a.id - b.id);
    });
    return list;
  }

  // One page of `list`: `per` slots a page (PER_PAGE.full / .split), page clamped.
  function page(list, pageIndex, per) {
    const pages = Math.max(1, Math.ceil(list.length / per));
    const p = Math.max(0, Math.min(pages - 1, pageIndex | 0));
    return { page: p, pages: pages, items: list.slice(p * per, p * per + per) };
  }

  // Long-press on a page: lock every contact on it, or, if every one is locked already, unlock them all.
  // Returns the ids to select and to deselect.
  function pageToggle(items) {
    const allLocked = items.length > 0 && items.every(function (c) { return c.locked; });
    return allLocked
      ? { select: [], deselect: items.map(function (c) { return c.id; }) }
      : { select: items.filter(function (c) { return !c.locked; }).map(function (c) { return c.id; }), deselect: [] };
  }

  const api = { FILTERS: FILTERS, PER_PAGE: PER_PAGE, AHEAD_DEG: AHEAD_DEG, bearing: bearing, wrap180: wrap180,
                enrich: enrich, build: build, page: page, pageToggle: pageToggle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarTgtList = api;
})(typeof self !== 'undefined' ? self : this);
