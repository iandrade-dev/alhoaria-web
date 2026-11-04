"""
LAR-429 (B1) - Modelos 3D da bancada "A Costela!" (Alhoaria).

Gera, por script e do zero, os GLBs das camadas do lanche + tabua + macarico,
os renders de revisao e o poster. Veja README.md para o contrato.

    blender.exe -b --factory-startup -P build_bancada.py -- [opcoes]

Opcoes:
    --renders DIR   pasta dos PNGs de revisao (fora do repo)
    --parts a,b     so constroi/exporta essas pecas (padrao: todas)
    --views a,b     so renderiza essas vistas (padrao: todas; "none" nao renderiza)
    --quick         renders 600 px / poucas amostras (iteracao)
    --no-poster     nao gera o poster webp
Tudo e procedural (listas de vertices + curvas de superficie); nada e baixado.
Blender: eixo Z para cima; o exportador converte para Y para cima (glTF).
"""
import bpy
import math
import os
import sys
import random
import argparse
import numpy as np
from mathutils import Vector, noise

# ----------------------------------------------------------------------------
# argumentos / caminhos
# ----------------------------------------------------------------------------
_argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--renders", default=r"\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-429-modelos-a2\renders")
ap.add_argument("--parts", default="all")
ap.add_argument("--views", default="all")
ap.add_argument("--quick", action="store_true")
ap.add_argument("--no-poster", action="store_true")
ARGS = ap.parse_args(_argv)

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
MODELS = os.path.join(REPO, "public", "assets", "models", "bancada")
POSTER_DIR = os.path.join(REPO, "public", "assets", "bancada")
POSTER = os.path.join(POSTER_DIR, "lanche-pronto.webp")

PARTS = ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "macarico"]
SEL_PARTS = PARTS if ARGS.parts == "all" else ([] if ARGS.parts == "none" else ARGS.parts.split(","))

# ----------------------------------------------------------------------------
# utilidades de cor / ruido / matematica
# ----------------------------------------------------------------------------


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lerp(a, b, t):
    return a + (b - a) * t


def lerpc(a, b, t):
    return tuple(lerp(a[i], b[i], t) for i in range(3))


def mulc(a, k):
    return tuple(min(1.0, max(0.0, a[i] * k)) for i in range(3))


def clamp(x, a=0.0, b=1.0):
    return a if x < a else (b if x > b else x)


def smooth(a, b, x):
    t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def nz(x, y=0.0, z=0.0):
    return noise.noise(Vector((x, y, z)))


def fbm(x, y=0.0, z=0.0, o=3):
    return noise.fractal(Vector((x, y, z)), 0.5, 2.0, o)


class MB:
    """Acumulador de malha: vertices (cor sRGB), faces, indice de material."""

    def __init__(self):
        self.v, self.c, self.f, self.fm, self.uv = [], [], [], [], []

    def add(self, p, c=(1.0, 1.0, 1.0), uv=None):
        self.v.append((float(p[0]), float(p[1]), float(p[2])))
        self.c.append(tuple(c))
        self.uv.append(uv)
        return len(self.v) - 1

    def face(self, *idx, m=0):
        self.f.append(tuple(idx))
        self.fm.append(m)

    def quad(self, a, b, c, d, m=0):
        self.face(a, b, c, d, m=m)

    def tri(self, a, b, c, m=0):
        self.face(a, b, c, m=m)


def finish(mb, name, mats, parent, uvfn=None, weld=True, vc_white=False):
    """Solda vertices coincidentes, remove faces degeneradas e cria o objeto.
    UVs: por vertice (mb.add(..., uv=)) ou por posicao (uvfn)."""
    has_uv = any(u is not None for u in mb.uv)
    if weld:
        key2new, remap, V, C, U = {}, [], [], [], []
        for i, p in enumerate(mb.v):
            k = (round(p[0] * 1e6), round(p[1] * 1e6), round(p[2] * 1e6))
            if has_uv and mb.uv[i] is not None:
                k += (round(mb.uv[i][0] * 1e4), round(mb.uv[i][1] * 1e4))
            if k not in key2new:
                key2new[k] = len(V)
                V.append(p)
                C.append(mb.c[i])
                U.append(mb.uv[i] if mb.uv[i] is not None else (0.0, 0.0))
            remap.append(key2new[k])
    else:
        V, C, remap = list(mb.v), list(mb.c), list(range(len(mb.v)))
        U = [u if u is not None else (0.0, 0.0) for u in mb.uv]
    F, FM = [], []
    for f, m in zip(mb.f, mb.fm):
        g = []
        for i in f:
            j = remap[i]
            if not g or g[-1] != j:
                g.append(j)
        if len(g) > 1 and g[0] == g[-1]:
            g.pop()
        if len(set(g)) < 3 or len(set(g)) != len(g):
            continue
        F.append(tuple(g))
        FM.append(m)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(V, [], F)
    mesh.update()
    mesh.validate()
    cols = np.zeros((len(V), 4), dtype=np.float32)
    for i, c in enumerate(C):
        cols[i] = (1.0, 1.0, 1.0, 1.0) if vc_white else (s2l(c[0]), s2l(c[1]), s2l(c[2]), 1.0)
    ca = mesh.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", cols.ravel())
    mesh.color_attributes.active_color = ca
    for m in mats:
        mesh.materials.append(m)
    if len(mats) > 1 and len(FM) == len(mesh.polygons):
        mesh.polygons.foreach_set("material_index", FM)
    if uvfn is not None or has_uv:
        uv = mesh.uv_layers.new(name="UVMap")
        vi = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get("vertex_index", vi)
        if has_uv:
            uvs = np.array(U, dtype=np.float32)[vi]
        else:
            co = np.array(V, dtype=np.float32)[vi]
            uvs = np.array([uvfn(p) for p in co], dtype=np.float32)
        uv.data.foreach_set("uv", uvs.ravel())
    mesh.shade_smooth()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def tri_count(obj):
    n = 0
    for p in obj.data.polygons:
        n += len(p.vertices) - 2
    return n


def root_empty(name):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(e)
    return e


# ----------------------------------------------------------------------------
# materiais
# ----------------------------------------------------------------------------


