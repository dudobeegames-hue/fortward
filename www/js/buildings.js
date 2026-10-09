'use strict';
// Fortward – procedurálne sprity budov (per-pixel tieňovanie, Bayer dithering, automatický obrys).

const ROOF_BLUE = ['#141c40', '#1c2c68', '#22337a', '#2c4ca0', '#3c64c8', '#5a86e8', '#88b4ff'].map(hexRGB);
const ROOF_RED = ['#2a0e0c', '#4a1612', '#6c2018', '#8c2c1c', '#b03c24', '#d05634', '#e87850'].map(hexRGB);
const ROOF_PURP = ['#1e0e30', '#341a52', '#4a2472', '#64349c', '#8048c0', '#a868e8', '#c8a0ff'].map(hexRGB);
const WOOD = ['#1e120a', '#3e2614', '#5a3a1e', '#6e4422', '#8a5a2e', '#a86c38', '#c48a50'].map(hexRGB);
const PLASTER = ['#6a6050', '#8a7e68', '#a89c84', '#c4b89e', '#ddd2b8', '#eee6cc'].map(hexRGB);
const GLOW = hexRGB('#fff070'), GLOW2 = hexRGB('#f89838'), DARKWIN = hexRGB('#2a1e14');
const STONE_DARK = ['#100f14', '#18181f', '#22222c', '#2e2e3a', '#3e3e4c', '#525262', '#686876', '#80808e'].map(hexRGB);
const STONE_WHITE = ['#3e3e4c', '#5e5e6e', '#80808e', '#a0a0ac', '#bebec8', '#d8d8de', '#ececf0', '#ffffff'].map(hexRGB);
const IRON = hexRGB('#3a3a44'), RIVET = hexRGB('#a0a0aa'), GOLD = hexRGB('#f8d048'), GOLD2 = hexRGB('#b88420');
// úroveň 1 drevo, 2 kameň, 3 kameň s kovaním, 4 tmavý opevnený, 5 kráľovský biely so zlatom
const LVL_MAT = [null,
  { body: null, wood: true, roof: ROOF_RED, banner: null },
  { body: null, roof: ROOF_RED, banner: null },
  { body: null, roof: ROOF_BLUE, banner: '#e84838', iron: true },
  { body: STONE_DARK, roof: ROOF_BLUE, banner: '#3c64c8', iron: true, studs: true },
  { body: STONE_WHITE, roof: ROOF_BLUE, banner: '#3c64c8', gold: true },
];
const matBody = lvl => LVL_MAT[lvl].body || RAMP.stone;

// Zo surového canvasu vyrobí sprite so zábleskom (biela) a siluetou.
function spriteFromCanvas(c) {
  const w = c.width, h = c.height;
  const id = c.getContext('2d').getImageData(0, 0, w, h);
  const K = hexRGB(PAL.K);
  const mk = () => { const x = document.createElement('canvas'); x.width = w; x.height = h; return x; };
  const f = mk(), sil = mk();
  const fd = new ImageData(w, h), sd = new ImageData(w, h);
  for (let i = 0; i < id.data.length; i += 4) {
    if (id.data[i + 3] === 0) continue;
    const isK = id.data[i] === K[0] && id.data[i + 1] === K[1] && id.data[i + 2] === K[2];
    const fc = isK ? K : [255, 255, 255], sc = isK ? K : [51, 51, 68];
    fd.data[i] = fc[0]; fd.data[i + 1] = fc[1]; fd.data[i + 2] = fc[2]; fd.data[i + 3] = 255;
    sd.data[i] = sc[0]; sd.data[i + 1] = sc[1]; sd.data[i + 2] = sc[2]; sd.data[i + 3] = 255;
  }
  f.getContext('2d').putImageData(fd, 0, 0);
  sil.getContext('2d').putImageData(sd, 0, 0);
  return { c, f, sil, w, h };
}

// Maliar: vrstvy farieb do bufferu, na konci obrys K okolo siluety.
function painter(w, h) {
  const px = new Array(w * h).fill(null);
  return {
    w, h,
    set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h && c) px[y * w + x] = c; },
    get(x, y) { return (x >= 0 && y >= 0 && x < w && y < h) ? px[y * w + x] : null; },
    shade(x, y, ramp, v) { this.set(x, y, pickRamp(ramp, v, x, y)); },
    finish(outline = true) {
      const K = hexRGB(PAL.K);
      const out = px.slice();
      if (outline) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (px[y * w + x]) continue;
          if ((x > 0 && px[y * w + x - 1]) || (x < w - 1 && px[y * w + x + 1]) || (y > 0 && px[(y - 1) * w + x]) || (y < h - 1 && px[(y + 1) * w + x])) out[y * w + x] = K;
        }
      }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const cx = c.getContext('2d'), id = cx.createImageData(w, h);
      out.forEach((col, i) => { if (!col) return; id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255; });
      cx.putImageData(id, 0, 0);
      return spriteFromCanvas(c);
    },
  };
}

// Valcová kamenná veža (telo). cx, x0..x1, y0..y1
function paintTowerBody(p, x0, x1, y0, y1, seed, ramp) {
  ramp = ramp || RAMP.stone;
  const cx = (x0 + x1) / 2, r = (x1 - x0) / 2 + 0.5;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const nx = (x - cx) / r;
    const course = Math.floor((y - y0) / 4), off = (course % 2) * 3;
    let v = 0.62 - nx * 0.32 - Math.abs(nx) * 0.08 + (hash2(Math.floor((x + off) / 5), course, seed) - 0.5) * 0.18;
    if ((y - y0) % 4 === 3 || (x + off) % 5 === 4) v -= 0.3;
    if (y > y1 - 2) v -= 0.12;
    p.shade(x, y, ramp, v);
  }
}
// drevené telo (zvislé brvná)
function paintWoodBody(p, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const lx = (x - x0) % 3;
    let v = [0.72, 0.52, 0.28][lx] - (x - x0) / (x1 - x0 + 1) * 0.15 + (hash2(x, y, 7) - 0.5) * 0.08;
    if ((y - y0) % 7 === 3) v = 0.12; // previazanie
    p.shade(x, y, WOOD, v);
  }
}
// železný pás s nitmi
function paintBand(p, x0, x1, y) {
  for (let x = x0; x <= x1; x++) { p.set(x, y, IRON); p.set(x, y + 1, IRON); if ((x - x0) % 3 === 1) p.set(x, y, RIVET); }
}
// visiaca zástava
function paintBanner(p, x0, y0, w, h, col) {
  const c = hexRGB(col), dk = hexRGB('#1c140e');
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (y === y0 + h - 1 && (x - x0) % 2 === 1) continue; // zúbkovaný spodok
    p.set(x, y, x === x0 ? hexRGB('#ffffff') : c);
  }
  p.set(x0 + (w >> 1), y0 + 2, GOLD);
  for (let x = x0 - 1; x <= x0 + w; x++) p.set(x, y0 - 1, dk === dk ? hexRGB('#6e4422') : dk);
}
// Cimburie (horná plošina s zubami). Zuby navrchu, pod nimi pás.
function paintParapet(p, x0, x1, y0, y1, ramp, lvl) {
  ramp = ramp || RAMP.stone;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ry = y - y0;
    const tooth = ((x - x0) % 4) < 2;
    if (ry < 2 && !tooth) continue;
    let v = ry === 0 || (ry === 2 && !tooth) ? 0.86 : 0.55 - (x - x0) / (x1 - x0) * 0.25;
    if (y === y1) v = 0.2;
    p.shade(x, y, ramp, v);
    if (lvl >= 4 && ry === 0 && tooth) p.set(x, y, lvl === 5 ? GOLD : RIVET); // kovové / zlaté hroty zubov
  }
}
// Kužeľová strecha
function paintCone(p, cx, yTop, yBot, rBase, ramp) {
  for (let y = yTop; y <= yBot; y++) {
    const hw = (y - yTop + 1) / (yBot - yTop + 1) * rBase;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const nx = (x - cx) / Math.max(1, hw);
      if (Math.abs(nx) > 1.02) continue;
      let v = 0.62 - nx * 0.38 + ((y - yTop) % 3 === 2 ? -0.18 : 0);
      if (y === yBot) v -= 0.2;
      p.shade(x, y, ramp, v);
    }
  }
}

