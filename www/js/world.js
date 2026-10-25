'use strict';
// Fortward – svet: domovský ostrov a ďalšie územia, všetko na jednej námorníckej (papierovej) mape sveta.
// Misie majú jedno spoločné poradie: 1–10 domovský ostrov, 11–17 severské ostrovy, 18–43 dlhý ostrov (púšť, potom lesy),
// 44–57 severná krajina, 58–72 popolavý ostrov, 73–76 ostrov roja – postup (st.unlocked), hviezdy aj obtiažnosť pokračujú.

const WORLD_W = 190, WORLD_H = 400, WORLD_SEED = 7;
// obrysy území z náčrtov hráča (prevedené do mapy sveta 190 × 400)
const WSK = (() => {
  const X = 190 / 312, Y = 0.64, f = p => p.map(([x, y]) => [x * X, 26 + y * Y]), s2 = p => p.map(([x, y]) => [x / 1.826, y / 1.826]);
  return {
    home:  f([[24, 274], [52, 274], [60, 300], [79, 303], [79, 336], [64, 342], [60, 380], [48, 390], [18, 390], [12, 360], [8, 320], [9, 292], [22, 286]]),
    isA:   f([[116, 346], [134, 346], [134, 372], [118, 372], [116, 364], [107, 362], [107, 355], [116, 354]]),
    isB:   f([[152, 337], [179, 337], [179, 355], [152, 355]]),
    isC:   f([[143, 364], [170, 364], [170, 373], [179, 373], [179, 391], [143, 391]]),
    grey:  f([[134, 427], [188, 427], [188, 445], [161, 445], [161, 463], [152, 463], [152, 481], [197, 481], [206, 490], [206, 517], [188, 517], [188, 525], [161, 525], [161, 517], [89, 517], [89, 507], [26, 507], [17, 495], [26, 481], [35, 472], [62, 472], [62, 463], [89, 463], [89, 445], [98, 445], [98, 436], [107, 436], [125, 436]]),
    red:   [[268, 413, 11], [281, 425, 11], [262, 431, 9], [284, 439, 10]].map(([x, y, r]) => [x * X, 26 + y * Y, r * Math.sqrt(X * Y)]),
    redRaw: [[268, 413, 11], [281, 425, 11], [262, 431, 9], [284, 439, 10]],
    long:  s2([[20, 230], [70, 226], [130, 236], [180, 252], [215, 265], [250, 282], [285, 298], [305, 322], [292, 348], [240, 346], [180, 333], [125, 322], [90, 305], [55, 294], [28, 280], [18, 255]]),
    north: s2([[172, 145], [200, 132], [240, 128], [285, 140], [292, 165], [275, 180], [245, 185], [215, 195], [185, 190], [168, 170]]),
    northS: [[276 / 1.826, 210 / 1.826, 17 / 1.826]],
  };
})();
// mapa sveta: súš, provincie a krajina každého územia (rampy farieb rás sú v paper.js)
function worldSpec() {
  const homeZones = (x, y, b) => (y - b.y0) / (b.y1 - b.y0) + (fbm(x * 0.05, y * 0.05, 503) - 0.5) * 0.1 > 0.5 ? 0 : 1;
  const longZones = (x, y) => ((x - 11) * 0.937 + (y - 125) * 0.349) / 165 + (fbm(x * 0.04, y * 0.04, 505) - 0.5) * 0.16 < 0.48 ? 0 : 1;
  return { W: WORLD_W, H: WORLD_H, seed: WORLD_SEED, lands: [
    { shape: { poly: WSK.home }, amp: 4, freq: 0.1, zones: [{ n: 5, race: 'human', biome: 'grass' }, { n: 5, race: 'orc', biome: 'grass' }], zoneAt: homeZones, jitter: 3 },
    { shape: { poly: WSK.isA }, amp: 3, freq: 0.18, zones: [{ n: 2, race: 'nordic', biome: 'tundra' }], jitter: 2 },
    { shape: { poly: WSK.isB }, amp: 3, freq: 0.18, zones: [{ n: 2, race: 'nordic', biome: 'tundra' }], jitter: 2 },
    { shape: { poly: WSK.isC }, amp: 3, freq: 0.18, zones: [{ n: 3, race: 'nordic', biome: 'tundra' }], jitter: 2 },
    { shape: { poly: WSK.long }, amp: 4, freq: 0.08, zones: [{ n: 14, race: 'elf', biome: 'forest' }, { n: 12, race: 'desert', biome: 'desert' }], zoneAt: longZones, jitter: 3 },
    { shape: { poly: WSK.north }, amp: 3.5, freq: 0.09, zones: [{ n: 10, race: 'polar', biome: 'ice' }], jitter: 3 },
    { shape: { circles: WSK.northS }, amp: 2.5, freq: 0.16, zones: [{ n: 4, race: 'polar', biome: 'ice' }], jitter: 2 },
    { shape: { poly: WSK.grey }, amp: 5, freq: 0.09, zones: [{ n: 15, race: 'undead', biome: 'ash' }], jitter: 3 },
    { shape: { circles: WSK.red }, amp: 2.5, freq: 0.15, zones: [{ n: 4, race: 'swarm', biome: 'hive' }], jitter: 2 },
  ] };
}

