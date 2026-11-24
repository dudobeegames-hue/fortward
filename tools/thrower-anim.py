"""Dorobí animácie orkského vrhača (obliehací stroj s ramenom a sudom horiacej smoly), keď má z PixelLabu len rotations/.

Jazda (Walk, 4 snímky): rám nad nápravou sa pohupuje o 1 px (hrbole), kolesá ostanú.
Výstrel (Attack, 4 snímky): sud s plameňom (oranžovo-žlté pixely plameňa + tmavý sud a obrys pri nich) sa zdvihne,
ako ho rameno vymršťuje (o 3 a 9 px), potom zmizne – ostane prázdny prak; protiváha (najväčší kus sivého kameňa/železa)
pri tom klesne o 1–3 px. V hre katapult strieľa len na sever a na juh, ostatné smery sú rovnaké.

Použitie: python tools/thrower-anim.py <priečinok so rotations/> <výstupný priečinok>
"""
import colorsys
import os
import shutil
import sys
from PIL import Image

DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
K = (28, 20, 14)


def hls(c):
    return colorsys.rgb_to_hls(*(v / 255 for v in c))


def flame(c):
    h, l, s = hls(c)
    return 0.02 <= h <= 0.17 and s > 0.6 and l > 0.42


def wood(c):
    h, l, s = hls(c)
    return 0.02 <= h <= 0.13 and s > 0.25 and 0.12 < l < 0.6


def greyish(c):
    h, l, s = hls(c)
    return s < 0.3 and 0.05 < l < 0.62 and c != K


def comp(seed, ok, W, H):
    out, q = set(seed), list(seed)
    while q:
        x, y = q.pop()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if n not in out and 0 <= n[0] < W and 0 <= n[1] < H and ok(*n):
                    out.add(n)
                    q.append(n)
    return out


def masks(im):
    W, H = im.size
    px = im.load()
    op = lambda x, y: px[x, y][3] >= 128
    fl = {(x, y) for y in range(H) for x in range(W) if op(x, y) and flame(px[x, y][:3])}
    barrel = set()
    if fl:
        cx = sum(x for x, y in fl) / len(fl)
        cy = sum(y for x, y in fl) / len(fl)
        near = lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= 9 ** 2
        barrel = comp(fl, lambda x, y: op(x, y) and near(x, y) and (flame(px[x, y][:3]) or greyish(px[x, y][:3]) or px[x, y][:3] == K), W, H)
        for _ in range(2):  # priľahlé laná a obrys (všetko okrem dreva rámu)
            barrel |= {(x + dx, y + dy) for x, y in barrel for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                       if 0 <= x + dx < W and 0 <= y + dy < H and op(x + dx, y + dy) and not wood(px[x + dx, y + dy][:3]) and (x + dx - cx) ** 2 + (y + dy - cy) ** 2 <= 10 ** 2}
    # protiváha: najväčší súvislý kus sivého kameňa/železa mimo suda
    grey = {(x, y) for y in range(H) for x in range(W) if op(x, y) and greyish(px[x, y][:3]) and (x, y) not in barrel}
    best, seen = set(), set()
    for p in grey:
        if p in seen:
            continue
        c = comp({p}, lambda x, y: (x, y) in grey, W, H)
        seen |= c
        if len(c) > len(best):
            best = c
    if len(best) < 15:
        best = set()
    else:  # aj tmavý obrys okolo protiváhy
        best |= {(x + dx, y + dy) for x, y in best for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                 if 0 <= x + dx < W and 0 <= y + dy < H and op(x + dx, y + dy) and px[x + dx, y + dy][:3] == K and (x + dx, y + dy) not in barrel}
    return barrel, best


def moved(im, parts):
    """parts: [(maska, dy alebo None = zmizne)] – časti sa vymažú a nakreslia posunuté; miesto po nich vo vnútri stroja
    sa dokreslí farbou susedného rámu (vodorovne najbližší pixel mimo masiek), mimo stroja ostane prázdne."""
    W, H = im.size
    out = im.copy()
    o = out.load()
    px = im.load()
    allm = set().union(*[m for m, _ in parts]) if parts else set()
    keep = lambda x, y: 0 <= x < W and px[x, y][3] == 255 and (x, y) not in allm  # len plné pixely (polopriehľadné okraje by dali zelenkastú výplň)
    for x, y in allm:
        sides = 0  # vo vnútri stroja = rám aspoň z troch strán (do 14 px)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if any(0 <= y + dy * k < H and keep(x + dx * k, y + dy * k) for k in range(1, 15)):
                sides += 1
        o[x, y] = (0, 0, 0, 0)
        if sides >= 3:  # farba najbližšieho pixelu rámu (v kruhu do 12 px)
            best = None
            for r in range(1, 13):
                for ddx in range(-r, r + 1):
                    for ddy in (-r, r) if abs(ddx) != r else range(-r, r + 1):
                        if 0 <= y + ddy < H and keep(x + ddx, y + ddy):
                            best = px[x + ddx, y + ddy]
                            break
                    if best:
                        break
                if best:
                    break
            if best:
                o[x, y] = best[:3] + (255,)
    for m, dy in parts:
        if dy is None:
            continue
        for x, y in m:
            ny = y + dy
            if 0 <= ny < H:
                o[x, ny] = px[x, y]
    return out


def bounce(im, down):
    if not down:
        return im.copy()
    W, H = im.size
    bb = im.split()[3].getbbox()
    axle = bb[3] - 10
    out = im.copy()
    out.paste(Image.new('RGBA', (W, axle), (0, 0, 0, 0)), (0, 0))
    out.alpha_composite(im.crop((0, 0, W, axle)), (0, down))
    return out


def main():
    src, dst = sys.argv[1], sys.argv[2]
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.makedirs(os.path.join(dst, 'rotations'))
    for d in DIRS:
        im = Image.open(os.path.join(src, 'rotations', d + '.png')).convert('RGBA')
        im.save(os.path.join(dst, 'rotations', d + '.png'))
        wd = os.path.join(dst, 'animations', 'Walk', d)
        os.makedirs(wd)
        for i, dn in enumerate([0, 1, 0, 1]):
            bounce(im, dn).save(os.path.join(wd, 'frame_%03d.png' % i))
        ad = os.path.join(dst, 'animations', 'Attack', d)
        os.makedirs(ad)
        barrel, cw = masks(im)
        for i, (bd, cd) in enumerate([(-3, 1), (-9, 2), (None, 3), (None, 2)]):
            moved(im, [(cw, cd), (barrel, bd)]).save(os.path.join(ad, 'frame_%03d.png' % i))
        print(d, 'sud px:', len(barrel), 'protiváha px:', len(cw))


if __name__ == '__main__':
    main()
