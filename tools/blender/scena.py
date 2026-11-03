# Porovnanie štýlov: scéna bojiska (hrad, hradby, 2 veže, rytieri, jazdci, orkovia) postavená v Blenderi.
# Rozloženie je rovnaké ako v A-pixel-art.png (zložené z obrázkov hry), políčko = 16 bodov hry = 32 px jemnej kresby.
# Spustenie: blender -b -P tools/blender/scena.py -- <výstup.png> pixel|farebne
import bpy, bmesh, math, sys, os
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, MODE = argv[0], argv[1]
WT, HT = 9, 12                      # políčok na šírku a výšku
TPX = 32                            # px jemnej kresby na políčko
PX = 0.048                          # svet na 1 px (rovnako ako jazdec.py)
TS = TPX * PX                       # políčko vo svete
W, H = WT * TPX, HT * TPX
EL = math.radians(35)               # sklon kamery
SIN = math.sin(EL)
SS = 4
UNIT = 1.6                          # zväčšenie jednotiek oproti stavbám (čitateľnosť na mobile)

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.uint8)
K = hexc('#1c140e')
RAMPS = {  # farby z hry (sprites.js PAL, scene.js, buildings.js)
    'grass': ['#1e3e1e', '#2a5224', '#36662a', '#447c30', '#56923a', '#6caa46', '#8cc45a'],
    'dirt':  ['#3e2a18', '#523822', '#684a2c', '#7e5c38', '#967048', '#ae885a'],
    'stone': ['#2c2c38', '#3e3e4c', '#525262', '#6a6a78', '#848490', '#a0a0aa', '#c4c4cc'],
    'roof':  ['#1c2c68', '#22337a', '#2c4ca0', '#3c64c8', '#5a86e8'],
    'horse': ['#3e2614', '#6e4422', '#a86c38'],
    'dark':  ['#1c140e', '#3e2614'],
    'cloth': ['#22337a', '#3c64c8', '#3c64c8', '#88b4ff'],
    'steel': ['#4a4e60', '#80869a', '#80869a', '#bcc0cc'],
    'wood':  ['#3e2614', '#6e4422', '#a86c38'],
    'gold':  ['#b88420', '#f8d048'],
    'orc':   ['#305c22', '#62a03a', '#9cd45a'],
    'bone':  ['#a8a088', '#eee6cc'],
    'red':   ['#8c2018', '#e84838'],
}
COLORS = {  # hladká verzia: farba, kovovosť, drsnosť
    'grass': ((0.09, 0.22, 0.05), 0, 0.9), 'dirt': ((0.2, 0.12, 0.06), 0, 0.95), 'stone': ((0.32, 0.32, 0.36), 0, 0.85),
    'roof': ((0.04, 0.1, 0.42), 0, 0.6), 'horse': ((0.22, 0.1, 0.04), 0, 0.55), 'dark': ((0.025, 0.018, 0.014), 0, 0.5),
    'cloth': ((0.03, 0.09, 0.45), 0, 0.8), 'steel': ((0.5, 0.53, 0.6), 1, 0.38), 'wood': ((0.28, 0.15, 0.06), 0, 0.6),
    'gold': ((0.95, 0.66, 0.18), 1, 0.3), 'orc': ((0.12, 0.3, 0.06), 0, 0.6), 'bone': ((0.8, 0.75, 0.6), 0, 0.5),
    'red': ((0.6, 0.05, 0.03), 0, 0.5)}
GROUPS = list(RAMPS)
RAMPS = {g: [hexc(c) for c in v] for g, v in RAMPS.items()}
IDCOL = [tuple(float(v) for v in __import__('colorsys').hsv_to_rgb(i / len(GROUPS), 1, 1)) for i in range(len(GROUPS))]
GROUND = ('grass', 'dirt')          # zem: bez obrysu, zrnitá

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
objs = []
zem = bpy.data.collections.new('zem'); sc.collection.children.link(zem)

def tile(tx, ty, z=0): return Vector(((tx - WT / 2) * TS, (HT - ty) * TS / SIN, z))  # políčko obrazovky -> svet

