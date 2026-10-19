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
  trap:    { hp: 120, gold: 10, what: 'pasca – zraní alebo zastaví vojakov, ktorí cez ňu prejdú; nedá sa zničiť' },
  support: { hp: 200, gold: 30, what: 'pomocná stavba – zlato, opravy (ožije pri hre za orkov)' },
};
// stavby hradov podľa rasy protivníka: druh → úloha, meno, obrázok, veľkosť v políčkach mriežky (size, predvolene 1×1)
// a pri liahni druh jednotky (unit). Hrady sa skladajú v editore hradov (www/dev/castle-editor.html)
// a ukladajú do js/castles.js. Ľudské stavby ožijú, keď sa bude dať hrať za orkov.
const CAMP_PIECES = {
  orc: { // všetky stavby, ktoré má hráč za orkov (rovnaké druhy a mená ako v hre)
    // liahne vypúšťajú druhy hordy z vĺn (unit)
    barracks:  { role: 'spawn', unit: 'orc',               name: 'Orkský barak',        spr: () => BSPR.orcBarracks },
    range:     { role: 'spawn', unit: 'garcher',           name: 'Goblinská strelnica', spr: () => BSPR.goblinRange },
    stables:   { role: 'spawn', unit: ['wolf', 'bear'], label: 'vlčí a medvedí jazdci', name: 'Vlčia ohrada', spr: () => BSPR.wolfPen },
    armory:    { role: 'spawn', unit: 'brute',             name: 'Jama surovcov',       spr: () => BSPR.brutePit },
    falconry:  { role: 'spawn', unit: 'bat',               name: 'Netopierí brloh',     spr: (o, t) => BSPR.batCave[Math.floor(t * 4) % 2] },
    chapel:    { role: 'spawn', unit: 'shaman',            name: 'Šamanská chatrč',     spr: (o, t) => BSPR.shamanHut[Math.floor(t * 3) % 2] },
    workshop:  { role: 'spawn', unit: ['goblin', 'sapper'], label: 'gobliny a podkopníci', name: 'Goblinský stan', spr: () => BSPR.orcTent },
    // veže a vrhač: tábor hordy ich má otočené k hráčovi (veža spredu, trebuchet strieľa nadol)
    tower:     { role: 'tower',   name: 'Orkská veža',     spr: o => BSPR.orcTower[campLvl(o)], lvlArt: true },
    mage:      { role: 'tower',   name: 'Ohnivý totem',    spr: o => OBSPR.mage[campLvl(o)], lvlArt: true },
    icetower:  { role: 'tower',   name: 'Jedový kotol',    spr: o => OBSPR.icetower[campLvl(o)], lvlArt: true },
    ballista:  { role: 'bombard', name: 'Trebuchet',       spr: o => BSPR.orcTrebuchet[o.fired > 0 ? 1 : 0], fixed: true }, // nevylepšuje sa (ako v hre)
    mine:      { role: 'support', name: 'Zlatá baňa',      spr: () => BSPR.mine },
    pit:       { role: 'trap',    name: 'Jama s ostňami',  spr: () => BSPR.pit },
    firepit:   { role: 'trap',    name: 'Ohnivá jama',     spr: () => BSPR.firepit },
    beartrap:  { role: 'trap',    name: 'Medvedia pasca',  spr: () => BSPR.beartrap },
    // hradba, brána a pevnosť ako stavby hráča za orkov: s úrovňou menia vzhľad (OBSPR), hradby sa spájajú
    stake:     { role: 'wall',    name: 'Koly',            spr: () => BSPR.stakes, hp: 0.4, fixed: true }, // koly sa nevylepšujú (ako v hre)
    wall:      { role: 'wall',    name: 'Drevená hradba',  spr: o => OBSPR.wall[campLvl(o)][o.mask != null ? o.mask : 10], hp: 1.1, dy: 2, lvlArt: true },
    gatehouse: { role: 'wall',    name: 'Brána',           spr: o => gateSprite(o.mask != null ? o.mask : 10, campLvl(o), true), hp: 1.5, dy: 2, lvlArt: true },
    hall:      { role: 'keep',    name: 'Orkská pevnosť',  spr: o => OBSPR.hall[campLvl(o)], size: [3, 3], lvlArt: true },
  },
  human: { // všetky stavby, ktoré má hráč za ľudí
    // liahne vypúšťajú druhy z vĺn (unit), ktoré za orkov vyzerajú ako ľudské jednotky (label)
    barracks: { role: 'spawn', unit: ['goblin', 'brute'], label: 'rytieri a paladini', name: 'Kasárne', spr: () => BSPR.barracks },
    range:    { role: 'spawn', unit: 'garcher', label: 'lukostrelci', name: 'Strelnica', spr: () => BSPR.range },
    stables:  { role: 'spawn', unit: ['wolf', 'bear'], label: 'jazda', name: 'Stajne', spr: () => BSPR.stables },
    armory:   { role: 'spawn', unit: 'orc', label: 'kopijníci', name: 'Zbrojnica', spr: () => BSPR.armory },
    falconry: { role: 'spawn', unit: 'bat', label: 'sokoly', name: 'Sokoliareň', spr: () => BSPR.falconry },
    tower:    { role: 'tower',   name: 'Strážna veža',    spr: o => BSPR.tower[campLvl(o)], lvlArt: true },
    mage:     { role: 'tower',   name: 'Veža mága',       spr: o => BSPR.mage[campLvl(o)], lvlArt: true },
    icetower: { role: 'tower',   name: 'Ľadová veža',     spr: o => BSPR.icetower[campLvl(o)], lvlArt: true },
    ballista: { role: 'bombard', name: 'Balista',         spr: o => BSPR.ballista[campLvl(o)], lvlArt: true },
    chapel:   { role: 'totem',   name: 'Kaplnka',         spr: () => BSPR.chapel },
    workshop: { role: 'spawn', unit: 'sapper', label: 'remeselníci s prachom', name: 'Dielňa remeselníka', spr: () => BSPR.workshop },
    mine:     { role: 'support', name: 'Zlatá baňa',      spr: () => BSPR.mine },
    pit:      { role: 'trap',    name: 'Jama s ostňami',  spr: () => BSPR.pit },
    firepit:  { role: 'trap',    name: 'Ohnivá jama',     spr: () => BSPR.firepit },
    beartrap: { role: 'trap',    name: 'Medvedia pasca',  spr: () => BSPR.beartrap },
    wall:     { role: 'wall',    name: 'Hradby',          spr: o => BSPR.wall[campLvl(o)][o.mask != null ? o.mask : 10], hp: 1.1, dy: 2, lvlArt: true },
    gatehouse:{ role: 'wall',    name: 'Brána',           spr: o => gateSprite(o.mask != null ? o.mask : 10, campLvl(o)), hp: 1.5, dy: 2, lvlArt: true },
    hall:     { role: 'keep',    name: 'Radnica',         spr: o => BSPR.hall[campLvl(o)], size: [3, 3], lvlArt: true },
  },
};
const campSize = pc => pc.size || [1, 1];
// úroveň stavby hradu (1–5, v uložení q.l): ako budovy hráča – viac zdravia a sily; lvlArt = mení aj vzhľad, ostatné majú číslo
const CAMP_MAX_LVL = 5;
const campLvl = o => Math.max(1, Math.min(CAMP_MAX_LVL, (o && o.lvl) || 1)) - 1; // index 0–4 (fixed stavby majú vždy úroveň 1)
const campHpMul = lvl => 1 + 0.35 * ((lvl || 1) - 1);  // zdravie +35 % za úroveň (ako budovy hráča)
const campPowMul = lvl => 1 + 0.4 * ((lvl || 1) - 1);  // sila striel a balvanov +40 % za úroveň
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
// hradby a brány sa spájajú ako v hre: so susednými hradbami, bránami a vežami (na radnicu či pevnosť len z boku);
// (obe rasy majú hradbu wall a bránu gatehouse)
const CAMP_JOIN = { wall: 1, gatehouse: 1, tower: 1, mage: 1, icetower: 1, ballista: 1, hall: 1 };
const CAMP_WALLS = { wall: 1, gatehouse: 1 }; // tieto potrebujú masku spojení
// list = stavby hradu ({k|kind, c, r}); vráti masku spojení 1 hore, 2 vpravo, 4 dole, 8 vľavo
function campWallMask(list, q) {
  const kindOf = o => o.k || o.kind;
  const at = (c, r) => list.find(o => { const pc = CAMP_PIECES.human[kindOf(o)] || CAMP_PIECES.orc[kindOf(o)], [w, h] = pc ? campSize(pc) : [1, 1]; return c >= o.c && c < o.c + w && r >= o.r && r < o.r + h; });
  const j = (c, r, vert) => { const o = at(c, r); return !!o && !!CAMP_JOIN[kindOf(o)] && !(vert && kindOf(o) === 'hall'); };
  return (j(q.c, q.r - 1, true) ? 1 : 0) | (j(q.c + 1, q.r) ? 2 : 0) | (j(q.c, q.r + 1, true) ? 4 : 0) | (j(q.c - 1, q.r) ? 8 : 0);
}
// brána = úsek hradby so strážnicou nad ním (ako v hre), pre každé napojenie raz zložená
const GATE_SPR = {};
function gateSprite(m, l, orc) {
  l = l || 0;
  const key = m + ',' + l + (orc ? 'o' : '');
  if (!GATE_SPR[key]) {
    const S = orc ? OBSPR : BSPR; // brána ľudí alebo orkov
    const c = document.createElement('canvas'); c.width = 16; c.height = 33;
    const x = c.getContext('2d'); x.drawImage(S.wall[l][m].c, 0, 9); x.drawImage(S.gatehouse[l].c, 0, 0);
    GATE_SPR[key] = spriteFromCanvas(c);
  }
  return GATE_SPR[key];
}
