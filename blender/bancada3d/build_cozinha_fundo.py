# Fundo pré-renderizado da bancada gamificada (LAR-449, protótipo /bancada/prototipo).
# Cozinha escura: parede de azulejo preto, prateleira com fita de luz quente, réstias de alho, tampo escuro.
# Sem a tábua e sem as estações (o three.js desenha tudo isso por cima). Desfoque leve por profundidade de campo.
#
# Uso (Blender 5.2):
#   blender.exe -b --factory-startup -P blender/bancada3d/build_cozinha_fundo.py -- [--only retrato,paisagem] [--quick] [--out DIR]
# Saída padrão: public/assets/bancada/proto/cozinha-retrato.webp (900x1600) e cozinha-paisagem.webp (1600x900), <= 180 KB.
#
# As câmeras são as mesmas de src/components/bancada-proto/layout.ts (CAMERAS), convertidas de glTF/three
# (x, y para cima, z para a câmera) para Blender (x, -z, y). Se mudar uma, mude a outra.
import bpy, sys, os, math, random
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        return ARGS[i + 1] if i + 1 < len(ARGS) and not ARGS[i + 1].startswith('--') else True
    return default

QUICK = bool(arg('--quick', False))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = arg('--out', os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'assets', 'bancada', 'proto')))
ONLY = str(arg('--only', 'retrato,paisagem')).split(',')
SAMPLES = 24 if QUICK else 160
os.makedirs(OUT, exist_ok=True)
random.seed(7)

# three: pos, alvo, fov vertical (graus), largura, altura
CAMERAS = {
    'retrato': dict(pos=(0, 0.94, 0.98), alvo=(0, 0.0, -0.01), fov=47, w=900, h=1600),
    'paisagem': dict(pos=(0, 0.6, 0.76), alvo=(0, 0.02, 0.0), fov=40, w=1600, h=900),
}
def b3(v):  # three -> Blender
    return Vector((v[0], -v[2], v[1]))

# ---------------------------------------------------------------- utilidades
def hexc(h, a=1.0):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (c[0], c[1], c[2], a)

