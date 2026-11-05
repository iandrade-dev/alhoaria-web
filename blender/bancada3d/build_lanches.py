"""
LAR-431 (lanches) - Modelos 3D de "Pulled Pork!", "Brocolis & Queijo!" e "Dogalho" para a bancada (Alhoaria).

Gera por script os GLBs do recheio de pernil desfiado, dos floretes de brocolis e das pecas do Dogalho
(cestinha, brioche, pasta, salsichas, molhos, fondue, mussarela, batata palha), os icones da bandeja e os
renders de revisao. Importa funcoes de build_bancada.py (sem alterar o comportamento dele). Veja README.md.

    blender.exe -b --factory-startup -P build_lanches.py -- [opcoes]

Opcoes:
    --renders DIR   pasta dos PNGs de revisao (fora do repo)
    --parts a,b     so constroi/exporta essas pecas (padrao: todas; "none" nao exporta)
    --views a,b     so renderiza essas vistas (padrao: todas; "none" nao renderiza)
    --icons a,b     so gera esses icones (padrao: todos; "none" nao gera)
    --quick         renders 600 px / poucas amostras (iteracao)
Tudo e procedural; nada e baixado. Blender: eixo Z para cima; o exportador converte para Y para cima.
"""
import bpy
import math
import os
import sys
import random
import argparse
import importlib.util
import numpy as np
from mathutils import Vector

_argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--renders", default=r"\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-431-lanches\renders")
ap.add_argument("--parts", default="all")
ap.add_argument("--views", default="all")
ap.add_argument("--icons", default="all")
ap.add_argument("--quick", action="store_true")
ARGS = ap.parse_args(_argv)

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ICON_DIR = os.path.join(REPO, "public", "assets", "bancada", "icones")


def _load_bb():
    """Importa build_bancada.py como modulo sem rodar nada dele (--parts none --views none)."""
    old = sys.argv
    sys.dont_write_bytecode = True
    sys.argv = ["blender", "--", "--parts", "none", "--views", "none"]
    try:
        spec = importlib.util.spec_from_file_location("build_bancada", os.path.join(HERE, "build_bancada.py"))
        mod = importlib.util.module_from_spec(spec)
        sys.modules["build_bancada"] = mod
        spec.loader.exec_module(mod)
    finally:
        sys.argv = old
    return mod


bb = _load_bb()
MODELS = bb.MODELS
MB, finish, make_mat, tube, lathe, rcyl, strip_layer = bb.MB, bb.finish, bb.make_mat, bb.tube, bb.lathe, bb.rcyl, bb.strip_layer
cos_spaced, root_empty, tri_count, hexc, lerpc, mulc = bb.cos_spaced, bb.root_empty, bb.tri_count, bb.hexc, bb.lerpc, bb.mulc
smooth, clamp, lerp, nz, fbm, s2l, superq = bb.smooth, bb.clamp, bb.lerp, bb.nz, bb.fbm, bb.s2l, bb.superq
bprof, zface, zunder, pile, by_of, surf_z, XM, L = bb.bprof, bb.zface, bb.zunder, bb.pile, bb.by_of, bb.surf_z, bb.XM, bb.L
OPEN_RAD = bb.OPEN_RAD

# nomes dos GLBs (raiz = nome do arquivo com hifen -> sublinhado)
PARTS_L = ["pulled-pernil", "brocolis-floretes", "dog-cesta", "dog-brioche", "dog-pasta", "dog-salsichas",
           "dog-molhos", "dog-fondue", "dog-mussarela", "dog-palha"]
SEL = PARTS_L if ARGS.parts == "all" else ([] if ARGS.parts == "none" else ARGS.parts.split(","))


def save_img(name, rgb, colorspace):
    return bb._save_img(name, rgb, colorspace)


def bright(c, k):
    """clareia preservando o matiz (sem estourar um canal so)."""
    k = min(k, 0.98 / max(max(c), 1e-6))
    return tuple(min(1.0, v * k) for v in c)


def smooth_pts(P, it=2):
    for _ in range(it):
        P = [P[0]] + [(P[i - 1] + 2 * P[i] + P[i + 1]) / 4 for i in range(1, len(P) - 1)] + [P[-1]]
    return P


# ----------------------------------------------------------------------------
# PULLED PORK: pernil desfiado (feixes de fiapos claros e dourados, pontas caramelizadas)
# ----------------------------------------------------------------------------
PORK = [hexc(h) for h in ("#B4774A", "#BC7F4F", "#C58854", "#CD9059", "#D9A066", "#C48550", "#D39A5E", "#A86B42", "#BF8658", "#C9A27A", "#B08A64")]
C_PCORE_LO, C_PCORE_HI = hexc("#946033"), hexc("#C48B50")
C_CARA = hexc("#7A3A18")
C_CARA2 = hexc("#A5481F")


def pcore_pos(x, u, top=True):
    By = by_of(x)
    y = u * By
    ztop = pile(x, u, 0.0) - 0.0040 + 0.0016 * nz(x * 70, y * 70, 3.1) + 0.0012 * nz(x * 150, y * 150, 8.8)
    zbot = min(zface(x, y) + 0.0005, ztop - 0.002)
    st = 0.5 + 0.5 * nz(x * 90, y * 90, 3.1)
    col = lerpc(C_PCORE_LO, C_PCORE_HI, smooth(0.3, 0.85, st))
    return (x, y, ztop if top else zbot), col


def pulled_strips(mb, rng, centers, surf, clampxy, nseg=4, sides=4, len_rng=(0.028, 0.048), wmean_rng=(0.0046, 0.0068),
                  nstr=(3, 5), layers=(0.0, 0.0010, 0.0020, 0.0032), bend_sd=10.0, chunk_p=0.35):
    """Feixes de fiapos achatados. centers = [(cx, cy, borda)]; surf(x, y) = z do topo do monte."""
    n = 0
    for (cx, cy, edge) in centers:
        if edge:
            th = rng.gauss(0, 0.40) + math.copysign(0.18, cy) * rng.random()
        elif rng.random() < 0.25:
            th = rng.choice([-1, 1]) * rng.uniform(0.8, 1.35)
        else:
            th = rng.gauss(0, 0.9)
        if rng.random() < 0.5:
            th += math.pi
        tuft_len = rng.uniform(*len_rng)
        bend = rng.gauss(0, 1.0) * bend_sd
        m_str = rng.randint(*nstr)
        layer = rng.choice(layers)
        tone = rng.uniform(0.92, 1.08)
        base_col = rng.choice(PORK)
        wmean = rng.uniform(*wmean_rng)
        chunky = rng.random() < chunk_p            # pedacos mais curtos e grossos no meio dos fios
        if chunky:
            m_str = rng.randint(2, 3)
            tuft_len *= 0.50
            wmean *= 1.7
        for si in range(m_str):
            wide = rng.random() < 0.07
            w = rng.uniform(0.0070, 0.0095) if wide else wmean * rng.uniform(0.7, 1.35)
            lat = (si - (m_str - 1) / 2) * wmean * 0.95 + rng.gauss(0, 0.0012)
            t0 = rng.uniform(-0.009, 0.009)
            ln = tuft_len * rng.uniform(0.55, 1.25) * (0.55 if wide else 1.0)
            wig_a = rng.uniform(0.0015, 0.0040) * (0.4 if chunky else 1.0)
            wig_p = rng.uniform(0, 6.28)
            squash = rng.uniform(0.70, 1.0)
            th_s = th + rng.gauss(0, 0.30)
            dvs = (math.cos(th_s), math.sin(th_s))
            nvs = (-dvs[1], dvs[0])
            twist = rng.gauss(0, 1.3)
            wf = rng.uniform(3.5, 7.0)
            wn = rng.uniform(0, 50)
            P, R, C = [], [], []
            col_s = bright(base_col, 1.45 * tone * rng.uniform(0.92, 1.08))
            ph_col = rng.uniform(0, 6.28)
            gold = rng.random() < 0.25
            for k in range(nseg + 1):
                t = k / nseg
                s = -ln / 2 + ln * t + t0
                off = lat + bend * s * s + wig_a * math.sin(t * wf + wig_p)
                x = cx + dvs[0] * s + nvs[0] * off
                y = cy + dvs[1] * s + nvs[1] * off
                x, y = clampxy(x, y)
                prof = 0.60 + 0.40 * math.sin(math.pi * (0.06 + 0.88 * t))
                prof *= 0.82 + 0.36 * (0.5 + 0.5 * nz(wn + t * 2.5, 1.3, 0.2))
                a = 0.5 * w * prof
                z = surf(x, y) + 0.0004 + layer + 0.0007 * math.sin(math.pi * t)
                z = max(z, a * squash + 0.0004)
                P.append(Vector((x, y, z)))
                R.append(a)
                tip = bb.smooth(0.30, 0.0, t) + bb.smooth(0.70, 1.0, t)
                cc = lerpc(col_s, C_CARA2 if gold else C_CARA, 0.45 * tip)
                cc = lerpc(cc, hexc("#E2B27A"), 0.10 * (0.5 + 0.5 * nz(x * 95, y * 95, 4.4)))
                cc = bright(cc, 0.82 + 0.36 * (0.5 + 0.5 * nz(wn + t * 4.0, 7.7, 1.0)))
                C.append((lambda al, cc=cc, ph=ph_col: bright(cc, 0.82 + 0.22 * math.sin(al) + 0.10 * math.sin(3 * al + ph))))
            P = smooth_pts(P, 2)
            tube(mb, P, R, C, sides=sides, cap=True, squash=squash, twist=twist,
                 uv=(rng.uniform(0, 1), 0.030, rng.uniform(0, 1), 1.0))
            n += 1
    return n


def build_pulled(root):
    mb = MB()
    xs = cos_spaced(46, XM * 0.985)
    us = [-1 + 2 * j / 14 for j in range(15)]
    strip_layer(mb, xs, us, lambda x, u: pcore_pos(x, u, True), lambda x, u: pcore_pos(x, u, False),
                uvf=lambda p: (p[0] / 0.03, p[1] / 0.03))
    rng = random.Random(4311)
    NX, NV = 17, 6
    centers = []
    for ix in range(NX):
        for iv in range(NV):
            cx = -0.134 + 0.268 * (ix + rng.uniform(0.1, 0.9)) / NX
            vc = -1.08 + 2.16 * (iv + rng.uniform(0.1, 0.9)) / NV
            centers.append((cx, vc * by_of(cx), abs(vc) > 0.72))

    def clampxy(x, y):
        x = max(-0.139, min(0.139, x))
        pp = bprof(max(-L, min(L, x)))
        return x, math.copysign(min(abs(y), pp["Wb"] + 0.0035), y)
    n = pulled_strips(mb, rng, centers, surf_z, clampxy, nseg=4, sides=3, len_rng=(0.030, 0.050), wmean_rng=(0.0030, 0.0044),
                      nstr=(3, 6), layers=(0.0, 0.0010, 0.0020, 0.0032, 0.0045))
    print("pulled: %d tiras" % n)
    fib_c, fib_n = bb.make_fibre_textures()
    mat = make_mat("mat_pulled", vcol=False, rough=0.52, spec=0.40, image=fib_c, normal_image=fib_n, normal_strength=1.0)
    return [finish(mb, "pulled_pernil_fiapos", [mat], root)]


