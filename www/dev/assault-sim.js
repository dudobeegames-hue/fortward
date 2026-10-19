'use strict';
// Fortward – simulácia útoku na hrad (posledná misia ostrova) automatickým hráčom, len na ladenie vyváženia.
// Použitie v konzole hry: vložiť <script src="dev/assault-sim.js">, potom await SIMA.sweep([500, 1000, 1500], 3)
// Pozor: výsledok misie sa zapíše do uloženej pozície (truhlica, hviezdy) – spúšťať len na skúšobnom serveri.
window.SIMA = (() => {
  const F = window.FW, s = F.st;
  // poradie nákupu oddielov: najprv stroje na hradby, potom pešiaci a strelci, nakoniec doplnky
  const ORDER = ['ram', 'cat', 'knight', 'knight', 'archer', 'knight', 'spear', 'archer', 'knight', 'rider', 'archer', 'spear', 'monk',
    'ram', 'cat', 'tower', 'fire', 'knight', 'archer', 'spear', 'rider'];
  function deploy(budget) {
    const cells = [];
    for (let r = F.zoneTopRow(); r < F.G.rows; r++) for (let c = 0; c < F.G.cols; c++) cells.push({ c, r });
    let skips = 0;
    for (let i = 0; skips < ORDER.length; i++) {
      const k = ORDER[i % ORDER.length], a = F.ARMY[k];
      const full = a.siege && s.deps.filter(d => d.key === k).length >= 2;
      if (full || s.gold < a.cost || !F.has(a.siege ? F.SIEGE_BUY[k].siege : a.home)) { skips++; continue; }
      const cell = cells.find(q => !F.depAt(q.c, q.r) && F.inZone(q.c, q.r) && F.deployArmy(k, q.c, q.r));
      if (!cell) break; // zóna je plná
      skips = 0;
    }
  }
  async function run(budget) {
    s.chest = budget;
    F.startMission(10, 0);
    s.introPan = null;
    deploy(budget);
    const spent = budget - s.gold, units = s.soldiers.length;
    F.startWave();
    let t = 0;
    while (s.phase === 'battle' && t < 900) {
      for (let k = 0; k < 600 && s.phase === 'battle'; k++) { F.update(1 / 60); t += 1 / 60; }
      await new Promise(r => setTimeout(r, 0));
    }
    const keep = s.camp.parts.find(o => o.role === 'keep');
    return { budget, spent, units, won: s.phase === 'won', time: Math.round(t), keep: Math.round(100 * Math.max(0, keep.hp) / keep.max), left: s.soldiers.filter(u => !u.dead).length };
  }
  async function sweep(budgets, n) {
    const out = [];
    for (const b of budgets) {
      const rs = [];
      for (let i = 0; i < (n || 3); i++) rs.push(await run(b));
      out.push({ budget: b, wins: rs.filter(r => r.won).length + '/' + rs.length, spent: rs[0].spent, units: rs[0].units,
        keepLeft: rs.map(r => r.keep).join(','), time: rs.map(r => r.time).join(','), left: rs.map(r => r.left).join(',') });
    }
    return out;
  }
  return { run, sweep, deploy };
})();
