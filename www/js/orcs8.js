'use strict';
// Fortward – horda orkov v 8 smeroch (rovnaký kresliaci nástroj ako jednotky hráča, buildUnit8 v sprites.js).
// Kreslia sa pohľady spredu (S), zboku (E) a zozadu (N); šikmé pohľady (SE, NE) vzniknú posunom hlavy o bod
// doprava (hlava sa natočí, trup ostane) a západné smery sú zrkadlové.

// šikmý pohľad: hlava (prvých n riadkov) posunutá o bod doprava
const turnHead = (rows, n) => rows.map((r, i) => i < n ? '.' + r.slice(0, -1) : r);
const views5 = (S, E, N, n) => ({ S, SE: turnHead(S, n), E, NE: turnHead(N, n), N });
// nohy pešiaka rytiera prefarbené (m = svetlá, D/M = tmavá strana, l/L = chodidlá); shift = posun doprava pre širšie telo
const legsAs = (L, m, d, foot, shift) => {
  const re = r => ('.'.repeat(shift || 0) + r).slice(0, r.length + (shift || 0) * 2).padEnd(r.length + (shift || 0) * 2, '.')
    .replace(/m/g, m).replace(/[MD]/g, d).replace(/[lL]/g, foot);
  return { idle: L.idle.map(re), walk: L.walk.map(f => f.map(re)) };
};
const orcLegs = (m, d, foot, shift) => ({ front: legsAs(KN8_LEGS.front, m, d, foot, shift), side: legsAs(KN8_LEGS.side, m, d, foot, shift) });

