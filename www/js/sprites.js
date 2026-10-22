'use strict';
// Fortward – pixel-art sprity. Každý znak = 1 pixel, farby z palety PAL.
// Svetlo zľava zhora, obrys K (tónovaná takmer čierna).

const PX_LEVELS = 16; // spoločná farebná hĺbka celej scény
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

function snapC(v) { return Math.round(v * (PX_LEVELS - 1) / 255) * 255 / (PX_LEVELS - 1); }
function hexRGB(h) {
  const n = parseInt(h.slice(1), 16);
  return [snapC(n >> 16 & 255), snapC(n >> 8 & 255), snapC(n & 255)];
}
function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

const PAL = {
  K: '#1c140e', W: '#ffffff',
  s: '#f0b888', S: '#b87850',                         // koža
  c: '#88b4ff', B: '#3c64c8', n: '#22337a',           // modrá látka
  w: '#f4f4f8', m: '#bcc0cc', M: '#80869a', D: '#4a4e60', // kov
  l: '#a86c38', L: '#6e4422', d: '#3e2614',           // drevo / koža
  g: '#f8d048', G: '#b88420',                         // zlato
  o: '#9cd45a', O: '#62a03a', q: '#305c22',           // orkská koža
  r: '#e84838', R: '#8c2018',                         // červená
  p: '#a868e8', P: '#64349c', v: '#e0b8ff',           // fialová (mág)
  y: '#fff070', e: '#eee6cc', E: '#a8a088',           // žltá, kosť
};

// zlaté brnenie ľudských jednotiek z budov najvyššej úrovne: oceľ (w, m, M, D) nahradí zlato, látka ostáva modrá
const PAL_GOLD_ARMOR = { w: '#fff6c0', m: '#f8d048', M: '#c8962c', D: '#7a5418' };
// lukostrelec nosí kožu: zlatá kapucňa, tulec aj pozlátený luk (koža a drevo l, L, d)
const PAL_GOLD_ARCHER = Object.assign({ l: '#e8b838', L: '#a87a24', d: '#5e4012' }, PAL_GOLD_ARMOR);

// ---- Obrancovia (pohľad zozadu – pozerajú na hordu) ----
const DEF_ARCHER = [
  '..KK......KK..',
  '.KlK..KKKKwrK.',
  '.KlK.KcBBnKlK.',
  'KlKm.KcBBnKlK.',
  'KlKm.KBBBnlK..',
  'KlKmKKnBnlnK..',
  'KlKmKBKnlnKBK.',
  'KlKssBclBBBnK.',
  'KlKsscBlBBBnK.',
  'KlKmKBlBBBnnK.',
  'KlKmKLgLLLLLK.',
  '.KlKKnBBBBnnK.',
  '.KlK.KnBKBnK..',
  '..KK.KLLKLLK..',
  '.....KddKddK..',
  '.....KKK.KKK..',
];

const DEF_KNIGHT = [ // kušník – prilba s modrým chocholom ako na inšpirácii
  '......KK......',
  '.....KcBK.....',
  '....KKcBnKK...',
  '...KwmcBnMDK..',
  '...KmmcBnMDK..',
  '...KmmMBnMDK..',
  '...KMMMMMDDK..',
  'Kl.KMKDDDKMDlK',
  'KlKmMMKKKMDDlK',
  '.KlllKMMKlllK.',
  '..KKcBKKBnKK..',
  '...KBBBBBnnK..',
  '...KLLgLLLLK..',
  '...KnBBKBnnK..',
  '...KMMDKMDDK..',
  '...KKKK.KKKK..',
];

const DEF_MAGE = [
  '......K....KK.',
  '.....KvK..KWyK',
  '.....KpPK.KyyK',
  '....KvpPK..KK.',
  '....KppPPK.KlK',
  '...KvppPPPK.lK',
  '.KKKKKKKKKKKlK',
  '..KmmmmMMDKKlK',
  '..KppppPPPPssK',
  '..KvpppPPPPKlK',
  '..KggggGGGGKlK',
  '..KvppPPPPPKlK',
  '.KvpppPPPPPKlK',
  '.KvppPPPPPPKlK',
  '.KvvvvvvvPPKlK',
  '.KKKKKKKKKK.K.',
];

// Rytier z kasární – zozadu, štít a meč (2 snímky chôdze)
const SOLDIER_BODY = [
  '......KK......',
  '.....KcBK.....',
  '....KKcBnKK...',
  '...KwmcBnMDK.K',
  '...KmmMMMMDKKw',
  '.KKKKMMMMDKKmK',
  'KcBBKKKKKKBKmK',
  'KBmBKcBBBnBKsK',
  'KBBnKBBBBnnKKK',
  'KnBnKLLgLLLK..',
  '.KnKKnBBKBnK..',
];
const SOLDIER_LEGS = [
  ['..K.KMMDKMDK..',
   '....KKKK.KKK..'],
  ['....KMDKKMMK..',
   '....KKK..KKK..'],
];

// Mních z kaplnky – kapucňa, hnedá kutňa, povrazový opasok, palica s krížikom
const MONK_BODY = [
  '.....KK.....K.',
  '....KlLK...KgK',
  '...KlLLLK..KlK',
  '...KlLLLdK.KlK',
  '...KKdddKK.KlK',
  '..KlLLLLLdKKlK',
  '.KlLLLLLLLdslK',
  '.KlLLLLLLLdKlK',
  '.KlLeeeeeLdKlK',
  '.KlLLLeLLLdKlK',
  '.KlLLLLLLLdKlK',
];
const MONK_LEGS = [
  ['.KdLLLLLLLdKlK',
   '..KKK..KKK..K.'],
  ['.KdLLLLLLLdKlK',
   '...KKK.KKK..K.'],
];
// mních pri liečení: palicu zdvihne nad hlavu (ruka hore, rukáv po palici)
const MONK_CAST = [
  '............K.',
  '...........KgK',
  '...........KlK',
  '...........KlK',
  '.....KK....KlK',
  '....KlLK...KlK',
  '...KlLLLK.KslK',
  '...KlLLLdKLLlK',
  '...KKdddKKLKlK',
  '..KlLLLLLdLKlK',
  '.KlLLLLLLLdKlK',
  '.KlLLLLLLLdKlK',
  '.KlLeeeeeLdKK.',
  '.KlLLLeLLLdK..',
  '.KlLLLLLLLdK..',
  '.KdLLLLLLLdK..',
  '..KKK..KKK....',
];
// Remeselník z dielne – čiapka, plátenná košeľa, kožená zástera (kladivo sa kreslí zvlášť, pohyblivé)
const CRAFT_BODY = [
  '.....KKKK.....',
  '....KLlLLK....',
  '....KLLLdK....',
  '....KddddK....',
  '..KKeEEEEeKK..',
  '.KeELEEEELeK..',
  '.KeEELEELEesK.',
  '.KeEEELLEEEK..',
  '.KLLLLLLLLLK..',
  '.KdLLLLLLLdK..',
  '..KdLLLLLdK...',
];
const CRAFT_LEGS = [
  ['...KddKKddK...',
   '...KKK..KKK...'],
  ['....KddKddK...',
   '....KKK.KKK...'],
];

// Kráľ – zozadu, koruna, hermelín, červený plášť
const KING_BODY = [
  '....K.KK.K....',
  '...KgKggKgK...',
  '...KggGgGGK...',
  '...KlLLLLdK...',
  '...KlLLLLdK..K',
  '..KeWeKeeEK.Kw',
  '.KrrreeeeRRKKm',
  '.KrrrrrrRRRKsK',
  'KrrrrrrrRRRRKK',
  'KrrrrrrRRRRRK.',
  'KrrrrrRRRRRRK.',
  'KrrrrRRRRRRRK.',
  '.KKKKKKKKKKK..',
];
const KING_LEGS = [
  ['...KMDK.KMDK..',
   '...KKK..KKK...'],
  ['....KMDKKMDK..',
   '....KKK.KKK...'],
];

// Paladin – zozadu, strieborná prilba so zlatým hrebeňom, biely plášť so zlatým krížom, bojové kladivo
const PALADIN_BODY = [
  '.....KKKK.....',
  '....KgggGK....',
  '...KwmmmMDKKKK',
  '...KmmmmMDKwmK',
  '...KmMMMMDKmMK',
  '.KwmMDDDDmMKlK',
  '.KeeeeggeeEKlK',
  '.KeeeeggeeEKsK',
  'KeeeggggggEEKK',
  'KeeeeggeeEEEK.',
  'KeeeeggeeEEEK.',
  'KeeeeggeeEEEK.',
  '.KKKKKKKKKKK..',
];
const PALADIN_LEGS = [
  ['...KmDK.KmDK..',
   '...KKK..KKK...'],
  ['....KmDKKmDK..',
   '....KKK.KKK...'],
];
const PAL_PALADIN = { e: '#f4f0e6', E: '#b0a894' };
// Čarodejka – zozadu, kapucňa, dlhé ryšavé vlasy, karmínový plášť so zlatým opaskom, palica s ohnivou guľou
const SORC_BODY = [
  '....KKKKK.KyyK',
  '...KrrrrRKKffK',
  '...KrrRRRRKKgK',
  '...KhhhhHK.KlK',
  '..KhhHhhHHKKlK',
  '.KRrhhHhHRRKlK',
  '.KrrrhHhHRRKsK',
  'KrrrrrhHRRRKlK',
  'KrgggggggRRKlK',
  'KrrrrrRRRRRKlK',
  'KrrrrRRRRRRKlK',
  'KrrrRRRRRRRKlK',
  '.KKKKKKKKKKKlK',
];
const SORC_LEGS = [
  ['...KddK.KddKK.',
   '...KKK..KKK...'],
  ['....KddKKddKK.',
   '....KKK.KKK...'],
];
const PAL_SORC = { r: '#c8406c', R: '#6c1c44', h: '#f8a040', H: '#b8501c', y: '#fff070', f: '#f87830' };


// Goblin-lukostrelec – kapucňa a luk, strieľa na budovy z diaľky
const GARCHER_BODY = [
  '....KKKK....',
  'KK.KRRRRK.KK',
  'KoKRooooRKqK',
  '.KKoroorOKK.',
  '..KoooOOOK.K',
  '..KOwOwOqKKl',
  '.KoKOOOqKoKl',
  '.KoKLLLLKoKl',
  '..KKLlLdKKKl',
];
// Netopier – 2 snímky mávania krídlami
const BAT_FRAMES = [
  ['K...........K',
   'KK.........KK',
   'KPK..K.K..KPK',
   'KPPK.KPK.KPPK',
   '.KPPKrPrKPPK.',
   '..KPPPPPPPK..',
   '...KK.K.KK...',
   '.............'],
  ['.............',
   '.....K.K.....',
   '.....KPK.....',
   '....KrPrK....',
   '..KKKPPPKKK..',
   '.KPPPPPPPPPK.',
   'KPPK.KPK.KPPK',
   'KK...K.K...KK'],
];
// Beranidlo – krytá strieška so železnou hlavicou na kolesách
const RAM_FRAMES = [
  ['...KKKKKKKKKKKK...',
   '..KlllllllllllLK..',
   '.KlLlLlLlLlLlLLLK.',
   'KlllllllllllLLLLLK',
   'KKKKKKKKKKKKKKKKKK',
   '.KdLLLLLLLLLLLLdK.',
   'KKKdLLLKMMKLLLdKKK',
   'KlKKdLKmwMDKLdKKlK',
   'KLlKKKKMmMDKKKKLlK',
   'KdLK..KMMMDK..KdLK',
   'KLdK..KDDDDK..KLdK',
   '.KK....KKKK....KK.'],
  ['...KKKKKKKKKKKK...',
   '..KlllllllllllLK..',
   '.KlLlLlLlLlLlLLLK.',
   'KlllllllllllLLLLLK',
   'KKKKKKKKKKKKKKKKKK',
   '.KdLLLLLLLLLLLLdK.',
   'KKKdLLLKMMKLLLdKKK',
   'KLKKdLKmwMDKLdKKLK',
   'KdLKKKKMmMDKKKKdLK',
   'KLlK..KMMMDK..KLlK',
   'KlLK..KDDDDK..KlLK',
   '.KK....KKKK....KK.'],
];
// Šaman – lebkový čelenkový pokrov, fialové rúcho, palica so zeleným svetlom
const SHAMAN_BODY = [
  '...K.KK.K...KK',
  '..KeKeeKeK.KoK',
  '..KeeEEeeK.KoK',
  '..KoqrOrqK..lK',
  '..KooOOOOK..lK',
  '..KowOOwqK..lK',
  '.KPPKOOKPPK.lK',
  'KPpPPKKPPPPKoK',
  'KPpPPPPPPPPKlK',
  'KPpPPgPPPPPKlK',
  '.KpPPPPPPPPKlK',
  '.KpPPPPPPPPKlK',
  '.KPPPPPPPPPKlK',
];
const SHAMAN_LEGS = [
  ['..KqOK.KOqK...', '..KKKK.KKKK...'],
  ['.KqOK...KOqK..', '.KKKK...KKKK..'],
];
// Jazdec na koni – zozadu
const RIDER_FRAMES = [
  ['......KK.......',
   '.....KcBK......',
   '....KKcBnKK....',
   '...KwmcBnMDK...',
   '...KmmMMMMDK...',
   '..KKBBBBBBnKK..',
   '..KBcBBBBBnBK..',
   '..KlKBBBBnKlK..',
   '.KLlLLLLLLLLLK.',
   'KlLLLLLLLLLLLdK',
   'KlLLLLlLLLLLLdK',
   '.KLLLLLLLLLLdK.',
   '..KLdK...KLdK..',
   '..KLdK...KLdK..',
   '..KddK...KddK..',
   '..KKK.....KKK..'],
  ['......KK.......',
   '.....KcBK......',
   '....KKcBnKK....',
   '...KwmcBnMDK...',
   '...KmmMMMMDK...',
   '..KKBBBBBBnKK..',
   '..KBcBBBBBnBK..',
   '..KlKBBBBnKlK..',
   '.KLlLLLLLLLLLK.',
   'KlLLLLLLLLLLLdK',
   'KlLLLLlLLLLLLdK',
   '.KLLLLLLLLLLdK.',
   '...KLdK.KLdK...',
   '..KLdK...KLdK..',
   '..KddK...KddK..',
   '..KKK.....KKK..'],
];
// kopijník: kópia rytiera s kopijou namiesto meča
const SPEAR_BODY = SOLDIER_BODY.map((row, r) => {
  const a = row.split('');
  if (r <= 9) { a[12] = r === 0 ? 'w' : r === 1 ? 'm' : 'l'; if (r <= 1) { a[11] = a[11] === '.' ? 'K' : a[11]; a[13] = 'K'; } }
  return a.join('');
});

