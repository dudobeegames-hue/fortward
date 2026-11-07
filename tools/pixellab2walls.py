"""Hradby z PixelLabu: zo vzorky rovnej hradby (jedno políčko, opakuje sa vedľa seba) poskladá 16 variantov podľa susedov.

Použitie: python tools/pixellab2walls.py <výstup.js> <MENO_KONŠTANTY> <rovná hradba úrovne 1> [<úrovne 2> …]
Bitmaska susedov ako v hre: N=1 E=2 S=4 W=8. Sprite má 32×64 px (v hre 16×32 bodov, jemná kresba), spodok je 2 body pod políčkom.
Každý variant je trikrát: zvislý úsek a pilier v strede políčka, pri jeho ľavom a pri pravom okraji.
Zvislý úsek = úzky rad brvien zo vzorky radený za sebou (každé o 4 px vyššie), roh a koniec = pilier zo vzorky o kus vyšší (drevo previazané lanom).
"""
import glob
import json
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHARS = [chr(c) for c in range(33, 127) if chr(c) not in '."\'\\`']
W, H = 32, 64
TILE_TOP, FOOT = 28, 56   # horný okraj políčka v sprite, päta hradby (vodorovná aj zvislá)
GOLD_TO_STONE = {(248, 220, 104): (238, 238, 242), (224, 176, 48): (220, 220, 226), (176, 126, 28): (164, 164, 176), (122, 82, 16): (128, 128, 142), (74, 46, 8): (92, 92, 108)}  # zlato lvl5 -> biely kameň
OUT, ROPE = (0x1c, 0x14, 0x0e, 255), (0x3e, 0x26, 0x14, 255)


def sample(path):
    im = Image.open(sorted(glob.glob(os.path.join(ROOT, path)))[0]).convert('RGBA')
    im = im.crop(im.split()[3].getbbox())
    assert im.width == 32, 'vzorka hradby má mať šírku jedného políčka (32 px), má %d' % im.width
    return im


def log_strip(s, w=7):
    """kus vzorky široký w px s obrysom vpravo – jeden rad zvislej palisády (rady sa kladú za seba)"""
    lg = Image.new('RGBA', (w + 1, s.height))
    lg.alpha_composite(s.crop((0, 0, w, s.height)))
    for y in range(s.height):                   # zvislý úsek bez zlata (zlaté hlavice zubov by sa radili za sebou do pásu)
        for x in range(w):
            c = lg.getpixel((x, y))
            if c[3] and c[:3] in GOLD_TO_STONE:
                lg.putpixel((x, y), GOLD_TO_STONE[c[:3]] + (255,))
    for y in range(s.height):
        if lg.getpixel((w - 1, y))[3]:
            lg.putpixel((w, y), OUT)
    return lg


