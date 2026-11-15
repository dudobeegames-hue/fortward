"""Erby národov na drevenom podstavci (Grafika/0. Menu) -> www/img/erby/.
Podstavec z PixelLabu má otvor len 42x44 bodov a erby merajú 40x58, preto sa podstavec v pixeloch upraví:
reťaze sa skrátia na 6 bodov, stĺpiky sa predĺžia o 22 riadkov (opakovaný riadok stĺpika) a priečka so základňou
sa rozšíria o 4 stĺpce (opakovaný stĺpec dreva medzi reťazami) – otvor potom má 46x66 a reťaze sú 34 bodov od seba
ako úchyty erbov. Erby sa orežú na obsah (a vyčistí sa zablúdený pixel). Výstup: stand.png (96x112), <rasa>.png
a stand.json s polohou, kam sa erb zavesí (ľavý horný roh obsahu erbu).
Použitie: python tools/menu_crests.py
"""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'Grafika', '0. Menu')
OUT = os.path.join(ROOT, 'www', 'img', 'erby')
RACES = {'ludia': 'luida', 'orkovia': 'orcovia', 'nemrtvi': 'nemrtvy', 'elfovia': 'elf', 'pustny': 'pustny', 'severania': 'severania'}
os.makedirs(OUT, exist_ok=True)

st = Image.open(os.path.join(SRC, 'podstavec', 'rotations', 'wooden_display_stand_for_a_heraldic_shield_front.png')).convert('RGBA')
st = st.crop(st.getbbox())                       # obsah 77x80 (od 11,11)
px = st.load()
OX, OY = 11, 11                                  # posun orezania voči pôvodnému plátnu
# 1) reťaze: ostane 6 riadkov pod priečkou (pôvodne riadky 26–41 v otvore)
for y in range(32 - OY, 42 - OY):
    for x in range(28 - OX, 70 - OX):
        px[x, y] = (0, 0, 0, 0)
# 2) širšie: 4 kópie stĺpca dreva medzi reťazami (pôvodne x = 50)
cx = 50 - OX
w, h = st.size
wide = Image.new('RGBA', (w + 4, h))
wide.paste(st.crop((0, 0, cx, h)), (0, 0))
for k in range(4): wide.paste(st.crop((cx, 0, cx + 1, h)), (cx + k, 0))
wide.paste(st.crop((cx, 0, w, h)), (cx + 4, 0))
# 3) vyššie: 22 kópií riadku stĺpikov (pôvodne y = 55)
ry = 55 - OY
w, h = wide.size
tall = Image.new('RGBA', (w, h + 22))
tall.paste(wide.crop((0, 0, w, ry)), (0, 0))
for k in range(22): tall.paste(wide.crop((0, ry, w, ry + 1)), (0, ry + k))
tall.paste(wide.crop((0, ry, w, h)), (0, ry + 22))
# na plátno 96x112, v strede
W, H = 96, 112
canvas = Image.new('RGBA', (W, H))
sx, sy = (W - tall.width) // 2, (H - tall.height) // 2
canvas.alpha_composite(tall, (sx, sy))
canvas.save(os.path.join(OUT, 'stand.png'))

# poloha erbu: úchyty erbu (stred) majú sedieť pod reťazami; reťaze sú v pôvodnom x 34.5 a 64 (+4 za rozšírenie)
chainL = 34.5 - OX + sx
chainR = 64 - OX + 4 + sx
chainBot = 31 - OY + sy                          # posledný riadok skrátenej reťaze
crests = {}
for key, folder in RACES.items():
    im = Image.open(os.path.join(SRC, folder, 'rotations', folder + '.png')).convert('RGBA')
    p = im.load()
    for x in range(im.width):                    # zablúdené pixely ďaleko od erbu (napr. vpravo dole)
        for y in range(im.height):
            if p[x, y][3] and (x > 58 or y > 66): p[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    cr = im.crop(bb)
    cr.save(os.path.join(OUT, key + '.png'))
    cp = cr.load(); top = [x for x in range(cr.width) if cp[x, 0][3] > 128]   # horný riadok = dva úchyty
    left = [x for x in top if x < cr.width / 2]; right = [x for x in top if x >= cr.width / 2]
    hl, hr = sum(left) / len(left), sum(right) / len(right)
    # erb visí stredom medzi úchytmi pod stredom medzi reťazami, horným riadkom tesne pod reťazami
    crests[key] = {'w': cr.width, 'h': cr.height, 'x': round((chainL + chainR) / 2 - (hl + hr) / 2), 'y': chainBot + 1}
info = {'stand': [W, H], 'chains': [chainL, chainR, chainBot], 'crests': crests}
json.dump(info, open(os.path.join(OUT, 'stand.json'), 'w'), indent=1)
print('stand', tall.size, 'at', (sx, sy), 'chains', chainL, chainR, 'bottom', chainBot)
print(crests)
