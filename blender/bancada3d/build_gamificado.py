"""
LAR-449 (parte 1) - Modelos da bancada gamificada: mao de luva, bisnaga, pote com colher e gratinado novo.

Gera, por script e do zero (sem downloads):
  public/assets/models/bancada/mao-luva.glb     (raiz `mao_luva`: 5 poses, pivo no pulso)
  public/assets/models/bancada/bisnaga.glb      (raiz `bisnaga`)
  public/assets/models/bancada/pote-creme.glb   (raiz `pote_creme`: `pote` + `colher`)
  public/assets/models/bancada/gratinado.glb    (raiz `gratinado`, refeito: queijo gratinado continuo)
  <renders>/maos.png, bisnaga-acao.png, colher-acao.png, macarico-acao.png,
            gratinado-antes.png, gratinado-depois.png   (revisao, fora do repo)

    blender.exe -b --factory-startup -P build_gamificado.py -- [opcoes]

Opcoes:
    --renders DIR   pasta dos PNGs de revisao (fora do repo)
    --parts a,b     mao,bisnaga,pote,gratinado (padrao: todas; none = so renderiza dos GLBs existentes)
    --views a,b     maos,bisnaga,colher,macarico,gratinado (padrao: todas; none = nao renderiza)
    --antigo F      GLB do gratinado antigo para o render "antes" (padrao: <renders>/../gratinado-antigo.glb)
    --quick         renders menores, poucas amostras (iteracao)

A mao e modelada como campo de distancia (SDF) de cones arredondados (falanges), palma, tenar e antebraco,
com uniao suave na palma e uniao dura entre os dedos (sulcos). A malha sai de "surface nets" (numpy) com
projecao de Newton na superficie e decimacao. Os dedos fecham sobre a ferramenta por contato (cada junta
dobra ate encostar). Importa utilitarios de build_bancada.py sem executar nada dele.
"""
import bpy
import bmesh
import math
import os
import sys
import json
import random
import tempfile
import argparse
import importlib.util
import numpy as np
from mathutils import Vector, Matrix, Quaternion

_argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--renders", default=r"\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-449-modelos\renders")
ap.add_argument("--parts", default="all")
ap.add_argument("--views", default="all")
ap.add_argument("--antigo", default="")
ap.add_argument("--quick", action="store_true")
GA = ap.parse_args(_argv)

HERE = os.path.dirname(os.path.abspath(__file__))


