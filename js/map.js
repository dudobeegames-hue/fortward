'use strict';
// Fortward – mapa ostrova: 10 misií prepojených cestičkou zdola (1) nahor (10).

const MISSION_WAVES = 10;
const MISSIONS = [
  { name: 'Rybárska osada',  desc: 'Prvé hordy goblinov sa vylodili na pobreží. Ubráň osadu.' },
  { name: 'Mlynský potok',   desc: 'Orkovia pália mlyny pri potoku. Nedovoľ im prejsť.' },
  { name: 'Brezový háj',     desc: 'V lese sa skrývajú rýchli goblini. Postav hradby včas.' },
  { name: 'Kamenný brod',    desc: 'Cez brod sa valia prví surovci. Budeš potrebovať silnú obranu.' },
  { name: 'Strážny vrch',    desc: 'Udrž vrch, z ktorého vidno celý ostrov.' },
  { name: 'Hmlisté močiare', desc: 'Z hmly sa hordy vynárajú vo veľkých skupinách.' },
  { name: 'Vlčí priesmyk',   desc: 'Úzky priesmyk je ideálne miesto na hradby a pasce.' },
  { name: 'Staré ruiny',     desc: 'V ruinách sa zhromažďujú vojvodcovia orkov.' },
  { name: 'Popolavé svahy',  desc: 'Posledná obrana pred pevnosťou orkov.' },
  { name: 'Pevnosť orkov',   desc: 'Rozhodujúca bitka o ostrov. Porazíš vojvodcov?' },
];

// rozloženie bodov (0..1), had zdola nahor
const MAP_NODES = [
  [0.26, 0.95], [0.62, 0.88], [0.84, 0.76], [0.54, 0.66], [0.18, 0.58],
  [0.30, 0.45], [0.68, 0.40], [0.86, 0.27], [0.56, 0.17], [0.26, 0.06],
];

const SEA = ['#08142e', '#0c1e44', '#10285a', '#163a7a', '#1e5096', '#2a6ab0', '#3c88c8', '#5aa8d8', '#8ad0e8'].map(hexRGB);
const SNOW = ['#8a90a0', '#b4bcc8', '#dce4ee', '#ffffff'].map(hexRGB);
const SAND = ['#6e5838', '#8a7048', '#a88a5a', '#c4a670', '#dcc08a', '#ecd8a8'].map(hexRGB);

