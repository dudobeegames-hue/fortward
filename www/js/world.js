'use strict';
// Fortward – svet: územia (domovský ostrov, severské ostrovčeky, zatiaľ zahmlené ďalšie krajiny) a misie mimo domovského ostrova.
// Misie majú jedno spoločné poradie: 1–10 domovský ostrov, 11–19 severské súostrovie (ostrovčeky sa hrajú po poradí),
// takže postup (st.unlocked), hviezdy aj obtiažnosť pokračujú bez zmeny uložených hier.

// misie ostrovčekov: theme = krajina bojiska (index do THEMES v scene.js), castle = rozloženie tábora z editora hradov
// (zatiaľ požičané z misií domovského ostrova), giants = obri v danej vlne, assault = útok na hrad (truhlica zo zlatiek)
const WORLD_MISSIONS = [
  // Tulenia skala (11–12)
  { name: 'Tulenia pláž',    desc: 'Nájazdníci sa vylodili medzi tuleňmi. Zhoď ich späť do mora.', theme: 0, castle: 6, waves: 6 },
  { name: 'Skalný maják',    desc: 'Maják na útese varuje lode. Neber ho nepriateľovi z rúk.', theme: 4, castle: 7, waves: 6, giants: { 6: ['giantRam'] } },
  // Havraní fjord (13–15)
  { name: 'Brezový breh',    desc: 'Na brehu fjordu sa zhromažďujú nájazdníci. Rozpráš ich skôr, než ich príde viac.', theme: 2, castle: 6, waves: 6 },
  { name: 'Ľadový brod',     desc: 'Cez plytčinu fjordu sa valia ťažké posily.', theme: 3, castle: 8, waves: 6, giants: { 6: ['mammoth'] } },
  { name: 'Havranie hniezdo', desc: 'Strážne veže na skalách vidia celý fjord. Musia padnúť.', theme: 6, castle: 9, waves: 6, giants: { 6: ['mammoth'] } },
  // Ostrov jarla (16–19)
  { name: 'Mlynský záliv',   desc: 'Mlyny živia jarlovo vojsko. Odrež ho od zásob.', theme: 1, castle: 7, waves: 6, giants: { 6: ['giantRam'] } },
  { name: 'Mohylové pole',   desc: 'Medzi mohylami predkov čakajú jarlove elitné oddiely.', theme: 7, castle: 8, waves: 6, giants: { 6: ['giantRam'] } },
  { name: 'Kamenný val',     desc: 'Posledný val pred jarlovou sieňou. Prelom ho.', theme: 4, castle: 9, waves: 6, giants: { 6: ['giantRam', 'mammoth'] } },
  { name: 'Jarlova sieň',    desc: 'Rozhodujúci útok na sieň jarla. Postav vojsko zo zlatiek v truhlici.', theme: 9, castle: 10, assault: true },
];
const MAX_MISSION = 10 + WORLD_MISSIONS.length; // posledná misia sveta (zatiaľ)

// územia sveta: first/count = misie, map = mapa územia (výška, semienko, rozloženie hradov zdola nahor, šírka ostrova),
// world = stred súše a mierka na mape sveta (súradnice mapy sveta 190 × 400), reward = trvalá odmena za dobytie celého územia
const LANDS = [
  { id: 'home',  name: 'Domovský ostrov', first: 1, count: 10, home: true,
    world: { cx: 42, cy: 298, s: 0.22 } },
  { id: 'seal',  name: 'Tulenia skala', first: 11, count: 2,
    map: { h: 250, seed: 41, rx: 0.36, bot: 60, nodes: [[0.32, 0.92], [0.64, 0.1]] },
    world: { cx: 36, cy: 226, s: 0.22 }, reward: { id: 'gold', txt: '+5 % zlata za vlny a nepriateľov' } },
  { id: 'raven', name: 'Havraní fjord', first: 13, count: 3,
    map: { h: 300, seed: 57, rx: 0.42, bot: 60, nodes: [[0.7, 0.94], [0.26, 0.52], [0.62, 0.08]] },
    world: { cx: 80, cy: 172, s: 0.22 }, reward: { id: 'walls', txt: 'hradby o 10 % lacnejšie' } },
  { id: 'jarl',  name: 'Ostrov jarla', first: 16, count: 4,
    map: { h: 350, seed: 73, rx: 0.45, bot: 60, nodes: [[0.24, 0.95], [0.72, 0.66], [0.3, 0.37], [0.64, 0.06]] },
    world: { cx: 40, cy: 110, s: 0.22 }, reward: { id: 'point', txt: '+1 voľný bod každému hrdinovi' } },
];
// krajiny, ktoré prídu neskôr: na mape sveta sú len zahmlené obrysy (počet regiónov sa ráta do „Dobyté X % sveta“)
const FUTURE_LANDS = [
  { id: 'continent', name: 'Kontinent',      regions: 28, cx: 148, cy: 200, w: 66, h: 196, seed: 91 },
  { id: 'polar',     name: 'Ľadová krajina', regions: 6,  cx: 126, cy: 56,  w: 104, h: 24, seed: 93 },
  { id: 'swarm',     name: 'Ostrov roja',    regions: 6,  cx: 156, cy: 330, w: 40, h: 32, seed: 95 },
];
const WORLD_REGIONS = LANDS.reduce((a, l) => a + l.count, 0) + FUTURE_LANDS.reduce((a, l) => a + l.regions, 0);
// plavebné trasy: poradie území, kadiaľ sa plaví loď (posledná trasa vedie k zahmlenému kontinentu)
const SEA_ROUTES = [['home', 'seal'], ['seal', 'raven'], ['raven', 'jarl'], ['jarl', 'continent']];

// domovský ostrov: posledná misia je útok na hrad
MISSIONS[MISSIONS.length - 1].assault = true;
ORC_MISSIONS[ORC_MISSIONS.length - 1].assault = true;

const landById = id => LANDS.find(l => l.id === id);
const landOfMission = m => LANDS.find(l => m >= l.first && m < l.first + l.count) || LANDS[LANDS.length - 1];
const landLast = l => l.first + l.count - 1;