def _load_base():
    saved = sys.argv
    sys.dont_write_bytecode = True
    sys.argv = ["build_bancada.py", "--", "--parts", "none", "--views", "none"]
    spec = importlib.util.spec_from_file_location("build_bancada", os.path.join(HERE, "build_bancada.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_bancada"] = mod
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.argv = saved
    return mod


bb = _load_base()
hexc, lerp, lerpc, clamp, smooth = bb.hexc, bb.lerp, bb.lerpc, bb.clamp, bb.smooth
MB, finish, make_mat, tri_count, root_empty = bb.MB, bb.finish, bb.make_mat, bb.tri_count, bb.root_empty
MODELS = bb.MODELS
ALL_PARTS = ["mao", "bisnaga", "pote", "gratinado"]
PARTS = ALL_PARTS if GA.parts == "all" else ([] if GA.parts == "none" else GA.parts.split(","))
ALL_VIEWS = ["maos", "bisnaga", "colher", "macarico", "gratinado"]
VIEWS = ALL_VIEWS if GA.views == "all" else ([] if GA.views == "none" else GA.views.split(","))
INFO_PATH = os.path.join(tempfile.gettempdir(), "lar449_info.json")
INFO = {}


# ============================================================================
# utilidades: conversao Blender (Z para cima) <-> glTF (Y para cima)
# ============================================================================
def v2g(v):
    """vetor Blender -> glTF (x, z, -y)."""
    return (v[0], v[2], -v[1])


def g2v(v):
    return Vector((v[0], -v[2], v[1]))


def q2g(q):
    """quaternion Blender (w,x,y,z) -> glTF (x,y,z,w) no espaco Y-up."""
    return (q.x, q.z, -q.y, q.w)


def g2q(xyzw):
    x, y, z, w = xyzw
    return Quaternion((w, x, -z, y))


def mat_doc(M):
    """matriz 4x4 Blender -> dict com posicao e rotacao em glTF."""
    loc, rot, _ = M.decompose()
    p = v2g(loc)
    q = q2g(rot)
    return dict(pos=[round(c, 4) for c in p], quat=[round(c, 4) for c in q])


def doc_to_mat(d):
    return Matrix.Translation(g2v(d["pos"])) @ g2q(d["quat"]).to_matrix().to_4x4()


def align(a_src, b_src, a_dst, b_dst):
    """rotacao R (3x3) com R a_src = a_dst e R b_src no plano (a_dst, b_dst)."""
    def frame(a, b):
        a = Vector(a).normalized()
        b = Vector(b)
        b = (b - a * a.dot(b)).normalized()
        c = a.cross(b)
        return Matrix((a, b, c)).transposed()
    return frame(a_dst, b_dst) @ frame(a_src, b_src).transposed()


def rodrigues(v, axis, ang):
    return Matrix.Rotation(ang, 3, Vector(axis).normalized()) @ Vector(v)


# ============================================================================
# SDF (numpy, componentes x, y, z separados e "broadcastaveis")
# ============================================================================
def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def to_local(P, o, R):
    """P = (x, y, z) no quadro pai; R (3x3, colunas = eixos locais no pai), o = origem local."""
    x, y, z = P[0] - o[0], P[1] - o[1], P[2] - o[2]
    return (x * R[0][0] + y * R[1][0] + z * R[2][0],
            x * R[0][1] + y * R[1][1] + z * R[2][1],
            x * R[0][2] + y * R[1][2] + z * R[2][2])


def sd_round_cone(P, a, b, r1, r2):
    """cone de pontas arredondadas (Inigo Quilez) entre a e b com raios r1, r2."""
    bax, bay, baz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    l2 = bax * bax + bay * bay + baz * baz
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pax, pay, paz = P[0] - a[0], P[1] - a[1], P[2] - a[2]
    y = pax * bax + pay * bay + paz * baz
    z = y - l2
    pp = pax * pax + pay * pay + paz * paz
    x2 = np.maximum(l2 * (l2 * pp - y * y), 0.0)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d1 = np.sqrt(x2 + z2) * il2 - r2
    d2 = np.sqrt(x2 + y2) * il2 - r1
    d3 = (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
    return np.where(np.sign(z) * a2 * z2 > k, d1, np.where(np.sign(y) * a2 * y2 < k, d2, d3))


def sd_ellipsoid(P, c, R, r):
    x, y, z = to_local(P, c, R)
    k0 = np.sqrt((x / r[0]) ** 2 + (y / r[1]) ** 2 + (z / r[2]) ** 2)
    k1 = np.sqrt((x / r[0] ** 2) ** 2 + (y / r[1] ** 2) ** 2 + (z / r[2] ** 2) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sd_round_box(P, c, R, b, rad):
    x, y, z = to_local(P, c, R)
    qx, qy, qz = np.abs(x) - b[0], np.abs(y) - b[1], np.abs(z) - b[2]
    out = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2 + np.maximum(qz, 0) ** 2)
    return out + np.minimum(np.maximum(qx, np.maximum(qy, qz)), 0.0) - rad


def sd_capped_cyl(P, c, R, r, h):
    """cilindro de raio r, eixo = x local, meia altura h."""
    x, y, z = to_local(P, c, R)
    dr = np.sqrt(y * y + z * z) - r
    dh = np.abs(x) - h
    return np.minimum(np.maximum(dr, dh), 0.0) + np.sqrt(np.maximum(dr, 0) ** 2 + np.maximum(dh, 0) ** 2)


I3 = ((1, 0, 0), (0, 1, 0), (0, 0, 1))


def mrows(M):
    """Matrix 3x3 -> tupla de linhas (para to_local)."""
    return tuple(tuple(M[i][j] for j in range(3)) for i in range(3))


# ============================================================================
# MAO: esqueleto (quadro da mao: X = dedos, Y = lado do polegar, Z = dorso; pulso na origem)
# ============================================================================
# mao direita adulta: palma ~9 cm de largura (com a luva), dedo medio ~8 cm, mao ~19 cm
FINGERS = [
    # nome, nodulo MCP, desvio (graus em Z), comprimentos das falanges, raios (MCP, PIP, DIP, ponta)
    ("indicador", (0.091, 0.0300, 0.0045), 2.5, (0.041, 0.024, 0.0205), (0.0106, 0.0097, 0.0087, 0.0077)),
    ("medio", (0.095, 0.0098, 0.0055), 0.0, (0.046, 0.028, 0.0215), (0.0109, 0.0100, 0.0089, 0.0078)),
    ("anelar", (0.091, -0.0102, 0.0040), -2.5, (0.043, 0.026, 0.0205), (0.0103, 0.0094, 0.0084, 0.0074)),
    ("minimo", (0.081, -0.0285, 0.0018), -7.0, (0.033, 0.0205, 0.0185), (0.0093, 0.0085, 0.0077, 0.0068)),
]
THUMB_BASE = (0.021, 0.022, -0.004)
THUMB_L = (0.045, 0.031, 0.027)
THUMB_R = (0.0140, 0.0124, 0.0113, 0.0097)
FLAT = 1.12            # achatamento dorso-palmar dos dedos
MAXF = (88.0, 105.0, 75.0)


def bend(d, n, ang):
    c, s = math.cos(ang), math.sin(ang)
    return (d * c - n * s).normalized(), (n * c + d * s).normalized()


def finger_chain(base, d, n, L, r, flex):
    """pontos das juntas: base (MCP), PIP, DIP, fim do cone distal (ponta - raio)."""
    pts = [Vector(base)]
    dirs = []
    for i in range(3):
        d, n = bend(d, n, math.radians(flex[i]))
        ln = L[i] - (r[3] if i == 2 else 0.0)
        pts.append(pts[-1] + d * ln)
        dirs.append((d.copy(), n.copy()))
    return pts, dirs


class Hand:
    """Pose da mao: angulos dos dedos, polegar, concha da palma e pulso."""

    def __init__(self, flex, abd, thumb, tflex, cup=4.0, wrist=(0.0, 0.0)):
        self.flex = [list(f) for f in flex]     # 4 dedos x (MCP, PIP, DIP) em graus
        self.abd = list(abd)                    # 4 dedos, graus extras em Z (+ = para o polegar)
        self.thumb = thumb                      # (direcao, direcao de flexao) do polegar
        self.tflex = list(tflex)                # (MCP, IP)
        self.cup = cup                          # concha da palma (1/m): z += -cup * y^2
        self.wrist = wrist                      # (extensao, desvio) em graus

    # --- quadro de cada dedo (com a concha da palma)
    def finger_base(self, i):
        name, K, yaw, L, r = FINGERS[i]
        K = Vector(K)
        K.z -= self.cup * K.y * K.y
        a = math.radians(yaw + self.abd[i])
        d = Vector((math.cos(a), math.sin(a), 0.0))
        n = Vector((0.0, 0.0, 1.0))
        tilt = -math.atan(2 * self.cup * K.y)
        Rx = Matrix.Rotation(tilt, 3, "X")
        return K, (Rx @ d).normalized(), (Rx @ n).normalized(), L, r

    def finger(self, i, flex=None):
        K, d, n, L, r = self.finger_base(i)
        return finger_chain(K, d, n, L, r, flex if flex is not None else self.flex[i])

    def thumb_frame(self):
        """thumb = (direcao do metacarpo, direcao para onde o polegar dobra), no quadro da mao."""
        d = Vector(self.thumb[0]).normalized()
        f = Vector(self.thumb[1])
        n = -(f - d * d.dot(f)).normalized()
        return Vector(THUMB_BASE), d, n

    def thumb_chain(self, tflex=None):
        tf = tflex if tflex is not None else self.tflex
        B, d, n = self.thumb_frame()
        pts = [B]
        dirs = []
        for i, ang in enumerate((0.0, tf[0], tf[1])):
            d, n = bend(d, n, math.radians(ang))
            ln = THUMB_L[i] - (THUMB_R[3] if i == 2 else 0.0)
            pts.append(pts[-1] + d * ln)
            dirs.append((d.copy(), n.copy()))
        return pts, dirs

    def wrist_R(self):
        ext, dev = [math.radians(a) for a in self.wrist]
        return Matrix.Rotation(dev, 3, "Z") @ Matrix.Rotation(ext, 3, "Y")

    def forearm_dir(self):
        """direcao do pulso para o cotovelo, no quadro da mao."""
        return (self.wrist_R() @ Vector((-1, 0, 0))).normalized()


# --- antebraco / punho da luva (quadro do antebraco: x para a mao; o braco vai para -x)
CUFF_END = -0.0795
CUFF_ROLL = -0.0780


def cuff_axes(xf):
    """meios-eixos (largura, espessura) da luva no antebraco."""
    t = np.clip(-xf / 0.04, 0.0, 1.0)
    a = 0.0275 + 0.0030 * t
    b = 0.0185 + 0.0020 * t
    f = np.clip((-xf - 0.040) / 0.015, 0.0, 1.0)
    f = f * f * (3 - 2 * f)
    return a + (0.0338 - a) * f, b + (0.0262 - b) * f


SLEEVE_X0, SLEEVE_X1 = -0.056, -0.148


def sleeve_axes(xf):
    t = (SLEEVE_X0 - xf) / (SLEEVE_X0 - SLEEVE_X1)
    return 0.0308 + 0.0052 * t, 0.0234 + 0.0050 * t


class HandSDF:
    """Campo de distancia da luva (mao + punho) para uma pose."""

    def __init__(self, H, wrinkles=True):
        self.H = H
        self.wr = wrinkles
        self.fingers = [H.finger(i) for i in range(4)]
        self.thumb = H.thumb_chain()
        self.W = H.wrist_R()
        self.Wr = mrows(self.W)
        a = math.radians(30)
        self.R_thenar = mrows(Matrix.Rotation(a, 3, "Z"))
        self.R_hypo = mrows(Matrix.Rotation(math.radians(-8), 3, "Z"))

    def palm(self, P):
        x, y, z = P
        zc = z + self.H.cup * y * y
        Q = (x, y, zc)
        # largura da palma cresce do pulso para os nodulos
        w = 0.0225 + 0.0085 * np.clip((x - 0.010) / 0.075, 0.0, 1.0) ** 0.8
        ys = y * (0.0225 / w)
        # dorso abaulado: o centro sobe um pouco
        zd = zc - 0.0022 * np.exp(-(ys / 0.018) ** 2) * np.clip((z + 0.004) / 0.008, 0.0, 1.0)
        d = sd_round_box((x, ys, zd), (0.0515, 0.0, -0.0020), I3, (0.0370, 0.0225, 0.0030), 0.0105)
        d = d * np.minimum(w / 0.0225, 1.0)
        d = smin(d, sd_ellipsoid(Q, (0.033, 0.0255, -0.0095), self.R_thenar, (0.031, 0.0170, 0.0130)), 0.011)
        d = smin(d, sd_ellipsoid(Q, (0.040, -0.0270, -0.0075), self.R_hypo, (0.035, 0.0120, 0.0110)), 0.011)
        d = smin(d, sd_ellipsoid(Q, (0.084, 0.0, -0.0085), I3, (0.014, 0.035, 0.0088)), 0.008)
        return d

    def web(self, P):
        """membrana entre polegar e indicador."""
        a = self.thumb[0][1] * 0.55 + self.thumb[0][0] * 0.45
        b = Vector((0.070, 0.031, -0.002))
        return sd_round_cone(P, a, b, 0.0085, 0.0075)

    def forearm(self, P):
        xf, yf, zf = to_local(P, (0, 0, 0), self.Wr)
        a, b = cuff_axes(xf)
        rn = np.sqrt((yf / a) ** 2 + (zf / b) ** 2)
        d = (rn - 1.0) * np.minimum(a, b)
        if self.wr:
            th = np.arctan2(zf / b, yf / a)
            env = np.clip((-xf - 0.010) / 0.012, 0, 1) * np.clip((-xf + 0.046) / 0.010, 0, 1)
            env = env * (0.55 + 0.45 * np.sin(3 * th + 1.1) * np.sin(2 * th - 0.4))
            ph = 2 * math.pi * xf / 0.0095 + 1.6 * np.sin(2 * th + 0.7) + 0.9 * np.sin(5 * th + 2.0) + 40 * xf * np.sin(th)
            d = d + 0.00024 * env * np.sin(ph)
        d = np.maximum(d, np.maximum(xf - 0.006, CUFF_END - xf))
        # borda enrolada
        ra, rb = cuff_axes(np.full_like(xf, CUFF_ROLL) if np.ndim(xf) else CUFF_ROLL)
        rad = (np.sqrt((yf / ra) ** 2 + (zf / rb) ** 2) - 1.0) * (ra + rb) * 0.5 - 0.0004
        roll = np.sqrt(rad * rad + (xf - CUFF_ROLL) ** 2) - 0.0017
        return smin(d, roll, 0.0012)

    def crease(self, P, J, d, n, ang, amp=0.00045):
        """vinco na face palmar de uma junta dobrada."""
        if ang < 12:
            return 0.0
        x, y, z = P[0] - J[0], P[1] - J[1], P[2] - J[2]
        s = x * d[0] + y * d[1] + z * d[2]
        h = -(x * n[0] + y * n[1] + z * n[2])
        g = np.exp(-(s / 0.0012) ** 2) * np.clip((h - 0.002) / 0.004, 0, 1)
        return amp * min(1.0, (ang - 12) / 30) * g

    def seg_flat(self, P, a, b, ra, rb, n):
        """cone arredondado com secao achatada na direcao n (dorso-palmar)."""
        x, y, z = P[0] - a[0], P[1] - a[1], P[2] - a[2]
        h = x * n[0] + y * n[1] + z * n[2]
        k = FLAT - 1.0
        Q = (P[0] + k * h * n[0], P[1] + k * h * n[1], P[2] + k * h * n[2])
        return sd_round_cone(Q, a, b, ra, rb) / (1.0 + 0.5 * k)

    def finger_sdf(self, P, pts, dirs, r, flex):
        d = self.seg_flat(P, pts[0], pts[1], r[0], r[1], dirs[0][1])
        d = np.minimum(d, self.seg_flat(P, pts[1], pts[2], r[1], r[2], dirs[1][1]))
        d = np.minimum(d, self.seg_flat(P, pts[2], pts[3], r[2], r[3], dirs[2][1]))
        if self.wr:
            for j in (1, 2):
                dm = (dirs[j - 1][0] + dirs[j][0]).normalized()
                nm = (dirs[j - 1][1] + dirs[j][1]).normalized()
                d = d + self.crease(P, pts[j], dm, nm, flex[j])
        return d

    def thumb_sdf(self, P):
        pts, dirs = self.thumb
        d = sd_round_cone(P, pts[0], pts[1], THUMB_R[0], THUMB_R[1])
        d = np.minimum(d, sd_round_cone(P, pts[1], pts[2], THUMB_R[1], THUMB_R[2]))
        d = np.minimum(d, sd_round_cone(P, pts[2], pts[3], THUMB_R[2], THUMB_R[3]))
        if self.wr:
            dm = (dirs[1][0] + dirs[2][0]).normalized()
            nm = (dirs[1][1] + dirs[2][1]).normalized()
            d = d + self.crease(P, pts[2], dm, nm, self.H.tflex[1])
        return d

    def fingers_sdf(self, P):
        d = None
        for i in range(4):
            pts, dirs = self.fingers[i]
            df = self.finger_sdf(P, pts, dirs, FINGERS[i][4], self.H.flex[i])
            d = df if d is None else np.minimum(d, df)
        return d

    def __call__(self, P):
        palm = smin(self.palm(P), self.web(P), 0.010)
        d = smin(palm, self.thumb_sdf(P), 0.012)
        d = smin(d, self.fingers_sdf(P), 0.0055)
        d = smin(d, self.forearm(P), 0.013)
        return d

    def bounds(self):
        pts = [Vector((0.0, 0.0, 0.0))]
        for pp, _ in self.fingers:
            pts += pp
        pts += self.thumb[0]
        for x in (0.0, CUFF_END - 0.004):
            for s in (-1, 1):
                for t in (-1, 1):
                    pts.append(self.W @ Vector((x, s * 0.042, t * 0.034)))
        pts += [Vector((0.10, 0.045, -0.03)), Vector((0.10, -0.045, -0.03)), Vector((0.0, 0.04, -0.03))]
        mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))) - Vector((0.016,) * 3)
        mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))) + Vector((0.016,) * 3)
        return mn, mx


# ============================================================================
# fechamento dos dedos por contato
# ============================================================================
def seg_samples(a, b, ra, rb, t0=0.0, n=9):
    ts = np.linspace(t0, 1.0, n)
    P = np.outer(1 - ts, np.array(a)) + np.outer(ts, np.array(b))
    return P, ra + (rb - ra) * ts


RATIO = (1.0, 1.15, 0.75)


def chain_clear_seg(pts, radii, obst, s, palm=None):
    P, R = seg_samples(pts[s], pts[s + 1], radii[s], radii[s + 1], 0.3 if s == 0 else 0.0)
    X = (P[:, 0], P[:, 1], P[:, 2])
    g = obst(X) - R
    if palm is not None and s >= 1:
        g = np.minimum(g, palm(X) - R + 0.0015)
    return float(g.min())


def close_chain(chain_fn, radii, nj, seg_of_joint, obst, start, maxf, gap, palm=None, ratio=RATIO, step=0.8):
    """fecha as juntas juntas (sinergia); quando um segmento encosta, congela as juntas que o movem."""
    flex = list(start)
    active = [True] * nj
    for _ in range(600):
        if not any(active):
            break
        trial = [min(maxf[j], flex[j] + step * ratio[j]) if active[j] else flex[j] for j in range(nj)]
        pts = chain_fn(trial)
        hit = None
        for j in range(nj):
            if chain_clear_seg(pts, radii, obst, seg_of_joint[j], palm) < gap:
                hit = j
                break
        if hit is not None:
            for j in range(hit + 1):
                active[j] = False
            continue
        flex = trial
        for j in range(nj):
            if active[j] and flex[j] >= maxf[j]:
                active[j] = False
    return flex