function mapLayout(W, H) {
  const top = 40, bot = H - 112;
  const nodes = MAP_NODES.map(([nx, ny]) => ({ x: Math.round(W * (0.1 + nx * 0.8)), y: Math.round(top + ny * (bot - top)) }));
  return { top, bot, nodes };
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

function mapPaths(nodes) {
  const segs = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[Math.max(0, i - 1)], p1 = nodes[i], p2 = nodes[i + 1], p3 = nodes[Math.min(nodes.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 1.6);
    const pts = [];
    for (let k = 0; k <= n; k++) pts.push(catmull(p0, p1, p2, p3, k / n));
    segs.push(pts);
  }
  return segs;
}

function buildIsland(W, H, seed) {
  const L = mapLayout(W, H);
  const segs = mapPaths(L.nodes);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const cx = c.getContext('2d'), img = cx.createImageData(W, H), d = img.data;
  const set = (x, y, col) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  };
  const K = hexRGB(PAL.K);

  // blízkosť cesty a bodov (aby boli vždy na súši a bez stromov/hôr)
  const near = new Float32Array(W * H);
  const stamp = (px, py, r) => {
    for (let y = Math.max(0, Math.floor(py - r)); y <= Math.min(H - 1, py + r); y++)
      for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(W - 1, px + r); x++) {
        const v = 1 - Math.hypot(x - px, y - py) / r;
        if (v > near[y * W + x]) near[y * W + x] = v;
      }
  };
  for (const s of segs) for (let k = 0; k < s.length; k += 3) stamp(s[k].x, s[k].y, 16);
  for (const n of L.nodes) stamp(n.x, n.y, 26);

  const icx = W / 2, icy = (L.top + L.bot) / 2, rx = W * 0.47, ry = (L.bot - L.top) / 2 + 18;
  const elev = (x, y) => fbm(x * 0.045, y * 0.045, seed + 3) + (1 - (y - L.top) / (L.bot - L.top)) * 0.28;
  const foam = [], trees = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nb = near[y * W + x];
    const dd = Math.hypot((x - icx) / rx, (y - icy) / ry) + (fbm(x * 0.035, y * 0.035, seed) - 0.5) * 0.42 - nb * 0.35;
    if (dd > 1) {
      const depth = dd - 1;
      let v = 0.8 - depth * 2.6 + (fbm(x * 0.06, y * 0.06, seed + 5) - 0.5) * 0.15;
      const wave = (y + Math.round(Math.sin(x * 0.12 + y * 0.03) * 2)) % 7 === 0 && hash2(x >> 2, y, seed + 6) > 0.45;
      if (wave) v += 0.12;
      if (depth < 0.035) { v = 0.95; if (depth < 0.018) foam.push({ x, y, ph: hash2(x, y, 7) * 6.28 }); }
      set(x, y, pickRamp(SEA, Math.max(0.04, v), x, y));
    } else if (dd > 0.92) {
      set(x, y, pickRamp(SAND, 0.6 + (hash2(x, y, seed + 8) - 0.5) * 0.3 - (dd - 0.92) * 3, x, y));
    } else {
      const e = elev(x, y);
      if (e > 0.8 && nb < 0.2) {
        // hory – tieňovanie podľa sklonu (svetlo zľava zhora)
        const sl = (elev(x - 1, y - 1) - elev(x + 1, y + 1)) * 9;
        const v = 0.4 + sl + (e - 0.8) * 1.4;
        if (e > 0.97) set(x, y, pickRamp(SNOW, 0.6 + sl, x, y)); // sneh len na vrcholoch
        else set(x, y, pickRamp(RAMP.stone, v, x, y));
      } else {
        let v = 0.55 + (fbm(x * 0.06, y * 0.06, seed + 4) - 0.5) * 0.5 + (hash2(x, y, seed + 2) - 0.5) * 0.18;
        if (e > 0.72) v -= 0.12; // úpätie hôr
        const forest = fbm(x * 0.07, y * 0.07, seed + 9) > 0.58 && nb < 0.15 && dd < 0.85;
        if (forest) { v -= 0.2; if ((x % 5 === 0) && (y % 4 === 0) && hash2(x, y, seed + 10) > 0.3) trees.push({ x: x + Math.floor(hash2(x, y, 11) * 3), y }); }
        set(x, y, pickRamp(RAMP.grass, v, x, y));
      }
    }
  }
  // vychodený chodník pod cestičkou
  for (const s of segs) for (const p of s) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const edge = Math.abs(dx) + Math.abs(dy) === 2;
      if (edge && hash2(Math.round(p.x) + dx, Math.round(p.y) + dy, 3) > 0.5) continue;
      set(p.x + dx, p.y + dy, pickRamp(RAMP.dirt, edge ? 0.38 : 0.55, Math.round(p.x) + dx, Math.round(p.y) + dy));
    }
  }
  // stromy (zhora nadol kvôli prekrývaniu)
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    set(t.x, t.y + 3, RAMP.dirt[1]);
    for (let dy = -3; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
      const q = dx * dx + dy * dy * 1.3;
      if (q <= 5.5) set(t.x + dx, t.y + dy, pickRamp(RAMP.bush, 0.6 + (-dx - dy) * 0.1 - q * 0.02, t.x + dx, t.y + dy));
      else if (q <= 9) set(t.x + dx, t.y + dy, K);
    }
  }
  cx.putImageData(img, 0, 0);
  return { bg: c, foam, segs, nodes: L.nodes, fort: makeOrcFort(), castle: makeMiniCastle(false), castleLocked: makeMiniCastle(true) };
}

// pevnosť orkov pri misii 10
function makeOrcFort() {
  const p = painter(24, 22);
  const DS = ['#14141a', '#1e1e28', '#2c2c38', '#3e3e4c', '#525262'].map(hexRGB);
  for (let y = 9; y <= 20; y++) for (let x = 1; x <= 22; x++) {
    if (y === 9 && x % 3 === 0) continue;
    let v = 0.55 - (x - 1) / 21 * 0.3 + ((y - 10) % 3 === 2 ? -0.25 : 0);
    if (y === 9 || y === 10) v = 0.85;
    p.shade(x, y, DS, v);
  }
  for (let y = 2; y <= 20; y++) for (let x = 8; x <= 15; x++) {
    if (y === 2 && x % 2 === 1) continue;
    p.shade(x, y, DS, (y <= 3 ? 0.9 : 0.62 - (x - 8) * 0.06) + ((y - 4) % 3 === 2 ? -0.25 : 0));
  }
  for (let y = 14; y <= 20; y++) for (let x = 10; x <= 13; x++) p.set(x, y, hexRGB('#0c0806'));
  for (let y = 6; y <= 8; y++) for (let x = 10; x <= 13; x++) if (x === 11 || x === 12) p.set(x, y, hexRGB('#f89838'));
  // hroty a červená zástava
  for (const sx of [3, 6, 18, 21]) { p.set(sx, 7, hexRGB('#a0a0aa')); p.set(sx, 8, hexRGB('#525262')); }
  for (let y = 0; y < 6; y++) p.set(16, y - 0, hexRGB('#4a4e60'));
  for (let y = 0; y < 3; y++) for (let x = 17; x <= 20; x++) p.set(x, y, hexRGB(y === 0 ? '#e84838' : '#8c2018'));
  return p.finish();
}