class Place:  # umiestnenie modelu: posun, otočenie okolo Z, mierka
    def __init__(self, at=Vector(), rot=0.0, s=1.0): self.at, self.rot, self.s = at, math.radians(rot), s
    def __call__(self, v):
        x, y, z = v[0] * self.s, v[1] * self.s, v[2] * self.s
        c, n = math.cos(self.rot), math.sin(self.rot)
        return self.at + Vector((x * c - y * n, x * n + y * c, z))
    def rotq(self): return Vector((0, 0, 1)).rotation_difference(Vector((0, 0, 1)))
P0 = Place()

def finish(o, group):
    o['group'] = group; objs.append(o)
    if group in GROUND: sc.collection.objects.unlink(o); zem.objects.link(o)
    return o

def ball(P, c, r, group):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=P(c))
    o = bpy.context.object; o.scale = tuple(v * P.s for v in r); o.rotation_euler = (0, 0, P.rot); return finish(o, group)

def box(P, c, s, group, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(c))
    o = bpy.context.object; o.scale = tuple(v * P.s for v in s); o.rotation_euler = (0, 0, P.rot + rz); return finish(o, group)

def rod(P, a, b, r, group, cone=False, r2=None, verts=12):
    a, b = P(a), P(b); d = b - a
    if cone: bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r * P.s, radius2=(r2 or 0) * P.s, depth=d.length, location=(a + b) / 2)
    else: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r * P.s, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    return finish(o, group)

def tri(P, pts, group, thick=0.03):
    me = bpy.data.meshes.new('tri'); bm = bmesh.new(); bm.faces.new([bm.verts.new(P(p)) for p in pts]); bm.to_mesh(me)
    o = bpy.data.objects.new('tri', me); sc.collection.objects.link(o); o.modifiers.new('s', 'SOLIDIFY').thickness = thick
    return finish(o, group)

# ---- jednotky (pozerajú na +X, počiatok pri chodidlách) ----
def knight(P):
    for s in (-1, 1):
        rod(P, (0, s * 0.09, 0.06), (0, s * 0.09, 0.42), 0.065, 'steel')
        rod(P, (0.02, s * 0.09, 0), (0.02, s * 0.09, 0.1), 0.07, 'dark')
    box(P, (0, 0, 0.62), (0.26, 0.34, 0.42), 'cloth'); box(P, (0, 0, 0.45), (0.27, 0.35, 0.05), 'gold')
    ball(P, (0, 0, 0.85), (0.14, 0.22, 0.08), 'steel'); ball(P, (0.01, 0, 1.08), (0.2, 0.2, 0.21), 'steel')
    box(P, (0.19, 0, 1.06), (0.04, 0.22, 0.045), 'dark'); rod(P, (-0.02, 0, 1.26), (-0.2, 0, 1.42), 0.065, 'cloth')
    box(P, (0.1, 0.25, 0.62), (0.26, 0.05, 0.36), 'gold'); box(P, (0.11, 0.27, 0.62), (0.22, 0.04, 0.31), 'cloth')   # štít
    rod(P, (0, -0.21, 0.86), (0.12, -0.25, 0.6), 0.05, 'steel')
    rod(P, (0.12, -0.25, 0.58), (0.42, -0.25, 1.0), 0.028, 'steel'); rod(P, (0.1, -0.31, 0.6), (0.14, -0.19, 0.62), 0.025, 'gold')