def make_mat(name, base=(1, 1, 1), rough=0.5, metal=0.0, vcol=True, emit=None, emit_s=1.0,
             image=None, spec=0.5, coat=0.0, normal_image=None, normal_strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    try:
        b.inputs["Specular IOR Level"].default_value = spec
    except KeyError:
        pass
    if coat > 0:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.12
    b.inputs["Base Color"].default_value = (s2l(base[0]), s2l(base[1]), s2l(base[2]), 1.0)
    if vcol:
        n = nt.nodes.new("ShaderNodeVertexColor")
        n.layer_name = "Col"
        nt.links.new(n.outputs["Color"], b.inputs["Base Color"])
    if image is not None:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = image
        nt.links.new(n.outputs["Color"], b.inputs["Base Color"])
    if normal_image is not None:
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = normal_image
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    if emit is not None:
        b.inputs["Emission Color"].default_value = (s2l(emit[0]), s2l(emit[1]), s2l(emit[2]), 1.0)
        b.inputs["Emission Strength"].default_value = emit_s
    return m


# ----------------------------------------------------------------------------
# geometria do PAO (barquinho): funcoes analiticas compartilhadas por todas as camadas
# ----------------------------------------------------------------------------
L = 0.150          # meio comprimento (pao tem 0,30 m)
WB = 0.052         # meia largura
HB = 0.084         # altura do pao inteiro (cortado ao meio na horizontal, z = HB/2)
NEXP = 2.6         # expoente da superelipse da secao
XM = 0.140         # fim do monte de recheio
DISH = 0.007       # concavidade do miolo da base
DCAV = 0.027       # cavidade do miolo sob a tampa (recheio "aperta" nela)
PK = 0.011         # altura do monte de costela acima do corte
HINGE_DEG = 110.0  # abertura da tampa exportada
OPEN_RAD = -math.radians(HINGE_DEG)   # rotacao X (local) da tampa ABERTA; fechar = 0


def bprof(x):
    t = min(abs(x) / L, 0.9995)
    s = (1 - t ** 4) ** 0.5
    Wb = WB * s ** 0.85
    Hb = HB * s ** 0.6
    return dict(Wb=Wb, Hb=Hb, zc=Hb / 2, s=s)


def zouter(x, y):
    """z da casca externa (metade de cima, tampa) em (x, |y|)."""
    p = bprof(x)
    y = min(abs(y), 0.999 * p["Wb"])
    c = (y / p["Wb"]) ** (NEXP / 2)
    return p["zc"] + (p["Hb"] / 2) * (max(0.0, 1 - c * c)) ** (1 / NEXP)


def outer_normal(x, y, z):
    """normal (ny, nz) da casca externa para y>0 (gradiente da superelipse)."""
    p = bprof(x)
    a = abs(y) / p["Wb"]
    b = (z - p["zc"]) / (p["Hb"] / 2)
    gy = a ** (NEXP - 1) / p["Wb"]
    gz = math.copysign(abs(b) ** (NEXP - 1), b) / (p["Hb"] / 2)
    n = math.hypot(gy, gz) or 1.0
    return gy / n, gz / n


def by_of(x):
    """meia largura do recheio (costela/pasta/creme)."""
    return 0.9 * bprof(x)["Wb"]


def bym(x):
    """meia largura de referencia da mussarela sobre a tampa."""
    return 0.94 * bprof(x)["Wb"]


def zface(x, y):
    """z do miolo da BASE (face cortada, levemente concava)."""
    p = bprof(x)
    yy = p["Wb"] - 0.004
    r = max(0.0, 1 - (y / yy) ** 2)
    rel = 0.0011 * nz(x * 60, y * 60, 11.3) + 0.0016 * fbm(x * 22, y * 22, 4.1, 2)
    return p["zc"] - DISH * p["s"] * r ** 0.8 + rel * min(1.0, r * 4)


def zunder(x, y):
    """z do miolo da TAMPA (face cortada com cavidade), posicao fechada."""
    p = bprof(x)
    yc = p["Wb"] - 0.0075
    r = max(0.0, 1 - (y / yc) ** 2)
    rel = 0.0011 * nz(x * 60, y * 60, 17.9) + 0.0016 * fbm(x * 22, y * 22, 9.7, 2)
    return p["zc"] + DCAV * p["s"] * math.sqrt(r) + rel * min(1.0, r * 4)


def pile(x, v, bump=1.0):
    """superficie superior do monte de costela (envelope) sobre a base, v = y / By(x)."""
    p = bprof(x)
    a = abs(v)
    tx = max(0.0, 1 - (abs(x) / XM) ** 4) ** 0.5
    zE = p["zc"] + 0.002
    if a <= 1.0:
        z = zE + PK * tx * (1 - a * a) ** 0.75
        z += bump * 0.0015 * nz(x * 38, a * by_of(x) * 38, 1.7) * tx
        return z
    return zE



def cos_spaced(n, half):
    return [half * math.sin(math.pi * (i / (n - 1) - 0.5)) for i in range(n)]


# ----------------------------------------------------------------------------
# construtores genericos
# ----------------------------------------------------------------------------

def strip_layer(mb, xs, us, ftop, fbot, uvf=None):
    """Placa grossa param. por (x,u). ftop/fbot(x,u) -> (pos, cor). Vertices coincidentes sao soldados.
    uvf(pos) -> uv opcional."""
    nx, nu = len(xs), len(us)

    def mk(f, x, u):
        p, c = f(x, u)
        return mb.add(p, c, uv=uvf(p) if uvf else None)
    T = [[mk(ftop, xs[i], us[j]) for j in range(nu)] for i in range(nx)]
    B = [[mk(fbot, xs[i], us[j]) for j in range(nu)] for i in range(nx)]
    for i in range(nx - 1):
        for j in range(nu - 1):
            mb.quad(T[i][j], T[i + 1][j], T[i + 1][j + 1], T[i][j + 1])
            mb.quad(B[i][j], B[i][j + 1], B[i + 1][j + 1], B[i + 1][j])
    for i in range(nx - 1):
        mb.quad(T[i][0], B[i][0], B[i + 1][0], T[i + 1][0])
        mb.quad(T[i][-1], T[i + 1][-1], B[i + 1][-1], B[i][-1])
    for j in range(nu - 1):
        mb.quad(T[0][j], T[0][j + 1], B[0][j + 1], B[0][j])
        mb.quad(T[-1][j], B[-1][j], B[-1][j + 1], T[-1][j + 1])


def tube(mb, pts, radii, colors, sides=5, cap=True, m=0, squash=1.0, twist=0.0, uv=None):
    """Tubo ao longo de pts (lista de Vector) com raio/cor por ponto.
    uv=(u0, ulen, v0, vrep): liga UVs (u ao longo do comprimento, v em torno, com vertice de emenda duplicado)."""
    n = len(pts)
    T = []
    for i in range(n):
        a = pts[max(0, i - 1)]
        b = pts[min(n - 1, i + 1)]
        t = (b - a)
        t.normalize()
        T.append(t)
    up = Vector((0, 0, 1))
    nrm = up.cross(T[0])
    if nrm.length < 1e-4:
        nrm = Vector((1, 0, 0)).cross(T[0])
    nrm.normalize()
    rings = []
    acc = 0.0
    nv = sides + 1 if uv is not None else sides
    for i in range(n):
        t = T[i]
        if i > 0:
            acc += (pts[i] - pts[i - 1]).length
        nrm = nrm - t * nrm.dot(t)
        if nrm.length < 1e-6:
            nrm = Vector((1, 0, 0)).cross(t)
        nrm.normalize()
        bn = t.cross(nrm)
        ring = []
        for k in range(nv):
            al = 2 * math.pi * k / sides
            tw = twist * i / max(1, n - 1)
            ex, ey = math.cos(al), math.sin(al) * squash
            off = nrm * (ex * math.cos(tw) - ey * math.sin(tw)) + bn * (ex * math.sin(tw) + ey * math.cos(tw))
            col = colors[i](al) if callable(colors[i]) else colors[i]
            uvk = None
            if uv is not None:
                uvk = (uv[0] + acc / uv[1], uv[2] + uv[3] * k / sides)
            ring.append(mb.add(pts[i] + off * radii[i], col, uv=uvk))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(sides):
            k2 = k + 1 if uv is not None else (k + 1) % sides
            mb.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], m=m)
    if cap:
        uc = (uv[0], uv[2]) if uv is not None else None
        ue = (uv[0] + acc / uv[1], uv[2]) if uv is not None else None
        c0 = mb.add(pts[0], colors[0](0) if callable(colors[0]) else colors[0], uv=uc)
        c1 = mb.add(pts[-1], colors[-1](0) if callable(colors[-1]) else colors[-1], uv=ue)
        for k in range(sides):
            k2 = k + 1 if uv is not None else (k + 1) % sides
            mb.tri(c0, rings[0][k2], rings[0][k], m=m)
            mb.tri(c1, rings[-1][k], rings[-1][k2], m=m)


def lathe(mb, prof, origin, axis="x", sign=1, seg=28, color=(1, 1, 1), m=0):
    """Revolucao de um perfil [(r, a)] em torno de um eixo ('x' ou 'z')."""
    ox, oy, oz = origin
    rings = []
    for (r, a) in prof:
        ring = []
        for k in range(seg):
            th = 2 * math.pi * k / seg
            if axis == "x":
                p = (ox + sign * a, oy + r * math.cos(th), oz + r * math.sin(th))
            else:
                p = (ox + r * math.cos(th), oy + r * math.sin(th), oz + sign * a)
            ring.append(mb.add(p, color))
        rings.append(ring)
    for i in range(len(prof) - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            if sign > 0:
                mb.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], m=m)
            else:
                mb.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2], m=m)


def rcyl(r, a0, a1, rb, nb=3):
    """perfil de cilindro com bordas arredondadas (de eixo a eixo)."""
    pr = [(0.0, a0)]
    for i in range(nb + 1):
        al = (math.pi / 2) * i / nb
        pr.append((r - rb + rb * math.sin(al), a0 + rb - rb * math.cos(al)))
    for i in range(nb + 1):
        al = (math.pi / 2) * i / nb
        pr.append((r - rb + rb * math.cos(al), a1 - rb + rb * math.sin(al)))
    pr.append((0.0, a1))
    return pr


# ----------------------------------------------------------------------------
# PECA: pao
# ----------------------------------------------------------------------------
C_CRUST_LO = hexc("#BD7A30")
C_CRUST_HI = hexc("#DDA24C")
C_TOAST = hexc("#A55E20")
C_DARK = hexc("#74380F")
C_FLOUR = hexc("#EFCB8C")
C_CRUMB = hexc("#DDBE82")
C_CRUMB_LO = hexc("#C9A468")


def crust_color(x, y, z):
    c = lerpc(C_CRUST_LO, C_CRUST_HI, smooth(0.08, 0.5, z / HB))
    c = lerpc(c, C_TOAST, smooth(0.45, 0.95, z / HB) * 0.6)
    n = nz(x * 85, y * 85, z * 85)
    c = mulc(c, 1 + 0.10 * n)
    m = smooth(0.1, 0.5, fbm(x * 70, y * 70, z * 70 + 9, 3))
    c = lerpc(c, C_DARK, m * 0.35)
    q = x * math.cos(0.55) + abs(y) * math.sin(0.55)
    stripe = 0.5 + 0.5 * math.sin(q * 2 * math.pi / 0.052)
    light = smooth(0.78, 1.0, stripe) * 0.65 * smooth(0.3, 0.55, z / HB)
    c = lerpc(c, C_FLOUR, light)
    return c


def _fft_noise(rng, n, lo, hi):
    """ruido periodico (tileavel) com banda de frequencias [lo, hi] (ciclos por imagem)."""
    w = rng.randn(n, n)
    F = np.fft.fft2(w)
    fy = np.fft.fftfreq(n)[:, None] * n
    fx = np.fft.fftfreq(n)[None, :] * n
    fr = np.sqrt(fx * fx + fy * fy)
    mask = ((fr >= lo) & (fr <= hi)).astype(float)
    out = np.real(np.fft.ifft2(F * mask))
    out = (out - out.mean()) / (out.std() + 1e-9)
    return out


def _stamp_holes(h, rng, count, rmin, rmax, depth, irregular=0.28, rim=0.0, power=1.4):
    """Estampa crateras irregulares (tileaveis) no campo de altura h. Devolve mascara dos buracos."""
    n = h.shape[0]
    mask = np.zeros_like(h)
    for _ in range(count):
        r = float(np.exp(rng.uniform(np.log(rmin), np.log(rmax))))
        cx, cy = rng.uniform(0, n), rng.uniform(0, n)
        ph = rng.uniform(0, 6.28, 3)
        sx = rng.uniform(0.7, 1.35)
        ang = rng.uniform(0, 3.14)
        R = int(r * 1.9) + 2
        ix = (np.arange(-R, R + 1) + int(cx)) % n
        iy = (np.arange(-R, R + 1) + int(cy)) % n
        gx, gy = np.meshgrid(np.arange(-R, R + 1) - (cx - int(cx)), np.arange(-R, R + 1) - (cy - int(cy)))
        ca, sa = math.cos(ang), math.sin(ang)
        u = (gx * ca + gy * sa) / sx
        v = (-gx * sa + gy * ca)
        th = np.arctan2(v, u)
        rn = 1 + irregular * (np.sin(2 * th + ph[0]) * 0.6 + np.sin(3 * th + ph[1]) * 0.4)
        d = np.sqrt(u * u + v * v) / (r * rn)
        prof = np.clip(1 - d * d, 0, 1) ** power
        sub = np.ix_(iy, ix)
        h[sub] -= depth * prof
        if rim > 0:
            ring = np.exp(-((d - 1.05) / 0.16) ** 2)
            h[sub] += rim * ring
        mask[sub] = np.maximum(mask[sub], (d < 1.0).astype(float) * (1 - d))
    return mask