# ----------------------------------------------------------------------------
# BROCOLIS: floretes (cabecinhas granuladas + talinhos claros) com miolo verde escuro por baixo
# ----------------------------------------------------------------------------
G_LO, G_HI = hexc("#4E8F3A"), hexc("#7DBA5A")
G_DEEP = hexc("#356B2A")
G_STEM_LO, G_STEM_HI = hexc("#B9D68A"), hexc("#DCEBB0")


def make_grain_textures(n=256):
    """Cabecinha de brocolis: granulado fino (cor relativa + normal), tileavel."""
    rng = np.random.RandomState(91)
    h = 0.05 * bb._fft_noise(rng, n, 2, 8)
    bb._stamp_holes(h, rng, 760, 3.2, 6.5, -1.0, 0.25, power=0.7)
    bb._stamp_holes(h, rng, 900, 1.8, 3.2, -0.55, 0.3, power=0.7)
    hn = (h - h.min()) / (h.max() - h.min() + 1e-9)
    col = np.clip(0.70 + 0.38 * hn, 0, 1.0)
    col = col * (0.95 + 0.05 * bb._fft_noise(rng, n, 2, 12))
    nrm = bb._normal_from_height(h, 2.2)
    c_img = save_img("grao_cor", np.stack([col, col, col], axis=2), "sRGB")
    n_img = save_img("grao_normal", nrm * 0.5 + 0.5, "Non-Color")
    return c_img, n_img


def lobe(mb, c, R, axis, seed, lo=G_LO, hi=G_HI, uvk=2.0, nu=10, nv=6, bump=0.14, m=0, ybase=None):
    """Esfera irregular (lobulo de cabecinha). Eixo dos polos = axis (horizontal-ish, para esconder o aperto da UV)."""
    a = Vector(axis).normalized()
    e1 = a.cross(Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))).normalized()
    e2 = a.cross(e1)
    z0 = (ybase if ybase is not None else c.z - R)

    def pt(th, ph):
        l = Vector((math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), math.sin(th)))
        d = e1 * l.x + e2 * l.y + a * l.z
        q = c + d * R
        k = 1 + bump * (0.65 * nz(q.x * 115 + seed, q.y * 115, q.z * 115) + 0.35 * nz(q.x * 230, q.y * 230 + seed, q.z * 230))
        p = c + d * R * k
        t = clamp((p.z - z0) / (2 * R) * 0.95 + 0.12 * nz(p.x * 150, p.y * 150, p.z * 150 + seed))
        return p, lerpc(lo, hi, t)
    rows = []
    for j in range(nv + 1):
        th = -math.pi / 2 + math.pi * j / nv
        row = []
        for k in range(nu + 1):
            ph = 2 * math.pi * k / nu
            p, col = pt(th, ph)
            u = (k + (0.5 if j in (0, nv) else 0.0)) / nu * uvk
            row.append(mb.add(p, col, uv=(u, (j / nv) * uvk * 0.5)))
        rows.append(row)
    for j in range(nv):
        for k in range(nu):
            if j == 0:
                mb.tri(rows[0][k], rows[1][k + 1], rows[1][k], m=m)
            elif j == nv - 1:
                mb.tri(rows[j][k], rows[j][k + 1], rows[nv][k], m=m)
            else:
                mb.quad(rows[j][k], rows[j][k + 1], rows[j + 1][k + 1], rows[j + 1][k], m=m)


def hemi_dir(rng, zmin=0.15):
    """direcao aleatoria no hemisferio de cima."""
    while True:
        v = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(zmin, 1)))
        if 0.2 < v.length <= 1.0:
            return v.normalized()


def floret(mb, rng, end, dirv, R, seed):
    """Floreta de brocolis: talo com a ponta de corte em `end` (direcao dirv: da cabeca para o talo), cabecinha com 1 lobulo
    central, 3 laterais e brotinhos granulados por cima. Devolve (centro da cabeca, topo)."""
    k = R / 0.0125
    d = Vector(dirv).normalized()
    slen = rng.uniform(0.024, 0.032) * k
    cc = end - d * slen
    cc.z = max(cc.z, end.z + 0.62 * R)
    # talo principal, claro, grosso, ponta de corte mais clara
    tpts = [end.copy(), end - d * slen * 0.5, cc - d * R * 0.1]
    tube(mb, tpts, [0.0042 * k, 0.0035 * k, 0.0028 * k],
         [G_STEM_HI, lerpc(G_STEM_LO, G_STEM_HI, 0.4), lerpc(G_STEM_LO, G_LO, 0.6)], sides=8, cap=True, m=1)
    nl = 4
    lobes = [(cc, R)]
    ang0 = rng.uniform(0, 6.28)
    for i in range(nl - 1):
        a = ang0 + 2 * math.pi * i / (nl - 1) + rng.uniform(-0.3, 0.3)
        rr = R * rng.uniform(0.60, 0.74)
        off = Vector((math.cos(a), math.sin(a), 0)) * R * rng.uniform(0.70, 0.86)
        c2 = cc + off + Vector((0, 0, -R * rng.uniform(0.12, 0.34)))
        lobes.append((c2, rr))
        tube(mb, [end - d * slen * 0.55, c2 - Vector((0, 0, rr * 0.55)) - (c2 - cc).normalized() * rr * 0.1],
             [0.0020 * k, 0.0014 * k], [G_STEM_LO, lerpc(G_STEM_LO, G_LO, 0.7)], sides=4, cap=True, m=1)
    top = cc.z + R
    for i, (c2, rr) in enumerate(lobes):
        ax = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.25, 0.25)))
        lobe(mb, c2, rr, ax, seed + i * 3.7, lo=mulc(G_LO, rng.uniform(1.04, 1.18)), hi=mulc(G_HI, rng.uniform(1.0, 1.1)),
             uvk=rng.uniform(1.8, 2.6))
        top = max(top, c2.z + rr * 1.05)
        # brotinhos (graos maiores) por cima
        for b in range(2 if i else 3):
            dr = hemi_dir(rng, 0.25)
            rb = rr * rng.uniform(0.26, 0.34)
            cb = c2 + dr * rr * 0.92
            lobe(mb, cb, rb, Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0.2)), seed + 50 + i * 7 + b, lo=mulc(G_LO, 1.15),
                 hi=mulc(G_HI, 1.12), uvk=1.0, nu=7, nv=4, bump=0.18)
            top = max(top, cb.z + rb)
    return cc, top


def build_brocolis(root):
    mb = MB()
    rng = random.Random(7731)
    C_CORE_LO, C_CORE_HI = hexc("#2F5C24"), hexc("#41782F")

    def core(x, u, top=True):
        By = by_of(x)
        y = u * By
        zf = zface(x, y)
        r_end = max(0.0, 1 - (abs(x) / 0.134) ** 4) ** 0.5
        zt = zf + (0.0046 + 0.0016 * nz(x * 60, y * 60, 3.3) + 0.0012 * nz(x * 130, y * 130, 1.1)) * (0.5 + 0.5 * r_end) * (1 - 0.3 * abs(u) ** 3)
        col = lerpc(C_CORE_LO, C_CORE_HI, 0.5 + 0.5 * nz(x * 80, y * 80, 5.0))
        return (x, y, zt if top else min(zf + 0.0006, zt - 0.002)), col
    xs = cos_spaced(40, 0.136)
    us = [-0.96 + 1.92 * j / 12 for j in range(13)]
    f0 = len(mb.f)
    strip_layer(mb, xs, us, lambda x, u: core(x, u, True), lambda x, u: core(x, u, False))
    for i in range(f0, len(mb.f)):
        mb.fm[i] = 1
    # floretes em grade com jitter (cabecas maiores no centro, menores nas pontas)
    NXF, rows_v = 7, (-0.50, 0.0, 0.50)
    placed = []
    for ix in range(NXF):
        for iv, vr in enumerate(rows_v):
            if (ix + iv) % 7 == 6:
                continue
            cx = -0.118 + 0.236 * (ix + 0.5 + (0.22 if iv == 1 else -0.12 * (iv - 1))) / NXF + rng.uniform(-0.007, 0.007)
            cx = max(-0.122, min(0.122, cx))
            v = vr + rng.uniform(-0.14, 0.14)
            placed.append((cx, v * by_of(cx)))
    rng.shuffle(placed)
    placed = placed[:18]
    tops = []
    for (x, y) in placed:
        endfac = 1.0 - 0.34 * bb.smooth(0.07, 0.135, abs(x))
        R = rng.uniform(0.0105, 0.0138) * endfac
        zf = zface(x, y)
        R = min(R, (zunder(x, y) - zf - 0.0030) / 2.05)
        # talo preferencialmente ao longo do pao (sai pelas pontas), deitado
        a = (0.0 if rng.random() < 0.5 else math.pi) + rng.uniform(-0.8, 0.8)
        el = math.radians(rng.uniform(6, 28))
        dv = Vector((math.cos(el) * math.cos(a), math.cos(el) * math.sin(a), -math.sin(el)))
        end = Vector((x, y, zf + 0.0030))
        cc, top = floret(mb, random.Random(rng.random()), end, dv, R, rng.uniform(0, 100))
        tops.append(top - zunder(x, y))
    # pedacinhos soltos entre as cabecas
    for _ in range(34):
        x = rng.uniform(-0.12, 0.12)
        y = rng.uniform(-0.8, 0.8) * by_of(x)
        R = rng.uniform(0.0036, 0.0055)
        zf = zface(x, y)
        c = Vector((x, y, zf + 0.0042 + R * 0.5))
        lobe(mb, c, R, Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0.1)), rng.uniform(0, 99), nu=7, nv=4, uvk=1.2)
    print("brocolis: %d floretes, topo maximo vs tampa = %+.1f mm" % (len(placed), 1000 * max(tops)))
    gc, gn = make_grain_textures()
    m_head = make_mat("mat_brocolis_cabeca", vcol=False, rough=0.6, spec=0.35, image=gc, normal_image=gn, normal_strength=1.2)
    m_stem = make_mat("mat_brocolis_talo", vcol=True, rough=0.8, spec=0.2)
    return [finish(mb, "brocolis_floretes_mesh", [m_head, m_stem], root)]


# ----------------------------------------------------------------------------
# DOGALHO: geometria do brioche (pao comprido, mole, dourado) - funcoes analiticas compartilhadas
# ----------------------------------------------------------------------------
DL, DW, DH = 0.112, 0.041, 0.072   # meio comprimento, meia largura, altura do brioche inteiro
DZ0 = 0.006                         # fundo do brioche acima da tabua (sobre o papel da cesta)
DN = 2.5                            # expoente da superelipse
DCUT = 0.40                         # corte horizontal a 40 % da altura (base mais baixa que a tampa)
DDISH = 0.008                       # concavidade do miolo da base
DCAV = 0.036                        # cavidade do miolo da tampa (cobre salsichas + molhos)
DHINGE_DEG = 110.0
DOPEN_RAD = -math.radians(DHINGE_DEG)