def close_finger(H, i, obst, start, maxf=MAXF, gap=-0.0006, palm=None):
    K, d, n, L, r = H.finger_base(i)

    def fn(fl):
        return finger_chain(K, d, n, L, r, fl)[0]
    return close_chain(fn, r, 3, (0, 1, 2), obst, start, maxf, gap, palm)


def close_thumb(H, obst, start, maxf=(60.0, 80.0), gap=-0.0006):
    def fn(tf):
        return H.thumb_chain(tf)[0]
    return close_chain(fn, THUMB_R, 2, (1, 2), obst, start, maxf, gap, ratio=(1.0, 1.0))


# ============================================================================
# malha: surface nets + projecao de Newton + decimacao
# ============================================================================
def surface_nets(F, origin, h):
    nx, ny, nz_ = F.shape
    acc = np.zeros((nx - 1, ny - 1, nz_ - 1, 3), np.float32)
    cnt = np.zeros((nx - 1, ny - 1, nz_ - 1), np.float32)
    neg = F < 0
    # arestas em x
    fa, fb = F[:-1], F[1:]
    m = neg[:-1] != neg[1:]
    t = np.where(m, fa / np.where(m, fa - fb, 1.0), 0.0).astype(np.float32)
    for dj in (0, 1):
        for dk in (0, 1):
            me = m[:, dj:dj + ny - 1, dk:dk + nz_ - 1]
            acc[..., 0] += np.where(me, t[:, dj:dj + ny - 1, dk:dk + nz_ - 1], 0)
            acc[..., 1] += me * dj
            acc[..., 2] += me * dk
            cnt += me
    mx = m
    fa, fb = F[:, :-1], F[:, 1:]
    m = neg[:, :-1] != neg[:, 1:]
    t = np.where(m, fa / np.where(m, fa - fb, 1.0), 0.0).astype(np.float32)
    for di in (0, 1):
        for dk in (0, 1):
            me = m[di:di + nx - 1, :, dk:dk + nz_ - 1]
            acc[..., 0] += me * di
            acc[..., 1] += np.where(me, t[di:di + nx - 1, :, dk:dk + nz_ - 1], 0)
            acc[..., 2] += me * dk
            cnt += me
    my = m
    fa, fb = F[:, :, :-1], F[:, :, 1:]
    m = neg[:, :, :-1] != neg[:, :, 1:]
    t = np.where(m, fa / np.where(m, fa - fb, 1.0), 0.0).astype(np.float32)
    for di in (0, 1):
        for dj in (0, 1):
            me = m[di:di + nx - 1, dj:dj + ny - 1, :]
            acc[..., 0] += me * di
            acc[..., 1] += me * dj
            acc[..., 2] += np.where(me, t[di:di + nx - 1, dj:dj + ny - 1, :], 0)
            cnt += me
    mz = m
    act = cnt > 0
    vid = -np.ones(cnt.shape, np.int64)
    idx = np.argwhere(act)
    vid[act] = np.arange(len(idx))
    loc = acc[act] / cnt[act][:, None]
    V = origin[None, :] + (idx + loc) * h
    faces = []
    # x: celulas (i, j-1..j, k-1..k)
    I, J, K = np.nonzero(mx[:, 1:ny - 1, 1:nz_ - 1])
    J += 1
    K += 1
    inside = neg[I, J, K]
    q = np.stack([vid[I, J - 1, K - 1], vid[I, J, K - 1], vid[I, J, K], vid[I, J - 1, K]], 1)
    q[~inside] = q[~inside][:, ::-1]
    faces.append(q)
    I, J, K = np.nonzero(my[1:nx - 1, :, 1:nz_ - 1])
    I += 1
    K += 1
    inside = neg[I, J, K]
    q = np.stack([vid[I - 1, J, K - 1], vid[I - 1, J, K], vid[I, J, K], vid[I, J, K - 1]], 1)
    q[~inside] = q[~inside][:, ::-1]
    faces.append(q)
    I, J, K = np.nonzero(mz[1:nx - 1, 1:ny - 1, :])
    I += 1
    J += 1
    inside = neg[I, J, K]
    q = np.stack([vid[I - 1, J - 1, K], vid[I, J - 1, K], vid[I, J, K], vid[I - 1, J, K]], 1)
    q[~inside] = q[~inside][:, ::-1]
    faces.append(q)
    Fc = np.concatenate(faces, 0)
    Fc = Fc[(Fc >= 0).all(1)]
    return V, Fc


def project(V, sdf, iters=3, eps=0.0002):
    V = V.astype(np.float64)
    for _ in range(iters):
        X = (V[:, 0], V[:, 1], V[:, 2])
        d = sdf(X)
        gx = (sdf((V[:, 0] + eps, V[:, 1], V[:, 2])) - d) / eps
        gy = (sdf((V[:, 0], V[:, 1] + eps, V[:, 2])) - d) / eps
        gz = (sdf((V[:, 0], V[:, 1], V[:, 2] + eps)) - d) / eps
        g2 = gx * gx + gy * gy + gz * gz + 1e-12
        step = np.clip(d / g2, -0.0006, 0.0006)
        V = V - np.stack([gx, gy, gz], 1) * step[:, None]
    return V


def sdf_mesh(sdf, mn, mx, h, target_tris, name):
    nxyz = [int(math.ceil((mx[i] - mn[i]) / h)) + 1 for i in range(3)]
    xs = (mn[0] + np.arange(nxyz[0]) * h).astype(np.float32)
    ys = (mn[1] + np.arange(nxyz[1]) * h).astype(np.float32)
    zs = (mn[2] + np.arange(nxyz[2]) * h).astype(np.float32)
    F = np.empty(nxyz, np.float32)
    for i0 in range(0, nxyz[0], 24):
        i1 = min(nxyz[0], i0 + 24)
        F[i0:i1] = sdf((xs[i0:i1, None, None], ys[None, :, None], zs[None, None, :]))
    V, Fc = surface_nets(F, np.array(mn, np.float64), h)
    V = project(V, sdf)
    me = bpy.data.meshes.new(name + "_raw")
    me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in Fc])
    me.validate()
    ob = bpy.data.objects.new(name + "_raw", me)
    bpy.context.scene.collection.objects.link(ob)
    n_tris = 2 * len(Fc)
    dec = ob.modifiers.new("dec", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = min(1.0, target_tris / max(1, n_tris))
    dec.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    Vd = [tuple(v.co) for v in me2.vertices]
    Fd = [tuple(p.vertices) for p in me2.polygons]
    bpy.data.meshes.remove(me2)
    print("SDF %s: grade %s, %d -> %d tris" % (name, nxyz, n_tris, len(Fd)))
    return Vd, Fd


# ============================================================================
# manga do dolma (tecido preto), no quadro do antebraco
# ============================================================================
def sleeve_mb(mb, W, seed, color, cap_color, nseg=28, nring=11):
    rng = random.Random(seed)
    ph = [rng.uniform(0, 6.28) for _ in range(6)]
    rings = []
    xs = [SLEEVE_X0 + (SLEEVE_X1 - SLEEVE_X0) * (i / (nring - 1)) ** 1.15 for i in range(nring)]
    for x in xs:
        a, b = sleeve_axes(x)
        t = (SLEEVE_X0 - x) / (SLEEVE_X0 - SLEEVE_X1)
        ring = []
        for k in range(nseg):
            th = 2 * math.pi * k / nseg
            # dobras macias: longitudinais + diagonais, mais fortes perto do punho (tecido franzido)
            f = 1.0 + 0.030 * math.sin(5 * th + ph[0] + 6 * t) + 0.018 * math.sin(3 * th + ph[1] - 9 * t)
            f += 0.026 * math.exp(-((x - (SLEEVE_X0 - 0.030)) / 0.012) ** 2) * math.sin(7 * th + ph[2])
            f += 0.016 * math.exp(-((x - (SLEEVE_X0 - 0.052)) / 0.010) ** 2) * math.sin(6 * th + ph[4])
            f += 0.012 * math.sin(2 * th + 22 * x + ph[3])
            p = W @ Vector((x, a * f * math.cos(th), b * f * math.sin(th)))
            ring.append(mb.add(p, color))
        rings.append(ring)
    axis = W @ Vector((1, 0, 0))

    def oface(idx, want):
        P = [Vector(mb.v[i]) for i in idx]
        nrm = (P[1] - P[0]).cross(P[2] - P[0])
        mb.face(*(idx if nrm.dot(want) >= 0 else idx[::-1]), m=1)

    def radial(i):
        p = Vector(mb.v[i])
        return p - axis * p.dot(axis)
    for i in range(nring - 1):
        for k in range(nseg):
            k2 = (k + 1) % nseg
            q = (rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2])
            oface(q, radial(q[0]))
    # corte limpo no fim: boca da manga (parede de ~2 mm e interior escuro), vertices proprios
    x = xs[-1]
    inv = W.inverted()
    lip, inner, deep = [], [], []
    for k in range(nseg):
        p = inv @ Vector(mb.v[rings[-1][k]])
        rr = math.hypot(p.y, p.z)
        sc = max(0.0, rr - 0.0022) / rr
        lip.append(mb.add(W @ p, color))
        inner.append(mb.add(W @ Vector((p.x, p.y * sc, p.z * sc)), cap_color))
        deep.append(mb.add(W @ Vector((p.x + 0.012, p.y * sc * 0.96, p.z * sc * 0.96)), cap_color))
    c = mb.add(W @ Vector((x + 0.012, 0, 0)), cap_color)
    for k in range(nseg):
        k2 = (k + 1) % nseg
        oface((lip[k], lip[k2], inner[k2], inner[k]), -axis)
        oface((inner[k], inner[k2], deep[k2], deep[k]), -radial(inner[k]))
        oface((c, deep[k], deep[k2]), -axis)


# ============================================================================
# FERRAMENTAS (quadros locais em coordenadas Blender; ver README para glTF)
# ============================================================================
BIS_R = 0.0290
BIS_H = 0.190
BIS_TIP = (0.0, 0.0, BIS_H)


def bottle_sdf_local(X):
    return sd_capped_cyl(X, (0.0, 0.0, 0.069), ((0, 0, 1), (0, 1, 0), (-1, 0, 0)), BIS_R, 0.069)


# macarico-mao.glb: frame "pre" do build_extras (x = eixo do cartucho, bico em +x, gatilho em -z)
PITCH = math.radians(35.0)
ROT = Matrix.Rotation(-PITCH, 4, "Y") @ Matrix.Rotation(math.pi, 4, "Z")
TIP_X = 0.136
TIP_GLB = Vector((-0.1010, 0.0, -0.0703))          # ponta do bico em coords Blender do GLB (README)
CEN = (ROT @ Vector((TIP_X, 0, 0))) - TIP_GLB       # centro usado na exportacao
M_PRE_TO_GLB = Matrix.Translation(-CEN) @ ROT       # p_glb = ROT p_pre - cen