def _normal_from_height(h, strength):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    nx, ny, nzz = -dx * strength, -dy * strength, np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nzz * nzz)
    return np.stack([nx / ln, ny / ln, nzz / ln], axis=2)


def _save_img(name, rgb, colorspace):
    import tempfile
    n = rgb.shape[0]
    rgba = np.concatenate([rgb, np.ones((n, n, 1))], axis=2).astype(np.float32)
    im = bpy.data.images.new(name + "_raw", n, n, alpha=False)
    im.pixels.foreach_set(rgba.ravel())
    im.update()
    tmp = os.path.join(tempfile.gettempdir(), name + ".png")
    im.filepath_raw = tmp
    im.file_format = "PNG"
    im.save()
    im2 = bpy.data.images.load(tmp)
    im2.name = name
    im2.colorspace_settings.name = colorspace
    im2.pack()
    return im2


def make_crumb_textures(n=512):
    """Miolo de pao: alveolos de varios tamanhos (cor + normal), tileavel."""
    rng = np.random.RandomState(31)
    h = 0.10 * _fft_noise(rng, n, 2, 7) + 0.06 * _fft_noise(rng, n, 8, 40) + 0.025 * _fft_noise(rng, n, 40, 120)
    m1 = _stamp_holes(h, rng, 16, 24, 46, 1.25, 0.30, rim=0.10, power=0.9)
    m2 = _stamp_holes(h, rng, 55, 10, 24, 0.9, 0.3, rim=0.07, power=0.9)
    m3 = _stamp_holes(h, rng, 190, 3.5, 10, 0.6, 0.35, rim=0.05, power=0.8)
    hole = np.clip(m1 + m2 + m3, 0, 1)
    base_a = np.array(hexc("#F0D79B"))
    base_b = np.array(hexc("#DDB874"))
    tone = np.clip(0.5 + 0.25 * _fft_noise(rng, n, 2, 9) + 0.1 * _fft_noise(rng, n, 30, 90), 0, 1)[..., None]
    col = base_a * (1 - tone) + base_b * tone
    pit = np.array(hexc("#9A6B35"))
    dark = np.clip(hole * 1.1, 0, 1)[..., None]
    col = col * (1 - 0.78 * dark) + pit * 0.78 * dark
    gx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    gy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    shade = np.clip(1 + (-gx * 0.9 + gy * 0.9) * 1.1, 0.6, 1.35)[..., None]
    col = np.clip(col * shade, 0, 1)
    nrm = _normal_from_height(h, 3.2)
    c_img = _save_img("miolo_cor", col, "sRGB")
    n_img = _save_img("miolo_normal", nrm * 0.5 + 0.5, "Non-Color")
    return c_img, n_img


def make_crust_textures(n=512):
    """Casca: poros pequenos, bolhas (blisters) e farinha; textura relativa (multiplica a cor de vertice)."""
    rng = np.random.RandomState(53)
    h = 0.05 * _fft_noise(rng, n, 2, 10) + 0.05 * _fft_noise(rng, n, 10, 50)
    hb = np.zeros_like(h)
    _stamp_holes(hb, rng, 70, 7, 20, 1.0, 0.35, power=0.8)
    h += -0.55 * hb
    pores = np.zeros_like(h)
    mp = _stamp_holes(pores, rng, 520, 1.6, 4.4, 0.8, 0.4, power=0.7)
    h += pores * 0.8
    base = 0.90 + 0.07 * _fft_noise(rng, n, 2, 8) + 0.05 * _fft_noise(rng, n, 30, 110)
    base = base + 0.10 * np.clip(-hb * 0.8, 0, 1)
    spots = (rng.rand(n, n) > 0.9965).astype(float)
    spots = np.clip(spots + np.roll(spots, 1, 0) * 0.6 + np.roll(spots, 1, 1) * 0.6, 0, 1)
    col = base[..., None] * np.ones((1, 1, 3))
    col = col * (1 - 0.55 * np.clip(mp, 0, 1)[..., None])
    col = np.clip(col + 0.14 * spots[..., None], 0, 1.0)
    nrm = _normal_from_height(h, 2.4)
    c_img = _save_img("casca_cor", np.clip(col, 0, 1), "sRGB")
    n_img = _save_img("casca_normal", nrm * 0.5 + 0.5, "Non-Color")
    return c_img, n_img


TC_CRUMB = 0.085    # lado (m) do ladrilho de textura do miolo
TC_CRUST = 0.075    # idem da casca


def build_pao(root):
    """Pao cortado ao meio: base (miolo p/ cima) + tampa (miolo p/ baixo) presa pela aresta de tras.
    A tampa e exportada na pose ABERTA, com pivo na dobradica (rotacao X = OPEN_RAD)."""
    NS, No, Nf = 92, 20, 22
    xs = cos_spaced(NS, L * 0.9995)

    def crumb_color(xi, y, z, Wb, under=False):
        edge = 1 - abs(y) / max(Wb, 1e-6)
        c = lerpc(hexc("#C79552"), (1.0, 1.0, 1.0), smooth(0.02, 0.26, edge))
        c = mulc(c, 1 + 0.07 * nz(xi * 60, y * 60, z * 60))
        if under:
            c = mulc(c, 0.93)
        return c

    def outer_pt(xi, ph):
        p = bprof(xi)
        cs, sn = math.cos(ph), math.sin(ph)
        y = p["Wb"] * math.copysign(abs(cs) ** (2 / NEXP), cs)
        z = p["zc"] + (p["Hb"] / 2) * math.copysign(abs(sn) ** (2 / NEXP), sn)
        return y, z

    def loft(mb, rings, nseam):
        n = len(rings[0])
        for i in range(len(rings) - 1):
            for k in range(n):
                k2 = (k + 1) % n
                if k in nseam:
                    continue
                m = 1 if (k > nseam[0] and k2 != 0) else 0
                mb.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2], m=m)
        for end, rev in ((0, True), (len(rings) - 1, False)):
            ring = rings[end]
            xe = mb.v[ring[0]][0]
            c = mb.add((xe, 0.0, bprof(xe)["zc"]), C_CRUST_LO, uv=(0.3, 0.3))
            for k in range(n):
                k2 = (k + 1) % n
                if k in nseam:
                    continue
                if rev:
                    mb.tri(c, ring[k], ring[k2])
                else:
                    mb.tri(c, ring[k2], ring[k])

    def make_half(lid_half):
        mb, rings = MB(), []
        for xi in xs:
            p = bprof(xi)
            ring, s, prev = [], 0.0, None
            for k in range(No + 1):
                ph = (math.pi - math.pi * k / No) if lid_half else (-math.pi * k / No)
                y, z = outer_pt(xi, ph)
                q = Vector((xi, y, z))
                if prev is not None:
                    s += (q - prev).length
                prev = q
                ring.append(mb.add((xi, y, z), crust_color(xi, y, z), uv=(xi / TC_CRUST, s / TC_CRUST)))
            # miolo: de uma borda a outra (inclui as 2 pontas duplicadas, com UV propria)
            for k in range(0, Nf + 2):
                if lid_half:
                    y = p["Wb"] - 2 * p["Wb"] * k / (Nf + 1)
                    z = zunder(xi, y)
                else:
                    y = -p["Wb"] + 2 * p["Wb"] * k / (Nf + 1)
                    z = zface(xi, y)
                ring.append(mb.add((xi, y, z), crumb_color(xi, y, z, p["Wb"], under=lid_half),
                                   uv=(xi / TC_CRUMB, y / TC_CRUMB + (0.37 if lid_half else 0.0))))
            rings.append(ring)
        nring = len(rings[0])
        loft(mb, rings, (No, nring - 1))
        return mb

    base = make_half(False)
    lid = make_half(True)
    Yh, Zh = bprof(0.0)["Wb"], bprof(0.0)["zc"]
    lid.v = [(x, y - Yh, z - Zh) for (x, y, z) in lid.v]
    crust_c, crust_n = make_crust_textures()
    crumb_c, crumb_n = make_crumb_textures()
    m_crust = make_mat("mat_pao_casca", vcol=False, rough=0.74, spec=0.3, image=crust_c, normal_image=crust_n, normal_strength=0.8)
    m_crumb = make_mat("mat_pao_miolo", vcol=False, rough=0.9, spec=0.2, image=crumb_c, normal_image=crumb_n, normal_strength=1.0)
    ob = finish(base, "pao_base", [m_crust, m_crumb], root)
    ol = finish(lid, "pao_tampa", [m_crust, m_crumb], root)
    ol.location = (0.0, Yh, Zh)
    ol.rotation_mode = "XYZ"
    ol.rotation_euler = (OPEN_RAD, 0.0, 0.0)
    return [ob, ol]


# ----------------------------------------------------------------------------
# PECA: pasta de alho
# ----------------------------------------------------------------------------
C_PASTA = hexc("#F5E8C0")
C_PASTA2 = hexc("#EAD79F")
XP = 0.126


