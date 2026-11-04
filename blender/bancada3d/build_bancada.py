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
ap.add_argument("--renders", default=r"\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-429-modelos\renders")
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
SEL_PARTS = PARTS if ARGS.parts == "all" else ARGS.parts.split(",")

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
        self.v, self.c, self.f, self.fm = [], [], [], []

    def add(self, p, c=(1.0, 1.0, 1.0)):
        self.v.append((float(p[0]), float(p[1]), float(p[2])))
        self.c.append(tuple(c))
        return len(self.v) - 1

    def face(self, *idx, m=0):
        self.f.append(tuple(idx))
        self.fm.append(m)

    def quad(self, a, b, c, d, m=0):
        self.face(a, b, c, d, m=m)

    def tri(self, a, b, c, m=0):
        self.face(a, b, c, m=m)


def finish(mb, name, mats, parent, uvfn=None, weld=True):
    """Solda vertices coincidentes, remove faces degeneradas e cria o objeto."""
    if weld:
        key2new, remap, V, C = {}, [], [], []
        for i, p in enumerate(mb.v):
            k = (round(p[0] * 1e6), round(p[1] * 1e6), round(p[2] * 1e6))
            if k not in key2new:
                key2new[k] = len(V)
                V.append(p)
                C.append(mb.c[i])
            remap.append(key2new[k])
    else:
        V, C, remap = list(mb.v), list(mb.c), list(range(len(mb.v)))
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
        cols[i] = (s2l(c[0]), s2l(c[1]), s2l(c[2]), 1.0)
    ca = mesh.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", cols.ravel())
    mesh.color_attributes.active_color = ca
    for m in mats:
        mesh.materials.append(m)
    if len(mats) > 1 and len(FM) == len(mesh.polygons):
        mesh.polygons.foreach_set("material_index", FM)
    if uvfn is not None:
        uv = mesh.uv_layers.new(name="UVMap")
        vi = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get("vertex_index", vi)
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
             image=None, spec=0.5, coat=0.0):
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
    if emit is not None:
        b.inputs["Emission Color"].default_value = (s2l(emit[0]), s2l(emit[1]), s2l(emit[2]), 1.0)
        b.inputs["Emission Strength"].default_value = emit_s
    return m


# ----------------------------------------------------------------------------
# geometria do PAO (barquinho): funcoes analiticas compartilhadas por todas as camadas
# ----------------------------------------------------------------------------
L = 0.150          # meio comprimento (pao tem 0,30 m)
WB = 0.052         # meia largura
HB = 0.074         # altura
NEXP = 2.6         # expoente da superelipse da secao
XO = 0.140         # fim da abertura
HW0 = 0.031        # meia abertura no centro
DEP0 = 0.040       # profundidade da cavidade
LIP0 = 0.011       # largura do labio
XM = 0.140         # fim do monte de recheio

_bp_cache = {}


def bprof(x):
    k = round(x, 7)
    if k in _bp_cache:
        return _bp_cache[k]
    t = min(abs(x) / L, 0.9995)
    s = (1 - t ** 4) ** 0.5
    Wb = WB * s ** 0.85
    Hb = HB * s ** 0.6
    zc = Hb / 2
    to = abs(x) / XO
    if to < 1:
        hw = HW0 * (1 - to ** 4) ** 0.5
        d = DEP0 * (1 - to ** 3) ** 0.5
    else:
        hw, d = 0.0, 0.0
    hw = min(hw, 0.62 * Wb)
    lip = min(LIP0 * (Wb / WB) ** 0.5, hw * 1.2)
    yo = min(hw + lip, 0.93 * Wb)
    lip = yo - hw
    cphi = (yo / Wb) ** (NEXP / 2)
    phir = math.acos(min(1.0, cphi))
    zr = zc + (Hb / 2) * math.sin(phir) ** (2 / NEXP)
    d = min(d, max(0.0, zr - 0.012))
    r = dict(Wb=Wb, Hb=Hb, zc=zc, hw=hw, lip=lip, yo=yo, yi=hw, d=d, zr=zr, phir=phir, s=s)
    _bp_cache[k] = r
    return r


