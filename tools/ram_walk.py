"""Jazda baranidla: z kresieb státia (rotations) dokreslí 4 snímky otáčania kolies do animations/Walk/<smer>/frame_00N.png.
PixelLab pohyb stroja vygenerovať nevedel, preto sa kolesá prekresľujú tu: vnútro kolesa (špice) sa nakreslí
v 4 pootočeniach po 22,5°; pri pohľade spredu a zozadu (kolesá z hrany) sa po obruči posúva svetlá značka.
Použitie: python tools/ram_walk.py [priečinok stroja]
"""
import math
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
BASE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'Grafika', '1. Ludia', 'budovy', '5. obliehacie', 'baranidlo')
K, L, LL, D3, M, DK = (0x1c, 0x14, 0x0e), (0x6e, 0x44, 0x22), (0xa8, 0x6c, 0x38), (0x3e, 0x26, 0x14), (0x80, 0x86, 0x9a), (0x4a, 0x4e, 0x60)

# kolesá z boku a šikmo: stred, polosi vnútra (kde sú špice) a sklon osi špíc (šikmý pohľad má koleso sploštené)
E = [(14, 39.5, 2.9, 2.9), (36, 39.5, 2.9, 2.9)]
SE = [(11, 33.5, 2.2, 3.1), (26, 42.5, 2.2, 3.1)]
NE = [(44, 34, 2.2, 3.1), (29.5, 42.5, 2.2, 3.1)]
mir = lambda ws: [(55 - x, y, rx, ry) for x, y, rx, ry in ws]
WHEELS = {'east': E, 'west': mir(E), 'south-east': SE, 'south-west': mir(SE), 'north-east': NE, 'north-west': mir(NE)}
# kolesá z hrany (pohľad spredu a zozadu): stĺpec stredu obruče, prvý a posledný riadok
EDGE = {'south': [(15, 38, 45), (40, 38, 45)], 'north': [(15, 40, 47), (40, 40, 47)]}


def walk(d, f):
    im = Image.open(os.path.join(BASE, 'rotations', d + '.png')).convert('RGBA')
    px = im.load()
    for cx, cy, rx, ry in WHEELS.get(d, []):
        ph = f * math.pi / 8 * (-1 if 'west' in d else 1)  # smer otáčania podľa smeru jazdy
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                nx, ny = (x - cx) / rx, (y - cy) / ry
                r = math.hypot(nx, ny)
                if r > 1.02 or px[x, y][3] < 128: continue
                a = (math.atan2(ny, nx) - ph) % (math.pi / 2)
                off = min(a, math.pi / 2 - a) * r * max(rx, ry)  # vzdialenosť od najbližšej špice v pixeloch
                px[x, y] = (LL if r < 0.3 else L if off < 0.62 else K) + (255,)
    for col, y0, y1 in EDGE.get(d, []):
        n = y1 - y0 + 1
        for y in range(y0, y1 + 1): px[col, y] = L + (255,)
        s = 1 if d == 'south' else -1  # obruč sa valí smerom jazdy
        for k in (0, n // 2):  # dve značky oproti sebe
            y = y0 + (k + s * f * (n // 2) // 4) % n
            px[col, y] = M + (255,)
    return im


for d in ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']:
    out = os.path.join(BASE, 'animations', 'Walk', d)
    os.makedirs(out, exist_ok=True)
    for f in range(4): walk(d, f).save(os.path.join(out, 'frame_%03d.png' % f))
print('hotovo:', os.path.join(BASE, 'animations', 'Walk'))
