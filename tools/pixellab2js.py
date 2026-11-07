"""Prevod postavy z PixelLabu (postavy/<priečinok>) do JS súboru s riadkami znakov palety PAL.

Použitie: python tools/pixellab2js.py <priečinok> <MENO_KONŠTANTY> <výstup.js> [snímky útoku, napr. 2,3,4] [smer=snímky ...] [--hd] [--wide] [--all]
(--wide = státie sa doplní na väčšie plátno animácií namiesto orezania animácií)
(--hd = jemná kresba v dvojnásobnej mriežke, napr. plátno 48×48 alebo 64×64; hra ju kreslí v polovičnej veľkosti)
(snímky sa číslujú od 0; smer=snímky, napr. south=2,3, vyberie iné snímky pre jeden smer, keď sa v ňom generátor pomýlil)
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
    args = [a for a in sys.argv[1:] if a not in ('--hd', '--wide', '--all')]
    nrun = 99 if '--all' in sys.argv else 4  # --all = všetky snímky pohybu (napr. 5 snímok mávania sokola)
    wide = '--wide' in sys.argv  # väčšie plátno animácií: státie sa doplní na ich veľkosť (meč pri švihu sa neoreže)
    hd = '--hd' in sys.argv  # jemná kresba (dvojnásobná mriežka): hra ju kreslí v polovičnej veľkosti
    folder, name, out = args[:3]
    atk_pick = [int(i) for i in (args[3] if len(args) > 3 else '2,3,4').split(',')]
    own = {d: [int(i) for i in v.split(',')] for d, v in (a.split('=') for a in args[4:])}
    pb = PB * (2 if hd else 1)
    base = os.path.join(ROOT, 'postavy', folder)  # folder môže byť aj cesta, napr. ../Grafika/Ludia/postavy/lucisnik
    rot = [load(os.path.join(base, 'rotations', d + '.png')) for d in DIRS]
    rw, rh = len(rot[0][0]), len(rot[0])
    if wide:
        sizes = [Image.open(f).size for f in glob.glob(os.path.join(base, 'animations', '*', '*', 'frame_000.png'))]
        aw, ah = max(w for w, h in sizes), max(h for w, h in sizes)  # smery môžu mať rôzne plátna (48 aj 64) – najväčšie
        px, py = (aw - rw) // 2, (ah - rh) // 2
        rot = [['.' * aw] * py + ['.' * px + r + '.' * (aw - rw - px) for r in fr] + ['.' * aw] * (ah - rh - py) for fr in rot]
        rw, rh = aw, ah
    # animácie: Attack* = útok, prvá ďalšia = chôdza/klus (PixelLab ju pomenuje podľa zadania)
    names = sorted(os.listdir(os.path.join(base, 'animations')))
    is_atk = lambda n: 'attack' in n.lower()  # PixelLab pomenuje animáciu podľa zadania („Attack…“, „spear_thrust_attack…“)
    atk_dir = next((n for n in names if is_atk(n)), None)  # bez útoku: snímky útoku = státie (kým PixelLab útok nedorobí)
    run_dir = next(n for n in names if not is_atk(n))

    def frames(anim, d):
        fs = sorted(glob.glob(os.path.join(base, 'animations', anim, d, 'frame_*.png')))
        out = []
        for f in fs:  # animácie môžu mať väčšie plátno (68×68 pri 48×48) – stredný výrez veľkosti státia
            fr = load(f)
            if len(fr[0]) < rw:  # menšie plátno smeru ako ostatné: doplní sa okolo stredu
                px, py = (rw - len(fr[0])) // 2, (rh - len(fr)) // 2
                fr = ['.' * rw] * py + ['.' * px + r + '.' * (rw - len(r) - px) for r in fr] + ['.' * rw] * (rh - len(fr) - py)
            ox, oy = (len(fr[0]) - rw) // 2, (len(fr) - rh) // 2
            out.append([r[ox:ox + rw] for r in fr[oy:oy + rh]])
        return out

    def nearest(have, d):  # smer bez animácie dostane najbližší smer, ktorý ju má (pri zhode bočný – útok z boka mieri šikmo lepšie)
        i = DIRS.index(d)
        return min(have, key=lambda h: (min((DIRS.index(h) - i) % 8, (i - DIRS.index(h)) % 8), h not in ('east', 'west')))

    runs = {d: frames(run_dir, d) for d in DIRS}
    atks = {d: frames(atk_dir, d) if atk_dir else [rot[i]] * (max(atk_pick) + 1) for i, d in enumerate(DIRS)}
    have_run, have_atk = [d for d in DIRS if runs[d]], [d for d in DIRS if atks[d]]
    run = [runs[d if runs[d] else nearest(have_run, d)][:nrun] for d in DIRS]
    atk = [[atks[d if atks[d] else nearest(have_atk, d)][i] for i in own.get(d, atk_pick)] for d in DIRS]
    missing = [d for d in DIRS if not atks[d]] + [d for d in DIRS if not runs[d]]
    # chodidlá = najspodnejší riadok státia smerom dole; pod nimi PB prázdnych riadkov (pri hd dvojnásobok)
    feet = max(y for y, r in enumerate(rot[2]) if r.strip('.'))
    H = feet + 1 + pb
    top = ['.' * rw] if hd and H % 2 else []  # hd: párna výška (polovica = celé body hry), prázdny riadok navrch
    h0, H = H, H + len(top)
    crop = lambda fr: top + (fr + ['.' * rw] * h0)[:h0]
    data = {'rot': [crop(f) for f in rot], 'run': [[crop(f) for f in d] for d in run], 'atk': [[crop(f) for f in d] for d in atk]}
    if hd: data['hd'] = True
    js = ["'use strict';",
          '// %s: postava z PixelLabu (postavy/%s) v palete PAL, každý znak = 1 pixel%s. Vygenerované: tools/pixellab2js.py – ručne neupravovať.' % (name, folder, ', jemná kresba (hra ju kreslí v polovičnej veľkosti)' if hd else ''),
          '// rot: státie v 8 smeroch (0 vpravo, 1 vpravo dole … 7 vpravo hore), run: chôdza 4 snímky, atk: vybrané snímky útoku (%s z PixelLabu%s)%s' % (
              ', '.join(str(i + 1) for i in atk_pick), ''.join('; %s: %s' % (d, ', '.join(str(i + 1) for i in v)) for d, v in own.items()),
              '; bez vlastnej animácie (použitý najbližší smer): ' + ', '.join(missing) if missing else ''),
          'const %s = %s;' % (name, json.dumps(data, separators=(',', ':')).replace('],[', '],\n[')), '']
    open(os.path.join(ROOT, out), 'w', encoding='utf8').write('\n'.join(js))
    print('%s: %dx%d%s, run %s, atk %s, pixelov mimo palety: %d, chýba: %s' % (name, rw, H, ' hd' if hd else '', [len(d) for d in run], [len(d) for d in atk], off, missing))

main()
