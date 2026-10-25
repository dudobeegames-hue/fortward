'use strict';
// Fortward – mapa sveta a mapy území v štýle námorníckej (papierovej) mapy:
// pergamen s prehybmi a škvrnami (opálené okraje voliteľne), more so šrafami a vlnovkami pobrežia, pobrežie perom,
// provincie ako akvarel s pásom pri hranici, kreslené značky (hory, pahorky, lesy…), kurzové čiary a lode perom.
// build(spec) vyrobí tvar súše a provincie (raz), paint(geom, opts) ich vyfarbí podľa toho, kto provinciu drží.
const PAPER = (() => {
  const R = a => a.map(hexRGB);
  const PR = {
    paper:  R(['#4a3420', '#664a2c', '#84653c', '#a2804e', '#bc9a62', '#d0b276', '#dfc68c', '#ead6a2', '#f3e4b8']),
    sea:    R(['#463a28', '#5e4e36', '#7a6646', '#947e58', '#aa946a', '#bea87c', '#ccb88c', '#d8c69c', '#e2d2aa']),
    seaT:   R(['#2e3e3a', '#3e5450', '#526c66', '#68847a', '#7e988c', '#94aa9c', '#a8baa8', '#bac8b2', '#cad4bc']),
    human:  R(['#3a4a66', '#506484', '#6880a2', '#829abc', '#9cb2d0', '#b4c6de', '#c8d6e8', '#d8e2ee', '#e4eaf0']),
    orc:    R(['#5e3618', '#7e4a22', '#9c622e', '#b87a3c', '#cc9250', '#daa868', '#e6be86', '#eecea2', '#f4dcb8']),
    nordic: R(['#2e4a48', '#3e605c', '#527872', '#689088', '#80a89e', '#9abcb2', '#b2cec4', '#c8dcd2', '#dae8e0']),
    polar:  R(['#4a5a6a', '#627488', '#7c90a4', '#98acbe', '#b4c6d4', '#cad8e2', '#dce6ee', '#e8f0f4', '#f2f6f8']),
    elf:    R(['#2e4a22', '#3e6030', '#527a3e', '#6a9450', '#84ac64', '#9ec07c', '#b4d096', '#c8deae', '#dae8c4']),
    desert: R(['#6a4a1e', '#86602a', '#a27a38', '#bc944a', '#d0aa60', '#dcbe7a', '#e6ce96', '#eedcb0', '#f4e6c6']),
    undead: R(['#3a3446', '#4e465c', '#645a72', '#7c7088', '#94889e', '#aca0b4', '#c0b6c6', '#d0c8d4', '#ded8e0']),
    swarm:  R(['#5a1a1a', '#7a2622', '#9a362c', '#b44c3a', '#c8664e', '#d68268', '#e2a088', '#eabca8', '#f0d2c4']),
  };
  const INK = hexRGB('#2a1c10'), INK2 = hexRGB('#5a4028'), INKR = hexRGB('#8a2614'), INKR2 = hexRGB('#b44a2a'), SNOWP = hexRGB('#fbf4dc');
  const OLIVE = hexRGB('#5c6438'), JUNG = hexRGB('#3c5a2a'), PINE = hexRGB('#3e5446'), SAND = hexRGB('#c8a464');
  // perom kreslené značky: K tuš, k šrafa, L svetlá strana, S sneh, g koruna stromu (farba podľa krajiny)
  const G = {
    mount:  ['.....K.....', '....KLK....', '...KLLkK...', '..KLLLkkK..', '.KLLLLkkkK.', 'KLLLLLkkkkK'],
    mountS: ['.....K.....', '....KSK....', '...KSSkK...', '..KLSLkkK..', '.KLLLLkkkK.', 'KLLLLLkkkkK'],
    hill:   ['..KKK..', '.KLLkK.', 'KLLLkkK'],
    tree:   ['.K.', 'KgK', 'KgK', '.K.'],
    pine:   ['..K..', '.KgK.', '.KgK.', 'KgggK', '..K..'],
    jtree:  ['.KK.', 'KggK', 'KggK', '.KK.'],
    palm:   ['K.K.K', '.KKK.', '..K..', '..K..'],
    dune:   ['...KKK...', '.KKLLkKK.', 'K.......K'],
    berg:   ['...K...', '..KSK..', '.KSSkK.', 'KSSSkkK'],
    dead:   ['K.K', '.K.', '.K.'],
    spire:  ['..K..', '.KLK.', '.KLK.', 'KLLkK'],
    castle: ['K.K.K', 'KKKKK', 'KLLkK', 'KLKkK', 'KKKKK'],
  };
  const ROSE = ['.........K.........', '........KnK........', '........KnK........', '.......KNnnK.......', '......oKNnnKo......', '.....o.KNnnK.o.....', '....o.KNNnnnK.o....', '...KKKKNNnnnKKKK...', '.KKLLLLLNnnLLLLLKK.', 'KDDDDDDDDWDDDDDDDDK', '.KKDDDDDLDDDDDDDKK.', '...KKKKLLDDDKKKK...', '....o.KLLDDDK.o....', '.....o.KLDDK.o.....', '......oKLDDKo......', '.......KLDDK.......', '........KDK........', '........KDK........', '.........K.........'];
  const NGL = ['K..K', 'KK.K', 'K.KK', 'K..K'];
  // veterná ružica podľa predlohy: 8 hrotov (svetové strany dlhé, medzistrany kratšie), každý hrot svetlá a tienená polovica
  // z bronzu, krúžok cez hroty, tuš na obryse a písmená N E S W (svetlé s tušovým lemom)
  const BRZ = R(['#4a3016', '#6e4a22', '#946630', '#b88444', '#d4a45e', '#e8c482', '#f6e0aa']);
  const LET = { N: ['K..K', 'KK.K', 'K.KK', 'K..K', 'K..K'], E: ['KKK', 'K..', 'KK.', 'K..', 'KKK'], S: ['.KK', 'K..', '.K.', '..K', 'KK.'], W: ['K...K', 'K...K', 'K.K.K', 'KK.KK', 'K...K'] };
  function compass(put, get, cx, cy, R0) {
    const r = Math.ceil(R0) + 1, n = 2 * r + 1, M = new Int8Array(n * n).fill(-1); // -1 nič, inak tón bronzu
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push({ a: i * Math.PI / 4 - Math.PI / 2, len: i % 2 ? R0 * 0.8 : R0, w: i % 2 ? R0 * 0.16 : R0 * 0.21, card: !(i % 2) });
    const rr = R0 * 0.46;
    const point = P => { const dx = Math.cos(P.a), dy = Math.sin(P.a);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const al = x * dx + y * dy, sd = -x * dy + y * dx; // pozdĺž hrotu a do boku
        if (al < -0.5 || al > P.len || Math.abs(sd) > P.w * (1 - Math.max(0, al) / P.len) + 0.3) continue;
        // jedna polovica hrota na svetle, druhá v tieni (dookola rovnako ako na predlohe); k špičke o tón tmavšie
        M[(y + r) * n + x + r] = sd < 0 ? (P.card ? 6 : 5) : (P.card ? 2 : 1);
      } };
    pts.filter(P => !P.card).forEach(point);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (Math.abs(d - rr) < 0.55) M[(y + r) * n + x + r] = M[(y + r) * n + x + r] < 0 ? 3 : 0; } // krúžok (na hrotoch tmavá ryha)
    pts.filter(P => P.card).forEach(point);
    M[r * n + r] = 6;
    const at = (x, y) => x < -r || y < -r || x > r || y > r ? -1 : M[(y + r) * n + x + r];
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) { // obrys tušou
      const v = at(x, y);
      if (v >= 0) put(cx + x, cy + y, BRZ[v]);
      else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(x + a, y + b) >= 0)) put(cx + x, cy + y, INK);
    }
    const letter = (gl, x0, y0) => { // svetlé písmeno s tenkým tušovým lemom
      const w = gl[0].length, h = gl.length, on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && gl[y][x] === 'K';
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!on(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => on(x + a, y + b))) put(x0 + x, y0 + y, INK);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) put(x0 + x, y0 + y, SNOWP);
    };
    const g = R0 + 3;
    letter(LET.N, cx - 1, cy - g - 5); letter(LET.S, cx - 1, cy + g + 1); letter(LET.E, cx + g + 1, cy - 2); letter(LET.W, cx - g - 5, cy - 2);
  }

  const SHIP = ['.....K.....', '.....KK....', '....KLK....', '...KLLK.K..', '..KLLLK.KK.', '.KLLLLK.KLK', '.KKKKKKKKKK', 'KKLLLLLLLKK', '.KKKKKKKKK.'];
  const DIG = { 0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'],
    5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'] };
  const rampAt = (ramp, v) => { const f = v * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(f)), t = f - i; return [0, 1, 2].map(c => ramp[i][c] + (ramp[i + 1][c] - ramp[i][c]) * t); };
  // jas pergamenu (rovnaký vzorec ako v hre): škvrny, prehyby, opálené okraje a vinetácia
  function paperV(x, y, W, H, noEdge) {
    let v = 0.7 + (fbm(x * 0.03, y * 0.03, 101) - 0.5) * 0.22 + (fbm(x * 0.15, y * 0.15, 103) - 0.5) * 0.08 + (hash2(x, y, 105) - 0.5) * 0.05;
    const stain = fbm(x * 0.018, y * 0.022, 107);
    if (stain > 0.64) v -= (stain - 0.64) * 0.9;
    if (Math.abs(stain - 0.64) < 0.006) v -= 0.1;
    const fx = W >> 1, fy1 = Math.round(H / 3), fy2 = Math.round(H * 2 / 3);
    if (x === fx || y === fy1 || y === fy2) v -= 0.07; else if (x === fx + 1 || y === fy1 + 1 || y === fy2 + 1) v += 0.05;
    if (noEdge) return v; // okraje dokreslí hra na okrajoch obrazovky (mapa sa posúva)
    const e = Math.min(x, y, W - 1 - x, H - 1 - y) + (fbm(x * 0.08, y * 0.08, 109) - 0.5) * 12;
    if (e < 22) v -= Math.pow((22 - e) / 22, 2.2) * 0.75;
    const vx = (x - W / 2) / (W / 2), vy = (y - H / 2) / (H / 2);
    return v - Math.pow(Math.min(1, vx * vx * 0.7 + vy * vy * 0.9), 2) * 0.16;
  }
  const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const inShape = (s, x, y) => s.poly ? inPoly(s.poly, x, y) : s.circles.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r);
  const shapeBox = s => { const pts = s.poly || s.circles.flatMap(([cx, cy, r]) => [[cx - r, cy - r], [cx + r, cy + r]]); return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) }; };
  // prevod obrysu z náčrtu do mapy: x' = ox + x·sx, y' = oy + y·sy
  const fit = (poly, ox, oy, sx, sy) => poly.map(([x, y]) => [ox + x * sx, oy + y * sy]);
  const fitC = (cs, ox, oy, sx, sy) => cs.map(([x, y, r]) => [ox + x * sx, oy + y * sy, r * Math.sqrt(sx * sy)]);

  // spec: { W, H, seed, view, provSeed, order, lands: [{ shape, amp, freq, nseed, jitter, zones: [{ n | seeds, race, biome }], zoneAt(x, y, box) }] }
  function build(spec) {
    const { W, H } = spec, N = W * H, seed = spec.seed || 1;
    const land = new Int16Array(N).fill(-1), zone = new Int8Array(N), prov = new Int16Array(N).fill(-1);
    // 1) súš: obrys posunutý šumom (nerovné pobrežie)
    // pohľad: mapa územia je výrez mapy sveta (zväčšenie s, stred cx/cy v súradniciach sveta, otočenie rot) –
    // obrys, šum pobrežia aj jadrá provincií sa počítajú v súradniciach sveta, takže tvar je rovnaký ako na mape sveta
    const V = spec.view || { s: 1, rot: 0, cx: W / 2, cy: H / 2 }, cr = Math.cos(V.rot || 0), sr = Math.sin(V.rot || 0);
    const toW = (x, y) => { const u = (x - W / 2) / V.s, v = (y - H / 2) / V.s; return [V.cx + u * cr - v * sr, V.cy + u * sr + v * cr]; };
    const toM = (wx, wy) => { const du = wx - V.cx, dv = wy - V.cy; return [W / 2 + (du * cr + dv * sr) * V.s, H / 2 + (-du * sr + dv * cr) * V.s]; };
    const pseed = spec.provSeed || seed;
    spec.lands.forEach((L, li) => {
      const b = shapeBox(L.shape), a = L.amp || 4, f = L.freq || 0.06, ns = L.nseed != null ? L.nseed : seed + li * 13;
      let x0 = W, x1 = 0, y0 = H, y1 = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const [wx, wy] = toW(x, y);
        if (wx < b.x0 - 3 * a || wx > b.x1 + 3 * a || wy < b.y0 - 3 * a || wy > b.y1 + 3 * a) continue;
        // dve mierky šumu: veľké zálivy a polostrovy + drobné členenie pobrežia
        const dx = (fbm(wx * f, wy * f, ns) - 0.5) * 3.6 * a + (fbm(wx * f * 3.2, wy * f * 3.2, ns + 2) - 0.5) * 1.6 * a;
        const dy = (fbm(wx * f, wy * f, ns + 5) - 0.5) * 3.6 * a + (fbm(wx * f * 3.2, wy * f * 3.2, ns + 7) - 0.5) * 1.6 * a;
        if (!inShape(L.shape, wx + dx, wy + dy)) continue;
        const k = y * W + x; land[k] = li; zone[k] = L.zoneAt ? L.zoneAt(wx, wy, b) : 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      L.box = { x0, x1, y0, y1 };
    });
    // 2) provincie: rovnomerne rozložené jadrá (najvzdialenejší bod + vyhladenie), hranice so šumom ako v hre;
    // zadané jadrá (seeds, súradnice sveta) sa len prenesú – mapa územia má tak rovnaké provincie ako mapa sveta
    const provs = [];
    spec.lands.forEach((L, li) => L.zones.forEach((Z, zi) => {
      const px = [];
      for (let k = 0; k < N; k++) if (land[k] === li && zone[k] === zi) px.push(k);
      if (!px.length) return;
      const P = k => [k % W, (k / W) | 0];
      let S;
      if (Z.seeds) S = Z.seeds.map(([sx, sy]) => toM(sx, sy));
      else {
        const sub = px.filter((_, i) => i % 3 === 0);
        S = [P(sub.reduce((a, k) => (k > a ? k : a), sub[0]))]; // prvé jadro najnižšie
        const md = sub.map(k => { const [x, y] = P(k); return Math.hypot(x - S[0][0], y - S[0][1]); });
        while (S.length < Z.n) {
          let bi = 0; for (let i = 1; i < sub.length; i++) if (md[i] > md[bi]) bi = i;
          const s = P(sub[bi]); S.push(s);
          sub.forEach((k, i) => { const [x, y] = P(k); md[i] = Math.min(md[i], Math.hypot(x - s[0], y - s[1])); });
        }
        for (let it = 0; it < 4; it++) { // vyhladenie: jadro do ťažiska svojej oblasti (na najbližší bod oblasti)
          const acc = S.map(() => [0, 0, 0]);
          for (const k of px) { const [x, y] = P(k); let bi = 0, bd = 1e9; S.forEach((s, i) => { const d = (x - s[0]) ** 2 + (y - s[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); acc[bi][0] += x; acc[bi][1] += y; acc[bi][2]++; }
          S.forEach((s, i) => { if (!acc[i][2]) return; const cx = acc[i][0] / acc[i][2], cy = acc[i][1] / acc[i][2]; let bk = px[0], bd = 1e9; for (const k of px) { const [x, y] = P(k), d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; bk = k; } } S[i] = P(bk); });
        }
      }
      const base = provs.length, jit = (L.jitter == null ? 7 : L.jitter) * V.s;
      S.forEach(s => { const [wx, wy] = toW(s[0], s[1]); provs.push({ land: li, zone: zi, race: Z.race, biome: Z.biome, x: Math.round(s[0]), y: Math.round(s[1]), wx, wy }); });
      for (const k of px) {
        const [x, y] = P(k), [wx, wy] = toW(x, y), jx = (fbm(wx * 0.05, wy * 0.05, pseed + 31) - 0.5) * 2 * jit, jy = (fbm(wx * 0.05, wy * 0.05, pseed + 37) - 0.5) * 2 * jit;
        let bi = 0, bd = 1e9; S.forEach((s, i) => { const d = Math.hypot(x + jx - s[0], (y + jy - s[1]) * 1.1); if (d < bd) { bd = d; bi = i; } });
        prov[k] = base + bi;
      }
    }));
    if (spec.order) spec.order(provs); // poradie misií (čísla na hradoch)
    // 3) vzdialenostné polia
    const sea = k => land[k] < 0;
    const bfs = (seedF, ok, max) => {
      const d = new Uint8Array(N).fill(255), q = [];
      for (let k = 0; k < N; k++) if (seedF(k)) { d[k] = 0; q.push(k); }
      for (let h = 0; h < q.length; h++) {
        const k = q[h], x = k % W, y = (k / W) | 0, v = d[k] + 1; if (v > max) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nk = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || d[nk] <= v || !ok(nk)) continue; d[nk] = v; q.push(nk); }
      }
      return d;
    };
    const nb = (k, f) => { const x = k % W, y = (k / W) | 0; return (x > 0 && f(k - 1)) || (x < W - 1 && f(k + 1)) || (y > 0 && f(k - W)) || (y < H - 1 && f(k + W)); };
    const sd = bfs(k => !sea(k), sea, 24), ld = bfs(sea, k => !sea(k), 8);
    const bd = bfs(k => !sea(k) && nb(k, j => prov[j] !== prov[k]), k => !sea(k), 14);
    const pd = bfs(k => !sea(k) && nb(k, j => !sea(j) && prov[j] !== prov[k]), k => !sea(k), 4);
    // 4) terén: 1 pláž, 2 tráva, 3 les, 4 hory, 5 sneh, 6 púšť, 7 prales, 8 ľad, 9 ihličnatý les, 10 úľ, 11 mŕtvy les
    const terr = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (sea(k)) continue;
      const x = k % W, y = (k / W) | 0, bio = provs[prov[k]].biome, e = fbm(x * 0.045, y * 0.045, seed + 3), fo = fbm(x * 0.07, y * 0.07, seed + 9);
      const beach = ld[k] <= 2;
      let t = 2;
      if (bio === 'ice') t = e > 0.66 ? (e > 0.76 ? 5 : 4) : 8;
      else if (beach && bio !== 'hive') t = 1;
      else if (bio === 'grass') t = e > 0.74 ? (e > 0.86 ? 5 : 4) : fo > 0.6 ? 3 : 2;
      else if (bio === 'tundra') t = e > 0.7 ? (e > 0.8 ? 5 : 4) : fo > 0.52 ? 9 : 2;
      else if (bio === 'jungle') t = e > 0.78 ? 4 : fo < 0.3 ? 2 : 7;
      else if (bio === 'forest') t = e > 0.76 ? 4 : fo < 0.32 ? 2 : 3;
      else if (bio === 'desert') t = e > 0.8 ? 4 : 6;
      else if (bio === 'ash') t = e > 0.7 ? 4 : fo > 0.58 ? 11 : 2;
      else if (bio === 'hive') t = e > 0.75 ? 4 : 10;
      terr[k] = t;
    }
    return { W, H, N, seed, land, zone, prov, provs, sd, ld, bd, pd, terr, boxes: spec.lands.map(L => L.box), lands: spec.lands };
  }
  // opts: { raceOf(i) → rampa provincie, keep: [[x, y]] miesta hradov bez značiek, castles, numbers, routes: [[a, b, done]], rose, roseImg, ships, noEdge }
  function paint(G0, opts) {
    const { W, H, N, seed, land, prov, provs, sd, ld, bd, pd, terr } = G0, sea = k => land[k] < 0;
    const nb = (k, f) => { const x = k % W, y = (k / W) | 0; return (x > 0 && f(k - 1)) || (x < W - 1 && f(k + 1)) || (y > 0 && f(k - W)) || (y < H - 1 && f(k + W)); };
    const raceOf = opts.raceOf || (i => provs[i].race), spec = opts;
    // 5) hrady (kotvy provincií) – okolo nich a pod číslom sa značky nekreslia
    const keep = new Uint8Array(N);
    const keepAt = (px, py) => { for (let y = py - 12; y <= py + 10; y++) for (let x = px - 8; x <= px + 8; x++) if (x >= 0 && y >= 0 && x < W && y < H) keep[y * W + x] = 1; };
    if (spec.castles) for (const p of provs) keepAt(p.x, p.y);
    for (const [px, py] of spec.keep || []) keepAt(px, py);
    // 6) farby
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d'), id = cx.createImageData(W, H), d = id.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, q = k * 4;
      let v = paperV(x, y, W, H, spec.noEdge), ramp = PR.paper, col = null;
      if (sea(k)) {
        ramp = PR.sea;
        const s = sd[k];
        if (s <= 9 && BAYER4[(y & 3) * 4 + (x & 3)] < 1 - s / 10 + (fbm(x * 0.06, y * 0.06, 129) - 0.5) * 0.3) ramp = PR.seaT;
        v += 0.04 + Math.min(1, s / 24) * 0.06;
        if (s === 1) v -= 0.22; else if (s === 2) v -= 0.12;
        if (s === 4 || (s === 7 && (x + y) % 2 === 0) || (s === 11 && (x + y) % 3 === 0) || (s === 16 && (x + 2 * y) % 5 === 0)) col = INK2;
        else if (s > 18 && y % 9 === 0 && (x + ((y / 9) | 0) * 11) % 17 < 4) col = INK2;
      } else {
        const p = provs[prov[k]], t = terr[k];
        if (t === 1) v -= 0.08; else if (t === 4) v -= 0.04; else if (t === 5) v += 0.06; else if (t === 6) v += 0.03; else if (t === 8) v += 0.1; else if (t === 7) v -= 0.04;
        if (nb(k, sea)) col = INK; // pobrežie perom
        else if (t === 8 && Math.abs(fbm(x * 0.09, y * 0.12, seed + 77) - 0.5) < 0.008 && hash2(x, y, 79) > 0.3) col = INK2; // trhliny v ľade
        else if (t === 6 && Math.sin(x * 0.5 + y * 0.9 + fbm(x * 0.05, y * 0.05, seed + 81) * 8) > 0.93 && (x & 1)) col = INK2; // jemné ryhy dún
        if (!col) {
          const vv = Math.max(0, Math.min(1, v + 0.05)), race = PR[raceOf(prov[k])] || PR.human;
          let wash = Math.max(0, Math.min(1, 0.95 - Math.min(bd[k], 16) / 16 * 0.55 + (fbm(x * 0.07, y * 0.07, 131) - 0.5) * 0.45));
          wash = Math.min(1, wash * 1.1 + 0.3);
          const a = rampAt(PR.paper, vv), r = rampAt(race, vv);
          col = [0, 1, 2].map(ch => a[ch] + (r[ch] - a[ch]) * wash);
          const gy = (col[0] + col[1] + col[2]) / 3; col = col.map(cc => Math.max(0, Math.min(255, gy + (cc - gy) * 1.4)));
          const pb = pd[k], BAND = [0.9, 0.5, 0.2];
          if (pb < 3) { const bc = race[2], al = BAND[pb] * 0.8; col = [0, 1, 2].map(ch => col[ch] + (bc[ch] - col[ch]) * al); }
          const x1 = x < W - 1 ? prov[k + 1] : -1, y1 = y < H - 1 ? prov[k + W] : -1;
          if ((x1 >= 0 && x1 !== prov[k]) || (y1 >= 0 && y1 !== prov[k])) col = col.map((cc, ch) => cc + ([24, 18, 12][ch] - cc) * 0.59);
        }
      }
      if (!col) col = pickRamp(ramp, Math.max(0, Math.min(1, v)), x, y);
      d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2]; d[q + 3] = 255;
    }
    // 7) kreslené značky
    const put = (x, y, col) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const q = (y * W + x) * 4; d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2]; };
    const lit = (x, y, f) => { const q = (y * W + x) * 4; return [Math.min(255, d[q] * f), Math.min(255, d[q + 1] * f), Math.min(255, d[q + 2] * f)]; };
    const stamp = (gl, gx, gy, gcol) => gl.forEach((row, j) => { for (let i = 0; i < row.length; i++) {
      const ch = row[i], x = gx + i, y = gy + j;
      if (ch === '.' || x < 0 || y < 0 || x >= W || y >= H) continue;
      put(x, y, ch === 'K' ? INK : ch === 'k' ? ((x & 1) ? INK2 : lit(x, y, 0.82)) : ch === 'L' ? lit(x, y, 1.12) : ch === 'S' ? SNOWP : gcol || OLIVE);
    } });
    const fits = (gl, gx, gy, okT) => {
      for (let j = 0; j < gl.length; j++) for (let i = 0; i < gl[0].length; i++) {
        const x = gx + i, y = gy + j; if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false;
        const k = y * W + x; if (sea(k) || keep[k] || bd[k] <= 1 || !okT(terr[k])) return false;
      }
      return true;
    };
    const used = new Uint8Array(N), free = (gx, gy, w, h) => { for (let y = gy - 1; y <= gy + h; y++) for (let x = gx - 1; x <= gx + w; x++) if (x >= 0 && y >= 0 && x < W && y < H && used[y * W + x]) return false; return true; };
    const mark = (gx, gy, w, h) => { for (let y = gy; y < gy + h; y++) for (let x = gx; x < gx + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) used[y * W + x] = 1; };
    const T = (x, y) => terr[Math.min(H - 1, y) * W + Math.min(W - 1, x)];
    for (let y = 2; y < H - 8; y += 3) for (let x = 1 + ((y / 3 | 0) % 3) * 3; x < W - 12; x += 6) { // pohoria
      const jx = x + Math.floor(hash2(x, y, 111) * 3) - 1, jy = y + Math.floor(hash2(y, x, 113) * 2);
      const snow = T(jx + 5, jy + 1) === 5, g0 = snow ? G.mountS : G.mount;
      const base = [1, 5, 9].filter(q => { const t = T(jx + q, jy + 5); return t === 4 || t === 5; }).length;
      if (base >= 2 && fits(g0, jx, jy, t => t !== 1) && free(jx, jy, 11, 6)) { stamp(g0, jx, jy); mark(jx, jy, 11, 5); }
    }
    for (let y = 2; y < H - 4; y += 5) for (let x = 2 + ((y / 5 | 0) & 1) * 4; x < W - 8; x += 9) { // pahorky
      const jx = x + Math.floor(hash2(x, y, 115) * 4), jy = y + Math.floor(hash2(y, x, 117) * 3);
      if (hash2(jx, jy, 119) < 0.75 && fits(G.hill, jx, jy, t => t === 2 || t === 4) && free(jx, jy, 7, 3) && (T(jx + 3, jy + 2) === 4 || hash2(jx, jy, 121) < 0.12)) { stamp(G.hill, jx, jy); mark(jx, jy, 7, 3); }
    }
    // drobné značky podľa krajiny: [terén, značka, farba koruny, krok x, krok y, hustota]
    const SM = [[3, G.tree, OLIVE, 4, 3, 0.8], [9, G.pine, PINE, 5, 4, 0.75], [7, G.jtree, JUNG, 4, 3, 0.85], [7, G.palm, JUNG, 7, 6, 0.25], [6, G.dune, SAND, 11, 6, 0.6], [8, G.berg, null, 13, 9, 0.35], [11, G.dead, null, 5, 4, 0.55], [10, G.spire, null, 7, 6, 0.5], [2, G.tree, OLIVE, 9, 7, 0.12]];
    for (const [tt, gl, gc, sx, sy, dens] of SM) {
      const gw = gl[0].length, gh = gl.length;
      for (let y = 1; y < H - gh; y += sy) for (let x = 1 + ((y / sy | 0) % 2) * (sx >> 1); x < W - gw; x += sx) {
        const jx = x + Math.floor(hash2(x, y, 123 + tt) * 2), jy = y + Math.floor(hash2(y, x, 125 + tt) * 2);
        if (hash2(jx, jy, 127 + tt) < dens && fits(gl, jx, jy, t => t === tt) && free(jx, jy, gw, gh)) { stamp(gl, jx, jy, gc); mark(jx, jy, gw, gh - 1); }
      }
    }
    // 8) plavebné trasy medzi územiami (červená prerušovaná čiara len po mori)
    for (const [a, b, done] of spec.routes || []) { // preplávané: hustá čiara, ďalšie len riedke bodky
      const A = G0.boxes[a], B = G0.boxes[b], P0 = { x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2 }, P2 = { x: (B.x0 + B.x1) / 2, y: (B.y0 + B.y1) / 2 };
      const dx = P2.x - P0.x, dy = P2.y - P0.y, L = Math.hypot(dx, dy), C = { x: (P0.x + P2.x) / 2 - dy / L * 12, y: (P0.y + P2.y) / 2 + dx / L * 12 };
      let m = 0, last = null;
      for (let t = 0; t <= 1; t += 0.5 / L) {
        const u = 1 - t, x = Math.round(u * u * P0.x + 2 * u * t * C.x + t * t * P2.x), y = Math.round(u * u * P0.y + 2 * u * t * C.y + t * t * P2.y);
        if (last && last[0] === x && last[1] === y) continue; last = [x, y];
        if (x < 0 || y < 0 || x >= W || y >= H || !sea(y * W + x) || sd[y * W + x] < 2) continue;
        if (done === false ? m++ % 4 === 0 : m++ % 5 < 3) put(x, y, done === false ? INK2 : INKR);
      }
    }
    // 9) hrady s číslom (návrh poradia misií)
    if (spec.castles) for (let i = 0; i < provs.length; i++) {
      const p = provs[i], fc = (PR[raceOf(i)] || PR.human)[1];
      stamp(G.castle, p.x - 2, p.y - 6);
      put(p.x, p.y - 7, INK); put(p.x, p.y - 8, INK); put(p.x + 1, p.y - 8, fc); put(p.x + 2, p.y - 8, fc); put(p.x + 1, p.y - 7, fc); // vlajka vo farbe ríše
      if (spec.numbers === false) continue;
      const s = String(p.num || i + 1), w = s.length * 4 + 1, x0 = p.x - (w >> 1), y0 = p.y + 1;
      for (let y = y0 - 1; y <= y0 + 5; y++) for (let x = x0 - 1; x <= x0 + w; x++) put(x, y, (y === y0 - 1 || y === y0 + 5 || x === x0 - 1 || x === x0 + w) ? INK : SNOWP);
      [...s].forEach((ch, n) => DIG[ch].forEach((row, j) => { for (let q = 0; q < 3; q++) if (row[q] === '1') put(x0 + 1 + n * 4 + q, y0 + j, INK); }));
    }
    // 10) veterná ružica s kurzovými čiarami a lode perom na voľnom mori
    const seaBox = (cx0, cy0, r) => { for (let y = cy0 - r; y <= cy0 + r; y++) for (let x = cx0 - r; x <= cx0 + r; x++) { if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return false; const k = y * W + x; if (!sea(k) || sd[k] < 3) return false; } return true; };
    let rose = null;
    const rp = spec.rose || [W - 20, H - 40];
    for (let r = 0; r < 200 && !rose; r += 2) for (let a = 0; a < 16 && !rose; a++) { const x = Math.round(rp[0] + Math.cos(a / 16 * 6.283) * r), y = Math.round(rp[1] + Math.sin(a / 16 * 6.283) * r); if (seaBox(x, y, 21)) rose = [x, y]; }
    if (rose) {
      const [rx, ry] = rose;
      for (let a = 0; a < 16; a++) { const an = a * Math.PI / 8, dx = Math.cos(an), dy = Math.sin(an); for (let r = 23; r < 600; r += 2) { const x = Math.round(rx + dx * r), y = Math.round(ry + dy * r); if (x < 0 || y < 0 || x >= W || y >= H) break; const k = y * W + x; if (sea(k) && sd[k] > 3 && r % 6 !== 0) put(x, y, lit(x, y, a % 2 ? 0.9 : 0.84)); } }
      if (!spec.roseImg) compass(put, null, rx, ry, 14); // s obrázkom kompasu ho dokreslí stránka v plnom rozlíšení
    }
    let ships = 0;
    for (let y = 30; y < H - 20 && ships < (spec.ships || 2); y += 37) for (let x = 6; x < W - 16 && ships < (spec.ships || 2); x += 23) {
      let ok = hash2(x, y, 127 + seed) < 0.5 && (!rose || Math.hypot(x + 5 - rose[0], y + 4 - rose[1]) > 30);
      for (let j = -2; j < 11 && ok; j++) for (let q = -2; q < 13 && ok; q++) { const xx = x + q, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) ok = false; else { const k = yy * W + xx; if (!sea(k) || sd[k] < 4) ok = false; } }
      if (ok) { stamp(SHIP, x, y); for (let q = -1; q < 12; q += 2) put(x + q, y + 10, INK2); ships++; y += 60; }
    }
    cx.putImageData(id, 0, 0);
    return { canvas: c, rose };
  }
  // tvar aj farby naraz (návrhy na vývojárskej stránke)
  function render(spec) { const G0 = build(spec), p = paint(G0, spec); return { canvas: p.canvas, provs: G0.provs, boxes: G0.boxes, rose: p.rose, geom: G0 }; }
  return { build, paint, render, fit, fitC, PR };
})();
