"""
LAR-431 (acompanhamentos) - bebidas e porcoes da mesa da bancada 3D (Alhoaria).

Gera por script, do zero (nada e baixado), 5 GLBs de itens de mesa + 5 icones de bandeja + renders de revisao:
    beb-lata, beb-chopp, beb-soda, porcao-dadinho, porcao-batata

    blender.exe -b --factory-startup -P build_acomp.py -- [opcoes]

Opcoes:
    --renders DIR   pasta dos PNGs de revisao (fora do repo)
    --parts a,b     so constroi/exporta essas pecas (padrao: todas; "none" so renderiza a partir dos GLBs)
    --views a,b     so gera essas vistas: 01..05 (itens), 06 (mesa), icons (padrao: todas; "none" nao gera)
    --quick         renders menores / poucas amostras (iteracao)

Reaproveita funcoes de build_bancada.py (importado como modulo, sem rodar nada dele). Contrato: README.md.
Blender: eixo Z para cima; o exportador converte para Y para cima (glTF).
"""
import bpy
import math
import os
import sys
import argparse
import importlib.util
import numpy as np
from mathutils import Vector, Euler

_HERE = os.path.dirname(os.path.abspath(__file__))
_saved_argv = sys.argv
_mine = _saved_argv[_saved_argv.index("--") + 1:] if "--" in _saved_argv else []
# build_bancada.py le sys.argv e roda main() ao ser importado: com --parts none --views none nao faz nada.
sys.argv = [_saved_argv[0], "--", "--parts", "none", "--views", "none"]
_spec = importlib.util.spec_from_file_location("build_bancada", os.path.join(_HERE, "build_bancada.py"))
bb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bb)
sys.argv = _saved_argv

ap = argparse.ArgumentParser()
ap.add_argument("--renders", default=r"\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-431-acomp\renders")
ap.add_argument("--parts", default="all")
ap.add_argument("--views", default="all")
ap.add_argument("--quick", action="store_true")
ARGS = ap.parse_args(_mine)

MB, hexc, s2l, lerp, lerpc, clamp, smooth, fbm = bb.MB, bb.hexc, bb.s2l, bb.lerp, bb.lerpc, bb.clamp, bb.smooth, bb.fbm
finish, root_empty, tri_count = bb.finish, bb.root_empty, bb.tri_count
MODELS = bb.MODELS
ICONS = os.path.join(bb.REPO, "public", "assets", "bancada", "icones")
PARTS = ["beb-lata", "beb-chopp", "beb-soda", "porcao-dadinho", "porcao-batata"]
SEL = PARTS if ARGS.parts == "all" else ([] if ARGS.parts == "none" else ARGS.parts.split(","))
TABLE_Z = -0.028   # espessura da tabua: itens "de mesa" ficam em y=0 no GLB; o site posiciona


# ----------------------------------------------------------------------------
# utilidades
# ----------------------------------------------------------------------------
def mat(name, base=(1, 1, 1), rough=0.5, metal=0.0, vcol=False, alpha=1.0, cull=False, **kw):
    m = bb.make_mat(name, base=base, rough=rough, metal=metal, vcol=vcol, **kw)
    if alpha < 1.0:
        m.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    m.use_backface_culling = cull
    return m


def arc(cr, ca, rad, d0, d1, n=5):
    """pontos de um arco no plano (r, z): centro (cr, ca), angulos em graus."""
    return [(cr + rad * math.cos(math.radians(d0 + (d1 - d0) * i / n)),
             ca + rad * math.sin(math.radians(d0 + (d1 - d0) * i / n))) for i in range(n + 1)]


def lat(mb, prof, colfn=None, seg=48, org=(0, 0, 0), disp=None, uvfn=None, m=0, color=(1, 1, 1)):
    """Revolucao em torno de z de um perfil [(r, z)]. Sentido do perfil define as normais
    (subindo por fora = normais para fora). colfn(r,z,th)->cor; disp(r,z,th)->(r,z); uvfn(r,z,th)->(u,v)."""
    ox, oy, oz = org
    nk = seg + 1 if uvfn else seg
    rings = []
    for (r, a) in prof:
        ring = []
        for k in range(nk):
            th = 2 * math.pi * k / seg
            rr, aa = disp(r, a, th) if disp else (r, a)
            col = colfn(r, a, th) if colfn else color
            uv = uvfn(r, a, th) if uvfn else None
            ring.append(mb.add((ox + rr * math.cos(th), oy + rr * math.sin(th), oz + aa), col, uv=uv))
        rings.append(ring)
    for i in range(len(prof) - 1):
        for k in range(seg):
            k2 = k + 1 if uvfn else (k + 1) % seg
            mb.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], m=m)


def ball(mb, c, rad, sz=1.0, color=(1, 1, 1), nu=8, nv=6, m=0):
    bb.superq(mb, c, (rad, rad, rad * sz), 1.0, 1.0, nu, nv, color, m)


def rcube(mb, c, h, rd, N, rot, colfn, amp=0.0, freq=1.0, seed=0.0, m=0):
    """Cubo arredondado (cubo-esfera) de meia aresta h, raio de canto rd (0..1 da meia aresta),
    com rugosidade de ruido ao longo da normal. colfn(P_local, n, ruido)->cor."""
    R = Euler(rot).to_matrix()
    lim = 1.0 - rd
    for k in range(3):
        for s in (-1, 1):
            k1, k2 = (k + 1) % 3, (k + 2) % 3
            grid = []
            for i in range(N + 1):
                row = []
                for j in range(N + 1):
                    p = [0.0, 0.0, 0.0]
                    p[k], p[k1], p[k2] = float(s), -1 + 2 * i / N, -1 + 2 * j / N
                    q = [max(-lim, min(lim, x)) for x in p]
                    d = [p[a] - q[a] for a in range(3)]
                    dl = math.sqrt(sum(x * x for x in d))
                    n = [x / dl for x in d]
                    pos = Vector([(q[a] + n[a] * rd) * h for a in range(3)])
                    nv = Vector(n)
                    nval = 0.0
                    if amp:
                        nval = fbm(pos.x * freq + seed, pos.y * freq, pos.z * freq, 3)
                        pos = pos + nv * amp * nval
                    col = colfn(pos, nv, nval)
                    world = R @ pos + Vector(c)
                    row.append(mb.add(world, col))
                grid.append(row)
            for i in range(N):
                for j in range(N):
                    a, b, cc, d = grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]
                    if s > 0:
                        mb.quad(a, b, cc, d, m=m)
                    else:
                        mb.quad(a, d, cc, b, m=m)


def catmull(pts, n=8):
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(n):
            t = s / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return out


def rgba_image(name, arr, colorspace="sRGB"):
    """arr: (H, W, 3|4) float 0..1 (sRGB). Devolve imagem empacotada (JPEG/PNG vai pro GLB)."""
    import tempfile
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1))], axis=2)
    im = bpy.data.images.new(name + "_raw", w, h, alpha=False)
    im.pixels.foreach_set(arr.astype(np.float32).ravel())
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


