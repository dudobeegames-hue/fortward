'use strict';
// Fortward – prototyp: radnica s kráľom, stavanie obrany na mriežke, hordy zhora.
(function () {
  const $ = id => document.getElementById(id);
  const screen = $('screen'), sctx = screen.getContext('2d');
  const buf = document.createElement('canvas');
  const g = buf.getContext('2d', { willReadFrequently: true });

  const T = 16;            // veľkosť políčka mriežky
  const MAX_LVL = 5;
  const GRID_COLS = 11;     // šírka hracej mriežky v políčkach
  const GROUND_PAD = 10;    // pás terénu pod mriežkou (herné px), aby radnica nestála priamo na paneli
  let W = 180, H = 360, S = 1, DPR = 1, scene = null;
  let camY = 0; // o koľko herných pixelov je bojisko posunuté nahor (kvôli panelu dole)
  const G = { T, gx0: 0, gy0: 0, cols: 11, rows: 24, hc0: 4, hr0: 20, hallCx: 0, hallTop: 0, hallBot: 0, zoneTopMax: 0 };

  // ---------------- Dáta ----------------
  const BUILD = {
    tower:    { name: 'Strážna veža', short: 'Veža',   cost: 60,  hp: 240, range: 80, dmg: 7,  cd: 0.9, proj: 'arrow', speed: 180, block: true, desc: 'Lukostrelec strieľa na hordu v dosahu' },
    barracks: { name: 'Kasárne',      short: 'Kasárne', cost: 90, hp: 220, block: true, desc: 'Posiela rytierov proti horde' },
    range:    { name: 'Strelnica',    short: 'Strelnica', cost: 100, hp: 200, block: true, desc: 'Vysiela lukostrelcov, ktorí sa držia za rytiermi a strieľajú z diaľky' },
    mage:     { name: 'Veža mága',    short: 'Mág',    cost: 150, hp: 240, range: 70, dmg: 14, cd: 2.2, proj: 'fire', speed: 115, splash: 16, block: true, desc: 'Ohnivá guľa zasiahne celú skupinu' },
    wall:     { name: 'Hradby',       short: 'Hradby', cost: 12,  hp: 240, block: true, desc: 'Zatarasí cestu – horda ich musí rozbiť alebo obísť' },
    pit:      { name: 'Jama s ostňami', short: 'Jama', cost: 30,  dmg: 12, block: false, desc: 'Zraní a spomalí každého, kto ňou prejde' },
    catapult: { name: 'Katapult',     short: 'Katapult', cost: 140, hp: 200, range: 150, minRange: 36, dmg: 26, cd: 3.6, proj: 'rock', speed: 120, splash: 20, block: true, desc: 'Hádže balvany ďaleko do hordy (nie na lietajúcich)' },
    mine:     { name: 'Zlatá baňa',   short: 'Baňa',   cost: 100, hp: 180, block: true, desc: 'Po každej prežitej vlne prinesie zlato' },
    chapel:   { name: 'Kaplnka',      short: 'Kaplnka', cost: 120, hp: 200, block: true, desc: 'Vyšle mnícha, ktorý chodí za rytiermi a kráľom a lieči ich' },
    firepit:  { name: 'Ohnivá jama',  short: 'Oheň',   cost: 50,  dmg: 8, block: false, desc: 'Kto ňou prejde, niekoľko sekúnd horí' },
    beartrap: { name: 'Medvedia pasca', short: 'Pasca', cost: 40, block: false, desc: 'Chytí nepriateľa a na chvíľu ho zastaví' },
    workshop: { name: 'Dielňa remeselníka', short: 'Dielňa', cost: 90, hp: 180, block: true, desc: 'Vyšle remeselníka, ktorý chodí opravovať poškodené budovy' },
  };
  const TRAPS = { pit: 1, firepit: 1, beartrap: 1 };
  const FIRE_BURN = 4; // ohnivá jama: horenie trvá 4 s (pri 8/s = 32 poškodenia – viac za zlato ako jama s ostňami, tá zas spomaľuje)
  const SHOOTERS = { tower: 1, mage: 1, catapult: 1 };
  // špecializácie veží (od úrovne 3)
  const SPECS = {
    fire:   { name: 'Ohnivé šípy',   desc: 'zásah zapáli nepriateľa', col: '#f89838', dmg: 1,    cd: 1,    range: 0 },
    rapid:  { name: 'Rýchla streľba', desc: 'strieľa takmer 2× rýchlejšie', col: '#9cd45a', dmg: 0.75, cd: 0.55, range: 0 },
    sniper: { name: 'Ostreľovač',    desc: 'veľký dosah a silný zásah', col: '#c8a0ff', dmg: 1.7,  cd: 1.3,  range: 45 },
  };
  const SPEC_COST = 80;
  // druhy rytierov v kasárňach
  const KTYPES = {
    knight: { name: 'Rytier',      spr: 'soldier', hp: 1,   dmg: 1,    spd: 26, desc: 'vyvážený' },
    spear:  { name: 'Kopijník',    spr: 'spear',   hp: 1.5, dmg: 0.85, spd: 24, desc: 'vydrží dlhšie' },
    rider:  { name: 'Jazdec',      spr: 'rider',   hp: 0.9, dmg: 1.25, spd: 46, desc: 'rýchly, ide ďaleko' },
    shield: { name: 'Štítonosič',  spr: 'shield',  hp: 2.3, dmg: 0.5,  spd: 20, desc: 'útoky naň majú polovičnú silu' },
  };
  const KTYPE_COST = 50, SPIKE_COST = 25, SPIKE_TYPE_COST = 40;
  const spikeDmg = b => 4 + 3 * (b.lvl - 1);
  // druhy ostňov (od misie 9): ohnivé zapália, ľadové spomalia útočníka
  const SPIKE_TYPES = {
    fire: { name: 'Ohnivé ostne', tip: '#f89838', body: '#d83818', desc: 'útočník horí' },
    ice:  { name: 'Ľadové ostne', tip: '#e0f4ff', body: '#88b4ff', desc: 'útočník sa spomalí' },
  };
  const WALL_LINK = 0.1; // +10 % zdravia hradby za každú susednú hradbu
  // kráľove schopnosti
  const ABIL = {
    warcry: { name: 'Pokrik', dur: 6, cd: 30 },
    freeze: { name: 'Mráz',   dur: 4, cd: 40 },
  };
  const mineGold = b => 20 + 12 * (b.lvl - 1);
  const chapelHeal = b => 4 * (1 + 0.4 * (b.lvl - 1));
  const trapStun = b => 2.5 + 0.5 * (b.lvl - 1);
  const craftRate = b => 6 * (1 + 0.5 * (b.lvl - 1)); // remeselník opraví toľko zdravia za sekundu
  // pomocníci: z kaplnky mních (lieči rytierov a kráľa), z dielne remeselník (opravuje budovy);
  // z každej budovy vždy len jeden – ďalší vyjde až keď ho horda zabije
  const HELPERS = {
    chapel:   { spr: 'monk',  hp: 30, spd: 22, rate: b => chapelHeal(b) * 2, col: '#9cd45a' },
    workshop: { spr: 'craft', hp: 36, spd: 22, rate: b => craftRate(b),      col: '#f8d048' },
  };
  const HELPER_RESPAWN = 5;
  const GATE_COST = 20;
  // strelci na hradbách – vylepšujú sa zvlášť od hradby
  const WUNIT = {
    archer:   { name: 'Lukostrelec', spr: 'archer', cost: 40, dmg: 5,  cd: 0.9, range: 72, proj: 'arrow', speed: 180, desc: 'rýchle šípy' },
    crossbow: { name: 'Kušník',      spr: 'knight', cost: 70, dmg: 16, cd: 1.8, range: 92, proj: 'bolt',  speed: 240, desc: 'silná strela, väčší dosah' },
  };
  const uDmg = u => WUNIT[u.type].dmg * (1 + 0.4 * (u.lvl - 1)) * (1 + 0.1 * perk('fletching'));
  const uCd = u => WUNIT[u.type].cd * Math.pow(0.92, u.lvl - 1);
  const uRange = u => WUNIT[u.type].range + 4 * (u.lvl - 1);
  const uUpCost = u => Math.round(WUNIT[u.type].cost * 0.9 * Math.pow(1.6, u.lvl - 1));
  const BUILD_ORDER = ['tower', 'wall', 'pit', 'mine', 'barracks', 'range', 'catapult', 'mage', 'chapel', 'firepit', 'beartrap', 'workshop'];
  const ENEMY = {
    goblin:  { spr: 'goblin',  hp: 12,  speed: 24, atk: 4,  atkCd: 0.8, gold: 3,  blood: '#62a03a' },
    orc:     { spr: 'orc',     hp: 32,  speed: 16, atk: 9,  atkCd: 1.0, gold: 6,  blood: '#62a03a' },
    brute:   { spr: 'brute',   hp: 120, speed: 11, atk: 22, atkCd: 1.3, gold: 18, blood: '#62a03a' },
    warlord: { spr: 'warlord', hp: 520, speed: 8,  atk: 45, atkCd: 1.5, gold: 90, blood: '#a8482c', boss: true },
    garcher: { spr: 'garcher', hp: 14,  speed: 20, atk: 6,  atkCd: 1.7, gold: 5,  blood: '#62a03a', ranged: 54 },
    bat:     { spr: 'bat',     hp: 9,   speed: 30, atk: 4,  atkCd: 1.0, gold: 4,  blood: '#4a3460', fly: true },
    ram:     { spr: 'ram',     hp: 170, speed: 9,  atk: 48, atkCd: 1.6, gold: 22, blood: '#6e4422', ram: true },
    shaman:  { spr: 'shaman',  hp: 45,  speed: 12, atk: 5,  atkCd: 1.2, gold: 15, blood: '#62a03a', heals: true },
    sapper:  { spr: 'sapper',  hp: 16,  speed: 22, atk: 90, atkCd: 0.5, gold: 8,  blood: '#62a03a', sapper: true },
  };

  const lvlMul = (b, k) => 1 + k * (b.lvl - 1);
  const bDmg = b => BUILD[b.kind].dmg * lvlMul(b, 0.4) * (SHOOTERS[b.kind] ? 1 + 0.1 * perk('fletching') : 1) * (b.spec ? SPECS[b.spec].dmg : 1);
  const bCd = b => BUILD[b.kind].cd * Math.pow(0.92, b.lvl - 1) * (b.spec ? SPECS[b.spec].cd : 1);
  const bRange = b => BUILD[b.kind].range + 4 * (b.lvl - 1) + (b.spec ? SPECS[b.spec].range : 0);
  const bMaxHp = b => Math.round((BUILD[b.kind].hp || 1) * lvlMul(b, 0.35) * (b.kind === 'wall' ? 1 + WALL_LINK * (b.nb || 0) : 1));
  const bUpCost = b => Math.round(BUILD[b.kind].cost * 0.9 * Math.pow(1.6, b.lvl - 1));
  const knightCap = b => 2 + b.lvl;
  const knightEvery = b => Math.max(3, 7 - 0.8 * (b.lvl - 1));
  // lukostrelci zo strelnice: menej zdravia, strieľajú z diaľky (aj na netopiere), držia sa za rytiermi
  const archerCap = b => 2 + b.lvl;
  const archerEvery = b => Math.max(4, 8 - 0.8 * (b.lvl - 1));
  const archerHp = b => 28 * lvlMul(b, 0.3) * (1 + 0.2 * perk('drill')) * (1 + 0.1 * tal('command'));
  const archerDmg = b => 5 * lvlMul(b, 0.4) * (1 + 0.1 * perk('fletching')) * (1 + 0.1 * tal('command'));
  const ARCHER_RANGE = 64, ARCHER_CD = 1.1;
  const knightHp = b => 40 * lvlMul(b, 0.3) * (1 + 0.2 * perk('drill')) * (1 + 0.1 * tal('command'));
  const knightDmg = b => 6 * lvlMul(b, 0.35) * (1 + 0.2 * perk('drill')) * (1 + 0.1 * tal('command'));
  const hallMax = () => Math.round((400 + 200 * (st.hallLvl - 1)) * (1 + 0.15 * perk('foundations')));
  const hallUpCost = () => Math.round(110 * Math.pow(1.7, st.hallLvl - 1)); // lacnejšie – radnica odomyká aj úrovne stavieb
  const zoneRows = () => 5 + st.hallLvl;
  const kingMax = () => 120 * (1 + 0.3 * (st.hallLvl - 1)) * (1 + 0.2 * tal('vit'));
  const kingDmg = () => 12 * (1 + 0.3 * (st.hallLvl - 1)) * (1 + 0.15 * tal('str'));
  const volleyDmg = () => (6 + 4 * (st.volleyLvl - 1)) * (1 + 0.25 * perk('archery')) * (1 + 0.15 * tal('archers'));
  const volleyCd = () => Math.max(2, 5 - 0.25 * (st.volleyLvl - 1) - 0.4 * perk('archery'));
  const volleyUpCost = () => Math.round(60 * Math.pow(1.6, st.volleyLvl - 1));

  // ---- Kráľovská sieň: trvalé bonusy za hviezdy ----
  const PERKS = [
    { id: 'treasury',    name: 'Pokladnica',            desc: '+15 % štartovného zlata',                      icon: 'coin' },
    { id: 'loot',        name: 'Korisť',                desc: '+10 % zlata za porazených nepriateľov',        icon: 'coin' },
    { id: 'masons',      name: 'Kamenári',              desc: 'Hradby a brány o 20 % lacnejšie',              icon: 'wall' },
    { id: 'foundations', name: 'Pevné základy',         desc: 'Radnica +15 % zdravia',                         icon: 'hall' },
    { id: 'fletching',   name: 'Ostré hroty',           desc: 'Veže a strelci +10 % poškodenia',               icon: 'tower' },
    { id: 'archery',     name: 'Kráľovskí lukostrelci', desc: 'Šípová salva +25 % poškodenia, rýchlejšie nabitie', icon: 'u_archer' },
    { id: 'drill',       name: 'Výcvik rytierov',       desc: 'Rytieri +20 % zdravia a sily',                  icon: 'barracks' },
  ];
  const PERK_MAX = 3;
  const loadJSON = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const meta = { stars: loadJSON('fortward.stars', []), perks: loadJSON('fortward.perks', {}) };
  const perk = id => meta.perks[id] || 0;

  // ---- Levelovanie kráľa: XP za prežité vlny, na každej novej úrovni výber z 3 vylepšení (natrvalo) ----
  const KING_MAX_LVL = 15, TAL_MAX = 3;
  const TALENTS = [
    { id: 'str',     name: 'Kráľovská sila',  desc: 'Kráľ udiera o 15 % silnejšie',                    icon: 'king' },
    { id: 'vit',     name: 'Pevné zdravie',   desc: 'Kráľ má o 20 % viac zdravia',                     icon: 'king' },
    { id: 'swift',   name: 'Rýchly meč',      desc: 'Kráľ udiera o 12 % rýchlejšie',                   icon: 'king' },
    { id: 'reach',   name: 'Bdelé oko',       desc: 'Kráľ vyráža na hordu ďalej od radnice',           icon: 'king' },
    { id: 'regen',   name: 'Kráľovská krv',   desc: 'Kráľ sa v boji sám lieči',                         icon: 'king' },
    { id: 'rally',   name: 'Nezlomný',        desc: 'Oživenie padnutého kráľa o 25 % lacnejšie',       icon: 'king' },
    { id: 'tax',     name: 'Kráľovská daň',   desc: 'Po každej vlne +6 zlata navyše',                   icon: 'coin' },
    { id: 'command', name: 'Velenie',         desc: 'Rytieri o 10 % silnejší a odolnejší',              icon: 'barracks', need: 'barracks' },
    { id: 'archers', name: 'Kráľovská salva', desc: 'Šípová salva o 15 % silnejšia',                    icon: 'u_archer' },
    { id: 'roar',    name: 'Hromový hlas',    desc: 'Pokrik trvá o 2 s dlhšie',                         icon: 'king', need: 'warcry' },
    { id: 'frost',   name: 'Ľadový dych',     desc: 'Mráz trvá o 1,5 s dlhšie',                         icon: 'king', need: 'freeze' },
  ];
  const kingMeta = Object.assign({ lvl: 1, xp: 0, pending: 0, tal: {} }, loadJSON('fortward.king', {}));
  const tal = id => kingMeta.tal[id] || 0;
  const kingXpNeed = l => 60 + 40 * (l - 1);
  const saveKing = () => saveJSON('fortward.king', kingMeta);
  function gainKingXp(n) {
    if (kingMeta.lvl >= KING_MAX_LVL) return 0;
    kingMeta.xp += n;
    while (kingMeta.lvl < KING_MAX_LVL && kingMeta.xp >= kingXpNeed(kingMeta.lvl)) { kingMeta.xp -= kingXpNeed(kingMeta.lvl); kingMeta.lvl++; kingMeta.pending++; }
    if (kingMeta.lvl >= KING_MAX_LVL) kingMeta.xp = 0;
    saveKing();
    return n;
  }
  // každá misia má 3 úrovne: medená → strieborná → zlatá; ďalšia sa odomkne až za 3 hviezdy na predošlej
  const TIERS = [
    { name: 'Medená',     col: '#e0905a', hi: '#f8c08a', hp: 1,    extra: 0, xp: 1 },
    { name: 'Strieborná', col: '#c8ccd8', hi: '#ffffff', hp: 1.3,  extra: 2, xp: 1.4 },
    { name: 'Zlatá',      col: '#f8d048', hi: '#fff070', hp: 1.65, extra: 4, xp: 1.8 },
  ];
  // staré uloženie (jedno číslo na misiu) = medená úroveň
  meta.stars = meta.stars.map(v => Array.isArray(v) ? v : [v || 0, 0, 0]);
  if (meta.perks.armor) { delete meta.perks.armor; saveJSON('fortward.perks', meta.perks); } // zrušený bonus – hviezdy sa vrátia
  const starsOf = (m, t) => (meta.stars[m - 1] || [])[t] || 0;
  const tierOpen = (m, t) => t === 0 ? m <= st.unlocked : starsOf(m, t - 1) >= 3;
  const starSpan = (n, t) => '<span style="color:' + TIERS[t].col + '">' + '★'.repeat(n) + '</span><i>' + '★'.repeat(3 - n) + '</i>';
  const starsTotal = () => meta.stars.reduce((a, b) => a + (b || []).reduce((x, y) => x + (y || 0), 0), 0);
  const starsSpent = () => Object.values(meta.perks).reduce((a, l) => a + l * (l + 1) / 2, 0); // úroveň n stojí 1+2+…+n
  const starsFree = () => starsTotal() - starsSpent();
  const starsFor = ratio => ratio >= 0.8 ? 3 : ratio >= 0.4 ? 2 : 1;
  const costOf = kind => kind === 'wall' ? Math.max(6, Math.round(BUILD.wall.cost * (1 - 0.2 * perk('masons')))) : BUILD[kind].cost;
  const gateCost = () => Math.max(8, Math.round(GATE_COST * (1 - 0.2 * perk('masons'))));

  const HALL = { hall: true };
  const st = {
    phase: 'title', wave: 0, gold: 0, hallLvl: 1, hallHp: 400, volleyLvl: 1, volleyT: 0,
    blds: [], occ: [], dist: null, enemies: [], soldiers: [], king: null,
    proj: [], eproj: [], drops: [], parts: [], texts: [], marks: [],
    spawnQ: [], spawnT: 0, speed: 1, shake: 0, best: 0, boss: null,
    tool: null, sel: null, hallFlash: 0, soldierN: 0,
  };
  // postup na mape: unlocked = najvyššia odomknutá misia (11 = ostrov oslobodený)
  Object.assign(st, { mission: 1, unlocked: 1, mapSel: 1, mapAnim: null, tech: techFor(1) });
  const has = id => st.tech.has(id);
  const lvlCap = () => has('lvl5') ? MAX_LVL : 3;                       // úroveň stavieb a strelcov
  const hallCap = lvlCap;                                                // úroveň radnice
  // stavby majú najviac úroveň radnice: drevená radnica = drevené stavby, kameň až po jej vylepšení
  const bCap = () => Math.min(lvlCap(), st.hallLvl);
  const LVL_NAME = ['', 'drevo', 'kameň', 'kameň s kovaním', 'tmavé opevnenie', 'kráľovský kameň'];
  const lockBtn = (label, id, wide) => btn('🔒 ' + label + ' · misia ' + unlockMissionOf(id), null, false, () => { }, 'locked' + (wide ? ' wide' : ''));
  try { st.unlocked = Math.max(1, Math.min(11, parseInt(localStorage.getItem('fortward.unlocked') || '1', 10) || 1)); } catch (e) { /* bez úložiska */ }
  const saveProgress = () => { try { localStorage.setItem('fortward.unlocked', String(st.unlocked)); } catch (e) { } };
  let island = null;

  // ---------------- Mriežka ----------------
  const tileX = c => G.gx0 + c * T;
  const tileY = r => G.gy0 + r * T;
  const inHall = (c, r) => c >= G.hc0 && c < G.hc0 + 3 && r >= G.hr0 && r < G.hr0 + 3;
  const zoneTopRow = () => G.rows - zoneRows();
  const inZone = (c, r) => c >= 0 && c < G.cols && r >= zoneTopRow() && r <= G.rows - 1;
  const tileAt = (x, y) => ({
    c: Math.max(0, Math.min(G.cols - 1, Math.floor((x - G.gx0) / T))),
    r: Math.max(0, Math.min(G.rows - 1, Math.floor((y - G.gy0) / T))),
  });
  const occAt = (c, r) => (c < 0 || r < 0 || c >= G.cols || r >= G.rows) ? null : st.occ[r * G.cols + c];
  const blocks = o => o && o !== HALL && BUILD[o.kind].block;
  const hallRect = () => ({ x0: tileX(G.hc0), x1: tileX(G.hc0 + 3), y0: G.hallTop, y1: G.hallBot });

  function rebuildOcc() {
    st.occ = new Array(G.cols * G.rows).fill(null);
    for (let r = G.hr0; r < G.hr0 + 3; r++) for (let c = G.hc0; c < G.hc0 + 3; c++) st.occ[r * G.cols + c] = HALL;
    for (const b of st.blds) st.occ[b.r * G.cols + b.c] = b;
    for (const b of st.blds) if (b.kind === 'wall') {
      let nb = 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = occAt(b.c + dc, b.r + dr); if (o && o !== HALL && o.kind === 'wall') nb++; }
      if (nb !== (b.nb || 0)) { const old = bMaxHp(b); b.nb = nb; b.hp = b.hp * bMaxHp(b) / old; }
    }
    computeFlow();
  }

  // Dijkstra od radnice; budovy na ceste sú drahé (treba ich rozbiť), takže horda radšej obchádza.
  function computeFlow() {
    const n = G.cols * G.rows;
    const dist = new Float32Array(n).fill(1e9), done = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (st.occ[i] === HALL) dist[i] = 0;
    for (;;) {
      let bi = -1, bd = 1e9;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; bi = i; }
      if (bi < 0) break;
      done[bi] = 1;
      const c = bi % G.cols, r = (bi / G.cols) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
        const ni = nr * G.cols + nc, o = st.occ[ni];
        const cost = blocks(o) ? 1 + o.hp / 30 : 1;
        if (bd + cost < dist[ni]) dist[ni] = bd + cost;
      }
    }
    st.dist = dist;
  }

  // ---------------- Rozmery ----------------
  function resize() {
    if (window.innerWidth < 50 || window.innerHeight < 100) return; // okno ešte nemá rozmer
    const dpr = window.devicePixelRatio || 1;
    DPR = dpr;
    const cssW = Math.min(window.innerWidth, Math.floor(window.innerHeight * 0.6));
    const physW = Math.floor(cssW * dpr), physH = Math.floor(window.innerHeight * dpr);
    S = Math.max(1, Math.floor(physW / 180));
    W = Math.floor(physW / S); H = Math.floor(physH / S);
    screen.width = W * S; screen.height = H * S;
    const cw = W * S / dpr, ch = H * S / dpr;
    screen.style.width = cw + 'px'; screen.style.height = ch + 'px';
    const game = $('game');
    game.style.width = cw + 'px'; game.style.height = ch + 'px';
    buf.width = W; buf.height = H;

    const oldHc = G.hc0, oldHr = G.hr0, had = !!scene;
    // pevný počet stĺpcov na každom zariadení (zmestí sa aj do najužšej plochy 180 px) – zmena okna tak mriežku neposúva
    G.cols = Math.min(GRID_COLS, Math.floor(W / T)); G.gx0 = Math.floor((W - G.cols * T) / 2);
    G.rows = Math.floor((H - GROUND_PAD) / T); G.gy0 = H - GROUND_PAD - G.rows * T;
    G.hc0 = Math.floor(G.cols / 2) - 1; G.hr0 = G.rows - 3;
    G.hallCx = tileX(G.hc0) + 1.5 * T; G.hallTop = tileY(G.hr0); G.hallBot = G.hallTop + 3 * T;
    G.zoneTopMax = tileY(G.rows - (5 + MAX_LVL));
    game.style.setProperty('--hall-bot', (G.hallBot / H * 100) + '%');
    scene = buildScene(W, H, G, 7 + st.mission * 13, st.mission - 1);
    island = buildIsland(W, H, 21);
    if (had) { // posuň stavby, ak sa zmenila mriežka
      const dc = G.hc0 - oldHc, dr = G.hr0 - oldHr;
      for (const b of st.blds) { b.c += dc; b.r += dr; }
      for (const sn of undoStack) for (const b of sn.blds) { b.c += dc; b.r += dr; }
      // stavby, ktoré sa do užšej mriežky nezmestia, sa presunú na najbližšie voľné políčko (nikdy nezmiznú)
      const fits = b => b.c >= 0 && b.c < G.cols && b.r >= 0 && b.r < G.rows && !inHall(b.c, b.r);
      const out = st.blds.filter(b => !fits(b));
      if (out.length) {
        st.blds = st.blds.filter(fits);
        rebuildOcc();
        for (const b of out) {
          let best = null, bd = 1e9;
          for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
            if (inHall(c, r) || occAt(c, r)) continue;
            const d = Math.hypot(c - b.c, r - b.r) + (inZone(c, r) ? 0 : 100); // radšej v zóne
            if (d < bd) { bd = d; best = { c, r }; }
          }
          if (best) { b.c = best.c; b.r = best.r; st.blds.push(b); rebuildOcc(); }
          else st.gold += b.spent; // mriežka je plná – vráť zlato
        }
        undoStack = []; // staré snímky by mali stavby mimo mriežky
      }
      for (const o of st.enemies.concat(st.soldiers)) { o.x += dc * T; o.y += dr * T; }
    }
    if (st.king) { st.king.hx = G.hallCx; st.king.hy = G.hallTop - 12; }
    rebuildOcc();
  }

  // ---------------- Hra ----------------
  // rieka spomalí každého, kto ňou brodí (po moste nie); plytčina na brode spomalí menej
  const WATER_MUL = [1, 0.5, 0.75];
  function waterMul(o) {
    const w = scene && scene.water, x = Math.round(o.x), y = Math.round(o.y);
    if (!w || x < 0 || y < 0 || x >= W || y >= H) return 1;
    const k = w[y * W + x];
    if (k && Math.random() < 0.06) part(o.x + (Math.random() - 0.5) * 6, o.y - 1, (Math.random() - 0.5) * 12, -8 - Math.random() * 8, 0.35, Math.random() < 0.5 ? '#bcd8f0' : '#ffffff', 60); // čľapot
    return WATER_MUL[k];
  }

  function bCenter(b) { return { x: tileX(b.c) + T / 2, y: tileY(b.r) + T / 2 }; }

  function addBuilding(kind, c, r) {
    const b = { kind, c, r, lvl: 1, hp: 0, cd: 0.5, spent: costOf(kind), flash: 0, spawnT: 1 };
    b.hp = bMaxHp(b);
    st.blds.push(b);
    rebuildOcc();
    return b;
  }

  function startMission(m, tier) {
    st.mission = m;
    st.tier = tier || 0;
    st.tech = techFor(Math.max(m, st.unlocked)); // platí všetko, čo hráč už odomkol
    scene = buildScene(W, H, G, 7 + m * 13, m - 1); // každá misia má vlastnú krajinu
    $('map').hidden = true;
    newGame();
    banner('Misia ' + m + ': ' + MISSIONS[m - 1].name + (st.tier ? ' · ' + TIERS[st.tier].name : ''));
  }

  // ---- útočné misie (6–10): orkský hrad hore na bojisku, z jeho brány vychádza horda ----
  const isAttack = () => st.mission > HOME_PROVINCES;
  const FORT = { keepHp: 1500, towerHp: 320, palHp: 220, keepBot: 84, palY: 100 }; // y spodku hradu a palisády (herné px) – pod horným panelom
  function makeFort() {
    const x = scene.fortX, tr = TIERS[st.tier || 0].hp, mm = 1 + 0.2 * (st.mission - HOME_PROVINCES - 1);
    const keepBot = FORT.keepBot, py = FORT.palY;
    const pal = [];
    for (let k = -3; k <= 3; k++) pal.push({ x: x + k * 16, y: py, hp: FORT.palHp * tr * mm, max: FORT.palHp * tr * mm, gate: k === 0, flash: 0 });
    return {
      x, y: keepBot, hp: FORT.keepHp * tr * mm, max: FORT.keepHp * tr * mm, flash: 0,
      towers: [-1, 1].map(sd => ({ x: x + sd * 40, y: keepBot + 10, hp: FORT.towerHp * tr * mm, max: FORT.towerHp * tr * mm, cd: 1, flash: 0 })),
      pal, gateX: x, gateY: py + 3,
    };
  }

  function newGame() {
    undoStack = [];
    Object.assign(st, {
      wave: 0, gold: Math.round((DIFF.startGold + DIFF.startGoldMission * (st.mission - 1)) * (1 + 0.15 * perk('treasury'))), hallLvl: 1, volleyLvl: 1, volleyT: 0, boss: null, tool: null, sel: null, hallFlash: 0, shake: 0, soldierN: 0,
      blds: [], enemies: [], soldiers: [], proj: [], eproj: [], drops: [], parts: [], texts: [], marks: [], spawnQ: [],
      cryT: 0, cryCd: 0, freezeT: 0, freezeCd: 0,
    });
    rebuildOcc(); // nová misia: zabudni obsadenie políčok aj cesty hordy z predošlej hry
    st.fort = isAttack() ? makeFort() : null;
    if (isAttack()) { const bk = addBuilding('barracks', G.hc0 - 1, G.hr0 + 1); bk.spent = 0; } // predvolené kasárne zadarmo
    st.hallHp = hallMax();
    st.king = { x: G.hallCx, y: G.hallTop - 12, hx: G.hallCx, hy: G.hallTop - 12, hp: kingMax(), cd: 0, tgt: null, down: 0, anim: 0, flash: 0, isKing: true };
    $('title').hidden = true; $('over').hidden = true;
    $('hud').hidden = false;
    enterBuild();
  }

  // ---- obtiažnosť (laďené simuláciou celej kampane) ----
  // zdravie rastie v rámci misie (hpWave) aj s misiou (hpMission), zloženie hordy sa posúva o typeShift vĺn na misiu
  const DIFF = {
    // sila nepriateľov podľa misie (násobok zdravia v 1. vlne) – misia 1 je úvodná a ľahká, misia 10 skúška
    missionHp: [0.95, 1.5, 2.3, 2.55, 2.55, 2.5, 2.6, 2.35, 2.9, 3.05],
    hpWave: 1.10, hpWaveMission: 0.006, hpMission: 0.25,   // rast zdravia počas misie (neskoršie misie rastú rýchlejšie)
    countWave: 2, countMission: 1,                         // počet nepriateľov vo vlne
    typeShift: 0.8, bruteFrom: 5, bruteRate: 0.03,         // ako rýchlo pribúdajú orkovia a surovci
    startGold: 210, startGoldMission: 80, goldMission: 0.15, // ekonomika (každá misia začína od nuly)
    bossBase: 0.6, bossMission: 0.33, bossLast: 1.0,       // sila vojvodcu v 5. a 10. vlne
    pArcher: 0.12, pBat: 0.12, pRam: 0.05, pShaman: 0.04, pSapper: 0.06, // podiel nových nepriateľov
  };
  const goldMul = () => 1 + DIFF.goldMission * (st.mission - 1);

  function buildWave(w) {
    const m = st.mission, ew = w + (m - 1) * DIFF.typeShift;
    const q = [];
    const tr = TIERS[st.tier || 0];
    const n = 6 + Math.round(w * DIFF.countWave + (m - 1) * DIFF.countMission) + tr.extra;
    const mHp = DIFF.missionHp ? DIFF.missionHp[m - 1] : 1 + DIFF.hpMission * (m - 1);
    const hpMul = Math.pow(DIFF.hpWave + DIFF.hpWaveMission * (m - 1), w - 1) * mHp * tr.hp;
    const gap = Math.max(0.3, 1.3 - ew * 0.04);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const pBrute = ew >= DIFF.bruteFrom ? Math.min(0.3, (ew - DIFF.bruteFrom + 1) * DIFF.bruteRate) : 0;
      const pOrc = ew >= 2 ? Math.min(0.5, 0.15 + ew * 0.04) : 0;
      let type = r < pBrute ? 'brute' : r < pBrute + pOrc ? 'orc' : 'goblin';
      // noví nepriatelia od misie, v ktorej sa predstavia
      const r2 = Math.random();
      const pSap = m >= 8 && w >= 2 ? DIFF.pSapper : 0;
      if (r2 >= 1 - pSap) type = 'sapper';
      const pSh = m >= 6 && w >= 2 ? DIFF.pShaman : 0, pRam = m >= 5 && w >= 3 ? DIFF.pRam : 0, pBat = m >= 4 ? DIFF.pBat : 0, pArc = m >= 3 ? DIFF.pArcher : 0;
      if (r2 < pSh) type = 'shaman';
      else if (r2 < pSh + pRam) type = 'ram';
      else if (r2 < pSh + pRam + pBat) type = 'bat';
      else if (r2 < pSh + pRam + pBat + pArc) type = 'garcher';
      q.push({ type, gap: gap * (0.6 + Math.random() * 0.8), hpMul });
    }
    if (w % 5 === 0) { // boss v 5. a 10. vlne, v posledných misiách dvaja
      const bossMul = (w === MISSION_WAVES ? DIFF.bossLast : 1) * (DIFF.bossBase + DIFF.bossMission * (m - 1)) * tr.hp;
      q.push({ type: 'warlord', gap: 2.5, hpMul: bossMul });
      if (w === MISSION_WAVES && m >= 8) q.push({ type: 'warlord', gap: 3, hpMul: bossMul });
    }
    return q;
  }

  function enterBuild() {
    st.phase = 'build';
    st.moving = null;
    AUDIO.music('build');
    st.tool = null; st.sel = null;
    $('bottom').hidden = true;
    // rytieri a kráľ sa vrátia a vyliečia
    for (const s of st.soldiers) { s.hp = s.max; s.tgt = null; }
    if (st.king && !st.king.dead) { st.king.hp = kingMax(); st.king.down = 0; st.king.tgt = null; st.king.flash = 0; st.king.swing = 0; st.king.x = st.king.hx; st.king.y = st.king.hy; }
    for (const b of st.blds) b.flash = 0;
    $('build').hidden = false;
    renderBuild();
    updateHud();
    if (kingMeta.pending) setTimeout(() => { if (st.phase === 'build') showTalentPick(); }, 600);
  }

  function startWave() {
    undoStack = [];
    st.wave++;
    st.spawnQ = buildWave(st.wave);
    st.spawnT = 1.2;
    st.phase = 'battle';
    st.tool = null; st.sel = null; st.moving = null; bdrag = null;
    AUDIO.play('horn'); AUDIO.music('battle');
    $('build').hidden = true; $('bottom').hidden = false;
    for (const b of st.blds) if (b.kind === 'barracks' || b.kind === 'range' || HELPERS[b.kind]) b.spawnT = HELPERS[b.kind] ? 0.6 : 0.3;
    banner(st.wave === MISSION_WAVES ? 'Posledná vlna!' : 'Vlna ' + st.wave + ' / ' + MISSION_WAVES);
    updateHud();
  }

  function endWave() {
    const bonus = Math.round((10 + st.wave * 4) * goldMul()) + 6 * tal('tax');
    st.gold += bonus;
    const lvl0 = kingMeta.lvl;
    st.lastXp = gainKingXp(Math.round((8 + 2 * st.wave + (st.wave >= MISSION_WAVES ? 40 : 0)) * TIERS[st.tier || 0].xp));
    if (kingMeta.lvl > lvl0 && st.king) for (let k = 0; k < 24; k++) part(st.king.x, st.king.y - 8, (Math.random() - 0.5) * 50, -Math.random() * 60, 0.9, ['#f8d048', '#fff070', '#ffffff'][k % 3], 60);
    let mined = 0;
    for (const b of st.blds) if (b.kind === 'mine') {
      const gm = Math.round(mineGold(b) * goldMul()); mined += gm;
      st.texts.push({ x: tileX(b.c) + T / 2, y: tileY(b.r) - 4, s: '+' + gm, life: 1.4, max: 1.4 });
    }
    st.gold += mined;
    st.phase = 'pause';
    st.proj = []; st.eproj = []; st.drops = [];
    // rytieri sa po vlne vrátia do kasární
    for (const sd of st.soldiers) for (let k = 0; k < 5; k++) part(sd.x, sd.y - 5, (Math.random() - 0.5) * 20, -Math.random() * 20, 0.4, '#88b4ff', 30);
    st.soldiers = [];
    if (st.wave >= MISSION_WAVES) { missionWon(); return; }
    banner('Vlna prežitá! +' + bonus + ' zlata' + (st.lastXp ? ' · kráľ +' + st.lastXp + ' XP' : ''));
    AUDIO.play('cleared');
    setTimeout(() => { if (st.phase === 'pause') enterBuild(); }, 1000);
    updateHud();
  }

  function showOver(title, text, win) {
    $('overTitle').textContent = title;
    $('overTitle').className = win ? 'win' : '';
    $('overText').innerHTML = text;
    $('overRetry').hidden = win;
    $('overMap').textContent = win ? 'Pokračovať na mapu' : 'Na mapu';
    $('over').hidden = false;
  }

  function missionWon() {
    const m = st.mission;
    st.phase = 'won';
    const t = st.tier || 0, stars = starsFor(st.hallHp / hallMax()), prevStars = starsOf(m, t);
    const nextWasOpen = t < 2 && tierOpen(m, t + 1);
    if (stars > prevStars) { const a = (meta.stars[m - 1] || [0, 0, 0]).slice(); a[t] = stars; meta.stars[m - 1] = a; saveJSON('fortward.stars', meta.stars); }
    const tierNote = t >= 2 ? '' : !nextWasOpen && tierOpen(m, t + 1) ? '<br><span class="newTech">Odomkla sa ' + TIERS[t + 1].name.toLowerCase() + ' úroveň!</span>'
      : !tierOpen(m, t + 1) ? '<br><small class="dim">Za 3 hviezdy (radnica nad 80 % zdravia) sa odomkne ' + TIERS[t + 1].name.toLowerCase() + ' úroveň.</small>' : '';
    $('bossbar').hidden = true; $('bottom').hidden = true;
    const first = t === 0 && m >= st.unlocked;
    if (first) {
      st.provAnim = { i: m - 1, t: 0, from: m <= HOME_PROVINCES ? 'attacked' : 'horde' }; // provincia sa na mape prefarbí na modro
      st.unlocked = Math.min(11, m + 1); saveProgress(); st.mapAnim = { seg: m - 1, t: 0 };
    }
    banner('Misia splnená!');
    AUDIO.music(null); AUDIO.play('win');
    for (let k = 0; k < 80; k++) part(Math.random() * W, H * 0.3 + Math.random() * 30, (Math.random() - 0.5) * 60, -30 - Math.random() * 60, 1.4, ['#f8d048', '#fff070', '#88b4ff', '#e84838'][k % 4], 60);
    const text = m === MISSIONS.length
      ? 'Porazil si poslednú hordu. <b>Ostrov je oslobodený!</b>'
      : 'Misia ' + m + ' · ' + MISSIONS[m - 1].name + ' · ' + TIERS[t].name.toLowerCase() + ' úroveň<br>Všetkých ' + MISSION_WAVES + ' vĺn odrazených.' + (first ? '<br>Odomkla sa misia ' + (m + 1) + '.<br><span class="newTech">Nové: ' + UNLOCKS[m].map(u => u.name).join(', ') + '</span>' : '');
    const starLine = '<span class="bigStars">' + starSpan(stars, t) + '</span>' +
      (stars > prevStars ? '<br><span class="newTech">+' + (stars - prevStars) + ' ★ do Kráľovskej siene</span>' : '') + tierNote;
    const xpLine = st.lastXp ? '<br><span class="newTech">Kráľ +' + st.lastXp + ' XP' + (kingMeta.pending ? ' · nová úroveň ' + kingMeta.lvl + '!' : '') + '</span>' : '';
    setTimeout(() => showOver(m === MISSIONS.length ? 'Víťazstvo!' : 'Misia splnená!', starLine + '<br>' + text + xpLine, true), 1200);
    updateHud();
  }

  function gameOver() {
    st.phase = 'over';
    st.hallHp = 0;
    const survived = st.wave - 1;
    $('bossbar').hidden = true; $('bottom').hidden = true;
    const hr = hallRect();
    for (let k = 0; k < 60; k++) {
      part(hr.x0 + Math.random() * (hr.x1 - hr.x0), hr.y0 - 10 + Math.random() * 40, (Math.random() - 0.5) * 50, -Math.random() * 50, 1.3, ['#6a6a78', '#3e3e4c', '#f89838', '#d83818'][k % 4], 60);
    }
    st.shake = 0.6;
    AUDIO.music(null); AUDIO.play('crumble'); setTimeout(() => AUDIO.play('lose'), 500);
    setTimeout(() => showOver('Radnica padla!', 'Misia ' + st.mission + ' · ' + MISSIONS[st.mission - 1].name + (st.tier ? ' · ' + TIERS[st.tier].name.toLowerCase() + ' úroveň' : '') + '<br>Prežité vlny: <b>' + survived + ' / ' + MISSION_WAVES + '</b>', false), 1200);
    updateHud();
  }

  function spawnEnemy(item) {
    const d = ENEMY[item.type];
    const spr = SPR[d.spr][0];
    const fromGate = st.fort && !d.fly;
    const e = {
      d, x: fromGate ? st.fort.gateX + (Math.random() - 0.5) * 8 : scene.spawn[0] + spr.w / 2 + Math.random() * Math.max(1, scene.spawn[1] - scene.spawn[0] - spr.w),
      y: fromGate ? st.fort.gateY : st.fort ? st.fort.y - 20 : -2,
      hp: d.hp * item.hpMul, max: d.hp * item.hpMul, spd: d.speed * (0.9 + Math.random() * 0.2),
      atk: Math.random() * d.atkCd, anim: Math.random() * 2, flash: 0, lunge: 0,
      jx: (Math.random() - 0.5) * 7, jy: (Math.random() - 0.5) * 5, ph: Math.random() * 6.28,
      w: spr.w, h: spr.h, dead: false, foe: null, trap: null, attacking: false, pow: Math.sqrt(item.hpMul),
    };
    st.enemies.push(e);
    if (d.boss) { st.boss = e; banner('Prichádza Vojvodca!'); AUDIO.play('boss'); }
  }

  function damage(e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.08;
    AUDIO.play('hit');
    for (let k = 0; k < 3; k++) part(e.x, e.y - e.h * 0.55, (Math.random() - 0.5) * 50, -Math.random() * 30, 0.35, e.d.blood, 120);
    if (e.hp <= 0) kill(e);
  }

  function kill(e) {
    e.dead = true;
    AUDIO.play('die'); AUDIO.play('coin');
    const gain = Math.round(e.d.gold * goldMul() * (1 + 0.1 * perk('loot')));
    st.gold += gain;
    st.texts.push({ x: e.x, y: e.y - e.h, s: '+' + gain, life: 0.9, max: 0.9 });
    const cols = [e.d.blood, '#305c22', '#6e4422', '#1c140e'];
    const n = e.d.boss ? 50 : 12;
    for (let k = 0; k < n; k++) {
      part(e.x + (Math.random() - 0.5) * e.w * 0.6, e.y - Math.random() * e.h,
        (Math.random() - 0.5) * 60, -20 - Math.random() * 50, 0.5 + Math.random() * 0.4, cols[k % cols.length], 140);
    }
    if (e.d.boss) { st.boss = null; st.shake = 0.4; banner('Vojvodca padol!'); }
    updateHud();
  }

  function hitBuilding(b, dmg, attacker) {
    b.hp -= dmg; b.flash = 0.08;
    if (b.spikes && attacker && !attacker.dead) {
      damage(attacker, spikeDmg(b)); part(attacker.x, attacker.y - 6, 0, -10, 0.3, b.spikeType ? SPIKE_TYPES[b.spikeType].tip : '#f4f4f8', 60);
      if (b.spikeType === 'fire') { attacker.burnT = 3; attacker.burnDps = Math.max(attacker.burnDps || 0, spikeDmg(b) * 0.6); }
      else if (b.spikeType === 'ice') attacker.chillT = 2.5;
    }
    AUDIO.play(b.hp <= 0 ? 'crumble' : 'thud');
    const c = bCenter(b);
    for (let k = 0; k < 3; k++) part(c.x + (Math.random() - 0.5) * 10, c.y - 4, (Math.random() - 0.5) * 30, -10 - Math.random() * 25, 0.45, Math.random() < 0.5 ? '#848490' : '#6e4422', 90);
    if (b.hp <= 0) {
      for (let k = 0; k < 18; k++) part(c.x + (Math.random() - 0.5) * 14, c.y - Math.random() * 16, (Math.random() - 0.5) * 50, -Math.random() * 40, 0.8, ['#848490', '#525262', '#6e4422', '#1c140e'][k % 4], 110);
      st.blds = st.blds.filter(x => x !== b);
      for (const s of st.soldiers) if (s.home === b) s.home = null;
      rebuildOcc();
      st.shake = Math.max(st.shake, 0.12);
    }
  }

  // podkopník vybuchne: zrania stavby v okolí (najviac hradby), sám zahynie bez koristi
  function explode(e) {
    if (e.dead) return;
    e.dead = true;
    const R = 20, dmg = e.d.atk * e.pow;
    AUDIO.play('boom'); st.shake = Math.max(st.shake, 0.2);
    for (let k = 0; k < 26; k++) { const a = Math.random() * 6.28, sp = 20 + Math.random() * 55; part(e.x, e.y - 4, Math.cos(a) * sp, Math.sin(a) * sp - 20, 0.3 + Math.random() * 0.35, ['#fff070', '#f89838', '#d83818', '#3e2614', '#525262'][k % 5], 60); }
    for (const b of st.blds.slice()) {
      if (!BUILD[b.kind].block || !st.blds.includes(b)) continue;
      const c = bCenter(b);
      if (Math.hypot(c.x - e.x, c.y - e.y) <= R) hitBuilding(b, b.kind === 'wall' ? dmg : dmg * 0.5, null);
    }
    const hr = hallRect();
    if (e.x > hr.x0 - R && e.x < hr.x1 + R && e.y > hr.y0 - R && e.y < hr.y1) hitHall(dmg * 0.4, e.x);
  }

  function hitHall(dmg, x) {
    st.hallHp -= dmg; st.hallFlash = 0.08;
    AUDIO.play('hallHit');
    for (let k = 0; k < 4; k++) part(x + (Math.random() - 0.5) * 6, G.hallTop + 2, (Math.random() - 0.5) * 30, -10 - Math.random() * 25, 0.45, Math.random() < 0.5 ? '#848490' : '#525262', 90);
    if (dmg >= 20) st.shake = Math.max(st.shake, 0.15);
    updateHud();
    if (st.hallHp <= 0) gameOver();
  }

  function part(x, y, vx, vy, life, col, grav) {
    if (st.parts.length > 700) return;
    st.parts.push({ x, y, vx, vy, life, max: life, col, grav: grav || 0 });
  }

  // ---------------- Update ----------------
  function moveTo(o, tx, ty, spd, dt) {
    const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
    if (d < 0.5) return true;
    const s = Math.min(d, spd * dt);
    o.x += dx / d * s; o.y += dy / d * s;
    o.anim += dt * spd / 9;
    return false;
  }

  function updateEnemy(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    e.lunge = Math.max(0, e.lunge - dt);
    e.attacking = false;
    // horenie a omráčenie
    if (e.burnT > 0) {
      e.burnT -= dt; e.hp -= e.burnDps * dt;
      if (e.burnT <= 0) e.burnDps = 0; // dohorel – ďalšie zapálenie začne odznova
      if (Math.random() < 0.35) part(e.x + (Math.random() - 0.5) * e.w * 0.5, e.y - Math.random() * e.h, 0, -12 - Math.random() * 10, 0.4, Math.random() < 0.5 ? '#f89838' : '#d83818', -10);
      if (e.hp <= 0) { kill(e); return; }
    }
    if (e.stunT > 0) { e.stunT -= dt; return; }
    if (e.chillT > 0) { e.chillT -= dt; if (Math.random() < 0.2) part(e.x + (Math.random() - 0.5) * e.w * 0.5, e.y - Math.random() * e.h, 0, -6, 0.4, '#e0f4ff', 0); }
    const slow = (st.freezeT > 0 ? 0.35 : 1) * (e.chillT > 0 ? 0.5 : 1);
    const attackFn = (fn) => {
      e.attacking = true;
      e.atk -= dt * slow;
      if (e.atk <= 0) { e.atk = e.d.atkCd; e.lunge = 0.15; fn(); }
    };
    // šaman lieči okolie
    if (e.d.heals) {
      e.healT = (e.healT || 2) - dt;
      if (e.healT <= 0) {
        e.healT = 2;
        for (const o of st.enemies) if (!o.dead && o !== e && o.hp < o.max && Math.hypot(o.x - e.x, o.y - e.y) < 34) {
          o.hp = Math.min(o.max, o.hp + o.max * 0.12);
          for (let k = 0; k < 3; k++) part(o.x + (Math.random() - 0.5) * 6, o.y - o.h * 0.6, 0, -14, 0.6, '#9cd45a', 0);
        }
        for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; part(e.x + Math.cos(a) * 10, e.y - 6 + Math.sin(a) * 6, 0, -6, 0.5, '#5aff8a', 0); }
      }
    }
    // netopiere letia priamo k radnici ponad všetko
    if (e.d.fly) {
      const hr0 = hallRect();
      const tx = Math.max(hr0.x0 + 4, Math.min(hr0.x1 - 4, G.hallCx + e.jx * 3)), ty = hr0.y0 + 4;
      e.anim += dt * 8;
      if (Math.hypot(tx - e.x, ty - e.y) <= 3) { attackFn(() => hitHall(e.d.atk, e.x)); return; }
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy), sp = e.spd * slow * dt;
      e.x += dx / d * sp + Math.sin(e.anim * 0.7 + e.ph) * 0.4; e.y += dy / d * sp;
      return;
    }
    const { c, r } = tileAt(e.x, e.y);
    // pasce
    const here = occAt(c, r);
    let spd = e.spd * slow * waterMul(e);
    if (here && here !== HALL && TRAPS[here.kind] && !e.d.fly) {
      const fresh = e.trap !== here;
      e.trap = here;
      if (here.kind === 'pit') {
        spd *= 0.5;
        if (fresh) { damage(e, bDmg(here)); for (let k = 0; k < 4; k++) part(e.x, e.y - 2, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.3, '#bcc0cc', 80); if (e.dead) return; }
      } else if (here.kind === 'firepit' && fresh) {
        e.burnT = Math.max(e.burnT || 0, FIRE_BURN); e.burnDps = Math.max(e.burnDps || 0, bDmg(here)); AUDIO.play('fire');
      } else if (here.kind === 'beartrap' && fresh && !(here.armT > 0)) {
        e.stunT = trapStun(here) * (e.d.boss ? 0.4 : 1); here.armT = 6; here.flash = 0.1;
        AUDIO.play('clang'); for (let k = 0; k < 5; k++) part(e.x, e.y - 2, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.3, '#f4f4f8', 80);
        return;
      }
    } else e.trap = null;

    // podkopník namiesto úderu vybuchne
    const attack = e.d.sapper ? () => explode(e) : attackFn;

    // súboj s rytierom / kráľom (beranidlo a podkopník rytierov ignorujú)
    if (e.d.ram || e.d.sapper) e.foe = null;
    if (e.foe && (e.foe.dead || e.foe.down > 0)) e.foe = null;
    if (!e.foe && !e.d.ram && !e.d.sapper) for (const s of st.soldiers) if ((s.helper || s.archer) && !s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 9) { e.foe = s; break; }
    if (e.foe) {
      if (Math.hypot(e.foe.x - e.x, e.foe.y - e.y) < 12) { attack(() => hitUnit(e.foe, e.d.atk * 0.7 * (e.foe.ktype === 'shield' ? 0.5 : 1))); return; }
      e.foe = null;
    }
    // goblin-lukostrelec: zastaví v dosahu a strieľa
    if (e.d.ranged && e.y > 10) {
      const R = e.d.ranged;
      let tgt = null, td = R;
      for (const b of st.blds) {
        if (!BUILD[b.kind].block) continue;
        const d = Math.hypot(tileX(b.c) + T / 2 - e.x, tileY(b.r) + T / 2 - e.y);
        if (d < td) { td = d; tgt = b; }
      }
      const hrr = hallRect();
      const dh = Math.hypot(Math.max(hrr.x0 - e.x, 0, e.x - hrr.x1), Math.max(hrr.y0 - e.y, 0, e.y - hrr.y1));
      if (dh < td) { td = dh; tgt = HALL; }
      for (const u of st.soldiers) { const d = Math.hypot(u.x - e.x, u.y - e.y); if (d < td * 0.8) { td = d; tgt = u; } }
      if (tgt) {
        attackFn(() => {
          let tx, ty;
          if (tgt === HALL) { tx = Math.max(hrr.x0 + 2, Math.min(hrr.x1 - 2, e.x)); ty = hrr.y0 + 4; }
          else if (tgt.kind) { tx = tileX(tgt.c) + T / 2; ty = tileY(tgt.r) + 4; }
          else { tx = tgt.x; ty = tgt.y - 6; }
          st.eproj.push({ x: e.x, y: e.y - 8, tx, ty, tgt, dmg: e.d.atk });
        });
        return;
      }
    }
    // budova na dosah? horda ničí všetko, čo jej príde pod ruku
    let nearB = null, nd = 3.5;
    for (const b of st.blds) {
      if (!BUILD[b.kind].block) continue;
      const x0 = tileX(b.c), y0 = tileY(b.r);
      const d = Math.hypot(Math.max(x0 - e.x, 0, e.x - x0 - T), Math.max(y0 - e.y, 0, e.y - y0 - T));
      if (d < nd) { nd = d; nearB = b; }
    }
    if (nearB) { attack(() => hitBuilding(nearB, e.d.atk, e)); return; }
    // podkopník beží rovno k najbližšej hradbe
    if (e.d.sapper && e.y > 4) {
      let tw = null, td = 1e9;
      for (const b of st.blds) if (b.kind === 'wall') { const d = Math.hypot(tileX(b.c) + T / 2 - e.x, tileY(b.r) + T / 2 - e.y); if (d < td) { td = d; tw = b; } }
      if (tw) { moveTo(e, tileX(tw.c) + T / 2, tileY(tw.r) + T / 2, spd, dt); return; }
    }
    // pri radnici?
    const hr = hallRect();
    const qx = Math.max(hr.x0 + 2, Math.min(hr.x1 - 2, e.x)), qy = Math.max(hr.y0 - 1, Math.min(hr.y1 - 1, e.y));
    const nearHall = Math.abs(c - (G.hc0 + 1)) <= 2 && r >= G.hr0 - 1 && r <= G.hr0 + 3;
    if (nearHall) {
      let tx = qx, ty = qy;
      if (e.y < hr.y0) ty = hr.y0 - 1; // zhora
      else if (e.x < hr.x0) tx = hr.x0 - 3; else if (e.x > hr.x1) tx = hr.x1 + 3;
      if (Math.hypot(tx - e.x, ty - e.y) <= 2.5) { attack(() => hitHall(e.d.atk, e.x)); return; }
      moveTo(e, tx + e.jx * 0.5, ty, spd, dt);
      return;
    }
    // ďalšie políčko podľa poľa vzdialeností
    const D = st.dist, i0 = r * G.cols + c;
    let best = -1, bd = D[i0], bc = c, br = r;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
      if (dc && dr && (blocks(occAt(c + dc, r)) || blocks(occAt(c, r + dr)) || blocks(occAt(nc, nr)))) continue;
      const v = D[nr * G.cols + nc] + (dc && dr ? 0.45 : 0);
      if (v < bd) { bd = v; best = nr * G.cols + nc; bc = nc; br = nr; }
    }
    if (best < 0) { moveTo(e, G.hallCx, G.hallTop, spd, dt); return; }
    const o = st.occ[best];
    if (blocks(o)) {
      // treba rozbiť budovu v ceste
      const bx = tileX(bc) + T / 2, by = tileY(br) + T / 2;
      const ex = Math.max(tileX(bc) - 1, Math.min(tileX(bc) + T + 1, e.x));
      const ey = Math.max(tileY(br) - 2, Math.min(tileY(br) + T, e.y));
      if (Math.hypot(ex - e.x, ey - e.y) <= 3) { attack(() => hitBuilding(o, e.d.atk, e)); return; }
      moveTo(e, (ex + bx) / 2, (ey + by) / 2 - 2, spd, dt);
      return;
    }
    moveTo(e, tileX(bc) + T / 2 + e.jx, tileY(br) + T / 2 + e.jy, spd, dt);
  }

  function separate() {
    const es = st.enemies.filter(e => !e.d.fly);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      const min = (a.w + b.w) * 0.3;
      if (d2 > min * min || d2 < 0.01) continue;
      const d = Math.sqrt(d2), push = (min - d) * 0.25;
      a.x -= dx / d * push; a.y -= dy / d * push * 0.5;
      b.x += dx / d * push; b.y += dy / d * push * 0.5;
    }
  }

  function hitUnit(u, dmg) {
    u.hp -= dmg; u.flash = 0.08;
    part(u.x, u.y - 6, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.3, '#e84838', 100);
    if (u.hp > 0) return;
    if (u.isKing) { // kráľ padol – do konca vlny nebojuje, po vlne ho možno oživiť za zlato
      u.dead = true; u.deadT = 0; u.tgt = null; u.flash = 0;
      for (let k = 0; k < 10; k++) part(u.x, u.y - 6, (Math.random() - 0.5) * 40, -Math.random() * 40, 0.6, '#f8d048', 80);
      AUDIO.play('crumble');
      slowmoT = SLOWMO_DUR;
      toast('Kráľ padol! Po vlne ho môžeš oživiť.');
    } else {
      u.dead = true;
      for (let k = 0; k < 8; k++) part(u.x, u.y - 6, (Math.random() - 0.5) * 40, -Math.random() * 40, 0.5, ['#3c64c8', '#bcc0cc', '#e84838'][k % 3], 120);
    }
  }

  function nearestEnemy(x, y, rad, preferFree) {
    let best = null, bd = 1e9;
    for (const e of st.enemies) {
      if (e.dead || e.d.fly) continue;
      let d = Math.hypot(e.x - x, e.y - y);
      if (d > rad) continue;
      if (preferFree && e.foe) d += 25;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // vlastné budovy (veže, bane, kaplnky…) rytieri prejdú – hradby len cez bránu, radnicou len jej horným radom
  const knightPass = (c, r) => {
    const o = occAt(c, r);
    if (o === HALL) return r === G.hr0;
    return !o || o.kind !== 'wall' || o.gate;
  };
  const musterYOf = () => Math.max(G.gy0 + 30, tileY(zoneTopRow()) - 28);
  // dostanú sa rytieri z kasární von k zhromaždisku pred zónou? (pri budovaní upozorní, ak nie)
  function knightsBlocked(b) {
    const sc = b.c, sr = Math.min(G.rows - 1, b.r + 1), goalR = Math.floor((musterYOf() - G.gy0) / T);
    const seen = new Uint8Array(G.cols * G.rows), q = [sr * G.cols + sc];
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = i % G.cols, r = (i / G.cols) | 0;
      if (r <= goalR) return false;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
        const ni = nr * G.cols + nc;
        if (seen[ni] || !knightPass(nc, nr)) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    return true;
  }
  const blockedBarracks = () => st.blds.filter(b => (b.kind === 'barracks' || b.kind === 'range') && knightsBlocked(b));

  function knightStep(a, b) {
    const n = G.cols * G.rows, dist = new Int16Array(n).fill(-1);
    const q = [b.r * G.cols + b.c]; dist[q[0]] = 0;
    const startI = a.r * G.cols + a.c;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = i % G.cols, r = (i / G.cols) | 0;
      if (i === startI) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
        const ni = nr * G.cols + nc;
        if (dist[ni] >= 0 || (ni !== startI && !knightPass(nc, nr))) continue;
        dist[ni] = dist[i] + 1; q.push(ni);
      }
    }
    if (dist[startI] < 0) return null;
    let best = null, bd = dist[startI];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = a.c + dc, nr = a.r + dr;
      if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
      const v = dist[nr * G.cols + nc];
      if (v < 0) continue;
      if (dc && dr && (!knightPass(a.c + dc, a.r) || !knightPass(a.c, a.r + dr))) continue;
      const score = v + (dc && dr ? 0.5 : 0);
      if (score < bd) { bd = score; best = { c: nc, r: nr }; }
    }
    return best;
  }
  function moveKnight(u, tx, ty, spd, dt) {
    const a = tileAt(u.x, u.y), b = tileAt(tx, ty);
    if (a.c === b.c && a.r === b.r) return moveTo(u, tx, ty, spd, dt);
    u.repath = (u.repath || 0) - dt;
    if (u.repath <= 0 || !u.at || u.at.c !== a.c || u.at.r !== a.r || !u.goal || u.goal.c !== b.c || u.goal.r !== b.r) {
      u.next = knightStep(a, b); u.at = a; u.goal = b; u.repath = 0.3;
    }
    if (!u.next) return false; // cesta neexistuje (zamurovaný bez brány)
    return moveTo(u, tileX(u.next.c) + T / 2, tileY(u.next.r) + T / 2 + 3, spd, dt);
  }

  // rytier alebo kráľ: nájdi nepriateľa v okruhu domova, bojuj, inak sa vráť
  function updateFighter(u, dt, homeX, homeY, aggro, dmg, cleave, mover) {
    const go = mover || moveTo;
    u.flash = Math.max(0, u.flash - dt);
    u.cd = Math.max(0, u.cd - dt);
    if (u.tgt && (u.tgt.dead || Math.hypot(u.tgt.x - homeX, u.tgt.y - homeY) > aggro + 16)) u.tgt = null;
    if (!u.tgt) u.tgt = nearestEnemy(homeX, homeY, aggro, true);
    const t = u.tgt;
    const cry = st.cryT > 0 ? 1 : 0, spd = (u.spd || 26) * (1 + 0.4 * cry) * waterMul(u);
    if (cry) dmg *= 1.6;
    if (t) {
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      if (d > 8) go(u, t.x + (u.x < t.x ? -5 : 5), t.y + 1, spd, dt);
      else {
        if (!t.foe) t.foe = u;
        if (u.cd <= 0) {
          u.cd = u.isKing ? 0.8 * (1 - 0.12 * tal('swift')) : 0.8; u.swing = 0.15;
          AUDIO.play(u.isKing ? 'kingHit' : 'clang');
          if (cleave) { for (const e of st.enemies) if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < 10) damage(e, dmg); }
          else damage(t, dmg);
        }
      }
    } else go(u, homeX, homeY, spd * 0.85, dt);
    u.swing = Math.max(0, (u.swing || 0) - dt);
  }

  // kasárne v intervaloch vyšlú rytiera, ktorý ide oproti horde
  function updateBarracks(b, dt) {
    b.spawnT -= dt;
    if (b.spawnT > 0) return;
    const alive = st.soldiers.filter(s => s.home === b).length;
    if (alive >= knightCap(b)) { b.spawnT = 0.5; return; }
    b.spawnT = knightEvery(b);
    const c = bCenter(b);
    const kt = KTYPES[b.ktype || 'knight'], khp = knightHp(b) * kt.hp;
    st.soldiers.push({ home: b, x: c.x + 1, y: tileY(b.r) + T + 1, hp: khp, max: khp, dmg: knightDmg(b) * kt.dmg, spd: kt.spd, spr: kt.spr, ktype: b.ktype || 'knight', cd: 0, tgt: null, anim: 0, flash: 0, dead: false, slot: st.soldierN++ });
    for (let k = 0; k < 4; k++) part(c.x, tileY(b.r) + T, (Math.random() - 0.5) * 20, -Math.random() * 10, 0.3, '#c6a272', 40);
  }

  function fireCatapult(b) {
    const c = bCenter(b), rng = bRange(b), minR = BUILD.catapult.minRange;
    let best = null, bn = -1;
    for (const e of st.enemies) {
      if (e.dead || e.d.fly || e.y < 4) continue;
      const d = Math.hypot(e.x - c.x, e.y - c.y);
      if (d > rng || d < minR) continue;
      let n = 0; for (const o of st.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 20) n++;
      if (n > bn) { bn = n; best = e; }
    }
    if (!best) return false;
    const sx = c.x + 5, sy = tileY(b.r) + 2, tx = best.x, ty = best.y - 3;
    const dist = Math.hypot(tx - sx, ty - sy);
    st.proj.push({ k: 'rock', arc: true, sx, sy, x: sx, y: sy, tx, ty, t: 0, dur: Math.max(0.5, dist / BUILD.catapult.speed), h: 14 + dist * 0.25, dmg: bDmg(b), splash: BUILD.catapult.splash });
    AUDIO.play('bolt');
    return true;
  }
  function fireFrom(b) {
    const def = BUILD[b.kind], c = bCenter(b);
    return shoot(c.x, c.y, c.x, tileY(b.r) + T - (b.kind === 'mage' ? 36 : 28), bRange(b), b.spec === 'fire' ? 'farrow' : def.proj, def.speed * (b.spec === 'sniper' ? 1.4 : 1), bDmg(b), def.splash || 0);
  }
  function fireWallUnit(b) {
    const u = b.unit, d = WUNIT[u.type], c = bCenter(b);
    return shoot(c.x, c.y, c.x, tileY(b.r) - 6, uRange(u), d.proj, d.speed, uDmg(u), 0);
  }
  function shoot(cx, cy, ox, oy, rng, proj, speed, dmg, splash) {
    const c = { x: cx, y: cy };
    let best = null, bd = 1e9;
    for (const e of st.enemies) {
      if (e.dead || e.y < 4) continue;
      if (Math.hypot(e.x - c.x, e.y - c.y) > rng) continue;
      const t = tileAt(e.x, e.y), v = st.dist[t.r * G.cols + t.c];
      if (v < bd) { bd = v; best = e; }
    }
    if (!best) return false;
    const p = { k: proj, x: ox, y: oy, tgt: best, tx: best.x, ty: best.y - best.h * 0.5, dmg, spd: speed, splash, vx: 0, vy: -1 };
    if (p.k === 'fire') p.tgt = null;
    st.proj.push(p);
    AUDIO.play(proj === 'farrow' ? 'arrow' : proj);
    return true;
  }

  // strelnica v intervaloch vyšle lukostrelca (najviac archerCap naraz)
  function updateRange(b, dt) {
    b.spawnT -= dt;
    if (b.spawnT > 0) return;
    if (st.soldiers.filter(s => s.home === b).length >= archerCap(b)) { b.spawnT = 0.5; return; }
    b.spawnT = archerEvery(b);
    const c = bCenter(b), hp = archerHp(b);
    st.soldiers.push({ home: b, archer: true, x: c.x + 1, y: tileY(b.r) + T + 1, hp, max: hp, dmg: archerDmg(b), spd: 24, spr: 'footArcher', cd: 0.3, tgt: null, anim: 0, flash: 0, dead: false, slot: st.soldierN++ });
    for (let k = 0; k < 4; k++) part(c.x, tileY(b.r) + T, (Math.random() - 0.5) * 20, -Math.random() * 10, 0.3, '#c6a272', 40);
  }
  // lukostrelec: stojí kúsok za rytiermi a strieľa na najbližšiu hordu v dosahu; keď nikto nie je v dosahu, ide na svoje miesto
  function updateArcher(u, dt, hx, hy) {
    u.flash = Math.max(0, u.flash - dt);
    u.cd = Math.max(0, u.cd - dt);
    let near = false;
    for (const e of st.enemies) if (!e.dead && e.y > 4 && Math.hypot(e.x - u.x, e.y - u.y) <= ARCHER_RANGE) { near = true; break; }
    if (near) {
      if (u.cd <= 0 && shoot(u.x, u.y, u.x, u.y - 9, ARCHER_RANGE, 'arrow', 180, u.dmg, 0)) { u.cd = ARCHER_CD; u.swing = 0.1; }
      u.swing = Math.max(0, (u.swing || 0) - dt);
      return;
    }
    moveKnight(u, hx, hy, (u.spd || 24) * waterMul(u), dt);
  }

  // pomocník vyjde z budovy, keď žiadny jej pomocník nežije (prvý hneď na začiatku vlny)
  function updateHelperHome(b, dt) {
    if (st.soldiers.some(s => s.home === b && s.helper && !s.dead)) return;
    b.spawnT -= dt;
    if (b.spawnT > 0) return;
    b.spawnT = HELPER_RESPAWN;
    const h = HELPERS[b.kind], c = bCenter(b), hp = h.hp * lvlMul(b, 0.3);
    st.soldiers.push({ home: b, helper: b.kind, x: c.x + 1, y: tileY(b.r) + T + 1, hp, max: hp, spd: h.spd, spr: h.spr, rate: h.rate(b), cd: 0, tgt: null, anim: 0, flash: 0, swing: 0, dead: false });
    for (let k = 0; k < 4; k++) part(c.x, tileY(b.r) + T, (Math.random() - 0.5) * 20, -Math.random() * 10, 0.3, '#c6a272', 40);
  }
  // mních ide za najviac zraneným rytierom/kráľom, remeselník k najviac poškodenej budove; inak sa vráti domov
  function updateHelper(u, dt) {
    u.flash = Math.max(0, u.flash - dt);
    u.swing = Math.max(0, (u.swing || 0) - dt);
    if (u.home) u.rate = HELPERS[u.helper].rate(u.home);
    // drží sa svojho cieľa, kým ho úplne neopraví / nevylieči; až potom si vyberie najviac poškodený ďalší
    const healMax = o => o.isKing ? kingMax() : o.max;
    const valid = t => !!t && (u.helper === 'chapel'
      ? !t.dead && (t.isKing || st.soldiers.includes(t)) && t.hp < healMax(t)
      : st.blds.includes(t) && t.hp < bMaxHp(t));
    if (!valid(u.tgt)) {
      u.tgt = null;
      let best = 1;
      if (u.helper === 'chapel') {
        for (const o of st.soldiers.concat(st.king && !st.king.dead ? [st.king] : [])) {
          if (o === u || o.dead || o.helper) continue;
          const r = o.hp / healMax(o);
          if (r < best) { best = r; u.tgt = o; }
        }
      } else {
        for (const b of st.blds) {
          if (!BUILD[b.kind].hp) continue;
          const r = b.hp / bMaxHp(b);
          if (r < best) { best = r; u.tgt = b; }
        }
      }
    }
    const tgt = u.tgt;
    let tx = 0, ty = 0;
    if (tgt && u.helper === 'chapel') { tx = tgt.x + (u.x < tgt.x ? -6 : 6); ty = tgt.y + 1; }
    else if (tgt) { tx = tileX(tgt.c) + T / 2; ty = tileY(tgt.r) + T + 3; }
    u.working = false;
    const spd = u.spd * waterMul(u);
    if (!tgt) { // nikto nepotrebuje pomoc – späť k budove
      if (u.home) moveKnight(u, tileX(u.home.c) + T / 2 + 1, tileY(u.home.r) + T + 2, spd * 0.85, dt);
      return;
    }
    if (Math.hypot(tx - u.x, ty - u.y) > 7) { moveKnight(u, tx, ty, spd, dt); return; }
    // pri cieli: lieči / opravuje
    u.working = true;
    if (u.helper === 'chapel') {
      tgt.hp = Math.min(tgt.isKing ? kingMax() : tgt.max, tgt.hp + u.rate * dt);
      if (Math.random() < 0.15) part(tgt.x + (Math.random() - 0.5) * 6, tgt.y - 6 - Math.random() * 6, 0, -12, 0.6, '#9cd45a', 0);
    } else {
      tgt.hp = Math.min(bMaxHp(tgt), tgt.hp + u.rate * dt);
      const prev = u.cd; u.cd -= dt;
      if (prev >= 0.13 && u.cd < 0.13) { // kladivo dopadá: úder, zvuk a iskry
        AUDIO.play('thud');
        for (let k = 0; k < 4; k++) part(tx + (Math.random() - 0.5) * 8, ty - 6, (Math.random() - 0.5) * 30, -10 - Math.random() * 20, 0.35, Math.random() < 0.5 ? '#f8d048' : '#c6a272', 80);
      }
      if (u.cd <= 0) u.cd = 0.5; // ďalší zdvih
    }
  }

  function ability(id) {
    if (st.phase !== 'battle' || !has(id)) return;
    const a = ABIL[id];
    if (id === 'warcry') {
      if (st.cryCd > 0) { AUDIO.play('deny'); return; }
      st.cryT = a.dur + 2 * tal('roar'); st.cryCd = a.cd; AUDIO.play('horn'); banner('Za kráľa!');
    } else {
      if (st.freezeCd > 0) { AUDIO.play('deny'); return; }
      st.freezeT = a.dur + 1.5 * tal('frost'); st.freezeCd = a.cd; AUDIO.play('unlock'); banner('Mráz!');
    }
  }

  function volley(x, y) {
    if (st.volleyT > 0) { st.marks.push({ x, y, life: 0.25, max: 0.25, no: true }); AUDIO.play('deny'); return; }
    st.volleyT = volleyCd();
    AUDIO.play('volley');
    st.marks.push({ x, y, life: 0.7, max: 0.7 });
    const R = 13;
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
      const tx = x + Math.cos(a) * r, ty = y + Math.sin(a) * r * 0.7;
      st.drops.push({ x: tx, ty, y: ty - 80, delay: k * 0.04 + Math.random() * 0.05, dmg: volleyDmg() });
    }
  }

  function update(dt) {
    if (st.spawnQ.length) {
      st.spawnT -= dt;
      if (st.spawnT <= 0) { spawnEnemy(st.spawnQ.shift()); st.spawnT = st.spawnQ.length ? st.spawnQ[0].gap : 0; }
    }
    for (const e of st.enemies) { if (!e.dead) updateEnemy(e, dt); if (st.phase !== 'battle') return; }
    separate();
    // budovy
    for (const b of st.blds) {
      b.flash = Math.max(0, b.flash - dt);
      if (b.kind === 'tower' || b.kind === 'mage') { b.cd -= dt; if (b.cd <= 0 && fireFrom(b)) b.cd = bCd(b); }
      else if (b.kind === 'catapult') { b.cd -= dt; if (b.cd <= 0 && fireCatapult(b)) b.cd = bCd(b); }
      else if (b.unit) { b.unit.cd -= dt; if (b.unit.cd <= 0 && fireWallUnit(b)) b.unit.cd = uCd(b.unit); }
      else if (b.kind === 'barracks') updateBarracks(b, dt);
      else if (b.kind === 'range') updateRange(b, dt);
      else if (HELPERS[b.kind]) updateHelperHome(b, dt);
      else if (b.kind === 'beartrap' && b.armT > 0) b.armT -= dt;
    }
    // rytieri
    // rytieri: pochodujú pred zónu a bijú sa s najbližšou hordou (kým bojujú, horda stojí)
    const musterY = musterYOf();
    for (const s of st.soldiers) {
      if (s.dead) continue;
      if (s.helper) { updateHelper(s, dt); continue; }
      if (s.archer) { updateArcher(s, dt, G.gx0 + ((s.slot * 37 + 18) % (G.cols * T - 16)) + 8, musterY + 16); continue; }
      const mx = G.gx0 + ((s.slot * 37) % (G.cols * T - 16)) + 8;
      updateFighter(s, dt, mx, musterY, 9999, s.dmg, false, moveKnight);
    }
    st.soldiers = st.soldiers.filter(s => !s.dead);
    // kráľ
    const k = st.king;
    if (k.dead) k.deadT += dt;
    else {
      updateFighter(k, dt, k.hx, k.hy, 40 + 10 * tal('reach'), kingDmg(), true, moveKnight); // aj kráľ chodí len cez brány
      if (tal('regen') && k.hp < kingMax()) k.hp = Math.min(kingMax(), k.hp + kingMax() * 0.015 * tal('regen') * dt);
    }
    // strely
    for (const p of st.proj) {
      if (p.arc) { // balvan z katapultu letí po oblúku na miesto
        p.t += dt / p.dur;
        const t = Math.min(1, p.t);
        p.x = p.sx + (p.tx - p.sx) * t; p.gy = p.sy + (p.ty - p.sy) * t; p.y = p.gy - Math.sin(Math.PI * t) * p.h;
        if (p.t >= 1) { impact(p); p.done = true; }
        continue;
      }
      if (p.tgt && !p.tgt.dead) { p.tx = p.tgt.x; p.ty = p.tgt.y - p.tgt.h * 0.5; }
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), step = p.spd * dt;
      if (dist > 0.001) { p.vx = dx / dist; p.vy = dy / dist; }
      if (p.k === 'fire' && Math.random() < 0.8) part(p.x, p.y, (Math.random() - 0.5) * 10, -Math.random() * 10, 0.3, Math.random() < 0.5 ? '#f89838' : '#d83818', 0);
      if (dist <= step) { impact(p); p.done = true; }
      else { p.x += p.vx * step; p.y += p.vy * step; }
    }
    st.proj = st.proj.filter(p => !p.done);
    // šípy goblinov
    for (const p of st.eproj) {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), stp = 130 * dt;
      p.vx = dx / (d || 1); p.vy = dy / (d || 1);
      if (d <= stp) {
        p.done = true;
        if (p.tgt === HALL) hitHall(p.dmg, p.tx);
        else if (p.tgt.kind) { if (st.blds.includes(p.tgt)) hitBuilding(p.tgt, p.dmg); }
        else if (!p.tgt.dead) hitUnit(p.tgt, p.dmg);
        if (st.phase !== 'battle') return;
      } else { p.x += p.vx * stp; p.y += p.vy * stp; }
    }
    st.eproj = st.eproj.filter(p => !p.done);
    // salva
    for (const dr of st.drops) {
      if (dr.delay > 0) { dr.delay -= dt; continue; }
      dr.y += 300 * dt;
      if (dr.y >= dr.ty) {
        dr.done = true;
        for (const e of st.enemies) {
          if (!e.dead && Math.abs(e.x - dr.x) < e.w * 0.5 + 2 && Math.abs((e.y - e.h * 0.4) - dr.ty) < e.h * 0.5 + 3) damage(e, dr.dmg);
        }
        for (let q = 0; q < 3; q++) part(dr.x, dr.ty, (Math.random() - 0.5) * 25, -Math.random() * 20, 0.3, '#967048', 80);
      }
    }
    st.drops = st.drops.filter(d => !d.done);
    st.enemies = st.enemies.filter(e => !e.dead);
    st.volleyT = Math.max(0, st.volleyT - dt);
    st.cryT = Math.max(0, st.cryT - dt); st.cryCd = Math.max(0, st.cryCd - dt);
    st.freezeT = Math.max(0, st.freezeT - dt); st.freezeCd = Math.max(0, st.freezeCd - dt);
    if (st.freezeT > 0 && Math.random() < 0.6) part(Math.random() * W, Math.random() * G.hallTop, (Math.random() - 0.5) * 6, 12, 1.2, Math.random() < 0.5 ? '#ffffff' : '#88b4ff', 0);
    updateFx(dt);
    if (st.phase === 'battle' && !st.spawnQ.length && !st.enemies.length) endWave();
  }

  function impact(p) {
    if (p.k === 'rock') {
      AUDIO.play('boom');
      for (const e of st.enemies) if (!e.dead && !e.d.fly && Math.hypot(e.x - p.tx, (e.y - 3) - p.ty) <= p.splash) damage(e, p.dmg);
      for (let k = 0; k < 18; k++) { const a = Math.random() * 6.28, sp = 15 + Math.random() * 40; part(p.tx, p.ty, Math.cos(a) * sp, Math.sin(a) * sp - 15, 0.4 + Math.random() * 0.3, ['#848490', '#525262', '#967048', '#1c140e'][k % 4], 90); }
      st.shake = Math.max(st.shake, 0.08);
      return;
    }
    if (p.splash) {
      AUDIO.play('boom');
      for (const e of st.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.tx, dy = (e.y - e.h * 0.5) - p.ty;
        if (dx * dx + dy * dy <= p.splash * p.splash) damage(e, p.dmg);
      }
      for (let k = 0; k < 22; k++) {
        const a = Math.random() * 6.28, s = 20 + Math.random() * 50;
        part(p.tx, p.ty, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.3, ['#fff070', '#f89838', '#d83818', '#3e2614'][k % 4], 0);
      }
    } else if (p.tgt && !p.tgt.dead) {
      if (p.k === 'farrow') { p.tgt.burnT = 3; p.tgt.burnDps = Math.max(p.tgt.burnDps || 0, p.dmg * 0.5); }
      damage(p.tgt, p.dmg);
    } else part(p.tx, p.ty, 0, -10, 0.2, '#bcc0cc', 0);
  }

  function updateFx(dt) {
    for (const q of st.parts) { q.life -= dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; }
    st.parts = st.parts.filter(q => q.life > 0);
    for (const t of st.texts) { t.life -= dt; t.y -= 14 * dt; }
    st.texts = st.texts.filter(t => t.life > 0);
    for (const m of st.marks) m.life -= dt;
    st.marks = st.marks.filter(m => m.life > 0);
    st.shake = Math.max(0, st.shake - dt);
    st.hallFlash = Math.max(0, st.hallFlash - dt);
    if (st.king) st.king.flash = Math.max(0, (st.king.flash || 0) - dt);
    for (const b of st.blds) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
  }

  // ---------------- Render ----------------
  function shadow(x, y, r) {
    g.fillStyle = 'rgba(10,8,6,0.38)';
    for (let dx = -r; dx <= r; dx++) g.fillRect(Math.round(x) + dx, Math.round(y) - 1, 1, Math.abs(dx) >= r - 1 ? 1 : 2);
  }

  function drawEnemy(e, time) {
    const frames = SPR[e.d.spr];
    if (e.d.fly) { // netopier mávajúci krídlami, tieň na zemi
      const fr = frames[Math.floor(time * 8 + e.ph) % 2];
      shadow(e.x, e.y + 2, 3);
      g.drawImage(e.flash > 0 ? fr.f : fr.c, Math.round(e.x - fr.w / 2), Math.round(e.y - 14 + Math.sin(time * 6 + e.ph) * 1.5));
      return;
    }
    const walking = !e.attacking && !e.foe;
    const fi = walking ? Math.floor(e.anim) % 2 : 0;
    const fr = frames[fi];
    const x = Math.round(e.x - fr.w / 2);
    const y = Math.round(e.y - fr.h + (e.lunge > 0 ? 2 : 0) + (walking && fi ? 1 : 0));
    shadow(e.x, e.y, Math.ceil(fr.w * 0.35));
    if (e.d.boss) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(200,40,20,' + (0.18 + Math.sin(time * 5) * 0.08) + ')';
      g.beginPath(); g.ellipse(e.x, e.y - fr.h / 2, fr.w * 0.75, fr.h * 0.7, 0, 0, 6.29); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.drawImage(e.flash > 0 ? fr.f : fr.c, x, y);
  }

  // kladivo remeselníka: pri chôdzi na pleci, pri oprave sa napriahne do strany a švihne do budovy
  function drawHammer(u, x, y) {
    const hx = x + 11, hy = y + 6;                                  // ruka v sprite
    // pri oprave: náprah = kladivo stiahnuté do strany, úder = švih hore do budovy pred ním (hra ho ukazuje zozadu)
    const wind = u.working && u.cd >= 0.13, hit = u.working && u.cd < 0.13;
    const px = (cx, cy, col) => { g.fillStyle = col; g.fillRect(cx, cy, 1, 1); };
    const handle = wind ? [[1, 1], [2, 1], [3, 2], [4, 2]] : [[0, -1], [0, -2], [0, -3], [1, -4], [1, -5]].concat(hit ? [[1, -6]] : []);
    const hd = wind ? { x: hx + 4, y: hy, w: 3, h: 4 } : { x: hx - 1, y: hy - (hit ? 9 : 8), w: 4, h: 3 };
    g.fillStyle = PAL.K;                                            // obrys
    for (const [dx, dy] of handle) g.fillRect(hx + dx - 1, hy + dy - 1, 3, 3);
    g.fillRect(hd.x - 1, hd.y - 1, hd.w + 2, hd.h + 2);
    for (const [dx, dy] of handle) px(hx + dx, hy + dy, '#a86c38');
    g.fillStyle = '#80869a'; g.fillRect(hd.x, hd.y, hd.w, hd.h);   // hlava kladiva
    g.fillStyle = '#bcc0cc'; g.fillRect(hd.x, hd.y, hd.w, 1); g.fillRect(hd.x, hd.y, 1, hd.h);
    px(hd.x, hd.y, '#f4f4f8');
  }
  function drawFighter(u, sprName) {
    const frames = SPR[sprName];
    const fi = Math.floor(u.anim) % 2, fr = frames[fi];
    const x = Math.round(u.x - fr.w / 2), y = Math.round(u.y - fr.h - (u.swing > 0 ? 1 : 0));
    shadow(u.x, u.y, 4);
    g.drawImage(u.flash > 0 ? fr.f : fr.c, x, y);
    if (sprName === 'craft') drawHammer(u, x, y);
    if (st.cryT > 0 && Math.random() < 0.15) part(u.x + (Math.random() - 0.5) * 8, u.y - 8, 0, -16, 0.4, '#f8d048', 0); // pokrik
    if (u.swing > 0) { // záblesk meča
      g.fillStyle = '#ffffff';
      g.fillRect(x + fr.w - 1, y - 2, 1, 3); g.fillRect(x + fr.w, y - 3, 1, 2);
    }
  }

  // padnutý kráľ: klesne na kolená (nohy zmiznú pod ním), plášť sa zavlní, nad korunou krúžia hviezdičky, potom zmizne
  const KING_GONE = 3.2;
  // pri páde kráľa sa boj na chvíľu spomalí na tretinu (v reálnom čase), aby si to hráč všimol
  const SLOWMO_DUR = 1.0;
  let slowmoT = 0;
  function drawDeadKing(k, time) {
    const fr = SPR.king[0], t = k.deadT;
    const fall = Math.min(1, t / 0.45), drop = Math.round(4 * fall * fall);
    const alpha = t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.6);
    const x0 = Math.round(k.x - fr.w / 2), y0 = Math.round(k.y - fr.h) + drop, gy = Math.round(k.y);
    const amp = t < 1.3 ? 1.6 * (1 - t / 1.3) : 0; // vlnenie plášťa doznieva
    g.globalAlpha = alpha;
    shadow(k.x, k.y, 5);
    for (let r = 0; r < fr.h; r++) {
      const y = y0 + r;
      if (y >= gy) break; // pod zemou (nohy) sa nekreslí
      const dx = r >= 6 ? Math.round(Math.sin(t * 14 - r * 0.9) * amp * (r - 5) / 7) : 0;
      g.drawImage(fr.c, 0, r, fr.w, 1, x0 + dx, y, fr.w, 1);
    }
    if (fall >= 1 && alpha > 0) { // hviezdičky okolo koruny
      const cx = k.x, cy = y0 - 2;
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + i * 2.094, sx = Math.round(cx + Math.cos(a) * 7), sy = Math.round(cy + Math.sin(a) * 2);
        g.fillStyle = PAL.K; g.fillRect(sx - 2, sy - 1, 5, 3); g.fillRect(sx - 1, sy - 2, 3, 5);
        g.fillStyle = '#f8d048'; g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3);
        g.fillStyle = '#ffffff'; g.fillRect(sx, sy, 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  // orkský hrad + zástavy zostávajúcich vĺn na cimburí
  function drawFortKeep(F, time) {
    const k = BSPR.orcKeep, x0 = Math.round(F.x - k.w / 2), y0 = F.y - k.h;
    g.drawImage(F.flash > 0 ? k.f : k.c, x0, y0);
    const left = Math.max(0, MISSION_WAVES - st.wave);
    for (let i = 0; i < left; i++) { // 5 zástav na ľavých hradbách, 5 na pravých
      const fx = x0 + (i < 5 ? 2 + i * 3 : 40 + (i - 5) * 3), fy = y0 + 9, wv = Math.floor(time * 5 + i) % 2;
      g.fillStyle = '#3e2614'; g.fillRect(fx, fy, 1, 6);
      g.fillStyle = '#8c2018'; g.fillRect(fx + 1, fy + wv, 2, 2);
      g.fillStyle = '#e84838'; g.fillRect(fx + 1, fy + wv, 1, 1);
    }
  }

  function bar(cx, y, w, ratio, col) {
    const x = Math.round(cx - w / 2);
    g.fillStyle = PAL.K; g.fillRect(x - 1, y - 1, w + 2, 3);
    g.fillStyle = '#3a1410'; g.fillRect(x, y, w, 1);
    g.fillStyle = col; g.fillRect(x, y, Math.max(1, Math.round(w * ratio)), 1);
  }

  function drawBuilding(b, time) {
    const x0 = tileX(b.c), y0 = tileY(b.r);
    let spr;
    if (b.kind === 'wall') {
      const edgeL = b.c === 0 && G.gx0 > 0 && !scene.theme.sea, // pri mori hradba končí na pláži
        edgeR = b.c === G.cols - 1 && W - (x0 + T) > 0;
      const m = (joins(b.c, b.r - 1) ? 1 : 0) | (joins(b.c + 1, b.r) || edgeR ? 2 : 0) | (joins(b.c, b.r + 1) ? 4 : 0) | (joins(b.c - 1, b.r) || edgeL ? 8 : 0);
      const wl = Math.max(1, Math.min(5, b.lvl)) - 1;
      spr = BSPR.wall[wl][m];
      g.drawImage(b.flash > 0 ? spr.f : spr.c, x0, y0 - 6);
      // napojenie: kraje obrazovky a susedné budovy (veža, kasárne, mág)
      const flat = BSPR.wall[wl][m | 2 | 8][b.flash > 0 ? 'f' : 'c'];
      const slice = (dx, w) => { for (let k = 0; k < w; k += 4) { const ww = Math.min(4, w - k); g.drawImage(flat, 6, 0, ww, 24, dx + k, y0 - 6, ww, 24); } };
      if (edgeL) slice(0, G.gx0);
      if (edgeR) slice(x0 + T, W - x0 - T);
      if (joinsBuilding(b.c + 1, b.r)) slice(x0 + T, 4);
      if (joinsBuilding(b.c - 1, b.r)) slice(x0 - 4, 4);
      if (b.spikes) { // ostne na čele hradby
        const sk = b.spikeType ? SPIKE_TYPES[b.spikeType] : null;
        for (let k = 1; k < T - 1; k += 3) { g.fillStyle = PAL.K; g.fillRect(x0 + k, y0 + 6, 1, 3); g.fillStyle = sk ? sk.tip : '#f4f4f8'; g.fillRect(x0 + k, y0 + 5, 1, 1); g.fillStyle = sk ? sk.body : '#bcc0cc'; g.fillRect(x0 + k, y0 + 6, 1, 2); }
        if (b.spikeType === 'fire' && Math.random() < 0.04) part(x0 + 2 + Math.random() * (T - 4), y0 + 5, 0, -10, 0.4, '#f89838', -5);
      }
      if (b.gate) {
        const gh = BSPR.gatehouse[wl];
        g.drawImage(b.flash > 0 ? gh.f : gh.c, x0, y0 - 15);
        for (const fx of [x0 + 2, x0 + 12]) { // vlajočky na pilieroch
          const wv = Math.floor(time * 6 + fx * 0.7) % 2;
          g.fillStyle = '#4a4e60'; g.fillRect(fx, y0 - 20, 1, 5);
          g.fillStyle = '#3c64c8'; g.fillRect(fx + 1, y0 - 20 + wv, 4, 2);
          g.fillStyle = '#88b4ff'; g.fillRect(fx + 1, y0 - 20 + wv, 2, 1);
          g.fillStyle = '#f8d048'; g.fillRect(fx + 4, y0 - 19 - wv, 1, 1);
        }
      } else if (b.unit) {
        const us = SPR[WUNIT[b.unit.type].spr][0];
        g.drawImage(us.c, 0, 0, us.w, 11, x0 + 1, y0 - 9, us.w, 11);
        if (b.unit.lvl > 1) pxText(g, String(b.unit.lvl), x0 + 1, y0 - 8, '#88b4ff');
      }
    } else {
      spr = bsprOf(b.kind, b.lvl);
      g.drawImage(b.flash > 0 ? spr.f : spr.c, x0 + T / 2 - Math.floor(spr.w / 2), y0 + T + 1 - spr.h);
      if (b.spec) { // vlajočka špecializácie na veži
        const fx = x0 + 13, fy = y0 + T + 1 - spr.h - 4, wv = Math.floor(time * 6 + b.c) % 2;
        g.fillStyle = '#4a4e60'; g.fillRect(fx, fy, 1, 6);
        g.fillStyle = SPECS[b.spec].col; g.fillRect(fx + 1, fy + wv, 3, 2);
      }
      if (b.kind === 'mage') {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(255,200,80,' + (0.25 + Math.sin(time * 4 + b.c) * 0.12) + ')';
        g.beginPath(); g.arc(x0 + 8.5, y0 + T + 1 - spr.h + 2, 4, 0, 6.29); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    }
    if (b.lvl > 1 && b.kind !== 'wall') pxText(g, String(b.lvl), x0 + T - 3, y0 + T - 6, '#f8d048');
  }
  const JOINERS = { wall: 1, tower: 1, mage: 1 }; // hradby sa napájajú len na hradby a veže (strážna, mága) – na ostatné budovy nie
  const joins = (c, r) => { const o = occAt(c, r); return !!o && (o === HALL || !!JOINERS[o.kind]); };
  const joinsBuilding = (c, r) => { const o = occAt(c, r); return !!o && o !== HALL && o.kind !== 'wall' && !!JOINERS[o.kind]; };

  function drawHall(time) {
    const spr = bsprOf('hall', st.hallLvl);
    const x = Math.round(G.hallCx - spr.w / 2), y = G.hallBot + 1 - spr.h;
    g.drawImage(st.hallFlash > 0 ? spr.f : spr.c, x, y);
    // vlajky
    for (const fx of [x + 7, x + 42]) {
      const wv = Math.floor(time * 6 + fx) % 2;
      g.fillStyle = '#3c64c8'; g.fillRect(fx + 1, y - 0 + wv, 5, 2);
      g.fillStyle = '#88b4ff'; g.fillRect(fx + 1, y + wv, 2, 1);
      g.fillStyle = '#f8d048'; g.fillRect(fx + 5, y + 1 - wv, 1, 1);
    }
    // oheň pri poškodení
    const r = st.hallHp / hallMax();
    if (r < 0.5 && st.phase === 'battle' && Math.random() < (0.6 - r)) {
      part(x + 8 + Math.random() * 36, y + 20 + Math.random() * 20, (Math.random() - 0.5) * 8, -20 - Math.random() * 15, 0.7, Math.random() < 0.5 ? '#f89838' : '#525262', -5);
    }
  }

  function drawPit(b, time) {
    const spr = BSPR[b.kind], x = tileX(b.c), y = tileY(b.r);
    g.globalAlpha = b.kind === 'beartrap' && b.armT > 0 ? 0.45 : 1; // nabíjajúca sa pasca
    g.drawImage(b.flash > 0 ? spr.f : spr.c, x, y);
    g.globalAlpha = 1;
    if (b.kind === 'firepit' && st.phase === 'battle' && Math.random() < 0.25) part(x + 4 + Math.random() * 8, y + 6, 0, -10 - Math.random() * 8, 0.5, Math.random() < 0.5 ? '#f89838' : '#fff070', -8);
    if (b.lvl > 1) pxText(g, String(b.lvl), x + T - 3, y + T - 6, '#f8d048');
  }

  function corners(x0, y0, x1, y1, col) {
    g.fillStyle = col;
    const L = 3;
    g.fillRect(x0, y0, L, 1); g.fillRect(x0, y0, 1, L);
    g.fillRect(x1 - L + 1, y0, L, 1); g.fillRect(x1, y0, 1, L);
    g.fillRect(x0, y1, L, 1); g.fillRect(x0, y1 - L + 1, 1, L);
    g.fillRect(x1 - L + 1, y1, L, 1); g.fillRect(x1, y1 - L + 1, 1, L);
  }

  // náhľad ťahanej novej stavby – kreslí sa nad stavbami, aby bolo červené políčko vidieť aj cez budovu
  function drawPlaceGhost(time) {
    if (!pdrag || !pdrag.t) return;
    const blink = Math.floor(time * 4) % 2;
    const { c, r } = pdrag.t, hx = tileX(c), hy = tileY(r), kind = pdrag.kind;
    const ok = canPlace(c, r) && st.gold >= costOf(kind); // zelená = dá sa postaviť, červená = posuň prst ďalej
    g.fillStyle = ok ? 'rgba(156,212,90,0.35)' : 'rgba(232,72,56,0.5)'; g.fillRect(hx, hy, T, T);
    const spr = kind === 'wall' ? BSPR.wall[0][10] : TRAPS[kind] ? BSPR[kind] : bsprOf(kind, 1);
    g.globalAlpha = ok ? 0.75 : 0.45;
    if (kind === 'wall') g.drawImage(spr.c, hx, hy - 6);
    else if (TRAPS[kind]) g.drawImage(spr.c, hx, hy);
    else g.drawImage(spr.c, hx + T / 2 - Math.floor(spr.w / 2), hy + T + 1 - spr.h);
    g.globalAlpha = 1;
    corners(hx, hy, hx + T - 1, hy + T - 1, ok ? '#9cd45a' : (blink ? '#e84838' : '#ff9a80'));
  }

  function drawBuildOverlay(time) {
    const zt = zoneTopRow();
    const blink = Math.floor(time * 4) % 2;
    // hranica zóny
    g.fillStyle = 'rgba(255,240,112,0.55)';
    const yb = tileY(zt);
    for (let x = G.gx0; x < G.gx0 + G.cols * T; x += 4) g.fillRect(x, yb, 2, 1);
    // mriežka: tenké čiary po okrajoch políčok, výraznejšie keď je zvolená stavba
    const lineCol = st.tool ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.13)';
    for (let r = zt; r <= G.rows - 1; r++) for (let c = 0; c < G.cols; c++) {
      if (inHall(c, r)) continue;
      const x = tileX(c), y = tileY(r), o = occAt(c, r);
      if (!o && st.tool) { g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 1, y + 1, T - 2, T - 2); }
      g.fillStyle = lineCol;
      g.fillRect(x + 1, y, T - 1, 1); g.fillRect(x, y + 1, 1, T - 1);       // horná a ľavá hrana
      if (c === G.cols - 1 || inHall(c + 1, r)) g.fillRect(x + T - 1, y + 1, 1, T - 1);
      if (r === G.rows - 1 || inHall(c, r + 1)) g.fillRect(x + 1, y + T - 1, T - 1, 1);
      g.fillStyle = st.tool ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)'; // rohy
      g.fillRect(x, y, 1, 1);
    }
    const col = blink ? '#f8d048' : '#fff070';
    // presúvanie: zvýrazni cieľ a ukáž polopriehľadnú stavbu
    for (const b of blockedBarracks()) { // červený výkričník: rytieri sa nedostanú von
      const x = tileX(b.c) + T / 2 - 2, y = tileY(b.r) + T - bsprOf(b.kind, b.lvl).h - 11 + (blink ? -1 : 0);
      g.fillStyle = PAL.K; g.fillRect(x - 1, y - 1, 5, 11);
      g.fillStyle = '#e84838'; g.fillRect(x, y, 3, 6); g.fillRect(x, y + 7, 3, 2);
      g.fillStyle = '#ff9a80'; g.fillRect(x, y, 1, 5);
    }
    const mv = bdrag && bdrag.moved ? bdrag.b : st.moving;
    if (mv) {
      if (st.moving) for (let r = zt; r <= G.rows - 1; r++) for (let c = 0; c < G.cols; c++) {
        if (!inHall(c, r) && !occAt(c, r)) { g.fillStyle = 'rgba(156,212,90,0.13)'; g.fillRect(tileX(c) + 1, tileY(r) + 1, T - 2, T - 2); }
      }
      const ox = tileX(mv.c), oy = tileY(mv.r);
      g.fillStyle = 'rgba(28,20,14,0.45)'; g.fillRect(ox, oy, T, T); // pôvodné miesto
      if (bdrag && bdrag.moved) {
        const h = bdrag.hover, ok = canMoveTo(mv, h.c, h.r), hx = tileX(h.c), hy = tileY(h.r);
        g.fillStyle = ok ? 'rgba(156,212,90,0.35)' : 'rgba(232,72,56,0.4)'; g.fillRect(hx, hy, T, T);
        corners(hx, hy, hx + T - 1, hy + T - 1, ok ? '#9cd45a' : '#e84838');
        const spr = mv.kind === 'wall' ? BSPR.wall[Math.max(1, Math.min(5, mv.lvl)) - 1][10] : TRAPS[mv.kind] ? BSPR[mv.kind] : bsprOf(mv.kind, mv.lvl);
        g.globalAlpha = 0.7;
        if (mv.kind === 'wall') g.drawImage(spr.c, hx, hy - 6);
        else if (TRAPS[mv.kind]) g.drawImage(spr.c, hx, hy);
        else g.drawImage(spr.c, hx + T / 2 - Math.floor(spr.w / 2), hy + T + 1 - spr.h);
        g.globalAlpha = 1;
      } else corners(ox, oy, ox + T - 1, oy + T - 1, blink ? '#9cd45a' : '#ffffff');
    }
    if (drag) { // náhľad radu hradieb pred pustením prsta
      const key = (c, r) => c + ',' + r, inPath = new Set(drag.path.map(q => key(q.c, q.r))), ok = wallsAfford();
      const j = (c, r) => inPath.has(key(c, r)) || joins(c, r);
      g.globalAlpha = 0.65;
      drag.path.forEach((q, i) => {
        const x = tileX(q.c), y = tileY(q.r);
        const m = (j(q.c, q.r - 1) ? 1 : 0) | (j(q.c + 1, q.r) ? 2 : 0) | (j(q.c, q.r + 1) ? 4 : 0) | (j(q.c - 1, q.r) ? 8 : 0);
        g.drawImage(BSPR.wall[0][m].c, x, y - 6);
        if (i >= ok) { g.fillStyle = 'rgba(232,72,56,0.55)'; g.fillRect(x, y - 6, T, T + 6); }
      });
      g.globalAlpha = 1;
      const q = drag.path[drag.path.length - 1], n = Math.min(drag.path.length, ok);
      const s = String(n * costOf('wall')), tx = Math.max(2, Math.min(W - s.length * 4 - 2, tileX(q.c) + T / 2 - s.length * 2)), ty = tileY(q.r) - 14;
      pxText(g, s, tx, ty, n < drag.path.length ? '#e84838' : '#f8d048');
    }
    if (st.sel === HALL) { const h = hallRect(); corners(h.x0, h.y0 - 8, h.x1 - 1, h.y1 - 1, col); }
    else if (selGroup()) for (const w of st.selGroup) corners(tileX(w.c), tileY(w.r), tileX(w.c) + T - 1, tileY(w.r) + T - 1, col);
    else if (st.sel) {
      const b = st.sel, x = tileX(b.c), y = tileY(b.r);
      corners(x, y, x + T - 1, y + T - 1, col);
      const rr0 = BUILD[b.kind].range ? bRange(b) : b.unit ? uRange(b.unit) : 0;
      if (rr0) {
        const c = bCenter(b), rr = rr0, n = Math.round(rr * 1.6);
        g.fillStyle = 'rgba(255,240,112,0.5)';
        for (let k = 0; k < n; k += 2) { const a = k / n * 6.283; g.fillRect(Math.round(c.x + Math.cos(a) * rr), Math.round(c.y + Math.sin(a) * rr), 1, 1); }
      }
    }
  }

  function drawProj(p) {
    const r = Math.round;
    if (p.k === 'rock') {
      g.fillStyle = 'rgba(10,8,6,0.35)'; g.fillRect(r(p.x) - 1, r(p.gy), 3, 1);
      const x = r(p.x), y = r(p.y);
      g.fillStyle = PAL.K; g.fillRect(x - 2, y - 1, 5, 3); g.fillRect(x - 1, y - 2, 3, 5);
      g.fillStyle = '#848490'; g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = '#c0c0c8'; g.fillRect(x - 1, y - 1, 1, 1);
      g.fillStyle = '#525262'; g.fillRect(x + 1, y + 1, 1, 1);
      return;
    }
    if (p.k === 'arrow' || p.k === 'farrow') {
      const cols = p.k === 'farrow' ? ['#fff070', '#f89838', '#d83818', '#6e4422', '#f89838', '#d83818'] : ['#f4f4f8', '#a86c38', '#a86c38', '#6e4422', '#ffffff', '#e84838'];
      for (let k = 0; k < 6; k++) { g.fillStyle = cols[k]; g.fillRect(r(p.x - p.vx * k), r(p.y - p.vy * k), 1, 1); }
    } else if (p.k === 'bolt') {
      const cols = ['#ffffff', '#bcc0cc', '#4a4e60', '#4a4e60', '#4a4e60'];
      for (let k = 0; k < 5; k++) { g.fillStyle = cols[k]; g.fillRect(r(p.x - p.vx * k), r(p.y - p.vy * k), 1, 1); }
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let k = 5; k < 9; k++) g.fillRect(r(p.x - p.vx * k), r(p.y - p.vy * k), 1, 1);
    } else {
      const x = r(p.x), y = r(p.y);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(248,120,40,0.35)'; g.beginPath(); g.arc(x + 0.5, y + 0.5, 5, 0, 6.29); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#d83818'; g.fillRect(x - 1, y - 2, 3, 5); g.fillRect(x - 2, y - 1, 5, 3);
      g.fillStyle = '#f89838'; g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = '#fff070'; g.fillRect(x, y - 1, 1, 2); g.fillRect(x - 1, y, 2, 1);
    }
  }

  function drawDrop(dr) {
    if (dr.delay > 0) return;
    const x = Math.round(dr.x), y = Math.round(dr.y);
    const cols = ['#e84838', '#ffffff', '#a86c38', '#a86c38', '#a86c38', '#f4f4f8'];
    for (let k = 0; k < 6; k++) { g.fillStyle = cols[k]; g.fillRect(x, y - 5 + k, 1, 1); }
  }

  function drawMark(m) {
    const t = 1 - m.life / m.max;
    const r = m.no ? 4 : 6 + t * 10;
    g.fillStyle = m.no ? 'rgba(232,72,56,0.8)' : 'rgba(255,240,112,' + (0.9 * (1 - t)) + ')';
    const n = Math.max(8, Math.round(r * 4));
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.283;
      g.fillRect(Math.round(m.x + Math.cos(a) * r), Math.round(m.y + Math.sin(a) * r * 0.7), 1, 1);
    }
  }

  // jednotná rastrová textúra: kvantovanie všetkých pixelov na rovnaké úrovne s Bayer ditheringom
  const QL = PX_LEVELS - 1;
  const QLUT = new Uint8Array(256 * 16);
  for (let v = 0; v < 256; v++) for (let t = 0; t < 16; t++) {
    QLUT[v * 16 + t] = Math.round(Math.min(QL, Math.floor(v * QL / 255 + BAYER4[t])) * 255 / QL);
  }
  function grain() {
    const id = g.getImageData(0, 0, W, H), d = id.data;
    let i = 0;
    for (let y = 0; y < H; y++) {
      const by = (y & 3) * 4;
      for (let x = 0; x < W; x++, i += 4) {
        const t = by + (x & 3);
        d[i] = QLUT[d[i] * 16 + t]; d[i + 1] = QLUT[d[i + 1] * 16 + t]; d[i + 2] = QLUT[d[i + 2] * 16 + t];
      }
    }
    g.putImageData(id, 0, 0);
  }

  function drawMapNode(i, n, time) {
    const num = i + 1, done = num < st.unlocked, open = num === st.unlocked;
    const anim = st.mapAnim && st.mapAnim.seg === i - 1; // hrad práve odomykaný
    const status = anim ? 'locked' : done ? 'done' : open ? 'open' : 'locked';
    // tieň
    g.fillStyle = 'rgba(10,8,6,0.4)';
    for (let dx = -9; dx <= 9; dx++) g.fillRect(n.x + dx, n.y + 2, 1, Math.abs(dx) > 6 ? 1 : 2);
    if (status === 'open') { // pulzujúci kruh pod hradom
      const rr = 13 + Math.sin(time * 4) * 1.2, cnt = 36;
      g.fillStyle = '#f8d048';
      for (let k = 0; k < cnt; k += 2) { const a = k / cnt * 6.283 + time; g.fillRect(Math.round(n.x + Math.cos(a) * rr), Math.round(n.y - 3 + Math.sin(a) * rr * 0.55), 1, 1); }
    }
    let top;
    if (num > HOME_PROVINCES && !done) { // hrad hordy = orkská pevnosť, kým ho hráč nedobyje
      const f = island.fort;
      g.drawImage(f.c, n.x - 12, n.y - 20);
      top = n.y - 20;
    } else {
      const c = status === 'locked' ? island.castleLocked : island.castle;
      g.drawImage(c.c, n.x - 9, n.y - 16);
      top = n.y - 16;
    }
    if (status === 'done') { // modrá zástava = dobyté
      const fx = n.x, fy = top - 6;
      g.fillStyle = '#4a4e60'; g.fillRect(fx, fy, 1, 7);
      const wv = Math.floor(time * 5 + i) % 2;
      g.fillStyle = '#3c64c8'; g.fillRect(fx + 1, fy + wv, 5, 3);
      g.fillStyle = '#88b4ff'; g.fillRect(fx + 1, fy + wv, 2, 1);
      g.fillStyle = '#f8d048'; g.fillRect(fx + 5, fy + 1 - wv, 1, 1);
    } else if (status === 'open') { // skákajúca šípka
      const ay = top - 8 + Math.round(Math.abs(Math.sin(time * 4)) * -3);
      for (let k = 0; k < 4; k++) { g.fillStyle = PAL.K; g.fillRect(n.x - k - 1, ay + k - 1, k * 2 + 3, 1); }
      for (let k = 0; k < 3; k++) { g.fillStyle = k === 0 ? '#fff070' : '#f8d048'; g.fillRect(n.x - (2 - k), ay + k, (2 - k) * 2 + 1, 1); }
    }
    // tabuľka s číslom misie
    const sn = String(num), tw = sn.length * 4 + 3, tx = n.x - Math.floor(tw / 2), ty = n.y + 3;
    g.fillStyle = PAL.K; g.fillRect(tx - 1, ty - 1, tw + 2, 9);
    g.fillStyle = status === 'done' ? '#b88420' : status === 'open' ? '#22337a' : '#2c2c38'; g.fillRect(tx, ty, tw, 7);
    g.fillStyle = status === 'done' ? '#f8d048' : status === 'open' ? '#3c64c8' : '#3e3e4c'; g.fillRect(tx, ty, tw, 1);
    pxText(g, sn, tx + 2, ty + 1, status === 'locked' ? '#848490' : '#ffffff');
    let bt = 2; while (bt > 0 && !starsOf(num, bt)) bt--;
    const ns = starsOf(num, bt);
    if (ns) for (let k = 0; k < 3; k++) drawStar(n.x - 7 + k * 5, ty + 9, k < ns, bt);
    if (st.mapSel === num) {
      const col = Math.floor(time * 4) % 2 ? '#f8d048' : '#ffffff';
      corners(n.x - 13, top - 3, n.x + 13, n.y + 12, col);
    }
  }

  // malá pixelová hviezdička 5x5
  function drawStar(x, y, on, tier) {
    const tc = TIERS[tier || 0];
    const rows = ['..1..', '.111.', '11111', '.111.', '.1.1.'];
    g.fillStyle = PAL.K;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (rows[r][c] === '1') g.fillRect(x + c - 1, y + r, 3, 1);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (rows[r][c] === '1') { g.fillStyle = on ? (r < 2 ? tc.hi : tc.col) : '#3e3e4c'; g.fillRect(x + c, y + r, 1, 1); }
  }

  // ---- provincie: juh (1–5) ľudia, sever (6–10) horda; neobránené južné sú napadnuté ----
  const provState = i => { const num = i + 1, won = num < st.unlocked; return won ? 'ours' : num <= HOME_PROVINCES ? 'attacked' : 'horde'; };
  const PROV_COL = { blue: [70, 120, 230, 0.24], red: [210, 40, 30, 0.3] };
  function provLayers() { // farebné vrstvy jednotlivých provincií + hranice (počíta sa raz pre ostrov)
    if (island.layers) return island.layers;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const P = island.prov, n = island.nodes.length;
    const L = { blue: [], red: [], border: mk() };
    for (let i = 0; i < n; i++) for (const key of ['blue', 'red']) {
      const c = mk(), x = c.getContext('2d'), id = x.createImageData(W, H), [r, gg, b, a] = PROV_COL[key];
      for (let k = 0; k < P.length; k++) if (P[k] === i) { id.data[k * 4] = r; id.data[k * 4 + 1] = gg; id.data[k * 4 + 2] = b; id.data[k * 4 + 3] = a * 255; }
      x.putImageData(id, 0, 0); L[key][i] = c;
    }
    const bx = L.border.getContext('2d'), bd = bx.createImageData(W, H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const v = P[y * W + x]; if (v === 255) continue;
      const nbs = [P[y * W + x + 1], P[(y + 1) * W + x]];
      if (!nbs.some(q => q !== 255 && q !== v)) continue;
      const front = nbs.some(q => q !== 255 && (q < HOME_PROVINCES) !== (v < HOME_PROVINCES)); // hranica ľudia × horda
      const k = (y * W + x) * 4;
      if (front) { bd.data[k] = 120; bd.data[k + 1] = 20; bd.data[k + 2] = 16; bd.data[k + 3] = 220; }
      else if ((x + y) % 3) { bd.data[k] = 28; bd.data[k + 1] = 20; bd.data[k + 2] = 14; bd.data[k + 3] = 120; } // prerušovaná
    }
    bx.putImageData(bd, 0, 0);
    island.layers = L;
    return L;
  }
  function drawProvince(i, state, time) {
    const L = provLayers();
    if (state === 'horde') { g.drawImage(L.red[i], 0, 0); return; }
    g.drawImage(L.blue[i], 0, 0);
    if (state === 'attacked') { g.globalAlpha = 0.35 + 0.3 * Math.sin(time * 3 + i); g.drawImage(L.red[i], 0, 0); g.globalAlpha = 1; } // pulzuje do červena
  }
  function drawProvinces(time) {
    const n = island.nodes.length, pa = st.provAnim;
    for (let i = 0; i < n; i++) {
      if (pa && pa.i === i) { // práve dobytá: nová farba sa rozleje od hradu
        drawProvince(i, pa.from, time);
        const nd = island.nodes[i], r = Math.max(1, Math.min(1, pa.t) * 90);
        g.save(); g.beginPath(); g.arc(nd.x, nd.y, r, 0, 6.283); g.clip(); drawProvince(i, 'ours', time); g.restore();
      } else drawProvince(i, provState(i), time);
    }
    g.drawImage(provLayers().border, 0, 0);
  }
  // ohne, dym a šípky útoku v napadnutých provinciách
  function drawWarFx(time) {
    island.nodes.forEach((nd, i) => {
      if (provState(i) !== 'attacked' || (st.provAnim && st.provAnim.i === i)) return;
      for (const f of island.fires[i]) {
        const fl = Math.floor(time * 8 + f.ph) % 3, h = 3 + fl;
        g.fillStyle = PAL.K; g.fillRect(f.x - 2, f.y - h, 5, h + 2);
        g.fillStyle = '#d83818'; g.fillRect(f.x - 1, f.y - h + 1, 3, h);
        g.fillStyle = '#f89838'; g.fillRect(f.x - 1, f.y - h + 2, 3, h - 1);
        g.fillStyle = '#fff070'; g.fillRect(f.x, f.y - 1 - (fl === 2 ? 1 : 0), 1, 2);
        if (Math.random() < 0.04) part(f.x, f.y - h - 1, (Math.random() - 0.5) * 4, -6 - Math.random() * 4, 1.6, Math.random() < 0.5 ? '#525262' : '#3e3e4c', -2);
      }
      // šípky útoku zo severu k hradu
      for (let k = 0; k < 3; k++) {
        const t = ((time * 0.8 + k / 3) % 1), ay = Math.round(nd.y - 40 + t * 18), ax = nd.x + 13;
        g.globalAlpha = Math.sin(t * Math.PI);
        for (let w = 0; w < 3; w++) { g.fillStyle = PAL.K; g.fillRect(ax - w - 1, ay + w - 1, w * 2 + 3, 1); }
        for (let w = 0; w < 2; w++) { g.fillStyle = '#e84838'; g.fillRect(ax - (1 - w), ay + w, (1 - w) * 2 + 1, 1); }
        g.globalAlpha = 1;
      }
    });
  }

  function renderMap(time) {
    g.drawImage(island.bg, 0, 0);
    drawProvinces(time);
    // príboj
    g.fillStyle = 'rgba(240,250,255,0.85)';
    for (const f of island.foam) if (Math.sin(time * 1.8 + f.ph) > 0.55) g.fillRect(f.x, f.y, 1, 1);
    drawWarFx(time);
    // cestička: dobyté úseky svetlé, zamknuté tmavé bodky
    island.segs.forEach((pts, k) => {
      const done = k + 2 <= st.unlocked;
      const anim = st.mapAnim && st.mapAnim.seg === k;
      const upto = anim ? Math.floor(pts.length * Math.min(1, st.mapAnim.t)) : done ? pts.length : 0;
      for (let j = 0; j < pts.length; j++) {
        const lit = j < upto;
        if (lit ? j % 6 >= 3 : j % 5 !== 0) continue;
        const x = Math.round(pts[j].x), y = Math.round(pts[j].y);
        if (lit) { g.fillStyle = '#3e2614'; g.fillRect(x, y + 1, 2, 1); g.fillStyle = '#fff2c8'; g.fillRect(x, y, 2, 1); }
        else { g.fillStyle = '#2e1e12'; g.fillRect(x, y, 1, 1); }
      }
    });
    island.nodes.forEach((n, i) => drawMapNode(i, n, time));
    for (const q of st.parts) {
      g.globalAlpha = Math.min(1, q.life / q.max * 2);
      g.fillStyle = q.col; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    }
    g.globalAlpha = 1;
  }

  function present() {
    grain();
    let sx = 0, sy = 0;
    if (st.shake > 0) { sx = Math.round((Math.random() - 0.5) * 3); sy = Math.round((Math.random() - 0.5) * 3); }
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, screen.width, screen.height);
    sctx.drawImage(buf, 0, 0, W, H, sx * S, (sy - Math.round(camY)) * S, W * S, H * S);
  }
  // cieľový posun kamery: v stavaní o výšku panela, v boji o spodné tlačidlá
  // ---- posúvanie mapy prstom ----
  let mapCam = 0, mapCamTarget = 0, mapDrag = null;
  const MAP_HEAD = 26; // hlavička mapy (v herných px)
  function mapCamMax() {
    if (!island) return 0;
    const panelLow = $('mapPanel').offsetHeight * DPR / S;
    const lowest = Math.max(...island.nodes.map(n => n.y)) + 22; // hrad + tabuľka s hviezdami
    return Math.max(0, lowest - (H - panelLow) + 4);
  }
  const clampMap = v => Math.max(0, Math.min(mapCamMax(), v));
  function focusMapNode(num, instant) {
    const n = island && island.nodes[num - 1];
    if (!n) return;
    const panelLow = $('mapPanel').offsetHeight * DPR / S;
    const mid = MAP_HEAD + (H - panelLow - MAP_HEAD) / 2;
    mapCamTarget = clampMap(n.y - 6 - mid);
    if (instant) mapCam = mapCamTarget;
  }

  function camTick(dt) {
    if (st.phase === 'map') {
      if (!mapDrag) mapCam += (mapCamTarget - mapCam) * Math.min(1, dt * 8);
      camY = mapCam;
      return;
    }
    let target = 0;
    const cssToLow = DPR / S;
    // pri budovaní posuň bojisko nad panel; v boji nie – spodné tlačidlá sú priehľadné nad mapou
    if (st.phase === 'build' && !$('build').hidden) target = $('build').offsetHeight * cssToLow;
    target = Math.min(target, Math.max(0, H - 60));
    camY += (target - camY) * Math.min(1, dt * 10);
    if (Math.abs(target - camY) < 0.3) camY = target;
  }

  // živé prvky krajiny: príboj, hmla, iskry, láva
  function drawSceneFx(time) {
    if (scene.mill) { // koleso mlyna sa točí, spodok je pod hladinou, pri hladine čľapot
      const m = scene.mill, fr = BSPR.millWheel[Math.floor(time * 7) % BSPR.millWheel.length];
      // os od náboja do múru mlyna
      g.fillStyle = PAL.K; g.fillRect(m.cx + 1, m.cy - 1, m.wallX - m.cx - 1, 4);
      g.fillStyle = '#8a5a2e'; g.fillRect(m.cx + 1, m.cy, m.wallX - m.cx - 1, 1);
      g.fillStyle = '#5a3a1e'; g.fillRect(m.cx + 1, m.cy + 1, m.wallX - m.cx - 1, 1);
      const vis = Math.max(0, Math.min(fr.h, m.waterY - m.y));
      if (vis) g.drawImage(fr.c, 0, 0, fr.w, vis, m.x, m.y, fr.w, vis);
      for (let k = -4; k <= 4; k++) if (Math.sin(time * 9 + k * 1.7) > 0.3) { g.fillStyle = k % 2 ? '#d8f0ff' : '#ffffff'; g.fillRect(m.cx + k, m.surfY + 1 - (Math.sin(time * 6 + k) > 0.7 ? 1 : 0), 1, 1); }
    }
    const a = scene.theme.anim;
    if (a === 'foam') {
      g.fillStyle = 'rgba(240,250,255,0.85)';
      for (const f of scene.foam) if (Math.sin(time * 1.8 + f.ph) > 0.4) g.fillRect(f.x, f.y, 1, 1);
    } else if (a === 'lava') {
      for (const l of scene.lava) {
        const v = Math.sin(time * 2 + l.ph);
        if (v > 0.6) { g.fillStyle = v > 0.9 ? '#fff070' : '#f89838'; g.fillRect(l.x, l.y, 1, 1); }
      }
      if (Math.random() < 0.15 && scene.lava.length) { const l = scene.lava[Math.floor(Math.random() * scene.lava.length)]; part(l.x, l.y, (Math.random() - 0.5) * 6, -8 - Math.random() * 10, 1, '#f89838', -2); }
    } else if (a === 'embers') {
      if (Math.random() < 0.3) part(Math.random() * W, H * (0.2 + Math.random() * 0.6), (Math.random() - 0.5) * 8, -6 - Math.random() * 10, 1.6, Math.random() < 0.5 ? '#f89838' : '#d83818', -3);
    }
  }
  function drawFog(time) {
    if (scene.theme.anim !== 'fog') return;
    g.fillStyle = 'rgba(190,210,200,0.05)';
    for (let k = 0; k < 5; k++) {
      const x = ((k * 61 + time * (6 + k * 1.3)) % (W + 120)) - 60, y = (k * 97) % Math.max(1, G.zoneTopMax) + Math.sin(time * 0.3 + k) * 8;
      g.beginPath(); g.ellipse(x, y, 46 + k * 4, 14 + (k % 3) * 4, 0, 0, 6.29); g.fill();
    }
  }

  function render(time) {
    if (st.phase === 'map') { renderMap(time); present(); return; }
    g.drawImage(scene.bg, 0, 0);
    drawSceneFx(time);
    const playing = st.phase !== 'title';
    if (playing) for (const b of st.blds) if (TRAPS[b.kind]) drawPit(b, time);
    if (st.phase === 'build') drawBuildOverlay(time);
    for (const m of st.marks) drawMark(m);
    // objekty zoradené podľa základne (hĺbka)
    const objs = [];
    if (playing) {
      objs.push({ y: G.hallBot, f: () => drawHall(time) });
      for (const b of st.blds) if (!TRAPS[b.kind]) objs.push({ y: tileY(b.r) + T - (b.kind === 'wall' ? 0.5 : 0), f: () => drawBuilding(b, time) });
      for (const s of st.soldiers) objs.push({ y: s.y, f: () => drawFighter(s, s.spr || 'soldier') });
      if (st.king && !st.king.dead) objs.push({ y: st.king.y, f: () => drawFighter(st.king, 'king') });
      else if (st.king && st.king.deadT < KING_GONE) objs.push({ y: st.king.y, f: () => drawDeadKing(st.king, time) });
    }
    for (const e of st.enemies) objs.push({ y: e.y, f: () => drawEnemy(e, time) });
    if (st.fort) {
      const F = st.fort, keep = BSPR.orcKeep;
      objs.push({ y: F.y, f: () => drawFortKeep(F, time) });
      for (const t of F.towers) if (t.hp > 0) objs.push({ y: t.y, f: () => { const s2 = BSPR.orcTower; g.drawImage(t.flash > 0 ? s2.f : s2.c, Math.round(t.x - s2.w / 2), t.y - s2.h); } });
      for (const q of F.pal) if (q.hp > 0) objs.push({ y: q.y, f: () => { const s2 = q.gate ? BSPR.palisadeGate : BSPR.palisade; g.drawImage(q.flash > 0 ? s2.f : s2.c, q.x - 8, q.y - s2.h); } });
    }
    objs.sort((a, b) => a.y - b.y);
    for (const o of objs) o.f();
    if (st.phase === 'build') drawPlaceGhost(time);
    // ukazovatele zdravia
    for (const e of st.enemies) if (e.hp < e.max && !e.d.boss) bar(e.x, Math.round(e.y - e.h - 3), Math.max(6, e.w - 4), e.hp / e.max, '#e84838');
    for (const b of st.blds) if (BUILD[b.kind].hp && b.hp < bMaxHp(b)) bar(tileX(b.c) + T / 2, b.kind === 'wall' ? tileY(b.r) - 9 : tileY(b.r) + T - bsprOf(b.kind, b.lvl).h - 2, 12, b.hp / bMaxHp(b), '#9cd45a');
    for (const s of st.soldiers) if (s.hp < s.max) bar(s.x, Math.round(s.y - 17), 8, s.hp / s.max, '#88b4ff');
    if (st.king && !st.king.dead && st.king.hp < kingMax()) bar(st.king.x, Math.round(st.king.y - 19), 10, st.king.hp / kingMax(), '#f8d048');
    for (const p of st.proj) drawProj(p);
    for (const p of st.eproj) { // šíp goblina (tmavý)
      const cols = ['#bcc0cc', '#3e2614', '#3e2614', '#3e2614', '#62a03a'];
      for (let k = 0; k < 5; k++) { g.fillStyle = cols[k]; g.fillRect(Math.round(p.x - p.vx * k), Math.round(p.y - p.vy * k), 1, 1); }
    }
    for (const dr of st.drops) drawDrop(dr);
    drawFog(time);
    if (st.freezeT > 0) { g.fillStyle = 'rgba(140,190,255,0.12)'; g.fillRect(0, 0, W, H); }
    for (const q of st.parts) {
      g.globalAlpha = Math.min(1, q.life / q.max * 2);
      g.fillStyle = q.col; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    }
    g.globalAlpha = 1;
    for (const t of st.texts) pxText(g, t.s, Math.round(t.x - t.s.length * 2), Math.round(t.y), '#f8d048');
    present();
  }

  // ---------------- UI ----------------
  let bannerTimer = 0;
  function banner(txt) {
    const b = $('banner');
    b.textContent = txt; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 1800);
  }
  let hintTimer = 0;
  function hint(txt) {
    const h = $('hint'); h.textContent = txt; h.hidden = false;
    clearTimeout(hintTimer); hintTimer = setTimeout(() => { h.hidden = true; }, 4500);
  }
  let toastTimer = 0;
  function toast(txt) {
    const t = $('toast'); t.textContent = txt; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function updateHud() {
    $('waveTxt').textContent = 'Vlna ' + Math.min(MISSION_WAVES, Math.max(1, st.phase === 'build' ? st.wave + 1 : st.wave)) + '/' + MISSION_WAVES;
    $('goldTxt').textContent = st.gold;
    const r = Math.max(0, st.hallHp / hallMax());
    $('hallFill').style.width = (r * 100) + '%';
    $('hallFill').className = r < 0.3 ? 'low' : '';
    $('hallTxt').textContent = 'Radnica ' + Math.max(0, Math.ceil(st.hallHp)) + ' / ' + hallMax();
    $('kingLvl').textContent = kingMeta.lvl;
    $('xpFill').style.width = (kingMeta.lvl >= KING_MAX_LVL ? 100 : Math.min(100, kingMeta.xp / kingXpNeed(kingMeta.lvl) * 100)) + '%';
  }

  function hudTick() {
    const k = st.king, kp = $('hud-king');
    if (k) {
      const r = k.dead ? 0 : Math.max(0, k.hp / kingMax());
      $('kingFill').style.width = (r * 100) + '%';
      kp.classList.toggle('dead', !!k.dead);
      kp.classList.toggle('hurt', !k.dead && r < 0.35 && st.phase === 'battle');
    }
    for (const [id, cd, max] of [['warcry', st.cryCd, ABIL.warcry.cd], ['freeze', st.freezeCd, ABIL.freeze.cd]]) {
      const el = $(id + 'Btn');
      el.hidden = !has(id);
      const pp = cd > 0 ? 1 - cd / max : 1;
      el.style.setProperty('--p', (pp * 100) + '%');
      el.classList.toggle('ready', pp >= 1);
    }
    const vb = $('volley');
    const p = st.volleyT > 0 ? 1 - st.volleyT / volleyCd() : 1;
    vb.style.setProperty('--p', (p * 100) + '%');
    vb.classList.toggle('ready', p >= 1);
    const bb = $('bossbar');
    if (st.boss && !st.boss.dead && st.phase === 'battle') {
      bb.hidden = false;
      $('bossFill').style.width = (Math.max(0, st.boss.hp / st.boss.max) * 100) + '%';
    } else bb.hidden = true;
  }

  const ICONS = {};
  function initIcons() {
    ICONS.tower = spriteURL(BSPR.tower[0], 3);
    ICONS.barracks = spriteURL(BSPR.barracks, 3);
    ICONS.mage = spriteURL(BSPR.mage[0], 3);
    ICONS.wall = spriteURL(BSPR.wall[0][10], 3);
    ICONS.pit = spriteURL(BSPR.pit, 3);
    for (const k of ['catapult', 'mine', 'chapel', 'firepit', 'beartrap', 'workshop', 'range']) ICONS[k] = spriteURL(BSPR[k], 3);
    ICONS.gate = spriteURL(BSPR.gateIcon, 3);
    ICONS.u_archer = spriteURL(SPR.archer[0], 3);
    ICONS.u_crossbow = spriteURL(SPR.knight[0], 3);
    ICONS.hall = spriteURL(BSPR.hall[2], 2);
    ICONS.king = spriteURL(SPR.king[0], 3);
    $('kingIcon').src = ICONS.king;
    for (const k of ['garcher', 'bat', 'ram', 'shaman', 'sapper']) ICONS['e_' + k] = spriteURL(SPR[k][0], 3);
    ICONS.coin = spriteURL(SPR.coin[0], 4);
    ICONS.gem = spriteURL(SPR.gem[0], 4);
    document.querySelectorAll('img.coin').forEach(i => { i.src = ICONS.coin; });
    document.querySelectorAll('img.gem').forEach(i => { i.src = ICONS.gem; });
  }

  // ---- „Späť“: história krokov počas jedného budovania (snímky stavu, vráti aj zlato) ----
  let undoStack = [];
  function snapshot() {
    undoStack.push({
      gold: st.gold, hallLvl: st.hallLvl, hallHp: st.hallHp, volleyLvl: st.volleyLvl, kingDead: !!(st.king && st.king.dead),
      blds: st.blds.map(b => Object.assign({}, b, { unit: b.unit ? Object.assign({}, b.unit) : null })),
    });
    if (undoStack.length > 40) undoStack.shift();
  }
  function doUndo() {
    const sn = undoStack.pop();
    if (!sn || st.phase !== 'build') return;
    Object.assign(st, { gold: sn.gold, hallLvl: sn.hallLvl, hallHp: sn.hallHp, volleyLvl: sn.volleyLvl, blds: sn.blds });
    st.sel = null; st.selGroup = null; st.tool = null; st.moving = null;
    if (st.king) {
      if (sn.kingDead && !st.king.dead) Object.assign(st.king, { dead: true, deadT: KING_GONE });
      else if (!sn.kingDead) st.king.dead = false;
      st.king.hp = kingMax(); st.king.x = st.king.hx; st.king.y = st.king.hy;
    }
    rebuildOcc();
    AUDIO.play('sell');
    renderBuild(); updateHud();
  }

  const selGroup = () => st.selGroup && st.selGroup.length > 1 && st.selGroup.includes(st.sel) && st.selGroup.every(w => st.blds.includes(w));

  function btn(label, cost, enabled, onClick, cls) {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.innerHTML = '<span>' + label + '</span>' + (cost != null ? '<span class="cost"><img class="coin" src="' + ICONS.coin + '">' + cost + '</span>' : '');
    b.disabled = !enabled;
    b.addEventListener('click', () => {
      const c = cls || '';
      if (st.phase === 'build' && !c.includes('move')) snapshot();
      onClick();
      AUDIO.play(c.includes('up') ? 'upgrade' : c.includes('sell') ? 'sell' : c.includes('unit') ? 'build' : 'click');
      renderBuild(); updateHud();
    });
    return b;
  }

  // oprava stavby podľa jej hodnoty: úplne zničená by stála 40 % z toho, čo do nej hráč vložil –
  // vždy menej než predať (vráti 50 %) a postaviť znova
  const REPAIR_SHARE = 0.4;
  const bRepairCost = b => !BUILD[b.kind].hp || b.hp >= bMaxHp(b) ? 0 : Math.max(1, Math.ceil(b.spent * REPAIR_SHARE * (1 - b.hp / bMaxHp(b))));
  // radnica sa počas misie opravovať nedá – len budovy
  const reviveCost = () => Math.round((40 + 5 * kingMeta.lvl) * goldMul() * (1 - 0.25 * tal('rally')));
  function reviveKing() {
    const k = st.king, c = reviveCost();
    if (!k || !k.dead || st.gold < c) return;
    st.gold -= c;
    Object.assign(k, { dead: false, deadT: 0, hp: kingMax(), x: k.hx, y: k.hy, tgt: null, flash: 0, swing: 0, cd: 0 });
    for (let q = 0; q < 24; q++) part(k.x + (Math.random() - 0.5) * 10, k.y - Math.random() * 14, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.8, ['#f8d048', '#fff070', '#ffffff'][q % 3], 30);
  }
  function repairCost() {
    let c = 0;
    for (const b of st.blds) c += bRepairCost(b);
    return c;
  }

  function renderBuild() {
    const pal = $('palette'); pal.innerHTML = '';
    for (const kind of BUILD_ORDER) {
      const d = BUILD[kind];
      const b = document.createElement('button');
      if (!has(kind)) { // zamknutá stavba
        const um = unlockMissionOf(kind);
        b.className = 'pcard locked';
        b.innerHTML = '<span class="pin"><span class="face front"><span class="pic"><img src="' + ICONS[kind] + '"></span><b>' + d.short + '</b><span class="cost">🔒 misia ' + um + '</span></span></span>';
        b.addEventListener('click', () => { toast(d.name + ' sa odomkne v misii ' + um); AUDIO.play('deny'); });
        pal.appendChild(b);
        continue;
      }
      if (st.flip && st.flip !== st.tool) st.flip = null;
      b.className = 'pcard' + (st.tool === kind ? ' sel' : '') + (st.flip === kind ? ' flipped' : '') + (st.gold < costOf(kind) ? ' poor' : '');
      const tip = kind === 'wall' ? ' Ťahaj prstom pre celý rad.' : '';
      b.innerHTML = '<span class="pin">' +
        '<span class="face front"><span class="pic"><img src="' + ICONS[kind] + '"></span><b>' + d.short + '</b><span class="cost"><img class="coin" src="' + ICONS.coin + '">' + costOf(kind) + '</span></span>' +
        '<span class="face back"><b>' + d.name + '</b><small>' + d.desc + '.' + tip + '</small></span></span>';
      b.addEventListener('pointerdown', ev => { if (st.phase === 'build') cardPress = { kind, x: ev.clientX, y: ev.clientY }; });
      b.addEventListener('click', () => {
        if (suppressCardClick) { suppressCardClick = false; return; } // bol to ťah, nie ťuk
        AUDIO.play('click');
        if (st.tool === kind) { // druhý ťuk na vybranú kartu ju otočí (vzadu je popis), ďalší ju otočí späť
          st.flip = st.flip === kind ? null : kind;
          b.classList.toggle('flipped', st.flip === kind);
          return;
        }
        st.tool = kind; st.flip = null; st.sel = null; st.moving = null; renderBuild();
      });
      pal.appendChild(b);
    }
    const info = $('selInfo'); info.innerHTML = '';
    const card = (icon, title, text) => {
      const c = document.createElement('div'); c.className = 'unitCard';
      c.innerHTML = '<img src="' + icon + '"><div class="info"><b>' + title + '</b><small>' + text + '</small></div>';
      info.appendChild(c);
    };
    const acts = document.createElement('div'); acts.className = 'acts';
    if (st.tool) {
      // bez textu nad paletou (panel neskáče) – popis stavby je na zadnej strane jej karty
    } else if (st.sel === HALL) {
      card(ICONS.hall, 'Radnica · úr. ' + st.hallLvl + ' (' + LVL_NAME[st.hallLvl] + ')', 'Kráľ ju bráni. Vylepšenie pridá zdravie, silu kráľa, rozšíri územie o 1 rad' +
        (st.hallLvl < MAX_LVL ? ' a dovolí vylepšiť stavby na úroveň ' + (st.hallLvl + 1) + ' (' + LVL_NAME[st.hallLvl + 1] + ').' : '.'));
      if (st.hallLvl < hallCap()) {
        const c = hallUpCost();
        acts.appendChild(btn('Vylepšiť radnicu', c, st.gold >= c, () => {
          st.gold -= c; st.hallLvl++; st.hallHp += 200; st.king.hp = kingMax();
        }, 'up'));
      } else if (st.hallLvl < MAX_LVL) acts.appendChild(lockBtn('Radnica úr. ' + (st.hallLvl + 1), 'lvl5'));
      else acts.appendChild(btn('Max. úroveň', null, false, () => { }));
      if (has('volleyUp')) {
        const vc = volleyUpCost();
        acts.appendChild(btn('Salva úr. ' + (st.volleyLvl + 1), vc, st.gold >= vc, () => { st.gold -= vc; st.volleyLvl++; }));
      } else acts.appendChild(lockBtn('Salva', 'volleyUp'));
      info.appendChild(acts);
      card(ICONS.king, 'Kráľ · úr. ' + kingMeta.lvl + (st.king && st.king.dead ? ' · padol' : ''), kingSummary());
      if (st.king && st.king.dead) {
        const ka = document.createElement('div'); ka.className = 'acts';
        const c = reviveCost();
        ka.appendChild(btn('Oživiť kráľa', c, st.gold >= c, reviveKing, 'up wide'));
        info.appendChild(ka);
      }
    } else if (selGroup()) {
      // hromadné akcie pre označenú skupinu (rad hradieb alebo všetky stavby jedného druhu)
      const grp = st.selGroup, kind = grp[0].kind, d = BUILD[kind], isWall = kind === 'wall', cap = bCap();
      const minL = Math.min(...grp.map(w => w.lvl)), maxL = Math.max(...grp.map(w => w.lvl));
      card(ICONS[kind], (isWall ? 'Rad hradieb' : d.name + ' – všetky') + ' · ' + grp.length + ' ks',
        'Úroveň ' + (minL === maxL ? minL : minL + '–' + maxL) + '. Akcie platia pre každú stavbu v skupine – najprv pre tie najslabšie, kým stačí zlato.');
      // tlačidlo „pre všetky“: ak zlato nestačí, urobí toľko, koľko sa dá („3 z 6“)
      const bulk = (to, name, list, costFn, apply, cls) => {
        if (!list.length) return;
        let sum = 0; const pick = [];
        for (const x of list) { const c = costFn(x); if (sum + c > st.gold) break; sum += c; pick.push(x); }
        const all = pick.length === list.length;
        to.appendChild(btn(name + (all || !pick.length ? ' (' + list.length + ')' : ' · ' + pick.length + ' z ' + list.length),
          pick.length ? sum : list.reduce((t, x) => t + costFn(x), 0), pick.length > 0, () => { for (const x of pick) apply(x); rebuildOcc(); }, cls));
      };
      const byLvl = (a, b) => a.lvl - b.lvl;
      const cand = grp.filter(w => w.lvl < cap).sort(byLvl);
      if (cand.length) bulk(acts, 'Vylepšiť všetky', cand, bUpCost, w => {
        const ratio = d.hp ? w.hp / bMaxHp(w) : 1, c = bUpCost(w);
        st.gold -= c; w.spent += c; w.lvl++;
        if (d.hp) w.hp = Math.ceil(bMaxHp(w) * ratio);
      }, 'up wide');
      else if (maxL < lvlCap()) acts.appendChild(btn('Úr. ' + (maxL + 1) + ' – najprv vylepši radnicu', null, false, () => { }, 'locked wide'));
      else if (maxL < MAX_LVL) acts.appendChild(lockBtn('Úr. ' + (minL + 1), 'lvl5', true));
      else acts.appendChild(btn('Max. úroveň', null, false, () => { }, 'wide'));
      if (d.hp) {
        bulk(acts, 'Opraviť', grp.filter(w => bRepairCost(w) > 0), bRepairCost, w => { st.gold -= bRepairCost(w); w.hp = bMaxHp(w); });
      }
      const refund = grp.reduce((t, w) => t + Math.floor(w.spent / 2) + (w.unit ? Math.floor(w.unit.spent / 2) : 0), 0);
      acts.appendChild(btn('Predať všetky +' + refund, null, true, () => {
        st.gold += refund; st.blds = st.blds.filter(x => !grp.includes(x)); st.sel = null; st.selGroup = null;
        for (const s of st.soldiers) if (grp.includes(s.home)) s.dead = true;
        st.soldiers = st.soldiers.filter(s => !s.dead);
        rebuildOcc();
      }, 'sell'));
      info.appendChild(acts);
      const section = (title) => { const t = document.createElement('div'); t.className = 'secTitle'; t.textContent = title; info.appendChild(t); const a = document.createElement('div'); a.className = 'acts'; info.appendChild(a); return a; };
      if (isWall) {
        // ostne a ich druh
        const bare = grp.filter(w => !w.spikes), plain = grp.filter(w => w.spikes && !w.spikeType);
        if (bare.length || plain.length) {
          const sa = section('Ostne');
          if (!has('spikes')) sa.appendChild(lockBtn('Ostne', 'spikes', true));
          else bulk(sa, 'Ostne na všetky', bare, () => SPIKE_COST, w => { st.gold -= SPIKE_COST; w.spent += SPIKE_COST; w.spikes = true; }, 'wide');
          if (plain.length) {
            if (!has('spikeTypes')) sa.appendChild(lockBtn('Ohnivé a ľadové ostne', 'spikeTypes', true));
            else for (const k in SPIKE_TYPES) bulk(sa, SPIKE_TYPES[k].name, plain, () => SPIKE_TYPE_COST, w => { st.gold -= SPIKE_TYPE_COST; w.spent += SPIKE_TYPE_COST; w.spikeType = k; }, 'wide');
          }
        }
        // strelci na hradbách
        const free = grp.filter(w => !w.gate && !w.unit), manned = grp.filter(w => w.unit && w.unit.lvl < lvlCap()).sort((a, b) => a.unit.lvl - b.unit.lvl);
        if (has('wallArcher') && (free.length || manned.length)) {
          const ua = section('Strelci na hradbách');
          if (free.length) for (const type in WUNIT) {
            const wd = WUNIT[type], tid = type === 'archer' ? 'wallArcher' : 'wallCrossbow';
            if (!has(tid)) { ua.appendChild(lockBtn(wd.name, tid)); continue; }
            bulk(ua, '<img class="uicon" src="' + ICONS['u_' + type] + '">' + wd.name, free, () => wd.cost, w => { st.gold -= wd.cost; w.unit = { type, lvl: 1, cd: 0.3, spent: wd.cost }; }, 'unit');
          }
          if (manned.length) bulk(ua, 'Vylepšiť strelcov', manned, w => uUpCost(w.unit), w => { const c = uUpCost(w.unit); st.gold -= c; w.unit.spent += c; w.unit.lvl++; }, 'up wide');
        }
      }
    } else if (st.sel) {
      const b = st.sel, d = BUILD[b.kind];
      let stats = '';
      if (b.kind === 'chapel') stats = 'Mních lieči rytierov a kráľa ' + HELPERS.chapel.rate(b).toFixed(1) + '/s';
      else if (b.kind === 'mine') stats = 'Po vlne +' + Math.round(mineGold(b) * goldMul()) + ' zlata';
      else if (b.kind === 'workshop') stats = 'Remeselník opravuje budovy ' + craftRate(b).toFixed(1) + '/s';
      else if (b.kind === 'firepit') stats = 'Horenie ' + Math.round(bDmg(b)) + '/s počas ' + FIRE_BURN + ' s (spolu ' + Math.round(bDmg(b) * FIRE_BURN) + ')';
      else if (b.kind === 'beartrap') stats = 'Zastaví na ' + trapStun(b).toFixed(1) + ' s';
      else if (d.range) stats = 'Poškodenie ' + Math.round(bDmg(b)) + ' · dosah ' + bRange(b);
      else if (b.kind === 'barracks') stats = 'Rytieri ' + knightCap(b) + ' · sila ' + Math.round(knightDmg(b));
      else if (b.kind === 'range') stats = 'Lukostrelci ' + archerCap(b) + ' · poškodenie ' + Math.round(archerDmg(b)) + ' · dosah ' + ARCHER_RANGE;
      else if (b.kind === 'pit') stats = 'Poškodenie ' + Math.round(bDmg(b)) + ' · spomalí na polovicu';
      if (d.hp) stats += (stats ? ' · ' : '') + 'zdravie ' + Math.ceil(b.hp) + '/' + bMaxHp(b);
      if (b.gate) stats += ' · rytieri cez ňu prejdú';
      if (b.spikes) stats += ' · ' + (b.spikeType ? SPIKE_TYPES[b.spikeType].name.toLowerCase() : 'ostne') + ' ' + spikeDmg(b);
      if (b.kind === 'wall' && b.nb) stats += ' · spojenie +' + Math.round(WALL_LINK * b.nb * 100) + ' %';
      if (b.spec) stats += ' · ' + SPECS[b.spec].name;
      if (b.kind === 'barracks') stats += ' · ' + KTYPES[b.ktype || 'knight'].name;
      if ((b.kind === 'barracks' || b.kind === 'range') && knightsBlocked(b)) stats += '<br><span class="warn">⚠ Rytieri sa nedostanú von – postav bránu v hradbách alebo uvoľni cestu</span>';
      card(b.gate ? ICONS.gate : ICONS[b.kind], (b.gate ? 'Brána' : d.name) + ' · úr. ' + b.lvl, stats);
      if (b.lvl < bCap()) {
        const c = bUpCost(b);
        acts.appendChild(btn('Vylepšiť', c, st.gold >= c, () => {
          const ratio = d.hp ? b.hp / bMaxHp(b) : 1;
          st.gold -= c; b.spent += c; b.lvl++;
          if (d.hp) b.hp = Math.ceil(bMaxHp(b) * ratio);
          rebuildOcc();
        }, 'up'));
      } else if (b.lvl < lvlCap()) acts.appendChild(btn('Úr. ' + (b.lvl + 1) + ' – najprv radnica', null, false, () => { }, 'locked'));
      else if (b.lvl < MAX_LVL) acts.appendChild(lockBtn('Úr. ' + (b.lvl + 1), 'lvl5'));
      else acts.appendChild(btn('Max. úroveň', null, false, () => { }));
      const fc = bRepairCost(b);
      if (fc) acts.appendChild(btn('Opraviť', fc, st.gold >= fc, () => { st.gold -= fc; b.hp = bMaxHp(b); rebuildOcc(); }));
      const refund = Math.floor(b.spent / 2) + (b.unit ? Math.floor(b.unit.spent / 2) : 0);
      acts.appendChild(btn('Predať +' + refund, null, true, () => {
        st.gold += refund; st.blds = st.blds.filter(x => x !== b); st.sel = null;
        for (const s of st.soldiers) if (s.home === b) s.dead = true;
        st.soldiers = st.soldiers.filter(s => !s.dead);
        rebuildOcc();
      }, 'sell'));
      acts.appendChild(btn(st.moving === b ? 'Zrušiť presun' : 'Presunúť (zadarmo)', null, true, () => { st.moving = st.moving === b ? null : b; if (st.moving) hint('Ťukni na voľné políčko v zóne – alebo stavbu rovno potiahni prstom'); }, 'wide move'));
      if (b.kind === 'wall') {
        if (b.gate) acts.appendChild(btn('Zmeniť späť na hradbu', null, true, () => { b.gate = false; }, 'wide'));
        else if (b.unit) acts.appendChild(btn('Na bránu – najprv odvolaj strelca', null, false, () => { }, 'wide'));
        else if (!has('gate')) acts.appendChild(lockBtn('Brána', 'gate', true));
        else { const gc = gateCost(); acts.appendChild(btn('Prerobiť na bránu', gc, st.gold >= gc, () => { st.gold -= gc; b.spent += gc; b.gate = true; }, 'wide')); }
      }
      if (b.kind === 'wall' && !b.spikes) {
        if (has('spikes')) acts.appendChild(btn('Ostne (zrania útočníkov)', SPIKE_COST, st.gold >= SPIKE_COST, () => { st.gold -= SPIKE_COST; b.spent += SPIKE_COST; b.spikes = true; }, 'wide'));
        else acts.appendChild(lockBtn('Ostne', 'spikes', true));
      }
      if (b.kind === 'wall' && b.spikes && !b.spikeType) {
        if (!has('spikeTypes')) acts.appendChild(lockBtn('Ohnivé a ľadové ostne', 'spikeTypes', true));
        else for (const k in SPIKE_TYPES) acts.appendChild(btn(SPIKE_TYPES[k].name, SPIKE_TYPE_COST, st.gold >= SPIKE_TYPE_COST, () => { st.gold -= SPIKE_TYPE_COST; b.spent += SPIKE_TYPE_COST; b.spikeType = k; }, 'wide'));
      }
      info.appendChild(acts);
      const section = (title) => { const t = document.createElement('div'); t.className = 'secTitle'; t.textContent = title; info.appendChild(t); const a = document.createElement('div'); a.className = 'acts'; info.appendChild(a); return a; };
      if (b.kind === 'tower' && !b.spec) {
        if (!has('spec')) section('Špecializácia').appendChild(lockBtn('Špecializácia', 'spec', true));
        else if (b.lvl < 3) section('Špecializácia').appendChild(btn('Od úrovne 3', null, false, () => { }, 'locked wide'));
        else {
          const sa = section('Špecializácia (vyber jednu)');
          for (const k in SPECS) sa.appendChild(btn(SPECS[k].name, SPEC_COST, st.gold >= SPEC_COST, () => { st.gold -= SPEC_COST; b.spent += SPEC_COST; b.spec = k; }, 'up spec'));
        }
      }
      if (b.kind === 'barracks') {
        if (!has('knightTypes')) section('Druh rytierov').appendChild(lockBtn('Druhy rytierov', 'knightTypes', true));
        else {
          const ka = section('Druh rytierov');
          for (const k in KTYPES) {
            const cur = (b.ktype || 'knight') === k;
            ka.appendChild(btn(KTYPES[k].name + (cur ? ' ✓' : ''), cur ? null : KTYPE_COST, !cur && st.gold >= KTYPE_COST, () => { st.gold -= KTYPE_COST; b.spent += KTYPE_COST; b.ktype = k; }, cur ? 'cur' : ''));
          }
        }
      }
      if (b.kind === 'wall' && !b.gate && (has('wallArcher') || b.unit)) {
        const t = document.createElement('div'); t.className = 'secTitle'; t.textContent = 'Strelec na hradbe';
        info.appendChild(t);
        const ua = document.createElement('div'); ua.className = 'acts';
        const u = b.unit;
        if (!u) {
          for (const type in WUNIT) {
            const wd = WUNIT[type], tid = type === 'archer' ? 'wallArcher' : 'wallCrossbow';
            if (!has(tid)) { ua.appendChild(lockBtn(wd.name, tid)); continue; }
            ua.appendChild(btn('<img class="uicon" src="' + ICONS['u_' + type] + '">' + wd.name, wd.cost, st.gold >= wd.cost, () => {
              st.gold -= wd.cost; b.unit = { type, lvl: 1, cd: 0.3, spent: wd.cost };
            }, 'unit'));
          }
        } else {
          const wd = WUNIT[u.type];
          const uc = document.createElement('div'); uc.className = 'unitCard';
          uc.innerHTML = '<img src="' + ICONS['u_' + u.type] + '"><div class="info"><b>' + wd.name + ' · úr. ' + u.lvl + '</b><small>Poškodenie ' + Math.round(uDmg(u)) + ' · dosah ' + uRange(u) + ' · ' + wd.desc + '</small></div>';
          info.appendChild(uc);
          if (u.lvl < lvlCap()) {
            const c = uUpCost(u);
            ua.appendChild(btn('Vylepšiť strelca', c, st.gold >= c, () => { st.gold -= c; u.spent += c; u.lvl++; }, 'up'));
          } else if (u.lvl < MAX_LVL) ua.appendChild(lockBtn('Úr. ' + (u.lvl + 1), 'lvl5'));
          else ua.appendChild(btn('Max. úroveň', null, false, () => { }));
          const ur = Math.floor(u.spent / 2);
          ua.appendChild(btn('Odvolať +' + ur, null, true, () => { st.gold += ur; b.unit = null; }, 'sell'));
        }
        info.appendChild(ua);
      }
    } else if (st.king && st.king.dead) {
      card(ICONS.king, 'Kráľ padol', 'Bez kráľa radnicu nikto nebráni. Oživ ho pred ďalšou vlnou.');
      const c = reviveCost();
      acts.appendChild(btn('Oživiť kráľa', c, st.gold >= c, reviveKing, 'up wide'));
      info.appendChild(acts);
    }
    const rc = repairCost();
    $('undoBtn').disabled = !undoStack.length;
    const rb = $('repairBtn');
    rb.innerHTML = '<span>Opraviť všetko</span>' + (rc ? '<span class="cost"><img class="coin" src="' + ICONS.coin + '">' + rc + '</span>' : '');
    rb.disabled = !rc || st.gold < rc;
    updateHud();
  }

  // dá sa na políčko postaviť? (na farbu náhľadu a pri pustení prsta)
  const canPlace = (c, r) => inZone(c, r) && !inHall(c, r) && !occAt(c, r);
  function placeAt(kind, c, r) {
    const dc = costOf(kind);
    if (!inZone(c, r)) { toast('Stavať sa dá len v zóne pri radnici'); AUDIO.play('deny'); return false; }
    if (!canPlace(c, r)) { toast('Tu už niečo stojí – posuň stavbu na voľné políčko'); AUDIO.play('deny'); return false; }
    if (st.gold < dc) { toast('Nedostatok zlata'); AUDIO.play('deny'); return false; }
    snapshot();
    st.gold -= dc;
    addBuilding(kind, c, r);
    AUDIO.play('build');
    const cx = tileX(c) + T / 2, cy = tileY(r) + T / 2;
    for (let k = 0; k < 8; k++) part(cx + (Math.random() - 0.5) * 12, cy + 4, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.4, '#c6a272', 60);
    if (st.gold < dc) st.tool = null;
    renderBuild();
    return true;
  }

  function tapBuild(x, y) {
    const c = Math.floor((x - G.gx0) / T), r = Math.floor((y - G.gy0) / T);
    if (c < 0 || c >= G.cols || r < 0 || r >= G.rows) return;
    // radnica (aj jej strecha nad základňou)
    const hr = hallRect();
    if (x >= hr.x0 && x < hr.x1 && y >= hr.y0 - 8 && y < hr.y1) { st.sel = HALL; st.tool = null; renderBuild(); return; }
    const o = occAt(c, r);
    if (o && o !== HALL) { st.sel = o; st.tool = null; renderBuild(); return; }
    if (st.tool) { placeAt(st.tool, c, r); return; }
    st.sel = null; renderBuild();
  }

  const evPos = ev => {
    const r = screen.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H + Math.round(camY) };
  };
  const evTile = p => ({ c: Math.floor((p.x - G.gx0) / T), r: Math.floor((p.y - G.gy0) / T) });

  // hradby: ťuk = jedna, ťahanie = náhľad radu s cenou, pustením prsta sa postaví (kým stačí zlato)
  let drag = null;                        // {path: [{c, r}], last}
  const wallFree = (c, r) => inZone(c, r) && !inHall(c, r) && !occAt(c, r);
  const wallsAfford = () => Math.floor(st.gold / costOf('wall'));
  function placeWall(c, r) {
    st.gold -= costOf('wall');
    addBuilding('wall', c, r);
    for (let k = 0; k < 5; k++) part(tileX(c) + 8 + (Math.random() - 0.5) * 12, tileY(r) + 12, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.4, '#c6a272', 60);
  }
  // ---- presúvanie stavieb (ťahaním alebo tlačidlom „Presunúť“) ----
  let bdrag = null;                       // ťahaná stavba {b, start, hover, moved}
  let pdrag = null;                       // ťahanie novej stavby na miesto {kind, t: políčko pod prstom alebo null}
  let cardPress = null, suppressCardClick = false; // stlačená karta v paneli (ťah začne po pohnutí prstom)
  let lastTap = null;                     // posledný ťuk na stavbu – pre dvojťuk na hradbu
  // celý súvislý rad hradieb (susedia hore/dole/vľavo/vpravo, vrátane brán)
  function wallRow(start) {
    const seen = new Set([start]), q = [start];
    while (q.length) {
      const w = q.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = occAt(w.c + dc, w.r + dr);
        if (o && o !== HALL && o.kind === 'wall' && !seen.has(o)) { seen.add(o); q.push(o); }
      }
    }
    return [...seen];
  }
  const canMoveTo = (b, c, r) => inZone(c, r) && !inHall(c, r) && (!occAt(c, r) || occAt(c, r) === b);
  function moveBuilding(b, c, r) {
    if (b.c === c && b.r === r) return true;
    if (!canMoveTo(b, c, r)) { toast('Sem sa stavba nedá presunúť'); AUDIO.play('deny'); return false; }
    snapshot();
    const ox = tileX(b.c) + T / 2, oy = tileY(b.r) + T / 2;
    b.c = c; b.r = r;
    rebuildOcc();
    for (let k = 0; k < 6; k++) part(ox + (Math.random() - 0.5) * 12, oy + 4, (Math.random() - 0.5) * 20, -Math.random() * 15, 0.4, '#c6a272', 60);
    for (let k = 0; k < 8; k++) part(tileX(c) + 8 + (Math.random() - 0.5) * 12, tileY(r) + 12, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.4, '#c6a272', 60);
    AUDIO.play('build');
    st.sel = b; st.selGroup = null; st.tool = null; st.moving = null;
    renderBuild();
    return true;
  }

  screen.addEventListener('pointerdown', ev => {
    const p = evPos(ev);
    if (st.phase === 'battle' && p.y > 4) { volley(p.x, p.y); return; }
    if (st.phase === 'map') {
      mapDrag = { y0: ev.clientY, cam0: mapCam, moved: false, p };
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    if (st.phase !== 'build') return;
    const t = evTile(p);
    if (st.moving) { // režim presunu z tlačidla: ťuk na cieľové políčko
      const b = st.moving;
      if (occAt(t.c, t.r) === b) { st.moving = null; renderBuild(); return; }
      moveBuilding(b, t.c, t.r);
      return;
    }
    const o = occAt(t.c, t.r);
    if (o && o !== HALL) { // chytenie stavby: ťuk = výber, ťahanie = presun
      bdrag = { b: o, start: t, hover: t, moved: false };
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    if (st.tool === 'wall' && wallFree(t.c, t.r)) {
      drag = { path: [t], last: t };
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    const hr = hallRect(), onHall = p.x >= hr.x0 && p.x < hr.x1 && p.y >= hr.y0 - 8 && p.y < hr.y1;
    if (st.tool && st.tool !== 'wall' && !onHall) { // prst po mape: náhľad, postaví sa po pustení
      pdrag = { kind: st.tool, t };
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    tapBuild(p.x, p.y);
  });
  // políčko pod prstom pri ťahaní novej stavby (null, keď je prst nad panelom alebo mimo mapy)
  function pdragTile(ev) {
    const sr = screen.getBoundingClientRect(), br = $('build').getBoundingClientRect();
    if (ev.clientX < sr.left || ev.clientX > sr.right || ev.clientY < sr.top || ev.clientY > sr.bottom) return null;
    if (!$('build').hidden && ev.clientY >= br.top) return null;
    const t = evTile(evPos(ev));
    return t.c >= 0 && t.c < G.cols && t.r >= 0 && t.r < G.rows ? t : null;
  }
  window.addEventListener('pointermove', ev => {
    const cdx = cardPress ? ev.clientX - cardPress.x : 0, cdy = cardPress ? ev.clientY - cardPress.y : 0;
    if (cardPress && !pdrag && cdy < -10 && -cdy > Math.abs(cdx)) { // karta ťahaná hore k mape (do strany = posúvanie palety)
      pdrag = { kind: cardPress.kind, t: null };
      st.tool = cardPress.kind; st.sel = null; st.moving = null; suppressCardClick = true;
      renderBuild();
    }
    if (pdrag && st.phase === 'build') pdrag.t = pdragTile(ev);
  });
  window.addEventListener('pointerup', ev => {
    cardPress = null;
    setTimeout(() => { suppressCardClick = false; }, 0); // prípadný klik po ťahu príde ešte pred týmto
    if (!pdrag) return;
    const pd = pdrag; pdrag = null;
    if (st.phase !== 'build') return;
    const t = pdragTile(ev);
    if (!t) { renderBuild(); return; } // pustené nad panelom alebo mimo mapy – nič sa nestavia
    placeAt(pd.kind, t.c, t.r);
  });
  window.addEventListener('pointercancel', () => { cardPress = null; pdrag = null; });
  screen.addEventListener('pointermove', ev => {
    if (pdrag) return;
    if (mapDrag && st.phase === 'map') {
      const r = screen.getBoundingClientRect();
      const dy = (ev.clientY - mapDrag.y0) / r.height * H;
      if (Math.abs(dy) > 3) mapDrag.moved = true;
      if (mapDrag.moved) { mapCam = clampMap(mapDrag.cam0 - dy); mapCamTarget = mapCam; }
      return;
    }
    if (bdrag && st.phase === 'build') {
      const t = evTile(evPos(ev));
      if (t.c !== bdrag.start.c || t.r !== bdrag.start.r) bdrag.moved = true;
      bdrag.hover = t;
      return;
    }
    if (!drag || st.phase !== 'build') return;
    const t = evTile(evPos(ev));
    if (t.c === drag.last.c && t.r === drag.last.r) return;
    // prejdi všetky políčka medzi poslednou a aktuálnou pozíciou (aby rýchly ťah nič nepreskočil)
    let { c, r } = drag.last;
    while (c !== t.c || r !== t.r) {
      const dc = t.c - c, dr = t.r - r;
      if (Math.abs(dc) >= Math.abs(dr)) c += Math.sign(dc); else r += Math.sign(dr);
      const back = drag.path.findIndex(q => q.c === c && q.r === r);
      if (back >= 0) drag.path.length = back + 1;          // návrat prstom späť skráti rad
      else if (wallFree(c, r)) drag.path.push({ c, r });
    }
    drag.last = t;
  });
  const endDrag = () => {
    if (mapDrag) { // krátky ťuk bez posunu = výber misie
      const md = mapDrag; mapDrag = null;
      if (!md.moved && st.phase === 'map') tapMap(md.p.x, md.p.y);
      return;
    }
    if (bdrag) {
      const bd = bdrag; bdrag = null;
      if (st.phase !== 'build') return;
      if (!bd.moved) {
        const now = performance.now(), dbl = lastTap && lastTap.b === bd.b && now - lastTap.t < 400;
        lastTap = dbl ? null : { b: bd.b, t: now };
        st.sel = bd.b; st.selGroup = dbl ? (bd.b.kind === 'wall' ? wallRow(bd.b) : st.blds.filter(x => x.kind === bd.b.kind)) : null; st.tool = null; st.moving = null;
        AUDIO.play('click'); renderBuild();
      }
      else moveBuilding(bd.b, bd.hover.c, bd.hover.r);
      return;
    }
    if (drag) {
      const path = drag.path; drag = null;
      if (st.phase !== 'build') return;
      const n = Math.min(path.length, wallsAfford());
      if (n < path.length) { toast('Nedostatok zlata'); AUDIO.play('deny'); }
      if (n > 0) {
        snapshot();
        for (const q of path.slice(0, n)) placeWall(q.c, q.r);
        AUDIO.play('build');
      }
      if (st.gold < costOf('wall')) st.tool = null;
      renderBuild();
    }
  };
  screen.addEventListener('pointerup', endDrag);
  screen.addEventListener('pointercancel', endDrag);

  $('nextWave').addEventListener('click', startWave);
  $('undoBtn').addEventListener('click', doUndo);
  $('warcryBtn').addEventListener('click', () => ability('warcry'));
  $('freezeBtn').addEventListener('click', () => ability('freeze'));
  $('repairBtn').addEventListener('click', () => {
    const rc = repairCost();
    if (!rc || st.gold < rc) return;
    snapshot();
    st.gold -= rc;
    for (const b of st.blds) if (BUILD[b.kind].hp) b.hp = bMaxHp(b);
    rebuildOcc(); renderBuild();
  });
  $('speedBtn').addEventListener('click', () => {
    st.speed = st.speed >= 3 ? 1 : st.speed + 1;
    $('speedBtn').textContent = 'x' + st.speed;
  });
  function clearBattle() {
    st.enemies = []; st.proj = []; st.eproj = []; st.drops = []; st.soldiers = []; st.parts = []; st.texts = []; st.marks = []; st.spawnQ = [];
    $('over').hidden = true; $('hud').hidden = true; $('bottom').hidden = true; $('build').hidden = true; $('bossbar').hidden = true;
  }

  function showMap() {
    clearBattle();
    st.phase = 'map';
    AUDIO.music('map');
    $('title').hidden = true;
    $('map').hidden = false;
    if (!st.mapAnim) st.mapSel = Math.min(st.unlocked, MISSIONS.length);
    renderMapPanel();
    focusMapNode(st.mapAnim ? st.mapAnim.seg + 2 : st.mapSel, true);
    if (!st.mapAnim) afterDeck(); // pri odomykaní hradu príde výber až po kartičkách
    if (st.unlocked === 1 && !loadJSON('fortward.introSeen', false)) { // úplne nová hra
      saveJSON('fortward.introSeen', true);
      setTimeout(() => { if (st.phase === 'map') banner('Horda napadla tvoje územie!'); }, 400);
    }
  }

  function renderMapPanel() {
    const m = st.mapSel, def = MISSIONS[m - 1];
    const done = m < st.unlocked;
    $('mapProg').textContent = Math.min(st.unlocked - 1, MISSIONS.length) + ' / ' + MISSIONS.length;
    $('mNum').textContent = m;
    $('mNum').className = 'mnum' + (done ? ' done' : '');
    $('mName').textContent = def.name;
    const diff = Math.ceil(m / 2);
    $('mMeta').innerHTML = MISSION_WAVES + ' vĺn · obtiažnosť <span class="stars">' + '●'.repeat(diff) + '<i>' + '●'.repeat(5 - diff) + '</i></span>' + (done ? ' · <span class="ok">splnená ✓</span>' : '');
    const foe = ENEMY_INTRO[m];
    $('mNew').innerHTML = (foe ? '<span>Nepriateľ:</span><em class="foe"><img src="' + ICONS['e_' + foe.id] + '">' + foe.name + '</em>' : '') +
      '<span>' + (m === 1 ? 'Výbava:' : 'Novinka:') + '</span>' + UNLOCKS[m - 1].map(u => '<em><img src="' + ICONS[u.icon] + '">' + u.name + '</em>').join('');
    // úroveň misie: predvolene prvá otvorená bez plných 3 hviezd
    if (st.mapTierFor !== m) {
      st.mapTierFor = m; st.mapTier = 0;
      while (st.mapTier < 2 && tierOpen(m, st.mapTier + 1)) st.mapTier++;
    }
    const tb = $('mTiers'); tb.innerHTML = '';
    TIERS.forEach((tr, t) => {
      const open = tierOpen(m, t), b = document.createElement('button');
      b.className = 'tierBtn' + (t === st.mapTier ? ' sel' : '') + (open ? '' : ' locked');
      b.style.setProperty('--tc', tr.col);
      b.innerHTML = '<b>' + tr.name + '</b><span class="st">' + (open ? starSpan(starsOf(m, t), t) : '🔒') + '</span>';
      b.addEventListener('click', () => {
        if (!open) { toast(t === 0 ? 'Najprv dobyj predošlý hrad' : 'Najprv získaj 3 hviezdy na úrovni ' + TIERS[t - 1].name.toLowerCase()); AUDIO.play('deny'); return; }
        st.mapTier = t; AUDIO.play('click'); renderMapPanel();
      });
      tb.appendChild(b);
    });
    $('mapPlay').textContent = starsOf(m, st.mapTier) ? 'Hrať znova ▶' : 'Hrať ▶';
    $('mStars').innerHTML = '';
    $('hallBtnTxt').textContent = starsFree();
  }

  function kingSummary() {
    const xp = kingMeta.lvl >= KING_MAX_LVL ? 'najvyššia úroveň' : 'XP ' + kingMeta.xp + ' / ' + kingXpNeed(kingMeta.lvl);
    const taken = TALENTS.filter(t => tal(t.id)).map(t => t.name + (tal(t.id) > 1 ? ' ' + tal(t.id) + '×' : ''));
    return xp + ' · ' + (taken.length ? taken.join(', ') : 'XP získava za každú prežitú vlnu');
  }
  function renderPerks() {
    $('perkStars').textContent = starsFree() + ' / ' + starsTotal();
    const list = $('perkList'); list.innerHTML = '';
    const kr = document.createElement('div'); kr.className = 'perk kingRow';
    const need = kingXpNeed(kingMeta.lvl), pct = kingMeta.lvl >= KING_MAX_LVL ? 100 : Math.round(kingMeta.xp / need * 100);
    kr.innerHTML = '<img src="' + ICONS.king + '"><div class="info"><b>Kráľ · úroveň ' + kingMeta.lvl + '</b><span class="xpBar"><i style="width:' + pct + '%"></i></span><small>' + kingSummary() + '</small></div>';
    list.appendChild(kr);
    for (const pk of PERKS) {
      const lvl = perk(pk.id), cost = lvl + 1;
      const row = document.createElement('div'); row.className = 'perk';
      const pips = '<span class="pips">' + '●'.repeat(lvl) + '<i>' + '●'.repeat(PERK_MAX - lvl) + '</i></span>';
      row.innerHTML = '<img src="' + ICONS[pk.icon] + '"><div class="info"><b>' + pk.name + ' ' + pips + '</b><small>' + pk.desc + (lvl ? ' (teraz ' + lvl + '×)' : '') + '</small></div>';
      const b = document.createElement('button');
      b.className = 'btn ' + (lvl >= PERK_MAX ? '' : 'up');
      b.innerHTML = lvl >= PERK_MAX ? 'Max' : '★ ' + cost;
      b.disabled = lvl >= PERK_MAX || starsFree() < cost;
      b.addEventListener('click', () => {
        if (starsFree() < cost || lvl >= PERK_MAX) return;
        meta.perks[pk.id] = lvl + 1; saveJSON('fortward.perks', meta.perks);
        AUDIO.play('upgrade'); renderPerks();
      });
      row.appendChild(b); list.appendChild(row);
    }
  }
  $('hallBtn').addEventListener('click', () => { AUDIO.play('click'); $('perks').hidden = false; renderPerks(); });
  $('perkBack').addEventListener('click', () => { AUDIO.play('click'); $('perks').hidden = true; renderMapPanel(); });

  function tapMap(x, y) {
    if (st.mapAnim) return;
    island.nodes.forEach((n, i) => {
      if (Math.hypot(n.x - x, n.y - 5 - y) > 14) return;
      const num = i + 1;
      if (num > st.unlocked) { toast('Najprv dobi misiu ' + (num - 1)); AUDIO.play('deny'); return; }
      st.mapSel = num; AUDIO.play('click'); renderMapPanel();
    });
  }

  // animácia cestičky k novoodomknutej misii
  function mapTick(dt) {
    if (st.provAnim && st.phase === 'map') { st.provAnim.t += dt / 1.3; if (st.provAnim.t >= 1) st.provAnim = null; }
    const a = st.mapAnim;
    if (!a || st.phase !== 'map') return;
    a.t += dt / 1.4;
    if (a.t >= 1) {
      st.mapAnim = null;
      const n = island.nodes[a.seg + 1];
      if (n) {
        for (let k = 0; k < 30; k++) part(n.x, n.y, (Math.random() - 0.5) * 70, -Math.random() * 70, 0.9, ['#f8d048', '#fff070', '#88b4ff'][k % 3], 90);
        st.mapSel = a.seg + 2; renderMapPanel();
        focusMapNode(st.mapSel);
        AUDIO.play('unlock');
        const nm = st.mapSel;
        setTimeout(() => { if (st.phase === 'map') showUnlockDeck(nm); }, 700);
      }
    }
  }

  // ---- kartičky s novinkami: po rozsvietení ďalšieho hradu, hráč ich odťuká jednu po druhej ----
  function unlockItems(m) {
    const items = (UNLOCKS[m - 1] || []).map(u => ({
      icon: ICONS[u.icon], name: u.name,
      tag: BUILD[u.id] ? 'Nová stavba' : ABIL[u.id] ? 'Kráľova schopnosť' : 'Nové vylepšenie',
      desc: u.desc || (BUILD[u.id] ? BUILD[u.id].desc + '.' : ''),
    }));
    const foe = ENEMY_INTRO[m];
    if (foe) items.push({ icon: ICONS['e_' + foe.id], name: foe.name, tag: 'Pozor – nový nepriateľ', desc: foe.desc.charAt(0).toUpperCase() + foe.desc.slice(1) + '.', foe: true });
    return items;
  }
  function showUnlockDeck(m) {
    const items = unlockItems(m);
    if (!items.length) { afterDeck(); return; }
    const deck = $('unlockDeck'), stack = $('udStack');
    stack.innerHTML = '';
    const cards = items.map((it, i) => {
      const c = document.createElement('div');
      c.className = 'uCard deal' + (it.foe ? ' foe' : '');
      c.style.setProperty('--d', (0.15 + i * 0.12) + 's');
      c.innerHTML = '<span class="cnt">' + (i + 1) + ' / ' + items.length + '</span><span class="tag">' + it.tag + '</span>' +
        '<span class="pic"><img src="' + it.icon + '"></span><b>' + it.name + '</b><p>' + it.desc + '</p>';
      return c;
    });
    for (const c of cards.slice().reverse()) stack.appendChild(c); // prvá karta navrchu
    let top = 0;
    const layout = () => cards.forEach((c, i) => {
      const k = i - top;
      if (k < 0) return;
      c.style.zIndex = 50 - k;
      c.style.transform = 'translate(' + k * 6 + 'px,' + k * 6 + 'px) rotate(' + k * 2.5 + 'deg)';
      c.style.opacity = k > 3 ? 0 : 1;
    });
    layout();
    deck.classList.remove('out');
    deck.hidden = false;
    stack.onclick = () => {
      if (top >= cards.length) return;
      const c = cards[top++];
      c.classList.add('gone');
      AUDIO.play('click');
      setTimeout(() => c.remove(), 400);
      if (top < cards.length) { layout(); return; }
      setTimeout(() => { deck.classList.add('out'); setTimeout(() => { deck.hidden = true; deck.classList.remove('out'); afterDeck(); }, 300); }, 250);
    };
  }

  const afterDeck = () => { if (kingMeta.pending && st.phase === 'map') setTimeout(showTalentPick, 300); };
  // výber jedného z 3 náhodných vylepšení kráľa
  function showTalentPick() {
    const box = $('talentPick');
    if (!box.hidden || !kingMeta.pending) return;
    const avail = TALENTS.filter(t => tal(t.id) < TAL_MAX && (!t.need || has(t.need)));
    if (!avail.length) { kingMeta.pending = 0; saveKing(); return; }
    for (let i = avail.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [avail[i], avail[j]] = [avail[j], avail[i]]; }
    $('tpLvl').textContent = kingMeta.lvl - kingMeta.pending + 1;
    const list = $('tpList'); list.innerHTML = '';
    let chosen = false;
    avail.slice(0, 3).forEach((t, i) => {
      const lv = tal(t.id);
      const c = document.createElement('button');
      c.className = 'tpCard';
      c.style.setProperty('--d', (0.1 + i * 0.12) + 's');
      c.innerHTML = '<img src="' + ICONS[t.icon] + '"><span class="info"><b>' + t.name + ' <span class="pips">' + '●'.repeat(lv + 1) + '<i>' + '●'.repeat(TAL_MAX - lv - 1) + '</i></span></b><small>' + t.desc + '</small></span>';
      c.addEventListener('click', () => {
        if (chosen) return;
        chosen = true;
        kingMeta.tal[t.id] = lv + 1; kingMeta.pending--; saveKing();
        if (st.king && st.phase === 'build') st.king.hp = kingMax();
        AUDIO.play('upgrade');
        c.classList.add('pick'); box.classList.add('done');
        setTimeout(() => {
          box.hidden = true; box.classList.remove('done');
          if (st.phase === 'build') renderBuild();
          if (kingMeta.pending) setTimeout(showTalentPick, 250);
        }, 650);
      });
      list.appendChild(c);
    });
    box.hidden = false;
    AUDIO.play('unlock');
  }

  $('playBtn').addEventListener('click', showMap);
  $('overMap').addEventListener('click', showMap);
  $('overRetry').addEventListener('click', () => startMission(st.mission, st.tier));
  $('mapPlay').addEventListener('click', () => { if (!st.mapAnim && tierOpen(st.mapSel, st.mapTier || 0)) startMission(st.mapSel, st.mapTier || 0); });
  $('mapBack').addEventListener('click', () => { st.phase = 'title'; $('map').hidden = true; showTitle(); });
  function syncSound() {
    document.querySelectorAll('.sndBtn').forEach(b => {
      const on = AUDIO.prefs[b.dataset.kind];
      b.classList.toggle('off', !on);
      b.title = (b.dataset.kind === 'music' ? 'Hudba' : 'Zvuky') + (on ? ' zapnuté' : ' vypnuté');
    });
  }
  document.querySelectorAll('.sndBtn').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    AUDIO.setPref(b.dataset.kind, !AUDIO.prefs[b.dataset.kind]);
    syncSound(); AUDIO.play('click');
  }));
  syncSound();
  $('gemBox').addEventListener('click', () => toast('Obchod s gemami pripravujeme'));

  const RACES = [
    { name: 'Ľudia', spr: 'knight', state: 'open' },
    { name: 'Orkovia', spr: 'orc', state: 'soon' },
    { name: 'Skeletoni', spr: 'archer', state: 'soon' },
    { name: 'Elfovia', spr: 'archer', state: 'gem', price: 500 },
    { name: 'Zombie', spr: 'goblin', state: 'gem', price: 500 },
    { name: 'Hmyzáci', spr: 'goblin', state: 'gem', price: 800 },
  ];
  function showTitle() {
    $('title').hidden = false;
    AUDIO.music('map');
    $('bestTxt').textContent = st.unlocked > MISSIONS.length ? 'Ostrov je oslobodený!' : st.unlocked > 1 ? 'Postup: misia ' + st.unlocked + ' z ' + MISSIONS.length : '';
    const box = $('races'); box.innerHTML = '';
    for (const r of RACES) {
      const c = document.createElement('button');
      c.className = 'race ' + r.state + (r.state === 'open' ? ' sel' : '');
      const img = spriteURL(SPR[r.spr][0], 4, r.state !== 'open');
      const tag = r.state === 'open' ? 'Hrať' : r.state === 'soon' ? 'Čoskoro' : '<img class="gem" src="' + ICONS.gem + '">' + r.price;
      c.innerHTML = '<img src="' + img + '"><b>' + r.name + '</b><span class="tag">' + tag + '</span>';
      c.addEventListener('click', () => {
        if (r.state === 'soon') toast(r.name + ' prídu v ďalšej verzii');
        else if (r.state === 'gem') toast('Odomykanie za gemy pripravujeme');
      });
      box.appendChild(c);
    }
  }

  // ---------------- Slučka ----------------
  let last = performance.now(), acc = 0;
  const DT = 1 / 60;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!scene) { resize(); requestAnimationFrame(frame); return; }
    if (st.phase === 'battle') {
      // spomalenie na tretinu, posledných 0,3 s sa plynulo vráti na plnú rýchlosť
      const slow = slowmoT <= 0 ? 1 : slowmoT > 0.3 ? 0.33 : 0.33 + 0.67 * (1 - slowmoT / 0.3);
      slowmoT = Math.max(0, slowmoT - dt);
      acc += dt * st.speed * slow;
      while (acc >= DT && st.phase === 'battle') { update(DT); acc -= DT; }
    } else { acc = 0; updateFx(dt); mapTick(dt); }
    camTick(dt);
    render(now / 1000);
    hudTick();
    requestAnimationFrame(frame);
  }

  initSprites();
  initBuildingSprites();
  initIcons();
  resize();
  window.addEventListener('resize', resize);
  showTitle();
  updateHud();
  requestAnimationFrame(frame);

  // ---------------- Ladenie ----------------
  function postPNG(canvas, name) {
    return fetch('/snap?name=' + encodeURIComponent(name), { method: 'POST', body: canvas.toDataURL('image/png') });
  }
  function snap(name, scale) {
    scale = scale || 4;
    const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(buf, 0, 0, c.width, c.height);
    return postPNG(c, name);
  }
  function sheet(name, scale) {
    scale = scale || 6;
    const list = [];
    for (const k in SPR) SPR[k].forEach(s => list.push(s));
    for (const k in BSPR) [BSPR[k]].flat(2).forEach(s => list.push(s));
    const w = list.reduce((a, s) => a + s.w + 3, 3), h = Math.max(...list.map(s => s.h)) + 6;
    const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#56923a'; x.fillRect(0, 0, c.width, c.height);
    let px = 3;
    for (const s of list) { x.drawImage(s.c, px * scale, (h - 3 - s.h) * scale, s.w * scale, s.h * scale); px += s.w + 3; }
    return postPNG(c, name);
  }
  window.FW = { DIFF, meta, perk, st, G, costOf, moveBuilding, renderBuild, get camY() { return camY; }, get slowmoT() { return slowmoT; }, hudTick, ability, SPECS, KTYPES, BUILD, ENEMY, WUNIT, snap, sheet, update, spawnEnemy, render, addBuilding, startWave, rebuildOcc, showMap, startMission, missionWon,
    enterBuild, reviveKing, reviveCost, TIERS, starsOf, tierOpen, showUnlockDeck, showTalentPick, kingMeta, gainKingXp, volley, has, lvlCap, hallCap, bCap, bUpCost, uUpCost, hallUpCost, volleyUpCost, repairCost, bRepairCost, bMaxHp, hallMax, zoneTopRow, inZone, inHall, occAt, kingMax };
})();
