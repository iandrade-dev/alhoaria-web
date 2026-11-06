# Cozinha 3D da bancada gamificada (LAR-449, parte 6a): cozinha.glb.
# Substitui a imagem fixa de build_cozinha_fundo.py por um modelo de verdade, para a câmera poder girar e afastar.
# Fiel ao concept k1 (renders/cena.py), em escala real: tampo de aço escovado escuro, frente do balcão, parede de azulejo metrô preto,
# prateleira de madeira com mão-francesa de aço e fita de LED quente, potes de vidro, pratos, tabuinha, uma réstia
# de alho, luminária pendente e props decorativos fora das zonas de jogo.
#
# Luz assada (Cycles) em cor de vértice (COLOR_0): irradiância difusa (pendente, LED, recortes, preenchimento) x AO,
# já multiplicada pelo albedo nos props sem textura. Parede, tampo, frente e prateleira usam textura em ladrilho
# (albedo) x COLOR_0 (luz). LED e lâmpada são emissivos.
#
# Uso (Blender 5.2):
#   blender.exe -b --factory-startup -P blender/bancada3d/build_cozinha.py -- [--renders DIR] [--quick]
#                [--no-build] [--no-render] [--views lista]
# Saída: public/assets/models/bancada/cozinha.glb (Draco, Y para cima, metros, sem luzes nem câmeras, raiz `cozinha`).
# Coordenadas = three.js do protótipo: origem no centro do topo da tábua, tampo em y = -0,028 (MESA em layout.ts).
import bpy, sys, os, math, random, json, struct, tempfile
import numpy as np
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        return ARGS[i + 1] if i + 1 < len(ARGS) and not ARGS[i + 1].startswith('--') else True
    return default


QUICK = bool(arg('--quick', False))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
MODELS = os.path.join(ROOT, 'public', 'assets', 'models', 'bancada')
OUT_GLB = os.path.join(MODELS, 'cozinha.glb')
RENDERS = arg('--renders', r'\\wsl.localhost\Ubuntu\home\igor\orq\runs\lar-449-cozinha3d\renders')
K1 = r'\\wsl.localhost\Ubuntu\home\igor\orq\runs\lar-gamificado-concepts\k1-cozinha.png'
VIEWS = str(arg('--views', 'all'))
BUILD = not arg('--no-build', False)
RENDER = not arg('--no-render', False)

R = random.Random(449)

# ---------------------------------------------------------------- medidas (three.js: x direita, y cima, z câmera)
MESA = -0.028          # topo do tampo
WALL = -0.62           # parede (como no k1)
FRONT = 0.95           # frente do tampo (a câmera retrato sugerida vê até z ~ 0,85)
XMAX = 3.2             # o tampo e a parede vão bem além do que a câmera vê girando ±35° e afastando
WALL_TILE = 1.0        # azulejo até 1 m; acima, parede pintada escura
SH_Y0, SH_Y1 = 0.45, 0.48          # prateleira de parede em escala real (~45 cm acima do tampo)
SH_Z1 = -0.452                     # frente da prateleira (~17 cm de fundo)
SH_X0, SH_X1 = -1.0, 0.9
LAMP = (0.0, -0.02)                # luminária sobre a tábua (x, z)

# ---------------------------------------------------------------- zonas de jogo (layout.ts + Pedido3D.tsx)
FOLGA = 0.06
R_ITEM = 0.065         # raio típico de uma estação / item de mesa
PONTOS = {
    'retrato': [
        # pão de alho (Costela, Pulled, Brócolis)
        (-0.15, -0.25), (0.14, -0.26), (-0.165, 0.27), (0.025, 0.3), (0.205, 0.25),
        # Dogalho
        (-0.215, -0.245), (-0.025, -0.31), (0.205, -0.27), (-0.165, 0.27), (0.03, 0.3), (0.205, 0.25),
        # pedido: adicionais, prateleiras, bebidas/porções, copos
        (-0.175, -0.245), (0, -0.285), (0.175, -0.245), (-0.18, 0.2), (0, 0.215), (0.18, 0.2),
        (-0.165, -0.27), (0, -0.285), (0.165, -0.27),
        (0.17, 0.2), (0.225, 0.07), (-0.15, 0.215), (-0.225, 0.07), (-0.135, 0.105),
    ],
    'paisagem': [
        (-0.36, -0.11), (-0.38, 0.15), (0.42, -0.15), (0.42, 0.17), (0.21, -0.27),
        (-0.37, -0.15), (-0.42, 0.13), (-0.2, -0.285), (0.42, -0.16), (0.43, 0.15), (0.23, -0.27),
        (-0.31, -0.21), (-0.39, -0.03), (-0.35, 0.15), (0.31, -0.21), (0.39, -0.03), (0.35, 0.15),
        (-0.2, -0.27), (0, -0.285), (0.2, -0.27),
        (0.33, -0.1), (0.42, -0.22), (-0.33, -0.06), (-0.42, -0.21), (-0.135, 0.105),
    ],
}
SACOLAS = {'retrato': [(0, -0.255), (0, -0.07)], 'paisagem': [(0, -0.25), (0, -0.04)]}


def zonas(arr):
    """Caixas (x0, x1, z0, z1) já com a folga."""
    zs = [(x - R_ITEM - FOLGA, x + R_ITEM + FOLGA, z - R_ITEM - FOLGA, z + R_ITEM + FOLGA) for x, z in PONTOS[arr]]
    zs += [(x - 0.09 - FOLGA, x + 0.09 + FOLGA, z - 0.055 - FOLGA, z + 0.055 + FOLGA) for x, z in SACOLAS[arr]]
    zs.append((-0.21 - FOLGA, 0.33 + FOLGA, -0.15 - FOLGA, 0.15 + FOLGA))          # tábua
    zs.append((-0.25 - FOLGA, 0.25 + FOLGA, -0.345 - FOLGA, -0.215 + FOLGA))       # bandeja das prateleiras
    return zs


ZONAS = zonas('retrato') + zonas('paisagem')


# ---------------------------------------------------------------- cor
def s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def mul(a, k):
    return tuple(min(1.0, x * k) for x in a)


def vary(c, amt=0.06):
    k = 1 + R.uniform(-amt, amt)
    return mul(c, k)


# ---------------------------------------------------------------- malha
class MB:
    """Acumulador em coordenadas three.js; vira Blender (x, -z, y) no fim. Albedo sRGB por vértice."""

    def __init__(self, uv=False):
        self.t, self.a, self.f, self.fm, self.fs, self.fuv = [], [], [], [], [], []
        self.uv = uv

    def add(self, p, a=(1, 1, 1)):
        self.t.append(Vector(p))
        self.a.append(tuple(a))
        return len(self.t) - 1

    def face(self, idx, m=0, smooth=True, uv=None):
        self.f.append(tuple(idx)); self.fm.append(m); self.fs.append(smooth); self.fuv.append(uv)

    def xform(self, i0, M, t=(0, 0, 0)):
        t = Vector(t)
        for i in range(i0, len(self.t)):
            self.t[i] = M @ self.t[i] + t


def steps(a, b, step):
    n = max(1, int(math.ceil(abs(b - a) / step - 1e-9)))
    return [a + (b - a) * i / n for i in range(n + 1)]


def bps(*segs):
    """Pontos de quebra a partir de (a, b, passo) encadeados."""
    out = []
    for a, b, st in segs:
        s = steps(a, b, st)
        out += s if not out else s[1:]
    return out


def grid(mb, us, vs, pos, nd, alb=None, uvf=None, m=0, smooth=True):
    P = [[Vector(pos(u, v)) for v in vs] for u in us]
    idx = [[mb.add(P[i][j], alb(P[i][j]) if alb else (1, 1, 1)) for j in range(len(vs))] for i in range(len(us))]
    for i in range(len(us) - 1):
        for j in range(len(vs) - 1):
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            pa, pb, pd = P[i][j], P[i + 1][j], P[i][j + 1]
            n = (pb - pa).cross(pd - pa)
            want = Vector(nd(pa) if callable(nd) else nd)
            if n.dot(want) < 0:
                q = [q[0], q[3], q[2], q[1]]
            uv = [uvf(P[a][b]) for a, b in q] if uvf else None
            mb.face([idx[a][b] for a, b in q], m=m, smooth=smooth, uv=uv)


def box(mb, x0, x1, y0, y1, z0, z1, alb=(1, 1, 1), step=None, tex=None, m=0, skip=()):
    """Caixa com faces separadas (cor por face no bake). tex = (tamanho u, tamanho v) em metros para UV planar."""
    al = (lambda p: alb) if not callable(alb) else alb
    st = step or 10.0
    sx, sy, sz = steps(x0, x1, st), steps(y0, y1, st), steps(z0, z1, st)

    def uvf_for(ax):
        if not tex:
            return None
        tu, tv = tex
        if ax == 'x':
            return lambda p: (p.z / tu, p.y / tv)
        if ax == 'y':
            return lambda p: (p.x / tu, -p.z / tv)
        return lambda p: (p.x / tu, p.y / tv)
    if '+y' not in skip:
        grid(mb, sx, sz, lambda u, v: (u, y1, v), (0, 1, 0), al, uvf_for('y'), m, False)
    if '-y' not in skip:
        grid(mb, sx, sz, lambda u, v: (u, y0, v), (0, -1, 0), al, uvf_for('y'), m, False)
    if '+z' not in skip:
        grid(mb, sx, sy, lambda u, v: (u, v, z1), (0, 0, 1), al, uvf_for('z'), m, False)
    if '-z' not in skip:
        grid(mb, sx, sy, lambda u, v: (u, v, z0), (0, 0, -1), al, uvf_for('z'), m, False)
    if '+x' not in skip:
        grid(mb, sz, sy, lambda u, v: (x1, v, u), (1, 0, 0), al, uvf_for('x'), m, False)
    if '-x' not in skip:
        grid(mb, sz, sy, lambda u, v: (x0, v, u), (-1, 0, 0), al, uvf_for('x'), m, False)


