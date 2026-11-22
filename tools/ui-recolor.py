"""Prefarbenie UI: v CSS (<style> v www/index.html) prepočíta hnedé tóny (panely, okraje, tuš, tlmený text) do zvolenej schémy.
Rovnaký výpočet ako náhľad www/dev/ui-themes.js: odtieň schémy, sýtosť schémy jemne podľa pôvodného tónu, svetlosť ostane
(najtmavšie tóny sa mierne zosvetlia, aby bolo farbu vidieť). Zlatá, červená, zelená a modrá sa nemenia.

Použitie: python tools/ui-recolor.py <odtieň> <sýtosť> [zosvetlenie]   napr. python tools/ui-recolor.py 214 0.30   (bridlicová)
Pozor: prepočíta len hnedé tóny – po prefarbení už hnedé nie sú, druhé spustenie nič nezmení.
"""
import colorsys
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PATH = os.path.join(ROOT, 'www', 'index.html')


def remap(r, g, b, hue, sat, lift):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    h *= 360
    if not (8 <= h <= 46 and (s <= 0.62 or l < 0.2) and l < 0.93):
        return None
    L = l + (0.3 - l) * 0.28 * lift if l < 0.3 else l
    S = min(1, sat * max(0.6, min(1.6, s / 0.32)))
    nr, ng, nb = colorsys.hls_to_rgb(hue / 360, min(1, L), S)
    return round(nr * 255), round(ng * 255), round(nb * 255)


def recolor(text, hue, sat, lift):
    def hx(m):
        x = m.group(1)
        if len(x) == 3:
            x = ''.join(c * 2 for c in x)
        c = remap(int(x[0:2], 16), int(x[2:4], 16), int(x[4:6], 16), hue, sat, lift)
        return '#%02x%02x%02x' % c if c else m.group(0)

    def rgb(m):
        c = remap(int(m.group(1)), int(m.group(2)), int(m.group(3)), hue, sat, lift)
        if not c:
            return m.group(0)
        return ('rgba(%d,%d,%d%s)' % (c + (m.group(4),))) if m.group(4) else 'rgb(%d,%d,%d)' % c

    text = re.sub(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b', hx, text)
    return re.sub(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)', rgb, text)


def main():
    hue, sat = float(sys.argv[1]), float(sys.argv[2])
    lift = float(sys.argv[3]) if len(sys.argv) > 3 else 1
    s = open(PATH, encoding='utf8').read()
    a, b = s.index('<style>'), s.index('</style>')
    css = recolor(s[a:b], hue, sat, lift)
    head = s[:a]
    head = re.sub(r'(<meta name="theme-color" content=")(#[0-9a-fA-F]{6})', lambda m: m.group(1) + recolor(m.group(2), hue, sat, lift), head)
    out = head + css + s[b:]
    n = sum(1 for x, y in zip(s, out) if x != y)
    open(PATH, 'w', encoding='utf8', newline='').write(out)
    print('prefarbené, zmenených znakov:', n)


if __name__ == '__main__':
    main()