def zouter(x, y):
    """z da superficie externa do pao (metade de cima) em (x, |y|)."""
    p = bprof(x)
    y = min(abs(y), 0.999 * p["Wb"])
    c = (y / p["Wb"]) ** (NEXP / 2)
    return p["zc"] + (p["Hb"] / 2) * (max(0.0, 1 - c * c)) ** (1 / NEXP)


def zouter_normal(x, y):
    """normal (ny, nz) da secao externa em y>0 (aprox. por diferenca)."""
    h = 0.0006
    z1, z0 = zouter(x, y + h), zouter(x, max(0.0, y - h))
    dz = (z1 - z0) / (2 * h)
    n = math.hypot(dz, 1.0)
    return (-dz / n, 1.0 / n)


def zfloor(x, y):
    p = bprof(x)
    if p["hw"] < 1e-6:
        return p["zr"]
    r = 1 - (y / p["hw"]) ** 2
    return p["zr"] - p["d"] * math.sqrt(max(0.0, r))


PK = 0.027


def by_of(x):
    return bprof(x)["yo"] + 0.004


def pile(x, v, bump=1.0):
    """superficie superior do monte de costela (envelope), v = y / By(x)."""
    p = bprof(x)
    By = p["yo"] + 0.004
    a = abs(v)
    tx = max(0.0, 1 - (abs(x) / XM) ** 4) ** 0.5
    if a <= 1.0:
        zE = zouter(x, By) + 0.006
        z = zE + PK * tx * (1 - a * a) ** 0.75
        z += bump * 0.0028 * nz(x * 38, a * By * 38, 1.7) * tx
        return z
    return zouter(x, min(a * By, 0.97 * p["Wb"])) + 0.006


def cos_spaced(n, half):
    return [half * math.sin(math.pi * (i / (n - 1) - 0.5)) for i in range(n)]


# ----------------------------------------------------------------------------
# construtores genericos
# ----------------------------------------------------------------------------

def strip_layer(mb, xs, us, ftop, fbot):
    """Placa grossa param. por (x,u). ftop/fbot(x,u) -> (pos, cor). Vertices coincidentes sao soldados."""
    nx, nu = len(xs), len(us)
    T = [[mb.add(*ftop(xs[i], us[j])) for j in range(nu)] for i in range(nx)]
    B = [[mb.add(*fbot(xs[i], us[j])) for j in range(nu)] for i in range(nx)]
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


def tube(mb, pts, radii, colors, sides=5, cap=True, m=0, squash=1.0):
    """Tubo ao longo de pts (lista de Vector) com raio/cor por ponto."""
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
    for i in range(n):
        t = T[i]
        nrm = nrm - t * nrm.dot(t)
        if nrm.length < 1e-6:
            nrm = Vector((1, 0, 0)).cross(t)
        nrm.normalize()
        bn = t.cross(nrm)
        ring = []
        for k in range(sides):
            al = 2 * math.pi * k / sides
            off = nrm * math.cos(al) + bn * (math.sin(al) * squash)
            col = colors[i](al) if callable(colors[i]) else colors[i]
            ring.append(mb.add(pts[i] + off * radii[i], col))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            mb.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], m=m)
    if cap:
        c0 = mb.add(pts[0], colors[0](0) if callable(colors[0]) else colors[0])
        c1 = mb.add(pts[-1], colors[-1](0) if callable(colors[-1]) else colors[-1])
        for k in range(sides):
            k2 = (k + 1) % sides
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


