"""Dokreslené animácie obliehacích strojov z PixelLabu (PixelLab pohyb stroja vygenerovať nevedel).
Z kresieb státia (rotations/<smer>.png) vyrobí:
  animations/Walk/<smer>/frame_00N.png - 4 snímky jazdy: špice kolies pootočené po 22,5 stupňa; pri pohľade spredu
                                         a zozadu (kolesá z hrany) sa po obruči posúva značka
  animations/Attack/north|south/...    - len katapult: výstrel (rameno do polovice, hore s prázdnou lyžicou, odraz, návrat)
Použitie: python tools/siege_anim.py [baranidlo|katapult]   (bez mena oba stroje)
"""
import math
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SIEGE = os.path.join(ROOT, 'Grafika', '1. Ludia', 'budovy', '5. obliehacie')
DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
K, L, LL, D3, M, N = (0x1c, 0x14, 0x0e), (0x6e, 0x44, 0x22), (0xa8, 0x6c, 0x38), (0x3e, 0x26, 0x14), (0x80, 0x86, 0x9a), (0x22, 0x33, 0x7a)
STONE = {(0x80, 0x86, 0x9a), (0xbc, 0xc0, 0xcc), (0x4a, 0x4e, 0x60), (0xf4, 0xf4, 0xf8)}


def mir(ws):
    return [(55 - x, y, rx, ry) for x, y, rx, ry in ws]


# kolesá z boku a šikmo: stred a polosi vnútra (kde sú špice); šikmý pohľad má koleso sploštené
RAM_E = [(14, 39.5, 2.9, 2.9), (36, 39.5, 2.9, 2.9)]
RAM_SE = [(11, 33.5, 2.2, 3.1), (26, 42.5, 2.2, 3.1)]
RAM_NE = [(44, 34, 2.2, 3.1), (29.5, 42.5, 2.2, 3.1)]
CAT_E = [(15.5, 41.5, 3.4, 3.4), (40.5, 41.5, 3.4, 3.4)]
SPECS = {
    'baranidlo': {
        'wheels': {'east': RAM_E, 'west': mir(RAM_E), 'south-east': RAM_SE, 'south-west': mir(RAM_SE), 'north-east': RAM_NE, 'north-west': mir(RAM_NE)},
        # kolesá z hrany: stĺpce obruče (od, do), prvý a posledný riadok
        'edge': {'south': [(15, 15, 38, 45), (40, 40, 38, 45)], 'north': [(15, 15, 40, 47), (40, 40, 40, 47)]},
        'flat': True,
    },
    'katapult': {
        'wheels': {'east': CAT_E, 'west': CAT_E,
                   'south-east': [(11, 33, 2.2, 3.1), (26, 44.5, 2.2, 3.1)], 'south-west': [(45, 33, 2.2, 3.1), (29.5, 44.5, 2.2, 3.1)],
                   'north-east': [(43.5, 33.5, 2.2, 3.1), (29, 43, 2.2, 3.1)], 'north-west': [(12, 34, 2.2, 3.1), (26.5, 43, 2.2, 3.1)]},
        'edge': {'south': [(14, 15, 20, 29), (42, 43, 20, 29), (14, 15, 38, 47), (42, 43, 38, 47)],
                 'north': [(14, 15, 23, 31), (42, 43, 23, 31), (14, 15, 39, 47), (42, 43, 39, 47)]},
    },
}


