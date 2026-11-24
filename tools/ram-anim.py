"""Dorobí animácie obliehacieho baranidla z PixelLabu, keď má len rotations/ (státie v 8 smeroch).

Jazda (Walk, 4 snímky): horná časť stroja nad nápravou sa pohupuje o 1 px (hrbole), kolesá ostanú.
Úder (Attack, 3 snímky): železná hlava baranidla (sivomodré železo + kosti a obrys pri nej, len v prednej polovici stroja)
sa stiahne o 1 px, vyrazí o 3 px dopredu a ostane v náraze o 2 px; miesto po nej sa vyplní drevom kmeňa.
Keď hlavu v smere nevidno (sever), dopredu sa posunie celý stroj.

Použitie: python tools/ram-anim.py <priečinok so rotations/> <výstupný priečinok>
Výstup má rotations/ a animations/Walk|Attack/<smer>/frame_*.png ako export z PixelLabu (pre tools/pixellab2js.py).
"""
import colorsys
import os
import shutil
import sys
from PIL import Image

DIRS = {'east': (1, 0), 'south-east': (1, 0.6), 'south': (0, 1), 'south-west': (-1, 0.6),
        'west': (-1, 0), 'north-west': (-1, -0.6), 'north': (0, -1), 'north-east': (1, -0.6)}
K = (28, 20, 14)
WOOD = (62, 38, 20)  # tmavé drevo kmeňa na miesto po hlave


def iron(c):
    r, g, b = (v / 255 for v in c)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return b >= r - 0.02 and s < 0.35 and 0.06 < l < 0.6 and c != K


def bone(c):
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c))
    return l > 0.62 and s < 0.45


def head_mask(im, vec):
    W, H = im.size
    px = im.load()
    op = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] >= 128]
    if not op:
        return set()
    cx = sum(x for x, y in op) / len(op)
    cy = sum(y for x, y in op) / len(op)
    front = lambda x, y: (x - cx) * vec[0] + (y - cy) * vec[1] > 1  # predná polovica stroja
    cand = {(x, y) for x, y in op if iron(px[x, y][:3]) and front(x, y)}
    m, seen = set(), set()  # najväčší súvislý kus železa = hlava (nie obruče kolies)
    for p0 in cand:
        if p0 in seen:
            continue
        comp, q = set(), [p0]
        seen.add(p0)
        while q:
            x, y = q.pop()
            comp.add((x, y))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (x + dx, y + dy)
                    if n in cand and n not in seen:
                        seen.add(n)
                        q.append(n)
        if len(comp) > len(m):
            m = comp
    if len(m) < 12:
        return set()
    grow = lambda s, ok: s | {(x + dx, y + dy) for x, y in s for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                               if 0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] >= 128 and ok(px[x + dx, y + dy][:3])}
    for _ in range(3):
        m = grow(m, bone)  # kly a kostené ozdoby hlavy
    m = grow(m, lambda c: c == K)  # obrys hlavy
    return m


def shift_head(im, mask, vec, k):
    W, H = im.size
    out = im.copy()
    o = out.load()
    px = im.load()
    sx, sy = round(vec[0] * k), round(vec[1] * k)
    n = (vec[0] ** 2 + vec[1] ** 2) ** 0.5
    cx = sum(x for x, y in mask) / len(mask)
    cy = sum(y for x, y in mask) / len(mask)
    moved = {(x + sx, y + sy) for x, y in mask}
    for x, y in mask:
        if (x, y) in moved:
            continue
        o[x, y] = (0, 0, 0, 0)
        if k > 0:  # vysunutá hlava: za ňou kmeň (pás šírky kmeňa s obrysom), inde prázdno
            d = abs((x - cx) * -vec[1] + (y - cy) * vec[0]) / n
            if d <= 2.5:
                o[x, y] = WOOD + (255,)
            elif d <= 3.5:
                o[x, y] = K + (255,)
    for x, y in mask:
        nx, ny = x + sx, y + sy
        if 0 <= nx < W and 0 <= ny < H:
            o[nx, ny] = px[x, y]
    return out


def shift_all(im, vec, k):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (round(vec[0] * k), round(vec[1] * k)))
    return out


def bounce(im, down):
    if not down:
        return im.copy()
    W, H = im.size
    bb = im.split()[3].getbbox()
    axle = bb[3] - 10  # nad nápravou (spodných ~10 px sú kolesá)
    out = im.copy()
    top = im.crop((0, 0, W, axle))
    clear = Image.new('RGBA', (W, axle), (0, 0, 0, 0))
    out.paste(clear, (0, 0))
    out.alpha_composite(top, (0, down))
    return out


def main():
    src, dst = sys.argv[1], sys.argv[2]
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.makedirs(os.path.join(dst, 'rotations'))
    for d, vec in DIRS.items():
        im = Image.open(os.path.join(src, 'rotations', d + '.png')).convert('RGBA')
        im.save(os.path.join(dst, 'rotations', d + '.png'))
        wd = os.path.join(dst, 'animations', 'Walk', d)
        os.makedirs(wd)
        for i, dn in enumerate([0, 1, 0, 1]):
            bounce(im, dn).save(os.path.join(wd, 'frame_%03d.png' % i))
        ad = os.path.join(dst, 'animations', 'Attack', d)
        os.makedirs(ad)
        m = head_mask(im, vec)
        for i, k in enumerate([-1, 3, 2]):
            (shift_head(im, m, vec, k) if m else shift_all(im, vec, k * 0.7)).save(os.path.join(ad, 'frame_%03d.png' % i))
        print(d, 'hlava px:', len(m))


if __name__ == '__main__':
    main()
