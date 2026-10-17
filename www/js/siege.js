'use strict';
// Fortward – obliehacie stroje ako malé 3D modely z kociek (voxely). Model (x doprava, y hore, z dopredu = smer jazdy)
// sa otočí do 8 smerov a premietne v šikmom pohľade zhora ako zvyšok scény. Steny kociek sa tieňujú podľa svetla
// zľava zhora, farby sa vyberajú z paliet, hrany v hĺbke stmavnú a celok dostane tmavý obrys.
// Kolesá sa pri jazde točia (snímky chôdze = pootočenie kolies) a posádka, ktorá stroj tlačí, kráča.

const VOX_UP = 0.82, VOX_DEPTH = 0.57; // sklon kamery: výška sa skráti, hĺbka (k divákovi) sa zobrazí ako posun nadol
const VOX_LIGHT = (() => { const l = [-0.55, 0.7, 0.45], n = Math.hypot(...l); return l.map(v => v / n); })(); // [vpravo, hore, k divákovi]
const R_STEEL = ['#16161c', '#26262e', '#3a3a44', '#55555f', '#7a7a86', '#a0a0aa', '#d0d0da'].map(hexRGB);
const R_COPPER = ['#3a1a0c', '#6a3418', '#a0582a', '#d08848', '#f0b878'].map(hexRGB);
const R_ROCK = ['#22202a', '#3c3846', '#4e4858', '#625a6c', '#7a7286', '#9a92a6'].map(hexRGB);
const R_SKIN = ['#5a3420', '#8a5434', '#b87850', '#d8986c', '#f0b888', '#ffd8b0'].map(hexRGB);
const R_GOLD = ['#4a3008', '#6e4a10', '#b88420', '#f8d048', '#fff070'].map(hexRGB);
const R_HIDE = ['#1e120a', '#3a2214', '#5a3420', '#7a4a2c', '#9a6440', '#b8804e'].map(hexRGB); // surové kože hordy
const R_ORC = ['#1e3a16', '#305c22', '#3e7a2a', '#62a03a', '#7cb848', '#9cd45a'].map(hexRGB);
const R_BONE = ['#6e6650', '#a8a088', '#d4ccb0', '#eee6cc', '#fffaf0'].map(hexRGB);
const vm = (r, v) => ({ r, v });            // materiál s paletou a základným jasom
const vEmit = c => ({ e: hexRGB(c) });       // svietiaci materiál (žeravé uhlíky, plameň) – bez tieňovania

function voxModel() {
  const m = new Map();
  const md = {
    m,
    set(x, y, z, mat) { x = Math.round(x); y = Math.round(y); z = Math.round(z); m.set(x + ',' + y + ',' + z, { x, y, z, mat }); },
    has(x, y, z) { return m.has(x + ',' + y + ',' + z); },
    box(x0, y0, z0, x1, y1, z1, mat) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
        md.set(x, y, z, typeof mat === 'function' ? mat(x, y, z) : mat);
    },
    line(a, b, w, mat) { // trám z bodu a do b (hrúbka w kociek naprieč v osi x)
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 3);
      for (let i = 0; i <= n; i++) for (let k = 0; k < w; k++) {
        const t = i / n;
        md.set(a[0] + (b[0] - a[0]) * t + k, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, mat);
      }
    },
  };
  return md;
}
// koleso z boku (os v smere x): železná obruč, drevený veniec, 4 lúče pootočené o phase, železný náboj
function voxWheel(md, x0, x1, cy, cz, r, phase) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) {
    const dy = y + 0.5 - cy, dz = z + 0.5 - cz, d = Math.hypot(dy, dz);
    if (d > r) continue;
    const a = Math.atan2(dy, dz) + phase;
    let mat = null;
    if (d > r - 0.8) mat = vm(R_STEEL, 0.5);
    else if (d > r - 1.5) mat = vm(WOOD, 0.62);
    else if (d < 0.75) mat = vm(R_STEEL, 0.7);
    else if (Math.abs(Math.sin(2 * a)) < 0.42) mat = vm(WOOD, 0.4);
    if (mat) for (let x = x0; x <= x1; x++) md.set(x, y, z, mat);
  }
}
// vojak posádky (modrá kazajka, oceľová prilba) otočený dopredu; step = fáza kroku (-1, 0, 1), push = ruky natiahnuté dopredu
// orc = ork z hordy (zelená koža, kožená zbroj, bez prilby)
function voxSoldier(md, x, z, step, push, orc) {
  const cloth = orc ? vm(R_HIDE, 0.55) : vm(ROOF_BLUE, 0.62), skin = orc ? vm(R_ORC, 0.6) : vm(R_SKIN, 0.6);
  for (const [lx, s] of [[x, step], [x + 1, -step]]) { // nohy: chodidlo vpred / vzad, koleno v strede
    md.set(lx, 0, z + s, vm(WOOD, 0.3));
    md.set(lx, 1, z, orc ? vm(R_ORC, 0.4) : vm(ROOF_BLUE, 0.3));
  }
  md.box(x, 2, z, x + 1, 4, z, cloth);                        // trup
  md.box(x, 3, z, x + 1, 3, z, vm(WOOD, 0.45));               // opasok
  if (push) { md.set(x - 1, 4, z + 1, skin); md.set(x + 2, 4, z + 1, skin); } // ruky tlačia do stroja
  md.box(x, 5, z, x + 1, 5, z, skin);                         // hlava
  md.box(x, 6, z, x + 1, 6, z, orc ? vm(R_ORC, 0.75) : vm(R_STEEL, 0.62)); // temeno / prilba
}
// zástavka kráľovstva na žrdi
function voxFlag(md, x, z, y0, y1, f) {
  md.box(x, y0, z, x, y1, z, vm(WOOD, 0.3));
  md.box(x + 1, y1 - 1, z, x + 2, y1, z, vm(ROOF_BLUE, 0.7));
  md.set(x + 3, y1 - (f & 1), z, vm(ROOF_BLUE, 0.55));        // cíp zástavky sa trepoce
}