// ---- goblin: veľké uši, červené oči, kožená vesta a bedrový pás, krátka dýka ----
const GB8 = views5([
  '.....oooO.....',
  '...qoooooOq...',
  '....orooroO...',
  '....oeOOeoO...',
  '...oLLlLLdq...',
  '..o.LlLLLd.q..',
  '....LdLLdL....',
], [
  '.....ooO......',
  '...qoooooO....',
  '.....oooroO...',
  '.....ooeoOO...',
  '....LLlLd.....',
  '....LloLd.....',
  '....LdLLd.....',
], [
  '.....oooO.....',
  '...qoooooOq...',
  '....ooooooO...',
  '....OooooOO...',
  '...oLLLLLdq...',
  '..o.LLLLLd.q..',
  '....LdLLdL....',
], 4);
// ruka so zbraňou (súradnice v tele), uhly v postoji a pri údere ako rytier
const GB8_HAND = {
  N:  { x: 11, y: 5, idle: -1.15, atk: [-0.2, -1.5, -2.25], legs: 'front' },
  NE: { x: 11, y: 5, idle: -1.0,  atk: [-1.95, -0.75, 0.05], legs: 'front' },
  E:  { x: 6,  y: 5, idle: -0.6,  atk: [-2.2, -0.4, 0.5],    legs: 'side' },
  SE: { x: 2,  y: 5, idle: -2.2,  atk: [-2.55, 3.1, 2.4],    legs: 'front' },
  S:  { x: 2,  y: 5, idle: -2.05, atk: [-2.45, 3.0, 2.3],    legs: 'front' },
};
// ---- goblin-lukostrelec: červená kapucňa, luk ----
const GA8 = views5([
  '.....RrrR.....',
  '....RrrrRR....',
  '...qRorroRq...',
  '....RoeeoR....',
  '...oLLlLLdq...',
  '..o.LlLLLd.q..',
  '....LdLLdL....',
], [
  '.....RrrR.....',
  '....RrrrrR....',
  '....RRooroO...',
  '.....RooeOO...',
  '....LLlLd.....',
  '....LloLd.....',
  '....LdLLd.....',
], [
  '.....RrrR.....',
  '....RrrrrR....',
  '....RrrrrRR...',
  '....RRrrRRR...',
  '...oLLLLLdq...',
  '..o.LLLLLd.q..',
  '....LdLLdL....',
], 4);
const GA8_BOW = {
  S:  { low: { x: 12, y: 5 }, lowBend: 0, lowFront: true, aim: { x: 10, y: 3 }, pull: { x: 8, y: 3 }, tip: { x: 10, y: 5 }, bend: 0, front: true },
  SE: { low: { x: 12, y: 5 }, lowBend: 1, lowFront: true, aim: { x: 12, y: 3 }, pull: { x: 9, y: 3 }, tip: { x: 15, y: 4 }, bend: 1, front: true },
  E:  { low: { x: 10, y: 5 }, lowBend: 1, lowFront: true, aim: { x: 11, y: 2 }, pull: { x: 7, y: 2 }, tip: { x: 14, y: 2 }, bend: 1, front: true },
  NE: { low: { x: 1, y: 5 },  lowBend: 0, lowFront: true, aim: { x: 10, y: 0 }, pull: { x: 8, y: 2 }, tip: { x: 12, y: -1 }, bend: 1, front: false },
  N:  { low: { x: 1, y: 5 },  lowBend: 0, lowFront: true, aim: { x: 5, y: -1 }, pull: { x: 10, y: 2 }, bend: 0, front: false },
};
// ---- podkopník: goblin s čiernou bombou v náručí a horiacim knôtom ----
const SA8 = views5([
  '.....oooO.....',
  '...qoooooOq...',
  '....orooroO...',
  '....oeOOeoOy..',
  '...oLmDDDdq...',
  '....oDDDDo....',
  '....LDDDDL....',
], [
  '.....ooO......',
  '...qoooooO....',
  '.....oooroO...',
  '.....ooeoOOy..',
  '....LLlLdmDD..',
  '....LloooDDD..',
  '....LdLLd.....',
], [
  '.....oooO.....',
  '...qoooooOq...',
  '....ooooooO...',
  '....OooooOOy..',
  '...oLLLLLdq...',
  '....LLLLLd....',
  '....LdLLdL....',
], 4);
// ---- ork: tmavé obočie, kly, kovové náplecníky, kožená zbroj, sekera ----
const OR8 = views5([
  '....oooooo....',
  '...ooOOOOOq...',
  '...oqrOOrqq...',
  '...oooOOOOq...',
  '...owOOOOwq...',
  '.mMmoOOOqmMD..',
  '.oMMLLLLLMMq..',
  '.o.LLgLLLL.q..',
  '...LLlLLdL....',
], [
  '.....ooooo....',
  '....oOOOOOo...',
  '....oOOOrqO...',
  '....ooOOOOqo..',
  '.....oOOOwq...',
  '....mMMmqO....',
  '....MMoLLL....',
  '....LLogLL....',
  '....LLlLdL....',
], [
  '....oooooo....',
  '...ooooooOq...',
  '...oooooOOq...',
  '...ooooOOOq...',
  '....oOOOOq....',
  '.mMmLLLLLmMD..',
  '.oMMLLLLLMMq..',
  '.o.LLLLLLL.q..',
  '...LLlLLdL....',
], 5);
const OR8_HAND = {
  N:  { x: 11, y: 7, idle: -1.15, atk: [-0.2, -1.5, -2.25], legs: 'front' },
  NE: { x: 11, y: 7, idle: -1.0,  atk: [-1.95, -0.75, 0.05], legs: 'front' },
  E:  { x: 6,  y: 7, idle: -1.9,  atk: [-2.4, -0.4, 0.5],    legs: 'side' },
  SE: { x: 1,  y: 7, idle: -2.2,  atk: [-2.55, 3.1, 2.4],    legs: 'front' },
  S:  { x: 1,  y: 7, idle: -2.05, atk: [-2.45, 3.0, 2.3],    legs: 'front' },
};
// ---- surovec: prilba s rohmi, mohutné náplecníky, obrovská sekera (16 bodov široký) ----
const BR8 = views5([
  'eE...mwmmM...Ee.',
  '.EEemmmmMMDeEE..',
  '...DDDDDDDDD....',
  '....oqrOOrqq....',
  '....oOOOOOOq....',
  '....owOOOOwq....',
  '.mMMmqOOOOqmMMD.',
  'oMMMDLLLLLLDMMDq',
  'oo.mMMLLLLMMD.qq',
  'o..LLgLLLLLL..q.',
  '...LLLlLLLdL....',
], [
  '......mwmM.Ee...',
  '....EeemmmMMeE..',
  '.....DDDDDDD....',
  '.....oOOOrqOO...',
  '.....ooOOOOqOo..',
  '......oOOOwq....',
  '....mMMMmqO.....',
  '....MMMoLLLL....',
  '....mMooLLLL....',
  '.....LLogLLL....',
  '.....LLlLLdL....',
], [
  'eE...mwmmM...Ee.',
  '.EEemmmmMMDeEE..',
  '...DDDDDDDDD....',
  '....oooooooq....',
  '....ooooooOq....',
  '.....oOOOOq.....',
  '.mMMmLLLLLLmMMD.',
  'oMMMDLLLLLLDMMDq',
  'oo.mMMLLLLMMD.qq',
  'o..LLLLLLLLL..q.',
  '...LLLlLLLdL....',
], 6);
const BR8_HAND = {
  N:  { x: 14, y: 9, idle: -1.2,  atk: [-0.2, -1.5, -2.25], legs: 'front' },
  NE: { x: 14, y: 9, idle: -1.0,  atk: [-1.95, -0.75, 0.05], legs: 'front' },
  E:  { x: 7,  y: 9, idle: -1.9,  atk: [-2.4, -0.4, 0.5],    legs: 'side' },
  SE: { x: 0,  y: 9, idle: -2.1,  atk: [-2.55, 3.1, 2.4],    legs: 'front' },
  S:  { x: 0,  y: 9, idle: -2.0,  atk: [-2.45, 3.0, 2.3],    legs: 'front' },
};
// ---- šaman: lebková čelenka, fialové rúcho s amuletom, palica so zelenou guľou ----
const SH8 = views5([
  '...e.eEe.e....',
  '....eeEEeE....',
  '....oqrOrq....',
  '....oOOOOq....',
  '....owOOwq....',
  '..PPpPPPPPPP..',
  '..pPpPPgPPPP..',
  '..o.pPPPPP.q..',
  '...pPPPPPPP...',
], [
  '....e.eEe.....',
  '....eeeEEE....',
  '.....ooOrq....',
  '.....oOOOOo...',
  '.....oOOwq....',
  '....PPpPPP....',
  '....PPoPPP....',
  '....pPoPPP....',
  '....pPPPPP....',
], [
  '...e.eEe.e....',
  '....eeEEeE....',
  '....eEEEEE....',
  '....oOOOOq....',
  '.....oOOq.....',
  '..PPpPPPPPPP..',
  '..pPpPPPPPPP..',
  '..o.pPPPPP.q..',
  '...pPPPPPPP...',
], 5);
const SH8_HAND = {
  N:  { x: 11, y: 7, idle: -1.5,  ax: 9, ay: 5, aim: -1.3, k: 0.75, legs: 'front' },
  NE: { x: 11, y: 7, idle: -1.45, ax: 9, ay: 5, aim: -0.7, k: 0.75, legs: 'front' },
  E:  { x: 6,  y: 7, idle: -1.4,  ax: 7, ay: 5, aim: 0.08, k: 1,    legs: 'side' },
  SE: { x: 2,  y: 7, idle: -1.7,  ax: 7, ay: 5, aim: 0.75, k: 0.75, legs: 'front' },
  S:  { x: 2,  y: 7, idle: -1.65, ax: 6, ay: 5, aim: 1.25, k: 0.75, legs: 'front' },
};
const GOB_LEGS = orcLegs('o', 'q', 'd');