// ---- Radnica (presne 3x3 políčka = 48 px široká, sprite 50x56) – 5 úrovní vzhľadu ----
function makeHall(lvl) {
  lvl = lvl || 3;
  const M = LVL_MAT[lvl], body = matBody(lvl);
  const p = painter(50, 56);
  // hlavná budova
  for (let y = 22; y <= 54; y++) for (let x = 11; x <= 38; x++) {
    if (M.wood) {
      const lx = (x - 11) % 3;
      let v = [0.7, 0.5, 0.3][lx] - (x - 11) / 27 * 0.15 + (hash2(x, y, 52) - 0.5) * 0.06;
      if ((y - 22) % 8 === 7) v = 0.12;
      p.shade(x, y, WOOD, v); continue;
    }
    const course = Math.floor((y - 22) / 4), off = (course % 2) * 4;
    let v = 0.6 - (x - 11) / 27 * 0.2 + (hash2(Math.floor((x + off) / 8), course, 51) - 0.5) * 0.2;
    if ((y - 22) % 4 === 3 || (x + off) % 8 === 7) v -= 0.28;
    if (y > 52) v -= 0.15;
    p.shade(x, y, body, v);
  }
  if (M.iron) paintBand(p, 11, 38, 37);
  if (M.gold) for (let x = 11; x <= 38; x++) p.set(x, 24, x % 2 ? GOLD : GOLD2);
  // sedlová strecha
  for (let y = 6; y <= 23; y++) {
    const hw = (y - 5) / 18 * 15;
    for (let x = Math.floor(24.5 - hw); x <= Math.ceil(24.5 + hw); x++) {
      const nx = (x - 24.5) / Math.max(1, hw);
      if (Math.abs(nx) > 1.03) continue;
      let v = 0.58 - nx * 0.3 + ((y - 6) % 3 === 2 ? -0.2 : 0) + ((x + (Math.floor((y - 6) / 3) % 2) * 2) % 4 === 0 ? -0.08 : 0);
      if (y === 23) { if (M.gold) { p.set(x, y, x % 2 ? GOLD : GOLD2); continue; } v = 0.08; }
      p.shade(x, y, M.roof, v);
    }
  }
  // vikier
  for (let y = 13; y <= 18; y++) for (let x = 22; x <= 27; x++) M.wood ? p.shade(x, y, WOOD, y === 13 ? 0.75 : 0.5) : p.shade(x, y, body, y === 13 ? 0.85 : 0.6);
  for (let y = 14; y <= 17; y++) for (let x = 24; x <= 25; x++) p.set(x, y, y < 16 ? GLOW : GLOW2);
  // brána
  for (let y = 40; y <= 54; y++) for (let x = 19; x <= 30; x++) {
    const dx = x - 24.5, top = 40 + (Math.abs(dx) > 4 ? 2 : Math.abs(dx) > 2 ? 1 : 0);
    if (y < top) continue;
    if (Math.abs(dx) > 5 || y === top) { p.set(x, y, M.gold && y === top ? GOLD : hexRGB('#1c140e')); continue; }
    let v = 0.5 - dx * 0.04 + (x % 3 === 0 ? -0.25 : 0);
    if (y === 46 || y === 50) { if (lvl >= 3) { p.set(x, y, IRON); continue; } v = 0.15; }
    p.shade(x, y, WOOD, v);
  }
  p.set(27, 48, GOLD);
  // okná
  for (const [wx, wy] of [[14, 29], [33, 29]]) {
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) p.set(wx + x, wy + y, y === 0 || x === 0 ? DARKWIN : (y < 3 ? GLOW : GLOW2));
  }
  // zástavy na čele (úroveň 4 a 5)
  if (M.banner && lvl >= 4) { paintBanner(p, 13, 39, 4, 8, M.banner); paintBanner(p, 33, 39, 4, 8, M.banner); }
  // bočné veže
  for (const tx of [1, 36]) {
    if (M.wood) {
      paintWoodBody(p, tx + 1, tx + 11, 20, 54);
      for (let x = tx; x <= tx + 12; x++) for (let y = 16; y <= 20; y++) { // drevený ochoz s hrotmi
        if (y < 18 && (x - tx) % 3 !== 1) continue;
        p.shade(x, y, WOOD, y === 16 ? 0.8 : y === 20 ? 0.15 : 0.55);
      }
    } else {
      paintTowerBody(p, tx + 1, tx + 11, 20, 54, 60 + tx, body);
      paintParapet(p, tx, tx + 12, 16, 21, body, lvl);
      if (M.iron) paintBand(p, tx + 1, tx + 11, 44);
    }
    paintCone(p, tx + 6, 2, 15, 7, M.roof);
    if (M.gold) for (let x = tx + 1; x <= tx + 11; x++) p.set(x, 15, x % 2 ? GOLD : GOLD2);
    for (let y = 0; y < 4; y++) p.set(tx + 6, 28 + y, y === 0 ? DARKWIN : GLOW2);
  }
  // stožiare vlajok; na úrovni 5 zlatá koruna na streche
  for (const tx of [7, 42]) for (let y = 0; y < 3; y++) p.set(tx, y, hexRGB('#4a4e60'));
  if (M.gold) { for (const [cx, cy] of [[23, 3], [25, 2], [27, 3]]) { p.set(cx, cy, GOLD); p.set(cx, cy + 1, GOLD); } for (let x = 23; x <= 27; x++) p.set(x, 5, GOLD2); }
  return p.finish();
}

// ---- Strážna veža s lukostrelcom – 5 úrovní (1 drevená strážnica … 5 kráľovská veža) ----
function paintArcherTop(p, ox, oy) {
  const arch = DEF_ARCHER;
  for (let y = 0; y < 9; y++) for (let x = 0; x < arch[y].length; x++) {
    const ch = arch[y][x];
    if (ch !== '.' && ch !== 'K') p.set(x + ox, y + oy, hexRGB(PAL[ch]));
  }
}
function makeArcherTower(lvl) {
  lvl = lvl || 2;
  const M = LVL_MAT[lvl];
  if (M.wood) { // drevená strážnica na nohách
    const p = painter(18, 32);
    for (const lx of [3, 14]) for (let y = 12; y <= 30; y++) p.shade(lx, y, WOOD, lx === 3 ? 0.65 : 0.38);
    for (const lx of [6, 11]) for (let y = 12; y <= 30; y++) p.shade(lx, y, WOOD, 0.45);
    pLine(p, 4, 15, 13, 23, (x, y) => p.shade(x, y, WOOD, 0.5));
    pLine(p, 13, 15, 4, 23, (x, y) => p.shade(x, y, WOOD, 0.4));
    pLine(p, 4, 23, 13, 30, (x, y) => p.shade(x, y, WOOD, 0.5));
    paintArcherTop(p, 2, 1);
    for (let y = 8; y <= 12; y++) for (let x = 1; x <= 16; x++) { // plošina so zábradlím
      if (y < 10 && (x - 1) % 3 !== 0 && y !== 8) continue;
      p.shade(x, y, WOOD, y === 8 ? 0.8 : y === 12 ? 0.15 : 0.55 - (x - 1) * 0.015);
    }
    return p.finish();
  }
  const h = [0, 0, 34, 36, 38, 40][lvl], body = matBody(lvl);
  const p = painter(18, h);
  const top = h - 34; // vyššie úrovne majú dlhšie telo
  const bx0 = lvl >= 4 ? 2 : 3, bx1 = lvl >= 4 ? 15 : 14;
  paintTowerBody(p, 3, 14, 12, h - 2, 71, body);
  if (lvl >= 4) for (let y = h - 6; y <= h - 2; y++) { p.shade(2, y, body, 0.7); p.shade(15, y, body, 0.25); } // rozšírená päta
  for (let y = 18 + top; y <= 21 + top; y++) { p.set(8, y, DARKWIN); p.set(9, y, DARKWIN); }
  for (let y = h - 8; y <= h - 2; y++) for (let x = 7; x <= 10; x++) p.shade(x, y, WOOD, y === h - 8 ? 0.2 : 0.45 - (x - 7) * 0.05);
  if (M.iron) paintBand(p, 3, 14, 15 + top);
  if (M.gold) for (let x = 3; x <= 14; x++) p.set(x, 14, x % 2 ? GOLD : GOLD2);
  if (M.banner) paintBanner(p, 11, 17 + top, 3, 7 + (lvl >= 4 ? 2 : 0), M.banner);
  paintArcherTop(p, 2, 1);
  paintParapet(p, 1, 16, 8, 13, body, lvl);
  return p.finish();
}

// ---- Veža mága – 5 úrovní ----
function makeMageTower(lvl) {
  lvl = lvl || 2;
  const M = LVL_MAT[lvl], body = matBody(lvl);
  const h = [0, 34, 40, 42, 44, 46][lvl], cone = lvl >= 4 ? 17 : 15;
  const p = painter(18, h);
  const y0 = h - 22; // začiatok tela
  if (M.wood) paintWoodBody(p, 3, 14, y0, h - 2);
  else paintTowerBody(p, 3, 14, y0, h - 2, 81, body);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 2; x++) p.set(8 + x, y0 + 6 + y, y === 0 ? DARKWIN : hexRGB('#c8a0ff'));
  for (let y = h - 8; y <= h - 2; y++) for (let x = 7; x <= 10; x++) p.shade(x, y, WOOD, y === h - 8 ? 0.2 : 0.45);
  if (lvl >= 3) for (let x = 3; x <= 14; x++) p.set(x, y0 + 13, (x % 3 === 0) ? hexRGB('#e0b8ff') : hexRGB('#64349c')); // runový pás
  if (M.gold) { for (let x = 3; x <= 14; x++) { p.set(x, y0 + 1, x % 2 ? GOLD : GOLD2); p.set(x, h - 10, x % 2 ? GOLD : GOLD2); } }
  if (M.wood) for (let x = 1; x <= 16; x++) for (let y = y0 - 4; y <= y0 + 1; y++) p.shade(x, y, WOOD, y === y0 - 4 ? 0.75 : y === y0 + 1 ? 0.15 : 0.5);
  else paintParapet(p, 1, 16, y0 - 4, y0 + 1, body, lvl);
  const coneTop = y0 - 4 - cone + 1;
  paintCone(p, 8.5, Math.max(3, coneTop), y0 - 3, lvl >= 4 ? 9 : 8, ROOF_PURP);
  if (lvl >= 4) for (const [sx, sy] of [[7, y0 - 10], [10, y0 - 7], [8, y0 - 14]]) p.set(sx, sy, GLOW); // hviezdičky na streche
  const tip = Math.max(3, coneTop);
  p.set(8, tip - 2, GLOW); p.set(9, tip - 2, GLOW); p.set(8, tip - 1, GLOW2); p.set(9, tip - 1, GLOW);
  return p.finish();
}

// ---- Kasárne (sprite 18x26) ----
function makeBarracks() {
  const p = painter(18, 26);
  // steny – hrázdené
  for (let y = 12; y <= 24; y++) for (let x = 1; x <= 16; x++) {
    let v = 0.62 - (x - 1) / 15 * 0.2 + (hash2(x, y, 91) - 0.5) * 0.12;
    const beam = x === 1 || x === 16 || x === 8 || x === 9 || y === 12 || y === 18 || y === 24;
    if (beam) p.shade(x, y, WOOD, x === 1 || y === 12 ? 0.55 : 0.32);
    else if ((x - y + 40) % 9 === 0 && y < 18) p.shade(x, y, WOOD, 0.4);
    else p.shade(x, y, PLASTER, v);
  }
  // brána
  for (let y = 18; y <= 24; y++) for (let x = 6; x <= 11; x++) {
    if (y === 18 && (x === 6 || x === 11)) continue;
    p.shade(x, y, WOOD, x === 6 || x === 11 ? 0.12 : 0.42 + (x % 2) * 0.1);
  }
  // sedlová strecha
  for (let y = 1; y <= 12; y++) {
    const hw = (y + 1) / 12 * 9;
    for (let x = Math.floor(8.5 - hw); x <= Math.ceil(8.5 + hw); x++) {
      const nx = (x - 8.5) / hw;
      if (Math.abs(nx) > 1.05 || x < 0 || x > 17) continue;
      let v = 0.58 - nx * 0.3 + ((y - 1) % 3 === 2 ? -0.2 : 0);
      if (y === 12) v = 0.08;
      p.shade(x, y, ROOF_RED, v);
    }
  }
  // štít so znakom (meče)
  for (let y = 6; y <= 10; y++) for (let x = 7; x <= 10; x++) p.shade(x, y, ROOF_BLUE, y === 10 && (x === 7 || x === 10) ? -1 : 0.6 - (x - 7) * 0.1);
  p.set(8, 7, hexRGB('#f4f4f8')); p.set(9, 8, hexRGB('#f4f4f8')); p.set(9, 7, hexRGB('#bcc0cc')); p.set(8, 8, hexRGB('#bcc0cc'));
  return p.finish();
}

