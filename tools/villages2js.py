"""Prevod osád a hlavných miest rás z PixelLabu (Grafika/0. Menu/Mapy) do www/js/map-village-art.js – jemná kresba (hra ju kreslí v polovičnej veľkosti).

Použitie: python tools/villages2js.py
Každý obrázok: priehľadnosť na 0/255, tmavý obrys (#1c140e) okolo siluety – len pri svetlých okrajoch, takže už obrysovaný obrázok nedostane druhý,
orezanie na kresbu a doplnenie na párny rozmer (stĺpec doprava, riadok navrch – päta ostane dole).
Výstup: MAP_VILLAGES[rasa].tiny / .capital = { chars, pal, lv: [riadky] } (rovnaký formát ako budovy pre artBuilding).
"""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'Grafika', '0. Menu', 'Mapy')
OUT = os.path.join(ROOT, 'www', 'js', 'map-village-art.js')
CHARS = [chr(c) for c in range(33, 127) if chr(c) not in '."\'\\`']
K = (0x1c, 0x14, 0x0e)
FILES = {
    'human': ('tiny_medieval_villag.png', 'capital_village-human.png'),
    'orc': ('village-orc.png', 'capital_orc_war_camp_se_2.png'),
    'desert': ('desert villidge.png', 'desert nomad capital.png'),
    'elf': ('tiny_elven_forest_vi.png', 'capital_elven_forest_vi_2.png'),
    'nordic': ('tiny_nordic_viking_v.png', 'capital_nordic_viking_v_2.png'),
    'undead': ('tiny_undead_necropol_2.png', 'capital_undead_necropol.png'),
    'swarm': ('tiny alien swarm.png', 'capital_alien_swarm_hiv.png'),
}


def convert(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    px = im.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    big = Image.new('RGBA', (W + 2, H + 2), (0, 0, 0, 0))
    big.paste(im, (1, 1))
    W, H = big.size
    px = big.load()
    luma = lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
    add = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3] and luma(px[nx, ny]) > 45:
                    add.append((x, y))
                    break
    for x, y in add:
        px[x, y] = K + (255,)
    big = big.crop(big.split()[3].getbbox())
    w, h = big.size
    pw, ph = w + w % 2, h + h % 2
    pal, rows = [], []
    for y in range(ph):
        row = ''
        for x in range(pw):
            sy = y - (ph - h)
            p = big.getpixel((x, sy)) if x < w and sy >= 0 else (0, 0, 0, 0)
            if not p[3]:
                row += '.'
                continue
            hx = '#%02x%02x%02x' % p[:3]
            if hx not in pal:
                pal.append(hx)
            row += CHARS[pal.index(hx)]
        rows.append(row)
    if len(pal) > len(CHARS):
        raise SystemExit('%s: priveľa farieb (%d)' % (path, len(pal)))
    print('%s: %dx%d px (v hre %gx%g bodov), %d farieb' % (os.path.basename(path), pw, ph, pw / 2, ph / 2, len(pal)))
    return {'chars': ''.join(CHARS[:len(pal)]), 'pal': pal, 'lv': [rows]}


def main():
    data = {race: {'tiny': convert(os.path.join(SRC, t)), 'capital': convert(os.path.join(SRC, c))} for race, (t, c) in FILES.items()}
    with open(OUT, 'w', encoding='utf8', newline='\n') as f:
        f.write("'use strict';\n")
        f.write('// MAP_VILLAGES: osady (tiny) a hlavné mestá (capital) rás na mape z PixelLabu, jemná kresba. Vygenerované: tools/villages2js.py – ručne neupravovať.\n')
        f.write("// pal = farby, lv = [riadky znakov] (znak = index v pal, '.' = priehľadné)\n")
        f.write('const MAP_VILLAGES = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')


if __name__ == '__main__':
    main()