// ---- Horda (pohľad spredu – idú k hráčovi) ----
const GOBLIN_BODY = [
  '....KKKK....',
  'KK.KooooK.KK',
  'KoKoooooOKqK',
  '.KKoroorOKK.',
  '..KoooOOOK..',
  '..KOwOwOqK..',
  '.KoKOOOqKwK.',
  '.KoKLLLLKMK.',
  '..KKLlLdKoK.',
];
// podkopník – goblin s bombou v ruke (horiaci knôt)
const SAPPER_BODY = [
  '....KKKK.......',
  'KK.KooooK.KK...',
  'KoKoooooOKqKy..',
  '.KKoroorOKK.L..',
  '..KoooOOOK.KLK.',
  '..KOwOwOqKKDmDK',
  '.KoKOOOqKoKDDDK',
  '.KoKLLLLKoKDDDK',
  '..KKLlLdK..KKK.',
];
const GOBLIN_LEGS = [
  ['...KqKKqK...',
   '...KoK.KqK..',
   '...KK...KK..'],
  ['...KqKKqK...',
   '..KqK..KoK..',
   '..KK....KK..'],
];

const ORC_BODY = [
  '....KKKKKK.....',
  '...KooooooK.KK.',
  '..KooOOOOOqKmMK',
  '..KoqrOOrqqKmMK',
  '..KoooOOOOqKKlK',
  '..KowOOOOwqK.lK',
  '...KKOOOqKK..lK',
  '.KMmKoOOqKMmKoK',
  'KmMMKOOOOKMMDlK',
  'KoKKLLgLLLKKKlK',
  'KoK.KLLLLLK..lK',
  '.K..KLlLLdK..K.',
];
const ORC_LEGS = [
  ['....KqOKOqK....',
   '....KqOKOqK....',
   '....KddKddK....',
   '....KKKKKKK....'],
  ['....KqOKKOqK...',
   '...KqOK.KOqK...',
   '...KddK..KddK..',
   '...KKK....KKK..'],
];

const BRUTE_BODY = [
  '.KK....KKKK....KK.',
  'KeEK..KmwmMK..KEeK',
  'KeEEKKmmmMMDKKEEeK',
  '.KEEEKmMMMMDKEEEK.',
  '..KKKDDDDDDDDKKK..',
  '....KoqrOOrqqKKMK.',
  '....KoOOOOOOqKlLLK',
  '....KowOOOOwqKlLLK',
  '...KKKOOOOOqKKMlLK',
  '.KKmMMKqOOqKMMKlLK',
  'KmMMMDKKKKKKMMDKlK',
  'KMMDDKmMMMMDKDDKoK',
  'KoKKKmMMMMMMDKKKlK',
  'KoK.KLLgLLLLLK..lK',
  '.K..KLLLLLLLLK....',
];
const BRUTE_LEGS = [
  ['....KqOOKKOOqK....',
   '....KqOOKKOOqK....',
   '....KMMDKKMMDK....',
   '....KKKKKKKKKK....'],
  ['....KqOOKKOOqK....',
   '...KqOOK..KOOqK...',
   '...KMMDK..KMMDK...',
   '...KKKKK..KKKKK...'],
];

const ICON_GEM = [
  '.KKKKK.',
  'KcWcBnK',
  'KccBBnK',
  '.KcBnK.',
  '..KBK..',
  '...K...',
];
const ICON_COIN = [
  '.KKK.',
  'KygGK',
  'KgGGK',
  'KGGGK',
  '.KKK.',
];
const ICON_CHEST = [ // truhlica zlatiek: drevo so zlatým kovaním a zámkou, navrchu kôpka mincí
  '...KKK.KK..',
  '..KygKKygK.',
  '.KKgGKgGGKK',
  'KGLLLgLLLGK',
  'KGlllglllGK',
  'KKKKKKKKKKK',
  'KGlllglllGK',
  'KGllKgKllGK',
  'KGLLKGKLLGK',
  'KGdddddddGK',
  'KKKKKKKKKKK',
];

// Vojvodca (boss) = surovec s inou paletou: tmavočervená koža, zlaté rohy.
const PAL_WARLORD = {
  o: '#e07a50', O: '#a8482c', q: '#5a2216',
  e: '#f8d048', E: '#b88420',
  m: '#6a6a7a', M: '#44444f', w: '#a8a8b8', D: '#26262e', r: '#fff070',
};

function buildSprite(rows, palOverride) {
  const h = rows.length, w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) console.warn('Sprite: zlá šírka riadku', i, r); });
  const pal = Object.assign({}, PAL, palOverride || {});
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const c = mk(), f = mk(), sil = mk();
  const cx = c.getContext('2d'), fx = f.getContext('2d'), sx = sil.getContext('2d');
  const id = cx.createImageData(w, h), fd = fx.createImageData(w, h), sd = sx.createImageData(w, h);
  const outline = hexRGB(PAL.K);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      if (!pal[ch]) { console.warn('Sprite: neznáma farba', ch); continue; }
      const col = hexRGB(pal[ch]);
      const i = (y * w + x) * 4;
      id.data[i] = col[0]; id.data[i + 1] = col[1]; id.data[i + 2] = col[2]; id.data[i + 3] = 255;
      // záblesk pri zásahu: obrys ostáva, vnútro biele
      const fc = ch === 'K' ? outline : [255, 255, 255];
      fd.data[i] = fc[0]; fd.data[i + 1] = fc[1]; fd.data[i + 2] = fc[2]; fd.data[i + 3] = 255;
      // silueta pre zamknuté veci
      const sc = ch === 'K' ? outline : [51, 51, 68];
      sd.data[i] = sc[0]; sd.data[i + 1] = sc[1]; sd.data[i + 2] = sc[2]; sd.data[i + 3] = 255;
    }
  }
  cx.putImageData(id, 0, 0); fx.putImageData(fd, 0, 0); sx.putImageData(sd, 0, 0);
  return { c, f, sil, w, h };
}

// ---- Postavičky rás (výber rasy, Nákupy): spredu, obrys sa dopočíta automaticky ----
const RACE_ART = {
  humans: [ // rytier s modrým chocholom, štítom a mečom
    '.....cBn......',
    '....cBBn......',
    '...wmmmmM...w.',
    '...mmmmmD...w.',
    '...mKKKKD...w.',
    '...mmgmmD...w.',
    '....MMMD....m.',
    'wmm.cBBBnn..m.',
    'mgmcBBgBBnn.m.',
    'mggcBgggBnnGgG',
    'mgmcBBgBBnnKs.',
    'MmMcBBgBBnn.L.',
    '.M.KLLgLLLK.g.',
    '...cBBnBBn....',
    '...MMD.MMD....',
    '...MMD.MMD....',
    '...LLL.LLL....',
  ],
  orcs: [ // zelený surovec v rohatej prilbe, s klami
    '..e........e..',
    '..ee.MMMM.ee..',
    '...eMmmmmMe...',
    '...oooooooO...',
    '...oroooorO...',
    '...oooOOooO...',
    '...oeKKKKeO...',
    '....oooooO....',
    '.mmMLLLLLLmmM.',
    '.oOLLdLLdLLoO.',
    '.oOLLLdLLLLoO.',
    '.oOMMMgMMMMoO.',
    '.oo.LLLLLL.oo.',
    '....LLLdLL....',
    '....oO..oO....',
    '....oO..oO....',
    '...ddd..ddd...',
  ],
  undead: [ // kostlivec v hrdzavej prilbe a roztrhanom plášti, žiariace očnice
    '....DMMMMD....',
    '...DMmmmmMD...',
    '...eeeeeeeE...',
    '...eKoeKoeE...',
    '...eeeKeeeE...',
    '....eKeKeK....',
    '.....EeeE.....',
    '..RReKeKeKRR..',
    '.RrReeKeeKRrR.',
    '.RrRKeKeKeRrR.',
    '.Re.KeeeeK.eR.',
    '.R...KeeK...R.',
    '.R..eEKKEe..R.',
    '....eK..Ke....',
    '....e....e....',
    '....E....E....',
    '...eE....Ee...',
  ],
  elves: [ // lukostrelec v zelenej kapucni, špicaté uši
    '.....fffF.....',
    '....fffffF....',
    '...ffhhhhFF...',
    '.s.fhssssHF.s.',
    '.ssfsKssKsFss.',
    '...fhssssHF...',
    '.l.fHhsshHF...',
    'l.FfffgffffF..',
    'l.FfFffffFfF..',
    'l.sFffgfffFs..',
    'l..FffgfffF...',
    '.l.LLLgLLLL...',
    '...FffFffF....',
    '...FF..FF.....',
    '...FF..FF.....',
    '...LL..LL.....',
    '..LLL..LLL....',
  ],
  demons: [ // červený démon s rohmi, tesákmi, krídlami a chvostom
    '.M..........M.',
    '.MD........DM.',
    '..MD.rrrr.DM..',
    '...DrrrrrrD...',
    '...ryKrryKR...',
    '...rrrRRrrR...',
    '...rKWKKWKR...',
    '.P..RrrrrR..P.',
    'PP.DDrrrrDD.PP',
    'PPPrDDMMDDrPPP',
    '.PPrDMgMMDrPP.',
    '..PrDDDDDDrP..',
    '...KDDgDDDK.r.',
    '....rR..rR..rR',
    '....rR..rR..R.',
    '....rR..rR....',
    '...DDD..DDD...',
  ],
  swarm: [ // hmyzí bojovník s kosami, kusadlami a kyselinovými očami
    '.e..........e.',
    'eE..........Ee',
    'E....uuuU....E',
    'E...uuuuuU...E',
    'eE.uaUuuaUU.Ee',
    '.EeuUuuuuUUeE.',
    '..Ue.UUUU.eU..',
    '....eEUUEe....',
    '...uuUuuUuU...',
    '..uUuAuuAuUU..',
    '..UuuuUUuuuU..',
    '.e.UuAuuAuU.e.',
    'e..UUuUUuUU..e',
    '.e..UUuuUU..e.',
    '..e.e.UU.e.e..',
    '..e.e....e.e..',
    '.E..E....E..E.',
  ],
};
const RACE_PAL = {
  undead: { R: '#3a2e48', r: '#5a4a6a', o: '#7cff6a' },             // roztrhaný plášť, zelená žiara v očniciach
  elves:  { f: '#6cc048', F: '#2e7a30', h: '#f8e08a', H: '#c8a040' }, // lesná zelená, svetlé vlasy
  demons: { P: '#4a2448' },                                          // tmavé krídla
  swarm:  { u: '#9a6aa8', U: '#4e2e5a', a: '#9cff4a', A: '#4ca02a' }, // chitín, kyselina
};
// obkreslí postavičku tmavým obrysom (okraj o 1 bod väčší) a postaví z nej sprite
function buildOutlined(rows, pal) {
  const w = rows[0].length + 2, h = rows.length + 2;
  const g = [...Array(h)].map((_, y) => [...Array(w)].map((_, x) => (rows[y - 1] || '')[x - 1] || '.')).map(r => r.map(c => c === undefined ? '.' : c));
  const out = g.map(r => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== '.') continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx] !== '.')) out[y][x] = 'K';
  }
  return buildSprite(out.map(r => r.join('')), pal);
}

