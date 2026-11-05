"""
LAR-431 (extras) - Sacola kraft da Alhoaria, macarico de mao (posicao de uso) e icones da Costela.

Gera, por script e do zero (sem downloads):
  public/assets/models/bancada/sacola.glb          (raiz `sacola`: `sacola_fechada` + `sacola_aberta`)
  public/assets/models/bancada/macarico-mao.glb    (raiz `macarico_mao`: corpo + `chama`)
  public/assets/bancada/icones/{pao,pasta,costela,creme,mussarela,macarico,sacola}.webp   (512x512, alfa)
  <renders>/01..05 + 00-icones.png                 (revisao, fora do repo)

    blender.exe -b --factory-startup -P build_extras.py -- [opcoes]

Opcoes:
    --renders DIR   pasta dos PNGs de revisao (fora do repo)
    --only a,b      etapas: models, icons, renders (padrao: todas)
    --quick         renders menores, poucas amostras (iteracao)

Importa as funcoes de build_bancada.py (sem executar nada dele: --parts none --views none).
"""
import bpy
import math
import os
import sys
import tempfile
import argparse
import importlib.util
import numpy as np
from mathutils import Vector, Matrix

_argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--renders", default=r"\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-431-extras\renders")
ap.add_argument("--only", default="all")
ap.add_argument("--quick", action="store_true")
EA = ap.parse_args(_argv)

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
hexc, lerp, lerpc, mulc, clamp, smooth = bb.hexc, bb.lerp, bb.lerpc, bb.mulc, bb.clamp, bb.smooth
MB, finish, make_mat, tri_count, root_empty = bb.MB, bb.finish, bb.make_mat, bb.tri_count, bb.root_empty
MODELS = bb.MODELS
ICONS = os.path.join(bb.REPO, "public", "assets", "bancada", "icones")
STEPS = {"models", "icons", "renders"} if EA.only == "all" else set(EA.only.split(","))


def save_rgb_image(name, rgb, colorspace="sRGB"):
    """rgb (h, w, 3) em 0..1, topo para baixo -> imagem embutida (png temporario)."""
    h, w = rgb.shape[:2]
    rgba = np.concatenate([rgb[::-1], np.ones((h, w, 1))], axis=2).astype(np.float32)
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


# ============================================================================
# estampa: pintor de tinta (numpy, supersample)
# ============================================================================
class Painter:
    """Tela de tinta (0 = papel, 1 = tinta). Coordenadas em px finais, y para baixo."""

    def __init__(self, w, h, ss=3):
        self.w, self.h, self.ss = w, h, ss
        self.W, self.H = w * ss, h * ss
        self.a = np.zeros((self.H, self.W), np.float32)

    def _box(self, xs, ys, r):
        xa = int(max(0, min(xs) * self.ss - r))
        xb = int(min(self.W, max(xs) * self.ss + r + 1))
        ya = int(max(0, min(ys) * self.ss - r))
        yb = int(min(self.H, max(ys) * self.ss + r + 1))
        return xa, xb, ya, yb

    def seg(self, p0, p1, w0, w1=None, mode="add"):
        w1 = w0 if w1 is None else w1
        ss = self.ss
        r = max(w0, w1) * ss / 2 + 2
        xa, xb, ya, yb = self._box((p0[0], p1[0]), (p0[1], p1[1]), r)
        if xa >= xb or ya >= yb:
            return
        X, Y = np.meshgrid(np.arange(xa, xb) + 0.5, np.arange(ya, yb) + 0.5)
        x0, y0, x1, y1 = p0[0] * ss, p0[1] * ss, p1[0] * ss, p1[1] * ss
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1)
        d = np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy))
        cov = np.clip((w0 + (w1 - w0) * t) * ss / 2 - d + 0.5, 0, 1)
        sub = self.a[ya:yb, xa:xb]
        if mode == "add":
            np.maximum(sub, cov, out=sub)
        else:
            sub *= (1 - cov)

    def line(self, pts, w, closed=False, mode="add"):
        n = len(pts)
        for i in range(n if closed else n - 1):
            self.seg(pts[i], pts[(i + 1) % n], w, mode=mode)

    def poly(self, pts, mode="add"):
        ss = self.ss
        P = np.array(pts, np.float64) * ss
        xa, xb, ya, yb = self._box([p[0] for p in pts], [p[1] for p in pts], 2)
        if xa >= xb or ya >= yb:
            return
        X, Y = np.meshgrid(np.arange(xa, xb) + 0.5, np.arange(ya, yb) + 0.5)
        ins = np.zeros(X.shape, bool)
        n = len(P)
        for i in range(n):
            x0, y0 = P[i]
            x1, y1 = P[(i + 1) % n]
            if y0 == y1:
                continue
            cond = ((y0 <= Y) & (Y < y1)) | ((y1 <= Y) & (Y < y0))
            xi = x0 + (Y - y0) * (x1 - x0) / (y1 - y0)
            ins ^= cond & (X < xi)
        sub = self.a[ya:yb, xa:xb]
        if mode == "add":
            np.maximum(sub, ins.astype(np.float32), out=sub)
        else:
            sub *= (1 - ins.astype(np.float32))

    def rough(self, blur, amp, noise, gain=1.6):
        """Borda irregular tipo xilogravura: desfoca e limiar com ruido."""
        r = max(1, int(round(blur * self.ss)))
        a = self.a
        for axis in (0, 1):
            for _ in range(2):
                c = np.cumsum(np.pad(a, [(r + 1, r), (0, 0)] if axis == 0 else [(0, 0), (r + 1, r)], mode="edge"), axis=axis)
                a = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1) if axis == 0 else (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
        n = noise[:self.H, :self.W]
        e = (4 * a * (1 - a)) ** 1.5
        self.a = np.clip((a - 0.5 + amp * n * e) * gain * r + 0.5, 0, 1).astype(np.float32)

    def down(self):
        ss = self.ss
        return self.a.reshape(self.h, ss, self.w, ss).mean(axis=(1, 3))


def circle_pts(cx, cy, r, n=160, jit=0.0, ph=0.0, a0=0.0, a1=2 * math.pi):
    out = []
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        rr = r * (1 + jit * (math.sin(3 * t + ph) * 0.6 + math.sin(7 * t + 2 * ph) * 0.4))
        out.append((cx + rr * math.cos(t), cy + rr * math.sin(t)))
    return out


def rot(pts, ang, cx, cy):
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def bez(p0, p1, p2, n=14):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]


