'use strict';
// Fortward – stavby táborov a hradov protivníka (spoločné pre hru aj editor hradov www/dev/castle-editor.html).
// ---- tábor hordy (od misie 6): stavby nepriateľskej rasy na hornom okraji bojiska, mimo dostrelu veží ----
// Každá stavba má všeobecnú úlohu (ostreľovač, veža, liečiteľ, posilňovač, posily); meno a vzhľad jej dodá rasa
// protivníka (CAMP_PIECES). Keď bude hráč hrať za inú rasu, tábor sa poskladá z budov rasy, proti ktorej hrá.
const CAMP_ROLES = {
  bombard: { hp: 260, gold: 40, what: 'z diaľky ostreľuje tvoje budovy' },
  tower:   { hp: 300, gold: 30, what: 'strieľa na tvoje jednotky v okolí' },
  totem:   { hp: 200, gold: 35, what: 'kým stojí, horda sa pomaly lieči' },
  drum:    { hp: 180, gold: 30, what: 'kým stojí, horda je rýchlejšia' },
  tent:    { hp: 240, gold: 35, what: 'počas vlny vysiela posily' },
  wall:    { hp: 220, gold: 8,  what: 'kryje tábor – vojaci ho musia najprv prelomiť' },
  keep:    { hp: 900, gold: 80, what: 'srdce tábora – keď padne, zrúti sa celý tábor' },
};
// stavby hradov podľa rasy protivníka: druh → úloha, meno a obrázok. Hrady sa skladajú v editore hradov
// (www/dev/castle-editor.html) a ukladajú do js/castles.js. Ľudské stavby ožijú, keď sa bude dať hrať za orkov.
const CAMP_PIECES = {
  orc: {
    catapult: { role: 'bombard', name: 'Orkský katapult', spr: o => BSPR.orcCatapult[o.fired > 0 ? 1 : 0] },
    tower:    { role: 'tower',   name: 'Orkská veža',     spr: () => BSPR.orcTower },
    totem:    { role: 'totem',   name: 'Šamanský totem',  spr: (o, t) => BSPR.orcTotem[Math.floor(t * 3) % 2] },
    drum:     { role: 'drum',    name: 'Vojnový bubon',   spr: (o, t) => BSPR.orcDrum[Math.floor(t * 4) % 2] },
    tent:     { role: 'tent',    name: 'Stan posíl',      spr: () => BSPR.orcTent },
    palisade: { role: 'wall',    name: 'Palisáda',        spr: () => BSPR.palisade },
    gate:     { role: 'wall',    name: 'Brána palisády',  spr: () => BSPR.palisadeGate },
    stonewall:{ role: 'wall',    name: 'Kamenný múr',     spr: () => BSPR.orcWall, hp: 1.7 },
    stonegate:{ role: 'wall',    name: 'Kamenná brána',   spr: () => BSPR.orcWallGate, hp: 1.7 },
    stakes:   { role: 'wall',    name: 'Koly',            spr: () => BSPR.stakes, hp: 0.4 },
    keep:     { role: 'keep',    name: 'Orkská pevnosť',  spr: () => BSPR.orcKeep },
  },
  human: {
    tower:    { role: 'tower',   name: 'Strážna veža',    spr: () => BSPR.tower[0] },
    mage:     { role: 'tower',   name: 'Veža mága',       spr: () => BSPR.mage[0] },
    icetower: { role: 'tower',   name: 'Ľadová veža',     spr: () => BSPR.icetower[0] },
    ballista: { role: 'bombard', name: 'Balista',         spr: () => BSPR.ballista[0] },
    barracks: { role: 'tent',    name: 'Kasárne',         spr: () => BSPR.barracks },
    range:    { role: 'tent',    name: 'Strelnica',       spr: () => BSPR.range },
    stables:  { role: 'tent',    name: 'Stajne',          spr: () => BSPR.stables },
    armory:   { role: 'tent',    name: 'Zbrojnica',       spr: () => BSPR.armory },
    chapel:   { role: 'totem',   name: 'Kaplnka',         spr: () => BSPR.chapel },
    gatehouse:{ role: 'wall',    name: 'Brána',           spr: () => BSPR.gatehouse[0], hp: 1.5 },
    hall:     { role: 'keep',    name: 'Radnica',         spr: () => BSPR.hall[0] },
  },
};
