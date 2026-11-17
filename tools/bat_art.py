"""Netopier v jemnej kresbe (hd, plátno 40×40 → 20×20 bodov hry) bez PixelLabu: malý 3D model z trojuholníkov
(telo, hlava, uši, krídla s prstami) sa natočí do 8 smerov, premietne zhora šikmo ako ostatné jednotky,
vyfarbí po pixeloch (z-buffer, svetlo zľava zhora → stupne farieb) a obtiahne tmavým obrysom.

Použitie: python tools/bat_art.py [náhľad.png]
Výstup: www/js/bat-art.js (BAT_ART v tvare ako z tools/pixellab2js.py: rot, run = mávanie, atk = útok, hd, pal).
"""
import json
import math
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
N = 40            # plátno (jemná mriežka)
CX, CY = 20, 21
SC = 1.3          # mierka modelu (rozpätie krídel ≈ 32 pixelov = 16 bodov hry, ako sokol)   # stred tela na plátne
PITCH = math.radians(58)  # sklon kamery (90° = kolmo zhora): netopier je videný skôr spredu, ako sokol z PixelLabu

# farby: znak → farba (znaky, ktoré nie sú v PAL hry; K = obrys z PAL)
PAL = {
    '0': '#2c1e30', '1': '#4a3450', '2': '#6c5074', '3': '#92749a',   # srsť (tmavá → svetlá)
    '4': '#3e2856', '5': '#5e3e80', '6': '#8462a8', '7': '#aa8ccc',   # blana krídel (fialovejšia a svetlejšia ako srsť)
    '8': '#1c1224',                                                   # kosti prstov
    '9': '#b8788c', 'a': '#e8a8b4',                                   # vnútro uší
    'b': '#fff070', 'f': '#eee6cc', 'h': '#8c2018',                   # oči, tesáky, papuľa
}
RAMP = {'fur': '0123', 'wing': '4567', 'ear': '19a', 'bone': '8', 'eye': 'b', 'fang': 'f', 'mouth': 'h'}
LIGHT = (-0.45, -0.55, 0.70)  # svetlo zľava, zo severu a zhora (svet: x vpravo, y na juh, z hore)


def norm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / l for c in v)


LIGHT = norm(LIGHT)


def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def rot_x(p, a):  # okolo priečnej osi (predklon tela)
    c, s = math.cos(a), math.sin(a)
    return (p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c)


def ellipsoid(c, r, mat, nu=12, nv=8):
    tris = []
    pt = lambda i, j: (c[0] + r[0] * math.sin(math.pi * j / nv) * math.cos(2 * math.pi * i / nu),
                       c[1] + r[1] * math.sin(math.pi * j / nv) * math.sin(2 * math.pi * i / nu),
                       c[2] + r[2] * math.cos(math.pi * j / nv))
    for i in range(nu):
        for j in range(nv):
            a, b, cc, d = pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)
            tris += [(a, b, cc, mat), (a, cc, d, mat)]
    return tris


def wing(side, flap, sweep=0.0):
    """Krídlo v rovine natočenej okolo pozdĺžnej osi tela o uhol flap; (u = rozpätie von, v = dopredu).
    Vráti trojuholníky blany a úsečky prstov."""
    pts = {'sh': (0, 1.6), 'wr': (5.4, 3.0), 'tip': (11.5, 1.2), 'f1': (10.2, -3.4), 'f2': (7.0, -5.0), 'f3': (3.8, -4.6), 'hip': (0, -3.0)}
    if sweep:  # krídla zahnuté dozadu (pri útoku)
        pts = {k: (u, v - sweep * u / 11.5 * 3) for k, (u, v) in pts.items()}
    order = ['sh', 'wr', 'tip', 'f1', 'f2', 'f3', 'hip']
    outline = []
    for i, k in enumerate(order):
        outline.append(pts[k])
        if k in ('tip', 'f1', 'f2', 'f3'):  # vykrojenie blany medzi prstami (oblúčik k telu)
            n = pts[order[i + 1]]
            m = ((pts[k][0] + n[0]) / 2, (pts[k][1] + n[1]) / 2)
            outline.append((m[0] - 0.8, m[1] + 1.9))
    c, s = math.cos(flap), math.sin(flap)
    to3 = lambda uv: (side * (1.5 + uv[0] * c), uv[1], 0.5 + uv[0] * s)
    P = [to3(p) for p in outline]
    center = to3((3.5, -0.6))
    tris = [(center, P[i], P[(i + 1) % len(P)], 'wing') for i in range(len(P))]
    bones = [(to3(pts['sh']), to3(pts['wr'])), (to3(pts['wr']), to3(pts['tip'])), (to3(pts['wr']), to3(pts['f1'])),
             (to3(pts['wr']), to3(pts['f2'])), (to3(pts['wr']), to3(pts['f3']))]
    return tris, bones