def orc(P, axe=1.0):
    for s in (-1, 1):
        rod(P, (0, s * 0.12, 0.05), (0, s * 0.12, 0.4), 0.08, 'orc'); rod(P, (0.03, s * 0.12, 0), (0.03, s * 0.12, 0.09), 0.08, 'dark')
    box(P, (0, 0, 0.44), (0.34, 0.42, 0.2), 'wood'); box(P, (0, 0, 0.55), (0.3, 0.4, 0.05), 'dark')
    ball(P, (0.04, 0, 0.74), (0.21, 0.27, 0.26), 'orc')
    ball(P, (0.14, 0, 1.04), (0.19, 0.19, 0.17), 'orc'); box(P, (0.28, 0, 0.96), (0.1, 0.2, 0.1), 'orc')   # hlava a čeľusť
    for s in (-1, 1):
        rod(P, (0.32, s * 0.08, 0.94), (0.35, s * 0.08, 1.04), 0.028, 'bone', cone=True)                     # tesáky
        box(P, (0.31, s * 0.07, 1.1), (0.03, 0.045, 0.03), 'red')                                             # oči
        rod(P, (0.1, s * 0.17, 1.12), (0.08, s * 0.3, 1.2), 0.04, 'orc', cone=True)                           # uši
        rod(P, (0.04, s * 0.28, 0.86), (0.2, s * 0.32, 0.56), 0.075, 'orc')
    rod(P, (0.2, -0.32, 0.38), (0.25, -0.32, 0.38 + 0.75 * axe), 0.03, 'wood')
    box(P, (0.33, -0.32, 0.3 + 0.72 * axe), (0.16 * axe, 0.035, 0.22 * axe), 'steel')

def rider(P, lance_pitch=12):
    R = lambda v: (v[0] * 1.4, v[1] * 1.4, 1.22 + (v[2] - 1.2) * 1.4)   # jazdec zväčšený okolo sedla (ako v jazdec.py)
    ball(P, (0, 0, 0.98), (0.5, 0.24, 0.21), 'horse'); ball(P, (0.36, 0, 1.0), (0.22, 0.23, 0.23), 'horse')
    ball(P, (-0.38, 0, 1.0), (0.23, 0.24, 0.22), 'horse')
    rod(P, (0.42, 0, 1.06), (0.66, 0, 1.46), 0.11, 'horse'); rod(P, (0.62, 0, 1.52), (0.9, 0, 1.3), 0.075, 'horse')
    for s in (-1, 1): rod(P, (0.63, s * 0.045, 1.55), (0.6, s * 0.05, 1.66), 0.025, 'horse', cone=True)
    rod(P, (0.37, 0, 1.17), (0.6, 0, 1.6), 0.04, 'dark'); rod(P, (-0.58, 0, 1.12), (-0.74, 0, 0.62), 0.055, 'dark')
    box(P, (-0.02, 0, 0.93), (0.6, 0.51, 0.3), 'cloth'); box(P, (-0.02, 0, 0.78), (0.62, 0.52, 0.04), 'gold')
    box(P, (-0.02, 0, 1.18), (0.34, 0.3, 0.06), 'wood')
    for (x, ang) in ((0.36, -20), (-0.38, 22)):                       # nohy v kluse (diagonálne páry)
        for s in (-1, 1):
            a = math.radians(ang * s); top = Vector((x, s * 0.14, 0.86))
            knee = top + Vector((-math.sin(a) * 0.4, 0, -math.cos(a) * 0.4)); foot = knee + Vector((math.sin(a) * 0.15, 0, -0.4))
            rod(P, top, knee, 0.07, 'horse'); rod(P, knee, foot, 0.045, 'horse'); rod(P, foot, foot + Vector((0, 0, -0.07)), 0.055, 'dark')
    for s in (-1, 1):
        rod(P, R((0.0, s * 0.15, 1.24)), R((0.1, s * 0.26, 1.0)), 0.06 * 1.4, 'steel')
        rod(P, R((0.1, s * 0.26, 1.0)), R((0.15, s * 0.26, 0.92)), 0.055 * 1.4, 'dark')
    box(P, R((-0.03, 0, 1.42)), (0.28, 0.42, 0.48), 'cloth'); box(P, R((-0.03, 0, 1.3)), (0.29, 0.43, 0.07), 'gold')
    ball(P, R((-0.03, 0, 1.6)), (0.14, 0.22, 0.08), 'steel'); ball(P, R((0.0, 0, 1.73)), (0.15, 0.15, 0.17), 'steel')
    box(P, R((0.1, 0, 1.73)), (0.04, 0.18, 0.04), 'dark'); rod(P, R((-0.02, 0, 1.83)), R((-0.14, 0, 1.94)), 0.063, 'cloth')
    rod(P, R((0.0, 0.17, 1.58)), R((0.18, 0.12, 1.32)), 0.07, 'steel'); rod(P, R((0.0, -0.17, 1.58)), R((0.12, -0.22, 1.38)), 0.07, 'steel')
    h = Vector(R((0.12, -0.24, 1.38))); a = math.radians(lance_pitch); d = Vector((math.cos(a), 0, math.sin(a)))
    rod(P, h - d * 0.42, h + d * 1.47, 0.056, 'wood'); rod(P, h + d * 1.47, h + d * 1.82, 0.063, 'steel', cone=True)
    tri(P, [h + d * 1.09, h + d * 1.43, h + d * 1.12 + Vector((0, 0, -0.22))], 'cloth', 0.04)