def walk(name, d, f):
    sp = SPECS[name]
    im = Image.open(os.path.join(SIEGE, name, 'rotations', d + '.png')).convert('RGBA')
    px = im.load()
    for cx, cy, rx, ry in sp['wheels'].get(d, []):
        ph = f * math.pi / 8 * (-1 if 'west' in d else 1)  # smer otáčania podľa smeru jazdy
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                nx, ny = (x - cx) / rx, (y - cy) / ry
                r = math.hypot(nx, ny)
                if r > 1.02 or px[x, y][3] < 128:
                    continue
                a = (math.atan2(ny, nx) - ph) % (math.pi / 2)
                off = min(a, math.pi / 2 - a) * r * max(rx, ry)  # vzdialenosť od najbližšej špice v pixeloch
                px[x, y] = (LL if r < 0.3 else L if off < 0.62 else K) + (255,)
    for c0, c1, y0, y1 in sp['edge'].get(d, []):
        n, s = y1 - y0 + 1, 1 if d == 'south' else -1  # obruč sa valí smerom jazdy
        if sp.get('flat'):
            for y in range(y0, y1 + 1):
                px[c0, y] = L + (255,)
        for k in (0, n // 2):  # dve značky oproti sebe
            y = y0 + (k + s * f * (n // 2) // 4) % n
            for x in range(c0, c1 + 1):
                px[x, y] = (M if sp.get('flat') else K) + (255,)
    return im


def hollow(p, x, y, empty):
    """Prázdna lyžica: kameň nahradí tmavé drevo."""
    return D3 + (255,) if empty and p[:3] in STONE else p


def cat_fire(d, f):
    """Výstrel katapultu: f 0 = rameno v polovici s balvanom, 1 = hore (lyžica prázdna, balvan letí), 2 = odraz, 3 = návrat prázdneho ramena."""
    im = Image.open(os.path.join(SIEGE, 'katapult', 'rotations', d + '.png')).convert('RGBA')
    px = im.load()
    empty = f > 0
    if d == 'south':  # stroj mieri k nám: lyžica je vzadu (hore), pri výstrele vyletí vyššie nad priečku
        up = [3, 5, 4, 2][f]
        blk = im.crop((22, 6, 36, 17))
        for y in range(6, 17):
            for x in range(22, 36):
                px[x, y] = (0, 0, 0, 0)
        for y in range(17 - up, 17):  # predĺžené rameno pod lyžicou
            for x, c in zip(range(27, 31), (K, LL, LL, K)):
                px[x, y] = c + (255,)
        bp = blk.load()
        for y in range(blk.height):
            for x in range(blk.width):
                if bp[x, y][3] >= 128:
                    px[22 + x, 6 + y - up] = hollow(bp[x, y], x, y, empty)
        return im
    # sever: stroj mieri od nás, lyžica je vpredu dole; rameno sa zdvihne a udrie do priečky hore
    rows = {40: (25, 32), 41: (25, 32), 42: (24, 33), 43: (24, 33), 44: (24, 33), 45: (24, 33), 46: (24, 33), 47: (25, 32), 48: (26, 31), 49: (27, 30)}
    stamp = {(x, y): px[x, y] for y, (a, b) in rows.items() for x in range(a, b + 1)}
    for x in (25, 32):
        stamp[(x, 41)] = K + (255,)  # okraj lyžice bez trámu pod ňou
    fill = {39: (27, 30, None), 40: (25, 32, None), 41: (25, 32, K), 42: (24, 33, L), 43: (24, 33, N), 44: (24, 33, N), 45: (24, 33, K),
            46: (24, 33, None), 47: (25, 32, None), 48: (26, 31, None), 49: (27, 30, None)}
    for y, (a, b, c) in fill.items():  # zadný trám bez lyžice
        for x in range(a, b + 1):
            px[x, y] = (c + (255,)) if c else (0, 0, 0, 0)
    up = [17, 31, 30, 17][f]
    for (x, y), p in stamp.items():
        if p[3] >= 128:
            px[x, y - up] = hollow(p, x, y, empty)
    return im


def build(name):
    for d in DIRS:
        out = os.path.join(SIEGE, name, 'animations', 'Walk', d)
        os.makedirs(out, exist_ok=True)
        for f in range(4):
            walk(name, d, f).save(os.path.join(out, 'frame_%03d.png' % f))
    if name == 'katapult':
        for d in ('north', 'south'):
            out = os.path.join(SIEGE, name, 'animations', 'Attack', d)
            os.makedirs(out, exist_ok=True)
            for f in range(4):
                cat_fire(d, f).save(os.path.join(out, 'frame_%03d.png' % f))
    print('hotovo:', name)


for n in sys.argv[1:] or list(SPECS):
    build(n)
