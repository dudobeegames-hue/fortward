'use strict';
// Fortward – procedurálne bojisko. Všetko per-pixel s ordered ditheringom (Bayer 4x4).

function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) {
  return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
}

const RAMP = {
  grass: ['#16301a', '#1e3e1e', '#2a5224', '#36662a', '#447c30', '#56923a', '#6caa46', '#8cc45a'],
  bush:  ['#0e2414', '#163420', '#20462a', '#2c5c30', '#3c7638', '#529042'],
  dirt:  ['#2e1e12', '#3e2a18', '#523822', '#684a2c', '#7e5c38', '#967048', '#ae885a', '#c6a272'],
  stone: ['#1e1e28', '#2c2c38', '#3e3e4c', '#525262', '#6a6a78', '#848490', '#a0a0aa', '#c0c0c8'],
  walk:  ['#2a241e', '#3c342c', '#504538', '#665848', '#7c6c5a', '#94826e', '#ac9a84', '#c4b29c'],
  brick: ['#1c1416', '#2a1e1e', '#3a2824', '#4c342c', '#604236', '#765242'],
};
for (const k in RAMP) RAMP[k] = RAMP[k].map(hexRGB);

function pickRamp(ramp, v, x, y) {
  let i = Math.floor(v * (ramp.length - 1) + BAYER4[(y & 3) * 4 + (x & 3)]);
  return ramp[i < 0 ? 0 : i >= ramp.length ? ramp.length - 1 : i];
}

// ---- Témy bojísk: každá misia má vlastnú krajinu (len vizuálne, nemení cestu hordy) ----
const THEMES = [
  { key: 'coast',  ground: 'grass', road: 'dirt',    deco: 'bush',    sea: true, anim: 'foam', spawn: 'right' },
  { key: 'stream', ground: 'grass', road: 'dirt',    deco: 'bush',    river: { y: 0.3, hw: 4.5, bridge: true }, mill: true },
  { key: 'birch',  ground: 'grass', road: 'dirt',    deco: 'birch' },
  { key: 'ford',   ground: 'grass', road: 'dirt',    deco: 'rocks',   river: { y: 0.42, hw: 8, ford: true } },
  { key: 'hill',   ground: 'dry',   road: 'dirt',    deco: 'outcrop' },
  { key: 'swamp',  ground: 'swamp', road: 'mud',     deco: 'swamp',   anim: 'fog' },
  { key: 'heath',  ground: 'grassDark', road: 'dirt', deco: 'heath' }, // vresovisko: ploché fialové škvrny vresu a nízke kríky (skalné steny a kamene tu boli, jednotky cez ne chodili)
  { key: 'ruins',  ground: 'grassDark', road: 'cobble', deco: 'ruins' },
  { key: 'ash',    ground: 'ash',   road: 'ashroad', deco: 'charred', anim: 'embers' },
  { key: 'orc',    ground: 'darkLit', road: 'ashroad', deco: 'orc' },
  { key: 'frontier', ground: 'grass', road: 'cobble', deco: 'ruins', river: { y: 0.42, hw: 5, bridge: true } }, // nekonečná obrana: pohraničie s riekou a ruinami
  // krajiny ďalších území sveta
  { key: 'snow',   ground: 'snow',   road: 'snowroad', deco: 'snowy',  anim: 'snow' },   // 11 severná krajina: sneh, zasnežené smreky, ľadové balvany, sneží
  { key: 'dunes',  ground: 'desert', road: 'sandroad', deco: 'desert' },                 // 12 púšť: duny, kaktusy, palmy, vybielené kosti
  { key: 'jungle', ground: 'jungle', road: 'dirt',     deco: 'jungle' },                 // 13 lesy dlhého ostrova: husté koruny, paprade
  { key: 'graves', ground: 'ash',    road: 'ashroad',  deco: 'graves', anim: 'fog' },    // 14 popolavý ostrov: náhrobky, kríže, mŕtve stromy, kosti, hmla
  { key: 'hive',   ground: 'hive',   road: 'hiveroad', deco: 'hive',   anim: 'spores' }, // 15 ostrov roja: fialová zem, kukly a veže úľa, svetielkujúce spóry
];

const TR = {
  dry:    ['#2a2614', '#3a3418', '#4e4620', '#665a28', '#7e7032', '#968a40', '#aea250', '#c4b868'],
  swamp:  ['#10180e', '#162012', '#1c2a16', '#24341a', '#2e4020', '#3a4e28', '#485e30'],
  swampW: ['#0a1410', '#0e1c16', '#14261c', '#1c3224', '#28422e'],
  mud:    ['#1e160e', '#2a1e12', '#382818', '#46321e', '#563e26'],
  ash:    ['#161414', '#201e1e', '#2c2828', '#3a3434', '#4a4442', '#5c5452', '#6e6662', '#827a74'],
  ashroad:['#120e0c', '#1c1612', '#281e18', '#34281e', '#423224', '#52402c'],
  dark:   ['#120a08', '#1a0e0a', '#24140e', '#301a12', '#3e2216', '#4c2a1a', '#5a3420'],
  darkLit:['#24160e', '#301e14', '#3e2618', '#4c301e', '#5a3a24', '#68442a', '#785032'], // pevnosť orkov: svetlejšia zem bez lávy
  lava:   ['#5a1008', '#a02810', '#e05018', '#f89838', '#fff070'],
  water:  ['#0c1e44', '#10285a', '#163a7a', '#1e5096', '#2a6ab0', '#3c88c8', '#5aa8d8', '#8ad0e8'],
  snow:   ['#5a6a82', '#7486a0', '#90a2ba', '#aebed2', '#c8d6e4', '#dce6f0', '#ecf2f8', '#f8fbfd'],
  snowroad: ['#4a4846', '#5e5a56', '#76706a', '#8e8880', '#a8a29a', '#c0bcb6'], // ušliapaný sneh s blatom
  desert: ['#8a6a3c', '#a07c48', '#b48e56', '#c6a064', '#d4b274', '#e0c288', '#eacfa0', '#f2dcb4'],
  sandroad: ['#6e5432', '#80623a', '#927246', '#a48252', '#b4925e', '#c2a06c'],
  jungle: ['#0e2212', '#143018', '#1c3e1e', '#264e24', '#305e2a', '#3c6e32', '#4a7e3a'],
  hive:   ['#1a0a20', '#26102e', '#341840', '#442052', '#562a66', '#6a367a', '#80448e'],
  hiveroad: ['#140a14', '#1e101c', '#2a1626', '#361e30', '#44263a', '#523046'],
  birch:  ['#28461e', '#3a6028', '#4e7a30', '#68943c', '#86ae4c', '#a6c862'],
  sand:   ['#6e5838', '#8a7048', '#a88a5a', '#c4a670', '#dcc08a', '#ecd8a8'],
};
for (const k in TR) TR[k] = TR[k].map(hexRGB);

// orkská podlaha: zvislé hrubé dosky (4 body široké) s tmavými škárami, posunutými koncami, letokruhmi, sukmi
// a železnými klincami pri koncoch; počíta sa zo súradníc sveta, takže susedné políčka na seba plynulo nadväzujú
const PLANK = ['#2a1a0e', '#3e2614', '#523420', '#6e4422', '#86562c', '#a86c38', '#c08848'].map(hexRGB);
function plankRGB(X, Y) {
  const p = Math.floor(X / 4), x = X - p * 4, o = Math.floor(hash2(p, 0, 31) * 16), seg = Math.floor((Y + o) / 16), yy = (Y + o) - seg * 16;
  if (x === 0 || yy === 0) return PLANK[0];                                                       // škára medzi doskami
  if (x === 2 && yy === 2) return hexRGB(hash2(p, seg, 36) > 0.5 ? '#a0a0aa' : '#6a6a78');      // klinec pri konci dosky
  let v = 0.5 + (hash2(p, seg, 32) - 0.5) * 0.3 + (hash2(p, Math.floor((Y + o) / 3), 33) - 0.5) * 0.12;
  if (x === 1) v += 0.14; else if (x === 3) v -= 0.1;                                              // osvetlená a zatienená hrana dosky
  if (yy === 1) v += 0.1; else if (yy === 15) v -= 0.12;
  const kn = 4 + Math.floor(hash2(p, seg, 34) * 8);                                                // suk
  if (hash2(p, seg, 35) > 0.7 && (yy === kn || yy === kn + 1) && x >= 1 && x <= 2) v -= 0.3;
  return pickRamp(PLANK, Math.max(0, Math.min(1, v)), X, Y);
}

// kamenná dlažba v jemnej kresbe (pixel X, Y = 2 × bod hry): tehlička 6 × 5 pixelov (polovica starej), škára 1 px, svetlá horná a ľavá hrana,
// zatienená spodná a pravá; počíta sa z polohy, takže dlažba hráča a nádvorie radnice na seba nadväzujú
function paveRGB(X, Y) {
  const row = Math.floor(Y / 5), off = (row % 2) * 3, col = Math.floor((X + off) / 6), ry = Y % 5, rx = (X + off) % 6;
  let v = 0.5 + (hash2(col, row, 21) - 0.5) * 0.3 + (hash2(X, Y, 22) - 0.5) * 0.08;
  if (ry === 0 || rx === 0) v = 0.15;
  else if (ry === 1 || rx === 1) v += 0.12;
  else if (ry === 4 || rx === 5) v -= 0.08;
  return pickRamp(RAMP.walk, v, X, Y);
}