# ---- stavby ----
def merlons(P, a, b, z, n, size=0.22, group='stone'):   # zuby cimburia na úsečke a-b
    a, b = Vector(a), Vector(b)
    for i in range(n):
        c = a + (b - a) * ((i + 0.5) / n); box(P, (c.x, c.y, z + size / 2), (size, size, size), group)

def round_tower(P, c, r, h, roof_h, flag=True):
    x, y = c
    rod(P, (x, y, 0), (x, y, h), r, 'stone', verts=16); rod(P, (x, y, h), (x, y, h + 0.12), r + 0.08, 'stone', verts=16)
    for i in range(8):
        a = i / 8 * 2 * math.pi; box(P, (x + math.cos(a) * r, y + math.sin(a) * r, h + 0.24), (0.2, 0.2, 0.24), 'stone', rz=a)
    rod(P, (x, y, h + 0.1), (x, y, h + 0.1 + roof_h), r * 0.95, 'roof', cone=True, verts=16)
    if flag:
        top = h + 0.1 + roof_h
        rod(P, (x, y, top - 0.05), (x, y, top + 0.45), 0.025, 'dark')
        tri(P, [(x, y, top + 0.45), (x + 0.42, y, top + 0.36), (x, y, top + 0.24)], 'cloth', 0.03)
    box(P, (x, y - r + 0.02, h * 0.55), (0.09, 0.06, 0.22), 'dark')   # strieľňa

def castle(P):
    s = 2.1                                       # polovica strany nádvoria
    for (a, b) in (((-s, -s), (s, -s)), ((-s, s), (s, s)), ((-s, -s), (-s, s)), ((s, -s), (s, s))):
        c = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.9); horiz = a[1] == b[1]
        box(P, c, (2 * s, 0.4, 1.8) if horiz else (0.4, 2 * s, 1.8), 'stone')
        merlons(P, (a[0], a[1], 0), (b[0], b[1], 0), 1.8, 7)
    box(P, (0, -s - 0.01, 0.55), (0.8, 0.42, 1.1), 'dark'); box(P, (0, -s - 0.02, 1.14), (0.9, 0.44, 0.08), 'wood')  # brána
    for x in (-s, s):
        for y in (-s, s): round_tower(P, (x, y), 0.52, 2.5, 1.0, flag=False)
    box(P, (0, 0.3, 1.7), (2.0, 2.0, 3.4), 'stone')                                                               # palác
    merlons(P, (-1, -0.7, 0), (1, -0.7, 0), 3.4, 5)
    for i in range(3): box(P, (-0.6 + i * 0.6, -0.71, 2.5), (0.16, 0.05, 0.36), 'dark')                           # okná
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.4, depth=1.3, location=P((0, 0.3, 4.05)), rotation=(0, 0, math.pi / 4))
    finish(bpy.context.object, 'roof')
    rod(P, (0, 0.3, 4.6), (0, 0.3, 5.3), 0.03, 'dark'); tri(P, [(0, 0.3, 5.3), (0.6, 0.3, 5.18), (0, 0.3, 5.02)], 'cloth', 0.03)

