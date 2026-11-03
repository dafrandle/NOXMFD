// The COUGAR layout's WPN page (cougar-wpn.html): a renderer driven by the shell's 'wpn' and 'cm'
// messages, laid out from its own box by CougarWpnLayout. Rendering follows pages/wpn/wpn.js (rows,
// ammo gauges, selection marks, countermeasures, SAFE); the placement is this page's own.

// ── DOM refs ───────────────────────────────────────────────────────────────────────
const wpnEl       = document.getElementById('wpn');
const listEl      = document.getElementById('list');
const imgBox      = document.getElementById('img');
const imgEl       = document.getElementById('img-el');
const safeEl      = document.getElementById('safe');
const cmFlaresTitle = document.getElementById('cm-flares-title');
const cmJammerTitle = document.getElementById('cm-jammer-title');
const cmFlaresVal   = document.getElementById('cm-flares-val');
const cmJammerVal   = document.getElementById('cm-jammer-val');
const cmDots        = document.getElementById('cm-dots');
const cmBarFill     = document.getElementById('cm-bar-fill');
const flareDots     = Array.prototype.slice.call(document.querySelectorAll('.flare-dot'));

// ── State ──────────────────────────────────────────────────────────────────────────
let wpnData = { items: [], selWeapon: null, softGun: null, softRel: null, masterArmsOn: true, hasLoadout: false };
let cmData  = { flares: -1, flaresMax: -1, ewKJ: -1, ewKJMax: -1, cmCat: 0 };
let rowKey  = '';
let rowEls  = [];
let imgKey  = null;
let lay     = null;

// Magazines up to this size draw one pip per round; larger ones (the cannon) draw a fill bar.
// Capacity decides, not the current count, so a row keeps its shape as ammo drains (as WPN).
const PIP_MAX = 12;

// ── Layout ─────────────────────────────────────────────────────────────────────────
function applyLayout() {
  const next = CougarWpnLayout.layoutFor(window.innerWidth, window.innerHeight);
  lay = next;
  const s = document.body.style;
  document.body.classList.remove('size-tall', 'size-mid', 'size-short');
  document.body.classList.add('size-' + next.size);
  document.body.classList.toggle('img-rot', next.rotate);
  s.setProperty('--cm-h', next.cmH + 'px');
  s.setProperty('--cols', String(next.cols));
  s.setProperty('--rows', String(next.rows));
  s.setProperty('--name-fs', next.nameFs + 'px');
  s.setProperty('--ammo-fs', next.ammoFs + 'px');
  s.setProperty('--cm-fs', next.cmFs + 'px');
  s.setProperty('--cm-title-fs', next.cmTitleFs + 'px');
  s.setProperty('--img-w', next.imageW + 'px');
  renderImage();
}

// ── Weapons ────────────────────────────────────────────────────────────────────────
function renderWpn() {
  const list = wpnData.items || [];
  wpnEl.classList.toggle('has-loadout', wpnData.hasLoadout);

  const key = list.map(function (w) { return w.n; }).join('|');
  if (key !== rowKey) {
    rowKey = key;
    listEl.textContent = '';
    rowEls = list.map(function (w) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'wp';
      row.title = w.n;
      row.setAttribute('aria-label', 'Select ' + w.n);
      const name = document.createElement('span');
      name.className = 'wp-name';
      name.textContent = w.n;
      const ammo = document.createElement('span');
      ammo.className = 'wp-ammo';
      const bar = document.createElement('span');
      bar.className = 'wp-bar';
      const count = document.createElement('span');
      count.className = 'wp-count';
      ammo.append(bar, count);
      row.append(name, ammo);
      row.addEventListener('click', function () {
        sendCommand('weapon.select', { wname: w.n }).catch(function () {});
      });
      listEl.appendChild(row);
      return { row: row, bar: bar, count: count };
    });
  }

  list.forEach(function (w, i) {
    const el = rowEls[i];
    if (!el) return;
    el.count.innerHTML = w.f > 0 ? '<span>' + w.a + '</span> / ' + w.f : '';
    renderBar(el.bar, w);
    el.row.classList.toggle('sel', w.n === wpnData.selWeapon);
    el.row.classList.toggle('soft', w.n !== wpnData.selWeapon && (w.n === wpnData.softGun || w.n === wpnData.softRel));
    el.row.classList.toggle('empty', w.f > 0 && w.a === 0);
  });

  safeEl.classList.toggle('show', wpnData.masterArmsOn === false);
  renderImage();
}