// ---- Odomykanie: čo prináša každá misia (misia 1 = základná výbava) ----
const UNLOCKS = [
  [{ id: 'tower', name: 'Strážna veža', icon: 'tower' }, { id: 'wall', name: 'Hradby', icon: 'wall' }, { id: 'volley', name: 'Šípová salva', icon: 'u_archer' }],
  [{ id: 'pit', name: 'Jama s ostňami', icon: 'pit' }, { id: 'mine', name: 'Zlatá baňa', icon: 'mine' }],
  [{ id: 'gate', name: 'Brána', icon: 'gate' }, { id: 'wallArcher', name: 'Lukostrelec na hradbách', icon: 'u_archer' }],
  [{ id: 'barracks', name: 'Kasárne a rytieri', icon: 'barracks' }],
  [{ id: 'hall3', name: 'Radnica do úrovne 3', icon: 'hall' }, { id: 'catapult', name: 'Katapult', icon: 'catapult' }],
  [{ id: 'mage', name: 'Veža mága', icon: 'mage' }, { id: 'bell', name: 'Zvonica', icon: 'bell' }],
  [{ id: 'wallCrossbow', name: 'Kušník na hradbách', icon: 'u_crossbow' }, { id: 'chapel', name: 'Kaplnka', icon: 'chapel' }, { id: 'spikes', name: 'Ostnaté hradby', icon: 'wall' }],
  [{ id: 'volleyUp', name: 'Vylepšenie salvy', icon: 'u_archer' }, { id: 'firepit', name: 'Ohnivá jama', icon: 'firepit' }, { id: 'beartrap', name: 'Medvedia pasca', icon: 'beartrap' }, { id: 'knightTypes', name: 'Druhy rytierov', icon: 'barracks' }, { id: 'warcry', name: 'Kráľov pokrik', icon: 'king' }],
  [{ id: 'lvl5', name: 'Stavby až do úrovne 5', icon: 'tower' }, { id: 'spec', name: 'Špecializácia veží', icon: 'tower' }, { id: 'well', name: 'Studňa', icon: 'well' }],
  [{ id: 'hall5', name: 'Radnica až do úrovne 5', icon: 'hall' }, { id: 'freeze', name: 'Kráľov mráz', icon: 'king' }],
];
// noví nepriatelia – predstavia sa v danej misii
const ENEMY_INTRO = {
  3: { id: 'garcher', name: 'Goblin-lukostrelec', desc: 'strieľa na budovy z diaľky' },
  4: { id: 'bat', name: 'Netopiere', desc: 'preletia ponad hradby priamo k radnici' },
  5: { id: 'ram', name: 'Beranidlo', desc: 'rozbíja hradby a rytierov ignoruje' },
  6: { id: 'shaman', name: 'Šaman', desc: 'lieči ostatných – zabi ho ako prvého' },
};
function techFor(m) {
  const s = new Set();
  for (let i = 0; i < Math.min(m, UNLOCKS.length); i++) UNLOCKS[i].forEach(u => s.add(u.id));
  return s;
}
function unlockMissionOf(id) {
  for (let i = 0; i < UNLOCKS.length; i++) if (UNLOCKS[i].some(u => u.id === id)) return i + 1;
  return 1;
}

// ---- Malý hradík pre bod misie na mape (19x18) ----
function makeMiniCastle(locked) {
  const p = painter(19, 18);
  const roof = locked ? ['#14141a', '#1e1e28', '#2c2c38', '#3e3e4c', '#525262'].map(hexRGB) : ROOF_BLUE;
  const bias = locked ? -0.28 : 0;
  // hlavná budova
  for (let y = 8; y <= 16; y++) for (let x = 5; x <= 13; x++) {
    let v = 0.62 + bias - (x - 5) * 0.03 + ((y - 8) % 3 === 2 ? -0.22 : 0);
    if (y === 16) v -= 0.15;
    p.shade(x, y, RAMP.stone, v);
  }
  for (let y = 3; y <= 9; y++) {
    const hw = (y - 2) / 7 * 5.5;
    for (let x = Math.floor(9 - hw); x <= Math.ceil(9 + hw); x++) {
      const nx = (x - 9) / Math.max(1, hw);
      if (Math.abs(nx) > 1.05) continue;
      p.shade(x, y, roof, 0.6 - nx * 0.3 + (y === 9 ? -0.3 : 0));
    }
  }
  // veže
  for (const tx of [1, 14]) {
    for (let y = 7; y <= 16; y++) for (let x = tx; x <= tx + 3; x++) p.shade(x, y, RAMP.stone, 0.68 + bias - (x - tx) * 0.1 + ((y - 7) % 3 === 2 ? -0.2 : 0));
    for (let y = 1; y <= 7; y++) {
      const hw = (y) / 7 * 2.6;
      for (let x = Math.floor(tx + 1.5 - hw); x <= Math.ceil(tx + 1.5 + hw); x++) {
        if (Math.abs(x - (tx + 1.5)) > hw + 0.3) continue;
        p.shade(x, y, roof, 0.62 - (x - tx - 1.5) / 3 * 0.35);
      }
    }
  }
  // brána a okná
  for (let y = 12; y <= 16; y++) for (let x = 8; x <= 10; x++) if (!(y === 12 && x !== 9)) p.set(x, y, locked ? hexRGB('#14100c') : WOOD[2]);
  const win = locked ? hexRGB('#1e1e28') : GLOW;
  p.set(6, 11, win); p.set(12, 11, win); p.set(2, 10, win); p.set(16, 10, win);
  return p.finish();
}
