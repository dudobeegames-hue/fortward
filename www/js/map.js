'use strict';
// Fortward – mapa ostrova: 10 misií prepojených cestičkou zdola (1) nahor (10).

const MISSION_WAVES = 10;
const HOME_PROVINCES = 5; // provincie 1–5 (juh) patria ľuďom, 6–10 (sever) horde
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

// kampaň za orkov ide po mape opačne: orkská misia 1 je pevnosť orkov hore (uzol 10), misia 10 rybárska osada dole;
// misie 1–5 bránia vlastné provincie, 6–10 útočia na tábory ľudí
const ORC_MISSIONS = [
  { name: 'Pevnosť orkov',   desc: 'Ľudia sa vylodili pod hradbami pevnosti. Ukáž im silu hordy.' },
  { name: 'Popolavé svahy',  desc: 'Rytieri šplhajú po popole. Zhoď ich zo svahov.' },
  { name: 'Staré ruiny',     desc: 'V ruinách sa skrývajú lukostrelci ľudí. Vyžeň ich.' },
  { name: 'Vlčí priesmyk',   desc: 'Jazda ľudí chce prejsť priesmykom. Zavri ho.' },
  { name: 'Hmlisté močiare', desc: 'Posledná obrana orkského územia. Za močiarmi začína juh.' },
  { name: 'Strážny vrch',    desc: 'Ľudia si na vrchu postavili tábor. Zrovnaj ho so zemou.' },
  { name: 'Kamenný brod',    desc: 'Pri brode stojí ľudská strážnica. Prebrodí sa horda?' },
  { name: 'Brezový háj',     desc: 'V háji sa opevnili kopijníci. Vypáľ ich tábor.' },
  { name: 'Mlynský potok',   desc: 'Mlyny živia ľudské vojsko. Bez nich padnú.' },
  { name: 'Rybárska osada',  desc: 'Posledné útočisko ľudí na ostrove. Dobi ho.' },
];

// rozloženie bodov (0..1), had zdola nahor
const MAP_NODES = [
  [0.26, 0.95], [0.62, 0.88], [0.84, 0.76], [0.54, 0.66], [0.18, 0.58],
  [0.30, 0.45], [0.68, 0.40], [0.86, 0.27], [0.56, 0.17], [0.26, 0.06],
];

const SEA = ['#08142e', '#0c1e44', '#10285a', '#163a7a', '#1e5096', '#2a6ab0', '#3c88c8', '#5aa8d8', '#8ad0e8'].map(hexRGB);
const SANDSTONE = ['#2a1810', '#422618', '#5c3620', '#784a2a', '#946036', '#ae7a46', '#c6965c', '#dcb47c', '#ecd09e'].map(hexRGB); // hory: stolové skaly z pieskovca
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

// cesta medzi hradmi: plynulá krivka, ktorá sa navyše prirodzene kľukatí (bočný posun zo šumu, pri hradoch nulový)
function mapPaths(nodes, seed) {
  const segs = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[Math.max(0, i - 1)], p1 = nodes[i], p2 = nodes[i + 1], p3 = nodes[Math.min(nodes.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 2);
    const base = [];
    for (let k = 0; k <= n; k++) base.push(catmull(p0, p1, p2, p3, k / n));
    const pts = base.map((p, k) => {
      const a = base[Math.max(0, k - 1)], b = base[Math.min(n, k + 1)], len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len, taper = Math.sin(Math.PI * k / n);
      const off = ((fbm(k * 0.045 + i * 7.3, i * 3.1, (seed || 0) + 61) - 0.5) * 16 + Math.sin(k * 0.11 + i) * 1.5) * taper;
      return { x: p.x + nx * off, y: p.y + ny * off };
    });
    segs.push(pts);
  }
  return segs;
}

