'use strict';
// Fortward – simulácia kampane automatickým hráčom (len na ladenie vyváženia, hra ho nenačítava).
// Použitie v konzole: await import('./dev/sim.js') alebo vložiť <script>; potom SIM.campaign()
window.SIM = (() => {
  const F = window.FW, s = F.st, G = F.G;
  const cost = k => F.costOf(k);
  const free = (c, r) => F.inZone(c, r) && !F.inHall(c, r) && !F.occAt(c, r);
  const count = k => s.blds.filter(b => b.kind === k).length;
  function place(kind, c, r) {
    if (!F.has(kind) || !free(c, r) || s.gold < cost(kind)) return false;
    s.gold -= cost(kind); F.addBuilding(kind, c, r); return true;
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
      if (F.has('catapult') && count('catapult') < (wave >= 6 ? 2 : 1)) {
        for (const r of [hr0, hr0 + 1]) for (const c of order) if (!acted && !F.inHall(c, r) && place('catapult', c, r)) acted = true;
        if (acted) continue;
      }
      if (F.has('bell') && count('bell') < 1 && count('tower') >= 4) { for (const c of order) { if (c !== hc && place('bell', c, towerRow)) { acted = true; break; } } if (acted) continue; }
      if (F.has('chapel') && count('chapel') < 1) { for (const r of [hr0, hr0 + 1]) for (const c of order) if (!acted && !F.inHall(c, r) && place('chapel', c, r)) acted = true; if (acted) continue; }
      if (F.has('well') && count('well') < 1) { for (const r of [hr0 + 2, hr0 + 1]) for (const c of order) if (!acted && !F.inHall(c, r) && place('well', c, r)) acted = true; if (acted) continue; }
      // pasce pred hradbami: jamy, oheň, medvedie pasce
      const trapKind = F.has('firepit') && count('firepit') < 3 ? 'firepit' : F.has('beartrap') && count('beartrap') < 2 ? 'beartrap' : F.has('pit') && count('pit') < 5 ? 'pit' : null;
      if (trapKind) for (const c of order) { if (place(trapKind, c, pitRow)) { acted = true; break; } }
      if (acted) continue;
      // ostne, špecializácia, druh rytierov
      if (F.has('spikes')) { const w = s.blds.find(b => b.kind === 'wall' && !b.spikes); if (w && s.gold >= 25) { s.gold -= 25; w.spikes = true; acted = true; continue; } }
      if (F.has('spec')) { const t = s.blds.find(b => b.kind === 'tower' && b.lvl >= 3 && !b.spec); if (t && s.gold >= 80) { s.gold -= 80; t.spec = 'rapid'; acted = true; continue; } }
      if (F.has('knightTypes')) { const bk = s.blds.find(b => b.kind === 'barracks' && !b.ktype); if (bk && s.gold >= 50) { s.gold -= 50; bk.ktype = 'spear'; acted = true; continue; } }
      const ups = [];
      for (const b of s.blds) {
        if (['tower', 'mage', 'barracks', 'catapult', 'mine', 'bell', 'chapel'].includes(b.kind) && b.lvl < F.bCap()) ups.push({ c: F.bUpCost(b), f: () => { b.spent += F.bUpCost(b); b.lvl++; b.hp = F.bMaxHp(b); } });
        if (b.kind === 'wall' && b.lvl < Math.min(F.bCap(), 3) && s.wave >= 4) ups.push({ c: F.bUpCost(b) * 6, real: F.bUpCost(b), f: () => { b.lvl++; b.hp = F.bMaxHp(b); } });
        if (b.unit && b.unit.lvl < F.lvlCap()) ups.push({ c: F.uUpCost(b.unit), f: () => { b.unit.lvl++; } });
      }
      if (F.has('volleyUp') && s.volleyLvl < 6) ups.push({ c: F.volleyUpCost(), f: () => { s.volleyLvl++; } });
      ups.sort((a, b) => a.c - b.c);
      const u = ups[0];
      if (u && s.gold >= (u.real || u.c)) { s.gold -= (u.real || u.c); u.f(); acted = true; F.rebuildOcc(); }
    }
  }

  // šípová salva do najväčšej skupiny
  function aiVolley(useVolley) {
    if (!useVolley || s.volleyT > 0 || !s.enemies.length) return;
    let best = null, bn = 0;
    for (const e of s.enemies) {
      let n = 0; for (const o of s.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) < 13) n++;
      if (n > bn || (n === bn && best && e.y > best.y)) { bn = n; best = e; }
    }
    if (best) F.volley(best.x, best.y - 5);
  }

  // kráľove schopnosti
  function aiAbilities() {
    if (F.has('warcry') && s.cryCd <= 0) {
      let n = 0; for (const e of s.enemies) if (e.foe) n++;
      if (n >= 3) F.ability('warcry');
    }
    if (F.has('freeze') && s.freezeCd <= 0) {
      let n = 0; for (const e of s.enemies) if (Math.hypot(e.x - G.hallCx, e.y - G.hallTop) < 70) n++;
      if (n >= 6) F.ability('freeze');
    }
  }

  function mission(m, opts) {
    opts = Object.assign({ volley: true }, opts);
    F.startMission(m);
    const waves = [];
    for (;;) {
      if (s.phase === 'build') { build(); F.startWave(); }
      let steps = 0;
      while (s.phase === 'battle' && steps < 60 * 400) { F.update(1 / 60); steps++; if (steps % 15 === 0) { aiVolley(opts.volley); aiAbilities(); } }
      waves.push(Math.round(s.hallHp / F.hallMax() * 100));
      if (s.phase === 'pause') { F.enterBuild(); continue; }
      return { m, won: s.phase === 'won', wave: s.wave, minHall: Math.min(...waves), hallLvl: s.hallLvl, gold: s.gold, waves: waves.join(' ') };
    }
  }

  // celá kampaň od misie 1 (postup hráča v prehliadači sa po skončení obnoví)
  function campaign(opts) {
    const saved = localStorage.getItem('fortward.unlocked');
    const savedStars = localStorage.getItem('fortward.stars'), metaStars = F.meta.stars.slice();
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
    if (saved === null) localStorage.removeItem('fortward.unlocked'); else localStorage.setItem('fortward.unlocked', saved);
    if (savedStars === null) localStorage.removeItem('fortward.stars'); else localStorage.setItem('fortward.stars', savedStars);
    F.meta.stars.length = 0; metaStars.forEach((v, i) => { F.meta.stars[i] = v; });
    s.unlocked = Math.max(1, parseInt(saved || '1', 10) || 1);
    return out;
  }
  return { mission, campaign, build };
})();