def pasta_pos(x, u, top=True):
    p = bprof(x)
    hwp = (p["Wb"] - 0.008) * 0.95
    y = u * hwp
    zf = zface(x, y) + 0.0004
    f = smooth(1.0, 0.86, abs(u)) * smooth(1.0, 0.9, abs(x) / XP)
    th = 0.0036 * f
    z = zf + (th * (1 + 0.25 * nz(x * 90, y * 90, 2.2)) if top else 0.0)
    col = lerpc(C_PASTA, C_PASTA2, 0.5 + 0.5 * nz(x * 40, y * 40, 5.5))
    return (x, y, z), col


def build_pasta(root):
    mb = MB()
    xs = cos_spaced(70, XP)
    us = [-1 + 2 * j / 14 for j in range(15)]
    strip_layer(mb, xs, us, lambda x, u: pasta_pos(x, u, True), lambda x, u: pasta_pos(x, u, False))
    rng = random.Random(11)
    greens = [hexc("#3F7F25"), hexc("#5A9A2E"), hexc("#2F6A1E"), hexc("#7DB43C")]
    for _ in range(95):
        x = rng.uniform(-0.115, 0.115)
        u = rng.uniform(-0.8, 0.8)
        (cx, cy, cz), _c = pasta_pos(x, u, True)
        r = rng.uniform(0.0011, 0.0026)
        col = rng.choice(greens)
        ctr = mb.add((cx, cy, cz + r * 0.55), mulc(col, 1.1))
        ph = rng.uniform(0, 6.28)
        ring = []
        for k in range(6):
            a = ph + 2 * math.pi * k / 6
            rr = r * (0.7 + 0.5 * rng.random())
            ring.append(mb.add((cx + rr * math.cos(a), cy + rr * 0.85 * math.sin(a), cz + 0.0003), mulc(col, 0.85)))
        for k in range(6):
            mb.tri(ctr, ring[k], ring[(k + 1) % 6])
    mat = make_mat("mat_pasta", rough=0.38, spec=0.6)
    return [finish(mb, "pasta_alho", [mat], root)]


# ----------------------------------------------------------------------------
# PECA: costela desfiada (tiras achatadas em feixes)
# ----------------------------------------------------------------------------
MEAT = [hexc(h) for h in ("#6B2E1F", "#74321F", "#7E3822", "#8A3F26", "#9C4A2C", "#6F3020", "#5E2819")]
C_CORE = hexc("#3F180D")
C_TIP = hexc("#35150B")


def core_pos(x, u, top=True):
    By = by_of(x)
    y = u * By
    ztop = pile(x, u, 0.0) - 0.0042 + 0.0016 * nz(x * 70, y * 70, 3.1) + 0.0012 * nz(x * 150, y * 150, 8.8)
    zbot = min(zface(x, y) + 0.0005, ztop - 0.002)
    st = 0.5 + 0.5 * nz(x * 90, y * 90, 3.1)
    col = lerpc(C_CORE, hexc("#6B2A18"), smooth(0.3, 0.85, st) * 0.8)
    return (x, y, ztop if top else zbot), col


def make_fibre_textures(n=256):
    """Fibras de carne desfiada: estrias ao longo de u (cor cinza relativa + normal), tileavel."""
    rng = np.random.RandomState(77)
    fy = np.fft.fftfreq(n)[:, None] * n      # eixo v (linhas)
    fx = np.fft.fftfreq(n)[None, :] * n      # eixo u (colunas)
    def aniso(lo_v, hi_v, max_u):
        w = rng.randn(n, n)
        F = np.fft.fft2(w)
        mask = ((np.abs(fy) >= lo_v) & (np.abs(fy) <= hi_v) & (np.abs(fx) <= max_u)).astype(float)
        out = np.real(np.fft.ifft2(F * mask))
        return (out - out.mean()) / (out.std() + 1e-9)
    k = n / 512.0
    h = 0.55 * aniso(12 * k, 60 * k, 3) + 0.35 * aniso(3 * k, 12 * k, 2) + 0.25 * aniso(40 * k, 120 * k, 10 * k)
    h += 0.20 * _fft_noise(rng, n, 2, 8)
    ridge = 1 - np.abs(h) * 0.35
    col = np.clip(0.78 + 0.16 * h + 0.10 * aniso(2 * k, 10 * k, 3), 0.35, 1.0)
    col = col * (0.88 + 0.12 * ridge)
    nrm = _normal_from_height(h * 0.5, 3.4)
    c_img = _save_img("fibra_cor", np.stack([col, col, col], axis=2), "sRGB")
    n_img = _save_img("fibra_normal", nrm * 0.5 + 0.5, "Non-Color")
    return c_img, n_img


def surf_z(x, y):
    """z do topo do monte de costela em (x, y) reais; alem da borda do pao a carne escorre para baixo."""
    xc = max(-L, min(L, x))
    By = by_of(xc)
    v = y / By
    if abs(v) <= 1.0:
        return pile(xc, v, 1.0)
    return pile(xc, math.copysign(1.0, v), 0.0) - (abs(y) - By) * 1.35


def build_costela(root):
    mb = MB()
    # miolo escuro e irregular do monte (os vaos entre as tiras ficam escuros, nao lisos)
    xs = cos_spaced(70, XM * 0.985)
    us = [-1 + 2 * j / 18 for j in range(19)]
    strip_layer(mb, xs, us, lambda x, u: core_pos(x, u, True), lambda x, u: core_pos(x, u, False),
                uvf=lambda p: (p[0] / 0.03, p[1] / 0.03))
    rng = random.Random(2026)
    nseg, sides = 5, 4
    nstrips = 0
    NX, NV = 19, 6
    for ix in range(NX):
        for iv in range(NV):
            cx = -0.134 + 0.268 * (ix + rng.uniform(0.1, 0.9)) / NX
            vc = -1.08 + 2.16 * (iv + rng.uniform(0.1, 0.9)) / NV
            edge = abs(vc) > 0.72
            # direcao do feixe: quase sempre ao longo do pao; alguns atravessados
            if edge:
                th = rng.gauss(0, 0.40) + math.copysign(0.18, vc) * rng.random()
            elif rng.random() < 0.22:
                th = rng.choice([-1, 1]) * rng.uniform(0.8, 1.35)
            else:
                th = rng.gauss(0, 0.85)
            if rng.random() < 0.5:
                th += math.pi
            dvec = (math.cos(th), math.sin(th))
            nvec = (-dvec[1], dvec[0])
            tuft_len = rng.uniform(0.026, 0.044)
            bend = rng.gauss(0, 1.0) * 9.0          # curvatura comum do feixe (1/m)
            m_str = rng.randint(3, 5)
            layer = rng.choice([0.0, 0.0010, 0.0020, 0.0032])
            tone = rng.uniform(0.9, 1.1)
            base_col = rng.choice(MEAT)
            wmean = rng.uniform(0.0052, 0.0078)
            cy = vc * by_of(cx)
            for si in range(m_str):
                wide = rng.random() < 0.14
                w = rng.uniform(0.0100, 0.0140) if wide else wmean * rng.uniform(0.7, 1.3)
                lat = (si - (m_str - 1) / 2) * wmean * 0.95 + rng.gauss(0, 0.0012)
                t0 = rng.uniform(-0.009, 0.009)
                ln = tuft_len * rng.uniform(0.7, 1.18)
                wig_a = rng.uniform(0.0010, 0.0030)
                wig_p = rng.uniform(0, 6.28)
                squash = rng.uniform(0.34, 0.55)
                th_s = th + rng.gauss(0, 0.22)
                dvs = (math.cos(th_s), math.sin(th_s))
                nvs = (-dvs[1], dvs[0])
                twist = rng.gauss(0, 1.3)
                wf = rng.uniform(3.5, 7.0)
                wn = rng.uniform(0, 50)
                P, R, C = [], [], []
                col_s = mulc(base_col, 1.14 * tone * rng.uniform(0.9, 1.1))
                ph_col = rng.uniform(0, 6.28)
                for k in range(nseg + 1):
                    t = k / nseg
                    s = -ln / 2 + ln * t + t0
                    off = lat + bend * s * s + wig_a * math.sin(t * wf + wig_p)
                    x = cx + dvs[0] * s + nvs[0] * off
                    y = cy + dvs[1] * s + nvs[1] * off
                    x = max(-0.139, min(0.139, x))
                    pp = bprof(max(-L, min(L, x)))
                    y = math.copysign(min(abs(y), pp["Wb"] + 0.0035), y)
                    prof = 0.60 + 0.40 * math.sin(math.pi * (0.06 + 0.88 * t))
                    prof *= 0.82 + 0.36 * (0.5 + 0.5 * nz(wn + t * 2.5, 1.3, 0.2))
                    a = 0.5 * w * prof
                    z = surf_z(x, y) + 0.0004 + layer + 0.0007 * math.sin(math.pi * t)
                    z = max(z, a * squash + 0.0004)
                    P.append(Vector((x, y, z)))
                    R.append(a)
                    tip = smooth(0.30, 0.0, t) + smooth(0.70, 1.0, t)
                    cc = lerpc(col_s, C_TIP, 0.55 * tip)
                    cc = lerpc(cc, hexc("#A8603C"), 0.10 * (0.5 + 0.5 * nz(x * 95, y * 95, 4.4)))
                    cc = mulc(cc, 0.80 + 0.40 * (0.5 + 0.5 * nz(wn + t * 4.0, 7.7, 1.0)))
                    C.append((lambda al, cc=cc, ph=ph_col: mulc(cc, 0.80 + 0.24 * math.sin(al) + 0.10 * math.sin(3 * al + ph))))
                for _ in range(2):
                    P = [P[0]] + [(P[i - 1] + 2 * P[i] + P[i + 1]) / 4 for i in range(1, len(P) - 1)] + [P[-1]]
                tube(mb, P, R, C, sides=sides, cap=True, squash=squash, twist=twist,
                     uv=(rng.uniform(0, 1), 0.030, rng.uniform(0, 1), 1.0))
                nstrips += 1
    print("costela: %d tiras" % nstrips)
    fib_c, fib_n = make_fibre_textures()
    mat = make_mat("mat_costela", vcol=False, rough=0.5, spec=0.45, image=fib_c, normal_image=fib_n, normal_strength=1.0)
    return [finish(mb, "costela_fiapos", [mat], root)]