def build_pao(root):
    mb = MB()
    NS = 100
    No, Nl, Ni = 34, 3, 22
    rings = []
    for xi in cos_spaced(NS, L * 0.9995):
        p = bprof(xi)
        Wb, Hb, zc, phir = p["Wb"], p["Hb"], p["zc"], p["phir"]
        yo, yi, zr, d, lip = p["yo"], p["yi"], p["zr"], p["d"], p["lip"]
        ring = []
        sweep = math.pi + 2 * phir
        # externa: borda direita -> embaixo -> borda esquerda
        for k in range(No + 1):
            ph = phir - sweep * k / No
            cs, sn = math.cos(ph), math.sin(ph)
            y = Wb * math.copysign(abs(cs) ** (2 / NEXP), cs)
            z = zc + (Hb / 2) * math.copysign(abs(sn) ** (2 / NEXP), sn)
            ring.append(mb.add((xi, y, z), crust_color(xi, y, z)))
        # labio esquerdo (de -yo para -yi), com boleado
        bump = 0.0045 * min(1.0, lip / 0.011)

        def lipcol(q, y, z):
            return lerpc(crust_color(xi, y, z), C_TOAST, smooth(0.0, 0.8, q) * 0.8)
        for k in range(1, Nl + 1):
            q = k / (Nl + 1)
            y = -yo + lip * q
            z = zr + bump * math.sin(math.pi * q)
            ring.append(mb.add((xi, y, z), lipcol(q, y, z)))
        # cavidade (miolo): da esquerda para a direita passando pelo fundo
        for k in range(Ni + 1):
            ps = math.pi + math.pi * k / Ni
            y = yi * math.cos(ps)
            z = zr + d * math.sin(ps)
            dep = (zr - z) / max(d, 1e-4) if d > 1e-4 else 0.0
            cc = lerpc(lerpc(C_CRUMB, C_TOAST, 0.35), C_CRUMB, smooth(0.0, 0.5, dep))
            cc = lerpc(cc, C_CRUMB_LO, smooth(0.6, 1.0, dep) * 0.6)
            cc = mulc(cc, 1 + 0.06 * nz(xi * 60, y * 60, z * 60))
            ring.append(mb.add((xi, y, z), cc))
        # labio direito (de yi para yo)
        for k in range(1, Nl + 1):
            q = k / (Nl + 1)
            y = yi + lip * q
            z = zr + bump * math.sin(math.pi * (1 - q))
            ring.append(mb.add((xi, y, z), lipcol(1 - q, y, z)))
        rings.append(ring)
    n = len(rings[0])
    for i in range(NS - 1):
        for k in range(n):
            k2 = (k + 1) % n
            mb.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2])
    # tampas nas pontas (ja quase fechadas): fecha com leque
    for end, rev in ((0, True), (NS - 1, False)):
        ring = rings[end]
        cx, cy, cz = mb.v[ring[0]][0], 0.0, bprof(mb.v[ring[0]][0])["zc"]
        c = mb.add((cx, cy, cz), C_CRUST_LO)
        for k in range(n):
            k2 = (k + 1) % n
            if rev:
                mb.tri(c, ring[k], ring[k2])
            else:
                mb.tri(c, ring[k2], ring[k])
    mat = make_mat("mat_pao", rough=0.72, spec=0.35)
    return [finish(mb, "pao_casca_miolo", [mat], root)]


# ----------------------------------------------------------------------------
# PECA: pasta de alho
# ----------------------------------------------------------------------------
C_PASTA = hexc("#F5E8C0")
C_PASTA2 = hexc("#EAD79F")
XP = 0.126


def pasta_pos(x, u, top=True):
    p = bprof(x)
    hwp = p["hw"] * 0.96
    y = u * hwp
    zf = zfloor(x, y) + 0.0005
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
# PECA: costela desfiada em fiapos
# ----------------------------------------------------------------------------
MEAT = [hexc(h) for h in ("#5A2314", "#6B2A18", "#6F3220", "#4B1C0E", "#7E3E25", "#3B160B", "#8A4A2C", "#9C6040")]
C_CORE = hexc("#43190E")


def core_pos(x, u, top=True):
    p = bprof(x)
    By = p["yo"] + 0.004
    y = u * By
    ztop = pile(x, u, 1.0) - 0.0035
    zbot = zfloor(x, y) + 0.001 if abs(y) < p["hw"] else p["zr"]
    zbot = min(zbot, ztop - 0.002)
    st = 0.5 + 0.5 * nz(x * 55, y * 260, 3.1)
    col = lerpc(C_CORE, hexc("#6B2A18"), smooth(0.35, 0.8, st) * 0.9)
    return (x, y, ztop if top else zbot), col