// ---- Jama s ostňami (sprite 16x16) ----
function makePit() {
  const p = painter(16, 16);
  const cx = 7.5, cy = 8, rx = 6.5, ry = 5;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (q > 1) continue;
    const inner = ((x - cx) / (rx - 1.5)) ** 2 + ((y - cy - 0.5) / (ry - 1.2)) ** 2;
    if (inner > 1) p.shade(x, y, RAMP.dirt, y < cy ? 0.75 : 0.45); // okraj
    else p.shade(x, y, RAMP.dirt, 0.05 + (y - (cy - ry)) / (2 * ry) * 0.3);
  }
  const metal = [hexRGB('#f4f4f8'), hexRGB('#bcc0cc'), hexRGB('#80869a'), hexRGB('#4a4e60')];
  for (const [sx, sy] of [[4, 9], [7, 8], [10, 9], [6, 11], [9, 11], [12, 10]]) {
    for (let k = 0; k < 4; k++) p.set(sx, sy - 2 + k, metal[k]);
  }
  return p.finish();
}

// ---- Hradby – 16 variantov podľa susedov (bitmaska N=1 E=2 S=4 W=8) × 5 úrovní, sprite 16x24, kreslí sa o 6 px vyššie ----
// úroveň 1 drevená palisáda, 2 kameň, 3 kameň so železným pásom, 4 tmavé opevnenie s nitmi, 5 kráľovský biely kameň so zlatom
function makeWall(mask, lvl) {
  lvl = lvl || 2;
  const M = LVL_MAT[lvl], body = matBody(lvl);
  const p = painter(16, 24);
  const N = mask & 1, E = mask & 2, S = mask & 4, Wn = mask & 8;
  const x0 = Wn ? 0 : 2, x1 = E ? 15 : 13;
  const yTop = N ? 0 : 2, topEnd = S ? 23 : 11, faceEnd = S ? 23 : 19;
  for (let y = yTop; y <= faceEnd; y++) for (let x = x0; x <= x1; x++) {
    if (M.wood) { // palisáda zo zahrotených brvien
      const vert = !(E || Wn) && (N || S); // zvislá palisáda – brvná naprieč
      const lx = vert ? (y % 3) : (x % 3);
      if (y === yTop && !N && !vert && lx !== 1) continue; // hroty brvien
      let v = [0.68, 0.5, 0.28][lx] + (hash2(x, y, 103) - 0.5) * 0.08;
      if (y <= topEnd) v += 0.12; // vrch brvien na svetle
      if (y === topEnd + 3 || (y <= topEnd && y === yTop + 5 && !vert)) v = 0.12; // previazanie lanom
      if (y === faceEnd) v = 0.1;
      p.shade(x, y, WOOD, v);
      continue;
    }
    if (y <= topEnd) {
      // vrchná plocha s chodníkom a zubami na okraji
      const edgeTop = !N && y === yTop, edgeL = !Wn && x === x0, edgeR = !E && x === x1;
      let v = 0.78 + (hash2(x, y, 101 + mask) - 0.5) * 0.14;
      if (edgeTop || edgeL) v = 0.92;
      else if (edgeR) v = 0.5;
      else if (!S && y === topEnd) v = 0.4;
      const toothW = lvl >= 3 ? 4 : 3;
      if ((edgeTop && x % toothW === 0) || (edgeL && y % toothW === 0)) v = 0.35;
      if (M.gold && edgeTop && x % 3 !== 0) { p.set(x, y, x % 2 ? GOLD : GOLD2); continue; }
      if (lvl >= 4 && edgeTop && x % 4 === 2) { p.set(x, y, RIVET); continue; }
      p.shade(x, y, body, v);
    } else {
      // predná stena
      const ry = y - topEnd - 1, ch = lvl >= 4 ? 4 : 3, cw = lvl >= 4 ? 8 : 6;
      const course = Math.floor(ry / ch), off = (course % 2) * (cw >> 1);
      let v = 0.5 + (hash2(Math.floor((x + off) / cw), course, 111) - 0.5) * 0.2;
      if (ry % ch === ch - 1 || (x + off) % cw === cw - 1) v = 0.18;
      if (y === faceEnd) v = 0.12;
      if (M.iron && !S && ry === 3) { p.set(x, y, (x % 3 === 1) ? RIVET : IRON); continue; }
      if (M.studs && !S && ry % ch === 1 && (x + off) % cw === 2) { p.set(x, y, RIVET); continue; }
      if (M.gold && !S && ry === 0) { p.set(x, y, hexRGB('#3c64c8')); continue; }
      p.shade(x, y, body, v);
    }
  }
  return p.finish();
}

// ---- Strážnica brány (16x30): dva piliere s cimburím, preklad a drevená brána; kreslí sa nad hradbu ----
function makeGatehouse(lvl) {
  lvl = lvl || 2;
  const M = LVL_MAT[lvl], body = matBody(lvl);
  const p = painter(16, 30);
  if (M.wood) { // drevená brána s dvoma strážnymi stĺpmi
    for (const px0 of [1, 11]) for (let y = 0; y <= 28; y++) for (let x = px0; x <= px0 + 3; x++) {
      if (y === 0 && x !== px0 + 1) continue;
      p.shade(x, y, WOOD, [0.75, 0.6, 0.45, 0.28][x - px0] - (y % 8 === 7 ? 0.3 : 0));
    }
    for (let y = 5; y <= 28; y++) for (let x = 5; x <= 10; x++) {
      if (y <= 7) { p.shade(x, y, WOOD, y === 5 ? 0.8 : 0.5); continue; }
      p.shade(x, y, WOOD, (x % 2 ? 0.36 : 0.25) - (y === 14 || y === 22 ? 0.2 : 0)); // vráta tmavšie ako stĺpy
    }
    return p.finish();
  }
  for (const px0 of [1, 11]) {
    for (let y = 0; y <= 28; y++) for (let x = px0; x <= px0 + 3; x++) {
      if (y < 2 && (x - px0) % 2 === 1) continue;           // zuby cimburia
      let v = 0.66 - (x - px0) * 0.09 + (hash2(x, y, 131) - 0.5) * 0.12;
      if (y < 2 || y === 2) v = 0.9 - (x - px0) * 0.05;     // vrchná plocha
      else if ((y - 3) % 4 === 3) v -= 0.28;
      else if ((Math.floor((y - 3) / 4) % 2) && x === px0 + 2) v -= 0.22;
      if (y >= 9 && y <= 11 && x >= px0 + 1 && x <= px0 + 2) { p.set(x, y, DARKWIN); continue; }
      if (y === 0 && lvl >= 4) { p.set(x, y, M.gold ? GOLD : RIVET); continue; }
      if (M.iron && y === 18) { p.set(x, y, (x % 2) ? RIVET : IRON); continue; }
      p.shade(x, y, body, v);
    }
  }
  for (let y = 5; y <= 28; y++) for (let x = 5; x <= 10; x++) {
    if (y === 5 && x % 2 === 0) continue;
    if (y <= 6) { if (M.gold && y === 6) { p.set(x, y, x % 2 ? GOLD : GOLD2); continue; } p.shade(x, y, body, 0.88); continue; }
    if (y <= 10) { p.shade(x, y, body, y === 10 ? 0.2 : 0.55 - (x - 5) * 0.04 + (hash2(x, y, 141) - 0.5) * 0.1); continue; }
    const arch = (y === 11 && (x <= 6 || x >= 9)) || (y === 12 && (x === 5 || x === 10));
    if (arch) { p.shade(x, y, body, 0.45); continue; }
    if (y === 16 || y === 23) { p.set(x, y, IRON); continue; }
    p.shade(x, y, WOOD, (x % 2 ? 0.58 : 0.42) - (y > 26 ? 0.12 : 0));
  }
  p.set(9, 20, GOLD);
  return p.finish();
}

// ---- pomocné kreslenie pre nové budovy ----
function pLine(p, x0, y0, x1, y1, fn) { // čiara po pixeloch, fn(x, y, t)
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let k = 0; k <= n; k++) { const t = k / n; fn(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), t); }
}
function pDisk(p, cx, cy, rx, ry, fn) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (q <= 1) fn(x, y, (x - cx) / rx, (y - cy) / ry, q);
  }
}
function pGable(p, cx, yTop, yBot, hwMax, ramp) {
  for (let y = yTop; y <= yBot; y++) {
    const hw = (y - yTop + 1) / (yBot - yTop + 1) * hwMax;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const nx = (x - cx) / Math.max(1, hw);
      if (Math.abs(nx) > 1.05) continue;
      p.shade(x, y, ramp, 0.6 - nx * 0.3 + ((y - yTop) % 3 === 2 ? -0.2 : 0) + (y === yBot ? -0.35 : 0));
    }
  }
}

// ---- Katapult (18x20) ----
function makeCatapult() {
  const p = painter(18, 20);
  // ramená a rám
  pLine(p, 2, 14, 15, 14, (x, y) => { p.shade(x, y, WOOD, 0.55); p.shade(x, y + 1, WOOD, 0.3); });
  for (const ux of [4, 13]) pLine(p, ux, 7, ux, 13, (x, y) => { p.shade(x, y, WOOD, ux === 4 ? 0.6 : 0.4); });
  pLine(p, 4, 7, 13, 7, (x, y) => p.shade(x, y, WOOD, 0.65));
  // vrhacie rameno a lyžica s balvanom
  pLine(p, 6, 13, 13, 2, (x, y) => { p.shade(x, y, WOOD, 0.75); p.shade(x + 1, y, WOOD, 0.45); });
  pDisk(p, 14, 2, 2.2, 1.6, (x, y, nx, ny) => p.shade(x, y, RAMP.stone, 0.6 - nx * 0.2 - ny * 0.2));
  // kolesá
  for (const wx of [3.5, 14.5]) pDisk(p, wx, 16, 3, 3, (x, y, nx, ny, q) => {
    if (q > 0.55 || Math.abs(x - wx) < 0.6 || Math.abs(y - 16) < 0.6) p.shade(x, y, WOOD, 0.5 - nx * 0.15 - ny * 0.15);
  });
  // lano
  pLine(p, 8, 8, 10, 13, (x, y) => p.set(x, y, hexRGB('#c4b89e')));
  return p.finish();
}