def place(mb, i0, dx=0.0, dy=0.0, dz=0.0, yaw=0.0):
    c, s = math.cos(yaw), math.sin(yaw)
    bb.xform(mb, i0, lambda p: Vector((dx + p.x * c - p.y * s, dy + p.x * s + p.y * c, dz + p.z)))


def droplets(mb, rng, n, R, z0, z1, rmin, rmax, color=(1, 1, 1), streaks=0, ang=(0, 2 * math.pi)):
    """Gotas de condensacao (elipsoides achatados) na parede de um cilindro de raio R (eixo z); alguns fios."""
    for i in range(n):
        th = rng.uniform(*ang)
        z = rng.uniform(z0, z1)
        rad = rng.uniform(rmin, rmax)
        rc = R + rad * 0.15
        ball(mb, (rc * math.cos(th), rc * math.sin(th), z), rad, 1.3, color, 8, 6)
        if i < streaks:
            ln = rng.uniform(0.008, 0.016)
            rs = R + 0.0003
            pts = [Vector((rs * math.cos(th), rs * math.sin(th), z - ln * t)) for t in (0.0, 0.5, 1.0)]
            bb.tube(mb, pts, [rad * 0.42, rad * 0.4, rad * 0.5], [color] * 3, sides=5)


# ----------------------------------------------------------------------------
# BEB-LATA: lata 350 ml generica (corpo com textura propria, tampa de aluminio, gotas)
# ----------------------------------------------------------------------------
CAN_R = 0.0332
CAN_HB = 0.1155      # altura do corpo (ate o pescoco); tampa ate 0.1222


def can_texture():
    W, H = 512, 256
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    TH, Z = np.meshgrid(u * 2 * np.pi, v * CAN_HB)

    def sm(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0), 0, 1)
        return t * t * (3 - 2 * t)

    def mix(base, col, mask):
        return base * (1 - mask[..., None]) + np.array(col)[None, None, :] * mask[..., None]

    red = np.array(hexc("#8E1A20"))
    shade = 1.0 - 0.28 * (np.abs(Z / CAN_HB - 0.52) * 2) ** 3
    img = red[None, None, :] * shade[..., None]
    cream, gold, dred = hexc("#F4E5C4"), hexc("#E6AB3E"), hexc("#5A0E14")
    # faixa ondulada creme com fio dourado e fio creme
    zc = 0.0545 + 0.0085 * np.sin(2 * TH + 0.6)
    pw = 0.0004
    img = mix(img, cream, 1 - sm(0.0058 - pw, 0.0058 + pw, np.abs(Z - zc)))
    img = mix(img, gold, 1 - sm(0.0011 - pw, 0.0011 + pw, np.abs(Z - (zc - 0.0108))))
    img = mix(img, cream, 1 - sm(0.0007 - pw, 0.0007 + pw, np.abs(Z - (zc + 0.0108))))
    # emblemas abstratos (rosacea) na frente e atras
    for thc in (-np.pi / 2, np.pi / 2):
        d = (TH - thc + np.pi) % (2 * np.pi) - np.pi
        ds, dz = d * CAN_R, Z - 0.0845
        rho = np.sqrt(ds * ds + dz * dz)
        phi = np.arctan2(dz, ds)
        img = mix(img, cream, 1 - sm(0.0125 - pw, 0.0125 + pw, rho))
        img = mix(img, dred, 1 - sm(0.0100 - pw, 0.0100 + pw, rho))
        img = mix(img, cream, 1 - sm(0.0078 - pw, 0.0078 + pw, rho))
        petal = 0.0066 * (0.55 + 0.45 * np.cos(6 * phi))
        img = mix(img, dred, 1 - sm(-pw, pw, rho - petal))
        img = mix(img, gold, 1 - sm(0.0018 - pw, 0.0018 + pw, rho))
    # losangos nas laterais
    for thc in (0.0, np.pi):
        d = (TH - thc + np.pi) % (2 * np.pi) - np.pi
        ds, dz = d * CAN_R, Z - 0.0845
        dia = np.abs(ds) + np.abs(dz)
        img = mix(img, cream, 1 - sm(0.0085 - pw, 0.0085 + pw, dia))
        img = mix(img, dred, 1 - sm(0.0055 - pw, 0.0055 + pw, dia))
        img = mix(img, gold, 1 - sm(0.0022 - pw, 0.0022 + pw, dia))
    # fio dourado e creme perto da base
    img = mix(img, gold, 1 - sm(0.0010 - pw, 0.0010 + pw, np.abs(Z - 0.0135)))
    img = mix(img, cream, 1 - sm(0.0006 - pw, 0.0006 + pw, np.abs(Z - 0.0158)))
    # zonas de aluminio nu (base e ombro/pescoco)
    silver = np.array(hexc("#C5CAD0"))
    sh2 = 0.85 + 0.15 * np.sin(Z * 900)[..., None] * 0 + 0.0
    pm = sm(0.0070, 0.0082, Z) * (1 - sm(0.1018, 0.1030, Z))
    img = img * pm[..., None] + (silver[None, None, :] * sh2) * (1 - pm[..., None])
    return rgba_image("lata_corpo", np.clip(img, 0, 1))


def build_lata(root):
    objs = []
    tex = can_texture()
    m_body = mat("mat_lata_corpo", rough=0.3, metal=0.55, image=tex, spec=0.6, coat=0.35)
    m_alu = mat("mat_lata_aluminio", base=hexc("#C9CED4"), rough=0.26, metal=0.85, spec=0.7)
    m_drop = mat("mat_lata_gota", base=hexc("#EAF4FF"), rough=0.04, spec=1.0, alpha=0.30, cull=True)
    # corpo
    pr = [(0.0, 0.0072), (0.008, 0.0064), (0.016, 0.0047), (0.0215, 0.0022), (0.0248, 0.0004),
          (0.0262, 0.0), (0.0285, 0.0), (0.0305, 0.0015), (0.0322, 0.0050), (0.0330, 0.0100)]
    z = 0.0150
    while z < 0.1010:
        pr.append((CAN_R, z))
        z += 0.0085
    pr += [(0.0330, 0.1030), (0.0319, 0.1052), (0.0304, 0.1078), (0.0291, 0.1100), (0.0282, 0.1122), (0.0278, 0.1140), (0.0278, CAN_HB)]
    mb = MB()
    lat(mb, pr, seg=56, uvfn=lambda r, a, th: (th / (2 * math.pi), min(1.0, a / CAN_HB)), color=(1, 1, 1))
    objs.append(finish(mb, "lata_corpo", [m_body], root, vc_white=True))
    # tampa de aluminio (aro enrolado + recuo) e abre-lata
    mb = MB()
    top = [(0.0278, CAN_HB), (0.0282, 0.1170), (0.0291, 0.1190), (0.0292, 0.1205), (0.0285, 0.1217), (0.0270, 0.1222),
           (0.0262, 0.1214), (0.0260, 0.1200), (0.0256, 0.1186), (0.0246, 0.1179), (0.0, 0.1179)]
    lat(mb, top, seg=56, color=(1, 1, 1))
    bb.superq(mb, (0.0030, 0.0, 0.1185), (0.0098, 0.0062, 0.0007), 0.35, 0.35, 20, 4, (1, 1, 1))   # lingueta
    bb.superq(mb, (0.0060, 0.0, 0.1191), (0.0040, 0.0027, 0.0004), 0.3, 0.3, 12, 3, (0.45, 0.47, 0.5))  # furo do dedo (mesmo material, so cor)
    objs.append(finish(mb, "lata_tampa", [m_alu], root, vc_white=True))
    # gotas de condensacao
    import random
    rng = random.Random(11)
    mb = MB()
    droplets(mb, rng, 56, CAN_R, 0.014, 0.100, 0.0008, 0.0017, streaks=8)
    objs.append(finish(mb, "lata_gotas", [m_drop], root, vc_white=True))
    return objs


