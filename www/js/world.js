'use strict';
// Fortward – svet: domovský ostrov a ďalšie územia, všetko na jednej námorníckej (papierovej) mape sveta.
// Misie majú jedno spoločné poradie: 1–10 domovský ostrov, 11–15 neutrálne zeme, 16–23 piesočný ostrov, 24–33 pralesný ostrov
// (aj s ostrovčekom), 34–41 severná krajina, 42–51 popolavý ostrov, 52–55 ostrov roja – postup (st.unlocked), hviezdy aj obtiažnosť pokračujú.

const WORLD_W = 190, WORLD_H = 360, WORLD_SEED = 7; // výška mapy sveta (pod popolavým ostrovom a ostrovom roja len pás mora)
// obrysy území z náčrtov hráča (prevedené do mapy sveta 190 × 400)
const WSK = (() => {
  const X = 190 / 312, Y = 0.64, f = p => p.map(([x, y]) => [x * X, 26 + y * Y]), s2 = (p, dy) => p.map(([x, y]) => [x / 1.826, y / 1.826 + (dy || 0)]);
  const mv = (p, dx, dy) => p.map(([x, y]) => [x + dx, y + dy]);
  const UP = -40; // domovský ostrov, tri ostrovy a popolavý ostrov bližšie k dlhému ostrovu (menšie prázdne more)
  return {
    // domovský ostrov sa na mape sveta kreslí z jeho vlastnej mapy (maska v hre); tento obrys je len náhradný
    home:  mv(f([[24, 274], [52, 274], [60, 300], [79, 303], [79, 336], [64, 342], [60, 380], [48, 390], [18, 390], [12, 360], [8, 320], [9, 292], [22, 286]]), 0, UP),
    isA:   mv(f([[116, 346], [134, 346], [134, 372], [118, 372], [116, 364], [107, 362], [107, 355], [116, 354]]), 0, UP),
    isB:   mv(f([[152, 337], [179, 337], [179, 355], [152, 355]]), 0, UP),
    isC:   mv(f([[143, 364], [170, 364], [170, 373], [179, 373], [179, 391], [143, 391]]), 0, UP),
    grey:  mv(f([[134, 427], [188, 427], [188, 445], [161, 445], [161, 463], [152, 463], [152, 481], [197, 481], [206, 490], [206, 517], [188, 517], [188, 525], [161, 525], [161, 517], [89, 517], [89, 507], [26, 507], [17, 495], [26, 481], [35, 472], [62, 472], [62, 463], [89, 463], [89, 445], [98, 445], [98, 436], [107, 436], [125, 436]]), 0, UP),
    red:   [[268, 413, 11], [281, 425, 11], [262, 431, 9], [284, 439, 10]].map(([x, y, r]) => [x * X, 26 + y * Y, r * Math.sqrt(X * Y)]),
    // piesočný ostrov: pôvodný obrys domovského ostrova z náčrtu, presunutý napravo od troch ostrovov
    dune:  mv(f([[24, 274], [52, 274], [60, 300], [79, 303], [79, 336], [64, 342], [60, 380], [48, 390], [18, 390], [12, 360], [8, 320], [9, 292], [22, 286]]), 131, -28),
    redRaw: [[268, 413, 11], [281, 425, 11], [262, 431, 9], [284, 439, 10]],
    // pralesný ostrov podľa náčrtu hráča (súradnice mapy sveta) a malý ostrovček pod ním
    long:  [[16.7, 86.3], [34.1, 83.9], [54, 80.3], [66.5, 83.9], [70.2, 95.8], [86.4, 100.6], [100, 106.1], [116.2, 111.3], [138.6, 120.4], [152.3, 125.7], [149.8, 138.8], [133.6, 142.4],
            [123.7, 149.5], [116.2, 161.5], [106.3, 168.6], [96.3, 167.4], [91.3, 156.7], [90.1, 147.1], [81.4, 142.4], [64, 141.2], [55.3, 135.2], [47.8, 119.7], [34.1, 116.1], [18, 112.5], [14.7, 101.8]],
    longS: [[72.7, 158.6, 6.8]],
    north: s2([[172, 145], [200, 132], [240, 128], [285, 140], [292, 165], [275, 180], [245, 185], [215, 195], [185, 190], [168, 170]], -25),
    northS: [[276 / 1.826, 210 / 1.826 - 25, 17 / 1.826]],
  };
})();
// mapa sveta: súš, provincie a krajina každého územia (rampy farieb rás sú v paper.js)
function worldSpec() {
  const homeZones = (x, y, b) => (y - b.y0) / (b.y1 - b.y0) + (fbm(x * 0.05, y * 0.05, 503) - 0.5) * 0.1 > 0.5 ? 0 : 1;
  return { W: WORLD_W, H: WORLD_H, seed: WORLD_SEED, lands: [
    { shape: { poly: WSK.home }, amp: 4, freq: 0.1, zones: [{ n: 5, race: 'human', biome: 'grass' }, { n: 5, race: 'orc', biome: 'grass' }], zoneAt: homeZones, jitter: 3 },
    { shape: { poly: WSK.isA }, amp: 3, freq: 0.18, zones: [{ n: 1, race: 'nordic', biome: 'tundra' }], jitter: 2 }, // celý ostrov = jedna provincia
    { shape: { poly: WSK.isB }, amp: 3, freq: 0.18, zones: [{ n: 1, race: 'nordic', biome: 'tundra' }], jitter: 2 }, // celý ostrov = jedna provincia
    { shape: { poly: WSK.isC }, amp: 3, freq: 0.18, zones: [{ n: 3, race: 'nordic', biome: 'tundra' }], jitter: 2 },
    { shape: { poly: WSK.long }, amp: 4, freq: 0.08, zones: [{ n: 9, race: 'elf', biome: 'jungle' }], jitter: 3 },
    { shape: { poly: WSK.north }, amp: 3.5, freq: 0.09, zones: [{ n: 6, race: 'polar', biome: 'ice' }], jitter: 3 },
    { shape: { circles: WSK.northS }, amp: 2.5, freq: 0.16, zones: [{ n: 2, race: 'polar', biome: 'ice' }], jitter: 2 },
    { shape: { poly: WSK.grey }, amp: 5, freq: 0.09, zones: [{ n: 10, race: 'undead', biome: 'ash' }], jitter: 3 },
    { shape: { circles: WSK.red }, amp: 2.5, freq: 0.15, zones: [{ n: 4, race: 'swarm', biome: 'hive' }], jitter: 2 },
    { shape: { poly: WSK.dune }, amp: 4, freq: 0.1, zones: [{ n: 8, race: 'desert', biome: 'desert' }], jitter: 3 },
    { shape: { circles: WSK.longS }, amp: 2.5, freq: 0.16, zones: [{ n: 1, race: 'elf', biome: 'jungle' }], jitter: 2 },
  ] };
}

