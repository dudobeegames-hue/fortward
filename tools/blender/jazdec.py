# Jazdec na koni postavený v Blenderi a vyrenderovaný do pixelov Fortwardu v 8 smeroch (státie, klus, útok kopijou).
# Výstup má rovnaký tvar ako postava z PixelLabu, takže ho prevedie tools/pixellab2js.py (--hd).
# Spustenie: blender -b -P tools/blender/jazdec.py -- <výstupný priečinok postavy>
import bpy, bmesh, math, sys, os
import numpy as np
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1:][0]
W, H, SS = 48, 64, 6                 # plátno snímky (jemná kresba), render SS× väčší
PX = 0.048                           # svetová veľkosť jedného pixelu (rovnaká pre všetky snímky)
GROUND_ROW = 58                      # riadok, na ktorom stoja kopytá
DEPTH_STEP = 0.22                    # skok hĺbky (vo svete), od ktorého sa kreslí vnútorný obrys
DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.uint8)
K = hexc('#1c140e')
# skupina -> odtiene z PAL (sprites.js) od tmavého po svetlý
RAMPS = {
    'horse': ['#3e2614', '#6e4422', '#a86c38'],                 # d L l
    'dark':  ['#1c140e', '#3e2614'],                            # hriva, chvost, kopytá, priezor
    'cloth': ['#22337a', '#3c64c8', '#3c64c8', '#88b4ff'],      # n B B c (prevažne B ako ostatní ľudia)
    'steel': ['#4a4e60', '#80869a', '#80869a', '#bcc0cc'],      # D M M m (biela w len by prežiarila)
    'wood':  ['#3e2614', '#6e4422', '#a86c38'],                 # kopija, sedlo
    'gold':  ['#b88420', '#f8d048'],                            # G g
}
GROUPS = list(RAMPS)
RAMPS = {g: [hexc(c) for c in v] for g, v in RAMPS.items()}
IDCOL = [(1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 1, 0), (0, 1, 1), (1, 0, 1)]

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
objs = []

def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); sc.collection.objects.link(e)
    e.location = loc  # vo svete; rodič sa pripojí bez posunu
    if parent:
        bpy.context.view_layer.update(); e.parent = parent; e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e

def finish(o, group, parent):
    o['group'] = group; objs.append(o)
    if parent:
        mw = o.matrix_world.copy(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def ball(c, r, group, parent=None):  # elipsoid, c a r vo svete
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=c)
    o = bpy.context.object; o.scale = r; bpy.context.view_layer.update(); return finish(o, group, parent)