// ---- vlčí jazdec: goblin na šedom vlkovi (m svetlá srsť, M stredná, D tmavá, K nos a pazúry) ----
const WOLF8 = {
  S: { x: 0, seat: 2, legs: 'front', body: [
    '...DmmmmmmD...',
    '..DmmmmmmmmD..',
    '..DmmmmmmmMD..',
    '..DMMMMMMMMD..',
  ], head: { x: 5, y: 0, front: true, rows: ['m..m', 'mmmM', 'KmmK', 'mwwM', '.KK.'] } },
  SE: { x: 0, seat: 2, legs: 'diag', body: [
    '.DmmmmmD......',
    'DmmmmmmmmD....',
    'DmmmmmmmmmD...',
    'DMMMMMMMMMD...',
  ], head: { x: 8, y: -1, front: true, rows: ['m..m', 'mmmM', 'mKmK', 'mmwM', '.mK.'] } },
  E: { x: 0, seat: 3, legs: 'side', body: [ // z boku: špicaté uši, ňufák vpravo, huňatý chvost vľavo
    '............m.m.',
    '...........mmmM.',
    'D...MmmmmmmmmKmm',
    '.DDmmmmmmmmmMMD.',
    '...MmmmmmmmmMD..',
    '...DMMMMMMMMMD..',
  ] },
  NE: { x: 0, seat: 2, legs: 'diag', body: [
    '.....DmmmD....',
    '...DmmmmmmD...',
    '..DmmmmmmmD...',
    '..DMMMMMMMD...',
  ], head: { x: 10, y: -3, front: false, rows: ['m.m.', 'mmM.', 'mmMD', '.mD.'] } },
  N: { x: 0, seat: 2, legs: 'back', body: [
    '...DmmmmmmD...',
    '..DmmmmmmmmD..',
    '..DmmmmmmmMD..',
    '..DMMMmmMMMD..',
  ] },
};
// nohy vlka = nohy koňa prefarbené (bližšie m, vzdialenejšie D) a pri bočnom pohľade skrátené na šírku vlka
const wolfLeg = r => r.replace(/l/g, 'm').replace(/d/g, 'M').replace(/L/g, 'D');
const WOLF8_LEGS = {};
for (const k in RD8_LEGS) WOLF8_LEGS[k] = {
  idle: RD8_LEGS[k].idle.map(r => wolfLeg(k === 'side' ? r.slice(0, 16) : r)),
  walk: RD8_LEGS[k].walk.map(f => f.map(r => wolfLeg(k === 'side' ? r.slice(0, 16) : r))),
};
// goblin v sedle: hlava a ramená, pod nimi nohy po bokoch vlka
const WR8_BODY = {};
for (const v of ['S', 'SE', 'E', 'NE', 'N']) WR8_BODY[v] = GB8[v].slice(0, 5).concat(v === 'E' ? ['......o.......'] : ['...o......q...']);
const WR8_HAND = {};
for (const v in GB8_HAND) WR8_HAND[v] = Object.assign({}, GB8_HAND[v], { y: 4 });