def pillar(s):
    """zväzok kolov: 10 px zo vzorky, o 8 riadkov dlhší, s dvoma lanami a obrysom"""
    top = lambda x0: sum(s.getpixel((x, y))[3] > 0 for x in range(x0, x0 + 10) for y in range(4))
    x0 = max(range(s.width - 9), key=top)        # pilier tam, kde je vrch najplnší (celý zub cimburia)
    src = s.crop((x0, 0, x0 + 10, s.height))
    ext = 8
    p = Image.new('RGBA', (12, s.height + ext + 4))
    body = Image.new('RGBA', (10, s.height + ext))
    body.alpha_composite(src.crop((0, 0, 10, 14)), (0, 0))
    body.alpha_composite(src.crop((0, 6, 10, 14)), (0, 14))
    body.alpha_composite(src.crop((0, 14, 10, s.height)), (0, 14 + ext))
    p.alpha_composite(body, (1, 0))
    mid = [s.getpixel((x, s.height // 2)) for x in range(s.width)]
    wood = sum(1 for c in mid if c[3] and c[0] > c[2] + 20) > len(mid) // 2   # drevená palisáda: zväzok previazaný lanom
    for ry in ((12, 26) if wood else ()):       # laná
        for x in range(1, 11):
            p.putpixel((x, ry), ROPE if x % 3 else OUT)
    a = p.split()[3]
    for y in range(p.height):                   # obrys okolo
        for x in range(p.width):
            if a.getpixel((x, y)) == 0 and any(0 <= x + dx < p.width and 0 <= y + dy < p.height and a.getpixel((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                p.putpixel((x, y), OUT)
    return p.crop(p.split()[3].getbbox())


SIDES = (16, 6, 26)  # stred zvislého úseku a piliera: v strede políčka, pri ľavom okraji (vľavo od hradu), pri pravom (vpravo od hradu)


def variants(s, cx=16):
    lg, pl = log_strip(s), pillar(s)
    vx = cx - lg.width // 2
    out = []
    for m in range(16):
        N, E, S, Wn = m & 1, m & 2, m & 4, m & 8
        im = Image.new('RGBA', (W, H))
        feet = []
        if N: feet += range(TILE_TOP + 4, FOOT, 4)            # brvná od horného okraja políčka k stredu
        if S: feet += range(FOOT + 4, H + 1, 4)               # a od stredu dolu k ďalšiemu políčku
        if N and S: feet.append(FOOT)
        for f in sorted(feet):                                # zozadu dopredu
            im.alpha_composite(lg, (vx, f - lg.height))
        if Wn: im.alpha_composite(s.crop((0, 0, cx, s.height)), (0, FOOT - s.height))        # rameno k ľavému susedovi
        if E: im.alpha_composite(s.crop((cx, 0, 32, s.height)), (cx, FOOT - s.height))       # a k pravému (vzorka sa opakuje po 32 px)
        straight = m in (5, 10)
        if not straight:
            im.alpha_composite(pl, (max(0, min(W - pl.width, cx - pl.width // 2)), FOOT + 2 - pl.height))
        if S and not straight:                                # brvná pred pilierom (bližšie k nám)
            for f in range(FOOT + 4, H + 1, 4):
                im.alpha_composite(lg, (vx, f - lg.height))
        out.append(im)
    return out


def main():
    out, name, paths = sys.argv[1], sys.argv[2], sys.argv[3:]
    pal, levels = [], []
    for p in paths:
        rows_lv = []
        for im in [v for cx in SIDES for v in variants(sample(p), cx)]:
            rows = []
            for y in range(H):
                r = ''
                for x in range(W):
                    px = im.getpixel((x, y))
                    if px[3] < 128: r += '.'; continue
                    col = '#%02x%02x%02x' % px[:3]
                    if col not in pal: pal.append(col)
                    r += CHARS[pal.index(col)]
                rows.append(r)
            rows_lv.append(rows)
        levels.append(rows_lv)
        print('%s: 3 × 16 variantov %dx%d px' % (p, W, H))
    js = ["'use strict';",
          '// %s: hradby z PixelLabu, jemná kresba. Vygenerované: tools/pixellab2walls.py – ručne neupravovať.' % name,
          '// lv[úroveň][maska susedov N=1 E=2 S=4 W=8 + 16 × strana] = riadky znakov (znak = index v pal, \'.\' = priehľadné);',
          '// strana 0 = zvislý úsek v strede políčka, 1 = pri ľavom okraji (vľavo od hradu), 2 = pri pravom okraji (vpravo od hradu)',
          'const %s = %s;' % (name, json.dumps({'chars': ''.join(CHARS[:len(pal)]), 'pal': pal, 'lv': levels}, separators=(',', ':')).replace('],[', '],\n[')), '']
    open(os.path.join(ROOT, out), 'w', encoding='utf8').write('\n'.join(js))
    print('%s: %d úrovní, %d farieb' % (name, len(levels), len(pal)))


if __name__ == '__main__':
    main()