// ---- Zlatá baňa (18x18) ----
function makeMine() {
  const p = painter(18, 18);
  pDisk(p, 9, 11, 8.5, 7, (x, y, nx, ny) => { if (y <= 16) p.shade(x, y, RAMP.stone, 0.55 - nx * 0.22 - ny * 0.22 + (hash2(x, y, 151) - 0.5) * 0.2); });
  for (let y = 9; y <= 16; y++) for (let x = 6; x <= 11; x++) p.set(x, y, hexRGB(y < 11 ? '#14100c' : '#0c0806'));
  for (let y = 8; y <= 16; y++) { p.shade(5, y, WOOD, 0.6); p.shade(12, y, WOOD, 0.35); }
  for (let x = 5; x <= 12; x++) p.shade(x, 8, WOOD, 0.7);
  // vozík so zlatom
  for (let y = 13; y <= 15; y++) for (let x = 12; x <= 16; x++) p.shade(x, y, WOOD, y === 13 ? 0.6 : 0.35);
  for (const [gx, gy] of [[13, 12], [14, 12], [15, 12], [14, 11]]) p.set(gx, gy, hexRGB(gy === 11 ? '#fff070' : '#f8d048'));
  p.set(13, 16, hexRGB('#3e3e4c')); p.set(16, 16, hexRGB('#3e3e4c'));
  return p.finish();
}

// ---- Kaplnka (18x30) ----
function makeChapel() {
  const p = painter(18, 30);
  for (let y = 14; y <= 28; y++) for (let x = 3; x <= 14; x++) {
    let v = 0.72 - (x - 3) / 11 * 0.25 + ((y - 14) % 4 === 3 ? -0.2 : 0) + (hash2(x, y, 161) - 0.5) * 0.08;
    if (y === 28) v -= 0.2;
    p.shade(x, y, PLASTER, v);
  }
  pGable(p, 8.5, 6, 15, 8, ROOF_BLUE);
  // zvonička na streche
  for (let y = 2; y <= 6; y++) for (let x = 7; x <= 10; x++) p.shade(x, y, PLASTER, x === 7 ? 0.8 : 0.5);
  for (let x = 6; x <= 11; x++) p.shade(x, 1, ROOF_BLUE, 0.5 - (x - 6) * 0.05);
  p.set(8, 3, hexRGB('#f8d048')); p.set(9, 3, hexRGB('#b88420')); p.set(8, 4, hexRGB('#b88420')); p.set(9, 4, hexRGB('#b88420'));
  // okrúhle okno (rozeta) a dvere
  pDisk(p, 8.5, 18.5, 2, 2, (x, y, nx, ny, q) => p.set(x, y, q > 0.5 ? hexRGB('#3c64c8') : GLOW));
  for (let y = 23; y <= 28; y++) for (let x = 7; x <= 10; x++) if (!(y === 23 && (x === 7 || x === 10))) p.shade(x, y, WOOD, x % 2 ? 0.5 : 0.38);
  return p.finish();
}

// ---- Ohnivá jama (16x16) ----
function makeFirepit() {
  const p = painter(16, 16);
  pDisk(p, 7.5, 8, 6.5, 5, (x, y, nx, ny, q) => {
    if (q > 0.62) p.shade(x, y, RAMP.stone, ny < 0 ? 0.7 : 0.45);
    else p.set(x, y, hexRGB(hash2(x, y, 171) > 0.55 ? '#d83818' : hash2(x, y, 172) > 0.5 ? '#5a1008' : '#2a0e0c'));
  });
  for (const [fx, fy] of [[6, 8], [9, 7], [8, 9]]) { p.set(fx, fy, hexRGB('#f89838')); p.set(fx, fy - 1, hexRGB('#fff070')); }
  return p.finish();
}

// ---- Medvedia pasca (16x16) ----
function makeBeartrap() {
  const p = painter(16, 16);
  const M = [hexRGB('#f4f4f8'), hexRGB('#bcc0cc'), hexRGB('#80869a'), hexRGB('#4a4e60')];
  pDisk(p, 7.5, 8, 5.5, 3.6, (x, y, nx, ny, q) => { if (q > 0.55) p.set(x, y, M[ny < 0 ? 1 : 2]); });
  for (let x = 3; x <= 12; x += 2) { p.set(x, 5, M[0]); p.set(x, 11, M[2]); } // zuby
  pDisk(p, 7.5, 8, 1.4, 1, (x, y) => p.set(x, y, M[3]));                    // spúšť
  pLine(p, 13, 9, 15, 13, (x, y) => p.set(x, y, M[2]));                      // reťaz
  return p.finish();
}

// ---- Dielňa remeselníka (18x24): doskové steny, otvorená brána s nákovou a výhňou, komín, vývesný štít ----
function makeWorkshop() {
  const p = painter(18, 24);
  // doskové steny, svetlo zľava
  for (let y = 11; y <= 22; y++) for (let x = 2; x <= 15; x++) {
    let v = 0.62 - (x - 2) / 13 * 0.22 + (hash2(x, y, 181) - 0.5) * 0.1;
    if ((x - 2) % 3 === 2) v -= 0.22;                     // škáry medzi doskami
    if (y === 22) v -= 0.2;
    p.shade(x, y, WOOD, v);
  }
  // otvorená brána: tmavé vnútro, výheň vzadu, nákova vpredu
  for (let y = 14; y <= 22; y++) for (let x = 5; x <= 11; x++) p.set(x, y, hexRGB(y < 16 ? '#14100c' : '#1e1610'));
  for (let x = 4; x <= 12; x++) p.shade(x, 13, WOOD, 0.75);                     // preklad
  for (let y = 14; y <= 22; y++) { p.shade(4, y, WOOD, 0.75); p.shade(12, y, WOOD, 0.3); }
  p.set(6, 17, GLOW2); p.set(7, 17, GLOW); p.set(6, 18, GLOW2);                   // výheň
  for (let x = 8; x <= 10; x++) p.set(x, 19, x === 8 ? RIVET : IRON);             // nákova
  p.set(9, 20, IRON); p.set(9, 21, IRON); p.set(8, 21, IRON); p.set(10, 21, IRON);
  // šindľová strecha
  pGable(p, 8.5, 2, 11, 9.5, WOOD);
  // kamenný komín s iskrou
  for (let y = 0; y <= 6; y++) for (let x = 12; x <= 13; x++) p.shade(x, y, RAMP.stone, x === 12 ? 0.6 : 0.35);
  p.set(12, 0, hexRGB('#1c140e')); p.set(13, 0, hexRGB('#1c140e'));
  // vývesný štít s kladivom
  for (let x = 14; x <= 17; x++) p.shade(x, 12, WOOD, 0.4);
  for (let y = 13; y <= 16; y++) for (let x = 14; x <= 17; x++) p.shade(x, y, WOOD, y === 13 ? 0.7 : 0.55);
  p.set(15, 14, RIVET); p.set(16, 14, RIVET); p.set(15, 15, WOOD[1]);
  return p.finish();
}

// ---- Strelnica (18x24): drevená prístrešok s modrou strechou, stojan s lukmi a slamený terč ----
// stajne 20x22: drevená stodola so slamenou strechou, kôň vykúka z polovičných dvierok, balík sena
function makeStables() {
  const p = painter(20, 22);
  for (let y = 10; y <= 20; y++) for (let x = 1; x <= 16; x++) {                         // doskové steny
    let v = 0.6 - (x - 1) / 15 * 0.22 + (hash2(x, y, 211) - 0.5) * 0.1;
    if ((x - 1) % 3 === 2) v -= 0.18;
    if (y === 20) v -= 0.2;
    p.shade(x, y, WOOD, v);
  }
  for (let y = 12; y <= 20; y++) for (let x = 5; x <= 12; x++) p.shade(x, y, WOOD, y < 16 ? 0.06 : 0.42 + (x % 2) * 0.08); // dvere: hore tma, dole polovičné dvierka
  for (let x = 5; x <= 12; x++) p.shade(x, 16, WOOD, 0.75);                               // horná hrana dvierok
  pLine(p, 5, 17, 12, 20, (x, y) => p.shade(x, y, WOOD, 0.25)); pLine(p, 12, 17, 5, 20, (x, y) => p.shade(x, y, WOOD, 0.25)); // krížová výstuž
  const HORSE = ['#4a4a58', '#7a7a88', '#a8a8b6', '#d0d0dc', '#f0f0f6'].map(hexRGB); // bieloš
  // konská hlava vykúka z dverí (pohľad spredu): uši, hriva, lysina, svetlejšia papuľa
  for (let y = 10; y <= 15; y++) for (let x = 6; x <= 11; x++) {
    const hw = y <= 11 ? 2.5 : y <= 13 ? 2.2 : 1.6;
    if (Math.abs(x - 8.5) > hw) continue;
    p.shade(x, y, HORSE, (y >= 14 ? 0.95 : 0.78) - (x - 6) * 0.1);
  }
  p.set(6, 9, HORSE[2]); p.set(11, 9, HORSE[1]);                                            // uši
  for (const x of [7, 8, 9, 10]) p.set(x, 10, hexRGB('#2a160a'));                          // hriva
  p.set(7, 12, hexRGB('#1c140e')); p.set(10, 12, hexRGB('#1c140e'));                        // oči
  p.set(8, 15, HORSE[0]); p.set(9, 15, HORSE[0]);                                            // nozdry
  // slamená strecha
  for (let y = 2; y <= 10; y++) {
    const hw = 3 + (y - 2) * 0.95;
    for (let x = Math.floor(8.5 - hw); x <= Math.ceil(8.5 + hw); x++) {
      if (x < 0 || x > 17) continue;
      const nx = (x - 8.5) / hw;
      p.shade(x, y, STRAW, (y === 10 ? 0.25 : 0.72 - nx * 0.28) + ((x + y * 2) % 5 === 0 ? -0.15 : 0));
    }
  }
  for (let x = 5; x <= 12; x++) p.shade(x, 2, STRAW, 0.9);
  // podkova nad dverami
  p.set(7, 9, RIVET); p.set(10, 9, RIVET); p.set(7, 8, RIVET); p.set(10, 8, RIVET); p.set(8, 7, RIVET); p.set(9, 7, RIVET);
  // balík sena vpravo
  for (let y = 16; y <= 20; y++) for (let x = 15; x <= 19; x++) p.shade(x, y, STRAW, 0.85 - (x - 15) * 0.12 - (y - 16) * 0.05 + (y === 18 ? -0.3 : 0));
  return p.finish();
}
// zbrojnica 18x26: kamenný sokel, hrázdené poschodie, modrá strecha, stojan s kopijami a štít pri dverách
function makeArmory() {
  const p = painter(18, 26);
  for (let y = 18; y <= 24; y++) for (let x = 1; x <= 16; x++) {                          // kamenný sokel
    const row = Math.floor((y - 18) / 2), mortar = (y - 18) % 2 === 1 && y !== 24 || (x + row * 3) % 5 === 0;
    p.shade(x, y, RAMP.stone, mortar ? 0.2 : 0.62 - (x - 1) / 15 * 0.25 + (hash2(x, y, 221) - 0.5) * 0.1);
  }
  for (let y = 11; y <= 17; y++) for (let x = 1; x <= 16; x++) {                          // hrázdené poschodie
    const beam = x === 1 || x === 16 || x === 8 || y === 11 || y === 17 || (y === 14 && x !== 8);
    p.shade(x, y, beam ? WOOD : PLASTER, beam ? (x === 1 ? 0.55 : 0.3) : 0.62 - (x - 1) / 15 * 0.2);
  }
  for (const wx of [3, 12]) for (let y = 12; y <= 13; y++) for (let x = wx; x <= wx + 2; x++) p.set(x, y, DARKWIN); // okienka
  for (let y = 19; y <= 24; y++) for (let x = 7; x <= 10; x++) p.shade(x, y, WOOD, y === 19 ? 0.12 : 0.3 + (x % 2) * 0.1); // dvere
  pGable(p, 8.5, 1, 11, 9.5, ROOF_BLUE);                                                    // strecha
  // stojan s kopijami vľavo pred budovou
  for (const sx of [2, 4]) {
    for (let y = 15; y <= 24; y++) p.shade(sx, y, WOOD, sx === 2 ? 0.72 : 0.5);
    p.set(sx, 13, hexRGB('#f4f4f8')); p.set(sx, 14, hexRGB('#bcc0cc')); p.set(sx, 12, hexRGB('#80869a'));
  }
  for (let x = 1; x <= 5; x++) p.shade(x, 20, WOOD, 0.62 - x * 0.05);                      // priečka stojana
  // štít so znakom pri dverách vpravo
  for (let y = 18; y <= 23; y++) for (let x = 12; x <= 15; x++) {
    if (y === 23 && (x === 12 || x === 15)) continue;
    p.shade(x, y, ROOF_BLUE, 0.7 - (x - 12) * 0.12);
  }
  for (let y = 19; y <= 22; y++) p.set(13, y, hexRGB('#f8d048'));
  p.set(12, 20, hexRGB('#f8d048')); p.set(14, 20, hexRGB('#f8d048'));
  return p.finish();
}
function makeRange() {
  const p = painter(18, 24);
  // zadná doskova stena prístrešku
  for (let y = 10; y <= 22; y++) for (let x = 1; x <= 12; x++) {
    let v = 0.55 - (x - 1) / 11 * 0.2 + (hash2(x, y, 191) - 0.5) * 0.1;
    if ((x - 1) % 3 === 2) v -= 0.2;
    if (y === 22) v -= 0.2;
    p.shade(x, y, WOOD, v);
  }
  // stojan s lukmi a tulcom
  for (let y = 13; y <= 21; y++) { p.shade(3, y, WOOD, 0.7); p.shade(9, y, WOOD, 0.3); }
  for (let x = 3; x <= 9; x++) { p.shade(x, 13, WOOD, 0.65); p.shade(x, 18, WOOD, 0.4); }
  for (const bx of [5, 7]) for (let y = 14; y <= 17; y++) p.set(bx + (y === 14 || y === 17 ? 0 : 1), y, WOOD[5]);  // luky
  for (let y = 19; y <= 21; y++) p.shade(5, y, WOOD, 0.5); p.set(5, 18, hexRGB('#f4f4f8')); p.set(6, 18, hexRGB('#e84838'));
  // modrá strecha prístrešku
  pGable(p, 6.5, 3, 10, 7, ROOF_BLUE);
  // slamený terč na nohách (pred prístreškom vpravo)
  for (const lx of [12, 16]) for (let y = 17; y <= 22; y++) p.shade(lx, y, WOOD, lx === 12 ? 0.6 : 0.35);
  pDisk(p, 14, 14, 3.6, 3.6, (x, y, nx, ny, q) => {
    const col = q < 0.12 ? hexRGB('#f8d048') : q < 0.35 ? hexRGB('#e84838') : q < 0.65 ? hexRGB('#f4f4f8') : null;
    if (col) p.set(x, y, col); else p.shade(x, y, STRAW, 0.6 - nx * 0.2 - ny * 0.2);
  });
  p.set(15, 13, hexRGB('#6e4422')); p.set(16, 12, hexRGB('#f4f4f8'));                               // zapichnutý šíp
  return p.finish();
}