def torch_sdf_pre(X):
    d = sd_capped_cyl(X, (-0.041, 0, 0), I3, 0.0146, 0.051)
    d = np.minimum(d, sd_capped_cyl(X, (0.014, 0, 0), I3, 0.0096, 0.006))
    d = np.minimum(d, sd_ellipsoid(X, (0.0405, 0.0, 0.0008), I3, (0.0240, 0.0132, 0.0150)))
    d = np.minimum(d, sd_ellipsoid(X, (0.0355, 0.0, -0.0205), I3, (0.0108, 0.0064, 0.0124)))
    d = np.minimum(d, sd_capped_cyl(X, (0.10, 0, 0), I3, 0.0060, 0.036))
    return d


# colher: quadro local com x ao longo do cabo (concha em -x), z = lado concavo; origem = pivo do cabo
SP_BOWL_C = -0.1025
SP_BOWL_A = 0.0275
SP_BOWL_W = 0.0200
SP_BOWL_D = 0.0085
SP_GRIP = 0.012            # x (no quadro de modelagem) do pivo do cabo
SP_END = 0.045


def sp_axis_z(x):
    return 0.0115 * smooth(-0.082, -0.022, x) - 0.0035 * smooth(-0.01, SP_END, x)


def spoon_sdf_local(X):
    """cabo da colher (quadro local com origem no pivo)."""
    x0, x1 = -0.062 - SP_GRIP, SP_END - SP_GRIP
    return sd_round_box(X, ((x0 + x1) / 2, 0.0, 0.0), I3, ((x1 - x0) / 2, 0.0068, 0.0002), 0.0014)


# ============================================================================
# poses
# ============================================================================
G15 = Vector((math.sin(math.radians(15)), math.cos(math.radians(15)), 0.0))   # eixo de empunhadura na palma


def tool_rot(a_t, b_t, a_h, b_h):
    return align(a_t, b_t, a_h, b_h)


def place_tool(sdf_local, Rt, ref_t, ref_h, H, push=-0.0004):
    """posiciona a ferramenta (rotacao Rt, ponto ref_t -> ref_h) e a desliza ao longo de -Z da mao ate
    encostar na palma. Devolve (Rt, t) com p_h = Rt p_t + t."""
    hs = HandSDF(H, wrinkles=False)
    gx, gy, gz = np.meshgrid(np.linspace(0.005, 0.10, 34), np.linspace(-0.05, 0.05, 30), np.linspace(-0.035, 0.0, 16), indexing="ij")
    X = (gx.ravel(), gy.ravel(), gz.ravel())
    dp = hs.palm(X)
    dp = smin(dp, hs.thumb_sdf(X), 0.012)
    sel = np.abs(dp) < 0.0012
    S = np.stack([X[0][sel], X[1][sel], X[2][sel]], 1)
    Rm = Matrix(Rt)
    Rr = mrows(Rm)

    def clearance(t):
        Y = (S[:, 0] - t[0], S[:, 1] - t[1], S[:, 2] - t[2])
        L = to_local(Y, (0, 0, 0), Rr)
        return float(sdf_local(L).min())
    base = Vector(ref_h) - Rm @ Vector(ref_t)
    lo, hi = -0.05, 0.05
    for _ in range(40):
        mid = (lo + hi) / 2
        t = base + Vector((0, 0, mid))
        if clearance(t) < push:
            hi = mid
        else:
            lo = mid
    t = base + Vector((0, 0, lo))
    return Rm, t


def make_obst(sdf_local, Rm, t):
    Rr = mrows(Rm)

    def f(X):
        Y = (X[0] - t[0], X[1] - t[1], X[2] - t[2])
        return sdf_local(to_local(Y, (0, 0, 0), Rr))
    return f


def finger_obst(H, extra=None):
    """dedos como obstaculo para o polegar."""
    hs = HandSDF(H, wrinkles=False)

    def f(X):
        d = hs.fingers_sdf(X)
        return d if extra is None else np.minimum(d, extra(X))
    return f


def palm_obst(H):
    hs = HandSDF(H, wrinkles=False)
    return hs.palm


def pose_bisnaga():
    H = Hand(flex=[[0, 0, 0]] * 4, abd=[-2, 0, 1, 3], thumb=((-0.15, 0.32, -1.0), (1.0, 0.0, -0.1)), tflex=(5, 5), cup=6.0, wrist=(8, -30))
    # bisnaga de cabeca para baixo: +z da bisnaga (base -> bico) para o lado do minimo; eixo na palma
    Rt = tool_rot(Vector((0, 0, 1)), Vector((0, -1, 0)), -G15, Vector((0, 0, -1)))
    Rm, t = place_tool(bottle_sdf_local, Rt, (0, 0, 0.074), (0.074, 0.0, -0.05), H)
    ob = make_obst(bottle_sdf_local, Rm, t)
    pal = palm_obst(H)
    for i in range(4):
        H.flex[i] = close_finger(H, i, ob, [6, 4, 2], palm=pal)
    H.tflex = close_thumb(H, lambda X: np.minimum(ob(X), finger_obst(H)(X)), H.tflex)
    return H, Rm, t


def pose_macarico():
    H = Hand(flex=[[0, 0, 0]] * 4, abd=[9, 1, -1, -2], thumb=((0.40, 0.75, -0.55), (0.1, -0.2, -1.0)), tflex=(4, 4), cup=5.0, wrist=(25, 35))
    trig = rodrigues(Vector((0, 0, -1)), Vector((0, 1, 0)), math.radians(-18))
    Rt = tool_rot(Vector((1, 0, 0)), Vector((0, 0, -1)), G15, trig)
    Rm, t = place_tool(torch_sdf_pre, Rt, (-0.012, 0, 0), (0.074, 0.0, -0.04), H)
    ob = make_obst(torch_sdf_pre, Rm, t)
    pal = palm_obst(H)
    starts = [[4, 4, 2], [6, 4, 2], [6, 4, 2], [6, 4, 2]]
    for i in range(4):
        H.flex[i] = close_finger(H, i, ob, starts[i], palm=pal)
    H.tflex = close_thumb(H, lambda X: np.minimum(ob(X), finger_obst(H)(X)), H.tflex, maxf=(40, 45))
    # o macarico fica na orientacao de uso (rotacao identidade): o pulso leva o antebraco o mais perto
    # possivel de ARM, dentro de limites confortaveis
    Rp = world_rot("mao_macarico", H, Rm, t)
    f = Rp.inverted() @ ARM
    e = math.degrees(math.asin(max(-1.0, min(1.0, f.z))))
    d = math.degrees(math.atan2(-f.y, -f.x))
    H.wrist = (max(-35.0, min(35.0, e)), max(-30.0, min(28.0, d)))
    return H, Rm, t


def pose_colher():
    """colher empunhada no punho (cabo atravessando a palma), concha saindo do lado do polegar,
    lado concavo para o dorso: as costas da concha espalham o creme."""
    H = Hand(flex=[[0, 0, 0]] * 4, abd=[-1, 0, 1, 2], thumb=((0.30, 0.22, -1.0), (1.0, -0.25, 0.0)), tflex=(5, 5),
             cup=6.0, wrist=(12, 18))
    # gira a colher no punho para o lado concavo ficar para cima no mundo (as costas da concha no pao)
    Rp = world_rot("mao_colher", H, None, None)
    up_h = Rp.inverted() @ Vector((0, 0, 1))
    Rt = tool_rot(Vector((-1, 0, 0)), Vector((0, 0, 1)), G15, up_h)
    Rm, t = place_tool(spoon_sdf_local, Rt, (0.0, 0.0, 0.0), (0.070, 0.0, -0.03), H, push=-0.0002)
    ob = make_obst(spoon_sdf_local, Rm, t)
    pal = palm_obst(H)
    for i in range(4):
        H.flex[i] = close_finger(H, i, ob, [8, 8, 4], palm=pal)
    H.tflex = close_thumb(H, lambda X: np.minimum(ob(X), finger_obst(H)(X)), H.tflex, maxf=(50, 60))
    return H, Rm, t


def pose_punhado():
    H = Hand(flex=[[38, 50, 28], [42, 54, 30], [45, 56, 30], [48, 58, 32]], abd=[-3, 0, 2, 4],
             thumb=((0.55, 0.35, -0.78), (0.3, -0.7, -0.4)), tflex=(18, 24), cup=9.0, wrist=(16, -4))
    return H, None, None


def pose_aberta():
    H = Hand(flex=[[8, 12, 6], [10, 14, 7], [12, 16, 8], [15, 18, 9]], abd=[3, 0, -3, -6],
             thumb=((0.78, 0.55, -0.24), (-0.1, -0.6, -0.6)), tflex=(10, 14), cup=5.0, wrist=(12, -4))
    return H, None, None


ARM = Vector((0.86, -0.15, 0.48)).normalized()          # direcao do antebraco (pulso -> cotovelo) na raiz
BOWL_DIR = Vector((-0.66, -0.52, -0.45)).normalized()   # para onde a concha aponta (mao_colher)


def world_rot(name, H, Rm, t):
    """R_pose (mao -> raiz) de cada pose."""
    fa = H.forearm_dir()
    if name == "mao_bisnaga":
        return align(Rm @ Vector((0, 0, 1)), fa, Vector((0, 0, -1)), ARM)
    if name == "mao_macarico":
        Mt = Rm.to_4x4() @ M_PRE_TO_GLB.inverted()
        return Mt.to_3x3().inverted()
    if name == "mao_colher":
        return align(G15, fa, BOWL_DIR, ARM)
    return align(fa, Vector((0, 0, 1)), ARM, Vector((0.0, 0.25, 1.0)))


POSES = [("mao_bisnaga", pose_bisnaga), ("mao_colher", pose_colher), ("mao_macarico", pose_macarico),
         ("mao_punhado", pose_punhado), ("mao_aberta", pose_aberta)]


# ============================================================================
# construcao da mao
# ============================================================================
C_GLOVE = hexc("#0B0B0C")
C_SLEEVE = hexc("#121214")
C_SLEEVE_CUT = hexc("#050505")


def glove_mats():
    mg = make_mat("mat_luva_nitrilo", rough=0.42, spec=0.5, coat=0.18)
    try:
        mg.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.34
    except KeyError:
        pass
    ms = make_mat("mat_dolma", rough=0.82, spec=0.3)
    return mg, ms


