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
    icetower: { name: 'Ľadová veža',  short: 'Ľad',    cost: 90,  hp: 220, range: 72, dmg: 5,  cd: 1.3, proj: 'ice', speed: 150, chill: 2.2, block: true, desc: 'Ľadové strely spomalia zasiahnutého aj nepriateľov okolo neho' },
    ballista: { name: 'Balista',      short: 'Balista', cost: 140, hp: 260, range: 118, dmg: 34, cd: 3.2, proj: 'lance', speed: 250, block: true, desc: 'Ťažký šíp prestrelí celý rad nepriateľov na zemi' },
    wall:     { name: 'Hradby',       short: 'Hradby', cost: 12,  hp: 240, block: true, desc: 'Zatarasí cestu – horda ich musí rozbiť alebo obísť' },
    pit:      { name: 'Jama s ostňami', short: 'Jama', cost: 30,  dmg: 12, block: false, desc: 'Zraní a spomalí každého, kto ňou prejde' },
    mine:     { name: 'Zlatá baňa',   short: 'Baňa',   cost: 100, hp: 180, block: true, desc: 'Po každej prežitej vlne prinesie zlato' },
    chapel:   { name: 'Kaplnka',      short: 'Kaplnka', cost: 120, hp: 200, block: true, desc: 'Vyšle mnícha, ktorý chodí za rytiermi a hrdinom a lieči ich' },
    firepit:  { name: 'Ohnivá jama',  short: 'Oheň',   cost: 50,  dmg: 8, block: false, desc: 'Kto ňou prejde, niekoľko sekúnd horí' },
    beartrap: { name: 'Medvedia pasca', short: 'Pasca', cost: 40, block: false, desc: 'Chytí nepriateľa a na chvíľu ho zastaví' },
    paving:   { name: 'Dlažba',       short: 'Dlažba', cost: 5, block: false, deco: true, desc: 'Ozdobná kamenná dlažba – dá sa položiť aj pod budovy. Ďalší ťuk ju zoberie späť' },
    workshop: { name: 'Dielňa remeselníka', short: 'Dielňa', cost: 90, hp: 180, block: true, desc: 'Vyšle remeselníka, ktorý chodí opravovať poškodené budovy' },
  };
  const TRAPS = { pit: 1, firepit: 1, beartrap: 1 };
  const FIRE_BURN = 4; // ohnivá jama: horenie trvá 4 s (pri 8/s = 32 poškodenia – viac za zlato ako jama s ostňami, tá zas spomaľuje)
  const SHOOTERS = { tower: 1, mage: 1, icetower: 1, ballista: 1 };
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
    rider:  { name: 'Jazdec',      spr: 'rider',   hp: 0.9, dmg: 1.25, spd: 34, desc: 'rýchly, ide po strelcoch a šamanoch' },
  };
  // každá pozemná jednotka má vlastnú budovu
  const UNIT_HOME = { barracks: 'knight', stables: 'rider', armory: 'spear' };
  const UNIT_PLURAL = { knight: 'Rytieri', rider: 'Jazdci', spear: 'Kopijníci' };
  const SPIKE_COST = 25, SPIKE_TYPE_COST = 40;
  const spikeDmg = b => (4 + 3 * (b.lvl - 1)) * (1 + 0.06 * perk('traps'));
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
    // paladin
    warcry:    { name: 'Pokrik',       cdKey: 'cryCd',    cd: 30, instant: true },
    shield:    { name: 'Svätý štít',   cdKey: 'shieldCd', cd: 26, R: 60, dur: 4, instant: true },
    heal:      { name: 'Uzdravenie',   cdKey: 'healCd',   cd: 24, instant: true, R: 60 },
    // čarodejka
    firewall:  { name: 'Ohnivá stena', cdKey: 'fwCd',     cd: 24, dur: 5, w: 44 },
    teleport:  { name: 'Teleport',     cdKey: 'tpCd',     cd: 16, R: 28 },
  };
  const spellMax = id => id === 'volley' ? volleyCd() : SPELLS[id].cd;
  const spellPow = () => 1 + 0.15 * (st.mission - 1); // kúzla silnejú s misiou, aby stačili na tuhšiu hordu
  const mineGold = b => (20 + 12 * (b.lvl - 1)) * (1 + 0.06 * perk('mines'));
  const chapelHeal = b => 4 * (1 + 0.4 * (b.lvl - 1)) * (1 + 0.08 * perk('helpers'));
  const trapStun = b => (2.5 + 0.5 * (b.lvl - 1)) * (1 + 0.06 * perk('traps'));
  const craftRate = b => 6 * (1 + 0.5 * (b.lvl - 1)) * (1 + 0.08 * perk('helpers')); // remeselník opraví toľko zdravia za sekundu
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
  const uDmg = u => WUNIT[u.type].dmg * (1 + 0.4 * (u.lvl - 1)) * (1 + 0.04 * perk('fletching'));
  const uCd = u => WUNIT[u.type].cd * Math.pow(0.92, u.lvl - 1);
  const uRange = u => WUNIT[u.type].range + 4 * (u.lvl - 1);
  const BUILD_ORDER = ['paving', 'tower', 'wall', 'pit', 'mine', 'barracks', 'range', 'stables', 'armory', 'falconry', 'mage', 'icetower', 'ballista', 'chapel', 'firepit', 'beartrap', 'workshop'];
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
    // obrí bossovia: hrubé pancierovanie (veže, jednotky a kúzla ich len škrabnú), slabina sú obliehacie stroje
    giantRam: { spr: 'giantRam', hp: 1400, speed: 6, atk: 150, atkCd: 2.0, gold: 120, blood: '#6e4422', ram: true, boss: true, giant: true, title: 'Obrí baran' },
    mammoth:  { spr: 'mammoth',  hp: 1500, speed: 7, atk: 40,  atkCd: 1.4, gold: 150, blood: '#62a03a', boss: true, giant: true, howdah: true, title: 'Vojnový mamut' },
  };
  const GIANT_ARMOR = 0.3, GIANT_SIEGE = 1.6; // násobok poškodenia obra: bežné zásahy / obliehacie stroje
  // obri v misiách: { misia: { vlna: [druhy] } } – v 5. vlne nahradia vojvodcu, v 10. prídu popri ňom
  const GIANTS = { 7: { 10: ['giantRam'] }, 8: { 5: ['giantRam'], 10: ['mammoth'] }, 9: { 5: ['mammoth'], 10: ['giantRam', 'mammoth'] }, 10: { 5: ['giantRam', 'mammoth'] } };

  const lvlMul = (b, k) => 1 + k * (b.lvl - 1);
  const bDmg = b => BUILD[b.kind].dmg * lvlMul(b, 0.4) * (SHOOTERS[b.kind] ? 1 + 0.04 * perk('fletching') : 1) * (TRAPS[b.kind] ? 1 + 0.06 * perk('traps') : 1) * (b.spec ? SPECS[b.spec].dmg : 1);
  const bCd = b => BUILD[b.kind].cd * Math.pow(0.92, b.lvl - 1) * (b.spec ? SPECS[b.spec].cd : 1) / (1 + 0.03 * perk('reload'));
  const bRange = b => (BUILD[b.kind].range + 4 * (b.lvl - 1) + (b.spec ? SPECS[b.spec].range : 0)) * (1 + 0.02 * perk('lookouts'));
  const bMaxHp = b => Math.round((BUILD[b.kind].hp || 1) * lvlMul(b, 0.35) * (b.kind === 'wall' ? 1 + WALL_LINK * (b.nb || 0) : 1) * (1 + 0.06 * perk('carpenters')));
  const bUpCost = b => Math.round(BUILD[b.kind].cost * 0.9 * Math.pow(1.6, b.lvl - 1) * (1 - 0.04 * perk('architects')));
  const knightCap = b => 2 + b.lvl;
  const knightEvery = b => Math.max(3, 7 - 0.8 * (b.lvl - 1)) * (1 - 0.04 * perk('recruits'));
  // lukostrelci zo strelnice: menej zdravia, strieľajú z diaľky (aj na netopiere), držia sa za rytiermi
  const archerCap = b => 2 + b.lvl;
  const archerEvery = b => Math.max(4, 8 - 0.8 * (b.lvl - 1)) * (1 - 0.04 * perk('recruits'));
  const archerHp = b => 28 * lvlMul(b, 0.3) * (1 + 0.05 * perk('drill')) * (1 + 0.1 * tal('command'));
  const archerDmg = b => 5 * lvlMul(b, 0.4) * (1 + 0.04 * perk('fletching')) * (1 + 0.1 * tal('command'));
  const ARCHER_RANGE = 64, ARCHER_CD = 1.1;
  const ARCHER_PRIO = e => e.d.fly || e.d.heals || e.d.sapper;            // lukostrelci: najprv letci, šamani a podkopníci
  const RIDER_PRIO = e => e.d.ranged || e.d.heals || e.d.sapper;          // jazdci: strelci, šamani, podkopníci
  const SPEAR_REACH = 15, SPEAR_VS_CAV = 3, RIDER_CHARGE = 2, CHARGE_RUN = 30;
  const knightHp = b => 40 * lvlMul(b, 0.3) * (1 + 0.05 * perk('drill')) * (1 + 0.1 * tal('command'));
  const knightDmg = b => 6 * lvlMul(b, 0.35) * (1 + 0.05 * perk('drill')) * (1 + 0.1 * tal('command'));
  const hallMax = () => Math.round((400 + 200 * (st.hallLvl - 1)) * (1 + 0.06 * perk('foundations')));
  const hallUpCost = () => Math.round(110 * Math.pow(1.7, st.hallLvl - 1) * (1 - 0.04 * perk('architects'))); // lacnejšie – radnica odomyká aj úrovne stavieb
  const zoneRows = () => 5 + st.hallLvl;
  const kingMax = () => 120 * heroDef().hp * (1 + 0.3 * (st.hallLvl - 1)) * (1 + 0.2 * tal('vit'));
  const kingDmg = () => 12 * heroDef().dmg * (1 + 0.3 * (st.hallLvl - 1)) * (1 + 0.15 * tal('str'));
  const volleyDmg = () => (6 + 4 * (st.volleyLvl - 1)) * (1 + 0.15 * tal('archers'));
  const volleyCd = () => Math.max(2, 5 - 0.25 * (st.volleyLvl - 1));

  // ---- Kráľovská sieň: trvalé bonusy za hviezdy (netýkajú sa hrdinov) ----
  // každý bonus má 9 úrovní: 3 za medené hviezdy, potom 3 za strieborné a 3 za zlaté (1 úroveň = 1 hviezda);
  // per = účinok jednej úrovne, sign = '+' / '−'
  const PERKS = [
    { id: 'treasury',    name: 'Pokladnica',        what: 'štartové zlato v misii',                      per: 5, sign: '+', icon: 'coin' },
    { id: 'loot',        name: 'Korisť',            what: 'zlato za porazených nepriateľov',             per: 4, sign: '+', icon: 'coin' },
    { id: 'mines',       name: 'Bohaté žily',       what: 'zlato zo zlatých baní',                       per: 6, sign: '+', icon: 'mine' },
    { id: 'dealers',     name: 'Výkupcovia',        what: 'zlato z predaja stavieb (základ 50 %)',       per: 4, sign: '+', icon: 'coin' },
    { id: 'masons',      name: 'Kamenári',          what: 'cena hradieb a brán',                         per: 5, sign: '−', icon: 'gate' },
    { id: 'architects',  name: 'Stavitelia',        what: 'cena vylepšení stavieb a radnice',            per: 4, sign: '−', icon: 'workshop' },
    { id: 'foundations', name: 'Pevné základy',     what: 'zdravie radnice',                             per: 6, sign: '+', icon: 'hall' },
    { id: 'carpenters',  name: 'Tesári',            what: 'zdravie všetkých stavieb',                    per: 6, sign: '+', icon: 'wall' },
    { id: 'fletching',   name: 'Ostré hroty',       what: 'poškodenie veží a strelcov',                  per: 4, sign: '+', icon: 'tower' },
    { id: 'lookouts',    name: 'Vyhliadky',         what: 'dosah veží',                                  per: 2, sign: '+', icon: 'ballista' },
    { id: 'reload',      name: 'Rýchle nabíjanie',  what: 'rýchlosť streľby veží',                       per: 3, sign: '+', icon: 'mage' },
    { id: 'traps',       name: 'Majstri pascí',     what: 'poškodenie a omráčenie z jám, pascí a ostňov', per: 6, sign: '+', icon: 'pit' },
    { id: 'drill',       name: 'Výcvik',            what: 'zdravie a sila vojakov a sokolov',            per: 5, sign: '+', icon: 'barracks' },
    { id: 'recruits',    name: 'Nábor',             what: 'rýchlejšie vysielanie vojakov',               per: 4, sign: '+', icon: 'range' },
    { id: 'helpers',     name: 'Pomocníci',         what: 'liečenie mníchov a opravy remeselníkov',      per: 8, sign: '+', icon: 'chapel' },
    { id: 'siege',       name: 'Obliehací majstri', what: 'zdravie a sila obliehacích strojov',      per: 6, sign: '+', icon: 'u_siegeRam' },
  ];
  const PERK_MAX = 9, PERK_STEP = 3; // 3 úrovne na každý druh hviezd
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
    { id: 'king5',    name: 'Skúsený panovník',  desc: 'Kráľ na úrovni 5',                   icon: 'king',       ok: () => metaOf('king').lvl >= 5 },
    { id: 'stars10',  name: 'Zberateľ hviezd',   desc: 'Získaj 10 hviezd',                   icon: 'star',       ok: () => starsTotal() >= 10 },
    { id: 'half',     name: 'Polovica ostrova',  desc: 'Oslobodi 5 provincií',               icon: 'barracks',   ok: () => st.unlocked >= 6 },
    { id: 'fort',     name: 'Dobyvateľ',         desc: 'Ubráň sa prvému táboru hordy',       icon: 'u_siegeRam', ok: () => st.unlocked >= 7 },
    { id: 'gold3',    name: 'Zlatá koruna',      desc: 'Získaj 3 hviezdy na zlatej úrovni',  icon: 'gem',        ok: () => meta.stars.some(a => a && a[2] >= 3) },
    { id: 'kills1k',  name: 'Postrach hordy',    desc: 'Poraz 1000 nepriateľov',             icon: 'e_bear',     ok: () => stats.kills >= 1000 },
    { id: 'stars30',  name: 'Hviezdny pán',      desc: 'Získaj 30 hviezd',                   icon: 'star',       ok: () => starsTotal() >= 30 },
    { id: 'king10',   name: 'Legendárny kráľ',   desc: 'Kráľ na úrovni 10',                  icon: 'king',       ok: () => metaOf('king').lvl >= 10 },
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
  TALENTS.find(t => t.id === 'archers').need = 'volley';
  TALENTS.splice(TALENTS.findIndex(t => t.id === 'roar'), 1); // pokrik má paladin, nie kráľ
  // hrdinovia ľudí: kráľ od začiatku, paladin a čarodejka za gemy; do vlny ide vždy len jeden (vyberá sa pred vlnou)
  const HEROES = {
    king:    { name: 'Kráľ',      spr: 'king',    hp: 1,    dmg: 1,    cd: 0.8, spd: 26, reach: 40, powers: ['volley', 'freeze', 'lightning'],
      desc: 'Vyvážený bojovník, mečom zasiahne celú skupinu.' },
    paladin: { name: 'Paladin',   spr: 'paladin', hp: 1.6,  dmg: 0.8,  cd: 1.0, spd: 20, reach: 32, aura: 2.5, powers: ['warcry', 'shield', 'heal'], price: 300,
      desc: 'Obranca s veľkým zdravím. Drží hordu a lieči rytierov okolo seba.' },
    sorc:    { name: 'Čarodejka', spr: 'sorc',    hp: 0.65, dmg: 1.15, cd: 1.4, spd: 24, range: 72, fem: true, powers: ['fireball', 'firewall', 'teleport'], price: 300,
      desc: 'Z diaľky strieľa ohnivé strely, aj na netopiere. Vydrží však málo.' },
  };
  const HERO_IDS = Object.keys(HEROES);
  // talenty paladina a čarodejky (rovnaké id = rovnaký účinok ako u kráľa)
  const HERO_TALENTS = {
    king: TALENTS,
    paladin: [
      { id: 'str',     name: 'Svätá sila',       desc: 'Paladin udiera o 15 % silnejšie',                icon: 'hero' },
      { id: 'vit',     name: 'Požehnaná zbroj',  desc: 'Paladin má o 20 % viac zdravia',                 icon: 'hero' },
      { id: 'swift',   name: 'Ľahké kladivo',    desc: 'Paladin udiera o 12 % rýchlejšie',               icon: 'hero' },
      { id: 'reach',   name: 'Strážca brány',    desc: 'Paladin vyráža na hordu ďalej od radnice',       icon: 'hero' },
      { id: 'regen',   name: 'Viera',            desc: 'Paladin sa v boji sám lieči',                    icon: 'hero' },
      { id: 'rally',   name: 'Nezlomný',         desc: 'Oživenie paladina o 25 % lacnejšie',             icon: 'hero' },
      { id: 'aura',    name: 'Svätá aura',       desc: 'Paladin lieči rytierov okolo seba o 50 % rýchlejšie', icon: 'hero' },
      { id: 'command', name: 'Velenie',          desc: 'Rytieri o 10 % silnejší a odolnejší',            icon: 'barracks', need: 'barracks' },
      { id: 'roar',    name: 'Hromový hlas',     desc: 'Pokrik trvá o 2 s dlhšie',                       icon: 'hero', need: 'warcry' },
      { id: 'bless',   name: 'Pevný štít',       desc: 'Svätý štít trvá o 1,5 s dlhšie',                 icon: 'hero', need: 'shield' },
    ],
    sorc: [
      { id: 'str',     name: 'Žeravý plameň',    desc: 'Ohnivé strely o 15 % silnejšie',                 icon: 'hero' },
      { id: 'vit',     name: 'Ochranný amulet',  desc: 'Čarodejka má o 20 % viac zdravia',               icon: 'hero' },
      { id: 'swift',   name: 'Rýchle kúzlenie',  desc: 'Čarodejka strieľa o 12 % rýchlejšie',            icon: 'hero' },
      { id: 'reach',   name: 'Bystrý zrak',      desc: 'Ohnivé strely letia o 10 ďalej',                 icon: 'hero' },
      { id: 'regen',   name: 'Elixír',           desc: 'Čarodejka sa v boji sama lieči',                 icon: 'hero' },
      { id: 'rally',   name: 'Fénix',            desc: 'Oživenie čarodejky o 25 % lacnejšie',            icon: 'hero' },
      { id: 'tax',     name: 'Alchýmia',         desc: 'Po každej vlne +6 zlata navyše',                 icon: 'coin' },
      { id: 'pyro',    name: 'Spaľujúci oheň',   desc: 'Ohnivá guľa a ohnivá stena o 30 % silnejšie',    icon: 'hero' },
    ],
  };
  const newHeroMeta = () => ({ lvl: 1, xp: 0, pending: 0, tal: {}, slots: [null, null, null] });
  const kingMeta = newHeroMeta(); // vždy údaje práve nasadeného hrdinu (st.hero); ostatní sú uložení každý zvlášť
  const heroDef = () => HEROES[st.hero] || HEROES.king;
  const heroName = () => heroDef().name;
  const heroFell = () => heroName() + (heroDef().fem ? ' padla' : ' padol');
  const heroKey = id => id === 'king' ? 'king' : 'hero_' + id;
  function loadHeroMeta(id) {
    const m = Object.assign(newHeroMeta(), loadJSON(sk(heroKey(id)), {}));
    if (!Array.isArray(m.slots) || m.slots.length !== 3) m.slots = [null, null, null];
    return m;
  }
  const metaOf = id => id === st.hero ? kingMeta : loadHeroMeta(id);
  const saveMetaOf = (id, m) => saveJSON(sk(heroKey(id)), m);
  // gemy a kúpení hrdinovia patria hráčovi (všetkým pozíciám)
  const GEMS_KEY = 'fortward.gems', HEROES_KEY = 'fortward.heroes';
  const gems = () => loadJSON(GEMS_KEY, 0) || 0;
  const ownedHeroes = () => ['king'].concat((loadJSON(HEROES_KEY, []) || []).filter(id => HEROES[id] && id !== 'king'));
  const ownsHero = id => ownedHeroes().includes(id);
  // počas vývoja sa hrdinovia odomykajú ručne tlačidlom Odomknúť (zadarmo); cena v gemoch (price) sa zapojí, keď bude obchod
  function buyHero(id) {
    const h = HEROES[id];
    if (!h || ownsHero(id)) return;
    heroesSeen(); // zapamätá doterajších, aby sa leskol len nový
    saveJSON(HEROES_KEY, ownedHeroes().filter(x => x !== 'king').concat(id));
    AUDIO.play('unlock'); toast(h.name + (h.fem ? ' sa pridala' : ' sa pridal') + ' k tvojim hrdinom');
    updateGems(); if (mapTab === 'heroes') renderHeroes(); if (mapTab === 'shop') renderShop();
  }
  const updateGems = () => { const g = document.querySelector('#gemBox span'); if (g) g.textContent = gems(); };
  // nasadí iného hrdinu (údaje doterajšieho sa uložia)
  function setActiveHero(id) {
    if (!HEROES[id] || !ownsHero(id)) id = 'king';
    if (st.hero && st.hero !== id) saveMetaOf(st.hero, kingMeta);
    st.hero = id; saveJSON(sk('hero'), id);
    const m = loadHeroMeta(id);
    for (const k in kingMeta) delete kingMeta[k];
    Object.assign(kingMeta, m);
    if (ICONS.king) syncHeroIcons();
  }
  // schopnosti hrdinu: 3 sloty, odomknú sa na úrovni 2, 5 a 9; hráč si do slotu vyberie jednu z ponuky
  const KING_SLOT_LVL = [2, 5, 9];
  const POWER_INFO = {
    volley:    { name: 'Šípová salva', desc: 'Dážď šípov na zvolené miesto. Silnejšia s talentmi kráľa.', icon: 'sp_volley' },
    freeze:    { name: 'Mráz',         desc: 'Nepriatelia v okolí na pár sekúnd takmer zamrznú.',     icon: 'sp_frost' },
    lightning: { name: 'Blesk',        desc: 'Silný úder do nepriateľa, preskočí na dvoch ďalších a všetkých na 2 s omráči.', icon: 'sp_bolt' },
    fireball:  { name: 'Ohnivá guľa',  desc: 'Výbuch zraní hordu v okolí a podpáli ju.',              icon: 'sp_fire' },
    warcry:    { name: 'Pokrik',       desc: 'Na chvíľu posilní a zrýchli hrdinu aj rytierov.',        icon: 'sp_warcry' },
    shield:    { name: 'Svätý štít',   desc: 'Vlna okolo paladina rozžiari budovy aj radnicu v dosahu – kým sa lesknú, sú nezraniteľné.', icon: 'sp_shield' },
    heal:      { name: 'Uzdravenie',   desc: 'Ihneď vylieči paladina a rytierov okolo neho.',           icon: 'sp_heal' },
    firewall:  { name: 'Ohnivá stena', desc: 'Pás ohňa na zvolenom mieste podpáli každého, kto ním prejde.', icon: 'sp_firewall' },
    teleport:  { name: 'Teleport',     desc: 'Čarodejka sa premiestni na zvolené miesto, zraní a omráči nepriateľov okolo a hneď sa vráti k radnici.', icon: 'sp_teleport' },
  };
  const slotOpen = i => kingMeta.lvl >= KING_SLOT_LVL[i];
  const spellOn = id => kingMeta.slots.some((s, i) => s === id && slotOpen(i));
  const kingUp = () => !!(st.king && !st.king.dead); // schopnosti hrdinu (kúzla, pokrik) idú len kým žije
  const emptySlots = () => kingMeta.slots.filter((s, i) => !s && slotOpen(i)).length;
  const tal = id => kingMeta.tal[id] || 0;
  const kingXpNeed = l => 60 + 40 * (l - 1);
  const saveKing = () => saveMetaOf(st.hero || 'king', kingMeta);
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
  // hviezdy sa míňajú podľa druhu: úrovne 1–3 bonusu stoja medené, 4–6 strieborné, 7–9 zlaté (každá 1 hviezdu)
  const tierStars = t => meta.stars.reduce((a, b) => a + ((b || [])[t] || 0), 0);
  const tierSpent = t => Object.values(meta.perks).reduce((a, l) => a + Math.max(0, Math.min(PERK_STEP, l - PERK_STEP * t)), 0);
  const tierFree = t => tierStars(t) - tierSpent(t);
  const starsFree = () => [0, 1, 2].reduce((a, t) => a + Math.max(0, tierFree(t)), 0);
  const starsFor = ratio => ratio >= 0.8 ? 3 : ratio >= 0.4 ? 2 : 1;
  const costOf = kind => kind === 'wall' ? Math.max(4, Math.round(BUILD.wall.cost * (1 - 0.05 * perk('masons')))) : BUILD[kind].cost;
  const gateCost = () => Math.max(6, Math.round(GATE_COST * (1 - 0.05 * perk('masons'))));
  const sellShare = () => 0.5 + 0.04 * perk('dealers'); // koľko z vloženého zlata vráti predaj

  const HALL = { hall: true };
  const st = {
    phase: 'title', hero: 'king', wave: 0, gold: 0, hallLvl: 1, hallHp: 400, volleyLvl: 1, volleyT: 0, bolts: [],
    blds: [], occ: [], paving: {}, dist: null, enemies: [], soldiers: [], king: null,
    proj: [], eproj: [], drops: [], parts: [], texts: [], marks: [],
    spawnQ: [], spawnT: 0, speed: 1, shake: 0, best: 0, boss: null,
    tool: null, sel: null, soldierN: 0,
  };
  // postup na mape: unlocked = najvyššia odomknutá misia (11 = ostrov oslobodený)
  Object.assign(st, { mission: 1, unlocked: 1, mapSel: 1, mapAnim: null, tech: techFor(1) });
  const has = id => st.tech.has(id);
  // novinky: odomknutá stavba / vylepšenie / hrdina, na ktoré hráč ešte neťukol – jeho karta a záložka sa lesknú
  const SHINE_TECH = { gate: 1, spikes: 1, spikeTypes: 1, wallArcher: 1, wallCrossbow: 1, spec: 1, lvl2: 1, lvl3: 1, lvl4: 1, lvl5: 1 };
  let seenNew = [];
  function loadSeen() { // prvé spustenie: všetko doteraz odomknuté berie ako videné, lesknú sa až ďalšie novinky;
    // úplne nový hráč (len 1. misia) má ako novinky aj všetky stavby z prvej misie, aby sa s nimi zoznámil
    seenNew = loadJSON(sk('seenNew'), null);
    if (!Array.isArray(seenNew)) {
      seenNew = [...techFor(st.unlocked)].filter(id => st.unlocked > 1 || !BUILD[id]);
      saveJSON(sk('seenNew'), seenNew);
    }
  }
  const isNew = id => (!!BUILD[id] || !!SHINE_TECH[id]) && techFor(st.unlocked).has(id) && (unlockMissionOf(id) > 1 || !!BUILD[id]) && !seenNew.includes(id);
  function markSeen(id) { if (seenNew.includes(id)) return; seenNew.push(id); saveJSON(sk('seenNew'), seenNew); }
  // novo odomknutý hrdina (pre celý účet)
  const HEROES_SEEN_KEY = 'fortward.heroesSeen';
  function heroesSeen() {
    let v = loadJSON(HEROES_SEEN_KEY, null);
    if (!Array.isArray(v)) { v = ownedHeroes(); saveJSON(HEROES_SEEN_KEY, v); }
    return v;
  }
  const heroIsNew = id => ownsHero(id) && !heroesSeen().includes(id);
  function markHeroSeen(id) { const v = heroesSeen(); if (!v.includes(id)) { v.push(id); saveJSON(HEROES_SEEN_KEY, v); } }
  // karta novinky v paneli: raz neónovo modro zabliká vo vnútri rámu; ak sa panel medzitým prekreslí,
  // zablikanie na novej karte plynule pokračuje (záporné oneskorenie) a potom sa už neopakuje
  const FLASH_MS = 2800, flashedNew = new Map();
  function flashIf(el, on, id, seen) {
    if (!el || !on) return el;
    el.addEventListener('click', seen, true);
    const now = performance.now();
    if (!flashedNew.has(id)) { // po dobliknutí je novinka videná a jej záložka sa prestane lesknúť
      flashedNew.set(id, now);
      setTimeout(() => { seen(); refreshTabShine(); }, FLASH_MS);
    }
    const age = now - flashedNew.get(id);
    if (age < FLASH_MS) { el.classList.add('newFlash'); el.querySelector('.face').style.animationDelay = (-age) + 'ms'; }
    return el;
  }
  // lesk (.shine): dráha prúžku siaha za pravý okraj prvku a dĺžka cyklu rastie so šírkou – každý prvok prejde celý
  // a rovnakým tempom (na dlhšom ho vidieť dlhšie); prepočíta sa pri každom prebehnutí (prvok mohol zmeniť šírku)
  function fitShine(el) {
    const w = el.offsetWidth;
    if (!w) return;
    const travel = w + 128, move = travel / 150; // priemerne 150 px/s, pohyb zaberá 45 % cyklu
    el.style.setProperty('--shine-end', (w + 64) + 'px');
    el.style.setProperty('--shine-dur', Math.max(3.5, move / 0.45).toFixed(2) + 's');
  }
  for (const ev of ['animationstart', 'animationiteration']) document.addEventListener(ev, e => {
    if (e.animationName !== 'shine') return;
    fitShine(e.target);
    // prvok sa práve ukázal (napr. ťuk na záložku Nákupy): prvé čakanie sa preskočí, prúžok sa pohne do 0,5 s
    if (e.type === 'animationstart') {
      const dur = parseFloat(e.target.style.getPropertyValue('--shine-dur')) || 4;
      e.target.style.setProperty('--shine-delay', -(dur * 0.55 - 0.5).toFixed(2) + 's');
    }
  }, true);
  // pridá lesk na kartu, kým na ňu hráč neťukne
  function shineIf(el, on, seen) {
    if (!el || !on) return el;
    el.classList.add('shine');
    el.addEventListener('click', seen, true);
    return el;
  }
  // úroveň radnice, stavieb a strelcov podľa misie: 1 → úr. 1, 2–3 → úr. 2, 4–5 → úr. 3, 6–8 → úr. 4, 9–10 → úr. 5
  const LVL_FROM = [0, 1, 2, 4, 6, 9];
  const lvlMission = l => LVL_FROM[l];
  // platí najvyššia odomknutá misia, takže aj v skoršej misii má hráč všetky úrovne, ktoré už odomkol
  const lvlCap = () => { const m = Math.max(st.mission, st.unlocked); let l = 1; while (l < MAX_LVL && m >= lvlMission(l + 1)) l++; return l; };
  const hallCap = lvlCap;
  // stavby majú najviac úroveň radnice: drevená radnica = drevené stavby, kameň až po jej vylepšení
  const bCap = () => Math.min(lvlCap(), st.hallLvl);
  const LVL_NAME = ['', 'drevo', 'kameň', 'kameň s kovaním', 'tmavé opevnenie', 'kráľovský kameň'];
  const saveProgress = () => { try { localStorage.setItem(sk('unlocked'), String(st.unlocked)); } catch (e) { } };
  // načíta postup zvolenej pozície do hry
  function loadSlot(n) {
    SLOT = n;
    meta.stars = loadJSON(sk('stars'), []).map(v => Array.isArray(v) ? v : [v || 0, 0, 0]); // staré uloženie (číslo) = medená úroveň
    for (const k in meta.perks) delete meta.perks[k];
    Object.assign(meta.perks, loadJSON(sk('perks9'), {})); // sieň s 9 úrovňami; staré bonusy (sk 'perks') sa nepreberú – hviezdy sa vrátia
    for (const k in meta.perks) if (!PERKS.some(p => p.id === k)) delete meta.perks[k];
    st.race = loadJSON(sk('race'), 'Ľudia');
    st.hero = null; setActiveHero(loadJSON(sk('hero'), 'king'));
    Object.assign(stats, { kills: 0, builds: 0, bosses: 0, orcKings: 0, perfect: 0, maxGold: 0 }, loadJSON(sk('stats'), {}));
    for (const k in ach) delete ach[k];
    Object.assign(ach, loadJSON(sk('ach'), {}));
    achSeen = loadJSON(sk('achSeen'), 0);
    st.unlocked = Math.max(1, Math.min(11, parseInt(localStorage.getItem(sk('unlocked')) || '1', 10) || 1));
    loadSeen();
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
  // vymaže všetko, čo patrí pozícii (aj zvoleného hrdinu, skúsenosti a schopnosti paladina a čarodejky, videné novinky);
  // gemy a kúpení hrdinovia patria hráčovi, nie pozícii, a ostanú
  function clearSlot(n) {
    try {
      const pre = slotKey(n, '');
      for (const k of Object.keys(localStorage)) if (k.startsWith(pre)) localStorage.removeItem(k);
    } catch (e) { }
  }
  let island = null;
  // hra za orkov: kampaň ide po mape opačne (orkská misia 1 = pevnosť orkov hore, uzol 10)
  const isOrc = () => st.race === 'Orkovia';
  const nodeOf = m => isOrc() ? MISSIONS.length - m : m - 1;     // index uzla (provincie) mapy pre misiu m
  const missionAt = i => isOrc() ? MISSIONS.length - i : i + 1;  // misia na uzle i
  const missionDef = m => (isOrc() ? ORC_MISSIONS : MISSIONS)[m - 1];

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
    FH = H + (st.mission > HOME_PROVINCES ? Math.round(H * CAMP_EXTRA) : 0); // misie s táborom: dlhšie bojisko, posúva sa prstom
    buf.width = W; buf.height = FH;
    const oldHc = G.hc0, oldHr = G.hr0, had = !!scene;
    // pevný počet stĺpcov na každom zariadení (zmestí sa aj do najužšej plochy 180 px) – zmena okna tak mriežku neposúva
    G.cols = Math.min(GRID_COLS, Math.floor(W / T)); G.gx0 = Math.floor((W - G.cols * T) / 2);
    G.rows = Math.floor((FH - GROUND_PAD) / T); G.gy0 = FH - GROUND_PAD - G.rows * T;
    G.hc0 = Math.floor(G.cols / 2) - 1; G.hr0 = G.rows - 3;
    G.hallCx = tileX(G.hc0) + 1.5 * T; G.hallTop = tileY(G.hr0); G.hallBot = G.hallTop + 3 * T;
    G.zoneTopMax = tileY(G.rows - (5 + MAX_LVL));
    const lay = typeof CASTLES !== 'undefined' && CASTLES[foeRace()] && CASTLES[foeRace()][st.mission];
    scene = buildScene(W, FH, G, 7 + (nodeOf(st.mission) + 1) * 13, nodeOf(st.mission), campClearRects(lay, G));
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
  // postavička nasadeného hrdinu pri radnici
  const makeHero = () => ({ x: G.hallCx, y: G.hallTop - 12, hx: G.hallCx, hy: G.hallTop - 12, hp: kingMax(), cd: 0, tgt: null, down: 0, anim: 0, flash: 0, isKing: true, spd: heroDef().spd });
  // výmena hrdinu pred vlnou: padnutý zostáva padnutý (až do oživenia), ostatní idú do boja zdraví
  function switchHero(id) {
    if (st.phase !== 'build' || id === st.hero || !ownsHero(id)) return;
    st.heroDead[st.hero] = !!(st.king && st.king.dead);
    setActiveHero(id);
    st.king = makeHero();
    if (st.heroDead[id]) Object.assign(st.king, { dead: true, deadT: 9, fadeT: null }); // porazený leží pred radnicou, kým ho hráč neoživí
    undoStack.length = 0; // späť by vrátilo stav s iným hrdinom
    for (let q = 0; q < 16; q++) part(st.king.x, st.king.y - 6, (Math.random() - 0.5) * 30, -Math.random() * 30, 0.6, ['#f8d048', '#ffffff'][q % 2], 40);
    AUDIO.play('upgrade'); renderBuild(); updateHud();
  }
  function startMission(m, tier) {
    st.run = (st.run || 0) + 1;
    st.mission = m;
    st.tier = tier || 0;
    st.tech = techFor(Math.max(m, st.unlocked)); // platí všetko, čo hráč už odomkol
    layoutField(); // každá misia má vlastnú krajinu
    $('map').hidden = true;
    newGame();
    banner('Misia ' + m + ': ' + missionDef(m).name + (st.tier ? ' · ' + TIERS[st.tier].name : ''));
  }

  // ---- tábor hordy (od misie 6): stavby protivníka hore na bojisku, mimo dostrelu veží (CAMP_ROLES a CAMP_PIECES sú v js/camp.js) ----
  function foeRace() { return isOrc() ? 'human' : 'orc'; } // za orkov stavajú tábory ľudia (zatiaľ bez rozloženia v editore)
  const CAMP_DRUM = 1.2, CAMP_TOTEM = 0.015; // bubon: horda o 20 % rýchlejšia; totem: lieči 1,5 % zdravia za sekundu
  const campLive = () => st.camp ? st.camp.parts.filter(o => o.hp > 0) : [];
  const campHas = role => !!st.camp && st.camp.parts.some(o => o.role === role && o.hp > 0);
  const campPow = () => (1 + 0.2 * (st.mission - HOME_PROVINCES - 1)) * Math.sqrt(TIERS[st.tier || 0].hp);
  // jednotka vlny vyjde z liahne svojho druhu v tábore; keď tábor také liahne mal a všetky padli, ten druh už nepríde
  function spawnFromCamp(item) {
    const all = st.camp ? st.camp.parts.filter(o => o.role === 'spawn' && o.skin.unit === item.type) : [];
    if (!all.length) { spawnEnemy(item); return; }
    const live = all.filter(o => o.hp > 0);
    if (!live.length) return;
    const o = live[Math.floor(Math.random() * live.length)], e = spawnEnemy(item);
    e.x = o.x + (Math.random() - 0.5) * 6; e.y = o.y + 3;
    for (let k = 0; k < 6; k++) part(o.x, o.y, (Math.random() - 0.5) * 24, -Math.random() * 12, 0.4, '#c6a272', 40);
  }
  // tábor misie z hradov editora (js/castles.js): stavby stoja v mriežke bojiska ako budovy hráča
  function makeCamp() {
    const race = foeRace(), lay = typeof CASTLES !== 'undefined' && CASTLES[race] && CASTLES[race][st.mission];
    if (!lay || !lay.length) return null;
    const pieces = CAMP_PIECES[race], mm = (1 + 0.2 * (st.mission - HOME_PROVINCES - 1)) * TIERS[st.tier || 0].hp;
    return {
      rocks: [],
      parts: lay.filter(q => pieces[q.k]).map((q, i) => {
        const pc = pieces[q.k], hp = CAMP_ROLES[pc.role].hp * (pc.hp || 1) * mm, [w, h] = campSize(pc);
        return { kind: q.k, role: pc.role, skin: pc, c: q.c, r: q.r, x: tileX(q.c) + w * T / 2, y: tileY(q.r + h), hp, max: hp, cd: 3 + i * 1.5, flash: 0, fired: 0,
          mask: race === 'human' && CAMP_JOIN[q.k] ? campWallMask(lay, q) : null }; // hradby ľudí sa spájajú ako v hre
      }),
    };
  }
  function nearestCampPart(x, y) {
    let best = null, bd = 1e9;
    for (const o of campLive()) { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  const campAim = o => ({ x: o.x, y: o.y - Math.min(12, o.skin.spr(o, 0).h * 0.4) });
  // zásah stavby tábora; zničená stavba prinesie zlato
  function hitCamp(o, dmg) {
    if (!o || o.hp <= 0) return;
    o.hp -= dmg; o.flash = 0.08;
    for (let k = 0; k < 2; k++) part(o.x + (Math.random() - 0.5) * 10, o.y - 8, (Math.random() - 0.5) * 30, -10 - Math.random() * 20, 0.4, '#4a2e1a', 90);
    if (o.hp > 0) return;
    AUDIO.play('crumble'); st.shake = Math.max(st.shake, 0.2);
    for (let k = 0; k < 26; k++) part(o.x + (Math.random() - 0.5) * 16, o.y - Math.random() * 18, (Math.random() - 0.5) * 60, -Math.random() * 50, 0.9, ['#3c3846', '#22202a', '#4a2e1a', '#f89838'][k % 4], 110);
    const gold = Math.round(CAMP_ROLES[o.role].gold * (1 + 0.1 * (st.mission - HOME_PROVINCES)));
    st.gold += gold; st.texts.push({ x: o.x, y: o.y - 22, s: '+' + gold, life: 1.4, max: 1.4 });
    if (o.role === 'keep') { st.shake = 0.6; for (const q of campLive()) hitCamp(q, q.hp + 1); } // srdce padlo – zrúti sa celý tábor
    updateHud();
  }
  // medzi vlnami horda stojace stavby tábora čiastočne opraví (zbúrané už nepostaví)
  const repairCamp = () => { for (const o of campLive()) o.hp = Math.min(o.max, o.hp + o.max * 0.25); };
  function updateCamp(dt) {
    const C = st.camp;
    if (!C) return;
    const pw = campPow(), a = st.mission - HOME_PROVINCES;
    for (const o of C.parts) {
      o.flash = Math.max(0, o.flash - dt); o.fired = Math.max(0, o.fired - dt);
      if (o.hp <= 0) continue;
      o.cd -= dt;
      if (o.role === 'bombard' && o.cd <= 0) { // balvan na budovu najbližšie k táboru (hradby, veže…), inak na radnicu
        o.cd = Math.max(5, 8 - 0.5 * a);
        let b = null, bd = 1e9;
        for (const q of st.blds) { if (!BUILD[q.kind].hp || TRAPS[q.kind]) continue; const c = bCenter(q), d = Math.hypot(c.x - o.x, c.y - o.y); if (d < bd) { bd = d; b = q; } }
        const tx = b ? bCenter(b).x : G.hallCx + (Math.random() - 0.5) * 20, ty = b ? tileY(b.r) + 8 : G.hallTop + 6, sx = o.x, sy = o.y - 14;
        C.rocks.push({ sx, sy, x: sx, y: sy, gy: sy, tx, ty, t: 0, dur: 1.4 + Math.hypot(tx - sx, ty - sy) / 240, h: 50, tgt: b || HALL, dmg: 26 * pw });
        o.fired = 0.8; AUDIO.play('clang');
      } else if (o.role === 'tower' && o.cd <= 0) { // šíp na najbližšiu jednotku hráča v dosahu
        let tg = null, td = 84;
        for (const u of st.soldiers) { if (u.dead) continue; const d = Math.hypot(u.x - o.x, u.y - (o.y - 24)); if (d < td) { td = d; tg = u; } }
        if (!tg) { o.cd = 0.3; continue; }
        o.cd = 1.5;
        st.eproj.push({ x: o.x, y: o.y - 28, tx: tg.x, ty: tg.y - (tg.fly ? 16 : 6), tgt: tg, dmg: 5 * pw });
      } else if (o.role === 'totem') { // horda sa pomaly lieči
        for (const e of st.enemies) if (!e.dead && e.hp < e.max) {
          e.hp = Math.min(e.max, e.hp + e.max * CAMP_TOTEM * dt);
          if (Math.random() < 0.01) part(e.x + (Math.random() - 0.5) * 6, e.y - e.h * 0.6, 0, -12, 0.5, '#5aff8a', 0);
        }
        if (Math.random() < 0.15) part(o.x + (Math.random() - 0.5) * 6, o.y - 22, (Math.random() - 0.5) * 6, -10, 0.6, '#5aff8a', 0);
      } else if (o.role === 'drum' && o.cd <= 0) { // údery bubna (len efekt, zrýchlenie hordy platí stále)
        o.cd = 0.5;
        for (let k = 0; k < 3; k++) part(o.x + (Math.random() - 0.5) * 10, o.y - 12, (Math.random() - 0.5) * 30, -8 - Math.random() * 8, 0.3, '#ccb08a', 30);
      }
    }
    for (const r of C.rocks) { // balvany z orkských katapultov
      r.t += dt / r.dur;
      const t = Math.min(1, r.t);
      r.x = r.sx + (r.tx - r.sx) * t; r.gy = r.sy + (r.ty - r.sy) * t; r.y = r.gy - Math.sin(Math.PI * t) * r.h;
      if (r.t < 1) continue;
      r.done = true;
      if (r.tgt === HALL) hitHall(r.dmg * 0.6, r.tx);
      else if (st.blds.includes(r.tgt)) hitBuilding(r.tgt, r.dmg);
      for (const u of st.soldiers) if (!u.dead && !u.fly && Math.hypot(u.x - r.tx, u.y - r.ty) < 12) hitUnit(u, r.dmg * 0.4);
      st.shake = Math.max(st.shake, 0.12);
      for (let k = 0; k < 12; k++) part(r.tx, r.ty - 2, (Math.random() - 0.5) * 50, -Math.random() * 35, 0.5, ['#3c3846', '#625a6c', '#967048'][k % 3], 100);
      if (st.phase !== 'battle') return;
    }
    C.rocks = C.rocks.filter(r => !r.done);
  }

  // ---- obliehacie stroje hráča: kupujú sa v záložke Stroje, vyrazia so začiatkom vlny a ostávajú na bojisku ----
  const SIEGE = {
    ram:   { hp: 340, spd: 11, dmg: 70, cd: 1.6,  armor: 0.5, spr: 'siegeRam' },                // ide rovno na tábor a rozbíja ho; bez tábora rozráža hordu
    cat:   { hp: 170, spd: 13, dmg: 55, cd: 3.6,  armor: 0.8, spr: 'siegeCat', range: 105 },   // balvany do najhustejšej hordy, inak na stavby tábora
    fire:  { hp: 210, spd: 12, dmg: 12, cd: 0.6,  armor: 0.7, spr: 'siegeFire', range: 30 },   // strieka grécky oheň: podpáli hordu aj drevené stavby tábora
    tower: { hp: 420, spd: 9,  dmg: 8,  cd: 0.45, armor: 0.6, spr: 'siegeTower', range: 96 },  // dvaja lukostrelci z výšky – ďaleký dostrel, aj na letcov; sprevádza ostatné stroje
  };
  function spawnSiege(kind, x, y) {
    const d = SIEGE[kind], a = Math.max(0, st.mission - HOME_PROVINCES - 1), sm = 1 + 0.06 * perk('siege'), hp = d.hp * (1 + 0.15 * a) * sm;
    st.soldiers.push({ siege: kind, x: x != null ? x : G.hallCx + (Math.random() - 0.5) * 10, y: y != null ? y : G.hallTop - 4, hp, max: hp, dmg: d.dmg * (1 + 0.15 * a) * sm, spd: d.spd, armor: d.armor, spr: d.spr, cd: 0.5, fired: 0, tgt: null, anim: 0, flash: 0, dead: false, slot: st.soldierN++ });
    const u = st.soldiers[st.soldiers.length - 1];
    for (let k = 0; k < 8; k++) part(u.x, u.y - 2, (Math.random() - 0.5) * 30, -Math.random() * 14, 0.4, '#c6a272', 40);
  }
  const GIANT_HUNT = 140; // do tejto vzdialenosti idú obliehacie stroje po obrovi
  function nearestGiant(x, y, rad) {
    let best = null, bd = rad;
    for (const e of st.enemies) if (!e.dead && e.d.giant) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  // ohnivý voz: prúd ohňa k bodu (tx, ty) – zraní a podpáli každého na zemi v úzkom kuželi pred vozom
  // ústie sifónu ohnivého voza voči stredu na zemi (model: 9,5 kocky vpredu, 9,5 kocky vysoko), podľa natočenia
  const fireNozzle = u => { const a = (u.face8 == null ? 6 : u.face8) * Math.PI / 4; return { x: Math.cos(a) * 9.5, y: Math.sin(a) * 9.5 * VOX_DEPTH - 9.5 * VOX_UP }; };
  function sprayFire(u, tx, ty) {
    u.aimP = { x: tx, y: ty }; // natočí sa k cieľu
    const nz = fireNozzle(u), ox = u.x + nz.x, oy = u.y + nz.y, dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy) || 1, rng = SIEGE.fire.range + 6;
    for (const e of st.enemies) {
      if (e.dead || e.d.fly) continue;
      const ex = e.x - ox, ey = e.y - e.h * 0.4 - oy, along = (ex * dx + ey * dy) / d, side = Math.abs(ex * dy - ey * dx) / d;
      if (along < -2 || along > rng || side > 5 + along * 0.25) continue;
      damage(e, u.dmg * (st.cryT > 0 ? CRY_DMG : 1), true); e.burnT = Math.max(e.burnT || 0, 2.5); e.burnDps = Math.max(e.burnDps || 0, u.dmg * 0.5);
    }
    for (let k = 0; k < 10; k++) { const t = Math.random(), sp = (Math.random() - 0.5) * (4 + t * 10); part(ox + dx * t + dy / d * sp, oy + dy * t - dx / d * sp, dx / d * 30, dy / d * 30 - 10, 0.25 + Math.random() * 0.2, ['#fff7c8', '#f8d048', '#f89838', '#d83818'][k % 4], -20); }
    u.fired = 0.3; AUDIO.play('fire');
  }
  // obliehacia veža: šíp z cimburia na nepriateľa v dosahu, alebo (o) na stavbu tábora
  function towerArrow(u, o) {
    const sy = u.y - 18, dmg = u.dmg * (st.cryT > 0 ? CRY_DMG : 1); // z cimburia veže
    if (o) { const a = campAim(o); st.proj.push({ k: 'arrow', x: u.x, y: sy, tgt: null, tx: a.x + (Math.random() - 0.5) * 6, ty: a.y, dmg, spd: 200, splash: 0, vx: 0, vy: -1, campT: o }); AUDIO.play('arrow'); }
    else if (!shoot(u.x, u.y, u.x, sy, SIEGE.tower.range, 'arrow', 200, dmg, 0, ARCHER_PRIO)) return false;
    else st.proj[st.proj.length - 1].siege = true;
    u.fired = 0.2; u.cd = SIEGE.tower.cd;
    return true;
  }
  // katapult: balvan na bod; campT = stavba tábora, ktorú má zasiahnuť
  function catRock(u, tx, ty, dmg, campT) {
    u.aimP = { x: tx, y: ty }; // natočí sa k cieľu
    const sx = u.x, sy = u.y - 12, dist = Math.hypot(tx - sx, ty - sy);
    st.proj.push({ k: 'rock', arc: true, sx, sy, x: sx, y: sy, tx, ty, t: 0, dur: Math.max(0.5, dist / 120), h: 14 + dist * 0.25, dmg, splash: 20, campT, siege: true });
    u.cd = SIEGE.cat.cd; u.fired = 1.0; AUDIO.play('bolt');
  }
  // baranidlo a ohnivý voz idú na tábor, katapult ho ostreľuje z dostrelu, obliehacia veža ich sprevádza;
  // keď tábor nie je (alebo padol), baranidlo rozráža hordu, katapult hádže spoza šíku, ohnivý voz ide so šíkom
  function updateSiege(u, dt) {
    u.flash = Math.max(0, u.flash - dt); u.cd = Math.max(0, u.cd - dt); u.fired = Math.max(0, u.fired - dt); u.swing = 0;
    const fm = st.form || { inf: { x: G.hallCx, y: musterYOf() }, arc: { x: G.hallCx, y: musterYOf() + 16 } };
    const side = (u.slot % 2 ? 1 : -1) * (14 + 10 * (Math.floor(u.slot / 2) % 3));
    const clampX = x => Math.max(G.gx0 + 8, Math.min(G.gx0 + G.cols * T - 8, x));
    const spd = u.spd * 1.5 * waterMul(u), go = (x, y) => moveKnight(u, x, y, spd * backMul(u, x, y), dt); // po vlastnej ceste rýchlejšie, aby stačili šíku
    const giant = nearestGiant(u.x, u.y, GIANT_HUNT); // obor nablízku má prednosť pred táborom aj pred šíkom
    const camp = armyAttacks() && !giant ? nearestCampPart(u.x, u.y) : null; // v obrane ostávajú pri šíku
    if (u.siege === 'ram') {
      if (giant) u.tgt = giant;
      if (camp) { // tábor má prednosť – hordy si nevšíma
        if (Math.hypot(camp.x - u.x, camp.y + 6 - u.y) > 8) { go(camp.x, camp.y + 6); return; }
        if (u.cd > 0) return;
        u.cd = SIEGE.ram.cd; u.swing = 0.2; AUDIO.play('crumble'); st.shake = Math.max(st.shake, 0.08);
        hitCamp(camp, u.dmg);
        return;
      }
      if (u.tgt && (u.tgt.dead || u.tgt.d.fly)) u.tgt = null;
      if (!u.tgt) u.tgt = nearestFoe(u.x, u.y, false);
      if (u.tgt && !u.tgt.d.giant && !armyAttacks() && Math.hypot(u.tgt.x - fm.inf.x, u.tgt.y - fm.inf.y) > 70) u.tgt = null; // v obrane len horda pri šíku
      const t = u.tgt;
      if (!t) { go(clampX(fm.inf.x + side), fm.inf.y - 6); return; }
      if (Math.hypot(t.x - u.x, t.y - u.y) > 10) { go(t.x, t.y + 6); return; }
      if (!t.foe) t.foe = u; // horda sa s ním pobije (má hrubé pancierovanie)
      if (u.cd > 0) return;
      u.cd = SIEGE.ram.cd; u.swing = 0.2; AUDIO.play('crumble'); st.shake = Math.max(st.shake, 0.06);
      damage(t, u.dmg * (t.d.giant ? 1 : 0.6), true);
      return;
    }
    if (u.siege === 'cat') {
      if (u.cd <= 0) { // najprv zhluk hordy v dosahu, inak stavba tábora na dostrel
        let best = null, bn = camp ? 2 : 0;
        for (const e of st.enemies) {
          if (e.dead || e.d.fly || e.y < 4) continue;
          const d = Math.hypot(e.x - u.x, e.y - u.y);
          if (d > SIEGE.cat.range + 15 || d < 28) continue;
          let n = 0; for (const o of st.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 20) n++;
          if (n > bn) { bn = n; best = e; }
        }
        if (giant && Math.hypot(giant.x - u.x, giant.y - u.y) <= SIEGE.cat.range + 15) catRock(u, giant.x, giant.y - 4, u.dmg);
        else if (best) catRock(u, best.x, best.y - 3, u.dmg * 0.5);
        else if (camp && Math.hypot(camp.x - u.x, camp.y - u.y) <= SIEGE.cat.range + 6) catRock(u, camp.x, camp.y - 4, u.dmg, camp);
      }
      if (giant) go(clampX(giant.x + side * 0.5), Math.max(giant.y + SIEGE.cat.range - 20, fm.inf.y - 20));
      else if (camp) go(clampX(camp.x + side * 0.5), camp.y + SIEGE.cat.range - 12);
      else go(clampX(fm.arc.x + side * 1.4), fm.arc.y + 18);
      return;
    }
    if (u.siege === 'fire') {
      const e = nearestFoe(u.x, u.y - 8, false);
      if (e && Math.hypot(e.x - u.x, e.y - u.y) <= SIEGE.fire.range) { if (u.cd <= 0) { u.cd = SIEGE.fire.cd; sprayFire(u, e.x, e.y - e.h * 0.4); } return; }
      if (giant) { go(giant.x, giant.y + SIEGE.fire.range - 8); return; } // podíde k obrovi na dosah plameňa
      if (camp) { // podíde k stavbe tábora a podpáli ju (chatrče a stany horia najlepšie)
        const a = campAim(camp);
        if (Math.hypot(a.x - u.x, a.y - (u.y - 14)) > SIEGE.fire.range - 4) { go(clampX(camp.x + (u.x < camp.x ? -6 : 6)), camp.y + 18); return; }
        if (u.cd > 0) return;
        u.cd = SIEGE.fire.cd; sprayFire(u, a.x, a.y);
        hitCamp(camp, u.dmg * 2.2 * (camp.role === 'spawn' ? 1.5 : 1)); // chatrče a stany horia najlepšie
        return;
      }
      if (e && Math.hypot(e.x - fm.inf.x, e.y - fm.inf.y) < 60) { go(e.x, e.y + SIEGE.fire.range - 8); return; } // horda pri šíku – podíde na dosah
      go(clampX(fm.inf.x + side), fm.inf.y + 12);
      return;
    }
    if (u.siege === 'tower') {
      if (u.cd <= 0 && !towerArrow(u, null) && camp && Math.hypot(camp.x - u.x, camp.y - u.y) <= SIEGE.tower.range) towerArrow(u, camp);
      if (camp) { // sprevádza stroj, ktorý je najbližšie k táboru, inak ide sama na dostrel
        const lead = st.soldiers.filter(s => s.siege && s.siege !== 'tower' && !s.dead).sort((p, q) => p.y - q.y)[0];
        if (lead) go(clampX(lead.x + side * 0.6), lead.y + 18);
        else go(clampX(camp.x + side * 0.5), camp.y + SIEGE.tower.range - 16);
        return;
      }
      go(clampX(fm.arc.x + side), fm.arc.y + 6);
    }
  }

  function newGame() {
    undoStack = [];
    Object.assign(st, {
      wave: 0, gold: Math.round((DIFF.startGold + DIFF.startGoldMission * (st.mission - 1)) * (1 + 0.05 * perk('treasury'))), hallLvl: 1, volleyLvl: 1, volleyT: 0, boss: null, buildTab: 'towers', tool: null, sel: null, shake: 0, soldierN: 0,
      blds: [], paving: {}, enemies: [], soldiers: [], form: null, proj: [], eproj: [], drops: [], parts: [], texts: [], marks: [], spawnQ: [],
      cryT: 0, cryCd: 0, freezeCd: 0, fireCd: 0, boltCd: 0, shieldCd: 0, healCd: 0, fwCd: 0, tpCd: 0, shields: [], fireWalls: [], heroDead: {},
      spellSel: null, siegeOrder: [], siegePick: null, fallFx: [], blasts: [], healFx: [], bolts: [], hallHolyT: 0, stance: 'attack', introPan: null,
    });
    rebuildOcc(); // nová misia: zabudni obsadenie políčok aj cesty hordy z predošlej hry
    st.camp = makeCamp(); // od misie 6 si horda hore na bojisku rozloží tábor
    st.hallHp = hallMax();
    st.king = makeHero();
    $('title').hidden = true; $('over').hidden = true;
    $('hud').hidden = false;
    enterBuild();
  }

  // ---- obtiažnosť (laďené simuláciou celej kampane) ----
  // zdravie rastie v rámci misie (hpWave) aj s misiou (hpMission), zloženie hordy sa posúva o typeShift vĺn na misiu
  const DIFF = {
    // sila nepriateľov podľa misie (násobok zdravia v 1. vlne) – misia 1 je úvodná a ľahká, misia 10 skúška
    missionHp: [0.95, 1.5, 2.3, 2.55, 2.55, 2.7, 2.9, 3.4, 3.2, 4.0], // 6–10 silnejšie: hráč má stajne, zbrojnicu a sokoly
    copperHp:  [1, 1, 1, 1.15, 1.15, 1.15, 1.15, 1.15, 1.15, 1.15], // medená od misie 4 tuhšia (hrdina má schopnosti)
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
      const giants = (GIANTS[m] || {})[w] || [];
      for (const type of giants) q.splice(Math.floor(q.length * 0.15), 0, { type, gap: 2.5, hpMul: tr.hp * (1 + 0.15 * (m - 7)) }); // obri vyrážajú skoro – sú pomalí
      // vojvodca je pomalý – vyrazí už po prvej pätine hordy, aby dorazil spolu s ňou (nie dlho po nej); v 5. vlne s obrom nejde
      if (!(giants.length && w < MISSION_WAVES)) q.splice(Math.floor(q.length * 0.2), 0, { type: 'warlord', gap: 1.2, hpMul: bossMul });
      if (w === MISSION_WAVES && m >= 8) q.splice(Math.floor(q.length * 0.45), 0, { type: 'warlord', gap: 1.2, hpMul: bossMul });
      if (w === MISSION_WAVES && m === MISSIONS.length) q.splice(Math.floor(q.length * 0.6), 0, { type: 'orcKing', gap: 1.5, hpMul: tr.hp * 0.75, fromCamp: true }); // veľkráľ vyjde z tábora (popri dvoch vojvodcoch o štvrtinu slabší)
    }
    return q;
  }

  // schopnosti hrdinu po vlne dohasnú – nič z nich (pokrik, štít, ohnivá stena, padajúca guľa, zvolené kúzlo) sa neprenesie do ďalšej vlny
  function clearHeroFx() {
    st.cryT = 0; st.spellSel = null;
    st.fireWalls = []; st.shields = []; st.fallFx = []; st.bolts = []; st.blasts = []; st.healFx = [];
    st.hallHolyT = 0; for (const b of st.blds) b.holyT = 0;
    for (const s of st.soldiers) s.stunT = 0;
  }
  const reviveSeen = () => !!loadJSON(sk('reviveSeen'), false); // hráč už videl, kde sa oživuje padnutý hrdina
  function enterBuild() {
    st.phase = 'build';
    st.moving = null;
    AUDIO.music('build');
    st.tool = null; st.sel = null;
    $('bottom').hidden = true;
    // rytieri a kráľ sa vrátia a vyliečia
    for (const s of st.soldiers) { s.hp = s.max; s.tgt = null; }
    clearHeroFx();
    if (st.king && st.king.dead) st.king.deadT = Math.max(st.king.deadT, 1); // padnutý hrdina ostane omráčený ležať aj počas stavby, kým ho hráč neoživí
    if (st.king && st.king.dead && !reviveSeen()) st.sel = HALL; // hrdina padol prvý raz: stavanie začne s otvorenou radnicou
    if (st.king && !st.king.dead) { st.king.hp = kingMax(); st.king.down = 0; st.king.tgt = null; st.king.flash = 0; st.king.swing = 0; st.king.tpBack = 0; } // domov dôjde sám (heroWalkHome)
    for (const b of st.blds) b.flash = 0;
    $('build').hidden = false;
    renderBuild();
    updateHud();
    if (kingMeta.pending) later(() => { if (st.phase === 'build') showTalentPick(); }, 600);
    st.viewUp = 0;
    if (st.wave > 0) repairCamp();
    else if (st.camp) st.introPan = { t: 0 }; // začiatok misie: kamera najprv ukáže tábor hordy, potom sa zvezie k radnici
  }

  function startWave() {
    undoStack = [];
    for (const id in SPELLS) st[SPELLS[id].cdKey] = 0; // každá vlna začína s nabitými schopnosťami hrdinu
    clearHeroFx();
    st.wave++;
    st.spawnQ = buildWave(st.wave);
    st.spawnT = 1.2;
    st.phase = 'battle';
    launchSiege();
    st.tool = null; st.sel = null; st.moving = null; bdrag = null;
    AUDIO.play('horn'); AUDIO.music('battle');
    st.viewUp = Math.max(0, (st.viewUp || 0) - panelLow()); // rovnaký pohľad aj bez panela
    $('build').hidden = true; $('bottom').hidden = false;
    for (const b of st.blds) if (UNIT_HOME[b.kind] || b.kind === 'range' || b.kind === 'falconry' || HELPERS[b.kind]) b.spawnT = HELPERS[b.kind] ? 0.6 : 0.3;
    banner(st.wave === MISSION_WAVES ? 'Posledná vlna!' : 'Vlna ' + st.wave + ' / ' + MISSION_WAVES);
    syncStance();
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
    st.phase = 'pause';
    st.proj = []; st.eproj = []; st.drops = [];
    if (st.camp) st.camp.rocks = [];
    clearHeroFx();
    // rytieri sa po vlne vrátia do kasární, obliehacie stroje ostanú stáť na bojisku
    for (const sd of st.soldiers) if (!sd.siege) for (let k = 0; k < 5; k++) part(sd.x, sd.y - 5, (Math.random() - 0.5) * 20, -Math.random() * 20, 0.4, '#88b4ff', 30);
    st.soldiers = st.soldiers.filter(s => s.siege);
    if (st.wave >= MISSION_WAVES) { missionWon(); return; }
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
    $('hud-boss').hidden = true; $('bottom').hidden = true;
    const first = t === 0 && m >= st.unlocked;
    if (first) {
      st.provAnim = { i: nodeOf(m), t: 0, from: m <= HOME_PROVINCES ? 'attacked' : 'horde' }; // provincia sa na mape prefarbí na modro
      st.unlocked = Math.min(11, m + 1); saveProgress(); st.mapAnim = { seg: m - 1, t: 0 };
    }
    banner('Misia splnená!');
    AUDIO.music(null); AUDIO.play('win');
    for (let k = 0; k < 80; k++) part(Math.random() * W, camY + H * 0.3 + Math.random() * 30, (Math.random() - 0.5) * 60, -30 - Math.random() * 60, 1.4, ['#f8d048', '#fff070', '#88b4ff', '#e84838'][k % 4], 60);
    const text = m === MISSIONS.length
      ? 'Porazil si poslednú hordu. <b>Ostrov je oslobodený!</b>'
      : 'Misia ' + m + ' · ' + missionDef(m).name + ' · ' + TIERS[t].name.toLowerCase() + ' úroveň<br>Všetkých ' + MISSION_WAVES + ' vĺn odrazených.' + (first ? '<br>Odomkla sa misia ' + (m + 1) + '.<br><span class="newTech">Nové: ' + UNLOCKS[m].map(u => u.name).join(', ') + '</span>' : '');
    const starLine = '<span class="bigStars">' + starSpan(stars, t) + '</span>' +
      (stars > prevStars ? '<br><span class="newTech">+' + (stars - prevStars) + ' ★ do Kráľovskej siene</span>' : '') + tierNote;
    const xpLine = st.lastXp ? '<br><span class="newTech">' + heroName() + ' +' + st.lastXp + ' XP' + (kingMeta.pending ? ' · nová úroveň ' + kingMeta.lvl + '!' : '') + '</span>' : '';
    later(() => showOver(m === MISSIONS.length ? 'Víťazstvo!' : 'Misia splnená!', starLine + '<br>' + text + xpLine, true), 1200);
    saveStats(); later(checkAch, 2200);
    updateHud();
  }

  function gameOver() {
    st.phase = 'over';
    saveStats();
    st.hallHp = 0;
    const survived = st.wave - 1;
    $('hud-boss').hidden = true; $('bottom').hidden = true;
    const hr = hallRect();
    for (let k = 0; k < 60; k++) {
      part(hr.x0 + Math.random() * (hr.x1 - hr.x0), hr.y0 - 10 + Math.random() * 40, (Math.random() - 0.5) * 50, -Math.random() * 50, 1.3, ['#6a6a78', '#3e3e4c', '#f89838', '#d83818'][k % 4], 60);
    }
    st.shake = 0.6;
    AUDIO.music(null); AUDIO.play('crumble'); setTimeout(() => AUDIO.play('lose'), 500);
    later(() => showOver('Radnica padla!', 'Misia ' + st.mission + ' · ' + missionDef(st.mission).name + (st.tier ? ' · ' + TIERS[st.tier].name.toLowerCase() + ' úroveň' : '') + '<br>Prežité vlny: <b>' + survived + ' / ' + MISSION_WAVES + '</b>', false), 1200);
    updateHud();
  }

  function spawnEnemy(item) {
    const d = ENEMY[item.type];
    const spr = SPR[d.spr][0];
    const e = {
      d, x: scene.spawn[0] + spr.w / 2 + Math.random() * Math.max(1, scene.spawn[1] - scene.spawn[0] - spr.w),
      y: -2,
      hp: d.hp * item.hpMul, max: d.hp * item.hpMul, spd: d.speed * (0.9 + Math.random() * 0.2),
      atk: Math.random() * d.atkCd, anim: Math.random() * 2, flash: 0, lunge: 0,
      jx: (Math.random() - 0.5) * 7, jy: (Math.random() - 0.5) * 5, ph: Math.random() * 6.28,
      w: spr.w, h: spr.h, dead: false, foe: null, trap: null, attacking: false, pow: Math.sqrt(item.hpMul),
    };
    if (d.king) { e.stompT = 3; e.summonT = 4; }
    if (item.fromCamp && st.camp) { const k = st.camp.parts.find(o => o.role === 'keep' && o.hp > 0); e.x = k ? k.x : scene.fortX; e.y = k ? k.y + 4 : G.gy0 + 52; st.shake = 0.5; } // vyjde z pevnosti tábora (alebo spomedzi stavieb)
    st.enemies.push(e);
    if (d.boss && !(st.boss && st.boss.d.king && !st.boss.dead)) { st.boss = e; AUDIO.play('boss'); }
    return e;
  }

  // siege = zásah obliehacím strojom (obrom ublíži naplno, ostatné ich len škrabne)
  function damage(e, dmg, siege) {
    if (e.dead) return;
    if (e.d.giant) dmg *= siege ? GIANT_SIEGE : GIANT_ARMOR;
    e.hp -= dmg;
    e.flash = 0.08;
    AUDIO.play('hit');
    const armored = e.d.giant && !siege; // pancier: namiesto krvi odletia iskry
    for (let k = 0; k < 3; k++) part(e.x + (Math.random() - 0.5) * e.w * 0.4, e.y - e.h * 0.55, (Math.random() - 0.5) * 50, -Math.random() * 30, 0.35, armored ? (k % 2 ? '#e0e0ea' : '#f8d048') : e.d.blood, 120);
    if (e.hp <= 0) kill(e);
  }

  function kill(e) {
    e.dead = true;
    AUDIO.play('die'); AUDIO.play('coin');
    const gain = Math.round(e.d.gold * goldMul() * (1 + 0.04 * perk('loot')));
    st.gold += gain;
    st.texts.push({ x: e.x, y: e.y - e.h, s: '+' + gain, life: 0.9, max: 0.9 });
    const cols = [e.d.blood, '#305c22', '#6e4422', '#1c140e'];
    const n = e.d.boss ? 50 : 12;
    for (let k = 0; k < n; k++) {
      part(e.x + (Math.random() - 0.5) * e.w * 0.6, e.y - Math.random() * e.h,
        (Math.random() - 0.5) * 60, -20 - Math.random() * 50, 0.5 + Math.random() * 0.4, cols[k % cols.length], 140);
    }
    if (e.d.boss) { if (st.boss === e) st.boss = null; st.shake = e.d.king ? 0.8 : 0.4; }
    stats.kills++; if (e.d.boss) { if (e.d.king) stats.orcKings++; else stats.bosses++; }
    stats.maxGold = Math.max(stats.maxGold, st.gold);
    checkAch();
    updateHud();
  }

  const shieldAt = (x, y) => st.shields && st.shields.some(sh => Math.hypot(x - sh.x, (y - sh.y) / 0.7) < sh.R);
  function hitBuilding(b, dmg, attacker) {
    if (b.holyT > 0 || shieldAt(tileX(b.c) + T / 2, tileY(b.r) + T / 2)) { if (Math.random() < 0.3) part(tileX(b.c) + T / 2, tileY(b.r) + 4, (Math.random() - 0.5) * 20, -10, 0.3, '#fff070', 0); return; }
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
    if (st.hallHolyT > 0 || shieldAt(x, G.hallTop + 4)) { if (Math.random() < 0.3) part(x, G.hallTop + 2, (Math.random() - 0.5) * 20, -10, 0.3, '#fff070', 0); return; }
    st.hallHp -= dmg;
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

  // ---- orkský veľkráľ (boss 10. misie): vyjde z tábora v poslednej vlne, dupnutím omračuje a privoláva goblinov ----
  const KING_STOMP = { cd: 6, r: 28, stun: 2 }, KING_SUMMON = { cd: 9, n: 3, max: 9 };
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

  // vojnový mamut: goblini z vežičky strieľajú za chôdze na najbližšiu jednotku či budovu, mamut šliape po vojakoch pod sebou
  function mammothAct(e, dt) {
    e.bowT = (e.bowT == null ? 1 : e.bowT) - dt; e.stompT2 = (e.stompT2 || 0) - dt;
    if (e.bowT <= 0) {
      let tg = null, td = 76;
      for (const u of st.soldiers) { if (u.dead || u.fly) continue; const d = Math.hypot(u.x - e.x, u.y - e.y); if (d < td) { td = d; tg = u; } }
      if (!tg) for (const b of st.blds) { if (!BUILD[b.kind].block) continue; const c = bCenter(b), d = Math.hypot(c.x - e.x, c.y - e.y); if (d < td) { td = d; tg = b; } }
      e.bowT = tg ? 0.9 : 0.3;
      if (tg) {
        const sx = e.x + (Math.random() < 0.5 ? -4 : 3), sy = e.y - e.h + 5;
        const tx = tg.kind ? tileX(tg.c) + T / 2 : tg.x, ty = tg.kind ? tileY(tg.r) + 4 : tg.y - 6;
        st.eproj.push({ x: sx, y: sy, tx, ty, tgt: tg, dmg: 6 * e.pow });
      }
    }
    if (e.stompT2 <= 0) {
      e.stompT2 = 0.8;
      for (const u of st.soldiers) if (!u.dead && !u.fly && !u.helper && Math.hypot(u.x - e.x, u.y - e.y) < 11) { hitUnit(u, e.d.atk * 0.4 * e.pow); part(u.x, u.y - 2, (Math.random() - 0.5) * 20, -10, 0.3, '#967048', 60); }
    }
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
    if (e.kb) { // odhodený tlakovou vlnou: kĺže preč, potom zostane omráčený
      e.x += e.kb.vx * dt; e.y += e.kb.vy * dt; e.kb.t -= dt;
      e.x = Math.max(4, Math.min(W - 4, e.x));
      if (e.kb.t <= 0) e.kb = null;
    }
    if (e.stunT > 0) { e.stunT -= dt; return; }
    if (e.frostT > 0) { // zasiahnutý mrazom: takmer stojí aj neútočí
      e.frostT -= dt; dt *= 0.12;
      if (Math.random() < 0.3) part(e.x + (Math.random() - 0.5) * e.w * 0.6, e.y - Math.random() * e.h, 0, -4, 0.5, Math.random() < 0.5 ? '#e0f4ff' : '#88c8ff', 0);
    }
    if (e.d.king && updateOrcKing(e, dt)) return;
    if (e.d.charge) bearCharge(e, dt);
    if (e.d.howdah) mammothAct(e, dt);
    if (e.chillT > 0) { e.chillT -= dt; if (Math.random() < 0.2) part(e.x + (Math.random() - 0.5) * e.w * 0.5, e.y - Math.random() * e.h, 0, -6, 0.4, '#e0f4ff', 0); }
    const slow = (e.chillT > 0 ? 0.5 : 1) * (campHas('drum') ? CAMP_DRUM : 1); // vojnový bubon tábora hordu zrýchli
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
    if (!e.foe && !e.d.ram && !e.d.sapper) for (const s of st.soldiers) if ((s.helper || s.archer || s.siege) && !s.fly && !s.dead && Math.hypot(s.x - e.x, s.y - e.y) < (s.siege ? 12 : 9)) { e.foe = s; break; } // aj obliehací stroj, okolo ktorého ide
    // čarodejka nikoho nenapadne mečom, preto si ju horda nájde sama, keď je blízko
    const sk0 = st.king;
    if (!e.foe && !e.d.ram && !e.d.sapper && !e.d.fly && sk0 && !sk0.dead && heroDef().range && Math.hypot(sk0.x - e.x, sk0.y - e.y) < 14) e.foe = sk0;
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
      if (st.king && !st.king.dead && heroDef().range) { const d = Math.hypot(st.king.x - e.x, st.king.y - e.y); if (d < td * 0.8) { td = d; tgt = st.king; } } // aj na čarodejku
      if (tgt) {
        e.aimP = tgt === HALL ? { x: Math.max(hrr.x0, Math.min(hrr.x1, e.x)), y: hrr.y0 } : tgt.kind ? { x: tileX(tgt.c) + T / 2, y: tileY(tgt.r) + T / 2 } : { x: tgt.x, y: tgt.y };
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
    if (nearB) { e.aimP = { x: tileX(nearB.c) + T / 2, y: tileY(nearB.r) + T / 2 }; attack(() => hitBuilding(nearB, e.d.atk, e)); return; }
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
      if (Math.hypot(tx - e.x, ty - e.y) <= 2.5) { e.aimP = { x: qx, y: hr.y0 + 8 }; attack(() => hitHall(e.d.atk, e.x)); return; }
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

  // pešiak búra stavbu tábora: obstúpi ju z bokov (podľa poradia, aby nestáli v jednom bode) a bije do nej
  function strikeCamp(u, o, dt) {
    u.flash = Math.max(0, u.flash - dt); u.cd = Math.max(0, u.cd - dt); u.swing = Math.max(0, (u.swing || 0) - dt);
    const cry = st.cryT > 0, spd = (u.spd || 26) * (cry ? CRY_SPD : 1) * waterMul(u);
    const side = u.x < o.x ? -1 : 1, reach = u.ktype === 'spear' ? 12 : 7 + (u.slot % 3) * 2;
    const tx = o.x + side * reach, ty = o.y + 2 + ((u.slot % 3) - 1) * 3;
    if (Math.hypot(tx - u.x, ty - u.y) > 2) { moveKnight(u, tx, ty, spd, dt); u.run = (u.run || 0) + spd * dt; return; }
    if (u.cd > 0) return;
    u.cd = 0.8; u.swing = 0.15; u.run = 0; AUDIO.play('clang');
    hitCamp(o, u.dmg * (cry ? CRY_DMG : 1));
  }
  // vlastní pešiaci sa navzájom jemne odtláčajú, aby nestáli jeden v druhom
  function separateSoldiers() {
    const us = st.soldiers.filter(s => !s.fly && !s.dead);
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, min = a.siege || b.siege ? 11 : 7;
      if (d2 > min * min || d2 < 0.01) continue;
      const d = Math.sqrt(d2), push = (min - d) * 0.2;
      a.x -= dx / d * push; a.y -= dy / d * push * 0.6;
      b.x += dx / d * push; b.y += dy / d * push * 0.6;
    }
  }

  function hitUnit(u, dmg) {
    if (u.isKing && u.tpBack > 0) return; // čarodejku počas teleportu nič nezraní
    u.hp -= dmg * (u.armor || 1); u.flash = 0.08;
    part(u.x, u.y - 6, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.3, '#e84838', 100);
    if (u.hp > 0) return;
    if (u.isKing) { // kráľ padol – do konca vlny nebojuje, po vlne ho možno oživiť za zlato
      u.dead = true; u.deadT = 0; u.fadeT = null; u.tgt = null; u.flash = 0;
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
  // hrdina bráni celú šírku stavebnej zóny: okrem okruhu pred radnicou zasiahne aj nepriateľa kdekoľvek v zóne
  // alebo tesne pred ňou (napr. pri veži na okraji)
  const heroBandTop = () => tileY(zoneTopRow()) - T - 10 * tal('reach');
  const heroReaches = (e, aggro) => Math.hypot(e.x - st.king.hx, e.y - st.king.hy) <= aggro || e.y >= heroBandTop();
  // stihne hrdina nepriateľa, kým ho zničia iní? Sčíta strely, ktoré už k nemu letia, a poškodenie,
  // ktoré mu za čas cesty hrdinu dajú veže (strieľajú na toho, kto je najbližšie k radnici) a rytier, s ktorým bojuje
  const TOWER_KINDS = { tower: 1, mage: 1, icetower: 1, ballista: 1 };
  function doomed(e, eta) {
    let dmg = 0;
    for (const p of st.proj) if (p.tgt === e) dmg += p.dmg || 0;
    if (dmg >= e.hp) return true;
    let dps = 0;
    const tileDist = q => { const t = tileAt(q.x, q.y); return st.dist[t.r * G.cols + t.c] || 0; };
    const de = tileDist(e);
    for (const b of st.blds) {
      if (!TOWER_KINDS[b.kind] || (b.hp != null && b.hp <= 0)) continue;
      const c = bCenter(b), rng = bRange(b);
      if (Math.hypot(e.x - c.x, e.y - c.y) > rng) continue;
      if (st.enemies.some(o => o !== e && !o.dead && o.y >= 4 && Math.hypot(o.x - c.x, o.y - c.y) <= rng && tileDist(o) < de)) continue; // veža mieri na iného
      dps += bDmg(b) / bCd(b);
    }
    if (e.foe && e.foe !== st.king && !e.foe.dead) dps += (e.foe.dmg || 0) / 0.8;
    return dmg + dps * eta >= e.hp;
  }
  // čas, za ktorý hrdina dôjde k nepriateľovi na dosah úderu
  const heroEta = (u, e, reach) => Math.max(0, Math.hypot(e.x - u.x, e.y - u.y) - reach) / Math.max(1, u.spd || 20);
  function nearestEnemyWhere(x, y, ok, preferFree, fly) {
    let best = null, bd = 1e9;
    for (const e of st.enemies) {
      if (e.dead || (e.d.fly && !fly) || !ok(e)) continue;
      let d = Math.hypot(e.x - x, e.y - y);
      if (preferFree && e.foe) d += 25;
      if (d < bd) { bd = d; best = e; }
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
      if (preferFree) d += 12 * (e.atkN || 0);
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

  // cesta jednotiek po políčkach: bránou a voľným priestorom, cez vlastné budovy (veže, bane…) len keď inak niet cesty –
  // vstup do budovy stojí ako dlhá obchádzka. Pole vzdialeností k cieľu sa pamätá, kým sa rozostavenie nezmení.
  const BLD_STEP = 25;
  let kField = { pass: null, fields: new Map() };
  function passField() { // 0 = neprejde, 1 = voľno / brána, 2 = cez budovu
    const p = new Uint8Array(G.cols * G.rows);
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
      if (!knightPass(c, r)) continue;
      const o = occAt(c, r);
      p[r * G.cols + c] = o && o !== HALL && o.kind !== 'wall' ? 2 : 1;
    }
    return p;
  }
  function distField(goal, pass) {
    const n = pass.length, dist = new Float32Array(n).fill(Infinity), done = new Uint8Array(n);
    dist[goal] = 0;
    for (;;) { // Dijkstra (políčok je málo)
      let i = -1, bd = Infinity;
      for (let k = 0; k < n; k++) if (!done[k] && dist[k] < bd) { bd = dist[k]; i = k; }
      if (i < 0) break;
      done[i] = 1;
      const c = i % G.cols, r = (i / G.cols) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
        const ni = nr * G.cols + nc, pv = pass[ni];
        if (!pv || done[ni]) continue;
        const nd = bd + (pv === 2 ? BLD_STEP : 1);
        if (nd < dist[ni]) dist[ni] = nd;
      }
    }
    return dist;
  }
  function knightStep(a, b) {
    const pass = passField();
    if (!kField.pass || kField.pass.length !== pass.length || kField.pass.some((v, i) => v !== pass[i])) kField = { pass, fields: new Map() };
    const goal = b.r * G.cols + b.c, startI = a.r * G.cols + a.c;
    let dist = kField.fields.get(goal);
    if (!dist) { if (kField.fields.size > 80) kField.fields.clear(); dist = distField(goal, pass); kField.fields.set(goal, dist); }
    let best = null, bd = dist[startI]; // stojí v budove (napr. pri kasárňach): vyberie najlepšieho suseda
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = a.c + dc, nr = a.r + dr;
      if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
      const v = dist[nr * G.cols + nc];
      if (v === Infinity) continue;
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

  // čarodejka: stojí pri radnici a strieľa ohnivé strely na najbližšieho nepriateľa (aj na netopiere); bez cieľa sa vracia domov
  function updateSorc(k, dt) {
    k.flash = Math.max(0, k.flash - dt); k.cd = Math.max(0, k.cd - dt); k.swing = Math.max(0, (k.swing || 0) - dt);
    const rng = heroDef().range + 10 * tal('reach');
    // cieľ si drží, kým žije a je na dostrel (inak by sa medzi výstrelmi otáčala k inému, než ktorého práve zasahuje);
    // prednosť má ten, kto ju práve napadol zblízka; inak najbližší v dostrele alebo v stavebnej zóne – k tomu podíde
    const keep = k.aim && !k.aim.dead && Math.hypot(k.aim.x - k.x, k.aim.y - k.y) <= rng + 8 ? k.aim : null;
    const attacker = nearestEnemyWhere(k.x, k.y, e => e.foe === k && Math.hypot(e.x - k.x, e.y - k.y) < 16, false, true);
    const t = attacker || keep || nearestEnemyWhere(k.x, k.y, e => Math.hypot(e.x - k.x, e.y - k.y) <= rng || (heroReaches(e, 0) && !doomed(e, heroEta(k, e, rng))), false, true);
    const inRng = t && Math.hypot(t.x - k.x, t.y - k.y) <= rng + (t === keep ? 8 : 0);
    k.aim = inRng ? t : null;
    if (t && !inRng) { moveKnight(k, t.x, t.y, k.spd * waterMul(k), dt); k.anim += dt * 6; }
    else if (t) {
      if (k.cd <= 0) {
        k.cd = heroDef().cd * (1 - 0.12 * tal('swift')) * (st.cryT > 0 ? 0.6 : 1); k.swing = 0.15;
        const set = hero8('sorc');
        if (set) k.face8 = dir8(t.x - k.x, t.y - k.y); // natočí sa k cieľu ešte pred výstrelom
        const tip = set ? set[k.face8].tip : { x: 5, y: -15 };
        st.proj.push({ k: 'fire', x: k.x + tip.x, y: k.y + tip.y, tgt: t, tx: t.x, ty: t.y - t.h * 0.5, dmg: kingDmg(), spd: 150, splash: 8, vx: 0, vy: -1 });
        AUDIO.play('fire');
      }
    } else if (Math.hypot(k.hx - k.x, k.hy - k.y) > 2) { moveKnight(k, k.hx, k.hy, k.spd * waterMul(k), dt); k.anim += dt * 6; }
  }
  // rytier alebo kráľ: nájdi nepriateľa v okruhu domova, bojuj, inak sa vráť
  function updateFighter(u, dt, homeX, homeY, aggro, dmg, cleave, mover) {
    const go = mover || moveTo;
    u.flash = Math.max(0, u.flash - dt);
    u.cd = Math.max(0, u.cd - dt);
    const far = e => u.isKing ? !heroReaches(e, aggro + 16) : Math.hypot(e.x - homeX, e.y - homeY) > aggro + 16;
    if (u.tgt && (u.tgt.dead || far(u.tgt))) u.tgt = null;
    // jazdec si vyberá strelcov, šamanov a podkopníkov; ostatní najbližšieho
    if (!u.tgt && u.ktype === 'rider') u.tgt = priorityEnemy(homeX, homeY, aggro, RIDER_PRIO);
    if (u.ktype === 'spear' && !(u.tgt && u.tgt.d.cav)) { const c = priorityEnemy(u.x, u.y, 90, e => e.d.cav); if (c) u.tgt = c; } // kopijník vyráža proti jazde
    // hrdina nevyráža po nepriateľovi, ktorého aj tak zničia iní skôr, než k nemu dôjde (inak by len poskakoval tam a späť)
    if (!u.tgt) u.tgt = u.isKing ? nearestEnemyWhere(u.x, u.y, e => heroReaches(e, aggro) && !doomed(e, heroEta(u, e, 8)), true) : nearestEnemy(homeX, homeY, aggro, true);
    const t = u.tgt;
    const cry = st.cryT > 0 ? 1 : 0, spd = (u.spd || 26) * (1 + (CRY_SPD - 1) * cry) * waterMul(u);
    if (cry) dmg *= CRY_DMG;
    if (t) {
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      const spear = u.ktype === 'spear', reach = spear ? SPEAR_REACH : 8, off = spear ? 12 : 5; // kopijník bodá spoza rytiera
      // viacerí na jedného: obstúpia ho z bokov a mierne nad/pod sebou, nestoja v jednom bode
      if (d > reach) { go(u, t.x + (u.x < t.x ? -off : off), t.y + 1 + (u.isKing ? 0 : ((u.slot || 0) % 3 - 1) * 4), spd, dt); u.run = (u.run || 0) + spd * dt; }
      else {
        if (!t.foe) t.foe = u;
        if (u.cd <= 0) {
          u.cd = u.isKing ? heroDef().cd * (1 - 0.12 * tal('swift')) : 0.8; u.swing = u.isKing ? 0.3 : 0.15; // kráľov úder má dlhší švih (3 snímky)
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

  function fireFrom(b) {
    const def = BUILD[b.kind], c = bCenter(b);
    return shoot(c.x, c.y, c.x, tileY(b.r) + T - (b.kind === 'mage' ? 36 : 28), bRange(b), b.spec === 'fire' ? 'farrow' : def.proj, def.speed * (b.spec === 'sniper' ? 1.4 : 1), bDmg(b), def.splash || 0);
  }
  // ľadová veža: strela spomalí cieľ aj susedov (spomalenie sa predlžuje s úrovňou)
  function fireIce(b) {
    const def = BUILD.icetower, c = bCenter(b);
    if (!shoot(c.x, c.y, c.x, tileY(b.r) + T - 38, bRange(b), 'ice', def.speed, bDmg(b), 0)) return false;
    st.proj[st.proj.length - 1].chill = def.chill + 0.3 * (b.lvl - 1);
    return true;
  }
  // balista: šíp letí rovno cez cieľ až na koniec dosahu a zraní každého na zemi, koho cestou prebodne
  function fireBallista(b) {
    const def = BUILD.ballista, c = bCenter(b), rng = bRange(b), ox = c.x, oy = tileY(b.r) + T - 26;
    let best = null, bd = 1e9;
    for (const e of st.enemies) {
      if (e.dead || e.d.fly || e.y < 4 || Math.hypot(e.x - c.x, e.y - c.y) > rng) continue;
      const t = tileAt(e.x, e.y), v = st.dist[t.r * G.cols + t.c] || 0;
      if (v < bd) { bd = v; best = e; }
    }
    if (!best) return false;
    const dx = best.x - ox, dy = best.y - best.h * 0.5 - oy, d = Math.hypot(dx, dy) || 1;
    st.proj.push({ k: 'lance', lance: true, x: ox, y: oy, vx: dx / d, vy: dy / d, spd: def.speed, dmg: bDmg(b), trav: 0, max: rng + 24, hit: new Set() });
    AUDIO.play('lance');
    return true;
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
  const falconHp = b => 22 * lvlMul(b, 0.3) * (1 + 0.05 * perk('drill'));
  const falconDmg = b => 5 * lvlMul(b, 0.35) * (1 + 0.05 * perk('drill'));
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
    // nič na love: krúži nad svojou sokoliarňou
    const c = (u.home && st.blds.includes(u.home) ? bCenter(u.home) : { x: G.hallCx, y: G.hallTop });
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
  // ---- formácie: lukostrelci stoja v rade vedľa seba, pešiaci pochodujú v šíkoch –
  // rytieri vpredu, kopijníci za nimi, jazdci na krídlach. Šík sa posúva plynulo za najbližšou hordou
  // a pešiak vybehne z radu až keď má nepriateľa nablízku (alebo keď sa šík s hordou zrazil).
  const FORM_GAP = 10, FORM_ROW = 9, FORM_MAX = 8, FORM_SPD = 20, ENGAGE = 36, CLASH = 70;
  // prepínač armády: útok = šík ide oproti horde a voľní vojaci búrajú tábor; obrana = šík drží miesto pred zónou
  const armyAttacks = () => st.stance !== 'defend';
  const RIDER_GUARD = 90; // v obrane jazdec vyráža len do tejto vzdialenosti od svojho miesta
  const formLeft = () => G.gx0 + 6, formRight = () => G.gx0 + G.cols * T - 6;
  const formPer = () => Math.max(1, Math.min(FORM_MAX, Math.floor((formRight() - formLeft()) / FORM_GAP) + 1));
  // n miest v radoch so stredom cx: predný rad na y, ďalšie rady za ním (k radnici), každý druhý posunutý o pol medzery
  function formSlots(n, cx, y) {
    const per = formPer(), out = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / per), inRow = Math.min(per, n - row * per), k = i - row * per, half = (inRow - 1) / 2 * FORM_GAP;
      const c = Math.max(formLeft() + half, Math.min(formRight() - half, cx));
      out.push({ x: Math.max(formLeft(), Math.min(formRight(), c + (k - (inRow - 1) / 2) * FORM_GAP + (row % 2 ? FORM_GAP / 2 : 0))), y: y + row * FORM_ROW });
    }
    return out;
  }
  const formRows = n => Math.ceil(n / formPer());
  // jednotky aj miesta zoradí zľava doprava a spáruje – nikto nekríži cestu susedovi
  function assignSlots(us, slots) {
    const a = us.slice().sort((p, q) => p.x - q.x || p.slot - q.slot), b = slots.slice().sort((p, q) => p.x - q.x || p.y - q.y);
    a.forEach((u, i) => { u.fslot = b[i]; });
  }
  // plynulý posun bodu šíku k cieľu (šík pochoduje, neskáče)
  function stepAnchor(a, tx, ty, dt) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), s = Math.min(d, FORM_SPD * dt);
    if (d > 0.01) { a.x += dx / d * s; a.y += dy / d * s; }
  }
  function nearestFoe(x, y, fly) {
    let best = null, bd = 1e9;
    for (const e of st.enemies) {
      if (e.dead || e.y <= 4 || (e.d.fly && !fly)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // rozmiestni šíky (pešiaci + lukostrelci); volá sa raz za snímku
  function updateFormations(dt, musterY) {
    const cx = G.gx0 + G.cols * T / 2;
    if (!st.form) st.form = { inf: { x: cx, y: musterY }, arc: { x: cx, y: musterY + 16 }, contact: false };
    const F = st.form;
    const live = st.soldiers.filter(s => !s.dead && !s.fly && !s.helper && !s.siege);
    const archers = live.filter(s => s.archer);
    let infBack = musterY;
    {
      const knights = live.filter(s => s.ktype === 'knight'), spears = live.filter(s => s.ktype === 'spear'), riders = live.filter(s => s.ktype === 'rider');
      // šík ide oproti najbližšej pozemnej horde, no nie hlbšie než k zhromaždisku pred zónou
      const th = nearestFoe(F.inf.x, F.inf.y, false);
      const atk = armyAttacks(), cp = th || !atk ? null : nearestCampPart(F.inf.x, F.inf.y);
      if (!atk) stepAnchor(F.inf, th ? th.x : cx, musterY, dt); // obrana: šík stojí pred zónou, len sa natočí k horde
      else if (th) stepAnchor(F.inf, th.x, Math.max(G.gy0 + 24, Math.min(musterY, th.y + 18)), dt);
      else if (cp) stepAnchor(F.inf, cp.x, cp.y + 16, dt); // horda nikde – šík sa presunie k táboru
      else stepAnchor(F.inf, cx, musterY, dt);
      const front = formSlots(knights.length, F.inf.x, F.inf.y);
      assignSlots(knights, front);
      const kRows = formRows(knights.length);
      assignSlots(spears, formSlots(spears.length, F.inf.x, F.inf.y + kRows * FORM_ROW));
      // jazdci na krídlach predného radu
      const xs = front.length ? front.map(p => p.x) : [F.inf.x];
      const l = Math.min(...xs), r = Math.max(...xs), rs = riders.slice().sort((p, q) => p.x - q.x), nl = Math.ceil(rs.length / 2);
      rs.forEach((u, i) => {
        const left = i < nl, k = left ? nl - 1 - i : i - nl;
        const x = left ? l - FORM_GAP * (k + 1) : r + FORM_GAP * (k + 1);
        u.fslot = { x: Math.max(formLeft(), Math.min(formRight(), x)), y: F.inf.y + (k % 2) * 4 };
      });
      infBack = F.inf.y + (kRows + formRows(spears.length)) * FORM_ROW;
      // zrazil sa šík s hordou? potom sa pešiaci pustia aj do nepriateľov o kus ďalej
      F.contact = live.some(s => s.ktype && s.tgt && !s.tgt.dead && Math.hypot(s.tgt.x - s.x, s.tgt.y - s.y) < 14);
    }
    // lukostrelci: rad na dostrel od najbližšieho nepriateľa (aj letca), vždy za pešiakmi
    if (archers.length) {
      let tx = cx, ty = Math.max(musterY + 16, infBack + 10);
      const th = nearestFoe(F.arc.x, F.arc.y, true), cp = th || !armyAttacks() ? null : nearestCampPart(F.arc.x, F.arc.y);
      if (!armyAttacks()) { if (th) tx = th.x; } // obrana: rad stojí za šíkom
      else if (th) { tx = th.x; ty = Math.max(G.gy0 + 30, Math.min(ty, Math.max(th.y + ARCHER_RANGE - 14, infBack + 10))); }
      else if (cp) { tx = cp.x; ty = cp.y + ARCHER_RANGE - 12; } // horda nikde – rad lukostrelcov na dostrel od tábora
      stepAnchor(F.arc, tx, ty, dt);
      assignSlots(archers, formSlots(archers.length, F.arc.x, F.arc.y));
    }
  }

  // lukostrelci a obliehacie stroje cúvajú (smerom k radnici) o polovicu pomalšie, než idú dopredu
  const backMul = (u, x, y) => { const dy = y - u.y, d = Math.hypot(x - u.x, dy); return d > 0.5 && dy > d * 0.3 ? 0.5 : 1; };
  // lukostrelec: drží svoje miesto v rade a strieľa na hordu v dosahu (aj počas presunu)
  // pokrik: jednotky a hrdina sú rýchlejší a silnejší (lukostrelci strieľajú rýchlejšie a silnejšie)
  const CRY_SPD = 1.5, CRY_DMG = 1.8;
  function updateArcher(u, dt) {
    u.flash = Math.max(0, u.flash - dt);
    u.cd = Math.max(0, u.cd - dt);
    u.swing = Math.max(0, (u.swing || 0) - dt);
    let near = false, nd = 1e9;
    u.aimT = null; // na koho mieri (natočí sa k nemu a napne luk)
    for (const e of st.enemies) {
      if (e.dead || e.y <= 4) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d <= ARCHER_RANGE) { near = true; if (d < nd) { nd = d; u.aimT = e; } }
    }
    if (near && u.cd <= 0 && shoot(u.x, u.y, u.x, u.y - 9, ARCHER_RANGE, 'arrow', 180, u.dmg * (st.cryT > 0 ? CRY_DMG : 1), 0, ARCHER_PRIO)) {
      u.cd = ARCHER_CD / (st.cryT > 0 ? CRY_SPD : 1); u.swing = 0.1;
      u.aimT = st.proj[st.proj.length - 1].tgt || u.aimT; // vystrelil na prednostný cieľ – k nemu sa otočí
    }
    else if (!near) { // nikto z hordy v dosahu – strieľa na stavbu tábora, ak na ňu dostrelí
      const o = nearestCampPart(u.x, u.y);
      if (o && Math.hypot(o.x - u.x, o.y - u.y) <= ARCHER_RANGE) u.aimT = campAim(o);
      if (u.cd <= 0 && o && Math.hypot(o.x - u.x, o.y - u.y) <= ARCHER_RANGE) {
        const a = campAim(o);
        st.proj.push({ k: 'arrow', x: u.x, y: u.y - 9, tgt: null, tx: a.x + (Math.random() - 0.5) * 6, ty: a.y, dmg: u.dmg * (st.cryT > 0 ? CRY_DMG : 1), spd: 180, splash: 0, vx: 0, vy: -1, campT: o });
        u.cd = ARCHER_CD / (st.cryT > 0 ? CRY_SPD : 1); u.swing = 0.1; AUDIO.play('arrow');
      }
    }
    // ide na svoje miesto v rade (počas mierenia pomalšie)
    const sl = u.fslot;
    if (!sl || Math.hypot(sl.x - u.x, sl.y - u.y) < 1) return;
    const sp = (u.spd || 24) * waterMul(u) * (u.swing > 0 ? 0.3 : 1);
    moveKnight(u, sl.x, sl.y, sp * backMul(u, sl.x, sl.y), dt);
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
  const HEAL_RANGE = 40; // mních lieči kúzlom z tejto vzdialenosti
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
    const monk = u.helper === 'chapel';
    if (tgt && monk) { // mních lieči kúzlom na diaľku: zastaví v dosahu, z boku od cieľa
      const d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
      if (d <= HEAL_RANGE) { tx = u.x; ty = u.y; } else { const k = (HEAL_RANGE - 6) / d; tx = tgt.x + (u.x - tgt.x) * k; ty = tgt.y + (u.y - tgt.y) * k; }
    }
    else if (tgt) { tx = tileX(tgt.c) + T / 2; ty = tileY(tgt.r) + T + 3; }
    const casting = u.working; // kto už lieči, prestane až o kus ďalej (na hranici dosahu neprepína tam a späť)
    u.working = false;
    const spd = u.spd * waterMul(u);
    if (!tgt) { // nikto nepotrebuje pomoc – späť k budove
      if (u.home) moveKnight(u, tileX(u.home.c) + T / 2 + 1, tileY(u.home.r) + T + 2, spd * 0.85, dt);
      return;
    }
    if (monk ? Math.hypot(tgt.x - u.x, tgt.y - u.y) > HEAL_RANGE + (casting ? 6 : 0) : Math.hypot(tx - u.x, ty - u.y) > 7) { moveKnight(u, tx, ty, spd, dt); return; }
    // pri cieli: lieči / opravuje
    u.working = true;
    if (monk) {
      tgt.hp = Math.min(tgt.isKing ? kingMax() : tgt.max, tgt.hp + u.rate * dt);
      if (Math.random() < 0.2) part(tgt.x + (Math.random() - 0.5) * 8, tgt.y - 4 - Math.random() * 10, (Math.random() - 0.5) * 6, -14, 0.6, Math.random() < 0.5 ? '#bfe3ff' : '#ffffff', 0);
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
    if (!kingUp()) { AUDIO.play('deny'); hint(heroFell() + ' – schopnosti nefungujú'); return; }
    const a = ABIL[id];
    if (id === 'warcry') {
      if (st.cryCd > 0) { AUDIO.play('deny'); return; }
      st.cryT = a.dur + 2 * tal('roar'); st.cryCd = a.cd; AUDIO.play('horn'); banner('Za kráľa!');
    }
  }

  // ---- kúzla ----
  function selectSpell(id) {
    if (st.phase !== 'battle' || !spellOn(id)) return;
    if (!kingUp()) { st.spellSel = null; AUDIO.play('deny'); hint(heroFell() + ' – schopnosti nefungujú'); return; }
    if (SPELLS[id].instant) { st.spellSel = null; castSpell(id, st.king.x, st.king.y); return; } // bez mierenia: hneď
    if (st.spellSel === id) { st.spellSel = null; AUDIO.play('click'); return; }
    if (st[SPELLS[id].cdKey] > 0) { AUDIO.play('deny'); return; }
    st.spellSel = id; AUDIO.play('click');
  }
  // ťuk na bojisko počas boja: zvolené kúzlo sa zošle na to miesto
  function tapBattle(x, y) {
    const id = st.spellSel;
    if (!id) return;
    if (castSpell(id, x, y)) st.spellSel = null;
  }
  function castSpell(id, x, y) {
    if (st.phase !== 'battle' || !spellOn(id) || !kingUp() || st[SPELLS[id].cdKey] > 0) { AUDIO.play('deny'); return false; }
    if (id === 'volley') { volley(x, y); return true; }
    const sp = SPELLS[id], pow = spellPow(), k = st.king;
    if (id === 'warcry') {
      st.cryT = ABIL.warcry.dur + 2 * tal('roar'); st.cryCd = sp.cd; AUDIO.play('horn'); banner('Pokrik!');
      return true;
    }
    if (id === 'heal') {
      k.hp = Math.min(kingMax(), k.hp + kingMax() * 0.5);
      const fx = st.healFx || (st.healFx = []);
      fx.push({ u: k, t: 0, max: 1.1, big: true });
      for (const s of st.soldiers) if (!s.dead && !s.siege && !s.fly && Math.hypot(s.x - k.x, s.y - k.y) < sp.R) { s.hp = Math.min(s.max, s.hp + s.max * 0.6); fx.push({ u: s, t: -Math.hypot(s.x - k.x, s.y - k.y) / 120, max: 0.8 }); } // vlna dorazí k vzdialenejším neskôr
      st.marks.push({ x: k.x, y: k.y, life: 0.7, max: 0.7, wave: sp.R * 0.8, heal: true });
      for (let q = 0; q < 30; q++) { const a = Math.random() * 6.28, r = Math.random() * sp.R * 0.6; part(k.x + Math.cos(a) * r, k.y + Math.sin(a) * r * 0.6, 0, -18 - Math.random() * 10, 0.7, q % 2 ? '#9cd45a' : '#e8ffd0', 0); }
      st.healCd = sp.cd; AUDIO.play('unlock'); banner('Uzdravenie!');
      return true;
    }
    if (id === 'shield') { // vlna od paladina: budovy a radnica v dosahu sa rozžiaria a kým sa lesknú, sú nezraniteľné
      const dur = sp.dur + 1.5 * tal('bless'), inR = (px, py) => Math.hypot(px - k.x, (py - k.y) / 0.7) < sp.R;
      for (const b of st.blds) { const c = bCenter(b); if (inR(c.x, c.y)) b.holyT = dur; }
      const hr = hallRect(), hx = Math.max(hr.x0, Math.min(hr.x1, k.x)), hy = Math.max(hr.y0, Math.min(hr.y1, k.y));
      if (inR(hx, hy)) st.hallHolyT = dur;
      st.marks.push({ x: k.x, y: k.y, life: 0.6, max: 0.6, wave: sp.R, holy: true });
      for (let q = 0; q < 30; q++) { const a = q / 30 * 6.28; part(k.x + Math.cos(a) * 4, k.y + Math.sin(a) * 3, Math.cos(a) * 75, Math.sin(a) * 52, 0.5, q % 2 ? '#fff7c8' : '#f8d048', 0); }
      st.shieldCd = sp.cd; AUDIO.play('upgrade');
      return true;
    }
    if (id === 'firewall') {
      st.fireWalls.push({ x, y, w: sp.w, t: sp.dur, dps: 7 * pow * (1 + 0.3 * tal('pyro')) });
      st.fwCd = sp.cd; AUDIO.play('fire');
      return true;
    }
    if (id === 'teleport') {
      for (let q = 0; q < 18; q++) part(k.x, k.y - 6, (Math.random() - 0.5) * 30, -Math.random() * 30, 0.5, q % 2 ? '#c8a0ff' : '#ffffff', 20);
      k.x = Math.max(G.gx0 + 4, Math.min(G.gx0 + G.cols * T - 4, x)); k.y = y; k.tgt = null; k.next = null;
      k.tpBack = 0.45; // po údere sa hneď vráti teleportom k radnici
      // tlaková vlna: zasiahnutých odhodí za jej okraj a na 2 s omráči (vojvodcu a veľkráľa len omráči)
      for (const e of st.enemies) {
        if (e.dead) continue;
        const dx = e.x - k.x, dy = (e.y - k.y) / 0.7, d = Math.hypot(dx, dy);
        if (d >= sp.R) continue;
        damage(e, 10 * pow);
        e.stunT = Math.max(e.stunT || 0, e.d.boss ? 0.8 : 2);
        if (!e.d.boss) {
          const ux = d > 0.5 ? dx / d : Math.random() - 0.5, uy = d > 0.5 ? dy / d : -1, push = sp.R + 5 - d;
          e.kb = { vx: ux * push / 0.22, vy: uy * 0.7 * push / 0.22, t: 0.22 };
        }
      }
      for (let q = 0; q < 50; q++) { const a = Math.random() * 6.28, v = 30 + Math.random() * 60; part(k.x, k.y - 4, Math.cos(a) * v, Math.sin(a) * v * 0.6 - 8, 0.55, ['#c8a0ff', '#ffffff', '#8a5ae0', '#e0d0ff'][q % 4], 30); }
      for (let q = 0; q < 24; q++) { const a = q / 24 * 6.28; part(k.x + Math.cos(a) * 6, k.y + Math.sin(a) * 4, Math.cos(a) * 70, Math.sin(a) * 45, 0.35, '#b8a890', 0); } // prach po zemi
      st.marks.push({ x: k.x, y: k.y, life: 0.5, max: 0.5, wave: sp.R + 4 });
      st.shake = Math.max(st.shake, 0.25);
      st.tpCd = sp.cd; AUDIO.play('bolt');
      return true;
    }
    if (id === 'fireball') { // guľa padá z neba a vybuchne
      st.fallFx.push({ x, y, t: 0.35, max: 0.35 });
      AUDIO.play('fire');
    } else if (id === 'freeze') {
      const dur = sp.dur + 1.5 * tal('frost');
      for (const e of st.enemies) if (!e.dead && Math.hypot(e.x - x, (e.y - y) / 0.7) < sp.R) e.frostT = Math.max(e.frostT || 0, dur);
      for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, r = Math.random() * sp.R; part(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, (Math.random() - 0.5) * 10, -6 - Math.random() * 10, 0.9, ['#ffffff', '#e0f4ff', '#88c8ff'][k % 3], 0); }
      st.marks.push({ x, y, life: 0.6, max: 0.6, ice: true });
      AUDIO.play('unlock');
    } else if (id === 'lightning') { // zasiahne najbližšieho nepriateľa a preskočí na ďalších dvoch
      const near = (px, py, skip) => { let b = null, bd = sp.reach; for (const e of st.enemies) { if (e.dead || skip.includes(e)) continue; const d = Math.hypot(e.x - px, e.y - py); if (d < bd) { bd = d; b = e; } } return b; };
      const hit = [];
      let cur = near(x, y, hit);
      if (!cur) { AUDIO.play('deny'); return false; } // blesk treba zoslať na nepriateľa
      const pts = [{ x: cur.x + 6, y: Math.max(0, cur.y - 120) }];
      for (let n = 0; n < 3 && cur; n++) { hit.push(cur); pts.push({ x: cur.x, y: cur.y - cur.h * 0.5 }); cur = near(cur.x, cur.y, hit); }
      hit.forEach((e, n) => { damage(e, (n ? 21 : 35) * pow); e.stunT = Math.max(e.stunT || 0, e.d.boss ? 0.8 : 2); }); // blesk omráči na 2 s (bossov kratšie)
      for (const e of hit) st.marks.push({ x: e.x, y: e.y, life: 1.3, max: 1.3, bolt: true, seed: Math.random() * 6.28 }); // záblesk na zemi pod zasiahnutým
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
      e.burnT = 3; e.burnDps = Math.max(e.burnDps || 0, 4 * pow * (1 + 0.3 * tal('pyro')));
      damage(e, 20 * pow * (1 + 0.3 * tal('pyro')));
    }
    for (const o of campLive()) if (Math.hypot(o.x - x, (o.y - y) / 0.7) <= sp.R + 6) hitCamp(o, 30 * pow * (1 + 0.3 * tal('pyro'))); // podpáli aj stavby tábora
    for (let k = 0; k < 80; k++) { const a = Math.random() * 6.28, v = 25 + Math.random() * 80; part(x, y - 3, Math.cos(a) * v, Math.sin(a) * v * 0.6 - 30, 0.35 + Math.random() * 0.5, ['#fff7c8', '#f8d048', '#f89838', '#d83818', '#3e2614'][k % 5], 70); }
    for (let k = 0; k < 14; k++) part(x + (Math.random() - 0.5) * 14, y - 4 - Math.random() * 6, (Math.random() - 0.5) * 12, -10 - Math.random() * 10, 1.1 + Math.random() * 0.6, k % 2 ? '#4a3e38' : '#6a5c52', -4); // stĺp dymu
    (st.blasts || (st.blasts = [])).push({ x, y, t: 0, max: 0.6, R: sp.R });
    st.marks.push({ x, y, life: 4, max: 4, scorch: true, R: sp.R, seed: Math.random() * 6.28 });
    AUDIO.play('boom'); st.shake = Math.max(st.shake, 0.45);
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
      if (st.spawnT <= 0) { spawnFromCamp(st.spawnQ.shift()); st.spawnT = st.spawnQ.length ? st.spawnQ[0].gap : 0; }
    }
    for (const e of st.enemies) { if (!e.dead) updateEnemy(e, dt); if (st.phase !== 'battle') return; }
    updateCamp(dt);
    separate();
    // budovy
    for (const b of st.blds) {
      b.flash = Math.max(0, b.flash - dt);
      if (b.kind === 'tower' || b.kind === 'mage') { b.cd -= dt; if (b.cd <= 0 && fireFrom(b)) b.cd = bCd(b); }
      else if (b.kind === 'icetower') { b.cd -= dt; if (b.cd <= 0 && fireIce(b)) b.cd = bCd(b); }
      else if (b.kind === 'ballista') { b.cd -= dt; if (b.cd <= 0 && fireBallista(b)) b.cd = bCd(b); }
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
    updateFormations(dt, musterY);
    // koľko vojakov už mieri na ktorého nepriateľa – ďalší si radšej vyberú iného (nenahrnú sa všetci na jedného)
    for (const e of st.enemies) e.atkN = 0;
    for (const s of st.soldiers) if (!s.dead && s.tgt && !s.tgt.dead && s.tgt.atkN != null) s.tgt.atkN++;
    const F = st.form;
    for (const s of st.soldiers) {
      if (s.dead) continue;
      if (s.stunT > 0) { s.stunT -= dt; s.flash = Math.max(0, s.flash - dt); continue; } // omráčený dupnutím veľkráľa
      if (s.helper) { updateHelper(s, dt); continue; }
      if (s.fly) { updateFalcon(s, dt); continue; }
      if (s.archer) { updateArcher(s, dt); continue; }
      if (s.siege) { updateSiege(s, dt); continue; }
      const prev = s.tgt;
      {
        // pešiak drží miesto v šíku a bije sa s tým, kto príde k jeho miestu; po zrážke šíku s hordou siaha ďalej,
        // jazdec sa pohybuje voľne; kto prerazil za šík, toho prenasleduje ktokoľvek
        const sl = s.fslot || { x: G.gx0 + G.cols * T / 2, y: musterY };
        const atk = armyAttacks();
        let aggro = s.ktype === 'rider' ? (atk ? 9999 : RIDER_GUARD) : F.contact ? CLASH : ENGAGE;
        if (!s.tgt || s.tgt.dead) { const leak = nearestEnemyWhere(s.x, s.y, e => e.y > F.inf.y + 14 && e.y > 4, true); if (leak) s.tgt = leak; }
        if (s.tgt && !s.tgt.dead && s.tgt.y > F.inf.y + 14) aggro = 9999;
        // nikto z hordy na dosah zrážky a nikto neprerazil za šík – tlačí dopredu a búra tábor (hordu stretne cestou)
        const cp = atk && (!s.tgt || s.tgt.dead) && !nearestEnemy(s.x, s.y, ENGAGE) ? nearestCampPart(s.x, s.y) : null;
        if (cp) { s.tgt = null; strikeCamp(s, cp, dt); }
        else updateFighter(s, dt, sl.x, sl.y, aggro, s.dmg, false, moveKnight);
      }
      if (s.tgt && s.tgt !== prev && !s.tgt.dead) s.tgt.atkN = (s.tgt.atkN || 0) + 1;
    }
    st.soldiers = st.soldiers.filter(s => !s.dead);
    separateSoldiers();
    // kráľ
    const k = st.king;
    if (k.dead) k.deadT += dt;
    else {
      const hd = heroDef();
      if (k.tpBack > 0) { // čarodejka po údere teleportom: chvíľu stojí na mieste, potom sa vráti k radnici
        k.tpBack -= dt;
        if (k.tpBack <= 0) {
          for (let q = 0; q < 16; q++) part(k.x, k.y - 6, (Math.random() - 0.5) * 30, -Math.random() * 30, 0.5, q % 2 ? '#c8a0ff' : '#ffffff', 20);
          k.x = k.hx; k.y = k.hy; k.tgt = null; k.next = null;
          for (let q = 0; q < 16; q++) part(k.x, k.y - 6, (Math.random() - 0.5) * 30, -Math.random() * 30, 0.5, q % 2 ? '#c8a0ff' : '#ffffff', 20);
          AUDIO.play('bolt');
        }
      } else if (hd.range) updateSorc(k, dt);
      else updateFighter(k, dt, k.hx, k.hy, hd.reach + T + 10 * tal('reach'), kingDmg(), true, moveKnight); // vyráža o políčko pred stavebnú zónu, chodí len cez brány
      if (tal('regen') && k.hp < kingMax()) k.hp = Math.min(kingMax(), k.hp + kingMax() * 0.015 * tal('regen') * dt);
      if (hd.aura) { // paladin lieči rytierov okolo seba
        const rate = hd.aura * (1 + 0.5 * tal('aura'));
        for (const s of st.soldiers) if (!s.dead && !s.siege && s.hp < s.max && Math.hypot(s.x - k.x, s.y - k.y) < 30) {
          s.hp = Math.min(s.max, s.hp + rate * dt);
          if (Math.random() < 0.04) part(s.x + (Math.random() - 0.5) * 6, s.y - 8, 0, -12, 0.5, '#9cd45a', 0);
        }
      }
    }
    // svätý štít a ohnivá stena dohasínajú
    for (const sh of st.shields) sh.t -= dt;
    for (const b of st.blds) if (b.holyT > 0) b.holyT -= dt; // svätý štít dohasína
    if (st.hallHolyT > 0) st.hallHolyT -= dt;
    st.shields = st.shields.filter(sh => sh.t > 0);
    for (const fw of st.fireWalls) {
      fw.t -= dt;
      for (const e of st.enemies) if (!e.dead && !e.d.fly && Math.abs(e.y - fw.y) < 6 && Math.abs(e.x - fw.x) < fw.w / 2) {
        e.burnT = Math.max(e.burnT || 0, 1.5); e.burnDps = Math.max(e.burnDps || 0, fw.dps);
      }
      if (Math.random() < 0.45) { const u = 0.15 + Math.random() * 0.7; part(fw.x - fw.w / 2 + u * fw.w, fw.y - 4, (Math.random() - 0.5) * 6, -12 - Math.random() * 10, 0.5, ['#fff7c8', '#f8d048', '#f89838'][Math.random() * 3 | 0], -10); }
    }
    st.fireWalls = st.fireWalls.filter(fw => fw.t > 0);
    // strely
    for (const p of st.proj) {
      if (p.lance) { // šíp balisty: letí rovno, prebodne každého na zemi (ďalší dostanú o štvrtinu menej)
        const step = p.spd * dt;
        p.x += p.vx * step; p.y += p.vy * step; p.trav += step;
        for (const e of st.enemies) if (!e.dead && !e.d.fly && !p.hit.has(e) && Math.hypot(e.x - p.x, (e.y - e.h * 0.5) - p.y) < 6) {
          p.hit.add(e); damage(e, p.dmg * (p.hit.size === 1 ? 1 : 0.75));
          for (let k = 0; k < 4; k++) part(e.x, e.y - e.h * 0.5, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.3, e.d.blood || '#8c2018', 80);
        }
        if (p.trav >= p.max || p.y < -10 || p.x < -10 || p.x > W + 10) p.done = true;
        continue;
      }
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
    for (const key of ['shieldCd', 'healCd', 'fwCd', 'tpCd']) st[key] = Math.max(0, (st[key] || 0) - dt);
    for (const f of st.fallFx) { // padajúca ohnivá guľa s chvostom iskier
      f.t -= dt;
      const fy = f.y - 90 * Math.max(0, f.t / f.max), fx = f.x + 30 * Math.max(0, f.t / f.max);
      for (let k = 0; k < 8; k++) part(fx + (Math.random() - 0.5) * 4, fy + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 10 + 12, -14 - Math.random() * 10, 0.35, ['#fff7c8', '#f8d048', '#f89838', '#d83818'][k % 4], 0);
      if (Math.random() < 0.6) part(fx + 3, fy - 2, 8, -10, 0.6, '#4a3e38', -6); // dym za guľou
      if (f.t <= 0) { f.done = true; fireballBlast(f.x, f.y); }
    }
    st.fallFx = st.fallFx.filter(f => !f.done);
    for (const bl of st.blasts || []) bl.t += dt;
    for (const h of st.healFx || []) h.t += dt;
    st.healFx = (st.healFx || []).filter(h => h.t < h.max);
    st.blasts = (st.blasts || []).filter(bl => bl.t < bl.max);
    updateFx(dt);
    if (st.phase === 'battle' && !st.spawnQ.length && !st.enemies.length) endWave();
  }

  function impact(p) {
    if (p.campT) { hitCamp(p.campT, p.dmg); if (p.k !== 'rock') return; } // šíp či balvan do stavby tábora (balvan zraní aj hordu okolo)
    if (p.k === 'rock') {
      AUDIO.play('boom');
      for (const e of st.enemies) if (!e.dead && !e.d.fly && Math.hypot(e.x - p.tx, (e.y - 3) - p.ty) <= p.splash + (e.d.giant ? 8 : 0)) damage(e, p.dmg, p.siege);
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
    } else if (p.k === 'ice') { // ľadová strela: spomalí cieľ aj tých okolo, pri dopade sa rozletia ľadové úlomky
      for (const e of st.enemies) if (!e.dead && Math.hypot(e.x - p.tx, (e.y - e.h * 0.5) - p.ty) < 12) e.chillT = Math.max(e.chillT || 0, p.chill || 2);
      if (p.tgt && !p.tgt.dead) damage(p.tgt, p.dmg);
      for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28, v = 10 + Math.random() * 25; part(p.tx, p.ty, Math.cos(a) * v, Math.sin(a) * v - 6, 0.35, k % 2 ? '#e8f8ff' : '#88d0f0', 40); }
    } else if (p.tgt && !p.tgt.dead) {
      if (p.k === 'farrow') { p.tgt.burnT = 3; p.tgt.burnDps = Math.max(p.tgt.burnDps || 0, p.dmg * 0.5); }
      damage(p.tgt, p.dmg, p.siege);
    } else part(p.tx, p.ty, 0, -10, 0.2, '#bcc0cc', 0);
  }

  function updateFx(dt) {
    for (const b of st.bolts) b.life -= dt; // blesk dohasne aj po konci vlny (posledný zásah prepne hru do stavania)
    st.bolts = st.bolts.filter(b => b.life > 0);
    for (const q of st.parts) { q.life -= dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; }
    st.parts = st.parts.filter(q => q.life > 0);
    for (const t of st.texts) { t.life -= dt; t.y -= 14 * dt; }
    st.texts = st.texts.filter(t => t.life > 0);
    for (const m of st.marks) m.life -= dt;
    st.marks = st.marks.filter(m => m.life > 0);
    st.shake = Math.max(0, st.shake - dt);
    if (st.king) st.king.flash = Math.max(0, (st.king.flash || 0) - dt);
    if (st.king && st.king.fadeT != null) st.king.fadeT += dt;
    for (const b of st.blds) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
  }

  // ---------------- Render ----------------
  function shadow(x, y, r) {
    g.fillStyle = 'rgba(10,8,6,0.38)';
    for (let dx = -r; dx <= r; dx++) g.fillRect(Math.round(x) + dx, Math.round(y) - 1, 1, Math.abs(dx) >= r - 1 ? 1 : 2);
  }

  // ork v 8 smeroch: natočí sa k protivníkovi či k tomu, čo búra, inak smerom chôdze (na začiatku k pevnosti);
  // snímka chôdze podľa prejdenej cesty, úder = napriahnutie, švih a dokončenie, lukostrelec napne a pustí tetivu
  function enemy8Frame(e, set) {
    const mvx = e.x - (e._lx == null ? e.x : e._lx), mvy = e.y - (e._ly == null ? e.y : e._ly);
    e._lx = e.x; e._ly = e.y;
    const d = Math.hypot(mvx, mvy), moving = d > 0.03 && !e.attacking;
    if (moving) e._wd = (e._wd || 0) + d;
    const foe = e.foe && !e.foe.dead ? e.foe : null, busy = e.attacking || e.lunge > 0;
    if (foe) e.face8 = dir8(foe.x - e.x, foe.y - e.y);
    else if (busy && e.aimP) e.face8 = dir8(e.aimP.x - e.x, e.aimP.y - e.y);
    else if (moving) e.face8 = dir8(mvx, mvy);
    if (e.face8 == null) e.face8 = 2;
    const v = set[e.face8];
    if (set.bow) { if (e.lunge > 0) return v.atk[1]; if (busy) return v.atk[0]; }
    else if (e.lunge > 0) return v.atk[e.lunge > 0.075 ? 1 : 2];
    else if (busy && e.atk < 0.3) return v.atk[0];
    return moving ? v.walk[Math.floor(e._wd / set.stride) % 4] : v.idle;
  }
  function drawEnemy(e, time) {
    const set8 = SPR[e.d.spr + '8'];
    if (set8 && !e.d.fly) {
      let fr, x, y;
      if (set8.vox) { // baran, obrí baran, mamut: 3D model, akcia = úder kmeňom či dupnutie
        const mvx = e.x - (e._lx == null ? e.x : e._lx), mvy = e.y - (e._ly == null ? e.y : e._ly), d = Math.hypot(mvx, mvy);
        e._lx = e.x; e._ly = e.y;
        const moving = d > 0.02 && !e.attacking;
        if (moving) { e._wd = (e._wd || 0) + d; e.face8 = dir8(mvx, mvy); }
        else if ((e.attacking || e.lunge > 0) && e.aimP) e.face8 = dir8(e.aimP.x - e.x, e.aimP.y - e.y);
        if (e.face8 == null) e.face8 = 2;
        const v = set8[e.face8];
        fr = e.lunge > 0 ? v.act : moving ? v.walk[Math.floor(e._wd / set8.stride) % 4] : v.idle;
        x = Math.round(e.x - fr.ax); y = Math.round(e.y - fr.ay);
      } else {
        fr = enemy8Frame(e, set8); x = Math.round(e.x - fr.w / 2); y = Math.round(e.y - fr.h) + U8_PB;
      }
      shadow(e.x, e.y, Math.ceil(e.w * 0.35));
      if (e.d.boss) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(200,40,20,' + ((e.d.giant ? 0.07 : 0.18) + Math.sin(time * 5) * (e.d.giant ? 0.04 : 0.08)) + ')';
        g.beginPath(); g.ellipse(e.x, e.y - e.h / 2, e.w * 0.75, e.h * 0.7, 0, 0, 6.29); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      g.drawImage(e.flash > 0 ? hitSpr(fr) : fr.c, x, y);
      if (e.stunT > 0) drawEnemyStun(e, Math.round(e.y - e.h), time);
      return;
    }
    const frames = SPR[e.d.spr];
    if (e.d.fly) { // netopier mávajúci krídlami, tieň na zemi
      const fr = frames[Math.floor(time * 8 + e.ph) % 2];
      shadow(e.x, e.y + 2, 3);
      g.drawImage(e.flash > 0 ? hitSpr(fr) : fr.c, Math.round(e.x - fr.w / 2), Math.round(e.y - 14 + Math.sin(time * 6 + e.ph) * 1.5));
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
      g.fillStyle = 'rgba(200,40,20,' + ((e.d.giant ? 0.07 : 0.18) + Math.sin(time * 5) * (e.d.giant ? 0.04 : 0.08)) + ')'; // obra žiara nezakryje
      g.beginPath(); g.ellipse(e.x, e.y - fr.h / 2, fr.w * 0.75, fr.h * 0.7, 0, 0, 6.29); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.drawImage(e.flash > 0 ? hitSpr(fr) : fr.c, x, y);
    if (e.stunT > 0) drawEnemyStun(e, y, time);
  }
  // omráčený: okolo hlavy krúžia hviezdičky (top = vrch postavy)
  function drawEnemyStun(e, top, time) {
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + i * 2.094, sx = Math.round(e.x + Math.cos(a) * (e.w * 0.35 + 2)), sy = Math.round(top - 3 + Math.sin(a) * 2);
      g.fillStyle = PAL.K; g.fillRect(sx - 2, sy - 1, 5, 3); g.fillRect(sx - 1, sy - 2, 3, 5);
      g.fillStyle = '#f8d048'; g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3);
      g.fillStyle = '#ffffff'; g.fillRect(sx, sy, 1, 1);
    }
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
  // kráľ v 8 smeroch: natočí sa k nepriateľovi, inak smerom chôdze, doma pozerá na hordu; chôdza zo 4 snímok, úder z 3
  const dir8 = (dx, dy) => (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  const hero8 = spr => SPR[spr + '8']; // hrdinovia prerobení do 8 smerov (kráľ, paladin, čarodejka)
  function king8Frame(u, set) {
    const mvx = u.x - (u._lx == null ? u.x : u._lx), mvy = u.y - (u._ly == null ? u.y : u._ly);
    u._lx = u.x; u._ly = u.y;
    const aim = u.aim && !u.aim.dead ? u.aim : null; // čarodejka mieri na diaľku
    const moving = Math.hypot(mvx, mvy) > 0.02, t = aim || (u.tgt && !u.tgt.dead ? u.tgt : null);
    const near = t && (aim || Math.hypot(t.x - u.x, t.y - u.y) < 26);
    if (near) u.face8 = dir8(t.x - u.x, t.y - u.y);
    else if (moving) u.face8 = dir8(mvx, mvy);
    else if (Math.hypot(u.hx - u.x, u.hy - u.y) < 3) u.face8 = 6;
    if (u.face8 == null) u.face8 = 6;
    const v = set[u.face8];
    if (u.swing > 0) return v.slash; // meč nahradí svetelný oblúk švihu (kladivo ostane dopadnuté)
    if (near && u.cd < 0.25) return v.atk[0]; // napriahnutie pred úderom
    if (moving) return v.walk[Math.floor(u.anim * 1.4) % 4];
    return v.idle;
  }
  // svetelný oblúk švihu meča: rýchlo sa vykreslí v smere úderu a zhasne (biely okraj, modrastý chvost)
  function drawSlash(cx, cy, face, p) {
    const sweep = 2.4, a0 = face - sweep / 2, head = Math.min(1, p * 2.6), fade = 1 - Math.max(0, p - 0.4) / 0.6;
    if (fade <= 0) return;
    const n = 28;
    for (let i = 0; i <= n * head; i++) {
      const tt = i / n, a = a0 + sweep * tt, trail = head - tt; // 0 = čelo oblúka
      const thick = Math.max(1, Math.round(4 * (1 - trail * 1.3)));
      for (let k = 0; k < thick; k++) {
        const r = 13 - k;
        g.globalAlpha = Math.max(0, fade * (1 - trail * 0.9));
        g.fillStyle = k === 0 ? '#ffffff' : k === 1 ? '#eef6ff' : k === 2 ? '#b8d0f0' : '#7890c0';
        g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.75), 1, 1);
      }
    }
    g.globalAlpha = 1;
  }
  // pokrik: okolo hrdinu svieti fialová neónová žiara, okolo vlastných jednotiek neónovo modrá;
  // behind = mäkká žiara a lem na zemi pod postavou, inak tenký pulzujúci obrys a iskry nad ňou
  function cryAura(u, hero, behind) {
    if (!(st.cryT > 0)) return;
    const tm = performance.now() / 1000, f = Math.min(1, st.cryT / 0.5) * (0.8 + 0.2 * Math.sin(tm * 9 + u.x));
    const rgb = hero ? '200,90,255' : '70,200,255', r = hero ? 15 : 10, cy = u.y - (hero ? 8 : 6);
    if (behind) {
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(u.x, cy, 1, u.x, cy, r);
      gr.addColorStop(0, 'rgba(' + rgb + ',' + (0.9 * f) + ')'); gr.addColorStop(0.55, 'rgba(' + rgb + ',' + (0.45 * f) + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(u.x, cy, r * 0.85, r, 0, 0, 6.29); g.fill();
      const rx = hero ? 9 : 6.5, ry = hero ? 3.5 : 2.6;
      for (const [k, al] of [[1, 1], [1.45, 0.45]]) { // neónový lem na zemi a slabší vonkajší kruh
        g.strokeStyle = 'rgba(' + rgb + ',' + (al * f) + ')'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(u.x, u.y, rx * k, ry * k, 0, 0, 6.29); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    } else if (Math.random() < (hero ? 0.35 : 0.12)) part(u.x + (Math.random() - 0.5) * 10, u.y - 4 - Math.random() * 10, 0, -14, 0.45, hero ? (Math.random() < 0.5 ? '#e0a0ff' : '#ffffff') : (Math.random() < 0.5 ? '#80e0ff' : '#ffffff'), 0);
  }
  // úder paladinovho kladiva: pred ním sa po zemi rozbehne zlatý kruh, vyletí prach a iskry
  function drawSmash(u) {
    if (!(u.swing > 0)) { u.smashed = false; return; }
    const tip = hero8('paladin')[u.face8].tip, ix = u.x + tip.x, iy = u.y + tip.y, p = 1 - u.swing / 0.3; // náraz tam, kde dopadla hlava kladiva
    if (!u.smashed) {
      u.smashed = true;
      for (let k = 0; k < 10; k++) part(ix + (Math.random() - 0.5) * 6, iy, (Math.random() - 0.5) * 50, -12 - Math.random() * 26, 0.45, k < 5 ? '#a08c6c' : '#fff070', 90);
    }
    const r = 2 + p * 10, al = Math.max(0, 1 - p);
    if (p < 0.35) { // záblesk v mieste dopadu hlavy kladiva
      g.globalCompositeOperation = 'lighter';
      const f = 1 - p / 0.35, gr = g.createRadialGradient(ix, iy, 0, ix, iy, 7);
      gr.addColorStop(0, 'rgba(255,250,200,' + (0.9 * f) + ')'); gr.addColorStop(1, 'rgba(248,208,72,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, 7, 4, 0, 0, 6.29); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = al;
    for (const [rr, w] of [[r, 1], [r * 0.6, 0.6]]) for (let i = 0; i < 28; i++) { // dva kruhy tlakovej vlny po zemi od hlavy kladiva
      const t = i / 28 * Math.PI * 2;
      g.fillStyle = i % 3 ? '#f8d048' : '#ffffff';
      g.globalAlpha = al * w;
      g.fillRect(Math.round(ix + Math.cos(t) * rr), Math.round(iy + Math.sin(t) * rr * 0.45), 1, 1);
    }
    g.globalAlpha = 1;
  }
  // čarodejka: ohnivá guľa na palici stále jemne žiari a iskrí, pri výstrele sa rozžiari naplno
  function drawCastFlare(u, v) {
    const x = u.x + v.tip.x, y = u.y + v.tip.y;
    if (u.swing > 0) {
      const p = u.swing / 0.15;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,170,60,' + (0.55 * p) + ')'; g.beginPath(); g.arc(x, y, 3 + 3 * p, 0, 6.29); g.fill();
      g.fillStyle = 'rgba(255,240,140,' + (0.8 * p) + ')'; g.beginPath(); g.arc(x, y, 2, 0, 6.29); g.fill();
      g.globalCompositeOperation = 'source-over';
    } else if (Math.random() < 0.2) part(x + (Math.random() - 0.5) * 3, y - 1, (Math.random() - 0.5) * 4, -8 - Math.random() * 6, 0.35, Math.random() < 0.5 ? '#fff070' : '#f87830', 0);
  }
  // zasiahnutá budova či hrad sa namiesto zafarbenia jemne otrasie o pixel do strán (úlomky pridá hitBuilding / hitCamp)
  const hitJit = f => f > 0 ? (Math.floor(performance.now() / 45) % 2 ? 1 : -1) : 0;
  // jednotka v 8 smeroch (rytier): natočí sa k nepriateľovi, inak smerom chôdze, v pokoji pozerá na hordu;
  // snímka chôdze sa ráta z prejdenej vzdialenosti, aby nohy nekĺzali (krok = 4 snímky na ~13 bodov)
  function unit8Frame(u, set) {
    const mvx = u.x - (u._lx == null ? u.x : u._lx), mvy = u.y - (u._ly == null ? u.y : u._ly);
    u._lx = u.x; u._ly = u.y;
    const d = Math.hypot(mvx, mvy), moving = d > 0.05;
    if (moving) u._wd = (u._wd || 0) + d;
    const t = u.archer ? (u.aimT && !u.aimT.dead ? u.aimT : null) : u.tgt && !u.tgt.dead ? u.tgt : null;
    const near = t && (u.archer || Math.hypot(t.x - u.x, t.y - u.y) < (u.ktype === 'spear' ? SPEAR_REACH + 5 : 14)); // kopijník bodá z diaľky
    if (near) u.face8 = dir8(t.x - u.x, t.y - u.y);
    else if (moving) u.face8 = dir8(mvx, mvy);
    else if (!t) u.face8 = 6;
    if (u.face8 == null) u.face8 = 6;
    const v = set[u.face8];
    if (u.archer) { // lukostrelec: po výstrele chvíľu povolená tetiva, potom znova napne; v behu luk spustí
      if (u.swing > 0 || (near && !moving && u.cd > ARCHER_CD * 0.6)) return v.atk[1];
      if (near && !moving) return v.atk[0];
    }
    else if (u.swing > 0) return v.atk[u.swing > 0.075 ? 1 : 2]; // švih a dokončenie úderu
    else if (near && !moving && u.cd < 0.25) return v.atk[0];  // napriahnutie
    if (moving) return v.walk[Math.floor(u._wd / set.stride) % 4];
    return v.idle;
  }
  // obliehací stroj v 8 smeroch: natočí sa smerom jazdy, pri streľbe k cieľu; snímka jazdy podľa prejdenej cesty
  // (pootočenie kolies), akcia = úder baranidla, výstrel katapultu či veže, šľahnutie plameňa
  function drawSiege8(u, set) {
    const mvx = u.x - (u._lx == null ? u.x : u._lx), mvy = u.y - (u._ly == null ? u.y : u._ly);
    u._lx = u.x; u._ly = u.y;
    const d = Math.hypot(mvx, mvy), moving = d > 0.03;
    if (moving) { u._wd = (u._wd || 0) + d; u.face8 = dir8(mvx, mvy); }
    else if (u.aimP && (u.fired > 0 || u.cd > 0)) u.face8 = dir8(u.aimP.x - u.x, u.aimP.y - u.y);
    if (u.face8 == null) u.face8 = 6;
    const v = set[u.face8], k = u.siege;
    const act = k === 'ram' ? u.swing > 0 : k === 'cat' ? u.fired > 0.4 : k === 'tower' ? u.fired > 0 : u.cd > SIEGE.fire.cd - 0.25;
    const fr = act ? v.act : moving ? v.walk[Math.floor(u._wd / set.stride) % 4] : v.idle;
    shadow(u.x, u.y, 9);
    g.drawImage(u.flash > 0 ? fr.f : fr.c, Math.round(u.x - fr.ax), Math.round(u.y - fr.ay));
  }
  function drawFighter(u, sprName) {
    if (u.siege) return drawSiege8(u, SPR[sprName + '8']);
    if (!u.isKing && SPR[sprName + '8']) {
      const fr = unit8Frame(u, SPR[sprName + '8']), y = Math.round(u.y - fr.h) + U8_PB;
      shadow(u.x, u.y, 4);
      cryAura(u, false, true);
      g.drawImage(u.flash > 0 ? fr.f : fr.c, Math.round(u.x - fr.w / 2), y);
      cryAura(u, false);
      if (u.stunT > 0) { // hviezdičky nad omráčeným
        const t = performance.now() / 1000;
        for (let k = 0; k < 2; k++) { const a = t * 6 + k * 3.14; g.fillStyle = k ? '#fff070' : '#f8d048'; g.fillRect(Math.round(u.x + Math.cos(a) * 4), Math.round(u.y - 15 + Math.sin(a) * 1.5), 1, 1); }
      }
      return;
    }
    if (u.isKing && hero8(sprName)) {
      const fr = king8Frame(u, hero8(sprName));
      shadow(u.x, u.y, 5);
      cryAura(u, true, true);
      g.drawImage(u.flash > 0 ? fr.f : fr.c, Math.round(u.x - fr.w / 2), Math.round(u.y - fr.h) + K8_PB); // pod chodidlami je miesto na zbraň
      if (sprName === 'paladin') drawSmash(u);
      else if (sprName === 'sorc') drawCastFlare(u, hero8(sprName)[u.face8]);
      else if (u.swing > 0) drawSlash(u.x, u.y - 9, u.face8 * Math.PI / 4, 1 - u.swing / 0.3);
      cryAura(u, true);
      return;
    }
    const frames = SPR[sprName];
    const fr = frames[Math.floor(u.anim) % 2];
    const x = Math.round(u.x - fr.w / 2), y = Math.round(u.y - fr.h - (u.swing > 0 ? 1 : 0));
    shadow(u.x, u.y, 4);
    cryAura(u, !!u.isKing, true);
    g.drawImage(u.flash > 0 ? fr.f : fr.c, x, y);
    if (sprName === 'craft') drawHammer(u, x, y);
    if (sprName === 'sorc' && Math.random() < 0.25) part(x + 12, y + 1, (Math.random() - 0.5) * 4, -8 - Math.random() * 6, 0.35, Math.random() < 0.5 ? '#fff070' : '#f87830', 0); // plamienok na palici
    cryAura(u, !!u.isKing); // pokrik
    if (u.stunT > 0) { // hviezdičky nad omráčeným
      const t = performance.now() / 1000;
      for (let k = 0; k < 2; k++) { const a = t * 6 + k * 3.14; g.fillStyle = k ? '#fff070' : '#f8d048'; g.fillRect(Math.round(u.x + Math.cos(a) * 4), Math.round(y - 3 + Math.sin(a) * 1.5), 1, 1); }
    }
    if (u.swing > 0) { // záblesk meča
      g.fillStyle = '#ffffff';
      g.fillRect(x + fr.w - 1, y - 2, 1, 3); g.fillRect(x + fr.w, y - 3, 1, 2);
    }
  }

  // padnutý kráľ: klesne na kolená (nohy zmiznú pod ním), plášť sa zavlní, nad korunou krúžia hviezdičky;
  // leží tak aj počas stavby, kým ho hráč neoživí (fadeT = postupné vytratenie, ak sa niekedy nastaví)
  const KING_FADE = 0.6;
  const kingLying = k => k.fadeT == null || k.fadeT < KING_FADE;
  // pri páde kráľa sa boj na chvíľu spomalí na tretinu (v reálnom čase), aby si to hráč všimol
  const SLOWMO_DUR = 1.0;
  let slowmoT = 0;
  function drawDeadKing(k, time) {
    const set = hero8(heroDef().spr);
    if (set && set.kneel) return drawKneelingKing(k, time, set);
    const k8 = !!set, fr = k8 ? set[k.face8 == null ? 6 : k.face8].idle : SPR[heroDef().spr][0], t = k.deadT;
    const fall = Math.min(1, t / 0.45), drop = Math.round(4 * fall * fall);
    const alpha = k.fadeT == null ? 1 : Math.max(0, 1 - k.fadeT / KING_FADE);
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
      drawDizzyStars(k.x, y0 - 2 + (k8 ? K8_BY : 0), time); // nad korunou (plátno kráľa má navrchu miesto na meč)
    }
    g.globalAlpha = 1;
  }
  function drawDizzyStars(cx, cy, time) {
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + i * 2.094, sx = Math.round(cx + Math.cos(a) * 7), sy = Math.round(cy + Math.sin(a) * 2);
      g.fillStyle = PAL.K; g.fillRect(sx - 2, sy - 1, 5, 3); g.fillRect(sx - 1, sy - 2, 3, 5);
      g.fillStyle = '#f8d048'; g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3);
      g.fillStyle = '#ffffff'; g.fillRect(sx, sy, 1, 1);
    }
  }
  // porazený kráľ: klesne na kolená, sklonená hlava, meč zapichnutý pred sebou v zemi; plášť sa ešte chvíľu zavlní
  function drawKneelingKing(k, time, set) {
    const fr = set.kneel, t = k.deadT, fall = Math.min(1, t / 0.35);
    const alpha = k.fadeT == null ? 1 : Math.max(0, 1 - k.fadeT / KING_FADE);
    const x0 = Math.round(k.x - fr.w / 2), y0 = Math.round(k.y - fr.h) + KNEEL_DY - Math.round(3 * (1 - fall) * (1 - fall));
    const amp = t < 1.3 ? 1.2 * (1 - t / 1.3) : 0;
    g.globalAlpha = alpha;
    shadow(k.x, k.y, 5);
    for (let r = 0; r < fr.h; r++) {
      const cape = K8_H - KNEEL_DY - 7; // plášť = 6 riadkov nad kolenami (nie zbraň v zemi)
      const dx = r > cape && r <= cape + 6 ? Math.round(Math.sin(t * 14 - r * 0.9) * amp * (r - cape) / 5) : 0;
      g.drawImage(fr.c, 0, r, fr.w, 1, x0 + dx, y0 + r, fr.w, 1);
    }
    if (fall >= 1 && t < 0.8) { // pri dopade čepele odletí trochu hliny
      g.fillStyle = '#6a4e34'; const s = Math.round((t - 0.35) * 8), gy = Math.round(k.y) + KNEEL_DY - 1 - (s > 1 ? 1 : 0);
      g.fillRect(Math.round(k.x) - 3 - s, gy, 1, 1); g.fillRect(Math.round(k.x) + 2 + s, gy, 1, 1);
    }
    if (fall >= 1 && alpha > 0) drawDizzyStars(k.x, y0 + K8_H - 12 - KNEEL_DY - 2, time); // nad sklonenou korunou
    g.globalAlpha = 1;
  }

  // balvan z katapultu (oblúk + tieň na zemi)
  function drawRock(r) {
    const gx = Math.round(r.x), gy = Math.round(r.gy);
    g.fillStyle = 'rgba(10,8,6,0.35)'; g.fillRect(gx - 2, gy, 5, 1); g.fillRect(gx - 1, gy - 1, 3, 3); // tieň na zemi
    const x = gx - 1, y = Math.round(r.y) - 1;
    g.fillStyle = PAL.K; g.fillRect(x - 1, y, 5, 3); g.fillRect(x, y - 1, 3, 5);
    g.fillStyle = '#4e4858'; g.fillRect(x, y, 3, 3);
    g.fillStyle = '#7a7286'; g.fillRect(x, y, 2, 1); g.fillRect(x, y + 1, 1, 1);
    g.fillStyle = '#22202a'; g.fillRect(x + 2, y + 2, 1, 1);
  }
  function bar(cx, y, w, ratio, col) {
    const x = Math.round(cx - w / 2);
    g.fillStyle = PAL.K; g.fillRect(x - 1, y - 1, w + 2, 3);
    g.fillStyle = '#3a1410'; g.fillRect(x, y, w, 1);
    g.fillStyle = col; g.fillRect(x, y, Math.max(1, Math.round(w * ratio)), 1);
  }

  function drawSpikes(ctx, x0, y0, type) {
    const sk = type ? SPIKE_TYPES[type] : null;
    for (let k = 1; k < T - 1; k += 3) { ctx.fillStyle = PAL.K; ctx.fillRect(x0 + k, y0 + 6, 1, 3); ctx.fillStyle = sk ? sk.tip : '#f4f4f8'; ctx.fillRect(x0 + k, y0 + 5, 1, 1); ctx.fillStyle = sk ? sk.body : '#bcc0cc'; ctx.fillRect(x0 + k, y0 + 6, 1, 2); }
  }
  // náhľad stavby na karte presne tak, ako bude vyzerať po akcii (materiál úrovne, brána, ostne, strelec, vlajka špecializácie)
  const previewCache = {};
  function bPreview(o) {
    const lv = Math.max(1, Math.min(5, o.lvl || 1)), u = o.unit;
    const key = [o.kind, lv, o.gate ? 1 : 0, o.spikes ? o.spikeType || 1 : 0, u ? u.type + u.lvl : '', o.spec || ''].join('|');
    if (previewCache[key]) return previewCache[key];
    if (o.kind === 'hall') return (previewCache[key] = spriteURL(bsprOf('hall', lv), 2));
    const c = document.createElement('canvas'), x = c.getContext('2d');
    if (o.kind === 'wall') {
      const y0 = o.gate ? 15 : u ? 9 : 6; // nad hradbou len toľko miesta, koľko treba (strážnica / strelec)
      c.width = T; c.height = y0 + 18;
      x.drawImage(BSPR.wall[lv - 1][10].c, 0, y0 - 6);
      if (o.spikes) drawSpikes(x, 0, y0, o.spikeType);
      if (o.gate) x.drawImage(BSPR.gatehouse[lv - 1].c, 0, y0 - 15);
      else if (u) {
        const us = SPR[WUNIT[u.type].spr][0];
        x.drawImage(us.c, 0, 0, us.w, 11, 1, y0 - 9, us.w, 11);
        if (u.lvl > 1) pxText(x, String(u.lvl), 1, y0 - 8, '#88b4ff');
      }
    } else {
      const spr = bsprOf(o.kind, lv), w = Math.max(T, spr.w), tx = Math.floor((w - T) / 2);
      c.width = w; c.height = spr.h + 5;
      x.drawImage(spr.c, tx + T / 2 - Math.floor(spr.w / 2), 5);
      if (o.spec) { x.fillStyle = '#4a4e60'; x.fillRect(tx + 13, 1, 1, 6); x.fillStyle = SPECS[o.spec].col; x.fillRect(tx + 14, 1, 3, 2); }
      if (lv > 1) pxText(x, String(lv), tx + T - 3, 5 + spr.h - 7, '#f8d048');
    }
    return (previewCache[key] = spriteURL({ c, w: c.width, h: c.height }, 3));
  }
  // náhľad stavby po zmene (jej vlastnosti s prepísanými hodnotami)
  const after = (b, ch) => bPreview(Object.assign({ kind: b.kind, lvl: b.lvl, gate: b.gate, spikes: b.spikes, spikeType: b.spikeType, unit: b.unit, spec: b.spec }, ch));

  // svätý štít: budova sa zlato leskne (pulzuje) a iskrí, kým je nezraniteľná
  const goldCache = new WeakMap();
  function goldOf(spr) {
    const src = spr.f || spr.c;
    let c = goldCache.get(src);
    if (!c) {
      c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const cx = c.getContext('2d'); cx.drawImage(src, 0, 0);
      cx.globalCompositeOperation = 'source-in'; cx.fillStyle = '#ffd860'; cx.fillRect(0, 0, c.width, c.height);
      goldCache.set(src, c);
    }
    return c;
  }
  function holyGlow(spr, x, y, t, time, sx, sy, sw, sh) {
    const fade = Math.min(1, t / 0.5), gc = goldOf(spr);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = fade * (0.32 + 0.18 * Math.sin(time * 7 + x * 0.3));
    if (sw) g.drawImage(gc, sx, sy, sw, sh, x, y, sw, sh); else g.drawImage(gc, x, y);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (Math.random() < 0.12 * fade) part(x + Math.random() * (sw || gc.width), y + Math.random() * (sh || gc.height) * 0.7, 0, -12, 0.5, Math.random() < 0.5 ? '#fff7c8' : '#f8d048', 0);
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
      g.drawImage(spr.c, x0, y0 - 6);
      if (b.holyT > 0) holyGlow(spr, x0, y0 - 6, b.holyT, time);
      // napojenie: kraje obrazovky a susedné budovy (veža, kasárne, mág)
      const flat = BSPR.wall[wl][m | 2 | 8].c;
      const slice = (dx, w) => { for (let k = 0; k < w; k += 4) { const ww = Math.min(4, w - k); g.drawImage(flat, 6, 0, ww, 24, dx + k, y0 - 6, ww, 24); } };
      if (edgeL) slice(0, G.gx0);
      if (edgeR) slice(x0 + T, W - x0 - T);
      if (joinsBuilding(b.c + 1, b.r)) slice(x0 + T, 4);
      if (joinsBuilding(b.c - 1, b.r)) slice(x0 - 4, 4);
      if (b.spikes) { // ostne na čele hradby
        drawSpikes(g, x0, y0, b.spikeType);
        if (b.spikeType === 'fire' && Math.random() < 0.04) part(x0 + 2 + Math.random() * (T - 4), y0 + 5, 0, -10, 0.4, '#f89838', -5);
      }
      if (b.gate) {
        const gh = BSPR.gatehouse[wl];
        g.drawImage(gh.c, x0, y0 - 15);
        if (b.holyT > 0) holyGlow(gh, x0, y0 - 15, b.holyT, time); // brána prekrýva hradbu – leskne sa aj ona
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
      }
    } else {
      spr = bsprOf(b.kind, b.lvl);
      g.drawImage(spr.c, x0 + T / 2 - Math.floor(spr.w / 2) + hitJit(b.flash), y0 + T + 1 - spr.h);
      if (b.holyT > 0) holyGlow(spr, x0 + T / 2 - Math.floor(spr.w / 2), y0 + T + 1 - spr.h, b.holyT, time);
      if (b.spec) { // vlajočka špecializácie na veži
        const fx = x0 + 13, fy = y0 + T + 1 - spr.h - 4, wv = Math.floor(time * 6 + b.c) % 2;
        g.fillStyle = '#4a4e60'; g.fillRect(fx, fy, 1, 6);
        g.fillStyle = SPECS[b.spec].col; g.fillRect(fx + 1, fy + wv, 3, 2);
      }
      if (b.kind === 'icetower') {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(120,200,255,' + (0.22 + Math.sin(time * 3 + b.c) * 0.1) + ')';
        g.beginPath(); g.arc(x0 + 9, y0 + T + 1 - spr.h + 4, 4, 0, 6.29); g.fill();
        g.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.03) part(x0 + 9 + (Math.random() - 0.5) * 6, y0 + T + 1 - spr.h + 4, 0, 6, 0.6, '#e8f8ff', 10); // padajú ľadové iskričky
      }
      if (b.kind === 'mage') {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(255,200,80,' + (0.25 + Math.sin(time * 4 + b.c) * 0.12) + ')';
        g.beginPath(); g.arc(x0 + 8.5, y0 + T + 1 - spr.h + 2, 4, 0, 6.29); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    }
    if (b.lvl > 1 && b.kind !== 'wall' && tabOf(b.kind) !== 'towers') pxText(g, String(b.lvl), x0 + T - 3, y0 + T - 6, '#f8d048'); // úroveň (veže ju majú len na vzhľade)
  }
  const JOINERS = { wall: 1, tower: 1, mage: 1, icetower: 1, ballista: 1 }; // hradby sa napájajú len na hradby a veže (strážna, mága) – na ostatné budovy nie
  const joins = (c, r) => { const o = occAt(c, r); return !!o && (o === HALL || !!JOINERS[o.kind]); };
  const joinsV = (c, r) => occAt(c, r) !== HALL && joins(c, r); // na radnicu sa hradby napájajú len z bokov, nie zhora
  const joinsBuilding = (c, r) => { const o = occAt(c, r); return !!o && o !== HALL && o.kind !== 'wall' && !!JOINERS[o.kind]; };

  function drawHall(time) {
    const spr = bsprOf('hall', st.hallLvl);
    const x = Math.round(G.hallCx - spr.w / 2), y = G.hallBot + 1 - spr.h;
    g.drawImage(spr.c, x, y); // radnica sa pri zásahu netrasie
    if (st.hallHolyT > 0) holyGlow(spr, x, y, st.hallHolyT, time);
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
    g.drawImage(spr.c, x, y);
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

  // ohnivá stena: na zemi mäkká žiara a žeravé uhlíky (bez tvrdých okrajov), nad tým jazyky plameňov,
  // ktoré sú v strede najvyššie a ku krajom plynule klesajú; kreslia sa podľa hĺbky medzi nepriateľmi
  const fireEnv = (fw, x) => { const u = x / fw.w; return u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 0.7); };
  const fireFade = fw => Math.min(1, fw.t / 0.6, (SPELLS.firewall.dur - fw.t) / 0.25 + 0.15);
  function drawFireGround(fw, time) {
    const a = fireFade(fw), x0 = fw.x - fw.w / 2, y0 = fw.y;
    g.globalAlpha = 0.16 * a; g.fillStyle = '#f89838';
    g.beginPath(); g.ellipse(fw.x, y0, fw.w / 2 + 6, 7, 0, 0, 6.29); g.fill();
    g.globalAlpha = 0.22 * a; g.fillStyle = '#f8d048';
    g.beginPath(); g.ellipse(fw.x, y0, fw.w / 2 - 2, 3.5, 0, 0, 6.29); g.fill();
    g.globalAlpha = a;
    for (let i = 0; i < fw.w; i += 2) { // uhlíky na zemi, mihotavé
      const e = fireEnv(fw, i); if (e < 0.2) continue;
      const fl = Math.sin(time * 7 + i * 1.9) > 0.2;
      g.fillStyle = fl ? '#f89838' : '#c03818';
      g.fillRect(Math.round(x0 + i + hash2(i, 3, 7) * 2), Math.round(y0 - 1 + hash2(i, 5, 9) * 3), 1, 1);
    }
    g.globalAlpha = 1;
  }
  function drawFireFlames(fw, time, front) {
    const a = fireFade(fw) * (front ? 0.8 : 0.88), x0 = Math.round(fw.x - fw.w / 2), base = Math.round(fw.y) + (front ? 3 : 1);
    g.globalAlpha = a;
    for (let i = front ? 2 : 1; i < fw.w; i += 3) { // jeden jazyk plameňa každé 3 body (s malým posunom, aby to nebolo pravidelné)
      const e = fireEnv(fw, i); if (e < 0.12) continue;
      const tx = x0 + i + Math.round(hash2(i, front ? 6 : 1, 4) * 2 - 1);
      const n = 0.55 + 0.45 * Math.sin(time * (8 + hash2(i, 2, 5) * 5) + i * 2.3 + (front ? 1.7 : 0));
      const h = Math.max(2, Math.round(e * (5 + 6 * n) * (front ? 0.45 : 1)));
      const sway = Math.round(Math.sin(time * 5 + i) * 0.6);
      for (let dx = -1; dx <= 1; dx++) {
        const hh = Math.round(h * (dx ? 0.6 : 1));
        if (hh < 1) continue;
        const x = tx + dx;
        g.fillStyle = '#c83018'; g.fillRect(x, base - hh, 1, hh);
        const ho = Math.round(hh * 0.7); g.fillStyle = '#f87830'; g.fillRect(x, base - ho, 1, ho);
        if (!dx) { const hy = Math.round(hh * 0.4); g.fillStyle = '#f8d048'; g.fillRect(x, base - hy, 1, hy); }
      }
      g.fillStyle = '#d83818'; g.fillRect(tx + sway, base - h - 1, 1, 1); // špička sa kníše
      if (h > 7) { g.fillStyle = '#fff7c8'; g.fillRect(tx, base - 2, 1, 1); }
    }
    g.globalAlpha = 1;
  }
  // dosah: jemne vyplnený kruh a výrazný prerušovaný okraj (tmavý obrys + zlatá), aby bol vidieť na každom teréne; čiarky pomaly obiehajú
  function drawRange(cx, cy, rr, time) {
    g.globalAlpha = 0.13; g.fillStyle = '#fff070';
    g.beginPath(); g.arc(cx, cy, rr, 0, 6.29); g.fill();
    g.globalAlpha = 1;
    const n = Math.round(rr * 6.283), off = Math.floor(time * 10), pts = [];
    for (let k = 0; k < n; k++) {
      if (((k + off) >> 2) % 2) continue; // čiarky dlhé 4 body
      const a = k / n * 6.283; pts.push([Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr)]);
    }
    g.fillStyle = 'rgba(28,20,14,0.85)'; for (const [x, y] of pts) g.fillRect(x, y + 1, 1, 1); // tenký tieň pod čiarkou
    g.fillStyle = '#fff070'; for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
  }
  // náhľad ťahanej novej stavby – kreslí sa nad stavbami, aby bolo červené políčko vidieť aj cez budovu
  function drawPlaceGhost(time) {
    if (!pdrag || !pdrag.t) return;
    const blink = Math.floor(time * 4) % 2;
    const { c, r } = pdrag.t, hx = tileX(c), hy = tileY(r), kind = pdrag.kind;
    const ok = (kind === 'paving' ? inZone(c, r) && !inHall(c, r) : canPlace(c, r)) && st.gold >= costOf(kind); // zelená = dá sa postaviť, červená = posuň prst ďalej
    g.fillStyle = ok ? 'rgba(156,212,90,0.35)' : 'rgba(232,72,56,0.5)'; g.fillRect(hx, hy, T, T);
    const spr = kind === 'wall' ? BSPR.wall[0][10] : TRAPS[kind] ? BSPR[kind] : kind === 'paving' ? { c: paveAt(hx, hy) } : bsprOf(kind, 1);
    g.globalAlpha = ok ? 0.75 : 0.45;
    if (kind === 'wall') g.drawImage(spr.c, hx, hy - 6);
    else if (TRAPS[kind]) g.drawImage(spr.c, hx, hy);
    else if (kind === 'paving') g.drawImage(paveAt(hx, hy), hx, hy);
    else g.drawImage(spr.c, hx + T / 2 - Math.floor(spr.w / 2), hy + T + 1 - spr.h);
    g.globalAlpha = 1;
    corners(hx, hy, hx + T - 1, hy + T - 1, ok ? '#9cd45a' : (blink ? '#e84838' : '#ff9a80'));
    if (BUILD[kind].range) drawRange(hx + T / 2, hy + T / 2, bRange({ kind, lvl: 1 }), time); // dosah už pri ukladaní
  }

  // liečivé kúzlo mnícha: na zdvihnutej palici bledomodré svetlo, liečeného obklopí bledomodrá svetelná aura
  const healAuraH = t => (t.isKing ? 26 : 18) + 2;
  function drawStaffGlow(u, time) { // hlavica zdvihnutej palice
    const pulse = 0.5 + 0.5 * Math.sin(time * 6 + u.x), sx = Math.round(u.x + 5), sy = Math.round(u.y - 16);
    g.globalAlpha = 0.35 + 0.3 * pulse; g.fillStyle = '#a8d4ff'; g.fillRect(sx - 2, sy - 2, 5, 5);
    g.globalAlpha = 0.8; g.fillStyle = '#e0f2ff'; g.fillRect(sx - 1, sy - 1, 3, 3);
    g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.fillRect(sx, sy, 1, 1);
  }
  // aura liečeného: kreslí sa podľa hĺbky za ním, takže jednotky stojace za liečeným ju prekryjú
  function drawHealAura(u, t, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6 + u.x);
    const ax = Math.round(t.x), ay = Math.round(t.y), hh = healAuraH(t);
    for (let y = 0; y < hh; y++) {                                                                // svetelný stĺp, hore sa stráca
      const k = 1 - y / hh, w = 5 + Math.round(2 * Math.sin(time * 4 + y * 0.5));
      g.globalAlpha = (0.16 + 0.12 * pulse) * k; g.fillStyle = '#bfe3ff'; g.fillRect(ax - w, ay - y, w * 2 + 1, 1);
    }
    g.globalAlpha = 0.45 + 0.35 * pulse; g.strokeStyle = '#cfe9ff'; g.lineWidth = 1;               // žiariaci kruh pri nohách
    g.beginPath(); g.ellipse(ax + 0.5, ay + 0.5, 7 + pulse, 2.5 + pulse * 0.5, 0, 0, 6.29); g.stroke();
    g.globalAlpha = 1;
    for (let k = 0; k < 4; k++) {                                                                 // iskričky stúpajú okolo
      const f = (time * 0.9 + k / 4) % 1, px = ax + Math.round(Math.sin(time * 3 + k * 1.7) * 6), py = ay - Math.round(f * hh);
      g.globalAlpha = 1 - f; g.fillStyle = k % 2 ? '#ffffff' : '#bfe3ff'; g.fillRect(px, py, 1, 1);
    }
    g.globalAlpha = 1;
  }
  // výber miesta pre obliehací stroj: voľné políčka, kam sa dá postaviť, sa jemne rozsvietia; políčko zdvihnutého stroja bliká
  function drawSiegePick(time) {
    const o = st.siegePick.order || st.siegePick.unit, a = 0.2 + 0.06 * Math.sin(time * 5);
    g.fillStyle = 'rgba(255,240,140,' + a.toFixed(3) + ')';
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) if (siegeSpotOk(c, r, o)) g.fillRect(tileX(c) + 1, tileY(r) + 1, T - 2, T - 2);
    if (!o) return;
    const { c, r } = siegeCell(o.x, o.y);
    if (Math.floor(time * 4) % 2) corners(tileX(c), tileY(r), tileX(c) + T - 1, tileY(r) + T - 1, '#fff070');
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
    if (drag && drag.kind === 'paving') { // náhľad dlažby pred pustením prsta
      const ok = dragAfford();
      g.globalAlpha = 0.75;
      drag.path.forEach((q, i) => {
        const x = tileX(q.c), y = tileY(q.r);
        g.drawImage(paveAt(x, y), x, y);
        if (i >= ok) { g.fillStyle = 'rgba(232,72,56,0.55)'; g.fillRect(x, y, T, T); }
      });
      g.globalAlpha = 1;
      if (drag.path.length) {
        const q = drag.path[drag.path.length - 1], n = Math.min(drag.path.length, ok);
        const s = String(n * costOf('paving')), tx = Math.max(2, Math.min(W - s.length * 4 - 2, tileX(q.c) + T / 2 - s.length * 2)), ty = tileY(q.r) - 8;
        pxText(g, s, tx, ty, n < drag.path.length ? '#e84838' : '#f8d048');
      }
    } else if (drag) { // náhľad radu hradieb pred pustením prsta
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
      if (rr0) { const c = bCenter(b); drawRange(c.x, c.y, rr0, time); }
    }
  }

  function drawProj(p) {
    const r = Math.round;
    if (p.k === 'lance') { // ťažký šíp: drevená žŕdka s kovovým hrotom a červenými pierkami
      const x = p.x, y = p.y;
      for (let k = 0; k < 8; k++) { g.fillStyle = k < 2 ? '#e8ecf4' : k > 5 ? '#e84838' : '#a86c38'; g.fillRect(r(x - p.vx * k), r(y - p.vy * k), 1, 1); }
      g.fillStyle = PAL.K; g.fillRect(r(x + p.vx), r(y + p.vy), 1, 1);
      return;
    }
    if (p.k === 'ice') { // ľadový úlomok so svetlým stredom
      const x = r(p.x), y = r(p.y);
      g.fillStyle = PAL.K; g.fillRect(x - 1, y - 2, 3, 5); g.fillRect(x - 2, y - 1, 5, 3);
      g.fillStyle = '#88d0f0'; g.fillRect(x - 1, y - 1, 3, 3); g.fillRect(x, y - 2, 1, 5);
      g.fillStyle = '#ffffff'; g.fillRect(x, y - 1, 1, 1);
      if (Math.random() < 0.5) part(p.x, p.y, 0, 0, 0.25, '#c8ecff', 0);
      return;
    }
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
  // ohnivá guľa: na zemi sa sťahuje cieľový kruh, z neba šikmo padá žeravá guľa so žiarou
  function drawFallingFireball(f) {
    const p = Math.max(0, f.t / f.max), fx = f.x + 30 * p, fy = f.y - 90 * p, R = SPELLS.fireball.R;
    g.strokeStyle = 'rgba(248,120,48,' + (0.85 * (1 - p)) + ')'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(f.x, f.y, R * (0.35 + 0.65 * p) + 1, (R * (0.35 + 0.65 * p) + 1) * 0.7, 0, 0, 6.29); g.stroke();
    g.fillStyle = 'rgba(20,10,4,' + (0.35 * (1 - p)) + ')'; g.beginPath(); g.ellipse(f.x, f.y, 6 * (1 - p) + 1, 3 * (1 - p) + 0.5, 0, 0, 6.29); g.fill(); // tieň gule
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(fx, fy, 1, fx, fy, 11);
    gr.addColorStop(0, 'rgba(255,200,90,0.8)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, 11, 0, 6.29); g.fill();
    g.globalCompositeOperation = 'source-over';
    const X = Math.round(fx), Y = Math.round(fy);
    for (const [r, col] of [[4.5, PAL.K], [3.6, '#a02810'], [2.8, '#f86818'], [1.8, '#f8d048'], [0.8, '#fff7c8']]) { g.fillStyle = col; g.beginPath(); g.arc(X, Y, r, 0, 6.29); g.fill(); }
  }
  // uzdravenie: na vyliečeného zostúpi zelený stĺp svetla, pod ním sa rozžiari kruh a hore stúpajú zelené krížiky
  function drawHealFx(h) {
    const u = h.u, p = h.t / h.max, a = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8, x = Math.round(u.x), y = Math.round(u.y);
    const w = h.big ? 7 : 4, top = y - (h.big ? 70 : 40) * Math.min(1, p * 4);
    g.globalCompositeOperation = 'lighter';
    const col = g.createLinearGradient(0, top, 0, y);
    col.addColorStop(0, 'rgba(120,230,90,0)'); col.addColorStop(0.7, 'rgba(110,220,80,' + (0.28 * a) + ')'); col.addColorStop(1, 'rgba(160,240,120,' + (0.4 * a) + ')');
    g.fillStyle = col; g.fillRect(x - w, top, w * 2, y - top);
    g.fillStyle = 'rgba(200,255,180,' + (0.3 * a) + ')'; g.fillRect(x, top, 1, y - top - 14); // tenké jasné jadro stĺpa nad postavou
    const gr = g.createRadialGradient(x, y, 1, x, y, w * 2);
    gr.addColorStop(0, 'rgba(140,240,100,' + (0.6 * a) + ')'); gr.addColorStop(1, 'rgba(120,230,90,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, w * 2, w * 0.8, 0, 0, 6.29); g.fill();
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < (h.big ? 4 : 2); i++) { // zelené krížiky stúpajú a blednú
      const q = (p * 1.4 + i / (h.big ? 4 : 2)) % 1, cx = x + Math.round(Math.sin(i * 2.3 + p * 3) * (w + 2)), cy = Math.round(y - 6 - q * (h.big ? 26 : 18));
      g.globalAlpha = a * (1 - q);
      g.fillStyle = PAL.K; g.fillRect(cx - 2, cy - 1, 5, 3); g.fillRect(cx - 1, cy - 2, 3, 5);
      g.fillStyle = '#62c040'; g.fillRect(cx - 1, cy, 3, 1); g.fillRect(cx, cy - 1, 1, 3);
      g.fillStyle = '#e8ffd0'; g.fillRect(cx, cy, 1, 1);
    }
    g.globalAlpha = 1;
  }
  // výbuch ohnivej gule: oslnivý záblesk, ohnivá guľa rozpínajúca sa do strán a rázová vlna po zemi
  function drawBlast(bl) {
    const p = bl.t / bl.max, e = 1 - Math.pow(1 - p, 3), R = bl.R;
    g.globalCompositeOperation = 'lighter';
    const fr = R * (0.5 + 0.7 * e), gr = g.createRadialGradient(bl.x, bl.y - 4, 1, bl.x, bl.y - 4, fr);
    gr.addColorStop(0, 'rgba(255,250,210,' + (1 - p) + ')'); gr.addColorStop(0.4, 'rgba(255,170,60,' + (0.85 * (1 - p)) + ')'); gr.addColorStop(1, 'rgba(220,60,20,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(bl.x, bl.y - 4, fr, fr * 0.8, 0, 0, 6.29); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,200,110,' + (0.9 * (1 - p)) + ')'; g.lineWidth = 2; // rázová vlna
    g.beginPath(); g.ellipse(bl.x, bl.y, R * 1.35 * e + 2, (R * 1.35 * e + 2) * 0.7, 0, 0, 6.29); g.stroke();
    g.lineWidth = 1;
  }
  function drawMark(m) {
    const t = 1 - m.life / m.max;
    if (m.scorch) { // spálenisko po ohnivej guli: tmavá škvrna s uhlíkmi, pomaly bledne
      const a = Math.min(1, (1 - t) * 1.5);
      g.fillStyle = 'rgba(24,16,10,' + (0.45 * a) + ')'; g.beginPath(); g.ellipse(m.x, m.y, m.R * 0.6, m.R * 0.42, 0, 0, 6.29); g.fill();
      g.fillStyle = 'rgba(24,16,10,' + (0.35 * a) + ')'; g.beginPath(); g.ellipse(m.x, m.y, m.R * 0.35, m.R * 0.25, 0, 0, 6.29); g.fill();
      for (let k = 0; k < 7; k++) { // žeravé uhlíky, ktoré postupne zhasnú
        const ang = m.seed + k * 0.9, rr = m.R * (0.15 + (k * 37 % 10) / 22);
        g.fillStyle = t < 0.4 && k % 2 ? 'rgba(248,120,48,' + (1 - t / 0.4) + ')' : 'rgba(40,30,24,' + a + ')';
        g.fillRect(Math.round(m.x + Math.cos(ang) * rr), Math.round(m.y + Math.sin(ang) * rr * 0.7), 1, 1);
      }
      return;
    }
    if (m.wave) {
      const ease = 1 - Math.pow(1 - t, 2);
      const inner = m.holy ? '248,208,72' : m.heal ? '120,230,90' : '168,104,232'; // svätý štít zlatý, uzdravenie zelené, teleport fialový
      for (const [rr, col, w] of [[m.wave * ease, 'rgba(255,255,255,' + (1 - t) + ')', 2], [m.wave * ease * 0.7, 'rgba(' + inner + ',' + (0.9 * (1 - t)) + ')', 2]]) {
        g.strokeStyle = col; g.lineWidth = w;
        g.beginPath(); g.ellipse(m.x, m.y, Math.max(1, rr), Math.max(1, rr * 0.7), 0, 0, 6.29); g.stroke();
      }
      g.globalAlpha = 0.25 * (1 - t); g.fillStyle = m.holy ? '#fff0a0' : m.heal ? '#b0f090' : '#c8a0ff';
      g.beginPath(); g.ellipse(m.x, m.y, Math.max(1, m.wave * ease), Math.max(1, m.wave * ease * 0.7), 0, 0, 6.29); g.fill();
      g.globalAlpha = 1; g.lineWidth = 1;
      return;
    }
    if (m.bolt) { // záblesk blesku na zemi: oslnivé biele jadro so žltou žiarou rýchlo zhasne, iskry po zemi a pomaly blednúca spálenina
      const x = Math.round(m.x), y = Math.round(m.y);
      g.fillStyle = 'rgba(28,20,14,' + (0.4 * (1 - t)) + ')';
      g.beginPath(); g.ellipse(x, y, 5, 2.5, 0, 0, 6.29); g.fill();
      const f = Math.max(0, 1 - t / 0.45); // žiara zhasne za necelú polovicu života
      if (f > 0) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(255,230,120,' + (0.45 * f) + ')'; g.beginPath(); g.ellipse(x, y, 11 - 4 * t, 5 - 2 * t, 0, 0, 6.29); g.fill();
        g.fillStyle = 'rgba(255,255,235,' + (0.9 * f) + ')'; g.beginPath(); g.ellipse(x, y, 5 * f + 1, 2.5 * f + 0.5, 0, 0, 6.29); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      g.fillStyle = 'rgba(255,240,112,' + (1 - t) + ')'; // lomené iskry od miesta úderu
      for (let k = 0; k < 6; k++) {
        const a = m.seed + k * 1.05, len = 4 + (k * 7 % 5) + t * 6;
        for (let q = 2; q < len; q += 1.5) g.fillRect(Math.round(x + Math.cos(a + Math.sin(q) * 0.3) * q), Math.round(y + Math.sin(a + Math.sin(q) * 0.3) * q * 0.5), 1, 1);
      }
      return;
    }
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
    const num = missionAt(i), done = num < st.unlocked, open = num === st.unlocked;
    const anim = st.mapAnim && st.mapAnim.seg === num - 2; // hrad práve odomykaný
    const status = anim ? 'locked' : done ? 'done' : open ? 'open' : 'locked';
    // tieň
    g.fillStyle = 'rgba(10,8,6,0.4)';
    for (let dx = -7; dx <= 7; dx++) g.fillRect(n.x + dx, n.y + 2, 1, Math.abs(dx) > 5 ? 1 : 2);
    if (status === 'open') { // pulzujúci kruh pod hradom
      const rr = 10 + Math.sin(time * 4) * 1, cnt = 32;
      g.fillStyle = '#f8d048';
      for (let k = 0; k < cnt; k += 2) { const a = k / cnt * 6.283 + time; g.fillRect(Math.round(n.x + Math.cos(a) * rr), Math.round(n.y - 3 + Math.sin(a) * rr * 0.55), 1, 1); }
    }
    let top;
    const foeLand = num > HOME_PROVINCES && !done;
    if (foeLand !== isOrc()) { // orkská pevnosť: hrad hordy (za ľudí nedobytý, za orkov vlastný)
      const f = island.fort;
      g.drawImage(f.c, n.x - Math.floor(f.w / 2), n.y - f.h + 2);
      top = n.y - f.h + 2;
    } else {
      const c = status === 'locked' ? island.castleLocked : island.castle;
      g.drawImage(c.c, n.x - Math.floor(c.w / 2), n.y - c.h + 2);
      top = n.y - c.h + 2;
    }
    if (status === 'done') { // modrá zástava = dobyté
      const fx = n.x, fy = top - 6;
      g.fillStyle = '#4a4e60'; g.fillRect(fx, fy, 1, 7);
      const wv = Math.floor(time * 5 + i) % 2;
      g.fillStyle = isOrc() ? '#8c2018' : '#3c64c8'; g.fillRect(fx + 1, fy + wv, 5, 3); // zástava hráča: modrá ľudia, červená orkovia
      g.fillStyle = isOrc() ? '#e84838' : '#88b4ff'; g.fillRect(fx + 1, fy + wv, 2, 1);
      g.fillStyle = '#f8d048'; g.fillRect(fx + 5, fy + 1 - wv, 1, 1);
    } else if (status === 'open') { // skákajúca šípka
      const ay = top - 8 + Math.round(Math.abs(Math.sin(time * 4)) * -3);
      for (let k = 0; k < 4; k++) { g.fillStyle = PAL.K; g.fillRect(n.x - k - 1, ay + k - 1, k * 2 + 3, 1); }
      for (let k = 0; k < 3; k++) { g.fillStyle = k === 0 ? '#fff070' : '#f8d048'; g.fillRect(n.x - (2 - k), ay + k, (2 - k) * 2 + 1, 1); }
    }
    // číslo misie: drobné číslice s obrysom, s medzerou pod hradom (zlaté = dobyté, biele = na rade, sivé = zamknuté)
    const sn = String(num), tw = sn.length * 4 - 1, tx = n.x - Math.floor(tw / 2), ty = n.y + 5;
    pxText(g, sn, tx, ty, status === 'done' ? '#f8d048' : status === 'open' ? '#ffffff' : '#848490');
    let bt = 2; while (bt > 0 && !starsOf(num, bt)) bt--;
    const ns = starsOf(num, bt);
    if (ns) for (let k = 0; k < 3; k++) drawStar(n.x - 7 + k * 5, ty + 7, k < ns, bt);
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
  const provState = i => { const num = missionAt(i), won = num < st.unlocked; return won ? 'ours' : num <= HOME_PROVINCES ? 'attacked' : 'horde'; };
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
  function drawProvince(i, state, time, ctx) {
    const L = provLayers(), c = ctx || g;
    const own = isOrc() ? L.red : L.blue, foe = isOrc() ? L.blue : L.red; // za orkov je územie hráča červené a ľudí modré
    if (state === 'horde') { c.drawImage(foe[i], 0, 0); return; }
    c.drawImage(own[i], 0, 0);
    if (state === 'attacked') { c.globalAlpha = missionAt(i) === st.unlocked ? 0.35 + 0.3 * Math.sin(time * 3) : 0.35; c.drawImage(foe[i], 0, 0); c.globalAlpha = 1; } // pulzuje len najbližšia misia
  }
  // podklad mapy: ostrov, chodník a farby provincií, ktoré sa nehýbu, sa zložia raz do jedného obrázka
  // a prepočítajú sa, len keď sa zmení vlastník provincie alebo sa chodník vyšliapava; živé (pulzujúca, práve dobytá) sa kreslia každý snímok
  function mapBase(live) {
    const n = island.nodes.length, ma = st.mapAnim;
    const key = W + 'x' + H + ':' + st.unlocked + ':' + (ma ? ma.seg + '/' + Math.floor(Math.min(1, ma.t) * 400) : '-') + ':' + Array.from({ length: n }, (_, i) => live(i) ? 'L' : provState(i)).join(',');
    if (island.baseKey === key) return island.base;
    const c = island.base || document.createElement('canvas'); c.width = W; c.height = H;
    const bx = c.getContext('2d');
    bx.drawImage(island.bg, 0, 0);
    drawMapPath(bx); // chodník leží na zemi pod farbou provincií
    for (let i = 0; i < n; i++) if (!live(i)) drawProvince(i, provState(i), 0, bx);
    island.base = c; island.baseKey = key;
    return c;
  }
  function drawProvinces(time) {
    const n = island.nodes.length, pa = st.provAnim;
    const live = i => (pa && pa.i === i) || (provState(i) === 'attacked' && missionAt(i) === st.unlocked);
    g.drawImage(mapBase(live), 0, 0);
    for (let i = 0; i < n; i++) {
      if (!live(i)) continue;
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
  // chodník medzi hradmi: k dobytým hradom vyšliapaný (hlina 1–2 px, okraje s vychodenou trávou),
  // k nedobytým zarastený (len občas presvitne hlina); po víťazstve sa nový úsek postupne vyšliape
  function drawMapPath(c) {
    const px = (x, y, col) => { c.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')'; c.fillRect(x, y, 1, 1); };
    island.segs.forEach((pts, j) => {
      // úsek j vedie z uzla j do j + 1; za orkov sa ide opačne (z misie k + 1 do k + 2 = uzly 9 - k → 8 - k)
      const k = isOrc() ? MISSIONS.length - 2 - j : j, rev = isOrc();
      const done = k + 2 <= st.unlocked, anim = st.mapAnim && st.mapAnim.seg === k;
      const upto = anim ? Math.floor(pts.length * Math.min(1, st.mapAnim.t)) : done ? pts.length : 0;
      let lx = null, ly = null;
      for (let j = 0; j < pts.length; j++) {
        const x = Math.round(pts[j].x), y = Math.round(pts[j].y);
        if (x === lx && y === ly) continue;
        lx = x; ly = y;
        const h = hash2(x, y, 71), worn = rev ? j >= pts.length - upto : j < upto;
        // smer chodníka: druhý pás hliny leží bokom (vodorovný chodník je široký nadol, zvislý doprava)
        const q = pts[Math.min(pts.length - 1, j + 2)], vert = Math.abs(q.x - pts[j].x) < Math.abs(q.y - pts[j].y);
        const sx = vert ? 1 : 0, sy = vert ? 0 : 1;
        if (worn) {
          px(x, y, pickRamp(RAMP.dirt, 0.62 + h * 0.18, x, y));                                   // svetlá vyšliapaná hlina
          if (h > 0.2) px(x + sx, y + sy, pickRamp(RAMP.dirt, 0.48 + h * 0.15, x + sx, y + sy)); // druhý pás, tmavší okraj
          if (h > 0.86) px(x - sx, y - sy, pickRamp(RAMP.dirt, 0.5, x - sx, y - sy));             // miestami ešte širší
          else if (h < 0.12) px(x - sx, y - sy, pickRamp(RAMP.grass, 0.82, x - sx, y - sy));     // vychodená tráva pri kraji
        } else if (h > 0.55) px(x, y, pickRamp(RAMP.dirt, 0.4 + h * 0.2, x, y));                 // zarastený chodník: len miestami hlina
      }
    });
  }
  function renderMap(time) {
    drawProvinces(time); // ostrov s provinciami (podklad je v drawProvinces)
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
    const n = island && island.nodes[nodeOf(num)];
    if (!n) return;
    const panelLow = $('mapBar').offsetHeight * DPR / S;
    const mid = MAP_HEAD + (H - panelLow - MAP_HEAD) / 2;
    mapCamTarget = clampMap(n.y - 6 - mid);
    if (instant) mapCam = mapCamTarget;
  }

  const panelLow = () => $('build').offsetHeight * DPR / S;
  const INTRO_PAN = [1.8, 1.6]; // s: pohľad na tábor, zvezenie k radnici
  function camTick(dt) {
    if (st.phase === 'title') { camY = 0; return; }
    if (st.phase === 'map') {
      if (!mapDrag) mapCam += (mapCamTarget - mapCam) * Math.min(1, dt * 8);
      camY = mapCam;
      return;
    }
    // pri budovaní posuň bojisko nad panel; v boji nie – spodné tlačidlá sú priehľadné nad mapou
    // potiahnutím mapy nadol sa ukáže vrch bojiska; viewUp = o koľko je pohľad vyššie než pri radnici
    const full = st.phase === 'build' && !$('build').hidden ? panelLow() : 0;
    st.viewUp = Math.max(0, Math.min(full + camBase(), st.viewUp || 0));
    let target = camBase() + full - st.viewUp;
    if (st.introPan && (vscroll || st.phase !== 'build')) st.introPan = null; // ťuk/ťah alebo štart vlny prelet preruší
    if (st.introPan) {
      const P = INTRO_PAN, t = (st.introPan.t += dt), ease = x => x * x * (3 - 2 * x);
      const k = t < P[0] ? 1 : ease(Math.max(0, 1 - (t - P[0]) / P[1]));
      camY = target * (1 - k);
      if (t >= P[0] + P[1]) st.introPan = null;
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
    if (playing) for (const key in st.paving) { const [pc, pr] = key.split(','), px = tileX(+pc), py = tileY(+pr); g.drawImage(paveAt(px, py), px, py); } // dlažba pod všetkým
    if (playing) for (const b of st.blds) if (TRAPS[b.kind]) drawPit(b, time);
    if (st.phase === 'build') drawBuildOverlay(time);
    for (const m of st.marks) drawMark(m);
    for (const fw of st.fireWalls || []) drawFireGround(fw, time);
    // objekty zoradené podľa základne (hĺbka)
    const objs = [];
    for (const fw of st.fireWalls || []) { // nepriateľ za stenou je za plameňmi, pred ňou pred nimi; nízky predný rad zakryje nohy tomu, kto práve prechádza
      objs.push({ y: fw.y - 1, f: () => drawFireFlames(fw, time, false) });
      objs.push({ y: fw.y + 3, f: () => drawFireFlames(fw, time, true) });
    }
    if (playing) {
      objs.push({ y: G.hallBot, f: () => drawHall(time) });
      for (const b of st.blds) if (!TRAPS[b.kind]) objs.push({ y: tileY(b.r) + T - (b.kind === 'wall' ? 0.5 : 0), x: b.c, f: () => drawBuilding(b, time) });
      for (const s of st.soldiers) {
        const cast = s.helper === 'chapel' && s.working && s.tgt && !s.dead; // mních pri liečení zdvihne palicu
        objs.push(s.fly ? { y: 9990, f: () => drawFalcon(s, time) } : { y: s.y, f: () => { drawFighter(s, cast ? 'monkCast' : s.spr || 'soldier'); if (cast) drawStaffGlow(s, time); } });
        if (cast) { const t = s.tgt; objs.push({ y: t.y - healAuraH(t) - 1, f: () => drawHealAura(s, t, time) }); }
      }
      if (st.phase === 'build') for (const o of st.siegeOrder) { // kúpené obliehacie stroje čakajú na mieste, odkiaľ vyrazia
        const sp = SPR[BUY[o.key].siege + '8'][6].idle; // otočený k horde
        objs.push({ y: o.y, f: () => { shadow(o.x, o.y, 9); g.drawImage(sp.c, Math.round(o.x - sp.ax), Math.round(o.y - sp.ay)); } });
      }
      if (st.king && !st.king.dead) objs.push({ y: st.king.y, f: () => drawFighter(st.king, heroDef().spr) });
      else if (st.king && kingLying(st.king)) objs.push({ y: st.king.y, f: () => drawDeadKing(st.king, time) });
    }
    for (const e of st.enemies) objs.push({ y: e.y, f: () => drawEnemy(e, time) });
    if (st.camp) {
      for (const o of st.camp.parts) if (o.hp > 0) objs.push({ y: o.y, f: () => { const sp = o.skin.spr(o, time); shadow(o.x, o.y, 8); g.drawImage(sp.c, Math.round(o.x - sp.w / 2) + hitJit(o.flash), o.y - sp.h + (o.skin.dy || 0)); } });
      for (const r of st.camp.rocks) objs.push({ y: 9999, f: () => drawRock(r) });
    }
    objs.sort((a, b) => a.y - b.y || (b.x || 0) - (a.x || 0)); // v rovnakom rade je ľavejšia budova vpredu
    for (const o of objs) o.f();
    if (st.phase === 'build') drawPlaceGhost(time);
    if (st.phase === 'build' && st.siegePick) drawSiegePick(time);
    // ukazovatele zdravia
    for (const e of st.enemies) if (e.hp < e.max && (!e.d.boss || (e.d.giant && st.boss !== e))) bar(e.x, Math.round(e.y - e.h - 3), Math.max(6, e.w - 4), e.hp / e.max, '#e84838');
    for (const b of st.blds) if (BUILD[b.kind].hp && b.hp < bMaxHp(b)) bar(tileX(b.c) + T / 2, b.kind === 'wall' ? tileY(b.r) - 9 : tileY(b.r) + T - bsprOf(b.kind, b.lvl).h - 2, 12, b.hp / bMaxHp(b), '#9cd45a');
    for (const s of st.soldiers) if (s.hp < s.max) bar(s.x, Math.round(s.y - 17), 8, s.hp / s.max, '#88b4ff');
    for (const o of campLive()) if (o.hp < o.max) bar(o.x, o.y - o.skin.spr(o, 0).h - 4, 14, o.hp / o.max, '#e84838');
    if (st.king && !st.king.dead && st.king.hp < kingMax()) bar(st.king.x, Math.round(st.king.y - 19), 10, st.king.hp / kingMax(), '#f8d048');
    for (const p of st.proj) drawProj(p);
    for (const p of st.eproj) { // šíp goblina (tmavý)
      const cols = ['#bcc0cc', '#3e2614', '#3e2614', '#3e2614', '#62a03a'];
      for (let k = 0; k < 5; k++) { g.fillStyle = cols[k]; g.fillRect(Math.round(p.x - p.vx * k), Math.round(p.y - p.vy * k), 1, 1); }
    }
    for (const dr of st.drops) drawDrop(dr);
    drawFog(time);
    for (const b of st.bolts) drawBolt(b);
    for (const f of st.fallFx) drawFallingFireball(f);
    for (const bl of st.blasts || []) drawBlast(bl);
    for (const h of st.healFx || []) if (h.t >= 0) drawHealFx(h);
    for (const sh of st.shields || []) {
      const a = Math.min(1, sh.t / 0.4, (sh.max - sh.t) / 0.2 + 0.2);
      g.globalAlpha = 0.18 * a; g.fillStyle = '#fff070';
      g.beginPath(); g.ellipse(sh.x, sh.y, sh.R, sh.R * 0.7, 0, 0, 6.29); g.fill();
      g.globalAlpha = 0.7 * a; g.strokeStyle = '#f8d048'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(sh.x, sh.y, sh.R, sh.R * 0.7, 0, 0, 6.29); g.stroke();
      g.globalAlpha = 1;
    }
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
    $('hud-king').classList.toggle('swap', st.phase === 'build' && ownedHeroes().length > 1);
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
    for (const [id, cd, max] of [['warcry', st.cryCd, ABIL.warcry.cd]]) {
      const el = $(id + 'Btn');
      el.hidden = !has(id);
      const pp = cd > 0 ? 1 - cd / max : 1;
      el.style.setProperty('--p', (pp * 100) + '%');
      el.classList.toggle('ready', pp >= 1 && kingUp());
      el.classList.toggle('dead', !kingUp());
    }
    if (st.spellSel && !kingUp()) st.spellSel = null;
    for (const b of document.querySelectorAll('.spell')) {
      const id = b.dataset.spell, sp = SPELLS[id], cd = st[sp.cdKey] || 0;
      b.hidden = !spellOn(id);
      const p = cd > 0 ? 1 - cd / spellMax(id) : 1;
      b.style.setProperty('--p', (p * 100) + '%');
      b.classList.toggle('ready', p >= 1 && st.spellSel !== id && kingUp());
      b.classList.toggle('dead', !kingUp());
      b.classList.toggle('sel', st.spellSel === id);
    }
    const bb = $('hud-boss'), B = st.boss;
    if (B && !B.dead && st.phase === 'battle') {
      bb.hidden = false;
      $('bossFill').style.width = (Math.max(0, B.hp / B.max) * 100) + '%';
      $('bossTxt').textContent = (B.d.king ? 'Veľkráľ' : B.d.title || 'Vojvodca') + ' ' + Math.max(0, Math.ceil(B.hp)) + ' / ' + Math.ceil(B.max);
    } else bb.hidden = true;
  }

  const ICONS = {};
  const heroIcon = id => ICONS['hero_' + id] || ICONS.king;
  // portrét nasadeného hrdinu v HUD a na karte Hrdinovia
  function syncHeroIcons() {
    $('kingIcon').src = heroIcon(st.hero); $('icoHero').src = heroIcon(st.hero);
    $('hud-king').title = heroName() + (ownedHeroes().length > 1 ? ' – ťukni pred vlnou a vymeň hrdinu' : '');
  }
  function initIcons() {
    ICONS.tower = spriteURL(BSPR.tower[0], 3);
    ICONS.barracks = spriteURL(BSPR.barracks, 3);
    ICONS.mage = spriteURL(BSPR.mage[0], 3);
    ICONS.icetower = spriteURL(BSPR.icetower[0], 3); ICONS.ballista = spriteURL(BSPR.ballista[0], 3);
    ICONS.wall = spriteURL(BSPR.wall[0][10], 3);
    ICONS.pit = spriteURL(BSPR.pit, 3);
    for (const k of ['mine', 'chapel', 'firepit', 'beartrap', 'workshop', 'range', 'stables', 'armory', 'falconry']) ICONS[k] = spriteURL(BSPR[k], 3);
    ICONS.gate = spriteURL(BSPR.gateIcon, 3);
    ICONS.u_archer = spriteURL(SPR.archer[0], 3);
    ICONS.u_crossbow = spriteURL(SPR.knight[0], 3);
    ICONS.hall = spriteURL(BSPR.hall[2], 2);
    ICONS.king = spriteURL(SPR.king[0], 3);
    for (const id of HERO_IDS) ICONS['hero_' + id] = spriteURL(SPR[HEROES[id].spr][0], 3);
    // portréty hrdinov v 8 smeroch: zozadu so zbraňou, orezané na postavu (kladivo je dlhšie, výrez je väčší)
    const portrait = (set, x, y, n) => {
      const c = document.createElement('canvas'); c.width = n; c.height = n;
      c.getContext('2d').drawImage(set[6].idle.c, x, y, n, n, 0, 0, n, n);
      return spriteURL({ c, w: n, h: n }, 3);
    };
    if (SPR.king8) ICONS.king = ICONS.hero_king = portrait(SPR.king8, 12, 6, 18);
    if (SPR.paladin8) ICONS.hero_paladin = portrait(SPR.paladin8, 11, 4, 20);
    if (SPR.sorc8) ICONS.hero_sorc = portrait(SPR.sorc8, 11, 3, 20);
    ICONS.u_knight = spriteURL(SPR.soldier[0], 3); ICONS.u_footArcher = spriteURL(SPR.footArcher[0], 3);
    // obliehacie stroje: šikmý pohľad spredu (JV) z 3D modelu, orezaný na obrys stroja
    const trimmed = spr => {
      const { w, h } = spr, d = spr.c.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const cut = src => { const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1; c.getContext('2d').drawImage(src, -x0, -y0); return c; };
      return { c: cut(spr.c), sil: cut(spr.sil), w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    for (const k of ['siegeRam', 'siegeCat', 'siegeFire', 'siegeTower']) ICONS['u_' + k] = spriteURL(trimmed(SPR[k + '8'][1].idle), 2);
    $('icoHall').src = UI_ICONS.hall;
    syncHeroIcons(); updateGems();
    for (const k of ['orc', 'garcher', 'bat', 'ram', 'shaman', 'sapper', 'orcKing', 'bear', 'wolf', 'giantRam', 'mammoth']) ICONS['e_' + k] = spriteURL(SPR[k][0], k === 'orcKing' || ENEMY[k].giant ? 2 : 3);
    ICONS.coin = spriteURL(SPR.coin[0], 4);
    ICONS.paving = spriteURL({ c: paveAt(0, 0), w: T, h: T }, 3);
    Object.assign(ICONS, { sp_volley: UI_ICONS.spellVolley, sp_fire: UI_ICONS.spellFire, sp_frost: UI_ICONS.spellFrost, sp_bolt: UI_ICONS.spellBolt,
      sp_warcry: UI_ICONS.spellHorn, sp_shield: UI_ICONS.spellShield, sp_heal: UI_ICONS.spellHeal, sp_firewall: UI_ICONS.spellFirewall, sp_teleport: UI_ICONS.spellTeleport });
    const SPI = { volley: 'sp_volley', fireball: 'sp_fire', freeze: 'sp_frost', lightning: 'sp_bolt', warcry: 'sp_warcry', shield: 'sp_shield', heal: 'sp_heal', firewall: 'sp_firewall', teleport: 'sp_teleport' };
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
      paving: Object.assign({}, st.paving), siegeOrder: st.siegeOrder.map(o => Object.assign({}, o)),
    });
    if (undoStack.length > 40) undoStack.shift();
  }
  function doUndo() {
    const sn = undoStack.pop();
    if (!sn || st.phase !== 'build') return;
    Object.assign(st, { gold: sn.gold, hallLvl: sn.hallLvl, hallHp: sn.hallHp, volleyLvl: sn.volleyLvl, blds: sn.blds, paving: sn.paving, siegeOrder: sn.siegeOrder || [] });
    st.siegePick = null;
    st.sel = null; st.selGroup = null; st.tool = null; st.moving = null;
    if (st.king) {
      if (sn.kingDead && !st.king.dead) Object.assign(st.king, { dead: true, deadT: 9, fadeT: null });
      else if (!sn.kingDead) st.king.dead = false;
      st.king.hp = kingMax(); st.king.x = st.king.hx; st.king.y = st.king.hy;
    }
    rebuildOcc();
    AUDIO.play('sell');
    renderBuild(); updateHud();
  }

  const selGroup = () => st.selGroup && st.selGroup.length > 1 && st.selGroup.includes(st.sel) && st.selGroup.every(w => st.blds.includes(w));

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
    Object.assign(k, { dead: false, deadT: 0, fadeT: null, hp: kingMax(), x: k.hx, y: k.hy, tgt: null, flash: 0, swing: 0, cd: 0 });
    for (let q = 0; q < 24; q++) part(k.x + (Math.random() - 0.5) * 10, k.y - Math.random() * 14, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.8, ['#f8d048', '#fff070', '#ffffff'][q % 3], 30);
  }
  function repairCost() {
    let c = 0;
    for (const b of st.blds) c += bRepairCost(b);
    return c;
  }

  // záložky stavebného panela (druhy stavieb); riadok záložiek a riadok označenej stavby majú rovnakú výšku, aby obrazovka neskákala
  const BUILD_TABS = [
    { id: 'towers',  name: 'Veže',    kinds: ['tower', 'mage', 'icetower', 'ballista'] },
    { id: 'walls',   name: 'Hradby',  kinds: ['wall', 'pit', 'firepit', 'beartrap'] },
    { id: 'army',    name: 'Vojsko',  kinds: ['barracks', 'range', 'stables', 'armory', 'falconry'] },
    { id: 'siege',   name: 'Stroje',  kinds: [] },
    { id: 'support', name: 'Podpora', kinds: ['mine', 'chapel', 'workshop', 'paving'] },
  ];
  function refreshTabShine() {
    for (const tb of document.querySelectorAll('.btab[data-tab]')) {
      const t = BUILD_TABS.find(t => t.id === tb.dataset.tab);
      tb.classList.toggle('shine', !!t && t.kinds.some(isNew));
    }
  }
  const tabOf = kind => (BUILD_TABS.find(t => t.kinds.includes(kind)) || BUILD_TABS[0]).id;
  const SPEC_SHORT = { fire: 'Oheň', rapid: 'Rýchlosť', sniper: 'Ostreľovač' };
  const coinTxt = n => '<img class="coin" src="' + ICONS.coin + '">' + n;

  function renderBuild() {
    const pal = $('palette'); pal.innerHTML = '';
    const row = $('selRow'); row.innerHTML = '';
    // karta akcie označenej stavby – rovnako veľká ako karta stavby
    const act = (icon, label, cost, enabled, onClick, cls, px) => {
      const b = document.createElement('button'), c = cls || '';
      b.className = 'pcard act' + (enabled ? '' : ' poor') + (c ? ' ' + c : '');
      b.innerHTML = '<span class="pin"><span class="face front"><span class="pic"><img' + (px ? ' class="px"' : '') + ' src="' + icon + '"></span><b>' + label + '</b><span class="cost">' + (cost == null ? '' : cost) + '</span></span></span>';
      b.addEventListener('click', () => {
        if (!enabled) { AUDIO.play('deny'); if (typeof onClick === 'string') toast(onClick); return; }
        if (st.phase === 'build') snapshot();
        onClick();
        AUDIO.play(c.includes('up') ? 'upgrade' : c.includes('sell') ? 'sell' : c.includes('unit') ? 'build' : 'click');
        renderBuild(); updateHud();
      });
      pal.appendChild(b);
      return b;
    };
    const shineTech = (el, id) => flashIf(el, isNew(id), id, () => markSeen(id));
    const I = UI_ICONS;
    const lockAct = (icon, label, m, px) => act(icon, label, '🔒 misia ' + m, false, label + ' sa odomkne v misii ' + m, 'locked', px);
    // ďalšia úroveň: kúpiť / najprv radnica / zamknutá do misie / maximum
    // icon = náhľad stavby na ďalšej úrovni
    const upAct = (lvl, cap, cost, apply, label, icon, newId) => {
      if (lvl < cap) shineTech(act(icon, label || 'Vylepšiť', coinTxt(cost), st.gold >= cost, apply, 'up'), newId);
      else if (lvl < lvlCap()) act(icon, 'Úr. ' + (lvl + 1), '🔒 radnica', false, 'Najprv vylepši radnicu', 'locked');
      else if (lvl < MAX_LVL) lockAct(icon, 'Úr. ' + (lvl + 1), lvlMission(lvl + 1));
      else act(I.star, 'Max. úr.', '', false, null, 'max', true);
    };
    const selRow = (icon, title, stats) => {
      const d = document.createElement('div'); d.className = 'selLine';
      d.innerHTML = '<img src="' + icon + '"><div class="info"><b>' + title + '</b><small>' + stats + '</small></div><button class="selX" title="Zavrieť">✕</button>';
      d.querySelector('.selX').addEventListener('click', () => { st.sel = null; st.selGroup = null; st.moving = null; AUDIO.play('click'); renderBuild(); });
      row.appendChild(d);
    };
    const sellAll = (list, refund) => () => {
      st.gold += refund; st.blds = st.blds.filter(x => !list.includes(x)); st.sel = null; st.selGroup = null;
      for (const s of st.soldiers) if (list.includes(s.home)) s.dead = true;
      st.soldiers = st.soldiers.filter(s => !s.dead);
      rebuildOcc();
    };

    if (st.sel === HALL) {
      const k = st.king;
      selRow(ICONS.hall, 'Radnica · úr. ' + st.hallLvl + ' (' + LVL_NAME[st.hallLvl] + ')', 'zdravie ' + Math.ceil(st.hallHp) + '/' + hallMax() + ' · ' + heroName().toLowerCase() + ' úr. ' + kingMeta.lvl + (k && k.dead ? (heroDef().fem ? ' · padla' : ' · padol') : '') + ' · vylepšenie rozšíri územie a dovolí vyššie stavby');
      upAct(st.hallLvl, hallCap(), hallUpCost(), () => { const c = hallUpCost(); st.gold -= c; st.hallLvl++; st.hallHp += 200; st.king.hp = kingMax(); }, null, bPreview({ kind: 'hall', lvl: st.hallLvl + 1 }), 'lvl' + (st.hallLvl + 1));
      if (k && k.dead) { const c = reviveCost(); flashIf(act(heroIcon(st.hero), 'Oživiť', coinTxt(c), st.gold >= c, reviveKing, 'up'), !reviveSeen(), 'revive', () => saveJSON(sk('reviveSeen'), true)); } // prvý pád: karta oživenia preblikne
    } else if (selGroup()) {
      // hromadné akcie pre označenú skupinu (rad hradieb alebo všetky stavby jedného druhu)
      const grp = st.selGroup, kind = grp[0].kind, d = BUILD[kind], isWall = kind === 'wall', cap = bCap();
      const minL = Math.min(...grp.map(w => w.lvl)), maxL = Math.max(...grp.map(w => w.lvl));
      selRow(ICONS[kind], (isWall ? 'Rad hradieb' : d.name + ' – všetky') + ' · ' + grp.length + ' ks', 'úroveň ' + (minL === maxL ? minL : minL + '–' + maxL) + ' · akcie platia pre celú skupinu, najprv pre najslabšie');
      // karta „pre všetky“: ak zlato nestačí, urobí toľko, koľko sa dá („3/6“)
      const bulk = (icon, name, list, costFn, apply, cls, px) => {
        if (!list.length) return;
        let sum = 0; const pick = [];
        for (const x of list) { const c = costFn(x); if (sum + c > st.gold) break; sum += c; pick.push(x); }
        const all = pick.length === list.length;
        act(icon, name + ' ' + (all || !pick.length ? list.length + '×' : pick.length + '/' + list.length),
          coinTxt(pick.length ? sum : list.reduce((t, x) => t + costFn(x), 0)), pick.length > 0, () => { for (const x of pick) apply(x); rebuildOcc(); }, cls, px);
      };
      const cand = grp.filter(w => w.lvl < cap).sort((a, b) => a.lvl - b.lvl);
      if (cand.length) bulk(after(cand[0], { lvl: cand[0].lvl + 1, unit: null, gate: false, spikes: false, spec: null }), 'Vylepšiť', cand, bUpCost, w => {
        const ratio = d.hp ? w.hp / bMaxHp(w) : 1, c = bUpCost(w);
        st.gold -= c; w.spent += c; w.lvl++;
        if (d.hp) w.hp = Math.ceil(bMaxHp(w) * ratio);
      }, 'up');
      else upAct(maxL, maxL, 0, null, null, bPreview({ kind, lvl: maxL + 1 }));
      if (d.hp) bulk(I.actRepair, 'Opraviť', grp.filter(w => bRepairCost(w) > 0), bRepairCost, w => { st.gold -= bRepairCost(w); w.hp = bMaxHp(w); }, '', true);
      const refund = grp.reduce((t, w) => t + Math.floor(w.spent * sellShare()) + (w.unit ? Math.floor(w.unit.spent * sellShare()) : 0), 0);
      act(ICONS.coin, 'Predať ' + grp.length + '×', '+' + refund, true, sellAll(grp, refund), 'sell', true);
      if (isWall) {
        const bare = grp.filter(w => !w.spikes), plain = grp.filter(w => w.spikes && !w.spikeType);
        if (bare.length) {
          if (!has('spikes')) lockAct(after(bare[0], { spikes: true, unit: null, gate: false }), 'Ostne', unlockMissionOf('spikes'));
          else bulk(after(bare[0], { spikes: true, spikeType: null, unit: null, gate: false }), 'Ostne', bare, () => SPIKE_COST, w => { st.gold -= SPIKE_COST; w.spent += SPIKE_COST; w.spikes = true; }, '', true);
        }
        if (plain.length) {
          if (!has('spikeTypes')) lockAct(after(plain[0], { spikeType: 'fire', unit: null, gate: false }), 'Ohnivé/ľadové', unlockMissionOf('spikeTypes'));
          else for (const k in SPIKE_TYPES) bulk(after(plain[0], { spikeType: k, unit: null, gate: false }), SPIKE_TYPES[k].name.split(' ')[0], plain, () => SPIKE_TYPE_COST, w => { st.gold -= SPIKE_TYPE_COST; w.spent += SPIKE_TYPE_COST; w.spikeType = k; }, '', true);
        }
        const free = grp.filter(w => !w.gate && !w.unit); // strelci na hradbách sa nevylepšujú
        if (has('wallArcher') && free.length) for (const type in WUNIT) {
          const wd = WUNIT[type], tid = type === 'archer' ? 'wallArcher' : 'wallCrossbow';
          if (!has(tid)) { lockAct(ICONS['u_' + type], wd.name, unlockMissionOf(tid)); continue; }
          bulk(after(free[0], { unit: { type, lvl: 1 }, gate: false }), wd.name, free, () => wd.cost, w => { st.gold -= wd.cost; w.unit = { type, lvl: 1, cd: 0.3, spent: wd.cost }; }, 'unit');
        }
      }
    } else if (st.sel) {
      const b = st.sel, d = BUILD[b.kind];
      let stats = '';
      if (b.kind === 'chapel') stats = 'mních lieči rytierov a hrdinu ' + HELPERS.chapel.rate(b).toFixed(1) + '/s';
      else if (b.kind === 'mine') stats = 'po vlne +' + Math.round(mineGold(b) * goldMul()) + ' zlata';
      else if (b.kind === 'workshop') stats = 'remeselník opravuje budovy ' + craftRate(b).toFixed(1) + '/s';
      else if (b.kind === 'firepit') stats = 'horenie ' + Math.round(bDmg(b)) + '/s počas ' + FIRE_BURN + ' s';
      else if (b.kind === 'beartrap') stats = 'zastaví na ' + trapStun(b).toFixed(1) + ' s';
      else if (b.kind === 'icetower') stats = 'spomalí na ' + (d.chill + 0.3 * (b.lvl - 1)).toFixed(1) + ' s · poškodenie ' + Math.round(bDmg(b)) + ' · dosah ' + bRange(b);
      else if (b.kind === 'ballista') stats = 'poškodenie ' + Math.round(bDmg(b)) + ' každému v rade · dosah ' + bRange(b);
      else if (d.range) stats = 'poškodenie ' + Math.round(bDmg(b)) + ' · dosah ' + bRange(b);
      else if (UNIT_HOME[b.kind]) { const kt = KTYPES[UNIT_HOME[b.kind]]; stats = UNIT_PLURAL[UNIT_HOME[b.kind]].toLowerCase() + ' ' + knightCap(b) + ' · sila ' + Math.round(knightDmg(b) * kt.dmg); }
      else if (b.kind === 'range') stats = 'lukostrelci ' + archerCap(b) + ' · poškodenie ' + Math.round(archerDmg(b));
      else if (b.kind === 'pit') stats = 'poškodenie ' + Math.round(bDmg(b)) + ' · spomalí';
      if (d.hp) stats += (stats ? ' · ' : '') + 'zdravie ' + Math.ceil(b.hp) + '/' + bMaxHp(b);
      if (b.spikes) stats += ' · ' + (b.spikeType ? SPIKE_TYPES[b.spikeType].name.toLowerCase() : 'ostne') + ' ' + spikeDmg(b);
      if (b.kind === 'wall' && b.nb) stats += ' · spojenie +' + Math.round(WALL_LINK * b.nb * 100) + ' %';
      if (b.unit) stats += ' · ' + WUNIT[b.unit.type].name.toLowerCase() + ' (poškodenie ' + Math.round(uDmg(b.unit)) + ')';
      if (b.spec) stats += ' · ' + SPECS[b.spec].name;
      if (b.gate) stats += ' · rytieri cez ňu prejdú';
      if ((UNIT_HOME[b.kind] || b.kind === 'range') && knightsBlocked(b)) stats = '<span class="warn">⚠ vojaci sa nedostanú von</span> · ' + stats;
      selRow(after(b, {}), (b.gate ? 'Brána' : d.name) + ' · úr. ' + b.lvl, stats);
      upAct(b.lvl, bCap(), bUpCost(b), () => {
        const ratio = d.hp ? b.hp / bMaxHp(b) : 1, c = bUpCost(b);
        st.gold -= c; b.spent += c; b.lvl++;
        if (d.hp) b.hp = Math.ceil(bMaxHp(b) * ratio);
        rebuildOcc();
      }, null, after(b, { lvl: b.lvl + 1 }));
      const fc = bRepairCost(b);
      if (fc) act(I.actRepair, 'Opraviť', coinTxt(fc), st.gold >= fc, () => { st.gold -= fc; b.hp = bMaxHp(b); rebuildOcc(); }, '', true);
      const refund = Math.floor(b.spent * sellShare()) + (b.unit ? Math.floor(b.unit.spent * sellShare()) : 0);
      act(ICONS.coin, 'Predať', '+' + refund, true, sellAll([b], refund), 'sell', true);
      if (b.kind === 'tower' && !b.spec) {
        if (!has('spec')) lockAct(I.actSpec.fire, 'Špecializácia', unlockMissionOf('spec'), true);
        else if (b.lvl < 3) act(I.actSpec.fire, 'Špecializácia', 'od úr. 3', false, 'Špecializácia sa dá vybrať od úrovne 3', 'locked', true);
        else for (const k in SPECS) shineTech(act(after(b, { spec: k }), SPEC_SHORT[k], coinTxt(SPEC_COST), st.gold >= SPEC_COST, () => { st.gold -= SPEC_COST; b.spent += SPEC_COST; b.spec = k; }, 'up', true), 'spec');
      }
      if (b.kind === 'wall') {
        const u = b.unit;
        if (u) {
          const ur = Math.floor(u.spent * sellShare());
          act(I.actDown, 'Odvolať', '+' + ur, true, () => { st.gold += ur; b.unit = null; }, 'sell', true);
        } else if (!b.gate && has('wallArcher')) for (const type in WUNIT) {
          const wd = WUNIT[type], tid = type === 'archer' ? 'wallArcher' : 'wallCrossbow';
          if (!has(tid)) { lockAct(ICONS['u_' + type], wd.name, unlockMissionOf(tid)); continue; }
          shineTech(act(after(b, { unit: { type, lvl: 1 } }), wd.name, coinTxt(wd.cost), st.gold >= wd.cost, () => { st.gold -= wd.cost; b.unit = { type, lvl: 1, cd: 0.3, spent: wd.cost }; }, 'unit'), tid);
        }
        if (b.gate) act(after(b, { gate: false }), 'Na hradbu', '', true, () => { b.gate = false; });
        else if (!u) {
          if (!has('gate')) lockAct(after(b, { gate: true }), 'Brána', unlockMissionOf('gate'));
          else { const gc = gateCost(); shineTech(act(after(b, { gate: true }), 'Brána', coinTxt(gc), st.gold >= gc, () => { st.gold -= gc; b.spent += gc; b.gate = true; }), 'gate'); }
        }
        if (!b.spikes) {
          if (has('spikes')) shineTech(act(after(b, { spikes: true }), 'Ostne', coinTxt(SPIKE_COST), st.gold >= SPIKE_COST, () => { st.gold -= SPIKE_COST; b.spent += SPIKE_COST; b.spikes = true; }, '', true), 'spikes');
          else lockAct(after(b, { spikes: true }), 'Ostne', unlockMissionOf('spikes'));
        } else if (!b.spikeType) {
          if (!has('spikeTypes')) lockAct(after(b, { spikeType: 'fire' }), 'Ohnivé/ľadové', unlockMissionOf('spikeTypes'));
          else for (const k in SPIKE_TYPES) shineTech(act(after(b, { spikeType: k }), SPIKE_TYPES[k].name.split(' ')[0], coinTxt(SPIKE_TYPE_COST), st.gold >= SPIKE_TYPE_COST, () => { st.gold -= SPIKE_TYPE_COST; b.spent += SPIKE_TYPE_COST; b.spikeType = k; }, '', true), 'spikeTypes');
        }
      }
    } else {
      // nič nie je označené: záložky s druhmi stavieb a karty stavieb zvolenej záložky
      if (st.tool) st.buildTab = tabOf(st.tool);
      const tab = BUILD_TABS.find(t => t.id === st.buildTab) || BUILD_TABS[0];
      for (const t of BUILD_TABS) {
        const tb = document.createElement('button');
        const open = t.kinds.some(k => has(k)) || (t.id === 'siege' && Object.values(BUY).some(u => has(u.siege)));
        tb.className = 'btab' + (t === tab ? ' on' : '') + (open ? '' : ' locked') + (t.kinds.some(isNew) ? ' shine' : '');
        tb.title = t.name; tb.dataset.tab = t.id;
        tb.innerHTML = '<img src="' + UI_ICONS.tabs[t.id] + '" alt="' + t.name + '">';
        tb.addEventListener('click', () => {
          if (st.buildTab === t.id) return;
          for (const k of tab.kinds) if (isNew(k)) markSeen(k); // novinku v opúšťanej záložke už hráč videl
          st.buildTab = t.id; AUDIO.play('click');
          if (st.tool && !t.kinds.includes(st.tool)) { st.tool = null; st.flip = null; }
          renderBuild();
        });
        row.appendChild(tb);
      }
      for (const kind of BUILD_ORDER.filter(k => tab.kinds.includes(k))) {
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
        const tip = kind === 'wall' ? ' Ťahaj prstom pre celý rad.' : kind === 'paving' ? ' Ťahaj prstom pre celú plochu.' : '';
        b.innerHTML = '<span class="pin">' +
          '<span class="face front"><span class="pic"><img src="' + ICONS[kind] + '"></span><b>' + d.short + '</b><span class="cost"><img class="coin" src="' + ICONS.coin + '">' + costOf(kind) + '</span></span>' +
          '<span class="face back"><b>' + d.name + '</b><small>' + d.desc + '.' + tip + '</small></span></span>';
        flashIf(b, isNew(kind), kind, () => markSeen(kind));
        b.addEventListener('pointerdown', ev => { if (st.phase === 'build') cardPress = { kind, x: ev.clientX, y: ev.clientY }; });
        b.addEventListener('click', () => {
          if (suppressCardClick) { suppressCardClick = false; return; } // bol to ťah, nie ťuk
          AUDIO.play('click');
          if (st.tool === kind) { // druhý ťuk na vybranú kartu ju otočí (vzadu je popis), ďalší ju otočí späť
            st.flip = st.flip === kind ? null : kind;
            b.classList.toggle('flipped', st.flip === kind);
            return;
          }
          st.tool = kind; st.flip = null; st.sel = null; st.moving = null; st.siegePick = null; renderBuild();
        });
        pal.appendChild(b);
      }
      if (tab.id === 'siege') for (const key in BUY) { // obliehacie stroje: vyrazia so začiatkom vlny
        const u = BUY[key], icon = ICONS['u_' + u.siege];
        if (!st.tech.has(u.siege)) { lockAct(icon, u.name, unlockMissionOf(u.siege), true); continue; }
        const n = siegeCount(key), full = n >= SIEGE_MAX;
        const picked = !!(st.siegePick && st.siegePick.key === key);
        act(icon, u.name + ' ' + n + '/' + SIEGE_MAX, full ? 'plné' : coinTxt(u.cost), !full && st.gold >= u.cost,
          full ? null : () => { st.siegePick = picked ? null : { key }; st.tool = null; st.sel = null; st.moving = null; },
          'pick' + (picked ? ' sel' : ''), true);
      }
    }
    $('nextWave').textContent = 'Do boja';
    const rc = repairCost();
    $('undoBtn').disabled = !undoStack.length;
    const rb = $('repairBtn');
    rb.innerHTML = '<span>Opraviť všetko</span>' + (rc ? '<span class="cost"><img class="coin" src="' + ICONS.coin + '">' + rc + '</span>' : '');
    rb.disabled = !rc || st.gold < rc;
    updateHud();
  }

  // dá sa na políčko postaviť? (na farbu náhľadu a pri pustení prsta)
  const canPlace = (c, r) => inZone(c, r) && !inHall(c, r) && !occAt(c, r);
  // dlažba: presne ako nádvorie pod radnicou (scene.js) – rovnaké tehlové rady 6×5, škáry a farby RAMP.walk;
  // počíta sa z polohy na bojisku, takže susedné dlaždice aj nádvorie na seba plynule nadväzujú
  const paveCache = {};
  function paveAt(px, py) {
    const key = px + ',' + py;
    if (paveCache[key]) return paveCache[key];
    const c = document.createElement('canvas'); c.width = T; c.height = T;
    const x2 = c.getContext('2d'), id = x2.createImageData(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const X = px + x, Y = py + y;
      const row = Math.floor(Y / 5), off = (row % 2) * 3, col = Math.floor((X + off) / 6);
      let v = 0.5 + (hash2(col, row, 21) - 0.5) * 0.3 + (hash2(X, Y, 22) - 0.5) * 0.1;
      if (Y % 5 === 0 || (X + off) % 6 === 0) v = 0.15;
      else if (Y % 5 === 1 || (X + off) % 6 === 1) v += 0.12;
      const rgb = pickRamp(RAMP.walk, v, X, Y), k = (y * T + x) * 4;
      id.data[k] = rgb[0]; id.data[k + 1] = rgb[1]; id.data[k + 2] = rgb[2]; id.data[k + 3] = 255;
    }
    x2.putImageData(id, 0, 0);
    return (paveCache[key] = c);
  }
  function placePaving(c, r) {
    if (!inZone(c, r)) { toast('Stavať sa dá len v zóne pri radnici'); AUDIO.play('deny'); return false; }
    if (inHall(c, r)) { AUDIO.play('deny'); return false; }
    const key = c + ',' + r, dc = costOf('paving');
    if (st.paving[key]) { snapshot(); delete st.paving[key]; st.gold += dc; AUDIO.play('sell'); renderBuild(); return true; } // druhý ťuk dlažbu zoberie
    if (st.gold < dc) { toast('Nedostatok zlata'); AUDIO.play('deny'); return false; }
    snapshot(); st.paving[key] = 1; st.gold -= dc; AUDIO.play('build');
    for (let k = 0; k < 5; k++) part(tileX(c) + 8 + (Math.random() - 0.5) * 12, tileY(r) + 10, (Math.random() - 0.5) * 20, -Math.random() * 14, 0.35, '#a0a0aa', 60);
    renderBuild();
    return true;
  }
  function placeAt(kind, c, r) {
    if (kind === 'paving') return placePaving(c, r);
    const dc = costOf(kind);
    if (!inZone(c, r)) { toast('Stavať sa dá len v zóne pri radnici'); AUDIO.play('deny'); return false; }
    if (!canPlace(c, r)) { AUDIO.play('deny'); return false; } // políčko je obsadené
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

  // ťuk na radnicu: jej políčka, a strecha nad ňou len keď nie je vybraná stavba a políčko nad radnicou je voľné
  // (inak by sa tesne nad radnicu nedalo stavať ani vybrať stavbu, ktorá tam stojí)
  function hallHit(x, y) {
    const c = Math.floor((x - G.gx0) / T), r = Math.floor((y - G.gy0) / T), hr = hallRect();
    if (inHall(c, r)) return true;
    return !st.tool && x >= hr.x0 && x < hr.x1 && y >= hr.y0 - 8 && y < hr.y0 && !occAt(c, r);
  }
  function tapBuild(x, y) {
    const c = Math.floor((x - G.gx0) / T), r = Math.floor((y - G.gy0) / T);
    if (c < 0 || c >= G.cols || r < 0 || r >= G.rows) return;
    if (hallHit(x, y)) { st.sel = HALL; st.tool = null; renderBuild(); return; }
    if (st.tool === 'paving') { placeAt('paving', c, r); return; } // dlažba ide aj pod budovy
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
  const paveFree = (c, r) => inZone(c, r) && !inHall(c, r) && !st.paving[c + ',' + r]; // dlažba ide aj pod budovy
  const dragFree = (c, r) => (drag && drag.kind === 'paving' ? paveFree : wallFree)(c, r);
  const dragAfford = () => Math.floor(st.gold / costOf(drag && drag.kind === 'paving' ? 'paving' : 'wall'));
  const wallsAfford = () => Math.floor(st.gold / costOf('wall'));
  function placeWall(c, r) {
    st.gold -= costOf('wall');
    addBuilding('wall', c, r); stats.builds++;
    for (let k = 0; k < 5; k++) part(tileX(c) + 8 + (Math.random() - 0.5) * 12, tileY(r) + 12, (Math.random() - 0.5) * 30, -Math.random() * 20, 0.4, '#c6a272', 60);
  }
  // ---- presúvanie stavieb (podržať prst na stavbe a potiahnuť) ----
  let bdrag = null;                       // ťahaná stavba {b, start, hover, moved, armed}
  const HOLD_MS = 350;                    // po takomto podržaní prsta sa stavba chytí na presun
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
    if (!canMoveTo(b, c, r)) { AUDIO.play('deny'); return false; } // sem sa stavba presunúť nedá
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
    if (st.siegePick || (!st.tool && siegeAt(p.x, p.y))) { tapSiege(p.x, p.y); return; } // štartové miesto obliehacieho stroja
    const t = evTile(p);
    if (st.tool === 'paving' && inZone(t.c, t.r) && !inHall(t.c, t.r)) { // dlažba: ťuk = jedna (alebo zobrať), ťah = celá plocha
      drag = { kind: 'paving', path: paveFree(t.c, t.r) ? [t] : [], last: t, start: t, moved: false };
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    const o = occAt(t.c, t.r);
    if (o && o !== HALL) { // stavba: ťuk = výber, podržanie prsta = chytí sa a ťahom sa presunie, skorý ťah = posúvanie bojiska
      const bd = bdrag = { b: o, start: t, hover: t, moved: false, armed: false, y0: ev.clientY, x0: ev.clientX, v0: st.viewUp || 0, p };
      bd.timer = setTimeout(() => {
        if (bdrag !== bd || st.phase !== 'build') return;
        bd.armed = true;
        st.sel = o; st.selGroup = null; st.tool = null;
        AUDIO.play('click'); renderBuild();
        try { navigator.vibrate && navigator.vibrate(15); } catch (e) { }
      }, HOLD_MS);
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    if (st.tool === 'wall' && wallFree(t.c, t.r)) {
      drag = { kind: 'wall', path: [t], last: t };
      try { screen.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    const onHall = hallHit(p.x, p.y);
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
      if (Math.abs(ev.clientY - mapDrag.y0) > 10) mapDrag.moved = true; // prst sa pri ťuku trochu pohne – to ešte nie je posun
      if (mapDrag.moved) { mapCam = clampMap(mapDrag.cam0 - dy); mapCamTarget = mapCam; }
      return;
    }
    if (bdrag && st.phase === 'build') {
      if (!bdrag.armed) { // prst sa pohol skôr, než stavbu chytil: posúva sa bojisko
        if (Math.hypot(ev.clientX - bdrag.x0, ev.clientY - bdrag.y0) < 8) return;
        clearTimeout(bdrag.timer);
        vscroll = { y0: bdrag.y0, v0: bdrag.v0, moved: true, p: bdrag.p }; bdrag = null;
        const r = screen.getBoundingClientRect();
        st.viewUp = vscroll.v0 + (ev.clientY - vscroll.y0) / r.height * H;
        return;
      }
      const t = evTile(evPos(ev));
      if (t.c !== bdrag.start.c || t.r !== bdrag.start.r) bdrag.moved = true;
      bdrag.hover = t;
      return;
    }
    if (!drag || st.phase !== 'build') return;
    const t = evTile(evPos(ev));
    if (t.c === drag.last.c && t.r === drag.last.r) return;
    drag.moved = true;
    // prejdi všetky políčka medzi poslednou a aktuálnou pozíciou (aby rýchly ťah nič nepreskočil)
    let { c, r } = drag.last;
    while (c !== t.c || r !== t.r) {
      const dc = t.c - c, dr = t.r - r;
      if (Math.abs(dc) >= Math.abs(dr)) c += Math.sign(dc); else r += Math.sign(dr);
      const back = drag.path.findIndex(q => q.c === c && q.r === r);
      if (back >= 0) drag.path.length = back + 1;          // návrat prstom späť skráti rad
      else if (dragFree(c, r)) drag.path.push({ c, r });
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
      const bd = bdrag; bdrag = null; clearTimeout(bd.timer);
      if (st.phase !== 'build') return;
      if (bd.armed && !bd.moved) return; // podržal a pustil na mieste: stavba zostáva označená
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
      const dr = drag, path = dr.path, n = Math.min(path.length, dragAfford()); drag = null;
      if (st.phase !== 'build') return;
      if (dr.kind === 'paving' && !dr.moved && !path.length) { placePaving(dr.start.c, dr.start.r); return; } // ťuk na dlažbu ju zoberie
      if (n < path.length) { toast('Nedostatok zlata'); AUDIO.play('deny'); }
      if (n > 0) {
        snapshot();
        for (const q of path.slice(0, n)) {
          if (dr.kind === 'paving') { st.paving[q.c + ',' + q.r] = 1; st.gold -= costOf('paving'); }
          else placeWall(q.c, q.r);
        }
        AUDIO.play('build');
      }
      if (st.gold < costOf(dr.kind)) st.tool = null;
      renderBuild();
    }
  };
  screen.addEventListener('pointerup', endDrag);
  screen.addEventListener('pointercancel', endDrag);

  $('nextWave').addEventListener('click', startWave);
  // prepínač armády útok / obrana (vidno ho v boji, keď má hráč vojsko)
  function syncStance() {
    const b = $('stanceBtn'), atk = armyAttacks();
    b.hidden = !st.blds.some(q => UNIT_HOME[q.kind] || q.kind === 'range') && !st.soldiers.some(u => u.siege);
    b.className = atk ? 'attack' : 'defend';
    b.querySelector('img').src = atk ? UI_ICONS.swords : UI_ICONS.shieldDefend;
    b.querySelector('span').textContent = atk ? 'ÚTOK' : 'OBRANA';
  }
  $('stanceBtn').addEventListener('click', ev => {
    ev.stopPropagation();
    st.stance = armyAttacks() ? 'defend' : 'attack';
    AUDIO.play('click'); syncStance();
  });
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
  // obliehacie stroje: kupujú sa počas stavby v záložke Stroje, čakajú pri radnici
  // a vyrazia so začiatkom vlny; naraz najviac 2 z každého druhu (aj s tými, čo už sú na bojisku)
  const BUY = {
    ram:   { cost: 90,  siege: 'siegeRam',   name: 'Baranidlo',     plural: 'baranidlá' },
    cat:   { cost: 120, siege: 'siegeCat',   name: 'Voz. katapult', plural: 'katapulty' },
    fire:  { cost: 110, siege: 'siegeFire',  name: 'Ohnivý voz',    plural: 'ohnivé vozy' },
    tower: { cost: 150, siege: 'siegeTower', name: 'Obl. veža',     plural: 'obliehacie veže' },
  };
  const SIEGE_MAX = 2;
  const siegeCount = kind => st.soldiers.filter(s => s.siege === kind && !s.dead).length + st.siegeOrder.filter(o => o.key === kind).length;
  const canSiege = key => st.tech.has(BUY[key].siege); // v každej misii, keď je stroj raz odomknutý
  // kúpa stroja na miesto (x, y); bez miesta postaví stroj vedľa radnice (simulácia)
  function orderSiege(key, x, y) {
    const u = BUY[key];
    if (st.phase !== 'build' || !canSiege(key) || st.gold < u.cost || siegeCount(key) >= SIEGE_MAX) return false;
    if (x == null) { // bez určeného miesta: prvé voľné políčko striedavo vľavo a vpravo od radnice
      const r = siegeCell(G.hallCx, G.hallTop + 4).r, c0 = siegeCell(G.hallCx, 0).c;
      for (let k = 2; k < G.cols && x == null; k++) for (const c of [c0 - k, c0 + k]) if (x == null && siegeSpotOk(c, r)) ({ x, y } = siegeCellPos(c, r));
      if (x == null) return false;
    }
    st.gold -= u.cost; st.siegeOrder.push({ key, x, y });
    return true;
  }
  // stroje kúpené počas stavby vyrazia so začiatkom vlny z miesta, ktoré im hráč určil
  function launchSiege() {
    for (const o of st.siegeOrder) spawnSiege(o.key, o.x, o.y);
    st.siegeOrder = []; st.siegePick = null;
  }
  // ---- štartové miesto strojov: ťuk na kartu stroja ho vyberie, ťuk na bojisko ho tam postaví;
  // ťuk na stroj na bojisku (kúpený alebo ten, čo prežil vlnu) ho zdvihne a ďalší ťuk ho presunie ----
  const siegeMinY = () => musterYOf() - 10; // stroj začína pri vlastnom území: od zhromaždiska pred zónou k radnici
  // stroje stoja v mriežke ako budovy: jeden stroj na políčko, kotva (stred stroja na zemi) mierne pod stredom políčka
  const siegeCell = (x, y) => ({ c: Math.floor((x - G.gx0) / T), r: Math.floor((y - G.gy0) / T) });
  const siegeCellPos = (c, r) => ({ x: tileX(c) + T / 2, y: tileY(r) + T / 2 + 3 });
  function siegeSpotOk(c, r, self) {
    if (c < 0 || c >= G.cols || r < 0 || r >= G.rows) return false;
    const p = siegeCellPos(c, r);
    if (p.y < siegeMinY()) return false;
    const hr = hallRect();
    if (p.x >= hr.x0 - 4 && p.x < hr.x1 + 4 && p.y >= hr.y0 - 8 && p.y < hr.y1 + 4) return false;
    if (occAt(c, r)) return false;
    const taken = o => o !== self && (o.siege ? !o.dead : true) && (q => q.c === c && q.r === r)(siegeCell(o.x, o.y));
    return !st.siegeOrder.some(taken) && !st.soldiers.some(u => u.siege && taken(u));
  }
  // stroj na bojisku pod prstom (čakajúca objednávka alebo stroj, čo prežil vlnu)
  function siegeAt(x, y) {
    const hit = (ox, oy, key) => { const sp = SPR[BUY[key].siege + '8'][6].idle; return Math.abs(x - ox) <= T / 2 + 2 && y <= oy + 4 && y >= oy - (sp.ay - 2); };
    for (const o of st.siegeOrder) if (hit(o.x, o.y, o.key)) return { order: o };
    for (const u of st.soldiers) if (u.siege && !u.dead && hit(u.x, u.y, u.siege)) return { unit: u };
    return null;
  }
  function tapSiege(x, y) {
    const pk = st.siegePick, on = siegeAt(x, y);
    if (on && (!pk || !pk.key)) { // zdvihne (alebo pustí) stroj na bojisku
      const same = pk && (pk.order === on.order && on.order || pk.unit === on.unit && on.unit);
      st.siegePick = same ? null : on; AUDIO.play('click'); renderBuild(); return;
    }
    if (!pk) return;
    const cell = siegeCell(x, y);
    if (!siegeSpotOk(cell.c, cell.r, pk.order || pk.unit)) { AUDIO.play('deny'); return; } // len voľné políčko pri vlastnom území
    ({ x, y } = siegeCellPos(cell.c, cell.r));
    if (pk.key) {
      if (siegeCount(pk.key) >= SIEGE_MAX || st.gold < BUY[pk.key].cost) { st.siegePick = null; AUDIO.play('deny'); renderBuild(); return; }
      snapshot(); orderSiege(pk.key, x, y);
      if (siegeCount(pk.key) >= SIEGE_MAX || st.gold < BUY[pk.key].cost) st.siegePick = null;
    } else {
      const o = pk.order || pk.unit; o.x = x; o.y = y;
      st.siegePick = null;
    }
    AUDIO.play('build');
    for (let k = 0; k < 8; k++) part(x + (Math.random() - 0.5) * 12, y, (Math.random() - 0.5) * 30, -Math.random() * 16, 0.4, '#c6a272', 50);
    renderBuild(); updateHud();
  }
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
    st.enemies = []; st.proj = []; st.eproj = []; st.drops = []; st.soldiers = []; st.form = null; st.parts = []; st.texts = []; st.marks = []; st.spawnQ = [];
    $('over').hidden = true; $('hud').hidden = true; $('bottom').hidden = true; $('build').hidden = true; $('hud-boss').hidden = true;
  }

  function showMap() {
    st.run = (st.run || 0) + 1; // časovače rozohranej misie sa zrušia
    if (island) island.baseKey = island.borderKey = null; // pozícia môže byť za inú rasu – farby provincií a chodník sa prekreslia
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
      setTimeout(() => { if (st.phase === 'map') banner(isOrc() ? 'Ľudia napadli územie hordy!' : 'Horda napadla tvoje územie!'); }, 400);
    }
  }

  function renderMapPanel() {
    const m = st.mapSel, def = missionDef(m);
    const done = m < st.unlocked;
    $('mNum').textContent = m;
    $('mNum').className = 'mnum' + (done ? ' done' : '');
    $('mName').textContent = def.name;
    const diff = Math.ceil(m / 2);
    $('mMeta').innerHTML = MISSION_WAVES + ' vĺn · obtiažnosť <span class="stars">' + '●'.repeat(diff) + '<i>' + '●'.repeat(5 - diff) + '</i></span>' + (done ? ' · <span class="ok">splnená ✓</span>' : '');
    const foes = [].concat(ENEMY_INTRO[m] || []);
    $('mNew').innerHTML = (foes.length ? '<span>' + (foes.length > 1 ? 'Nepriatelia:' : 'Nepriateľ:') + '</span>' + foes.map(foe => '<em class="foe"><img src="' + ICONS['e_' + foe.id] + '">' + foe.name + '</em>').join('') : '') +
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
    document.querySelector('.tabCard[data-tab=heroes]').classList.toggle('shine', HERO_IDS.some(heroIsNew));
  }
  $('icoHome').src = UI_ICONS.homeTab; $('icoTrophy').src = UI_ICONS.trophy; $('icoSwords').src = UI_ICONS.swords; $('icoShop').src = UI_ICONS.chest;
  let boxDown = false; // položil sa prst/myš do okna misie od jeho otvorenia?
  const openMission = () => { renderMapPanel(); boxDown = false; $('missionBox').hidden = false; };
  const closeMission = () => { $('missionBox').hidden = true; };
  $('mapClose').addEventListener('click', () => { AUDIO.play('click'); closeMission(); });
  // na dotykovej obrazovke príde po ťuku na hrad ešte oneskorený „click“ na to isté miesto – trafil by práve otvorené okno
  // (pozadie ho zavrelo, tlačidlo Hrať spustilo misiu); okno preto prijme klik, až keď sa doň prst naozaj položí
  $('missionBox').addEventListener('pointerdown', () => { boxDown = true; }, true);
  $('missionBox').addEventListener('click', ev => { if (!boxDown) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  $('missionBox').addEventListener('click', ev => { if (ev.target === $('missionBox')) closeMission(); });

  function kingSummary() {
    const xp = kingMeta.lvl >= KING_MAX_LVL ? 'najvyššia úroveň' : 'XP ' + kingMeta.xp + ' / ' + kingXpNeed(kingMeta.lvl);
    const taken = (HERO_TALENTS[st.hero] || TALENTS).filter(t => tal(t.id)).map(t => t.name + (tal(t.id) > 1 ? ' ' + tal(t.id) + '×' : ''));
    return xp + ' · ' + (taken.length ? taken.join(', ') : 'XP získava za každú vlnu, v ktorej bojuje');
  }
  function renderPerks() {
    $('perkStars').innerHTML = [0, 1, 2].map(t => '<span style="color:' + TIERS[t].col + '">★ ' + Math.max(0, tierFree(t)) + '</span>').join('');
    const list = $('perkList'); list.innerHTML = '';
    for (const pk of PERKS) {
      const lvl = perk(pk.id), max = lvl >= PERK_MAX, tier = Math.min(2, Math.floor(lvl / PERK_STEP)), can = !max && tierFree(tier) >= 1;
      const b = document.createElement('button');
      b.className = 'perkCard' + (max ? ' max' : can ? ' can' : '');
      let stars = '';
      for (let t = 0; t < 3; t++) {
        stars += '<span class="pgroup">';
        for (let k = 0; k < PERK_STEP; k++) stars += '<img class="' + (t * PERK_STEP + k < lvl ? 'on' : 'off') + '" src="' + UI_ICONS.tierStars[t] + '" alt="">';
        stars += '</span>';
      }
      const now = pk.sign + pk.per * lvl + ' %', next = pk.sign + pk.per * (lvl + 1) + ' %';
      b.innerHTML = (max ? '' : '<span class="price" style="color:' + (can ? TIERS[tier].col : '') + '">★ 1</span>') +
        '<img class="pic" src="' + (ICONS[pk.icon] || ICONS.coin) + '" alt=""><b>' + pk.name + '</b><small>' + pk.what + '</small>' +
        '<span class="pval">' + (lvl ? now : '0 %') + (max ? '' : ' → <em>' + next + '</em>') + '</span><span class="pstars">' + stars + '</span>';
      b.addEventListener('click', () => {
        if (max) return;
        if (!can) { // chýbajú hviezdy daného druhu
          AUDIO.play('deny'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          toast('Ďalšia úroveň stojí ' + ['medenú', 'striebornú', 'zlatú'][tier] + ' hviezdu – ' + ['medené', 'strieborné', 'zlaté'][tier] + ' hviezdy získaš na ' + ['medenej', 'striebornej', 'zlatej'][tier] + ' úrovni misií');
          return;
        }
        meta.perks[pk.id] = lvl + 1; saveJSON(sk('perks9'), meta.perks);
        AUDIO.play('upgrade'); renderPerks(); renderMapBar();
      });
      list.appendChild(b);
    }
  }

  // ---- Hrdinovia: zatiaľ len kráľ, ďalší hrdinovia prídu neskôr ----
  // karta Hrdinovia: kúpení hrdinovia s úrovňou a schopnosťami (nasadený má zlatý rámik), ostatní s cenou v gemoch
  function renderHeroes() {
    const list = $('heroList'); list.innerHTML = '';
    for (const id of HERO_IDS) {
      const h = HEROES[id];
      if (!ownsHero(id)) {
        const c = document.createElement('div'); c.className = 'hero locked';
        c.innerHTML = '<img src="' + heroIcon(id) + '" alt=""><b>' + h.name + '</b><small>' + h.desc + '</small>';
        const bb = document.createElement('button'); bb.className = 'btn up buy';
        bb.textContent = 'Odomknúť';
        bb.addEventListener('click', () => buyHero(id));
        c.appendChild(bb); list.appendChild(c);
        continue;
      }
      const m = metaOf(id), on = id === st.hero;
      const need = kingXpNeed(m.lvl), pct = m.lvl >= KING_MAX_LVL ? 100 : Math.round(m.xp / need * 100);
      const c = document.createElement('div'); c.className = 'hero sel' + (on ? '' : ' off');
      shineIf(c, heroIsNew(id), () => { markHeroSeen(id); c.classList.remove('shine'); renderMapBar(); });
      c.innerHTML = '<div class="heroMain"><span class="tag">' + (on ? 'Nasadený' : 'Ťukni a nasaď') + '</span><img src="' + heroIcon(id) + '" alt=""><b>' + h.name + ' · úroveň ' + m.lvl + '</b>' +
        '<span class="xpBar"><i style="width:' + pct + '%"></i></span><small>' + (on ? kingSummary() : h.desc) + '</small></div>';
      if (!on) c.querySelector('.heroMain').addEventListener('click', () => { setActiveHero(id); AUDIO.play('upgrade'); renderHeroes(); renderMapBar(); });
      // tri sloty schopností vnútri rámika, zvisle vedľa hrdinu
      const row = document.createElement('div'); row.className = 'skills';
      m.slots.forEach((sid, i) => {
        const bt = document.createElement('button');
        if (m.lvl < KING_SLOT_LVL[i]) { bt.className = 'skill lock'; bt.innerHTML = '<span>úroveň ' + KING_SLOT_LVL[i] + '</span>'; bt.addEventListener('click', () => AUDIO.play('deny')); }
        else if (!sid) { bt.className = 'skill empty'; bt.innerHTML = '<img src="' + UI_ICONS.plus + '" alt=""><span>Vybrať</span>'; bt.addEventListener('click', () => openSkillPick(i, id)); }
        else { bt.className = 'skill'; bt.innerHTML = '<img src="' + ICONS[POWER_INFO[sid].icon] + '" alt=""><span>' + POWER_INFO[sid].name + '</span>'; } // výber je natrvalo
        row.appendChild(bt);
      });
      c.appendChild(row);
      list.appendChild(c);
    }
  }

  // výber schopnosti do slotu (schopnosť z iného slotu sa vymení)
  function openSkillPick(i, id) {
    id = id || st.hero;
    const m = metaOf(id);
    AUDIO.play('click');
    if (m.slots[i]) return;
    $('skillPickHead').textContent = 'Schopnosť ' + (i + 1);
    const box = $('skillOpts'); box.innerHTML = '';
    for (const pid of HEROES[id].powers) {
      const inf = POWER_INFO[pid], taken = m.slots.includes(pid);
      const b = document.createElement('button');
      b.className = 'skillOpt'; b.disabled = taken;
      b.innerHTML = '<img src="' + ICONS[inf.icon] + '" alt=""><span><b>' + inf.name + '</b><small>' + (taken ? 'Hrdina ju už má' : inf.desc) + '</small></span>';
      b.addEventListener('click', () => {
        if (taken || m.slots[i]) return;
        m.slots[i] = pid; saveMetaOf(id, m);
        AUDIO.play('upgrade'); $('skillPick').hidden = true; renderHeroes(); renderMapBar();
      });
      box.appendChild(b);
    }
    $('skillPick').hidden = false;
  }
  $('skillBack').addEventListener('click', () => { AUDIO.play('click'); $('skillPick').hidden = true; });
  // pred vlnou: ťuk na portrét hrdinu v HUD otvorí výber, koho nasadiť
  function openHeroPick() {
    if (st.phase !== 'build' || ownedHeroes().length < 2) return;
    AUDIO.play('click');
    const box = $('heroOpts'); box.innerHTML = '';
    for (const id of ownedHeroes()) {
      const h = HEROES[id], m = metaOf(id), dead = id === st.hero ? !!(st.king && st.king.dead) : !!st.heroDead[id];
      const b = document.createElement('button');
      b.className = 'skillOpt' + (id === st.hero ? ' cur' : '') + (dead ? ' dead' : '');
      b.innerHTML = '<img class="hp" src="' + heroIcon(id) + '" alt=""><span><b>' + h.name + ' · úr. ' + m.lvl + '</b><small>' +
        (id === st.hero ? 'Nasadený' + (dead ? ' – ' + (h.fem ? 'padla' : 'padol') + ', oživ v radnici' : '') : dead ? (h.fem ? 'Padla' : 'Padol') + ' – po nasadení ho oživ v radnici' : h.desc) + '</small></span>';
      b.addEventListener('click', () => { $('heroPick').hidden = true; if (id !== st.hero) switchHero(id); });
      box.appendChild(b);
    }
    $('heroPick').hidden = false;
  }
  $('hud-king').addEventListener('click', openHeroPick);
  $('heroBack').addEventListener('click', () => { AUDIO.play('click'); $('heroPick').hidden = true; });
  $('heroPick').addEventListener('click', ev => { if (ev.target === $('heroPick')) $('heroPick').hidden = true; });
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
    // počas vývoja: namiesto ceny tlačidlo Odomknúť (zadarmo); rasy okrem ľudí ešte nie sú hrateľné
    const item = (cls, img, name, desc, label, onClick) => {
      const r = document.createElement('div'); r.className = 'shopItem' + (cls ? ' ' + cls : '');
      r.innerHTML = img + '<div class="info"><b>' + name + '</b><small>' + desc + '</small></div>';
      const b = document.createElement('button'); b.className = 'btn up';
      b.textContent = label; b.disabled = !onClick;
      if (onClick) b.addEventListener('click', onClick);
      r.appendChild(b); list.appendChild(r);
    };
    const lockedHeroes = HERO_IDS.filter(x => !ownsHero(x));
    item('bundle shine', '<img src="' + UI_ICONS.chest + '" alt="">', 'Kompletný balík', 'Odomkne všetkých hrdinov naraz (rasy pribudnú, keď budú hrateľné)',
      lockedHeroes.length ? 'Odomknúť' : 'Odomknuté', lockedHeroes.length ? () => lockedHeroes.forEach(buyHero) : null);
    sec('Rasy');
    for (const r of RACES.filter(x => x.state !== 'open'))
      item('', '<img src="' + spriteURL(SPR[r.spr][0], 4) + '" alt="">', r.name, r.desc + ' Pripravujeme.', 'Čoskoro', null);
    sec('Hrdinovia');
    for (const id of HERO_IDS.filter(x => HEROES[x].price)) {
      const h = HEROES[id], own = ownsHero(id);
      item('', '<img src="' + heroIcon(id) + '" alt="">', h.name, h.desc, own ? (h.fem ? 'Odomknutá' : 'Odomknutý') : 'Odomknúť', own ? null : () => buyHero(id));
    }
  }
  document.querySelectorAll('.tabCard').forEach(b => b.addEventListener('click', () => { if (b.dataset.tab !== mapTab) setTab(b.dataset.tab); }));

  function tapMap(x, y) {
    if (st.mapAnim) return;
    island.nodes.forEach((n, i) => {
      if (Math.hypot(n.x - x, n.y - 5 - y) > 14) return;
      const num = missionAt(i);
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
      const n = island.nodes[nodeOf(a.seg + 2)];
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
    for (const foe of [].concat(ENEMY_INTRO[m] || [])) items.push({ icon: ICONS['e_' + foe.id], name: foe.name, tag: ENEMY[foe.id].giant ? 'Pozor – obor hordy' : 'Pozor – nový nepriateľ', desc: foe.desc.charAt(0).toUpperCase() + foe.desc.slice(1) + '.', foe: true });
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
    const avail = (HERO_TALENTS[st.hero] || TALENTS).filter(t => tal(t.id) < TAL_MAX && (!t.need || has(t.need) || spellOn(t.need)));
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
      c.innerHTML = '<img src="' + (t.icon === 'hero' ? heroIcon(st.hero) : ICONS[t.icon]) + '"><span class="info"><b>' + t.name + ' <span class="pips">' + '●'.repeat(lv + 1) + '<i>' + '●'.repeat(TAL_MAX - lv - 1) + '</i></span></b><small>' + t.desc + '</small></span>';
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
    // obrazovky pod úvodným obrázkom sa skryjú až po jeho zjavení, inak by cez prelínanie prebliklo bojisko/ostrov
    SPLASH.show(() => { $('map').hidden = true; $('slots').hidden = true; $('title').hidden = true; });
    AUDIO.play('click');
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
    { name: 'Ľudia',   spr: 'race_humans', state: 'open',                desc: 'Rytieri, kamenné hradby a odvážni hrdinovia.' },
    { name: 'Orkovia', spr: 'race_orcs',   state: 'open',                desc: 'Surová sila a nekonečné hordy.' },
    { name: 'Nemŕtvi', spr: 'race_undead', state: 'soon',                desc: 'Padlí kostlivci vstávajú znova do boja.' },
    { name: 'Elfovia', spr: 'race_elves',  state: 'gem', price: 500,     desc: 'Presní lukostrelci a lesná mágia.' },
    { name: 'Démoni',  spr: 'race_demons', state: 'gem', price: 500,     desc: 'Oheň, besnenie a temné obete.' },
    { name: 'Roj',     spr: 'race_swarm',  state: 'gem', price: 800,     desc: 'Hmyzia ríša, ktorá sa rýchlo množí a zaplaví bojisko.' },
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
    if (!aw || !h) { requestAnimationFrame(() => unrollScroll(anim, screen)); return; } // ešte nemá rozmery (papier s nulovou šírkou sa nedá nakresliť)
    p.style.backgroundImage = 'url(' + UI_ICONS.scrollPaper(aw, ah) + ')'; p.style.backgroundSize = aw * PXS + 'px ' + ah * PXS + 'px';
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
  // papier a tyče sa kreslia na presnú šírku zvitku – keď sa zvitok rozšíri či zúži (zmena okna, otočenie mobilu),
  // prekreslia sa nanovo; sleduje sa samotný papier, takže sa zmeria až nová šírka (nie stará pred úpravou hry)
  const scrollRO = new ResizeObserver(entries => {
    for (const en of entries) {
      const p = en.target, w = Math.round(en.contentRect.width), sc = p.closest('.screenOverlay');
      if (p._w === w) continue;
      const had = p._w != null; p._w = w;
      if (had && w && sc && !sc.hidden && p.style.height !== '0px') unrollScroll(false, sc.id);
    }
  });
  for (const sc of ['slots', 'title']) scrollRO.observe($(sc).querySelector('.paper'));
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
        AUDIO.play('build');
        if (!info) clearSlot(n); // nová hra začína úplne načisto: kráľ, žiadne skúsenosti ani schopnosti (aj po starých zvyškoch)
        loadSlot(n);
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
      c.className = 'race ' + r.state + (r.name === (st.race || 'Ľudia') ? ' sel' : '');
      const img = spriteURL(SPR[r.spr][0], 4, r.state !== 'open');
      const tag = r.state === 'open' ? 'Hrať' : r.state === 'soon' ? 'Čoskoro' : '<img class="gem" src="' + ICONS.gem + '">' + r.price;
      c.innerHTML = '<img src="' + img + '"><b>' + r.name + '</b><span class="tag">' + tag + '</span>';
      c.addEventListener('click', () => {
        if (r.state === 'soon') toast(r.name + ' prídu v ďalšej verzii');
        else if (r.state === 'gem') toast('Odomykanie za gemy pripravujeme');
        else { saveJSON(sk('race'), r.name); st.race = r.name; saveProgress(); showMap(); }
      });
      box.appendChild(c);
    }
    unrollScroll(true, 'title');
  }

  // odpočet budovania počas obliehania (stojí, kým kráľ vyberá talent)


  // po vlne (aj počas stavania) sa hrdina pokojne prejde späť k radnici, namiesto skoku na miesto
  function heroWalkHome(dt) {
    const k = st.king;
    if (!k || k.dead || !(st.phase === 'pause' || st.phase === 'build')) return;
    k.tgt = null; k.flash = Math.max(0, (k.flash || 0) - dt); k.swing = Math.max(0, (k.swing || 0) - dt);
    if (Math.hypot(k.hx - k.x, k.hy - k.y) <= 1) return;
    moveKnight(k, k.hx, k.hy, (k.spd || 26) * 1.15, dt);
    if (!k.next) moveTo(k, k.hx, k.hy, (k.spd || 26) * 1.15, dt); // cesta zatarasená – ide priamo
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
    } else { acc = 0; updateFx(dt); mapTick(dt); heroWalkHome(dt); }
    camTick(dt);
    render(now / 1000);
    hudTick();
    requestAnimationFrame(frame);
  }

  initSprites();
  initOrcSprites(); // horda orkov v 8 smeroch (js/orcs8.js)
  initBuildingSprites();
  initSiegeSprites(); // obliehacie stroje v 8 smeroch (js/siege.js)
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
  window.FW = { DIFF, meta, perk, st, G, costOf, moveBuilding, renderBuild, get camY() { return camY; }, get slowmoT() { return slowmoT; }, hudTick, ability, SPECS, KTYPES, BUILD, ENEMY, WUNIT, snap, sheet, update, spawnEnemy, render, addBuilding, startWave, rebuildOcc, showMap, startMission, missionWon, castSpell, selectSpell, SPELLS, KING_SLOT_LVL, HEROES, switchHero, setActiveHero, ownedHeroes, heroDef, heroWalkHome,
    enterBuild, reviveKing, reviveCost, TIERS, starsOf, tierOpen, showUnlockDeck, showTalentPick, kingMeta, gainKingXp, volley, has, lvlCap, hallCap, bCap, bUpCost, hallUpCost, repairCost, bRepairCost, bMaxHp, hallMax, zoneTopRow, inZone, inHall, occAt, kingMax, orderSiege, SIEGE_BUY: BUY, knightsBlocked };
})();