def beam(mb, p0, p1, w, h, alb=(1, 1, 1), m=0, up=(0, 1, 0)):
    """Barra de seção w x h ao longo de p0 -> p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0)
    L = d.length
    d.normalize()
    u = Vector(up)
    if abs(d.dot(u)) > 0.95:
        u = Vector((1, 0, 0))
    a = d.cross(u).normalized()
    b = d.cross(a).normalized()      # (a, b, d) destro: a x b = d
    i0 = len(mb.t)
    box(mb, -w / 2, w / 2, -h / 2, h / 2, 0, L, alb, m=m)
    M = Matrix((a, b, d)).transposed()   # colunas: x->a, y->b, z->d
    mb.xform(i0, M, p0)


def revolve(mb, prof, c=(0, 0, 0), M=None, segs=24, alb=None, m=0, cap_bottom=True, cap_top=False, sx=1.0, sz=1.0,
            rfun=None, smooth=True, a0=0.0):
    """Superfície de revolução em torno do eixo y local. prof = [(r, h)]. alb(a, h, r) -> sRGB.
    rfun(a, h) multiplica o raio (lóbulos). M = Matrix 3x3 aplicada antes de transladar para c."""
    i0 = len(mb.t)
    n = len(prof)
    ring = []
    poles = {}
    for s in range(segs):
        a = a0 + 2 * math.pi * s / segs
        col = []
        for i, (r, h) in enumerate(prof):
            if r < 1e-6:                      # ponto no eixo: um vértice só
                if i not in poles:
                    poles[i] = mb.add((0, h, 0), alb(0, h, 0) if alb else (1, 1, 1))
                col.append(poles[i])
                continue
            rr = r * (rfun(a, h) if rfun else 1.0)
            p = (rr * math.cos(a) * sx, h, rr * math.sin(a) * sz)
            col.append(mb.add(p, alb(a, h, r) if alb else (1, 1, 1)))
        ring.append(col)
    for s in range(segs):
        s2 = (s + 1) % segs
        for i in range(n - 1):
            A, B, C, D = ring[s][i], ring[s2][i], ring[s2][i + 1], ring[s][i + 1]
            q = []
            for v in (A, D, C, B):
                if v not in q:
                    q.append(v)
            if len(q) >= 3:
                mb.face(q, m=m, smooth=smooth)
    if cap_bottom and prof[0][0] > 1e-5:
        h = prof[0][1]
        ci = mb.add((0, h, 0), alb(0, h, 0) if alb else (1, 1, 1))
        for s in range(segs):
            mb.face([ci, ring[s][0], ring[(s + 1) % segs][0]], m=m, smooth=smooth)
    if cap_top and prof[-1][0] > 1e-5:
        h = prof[-1][1]
        ci = mb.add((0, h, 0), alb(0, h, 0) if alb else (1, 1, 1))
        for s in range(segs):
            mb.face([ci, ring[(s + 1) % segs][n - 1], ring[s][n - 1]], m=m, smooth=smooth)
    mb.xform(i0, M if M is not None else Matrix.Identity(3), c)


def ellipsoid(mb, c, rx, ry, rz, M=None, segs=16, rings=8, alb=None, m=0, rfun=None):
    prof = []
    for i in range(rings + 1):
        t = math.pi * i / rings
        prof.append((max(math.sin(t), 0.0), -math.cos(t)))
    prof[0] = (0.0, -1.0); prof[-1] = (0.0, 1.0)
    i0 = len(mb.t)
    revolve(mb, prof[1:-1], (0, 0, 0), None, segs, alb, m, cap_bottom=False, cap_top=False, rfun=rfun)
    # polos
    n = len(prof) - 2
    bot = mb.add((0, -1, 0), alb(0, -1, 0) if alb else (1, 1, 1))
    top = mb.add((0, 1, 0), alb(0, 1, 0) if alb else (1, 1, 1))
    for s in range(segs):
        s2 = (s + 1) % segs
        mb.face([bot, i0 + s * n, i0 + s2 * n], m=m)
        mb.face([top, i0 + s2 * n + n - 1, i0 + s * n + n - 1], m=m)
    S = Matrix(((rx, 0, 0), (0, ry, 0), (0, 0, rz)))
    mb.xform(i0, (M if M is not None else Matrix.Identity(3)) @ S, c)


def rot_y(a):
    return Matrix.Rotation(a, 3, 'Y')


def rot_x(a):
    return Matrix.Rotation(a, 3, 'X')


def rot_z(a):
    return Matrix.Rotation(a, 3, 'Z')


# ---------------------------------------------------------------- texturas (numpy, ladrilháveis)
def fft_noise(rs, h, w, fx_max, fy_max, fx_min=0.0):
    wn = rs.randn(h, w)
    F = np.fft.fft2(wn)
    fy = np.abs(np.fft.fftfreq(h)[:, None] * h)
    fx = np.abs(np.fft.fftfreq(w)[None, :] * w)
    mask = ((fx <= fx_max) & (fy <= fy_max) & ((fx >= fx_min) | (fy > 0))).astype(float)
    out = np.real(np.fft.ifft2(F * mask))
    return (out - out.mean()) / (out.std() + 1e-9)


def save_img(name, rgb, colorspace='sRGB'):
    h, w = rgb.shape[:2]
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2).astype(np.float32)
    im = bpy.data.images.new(name + '_raw', w, h, alpha=False)
    im.pixels.foreach_set(rgba.ravel())
    im.update()
    tmp = os.path.join(tempfile.gettempdir(), 'cozinha_' + name + '.png')
    im.filepath_raw = tmp
    im.file_format = 'PNG'
    im.save()
    im2 = bpy.data.images.load(tmp)
    im2.name = name
    im2.colorspace_settings.name = colorspace
    im2.pack()
    return im2


TILE_M = 0.6           # a textura do azulejo cobre 0,6 x 0,6 m (4 x 8 azulejos de 15 x 7,5 cm)
WOOD_U, WOOD_V = 1.2, 0.6


def make_tile_textures(n=512):
    rs = np.random.RandomState(7)
    y, x = np.mgrid[0:n, 0:n].astype(float) + 0.5
    tw, th = n / 4, n / 8
    row = np.floor(y / th)
    xo = (x + (row % 2) * tw / 2) % n
    col = np.floor(xo / tw)
    fx, fy = xo % tw, y % th
    d = np.minimum(np.minimum(fx, tw - fx), np.minimum(fy, th - fy))
    g = 2.2                                          # meia largura do rejunte (px)
    tile = np.clip((d - g) / 1.2, 0, 1)
    tid = (row * 4 + col).astype(int)
    var = rs.uniform(-1, 1, 64)[tid]
    nz = fft_noise(rs, n, n, 24, 24)
    base = 0.22 + 0.03 * var + 0.008 * nz
    # brilho sutil por azulejo: faixa clara no terço de cima (o vidrado pega a luz) e borda arredondada
    top = np.clip(1 - (th - fy) / (th * 0.35), 0, 1) ** 2
    bev = np.clip((d - g) / 6.0, 0, 1)
    lum = base * (0.65 + 0.35 * bev) + 0.10 * top * bev
    tile_rgb = np.stack([lum * 1.0, lum * 0.97, lum * 0.95], axis=2)
    grout = np.array([0.42, 0.37, 0.32]) * (1 + 0.08 * nz[..., None])
    rgb = tile_rgb * tile[..., None] + grout * (1 - tile[..., None])
    hgt = np.clip((d - g) / 5.0, 0, 1) ** 0.6
    dx = (np.roll(hgt, -1, axis=1) - np.roll(hgt, 1, axis=1)) * 0.5
    dy = (np.roll(hgt, -1, axis=0) - np.roll(hgt, 1, axis=0)) * 0.5
    s = 2.2
    nx, ny, nzz = -dx * s, -dy * s, np.ones_like(hgt)
    ln = np.sqrt(nx * nx + ny * ny + nzz * nzz)
    nrm = np.stack([nx / ln, ny / ln, nzz / ln], axis=2) * 0.5 + 0.5
    return save_img('azulejo_cor', rgb), save_img('azulejo_normal', nrm, 'Non-Color')


def make_wood_texture(w=1024, h=512):
    rs = np.random.RandomState(11)
    y, x = np.mgrid[0:h, 0:w].astype(float) + 0.5
    NP = 10
    pw = h / NP                                      # réguas de 6 cm (0,6 m / 10)
    plank = np.floor(y / pw).astype(int)
    fy = y % pw
    # emendas: cada fileira tem cortes em posições próprias (periódico em 1,2 m)
    cuts = [rs.choice([1, 2]) for _ in range(NP)]
    offs = rs.uniform(0, w, NP)
    seg = np.zeros_like(x)
    edge = np.full_like(x, 99.0)
    for p in range(NP):
        m = plank == p
        L = w / cuts[p]
        xs = (x[m] + offs[p]) % w
        seg[m] = np.floor(xs / L) + p * 7
        e = xs % L
        edge[m] = np.minimum(e, L - e)
    segv = rs.uniform(-1, 1, 64)[(seg.astype(int)) % 64]
    warp = fft_noise(rs, h, w, 6, 10)
    grain = np.sin((fy / pw * 3.0 + warp * 0.45 + seg * 0.37) * math.pi)
    fine = fft_noise(rs, h, w, 5, 220)
    lum = 1.0 + 0.05 * segv + 0.05 * grain + 0.09 * fine
    seam = np.clip(np.minimum(np.minimum(fy, pw - fy), edge) / 1.6, 0, 1)
    lum = lum * (0.8 + 0.2 * seam)
    base = np.array([0.42, 0.31, 0.22])
    rgb = base[None, None, :] * lum[..., None]
    return save_img('madeira_cor', rgb)


def make_steel_texture(w=1024, h=512):
    """Aço escovado escuro, contínuo (sem emendas): riscos finos ao longo de x e manchas largas suaves."""
    rs = np.random.RandomState(13)
    streak = fft_noise(rs, h, w, 3, 240)
    streak2 = fft_noise(rs, h, w, 12, 90)
    blot = fft_noise(rs, h, w, 3, 3)
    lum = 1.0 + 0.07 * streak + 0.04 * streak2 + 0.05 * blot
    base = np.array([0.58, 0.51, 0.45])
    rgb = base[None, None, :] * lum[..., None]
    return save_img('aco_escovado_cor', rgb)


# ---------------------------------------------------------------- materiais
# especificação: cor (ou imagem), normal, rugosidade, metal, alfa, emissão
SPECS = {}


def spec(name, rough=0.6, metal=0.0, image=None, normal=None, alpha=1.0, emit=None, emit_s=1.0, bake_emit=0.0):
    SPECS[name] = dict(rough=rough, metal=metal, image=image, normal=normal, alpha=alpha, emit=emit, emit_s=emit_s,
                       bake_emit=bake_emit)
    return name


def build_mat(name, for_bake):
    s = SPECS[name]
    m = bpy.data.materials.new(('bake_' if for_bake else '') + 'cz_' + name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = s['rough']
    b.inputs['Metallic'].default_value = s['metal']
    b.inputs['Base Color'].default_value = (1, 1, 1, 1)
    tex = None
    if s['image'] is not None:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = s['image']
    if for_bake:
        at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'Alb'
        if tex is not None:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
            mx.inputs['Factor'].default_value = 1.0
            nt.links.new(tex.outputs['Color'], mx.inputs['A']); nt.links.new(at.outputs['Color'], mx.inputs['B'])
            nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
        else:
            nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
    elif tex is not None:
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    if s['normal'] is not None and not for_bake:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = s['normal']
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.0
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if s['alpha'] < 1.0:
        b.inputs['Alpha'].default_value = s['alpha']
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
    if s['emit'] is not None:
        c = hexc(s['emit'])
        b.inputs['Emission Color'].default_value = (s2l(c[0]), s2l(c[1]), s2l(c[2]), 1)
        b.inputs['Emission Strength'].default_value = s['bake_emit'] if for_bake else s['emit_s']
        if not for_bake:
            b.inputs['Base Color'].default_value = (s2l(c[0]), s2l(c[1]), s2l(c[2]), 1)
    m.use_backface_culling = False
    return m


# ---------------------------------------------------------------- objetos
OBJS = []        # (obj, [nomes de spec], tipo)  tipo: 'tex' (Col = luz x tinta), 'vc' (Col = luz x albedo), 'emit'
ROOT_OBJ = None
PROPS_CHECK = []  # nomes de objetos que ficam no tampo e não podem invadir zona


def finish(mb, name, mats, kind='vc', check=False):
    V = [(p.x, -p.z, p.y) for p in mb.t]
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, [], mb.f)
    me.update()
    alb = np.array([[s2l(c) for c in a] + [1.0] for a in mb.a], dtype=np.float32)
    at = me.color_attributes.new('Alb', 'FLOAT_COLOR', 'POINT'); at.data.foreach_set('color', alb.ravel())
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); col.data.foreach_set('color', alb.ravel())
    me.color_attributes.active_color = col
    try:
        me.color_attributes.render_color_index = list(me.color_attributes).index(col)
    except Exception:
        pass
    if mb.uv:
        uvl = me.uv_layers.new(name='UVMap')
        uvs = []
        for f, u in zip(mb.f, mb.fuv):
            uvs += list(u) if u else [(0, 0)] * len(f)
        uvl.data.foreach_set('uv', np.array(uvs, dtype=np.float32).ravel())
    me.polygons.foreach_set('use_smooth', [bool(s) for s in mb.fs])
    me.polygons.foreach_set('material_index', mb.fm)
    for nm_ in mats:
        me.materials.append(build_mat(nm_, True))
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = ROOT_OBJ
    o['kind'] = kind
    o['mats'] = list(mats)
    OBJS.append(o)
    if check:
        PROPS_CHECK.append(name)
    return o


def build_scene():
    global ROOT_OBJ
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ROOT_OBJ = bpy.data.objects.new('cozinha', None)
    bpy.context.scene.collection.objects.link(ROOT_OBJ)

    tile_c, tile_n = make_tile_textures()
    wood = make_wood_texture()
    steel = make_steel_texture()
    spec('azulejo', rough=0.16, image=tile_c, normal=tile_n)
    spec('madeira', rough=0.55, image=wood)
    spec('tampo', rough=0.36, metal=0.2, image=steel)
    spec('fosco', rough=0.75)
    spec('acetinado', rough=0.45)
    spec('ceramica', rough=0.22)
    spec('aco', rough=0.32, metal=0.55)
    spec('vidro', rough=0.05, alpha=0.22)
    spec('led', emit='#ffa24a', emit_s=2.6, bake_emit=0.0)
    spec('lampada', emit='#ffd08a', emit_s=10.0, bake_emit=0.0)
    spec('luz_fria', emit='#e6f2ff', emit_s=3.0, bake_emit=0.0)

    # ------------------------------------------------ tampo (aço escovado escuro, contínuo) + frente do balcão
    xs_fine = bps((-XMAX, -1.6, 0.4), (-1.6, -1.2, 0.1), (-1.2, 1.2, 0.03), (1.2, 1.6, 0.1), (1.6, XMAX, 0.4))
    zs_top = bps((WALL, 0.5, 0.03), (0.5, FRONT, 0.09))
    TAMPO_T = (1.0, 1.0, 1.0)
    mb = MB(uv=True)
    grid(mb, xs_fine, zs_top, lambda u, v: (u, MESA, v), (0, 1, 0), lambda p: TAMPO_T,
         lambda p: (p.x / WOOD_U, -p.z / WOOD_V))
    xs_c = bps((-XMAX, XMAX, 0.1))
    grid(mb, xs_c, [MESA - 0.05, MESA - 0.004], lambda u, v: (u, v, FRONT), (0, 0, 1), lambda p: TAMPO_T,
         lambda p: (p.x / WOOD_U, p.y / WOOD_V))
    grid(mb, xs_c, [FRONT - 0.004, FRONT], lambda u, v: (u, MESA - 0.004 + (v - FRONT + 0.004), v), (0, 0.7, 0.7),
         lambda p: TAMPO_T, lambda p: (p.x / WOOD_U, -p.z / WOOD_V))
    finish(mb, 'tampo', ['tampo'], 'tex')

    mb = MB(uv=True)
    PORTA_T = (0.62, 0.58, 0.55)
    FZ = FRONT - 0.025
    grid(mb, xs_c, [-0.95, MESA - 0.05], lambda u, v: (u, v, FZ - 0.012), (0, 0, 1), lambda p: (0.35, 0.32, 0.3),
         lambda p: (p.y / WOOD_V, p.x / WOOD_U))
    grid(mb, xs_c, [FZ - 0.012, FRONT], lambda u, v: (u, MESA - 0.05, v), (0, -1, 0), lambda p: (0.45, 0.42, 0.4),
         lambda p: (p.x / WOOD_U, -p.z / WOOD_V))
    x = -3.0
    while x < 3.0 - 1e-6:
        box(mb, x + 0.004, x + 0.496, -0.93, MESA - 0.058, FZ - 0.012, FZ + 0.006, PORTA_T, step=0.1,
            tex=(WOOD_V, WOOD_U), skip=('-z',))
        x += 0.5
    finish(mb, 'balcao_frente', ['madeira'], 'tex')
    mb = MB()
    x = -3.0
    while x < 3.0 - 1e-6:
        hx = x + 0.25
        beam(mb, (hx - 0.07, MESA - 0.11, FZ + 0.026), (hx + 0.07, MESA - 0.11, FZ + 0.026), 0.012, 0.012, hexc('#8b8681'))
        for dx in (-0.065, 0.065):
            beam(mb, (hx + dx, MESA - 0.11, FZ + 0.006), (hx + dx, MESA - 0.11, FZ + 0.026), 0.01, 0.01, hexc('#8b8681'))
        x += 0.5
    finish(mb, 'puxadores', ['aco'], 'vc')

    # ------------------------------------------------ parede: azulejo metrô preto até 1 m, pintura escura acima
    mb = MB(uv=True)
    xs_w = bps((-XMAX, -1.6, 0.4), (-1.6, -1.2, 0.1), (-1.2, 1.2, 0.03), (1.2, 1.6, 0.1), (1.6, XMAX, 0.4))
    ys_w = bps((MESA, 0.7, 0.025), (0.7, WALL_TILE, 0.05))
    grid(mb, xs_w, ys_w, lambda u, v: (u, v, WALL), (0, 0, 1), None,
         lambda p: (p.x / TILE_M, (p.y - MESA) / TILE_M))
    finish(mb, 'parede', ['azulejo'], 'tex')
    mb = MB()
    grid(mb, bps((-XMAX, XMAX, 0.2)), bps((WALL_TILE, 2.4, 0.2)), lambda u, v: (u, v, WALL), (0, 0, 1),
         lambda p: hexc('#2e2722'))
    box(mb, -XMAX, XMAX, WALL_TILE - 0.004, WALL_TILE + 0.012, WALL, WALL + 0.012, hexc('#3a2a1e'), step=0.2,
        skip=('-z',))
    finish(mb, 'parede_alta', ['fosco'], 'vc')

    # ------------------------------------------------ prateleira + mão-francesa + fita de LED
    mb = MB(uv=True)
    box(mb, SH_X0, SH_X1, SH_Y0, SH_Y1, WALL, SH_Z1, (1.0, 0.95, 0.9), step=0.04, tex=(WOOD_U, WOOD_V), skip=('-z',))
    finish(mb, 'prateleira', ['madeira'], 'tex')
    mb = MB()
    STEEL = hexc('#8d8882')
    for bx in (-0.86, -0.06, 0.78):
        box(mb, bx - 0.008, bx + 0.008, SH_Y0 - 0.014, SH_Y0, WALL, SH_Z1 - 0.02, STEEL, step=0.04)
        box(mb, bx - 0.008, bx + 0.008, SH_Y0 - 0.17, SH_Y0, WALL, WALL + 0.01, STEEL, step=0.04)
        beam(mb, (bx, SH_Y0 - 0.155, WALL + 0.008), (bx, SH_Y0 - 0.01, SH_Z1 - 0.035), 0.014, 0.008, STEEL)
        for sy in (SH_Y0 - 0.15, SH_Y0 - 0.03):
            ellipsoid(mb, (bx, sy, WALL + 0.011), 0.005, 0.005, 0.002, segs=8, rings=4, alb=lambda *a: hexc('#5a5550'))
    box(mb, SH_X0 + 0.01, SH_X1 - 0.01, SH_Y0 - 0.012, SH_Y0, SH_Z1 - 0.012, SH_Z1 + 0.004, hexc('#9a958f'), step=0.2,
        skip=('+y',))
    finish(mb, 'mao_francesa', ['aco'], 'vc')
    mb = MB()
    # fita de LED na quina de baixo da frente da prateleira, olhando para baixo e um pouco para a frente
    grid(mb, steps(SH_X0 + 0.015, SH_X1 - 0.015, 0.2), [0.0, 1.0],
         lambda u, v: (u, SH_Y0 - 0.016 + 0.008 * v, SH_Z1 + 0.012 - 0.008 * v), (0, -0.7, 0.7))
    finish(mb, 'fita_led', ['led'], 'emit')

    # ------------------------------------------------ potes de vidro grandes, pratos, tabuinha, jarra de colheres
    glass = MB(); cont = MB()
    potes = [(-0.92, 0.24, 0.062, '#e9dcc0', 'alho'), (-0.785, 0.19, 0.055, '#a3261a', 'pimenta'),
             (-0.32, 0.22, 0.06, '#4a5a22', 'oregano'), (-0.19, 0.16, 0.052, '#c8742a', 'paprica'),
             (0.22, 0.26, 0.066, '#ece2c8', 'alho'), (0.365, 0.18, 0.055, '#6a1c12', 'pimenta'),
             (0.80, 0.21, 0.058, '#d9a83a', 'mostarda')]
    for (px, h, r, fill, kind) in potes:
        pz = -0.54
        c = (px, SH_Y1, pz)
        revolve(glass, [(r * 0.94, 0.0), (r, 0.008), (r, h - 0.03), (r * 0.86, h - 0.008), (r * 0.84, h)], c,
                segs=22, cap_bottom=False)
        fc = hexc(fill)
        if kind == 'alho':
            al = lambda a, hh, rr, fc=fc: mix(fc, hexc('#fff6e0'), 0.5 + 0.5 * math.sin(a * 9 + hh * 140))
        else:
            al = lambda a, hh, rr, fc=fc: vary(fc, 0.08)
        revolve(cont, [(r * 0.9, 0.003), (r * 0.9, h * 0.74)], c, segs=18, alb=al, cap_top=True)
        lid = hexc('#9a6b3c') if kind in ('alho', 'oregano') else hexc('#2a2622')
        revolve(cont, [(r * 0.86, h - 0.016), (r * 0.88, h + 0.016), (r * 0.6, h + 0.021)], c, segs=18,
                alb=lambda *a, lid=lid: lid, cap_bottom=False, cap_top=True)
    finish(glass, 'potes_vidro', ['vidro'], 'vc')
    finish(cont, 'potes_conteudo', ['acetinado'], 'vc')

    mb = MB()
    PL = hexc('#efe6d4')
    PS = 1.15
    for k in range(8):
        revolve(mb, [(0.0, 0.0), (0.075 * PS, 0.0), (0.095 * PS, 0.004), (0.112 * PS, 0.014), (0.118 * PS, 0.016),
                     (0.11 * PS, 0.017), (0.07 * PS, 0.006), (0.0, 0.006)], (-0.56, SH_Y1 + k * 0.013, -0.525), segs=30,
                alb=lambda a, h, r: mix(PL, hexc('#7a2a1a'), 1.0 if 0.105 * PS < r < 0.112 * PS else 0.0),
                cap_bottom=False)
    revolve(mb, [(0.0, 0.08), (0.035, 0.078), (0.07, 0.063), (0.083, 0.035), (0.086, 0.0)],
            (-0.56, SH_Y1 + 0.105, -0.525), segs=26, alb=lambda *a: hexc('#d9cbb3'), cap_bottom=False)
    finish(mb, 'pratos', ['ceramica'], 'vc')

    mb = MB(uv=True)
    i0 = len(mb.t)
    box(mb, -0.14, 0.14, 0.0, 0.40, -0.011, 0.011, (0.95, 0.85, 0.72), step=0.05, tex=(WOOD_V, WOOD_U))
    box(mb, -0.035, 0.035, 0.40, 0.49, -0.011, 0.011, (0.95, 0.85, 0.72), step=0.05, tex=(WOOD_V, WOOD_U))
    mb.xform(i0, rot_x(-0.12), (0.0, SH_Y1 + 0.001, -0.59))
    finish(mb, 'tabuinha', ['madeira'], 'tex')

    mb = MB()
    JX = 0.56
    revolve(mb, [(0.0, 0.0), (0.055, 0.0), (0.06, 0.012), (0.06, 0.14), (0.064, 0.15), (0.056, 0.15), (0.053, 0.03)],
            (JX, SH_Y1, -0.54), segs=24, alb=lambda a, h, r: hexc('#2e4a5c') if h > 0.014 else hexc('#c9bfae'))
    for k, ang in enumerate((-0.25, 0.05, 0.3)):
        p0 = Vector((JX + 0.012 * k - 0.012, SH_Y1 + 0.03, -0.54 + 0.012 * (k - 1)))
        tip = p0 + Vector((math.sin(ang) * 0.24, 0.24, -0.02))
        beam(mb, p0, tip, 0.009, 0.006, hexc('#b08050'))
        ellipsoid(mb, tip, 0.02, 0.032, 0.007, M=Matrix.Rotation(-ang, 3, 'Z'), segs=10, rings=5,
                  alb=lambda *a: hexc('#a87545'))
    finish(mb, 'jarra_colheres', ['ceramica'], 'vc')

    # ------------------------------------------------ alho (réstia + cabeças soltas)
    def garlic(mb, c, s, M=None, seed=0, purple=0.55):
        rr = random.Random(seed)
        ph = rr.uniform(0, 6.28)
        prof = []
        for i in range(12):
            t = i / 11
            a = math.pi * t
            prof.append((max(math.sin(a) * (1.0 - 0.28 * t) * s, 0.0006), (-math.cos(a)) * s * 0.8 + 0.55 * s * t ** 4))
        prof.append((s * 0.12, prof[-1][1] + s * 0.25))
        prof.append((s * 0.05, prof[-1][1] + s * 0.45))
        cream, purp, root = hexc('#e9dfcf'), hexc('#8e5a78'), hexc('#8a7258')

        def al(a, h, r):
            st = 0.5 + 0.5 * math.sin(a * 7 + ph + 3 * math.sin(h * 90))
            k = purple * st ** 3 * min(1.0, max(0.0, (h / s + 0.4)))
            c0 = mix(cream, purp, k)
            if h < -0.7 * s:
                c0 = mix(c0, root, 0.7)
            return vary(c0, 0.03)
        revolve(mb, prof, c, M, segs=14, alb=al, cap_bottom=True, cap_top=True,
                rfun=lambda a, h: 1.0 + 0.07 * abs(math.cos(a * 3.5 + ph)))

    mb = MB()
    GX, GZ = 0.64, -0.485
    GTOP = SH_Y0 - 0.01
    # gancho sob a prateleira; a trança de palha desce até ~0,2 m do tampo
    straw = hexc('#9b7a48')
    st_ = hexc('#55504a')
    beam(mb, (GX, SH_Y0, GZ), (GX, GTOP - 0.01, GZ), 0.005, 0.005, st_)
    NB = 9
    pts = [(GX + 0.005 * math.sin(k * 1.9), GTOP - 0.01 - k * 0.026, GZ + 0.003 * math.cos(k * 1.3)) for k in range(NB + 1)]
    for k in range(len(pts) - 1):
        beam(mb, pts[k], pts[k + 1], 0.014, 0.01, vary(straw, 0.1))
    for k in range(NB):
        side = 1 if k % 2 else -1
        y = GTOP - 0.035 - k * 0.026
        cx = GX + side * (0.018 + 0.004 * math.sin(k))
        c = (cx, y, GZ + 0.006 * math.cos(k * 2.1))
        M = rot_z(side * -0.4 + 0.1 * math.sin(k)) @ rot_x(0.15 * math.cos(k))
        garlic(mb, c, 0.024 + 0.003 * math.sin(k * 1.7), M=M, seed=k)
    garlic(mb, (GX, GTOP - 0.04 - NB * 0.026, GZ), 0.026, seed=31)
    # cabeças soltas na prateleira
    garlic(mb, (0.46, SH_Y1 + 0.022, -0.53), 0.026, M=rot_z(0.25), seed=41)
    garlic(mb, (0.505, SH_Y1 + 0.021, -0.57), 0.024, M=rot_z(-0.4) @ rot_x(0.3), seed=42)
    finish(mb, 'restia_alho', ['fosco'], 'vc')

    # ------------------------------------------------ luminária pendente sobre a tábua
    mb = MB()
    LX, LZ = LAMP
    YB = 0.80
    shade = hexc('#1c1a18')
    inner = hexc('#d8b47a')
    prof = [(0.012, YB + 0.20), (0.03, YB + 0.19), (0.05, YB + 0.15), (0.085, YB + 0.09), (0.115, YB + 0.025),
            (0.135, YB + 0.0), (0.13, YB - 0.002), (0.11, YB + 0.022), (0.08, YB + 0.085), (0.045, YB + 0.145),
            (0.026, YB + 0.18)]
    revolve(mb, prof, (LX, 0, LZ), segs=40, alb=lambda a, h, r: shade if h > YB + 0.0 and r > 0 else shade,
            cap_bottom=False)
    # face interna clara: recolore os vértices de dentro (depois do índice 5 do perfil)
    for s in range(40):
        for i in range(6, len(prof)):
            mb.a[s * len(prof) + i] = inner
    revolve(mb, [(0.004, YB + 0.2), (0.004, 2.3)], (LX, 0, LZ), segs=8, alb=lambda *a: shade, cap_bottom=False)
    revolve(mb, [(0.0, YB + 0.17), (0.014, YB + 0.17), (0.014, YB + 0.13), (0.0, YB + 0.13)], (LX, 0, LZ), segs=16,
            alb=lambda *a: hexc('#b08a4a'), cap_bottom=False)
    finish(mb, 'luminaria', ['aco'], 'vc')
    mb = MB()
    ellipsoid(mb, (LX, YB + 0.095, LZ), 0.032, 0.04, 0.032, segs=20, rings=10)
    finish(mb, 'lampada', ['lampada'], 'emit')

    # ------------------------------------------------ props do tampo (fora das zonas de jogo)
    Y0 = MESA
    # cesta de pães (fundo à esquerda)
    mb = MB()
    BX, BZ = -0.66, -0.525
    wick = (hexc('#a77b45'), hexc('#6f4f2a'))

    def wicker(a, h, r):
        k = (int((a / (2 * math.pi)) * 46) + int(h / 0.011)) % 2
        return vary(wick[k], 0.05)
    revolve(mb, [(0.0, 0.0), (0.11, 0.0), (0.135, 0.012), (0.152, 0.045), (0.16, 0.068), (0.152, 0.072),
                 (0.142, 0.05), (0.125, 0.016), (0.0, 0.012)], (BX, Y0, BZ), segs=40, sz=0.58, alb=wicker,
            cap_bottom=False)
    # pano xadrez forrando
    def chk(p):
        k = (int((p.x + 5) / 0.025) + int((p.z + 5) / 0.025)) % 2
        return hexc('#b8302a') if k else hexc('#efe6da')
    def napkin(u, v):
        rr = math.sqrt(((u - BX) / 0.15) ** 2 + ((v - BZ) / 0.093) ** 2)
        y = 0.016 + 0.056 * min(rr, 1.0) ** 3 + 0.004 * math.sin(u * 90) * math.cos(v * 70)
        if rr > 1.0:                      # pontas caem por cima da borda
            y = max(0.003, 0.076 - (rr - 1.0) * 0.18)
        return (u, Y0 + y, v)
    grid(mb, steps(BX - 0.165, BX + 0.165, 0.022), steps(BZ - 0.105, BZ + 0.105, 0.022), napkin, (0, 1, 0), chk)
    crust, crust2 = hexc('#c98b45'), hexc('#8f5525')
    for k, (dx, dz, ang, ln) in enumerate([(-0.02, -0.03, 0.12, 0.125), (0.03, 0.02, -0.08, 0.12), (-0.005, 0.045, 0.3, 0.11)]):
        def bread(a, h, r, k=k):
            top = 0.5 + 0.5 * math.sin(a)
            sl = 0.5 + 0.5 * math.cos(h * 70 + a * 1.2)
            c0 = mix(crust, crust2, 0.55 * top)
            return mix(c0, hexc('#e7c08a'), 0.6 * (sl ** 8) * top)
        M = rot_y(ang) @ rot_z(math.pi / 2)
        ellipsoid(mb, (BX + dx, Y0 + 0.05 + 0.012 * k, BZ + dz * 0.6), 0.034, ln, 0.03, M=M, segs=16, rings=10, alb=bread)
    finish(mb, 'cesta_paes', ['fosco'], 'vc', check=True)

    # quadro-negro "Alhoaria" encostado na parede (fundo, esquerda)
    mb = MB()
    QX0, QX1 = -1.58, -1.06
    base = Vector((0, Y0, -0.505)); top_ = Vector((0, Y0 + 0.66, -0.605))
    ev = (top_ - base).normalized(); L = (top_ - base).length
    nrm = Vector((1, 0, 0)).cross(ev).normalized()
    M = Matrix((Vector((1, 0, 0)), ev, nrm)).transposed()
    i0 = len(mb.t)
    FR = hexc('#6b4426')
    box(mb, QX0, QX1, 0.0, 0.03, -0.012, 0.0, FR, step=0.1)
    box(mb, QX0, QX1, L - 0.03, L, -0.012, 0.0, FR, step=0.1)
    box(mb, QX0, QX0 + 0.03, 0.03, L - 0.03, -0.012, 0.0, FR, step=0.1)
    box(mb, QX1 - 0.03, QX1, 0.03, L - 0.03, -0.012, 0.0, FR, step=0.1)
    rs = random.Random(3)
    smud = [(rs.uniform(QX0, QX1), rs.uniform(0, L), rs.uniform(0.03, 0.08)) for _ in range(9)]

    def slate(p):
        k = sum(max(0.0, 1 - ((p.x - sx) ** 2 + (p.y - sy) ** 2) / sr ** 2) for sx, sy, sr in smud)
        return mix(hexc('#1e2120'), hexc('#4a4e4c'), min(0.6, 0.35 * k))
    grid(mb, steps(QX0 + 0.03, QX1 - 0.03, 0.03), steps(0.03, L - 0.03, 0.03), lambda u, v: (u, v, -0.008),
         (0, 0, 1), slate)
    mb.xform(i0, Matrix(((1, 0, 0), (0, 1, 0), (0, 0, 1))))
    for i in range(i0, len(mb.t)):
        p = mb.t[i]
        mb.t[i] = base + Vector((p.x, 0, 0)) + ev * p.y + nrm * p.z
    chalk = hexc('#ece6d8')
    QC = (QX0 + QX1) / 2

    def text(body, size, cy, bold=False):
        cu = bpy.data.curves.new('txt', 'FONT')
        cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.resolution_u = 2
        if bold:
            cu.offset = 0.0012
        o = bpy.data.objects.new('txt', cu); bpy.context.scene.collection.objects.link(o)
        dg = bpy.context.evaluated_depsgraph_get()
        tm = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        j0 = len(mb.t)
        for v in tm.vertices:
            q = base + Vector((QC + v.co.x, 0, 0)) + ev * (cy + v.co.y) + nrm * -0.0065
            mb.add(q, vary(chalk, 0.04))
        for pl in tm.polygons:
            mb.face([j0 + i for i in pl.vertices], smooth=False)
        bpy.data.objects.remove(o); bpy.data.curves.remove(cu); bpy.data.meshes.remove(tm)
    text('Alhoaria', 0.085, L * 0.7, bold=True)
    text('pão de alho', 0.042, L * 0.47)
    text('recheado', 0.042, L * 0.38)
    text('~ hoje ~', 0.03, L * 0.2)
    finish(mb, 'quadro_negro', ['fosco'], 'vc')

    # fruteira com cebola, tomate, limão e alho (frente esquerda)
    mb = MB()
    FX, FZ_ = -0.80, 0.07
    revolve(mb, [(0.0, 0.0), (0.06, 0.0), (0.1, 0.02), (0.125, 0.055), (0.12, 0.058), (0.095, 0.024), (0.0, 0.008)],
            (FX, Y0, FZ_), segs=32, alb=lambda a, h, r: vary(hexc('#7a4a2a') if r < 0.123 else hexc('#5e381e'), 0.04),
            cap_bottom=False)
    onion = lambda a, h, r: mix(hexc('#b5652e'), hexc('#7d3a18'), (0.5 + 0.5 * math.sin(a * 9)) ** 4)
    ellipsoid(mb, (FX - 0.04, Y0 + 0.05, FZ_ - 0.02), 0.038, 0.034, 0.038, segs=14, rings=8, alb=onion)
    ellipsoid(mb, (FX + 0.035, Y0 + 0.048, FZ_ - 0.035), 0.035, 0.031, 0.035, segs=14, rings=8, alb=onion)
    tom = lambda a, h, r: hexc('#3e6a1e') if h > 0.93 else vary(hexc('#c4291c'), 0.05)
    ellipsoid(mb, (FX + 0.03, Y0 + 0.052, FZ_ + 0.04), 0.032, 0.028, 0.032, segs=14, rings=8, alb=tom)
    ellipsoid(mb, (FX - 0.035, Y0 + 0.05, FZ_ + 0.045), 0.03, 0.026, 0.03, segs=14, rings=8, alb=tom)
    ellipsoid(mb, (FX + 0.0, Y0 + 0.078, FZ_ + 0.0), 0.026, 0.026, 0.036, M=rot_y(0.6), segs=14, rings=8,
              alb=lambda *a: vary(hexc('#d9c23a'), 0.04))
    garlic(mb, (FX + 0.075, Y0 + 0.045, FZ_ + 0.0), 0.024, M=rot_z(-0.5), seed=51)
    finish(mb, 'fruteira', ['acetinado'], 'vc', check=True)

    # pano de prato dobrado (frente esquerda)
    mb = MB()
    i0 = len(mb.t)

    def towel(p):
        zz = p.z
        stripe = (0.035 < abs(zz) < 0.05) or (0.015 < abs(zz) < 0.022)
        return hexc('#b8302a') if stripe else vary(hexc('#ece4d6'), 0.02)
    box(mb, -0.13, 0.13, 0.0, 0.022, -0.08, 0.08, towel, step=0.01)
    for i in range(i0, len(mb.t)):
        p = mb.t[i]
        if p.y > 0.01:
            mb.t[i] = Vector((p.x, p.y + 0.003 * math.sin(p.x * 60) * math.cos(p.z * 40), p.z))
    mb.xform(i0, rot_y(0.22), (-0.76, Y0, 0.37))
    finish(mb, 'pano_prato', ['fosco'], 'vc', check=True)

    # moedor de pimenta
    mb = MB()
    revolve(mb, [(0.0, 0.0), (0.024, 0.0), (0.026, 0.01), (0.022, 0.05), (0.018, 0.08), (0.024, 0.11), (0.026, 0.14),
                 (0.02, 0.16), (0.008, 0.172), (0.006, 0.182), (0.0, 0.185)], (-0.235, Y0, -0.565), segs=18,
            alb=lambda a, h, r: hexc('#3a2416') if 0.075 < h < 0.09 else vary(hexc('#5a3820'), 0.03), cap_top=False)
    finish(mb, 'moedor_pimenta', ['acetinado'], 'vc', check=True)

    # lado direito: azeite, saleiro, vaso de ervas, potinho com dentes de alho, tigelas
    mb = MB()
    AX, AZ = -0.41, -0.53

    def oil(a, h, r):
        if 0.06 < h < 0.15:
            return hexc('#b8302a') if 0.13 < h < 0.14 or 0.07 < h < 0.08 else hexc('#efe3c8')
        if h > 0.245:
            return hexc('#8f8a84')
        return vary(hexc('#4a5512'), 0.03)
    revolve(mb, [(0.0, 0.0), (0.03, 0.0), (0.032, 0.008), (0.032, 0.18), (0.026, 0.205), (0.014, 0.225),
                 (0.012, 0.245), (0.013, 0.252), (0.008, 0.27), (0.005, 0.28), (0.0, 0.28)], (AX, Y0, AZ), segs=20,
            alb=oil, cap_bottom=False)
    # garrafa de vinagre de vinho, ao lado
    revolve(mb, [(0.0, 0.0), (0.033, 0.0), (0.035, 0.01), (0.035, 0.2), (0.028, 0.23), (0.013, 0.25), (0.012, 0.29),
                 (0.014, 0.3), (0.0, 0.3)], (AX + 0.075, Y0, AZ - 0.03), segs=20,
            alb=lambda a, h, r: hexc('#efe3c8') if 0.08 < h < 0.15 else (hexc('#b8302a') if h > 0.285 else
                                                                         vary(hexc('#4a1414'), 0.03)), cap_bottom=False)
    finish(mb, 'azeite', ['ceramica'], 'vc', check=True)

    mb = MB()
    revolve(mb, [(0.0, 0.0), (0.026, 0.0), (0.034, 0.012), (0.037, 0.035), (0.033, 0.036), (0.03, 0.014),
                 (0.0, 0.01)], (-0.15, Y0, -0.53), segs=22, alb=lambda *a: hexc('#ece6da'), cap_bottom=False)
    revolve(mb, [(0.0, 0.026), (0.03, 0.026), (0.0, 0.03)], (-0.15, Y0, -0.53), segs=22,
            alb=lambda *a: vary(hexc('#f6f3ee'), 0.04), cap_bottom=False)
    # potinho com dentes de alho
    PX_, PZ_ = 0.665, -0.03
    revolve(mb, [(0.0, 0.0), (0.035, 0.0), (0.045, 0.01), (0.047, 0.042), (0.042, 0.043), (0.04, 0.012), (0.0, 0.008)],
            (PX_, Y0, PZ_), segs=24, alb=lambda *a: hexc('#e9e2d4'), cap_bottom=False)
    for k in range(6):
        ang = k * 1.05
        ellipsoid(mb, (PX_ + 0.018 * math.cos(ang), Y0 + 0.03 + 0.006 * (k % 2), PZ_ + 0.018 * math.sin(ang)),
                  0.009, 0.007, 0.016, M=rot_y(ang + 0.6) @ rot_x(0.4), segs=10, rings=6,
                  alb=lambda a, h, r: mix(hexc('#f3ebd6'), hexc('#d9c9a0'), 0.5 + 0.5 * h))
    # tigelas empilhadas (frente direita)
    for k, colr in enumerate(('#b5562a', '#e8e0d0', '#2e4a5c')):
        rr = 0.085 - k * 0.012
        revolve(mb, [(0.0, 0.0), (rr * 0.55, 0.0), (rr * 0.85, rr * 0.25), (rr, rr * 0.55), (rr * 0.96, rr * 0.56),
                     (rr * 0.8, rr * 0.27), (0.0, 0.006)], (0.80, Y0 + k * 0.012, 0.30), segs=28,
                alb=lambda *a, colr=colr: hexc(colr), cap_bottom=False)
    finish(mb, 'louca_direita', ['ceramica'], 'vc', check=True)

    mb = MB()
    VX, VZ = 0.43, -0.53
    revolve(mb, [(0.0, 0.0), (0.042, 0.0), (0.05, 0.06), (0.058, 0.064), (0.06, 0.09), (0.054, 0.09), (0.052, 0.075),
                 (0.0, 0.075)], (VX, Y0, VZ), segs=24,
            alb=lambda a, h, r: hexc('#2b1d14') if (h > 0.07 and r < 0.053) else vary(hexc('#b0582e'), 0.04),
            cap_bottom=False)
    rs = random.Random(9)
    for k in range(22):
        ang = rs.uniform(0, 2 * math.pi)
        rad = rs.uniform(0.0, 0.045)
        hy = 0.1 + rs.uniform(0.0, 0.11) * (1 - rad / 0.06)
        c = (VX + rad * math.cos(ang), Y0 + hy, VZ + rad * math.sin(ang))
        M = rot_y(-ang) @ rot_z(-0.7 - rs.uniform(0, 0.5))
        g = rs.uniform(0.0, 1.0)
        ellipsoid(mb, c, 0.007, 0.022, 0.002, M=M, segs=8, rings=4,
                  alb=lambda *a, g=g: mix(hexc('#2f6a1e'), hexc('#5f9a32'), g))
        beam(mb, (VX + rad * 0.3 * math.cos(ang), Y0 + 0.075, VZ + rad * 0.3 * math.sin(ang)), c, 0.002, 0.002,
             hexc('#4a6a2a'))
    finish(mb, 'vaso_ervas', ['acetinado'], 'vc', check=True)

    # jarra de utensílios (direita, perto da geladeira)
    mb = MB()
    UX, UZ = 0.81, -0.53
    revolve(mb, [(0.0, 0.0), (0.046, 0.0), (0.05, 0.01), (0.05, 0.13), (0.054, 0.14), (0.048, 0.14), (0.045, 0.02)],
            (UX, Y0, UZ), segs=22, alb=lambda a, h, r: vary(hexc('#d7cfc0'), 0.02))
    for k, (dx, dz, tilt, kind) in enumerate([(-0.015, 0.0, 0.18, 'colher'), (0.015, 0.01, -0.15, 'espatula'),
                                              (0.0, -0.018, 0.05, 'concha')]):
        p0 = Vector((UX + dx, Y0 + 0.02, UZ + dz))
        tip = p0 + Vector((math.sin(tilt) * 0.24, 0.24, -0.02))
        if kind == 'concha':
            beam(mb, p0, tip, 0.006, 0.003, hexc('#a8a39c'))
            ellipsoid(mb, tip + Vector((0, 0.03, 0)), 0.03, 0.03, 0.015, M=rot_x(1.2), segs=12, rings=6,
                      alb=lambda *a: hexc('#a8a39c'))
        else:
            beam(mb, p0, tip, 0.009, 0.005, hexc('#9a6a3e'))
            ellipsoid(mb, tip + Vector((0, 0.025, 0)), 0.02 if kind == 'colher' else 0.024, 0.032, 0.005,
                      M=rot_z(-tilt), segs=10, rings=5, alb=lambda *a: hexc('#a87545'))
    finish(mb, 'jarra_utensilios', ['acetinado'], 'vc', check=True)

    # faixa da frente, fora da vista do retrato (|x| > 0,35): tábua redonda, colher de pau, frigideira, cascas de alho
    mb = MB()
    TRX, TRZ = -0.52, 0.52
    revolve(mb, [(0.0, 0.0), (0.08, 0.0), (0.085, 0.006), (0.085, 0.016), (0.08, 0.02), (0.0, 0.02)], (TRX, Y0, TRZ),
            segs=32, alb=lambda a, h, r: vary(mix(hexc('#a8743f'), hexc('#7d5228'), 0.5 + 0.5 * math.sin(r * 160)), 0.03))
    # meio limão e dentes de alho na tábua
    revolve(mb, [(0.0, 0.0), (0.026, 0.0), (0.03, 0.012), (0.03, 0.022), (0.0, 0.022)], (TRX + 0.025, Y0 + 0.02, TRZ - 0.01),
            M=rot_x(0.0), segs=16,
            alb=lambda a, h, r: hexc('#f2e27a') if h > 0.02 and r < 0.027 else hexc('#d9b52a'))
    for k in range(3):
        ellipsoid(mb, (TRX - 0.03 + 0.012 * k, Y0 + 0.027, TRZ + 0.03 - 0.008 * k), 0.008, 0.007, 0.015,
                  M=rot_y(0.5 + k), segs=10, rings=6, alb=lambda a, h, r: mix(hexc('#f3ebd6'), hexc('#d9c9a0'), 0.5 + 0.5 * h))
    # colher de pau deitada
    i0 = len(mb.t)
    beam(mb, (-0.12, 0.007, 0), (0.1, 0.007, 0), 0.013, 0.008, hexc('#a87545'))
    ellipsoid(mb, (0.14, 0.008, 0), 0.045, 0.008, 0.028, segs=12, rings=6, alb=lambda *a: hexc('#b07c48'))
    mb.xform(i0, rot_y(0.35), (0.5, Y0, 0.53))
    # frigideira de ferro com cabo para a direita
    FRX, FRZ = 0.95, 0.43
    revolve(mb, [(0.0, 0.0), (0.1, 0.0), (0.12, 0.01), (0.13, 0.045), (0.124, 0.046), (0.114, 0.012), (0.095, 0.006),
                 (0.0, 0.006)], (FRX, Y0, FRZ), segs=36, alb=lambda *a: hexc('#2a2726'))
    beam(mb, (FRX + 0.125, Y0 + 0.04, FRZ), (FRX + 0.31, Y0 + 0.06, FRZ - 0.03), 0.022, 0.012, hexc('#2a2726'))
    # cascas de alho soltas
    rs = random.Random(21)
    for (cx_, cz_) in ((-0.41, 0.5), (-0.62, 0.42), (0.68, 0.36), (0.42, 0.47), (-0.47, 0.58)):
        for k in range(2):
            px_, pz_ = cx_ + rs.uniform(-0.02, 0.02), cz_ + rs.uniform(-0.015, 0.015)
            ellipsoid(mb, (px_, Y0 + 0.0015, pz_), 0.012, 0.0015, 0.007, M=rot_y(rs.uniform(0, 3)), segs=8, rings=3,
                      alb=lambda *a: vary(hexc('#e8dcc6'), 0.05))
    finish(mb, 'frente_props', ['acetinado'], 'vc', check=True)

    # laterais (|x| > 0,6): tabuinha com fatias de pão de alho à direita, pote de alho em conserva à esquerda
    mb = MB()
    i0 = len(mb.t)
    box(mb, -0.055, 0.055, 0.0, 0.016, -0.13, 0.13, lambda p: vary(hexc('#9a6a3c'), 0.03), step=0.03)
    for k in range(4):
        # fatia: topo gratinado com salsinha, laterais de casca
        ellipsoid(mb, (0.0, 0.03, -0.09 + k * 0.058), 0.036, 0.014, 0.026, M=rot_x(-0.25), segs=14, rings=6,
                  alb=lambda a, h, r, k=k: (hexc('#e2b056') if (math.sin(a * 13 + k) < 0.7) else hexc('#4f7a2a'))
                  if h > 0.5 else hexc('#c98a3e'))
    mb.xform(i0, rot_y(0.12), (0.69, Y0, 0.15))
    finish(mb, 'tabua_pao', ['acetinado'], 'vc', check=True)
    mb = MB()
    CJX, CJZ = -0.70, -0.265
    revolve(mb, [(0.044, 0.0), (0.05, 0.008), (0.05, 0.15), (0.042, 0.163), (0.04, 0.17)], (CJX, Y0, CJZ), segs=22,
            cap_bottom=False)
    finish(mb, 'pote_conserva_vidro', ['vidro'], 'vc', check=True)
    mb = MB()
    revolve(mb, [(0.045, 0.003), (0.045, 0.12)], (CJX, Y0, CJZ), segs=18, cap_top=True,
            alb=lambda a, h, r: mix(hexc('#efe4c8'), hexc('#c9b98a'), 0.5 + 0.5 * math.sin(a * 11 + h * 120)))
    revolve(mb, [(0.041, 0.158), (0.043, 0.18), (0.03, 0.184)], (CJX, Y0, CJZ), segs=18, cap_bottom=False, cap_top=True,
            alb=lambda *a: hexc('#b8302a'))
    finish(mb, 'pote_conserva', ['acetinado'], 'vc', check=True)

    # temperos no fundo, sob a prateleira (baixos: a mão passa por cima)
    mb = MB()
    # saleiro e pimenteiro
    for k, (sx_, colr) in enumerate(()):
        revolve(mb, [(0.0, 0.0), (0.016, 0.0), (0.018, 0.01), (0.016, 0.05), (0.018, 0.062), (0.012, 0.072),
                     (0.0, 0.074)], (sx_, Y0, -0.56 + 0.012 * k), segs=16,
                alb=lambda a, h, r, colr=colr: hexc('#b8b3ab') if h > 0.06 else hexc(colr), cap_bottom=False)
    # tábua com cabeças de alho
    i0 = len(mb.t)
    box(mb, -0.09, 0.09, 0.0, 0.014, -0.05, 0.05, hexc('#8a5a32'), step=0.03)
    mb.xform(i0, rot_y(0.12), (0.03, Y0, -0.535))
    garlic(mb, (-0.01, Y0 + 0.037, -0.54), 0.027, seed=61)
    garlic(mb, (0.05, Y0 + 0.036, -0.525), 0.026, M=rot_z(0.4), seed=62)
    garlic(mb, (0.08, Y0 + 0.033, -0.56), 0.023, M=rot_x(-0.5), seed=63)
    # pilão de pedra
    revolve(mb, [(0.0, 0.0), (0.04, 0.0), (0.05, 0.02), (0.052, 0.055), (0.044, 0.056), (0.038, 0.025), (0.0, 0.02)],
            (0.25, Y0, -0.55), segs=24, alb=lambda *a: vary(hexc('#7e7a74'), 0.05), cap_bottom=False)
    beam(mb, (0.245, Y0 + 0.03, -0.55), (0.29, Y0 + 0.13, -0.53), 0.018, 0.018, hexc('#8a857e'))
    # ramequins de páprica e ervas
    for k, (rx_, colr) in enumerate(((0.14, '#b8401e'), (0.33, '#55702a'))):
        c = (rx_, Y0, -0.545 + 0.02 * k)
        revolve(mb, [(0.0, 0.0), (0.024, 0.0), (0.032, 0.012), (0.033, 0.03), (0.029, 0.03), (0.027, 0.012),
                     (0.0, 0.008)], c, segs=18, alb=lambda *a: hexc('#e9e2d4'), cap_bottom=False)
        revolve(mb, [(0.0, 0.026), (0.028, 0.024), (0.0, 0.032)], c, segs=18,
                alb=lambda *a, colr=colr: vary(hexc(colr), 0.08), cap_bottom=False)
    finish(mb, 'temperos', ['acetinado'], 'vc', check=True)

    # geladeira de bebidas (fundo, direita): caixa escura, porta de vidro, latas e garrafas, luz fria
    mb = MB()
    G0, G1, GZ0, GZ1, GH = 0.95, 1.47, WALL, -0.25, 0.58
    body = hexc('#2a2a2c')
    T = 0.03
    box(mb, G0, G1, Y0, Y0 + T, GZ0, GZ1, body, step=0.1)
    box(mb, G0, G1, Y0 + GH - T, Y0 + GH, GZ0, GZ1, body, step=0.1)
    box(mb, G0, G0 + T, Y0, Y0 + GH, GZ0, GZ1, body, step=0.1)
    box(mb, G1 - T, G1, Y0, Y0 + GH, GZ0, GZ1, body, step=0.1)
    box(mb, G0, G1, Y0, Y0 + GH, GZ0, GZ0 + 0.02, hexc('#c9ced2'), step=0.08)
    # moldura da porta + puxador
    box(mb, G0, G1, Y0, Y0 + 0.06, GZ1, GZ1 + 0.02, body, step=0.1)
    box(mb, G0, G1, Y0 + GH - 0.08, Y0 + GH, GZ1, GZ1 + 0.02, hexc('#b8302a'), step=0.1)
    box(mb, G0, G0 + 0.03, Y0, Y0 + GH, GZ1, GZ1 + 0.02, body, step=0.1)
    box(mb, G1 - 0.03, G1, Y0, Y0 + GH, GZ1, GZ1 + 0.02, body, step=0.1)
    box(mb, G1 - 0.05, G1 - 0.04, Y0 + 0.12, Y0 + 0.44, GZ1 + 0.02, GZ1 + 0.035, hexc('#9a958f'), step=0.1)
    cans = ['#c0262d', '#2f7d3a', '#e0b13a', '#c0262d', '#1f4f9a', '#e8e4dc']
    for k, sy in enumerate((Y0 + T, Y0 + 0.21, Y0 + 0.38)):
        if k > 0:
            box(mb, G0 + T, G1 - T, sy - 0.006, sy, GZ0 + 0.02, GZ1 - 0.02, hexc('#b9bec2'), step=0.1)
        for j in range(6):
            cx = G0 + 0.07 + j * 0.077
            colr = hexc(cans[(j + k * 2) % len(cans)])
            if (j + k) % 3 == 2 and k > 0:
                revolve(mb, [(0.0, 0.0), (0.026, 0.0), (0.026, 0.1), (0.012, 0.13), (0.01, 0.16), (0.0, 0.16)],
                        (cx, sy, -0.40), segs=12,
                        alb=lambda a, h, r: hexc('#e9dcc0') if 0.04 < h < 0.08 else hexc('#3a2a14'), cap_bottom=False)
            else:
                revolve(mb, [(0.0, 0.0), (0.03, 0.0), (0.033, 0.01), (0.033, 0.11), (0.028, 0.122), (0.0, 0.122)],
                        (cx, sy, -0.40 + 0.03 * (j % 2)), segs=12,
                        alb=lambda a, h, r, colr=colr: hexc('#c8c8c8') if h > 0.112 else
                        mix(colr, (1, 1, 1), 0.6 if 0.05 < h < 0.06 else 0.0), cap_bottom=False)
    finish(mb, 'geladeira_bebidas', ['acetinado'], 'vc', check=True)
    mb = MB()
    box(mb, G0 + 0.03, G1 - 0.03, Y0 + 0.06, Y0 + GH - 0.08, GZ1 + 0.008, GZ1 + 0.012, (1, 1, 1), step=0.2)
    finish(mb, 'geladeira_vidro', ['vidro'], 'vc')
    mb = MB()
    box(mb, G0 + 0.05, G1 - 0.05, Y0 + GH - T - 0.008, Y0 + GH - T, GZ0 + 0.04, GZ0 + 0.1, (1, 1, 1), step=0.3,
        skip=('+y',))
    finish(mb, 'geladeira_luz', ['luz_fria'], 'emit')


# ---------------------------------------------------------------- checagem das zonas livres
def check_zonas():
    bad = []
    for name in PROPS_CHECK:
        o = bpy.data.objects[name]
        V = np.array([o.matrix_world @ v.co for v in o.data.vertices])
        # cada peça solta (ilha da malha) tem a sua caixa no tampo
        par = list(range(len(V)))

        def fnd(i):
            while par[i] != i:
                par[i] = par[par[i]]
                i = par[i]
            return i
        for e in o.data.edges:
            a, b = fnd(e.vertices[0]), fnd(e.vertices[1])
            if a != b:
                par[a] = b
        lab = np.array([fnd(i) for i in range(len(V))])
        for isl in np.unique(lab):
            P = V[lab == isl]
            x, z = P[:, 0], -P[:, 1]
            x0, x1, z0, z1 = x.min(), x.max(), z.min(), z.max()
            for (a0, a1, b0, b1) in ZONAS:
                if x0 < a1 and x1 > a0 and z0 < b1 and z1 > b0:
                    bad.append((name, (round(x0, 3), round(x1, 3), round(z0, 3), round(z1, 3)), (a0, a1, b0, b1)))
                    break
        x, z = V[:, 0], -V[:, 1]
        print('PROP %-18s x %.3f..%.3f  z %.3f..%.3f  (%d peças)' % (name, x.min(), x.max(), z.min(), z.max(),
                                                                    len(np.unique(lab))))
    # objetos de fundo (prateleira, réstia, quadro...): nenhum vértice dentro de uma zona
    for o in OBJS:
        if o.name in PROPS_CHECK or o.name in ('tampo', 'parede', 'balcao_frente', 'puxadores', 'luminaria', 'lampada'):
            continue
        V = np.array([o.matrix_world @ v.co for v in o.data.vertices])
        x, z = V[:, 0], -V[:, 1]
        for (a0, a1, b0, b1) in ZONAS:
            m = (x > a0) & (x < a1) & (z > b0) & (z < b1)
            if m.any():
                bad.append((o.name, 'vértices dentro', (a0, a1, b0, b1)))
                break
    if bad:
        for b in bad:
            print('ZONA_INVADIDA', b)
        raise SystemExit('zona de jogo invadida')
    print('ZONAS_OK', len(PROPS_CHECK), 'props')


# ---------------------------------------------------------------- luz e bake
def b3(v):
    return Vector((v[0], -v[2], v[1]))


def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def use_gpu(sc):
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for dt in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = dt
                prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == dt]
                if devs:
                    for d in prefs.devices:
                        d.use = d.type == dt
                    sc.cycles.device = 'GPU'
                    print('GPU', dt)
                    return
            except Exception:
                pass
    except Exception as e:
        print('sem gpu', e)


def add_light(name, kind, pos, energy, color, target=None, **kw):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy; ld.color = color
    for k, v in kw.items():
        setattr(ld, k, v)
    o = bpy.data.objects.new(name, ld); bpy.context.scene.collection.objects.link(o)
    o.location = b3(pos)
    if target is not None:
        look_at(o, b3(target))
    return o


def bake_lights():
    sc = bpy.context.scene
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.09, 0.065, 0.05, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    w.light_settings.distance = 0.12
    for o in OBJS:
        if o['kind'] == 'emit' or 'vidro' in o['mats']:
            o.visible_shadow = False
    LX, LZ = LAMP
    add_light('pendente', 'SPOT', (LX, 0.845, LZ), 60, (1.0, 0.72, 0.45), (LX, 0, LZ),
              spot_size=math.radians(70), spot_blend=0.85, shadow_soft_size=0.03)
    add_light('lampada_luz', 'POINT', (LX, 0.9, LZ), 3, (1.0, 0.75, 0.5), shadow_soft_size=0.03)
    led = add_light('led', 'AREA', ((SH_X0 + SH_X1) / 2, SH_Y0 - 0.014, SH_Z1 - 0.03), 190, (1.0, 0.64, 0.34),
                    shape='RECTANGLE', size=SH_X1 - SH_X0 - 0.05, size_y=0.016)
    led.rotation_euler = (0, 0, 0)            # área aponta para -Z do Blender = para baixo
    add_light('recorte', 'AREA', (1.1, 0.6, -0.15), 40, (1.0, 0.6, 0.32), (0, 0, -0.2), size=0.8)
    add_light('preench', 'AREA', (0.0, 1.5, 1.6), 18, (1.0, 0.9, 0.78), (0, 0, -0.1), size=2.5)
    add_light('lado_esq', 'AREA', (-1.7, 0.9, 0.5), 20, (1.0, 0.82, 0.62), (-0.9, 0, -0.2), size=1.2)
    add_light('lado_dir', 'AREA', (1.9, 0.9, 0.5), 15, (1.0, 0.82, 0.62), (1.0, 0, -0.2), size=1.2)
    add_light('geladeira', 'POINT', (1.21, 0.47, -0.43), 3, (0.82, 0.9, 1.0), shadow_soft_size=0.05)


def attr_get(me, name):
    a = me.color_attributes[name]
    arr = np.empty(len(a.data) * 4, dtype=np.float32)
    a.data.foreach_get('color', arr)
    return arr.reshape(-1, 4)


def attr_set(me, name, arr):
    me.color_attributes[name].data.foreach_set('color', arr.astype(np.float32).ravel())


def smooth_vals(me, vals, iters=2):
    e = np.empty(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get('vertices', e)
    e = e.reshape(-1, 2)
    if len(e) == 0:
        return vals
    for _ in range(iters):
        acc = np.zeros_like(vals); deg = np.zeros(len(vals))
        np.add.at(acc, e[:, 0], vals[e[:, 1]]); np.add.at(acc, e[:, 1], vals[e[:, 0]])
        np.add.at(deg, e[:, 0], 1); np.add.at(deg, e[:, 1], 1)
        m = deg > 0
        vals = vals.copy()
        vals[m] = 0.5 * vals[m] + 0.5 * acc[m] / deg[m][:, None]
    return vals


def bake():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    use_gpu(sc)
    sc.cycles.samples = 48 if QUICK else 384
    sc.render.bake.target = 'VERTEX_COLORS'
    meshes = [o for o in OBJS]
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS')
    irr = {o.name: attr_get(o.data, 'Col')[:, :3].copy() for o in meshes}
    sc.cycles.samples = 32 if QUICK else 128
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    ao = {o.name: attr_get(o.data, 'Col')[:, :1].copy() for o in meshes}
    # referência: tampo sob a luminária
    t = bpy.data.objects['tampo']
    V = np.array([v.co for v in t.data.vertices])
    m = (np.abs(V[:, 0]) < 0.25) & (np.abs(V[:, 1]) < 0.25)
    ref = float(np.median(irr['tampo'][m].mean(axis=1)))
    print('BAKE ref', ref)
    for o in meshes:
        me = o.data
        alb = attr_get(me, 'Alb')
        E = smooth_vals(me, irr[o.name] / ref, 2 if o.name in ('tampo', 'parede') else 1)
        A = smooth_vals(me, ao[o.name], 1)
        L = np.clip(E, 0, None) ** 1.4 * (0.45 + 0.55 * A)
        L = 0.05 + L / (1.0 + 0.12 * L)                     # ombro suave: o centro não estoura
        L = np.clip(L * 1.12, 0.0, 1.0)
        if o['kind'] == 'emit':
            out = np.ones_like(alb)
        else:
            out = np.ones_like(alb)
            out[:, :3] = L * alb[:, :3]
        attr_set(me, 'Col', out)
        p = np.percentile(L.mean(axis=1), [5, 50, 95])
        print('BAKE %-18s verts %6d  luz p5 %.2f p50 %.2f p95 %.2f' % (o.name, len(me.vertices), *p))


def to_export():
    for o in OBJS:
        me = o.data
        me.color_attributes.remove(me.color_attributes['Alb'])
        me.color_attributes.active_color = me.color_attributes['Col']
        names = list(o['mats'])
        for i, nm_ in enumerate(names):
            me.materials[i] = build_mat(nm_, False)
    for m in list(bpy.data.materials):
        if m.name.startswith('bake_') and m.users == 0:
            bpy.data.materials.remove(m)


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def export():
    os.makedirs(MODELS, exist_ok=True)
    for o in list(bpy.data.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    ROOT_OBJ.select_set(True)
    for o in OBJS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = ROOT_OBJ
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_cameras=False, export_lights=False, export_materials='EXPORT', export_normals=True,
        export_vertex_color='ACTIVE', export_image_format='JPEG', export_image_quality=80,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=10,
        export_draco_generic_quantization=12)
    tris = sum(tri_count(o) for o in OBJS)
    size = os.path.getsize(OUT_GLB)
    print('EXPORT cozinha.glb %d bytes (%.1f KB) %d tris' % (size, size / 1024, tris))
    for o in OBJS:
        print('  NODE %-18s %6d tris  mats %s' % (o.name, tri_count(o), ','.join(o['mats'])))
    return size, tris


# ---------------------------------------------------------------- renders de revisão (a partir do GLB exportado)
# Câmeras SUGERIDAS para a próxima tarefa (layout.ts ainda tem as antigas: retrato pos (0, 0.94, 0.98) alvo
# (0, 0, -0.01) fov 47; paisagem pos (0, 0.6, 0.76) alvo (0, 0.02, 0) fov 40). Os renders usam as sugeridas.
CAMERAS = {
    'retrato': dict(pos=(0, 1.05, 1.45), alvo=(0, 0.08, -0.1), fov=58, w=900, h=1600),
    'paisagem': dict(pos=(0, 0.5, 0.85), alvo=(0, 0.12, -0.15), fov=44, w=1600, h=900),
}
LANCHE = ['tabua', 'pao', 'costela', 'mussarela', 'gratinado']
# estações da Costela (layout.ts, LUGARES_PAO)
EST_COSTELA = {
    'retrato': dict(pasta=(-0.15, -0.25), creme=(0.14, -0.26), costela=(-0.165, 0.27), mussarela=(0.025, 0.3),
                    macarico=(0.205, 0.25)),
    'paisagem': dict(pasta=(-0.36, -0.11), costela=(-0.38, 0.15), creme=(0.42, -0.15), mussarela=(0.42, 0.17),
                     macarico=(0.21, -0.27)),
}


def place_on_table(objs, x, z):
    """Põe o conjunto importado com o centro da caixa em (x, z) e a base no tampo."""
    roots = [o for o in objs if o.parent is None]
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    if not pts:
        return
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    bz = min(p.z for p in pts)
    d = Vector((x - cx, -z - cy, MESA - bz))
    for r in roots:
        r.location += d


def tigela(sc, x, z, cor, monte):
    """Tigela de cerâmica com um monte (estação de recheio), feita na hora só para a revisão."""
    mb = MB()
    revolve(mb, [(0.0, 0.0), (0.04, 0.0), (0.07, 0.03), (0.08, 0.055), (0.075, 0.056), (0.064, 0.03), (0.0, 0.012)],
            (x, MESA, z), segs=32, cap_bottom=False)
    me = bpy.data.meshes.new('tigela'); me.from_pydata([(p.x, -p.z, p.y) for p in mb.t], [], mb.f)
    me.shade_smooth()
    m = bpy.data.materials.new('tig'); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.75, 0.68, 0.6, 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.25
    me.materials.append(m)
    o1 = bpy.data.objects.new('tigela', me); sc.collection.objects.link(o1)
    mb = MB()
    ellipsoid(mb, (x, MESA + 0.03, z), 0.06, 0.035, 0.06, segs=20, rings=8,
              rfun=lambda a, h: 1.0 + 0.12 * math.sin(a * 7) * math.cos(h * 9))
    me = bpy.data.meshes.new('monte'); me.from_pydata([(p.x, -p.z, p.y) for p in mb.t], [], mb.f)
    me.shade_smooth()
    m = bpy.data.materials.new('monte'); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = cor
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.6
    me.materials.append(m)
    o2 = bpy.data.objects.new('monte', me); sc.collection.objects.link(o2)
    return [o1, o2]


def estacoes_review(arr):
    sc = bpy.context.scene
    E = EST_COSTELA[arr]
    out = []
    for nome, glbn in (('pasta', 'bisnaga'), ('creme', 'pote-creme'), ('macarico', 'macarico-mao')):
        objs = import_glb(os.path.join(MODELS, glbn + '.glb'))
        place_on_table(objs, *E[nome])
        out += objs
    out += tigela(sc, *E['costela'], (0.18, 0.07, 0.03, 1), True)
    out += tigela(sc, *E['mussarela'], (0.85, 0.72, 0.42, 1), True)
    return out


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def review_shading(objs):
    """Imita o three.js: base = textura x COLOR_0, luz = hemisfério/ambiente (mundo) + 2 direcionais."""
    done = set()
    for o in objs:
        if o.type != 'MESH' or not o.data.color_attributes:
            continue
        cname = o.data.color_attributes[0].name
        for m in o.data.materials:
            if m is None or m.name in done:
                continue
            done.add(m.name)
            nt = m.node_tree
            b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b is None:
                continue
            if any(n.type in ('VERTEX_COLOR',) or (n.type == 'ATTRIBUTE') for n in nt.nodes):
                continue
            vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = cname
            src = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].is_linked else None
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
            mx.inputs['Factor'].default_value = 1.0
            if src is not None:
                nt.links.new(src, mx.inputs['A'])
            else:
                mx.inputs['A'].default_value = b.inputs['Base Color'].default_value
            nt.links.new(vc.outputs['Color'], mx.inputs['B'])
            nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])


def review_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    objs = import_glb(OUT_GLB)
    review_shading(objs)
    for o in objs:
        if o.name.startswith(('luminaria', 'lampada')):
            o.visible_shadow = False      # no site a luminária não projeta sombra (castShadow desligado)
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (1.0, 0.9, 0.78, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.30
    # Cena.tsx: direcional quente (0.15, 1.1, 0.35) 2,6 e direcional de preenchimento (-0.6, 0.5, 0.8) 0,7
    for nm_, d, e, c in (('key', (0.15, 1.1, 0.35), 2.6, (1.0, 0.85, 0.66)), ('fill', (-0.6, 0.5, 0.8), 0.7, (1, 0.94, 0.86))):
        ld = bpy.data.lights.new(nm_, 'SUN'); ld.energy = e; ld.color = c; ld.angle = math.radians(2)
        lo = bpy.data.objects.new(nm_, ld); sc.collection.objects.link(lo)
        lo.location = b3(d)
        look_at(lo, (0, 0, 0))
    sc.render.engine = 'CYCLES'
    use_gpu(sc)
    sc.cycles.samples = 24 if QUICK else 96
    sc.cycles.use_denoising = True
    for vt in ('ACES 1.3', 'ACES 2.0', 'AgX'):
        try:
            sc.view_settings.view_transform = vt
            break
        except Exception:
            pass
    print('VIEW', sc.view_settings.view_transform)
    sc.render.image_settings.file_format = 'PNG'
    return sc


def camera(sc, name, pos, alvo, fov, w, h, ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24.0
    cd.lens = 12.0 / math.tan(math.radians(fov / 2))
    cd.clip_start = 0.01; cd.clip_end = 30
    if ortho:
        cd.type = 'ORTHO'; cd.ortho_scale = ortho
    co = bpy.data.objects.new(name, cd); sc.collection.objects.link(co)
    co.location = b3(pos); look_at(co, b3(alvo))
    sc.camera = co
    sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.render.resolution_percentage = 50 if QUICK else 100
    return co


def render(sc, fname):
    os.makedirs(RENDERS, exist_ok=True)
    sc.render.filepath = os.path.join(RENDERS, fname)
    bpy.ops.render.render(write_still=True)
    print('RENDER_OK', sc.render.filepath)
    return sc.render.filepath


def rot_cam(c, deg, k=1.0):
    a = math.radians(deg)
    p, t = Vector(c['pos']), Vector(c['alvo'])
    p = t + (p - t) * k
    M = Matrix.Rotation(a, 3, 'Z')     # em three: giro em torno de y; aqui vetores three -> usa x,z
    def ry(v):
        return Vector((v.x * math.cos(a) + v.z * math.sin(a), v.y, -v.x * math.sin(a) + v.z * math.cos(a)))
    return tuple(ry(p)), tuple(ry(t))


def want(v):
    return VIEWS == 'all' or v in VIEWS.split(',')


def renders():
    sc = review_scene()
    out = {}
    for arr, c in CAMERAS.items():
        for tag, deg, k in (('01-frontal', 0, 1.0), ('02-giro-menos35', -35, 1.0), ('03-giro-mais35', 35, 1.0),
                            ('04-afastado', 0, 1.4)):
            if not want(tag[:2]):
                continue
            pos, alvo = rot_cam(c, deg, k)
            camera(sc, 'cam', pos, alvo, c['fov'], c['w'], c['h'])
            out[(arr, tag)] = render(sc, '%s-%s.png' % (arr, tag))
    # topo com as zonas de jogo
    if want('06'):
        mats = {}
        for arr, colr in (('retrato', (1, 0.1, 0.1, 1)), ('paisagem', (0.1, 0.9, 1, 1))):
            m = bpy.data.materials.new('z_' + arr); m.use_nodes = True
            nt = m.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF'])
            em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = colr
            em.inputs['Strength'].default_value = 3
            nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs[0])
            mb = MB()
            yy = 1.25 if arr == 'retrato' else 1.26
            for (x0, x1, z0, z1) in zonas(arr):
                for (a, b) in (((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x1, z1), (x0, z1)), ((x0, z1), (x0, z0))):
                    beam(mb, (a[0], yy, a[1]), (b[0], yy, b[1]), 0.004, 0.002)
            V = [(p.x, -p.z, p.y) for p in mb.t]
            me = bpy.data.meshes.new('z_' + arr); me.from_pydata(V, [], mb.f); me.materials.append(m)
            o = bpy.data.objects.new('z_' + arr, me); sc.collection.objects.link(o)
            mats[arr] = o
        co = camera(sc, 'cam_topo', (0, 3.0, -0.12), (0, 0, -0.12), 30, 1600, 1000, ortho=2.6)
        co.rotation_euler = (0, 0, 0)   # olhando para baixo, parede no alto da imagem
        out['topo'] = render(sc, '06-topo-zonas.png')
        for o in mats.values():
            bpy.data.objects.remove(o)
    # lanche montado na tábua (escala)
    if want('05'):
        for n in LANCHE:
            import_glb(os.path.join(MODELS, n + '.glb'))
        review_shading(list(bpy.data.objects))
        for arr, c in CAMERAS.items():
            est = estacoes_review(arr)
            review_shading(est)
            camera(sc, 'cam', c['pos'], c['alvo'], c['fov'], c['w'], c['h'])
            out[(arr, '05')] = render(sc, '%s-05-lanche.png' % arr)
            for o in est:
                bpy.data.objects.remove(o)
    # lado a lado com o k1 (com tábua, lanche e estações da Costela, de igual para igual)
    fr = os.path.join(RENDERS, 'paisagem-05-lanche.png')
    if want('07') and os.path.exists(fr) and os.path.exists(K1):
        side_by_side(K1, fr, os.path.join(RENDERS, '07-lado-a-lado-k1.png'))
    return out


def side_by_side(a, b, dst, H=600):
    ims = []
    for p in (a, b):
        im = bpy.data.images.load(p)
        w, h = im.size
        im.scale(int(w * H / h), H)
        px = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        ims.append(px.reshape(H, im.size[0], 4))
    gap = np.zeros((H, 16, 4), dtype=np.float32); gap[..., 3] = 1
    comb = np.concatenate([ims[0], gap, ims[1]], axis=1)
    out = bpy.data.images.new('lado', comb.shape[1], H, alpha=False)
    out.pixels.foreach_set(comb.ravel())
    out.filepath_raw = dst; out.file_format = 'PNG'
    out.save()
    print('RENDER_OK', dst)


# ---------------------------------------------------------------- main
if BUILD:
    build_scene()
    check_zonas()
    bake_lights()
    bake()
    to_export()
    size, tris = export()
    if size > 900 * 1024 or tris > 70000:
        print('ORCAMENTO_ESTOURADO', size, tris)
if RENDER:
    renders()
print('FIM')
