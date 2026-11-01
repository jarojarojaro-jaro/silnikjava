"""Render statyczny świata: promień z każdego piksela przez siatkę (DDA), trafiona ścianka,
tekstura proceduralna, okluzja (rogi + szeroka), miękkie cienie słońca, mapy świateł.

Wynik (static.npz) zależy tylko od świata i oświetlenia; animacja (woda, światła, kamera,
ASCII) jest w look.py i liczy się na nim klatka po klatce.
"""
import time
import numpy as np
from scipy.ndimage import gaussian_filter, distance_transform_edt

from . import materials as M


class Camera:
    """Rzut ortograficzny: azymut az i elewacja el (stopnie), S px na woksel, ognisko w środku obrazu."""

    def __init__(self, az=30.0, el=55.0, scale=10.0, focus=(128, 128, 14), size=(1280, 2240)):
        self.az, self.el, self.S = np.radians(az), np.radians(el), float(scale)
        self.ca, self.sa = np.cos(self.az), np.sin(self.az)
        self.ce, self.se = np.cos(self.el), np.sin(self.el)
        self.focus = tuple(float(v) for v in focus)
        self.RW, self.RH = size
        self.view = np.array([self.sa * self.ce, self.ca * self.ce, self.se])  # w stronę kamery
        fx, fy, fz = self.focus
        self.uF = fx * self.ca - fy * self.sa
        self.vF = (fx * self.sa + fy * self.ca) * self.se - fz * self.ce

    def project(self, x, y, z):
        u = x * self.ca - y * self.sa
        v = (x * self.sa + y * self.ca) * self.se - z * self.ce
        return self.RW / 2 + (u - self.uF) * self.S, self.RH / 2 + (v - self.vF) * self.S

    def unproject(self, px, py, z):
        """Punkt świata na wysokości z, który rzutuje się w środek piksela (px, py)."""
        u = self.uF + (px + 0.5 - self.RW / 2) / self.S
        v = self.vF + (py + 0.5 - self.RH / 2) / self.S
        b = (v + z * self.ce) / self.se
        return u * self.ca + b * self.sa, -u * self.sa + b * self.ca

    def params(self):
        return np.array([np.degrees(self.az), np.degrees(self.el), self.S, *self.focus, self.RW, self.RH], np.float64)


def hash_u32(*arrs):
    h = np.full(np.broadcast(*arrs).shape, 2166136261, np.uint32)
    for a in arrs:
        a = np.asarray(a).astype(np.int64).astype(np.uint32)
        h = (h ^ a) * np.uint32(16777619)
        h ^= h >> np.uint32(13)
        h = h * np.uint32(0x5bd1e995)
        h ^= h >> np.uint32(15)
    return h


def h01(*arrs):
    return (hash_u32(*arrs) & np.uint32(0xFFFFFF)).astype(np.float32) / np.float32(0xFFFFFF)


