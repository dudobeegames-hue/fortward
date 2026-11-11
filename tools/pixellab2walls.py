"""Hradby z PixelLabu: zo vzorky rovnej hradby (jedno políčko, opakuje sa vedľa seba) poskladá 16 variantov podľa susedov.

Použitie: python tools/pixellab2walls.py <výstup.js> <MENO_KONŠTANTY> <rovná hradba úrovne 1> [<úrovne 2> …]
Súbor W*.png = hrubá hradba s ochodzou (zvislý úsek sa poskladá z nej, rohy a konce = vežička WT*.png vedľa nej, inak poskladaná), H*.png = stará plochá stena.
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


# ---- hrubá hradba s ochodzou (W*.png): vzadu kolová stena, v strede doskový chodník, vpredu čelo ----
def thick_rows(s):
    """riadky vzorky: vrch zadnej steny, zábradlie (tmavý riadok nad chodníkom), chodník, čelo"""
    a = s.split()[3]
    dark = lambda y: sum(1 for x in range(32) if a.getpixel((x, y)) and sum(s.getpixel((x, y))[:3]) < 140)
    full = lambda y: all(a.getpixel((x, y)) for x in range(32))
    from collections import Counter
    uni = lambda y: Counter(s.getpixel((x, y))[:3] for x in range(32)).most_common(1)[0][1]
    rail = next(y for y in range(s.height) if full(y) and uni(y) >= 24)      # pás pod hrotmi / zubmi zadnej steny (plný, jednej farby – tmavý aj zlatý)
    walk0 = rail + 1
    ink = lambda y: sum(1 for x in range(32) if a.getpixel((x, y)) and sum(s.getpixel((x, y))[:3]) <= 64)
    face = next(y for y in range(walk0 + 2, s.height) if ink(y) >= 6)       # prvý riadok hrotov / zubov čela (obrysová farba; tmavý kameň chodníka sa nepočíta)
    return rail, walk0, face


def thick_parts(s):
    rail, walk0, face = thick_rows(s)
    walk = s.crop((0, walk0, 32, face))                       # doskový chodník (opakuje sa)
    wd = sorted({walk.getpixel((x, y))[:3] for x in range(32) for y in range(walk.height) if walk.getpixel((x, y))[3]}, key=sum)
    for y in range(walk.height if is_wood(s) else 0):          # drevený chodník bez tmavých klincov (kameň ostáva)
        for x in range(32):
            c = walk.getpixel((x, y))
            if c[3] and sum(c[:3]) < 150: walk.putpixel((x, y), wd[[sum(k) for k in wd].index(next(sum(k) for k in wd if sum(k) >= 150))] + (255,))
    tips = s.crop((0, 0, 32, walk0))                          # zadná kolová stena s hrotmi
    front = s.crop((0, face, 32, s.height))                   # čelo hradby (kolová stena smerom k hradu)
    return tips, walk, front, rail, walk0, face


def outline(p):
    a = p.split()[3]
    q = p.copy()
    for y in range(p.height):
        for x in range(p.width):
            if a.getpixel((x, y)) == 0 and any(0 <= x + dx < p.width and 0 <= y + dy < p.height and a.getpixel((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                q.putpixel((x, y), OUT)
    return q


def stake_piece(s):
    """jeden kôl palisády pri pohľade zhora: hrot a kus čela, farby zo vzorky (od najsvetlejšej po najtmavšiu)"""
    rail = thick_rows(s)[0]                     # farby len z hrotov zadnej steny (kôl, nie kameň chodníka či čela)
    cols = sorted({s.getpixel((x, y))[:3] for x in range(32) for y in range(rail) if s.getpixel((x, y))[3]}, key=sum, reverse=True)
    wood = [c for c in cols if sum(c) > 150]
    L, M, D, DD = wood[0], wood[1], wood[len(wood) // 2], wood[-1]
    rows = ['.oLo.', 'oLLMo', 'oLMDo', 'oMDDo', 'oDDXo', 'ooooo']
    pc = {'L': L, 'M': M, 'D': D, 'X': DD, 'o': OUT[:3]}
    im = Image.new('RGBA', (5, len(rows)))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': im.putpixel((x, y), pc[ch] + (255,))
    return im


def vstakes(s, h, flip=False):
    """zvislý rad kolov (pohľad zhora): kôl za kôlom po 3 px, vyčnievajú nad chodník"""
    st = stake_piece(s)
    if flip: st = st.transpose(Image.FLIP_LEFT_RIGHT)
    col = Image.new('RGBA', (6, h + st.height))
    for i, y in enumerate(range(0, h + 1, 3)):
        col.alpha_composite(st, (i % 2, y))
    return col


def is_wood(s):
    rail = thick_rows(s)[0]
    px = [s.getpixel((x, y)) for x in range(32) for y in range(rail) if s.getpixel((x, y))[3] and sum(s.getpixel((x, y))[:3]) > 150]
    return sum(1 for c in px if c[0] > c[2] + 20) > len(px) // 2


def vmerlons(s, h):
    """zvislý rad zubov cimburia (kamenné hradby): zub zo zadného radu vzorky, za ním medzera"""
    rail = thick_rows(s)[0]
    a = s.split()[3]
    x0 = next(x for x in range(32) if a.getpixel((x, 1)) and (x == 0 or not a.getpixel((x - 1, 1))))
    x1 = next(x for x in range(x0, 32) if not a.getpixel((x, 1)))
    mw = x1 - x0
    mer = s.crop((x0, 0, x1, rail))
    if mw != 6: mer = mer.resize((6, rail), Image.NEAREST)
    col = Image.new('RGBA', (6, h + rail))
    for y in range(0, h + 1, rail + 2):
        col.alpha_composite(mer, (0, y))
    return col


def thick_variants(s, cx=16, tower=None, nt=(7, 11, 13, 14, 15)):   # T-spoje a kríženia bez vežičky (hradby sa len prekrížia; blok hradieb nie je plný vežičiek)
    STR = {5, 10} | set(nt)                       # bez vežičky: rovné úseky (+ voliteľne T-spoje a kríženia)
    tips, walk, front, rail, walk0, face = thick_parts(s)
    sh = s.height
    wood = is_wood(s)
    oy = FOOT - sh                                 # vodorovná vzorka: päta čela na FOOT
    wy0, wy1 = oy + walk0, oy + face               # chodník vodorovného úseku v sprite
    VW = 22                                        # šírka zvislého úseku (koly z oboch strán, chodník v strede)
    TW = tower.width if tower is not None else VW
    tc = max(TW // 2, min(W - TW // 2, cx))           # stred vežičky – zvislý úsek ide presne pod ňou
    out = []
    for m in range(16):
        N, E, S, Wn = m & 1, m & 2, m & 4, m & 8
        im = Image.new('RGBA', (W, H))
        vx = max(0, min(W - VW, tc - VW // 2))
        if N or S:
            top = (FOOT + 2 - tower.height // 2 - 32 + 6 if tower is not None else 0) if N else wy0 - 3   # zhora kúsok pod polovicou vežičky vyššieho políčka (hradba vchádza do veže, nie ako vyššie poschodie)
            bot = H if S else wy1
            if tower is not None and m not in STR:        # pod vežičkou: zvislý úsek len od jej stredu (nevytŕča spod šikmých rohov)
                tmid = FOOT + 2 - tower.height // 2
                if not N: top = tmid
                if not S: bot = tmid
            cut = None
            if N and tower is not None:                               # horný okraj do V podľa spodných hrán vežičky vyššieho políčka (kopíruje steny veže)
                ta = tower.split()[3]
                tbot = [max([y for y in range(tower.height) if ta.getpixel((x, y))] or [tower.height - 1]) for x in range(tower.width)]
                tx = tc - tower.width // 2
                cut = [FOOT + 2 - tower.height + tbot[min(tower.width - 1, max(0, vx + bx - tx))] - tower.height // 2 + 6 - 32 for bx in range(VW)]
                top = max(0, min(cut))
            body = Image.new('RGBA', (VW, H))
            for y in range(top - (top % walk.height) - walk.height, bot, walk.height):   # chodník (dosky naprieč)
                body.alpha_composite(walk.crop((2, 0, 2 + VW, walk.height)), (0, y))
            body = body.crop((0, 0, VW, H))
            clip = Image.new('RGBA', (VW, H)); clip.alpha_composite(body.crop((0, top, VW, bot)), (0, top))
            body = clip
            plain = body.copy()                                       # samotný chodník bez kolov (na prechody v T-spojoch a kríženiach)
            sy = top - (0 if (N and tower is not None) or (not N and (Wn or E)) else 7)   # vetva T-spoja nevytŕča nad vodorovnú hradbu
            for flip, stx in ((False, 0), (True, VW - 6)):           # koly z oboch strán ako na vodorovnej hradbe
                hh = max(0, bot - sy - (0 if S else 7))
                body.alpha_composite(vstakes(s, hh, flip=flip) if wood else vmerlons(s, hh), (stx, sy))
            if not S and (tower is None or m in STR):             # čelo na južnom konci
                body.alpha_composite(front.crop((3, 0, 3 + VW, front.height)), (0, wy1))
            if cut:
                for bx in range(VW):
                    for y in range(0, max(0, cut[bx])): body.putpixel((bx, y), (0, 0, 0, 0))
            ob = outline(body)
            if cut:                                                   # bez obrysu na hornom okraji (nadväzuje na vežu či úsek nad ním)
                for bx in range(VW):
                    for y in range(0, max(0, cut[bx])): ob.putpixel((bx, y), (0, 0, 0, 0))
            elif N and top > 0:                                         # bez obrysu na hornej hrane (tam nadväzuje úsek z vyššieho políčka – inak tmavý šev)
                for x in range(VW):
                    if body.getpixel((x, top - 1))[3] == 0: ob.putpixel((x, top - 1), (0, 0, 0, 0))
            im.alpha_composite(ob, (vx, 0))
        if Wn or E:
            horiz = Image.new('RGBA', (W, H))
            if Wn: horiz.alpha_composite(s.crop((0, 0, cx, sh)), (0, oy))
            if E: horiz.alpha_composite(s.crop((cx, 0, 32, sh)), (cx, oy))
            im.alpha_composite(horiz)
            if (N or S) and m in STR and m not in (5, 10):          # T-spoj / kríženie: priechodné – chodníky sa spoja, koly a zuby neprekážajú
                if S:                                             # zvislá hradba nadol ide pred čelom vodorovnej (jej vrch, nie stena)
                    low = Image.new('RGBA', (VW, H)); low.alpha_composite(ob.crop((0, wy1, VW, H)), (0, wy1))
                    im.alpha_composite(low, (vx, 0))
                r0, r1 = (oy if N else wy0), (H if S else wy1)
                inner = Image.new('RGBA', (VW - 12, H)); inner.alpha_composite(plain.crop((6, r0, VW - 6, r1)), (0, r0))
                im.alpha_composite(inner, (vx + 6, 0))               # chodník zvislej hradby cez zadný / predný rad kolov
                hw = s.crop((0, walk0, 32, face))                 # bočné koly zvislej hradby prerušené tam, kam vedie vodorovný chodník (jeho vlastné dosky / kameň)
                if Wn: im.alpha_composite(hw.crop((vx, 0, vx + 6, hw.height)), (vx, wy0))
                if E: im.alpha_composite(hw.crop((vx + VW - 6, 0, vx + VW, hw.height)), (vx + VW - 6, wy0))
        if (N or S) and (Wn or E) and S:                     # zvislá vetva nadol ide pred vodorovnú (bližšie k nám)
            pass
        if m not in STR and (Wn or E or (N and S) == 0):
            # rohová vežička: kus vzorky 16 px, o 6 px vyšší, s lanom
            if tower is not None:                             # vežička z PixelLabu (WTn.png): päta na päte hradby, stred nad zvislým úsekom
                im.alpha_composite(tower, (tc - tower.width // 2, FOOT + 2 - tower.height))
                out.append(im)
                continue
            px0 = vx
            t = Image.new('RGBA', (VW, sh + 6))
            t.alpha_composite(s.crop((0, 0, VW, walk0 + 2)), (0, 0))
            t.alpha_composite(s.crop((0, walk0 - 4, VW, sh)), (0, walk0 + 2))
            for x in range(VW):
                if t.getpixel((x, sh + 6 - 14))[3]: t.putpixel((x, sh + 6 - 14), ROPE if x % 3 else OUT)
            im.alpha_composite(outline(t), (px0, FOOT + 2 - t.height))
        out.append(im)
    return out


def main():
    out, name, paths = sys.argv[1], sys.argv[2], sys.argv[3:]
    pal, levels, thick, gates = [], [], [], []
    for p in paths:
        rows_lv = []
        thick.append(1 if os.path.basename(p).upper().startswith('W') else 0)
        tw = None
        if thick[-1]:                                         # k W1.png vežička WT1.png (roh a koniec hradby), ak je
            tp = os.path.join(ROOT, os.path.dirname(p), 'WT' + os.path.basename(p)[1:])
            if os.path.exists(tp):
                tw = Image.open(tp).convert('RGBA'); tw = tw.crop(tw.split()[3].getbbox())
        vf = (lambda sm, cx: thick_variants(sm, cx, tw)) if thick[-1] else variants
        for im in [v for cx in SIDES for v in vf(sample(p), cx)]:
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
        gp = os.path.join(ROOT, os.path.dirname(p), 'G' + os.path.basename(p)[1:])
        if thick[-1] and os.path.exists(gp):                   # brána Gn.png: vodorovný úsek hradby s bránou, v tom istom ráme ako Wn.png
            graw = Image.open(gp).convert('RGBA')
            wraw = Image.open(os.path.join(ROOT, p)).convert('RGBA')
            dy = FOOT - wraw.split()[3].getbbox()[3]             # spodok hradby na FOOT, brána posunutá rovnako (ostane v ráme PixelLabu)
            gi = Image.new('RGBA', (W, H)); gi.alpha_composite(graw.crop((0, max(0, -dy), 32, graw.height)), (0, max(0, dy)))
            ga = gi.split()[3]
            tops = [min([y for y in range(H) if ga.getpixel((x, y))] or [H]) for x in range(W)]
            fl = [min(range(4, 14), key=lambda x: (tops[x], abs(x - 7))), min(range(18, 28), key=lambda x: (tops[x], abs(x - 24)))]   # vlajočky na najvyšších bodoch pri bráne (stĺpy / vežičky), nie na okrajoch hradby
            gates.append({'rows': [''.join('.' if gi.getpixel((x, y))[3] < 128 else CHARS[pal.index('#%02x%02x%02x' % gi.getpixel((x, y))[:3])] if ('#%02x%02x%02x' % gi.getpixel((x, y))[:3]) in pal or pal.append('#%02x%02x%02x' % gi.getpixel((x, y))[:3]) is None else '' for x in range(W)) for y in range(H)],
                          'flags': [[x, tops[x]] for x in fl]})
            print('%s: brána, vlajočky %s' % (gp, gates[-1]['flags']))
        else:
            gates.append(None)
    js = ["'use strict';",
          '// %s: hradby z PixelLabu, jemná kresba. Vygenerované: tools/pixellab2walls.py – ručne neupravovať.' % name,
          '// lv[úroveň][maska susedov N=1 E=2 S=4 W=8 + 16 × strana] = riadky znakov (znak = index v pal, \'.\' = priehľadné);',
          '// strana 0 = zvislý úsek v strede políčka, 1 = pri ľavom okraji (vľavo od hradu), 2 = pri pravom okraji (vpravo od hradu)',
          '// gate[úroveň] = {rows: brána v ráme hradby, flags: [[x, y] vrcholy pre vlajočky v px]} alebo null',
          'const %s = %s;' % (name, json.dumps({'chars': ''.join(CHARS[:len(pal)]), 'pal': pal, 'thick': thick, 'gate': gates, 'lv': levels}, separators=(',', ':')).replace('],[', '],\n[')), '']
    open(os.path.join(ROOT, out), 'w', encoding='utf8').write('\n'.join(js))
    print('%s: %d úrovní, %d farieb' % (name, len(levels), len(pal)))


if __name__ == '__main__':
    main()