// pad = pás mora nad aj pod ostrovom (body): ostrov je rovnaký, len plátno je vyššie a všetko sa posunie o pad nadol
function buildIsland(W, H, seed, pad) {
  pad = pad || 0;
  const CH = H + 2 * pad, at = (x, y) => (y + pad) * W + x; // y je v súradniciach rozloženia (0 = pôvodný vrch)
  const L = mapLayout(W, H);
  const segs = mapPaths(L.nodes, seed);
  const c = document.createElement('canvas'); c.width = W; c.height = CH;
  const cx = c.getContext('2d'), img = cx.createImageData(W, CH), d = img.data;
  const set = (x, y, col) => {
    x |= 0; y |= 0;
    if (x < 0 || y < -pad || x >= W || y >= H + pad) return;
    const i = at(x, y) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  };
  const K = hexRGB(PAL.K);

  // blízkosť cesty a bodov (aby boli vždy na súši a bez stromov/hôr)
  const near = new Float32Array(W * CH);
  const stamp = (px, py, r) => {
    for (let y = Math.max(-pad, Math.floor(py - r)); y <= Math.min(H + pad - 1, py + r); y++)
      for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(W - 1, px + r); x++) {
        const v = 1 - Math.hypot(x - px, y - py) / r;
        if (v > near[at(x, y)]) near[at(x, y)] = v;
      }
  };
  for (const s of segs) for (let k = 0; k < s.length; k += 3) stamp(s[k].x, s[k].y, 16);
  for (const n of L.nodes) stamp(n.x, n.y, 26);
  // presná vzdialenosť od cesty a od hradov (lesy smú až k chodníku, ale nie naň ani na hrad)
  const pathD = new Float32Array(W * CH).fill(99), nodeD = new Float32Array(W * CH).fill(99);
  const dist = (arr, px, py, r) => {
    for (let y = Math.max(-pad, Math.floor(py - r)); y <= Math.min(H + pad - 1, py + r); y++)
      for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(W - 1, px + r); x++) {
        const v = Math.hypot(x - px, y - py);
        if (v < arr[at(x, y)]) arr[at(x, y)] = v;
      }
  };
  for (const s of segs) for (let k = 0; k < s.length; k += 2) dist(pathD, s[k].x, s[k].y, 14);
  for (const n of L.nodes) dist(nodeD, n.x, n.y - 5, 16);

  const icx = W / 2, icy = (L.top + L.bot) / 2, rx = W * 0.47, ry = (L.bot - L.top) / 2 + 18;
  // more: plytčina pri brehu svetlá, ďalej postupne hlbšie, ale nikdy nie čierna; vlnenie z fbm (rovnako aj mimo plátna ostrova)
  const seaRGB = (x, y, depth) => {
    let v = 0.78 - Math.min(1, depth / 0.35) * 0.32 - Math.min(1, depth / 1.2) * 0.12;
    v += (fbm(x * 0.05, y * 0.05, seed + 5) - 0.5) * 0.22 + (fbm(x * 0.18, y * 0.12, seed + 12) - 0.5) * 0.08;
    const swell = Math.sin(x * 0.11 + y * 0.045 + fbm(x * 0.03, y * 0.03, seed + 13) * 6);
    if (swell > 0.82) v += 0.07; else if (swell < -0.9) v -= 0.05;                  // dlhé vlny
    if (depth < 0.06) v += (0.06 - depth) * 2.5;                                     // tyrkysová plytčina
    if (depth < 0.035) v = 0.95;
    return pickRamp(SEA, Math.max(0.22, v), x, y);
  };
  const elev = (x, y) => fbm(x * 0.045, y * 0.045, seed + 3) + (1 - (y - L.top) / (L.bot - L.top)) * 0.28;
  const foam = [], trees = [];
  // provincia každého kúska súše = najbližší hrad (so šumom, aby hranice neboli rovné); 255 = more
  const prov = new Uint8Array(W * CH).fill(255);
  const terr = new Uint8Array(W * CH); // druh terénu pre papierovú mapu: 0 more, 1 pláž, 2 tráva, 3 les, 4 hory, 5 sneh
  const provOf = (x, y) => {
    let best = 0, bd = 1e9;
    const jx = (fbm(x * 0.05, y * 0.05, seed + 31) - 0.5) * 18, jy = (fbm(x * 0.05, y * 0.05, seed + 37) - 0.5) * 18;
    L.nodes.forEach((n, i) => { const d = Math.hypot(x + jx - n.x, (y + jy - n.y) * 1.15); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  for (let y = -pad; y < H + pad; y++) for (let x = 0; x < W; x++) {
    const nb = near[at(x, y)];
    const dd = Math.hypot((x - icx) / rx, (y - icy) / ry) + (fbm(x * 0.035, y * 0.035, seed) - 0.5) * 0.42 - nb * 0.35;
    if (dd <= 1) prov[at(x, y)] = provOf(x, y);
    if (dd > 1) {
      const depth = dd - 1;
      if (depth < 0.018) foam.push({ x, y, ph: hash2(x, y, 7) * 6.28 });
      set(x, y, seaRGB(x, y, depth));
    } else if (dd > 0.92) {
      terr[at(x, y)] = 1;
      set(x, y, pickRamp(SAND, 0.6 + (hash2(x, y, seed + 8) - 0.5) * 0.3 - (dd - 0.92) * 3, x, y));
    } else {
      const e = elev(x, y);
      if (e > 0.8 && nb < 0.2) {
        terr[at(x, y)] = e > 0.97 ? 5 : 4;
        // hory = stolové skaly z pieskovca: široké plošiny podľa výšky, svetlá horná hrana, tmavá stena útesu pod vyššou plošinou
        const band = (xx, yy) => Math.floor((elev(xx, yy) - 0.8) / 0.06), bd = band(x, y);
        let v = 0.42 + bd * 0.13 + (fbm(x * 0.25, y * 0.25, seed + 65) - 0.5) * 0.12;
        if (band(x, y - 1) < bd) v += 0.2;                                        // horná hrana plošiny na svetle
        const cliff = band(x, y - 1) > bd || band(x, y - 2) > bd || band(x, y - 3) > bd; // stena pod vyššou plošinou
        if (cliff) v = 0.18 + (y % 2 ? 0.05 : 0) + (hash2(x, y, seed + 66) - 0.5) * 0.08;
        if (band(x - 1, y) > bd && !cliff) v -= 0.12;                            // tieň zboku
        set(x, y, pickRamp(SANDSTONE, v, x, y));
      } else {
        let v = 0.55 + (fbm(x * 0.06, y * 0.06, seed + 4) - 0.5) * 0.5 + (hash2(x, y, seed + 2) - 0.5) * 0.18;
        if (e > 0.72) v -= 0.12; // úpätie hôr
        // lesy: v krajine aj popri ceste (tam hustejšie), no s voľným pásom okolo chodníka a hradov
        const pd = pathD[at(x, y)], fn = fbm(x * 0.07, y * 0.07, seed + 9);
        const nearPath = pd < 14, forest = dd < 0.85 && pd >= 4 && nodeD[at(x, y)] >= 13 && (nearPath ? fn > 0.4 : fn > 0.58 && nb < 0.15);
        if (forest) { v -= 0.2; if ((x % (nearPath ? 4 : 5) === 0) && (y % 4 === 0) && hash2(x, y, seed + 10) > (nearPath ? 0.15 : 0.3)) { const tx = x + Math.floor(hash2(x, y, 11) * 3); if (pathD[y * W + Math.min(W - 1, tx)] >= 5) trees.push({ x: tx, y }); } }
        terr[at(x, y)] = forest ? 3 : 2;
        set(x, y, pickRamp(RAMP.grass, v, x, y));
      }
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
  // hrebene vĺn na otvorenom mori (kreslia sa pohyblivo počas hry)
  const waves = [];
  for (let k = 0; k < 900 && waves.length < 140; k++) {
    const wx = Math.floor(hash2(k, 3, seed + 51) * (W - 8)), wy = Math.floor(hash2(k, 5, seed + 53) * (H - 2));
    if (prov[at(wx, wy)] !== 255 || prov[at(Math.min(W - 1, wx + 6), wy)] !== 255) continue;
    const dd = Math.hypot((wx - icx) / rx, (wy - icy) / ry);
    if (dd < 1.08) continue;                                                           // nie v príboji
    waves.push({ x: wx, y: wy, len: 3 + Math.floor(hash2(k, 7, seed + 55) * 4), ph: hash2(k, 9, seed + 57) * 6.28 });
  }
  // miesta ohňov v napadnutých provinciách (pár bodov okolo hradu na súši)
  const fires = L.nodes.map((n, i) => {
    const pts = [];
    for (let k = 0; k < 40 && pts.length < 3; k++) {
      const a = hash2(i, k, seed + 41) * 6.283, r = 12 + hash2(k, i, seed + 43) * 14;
      const fx = Math.round(n.x + Math.cos(a) * r), fy = Math.round(n.y + Math.sin(a) * r * 0.8);
      if (fx < 2 || fy < 2 || fx >= W - 2 || fy >= H + pad - 2 || prov[at(fx, fy)] !== i) continue;
      if (Math.abs(fx - n.x) < 10 && fy > n.y - 18 && fy < n.y + 12) continue; // nie cez hrad a tabuľku
      pts.push({ x: fx, y: fy, ph: hash2(k, k, seed + 47) * 6.28 });
    }
    return pts;
  });
  // farba mora v ľubovoľnom bode okolo ostrova (aj mimo jeho plátna) – na plynulé rozšírenie mora na širšie displeje
  // (x, y) v súradniciach plátna ostrova
  const seaAround = (x, y) => { y -= pad; return seaRGB(x, y, Math.max(0, Math.hypot((x - icx) / rx, (y - icy) / ry) + (fbm(x * 0.035, y * 0.035, seed) - 0.5) * 0.42 - 1)); };
  // výstupné súradnice (hrady, chodník, príboj, vlny, ohne) do plátna – posun o pás mora; najvyšší a najnižší riadok súše
  if (pad) { for (const n of L.nodes) n.y += pad; for (const sg of segs) for (const pt of sg) pt.y += pad; for (const o of foam.concat(waves)) o.y += pad; for (const fl of fires) for (const o of fl) o.y += pad; }
  let landTop = CH, landBot = 0;
  for (let k = 0; k < prov.length; k++) if (prov[k] !== 255) { const ry2 = (k / W) | 0; if (ry2 < landTop) landTop = ry2; if (ry2 > landBot) landBot = ry2; }
  return { bg: c, seaAround, landTop, landBot, foam, waves, segs, nodes: L.nodes, prov, terr, fires, fort: makeOrcFort(), castle: makeMiniCastle(false) };
}

// pevnosť orkov pri misii 10
function makeOrcFort() {
  // orkská drevená pevnosť (15x14): zahrotené koly s kostenými hrotmi, strážna veža so zástavou,
  // chatrč za palisádou, lebka nad bránou a fakle po stranách
  const p = painter(15, 14);
  const W = ORC_WOOD, HIDE = ['#2a1c12', '#4a3020', '#6a4a30', '#8a6a48'].map(hexRGB);
  // chatrč zo zvieracích koží (vľavo za palisádou)
  for (let y = 3; y <= 7; y++) { const hw = (y - 2) * 0.8; for (let x = Math.floor(4 - hw); x <= Math.ceil(4 + hw); x++) p.shade(x, y, HIDE, 0.75 - (x - 4 + hw) / (2 * hw + 1) * 0.5 + (y % 2 ? 0 : -0.1)); }
  p.set(4, 2, BONE); p.set(3, 1, BONE2); p.set(5, 1, BONE2);                                  // rohy na vrchole
  // strážna veža (vpravo): nohy, plošina s hrotmi, zástava
  for (const lx of [9, 12]) for (let y = 3; y <= 8; y++) p.shade(lx, y, W, lx === 9 ? 0.85 : 0.5);
  pLine(p, 9, 4, 12, 7, (x, y) => p.shade(x, y, W, 0.45));
  for (let y = 1; y <= 2; y++) for (let x = 8; x <= 13; x++) p.shade(x, y, W, (y === 1 ? 0.98 : 0.65) - (x - 8) * 0.05);
  for (const sx of [8, 11]) p.set(sx, 0, BONE);
  p.set(13, 0, W[1]);                                                                            // žrď
  p.set(14, 0, BLOOD); p.set(14, 1, BLOOD2);                                                     // zástava
  // palisáda vpredu: koly rôznej výšky so špicami a previazaním
  for (let x = 0; x <= 14; x++) {
    const log = Math.floor(x / 2), lx = x % 2, top = 7 + (log * 7 % 2), tip = lx ? top - 1 : top;
    for (let y = tip; y <= 13; y++) {
      let v = [0.88, 0.5][lx] - (y - top) * 0.014;
      if (y === tip) v += 0.12;
      if (y === 10) v = 0.12;                                                                    // previazanie
      p.shade(x, y, W, v);
    }
    if (lx) p.set(x, tip - 1, BONE);                                                             // kostený hrot
  }
  // brána: tmavý priechod, stĺpy, preklad
  for (let y = 10; y <= 13; y++) for (let x = 6; x <= 8; x++) p.set(x, y, hexRGB('#0a0604'));
  for (const x of [5, 9]) for (let y = 9; y <= 13; y++) p.shade(x, y, W, x === 5 ? 0.95 : 0.55);
  for (let x = 5; x <= 9; x++) p.shade(x, 9, W, 0.9);
  // lebka nad bránou
  for (let y = 6; y <= 8; y++) for (let x = 6; x <= 8; x++) {
    const eye = y === 7 && (x === 6 || x === 8), teeth = y === 8 && x === 7;
    p.set(x, y, eye || teeth ? hexRGB('#1c140e') : x < 8 ? BONE : BONE2);
  }
  // fakle po stranách brány
  for (const tx of [3, 11]) { p.set(tx, 9, W[2]); p.set(tx, 8, EMBER); p.set(tx, 7, hexRGB('#fff070')); }
  return p.finish();
}

// ---- Odomykanie: čo prináša každá misia (misia 1 = základná výbava) ----
const UNLOCKS = [
  [{ id: 'paving', name: 'Dlažba', icon: 'paving' }, { id: 'tower', name: 'Strážna veža', icon: 'tower' }, { id: 'wall', name: 'Hradby', icon: 'wall' }, { id: 'pit', name: 'Jama s ostňami', icon: 'pit' }, { id: 'gate', name: 'Brána', icon: 'gate', desc: 'Prerob hradbu na bránu – tvoji rytieri cez ňu prejdú, horda nie.' }],
  [{ id: 'lvl2', name: 'Radnica a stavby úrovne 2', icon: 'hall', desc: 'Vylepši radnicu na kameň – a s ňou všetky stavby a strelcov.' }, { id: 'mine', name: 'Zlatá baňa', icon: 'mine' }, { id: 'mage', name: 'Veža mága', icon: 'mage' }],
  [{ id: 'icetower', name: 'Ľadová veža', icon: 'icetower' }, { id: 'wallArcher', name: 'Lukostrelec na hradbách', icon: 'u_archer', desc: 'Postav lukostrelca priamo na hradbu – strieľa rýchle šípy na hordu.' }],
  [{ id: 'lvl3', name: 'Radnica a stavby úrovne 3', icon: 'hall', desc: 'Vylepši radnicu na kameň s kovaním – a s ňou všetky stavby a strelcov.' }, { id: 'barracks', name: 'Kasárne a rytieri', icon: 'barracks' }],
  [{ id: 'range', name: 'Strelnica a lukostrelci', icon: 'range' }],
  [{ id: 'ballista', name: 'Balista', icon: 'ballista' }, { id: 'lvl4', name: 'Radnica a stavby úrovne 4', icon: 'hall', desc: 'Vylepši radnicu na tmavé opevnenie – a s ňou všetky stavby a strelcov.' }, { id: 'stables', name: 'Stajne a jazdci', icon: 'stables', desc: 'Jazdci rýchlo obídu líniu a idú po strelcoch, šamanoch a podkopníkoch.' }, { id: 'siegeRam', name: 'Baranidlo', icon: 'u_siegeRam', desc: 'Obliehací stroj zo záložky Stroje. Ide rovno na tábor hordy a rozbíja jeho stavby, orkov si nevšíma. Keď tábor nie je, rozráža hordu.' }],
  [{ id: 'wallCrossbow', name: 'Kušník na hradbách', icon: 'u_crossbow', desc: 'Silnejší strelec na hradby s väčším dosahom.' }, { id: 'chapel', name: 'Kaplnka', icon: 'chapel' }, { id: 'spikes', name: 'Ostnaté hradby', icon: 'wall', desc: 'Ostne zrania každého, kto do hradby udrie.' }, { id: 'armory', name: 'Zbrojnica a kopijníci', icon: 'armory', desc: 'Kopijníci útočia spoza rytierov a jazdu zastavia aj s trojnásobnou silou.' }, { id: 'siegeCat', name: 'Pojazdný katapult', icon: 'u_siegeCat', desc: 'Obliehací stroj zo záložky Stroje. Z diaľky ostreľuje tábor hordy, inak hádže balvany do najhustejšej hordy.' }],
  [{ id: 'firepit', name: 'Ohnivá jama', icon: 'firepit' }, { id: 'beartrap', name: 'Medvedia pasca', icon: 'beartrap' }, { id: 'siegeFire', name: 'Ohnivý voz', icon: 'u_siegeFire', desc: 'Obliehací stroj zo záložky Stroje. Strieka grécky oheň a podpáli každého pred sebou, pálí aj stavby tábora hordy (stany horia najlepšie).' }],
  [{ id: 'falconry', name: 'Sokoliareň a sokoly', icon: 'falconry', desc: 'Sokoly letia ponad hradby a lovia netopiere, šamanov a podkopníkov. Pechota na ne nedosiahne, strelci ich však ľahko zostrelia.' }, { id: 'lvl5', name: 'Radnica a stavby úrovne 5', icon: 'hall', desc: 'Vylepši radnicu na kráľovský kameň – a s ňou všetky stavby.' }, { id: 'spec', name: 'Špecializácia veží', icon: 'tower', desc: 'Veža od úrovne 3 dostane ohnivé šípy, rýchlu streľbu alebo ostreľovača.' }, { id: 'workshop', name: 'Dielňa remeselníka', icon: 'workshop' }, { id: 'spikeTypes', name: 'Ohnivé a ľadové ostne', icon: 'wall', desc: 'Ostne na hradbách môžu útočníka podpáliť alebo spomaliť.' }],
  [{ id: 'siegeTower', name: 'Obliehacia veža', icon: 'u_siegeTower', desc: 'Obliehací stroj zo záložky Stroje. Dvaja lukostrelci strieľajú z výšky ďaleko, aj na netopiere. Sprevádza ostatné stroje k táboru hordy.' }],
];
// noví nepriatelia – predstavia sa v danej misii (jeden alebo zoznam)
const ENEMY_INTRO = {
  3: { id: 'garcher', name: 'Goblin-lukostrelec', desc: 'strieľa na budovy z diaľky' },
  4: { id: 'bat', name: 'Netopiere', desc: 'preletia ponad hradby priamo k radnici' },
  5: { id: 'ram', name: 'Beranidlo', desc: 'rozbíja hradby a rytierov ignoruje' },
  6: { id: 'shaman', name: 'Šaman', desc: 'lieči ostatných – zabi ho ako prvého' },
  7: [{ id: 'bear', name: 'Medvedí jazdec', desc: 'nápor zrazí rytiera aj jazdca – zastavia ho len kopijníci' },
      { id: 'giantRam', name: 'Obrí baran', desc: 'obor v hrubom pancieri ide rovno na hradby a radnicu – veže a jednotky ho len škrabnú, obliehacie stroje ho rozbijú' }],
  8: [{ id: 'sapper', name: 'Podkopník', desc: 'beží k hradbám a vyhodí ich do vzduchu – zastreľ ho skôr' },
      { id: 'mammoth', name: 'Vojnový mamut', desc: 'obor v hrubom pancieri – goblini z vežičky strieľajú za chôdze a mamut pošliape vojakov; proti nemu pošli obliehacie stroje' }],
  9: { id: 'wolf', name: 'Vlčí jazdci', desc: 'prebehnú cez rytierov a idú po lukostrelcoch – zastavia ich kopijníci' },
  10: { id: 'orcKing', name: 'Orkský veľkráľ', desc: 'vyjde z tábora v poslednej vlne – dupnutím omračuje a privoláva goblinov' },
};
// za orkov útočia ľudia: tie isté druhy nepriateľov (rovnaká mechanika) vo vzhľade ľudských jednotiek
const ORC_ENEMY_INTRO = {
  3: { id: 'garcher', name: 'Lukostrelci', desc: 'strieľajú na budovy z diaľky' },
  4: { id: 'bat', name: 'Sokoly', desc: 'preletia ponad palisádu priamo k pevnosti' },
  5: { id: 'ram', name: 'Baranidlo', desc: 'rozbíja palisádu a orkov ignoruje' },
  6: { id: 'shaman', name: 'Mních', desc: 'lieči ostatných – zabi ho ako prvého' },
  7: [{ id: 'bear', name: 'Ťažká jazda', desc: 'nápor zrazí orka aj vlčieho jazdca – zastavia ju len surovci' },
      { id: 'giantRam', name: 'Veľké baranidlo', desc: 'obor v hrubom pancieri ide rovno na palisádu a pevnosť – veže a jednotky ho len škrabnú, obliehacie stroje ho rozbijú' }],
  8: [{ id: 'sapper', name: 'Remeselník s prachom', desc: 'beží k palisáde a vyhodí ju do vzduchu – zastreľ ho skôr' },
      { id: 'mammoth', name: 'Obliehacia veža', desc: 'obor v hrubom pancieri – lukostrelci z cimburia strieľajú za jazdy a veža prevalcuje vojakov; proti nej pošli obliehacie stroje' }],
  9: { id: 'wolf', name: 'Jazdci', desc: 'prebehnú cez orkov a idú po goblinoch s lukmi – zastavia ich surovci' },
  10: { id: 'orcKing', name: 'Veliteľ jazdy', desc: 'vyjde z tábora v poslednej vlne – dupnutím koňa omračuje a privoláva rytierov' },
};
// za orkov sa jedový kotol (icetower) odomyká ako druhá veža (misia 2) a ohnivý totem (mage) až v misii 3
let UNLOCK_RACE = 'human';
// kušník na hradbách a ostnaté hradby majú len ľudia
const ORC_UNLOCKS = UNLOCKS.map(l => l.filter(u => !['wallCrossbow', 'spikes', 'spikeTypes'].includes(u.id)).map(u => Object.assign({}, u)));
(() => {
  const a = ORC_UNLOCKS[1], b = ORC_UNLOCKS[2], i = a.findIndex(u => u.id === 'mage'), j = b.findIndex(u => u.id === 'icetower');
  [a[i], b[j]] = [b[j], a[i]];
})();
const unlocksOf = () => UNLOCK_RACE === 'orc' ? ORC_UNLOCKS : UNLOCKS;
function techFor(m) {
  const s = new Set(), U = unlocksOf();
  for (let i = 0; i < Math.min(m, U.length); i++) U[i].forEach(u => s.add(u.id));
  return s;
}
function unlockMissionOf(id) {
  const U = unlocksOf();
  for (let i = 0; i < U.length; i++) if (U[i].some(u => u.id === id)) return i + 1;
  return 1;
}

// ---- Malý hradík pre bod misie na mape (15x14) ----
function makeMiniCastle(locked) {
  // biela citadela (15x14): svetlý kameň, vysoká stredná veža so zlatým hrotom, nižšie krídla so zlatými lemami;
  // zamknutá je stmavená, bez zlata a svetla
  const p = painter(15, 14);
  const b = locked ? -0.45 : 0, st = STONE_WHITE;
  const roof = locked ? ['#14141a', '#1e1e28', '#2c2c38', '#3e3e4c', '#525262'].map(hexRGB) : ROOF_BLUE;
  const wall = (x0, x1, y0, y1, seed) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let v = 0.66 + b - (x - x0) / Math.max(1, x1 - x0) * 0.3 + ((y - y0) % 3 === 2 ? -0.2 : 0) + (hash2(x, y, seed) - 0.5) * 0.1;
      if ((y - y0) % 3 !== 2 && (x + Math.floor((y - y0) / 3) * 2) % 4 === 0) v -= 0.12;
      p.shade(x, y, st, v);
    }
  };
  const cone = (cx, yTop, yBot, hw) => {
    for (let y = yTop; y <= yBot; y++) {
      const w = (y - yTop + 1) / (yBot - yTop + 1) * hw;
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        const nx = (x - cx) / Math.max(0.6, w);
        if (Math.abs(nx) > 1.15) continue;
        p.shade(x, y, roof, 0.62 - nx * 0.32 + (y === yBot ? -0.25 : 0));
      }
    }
  };
  const win = (x, y) => p.set(x, y, locked ? hexRGB('#1e1e28') : GLOW);
  // nižšie bočné krídla s kužeľovými strechami
  for (const [x0, x1] of [[1, 4], [10, 13]]) { wall(x0, x1, 7, 13, 5); cone((x0 + x1) / 2, 3, 7, 2.6); win(Math.round((x0 + x1) / 2), 10); }
  // vysoká stredná veža so zlatým hrotom
  wall(5, 9, 4, 13, 7);
  cone(7, 0, 5, 2.6);
  if (!locked) {
    p.set(7, 0, GOLD);
    for (let x = 5; x <= 9; x++) p.set(x, 6, x % 2 ? GOLD : GOLD2);
    for (const x0 of [1, 10]) for (let x = x0; x <= x0 + 3; x++) p.set(x, 8, x % 2 ? GOLD : GOLD2);
  }
  win(7, 8);
  // brána
  for (let y = 11; y <= 13; y++) for (let x = 6; x <= 8; x++) {
    if (y === 11 && (x === 6 || x === 8)) continue;
    p.set(x, y, locked ? hexRGB('#14100c') : (x === 6 || x === 8 ? WOOD[1] : WOOD[3]));
  }
  return p.finish();
}