const SPR = {};
function initSprites() {
  SPR.archer = [buildSprite(DEF_ARCHER)];
  for (const k in RACE_ART) SPR['race_' + k] = [buildOutlined(RACE_ART[k], RACE_PAL[k])];
  // lukostrelec zo strelnice (pešia jednotka) – rovnaký vojak, druhá snímka s prekročenými nohami
  SPR.footArcher = [buildSprite(DEF_ARCHER), buildSprite(DEF_ARCHER.slice(0, 14).concat(['....KddK.KddK.', '....KKK...KKK.']))];
  lazySpr('footArcherG8', () => Object.assign(buildArcher8(PAL_GOLD_ARCHER), { bow: true })); // zlaté brnenie (strelnica 5. úrovne)
  lazySpr('footArcher8', () => Object.assign(buildArcher8(), { bow: true })); // lukostrelec v 8 smeroch (luk pri boku, pri streľbe napnutá tetiva); bow: ako nepriateľ napína luk
  SPR.knight = [buildSprite(DEF_KNIGHT)];
  SPR.mage = [buildSprite(DEF_MAGE)];
  SPR.soldier = SOLDIER_LEGS.map(l => buildSprite(SOLDIER_BODY.concat(l)));
  lazySpr('soldierG8', () => buildKnight8(PAL_GOLD_ARMOR)); // zlaté brnenie (kasárne 5. úrovne)
  lazySpr('soldier8', () => buildKnight8()); // rytier v 8 smeroch (chôdza s pohupom tela, úder mečom)
  SPR.king = KING_LEGS.map(l => buildSprite(KING_BODY.concat(l)));
  lazySpr('king8', buildKing8); // kráľ v 8 smeroch (chôdza, postoj, úder)
  lazySpr('paladin8', buildPaladin8); // paladin v 8 smeroch s bojovým kladivom
  lazySpr('sorc8', buildSorc8); // čarodejka v 8 smeroch s copom a ohnivou palicou
  lazySpr('chief8', buildChief8); // náčelník orkov (hrdina za orkov)
  Object.defineProperty(SPR, 'chief', { configurable: true, enumerable: true, get: () => [SPR.chief8[2].idle] });
  lazySpr('oshaman8', buildOrcShaman8); // šaman orkov (hrdina za orkov)
  Object.defineProperty(SPR, 'oshaman', { configurable: true, enumerable: true, get: () => [SPR.oshaman8[2].idle] });
  SPR.paladin = PALADIN_LEGS.map(l => buildSprite(PALADIN_BODY.concat(l), PAL_PALADIN));
  SPR.sorc = SORC_LEGS.map(l => buildSprite(SORC_BODY.concat(l), PAL_SORC));
  SPR.spear = SOLDIER_LEGS.map(l => buildSprite(SPEAR_BODY.concat(l))); // ľudia vždy v modrom
  lazySpr('spearG8', () => buildSpear8(PAL_GOLD_ARMOR)); // zlaté brnenie (zbrojnica 5. úrovne)
  lazySpr('spear8', () => buildSpear8()); // kopijník v 8 smeroch (kopija opretá o zem, pri útoku sklopená a bodne)
  SPR.shield = SOLDIER_LEGS.map(l => buildSprite(SOLDIER_BODY.concat(l), { c: '#d0d4dc', B: '#80869a', n: '#44485a' }));
  SPR.rider = RIDER_FRAMES.map(f => buildSprite(f));
  lazySpr('riderG8', () => buildRider8(PAL_GOLD_ARMOR)); // zlaté brnenie (stajne 5. úrovne)
  lazySpr('rider8', () => buildRider8()); // jazdec na koni v 8 smeroch (klus, kopija sklopená k útoku)
  lazySpr('hknight8', buildHKnight8); // ťažký rytier (nepriateľ za orkov)
  lazySpr('captain8', buildCaptain8); // kapitán jazdy (boss za orkov)
  SPR.monk = MONK_LEGS.map(l => buildSprite(MONK_BODY.concat(l)));
  SPR.monkCast = [buildSprite(MONK_CAST), buildSprite(MONK_CAST)];
  SPR.craft = CRAFT_LEGS.map(l => buildSprite(CRAFT_BODY.concat(l)));
  SPR.garcher = GOBLIN_LEGS.map(l => buildSprite(GARCHER_BODY.concat(l)));
  SPR.bat = BAT_FRAMES.map(f => buildSprite(f, { P: '#4a3460', p: '#7a5aa0' }));
  SPR.ram = RAM_FRAMES.map(f => buildSprite(f));
  SPR.shaman = SHAMAN_LEGS.map(l => buildSprite(SHAMAN_BODY.concat(l)));
  SPR.sapper = GOBLIN_LEGS.map(l => buildSprite(SAPPER_BODY.concat(l.map(r => r + '...'))));
  SPR.goblin = GOBLIN_LEGS.map(l => buildSprite(GOBLIN_BODY.concat(l)));
  SPR.orc = ORC_LEGS.map(l => buildSprite(ORC_BODY.concat(l)));
  SPR.brute = BRUTE_LEGS.map(l => buildSprite(BRUTE_BODY.concat(l)));
  SPR.warlord = BRUTE_LEGS.map(l => buildSprite(BRUTE_BODY.concat(l), PAL_WARLORD));
  SPR.gem = [buildSprite(ICON_GEM)];
  SPR.coin = [buildSprite(ICON_COIN)];
  SPR.chest = [buildSprite(ICON_CHEST)];
}

// Zásah nepriateľa: namiesto bielej siluety jemný červený nádych (obrys a kresba ostanú), verzia sa vyrobí raz a zapamätá
function hitSpr(spr) {
  if (spr.hit) return spr.hit;
  const c = document.createElement('canvas'); c.width = spr.c.width; c.height = spr.c.height;
  const x = c.getContext('2d'); x.drawImage(spr.c, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data, K = hexRGB(PAL.K);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3] || (d[i] === K[0] && d[i + 1] === K[1] && d[i + 2] === K[2])) continue;
    d[i] = d[i] * 0.72 + 255 * 0.28; d[i + 1] = d[i + 1] * 0.8 + 50 * 0.2; d[i + 2] = d[i + 2] * 0.8 + 40 * 0.2; // jemný nádych
  }
  x.putImageData(id, 0, 0);
  spr.hit = c;
  return c;
}

// Zväčšená ikona (nearest neighbor) ako dataURL pre HTML rozhranie.
// výsledok sa zapamätá na sprite (toDataURL je pomalé a ikony sa v menu kreslia opakovane)
function spriteURL(spr, scale, silhouette) {
  const key = scale + (silhouette ? 's' : '');
  if (spr._url && spr._url[key]) return spr._url[key];
  return ((spr._url = spr._url || {})[key] = spriteURLRaw(spr, scale, silhouette));
}
function spriteURLRaw(spr, scale, silhouette) {
  const c = document.createElement('canvas');
  c.width = spr.w * scale; c.height = spr.h * scale;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(silhouette ? spr.sil : spr.c, 0, 0, c.width, c.height);
  return c.toDataURL();
}

// ---- Pixelové písmo 3x5 pre čísla v scéne ----
const FONT3 = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  '/': ['001', '001', '010', '100', '100'],
};
function pxText(ctx, str, x, y, col) {
  const pts = [];
  for (let k = 0; k < str.length; k++) {
    const gl = FONT3[str[k]];
    if (!gl) continue;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (gl[r][q] === '1') pts.push([x + k * 4 + q, y + r]);
  }
  ctx.fillStyle = PAL.K;
  for (const p of pts) ctx.fillRect(p[0] - 1, p[1] - 1, 3, 3);
  ctx.fillStyle = col;
  for (const p of pts) ctx.fillRect(p[0], p[1], 1, 1);
}

// ---- Kráľ v 8 smeroch: 5 kreslených pohľadov (zvyšné 3 zrkadlovo), chôdza zo 4 snímok, postoj a úder s veľkým mečom ----
// smery: 0 vpravo, 1 vpravo dole, 2 dole (spredu), 3 vľavo dole, 4 vľavo, 5 vľavo hore, 6 hore (zozadu), 7 vpravo hore
const K8_BODY = {
  N: [ // zozadu – koruna, vlasy, hermelín, dlhý červený plášť
    '....K.KK.K....',
    '...KgKggKgK...',
    '...KggGgGGK...',
    '...KlLLLLdK...',
    '...KlLLLLdK...',
    '..KeWeeeeeEK..',
    '.KrreeeeeeRRK.',
    '.KrrrrrrrRRRK.',
    '.KrrrrrrRRRRK.',
    'KrrrrrrRRRRRRK',
    'KrrrrrrRRRRRRK',
    'KrrrrrRRRRRRRK',
    'KrrrrRRRRRRRRK',
    '.KKKKKKKKKKKK.',
  ],
  NE: [ // šikmo zozadu – vpravo vykúka líce
    '....K.KK.K....',
    '...KgKggKgK...',
    '...KggGgGGK...',
    '...KlLLLLsK...',
    '...KlLLLssK...',
    '..KeWeeeeeEK..',
    '.KrreeeeeeRnK.',
    '.KrrrrrrrRRnK.',
    '.KrrrrrrRRRgK.',
    'KrrrrrrRRRRRnK',
    'KrrrrrrRRRRRnK',
    'KrrrrrRRRRRRnK',
    'KrrrrRRRRRRRRK',
    '.KKKKKKKKKKKK.',
  ],
  E: [ // z boku – plášť vzadu, vpredu modrá tunika so zlatým opaskom
    '.....K.KK.....',
    '....KgKggK....',
    '....KggGgGK...',
    '....KLlsssK...',
    '....KLlsKsK...',
    '....KLllssSK..',
    '....KlllllK...',
    '...KreeeeEK...',
    '..KrrrBBBnK...',
    '.KrrrrBBBnK...',
    '.KrrrrgggGK...',
    'KrrrrrBBBnK...',
    'KrrrrrBBBnK...',
    '.KKKKKKKKKK...',
  ],
  SE: [ // šikmo spredu – tvár natočená doprava, brada, hermelín, tunika
    '.....K.KK.K...',
    '....KgKggKgK..',
    '....KggGgGGK..',
    '....KLssssSK..',
    '....KLsKssKK..',
    '....KlssssSK..',
    '....KllllllK..',
    '..KreWllleEK..',
    '.KrrKeBBBBnK..',
    '.KrrKcBBBBnK..',
    'KrrrKgggGggK..',
    'KrrrKcBBBBnK..',
    'KrrrKcBBBBnK..',
    '.KKKKKKKKKKK..',
  ],
  S: [ // spredu – tvár s bradou, hermelínový golier, plášť po stranách
    '....K.KK.K....',
    '...KgKggKgK...',
    '...KggGgGGK...',
    '...KsssssSK...',
    '...KsKssKSK...',
    '...KlsssSlK...',
    '...KllllllK...',
    '..KeWlllleEK..',
    '.KrKeBBBBeKRK.',
    '.KrKcBBBBnKRK.',
    'KrrKgggGggKRRK',
    'KrrKcBBBBnKRRK',
    'KrrKcBBBBnKRRK',
    '.KKKKKKKKKKKK.',
  ],
};
// nohy: 4 snímky chôdze (krok, prekročenie, druhý krok, prekročenie) + postoj
const K8_LEGS = {
  front: {
    idle: ['...KMDK.KMDK..', '...KMDK.KMDK..', '...KKK..KKK...'],
    walk: [
      ['...KMDK.KMDK..', '...KKK..KMDK..', '........KKK...'],
      ['....KMDKKMDK..', '....KMDKKMDK..', '....KKK.KKK...'],
      ['...KMDK.KMDK..', '...KMDK..KKK..', '...KKK........'],
      ['....KMDKKMDK..', '....KMDKKMDK..', '....KKK.KKK...'],
    ],
  },
  side: {
    idle: ['.....KMDK.....', '.....KMDK.....', '.....KKKKK....'],
    walk: [
      ['....KMDKMDK...', '...KMDK..KMDK.', '...KKK...KKKK.'],
      ['.....KMDK.....', '.....KMDK.....', '.....KKKKK....'],
      ['....KMDKMDK...', '...KMDK.KMDK..', '..KKKK..KKKK..'],
      ['.....KMDK.....', '.....KMDK.....', '.....KKKKK....'],
    ],
  },
};
// ruka so zbraňou (súradnice v plátne 38×28) a uhol meča v postoji; smer, kam sa pozerá (na úder)
const K8_HAND = {
  // atk = uhly meča pri údere: napriahnutie, švih, dokončenie (spredu meč švihá bokom, nie cez telo)
  N:  { x: 25, y: 15, idle: -1.15, atk: [-0.2, -1.5, -2.25], legs: 'front' },
  NE: { x: 25, y: 15, idle: -1.0,  atk: [-1.95, -0.75, 0.05], legs: 'front' },
  E:  { x: 22, y: 16, idle: -0.85, atk: [-1.95, -0.3, 0.6],   legs: 'side' },
  SE: { x: 13, y: 16, idle: -2.2,  atk: [-2.55, 3.1, 2.4],    legs: 'front' },
  S:  { x: 12, y: 16, idle: -2.05, atk: [-2.45, 3.0, 2.3],    legs: 'front' },
};
// telo 14×17 (s nohami) v plátne s miestom na zbraň: kladivo pri údere siaha až 7 px do strán a 4 px pod chodidlá
const K8_W = 38, K8_H = 28, K8_BX = 12, K8_BY = 7, K8_PB = 4; // K8_PB = prázdne riadky pod chodidlami
const KNEEL_DY = 3; // kľačiaci kráľ: o toľko riadkov pod kolenami trčí čepeľ (pred ním v zemi)