def build_mao(root, quick=False):
    mg, ms = glove_mats()
    objs = []
    info = {}
    target = 5150
    h = 0.0011 if quick else 0.0008
    for k, (name, fn) in enumerate(POSES):
        H, Rm, t = fn()
        print("POSE %s flex %s polegar %s" % (name, [[round(a) for a in f] for f in H.flex], [round(a) for a in H.tflex]))
        fw = world_rot(name, H, Rm, t) @ H.forearm_dir()
        print("ANTEBRACO %s (Blender) %.2f %.2f %.2f" % (name, fw.x, fw.y, fw.z))
        hs = HandSDF(H)
        mn, mx = hs.bounds()
        V, Fc = sdf_mesh(hs, mn, mx, h, target, name)
        Va = np.array(V)
        vol = sum(float(np.dot(Va[f[0]], np.cross(Va[f[i]], Va[f[i + 1]]))) for f in Fc for i in range(1, len(f) - 1)) / 6
        if vol < 0:
            Fc = [tuple(reversed(f)) for f in Fc]
        print("VOL %s %.1f cm3 (%s)" % (name, abs(vol) * 1e6, "invertido" if vol < 0 else "ok"))
        Rp = world_rot(name, H, Rm, t)
        mb = MB()
        for v in V:
            mb.add(Rp @ Vector(v), C_GLOVE)
        for f in Fc:
            mb.face(*f, m=0)
        W = Rp @ H.wrist_R()
        sleeve_mb(mb, W, 31 + k, C_SLEEVE, C_SLEEVE_CUT)
        ob = finish(mb, name, [mg, ms], root, weld=False)
        objs.append(ob)
        Rp4 = Rp.to_4x4()
        rec = dict(pulso=[0.0, 0.0, 0.0], antebraco=[round(c, 4) for c in v2g(Rp @ H.forearm_dir())])
        if name == "mao_bisnaga":
            Mt = Rp4 @ (Matrix.Translation(t) @ Rm.to_4x4())
            # gira a bisnaga em torno do proprio eixo para o rotulo olhar para a camera (-y do mundo)
            ax = (Mt.to_3x3() @ Vector((0, 0, 1))).normalized()
            front = Mt.to_3x3() @ Vector((0, -1, 0))
            want = Vector((0.15, -1, 0))
            want = (want - ax * ax.dot(want)).normalized()
            f2 = (front - ax * ax.dot(front)).normalized()
            ang = math.atan2(ax.dot(f2.cross(want)), f2.dot(want))
            # gira em torno do eixo que passa pelo ponto de pega (0,0,0.074 local)
            pg = Mt @ Vector((0, 0, 0.074))
            Mt = Matrix.Translation(pg) @ Matrix.Rotation(ang, 4, ax) @ Matrix.Translation(-pg) @ Mt
            rec["objeto"] = "bisnaga.glb (raiz bisnaga)"
            rec["obj"] = mat_doc(Mt)
            rec["bico"] = [round(c, 4) for c in v2g(Mt @ Vector(BIS_TIP))]
        elif name == "mao_colher":
            Mt = Rp4 @ (Matrix.Translation(t) @ Rm.to_4x4())
            rec["objeto"] = "pote-creme.glb, no colher"
            rec["obj"] = mat_doc(Mt)
            rec["concha"] = [round(c, 4) for c in v2g(Mt @ Vector((SP_BOWL_C - SP_GRIP, 0, -sp_axis_z(SP_GRIP))))]
        elif name == "mao_macarico":
            Mt = Rp4 @ (Matrix.Translation(t) @ Rm.to_4x4()) @ M_PRE_TO_GLB.inverted()
            rec["objeto"] = "macarico-mao.glb (raiz macarico_mao)"
            rec["obj"] = mat_doc(Mt)
            rec["bico"] = [round(c, 4) for c in v2g(Mt @ TIP_GLB)]
        elif name == "mao_punhado":
            # ponto de soltura: centro da concha, logo abaixo dos dedos
            pts = [p for i in range(4) for p in H.finger(i)[0][1:]]
            c = sum(pts, Vector()) / len(pts)
            c = Vector((0.075, 0.0, c.z - 0.008))
            rec["objeto"] = "punhado (sem ferramenta)"
            rec["obj"] = dict(pos=[round(v, 4) for v in v2g(Rp @ c)], quat=[0.0, 0.0, 0.0, 1.0])
        else:
            c = Vector((0.07, 0.0, -0.03))
            rec["objeto"] = "nenhum (mao relaxada)"
            rec["obj"] = dict(pos=[round(v, 4) for v in v2g(Rp @ c)], quat=[0.0, 0.0, 0.0, 1.0])
        info[name] = rec
    INFO["mao"] = info
    return objs


# ============================================================================
# BISNAGA
# ============================================================================
C_BIS = hexc("#F2EBDC")
C_BIS_OR = hexc("#F2661B")
C_LETTER = hexc("#FBF4E6")


def bis_profile():
    """perfil (r, z) do corpo da bisnaga, de baixo para cima."""
    R = BIS_R
    pr = [(0.0, 0.0028), (0.018, 0.0022), (0.0245, 0.0006)]
    for i in range(6):
        a = (math.pi / 2) * i / 5
        pr.append((R - 0.0042 + 0.0042 * math.sin(a), 0.0042 - 0.0042 * math.cos(a)))
    for z in (0.012, 0.03, 0.06, 0.09, 0.115):
        pr.append((R, z))
    for i in range(1, 9):
        t = i / 8
        r = R - (R - 0.0172) * (0.5 - 0.5 * math.cos(math.pi * t))
        pr.append((r, 0.123 + 0.019 * t))
    pr += [(0.0172, 0.1455), (0.0, 0.1455)]
    return pr


def cap_profile():
    pr = [(0.0, 0.1430), (0.0196, 0.1430)]
    for i in range(4):
        a = (math.pi / 2) * i / 3
        pr.append((0.0200 + 0.0010 * math.sin(a), 0.1430 + 0.0010 - 0.0010 * math.cos(a)))
    pr += [(0.0210, 0.1585), (0.0198, 0.1610), (0.0150, 0.1640), (0.0098, 0.1660), (0.0090, 0.1680)]
    for i in range(1, 9):
        t = i / 8
        pr.append((0.0090 - 0.0062 * t ** 0.9, 0.1680 + 0.0205 * t))
    pr += [(0.0026, 0.1890), (0.0021, 0.1900), (0.0012, 0.1900), (0.0011, 0.1880), (0.0, 0.1880)]
    return pr


def text_mesh(body, size, spacing=1.0, offset=0.0002):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.space_character = spacing
    cu.offset = offset
    cu.resolution_u = 5
    ob = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    V = [tuple(v.co) for v in me.vertices]
    F = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    bpy.data.meshes.remove(me)
    return V, F


def build_bisnaga(root):
    m_body = make_mat("mat_bisnaga_corpo", rough=0.38, spec=0.5, coat=0.25)
    m_or = make_mat("mat_bisnaga_laranja", rough=0.32, spec=0.55, coat=0.3)
    m_txt = make_mat("mat_bisnaga_marca", rough=0.45, spec=0.4)
    objs = []
    mb = MB()
    bb.lathe(mb, bis_profile(), (0, 0, 0), "z", 1, 48, C_BIS)
    objs.append(finish(mb, "bisnaga_corpo", [m_body], root))
    # faixa laranja da marca (rotulo levemente saliente, com bordas arredondadas)
    mb = MB()
    z0, z1, R = 0.046, 0.104, BIS_R
    prof = [(R - 0.0002, z0 - 0.0003), (R + 0.00045, z0), (R + 0.0006, z0 + 0.0008), (R + 0.0006, z1 - 0.0008),
            (R + 0.00045, z1), (R - 0.0002, z1 + 0.0003)]
    bb.lathe(mb, prof, (0, 0, 0), "z", 1, 48, C_BIS_OR)
    # tampa e bico conico
    bb.lathe(mb, cap_profile(), (0, 0, 0), "z", 1, 40, C_BIS_OR)
    objs.append(finish(mb, "bisnaga_tampa", [m_or], root))
    # "ALHOARIA" em creme sobre a faixa, de frente (-y no Blender = +z no glTF)
    V, F = text_mesh("ALHOARIA", 0.0118, spacing=1.08, offset=0.00012)
    mb = MB()
    Rt = R + 0.00075
    zc = (z0 + z1) / 2 + 0.0004
    for (x, y, _) in V:
        th = x / Rt
        mb.add((Rt * math.sin(th), -Rt * math.cos(th), zc + y), C_LETTER)
    for f in F:
        mb.face(*f)
    # filetes creme acima e abaixo do texto
    for zz in (z0 + 0.0042, z1 - 0.0042):
        prof = [(Rt - 0.0001, zz - 0.0006), (Rt, zz - 0.0005), (Rt, zz + 0.0005), (Rt - 0.0001, zz + 0.0006)]
        bb.lathe(mb, prof, (0, 0, 0), "z", 1, 48, C_LETTER)
    objs.append(finish(mb, "bisnaga_marca", [m_txt], root))
    INFO["bisnaga"] = dict(bico=[round(c, 4) for c in v2g(BIS_TIP)], altura=BIS_H, raio=BIS_R)
    return objs


# ============================================================================
# POTE + COLHER
# ============================================================================
C_POT = hexc("#F4F0E8")
C_POT_FOOT = hexc("#D9CDBB")
C_CREAM = hexc("#F4E6C2")
C_CREAM2 = hexc("#EBD6A6")
C_STEEL = hexc("#D5D7DA")
POT_RIM_Z = 0.0605
POT_IN_R = 0.0520


def pot_profile():
    pr = [(0.0, 0.0030), (0.030, 0.0030), (0.0345, 0.0)]
    pr += [(0.0365, 0.0), (0.0380, 0.0018), (0.0395, 0.0050)]
    for i in range(1, 9):
        t = i / 8
        r = 0.0395 + (0.0570 - 0.0395) * math.sin(math.pi / 2 * t) ** 0.8
        pr.append((r, 0.005 + 0.051 * t))
    # labio arredondado
    for i in range(1, 8):
        a = math.pi * i / 7
        pr.append((0.0547 + 0.0027 * math.cos(a) + 0.0003, 0.0570 + 0.0035 * math.sin(a)))
    for i in range(1, 9):
        t = i / 8
        r = POT_IN_R - (POT_IN_R - 0.033) * (t ** 2.2)
        pr.append((r, 0.0560 - 0.046 * t))
    pr += [(0.020, 0.0090), (0.0, 0.0090)]
    return pr


def inner_r(z):
    t = clamp((0.0560 - z) / 0.046)
    return POT_IN_R - (POT_IN_R - 0.033) * (t ** 2.2)


CREAM_Z = 0.0485


def cream_z(r, th):
    rho = r / inner_r(CREAM_Z)
    z = CREAM_Z + 0.0065 * max(0.0, 1 - rho * rho) ** 1.2
    z += 0.0016 * rho * math.sin(3 * th - 13 * rho) * max(0.0, 1 - rho) * 2.2
    z += 0.0011 * math.exp(-((1 - rho) / 0.07) ** 2)
    z += 0.0004 * bb.nz(r * 120 * math.cos(th), r * 120 * math.sin(th), 3.3)
    return z


def build_cream_disc(mb, m=1):
    nr, ns = 16, 64
    Rc = inner_r(CREAM_Z) + 0.0006
    c = mb.add((0, 0, cream_z(0, 0)), C_CREAM)
    rings = []
    for i in range(1, nr + 1):
        r = Rc * (i / nr) ** 0.85
        ring = []
        for k in range(ns):
            th = 2 * math.pi * k / ns
            col = lerpc(C_CREAM, C_CREAM2, clamp(0.35 + 0.45 * bb.nz(r * 60 * math.cos(th), r * 60 * math.sin(th), 8.1)))
            ring.append(mb.add((r * math.cos(th), r * math.sin(th), cream_z(r, th)), col))
        rings.append(ring)
    for k in range(ns):
        mb.tri(c, rings[0][k], rings[0][(k + 1) % ns], m=m)
    for i in range(nr - 1):
        for k in range(ns):
            k2 = (k + 1) % ns
            mb.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2], m=m)