def box(c, s, group, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.object; o.scale = s; bpy.context.view_layer.update(); return finish(o, group, parent)

def rod(a, b, r, group, parent=None, cone=False):  # valec (alebo kužeľ) z bodu a do bodu b
    a, b = Vector(a), Vector(b); d = b - a
    if cone: bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=r, depth=d.length, location=(a + b) / 2)
    else: bpy.ops.mesh.primitive_cylinder_add(vertices=16 if 'farebne' in sys.argv else 8, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    bpy.context.view_layer.update(); return finish(o, group, parent)

# ---- kôň (pozerá na +X), všetko visí na root (smer + pohupovanie) ----
root = empty('root', (0, 0, 0))
body = empty('body', (0, 0, 0), root)          # trup s jazdcom (pohupuje sa v kluse)
bpy.context.view_layer.update()
ball((0, 0, 0.98), (0.5, 0.24, 0.21), 'horse', body)
ball((0.36, 0, 1.0), (0.22, 0.23, 0.23), 'horse', body)          # hruď
ball((-0.38, 0, 1.0), (0.23, 0.24, 0.22), 'horse', body)          # zadok
rod((0.42, 0, 1.06), (0.66, 0, 1.46), 0.11, 'horse', body)        # krk
rod((0.62, 0, 1.52), (0.9, 0, 1.3), 0.075, 'horse', body)         # hlava
for s in (-1, 1): rod((0.63, s * 0.045, 1.55), (0.6, s * 0.05, 1.66), 0.025, 'horse', body, cone=True)  # uši
rod((0.37, 0, 1.17), (0.6, 0, 1.6), 0.04, 'dark', body)           # hriva
rod((-0.58, 0, 1.12), (-0.74, 0, 0.62), 0.055, 'dark', body)      # chvost
box((-0.02, 0, 0.93), (0.6, 0.51, 0.3), 'cloth', body)            # čabraka (modrá prikrývka)
box((-0.02, 0, 0.78), (0.62, 0.52, 0.04), 'gold', body)           # zlatý lem
box((-0.02, 0, 1.18), (0.34, 0.3, 0.06), 'wood', body)            # sedlo

legs = []                                                         # (bedro, koleno, je predná, fáza)
for (x, front) in ((0.36, True), (-0.38, False)):
    for s in (-1, 1):
        Y = s * 0.14
        hip = empty('hip', (x, Y, 0.84), body)
        bpy.context.view_layer.update()
        rod((x, Y, 0.88), (x, Y, 0.46), 0.07, 'horse', hip)
        knee = empty('knee', (x, Y, 0.46), hip)
        bpy.context.view_layer.update()
        rod((x, Y, 0.46), (x, Y, 0.07), 0.045, 'horse', knee)
        rod((x, Y, 0.07), (x, Y, 0.0), 0.055, 'dark', knee)   # kopyto
        # klus: diagonálne páry (ľavá predná + pravá zadná) idú spolu
        legs.append((hip, knee, front, 0 if (s > 0) == front else math.pi))

# ---- jazdec (vlastný uzol v sedle, na konci zväčšený ako v ostatných jednotkách hry) ----
RIDER_SCALE = 1.4
rider = empty('rider', (0, 0, 1.2), body)
for s in (-1, 1):
    rod((0.0, s * 0.15, 1.24), (0.1, s * 0.26, 1.0), 0.06, 'steel', rider)   # noha
    rod((0.1, s * 0.26, 1.0), (0.15, s * 0.26, 0.92), 0.055, 'dark', rider)  # čižma
box((-0.03, 0, 1.42), (0.2, 0.3, 0.34), 'cloth', rider)            # modrá suknica cez brnenie
box((-0.03, 0, 1.3), (0.21, 0.31, 0.05), 'gold', rider)            # opasok
ball((-0.03, 0, 1.6), (0.1, 0.16, 0.06), 'steel', rider)           # plecia
ball((0.0, 0, 1.73), (0.11, 0.11, 0.12), 'steel', rider)             # prilba
box((0.1, 0, 1.73), (0.03, 0.13, 0.03), 'dark', rider)           # priezor
rod((-0.02, 0, 1.83), (-0.14, 0, 1.94), 0.045, 'cloth', rider)      # chochol
rod((0.0, 0.17, 1.58), (0.18, 0.12, 1.32), 0.05, 'steel', rider)  # ľavá ruka (opraty)
rod((0.0, -0.17, 1.58), (0.12, -0.22, 1.38), 0.05, 'steel', rider) # pravá ruka (kopija)

lance = empty('lance', (0.12, -0.24, 1.38), rider)                 # kopija ide v osi +X, otáča sa okolo Y
bpy.context.view_layer.update()
L0 = Vector((0.12, -0.24, 1.38))
rod(L0 + Vector((-0.3, 0, 0)), L0 + Vector((1.05, 0, 0)), 0.04, 'wood', lance)
rod(L0 + Vector((0.05, 0, 0)), L0 + Vector((0.15, 0, 0)), 0.075, 'steel', lance, cone=True)   # štít ruky
rod(L0 + Vector((1.05, 0, 0)), L0 + Vector((1.3, 0, 0)), 0.045, 'steel', lance, cone=True)   # hrot
me = bpy.data.meshes.new('pennant'); bm = bmesh.new()             # zástavka pod hrotom
vs = [bm.verts.new(L0 + Vector(v)) for v in [(0.78, 0, 0), (1.02, 0, 0), (0.8, 0, -0.16)]]
bm.faces.new(vs); bm.to_mesh(me)
pen = bpy.data.objects.new('pennant', me); sc.collection.objects.link(pen)
pen.modifiers.new('s', 'SOLIDIFY').thickness = 0.03; finish(pen, 'cloth', lance)
rider.scale = (RIDER_SCALE,) * 3
rider.location = (0, 0, 1.22)  # uzol je v sedle, takže sa jazdec zväčšuje okolo sedla

# ---- pózy ----
def pose(phase=None, lance_pitch=70, lance_dx=0.0):
    bob = 0.0
    for hip, knee, front, ph in legs:
        if phase is None: hip.rotation_euler = (0, 0, 0); knee.rotation_euler = (0, 0, 0); continue
        a = phase + ph
        hip.rotation_euler = (0, math.radians(24 * math.sin(a)), 0)            # + = noha dozadu
        lift = max(0.0, math.cos(a))                                            # noha ide dopredu vo vzduchu
        knee.rotation_euler = (0, math.radians((45 if front else -35) * lift), 0)
        bob = 0.035 * abs(math.cos(phase))
    body.location = (0, 0, bob)
    lance.location = L0 + Vector((lance_dx, 0, 0))
    lance.rotation_euler = (0, math.radians(-lance_pitch), 0)

FRAMES = {  # názov animácie -> zoznam póz
    'rot': [dict()],
    'Running-blender': [dict(phase=k * math.pi / 2, lance_pitch=12) for k in range(4)],
    'Attack-blender': [dict(phase=0.6, lance_pitch=8, lance_dx=-0.18), dict(phase=0.9, lance_pitch=2, lance_dx=0.3),
                       dict(phase=1.2, lance_pitch=6, lance_dx=0.12)],
}

# ---- kamera a svetlo (pevné voči obrazovke, kôň sa otáča) ----
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = PX * max(W, H)
el = math.radians(35)
cam.rotation_euler = (math.pi / 2 - el, 0, 0)
cam.location = (0, -10 * math.cos(el), 10 * math.sin(el))
cam.data.shift_y = (GROUND_ROW - H / 2) / max(W, H)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 0
sun.rotation_euler = (math.radians(45), math.radians(-30), math.radians(-25))  # zľava zhora spredu
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']

r = sc.render
r.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'
r.resolution_x, r.resolution_y = W * SS, H * SS
r.film_transparent = True
sc.view_settings.view_transform = 'Standard'
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'; r.image_settings.color_depth = '16'

# ---- pokus: hladký farebný render (nie pixely) – blender ... -- <priečinok> farebne ----
if 'farebne' in sys.argv:
    COLORS = {  # základná farba, kovovosť, drsnosť
        'horse': ((0.22, 0.1, 0.04), 0, 0.55), 'dark': ((0.025, 0.018, 0.014), 0, 0.5),
        'cloth': ((0.03, 0.09, 0.45), 0, 0.8), 'steel': ((0.5, 0.53, 0.6), 1, 0.38),
        'wood': ((0.28, 0.15, 0.06), 0, 0.6), 'gold': ((0.95, 0.66, 0.18), 1, 0.3)}
    for g, (c, met, rough) in COLORS.items():
        m = bpy.data.materials.new(g); m.use_nodes = True
        p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (*c, 1); p.inputs['Metallic'].default_value = met; p.inputs['Roughness'].default_value = rough
        COLORS[g] = m
    for o in objs:
        o.data.materials.clear(); o.data.materials.append(COLORS[o['group']])
        if o.type == 'MESH':
            for pg in o.data.polygons: pg.use_smooth = True
            if len(o.data.vertices) > 100: o.modifiers.new('sub', 'SUBSURF').levels = 2  # guľaté časti ešte hladšie
    bpy.ops.mesh.primitive_plane_add(size=8); gp = bpy.context.object; gp.is_shadow_catcher = True  # tieň na zemi
    zem = bpy.data.collections.new('zem'); sc.collection.children.link(zem); sc.collection.objects.unlink(gp); zem.objects.link(gp)
    sun.data.energy = 4.5; sun.data.angle = math.radians(8)
    sky = world.node_tree.nodes; bg.inputs['Color'].default_value = (0.55, 0.62, 0.75, 1); bg.inputs['Strength'].default_value = 0.6
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.cycles.samples = 48; sc.cycles.use_denoising = True
    r.use_freestyle = True; r.line_thickness_mode = 'ABSOLUTE'; r.line_thickness = 1.1  # tmavý obrys
    fs = sc.view_layers[0].freestyle_settings
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new('obrys')
    if not ls.linestyle: ls.linestyle = bpy.data.linestyles.new('obrys')
    ls.linestyle.color = (0.06, 0.04, 0.03)
    ls.select_by_edge_types = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False
    ls.select_by_collection = True; ls.collection = zem; ls.collection_negation = 'EXCLUSIVE'  # podlaha bez obrysu
    FS = 4                                                                          # 4× jemnejšie ako pixelová verzia
    r.resolution_x, r.resolution_y = W * FS, H * FS
    r.image_settings.color_depth = '8'
    for anim, ps in FRAMES.items():
        for k, ps_k in enumerate(ps):
            for d in range(8):
                pose(**ps_k); root.rotation_euler = (0, 0, math.radians(-45 * d))
                r.filepath = os.path.join(OUT, anim, DIRS[d], 'frame_%03d.png' % k)
                bpy.ops.render.render(write_still=True)
    print('HOTOVO farebne'); sys.exit(0)

def depth_node(nt):  # emisia = vzdialenosť od kamery (6 až 14 → 0 až 1)
    cd = nt.nodes.new('ShaderNodeCameraData'); m = nt.nodes.new('ShaderNodeMapRange')
    m.inputs['From Min'].default_value = 6; m.inputs['From Max'].default_value = 14
    nt.links.new(cd.outputs['View Z Depth'], m.inputs['Value'])
    e = nt.nodes.new('ShaderNodeEmission'); nt.links.new(m.outputs['Result'], e.inputs['Color']); return e

def make_mats(mode):
    mats = {}
    for i, g in enumerate(GROUPS):
        m = bpy.data.materials.new(g + mode); m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear(); out = nt.nodes.new('ShaderNodeOutputMaterial')
        if mode == 'depth': n = depth_node(nt)
        elif mode == 'id':
            n = nt.nodes.new('ShaderNodeEmission'); n.inputs['Color'].default_value = (*IDCOL[i], 1)
        else:
            n = nt.nodes.new('ShaderNodeBsdfDiffuse'); n.inputs['Color'].default_value = (0.8, 0.8, 0.8, 1)
        nt.links.new(n.outputs[0], out.inputs[0]); mats[g] = m
    return mats
MATS = {m: make_mats(m) for m in ('id', 'lit', 'depth')}

def set_mode(mode):
    for o in objs:
        o.data.materials.clear(); o.data.materials.append(MATS[mode][o['group']])
    sc.view_settings.view_transform = 'Raw' if mode == 'depth' else 'Standard'
    if mode != 'lit': bg.inputs['Strength'].default_value = 0; sun.data.energy = 0
    else: bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 0.35; sun.data.energy = 3.2

tmp = os.path.join(OUT, '_tmp'); os.makedirs(tmp, exist_ok=True)
def render():
    p = os.path.join(tmp, 'f.png'); r.filepath = p; bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(p)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)[::-1].copy()
    bpy.data.images.remove(img); return a

