'use strict';
// Fortward – stavby táborov a hradov protivníka (spoločné pre hru aj editor hradov www/dev/castle-editor.html).
// ---- tábor hordy (od misie 6): stavby nepriateľskej rasy na hornom okraji bojiska, mimo dostrelu veží ----
// Každá stavba má všeobecnú úlohu (ostreľovač, veža, liečiteľ, posilňovač, liaheň jednotiek, opevnenie, srdce);
// meno a vzhľad jej dodá rasa protivníka (CAMP_PIECES). Keď bude hráč hrať za inú rasu, tábor sa poskladá
// z budov rasy, proti ktorej hrá.
const CAMP_ROLES = {
  bombard: { hp: 260, gold: 40, what: 'z diaľky ostreľuje tvoje budovy' },
  tower:   { hp: 300, gold: 30, what: 'strieľa na tvoje jednotky v okolí' },
  totem:   { hp: 200, gold: 35, what: 'kým stojí, horda sa pomaly lieči' },
  drum:    { hp: 180, gold: 30, what: 'kým stojí, horda je rýchlejšia' },
  spawn:   { hp: 260, gold: 35, what: 'vychádzajú z nej jednotky jej druhu – keď padne, ten druh už v misii nepríde' },
  wall:    { hp: 220, gold: 8,  what: 'kryje tábor – vojaci ho musia najprv prelomiť' },
  keep:    { hp: 900, gold: 80, what: 'srdce tábora – keď padne, zrúti sa celý tábor' },
  trap:    { hp: 120, gold: 10, what: 'pasca – zraní alebo zastaví vojakov, ktorí cez ňu prejdú (ožije pri hre za orkov)' },
  support: { hp: 200, gold: 30, what: 'pomocná stavba – zlato, opravy (ožije pri hre za orkov)' },
};
// stavby hradov podľa rasy protivníka: druh → úloha, meno, obrázok, veľkosť v políčkach mriežky (size, predvolene 1×1)
// a pri liahni druh jednotky (unit). Hrady sa skladajú v editore hradov (www/dev/castle-editor.html)
// a ukladajú do js/castles.js. Ľudské stavby ožijú, keď sa bude dať hrať za orkov.
const CAMP_PIECES = {
  orc: {
    goblinTent:  { role: 'spawn', unit: 'goblin',  name: 'Goblinský stan',       spr: () => BSPR.orcTent },
    orcBarracks: { role: 'spawn', unit: 'orc',     name: 'Orkský barak',         spr: () => BSPR.orcBarracks },
    brutePit:    { role: 'spawn', unit: 'brute',   name: 'Jama surovcov',        spr: () => BSPR.brutePit },
    goblinRange: { role: 'spawn', unit: 'garcher', name: 'Goblinská strelnica',  spr: () => BSPR.goblinRange },
    batCave:     { role: 'spawn', unit: 'bat',     name: 'Netopierí brloh',      spr: (o, t) => BSPR.batCave[Math.floor(t * 4) % 2] },
    shamanHut:   { role: 'spawn', unit: 'shaman',  name: 'Šamanská chatrč',      spr: (o, t) => BSPR.shamanHut[Math.floor(t * 3) % 2] },
    bearDen:     { role: 'spawn', unit: 'bear',    name: 'Medvedí brloh',        spr: () => BSPR.bearDen },
    powderHut:   { role: 'spawn', unit: 'sapper',  name: 'Prachareň',            spr: () => BSPR.powderHut },
    wolfPen:     { role: 'spawn', unit: 'wolf',    name: 'Vlčia ohrada',         spr: () => BSPR.wolfPen },
    catapult:    { role: 'bombard', name: 'Orkský katapult', spr: o => BSPR.orcCatapult[o.fired > 0 ? 1 : 0] },
    tower:       { role: 'tower',   name: 'Orkská veža',     spr: () => BSPR.orcTower },
    totem:       { role: 'totem',   name: 'Šamanský totem',  spr: (o, t) => BSPR.orcTotem[Math.floor(t * 3) % 2] },
    drum:        { role: 'drum',    name: 'Vojnový bubon',   spr: (o, t) => BSPR.orcDrum[Math.floor(t * 4) % 2] },
    palisade:    { role: 'wall',    name: 'Palisáda',        spr: () => BSPR.palisade },
    gate:        { role: 'wall',    name: 'Brána palisády',  spr: () => BSPR.palisadeGate },
    stonewall:   { role: 'wall',    name: 'Kamenný múr',     spr: () => BSPR.orcWall, hp: 1.7 },
    stonegate:   { role: 'wall',    name: 'Kamenná brána',   spr: () => BSPR.orcWallGate, hp: 1.7 },
    stakes:      { role: 'wall',    name: 'Koly',            spr: () => BSPR.stakes, hp: 0.4 },
    keep:        { role: 'keep',    name: 'Orkská pevnosť',  spr: () => BSPR.orcKeep, size: [3, 2] },
  },
  human: { // všetky stavby, ktoré má hráč za ľudí
    barracks: { role: 'spawn', unit: 'knight', name: 'Kasárne',    spr: () => BSPR.barracks },
    range:    { role: 'spawn', unit: 'archer', name: 'Strelnica',  spr: () => BSPR.range },
    stables:  { role: 'spawn', unit: 'rider',  name: 'Stajne',     spr: () => BSPR.stables },
    armory:   { role: 'spawn', unit: 'spear',  name: 'Zbrojnica',  spr: () => BSPR.armory },
    falconry: { role: 'spawn', unit: 'falcon', name: 'Sokoliareň', spr: () => BSPR.falconry },
    tower:    { role: 'tower',   name: 'Strážna veža',    spr: () => BSPR.tower[0] },
    mage:     { role: 'tower',   name: 'Veža mága',       spr: () => BSPR.mage[0] },
    icetower: { role: 'tower',   name: 'Ľadová veža',     spr: () => BSPR.icetower[0] },
    ballista: { role: 'bombard', name: 'Balista',         spr: () => BSPR.ballista[0] },
    chapel:   { role: 'totem',   name: 'Kaplnka',         spr: () => BSPR.chapel },
    workshop: { role: 'support', name: 'Dielňa remeselníka', spr: () => BSPR.workshop },
    mine:     { role: 'support', name: 'Zlatá baňa',      spr: () => BSPR.mine },
    pit:      { role: 'trap',    name: 'Jama s ostňami',  spr: () => BSPR.pit },
    firepit:  { role: 'trap',    name: 'Ohnivá jama',     spr: () => BSPR.firepit },
    beartrap: { role: 'trap',    name: 'Medvedia pasca',  spr: () => BSPR.beartrap },
    wall:     { role: 'wall',    name: 'Hradby',          spr: () => BSPR.wall[0][10], hp: 1.1 },
    gatehouse:{ role: 'wall',    name: 'Brána',           spr: () => BSPR.gateIcon, hp: 1.5 },
    hall:     { role: 'keep',    name: 'Radnica',         spr: () => BSPR.hall[0], size: [3, 3] },
  },
};
const campSize = pc => pc.size || [1, 1];
