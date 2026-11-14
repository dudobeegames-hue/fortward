'use strict';
// Fortward – ikonky menu mapy v jemnej kresbe (1 bod kresby = 1 bod obrazovky): karty dole (40×40) a tlačidlá vpravo hore (28×28).
// Každá ikonka sa kreslí po bodoch z rámp farieb, svetlo zľava zhora; tmavý obrys okolo siluety sa doplní sám.
const FINE_ICONS = (() => {
  const K = '#1c140e';
  const STEEL = ['#2c3040', '#4a4e60', '#80869a', '#bcc0cc', '#e6e9f2', '#ffffff'];
  const GOLD = ['#5a3a0c', '#8a5c14', '#b88420', '#e0a830', '#f8d048', '#ffec90', '#fffbe0'];
  const WOOD = ['#2a1a0e', '#3e2614', '#6a4220', '#9a6430', '#c08848', '#dca866'];
  const STONE = ['#3a3f4c', '#5c6272', '#80869a', '#a4aabb', '#c8ccd8', '#eceef4'];
  const SEA = ['#16285a', '#22408c', '#3c64c8', '#5c8ce0', '#88b4ff', '#c4dcff'];
  const LAND = ['#1e4a1e', '#2e6a26', '#4a8c32', '#6aae42', '#9cd45a'];
  const ROOF = ['#4a1810', '#7a2a1a', '#a83c24', '#cc5a34', '#e88a5a'];
  const PAPER = ['#7a6238', '#b89c68', '#d8c490', '#ecdcb0', '#fff2d0'];
  const pick = (ramp, v) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(v)))];
  // paint(each, put): each(fn) prejde všetky body (fn dostane stred bodu a jeho súradnice, vráti farbu alebo nič), put(x, y, c) jeden bod
  function icon(w, h, paint) {
    const a = Array.from({ length: h }, () => new Array(w).fill(null));
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) a[y][x] = c; };
    const each = fn => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x + 0.5, y + 0.5, x, y); if (c) a[y][x] = c; } };
    paint(each, put);
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[y][x];
    return UI_ICONS.pix(w, h, (x, y) => a[y][x] || (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? K : null));
  }

  // ---- Boj: dva skrížené meče (oceľová čepeľ so žliabkom, zlatá priečka a hlavica, kožená rukoväť) ----
  const swords = icon(40, 40, each => {
    const sword = (x0, y0, x1, y1, halo) => {
      const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, ns = ux - uy, g = halo ? 1.1 : 0;
      each((px, py) => {
        const dx = px - x0, dy = py - y0, u = dx * ux + dy * uy, v = -dx * uy + dy * ux, av = Math.abs(v), lit = v * ns < 0;
        let c = null;
        if (Math.hypot(u, v) < 2.3 + g) c = pick(GOLD, lit ? 5 : 3);                                   // hlavica
        else if (u >= 1.5 && u < 8 && av < 1.5 + g) c = Math.floor(u) % 2 ? WOOD[2] : WOOD[4];           // rukoväť s ovinutím
        else if (u >= 7.6 - g && u < 10.4 + g && av < 6.6 + g) c = pick(GOLD, (lit ? 4.6 : 3) - (u > 9.4 ? 1.4 : 0) + (av > 5.4 ? 1 : 0)); // priečka
        else if (u >= 10 && u < L + g) {                                                                // čepeľ: zúži sa do hrotu
          const hw = Math.min(2.7, (L - u) * 0.8 + 0.3);
          if (av < hw + g) c = av < 0.55 ? STEEL[2] : lit ? (av > hw - 0.9 ? STEEL[5] : STEEL[4]) : (av > hw - 0.9 ? STEEL[1] : STEEL[3]);
        }
        return c && (halo ? K : c);
      });
    };
    sword(33.5, 33.5, 6.5, 6.5);                 // zadný meč
    sword(6.5, 33.5, 33.5, 6.5, true); sword(6.5, 33.5, 33.5, 6.5); // predný meč s tmavým lemom
  });

  // ---- Sieň: kamenný chrám so štyrmi stĺpmi, štítom so zlatým znakom a schodmi ----
  const hall = icon(40, 40, (each, put) => {
    each((px, py, x, y) => {
      if (y >= 5 && y <= 14) { // štít strechy
        const half = (py - 4.5) * 1.75;
        if (Math.abs(px - 20) > half) return null;
        if (Math.hypot(px - 20, py - 11) < 2.6) return pick(GOLD, 4.4 - (px - 20) * 0.5 - (py - 11) * 0.5); // zlatý znak
        return Math.abs(px - 20) > half - 1.6 || y === 14 ? STONE[5] : pick(STONE, 3.4 - (px - 20) * 0.07);  // svetlá rímsa po obvode
      }
      if (y >= 15 && y <= 17) return x >= 3 && x <= 36 ? (y === 15 ? STONE[5] : y === 16 ? STONE[3] : STONE[1]) : null; // preklad
      if (y >= 18 && y <= 31) { // stĺpy s hlavicou a pätkou, medzi nimi tma siene
        if (x < 4 || x > 35) return null;
        const k = (x - 5) % 8, col = x >= 5 && x <= 34 && k < 6;
        if (!col) return x >= 5 && x <= 34 ? '#241a12' : null;
        if (y === 18 || y === 31) return k === 0 ? STONE[5] : k === 5 ? STONE[2] : STONE[4];
        if (k === 0 || k === 5) return null;
        return k === 1 ? STONE[5] : k === 2 ? STONE[4] : k === 3 ? STONE[3] : STONE[1]; // valec: svetlo vľavo, tieň vpravo
      }
      if (y >= 32 && y <= 34) return x >= 2 && x <= 37 ? (y === 32 ? STONE[5] : y === 33 ? STONE[3] : STONE[2]) : null; // schody
      if (y >= 35 && y <= 37) return y === 35 ? STONE[4] : y === 36 ? STONE[2] : STONE[1];
      return null;
    });
    for (let x = 5; x <= 34; x++) if ((x - 5) % 8 >= 6) { put(x, 19, K); } // tieň pod prekladom medzi stĺpmi
  });

  // ---- Mapa sveta: zemeguľa s pevninami, tieňovaná ako guľa ----
  const globe = icon(40, 40, each => {
    const cx = 20, cy = 20, R = 16;
    const lands = [[-7, -6, 6.5, 5], [-2, -1, 4, 6], [-4, 6, 3.5, 5], [7, -3, 5.5, 4], [9, 5, 4, 3.5], [2, -11, 5, 2.4], [-11, 2, 2.5, 3], [5, 11, 3, 2]];
    each((px, py, x, y) => {
      const dx = px - cx, dy = py - cy, r = Math.hypot(dx, dy);
      if (r > R) return null;
      const lit = (-dx - dy) / (R * 1.41), edge = r / R;           // −1 … 1, okraj gule tmavne
      const dith = ((x + y) % 2 ? 0.25 : -0.25);
      const v = 2.3 + lit * 2.1 - (edge > 0.82 ? 1 : 0) + dith;
      const land = lands.some(([lx, ly, rx, ry]) => ((dx - lx) / rx) ** 2 + ((dy - ly) / ry) ** 2 < 1 + Math.sin(x * 1.7 + y * 2.3) * 0.25);
      if (Math.hypot(dx + 6, dy + 7) < 2.2) return land ? LAND[4] : SEA[5]; // odlesk
      return land ? pick(LAND, v * 0.85 + 0.4) : pick(SEA, v);
    });
  });

  // ---- Trofeje: zlatý pohár s uškami na podstavci ----
  const trophy = icon(40, 40, each => {
    const cyl = (px, x0, x1) => { const t = (px - x0) / (x1 - x0); return 4.3 - Math.abs(t - 0.3) * 5 + (t > 0.24 && t < 0.36 ? 1.2 : 0); }; // lesklý valec: svetlý pruh vľavo
    each((px, py, x, y) => {
      for (const s of [-1, 1]) { // ušká: prstence po bokoch
        const hx = 20 + s * 12.5, d = Math.hypot((px - hx) / 1.15, py - 12.5);
        if (d < 5.4 && d > 3 && s * (px - 20) > 9.5) return pick(GOLD, s < 0 ? 4.4 - (d - 3) : 3 - (d - 3) * 0.6);
      }
      if (y >= 5 && y <= 7) return x >= 9 && x <= 30 ? (y === 5 ? GOLD[6] : y === 6 ? pick(GOLD, cyl(px, 9, 31) + 0.6) : GOLD[2]) : null; // okraj
      if (y >= 8 && y <= 22) { // miska sa zužuje dole
        const half = 10.5 * Math.sqrt(Math.max(0, 1 - ((py - 8) / 15.5) ** 2));
        if (Math.abs(px - 20) > half) return null;
        if (Math.hypot(px - 20, py - 14) < 3.2 && Math.abs(px - 20) + Math.abs(py - 14) < 3.6) return GOLD[Math.abs(px - 20) + Math.abs(py - 14) < 1.6 ? 6 : 2]; // vyrazený kosoštvorec
        return pick(GOLD, cyl(px, 20 - half, 20 + half) - (py > 19 ? 0.8 : 0));
      }
      if (y >= 23 && y <= 28) return Math.abs(px - 20) < (y === 25 || y === 26 ? 3.2 : 2.2) ? pick(GOLD, cyl(px, 17, 23) - (y === 25 ? -0.8 : 0.4)) : null; // stopka s prstencom
      if (y >= 29 && y <= 31) return Math.abs(px - 20) < 6.2 ? pick(GOLD, cyl(px, 13.5, 26.5) - (y === 31 ? 1.2 : 0)) : null;
      if (y >= 32 && y <= 36) return Math.abs(px - 20) < 9.2 ? (y === 32 ? WOOD[5] : y === 36 ? WOOD[1] : pick(WOOD, 4.2 - (px - 11) * 0.12)) : null; // drevený podstavec
      return null;
    });
  });

  // ---- Nákupy: truhlica s oblým vekom, zlatým kovaním a zámkom ----
  const chest = icon(40, 40, each => {
    each((px, py, x, y) => {
      if (x < 4 || x > 35) return null;
      const band = (x >= 8 && x <= 10) || (x >= 29 && x <= 31), edge = x === 4 || x === 35;
      const lock = x >= 17 && x <= 22 && y >= 17 && y <= 25;
      if (y >= 7 && y <= 18) { // veko: oblúk
        const top = 7 + 4.2 * (1 - Math.sqrt(Math.max(0, 1 - ((px - 20) / 16.4) ** 2)));
        if (py < top) return null;
        if (lock) return null;
        if (y >= 17) return pick(GOLD, y === 17 ? 5 : 2.6);                                  // kovanie na hrane veka
        if (band || edge) return pick(GOLD, 5.2 - (py - top) * 0.32 - (x >= 29 ? 0.8 : 0));
        return pick(WOOD, 5 - (py - top) * 0.3 - ((y - 7) % 4 === 3 ? 1.2 : 0) - (px - 20) * 0.03); // dosky veka
      }
      if (y >= 19 && y <= 34) {
        if (lock) return null;
        if (y >= 32) return pick(GOLD, y === 32 ? 4.6 : y === 33 ? 3.2 : 2);                  // spodné kovanie
        if (band || edge) return pick(GOLD, (x === 8 || x === 29 || x === 4 ? 4.8 : x === 10 || x === 31 || x === 35 ? 2.4 : 3.8) - (y === 19 ? 1.6 : 0));
        return pick(WOOD, (y === 19 ? 1 : 3.6) - ((y - 19) % 4 === 3 ? 1.3 : 0) - (px - 20) * 0.04); // dosky s tieňom pod vekom
      }
      return null;
    });
    each((px, py, x, y) => { // zámok: zlatá platnička s kľúčovou dierkou
      if (x < 17 || x > 22 || y < 17 || y > 25) return null;
      if ((y === 17 || y === 25) && (x === 17 || x === 22)) return pick(GOLD, 2);
      if ((x === 19 || x === 20) && y >= 20 && y <= 23) return y <= 21 || x === 19 ? K : WOOD[0];
      return pick(GOLD, x === 17 || y === 17 ? 6 : x === 22 || y === 25 ? 2 : 4);
    });
  });

  // ---- Menu: domček s červenou strechou, komínom, oknom a dverami ----
  const home = icon(28, 28, each => {
    each((px, py, x, y) => {
      if (x >= 19 && x <= 22 && y >= 4 && y <= 11 && py < 2 + (px - 14) * 0.95 + 3) return y === 4 ? STONE[4] : x === 19 ? STONE[3] : STONE[1]; // komín
      if (y >= 3 && y <= 14) { // strecha: škridly v radoch
        const half = (py - 2.2) * 1.12;
        if (Math.abs(px - 14) > half) return null;
        if (Math.abs(px - 14) > half - 1.5) return px < 14 ? ROOF[4] : ROOF[1];        // hrana strechy
        return pick(ROOF, (px < 14 ? 3 : 2) - (y % 3 === 2 ? 1.2 : 0) - ((x + (y % 6 < 3 ? 0 : 2)) % 4 === 0 ? 0.6 : 0));
      }
      if (y >= 15 && y <= 25) {
        if (x < 5 || x > 22) return null;
        if (y === 15) return '#8a6a48';                                               // tieň pod strechou
        if (x >= 7 && x <= 11 && y >= 18) return y === 18 || x === 7 ? WOOD[4] : x === 11 ? WOOD[1] : (x === 10 && y === 22 ? GOLD[4] : WOOD[3]); // dvere s kľučkou
        if (x >= 15 && x <= 20 && y >= 17 && y <= 22) return x === 15 || x === 20 || y === 17 || y === 22 ? WOOD[2] : (x + y) % 5 === 0 ? SEA[5] : (x === 17 || x === 18) && (y === 19 || y === 20) ? (x === 17 ? WOOD[2] : SEA[3]) : SEA[4]; // okno
        return pick(PAPER, (x <= 6 ? 4 : x >= 21 ? 1.6 : 3) - ((y % 4 === 1 && (x + y) % 7 < 2) ? 1 : 0)); // omietka s kameňmi
      }
      if (y === 26) return x >= 3 && x <= 24 ? STONE[2] : null;                        // prah
      return null;
    });
  });

  // ---- Vzhľad mapy: zvitok papiera s dvoma územiami, cestou a krížikom; zapnutá námornícka mapa má zelenkastý papier ----
  const mapIcon = on => icon(28, 28, each => {
    const P = on ? ['#2a4a1e', '#3e6a2a', '#56923a', '#7ab452', '#a8d878'] : PAPER;
    each((px, py, x, y) => {
      if (x < 2 || x > 25 || y < 4 || y > 23) return null;
      const wave = Math.round(Math.sin(x * 0.55) * 1.2);                              // zvlnený papier
      const yy = y - wave;
      if (yy < 5 || yy > 22) return null;
      if (x <= 3) return pick(P, 1 - (x === 2 ? 1 : 0));                               // zrolovaný ľavý okraj
      if (x >= 24) return pick(P, x === 24 ? 4 : 2);                                   // zrolovaný pravý okraj
      if (yy === 5) return P[4]; if (yy === 22) return P[1];
      const o = Math.hypot((px - 9.5) / 4.6, (yy - 10.5) / 3.6), b = Math.hypot((px - 17.5) / 4.8, (yy - 16) / 3.8);
      if (o < 1) return o > 0.72 ? '#b8641c' : (x + yy) % 3 ? '#ec9234' : '#f8b858';   // oranžové územie
      if (b < 1) return b > 0.72 ? '#3c64c8' : (x + yy) % 3 ? '#8cb6e2' : '#b4d2f2';   // modré územie
      if ((x === 19 || x === 21) && (yy === 8 || yy === 10) || (x === 20 && yy === 9)) return '#a02818'; // krížik pokladu
      if (yy === 19 && x >= 6 && x <= 11 && x % 2 === 0) return P[0];                  // bodkovaná cesta
      return pick(P, 3 - ((x * 7 + yy * 13) % 11 === 0 ? 1 : 0) + (wave < 0 ? 0.6 : wave > 0 ? -0.6 : 0));
    });
  });

  return { swords, hall, globe, trophy, chest, home, map: mapIcon(false), mapOn: mapIcon(true) };
})();