// paladin v 8 smeroch: strieborná prilba so zlatým hrebeňom a priezorom, biely plášť a halena so zlatým krížom, bojové kladivo
const PAL8_BODY = {
  N: [ // zozadu – hrebeň, prilba, biely plášť so zlatým krížom
    '.....KggK.....',
    '....KgggGK....',
    '...KwmmmmMK...',
    '...KmmmmMDK...',
    '...KmMMMMDK...',
    '..KwmMDDDMDK..',
    '.KmmeeeeeeMDK.',
    '.KeeeeggeeEEK.',
    '.KeeeeggeeEEK.',
    'KeeegggggggEEK',
    'KeeeeeggeeEEEK',
    'KeeeeeggeeEEEK',
    'KeeeeeeeeEEEEK',
    '.KKKKKKKKKKKK.',
  ],
  NE: [ // šikmo zozadu – vpravo vidno štrbinu priezoru a plechové rameno
    '.....KggK.....',
    '....KgggGK....',
    '...KwmmmmMK...',
    '...KmmmmMMDK..',
    '...KmMMMMKDK..',
    '..KwmMDDDMDK..',
    '.KmmeeeeeeMMK.',
    '.KeeeeggeeEMK.',
    '.KeeeeggeeEDK.',
    'KeeegggggggMDK',
    'KeeeeeggeeEEDK',
    'KeeeeeggeeEEEK',
    'KeeeeeeeeEEEEK',
    '.KKKKKKKKKKKK.',
  ],
  E: [ // z boku – plášť vzadu, vpredu plech a halena so zlatým krížom, kožený opasok
    '......KggK....',
    '.....KgggGK...',
    '....KwmmmmMK..',
    '....KmmmmmmMK.',
    '....KmMKKKKKK.',
    '....KmMMMmmDK.',
    '....KDMMMMDK..',
    '...KeKwmmmDK..',
    '..KeeKmggmDK..',
    '.KeeeKgggggK..',
    '.KeeeKmggMDK..',
    'KeeeeKLLgLLK..',
    'KeeeeKmggMDK..',
    '.KKKKKKKKKK...',
  ],
  SE: [ // šikmo spredu – priezor so štrbinou a krížom prieduchov
    '.....KggK.....',
    '....KgggGK....',
    '...KwmmmmMK...',
    '...KmmmmmMDK..',
    '...KmKKKKKDK..',
    '...KmmmgmMDK..',
    '...KDmmgmMDK..',
    '..KemMMMMMEK..',
    '.KeKwmggmMDK..',
    '.KeKmggggggK..',
    'KeeKwmggmMDK..',
    'KeeKLLLgLLLK..',
    'KeeKwmggmMDK..',
    '.KKKKKKKKKKK..',
  ],
  S: [ // spredu – priezor, náprsník so zlatým krížom, plášť po stranách
    '.....KggK.....',
    '....KgggGK....',
    '...KwmmmmMK...',
    '...KmmmmmMK...',
    '...KmKKKKDK...',
    '...KmmmgmMK...',
    '...KDmmgmDK...',
    '..KemMMMMDEK..',
    '.KeKwmggmDKEK.',
    '.KeKggggggKEK.',
    'KeeKwmggmDKEEK',
    'KeeKLLLgLLKEEK',
    'KeeKwmggmDKEEK',
    '.KKKKKKKKKKKK.',
  ],
};
// porazený hrdina kľačí spredu so sklonenou hlavou (12 riadkov, posledný je obrys)
const K8_KNEEL = [
  '....K.KK.K....',
  '...KgKggKgK...',
  '...KggGgGGK...',
  '...KsssssSK...',
  '...KllllllK...',
  '..KeWlllleEK..',
  '.KrKeBBBBeKRK.',
  '.KrKcBBBBnKRK.',
  'KrrKgggGggKRRK',
  'KrrKcBBBBnKRRK',
  'KrrKMMDDMMKRRK', // stehná kľačiaceho
  '.KKKKKKKKKKKK.',
];
const PAL8_KNEEL = [ // prilba sklonená – priezor nie je vidno, len temeno s hrebeňom
  '.....KggK.....',
  '....KgggGK....',
  '...KwmmmmMK...',
  '...KmmmmmMK...',
  '...KmMMMMDK...',
  '..KemDDDDDEK..',
  '.KeKwmggmDKEK.',
  '.KeKggggggKEK.',
  'KeeKwmggmDKEEK',
  'KeeKLLLgLLKEEK',
  'KeeKMMDDMMKEEK',
  '.KKKKKKKKKKKK.',
];

// čarodejka v 8 smeroch: odkrytá hlava so zlatou čelenkou, ryšavé vlasy zapletené do copu (zozadu stredom chrbta,
// spredu a zboku cez plece), karmínový plášť, fialové šaty so zlatým opaskom, palica s ohnivou guľou
const SORC8_BODY = {
  N: [ // zozadu – cop až po pás, zviazaný zlatou stužkou
    '....KKKKKK....',
    '...KhhhhhHK...',
    '...KgggggGK...',
    '...KhhHhhHK...',
    '...KhhhhHHK...',
    '..KrKhHhHKRK..',
    '.KrrrKhHKRRRK.',
    '.KrrrKHhKRRRK.',
    'KrrrrKhHKRRRRK',
    'KrgggKHhKgggRK',
    'KrrrrKhHKRRRRK',
    'KrrrrKgGKRRRRK',
    'KrrrKhhHHKRRRK',
    '.KKKKKKKKKKKK.',
  ],
  NE: [ // šikmo zozadu – vpravo líce, cop trochu vľavo od stredu
    '....KKKKKK....',
    '...KhhhhhHK...',
    '...KgggggGgK..',
    '...KhhHhhHsK..',
    '...KhhhhHHsK..',
    '..KrKhHhKRRRK.',
    '.KrrKhHKRRRRK.',
    '.KrrKHhKRRRRK.',
    'KrrrKhHKRRRRRK',
    'KrggKHhKgggGRK',
    'KrrrKhHKRRRRRK',
    'KrrrKgGKRRRRRK',
    'KrrKhhHHKRRRRK',
    '.KKKKKKKKKKKK.',
  ],
  E: [ // z boku – tvár vpravo, čelenka s drahokamom, cop visí za chrbtom
    '.....KKKKK....',
    '....KhhhhHK...',
    '....KgggggyK..',
    '...KhhhhsssK..',
    '...KhhHhsKsK..',
    '..KhKHhhsssK..',
    '..KHKKhsssK...',
    '..KhKrrrrRK...',
    '..KHKrrrrRK...',
    '..KhKgggGGK...',
    '..KgKrrrrRK...',
    '.KhhKrrrrRRK..',
    '.KKKrrrrrRRK..',
    '...KKKKKKKKK..',
  ],
  SE: [ // šikmo spredu – cop cez ľavé plece dopredu
    '....KKKKKK....',
    '...KhhhhhHK...',
    '...KgggyGGK...',
    '...KhsssssK...',
    '...KhsKsKsK...',
    '...KhsssSsK...',
    '...KhhssshHK..',
    '..KrKppppHhK..',
    '.KrrKvpppKhHK.',
    '.KrrKgggGKHhK.',
    'KrrrKvpppKgGK.',
    'KrrrKvppPKhHHK',
    'KrrrKvppPPPPK.',
    '.KKKKKKKKKKKK.',
  ],
  S: [ // spredu – tvár, čelenka s drahokamom, cop cez plece na hrudi
    '....KKKKKK....',
    '...KhhhhhHK...',
    '...KgggyggK...',
    '...KhssssHK...',
    '...KhKssKHK...',
    '...KhssssHK...',
    '...KhhsSHhHK..',
    '..KrKppppKhK..',
    '.KrrKvpppKHhK.',
    'KrrKggggGKhHK.',
    'KrrKvpppPKgGK.',
    'KrrKvpppPKhHHK',
    'KrrKvppPPPPRRK',
    '.KKKKKKKKKKKK.',
  ],
};
const SORC8_KNEEL = [ // hlava sklonená – vidno temeno s čelenkou, cop padá dopredu cez plece
  '....KKKKKK....',
  '...KhhhhhHK...',
  '...KgggyggK...',
  '...KhhhhhHK...',
  '...KhhhhHHK...',
  '..KrKhhHHKhK..',
  '.KrrKppppKhHK.',
  'KrrKggggGKHhK.',
  'KrrKvpppPKgGK.',
  'KrrKvpppPKhHHK',
  'KrrKvvppPPKRRK',
  '.KKKKKKKKKKKK.',
];
// palica sa drží zvislo pri boku; pri kúzle sa napriahne a vystrčí dopredu (uhly pre palicu namiesto meča)
const SORC8_HAND = {
  N:  { idle: -1.45, atk: [-1.75, -1.4, -1.35] },
  NE: { idle: -1.35, atk: [-1.75, -1.0, -0.9] },
  E:  { idle: -1.3,  atk: [-1.8, -0.8, -0.7] },
  SE: { idle: -1.75, atk: [-1.45, -2.15, -2.3] },
  S:  { idle: -1.7,  atk: [-1.45, -1.9, -2.0] },
};
const buildSorc8 = () => buildHero8({ body: SORC8_BODY, kneel: SORC8_KNEEL, weapon: 'staff', hand: SORC8_HAND,
  pal: Object.assign({}, PAL_SORC, { M: '#6e4422', D: '#3e2614' }) }); // M, D = čižmy pod šatami
const buildKing8 = () => buildHero8({ body: K8_BODY, kneel: K8_KNEEL, weapon: 'sword' });
const buildPaladin8 = () => buildHero8({ body: PAL8_BODY, kneel: PAL8_KNEEL, weapon: 'hammer', pal: PAL_PALADIN });