def draw_seal(pl_ring, pl_a, pl_ic, cx, cy, R):
    """Selo circular da Alhoaria: aneis, A de xilogravura, queijo, pao e alho."""
    P = lambda u, v: (cx + u * R, cy + v * R)
    # aneis (traco grosso externo, fino interno)
    pl_ring.line(circle_pts(cx, cy, 0.960 * R, 200, 0.006, 0.4), 0.085 * R)
    pl_ring.line(circle_pts(cx, cy, 0.860 * R, 200, 0.006, 1.3), 0.034 * R)
        # A (pernas, travessa); pontas retas
    ytop, ybot, hw = -0.74, 0.74, 0.155
    xfoot = 0.46
    for sgn in (-1, 1):
        pl_a.poly([P(-hw, ytop), P(hw, ytop), P(sgn * xfoot + hw, ybot), P(sgn * xfoot - hw, ybot)] if sgn < 0 else
                  [P(-hw, ytop), P(hw, ytop), P(xfoot + hw + 0.02, ybot), P(xfoot - hw + 0.02, ybot)])
    pl_a.poly([P(-0.34, 0.14), P(0.34, 0.14), P(0.38, 0.30), P(-0.38, 0.30)])
    # buraco do A (contraforma triangular) apagado para ficar nitido
    pl_a.poly([P(-0.05, -0.30), P(0.05, -0.30), P(0.17, 0.12), P(-0.17, 0.12)], mode="erase")
    # hachuras (sombra) nas faces internas
    for i in range(7):
        t = i / 6
        yy = lerp(-0.28, 0.07, t)
        xx = 0.025 + 0.145 * (yy + 0.30) / 0.42
        pl_a.line([P(xx + 0.015, yy), P(xx + 0.10, yy + 0.045)], 0.030 * R)
    for i in range(6):
        t = i / 5
        xx = lerp(-0.30, 0.30, t)
        pl_a.line([P(xx, 0.31), P(xx + 0.045, 0.40)], 0.030 * R)
    # queijo (esquerda)
    cc = P(-0.64, -0.02)
    cheese = [(-0.19, -0.22), (-0.02, -0.31), (0.19, -0.19), (0.19, 0.18), (0.0, 0.30), (-0.19, 0.22)]
    cheese = rot([(cc[0] + x * R, cc[1] + y * R) for x, y in cheese], -0.2, cc[0], cc[1])
    pl_ic.poly(cheese, mode="add")
    inner = [(p[0] + (cc[0] - p[0]) * 0.18, p[1] + (cc[1] - p[1]) * 0.18) for p in cheese]
    pl_ic.poly(inner, mode="erase")
    top = rot([(cc[0] + x * R, cc[1] + y * R) for x, y in [(-0.19, -0.22), (0.0, -0.11), (0.19, -0.19)]], -0.2, cc[0], cc[1])
    pl_ic.line(top, 0.042 * R)
    mid = rot([(cc[0] + x * R, cc[1] + y * R) for x, y in [(0.0, -0.11), (0.0, 0.30)]], -0.2, cc[0], cc[1])
    pl_ic.line(mid, 0.042 * R)
    for (hx, hy, hr) in ((-0.085, 0.0, 0.040), (0.085, 0.08, 0.034), (-0.07, 0.15, 0.028), (0.075, -0.02, 0.024)):
        c = rot([(cc[0] + hx * R, cc[1] + hy * R)], -0.2, cc[0], cc[1])[0]
        pl_ic.poly(circle_pts(c[0], c[1], hr * R * 1.25, 18), mode="add")
        pl_ic.poly(circle_pts(c[0], c[1], hr * R * 0.55, 18), mode="erase")
    # pao (direita): baguete inclinada com cortes
    bc = P(0.64, -0.02)
    ang = math.radians(62)
    bread = []
    for i in range(48):
        t = 2 * math.pi * i / 48
        ct, st = math.cos(t), math.sin(t)
        bread.append((bc[0] + R * (0.34 * math.copysign(abs(ct) ** 0.8, ct)), bc[1] + R * (0.13 * math.copysign(abs(st) ** 0.8, st))))
    bread = rot(bread, ang, bc[0], bc[1])
    pl_ic.poly(bread, mode="add")
    sh = [(bc[0] + (p[0] - bc[0]) * 0.80, bc[1] + (p[1] - bc[1]) * 0.72) for p in bread]
    pl_ic.poly(sh, mode="erase")
    for lx in (-0.20, -0.07, 0.06, 0.19):
        s = rot([(bc[0] + (lx - 0.035) * R, bc[1] - 0.085 * R), (bc[0] + (lx + 0.035) * R, bc[1] + 0.085 * R)], ang, bc[0], bc[1])
        pl_ic.line(s, 0.042 * R)
    # alho (embaixo, entre as pernas)
    g0 = P(0.0, 0.40)
    bulb = circle_pts(cx, cy + 0.585 * R, 0.125 * R, 32)
    pl_ic.poly(bulb, mode="add")
    pl_ic.poly(circle_pts(cx, cy + 0.585 * R, 0.125 * R * 0.72, 32), mode="erase")
    for sg in (-1, 1):
        pl_ic.line([P(sg * 0.105, 0.52), P(sg * 0.060, 0.45), g0], 0.042 * R)
    pl_ic.poly([g0, P(-0.03, 0.46), P(0.03, 0.46)], mode="add")
    for sg in (-1, 0, 1):
        pl_ic.line(bez(g0, P(sg * 0.09, 0.55), P(sg * 0.035, 0.70)), 0.034 * R)


def draw_letters(pl, text, x0, ybase, h, gap):
    """Caixa alta serifada desenhada a mao (A L H O R I), com contraste de espessura."""
    tw, tn = 0.255 * h, 0.095 * h     # espessura grossa e fina
    sl = 0.078 * h                    # espessura da serifa
    adv = {"A": 0.84, "L": 0.64, "H": 0.82, "O": 0.84, "R": 0.76, "I": 0.40}
    x = x0

    def pt(w, u, v):
        return (x + u * w, ybase - v * h)

    def rect(w, u0, u1, v0, v1):
        pl.poly([pt(w, u0, v0), pt(w, u1, v0), pt(w, u1, v1), pt(w, u0, v1)])

    def stem(w, uc, v0=0.0, v1=1.0):
        rect(w, uc - tw / 2 / w, uc + tw / 2 / w, v0, v1)

    def serif(w, uc, v, span):
        sv = sl / h
        rect(w, uc - span / 2, uc + span / 2, v - (sv if v > 0.5 else 0), v + (0 if v > 0.5 else sv))

    for ch in text:
        w = adv[ch] * h
        if ch == "A":
            pl.line([pt(w, 0.07, 0.0), pt(w, 0.50, 1.0)], tn * 1.05)
            pl.poly([pt(w, 0.42, 1.0), pt(w, 0.60, 1.0), pt(w, 0.96, 0.0), pt(w, 0.96 - tw * 1.15 / w, 0.0)])
            pl.line([pt(w, 0.26, 0.28), pt(w, 0.76, 0.28)], tn * 0.95)
            serif(w, 0.14, 0.0, 0.30)
            serif(w, 0.86, 0.0, 0.34)
            serif(w, 0.50, 1.0, 0.20)
        elif ch == "L":
            stem(w, 0.26)
            rect(w, 0.20, 0.96, 0.0, tn / h * 1.1)
            rect(w, 0.90, 0.96, 0.0, 0.22)
            serif(w, 0.26, 1.0, 0.46)
            serif(w, 0.26, 0.0, 0.46)
        elif ch == "H":
            stem(w, 0.20)
            stem(w, 0.80)
            rect(w, 0.20, 0.80, 0.47, 0.47 + tn / h)
            for uc in (0.20, 0.80):
                serif(w, uc, 1.0, 0.38)
                serif(w, uc, 0.0, 0.38)
        elif ch == "O":
            pl.poly([pt(w, 0.5 + 0.5 * math.cos(t), 0.5 + 0.5 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 64, endpoint=False)])
            ix, iy = 0.5 - tw / w * 0.95, 0.5 - tn / h * 1.1
            pl.poly([pt(w, 0.5 + ix * math.cos(t), 0.5 + iy * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 64, endpoint=False)], mode="erase")
        elif ch == "R":
            cxu, cyv, rxu, ryv = 0.46, 0.745, 0.46, 0.255
            pl.poly([pt(w, cxu + rxu * math.cos(t), cyv + ryv * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 48, endpoint=False)])
            ixu, iyv = rxu - tw / w * 0.95, ryv - tn / h
            pl.poly([pt(w, cxu + ixu * math.cos(t), cyv + iyv * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 48, endpoint=False)], mode="erase")
            rect(w, 0.0, 0.18, 0.4, 1.0)
            stem(w, 0.20)
            rect(w, 0.20, 0.46, 0.49, 0.49 + tn / h * 0.9)
            pl.poly([pt(w, 0.40, 0.50), pt(w, 0.40 + tw * 1.2 / w, 0.50), pt(w, 0.98, 0.0), pt(w, 0.98 - tw * 1.25 / w, 0.0)])
            serif(w, 0.20, 1.0, 0.40)
            serif(w, 0.20, 0.0, 0.40)
            serif(w, 0.86, 0.0, 0.32)
        elif ch == "I":
            stem(w, 0.5)
            serif(w, 0.5, 1.0, 0.86)
            serif(w, 0.5, 0.0, 0.86)
        x += w + gap


