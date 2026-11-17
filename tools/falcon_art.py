"""Sokol v jemnej kresbe (hd, plátno 40×40 → 20×20 bodov hry) bez PixelLabu – rovnaký postup ako netopier
(tools/bat_art.py): 3D model z trojuholníkov natočený do 8 smerov, vyfarbený po pixeloch a obtiahnutý obrysom.
Hnedé perie, tmavé letky na koncoch krídel, svetlé brucho, žltý zobák a pazúry, modré remienky na nohách (ľudia sú modrí).

Použitie: python tools/falcon_art.py [náhľad.png]
Výstup: www/js/falcon-art.js (FALCON_ART: rot, run = mávanie, atk = útok, hd, pal).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bat_art as B  # noqa: E402  (spoločné kreslenie: premietanie, z-buffer, svetlo, obrys)

PAL = {
    '0': '#3a2414', '1': '#5e3c20', '2': '#86582e', '3': '#b07c44',   # perie chrbta a hlavy (tmavé → svetlé)
    '4': '#1e120c', '5': '#352216', '6': '#4e3322', '7': '#82603e',   # letky (konce krídel, chvost) a čiapočka – tmavé
    '9': '#c8b088', 'a': '#ece0c0',                                   # svetlé brucho a líca
    'b': '#f8d048', 'f': '#b88420',                                   # zobák a pazúry (žltá), ich tieň
    'h': '#1c140e', 'i': '#3c64c8',                                   # oko, modrý remienok
}
RAMP = {'fur': '0123', 'wing': '123', 'tip': '456', 'cap': '456', 'belly': '9a', 'beak': 'fb', 'tail': '4567'}


def wing(side, flap, sweep=0.0):
    """Krídlo vtáka: predná hrana k zápästiu, špicatý koniec, zadná hrana zubatá (konce letiek).
    u = rozpätie von, v = dopredu; vnútorná časť (u < 7) je perie chrbta, vonkajšia tmavé letky."""
    lead = [(0, 1.5), (2.8, 2.4), (5.6, 2.8), (8.6, 1.9), (12.6, -0.6)]          # predná hrana až po špičku
    trail = []                                                                     # zadná hrana zo špičky k telu, zúbky letiek
    n = 9
    for i in range(1, n + 1):
        t = i / n
        u = 12.6 * (1 - t)
        v = -0.6 - 3.6 * math.sin(math.pi * min(1, t * 1.15)) * (0.55 + 0.45 * t) - 1.0 * t
        v += 0.75 if i % 2 else 0.0                                                # zúbky (konce pier)
        trail.append((u, v))
    trail[-1] = (0, -2.9)
    pts = lead + trail
    if sweep: pts = [(u, v - sweep * u / 12.6 * 3.2) for u, v in pts]
    c, s = math.cos(flap), math.sin(flap)
    to3 = lambda uv: (side * (1.4 + uv[0] * c), uv[1], 0.4 + uv[0] * s)
    tris = []
    for i in range(len(pts)):  # vejár od stredu krídla; trojuholníky vonku = letky, vnútri = perie
        a, b = pts[i], pts[(i + 1) % len(pts)]
        ctr = (4.5, -0.4) if max(a[0], b[0]) < 8 else (8.5, -0.6)
        mat = 'tip' if (a[0] + b[0]) / 2 > 7.2 else 'wing'
        tris.append((to3(ctr), to3(a), to3(b), mat))
    # výplň medzi dvoma stredmi vejára (inak by v strede krídla ostala diera)
    tris.append((to3((4.5, -0.4)), to3((8.5, -0.6)), to3((7.2, 2.2)), 'wing'))
    tris.append((to3((4.5, -0.4)), to3((8.5, -0.6)), to3((7.2, -2.6)), 'wing'))
    return tris


def ellipsoid_split(c, r, top, bottom, cut):
    """Elipsoid: horná časť jedným materiálom, spodná (z pod cut) druhým – sokol má svetlé brucho."""
    tris = B.ellipsoid(c, r, top)
    return [(a, b, cc, bottom if (a[2] + b[2] + cc[2]) / 3 < cut else m) for a, b, cc, m in tris]


def model(flap, lean=0.0, bite=False, sweep=0.0):
    """Sokol hlavou dopredu (+y); bite = útok pazúrmi (nohy vystreté dopredu)."""
    tris = ellipsoid_split((0, 0, 0), (1.9, 3.5, 1.7), 'fur', 'belly', -0.2)
    tris += ellipsoid_split((0, 3.6, 0.9), (1.7, 1.7, 1.6), 'cap', 'belly', 0.75)  # tmavá čiapočka, svetlé líca a hrdlo
    tris += [((0, 6.3, 0.3), (0.75, 4.9, 1.0), (-0.75, 4.9, 1.0), 'beak'),                       # zobák (zahnutý nadol)
             ((0, 6.3, 0.3), (0.75, 4.9, 1.0), (0, 5.0, 0.0), 'beak'), ((0, 6.3, 0.3), (-0.75, 4.9, 1.0), (0, 5.0, 0.0), 'beak')]
    eyes = [((sx * 0.95, 4.6, 1.3), 'eye') for sx in (1, -1)]
    cheeks = [((sx * 1.05, 4.4, 0.8), 'cheek') for sx in (1, -1)]
    fy, fz = (2.6, -1.4) if bite else (-1.6, -1.6)  # pri útoku vystrčí pazúry dopredu
    feet = [((sx * 0.6, fy, fz), 'claw') for sx in (1, -1)] + [((sx * 0.6, fy - 0.6, fz + 0.3), 'jess') for sx in (1, -1)]
    if lean:
        tris = [(B.rot_x(a, lean), B.rot_x(b, lean), B.rot_x(c, lean), m) for a, b, c, m in tris]
        eyes = [(B.rot_x(p, lean), m) for p, m in eyes]; cheeks = [(B.rot_x(p, lean), m) for p, m in cheeks]
        feet = [(B.rot_x(p, lean), m) for p, m in feet]
    # chvost: vejár pier dozadu (v rovine letu)
    tail = [(0, -2.6, 0.1), (1.0, -2.8, 0.1), (2.0, -6.4, -0.2), (0.9, -7.1, -0.2), (0, -6.9, -0.2), (-0.9, -7.1, -0.2), (-2.0, -6.4, -0.2), (-1.0, -2.8, 0.1)]
    for i in range(1, len(tail) - 1):
        tris.append((tail[0], tail[i], tail[i + 1], 'tail'))
    for side in (1, -1):
        tris += wing(side, flap, sweep)
    return tris, [], cheeks + eyes + feet


B.PAL, B.RAMP, B.model = PAL, RAMP, model
B.WING_MATS = {'wing', 'tip', 'tail'}
B.DOTS = {'eye': 'h', 'cheek': 'a', 'claw': 'b', 'jess': 'i'}
FLAP = [55, 34, 8, -26, -12, 28]  # mávanie: hore, záber dole, späť hore (pokojnejšie ako netopier)


def main():
    ang = lambda d: math.radians(B.YAW[d])
    R = B.render
    rot = [R(ang(d), math.radians(18)) for d in range(8)]
    run = [[R(ang(d), math.radians(f)) for f in FLAP] for d in range(8)]
    atk = [[R(ang(d), math.radians(70), lean=B.UP + 0.3, sweep=1.2),            # strmhlav: krídla vysoko a dozadu
            R(ang(d), math.radians(-20), lean=B.UP - 0.5, bite=True),           # zásah pazúrmi
            R(ang(d), math.radians(30), lean=B.UP)] for d in range(8)]          # návrat
    data = {'rot': rot, 'run': run, 'atk': atk, 'hd': True, 'pal': PAL}
    js = ["'use strict';",
          '// FALCON_ART: sokol v jemnej kresbe (hra ho kreslí v polovičnej veľkosti) – vygenerované: tools/falcon_art.py (3D model, natočený do 8 smerov) – ručne neupravovať.',
          '// rot: let v 8 smeroch (0 vpravo, 1 vpravo dole … 7 vpravo hore), run: mávanie krídlami 6 snímok, atk: strmhlav, zásah pazúrmi, návrat',
          'const FALCON_ART = %s;' % json.dumps(data, separators=(',', ':')).replace('],[', '],\n['), '']
    open(os.path.join(B.ROOT, 'www/js/falcon-art.js'), 'w', encoding='utf8').write('\n'.join(js))
    if len(sys.argv) > 1: B.preview(sys.argv[1], [[rot[d]] + run[d] + atk[d] for d in range(8)], PAL)
    print('FALCON_ART: 8 smerov, mávanie %d snímok, útok 3 snímky' % len(FLAP))


main()
