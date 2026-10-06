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
  { key: 'pass',   ground: 'grassDark', road: 'dirt', deco: 'rocks',  cliffs: true, spawn: 'middle' },
  { key: 'ruins',  ground: 'grassDark', road: 'cobble', deco: 'ruins' },
  { key: 'ash',    ground: 'ash',   road: 'ashroad', deco: 'charred', anim: 'embers' },
  { key: 'orc',    ground: 'dark',  road: 'ashroad', deco: 'orc',     lava: true, anim: 'lava' },
];

const TR = {
  dry:    ['#2a2614', '#3a3418', '#4e4620', '#665a28', '#7e7032', '#968a40', '#aea250', '#c4b868'],
  swamp:  ['#10180e', '#162012', '#1c2a16', '#24341a', '#2e4020', '#3a4e28', '#485e30'],
  swampW: ['#0a1410', '#0e1c16', '#14261c', '#1c3224', '#28422e'],
  mud:    ['#1e160e', '#2a1e12', '#382818', '#46321e', '#563e26'],
  ash:    ['#161414', '#201e1e', '#2c2828', '#3a3434', '#4a4442', '#5c5452', '#6e6662', '#827a74'],
  ashroad:['#120e0c', '#1c1612', '#281e18', '#34281e', '#423224', '#52402c'],
  dark:   ['#120a08', '#1a0e0a', '#24140e', '#301a12', '#3e2216', '#4c2a1a', '#5a3420'],
  lava:   ['#5a1008', '#a02810', '#e05018', '#f89838', '#fff070'],
  water:  ['#0c1e44', '#10285a', '#163a7a', '#1e5096', '#2a6ab0', '#3c88c8', '#5aa8d8', '#8ad0e8'],
  birch:  ['#28461e', '#3a6028', '#4e7a30', '#68943c', '#86ae4c', '#a6c862'],
  sand:   ['#6e5838', '#8a7048', '#a88a5a', '#c4a670', '#dcc08a', '#ecd8a8'],
};
for (const k in TR) TR[k] = TR[k].map(hexRGB);