def mat(name, color='#808080', rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hexc(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        p.inputs[k].default_value = v
    return m

def node(m, t, **kw):
    n = m.node_tree.nodes.new(t)
    for k, v in kw.items():
        setattr(n, k, v)
    return n

def link(m, a, b):
    m.node_tree.links.new(a, b)

def ramp(m, stops):
    r = node(m, 'ShaderNodeValToRGB')
    el = r.color_ramp.elements
    for i, (pos, col) in enumerate(stops):
        e = el[i] if i < 2 else el.new(pos)
        e.position = pos
        e.color = hexc(col) if isinstance(col, str) else col
    return r

def obj_from(name, verts, faces, m=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    if smooth:
        me.shade_smooth()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if m:
        me.materials.append(m)
    return o

def revolve(name, prof, m=None, segs=48, cap_top=False, cap_bottom=True, loc=(0, 0, 0)):
    vs, fs = [], []
    n = len(prof)
    for s in range(segs):
        a = 2 * math.pi * s / segs
        for r, z in prof:
            vs.append((r * math.cos(a), r * math.sin(a), z))
    for s in range(segs):
        s2 = (s + 1) % segs
        for i in range(n - 1):
            fs.append((s * n + i, s2 * n + i, s2 * n + i + 1, s * n + i + 1))
    if cap_bottom and prof[0][0] > 0:
        c = len(vs); vs.append((0, 0, prof[0][1]))
        for s in range(segs):
            fs.append((c, ((s + 1) % segs) * n, s * n))
    if cap_top and prof[-1][0] > 0:
        c = len(vs); vs.append((0, 0, prof[-1][1]))
        for s in range(segs):
            fs.append((c, s * n + n - 1, ((s + 1) % segs) * n + n - 1))
    o = obj_from(name, vs, fs, m)
    o.location = loc
    return o

def box(name, x0, x1, y0, y1, z0, z1, m=None, bevel=0.0):
    vs = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    fs = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    o = obj_from(name, vs, fs, m, smooth=False)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = 3
        b.harden_normals = True
    return o

def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# ---------------------------------------------------------------- cena
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = hexc('#120c09')
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.1

TOP = -0.028          # tampo da bancada (a tábua do three.js apoia aqui)
WALL_Y = 0.42         # parede (z = -0.42 no three)
SH_Z = 0.0            # prateleira: montada em z = 0 e erguida por vista (ver render)

# tampo escuro: pedra/aço escovado quase preto, com veio fino
top_m = mat('tampo', '#0d0a08', rough=0.6, metal=0.0, **{'Specular IOR Level': 0.18})
tc = node(top_m, 'ShaderNodeTexCoord'); mp = node(top_m, 'ShaderNodeMapping')
mp.inputs['Scale'].default_value = (1.0, 220.0, 1.0)
nz = node(top_m, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 8
link(top_m, tc.outputs['Object'], mp.inputs['Vector']); link(top_m, mp.outputs['Vector'], nz.inputs['Vector'])
rr = ramp(top_m, [(0.3, (0.5, 0.5, 0.5, 1)), (0.7, (0.72, 0.72, 0.72, 1))])
link(top_m, nz.outputs['Fac'], rr.inputs['Fac'])
link(top_m, rr.outputs['Color'], top_m.node_tree.nodes['Principled BSDF'].inputs['Roughness'])
box('bancada', -2.0, 2.0, -1.2, WALL_Y, TOP - 0.05, TOP, top_m, bevel=0.004)

# parede de azulejo preto (metrô) com rejunte
tile = mat('azulejo_preto', '#0b0b0c', rough=0.12, **{'Coat Weight': 0.6, 'Coat Roughness': 0.05})
tct = node(tile, 'ShaderNodeTexCoord')
mpt = node(tile, 'ShaderNodeMapping'); mpt.inputs['Rotation'].default_value = (math.radians(90), 0, 0)
brick = node(tile, 'ShaderNodeTexBrick')
brick.inputs['Scale'].default_value = 6.0
brick.inputs['Mortar Size'].default_value = 0.012
brick.inputs['Mortar Smooth'].default_value = 0.6
brick.inputs['Brick Width'].default_value = 0.5
brick.inputs['Row Height'].default_value = 0.25
brick.inputs['Color1'].default_value = hexc('#070707'); brick.inputs['Color2'].default_value = hexc('#0e0d0c')
brick.inputs['Mortar'].default_value = hexc('#100c0a')
link(tile, tct.outputs['Object'], mpt.inputs['Vector']); link(tile, mpt.outputs['Vector'], brick.inputs['Vector'])
P = tile.node_tree.nodes['Principled BSDF']
link(tile, brick.outputs['Color'], P.inputs['Base Color'])
inv = node(tile, 'ShaderNodeMath', operation='SUBTRACT'); inv.inputs[0].default_value = 1.0
link(tile, brick.outputs['Fac'], inv.inputs[1])
tb = node(tile, 'ShaderNodeBump'); tb.inputs['Strength'].default_value = 0.22; tb.inputs['Distance'].default_value = 0.004
link(tile, inv.outputs['Value'], tb.inputs['Height']); link(tile, tb.outputs['Normal'], P.inputs['Normal'])
link(tile, tb.outputs['Normal'], P.inputs['Coat Normal'])
obj_from('parede', [(-2.2, WALL_Y, TOP), (2.2, WALL_Y, TOP), (2.2, WALL_Y, 1.8), (-2.2, WALL_Y, 1.8)], [(0, 1, 2, 3)], tile, smooth=False)

_antes = set(bpy.data.objects)
# prateleira de madeira com mão-francesa de aço
steel = mat('aco', '#5a554f', rough=0.3, metal=1.0)
wood = mat('madeira_prat', '#4a2c1a', rough=0.5)
wt = node(wood, 'ShaderNodeTexWave'); wt.inputs['Scale'].default_value = 3.0; wt.inputs['Distortion'].default_value = 6
wt.inputs['Detail'].default_value = 4; wt.wave_type = 'BANDS'; wt.bands_direction = 'X'
wr = ramp(wood, [(0.0, '#3a2213'), (1.0, '#5e3a22')])
link(wood, wt.outputs['Fac'], wr.inputs['Fac']); link(wood, wr.outputs['Color'], wood.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
box('prateleira', -1.6, 1.6, WALL_Y - 0.16, WALL_Y, SH_Z, SH_Z + 0.025, wood, bevel=0.004)
for x in (-1.1, -0.38, 0.38, 1.1):
    box('suporte', x - 0.008, x + 0.008, WALL_Y - 0.13, WALL_Y, SH_Z - 0.09, SH_Z, steel)

# fita de LED quente sob a prateleira (emissiva + luz de área)
led_m = bpy.data.materials.new('led'); led_m.use_nodes = True
nt = led_m.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF'])
em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = hexc('#ffb469'); em.inputs['Strength'].default_value = 14
nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs[0])
obj_from('led', [(-1.55, WALL_Y - 0.05, SH_Z - 0.002), (1.55, WALL_Y - 0.05, SH_Z - 0.002), (1.55, WALL_Y - 0.03, SH_Z - 0.002), (-1.55, WALL_Y - 0.03, SH_Z - 0.002)], [(3, 2, 1, 0)], led_m, smooth=False)
ld = bpy.data.lights.new('led_area', 'AREA'); ld.shape = 'RECTANGLE'; ld.size = 3.0; ld.size_y = 0.04
ld.energy = 150; ld.color = (1.0, 0.66, 0.36)
lo = bpy.data.objects.new('led_area', ld); sc.collection.objects.link(lo)
lo.location = (0, WALL_Y - 0.04, SH_Z - 0.01)

# potes e pratos na prateleira
glass = mat('vidro', '#ffffff', rough=0.05, **{'Transmission Weight': 1.0, 'IOR': 1.45})
cork = mat('rolha', '#9a6b3c', rough=0.8)
fills = ['#e9dcc0', '#a3261a', '#3f4a1f', '#c88a2a', '#e9dcc0', '#5a1e12', '#d8b45a']
for i, x in enumerate([-0.74, -0.31, -0.2, 0.2, 0.31, 0.62, 0.76]):
    h = random.uniform(0.11, 0.19); r = random.uniform(0.038, 0.052)
    y = WALL_Y - 0.08
    revolve('pote_vidro', [(r * 0.95, 0), (r, 0.01), (r, h - 0.02), (r * 0.8, h)], glass, cap_top=False, loc=(x, y, SH_Z + 0.025))
    revolve('conteudo', [(r * 0.9, 0.004), (r * 0.9, h * 0.75)], mat('c%d' % i, fills[i], rough=0.6), cap_top=True, loc=(x, y, SH_Z + 0.025))
    revolve('tampa', [(r * 0.82, 0), (r * 0.82, 0.03)], cork, cap_top=True, loc=(x, y, SH_Z + 0.025 + h - 0.01))
plate = mat('ceramica_creme', '#efe6d4', rough=0.25)
for k in range(5):
    revolve('prato', [(0.0, 0), (0.09, 0.0), (0.115, 0.014), (0.12, 0.016)], plate, loc=(-0.5, WALL_Y - 0.08, SH_Z + 0.025 + k * 0.012))
box('tabuinha', 0.88, 1.1, WALL_Y - 0.04, WALL_Y - 0.02, SH_Z + 0.025, SH_Z + 0.32, mat('madeira_clara', '#4a2e1a', rough=0.6), bevel=0.01)

# réstias de alho penduradas na prateleira
gm = mat('alho', '#d8cbbb', rough=0.6, **{'Subsurface Weight': 0.1})
wv = node(gm, 'ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Z'
wv.inputs['Scale'].default_value = 40; wv.inputs['Distortion'].default_value = 3
tcg = node(gm, 'ShaderNodeTexCoord'); link(gm, tcg.outputs['Object'], wv.inputs['Vector'])
rg = ramp(gm, [(0.0, '#d9cdbd'), (0.6, '#c9b7a8'), (1.0, '#7d4f68')])
link(gm, wv.outputs['Fac'], rg.inputs['Fac'])
link(gm, rg.outputs['Color'], gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
def bulb(name, loc, s):
    prof = []
    for i in range(13):
        t = i / 12
        a = math.pi * t
        prof.append((max(math.sin(a) * (1.0 - 0.25 * t) * s, 0.0005), (-math.cos(a)) * s * 0.85 + 0.6 * s * t ** 4))
    prof.append((0.0015, prof[-1][1] + s * 0.5))
    o = revolve(name, prof, gm, segs=24, cap_top=True, loc=loc)
    d = o.modifiers.new('d', 'DISPLACE')
    tex = bpy.data.textures.new('lob', 'STUCCI'); tex.noise_scale = 0.02
    d.texture = tex; d.strength = s * 0.08
    return o
straw = mat('palha', '#8a6a3e', rough=0.9)
for bx in (-0.62, -0.21, 0.2, 0.62):
    for k in range(5):
        z = SH_Z - 0.03 - k * 0.022
        x = bx + 0.014 * (1 if k % 2 else -1)
        o = bulb('alho', (x, WALL_Y - 0.05 + 0.008 * math.cos(k * 2.3), z), 0.018 + 0.003 * math.sin(k))
        o.rotation_euler = (math.radians(170 + 15 * math.sin(k)), math.radians(12 * math.cos(k * 1.3)), k)
    revolve('barbante', [(0.004, SH_Z - 0.13), (0.005, SH_Z)], straw, segs=8, loc=(bx, WALL_Y - 0.04, 0))

_prat = [o for o in bpy.data.objects if o not in _antes and o.parent is None]

# luzes: pendente quente sobre a tábua, recorte quente de trás-direita, preenchimento frio bem fraco
key = bpy.data.lights.new('pendente', 'SPOT'); key.energy = 30; key.spot_size = math.radians(70); key.spot_blend = 0.9
key.color = (1.0, 0.72, 0.45); key.shadow_soft_size = 0.1
ko = bpy.data.objects.new('pendente', key); sc.collection.objects.link(ko)
ko.location = (0.0, 0.02, 1.0)
rim = bpy.data.lights.new('recorte', 'AREA'); rim.size = 0.8; rim.energy = 35; rim.color = (1.0, 0.6, 0.32)
ro = bpy.data.objects.new('recorte', rim); sc.collection.objects.link(ro)
ro.location = (1.0, 0.3, 0.55); look_at(ro, (0, 0, 0.0))
fill = bpy.data.lights.new('preench', 'AREA'); fill.size = 1.2; fill.energy = 2.0; fill.color = (0.75, 0.82, 1.0)
fo = bpy.data.objects.new('preench', fill); sc.collection.objects.link(fo)
fo.location = (-0.6, -1.2, 0.8); look_at(fo, (0, 0, 0))

# ---------------------------------------------------------------- render
sc.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dt in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
        try:
            prefs.compute_device_type = dt
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type == dt]
            if devs:
                for d in prefs.devices:
                    d.use = d.type == dt
                sc.cycles.device = 'GPU'
                print('GPU', dt)
                break
        except Exception:
            pass
except Exception as e:
    print('sem gpu', e)
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'AgX'
try:
    sc.view_settings.look = 'AgX - Punchy'
except Exception:
    pass
sc.view_settings.exposure = -0.3
sc.render.image_settings.file_format = 'WEBP'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.quality = int(arg('--q', 74))

_sh = [0.0]
for nome in ONLY:
    c = CAMERAS[nome]
    cd = bpy.data.cameras.new('cam_' + nome)
    cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24.0
    cd.lens = 12.0 / math.tan(math.radians(c['fov'] / 2))
    co = bpy.data.objects.new('cam_' + nome, cd); sc.collection.objects.link(co)
    co.location = b3(c['pos']); look_at(co, b3(c['alvo']))
    # foco no tampo, perto da tábua: a parede ao fundo fica levemente desfocada
    cd.dof.use_dof = True
    cd.dof.focus_distance = (b3(c['alvo']) - co.location).length
    cd.dof.aperture_fstop = 2.2
    sc.camera = co
    # a prateleira sobe até ficar logo abaixo do topo do quadro: aparecem a fita de luz, as réstias e a parede
    bpy.context.view_layer.update()
    d = co.matrix_world.to_3x3() @ Vector((0, math.tan(math.radians(c['fov'] / 2)), -1))
    z_topo = co.location.z + d.z * (WALL_Y - co.location.y) / d.y
    alvo_sh = z_topo - 0.07
    for o in _prat:
        o.location.z += alvo_sh - _sh[0]
    _sh[0] = alvo_sh
    print('PRATELEIRA', nome, round(alvo_sh, 3))
    sc.render.resolution_x = c['w']; sc.render.resolution_y = c['h']
    sc.render.resolution_percentage = 50 if QUICK else 100
    sc.render.filepath = os.path.join(OUT, 'cozinha-%s.webp' % nome)
    bpy.ops.render.render(write_still=True)
    print('RENDER_OK', sc.render.filepath, os.path.getsize(sc.render.filepath))
