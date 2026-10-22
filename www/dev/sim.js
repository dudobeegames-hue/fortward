'use strict';
// Fortward – simulácia kampane automatickým hráčom (len na ladenie vyváženia, hra ho nenačítava).
// Použitie v konzole: await import('./dev/sim.js') alebo vložiť <script>; potom SIM.campaign()
window.SIM = (() => {
  const F = window.FW, s = F.st, G = F.G;
  const cost = k => F.costOf(k);
  const free = (c, r) => F.inZone(c, r) && !F.inHall(c, r) && !F.occAt(c, r);
  const count = k => s.blds.filter(b => b.kind === k).length;
  // limity ako v hre: vojenské budovy spolu a bane podľa radnice, kaplnky a dielne najviac 3
  const MIL = ['barracks', 'range', 'stables', 'armory', 'falconry'];
  const full = k => (MIL.includes(k) ? s.blds.filter(b => MIL.includes(b.kind)).length : count(k)) >= F.bldLimit(k);
  function place(kind, c, r) {
    if (!F.has(kind) || full(kind) || !free(c, r) || s.gold < cost(kind)) return false;
    s.gold -= cost(kind); F.addBuilding(kind, c, r); return true;
  }

  const camp = () => !!s.camp && s.camp.parts.some(o => o.hp > 0); // stojí ešte tábor hordy (od misie 6)?
  // obliehacie stroje (prežívajú medzi vlnami): kým stojí tábor, baranidlo a ohnivý voz naň idú, katapult ho ostreľuje,
  // veža ich sprevádza; bez tábora katapult spoza šíku, veža k lukostrelcom, ohnivý voz so šíkom, neskôr baranidlo
  const SIEGE_TECH = { ram: 'siegeRam', cat: 'siegeCat', fire: 'siegeFire', tower: 'siegeTower' };
  function siegePlan() {
    const w = s.wave + 1;
    const want = camp()
      ? [['ram', 1], ['cat', w >= 2 ? 1 : 0], ['fire', w >= 3 ? 1 : 0], ['tower', w >= 4 ? 1 : 0], ['ram', w >= 5 ? 2 : 0]]
      : [['cat', w >= 3 ? 1 : 0], ['tower', w >= 4 ? 1 : 0], ['fire', w >= 5 ? 1 : 0], ['cat', w >= 7 ? 2 : 0], ['ram', w >= 8 ? 1 : 0]];
    return want.filter(([k, n]) => n > 0 && F.has(SIEGE_TECH[k]));
  }
  const nSiege = k => s.soldiers.filter(u => u.siege === k && !u.dead).length + (s.siegeOrder || []).filter(o => o.key === k).length;
  const missingSiege = () => siegePlan().find(([k, n]) => nSiege(k) < n);
  // rezerva zlata na najbližší chýbajúci stroj
  const reserve = () => { const m = missingSiege(); return m ? F.SIEGE_BUY[m[0]].cost : 0; };
  function placeAny(kind, rows, order) {
    for (const r of rows) for (const c of order) if (!F.inHall(c, r) && place(kind, c, r)) {
      const b = s.blds[s.blds.length - 1];
      if (F.knightsBlocked(b)) { s.gold += cost(kind); s.blds.pop(); F.rebuildOcc(); continue; } // vojaci by nevyšli
      return true;
    }
    return false;
  }

  // stavanie medzi vlnami – rozumný, nie dokonalý hráč
  function build() {
    const hr0 = G.hr0, hc = G.hc0 + 1, cols = G.cols;
    const order = [...Array(cols).keys()].sort((a, b) => Math.abs(a - hc) - Math.abs(b - hc));
    const pitRow = hr0 - 3, wallRow = hr0 - 2, towerRow = hr0 - 1;
    const rc = F.repairCost();
    if (rc && s.gold >= rc && rc >= 15) {
      s.gold -= rc;
      s.blds.forEach(b => { if (F.BUILD[b.kind].hp) b.hp = F.bMaxHp(b); }); F.rebuildOcc();
    }
    if (s.king.dead && s.gold >= F.reviveCost()) F.reviveKing();
    if (s.hallLvl < F.hallCap() && s.gold >= F.hallUpCost() + 60) { s.gold -= F.hallUpCost(); s.hallLvl++; s.hallHp += 200; s.king.hp = F.kingMax(); F.rebuildOcc(); }
    // najprv aspoň 3 veže, až potom hradby
    for (const c of order) { if (count('tower') >= 3) break; if (c !== hc) place('tower', c, towerRow); }
    if (count('tower') >= 3) for (const c of order) place('wall', c, wallRow);
    const gate = s.blds.find(b => b.kind === 'wall' && b.c === hc && b.r === wallRow);
    if (gate && F.has('gate') && !gate.gate && !gate.unit && s.gold >= 20) { s.gold -= 20; gate.spent += 20; gate.gate = true; }
    let guard = 0, acted = true;
    while (acted && guard++ < 80) {
      acted = false;
      const wave = s.wave + 1;
      const wantTowers = Math.min(cols - 1, 2 + Math.floor(wave / 2) + (s.mission > 3 ? 1 : 0));
      if (count('tower') < wantTowers) for (const c of order) { if (c === hc) continue; if (place('tower', c, towerRow)) { acted = true; break; } }
      if (acted) continue;
      if (F.has('barracks') && count('barracks') < (wave >= 5 ? 2 : 1)) {
        for (const r of [hr0, hr0 + 1]) for (const c of [G.hc0 - 1, G.hc0 + 3]) if (!acted && place('barracks', c, r)) acted = true;
        if (acted) continue;
      }
      if (F.has('range') && count('range') < 1 && count('barracks') >= 1) {
        for (const r of [hr0, hr0 + 1]) for (const c of [G.hc0 + 3, G.hc0 - 1, G.hc0 - 2, G.hc0 + 4]) if (!acted && place('range', c, r)) acted = true;
        if (acted) continue;
      }
      // nové jednotky: stajne, zbrojnica (proti jazde), sokoliareň (proti letcom)
      const rows = [hr0 + 1, hr0, hr0 + 2, hr0 - 1];
      if (F.has('armory') && count('armory') < (s.mission >= 7 ? 1 + (wave >= 5 ? 1 : 0) : 0) && count('barracks') >= 1) { if (placeAny('armory', rows, order)) { acted = true; continue; } }
      if (F.has('stables') && count('stables') < (wave >= 3 ? 1 : 0) && count('barracks') >= 1) { if (placeAny('stables', rows, order)) { acted = true; continue; } }
      if (F.has('falconry') && count('falconry') < (wave >= 2 ? 1 : 0)) { if (placeAny('falconry', rows, order)) { acted = true; continue; } }
      if (F.has('mage') && count('mage') < (wave >= 6 ? 3 : 2)) {
        for (const r of [hr0, hr0 + 1, hr0 + 2]) for (const c of order) if (!acted && !F.inHall(c, r) && place('mage', c, r)) acted = true;
        if (acted) continue;
      }
      const walls = s.blds.filter(b => b.kind === 'wall' && !b.gate && !b.unit);
      if (walls.length) {
        const type = F.has('wallCrossbow') && s.gold >= 70 && walls.length % 2 === 0 ? 'crossbow' : F.has('wallArcher') && s.gold >= 40 ? 'archer' : null;
        if (type) { const w = walls[0]; s.gold -= F.WUNIT[type].cost; w.unit = { type, lvl: 1, cd: 0.3, spent: F.WUNIT[type].cost }; acted = true; continue; }
      }
      // nové budovy (ak sú odomknuté)
      if (F.has('mine') && count('mine') < (wave >= 3 ? 2 : 1) && wave <= 7) {
        for (const r of [hr0 + 2, hr0 + 1]) for (const c of [G.hc0 - 2, G.hc0 + 4, G.hc0 - 1, G.hc0 + 3]) if (!acted && place('mine', c, r)) acted = true;
        if (acted) continue;
      }
      if (F.has('chapel') && count('chapel') < 1) { for (const r of [hr0, hr0 + 1]) for (const c of order) if (!acted && !F.inHall(c, r) && place('chapel', c, r)) acted = true; if (acted) continue; }
      if (F.has('workshop') && count('workshop') < 1) { for (const r of [hr0 + 2, hr0 + 1]) for (const c of order) if (!acted && !F.inHall(c, r) && place('workshop', c, r)) acted = true; if (acted) continue; }
      // pasce pred hradbami: jamy, oheň, medvedie pasce
      const trapKind = F.has('firepit') && count('firepit') < 3 ? 'firepit' : F.has('beartrap') && count('beartrap') < 2 ? 'beartrap' : F.has('pit') && count('pit') < 5 ? 'pit' : null;
      if (trapKind) for (const c of order) { if (place(trapKind, c, pitRow)) { acted = true; break; } }
      if (acted) continue;
      // ostne, špecializácia, druh rytierov
      if (F.has('spikes')) { const w = s.blds.find(b => b.kind === 'wall' && !b.spikes); if (w && s.gold >= 25) { s.gold -= 25; w.spikes = true; acted = true; continue; } }
      if (F.has('spec')) { const t = s.blds.find(b => b.kind === 'tower' && b.lvl >= 3 && !b.spec); if (t && s.gold >= 80) { s.gold -= 80; t.spec = 'rapid'; acted = true; continue; } }
      const ups = [];
      for (const b of s.blds) {
        if (['tower', 'mage', 'barracks', 'range', 'stables', 'armory', 'falconry', 'mine', 'chapel', 'workshop'].includes(b.kind) && b.lvl < F.bCap()) ups.push({ c: F.bUpCost(b), f: () => { b.spent += F.bUpCost(b); b.lvl++; b.hp = F.bMaxHp(b); } });
        if (b.kind === 'wall' && b.lvl < Math.min(F.bCap(), 3) && s.wave >= 4) ups.push({ c: F.bUpCost(b) * 6, real: F.bUpCost(b), f: () => { b.lvl++; b.hp = F.bMaxHp(b); } });
      }
      if (F.has('volleyUp') && s.volleyLvl < 6) ups.push({ c: F.volleyUpCost(), f: () => { s.volleyLvl++; } });
      ups.sort((a, b) => a.c - b.c);
      const u = ups[0];
      if (u && s.gold - (u.real || u.c) >= reserve()) { s.gold -= (u.real || u.c); u.f(); acted = true; F.rebuildOcc(); }
    }
  }

  // šípová salva do najväčšej skupiny
  function aiVolley(useVolley) {
    if (!useVolley || s.volleyT > 0 || !s.enemies.length || !F.kingMeta.slots.includes('volley')) return;
    let best = null, bn = 0;
    for (const e of s.enemies) {
      let n = 0; for (const o of s.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) < 13) n++;
      if (n > bn || (n === bn && best && e.y > best.y)) { bn = n; best = e; }
    }
    if (best) F.castSpell('volley', best.x, best.y - 5);
  }

  // obliehacie stroje sa objednajú počas stavby podľa plánu (v poradí dôležitosti) a vyrazia so začiatkom vlny;
  // floor = koľko zlata musí po nákupe ostať (pred stavaním, aby nechýbalo na obranu radnice)
  function aiSiege(floor) {
    for (const [k, n] of siegePlan()) {
      while (nSiege(k) < n && s.gold - F.SIEGE_BUY[k].cost >= floor && F.orderSiege(k)) {}
      if (nSiege(k) < n) break; // na dôležitejší stroj nestačí zlato – lacnejšie ho nepredbehnú
    }
  }

  // kráľove schopnosti
  function aiAbilities() {
    if (F.has('warcry') && s.cryCd <= 0) {
      let n = 0; for (const e of s.enemies) if (e.foe) n++;
      if (n >= 3) F.ability('warcry');
    }
    // kúzla do najväčšej skupiny: ohnivá guľa, mráz pri radnici, blesk na najbližšieho k radnici
    const crowd = R => { let best = null, bn = 0; for (const e of s.enemies) { let n = 0; for (const o of s.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) < R) n++; if (n > bn) { bn = n; best = e; } } return [best, bn]; };
    if (F.kingMeta.slots.includes('freeze') && s.freezeCd <= 0) {
      let n = 0; for (const e of s.enemies) if (Math.hypot(e.x - G.hallCx, e.y - G.hallTop) < 70) n++;
      const [b] = crowd(24);
      if (n >= 6 && b) F.castSpell('freeze', b.x, b.y);
    }
    if (F.kingMeta.slots.includes('lightning') && s.boltCd <= 0 && s.enemies.length) {
      const e = s.enemies.reduce((a, o) => (o.y > a.y ? o : a));
      F.castSpell('lightning', e.x, e.y);
    }
  }

  function fillSlots() {
    const k = F.kingMeta;
    k.slots = k.slots || [null, null, null];
    k.slots.forEach((v, i) => { if (!v && k.lvl >= F.KING_SLOT_LVL[i]) k.slots[i] = F.heroDef().powers.find(p => !k.slots.includes(p)); }); // schopnosti nasadeného hrdinu
  }
  function mission(m, opts) {
    opts = Object.assign({ volley: true, siege: true }, opts); // siege: false = hráč bez obliehacích strojov (na porovnanie)
    fillSlots();
    F.startMission(m, 0, opts.endless); // endless: nekonečná obrana (hrá, kým radnica nepadne)
    const waves = [];
    for (;;) {
      if (s.phase === 'build') { if (opts.siege) aiSiege(camp() ? 150 : 200); build(); if (opts.siege) aiSiege(0); F.startWave(); } // stroj sa kúpi pred stavbami, len ak ostane dosť zlata
      let steps = 0;
      const limit = 60 * 400;
      while (s.phase === 'battle' && steps < limit) { F.update(1 / 60); steps++; if (steps % 15 === 0) { aiVolley(opts.volley); aiAbilities(); } }
      waves.push(Math.round(s.hallHp / F.hallMax() * 100));
      if (s.phase === 'pause') { fillSlots(); F.enterBuild(); continue; }
      const campLeft = s.camp ? s.camp.parts.filter(o => o.hp > 0).length + '/' + s.camp.parts.length : null; // stojace stavby tábora
      return { m, won: s.phase === 'won', timeout: s.phase === 'battle', wave: s.wave, minHall: Math.min(...waves), hallLvl: s.hallLvl, gold: s.gold, waves: waves.join(' '), camp: campLeft, enemies: s.enemies.length, soldiers: s.soldiers.length };
    }
  }

  // celá kampaň od misie 1 (postup hráča v prehliadači sa po skončení obnoví)
  function campaign(opts) {
    const saved = localStorage.getItem('fortward.s1.unlocked');
    const savedStars = localStorage.getItem('fortward.s1.stars'), metaStars = F.meta.stars.slice();
    s.unlocked = 1;
    const out = [];
    for (let m = 1; m <= 10; m++) {
      let r = null;
      for (let attempt = 1; attempt <= ((opts && opts.retries) || 3); attempt++) {
        r = mission(m, opts); r.attempt = attempt;
        if (r.won) break;
      }
      out.push(r);
      if (!r.won) break;
    }
    if (saved === null) localStorage.removeItem('fortward.s1.unlocked'); else localStorage.setItem('fortward.s1.unlocked', saved);
    if (savedStars === null) localStorage.removeItem('fortward.s1.stars'); else localStorage.setItem('fortward.s1.stars', savedStars);
    F.meta.stars.length = 0; metaStars.forEach((v, i) => { F.meta.stars[i] = v; });
    s.unlocked = Math.max(1, parseInt(saved || '1', 10) || 1);
    return out;
  }
  return { mission, campaign, build };
})();