def spoon_w(x):
    bw = SP_BOWL_W * math.sqrt(max(0.0, 1 - ((x - SP_BOWL_C) / SP_BOWL_A) ** 2))
    hw = 0.0
    if x > -0.090:
        hw = 0.0034 + (0.0098 - 0.0034) * smooth(-0.064, 0.030, x)
        if x > SP_END - 0.010:
            hw *= math.sqrt(max(0.0, 1 - ((x - (SP_END - 0.010)) / 0.010) ** 2))
    return max(bw, hw)


def spoon_top(x, u):
    """z da face de cima (concava na concha)."""
    w = spoon_w(x)
    y = u * w
    rho2 = ((x - SP_BOWL_C) / SP_BOWL_A) ** 2 + (y / SP_BOWL_W) ** 2
    zb = -SP_BOWL_D * max(0.0, 1 - rho2)
    zh = sp_axis_z(x) + 0.0003 * (1 - u * u)
    f = smooth(-0.082, -0.070, x)
    return y, lerp(zb, zh, f)


def spoon_th(x):
    return lerp(0.0013, 0.0024, smooth(-0.08, -0.04, x))


def build_spoon(m_st, m_cr, parent):
    mb = MB()
    xs = [SP_BOWL_C - SP_BOWL_A + (SP_END - (SP_BOWL_C - SP_BOWL_A)) * (0.5 - 0.5 * math.cos(math.pi * i / 69)) for i in range(70)]
    us = [-1 + 2 * j / 14 for j in range(15)]
    us = [math.copysign(abs(u) ** 0.8, u) for u in us]
    ox = SP_GRIP
    oz = sp_axis_z(SP_GRIP)

    def top(x, u):
        y, z = spoon_top(x, u)
        return (x - ox, y, z - oz), C_STEEL

    def bot(x, u):
        y, z = spoon_top(x, u)
        return (x - ox, y, z - spoon_th(x) - oz), C_STEEL
    bb.strip_layer(mb, xs, us, top, bot)
    # porcao de creme na concha
    xs2 = [SP_BOWL_C + SP_BOWL_A * 0.9 * math.sin(math.pi * (i / 23 - 0.5)) for i in range(24)]
    us2 = [-1 + 2 * j / 12 for j in range(13)]

    def ctop(x, u):
        lim = 0.9 * math.sqrt(max(0.0, 1 - ((x - SP_BOWL_C) / (SP_BOWL_A * 0.9)) ** 2))
        y = u * lim * SP_BOWL_W
        rho2 = ((x - SP_BOWL_C) / SP_BOWL_A) ** 2 + (y / SP_BOWL_W) ** 2
        zb = -SP_BOWL_D * max(0.0, 1 - rho2)
        hgt = 0.0118 * max(0.0, 1 - rho2 / 0.81) ** 0.6
        hgt += 0.0012 * math.sin(9 * (x - SP_BOWL_C) / SP_BOWL_A + 2 * u) * max(0.0, 1 - rho2 / 0.81)
        col = lerpc(C_CREAM, C_CREAM2, clamp(0.3 + 0.5 * bb.nz(x * 70, y * 70, 2.2)))
        return (x - ox, y, zb + hgt + 0.0002 - oz), col

    def cbot(x, u):
        lim = 0.9 * math.sqrt(max(0.0, 1 - ((x - SP_BOWL_C) / (SP_BOWL_A * 0.9)) ** 2))
        y = u * lim * SP_BOWL_W
        rho2 = ((x - SP_BOWL_C) / SP_BOWL_A) ** 2 + (y / SP_BOWL_W) ** 2
        zb = -SP_BOWL_D * max(0.0, 1 - rho2)
        return (x - ox, y, zb + 0.0001 - oz), C_CREAM
    nf0 = len(mb.f)
    bb.strip_layer(mb, xs2, us2, ctop, cbot)
    for k in range(nf0, len(mb.f)):
        mb.fm[k] = 1
    return finish(mb, "colher", [m_st, m_cr], parent)


def build_pote(root):
    m_pot = make_mat("mat_pote_ceramica", rough=0.16, spec=0.6, coat=0.45)
    m_cr = make_mat("mat_creme_pote", rough=0.24, spec=0.6, coat=0.25)
    m_st = make_mat("mat_colher_inox", rough=0.2, metal=0.95, spec=0.5)
    mb = MB()
    pr = pot_profile()
    bb.lathe(mb, pr, (0, 0, 0), "z", 1, 64, C_POT)
    # pe sem esmalte (cor de vertice mais escura onde z < 2 mm, lado de fora)
    for i, p in enumerate(mb.v):
        r = math.hypot(p[0], p[1])
        if p[2] < 0.0022 and r > 0.028:
            mb.c[i] = C_POT_FOOT
    build_cream_disc(mb, m=1)
    pote = finish(mb, "pote", [m_pot, m_cr], root)
    colher = build_spoon(m_st, m_cr, root)
    # colher apoiada: concha mergulhada no creme, cabo encostado no labio do pote
    c_bowl = Vector((-0.020, 0.004, 0.034))
    yaw = math.radians(-14)

    def place(alpha):
        Rr = Matrix.Rotation(yaw, 3, "Z") @ Matrix.Rotation(-alpha, 3, "Y")
        bowl_l = Vector((SP_BOWL_C - SP_GRIP, 0, -sp_axis_z(SP_GRIP)))
        t = c_bowl - Rr @ bowl_l
        return Rr, t

    def clearance(alpha):
        Rr, t = place(alpha)
        best = 1.0
        for v in colher.data.vertices:
            p = Rr @ v.co + t
            r = math.hypot(p.x, p.y)
            if 0.048 < r < 0.062:
                lip = POT_RIM_Z + 0.0002 - 0.0035 * ((r - 0.0550) / 0.0035) ** 2
                best = min(best, p.z - lip)
        return best
    lo, hi = math.radians(2), math.radians(70)
    for _ in range(30):
        mid = (lo + hi) / 2
        if clearance(mid) > 0.0003:
            hi = mid
        else:
            lo = mid
    Rr, t = place(hi)
    colher.matrix_world = Matrix.Translation(t) @ Rr.to_4x4()
    Mc = colher.matrix_world.copy()
    INFO["pote"] = dict(
        colher_no=mat_doc(Mc),
        concha_local=[round(c, 4) for c in v2g(Vector((SP_BOWL_C - SP_GRIP, 0, -sp_axis_z(SP_GRIP))))],
        ponta_cabo_local=[round(c, 4) for c in v2g(Vector((SP_END - SP_GRIP, 0, sp_axis_z(SP_END) - sp_axis_z(SP_GRIP))))],
        topo_creme=round(cream_z(0, 0), 4), borda=round(POT_RIM_Z + 0.0035, 4),
        alpha=round(math.degrees(hi), 1))
    return [pote, colher]


# ============================================================================
# GRATINADO (refeito): queijo gratinado continuo sobre a mussarela
# ============================================================================
XG = 0.123
UG = 0.93
TEX_W, TEX_H = 512, 256


def save_img(name, rgb, colorspace):
    """rgb (h, w, 3), linha 0 = V = 0 (embaixo)."""
    h, w = rgb.shape[:2]
    rgba = np.concatenate([rgb, np.ones((h, w, 1))], axis=2).astype(np.float32)
    im = bpy.data.images.new(name + "_raw", w, h, alpha=False)
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


def band_noise(rng, h, w, lo, hi):
    wn = rng.randn(h, w)
    F = np.fft.fft2(wn)
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    fr = np.sqrt(fx * fx + (fy * w / h) ** 2)
    mask = np.exp(-((fr - (lo + hi) / 2) / ((hi - lo) / 2 + 1e-6)) ** 2)
    out = np.real(np.fft.ifft2(F * mask))
    return (out - out.mean()) / (out.std() + 1e-9)


def gratin_textures():
    rng = np.random.RandomState(449)
    H_, W_ = TEX_H, TEX_W
    # coordenadas fisicas (m): x ao longo do pao, y ao longo da largura (meia largura ~ 0.045)
    X = np.linspace(-XG, XG, W_)[None, :].repeat(H_, 0)
    U = np.linspace(-UG, UG, H_)[:, None].repeat(W_, 1)
    Y = U * 0.046
    px = (2 * XG) / W_
    # bolhas (cupulas) de varios tamanhos
    hgt = np.zeros((H_, W_))
    crest = np.zeros((H_, W_))
    for _ in range(520):
        r = float(np.exp(rng.uniform(np.log(0.0011), np.log(0.0042))))
        cx, cy = rng.uniform(-XG, XG), rng.uniform(-0.044, 0.044)
        sx = rng.uniform(0.8, 1.3)
        ix0 = int((cx - 2 * r + XG) / (2 * XG) * W_)
        ix1 = int((cx + 2 * r + XG) / (2 * XG) * W_) + 2
        iy0 = int((cy / 0.046 - 2 * r / 0.046 + UG) / (2 * UG) * H_)
        iy1 = int((cy / 0.046 + 2 * r / 0.046 + UG) / (2 * UG) * H_) + 2
        ix0, iy0 = max(0, ix0), max(0, iy0)
        ix1, iy1 = min(W_, ix1), min(H_, iy1)
        if ix0 >= ix1 or iy0 >= iy1:
            continue
        dx = (X[iy0:iy1, ix0:ix1] - cx) / sx
        dy = (Y[iy0:iy1, ix0:ix1] - cy) * sx
        d = np.sqrt(dx * dx + dy * dy) / r
        dome = np.clip(1 - d * d, 0, 1) ** 1.3
        hgt[iy0:iy1, ix0:ix1] = np.maximum(hgt[iy0:iy1, ix0:ix1], dome * r * 0.42)
        crest[iy0:iy1, ix0:ix1] = np.maximum(crest[iy0:iy1, ix0:ix1], np.clip(1 - d, 0, 1) ** 0.7 * min(1.0, r / 0.0028))
    big = band_noise(rng, H_, W_, 2.0, 7.0)
    mid = band_noise(rng, H_, W_, 10.0, 24.0)
    fine = band_noise(rng, H_, W_, 40.0, 90.0)
    # mascara de borda: o gratinado se funde com a mussarela nas beiradas
    ex = np.clip((XG - np.abs(X)) / 0.016, 0, 1)
    eu = np.clip((UG - np.abs(U)) / 0.16, 0, 1)
    edge = (ex * eu)
    edge = edge * edge * (3 - 2 * edge)
    # tostado: base dourada + variacao larga continua + cristas das bolhas, nunca preto
    toast = 0.47 + 0.13 * big + 0.06 * mid + 0.025 * fine
    toast += 0.22 * crest * (0.45 + 0.55 * np.clip(0.5 + 0.5 * big, 0, 1))
    toast += 0.10 * np.clip(np.abs(U) - 0.45, 0, 1)            # laterais um pouco mais tostadas
    toast = np.clip(toast, 0.0, 0.93) * (0.25 + 0.75 * edge)
    stops = [(0.00, "#F4D98C"), (0.22, "#F0C565"), (0.42, "#E8A646"), (0.60, "#D88A35"),
             (0.76, "#C3702C"), (0.88, "#A95C26"), (1.00, "#934E22")]
    pos = np.array([s[0] for s in stops])
    cols = np.array([[bb.s2l(c) for c in hexc(s[1])] for s in stops])
    rgb = np.stack([np.interp(toast, pos, cols[:, k]) for k in range(3)], 2)
    # oleosidade: leve brilho mais claro nos vales entre bolhas
    rgb *= (1.0 + 0.05 * (1 - crest) * edge)[..., None]
    rgb = np.clip(rgb, 0, 1)
    # altura -> normal (em pixels; x e y com escalas diferentes)
    hh = hgt + 0.00012 * mid + 0.00005 * fine
    py = (2 * UG * 0.046) / H_
    dhx = (np.roll(hh, -1, 1) - np.roll(hh, 1, 1)) / (2 * px)
    dhy = (np.roll(hh, -1, 0) - np.roll(hh, 1, 0)) / (2 * py)
    dhx[:, [0, -1]] = 0
    dhy[[0, -1], :] = 0
    nx_, ny_ = -dhx * 0.9 * edge, -dhy * 0.9 * edge
    ln = np.sqrt(nx_ ** 2 + ny_ ** 2 + 1)
    nrm = np.stack([nx_ / ln, ny_ / ln, 1 / ln], 2) * 0.5 + 0.5
    # cor linear -> sRGB para salvar como imagem sRGB
    srgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055)
    INFO["gratinado_cor"] = dict(min=[round(float(srgb[..., k].min()), 3) for k in range(3)])
    ci = save_img("gratinado_cor", srgb, "sRGB")
    ni = save_img("gratinado_normal", nrm, "Non-Color")
    return ci, ni