jobs = [(anim, k, d) for anim, ps in FRAMES.items() for k in range(len(ps)) for d in range(8)]
shots = {}
for mode in ('id', 'lit', 'depth'):
    set_mode(mode)
    for anim, k, d in jobs:
        pose(**FRAMES[anim][k]); root.rotation_euler = (0, 0, math.radians(-45 * d))
        bpy.context.view_layer.update()
        shots.setdefault((anim, k, d), {})[mode] = render()

# ---- zmenšenie a paleta: odtiene podľa jasu so spoločnými prahmi pre všetky snímky ----
idc = np.array(IDCOL, dtype=np.float32)
cells = {}
for key, s in shots.items():
    A, B = s['id'], s['lit']
    g = np.argmin(((A[..., None, :3] - idc[None, None]) ** 2).sum(-1), axis=2)
    lum = B[..., :3].mean(axis=2); al = A[..., 3] > 0.5; dep = s['depth'][..., 0] * 8 + 6
    lst = []
    for y in range(H):
        for x in range(W):
            sa = al[y * SS:(y + 1) * SS, x * SS:(x + 1) * SS]
            if sa.mean() < 0.3: continue
            sg = g[y * SS:(y + 1) * SS, x * SS:(x + 1) * SS][sa]
            gg = np.bincount(sg, minlength=len(GROUPS)).argmax()
            sel = (y * SS, (y + 1) * SS, x * SS, (x + 1) * SS)
            lst.append((y, x, gg, lum[sel[0]:sel[1], sel[2]:sel[3]][sa][sg == gg].mean(), np.median(dep[sel[0]:sel[1], sel[2]:sel[3]][sa])))
    cells[key] = lst