// ---- Orkská pevnosť na bojisku (útočné misie) ----
const ORC_STONE = ['#100f14', '#18171e', '#22202a', '#2e2a36', '#3c3846', '#4e4858', '#625a6c'].map(hexRGB);
const ORC_WOOD = ['#140c08', '#24160e', '#382214', '#4a2e1a', '#5e3c22', '#74502e'].map(hexRGB);
const BONE = hexRGB('#eee6cc'), BONE2 = hexRGB('#a8a088'), BLOOD = hexRGB('#8c2018'), BLOOD2 = hexRGB('#e84838'), EMBER = hexRGB('#f89838');
// hrad hordy 56x50: hradby s cimburím a kostenými hrotmi, stredná veža, brána s mrežou, lebka, zástavy
function makeOrcKeep() {
  const p = painter(56, 50);
  const stone = (x, y, base) => {                       // kvádre so škárami, svetlo zľava
    const row = Math.floor(y / 3), mortar = y % 3 === 2 || (x + row * 3) % 7 === 0;
    p.shade(x, y, ORC_STONE, mortar ? 0.12 : base + (hash2(x, y, 201) - 0.5) * 0.12);
  };
  for (let y = 18; y <= 49; y++) for (let x = 1; x <= 54; x++) stone(x, y, 0.62 - (x - 1) / 53 * 0.3);     // hradby
  for (let x = 1; x <= 54; x++) for (let y = 15; y <= 17; y++) if ((x - 1) % 5 < 3) stone(x, y, 0.75);    // cimburie
  for (let y = 3; y <= 49; y++) for (let x = 18; x <= 37; x++) stone(x, y, 0.7 - (x - 18) / 19 * 0.32);   // stredná veža
  for (let x = 17; x <= 38; x++) for (let y = 0; y <= 2; y++) if ((x - 17) % 4 < 2) stone(x, y, 0.82);    // cimburie veže
  for (let x = 2; x <= 53; x += 5) { p.set(x + 1, 13, BONE); p.set(x + 1, 14, BONE2); }                   // kostené hroty
  for (const [wx, wy] of [[23, 8], [31, 8], [23, 18], [31, 18]]) for (let y = wy; y <= wy + 3; y++) p.set(wx + (y === wy ? 0 : 0), y, y === wy ? EMBER : hexRGB('#d83818')); // žiariace strieľne
  // brána s mrežou a oblúkom
  for (let y = 33; y <= 49; y++) for (let x = 22; x <= 33; x++) {
    const arch = y < 36 && Math.hypot(x - 27.5, (36 - y) * 1.6) > 6.2;
    if (arch) continue;
    p.set(x, y, (x - 22) % 3 === 1 || (y - 33) % 4 === 0 ? hexRGB('#3a3a44') : hexRGB('#0a0806'));
  }
  // lebka nad bránou
  for (let y = 27; y <= 31; y++) for (let x = 25; x <= 30; x++) {
    if ((y === 27 || y === 31) && (x === 25 || x === 30)) continue;
    p.set(x, y, (y === 29 && (x === 26 || x === 29)) || (y === 31 && x % 2) ? hexRGB('#1c140e') : x < 28 ? BONE : BONE2);
  }
  // červené zástavy na hradbách
  for (const bx of [5, 45]) for (let y = 21; y <= 31; y++) for (let x = bx; x <= bx + 5; x++) {
    if (y === 31 && (x - bx) % 2 === 1) continue;
    p.set(x, y, x === bx ? BLOOD2 : (y === 25 && x > bx + 1 && x < bx + 4) ? hexRGB('#1c140e') : BLOOD);
  }
  return p.finish();
}
// orkská strážna veža 16x34: drevená konštrukcia, plošina s hrotmi, ork lukostrelec
function makeOrcTower() {
  const p = painter(16, 34);
  for (const lx of [3, 12]) for (let y = 14; y <= 33; y++) p.shade(lx, y, ORC_WOOD, lx === 3 ? 0.75 : 0.4);
  pLine(p, 4, 17, 11, 24, (x, y) => p.shade(x, y, ORC_WOOD, 0.5));
  pLine(p, 11, 17, 4, 24, (x, y) => p.shade(x, y, ORC_WOOD, 0.45));
  pLine(p, 4, 25, 11, 32, (x, y) => p.shade(x, y, ORC_WOOD, 0.5));
  pLine(p, 11, 25, 4, 32, (x, y) => p.shade(x, y, ORC_WOOD, 0.45));
  for (let y = 10; y <= 13; y++) for (let x = 1; x <= 14; x++) p.shade(x, y, ORC_WOOD, y === 10 ? 0.85 : 0.45 - (x - 1) * 0.015 + ((x - 1) % 3 === 2 ? -0.15 : 0));
  for (let x = 1; x <= 14; x += 3) { p.shade(x, 8, ORC_WOOD, 0.7); p.shade(x, 9, ORC_WOOD, 0.6); p.set(x, 7, BONE); }  // hroty plošiny
  // ork na plošine
  for (let y = 3; y <= 9; y++) for (let x = 5; x <= 10; x++) {
    if ((y === 3 || y === 9) && (x === 5 || x === 10)) continue;
    const skin = y <= 6;
    p.set(x, y, skin ? hexRGB(x < 8 ? '#9cd45a' : '#62a03a') : hexRGB(x < 8 ? '#6e4422' : '#3e2614'));
  }
  p.set(6, 5, BLOOD2); p.set(9, 5, BLOOD2);                                      // oči
  for (let y = 1; y <= 9; y++) p.set(12, y, ORC_WOOD[5]); p.set(13, 1, BONE); p.set(13, 9, BONE); // luk
  return p.finish();
}
// palisáda 16x18 zo zahrotených kolov; brána: vráta s kovaním a lebkou
function makePalisade(gate) {
  const p = painter(16, 18);
  for (let x = 0; x <= 15; x++) {
    const lx = x % 4, tip = lx === 1 || lx === 2 ? 0 : 1;
    for (let y = tip; y <= 17; y++) {
      if (lx === 3 && y < 3) continue;
      let v = [0.6, 0.72, 0.5, 0.25][lx] - y * 0.01;
      if (y === tip) v = 0.85;
      p.shade(x, y, ORC_WOOD, v);
    }
  }
  for (let x = 0; x <= 15; x++) { p.set(x, 7, hexRGB('#3a3a44')); p.set(x, 13, hexRGB('#3a3a44')); }   // železné pásy
  if (gate) {
    for (let y = 5; y <= 17; y++) p.set(8, y, hexRGB('#140c08'));               // stred vrát
    for (let y = 8; y <= 11; y++) for (let x = 6; x <= 10; x++) if (!((y === 8 || y === 11) && (x === 6 || x === 10))) p.set(x, y, (y === 10 && (x === 7 || x === 9)) ? hexRGB('#1c140e') : BONE);
  }
  return p.finish();
}
// kamenný múr hordy 16x21 (misie 8+): kvádre, cimburie s kostenými hrotmi; brána: vráta s mrežou a lebkou
function makeOrcWall(gate) {
  const p = painter(16, 21);
  for (let y = 4; y <= 20; y++) for (let x = 0; x <= 15; x++) {
    const row = Math.floor((y - 4) / 3), mortar = (y - 4) % 3 === 2 || (x + row * 4) % 8 === 0;
    p.shade(x, y, ORC_STONE, mortar ? 0.14 : 0.7 - x / 15 * 0.3 + ((y - 4) % 3 === 0 ? 0.06 : 0) + (hash2(x, y, 233) - 0.5) * 0.12);
  }
  for (let x = 0; x <= 15; x++) if (x % 6 < 4) for (let y = 1; y <= 3; y++) p.shade(x, y, ORC_STONE, y === 1 ? 0.9 : 0.72 - x / 15 * 0.25); // cimburie
  for (const bx of [1, 7, 13]) { p.set(bx + 1, 0, BONE); }                                                        // kostené hroty
  if (gate) {
    for (let y = 8; y <= 20; y++) for (let x = 3; x <= 12; x++) {
      if (y < 11 && Math.hypot(x - 7.5, (11 - y) * 1.4) > 4.8) continue;
      p.set(x, y, (x - 3) % 3 === 1 || (y - 8) % 4 === 0 ? hexRGB('#3a3a44') : hexRGB('#0a0806'));
    }
    for (let y = 4; y <= 7; y++) for (let x = 6; x <= 9; x++) if (!((y === 4 || y === 7) && (x === 6 || x === 9))) p.set(x, y, (y === 6 && (x === 6 || x === 9)) ? hexRGB('#1c140e') : x < 8 ? BONE : BONE2);
  } else for (let y = 9; y <= 11; y++) p.set(7, y, y === 9 ? EMBER : hexRGB('#d83818'));                           // žiariaca strieľňa
  return p.finish();
}
// zahrotené koly 16x9 pred hradbami (misie 7+): dva prekrížené rady kolov s kostenými hrotmi
function makeStakes() {
  const p = painter(16, 10);
  for (let x = 0; x <= 15; x++) { p.shade(x, 7, ORC_WOOD, 0.5 - x * 0.012); p.shade(x, 8, ORC_WOOD, 0.22); } // ležiaci trám
  for (const sx of [1, 9]) {
    pLine(p, sx + 5, 9, sx, 2, (x, y) => p.shade(x, y, ORC_WOOD, 0.3));                              // zadný kol (tieň)
    pLine(p, sx, 9, sx + 5, 1, (x, y) => { p.shade(x, y, ORC_WOOD, 0.82); p.shade(x + 1, y, ORC_WOOD, 0.5); }); // predný kol, svetlo zľava
    p.set(sx + 5, 0, BONE); p.set(sx + 6, 1, BONE2); p.set(sx, 1, BONE2);                               // kostené hroty
  }
  return p.finish();
}
// ---- Obliehacie stroje hráča (pohľad zozadu – idú hore k pevnosti) ----
// baranidlo 18x16: sedlová strecha z modrých koží, železná hlavica trčí dopredu, vojaci tlačia zvnútra; f = fáza kolies/krokov
function makeSiegeRam(f) {
  const p = painter(18, 16);
  for (let y = 0; y <= 2; y++) for (let x = 8; x <= 9; x++) p.set(x, y, y === 0 ? RIVET : x === 8 ? hexRGB('#80869a') : IRON); // hlavica
  for (let y = 3; y <= 8; y++) {                                                              // strecha – koža na rebrách
    const hw = 1.5 + (y - 3) * 1.25;
    for (let x = Math.ceil(8.5 - hw); x <= Math.floor(8.5 + hw); x++) {
      const t = (x - (8.5 - hw)) / (2 * hw), rib = (x + y) % 4 === 0;
      p.shade(x, y, ROOF_BLUE, (rib ? 0.25 : 0.82 - t * 0.55) + (y === 3 ? 0.1 : 0));
    }
  }
  for (let x = 1; x <= 16; x++) p.shade(x, 9, WOOD, 0.62 - x * 0.015);                       // spodný trám strechy
  for (let y = 10; y <= 13; y++) for (let x = 4; x <= 13; x++) p.set(x, y, hexRGB('#1e120a')); // tmavé vnútro
  for (const lx of [5, 10]) for (let y = 10; y <= 13; y++) {                                  // nohy tlačiacich vojakov
    const step = (lx === 5) === (f === 0) ? 1 : 0;
    if (y < 13 - step || y === 13 && step === 0) { p.set(lx, y, hexRGB(y === 10 ? '#88b4ff' : '#3c64c8')); p.set(lx + 2, y, hexRGB(y === 10 ? '#3c64c8' : '#22337a')); }
    if (y === 13 - step) { p.set(lx, y, hexRGB('#3e2614')); p.set(lx + 2, y, hexRGB('#3e2614')); }
  }
  for (const sx of [2, 14]) for (let y = 10; y <= 14; y++) p.shade(sx + (sx === 2 ? 1 : 0), y, WOOD, sx === 2 ? 0.55 : 0.35); // stĺpiky
  for (const wx of [0, 15]) for (let y = 10; y <= 15; y++) for (let x = wx; x <= wx + 2; x++) {          // kolesá (z boku úzke)
    const spoke = (y + f) % 3 === 0;
    p.shade(x, y, WOOD, spoke ? 0.2 : x === wx ? 0.7 : x === wx + 1 ? 0.5 : 0.32);
  }
  for (const wx of [1, 16]) p.set(wx, 12 + f, RIVET);                                                     // náboj
  return p.finish();
}
// pojazdný katapult 16x19: rám na kolesách, rameno s miskou; loaded = rameno dole s balvanom, inak vztýčené po výstrele
function makeSiegeCat(loaded) {
  const p = painter(16, 19);
  const STONE = ['#22202a', '#3c3846', '#4e4858', '#625a6c', '#7a7286', '#9a92a6'].map(hexRGB);
  for (let y = 11; y <= 14; y++) for (let x = 2; x <= 13; x++) p.shade(x, y, WOOD, (y === 11 ? 0.78 : 0.6) - (x - 2) * 0.025 + ((x - 2) % 4 === 3 ? -0.18 : 0)); // podlaha z dosiek
  for (let x = 2; x <= 13; x++) { p.shade(x, 15, WOOD, 0.3); p.shade(x, 16, WOOD, 0.18); }                                  // predný trám
  for (const [px, v] of [[3, 0.78], [12, 0.42]]) for (let y = 3; y <= 14; y++) { p.shade(px, y, WOOD, v); p.shade(px + (px === 3 ? 1 : -1), y, WOOD, v - 0.2); } // stĺpy
  for (let x = 3; x <= 12; x++) { p.shade(x, 3, WOOD, 0.72 - x * 0.02); p.set(x, 4, x % 3 === 0 ? RIVET : IRON); }            // priečka s kovaním
  for (const wx of [0, 14]) for (let y = 11; y <= 18; y++) for (let x = wx; x <= wx + 1; x++)                                   // kolesá z boku
    p.set(x, y, y === 11 || y === 18 ? IRON : (y + x) % 3 === 0 ? pickRamp(WOOD, 0.25, x, y) : pickRamp(WOOD, x === wx ? 0.7 : 0.45, x, y));
  if (loaded) {                                                                    // rameno stiahnuté k nám, miska s balvanom visí pred trámom
    for (let y = 5; y <= 14; y++) { p.shade(7, y, WOOD, 0.8); p.shade(8, y, WOOD, 0.5); }
    for (let x = 5; x <= 10; x++) { p.shade(x, 15, WOOD, 0.55); p.shade(x, 18, WOOD, 0.3); }
    for (let y = 16; y <= 17; y++) { p.shade(5, y, WOOD, 0.55); p.shade(10, y, WOOD, 0.3); }
    for (let y = 14; y <= 17; y++) for (let x = 6; x <= 9; x++) if (!((y === 14 || y === 17) && (x === 6 || x === 9))) p.shade(x, y, STONE, 0.98 - (x - 6) * 0.14 - (y - 14) * 0.1);
    p.set(6, 15, STONE[5]);
  } else {                                                                         // po výstrele: rameno opreté o priečku, prázdna miska hore
    for (let y = 2; y <= 14; y++) { p.shade(7, y, WOOD, 0.8); p.shade(8, y, WOOD, 0.5); }
    for (let x = 5; x <= 10; x++) p.shade(x, 0, WOOD, x < 8 ? 0.7 : 0.4);
    for (let x = 5; x <= 10; x++) p.set(x, 1, x === 5 || x === 10 ? pickRamp(WOOD, 0.4, x, 1) : hexRGB('#1e120a'));
  }
  p.set(3, 0, hexRGB('#3e2614')); p.set(3, 1, hexRGB('#3e2614')); p.set(3, 2, hexRGB('#3e2614'));                         // žrď
  p.set(2, 0, hexRGB('#88b4ff')); p.set(1, 0, hexRGB('#5a86e8')); p.set(2, 1, hexRGB('#3c64c8'));                       // modrá zástavka
  return p.finish();
}
// ---- Orkský veľkráľ (boss 10. misie) 26x30: koruna, kožušinový plášť, červená pelerína, obojručná sekera; step = krok nôh ----
function makeOrcKing(step) {
  const p = painter(26, 30);
  const SKIN = ['#1e3a16', '#305c22', '#3e7a2a', '#62a03a', '#7cb848', '#9cd45a'].map(hexRGB);
  const GOLDR = ['#4a3008', '#6e4a10', '#b88420', '#f8d048', '#fff070'].map(hexRGB);
  const MET = ['#16161c', '#26262e', '#44444f', '#6a6a7a', '#a8a8b8', '#e0e0ea'].map(hexRGB);
  const FUR = ['#1e1610', '#3a2e24', '#5a4a3a', '#7e6a52', '#a8927a', '#ccb89c'].map(hexRGB);
  const LEATHER = ['#140e0a', '#1e1610', '#2e2218', '#3e2e20'].map(hexRGB);
  const RED = ['#2e0806', '#4a100c', '#8c2018', '#c83020', '#e84838'].map(hexRGB);
  const lit = (x, x0, x1) => 1 - (x - x0) / Math.max(1, x1 - x0); // svetlo zľava
  // pelerína za telom
  for (let y = 12; y <= 25; y++) for (let x = 4; x <= 19; x++) p.shade(x, y, RED, 0.25 + lit(x, 4, 19) * 0.45 + ((x + (y >> 1)) % 5 === 0 ? -0.15 : 0));
  // nohy: kožené nohavice, železné čižmy
  for (const [lx, dy] of [[8, step ? -1 : 0], [13, step ? 0 : -1]]) for (let y = 24; y <= 29; y++) for (let x = lx; x <= lx + 3; x++) {
    const yy = y + dy; if (yy > 29) continue;
    p.shade(x, yy, y >= 27 ? MET : LEATHER, (y >= 27 ? 0.35 : 0.3) + lit(x, lx, lx + 3) * 0.4 + (y === 27 ? 0.25 : 0));
  }
  // trup: holá hruď s remeňmi, opasok so zlatou prackou
  for (let y = 13; y <= 23; y++) for (let x = 7; x <= 16; x++) {
    const bulge = Math.abs(x - 11.5) < 3 && y < 18 ? 0.08 : 0;
    p.shade(x, y, SKIN, 0.3 + lit(x, 7, 16) * 0.5 + bulge + (y === 16 && x % 4 === 1 ? -0.2 : 0));
  }
  pLine(p, 7, 13, 15, 21, (x, y) => p.shade(x, y, LEATHER, 0.9));                              // remeň cez hruď
  for (let x = 7; x <= 16; x++) { p.shade(x, 21, LEATHER, 0.9 - x * 0.02); p.shade(x, 22, LEATHER, 0.5); }
  for (let x = 10; x <= 13; x++) for (let y = 20; y <= 23; y++) p.shade(x, y, GOLDR, y === 20 || x === 10 ? 0.9 : 0.55); // pracka
  // ruky: ľavá visí s náramkom, pravá drží sekeru
  for (let y = 13; y <= 21; y++) for (let x = 3; x <= 5; x++) p.shade(x, y, y >= 17 && y <= 18 ? MET : SKIN, (y >= 17 && y <= 18 ? 0.55 : 0.35) + lit(x, 3, 5) * 0.4);
  for (let y = 13; y <= 18; y++) for (let x = 17; x <= 19; x++) p.shade(x, y, y === 16 ? MET : SKIN, 0.3 + lit(x, 17, 19) * 0.3);
  // kožušinový plášť na pleciach (nerovný okraj)
  for (let y = 9; y <= 15; y++) for (let x = 2; x <= 20; x++) {
    const edge = 13 + Math.round(hash2(x, 3, 77) * 2) - (x > 7 && x < 16 ? 2 : 0); // vpredu kratší – vidno hruď
    if (y > edge || (y === 9 && (x < 6 || x > 17))) continue;
    p.shade(x, y, FUR, 0.25 + lit(x, 2, 21) * 0.55 + (y === 9 ? 0.15 : 0) + (hash2(x, y, 91) - 0.5) * 0.3);
  }
  for (const sx of [3, 20]) { p.set(sx, 8, hexRGB('#eee6cc')); p.set(sx, 9, hexRGB('#a8a088')); }   // kostené hroty na pleciach
  // hlava: ťažké obočie, červené oči, kly
  for (let y = 3; y <= 11; y++) for (let x = 8; x <= 15; x++) {
    if ((y === 3 || y === 11) && (x === 8 || x === 15)) continue;
    p.shade(x, y, SKIN, 0.35 + lit(x, 8, 15) * 0.5 - (y === 6 ? 0.25 : 0));
  }
  for (const ex of [10, 13]) { p.set(ex, 7, RED[4]); p.set(ex + (ex === 10 ? -1 : 1), 7, RED[2]); }
  for (let x = 9; x <= 14; x++) p.shade(x, 10, SKIN, 0.15);                                      // ústa
  p.set(9, 9, hexRGB('#eee6cc')); p.set(14, 9, hexRGB('#a8a088')); p.set(9, 8, hexRGB('#eee6cc')); p.set(14, 8, hexRGB('#a8a088')); // kly
  // koruna: obruč, hroty, rubín
  for (let x = 8; x <= 15; x++) for (let y = 2; y <= 3; y++) p.shade(x, y, GOLDR, (y === 2 ? 0.85 : 0.5) + lit(x, 8, 15) * 0.15);
  for (const cx of [8, 10, 13, 15]) { p.shade(cx, 1, GOLDR, 0.75); if (cx === 10 || cx === 13) p.shade(cx, 0, GOLDR, 0.95); }
  p.set(11, 2, RED[4]); p.set(12, 2, RED[2]); p.set(11, 3, RED[3]); p.set(12, 3, RED[1]);
  // obojručná sekera: porisko a dvojitá čepeľ
  for (let y = 1; y <= 27; y++) p.shade(21, y, WOOD, (y % 5 === 0 ? 0.3 : 0.62));
  for (let y = 1; y <= 9; y++) {
    const hw = Math.round(3 - Math.abs(y - 5) * 0.55);
    for (let x = 21 - hw - 1; x <= 21 + hw + 1; x++) {
      if (x === 21) continue;
      const edge = Math.abs(x - 21) === hw + 1;
      p.shade(x, y, MET, edge ? 0.95 : 0.45 + lit(x, 17, 25) * 0.25);
    }
  }
  p.set(21, 0, MET[4]);
  return p.finish();
}

