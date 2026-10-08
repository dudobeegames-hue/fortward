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

const SPR = {};
function initSprites() {
  SPR.archer = [buildSprite(DEF_ARCHER)];
  SPR.knight = [buildSprite(DEF_KNIGHT)];
  SPR.mage = [buildSprite(DEF_MAGE)];
  SPR.soldier = SOLDIER_LEGS.map(l => buildSprite(SOLDIER_BODY.concat(l)));
  SPR.king = KING_LEGS.map(l => buildSprite(KING_BODY.concat(l)));
  SPR.spear = SOLDIER_LEGS.map(l => buildSprite(SPEAR_BODY.concat(l), { c: '#f08868', B: '#b83c28', n: '#6c2018' }));
  SPR.shield = SOLDIER_LEGS.map(l => buildSprite(SOLDIER_BODY.concat(l), { c: '#d0d4dc', B: '#80869a', n: '#44485a' }));
  SPR.rider = RIDER_FRAMES.map(f => buildSprite(f));
  SPR.monk = MONK_LEGS.map(l => buildSprite(MONK_BODY.concat(l)));
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
}

// Zväčšená ikona (nearest neighbor) ako dataURL pre HTML rozhranie.
function spriteURL(spr, scale, silhouette) {
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