def paper_tile(n=256, seed=11):
    """Papel kraft (relativo, multiplica a cor de vertice): fibras e pintas; tileavel."""
    rng = np.random.RandomState(seed)
    base = 0.925 + 0.016 * bb._fft_noise(rng, n, 2, 7) + 0.010 * bb._fft_noise(rng, n, 20, 90)
    fib = np.zeros((n, n))
    for _ in range(520):
        x, y = rng.uniform(0, n, 2)
        a = rng.normal(0.0, 0.7)
        ln = rng.uniform(6, 22)
        amp = rng.uniform(-0.022, 0.014)
        for t in np.linspace(0, ln, int(ln) + 1):
            fib[int(y + t * math.sin(a)) % n, int(x + t * math.cos(a)) % n] += amp
    fib = (np.roll(fib, 1, 0) + fib + np.roll(fib, 1, 1)) / 2.2
    spots = (rng.rand(n, n) > 0.9975).astype(float)
    col = np.clip(base + fib - 0.03 * spots, 0.78, 1.0)
    return np.stack([col, col * 0.992, col * 0.975], axis=2)


TEX_W, TEX_H = 352, 512
BAG_H = 0.262
BAG_W = 0.09


def make_stamp_texture():
    rng = np.random.RandomState(5)
    ss = 3
    N = 2048
    n_lo = bb._fft_noise(rng, N, 70, 260)
    n_hi = bb._fft_noise(rng, N, 160, 520)
    ppm = TEX_W / (2 * BAG_W)                      # px por metro
    ring, ac, icn, txt = (Painter(TEX_W, TEX_H, ss) for _ in range(4))
    cx = TEX_W / 2
    cy = (BAG_H - 0.123) * ppm
    R = 0.0585 * ppm
    draw_seal(ring, ac, icn, cx, cy, R)
    # texto ALHOARIA
    hh = 0.0245 * ppm
    advs = {"A": 0.84, "L": 0.64, "H": 0.82, "O": 0.84, "R": 0.76, "I": 0.40}
    gap = 0.075 * hh
    total = sum(advs[c] * hh for c in "ALHOARIA") + gap * 7
    draw_letters(txt, "ALHOARIA", (TEX_W - total) / 2, (BAG_H - 0.034) * ppm, hh, gap)
    for pl, bl, am in ((ring, 0.9, 0.22), (ac, 1.4, 0.95), (icn, 0.9, 0.22), (txt, 0.8, 0.28)):
        pl.rough(bl, am, n_lo)
    ink = np.maximum.reduce([pl.down() for pl in (ring, ac, icn, txt)])
    # falhas de tinta (poros do papel) e carimbo desigual
    pores = np.clip((n_hi[:TEX_H, :TEX_W] - 2.1) * 2.0, 0, 1)
    wear = 0.99 - 0.06 * np.clip(bb._fft_noise(rng, 512, 3, 9)[:TEX_H, :TEX_W], 0, 3) / 3
    ink = np.clip(ink * wear - 0.75 * pores * ink, 0, 1)
    tile = paper_tile(256)
    reps = (TEX_H // 256 + 1, TEX_W // 256 + 1)
    paper = np.tile(tile, (reps[0], reps[1], 1))[:TEX_H, :TEX_W]
    rgb = paper * (1 - ink[..., None]) + np.array([0.075, 0.060, 0.052]) * ink[..., None]
    return save_rgb_image("sacola_estampa", np.clip(rgb, 0, 1)), ink


# ============================================================================
# SACOLA
# ============================================================================
D0 = 0.110
Z_G1, Z_G2 = 0.205, 0.2335
C_KRAFT = hexc("#C4A070")
C_KRAFT_IN = hexc("#B08A58")
NF, NS = 24, 3


def depth_closed(z):
    d = lerp(D0, 0.030, smooth(0.135, 0.205, z))
    if z > Z_G1:
        u = (z - Z_G1) / (Z_G2 - Z_G1) if z <= Z_G2 else (z - Z_G2) / (BAG_H - Z_G2)
        d = 0.030 + 0.012 * math.sin(math.pi * clamp(u)) ** 0.7
    return d


def params(z, closed):
    if closed:
        d = depth_closed(z)
        g = 0.004 + 0.024 * smooth(0.11, 0.205, z)
        bl = 0.0045 * (1 - smooth(0.12, 0.2, z))
    else:
        d = D0 + 0.004 * smooth(0.24, 0.262, z)
        g = 0.006 + 0.014 * smooth(0.04, 0.245, z)
        bl = 0.0040 * (1 - smooth(0.17, 0.26, z))
    sh = 0.003 * (1 - smooth(0.0, 0.004, z))
    return d - 2 * sh, g, bl, sh


def wrinkle(x, z, ch):
    """deslocamento (m) ao longo da normal: vincos suaves de papel."""
    v = 0.00085 * bb.nz(x * 48, z * 26, 3.1 + ch) + 0.00040 * bb.nz(x * 130, z * 70, 9.7)
    v += 0.0007 * math.exp(-((z - 0.064) / 0.0045) ** 2) * (0.4 + bb.nz(x * 30, 5.0, 1.0))
    return v


def section(z, closed, ch=0.0):
    """Secao do saco na altura z: lista de (x, y, grupo) em sentido anti-horario. grupo F (frente) / K (costas) / S."""
    d, g, bl, sh = params(z, closed)
    W = BAG_W - sh
    c = [(-W, -d / 2), (W, -d / 2), (W - g, 0.0), (W, d / 2), (-W, d / 2), (-W + g, 0.0)]
    rho = [0.0048, 0.0048, 0.0016, 0.0048, 0.0048, 0.0016]
    nint = [NF, NS, NS, NF, NS, NS]
    A, B = [], []
    for k in range(6):
        p, a, b = Vector(c[k]), Vector(c[k - 1]), Vector(c[(k + 1) % 6])
        la, lb = (a - p).length, (b - p).length
        ra = min(rho[k], 0.42 * la)
        rb = min(rho[k], 0.42 * lb)
        A.append(p + (a - p).normalized() * ra)
        B.append(p + (b - p).normalized() * rb)
    M = [A[k] * 0.25 + Vector(c[k]) * 0.5 + B[k] * 0.25 for k in range(6)]
    pts = [(B[0], "F")]
    for k in range(6):
        grp = "F" if k == 0 else ("K" if k == 3 else "S")
        for i in range(1, nint[k] + 1):
            pts.append((B[k] + (A[(k + 1) % 6] - B[k]) * (i / (nint[k] + 1)), grp))
        k2 = (k + 1) % 6
        pts.append((A[k2], "F" if k2 == 1 else ("K" if k2 == 4 else "S")))
        pts.append((M[k2], "S"))
        if k2 != 0:
            pts.append((B[k2], "K" if k2 == 3 else "S"))
    out = []
    for i, (p, grp) in enumerate(pts):
        x, y = p.x, p.y
        if grp == "F":
            y -= bl * max(0.0, 1 - (x / W) ** 2) ** 0.8
        elif grp == "K":
            y += bl * max(0.0, 1 - (x / W) ** 2) ** 0.8
        out.append([x, y, grp])
    # deslocamento ao longo da normal (vincos)
    n = len(out)
    res = []
    for i in range(n):
        a, b = out[i - 1], out[(i + 1) % n]
        tx, ty = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tx, ty) + 1e-9
        nx, ny = ty / ln, -tx / ln
        w = wrinkle(out[i][0], z, ch)
        res.append((out[i][0] + nx * w, out[i][1] + ny * w, out[i][2], out[i][0], w, nx, ny))
    return res