// územia: first/count = misie, wl = súše na mape sveta (indexy vo worldSpec), view = zväčšenie mapy územia (výrez mapy sveta;
// w = šírka mapy, širšia ako obrazovka sa posúva do strán), groups = poradie misií (súše a pásma krajiny, v každom od najnižšieho
// hradu k najbližšiemu ďalšiemu), reward = trvalá odmena za dobytie celého územia
const LANDS = [
  { id: 'home',  name: 'Domovský ostrov', first: 1, count: 10, home: true, wl: [0] },
  { id: 'isles', name: 'Severské ostrovy', first: 11, count: 7, wl: [1, 2, 3], view: { s: 3.3 }, groups: [[[1, 0], [2, 0], [3, 0]]],
    reward: { id: 'gold', txt: '+5 % zlata za vlny a nepriateľov' } },
  { id: 'long',  name: 'Dlhý ostrov', first: 18, count: 26, wl: [4], view: { s: 2.25, w: 380 }, groups: [[[4, 1]], [[4, 0]]], // najprv púšť, potom lesy
    reward: { id: 'walls', txt: 'hradby o 10 % lacnejšie' } },
  { id: 'north', name: 'Severná krajina', first: 44, count: 14, wl: [5, 6], view: { s: 3, w: 260 }, groups: [[[5, 0]], [[6, 0]]],
    reward: { id: 'point', txt: '+1 voľný bod každému hrdinovi' } },
  { id: 'ash',   name: 'Popolavý ostrov', first: 58, count: 15, wl: [7], view: { s: 2.3, w: 300 }, groups: [[[7, 0]]] },
  // ostrov roja má vlastnú (schválenú) mapu: väčšie kopce, než by dal výrez mapy sveta
  { id: 'swarm', name: 'Ostrov roja', first: 73, count: 4, wl: [8], own: { seed: 41, circles: WSK.redRaw.map(([x, y, r]) => [-886 + x * 3.6, -1342 + y * 3.6, r * 3.6]), amp: 6 } },
];
const MAX_MISSION = LANDS[LANDS.length - 1].first + LANDS[LANDS.length - 1].count - 1; // posledná misia sveta
// plavebné trasy (poradie území)
const SEA_ROUTES = [['home', 'isles'], ['isles', 'long'], ['long', 'north'], ['north', 'ash'], ['ash', 'swarm']];

