'use strict';
// Fortward – úvodná obrazovka počas načítania: západ slnka nad údolím, hrad ľudí proti pevnosti hordy,
// armády v údolí a v popredí rytier proti orkskému náčelníkovi a kostlivcovi. Kreslí sa v plnom rozlíšení.
const SPLASH = (() => {
  const cv = document.getElementById('splashCanvas'), ctx = cv.getContext('2d');
  let W = 0, H = 0, U = 1, still = null, raf = 0, t0 = performance.now(), embers = [];

  // ---- pomocné funkcie ----
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function noise(x, seed) { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; }
  const ridge = (x, seed, oct) => { let v = 0, a = 1, fq = 1, n = 0; for (let k = 0; k < (oct || 4); k++) { v += noise(x * fq, seed + k * 7) * a; n += a; a *= 0.5; fq *= 2.1; } return v / n; };
  function poly(c, pts, fill) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fillStyle = fill; c.fill(); }
  function ell(c, x, y, rx, ry, fill, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
  function rect(c, x, y, w, h, fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
  // silueta s odleskom: najprv tvar vo farbe svetla posunutý k slnku, potom tmavý tvar
  function lit(c, draw, dark, rim, dx, dy) { c.save(); c.translate(dx, dy); draw(rim); c.restore(); draw(dark); }

  // ---- kompozícia (všetko v jednotkách U = 1 % šírky) ----
  const SUN = () => ({ x: W * 0.52, y: H * 0.555 });

  function sky(c) {
    const g = c.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, '#07061a'); g.addColorStop(0.22, '#191338'); g.addColorStop(0.42, '#3f1d4c');
    g.addColorStop(0.62, '#8e2f45'); g.addColorStop(0.8, '#e0703a'); g.addColorStop(0.93, '#ffbe62'); g.addColorStop(1, '#ffe2a0');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const r = rng(7);
    for (let i = 0; i < 160; i++) { const y = Math.pow(r(), 1.8) * H * 0.38, a = (1 - y / (H * 0.38)) * (0.4 + r() * 0.6); c.globalAlpha = a; rect(c, r() * W, y, r() < 0.1 ? U * 0.45 : U * 0.25, r() < 0.1 ? U * 0.45 : U * 0.25, '#ffffff'); }
    c.globalAlpha = 1;
    const s = SUN();
    let g2 = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, W * 0.9);                       // veľká žiara
    g2.addColorStop(0, 'rgba(255,214,140,0.55)'); g2.addColorStop(0.25, 'rgba(255,150,80,0.25)'); g2.addColorStop(1, 'rgba(255,120,60,0)');
    c.fillStyle = g2; c.fillRect(0, 0, W, H);
    g2 = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, U * 13);                             // slnko
    g2.addColorStop(0, '#fffbe8'); g2.addColorStop(0.55, '#ffe9a8'); g2.addColorStop(0.75, 'rgba(255,200,110,0.9)'); g2.addColorStop(1, 'rgba(255,170,90,0)');
    c.fillStyle = g2; c.beginPath(); c.arc(s.x, s.y, U * 13, 0, Math.PI * 2); c.fill();
  }
  function clouds(c) {
    const r = rng(21), s = SUN();
    for (let k = 0; k < 9; k++) {
      const cy = H * (0.3 + r() * 0.26), cx = r() * W * 1.2 - W * 0.1, len = U * (26 + r() * 40), th = U * (1.6 + r() * 2.6);
      const near = 1 - Math.min(1, Math.abs(cy - s.y) / (H * 0.35));
      const g = c.createLinearGradient(0, cy - th, 0, cy + th);
      g.addColorStop(0, `rgba(${70 + near * 40},${30 + near * 20},${80},0.9)`); g.addColorStop(0.65, `rgba(${150 + near * 80},${60 + near * 60},${70},0.9)`); g.addColorStop(1, `rgba(255,${150 + near * 60},${90 + near * 40},0.95)`);
      for (let i = 0; i < 7; i++) ell(c, cx + (i / 6 - 0.5) * len, cy + Math.sin(i * 1.7 + k) * th * 0.3, len * (0.16 + r() * 0.12), th * (0.6 + r() * 0.5), g);
    }
  }
  function mountains(c) {
    const layers = [[0.58, 0.1, '#7a3e5c', 11], [0.62, 0.07, '#55294c', 23], [0.655, 0.05, '#341a3a', 37]];
    for (const [base, amp, col, seed] of layers) {
      c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += U * 0.6) { const n = ridge(x / (U * 18), seed, 5), side = 0.35 + 0.65 * Math.min(1, Math.abs(x / W - 0.52) * 2.6); c.lineTo(x, H * base - Math.pow(n, 1.6) * H * amp * 1.6 * side); }
      c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill();
    }
    const g = c.createLinearGradient(0, H * 0.56, 0, H * 0.72);                               // opar nad údolím
    g.addColorStop(0, 'rgba(255,170,110,0)'); g.addColorStop(0.6, 'rgba(255,150,100,0.3)'); g.addColorStop(1, 'rgba(120,60,90,0)');
    c.fillStyle = g; c.fillRect(0, H * 0.56, W, H * 0.16);
  }
  // hrad ľudí na útese vľavo
  function humanCastle(c) {
    const top = H * 0.53, edge = W * 0.3;
    const cliff = col => poly(c, [[0, H], [0, top - U * 2], [W * 0.1, top - U * 3], [W * 0.24, top - U * 2], [edge - U * 3, top + U * 1], [edge, top + U * 5], [edge + U * 2, top + U * 12], [edge - U, H * 0.7], [edge + U * 4, H]], col);
    lit(c, cliff, '#1b1530', '#c26a4a', U * 0.6, 0);
    strata(c, 0, edge, top + U * 3, H * 0.7, 3);
    const k = '#15102a', rim = '#d98256';
    const tower = (x, w, h, roof) => {
      lit(c, col => { rect(c, x, top - h, w, h + U * 2, col); }, k, rim, U * 0.5, 0);
      lit(c, col => poly(c, [[x - U * 0.8, top - h], [x + w / 2, top - h - roof], [x + w + U * 0.8, top - h]], col), '#26346e', '#e07a52', U * 0.5, 0);
      for (let y = top - h + U * 3; y < top - U * 2; y += U * 4.5) rect(c, x + w / 2 - U * 0.5, y, U, U * 1.6, '#ffcf6a');
    };
    lit(c, col => rect(c, W * 0.05, top - U * 9, W * 0.25, U * 10, col), k, rim, U * 0.5, 0);           // hradby
    for (let x = W * 0.05; x < W * 0.3; x += U * 2.4) rect(c, x, top - U * 10.2, U * 1.3, U * 1.4, k);   // cimburie
    tower(W * 0.03, U * 5, U * 16, U * 8); tower(W * 0.14, U * 7, U * 24, U * 11); tower(W * 0.27, U * 5, U * 15, U * 7);
    rect(c, W * 0.165, top - U * 4, U * 2.4, U * 4, '#ffb050');                                         // svetlo v bráne
  }
  // pevnosť hordy na skale vpravo
  function orcFortress(c) {
    const top = H * 0.51, x0 = W * 0.72;
    const crag = col => poly(c, [[x0 - U * 6, H * 0.66], [x0 - U * 2, top + U * 10], [x0 + U * 2, top + U * 4], [x0 + U * 8, top + U * 2], [W * 0.9, top], [W, top - U * 2], [W, H * 0.7]], col);
    lit(c, crag, '#120a12', '#b24a3a', -U * 0.7, 0);
    strata(c, x0, W, top + U * 6, H * 0.7, 9);
    const k = '#0e070c', rim = '#c4503a';
    const spiky = (x, w, h) => lit(c, col => { rect(c, x, top - h, w, h + U * 3, col); for (let i = 0; i <= 3; i++) poly(c, [[x + i * w / 3 - U * 0.8, top - h], [x + i * w / 3, top - h - U * 3.5], [x + i * w / 3 + U * 0.8, top - h]], col); }, k, rim, -U * 0.5, 0);
    spiky(W * 0.73, U * 6, U * 14); spiky(W * 0.82, U * 9, U * 22); spiky(W * 0.93, U * 6, U * 12);
    lit(c, col => rect(c, W * 0.73, top - U * 7, W * 0.25, U * 8, col), k, rim, -U * 0.5, 0);
    for (const [x, y] of [[0.755, 8], [0.85, 16], [0.86, 9], [0.95, 6], [0.8, 4]]) { rect(c, W * x, top - U * y, U * 1.2, U * 1.8, '#ff4a26'); }
  }
  // jemné skalné vrstvy na útesoch (svetlejšie šikmé pruhy)
  function strata(c, x0, x1, y0, y1, seed) {
    const r = rng(seed); c.strokeStyle = 'rgba(255,170,120,0.07)'; c.lineWidth = U * 0.35;
    for (let y = y0; y < y1; y += U * (1.6 + r() * 1.8)) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y + (r() - 0.5) * U * 4); c.stroke(); }
  }
  function valley(c) {
    const g = c.createLinearGradient(0, H * 0.66, 0, H * 0.86);
    g.addColorStop(0, '#5a2a3c'); g.addColorStop(1, '#1a0f1c');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, H * 0.7);
    for (let x = 0; x <= W; x += U) c.lineTo(x, H * 0.685 + Math.sin(x / (U * 9)) * U * 0.8);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
  }
  // armády v údolí: ľudia s kopijami a modrými zástavkami, horda s fakľami, kostlivci
  function armies(c) {
    const r = rng(99), yB = H * 0.735;
    const human = (x, y, s) => {
      rect(c, x - s * 0.5, y - s * 2.2, s, s * 2.2, '#140e22'); ell(c, x, y - s * 2.6, s * 0.5, s * 0.5, '#140e22');
      rect(c, x + s * 0.35, y - s * 2.3, s * 0.4, s * 2.3, 'rgba(240,140,90,0.55)');                     // odlesk slnka
      rect(c, x + s * 0.6, y - s * 5.2, s * 0.18, s * 4.6, '#140e22');                                   // kopija
      if (r() < 0.3) poly(c, [[x + s * 0.7, y - s * 5.1], [x + s * 2, y - s * 4.8], [x + s * 0.7, y - s * 4.4]], '#3c64c8');
    };
    const orc = (x, y, s) => {
      ell(c, x, y - s * 1.3, s * 0.9, s * 1.3, '#100810'); ell(c, x, y - s * 2.8, s * 0.6, s * 0.55, '#100810');
      poly(c, [[x - s * 0.6, y - s * 3], [x - s * 1.1, y - s * 3.8], [x - s * 0.3, y - s * 3.1]], '#100810'); poly(c, [[x + s * 0.6, y - s * 3], [x + s * 1.1, y - s * 3.8], [x + s * 0.3, y - s * 3.1]], '#100810');
      rect(c, x - s * 0.9, y - s * 2.4, s * 0.35, s * 2, 'rgba(230,100,70,0.5)');
      if (r() < 0.35) { rect(c, x - s * 1.4, y - s * 5, s * 0.2, s * 4.5, '#100810'); }
    };
    const skel = (x, y, s) => {
      rect(c, x - s * 0.35, y - s * 2.2, s * 0.7, s * 2.2, '#8f8670'); ell(c, x, y - s * 2.6, s * 0.48, s * 0.5, '#b8ae90');
      rect(c, x - s * 0.25, y - s * 2.7, s * 0.15, s * 0.15, '#4af0ff'); rect(c, x + s * 0.1, y - s * 2.7, s * 0.15, s * 0.15, '#4af0ff');
      rect(c, x + s * 0.5, y - s * 4.2, s * 0.15, s * 3.8, '#6a5c48');
    };
    for (let row = 0; row < 4; row++) {
      const y = yB + row * U * 2, s = U * (0.6 + row * 0.14);
      for (let x = W * 0.05 + row * U; x < W * 0.44 - row * U * 2; x += s * 2.1 + r() * U * 0.4) human(x, y, s);
      for (let x = W * 0.58 + row * U * 2; x < W * 0.98; x += s * 2.4 + r() * U * 0.6) (r() < 0.32 ? skel : orc)(x, y, s);
    }
  }
  // popredie: skalné výbežky, rytier so zástavou vľavo, orkský náčelník a kostlivec vpravo
  function foreground(c) {
    const rockL = col => poly(c, [[0, H], [0, H * 0.855], [W * 0.14, H * 0.84], [W * 0.32, H * 0.85], [W * 0.44, H * 0.875], [W * 0.52, H * 0.93], [W * 0.5, H]], col);
    const rockR = col => poly(c, [[W, H], [W, H * 0.86], [W * 0.86, H * 0.85], [W * 0.66, H * 0.865], [W * 0.55, H * 0.92], [W * 0.56, H]], col);
    lit(c, rockL, '#0c0712', '#c0603e', U * 0.7, -U * 0.25); lit(c, rockR, '#0b0610', '#c0603e', -U * 0.7, -U * 0.25);
    rect(c, 0, H * 0.95, W, H * 0.05, '#08050c');
    strata(c, 0, W * 0.45, H * 0.88, H, 31); strata(c, W * 0.58, W, H * 0.89, H, 33);
    // rytier (zozadu-zboku, pozerá do údolia), modrý plášť a chochol, meč, zástava
    const kx = W * 0.23, ky = H * 0.85, s = U * 1.45;
    lit(c, col => {
      rect(c, kx - s * 4.4, ky - s * 31, s * 0.7, s * 31, col);                                         // žrď zástavy
      rect(c, kx - s * 2.2, ky - s * 6.5, s * 1.9, s * 6.5, col); rect(c, kx + s * 0.5, ky - s * 6.5, s * 1.9, s * 6.5, col); // nohy
      poly(c, [[kx - s * 3.4, ky - s * 6], [kx - s * 2.6, ky - s * 15], [kx + s * 2.8, ky - s * 15], [kx + s * 3.4, ky - s * 6]], col); // trup
      ell(c, kx, ky - s * 17.4, s * 2.5, s * 2.8, col);                                                // prilba
      poly(c, [[kx + s * 2.6, ky - s * 13], [kx + s * 6.5, ky - s * 4], [kx + s * 7.6, ky - s * 4.5], [kx + s * 3.6, ky - s * 13.6]], col); // ruka s mečom
    }, '#0e0a1c', '#ffae6e', s * 0.45, -s * 0.15);
    poly(c, [[kx - s * 3.2, ky - s * 14.5], [kx - s * 5.6, ky - s * 3], [kx - s * 1.2, ky - s * 4.5], [kx + s * 1, ky - s * 14.5]], '#1c2e6e'); // modrý plášť
    poly(c, [[kx - s * 0.6, ky - s * 14.5], [kx - s * 1.6, ky - s * 4.8], [kx - s * 1.2, ky - s * 4.5], [kx + s * 1, ky - s * 14.5]], '#2c4ca0');
    // chochol: oblúk z temena prilby dozadu, svetlejší okraj od slnka
    c.beginPath(); c.moveTo(kx + s * 0.8, ky - s * 19.6);
    c.quadraticCurveTo(kx + s * 0.4, ky - s * 24.2, kx - s * 3.4, ky - s * 23.4);
    c.quadraticCurveTo(kx - s * 6.2, ky - s * 22.4, kx - s * 6.8, ky - s * 17.6);
    c.quadraticCurveTo(kx - s * 4.6, ky - s * 20.2, kx - s * 1.6, ky - s * 19);
    c.closePath(); c.fillStyle = '#3c64c8'; c.fill();
    c.beginPath(); c.moveTo(kx + s * 0.8, ky - s * 19.6);
    c.quadraticCurveTo(kx + s * 0.4, ky - s * 24.2, kx - s * 3.4, ky - s * 23.4);
    c.quadraticCurveTo(kx - s * 0.8, ky - s * 23, kx - s * 0.2, ky - s * 19.6);
    c.closePath(); c.fillStyle = '#7aa8ff'; c.fill();
    rect(c, kx + s * 0.4, ky - s * 17.8, s * 2.1, s * 0.5, '#ffb070');                                   // odlesk na priezore
    poly(c, [[kx + s * 6.6, ky - s * 4.4], [kx + s * 13.5, ky + s * 1.6], [kx + s * 13.2, ky + s * 2.2], [kx + s * 6.2, ky - s * 3.8]], '#e8e8f0'); // čepeľ meča
    poly(c, [[kx - s * 4, ky - s * 31], [kx - s * 13, ky - s * 29.6], [kx - s * 11.4, ky - s * 27], [kx - s * 13.2, ky - s * 24.4], [kx - s * 4, ky - s * 25]], '#2c4ca0'); // zástava (veje dozadu)
    poly(c, [[kx - s * 4, ky - s * 31], [kx - s * 13, ky - s * 29.6], [kx - s * 12.4, ky - s * 28.8], [kx - s * 4, ky - s * 29.8]], '#5a86e8');
    ell(c, kx - s * 8, ky - s * 27.8, s * 1, s * 1, '#f8d048');                                         // zlatý kruh na zástave
    // orkský náčelník s obojručnou sekerou a rohatou prilbou
    const ox = W * 0.74, oy = H * 0.865, o = U * 1.55;
    lit(c, col => {
      rect(c, ox - o * 3, oy - o * 7, o * 2.4, o * 7, col); rect(c, ox + o * 0.8, oy - o * 7, o * 2.4, o * 7, col);
      ell(c, ox, oy - o * 12, o * 5.2, o * 6, col);                                                   // mohutný trup
      ell(c, ox - o * 4.6, oy - o * 15.5, o * 2.6, o * 2, col); ell(c, ox + o * 4.6, oy - o * 15.5, o * 2.6, o * 2, col); // kožušinové plecia
      ell(c, ox, oy - o * 18.6, o * 2.6, o * 2.7, col);                                              // hlava
      poly(c, [[ox - o * 2, oy - o * 20], [ox - o * 5.5, oy - o * 24], [ox - o * 3.6, oy - o * 20.4]], col); poly(c, [[ox + o * 2, oy - o * 20], [ox + o * 5.5, oy - o * 24], [ox + o * 3.6, oy - o * 20.4]], col); // rohy
      poly(c, [[ox - o * 6, oy - o * 14], [ox - o * 9.6, oy - o * 27], [ox - o * 8.6, oy - o * 27.2], [ox - o * 5, oy - o * 14.4]], col); // porisko
      poly(c, [[ox - o * 9, oy - o * 25], [ox - o * 14, oy - o * 28.5], [ox - o * 13, oy - o * 22], [ox - o * 9.6, oy - o * 23]], col); // čepeľ sekery
      poly(c, [[ox - o * 9.4, oy - o * 26], [ox - o * 6.5, oy - o * 31], [ox - o * 5.6, oy - o * 25.5]], col);
    }, '#0b060a', '#ff9a5a', -o * 0.45, -o * 0.15);
    // kostlivec za náčelníkom
    const sx = W * 0.93, sy = H * 0.86, b = U * 1.4;
    lit(c, col => {
      rect(c, sx - b * 1.6, sy - b * 7, b * 0.9, b * 7, col); rect(c, sx + b * 0.7, sy - b * 7, b * 0.9, b * 7, col);
      poly(c, [[sx - b * 2.6, sy - b * 7], [sx - b * 2, sy - b * 15], [sx + b * 2, sy - b * 15], [sx + b * 2.6, sy - b * 7]], col);
      ell(c, sx, sy - b * 17.4, b * 2, b * 2.3, col);
      rect(c, sx - b * 4.2, sy - b * 22, b * 0.6, b * 12, col);                                          // zhrdzavený meč hore
    }, '#241e2a', '#f0e2b8', -b * 0.5, -b * 0.2);
    for (const ry of [10.6, 12, 13.4]) rect(c, sx - b * 1.6, sy - b * ry, b * 3.2, b * 0.5, '#8a806a');  // rebrá
    rect(c, sx - b * 0.25, sy - b * 15, b * 0.5, b * 7.6, '#8a806a');                                    // chrbtica
  }

  function build() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    sky(x); clouds(x); mountains(x); humanCastle(x); orcFortress(x); valley(x); armies(x); foreground(x);
    const v = x.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75); // vinetácia
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,2,10,0.65)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    const tg = x.createLinearGradient(0, 0, 0, H * 0.22);                                              // stmavenie pod názvom
    tg.addColorStop(0, 'rgba(4,3,14,0.6)'); tg.addColorStop(1, 'rgba(4,3,14,0)');
    x.fillStyle = tg; x.fillRect(0, 0, W, H * 0.22);
    return c;
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(cv.clientWidth * dpr)); H = Math.max(1, Math.round(cv.clientHeight * dpr));
    cv.width = W; cv.height = H; U = Math.min(W, H * 0.62) / 100;
    still = build();
    const r = rng(5); embers = Array.from({ length: 50 }, () => ({ x: r(), y: r(), sp: 0.3 + r() * 0.7, ph: r() * 6.28, sz: 0.25 + r() * 0.35 }));
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    if (!still) resize();
    ctx.drawImage(still, 0, 0);
    // živé svetlá: ohne pevnosti, fakle hordy, iskry, mihotanie okien
    ctx.globalCompositeOperation = 'lighter';
    const top = H * 0.51;
    for (const [x, y] of [[0.73, 14], [0.82, 22], [0.93, 12]]) {
      const fl = 0.75 + 0.25 * Math.sin(t * 9 + x * 40) * Math.sin(t * 5.3 + x * 13);
      const g = ctx.createRadialGradient(W * x + U * 3, top - U * (y + 3), 0, W * x + U * 3, top - U * (y + 3), U * 7 * fl);
      g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(0.35, 'rgba(255,120,40,0.5)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g; ctx.fillRect(W * x - U * 6, top - U * (y + 12), U * 18, U * 18);
    }
    for (const e of embers) {
      const life = (t * 0.06 * e.sp + e.y) % 1, x = (0.62 + e.x * 0.4) * W + Math.sin(t * 1.3 + e.ph) * U * 2 - life * U * 10, y = H * (0.68 - life * 0.55);
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9;
      ctx.fillStyle = life < 0.4 ? '#ffd27a' : '#ff7a3a';
      ctx.fillRect(x, y, U * e.sz, U * e.sz);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // oči náčelníka a kostlivca
    const ox = W * 0.74, oy = H * 0.865, o = U * 1.55, glow = 0.6 + 0.4 * Math.sin(t * 2.4);
    ctx.globalAlpha = glow;
    rect(ctx, ox - o * 1.1, oy - o * 19, o * 0.7, o * 0.45, '#ff3a1a'); rect(ctx, ox + o * 0.4, oy - o * 19, o * 0.7, o * 0.45, '#ff3a1a');
    const sx = W * 0.93, sy = H * 0.86, b = U * 1.4;
    rect(ctx, sx - b * 0.9, sy - b * 17.8, b * 0.6, b * 0.5, '#5af6ff'); rect(ctx, sx + b * 0.3, sy - b * 17.8, b * 0.6, b * 0.5, '#5af6ff');
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  addEventListener('resize', () => { still = null; });
  raf = requestAnimationFrame(frame);

  // skryje úvodnú obrazovku (plynulo), keď je hra načítaná a obrázok sa ukazoval aspoň chvíľu
  function done(minMs) {
    const el = document.getElementById('splash'), wait = Math.max(0, (minMs || 2600) - (performance.now() - t0));
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { cancelAnimationFrame(raf); el.remove(); }, 900); }, wait);
  }
  return { done };
})();