def build_gratinado(root):
    ci, ni = gratin_textures()
    mat = make_mat("mat_gratinado", rough=0.30, spec=0.65, coat=0.30, vcol=False, image=ci, normal_image=ni,
                   normal_strength=1.0)
    mb = MB()
    nxs, nus = 156, 30
    xs = bb.cos_spaced(nxs, XG)
    us = [-UG + 2 * UG * j / (nus - 1) for j in range(nus)]
    G = []
    for x in xs:
        row = []
        for u in us:
            (px, py, pz), _ = bb.mus_pos(x, u, True)
            # afastamento: 0.9 mm no meio, 0.5 mm nas beiradas (nao forma degrau)
            e = min(1.0, (UG - abs(u)) / 0.12) * min(1.0, (XG - abs(x)) / 0.012)
            off = 0.0005 + 0.0004 * e
            uv = ((x + XG) / (2 * XG), (u + UG) / (2 * UG))
            row.append(mb.add((px, py, pz + off), (1, 1, 1), uv=uv))
        G.append(row)
    for i in range(nxs - 1):
        for j in range(nus - 1):
            mb.quad(G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1])
    ob = finish(mb, "gratinado_queijo", [mat], root, vc_white=True)
    # normal para cima
    me = ob.data
    up = sum((p.normal.z for p in me.polygons)) / len(me.polygons)
    if up < 0:
        me.flip_normals()
    return [ob]


# ============================================================================
# exportacao
# ============================================================================
def export_all():
    stats = {}
    jobs = [("mao", "mao-luva", "mao_luva", lambda r: build_mao(r, GA.quick)),
            ("bisnaga", "bisnaga", "bisnaga", build_bisnaga),
            ("pote", "pote-creme", "pote_creme", build_pote),
            ("gratinado", "gratinado", "gratinado", build_gratinado)]
    for key, fname, rname, fn in jobs:
        if key not in PARTS:
            continue
        root = root_empty(rname)
        objs = fn(root)
        tris = sum(tri_count(o) for o in objs)
        bb.export_part(fname, objs, root)
        path = os.path.join(MODELS, fname + ".glb")
        stats[fname] = (os.path.getsize(path), tris)
        print("EXPORT %-12s %8d bytes %7d tris" % (fname, stats[fname][0], tris))
        for o in objs:
            print("   %-22s %6d tris" % (o.name, tri_count(o)))
    INFO["stats"] = stats
    old = {}
    if os.path.exists(INFO_PATH):
        with open(INFO_PATH) as f:
            old = json.load(f)
    old.update(INFO)
    with open(INFO_PATH, "w") as f:
        json.dump(old, f, indent=1)
    print("INFO " + json.dumps(INFO, indent=1))
    return old


# ============================================================================
# renders de revisao (reimportam os GLBs exportados)
# ============================================================================
def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def glb(name):
    return os.path.join(MODELS, name + ".glb")


def bake(objs, M=Matrix.Identity(4)):
    """aplica a transformacao de mundo (e M) nas malhas e solta da hierarquia."""
    bpy.context.view_layer.update()
    out = []
    for o in objs:
        if o.type == "MESH":
            mw = M @ o.matrix_world
            o.data = o.data.copy()
            o.data.transform(mw)
            out.append(o)
    for o in out:
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
    for o in objs:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    return out


def tool_from_doc(rec):
    return doc_to_mat(rec["obj"])


def setup(w, h, samples, bg=None):
    bb.clear_scene()
    sc = bb.setup_scene(w, h, samples)
    if bg is not None:
        sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (bb.s2l(bg[0]), bb.s2l(bg[1]), bb.s2l(bg[2]), 1)
    return sc


def render_file(path, res, samples):
    sc = bpy.context.scene
    sc.render.filepath = path
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


def lights_around(ctr, R, az, key=1.0, rim=1.0):
    for o in list(bpy.data.objects):
        if o.name.startswith("LT_"):
            bpy.data.objects.remove(o, do_unlink=True)
    k = (R * 3.0) ** 2 * 26 * key
    right = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), 0))
    fwd = Vector((math.sin(math.radians(az)), -math.cos(math.radians(az)), 0))
    bb.add_light("AREA", ctr + (fwd * 1.3 - right * 1.6 + Vector((0, 0, 2.2))) * R, ctr, (1.0, 0.92, 0.82), k, R * 1.6, "LT_key")
    bb.add_light("AREA", ctr + (-fwd * 1.8 + right * 1.9 + Vector((0, 0, 1.0))) * R, ctr, (1.0, 0.86, 0.72), k * 0.9 * rim, R * 1.2, "LT_rim")
    bb.add_light("AREA", ctr + (-fwd * 1.6 - right * 2.0 + Vector((0, 0, 0.8))) * R, ctr, (0.85, 0.9, 1.0), k * 0.5 * rim, R * 1.0, "LT_rim2")
    bb.add_light("AREA", ctr + (fwd * 2.4 + right * 1.6 + Vector((0, 0, 0.7))) * R, ctr, (1.0, 0.9, 0.8), k * 0.25, R * 2.5, "LT_fill")


def camera_box(mn, mx, az, el, lens, margin=1.1, shift=(0, 0, 0)):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        if o.name.startswith("CAM"):
            bpy.data.objects.remove(o, do_unlink=True)
    cd = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cd.clip_start = 0.005
    ctr, dist = bb.frame_camera(cam, Vector(mn), Vector(mx), math.radians(az), math.radians(el), lens, margin, shift)
    return cam, ctr


def bbox(objs):
    for o in objs:
        if o.type == "MESH":
            o.data.update()
    bpy.context.view_layer.update()
    return bb.world_bbox([o for o in objs if o.type == "MESH" and not o.hide_render])


def floor(z, ctr, color=(0.07, 0.045, 0.035)):
    bpy.ops.mesh.primitive_plane_add(size=40.0, location=(ctr.x, ctr.y, z))
    fl = bpy.context.active_object
    fl.name = "FLOOR"
    fm = bpy.data.materials.new("floor")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (bb.s2l(color[0]), bb.s2l(color[1]), bb.s2l(color[2]), 1.0)
    fb.inputs["Roughness"].default_value = 0.55
    fl.data.materials.append(fm)


def load_hand(name, info):
    objs = import_glb(glb("mao-luva"))
    keep = [o for o in objs if o.type != "MESH" or o.name.startswith(name)]
    for o in objs:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    return bake(keep)


def load_tool(name, info):
    rec = info["mao"][name]
    M = tool_from_doc(rec)
    if name == "mao_bisnaga":
        return bake(import_glb(glb("bisnaga")), M)
    if name == "mao_macarico":
        objs = import_glb(glb("macarico-mao"))
        return bake(objs, M)
    if name == "mao_colher":
        objs = import_glb(glb("pote-creme"))
        col = [o for o in objs if o.name.startswith("colher")]
        for o in objs:
            if o not in col:
                bpy.data.objects.remove(o, do_unlink=True)
        # a colher e filho de pote_creme; o documento da a pose do no colher no quadro da mao
        for o in col:
            o.parent = None
            o.matrix_world = Matrix.Identity(4)
        return bake(col, M)
    return []


def crumbs(center, n=26, seed=3):
    """punhado de mussarela ralada caindo (so para o render)."""
    rng = random.Random(seed)
    mb = MB()
    for _ in range(n):
        p = Vector(center) + Vector((rng.gauss(0, 0.012), rng.gauss(0, 0.012), -rng.uniform(0.0, 0.07)))
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized()
        ln = rng.uniform(0.008, 0.016)
        bb.tube(mb, [p - d * ln / 2, p + d * ln / 2], [0.0013, 0.0013], [hexc("#F3DC98")] * 2, sides=4)
    m = make_mat("mat_ralada", rough=0.5)
    return finish(mb, "punhado", [m], None)


def render_maos(info, outdir, W, H, smp, only=None, az=8, el=16, fname="maos.png", yaw=0.0):
    sc = setup(W, H, smp, bg=hexc("#2A2928"))
    sc.view_settings.exposure = -0.6
    allo = []
    xoff = 0.0
    Ry = Matrix.Rotation(math.radians(yaw), 4, "Z")
    for k, (name, _) in enumerate(POSES):
        if only and name != only:
            continue
        hand = load_hand(name, info)
        tool = load_tool(name, info)
        objs = hand + tool
        if name == "mao_punhado":
            c = g2v(info["mao"][name]["obj"]["pos"])
            objs.append(crumbs(c + Vector((0, 0, -0.012))))
        for o in objs:
            o.data.transform(Ry)
        mn, mx = bbox(objs)
        dx = xoff - mn.x
        for o in objs:
            o.data.transform(Matrix.Translation((dx, -(mn.y + mx.y) / 2, -mn.z)))
        xoff += (mx.x - mn.x) + 0.012
        allo += objs
    mn, mx = bbox(allo)
    cam, ctr = camera_box(mn, mx, az, el, 70, 1.04)
    for o in list(bpy.data.objects):
        if o.name.startswith("LT_"):
            bpy.data.objects.remove(o, do_unlink=True)
    span = (mx - mn)
    R = max(span.x, span.z) / 2
    # chave suave do alto a esquerda, dois recortes fortes por tras (silhueta da luva preta) e preenchimento frontal
    bb.add_light("AREA", ctr + Vector((-0.9 * R, -1.2 * R, 1.6 * R)), ctr, (1.0, 0.94, 0.86), 60 * R * R, 1.2 * R, "LT_key")
    bb.add_light("AREA", ctr + Vector((0.8 * R, 1.4 * R, 0.9 * R)), ctr, (1.0, 0.92, 0.84), 80 * R * R, 0.8 * R, "LT_rim")
    bb.add_light("AREA", ctr + Vector((-1.0 * R, 1.2 * R, 0.5 * R)), ctr, (0.86, 0.92, 1.0), 45 * R * R, 0.8 * R, "LT_rim2")
    bb.add_light("AREA", ctr + Vector((0.3 * R, -1.8 * R, 0.2 * R)), ctr, (1.0, 0.95, 0.9), 14 * R * R, 2.0 * R, "LT_fill")
    render_file(os.path.join(outdir, fname), (W, H), smp)