def dprof(x):
    t = min(abs(x) / DL, 0.9995)
    s = (1 - t ** 8) ** 0.5
    W = DW * s ** 0.7
    H = DH * s ** 0.5
    wcut = W * (1 - (1 - 2 * DCUT) ** DN) ** (1 / DN)
    return dict(W=W, H=H, zm=DZ0 + H / 2, zcut=DZ0 + H * DCUT, wcut=wcut, s=s)


def douter(x, y):
    """z da casca externa (tampa) em (x, |y|)."""
    p = dprof(x)
    y = min(abs(y), 0.999 * p["W"])
    c = (y / p["W"]) ** DN
    return p["zm"] + (p["H"] / 2) * max(0.0, 1 - c) ** (1 / DN)


def douter_normal(x, y, z):
    p = dprof(x)
    a = abs(y) / p["W"]
    b = (z - p["zm"]) / (p["H"] / 2)
    gy = a ** (DN - 1) / p["W"]
    gz = math.copysign(abs(b) ** (DN - 1), b) / (p["H"] / 2)
    n = math.hypot(gy, gz) or 1.0
    return gy / n, gz / n


def dface(x, y):
    p = dprof(x)
    yy = p["wcut"] - 0.004
    r = max(0.0, 1 - (y / yy) ** 2)
    rel = 0.0008 * nz(x * 60, y * 60, 11.3) + 0.0012 * fbm(x * 22, y * 22, 4.1, 2)
    return p["zcut"] - DDISH * p["s"] * r ** 0.8 + rel * min(1.0, r * 4)


def dunder(x, y):
    p = dprof(x)
    yc = p["wcut"] - 0.006
    r = max(0.0, 1 - (y / yc) ** 2)
    rel = 0.0008 * nz(x * 60, y * 60, 17.9) + 0.0012 * fbm(x * 22, y * 22, 9.7, 2)
    z = p["zcut"] + DCAV * p["s"] * math.sqrt(r) + rel * min(1.0, r * 4)
    return min(z, douter(x, y) - 0.0045) if r > 0 else z


C_BR_LO, C_BR_HI, C_BR_TOP = hexc("#C98528"), hexc("#EDB652"), hexc("#B4651C")


def brioche_color(x, y, z):
    h = clamp((z - DZ0) / DH)
    c = lerpc(C_BR_LO, C_BR_HI, smooth(0.05, 0.65, h))
    c = lerpc(c, C_BR_TOP, smooth(0.62, 1.0, h) * 0.35 * (0.5 + 0.5 * nz(x * 25, y * 25, 2.2)))
    c = mulc(c, 1 + 0.07 * nz(x * 70, y * 70, z * 70))
    sh = bb.smooth(0.55, 1.0, fbm(x * 60, y * 60, z * 60 + 9, 3)) * 0.18      # pontinhos de egg wash mais escuros
    return lerpc(c, hexc("#9A5518"), sh)


def build_brioche(root):
    NS, No, Nf = 70, 16, 18
    xs = cos_spaced(NS, DL * 0.9995)
    phc = -math.asin((1 - 2 * DCUT) ** (DN / 2))      # angulo do corte (negativo: abaixo do meio)

    def crumb_color(y, wcut, under=False):
        edge = 1 - abs(y) / max(wcut, 1e-6)
        c = lerpc(hexc("#D5A25A"), (1.0, 0.95, 0.80), smooth(0.02, 0.26, edge))
        return mulc(c, 0.94 if under else 1.0)

    def arc_pt(xi, ph):
        p = dprof(xi)
        cs, sn = math.cos(ph), math.sin(ph)
        y = p["W"] * math.copysign(abs(cs) ** (2 / DN), cs)
        z = p["zm"] + (p["H"] / 2) * math.copysign(abs(sn) ** (2 / DN), sn)
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
            c = mb.add((xe, 0.0, dprof(xe)["zm"]), C_BR_LO, uv=(0.3, 0.3))
            for k in range(n):
                k2 = (k + 1) % n
                if k in nseam:
                    continue
                if rev:
                    mb.tri(c, ring[k], ring[k2])
                else:
                    mb.tri(c, ring[k2], ring[k])

    TC = 0.050

    def make_half(lid_half):
        mb, rings = MB(), []
        for xi in xs:
            p = dprof(xi)
            ring = []
            for k in range(No + 1):
                if lid_half:
                    ph = (math.pi - phc) - (math.pi - 2 * phc) * k / No
                else:
                    ph = phc - (math.pi + 2 * phc) * k / No
                y, z = arc_pt(xi, ph)
                ring.append(mb.add((xi, y, z), brioche_color(xi, y, z), uv=(xi / TC, k / No)))
            for k in range(0, Nf + 2):
                if lid_half:
                    y = p["wcut"] - 2 * p["wcut"] * k / (Nf + 1)
                    z = dunder(xi, y)
                else:
                    y = -p["wcut"] + 2 * p["wcut"] * k / (Nf + 1)
                    z = dface(xi, y)
                ring.append(mb.add((xi, y, z), crumb_color(y, p["wcut"], under=lid_half),
                                   uv=(xi / TC, y / TC + (0.37 if lid_half else 0.0))))
            rings.append(ring)
        nring = len(rings[0])
        loft(mb, rings, (No, nring - 1))
        return mb

    base = make_half(False)
    lid = make_half(True)
    Yh, Zh = dprof(0.0)["wcut"], dprof(0.0)["zcut"]
    lid.v = [(x, y - Yh, z - Zh) for (x, y, z) in lid.v]
    crumb_c, crumb_n = bb.make_crumb_textures()
    m_crust = make_mat("mat_brioche_casca", vcol=True, rough=0.30, spec=0.6, coat=0.35)
    m_crumb = make_mat("mat_brioche_miolo", vcol=False, rough=0.9, spec=0.2, image=crumb_c, normal_image=crumb_n, normal_strength=0.7)
    ob = finish(base, "dog_brioche_base", [m_crust, m_crumb], root)
    ol = finish(lid, "dog_brioche_tampa", [m_crust, m_crumb], root)
    ol.location = (0.0, Yh, Zh)
    ol.rotation_mode = "XYZ"
    ol.rotation_euler = (DOPEN_RAD, 0.0, 0.0)
    return [ob, ol]


# --- pasta de alho do Dogalho
C_PASTA, C_PASTA2 = hexc("#F5E8C0"), hexc("#EAD79F")
XPD = 0.098


def dpasta_pos(x, u, top=True):
    p = dprof(x)
    hw = (p["wcut"] - 0.007) * 0.95
    y = u * hw
    zf = dface(x, y) + 0.0004
    f = smooth(1.0, 0.84, abs(u)) * smooth(1.0, 0.88, abs(x) / XPD)
    th = 0.0034 * f
    z = zf + (th * (1 + 0.25 * nz(x * 90, y * 90, 2.2)) if top else 0.0)
    col = lerpc(C_PASTA, C_PASTA2, 0.5 + 0.5 * nz(x * 40, y * 40, 5.5))
    return (x, y, z), col


def build_dpasta(root):
    mb = MB()
    xs = cos_spaced(64, XPD)
    us = [-1 + 2 * j / 14 for j in range(15)]
    strip_layer(mb, xs, us, lambda x, u: dpasta_pos(x, u, True), lambda x, u: dpasta_pos(x, u, False))
    rng = random.Random(21)
    greens = [hexc("#3F7F25"), hexc("#5A9A2E"), hexc("#2F6A1E"), hexc("#7DB43C")]
    for _ in range(80):
        x = rng.uniform(-0.09, 0.09)
        u = rng.uniform(-0.8, 0.8)
        (cx, cy, cz), _c = dpasta_pos(x, u, True)
        r = rng.uniform(0.0011, 0.0024)
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
    mat = make_mat("mat_dog_pasta", rough=0.38, spec=0.6)
    return [finish(mb, "dog_pasta_alho", [mat], root)]


# --- salsichas
SR = 0.0136            # raio da salsicha
SY = 0.0138            # afastamento do eixo (lado a lado, encostadas)
SHALF = (0.1255, 0.1215)
SZ0 = DZ0 + DH * DCUT + 0.0085


def saus_zc(x):
    return SZ0 - 0.0045 * (x / 0.1) ** 2


def saus_top(x, y):
    z = None
    for yc in (-SY, SY):
        d = abs(y - yc)
        if d < SR:
            zz = saus_zc(x) + math.sqrt(SR * SR - d * d)
            z = zz if z is None or zz > z else z
    return z if z is not None else saus_zc(x)


def build_salsichas(root):
    mb = MB()
    C_BODY, C_TOP, C_BOT, C_TIP = hexc("#B93D2A"), hexc("#D6563B"), hexc("#8A2819"), hexc("#A82D1E")
    for si, (yc, half) in enumerate(zip((-SY, SY), SHALF)):
        cl = SR * 0.95
        prof = []
        for k in range(7):
            a = (math.pi / 2) * k / 6
            prof.append((-half + cl * (1 - math.cos(a)), SR * math.sin(a)))
        for k in range(1, 9):
            prof.append((-half + cl + (2 * half - 2 * cl) * k / 9, SR))
        for k in range(7):
            a = (math.pi / 2) * (6 - k) / 6
            prof.append((half - cl * (1 - math.cos(a)), SR * math.sin(a)))
        sides = 16
        rows = []
        for (x, r) in prof:
            ring = []
            wr = 1 + 0.018 * nz(x * 60 + si * 9, 0.3, 1.0)
            for k in range(sides):
                th = 2 * math.pi * k / sides
                tipf = bb.smooth(half - cl * 1.2, half, abs(x))
                top = 0.5 + 0.5 * math.sin(th)
                col = lerpc(lerpc(C_BOT, C_TOP, clamp(top * 1.1)), C_TIP, tipf * 0.5)
                col = mulc(col, 1 + 0.05 * nz(x * 40, th, si * 3.0))
                ring.append(mb.add((x, yc + r * wr * math.cos(th), saus_zc(x) + r * wr * math.sin(th)), col))
            rows.append(ring)
        for i in range(len(rows) - 1):
            for k in range(sides):
                k2 = (k + 1) % sides
                mb.quad(rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k])
    mat = make_mat("mat_dog_salsicha", rough=0.28, spec=0.7, coat=0.3)
    return [finish(mb, "dog_salsichas_corpo", [mat], root)]


# --- molhos (ketchup e mostarda em zigue-zague sobre as salsichas)
def build_molhos(root):
    mb = MB()
    for (col, ph, amp, lam, rr) in ((hexc("#C3261A"), 0.0, 0.0205, 0.0215, 0.0021), (hexc("#E9B91F"), math.pi, 0.0195, 0.0215, 0.0020)):
        P, R, C = [], [], []
        n = 150
        for i in range(n + 1):
            x = -0.104 + 0.208 * i / n
            y = amp * math.sin(2 * math.pi * x / lam + ph)
            z = saus_top(x, y) + rr * 0.45 + 0.0003
            P.append(Vector((x, y, z)))
            t = i / n
            R.append(rr * (0.8 + 0.2 * bb.smooth(0.0, 0.06, t) * bb.smooth(1.0, 0.94, t)) * (1 + 0.1 * nz(x * 80, ph, 2.2)))
            C.append(mulc(col, 1 + 0.08 * nz(x * 50, ph, 1.2)))
        tube(mb, P, R, C, sides=6, cap=True)
    mat = make_mat("mat_dog_molhos", rough=0.22, spec=0.8)
    return [finish(mb, "dog_molhos_ziguezague", [mat], root)]


