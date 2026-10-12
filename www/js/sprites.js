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
  // lukostrelec zo strelnice (pešia jednotka) – rovnaký vojak, druhá snímka s prekročenými nohami
  SPR.footArcher = [buildSprite(DEF_ARCHER), buildSprite(DEF_ARCHER.slice(0, 14).concat(['....KddK.KddK.', '....KKK...KKK.']))];
  SPR.knight = [buildSprite(DEF_KNIGHT)];
  SPR.mage = [buildSprite(DEF_MAGE)];
  SPR.soldier = SOLDIER_LEGS.map(l => buildSprite(SOLDIER_BODY.concat(l)));
  SPR.king = KING_LEGS.map(l => buildSprite(KING_BODY.concat(l)));
  SPR.king8 = buildKing8(); // kráľ v 8 smeroch (chôdza, postoj, úder)
  SPR.paladin8 = buildPaladin8(); // paladin v 8 smeroch s bojovým kladivom
  SPR.sorc8 = buildSorc8(); // čarodejka v 8 smeroch s copom a ohnivou palicou
  SPR.paladin = PALADIN_LEGS.map(l => buildSprite(PALADIN_BODY.concat(l), PAL_PALADIN));
  SPR.sorc = SORC_LEGS.map(l => buildSprite(SORC_BODY.concat(l), PAL_SORC));
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
  const hammer = spec.weapon === 'hammer', staff = spec.weapon === 'staff';
  const hand = view => Object.assign({}, K8_HAND[view], spec.hand && spec.hand[view]);
  const ORB_T = 9.6; // stred ohnivej gule na palici (vzdialenosť od ruky)
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
    body.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== '.') put(K8_BX + c, oy + r, col(row[c])); });
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
    } else if (hammer) { // bojové kladivo: dlhá drevená násada so zlatou hlavicou, na konci oceľová hlava naprieč
      add(hx - dx * 2, hy - dy * 2, col('g'));
      for (let t = -1; t <= 7; t += 0.25) add(hx + dx * t, hy + dy * t, t > 6 ? col('G') : col('l'));
      for (let t = 7.5; t <= 10; t += 0.25) for (let o = -2.2; o <= 2.2; o += 0.4)
        add(hx + dx * t - dy * o, hy + dy * t + dx * o, t >= 9.5 ? col('M') : o < -1.2 ? col('w') : col('m'));
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
      const x = h.x + Math.cos(atkAng[1]) * ORB_T, y = h.y + 1 + Math.sin(atkAng[1]) * ORB_T;
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
function spriteFromPixels(c) {
  const w = c.width, h = c.height, id = c.getContext('2d').getImageData(0, 0, w, h);
  const K = hexRGB(PAL.K);
  const mk = () => { const x = document.createElement('canvas'); x.width = w; x.height = h; return x; };
  const f = mk(), sil = mk(), fd = new ImageData(w, h), sd = new ImageData(w, h);
  for (let i = 0; i < id.data.length; i += 4) {
    if (!id.data[i + 3]) continue;
    const isK = id.data[i] === K[0] && id.data[i + 1] === K[1] && id.data[i + 2] === K[2];
    const fc = isK ? K : [255, 255, 255], sc = isK ? K : [51, 51, 68];
    fd.data[i] = fc[0]; fd.data[i + 1] = fc[1]; fd.data[i + 2] = fc[2]; fd.data[i + 3] = 255;
    sd.data[i] = sc[0]; sd.data[i + 1] = sc[1]; sd.data[i + 2] = sc[2]; sd.data[i + 3] = 255;
  }
  f.getContext('2d').putImageData(fd, 0, 0); sil.getContext('2d').putImageData(sd, 0, 0);
  return { c, f, sil, w, h };
}