// G: { T, gx0, gy0, cols, rows, hallCx, hallTop, hallBot, zoneTopMax }
function buildScene(W, H, G, seed, themeIdx) {
  const th = THEMES[((themeIdx || 0) % THEMES.length + THEMES.length) % THEMES.length];
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
  const yardD = (x, y) => {
    const dx = Math.max(hx0 - x, 0, x - hx1), dy = Math.max(G.hallTop - y, 0, y - G.hallBot);
    return Math.hypot(dx, dy) - 3 + (vnoise(x * 0.25, y * 0.25, seed + 17) - 0.5) * 3;
  };
  const groundRamp = { grass: RAMP.grass, grassDark: RAMP.grass, dry: TR.dry, swamp: TR.swamp, ash: TR.ash, dark: TR.dark }[th.ground];
  const groundBias = th.ground === 'grassDark' ? -0.12 : th.ground === 'swamp' ? 0.1 : 0;

  // ---- podklad: zem, cesta, nádvorie ----
  for (let y = 0; y < H; y++) {
    const cx = roadCx(y), hw = roadHw(y);
    for (let x = 0; x < W; x++) {
      const dd = roadD(x, y), yd = yardD(x, y);
      if (yd < 0) {
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
          if (dd > -2 || hash2(col, row, seed + 24) > 0.92) { set(x, y, pickRamp(RAMP.grass, 0.3, x, y)); continue; } // tráva medzi kameňmi
          set(x, y, pickRamp(RAMP.stone, v, x, y));
          continue;
        }
        const ramp = th.road === 'mud' ? TR.mud : th.road === 'ashroad' ? TR.ashroad : RAMP.dirt;
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
        set(x, y, pickRamp(groundRamp, v, x, y));
      }
    }
  }

  const rnd = (() => { let s = (seed * 9301 + 49297) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
  const blocked = new Uint8Array(W * H); // miesta s vodou/skalou – bez dekorácií
  const free = (x, y, m) => roadD(x, y) > m && yardD(x, y) > m && !blocked[(Math.max(0, Math.min(H - 1, y | 0))) * W + Math.max(0, Math.min(W - 1, x | 0))];

  // ---- špeciálne prvky krajiny ----
  const foam = [], lava = [];
  let spawn = [G.gx0 + 8, G.gx0 + G.cols * G.T - 8];

  if (th.sea) { // more na ľavom okraji
    const edge = y => 36 - 24 * (y / H) + Math.sin(y * 0.05 + seed) * 4 + (fbm(0.5, y * 0.04, seed + 41) - 0.5) * 8;
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
    for (let x = 0; x < W; x++) {
      const cy = rcy(x), hw = R.hw + (vnoise(x * 0.2, 0.5, seed + 51) - 0.5) * 2;
      for (let y = Math.floor(cy - hw - 2); y <= Math.ceil(cy + hw + 2); y++) {
        if (y < 0 || y >= H) continue;
        const dy = Math.abs(y - cy);
        const onRoad = roadD(x, y) < 1;
        blocked[y * W + x] = 1;
        if (dy > hw) { // breh
          set(x, y, pickRamp(R.ford ? RAMP.stone : TR.mud, 0.45 + (y < cy ? 0.15 : -0.05), x, y));
          continue;
        }
        if (onRoad && R.bridge) { // drevený most
          const rx = Math.abs(x - roadCx(y)), rhw = roadHw(y);
          if (rx > rhw - 1) set(x, y, rx > rhw ? K : WOOD[5]);
          else set(x, y, pickRamp(WOOD, (Math.floor(y) % 2 ? 0.55 : 0.4) - (x > roadCx(y) ? 0.08 : 0), x, y));
          continue;
        }
        let v = 0.62 - (1 - dy / hw) * 0.3 + ((x + Math.round(y * 2)) % 9 === 0 ? 0.18 : 0);
        if (onRoad && R.ford) v += 0.22; // plytčina na brode
        set(x, y, pickRamp(TR.water, v, x, y));
      }
      if (R.bridge && roadD(x, cy) < 1) { // tieň mosta / zábradlie
        const rx = x - roadCx(cy), rhw = roadHw(cy);
        if (Math.abs(rx) > rhw - 1 && Math.abs(rx) <= rhw) { set(x, cy - hw - 3, WOOD[5]); set(x, cy - hw - 2, K); }
      }
    }
    if (R.ford) { // kamene v brode
      const cy = rcy(roadCx(ry)), cx0 = roadCx(cy);
      for (let k = -2; k <= 2; k++) for (let j = -1; j <= 1; j++) {
        const sx = Math.round(cx0 + k * 5 + (j % 2) * 2), sy = Math.round(cy + j * 5);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && dy !== 0) continue;
          set(sx + dx, sy + dy, pickRamp(RAMP.stone, 0.75 - dy * 0.15 - dx * 0.05, sx + dx, sy + dy));
        }
        for (let dx = -2; dx <= 2; dx++) set(sx + dx, sy + 2, TR.water[1]);
      }
    }
    if (th.mill && typeof BSPR !== 'undefined' && BSPR.barracks) { // mlyn s kolesom
      const mx = W - 30, my = Math.round(rcy(W - 22) - R.hw - 26);
      bx.putImageData(img, 0, 0);
      bx.drawImage(BSPR.barracks.c, mx, my);
      const id2 = bx.getImageData(0, 0, W, H); d.set(id2.data);
      const wx = mx - 2, wy = my + 22;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const r = Math.hypot(dx, dy);
        if (r > 6.5) continue;
        if (r > 5.3) set(wx + dx, wy + dy, K);
        else if (r > 4.2 || dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) set(wx + dx, wy + dy, pickRamp(WOOD, 0.6 - (dx + dy) * 0.03, wx + dx, wy + dy));
      }
      for (let x = mx; x < mx + 18; x++) for (let y = my; y < my + 27; y++) blocked[y * W + x] = 1;
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
  const tuftRamp = th.ground === 'dry' ? TR.dry : th.ground === 'swamp' ? TR.swamp : th.ground === 'ash' ? TR.ash : th.ground === 'dark' ? TR.dark : RAMP.grass;
  for (let k = 0; k < (W * H) / (grassy ? 90 : 220); k++) {
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
    case 'orc': {
      const bone = hexRGB('#eee6cc'), bone2 = hexRGB('#a8a088'), pole = hexRGB('#3e2614'), red = hexRGB('#e84838'), red2 = hexRGB('#8c2018');
      scatter(area / 1400, (x, y) => { // hromádka kostí
        for (let k = 0; k < 5; k++) { const bx2 = x + Math.floor(rnd() * 6) - 3, by2 = y + Math.floor(rnd() * 3); set(bx2, by2, bone); set(bx2 + 1, by2, bone2); }
      }, 3);
      scatter(area / 2600, (x, y) => { // orkská zástava na kolíku
        for (let k = 0; k < 13; k++) set(x, y - k, pole);
        for (let dy = 0; dy < 6; dy++) for (let dx = 1; dx <= 5 - (dy > 3 ? dy - 3 : 0); dx++) set(x + dx, y - 12 + dy, dx === 1 || dy === 0 ? red : red2);
        set(x, y - 13, bone); set(x - 1, y - 12, bone2); set(x + 1, y - 13, bone2);
        for (let dx = -1; dx < 4; dx++) darken(x + dx, y + 1, 0.6);
      }, 8);
      scatter(area / 1600, (x, y) => blob(x, y, 2, TR.dark, 0.5, K), 4);
      break;
    }
  }

  bx.putImageData(img, 0, 0);
  return { bg, theme: th, foam, lava, spawn };
}