# --- fondue e mussarela (cobertura sobre a tampa fechada, escorrendo pelas laterais)
TONG_FD = (bb.make_tongues(61, 8, (0.22, 0.42), (0.005, 0.009), 0.09), bb.make_tongues(62, 8, (0.22, 0.42), (0.005, 0.009), 0.09))
TONG_MD = (bb.make_tongues(63, 5, (0.10, 0.22), (0.005, 0.009), 0.08), bb.make_tongues(64, 5, (0.10, 0.22), (0.005, 0.009), 0.08))
XF, XMD = 0.098, 0.092


def vm_f(x, sg):
    return bb.vm_side(x, 0.72, 20, 13.0 if sg < 0 else 19.0, TONG_FD[0 if sg < 0 else 1], 0.06)


def vm_m(x, sg):
    return bb.vm_side(x, 0.52, 22, 7.0 if sg < 0 else 11.0, TONG_MD[0 if sg < 0 else 1], 0.05)


def rend(x, XE):
    return max(0.0, 1 - (abs(x) / XE) ** 3) ** 0.5


def lay_y(x, u, vmf, XE):
    p = dprof(x)
    sg = 1 if u >= 0 else -1
    v = max(-0.998, min(0.998, u * vmf(x, sg) * rend(x, XE)))
    return v * p["W"]


def lay_u(x, y, vmf, XE):
    p = dprof(x)
    sg = 1 if y >= 0 else -1
    den = vmf(x, sg) * rend(x, XE) * p["W"]
    return min(1.0, abs(y) / den) if den > 1e-6 else 1.0


def edge_f(ua, x, XE):
    return min(1.0, (1 - ua) / 0.12) ** 0.55 * min(1.0, (1 - abs(x) / XE) / 0.10) ** 0.55


def fond_top(x, y):
    ua = lay_u(x, y, vm_f, XF)
    f = max(0.0, edge_f(ua, x, XF)) if ua < 1.0 else 0.0
    th = 0.0062 * f * (1 + 0.12 * nz(x * 40, y * 40, 3.0))
    return douter(x, y) + 0.0003 + th + 0.0010 * nz(x * 70, y * 70, 1.7) * f


def mus_top(x, y):
    ua = lay_u(x, y, vm_m, XMD)
    f = max(0.0, edge_f(ua, x, XMD)) if ua < 1.0 else 0.0
    return fond_top(x, y) + 0.0036 * f * (1 + 0.15 * nz(x * 55, y * 55, 8.0)) + 0.0012 * nz(x * 110, y * 110, 4.0) * f


C_FD_PALE, C_FD_CREAM = hexc("#F5E4A2"), hexc("#EFD27A")
C_MU_PALE, C_MU_GOLD, C_MU_TOAST = hexc("#F7E3A0"), hexc("#EDBA4A"), hexc("#CC8C2E")


def fond_pos(x, u, top=True):
    y = lay_y(x, u, vm_f, XF)
    zb = douter(x, y) + 0.0003
    zt = fond_top(x, y)
    z = zt if top else zb
    t = clamp((zt - zb) / 0.0062)
    col = lerpc(C_FD_CREAM, C_FD_PALE, clamp(0.35 + 0.45 * t + 0.25 * nz(x * 26, y * 26, 9.9)))
    return (x, y, z), col


def mus_pos_d(x, u, top=True):
    y = lay_y(x, u, vm_m, XMD)
    zb = fond_top(x, y) - 0.0004
    zt = mus_top(x, y)
    z = zt if top else zb
    t = clamp((zt - zb) / 0.0048)
    col = lerpc(C_MU_PALE, C_MU_GOLD, clamp(0.2 + 0.5 * t + 0.3 * nz(x * 24, y * 24, 5.9)))
    col = lerpc(col, C_MU_TOAST, 0.35 * bb.smooth(0.45, 0.8, fbm(x * 55, y * 55, 2.2, 3)) * t)
    return (x, y, z), col


def drip_curve_d(x, ytip, length):
    p = dprof(x)
    W, H, zm = p["W"], p["H"], p["zm"]
    ytip = min(ytip, 0.995 * W)
    ph0 = math.acos(min(1.0, (ytip / W) ** (DN / 2)))
    pts, acc, prev = [], 0.0, None
    for i in range(201):
        ph = ph0 - (ph0 + 1.2) * i / 200
        cs, sn = math.cos(ph), math.sin(ph)
        y = W * math.copysign(abs(cs) ** (2 / DN), cs)
        z = zm + (H / 2) * math.copysign(abs(sn) ** (2 / DN), sn)
        q = Vector((x, y, z))
        if prev is not None:
            acc += (q - prev).length
        prev = q
        pts.append((acc, q))
        if acc >= length:
            break
    return pts


def add_drips(mb, seed, tongs, vmf, XE, amin, lens, rr0, cola, colb):
    rng = random.Random(seed)
    for side, tg in ((1, tongs[1]), (-1, tongs[0])):
        for (xk, w, a) in tg:
            if a < amin:
                continue
            y = lay_y(xk, float(side), vmf, XE)
            if abs(y) < 0.97 * dprof(xk)["W"]:
                continue
            ln = rng.uniform(*lens)
            cur = drip_curve_d(xk, abs(y) - 0.002, ln)
            if len(cur) < 6:
                continue
            nseg = 9
            P, R, C = [], [], []
            for i in range(nseg + 1):
                t = i / nseg
                target = ln * t
                q = cur[min(range(len(cur)), key=lambda j: abs(cur[j][0] - target))][1]
                rr = rr0 * (0.7 + 0.8 * smooth(0.6, 0.95, t)) * (1 - 0.8 * smooth(0.92, 1.0, t))
                ny, nzv = douter_normal(xk, abs(q.y), q.z)
                P.append(Vector((q.x, side * (abs(q.y) + ny * rr * 0.7), q.z + nzv * rr * 0.7)))
                R.append(max(rr, 0.0004))
                C.append(lerpc(cola, colb, 0.25 + 0.2 * t))
            tube(mb, P, R, C, sides=7, cap=True)


def build_dfondue(root):
    mb = MB()
    xs = cos_spaced(96, XF)
    us = [-1 + 2 * j / 24 for j in range(25)]
    strip_layer(mb, xs, us, lambda x, u: fond_pos(x, u, True), lambda x, u: fond_pos(x, u, False))
    add_drips(mb, 88, TONG_FD, vm_f, XF, 0.30, (0.016, 0.040), 0.0030, C_FD_CREAM, C_FD_PALE)
    mat = make_mat("mat_dog_fondue", rough=0.16, spec=1.0, coat=0.4)
    return [finish(mb, "dog_fondue_queijos", [mat], root)]


def build_dmussarela(root):
    mb = MB()
    xs = cos_spaced(90, XMD)
    us = [-1 + 2 * j / 22 for j in range(23)]
    strip_layer(mb, xs, us, lambda x, u: mus_pos_d(x, u, True), lambda x, u: mus_pos_d(x, u, False))
    mat = make_mat("mat_dog_mussarela", rough=0.2, spec=1.0, coat=0.35)
    return [finish(mb, "dog_mussarela_derretida", [mat], root)]


# --- batata palha
def build_palha(root):
    mb = MB()
    rng = random.Random(909)
    cols = [hexc(h) for h in ("#D9A546", "#E4B558", "#EBC46C", "#F2D17F", "#DDAE4E")]
    n = 0
    for _ in range(340):
        x = rng.uniform(-0.098, 0.098)
        p = dprof(x)
        y = rng.uniform(-0.88, 0.88) * p["W"]
        if abs(x) > 0.07 and abs(y) > 0.45 * p["W"]:
            continue
        ln = rng.uniform(0.020, 0.040)
        th = rng.uniform(0, math.pi) if rng.random() < 0.8 else rng.gauss(0, 0.5)
        d = (math.cos(th), math.sin(th))
        lift = rng.choice([0.0, 0.0008, 0.0016, 0.0026, 0.0038, 0.0050])
        curl = rng.gauss(0, 1.0) * 0.006
        nseg = 3
        P = []
        for k in range(nseg + 1):
            t = k / nseg
            s = (t - 0.5) * ln
            xx = x + d[0] * s - d[1] * curl * math.sin(math.pi * t)
            yy = y + d[1] * s + d[0] * curl * math.sin(math.pi * t)
            yy = max(-0.95 * p["W"], min(0.95 * p["W"], yy))
            xx = max(-0.1, min(0.1, xx))
            zz = max(fond_top(xx, yy), mus_top(xx, yy)) + 0.0011 + lift + 0.0016 * math.sin(math.pi * t) * rng.uniform(0.5, 1.5)
            P.append(Vector((xx, yy, zz)))
        r = rng.uniform(0.00055, 0.00085)
        c = rng.choice(cols)
        col = mulc(c, rng.uniform(0.9, 1.08))
        tube(mb, P, [r * 0.8, r, r, r * 0.8], [col, col, mulc(col, 1.06), mulc(col, 0.95)], sides=3, cap=False,
             squash=rng.uniform(0.8, 1.0), twist=rng.uniform(0, 3))
        n += 1
    print("palha: %d fios" % n)
    mat = make_mat("mat_dog_palha", rough=0.55, spec=0.45)
    return [finish(mb, "dog_palha_fios", [mat], root)]


# --- cestinha de vime + papel manteiga
BA0, BB0 = 0.136, 0.073        # semi-eixos do fundo
BA1, BB1 = 0.160, 0.096        # semi-eixos do aro
BHT = 0.046                    # altura do aro
BN = 2.8


def oval_pt(a, b, ps):
    c, s = math.cos(ps), math.sin(ps)
    return (a * math.copysign(abs(c) ** (2 / BN), c), b * math.copysign(abs(s) ** (2 / BN), s))


def wall_ab(h, dd=0.0):
    f = clamp(h / BHT) ** 0.9
    return BA0 + (BA1 - BA0) * f + dd, BB0 + (BB1 - BB0) * f + dd