def wall_row(y_center):
    P = Place(Vector((0, y_center, 0)))
    x0, x1 = -WT / 2 * TS - 1, WT / 2 * TS + 1
    box(P, (0, 0, 0.75), (x1 - x0, 0.9, 1.5), 'stone')
    for yy in (-0.38, 0.38): merlons(P, (x0, yy, 0), (x1, yy, 0), 1.5, 28)
    for i in range(10):                                                     # pilastre na prednej strane
        box(P, (x0 + (i + 0.5) * (x1 - x0) / 10, -0.48, 0.6), (0.22, 0.12, 1.2), 'stone')

# ---- rozloženie (rovnaké ako A-pixel-art.png) ----
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, HT / 2 * TS / SIN, 0)); g = bpy.context.object
g.scale = (WT * TS + 8, HT * TS / SIN + 12, 1); finish(g, 'grass')
me = bpy.data.meshes.new('cesta'); bm = bmesh.new(); rows = []             # cesta od hordy k hradbám: jeden súvislý pás
for i in range(31):
    ty = -1.5 + i * 0.33; x = 4.5 + 0.35 * math.sin(ty * 0.7); hw = 0.62 + 0.08 * math.sin(ty * 1.9)
    rows.append((bm.verts.new(tile(x - hw, ty, 0.004)), bm.verts.new(tile(x + hw, ty, 0.004))))
for (a0, a1), (b0, b1) in zip(rows, rows[1:]): bm.faces.new((a0, a1, b1, b0))
bm.to_mesh(me); o = bpy.data.objects.new('cesta', me); sc.collection.objects.link(o); finish(o, 'dirt')
box(P0, tile(4.5, 9.2, 0.01), (TS * 1.1, TS * 0.9 / SIN, 0.02), 'stone')     # dlažba pred hradom

castle(Place(tile(4.5, 10.6)))
wall_row(tile(0, 8.5).y)
for tx in (1.5, 7.5): round_tower(Place(tile(tx, 9.5)), (0, 0), 0.62, 3.0, 1.1)
for tx, ty in [(2.6, 7.3), (3.6, 7.5), (5.4, 7.5), (6.4, 7.3)]: knight(Place(tile(tx, ty), 90, UNIT))
for tx, ty in [(3.1, 5.6), (6.0, 5.8)]: rider(Place(tile(tx, ty), 90, UNIT * 0.85))
for tx, ty in [(2.0, 3.0), (3.3, 2.3), (4.6, 3.1), (5.8, 2.4), (7.0, 3.2), (4.0, 1.5), (6.6, 1.6)]: orc(Place(tile(tx, ty), -90, UNIT * 1.05))
orc(Place(tile(5.2, 3.9), -90, UNIT * 1.45), axe=1.3)
for tx, ty, r in [(0.4, 1.0, 0.5), (8.7, 4.6, 0.42), (0.3, 6.2, 0.36)]:    # kríky
    ball(P0, tile(tx, ty, r * 0.7), (r, r, r * 0.8), 'orc')

# ---- kamera, svetlo, render ----
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = PX * max(W, H); cam.data.clip_end = 200
look = tile(4.5, 6); D = 40
cam.rotation_euler = (math.pi / 2 - EL, 0, 0)
cam.location = look + Vector((0, -D * math.cos(EL), D * math.sin(EL)))
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(45), math.radians(-30), math.radians(-25)); sun.data.angle = math.radians(6)
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
r = sc.render
r.engine = 'CYCLES'; sc.cycles.device = 'CPU'
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'

def brick_color(nt, w, h, lo=0.55, hi=0.85):  # murivo / škridle: tehly na stene (x+y, z), škáry tmavé
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'; nt.links.new(sep.outputs[0], add.inputs[0]); nt.links.new(sep.outputs[1], add.inputs[1])
    cmb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(add.outputs[0], cmb.inputs[0]); nt.links.new(sep.outputs[2], cmb.inputs[1])
    b = nt.nodes.new('ShaderNodeTexBrick'); nt.links.new(cmb.outputs[0], b.inputs['Vector'])
    b.inputs['Scale'].default_value = 1; b.inputs['Brick Width'].default_value = w; b.inputs['Row Height'].default_value = h
    b.inputs['Mortar Size'].default_value = 0.03; b.inputs['Mortar Smooth'].default_value = 0
    b.inputs['Color1'].default_value = (hi, hi, hi, 1); b.inputs['Color2'].default_value = (lo + 0.15, lo + 0.15, lo + 0.15, 1)
    b.inputs['Mortar'].default_value = (lo * 0.55, lo * 0.55, lo * 0.55, 1); b.inputs['Bias'].default_value = 0.2
    return b.outputs['Color']