// ---- Medvedí jazdec (ork na medveďovi s kladivom) 22x24, pohľad spredu; step = krok labiek ----
function makeBearRider(step) {
  const p = painter(22, 24);
  const BEAR = ['#1a0e06', '#2e1a0c', '#4a2c16', '#6a4222', '#8a5a30', '#a8743e'].map(hexRGB);
  const SKIN = ['#1e3a16', '#305c22', '#3e7a2a', '#62a03a', '#7cb848', '#9cd45a'].map(hexRGB);
  const MET = ['#16161c', '#26262e', '#44444f', '#6a6a7a', '#a8a8b8', '#e0e0ea'].map(hexRGB);
  // zadné labky
  for (const [lx, up] of [[4, step], [15, 1 - step]]) for (let y = 17; y <= 23 - up; y++) for (let x = lx; x <= lx + 2; x++)
    p.shade(x, y, BEAR, (y >= 22 - up ? 0.2 : 0.5) + (x === lx ? 0.15 : 0));
  // trup medveďa (huňatý)
  pDisk(p, 10.5, 15, 9, 5.5, (x, y, nx, ny) => p.shade(x, y, BEAR, 0.62 - nx * 0.25 - ny * 0.2 + (hash2(x, y, 301) - 0.5) * 0.18));
  // predné labky s pazúrmi
  for (const [lx, up] of [[6, 1 - step], [13, step]]) {
    for (let y = 18; y <= 23 - up; y++) for (let x = lx; x <= lx + 2; x++) p.shade(x, y, BEAR, 0.6 - (x - lx) * 0.15 - (y - 18) * 0.03);
    for (let x = lx; x <= lx + 2; x++) p.set(x, 23 - up, hexRGB('#eee6cc'));
  }
  // hlava medveďa: uši, oči, svetlá papuľa, čierny nos
  pDisk(p, 10.5, 17.2, 4.6, 3.6, (x, y, nx, ny, q) => p.shade(x, y, BEAR, q > 0.8 ? 0.15 : 0.95 - nx * 0.25 - ny * 0.1)); // tmavý lem oddelí hlavu od trupu
  for (const ex of [6, 15]) { p.shade(ex, 13, BEAR, 0.6); p.shade(ex, 14, BEAR, 0.45); p.set(ex, 14, hexRGB('#3a2414')); }
  pDisk(p, 10.5, 19, 2.2, 1.4, (x, y, nx) => p.shade(x, y, STRAW, 0.7 - nx * 0.2));
  p.set(10, 18, hexRGB('#1c140e')); p.set(11, 18, hexRGB('#1c140e'));
  p.set(8, 16, hexRGB('#e84838')); p.set(13, 16, hexRGB('#e84838'));                         // zúrivé oči
  // ork v sedle: kožená zbroj, zelené ruky, železná prilba s rohmi
  for (let y = 5; y <= 11; y++) for (let x = 8; x <= 13; x++) p.shade(x, y, y <= 6 ? SKIN : BEAR, (y <= 6 ? 0.7 : 0.35) - (x - 8) * 0.06);
  for (let x = 8; x <= 13; x++) p.set(x, 9, MET[3]);                                           // opasok
  for (let y = 7; y <= 10; y++) { p.shade(7, y, SKIN, 0.75); p.shade(14, y, SKIN, 0.4); }       // ruky
  for (let y = 1; y <= 4; y++) for (let x = 8; x <= 13; x++) p.shade(x, y, MET, (y === 1 ? 0.85 : 0.55) - (x - 8) * 0.07); // prilba
  p.set(9, 4, hexRGB('#e84838')); p.set(12, 4, hexRGB('#e84838'));                            // oči v priezore
  p.set(7, 1, hexRGB('#eee6cc')); p.set(6, 0, hexRGB('#eee6cc')); p.set(14, 1, hexRGB('#a8a088')); p.set(15, 0, hexRGB('#a8a088')); // rohy
  // kladivo: porisko z pravej ruky, ťažká železná hlava hore
  pLine(p, 15, 10, 18, 4, (x, y) => p.shade(x, y, WOOD, 0.6));
  for (let y = 0; y <= 4; y++) for (let x = 16; x <= 21; x++) p.shade(x, y, MET, (y === 0 || x === 16 ? 0.9 : 0.5) - (x - 16) * 0.04);
  p.set(18, 2, RIVET); p.set(20, 2, RIVET);
  return p.finish();
}