def make_wicker_textures(n=512):
    """Trama de vime (cor + normal), tileavel: 8 x 8 celulas, cada celula uma fita por cima ou por baixo."""
    rng = np.random.RandomState(17)
    g = 8
    c = n // g
    h = np.zeros((n, n))
    col = np.zeros((n, n, 3))
    tans = [np.array(hexc(x)) for x in ("#C48C4A", "#D49A57", "#B87F3E", "#DDA562", "#CC9450")]
    lu = (np.arange(c) + 0.5) / c
    LU, LV = np.meshgrid(lu, lu)
    hor_top = (0.35 + 0.65 * np.sin(np.pi * LV) ** 0.55) * (0.85 + 0.15 * np.sin(np.pi * LU))
    ver_top = (0.35 + 0.65 * np.sin(np.pi * LU) ** 0.55) * (0.85 + 0.15 * np.sin(np.pi * LV))
    for i in range(g):
        for j in range(g):
            hz = (i + j) % 2 == 0
            tone = tans[rng.randint(len(tans))] * rng.uniform(0.9, 1.08)
            base = hor_top if hz else ver_top
            under = 0.42 * (ver_top if hz else hor_top)
            hh = np.where(base > 0.5 * under + 0.2, base, under)
            hh = 0.32 + 0.68 * hh
            streak = 0.94 + 0.06 * np.sin((LU if hz else LV) * 40 + rng.uniform(0, 6))
            sl = (slice(j * c, (j + 1) * c), slice(i * c, (i + 1) * c))
            h[sl] = hh
            col[sl] = tone[None, None, :] * (0.62 + 0.38 * hh)[..., None] * streak[..., None]
    h = h + 0.03 * bb._fft_noise(rng, n, 20, 90)
    nrm = bb._normal_from_height(h * 0.9, 3.0)
    c_img = save_img("vime_cor", np.clip(col, 0, 1), "sRGB")
    n_img = save_img("vime_normal", nrm * 0.5 + 0.5, "Non-Color")
    return c_img, n_img


def make_gingham_texture(n=128):
    """Papel manteiga xadrez claro: fundo bege e faixas suaves nos dois sentidos."""
    base = np.array(hexc("#E6D6B2"))
    band = np.array(hexc("#C9AF84"))
    t = np.arange(n) / n
    a = (np.sin(2 * np.pi * t * 2) > 0.55).astype(float)
    A = a[:, None]
    B = a[None, :]
    k = np.clip(0.55 * A + 0.55 * B, 0, 0.85)[..., None]
    col = base[None, None, :] * (1 - k) + band[None, None, :] * k
    return save_img("papel_xadrez", np.clip(col, 0, 1), "sRGB")


def build_cesta(root):
    NSG = 120
    objs = []
    # ---------- vime: parede + fundo + aro de corda + alcas
    mb = MB()
    n_tile = 18
    TILE = 0.064

    def wall_ring(h, dd, vtile):
        a, b = wall_ab(h, dd)
        ring, acc, prev = [], 0.0, None
        pts = []
        for k in range(NSG + 1):
            ps = 2 * math.pi * k / NSG
            x, y = oval_pt(a, b, ps)
            if prev is not None:
                acc += math.hypot(x - prev[0], y - prev[1])
            prev = (x, y)
            pts.append((x, y, acc))
        total = acc
        for (x, y, ac) in pts:
            u = ac / total * n_tile
            ring.append(mb.add((x, y, h), (1, 1, 1), uv=(u, vtile)))
        return ring
    prof = [(0.0, -0.0045, 0.0), (0.0016, -0.0018, 0.0016), (0.0050, 0.0, 0.0050)]
    hs = [0.005 + (BHT - 0.005) * i / 8 for i in range(9)]
    prof += [(h, 0.0, h) for h in hs[1:]]
    rings = [wall_ring(h, dd, vt / TILE * 1.0) for (h, dd, vt) in [(p[0], p[1], p[2]) for p in prof]]
    for i in range(len(rings) - 1):
        for k in range(NSG):
            mb.quad(rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k], m=0)
    # fundo
    ctr = mb.add((0, 0, 0.0), (1, 1, 1), uv=(0.5, 0.5))
    for k in range(NSG):
        mb.tri(ctr, rings[0][k + 1], rings[0][k], m=1)
    # aro de corda trancada
    rim_n = 190
    P, R, C = [], [], []
    for i in range(rim_n + 1):
        ps = 2 * math.pi * i / rim_n
        a, b = wall_ab(BHT)
        x, y = oval_pt(a + 0.0006, b + 0.0006, ps)
        P.append(Vector((x, y, BHT - 0.0005)))
        R.append(0.0048)
        ph = i * 0.55
        C.append((lambda al, ph=ph: mulc(hexc("#B07A3C"), 0.80 + 0.28 * math.sin(2 * al + ph))))
    tube(mb, P, R, C, sides=6, cap=False, m=1)
    # alcas nas duas pontas (arcos em pe, em plano inclinado para fora)
    for sgn in (-1, 1):
        a, b = wall_ab(BHT)
        xe = sgn * (a + 0.003)
        Pp, Rp, Cp = [], [], []
        for i in range(25):
            t = i / 24
            ang = math.pi * t
            y = -0.026 * math.cos(ang)
            zup = 0.046 * math.sin(ang)
            x = xe + sgn * (0.016 * math.sin(ang))
            Pp.append(Vector((x, y, BHT + zup * 0.9 - 0.002)))
            Rp.append(0.0050 if 0.04 < t < 0.96 else 0.0052)
            ph = i * 0.9
            Cp.append((lambda al, ph=ph: mulc(hexc("#B88444"), 0.82 + 0.26 * math.sin(2 * al + ph))))
        tube(mb, Pp, Rp, Cp, sides=6, cap=True, m=1)
    wc, wn = make_wicker_textures()
    m_wall = make_mat("mat_cesta_vime", vcol=False, rough=0.7, spec=0.3, image=wc, normal_image=wn, normal_strength=1.0)
    m_rope = make_mat("mat_cesta_corda", vcol=True, rough=0.7, spec=0.3)
    objs.append(finish(mb, "dog_cesta_vime", [m_wall, m_rope], root))

    # ---------- papel manteiga: forra o fundo e a parede e dobra para fora do aro
    pb = MB()
    PT = 0.05
    rng = random.Random(55)
    amp_ph = [rng.uniform(0, 6.28) for _ in range(4)]
    PNS = 100

    def ext(ps):
        return 0.019 + 0.011 * math.sin(2 * ps + amp_ph[0]) + 0.005 * math.sin(5 * ps + amp_ph[1]) + 0.002 * math.sin(11 * ps + amp_ph[2])

    def gflap(ps):
        return smooth(0.008, 0.018, ext(ps))

    def prow(spec):
        """spec = (dd, h, edge_frac): dd = afastamento do oval da parede; devolve anel de vertices."""
        ring, acc, prev = [], 0.0, None
        raw = []
        for k in range(PNS + 1):
            ps = 2 * math.pi * k / PNS
            dd, h, ef = spec(ps)
            a, b = wall_ab(min(h, BHT), dd)
            x, y = oval_pt(a, b, ps)
            raw.append((x, y, h, ps, dd))
        acc = 0.0
        prev = None
        out = []
        for (x, y, h, ps, dd) in raw:
            if prev is not None:
                acc += math.hypot(x - prev[0], y - prev[1])
            prev = (x, y)
            out.append((x, y, h, acc, dd))
        tot = acc
        for (x, y, h, ac, dd) in out:
            shade = 1.0 + 0.04 * nz(x * 90, y * 90, h * 90)
            ring.append(pb.add((x, y, h), (shade, shade * 0.99, shade * 0.97), uv=(ac / PT, (h + 0.8 * dd) / PT)))
        return ring
    rows = []
    # fundo (aneis concentricos, planos com leves amassados)
    for f in (0.0, 0.3, 0.6, 0.9, 1.0):
        def spec(ps, f=f):
            return 0.0, 0.0045, 0.0
        ring = []
        acc = 0.0
        prev = None
        ra, rb = BA0 - 0.012, BB0 - 0.012
        for k in range(PNS + 1):
            ps = 2 * math.pi * k / PNS
            x, y = oval_pt(ra * f, rb * f, ps)
            z = 0.0045 + 0.0007 * nz(x * 60, y * 60, 3.0) * f
            ring.append(pb.add((x, y, z), (1, 1, 1), uv=(x / PT, y / PT)))
        rows.append(ring)
    # parede interna: de baixo (h=0.005) ate o aro
    for hf in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0):
        def spec(ps, hf=hf):
            h = 0.0048 + (BHT - 0.0048 + 0.0010) * hf
            return -0.0055 + 0.0004 * math.sin(7 * ps + hf * 5), h, 0.0
        rows.append(prow(spec))
    # sobre o aro
    for (dd, dh) in ((-0.0042, 0.0016), (-0.0018, 0.0050), (0.0012, 0.0064), (0.0046, 0.0052), (0.0074, 0.0024)):
        def spec(ps, dd=dd, dh=dh):
            g = gflap(ps)
            return lerp(-0.0055, dd, g), BHT + lerp(-0.0030, dh, g), 0.0
        rows.append(prow(spec))
    # aba para fora (borda irregular e ondulada)
    for fr in (0.25, 0.5, 0.75, 1.0):
        def spec(ps, fr=fr):
            e = ext(ps)
            g = gflap(ps)
            dd = 0.0074 + e * fr + 0.0018 * fr * math.sin(9 * ps + amp_ph[3])
            h = BHT + 0.0030 - e * fr * 0.22 - 0.0030 * fr * math.sin(7 * ps + amp_ph[1] * 2)
            return lerp(-0.0055, dd, g), lerp(BHT - 0.0030, h, g), fr
        # as linhas da aba ficam fora da parede (wall_ab limita h): calcula direto
        ring = []
        acc = 0.0
        prev = None
        for k in range(PNS + 1):
            ps = 2 * math.pi * k / PNS
            dd, h, _ = spec(ps)
            a, b = wall_ab(BHT, dd)
            x, y = oval_pt(a, b, ps)
            if prev is not None:
                acc += math.hypot(x - prev[0], y - prev[1])
            prev = (x, y)
            shade = 1.0 + 0.05 * nz(x * 90, y * 90, h * 90)
            ring.append(pb.add((x, y, h), (shade, shade * 0.99, shade * 0.97), uv=(acc / PT, (h + 0.8 * dd) / PT)))
        rows.append(ring)
    # costura entre as linhas (o fundo e o resto nao tem o mesmo numero de pontos por anel? tem: PNS+1)
    for i in range(len(rows) - 1):
        for k in range(PNS):
            pb.quad(rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k])
    gm = make_gingham_texture()
    m_paper = make_mat("mat_cesta_papel", vcol=True, rough=0.78, spec=0.25, image=gm)
    objs.append(finish(pb, "dog_cesta_papel", [m_paper], root))
    return objs


# ----------------------------------------------------------------------------
# construcao + exportacao
# ----------------------------------------------------------------------------
BUILDERS = {
    "pulled-pernil": build_pulled, "brocolis-floretes": build_brocolis, "dog-cesta": build_cesta,
    "dog-brioche": build_brioche, "dog-pasta": build_dpasta, "dog-salsichas": build_salsichas,
    "dog-molhos": build_molhos, "dog-fondue": build_dfondue, "dog-mussarela": build_dmussarela, "dog-palha": build_palha,
}


def build_and_export():
    stats = {}
    for name in SEL:
        root = root_empty(name.replace("-", "_"))
        objs = BUILDERS[name](root)
        tris = sum(tri_count(o) for o in objs)
        path = bb.export_part(name, objs, root)
        stats[name] = (os.path.getsize(path), tris)
        print("EXPORT %-18s %8d bytes %7d tris" % (name, stats[name][0], tris))
    return stats