def noise_color(nt, lo, hi, scale=6.0):   # zrnitá zem: jas podľa šumu
    geo = nt.nodes.new('ShaderNodeNewGeometry'); n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = 3; nt.links.new(geo.outputs['Position'], n.inputs['Vector'])  # podľa polohy vo svete (cesta z viacerých kúskov nadväzuje)
    m = nt.nodes.new('ShaderNodeMapRange'); m.inputs['From Min'].default_value = 0.3; m.inputs['From Max'].default_value = 0.7
    m.inputs['To Min'].default_value = lo; m.inputs['To Max'].default_value = hi
    nt.links.new(n.outputs['Fac'], m.inputs['Value']); return m.outputs['Result']

if MODE == 'farebne':
    mats = {}
    for gname, (c, met, rough) in COLORS.items():
        m = bpy.data.materials.new(gname); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (*c, 1); p.inputs['Metallic'].default_value = met; p.inputs['Roughness'].default_value = rough
        if gname in GROUND:
            nt = m.node_tree; mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
            mix.inputs['A'].default_value = (*[v * 0.7 for v in c], 1); mix.inputs['B'].default_value = (*[v * 1.3 for v in c], 1)
            nt.links.new(noise_color(nt, 0, 1, 2.5 if gname == 'grass' else 3), mix.inputs['Factor'])
            nt.links.new(mix.outputs['Result'], p.inputs['Base Color'])
        mats[gname] = m
    for o in objs:
        o.data.materials.clear(); o.data.materials.append(mats[o['group']])
        for pg in o.data.polygons: pg.use_smooth = True
        if len(o.data.vertices) > 100: o.modifiers.new('sub', 'SUBSURF').levels = 2
    sun.data.energy = 4.5; bg.inputs['Color'].default_value = (0.55, 0.62, 0.75, 1); bg.inputs['Strength'].default_value = 0.6
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.cycles.samples = 64; sc.cycles.use_denoising = True
    r.use_freestyle = True; r.line_thickness_mode = 'ABSOLUTE'; r.line_thickness = 1.2
    fs = sc.view_layers[0].freestyle_settings
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new('obrys')
    if not ls.linestyle: ls.linestyle = bpy.data.linestyles.new('obrys')
    ls.linestyle.color = (0.06, 0.04, 0.03)
    ls.select_by_edge_types = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False
    ls.select_by_collection = True; ls.collection = zem; ls.collection_negation = 'EXCLUSIVE'
    r.resolution_x, r.resolution_y = W * 2, H * 2; r.film_transparent = False
    r.filepath = OUT; bpy.ops.render.render(write_still=True)
    print('HOTOVO'); sys.exit(0)

