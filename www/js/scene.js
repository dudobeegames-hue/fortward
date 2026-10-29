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

// G: { T, gx0, gy0, cols, rows, hallCx, hallTop, hallBot, zoneTopMax }
// clear = obdĺžniky [x0, y0, x1, y1] bez stromov a skál (stavby tábora hordy); yard = 'planks' – nádvorie z dosiek (orkovia), 'none' – bez nádvoria
// terr = terén územia (LANDS v world.js): zem vždy, cestu, dekorácie a počasie, ak téma nie je v terr.keep; more s penou, rieky a mlyn ostanú
function buildScene(W, H, G, seed, themeIdx, clear, yard, terr) {
  let th = THEMES[((themeIdx || 0) % THEMES.length + THEMES.length) % THEMES.length];
  if (terr) th = Object.assign({}, th, { ground: terr.ground }, (terr.keep || []).includes(th.key) ? {} : { road: terr.road, deco: terr.deco }, (terr.keep || []).includes(th.key) || th.anim === 'foam' ? {} : { anim: terr.anim });
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const bx = bg.getContext('2d');
  const img = bx.createImageData(W, H), d = img.data;
  const K = hexRGB(PAL.K);
  const set = (x, y, c) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  };
  const darken = (x, y, f) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f * 1.05;
  };
  const zoneTop = G.zoneTopMax;

  // cesta zhora k bráne radnice
  const roadCx = y => {
    const k = Math.max(0, Math.min(1, (G.hallTop - y) / 140));
    return G.hallCx + (Math.sin(y * 0.021 + seed) * (th.cliffs ? 5 : 12) + Math.sin(y * 0.053 + 1) * 4) * k;
  };
  const roadHw = y => (th.cliffs ? 7 : 9) + Math.max(0, Math.min(1, y / G.hallTop)) * 7;
  const roadD = (x, y) => y > G.hallTop + 4 ? 99 : Math.abs(x - roadCx(y)) - roadHw(y) + (vnoise(x * 0.3, y * 0.3, seed + 3) - 0.5) * 5;
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
  for (let y = 0; y < H; y++) {
    const cx = roadCx(y), hw = roadHw(y);
    for (let x = 0; x < W; x++) {
      const dd = roadD(x, y), yd = yardD(x, y);
      if (yd < 0 && yard === 'planks') { // orkské nádvorie: hrubé dosky ako orkský chodník, okraj tmavší
        const c = plankRGB(x, y);
        set(x, y, yd > -2 ? [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75] : c);
      } else if (yd < 0) {
        const row = Math.floor(y / 5), off = (row % 2) * 3, col = Math.floor((x + off) / 6);
        let v = 0.5 + (hash2(col, row, seed + 21) - 0.5) * 0.3 + (hash2(x, y, seed + 22) - 0.5) * 0.1;
        if (y % 5 === 0 || (x + off) % 6 === 0) v = 0.15;
        else if (y % 5 === 1 || (x + off) % 6 === 1) v += 0.12;
        if (yd > -2) v -= 0.15;
        set(x, y, pickRamp(RAMP.walk, v, x, y));
      } else if (dd < 0) {
        if (th.road === 'cobble') {
          const row = Math.floor(y / 4), off = (row % 2) * 2, col = Math.floor((x + off) / 5);
          let v = 0.45 + (hash2(col, row, seed + 23) - 0.5) * 0.35;
          if (y % 4 === 0 || (x + off) % 5 === 0) v = 0.12;
          if (dd > -2 || hash2(col, row, seed + 24) > 0.92) { set(x, y, pickRamp(groundRamp, 0.3, x, y)); continue; } // tráva (zem územia) medzi kameňmi
          set(x, y, pickRamp(RAMP.stone, v, x, y));
          continue;
        }
        const ramp = { mud: TR.mud, ashroad: TR.ashroad, snowroad: TR.snowroad, sandroad: TR.sandroad, hiveroad: TR.hiveroad }[th.road] || RAMP.dirt;
        let v = 0.52 + (fbm(x * 0.08, y * 0.08, seed + 5) - 0.5) * 0.5 + (hash2(x, y, seed + 9) - 0.5) * 0.16;
        const rut = Math.abs(Math.abs(x - cx) - hw * 0.45);
        if (rut < 1.2) v -= 0.2;
        else if (rut < 2.2 && x < cx) v += 0.06;
        if (dd > -2) v -= 0.14;
        if (th.road === 'mud' && fbm(x * 0.15, y * 0.15, seed + 31) > 0.66) { set(x, y, pickRamp(TR.swampW, 0.5 + (x < cx ? 0.2 : 0), x, y)); continue; } // kaluže
        if (hash2(x, y, seed + 11) > 0.985) v += 0.3;
        set(x, y, pickRamp(ramp, v, x, y));
      } else {
        let v = 0.56 + groundBias + (fbm(x * 0.05, y * 0.05, seed + 1) - 0.5) * 0.6 + (hash2(x, y, seed + 2) - 0.5) * 0.2;
        if (dd < 3) v -= 0.18 * (1 - dd / 3);
        if (yd < 3) v -= 0.15 * (1 - yd / 3);
        v += (1 - (x + y) / (W + H)) * 0.08;
        if (th.ground === 'desert') { const r = Math.sin(x * 0.12 + y * 0.31 + fbm(x * 0.02, y * 0.02, seed + 61) * 7); v += r > 0.75 ? 0.14 : r < -0.5 ? -0.1 : 0; } // dlhé duny
        else if (th.ground === 'snow' && fbm(x * 0.09, y * 0.09, seed + 63) > 0.66) v -= 0.16;                                   // závoje a jamky v snehu
        set(x, y, pickRamp(groundRamp, v, x, y));
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
    for (let y = 0; y < H; y++) {
      const e = edge(y);
      for (let x = 0; x < Math.ceil(e) + 1 && x < W; x++) {
        blocked[y * W + x] = 1;
        if (x < e - 5) {
          const depth = (e - 5 - x) / 20;
          let v = 0.75 - depth * 1.4 + ((y + Math.round(Math.sin(x * 0.4) * 1.5)) % 6 === 0 ? 0.1 : 0);
          if (x > e - 7) { v = 0.95; foam.push({ x, y, ph: hash2(x, y, 5) * 6.28 }); }
          set(x, y, pickRamp(TR.water, v, x, y));
        } else set(x, y, pickRamp(TR.sand, 0.55 + (x - e + 5) * 0.06 + (hash2(x, y, 6) - 0.5) * 0.2, x, y));
      }
    }
    // mólo
    const py = Math.round(H * 0.42), pe = Math.round(edge(py)) + 4;
    for (let y = py; y < py + 5; y++) for (let x = 0; x < pe; x++) set(x, y, pickRamp(WOOD, y === py ? 0.7 : y === py + 4 ? 0.15 : (x % 4 === 0 ? 0.3 : 0.5), x, y));
    for (let x = 2; x < pe; x += 5) { set(x, py + 5, WOOD[1]); set(x, py + 6, WOOD[1]); }
    // pena pod mólom by cez dosky preblikávala
    for (let i = foam.length - 1; i >= 0; i--) {
      const f = foam[i];
      if (f.x < pe && (f.y >= py && f.y < py + 5 || (f.y === py + 5 || f.y === py + 6) && f.x >= 2 && (f.x - 2) % 5 === 0)) foam.splice(i, 1);
    }
    // loďka
    const by = Math.round(H * 0.2), bx0 = 2;
    for (let x = 0; x < 11; x++) { set(bx0 + x, by, x === 0 || x === 10 ? K : WOOD[5]); set(bx0 + x, by + 1, x === 0 || x === 10 ? K : WOOD[3]); }
    for (let x = 1; x < 10; x++) set(bx0 + x, by + 2, K);
    for (let y = 1; y <= 9; y++) set(bx0 + 5, by - y, WOOD[2]);
    for (let y = 2; y <= 8; y++) for (let x = 1; x <= Math.floor((y - 1) * 0.6); x++) set(bx0 + 5 + x, by - 10 + y, hexRGB(x === 1 ? '#c4b89e' : '#eee6cc'));
    spawn = [Math.round(edge(0)) + 10, spawn[1]];
  }

  if (th.river) { // potok / rieka naprieč poľom
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
  const blob = (x0, y0, r, ramp, base, outline) => {
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
  };
  const grassy = th.ground === 'grass' || th.ground === 'grassDark' || th.ground === 'dry';
  const tuftRamp = { dry: TR.dry, swamp: TR.swamp, ash: TR.ash, dark: TR.dark, darkLit: TR.darkLit, snow: TR.snow, desert: TR.desert, jungle: TR.jungle, hive: TR.hive }[th.ground] || RAMP.grass;
  for (let k = 0; k < (W * H) / (grassy || th.ground === 'jungle' ? 90 : 220); k++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    if (!free(x, y, 1)) continue;
    const Gr = tuftRamp, n = Gr.length - 1;
    set(x, y - 1, Gr[n]); set(x - 1, y, Gr[n - 1]); set(x + 1, y, Gr[n - 2]); set(x, y, Gr[3]); set(x, y + 1, Gr[1]);
  }
  if (grassy) {
    const flowerCols = ['#ffffff', '#fff070', '#e84838', '#c8a0ff'].map(hexRGB);
    for (let k = 0; k < (W * H) / 700; k++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      if (!free(x, y, 2)) continue;
      set(x, y, flowerCols[Math.floor(rnd() * flowerCols.length)]); set(x, y + 1, RAMP.grass[1]);
    }
  }
  const scatter = (count, fn, margin) => {
    for (let k = 0; k < count; k++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * (zoneTop - 16)) + 6;
      if (free(x, y, margin)) fn(x, y);
    }
  };
  const tree = (x, y, ramp, trunkCol, r) => { // strom s kmeňom
    for (let k = 0; k < 4; k++) set(x, y + r + k - 1, trunkCol(k));
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
        for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
          const q = (dx / rx) ** 2 + (dy / ry) ** 2 + (vnoise((x + dx) * 0.3, (y + dy) * 0.3, 9) - 0.5) * 0.5;
          if (q <= 1) set(x + dx, y + dy, pickRamp(TR.swampW, 0.55 - (dy < 0 ? 0.25 : 0) + ((dx + dy * 3) % 7 === 0 ? 0.3 : 0), x + dx, y + dy));
          else if (q <= 1.35) set(x + dx, y + dy, pickRamp(TR.mud, 0.5, x + dx, y + dy));
        }
      }, 12);
      const reed = hexRGB('#6a7a30'), reedTop = hexRGB('#6e4422');
      scatter(area / 160, (x, y) => { for (let k = 0; k < 3; k++) set(x + (k % 2), y - k, reed); set(x + 1, y - 3, reedTop); }, 2);
      const deadW = hexRGB('#2a1e14');
      scatter(area / 4000, (x, y) => { for (let k = 0; k < 9; k++) set(x, y - k, deadW); set(x - 1, y - 6, deadW); set(x - 2, y - 7, deadW); set(x + 1, y - 4, deadW); set(x + 2, y - 5, deadW); }, 6);
      break;
    }
    case 'ruins': {
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
      scatter(area / 1400, (x, y) => { // hromádka kostí
        for (let k = 0; k < 5; k++) { const bx2 = x + Math.floor(rnd() * 6) - 3, by2 = y + Math.floor(rnd() * 3); set(bx2, by2, bone); set(bx2 + 1, by2, bone2); }
      }, 3);
      scatter(area / 1600, (x, y) => blob(x, y, 2, TR.darkLit, 0.5, K), 4);
      break;
    }
  }

  bx.putImageData(img, 0, 0);
  return { bg, theme: th, foam, lava, spawn, water, mill, fortX };
}