// ---- medvedí jazdec: ork na hnedom medveďovi (l svetlá srsť, L tmavšia, d najtmavšia, e svetlá papuľa) ----
const BEAR8 = {
  S: { x: 0, seat: 2, legs: 'front', body: [
    '..dLllllllLd..',
    '.dLllllllllLd.',
    '.dLllllllllLd.',
    '.dLLllllllLLd.',
    '..dLLLLLLLLd..',
  ], head: { x: 4, y: 0, front: true, rows: ['l....l', 'llllLL', 'lKllKL', '.leeL.', '..KK..'] } },
  SE: { x: 0, seat: 2, legs: 'diag', body: [
    '.dLllllllLd...',
    'dLllllllllLd..',
    'dLllllllllLd..',
    'dLLlllllllLLd.',
    '.dLLLLLLLLLd..',
  ], head: { x: 7, y: 0, front: true, rows: ['l....l', 'llllLL', 'llKlKL', '..leeL', '...KK.'] } },
  E: { x: -1, seat: 4, legs: 'side', body: [ // z boku: okrúhle uši, hrb nad plecami, papuľa vpravo
    '............l.l...',
    '...........llllL..',
    '..dLlllllllllllKlL',
    '.dLlllllllllllllLe',
    '.dLlllllllllllLLd.',
    '.dLLllllllllllLLd.',
    '..dLLLLLLLLLLLLd..',
  ] },
  NE: { x: 0, seat: 2, legs: 'diag', body: [
    '...dLllllLd...',
    '.dLllllllllLd.',
    '.dLllllllllLd.',
    '.dLllllllllLd.',
    '..dLLLLLLLLd..',
  ], head: { x: 9, y: -3, front: false, rows: ['l.l.', 'llL.', 'lllL', '.lL.'] } },
  N: { x: 0, seat: 2, legs: 'back', body: [
    '..dLllllllLd..',
    '.dLllllllllLd.',
    '.dLllllllllLd.',
    '.dLllllllllLd.',
    '..dLLLLLLLLd..',
  ] },
};
const BEAR8_LEGS = {};
for (const k in RD8_LEGS) BEAR8_LEGS[k] = {
  idle: RD8_LEGS[k].idle.map(r => k === 'side' ? r.slice(0, 18) : r),
  walk: RD8_LEGS[k].walk.map(f => f.map(r => k === 'side' ? r.slice(0, 18) : r)),
};
// ork v sedle: hlava, náplecníky a ruky, pod nimi nohy po bokoch medveďa
const BR8R_BODY = {};
for (const v of ['S', 'SE', 'E', 'NE', 'N']) BR8R_BODY[v] = OR8[v].slice(0, 7).concat(v === 'E' ? ['......qd......', '......dd......'] : ['.qd........qd.', '.dd........dd.']);
const BR8R_HAND = {};
for (const v in OR8_HAND) BR8R_HAND[v] = Object.assign({}, OR8_HAND[v], { y: 6 });