# ---- pixelová verzia: ID, svetlo, hĺbka -> paleta hry (ako jazdec.py) ----
r.resolution_x, r.resolution_y = W * SS, H * SS; r.film_transparent = True; sc.cycles.samples = 16
r.image_settings.color_depth = '16'
def make_mats(mode):
    mats = {}
    for i, gname in enumerate(GROUPS):
        m = bpy.data.materials.new(gname + mode); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        if mode == 'depth':
            cd = nt.nodes.new('ShaderNodeCameraData'); mr = nt.nodes.new('ShaderNodeMapRange')
            mr.inputs['From Min'].default_value = 10; mr.inputs['From Max'].default_value = 70
            nt.links.new(cd.outputs['View Z Depth'], mr.inputs['Value'])
            n = nt.nodes.new('ShaderNodeEmission'); nt.links.new(mr.outputs['Result'], n.inputs['Color'])
        elif mode == 'id':
            n = nt.nodes.new('ShaderNodeEmission'); n.inputs['Color'].default_value = (*IDCOL[i], 1)
        else:
            n = nt.nodes.new('ShaderNodeBsdfDiffuse')
            if gname in GROUND:  # hrubé škvrny + jemné zrno (steblá trávy, hrudky hliny)
                mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
                nt.links.new(noise_color(nt, 0.6, 0.95, 1.6 if gname == 'grass' else 2.2), mul.inputs[0])
                nt.links.new(noise_color(nt, 0.7, 1.0, 14), mul.inputs[1]); nt.links.new(mul.outputs[0], n.inputs['Color'])
            elif gname == 'stone': nt.links.new(brick_color(nt, 0.34, 0.17), n.inputs['Color'])
            elif gname == 'roof': nt.links.new(brick_color(nt, 0.14, 0.1, 0.6, 0.85), n.inputs['Color'])
            else: n.inputs['Color'].default_value = (0.8, 0.8, 0.8, 1)
        nt.links.new(n.outputs[0], out.inputs[0]); mats[gname] = m
    return mats
MATS = {m: make_mats(m) for m in ('id', 'lit', 'depth')}
tmp = os.path.join(os.path.dirname(OUT), '_tmp'); os.makedirs(tmp, exist_ok=True)
shot = {}
for mode in ('id', 'lit', 'depth'):
    for o in objs: o.data.materials.clear(); o.data.materials.append(MATS[mode][o['group']])
    sc.view_settings.view_transform = 'Raw' if mode == 'depth' else 'Standard'
    lit = mode == 'lit'
    bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 0.35 if lit else 0
    sun.data.energy = 3.2 if lit else 0
    p = os.path.join(tmp, mode + '.png'); r.filepath = p; bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(p)
    shot[mode] = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)[::-1].copy(); bpy.data.images.remove(img)

A, B, Dp = shot['id'], shot['lit'], shot['depth'][..., 0] * 60 + 10
idc = np.array(IDCOL, dtype=np.float32)
gid = np.argmin(((A[..., None, :3] - idc[None, None]) ** 2).sum(-1), axis=2); al = A[..., 3] > 0.5
lum = B[..., :3].mean(axis=2)
out = np.zeros((H, W, 4), np.uint8); dmap = np.full((H, W), 999.0); gmap = -np.ones((H, W), int); lmap = np.zeros((H, W))
for y in range(H):
    for x in range(W):
        sl = (slice(y * SS, (y + 1) * SS), slice(x * SS, (x + 1) * SS)); sa = al[sl]
        if sa.mean() < 0.3: continue
        sg = gid[sl][sa]; gg = np.bincount(sg, minlength=len(GROUPS)).argmax()
        gmap[y, x] = gg; lmap[y, x] = lum[sl][sa][sg == gg].mean(); dmap[y, x] = np.median(Dp[sl][sa])
for gi, gname in enumerate(GROUPS):
    m = gmap == gi
    if not m.any(): continue
    lo, hi = np.percentile(lmap[m], 3), np.percentile(lmap[m], 97); ramp = RAMPS[gname]
    t = np.clip((lmap[m] - lo) / max(hi - lo, 1e-6), 0, 1) ** (1.7 if gname == 'grass' else 1.3)  # tráva prevažne stredne tmavá ako v hre
    out[m, :3] = np.array(ramp)[np.minimum((t * len(ramp)).astype(int), len(ramp) - 1)]; out[m, 3] = 255
# obrys: pixel ďaleko za susedom stmavne na K (okolo stavieb a jednotiek aj vnútri nich)
dp = np.pad(dmap, 1, constant_values=999.0)
nearer = np.minimum.reduce([dp[:-2, 1:-1], dp[2:, 1:-1], dp[1:-1, :-2], dp[1:-1, 2:]])
out[(gmap >= 0) & (dmap - nearer > 0.35), :3] = K
img = bpy.data.images.new('o', W, H, alpha=True); img.pixels = (out[::-1].astype(np.float32) / 255).ravel()
img.filepath_raw = OUT; img.file_format = 'PNG'; img.save()
print('HOTOVO')