# ----------------------------------------------------------------------------
# PECA: creme de queijo
# ----------------------------------------------------------------------------
C_CREME = hexc("#F7E6B0")
C_CREME2 = hexc("#EFD58C")
XCR = 0.130
XC = 0.128


def make_tongues(seed, n, amp, w, xr):
    r = random.Random(seed)
    return [(r.uniform(-xr, xr), r.uniform(*w), r.uniform(*amp)) for _ in range(n)]


def vm_side(x, base, nf, ns, tongs, nsc):
    v = base + nsc * nz(x * nf, ns, 0.5)
    for xk, w, a in tongs:
        v += a * math.exp(-((x - xk) / w) ** 2)
    return v


TONG_M = (make_tongues(41, 9, (0.22, 0.45), (0.0045, 0.008), 0.105), make_tongues(42, 9, (0.22, 0.45), (0.0045, 0.008), 0.105))
BLOBS = [(-0.095, 0.30, 0.012), (-0.035, -0.28, 0.010), (0.012, 0.34, 0.011), (0.060, -0.30, 0.012), (0.105, 0.22, 0.009)]


def creme_axis(x):
    """eixo (em v = y/By) do fio de creme: serpenteia pelo monte, sem cobrir tudo."""
    return 0.34 * math.sin(x * 2 * math.pi / 0.090 + 0.7) + 0.10 * math.sin(x * 2 * math.pi / 0.034 + 2.0)


def creme_hw(x):
    hw = 0.17 + 0.05 * nz(x * 34, 2.2, 0.3)
    for xk, vk, w in BLOBS:
        hw += 0.16 * math.exp(-((x - xk) / w) ** 2)
    return hw


def creme_pos(x, u, top=True):
    r_end = max(0.0, 1 - (abs(x) / XCR) ** 3) ** 0.5
    By = by_of(x)
    ctr = creme_axis(x)
    hw = creme_hw(x) * r_end
    v = max(-0.98, min(0.98, ctr + u * hw))
    y = v * By
    zb = pile(x, v, 1.0) + 0.0006
    th = 0.0058 * (1 + 0.15 * nz(x * 50, 1.1, 2.2)) * max(0.0, 1 - u ** 4) ** 0.5 * min(1.0, r_end * 3)
    th += 0.0007 * nz(x * 120, v * 9, 2.2) * max(0.0, 1 - u * u)
    z = zb + th if top else zb
    col = lerpc(C_CREME, C_CREME2, clamp(0.45 + 0.4 * nz(x * 30, y * 30, 6.6)))
    return (x, y, z), col


def build_creme(root):
    mb = MB()
    xs = cos_spaced(150, XCR)
    us = [-1 + 2 * j / 14 for j in range(15)]
    strip_layer(mb, xs, us, lambda x, u: creme_pos(x, u, True), lambda x, u: creme_pos(x, u, False))
    mat = make_mat("mat_creme", rough=0.2, spec=0.8)
    return [finish(mb, "creme_queijo", [mat], root)]


def vm_mus(x, u):
    f = (u + 1) / 2
    a = vm_side(x, 0.80, 18, 13.0, TONG_M[0], 0.07)
    b = vm_side(x, 0.80, 18, 19.0, TONG_M[1], 0.07)
    return lerp(a, b, f)


def vcap(x, v, By):
    p = bprof(x)
    vmax = 1.0 * p["Wb"] / max(By, 1e-6)
    return math.copysign(min(abs(v), vmax), v)


# ----------------------------------------------------------------------------
# PECA: mussarela derretida
# ----------------------------------------------------------------------------
C_MUS_PALE = hexc("#F7E4A4")
C_MUS_GOLD = hexc("#F0C75E")


def wave_m(x, v):
    return 0.0024 * nz(x * 52, v * 5, 3.3) + 0.0012 * nz(x * 120, v * 9, 7.1)


def mus_geom(x, u):
    r_end = max(0.0, 1 - (abs(x) / XC) ** 3) ** 0.5
    v = vcap(x, u * vm_mus(x, u) * r_end, bym(x))
    return v, v * bym(x)


def mus_top_z(x, v):
    return zouter(x, abs(v) * bym(x)) + 0.0065 + wave_m(x, v)


def mus_pos(x, u, top=True):
    v, y = mus_geom(x, u)
    zb = zouter(x, abs(y)) + 0.0003
    zt = mus_top_z(x, v)
    f = min(1.0, (1 - abs(u)) / 0.10) ** 0.55 * min(1.0, (1 - abs(x) / XC) / 0.08) ** 0.55
    f = max(0.0, f)
    z = zb + (zt - zb) * f if top else zb
    t = clamp((zt - zb) / 0.010)
    col = lerpc(C_MUS_PALE, C_MUS_GOLD, clamp(0.25 + 0.5 * t + 0.25 * nz(x * 26, y * 26, 9.9)))
    return (x, y, z), col


def drip_curve(x, ytip, length):
    """pontos sobre a face externa do pao a partir de y=ytip descendo `length` (y>0)."""
    p = bprof(x)
    Wb, Hb, zc = p["Wb"], p["Hb"], p["zc"]
    ytip = min(ytip, 0.995 * Wb)
    cph = (ytip / Wb) ** (NEXP / 2)
    ph0 = math.acos(min(1.0, cph))
    pts, acc, prev = [], 0.0, None
    N = 200
    for i in range(N + 1):
        ph = ph0 - (ph0 + 1.3) * i / N
        cs, sn = math.cos(ph), math.sin(ph)
        y = Wb * math.copysign(abs(cs) ** (2 / NEXP), cs)
        z = zc + (Hb / 2) * math.copysign(abs(sn) ** (2 / NEXP), sn)
        q = Vector((x, y, z))
        if prev is not None:
            acc += (q - prev).length
        prev = q
        pts.append((acc, q))
        if acc >= length:
            break
    return pts


def build_mussarela(root):
    mb = MB()
    xs = cos_spaced(122, XC)
    us = [-1 + 2 * j / 28 for j in range(29)]
    strip_layer(mb, xs, us, lambda x, u: mus_pos(x, u, True), lambda x, u: mus_pos(x, u, False))
    # gotas escorrendo pelas laterais, saindo das linguas que passam da borda
    rng = random.Random(77)
    for side, tg in ((1, TONG_M[1]), (-1, TONG_M[0])):
        for (xk, w, a) in tg:
            if a < 0.33:
                continue
            u_edge = side
            v, y = mus_geom(xk, u_edge)
            if abs(v) < 1.0:
                continue
            ln = rng.uniform(0.012, 0.030)
            cur = drip_curve(xk, abs(y) - 0.002, ln)
            if len(cur) < 6:
                continue
            nseg = 9
            P, R, C = [], [], []
            for i in range(nseg + 1):
                t = i / nseg
                target = ln * t
                q = cur[min(range(len(cur)), key=lambda j: abs(cur[j][0] - target))][1]
                rr = 0.0024 * (0.7 + 0.8 * smooth(0.6, 0.95, t)) * (1 - 0.8 * smooth(0.92, 1.0, t))
                ny, nzv = outer_normal(xk, abs(q.y), q.z)
                pos = Vector((q.x, side * (abs(q.y) + ny * rr * 0.7), q.z + nzv * rr * 0.7))
                P.append(pos)
                R.append(max(rr, 0.0004))
                C.append(lerpc(C_MUS_GOLD, C_MUS_PALE, 0.25 + 0.2 * t))
            tube(mb, P, R, C, sides=7, cap=True)
    mat = make_mat("mat_mussarela", rough=0.16, spec=1.0, coat=0.35)
    return [finish(mb, "mussarela_derretida", [mat], root)]


# ----------------------------------------------------------------------------
# PECA: gratinado (manchas do macarico)
# ----------------------------------------------------------------------------
C_G_EDGE = hexc("#C28030")
C_G_MID = hexc("#6E3510")
C_G_CORE = hexc("#2B1208")