// ---- medvedí vojvoda (hrdina za orkov): tmavá kapucňa z medvedej kože s ušami, zlatá čelenka, kostené ostne na náplecníkoch,
// červená pelerína; medveď má červenú pokrývku so zlatým lemom a železným chráničom na hlave ----
const BL8_BODY = views5([
  '...Ld.LL.dL...',
  '...LLLlLLLd...',
  '...gggggggG...',
  '...oqrOOrqd...',
  '...ooOOOOqd...',
  '..LowOOOOwqd..',
  '.eMMmRrrRmMMe.',
  '.qd........qd.',
  '.dd........dd.',
], [
  '....Ld..Ld....',
  '....LLLlLLd...',
  '....GggggggG..',
  '....dLOOrqO...',
  '....dLOOOOqo..',
  '....dd.oOwq...',
  '...emMMmqO....',
  '......qd......',
  '......dd......',
], [
  '...Ld.LL.dL...',
  '...LLLlLLLd...',
  '...gggggggG...',
  '...LLLlLLLd...',
  '...LLlLLLdd...',
  '..LrRRRRRrRd..',
  '.eMMRrrrRRMMe.',
  '.qd........qd.',
  '.dd........dd.',
], 5);
// pokrývka: dva riadky trupu medveďa prefarbené na červené súkno, v spodnom zlatý lem (pri bočnom pohľade len po plece)
const bearCloth = (rows, r0, x1) => rows.map((r, j) => j < r0 || j > r0 + 1 ? r : r.replace(/[lL]/g, (c, x) => x > x1 ? c
  : j === r0 + 1 && x % 3 === 0 ? 'g' : c === 'l' ? 'r' : 'R'));
const BEARLORD8 = {};
for (const v in BEAR8) {
  const b = BEAR8[v], side = v === 'E';
  BEARLORD8[v] = Object.assign({}, b, { body: bearCloth(b.body, side ? 4 : 3, side ? 12 : 99) });
}
BEARLORD8.E.body = BEARLORD8.E.body.map((r, j) => j === 2 ? r.slice(0, 14) + 'mKmL' : r); // železný chránič okolo oka
BEARLORD8.S.head = Object.assign({}, BEAR8.S.head, { rows: ['l....l', 'llmmLL', 'lKmmKL', '.leeL.', '..KK..'] });
BEARLORD8.SE.head = Object.assign({}, BEAR8.SE.head, { rows: ['l....l', 'lllmmL', 'llKmKL', '..leeL', '...KK.'] });