def kraft_color(x, z, w, closed, inner=False):
    base = C_KRAFT_IN if inner else C_KRAFT
    t = 1.0 + 0.05 * bb.nz(x * 20, z * 14, 7.7)
    t *= 1.0 + 0.075 * (w / 0.0006)
    t *= 0.93 + 0.07 * smooth(0.0, 0.2, z)
    if closed:
        t *= 1 - 0.34 * math.exp(-((z - Z_G1) / 0.0022) ** 2) - 0.34 * math.exp(-((z - Z_G2) / 0.0022) ** 2)
        t *= 1 + 0.06 * smooth(0.25, 0.262, z)
    if inner:
        t *= 0.50 + 0.50 * smooth(0.0, 0.24, z)
    return mulc(base, t)


def bag_rows(closed):
    if closed:
        return [0, 0.0015, 0.004, 0.009, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.135, 0.15, 0.165, 0.18, 0.192, 0.2, Z_G1,
                0.2100, 0.2145, 0.219, 0.2235, 0.228, Z_G2, 0.2385, 0.243, 0.2475, 0.252, 0.2565, BAG_H]
    return [0, 0.0015, 0.004, 0.009, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.24, 0.2525, 0.2585, BAG_H]


def loft_outer(mbF, mbR, closed):
    rows = bag_rows(closed)
    secs = [section(z, closed) for z in rows]
    N = len(secs[0])
    nF = NF + 2                                     # pontos do grupo frontal: 0 .. nF-1
    cacheF, cacheR = {}, {}

    def vF(i, k):
        if (i, k) not in cacheF:
            x, y, _, xn, w, _, _ = secs[i][k]
            col = kraft_color(xn, rows[i], w, closed)
            cacheF[(i, k)] = mbF.add((x, y, rows[i]), col, uv=((xn + BAG_W) / (2 * BAG_W), rows[i] / BAG_H))
        return cacheF[(i, k)]

    # comprimento de arco para o UV do restante (a partir do ponto nF-1)
    arcs = []
    for i in range(len(rows)):
        s, a = [0.0], 0.0
        for c in range(nF - 1, nF - 1 + (N - nF + 1) + 1):
            p0 = secs[i][c % N]
            p1 = secs[i][(c + 1) % N]
            a += math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            s.append(a)
        arcs.append(s)

    def vR(i, c):
        key = (i, c)
        if key not in cacheR:
            k = c % N
            x, y, _, xn, w, _, _ = secs[i][k]
            col = kraft_color(xn, rows[i], w, closed)
            cacheR[key] = mbR.add((x, y, rows[i]), col, uv=(arcs[i][c - (nF - 1)] / 0.06, rows[i] / 0.06))
        return cacheR[key]

    for i in range(len(rows) - 1):
        for k in range(nF - 1):
            mbF.quad(vF(i, k), vF(i, k + 1), vF(i + 1, k + 1), vF(i + 1, k))
        for c in range(nF - 1, N):
            mbR.quad(vR(i, c), vR(i, c + 1), vR(i + 1, c + 1), vR(i + 1, c))
    return rows, secs


def fan(mb, ring_pts, z, color, up, scale=0.06):
    cx = sum(p[0] for p in ring_pts) / len(ring_pts)
    cy = sum(p[1] for p in ring_pts) / len(ring_pts)
    c = mb.add((cx, cy, z), color, uv=(cx / scale, cy / scale))
    ids = [mb.add((p[0], p[1], z), color, uv=(p[0] / scale, p[1] / scale)) for p in ring_pts]
    n = len(ids)
    for k in range(n):
        if up:
            mb.tri(c, ids[k], ids[(k + 1) % n])
        else:
            mb.tri(c, ids[(k + 1) % n], ids[k])


def inner_shell(mbR, rows, secs, t=0.0008):
    """superficie interna (normais para dentro) + borda superior (so para o saco aberto)."""
    N = len(secs[0])
    cache = {}
    per = []
    for i in range(len(rows)):
        s, a = [0.0], 0.0
        pts = [(p[0] - p[5] * t, p[1] - p[6] * t) for p in secs[i]]
        for c in range(N):
            p0, p1 = pts[c], pts[(c + 1) % N]
            a += math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            s.append(a)
        per.append((pts, s))

    def v(i, c):
        if (i, c) not in cache:
            pts, s = per[i]
            p = pts[c % N]
            col = kraft_color(secs[i][c % N][3], rows[i], secs[i][c % N][4] * -1, False, inner=True)
            cache[(i, c)] = mbR.add((p[0], p[1], rows[i] + (0.0008 if i == 0 else 0.0)), col, uv=(s[c] / 0.06, rows[i] / 0.06))
        return cache[(i, c)]
    for i in range(len(rows) - 1):
        for c in range(N):
            mbR.quad(v(i, c), v(i + 1, c), v(i + 1, c + 1), v(i, c + 1))
    # borda (corte do papel)
    top = len(rows) - 1
    rim = lambda c, inn: mbR.add((per[top][0][c % N][0], per[top][0][c % N][1], rows[top]) if inn else (secs[top][c % N][0], secs[top][c % N][1], rows[top]),
                                 mulc(C_KRAFT, 1.12), uv=(c / 40.0, 0.0))
    for c in range(N):
        mbR.quad(rim(c, False), rim(c + 1, False), rim(c + 1, True), rim(c, True))
    return per[0][0]


def build_label(root_parent, mat_w, mat_k):
    """Etiqueta branca sobre a dobra (fechada): segue a superficie da frente."""
    objs = []
    zc, hw, hh = Z_G2, 0.027, 0.0125
    nx, nz = 8, 6
    mb = MB()
    ids = []
    rows = []
    for j in range(nz + 1):
        z = zc - hh + 2 * hh * j / nz
        sec = section(z, True)
        fr = [(p[3], p[1]) for p in sec if p[2] == "F"]
        row = []
        for i in range(nx + 1):
            x = -hw + 2 * hw * i / nx
            y = np.interp(x, [q[0] for q in fr], [q[1] for q in fr]) - 0.0007
            edge = (i in (0, nx)) or (j in (0, nz))
            row.append(mb.add((x, y, z), mulc((0.96, 0.95, 0.91), 0.97 if edge else 1.0)))
        rows.append(row)
    for j in range(nz):
        for i in range(nx):
            mb.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i])
    objs.append(finish(mb, "sacola_fechada_etiqueta", [mat_w], root_parent, vc_white=False))
    # linhas de tinta (texto da etiqueta)
    mb = MB()
    for (zz, ll, ww) in ((zc + 0.0055, 0.034, 0.0013), (zc - 0.0005, 0.024, 0.0013), (zc - 0.0062, 0.030, 0.0013)):
        r4 = []
        for (x, z) in ((-ll / 2, zz - ww / 2), (ll / 2, zz - ww / 2), (ll / 2, zz + ww / 2), (-ll / 2, zz + ww / 2)):
            sec = section(z, True)
            fr = [(p[3], p[1]) for p in sec if p[2] == "F"]
            y = np.interp(x, [q[0] for q in fr], [q[1] for q in fr]) - 0.0012
            r4.append(mb.add((x, y, z), (0.08, 0.07, 0.06)))
        mb.quad(*r4)
    objs.append(finish(mb, "sacola_fechada_etiqueta_tinta", [mat_k], root_parent, vc_white=False))
    return objs