// ---- modely; f = snímka jazdy 0–3 (pootočenie kolies, krok posádky), act = stav akcie stroja ----
const STEPS = [1, 0, -1, 0];
function voxRam(f, act) {
  const md = voxModel(), ph = f * Math.PI / 8;
  voxWheel(md, -5, -5, 2.6, -4, 2.7, ph); voxWheel(md, 4, 4, 2.6, -4, 2.7, ph);
  voxWheel(md, -5, -5, 2.6, 5, 2.7, ph); voxWheel(md, 4, 4, 2.6, 5, 2.7, ph);
  md.box(-4, 2, -5, 3, 2, -4, vm(R_STEEL, 0.4)); md.box(-4, 2, 4, 3, 2, 5, vm(R_STEEL, 0.4)); // nápravy
  md.box(-4, 3, -7, -4, 3, 7, vm(WOOD, 0.55)); md.box(3, 3, -7, 3, 3, 7, vm(WOOD, 0.55));     // pozdĺžne trámy
  for (const z of [-7, 0, 7]) { md.box(-4, 4, z, -4, 6, z, vm(WOOD, 0.6)); md.box(3, 4, z, 3, 6, z, vm(WOOD, 0.6)); } // stĺpiky
  for (let y = 7; y <= 11; y++) { // sedlová strecha z koží na drevených rebrách, štíty vpredu a vzadu tmavé drevo
    const a = Math.min(y - 7, 4), x0 = -4 + a, x1 = 3 - a;
    for (let x = x0; x <= x1; x++) for (let z = -7; z <= 7; z++) {
      const gable = z === -7 || z === 7, rib = z % 4 === 0;
      md.set(x, y, z, gable ? vm(WOOD, 0.3) : rib ? vm(WOOD, 0.55) : vm(ROOF_BLUE, 0.6 + (y === 11 ? 0.1 : 0)));
    }
  }
  const push = act ? 3 : 0; // pri údere sa kmeň vymrští dopredu
  md.box(-1, 5, -6 + push, 0, 6, 8 + push, vm(WOOD, 0.5));                     // kmeň
  md.box(-2, 4, 9 + push, 1, 7, 10 + push, vm(R_STEEL, 0.55));                 // okovaná hlavica
  md.set(-1, 6, 11 + push, vm(R_STEEL, 0.8)); md.set(0, 6, 11 + push, vm(R_STEEL, 0.65));
  voxSoldier(md, -3, -1, STEPS[f], false); voxSoldier(md, 1, -1, -STEPS[f], false); // posádka pod strechou
  voxFlag(md, 3, -7, 12, 16, f);
  return md;
}
function voxCat(f, fired) {
  const md = voxModel(), ph = f * Math.PI / 8;
  voxWheel(md, -5, -5, 2.6, -4, 2.7, ph); voxWheel(md, 4, 4, 2.6, -4, 2.7, ph);
  voxWheel(md, -5, -5, 2.6, 4, 2.7, ph); voxWheel(md, 4, 4, 2.6, 4, 2.7, ph);
  md.box(-4, 3, -6, 3, 3, 6, (x, y, z) => vm(WOOD, x % 3 === 0 ? 0.42 : 0.62)); // podlaha z dosiek
  for (const x of [-4, 3]) md.box(x, 4, 1, x, 11, 1, vm(WOOD, 0.6));            // stĺpy
  md.box(-4, 12, 1, 3, 12, 1, vm(WOOD, 0.62));                                 // priečka
  md.box(-1, 12, 0, 0, 12, 0, vm(ROOF_BLUE, 0.6));                              // vypchávka, o ktorú udrie rameno
  md.box(-3, 4, -3, 2, 4, -3, vm(R_STEEL, 0.5));                                // navijak
  const P = [-1, 4.5, -3], E = fired ? [-1, 12, 0] : [-1, 5, -9];              // rameno: po výstrele opreté o priečku
  md.line(P, E, 2, vm(WOOD, 0.55));
  const [ex, ey, ez] = E.map(Math.round);
  md.box(ex - 1, ey, ez - 1, ex + 2, ey, ez + 1, vm(WOOD, 0.4));               // miska
  if (!fired) md.box(ex, ey + 1, ez - 1, ex + 1, ey + 2, ez, vm(R_ROCK, 0.6));  // balvan
  voxSoldier(md, -1, -11, STEPS[f], true);                                     // obsluha tlačí zozadu
  voxFlag(md, -4, -6, 4, 13, f);
  return md;
}
function voxFire(f, blaze) {
  const md = voxModel(), ph = f * Math.PI / 8;
  voxWheel(md, -5, -5, 2.6, -3, 2.7, ph); voxWheel(md, 4, 4, 2.6, -3, 2.7, ph);
  voxWheel(md, -5, -5, 2.6, 4, 2.7, ph); voxWheel(md, 4, 4, 2.6, 4, 2.7, ph);
  md.box(-4, 3, -5, 3, 3, 6, (x, y, z) => vm(WOOD, z % 3 === 0 ? 0.42 : 0.6));
  md.box(-2, 4, -2, 1, 4, 2, (x, y, z) => (x + z + f) % 3 === 0 ? vEmit('#fff070') : vEmit('#f89838')); // žeravá pec
  for (let z = -4; z <= 3; z++) for (let x = -4; x <= 3; x++) for (let y = 4; y <= 11; y++) { // ležiaci sud
    const d = Math.hypot(x + 0.5, y + 0.5 - 8);
    if (d > 3.3) continue;
    const hoop = z === -3 || z === 2, end = z === -4 || z === 3;
    md.set(x, y, z, hoop ? vm(R_STEEL, 0.5) : end ? vm(WOOD, 0.4) : vm(WOOD, (x + 8) % 2 ? 0.5 : 0.62));
  }
  md.box(-1, 7, 4, 0, 8, 7, vm(R_COPPER, 0.55));                               // medený sifón
  md.box(-1, 8, 8, 0, 9, 8, vm(R_COPPER, 0.8));                                // ústie
  md.box(-1, 9, 9, 0, 9, 9, blaze || f & 1 ? vEmit('#fff070') : vEmit('#f89838')); // plamienok
  if (blaze) md.box(-1, 10, 9, 0, 10, 10, vEmit('#f89838'));
  voxSoldier(md, -3, -7, STEPS[f], true); voxSoldier(md, 1, -7, -STEPS[f], true);
  voxFlag(md, 3, -5, 4, 13, f);
  return md;
}
function voxTower(f, shot) {
  const md = voxModel(), ph = f * Math.PI / 8;
  for (const x of [-6, 5]) for (const z of [-3, 3]) voxWheel(md, x, x, 2.6, z, 2.7, ph);
  md.box(-5, 3, -5, 4, 3, 4, vm(WOOD, 0.5));                                   // podvozok
  md.box(-5, 4, -5, 4, 16, 4, (x, y, z) => { // telo: rohové trámy, každých 5 riadkov priečny trám, inak modré kože
    const corner = (x === -5 || x === 4) && (z === -5 || z === 4);
    if (corner) return vm(WOOD, 0.6);
    if (y % 4 === 0) return vm(WOOD, 0.5);
    if (z === -5) return vm(WOOD, (x + y) % 2 ? 0.38 : 0.46); // zadná stena z dosiek
    return vm(ROOF_BLUE, 0.58);
  });
  md.box(-5, 17, -5, 4, 17, 4, vm(WOOD, 0.62));                                // plošina
  for (let x = -5; x <= 4; x++) for (let z = -5; z <= 4; z++) {                // cimburie po obvode so zubmi
    if (x > -5 && x < 4 && z > -5 && z < 4) continue;
    md.set(x, 18, z, vm(WOOD, 0.58));
    if ((x + z) % 2 === 0) md.set(x, 19, z, vm(WOOD, 0.64));
  }
  md.box(-3, 11, 5, 2, 16, 5, (x, y, z) => vm(WOOD, x % 2 ? 0.45 : 0.55));     // zdvihnutý padací most vpredu
  const by = shot ? 1 : 0; // lukostrelci pri výstrele vstanú
  for (const x of [-3, 1]) {
    md.box(x, 18 + by, 0, x + 1, 18 + by, 0, vm(ROOF_BLUE, 0.62));
    md.box(x, 19 + by, 0, x + 1, 19 + by, 0, vm(R_SKIN, 0.65));
    md.box(x, 20 + by, 0, x + 1, 20 + by, 0, vm(R_STEEL, 0.62));
    md.box(x + 1, 18 + by, 1, x + 1, 20 + by, 1, vm(WOOD, 0.62));               // luk
  }
  voxSoldier(md, -3, -7, STEPS[f], true); voxSoldier(md, 1, -7, -STEPS[f], true);
  voxFlag(md, 4, -5, 20, 24, f);
  return md;
}

