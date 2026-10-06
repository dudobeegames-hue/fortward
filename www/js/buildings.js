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
      p.shade(x, y, WOOD, (x % 2 ? 0.55 : 0.4) - (y === 14 || y === 22 ? 0.3 : 0));
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

// ---- Zvonica (16x34) ----
function makeBell() {
  const p = painter(16, 34);
  // nohy a vzpery
  for (const lx of [3, 12]) for (let y = 11; y <= 32; y++) p.shade(lx, y, WOOD, lx === 3 ? 0.62 : 0.38);
  pLine(p, 4, 14, 11, 21, (x, y) => p.shade(x, y, WOOD, 0.45));
  pLine(p, 11, 14, 4, 21, (x, y) => p.shade(x, y, WOOD, 0.4));
  pLine(p, 4, 23, 11, 30, (x, y) => p.shade(x, y, WOOD, 0.45));
  pLine(p, 11, 23, 4, 30, (x, y) => p.shade(x, y, WOOD, 0.4));
  // plošina, stĺpiky a strecha
  for (let y = 10; y <= 11; y++) for (let x = 2; x <= 13; x++) p.shade(x, y, WOOD, y === 10 ? 0.7 : 0.3);
  for (const lx of [3, 12]) for (let y = 5; y <= 9; y++) p.shade(lx, y, WOOD, 0.5);
  pGable(p, 7.5, 0, 5, 7, ROOF_RED);
  // zvon
  for (let y = 6; y <= 9; y++) { const hw = y === 6 ? 1 : y === 9 ? 3 : 2; for (let x = 8 - hw; x <= 7 + hw; x++) p.set(x, y, hexRGB(x < 7 ? '#fff070' : x < 9 ? '#f8d048' : '#b88420')); }
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

// ---- Studňa (16x20) ----
function makeWell() {
  const p = painter(16, 20);
  pDisk(p, 7.5, 15, 6.5, 3.5, (x, y, nx, ny) => p.shade(x, y, RAMP.stone, 0.6 - nx * 0.25 + ((x + y) % 3 === 0 ? -0.15 : 0)));
  pDisk(p, 7.5, 13.5, 5, 2, (x, y, nx, ny) => p.shade(x, y, RAMP.stone, 0.85));
  pDisk(p, 7.5, 13.5, 3.6, 1.3, (x, y) => p.set(x, y, hexRGB('#163a7a')));
  for (const lx of [2, 13]) for (let y = 4; y <= 13; y++) p.shade(lx, y, WOOD, lx === 2 ? 0.6 : 0.35);
  pGable(p, 7.5, 0, 4, 7, ROOF_RED);
  for (let x = 3; x <= 12; x++) p.shade(x, 6, WOOD, 0.55);                   // hriadeľ
  for (let y = 7; y <= 10; y++) p.set(8, y, hexRGB('#c4b89e'));                // lano
  for (let y = 10; y <= 12; y++) for (let x = 7; x <= 9; x++) p.shade(x, y, WOOD, 0.5);
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
  BSPR.bell = makeBell();
  BSPR.firepit = makeFirepit();
  BSPR.beartrap = makeBeartrap();
  BSPR.well = makeWell();
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
