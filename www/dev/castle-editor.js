'use strict';
// Fortward – editor hradov: hrady protivníka pre misie 6–10 sa stavajú do mriežky bojiska ako budovy v hre
// a ukladajú cez dev server (POST /castles) do js/castles.js.
(() => {
  // bojisko najnižšieho telefónu (11 stĺpcov mriežky, políčko 16 px), predĺžené ako v misiách s táborom: hrad je hore,
  // na vyššom displeji je od zóny hráča ďalej, takže čo sa zmestí tu, nezasiahne do zóny nikde
  const SCREEN_H = 360, T = 16, W = 200, H = SCREEN_H + Math.round(SCREEN_H * CAMP_EXTRA), GROUND_PAD = 10, MAX_LVL = 5, SCALE = 2;
  const G = { T, cols: 11 };
  G.gx0 = Math.floor((W - G.cols * T) / 2); G.rows = Math.floor((H - GROUND_PAD) / T); G.gy0 = H - GROUND_PAD - G.rows * T;
  const tileX = c => G.gx0 + c * T, tileY = r => G.gy0 + r * T;
  G.hc0 = Math.floor(G.cols / 2) - 1; G.hr0 = G.rows - 3;
  G.hallCx = tileX(G.hc0) + 1.5 * T; G.hallTop = tileY(G.hr0); G.hallBot = G.hallTop + 3 * T;
  const ZONE_ROW = G.rows - (5 + MAX_LVL); // najvyšší riadok zóny hráča (pri radnici najvyššej úrovne)
  G.zoneTopMax = tileY(ZONE_ROW);
  const HUD_BAND = 20, TOWER_REACH = G.zoneTopMax - 96; // horný pás pod HUD; približný najďalší dostrel veží zo zóny
  const ROW_MIN = 1;                                     // riadok 0 zakrýva HUD

  initSprites(); initBuildingSprites();
  const cv = document.getElementById('field'), g = cv.getContext('2d');
  cv.width = W * SCALE; cv.height = H * SCALE; g.imageSmoothingEnabled = false;
  const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const b = buf.getContext('2d');

  // pracovná kópia hradov; uloží sa celá naraz
  let data = JSON.parse(JSON.stringify(typeof CASTLES !== 'undefined' ? CASTLES : { orc: {}, human: {} }));
  for (const r of Object.keys(CAMP_PIECES)) data[r] = data[r] || {};
  // záloha neuložených zmien v prehliadači (keby nebežal dev server alebo sa okno zavrelo)
  const DRAFT = 'fortward-castle-draft';
  const saveDraft = () => { try { localStorage.setItem(DRAFT, JSON.stringify(data)); } catch (e) { /* bez zálohy */ } };
  const dropDraft = () => { try { localStorage.removeItem(DRAFT); } catch (e) { /* bez zálohy */ } };
  let draft = null;
  try { draft = localStorage.getItem(DRAFT); } catch (e) { /* bez zálohy */ }
  let mission = 6, race = 'orc', tool = null, sel = null, drag = null, dirty = false, scene = null, hover = null;
  const lay = () => (data[race][mission] = data[race][mission] || []);
  const $ = id => document.getElementById(id);
  const pcOf = q => CAMP_PIECES[race][q.k];
  const sizeOf = k => campSize(CAMP_PIECES[race][k]);
  const setDirty = v => { dirty = v; $('saveBtn').classList.toggle('dirty', v); status(v ? 'Neuložené zmeny' : ''); if (v) rebuildSoon(); };
  const status = t => { $('status').textContent = t; };
  const inReach = q => tileY(q.r + sizeOf(q.k)[1]) > TOWER_REACH;
  // úroveň stavby (1–5) ako v hre: v uložení q.l, úroveň 1 sa neukladá
  const lvlOf = q => q.l || 1;
  const setLvl = (q, l) => { if (pcOf(q) && pcOf(q).fixed) l = 1; l = Math.max(1, Math.min(CAMP_MAX_LVL, l)); if (l === lvlOf(q)) return false; if (l > 1) q.l = l; else delete q.l; return true; };
  // najvyššia úroveň, ktorú má hráč v misii m (podľa odomknutí lvl2–lvl5)
  const playerLvlAt = m => 1 + [2, 3, 4, 5].filter(l => unlockMissionOf('lvl' + l) <= m).length;
  const hpOf = q => { const pc = pcOf(q); return pc ? CAMP_ROLES[pc.role].hp * (pc.hp || 1) * campHpMul(lvlOf(q)) : 0; };
  function changeLvl(d) {
    if (!sel || !setLvl(sel, lvlOf(sel) + d)) return;
    setDirty(true); renderAll();
  }

  // uzol mapy ako v hre (nodeOf): proti ľuďom hrá hráč za orkov opačnú kampaň, misia m leží na uzle 10 − m
  const mDefs = () => race === 'human' ? ORC_MISSIONS : MISSIONS; // názvy misií podľa kampane, ktorú hráč hrá
  const nodeAt = m => race === 'human' ? MISSIONS.length - m : m - 1;
  function buildField() { scene = buildScene(W, H, G, 7 + (nodeAt(mission) + 1) * 13, nodeAt(mission), campClearRects(lay(), G), race === 'human' ? 'planks' : null); }
  let sceneTimer = 0; // po zmene hradu sa krajina prekreslí (pod stavbami nebudú stromy ani skaly)
  const rebuildSoon = () => { clearTimeout(sceneTimer); sceneTimer = setTimeout(() => { buildField(); draw(); if (dirty) saveDraft(); }, 200); };

  // ---- mriežka: stavba zaberá w×h políčok, nesmie zasahovať do inej ani do zóny hráča ----
  function fits(k, c, r, skip) {
    const [w, h] = sizeOf(k);
    if (c < 0 || r < ROW_MIN || c + w > G.cols || r + h > ZONE_ROW) return false;
    for (const q of lay()) {
      if (q === skip) continue;
      const [qw, qh] = sizeOf(q.k);
      if (c < q.c + qw && q.c < c + w && r < q.r + qh && q.r < r + h) return false;
    }
    return true;
  }
  const pieceAtTile = (c, r) => lay().find(q => { const [w, h] = sizeOf(q.k); return c >= q.c && c < q.c + w && r >= q.r && r < q.r + h; });

  // ---- kreslenie ----
  function drawPiece(q, alpha) {
    const pc = pcOf(q); if (!pc) return;
    const o = { fired: 0, lvl: q.l || 1, mask: CAMP_WALLS[q.k] ? campWallMask(lay(), q) : null };
    const sp = pc.spr(o, performance.now() / 1000), [w, h] = campSize(pc);
    const x = Math.round(tileX(q.c) + w * T / 2 - sp.w / 2), y = tileY(q.r + h) - sp.h + (pc.dy || 0);
    b.globalAlpha = alpha || 1;
    b.fillStyle = 'rgba(0,0,0,0.25)'; b.beginPath(); b.ellipse(tileX(q.c) + w * T / 2, tileY(q.r + h) - 1, Math.min(sp.w, w * T) * 0.4, 2, 0, 0, 6.29); b.fill();
    if (CAMP_WALLS[q.k]) campWallSlices(b, o, campWallBld(lay(), q), tileX(q.c), tileY(q.r + h), CAMP_PIECES[race].wall); // napojenie na susednú vežu
    b.drawImage(sp.c, x, y);
    if ((q.l || 1) > 1 && !pc.lvlArt) pxText(b, String(q.l), Math.round(tileX(q.c) + w * T) - 5, tileY(q.r + h) - 7, '#f8d048'); // úroveň stavby bez vlastného vzhľadu
    b.globalAlpha = 1;
  }
  function frame(c, r, w, h, col) {
    b.strokeStyle = col; b.lineWidth = 1; b.strokeRect(tileX(c) + 0.5, tileY(r) + 0.5, w * T - 1, h * T - 1);
  }
  function draw() {
    b.clearRect(0, 0, W, H);
    b.drawImage(scene.bg, 0, 0);
    b.fillStyle = 'rgba(232,72,56,0.22)'; b.fillRect(G.gx0, G.zoneTopMax, G.cols * T, G.hallBot - G.zoneTopMax); // zóna hráča
    b.fillStyle = 'rgba(255,255,255,0.10)';
    for (let c = 0; c <= G.cols; c++) b.fillRect(tileX(c), G.gy0, 1, G.rows * T);
    for (let r = 0; r <= G.rows; r++) b.fillRect(G.gx0, tileY(r), G.cols * T, 1);
    const hall = race === 'human' ? OBSPR.hall[0] : BSPR.hall[0]; // proti ľudským hradom hrá hráč za orkov
    b.drawImage(hall.c, Math.round(G.hallCx - hall.w / 2), G.hallBot - hall.h);
    b.fillStyle = '#f8d048'; for (let x = G.gx0; x < G.gx0 + G.cols * T; x += 4) b.fillRect(x, TOWER_REACH, 2, 1); // dostrel veží
    const items = lay().slice().sort((p, o) => (p.r + sizeOf(p.k)[1]) - (o.r + sizeOf(o.k)[1]) || o.c - p.c);
    for (const q of items) {
      if (drag && drag.q === q && drag.moved) continue;
      drawPiece(q);
      if (inReach(q)) { const [w, h] = sizeOf(q.k); b.fillStyle = '#e84838'; b.fillRect(tileX(q.c) + 2, tileY(q.r + h) - 2, w * T - 4, 1); }
    }
    if (sel && !(drag && drag.moved)) { const [w, h] = sizeOf(sel.k); frame(sel.c, sel.r, w, h, '#fff070'); }
    b.fillStyle = 'rgba(0,0,0,0.45)'; b.fillRect(0, 0, W, G.gy0 + HUD_BAND); // pás pod HUD
    // náhľad: nová stavba pod myšou alebo ťahaná stavba – zelený rámik = dá sa, červený = nedá
    const ghost = drag && drag.moved ? { k: drag.q.k, c: drag.c, r: drag.r, skip: drag.q } : tool && hover ? { k: tool, c: hover.c, r: hover.r } : null;
    if (ghost) {
      const [w, h] = sizeOf(ghost.k), ok = fits(ghost.k, ghost.c, ghost.r, ghost.skip);
      drawPiece(ghost, 0.65);
      b.fillStyle = ok ? 'rgba(120,220,90,0.18)' : 'rgba(232,72,56,0.25)'; b.fillRect(tileX(ghost.c), tileY(ghost.r), w * T, h * T);
      frame(ghost.c, ghost.r, w, h, ok ? '#9cd45a' : '#e84838');
    }
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(buf, 0, 0, W * SCALE, H * SCALE);
  }

  // ---- paleta, zoznam, info ----
  const ROLE_NAME = { bombard: 'ostreľovač', tower: 'veža', totem: 'liečiteľ', drum: 'posilňovač', spawn: 'liaheň', wall: 'opevnenie', keep: 'srdce tábora', trap: 'pasca', support: 'podpora' };
  const UNIT_NAME = { goblin: 'goblini', orc: 'orkovia', brute: 'surovci', garcher: 'goblin-lukostrelci', bat: 'netopiere', shaman: 'šamani', bear: 'medvedí jazdci',
    sapper: 'podkopníci', wolf: 'vlčí jazdci', knight: 'rytieri', archer: 'lukostrelci', rider: 'jazdci', spear: 'kopijníci', falcon: 'sokoly' };
  const subOf = pc => pc.role === 'spawn' ? '→ ' + (pc.label || UNIT_NAME[pc.unit] || pc.unit) : ROLE_NAME[pc.role];
  function thumb(sp) { const c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h; c.getContext('2d').drawImage(sp.c, 0, 0); return c; }
  function renderPalette() {
    const pal = $('palette'); pal.innerHTML = '';
    for (const [k, pc] of Object.entries(CAMP_PIECES[race])) {
      const d = document.createElement('div'); d.className = 'pc' + (tool === k ? ' sel' : '');
      d.appendChild(thumb(pc.spr({ fired: 0 }, 0)));
      const [w, h] = campSize(pc);
      d.insertAdjacentHTML('beforeend', '<b>' + pc.name + '</b><small>' + subOf(pc) + (w * h > 1 ? ' · ' + w + '×' + h : '') + '</small>');
      d.title = CAMP_ROLES[pc.role].what;
      d.onclick = () => { tool = tool === k ? null : k; sel = null; renderAll(); };
      pal.appendChild(d);
    }
  }
  function renderInfo() {
    const k = sel ? sel.k : tool, pc = k && CAMP_PIECES[race][k];
    if (!pc) { $('info').textContent = 'Ťukni na stavbu v palete a potom na políčko bojiska.'; return; }
    const r = CAMP_ROLES[pc.role], [w, h] = campSize(pc);
    const L = sel ? lvlOf(sel) : 1, same = sel ? lay().filter(q => q.k === sel.k) : [], pl = playerLvlAt(mission);
    const power = pc.role === 'tower' || pc.role === 'bombard' ? ' · sila striel ×' + campPowMul(L).toFixed(1) : pc.role === 'totem' ? ' · liečenie ×' + (1 + 0.25 * (L - 1)).toFixed(2) : '';
    $('info').innerHTML = '<b>' + pc.name + (sel ? ' · úr. ' + L : '') + '</b> – ' + ROLE_NAME[pc.role] + (pc.role === 'spawn' ? ' (' + (pc.label || UNIT_NAME[pc.unit] || pc.unit) + ')' : '') + '<br>' + r.what +
      '<br>zdravie ' + Math.round(r.hp * (pc.hp || 1) * campHpMul(L)) + ' (+20 % za každú ďalšiu misiu)' + power + ' · zlato za zničenie ' + r.gold + ' · veľkosť ' + w + '×' + h + ' políčok' +
      (sel ? '<br>políčko stĺpec ' + sel.c + ', riadok ' + sel.r + (inReach(sel) ? ' · <span style="color:#e84838">v dosahu veží hráča</span>' : '') +
        (pc.fixed ? '<div class="help">nevylepšuje sa (ako v hre)</div>' : '<div class="lvl"><span>Úroveň</span><button id="lvlDown"' + (L <= 1 ? ' disabled' : '') + '>▼</button>' +
        '<span class="pips">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= L ? 'on' : '') + (i > pl ? ' over' : '') + '"></i>').join('') + '</span>' +
        '<button id="lvlUp" class="up"' + (L >= CAMP_MAX_LVL ? ' disabled' : '') + '>Vylepšiť ▲</button></div>' +
        (same.length > 1 ? '<div class="lvl"><span>Všetky ' + pc.name.toLowerCase() + ' (' + same.length + '×)</span><button id="lvlAll">na úroveň ' + L + '</button></div>' : '') +
        '<div class="help">hráč má v misii ' + mission + ' najviac úroveň ' + pl + (L > pl ? ' – <span style="color:#e84838">táto stavba je silnejšia</span>' : '') +
        (pc.lvlArt ? ' · vzhľad sa mení s úrovňou' : ' · úroveň je napísaná pri stavbe') + ' · klávesy <kbd>+</kbd> / <kbd>-</kbd></div>') +
        '<button class="del" id="delSel">Zmazať</button>' : '<br><i>Klikni na políčko bojiska a postav ju.</i>');
    if (sel) {
      $('delSel').onclick = () => removeSel();
      if ($('lvlUp')) { $('lvlUp').onclick = () => changeLvl(1); $('lvlDown').onclick = () => changeLvl(-1); }
      if ($('lvlAll')) $('lvlAll').onclick = () => { let ch = false; for (const q of same) ch = setLvl(q, L) || ch; if (ch) setDirty(true); renderAll(); };
    }
  }
  function renderList() {
    $('mLabel').textContent = mission + ' – ' + mDefs()[mission - 1].name + ' (' + (race === 'orc' ? 'orkovia' : 'ľudia') + ')';
    const list = $('list'); list.innerHTML = '';
    const L = lay();
    if (!L.length) list.innerHTML = '<span class="help">Hrad je prázdny – v misii nebude tábor.</span>';
    L.forEach(q => {
      const pc = pcOf(q), row = document.createElement('div');
      row.className = 'row' + (q === sel ? ' sel' : '');
      row.innerHTML = '<span>' + (pc ? pc.name : '? ' + q.k) + (lvlOf(q) > 1 ? ' <b class="lv">úr. ' + lvlOf(q) + '</b>' : '') + '</span><span class="help">stĺpec ' + q.c + ', riadok ' + q.r + '</span>' + (pc && inReach(q) ? '<span class="warn">v dosahu veží</span>' : '');
      row.onclick = () => { sel = q; tool = null; renderAll(); };
      list.appendChild(row);
    });
    const hp = L.reduce((s, q) => s + hpOf(q), 0);
    const roles = {}; for (const q of L) { const pc = pcOf(q); if (pc) roles[pc.role] = (roles[pc.role] || 0) + 1; }
    const units = [...new Set(L.map(pcOf).filter(pc => pc && pc.role === 'spawn').map(pc => pc.label || UNIT_NAME[pc.unit] || pc.unit))];
    $('sum').innerHTML = L.length ? L.length + ' stavieb · spolu ' + Math.round(hp) + ' zdravia (misia 6) · ' + Object.entries(roles).map(([r, n]) => ROLE_NAME[r] + ' ' + n).join(', ') +
      (units.length ? '<br>z tábora vychádzajú: ' + units.join(', ') + ' – ostatné druhy prichádzajú zhora' : '<br>tábor nemá liahne – všetky jednotky prichádzajú zhora') : '';
  }
  function renderMissions() {
    const box = $('missions'); box.innerHTML = '';
    for (let m = HOME_PROVINCES + 1; m <= MISSIONS.length; m++) {
      const bt = document.createElement('button'); bt.textContent = m; bt.title = mDefs()[m - 1].name;
      bt.className = m === mission ? 'on' : '';
      bt.onclick = () => { mission = m; sel = null; buildField(); renderAll(); };
      box.appendChild(bt);
    }
    for (const bt of document.querySelectorAll('[data-race]')) bt.className = bt.dataset.race === race ? 'on' : '';
  }
  function renderAll() { renderMissions(); renderPalette(); renderInfo(); renderList(); draw(); }

  // ---- myš: všetko po políčkach ----
  const tileAt = ev => { const rc = cv.getBoundingClientRect(), x = (ev.clientX - rc.left) / rc.width * W, y = (ev.clientY - rc.top) / rc.height * H;
    return { c: Math.floor((x - G.gx0) / T), r: Math.floor((y - G.gy0) / T), inside: x >= 0 && y >= 0 && x <= W && y <= H }; };
  cv.addEventListener('mousedown', ev => {
    const t = tileAt(ev);
    if (ev.button === 2) { const q = pieceAtTile(t.c, t.r); if (q) { sel = q; removeSel(); } return; }
    if (tool && !pieceAtTile(t.c, t.r)) { // stavba nová: na ľavé horné políčko pod myšou (ťuk na stavbu ju vyberie ako v hre)
      if (!fits(tool, t.c, t.r)) { status('Sem sa stavba nezmestí'); return; }
      lay().push({ k: tool, c: t.c, r: t.r }); setDirty(true); renderAll(); return;
    }
    const q = pieceAtTile(t.c, t.r);
    sel = q || null; if (q) tool = null;
    if (q) drag = { q, oc: t.c - q.c, or: t.r - q.r, c: q.c, r: q.r, moved: false };
    renderAll();
  });
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  window.addEventListener('mousemove', ev => {
    const t = tileAt(ev);
    hover = t.inside ? t : null;
    if (drag) { const c = t.c - drag.oc, r = t.r - drag.or; if (c !== drag.c || r !== drag.r) { drag.c = c; drag.r = r; drag.moved = true; } }
    draw();
  });
  window.addEventListener('mouseup', () => {
    if (!drag) return; // prekresľovať len po ťahu – inak by sa stratil klik na kartu v palete
    if (drag.moved) {
      if (fits(drag.q.k, drag.c, drag.r, drag.q)) { drag.q.c = drag.c; drag.q.r = drag.r; setDirty(true); }
      else status('Sem sa stavba nezmestí');
    }
    drag = null; renderAll();
  });
  function removeSel() { const L = lay(), i = L.indexOf(sel); if (i >= 0) { L.splice(i, 1); setDirty(true); } sel = null; renderAll(); }
  window.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { tool = null; sel = null; renderAll(); return; }
    if (!sel) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeSel(); return; }
    if (ev.key === '+' || ev.key === '=' || ev.key === 'PageUp') { ev.preventDefault(); changeLvl(1); return; }
    if (ev.key === '-' || ev.key === 'PageDown') { ev.preventDefault(); changeLvl(-1); return; }
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (mv) { ev.preventDefault(); if (fits(sel.k, sel.c + mv[0], sel.r + mv[1], sel)) { sel.c += mv[0]; sel.r += mv[1]; setDirty(true); renderAll(); } }
  });

  // ---- tlačidlá ----
  for (const bt of document.querySelectorAll('[data-race]')) bt.onclick = () => { race = bt.dataset.race; tool = null; sel = null; buildField(); renderAll(); };
  $('clearBtn').onclick = () => { if (!lay().length || !confirm('Vymazať celý hrad misie ' + mission + '?')) return; data[race][mission] = []; sel = null; setDirty(true); renderAll(); };
  $('copyBtn').onclick = () => {
    const m = parseInt(prompt('Z ktorej misie skopírovať hrad (' + (HOME_PROVINCES + 1) + '–' + MISSIONS.length + ')?'), 10);
    if (!(data[race][m] && data[race][m].length) || m === mission) { status('Misia ' + (m || '?') + ' nemá hrad'); return; }
    data[race][mission] = data[race][m].map(q => Object.assign({}, q)); sel = null; setDirty(true); renderAll();
  };
  $('saveBtn').onclick = async () => {
    try {
      const r = await fetch('/castles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      dropDraft(); setDirty(false); status('Uložené do js/castles.js – obnov hru');
    } catch (e) { saveDraft(); status('Uloženie zlyhalo: ' + e.message + ' – spusti Editor hradov.bat; zmeny sú zálohované v prehliadači'); }
  };
  $('revertBtn').onclick = async () => {
    if (dirty && !confirm('Zahodiť neuložené zmeny?')) return;
    try {
      const txt = await (await fetch('../js/castles.js?' + Date.now(), { cache: 'no-store' })).text();
      data = new Function(txt + '\nreturn CASTLES;')();
      for (const r of Object.keys(CAMP_PIECES)) data[r] = data[r] || {};
      dropDraft(); sel = null; setDirty(false); status('Načítané uložené hrady'); buildField(); renderAll();
    } catch (e) { status('Načítanie zlyhalo: ' + e.message); }
  };
  window.addEventListener('beforeunload', ev => { if (dirty) { saveDraft(); ev.preventDefault(); ev.returnValue = ''; } });

  // rozpracovaná záloha z minula, ktorá sa nedostala do js/castles.js
  if (draft && draft !== JSON.stringify(data) && confirm('Našli sa neuložené zmeny hradov z minula. Obnoviť ich?')) {
    data = JSON.parse(draft);
    for (const r of Object.keys(CAMP_PIECES)) data[r] = data[r] || {};
    dirty = true; $('saveBtn').classList.add('dirty'); status('Obnovené neuložené zmeny – ulož ich');
  } else if (draft) dropDraft();
  buildField(); renderAll();
  setInterval(draw, 250); // animované stavby (totem, bubon, brloh, dym chatrče)
})();
