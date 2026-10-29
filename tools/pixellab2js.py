"""Prevod postavy z PixelLabu (postavy/<priečinok>) do JS súboru s riadkami znakov palety PAL.

Použitie: python tools/pixellab2js.py <priečinok> <MENO_KONŠTANTY> <výstup.js> [snímky útoku, napr. 2,3,4]
Priečinok má rotations/<smer>.png a animations/Running*/<smer>/frame_*.png, animations/Attack*/<smer>/frame_*.png
(plátno 32×32, 8 smerov). Farby mimo palety PAL sa nahradia najbližšou (v priestore Lab).
Výstup: { rot: [8 smerov], run: [8][4 snímky], atk: [8][3 snímky] }, smery v poradí hry (0 vpravo, 1 vpravo dole … 7 vpravo hore).
Plátno sa oreže pod chodidlami tak, aby pod nimi ostalo U8_PB = 4 prázdnych riadkov ako pri ostatných jednotkách.
"""
import glob
import json
import os
import re
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
PB = 4

src = open(os.path.join(ROOT, 'www/js/sprites.js'), encoding='utf8').read()
pal = dict(re.findall(r"(\w): '(#[0-9a-f]{6})'", src.split('const PAL = {')[1].split('};')[0]))
EXACT = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)): k for k, h in pal.items()}


def lab(c):
    def f(v):
        v /= 255
        return ((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92
    r, g, b = map(f, c)
    x, y, z = (r * .4124 + g * .3576 + b * .1805) / .9505, r * .2126 + g * .7152 + b * .0722, (r * .0193 + g * .1192 + b * .9505) / 1.089
    h = lambda t: t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    return 116 * h(y) - 16, 500 * (h(x) - h(y)), 200 * (h(y) - h(z))


PL = {k: lab(c) for c, k in EXACT.items()}
off = 0


def char(c):
    global off
    if c in EXACT: return EXACT[c]
    off += 1
    L = lab(c)
    return min(PL, key=lambda k: sum((a - b) ** 2 for a, b in zip(L, PL[k])))


def load(path):
    im = Image.open(path).convert('RGBA')
    return [''.join('.' if im.getpixel((x, y))[3] < 128 else char(im.getpixel((x, y))[:3]) for x in range(im.width)) for y in range(im.height)]


def main():
    folder, name, out = sys.argv[1:4]
    atk_pick = [int(i) for i in (sys.argv[4] if len(sys.argv) > 4 else '2,3,4').split(',')]
    base = os.path.join(ROOT, 'postavy', folder)
    anim = lambda pat, d: sorted(glob.glob(os.path.join(base, 'animations', pat, d, 'frame_*.png')))
    rot = [load(os.path.join(base, 'rotations', d + '.png')) for d in DIRS]
    run = [[load(f) for f in anim('Running*', d)] for d in DIRS]
    atk = [[load(f) for f in anim('Attack*', d)] for d in DIRS]
    atk = [[a[i] for i in atk_pick] for a in atk]
    # chodidlá = najspodnejší riadok státia smerom dole; pod nimi PB prázdnych riadkov
    feet = max(y for y, r in enumerate(rot[2]) if r.strip('.'))
    H = feet + 1 + PB
    crop = lambda fr: fr[:H]
    data = {'rot': [crop(f) for f in rot], 'run': [[crop(f) for f in d] for d in run], 'atk': [[crop(f) for f in d] for d in atk]}
    js = ["'use strict';",
          '// %s: postava z PixelLabu (postavy/%s) v palete PAL, každý znak = 1 pixel. Vygenerované: tools/pixellab2js.py – ručne neupravovať.' % (name, folder),
          '// rot: státie v 8 smeroch (0 vpravo, 1 vpravo dole … 7 vpravo hore), run: chôdza 4 snímky, atk: úder 3 snímky (napriahnutie, švih, dokončenie)',
          'const %s = %s;' % (name, json.dumps(data, separators=(',', ':')).replace('],[', '],\n[')), '']
    open(os.path.join(ROOT, out), 'w', encoding='utf8').write('\n'.join(js))
    print('%s: %dx%d, run %s, atk %s, pixelov mimo palety: %d' % (name, len(rot[0][0]), H, [len(d) for d in run], [len(d) for d in atk], off))


main()