def primary(g, cam, rows=None):
    """Promienie kamery przez siatkę. Zwraca materiał, oś ścianki (0 x, 1 y, 2 z), punkt trafienia, komórkę.
    rows: opcjonalny zakres wierszy obrazu (do testów)."""
    Xn, Yn, Zn = g.shape
    flat = g.reshape(-1)
    r0, r1 = rows if rows else (0, cam.RH)
    py, px = np.mgrid[r0:r1, 0:cam.RW]
    zt = Zn - 1e-3
    ox, oy = cam.unproject(px.ravel(), py.ravel(), zt)
    oz = np.full_like(ox, zt)
    dx, dy, dz = -cam.view
    # wejście do pudła świata od strony +x / +y
    t0 = np.maximum(0, np.maximum((ox - (Xn - 1e-3)) / -dx, (oy - (Yn - 1e-3)) / -dy))
    N = ox.size
    px_, py_, pz_ = ox + dx * t0, oy + dy * t0, oz + dz * t0
    cx, cy, cz = np.floor(px_).astype(np.int32), np.floor(py_).astype(np.int32), np.floor(pz_).astype(np.int32)
    tdx, tdy, tdz = 1 / -dx, 1 / -dy, 1 / -dz
    tmx, tmy, tmz = t0 + (px_ - cx) * tdx, t0 + (py_ - cy) * tdy, t0 + (pz_ - cz) * tdz
    tc = t0.copy()
    axis = np.full(N, 2, np.int8)
    idx = np.arange(N)
    out_mat = np.zeros(N, np.uint8)
    out_axis = np.full(N, 2, np.int8)
    out_t = np.zeros(N, np.float64)
    out_c = np.zeros((N, 3), np.int32)
    alive = (cx >= 0) & (cy >= 0) & (cz >= 0) & (cx < Xn) & (cy < Yn)
    while idx.size:
        idx, cx, cy, cz, tmx, tmy, tmz, tc, axis = (a[alive] for a in (idx, cx, cy, cz, tmx, tmy, tmz, tc, axis))
        if not idx.size:
            break
        m = flat[(cx * Yn + cy) * Zn + cz]
        hit = m != 0
        if hit.any():
            hi = idx[hit]
            out_mat[hi], out_axis[hi], out_t[hi] = m[hit], axis[hit], tc[hit]
            out_c[hi, 0], out_c[hi, 1], out_c[hi, 2] = cx[hit], cy[hit], cz[hit]
        go = ~hit
        idx, cx, cy, cz, tmx, tmy, tmz, tc, axis = (a[go] for a in (idx, cx, cy, cz, tmx, tmy, tmz, tc, axis))
        ax = np.where(tmx < tmy, np.where(tmx < tmz, 0, 2), np.where(tmy < tmz, 1, 2)).astype(np.int8)
        s0, s1, s2 = ax == 0, ax == 1, ax == 2
        tc = np.where(s0, tmx, np.where(s1, tmy, tmz))
        cx, cy, cz = cx - s0, cy - s1, cz - s2
        tmx, tmy, tmz = tmx + s0 * tdx, tmy + s1 * tdy, tmz + s2 * tdz
        axis = ax
        alive = (cx >= 0) & (cy >= 0) & (cz >= 0)
    P = np.stack([ox + dx * out_t, oy + dy * out_t, oz + dz * out_t], 1).astype(np.float32)
    return out_mat, out_axis, P, out_c


def shadow(occ, P, L, maxit=800):
    """1 = punkt widzi słońce w kierunku L, 0 = zasłonięty."""
    Xn, Yn, Zn = occ.shape
    flat = occ.reshape(-1)
    lit = np.ones(P.shape[0], np.float32)
    pos = P.astype(np.float64)
    c = np.floor(pos).astype(np.int32)
    st = np.sign(L).astype(np.int32)
    td = np.abs(1 / np.where(L == 0, 1e-9, L))
    tm = np.where(L > 0, (c + 1 - pos) / np.where(L == 0, 1e-9, L), (pos - c) / np.where(L == 0, 1e-9, -L))
    idx = np.arange(P.shape[0])
    for _ in range(maxit):
        inside = (c >= 0).all(1) & (c[:, 0] < Xn) & (c[:, 1] < Yn) & (c[:, 2] < Zn)
        idx, c, tm = idx[inside], c[inside], tm[inside]
        if not idx.size:
            break
        blk = flat[(c[:, 0] * Yn + c[:, 1]) * Zn + c[:, 2]]
        lit[idx[blk]] = 0
        go = ~blk
        idx, c, tm = idx[go], c[go], tm[go]
        ax = np.argmin(tm, 1)
        r = np.arange(idx.size)
        c[r, ax] += st[ax]
        tm[r, ax] += td[ax]
    return lit