def fiber_path(rng, x0, v0, length, nseg, free):
    """Pontos 3D de um fio que segue a superficie do monte / transborda a borda."""
    p0 = bprof(x0)
    pts = []
    x, y = x0, v0 * (p0["yo"] + 0.004)
    th = rng.gauss(0, 0.55) + (math.pi if rng.random() < 0.5 else 0.0)
    if rng.random() < 0.22:
        th = rng.choice([1, -1]) * rng.uniform(0.9, 1.5) + (math.pi if rng.random() < 0.5 else 0)
    if abs(v0) > 0.8 and rng.random() < 0.3:
        # fios nos flancos escorrem para fora
        th = math.copysign(1, v0) * math.pi / 2 + rng.gauss(0, 0.45)
    ds = length / nseg
    wig = 0.0
    arch = rng.uniform(0.0006, 0.0045) if free else 0.0005
    for i in range(nseg + 1):
        pts.append((x, y))
        wig = 0.6 * wig + rng.gauss(0, 0.32)
        th += wig * 0.5
        x += ds * math.cos(th)
        y += ds * math.sin(th)
        pp = bprof(max(-L, min(L, x)))
        lim = pp["Wb"] * 0.97
        if abs(y) > lim:
            y = math.copysign(lim, y)
            th = -th
        if abs(x) > 0.136:
            x = math.copysign(0.136, x)
            th = math.pi - th
    return pts, arch


def build_costela(root):
    mb = MB()
    # miolo escuro do monte (evita ver atraves dos fios)
    xs = cos_spaced(64, XM * 0.985)
    us = [-1 + 2 * j / 16 for j in range(17)]
    strip_layer(mb, xs, us, lambda x, u: core_pos(x, u, True), lambda x, u: core_pos(x, u, False))
    rng = random.Random(2026)
    sides, nseg = 4, 6
    count = 0
    plan = [(240, 0.5, 1.28, True), (190, 0.0, 0.55, False)]   # (qtd, |v| min, |v| max, livre)
    for qty, vlo, vhi, free in plan:
        for _ in range(qty):
            x0 = rng.uniform(-0.134, 0.134)
            v0 = rng.uniform(vlo, vhi) * rng.choice([-1, 1])
            length = rng.uniform(0.022, 0.048)
            pts2, arch = fiber_path(rng, x0, v0, length, nseg, free)
            wide = rng.random() < 0.16
            r0 = rng.uniform(0.0045, 0.0065) if wide else rng.uniform(0.0021, 0.0040)
            base = rng.choice(MEAT)
            base = mulc(base, rng.uniform(0.85, 1.15))
            P, R, C = [], [], []
            for i, (x, y) in enumerate(pts2):
                t = i / nseg
                pp = bprof(max(-L, min(L, x)))
                By = pp["yo"] + 0.004
                a = abs(y) / By
                rr = r0 * (0.38 + 0.62 * math.sin(math.pi * (0.1 + 0.8 * t))) * (0.8 + 0.4 * (0.5 + 0.5 * nz(i * 3.1, x * 90, y * 90)))
                if a <= 1.0:
                    z = pile(x, y / By, 1.0) - 0.0008 + 0.0007 * nz(x * 120, y * 120, i)
                    z += arch * math.sin(math.pi * t) * smooth(0.55, 0.95, a) if free else 0.0
                    pos = Vector((x, y, z))
                else:
                    yy = min(abs(y), 0.97 * pp["Wb"])
                    zo = zouter(x, yy)
                    ny, nzv = zouter_normal(x, yy)
                    pos = Vector((x, math.copysign(yy + ny * rr * 0.9, y), zo + nzv * rr * 0.9))
                    pos.z += arch * 0.5 * math.sin(math.pi * t)
                pos.z = max(pos.z, rr * 0.9)
                P.append(pos)
                R.append(rr)
                shade = 0.82 + 0.3 * smooth(0.0, 1.0, math.sin(math.pi * t))
                bc = lerpc(base, hexc("#C27850"), 0.18 * (0.5 + 0.5 * nz(x * 80, y * 80, 4.4)))
                C.append(
                    (lambda al, bc=bc, shade=shade: mulc(bc, shade * (0.88 + 0.16 * math.cos(al - 1.0))))
                )
            # suaviza o caminho (2 passadas), mantem pontas
            for _ in range(2):
                P2 = [P[0]] + [(P[i - 1] + 2 * P[i] + P[i + 1]) / 4 for i in range(1, len(P) - 1)] + [P[-1]]
                P = P2
            tube(mb, P, R, C, sides=sides, cap=True, squash=rng.uniform(0.28, 0.42) if wide else rng.uniform(0.55, 0.9))
            count += 1
    mat = make_mat("mat_costela", rough=0.42, spec=0.55)
    return [finish(mb, "costela_fiapos", [mat], root)]


