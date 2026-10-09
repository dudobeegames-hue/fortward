'use strict';
// Fortward – titulná obrazovka: súmrak nad ostrovom, hrad ľudí a pevnosť hordy, v popredí traja hrdinovia
// (rytier, orkský veľkráľ, kostlivec). Kreslí sa na polovičnom rozlíšení a zväčší 2×, aby pôsobila ako ilustrácia.
const TITLE = (() => {
  const hx = s => hexRGB(s), R = a => a.map(hexRGB);
  const SKY = R(['#0c0a1c', '#141030', '#1e1640', '#2e1c4c', '#4a2454', '#702e52', '#9c3c48', '#c85a3c', '#e8843c', '#f8b456']);
  const MTN_FAR = R(['#1c1434', '#261a40', '#32214c', '#3e2854']);
  const MTN_NEAR = R(['#120e22', '#18122c', '#201836', '#2a1e40']);
  const GROUND = R(['#0a0e0c', '#0e1612', '#141e18', '#1a281e', '#223424', '#2c422c']);
  const ROCK = R(['#0e0c12', '#18141e', '#241e2a', '#342a36', '#4a3a40', '#6a4c44', '#a0603c']);
  const PATH = R(['#1a1410', '#241c16', '#30241a', '#3e3020', '#4e3c28']);
  const STONE_H = R(['#22222e', '#30303e', '#42424e', '#585866', '#70707e', '#8c8a96']);
  const ORC_ST = R(['#0c0a10', '#141018', '#1e1822', '#28202c']);
  const METAL = R(['#1c1c24', '#3a3a46', '#5e5e6c', '#8a8a98', '#b8b8c4', '#e8e8f0']);
  const BLUE = R(['#141c40', '#1c2c68', '#2c4ca0', '#3c64c8', '#5a86e8', '#88b4ff']);
  const BONE = R(['#3a3428', '#5e5644', '#8a8066', '#b4aa8a', '#d8d0b0', '#f0eaD0']);
  const RUST = R(['#3a1c10', '#5e2e16', '#86441e', '#a8622c']);
  const CLOTH = R(['#120c1a', '#1e142a', '#2c1e3c', '#3c2a50']);
  const GLOWY = hx('#fff070'), GLOWO = hx('#f89838'), FIRE_R = hx('#d83818');

  let bg = null, key = '', layer = null, lx = null, heroes = null;
  const geo = (w, h) => ({ hy: Math.round(h * 0.4), gy: Math.round(h * 0.54) }); // horizont, zem pod hrdinami

  // ---- statické pozadie (prepočíta sa len pri zmene rozmeru) ----
  function buildBg(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), id = x.createImageData(w, h), d = id.data;
    const set = (px, py, col) => { if (px < 0 || py < 0 || px >= w || py >= h || !col) return; const i = (py * w + px) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
    const { hy, gy } = geo(w, h);
    const fx = w - 16, fyTop = hy - 30;                       // pevnosť hordy vpravo
    // obloha: od noci hore k žiare súmraku pri obzore, vpravo naoranžovelá od ohňov hordy
    for (let y = 0; y < hy + 2; y++) for (let px = 0; px < w; px++) {
      let v = Math.pow(y / hy, 1.6);
      v += 0.22 * Math.exp(-(((px - fx) / 30) ** 2 + ((y - hy) / 18) ** 2));
      set(px, y, pickRamp(SKY, Math.min(1, v), px, y));
      if (y < hy * 0.55 && hash2(px, y, 41) > 0.988) set(px, y, hash2(px, y, 43) > 0.5 ? hx('#f4f4f8') : hx('#9a9ab8')); // hviezdy
    }
    // mesiac
    const mx = Math.round(w * 0.78), my = Math.round(h * 0.16);
    for (let y = my - 6; y <= my + 6; y++) for (let px = mx - 6; px <= mx + 6; px++) {
      const r = Math.hypot(px - mx, y - my);
      if (r <= 4.6) set(px, y, pickRamp(R(['#9a96b0', '#c8c4d8', '#ecebf4', '#ffffff']), 0.95 - (px - mx + y - my) * 0.06 - (hash2(px, y, 47) > 0.8 ? 0.35 : 0), px, y));
      else if (r <= 6.2 && ((px + y) & 1)) set(px, y, pickRamp(SKY, 0.5, px, y)); // jemný svit
    }
    // vzdialené a bližšie hory
    for (let px = 0; px < w; px++) {
      const t1 = Math.round(hy - 14 - fbm(px * 0.05, 0.5, 3) * 16), t2 = Math.round(hy - 4 - fbm(px * 0.08, 2.5, 9) * 10);
      for (let y = t1; y < hy + 2; y++) set(px, y, pickRamp(MTN_FAR, 0.8 - (y - t1) / 30 + (y === t1 ? 0.3 : 0), px, y));
      for (let y = t2; y < hy + 2; y++) set(px, y, pickRamp(MTN_NEAR, 0.7 - (y - t2) / 14 + (y === t2 ? 0.35 : 0), px, y));
    }
    // planina s cestou medzi hradmi
    for (let y = hy; y < h; y++) for (let px = 0; px < w; px++) {
      const k = (y - hy) / (h - hy);
      const roadC = w * 0.5 + Math.sin(y * 0.12) * 4 * k, roadW = 1 + k * 9;
      if (Math.abs(px - roadC) < roadW) { set(px, y, pickRamp(PATH, 0.65 - k * 0.5 + (hash2(px, y, 51) - 0.5) * 0.2, px, y)); continue; }
      set(px, y, pickRamp(GROUND, 0.75 - k * 0.7 + (fbm(px * 0.15, y * 0.15, 5) - 0.5) * 0.35, px, y));
    }
    // kopec s hradom ľudí vľavo
    const cx = Math.round(w * 0.17), cTop = hy - 4;
    for (let y = cTop; y < hy + 8; y++) for (let px = cx - 26; px <= cx + 26; px++) {
      const r = ((px - cx) / 26) ** 2 + ((y - (hy + 8)) / 13) ** 2;
      if (r <= 1) set(px, y, pickRamp(GROUND, 0.55 - (px - cx) / 60 - (y - cTop) / 20, px, y));
    }
    const wall = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let px = x0; px <= x1; px++) set(px, y, pickRamp(STONE_H, 0.75 - (px - x0) / (x1 - x0 + 1) * 0.35 - ((y - y0) % 3 === 2 ? 0.25 : 0), px, y)); };
    wall(cx - 12, cx + 12, cTop - 8, cTop);                                 // hradby
    for (let px = cx - 12; px <= cx + 12; px += 2) set(px, cTop - 9, pickRamp(STONE_H, 0.7, px, 0)); // cimburie
    for (const [tx, tw, th] of [[cx - 15, 5, 16], [cx - 3, 6, 22], [cx + 11, 5, 15]]) {
      wall(tx, tx + tw - 1, cTop - th, cTop);
      for (let y = 0; y < 6; y++) { const hw = (y + 1) / 6 * (tw / 2 + 1); for (let px = Math.floor(tx + tw / 2 - hw); px <= Math.ceil(tx + tw / 2 - 1 + hw); px++) set(px, cTop - th - 6 + y, pickRamp(BLUE, 0.75 - (px - tx) / tw * 0.4, px, y)); }
      for (let y = cTop - th + 3; y < cTop - 2; y += 4) set(tx + Math.floor(tw / 2), y, GLOWY);  // rozsvietené okná
    }
    for (let y = cTop - 4; y <= cTop; y++) for (let px = cx - 1; px <= cx + 1; px++) set(px, y, hx('#1c140e')); // brána
    // skala s pevnosťou hordy vpravo
    for (let y = fyTop + 10; y < hy + 10; y++) for (let px = fx - 20; px < w; px++) {
      const edge = fx - 14 + (y - fyTop) * 0.35 + (hash2(0, y, 61) - 0.5) * 4;
      if (px < edge) continue;
      set(px, y, pickRamp(ROCK, 0.35 - (px - edge) / 40 + (hash2(px, y, 63) - 0.5) * 0.25 + (px - edge < 1.5 ? 0.45 : 0), px, y)); // svetlý lem od žiary
    }
    const fwall = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let px = x0; px <= x1; px++) set(px, y, pickRamp(ORC_ST, 0.85 - (px - x0) / (x1 - x0 + 1) * 0.6, px, y)); };
    fwall(fx - 9, fx + 9, fyTop, fyTop + 12);
    fwall(fx - 4, fx + 4, fyTop - 10, fyTop + 2);
    for (let px = fx - 9; px <= fx + 9; px += 3) { set(px, fyTop - 1, hx('#eee6cc')); set(px, fyTop - 2, hx('#a8a088')); } // kostené hroty
    for (const [wx, wy] of [[fx - 6, fyTop + 4], [fx + 5, fyTop + 4], [fx, fyTop - 6], [fx - 1, fyTop + 8]]) set(wx, wy, FIRE_R);
    // skalný výbežok pod hrdinami (horný okraj osvetlený súmrakom)
    for (let y = gy - 2; y < h; y++) for (let px = 0; px < w; px++) {
      const top = gy - 2 + Math.round((fbm(px * 0.12, 9.5, 71) - 0.5) * 4 + Math.abs(px - w / 2) * 0.06);
      if (y < top) continue;
      set(px, y, pickRamp(ROCK, (y - top < 1 ? 0.95 : y - top < 2 ? 0.7 : 0.42 - (y - top) / 40) + (hash2(px, y, 73) - 0.5) * 0.18, px, y));
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // ---- hrdinovia ----
  // rytier 22x28 (podľa predlohy): modrý chochol, strieborná prilba s priezorom, modrý okrúhly štít, zdvihnutý meč
  function makeKnight() {
    const p = painter(22, 28);
    for (let y = 0; y <= 6; y++) for (let x = 6; x <= 12; x++) { const cx = 10 - y * 0.5, r = Math.abs(x - cx); if (r <= 2.2 - (y > 4 ? 0.8 : 0)) p.shade(x, y, BLUE, 0.85 - r * 0.2 - y * 0.03); } // chochol
    for (let y = 5; y <= 11; y++) for (let x = 7; x <= 14; x++) { if ((y === 5 || y === 11) && (x === 7 || x === 14)) continue; p.shade(x, y, METAL, 0.92 - (x - 7) * 0.08 - (y === 11 ? 0.25 : 0)); } // prilba
    for (let x = 8; x <= 13; x++) p.set(x, 8, METAL[0]); for (let y = 8; y <= 10; y++) p.set(11, y, METAL[0]); p.set(14, 7, hx('#f8d048')); // priezor
    for (let y = 12; y <= 20; y++) for (let x = 7; x <= 14; x++) p.shade(x, y, BLUE, 0.7 - (x - 7) * 0.06 - (y > 17 ? 0.15 : 0)); // tunika
    for (const [sx, v] of [[6, 0.9], [15, 0.55]]) for (let y = 12; y <= 13; y++) { p.shade(sx, y, METAL, v); p.shade(sx + (sx === 6 ? 1 : -1), y, METAL, v - 0.1); } // nárameníky
    for (let x = 7; x <= 14; x++) p.shade(x, 18, WOOD, 0.45); p.set(11, 18, hx('#f8d048'));                          // opasok
    for (const lx of [8, 12]) for (let y = 21; y <= 27; y++) for (let x = lx; x <= lx + 2; x++) p.shade(x, y, y >= 25 ? WOOD : METAL, y >= 25 ? 0.4 : 0.7 - (x - lx) * 0.15);
    for (let y = 13; y <= 15; y++) p.shade(17, y, STRAW, 0.6);                                                          // ruka s mečom
    for (let y = 0; y <= 11; y++) { p.shade(17, y, METAL, 0.98); p.shade(18, y, METAL, 0.6); }                        // čepeľ
    p.set(17, 0, METAL[5]); for (let x = 15; x <= 20; x++) p.set(x, 12, hx(x === 15 || x === 20 ? '#b88420' : '#f8d048')); // záštita
    pDisk(p, 5, 17, 4.6, 5.2, (x, y, nx, ny, q) => p.set(x, y, q > 0.7 ? pickRamp(METAL, 0.85 - nx * 0.3, x, y) : q < 0.08 ? METAL[4] : pickRamp(BLUE, 0.75 - nx * 0.3 - ny * 0.15, x, y))); // štít
    return p.finish();
  }
  // kostlivec 22x28: zhrdzavená prilba, lebka so svietiacimi očnicami, rebrá, roztrhaný plášť, hrdzavý meč a rozbitý štít
  function makeSkeleton() {
    const p = painter(22, 28);
    for (let y = 12; y <= 24; y++) for (let x = 5; x <= 16; x++) { if (y > 20 && hash2(x, y, 81) > 0.55) continue; p.shade(x, y, CLOTH, 0.7 - Math.abs(x - 10.5) * 0.05 - (y - 12) * 0.02); } // plášť
    for (let y = 3; y <= 10; y++) for (let x = 7; x <= 14; x++) { if ((y === 3 || y >= 9) && (x === 7 || x === 14)) continue; p.shade(x, y, BONE, 0.9 - (x - 7) * 0.07 - (y > 8 ? 0.2 : 0)); } // lebka
    for (const ex of [8, 12]) for (let y = 6; y <= 7; y++) { p.set(ex, y, hx('#0a0810')); p.set(ex + 1, y, hx('#0a0810')); } // očnice
    p.set(10, 8, hx('#1c140e')); p.set(11, 8, hx('#1c140e'));                                                       // nos
    for (let x = 8; x <= 13; x++) p.set(x, 10, x % 2 ? BONE[4] : BONE[1]);                                          // zuby
    for (let y = 1; y <= 5; y++) for (let x = 7; x <= 14; x++) { // otlčená železná prilba s hrdzou
      if (y === 1 && (x < 9 || x > 12)) continue;
      if (y === 5 && x > 8 && x < 13) continue;                        // spodný okraj nad očnicami
      if (hash2(x, y, 83) > 0.72) p.set(x, y, RUST[1 + (x & 1)]); else p.shade(x, y, METAL, 0.62 - (x - 7) * 0.07 + (y === 1 ? 0.15 : 0));
    }
    p.set(6, 2, BONE[4]); p.set(5, 1, BONE[3]); p.set(15, 2, BONE[2]); p.set(16, 1, BONE[1]);   // kostené rohy
    for (let y = 11; y <= 20; y++) p.shade(10, y, BONE, 0.7);                                                         // chrbtica
    for (const ry of [12, 14, 16]) for (let x = 8; x <= 13; x++) if (x !== 10) p.shade(x, ry, BONE, 0.85 - Math.abs(x - 10.5) * 0.08); // rebrá
    for (let x = 8; x <= 13; x++) p.shade(x, 19, BONE, 0.6);                                                          // panva
    for (const lx of [8, 12]) for (let y = 20; y <= 27; y++) p.shade(lx + (y > 24 ? (lx === 8 ? -1 : 1) : 0), y, BONE, 0.75 - (y > 25 ? 0.2 : 0)); // nohy
    for (let y = 12; y <= 17; y++) { p.shade(6, y, BONE, 0.8); p.shade(15, y, BONE, 0.55); }                         // ruky
    for (let y = 1; y <= 13; y++) { p.shade(4, y, RUST, 0.8 - (hash2(4, y, 85) > 0.7 ? 0.35 : 0)); p.shade(5, y, RUST, 0.5); } // hrdzavý meč hore
    for (let x = 2; x <= 7; x++) p.set(x, 13, RUST[1]); p.set(4, 0, RUST[3]);
    pDisk(p, 17, 17, 3.8, 4.4, (x, y, nx, ny, q) => { if (nx > 0.55 && ny < -0.1) return; p.set(x, y, q > 0.65 ? pickRamp(RUST, 0.6 - nx * 0.3, x, y) : pickRamp(STONE_H, 0.35 - nx * 0.2, x, y)); }); // rozbitý štít
    return p.finish();
  }

  function ensure(w, h) {
    const k = w + 'x' + h;
    if (key === k) return;
    key = k; bg = buildBg(w, h);
    layer = document.createElement('canvas'); layer.width = w; layer.height = h; lx = layer.getContext('2d');
    if (!heroes) heroes = { knight: makeKnight(), orc: makeOrcKing(0), orc2: makeOrcKing(1), skel: makeSkeleton() };
  }

  function draw(g, W, H, time) {
    const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
    ensure(w, h);
    const { hy, gy } = geo(w, h), c = lx;
    c.drawImage(bg, 0, 0);
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
    // vlajky na hrade ľudí
    const cx = Math.round(w * 0.17), cTop = hy - 4;
    for (const [tx, th] of [[cx - 13, 16], [cx, 22], [cx + 13, 15]]) {
      const fy = cTop - th - 10, fr = Math.floor(time * 4 + tx) % 3;
      for (let y = fy; y < fy + 5; y++) px(tx, y, '#3e2614');
      for (let i = 0; i < 4; i++) px(tx + 1 + i, fy + (i === 3 && fr === 1 ? 1 : 0) + (i >= 2 && fr === 2 ? 1 : 0), i % 2 ? '#3c64c8' : '#5a86e8');
      for (let i = 0; i < 3; i++) px(tx + 1 + i, fy + 1 + (i === 2 && fr === 0 ? 1 : 0), '#2c4ca0');
    }
    // oheň a iskry nad pevnosťou hordy
    const fx = w - 16, fyTop = hy - 30;
    for (const ox of [-8, 8]) {
      const fl = Math.floor(time * 9 + ox) % 3;
      px(fx + ox, fyTop - 2 - fl, '#fff070'); px(fx + ox, fyTop - 1, '#f89838'); px(fx + ox - 1, fyTop - 1 + (fl === 1 ? -1 : 0), '#d83818'); px(fx + ox + 1, fyTop - 1 - (fl === 2 ? 1 : 0), '#d83818');
    }
    for (let k = 0; k < 14; k++) {
      const t = (time * 0.35 + k * 0.137) % 1, ex = fx + (hash2(k, 1, 91) - 0.5) * 22 + Math.sin(time * 2 + k) * 2, ey = fyTop - t * 34;
      if (t < 0.85) px(ex, ey, t < 0.3 ? '#fff070' : t < 0.6 ? '#f89838' : '#8a3020');
    }
    if (Math.sin(time * 3) > 0) px(fx, fyTop - 6, '#f89838');
    // hrdinovia (jemné dýchanie s rôznou fázou)
    const bob = ph => (Math.sin(time * 2.2 + ph) > 0.3 ? -1 : 0);
    const H3 = heroes, shadowAt = (x, y, r) => { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(Math.round(x - r), y, r * 2, 1); };
    const kx = Math.round(w * 0.2), ox = Math.round(w * 0.5), sx = Math.round(w * 0.8);
    shadowAt(kx, gy, 7); shadowAt(ox, gy + 2, 9); shadowAt(sx, gy, 7);
    c.drawImage(H3.knight.c, kx - 11, gy - 28 + bob(0));
    c.drawImage(H3.skel.c, sx - 11, gy - 28 + bob(2));
    c.drawImage((Math.floor(time * 1.1) % 2 ? H3.orc2 : H3.orc).c, ox - 13, gy + 2 - 30 + bob(4));
    // záblesk na meči rytiera, oči kostlivca, oči orka
    const gl = (time * 0.6) % 2.4;
    if (gl < 0.6) px(kx - 11 + 17, gy - 28 + bob(0) + 11 - Math.floor(gl / 0.6 * 11), '#ffffff');
    const glow = 0.55 + 0.45 * Math.sin(time * 3);
    c.globalAlpha = glow; for (const ex of [8, 12]) { px(sx - 11 + ex, gy - 28 + bob(2) + 6, '#7affff'); px(sx - 11 + ex + 1, gy - 28 + bob(2) + 7, '#2ad0e0'); } c.globalAlpha = 1;
    // nízka hmla nad planinou
    c.fillStyle = 'rgba(160,140,190,0.07)';
    for (let k = 0; k < 3; k++) { const mx = ((time * (3 + k) + k * 60) % (w + 60)) - 30; c.fillRect(Math.round(mx - 20), hy + 4 + k * 5, 40, 2); }
    g.imageSmoothingEnabled = false;
    g.drawImage(layer, 0, 0, w, h, 0, 0, w * 2, h * 2);
  }
  return { draw };
})();