def build_gratinado(root):
    mb = MB()
    rng = random.Random(404)

    def patch(cx_x, u0, R, aspect, rot, ncore):
        v0, y0 = mus_geom(cx_x, u0)
        By = bym(cx_x)
        ph = rng.uniform(0, 6.28)
        fx = [rng.uniform(0.0, 6.28) for _ in range(3)]
        amp = rng.uniform(0.28, 0.5)
        nsec, nring = 18, 3
        rings = []
        ctr = None
        for rr in range(nring + 1):
            rad = rr / nring
            ring = []
            for k in range(nsec if rr > 0 else 1):
                a = 2 * math.pi * k / nsec
                rn = 1 + amp * (math.sin(2 * a + fx[0]) * 0.55 + math.sin(3 * a + fx[1]) * 0.3 + math.sin(5 * a + fx[2]) * 0.2)
                px = R * rad * rn * math.cos(a) * aspect
                py = R * rad * rn * math.sin(a) / aspect
                x = cx_x + px * math.cos(rot) - py * math.sin(rot)
                y = y0 + px * math.sin(rot) + py * math.cos(rot)
                v = y / By
                z = mus_top_z(x, v) + 0.0009
                dark = 1 - rad
                col = lerpc(C_G_EDGE, C_G_MID, smooth(0.0, 0.55, dark))
                col = lerpc(col, C_G_CORE, smooth(0.55, 1.0, dark) * ncore)
                ring.append(mb.add((x, y, z), col))
            rings.append(ring)
        # centro + aneis
        for k in range(nsec):
            k2 = (k + 1) % nsec
            mb.tri(rings[0][0], rings[1][k], rings[1][k2])
        for rr in range(1, nring):
            for k in range(nsec):
                k2 = (k + 1) % nsec
                mb.quad(rings[rr][k], rings[rr + 1][k], rings[rr + 1][k2], rings[rr][k2])

    # inverte a ordem de enrolamento: precisamos da normal +z (verificado abaixo)
    n_cluster = 16
    centers = []
    for _ in range(n_cluster):
        centers.append((rng.uniform(-0.105, 0.105), rng.uniform(-0.78, 0.78)))
    for (cx, cu) in centers:
        for _ in range(rng.randint(3, 6)):
            x = cx + rng.gauss(0, 0.011)
            u = clamp(cu + rng.gauss(0, 0.16), -0.85, 0.85)
            x = clamp(x, -0.108, 0.108)
            v, y = mus_geom(x, u)
            By = bym(x)
            room = (min(0.9, vm_mus(x, u) * 0.82) - abs(u) * vm_mus(x, u)) * By
            R = min(rng.uniform(0.0035, 0.0105), max(0.0018, room * 0.8))
            patch(x, u, R, rng.uniform(0.7, 1.5), rng.uniform(0, 3.14), rng.uniform(0.4, 1.0))
    for _ in range(60):   # pintinhas
        x = rng.uniform(-0.115, 0.115)
        u = rng.uniform(-0.85, 0.85)
        v, y = mus_geom(x, u)
        By = bym(x)
        room = (min(0.9, vm_mus(x, u) * 0.82) - abs(u) * vm_mus(x, u)) * By
        R = min(rng.uniform(0.0014, 0.0032), max(0.0012, room * 0.8))
        patch(x, u, R, rng.uniform(0.8, 1.3), rng.uniform(0, 3.14), 1.0)
    mat = make_mat("mat_gratinado", rough=0.62, spec=0.3)
    return [finish(mb, "gratinado_manchas", [mat], root)]


# ----------------------------------------------------------------------------
# PECA: tabua
# ----------------------------------------------------------------------------
BOARD = dict(A=0.21, B=0.15, R=0.03, hh=0.036, f=0.02, Lh=0.12, Rh=0.03, T=0.028, rb=0.008)
BU = (-0.23, 0.58)   # faixa x do UV
BV = (-0.16, 0.32)


def board_outline():
    A, B, R, hh, f, Lh, Rh = (BOARD[k] for k in ("A", "B", "R", "hh", "f", "Lh", "Rh"))
    pts = []

    def arc(cx, cy, r, a0, a1, n=10):
        for i in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    arc(A - R, -B + R, R, -90, 0)
    arc(A + f, -hh - f, f, 180, 90, 8)
    arc(A + Lh - Rh, -hh + Rh, Rh, -90, 0)
    arc(A + Lh - Rh, hh - Rh, Rh, 0, 90)
    arc(A + f, hh + f, f, -90, -180, 8)
    arc(A - R, B - R, R, 0, 90)
    arc(-A + R, B - R, R, 90, 180)
    arc(-A + R, -B + R, R, 180, 270)
    return pts