// ---- Vlčí jazdec (goblin na sivom vlkovi s dýkou) 16x17, pohľad spredu; step = krok labiek ----
function makeWolfRider(step) {
  const p = painter(16, 17);
  const WOLF = ['#1e1e26', '#34343e', '#4e4e5a', '#6e6e7c', '#9090a0', '#b8b8c6'].map(hexRGB);
  const SKIN = ['#305c22', '#3e7a2a', '#62a03a', '#7cb848', '#9cd45a'].map(hexRGB);
  for (const [lx, up] of [[3, step], [10, 1 - step]]) for (let y = 12; y <= 16 - up; y++) for (let x = lx; x <= lx + 1; x++) // labky
    p.shade(x, y, WOLF, y === 16 - up ? 0.15 : 0.6 - (x - lx) * 0.2);
  pDisk(p, 7.5, 11, 6.5, 3.5, (x, y, nx, ny) => p.shade(x, y, WOLF, 0.6 - nx * 0.25 - ny * 0.15 + (hash2(x, y, 311) - 0.5) * 0.15)); // trup
  // hlava vlka: špicaté uši, úzky ňufák
  pDisk(p, 7.5, 12.2, 3.4, 2.6, (x, y, nx, ny, q) => p.shade(x, y, WOLF, q > 0.75 ? 0.12 : 0.9 - nx * 0.3)); // hlava s tmavým lemom
  for (const [ex, v] of [[4, 0.8], [11, 0.45]]) { p.shade(ex, 8, WOLF, v); p.shade(ex, 9, WOLF, v); p.shade(ex + (ex === 4 ? 1 : -1), 9, WOLF, v - 0.1); p.shade(ex, 7, WOLF, v + 0.1); } // špicaté uši
  for (let y = 13; y <= 15; y++) { p.shade(7, y, WOLF, 0.98); p.shade(8, y, WOLF, 0.8); }   // ňufák
  p.set(7, 16, hexRGB('#1c140e')); p.set(8, 16, hexRGB('#1c140e'));                              // nos
  p.set(6, 11, hexRGB('#f8d048')); p.set(9, 11, hexRGB('#f8d048'));                              // žlté oči
  // goblin v sedle: zelená hlava so špicatými ušami, kožená vesta, dýka
  for (let y = 4; y <= 8; y++) for (let x = 6; x <= 9; x++) p.shade(x, y, y <= 5 ? SKIN : WOOD, (y <= 5 ? 0.8 : 0.4) - (x - 6) * 0.08);
  for (let y = 1; y <= 3; y++) for (let x = 6; x <= 9; x++) p.shade(x, y, SKIN, 0.85 - (x - 6) * 0.1);
  p.set(5, 2, SKIN[3]); p.set(10, 2, SKIN[1]);                                                    // uši
  p.set(7, 2, hexRGB('#e84838')); p.set(8, 2, hexRGB('#e84838'));                                 // oči
  p.set(11, 6, hexRGB('#62a03a')); p.set(12, 5, hexRGB('#bcc0cc')); p.set(13, 4, hexRGB('#f4f4f8')); // ruka s dýkou
  return p.finish();
}