# ----------------------------------------------------------------------------
# BEB-CHOPP: caneca de vidro 500 ml, chopp dourado, colarinho, alca
# ----------------------------------------------------------------------------
MUG_H = 0.150
MUG_W = 0.0040     # parede


def mug_r(z):
    """raio externo da caneca na altura z (leve conicidade)."""
    return 0.0395 + (z - 0.010) / (MUG_H - 0.010) * 0.0050


def build_chopp(root):
    import random
    rng = random.Random(5)
    objs = []
    m_glass = mat("mat_chopp_vidro", base=hexc("#F2F8F6"), rough=0.04, spec=1.0, alpha=0.10, cull=True)
    m_thick = mat("mat_chopp_vidro_grosso", base=hexc("#EAF4F1"), rough=0.05, spec=1.0, alpha=0.34, cull=True)
    m_beer = mat("mat_chopp_liquido", vcol=True, rough=0.08, spec=0.8, alpha=0.90, cull=True, emit=hexc("#D88A00"), emit_s=0.45)
    m_bub = mat("mat_chopp_bolhas", base=hexc("#FFF4D0"), rough=0.1, spec=0.8, alpha=0.55, cull=True)
    m_foam = mat("mat_chopp_espuma", vcol=True, rough=0.62, spec=0.35)
    m_drop = mat("mat_chopp_gota", base=hexc("#EAF4FF"), rough=0.04, spec=1.0, alpha=0.32, cull=True)
    ri = lambda z: mug_r(z) - MUG_W
    Z0 = 0.016   # piso interno
    # liquido (primeiro no no GLB: vidro por cima na ordem de desenho)
    ZL = 0.1385
    mb = MB()
    pl = [(0.0, Z0 + 0.0004)] + [(ri(Z0) - 0.004 + 0.0 + p[0] - 0.0, p[1]) for p in []]
    pl = [(0.0, Z0 + 0.0004), (ri(0.03) - 0.0045, Z0 + 0.0004)]
    for (r, a) in arc(ri(0.03) - 0.0045, Z0 + 0.0044, 0.004, -90, 0, 4):
        pl.append((r - 0.0004 + 0.0004, a))
    z = 0.04
    while z < ZL:
        pl.append((ri(z) - 0.0004, z))
        z += 0.025
    pl += [(ri(ZL) - 0.0004, ZL), (0.0, ZL)]
    cl = lambda r, z, th: lerpc(hexc("#D8870A"), hexc("#F6BE35"), smooth(0.02, ZL, z))
    lat(mb, pl, colfn=cl, seg=48)
    # bolhinhas subindo
    bm = MB()
    for i in range(46):
        th = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.0, ri(0.1) - 0.006)
        zb = rng.uniform(Z0 + 0.008, ZL - 0.004)
        ball(bm, (rr * math.cos(th), rr * math.sin(th), zb), rng.uniform(0.0007, 0.0017), 1.0, (1, 1, 1), 6, 4)
    objs.append(finish(mb, "chopp_liquido", [m_beer], root))
    objs.append(finish(bm, "chopp_bolhas", [m_bub], root, vc_white=True))
    # colarinho
    mb = MB()
    pf = [(0.0, ZL - 0.0005), (ri(ZL) - 0.0004, ZL - 0.0005), (ri(0.146) - 0.0003, 0.1465), (ri(MUG_H) + 0.0006, 0.1515),
          (ri(MUG_H) + 0.0012, 0.1560), (0.0402, 0.1595), (0.0375, 0.1627), (0.0325, 0.1650), (0.0255, 0.1668),
          (0.0175, 0.1680), (0.0085, 0.1686), (0.0, 0.1688)]

    def fdisp(r, a, th):
        x, y = r * math.cos(th), r * math.sin(th)
        w = smooth(0.150, 0.158, a)
        dz = 0.0016 * fbm(x * 150, y * 150, 3.1, 3) * w
        dr = 0.0010 * fbm(x * 90, y * 90, 7.7, 2) * w * (r / 0.04)
        return r + dr, a + dz
    fcol = lambda r, z, th: lerpc(hexc("#FFF6DC"), hexc("#F2DDAA"), clamp(0.5 + 0.5 * fbm(r * math.cos(th) * 120, r * math.sin(th) * 120, z * 120, 2)))
    lat(mb, pf, colfn=fcol, seg=56, disp=fdisp)
    for i in range(30):
        th = rng.uniform(0, 2 * math.pi)
        rr = math.sqrt(rng.uniform(0, 1)) * 0.0345
        zt = 0.1688 - 0.0150 * (rr / 0.04) ** 2
        rad = rng.uniform(0.0035, 0.0068)
        ball(mb, (rr * math.cos(th), rr * math.sin(th), zt - rad * 0.35), rad, 0.82,
             lerpc(hexc("#FFF8E4"), hexc("#F5E2B2"), rng.random()), 10, 6)
    objs.append(finish(mb, "chopp_espuma", [m_foam], root))
    # vidro: parede externa + aro + parede interna + piso
    mb = MB()
    pg = [(0.0, 0.0), (0.0345, 0.0)]
    pg += arc(0.0345, 0.0055, 0.0055, -90, 0, 4)[1:]
    z = 0.020
    while z < 0.146:
        pg.append((mug_r(z), z))
        z += 0.020
    pg += [(mug_r(MUG_H), MUG_H - 0.002)]
    cr = (mug_r(MUG_H) - MUG_W / 2)
    pg += arc(cr, MUG_H - 0.002, MUG_W / 2, 0, 180, 6)[1:-1]
    pg += [(ri(MUG_H), MUG_H - 0.002)]
    z = 0.130
    while z > 0.040:
        pg.append((ri(z), z))
        z -= 0.030
    pg += [(ri(0.04), 0.04)]
    pg += arc(ri(0.03) - 0.0045 + 0.0, Z0 + 0.0045, 0.0045, 0, -90, 4)[0:0]
    pg += [(ri(0.03), Z0 + 0.0045)] if False else []
    pg += [(ri(0.03), 0.0235), (ri(0.03) - 0.0013, Z0 + 0.0020), (ri(0.03) - 0.0045, Z0), (0.0, Z0)]
    lat(mb, pg, seg=56, color=(1, 1, 1))
    # alca em D (vidro)
    hp = catmull([(0.040, 0, 0.133), (0.055, 0, 0.1345), (0.069, 0, 0.123), (0.0765, 0, 0.097), (0.0722, 0, 0.068),
                  (0.060, 0, 0.044), (0.0415, 0, 0.038)], 8)
    bb.tube(mb, hp, [0.0058] * len(hp), [(1, 1, 1)] * len(hp), sides=10, cap=True, squash=0.78)
    objs.append(finish(mb, "chopp_vidro", [m_glass], root, vc_white=True))
    mb = MB()   # base grossa e aro do vidro (mais opacos: da leitura de vidro espesso)
    rb_ = ri(0.03) - 0.0045
    lat(mb, [(0.0, 0.0007), (rb_ + 0.0, 0.0007)] + arc(rb_ - 0.0, 0.0050, 0.0043, -90, 0, 3)[1:] + [(0.0390, 0.0120), (0.0389, Z0 - 0.0007), (0.0, Z0 - 0.0007)], seg=56, color=(1, 1, 1))
    lat(mb, arc(cr, MUG_H - 0.002, MUG_W / 2 - 0.0004, 0, 360, 10), seg=56, color=(1, 1, 1))
    objs.append(finish(mb, "chopp_vidrog", [m_thick], root, vc_white=True))
    # condensacao
    mb = MB()
    droplets(mb, rng, 30, 0.0422, 0.030, 0.132, 0.0008, 0.0016, streaks=5, ang=(-math.pi * 0.95, math.pi * 0.05))
    objs.append(finish(mb, "chopp_gotas", [m_drop], root, vc_white=True))
    return objs