// územia: first/count = misie, wl = súše na mape sveta (indexy vo worldSpec), view = zväčšenie mapy územia (výrez mapy sveta;
// w = šírka mapy, širšia ako obrazovka sa posúva do strán), lblDx = posun názvu na mape sveta, groups = poradie misií (súše a pásma krajiny, v každom od najnižšieho
// hradu k najbližšiemu ďalšiemu), reward = trvalá odmena za dobytie celého územia
const LANDS = [
  { id: 'home',  name: 'Domovský ostrov', first: 1, count: 10, home: true, wl: [0] },
  { id: 'isles', name: 'Neutrálne zeme', first: 11, count: 5, wl: [1, 2, 3], view: { s: 3.3 }, groups: [[[1, 0], [2, 0], [3, 0]]],
    reward: { id: 'gold', txt: '+5 % zlata za vlny a nepriateľov' } },
  { id: 'dune',  name: 'Piesočný ostrov', first: 16, count: 8, wl: [9], view: { s: 3.4 }, groups: [[[9, 0]]] },
  { id: 'long',  name: 'Pralesný ostrov', first: 24, count: 10, wl: [4, 10], view: { s: 2.5, w: 380 }, lblDx: -40, groups: [[[4, 0], [10, 0]]],
    reward: { id: 'walls', txt: 'hradby o 10 % lacnejšie' } },
  { id: 'north', name: 'Severná krajina', first: 34, count: 8, wl: [5, 6], view: { s: 4, w: 300 }, groups: [[[5, 0]], [[6, 0]]],
    reward: { id: 'point', txt: '+1 voľný bod každému hrdinovi' } },
  { id: 'ash',   name: 'Popolavý ostrov', first: 42, count: 10, wl: [7], view: { s: 3, w: 380 }, groups: [[[7, 0]]] },
  // ostrov roja má vlastnú (schválenú) mapu: väčšie kopce, než by dal výrez mapy sveta
  { id: 'swarm', name: 'Ostrov roja', first: 52, count: 4, wl: [8], own: { seed: 41, circles: WSK.redRaw.map(([x, y, r]) => [-886 + x * 3.6, -1342 + y * 3.6, r * 3.6]), amp: 6 } },
];
const MAX_MISSION = LANDS[LANDS.length - 1].first + LANDS[LANDS.length - 1].count - 1; // posledná misia sveta
// plavebné trasy (poradie území)
const SEA_ROUTES = [['home', 'isles'], ['isles', 'dune'], ['dune', 'long'], ['long', 'north'], ['north', 'ash'], ['ash', 'swarm']];