def lanche_scene(lid, show):
    """importa as camadas do lanche (GLBs atuais do site) na posicao montada."""
    parts = {}
    for name in show:
        new = import_glb(glb(name))
        parts[name] = dict(objs=new, roots=[o for o in new if o.parent is None])
        if name == "pao":
            lo = [o for o in new if o.name.startswith("pao_tampa")][0]
            lo.rotation_mode = "XYZ"
            lo.rotation_euler = ((0.0 if lid == "closed" else bb.OPEN_RAD), 0, 0)
    bpy.context.view_layer.update()
    return parts


def visible_meshes(parts, names):
    return [o for n in names for r in parts[n]["roots"] for o in bb.descend(r) if o.type == "MESH" and not o.hide_render]


def place_hand_at(name, info, point_key, target, yaw_deg=0.0):
    """carrega mao + ferramenta e posiciona a raiz da mao de modo que info[point_key] caia em target."""
    rec = info["mao"][name]
    p = g2v(rec[point_key]) if point_key != "obj" else g2v(rec["obj"]["pos"])
    Ry = Matrix.Rotation(math.radians(yaw_deg), 4, "Z")
    M = Matrix.Translation(Vector(target) - (Ry @ p)) @ Ry
    hand = load_hand(name, info)
    tool = load_tool(name, info)
    for o in hand + tool:
        o.data.transform(M)
    return hand, tool, M


def paste_line(pts, r, name="fio_pasta"):
    mb = MB()
    P = [Vector(p) for p in pts]
    bb.tube(mb, P, [r] * len(P), [bb.C_PASTA] * len(P), sides=12)
    m = make_mat("mat_fio_pasta", rough=0.3, spec=0.6, coat=0.3)
    return finish(mb, name, [m], None)


def render_bisnaga(info, outdir, W, H, smp):
    setup(W, H, smp)
    show = ["tabua", "pao"]
    parts = lanche_scene("open", show)
    base = visible_meshes(parts, ["pao"])
    pb = [o for o in base if o.name.startswith("pao_base")][0]

    def zs(x, y):
        ok, loc, nor, idx = pb.ray_cast(Vector((x, y, 0.3)), Vector((0, 0, -1)))
        return loc.z if ok else 0.04
    # zigue-zague ja feito + o fio caindo do bico
    pts = []
    xe = 0.03
    for i in range(80):
        t = i / 79
        x = -0.115 + (xe + 0.115) * t
        y = 0.022 * math.sin(t * 3.3 * 2 * math.pi)
        pts.append((x, y, zs(x, y) + 0.0035))
    end = Vector(pts[-1])
    tip = end + Vector((0.004, -0.004, 0.06))
    rec = info["mao"]["mao_bisnaga"]
    hand, tool, M = place_hand_at("mao_bisnaga", info, "bico", tip, yaw_deg=10)
    stream = [tip + (end - tip) * (i / 10) + Vector((0, 0, 0.0)) for i in range(11)]
    line = paste_line(pts, 0.0042)
    jato = paste_line([tuple(p) for p in stream], 0.0026, "jato")
    objs = visible_meshes(parts, show)
    mn, mx = bbox(objs + hand + tool)
    fmn, fmx = bbox([o for o in objs if o.name.startswith("pao")] + tool)
    cam, ctr = camera_box(fmn, fmx, 22, 30, 50, 1.06)
    floor(-0.0285, ctr)
    lights_around(ctr, (fmx - fmn).length / 2, 22, key=1.0, rim=1.2)
    render_file(os.path.join(outdir, "bisnaga-acao.png"), (W, H), smp)


def render_colher(info, outdir, W, H, smp):
    setup(W, H, smp)
    show = ["tabua", "pao"]
    parts = lanche_scene("open", show)
    pb = [o for o in visible_meshes(parts, ["pao"]) if o.name.startswith("pao_base")][0]

    def zs(x, y):
        ok, loc, nor, idx = pb.ray_cast(Vector((x, y, 0.3)), Vector((0, 0, -1)))
        return loc.z if ok else 0.04
    # creme ja espalhado (camada fina) da ponta esquerda ate a colher
    mb = MB()
    xe = 0.02
    xs = [-0.118 + (xe + 0.118) * i / 59 for i in range(60)]
    us = [-1 + 2 * j / 16 for j in range(17)]
    C1, C2 = hexc("#F4E6C2"), hexc("#E9D3A0")

    def top(x, u):
        wy = 0.034 * (1 - 0.25 * math.sin(x * 40)) * min(1.0, (x + 0.118) / 0.02 + 0.3)
        y = u * wy
        th = 0.0030 * max(0.0, 1 - u * u) ** 0.5
        th += 0.0009 * math.sin(x * 210 + 2.5 * math.sin(u * 3)) * max(0.0, 1 - u * u)
        th += 0.0016 * math.exp(-((x - xe + 0.004) / 0.006) ** 2) * max(0.0, 1 - u * u)   # monte na frente da colher
        return (x, y, zs(x, y) + 0.0004 + th), lerpc(C1, C2, clamp(0.4 + 0.4 * math.sin(x * 120 + u * 2)))

    def bot(x, u):
        wy = 0.034 * (1 - 0.25 * math.sin(x * 40)) * min(1.0, (x + 0.118) / 0.02 + 0.3)
        y = u * wy
        return (x, y, zs(x, y) - 0.001), C1
    bb.strip_layer(mb, xs, us, top, bot)
    sm = finish(mb, "creme_espalhado", [make_mat("mat_creme_esp", rough=0.24, spec=0.6, coat=0.25)], None)
    # colher: costas da concha encostadas no creme, na frente do espalhado
    target = Vector((xe + 0.016, 0.0, zs(xe + 0.016, 0.0) + 0.012))
    hand, tool, M = place_hand_at("mao_colher", info, "concha", target, yaw_deg=0)
    objs = visible_meshes(parts, show) + [sm]
    fmn, fmx = bbox([o for o in objs if o.name.startswith("pao")] + tool + hand)
    cam, ctr = camera_box(fmn, fmx, 24, 26, 50, 1.04)
    floor(-0.0285, ctr)
    lights_around(ctr, (fmx - fmn).length / 2, 24, key=1.0, rim=1.2)
    render_file(os.path.join(outdir, "colher-acao.png"), (W, H), smp)


def cut_x(objs, xmax):
    """apaga faces com algum vertice em x > xmax (gratinado parcial)."""
    for o in objs:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        dead = [f for f in bm.faces if max(v.co.x for v in f.verts) > xmax]
        bmesh.ops.delete(bm, geom=dead, context="FACES")
        bm.to_mesh(o.data)
        bm.free()


def render_macarico(info, outdir, W, H, smp):
    setup(W, H, smp)
    show = ["tabua", "pao", "mussarela", "gratinado"]
    parts = lanche_scene("closed", show)
    grat = visible_meshes(parts, ["gratinado"])
    for o in grat:
        o.data = o.data.copy()
    xt = 0.035
    cut_x(grat, xt)
    mus = visible_meshes(parts, ["mussarela"])[0]
    ok, hit, nor, idx = mus.ray_cast(Vector((xt - 0.012, 0, 0.3)), Vector((0, 0, -1)))
    target = Vector((xt - 0.012, 0.0, hit.z if ok else 0.09))
    d = Vector((-0.8192, 0.0, -0.5736))
    tip = target - d * 0.075
    hand, tool, M = place_hand_at("mao_macarico", info, "bico", tip, yaw_deg=0)
    fl = bpy.data.lights.new("chama_luz", "POINT")
    fl.energy = 0.6
    fl.color = (1.0, 0.55, 0.2)
    flo = bpy.data.objects.new("chama_luz", fl)
    bpy.context.scene.collection.objects.link(flo)
    flo.location = target + Vector((0.006, -0.01, 0.012))
    objs = visible_meshes(parts, show)
    fmn, fmx = bbox([o for o in objs if o.name.startswith(("pao", "mussarela"))] + tool + hand)
    cam, ctr = camera_box(fmn, fmx, 20, 26, 50, 1.04)
    floor(-0.0285, ctr)
    lights_around(ctr, (fmx - fmn).length / 2, 20, key=1.0, rim=1.2)
    render_file(os.path.join(outdir, "macarico-acao.png"), (W, H), smp)


def render_gratinado(info, outdir, W, H, smp):
    antigo = GA.antigo or os.path.join(os.path.dirname(os.path.normpath(outdir)), "gratinado-antigo.glb")
    for tag in ("antes", "depois"):
        setup(W, H, smp)
        show = ["tabua", "pao", "mussarela", "gratinado"]
        parts = lanche_scene("closed", show)
        if tag == "antes":
            for o in visible_meshes(parts, ["gratinado"]):
                o.hide_render = True
            old = import_glb(antigo)
            extra = [o for o in old if o.type == "MESH"]
        else:
            extra = []
        objs = visible_meshes(parts, ["pao", "mussarela"])
        mn, mx = bbox(objs)
        cam, ctr = camera_box(mn, mx, 14, 38, 55, 1.06)
        floor(-0.0285, ctr)
        lights_around(ctr, (mx - mn).length / 2, 14)
        render_file(os.path.join(outdir, "gratinado-%s.png" % tag), (W, H), smp)


def render_props(outdir, W, H, smp):
    """revisao: bisnaga e pote com colher (fora da lista de entregas)."""
    setup(W, H, smp)
    a = bake(import_glb(glb("bisnaga")))
    b = bake(import_glb(glb("pote-creme")), Matrix.Translation((0.11, 0.0, 0.0)))
    mn, mx = bbox(a + b)
    cam, ctr = camera_box(mn, mx, 18, 24, 60, 1.1)
    floor(mn.z - 0.0003, ctr)
    lights_around(ctr, (mx - mn).length / 2, 18)
    render_file(os.path.join(outdir, "dbg-props.png"), (W, H), smp)


def main():
    info = {}
    if PARTS:
        info = export_all()
    elif os.path.exists(INFO_PATH):
        with open(INFO_PATH) as f:
            info = json.load(f)
    if not VIEWS:
        return
    outdir = GA.renders
    os.makedirs(outdir, exist_ok=True)
    W, H = (900, 600) if GA.quick else (1800, 1200)
    smp = 16 if GA.quick else 96
    for v in VIEWS:
        if v.startswith("dbg:"):
            _, nm, az, el = v.split(":")
            render_maos(info, outdir, 900, 700, smp, only=nm, az=float(az), el=float(el), fname="dbg-%s-%s-%s.png" % (nm, az, el))
    if "props" in VIEWS:
        render_props(outdir, 900, 700, smp)
    if "maos" in VIEWS:
        render_maos(info, outdir, int(W * 1.2), int(W * 0.42), smp, az=0, el=14, yaw=28)
    if "bisnaga" in VIEWS:
        render_bisnaga(info, outdir, W, H, smp)
    if "colher" in VIEWS:
        render_colher(info, outdir, W, H, smp)
    if "macarico" in VIEWS:
        render_macarico(info, outdir, W, H, smp)
    if "gratinado" in VIEWS:
        render_gratinado(info, outdir, W, H, smp)


main()