def model(flap, lean=0.0, bite=False, sweep=0.0):
    """Netopier hlavou dopredu (+y), krídla doprava (+x) a doľava; flap = uhol krídel (+ hore)."""
    tris = ellipsoid((0, 0, 0), (2.0, 3.4, 1.9), 'fur')
    tris += ellipsoid((0, 4.0, 0.8), (2.2, 2.0, 2.0), 'fur')
    for sx in (1, -1):  # uši: vonkajšia strana srsť, vnútro ružové
        base1, base2, tip = (sx * 0.3, 4.0, 2.4), (sx * 2.1, 3.5, 1.6), (sx * 2.4, 4.0, 6.4)
        tris.append((base1, base2, tip, 'ear'))
        tris.append(((sx * 0.8, 4.4, 2.5), (sx * 1.8, 4.2, 2.1), (sx * 2.2, 4.4, 5.2), 'ear_in'))
    eyes = [((sx * 0.9, 5.75, 1.2), 'eye') for sx in (1, -1)]
    snout = [((0, 6.05, 0.5), 'fur')]
    extra = [((sx * 0.5, 5.6, -0.05), 'fang') for sx in (1, -1)] if bite else []
    if bite: extra.append(((0, 5.8, 0.1), 'mouth'))
    feet = [((sx * 0.8, -3.3, -1.4), 'bone') for sx in (1, -1)]
    if lean:  # predklon / vzpriamenie len tela s hlavou – krídla ostávajú v rovine letu (inak by ich spredu bolo vidieť zboku)
        tris = [(rot_x(a, lean), rot_x(b, lean), rot_x(c, lean), m) for a, b, c, m in tris]
        eyes = [(rot_x(p, lean), m) for p, m in eyes]; snout = [(rot_x(p, lean), m) for p, m in snout]
        extra = [(rot_x(p, lean), m) for p, m in extra]; feet = [(rot_x(p, lean), m) for p, m in feet]
    bones = []
    for side in (1, -1):
        t, bb = wing(side, flap, sweep)
        tris += t; bones += bb
    return tris, bones, eyes + snout + extra + feet


def project(p, ang):
    """Model → svet (smer letu ang: 0 = na východ, π/2 = na juh) → plátno; vráti (x, y, hĺbka – väčšia = bližšie)."""
    fx, fy = math.cos(ang), math.sin(ang)       # dopredu
    rx, ry = -fy, fx                             # vpravo (pri lete na východ je pravé krídlo na juhu)
    X = (p[0] * rx + p[1] * fx) * SC
    Y = (p[0] * ry + p[1] * fy) * SC
    Z = p[2] * SC
    sx = CX + X
    sy = CY + Y * math.cos(PITCH) - Z * math.sin(PITCH)
    depth = Y * math.sin(PITCH) + Z * math.cos(PITCH)
    return sx, sy, depth, (X, Y, Z)


UP = 0.35  # telo v lete mierne vzpriamené (hlava hore) – spredu je vidieť tvár a uši nad krídlami