def build_sacola(root):
    stamp_img, _ = make_stamp_texture()
    grain_img = save_rgb_image("sacola_papel", paper_tile(256))
    m_front = make_mat("mat_sacola_frente", rough=0.88, vcol=True, image=stamp_img, spec=0.25)
    m_kraft = make_mat("mat_sacola_kraft", rough=0.9, vcol=True, image=grain_img, spec=0.25)
    m_lbl = make_mat("mat_sacola_etiqueta", rough=0.6, vcol=True, spec=0.4)
    m_ink = make_mat("mat_sacola_tinta", base=hexc("#14110F"), rough=0.5, vcol=False)
    objs = []
    # --- fechada
    pf = root_empty("sacola_fechada")
    pf.parent = root
    mbF, mbR = MB(), MB()
    rows, secs = loft_outer(mbF, mbR, True)
    ring0 = [(p[0], p[1]) for p in secs[0]]
    ringT = [(p[0], p[1]) for p in secs[-1]]
    fan(mbR, ring0, 0.0, mulc(C_KRAFT, 0.8), False)
    fan(mbR, ringT, BAG_H, mulc(C_KRAFT, 1.08), True)
    objs.append(finish(mbF, "sacola_fechada_frente", [m_front], pf))
    objs.append(finish(mbR, "sacola_fechada_corpo", [m_kraft], pf))
    objs += build_label(pf, m_lbl, m_ink)
    # --- aberta
    po = root_empty("sacola_aberta")
    po.parent = root
    mbF, mbR = MB(), MB()
    rows, secs = loft_outer(mbF, mbR, False)
    ring0 = [(p[0], p[1]) for p in secs[0]]
    fan(mbR, ring0, 0.0, mulc(C_KRAFT, 0.8), False)
    inner0 = inner_shell(mbR, rows, secs)
    fan(mbR, inner0, 0.0009, mulc(C_KRAFT_IN, 0.55), True)
    objs.append(finish(mbF, "sacola_aberta_frente", [m_front], po))
    objs.append(finish(mbR, "sacola_aberta_corpo", [m_kraft], po))
    return objs


# ============================================================================
# MACARICO DE MAO (posicao de uso)
# ============================================================================
PITCH = math.radians(35.0)
ROT = Matrix.Rotation(-PITCH, 4, "Y") @ Matrix.Rotation(math.pi, 4, "Z")
TIP_X = 0.136
MACA_INFO = {}


def build_macarico_mao(root):
    orange, black = hexc("#FF6A1A"), hexc("#1B1A1C")
    steel, dsteel, red = hexc("#C9CDD2"), hexc("#7C838B"), hexc("#D8281F")
    m_or = make_mat("mat_maca_laranja", base=orange, rough=0.34, metal=0.05, vcol=False, spec=0.7, coat=0.45)
    m_bk = make_mat("mat_maca_preto", base=black, rough=0.5, vcol=False, spec=0.45)
    m_st = make_mat("mat_maca_aco", base=steel, rough=0.28, metal=0.8, vcol=False)
    m_ds = make_mat("mat_maca_aco_escuro", base=dsteel, rough=0.38, metal=0.8, vcol=False)
    m_rd = make_mat("mat_maca_trava", base=red, rough=0.4, vcol=False)
    O = (0.0, 0.0, 0.0)
    R_C = 0.0140
    parts = {}

    # cartucho laranja (corpo longo), com ombro e pescoco
    mb = MB()
    bb.lathe(mb, bb.rcyl(R_C, -0.088, 0.010, 0.0042), O, "x", 1, 40, orange)
    bb.lathe(mb, [(0.0, 0.010), (0.0105, 0.010), (0.0090, 0.0145), (0.0078, 0.018)], O, "x", 1, 28, orange)
    parts["maca_cartucho"] = (mb, m_or)
    # pretos: faixa do rotulo, base do cartucho, cabeca, gatilho, anel traseiro
    mb = MB()
    bb.lathe(mb, bb.rcyl(R_C + 0.0007, -0.066, -0.030, 0.0008), O, "x", 1, 40, black)
    bb.lathe(mb, bb.rcyl(R_C + 0.0006, -0.092, -0.080, 0.0035), O, "x", 1, 40, black)
    bb.superq(mb, (0.0405, 0.0, 0.0008), (0.0235, 0.0128, 0.0145), 0.30, 0.30, 24, 14, black)         # cabeca
    bb.superq(mb, (0.0355, 0.0, -0.0205), (0.0105, 0.0060, 0.0120), 0.35, 0.35, 16, 10, black)         # gatilho
    bb.superq(mb, (0.0430, 0.0, -0.0145), (0.0050, 0.0046, 0.0050), 0.4, 0.4, 12, 8, black)             # pivo do gatilho
    bb.lathe(mb, bb.rcyl(0.0102, 0.0605, 0.0660, 0.0012), O, "x", 1, 28, black)                        # base do bico
    parts["maca_cabeca"] = (mb, m_bk)
    # trava vermelha (deslizante no topo) + botao
    mb = MB()
    bb.superq(mb, (0.0300, 0.0, 0.0150), (0.0100, 0.0050, 0.0036), 0.35, 0.35, 16, 8, red)
    bb.superq(mb, (0.0490, 0.0, 0.0143), (0.0055, 0.0045, 0.0032), 0.4, 0.4, 12, 8, red)
    parts["maca_trava"] = (mb, m_rd)
    # aco: colar, ombro, bico fino reto, anel, queimador
    mb = MB()
    bb.lathe(mb, bb.rcyl(0.0092, 0.0105, 0.0185, 0.0012), O, "x", 1, 32, steel)                        # colar
    bb.lathe(mb, [(0.0, 0.0660), (0.0052, 0.0660), (0.0046, 0.0700), (0.0045, 0.1190)], O, "x", 1, 20, steel)  # bico
    bb.lathe(mb, bb.rcyl(0.0066, 0.0820, 0.0880, 0.0012), O, "x", 1, 24, steel)                        # anel
    parts["maca_aco"] = (mb, m_st)
    mb = MB()
    burner = [(0.0, 0.1130), (0.0074, 0.1130), (0.0074, 0.1160), (0.0058, 0.1175), (0.0058, 0.1280), (0.0078, 0.1285),
              (0.0078, 0.1335), (0.0050, 0.1360), (0.0, 0.1350)]
    bb.lathe(mb, burner, O, "x", 1, 24, dsteel)
    parts["maca_queimador"] = (mb, m_ds)

    # chama: cone com leve torcao (laranja na ponta, azul no bico)
    fl = MB()
    n, seg, L = 22, 24, 0.078
    rings = []
    for i in range(n + 1):
        t = i / n
        r0 = 0.0058 * math.sin(math.pi * t ** 0.5) * (1 - 0.25 * t) if t < 1 else 0.0
        a = TIP_X + 0.0035 + L * t
        sw = 0.0011 * math.sin(2 * math.pi * 1.3 * t) * t
        ring = []
        for q in range(seg):
            th = 2 * math.pi * q / seg
            rr = r0 * (1 + 0.13 * math.sin(3 * th + 5.5 * t)) if r0 > 0 else 0.0
            ring.append(fl.add((a, sw + rr * math.cos(th), 0.0011 * math.cos(2 * math.pi * 1.3 * t) * t + rr * math.sin(th)), (1, 1, 1)))
        rings.append(ring)
    kblue = 9
    for i in range(n):
        for q in range(seg):
            q2 = (q + 1) % seg
            fl.quad(rings[i][q], rings[i][q2], rings[i + 1][q2], rings[i + 1][q], m=1 if i < kblue else 0)
    m_fo = make_mat("mat_chama_externa", base=hexc("#FF8A1E"), rough=0.5, vcol=False, emit=hexc("#FF7A12"), emit_s=4.0)
    m_fi = make_mat("mat_chama_interna", base=hexc("#4A8BFF"), rough=0.5, vcol=False, emit=hexc("#3D7CFF"), emit_s=6.0)

    allp = [p for (m, _) in list(parts.values()) for p in m.v]
    def tr(p):
        return ROT @ Vector(p)
    cen = sum((tr(p) for p in allp), Vector()) / len(allp)
    MACA_INFO["tip_blender"] = tr((TIP_X, 0, 0)) - cen
    MACA_INFO["dir_blender"] = (ROT.to_3x3() @ Vector((1, 0, 0))).normalized()
    objs = []
    for name, (mb, mat) in parts.items():
        mb.v = [tuple(tr(p) - cen) for p in mb.v]
        objs.append(finish(mb, name, [mat], root, vc_white=True))
    fl.v = [tuple(tr(p) - cen) for p in fl.v]
    objs.append(finish(fl, "chama", [m_fo, m_fi], root, vc_white=True))
    return objs