// hrdina v 8 smeroch: 5 kreslených pohľadov + 3 zrkadlové, zbraň (meč / kladivo) sa dokresľuje pod uhlom
function buildHero8(spec) {
  const K = hexRGB(PAL.K);
  const col = ch => hexRGB((spec.pal && spec.pal[ch]) || PAL[ch]);
  // sekera (náčelník orkov) sa správa ako kladivo (po údere ostane vpredu, v kľaku stojí na zemi), len má čepeľ na jednu stranu
  const axe = spec.weapon === 'axe', hammer = spec.weapon === 'hammer' || axe, staff = spec.weapon === 'staff';
  const hand = view => Object.assign({}, K8_HAND[view], spec.hand && spec.hand[view]);
  const ORB_T = 9.6; // stred ohnivej gule na palici (vzdialenosť od ruky)
  const HEAD_T = 7.6; // stred hlavy kladiva (vzdialenosť od ruky)
  // ohnivá guľa: žltý stred s bielym leskom, oranžový okraj; ako zoznam pixelov okolo stredu
  const orb = (cx, cy, out, dim) => {
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const d = Math.hypot(ox, oy);
      if (d > 1.6) continue;
      out.push([Math.round(cx) + ox, Math.round(cy) + oy, dim ? (d < 0.5 ? col('G') : col('f')) : ox === -1 && oy === -1 ? col('W') : d < 1.1 ? col('y') : col('f')]);
    }
  };
  // jedna snímka: telo + nohy + meč pod daným uhlom; vráti pixely
  function frame(view, legRows, ang, lunge) {
    const px = new Array(K8_W * K8_H).fill(null);
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < K8_W && y < K8_H && c) px[y * K8_W + x] = c; };
    const body = spec.body[view].concat(legRows), oy = K8_BY + (lunge ? 1 : 0);
    // zástavy na chrbte (náčelník orkov): od pása vychádzajú dve žrde do V nahor, z vrcholu každej visí zvislo dole
    // úzka oranžová zástava (na vonkajšiu stranu); zozadu sú pred telom (s obrysom aj cez telo), spredu a zboku vytŕčajú spoza neho
    const fl = spec.flag && spec.flag[view];
    const ORA = ['#a84808', '#e87818', '#f8b048'].map(hexRGB);
    const drawFlag = over => {
      const pts = [], cx = K8_BX + fl.x, wy = oy + fl.y1, ty = oy + fl.y0, n = wy - ty;
      const set = (x, y, c) => { const k = pts.findIndex(q => q[0] === x && q[1] === y); if (k >= 0) pts.splice(k, 1); pts.push([x, y, c]); };
      for (const sg of [-1, 1]) {
        const bx = cx + sg * fl.spread;                                   // vrchol žrde
        for (let k = 0; k <= n; k++) set(Math.round(cx + (bx - cx) * k / n), wy - k, col(k === n ? 'e' : k % 4 === 0 ? 'L' : 'l'));
        for (let r = 1; r <= 7; r++) for (let i = 1; i <= 2; i++) {      // úzka zástava visí zvislo dole s cípom na konci
          if (r === 7 && i === 2) continue;
          set(bx + sg * i, ty + r, i === 2 || r === 7 ? ORA[0] : r === 1 ? ORA[2] : ORA[1]);
        }
      }
      const m = new Set(pts.map(([x, y]) => x + ',' + y));
      for (const [x, y] of pts) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!m.has((x + ax) + ',' + (y + ay)) && (over || !px[(y + ay) * K8_W + x + ax])) put(x + ax, y + ay, K);
      for (const [x, y, c] of pts) put(x, y, c);
    };
    if (fl && !fl.front) drawFlag(false);
    body.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== '.') put(K8_BX + c, oy + r, col(row[c])); });
    if (fl && fl.front) drawFlag(true);
    // meč: rukoväť a hlavica za rukou, zlatá záštita, dlhá čepeľ s lesklou hranou (bez meča = snímka švihu, meč nahradí efekt)
    const h = hand(view), hx = h.x, hy = h.y + (lunge ? 1 : 0);
    if (ang == null) { put(hx, hy, col('s')); return px; }
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const sw = [];
    const sp = (x, y, c) => sw.push([Math.round(x), Math.round(y), c]);
    const add = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (!sw.some(q => q[0] === x && q[1] === y)) sw.push([x, y, c]); };
    if (staff) { // palica: drevená tyč (kus aj pod rukou), hore zlatá objímka a ohnivá guľa
      for (let t = -4; t <= 8; t += 0.25) add(hx + dx * t, hy + dy * t, t > 7.5 ? col('G') : t < -3.5 ? col('L') : col('l'));
      const o = []; orb(hx + dx * ORB_T, hy + dy * ORB_T, o);
      for (const [x, y, c] of o) { const i = sw.findIndex(q => q[0] === x && q[1] === y); if (i >= 0) sw[i][2] = c; else sw.push([x, y, c]); }
    } else if (axe) { // sekera: drevené porisko, na konci široká železná čepeľ s lesklým ostrím a kosteným hrotom
      for (let t = -1; t <= 7; t += 0.25) add(hx + dx * t, hy + dy * t, t > 6.5 ? col('e') : col('l'));
      for (let t = 4; t <= 7; t += 0.25) for (let o = 0.75; o <= 3.4 - Math.abs(t - 5.5) * 0.5; o += 0.4)
        add(hx + dx * t - dy * o, hy + dy * t + dx * o, o > 2.6 - Math.abs(t - 5.5) * 0.5 ? col('w') : col('m'));
    } else if (hammer) { // bojové kladivo: dlhá drevená násada so zlatou hlavicou, na konci oceľová hlava naprieč
      add(hx - dx * 2, hy - dy * 2, col('g'));
      for (let t = -1; t <= 6; t += 0.25) add(hx + dx * t, hy + dy * t, t > 5 ? col('G') : col('l'));
      for (let t = 6.5; t <= 8.75; t += 0.25) for (let o = -2.2; o <= 2.2; o += 0.4)
        add(hx + dx * t - dy * o, hy + dy * t + dx * o, t >= 8.25 ? col('M') : o < -1.2 ? col('w') : col('m'));
    } else {
    sp(hx - dx * 2, hy - dy * 2, col('g'));                       // hlavica
    sp(hx - dx, hy - dy, col('L'));                               // rukoväť
    for (let k = -2; k <= 2; k++) sp(hx + dx + -dy * k, hy + dy + dx * k, k ? col('G') : col('g')); // záštita naprieč
    // čepeľ: hustá vzorkovanie po dĺžke aj šírke, aby v šikmých smeroch neostali diery (inak by ich vyplnil čierny obrys)
    for (let t = 2; t <= 10; t += 0.25) for (const o of [0, 0.45, 0.9]) {
      const x = Math.round(hx + dx * t - dy * o), y = Math.round(hy + dy * t + dx * o);
      if (sw.some(q => q[0] === x && q[1] === y)) continue;
      sw.push([x, y, o > 0.6 ? col('m') : t >= 9 ? col('W') : col('w')]);
    }
    }
    // obrys meča (len okolo neho, telo má vlastný)
    const sm = new Map(sw.map(([x, y, c]) => [x + ',' + y, c]));
    for (const [key] of sm) {
      const [x, y] = key.split(',').map(Number);
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!sm.has((x + ax) + ',' + (y + ay)) && !px[(y + ay) * K8_W + (x + ax)]) put(x + ax, y + ay, K);
    }
    for (const [key, c] of sm) { const [x, y] = key.split(',').map(Number); put(x, y, c); }
    put(hx, hy, col('s')); // päsť
    return px;
  }
  function toSprite(px, flip) {
    const c = document.createElement('canvas'); c.width = K8_W; c.height = K8_H;
    const cx = c.getContext('2d'), id = cx.createImageData(K8_W, K8_H);
    for (let y = 0; y < K8_H; y++) for (let x = 0; x < K8_W; x++) {
      const v = px[y * K8_W + (flip ? K8_W - 1 - x : x)];
      if (!v) continue;
      const i = (y * K8_W + x) * 4; id.data[i] = v[0]; id.data[i + 1] = v[1]; id.data[i + 2] = v[2]; id.data[i + 3] = 255;
    }
    cx.putImageData(id, 0, 0);
    return spriteFromPixels(c);
  }
  function views(view) {
    const h = hand(view), L = K8_LEGS[h.legs];
    const atkAng = h.atk;
    // v momente švihu: meč nahradí svetelný oblúk; kladivo ostane dopadnuté vpredu (hra pridá náraz);
    // palica je vystrčená dopredu a z gule na jej konci vyletí ohnivá strela (tip = miesto gule voči chodidlám)
    const slashAng = hammer ? atkAng[2] : staff ? atkAng[1] : null;
    const tip = flip => {
      // palica: guľa pri výstrele; kladivo: hlava v momente dopadu (tam vznikne tlaková vlna)
      const ta = hammer ? atkAng[2] : atkAng[1], tl = hammer ? HEAD_T : ORB_T;
      const x = h.x + Math.cos(ta) * tl, y = h.y + 1 + Math.sin(ta) * tl;
      return { x: (flip ? K8_W - 1 - x : x) - K8_W / 2 + 0.5, y: y - (K8_H - K8_PB) };
    };
    const mk = flip => ({
      idle: toSprite(frame(view, L.idle, h.idle), flip),
      walk: L.walk.map((lr, i) => toSprite(frame(view, lr, h.idle + (i % 2 ? 0.08 : -0.08)), flip)),
      atk: atkAng.map((a, i) => toSprite(frame(view, L.idle, a, i === 1), flip)),
      slash: toSprite(frame(view, L.idle, slashAng, true), flip),
      tip: tip(flip),
    });
    return { n: mk(false), m: mk(true) };
  }
  // porazený hrdina spredu: kľačí so sklonenou hlavou a obe ruky opiera o zbraň pred sebou –
  // meč je zapichnutý do zeme, kladivo stojí na hlave
  function kneel() {
    const px = new Array(K8_W * K8_H).fill(null);
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < K8_W && y < K8_H && c) px[y * K8_W + x] = c; };
    const body = spec.kneel, oy = K8_H - body.length - KNEEL_DY; // pod kolenami ostáva miesto na zbraň opretú o zem pred ním
    body.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== '.') put(K8_BX + c, oy + r, col(row[c])); });
    const hx = K8_BX + 7, hy = oy + 7; // ruky na zbrani pri opasku, tvár ostane voľná
    const sw = [];
    const sx = K8_BX - 1; // palica stojí v zemi pri jej boku, aby guľa nezakryla sklonenú hlavu
    if (staff) { // zhasnutá guľa vo výške hlavy, palica až do zeme
      for (let y = oy + 2; y < K8_H - KNEEL_DY; y++) sw.push([sx, y, col(y < oy + 3 ? 'G' : 'l')]);
      orb(sx, oy, sw, true);
    } else if (hammer) {
      sw.push([hx - 1, hy - 1, col('g')], [hx, hy - 1, col('G')]); // hlavica násady
      for (let y = hy + 1; y < K8_H - 3; y++) sw.push([hx - 1, y, col('l')], [hx, y, col('L')]); // násada
      for (let x = hx - 3; x <= hx + 2; x++) sw.push([x, K8_H - 3, col('w')], [x, K8_H - 2, col('m')], [x, K8_H - 1, col('M')]); // hlava kladiva na zemi
    } else {
      sw.push([hx, hy - 2, col('g')], [hx - 1, hy - 2, col('g')], [hx, hy - 1, col('L')], [hx - 1, hy - 1, col('L')]); // hlavica, rukoväť
      for (let x = hx - 3; x <= hx + 2; x++) sw.push([x, hy + 1, x === hx - 1 || x === hx ? col('g') : col('G')]); // záštita
      for (let y = hy + 2; y < K8_H; y++) sw.push([hx - 1, y, col('w')], [hx, y, col('m')]); // čepeľ až do zeme
    }
    const sm = new Map(sw.map(([x, y, c]) => [x + ',' + y, c]));
    for (const [key] of sm) { // obrys meča – aj cez telo, aby sa meč od neho oddelil
      const [x, y] = key.split(',').map(Number);
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!sm.has((x + ax) + ',' + (y + ay))) put(x + ax, y + ay, K);
    }
    for (const [key, c] of sm) { const [x, y] = key.split(',').map(Number); put(x, y, c); }
    if (staff) { put(sx, hy, col('s')); put(sx + 1, hy, col('s')); } // ruka na palici
    else {
      put(hx - 2, hy, col('s')); put(hx + 1, hy, col('s')); put(hx - 1, hy, col('s')); put(hx, hy, col('s')); // päste
      put(hx - 3, hy, K); put(hx + 2, hy, K);
    }
    if (!hammer && !staff) for (let x = hx - 3; x <= hx + 2; x++) put(x, K8_H - 1, x === hx - 3 || x === hx + 2 ? [106, 78, 52] : [74, 52, 34]); // hlina okolo zabodnutej čepele
    return px;
  }
  const v = { N: views('N'), NE: views('NE'), E: views('E'), SE: views('SE'), S: views('S') };
  // 0 E, 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE
  const all = [v.E.n, v.SE.n, v.S.n, v.SE.m, v.E.m, v.NE.m, v.N.n, v.NE.n];
  all.kneel = toSprite(kneel(), false);
  return all;
}
// sprite (s bielym zábleskom a siluetou) z hotového plátna
// sprite z hotového plátna; biely záblesk pri zásahu (obrys ostáva) a sivá silueta (zamknuté veci) sa vyrobia
// až pri prvom použití – väčšina snímok ich nikdy nepotrebuje a ich výroba vopred spomaľovala štart hry
function spriteFromPixels(c) { return lazyVariants({ c, w: c.width, h: c.height }); }
function variantCanvas(src, col) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data, K = hexRGB(PAL.K);
  const x = document.createElement('canvas'); x.width = w; x.height = h;
  const xc = x.getContext('2d'), od = xc.createImageData(w, h), o = od.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const isK = d[i] === K[0] && d[i + 1] === K[1] && d[i + 2] === K[2];
    o[i] = isK ? K[0] : col[0]; o[i + 1] = isK ? K[1] : col[1]; o[i + 2] = isK ? K[2] : col[2]; o[i + 3] = 255;
  }
  xc.putImageData(od, 0, 0);
  return x;
}
function lazyVariants(spr) {
  let f = null, sil = null;
  Object.defineProperty(spr, 'f', { get: () => f || (f = variantCanvas(spr.c, [255, 255, 255])), enumerable: true });
  Object.defineProperty(spr, 'sil', { get: () => sil || (sil = variantCanvas(spr.c, [51, 51, 68])), enumerable: true });
  return spr;
}
// veľké sady snímok (8 smerov) sa vyrobia až pri prvom použití alebo počas načítavania po kúskoch (SPR_TASKS),
// aby sa štart nezasekol; build vráti hotovú sadu, ktorá sa potom uloží namiesto čakajúcej vlastnosti
const SPR_TASKS = [];
function lazySpr(key, build) {
  Object.defineProperty(SPR, key, { configurable: true, enumerable: true, get() {
    const v = build();
    Object.defineProperty(SPR, key, { value: v, writable: true, configurable: true, enumerable: true });
    return v;
  } });
  SPR_TASKS.push(key);
}