function renderBar(bar, w) {
  const pips = w.f > 0 && w.f <= PIP_MAX;
  bar.classList.toggle('pips', pips);
  bar.classList.toggle('fill', w.f > PIP_MAX);
  if (pips) {
    while (bar.children.length < w.f) bar.appendChild(document.createElement('span'));
    while (bar.children.length > w.f) bar.lastChild.remove();
    for (let j = 0; j < w.f; j++) bar.children[j].classList.toggle('on', j < w.a);
  } else if (w.f > PIP_MAX) {
    if (bar.children.length !== 1) { bar.textContent = ''; bar.appendChild(document.createElement('span')); }
    bar.firstChild.style.width = Math.max(0, Math.min(100, w.a / w.f * 100)) + '%';
  } else {
    bar.textContent = '';
  }
}

// The selected weapon's image, where the layout has room for it. It follows the selection even when
// that weapon is on another of the shell's pages, as WPN's does.
function renderImage() {
  const sel = wpnData.selWeapon;
  const show = !!(lay && lay.imageW > 0 && sel && wpnData.hasLoadout);
  imgBox.classList.toggle('show', show);
  if (!show) { imgKey = null; return; }
  if (sel !== imgKey) {
    imgKey = sel;
    imgEl.style.visibility = '';
    imgEl.src = '/weapon?name=' + encodeURIComponent(sel);
  }
}
imgEl.onerror = function () { imgEl.style.visibility = 'hidden'; };
imgEl.onload  = function () { imgEl.style.visibility = ''; };

// ── Countermeasures ────────────────────────────────────────────────────────────────
function renderCm() {
  cmFlaresVal.textContent = cmData.flares >= 0 ? cmData.flares : '—';
  if (cmData.ewKJ >= 0) cmJammerVal.innerHTML = Math.round(cmData.ewKJ) + '<span class="unit">kJ</span>';
  else cmJammerVal.textContent = '—';

  const pct = cmData.ewKJMax > 0 && cmData.ewKJ >= 0 ? Math.max(0, Math.min(1, cmData.ewKJ / cmData.ewKJMax)) : 0;
  cmBarFill.style.width = (pct * 100) + '%';

  const flaresEmpty = cmData.flaresMax > 0 && cmData.flares === 0;
  const jammerEmpty = cmData.ewKJMax > 0 && cmData.ewKJ === 0;
  cmFlaresTitle.classList.toggle('sel', cmData.cmCat === 1);
  cmFlaresTitle.classList.toggle('empty', flaresEmpty);
  cmFlaresVal.classList.toggle('empty', flaresEmpty);
  cmDots.classList.toggle('empty', flaresEmpty);
  cmJammerTitle.classList.toggle('sel', cmData.cmCat === 2);
  cmJammerTitle.classList.toggle('empty', jammerEmpty);
  cmJammerVal.classList.toggle('empty', jammerEmpty);

  const known = !flaresEmpty && cmData.flaresMax > 0 && cmData.flares >= 0;
  const spent = known ? Math.floor((cmData.flaresMax - cmData.flares) * flareDots.length / cmData.flaresMax) : 0;
  flareDots.forEach(function (d, i) { d.classList.toggle('spent', i < spent); });
}

// ── Shell → page ───────────────────────────────────────────────────────────────────
window.addEventListener('message', function (e) {
  const m = e.data;
  if (!m || m.mfd !== true) return;
  if (m.type === 'wpn') {
    const items = Array.isArray(m.items) ? m.items : [];
    wpnData = { items: items, selWeapon: m.selWeapon || null,
                softGun: m.softGun || null, softRel: m.softRel || null,
                masterArmsOn: m.masterArmsOn !== false,
                hasLoadout: typeof m.hasLoadout === 'boolean' ? m.hasLoadout : items.length > 0 };
    renderWpn();
  } else if (m.type === 'cm') {
    cmData = {
      flares:    typeof m.flares    === 'number' ? m.flares    : -1,
      flaresMax: typeof m.flaresMax === 'number' ? m.flaresMax : -1,
      ewKJ:      typeof m.ewKJ      === 'number' ? m.ewKJ      : -1,
      ewKJMax:   typeof m.ewKJMax   === 'number' ? m.ewKJMax   : -1,
      cmCat:     m.cmCat || 0,
    };
    renderCm();
  }
});

// The pane's size is this page's viewport, so a split preset or a window change arrives as a resize.
window.addEventListener('resize', applyLayout);

applyLayout();
renderWpn();
renderCm();
