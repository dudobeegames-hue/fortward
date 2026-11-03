# Skúška: drevená strážnica (lukostrelecká veža lvl1) postavená v Blenderi a vyrenderovaná do pixelov Fortwardu.
# Spustenie: blender -b -P straznica.py -- <výstupný priečinok> <pôvodná veža png>
import bpy, bmesh, math, sys, os
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, ORIG = argv[0], argv[1]
W, H, SS = 18, 32, 6                # výsledok 18×32, render 6× väčší a potom zmenšený

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.uint8)
K = hexc('#1c140e')
RAMPS = {  # skupina -> odtiene od tmavého po svetlý (rovnaké ako v hre)
    'wood': ['#3e2614', '#5a3a1e', '#6e4422', '#8a5a2e', '#a86c38', '#c48a50'],
    'red':  ['#4a1612', '#6c2018', '#8c2c1c', '#b03c24', '#d05634'],
    'blue': ['#22337a', '#3c64c8', '#88b4ff'],
}
GROUPS = list(RAMPS)
RAMPS = {g: [hexc(c) for c in v] for g, v in RAMPS.items()}

# ---- scéna ----
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
objs = []

def add(obj, group):
    obj['group'] = group; objs.append(obj); return obj

def box(cx, cy, cz, sx, sy, sz, group='wood', rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz), rotation=rot)
    o = bpy.context.object; o.scale = (sx, sy, sz); return add(o, group)

def beam(a, b, t, group='wood'):  # hranol z bodu a do bodu b
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2)
    o = bpy.context.object; o.scale = (t, t, d.length)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    return add(o, group)

L, Z1 = 0.36, 1.45                 # polovica rozpätia nôh, výška plošiny
for x in (-L, L):
    for y in (-L, L): beam((x, y, 0), (x, y, Z1), 0.11)
for (ax, ay, bx, by) in [(-L, -L, L, -L), (-L, L, L, L)]:  # kríže len vpredu a vzadu (z boku sa slievajú s nohami)  # krížové vzpery na 4 stranách
    for z0, z1 in ((0.1, 1.35),):  # dve poschodia krížov
        beam((ax, ay, z0), (bx, by, z1), 0.05); beam((bx, by, z0), (ax, ay, z1), 0.05)
box(0, 0, Z1, 1.0, 1.0, 0.08)                                         # plošina
for x in (-0.46, 0.46):
    for y in (-0.46, 0.46): beam((x, y, Z1), (x, y, Z1 + 0.42), 0.06)      # stĺpiky strechy
for s in (-1, 1):                                                     # zábradlie
    box(0, s * 0.47, Z1 + 0.2, 0.98, 0.04, 0.05); box(s * 0.47, 0, Z1 + 0.2, 0.04, 0.98, 0.05)
    for k in (-0.24, 0, 0.24):
        beam((k, s * 0.47, Z1), (k, s * 0.47, Z1 + 0.2), 0.04); beam((s * 0.47, k, Z1), (s * 0.47, k, Z1 + 0.2), 0.04)
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.7, depth=0.4, location=(0, 0, Z1 + 0.62), rotation=(0, 0, math.pi / 4))
add(bpy.context.object, 'red')                                        # strecha (ihlan)
beam((0, 0, Z1 + 0.8), (0, 0, Z1 + 1.2), 0.04)                                 # žrď
me = bpy.data.meshes.new('flag'); bm = bmesh.new()                    # zástavka
vs = [bm.verts.new(v) for v in [(0, 0, Z1 + 1.2), (0.32, 0, Z1 + 1.12), (0, 0, Z1 + 1.03)]]
bm.faces.new(vs); bm.to_mesh(me)
fl = bpy.data.objects.new('flag', me); sc.collection.objects.link(fl)
fl.modifiers.new('s', 'SOLIDIFY').thickness = 0.03; add(fl, 'blue')

# ---- kamera: pravouhlá, 30° zhora, spredu ----
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
el = math.radians(30)
cam.rotation_euler = (math.pi / 2 - el, 0, 0)
cam.location = (0, -10 * math.cos(el), 10 * math.sin(el))
bpy.context.view_layer.update()
# zarámovanie: tvar sa zmestí s 1 px okrajom na obrys, pätou na spodku
inv = cam.matrix_world.inverted(); pts = []
dg = bpy.context.evaluated_depsgraph_get()
for o in objs:
    oe = o.evaluated_get(dg)
    for v in oe.to_mesh().vertices: pts.append(inv @ (o.matrix_world @ v.co))
xs = [p.x for p in pts]; ys = [p.y for p in pts]
w, h = max(xs) - min(xs), max(ys) - min(ys)
px = max(w / (W - 2), h / (H - 2))                                    # svetová veľkosť jedného pixelu
cam.data.ortho_scale = px * H
cam.data.shift_x = (min(xs) + max(xs)) / 2 / (px * H)
cam.data.shift_y = (min(ys) - px + px * H / 2) / (px * H)