// ---- Vodný mlyn (32x32): kamenné prízemie, hrázdené poschodie, slamená strecha, koleso s lopatkami a žľab ----
const STRAW = ['#2e200c', '#4a3614', '#6a4e1e', '#8a6a2a', '#a8843a', '#c49e4e', '#dcba68', '#ecd28a'].map(hexRGB);
// koleso mlyna: stred v sprite mlyna (vodorovne), polomer s lopatkami ~8,4 px
const MILL_WHEEL = { cx: 10, frames: 6 }; // koleso mierne prekrýva roh múru
// jedna snímka otáčajúceho sa kolesa (19x19, stred 9,9): súvislá obruč, 8 tenkých lúčov, 8 lopatiek
function makeMillWheel(rot) {
  const p = painter(19, 19), C = 9;
  for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) {
    const dx = x - C, dy = y - C, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - rot;
    const light = -(dx + dy) / 40;
    if (r >= 5.3 && r <= 7.1) p.shade(x, y, WOOD, (r < 6.1 ? 0.36 : 0.62) + light);                       // obruč
    else if (r > 7.1 && r <= 8.4 && Math.abs(Math.sin(a * 4)) < 0.42) p.shade(x, y, WOOD, 0.55 + light); // lopatky
  }
  // obrys len obruči a lopatkám; lúče a náboj sa dokreslia bez obrysu, aby medzi nimi bolo vidieť pozadie
  const spr = p.finish(), cx = spr.c.getContext('2d');
  const px = (x, y, col) => { cx.fillStyle = rgbStr(col); cx.fillRect(x, y, 1, 1); };
  for (let k = 0; k < 8; k++) { // lúče ako tenké čiary – rovnaká hrúbka pri každom natočení
    const ang = rot + k * Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let r = 1.6; r < 5.6; r += 0.2) {
      const x = Math.round(C + ca * r), y = Math.round(C + sa * r);
      px(x, y, pickRamp(WOOD, 0.42 - (x - C + y - C) / 40, x, y));
    }
  }
  for (let y = 7; y <= 11; y++) for (let x = 7; x <= 11; x++) { // náboj s obrysom
    const r = Math.hypot(x - C, y - C);
    if (r <= 1.6) px(x, y, r < 0.8 ? RIVET : IRON); else if (r <= 2.3) px(x, y, hexRGB(PAL.K));
  }
  return spr;
}
function makeMill() {
  const p = painter(36, 32); // rezerva vpravo pre presah strechy a obrys múru
  const BX0 = 16, BX1 = 31, AX = 23.5, DOOR = 22, WIN = 26; // múry budovy, os strechy, dvere, okno
  // kamenné prízemie – riadky kvádrov s maltou, svetlo zľava
  for (let y = 20; y <= 30; y++) for (let x = BX0; x <= BX1; x++) {
    const row = Math.floor((y - 20) / 3), mortarH = (y - 20) % 3 === 2, mortarV = (x + row * 3) % 6 === 0;
    let v = 0.62 - (x - BX0) / (BX1 - BX0) * 0.25 + (hash2(x, y, 171) - 0.5) * 0.12;
    if ((y - 20) % 3 === 0) v += 0.08;
    if (mortarH || mortarV) v = 0.18;
    p.shade(x, y, RAMP.stone, v);
  }
  // drevené dvere s kovaním
  for (let y = 23; y <= 30; y++) for (let x = DOOR; x <= DOOR + 4; x++) {
    if (y === 23 && (x === DOOR || x === DOOR + 4)) continue;
    const edge = x === DOOR || x === DOOR + 4 || y === 23;
    p.shade(x, y, WOOD, edge ? 0.12 : 0.5 - (x - DOOR) * 0.05 + ((x - DOOR) % 2 ? -0.08 : 0));
  }
  p.set(DOOR + 3, 27, RIVET); p.shade(DOOR + 1, 26, WOOD, 0.75); p.shade(DOOR + 1, 28, WOOD, 0.75);
  // hrázdené poschodie: omietka, trámy, šikmé vzpery
  const MID = 23;
  for (let y = 12; y <= 19; y++) for (let x = BX0; x <= BX1; x++) {
    const beam = x === BX0 || x === BX1 || x === MID || y === 12 || y === 19;
    const brace = (x < MID && x - BX0 === y - 12) || (x > MID && BX1 - x === y - 12);
    if (beam) p.shade(x, y, WOOD, x === BX0 || y === 12 ? 0.55 : 0.3);
    else if (brace) p.shade(x, y, WOOD, 0.4);
    else p.shade(x, y, PLASTER, 0.66 - (x - BX0) / (BX1 - BX0) * 0.22 + (hash2(x, y, 173) - 0.5) * 0.1);
  }
  // okienko so svetlom
  for (let y = 14; y <= 17; y++) for (let x = WIN; x <= WIN + 3; x++) {
    const frame = x === WIN || x === WIN + 3 || y === 14 || y === 17, cross = x === WIN + 1 || y === 15;
    p.set(x, y, frame ? WOOD[1] : cross ? WOOD[2] : (y === 16 && x === WIN + 2 ? GLOW2 : DARKWIN));
  }
  // slamená strecha s vrstvami a presahom
  for (let y = 0; y <= 12; y++) {
    const hw = (y + 1.5) / 13 * 9.8;
    for (let x = Math.floor(AX - hw); x <= Math.ceil(AX + hw); x++) {
      if (x < 0 || x > 35) continue;
      const nx = (x - AX) / hw;
      if (Math.abs(nx) > 1.05) continue;
      let v = 0.66 - nx * 0.32 + (hash2(x, y, 177) - 0.5) * 0.14;
      if ((x * 3 + y * 5) % 7 === 0) v -= 0.16;
      if (y % 4 === 3) v -= 0.18;
      if (y === 12) v = 0.1;
      if (y <= 1) v += 0.12;
      p.shade(x, y, STRAW, v);
    }
  }
  return p.finish();
}

const BSPR = {};
function initBuildingSprites() {
  BSPR.hall = [1, 2, 3, 4, 5].map(l => makeHall(l));
  BSPR.tower = [1, 2, 3, 4, 5].map(l => makeArcherTower(l));
  BSPR.mage = [1, 2, 3, 4, 5].map(l => makeMageTower(l));
  BSPR.barracks = makeBarracks();
  BSPR.pit = makePit();
  BSPR.catapult = makeCatapult();
  BSPR.mine = makeMine();
  BSPR.chapel = makeChapel();
  BSPR.firepit = makeFirepit();
  BSPR.beartrap = makeBeartrap();
  BSPR.workshop = makeWorkshop();
  BSPR.range = makeRange();
  BSPR.stables = makeStables();
  BSPR.armory = makeArmory();
  BSPR.orcKeep = makeOrcKeep();
  BSPR.orcTower = makeOrcTower();
  BSPR.palisade = makePalisade(false);
  BSPR.palisadeGate = makePalisade(true);
  BSPR.orcWall = makeOrcWall(false);
  BSPR.orcWallGate = makeOrcWall(true);
  BSPR.stakes = makeStakes();
  SPR.siegeRam = [makeSiegeRam(0), makeSiegeRam(1)];
  SPR.siegeCat = [makeSiegeCat(true), makeSiegeCat(false)];
  SPR.orcKing = [makeOrcKing(0), makeOrcKing(1)];
  SPR.bear = [makeBearRider(0), makeBearRider(1)];
  SPR.wolf = [makeWolfRider(0), makeWolfRider(1)];
  BSPR.mill = makeMill();
  // 8-násobná súmernosť: 45° otočenia rozdelených do snímok sa plynulo opakuje
  BSPR.millWheel = Array.from({ length: MILL_WHEEL.frames }, (_, i) => makeMillWheel(i / MILL_WHEEL.frames * Math.PI / 4));
  BSPR.wall = [];
  for (let l = 1; l <= 5; l++) { BSPR.wall[l - 1] = []; for (let m = 0; m < 16; m++) BSPR.wall[l - 1][m] = makeWall(m, l); }
  BSPR.gatehouse = [1, 2, 3, 4, 5].map(l => makeGatehouse(l));
  // ikona brány: hradba + strážnica (kamenná)
  const ic = document.createElement('canvas'); ic.width = 16; ic.height = 33;
  const ix = ic.getContext('2d');
  ix.drawImage(BSPR.wall[1][10].c, 0, 9); ix.drawImage(BSPR.gatehouse[1].c, 0, 0);
  BSPR.gateIcon = spriteFromCanvas(ic);
}

// sprite budovy podľa jej úrovne (niektoré budovy majú 5 vzhľadov)
function bsprOf(kind, lvl) {
  const v = BSPR[kind];
  return Array.isArray(v) ? v[Math.max(1, Math.min(5, lvl || 1)) - 1] : v;
}
