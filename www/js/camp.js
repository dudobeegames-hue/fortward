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
    keep:        { role: 'keep',    name: 'Orkská pevnosť',  spr: () => BSPR.orcKeep, size: [3, 3] },
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
    wall:     { role: 'wall',    name: 'Hradby',          spr: o => BSPR.wall[0][o.mask != null ? o.mask : 10], hp: 1.1, dy: 2 },
    gatehouse:{ role: 'wall',    name: 'Brána',           spr: o => gateSprite(o.mask != null ? o.mask : 10), hp: 1.5, dy: 2 },
    hall:     { role: 'keep',    name: 'Radnica',         spr: () => BSPR.hall[0], size: [3, 3] },
  },
};
const campSize = pc => pc.size || [1, 1];
const CAMP_EXTRA = 0.45; // misie s táborom majú bojisko o 45 % vyššie ako obrazovka (miesto na tábor aj na stavanie)
// obdĺžniky pod stavbami hradu (aj kus nad políčkom, kam siaha obrázok) – tam scéna nekreslí stromy ani skaly
function campClearRects(list, G) {
  const out = [];
  for (const q of list || []) {
    const pc = CAMP_PIECES.orc[q.k] || CAMP_PIECES.human[q.k], [w, h] = pc ? campSize(pc) : [1, 1];
    out.push([G.gx0 + q.c * G.T - 3, G.gy0 + (q.r + h) * G.T - 38, G.gx0 + (q.c + w) * G.T + 3, G.gy0 + (q.r + h) * G.T + 3]);
  }
  return out;
}
// hradby a brány ľudí sa spájajú ako v hre: so susednými hradbami, bránami a vežami (na radnicu len z boku)
const CAMP_JOIN = { wall: 1, gatehouse: 1, tower: 1, mage: 1, icetower: 1, ballista: 1, hall: 1 };
// list = stavby hradu ({k|kind, c, r}); vráti masku spojení 1 hore, 2 vpravo, 4 dole, 8 vľavo
function campWallMask(list, q) {
  const kindOf = o => o.k || o.kind;
  const at = (c, r) => list.find(o => { const pc = CAMP_PIECES.human[kindOf(o)], [w, h] = pc ? campSize(pc) : [1, 1]; return c >= o.c && c < o.c + w && r >= o.r && r < o.r + h; });
  const j = (c, r, vert) => { const o = at(c, r); return !!o && !!CAMP_JOIN[kindOf(o)] && !(vert && kindOf(o) === 'hall'); };
  return (j(q.c, q.r - 1, true) ? 1 : 0) | (j(q.c + 1, q.r) ? 2 : 0) | (j(q.c, q.r + 1, true) ? 4 : 0) | (j(q.c - 1, q.r) ? 8 : 0);
}
// brána = úsek hradby so strážnicou nad ním (ako v hre), pre každé napojenie raz zložená
const GATE_SPR = {};
function gateSprite(m) {
  if (!GATE_SPR[m]) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 33;
    const x = c.getContext('2d'); x.drawImage(BSPR.wall[0][m].c, 0, 9); x.drawImage(BSPR.gatehouse[0].c, 0, 0);
    GATE_SPR[m] = spriteFromCanvas(c);
  }
  return GATE_SPR[m];
}