r = sc.render
r.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.device = 'CPU'
r.resolution_x, r.resolution_y = W * SS, H * SS
r.film_transparent = True
sc.view_settings.view_transform = 'Standard'
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'

def render(path):
    r.filepath = path; bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    a = np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)[::-1]
    bpy.data.images.remove(img); return a

def set_mats(mode):
    for o in objs:
        m = bpy.data.materials.new(o['group'] + mode); m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        if mode == 'id':
            e = nt.nodes.new('ShaderNodeEmission'); c = [0, 0, 0, 1]; c[GROUPS.index(o['group'])] = 1
            e.inputs['Color'].default_value = c; nt.links.new(e.outputs[0], out.inputs[0])
        else:
            d = nt.nodes.new('ShaderNodeBsdfDiffuse'); d.inputs['Color'].default_value = (0.8, 0.8, 0.8, 1)
            nt.links.new(d.outputs[0], out.inputs[0])
        o.data.materials.clear(); o.data.materials.append(m)

world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
tmp = os.path.join(OUT, '_tmp')
os.makedirs(tmp, exist_ok=True)

bg.inputs['Strength'].default_value = 0
set_mats('id'); A = render(os.path.join(tmp, 'id.png'))
bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 0.35
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.2; sun.rotation_euler = (math.radians(50), math.radians(-35), math.radians(-30))  # svetlo zľava zhora
set_mats('lit'); B = render(os.path.join(tmp, 'lit.png'))

# ---- zmenšenie na 18×32 a prevod na paletu ----
gid = np.argmax(A[..., :3], axis=2); alpha = A[..., 3]
lum = B[..., :3].mean(axis=2)
out = np.zeros((H, W, 4), np.uint8)
mask = np.zeros((H, W), bool)
blk = []
for y in range(H):
    for x in range(W):
        sa = alpha[y * SS:(y + 1) * SS, x * SS:(x + 1) * SS]
        if (sa > 0.5).mean() < 0.4: continue
        sg = gid[y * SS:(y + 1) * SS, x * SS:(x + 1) * SS][sa > 0.5]
        g = np.bincount(sg, minlength=3).argmax()
        sl = lum[y * SS:(y + 1) * SS, x * SS:(x + 1) * SS][sa > 0.5][sg == g]
        blk.append((y, x, g, sl.mean())); mask[y, x] = True
for g in range(3):  # odtieň podľa jasu, roztiahnuté na celú rampu skupiny
    ls = [b[3] for b in blk if b[2] == g]
    if not ls: continue
    lo, hi = np.percentile(ls, 3), np.percentile(ls, 97)
    ramp = RAMPS[GROUPS[g]]
    for (y, x, gg, l) in blk:
        if gg != g: continue
        t = 0 if hi <= lo else min(max((l - lo) / (hi - lo), 0), 1)
        out[y, x, :3] = ramp[min(int(t * len(ramp)), len(ramp) - 1)]; out[y, x, 3] = 255
# obrys K okolo siluety (ako painter.finish v hre)
pad = np.pad(mask, 1)
near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
edge = near & ~mask
out[edge, :3] = K; out[edge, 3] = 255

def save(arr, path):
    hh, ww = arr.shape[:2]
    img = bpy.data.images.new('o', ww, hh, alpha=True)
    img.pixels = (arr[::-1].astype(np.float32) / 255).ravel()
    img.filepath_raw = path; img.file_format = 'PNG'; img.save(); bpy.data.images.remove(img)

save(out, os.path.join(OUT, 'blender-straznica-1.png'))
# porovnanie 8×: pôvodná | blender, na sivom pozadí
o = bpy.data.images.load(ORIG)
orig = (np.array(o.pixels[:]).reshape(o.size[1], o.size[0], 4)[::-1] * 255).round().astype(np.uint8)
cmp_ = np.zeros((H + 4, W * 2 + 6, 4), np.uint8); cmp_[...] = (96, 112, 72, 255)
for arr, x0 in ((orig, 2), (out, W + 4)):
    hh = arr.shape[0]; reg = cmp_[2 + H - hh:2 + H, x0:x0 + arr.shape[1]]
    m = arr[..., 3] > 0; reg[m] = arr[m]
save(np.repeat(np.repeat(cmp_, 8, 0), 8, 1), os.path.join(OUT, 'porovnanie-8x.png'))
# 3D model na otvorenie v Blenderi (s farebnými materiálmi namiesto bielych)
COL = {'wood': (0.35, 0.18, 0.07, 1), 'red': (0.45, 0.06, 0.03, 1), 'blue': (0.05, 0.12, 0.6, 1)}
for o in objs:
    m = o.data.materials[0]; d = m.node_tree.nodes.get('Diffuse BSDF')
    if d: d.inputs['Color'].default_value = COL[o['group']]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'straznica.blend'))
print('HOTOVO')
