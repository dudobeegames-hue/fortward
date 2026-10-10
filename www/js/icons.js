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

  return { pix, music, sound, plus, home, hall, trophy, star, swords, flags, langs };
})();