# ----------------------------------------------------------------------------
# PECA: creme de queijo
# ----------------------------------------------------------------------------
C_CREME = hexc("#F7E6B0")
C_CREME2 = hexc("#EFD58C")


def make_tongues(seed, n, amp, w, xr):
    r = random.Random(seed)
    return [(r.uniform(-xr, xr), r.uniform(*w), r.uniform(*amp)) for _ in range(n)]


def vm_side(x, base, nf, ns, tongs, nsc):
    v = base + nsc * nz(x * nf, ns, 0.5)
    for xk, w, a in tongs:
        v += a * math.exp(-((x - xk) / w) ** 2)
    return v


TONG_C = (make_tongues(31, 6, (0.10, 0.26), (0.006, 0.010), 0.11), make_tongues(32, 6, (0.10, 0.26), (0.006, 0.010), 0.11))
TONG_M = (make_tongues(41, 9, (0.22, 0.45), (0.0045, 0.008), 0.105), make_tongues(42, 9, (0.22, 0.45), (0.0045, 0.008), 0.105))
XCR = 0.132
XC = 0.128


def vm_creme(x, u):
    f = (u + 1) / 2
    a = vm_side(x, 0.90, 22, 3.0, TONG_C[0], 0.05)
    b = vm_side(x, 0.90, 22, 8.0, TONG_C[1], 0.05)
    return lerp(a, b, f)


def vm_mus(x, u):
    f = (u + 1) / 2
    a = vm_side(x, 0.80, 18, 13.0, TONG_M[0], 0.07)
    b = vm_side(x, 0.80, 18, 19.0, TONG_M[1], 0.07)
    return lerp(a, b, f)


def vcap(x, v):
    p = bprof(x)
    By = p["yo"] + 0.004
    vmax = 0.97 * p["Wb"] / max(By, 1e-6)
    return math.copysign(min(abs(v), vmax), v)


def creme_pos(x, u, top=True):
    r_end = max(0.0, 1 - (abs(x) / XCR) ** 3) ** 0.5
    v = vcap(x, u * vm_creme(x, u) * r_end)
    p = bprof(x)
    y = v * (p["yo"] + 0.004)
    zb = pile(x, v, 1.0) + 0.0004
    zt = pile(x, v, 0.8) + 0.0038 + 0.0013 * nz(x * 60, v * 6, 8.1) + 0.0007 * nz(x * 140, v * 12, 2.2)
    f = min(1.0, (1 - abs(u)) / 0.12) ** 0.6 * min(1.0, (1 - abs(x) / XCR) / 0.1) ** 0.6
    f = max(0.0, f)
    z = zb + (zt - zb) * f if top else zb
    col = lerpc(C_CREME, C_CREME2, clamp(0.45 + 0.4 * nz(x * 30, y * 30, 6.6)))
    return (x, y, z), col


def build_creme(root):
    mb = MB()
    xs = cos_spaced(110, XCR)
    us = [-1 + 2 * j / 26 for j in range(27)]
    strip_layer(mb, xs, us, lambda x, u: creme_pos(x, u, True), lambda x, u: creme_pos(x, u, False))
    mat = make_mat("mat_creme", rough=0.2, spec=0.8)
    return [finish(mb, "creme_queijo", [mat], root)]


# ----------------------------------------------------------------------------
# PECA: mussarela derretida
# ----------------------------------------------------------------------------
C_MUS_PALE = hexc("#F7E4A4")
C_MUS_GOLD = hexc("#F0C75E")


def wave_m(x, v):
    return 0.0024 * nz(x * 52, v * 5, 3.3) + 0.0012 * nz(x * 120, v * 9, 7.1)


def mus_geom(x, u):
    r_end = max(0.0, 1 - (abs(x) / XC) ** 3) ** 0.5
    v = vcap(x, u * vm_mus(x, u) * r_end)
    p = bprof(x)
    y = v * (p["yo"] + 0.004)
    return v, y


def mus_top_z(x, v):
    return pile(x, v, 0.6) + 0.0092 + wave_m(x, v)