// ---- veľký orkský veľkráľ: maľovaný tieňovaným štetcom (painter z buildings.js) v pohľadoch spredu, zboku a zozadu;
// telo 26×30 ako pôvodný boss, obojručná sekera sa dokresľuje pod uhlom (postoj, napriahnutie, švih, dokončenie) ----
const OKB_W = 48, OKB_H = 42, OKB_OX = 11, OKB_OY = OKB_H - U8_PB - 30; // telo v plátne: chodidlá na riadku H - PB - 1
const OKB_HAND = { // ruka so sekerou (v súradniciach tela 26×30) a uhly sekery
  S: { x: 18, y: 19, idle: -1.25, atk: [-0.6, 0.15, 0.85] },
  E: { x: 14, y: 19, idle: -1.95, atk: [-2.4, -0.4, 0.5] },
  N: { x: 18, y: 19, idle: -1.2,  atk: [-0.2, -1.5, -2.25] },
};
function paintOrcKing(view, legs, bob, ang, lunge, flip, turn) {
  const pp = painter(OKB_W, OKB_H);
  const SKIN = ['#1e3a16', '#305c22', '#3e7a2a', '#62a03a', '#7cb848', '#9cd45a'].map(hexRGB);
  const GOLDR = ['#4a3008', '#6e4a10', '#b88420', '#f8d048', '#fff070'].map(hexRGB);
  const MET = ['#16161c', '#26262e', '#44444f', '#6a6a7a', '#a8a8b8', '#e0e0ea'].map(hexRGB);
  const FUR = ['#1e1610', '#3a2e24', '#5a4a3a', '#7e6a52', '#a8927a', '#ccb89c'].map(hexRGB);
  const LEATHER = ['#140e0a', '#1e1610', '#2e2218', '#3e2e20'].map(hexRGB);
  const RED = ['#2e0806', '#4a100c', '#8c2018', '#c83020', '#e84838'].map(hexRGB);
  const oy = OKB_OY + bob + (lunge ? 1 : 0);
  // súradnice tela → plátno (zrkadlenie pre západné smery), tieňovanie zľava zhora ostáva
  const X = x => flip ? OKB_W - 1 - (OKB_OX + x) : OKB_OX + x;
  const p = { set: (x, y, c) => pp.set(X(x), oy + y, c), shade: (x, y, r, v) => pp.shade(X(x), oy + y, r, v) };
  const lit = (x, x0, x1) => 1 - (x - x0) / Math.max(1, x1 - x0);
  const hx = turn || 0; // šikmý pohľad: hlava natočená o bod
  // nohy: dvojica stĺpov; legs = [zdvih ľavej, zdvih pravej, posun ľavej, posun pravej] (posun = krok dopredu zboku)
  const leg = (lx, up, dx, side) => { for (let y = 24; y <= 29 - up; y++) for (let x = lx; x <= lx + 3; x++) {
    const xx = x + (y > 26 ? dx : 0);
    p.shade(xx, y, y >= 27 - up ? MET : LEATHER, (y >= 27 - up ? 0.35 : 0.3) + lit(x, lx, lx + 3) * 0.4 + (y === 27 - up ? 0.25 : 0) - (side ? 0.1 : 0));
  } };
  if (view === 'E') {
    for (let y = 12; y <= 26; y++) for (let x = 3; x <= 10 - (y > 20 ? 1 : 0); x++) p.shade(x, y, RED, 0.25 + lit(x, 3, 10) * 0.4 + ((x + (y >> 1)) % 4 === 0 ? -0.15 : 0)); // pelerína za chrbtom
    leg(8, legs[0], -legs[2], true); leg(11, legs[1], legs[3], false);
    for (let y = 13; y <= 23; y++) for (let x = 9; x <= 15; x++) p.shade(x, y, SKIN, 0.3 + lit(x, 9, 15) * 0.45);           // trup zboku
    for (let x = 9; x <= 15; x++) { p.shade(x, 21, LEATHER, 0.8); p.shade(x, 22, LEATHER, 0.45); }
    for (let x = 13; x <= 14; x++) for (let y = 20; y <= 23; y++) p.shade(x, y, GOLDR, y === 20 ? 0.9 : 0.55);              // pracka
    for (let y = 9; y <= 15; y++) for (let x = 6; x <= 16; x++) {                                                          // kožušina na pleciach
      if (y > 13 + Math.round(hash2(x, 3, 77) * 2) || (y === 9 && (x < 8 || x > 14))) continue;
      p.shade(x, y, FUR, 0.25 + lit(x, 6, 16) * 0.55 + (hash2(x, y, 91) - 0.5) * 0.3);
    }
    p.set(7, 8, hexRGB('#eee6cc')); p.set(7, 9, hexRGB('#a8a088'));
    for (let y = 3; y <= 11; y++) for (let x = 10; x <= 17; x++) {                                                         // hlava z profilu
      if ((y === 3 || y === 11) && (x === 10 || x === 17) || (x === 17 && y < 6)) continue;
      p.shade(x, y, SKIN, 0.35 + lit(x, 10, 17) * 0.45 - (y === 6 && x > 12 ? 0.25 : 0));
    }
    p.set(15, 7, RED[4]); p.set(16, 7, RED[2]); p.shade(17, 10, SKIN, 0.15);
    p.set(16, 9, hexRGB('#eee6cc')); p.set(16, 8, hexRGB('#eee6cc'));                                                    // kel
    for (let x = 10; x <= 15; x++) for (let y = 2; y <= 3; y++) p.shade(x, y, GOLDR, (y === 2 ? 0.85 : 0.5) + lit(x, 10, 15) * 0.15);
    for (const cx of [10, 12, 14]) { p.shade(cx, 1, GOLDR, 0.75); if (cx === 12) p.shade(cx, 0, GOLDR, 0.95); }
    p.set(13, 2, RED[4]); p.set(13, 3, RED[2]);
    for (let y = 13; y <= 19; y++) for (let x = 12; x <= 14; x++) p.shade(x, y, y === 17 ? MET : SKIN, (y === 17 ? 0.6 : 0.4) + lit(x, 12, 14) * 0.35); // bližšia ruka
  } else {
    const back = view === 'N';
    for (let y = 12; y <= 25; y++) for (let x = 4; x <= 19; x++) p.shade(x, y, RED, 0.25 + lit(x, 4, 19) * 0.45 + ((x + (y >> 1)) % 5 === 0 ? -0.15 : 0)); // pelerína
    leg(8, legs[0], 0); leg(13, legs[1], 0);
    if (!back) {
      for (let y = 13; y <= 23; y++) for (let x = 7; x <= 16; x++) {                                                      // holá hruď
        const bulge = Math.abs(x - 11.5) < 3 && y < 18 ? 0.08 : 0;
        p.shade(x, y, SKIN, 0.3 + lit(x, 7, 16) * 0.5 + bulge + (y === 16 && x % 4 === 1 ? -0.2 : 0));
      }
      pLine(p, 7, 13, 15, 21, (x, y) => p.shade(x, y, LEATHER, 0.9));
      for (let x = 7; x <= 16; x++) { p.shade(x, 21, LEATHER, 0.9 - x * 0.02); p.shade(x, 22, LEATHER, 0.5); }
      for (let x = 10; x <= 13; x++) for (let y = 20; y <= 23; y++) p.shade(x, y, GOLDR, y === 20 || x === 10 ? 0.9 : 0.55);
    } else for (let x = 9; x <= 14; x++) for (let y = 15; y <= 19; y++)                                                  // zozadu zlatý znak na peleríne
      if (Math.abs(x - 11.5) + Math.abs(y - 17) < 3) p.shade(x, y, GOLDR, 0.6 + lit(x, 9, 14) * 0.2);
    for (let y = 13; y <= 21; y++) for (let x = 3; x <= 5; x++) p.shade(x, y, y >= 17 && y <= 18 ? MET : SKIN, (y >= 17 && y <= 18 ? 0.55 : 0.35) + lit(x, 3, 5) * 0.4);
    for (let y = 13; y <= 18; y++) for (let x = 17; x <= 19; x++) p.shade(x, y, y === 16 ? MET : SKIN, 0.3 + lit(x, 17, 19) * 0.3);
    for (let y = 9; y <= 15; y++) for (let x = 2; x <= 20; x++) {                                                         // kožušinový plášť
      const edge = 13 + Math.round(hash2(x, 3, 77) * 2) - (!back && x > 7 && x < 16 ? 2 : 0);
      if (y > edge || (y === 9 && (x < 6 || x > 17))) continue;
      p.shade(x, y, FUR, 0.25 + lit(x, 2, 21) * 0.55 + (y === 9 ? 0.15 : 0) + (hash2(x, y, 91) - 0.5) * 0.3);
    }
    for (const sx of [3, 20]) { p.set(sx, 8, hexRGB('#eee6cc')); p.set(sx, 9, hexRGB('#a8a088')); }
    for (let y = 3; y <= 11; y++) for (let x = 8 + hx; x <= 15 + hx; x++) {                                               // hlava
      if ((y === 3 || y === 11) && (x === 8 + hx || x === 15 + hx)) continue;
      p.shade(x, y, SKIN, (back ? 0.28 : 0.35) + lit(x, 8 + hx, 15 + hx) * 0.5 - (!back && y === 6 ? 0.25 : 0));
    }
    if (!back) {
      for (const ex of [10, 13]) { p.set(ex + hx, 7, RED[4]); p.set(ex + hx + (ex === 10 ? -1 : 1), 7, RED[2]); }
      for (let x = 9; x <= 14; x++) p.shade(x + hx, 10, SKIN, 0.15);
      p.set(9 + hx, 9, hexRGB('#eee6cc')); p.set(14 + hx, 9, hexRGB('#a8a088')); p.set(9 + hx, 8, hexRGB('#eee6cc')); p.set(14 + hx, 8, hexRGB('#a8a088'));
    } else for (const ex of [7, 16]) p.shade(ex + hx, 7, SKIN, 0.4);                                                      // uši zozadu
    for (let x = 8; x <= 15; x++) for (let y = 2; y <= 3; y++) p.shade(x + hx, y, GOLDR, (y === 2 ? 0.85 : 0.5) + lit(x, 8, 15) * 0.15); // koruna
    for (const cx of [8, 10, 13, 15]) { p.shade(cx + hx, 1, GOLDR, 0.75); if (cx === 10 || cx === 13) p.shade(cx + hx, 0, GOLDR, 0.95); }
    if (!back) { p.set(11 + hx, 2, RED[4]); p.set(12 + hx, 2, RED[2]); p.set(11 + hx, 3, RED[3]); p.set(12 + hx, 3, RED[1]); }
  }
  // obojručná sekera: dlhé porisko, na konci dvojitá čepeľ (obe strany), svetlé ostrie; päsť cez porisko
  const h = OKB_HAND[view], dx = Math.cos(ang), dy = Math.sin(ang), hxx = h.x, hyy = h.y;
  for (let t = -3; t <= 15; t += 0.25) p.shade(Math.round(hxx + dx * t), Math.round(hyy + dy * t), WOOD, (Math.round(t) % 5 === 0 ? 0.3 : 0.62));
  for (let t = 10; t <= 15; t += 0.25) {
    const hw = 3.6 - Math.abs(t - 12.5) * 0.7;
    for (let o = 0.75; o <= hw; o += 0.25) for (const sg of [-1, 1]) {
      const x = Math.round(hxx + dx * t - dy * o * sg), y = Math.round(hyy + dy * t + dx * o * sg);
      p.shade(x, y, MET, o > hw - 0.6 ? 0.95 : 0.45 + (sg < 0 ? 0.2 : 0));
    }
  }
  p.set(Math.round(hxx), Math.round(hyy), SKIN[4]); p.set(Math.round(hxx + dx * 2), Math.round(hyy + dy * 2), SKIN[3]); // obe ruky na porisku
  return pp.finish();
}
function buildOrcKingBig() {
  // nohy: postoj a 4 snímky chôdze [zdvih ľavej, zdvih pravej, krok ľavej, krok pravej], v prekročení telo hore
  const LEGS = { idle: [0, 0, 0, 0], walk: [[0, 1, 1, 0], [0, 0, 0, 0], [1, 0, 0, 1], [0, 0, 0, 0]] };
  const views = (view, flip, turn) => {
    const h = OKB_HAND[view];
    return {
      idle: paintOrcKing(view, LEGS.idle, 1, h.idle, false, flip, turn),
      walk: LEGS.walk.map((l, i) => paintOrcKing(view, l, i % 2 ? 0 : 1, h.idle + [0.12, 0, -0.12, 0][i], false, flip, turn)),
      atk: h.atk.map((a, i) => paintOrcKing(view, LEGS.idle, 1, a, i > 0, flip, turn)),
    };
  };
  // 0 V, 1 JV, 2 J, 3 JZ, 4 Z, 5 SZ, 6 S, 7 SV – šikmé smery = pohľad spredu/zozadu s natočenou hlavou
  const set = [views('E', false), views('S', false, 1), views('S', false), views('S', true, 1), views('E', true), views('N', true, 1), views('N', false), views('N', false, 1)];
  set.stride = 4;
  return set;
}
// sady sa vyrobia po kúskoch počas načítavania (SPR_TASKS) alebo pri prvom použití
function initOrcSprites() {
  lazySpr('orcKing8', () => buildOrcKingBig()); // boss: väčší, maľovaný štetcom
  lazySpr('goblin8', () => buildUnit8({ body: GB8, hand: GB8_HAND, legs: GOB_LEGS, blade: 4, fist: 'o' }));
  lazySpr('garcher8', () => Object.assign(buildUnit8({ body: GA8, bow: GA8_BOW, hand: GB8_HAND, legs: GOB_LEGS, fist: 'o' }), { bow: true }));
  lazySpr('sapper8', () => buildUnit8({ body: SA8, hand: GB8_HAND, legs: GOB_LEGS, noWeapon: true, fist: 'o' }));
  lazySpr('orc8', () => buildUnit8({ body: OR8, hand: OR8_HAND, legs: orcLegs('o', 'q', 'd'), axe: [6, 2.5], fist: 'o' }));
  lazySpr('brute8', () => buildUnit8({ body: BR8, hand: BR8_HAND, legs: orcLegs('o', 'q', 'd', 1), axe: [8, 3.25], fist: 'o', H: 28 }));
  lazySpr('warlord8', () => buildUnit8({ body: BR8, hand: BR8_HAND, legs: orcLegs('o', 'q', 'd', 1), axe: [8, 3.25], fist: 'o', H: 28, pal: PAL_WARLORD }));
  lazySpr('shaman8', () => buildUnit8({ body: SH8, hand: SH8_HAND, legs: orcLegs('P', 'p', 'q'), spear: 9, tip: ['w', 'o'], fist: 'o' }));
  lazySpr('wolf8', () => buildUnit8({ W: 36, H: 28, body: WR8_BODY, mount: WOLF8, legs: WOLF8_LEGS, far: 'DK', hand: WR8_HAND, blade: 4, fist: 'o', stride: 3.5 }));
  lazySpr('bear8', () => buildUnit8({ W: 38, H: 30, body: BR8R_BODY, mount: BEAR8, legs: BEAR8_LEGS, hand: BR8R_HAND, axe: [6, 2.5], fist: 'o', stride: 4.5 }));
  // medvedí vojvoda ako hrdina: snímka švihu (slash) = stredná snímka úderu, ako má sada hrdinov
  lazySpr('bearlord8', () => {
    const set = buildUnit8({ W: 40, H: 32, body: BL8_BODY, mount: BEARLORD8, legs: BEAR8_LEGS, hand: BR8R_HAND, axe: [8, 3.25], fist: 'o', stride: 4.5 });
    for (const v of set) v.slash = v.atk[1];
    return set;
  });
  Object.defineProperty(SPR, 'bearlord', { configurable: true, enumerable: true, get: () => [SPR.bearlord8[2].idle] });
}
