'use strict';
// Fortward – malé pixelové ikonky pre menu (nastavenia, vlajky jazykov) ako SVG obrázky.
const UI_ICONS = (() => {
  // obrázok w×h bodov; fn(x, y) vráti farbu bodu alebo null (priehľadný)
  function pix(w, h, fn) {
    let r = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w;) {
        const c = fn(x, y);
        let n = 1;
        while (x + n < w && fn(x + n, y) === c) n++;  // susedné body rovnakej farby spojí do jedného obdĺžnika
        if (c) r += '<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + c + '"/>';
        x += n;
      }
    }
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w * 3 + '" height="' + h * 3 + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">' + r + '</svg>');
  }
  // obrázok z textovej mapy: každé písmeno je farba z palety, bodka je prázdna
  const fromMap = (rows, pal) => pix(rows[0].length, rows.length, (x, y) => pal[rows[y][x]] || null);
  const PAL = { K: '#1c140e', Y: '#f8d048', O: '#b88420', W: '#fff2d0' };

  const music = fromMap([
    '.....KK.....',
    '.....KYK....',
    '.....KYYK...',
    '.....KYKYK..',
    '.....KYK.YK.',
    '.....KYK..K.',
    '.....KYK....',
    '..KKKKYK....',
    '.KYYYYYK....',
    'KYYYYYOK....',
    'KYYYYOK.....',
    '.KKKKK......',
  ], PAL);
  const sound = fromMap([
    '.....K......',
    '....KK......',
    '...KYK...W..',
    'KKKYYK....W.',
    'KYYYYK..W.W.',
    'KYYYYK..W..W',
    'KYYYYK..W..W',
    'KOOOOK..W.W.',
    'KKKOOK....W.',
    '...KOK...W..',
    '....KK......',
    '.....K......',
  ], PAL);

  // zelené plus na prázdnej pozícii (nová hra)
  const plus = fromMap([
    '...KKKKK...',
    '...KLLGK...',
    '...KLGGK...',
    'KKKKLGGKKKK',
    'KLLLLGGGGGK',
    'KLGGGGGGGDK',
    'KGGGGGGGDDK',
    'KKKKGGDKKKK',
    '...KGDDK...',
    '...KDDDK...',
    '...KKKKK...',
  ], { K: '#1c140e', L: '#b8f890', G: '#5ccf3c', D: '#2c8a2c' });

  // ikonky mapy: domček (menu), pohár (trofeje), hviezda
  // domček a sieň: rovnaký kameň (L/S), tmavý obrys a zlaté svetlo ako pohár a kráľ
  const STONE = { K: '#1c140e', L: '#ece4d2', S: '#b8ae9a', D: '#3a2c22', Y: '#f8d048', O: '#b88420', R: '#b04a34', Q: '#7c2e20' };
  const home = fromMap([
    '......KK..KKK.',
    '.....KRRK.KSK.',
    '....KRRRQKKSK.',
    '...KRRRRRQKSK.',
    '..KRRRRRRRQKK.',
    '.KRRRRRRRRRQK.',
    'KKKKKKKKKKKKKK',
    '.KLLLLLLLLLLK.',
    '.KLKKKLLKKKLK.',
    '.KLKYKLLKDKLK.',
    '.KLKKKLLKDKLK.',
    '.KSSSSSSKDKSK.',
    '.KSSSSSSKDKSK.',
    'KKKKKKKKKKKKKK',
  ], STONE);
  const hall = fromMap([
    '......KK......',
    '.....KLLK.....',
    '....KLLLLK....',
    '...KLLYYLLK...',
    '..KLLYYYYLLK..',
    '.KLLLLYYLLLLK.',
    'KKKKKKKKKKKKKK',
    '.KLSKDLSKDLSK.',
    '.KLSKDLSKDLSK.',
    '.KLSKDLSKDLSK.',
    '.KLSKDLSKDLSK.',
    'KKKKKKKKKKKKKK',
    'KLLLLLLLLLLLLK',
    'KKKKKKKKKKKKKK',
  ], STONE);
  const trophy = fromMap([
    '..KKKKKKKKKK..',
    'KKKYYYYYYWYKKK',
    'KYKYYYYYYWYKYK',
    'KYKYYYYYYYYKYK',
    'KYKOYYYYYYOKYK',
    '.KKKOYYYYOKKK.',
    '....KOYYOK....',
    '.....KYYK.....',
    '.....KOOK.....',
    '.....KYYK.....',
    '....KYYYYK....',
    '...KYYYYYYK...',
    '...KOOOOOOK...',
    '...KKKKKKKK...',
  ], { K: '#1c140e', Y: '#f8d048', O: '#b88420', W: '#fff7c8' });
  const star = fromMap([
    '.....K.....',
    '....KYK....',
    '....KYK....',
    'KKKKYYYKKKK',
    'KYYYYYYYYYK',
    '.KYYYYYYYK.',
    '..KYYYYYK..',
    '..KYYKYYK..',
    '.KYYK.KYYK.',
    '.KYK...KYK.',
    '.KK.....KK.',
  ], PAL);

  // prekrížené meče (karta Boj): čepeľ 2 body široká, zlatá záštita, hnedá rukoväť, zlatá hlavica
  const swords = (() => {
    const N = 14, g = [...Array(N)].map(() => Array(N).fill(null));
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
    for (const dir of [1, -1]) {
      for (let t = 1; t <= 11; t++) {
        const x = dir === 1 ? t : N - 1 - t, y = t;
        if (t <= 7) { put(x, y, '#f0f4fc'); put(x + dir, y, '#9aa4b8'); }
        else if (t === 8) for (let k = -2; k <= 2; k++) put(x + k, y - k * dir, '#f8d048');
        else if (t <= 10) put(x, y, '#8a5a2a');
        else put(x, y, '#f8d048');
      }
    }
    const out = g.map(r => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx])) out[y][x] = '#1c140e';
    }
    return pix(N, N, (x, y) => out[y][x]);
  })();

  // truhlica s pokladom (karta Nákupy)
  const chest = fromMap([
    '..KKKKKKKKKK..',
    '.KBBBBKKBBBBK.',
    'KBBBBKYYKBBBBK',
    'KbbbbKYYKbbbbK',
    'KKKKKKKKKKKKKK',
    'KYYYYYYYYYYYYK',
    'KBBBBKYYKBBBBK',
    'KBBBKYWYYKBBBK',
    'KBBBKYKKYKBBBK',
    'KBBBBKYYKBBBBK',
    'KbbbbbKKbbbbbK',
    'KYYYYYYYYYYYYK',
    'KbbbbbbbbbbbbK',
    'KKKKKKKKKKKKKK',
  ], { K: '#1c140e', B: '#9a6430', b: '#6a4220', Y: '#f8d048', W: '#fff7c8' });

  // obrázok z bodov s automatickým tmavým obrysom okolo
  function outlined(N, M, paint) {
    const g = [...Array(M)].map(() => Array(N).fill(null));
    paint((x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < M) g[y][x] = c; });
    const out = g.map(r => r.slice());
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx])) out[y][x] = '#1c140e';
    }
    return pix(N, M, (x, y) => out[y][x]);
  }
  // kúzla: šípová salva (3 šípy vedľa seba), ohnivá guľa, mráz (vločka), blesk
  const spellVolley = outlined(19, 19, put => {
    for (const d of [-3, 0, 3]) { // tri rovnobežné šípy letiace na severovýchod
      const xs = 5 + d, ys = 12 + d, xe = 11 + d, ye = 6 + d;
      for (let t = 1; t <= 6; t++) put(xs + t, ys - t, '#c8a272');
      put(xs, ys, '#e84838');
      for (const [x, y] of [[xs - 1, ys], [xs, ys + 1], [xs + 1, ys]]) put(x, y, '#e84838'); // pierka
      for (const [x, y] of [[xe, ye - 1], [xe + 1, ye], [xe + 1, ye - 1], [xe + 1, ye - 2], [xe + 2, ye - 1]]) put(x, y, '#b8c0d0'); // hrot
      put(xe + 2, ye - 2, '#ffffff');
    }
  });
  const spellFire = outlined(14, 14, put => {
    for (let k = 0; k < 6; k++) { put(9 + k * 0.7 | 0, 5 - k * 0.8 | 0, k < 3 ? '#f89838' : '#d83818'); put(10 + k * 0.7 | 0, 6 - k * 0.8 | 0, '#d83818'); }
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
      const d = Math.hypot(x - 6, y - 8);
      if (d < 4.6) put(x, y, d < 1.8 ? '#fff7c8' : d < 3.2 ? '#f8d048' : '#f89838');
    }
  });
  const spellFrost = outlined(13, 13, put => {
    const c = 6;
    for (let k = -5; k <= 5; k++) { put(c + k, c, '#e8f4ff'); put(c, c + k, '#e8f4ff'); }
    for (let k = -4; k <= 4; k++) { put(c + k, c + k, '#88c8ff'); put(c + k, c - k, '#88c8ff'); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // malé vetvičky na koncoch ramien
      const ex = c + dx * 4, ey = c + dy * 4;
      put(ex + dy, ey + dx, '#e8f4ff'); put(ex - dy, ey - dx, '#e8f4ff');
    }
    put(c, c, '#ffffff');
  });
  const spellBolt = fromMap([
    '.......KKKKK..',
    '......KWYYYK..',
    '.....KWYYYK...',
    '....KWYYYK....',
    '...KWYYYKKKK..',
    '..KWYYYYYYYK..',
    '..KKKKYYYYK...',
    '.....KYYYK....',
    '....KYYYK.....',
    '...KYYK.......',
    '..KYYK........',
    '.KYK..........',
    '.KK...........',
    '..............',
  ], { K: '#1c140e', Y: '#f8e048', W: '#ffffff' });

  // ---- zvitok v pixel-art štýle: pergamen (tieňovanie s Bayerovým ditheringom) a drevené tyče so zlatými hlavicami ----
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  function canvasArt(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x2 = c.getContext('2d'), id = x2.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = fn(x, y); if (!col) continue;
      const k = (y * w + x) * 4; id.data[k] = col[0]; id.data[k + 1] = col[1]; id.data[k + 2] = col[2]; id.data[k + 3] = 255;
    }
    x2.putImageData(id, 0, 0);
    return c.toDataURL();
  }
  const PARCH = ['#3a2412', '#5e3c1c', '#7e5428', '#9c7038', '#b88c4c', '#cfa863', '#dfc07c', '#ecd59a', '#f6e7bb'].map(hex);
  // pergamen w×h bodov: svetlo zľava hore, stmavnuté zvlnené okraje, škvrny, vlákna a tieň pod tyčami
  function scrollPaper(w, h) {
    const N = PARCH.length - 1;
    const edge = y => (hash(7, y >> 1) > 0.78 ? 1 : 0) + (hash(9, y >> 2) > 0.9 ? 1 : 0); // nepravidelný okraj
    return canvasArt(w, h, (x, y) => {
      const l = edge(y), r = edge(y + 999);
      if (x < l || x > w - 1 - r) return null;
      if (x === l || x === w - 1 - r) return PARCH[0];            // tmavý obrys
      const dx = Math.min(x - l, w - 1 - r - x), dy = Math.min(y, h - 1 - y);
      // zvinutý okraj pri tyči: riadky 3–8 od hornej/spodnej hrany tvoria malý valec (svetlo zhora)
      const CURL = [null, null, null, 2, 5, 7, 8, 6, 3, 1];
      const ci = dy;                                             // hore aj dole rovnako: tieň – svetlá hrana – tieň
      if (dy < CURL.length && CURL[ci] != null && ci < CURL.length) {
        let lv = CURL[ci] - Math.max(0, 4 - dx);                  // na bokoch je valec tmavší
        if (hash(x, y) < 0.08) lv -= 1;
        return PARCH[Math.max(1, Math.min(8, lv))];
      }
      let v = 0.74;
      v += 0.08 * (1 - (x / w) * 0.6 - (y / h) * 0.4);            // svetlo zľava hore
      v -= Math.max(0, 7 - dx) * 0.045;                           // zvinutie a stmavnutie pri bokoch
      v -= Math.max(0, 5 - dy) * 0.05;                            // tieň pod tyčami
      v += Math.sin(x * 0.19 + y * 0.11) * 0.035 + Math.sin(x * 0.06 - y * 0.15 + 2.1) * 0.045 + Math.sin(y * 0.33 + x * 0.02) * 0.02; // škvrny
      if (hash(x, y) < 0.012) v -= 0.12;                          // vlákna a zrnká
      const lv = Math.max(1, Math.min(N, Math.floor(v * N + bayer(x, y))));
      return PARCH[lv];
    });
  }
  const WOOD = ['#22140a', '#4a2e14', '#6a4220', '#8a5a2a', '#a87038', '#c48a4a', '#dca468', '#f0c890'].map(hex);
  const GOLD = ['#2e2006', '#6a4a10', '#9a7018', '#c89a28', '#e8c040', '#f8e070', '#fff8c0'].map(hex);
  // tyč w×9 bodov: valec z dreva s letokruhmi, tmavé objímky a zlaté hlavice na koncoch
  function scrollRod(w) {
    const H = 9, KN = 5;
    const row = [0, 6, 7, 5, 4, 4, 3, 2, 0];                    // svetlo valca po riadkoch (horná lesklá hrana, spodok v tieni)
    return canvasArt(w, H, (x, y) => {
      const kx = x < KN ? x : x > w - 1 - KN ? w - 1 - x : -1;  // vzdialenosť od konca (hlavica)
      if (kx >= 0) {                                            // zlatá hlavica: zaoblená, svetlo zľava hore
        const ex = (kx - 2.5) / 2.6, ey = (y - 4) / 4.6;
        if (ex * ex + ey * ey > 1) return null;
        const ox = (kx - 2.5) / 2.6, oy1 = (y - 5) / 4.6, oy0 = (y - 3) / 4.6;
        if (ox * ox + oy1 * oy1 > 1 || ox * ox + oy0 * oy0 > 1 || kx === 0) return GOLD[0];
        const side = x < KN ? 1 : -1;                           // ľavá hlavica svieti zľava, pravá je viac v tieni
        let g = 4 - (y - 3) * 0.7 + (side > 0 ? 0.6 : -0.4) + (kx < 2 ? -0.6 : 0.3);
        if (y === 2 && kx === 2) g = 6;
        return GOLD[Math.max(1, Math.min(6, Math.round(g)))];
      }
      if (x === KN || x === w - 1 - KN) return y === 0 || y === H - 1 ? WOOD[0] : GOLD[1 + (y < 4 ? 1 : 0)]; // objímka
      if (y === 0 || y === H - 1) return WOOD[0];
      let lv = row[y];
      if (hash(x >> 2, y) < 0.18 && y > 2) lv -= 1;             // letokruhy
      if (hash(x, y * 3) < 0.05) lv -= 1;
      return WOOD[Math.max(1, Math.min(7, lv))];
    });
  }

  // modrý látkový štítok so šípkou hore (visí zo spodnej tyče zvitku, zvinie ho)
  const scrollTag = fromMap([
    'KKKKKKKKKKK',
    'KLBBBBBBBDK',
    'KLBBBBBBBDK',
    'KLBBBWBBBDK',
    'KLBBWWWBBDK',
    'KLBWWWWWBDK',
    'KLWWWWWWWDK',
    'KLBDWWWDBDK',
    'KLBBWWWBBDK',
    'KLBBWWWBBDK',
    'KLBBDDDBBDK',
    'KLBBBBBBBDK',
    'KLBBKKKBBDK',
    'KLBK...KBDK',
    'KLK.....KDK',
    'KK.......KK',
  ], { K: '#1c140e', L: '#8ab4ff', B: '#3c64c8', D: '#22337a', W: '#fff7e0' });

  // ---- vlajky 18×12 bodov ----
  const FW = 18, FH = 12;
  const stripesH = cols => (x, y) => cols[Math.floor(y * cols.length / FH)];
  const flags = {
    sk: (() => { // biela-modrá-červená a štít s dvojkrížom na troch vrškoch
      const base = stripesH(['#ffffff', '#0b4ea2', '#ee1c25']);
      const shield = [
        'WWWWWWW',
        'WRRRRRW',
        'WRRWRRW',
        'WRWWWRW',
        'WRRWRRW',
        'WWWWWWW',
        'WRRWRRW',
        'WBBBBBW',
        '.WBBBW.',
        '..WWW..',
      ];
      const P = { W: '#ffffff', R: '#ee1c25', B: '#0b4ea2' };
      return pix(FW, FH, (x, y) => {
        const sx = x - 3, sy = y - 1;
        if (sx >= 0 && sx < 7 && sy >= 0 && sy < 10 && shield[sy][sx] !== '.') return P[shield[sy][sx]];
        return base(x, y);
      });
    })(),
    en: pix(FW, FH, (x, y) => { // Union Jack
      const cx = x + 0.5, cy = y + 0.5;
      if (y >= 5 && y <= 6 || x >= 8 && x <= 9) return '#c8102e';
      if (y >= 4 && y <= 7 || x >= 7 && x <= 10) return '#ffffff';
      const d1 = Math.abs(12 * cx - 18 * cy) / 21.6, d2 = Math.abs(12 * cx + 18 * cy - 216) / 21.6;
      if (d1 < 0.7 || d2 < 0.7) return '#c8102e';
      if (d1 < 1.6 || d2 < 1.6) return '#ffffff';
      return '#012169';
    }),
    de: pix(FW, FH, stripesH(['#1c1c1c', '#dd0000', '#ffce00'])),
    es: pix(FW, FH, (x, y) => {
      if (y < 3 || y >= 9) return '#c60b1e';
      if (x >= 4 && x <= 6 && y >= 4 && y <= 7) return (x === 5 && y === 4) ? '#c60b1e' : (y === 7 ? '#8a5a10' : '#c60b1e'); // malý erb
      if ((x === 3 || x === 7) && y >= 4 && y <= 7) return '#d8d8d8';               // stĺpy
      return '#ffc400';
    }),
    ja: pix(FW, FH, (x, y) => (Math.hypot(x + 0.5 - 9, y + 0.5 - 6) < 3.7 ? '#bc002d' : '#ffffff')),
    it: pix(FW, FH, x => ['#009246', '#ffffff', '#ce2b37'][Math.floor(x / 6)]),
    ko: pix(FW, FH, (x, y) => {
      const dx = x + 0.5 - 9, dy = y + 0.5 - 6;
      if (Math.hypot(dx, dy) < 3.3) {                                                // taeguk: hore červená, dole modrá, so záhybom
        const top = dy < 0 || (dy < 1 && dx < -0.5);
        const bump = dy > -1.2 && dy < 0 && dx > 0.5;
        return (top && !bump) ? '#cd2e3a' : '#0047a0';
      }
      // štyri trigramy v rohoch: krátke čierne čiarky šikmo
      const tri = [[2, 1], [3, 2], [2, 2], [14, 1], [15, 2], [15, 1], [2, 10], [3, 9], [2, 9], [15, 10], [14, 9], [15, 9]];
      for (const [tx, ty] of tri) if (x === tx && y === ty) return '#1c1c1c';
      return '#ffffff';
    }),
    zh: (() => { // veľká hviezda a štyri malé
      const star = ['..Y..', '.YYY.', 'YYYYY', '.YYY.', '.Y.Y.'];
      const small = [[7, 1], [8, 3], [8, 5], [7, 7]];
      return pix(FW, FH, (x, y) => {
        const sx = x - 1, sy = y - 1;
        if (sx >= 0 && sx < 5 && sy >= 0 && sy < 5 && star[sy][sx] === 'Y') return '#ffde00';
        for (const [tx, ty] of small) if (x === tx && y === ty) return '#ffde00';
        return '#de2910';
      });
    })(),
  };

  // poradie jazykov v Nastaveniach; zatiaľ hrá len slovenčina, ostatné prídu s prekladom
  const langs = [
    { id: 'sk', name: 'Slovenčina', ready: true },
    { id: 'en', name: 'English' },
    { id: 'de', name: 'Deutsch' },
    { id: 'es', name: 'Español' },
    { id: 'ja', name: '日本語' },
    { id: 'it', name: 'Italiano' },
    { id: 'ko', name: '한국어' },
    { id: 'zh', name: '中文' },
  ];

  return { pix, music, sound, plus, home, hall, trophy, star, swords, chest, spellVolley, spellFire, spellFrost, spellBolt, scrollPaper, scrollRod, scrollTag, flags, langs };
})();