# ============================================================================
# exportacao
# ============================================================================
def export_glb(name, root, objs):
    bb.export_part(name, objs, root)
    return os.path.join(MODELS, name + ".glb")


def build_models():
    stats = {}
    for nm, rname, fn in (("sacola", "sacola", build_sacola), ("macarico-mao", "macarico_mao", build_macarico_mao)):
        root = root_empty(rname)
        objs = fn(root)
        tris = sum(tri_count(o) for o in objs)
        if nm == "sacola":
            # empties filhos tambem precisam ir na selecao
            kids = [o for o in bpy.data.objects if o.parent is root]
            objs = objs + kids
        path = export_glb(nm, root, objs)
        stats[nm] = (os.path.getsize(path), tris)
        print("EXPORT %-13s %8d bytes %7d tris" % (nm, stats[nm][0], tris))
    t = MACA_INFO["tip_blender"]
    d = MACA_INFO["dir_blender"]
    print("MACARICO ponta do bico (glTF x,y,z): %.4f %.4f %.4f   direcao (glTF): %.4f %.4f %.4f" % (t.x, t.z, -t.y, d.x, d.z, -d.y))
    return stats


if "models" in STEPS:
    build_models()


# ============================================================================
# cena de render (revisao e icones)
# ============================================================================
BG = bb.BG
descend = bb.descend


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + ".glb"))
    return [o for o in bpy.data.objects if o not in before]


def set_hidden(objs, prefixes=(), flame=True):
    for o in objs:
        h = bool(prefixes) and o.name.startswith(tuple(prefixes))
        if not flame and o.name.startswith("chama"):
            h = True
        o.hide_render = h
        o.hide_viewport = h


def place_shot(objs, az, el, lens, margin, shift=(0, 0, 0), key_gain=1.0, floor=True):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        if o.name.startswith(("CAM", "LT_", "FLOOR")):
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    mn, mx = bb.world_bbox(objs)
    cd = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    ctr, dist = bb.frame_camera(cam, mn, mx, math.radians(az), math.radians(el), lens, margin, shift)
    R = max((mx - mn).length / 2, 0.05)
    if floor:
        bpy.ops.mesh.primitive_plane_add(size=40.0, location=(ctr.x, ctr.y, mn.z - 0.0004))
        fl = bpy.context.active_object
        fl.name = "FLOOR"
        fm = bpy.data.materials.new("floor")
        fm.use_nodes = True
        fb = fm.node_tree.nodes["Principled BSDF"]
        fb.inputs["Base Color"].default_value = (bb.s2l(0.07), bb.s2l(0.045), bb.s2l(0.035), 1.0)
        fb.inputs["Roughness"].default_value = 0.5
        fl.data.materials.append(fm)
    k = (R * 3.0) ** 2 * 26 * key_gain
    right = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), 0))
    fwd = Vector((math.sin(math.radians(az)), -math.cos(math.radians(az)), 0))
    bb.add_light("AREA", ctr + (fwd * 1.3 - right * 1.6 + Vector((0, 0, 2.2))) * R, ctr, (1.0, 0.88, 0.72), k, R * 1.6, "LT_key")
    bb.add_light("AREA", ctr + (-fwd * 1.8 + right * 1.9 + Vector((0, 0, 1.0))) * R, ctr, (1.0, 0.68, 0.42), k * 0.6, R * 1.2, "LT_rim")
    bb.add_light("AREA", ctr + (fwd * 2.4 + right * 1.6 + Vector((0, 0, 0.7))) * R, ctr, (1.0, 0.8, 0.6), k * 0.25, R * 2.5, "LT_fill")
    return cam, ctr, dist


def render_to(path, res, samples):
    sc = bpy.context.scene
    sc.render.filepath = path
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