def mus_pos(x, u, top=True):
    v, y = mus_geom(x, u)
    zb = pile(x, v, 1.0) + 0.0006
    zt = mus_top_z(x, v)
    f = min(1.0, (1 - abs(u)) / 0.10) ** 0.55 * min(1.0, (1 - abs(x) / XC) / 0.08) ** 0.55
    f = max(0.0, f)
    z = zb + (zt - zb) * f if top else zb
    t = clamp((zt - zb) / 0.012)
    col = lerpc(C_MUS_PALE, C_MUS_GOLD, clamp(0.25 + 0.5 * t + 0.25 * nz(x * 26, y * 26, 9.9)))
    return (x, y, z), col


def drip_curve(x, ytip, length):
    """pontos sobre a face externa do pao a partir de y=ytip descendo `length` (y>0)."""
    p = bprof(x)
    Wb, Hb, zc = p["Wb"], p["Hb"], p["zc"]
    ytip = min(ytip, 0.9 * Wb)
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
                ny, nzv = zouter_normal(xk, abs(q.y))
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
        By = by_of(cx_x)
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
            By = by_of(x)
            room = (min(0.9, vm_mus(x, u) * 0.82) - abs(u) * vm_mus(x, u)) * By
            R = min(rng.uniform(0.0035, 0.0105), max(0.0018, room * 0.8))
            patch(x, u, R, rng.uniform(0.7, 1.5), rng.uniform(0, 3.14), rng.uniform(0.4, 1.0))
    for _ in range(60):   # pintinhas
        x = rng.uniform(-0.115, 0.115)
        u = rng.uniform(-0.85, 0.85)
        v, y = mus_geom(x, u)
        By = by_of(x)
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
# PECA: macarico (+ chama)
# ----------------------------------------------------------------------------
TY = -0.108          # y do macarico
TR = 0.0172          # raio do corpo (altura do eixo)
TX0 = 0.100          # x do fundo do corpo (a=0)


def build_macarico(root):
    orange = hexc("#FF6A1A")
    steel = hexc("#C9CDD2")
    dark_steel = hexc("#7D838B")
    black = hexc("#1E1D1F")
    red = hexc("#D8281F")
    org = (TX0, TY, TR)
    objs = []
    # corpo laranja
    mb = MB()
    lathe(mb, rcyl(0.0166, 0.0, 0.078, 0.0045), org, "x", -1, 36, orange)
    objs.append(finish(mb, "macarico_corpo", [make_mat("mat_macarico_laranja", base=orange, rough=0.32, metal=0.05, vcol=False, spec=0.7, coat=0.4)], root))
    # aco: pescoco, cabeca, bico
    mb = MB()
    lathe(mb, rcyl(0.0105, 0.077, 0.092, 0.002), org, "x", -1, 32, steel)
    lathe(mb, rcyl(0.0128, 0.090, 0.104, 0.0025), org, "x", -1, 32, steel)
    noz = [(0.0, 0.103), (0.0072, 0.103), (0.0068, 0.150), (0.0086, 0.151), (0.0086, 0.163), (0.0058, 0.163), (0.0050, 0.159), (0.0, 0.158)]
    lathe(mb, noz, org, "x", -1, 28, dark_steel)
    objs.append(finish(mb, "macarico_bico", [make_mat("mat_macarico_aco", base=steel, rough=0.26, metal=1.0, vcol=False)], root))
    # borracha preta: faixa de pegada + knob traseiro + valvula
    mb = MB()
    lathe(mb, rcyl(0.0173, 0.022, 0.052, 0.0016), org, "x", -1, 36, black)
    lathe(mb, rcyl(0.0105, -0.010, 0.0, 0.0018), org, "x", -1, 28, black)
    lathe(mb, rcyl(0.0152, 0.066, 0.078, 0.0018), org, "x", -1, 32, black)
    objs.append(finish(mb, "macarico_borracha", [make_mat("mat_macarico_borracha", base=black, rough=0.7, vcol=False, spec=0.3)], root))
    # botao de ignicao
    mb = MB()
    lathe(mb, rcyl(0.0042, 0.0, 0.007, 0.0012), (TX0 - 0.097, TY, TR + 0.0125), "z", 1, 20, red)
    objs.append(finish(mb, "macarico_botao", [make_mat("mat_macarico_botao", base=red, rough=0.4, vcol=False)], root))
    # chama (objeto separado): um cone, base azul -> ponta laranja (2 materiais emissivos)
    tip_x = TX0 - 0.163
    mb = MB()
    n = 16
    prof = [(0.0, 0.0)]
    for i in range(1, n + 1):
        t = i / n
        prof.append((0.0066 * math.sin(math.pi * t ** 0.55) * (1 - 0.2 * t), 0.078 * t))
    prof[-1] = (0.0, 0.078)
    # primeira metade azul (m=1, via lathe), resto laranja (m=0, aneis manuais)
    k = 8
    lathe(mb, prof[:k + 1], (tip_x, TY, TR), "x", -1, 20, orange, m=1)
    seg = 20
    rings = []
    for (r, a) in prof[k:]:
        ring = []
        for q in range(seg):
            th = 2 * math.pi * q / seg
            ring.append(mb.add((tip_x - a, TY + r * math.cos(th), TR + r * math.sin(th)), orange))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for q in range(seg):
            q2 = (q + 1) % seg
            mb.quad(rings[i][q], rings[i + 1][q], rings[i + 1][q2], rings[i][q2], m=0)
    mo = make_mat("mat_chama_externa", base=hexc("#FF8A1E"), rough=0.5, vcol=False, emit=hexc("#FF7A12"), emit_s=4.0)
    mi = make_mat("mat_chama_interna", base=hexc("#4A8BFF"), rough=0.5, vcol=False, emit=hexc("#3D7CFF"), emit_s=6.0)
    objs.append(finish(mb, "chama", [mo, mi], root))
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
        export_vertex_color="ACTIVE", export_image_format="JPEG", export_image_quality=82,
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
    return got