// ---- Jednotky v 8 smeroch (rytier) ----
// Postava sa skladá z vrstiev – nohy, štít, telo, meč – a každá dostane vlastný obrys, takže štít a meč sa od tela oddelia.
// Chôdza má 4 snímky: v dvojopore (oba chodidlá na zemi) telo klesne o bod, v prekročení sa zdvihne;
// meč a štít sa kývu proti krokom. Kreslí sa 5 pohľadov, ostatné 3 sú zrkadlové (ako pri hrdinoch).
const U8_W = 32, U8_H = 26, U8_PB = 4; // U8_PB = prázdne riadky pod chodidlami (miesto na meč pri údere)
const KN8_BODY = { // 14×9 bez obrysu (dopočíta sa): modrý chochol, oceľová prilba, modrý tabard so zlatým opaskom
  S: [ // spredu – priezor so štrbinou, zlatý nánosník
    '.....cBBn.....',
    '....wmcBnM....',
    '....mKKKKD....',
    '....mmgmMD....',
    '..wmMMDDMMmD..',
    '..mMcBBBBnMD..',
    '..MDgggGGGMD..',
    '..s.cBgBBn.s..',
    '....cBBBBn....',
  ],
  SE: [ // šikmo spredu – priezor natočený doprava
    '......cBBn....',
    '.....wmcBnM...',
    '....mmKKKKD...',
    '....mmmmgMD...',
    '..wmMMDDDMmD..',
    '..mMcBBBBnMD..',
    '..MDggggGGMD..',
    '..s.cBBgBn....',
    '....cBBBBn....',
  ],
  E: [ // z boku – chochol veje dozadu, štrbina priezoru vpredu, ruka s mečom pri boku
    '....nBBBc.....',
    '....nwmmmM....',
    '.....mmmKKK...',
    '.....MmmmmD...',
    '....wmMMMD....',
    '....mMcBBn....',
    '....MDggGG....',
    '.....scBBn....',
    '.....cBBBn....',
  ],
  NE: [ // šikmo zozadu – chochol stečie po temene, vpravo kúsok líca prilby
    '......cBBn....',
    '.....wmcBnM...',
    '....mmmmmMm...',
    '....MMMMMDD...',
    '..wmMMMMDDmD..',
    '..mMcBBBBnMD..',
    '..MDgggGGGMD..',
    '..m.cBBBBn.s..',
    '....cBBBBn....',
  ],
  N: [ // zozadu – chochol po strede prilby, tabard cez chrbát
    '.....cBBn.....',
    '....wmcBnM....',
    '....mmmmMD....',
    '....MMMMDD....',
    '..wmMMMMDDmD..',
    '..mMcBBBBnMD..',
    '..MDgggGGGMD..',
    '..m.cBBBBn.s..',
    '....cBBBBn....',
  ],
};
// štít: x, y v súradniciach tela; front = pred telom (inak za ním); zboku drží štít pred sebou, spredu modrý so zlatým krížom, zozadu drevo s oceľovým lemom
const KN8_SHIELD = {
  S:  { x: 9, y: 4, front: true, rows: ['cBgBn', 'ggggG', 'cBgBn', '.BgB.', '..n..'] },
  SE: { x: 10, y: 4, front: true, rows: ['cgBn', 'gggG', 'cgBn', '.gB.', '..n.'] },
  E:  { x: 9, y: 4, front: true, rows: ['cBn', 'gGn', 'cBn', '.Bn', '.n.'] },
  NE: { x: 0, y: 4, front: true, rows: ['mLLM', 'mLlM', 'mLLM', '.LM.', '..M.'] },
  N:  { x: 0, y: 4, front: true, rows: ['mLLLM', 'mLlLM', 'mLLLM', '.MLM.', '..M..'] },
};
// nohy (3 riadky pod telom, horný zakryje telo, keď klesne): postoj a 4 snímky chôdze –
// dvojopora, prekročenie (zdvihnutá noha o bod vyššie), dvojopora na druhú nohu, prekročenie
const KN8_LEGS = {
  front: {
    idle: ['....mD..mD....', '....mD..mD....', '....lL..lL....'],
    walk: [
      ['....mD..mD....', '....mD..mD....', '....lL..dL....'],
      ['....mD..mD....', '....mD..lL....', '....lL........'],
      ['....mD..mD....', '....mD..mD....', '....dL..lL....'],
      ['....mD..mD....', '....lL..mD....', '........lL....'],
    ],
  },
  side: { // bližšia noha svetlá (m), vzdialenejšia tmavšia (M); špička topánky smeruje doprava
    idle: ['.....MmD......', '.....MmD......', '.....lLLL.....'],
    walk: [
      ['.....MmD......', '....MD.mD.....', '...dL...lLL...'],
      ['.....mDMD.....', '.....mD.dL....', '.....lLL......'],
      ['.....mMD......', '....mD.MD.....', '...lL...dLL...'],
      ['.....MDmD.....', '.....MD.lL....', '.....dLL......'],
    ],
  },
};
// ruka s mečom (súradnice v tele), uhol meča v postoji a pri údere (napriahnutie, švih, dokončenie)
const KN8_HAND = {
  N:  { x: 11, y: 7,  idle: -1.15, atk: [-0.2, -1.5, -2.25], legs: 'front' },
  NE: { x: 11, y: 7,  idle: -1.0,  atk: [-1.95, -0.75, 0.05], legs: 'front' },
  E:  { x: 5,  y: 7,  idle: -2.1,  atk: [-2.5, -0.5, 0.5],    legs: 'side' }, // zboku má meč opretý o plece
  SE: { x: 2,  y: 7,  idle: -2.2,  atk: [-2.55, 3.1, 2.4],    legs: 'front' },
  S:  { x: 2,  y: 7,  idle: -2.05, atk: [-2.45, 3.0, 2.3],    legs: 'front' },
};
function buildUnit8(spec) {
  // plátno: jazdec na koni potrebuje väčšie (W, H v spec); BX = ľavý okraj tela postavy (14 bodov) v strede plátna
  const W = spec.W || U8_W, H = spec.H || U8_H, BX0 = (W - 14) >> 1, K = hexRGB(PAL.K), feet = H - U8_PB - 1;
  const FIST = spec.fist || 's'; // farba päste (orkovia majú zelenú)
  const col = ch => hexRGB((spec.pal && spec.pal[ch]) || PAL[ch]);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const grid = (rows, ox, oy) => {
    const o = [];
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') o.push([ox + i, oy + j, col(r[i])]); });
    return o;
  };
  // jedna snímka; bob = telo nižšie o bod, sw = kývnutie štítu (luku), lunge = výpad pri údere;
  // pose = uhol meča, pri luku stav: 'low' (spustený pri boku), 'draw' (napnutá tetiva so šípom), 'loose' (po výstrele)
  function frame(view, legRows, bob, pose, lunge, sw) {
    const BX = BX0 - ((spec.body[view][0].length - 14) >> 1); // širšia postava (surovec) ostane v strede plátna
    const px = new Array(W * H).fill(null);
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c; };
    // vrstva s obrysom; over = obrys smie prekresliť to, čo je pod ním (oddelí štít od tela)
    const layer = (pts, over) => {
      const m = new Set(pts.map(([x, y]) => x + ',' + y));
      for (const [x, y] of pts) for (const [ax, ay] of N4) {
        const nx = x + ax, ny = y + ay;
        if (!m.has(nx + ',' + ny) && (over || !px[ny * W + nx])) put(nx, ny, K);
      }
      for (const [x, y, c] of pts) put(x, y, c);
    };
    const line = (x0, y0, x1, y1, c, out) => { // čiara bod po bode (tetiva, šíp)
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) out.push([Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), typeof c === 'function' ? c(i, n) : c]);
    };
    const lt = feet - legRows.length + 1, body = spec.body[view], mnt = spec.mount && spec.mount[view];
    let top = lt - 1 - body.length + bob + (lunge ? 1 : 0), head = null;
    if (mnt) { // kôň: vzdialenejšie nohy (L, K) ako samostatná vrstva vzadu, potom bližšie nohy, hlava za jazdcom a trup;
      // jazdec sedí tak, že jeho posledný riadok je na riadku seat trupu koňa
      const hx0 = BX + mnt.x, ht = lt - mnt.body.length + bob;
      const far = spec.far || 'LK'; // znaky vzdialenejších nôh (vlk má šedé)
      layer(grid(legRows.map(r => r.replace(new RegExp('[^' + far + ']', 'g'), '.')), hx0, lt), false);
      if (mnt.head) head = grid(mnt.head.rows, hx0 + mnt.head.x, ht + mnt.head.y);
      if (head && !mnt.head.front) layer(head, false);
      layer(grid(legRows.map(r => r.replace(new RegExp('[' + far + ']', 'g'), '.')), hx0, lt), false);
      layer(grid(mnt.body, hx0, ht), false);
      top = ht + mnt.seat - body.length + 1 + (lunge ? 1 : 0);
    } else layer(grid(legRows, BX, lt), false);
    const sh = spec.shield && spec.shield[view], side = view === 'E'; // zboku sa štít kýve dopredu a dozadu, inak hore a dole
    const shield = sh && grid(sh.rows, BX + sh.x + (side ? sw : 0), top + sh.y + (side ? 0 : sw));
    // luk: zvislý oblúk vypuklý k cieľu, tetiva od koncov k ruke, ktorá ju napína; spustený luk drží pri boku
    const bw = spec.bow && spec.bow[view], thrust = typeof pose === 'object'; // kopija sklopená k útoku
    const aiming = bw ? pose !== 'low' : thrust;
    let bowPts = null;
    const strPts = [], hands = [];
    if (bw) {
      const g = aiming ? bw.aim : bw.low, gx = BX + g.x, gy = top + g.y + (aiming ? 0 : sw), bend = aiming ? bw.bend : bw.lowBend;
      bowPts = [];
      for (let y = -4; y <= 4; y++) bowPts.push([gx + bend * Math.round(1.2 * (1 - (y / 4) ** 2)), gy + y, col(Math.abs(y) === 4 ? 'd' : y === 0 ? 'L' : 'l')]);
      const px0 = BX + bw.pull.x - (pose === 'loose' ? Math.sign(bw.pull.x - bw.aim.x) : 0), py0 = top + bw.pull.y;
      if (pose === 'draw') { line(gx, gy - 3, px0, py0, col('e'), strPts); line(px0, py0, gx, gy + 3, col('e'), strPts); }
      else if (bend) line(gx, gy - 3, gx, gy + 3, col('e'), strPts);
      if (pose === 'draw' && bw.tip) line(px0, py0, BX + bw.tip.x, top + bw.tip.y, (i, n) => col(i === n ? 'W' : i === 0 ? 'r' : 'l'), strPts);
      hands.push([gx + bend, gy]);
      if (aiming) hands.push([px0, py0]);
    }
    const front = bw ? (aiming ? bw.front : bw.lowFront) : true;
    const drawBow = () => { layer(bowPts, true); for (const [x, y, c] of strPts) put(x, y, c); };
    if (sh && !sh.front) layer(shield, false);
    if (bw && !front) drawBow();
    // pri mierení ruky nevisia pri boku (päste na konci rukávov zmiznú)
    layer(grid(aiming ? body.map((r, j) => j === body.length - 2 ? r.replace(/s/g, '.') : r) : body, BX, top), !!mnt); // jazdec s obrysom aj cez koňa
    if (sh && sh.front) layer(shield, true);
    if (head && mnt.head.front) layer(head, true); // hlava koňa pred jazdcom (spredu)
    if (bw && front) drawBow();
    for (const [x, y] of hands) put(x, y, col(FIST));
    if (bw || spec.noWeapon) return px; // podkopník nesie bombu v rukách (je v kresbe tela)
    if (spec.spear) { // kopija: drevené ratište s tmavou pätkou a oceľovým hrotom; k = skrátenie, keď mieri k divákovi či od neho
      const h = spec.hand[view], sp = thrust ? pose : { a: pose, k: 1, push: 0 }, k = sp.k;
      const dx = Math.cos(sp.a) * k, dy = Math.sin(sp.a) * k;
      const hx = BX + (thrust ? h.ax : h.x) + dx * sp.push, hy = top + (thrust ? h.ay : h.y) + dy * sp.push;
      const pts = [];
      for (let t = -4; t <= spec.spear; t += 0.25) {
        const x = Math.round(hx + dx * t), y = Math.round(hy + dy * t);
        if (pts.some(q => q[0] === x && q[1] === y)) continue;
        const tp = spec.tip || ['W', 'w']; // hrot (pri šamanovej palici svietiaca guľa)
        pts.push([x, y, col(t >= spec.spear - 0.25 ? tp[0] : t >= spec.spear - 2 ? tp[1] : t <= -3.5 ? 'd' : 'l')]);
      }
      if (spec.pennant) { // zástavka pod hrotom: modré súkno so zlatým lemom, visí na stranu od ratišťa
        const px = -dy, py = dx, sg = py < 0 ? -1 : 1; // kolmica k ratišťu, vždy smerom nadol
        for (let t = spec.spear - 4.5; t <= spec.spear - 1.5; t += 0.5) for (let o = 1; o <= 3 - (t - spec.spear + 4.5) * 0.5; o++) {
          const x = Math.round(hx + dx * t + px * o * sg), y = Math.round(hy + dy * t + py * o * sg);
          if (!pts.some(q => q[0] === x && q[1] === y)) pts.push([x, y, col(o === 1 ? 'g' : 'B')]);
        }
      }
      layer(pts, false);
      put(Math.round(hx), Math.round(hy), col(FIST)); // päsť
      if (thrust) put(Math.round(hx + dx * 3), Math.round(hy + dy * 3), col(FIST)); // pri bodnutí drží ratište oboma rukami
      return px;
    }
    // meč: hlavica, rukoväť, záštita naprieč a čepeľ s lesklou hranou
    const ang = pose, h = spec.hand[view], hx = BX + h.x, hy = top + h.y, dx = Math.cos(ang), dy = Math.sin(ang);
    const pts = [], add = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (!pts.some(q => q[0] === x && q[1] === y)) pts.push([x, y, c]); };
    if (spec.axe) { // sekera: drevené porisko, na konci železná čepeľ na jednu stranu so svetlým ostrím
      const [len, wd] = spec.axe;
      for (let t = -1; t <= len; t += 0.25) add(hx + dx * t, hy + dy * t, col(t <= -0.75 ? 'd' : 'l'));
      for (let t = len - 2.5; t <= len; t += 0.25) for (let o = 0.75; o <= wd; o += 0.25)
        add(hx + dx * t - dy * o, hy + dy * t + dx * o, col(o > wd - 0.6 ? 'w' : t > len - 0.6 ? 'M' : 'm'));
      layer(pts, false);
      put(hx, hy, col(FIST));
      return px;
    }
    add(hx - dx * 2, hy - dy * 2, col('g'));
    add(hx - dx, hy - dy, col('L'));
    for (let k = -1; k <= 1; k++) add(hx + dx - dy * k, hy + dy + dx * k, k ? col('G') : col('g'));
    for (let t = 2; t <= spec.blade; t += 0.25) for (const o of [0, 0.5]) add(hx + dx * t - dy * o, hy + dy * t + dx * o, o ? col('m') : t >= spec.blade - 0.75 ? col('W') : col('w'));
    layer(pts, false);
    put(hx, hy, col(FIST)); // päsť
    return px;
  }
  function toSprite(px, flip) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d'), id = cx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = px[y * W + (flip ? W - 1 - x : x)];
      if (!v) continue;
      const i = (y * W + x) * 4; id.data[i] = v[0]; id.data[i + 1] = v[1]; id.data[i + 2] = v[2]; id.data[i + 3] = 255;
    }
    cx.putImageData(id, 0, 0);
    return spriteFromPixels(c);
  }
  const SWAY = [0.2, 0, -0.2, 0], SHIELD = [1, 0, -1, 0]; // meč a štít sa kývu proti sebe
  function views(view) {
    const h = spec.hand[view], L = spec.legs[h.legs];
    const mk = flip => ({
      idle: toSprite(frame(view, L.idle, 1, spec.bow ? 'low' : h.idle, false, 0), flip),
      walk: L.walk.map((lr, i) => toSprite(frame(view, lr, i % 2 ? 0 : 1, spec.bow ? 'low' : h.idle + SWAY[i], false, SHIELD[i]), flip)),
      atk: spec.bow ? ['draw', 'loose'].map(p => toSprite(frame(view, L.idle, 1, p, false, 0), flip)) // napnutie, výstrel
        : spec.spear ? [-1, 2, 0].map((push, i) => toSprite(frame(view, L.idle, 1, { a: h.aim, k: h.k, push }, i === 1, 0), flip)) // stiahnutie, bodnutie, návrat
        : h.atk.map((a, i) => toSprite(frame(view, L.idle, 1, a, i > 0, 0), flip)),
    });
    return { n: mk(false), m: mk(true) };
  }
  const v = { N: views('N'), NE: views('NE'), E: views('E'), SE: views('SE'), S: views('S') };
  // 0 E, 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE
  const all = [v.E.n, v.SE.n, v.S.n, v.SE.m, v.E.m, v.NE.m, v.N.n, v.NE.n];
  all.stride = spec.stride || 3.2; // prejdená vzdialenosť na snímku chôdze
  return all;
}
const buildKnight8 = pal => buildUnit8({ pal, body: KN8_BODY, shield: KN8_SHIELD, legs: KN8_LEGS, hand: KN8_HAND, blade: 6 });