def render(ang, flap, lean=UP, bite=False, sweep=0.0):
    tris, bones, dots = model(flap, lean, bite, sweep)
    zb = [[-1e9] * N for _ in range(N)]
    col = [['.'] * N for _ in range(N)]
    for a, b, c, mat in tris:
        A, B, C = project(a, ang), project(b, ang), project(c, ang)
        nw = norm(cross(sub(B[3], A[3]), sub(C[3], A[3])))
        view = (0, math.sin(PITCH), math.cos(PITCH))  # smer ku kamere
        if sum(x * y for x, y in zip(nw, view)) < 0: nw = tuple(-x for x in nw)  # blana je obojstranná
        lit = sum(x * y for x, y in zip(nw, LIGHT))
        x0, x1 = max(0, int(min(A[0], B[0], C[0]))), min(N - 1, int(max(A[0], B[0], C[0])) + 1)
        y0, y1 = max(0, int(min(A[1], B[1], C[1]))), min(N - 1, int(max(A[1], B[1], C[1])) + 1)
        den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
        if abs(den) < 1e-9: continue
        for py in range(y0, y1 + 1):
            for px in range(x0, x1 + 1):
                qx, qy = px + 0.5, py + 0.5
                w1 = ((B[1] - C[1]) * (qx - C[0]) + (C[0] - B[0]) * (qy - C[1])) / den
                w2 = ((C[1] - A[1]) * (qx - C[0]) + (A[0] - C[0]) * (qy - C[1])) / den
                w3 = 1 - w1 - w2
                if min(w1, w2, w3) < -0.001: continue
                z = w1 * A[2] + w2 * B[2] + w3 * C[2] + (0.02 if mat != 'wing' else 0)
                if z <= zb[py][px]: continue
                zb[py][px] = z
                if mat == 'ear_in': ch = RAMP['ear'][2 if lit > 0.3 else 1]
                elif mat == 'ear': ch = RAMP['fur'][1 if lit < 0.2 else 2]
                else:
                    r = RAMP[mat]
                    ch = r[max(0, min(len(r) - 1, int((lit + 0.35) / 1.25 * len(r))))]
                col[py][px] = ch
    # prsty krídel: tmavé kosti cez blanu (len kde je blana navrchu)
    for a, b in bones:
        A, B = project(a, ang), project(b, ang)
        steps = int(max(abs(B[0] - A[0]), abs(B[1] - A[1])) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            px, py = int(A[0] + (B[0] - A[0]) * t), int(A[1] + (B[1] - A[1]) * t)
            z = A[2] + (B[2] - A[2]) * t
            if 0 <= px < N and 0 <= py < N and col[py][px] in RAMP['wing'] and z >= zb[py][px] - 0.6:
                col[py][px] = RAMP['bone']
    # oči, papuľa, tesáky, pazúriky: bod, ak je viditeľný (nie za telom)
    for p, mat in dots:
        P = project(p, ang)
        px, py = int(P[0]), int(P[1])
        if 0 <= px < N and 0 <= py < N and P[2] >= zb[py][px] - 0.7:
            col[py][px] = {'eye': 'b', 'fang': 'f', 'mouth': 'h', 'fur': '0', 'bone': '8'}[mat]
    # osamotené pixely (žiadny vyplnený sused) preč – inak z nich obrys urobí krížik
    for y in range(N):
        for x in range(N):
            if col[y][x] != '.' and not any(0 <= x + dx < N and 0 <= y + dy < N and col[y + dy][x + dx] != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                col[y][x] = '.'
    # obrys: prázdne miesto vedľa kresby (4 susedia) = K; tenké výbežky (1 pixel) dostanú obrys tiež
    out = [r[:] for r in col]
    for y in range(N):
        for x in range(N):
            if col[y][x] != '.': continue
            if any(0 <= x + dx < N and 0 <= y + dy < N and col[y + dy][x + dx] != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    # osamotené pixely obrysu v rohoch (schodíky) – vyhladenie: K bez kresby v 4-susedstve a s menej než 2 K-susedmi preč
    return [''.join(r) for r in out]


DIRS = 8  # poradie hry: 0 vpravo (východ), 1 vpravo dole … 7 vpravo hore
FLAP = [62, 40, 5, -30, -14, 30]  # mávanie: hore, dole (rýchly záber), späť hore


def main():
    # smer d (0 = východ, 2 = juh, 6 = sever): netopier sa z profilu nečíta (krídla sú len čiarky), preto sa natočí
    # najviac o 40° od pohľadu spredu (juh) či zozadu (sever) – vpravo/vľavo letí šikmo, krídla sú stále vidieť
    YAW = {0: 50, 1: 65, 2: 90, 3: 115, 4: 130, 5: 245, 6: 270, 7: 295}
    ang = lambda d: math.radians(YAW[d])
    rot = [render(ang(d), math.radians(20)) for d in range(DIRS)]
    run = [[render(ang(d), math.radians(f)) for f in FLAP] for d in range(DIRS)]
    atk = [[render(ang(d), math.radians(72), lean=UP + 0.3, sweep=1.0),          # napriahnutie: vzpriami sa, krídla vysoko a dozadu
            render(ang(d), math.radians(-28), lean=UP - 0.55, bite=True),        # výpad: hlava dolu, papuľa otvorená
            render(ang(d), math.radians(30), lean=UP)] for d in range(DIRS)]     # návrat
    data = {'rot': rot, 'run': run, 'atk': atk, 'hd': True, 'pal': PAL}
    js = ["'use strict';",
          '// BAT_ART: netopier v jemnej kresbe (hra ho kreslí v polovičnej veľkosti) – vygenerované: tools/bat_art.py (3D model, natočený do 8 smerov) – ručne neupravovať.',
          '// rot: let v 8 smeroch (0 vpravo, 1 vpravo dole … 7 vpravo hore), run: mávanie krídlami 6 snímok, atk: napriahnutie, výpad s hryznutím, návrat',
          'const BAT_ART = %s;' % json.dumps(data, separators=(',', ':')).replace('],[', '],\n['), '']
    open(os.path.join(ROOT, 'www/js/bat-art.js'), 'w', encoding='utf8').write('\n'.join(js))
    if len(sys.argv) > 1:  # náhľad: riadky = smery, stĺpce = státie, mávanie, útok
        from PIL import Image
        Z = 6
        cols = 1 + len(FLAP) + 3
        im = Image.new('RGBA', (cols * N * Z, DIRS * N * Z), (70, 110, 60, 255))
        full = dict(PAL, K='#1c140e')
        for d in range(DIRS):
            for i, fr in enumerate([rot[d]] + run[d] + atk[d]):
                for y, row in enumerate(fr):
                    for x, ch in enumerate(row):
                        if ch == '.': continue
                        h = full[ch]
                        c = tuple(int(h[k:k + 2], 16) for k in (1, 3, 5)) + (255,)
                        for yy in range(Z):
                            for xx in range(Z):
                                im.putpixel((i * N * Z + x * Z + xx, d * N * Z + y * Z + yy), c)
        im.save(sys.argv[1])
    print('BAT_ART: %d smerov, mávanie %d snímok, útok %d snímky' % (DIRS, len(FLAP), 3))


main()