// G: { T, gx0, gy0, cols, rows, hallCx, hallTop, hallBot, zoneTopMax }
// clear = obdĺžniky [x0, y0, x1, y1] bez stromov a skál (stavby tábora hordy); yard = 'planks' – nádvorie z dosiek (orkovia), 'none' – bez nádvoria
// terr = terén územia (LANDS v world.js): zem vždy, cestu, dekorácie a počasie, ak téma nie je v terr.keep; more s penou, rieky a mlyn ostanú
// hd = jemná kresba (2 pixely na bod ako jednotky a nové budovy): zem, cesta, nádvorie, more, rieka, most, brod, mlyn a ozdoby krajín prvého ostrova
// sa kreslia po pixeloch; ozdoby ďalších území (sneh, púšť, džungľa, hroby, úľ) zatiaľ po bodoch (2×2). Bez skál a lávy; plátno má veľkosť W·R × H·R.
function buildScene(W, H, G, seed, themeIdx, clear, yard, terr, hd) {
  let th = THEMES[((themeIdx || 0) % THEMES.length + THEMES.length) % THEMES.length];
  if (terr) th = Object.assign({}, th, { ground: terr.ground }, (terr.keep || []).includes(th.key) ? {} : { road: terr.road, deco: terr.deco }, (terr.keep || []).includes(th.key) || th.anim === 'foam' ? {} : { anim: terr.anim });
  const R = hd && !th.cliffs && !th.lava ? 2 : 1, WR = W * R, HR = H * R;
  const lineH = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) setH(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); }; // čiara po pixeloch plátna
  const bg = document.createElement('canvas'); bg.width = WR; bg.height = HR;
  const bx = bg.getContext('2d');
  const img = bx.createImageData(WR, HR), d = img.data;
  const K = hexRGB(PAL.K);
  const setH = (x, y, c) => { // jeden pixel plátna
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= WR || y >= HR) return;
    const i = (y * WR + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  };
  const darkenH = (x, y, f) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= WR || y >= HR) return;
    const i = (y * WR + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f * 1.05;
  };
  const set = R === 1 ? setH : (x, y, c) => { x |= 0; y |= 0; for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) setH(x * R + i, y * R + j, c); }; // jeden bod hry
  const darken = R === 1 ? darkenH : (x, y, f) => { x |= 0; y |= 0; for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) darkenH(x * R + i, y * R + j, f); };
  const zoneTop = G.zoneTopMax;

  // cesta zhora k bráne radnice
  const roadCx = y => {
    const k = Math.max(0, Math.min(1, (G.hallTop - y) / 140));
    return G.hallCx + (Math.sin(y * 0.021 + seed) * (th.cliffs ? 5 : 12) + Math.sin(y * 0.053 + 1) * 4) * k;
  };
  const roadHw = y => 5 + Math.max(0, Math.min(1, y / G.hallTop)) * 1.5; // šírka cesty najviac jedno políčko (aj so zvlneným okrajem)
  const roadD = (x, y) => y > G.hallTop + 4 ? 99 : Math.abs(x - roadCx(y)) - roadHw(y) + (vnoise(x * 0.3, y * 0.3, seed + 3) - 0.5) * 3;
  const hx0 = G.hallCx - 22, hx1 = G.hallCx + 22;
  const yardD = yard === 'none' ? () => 99 : (x, y) => { // 'none' = bez nádvoria (útok na hrad – hráč nemá radnicu)
    if (y >= G.hallBot) return 99; // pod radnicou nádvorie nie je (je tam pruh zdravia)
    const dx = Math.max(hx0 - x, 0, x - hx1), dy = Math.max(G.hallTop - y, 0);
    return Math.hypot(dx, dy) - 3 + (vnoise(x * 0.25, y * 0.25, seed + 17) - 0.5) * 3;
  };
  const groundRamp = { grass: RAMP.grass, grassDark: RAMP.grass, dry: TR.dry, swamp: TR.swamp, ash: TR.ash, dark: TR.dark, darkLit: TR.darkLit,
    snow: TR.snow, desert: TR.desert, jungle: TR.jungle, hive: TR.hive }[th.ground];
  const groundBias = th.ground === 'grassDark' ? -0.12 : th.ground === 'swamp' ? 0.1 : th.ground === 'snow' ? 0.12 : 0;

  // ---- podklad: zem, cesta, nádvorie ----
  // tvary (cesta, nádvorie, škvrny) sa počítajú v bodoch hry (x, y), zrno a raster po pixeloch plátna (px, py)
  // jemná kresba: pomalé plynulé šumy (veľké škvrny, zvlnenie okraja cesty) sa rátajú raz na bod hry a platia pre jeho 2×2 pixely – inak by príprava terénu na telefóne zamrzla
  const memo = () => new Float32Array(W * H).fill(NaN);
  const nRoad = R > 1 ? memo() : null, nGrass = R > 1 ? memo() : null, nDirt = R > 1 ? memo() : null;
  const pt = (arr, i, f) => { let v = arr[i]; if (v !== v) { const bxp = i % W + 0.5, byp = (i / W | 0) + 0.5; v = arr[i] = f(bxp, byp); } return v; };
  const fbmAt = (arr, i, x, y, k, sd) => R > 1 ? pt(arr, i, (bxp, byp) => fbm(bxp * k, byp * k, sd)) : fbm(x * k, y * k, sd);
  for (let py = 0; py < HR; py++) {
    const y = R === 1 ? py : (py + 0.5) / R, yi = py / R | 0, cx = roadCx(y), hw = roadHw(y); // pri hrubej kresbe presne ako predtým
    for (let px = 0; px < WR; px++) {
      const x = R === 1 ? px : (px + 0.5) / R, pi = yi * W + (px / R | 0);
      const dd = R === 1 ? roadD(x, y) : y > G.hallTop + 4 ? 99 : Math.abs(x - cx) - hw + pt(nRoad, pi, (bxp, byp) => (vnoise(bxp * 0.3, byp * 0.3, seed + 3) - 0.5) * 3);
      const yd = yard === 'none' ? 99 : yardD(x, y);
      if (yd < 0 && yard === 'planks') { // orkské nádvorie: hrubé dosky ako orkský chodník, okraj tmavší
        const c = plankRGB(px / R | 0, yi);
        setH(px, py, yd > -2 ? [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75] : c);
      } else if (yd < 0) { // dlaždice nádvoria (pri jemnej kresbe rovnaké ako dlažba hráča – paveRGB)
        if (R > 1) { const c = paveRGB(px, py); setH(px, py, yd > -2 ? [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8] : c); continue; }
        const row = Math.floor(py / 5), off = (row % 2) * 3, col = Math.floor((px + off) / 6);
        let v = 0.5 + (hash2(col, row, seed + 21) - 0.5) * 0.3 + (hash2(px, py, seed + 22) - 0.5) * 0.1;
        if (py % 5 === 0 || (px + off) % 6 === 0) v = 0.15;
        else if (py % 5 === 1 || (px + off) % 6 === 1) v += 0.12;
        if (yd > -2) v -= 0.15;
        setH(px, py, pickRamp(RAMP.walk, v, px, py));
      } else if (dd < 0) {
        if (th.road === 'cobble') {
          const row = Math.floor(py / (4 * R)), off = (row % 2) * 2 * R, col = Math.floor((px + off) / (5 * R));
          let v = 0.45 + (hash2(col, row, seed + 23) - 0.5) * 0.35;
          if (py % (4 * R) === 0 || (px + off) % (5 * R) === 0) v = 0.12;
          if (dd > -2 || hash2(col, row, seed + 24) > 0.92) { setH(px, py, pickRamp(groundRamp, 0.3, px, py)); continue; } // tráva (zem územia) medzi kameňmi
          setH(px, py, pickRamp(RAMP.stone, v, px, py));
          continue;
        }
        const ramp = { mud: TR.mud, ashroad: TR.ashroad, snowroad: TR.snowroad, sandroad: TR.sandroad, hiveroad: TR.hiveroad }[th.road] || RAMP.dirt;
        let v = 0.52 + (fbmAt(nDirt, pi, x, y, 0.08, seed + 5) - 0.5) * 0.5 + (hash2(px, py, seed + 9) - 0.5) * 0.16;
        if (R > 1) v += (vnoise(x * 0.9, y * 0.9, seed + 12) - 0.5) * 0.18; // hrudky hliny
        const rut = Math.abs(Math.abs(x - cx) - hw * 0.45);
        if (rut < 1.2) v -= 0.2;
        else if (rut < 2.2 && x < cx) v += 0.06;
        if (dd > -2) v -= 0.14;
        if (th.road === 'mud' && fbm(x * 0.15, y * 0.15, seed + 31) > 0.66) { setH(px, py, pickRamp(TR.swampW, 0.5 + (x < cx ? 0.2 : 0), px, py)); continue; } // kaluže
        if (hash2(px, py, seed + 11) > 0.985) v += 0.3;
        setH(px, py, pickRamp(ramp, v, px, py));
      } else {
        let v = 0.56 + groundBias + (fbmAt(nGrass, pi, x, y, 0.05, seed + 1) - 0.5) * 0.6 + (hash2(px, py, seed + 2) - 0.5) * 0.2;
        if (R > 1) v += (vnoise(x * 0.7, y * 1.4, seed + 4) - 0.5) * 0.16; // jemné pásy stebiel
        if (dd < 3) v -= 0.18 * (1 - dd / 3);
        if (yd < 3) v -= 0.15 * (1 - yd / 3);
        v += (1 - (x + y) / (W + H)) * 0.08;
        if (th.ground === 'desert') { const r = Math.sin(x * 0.12 + y * 0.31 + fbm(x * 0.02, y * 0.02, seed + 61) * 7); v += r > 0.75 ? 0.14 : r < -0.5 ? -0.1 : 0; } // dlhé duny
        else if (th.ground === 'snow' && fbm(x * 0.09, y * 0.09, seed + 63) > 0.66) v -= 0.16;                                   // závoje a jamky v snehu
        setH(px, py, pickRamp(groundRamp, v, px, py));
      }
    }
  }

  const rnd = (() => { let s = (seed * 9301 + 49297) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
  const blocked = new Uint8Array(W * H); // miesta s vodou/skalou – bez dekorácií
  // od misie 6: pod stavbami tábora hordy nerastú stromy ani neležia skaly
  const fortX = Math.round(roadCx(40));
  for (const [x0, y0, x1, y1] of clear || []) for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) blocked[y * W + x] = 1;
  const free = (x, y, m) => roadD(x, y) > m && yardD(x, y) > m && !blocked[(Math.max(0, Math.min(H - 1, y | 0))) * W + Math.max(0, Math.min(W - 1, x | 0))];

  // ---- špeciálne prvky krajiny ----
  const foam = [], lava = [];
  let mill = null;                     // poloha otáčajúceho sa kolesa mlyna a hladina vody pod ním
  const water = new Uint8Array(W * H); // 1 = voda (spomalí), 2 = plytčina brodu (spomalí menej)
  let spawn = [G.gx0 + 8, G.gx0 + G.cols * G.T - 8];

  if (th.sea) { // more na ľavom okraji
    const rawEdge = y => 36 - 24 * (y / H) + Math.sin(y * 0.05 + seed) * 4 + (fbm(0.5, y * 0.04, seed + 41) - 0.5) * 8;
    // voda nesmie siahať do zóny na stavanie: pri zóne končí pred mriežkou (piesok smie), nad ňou sa plynulo vracia
    const shore = y => G.gx0 + 5 + Math.max(0, zoneTop - 10 - y) * 0.7;
    const edge = y => Math.min(rawEdge(y), shore(y));
    for (let py = 0; py < HR; py++) {
      const y = R === 1 ? py : (py + 0.5) / R, yi = py / R | 0, e = edge(y);
      for (let px = 0; px < (Math.ceil(e) + 1) * R && px < WR; px++) {
        const x = R === 1 ? px : (px + 0.5) / R;
        blocked[yi * W + (px / R | 0)] = 1;
        if (x < e - 5) {
          const depth = (e - 5 - x) / 20;
          let v = 0.75 - depth * 1.4 + ((py + Math.round(Math.sin(px * 0.4 / R) * 1.5 * R)) % (6 * R) === 0 ? 0.1 : 0); // vlnky (pri jemnej kresbe tenké)
          if (x > e - 7) { v = 0.95; foam.push({ x: px / R, y: py / R, s: 1 / R, ph: hash2(px, py, 5) * 6.28 }); }
          setH(px, py, pickRamp(TR.water, v, px, py));
        } else setH(px, py, pickRamp(TR.sand, 0.55 + (x - e + 5) * 0.06 + (hash2(px, py, 6) - 0.5) * 0.2, px, py));
      }
    }
    // mólo
    const py = Math.round(H * 0.42), pe = Math.round(edge(py)) + 4;
    if (R === 1) {
      for (let y = py; y < py + 5; y++) for (let x = 0; x < pe; x++) set(x, y, pickRamp(WOOD, y === py ? 0.7 : y === py + 4 ? 0.15 : (x % 4 === 0 ? 0.3 : 0.5), x, y));
      for (let x = 2; x < pe; x += 5) { set(x, py + 5, WOOD[1]); set(x, py + 6, WOOD[1]); }
    } else { // dosky so škárami a letokruhmi, svetlá horná a tmavá spodná hrana, stĺpy s osvetlenou stranou
      for (let j = 0; j < 5 * R; j++) for (let i = 0; i < pe * R; i++) {
        const plank = Math.floor(i / 8);
        let v = 0.5 + (hash2(plank, 3, seed) - 0.5) * 0.16 + (hash2(i, py * R + j, seed + 4) - 0.5) * 0.08 + (j % 3 === 1 ? 0.04 : 0);
        if (i % 8 === 0) v = 0.24; else if (i % 8 === 1) v += 0.08;
        if (j === 0) v = 0.78; else if (j === 5 * R - 1) v = 0.12; else if (j === 5 * R - 2) v -= 0.14;
        setH(i, py * R + j, pickRamp(WOOD, v, i, py * R + j));
      }
      for (let x = 2; x < pe; x += 5) for (let j = 5 * R; j < 7 * R; j++) { setH(x * R, py * R + j, WOOD[2]); setH(x * R + 1, py * R + j, WOOD[1]); }
    }
    // pena pod mólom by cez dosky preblikávala
    for (let i = foam.length - 1; i >= 0; i--) {
      const f = foam[i], fx = Math.floor(f.x);
      if (f.x < pe && (f.y >= py && f.y < py + 5 || f.y >= py + 5 && f.y < py + 7 && fx >= 2 && (fx - 2) % 5 === 0)) foam.splice(i, 1);
    }
    // loďka
    const by = Math.round(H * 0.2), bx0 = 2;
    if (R === 1) {
      for (let x = 0; x < 11; x++) { set(bx0 + x, by, x === 0 || x === 10 ? K : WOOD[5]); set(bx0 + x, by + 1, x === 0 || x === 10 ? K : WOOD[3]); }
      for (let x = 1; x < 10; x++) set(bx0 + x, by + 2, K);
      for (let y = 1; y <= 9; y++) set(bx0 + 5, by - y, WOOD[2]);
      for (let y = 2; y <= 8; y++) for (let x = 1; x <= Math.floor((y - 1) * 0.6); x++) set(bx0 + 5 + x, by - 10 + y, hexRGB(x === 1 ? '#c4b89e' : '#eee6cc'));
    } else { // trup z dosiek s obrysom, tenký sťažeň, plachta so záhybom a tieňom pri sťažni
      const ox = bx0 * R, oy = by * R, sailL = hexRGB('#eee6cc'), sailM = hexRGB('#d8ceb4'), sailD = hexRGB('#a8a088');
      for (let j = 0; j < 6; j++) {
        const x0 = Math.round(j * 0.8), x1 = 21 - Math.round(j * 0.8);
        for (let i = x0; i <= x1; i++) setH(ox + i, oy + j, i === x0 || i === x1 || j === 5 ? K : j === 0 ? WOOD[6] : j === 2 ? WOOD[2] : WOOD[j < 2 ? 5 : 3]);
      }
      for (let i = 2; i < 20; i++) darkenH(ox + i, oy + 6, 0.7); // tieň trupu na vode
      for (let j = 1; j <= 19; j++) setH(ox + 10, oy - j, WOOD[j % 4 === 0 ? 1 : 2]);
      for (let j = 3; j <= 17; j++) {
        const w = Math.floor((j - 2) * 0.62);
        for (let i = 1; i <= w; i++) setH(ox + 10 + i, oy - 20 + j, i === w ? sailD : i <= 2 ? sailM : (i + j) % 7 === 0 ? sailM : sailL);
      }
      for (let i = 1; i <= Math.floor(15 * 0.62); i++) setH(ox + 10 + i, oy - 2, sailD); // spodný lem plachty
    }
    spawn = [Math.round(edge(0)) + 10, spawn[1]];
  }

  if (th.river && R === 1) { // potok / rieka naprieč poľom
    const R = th.river, ry = H * R.y;
    const rcy = x => ry + Math.sin(x * 0.045 + seed) * 7;
    const hwAt = x => R.hw + (vnoise(x * 0.2, 0.5, seed + 51) - 0.5) * 2;
    // breh: pás piesku a kamienkov, nad vodou a pod ňou zvlášť široký a nepravidelný
    const bankN = x => 0.8 + Math.pow(vnoise(x * 0.09, 1.5, seed + 71), 1.4) * 6.5; // miestami úzky a zarastený, inde široká piesočná pláž
    const bankS = x => 0.8 + Math.pow(vnoise(x * 0.08, 3.5, seed + 73), 1.4) * 5.5;
    const pebbles = R.ford ? 0.86 : 0.93;
    for (let x = 0; x < W; x++) {
      const cy = rcy(x), hw = hwAt(x), bn = bankN(x), bs = bankS(x);
      for (let y = Math.floor(cy - hw - bn - 1); y <= Math.ceil(cy + hw + bs + 1); y++) {
        if (y < 0 || y >= H) continue;
        const dy = y - cy, ady = Math.abs(dy);
        const onRoad = roadD(x, y) < 1;
        if (ady > hw) { // breh
          const t = (ady - hw) / (dy < 0 ? bn : bs); // 0 = pri vode, 1 = pri tráve
          if (t > 1) continue;
          blocked[y * W + x] = 1;
          if (onRoad && R.bridge) continue; // cesta ide až k mostu
          const hsh = hash2(x, y, seed + 81);
          if (t > 0.6 && hsh < (t - 0.6) * 2.4) continue; // tráva zubato zasahuje do piesku
          if (t < 0.25) { set(x, y, pickRamp(TR.sand, 0.04 + hsh * 0.22, x, y)); continue; } // mokrý tmavší piesok pri vode
          set(x, y, pickRamp(TR.sand, 0.2 + t * 0.38 + (hsh - 0.5) * 0.25 + (dy < 0 ? 0.06 : -0.06) - (onRoad ? 0.1 : 0), x, y));
          if (hsh > pebbles) { set(x, y, pickRamp(RAMP.stone, 0.62 + hash2(x, y, 9) * 0.3, x, y)); set(x, y + 1, RAMP.stone[2]); } // kamienok s tieňom
          continue;
        }
        blocked[y * W + x] = 1;
        // voda: pri brehu plytká a svetlejšia, v strede hlboká; jemné šikmé vlnky
        const depth = 1 - ady / hw;
        let v = 0.74 - depth * 0.44 + ((x + Math.round(y * 2.3) + Math.round(Math.sin(y * 0.9 + x * 0.21) * 2)) % 11 === 0 ? 0.15 : 0);
        if (dy < 0 && hw - ady < 1.3) v -= 0.2; // tieň pod severným brehom
        else if (dy > 0 && hw - ady < 1) v += 0.1; // svetlý lem pri južnom brehu
        water[y * W + x] = onRoad && R.ford ? 2 : 1;
        set(x, y, pickRamp(TR.water, v, x, y));
      }
    }
    const nearRoad = (x, y, m) => roadD(x, y) < m;
    // trstina pri vode, kamene v prúde, lekná (breh je bez trávy)
    for (let x = 1; x < W - 1; x++) {
      const cy = rcy(x), hw = hwAt(x);
      if (nearRoad(x, cy, 6)) continue;
      const h1 = hash2(x, 11, seed), h2 = hash2(x, 13, seed), h3 = hash2(x, 17, seed);
      if (h3 > 0.9 && x % 2 === 0) { // trstina pri vode s hnedým klasom
        const north = h2 > 0.5, by = Math.round(north ? cy - hw + 1 : cy + hw), ht = 4 + Math.round(h1 * 3);
        for (let k = 0; k < ht; k++) set(x, by - k, RAMP.grass[k < 2 ? 3 : 4]);
        set(x, by - ht, WOOD[3]); set(x, by - ht - 1, WOOD[4]); set(x, by - ht + 1, WOOD[2]);
        if (h1 > 0.5) for (let k = 0; k < ht - 2; k++) set(x + 1, by - k, RAMP.grass[3]); // druhé steblo
      }
      if (h2 > 0.965 && !nearRoad(x, cy, 14)) { // kameň v prúde s penou
        const sy = Math.round(cy + (h1 - 0.5) * hw);
        for (let dx = -1; dx <= 1; dx++) { set(x + dx, sy, RAMP.stone[dx < 0 ? 6 : 4]); set(x + dx, sy + 1, RAMP.stone[2]); }
        set(x, sy - 1, RAMP.stone[5]);
        set(x - 2, sy + 1, TR.water[7]); set(x + 2, sy, TR.water[7]); set(x + 3, sy + 1, TR.water[6]);
      }
      if (!R.ford && h1 > 0.975 && !nearRoad(x, cy, 16)) { // leknín
        const ly = Math.round(cy + (h3 - 0.5) * hw * 0.8);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) if (Math.abs(dx) + Math.abs(dy) < 3) set(x + dx, ly + dy, RAMP.grass[dy < 0 ? 5 : 4]);
        set(x + 1, ly - 1, TR.water[4]); set(x - 1, ly, RAMP.grass[6]); // zárez a lesk
        if (h2 > 0.5) { set(x, ly, hexRGB('#f4b8d0')); set(x, ly - 1, hexRGB('#ffffff')); } // kvet
      }
    }
    if (R.bridge) { // drevený most: rovné okraje, dosky naprieč, zábradlie so stĺpikmi, tieň na vode
      const bcx = Math.round(roadCx(ry)), half = Math.round(roadHw(ry)) + 1, x0 = bcx - half, x1 = bcx + half;
      let top = 1e9, bot = -1e9;
      for (let x = x0; x <= x1; x++) { top = Math.min(top, rcy(x) - hwAt(x) - bankN(x) * 0.5); bot = Math.max(bot, rcy(x) + hwAt(x) + bankS(x) * 0.5); }
      top = Math.floor(top); bot = Math.ceil(bot);
      for (let y = top + 2; y <= bot + 1; y++) for (const sx of [x1 + 1, x1 + 2]) if (water[y * W + sx]) darken(sx, y, sx === x1 + 1 ? 0.55 : 0.75);
      for (let x = x0 + 1; x <= x1 + 2; x++) if (water[(bot + 1) * W + x]) darken(x, bot + 1, 0.6);
      for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) {
        water[y * W + x] = 0; blocked[y * W + x] = 1;
        const row = y - top;
        if (x === x0 || x === x1) { set(x, y, K); continue; }
        if (x === x0 + 1 || x === x1 - 1) { // trám zábradlia, stĺpik každých 5 bodov
          set(x, y, row % 5 === 0 ? WOOD[2] : x === x0 + 1 ? WOOD[6] : WOOD[4]);
          continue;
        }
        if (row % 3 === 2) { set(x, y, WOOD[1]); continue; } // šev medzi doskami
        const plank = Math.floor(row / 3);
        const pv = 0.56 + (hash2(plank, 7, seed) - 0.5) * 0.28 + (row % 3 === 0 ? 0.1 : 0) + (x - x0 < 4 ? 0.06 : 0) - (x1 - x < 4 ? 0.1 : 0);
        set(x, y, pickRamp(WOOD, pv + (hash2(x, y, 5) - 0.5) * 0.08, x, y));
        if (row % 3 === 0 && (x === x0 + 3 || x === x1 - 3)) set(x, y, RAMP.stone[5]); // klinec
      }
      for (let x = x0 + 2; x <= x1 - 2; x++) { set(x, top, WOOD[2]); set(x, bot, WOOD[2]); } // prahy na koncoch
      for (const px of [x0, x1]) for (let y = top; y <= bot; y++) if ((y - top) % 5 === 0) { // prúd sa čerí okolo stĺpov
        const qx = px + (px === x0 ? -1 : 1);
        if (water[y * W + qx]) { set(qx, y, TR.water[7]); if (water[(y + 1) * W + qx]) set(qx, y + 1, TR.water[6]); }
      }
    }
    if (R.ford) { // brod: plytčina so štrkovým dnom, nepravidelné kamene na prechod, pena a čerenie (prúd tečie zľava doprava)
      const mix = (x, y, c, a) => {
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const i = (y * W + x) * 4; d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a;
      };
      const isW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && water[y * W + x];
      const cx0 = roadCx(ry), span = roadHw(ry) + 10;
      // 1) plytké dno: cez vodu jemne presvitá piesok (plynulé škvrny, žiadny šum); k okrajom brodu prechádza do hĺbky
      for (let x = Math.floor(cx0 - span); x <= Math.ceil(cx0 + span); x++) {
        const cy = rcy(x), hw = hwAt(x);
        for (let y = Math.floor(cy - hw); y <= Math.ceil(cy + hw); y++) {
          if (!isW(x, y)) continue;
          const a = Math.max(0, Math.min(1, (3 - roadD(x, y)) / 8));
          if (a <= 0) continue;
          const nv = vnoise(x * 0.18, y * 0.3, seed + 93);
          const s0 = TR.sand[2], s1 = TR.sand[4], f = 0.2 + nv * 0.6; // plynulý odtieň piesku bez rastra
          mix(x, y, [s0[0] + (s1[0] - s0[0]) * f, s0[1] + (s1[1] - s0[1]) * f, s0[2] + (s1[2] - s0[2]) * f], a * 0.3);
          if (a > 0.6 && hash2(x, y, seed + 91) > 0.988) set(x, y, pickRamp(RAMP.stone, 0.5, x, y)); // ojedinelý kamienok na dne
        }
      }
      // 2) kamene na prechod: väčšie, s obrysom, kľukato striedavo vľavo a vpravo od osi cesty
      const topY = Math.ceil(rcy(cx0) - hwAt(cx0)) + 1, botY = Math.floor(rcy(cx0) + hwAt(cx0)) - 1;
      const OUT = RAMP.stone[1];
      let y = topY + 1, side = hash2(3, 5, seed) > 0.5 ? 1 : -1, n = 0;
      while (y <= botY - 1) {
        const h1 = hash2(n, 41, seed), h2 = hash2(n, 43, seed), h3 = hash2(n, 47, seed);
        const sx = Math.round(cx0 + side * (2.5 + h1 * 3)), sy = Math.round(y);
        const rx = 2.2 + h2 * 1.2, ryy = rx * 0.7 + 0.2;
        const inS = (dx, dy) => (dx / rx) ** 2 + (dy / ryy) ** 2 <= 1 + (hash2(sx + dx, sy + dy, seed + 7) - 0.5) * 0.25;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 7; dx++) {
          const px = sx + dx, py = sy + dy;
          if (inS(dx, dy)) continue;
          const nb = inS(dx + 1, dy) || inS(dx - 1, dy) || inS(dx, dy + 1) || inS(dx, dy - 1);
          if (nb) { set(px, py, OUT); continue; } // obrys
          if (!isW(px, py)) continue;
          if (inS(dx, dy - 2) || inS(dx - 1, dy - 2)) mix(px, py, TR.water[1], 0.4); // tieň pod kameňom vo vode
          else if (dx < 0 && inS(dx + 2, dy) && dy <= 0) mix(px, py, [226, 240, 246], 0.65); // pena na návodnej strane
          else if (dx > rx + 1 && dx < rx + 5 && dy === 0) mix(px, py, TR.water[7], 0.5); // brázda za kameňom
        }
        for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
          if (!inS(dx, dy)) continue;
          const px = sx + dx, py = sy + dy;
          const top = !inS(dx, dy - 1), wet = !inS(dx, dy + 1); // horná hrana suchá a svetlá, spodný okraj mokrý
          let v = 0.52 - dx / rx * 0.12 - dy / ryy * 0.18 + (hash2(px, py, seed + 17) - 0.5) * 0.08;
          if (top) v = dx < rx * 0.3 ? 0.88 : 0.7;
          else if (wet) v = 0.3;
          set(px, py, pickRamp(RAMP.stone, v, px, py));
        }
        if (h1 > 0.55) set(sx - 1 + Math.round(h3 * 2), sy - Math.round(ryy) + 1, RAMP.grass[3]); // mach
        y += 3.4 + h3 * 1.2; side = -side; n++;
      }
      // 3) zopár vlniek prúdu cez brod: krátke svetlé čiarky po prúde
      for (let k = 0; k < span * 0.8; k++) {
        const x = Math.round(cx0 - span + hash2(k, 51, seed) * span * 2), cy = rcy(x), hw = hwAt(x);
        const y2 = Math.round(cy + (hash2(k, 53, seed) - 0.5) * hw * 1.4), len = 2 + Math.round(hash2(k, 57, seed) * 2);
        for (let q = 0; q < len; q++) if (isW(x + q, y2) && roadD(x + q, y2) < 5) mix(x + q, y2, TR.water[7], 0.45);
      }
    }
    if (th.mill && typeof BSPR !== 'undefined' && BSPR.mill) { // vodný mlyn stojí na brehu, koleso siaha do potoka
      const spr = BSPR.mill, mx = W - spr.w - 8;
      let surfTop = 1e9; // najvyššia hladina pod budovou – budova stojí na blatovom brehu tesne nad ňou, nie vo vode
      for (let x = mx + 14; x < mx + spr.w; x++) surfTop = Math.min(surfTop, rcy(x) - R.hw);
      const my = Math.floor(surfTop) - spr.h;
      bx.putImageData(img, 0, 0);
      bx.drawImage(spr.c, mx, my);
      const id2 = bx.getImageData(0, 0, W, H); d.set(id2.data);
      for (let x = mx; x < mx + spr.w; x++) for (let y = my; y < my + spr.h; y++) if (y >= 0 && y < H && x >= 0 && x < W) blocked[y * W + x] = 1;
      const wcx = mx + MILL_WHEEL.cx, surf = Math.round(rcy(wcx) - R.hw), hub = surf - 4; // koleso sa ponorí ~4 px pod hladinu
      mill = { x: wcx - 9, y: hub - 9, cx: wcx, cy: hub, wallX: mx + 16, surfY: surf, waterY: surf + 4 };
    }
  }

  else if (th.river) { // potok / rieka v jemnej kresbe: tvary rovnaké ako pri hrubej (v bodoch), farby, zrno, vlnky a drobnosti po pixeloch
    const RV = th.river, ry = H * RV.y;
    const rcy = x => ry + Math.sin(x * 0.045 + seed) * 7;
    const hwAt = x => RV.hw + (vnoise(x * 0.2, 0.5, seed + 51) - 0.5) * 2;
    const bankN = x => 0.8 + Math.pow(vnoise(x * 0.09, 1.5, seed + 71), 1.4) * 6.5;
    const bankS = x => 0.8 + Math.pow(vnoise(x * 0.08, 3.5, seed + 73), 1.4) * 5.5;
    const pebbles = RV.ford ? 0.88 : 0.95;
    const mark = (arr, px, py, v) => { arr[(py / R | 0) * W + (px / R | 0)] = v; }; // voda a prekážky ostávajú po bodoch hry
    const isW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && water[(y | 0) * W + (x | 0)];
    for (let px = 0; px < WR; px++) {
      const x = (px + 0.5) / R, cy = rcy(x), hw = hwAt(x), bn = bankN(x), bs = bankS(x);
      for (let py = Math.floor((cy - hw - bn - 1) * R); py <= Math.ceil((cy + hw + bs + 1) * R); py++) {
        if (py < 0 || py >= HR) continue;
        const y = (py + 0.5) / R, dy = y - cy, ady = Math.abs(dy), onRoad = roadD(x, y) < 1;
        if (ady > hw) { // breh
          const t = (ady - hw) / (dy < 0 ? bn : bs);
          if (t > 1) continue;
          mark(blocked, px, py, 1);
          if (onRoad && RV.bridge) continue;
          const hsh = hash2(px, py, seed + 81);
          if (t > 0.6 && hash2(px >> 1, py >> 1, seed + 82) < (t - 0.6) * 2.4) continue; // tráva zubato zasahuje do piesku (v zhlukoch 2×2 pixely)
          if (t < 0.25) { setH(px, py, pickRamp(TR.sand, 0.04 + hsh * 0.22, px, py)); continue; } // mokrý piesok pri vode
          setH(px, py, pickRamp(TR.sand, 0.2 + t * 0.38 + (hsh - 0.5) * 0.25 + (dy < 0 ? 0.06 : -0.06) - (onRoad ? 0.1 : 0), px, py));
          if (hsh > pebbles) setH(px, py, pickRamp(RAMP.stone, 0.62 + hash2(px, py, 9) * 0.3, px, py)); // kamienok
          continue;
        }
        mark(blocked, px, py, 1);
        const depth = 1 - ady / hw;
        let v = 0.74 - depth * 0.44 + ((px + Math.round(py * 2.3) + Math.round(Math.sin(py * 0.45 + px * 0.105) * 4)) % 22 === 0 ? 0.15 : 0); // tenké šikmé vlnky
        if (dy < 0 && hw - ady < 1.3) v -= 0.2;
        else if (dy > 0 && hw - ady < 1) v += 0.1;
        mark(water, px, py, onRoad && RV.ford ? 2 : 1);
        setH(px, py, pickRamp(TR.water, v, px, py));
      }
    }
    const nearRoad = (x, y, m) => roadD(x, y) < m;
    // trstina pri vode, kamene v prúde, lekná
    for (let x = 1; x < W - 1; x++) {
      const cy = rcy(x), hw = hwAt(x);
      if (nearRoad(x, cy, 6)) continue;
      const h1 = hash2(x, 11, seed), h2 = hash2(x, 13, seed), h3 = hash2(x, 17, seed), px = x * R;
      if (h3 > 0.9 && x % 2 === 0) { // trstina: tenké steblá s hnedým klasom
        const north = h2 > 0.5, by = Math.round((north ? cy - hw + 1 : cy + hw) * R), ht = (4 + Math.round(h1 * 3)) * R;
        for (let k = 0; k < ht; k++) setH(px, by - k, RAMP.grass[k < 3 ? 3 : k > ht - 3 ? 5 : 4]);
        for (let k = 0; k < 3; k++) setH(px, by - ht - k, WOOD[k === 1 ? 4 : 3]);
        setH(px + 1, by - ht - 1, WOOD[2]);
        if (h1 > 0.5) for (let k = 0; k < ht - 4; k++) setH(px + 2 + (k > ht - 8 ? 1 : 0), by - k, RAMP.grass[3]); // druhé steblo, na konci sa ohne
      }
      if (h2 > 0.965 && !nearRoad(x, cy, 14)) { // kameň v prúde s penou
        const sx = px, sy = Math.round((cy + (h1 - 0.5) * hw) * R);
        for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
          if ((i / 3.2) ** 2 + (j / 2.2) ** 2 > 1) continue;
          setH(sx + i, sy + j, j === -2 || (j === -1 && Math.abs(i) < 2) ? RAMP.stone[i < 0 ? 6 : 5] : j === 2 ? RAMP.stone[2] : RAMP.stone[i < 0 ? 5 : 3]);
        }
        for (let i = -2; i <= 2; i++) setH(sx + i, sy + 3, TR.water[2]); // tieň vo vode
        setH(sx - 4, sy + 1, TR.water[7]); setH(sx - 5, sy, TR.water[7]); setH(sx + 4, sy + 1, TR.water[6]); setH(sx + 6, sy + 2, TR.water[6]); // pena
      }
      if (!RV.ford && h1 > 0.975 && !nearRoad(x, cy, 16)) { // leknín so zárezom, leskom a kvetom
        const lx = px, ly = Math.round((cy + (h3 - 0.5) * hw * 0.8) * R);
        for (let j = -3; j <= 3; j++) for (let i = -5; i <= 5; i++) {
          const q = (i / 5) ** 2 + (j / 3) ** 2;
          if (q > 1 || (i > 0 && j < 0 && i > -j * 1.2)) continue; // zárez
          setH(lx + i, ly + j, q > 0.7 ? RAMP.grass[3] : RAMP.grass[j < 0 ? 5 : 4]);
        }
        setH(lx - 2, ly, RAMP.grass[6]); setH(lx - 3, ly + 1, RAMP.grass[6]);
        if (h2 > 0.5) { const pk = hexRGB('#f4b8d0'); setH(lx, ly, pk); setH(lx + 1, ly, pk); setH(lx - 1, ly, pk); setH(lx, ly - 1, hexRGB('#ffffff')); setH(lx, ly + 1, hexRGB('#e898b8')); }
      }
    }
    if (RV.bridge) { // drevený most: dosky naprieč so škárami, zábradlie so stĺpikmi, klince, tieň na vode
      const bcx = Math.round(roadCx(ry)), half = Math.round(roadHw(ry)) + 1, x0 = bcx - half, x1 = bcx + half;
      let top = 1e9, bot = -1e9;
      for (let x = x0; x <= x1; x++) { top = Math.min(top, rcy(x) - hwAt(x) - bankN(x) * 0.5); bot = Math.max(bot, rcy(x) + hwAt(x) + bankS(x) * 0.5); }
      top = Math.floor(top); bot = Math.ceil(bot);
      for (let y = top + 2; y <= bot + 1; y++) for (const sx of [x1 + 1, x1 + 2]) if (water[y * W + sx]) darken(sx, y, sx === x1 + 1 ? 0.55 : 0.75);
      for (let x = x0 + 1; x <= x1 + 2; x++) if (water[(bot + 1) * W + x]) darken(x, bot + 1, 0.6);
      for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) { water[y * W + x] = 0; blocked[y * W + x] = 1; }
      const X0 = x0 * R, X1 = (x1 + 1) * R - 1, T0 = top * R, T1 = (bot + 1) * R - 1, PH = 3 * R;
      for (let py = T0; py <= T1; py++) for (let px = X0; px <= X1; px++) {
        const row = py - T0;
        if (px === X0 || px === X1) { setH(px, py, K); continue; }
        if (px <= X0 + 2 || px >= X1 - 2) { // trám zábradlia (2 pixely), stĺpik každých 5 bodov
          setH(px, py, row % (5 * R) < 2 ? WOOD[px === X0 + 1 || px === X1 - 1 ? 1 : 2] : px === X0 + 1 ? WOOD[6] : px === X0 + 2 ? WOOD[5] : px === X1 - 2 ? WOOD[4] : WOOD[3]);
          continue;
        }
        if (px === X0 + 3 || px === X1 - 3) { setH(px, py, WOOD[1]); continue; } // tieň zábradlia na doskách
        if (row % PH === PH - 1) { setH(px, py, WOOD[1]); continue; } // škára medzi doskami
        const plank = Math.floor(row / PH);
        const pv = 0.56 + (hash2(plank, 7, seed) - 0.5) * 0.28 + (row % PH === 0 ? 0.12 : 0) + (px - X0 < 8 ? 0.06 : 0) - (X1 - px < 8 ? 0.1 : 0);
        setH(px, py, pickRamp(WOOD, pv + (hash2(px, py, 5) - 0.5) * 0.08 + ((px + plank * 5) % 9 === 0 ? -0.08 : 0), px, py)); // letokruhy
        if (row % PH === 1 && (px === X0 + 6 || px === X1 - 6)) setH(px, py, RAMP.stone[5]); // klinec
      }
      for (let px = X0 + 4; px <= X1 - 4; px++) { setH(px, T0, WOOD[2]); setH(px, T1, WOOD[2]); } // prahy na koncoch
      for (const bxp of [x0, x1]) for (let y = top; y <= bot; y++) if ((y - top) % 5 === 0) { // prúd sa čerí okolo stĺpov
        const qx = bxp + (bxp === x0 ? -1 : 1);
        if (water[y * W + qx]) {
          const hx = qx * R + (bxp === x0 ? R - 1 : 0);
          setH(hx, y * R, TR.water[7]); setH(hx, y * R + 1, TR.water[6]);
          if (water[(y + 1) * W + qx]) setH(hx + (bxp === x0 ? -1 : 1), y * R + 2, TR.water[6]);
        }
      }
    }
    if (RV.ford) { // brod: plytčina so štrkovým dnom, kamene na prechod s obrysom 1 pixel, pena a čerenie
      const mixH = (px, py, c, a) => {
        if (px < 0 || py < 0 || px >= WR || py >= HR) return;
        const i = (py * WR + px) * 4; d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a;
      };
      const isWH = (px, py) => isW(px / R, py / R);
      const cx0 = roadCx(ry), span = roadHw(ry) + 10;
      for (let px = Math.floor((cx0 - span) * R); px <= Math.ceil((cx0 + span) * R); px++) {
        const x = (px + 0.5) / R, cy = rcy(x), hw = hwAt(x);
        for (let py = Math.floor((cy - hw) * R); py <= Math.ceil((cy + hw) * R); py++) {
          if (!isWH(px, py)) continue;
          const y = (py + 0.5) / R, a = Math.max(0, Math.min(1, (3 - roadD(x, y)) / 8));
          if (a <= 0) continue;
          const nv = vnoise(x * 0.18, y * 0.3, seed + 93), s0 = TR.sand[2], s1 = TR.sand[4], f = 0.2 + nv * 0.6;
          mixH(px, py, [s0[0] + (s1[0] - s0[0]) * f, s0[1] + (s1[1] - s0[1]) * f, s0[2] + (s1[2] - s0[2]) * f], a * 0.3);
          if (a > 0.6 && hash2(px, py, seed + 91) > 0.992) setH(px, py, pickRamp(RAMP.stone, 0.5, px, py));
        }
      }
      const topY = Math.ceil(rcy(cx0) - hwAt(cx0)) + 1, botY = Math.floor(rcy(cx0) + hwAt(cx0)) - 1;
      const OUT = RAMP.stone[1];
      let y = topY + 1, side = hash2(3, 5, seed) > 0.5 ? 1 : -1, n = 0;
      while (y <= botY - 1) {
        const h1 = hash2(n, 41, seed), h2 = hash2(n, 43, seed), h3 = hash2(n, 47, seed);
        const sx = Math.round((cx0 + side * (2.5 + h1 * 3)) * R), sy = Math.round(y * R);
        const rx = (2.2 + h2 * 1.2) * R, ryy = rx * 0.7 + 0.2 * R;
        const inS = (i, j) => (i / rx) ** 2 + (j / ryy) ** 2 <= 1 + (hash2(sx + i, sy + j, seed + 7) - 0.5) * 0.18;
        for (let j = -4 * R; j <= 4 * R; j++) for (let i = -6 * R; i <= 7 * R; i++) {
          const px = sx + i, py = sy + j;
          if (inS(i, j)) continue;
          if (inS(i + 1, j) || inS(i - 1, j) || inS(i, j + 1) || inS(i, j - 1)) { setH(px, py, OUT); continue; } // obrys
          if (!isWH(px, py)) continue;
          if (inS(i, j - 2 * R) || inS(i - 1, j - 2 * R)) mixH(px, py, TR.water[1], 0.4); // tieň pod kameňom
          else if (i < 0 && inS(i + 2 * R, j) && j <= 0) mixH(px, py, [226, 240, 246], 0.65); // pena na návodnej strane
          else if (i > rx + R && i < rx + 5 * R && (j === 0 || j === 1)) mixH(px, py, TR.water[7], 0.5); // brázda za kameňom
        }
        for (let j = -4 * R; j <= 4 * R; j++) for (let i = -5 * R; i <= 5 * R; i++) {
          if (!inS(i, j)) continue;
          const px = sx + i, py = sy + j, top = !inS(i, j - 1), wet = !inS(i, j + 1);
          let v = 0.52 - i / rx * 0.12 - j / ryy * 0.18 + (hash2(px, py, seed + 17) - 0.5) * 0.08;
          if (top) v = i < rx * 0.3 ? 0.88 : 0.7; else if (!inS(i, j - 2)) v = 0.78; else if (wet) v = 0.3;
          setH(px, py, pickRamp(RAMP.stone, v, px, py));
        }
        if (h1 > 0.55) { const mx = sx - R + Math.round(h3 * 2 * R), my = sy - Math.round(ryy) + 2; setH(mx, my, RAMP.grass[3]); setH(mx + 1, my, RAMP.grass[4]); } // mach
        y += 3.4 + h3 * 1.2; side = -side; n++;
      }
      for (let k = 0; k < span * 0.8; k++) { // vlnky prúdu cez brod
        const x = cx0 - span + hash2(k, 51, seed) * span * 2, cy = rcy(x), hw = hwAt(x);
        const px = Math.round(x * R), py = Math.round((cy + (hash2(k, 53, seed) - 0.5) * hw * 1.4) * R), len = (2 + Math.round(hash2(k, 57, seed) * 2)) * R;
        for (let q = 0; q < len; q++) if (isWH(px + q, py) && roadD((px + q) / R, py / R) < 5) mixH(px + q, py, TR.water[7], 0.45);
      }
    }
    if (th.mill && typeof BSPR !== 'undefined' && BSPR.mill) { // vodný mlyn (kresba po bodoch, na plátne zväčšená 2×)
      const spr = BSPR.mill, mx = W - spr.w - 8;
      let surfTop = 1e9;
      for (let x = mx + 14; x < mx + spr.w; x++) surfTop = Math.min(surfTop, rcy(x) - RV.hw);
      const my = Math.floor(surfTop) - spr.h;
      bx.putImageData(img, 0, 0);
      bx.imageSmoothingEnabled = false; bx.drawImage(spr.c, mx * R, my * R, spr.w * R, spr.h * R);
      const id2 = bx.getImageData(0, 0, WR, HR); d.set(id2.data);
      for (let x = mx; x < mx + spr.w; x++) for (let y = my; y < my + spr.h; y++) if (y >= 0 && y < H && x >= 0 && x < W) blocked[y * W + x] = 1;
      const wcx = mx + MILL_WHEEL.cx, surf = Math.round(rcy(wcx) - RV.hw), hub = surf - 4;
      mill = { x: wcx - 9, y: hub - 9, cx: wcx, cy: hub, wallX: mx + 16, surfY: surf, waterY: surf + 4 };
    }
  }

  if (th.cliffs) { // skalné steny priesmyku
    const cliffEnd = zoneTop - 6;
    const wAt = (y, s) => (y > cliffEnd ? 0 : 30 + (fbm(y * 0.05, s, seed + 61) - 0.5) * 22) * Math.min(1, (cliffEnd - y) / 30);
    const elev = (x, y) => fbm(x * 0.05, y * 0.05, seed + 63);
    for (let y = 0; y < H; y++) {
      const wl = wAt(y, 0.3), wr = wAt(y, 7.7);
      for (let x = 0; x < W; x++) {
        const inL = x < wl, inR = x > W - wr;
        if (!inL && !inR) continue;
        blocked[y * W + x] = 1;
        const edgeDist = inL ? wl - x : x - (W - wr);
        const sl = (elev(x - 1, y - 1) - elev(x + 1, y + 1)) * 6;
        const ridge = ((x * 3 + y * 2 + Math.round(elev(x, y) * 40)) % 11 === 0) ? -0.12 : 0;
        let v = 0.38 + sl * 0.7 + (elev(x, y) - 0.5) * 0.4 + ridge;
        if (edgeDist < 2) v = inL ? 0.14 : 0.7; // ľavá stena tienistá, pravá na svetle
        else if (edgeDist < 5) v -= inL ? 0.12 : -0.08;
        set(x, y, pickRamp(RAMP.stone, v, x, y));
      }
      // tieň pod skalou
      for (let k = 1; k <= 3; k++) { if (wl > 0) darken(Math.ceil(wl) + k - 1, y, 0.7 + k * 0.08); }
    }
    spawn = [Math.round(W * 0.3), Math.round(W * 0.7)];
  }

  if (th.lava) { // lávové praskliny
    for (let y = 0; y < zoneTop - 4; y++) for (let x = 0; x < W; x++) {
      if (!free(x, y, 2)) continue;
      const n = vnoise(x * 0.05, y * 0.05, seed + 71) * 0.7 + vnoise(x * 0.2, y * 0.2, seed + 73) * 0.3;
      const a = Math.abs(n - 0.5);
      const mask = vnoise(x * 0.03, y * 0.03, seed + 75) > 0.45; // praskliny len v niektorých oblastiach
      if (mask && a < 0.009) { set(x, y, pickRamp(TR.lava, 0.85 - a * 40, x, y)); lava.push({ x, y, ph: hash2(x, y, 72) * 6.28 }); }
      else if (mask && a < 0.02) set(x, y, pickRamp(TR.dark, 0.05, x, y));
    }
  }

  // ---- dekorácie ----
  const blob = R === 1 ? (x0, y0, r, ramp, base, outline) => {
    for (let y = -r; y <= r + 2; y++) for (let x = -r; x <= r + 2; x++) {
      if ((x - 1.5) * (x - 1.5) + (y - 1.5) * (y - 1.5) * 1.6 <= r * r) darken(x0 + x, y0 + y, 0.58);
    }
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const q = x * x + y * y * 1.6;
      if (q <= r * r) {
        const light = (-x / r - y / r) * 0.35 + 0.5 - q / (r * r) * 0.15 + (hash2(x0 + x, y0 + y, 77) - 0.5) * 0.25;
        set(x0 + x, y0 + y, pickRamp(ramp, base + (light - 0.5), x0 + x, y0 + y));
      } else if (q <= (r + 1) * (r + 1)) set(x0 + x, y0 + y, outline);
    }
  } : (x0, y0, r, ramp, base, outline) => { // jemná kresba: rovnaký tvar, obrys 1 pixel, lístie v zhlukoch 2×2 pixely
    const cx = x0 * R + R / 2, cy = y0 * R + R / 2, rr = r * R;
    for (let y = -rr; y <= rr + 3 * R; y++) for (let x = -rr; x <= rr + 3 * R; x++) {
      if ((x - 1.5 * R) * (x - 1.5 * R) + (y - 1.5 * R) * (y - 1.5 * R) * 1.6 <= rr * rr) darkenH(cx + x, cy + y, 0.58);
    }
    for (let y = -rr - 1; y <= rr + 1; y++) for (let x = -rr - 1; x <= rr + 1; x++) {
      const q = x * x + y * y * 1.6, px = cx + x, py = cy + y;
      if (q <= rr * rr) {
        const leaf = (hash2(Math.floor(px / 2), Math.floor(py / 2), 78) - 0.5) * 0.3;
        const light = (-x / rr - y / rr) * 0.35 + 0.5 - q / (rr * rr) * 0.15 + (hash2(px, py, 77) - 0.5) * 0.12 + leaf;
        setH(px, py, pickRamp(ramp, base + (light - 0.5), px, py));
      } else if (q <= (rr + 1) * (rr + 1)) setH(px, py, outline);
    }
  };
  const grassy = th.ground === 'grass' || th.ground === 'grassDark' || th.ground === 'dry';
  const tuftRamp = { dry: TR.dry, swamp: TR.swamp, ash: TR.ash, dark: TR.dark, darkLit: TR.darkLit, snow: TR.snow, desert: TR.desert, jungle: TR.jungle, hive: TR.hive }[th.ground] || RAMP.grass;
  for (let k = 0; k < (W * H) / (grassy || th.ground === 'jungle' ? 90 : 220) * (R > 1 ? 1.6 : 1); k++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    if (!free(x, y, 1)) continue;
    const Gr = tuftRamp, n = Gr.length - 1;
    if (R === 1) { set(x, y - 1, Gr[n]); set(x - 1, y, Gr[n - 1]); set(x + 1, y, Gr[n - 2]); set(x, y, Gr[3]); set(x, y + 1, Gr[1]); continue; }
    // trs stebiel: 3–4 steblá po 1 pixeli, prostredné najvyššie, svetlé končeky, tieň pri zemi
    const px = x * R + Math.floor(rnd() * R), py = y * R + Math.floor(rnd() * R), blades = 3 + (rnd() > 0.6 ? 1 : 0);
    for (let b = 0; b < blades; b++) {
      const bx2 = px + b * 1 - 1, h = b === 1 ? 4 : 2 + (b % 2), lean = b === 0 ? -1 : b === blades - 1 ? 1 : 0;
      for (let j = 0; j < h; j++) setH(bx2 + (j === h - 1 ? lean : 0), py - j, j === h - 1 ? Gr[n] : j === 0 ? Gr[3] : Gr[n - 2]);
    }
    setH(px, py + 1, Gr[1]); setH(px - 1, py + 1, Gr[2]);
  }
  if (grassy) {
    const flowerCols = ['#ffffff', '#fff070', '#e84838', '#c8a0ff'].map(hexRGB);
    for (let k = 0; k < (W * H) / 700 * (R > 1 ? 2 : 1); k++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      if (!free(x, y, 2)) continue;
      const c = flowerCols[Math.floor(rnd() * flowerCols.length)];
      if (R === 1) { set(x, y, c); set(x, y + 1, RAMP.grass[1]); continue; }
      const px = x * R, py = y * R; // kvietok: 4 lupienky okolo žltého stredu a stonka
      if (rnd() > 0.5) { setH(px, py - 1, c); setH(px - 1, py, c); setH(px + 1, py, c); setH(px, py + 1, c); setH(px, py, hexRGB('#fff070')); setH(px, py + 2, RAMP.grass[2]); }
      else { setH(px, py, c); setH(px, py + 1, RAMP.grass[3]); setH(px, py + 2, RAMP.grass[1]); }
    }
  }
  const scatter = (count, fn, margin) => {
    for (let k = 0; k < count; k++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * (zoneTop - 16)) + 6;
      if (free(x, y, margin)) fn(x, y);
    }
  };
  const tree = (x, y, ramp, trunkCol, r) => { // strom s kmeňom (pri jemnej kresbe kmeň 2 pixely, pravý tmavší, farby po pixeloch)
    if (R > 1) for (let k = 0; k < 4 * R; k++) { const c = trunkCol(k); setH(x * R, (y + r - 1) * R + k, c); setH(x * R + 1, (y + r - 1) * R + k, [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75]); }
    else for (let k = 0; k < 4; k++) set(x, y + r + k - 1, trunkCol(k));
    blob(x, y, r, ramp, 0.62, ramp[0]);
  };
  const area = W * zoneTop;
  switch (th.deco) {
    case 'bush':
      scatter(area / 2600, (x, y) => blob(x, y, 3 + Math.floor(rnd() * 3), RAMP.bush, 0.6, RAMP.bush[0]), 8);
      break;
    case 'birch': {
      const white = hexRGB('#eee6cc'), dark = hexRGB('#2a2420');
      scatter(area / 380, (x, y) => tree(x, y, TR.birch, k => (k % 2 ? dark : white), 3 + Math.floor(rnd() * 2)), 7);
      scatter(area / 2000, (x, y) => blob(x, y, 3, RAMP.bush, 0.6, RAMP.bush[0]), 6);
      break;
    }
    case 'heath': { // vres: ploché nepravidelné škvrny s fialovými kvietkami, okraj sa stráca do trávy; pár nízkych kríkov
      const heathCols = ['#7a4a8a', '#9a5aa8', '#c88ad8', '#5e3a5a'].map(hexRGB), base = ['#2c3a22', '#34442a'].map(hexRGB);
      scatter(area / 1700, (x, y) => {
        const rx = 6 + Math.floor(rnd() * 8), ry = 3 + Math.floor(rnd() * 3);
        if (R > 1) { // jemná kresba: kvietky po pixeloch, okraj sa rozpadá v zhlukoch 2×2
          for (let py = (y - ry - 1) * R; py <= (y + ry + 1) * R; py++) for (let px = (x - rx - 1) * R; px <= (x + rx + 1) * R; px++) {
            const dx = (px + 0.5) / R - x - 0.5, dy = (py + 0.5) / R - y - 0.5;
            const q = (dx / rx) ** 2 + (dy / ry) ** 2 + (vnoise((x + dx) * 0.35, (y + dy) * 0.35, seed + 91) - 0.5) * 0.7;
            if (q > 1) continue;
            const h = hash2(px, py, seed + 93), hc = hash2(px >> 1, py >> 1, seed + 94);
            if (q > 0.75 && hc < 0.5) continue;
            setH(px, py, h < (q > 0.75 ? 0.7 : 0.4) ? heathCols[Math.floor(hash2(px, py, seed + 95) * heathCols.length)] : base[h < 0.8 ? 0 : 1]);
          }
          return;
        }
        for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
          const q = (dx / rx) ** 2 + (dy / ry) ** 2 + (vnoise((x + dx) * 0.35, (y + dy) * 0.35, seed + 91) - 0.5) * 0.7;
          if (q > 1) continue;
          const h = hash2(x + dx, y + dy, seed + 93);
          if (q > 0.75 && h < 0.5) continue; // okraj sa rozpadá do trávy
          set(x + dx, y + dy, h < (q > 0.75 ? 0.75 : 0.42) ? heathCols[Math.floor(hash2(x + dx, y + dy, seed + 95) * heathCols.length)] : base[h < 0.8 ? 0 : 1]);
        }
      }, 6);
      scatter(area / 3200, (x, y) => blob(x, y, 2 + Math.floor(rnd() * 2), RAMP.bush, 0.55, RAMP.bush[0]), 6);
      break;
    }
    case 'rocks':
      scatter(area / 700, (x, y) => blob(x, y, 1 + Math.floor(rnd() * 3), RAMP.stone, 0.6, K), 4);
      scatter(area / 3000, (x, y) => blob(x, y, 3, RAMP.bush, 0.55, RAMP.bush[0]), 7);
      break;
    case 'outcrop':
      scatter(area / 1500, (x, y) => blob(x, y, 4 + Math.floor(rnd() * 4), RAMP.stone, 0.6, K), 10);
      scatter(area / 900, (x, y) => blob(x, y, 1 + Math.floor(rnd() * 2), RAMP.stone, 0.65, K), 4);
      scatter(area / 3500, (x, y) => blob(x, y, 3, RAMP.bush, 0.5, RAMP.bush[0]), 6);
      break;
    case 'swamp': {
      scatter(area / 1500, (x, y) => { // jazierka
        const rx = 6 + Math.floor(rnd() * 8), ry = 3 + Math.floor(rnd() * 3);
        if (R > 1) { // jemná kresba: tenké vlnky, okraj z blata, tieň pod severným brehom
          for (let py = (y - ry - 2) * R; py <= (y + ry + 2) * R; py++) for (let px = (x - rx - 2) * R; px <= (x + rx + 2) * R; px++) {
            const dx = (px + 0.5) / R - x - 0.5, dy = (py + 0.5) / R - y - 0.5;
            const q = (dx / rx) ** 2 + (dy / ry) ** 2 + (vnoise((x + dx) * 0.3, (y + dy) * 0.3, 9) - 0.5) * 0.5;
            if (q <= 1) setH(px, py, pickRamp(TR.swampW, 0.55 - (dy < -ry * 0.55 ? 0.25 : 0) + ((px + py * 3) % 14 === 0 ? 0.3 : 0), px, py));
            else if (q <= 1.3) setH(px, py, pickRamp(TR.mud, 0.45 + (hash2(px, py, 96) - 0.5) * 0.3, px, py));
          }
          return;
        }
        for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
          const q = (dx / rx) ** 2 + (dy / ry) ** 2 + (vnoise((x + dx) * 0.3, (y + dy) * 0.3, 9) - 0.5) * 0.5;
          if (q <= 1) set(x + dx, y + dy, pickRamp(TR.swampW, 0.55 - (dy < 0 ? 0.25 : 0) + ((dx + dy * 3) % 7 === 0 ? 0.3 : 0), x + dx, y + dy));
          else if (q <= 1.35) set(x + dx, y + dy, pickRamp(TR.mud, 0.5, x + dx, y + dy));
        }
      }, 12);
      const reed = hexRGB('#6a7a30'), reedTop = hexRGB('#6e4422');
      const deadW = hexRGB('#2a1e14');
      if (R > 1) { // jemná kresba: trs tenkých stebiel s klasom, mŕtvy strom s kmeňom 2 pixely a tenkými konármi
        const reedL = hexRGB('#8a9a40');
        scatter(area / 160, (x, y) => {
          const px = x * R, py = y * R;
          for (let k = 0; k < 7; k++) setH(px + (k > 4 ? 1 : 0), py - k, k > 4 ? reedL : reed);
          for (let k = 0; k < 5; k++) setH(px + 2, py - k, reed);
          setH(px + 1, py - 7, reedTop); setH(px + 1, py - 8, reedTop); setH(px + 3, py - 5, reedTop);
        }, 2);
        scatter(area / 4000, (x, y) => {
          const px = x * R, py = y * R;
          for (let k = 0; k < 18; k++) { setH(px, py - k, deadW); if (k < 13) setH(px + 1, py - k, deadW); }
          lineH(px, py - 12, px - 4, py - 15, deadW); lineH(px - 2, py - 14, px - 3, py - 17, deadW);
          lineH(px + 1, py - 8, px + 5, py - 11, deadW); lineH(px + 4, py - 10, px + 6, py - 13, deadW);
          for (let i = -2; i < 7; i++) darkenH(px + i, py + 1, 0.65);
        }, 6);
        break;
      }
      scatter(area / 160, (x, y) => { for (let k = 0; k < 3; k++) set(x + (k % 2), y - k, reed); set(x + 1, y - 3, reedTop); }, 2);
      scatter(area / 4000, (x, y) => { for (let k = 0; k < 9; k++) set(x, y - k, deadW); set(x - 1, y - 6, deadW); set(x - 2, y - 7, deadW); set(x + 1, y - 4, deadW); set(x + 2, y - 5, deadW); }, 6);
      break;
    }
    case 'ruins': {
      if (R > 1) { // jemná kresba: múr z kvádrov 4×3 pixely so škárami, zubatý vrch, obrys 1 pixel; stĺp z bubnov s osvetlenou stranou
        scatter(area / 2200, (x, y) => {
          const w = 8 + Math.floor(rnd() * 14), X = x * R, Y = y * R + R - 1, top = [];
          for (let i = 0; i < w * R; i++) top.push((4 + Math.round((hash2(x + Math.floor(i / R), 3, seed) - 0.3) * 4)) * R - (hash2((i >> 1) + x * R, 4, seed) > 0.75 ? 1 : 0)); // výška po bodoch, občas o pixel nižšia (odlomený kváder)
          for (let i = 0; i < w * R; i++) for (let j = 1; j <= 4; j++) darkenH(X + i + 2, Y + j, j < 3 ? 0.6 : 0.72);
          for (let i = 0; i < w * R; i++) {
            const h = top[i];
            for (let j = 0; j < h; j++) {
              const row = Math.floor(j / 3), mortar = j % 3 === 2 || (i + (row % 2) * 2) % 4 === 3;
              const v = j >= h - 2 ? 0.86 : mortar ? 0.25 : 0.55 + (hash2(Math.floor((i + (row % 2) * 2) / 4) + x * 7, row, seed + 6) - 0.5) * 0.2;
              setH(X + i, Y - j, pickRamp(RAMP.stone, v, X + i, Y - j));
            }
            setH(X + i, Y - h, K);
            if (i > 0 && top[i - 1] !== h) for (let j = Math.min(h, top[i - 1]); j < Math.max(h, top[i - 1]); j++) setH(top[i - 1] > h ? X + i : X + i - 1, Y - j, K); // obrys schodíkov
          }
          for (let j = 0; j <= top[0]; j++) setH(X - 1, Y - j, K);
          for (let j = 0; j <= top[w * R - 1]; j++) setH(X + w * R, Y - j, K);
        }, 10);
        scatter(area / 2600, (x, y) => { // stĺp
          const h = (6 + Math.floor(rnd() * 8)) * R, X = x * R, Y = y * R + R - 1;
          for (let i = 0; i < 12; i++) { darkenH(X + i + 2, Y + 1, 0.6); darkenH(X + i + 2, Y + 2, 0.7); }
          for (let j = 0; j < h; j++) for (let i = 0; i < 8; i++) setH(X + i, Y - j, pickRamp(RAMP.stone, j >= h - 2 ? 0.9 : j % 10 === 0 ? 0.3 : 0.74 - i * 0.07 + (i === 1 ? 0.08 : 0), X + i, Y - j)); // bubny stĺpa
          for (let j = 0; j <= h; j++) { setH(X - 1, Y - j, K); setH(X + 8, Y - j, K); }
          for (let i = -1; i <= 8; i++) setH(X + i, Y - h, K);
        }, 8);
        scatter(area / 900, (x, y) => blob(x, y, 1, RAMP.stone, 0.6, K), 3);
        break;
      }
      scatter(area / 2200, (x, y) => { // rozpadnutý múr
        const w = 8 + Math.floor(rnd() * 14);
        for (let dx = 0; dx < w; dx++) {
          const h = 4 + Math.round((hash2(x + dx, 3, seed) - 0.3) * 4);
          darken(x + dx + 1, y + 1, 0.6); darken(x + dx + 1, y + 2, 0.7);
          for (let dy = 0; dy < h; dy++) {
            const top = dy === h - 1;
            set(x + dx, y - dy, top ? pickRamp(RAMP.stone, 0.85, x + dx, y - dy) : pickRamp(RAMP.stone, ((dy % 2 === 0) || ((x + dx + dy) % 4 === 0)) ? 0.25 : 0.55, x + dx, y - dy));
          }
          set(x + dx, y - h, K);
        }
        set(x - 1, y, K); set(x + w, y, K);
      }, 10);
      scatter(area / 2600, (x, y) => { // stĺp
        const h = 6 + Math.floor(rnd() * 8);
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < 4; dx++) set(x + dx, y - dy, pickRamp(RAMP.stone, dy === h - 1 ? 0.9 : 0.7 - dx * 0.15, x + dx, y - dy));
        for (let dy = 0; dy <= h; dy++) { set(x - 1, y - dy, K); set(x + 4, y - dy, K); }
        for (let dx = -1; dx <= 4; dx++) set(x + dx, y - h, K);
        for (let dx = 0; dx < 6; dx++) darken(x + dx + 1, y + 1, 0.6);
      }, 8);
      scatter(area / 900, (x, y) => blob(x, y, 1, RAMP.stone, 0.6, K), 3);
      break;
    }
    case 'charred': {
      const ch = hexRGB('#1a1412'), ch2 = hexRGB('#3a2a20'), ember = hexRGB('#d83818');
      if (R > 1) { // jemná kresba: ohorený kmeň s puklinami, tenké konáre, žeravé uhlíky
        const ember2 = hexRGB('#f89838');
        scatter(area / 1100, (x, y) => {
          const h = (7 + Math.floor(rnd() * 6)) * R, X = x * R, Y = y * R + R - 1;
          for (let k = 0; k < h; k++) { setH(X, Y - k, k % 6 < 2 ? ch2 : ch); setH(X + 1, Y - k, ch); if (k < h * 0.4) setH(X + 2, Y - k, ch); }
          lineH(X, Y - h + 6, X - 4, Y - h + 3, ch); lineH(X - 3, Y - h + 4, X - 4, Y - h, ch);
          lineH(X + 1, Y - h + 8, X + 6, Y - h + 5, ch); lineH(X + 5, Y - h + 6, X + 7, Y - h + 3, ch);
          if (rnd() > 0.6) { const ey = Y - Math.floor(h / 2); setH(X, ey, ember); setH(X + 1, ey, ember2); setH(X, ey - 1, ember); }
          for (let i = -2; i < 8; i++) { darkenH(X + i, Y + 1, 0.6); darkenH(X + i, Y + 2, 0.72); }
        }, 6);
        scatter(area / 1400, (x, y) => blob(x, y, 2 + Math.floor(rnd() * 2), TR.ash, 0.45, K), 5);
        break;
      }
      scatter(area / 1100, (x, y) => {
        const h = 7 + Math.floor(rnd() * 6);
        for (let k = 0; k < h; k++) { set(x, y - k, k % 3 === 0 ? ch2 : ch); set(x + 1, y - k, ch); }
        set(x - 1, y - h + 3, ch); set(x - 2, y - h + 2, ch); set(x + 2, y - h + 4, ch); set(x + 3, y - h + 3, ch);
        if (rnd() > 0.6) set(x, y - Math.floor(h / 2), ember);
        for (let dx = -1; dx < 4; dx++) darken(x + dx, y + 1, 0.6);
      }, 6);
      scatter(area / 1400, (x, y) => blob(x, y, 2 + Math.floor(rnd() * 2), TR.ash, 0.45, K), 5);
      break;
    }
    case 'snowy': { // zasnežené smreky (tmavé koruny so snehom na vetvách), ľadové balvany, záveje
      const pineD = ['#0e2218', '#16302a', '#1e3e34', '#284c40'].map(hexRGB), snowC = TR.snow;
      const ice = ['#5a7a9a', '#7a9ab8', '#9ab8d0', '#c0d8e8', '#e0eef6'].map(hexRGB);
      const pine = (x, y) => {
        const h = 9 + Math.floor(rnd() * 5);
        for (let dx = -3; dx <= 4; dx++) darken(x + dx, y + 2, 0.75);
        for (let k = 0; k < 2; k++) set(x, y + k, WOOD[1]);
        for (let dy = 0; dy < h; dy++) { const w = Math.round((dy + 1) * 0.42); for (let dx = -w - 1; dx <= w + 1; dx++) {
          const yy = y - h + dy, edge = Math.abs(dx) > w;
          set(x + dx, yy, edge ? K : (dy % 3 === 0 || (dx < 0 && dy % 3 === 1)) ? snowC[dx < 0 ? 7 : 5] : pineD[dx < 0 ? 3 : 1]);
        } }
        set(x, y - h - 1, K);
      };
      scatter(area / 520, pine, 7);
      scatter(area / 1600, (x, y) => blob(x, y, 2 + Math.floor(rnd() * 3), ice, 0.62, K), 5);
      scatter(area / 900, (x, y) => { for (let dx = -4; dx <= 4; dx++) { set(x + dx, y, snowC[7]); if (Math.abs(dx) < 3) set(x + dx, y - 1, snowC[7]); set(x + dx, y + 1, snowC[4]); } }, 3);
      break;
    }
    case 'desert': { // kaktusy, palmy, kamene a vybielené kosti
      const cac = ['#1e3a1a', '#2a5224', '#3c6e30', '#56923a'].map(hexRGB), bone = hexRGB('#f0e8d0');
      scatter(area / 1100, (x, y) => { // kaktus s ramenami
        const h = 7 + Math.floor(rnd() * 5);
        for (let dx = -2; dx < 5; dx++) darken(x + dx, y + 1, 0.7);
        for (let dy = 0; dy < h; dy++) { set(x - 1, y - dy, K); set(x, y - dy, cac[2]); set(x + 1, y - dy, cac[1]); set(x + 2, y - dy, K); }
        for (let dx = -1; dx <= 2; dx++) set(x + dx, y - h, K);
        const ay = y - Math.floor(h * 0.55);
        for (const s2 of [-1, 1]) if (rnd() > 0.3) {
          const ax = s2 < 0 ? x - 3 : x + 4;
          for (let dy = 0; dy < 4; dy++) { set(ax, ay - dy, cac[s2 < 0 ? 3 : 1]); set(ax - 1, ay - dy, K); set(ax + 1, ay - dy, K); }
          set(ax, ay - 4, K);
          for (let q = 1; q <= 2; q++) { const xx = s2 < 0 ? ax + q : ax - q; set(xx, ay, cac[2]); set(xx, ay + 1, K); }
        }
      }, 6);
      scatter(area / 2600, (x, y) => { // palma
        for (let dx = -3; dx <= 4; dx++) darken(x + dx, y + 1, 0.7);
        for (let k = 0; k < 9; k++) set(x + (k > 5 ? 1 : 0), y - k, WOOD[k % 2 ? 2 : 3]);
        const tx = x + 1, ty = y - 10;
        for (const [dx, dy] of [[-5, 1], [-4, 0], [-3, -1], [-2, -1], [-1, -2], [0, -2], [1, -2], [2, -1], [3, -1], [4, 0], [5, 1], [-3, 1], [3, 1], [-1, 0], [1, 0]]) set(tx + dx, ty + dy, RAMP.grass[dy < 0 ? 5 : 3]);
      }, 8);
      scatter(area / 1300, (x, y) => blob(x, y, 1 + Math.floor(rnd() * 3), TR.desert, 0.35, K), 4);
      scatter(area / 3000, (x, y) => { set(x, y, bone); set(x + 1, y, bone); set(x + 2, y + 1, bone); set(x - 1, y + 1, bone); set(x + 3, y, bone); }, 3);
      break;
    }
    case 'jungle': { // husté koruny stromov, kry a paprade
      const fern = TR.jungle;
      scatter(area / 420, (x, y) => tree(x, y, RAMP.bush, k => WOOD[k % 2 ? 1 : 2], 4 + Math.floor(rnd() * 3)), 8);
      scatter(area / 700, (x, y) => blob(x, y, 2 + Math.floor(rnd() * 2), RAMP.grass, 0.45, fern[0]), 5);
      scatter(area / 500, (x, y) => { for (let dx = -3; dx <= 3; dx++) set(x + dx, y - Math.abs(dx) % 2, fern[5]); set(x, y - 2, fern[6]); }, 2);
      break;
    }
    case 'graves': { // náhrobky, kríže, mŕtve stromy a kosti
      const st0 = RAMP.stone, dead = hexRGB('#1a1412'), bone = hexRGB('#d8d0b8');
      scatter(area / 900, (x, y) => { // náhrobok
        for (let dx = 0; dx < 6; dx++) darken(x + dx, y + 1, 0.6);
        for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 4; dx++) set(x + dx, y - dy, pickRamp(st0, dy === 5 ? 0.85 : 0.65 - dx * 0.12, x + dx, y - dy));
        for (let dy = 0; dy <= 6; dy++) { set(x - 1, y - dy, K); set(x + 4, y - dy, K); }
        for (let dx = 0; dx < 4; dx++) set(x + dx, y - 6, K);
        set(x + 1, y - 3, st0[1]); set(x + 2, y - 3, st0[1]); set(x + 1, y - 4, st0[1]);
      }, 5);
      scatter(area / 1400, (x, y) => { for (let k = 0; k < 7; k++) { set(x, y - k, st0[4]); set(x + 1, y - k, K); } for (let dx = -2; dx <= 2; dx++) { set(x + dx, y - 5, st0[5]); set(x + dx, y - 4, K); } }, 4); // kríž
      scatter(area / 1600, (x, y) => { for (let k = 0; k < 11; k++) set(x, y - k, dead); set(x - 1, y - 7, dead); set(x - 2, y - 8, dead); set(x + 1, y - 5, dead); set(x + 2, y - 6, dead); set(x + 3, y - 7, dead); }, 6); // mŕtvy strom
      scatter(area / 1500, (x, y) => { set(x, y, bone); set(x + 1, y, bone); set(x + 2, y, bone); set(x - 1, y - 1, bone); set(x + 3, y + 1, bone); }, 3);
      break;
    }
    case 'hive': { // veže úľa a kukly so svetielkujúcimi bodkami, slizké jamky
      const hv = TR.hive, glow = hexRGB('#e878ff');
      scatter(area / 1700, (x, y) => blob(x, y, 3, hv, 0.15, hv[0]), 6); // slizká jamka
      scatter(area / 1000, (x, y) => { // veža úľa
        const h = 10 + Math.floor(rnd() * 8);
        for (let dx = -3; dx <= 4; dx++) darken(x + dx, y + 1, 0.6);
        for (let dy = 0; dy < h; dy++) { const w = Math.max(0, Math.round((h - dy) / h * 2.5)); for (let dx = -w - 1; dx <= w + 1; dx++) set(x + dx, y - dy, Math.abs(dx) > w ? K : pickRamp(hv, 0.75 - dx * 0.15 - (dy % 4 === 0 ? 0.25 : 0), x + dx, y - dy)); }
        set(x, y - h, glow); set(x - 1, y - Math.floor(h / 2), glow);
      }, 7);
      scatter(area / 1300, (x, y) => { blob(x, y, 2 + Math.floor(rnd() * 2), hv, 0.55, K); set(x - 1, y - 1, glow); }, 5); // kukla
      break;
    }
    case 'orc': {
      const bone = hexRGB('#eee6cc'), bone2 = hexRGB('#a8a088');
      if (R > 1) { // jemná kresba: kosti s hrčkami na koncoch a tieňom
        scatter(area / 1400, (x, y) => {
          for (let k = 0; k < 5; k++) {
            const bx2 = (x + Math.floor(rnd() * 6) - 3) * R, by2 = (y + Math.floor(rnd() * 3)) * R, len = 3 + Math.floor(rnd() * 2), up = rnd() > 0.5;
            for (let i = 0; i < len; i++) { const yy = by2 - (up && i > 1 ? 1 : 0); setH(bx2 + i, yy, bone); setH(bx2 + i, yy + 1, bone2); }
            setH(bx2 - 1, by2 - 1, bone); setH(bx2 + len, by2 - 1 - (up ? 1 : 0), bone); // hrčky
          }
        }, 3);
        scatter(area / 1600, (x, y) => blob(x, y, 2, TR.darkLit, 0.5, K), 4);
        break;
      }
      scatter(area / 1400, (x, y) => { // hromádka kostí
        for (let k = 0; k < 5; k++) { const bx2 = x + Math.floor(rnd() * 6) - 3, by2 = y + Math.floor(rnd() * 3); set(bx2, by2, bone); set(bx2 + 1, by2, bone2); }
      }, 3);
      scatter(area / 1600, (x, y) => blob(x, y, 2, TR.darkLit, 0.5, K), 4);
      break;
    }
  }

  bx.putImageData(img, 0, 0);
  return { bg, R, theme: th, foam, lava, spawn, water, mill, fortX };
}