def make_wood_image():
    W = H = 512
    rng = np.random.RandomState(7)

    def up(arr):
        r = np.linspace(0, arr.shape[0] - 1, H)
        c = np.linspace(0, arr.shape[1] - 1, W)
        r0 = np.floor(r).astype(int)
        r1 = np.minimum(r0 + 1, arr.shape[0] - 1)
        fr = (r - r0)[:, None]
        a = arr[r0] * (1 - fr) + arr[r1] * fr
        c0 = np.floor(c).astype(int)
        c1 = np.minimum(c0 + 1, arr.shape[1] - 1)
        fc = (c - c0)[None, :]
        return a[:, c0] * (1 - fc) + a[:, c1] * fc
    yy = np.linspace(0, 1, H)[:, None] * np.ones((1, W))
    warp = up(rng.rand(7, 6)) * 4.0 + up(rng.rand(30, 14)) * 0.8
    rings = 0.5 + 0.5 * np.sin((yy * 34 + warp) * 2 * np.pi)
    fine = up(rng.rand(H, 5))
    fine2 = up(rng.rand(H // 2, 22))
    pores = (up(rng.rand(H, 70)) > 0.86).astype(float) * 0.5
    v = 0.22 * rings + 0.34 * fine + 0.22 * fine2 - 0.30 * pores
    v = (v - v.min()) / (v.max() - v.min())
    lo, hi = np.array(hexc("#432B1E")), np.array(hexc("#A27652"))
    img = lo[None, None, :] * (1 - v[..., None]) + hi[None, None, :] * v[..., None]
    # escurece levemente as bordas (queimado)
    xx = np.linspace(0, 1, W)[None, :]
    edge = 1 - 0.18 * (np.abs(yy - 0.5) * 2) ** 6
    img = img * edge[..., None]
    rgba = np.concatenate([img, np.ones((H, W, 1))], axis=2).astype(np.float32)
    im = bpy.data.images.new("tabua_madeira", W, H, alpha=False)
    im.pixels.foreach_set(rgba.ravel())
    im.update()
    import tempfile
    tmp = os.path.join(tempfile.gettempdir(), "tabua_madeira.png")
    im.filepath_raw = tmp
    im.file_format = "PNG"
    im.save()
    im2 = bpy.data.images.load(tmp)
    im2.name = "tabua_madeira_tex"
    im2.colorspace_settings.name = "sRGB"
    im2.pack()
    return im2


def build_tabua(root):
    mb = MB()
    pts = board_outline()
    n = len(pts)
    nrm = []
    for i in range(n):
        a, b = pts[i - 1], pts[(i + 1) % n]
        tx, ty = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tx, ty)
        nrm.append((ty / ln, -tx / ln))
    rb, T = BOARD["rb"], BOARD["T"]
    prof = [(0.0195, 0.0), (0.0178, -0.0013), (0.0160, -0.0020), (0.0142, -0.0013), (0.0125, 0.0), (rb, 0.0)]
    for i in range(1, 6):
        al = (math.pi / 2) * i / 5
        prof.append((rb - rb * math.sin(al), -rb + rb * math.cos(al)))
    prof.append((0.0, -(T - rb)))
    for i in range(1, 6):
        al = (math.pi / 2) * i / 5
        prof.append((rb - rb * math.cos(al), -(T - rb) - rb * math.sin(al)))
    rings = []
    for (d, z) in prof:
        ring = [mb.add((p[0] - nrm[k][0] * d, p[1] - nrm[k][1] * d, z), (1, 1, 1)) for k, p in enumerate(pts)]
        rings.append(ring)
    for m in range(len(rings) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            mb.quad(rings[m][k], rings[m + 1][k], rings[m + 1][k2], rings[m][k2])
    mb.face(*rings[0])
    mb.face(*reversed(rings[-1]))
    img = make_wood_image()
    mat = make_mat("mat_tabua", rough=0.62, vcol=False, image=img, spec=0.3)
    uvfn = lambda p: ((p[0] - BU[0]) / (BU[1] - BU[0]), (p[1] - BV[0]) / (BV[1] - BV[0]))
    return [finish(mb, "tabua_madeira", [mat], root, uvfn=uvfn)]


# ----------------------------------------------------------------------------
# PECA: macarico culinario (+ chama)
# ----------------------------------------------------------------------------
TOR_X, TOR_Y = -0.186, -0.114      # base do macarico na tabua (em pe, ao lado do pao)
TOR_YAW = math.radians(31.5)       # bico apontando para o pao
NOZ_PITCH = math.radians(40.0)     # ponta do bico inclinada para baixo


def superq(mb, c, ab, e1=0.4, e2=0.4, nu=16, nv=12, color=(1, 1, 1), m=0):
    """Superelipsoide (caixa arredondada para e pequeno) centrada em c, semi-eixos ab=(a,b,c)."""
    cx, cy, cz = c
    a, b, h = ab
    rows = []
    for j in range(nv + 1):
        v = -math.pi / 2 + math.pi * j / nv
        cv = math.copysign(abs(math.cos(v)) ** e1, math.cos(v))
        sv = math.copysign(abs(math.sin(v)) ** e1, math.sin(v))
        row = []
        for i in range(nu):
            u = 2 * math.pi * i / nu
            cu = math.copysign(abs(math.cos(u)) ** e2, math.cos(u))
            su = math.copysign(abs(math.sin(u)) ** e2, math.sin(u))
            row.append(mb.add((cx + a * cv * cu, cy + b * cv * su, cz + h * sv), color))
        rows.append(row)
    for j in range(nv):
        for i in range(nu):
            i2 = (i + 1) % nu
            mb.quad(rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i], m=m)


def xform(mb, i0, fn):
    for i in range(i0, len(mb.v)):
        mb.v[i] = tuple(fn(Vector(mb.v[i])))


def torch_place(mb, i0):
    """gira o trecho [i0:] em torno de z (yaw) e leva a base ao ponto da tabua."""
    cs, sn = math.cos(TOR_YAW), math.sin(TOR_YAW)

    def f(p):
        return Vector((TOR_X + p.x * cs - p.y * sn, TOR_Y + p.x * sn + p.y * cs, p.z))
    xform(mb, i0, f)


def build_macarico(root):
    orange = hexc("#FF6A1A")
    steel = hexc("#C9CDD2")
    dark_steel = hexc("#80868E")
    black = hexc("#1B1A1C")
    red = hexc("#D8281F")
    objs = []
    m_or = make_mat("mat_macarico_laranja", base=orange, rough=0.34, metal=0.05, vcol=False, spec=0.7, coat=0.45)
    m_bk = make_mat("mat_macarico_preto", base=black, rough=0.55, vcol=False, spec=0.4)
    m_st = make_mat("mat_macarico_aco", base=steel, rough=0.3, metal=0.75, vcol=False)
    m_rd = make_mat("mat_macarico_botao", base=red, rough=0.4, vcol=False)
    O = (0.0, 0.0, 0.0)
    Z0, ZC1 = 0.0, 0.098          # base e topo do cilindro da lata
    ZH = 0.1235                   # eixo da cabeca

    # --- corpo laranja: lata/cartucho + cabeca (cilindro horizontal) + capa traseira
    mb = MB()
    i0 = len(mb.v)
    lathe(mb, rcyl(0.0178, 0.007, ZC1, 0.004), (0, 0, 0), "z", 1, 40, orange)
    lathe(mb, rcyl(0.0152, -0.026, 0.040, 0.0045), (0, 0, ZH), "x", 1, 36, orange)     # cabeca
    torch_place(mb, i0)
    objs.append(finish(mb, "macarico_corpo", [m_or], root, vc_white=True))

    # --- pretos: base, faixa do rotulo, pescoco, gatilho, capa traseira, regulador de gas
    mb = MB()
    i0 = len(mb.v)
    lathe(mb, rcyl(0.0188, 0.0, 0.0085, 0.002), O, "z", 1, 40, black)                      # anel da base
    lathe(mb, rcyl(0.0182, 0.038, 0.060, 0.0008), O, "z", 1, 40, black)                    # faixa do rotulo
    lathe(mb, rcyl(0.0105, 0.100, 0.1135, 0.0015), (0.002, 0, 0), "z", 1, 28, black)       # pescoco sob a cabeca
    lathe(mb, rcyl(0.0157, -0.036, -0.026, 0.0022), (0, 0, ZH), "x", 1, 32, black)         # capa traseira
    lathe(mb, rcyl(0.0095, 0.0, 0.0075, 0.0015), (0.0, 0.0, ZH + 0.0125), "z", 1, 24, black)   # base do botao
    superq(mb, (0.027, 0.0, 0.092), (0.0058, 0.0072, 0.0165), 0.35, 0.35, 16, 12, black)   # gatilho
    torch_place(mb, i0)
    objs.append(finish(mb, "macarico_pretos", [m_bk], root, vc_white=True))

    # --- aco: ombro da lata, colar da cabeca, bico curvo + cabeca do queimador
    mb = MB()
    i0 = len(mb.v)
    sh = [(0.0, 0.1085), (0.0055, 0.1083), (0.0105, 0.1068), (0.0145, 0.1035), (0.0170, 0.0990), (0.0178, 0.0955)]
    lathe(mb, sh, O, "z", 1, 36, steel)
    lathe(mb, rcyl(0.0168, 0.040, 0.050, 0.0016), (0, 0, ZH), "x", 1, 32, steel)           # colar do bico
    torch_place(mb, i0)
    j0 = len(mb.v)
    path = [Vector(p) for p in ((0.046, 0, ZH), (0.060, 0, ZH + 0.0008), (0.073, 0, ZH - 0.0012),
                                (0.084, 0, ZH - 0.0062), (0.091, 0, ZH - 0.0125), (0.0955, 0, ZH - 0.0185))]
    radii = [0.0072, 0.0068, 0.0064, 0.0062, 0.0060, 0.0060]
    tube(mb, path, radii, [steel] * len(path), sides=20, cap=False)
    # cabeca do queimador (cilindro curto alinhado ao fim do bico, com aba)
    tip = path[-1]
    k0 = len(mb.v)
    burner = [(0.0, 0.0), (0.0092, 0.0), (0.0092, 0.0030), (0.0072, 0.0036), (0.0072, 0.0115), (0.0095, 0.0118), (0.0095, 0.0150), (0.0055, 0.0156), (0.0, 0.0140)]
    lathe(mb, burner, O, "x", 1, 24, dark_steel)

    cp, sp = math.cos(NOZ_PITCH), math.sin(NOZ_PITCH)
    for i in range(k0, len(mb.v)):
        p = Vector(mb.v[i])
        # gira em torno de y (ponta para baixo) e leva ao fim do bico
        mb.v[i] = (tip.x + p.x * cp + p.z * sp, p.y, tip.z - p.x * sp + p.z * cp)
    torch_place(mb, j0)
    objs.append(finish(mb, "macarico_bico", [m_st], root, vc_white=True))

    # --- botao de ignicao vermelho
    mb = MB()
    i0 = len(mb.v)
    lathe(mb, rcyl(0.0058, 0.0, 0.0058, 0.0012), (0.0, 0.0, ZH + 0.0200), "z", 1, 20, red)
    torch_place(mb, i0)
    objs.append(finish(mb, "macarico_botao", [m_rd], root, vc_white=True))

    # --- chama (objeto separado): cone na direcao do bico, base azul -> ponta laranja
    mb = MB()
    i0 = len(mb.v)
    n = 16
    prof = [(0.0, 0.0)]
    for i in range(1, n + 1):
        t = i / n
        prof.append((0.0062 * math.sin(math.pi * t ** 0.55) * (1 - 0.2 * t), 0.085 * t))
    prof[-1] = (0.0, 0.085)
    k = 8
    lathe(mb, prof[:k + 1], O, "x", 1, 20, orange, m=1)
    seg = 20
    rings = []
    for (r, a) in prof[k:]:
        ring = []
        for q in range(seg):
            th = 2 * math.pi * q / seg
            ring.append(mb.add((a, r * math.cos(th), r * math.sin(th)), orange))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for q in range(seg):
            q2 = (q + 1) % seg
            mb.quad(rings[i][q], rings[i][q2], rings[i + 1][q2], rings[i + 1][q], m=0)
    cp, sp = math.cos(NOZ_PITCH), math.sin(NOZ_PITCH)
    ftip = Vector((tip.x + 0.0165 * cp, 0.0, tip.z - 0.0165 * sp))
    for i in range(i0, len(mb.v)):
        p = Vector(mb.v[i])
        mb.v[i] = (ftip.x + p.x * cp + p.z * sp, p.y, ftip.z - p.x * sp + p.z * cp)
    torch_place(mb, i0)
    mo = make_mat("mat_chama_externa", base=hexc("#FF8A1E"), rough=0.5, vcol=False, emit=hexc("#FF7A12"), emit_s=4.0)
    mi = make_mat("mat_chama_interna", base=hexc("#4A8BFF"), rough=0.5, vcol=False, emit=hexc("#3D7CFF"), emit_s=6.0)
    objs.append(finish(mb, "chama", [mo, mi], root, vc_white=True))
    return objs


# ----------------------------------------------------------------------------
# construcao + exportacao
# ----------------------------------------------------------------------------
BUILDERS = {
    "tabua": build_tabua, "pao": build_pao, "pasta": build_pasta, "costela": build_costela,
    "creme": build_creme, "mussarela": build_mussarela, "gratinado": build_gratinado, "macarico": build_macarico,
}


def export_part(name, objs, root):
    os.makedirs(MODELS, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(MODELS, name + ".glb")
    kw = dict(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_cameras=False, export_lights=False, export_materials="EXPORT", export_normals=True,
        export_vertex_color="ACTIVE", export_image_format="JPEG", export_image_quality=78,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
    )
    bpy.ops.export_scene.gltf(**kw)
    return path


def build_and_export():
    stats = {}
    for name in SEL_PARTS:
        root = root_empty(name)
        objs = BUILDERS[name](root)
        tris = sum(tri_count(o) for o in objs)
        path = export_part(name, objs, root)
        stats[name] = (os.path.getsize(path), tris)
        print("EXPORT %-10s %8d bytes %7d tris" % (name, stats[name][0], tris))
    return stats


# ----------------------------------------------------------------------------
# renders de revisao (a partir dos GLBs exportados = o que o site recebe)
# ----------------------------------------------------------------------------
BG = hexc("#1a1210")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def import_parts():
    got = {}
    for name in PARTS:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + ".glb"))
        new = [o for o in bpy.data.objects if o not in before]
        roots = [o for o in new if o.parent is None]
        got[name] = dict(objs=new, roots=roots)
        if name == "pao":
            lid = [o for o in new if o.name.startswith("pao_tampa")][0]
            got[name]["lid"] = lid
            got[name]["lid_home"] = lid.location.copy()
    return got


def descend(o):
    out = [o]
    for c in o.children:
        out += descend(c)
    return out


def set_visible(parts, names, flame=False, hide=()):
    for n, d in parts.items():
        vis = n in names
        for r in d["roots"]:
            for o in descend(r):
                v = vis and (flame or not o.name.startswith("chama")) and not (hide and o.name.startswith(tuple(hide)))
                o.hide_render = not v
                o.hide_viewport = not v