def descend(o):
    out = [o]
    for c in o.children:
        out += descend(c)
    return out


def set_visible(parts, names, flame=False):
    for n, d in parts.items():
        vis = n in names
        for r in d["roots"]:
            for o in descend(r):
                v = vis and (flame or not o.name.startswith("chama"))
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


def render_view(parts, name, show, az_deg, el_deg, lens, path, res, samples, offsets=None, floor_z=None, margin=1.08, shift=(0, 0, 0), key_gain=1.0, flame=False):
    sc = bpy.context.scene
    for n, d in parts.items():
        for r in d["roots"]:
            r.location = (0, 0, 0)
    if offsets:
        for n, dz in offsets.items():
            for r in parts[n]["roots"]:
                r.location = (0, 0, dz)
    set_visible(parts, show, flame)
    bpy.context.view_layer.update()
    objs = [o for n in show for r in parts[n]["roots"] for o in descend(r)]
    mn, mx = world_bbox(objs)
    for o in list(bpy.data.objects):
        if o.name.startswith(("CAM", "LT_", "FLOOR")):
            bpy.data.objects.remove(o, do_unlink=True)
    cd = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    ctr, dist = frame_camera(cam, mn, mx, math.radians(az_deg), math.radians(el_deg), lens, margin, shift)
    R = max((mx - mn).length / 2, 0.05)
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
    add_light("AREA", ctr + (-fwd * 1.8 + right * 1.9 + Vector((0, 0, 1.0))) * R, ctr, (1.0, 0.5, 0.2), k * 0.6, R * 1.2, "LT_rim")
    add_light("AREA", ctr + (fwd * 2.4 + right * 1.6 + Vector((0, 0, 0.7))) * R, ctr, (1.0, 0.8, 0.6), k * 0.25, R * 2.5, "LT_fill")
    sc.render.filepath = path
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True)
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
        render_view(parts, "10", full, 24, 35, 62, os.path.join(outdir, "10-montado.png"), (W, H), smp, margin=1.06)
    if ok("11"):
        offs = {"pasta": 0.05, "costela": 0.10, "creme": 0.15, "mussarela": 0.19, "gratinado": 0.235}
        render_view(parts, "11", ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado"], 18, 14, 62,
                    os.path.join(outdir, "11-explodido.png"), (W, H), smp, offsets=offs, floor_z=-0.028, margin=1.1)
    if ok("12"):
        render_view(parts, "12", ["pao", "pasta", "costela"], 16, 24, 90, os.path.join(outdir, "12-close-costela.png"), (W, H), smp,
                    margin=1.0, shift=(0.0, 0.0, 0.0))
    if ok("poster") and not ARGS.no_poster:
        tmp = os.path.join(outdir, "_poster_src.png")
        render_view(parts, "poster", full, 24, 35, 62, tmp, (PW, PH), smp, margin=1.06)
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