# ----------------------------------------------------------------------------
# renders de revisao (a partir dos GLBs exportados = o que o site recebe)
# ----------------------------------------------------------------------------
def load_scene(names, W, H, smp):
    bb.clear_scene()
    bb.setup_scene(W, H, smp)
    parts = {}
    for name in names:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + ".glb"))
        new = [o for o in bpy.data.objects if o not in before]
        d = dict(objs=new, roots=[o for o in new if o.parent is None], lids={})
        for o in new:
            if o.name.endswith("_tampa") or "_tampa." in o.name:
                d["lids"][o.name] = (o, o.location.copy())
        parts[name] = d
    return parts


def rview(parts, show, path, res, smp, az=24, el=28, lens=65, offsets=None, lids=None, lid_dz=None, margin=1.08,
          floor_z=None, shift=(0, 0, 0), key_gain=1.0, hide=(), fit=None, box=None):
    sc = bpy.context.scene
    lids = lids or {}
    lid_dz = lid_dz or {}
    for n, d in parts.items():
        for r in d["roots"]:
            r.location = (0, 0, 0)
        for ln, (lo, home) in d["lids"].items():
            st = lids.get(n, "open")
            ang = 0.0 if st == "closed" else (OPEN_RAD if st == "open" else -math.radians(st))
            lo.rotation_mode = "XYZ"
            lo.rotation_euler = (ang, 0.0, 0.0)
            lo.location = (home.x, home.y, home.z + lid_dz.get(n, 0.0))
    if offsets:
        for n, dz in offsets.items():
            for r in parts[n]["roots"]:
                r.location = (0, 0, dz)
    bb.set_visible(parts, show, False, hide)
    bpy.context.view_layer.update()
    objs = [o for n in show for r in parts[n]["roots"] for o in bb.descend(r)]
    mn, mx = bb.world_bbox(objs)
    fmn, fmx = mn, mx
    if fit:
        fmn, fmx = bb.world_bbox([o for n in fit for r in parts[n]["roots"] for o in bb.descend(r)])
    if box:
        fmn, fmx = Vector(box[0]), Vector(box[1])
    for o in list(bpy.data.objects):
        if o.name.startswith(("CAM", "LT_", "FLOOR")):
            bpy.data.objects.remove(o, do_unlink=True)
    cd = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    ctr, dist = bb.frame_camera(cam, fmn, fmx, math.radians(az), math.radians(el), lens, margin, shift)
    R = max((fmx - fmn).length / 2, 0.05) if (fit or box) else max((mx - mn).length / 2, 0.05)
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
    k = (R * 3.0) ** 2 * 26 * key_gain
    right = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), 0))
    fwd = Vector((math.sin(math.radians(az)), -math.cos(math.radians(az)), 0))
    bb.add_light("AREA", ctr + (fwd * 1.3 - right * 1.6 + Vector((0, 0, 2.2))) * R, ctr, (1.0, 0.88, 0.72), k, R * 1.6, "LT_key")
    bb.add_light("AREA", ctr + (-fwd * 1.8 + right * 1.9 + Vector((0, 0, 1.0))) * R, ctr, (1.0, 0.68, 0.42), k * 0.6, R * 1.2, "LT_rim")
    bb.add_light("AREA", ctr + (fwd * 2.4 + right * 1.6 + Vector((0, 0, 0.7))) * R, ctr, (1.0, 0.8, 0.6), k * 0.25, R * 2.5, "LT_fill")
    sc.render.filepath = path
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = smp
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


def render_all():
    quick = ARGS.quick
    W, H = (600, 400) if quick else (1200, 800)
    smp = 16 if quick else 96
    out = ARGS.renders
    os.makedirs(out, exist_ok=True)
    allv = ARGS.views == "all"
    want = set(ARGS.views.split(",")) if not allv else set()

    def ok(k):
        return allv or (k in want)
    names = ["tabua", "pao", "pasta", "creme", "mussarela", "gratinado"] + PARTS_L
    parts = load_scene(names, W, H, smp)
    res = (W, H)

    def P(f):
        return os.path.join(out, f + ".png")
    SH = dict(margin=1.42, shift=(0.012, 0.0, -0.004), fit=["pao", "mussarela", "gratinado"])
    for idx, (tag, fill) in enumerate((("pulled", "pulled-pernil"), ("brocolis", "brocolis-floretes"))):
        b = 1 + idx * 3
        base = ["tabua", "pao", "pasta", fill, "creme"]
        if ok("%02d" % b):
            rview(parts, base, P("%02d-%s-aberto" % (b, tag)), res, smp, az=22, el=30, lens=62, margin=1.08, lids={"pao": "open"})
        if ok("%02d" % (b + 1)):
            rview(parts, base + ["mussarela", "gratinado"], P("%02d-%s-montado" % (b + 1, tag)), res, smp, az=24, el=35, lens=62,
                  lids={"pao": "closed"}, **SH)
        if ok("%02d" % (b + 2)):
            o = {"pasta": 0.04, fill: 0.08, "creme": 0.12, "mussarela": 0.235, "gratinado": 0.29}
            rview(parts, base + ["mussarela", "gratinado"], P("%02d-%s-explodido" % (b + 2, tag)), res, smp, az=18, el=14, lens=62,
                  offsets=o, floor_z=-0.028, margin=1.1, lids={"pao": "closed"}, lid_dz={"pao": 0.17})
    dogs = ["tabua", "dog-cesta", "dog-brioche", "dog-pasta", "dog-salsichas", "dog-molhos", "dog-fondue", "dog-mussarela", "dog-palha"]
    if ok("07"):
        rview(parts, dogs[:6], P("07-dogalho-aberto"), res, smp, az=22, el=32, lens=62, margin=1.1, fit=["dog-cesta"],
              lids={"dog-brioche": "open"})
    if ok("08"):
        rview(parts, dogs, P("08-dogalho-montado"), res, smp, az=24, el=35, lens=62, margin=1.1, fit=["dog-cesta"],
              lids={"dog-brioche": "closed"})
    if ok("09"):
        o = {"dog-pasta": 0.035, "dog-salsichas": 0.07, "dog-molhos": 0.105, "dog-fondue": 0.20, "dog-mussarela": 0.245, "dog-palha": 0.29}
        rview(parts, dogs, P("09-dogalho-explodido"), res, smp, az=18, el=14, lens=62, offsets=o, floor_z=-0.028, margin=1.1,
              lids={"dog-brioche": "closed"}, lid_dz={"dog-brioche": 0.15})
    # detalhes (iteracao e conferencia)
    if ok("10"):
        rview(parts, ["pao", "pasta", "pulled-pernil"], P("10-pulled-detalhe"), res, smp, az=16, el=24, lens=90, margin=1.0,
              hide=("pao_tampa",))
    if ok("11"):
        rview(parts, ["pao", "pasta", "brocolis-floretes"], P("11-brocolis-detalhe"), res, smp, az=16, el=24, lens=90, margin=1.0,
              hide=("pao_tampa",))
    if ok("12"):
        rview(parts, ["dog-cesta", "dog-brioche", "dog-pasta", "dog-salsichas", "dog-molhos"], P("12-dogalho-detalhe"), res, smp,
              az=16, el=26, lens=85, margin=1.0, lids={"dog-brioche": "open"}, hide=("dog_brioche_tampa",))
    if ok("13"):
        rview(parts, dogs, P("13-dogalho-topo"), res, smp, az=14, el=34, lens=85, margin=1.0, lids={"dog-brioche": "closed"},
              box=((-0.12, -0.06, 0.0), (0.12, 0.06, 0.08)))
    if ok("14"):
        rview(parts, ["dog-cesta"], P("14-dog-cesta"), res, smp, az=24, el=30, lens=70, margin=1.1)
    if ok("15"):
        rview(parts, ["pao", "pasta", "brocolis-floretes", "creme"], P("15-brocolis-tampa-fechada"), res, smp, az=14, el=14, lens=90,
              lids={"pao": 17.0}, box=((-0.085, -0.060, 0.020), (0.085, 0.0, 0.075)), margin=1.02)
    if ok("16"):
        rview(parts, ["dog-cesta", "dog-brioche", "dog-pasta", "dog-salsichas", "dog-molhos"], P("16-dog-tampa-entreaberta"), res, smp,
              az=14, el=14, lens=90, lids={"dog-brioche": 20.0}, box=((-0.12, -0.06, 0.0), (0.12, 0.0, 0.085)), margin=1.02)


# ----------------------------------------------------------------------------
# icones da bandeja: render com fundo transparente (3/4 de cima, luz quente), WebP 512 x 512 com alfa
# ----------------------------------------------------------------------------
ICON_IDS = ["pulled-pernil", "brocolis-floretes", "dog-brioche", "dog-pasta", "dog-salsichas", "dog-molhos", "dog-fondue",
            "dog-mussarela", "dog-palha"]


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    return new, [o for o in new if o.parent is None]


def tex_vc_mat(name, image, normal_image, strength=1.0, rough=0.5, spec=0.5, coat=0.0):
    """Material de icone (cena montada em memoria): textura x cor de vertice, como o three.js faz com COLOR_0."""
    m = make_mat(name, vcol=False, rough=rough, spec=spec, coat=coat, image=image, normal_image=normal_image, normal_strength=strength)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image == image][0]
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    nt.links.new(tex.outputs["Color"], mix.inputs[6])
    nt.links.new(vc.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], b.inputs["Base Color"])
    return m


def put(mb, name, mats, vc_white=False):
    return finish(mb, name, mats, None, vc_white=vc_white)


def xf(mb, i0, fn):
    bb.xform(mb, i0, fn)


def rot_z(a, c=(0, 0)):
    ca, sa = math.cos(a), math.sin(a)
    return lambda p: Vector((c[0] + (p.x - c[0]) * ca - (p.y - c[1]) * sa, c[1] + (p.x - c[0]) * sa + (p.y - c[1]) * ca, p.z))


def rot_y(a, c=(0, 0)):
    ca, sa = math.cos(a), math.sin(a)
    return lambda p: Vector((c[0] + (p.x - c[0]) * ca + (p.z - c[1]) * sa, p.y, c[1] - (p.x - c[0]) * sa + (p.z - c[1]) * ca))


def rot_x(a, c=(0, 0)):
    ca, sa = math.cos(a), math.sin(a)
    return lambda p: Vector((p.x, c[0] + (p.y - c[0]) * ca - (p.z - c[1]) * sa, c[1] + (p.y - c[0]) * sa + (p.z - c[1]) * ca))


def shift(dx, dy, dz):
    return lambda p: Vector((p.x + dx, p.y + dy, p.z + dz))


def revolve_oval(mb, prof, A, B, color, n=2.4, nsg=56, m=0):
    """Revolve um perfil [(f, da, z)] em torno de um oval (superelipse): semi-eixos A*f+da, B*f+da."""
    rings = []
    for (f, da, z) in prof:
        ring = []
        for k in range(nsg):
            ps = 2 * math.pi * k / nsg
            c, s = math.cos(ps), math.sin(ps)
            a, b = max(A * f + da, 0.0), max(B * f + da, 0.0)
            ring.append(mb.add((a * math.copysign(abs(c) ** (2 / n), c), b * math.copysign(abs(s) ** (2 / n), s), z), color))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(nsg):
            k2 = (k + 1) % nsg
            mb.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], m=m)