// misie mimo domovského ostrova: theme = krajina bojiska (index do THEMES v scene.js), castle = rozloženie tábora z editora hradov
// (zatiaľ požičané z misií domovského ostrova), giants = obri v poslednej vlne, posledná misia územia = útok na hrad
const WORLD_MISSIONS = (() => {
  const L = [
    { names: ['Tulenia pláž', 'Skalný maják', 'Brezový breh', 'Ľadový brod', 'Havranie hniezdo', 'Mlynský záliv', 'Jarlova sieň'], themes: [0, 4, 2, 3, 6, 1],
      desc: ['Nájazdníci sa vylodili medzi tuleňmi. Zhoď ich späť do mora.', 'Maják na útese varuje lode. Neber ho nepriateľovi z rúk.', 'Na brehu fjordu sa zhromažďujú nájazdníci.', 'Cez plytčinu sa valia ťažké posily.', 'Strážne veže na skalách vidia celé súostrovie.', 'Mlyny živia jarlovo vojsko. Odrež ho od zásob.', 'Rozhodujúci útok na sieň jarla. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Spálené duny', 'Studňa v piesku', 'Karavánna cesta', 'Zlatý kaňon', 'Oáza paliem', 'Slaná pláň', 'Piesočná búrka', 'Hrobky kráľov', 'Skalné mesto', 'Suchý prameň', 'Brána púšte', 'Okraj púšte',
             'Okraj lesa', 'Lesná čistina', 'Dubový háj', 'Machový brod', 'Tichý potok', 'Stará píla', 'Hlboký les', 'Hubárska lúka', 'Medvedí brloh', 'Lesný chrám', 'Korene sveta', 'Strážny strom', 'Elfí most', 'Srdce lesa'],
      themes: [4, 8, 4, 7, 4, 8, 4, 7, 4, 8, 4, 7, 2, 1, 2, 6, 1, 10, 2, 6, 5, 7, 2, 1, 10, 2], split: 12, // 12 misií púšte, potom lesy
      desc: ['Púštni bojovníci strážia studne a karavánne cesty. Bez vody neprežiješ.', 'V lesoch dlhého ostrova sa skrývajú lukostrelci. Postupuj opatrne.', 'Rozhodujúci útok na srdce lesa. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Zamrznutý záliv', 'Snežné pole', 'Ľadové jaskyne', 'Biela pustatina', 'Mrazivý priesmyk', 'Polárna noc', 'Ľadovcová stena', 'Tulenia kolónia', 'Severná žiara', 'Ľadový hrad',
             'Malý ostrov', 'Mrazivý maják', 'Snehová skala', 'Pevnosť na ľade'], themes: [3, 0, 4, 6, 4, 3, 7, 0, 6, 7, 0, 4, 3],
      desc: ['Mráz a sneh sú tu spojencami nepriateľa. Ubráň sa v ľadovej pustatine.', 'Rozhodujúci útok na pevnosť na ľade. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Popolavý breh', 'Mŕtvy les', 'Kostené pole', 'Hmlisté blato', 'Opustená dedina', 'Čierny cintorín', 'Prekliate mohyly', 'Kamenné kríže', 'Tieňová roklina', 'Zrúcaná veža', 'Popolavá pláň', 'Hrobka kniežaťa', 'Kostená brána', 'Údolie tieňov', 'Citadela nemŕtvych'],
      themes: [8, 5, 8, 5, 7, 8, 7, 5, 8, 7, 8, 7, 9, 5],
      desc: ['Z popola a hmly sa dvíhajú nemŕtvi. Nesmú prejsť.', 'Rozhodujúci útok na citadelu nemŕtvych. Postav vojsko zo zlatiek v truhlici.'] },
    { names: ['Breh roja', 'Úľové pole', 'Hniezdisko', 'Srdce roja'], themes: [9, 8, 5],
      desc: ['Roj sa valí z úľov v nekonečných vlnách. Posledný boj sveta.', 'Finále: útok na srdce roja. Postav vojsko zo zlatiek v truhlici.'] },
  ];
  const out = [];
  for (const d of L) d.names.forEach((name, i) => {
    const last = i === d.names.length - 1;
    const desc = d.desc.length === d.names.length ? d.desc[i] : last ? d.desc[d.desc.length - 1] : d.split && i >= d.split ? d.desc[1] : d.desc[0];
    out.push(last ? { name, desc, theme: 9, castle: 10, assault: true }
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