def world_bbox(objs):
    pts = []
    for o in objs:
        if o.type == "MESH" and not o.hide_render:
            for c in o.bound_box:
                pts.append(o.matrix_world @ Vector(c))
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def setup_scene(res_w, res_h, samples):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = res_w, res_h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass
    for attr, val in (("use_raytracing", True), ("use_shadows", True), ("shadow_ray_count", 2), ("shadow_step_count", 8)):
        try:
            setattr(sc.eevee, attr, val)
        except Exception:
            pass
    try:
        sc.view_settings.view_transform = "Standard"
        sc.view_settings.look = "None"
        sc.view_settings.exposure = -0.9
    except Exception:
        pass
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    bgn = w.node_tree.nodes["Background"]
    bgn.inputs["Color"].default_value = (s2l(BG[0]), s2l(BG[1]), s2l(BG[2]), 1.0)
    bgn.inputs["Strength"].default_value = 1.0
    sc.world = w
    return sc


def add_light(kind, loc, target, color, power, size, name):
    ld = bpy.data.lights.new(name, kind)
    ld.color = color
    ld.energy = power
    if kind == "AREA":
        ld.shape = "DISK"
        ld.size = size
    else:
        ld.shadow_soft_size = size
    o = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    look_at(o, target)
    return o


def frame_camera(cam, mn, mx, az, el, lens, margin=1.08, tgt_shift=(0, 0, 0)):
    ctr = (mn + mx) / 2 + Vector(tgt_shift)
    cam.data.lens = lens
    sc = bpy.context.scene
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    corners = [Vector((x, y, z)) for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)]
    from bpy_extras.object_utils import world_to_camera_view
    lo, hi = 0.05, 4.0
    for _ in range(26):
        dist = (lo + hi) / 2
        cam.location = ctr + d * dist
        look_at(cam, ctr)
        bpy.context.view_layer.update()
        ok = True
        for c in corners:
            p = world_to_camera_view(sc, cam, c)
            m = (1 - 1 / margin) / 2
            if not (m < p.x < 1 - m and m < p.y < 1 - m):
                ok = False
                break
        if ok:
            hi = dist
        else:
            lo = dist
    cam.location = ctr + d * hi
    look_at(cam, ctr)
    bpy.context.view_layer.update()
    return ctr, hi


def render_view(parts, name, show, az_deg, el_deg, lens, path, res, samples, offsets=None, floor_z=None, margin=1.08, shift=(0, 0, 0), key_gain=1.0, flame=False, lid="open", lid_dz=0.0, hide=(), fit=None, box=None, lid_deg=None):
    sc = bpy.context.scene
    for n, d in parts.items():
        for r in d["roots"]:
            r.location = (0, 0, 0)
    lo = parts["pao"]["lid"]
    lo.rotation_mode = "XYZ"
    ang = -math.radians(lid_deg) if lid_deg is not None else (0.0 if lid == "closed" else OPEN_RAD)
    lo.rotation_euler = (ang, 0.0, 0.0)
    h = parts["pao"]["lid_home"]
    lo.location = (h.x, h.y, h.z + lid_dz)
    if offsets:
        for n, dz in offsets.items():
            for r in parts[n]["roots"]:
                r.location = (0, 0, dz)
    set_visible(parts, show, flame, hide)
    bpy.context.view_layer.update()
    objs = [o for n in show for r in parts[n]["roots"] for o in descend(r)]
    mn, mx = world_bbox(objs)
    fmn, fmx = mn, mx
    if fit:
        fmn, fmx = world_bbox([o for n in fit for r in parts[n]["roots"] for o in descend(r)])
    if box:
        fmn, fmx = Vector(box[0]), Vector(box[1])
    for o in list(bpy.data.objects):
        if o.name.startswith(("CAM", "LT_", "FLOOR")):
            bpy.data.objects.remove(o, do_unlink=True)
    cd = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    ctr, dist = frame_camera(cam, fmn, fmx, math.radians(az_deg), math.radians(el_deg), lens, margin, shift)
    R = max((fmx - fmn).length / 2, 0.05) if (fit or box) else max((mx - mn).length / 2, 0.05)
    # chao escuro
    fz = (mn.z - 0.0004) if floor_z is None else floor_z
    bpy.ops.mesh.primitive_plane_add(size=40.0, location=(ctr.x, ctr.y, fz))
    fl = bpy.context.active_object
    fl.name = "FLOOR"
    fm = bpy.data.materials.new("floor")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (s2l(0.07), s2l(0.045), s2l(0.035), 1.0)
    fb.inputs["Roughness"].default_value = 0.5
    fl.data.materials.append(fm)
    # luzes (escala com o tamanho do assunto)
    k = (R * 3.0) ** 2 * 26 * key_gain
    right = Vector((math.cos(math.radians(az_deg)), math.sin(math.radians(az_deg)), 0))
    fwd = Vector((math.sin(math.radians(az_deg)), -math.cos(math.radians(az_deg)), 0))
    add_light("AREA", ctr + (fwd * 1.3 - right * 1.6 + Vector((0, 0, 2.2))) * R, ctr, (1.0, 0.88, 0.72), k, R * 1.6, "LT_key")
    add_light("AREA", ctr + (-fwd * 1.8 + right * 1.9 + Vector((0, 0, 1.0))) * R, ctr, (1.0, 0.68, 0.42), k * 0.6, R * 1.2, "LT_rim")
    add_light("AREA", ctr + (fwd * 2.4 + right * 1.6 + Vector((0, 0, 0.7))) * R, ctr, (1.0, 0.8, 0.6), k * 0.25, R * 2.5, "LT_fill")
    sc.render.filepath = path
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True)
    if fit:
        from bpy_extras.object_utils import world_to_camera_view
        xs_ = [world_to_camera_view(sc, cam, Vector((x, y, z))).x for x in (fmn.x, fmx.x) for y in (fmn.y, fmx.y) for z in (fmn.z, fmx.z)]
        print("FRAC %s: lanche ocupa %.0f%% da largura" % (name, 100 * (max(xs_) - min(xs_))))
    print("RENDER", path)


def render_all(stats):
    quick = ARGS.quick
    W, H = (600, 400) if quick else (1200, 800)
    PW, PH = (800, 533) if quick else (1600, 1067)
    smp = 16 if quick else 96
    outdir = ARGS.renders
    os.makedirs(outdir, exist_ok=True)
    clear_scene()
    setup_scene(W, H, smp)
    parts = import_parts()
    allv = ARGS.views == "all"
    want = set(ARGS.views.split(",")) if not allv else None

    def ok(k):
        return allv or (k in want)

    p3 = dict(az_deg=24, el_deg=26, lens=65)
    single = [("01-tabua", "tabua", 22), ("02-pao", "pao", 28), ("03-pasta", "pasta", 30), ("04-costela", "costela", 28),
              ("05-creme", "creme", 28), ("06-mussarela", "mussarela", 28), ("07-gratinado", "gratinado", 30)]
    for fname, pt, el in single:
        if ok(fname[:2]):
            render_view(parts, fname, [pt], 24, el, 70, os.path.join(outdir, fname + ".png"), (W, H), smp)
    if ok("08"):
        render_view(parts, "08", ["macarico"], 30, 22, 75, os.path.join(outdir, "08-macarico.png"), (W, H), smp)
        # a chama fica escondida no render 08 (sem chama)
    if ok("09"):
        render_view(parts, "09", ["macarico"], 30, 18, 75, os.path.join(outdir, "09-macarico-chama.png"), (W, H), smp, flame=True)
    full = ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "macarico"]
    if ok("10"):
        render_view(parts, "10", full, 24, 35, 62, os.path.join(outdir, "10-montado.png"), (W, H), smp, margin=1.42, lid="closed",
                    fit=["pao", "mussarela", "gratinado"], shift=(0.012, 0.0, -0.004))
    if ok("11"):
        offs = {"pasta": 0.04, "costela": 0.08, "creme": 0.12, "mussarela": 0.235, "gratinado": 0.29}
        render_view(parts, "11", ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado"], 18, 14, 62,
                    os.path.join(outdir, "11-explodido.png"), (W, H), smp, offsets=offs, floor_z=-0.028, margin=1.1,
                    lid="closed", lid_dz=0.17)
    if ok("12"):
        render_view(parts, "12", ["pao", "pasta", "costela"], 16, 24, 90, os.path.join(outdir, "12-close-costela.png"), (W, H), smp,
                    margin=1.0, shift=(0.0, 0.0, 0.0), hide=("pao_tampa",))
    if ok("13"):
        render_view(parts, "13", ["tabua", "pao", "pasta", "costela", "creme"], 22, 30, 62,
                    os.path.join(outdir, "13-aberto-recheado.png"), (W, H), smp, margin=1.08, lid="open")
    if ok("14"):
        render_view(parts, "14", ["tabua", "pao", "pasta", "costela", "creme"], 14, 14, 90,
                    os.path.join(outdir, "14-tampa-fechada.png"), (W, H), smp, lid="closed", lid_deg=17.0,
                    box=((-0.085, -0.060, 0.020), (0.085, 0.0, 0.075)), margin=1.02)
    if ok("poster") and not ARGS.no_poster:
        tmp = os.path.join(outdir, "_poster_src.png")
        render_view(parts, "poster", full, 24, 35, 62, tmp, (PW, PH), smp, margin=1.42, lid="closed",
                    fit=["pao", "mussarela", "gratinado"], shift=(0.012, 0.0, -0.004))
        img = bpy.data.images.load(tmp)
        os.makedirs(POSTER_DIR, exist_ok=True)
        for q in (92, 88, 84, 80, 74, 68, 60, 52, 44, 36):
            sc = bpy.context.scene
            sc.render.image_settings.file_format = "WEBP"
            sc.render.image_settings.quality = q
            img.save_render(POSTER, scene=sc)
            sz = os.path.getsize(POSTER)
            print("POSTER q=%d size=%d" % (q, sz))
            if sz <= 190 * 1024:
                break


def main():
    stats = build_and_export()
    if ARGS.views != "none":
        render_all(stats)


main()