// lukostrelec: kožená čiapka s červeným perom, modrá tunika, kožený opasok a remeň tulca; tulec so šípmi na chrbte
const AR8_BODY = {
  S: [
    '.....lllLr....',
    '....dlllLLd...',
    '....sKssKS....',
    '....ssssSS....',
    '..cBBBSSBLBn..',
    '..cBcBBBLnBn..',
    '..BnLLLgLLBn..',
    '..s.cBBBBn.s..',
    '....cBBBBn....',
  ],
  SE: [
    '......lllLr...',
    '.....dlllLLd..',
    '.....LsKssKS..',
    '.....LssssSS..',
    '..cBBBBSSBLn..',
    '..cBcBBBBLBn..',
    '..BnLLLLgLBn..',
    '..s.cBBBBn....',
    '....cBBBBn....',
  ],
  E: [
    '....rllllL....',
    '....dllllLLd..',
    '.....LLsKsS...',
    '.....LssssS...',
    '...rwcBBBn....',
    '...wlcBBBn....',
    '....LLLgLL....',
    '.....scBBn....',
    '.....cBBBn....',
  ],
  NE: [
    '.....rlllL....',
    '....dlllLLd...',
    '....LLLLLLsrw.',
    '....SLLLLSlL..',
    '..cBBBBBlLLn..',
    '..cBBBBlLLBn..',
    '..BnLLlLLLBn..',
    '..s.cBBBBn.s..',
    '....cBBBBn....',
  ],
  N: [
    '.....rlllL....',
    '....dlllLLd...',
    '....LLLLLd.wr.',
    '....SLLLdSlL..',
    '..cBBBBBlLLn..',
    '..cBBBBlLLBn..',
    '..BnLLlLLLBn..',
    '..s.cBBBBn.s..',
    '....cBBBBn....',
  ],
};
// luk: low = úchop spusteného luku (v ľavej ruke), aim = úchop zdvihnutého luku, pull = ruka napínajúca tetivu,
// tip = hrot nasadeného šípu, bend = kam je luk vypuklý (k cieľu), front = luk pred telom
const AR8_BOW = {
  S:  { low: { x: 12, y: 6 }, lowBend: 0, lowFront: true, aim: { x: 10, y: 4 }, pull: { x: 8, y: 4 }, tip: { x: 10, y: 6 }, bend: 0, front: true },
  SE: { low: { x: 12, y: 6 }, lowBend: 1, lowFront: true, aim: { x: 12, y: 4 }, pull: { x: 9, y: 4 }, tip: { x: 15, y: 5 }, bend: 1, front: true },
  E:  { low: { x: 10, y: 6 }, lowBend: 1, lowFront: true, aim: { x: 12, y: 3 }, pull: { x: 8, y: 3 }, tip: { x: 15, y: 3 }, bend: 1, front: true },
  NE: { low: { x: 1, y: 6 },  lowBend: 0, lowFront: true, aim: { x: 11, y: 1 }, pull: { x: 8, y: 3 }, tip: { x: 13, y: 0 }, bend: 1, front: false },
  N:  { low: { x: 1, y: 6 },  lowBend: 0, lowFront: true, aim: { x: 5, y: 0 },  pull: { x: 10, y: 3 }, bend: 0, front: false },
};
const AR8_HAND = { N: { legs: 'front' }, NE: { legs: 'front' }, E: { legs: 'side' }, SE: { legs: 'front' }, S: { legs: 'front' } };
// nohy ako rytier, len v modrých nohaviciach namiesto plátov
const legsCloth = L => {
  const re = r => r.replace(/m/g, 'B').replace(/[MD]/g, 'n');
  return { idle: L.idle.map(re), walk: L.walk.map(f => f.map(re)) };
};
const buildArcher8 = pal => buildUnit8({ pal, body: AR8_BODY, bow: AR8_BOW, hand: AR8_HAND, legs: { front: legsCloth(KN8_LEGS.front), side: legsCloth(KN8_LEGS.side) } });

// kopijník: oceľový klobúk so širokou strechou, krúžkový golier, modrý prešívaný kabec s koženým opaskom
const SP8_BODY = {
  S: [
    '.....wmmM.....',
    '...wmmmmmmD...',
    '....SsssSS....',
    '....sKssKS....',
    '..cBMmmMMDBn..',
    '..cBcBcBnBBn..',
    '..BnLLgLLLBn..',
    '..s.cBcBBn.s..',
    '....cBnBBn....',
  ],
  SE: [
    '......wmmM....',
    '....wmmmmmmD..',
    '.....LSsssS...',
    '.....LsKssK...',
    '..cBMMmmMDBn..',
    '..cBcBcBnBBn..',
    '..BnLLLgLLBn..',
    '..s.cBcBBn....',
    '....cBnBBn....',
  ],
  E: [
    '.....wmmM.....',
    '...wmmmmmmD...',
    '.....LLsssS...',
    '.....LLsKs....',
    '....cMmmMD....',
    '....cBcBBn....',
    '....LLLgLL....',
    '.....sBcBn....',
    '.....cBnBn....',
  ],
  NE: [
    '.....wmmM.....',
    '...wmmmmmmD...',
    '....LLLLLLs...',
    '....LLLLLSs...',
    '..cBMmmMMDBn..',
    '..cBcBcBnBBn..',
    '..BnLLLLLLBn..',
    '..s.cBcBBn.s..',
    '....cBnBBn....',
  ],
  N: [
    '.....wmmM.....',
    '...wmmmmmmD...',
    '....LLLLLL....',
    '....LLLLLd....',
    '..cBMmmMMDBn..',
    '..cBcBcBnBBn..',
    '..BnLLLLLLBn..',
    '..s.cBcBBn.s..',
    '....cBnBBn....',
  ],
};
// ruka s kopijou: x, y v pokoji (ratište zvislo, pätka na zemi), ax, ay pri bodnutí (ruky pred hruďou),
// aim = smer bodnutia, k = skrátenie kopije mieriacej k divákovi alebo od neho
const SP8_HAND = {
  N:  { x: 11, y: 7, idle: -1.5,  ax: 9, ay: 4, aim: -1.3,  k: 0.75, legs: 'front' },
  NE: { x: 11, y: 7, idle: -1.45, ax: 9, ay: 5, aim: -0.7,  k: 0.75, legs: 'front' },
  E:  { x: 5,  y: 7, idle: -1.4,  ax: 7, ay: 5, aim: 0.08,  k: 1,    legs: 'side' },
  SE: { x: 2,  y: 7, idle: -1.7,  ax: 7, ay: 5, aim: 0.75,  k: 0.75, legs: 'front' },
  S:  { x: 2,  y: 7, idle: -1.65, ax: 6, ay: 5, aim: 1.25,  k: 0.75, legs: 'front' },
};
const buildSpear8 = pal => buildUnit8({ pal, body: SP8_BODY, hand: SP8_HAND, spear: 10, legs: { front: legsCloth(KN8_LEGS.front), side: legsCloth(KN8_LEGS.side) } });

