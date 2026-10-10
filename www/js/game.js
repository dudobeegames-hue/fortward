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
  let W = 180, H = 360, FH = 360, S = 1, DPR = 1, scene = null; // FH = výška bojiska (v útočných misiách vyššia ako obrazovka)
  let camY = 0; // y hornej hrany obrazovky na bojisku (herné px)
  const fieldExtra = () => st.mission > HOME_PROVINCES ? Math.round(H * 0.45) : 0; // útočné misie: hrad je ďalej, mapa sa posúva prstom
  const camBase = () => FH - H; // kamera pri radnici
  const G = { T, gx0: 0, gy0: 0, cols: 11, rows: 24, hc0: 4, hr0: 20, hallCx: 0, hallTop: 0, hallBot: 0, zoneTopMax: 0 };

  // ---------------- Dáta ----------------
  const BUILD = {
    tower:    { name: 'Strážna veža', short: 'Veža',   cost: 60,  hp: 240, range: 80, dmg: 7,  cd: 0.9, proj: 'arrow', speed: 180, block: true, desc: 'Lukostrelec strieľa na hordu v dosahu' },
    barracks: { name: 'Kasárne',      short: 'Kasárne', cost: 90, hp: 220, block: true, desc: 'Posiela rytierov proti horde' },
    range:    { name: 'Strelnica',    short: 'Strelnica', cost: 100, hp: 200, block: true, desc: 'Vysiela lukostrelcov, ktorí sa držia za rytiermi a strieľajú z diaľky' },
    stables:  { name: 'Stajne',       short: 'Stajne',  cost: 110, hp: 200, block: true, desc: 'Vysiela jazdcov – rýchlo obídu líniu a idú po strelcoch, šamanoch a podkopníkoch' },
    falconry: { name: 'Sokoliareň',   short: 'Sokoly',  cost: 120, hp: 180, block: true, desc: 'Vypúšťa sokoly – letia ponad hradby a lovia netopiere, šamanov a podkopníkov; strelci ich ľahko zostrelia' },
    armory:   { name: 'Zbrojnica',    short: 'Zbrojnica', cost: 100, hp: 240, block: true, desc: 'Vysiela kopijníkov – útočia spoza rytierov a sú silní proti jazde' },
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
    spear:  { name: 'Kopijník',    spr: 'spear',   hp: 1.2, dmg: 0.85, spd: 24, desc: 'útočí spoza rytierov, silný proti jazde' },
    rider:  { name: 'Jazdec',      spr: 'rider',   hp: 0.9, dmg: 1.25, spd: 46, desc: 'rýchly, ide po strelcoch a šamanoch' },
  };
  // každá pozemná jednotka má vlastnú budovu
  const UNIT_HOME = { barracks: 'knight', stables: 'rider', armory: 'spear' };
  const UNIT_PLURAL = { knight: 'Rytieri', rider: 'Jazdci', spear: 'Kopijníci' };
  const SPIKE_COST = 25, SPIKE_TYPE_COST = 40;
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
  };
  // kúzla: hráč ťukne na kúzlo a potom na miesto na bojisku (salva má vlastné nabíjanie volleyCd)
  const SPELLS = {
    volley:    { name: 'Šípová salva', tech: 'volley',    cdKey: 'volleyT' },
    fireball:  { name: 'Ohnivá guľa',  tech: 'fireball',  cdKey: 'fireCd', cd: 22, R: 18 },
    freeze:    { name: 'Mráz',         tech: 'freeze',    cdKey: 'freezeCd', cd: 30, R: 26, dur: 2.5 },
    lightning: { name: 'Blesk',        tech: 'lightning', cdKey: 'boltCd', cd: 18, reach: 34 },
  };
  const spellMax = id => id === 'volley' ? volleyCd() : SPELLS[id].cd;
  const spellPow = () => 1 + 0.15 * (st.mission - 1); // kúzla silnejú s misiou, aby stačili na tuhšiu hordu
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
  const BUILD_ORDER = ['tower', 'wall', 'pit', 'mine', 'barracks', 'range', 'stables', 'armory', 'falconry', 'catapult', 'mage', 'chapel', 'firepit', 'beartrap', 'workshop'];
  const ENEMY = {
    goblin:  { spr: 'goblin',  hp: 12,  speed: 24, atk: 4,  atkCd: 0.8, gold: 3,  blood: '#62a03a' },
    orc:     { spr: 'orc',     hp: 32,  speed: 16, atk: 9,  atkCd: 1.0, gold: 6,  blood: '#62a03a' },
    brute:   { spr: 'brute',   hp: 120, speed: 11, atk: 22, atkCd: 1.3, gold: 18, blood: '#62a03a' },
    warlord: { spr: 'warlord', hp: 520, speed: 8,  atk: 45, atkCd: 1.5, gold: 90, blood: '#a8482c', boss: true },
    orcKing: { spr: 'orcKing', hp: 2600, speed: 9, atk: 55, atkCd: 1.4, gold: 300, blood: '#a8482c', boss: true, king: true, name: 'Orkský veľkráľ' },
    garcher: { spr: 'garcher', hp: 14,  speed: 20, atk: 6,  atkCd: 1.7, gold: 5,  blood: '#62a03a', ranged: 54 },
    bat:     { spr: 'bat',     hp: 9,   speed: 30, atk: 4,  atkCd: 1.0, gold: 4,  blood: '#4a3460', fly: true },
    ram:     { spr: 'ram',     hp: 170, speed: 9,  atk: 48, atkCd: 1.6, gold: 22, blood: '#6e4422', ram: true },
    shaman:  { spr: 'shaman',  hp: 45,  speed: 12, atk: 5,  atkCd: 1.2, gold: 15, blood: '#62a03a', heals: true },
    wolf:    { spr: 'wolf',    hp: 30,  speed: 40, atk: 9,  atkCd: 0.7, gold: 7,  blood: '#62a03a', cav: true, flank: true },
    bear:    { spr: 'bear',    hp: 150, speed: 22, atk: 24, atkCd: 1.2, gold: 20, blood: '#62a03a', cav: true, charge: true },
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
  const ARCHER_PRIO = e => e.d.fly || e.d.heals || e.d.sapper;            // lukostrelci: najprv letci, šamani a podkopníci
  const RIDER_PRIO = e => e.d.ranged || e.d.heals || e.d.sapper;          // jazdci: strelci, šamani, podkopníci
  const SPEAR_REACH = 15, SPEAR_VS_CAV = 3, RIDER_CHARGE = 2, CHARGE_RUN = 30;
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
  // ---- 4 pozície na uloženie: postup každej je pod vlastnou predponou (zvuk je spoločný) ----
  const SLOTS = 4;
  let SLOT = 1;
  const slotKey = (n, k) => 'fortward.s' + n + '.' + k;
  const sk = k => slotKey(SLOT, k);
  // jednorazový presun starého postupu (bez pozícií) do pozície 1
  try {
    if (!localStorage.getItem('fortward.slotsReady')) {
      if (!localStorage.getItem(slotKey(1, 'unlocked')) && localStorage.getItem('fortward.unlocked')) {
        for (const k of ['stars', 'perks', 'king', 'unlocked', 'introSeen']) { const v = localStorage.getItem('fortward.' + k); if (v != null) localStorage.setItem(slotKey(1, k), v); }
        localStorage.setItem(slotKey(1, 'race'), JSON.stringify('Ľudia'));
      }
      localStorage.setItem('fortward.slotsReady', '1');
    }
  } catch (e) { }
  const meta = { stars: [], perks: {} };
  // ---- trofeje: počítadlá za celú pozíciu a míľniky; získaná trofej sa na mape vyfarbí ----
  const stats = { kills: 0, builds: 0, bosses: 0, orcKings: 0, perfect: 0, maxGold: 0 };
  const ach = {};
  let achSeen = 0; // čas poslednej prezrenej trofeje – novšie sú „neprečítané“
  const ACH = [
    { id: 'blood',    name: 'Prvá krv',          desc: 'Poraz prvého nepriateľa',            icon: 'e_orc',      ok: () => stats.kills >= 1 },
    { id: 'win1',     name: 'Prvé víťazstvo',    desc: 'Dobyj prvý hrad',                    icon: 'hall',       ok: () => st.unlocked >= 2 },
    { id: 'kills100', name: 'Bojovník',          desc: 'Poraz 100 nepriateľov',              icon: 'u_knight',   ok: () => stats.kills >= 100 },
    { id: 'builds50', name: 'Staviteľ',          desc: 'Postav 50 stavieb',                  icon: 'tower',      ok: () => stats.builds >= 50 },
    { id: 'rich',     name: 'Boháč',             desc: 'Maj naraz 1000 zlata',               icon: 'coin',       ok: () => stats.maxGold >= 1000 },
    { id: 'perfect',  name: 'Nedobytná radnica', desc: 'Vyhraj misiu s nepoškodenou radnicou', icon: 'wall',     ok: () => stats.perfect >= 1 },
    { id: 'boss',     name: 'Lovec vojvodcov',   desc: 'Poraz Vojvodcu orkov',               icon: 'e_shaman',   ok: () => stats.bosses >= 1 },
    { id: 'king5',    name: 'Skúsený panovník',  desc: 'Kráľ na úrovni 5',                   icon: 'king',       ok: () => kingMeta.lvl >= 5 },
    { id: 'stars10',  name: 'Zberateľ hviezd',   desc: 'Získaj 10 hviezd',                   icon: 'star',       ok: () => starsTotal() >= 10 },
    { id: 'half',     name: 'Polovica ostrova',  desc: 'Oslobodi 5 provincií',               icon: 'barracks',   ok: () => st.unlocked >= 6 },
    { id: 'fort',     name: 'Dobyvateľ',         desc: 'Zbúraj prvú orkskú pevnosť',         icon: 'u_siegeRam', ok: () => st.unlocked >= 7 },
    { id: 'gold3',    name: 'Zlatá koruna',      desc: 'Získaj 3 hviezdy na zlatej úrovni',  icon: 'gem',        ok: () => meta.stars.some(a => a && a[2] >= 3) },
    { id: 'kills1k',  name: 'Postrach hordy',    desc: 'Poraz 1000 nepriateľov',             icon: 'e_bear',     ok: () => stats.kills >= 1000 },
    { id: 'stars30',  name: 'Hviezdny pán',      desc: 'Získaj 30 hviezd',                   icon: 'star',       ok: () => starsTotal() >= 30 },
    { id: 'king10',   name: 'Legendárny kráľ',   desc: 'Kráľ na úrovni 10',                  icon: 'king',       ok: () => kingMeta.lvl >= 10 },
    { id: 'orcKing',  name: 'Kráľobijca',        desc: 'Poraz orkského veľkráľa',            icon: 'e_orcKing',  ok: () => stats.orcKings >= 1 },
    { id: 'island',   name: 'Pán ostrova',       desc: 'Oslobodi celý ostrov',               icon: 'gate',       ok: () => st.unlocked >= 11 },
  ];
  const achIcon = a => a.icon === 'star' ? UI_ICONS.star : ICONS[a.icon];
  const saveStats = () => saveJSON(sk('stats'), stats);
  // skontroluje míľniky; nové trofeje uloží a oznámi
  function checkAch() {
    const fresh = ACH.filter(a => !ach[a.id] && a.ok());
    if (!fresh.length) return;
    for (const a of fresh) ach[a.id] = Date.now();
    saveJSON(sk('ach'), ach); saveStats();
    if (!$('map').hidden) renderMapBar(); // upozornenie je len odznak na karte Trofeje
  }
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
  const kingMeta = { lvl: 1, xp: 0, pending: 0, tal: {}, slots: [null, null, null] };
  // schopnosti hrdinu: 3 sloty, odomknú sa na úrovni 2, 5 a 9; hráč si do slotu vyberie jednu z ponuky
  const KING_SLOT_LVL = [2, 5, 9];
  const KING_POWERS = ['volley', 'freeze', 'lightning'];
  const POWER_INFO = {
    volley:    { name: 'Šípová salva', desc: 'Dážď šípov na zvolené miesto. Vylepšuje sa v radnici.', icon: 'sp_volley' },
    freeze:    { name: 'Mráz',         desc: 'Nepriatelia v okolí na pár sekúnd takmer zamrznú.',     icon: 'sp_frost' },
    lightning: { name: 'Blesk',        desc: 'Silný úder do nepriateľa, preskočí na dvoch ďalších.',  icon: 'sp_bolt' },
    fireball:  { name: 'Ohnivá guľa',  desc: 'Výbuch zraní hordu v okolí a podpáli ju.',              icon: 'sp_fire' },
    warcry:    { name: 'Pokrik',       desc: 'Na chvíľu posilní a zrýchli hrdinu aj rytierov.',        icon: 'king' }, // v zálohe pre iného hrdinu
  };
  const slotOpen = i => kingMeta.lvl >= KING_SLOT_LVL[i];
  const spellOn = id => kingMeta.slots.some((s, i) => s === id && slotOpen(i));
  const emptySlots = () => kingMeta.slots.filter((s, i) => !s && slotOpen(i)).length;
  const tal = id => kingMeta.tal[id] || 0;
  const kingXpNeed = l => 60 + 40 * (l - 1);
  const saveKing = () => saveJSON(sk('king'), kingMeta);
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
  const hallCap = () => st.mission === 1 ? 2 : lvlCap();                // úroveň radnice (v úvodnej misii najviac 2)
  // stavby majú najviac úroveň radnice: drevená radnica = drevené stavby, kameň až po jej vylepšení
  const bCap = () => Math.min(lvlCap(), st.hallLvl);
  const LVL_NAME = ['', 'drevo', 'kameň', 'kameň s kovaním', 'tmavé opevnenie', 'kráľovský kameň'];
  const lockBtn = (label, id, wide) => btn('🔒 ' + label + ' · misia ' + unlockMissionOf(id), null, false, () => { }, 'locked' + (wide ? ' wide' : ''));
  const saveProgress = () => { try { localStorage.setItem(sk('unlocked'), String(st.unlocked)); } catch (e) { } };
  // načíta postup zvolenej pozície do hry
  function loadSlot(n) {
    SLOT = n;
    meta.stars = loadJSON(sk('stars'), []).map(v => Array.isArray(v) ? v : [v || 0, 0, 0]); // staré uloženie (číslo) = medená úroveň
    for (const k in meta.perks) delete meta.perks[k];
    Object.assign(meta.perks, loadJSON(sk('perks'), {}));
    if (meta.perks.armor) { delete meta.perks.armor; saveJSON(sk('perks'), meta.perks); } // zrušený bonus – hviezdy sa vrátia
    for (const k in kingMeta) delete kingMeta[k];
    Object.assign(kingMeta, { lvl: 1, xp: 0, pending: 0, tal: {}, slots: [null, null, null] }, loadJSON(sk('king'), {}));
    if (!Array.isArray(kingMeta.slots) || kingMeta.slots.length !== 3) kingMeta.slots = [null, null, null];
    Object.assign(stats, { kills: 0, builds: 0, bosses: 0, orcKings: 0, perfect: 0, maxGold: 0 }, loadJSON(sk('stats'), {}));
    for (const k in ach) delete ach[k];
    Object.assign(ach, loadJSON(sk('ach'), {}));
    achSeen = loadJSON(sk('achSeen'), 0);
    st.unlocked = Math.max(1, Math.min(11, parseInt(localStorage.getItem(sk('unlocked')) || '1', 10) || 1));
    // prejdené misie bez záznamu hviezd (vyhrané pred zavedením hviezd) dostanú 1 bronzovú – víťazstvo dáva vždy aspoň 1
    let fixed = false;
    for (let m = 1; m < st.unlocked && m <= MISSIONS.length; m++) {
      const a = meta.stars[m - 1];
      if (!a || !a.some(v => v > 0)) { meta.stars[m - 1] = [1, 0, 0]; fixed = true; }
    }
    if (fixed) saveJSON(sk('stars'), meta.stars);
    st.mapSel = null; st.mapTierFor = null; st.mapAnim = null; st.provAnim = null;
  }
  // súhrn pozície pre menu (bez prepnutia)
  function slotInfo(n) {
    const get = k => { try { return localStorage.getItem(slotKey(n, k)); } catch (e) { return null; } };
    const race = get('race'), unl = get('unlocked');
    if (!race && !unl) return null;
    const stars = (JSON.parse(get('stars') || '[]') || []).reduce((a, v) => a + (Array.isArray(v) ? v.reduce((x, y) => x + (y || 0), 0) : (v || 0)), 0);
    const king = JSON.parse(get('king') || '{}') || {};
    return { race: race ? JSON.parse(race) : 'Ľudia', won: Math.min(MISSIONS.length, Math.max(0, (parseInt(unl || '1', 10) || 1) - 1)), stars, king: king.lvl || 1 };
  }
  function clearSlot(n) { for (const k of ['stars', 'perks', 'king', 'unlocked', 'introSeen', 'race', 'stats', 'ach', 'achSeen']) try { localStorage.removeItem(slotKey(n, k)); } catch (e) { } }
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
    island = buildIsland(W, H, 21); island.ships = null;
    layoutField();
  }
  // mriežka a krajina bojiska (výška závisí od misie)
  function layoutField() {
    FH = H + fieldExtra();
    buf.width = W; buf.height = FH;
    const oldHc = G.hc0, oldHr = G.hr0, had = !!scene;
    // pevný počet stĺpcov na každom zariadení (zmestí sa aj do najužšej plochy 180 px) – zmena okna tak mriežku neposúva
    G.cols = Math.min(GRID_COLS, Math.floor(W / T)); G.gx0 = Math.floor((W - G.cols * T) / 2);
    G.rows = Math.floor((FH - GROUND_PAD) / T); G.gy0 = FH - GROUND_PAD - G.rows * T;
    G.hc0 = Math.floor(G.cols / 2) - 1; G.hr0 = G.rows - 3;
    G.hallCx = tileX(G.hc0) + 1.5 * T; G.hallTop = tileY(G.hr0); G.hallBot = G.hallTop + 3 * T;
    G.zoneTopMax = tileY(G.rows - (5 + MAX_LVL));
    scene = buildScene(W, FH, G, 7 + st.mission * 13, st.mission - 1);
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
    if (!w || x < 0 || y < 0 || x >= W || y >= FH) return 1;
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

  // časovač viazaný na misiu: po reštarte či odchode na mapu sa nespustí a počas pauzy počká
  function later(fn, ms) {
    const run = st.run;
    const go = () => { if (st.run !== run) return; if (st.paused) { setTimeout(go, 200); return; } fn(); };
    setTimeout(go, ms);
  }
  function startMission(m, tier) {
    st.run = (st.run || 0) + 1;
    st.mission = m;
    st.tier = tier || 0;
    st.tech = techFor(Math.max(m, st.unlocked)); // platí všetko, čo hráč už odomkol
    layoutField(); // každá misia má vlastnú krajinu (útočné misie dlhšie bojisko)
    $('map').hidden = true;
    newGame();
    banner('Misia ' + m + ': ' + MISSIONS[m - 1].name + (st.tier ? ' · ' + TIERS[st.tier].name : ''));
  }

  // ---- útočné misie (6–10): orkský hrad hore na bojisku, z jeho brány vychádza horda ----
  const isAttack = () => st.mission > HOME_PROVINCES;
  const FORT = { keepHp: 1500, towerHp: 320, palHp: 220, stakeHp: 90, keepBot: 84, palY: 100, stakeY: 116 }; // y spodku hradu, palisády a kolov (herné px) – pod horným panelom
  // obrana hradu rastie s misiou: 6 palisáda + 2 veže, 7 + koly, 8 kamenný múr + 4 veže, 9 hrad hádže balvany, 10 hádže častejšie
  const fortLayout = a => ({ stone: a >= 2, stakes: a >= 1, towers: a >= 2 ? [-60, -40, 40, 60] : [-40, 40], rock: a >= 4 ? 3.2 : a >= 3 ? 4.5 : 0 });
  function makeFort() {
    const x = scene.fortX, tr = TIERS[st.tier || 0].hp, a = st.mission - HOME_PROVINCES - 1, mm = 1 + 0.2 * a, L = fortLayout(a);
    const keepBot = FORT.keepBot, py = FORT.palY, ph = FORT.palHp * tr * mm * (L.stone ? 1.7 : 1);
    const pal = [], stakes = [];
    for (let k = -3; k <= 3; k++) pal.push({ x: x + k * 16, y: py, hp: ph, max: ph, gate: k === 0, flash: 0 });
    if (L.stakes) for (let k = -3; k <= 3; k++) stakes.push({ x: x + k * 16, y: FORT.stakeY, hp: FORT.stakeHp * tr * mm, max: FORT.stakeHp * tr * mm });
    return {
      x, y: keepBot, hp: FORT.keepHp * tr * mm, max: FORT.keepHp * tr * mm, flash: 0, stone: L.stone, rockCd: L.rock, rockT: 3, rocks: [], prock: [],
      towers: L.towers.map(dx => ({ x: x + dx, y: Math.abs(dx) > 50 ? py - 3 : keepBot + 10, hp: FORT.towerHp * tr * mm, max: FORT.towerHp * tr * mm, cd: 1 + Math.random(), flash: 0 })),
      pal, stakes, gateX: x, gateY: py + 3,
    };
  }
  // medzi vlnami orkovia opravia opevnenie: celé stavby +30 %, až 2 zbúrané úseky hradieb znova postavia, koly obnovia
  function repairFort() {
    const F = st.fort;
    if (!F || F.dead) return;
    let rebuilt = 0;
    for (const o of F.towers.concat(F.pal)) {
      if (o.hp > 0 && o.hp < o.max) o.hp = Math.min(o.max, o.hp + o.max * 0.3);
      else if (o.hp <= 0 && F.pal.includes(o) && rebuilt < 2) { o.hp = o.max * 0.35; rebuilt++; }
    }
    for (const q of F.stakes) q.hp = q.max;
  }
  // koly: kto po nich ide, je zranený a spomalený; vojaci ich pritom pošliapu
  function stakeAt(u) {
    const F = st.fort;
    if (!F || !F.stakes.length || Math.abs(u.y - (FORT.stakeY - 3)) > 5) return null;
    for (const q of F.stakes) if (q.hp > 0 && Math.abs(u.x - q.x) <= 8) return q;
    return null;
  }
  // balvan z hradu: letí po oblúku na najväčší zhluk vojakov v dosahu
  function throwRock(F) {
    let best = null, bn = 0;
    for (const u of st.soldiers) {
      if (u.dead || u.helper || u.fly || Math.hypot(u.x - F.x, u.y - F.y) > 150) continue;
      let n = 0; for (const v of st.soldiers) if (!v.dead && Math.hypot(v.x - u.x, v.y - u.y) < 14) n++;
      if (n > bn) { bn = n; best = u; }
    }
    if (!best) return false;
    const sx = F.x + (Math.random() < 0.5 ? -9 : 9), sy = F.y - 46, tx = best.x + (Math.random() - 0.5) * 6, ty = best.y;
    F.rocks.push({ sx, sy, x: sx, y: sy, gy: sy, tx, ty, t: 0, dur: 1.1 + Math.hypot(tx - sx, ty - sy) / 260, h: 40 });
    AUDIO.play('clang');
    return true;
  }
  function updateRocks(F, dt) {
    for (const r of F.rocks) {
      r.t += dt / r.dur;
      const t = Math.min(1, r.t);
      r.x = r.sx + (r.tx - r.sx) * t; r.gy = r.sy + (r.ty - r.sy) * t; r.y = r.gy - Math.sin(Math.PI * t) * r.h;
      if (r.t < 1) continue;
      r.done = true;
      const dmg = 16 * (1 + 0.2 * (st.mission - HOME_PROVINCES - 1)) * Math.sqrt(TIERS[st.tier || 0].hp);
      for (const u of st.soldiers) if (!u.dead && !u.fly && Math.hypot(u.x - r.tx, u.y - r.ty) < 13) hitUnit(u, dmg);
      st.shake = Math.max(st.shake, 0.12);
      for (let k = 0; k < 12; k++) part(r.tx, r.ty - 2, (Math.random() - 0.5) * 50, -Math.random() * 35, 0.5, ['#3c3846', '#625a6c', '#967048'][k % 3], 100);
    }
    F.rocks = F.rocks.filter(r => !r.done);
  }

  // zásah stavby pevnosti; hrad neklesne pod 10 %, kým nevyjde všetkých 10 vĺn
  function hitFort(o, dmg) {
    const F = st.fort;
    if (!F || o.hp <= 0 || F.dead) return;
    fortContact();
    o.hp -= dmg; o.flash = 0.08;
    const isKeep = o === F;
    if (isKeep && st.wave < MISSION_WAVES) o.hp = Math.max(o.hp, o.max * 0.1);
    if (isKeep && F.kingE && !F.kingE.dead) o.hp = Math.max(o.hp, o.max * 0.05); // kým žije veľkráľ, hrad nepadne
    const cx = o.x, cy = isKeep ? F.y - 16 : o.y - 8;
    for (let k = 0; k < 2; k++) part(cx + (Math.random() - 0.5) * 12, cy, (Math.random() - 0.5) * 30, -10 - Math.random() * 20, 0.4, isKeep ? '#3c3846' : '#4a2e1a', 90);
    if (o.hp > 0) return;
    // zbúrané
    AUDIO.play('crumble'); st.shake = Math.max(st.shake, isKeep ? 0.6 : 0.15);
    for (let k = 0; k < (isKeep ? 80 : 20); k++) part(cx + (Math.random() - 0.5) * (isKeep ? 50 : 14), cy - Math.random() * 20, (Math.random() - 0.5) * 60, -Math.random() * 50, 0.9, ['#3c3846', '#22202a', '#4a2e1a', '#f89838'][k % 4], 110);
    if (isKeep) { // hrad hordy padol – víťazstvo
      F.dead = true;
      banner('Hrad hordy padol!');
      st.lastXp = gainKingXp(Math.round(40 * TIERS[st.tier || 0].xp));
      st.enemies = []; st.spawnQ = [];
      st.orcWaveOn = false; // pád hradu nie je koniec vlny – žiadne budovanie, len víťazstvo
      later(() => { if (st.phase === 'battle' || st.phase === 'pause' || st.phase === 'build') missionWon(); }, 1200);
    }
  }
  // cieľ útočiaceho vojaka: najprv palisáda (kým nie je prelomená), potom veže, nakoniec hrad
  function fortTarget(u) {
    const F = st.fort;
    if (!F || F.dead) return null;
    const near = list => { let b = null, bd = 1e9; for (const o of list) if (o.hp > 0) { const d = Math.hypot(o.x - u.x, o.y - u.y); if (d < bd) { bd = d; b = o; } } return b; };
    const breach = F.pal.some(q => q.hp <= 0);
    const sk = u.y > FORT.stakeY - 6 && F.stakes.length && F.stakes.every(q => q.hp > 0) ? near(F.stakes) : null; // súvislý rad kolov treba najprv prebiť
    return sk || (!breach && near(F.pal)) || near(F.towers) || F;
  }
  // bod, kam má vojak dôjsť, aby mohol udrieť (pod stavbou); cez palisádu len dierou
  function fortApproach(u, o) {
    const F = st.fort;
    if (o !== F && !F.towers.includes(o)) return { x: o.x, y: o.y + 3 };
    if (u.y > FORT.stakeY - 4) { // ešte pred kolmi – choď k prebitej diere
      let gap = null, gd = 1e9;
      for (const q of F.stakes) if (q.hp <= 0) { const d = Math.abs(q.x - u.x); if (d < gd) { gd = d; gap = q; } }
      if (gap && Math.abs(u.x - gap.x) > 4) return { x: gap.x, y: FORT.stakeY + 4 };
    }
    if (u.y > FORT.palY - 2) { // ešte pred palisádou – choď k diere
      let gap = null, gd = 1e9;
      for (const q of F.pal) if (q.hp <= 0) { const d = Math.abs(q.x - u.x); if (d < gd) { gd = d; gap = q; } }
      if (gap && Math.abs(u.x - gap.x) > 4) return { x: gap.x, y: FORT.palY + 4 };
      if (gap) return { x: gap.x, y: FORT.palY - 6 };
    }
    return o === F ? { x: F.x + Math.max(-20, Math.min(20, u.x - F.x)), y: F.y + 3 } : { x: o.x, y: o.y + 3 };
  }
  // ---- obliehacie stroje hráča ----
  const SIEGE = {
    ram: { hp: 340, spd: 11, dmg: 70, cd: 1.6, armor: 0.5, spr: 'siegeRam' },              // rozbíja bránu, potom hrad; orkov si nevšíma
    cat: { hp: 170, spd: 13, dmg: 55, cd: 3.6, armor: 0.8, spr: 'siegeCat', range: 105 },  // hádže balvany na veže a hrad
  };
  function spawnSiege(kind) {
    const d = SIEGE[kind], a = st.mission - HOME_PROVINCES - 1, hp = d.hp * (1 + 0.15 * a);
    st.soldiers.push({ siege: kind, x: G.hallCx + (Math.random() - 0.5) * 10, y: G.hallTop - 4, hp, max: hp, dmg: d.dmg * (1 + 0.15 * a), spd: d.spd, armor: d.armor, spr: d.spr, cd: 0.5, fired: 0, tgt: null, anim: 0, flash: 0, dead: false, slot: st.soldierN++ });
    for (let k = 0; k < 8; k++) part(G.hallCx, G.hallTop - 2, (Math.random() - 0.5) * 30, -Math.random() * 14, 0.4, '#c6a272', 40);
  }
  // cieľ baranidla: súvislé koly, potom brána, potom ľubovoľný úsek hradieb (ak brána padla) a nakoniec hrad
  function ramTarget(u) {
    const F = st.fort;
    const sk = u.y > FORT.stakeY - 6 && F.stakes.length && F.stakes.every(q => q.hp > 0) ? F.stakes[3] : null;
    if (sk) return sk;
    const gate = F.pal.find(q => q.gate);
    return gate && gate.hp > 0 ? gate : F;
  }
  // cieľ katapultu: najbližšia veža, potom hrad
  function catTarget(u) {
    const F = st.fort;
    let b = null, bd = 1e9;
    for (const t of F.towers) if (t.hp > 0) { const d = Math.hypot(t.x - u.x, t.y - u.y); if (d < bd) { bd = d; b = t; } }
    return b || F;
  }
  function updateSiege(u, dt) {
    const F = st.fort;
    u.flash = Math.max(0, u.flash - dt); u.cd = Math.max(0, u.cd - dt); u.fired = Math.max(0, u.fired - dt); u.swing = 0;
    if (!F || F.dead) return;
    const spd = u.spd * waterMul(u) * (stakeAt(u) && u.siege !== 'ram' ? 0.5 : 1);
    const off = u.y > FORT.stakeY + 8 ? (u.slot % 2 ? -7 : 7) : 0; // dva stroje nejdú cez seba
    const go = (x, y) => { if (u.y < FORT.palY + 30) moveTo(u, x, y, spd, dt); else moveKnight(u, x + off, y, spd, dt); };
    if (u.siege === 'cat') {
      const o = catTarget(u), oy = o === F ? F.y - 16 : o.y - 8;
      if (Math.hypot(o.x - u.x, oy - u.y) > SIEGE.cat.range) { go(o.x + Math.max(-30, Math.min(30, u.x - o.x)), Math.max(FORT.stakeY + 12, oy + 60)); return; }
      if (u.cd > 0) return;
      u.cd = SIEGE.cat.cd; u.fired = 1.0;
      F.prock.push({ sx: u.x, sy: u.y - 14, x: u.x, y: u.y - 14, gy: u.y - 14, tx: o.x + (Math.random() - 0.5) * 6, ty: oy, t: 0, dur: 0.9 + Math.hypot(o.x - u.x, oy - u.y) / 220, h: 34, tgt: o, dmg: u.dmg });
      AUDIO.play('clang');
      return;
    }
    const o = ramTarget(u), a = fortApproach(u, o);
    if (Math.hypot(a.x - u.x, a.y - u.y) > 5) { go(a.x, a.y); return; }
    if (u.cd > 0) return;
    u.cd = SIEGE.ram.cd; u.swing = 0.2;
    AUDIO.play('crumble'); st.shake = Math.max(st.shake, 0.08);
    if (F.stakes.includes(o)) { o.hp -= u.dmg; if (o.hp <= 0) for (let k = 0; k < 10; k++) part(o.x + (Math.random() - 0.5) * 14, o.y - 4, (Math.random() - 0.5) * 40, -Math.random() * 30, 0.6, '#4a2e1a', 100); }
    else hitFort(o, u.dmg);
  }
  // balvany pojazdných katapultov: dopadnú na stavbu pevnosti a zrania orkov okolo
  function updatePlayerRocks(F, dt) {
    for (const r of F.prock) {
      r.t += dt / r.dur;
      const t = Math.min(1, r.t);
      r.x = r.sx + (r.tx - r.sx) * t; r.gy = r.sy + (r.ty - r.sy) * t; r.y = r.gy - Math.sin(Math.PI * t) * r.h;
      if (r.t < 1) continue;
      r.done = true;
      if (r.tgt.hp > 0) hitFort(r.tgt, r.dmg);
      for (const e of st.enemies) if (!e.dead && Math.hypot(e.x - r.tx, e.y - r.ty) < 16) damage(e, r.dmg * 0.4);
      for (let k = 0; k < 10; k++) part(r.tx, r.ty, (Math.random() - 0.5) * 44, -Math.random() * 30, 0.5, ['#625a6c', '#967048', '#f89838'][k % 3], 100);
    }
    F.prock = F.prock.filter(r => !r.done);
  }
  // rytier v útočnej misii: bije orkov, ktorých stretne, inak búra pevnosť
  function updateAssault(u, dt) {
    if (u.siege) { updateSiege(u, dt); return; }
    if (nearestEnemy(u.x, u.y, 60, true) || (u.tgt && !u.tgt.dead)) { updateFighter(u, dt, u.x, u.y, 60, u.dmg, false, moveKnight); return; }
    u.flash = Math.max(0, u.flash - dt); u.cd = Math.max(0, u.cd - dt); u.swing = Math.max(0, (u.swing || 0) - dt);
    const o = fortTarget(u);
    if (!o) return;
    const a = fortApproach(u, o), spd = (u.spd || 26) * (st.cryT > 0 ? 1.4 : 1) * waterMul(u) * (stakeAt(u) ? 0.5 : 1);
    if (Math.hypot(a.x - u.x, a.y - u.y) > 5) { if (u.y < FORT.palY + 30) moveTo(u, a.x, a.y, spd, dt); else moveKnight(u, a.x, a.y, spd, dt); return; }
    if (u.cd <= 0) { u.cd = 0.8; u.swing = 0.15; AUDIO.play('clang'); hitFort(o, u.dmg * (st.cryT > 0 ? 1.6 : 1)); }
  }
  // orkské veže strieľajú na najbližšieho vojaka v dosahu
  function updateFort(dt) {
    const F = st.fort;
    if (!F || F.dead) return;
    F.flash = Math.max(0, F.flash - dt);
    // po 10. vlne: posádka robí výpady na radnicu hráča (malé skupinky), kým hrad stojí
    if (st.wave >= MISSION_WAVES && !st.orcWaveOn) {
      F.sortieT = (F.sortieT == null ? 6 : F.sortieT) - dt;
      if (F.sortieT <= 0) {
        F.sortieT = 14;
        const pool = buildWave(MISSION_WAVES).filter(q => !ENEMY[q.type].boss && !ENEMY[q.type].fly);
        for (let k = 0; k < 3 + Math.floor(Math.random() * 2) && pool.length; k++) st.spawnQ.push(Object.assign(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], { gap: 0.6 }));
        st.spawnT = Math.min(st.spawnT, 0.3);
      }
    }
    for (const q of F.pal) q.flash = Math.max(0, q.flash - dt);
    for (const u of st.soldiers) { // koly zraňujú a vojaci ich pritom pošliapu
      const q = !u.dead && !u.helper && !u.fly && stakeAt(u);
      if (!q) continue;
      hitUnit(u, 4 * dt); u.flash = 0;
      q.hp -= 12 * dt;
      if (q.hp <= 0) { AUDIO.play('crumble'); for (let k = 0; k < 10; k++) part(q.x + (Math.random() - 0.5) * 14, q.y - 4, (Math.random() - 0.5) * 40, -Math.random() * 30, 0.6, '#4a2e1a', 100); }
    }
    updateRocks(F, dt); updatePlayerRocks(F, dt); maybeOrcKing(F);
    // horda vyrazí z hradu, keď vojsko hráča prejde polovicu bojiska (alebo pri prvom kontakte s obranou)
    if (st.pendingWave && st.soldiers.some(u => !u.dead && !u.helper && u.y < (FORT.palY + G.hallTop) / 2)) fortContact(); // polovica cesty medzi hradmi
    if (F.rockCd && st.phase === 'battle') { F.rockT -= dt; if (F.rockT <= 0) F.rockT = throwRock(F) ? F.rockCd : 0.5; }
    for (const t of F.towers) {
      t.flash = Math.max(0, t.flash - dt);
      if (t.hp <= 0) continue;
      t.cd -= dt;
      if (t.cd > 0) continue;
      let tg = null, td = 84;
      for (const u of st.soldiers) { if (u.dead) continue; const d = Math.hypot(u.x - t.x, u.y - (t.y - 24)); if (d < td) { td = d; tg = u; } }
      if (!tg) { t.cd = 0.3; continue; }
      t.cd = 1.5;
      st.eproj.push({ x: t.x, y: t.y - 28, tx: tg.x, ty: tg.y - (tg.fly ? 16 : 6), tgt: tg, dmg: 5 * (1 + 0.2 * (st.mission - HOME_PROVINCES - 1)) * Math.sqrt(TIERS[st.tier || 0].hp) });
      fortContact();
    }
  }

  function newGame() {
    undoStack = [];
    Object.assign(st, {
      wave: 0, gold: Math.round((DIFF.startGold + DIFF.startGoldMission * (st.mission - 1)) * (1 + 0.15 * perk('treasury'))), hallLvl: 1, volleyLvl: 1, volleyT: 0, boss: null, tool: null, sel: null, hallFlash: 0, shake: 0, soldierN: 0,
      blds: [], enemies: [], soldiers: [], proj: [], eproj: [], drops: [], parts: [], texts: [], marks: [], spawnQ: [],
      cryT: 0, cryCd: 0, freezeCd: 0, fireCd: 0, boltCd: 0, spellSel: null, fallFx: [], bolts: [], siegeHold: false, siegeT: 0, introPan: null,
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
    missionHp: [0.95, 1.5, 2.3, 2.55, 2.55, 2.7, 2.9, 3.4, 3.2, 4.0], // 6–10 silnejšie: hráč má stajne, zbrojnicu a sokoly
    copperHp:  [1, 1, 1, 1.15, 1.15, 1.45, 1.15, 1.15, 1.15, 1.15], // medená od misie 4 tuhšia (hrdina má schopnosti); misia 6 (prvý útok) ešte viac
    hpWave: 1.10, hpWaveMission: 0.006, hpMission: 0.25,   // rast zdravia počas misie (neskoršie misie rastú rýchlejšie)
    countWave: 2, countMission: 1,                         // počet nepriateľov vo vlne
    typeShift: 0.8, bruteFrom: 5, bruteRate: 0.03,         // ako rýchlo pribúdajú orkovia a surovci
    startGold: 210, startGoldMission: 80, goldMission: 0.15, // ekonomika (každá misia začína od nuly)
    bossBase: 0.6, bossMission: 0.33, bossLast: 1.0,       // sila vojvodcu v 5. a 10. vlne
    pBear: 0.07, pWolf: 0.1,
    pArcher: 0.12, pBat: 0.12, pRam: 0.05, pShaman: 0.04, pSapper: 0.06, // podiel nových nepriateľov
  };
  const goldMul = () => 1 + DIFF.goldMission * (st.mission - 1);

  function buildWave(w) {
    const m = st.mission, ew = w + (m - 1) * DIFF.typeShift;
    const q = [];
    const tr = TIERS[st.tier || 0];
    const n = 6 + Math.round(w * DIFF.countWave + (m - 1) * DIFF.countMission) + tr.extra;
    const mHp = DIFF.missionHp ? DIFF.missionHp[m - 1] : 1 + DIFF.hpMission * (m - 1);
    const hpMul = Math.pow(DIFF.hpWave + DIFF.hpWaveMission * (m - 1), w - 1) * mHp * (st.tier ? tr.hp : DIFF.copperHp[m - 1]);
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
      const pBear = m >= 7 && w >= 3 ? DIFF.pBear : 0, pWolf = m >= 9 && w >= 2 ? DIFF.pWolf : 0;
      if (r2 >= 1 - pSap - pBear && r2 < 1 - pSap) type = 'bear';
      else if (r2 >= 1 - pSap - pBear - pWolf && r2 < 1 - pSap - pBear) type = 'wolf';
      else if (r2 < pSh) type = 'shaman';
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
    if (kingMeta.pending) later(() => { if (st.phase === 'build') showTalentPick(); }, 600);
    st.viewUp = 0;
    if (isAttack() && st.wave === 0) {
      st.introPan = { t: 0 }; // úvodný prelet kamery na orkský hrad a späť k radnici
    } else if (isAttack() && st.siegeHold) {
      st.siegeT = SIEGE_BUILD; // obliehanie: na budovanie je len chvíľa, potom útok pokračuje sám
      later(() => { if (st.phase === 'build') toast('Hrad je obliehaný – orkovia ho neopravia. Útok pokračuje o ' + SIEGE_BUILD + ' s'); }, 400);
    } else if (isAttack()) repairFort();
  }

  const SIEGE_BUILD = 20; // sekundy budovania počas obliehania
  // útočná misia: ľudia vyrážajú prví; vlna orkov vyjde pri prvom kontakte s obranou hradu
  const canMarch = () => st.blds.some(b => (UNIT_HOME[b.kind] || b.kind === 'range') && !knightsBlocked(b));
  function triggerOrcWave() {
    if (!st.pendingWave) return;
    st.wave++;
    st.spawnQ = st.pendingWave; st.pendingWave = null;
    st.spawnT = 0.8; st.orcWaveOn = true;
    AUDIO.play('horn');
    banner(st.wave === MISSION_WAVES ? 'Posledná vlna hordy!' : 'Horda vyráža! Vlna ' + st.wave + ' / ' + MISSION_WAVES);
    updateHud();
  }
  // sú vojaci pri pevnosti? (pri palisáde alebo za ňou)
  const sieging = () => !!st.fort && !st.fort.dead && st.soldiers.some(u => !u.dead && !u.helper && !u.fly && u.y < FORT.palY + 40);
  const fortContact = () => { if (st.fort && st.phase === 'battle' && !st.orcWaveOn && st.pendingWave) triggerOrcWave(); };

  function startWave() {
    if (st.fort && st.fort.dead) { missionWon(); return; } // poistka: hrad už padol
    undoStack = [];
    if (isAttack()) {
      st.orcWaveOn = false;
      st.pendingWave = st.wave < MISSION_WAVES ? buildWave(st.wave + 1) : null;
      st.siegeT = 0;
      st.spawnQ = [];
    } else {
      st.wave++;
      st.spawnQ = buildWave(st.wave);
      st.spawnT = 1.2;
    }
    st.phase = 'battle';
    st.tool = null; st.sel = null; st.moving = null; bdrag = null;
    AUDIO.play('horn'); AUDIO.music('battle');
    st.viewUp = Math.max(0, (st.viewUp || 0) - panelLow()); // rovnaký pohľad aj bez panela
    $('build').hidden = true; $('bottom').hidden = false;
    for (const b of st.blds) if (UNIT_HOME[b.kind] || b.kind === 'range' || b.kind === 'falconry' || HELPERS[b.kind]) b.spawnT = HELPERS[b.kind] ? 0.6 : 0.3;
    if (isAttack()) {
      banner(st.pendingWave ? 'Do útoku!' : 'Zaútoč na hrad hordy!');
      if (st.pendingWave && !canMarch()) triggerOrcWave(); // nemá kto vyraziť – orkovia útočia hneď
    } else banner(st.wave === MISSION_WAVES ? 'Posledná vlna!' : 'Vlna ' + st.wave + ' / ' + MISSION_WAVES);
    updateHud();
  }

  function endWave() {
    stats.maxGold = Math.max(stats.maxGold, st.gold); saveStats();
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
    // útočná misia: ak vojaci práve dobýjajú pevnosť, ostanú stáť pri nej – krátke budovanie s odpočtom, orkovia hrad neopravia
    const hold = isAttack() && sieging();
    st.siegeHold = hold;
    st.phase = 'pause';
    st.proj = []; st.eproj = []; st.drops = [];
    if (st.fort) { st.fort.rocks = []; st.fort.prock = []; }
    if (!hold) { // rytieri sa po vlne vrátia do kasární
      for (const sd of st.soldiers) for (let k = 0; k < 5; k++) part(sd.x, sd.y - 5, (Math.random() - 0.5) * 20, -Math.random() * 20, 0.4, '#88b4ff', 30);
      st.soldiers = st.soldiers.filter(s => s.siege); // obliehacie stroje ostanú stáť na bojisku
    }
    st.orcWaveOn = false;
    if (st.wave >= MISSION_WAVES && !isAttack()) { missionWon(); return; }
    if (st.wave >= MISSION_WAVES) { // útočná misia: horde došli vlny, teraz treba dobyť hrad
      banner('Horde došli sily – zaútoč na hrad!'); AUDIO.play('cleared');
      later(() => { if (st.phase === 'pause') enterBuild(); }, 1400);
      updateHud();
      return;
    }
    banner(hold ? 'Vlna odrazená! +' + bonus + ' zlata · obliehanie trvá' : 'Vlna prežitá! +' + bonus + ' zlata' + (st.lastXp ? ' · kráľ +' + st.lastXp + ' XP' : ''));
    AUDIO.play('cleared');
    later(() => { if (st.phase === 'pause') enterBuild(); }, 1000);
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
    if (st.hallHp >= hallMax()) stats.perfect++;
    st.phase = 'won';
    const t = st.tier || 0, stars = starsFor(st.hallHp / hallMax()), prevStars = starsOf(m, t);
    const nextWasOpen = t < 2 && tierOpen(m, t + 1);
    if (stars > prevStars) { const a = (meta.stars[m - 1] || [0, 0, 0]).slice(); a[t] = stars; meta.stars[m - 1] = a; saveJSON(sk('stars'), meta.stars); }
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
    for (let k = 0; k < 80; k++) part(Math.random() * W, camY + H * 0.3 + Math.random() * 30, (Math.random() - 0.5) * 60, -30 - Math.random() * 60, 1.4, ['#f8d048', '#fff070', '#88b4ff', '#e84838'][k % 4], 60);
    const text = m === MISSIONS.length
      ? 'Porazil si poslednú hordu. <b>Ostrov je oslobodený!</b>'
      : 'Misia ' + m + ' · ' + MISSIONS[m - 1].name + ' · ' + TIERS[t].name.toLowerCase() + ' úroveň<br>Všetkých ' + MISSION_WAVES + ' vĺn odrazených.' + (first ? '<br>Odomkla sa misia ' + (m + 1) + '.<br><span class="newTech">Nové: ' + UNLOCKS[m].map(u => u.name).join(', ') + '</span>' : '');
    const starLine = '<span class="bigStars">' + starSpan(stars, t) + '</span>' +
      (stars > prevStars ? '<br><span class="newTech">+' + (stars - prevStars) + ' ★ do Kráľovskej siene</span>' : '') + tierNote;
    const xpLine = st.lastXp ? '<br><span class="newTech">Kráľ +' + st.lastXp + ' XP' + (kingMeta.pending ? ' · nová úroveň ' + kingMeta.lvl + '!' : '') + '</span>' : '';
    later(() => showOver(m === MISSIONS.length ? 'Víťazstvo!' : 'Misia splnená!', starLine + '<br>' + text + xpLine, true), 1200);
    saveStats(); later(checkAch, 2200);
    updateHud();
  }

  function gameOver() {
    st.phase = 'over';
    saveStats();
    st.hallHp = 0;
    const survived = st.wave - 1;
    $('bossbar').hidden = true; $('bottom').hidden = true;
    const hr = hallRect();
    for (let k = 0; k < 60; k++) {
      part(hr.x0 + Math.random() * (hr.x1 - hr.x0), hr.y0 - 10 + Math.random() * 40, (Math.random() - 0.5) * 50, -Math.random() * 50, 1.3, ['#6a6a78', '#3e3e4c', '#f89838', '#d83818'][k % 4], 60);
    }
    st.shake = 0.6;
    AUDIO.music(null); AUDIO.play('crumble'); setTimeout(() => AUDIO.play('lose'), 500);
    later(() => showOver('Radnica padla!', 'Misia ' + st.mission + ' · ' + MISSIONS[st.mission - 1].name + (st.tier ? ' · ' + TIERS[st.tier].name.toLowerCase() + ' úroveň' : '') + '<br>Prežité vlny: <b>' + survived + ' / ' + MISSION_WAVES + '</b>', false), 1200);
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
    if (d.boss && !(st.boss && st.boss.d.king && !st.boss.dead)) { st.boss = e; $('bossName').textContent = d.name || 'Vojvodca orkov'; if (d.king) banner('Orkský veľkráľ vychádza z hradu!'); AUDIO.play('boss'); }
    return e;
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
    if (e.d.boss) { if (st.boss === e) st.boss = null; st.shake = e.d.king ? 0.8 : 0.4; if (e.d.king) banner('Orkský veľkráľ padol!'); }
    stats.kills++; if (e.d.boss) { if (e.d.king) stats.orcKings++; else stats.bosses++; }
    stats.maxGold = Math.max(stats.maxGold, st.gold);
    checkAch();
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

  // ---- orkský veľkráľ (boss 10. misie): vyjde z hradu pod 50 %, kým žije, hrad nepadne ----
  const KING_STOMP = { cd: 6, r: 28, stun: 2 }, KING_SUMMON = { cd: 9, n: 3, max: 9 };
  function maybeOrcKing(F) {
    if (F.kingOut || st.mission !== MISSIONS.length || F.hp >= F.max * 0.5) return;
    F.kingOut = true;
    const e = spawnEnemy({ type: 'orcKing', hpMul: TIERS[st.tier || 0].hp });
    e.stompT = 3; e.summonT = 4; F.kingE = e;
    st.shake = 0.5;
    for (let k = 0; k < 30; k++) part(F.gateX + (Math.random() - 0.5) * 20, F.gateY - Math.random() * 10, (Math.random() - 0.5) * 50, -Math.random() * 40, 0.8, ['#3c3846', '#625a6c', '#f89838'][k % 3], 90);
    later(() => { if (st.phase === 'battle' && !e.dead) toast('Kým žije veľkráľ, hrad nepadne!'); }, 1800);
  }
  // vráti true, ak veľkráľ tento krok vybavil sám (dupnutie, súboj s vojakom); inak ide ako ostatní k radnici
  function updateOrcKing(e, dt) {
    e.stompT -= dt; e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = KING_SUMMON.cd;
      const mine = st.enemies.filter(o => o.summoned && !o.dead).length;
      for (let k = 0; k < Math.min(KING_SUMMON.n, KING_SUMMON.max - mine); k++) {
        const gob = spawnEnemy({ type: 'goblin', hpMul: (DIFF.missionHp[st.mission - 1] || 3) * TIERS[st.tier || 0].hp * 1.4 });
        const a = Math.random() * 6.28;
        gob.x = e.x + Math.cos(a) * 12; gob.y = e.y + Math.sin(a) * 6; gob.summoned = true;
        for (let q = 0; q < 8; q++) part(gob.x, gob.y - 4, (Math.random() - 0.5) * 24, -Math.random() * 24, 0.6, q % 2 ? '#5aff8a' : '#305c22', 0);
      }
      AUDIO.play('horn');
    }
    let tg = null, td = 90;
    for (const u of st.soldiers) { if (u.dead || u.helper || u.fly) continue; const d = Math.hypot(u.x - e.x, u.y - e.y); if (d < td) { td = d; tg = u; } }
    if (!tg) return false;
    // dupnutie: zraní a omráči všetkých vojakov okolo
    if (e.stompT <= 0 && td < KING_STOMP.r) {
      e.stompT = KING_STOMP.cd; e.lunge = 0.3;
      AUDIO.play('boom'); st.shake = Math.max(st.shake, 0.35);
      for (let k = 0; k < 28; k++) { const a = k / 28 * 6.28; part(e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 3, Math.cos(a) * 60, Math.sin(a) * 30, 0.45, k % 2 ? '#967048' : '#c6a272', 0); }
      for (const u of st.soldiers) if (!u.dead && !u.helper && !u.fly && Math.hypot(u.x - e.x, u.y - e.y) < KING_STOMP.r) { hitUnit(u, e.d.atk * 0.5 * e.pow); u.stunT = KING_STOMP.stun; }
      return true;
    }
    e.attacking = false;
    if (td > 11) { moveTo(e, tg.x, tg.y + 2, e.spd, dt); return true; }
    e.attacking = true;
    e.atk -= dt;
    if (e.atk <= 0) { e.atk = e.d.atkCd; e.lunge = 0.15; AUDIO.play('clang'); hitUnit(tg, e.d.atk * e.pow); }
    return true;
  }

  // medvedí jazdec: nápor do prvého vojaka (odhodí ho a omráči); kopijníci nablízku nápor zastavia
  function bearCharge(e, dt) {
    if (e.charged) { if (!e.foe && !e.attacking) { e.rechargeT = (e.rechargeT || 0) + dt; if (e.rechargeT > 3) e.charged = false; } else e.rechargeT = 0; return; }
    for (const u of st.soldiers) {
      if (u.dead || u.helper || u.siege || u.fly || u.stunT > 0 || Math.hypot(u.x - e.x, u.y - e.y) > 11) continue;
      e.charged = true; e.rechargeT = 0;
      if (st.soldiers.some(s => !s.dead && s.ktype === 'spear' && Math.hypot(s.x - e.x, s.y - e.y) < 22)) { // les kopijí
        e.stunT = 0.9; AUDIO.play('clang');
        st.texts.push({ x: e.x, y: e.y - e.h - 2, s: '!', life: 0.8, max: 0.8 });
        for (let k = 0; k < 6; k++) part(e.x, e.y - 8, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.3, '#f4f4f8', 60);
        return;
      }
      hitUnit(u, e.d.atk * 0.9 * e.pow); // zraní, ale nezabije čerstvého rytiera
      const d = Math.hypot(u.x - e.x, u.y - e.y) || 1;
      u.x += (u.x - e.x) / d * 12; u.y += (u.y - e.y) / d * 12 + 4; u.stunT = 1.2; // odhodený a omráčený
      AUDIO.play('boom'); st.shake = Math.max(st.shake, 0.15);
      for (let k = 0; k < 10; k++) part(u.x, u.y - 4, (Math.random() - 0.5) * 40, -Math.random() * 30, 0.4, k % 2 ? '#c6a272' : '#967048', 80);
      return;
    }
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
    if (e.frostT > 0) { // zasiahnutý mrazom: takmer stojí aj neútočí
      e.frostT -= dt; dt *= 0.12;
      if (Math.random() < 0.3) part(e.x + (Math.random() - 0.5) * e.w * 0.6, e.y - Math.random() * e.h, 0, -4, 0.5, Math.random() < 0.5 ? '#e0f4ff' : '#88c8ff', 0);
    }
    if (e.d.king && updateOrcKing(e, dt)) return;
    if (e.d.charge) bearCharge(e, dt);
    if (e.chillT > 0) { e.chillT -= dt; if (Math.random() < 0.2) part(e.x + (Math.random() - 0.5) * e.w * 0.5, e.y - Math.random() * e.h, 0, -6, 0.4, '#e0f4ff', 0); }
    const slow = e.chillT > 0 ? 0.5 : 1;
    const attackFn = (fn) => {
      e.attacking = true;
      e.atk -= dt * slow;
      if (e.atk <= 0) { e.atk = e.d.atkCd; e.lunge = 0.15; fn(); }
    };
    // vlčí jazdec: prebehne cez líniu (zastavia ho len kopijníci) a ide po lukostrelcoch mimo hradieb
    if (e.d.flank) {
      if (e.foe && e.foe.ktype !== 'spear' && !e.foe.archer) e.foe = null;
      if (!e.foe) {
        const zoneY = tileY(zoneTopRow());
        let tg = null, td = 1e9;
        for (const u of st.soldiers) if (u.archer && !u.dead && u.y < zoneY) { const d = Math.hypot(u.x - e.x, u.y - e.y); if (d < td) { td = d; tg = u; } }
        if (tg) {
          if (td < 9) { attackFn(() => hitUnit(tg, e.d.atk * e.pow)); return; }
          moveTo(e, tg.x, tg.y, e.spd * slow * waterMul(e), dt);
          return;
        }
      }
    }
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
    if (!e.foe && !e.d.ram && !e.d.sapper) for (const s of st.soldiers) if ((s.helper || s.archer) && !s.fly && !s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 9) { e.foe = s; break; }
    if (e.foe) {
      if (Math.hypot(e.foe.x - e.x, e.foe.y - e.y) < 12) { attack(() => hitUnit(e.foe, e.d.atk * 0.7 * 1)); return; }
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
      for (const u of st.soldiers) { const d = Math.hypot(u.x - e.x, u.y - e.y); if (d < (u.fly ? R : td * 0.8)) { td = u.fly ? 0 : d; tgt = u; } } // sokoly zostrelí prednostne
      if (tgt) {
        attackFn(() => {
          let tx, ty;
          if (tgt === HALL) { tx = Math.max(hrr.x0 + 2, Math.min(hrr.x1 - 2, e.x)); ty = hrr.y0 + 4; }
          else if (tgt.kind) { tx = tileX(tgt.c) + T / 2; ty = tileY(tgt.r) + 4; }
          else { tx = tgt.x; ty = tgt.y - (tgt.fly ? 16 : 6); }
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
    u.hp -= dmg * (u.armor || 1); u.flash = 0.08;
    part(u.x, u.y - 6, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.3, '#e84838', 100);
    if (u.hp > 0) return;
    if (u.isKing) { // kráľ padol – do konca vlny nebojuje, po vlne ho možno oživiť za zlato
      u.dead = true; u.deadT = 0; u.tgt = null; u.flash = 0;
      for (let k = 0; k < 10; k++) part(u.x, u.y - 6, (Math.random() - 0.5) * 40, -Math.random() * 40, 0.6, '#f8d048', 80);
      AUDIO.play('crumble');
      slowmoT = SLOWMO_DUR;
    } else {
      u.dead = true;
      for (let k = 0; k < 8; k++) part(u.x, u.y - 6, (Math.random() - 0.5) * 40, -Math.random() * 40, 0.5, ['#3c64c8', '#bcc0cc', '#e84838'][k % 3], 120);
    }
  }

  function priorityEnemy(x, y, rad, prio) {
    let best = null, bd = 1e9;
    for (const e of st.enemies) {
      if (e.dead || e.d.fly || !prio(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= rad && d < bd) { bd = d; best = e; }
    }
    return best;
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
  const blockedBarracks = () => st.blds.filter(b => (UNIT_HOME[b.kind] || b.kind === 'range') && knightsBlocked(b));

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
    // jazdec si vyberá strelcov, šamanov a podkopníkov; ostatní najbližšieho
    if (!u.tgt && u.ktype === 'rider') u.tgt = priorityEnemy(homeX, homeY, aggro, RIDER_PRIO);
    if (u.ktype === 'spear' && !(u.tgt && u.tgt.d.cav)) { const c = priorityEnemy(u.x, u.y, 90, e => e.d.cav); if (c) u.tgt = c; } // kopijník vyráža proti jazde
    if (!u.tgt) u.tgt = nearestEnemy(homeX, homeY, aggro, true);
    const t = u.tgt;
    const cry = st.cryT > 0 ? 1 : 0, spd = (u.spd || 26) * (1 + 0.4 * cry) * waterMul(u);
    if (cry) dmg *= 1.6;
    if (t) {
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      const spear = u.ktype === 'spear', reach = spear ? SPEAR_REACH : 8, off = spear ? 12 : 5; // kopijník bodá spoza rytiera
      if (d > reach) { go(u, t.x + (u.x < t.x ? -off : off), t.y + 1, spd, dt); u.run = (u.run || 0) + spd * dt; }
      else {
        if (!t.foe) t.foe = u;
        if (u.cd <= 0) {
          u.cd = u.isKing ? 0.8 * (1 - 0.12 * tal('swift')) : 0.8; u.swing = 0.15;
          AUDIO.play(u.isKing ? 'kingHit' : 'clang');
          let mul = 1;
          if (spear && t.d.cav) mul *= SPEAR_VS_CAV;                                   // kopija proti jazde
          if (u.ktype === 'rider' && (u.run || 0) >= CHARGE_RUN) {                      // úder po rozbehu
            mul *= RIDER_CHARGE;
            for (let k = 0; k < 6; k++) part(t.x, t.y - 6, (Math.random() - 0.5) * 40, -Math.random() * 30, 0.35, k % 2 ? '#f8d048' : '#ffffff', 60);
          }
          u.run = 0;
          if (cleave) { for (const e of st.enemies) if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < 10) damage(e, dmg); }
          else damage(t, dmg * mul);
        }
      }
    } else { go(u, homeX, homeY, spd * 0.85, dt); u.run = (u.run || 0) + spd * dt * 0.85; }
    u.swing = Math.max(0, (u.swing || 0) - dt);
  }

  // kasárne v intervaloch vyšlú rytiera, ktorý ide oproti horde
  function updateBarracks(b, dt) {
    b.spawnT -= dt;
    if (b.spawnT > 0) return;
    const alive = st.soldiers.filter(s => s.home === b && !s.extra).length;
    if (alive >= knightCap(b)) { b.spawnT = 0.5; return; }
    b.spawnT = knightEvery(b);
    spawnKnight(b, false);
  }
  function spawnKnight(b, extra) {
    const c = bCenter(b);
    const ktype = UNIT_HOME[b.kind] || 'knight', kt = KTYPES[ktype], khp = knightHp(b) * kt.hp;
    st.soldiers.push({ home: b, extra, x: c.x + 1, y: tileY(b.r) + T + 1, hp: khp, max: khp, dmg: knightDmg(b) * kt.dmg, spd: kt.spd, spr: kt.spr, ktype, cd: 0, tgt: null, anim: 0, flash: 0, dead: false, slot: st.soldierN++ });
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
  function shoot(cx, cy, ox, oy, rng, proj, speed, dmg, splash, prio) {
    const c = { x: cx, y: cy };
    let best = null, bd = 1e9;
    for (const e of st.enemies) {
      if (e.dead || e.y < 4) continue;
      if (Math.hypot(e.x - c.x, e.y - c.y) > rng) continue;
      const t = tileAt(e.x, e.y), v = (st.dist[t.r * G.cols + t.c] || 0) - (prio && prio(e) ? 1e6 : 0); // prednostné ciele
      if (v < bd) { bd = v; best = e; }
    }
    if (!best) return false;
    const p = { k: proj, x: ox, y: oy, tgt: best, tx: best.x, ty: best.y - best.h * 0.5, dmg, spd: speed, splash, vx: 0, vy: -1 };
    if (p.k === 'fire') p.tgt = null;
    st.proj.push(p);
    AUDIO.play(proj === 'farrow' ? 'arrow' : proj);
    return true;
  }

  // ---- sokoly: lietajú ponad všetko, lovia letcov, šamanov a podkopníkov; pechota na ne nedosiahne ----
  const FALCON_PRIO = e => e.d.fly || e.d.heals || e.d.sapper;
  const falconCap = b => 1 + b.lvl;
  const falconHp = b => 22 * lvlMul(b, 0.3) * (1 + 0.2 * perk('drill'));
  const falconDmg = b => 5 * lvlMul(b, 0.35) * (1 + 0.2 * perk('drill'));
  function updateFalconry(b, dt) {
    b.spawnT -= dt;
    if (b.spawnT > 0) return;
    if (st.soldiers.filter(s => s.home === b).length >= falconCap(b)) { b.spawnT = 0.5; return; }
    b.spawnT = Math.max(4, 8 - 0.8 * (b.lvl - 1));
    const c = bCenter(b), hp = falconHp(b);
    st.soldiers.push({ home: b, fly: true, x: c.x, y: tileY(b.r) + 4, hp, max: hp, dmg: falconDmg(b), spd: 52, cd: 0.3, tgt: null, anim: Math.random() * 2, flash: 0, dead: false, slot: st.soldierN++ });
    for (let k = 0; k < 5; k++) part(c.x, tileY(b.r), (Math.random() - 0.5) * 20, -Math.random() * 20, 0.4, '#d8c0a0', 20);
  }
  function updateFalcon(u, dt) {
    u.flash = Math.max(0, u.flash - dt); u.cd = Math.max(0, u.cd - dt); u.swing = Math.max(0, (u.swing || 0) - dt);
    u.anim += dt * 9;
    if (u.tgt && (u.tgt.dead || (!FALCON_PRIO(u.tgt) && u.retarget-- <= 0))) u.tgt = null;
    if (!u.tgt || !FALCON_PRIO(u.tgt)) { // prednostný cieľ kdekoľvek na bojisku, inak najbližší nepriateľ
      let best = null, bd = 1e9, bestP = false;
      for (const e of st.enemies) {
        if (e.dead || e.y < 4) continue;
        const p = !!FALCON_PRIO(e), d = Math.hypot(e.x - u.x, e.y - u.y);
        if ((p && !bestP) || (p === bestP && d < bd)) { best = e; bd = d; bestP = p; }
      }
      if (best) { u.tgt = best; u.retarget = 30; }
    }
    const t = u.tgt;
    if (t) {
      const ty = t.y - (t.d.fly ? 0 : 4);
      if (Math.hypot(t.x - u.x, ty - u.y) > 5) { moveTo(u, t.x, ty, u.spd, dt); return; }
      if (u.cd <= 0) { u.cd = 0.8; u.swing = 0.15; AUDIO.play('hit'); damage(t, u.dmg * (t.d.fly ? 2 : 1)); } // netopiere roztrhá
      return;
    }
    // nič na love: krúži nad svojou sokoliarňou (v útoku nad vojskom)
    const lead = st.fort ? st.soldiers.filter(s => !s.dead && !s.fly && !s.helper).sort((a, b) => a.y - b.y)[0] : null;
    const c = lead || (u.home && st.blds.includes(u.home) ? bCenter(u.home) : { x: G.hallCx, y: G.hallTop });
    const a = performance.now() / 700 + u.slot;
    moveTo(u, c.x + Math.cos(a) * 12, c.y - 10 + Math.sin(a) * 5, u.spd * 0.6, dt);
  }
  function drawFalcon(u, time) {
    const fr = SPR.falcon[Math.floor(u.anim) % 2], bob = Math.sin(time * 5 + u.slot) * 1.5;
    shadow(u.x, u.y + 2, 3);
    g.drawImage(u.flash > 0 ? fr.f : fr.c, Math.round(u.x - fr.w / 2), Math.round(u.y - 14 + bob - (u.swing > 0 ? -3 : 0)));
  }

  // strelnica v intervaloch vyšle lukostrelca (najviac archerCap naraz)
  function updateRange(b, dt) {
    b.spawnT -= dt;
    if (b.spawnT > 0) return;
    if (st.soldiers.filter(s => s.home === b && !s.extra).length >= archerCap(b)) { b.spawnT = 0.5; return; }
    b.spawnT = archerEvery(b);
    spawnArcher(b, false);
  }
  function spawnArcher(b, extra) {
    const c = bCenter(b), hp = archerHp(b);
    st.soldiers.push({ home: b, archer: true, extra, x: c.x + 1, y: tileY(b.r) + T + 1, hp, max: hp, dmg: archerDmg(b), spd: 24, spr: 'footArcher', cd: 0.3, tgt: null, anim: 0, flash: 0, dead: false, slot: st.soldierN++ });
    for (let k = 0; k < 4; k++) part(c.x, tileY(b.r) + T, (Math.random() - 0.5) * 20, -Math.random() * 10, 0.3, '#c6a272', 40);
  }
  // lukostrelec: stojí kúsok za rytiermi a strieľa na najbližšiu hordu v dosahu; keď nikto nie je v dosahu, ide na svoje miesto
  function updateArcher(u, dt, hx, hy) {
    u.flash = Math.max(0, u.flash - dt);
    u.cd = Math.max(0, u.cd - dt);
    let near = false;
    for (const e of st.enemies) if (!e.dead && e.y > 4 && Math.hypot(e.x - u.x, e.y - u.y) <= ARCHER_RANGE) { near = true; break; }
    if (near) {
      if (u.cd <= 0 && shoot(u.x, u.y, u.x, u.y - 9, ARCHER_RANGE, 'arrow', 180, u.dmg, 0, ARCHER_PRIO)) { u.cd = ARCHER_CD; u.swing = 0.1; }
      u.swing = Math.max(0, (u.swing || 0) - dt);
      return;
    }
    if (st.fort) { // útočná misia: strieľa na stavby pevnosti, inak sa k nim priblíži
      const o = fortTarget(u);
      if (!o) return;
      const ox = o.x, oy = o === st.fort ? st.fort.y - 16 : o.y - 8, d = Math.hypot(ox - u.x, oy - u.y);
      if (d <= ARCHER_RANGE) {
        if (u.cd <= 0) { u.cd = ARCHER_CD; st.proj.push({ k: 'arrow', x: u.x, y: u.y - 9, tgt: null, tx: ox + (Math.random() - 0.5) * 8, ty: oy, dmg: u.dmg, spd: 180, splash: 0, vx: 0, vy: -1, fortT: o }); AUDIO.play('arrow'); }
        return;
      }
      const sp = (u.spd || 24) * waterMul(u);
      if (u.y < FORT.palY + 40) moveTo(u, ox, oy + ARCHER_RANGE - 8, sp, dt); else moveKnight(u, ox, oy + ARCHER_RANGE - 8, sp, dt);
      return;
    }
    // obrana: nikto v dosahu – priblíž sa k najbližšej horde na dostrel, inak sa vráť na svoje miesto
    let tg = null, td = 1e9;
    for (const e of st.enemies) { if (e.dead || e.y <= 4) continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < td) { td = d; tg = e; } }
    if (tg) {
      const k = (ARCHER_RANGE - 10) / td;
      moveKnight(u, tg.x + (u.x - tg.x) * k, tg.y + (u.y - tg.y) * k, (u.spd || 24) * waterMul(u), dt);
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
    }
  }

  // ---- kúzla ----
  function selectSpell(id) {
    if (st.phase !== 'battle' || !spellOn(id)) return;
    if (st.spellSel === id) { st.spellSel = null; AUDIO.play('click'); return; }
    if (st[SPELLS[id].cdKey] > 0) { AUDIO.play('deny'); return; }
    st.spellSel = id; AUDIO.play('click');
    if (!st.spellHint) { st.spellHint = true; hint('Ťukni na bojisko, kam má kúzlo dopadnúť'); }
  }
  // ťuk na bojisko počas boja: zvolené kúzlo sa zošle na to miesto
  function tapBattle(x, y) {
    const id = st.spellSel;
    if (!id) return;
    if (castSpell(id, x, y)) st.spellSel = null;
  }
  function castSpell(id, x, y) {
    if (st.phase !== 'battle' || !spellOn(id) || st[SPELLS[id].cdKey] > 0) { AUDIO.play('deny'); return false; }
    if (id === 'volley') { volley(x, y); return true; }
    const sp = SPELLS[id], pow = spellPow();
    if (id === 'fireball') { // guľa padá z neba a vybuchne
      st.fallFx.push({ x, y, t: 0.35, max: 0.35 });
      AUDIO.play('fire');
    } else if (id === 'freeze') {
      const dur = sp.dur + 1.5 * tal('frost');
      for (const e of st.enemies) if (!e.dead && Math.hypot(e.x - x, (e.y - y) / 0.7) < sp.R) e.frostT = Math.max(e.frostT || 0, dur);
      for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, r = Math.random() * sp.R; part(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, (Math.random() - 0.5) * 10, -6 - Math.random() * 10, 0.9, ['#ffffff', '#e0f4ff', '#88c8ff'][k % 3], 0); }
      st.marks.push({ x, y, life: 0.6, max: 0.6, ice: true });
      AUDIO.play('unlock'); banner('Mráz!');
    } else if (id === 'lightning') { // zasiahne najbližšieho nepriateľa a preskočí na ďalších dvoch
      const near = (px, py, skip) => { let b = null, bd = sp.reach; for (const e of st.enemies) { if (e.dead || skip.includes(e)) continue; const d = Math.hypot(e.x - px, e.y - py); if (d < bd) { bd = d; b = e; } } return b; };
      const hit = [];
      let cur = near(x, y, hit);
      if (!cur) { hint('Blesk treba zoslať na nepriateľa'); AUDIO.play('deny'); return false; }
      const pts = [{ x: cur.x + 6, y: Math.max(0, cur.y - 120) }];
      for (let n = 0; n < 3 && cur; n++) { hit.push(cur); pts.push({ x: cur.x, y: cur.y - cur.h * 0.5 }); cur = near(cur.x, cur.y, hit); }
      hit.forEach((e, n) => { damage(e, (n ? 21 : 35) * pow); e.stunT = Math.max(e.stunT || 0, 0.4); });
      st.bolts.push({ pts, life: 0.3, max: 0.3 });
      AUDIO.play('bolt'); AUDIO.play('boom'); st.shake = Math.max(st.shake, 0.15);
    }
    st[sp.cdKey] = sp.cd;
    return true;
  }
  // výbuch ohnivej gule
  function fireballBlast(x, y) {
    const sp = SPELLS.fireball, pow = spellPow();
    for (const e of st.enemies) {
      if (e.dead || Math.hypot(e.x - x, (e.y - y) / 0.7) > sp.R) continue;
      e.burnT = 3; e.burnDps = Math.max(e.burnDps || 0, 4 * pow);
      damage(e, 20 * pow);
    }
    for (let k = 0; k < 46; k++) { const a = Math.random() * 6.28, v = 20 + Math.random() * 60; part(x, y - 3, Math.cos(a) * v, Math.sin(a) * v * 0.6 - 25, 0.35 + Math.random() * 0.4, ['#fff7c8', '#f8d048', '#f89838', '#d83818', '#3e2614'][k % 5], 60); }
    AUDIO.play('boom'); st.shake = Math.max(st.shake, 0.3);
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
    updateFort(dt);
    separate();
    // budovy
    for (const b of st.blds) {
      b.flash = Math.max(0, b.flash - dt);
      if (b.kind === 'tower' || b.kind === 'mage') { b.cd -= dt; if (b.cd <= 0 && fireFrom(b)) b.cd = bCd(b); }
      else if (b.kind === 'catapult') { b.cd -= dt; if (b.cd <= 0 && fireCatapult(b)) b.cd = bCd(b); }
      else if (b.unit) { b.unit.cd -= dt; if (b.unit.cd <= 0 && fireWallUnit(b)) b.unit.cd = uCd(b.unit); }
      else if (UNIT_HOME[b.kind]) updateBarracks(b, dt);
      else if (b.kind === 'range') updateRange(b, dt);
      else if (b.kind === 'falconry') updateFalconry(b, dt);
      else if (HELPERS[b.kind]) updateHelperHome(b, dt);
      else if (b.kind === 'beartrap' && b.armT > 0) b.armT -= dt;
    }
    // rytieri
    // rytieri: pochodujú pred zónu a bijú sa s najbližšou hordou (kým bojujú, horda stojí)
    const musterY = musterYOf();
    for (const s of st.soldiers) {
      if (s.dead) continue;
      if (s.stunT > 0) { s.stunT -= dt; s.flash = Math.max(0, s.flash - dt); continue; } // omráčený dupnutím veľkráľa
      if (s.helper) { updateHelper(s, dt); continue; }
      if (s.fly) { updateFalcon(s, dt); continue; }
      if (s.archer) { updateArcher(s, dt, G.gx0 + ((s.slot * 37 + 18) % (G.cols * T - 16)) + 8, musterY + 16); continue; }
      if (st.fort) { updateAssault(s, dt); continue; }
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
    st.freezeCd = Math.max(0, st.freezeCd - dt); st.fireCd = Math.max(0, st.fireCd - dt); st.boltCd = Math.max(0, st.boltCd - dt);
    for (const f of st.fallFx) { // padajúca ohnivá guľa s chvostom iskier
      f.t -= dt;
      const fy = f.y - 90 * Math.max(0, f.t / f.max), fx = f.x + 30 * Math.max(0, f.t / f.max);
      for (let k = 0; k < 4; k++) part(fx + (Math.random() - 0.5) * 3, fy + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8, -6, 0.3, ['#fff7c8', '#f8d048', '#f89838'][k % 3], 0);
      if (f.t <= 0) { f.done = true; fireballBlast(f.x, f.y); }
    }
    st.fallFx = st.fallFx.filter(f => !f.done);
    for (const b of st.bolts) b.life -= dt;
    st.bolts = st.bolts.filter(b => b.life > 0);
    updateFx(dt);
    if (st.phase === 'battle' && !st.spawnQ.length && !st.enemies.length && (!st.fort || (st.orcWaveOn && !st.fort.dead))) endWave();
  }

  function impact(p) {
    if (p.fortT) { hitFort(p.fortT, p.dmg); return; } // šíp lukostrelca do stavby pevnosti
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
    const fi = u.siege === 'cat' ? (u.fired > 0 ? 1 : 0) : Math.floor(u.anim) % 2, fr = frames[fi];
    const x = Math.round(u.x - fr.w / 2), y = Math.round(u.y - fr.h - (u.swing > 0 && !u.siege ? 1 : 0)) + (u.siege === 'ram' && u.swing > 0 ? -2 : 0);
    shadow(u.x, u.y, u.siege ? 8 : 4);
    g.drawImage(u.flash > 0 ? fr.f : fr.c, x, y);
    if (sprName === 'craft') drawHammer(u, x, y);
    if (st.cryT > 0 && Math.random() < 0.15) part(u.x + (Math.random() - 0.5) * 8, u.y - 8, 0, -16, 0.4, '#f8d048', 0); // pokrik
    if (u.stunT > 0) { // hviezdičky nad omráčeným
      const t = performance.now() / 1000;
      for (let k = 0; k < 2; k++) { const a = t * 6 + k * 3.14; g.fillStyle = k ? '#fff070' : '#f8d048'; g.fillRect(Math.round(u.x + Math.cos(a) * 4), Math.round(y - 3 + Math.sin(a) * 1.5), 1, 1); }
    }
    if (u.swing > 0 && !u.siege) { // záblesk meča
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
  function drawRock(r) {
    const gx = Math.round(r.x), gy = Math.round(r.gy);
    g.fillStyle = 'rgba(10,8,6,0.35)'; g.fillRect(gx - 2, gy, 5, 1); g.fillRect(gx - 1, gy - 1, 3, 3); // tieň na zemi
    const x = gx - 1, y = Math.round(r.y) - 1;
    g.fillStyle = PAL.K; g.fillRect(x - 1, y, 5, 3); g.fillRect(x, y - 1, 3, 5);
    g.fillStyle = '#4e4858'; g.fillRect(x, y, 3, 3);
    g.fillStyle = '#7a7286'; g.fillRect(x, y, 2, 1); g.fillRect(x, y + 1, 1, 1);
    g.fillStyle = '#22202a'; g.fillRect(x + 2, y + 2, 1, 1);
  }
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
      const m = (joinsV(b.c, b.r - 1) ? 1 : 0) | (joins(b.c + 1, b.r) || edgeR ? 2 : 0) | (joinsV(b.c, b.r + 1) ? 4 : 0) | (joins(b.c - 1, b.r) || edgeL ? 8 : 0);
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
  const joinsV = (c, r) => occAt(c, r) !== HALL && joins(c, r); // na radnicu sa hradby napájajú len z bokov, nie zhora
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
      const j = (c, r) => inPath.has(key(c, r)) || joins(c, r), jv = (c, r) => inPath.has(key(c, r)) || joinsV(c, r);
      g.globalAlpha = 0.65;
      drag.path.forEach((q, i) => {
        const x = tileX(q.c), y = tileY(q.r);
        const m = (jv(q.c, q.r - 1) ? 1 : 0) | (j(q.c + 1, q.r) ? 2 : 0) | (jv(q.c, q.r + 1) ? 4 : 0) | (j(q.c - 1, q.r) ? 8 : 0);
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

  // blesk: lomená čiara z neba cez zasiahnutých nepriateľov (biele jadro, žltý okraj)
  function drawBolt(b) {
    g.globalAlpha = Math.min(1, b.life / b.max * 1.6);
    for (let i = 1; i < b.pts.length; i++) {
      const a = b.pts[i - 1], c = b.pts[i], n = Math.max(2, Math.round(Math.hypot(c.x - a.x, c.y - a.y) / 3));
      let px = a.x, py = a.y;
      for (let k = 1; k <= n; k++) {
        const t = k / n, j = k < n ? (Math.random() - 0.5) * 6 : 0;
        const nx = a.x + (c.x - a.x) * t + j, ny = a.y + (c.y - a.y) * t;
        const steps = Math.max(1, Math.round(Math.hypot(nx - px, ny - py)));
        for (let s = 0; s <= steps; s++) {
          const x = Math.round(px + (nx - px) * s / steps), y = Math.round(py + (ny - py) * s / steps);
          g.fillStyle = '#f8e048'; g.fillRect(x - 1, y, 3, 1);
          g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
        }
        px = nx; py = ny;
      }
    }
    g.globalAlpha = 1;
  }
  function drawMark(m) {
    const t = 1 - m.life / m.max;
    const r = m.no ? 4 : m.ice ? 8 + t * 18 : 6 + t * 10;
    g.fillStyle = m.no ? 'rgba(232,72,56,0.8)' : m.ice ? 'rgba(200,232,255,' + (0.9 * (1 - t)) + ')' : 'rgba(255,240,112,' + (0.9 * (1 - t)) + ')';
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
    const y0 = Math.max(0, Math.min(buf.height - H, Math.round(camY))), rows = Math.min(H, buf.height);
    const id = g.getImageData(0, y0, W, rows), d = id.data;
    let i = 0;
    for (let y = 0; y < rows; y++) {
      const by = ((y + y0) & 3) * 4;
      for (let x = 0; x < W; x++, i += 4) {
        const t = by + (x & 3);
        d[i] = QLUT[d[i] * 16 + t]; d[i + 1] = QLUT[d[i + 1] * 16 + t]; d[i + 2] = QLUT[d[i + 2] * 16 + t];
      }
    }
    g.putImageData(id, 0, y0);
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
      g.drawImage(f.c, n.x - Math.floor(f.w / 2), n.y - f.h + 2);
      top = n.y - f.h + 2;
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
    const L = { blue: [], red: [] };
    for (let i = 0; i < n; i++) for (const key of ['blue', 'red']) {
      const c = mk(), x = c.getContext('2d'), id = x.createImageData(W, H), [r, gg, b, a] = PROV_COL[key];
      for (let k = 0; k < P.length; k++) if (P[k] === i) { id.data[k * 4] = r; id.data[k * 4 + 1] = gg; id.data[k * 4 + 2] = b; id.data[k * 4 + 3] = a * 255; }
      x.putImageData(id, 0, 0); L[key][i] = c;
    }
    island.layers = L;
    return L;
  }
  // kto drží provinciu: ľudia (juh a dobyté) alebo horda; počas animácie dobytia ešte pôvodný vlastník
  const provOwner = i => {
    const pa = st.provAnim;
    if (pa && pa.i === i) return pa.from === 'horde' ? 1 : 0;
    return provState(i) === 'horde' ? 1 : 0;
  };
  // hranice: tenké prerušované medzi provinciami, hrubá červená na fronte ľudia × horda (prepočíta sa, keď sa front posunie)
  function borderLayer() {
    const n = island.nodes.length, key = Array.from({ length: n }, (_, i) => provOwner(i)).join('');
    if (island.borderKey === key) return island.border;
    const P = island.prov, own = v => key.charCodeAt(v) - 48;
    const c = island.border || document.createElement('canvas'); c.width = W; c.height = H;
    const bx = c.getContext('2d'), bd = bx.createImageData(W, H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const v = P[y * W + x]; if (v === 255) continue;
      const nbs = [P[y * W + x + 1], P[(y + 1) * W + x]];
      if (!nbs.some(q => q !== 255 && q !== v)) continue;
      const front = nbs.some(q => q !== 255 && own(q) !== own(v)); // hranica ľudia × horda
      const k = (y * W + x) * 4;
      if (front) { bd.data[k] = 120; bd.data[k + 1] = 20; bd.data[k + 2] = 16; bd.data[k + 3] = 220; }
      else if ((x + y) % 3) { bd.data[k] = 28; bd.data[k + 1] = 20; bd.data[k + 2] = 14; bd.data[k + 3] = 120; } // prerušovaná
    }
    bx.putImageData(bd, 0, 0);
    island.border = c; island.borderKey = key;
    return c;
  }
  function drawProvince(i, state, time) {
    const L = provLayers();
    if (state === 'horde') { g.drawImage(L.red[i], 0, 0); return; }
    g.drawImage(L.blue[i], 0, 0);
    if (state === 'attacked') { g.globalAlpha = i + 1 === st.unlocked ? 0.35 + 0.3 * Math.sin(time * 3) : 0.35; g.drawImage(L.red[i], 0, 0); g.globalAlpha = 1; } // pulzuje len najbližšia misia
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
    g.drawImage(borderLayer(), 0, 0);
  }
  // ohne, dym a šípky útoku v napadnutých provinciách
  function drawWarFx(time) {
    island.nodes.forEach((nd, i) => {
      if (provState(i) !== 'attacked' || (st.provAnim && st.provAnim.i === i)) return;
      for (const f of island.fires[i]) drawFlame(f.x, f.y, f.ph, time);
    });
  }
  // plameň po bodoch: zúžený nahor, jazyky sa vlnia, horúce biele jadro dole, tmavočervené okraje a špička
  const FLAME = ['#6a1408', '#b02810', '#d83818', '#f89838', '#f8d048', '#fff7c8'];
  function drawFlame(x, y, ph, time) {
    // žiara na zemi a ohorené miesto
    g.globalAlpha = 0.22 + 0.08 * Math.sin(time * 11 + ph);
    g.fillStyle = '#f89838';
    for (let dx = -3; dx <= 3; dx++) { const w = Math.round(Math.sqrt(9 - dx * dx) * 0.35); g.fillRect(x + dx, y - w, 1, w * 2 + 1); }
    g.globalAlpha = 1;
    g.fillStyle = '#2a1a10'; g.fillRect(x - 1, y + 1, 3, 1);
    const h = 5 + Math.round(Math.sin(time * 9 + ph) * 0.8 + Math.sin(time * 14.3 + ph * 2) * 0.6);
    for (let r = 0; r < h; r++) {
      const t = r / h;
      const half = 1.7 * Math.pow(1 - t, 0.75) + (r < 1 ? 0.3 : 0);
      const cx = x + Math.sin(time * 7 + ph + r * 0.55) * t * 1.2 + Math.sin(time * 3.1 + ph) * t * 0.4;
      for (let px = Math.floor(cx - half - 0.5); px <= Math.ceil(cx + half + 0.5); px++) {
        const d = Math.abs(px - cx) / (half + 0.35);
        if (d > 1) continue;
        const heat = (1 - t) * 0.95 + (1 - d) * 0.55 - 0.35 + Math.sin(time * 17 + px * 1.7 + r) * 0.06;
        const k = heat > 0.9 ? 5 : heat > 0.68 ? 4 : heat > 0.48 ? 3 : heat > 0.28 ? 2 : heat > 0.12 ? 1 : 0;
        g.fillStyle = FLAME[k]; g.fillRect(px, y - r, 1, 1);
      }
    }
    // odletujúce iskry a dym
    if (Math.random() < 0.05) part(x + (Math.random() - 0.5) * 3, y - h, (Math.random() - 0.5) * 6, -10 - Math.random() * 8, 0.6, Math.random() < 0.5 ? '#f8d048' : '#f89838', -4);
    if (Math.random() < 0.04) part(x, y - h - 1, (Math.random() - 0.5) * 4, -6 - Math.random() * 4, 1.8, Math.random() < 0.5 ? '#525262' : '#3e3e4c', -2);
  }

  // ---- lode na mori: na juhu lode ľudí (biela plachta s modrým krížom), na severe orkské (tmavá plachta s červeným znakom) ----
  const SHIP_MAP = [
    '.....KK......',
    '.....KPPK....',
    '.....K.......',
    '...KKKKKK....',
    '..KWWWWWLK...',
    '..KWWBWWLK...',
    '..KWBBBWLK...',
    '..KWWBWWLK...',
    '...KWWWLK....',
    'KK...K....KKK',
    'KHHHHHHHHHHHK',
    '.KhhhhhhhhhK.',
    '..KKKKKKKKK..',
  ];
  const SHIP_PAL = {
    human: { K: '#1c140e', W: '#f4ecd8', L: '#c8bca0', B: '#3c64c8', P: '#3c64c8', H: '#9a6430', h: '#5a3818' },
    orc:   { K: '#140c08', W: '#6a5440', L: '#46382a', B: '#c82818', P: '#c82818', H: '#5a3a20', h: '#3a2414' },
  };
  function shipCanvas(kind, flip) {
    const pal = SHIP_PAL[kind], w = SHIP_MAP[0].length, h = SHIP_MAP.length;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    SHIP_MAP.forEach((row, y) => [...row].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(flip ? w - 1 - i : i, y, 1, 1); } }));
    return c;
  }
  const seaAt = (x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < W && y < H && island.prov[y * W + x] === 255; };
  function initShips() {
    const ships = [], sprites = {};
    for (const k of ['human', 'orc']) sprites[k] = [shipCanvas(k, false), shipCanvas(k, true)];
    const midY = (island.nodes[0].y + island.nodes[island.nodes.length - 1].y) / 2;
    const want = [['human', 1], ['human', 1], ['orc', 0], ['orc', 0]];  // 1 = južná polovica, 0 = severná
    let tries = 0;
    for (const [kind, south] of want) {
      while (tries++ < 4000) {
        const low = H - $('mapBar').offsetHeight * DPR / S - 18;       // nie pod kartami dole
        const x = 8 + Math.random() * (W - 24), y = 14 + Math.random() * (low - 14);
        if ((y > midY) !== !!south || (x < 34 && y < 34)) continue;   // ani pri domčeku vľavo hore
        let ok = true;
        for (let dx = -10; dx <= 22 && ok; dx += 4) for (const dy of [0, 12]) if (!seaAt(x + dx, y + dy)) ok = false;
        if (!ok || ships.some(s => Math.hypot(s.x - x, s.y - y) < 30)) continue;
        ships.push({ kind, x, y, dir: Math.random() < 0.5 ? 1 : -1, spd: 1.6 + Math.random() * 1.4, ph: Math.random() * 6.28 });
        break;
      }
    }
    // orkské lode prejdú na stranu ľudí: tá vpravo hore po dobytí 9. hradu, druhá po oslobodení ostrova
    const orcs = ships.filter(s => s.kind === 'orc').sort((a, b) => (b.x - b.y) - (a.x - a.y));
    orcs.forEach((s, i) => { s.humanFrom = i === 0 ? 10 : 11; });
    island.ships = ships; island.shipSpr = sprites; island.shipT = null;
  }
  function drawShips(time) {
    if (!island.ships) initShips();
    const dt = island.shipT == null ? 0 : Math.min(0.1, time - island.shipT); island.shipT = time;
    for (const s of island.ships) {
      // pláva, kým má pred sebou vodu; pri brehu alebo okraji sa otočí
      const bow = s.dir > 0 ? s.x + 15 : s.x - 3;
      if (!seaAt(bow, s.y + 10) || !seaAt(bow, s.y + 4)) s.dir *= -1;
      else s.x += s.dir * s.spd * dt;
      const bob = Math.sin(time * 2.2 + s.ph) > 0.3 ? 1 : 0, x = Math.round(s.x), y = Math.round(s.y) + bob;
      // brázda za loďou
      const stern = s.dir > 0 ? x - 1 : x + 13;
      for (let k = 0; k < 5; k++) {
        if (Math.sin(time * 6 + k * 1.3 + s.ph) < 0) continue;
        g.globalAlpha = 0.7 - k * 0.12; g.fillStyle = '#e8f8ff';
        g.fillRect(stern - s.dir * k * 2, y + 11 + (k & 1), 1, 1);
      }
      g.globalAlpha = 0.35; g.fillStyle = '#08142e'; g.fillRect(x + 1, y + 12, 11, 1); g.globalAlpha = 1; // tieň na vode
      const kind = s.humanFrom && st.unlocked >= s.humanFrom ? 'human' : s.kind;
      g.drawImage(island.shipSpr[kind][s.dir > 0 ? 0 : 1], x, y);
    }
  }
  function renderMap(time) {
    g.drawImage(island.bg, 0, 0);
    drawProvinces(time);
    // príboj
    g.fillStyle = 'rgba(240,250,255,0.85)';
    for (const f of island.foam) if (Math.sin(time * 1.8 + f.ph) > 0.55) g.fillRect(f.x, f.y, 1, 1);
    // hrebene vĺn na otvorenom mori: krátke svetlé čiarky, pomaly plávajú a objavujú sa/miznú
    for (const w of island.waves) {
      const a = Math.sin(time * 0.9 + w.ph);
      if (a < 0.2) continue;
      const x = Math.round(w.x + Math.sin(time * 0.35 + w.ph) * 2);
      g.globalAlpha = Math.min(1, (a - 0.2) * 1.6);
      g.fillStyle = '#8ad0e8'; g.fillRect(x, w.y, w.len, 1);
      g.fillStyle = '#e8f8ff'; g.fillRect(x + 1, w.y, Math.max(1, w.len - 2), 1);
      g.fillStyle = '#163a7a'; g.fillRect(x, w.y + 1, w.len, 1);
      g.globalAlpha = 1;
    }
    drawShips(time);
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
    sctx.drawImage(buf, 0, 0, W, buf.height, sx * S, (sy - Math.round(camY)) * S, W * S, buf.height * S);
  }
  // cieľový posun kamery: v stavaní o výšku panela, v boji o spodné tlačidlá
  // ---- posúvanie mapy prstom ----
  let mapCam = 0, mapCamTarget = 0, mapDrag = null;
  const MAP_HEAD = 26; // hlavička mapy (v herných px)
  function mapCamMax() {
    if (!island) return 0;
    const panelLow = $('mapBar').offsetHeight * DPR / S;
    const lowest = Math.max(...island.nodes.map(n => n.y)) + 22; // hrad + tabuľka s hviezdami
    return Math.max(0, lowest - (H - panelLow) + 4);
  }
  const clampMap = v => Math.max(0, Math.min(mapCamMax(), v));
  function focusMapNode(num, instant) {
    const n = island && island.nodes[num - 1];
    if (!n) return;
    const panelLow = $('mapBar').offsetHeight * DPR / S;
    const mid = MAP_HEAD + (H - panelLow - MAP_HEAD) / 2;
    mapCamTarget = clampMap(n.y - 6 - mid);
    if (instant) mapCam = mapCamTarget;
  }

  const panelLow = () => $('build').offsetHeight * DPR / S;
  const INTRO_PAN = [0.5, 1.4, 1.6, 1.2]; // s: čakanie, prelet hore, pohľad na hrad, návrat
  function camTick(dt) {
    if (st.phase === 'title') { camY = 0; return; }
    if (st.phase === 'map') {
      if (!mapDrag) mapCam += (mapCamTarget - mapCam) * Math.min(1, dt * 8);
      camY = mapCam;
      return;
    }
    // pri budovaní posuň bojisko nad panel; v boji nie – spodné tlačidlá sú priehľadné nad mapou
    // potiahnutím mapy nadol sa ukáže vrch bojiska (pevnosť); viewUp = o koľko je pohľad vyššie než pri radnici
    const full = st.phase === 'build' && !$('build').hidden ? panelLow() : 0;
    st.viewUp = Math.max(0, Math.min(full + camBase(), st.viewUp || 0));
    let target = camBase() + full - st.viewUp;
    if (st.introPan && (vscroll || st.phase !== 'build')) st.introPan = null; // ťuk/ťah prelet preruší
    if (st.introPan) { // čakanie, prelet hore, pohľad na hrad, návrat
      const P = INTRO_PAN, t = (st.introPan.t += dt), ease = x => x * x * (3 - 2 * x);
      const k = t < P[0] ? 0 : t < P[0] + P[1] ? ease((t - P[0]) / P[1]) : t < P[0] + P[1] + P[2] ? 1 : ease(Math.max(0, 1 - (t - P[0] - P[1] - P[2]) / P[3]));
      camY = target * (1 - k);
      if (t >= P[0] + P[1] + P[2] + P[3]) st.introPan = null;
      return;
    }
    if (vscroll) camY = target;
    target = Math.min(target, Math.max(0, FH - 60));
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
      if (Math.random() < 0.3) part(Math.random() * W, FH * (0.2 + Math.random() * 0.6), (Math.random() - 0.5) * 8, -6 - Math.random() * 10, 1.6, Math.random() < 0.5 ? '#f89838' : '#d83818', -3);
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
    if (st.phase === 'title') return; // menu má za pozadím úvodný obrázok, plátno sa nekreslí
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
      for (const b of st.blds) if (!TRAPS[b.kind]) objs.push({ y: tileY(b.r) + T - (b.kind === 'wall' ? 0.5 : 0), x: b.c, f: () => drawBuilding(b, time) });
      for (const s of st.soldiers) objs.push(s.fly ? { y: 9990, f: () => drawFalcon(s, time) } : { y: s.y, f: () => drawFighter(s, s.spr || 'soldier') });
      if (st.king && !st.king.dead) objs.push({ y: st.king.y, f: () => drawFighter(st.king, 'king') });
      else if (st.king && st.king.deadT < KING_GONE) objs.push({ y: st.king.y, f: () => drawDeadKing(st.king, time) });
    }
    for (const e of st.enemies) objs.push({ y: e.y, f: () => drawEnemy(e, time) });
    if (st.fort) {
      const F = st.fort, keep = BSPR.orcKeep;
      if (!F.dead) objs.push({ y: F.y, f: () => drawFortKeep(F, time) });
      for (const t of F.towers) if (t.hp > 0) objs.push({ y: t.y, f: () => { const s2 = BSPR.orcTower; g.drawImage(t.flash > 0 ? s2.f : s2.c, Math.round(t.x - s2.w / 2), t.y - s2.h); } });
      for (const q of F.pal) if (q.hp > 0) objs.push({ y: q.y, f: () => { const s2 = F.stone ? (q.gate ? BSPR.orcWallGate : BSPR.orcWall) : q.gate ? BSPR.palisadeGate : BSPR.palisade; g.drawImage(q.flash > 0 ? s2.f : s2.c, q.x - 8, q.y - s2.h); } });
      for (const q of F.stakes) if (q.hp > 0) objs.push({ y: q.y, f: () => g.drawImage(BSPR.stakes.c, q.x - 8, q.y - BSPR.stakes.h) });
      for (const r of F.rocks.concat(F.prock)) objs.push({ y: 9999, f: () => drawRock(r) });
    }
    objs.sort((a, b) => a.y - b.y || (b.x || 0) - (a.x || 0)); // v rovnakom rade je ľavejšia budova vpredu
    for (const o of objs) o.f();
    if (st.phase === 'build') drawPlaceGhost(time);
    // ukazovatele zdravia
    for (const e of st.enemies) if (e.hp < e.max && !e.d.boss) bar(e.x, Math.round(e.y - e.h - 3), Math.max(6, e.w - 4), e.hp / e.max, '#e84838');
    for (const b of st.blds) if (BUILD[b.kind].hp && b.hp < bMaxHp(b)) bar(tileX(b.c) + T / 2, b.kind === 'wall' ? tileY(b.r) - 9 : tileY(b.r) + T - bsprOf(b.kind, b.lvl).h - 2, 12, b.hp / bMaxHp(b), '#9cd45a');
    for (const s of st.soldiers) if (s.hp < s.max) bar(s.x, Math.round(s.y - 17), 8, s.hp / s.max, '#88b4ff');
    if (st.fort && !st.fort.dead) {
      const F = st.fort;
      bar(F.x, F.y - BSPR.orcKeep.h - 4, 40, F.hp / F.max, '#e84838');
      for (const t of F.towers) if (t.hp > 0 && t.hp < t.max) bar(t.x, t.y - 37, 12, t.hp / t.max, '#e84838');
      for (const q of F.pal) if (q.hp > 0 && q.hp < q.max) bar(q.x, q.y - (F.stone ? 24 : 21), 12, q.hp / q.max, '#e84838');
      for (const q of F.stakes) if (q.hp > 0 && q.hp < q.max) bar(q.x, q.y - 11, 10, q.hp / q.max, '#e84838');
    }
    if (st.king && !st.king.dead && st.king.hp < kingMax()) bar(st.king.x, Math.round(st.king.y - 19), 10, st.king.hp / kingMax(), '#f8d048');
    for (const p of st.proj) drawProj(p);
    for (const p of st.eproj) { // šíp goblina (tmavý)
      const cols = ['#bcc0cc', '#3e2614', '#3e2614', '#3e2614', '#62a03a'];
      for (let k = 0; k < 5; k++) { g.fillStyle = cols[k]; g.fillRect(Math.round(p.x - p.vx * k), Math.round(p.y - p.vy * k), 1, 1); }
    }
    for (const dr of st.drops) drawDrop(dr);
    drawFog(time);
    for (const b of st.bolts) drawBolt(b);
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
    for (const [id, key] of [['buyKnight', 'knight'], ['buyArcher', 'archer']]) { // tlačidlá nákupu len keď stojí príslušná budova
      const el = $(id), u = BUY[key], exists = st.blds.some(b => b.kind === u.kind);
      el.hidden = !exists;
      if (exists) el.disabled = st.gold < u.cost;
    }
    for (const [id, key] of [['buyRam', 'ram'], ['buyCat', 'cat']]) {
      const el = $(id), ok = canSiege(key);
      el.hidden = !ok;
      if (ok) el.disabled = st.gold < BUY[key].cost || siegeCount(key) >= SIEGE_MAX;
    }
    const k = st.king, kp = $('hud-king');
    if (k) {
      const r = k.dead ? 0 : Math.max(0, k.hp / kingMax());
      $('kingFill').style.width = (r * 100) + '%';
      kp.classList.toggle('dead', !!k.dead);
      kp.classList.toggle('hurt', !k.dead && r < 0.35 && st.phase === 'battle');
    }
    for (const [id, cd, max] of [['warcry', st.cryCd, ABIL.warcry.cd]]) {
      const el = $(id + 'Btn');
      el.hidden = !has(id);
      const pp = cd > 0 ? 1 - cd / max : 1;
      el.style.setProperty('--p', (pp * 100) + '%');
      el.classList.toggle('ready', pp >= 1);
    }
    for (const b of document.querySelectorAll('.spell')) {
      const id = b.dataset.spell, sp = SPELLS[id], cd = st[sp.cdKey] || 0;
      b.hidden = !spellOn(id);
      const p = cd > 0 ? 1 - cd / spellMax(id) : 1;
      b.style.setProperty('--p', (p * 100) + '%');
      b.classList.toggle('ready', p >= 1 && st.spellSel !== id);
      b.classList.toggle('sel', st.spellSel === id);
    }
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
    for (const k of ['catapult', 'mine', 'chapel', 'firepit', 'beartrap', 'workshop', 'range', 'stables', 'armory', 'falconry']) ICONS[k] = spriteURL(BSPR[k], 3);
    ICONS.gate = spriteURL(BSPR.gateIcon, 3);
    ICONS.u_archer = spriteURL(SPR.archer[0], 3);
    ICONS.u_crossbow = spriteURL(SPR.knight[0], 3);
    ICONS.hall = spriteURL(BSPR.hall[2], 2);
    ICONS.king = spriteURL(SPR.king[0], 3);
    ICONS.u_knight = spriteURL(SPR.soldier[0], 3); ICONS.u_footArcher = spriteURL(SPR.footArcher[0], 3);
    $('buyKnight').querySelector('img').src = ICONS.u_knight; $('buyArcher').querySelector('img').src = ICONS.u_footArcher;
    ICONS.u_siegeRam = spriteURL(SPR.siegeRam[0], 2); ICONS.u_siegeCat = spriteURL(SPR.siegeCat[0], 2);
    $('buyRam').querySelector('img').src = ICONS.u_siegeRam; $('buyCat').querySelector('img').src = ICONS.u_siegeCat;
    $('kingIcon').src = ICONS.king;
    $('icoHall').src = UI_ICONS.hall; $('icoHero').src = ICONS.king;
    for (const k of ['orc', 'garcher', 'bat', 'ram', 'shaman', 'sapper', 'orcKing', 'bear', 'wolf']) ICONS['e_' + k] = spriteURL(SPR[k][0], k === 'orcKing' ? 2 : 3);
    ICONS.coin = spriteURL(SPR.coin[0], 4);
    Object.assign(ICONS, { sp_volley: UI_ICONS.spellVolley, sp_fire: UI_ICONS.spellFire, sp_frost: UI_ICONS.spellFrost, sp_bolt: UI_ICONS.spellBolt });
    const SPI = { volley: 'sp_volley', fireball: 'sp_fire', freeze: 'sp_frost', lightning: 'sp_bolt' };
    document.querySelectorAll('.spell').forEach(b => { b.querySelector('img').src = ICONS[SPI[b.dataset.spell]]; });
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
      } else if (st.mission === 1 && st.hallLvl < lvlCap()) acts.appendChild(btn('🔒 Radnica úr. 3 · od misie 2', null, false, () => { }, 'locked'));
      else if (st.hallLvl < MAX_LVL) acts.appendChild(lockBtn('Radnica úr. ' + (st.hallLvl + 1), 'lvl5'));
      else acts.appendChild(btn('Max. úroveň', null, false, () => { }));
      if (has('volleyUp') && spellOn('volley')) { // salvu má kráľ len ak ju dal do slotu
        const vc = volleyUpCost();
        acts.appendChild(btn('Salva úr. ' + (st.volleyLvl + 1), vc, st.gold >= vc, () => { st.gold -= vc; st.volleyLvl++; }));
      } else if (!has('volleyUp')) acts.appendChild(lockBtn('Salva', 'volleyUp'));
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
      else if (UNIT_HOME[b.kind]) { const kt = KTYPES[UNIT_HOME[b.kind]]; stats = UNIT_PLURAL[UNIT_HOME[b.kind]] + ' ' + knightCap(b) + ' · sila ' + Math.round(knightDmg(b) * kt.dmg) + ' · ' + kt.desc; }
      else if (b.kind === 'range') stats = 'Lukostrelci ' + archerCap(b) + ' · poškodenie ' + Math.round(archerDmg(b)) + ' · dosah ' + ARCHER_RANGE;
      else if (b.kind === 'pit') stats = 'Poškodenie ' + Math.round(bDmg(b)) + ' · spomalí na polovicu';
      if (d.hp) stats += (stats ? ' · ' : '') + 'zdravie ' + Math.ceil(b.hp) + '/' + bMaxHp(b);
      if (b.gate) stats += ' · rytieri cez ňu prejdú';
      if (b.spikes) stats += ' · ' + (b.spikeType ? SPIKE_TYPES[b.spikeType].name.toLowerCase() : 'ostne') + ' ' + spikeDmg(b);
      if (b.kind === 'wall' && b.nb) stats += ' · spojenie +' + Math.round(WALL_LINK * b.nb * 100) + ' %';
      if (b.spec) stats += ' · ' + SPECS[b.spec].name;
      if ((UNIT_HOME[b.kind] || b.kind === 'range') && knightsBlocked(b)) stats += '<br><span class="warn">⚠ Vojaci sa nedostanú von – postav bránu v hradbách alebo uvoľni cestu</span>';
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
    $('nextWave').textContent = !isAttack() ? 'Do boja' : st.wave >= MISSION_WAVES ? 'Zaútočiť' : 'Do útoku';
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
    addBuilding(kind, c, r); stats.builds++;
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
    addBuilding('wall', c, r); stats.builds++;
    for (let k = 0; k < 5; k++) part(tileX(c) + 8 + (Math.random() - 0.5) * 12, tileY(r) + 12, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.4, '#c6a272', 60);
  }
  // ---- presúvanie stavieb (ťahaním alebo tlačidlom „Presunúť“) ----
  let bdrag = null;                       // ťahaná stavba {b, start, hover, moved}
  let pdrag = null;                       // ťahanie novej stavby na miesto {kind, t: políčko pod prstom alebo null}
  let vscroll = null;                     // posúvanie bojiska prstom pri budovaní {y0, v0, moved, p}
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
    if (st.phase === 'battle' && camBase() > 0) { // dlhé bojisko: ťah = posúvanie, ťuk = salva
      vscroll = { y0: ev.clientY, v0: st.viewUp || 0, moved: false, p };
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    if (st.phase === 'battle' && p.y > 4) { tapBattle(p.x, p.y); return; }
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
    if (!st.tool && !onHall) { // bez zvolenej stavby: ťah = posúvanie bojiska, ťuk = výber
      vscroll = { y0: ev.clientY, v0: st.viewUp || 0, moved: false, p };
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
    if (vscroll && (st.phase === 'build' || st.phase === 'battle')) {
      const r = screen.getBoundingClientRect(), dy = (ev.clientY - vscroll.y0) / r.height * H;
      if (Math.abs(dy) > 4) vscroll.moved = true;
      if (vscroll.moved) st.viewUp = vscroll.v0 + dy;
      return;
    }
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
  const endDrag = ev => {
    if (vscroll) {
      const v = vscroll; vscroll = null;
      if (!v.moved && st.phase === 'build') tapBuild(v.p.x, v.p.y);
      if (!v.moved && st.phase === 'battle' && ev && ev.type === 'pointerup') tapBattle(v.p.x, v.p.y);
      return;
    }
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
  document.querySelectorAll('.spell').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); selectSpell(b.dataset.spell); }));
  $('repairBtn').addEventListener('click', () => {
    const rc = repairCost();
    if (!rc || st.gold < rc) return;
    snapshot();
    st.gold -= rc;
    for (const b of st.blds) if (BUILD[b.kind].hp) b.hp = bMaxHp(b);
    rebuildOcc(); renderBuild();
  });
  // dokupovanie vojakov počas boja: vyjde hneď z kasární / strelnice, navyše k bežnému počtu
  // obliehacie stroje (útočné misie): vyjdú od radnice, naraz najviac 2 z každého druhu
  const BUY = {
    knight: { cost: 40, kind: 'barracks', spawn: b => spawnKnight(b, true) }, archer: { cost: 50, kind: 'range', spawn: b => spawnArcher(b, true) },
    ram: { cost: 90, siege: 'siegeRam', spawn: () => spawnSiege('ram') }, cat: { cost: 120, siege: 'siegeCat', spawn: () => spawnSiege('cat') },
  };
  const SIEGE_MAX = 2;
  const siegeCount = kind => st.soldiers.filter(s => s.siege === kind && !s.dead).length;
  const canSiege = key => !!st.fort && !st.fort.dead && st.tech.has(BUY[key].siege);
  function buyUnit(key) {
    const u = BUY[key];
    if (st.phase !== 'battle' || st.gold < u.cost) { AUDIO.play('deny'); return; }
    if (u.siege) {
      if (!canSiege(key) || siegeCount(key) >= SIEGE_MAX) { AUDIO.play('deny'); if (canSiege(key)) toast('Naraz najviac ' + SIEGE_MAX + ' – ' + (key === 'ram' ? 'baranidlá' : 'katapulty')); return; }
      st.gold -= u.cost; u.spawn();
      AUDIO.play('build'); updateHud();
      return;
    }
    const homes = st.blds.filter(b => b.kind === u.kind);
    if (!homes.length) { AUDIO.play('deny'); return; }
    const free = homes.filter(b => !knightsBlocked(b)), b = (free.length ? free : homes)[Math.floor(Math.random() * (free.length || homes.length))];
    st.gold -= u.cost; u.spawn(b);
    AUDIO.play('build'); updateHud();
  }
  $('buyKnight').addEventListener('click', () => buyUnit('knight'));
  $('buyArcher').addEventListener('click', () => buyUnit('archer'));
  $('buyRam').addEventListener('click', () => buyUnit('ram'));
  $('buyCat').addEventListener('click', () => buyUnit('cat'));
  $('speedBtn').addEventListener('click', () => {
    st.speed = st.speed >= 3 ? 1 : st.speed + 1;
    $('speedBtn').textContent = 'x' + st.speed;
  });
  // ---- pauza: hra stojí, ponuka Pokračovať / Reštart (misia od 1. vlny) / Ukončiť (späť na mapu) ----
  const canPause = () => !st.paused && !$('hud').hidden && (st.phase === 'battle' || st.phase === 'build' || st.phase === 'pause');
  function setPaused(on) {
    st.paused = on; $('pauseBox').hidden = !on;
  }
  $('pauseBtn').addEventListener('click', ev => { ev.stopPropagation(); if (canPause()) { AUDIO.play('click'); setPaused(true); } });
  $('pauseGo').addEventListener('click', () => { AUDIO.play('click'); setPaused(false); });
  $('pauseRestart').addEventListener('click', () => { AUDIO.play('click'); setPaused(false); startMission(st.mission, st.tier); });
  $('pauseQuit').addEventListener('click', () => { AUDIO.play('click'); setPaused(false); showMap(); });
  // keď hráč odíde z aplikácie (iné okno, zamknutý mobil), hra sa sama pozastaví
  document.addEventListener('visibilitychange', () => { if (document.hidden && canPause()) setPaused(true); });
  function clearBattle() {
    st.enemies = []; st.proj = []; st.eproj = []; st.drops = []; st.soldiers = []; st.parts = []; st.texts = []; st.marks = []; st.spawnQ = [];
    $('over').hidden = true; $('hud').hidden = true; $('bottom').hidden = true; $('build').hidden = true; $('bossbar').hidden = true;
  }

  function showMap() {
    st.run = (st.run || 0) + 1; // časovače rozohranej misie sa zrušia
    clearBattle();
    st.phase = 'map';
    AUDIO.music('map');
    $('title').hidden = true;
    $('map').hidden = false;
    if (!st.mapAnim) st.mapSel = Math.min(st.unlocked, MISSIONS.length);
    setTab('map', true);
    renderMapPanel();
    focusMapNode(st.mapAnim ? st.mapAnim.seg + 2 : st.mapSel, true);
    saveStats(); checkAch();
    if (!st.mapAnim) afterDeck(); // pri odomykaní hradu príde výber až po kartičkách
    if (st.unlocked === 1 && !loadJSON(sk('introSeen'), false)) { // úplne nová hra
      saveJSON(sk('introSeen'), true);
      setTimeout(() => { if (st.phase === 'map') banner('Horda napadla tvoje územie!'); }, 400);
    }
  }

  function renderMapPanel() {
    const m = st.mapSel, def = MISSIONS[m - 1];
    const done = m < st.unlocked;
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
    $('mapPlay').textContent = starsOf(m, st.mapTier) ? 'Hrať znova' : 'Hrať';
    $('mStars').innerHTML = '';
  }
  // spodné ikonky mapy: na Sieni počet voľných hviezd, na Trofejach počet získaných
  function renderMapBar() {
    const free = starsFree(), fresh = ACH.filter(a => ach[a.id] > achSeen).length;
    $('hallBtnTxt').textContent = '★' + free; $('hallBtnTxt').hidden = !free;
    $('trophyTxt').textContent = fresh; $('trophyTxt').hidden = !fresh;
    const es = emptySlots(); $('heroTxt').textContent = es; $('heroTxt').hidden = !es; // voľný slot na schopnosť
  }
  $('icoHome').src = UI_ICONS.home; $('icoTrophy').src = UI_ICONS.trophy; $('icoSwords').src = UI_ICONS.swords; $('icoShop').src = UI_ICONS.chest;
  const openMission = () => { renderMapPanel(); $('missionBox').hidden = false; };
  const closeMission = () => { $('missionBox').hidden = true; };
  $('mapClose').addEventListener('click', () => { AUDIO.play('click'); closeMission(); });
  $('missionBox').addEventListener('click', ev => { if (ev.target === $('missionBox')) closeMission(); });

  function kingSummary() {
    const xp = kingMeta.lvl >= KING_MAX_LVL ? 'najvyššia úroveň' : 'XP ' + kingMeta.xp + ' / ' + kingXpNeed(kingMeta.lvl);
    const taken = TALENTS.filter(t => tal(t.id)).map(t => t.name + (tal(t.id) > 1 ? ' ' + tal(t.id) + '×' : ''));
    return xp + ' · ' + (taken.length ? taken.join(', ') : 'XP získava za každú prežitú vlnu');
  }
  function renderPerks() {
    $('perkStars').textContent = starsFree() + ' / ' + starsTotal();
    const list = $('perkList'); list.innerHTML = '';
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
        meta.perks[pk.id] = lvl + 1; saveJSON(sk('perks'), meta.perks);
        AUDIO.play('upgrade'); renderPerks(); renderMapBar();
      });
      row.appendChild(b); list.appendChild(row);
    }
  }

  // ---- Hrdinovia: zatiaľ len kráľ, ďalší hrdinovia prídu neskôr ----
  function renderHeroes() {
    const list = $('heroList'); list.innerHTML = '';
    const need = kingXpNeed(kingMeta.lvl), pct = kingMeta.lvl >= KING_MAX_LVL ? 100 : Math.round(kingMeta.xp / need * 100);
    const k = document.createElement('div'); k.className = 'hero sel';
    k.innerHTML = '<span class="tag">Vybraný</span><img src="' + ICONS.king + '" alt=""><b>Kráľ · úroveň ' + kingMeta.lvl + '</b>' +
      '<span class="xpBar"><i style="width:' + pct + '%"></i></span><small>' + kingSummary() + '</small>';
    list.appendChild(k);
    // tri sloty schopností pod kráľom
    const sh = document.createElement('div'); sh.className = 'skillsHead'; sh.textContent = 'Schopnosti'; list.appendChild(sh);
    const row = document.createElement('div'); row.className = 'skills';
    kingMeta.slots.forEach((id, i) => {
      const b = document.createElement('button');
      if (!slotOpen(i)) { b.className = 'skill lock'; b.innerHTML = '<span>úroveň ' + KING_SLOT_LVL[i] + '</span>'; b.addEventListener('click', () => AUDIO.play('deny')); }
      else if (!id) { b.className = 'skill empty'; b.innerHTML = '<img src="' + UI_ICONS.plus + '" alt=""><span>Vybrať</span>'; b.addEventListener('click', () => openSkillPick(i)); }
      else { b.className = 'skill'; b.innerHTML = '<img src="' + ICONS[POWER_INFO[id].icon] + '" alt=""><span>' + POWER_INFO[id].name + '</span>'; } // výber je natrvalo
      row.appendChild(b);
    });
    list.appendChild(row);
    for (let i = 0; i < 2; i++) {
      const h = document.createElement('div'); h.className = 'hero locked';
      h.innerHTML = '<img src="' + ICONS.king + '" alt=""><b>Nový hrdina</b><small>čoskoro</small>';
      list.appendChild(h);
    }
  }

  // výber schopnosti do slotu (schopnosť z iného slotu sa vymení)
  function openSkillPick(i) {
    AUDIO.play('click');
    if (kingMeta.slots[i]) return;
    $('skillPickHead').textContent = 'Schopnosť ' + (i + 1);
    const box = $('skillOpts'); box.innerHTML = '';
    for (const id of KING_POWERS) {
      const inf = POWER_INFO[id], taken = kingMeta.slots.includes(id);
      const b = document.createElement('button');
      b.className = 'skillOpt'; b.disabled = taken;
      b.innerHTML = '<img src="' + ICONS[inf.icon] + '" alt=""><span><b>' + inf.name + '</b><small>' + (taken ? 'Hrdina ju už má' : inf.desc) + '</small></span>';
      b.addEventListener('click', () => {
        if (taken || kingMeta.slots[i]) return;
        kingMeta.slots[i] = id; saveKing();
        AUDIO.play('upgrade'); $('skillPick').hidden = true; renderHeroes(); renderMapBar();
      });
      box.appendChild(b);
    }
    $('skillPick').hidden = false;
  }
  $('skillBack').addEventListener('click', () => { AUDIO.play('click'); $('skillPick').hidden = true; });
  $('skillPick').addEventListener('click', ev => { if (ev.target === $('skillPick')) $('skillPick').hidden = true; });

  // ---- Trofeje ----
  function renderTrophies() {
    const list = $('trophyList'); list.innerHTML = '';
    for (const a of ACH) {
      const c = document.createElement('div'); c.className = 'trophy' + (ach[a.id] ? ' got' : '') + (ach[a.id] > achSeen ? ' fresh' : '');
      c.innerHTML = '<span class="pic"><img src="' + achIcon(a) + '" alt=""></span><b>' + a.name + '</b><small>' + a.desc + '</small>' + (ach[a.id] > achSeen ? '<em class="newTag">Nové</em>' : '');
      list.appendChild(c);
    }
    $('trophyCount').textContent = ACH.filter(a => ach[a.id]).length + ' / ' + ACH.length;
  }

  // ---- karty pod mapou: Boj (mapa), Sieň, Hrdinovia, Trofeje – prepína sa len medzi nimi ----
  let mapTab = 'map';
  function setTab(t, quiet) {
    mapTab = t;
    document.querySelectorAll('.tabCard').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('perks').hidden = t !== 'hall'; $('heroes').hidden = t !== 'heroes'; $('trophies').hidden = t !== 'trophies'; $('shop').hidden = t !== 'shop';
    if (t === 'shop') renderShop();
    if (t === 'hall') renderPerks();
    if (t === 'heroes') renderHeroes();
    if (t === 'trophies') {
      checkAch(); renderTrophies();
      achSeen = Math.max(achSeen, ...ACH.map(a => ach[a.id] || 0)); saveJSON(sk('achSeen'), achSeen); // po prezretí odznak zmizne
    }
    closeMission(); renderMapBar();
    if (!quiet) AUDIO.play('click');
  }
  // ---- Nákupy: odomknutie rás, hrdinov alebo všetkého naraz (platby cez obchod aplikácií prídu neskôr) ----
  function renderShop() {
    const list = $('shopList'); list.innerHTML = '';
    const sec = t => { const h = document.createElement('div'); h.className = 'shopSec'; h.textContent = t; list.appendChild(h); };
    const item = (cls, img, name, desc, price) => {
      const r = document.createElement('div'); r.className = 'shopItem' + (cls ? ' ' + cls : '');
      r.innerHTML = img + '<div class="info"><b>' + name + '</b><small>' + desc + '</small></div>';
      const b = document.createElement('button'); b.className = 'btn up';
      b.innerHTML = price;
      b.addEventListener('click', () => { AUDIO.play('deny'); toast('Nákupy pripravujeme'); });
      r.appendChild(b); list.appendChild(r);
    };
    const gem = n => '<img src="' + ICONS.gem + '" alt="">' + n;
    item('bundle', '<img src="' + UI_ICONS.chest + '" alt="">', 'Kompletný balík', 'Odomkne všetky rasy aj hrdinov naraz', gem(2000));
    sec('Rasy');
    for (const r of RACES.filter(x => x.state !== 'open'))
      item('', '<img src="' + spriteURL(SPR[r.spr][0], 4) + '" alt="">', r.name, r.state === 'gem' ? 'Nová rasa so svojimi stavbami a jednotkami' : 'Pripravujeme', r.price ? gem(r.price) : 'Čoskoro');
    sec('Hrdinovia');
    for (let i = 0; i < 2; i++) item('', '<img class="sil" src="' + ICONS.king + '" alt="">', 'Nový hrdina', 'Pripravujeme', 'Čoskoro');
  }
  document.querySelectorAll('.tabCard').forEach(b => b.addEventListener('click', () => { if (b.dataset.tab !== mapTab) setTab(b.dataset.tab); }));

  function tapMap(x, y) {
    if (st.mapAnim) return;
    island.nodes.forEach((n, i) => {
      if (Math.hypot(n.x - x, n.y - 5 - y) > 14) return;
      const num = i + 1;
      if (num > st.unlocked) { toast('Najprv dobi misiu ' + (num - 1)); AUDIO.play('deny'); return; }
      st.mapSel = num; AUDIO.play('click'); openMission();
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
      tag: BUILD[u.id] ? 'Nová stavba' : ABIL[u.id] ? 'Kráľova schopnosť' : /^(volley|fireball|freeze|lightning)$/.test(u.id) ? 'Kúzlo' : 'Nové vylepšenie',
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
    const avail = TALENTS.filter(t => tal(t.id) < TAL_MAX && (!t.need || has(t.need) || spellOn(t.need)));
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

  $('overMap').addEventListener('click', showMap);
  $('overRetry').addEventListener('click', () => startMission(st.mission, st.tier));
  $('mapPlay').addEventListener('click', () => { if (!st.mapAnim && tierOpen(st.mapSel, st.mapTier || 0)) startMission(st.mapSel, st.mapTier || 0); });
  // Menu na mape aj Späť z pozícií vedú na úvodný obrázok (Hrať / Nastavenia)
  function showMenu() {
    setTab('map', true);
    st.phase = 'title';
    $('map').hidden = true; $('slots').hidden = true; $('title').hidden = true;
    SPLASH.show(); AUDIO.play('click');
  }
  $('mapHome').addEventListener('click', showMenu);
  // štítok na zvitku: zvitok sa zvinie nahor a ukáže sa úvodná obrazovka
  document.querySelectorAll('.scrollTag img').forEach(i => { i.src = UI_ICONS.scrollTag; });
  function rollUp(screen, done) {
    const p = $(screen).querySelector('.paper');
    if (p.dataset.rolling) return;
    p.dataset.rolling = '1';
    p.ontransitionend = null; p.style.transition = 'none'; p.style.height = p.scrollHeight + 'px';
    void p.offsetHeight;
    p.style.transition = 'height .6s cubic-bezier(.6,0,.8,.4)'; p.style.height = '0px';
    AUDIO.play('paper');
    setTimeout(() => { delete p.dataset.rolling; done(); }, 650);
  }
  $('slotsTag').addEventListener('click', () => rollUp('slots', showMenu));
  $('raceTag').addEventListener('click', () => rollUp('title', () => showSlots()));
  // Nastavenia na úvodnom obrázku: jediné miesto pre hudbu, zvuky a jazyk
  function syncSound() {
    document.querySelectorAll('.setIc.snd').forEach(b => {
      const on = AUDIO.prefs[b.dataset.kind];
      b.classList.toggle('off', !on);
      b.title = (b.dataset.kind === 'music' ? 'Hudba' : 'Zvuky') + (on ? ' zapnuté' : ' vypnuté');
    });
  }
  document.querySelectorAll('.setIc.snd').forEach(b => b.addEventListener('click', () => {
    AUDIO.setPref(b.dataset.kind, !AUDIO.prefs[b.dataset.kind]);
    syncSound(); AUDIO.play('click');
  }));
  document.querySelectorAll('.icoMusic').forEach(i => { i.src = UI_ICONS.music; }); document.querySelectorAll('.icoSound').forEach(i => { i.src = UI_ICONS.sound; }); $('icoLang').src = UI_ICONS.flags.sk;
  // jazyky: zatiaľ len slovenčina, ostatné sú pripravené miesta s vlajkou (preklad príde, keď budú texty hotové)
  UI_ICONS.langs.forEach(l => {
    const b = document.createElement('button');
    b.className = 'lang' + (l.ready ? ' cur' : ' soon');
    b.innerHTML = '<img src="' + UI_ICONS.flags[l.id] + '" alt=""><span>' + l.name + (l.ready ? '' : '<small>čoskoro</small>') + '</span>';
    b.addEventListener('click', () => { if (l.ready) AUDIO.play('click'); else AUDIO.play('deny'); });
    $('langList').appendChild(b);
  });
  let setView = 'closed';
  function setSettings(v) {
    setView = v;
    $('setPanel').hidden = v === 'closed'; $('splashBtns').classList.toggle('hide', v !== 'closed');
    $('setMain').hidden = v !== 'main'; $('langList').hidden = v !== 'lang';
    $('setHead').textContent = v === 'lang' ? 'Jazyk' : 'Nastavenia';
    AUDIO.play('click');
  }
  $('splashSet').addEventListener('click', () => setSettings('main'));
  $('langBtn').addEventListener('click', () => setSettings('lang'));
  $('setBack').addEventListener('click', () => setSettings(setView === 'lang' ? 'main' : 'closed'));
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
  // ---- menu: 4 pozície na uloženie ----
  // červený pixelový kôš na vymazanie pozície (14×16 bodov)
  const TRASH = (() => {
    const R = (x, y, w, h, c) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
    const K = '#2a0a06', svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 16" shape-rendering="crispEdges">' +
      R(4, 0, 6, 1, K) + R(4, 1, 1, 1, K) + R(9, 1, 1, 1, K) + R(5, 1, 4, 1, '#e84838') +
      R(0, 2, 14, 4, K) + R(1, 3, 12, 1, '#ff9a80') + R(1, 4, 12, 1, '#e84838') +
      R(1, 6, 12, 10, K) + R(2, 6, 10, 9, '#d8402c') + R(2, 6, 1, 8, '#ff7a60') + R(11, 6, 1, 9, '#a8261c') + R(2, 14, 10, 1, '#a8261c') +
      R(4, 8, 1, 5, '#7c1810') + R(7, 8, 1, 5, '#7c1810') + R(9, 8, 1, 5, '#7c1810') + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  })();
  // vlastné potvrdenie v štýle hry (okno prehliadača confirm() nevyzerá dobre)
  function ask(title, text, onOk) {
    $('askImg').src = TRASH; $('askTitle').textContent = title; $('askText').textContent = text;
    const box = $('askBox'), close = () => { box.hidden = true; };
    box.hidden = false;
    $('askNo').onclick = () => { AUDIO.play('click'); close(); };
    $('askOk').onclick = () => { close(); AUDIO.play('sell'); onOk(); };
    box.onclick = ev => { if (ev.target === box) close(); };
  }
  // rozvinutie zvitku s pozíciami (výška pergamenu z 0 na plnú, spodná tyč ide s ním)
  function unrollScroll(anim, screen) {
    screen = screen || 'slots';
    const p = $(screen).querySelector('.paper');
    p.ontransitionend = null; p.style.transition = 'none'; p.style.height = anim ? '0px' : 'auto';
    void p.offsetHeight;
    const h = p.scrollHeight, PXS = 3;
    const aw = Math.ceil(p.clientWidth / PXS), ah = Math.ceil(h / PXS);
    p.style.backgroundImage = 'url(' + UI_ICONS.scrollPaper(aw, ah) + ')'; p.style.backgroundSize = aw * PXS + 'px ' + ah * PXS + 'px';
    if (!aw || !h) { requestAnimationFrame(() => unrollScroll(anim, screen)); return; } // ešte nemá rozmery
    $(screen).querySelectorAll('.rod').forEach(r => {
      const rw = Math.ceil(r.offsetWidth / PXS);
      r.style.backgroundImage = 'url(' + UI_ICONS.scrollRod(rw) + ')'; r.style.backgroundSize = rw * PXS + 'px 27px';
    });
    if (!anim) return;
    p.style.transition = 'height .9s cubic-bezier(.3,.7,.3,1) .3s';
    p.style.height = h + 'px';
    p.ontransitionend = () => { p.style.height = 'auto'; };
    setTimeout(() => AUDIO.play('paper'), 300); // zvuk spolu s rozvíjaním
  }
  window.addEventListener('resize', () => { for (const sc of ['slots', 'title']) if (!$(sc).hidden) unrollScroll(false, sc); });
  function showSlots(opts) {
    st.phase = 'title';
    $('title').hidden = true; $('map').hidden = true;
    $('slots').hidden = false;
    AUDIO.music('map');
    const box = $('slotList'); box.innerHTML = '';
    for (let n = 1; n <= SLOTS; n++) {
      const info = slotInfo(n), c = document.createElement('div');
      c.className = 'slot' + (info ? '' : ' empty');
      c.innerHTML = '<span class="slotNum">' + n + '</span><div class="slotInfo">' + (info
        ? '<b>' + info.race + '</b><small><span class="st">★ ' + info.stars + '</span><span class="kg"><img src="' + ICONS.king + '" alt="">úr. ' + info.king + '</span></small>'
        : '<b>Nová hra</b><small>Prázdna pozícia</small>') + '</div>' + (info ? '<button class="slotDel" title="Vymazať"><img src="' + TRASH + '" alt="Vymazať"></button>' : '<span class="slotGo"><img src="' + UI_ICONS.plus + '" alt="Nová hra"></span>');
      c.addEventListener('click', () => { // rozohraná pozícia rovno na ostrov, nová na výber rasy
        AUDIO.play('build'); loadSlot(n);
        if (info) { $('slots').hidden = true; showMap(); } else showTitle();
      });
      const del = c.querySelector('.slotDel');
      if (del) del.addEventListener('click', ev => {
        ev.stopPropagation();
        AUDIO.play('click');
        ask('Vymazať pozíciu ' + n + '?', 'Postup sa stratí natrvalo.', () => { clearSlot(n); showSlots({ still: true }); });
      });
      box.appendChild(c);
    }
    unrollScroll(!(opts && opts.still));
  }
  // ---- menu: výber rasy (po výbere sa otvorí mapa) ----
  function showTitle() {
    $('slots').hidden = true;
    $('title').hidden = false;
    AUDIO.music('map');
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
        else { saveJSON(sk('race'), r.name); saveProgress(); showMap(); }
      });
      box.appendChild(c);
    }
    unrollScroll(true, 'title');
  }

  // odpočet budovania počas obliehania (stojí, kým kráľ vyberá talent)
  function siegeTick(dt) {
    if (st.phase !== 'build' || !(st.siegeT > 0) || kingMeta.pending) return;
    st.siegeT -= dt;
    if (st.siegeT <= 0) { startWave(); return; }
    $('nextWave').textContent = (st.wave >= MISSION_WAVES ? 'Zaútočiť ' : 'Do útoku ') + Math.ceil(st.siegeT);
  }

  // ---------------- Slučka ----------------
  let last = performance.now(), acc = 0;
  const DT = 1 / 60;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!scene) { resize(); requestAnimationFrame(frame); return; }
    if (st.paused) { acc = 0; render(now / 1000); requestAnimationFrame(frame); return; } // pauza: všetko stojí, len sa kreslí
    if (st.phase === 'battle') {
      // spomalenie na tretinu, posledných 0,3 s sa plynulo vráti na plnú rýchlosť
      const slow = slowmoT <= 0 ? 1 : slowmoT > 0.3 ? 0.33 : 0.33 + 0.67 * (1 - slowmoT / 0.3);
      slowmoT = Math.max(0, slowmoT - dt);
      acc += dt * st.speed * slow;
      while (acc >= DT && st.phase === 'battle') { update(DT); acc -= DT; }
    } else { acc = 0; updateFx(dt); mapTick(dt); siegeTick(dt); }
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
  updateHud();
  requestAnimationFrame(frame);
  SPLASH.onPlay = () => showSlots(); // zelené tlačidlo Hrať na úvodnom obrázku otvorí pozície

  // ---------------- Ladenie ----------------
  function postPNG(canvas, name) {
    return fetch('/snap?name=' + encodeURIComponent(name), { method: 'POST', body: canvas.toDataURL('image/png') });
  }
  function snap(name, scale) {
    scale = scale || 4;
    const c = document.createElement('canvas'); c.width = W * scale; c.height = buf.height * scale;
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
  window.FW = { DIFF, meta, perk, st, G, costOf, moveBuilding, renderBuild, get camY() { return camY; }, get slowmoT() { return slowmoT; }, hudTick, ability, SPECS, KTYPES, BUILD, ENEMY, WUNIT, snap, sheet, update, spawnEnemy, render, addBuilding, startWave, rebuildOcc, showMap, startMission, missionWon, castSpell, selectSpell, SPELLS, KING_SLOT_LVL, KING_POWERS,
    enterBuild, reviveKing, reviveCost, TIERS, starsOf, tierOpen, showUnlockDeck, showTalentPick, kingMeta, gainKingXp, volley, has, lvlCap, hallCap, bCap, bUpCost, uUpCost, hallUpCost, volleyUpCost, repairCost, bRepairCost, bMaxHp, hallMax, zoneTopRow, inZone, inHall, occAt, kingMax, buyUnit, knightsBlocked, get isAttack() { return isAttack(); } };
})();