def alpha_bbox(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[..., 3]
    bpy.data.images.remove(im)
    ys, xs = np.where(a > 0.03)
    return xs.min() / w, (xs.max() + 1) / w, ys.min() / h, (ys.max() + 1) / h


def webp_from_png(png, out, limit=56 * 1024):
    """PNG RGBA -> WebP com alfa; reduz a qualidade ate caber no limite."""
    sc = bpy.context.scene
    vs, st = sc.view_settings, sc.render.image_settings
    old = (vs.view_transform, vs.exposure, vs.look, st.file_format, st.color_mode, st.quality)
    vs.view_transform, vs.exposure, vs.look = "Standard", 0.0, "None"
    st.file_format, st.color_mode = "WEBP", "RGBA"
    im = bpy.data.images.load(png)
    q = 94
    while True:
        st.quality = q
        im.save_render(out, scene=sc)
        sz = os.path.getsize(out)
        print("WEBP %s q=%d %d B" % (os.path.basename(out), q, sz))
        if sz <= limit or q <= 20:
            break
        q -= 6
    bpy.data.images.remove(im)
    vs.view_transform, vs.exposure, vs.look = old[:3]
    st.file_format, st.color_mode, st.quality = old[3:]
    return sz


def icon_shot(name, objs, az=30, el=30, lens=70, frac=0.80, key_gain=1.0, outdir=None):
    sc = bpy.context.scene
    sc.render.film_transparent = True
    cam, ctr, dist = place_shot(objs, az, el, lens, 1.25, key_gain=key_gain, floor=False)
    dirv = (cam.location - ctr).normalized()
    d = (cam.location - ctr).length
    cam.data.clip_start = 0.01
    tmp = os.path.join(tempfile.gettempdir(), "icn_probe.png")
    for it in range(4):
        render_to(tmp, (192, 192), 8)
        x0, x1, y0, y1 = alpha_bbox(tmp)
        size = max(x1 - x0, y1 - y0)
        d = d / (frac / size)
        cam.location = ctr + dirv * d
        cam.data.shift_x += ((x0 + x1) / 2 - 0.5)
        cam.data.shift_y += ((y0 + y1) / 2 - 0.5)
        bpy.context.view_layer.update()
    render_to(tmp, (192, 192), 8)
    x0, x1, y0, y1 = alpha_bbox(tmp)
    print("ICON %s: ocupa %.0f%% x %.0f%% (centro %.2f,%.2f)" % (name, 100 * (x1 - x0), 100 * (y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2))
    png = os.path.join(tempfile.gettempdir(), "icone_%s.png" % name)
    render_to(png, (512, 512), 64)
    os.makedirs(ICONS, exist_ok=True)
    return webp_from_png(png, os.path.join(ICONS, name + ".webp"))


# ---------------------------------------------------------------------------
# recipientes e props so para os icones (nao exportados)
# ---------------------------------------------------------------------------
def prop(name, mb, mat, vc_white=True):
    return finish(mb, name, [mat], None, vc_white=vc_white)


def garlic_bulb(c, s, name="alho"):
    mb = MB()
    prof = [(0.10, 0.0), (0.30, 0.02), (0.46, 0.10), (0.52, 0.26), (0.48, 0.46), (0.32, 0.68), (0.14, 0.85), (0.06, 0.95), (0.0, 1.0)]
    seg = 28
    rings = []
    ivory, vio = hexc("#F4EBDC"), hexc("#D3BFD0")
    for (r, a) in prof:
        ring = []
        for q in range(seg):
            th = 2 * math.pi * q / seg
            f = 1 + 0.07 * math.cos(7 * th)
            col = lerpc(ivory, vio, smooth(0.2, 1.0, -math.cos(7 * th)) * 0.7)
            ring.append(mb.add((c[0] + s * r * f * math.cos(th), c[1] + s * r * f * math.sin(th), c[2] + s * a), col))
        rings.append(ring)
    for i in range(len(prof) - 1):
        for q in range(seg):
            q2 = (q + 1) % seg
            mb.quad(rings[i][q], rings[i][q2], rings[i + 1][q2], rings[i + 1][q])
    return finish(mb, name, [make_mat("mat_alho", rough=0.55, vcol=True, spec=0.4)], None)


def clove(c, s, yaw, name="dente"):
    mb = MB()
    prof = [(0.0, 0.0), (0.22, 0.04), (0.34, 0.25), (0.30, 0.55), (0.15, 0.85), (0.0, 1.0)]
    seg = 18
    rings = []
    for (r, a) in prof:
        ring = []
        for q in range(seg):
            th = 2 * math.pi * q / seg
            ring.append(mb.add((c[0] + s * r * math.cos(th) * 0.7, c[1] + s * r * math.sin(th), c[2] + s * a), hexc("#F2E7D2")))
        rings.append(ring)
    for i in range(len(prof) - 1):
        for q in range(seg):
            q2 = (q + 1) % seg
            mb.quad(rings[i][q], rings[i][q2], rings[i + 1][q2], rings[i + 1][q])
    o = finish(mb, name, [make_mat("mat_dente", rough=0.5, vcol=True, spec=0.4)], None)
    o.rotation_euler = (0.0, math.radians(82), yaw)
    return o


def build_icon_pasta():
    objs = []
    cream, cap, lab = hexc("#F1E4C4"), hexc("#E39A25"), hexc("#D98B1F")
    mb = MB()
    bb.lathe(mb, [(0.0, 0.0), (0.0185, 0.0), (0.0212, 0.004), (0.0226, 0.014), (0.0230, 0.058), (0.0212, 0.076),
                  (0.0150, 0.090), (0.0090, 0.099), (0.0085, 0.101)], (0, 0, 0), "z", 1, 40, cream)
    objs.append(prop("bisnaga", mb, make_mat("mat_bisnaga", base=cream, rough=0.28, vcol=False, spec=0.6, coat=0.35)))
    mb = MB()
    bb.lathe(mb, [(0.0095, 0.098), (0.0118, 0.101), (0.0118, 0.113), (0.0092, 0.1175), (0.0050, 0.1290), (0.0, 0.1310)], (0, 0, 0), "z", 1, 28, cap)
    objs.append(prop("bisnaga_tampa", mb, make_mat("mat_bisnaga_tampa", base=cap, rough=0.3, vcol=False, spec=0.6)))
    mb = MB()
    bb.lathe(mb, [(0.02305, 0.020), (0.02325, 0.022), (0.02325, 0.056), (0.02305, 0.058)], (0, 0, 0), "z", 1, 40, lab)
    objs.append(prop("bisnaga_rotulo", mb, make_mat("mat_bisnaga_rotulo", base=lab, rough=0.4, vcol=False)))
    mb = MB()
    pc = hexc("#F4E7BE")
    prof = [(0.0, 0.0), (0.020, 0.0), (0.0235, 0.005), (0.0215, 0.011), (0.0222, 0.016), (0.0185, 0.021), (0.0188, 0.026),
            (0.0145, 0.031), (0.0135, 0.036), (0.0095, 0.041), (0.0070, 0.047), (0.0032, 0.052), (0.0, 0.0545)]
    bb.lathe(mb, prof, (0.056, -0.030, 0), "z", 1, 32, pc)
    objs.append(prop("pasta_montinho", mb, make_mat("mat_pasta_i", base=pc, rough=0.32, vcol=False, spec=0.6, coat=0.25)))
    objs.append(garlic_bulb((-0.052, -0.026, 0.0), 0.046))
    return objs


def build_icon_creme():
    objs = []
    white, band, cc = hexc("#F5F2EA"), hexc("#C79A5E"), hexc("#F8E5A8")
    mb = MB()
    bb.lathe(mb, [(0.0, 0.0), (0.0258, 0.0), (0.0275, 0.0015), (0.0314, 0.040), (0.0326, 0.0455), (0.0312, 0.0478), (0.0296, 0.0462),
                  (0.0290, 0.040), (0.0262, 0.0045), (0.0, 0.0045)], (0, 0, 0), "z", 1, 48, white)
    objs.append(prop("pote", mb, make_mat("mat_pote", base=white, rough=0.35, vcol=False, spec=0.6)))
    mb = MB()
    bb.lathe(mb, [(0.02905, 0.011), (0.02925, 0.013), (0.03095, 0.0345), (0.03080, 0.0375)], (0, 0, 0), "z", 1, 48, band)
    objs.append(prop("pote_luva", mb, make_mat("mat_pote_luva", base=band, rough=0.8, vcol=False)))
    mb = MB()
    bb.lathe(mb, [(0.0, 0.0640), (0.0100, 0.0620), (0.0210, 0.0560), (0.0285, 0.0500), (0.0296, 0.0462), (0.0290, 0.040), (0.0, 0.040)], (0, 0, 0), "z", 1, 40, cc)
    helix, rad = [], []
    n = 46
    for i in range(n + 1):
        t = i / n
        th = 2 * math.pi * 2.3 * t
        r = 0.0195 * (1 - 0.82 * t)
        helix.append(Vector((r * math.cos(th), r * math.sin(th), 0.0585 + 0.030 * t ** 0.85)))
        rad.append(0.0078 * (1 - 0.65 * t))
    bb.tube(mb, helix, rad, [cc] * len(helix), sides=10, cap=True)
    objs.append(prop("creme_topo", mb, make_mat("mat_creme_i", base=cc, rough=0.22, vcol=False, spec=0.7, coat=0.5)))
    return objs


def slice_mesh(name, size, thick, droop, color_a, color_b, seed):
    mb = MB()
    n = 10
    T, B = [], []
    for i in range(n + 1):
        rt, rb = [], []
        for j in range(n + 1):
            u, v = -1 + 2 * i / n, -1 + 2 * j / n
            nn = (abs(u) ** 12 + abs(v) ** 12) ** (1 / 12)
            m = max(abs(u), abs(v)) / nn if nn > 1e-9 else 1.0
            x, y = u * m * size, v * m * size
            r2 = (x * x + y * y) / (size * size)
            z = -droop * (r2 - 0.4) + 0.0016 * bb.nz(x * 90 + seed, y * 90, 1.0)
            col = lerpc(color_a, color_b, 0.5 + 0.5 * bb.nz(x * 40 + seed, y * 40, 3.0))
            rt.append(mb.add((x, y, z + thick / 2), col))
            rb.append(mb.add((x, y, z - thick / 2), mulc(col, 0.9)))
        T.append(rt)
        B.append(rb)
    for i in range(n):
        for j in range(n):
            mb.quad(T[i][j], T[i + 1][j], T[i + 1][j + 1], T[i][j + 1])
            mb.quad(B[i][j], B[i][j + 1], B[i + 1][j + 1], B[i + 1][j])
    for i in range(n):
        mb.quad(T[i][0], B[i][0], B[i + 1][0], T[i + 1][0])
        mb.quad(T[i][n], T[i + 1][n], B[i + 1][n], B[i][n])
        mb.quad(T[0][i], T[0][i + 1], B[0][i + 1], B[0][i])
        mb.quad(T[n][i], B[n][i], B[n][i + 1], T[n][i + 1])
    return finish(mb, name, [make_mat("mat_mussarela_fatia", rough=0.28, vcol=True, spec=0.7, coat=0.6)], None)


def build_icon_mussarela():
    objs = []
    ca, cb = hexc("#F9E8AE"), hexc("#F0CF72")
    for i, (yaw, dx, dz) in enumerate([(0.0, 0.0, 0.0), (24.0, 0.010, 0.0085), (-16.0, -0.008, 0.017), (38.0, 0.004, 0.0255)]):
        o = slice_mesh("fatia%d" % i, 0.040, 0.0042, 0.004, ca if i % 2 == 0 else cb, cb if i % 2 == 0 else ca, 3.1 * i)
        o.rotation_euler = (math.radians(3 * (i % 2)), math.radians(-2 * i), math.radians(yaw))
        o.location = (dx, 0.004 * i, dz + 0.0045)
        objs.append(o)
    return objs


def build_icon_costela():
    dish = hexc("#E8DDC6")
    mb = MB()
    prof = [(0.0, 0.0), (0.060, 0.0), (0.066, 0.0025), (0.073, 0.011), (0.0785, 0.0145), (0.0775, 0.0162), (0.0755, 0.0150), (0.0700, 0.0125),
            (0.0620, 0.0050), (0.0, 0.0050)]
    bb.lathe(mb, prof, (0, 0, 0), "z", 1, 64, dish)
    mb.v = [(x * 2.05, y * 1.2, z) for (x, y, z) in mb.v]
    objs = [finish(mb, "travessa", [make_mat("mat_travessa", base=dish, rough=0.3, vcol=False, spec=0.6, coat=0.3)], None, vc_white=True)]
    cos_objs = import_glb("costela")
    mn, mx = bb.world_bbox(cos_objs)
    for o in cos_objs:
        if o.parent is None:
            o.location = (-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, 0.0055 - mn.z)
    objs += cos_objs
    return objs


# ---------------------------------------------------------------------------
# icones
# ---------------------------------------------------------------------------
def fresh(w, h, samples):
    bb.clear_scene()
    sc = bb.setup_scene(w, h, samples)
    return sc


def make_icons(outdir):
    results = {}
    sc = fresh(512, 512, 64)
    sc.view_settings.exposure = -0.55

    def run(name, objs, **kw):
        results[name] = icon_shot(name, [o for o in objs if o.type == "MESH" and not o.hide_render], outdir=outdir, **kw)

    def cleanup():
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)

    # pao inteiro fechado
    objs = import_glb("pao")
    lid = [o for o in objs if o.name.startswith("pao_tampa")][0]
    lid.rotation_mode = "XYZ"
    lid.rotation_euler = (0, 0, 0)
    run("pao", [o for o in objs if o.type == "MESH"], az=28, el=28)
    cleanup()
    # pasta: bisnaga
    run("pasta", build_icon_pasta(), az=28, el=30)
    cleanup()
    # costela na travessa
    run("costela", build_icon_costela(), az=35, el=42)
    cleanup()
    # creme: pote
    run("creme", build_icon_creme(), az=28, el=30)
    cleanup()
    # mussarela: fatias
    run("mussarela", build_icon_mussarela(), az=24, el=36)
    cleanup()
    # macarico novo
    objs = import_glb("macarico-mao")
    run("macarico", [o for o in objs if o.type == "MESH"], az=-32, el=22)
    cleanup()
    # sacola fechada
    objs = import_glb("sacola")
    set_hidden(objs, ("sacola_aberta",))
    run("sacola", [o for o in objs if o.type == "MESH" and not o.hide_render], az=24, el=27, frac=0.82)
    cleanup()
    return results


def contact_sheet(outdir):
    names = ["pao", "pasta", "costela", "creme", "mussarela", "macarico", "sacola"]
    cell = 300
    cols = 4
    rows = 2
    W, H = 1200, cell * rows

    sheet = np.ones((H, W, 3), np.float32) * np.array(BG, np.float32)
    for i, n in enumerate(names):
        im = bpy.data.images.load(os.path.join(ICONS, n + ".webp"))
        im.scale(cell, cell)
        a = np.array(im.pixels[:], np.float32).reshape(cell, cell, 4)[::-1]
        r, c = divmod(i, cols)
        x0 = c * cell
        y0 = r * cell
        al = a[..., 3:4]
        sheet[y0:y0 + cell, x0:x0 + cell] = a[..., :3] * al + sheet[y0:y0 + cell, x0:x0 + cell] * (1 - al)
        bpy.data.images.remove(im)
    out = bpy.data.images.new("sheet", W, H)
    rgba = np.concatenate([sheet[::-1], np.ones((H, W, 1), np.float32)], axis=2)
    out.pixels.foreach_set(rgba.ravel())
    out.filepath_raw = os.path.join(outdir, "00-icones.png")
    out.file_format = "PNG"
    out.save()
    print("SHEET", out.filepath_raw)


# ---------------------------------------------------------------------------
# renders de revisao
# ---------------------------------------------------------------------------
def make_renders(outdir):
    quick = EA.quick
    W, H = (600, 450) if quick else (1200, 900)
    smp = 16 if quick else 96
    sc = fresh(W, H, smp)
    # 01 / 02: sacola
    objs = import_glb("sacola")
    set_hidden(objs, ("sacola_aberta",))
    vis = [o for o in objs if o.type == "MESH" and not o.hide_render]
    place_shot(vis, 24, 20, 70, 1.12)
    render_to(os.path.join(outdir, "01-sacola-fechada.png"), (W, H), smp)
    set_hidden(objs, ("sacola_fechada",))
    vis = [o for o in objs if o.type == "MESH" and not o.hide_render]
    place_shot(vis, 22, 38, 70, 1.12)
    render_to(os.path.join(outdir, "02-sacola-aberta.png"), (W, H), smp)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    # 03 / 04: macarico
    objs = import_glb("macarico-mao")
    set_hidden(objs, (), flame=False)
    vis = [o for o in objs if o.type == "MESH" and not o.hide_render]
    place_shot(vis, -30, 18, 70, 1.12)
    render_to(os.path.join(outdir, "03-macarico-mao.png"), (W, H), smp)
    set_hidden(objs, (), flame=True)
    vis = [o for o in objs if o.type == "MESH"]
    place_shot(vis, -30, 18, 70, 1.12)
    render_to(os.path.join(outdir, "04-macarico-chama.png"), (W, H), smp)
    # 05: cena
    parts = bb.import_parts()
    sac = import_glb("sacola")
    set_hidden(sac, ("sacola_aberta",))
    BAG_POS = (0.135, 0.099, 0.0)
    BAG_YAW = math.radians(4)
    for o in sac:
        if o.type == "MESH":
            o.data.transform(Matrix.Translation(BAG_POS) @ Matrix.Rotation(BAG_YAW, 4, "Z"))
    parts["sacola"] = dict(objs=sac, roots=[o for o in sac if o.parent is None])
    show = ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "sacola"]
    bb.render_view(parts, "05", show, 16, 38, 62, os.path.join(outdir, "05-cena-com-sacola.png"), (W, int(W * 0.7)), smp,
                   margin=1.12, lid="closed", hide=("sacola_aberta",))


def main():
    outdir = EA.renders
    os.makedirs(outdir, exist_ok=True)
    if "icons" in STEPS:
        make_icons(outdir)
        contact_sheet(outdir)
    if "renders" in STEPS:
        make_renders(outdir)


main()
