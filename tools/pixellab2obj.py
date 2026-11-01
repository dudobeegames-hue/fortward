"""Prevod budovy (objektu) z PixelLabu do JS súboru pre hru – jemná kresba (dvojnásobná mriežka, hra ju kreslí v polovičnej veľkosti).

Použitie: python tools/pixellab2obj.py <výstup.js> <MENO_KONŠTANTY> <obrázok úrovne 1> [<obrázok úrovne 2> …]
Cesty k obrázkom sú od koreňa projektu, napr. Grafika/Ludia/budovy/veze/1_AT/1/rotations/*.png (hviezdička = jediný súbor v priečinku).
Každá úroveň sa oreže na kresbu (bez prázdneho okraja; pri rovnakom plátne všetky spoločným rámom) a doplní na párny rozmer, aby jej polovica bola v celých bodoch hry;
spodok kresby je päta budovy (hra ju postaví na spodok políčka). Farby sa neobmedzujú na PAL – budovy majú vlastné odtiene,
uloží sa spoločná paleta všetkých úrovní a riadky znakov (každý znak = index farby, '.' = priehľadné).
"""
import glob
import json
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHARS = [chr(c) for c in range(33, 127) if chr(c) not in '."\'\\`']


def main():
    out, name, paths = sys.argv[1], sys.argv[2], sys.argv[3:]
    pal, levels = [], []
    files = [sorted(glob.glob(os.path.join(ROOT, p)))[0] for p in paths]
    ims = [Image.open(f).convert('RGBA') for f in files]
    boxes = [im.split()[3].getbbox() for im in ims]
    if len({im.size for im in ims}) == 1:  # rovnaké plátno: spoločný rám, aby úrovne pri vylepšení neposkočili
        u = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        cw = ims[0].size[0]  # vodorovne súmerne okolo stredu plátna: budova ostane na políčku, aj keď z nej niečo trčí do strany
        m = min(u[0], cw - u[2])
        u = (m, u[1], cw - m, u[3])
        boxes = [u] * len(ims)
    for f, im, box in zip(files, ims, boxes):
        im = im.crop(box)
        w, h = im.size
        pw, ph = w + w % 2, h + h % 2  # párny rozmer: stĺpec doprava, riadok navrch (päta ostane dole)
        rows = []
        for y in range(ph):
            r = ''
            for x in range(pw):
                sy = y - (ph - h)
                px = im.getpixel((x, sy)) if x < w and sy >= 0 else (0, 0, 0, 0)
                if px[3] < 128: r += '.'; continue
                col = '#%02x%02x%02x' % px[:3]
                if col not in pal: pal.append(col)
                r += CHARS[pal.index(col)]
            rows.append(r)
        levels.append(rows)
        print('%s: %dx%d px (v hre %gx%g bodov)' % (os.path.relpath(f, ROOT), pw, ph, pw / 2, ph / 2))
    assert len(pal) <= len(CHARS), 'priveľa farieb: %d' % len(pal)
    js = ["'use strict';",
          '// %s: budova z PixelLabu, jemná kresba (hra ju kreslí v polovičnej veľkosti). Vygenerované: tools/pixellab2obj.py – ručne neupravovať.' % name,
          '// pal = farby, lv = úrovne (riadky znakov: znak = index v pal, \'.\' = priehľadné)',
          'const %s = %s;' % (name, json.dumps({'chars': ''.join(CHARS[:len(pal)]), 'pal': pal, 'lv': levels}, separators=(',', ':')).replace('],[', '],\n[')), '']
    open(os.path.join(ROOT, out), 'w', encoding='utf8').write('\n'.join(js))
    print('%s: %d úrovní, %d farieb' % (name, len(levels), len(pal)))


main()