// premietnutie modelu v smere dir (0 V, 1 JV, 2 J, ... 6 S, 7 SV) do plátna W×H; ox, oy = miesto stredu stroja na zemi
function voxRender(md, dir, W, H, ox, oy) {
  const a = dir * Math.PI / 4, fx = Math.cos(a), fy = Math.sin(a), rx = -fy, ry = fx; // smer jazdy a pravý bok na zemi
  const zb = new Float32Array(W * H).fill(-1e9), mat = new Array(W * H).fill(null), lam = new Float32Array(W * H);
  const S = [-0.375, -0.125, 0.125, 0.375];
  for (const { x, y, z, mat: mt } of md.m.values()) {
    // tieň z normály povrchu (priemer odkrytých stien kocky): šikmá stena z kociek tak nemá šachovnicu dvoch odtieňov
    const open = [];
    let sx0 = 0, sy0 = 0, sz0 = 0;
    for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
      const n = [0, 0, 0]; n[ax] = sg;
      if (md.has(x + n[0], y + n[1], z + n[2])) continue;                       // stena skrytá susednou kockou
      open.push([ax, n]); sx0 += n[0]; sy0 += n[1]; sz0 += n[2];
    }
    if (!open.length) continue;
    const nl = Math.hypot(sx0, sy0, sz0) || 1;
    const li = ((sx0 * rx + sz0 * fx) * VOX_LIGHT[0] + sy0 * VOX_LIGHT[1] + (sx0 * ry + sz0 * fy) * VOX_LIGHT[2]) / nl;
    for (const [ax, n] of open) {
      const wg = n[0] * ry + n[2] * fy, wu = n[1];                               // normála steny vo svete
      if (wg * VOX_UP + wu * VOX_DEPTH <= 0.01) continue;                         // odvrátená od kamery
      const u = (ax + 1) % 3, w = (ax + 2) % 3;
      for (const s of S) for (const t of S) {
        const p = [x + 0.5 + n[0] * 0.5, y + 0.5 + n[1] * 0.5, z + 0.5 + n[2] * 0.5];
        p[u] += s; p[w] += t;
        const gx = p[0] * rx + p[2] * fx, gy = p[0] * ry + p[2] * fy;
        const sx = Math.floor(ox + gx), sy = Math.floor(oy + gy * VOX_DEPTH - p[1] * VOX_UP);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const d = gy * VOX_UP + p[1] * VOX_DEPTH, i = sy * W + sx;
        if (d > zb[i]) { zb[i] = d; mat[i] = mt; lam[i] = li; }
      }
    }
  }
  const K = hexRGB(PAL.K), out = new Array(W * H).fill(null);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const i = yy * W + xx, mt = mat[i];
    if (!mt) continue;
    if (mt.e) { out[i] = mt.e; continue; }
    // hrana: sused je o kus bližšie ku kamere – tento bod je za hranou, stmavne (vnútorné obrysy dosiek a trámov)
    let edge = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (yy + dy) * W + xx + dx;
      if (xx + dx >= 0 && xx + dx < W && yy + dy >= 0 && yy + dy < H && mat[j] && zb[j] - zb[i] > 2.2) edge = true;
    }
    // bez ditheringu: na malých stenách by robil šachovnicu, čistý odtieň podľa natočenia steny číta lepšie
    const v = mt.v + lam[i] * 0.45 - 0.14 - (edge ? 0.3 : 0), n = mt.r.length;
    out[i] = mt.r[Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))))];
  }
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { // tmavý obrys okolo siluety
    const i = yy * W + xx;
    if (mat[i]) continue;
    if ((xx > 0 && mat[i - 1]) || (xx < W - 1 && mat[i + 1]) || (yy > 0 && mat[i - W]) || (yy < H - 1 && mat[i + W])) out[i] = K;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const cx = c.getContext('2d'), id = cx.createImageData(W, H);
  out.forEach((col, i) => { if (!col) return; id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255; });
  cx.putImageData(id, 0, 0);
  const spr = spriteFromCanvas(c);
  spr.ax = ox; spr.ay = oy; // kotva: stred stroja na zemi
  return spr;
}
// celá sada stroja: pre každý z 8 smerov postoj, 4 snímky jazdy a snímka akcie (úder, výstrel, plameň)
function buildSiege8(make, stride) {
  const models = { walk: [0, 1, 2, 3].map(f => make(f, false)), act: make(0, true) };
  let R = 0, top = 0; // rozmery plátna podľa najvzdialenejšej kocky od stredu a najvyššej kocky
  for (const md of [...models.walk, models.act]) for (const { x, y, z } of md.m.values()) {
    R = Math.max(R, Math.hypot(Math.abs(x + 0.5) + 0.5, Math.abs(z + 0.5) + 0.5)); top = Math.max(top, y + 1);
  }
  const W = 2 * Math.ceil(R) + 4, below = Math.ceil(R * VOX_DEPTH) + 2, H = Math.ceil(top * VOX_UP + R * VOX_DEPTH) + below + 2;
  const ox = W >> 1, oy = H - below;
  const set = [];
  for (let d = 0; d < 8; d++) {
    const walk = models.walk.map(md => voxRender(md, d, W, H, ox, oy));
    set.push({ idle: walk[0], walk, act: voxRender(models.act, d, W, H, ox, oy) });
  }
  set.stride = stride || 1.05; // pootočenie kolesa o 22,5° = ~1 bod cesty (mamut: dĺžka kroku)
  set.vox = true;
  return set;
}
// ---- horda: orkský baran, obrí baran, vojnový mamut (idú dopredu = k pevnosti) ----
// orkský baran: kolesá z kmeňov, strecha zo surových koží s kostenými hrotmi, okovaná lebka na kmeni, tlačia ho orkovia
function voxOrcRam(f, act, big) {
  const md = voxModel(), ph = f * Math.PI / 8, s = big ? 1.4 : 1;
  const X0 = Math.round(-4 * s), X1 = Math.round(3 * s), Z0 = Math.round(-6 * s), Z1 = Math.round(6 * s), r = big ? 3.6 : 2.7;
  for (const x of [X0 - 1, X1 + 1]) for (const z of [Z0 + Math.round(2 * s), Z1 - Math.round(2 * s)]) {
    const x2 = x + (big ? (x < 0 ? -1 : 1) : 0); // obrie kolesá sú dvojnásobne hrubé
    voxWheel(md, Math.min(x, x2), Math.max(x, x2), r - 0.1, z, r, ph);
    md.set(x + (x < 0 ? -1 : 1) * (big ? 2 : 1), Math.round(r - 0.6), z, vm(R_BONE, 0.7)); // kostený náboj
  }
  md.box(X0, Math.round(r), Z0, X0, Math.round(r), Z1, vm(ORC_WOOD, 0.6)); md.box(X1, Math.round(r), Z0, X1, Math.round(r), Z1, vm(ORC_WOOD, 0.6));
  const y0 = Math.round(r) + 1, roofH = big ? 7 : 5;
  for (const z of [Z0, 0, Z1]) { md.box(X0, y0, z, X0, y0 + 2, z, vm(ORC_WOOD, 0.55)); md.box(X1, y0, z, X1, y0 + 2, z, vm(ORC_WOOD, 0.55)); }
  for (let k = 0; k < roofH; k++) { // strecha z koží, hore hrebeň s kostenými hrotmi
    const y = y0 + 3 + k, a = Math.round(k * (X1 - X0) / 2 / roofH), x0 = X0 + a, x1 = X1 - a;
    for (let x = x0; x <= x1; x++) for (let z = Z0; z <= Z1; z++) {
      const gable = z === Z0 || z === Z1;
      md.set(x, y, z, gable ? vm(ORC_WOOD, 0.3) : vm(R_HIDE, 0.55 + ((z + 40) % 4 === 0 ? -0.15 : 0)));
    }
  }
  const ry = y0 + 3 + roofH;
  for (let z = Z0 + 1; z < Z1; z += 3) md.set(Math.round((X0 + X1) / 2), ry, z, vm(R_BONE, 0.8));
  const push = act ? 3 : 0, ly = y0 + 1;
  md.box(-1, ly, Z0 + 1 + push, 0, ly + 1, Z1 + 2 + push, vm(ORC_WOOD, 0.5));      // kmeň
  const hz = Z1 + 3 + push, hw = big ? 2 : 1;                                      // železná lebka na hlave kmeňa
  md.box(-1 - hw, ly - hw + 1, hz, hw, ly + hw, hz + hw + 1, vm(R_STEEL, 0.55));
  md.set(-1, ly + 1, hz + hw + 2, vEmit('#e84838')); md.set(0, ly + 1, hz + hw + 2, vEmit('#e84838')); // žeravé očnice
  md.line([-2 - hw, ly + hw, hz], [-4 - hw, ly + hw + 3, hz - 1], 1, vm(R_BONE, 0.8)); // rohy
  md.line([1 + hw, ly + hw, hz], [3 + hw, ly + hw + 3, hz - 1], 1, vm(R_BONE, 0.65));
  const n = big ? [-4, -1, 2] : [-3, 1];
  n.forEach((x, i) => voxSoldier(md, x, -1, (i % 2 ? -1 : 1) * STEPS[f], false, true)); // orkovia pod strechou
  return md;
}
// vojnový mamut: huňatý trup, hlava s chobotom a klmi, štyri nohy v kroku (diagonálne páry), na chrbte vežička s goblinmi
function voxMammoth(f, act) {
  const md = voxModel(), st = STEPS[f];
  const fur = (x, y, z) => vm(R_HIDE, 0.5 + ((x * 7 + y * 3 + z * 5) % 5 === 0 ? -0.12 : 0));
  for (let x = -6; x <= 5; x++) for (let y = 5; y <= 14; y++) for (let z = -9; z <= 7; z++) { // trup ako elipsoid
    if (((x + 0.5) / 6) ** 2 + ((y + 0.5 - 10) / 5) ** 2 + ((z + 0.5 + 1) / 8.5) ** 2 <= 1) md.set(x, y, z, fur(x, y, z));
  }
  for (let x = -4; x <= 3; x++) for (let y = 6; y <= 15; y++) for (let z = 6; z <= 12; z++) { // hlava s hrboľom
    if (((x + 0.5) / 4.2) ** 2 + ((y + 0.5 - 11) / 4.5) ** 2 + ((z + 0.5 - 9) / 3.5) ** 2 <= 1) md.set(x, y, z, vm(R_HIDE, 0.6));
  }
  md.set(-3, 11, 12, vEmit('#e84838')); md.set(2, 11, 12, vEmit('#e84838'));     // zlé oči
  const trunkUp = act ? 1 : 0; // pri dupnutí zdvihne chobot
  md.line([-1, 9, 12], [-1, 5 + trunkUp * 5, 14], 2, vm(R_HIDE, 0.45));           // chobot
  md.line([-1, 5 + trunkUp * 5, 14], [-1, 3 + trunkUp * 9, 15 + trunkUp], 2, vm(R_HIDE, 0.4));
  for (const sx of [-1, 1]) {                                                     // kly zahnuté dopredu a hore
    const bx = sx < 0 ? -3 : 2;
    md.line([bx, 8, 11], [bx + sx, 4, 14], 1, vm(R_BONE, 0.85));
    md.line([bx + sx, 4, 14], [bx + sx * 2, 6, 17], 1, vm(R_BONE, 0.9));
  }
  // nohy: stĺpy 3×3, chodidlo predného ľavého a zadného pravého sa posúva opačne ako druhý pár
  for (const [lx, lz, sg] of [[-5, 4, 1], [2, 4, -1], [-5, -6, -1], [2, -6, 1]]) {
    const sh = st * sg * 1.5;
    for (let y = 0; y <= 6; y++) { const dz = Math.round(sh * (1 - y / 6)); md.box(lx, y, lz + dz, lx + 2, y, lz + 2 + dz, vm(R_HIDE, y === 0 ? 0.25 : 0.42)); }
  }
  md.line([0, 11, -10], [0, 7, -11], 1, vm(R_HIDE, 0.35));                         // chvost
  md.box(-4, 15, -6, 3, 15, 3, vm(ORC_WOOD, 0.6));                                  // plošina vežičky
  for (const x of [-4, 3]) for (const z of [-6, 3]) md.box(x, 16, z, x, 19, z, vm(ORC_WOOD, 0.5)); // stĺpiky
  for (let x = -4; x <= 3; x++) { md.set(x, 19, -6, vm(ORC_WOOD, 0.62)); md.set(x, 19, 3, vm(ORC_WOOD, 0.62)); } // zábradlie
  for (let z = -6; z <= 3; z++) { md.set(-4, 19, z, vm(ORC_WOOD, 0.62)); md.set(3, 19, z, vm(ORC_WOOD, 0.62)); }
  for (const x of [-3, 1]) {                                                         // dvaja goblini s lukmi
    md.box(x, 16, -1, x + 1, 17, -1, vm(R_HIDE, 0.6));
    md.box(x, 18, -1, x + 1, 18, -1, vm(R_ORC, 0.7));
    md.box(x + 1, 16, 0, x + 1, 19, 0, vm(ORC_WOOD, 0.75));
  }
  md.box(3, 16, -7, 3, 23, -7, vm(ORC_WOOD, 0.4));                                   // žrď s červenou zástavou
  md.box(4, 21, -7, 5, 23, -7, vEmit('#8c2018')); md.set(6, 22 - (f & 1), -7, vEmit('#e84838'));
  return md;
}
// stroje hráča za orkov: rovnaké modely, len surové drevo, kože namiesto modrých látok a zelená posádka
function orcify(md) {
  const swap = new Map([[ROOF_BLUE, R_HIDE], [WOOD, ORC_WOOD], [R_SKIN, R_ORC]]);
  for (const v of md.m.values()) if (v.mat.r && swap.has(v.mat.r)) v.mat = vm(swap.get(v.mat.r), v.mat.v);
  return md;
}
function initSiegeSprites() {
  SPR.siegeRam8 = buildSiege8(voxRam);
  SPR.siegeCat8 = buildSiege8(voxCat);
  SPR.siegeFire8 = buildSiege8(voxFire);
  SPR.siegeTower8 = buildSiege8(voxTower);
  SPR.ram8 = buildSiege8((f, act) => voxOrcRam(f, act, false));
  SPR.giantRam8 = buildSiege8((f, act) => voxOrcRam(f, act, true), 1.4);
  SPR.mammoth8 = buildSiege8(voxMammoth, 2.2);
  SPR.oSiegeRam8 = SPR.ram8; // orkský baran
  SPR.oSiegeCat8 = buildSiege8((f, act) => orcify(voxCat(f, act)));
  SPR.oSiegeFire8 = buildSiege8((f, act) => orcify(voxFire(f, act)));
  SPR.oSiegeTower8 = buildSiege8((f, act) => orcify(voxTower(f, act)));
}