# ----------------------------------------------------------------------------
# BEB-SODA: soda italiana em copo alto, gelo, degrade verde-maca, rodela de limao, canudo
# ----------------------------------------------------------------------------
SD_H = 0.170
SD_W = 0.0026


def sd_r(z):
    return 0.0258 + (z / SD_H) * 0.0072


def build_soda(root):
    import random
    rng = random.Random(21)
    objs = []
    m_glass = mat("mat_soda_vidro", base=hexc("#F0F8F4"), rough=0.04, spec=1.0, alpha=0.10, cull=True)
    m_thick = mat("mat_soda_vidro_grosso", base=hexc("#E8F4EE"), rough=0.05, spec=1.0, alpha=0.34, cull=True)
    m_liq = mat("mat_soda_liquido", vcol=True, rough=0.06, spec=0.8, alpha=0.66, cull=True, emit=hexc("#4FB83A"), emit_s=0.35)
    m_ice = mat("mat_soda_gelo", vcol=True, rough=0.08, spec=0.9, alpha=0.62, coat=0.4, emit=hexc("#BFE3F2"), emit_s=0.22)
    m_bub = mat("mat_soda_bolhas", base=hexc("#F4FFE0"), rough=0.1, spec=0.8, alpha=0.6, cull=True)
    m_lime = mat("mat_soda_limao", vcol=True, rough=0.45, spec=0.5)
    m_straw = mat("mat_soda_canudo", vcol=True, rough=0.5, spec=0.4)
    m_drop = mat("mat_soda_gota", base=hexc("#EAF4FF"), rough=0.04, spec=1.0, alpha=0.32, cull=True)
    ri = lambda z: sd_r(z) - SD_W
    Z0 = 0.011
    ZL = 0.1505
    # liquido em degrade
    mb = MB()
    pl = [(0.0, Z0 + 0.0004), (ri(0.02) - 0.004, Z0 + 0.0004)]
    for (r, a) in arc(ri(0.02) - 0.004, Z0 + 0.0044, 0.004, -90, 0, 3)[1:]:
        pl.append((r, a))
    z = 0.030
    while z < ZL:
        pl.append((ri(z) - 0.0004, z))
        z += 0.0225
    pl += [(ri(ZL) - 0.0004, ZL), (0.0, ZL)]
    c1, c2, c3 = hexc("#2FA34B"), hexc("#9ED94A"), hexc("#E2F28A")

    def lc(r, z, th):
        t = (z - Z0) / (ZL - Z0)
        return lerpc(c1, c2, smooth(0.0, 0.55, t)) if t < 0.55 else lerpc(c2, c3, smooth(0.55, 1.0, t))
    lat(mb, pl, colfn=lc, seg=48)
    bm = MB()
    for i in range(34):
        th = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.0, 0.021)
        ball(bm, (rr * math.cos(th), rr * math.sin(th), rng.uniform(Z0 + 0.006, ZL - 0.004)), rng.uniform(0.0006, 0.0015), 1.0, (1, 1, 1), 6, 4)
    objs.append(finish(mb, "soda_liquido", [m_liq], root))
    objs.append(finish(bm, "soda_bolhas", [m_bub], root, vc_white=True))
    # gelo (cubos arredondados, translucidos)
    mb = MB()
    cube_specs = [(0.006, 0.004, 0.028), (-0.008, -0.006, 0.034), (0.002, -0.010, 0.056), (-0.004, 0.009, 0.060),
                  (0.009, 0.003, 0.086), (-0.010, 0.0, 0.090), (0.0, -0.008, 0.116), (-0.007, 0.007, 0.121),
                  (0.008, 0.006, 0.146), (-0.002, -0.004, 0.152)]
    for (x, y, z) in cube_specs:
        rot = (rng.uniform(0, 1.2), rng.uniform(0, 1.2), rng.uniform(0, 3.1))
        icol = lambda P, n, nv: lerpc(hexc("#CFE8F7"), hexc("#FFFFFF"), clamp(0.55 + 0.9 * nv + 0.25 * n.z))
        rcube(mb, (x, y, z), 0.0098, 0.38, 5, rot, icol, amp=0.0011, freq=170.0, seed=rng.uniform(0, 50))
    objs.append(finish(mb, "soda_gelo", [m_ice], root))
    # vidro
    mb = MB()
    pg = [(0.0, 0.0), (0.0215, 0.0)]
    pg += arc(0.0215, 0.0045, 0.0045, -90, 0, 4)[1:]
    z = 0.020
    while z < SD_H - 0.004:
        pg.append((sd_r(z), z))
        z += 0.025
    pg += [(sd_r(SD_H), SD_H - 0.002)]
    cr = sd_r(SD_H) - SD_W / 2
    pg += arc(cr, SD_H - 0.002, SD_W / 2, 0, 180, 6)[1:-1]
    pg += [(ri(SD_H), SD_H - 0.002)]
    z = 0.150
    while z > 0.030:
        pg.append((ri(z), z))
        z -= 0.030
    pg += [(ri(0.03), 0.030), (ri(0.02) - 0.0015, Z0 + 0.002), (ri(0.02) - 0.004, Z0), (0.0, Z0)]
    lat(mb, pg, seg=56, color=(1, 1, 1))
    objs.append(finish(mb, "soda_vidro", [m_glass], root, vc_white=True))
    mb = MB()
    lat(mb, [(0.0, 0.0007), (0.0205, 0.0007)] + arc(0.0205, 0.0045, 0.0038, -90, 0, 3)[1:] + [(0.0262, 0.0070), (0.0258, Z0 - 0.0007), (0.0, Z0 - 0.0007)], seg=56, color=(1, 1, 1))
    lat(mb, arc(cr, SD_H - 0.002, SD_W / 2 - 0.0004, 0, 360, 10), seg=56, color=(1, 1, 1))
    objs.append(finish(mb, "soda_vidrog", [m_thick], root, vc_white=True))
    # rodela de limao na borda
    mb = MB()
    R, T = 0.0255, 0.0018
    lcols = {"rind": hexc("#5DA52B"), "pith": hexc("#EEF4C8"), "flesh": hexc("#BCDD4C"), "flesh2": hexc("#A7CF3A")}
    prof = [(0.0, -T), (0.30 * R, -T), (0.62 * R, -T), (0.82 * R, -T), (0.88 * R, -T), (0.93 * R, -T), (R - 0.0006, -T),
            (R, -T * 0.4), (R, T * 0.4), (R - 0.0006, T), (0.93 * R, T), (0.88 * R, T), (0.82 * R, T), (0.62 * R, T),
            (0.30 * R, T), (0.0, T)]
    nseg, wedges = 40, 10

    def wc(r, z, th):
        k = round(th / (2 * math.pi) * nseg) % (nseg // wedges)
        f = r / R
        if f > 0.935:
            return lcols["rind"]
        if f > 0.865:
            return lcols["pith"]
        if f < 0.04:
            return lcols["pith"]
        if k == 0:
            return lerpc(lcols["flesh"], lcols["pith"], 0.85)
        return lcols["flesh"] if f > 0.4 else lcols["flesh2"]
    lat(mb, prof, colfn=wc, seg=nseg)
    yaw = math.radians(24)
    tilt = math.radians(-8)

    def wf(p):
        # disco no plano xz (normal em y), levemente girado e inclinado
        q = Vector((p.x, -p.z, p.y))
        cy, sy = math.cos(yaw), math.sin(yaw)
        q = Vector((q.x * cy - q.y * sy, q.x * sy + q.y * cy, q.z))
        ct, st = math.cos(tilt), math.sin(tilt)
        q = Vector((q.x * ct + q.z * st, q.y, -q.x * st + q.z * ct))
        return q + Vector((0.0300, -0.0015, 0.1745))
    bb.xform(mb, 0, wf)
    objs.append(finish(mb, "soda_limao", [m_lime], root))
    # canudo listrado
    mb = MB()
    sp = [Vector((0.007, 0.005, 0.016)).lerp(Vector((-0.011, 0.0035, 0.218)), i / 15) for i in range(16)]
    scol = []
    for i, p in enumerate(sp):
        band = int((i / 15) * 218 / 12.0)
        scol.append(hexc("#E4472F") if band % 2 == 0 else hexc("#F9F1E2"))
    # cada anel tem cor propria: faixas nitidas pedem aneis duplicados nas trocas
    pts2, rad2, col2 = [], [], []
    for i, p in enumerate(sp):
        pts2.append(p)
        rad2.append(0.0032)
        col2.append(scol[i])
    bb.tube(mb, pts2, rad2, col2, sides=8, cap=True)
    objs.append(finish(mb, "soda_canudo", [m_straw], root))
    # condensacao
    mb = MB()
    droplets(mb, rng, 26, 0.0322, 0.026, 0.142, 0.0007, 0.0015, streaks=4, ang=(-math.pi * 0.95, math.pi * 0.05))
    objs.append(finish(mb, "soda_gotas", [m_drop], root, vc_white=True))
    return objs


# ----------------------------------------------------------------------------
# potinho de molho (ramekin) usado pelas duas porcoes
# ----------------------------------------------------------------------------
def pot(mb_c, mb_s, cx, cy):
    ro, h = 0.0225, 0.0305
    ri_ = 0.0200
    pc = [(0.0, 0.0), (0.0150, 0.0)]
    pc += arc(0.0150, 0.0035, 0.0035, -90, 0, 3)[1:]
    pc += [(0.0200, 0.010), (0.0218, 0.020), (ro, h - 0.002)]
    pc += arc(ro - 0.0013, h - 0.002, 0.0013, 0, 180, 5)[1:-1]
    pc += [(ri_ + 0.0005, h - 0.002), (ri_ - 0.0006, 0.022), (ri_ - 0.0020, 0.012), (ri_ - 0.0030, 0.0075), (0.0, 0.0075)]
    lat(mb_c, pc, seg=40, color=hexc("#EDE3D0"), org=(cx, cy, 0))
    # molho de cheddar defumado (cupula com ondas)
    ps = [(0.0, 0.0085)]
    z = 0.0085
    for (r, a) in [(ri_ - 0.0020, 0.0085), (ri_ - 0.0010, 0.014), (ri_ - 0.0005, 0.020), (ri_ - 0.0004, 0.0255)]:
        ps.append((r, a))
    ps += [(0.0160, 0.0270), (0.0125, 0.0283), (0.0085, 0.0292), (0.0040, 0.0297), (0.0, 0.0299)]

    def sdisp(r, a, th):
        w = smooth(0.0258, 0.0272, a)
        return r, a + w * 0.0010 * math.sin(3 * th + r * 340) * (r / 0.019 + 0.15)

    def scol(r, a, th):
        t = 0.5 + 0.5 * math.sin(3 * th + r * 340)
        return lerpc(hexc("#DC7F14"), hexc("#F0A733"), t * smooth(0.0258, 0.0299, a))
    lat(mb_s, ps, colfn=scol, seg=40, disp=sdisp, org=(cx, cy, 0))


# ----------------------------------------------------------------------------
# PORCAO-DADINHO: cumbuca escura com dadinhos de tapioca + potinho de cheddar
# ----------------------------------------------------------------------------
def build_dadinho(root):
    import random
    rng = random.Random(33)
    objs = []
    m_bowl = mat("mat_dadinho_tigela", base=hexc("#33251F"), rough=0.3, spec=0.6, coat=0.3)
    m_pot = mat("mat_dadinho_pote", base=hexc("#EDE3D0"), rough=0.35, spec=0.5)
    m_sauce = mat("mat_dadinho_molho", vcol=True, rough=0.22, spec=0.7, coat=0.55)
    m_cube = mat("mat_dadinho_cubos", vcol=True, rough=0.62, spec=0.35)
    BX, PX = -0.0265, 0.0620
    # tigela
    mb = MB()
    pb = [(0.0, 0.0), (0.0300, 0.0)]
    pb += arc(0.0300, 0.0030, 0.0030, -90, 0, 3)[1:]
    pb += [(0.0345, 0.0120), (0.0430, 0.0210), (0.0520, 0.0290), (0.0580, 0.0360)]
    pb += arc(0.0572, 0.0360, 0.0008, 0, 180, 4)[1:-1]
    pb += [(0.0564, 0.0358), (0.0505, 0.0285), (0.0420, 0.0190), (0.0345, 0.0100), (0.0290, 0.0058), (0.0, 0.0050)]
    lat(mb, pb, seg=56, color=(1, 1, 1), org=(BX, 0, 0))
    objs.append(finish(mb, "dadinho_tigela", [m_bowl], root, vc_white=True))
    # dadinhos (12 cubos crocantes em 3 camadas)
    mb = MB()
    h = 0.0120

    def ccol(P, n, nv):
        t = clamp(0.5 + 1.1 * nv)
        base = lerpc(hexc("#E8A838"), hexc("#F6CB63"), clamp(0.4 + 0.7 * (n.z + 0.3)))
        base = lerpc(base, hexc("#A9631C"), clamp(0.55 - 1.5 * nv) * 0.8)
        return lerpc(base, hexc("#FBE29A"), clamp(0.9 * (t - 0.75) * 4) * 0.5)
    layout = []
    zf = 0.0050 + h * 0.98
    for i in range(4):
        a = 2 * math.pi * i / 4 + 0.5
        layout.append((0.0235 * math.cos(a), 0.0235 * math.sin(a), zf + rng.uniform(0.0, 0.0010)))
    layout.append((0.0, 0.0, zf))
    z2 = zf + 2 * h * 0.92
    for i in range(4):
        a = 2 * math.pi * i / 4 + 1.05
        layout.append((0.0135 * math.cos(a), 0.0135 * math.sin(a), z2 + rng.uniform(0.0, 0.0010)))
    z3 = z2 + 2 * h * 0.90
    layout.append((0.0030, 0.0040, z3))
    layout.append((-0.0050, -0.0040, z3 + 0.0095))
    layout.append((0.0395, -0.0060, zf + 0.0030))   # um dadinho encostado na borda, para quebrar a simetria
    for i, (x, y, z) in enumerate(layout):
        rot = (rng.uniform(-0.40, 0.40), rng.uniform(-0.40, 0.40), rng.uniform(0, 1.5))
        rcube(mb, (BX + x, y, z), h * rng.uniform(0.94, 1.04), 0.22, 8, rot, ccol, amp=0.0013, freq=190.0, seed=rng.uniform(0, 80))
    objs.append(finish(mb, "dadinho_cubos", [m_cube], root))
    mc, ms = MB(), MB()
    pot(mc, ms, PX, 0.0)
    objs.append(finish(mc, "dadinho_pote", [m_pot], root, vc_white=True))
    objs.append(finish(ms, "dadinho_molho", [m_sauce], root))
    return objs


# ----------------------------------------------------------------------------
# PORCAO-BATATA: caixinha kraft aberta com batata rustica + potinho de cheddar
# ----------------------------------------------------------------------------
BOX_HX, BOX_HY = 0.0525, 0.0365     # meia largura/profundidade no topo
BOX_HB, BOX_HF = 0.084, 0.052        # altura atras / na frente (frente rebaixada)


def box_ztop(th):
    return BOX_HF + (BOX_HB - BOX_HF) * smooth(-0.30, 0.55, math.sin(th))


def box_pt(th, z, inset=0.0):
    f = clamp(z / BOX_HB)
    sc = 0.76 + 0.24 * f
    n = 5.5
    cx_, sy_ = math.cos(th), math.sin(th)
    ex = math.copysign(abs(cx_) ** (2 / n), cx_)
    ey = math.copysign(abs(sy_) ** (2 / n), sy_)
    return ((BOX_HX * sc - inset) * ex, (BOX_HY * sc - inset) * ey)


def build_batata(root):
    import random
    rng = random.Random(44)
    objs = []
    m_kraft = mat("mat_batata_kraft", vcol=True, rough=0.88, spec=0.2)
    m_fry = mat("mat_batata_gomos", vcol=True, rough=0.55, spec=0.35)
    m_pot = mat("mat_batata_pote", base=hexc("#EDE3D0"), rough=0.35, spec=0.5)
    m_sauce = mat("mat_batata_molho", vcol=True, rough=0.22, spec=0.7, coat=0.55)
    BXC, PX = -0.0265, 0.0565
    # caixa kraft (paredes com espessura, frente rebaixada)
    mb = MB()
    N = 80
    T = 0.0022
    Z0 = 0.0035

    def kc(z, inner):
        n = fbm(z * 40, 1.7, 3.0, 2)
        base = hexc("#A87B48") if inner else hexc("#BC8E58")
        return lerpc(base, hexc("#8F6538") if inner else hexc("#D3A870"), clamp(0.5 + 0.5 * n))
    rings = []
    S = 6
    for i in range(S + 1):
        s = i / S
        ring = []
        for k in range(N):
            th = 2 * math.pi * k / N
            zt = box_ztop(th)
            z = s * zt
            x, y = box_pt(th, z)
            ring.append(mb.add((BXC + x, y, z), kc(z + 0.003 * math.cos(th * 3), False)))
        rings.append(ring)
    # aro (topo) e parede interna
    ring_in = []
    for i in range(S, -1, -1):
        s = i / S
        ring = []
        for k in range(N):
            th = 2 * math.pi * k / N
            zt = box_ztop(th)
            z = Z0 + s * (zt - Z0)
            x, y = box_pt(th, z, T)
            ring.append(mb.add((BXC + x, y, z), kc(z, True)))
        ring_in.append(ring)
    allr = rings + ring_in
    for i in range(len(allr) - 1):
        for k in range(N):
            k2 = (k + 1) % N
            mb.quad(allr[i][k], allr[i][k2], allr[i + 1][k2], allr[i + 1][k], m=0)
    mb.face(*reversed(rings[0]))
    mb.face(*ring_in[-1])
    objs.append(finish(mb, "batata_caixa", [m_kraft], root))
    # gomos de batata rustica (casca marrom, miolo dourado)
    mb = MB()
    skin_c = [hexc("#BC8744"), hexc("#CB9751"), hexc("#AB7838")]
    flesh_c = [hexc("#F3C45C"), hexc("#EBB24A"), hexc("#F7D274")]
    brown = hexc("#B8741F")

    def wedge(base, d, L, R, ang, roll, seed):
        d = Vector(d).normalized()
        e1 = d.cross(Vector((0.3, 0.9, 0.1)))
        e1.normalize()
        e2 = d.cross(e1)
        ca, sa = math.cos(roll), math.sin(roll)
        a1, a2 = e1 * ca + e2 * sa, -e1 * sa + e2 * ca
        narc = 7
        nr = 7
        sk, fa, fb = skin_c[seed % 3], flesh_c[seed % 3], flesh_c[(seed + 1) % 3]
        bend = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * 0.0045

        def sec(t):
            tt = t
            sc = 1.0 - 0.15 * tt
            if t < 0.06:
                sc *= 0.80 + 0.2 * (t / 0.06)
            if t > 0.94:
                sc *= 0.80 + 0.2 * ((1 - t) / 0.06)
            ctr = base + d * (L * t) + bend * (t * t)
            pts = []
            for j in range(narc):
                al = -ang + 2 * ang * j / (narc - 1)
                wob = 1.0 + 0.07 * bb.nz(seed * 3.1 + t * 5.0, j * 1.7, 2.0)
                pts.append(ctr + (a1 * math.cos(al) + a2 * math.sin(al)) * (R * sc * wob))
            ap = ctr + (a1 * math.cos(0)) * (R * sc * 0.18)
            return pts, ap, ctr
        S_ = [sec(i / (nr - 1)) for i in range(nr)]
        # casca (arco)
        sv = []
        for i in range(nr):
            t = i / (nr - 1)
            col = lerpc(sk, brown, clamp(0.5 * (1 - 2 * abs(t - 0.5)) ** 2)) if (t < 0.12 or t > 0.88) else sk
            row = [mb.add(p, lerpc(col, mulc_(col, 0.78), (jj % 2) * 0.4)) for jj, p in enumerate(S_[i][0])]
            sv.append(row)
        for i in range(nr - 1):
            for j in range(narc - 1):
                mb.quad(sv[i][j], sv[i][j + 1], sv[i + 1][j + 1], sv[i + 1][j])
        # laterais planas (miolo)
        for side in (0, 1):
            fv = []
            for i in range(nr):
                t = i / (nr - 1)
                edge = S_[i][0][0 if side == 0 else -1]
                col = lerpc(fa, fb, clamp(0.5 + 0.5 * bb.nz(i * 1.3 + side * 5, seed, 1.0)))
                col = lerpc(col, brown, 0.32 * smooth(0.0, 0.18, 1 - 2 * abs(t - 0.5) if False else min(t, 1 - t) * -1 + 0.18))
                fv.append((mb.add(edge, col), mb.add(S_[i][1], col)))
            for i in range(nr - 1):
                if side == 0:
                    mb.quad(fv[i][0], fv[i][1], fv[i + 1][1], fv[i + 1][0])
                else:
                    mb.quad(fv[i][1], fv[i][0], fv[i + 1][0], fv[i + 1][1])
        # tampas (pontas cortadas, douradas com bordas tostadas)
        for (idx, flip) in ((0, True), (nr - 1, False)):
            pts, ap, ctr = S_[idx]
            vs = [mb.add(p, lerpc(fa, brown, 0.35)) for p in pts] + [mb.add(ap, fb)]
            if flip:
                mb.face(*reversed(vs))
            else:
                mb.face(*vs)

    def mulc_(c, k):
        return tuple(min(1, max(0, x * k)) for x in c)

    # distribui os gomos: em pe e inclinados para fora, pontas passando da borda
    cnt = 0
    for i in range(27):
        for attempt in range(40):
            x = rng.uniform(-0.036, 0.036)
            y = rng.uniform(-0.024, 0.024)
            if (x / 0.036) ** 2 + (y / 0.024) ** 2 <= 1.0:
                break
        az = math.atan2(y, x * 0.8) + rng.uniform(-0.6, 0.6)
        tilt = rng.uniform(0.05, 0.42)
        if y < -0.008 and rng.random() < 0.35:
            az, tilt = -math.pi / 2 + rng.uniform(-0.5, 0.5), rng.uniform(0.75, 1.05)
        d = (math.sin(tilt) * math.cos(az), math.sin(tilt) * math.sin(az), math.cos(tilt))
        zb = rng.uniform(0.012, 0.030)
        rim = box_ztop(math.atan2(y, x))
        L = (rim + rng.uniform(0.006, 0.030) - zb) / max(0.35, math.cos(tilt))
        wedge(Vector((BXC + x, y, zb)), d, L, rng.uniform(0.0138, 0.0168), rng.uniform(0.95, 1.2), rng.uniform(0, 6.28), i)
    objs.append(finish(mb, "batata_gomos", [m_fry], root, weld=False))
    mc, ms = MB(), MB()
    pot(mc, ms, PX, -0.002)
    objs.append(finish(mc, "batata_pote", [m_pot], root, vc_white=True))
    objs.append(finish(ms, "batata_molho", [m_sauce], root))
    return objs


BUILDERS = {"beb-lata": build_lata, "beb-chopp": build_chopp, "beb-soda": build_soda,
            "porcao-dadinho": build_dadinho, "porcao-batata": build_batata}


def build_and_export():
    stats = {}
    for name in SEL:
        root = root_empty(name.replace("-", "_"))
        objs = BUILDERS[name](root)
        tris = sum(tri_count(o) for o in objs)
        path = bb.export_part(name, objs, root)
        stats[name] = (os.path.getsize(path), tris)
        print("EXPORT %-16s %8d bytes %7d tris" % (name, stats[name][0], tris))
        # limpa a cena de construcao para a proxima peca
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    return stats


# ----------------------------------------------------------------------------
# renders de revisao e icones (a partir dos GLBs exportados)
# ----------------------------------------------------------------------------
def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    return new, [o for o in new if o.parent is None]


def set_vis(objs_vis, all_objs):
    vis = set(objs_vis)
    for o in all_objs:
        o.hide_render = o not in vis
        o.hide_viewport = o not in vis


def shoot(show, path, res, samples, az, el, lens, margin=1.08, floor_z=None, key_gain=1.0, shift=(0, 0, 0),
          transparent=False, world_k=1.0):
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    mn, mx = bb.world_bbox([o for o in show if o.type == "MESH"])
    for o in list(bpy.data.objects):
        if o.name.startswith(("CAM", "LT_", "FLOOR")):
            bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.data.objects.new("CAM", bpy.data.cameras.new("CAM"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.film_transparent = transparent
    ctr, dist = bb.frame_camera(cam, mn, mx, math.radians(az), math.radians(el), lens, margin, shift)
    R = max((mx - mn).length / 2, 0.05)
    if not transparent:
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
    w = sc.world.node_tree.nodes["Background"]
    if transparent:
        w.inputs["Color"].default_value = (s2l(0.55), s2l(0.45), s2l(0.36), 1.0)
        w.inputs["Strength"].default_value = world_k
    else:
        w.inputs["Color"].default_value = (s2l(bb.BG[0]), s2l(bb.BG[1]), s2l(bb.BG[2]), 1.0)
        w.inputs["Strength"].default_value = 1.0
    sc.render.filepath = path
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


def resize_premult(arr, out):
    """redimensiona RGBA (H,W,4) com alfa pre-multiplicado, bilinear, para out x out."""
    h, w = arr.shape[:2]
    pm = arr.copy()
    pm[..., :3] *= pm[..., 3:4]
    ys = (np.arange(out) + 0.5) * h / out - 0.5
    xs = (np.arange(out) + 0.5) * w / out - 0.5
    y0 = np.clip(np.floor(ys).astype(int), 0, h - 1)
    y1 = np.clip(y0 + 1, 0, h - 1)
    x0 = np.clip(np.floor(xs).astype(int), 0, w - 1)
    x1 = np.clip(x0 + 1, 0, w - 1)
    fy = np.clip(ys - y0, 0, 1)[:, None, None]
    fx = np.clip(xs - x0, 0, 1)[None, :, None]
    a = pm[y0][:, x0] * (1 - fx) + pm[y0][:, x1] * fx
    b = pm[y1][:, x0] * (1 - fx) + pm[y1][:, x1] * fx
    r = a * (1 - fy) + b * fy
    al = r[..., 3:4]
    r[..., :3] = np.where(al > 1e-5, r[..., :3] / np.maximum(al, 1e-5), 0)
    return r


def make_icon(name, show, samples, quick):
    """Render transparente 1024 -> recorta no item (80% do quadro) -> 512x512 WebP RGBA <= 60 KB."""
    os.makedirs(ICONS, exist_ok=True)
    tmp = os.path.join(os.environ.get("TEMP", "/tmp"), "icon_%s.png" % name)
    big = 1024
    shoot(show, tmp, (big, big), 24 if quick else 96, 22, 34, 70, margin=1.2, transparent=True, world_k=0.9)
    im = bpy.data.images.load(tmp)
    im.colorspace_settings.name = "sRGB"
    arr = np.array(im.pixels[:], dtype=np.float32).reshape(big, big, 4)
    bpy.data.images.remove(im)
    ys, xs = np.where(arr[..., 3] > 0.03)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    cy, cx = (y0 + y1) / 2.0, (x0 + x1) / 2.0
    side = max(y1 - y0 + 1, x1 - x0 + 1) / 0.80
    S = int(round(side))
    canvas = np.zeros((S, S, 4), dtype=np.float32)
    oy, ox = int(round(cy - S / 2.0)), int(round(cx - S / 2.0))
    sy0, sx0 = max(0, oy), max(0, ox)
    sy1, sx1 = min(big, oy + S), min(big, ox + S)
    canvas[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox] = arr[sy0:sy1, sx0:sx1]
    icon = resize_premult(canvas, 512)
    # a imagem aqui e a saida do render ja em sRGB (PNG de 8 bits): nao ha conversao de cor
    out = bpy.data.images.new("icon_" + name, 512, 512, alpha=True)
    out.alpha_mode = "STRAIGHT"
    out.pixels.foreach_set(np.clip(icon, 0, 1).astype(np.float32).ravel())
    out.update()
    path = os.path.join(ICONS, name + ".webp")
    out.file_format = "WEBP"
    sc = bpy.context.scene
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    final = None
    for q in (90, 84, 78, 72, 66, 60, 54, 48, 42, 36):
        sc.render.image_settings.quality = q
        out.save_render(path, scene=sc)
        sz = os.path.getsize(path)
        print("ICON %s q=%d size=%d" % (name, q, sz))
        if sz <= 58 * 1024:
            final = q
            break
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    return icon


def contact_sheet(icons, path):
    n = len(icons)
    cell = 400
    W, H = cell * n + 40 * (n + 1), cell + 80
    bg = np.array(list(bb.BG) + [1.0], dtype=np.float32)
    sheet = np.ones((H, W, 4), dtype=np.float32) * bg
    for i, ic in enumerate(icons):
        small = resize_premult(ic, cell)
        # metade escura, metade clara por icone: mostra como o alfa se comporta em fundos diferentes
        x = 40 + i * (cell + 40)
        y = 40
        region = sheet[y:y + cell, x:x + cell]
        a = small[..., 3:4]
        light = np.array([0.93, 0.88, 0.80, 1.0], dtype=np.float32)
        half = np.broadcast_to(region.copy(), region.shape).copy()
        half[:, cell // 2:] = light
        sheet[y:y + cell, x:x + cell] = np.concatenate([small[..., :3] * a + half[..., :3] * (1 - a), np.ones_like(a)], axis=2)
    im = bpy.data.images.new("sheet", W, H, alpha=False)
    im.pixels.foreach_set(sheet.ravel())
    im.update()
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    print("SHEET", path)


def render_all():
    quick = ARGS.quick
    W, H = (600, 400) if quick else (1200, 800)
    smp = 16 if quick else 96
    outdir = ARGS.renders
    os.makedirs(outdir, exist_ok=True)
    bb.clear_scene()
    bb.setup_scene(W, H, smp)
    allv = ARGS.views == "all"
    want = set(ARGS.views.split(",")) if not allv else set()

    def ok(k):
        return allv or (k in want)

    items = {}
    for n in PARTS:
        new, roots = import_glb(n)
        items[n] = (new, roots)
    everything = [o for v in items.values() for o in v[0]]
    singles = [("01-lata", "beb-lata", 20, 70), ("02-chopp", "beb-chopp", 18, 70), ("03-soda", "beb-soda", 18, 70),
               ("04-dadinho", "porcao-dadinho", 30, 62), ("05-batata", "porcao-batata", 26, 62)]
    for fname, n, el, lens in singles:
        if ok(fname[:2]):
            set_vis(items[n][0], everything)
            shoot(items[n][0], os.path.join(outdir, fname + ".png"), (W, H), smp, 22, el, lens, margin=1.22)
    icons = []
    if ok("icons"):
        scn = bpy.context.scene
        for n in PARTS:
            set_vis(items[n][0], everything)
            icons.append(make_icon(n, items[n][0], smp, quick))
        contact_sheet(icons, os.path.join(outdir, "00-icones.png"))
    if ok("06"):
        # mesa: tabua + lanche Costela montado + os 4 itens ao redor
        bpy.ops.wm.read_factory_settings(use_empty=True)
        for m in list(bpy.data.materials):
            bpy.data.materials.remove(m)
        bb.setup_scene(W, H, smp)
        parts = bb.import_parts()
        lid = parts["pao"]["lid"]
        lid.rotation_mode = "XYZ"
        lid.rotation_euler = (0.0, 0.0, 0.0)
        lanche = [o for n in ("tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado") for r in parts[n]["roots"] for o in bb.descend(r)]
        for o in parts["macarico"]["objs"]:
            o.hide_render = True
            o.hide_viewport = True
        placed = {}
        pose = {"beb-lata": (-0.290, -0.095, 0.0), "beb-chopp": (-0.290, 0.085, 200.0),
                "porcao-dadinho": (0.090, -0.255, 15.0), "porcao-batata": (0.300, -0.160, 25.0)}
        mine = []
        for n, (x, y, rz) in pose.items():
            new, roots = import_glb(n)
            for r in roots:
                r.location = (x, y, TABLE_Z)
                r.rotation_mode = "XYZ"
                r.rotation_euler = (r.rotation_euler[0], r.rotation_euler[1], r.rotation_euler[2] + math.radians(rz))
            mine += new
        shoot(lanche + mine, os.path.join(outdir, "06-mesa.png"), (W, H), smp, 16, 36, 58, margin=0.98, floor_z=TABLE_Z - 0.0004)


def main():
    stats = build_and_export()
    if stats:
        tot = sum(v[0] for v in stats.values())
        print("TOTAL %d bytes" % tot)
    if ARGS.views != "none":
        render_all()


main()