// jazdec: hnedý kôň v modrej čabraku so zlatým lemom, na ňom rytier (prilba a trup ako pešiak) so štítom a kopijou.
// Kôň: trup v riadkoch, hlava ako samostatná vrstva (spredu je pred jazdcom, zozadu za ním).
// Nohy koňa: l = bližšie, L = vzdialenejšie (kreslia sa vzadu), d / K = kopytá; klus ide v diagonálnych pároch nôh.
// e = biela lysina na čele koňa
const RD8_HORSE = {
  S: { x: 0, seat: 3, legs: 'front', body: [
    '...cBBBBBBn...',
    '..cBBBBBBBBn..',
    '..cBBBBBBBBn..',
    '..cBBlllLBBn..',
    '..cBBllLLBBn..',
    '..gGgllLLgGg..',
  ], head: { x: 5, y: 1, front: true, rows: ['d..d', 'lelL', 'KeLK', 'lelL', 'lelL', 'lLLL', '.dd.'] } },
  SE: { x: 0, seat: 3, legs: 'diag', body: [
    '.cBBBBBBn.....',
    'cBBBBBBBBBn...',
    'cBBBBBBBBBBn..',
    'cBBBBBBBlllL..',
    'cBBBBBBBllLL..',
    'gGgGgGgGllLL..',
  ], head: { x: 8, y: 0, front: true, rows: ['d..d', 'lelL', 'KeLK', 'lelL', 'lelL', 'lLLL', '.dd.'] } },
  E: { x: -1, seat: 8, legs: 'side', body: [ // z boku – hlava vpravo, chvost vľavo
    '...............d.d.',
    '..............dllL.',
    '.............ddlKlL',
    '............ddllllL',
    '...........ddlllLL.',
    '..........ddllll...',
    '.ddcBBBBBBBcllll...',
    'dd.cBBBBBBBBcllL...',
    'd..cBBBBBBBBBcLL...',
    'd..cBBBBBBBBBnLL...',
    '...gGgGgGgGgGgL....',
  ] },
  NE: { x: 0, seat: 3, legs: 'diag', body: [
    '.....cBBBBn...',
    '...cBBBBBBBn..',
    '..cBBBBBBBBn..',
    '..cBddBBBBBn..',
    '..cBddBBBBn...',
    '..gGddgGgG....',
  ], head: { x: 10, y: -5, front: false, rows: ['.d.d', '.lLd', 'lllL', 'llLL', 'lLL.', 'lL..'] } },
  N: { x: 0, seat: 3, legs: 'back', body: [ // zozadu – zadok koňa s chvostom, hlavu skryje jazdec
    '...cBBBBBBn...',
    '..cBBBBBBBBn..',
    '..cBBBBBBBBn..',
    '..cBBBddBBBn..',
    '..cBBBddBBBn..',
    '..gGgGddgGgG..',
  ] },
};
const RD8_LEGS = { // spredu a zozadu len dve bližšie nohy (vzdialenejšie by robili z koňa pavúka); postoj a 4 snímky klusu: diagonálny pár dvihne kopytá, prekročenie, druhý pár, prekročenie
  front: {
    idle: ['....ll..ll....', '....ll..ll....', '....ll..ll....', '....dd..dd....'],
    walk: [
      ['....ll..ll....', '....dd..ll....', '........ll....', '........dd....'],
      ['....ll..ll....', '....ll..ll....', '....ll..ll....', '....dd..dd....'],
      ['....ll..ll....', '....ll..dd....', '....ll........', '....dd........'],
      ['....ll..ll....', '....ll..ll....', '....ll..ll....', '....dd..dd....'],
    ],
  },
  back: { // zozadu medzi nohami visí chvost
    idle: ['....llddll....', '....ll.dll....', '....ll..ll....', '....dd..dd....'],
    walk: [
      ['....llddll....', '....dd.dll....', '........ll....', '........dd....'],
      ['....llddll....', '....ll.dll....', '....ll..ll....', '....dd..dd....'],
      ['....llddll....', '....ll.ddd....', '....ll........', '....dd........'],
      ['....llddll....', '....ll.dll....', '....ll..ll....', '....dd..dd....'],
    ],
  },
  diag: {
    idle: ['.L.ll...ll.L..', '.L.ll...ll.L..', '.L.ll...ll.L..', '.K.dd...dd.K..'],
    walk: [
      ['.L.ll...ll.L..', '.L.ll...dd.L..', '.K.ll......L..', '...dd......K..'],
      ['.L.ll...ll.L..', '.L.ll...ll.L..', '.L.ll...ll.L..', '.K.dd...dd.K..'],
      ['.L.ll...ll.L..', '.L.dd...ll.L..', '.L......ll.K..', '.K......dd....'],
      ['.L.ll...ll.L..', '.L.ll...ll.L..', '.L.ll...ll.L..', '.K.dd...dd.K..'],
    ],
  },
  side: {
    idle: ['...ll.L....L.ll....', '...ll.L....L.ll....', '...ll.L....L.ll....', '...dd.K....K.dd....'],
    walk: [
      ['...ll.L....L.ll....', '...ll..L...L..ll...', '...ll..K...L..dd...', '...dd......K.......'],
      ['...ll.L....L.ll....', '...ll.L....L.ll....', '...ll.L....L.ll....', '...dd.K....K.dd....'],
      ['...ll.L....L.ll....', '....llL.....Lll....', '....ddL.....Kll....', '......K......dd....'],
      ['...ll.L....L.ll....', '...ll.L....L.ll....', '...ll.L....L.ll....', '...dd.K....K.dd....'],
    ],
  },
};
// jazdec = horná polovica pešieho rytiera (chochol až opasok) a nohy v strmeňoch po bokoch koňa
const RD8_BODY = {};
for (const v of ['S', 'SE', 'E', 'NE', 'N'])
  RD8_BODY[v] = KN8_BODY[v].slice(0, 7).concat(v === 'E' ? ['......mD......', '......MD......'] : ['.mD........mD.', '.MD........MD.']);
// ruka s kopijou: v pokoji zvislo, pri útoku sklopená a vystrčená dopredu (ako kopijník, len dlhšia)
const RD8_HAND = {
  N:  { x: 12, y: 6, idle: -1.5,  ax: 10, ay: 5, aim: -1.3, k: 0.75, legs: 'back' },
  NE: { x: 12, y: 6, idle: -1.45, ax: 10, ay: 5, aim: -0.7, k: 0.8,  legs: 'diag' },
  E:  { x: 8,  y: 5, idle: -1.5,  ax: 8,  ay: 4, aim: 0.05, k: 1,    legs: 'side' },
  SE: { x: 1,  y: 6, idle: -1.7,  ax: 6,  ay: 6, aim: 0.75, k: 0.8,  legs: 'diag' },
  S:  { x: 1,  y: 6, idle: -1.65, ax: 4,  ay: 6, aim: 1.25, k: 0.75, legs: 'front' },
};
const buildRider8 = pal => buildUnit8({ pal, W: 40, H: 30, body: RD8_BODY, mount: RD8_HORSE, shield: KN8_SHIELD, hand: RD8_HAND, legs: RD8_LEGS, spear: 12, stride: 5 });
// nepriatelia za orkov (len jednotky z ľudských budov): ťažký rytier v tmavej oceli a kapitán jazdy v pozlátenej zbroji
const PAL_HKNIGHT = { w: '#bcc0cc', m: '#80869a', M: '#4a4e60', D: '#2a2c38' };
// kapitán: pozlátená zbroj, biely kôň, biely waffenrock s modrou (ľudia ostávajú modrí), biela kopija so zástavkou
const PAL_CAPTAIN = { w: '#fff7c8', m: '#f8d048', M: '#b88420', D: '#6e4a12', W: '#ffffff', c: '#f4f4f8', l: '#e8e8f0', L: '#b0b0c0', d: '#70707e', e: '#ffffff' };
const buildHKnight8 = () => buildUnit8({ body: KN8_BODY, shield: KN8_SHIELD, legs: KN8_LEGS, hand: KN8_HAND, blade: 7, pal: PAL_HKNIGHT });
const buildCaptain8 = () => buildUnit8({ W: 40, H: 32, body: RD8_BODY, mount: RD8_HORSE, shield: KN8_SHIELD, hand: RD8_HAND, legs: RD8_LEGS, spear: 14, pennant: true, stride: 5, pal: PAL_CAPTAIN });

// ---- náčelník orkov (hrdina hráča za orkov): holá hlava s malým čelom a veľkou tvárou, kly, červené náplecníky
// s kostenými ostňami, kožená zbroj so zlatou prackou, sekera ----
// kresba bez obrysu (12 bodov), obrys sa dopočíta (14 bodov ako telá ostatných hrdinov)
const CH8_ART = {
  S: [
    '...ooooOq...',
    '..oqqOOqqOq.',
    '..orrOOrrOq.',
    '..ooOOOOOOq.',
    'e.oeOOOOeOqe',
    'e..oKKKKOq.e',
    'rrrRooOqrrrR',
    'rrRRLlLLrRRR',
    'oRRLLLLLdRRq',
    'o.LlLgLLLd.q',
    '..LlLLLLLd..',
    '..dLdLLdLd..',
  ],
  E: [
    '....oooOq...',
    '....oqqOOqO.',
    '....ooOOrrO.',
    '....ooOOOOOo',
    '....ooOOOeO.',
    '..e..oOKKe..',
    '..rrrRoqO...',
    '..rRRRLLLoo.',
    '...RLLLLLoo.',
    '....LLLgLd..',
    '....LlLLLd..',
    '....dLdLdL..',
  ],
  N: [
    '...ooooOq...',
    '..ooooOOOOq.',
    '..oooooOOOq.',
    '..oooooOOOq.',
    'e..ooooOOq.e',
    'e...oOOq...e',
    'rrrRLLLLrrrR',
    'rrRRLLLLrRRR',
    'oRRLLLLLdRRq',
    'o.LlLLLLLd.q',
    '..LlLLLLLd..',
    '..dLdLLdLd..',
  ],
  kneel: [
    '...ooooOq...',
    '..oqqOOqqOq.',
    'e.oeOOOOeOqe',
    'e..oKKKKOq.e',
    'rrrRooOqrrrR',
    'rrRRLlLLrRRR',
    'o.LlLgLLLd.q',
    '..LlLLLLLd..',
    '..qOOqqOOq..',
    '..dddddddd..',
  ],
};
// obkreslí 12 bodov širokú kresbu tmavým obrysom (vznikne 14 bodov ako K8_BODY)
function outlineRows(rows) {
  const w = rows[0].length + 2, h = rows.length + 2;
  const g = [...Array(h)].map((_, y) => [...Array(w)].map((_, x) => ((rows[y - 1] || '')[x - 1]) || '.'));
  const out = g.map(r => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx] !== '.')) out[y][x] = 'K';
  return out.map(r => r.join(''));
}
const turnHead8 = (rows, n) => rows.map((r, i) => i < n ? '.' + r.slice(0, -1) : r);
// čierny cop: zozadu stredom chrbta s kosteným korálikom, zboku visí z temena za hlavou (B tmavý, n lesk)
const braid = (rows, col, from, to, bead) => rows.map((r, y) => y < from || y > to ? r : r.slice(0, col) + (y === bead ? 'e' : y % 2 ? 'B' : 'n') + r.slice(col + 1));
const buildChief8 = () => {
  const N0 = braid(braid(CH8_ART.N, 5, 1, 9, 6), 6, 1, 8, -1), E0 = braid(CH8_ART.E, 3, 1, 7, 5);
  const S = outlineRows(CH8_ART.S), E = outlineRows(E0), N = outlineRows(N0);
  // dve žrde do V od pása: x = stĺpec pása v tele, y1 = výška pása, y0 = vrchol žrdí (záporné = nad hlavou), spread = rozostup vrcholov
  const flag = { S: { x: 7, y0: -7, y1: 9, spread: 5 }, SE: { x: 7, y0: -7, y1: 9, spread: 5 }, E: { x: 4, y0: -7, y1: 9, spread: 2 },
    NE: { x: 7, y0: -7, y1: 9, spread: 5, front: true }, N: { x: 7, y0: -7, y1: 9, spread: 5, front: true } };
  return buildHero8({ body: { S, SE: turnHead8(S, 7), E, NE: turnHead8(N, 7), N }, kneel: outlineRows(CH8_ART.kneel), weapon: 'axe', flag,
    pal: { B: '#1e1a22', n: '#3e3848' } });
};

// ---- šaman orkov (hrdina za orkov): čierny plášť s kapucňou cez hlavu, v tieni kapucne svietia červené oči a kly,
// rukávy vyhrnuté po lakte (holé zelené predlaktia), kostený amulet, palica so zelenou duchovnou guľou ----
// n = plášť, c = svetlejší záhyb, B = najtmavší tieň (vlastné farby v pal), r = oči, q/O = tvár v tieni, e = kly a amulet
const OSH8_ART = {
  S: [
    '....ncnn....',
    '...nccnnnB..',
    '..ncnBBBBnB.',
    '..ncBrBBrBnB',
    '..ncqeOOeqnB',
    '..nnBqOOqBnB',
    '.nccnnnnnnBB',
    'cncnnennnnBc',
    'o.nnnnnnnB.q',
    'o.ncnnnnnB.q',
    '..ncnnnnnB..',
    '..ndnnnndB..',
  ],
  E: [
    '.....nnc....',
    '....nnccn...',
    '...nnncBBn..',
    '...nnncBrBn.',
    '...nnnnqOeO.',
    '...nnnnBqBn.',
    '..nnnnnnnB..',
    '..ncnnnncc..',
    '..nnnnnnoo..',
    '...ncnnnB...',
    '...ncnnnB...',
    '...ndnndB...',
  ],
  N: [
    '....ncnn....',
    '...nccnnnB..',
    '..ncnnnnnnB.',
    '..ncnnnnnnB.',
    '..nccnnnnnB.',
    '..nnnnnnnBB.',
    '.nccnnnnnnBB',
    'cncnnnnnnnBc',
    'o.nnnnnnnB.q',
    'o.ncnnnnnB.q',
    '..ncnnnnnB..',
    '..ndnnnndB..',
  ],
  kneel: [
    '....ncnn....',
    '...nccnnnB..',
    '..ncBrBBrBnB',
    '..ncqeOOeqnB',
    '.nccnnnnnnBB',
    'cncnnennnnBc',
    'o.nnnnnnnB.q',
    '..ncnnnnnB..',
    '..nBnnnnBn..',
    '..dddddddd..',
  ],
};
// guľa na palici je zelená (y = svetlé jadro, f = okraj, G = objímka), M/D = drevo palice, plášť čierny s fialovým nádychom
const buildOrcShaman8 = () => {
  const S = outlineRows(OSH8_ART.S), E = outlineRows(OSH8_ART.E), N = outlineRows(OSH8_ART.N);
  return buildHero8({ body: { S, SE: turnHead8(S, 7), E, NE: turnHead8(N, 7), N }, kneel: outlineRows(OSH8_ART.kneel), weapon: 'staff', hand: SORC8_HAND,
    pal: { y: '#d8ffa0', f: '#62c030', G: '#3c8a22', M: '#6e4422', D: '#3e2614', n: '#2c2834', c: '#4a4456', B: '#201c26' } });
};