def lathe_closed(mb, prof, color, seg=36, m=0, origin=(0, 0, 0)):
    """Revolucao em torno de z de um perfil [(r, z)] (normais para a direita do sentido do perfil)."""
    lathe(mb, [(r, z) for (r, z) in prof], origin, "z", 1, seg, color, m=m)


def icon_pulled():
    mb = MB()
    cream = hexc("#F1E8D8")
    A, B = 0.125, 0.088
    revolve_oval(mb, [(0.0, 0.0, 0.0), (0.88, 0.0, 0.0), (1.0, -0.004, 0.0035), (1.0, 0.0, 0.0110), (1.0, 0.0025, 0.0150),
                      (1.0, 0.0003, 0.0160), (1.0, -0.0042, 0.0120), (0.86, 0.0, 0.0065), (0.0, 0.0, 0.0065)], A, B, cream)
    put(mb, "icone_travessa", [make_mat("mat_icone_travessa", rough=0.28, spec=0.7, coat=0.3)])
    # montinho de pernil desfiado
    rx, ry, hm, z0 = 0.095, 0.064, 0.050, 0.0075

    def surf(x, y):
        r2 = (x / rx) ** 2 + (y / ry) ** 2
        return z0 + hm * max(0.0, 1 - r2) ** 0.75

    def clampxy(x, y):
        r = math.hypot(x / rx, y / ry)
        if r > 1.02:
            x, y = x / r * 1.02, y / r * 1.02
        return x, y
    rng = random.Random(2468)
    cm = MB()
    rings = []
    nrg, nsg = 10, 40
    for j in range(nrg + 1):
        f = j / nrg
        ring = []
        for k in range(nsg):
            ps = 2 * math.pi * k / nsg
            x, y = f * rx * 0.98 * math.cos(ps), f * ry * 0.98 * math.sin(ps)
            ring.append(cm.add((x, y, surf(x, y) - 0.003 + 0.0010 * nz(x * 90, y * 90, 2.0)), lerpc(C_PCORE_LO, C_PCORE_HI, 0.5 + 0.5 * nz(x * 60, y * 60, 3.0))))
        rings.append(ring)
    for j in range(nrg):
        for k in range(nsg):
            k2 = (k + 1) % nsg
            cm.quad(rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k])
    fib_c, fib_n = bb.make_fibre_textures()
    mat = tex_vc_mat("mat_icone_pulled", fib_c, fib_n, 1.0, 0.52, 0.40)
    put(cm, "icone_pulled_miolo", [mat])
    centers = []
    for _ in range(150):
        a = rng.uniform(0, 6.28)
        r = math.sqrt(rng.uniform(0, 1.0)) * 0.97
        centers.append((r * rx * math.cos(a), r * ry * math.sin(a), False))
    sm = MB()
    pulled_strips(sm, rng, centers, surf, clampxy, nseg=4, sides=4, len_rng=(0.034, 0.056), wmean_rng=(0.0040, 0.0058), nstr=(3, 5),
                  layers=(0.0, 0.0012, 0.0024, 0.0040, 0.0056), bend_sd=14.0)
    put(sm, "icone_pulled_fiapos", [mat])


def icon_brocolis():
    mb = MB()
    rng = random.Random(1357)
    seeds = []
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.3
        end = Vector((0.040 * math.cos(a), 0.040 * math.sin(a), 0.003))
        el = math.radians(rng.uniform(25, 40))
        dv = Vector((math.cos(el) * math.cos(a), math.cos(el) * math.sin(a), -math.sin(el)))
        floret(mb, random.Random(rng.random()), end, dv, rng.uniform(0.0135, 0.0160), rng.uniform(0, 99))
    floret(mb, random.Random(5), Vector((0.0, 0.0, 0.003)), Vector((0.1, 0.05, -1.0)), 0.0165, 33.0)
    floret(mb, random.Random(6), Vector((0.006, -0.030, 0.003)), Vector((0.3, 0.1, -0.6)), 0.0125, 44.0)
    gc, gn = make_grain_textures()
    m_head = tex_vc_mat("mat_brocolis_cabeca", gc, gn, 1.2, 0.6, 0.35)
    m_stem = make_mat("mat_brocolis_talo", vcol=True, rough=0.8, spec=0.2)
    put(mb, "icone_brocolis", [m_head, m_stem])


def icon_brioche():
    new, roots = import_glb("dog-brioche")
    for o in new:
        if o.name.endswith("_tampa"):
            o.rotation_mode = "XYZ"
            o.rotation_euler = (-math.radians(48), 0, 0)
    for r in roots:
        r.rotation_mode = "XYZ"
        r.rotation_euler = (0, 0, math.radians(-14))


def icon_dpasta():
    cer = hexc("#EFE6D4")
    mb = MB()
    # pote de ceramica com borda e pasta de alho cremosa por cima
    prof = [(0.0, 0.0), (0.024, 0.0), (0.0285, 0.003), (0.0335, 0.030), (0.0360, 0.0425), (0.0375, 0.0470), (0.0345, 0.0500),
            (0.0310, 0.0470), (0.0300, 0.0420), (0.0290, 0.0400)]
    lathe_closed(mb, prof, cer, 40)
    put(mb, "icone_pote", [make_mat("mat_icone_pote", rough=0.3, spec=0.7, coat=0.3)])
    pm = MB()
    nrg, nsg = 8, 36
    rings = []
    for j in range(nrg + 1):
        f = j / nrg
        ring = []
        for k in range(nsg):
            ps = 2 * math.pi * k / nsg
            r = 0.0292 * f
            sw = 0.0030 * math.sin(3 * ps + 6 * f) * f * (1 - f * 0.3)
            ring.append(pm.add((r * math.cos(ps), r * math.sin(ps), 0.0400 + 0.0105 * (1 - f * f) ** 0.8 + sw),
                               lerpc(C_PASTA, C_PASTA2, 0.5 + 0.5 * nz(r * 90 * math.cos(ps), r * 90 * math.sin(ps), 5.0))))
        rings.append(ring)
    for j in range(nrg):
        for k in range(nsg):
            k2 = (k + 1) % nsg
            pm.quad(rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k])
    rng = random.Random(8)
    for _ in range(26):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0, 0.025)
        cx, cy = r * math.cos(a), r * math.sin(a)
        cz = 0.0400 + 0.0105 * (1 - (r / 0.0292) ** 2) ** 0.8 + 0.0004
        rr = rng.uniform(0.0011, 0.0022)
        col = rng.choice([hexc("#3F7F25"), hexc("#5A9A2E"), hexc("#7DB43C")])
        ctr = pm.add((cx, cy, cz + rr * 0.5), mulc(col, 1.1))
        ph = rng.uniform(0, 6.28)
        ring = [pm.add((cx + rr * math.cos(ph + 2 * math.pi * k / 6), cy + rr * 0.85 * math.sin(ph + 2 * math.pi * k / 6), cz), mulc(col, 0.9)) for k in range(6)]
        for k in range(6):
            pm.tri(ctr, ring[k], ring[(k + 1) % 6])
    put(pm, "icone_pasta", [make_mat("mat_icone_pasta", rough=0.38, spec=0.6)])
    # dentes de alho ao lado
    gm = MB()
    for (x, y, yaw, ln) in ((0.052, -0.020, 0.7, 1.0), (0.058, 0.010, -0.5, 0.9), (0.040, -0.046, 1.9, 0.85)):
        i0 = len(gm.v)
        gp = [(0.0, -0.014), (0.0075, -0.0115), (0.0108, -0.004), (0.0098, 0.0045), (0.0058, 0.0115), (0.0018, 0.0165), (0.0, 0.0185)]
        lathe(gm, [(r * ln, a * ln) for (r, a) in gp], (0, 0, 0), "x", 1, 14, hexc("#F3ECDD"))
        xf(gm, i0, lambda p, x=x, y=y, yaw=yaw: rot_z(yaw)(p) + Vector((x, y, 0.0105)))
    put(gm, "icone_alho", [make_mat("mat_icone_alho", rough=0.35, spec=0.5)])


def icon_salsichas():
    new, roots = import_glb("dog-salsichas")
    for r in roots:
        r.rotation_mode = "XYZ"
        r.rotation_euler = (0, 0, math.radians(-38))


def icon_molhos():
    def bottle(x, y, body, tilt, yaw):
        mb = MB()
        i0 = len(mb.v)
        prof_b = [(0.0, 0.0), (0.0148, 0.0), (0.0166, 0.0045), (0.0170, 0.052), (0.0150, 0.0665), (0.0095, 0.0755), (0.0078, 0.0800)]
        lathe_closed(mb, prof_b, body, 32)
        cap = hexc("#F1EEE4")
        prof_c = [(0.0080, 0.0800), (0.0088, 0.0850), (0.0072, 0.0920), (0.0036, 0.1040), (0.0012, 0.1095), (0.0, 0.1105)]
        lathe_closed(mb, prof_c, cap, 24)
        xf(mb, i0, lambda p: shift(x, y, 0.0)(rot_z(yaw)(rot_x(tilt)(p))))
        return mb
    m1 = bottle(-0.022, 0.004, hexc("#C3261A"), math.radians(-5), 0.3)
    put(m1, "icone_ketchup", [make_mat("mat_icone_ketchup", rough=0.3, spec=0.7, coat=0.3)])
    m2 = bottle(0.024, -0.004, hexc("#E7B31B"), math.radians(6), -0.2)
    put(m2, "icone_mostarda", [make_mat("mat_icone_mostarda", rough=0.3, spec=0.7, coat=0.3)])
    # pingos dos bicos
    d = MB()
    for (x, y, col, tilt) in ((-0.022, 0.004, hexc("#C3261A"), -5), (0.024, -0.004, hexc("#E7B31B"), 6)):
        i0 = len(d.v)
        lathe(d, [(0.0, 0.0), (0.0026, 0.0012), (0.0032, 0.0040), (0.0022, 0.0075), (0.0008, 0.0100), (0.0, 0.0110)], (0, 0, 0), "z", 1, 12, col)
        xf(d, i0, shift(x, y, 0.1105))
    put(d, "icone_gotas", [make_mat("mat_icone_gotas", rough=0.18, spec=0.9)])