// misie mimo domovského ostrova: theme = krajina bojiska (index do THEMES v scene.js), castle = rozloženie tábora z editora hradov
// (zatiaľ požičané z misií domovského ostrova), giants = obri v poslednej vlne, posledná misia územia = útok na hrad
const WORLD_MISSIONS = (() => {
  const L = [
    { names: ['Tulenia pláž', 'Skalný maják', 'Brezový breh', 'Havranie hniezdo', 'Jarlova sieň'], themes: [0, 4, 2, 6], last: 9,
      desc: ['Nájazdníci sa vylodili medzi tuleňmi. Zhoď ich späť do mora.', 'Maják na útese varuje lode. Neber ho nepriateľovi z rúk.', 'Na brehu sa zhromažďujú nájazdníci. Rozpráš ich skôr, než ich príde viac.', 'Strážne veže na skalách vidia celé súostrovie. Musia padnúť.', 'Rozhodujúci útok na sieň jarla. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Horúci breh', 'Zlatý piesok', 'Studňa nomádov', 'Kamenná oáza', 'Šakalí kaňon', 'Soľné jazero', 'Sultánova cesta', 'Palác v piesku'],
      themes: [12, 12, 4, 12, 7, 12, 12], last: 12,
      desc: ['Piesočný ostrov strážia púštni bojovníci. Ubráň sa v horúcich dunách.', 'Rozhodujúci útok na palác v piesku. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Okraj pralesa', 'Lianový most', 'Opičí brod', 'Tichý potok', 'Hmlistá čistina', 'Stará svätyňa', 'Vodopád', 'Zarastený chrám', 'Hniezdo dravcov', 'Kráľovský strom'],
      themes: [13, 13, 13, 1, 5, 7, 1, 7, 13], last: 13,
      desc: ['V pralese sa skrývajú elfskí lukostrelci a za každým kmeňom môže čakať záloha. Postupuj opatrne.', 'Rozhodujúci útok na kráľovský strom. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Zamrznutý záliv', 'Snežné pole', 'Ľadové jaskyne', 'Mrazivý priesmyk', 'Polárna noc', 'Ľadový hrad', 'Mrazivý maják', 'Pevnosť na ľade'], themes: [11, 11, 3, 11, 0, 11, 11], last: 11,
      desc: ['Mráz a sneh sú tu spojencami nepriateľa. Ubráň sa v ľadovej pustatine.', 'Rozhodujúci útok na pevnosť na ľade. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Popolavý breh', 'Mŕtvy les', 'Kostené pole', 'Hmlisté blato', 'Čierny cintorín', 'Prekliate mohyly', 'Tieňová roklina', 'Hrobka kniežaťa', 'Kostená brána', 'Citadela nemŕtvych'],
      themes: [14, 8, 14, 5, 14, 7, 14, 8, 14], last: 14,
      desc: ['Z popola a hmly sa dvíhajú nemŕtvi. Nesmú prejsť.', 'Rozhodujúci útok na citadelu nemŕtvych. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Breh roja', 'Úľové pole', 'Hniezdisko', 'Srdce roja'], themes: [15, 15, 15], last: 15,
      desc: ['Roj sa valí z úľov v nekonečných vlnách. Posledný boj sveta.', 'Finále: útok na srdce roja. Postav vojsko zo zlatiek v truhlici.'] },
  ];
  const out = [];
  for (const d of L) d.names.forEach((name, i) => {
    const last = i === d.names.length - 1;
    const desc = d.desc.length === d.names.length ? d.desc[i] : last ? d.desc[d.desc.length - 1] : d.split && i >= d.split ? d.desc[1] : d.desc[0];
    out.push(last ? { name, desc, theme: d.last, castle: 10, assault: true }
      : Object.assign({ name, desc, theme: d.themes[i % d.themes.length], castle: 6 + (i % 4), waves: 6 }, i % 3 === 2 ? { giants: { 6: [i % 2 ? 'mammoth' : 'giantRam'] } } : {}));
  });
  return out;
})();

// domovský ostrov: posledná misia je útok na hrad
MISSIONS[MISSIONS.length - 1].assault = true;
ORC_MISSIONS[ORC_MISSIONS.length - 1].assault = true;

const landById = id => LANDS.find(l => l.id === id);
const landOfMission = m => LANDS.find(l => m >= l.first && m < l.first + l.count) || LANDS[LANDS.length - 1];
const landLast = l => l.first + l.count - 1;