def ao_corner(occ, C, axis):
    """Okluzja w rogach ścianki (gładkie oświetlenie jak w grach z klocków): 4 rogi, 0..1."""
    Xn, Yn, Zn = occ.shape
    n = C.shape[0]
    nrm = np.zeros((n, 3), np.int32)
    nrm[np.arange(n), axis] = 1
    t1 = np.zeros((n, 3), np.int32)
    t2 = np.zeros((n, 3), np.int32)
    t1[axis == 2, 0] = 1; t2[axis == 2, 1] = 1
    t1[axis == 0, 1] = 1; t2[axis == 0, 2] = 1
    t1[axis == 1, 0] = 1; t2[axis == 1, 2] = 1
    base = C + nrm

    def o(a, b):
        p = base + t1 * a + t2 * b
        ok = (p >= 0).all(1) & (p[:, 0] < Xn) & (p[:, 1] < Yn) & (p[:, 2] < Zn)
        p = np.clip(p, 0, [Xn - 1, Yn - 1, Zn - 1])
        return (occ[p[:, 0], p[:, 1], p[:, 2]] & ok).astype(np.float32)

    vals = {(a, b): o(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b}

    def corner(a, b):
        s1, s2, cc = vals[a, 0], vals[0, b], vals[a, b]
        return np.where((s1 + s2) == 2, 0.0, 3 - (s1 + s2 + cc)) / 3
    return {k: corner(*k) for k in ((-1, -1), (1, -1), (-1, 1), (1, 1))}


def face_uv(axis, P, C):
    """Współrzędne na ściance: a, b wzdłuż osi stycznych (do AO) oraz u, v do tekstur (v=1 u góry ściany)."""
    fx, fy, fz = (np.clip(P[:, i] - C[:, i], 0, 0.999) for i in range(3))
    a = np.where(axis == 0, fy, fx)
    b = np.where(axis == 2, fy, fz)
    return fx, fy, fz, a, b


def textures(mat, axis, P, C, WL=0):
    """Albedo i emisja (RGB) dla trafionych pikseli: proceduralne tekstury materiałów."""
    n = mat.size
    alb = np.zeros((n, 3), np.float32)
    emi = np.zeros((n, 3), np.float32)
    fx, fy, fz, u, v = face_uv(axis, P, C)
    T = 4
    tu, tv = np.floor(u * T).astype(np.int32), np.floor(v * T).astype(np.int32)
    cx, cy, cz = C[:, 0], C[:, 1], C[:, 2]
    ht = h01(cx, cy, cz, axis, tu, tv)          # szum na teksel
    hc = h01(cx, cy, cz, 77)                    # szum na klocek
    hb = h01(cx // 2, cy // 2, cz // 2, tu // 2, tv // 2, axis)  # plamy 2×2
    top = axis == 2

    def col(m, rgb):
        return np.broadcast_to(np.array(rgb, np.float32), (int(m.sum()), 3)).copy()

    def setm(code, fn):
        m = mat == code
        if m.any():
            alb[m] = fn(m)

    def var(m, base, amp, h=None):
        h = ht[m] if h is None else h
        return col(m, base) * (1 + (h[:, None] - 0.5) * amp) * (1 + (hc[m][:, None] - 0.5) * amp * 0.5)

    def grass(m):
        c = var(m, (0.34, 0.53, 0.20), 0.22)
        h = ht[m]; tp = top[m]
        c[h < 0.12] *= 0.74
        c[h > 0.93] = c[h > 0.93] * 1.15 + np.array([0.05, 0.05, 0.0])
        fl = tp & (hc[m] < 0.06) & (tu[m] >= 1) & (tu[m] <= 2) & (tv[m] >= 1) & (tv[m] <= 2)
        fcols = np.array([(0.92, 0.25, 0.22), (0.98, 0.86, 0.30), (0.96, 0.95, 0.92), (0.70, 0.45, 0.90)], np.float32)
        c[fl] = fcols[(h01(cx[m], cy[m], 5)[fl] * 4).astype(int) % 4]
        edge = 0.70 + 0.16 * h01(cx[m], cy[m], cz[m], axis[m], tu[m])
        dirt = (~tp) & (v[m] < edge)
        c[dirt] = var(m, (0.43, 0.31, 0.20), 0.2)[dirt]
        return c
    setm(M.GRASS, grass)
    setm(M.DIRT, lambda m: var(m, (0.43, 0.31, 0.20), 0.24))

    def stone(base):
        def f(m):
            c = var(m, base, 0.12, hb[m]) * (1 + (ht[m][:, None] - 0.5) * 0.10)
            c[ht[m] < 0.07] *= 0.72
            return c
        return f
    setm(M.STONE, stone((0.53, 0.52, 0.51)))
    setm(M.STONE_D, stone((0.41, 0.40, 0.41)))
    setm(M.CHIMNEY, stone((0.55, 0.44, 0.38)))
    setm(M.LANT_STONE, stone((0.66, 0.65, 0.62)))

    def moss(m):
        c = stone((0.50, 0.50, 0.49))(m)
        g = hb[m] > 0.42
        c[g] = var(m, (0.30, 0.43, 0.18), 0.25)[g]
        return c
    setm(M.MOSS, moss)

    def sand(m):
        c = var(m, (0.87, 0.77, 0.56), 0.10)
        c[ht[m] > 0.9] *= 0.88
        return c
    setm(M.SAND, sand)

    def snow(m):
        c = var(m, (0.93, 0.95, 0.99), 0.06)
        c[ht[m] > 0.95] = (1.0, 1.0, 1.0)  # iskierki
        side = ~top[m]
        c[side] *= np.array([0.92, 0.95, 1.0])
        return c
    setm(M.SNOW, snow)

    def log(birch):
        def f(m):
            if birch:
                c = var(m, (0.90, 0.88, 0.82), 0.06)
                row = np.floor(v[m] * 8).astype(int)
                mark = (~top[m]) & (h01(cx[m], cy[m], cz[m], row, axis[m]) < 0.22) & (np.abs(u[m] - h01(cx[m], cz[m], row)) < 0.32)
                c[mark] = (0.13, 0.12, 0.12)
            else:
                c = var(m, (0.36, 0.25, 0.16), 0.18, h01(cx[m], cy[m], axis[m], tu[m]))
            rr = np.hypot(u[m] - 0.5, v[m] - 0.5)
            ring = top[m]
            c[ring] = np.array((0.62, 0.48, 0.30)) * (0.85 + 0.15 * (np.sin(rr[ring] * 30) > 0))[:, None]
            return c
        return f
    setm(M.LOG_OAK, log(False))
    setm(M.LOG_BIRCH, log(True))

    def leaves(base, alt):
        def f(m):
            c = var(m, base, 0.35)
            h = ht[m]
            c[h < 0.13] *= 0.52
            c[h > 0.92] = np.array(alt, np.float32)
            return c
        return f
    setm(M.LEAF_GOLD, leaves((0.96, 0.72, 0.17), (0.97, 0.52, 0.12)))
    setm(M.LEAF_ORANGE, leaves((0.90, 0.40, 0.12), (0.75, 0.18, 0.10)))
    setm(M.LEAF_RED, leaves((0.78, 0.15, 0.10), (0.92, 0.35, 0.12)))
    setm(M.LEAF_PINE, leaves((0.13, 0.30, 0.17), (0.22, 0.42, 0.22)))
    setm(M.LEAF_GREEN, leaves((0.30, 0.48, 0.18), (0.55, 0.62, 0.20)))

    def planks(base, seams=3):
        def f(m):
            across = np.where(axis[m] == 2, fx[m], fz[m])
            k = np.floor(across * seams)
            c = var(m, base, 0.10, h01(cx[m], cy[m] // 3, k, 3))
            c[(across * seams) % 1 < 0.14] *= 0.62
            return c
        return f
    setm(M.PLANKS, planks((0.62, 0.45, 0.27)))
    setm(M.BOAT, planks((0.70, 0.53, 0.33), 2))
    setm(M.DOOR, planks((0.36, 0.22, 0.12)))
    setm(M.WOOD_DARK, planks((0.24, 0.17, 0.13), 2))

    def masonry(base, amp=0.06):
        def f(m):
            c = var(m, base, amp)
            c[(~top[m]) & ((v[m] * 2) % 1 < 0.09)] *= 0.84
            return c
        return f
    setm(M.BRICK_RED, masonry((0.76, 0.16, 0.12)))
    setm(M.PLASTER, masonry((0.93, 0.91, 0.86), 0.04))
    setm(M.BOAT_RED, lambda m: var(m, (0.78, 0.18, 0.14), 0.08))
    setm(M.SAIL, lambda m: var(m, (0.94, 0.92, 0.86), 0.05))
    setm(M.LACQUER, lambda m: var(m, (0.86, 0.17, 0.10), 0.07))

    def roof(base):
        def f(m):
            c = var(m, base, 0.12)
            rowv = np.where(top[m], fy[m], v[m])
            c[(rowv * 2) % 1 < 0.16] *= 0.66
            c[((u[m] * 2 + np.floor(rowv * 2) * 0.5) % 1) < 0.08] *= 0.8
            return c
        return f
    setm(M.ROOF, roof((0.64, 0.18, 0.12)))
    setm(M.ROOF_GREEN, roof((0.33, 0.58, 0.48)))
    setm(M.IRON, lambda m: var(m, (0.14, 0.14, 0.16), 0.15))

    def cobble(m):
        su, sv = np.floor(u[m] * 3), np.floor(v[m] * 3)
        c = var(m, (0.56, 0.55, 0.53), 0.25, h01(cx[m], cy[m], cz[m], su, sv))
        c[((u[m] * 3) % 1 < 0.16) | ((v[m] * 3) % 1 < 0.16)] = (0.31, 0.30, 0.29)
        return c
    setm(M.COBBLE, cobble)

    def rock(m):
        c = stone((0.30, 0.31, 0.33))(m)
        c[cz[m] <= WL] *= 0.72
        alg = cz[m] == WL
        c[alg] = var(m, (0.22, 0.32, 0.18), 0.3)[alg]
        return c
    setm(M.ROCK_SEA, rock)
    setm(M.FOX, lambda m: var(m, (0.92, 0.46, 0.13), 0.08))
    setm(M.FOX_WHITE, lambda m: var(m, (0.95, 0.93, 0.88), 0.04))
    setm(M.FOX_DARK, lambda m: var(m, (0.15, 0.10, 0.08), 0.1))

    # świecące: szkło laterny, lampy, okna, papier latarni — ciemna ramka, jasny środek
    for code, (rgb, k) in M.EMISSIVE.items():
        m = mat == code
        if not m.any():
            continue
        frame = (np.abs(u[m] - 0.5) < 0.07) | (u[m] < 0.08) | (u[m] > 0.92)
        if code != M.GLASS_LAMP:
            frame |= (np.abs(v[m] - 0.5) < 0.07) | (v[m] < 0.08) | (v[m] > 0.92)
        e = col(m, rgb) * k * (0.9 + 0.2 * ht[m][:, None])
        e[frame] = 0
        a = np.zeros_like(e)
        a[frame] = (0.18, 0.15, 0.13)
        alb[m], emi[m] = a, e
    return alb, emi


def render_static(world_path, cfg, out_path, log=print):
    """Liczy obraz bazowy, albedo, mapy świateł i atrybuty wody; zapisuje do out_path (npz)."""
    t0 = time.time()
    d = np.load(world_path)
    g, floor, lights, WL = d['g'], d['floor'], d['lights'], int(d['WL'])
    marks = {k[5:]: d[k] for k in d.files if k.startswith('mark_')}
    cc, lc = cfg['camera'], cfg['light']
    cam = Camera(cc['az'], cc['el'], cc['scale'], cc['focus'], tuple(cc['size']))
    RW, RH = cam.RW, cam.RH
    occ = (g != M.AIR) & (g != M.WATER)
    mat, axis, P, C = primary(g, cam)
    log('  promienie %.0fs' % (time.time() - t0))
    hit = mat != 0
    water = mat == M.WATER
    solidhit = hit & ~water
    N = mat.size
    nrm = np.zeros((N, 3), np.float32)
    nrm[np.arange(N), axis] = 1

    sun_dir = np.array(lc['sun_dir'], float)
    sun_dir /= np.linalg.norm(sun_dir)
    origin = P + nrm * 0.02
    sh = np.zeros(N, np.float32)
    jit = [np.zeros(3), np.array([0.05, -0.03, 0.02]), np.array([-0.04, 0.03, -0.02])][:lc.get('shadow_samples', 3)]
    for j in jit:
        Lj = sun_dir + j
        sh[hit] += shadow(occ, origin[hit], Lj / np.linalg.norm(Lj)) / len(jit)
    log('  cienie %.0fs' % (time.time() - t0))

    aoc = np.ones(N, np.float32)
    k = ao_corner(occ, C[solidhit], axis[solidhit])
    _, _, _, a, b = face_uv(axis[solidhit], P[solidhit], C[solidhit])
    ao = k[-1, -1] * (1 - a) * (1 - b) + k[1, -1] * a * (1 - b) + k[-1, 1] * (1 - a) * b + k[1, 1] * a * b
    aoc[solidhit] = 0.42 + 0.58 * ao
    occf = occ.astype(np.float32)
    blur = gaussian_filter(occf, 2.2) * 0.65 + gaussian_filter(occf, 5.0) * 0.35
    q = np.clip(np.round(P + nrm * 1.6), 0, np.array(g.shape) - 1).astype(int)
    aob = 1 - 1.35 * np.clip(blur[q[:, 0], q[:, 1], q[:, 2]] - 0.04, 0, 0.62)
    log('  okluzja %.0fs' % (time.time() - t0))

    alb = np.zeros((N, 3), np.float32)
    emi = np.zeros((N, 3), np.float32)
    alb[solidhit], emi[solidhit] = textures(mat[solidhit], axis[solidhit], P[solidhit], C[solidhit], WL)

    lam = np.clip(nrm @ sun_dir, 0, 1)
    amb = np.where((axis == 2)[:, None], np.array(lc['sky_top'], np.float32),
                   np.array(lc['sky_side'], np.float32) + np.array(lc['bounce'], np.float32))
    light = amb * (aoc * aob)[:, None] + np.array(lc['sun'], np.float32) * (lam * sh)[:, None]
    base = alb * light + emi * lc.get('emission', 1.0)

    groups = np.zeros((4, N, 3), np.float16)
    for (lx, ly, lz, r, gg, bb, rad, grp) in lights:
        vec = np.array([lx, ly, lz], np.float32) - P
        dist = np.linalg.norm(vec, axis=1) + 1e-3
        sel = hit & (dist < rad * 3)
        if not sel.any():
            continue
        lamb = np.clip((nrm[sel] * vec[sel]).sum(1) / dist[sel], 0, 1) * 0.8 + 0.2
        att = 1.6 / (1 + (dist[sel] / (rad * 0.5)) ** 2) * np.clip(1 - (dist[sel] / (rad * 3)) ** 2, 0, 1)
        groups[int(grp), sel] += (np.array([r, gg, bb], np.float32) * (att * lamb)[:, None]).astype(np.float16)

    wi = np.clip(np.floor(P[:, :2]).astype(int), 0, [g.shape[0] - 1, g.shape[1] - 1])
    if WL > 0:
        landmask = occ[:, :, WL] | (occ[:, :, WL - 1] & (g[:, :, WL - 1] != M.WATER))
        shore = distance_transform_edt(~landmask).astype(np.float32)
        depth = (WL - floor[wi[:, 0], wi[:, 1]]).astype(np.float32)
        wshore = shore[wi[:, 0], wi[:, 1]]
    else:
        depth = np.zeros(N, np.float32)
        wshore = np.zeros(N, np.float32)
    mark_px = {f'px_{k}': np.array(cam.project(*v)) for k, v in marks.items()}
    np.savez(out_path, base=base.reshape(RH, RW, 3).astype(np.float32),
             alb=alb.reshape(RH, RW, 3).astype(np.float16), groups=groups.reshape(4, RH, RW, 3),
             water=water.reshape(RH, RW), wxy=P[:, :2].reshape(RH, RW, 2).astype(np.float32),
             depth=depth.reshape(RH, RW), shore=wshore.reshape(RH, RW), sh=sh.reshape(RH, RW),
             cam=cam.params(), WL=np.int32(WL), world=np.array(g.shape), **mark_px)
    log('  render statyczny gotowy: %.0fs' % (time.time() - t0))