rng = {}
for gi in range(len(GROUPS)):
    ls = [c[3] for lst in cells.values() for c in lst if c[2] == gi]
    if ls: rng[gi] = (np.percentile(ls, 4), np.percentile(ls, 96))

def frame_img(lst):
    out = np.zeros((H, W, 4), np.uint8); mask = np.zeros((H, W), bool); grp = -np.ones((H, W), int)
    dmap = np.full((H, W), 99.0)
    for y, x, gi, l, dz in lst:
        lo, hi = rng[gi]; ramp = RAMPS[GROUPS[gi]]
        t = 0 if hi <= lo else min(max((l - lo) / (hi - lo), 0), 1) ** 1.5  # viac tmavších odtieňov
        out[y, x, :3] = ramp[min(int(t * len(ramp)), len(ramp) - 1)]; out[y, x, 3] = 255
        mask[y, x] = True; grp[y, x] = gi; dmap[y, x] = dz
    pad = np.pad(mask, 1)
    edge = (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]) & ~mask
    out[edge, :3] = K; out[edge, 3] = 255
    # vnútorný obrys: pixel ďaleko za susedom (iná časť tela) stmavne na K – ako v kresbe PixelLabu
    dp = np.pad(dmap, 1, constant_values=99.0)
    nearer = np.minimum.reduce([dp[:-2, 1:-1], dp[2:, 1:-1], dp[1:-1, :-2], dp[1:-1, 2:]])
    inner = mask & (dmap - nearer > DEPTH_STEP)
    out[inner, :3] = K
    return out

def save(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    hh, ww = arr.shape[:2]
    img = bpy.data.images.new('o', ww, hh, alpha=True)
    img.pixels = (arr[::-1].astype(np.float32) / 255).ravel()
    img.filepath_raw = path; img.file_format = 'PNG'; img.save(); bpy.data.images.remove(img)

for (anim, k, d), lst in cells.items():
    if anim == 'rot': save(frame_img(lst), os.path.join(OUT, 'rotations', DIRS[d] + '.png'))
    else: save(frame_img(lst), os.path.join(OUT, 'animations', anim, DIRS[d], 'frame_%03d.png' % k))
print('HOTOVO', len(cells), 'snimok')