def icon_fondue():
    red = hexc("#A8352A")
    mb = MB()
    prof = [(0.0, 0.0), (0.030, 0.0), (0.0372, 0.004), (0.0420, 0.020), (0.0405, 0.036), (0.0400, 0.0455), (0.0425, 0.0485), (0.0415, 0.0510),
            (0.0385, 0.0505), (0.0378, 0.0470), (0.0385, 0.0400)]
    lathe_closed(mb, prof, red, 44)
    # alca de metal escura
    hp = [Vector((0.040 + 0.045 * t - 0.0 * t, 0.0, 0.040 + 0.006 * math.sin(math.pi * t))) for t in [i / 8 for i in range(9)]]
    tube(mb, hp, [0.0052] * 9, [hexc("#3A2A26")] * 9, sides=8, cap=True)
    put(mb, "icone_caquelon", [make_mat("mat_icone_caquelon", rough=0.32, spec=0.6, coat=0.4)])
    fm = MB()
    nrg, nsg = 8, 40
    rings = []
    for j in range(nrg + 1):
        f = j / nrg
        ring = []
        for k in range(nsg):
            ps = 2 * math.pi * k / nsg
            r = 0.0395 * f
            rip = 0.0012 * math.sin(4 * ps + 5 * f) * f
            ring.append(fm.add((r * math.cos(ps), r * math.sin(ps), 0.0405 + 0.0035 * (1 - f * f) + rip),
                               lerpc(C_FD_CREAM, C_FD_PALE, 0.4 + 0.6 * (1 - f))))
        rings.append(ring)
    for j in range(nrg):
        for k in range(nsg):
            k2 = (k + 1) % nsg
            fm.quad(rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k])
    # queijo escorrendo pela borda (tres fios + gotas)
    for (ang, ln) in ((-1.2, 0.030), (-0.3, 0.022), (0.6, 0.034)):
        P, R, C = [], [], []
        for i in range(10):
            t = i / 9
            rr = 0.0425 + 0.0012 * math.sin(math.pi * t)
            z = 0.0495 - ln * t
            P.append(Vector((rr * math.cos(ang), rr * math.sin(ang), z)))
            R.append(0.0035 * (0.9 + 0.5 * bb.smooth(0.7, 0.95, t)) * (1 - 0.8 * bb.smooth(0.95, 1.0, t)))
            C.append(lerpc(C_FD_CREAM, C_FD_PALE, 0.4))
        tube(fm, P, R, C, sides=7, cap=True)
    put(fm, "icone_fondue", [make_mat("mat_icone_fondue", rough=0.16, spec=1.0, coat=0.4)])


def icon_mussarela():
    mb = MB()
    pale, gold = hexc("#F2DA88"), hexc("#E8B445")
    i0 = len(mb.v)
    superq(mb, (0.0, 0.0, 0.0210), (0.036, 0.026, 0.0210), 0.14, 0.14, 24, 14, pale)
    xf(mb, i0, rot_z(math.radians(-18)))
    for (dx, dy, tilt, yaw, col) in ((-0.050, -0.040, 0.0, 0.25, pale), (0.016, -0.050, -0.55, -0.35, gold), (-0.026, 0.055, 0.0, -0.15, pale)):
        i1 = len(mb.v)
        superq(mb, (0.0, 0.0, 0.0), (0.030, 0.022, 0.0022), 0.15, 0.15, 20, 8, col)
        xf(mb, i1, lambda p, tilt=tilt, yaw=yaw, dx=dx, dy=dy: shift(dx, dy, 0.0030)(rot_z(yaw)(rot_y(tilt)(p))))
    put(mb, "icone_mussarela", [make_mat("mat_icone_mussarela", rough=0.22, spec=1.0, coat=0.35)])


def icon_palha():
    mb = MB()
    kr = hexc("#B8905A")
    revolve_oval(mb, [(0.0, 0.0, 0.0), (0.9, 0.0, 0.0), (1.0, -0.0, 0.0025), (1.0, 0.0, 0.0050), (0.96, 0.0, 0.0050), (0.0, 0.0, 0.0030)],
                 0.085, 0.085, kr, n=2.0, nsg=48)
    put(mb, "icone_papel", [make_mat("mat_icone_papel", rough=0.8, spec=0.2)])
    sm = MB()
    rng = random.Random(1616)
    cols = [hexc(h) for h in ("#D9A546", "#E4B558", "#EBC46C", "#F2D17F", "#DDAE4E")]
    Rr, Hh = 0.070, 0.048

    def hz(x, y):
        r = min(1.0, math.hypot(x, y) / Rr)
        return 0.0050 + Hh * (1 - r * r) ** 0.85
    for _ in range(640):
        a = rng.uniform(0, 6.28)
        r = math.sqrt(rng.uniform(0, 1)) * Rr * 0.92
        x, y = r * math.cos(a), r * math.sin(a)
        ln = rng.uniform(0.040, 0.070)
        th = rng.uniform(0, 3.14)
        d = (math.cos(th), math.sin(th))
        curl = rng.gauss(0, 1) * 0.008
        lift = rng.choice([0.0, 0.002, 0.004, 0.007])
        P = []
        for k in range(6):
            t = k / 5
            s = (t - 0.5) * ln
            xx = x + d[0] * s - d[1] * curl * math.sin(math.pi * t)
            yy = y + d[1] * s + d[0] * curl * math.sin(math.pi * t)
            rr_ = math.hypot(xx, yy)
            if rr_ > Rr * 1.05:
                xx, yy = xx / rr_ * Rr * 1.05, yy / rr_ * Rr * 1.05
            P.append(Vector((xx, yy, hz(xx, yy) + 0.0012 + lift + 0.003 * math.sin(math.pi * t))))
        rad = rng.uniform(0.00085, 0.00115)
        c = mulc(rng.choice(cols), rng.uniform(0.92, 1.06))
        tube(sm, P, [rad * 0.8] + [rad] * 4 + [rad * 0.8], [c] * 6, sides=3, cap=False, twist=rng.uniform(0, 3))
    put(sm, "icone_palha", [make_mat("mat_icone_palha", rough=0.55, spec=0.45)])


ICON_BUILD = {"pulled-pernil": icon_pulled, "brocolis-floretes": icon_brocolis, "dog-brioche": icon_brioche, "dog-pasta": icon_dpasta,
              "dog-salsichas": icon_salsichas, "dog-molhos": icon_molhos, "dog-fondue": icon_fondue, "dog-mussarela": icon_mussarela,
              "dog-palha": icon_palha}


def alpha_box(path, thr=0.06):
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[..., 3]
    bpy.data.images.remove(img)
    ys, xs = np.where(a > thr)
    return xs.min(), xs.max(), ys.min(), ys.max(), w, h


def render_icon(iid, az=24, el=34, lens=70):
    smp = 24 if ARGS.quick else 80
    bb.clear_scene()
    sc = bb.setup_scene(512, 512, smp)
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = "RGBA"
    bgn = sc.world.node_tree.nodes["Background"]
    bgn.inputs["Color"].default_value = (0.34, 0.26, 0.19, 1.0)
    bgn.inputs["Strength"].default_value = 1.0
    before = set(bpy.data.objects)
    ICON_BUILD[iid]()
    objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    mn, mx = bb.world_bbox(objs)
    cd = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    R = max((mx - mn).length / 2, 0.05)
    k = (R * 3.0) ** 2 * 26 * 1.15
    ctr0 = (mn + mx) / 2
    right = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), 0))
    fwd = Vector((math.sin(math.radians(az)), -math.cos(math.radians(az)), 0))
    bb.add_light("AREA", ctr0 + (fwd * 1.3 - right * 1.6 + Vector((0, 0, 2.2))) * R, ctr0, (1.0, 0.88, 0.72), k, R * 1.6, "LT_key")
    bb.add_light("AREA", ctr0 + (-fwd * 1.8 + right * 1.9 + Vector((0, 0, 1.0))) * R, ctr0, (1.0, 0.68, 0.42), k * 0.6, R * 1.2, "LT_rim")
    bb.add_light("AREA", ctr0 + (fwd * 2.4 + right * 1.6 + Vector((0, 0, 0.7))) * R, ctr0, (1.0, 0.8, 0.6), k * 0.45, R * 2.5, "LT_fill")
    tmp = os.path.join(ICON_DIR, "_tmp_icone.png")
    os.makedirs(ICON_DIR, exist_ok=True)
    margin, sx, sy = 1.12, 0.0, 0.0
    for it in range(3):
        bb.frame_camera(cam, mn, mx, math.radians(az), math.radians(el), lens, margin)
        cam.data.shift_x, cam.data.shift_y = sx, sy
        sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        x0, x1, y0, y1, w, h = alpha_box(tmp)
        fill = max(x1 - x0 + 1, y1 - y0 + 1) / float(w)
        cx = ((x0 + x1) / 2.0) / w - 0.5
        cy = ((y0 + y1) / 2.0) / h - 0.5
        print("ICON %s it%d fill=%.2f off=(%.3f,%.3f)" % (iid, it, fill, cx, cy))
        if it == 2:
            break
        new_margin = margin * fill / 0.80
        sx += cx * margin / new_margin
        sy += cy * margin / new_margin
        margin = new_margin
    img = bpy.data.images.load(tmp)
    path = os.path.join(ICON_DIR, iid + ".webp")
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    for q in (92, 86, 80, 74, 68, 62, 56, 50, 44, 38, 32):
        sc.render.image_settings.quality = q
        img.save_render(path, scene=sc)
        sz = os.path.getsize(path)
        if sz <= 60 * 1024:
            break
    print("ICONE %s q=%d %d bytes" % (iid, q, sz))
    bpy.data.images.remove(img)
    os.remove(tmp)
    return path


def contact_sheet(paths):
    """00-icones.png: todos os icones lado a lado sobre #1a1210 (3 x 3 de 400 px = 1200 px)."""
    T, cols = 400, 3
    rows = (len(paths) + cols - 1) // cols
    W, H = T * cols, T * rows
    bg = np.array(list(bb.BG) + [1.0], dtype=np.float32)
    canvas = np.tile(bg, (H, W, 1))
    for i, p in enumerate(paths):
        img = bpy.data.images.load(p)
        img.alpha_mode = "STRAIGHT"
        img.scale(T, T)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(T, T, 4)
        bpy.data.images.remove(img)
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * T
        x0 = c * T
        a = px[..., 3:4]
        canvas[y0:y0 + T, x0:x0 + T, :3] = canvas[y0:y0 + T, x0:x0 + T, :3] * (1 - a) + px[..., :3] * a
    out = bpy.data.images.new("folha_icones", W, H, alpha=False)
    out.pixels.foreach_set(canvas.ravel())
    out.file_format = "PNG"
    dest = os.path.join(ARGS.renders, "00-icones.png")
    os.makedirs(ARGS.renders, exist_ok=True)
    out.filepath_raw = dest
    out.save()
    print("FOLHA", dest)


def make_icons():
    if ARGS.icons == "none":
        return
    ids = ICON_IDS if ARGS.icons == "all" else ARGS.icons.split(",")
    for iid in ids:
        render_icon(iid)
    if ARGS.icons == "all":
        contact_sheet([os.path.join(ICON_DIR, i + ".webp") for i in ICON_IDS])



def main():
    stats = build_and_export()
    if ARGS.views != "none":
        render_all()
    make_icons()
    if stats:
        print("-- resumo --")
        for k, (sz, tr) in stats.items():
            flag = "" if (sz <= 307200 and tr <= 20000) else "  <<< ESTOUROU O ORCAMENTO"
            print("%-18s %8d B (%.1f KB) %7d tris%s" % (k, sz, sz / 1024, tr, flag))


main()
