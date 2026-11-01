"""Budowanie świata z wokseli: siatka materiałów + gotowe obiekty (drzewa, latarnie, łodzie…).

Układ: x, y na ziemi, z w górę. Kamera patrzy od +x+y+z, więc d = (x+y)/2 to głębia
(mała = tył kadru, góra ekranu), a widoczne są ściany +x, +y i góra. Dlatego obiekty
„frontem do widza” mają drzwi, okna i detale na ścianach +x / +y.
"""
import numpy as np
from scipy.ndimage import gaussian_filter

from . import materials as M


def noise2(rng, sigma, shape):
    """Gładki szum 2D o odchyleniu 1 (zawija się na brzegach)."""
    a = gaussian_filter(rng.standard_normal(shape), sigma, mode='wrap')
    return a / (a.std() + 1e-9)


class World:
    def __init__(self, X=256, Y=256, Z=96, water_level=0, seed=1):
        self.X, self.Y, self.Z = X, Y, Z
        self.WL = water_level
        self.g = np.zeros((X, Y, Z), np.uint8)
        self.H = np.zeros((X, Y), np.int32)  # wysokość terenu (pierwsza wolna komórka)
        self.rng = np.random.default_rng(seed)
        self.lights = []  # (x, y, z, (r, g, b), promień, grupa migotania 0..3)
        self.marks = {}   # nazwane punkty świata dla efektów (np. 'lamp' latarni)
        self.xs, self.ys = np.meshgrid(np.arange(X), np.arange(Y), indexing='ij')
        self.taken = np.zeros((X, Y), bool)  # miejsca zajęte (bez drzew)

    # ------------------------------------------------------------ podstawy
    def noise(self, sigma):
        return noise2(self.rng, sigma, (self.X, self.Y))

    def put(self, x0, x1, y0, y1, z0, z1, m):
        self.g[max(0, x0):x1, max(0, y0):y1, max(0, z0):z1] = m

    def light(self, x, y, z, color=(1.0, 0.62, 0.28), radius=9.0, group=0):
        self.lights.append((x, y, z, tuple(color), radius, group))

    def fill_water(self):
        """Woda w każdej pustej komórce poniżej poziomu WL."""
        if self.WL > 0:
            sub = self.g[:, :, :self.WL]
            sub[sub == M.AIR] = M.WATER

    def flatten(self, x0, x1, y0, y1, z, top=M.GRASS, under=M.DIRT):
        self.g[x0:x1, y0:y1, z:] = M.AIR
        sub = self.g[x0:x1, y0:y1, :z]
        sub[sub == M.AIR] = under
        self.g[x0:x1, y0:y1, z - 1] = top
        self.H[x0:x1, y0:y1] = z

    def path(self, points, width=1.6, mat=M.COBBLE, on=(M.GRASS, M.SNOW), wobble=None):
        """Ścieżka po wierzchu terenu (podmienia wierzchnią warstwę). Zwraca mapę odległości."""
        P = np.array(points, float)
        best = np.full((self.X, self.Y), 1e9)
        for a, b in zip(P[:-1], P[1:]):
            ab = b - a
            tt = np.clip(((self.xs - a[0]) * ab[0] + (self.ys - a[1]) * ab[1]) / (ab @ ab), 0, 1)
            best = np.minimum(best, np.hypot(self.xs - (a[0] + tt * ab[0]), self.ys - (a[1] + tt * ab[1])))
        sel = best < width + (0 if wobble is None else 0.5 * wobble)
        for x, y in zip(*np.nonzero(sel)):
            h = self.H[x, y]
            if h > 0 and self.g[x, y, h - 1] in on:
                self.g[x, y, h - 1] = mat
        return best

    def finalize(self):
        solid = (self.g != M.AIR) & (self.g != M.WATER)
        floor = np.argmax(~solid, axis=2).astype(np.int32)
        return floor

    def save(self, path):
        floor = self.finalize()
        lights = np.array([(*p[:3], *p[3], p[4], p[5]) for p in self.lights], np.float32).reshape(-1, 8)
        marks = {f'mark_{k}': np.array(v, np.float32) for k, v in self.marks.items()}
        np.savez_compressed(path, g=self.g, floor=floor, lights=lights, WL=np.int32(self.WL), **marks)

    # ------------------------------------------------------------ obiekty
    def lamp_post(self, x, y, z=None, height=4, group=0, color=(1.0, 0.62, 0.28), radius=9.0):
        """Żelazny słupek z lampą na szczycie."""
        z = int(self.H[x, y]) if z is None else z
        self.put(x, x + 1, y, y + 1, z, z + height, M.IRON)
        self.put(x, x + 1, y, y + 1, z + height, z + height + 1, M.LANT_LIGHT)
        self.put(x, x + 1, y, y + 1, z + height + 1, z + height + 2, M.IRON)
        self.light(x + 0.5, y + 0.5, z + height + 0.5, color, radius, group)

    def stone_lantern(self, x, y, z=None, group=0):
        """Kamienna latarnia (tōrō): podstawa, trzon, komora ze świecącym papierem, daszek."""
        z = int(self.H[x, y]) if z is None else z
        S = M.LANT_STONE
        self.put(x - 1, x + 2, y - 1, y + 2, z, z + 1, S)
        self.put(x, x + 1, y, y + 1, z + 1, z + 4, S)
        self.put(x - 1, x + 2, y - 1, y + 2, z + 4, z + 5, S)
        self.put(x, x + 1, y, y + 1, z + 5, z + 7, M.PAPER_LIGHT)
        self.put(x - 1, x + 2, y - 1, y + 2, z + 7, z + 8, S)
        self.put(x, x + 1, y, y + 1, z + 8, z + 9, S)
        self.light(x + 0.5, y + 0.5, z + 6, (1.0, 0.70, 0.38), 8.0, group)

    def torii(self, x0, x1, y, z, height=14, mat=M.LACQUER):
        """Brama torii w poprzek kierunku y: słupy w x0 i x1-1, dwie belki, wyższa wystaje."""
        self.put(x0, x0 + 2, y, y + 2, z, z + height, mat)
        self.put(x1 - 2, x1, y, y + 2, z, z + height, mat)
        self.put(x0 - 1, x1 + 1, y, y + 2, z + height - 4, z + height - 3, mat)  # nuki
        self.put(x0 - 3, x1 + 3, y, y + 2, z + height, z + height + 1, M.WOOD_DARK)  # kasagi
        self.put(x0 - 2, x1 + 2, y, y + 2, z + height - 1, z + height, mat)
        self.put(x0 - 4, x0 - 2, y, y + 2, z + height + 1, z + height + 2, M.WOOD_DARK)  # zadarte końce
        self.put(x1 + 2, x1 + 4, y, y + 2, z + height + 1, z + height + 2, M.WOOD_DARK)

    def tree_deciduous(self, x, y, leaf=M.LEAF_GOLD, trunk=M.LOG_BIRCH, snow=0.0):
        rng = self.rng
        h = int(self.H[x, y])
        ht = int(rng.integers(7, 12))
        self.put(x, x + 1, y, y + 1, h, h + ht, trunk)
        rx, rz = rng.uniform(3.6, 5.6), rng.uniform(3.0, 4.4)
        cz = h + ht
        for dx in range(-6, 7):
            for dy in range(-6, 7):
                for dz in range(-5, 6):
                    e = (dx / rx) ** 2 + (dy / rx) ** 2 + (dz / rz) ** 2
                    if e < 1 + 0.17 * rng.standard_normal() and rng.random() > 0.12:
                        X, Y, Z = x + dx, y + dy, cz + dz
                        if 0 <= X < self.X and 0 <= Y < self.Y and 0 <= Z < self.Z and self.g[X, Y, Z] == M.AIR:
                            self.g[X, Y, Z] = leaf
        for _ in range(3):
            bx, by = rng.integers(-2, 3), rng.integers(-2, 3)
            self.g[x + bx, y + by, cz - 1] = trunk
        if snow > 0:
            self.snow_cap(x - 7, x + 8, y - 7, y + 8, snow)

    def tree_pine(self, x, y, snow=0.0):
        rng = self.rng
        h = int(self.H[x, y])
        ht = int(rng.integers(12, 18))
        self.put(x, x + 1, y, y + 1, h, h + 4, M.LOG_OAK)
        for k in range(ht):
            z = h + 2 + k
            r = (1 - k / ht) * 4.2 + (0.8 if k % 3 == 0 else 0)
            for dx in range(-5, 6):
                for dy in range(-5, 6):
                    if dx * dx + dy * dy <= r * r + rng.random() * 0.8 and 0 <= z < self.Z:
                        if self.g[x + dx, y + dy, z] == M.AIR:
                            self.g[x + dx, y + dy, z] = M.LEAF_PINE
        self.g[x, y, h + 2 + ht] = M.LEAF_PINE
        if snow > 0:
            self.snow_cap(x - 6, x + 7, y - 6, y + 7, snow)

    def snow_cap(self, x0, x1, y0, y1, chance=0.7):
        """Śnieg na najwyższych liściach w kolumnach obszaru (czapa na koronie)."""
        for x in range(max(0, x0), min(self.X, x1)):
            for y in range(max(0, y0), min(self.Y, y1)):
                col = self.g[x, y]
                nz = np.nonzero(col)[0]
                if nz.size and col[nz[-1]] in (M.LEAF_PINE, M.LEAF_GOLD, M.LEAF_ORANGE, M.LEAF_RED, M.LEAF_GREEN):
                    if self.rng.random() < chance and nz[-1] + 1 < self.Z:
                        self.g[x, y, nz[-1] + 1] = M.SNOW

    def bush(self, x, y, leaf=M.LEAF_GREEN):
        h = int(self.H[x, y])
        r = self.rng.uniform(1.2, 2.2)
        for dx in range(-3, 4):
            for dy in range(-3, 4):
                for dz in range(0, 3):
                    if dx * dx + dy * dy + (dz * 1.6) ** 2 <= r * r and self.g[x + dx, y + dy, h + dz] == M.AIR:
                        self.g[x + dx, y + dy, h + dz] = leaf

    def forest(self, accept, count=6000, spacing=7.0, kinds=(0.33, 0.8), snow=0.0, leaves=(M.LEAF_GOLD, M.LEAF_ORANGE)):
        """Las: losowe punkty z odstępem; accept(x, y) mówi, gdzie wolno sadzić.
        kinds = (próg sosny, próg pierwszego liścia): poniżej pierwszego — sosna, dalej liściaste."""
        pts = []
        rng = self.rng
        for _ in range(count):
            x, y = int(rng.integers(10, self.X - 10)), int(rng.integers(10, self.Y - 10))
            if self.taken[x, y] or not accept(x, y):
                continue
            sp = spacing(x, y) if callable(spacing) else spacing
            if any((x - px) ** 2 + (y - py) ** 2 < sp * sp for px, py in pts):
                continue
            pts.append((x, y))
        for (x, y) in pts:
            k = rng.random()
            if k < kinds[0]:
                self.tree_pine(x, y, min(1.0, snow * 2.2))
            else:
                leaf = leaves[0] if k < kinds[1] else leaves[1]
                trunk = M.LOG_BIRCH if rng.random() < 0.6 else M.LOG_OAK
                self.tree_deciduous(x, y, leaf, trunk, snow)
        return pts

    def boat(self, x, y, length=14, along='y', mast=True):
        """Łódź na wodzie (kadłub wzdłuż osi `along`), z masztem i żaglem."""
        WL = self.WL
        for i in range(length):
            f = i / (length - 1) * 2 - 1
            hw = 2.6 * np.sqrt(max(0.0, 1 - abs(f) ** 2.6)) * (length / 14) ** 0.3
            for j in range(-3, 4):
                if abs(j) > hw:
                    continue
                X, Y = (x + j, y + i) if along == 'y' else (x + i, y + j)
                if abs(j) > hw - 1.0 or abs(f) > 0.85:
                    self.put(X, X + 1, Y, Y + 1, WL - 1, WL + 1, M.BOAT)
                    self.put(X, X + 1, Y, Y + 1, WL, WL + 1, M.BOAT_RED)
                else:
                    self.put(X, X + 1, Y, Y + 1, WL - 1, WL, M.PLANKS)
        if mast:
            mx, my = (x, y + length // 2 - 2) if along == 'y' else (x + length // 2 - 2, y)
            self.put(mx, mx + 1, my, my + 1, WL, WL + 11, M.LOG_OAK)
            for z in range(WL + 3, WL + 10):
                w = int((z - WL - 3) * 0.6) + 1
                if along == 'y':
                    self.put(mx, mx + 1, my + 1, my + 1 + w, z, z + 1, M.SAIL)
                else:
                    self.put(mx + 1, mx + 1 + w, my, my + 1, z, z + 1, M.SAIL)

    def rock(self, rx, ry, rr, rh, n3):
        for x in range(int(rx - rr - 1), int(rx + rr + 2)):
            for y in range(int(ry - rr - 1), int(ry + rr + 2)):
                dd = np.hypot(x - rx, y - ry) / rr + 0.25 * n3[x, y]
                if dd < 1:
                    top = self.WL + int(round(rh * (1 - dd ** 2)))
                    self.put(x, x + 1, y, y + 1, 1, top, M.ROCK_SEA)
                    self.H[x, y] = max(self.H[x, y], top)

    def fox(self, fx, fy, fz=None, facing='+y'):
        """Siedzący lis (pyszczek w stronę +y, czyli lekko do widza)."""
        fz = int(self.H[fx, fy]) if fz is None else fz
        p = self.put
        p(fx, fx + 2, fy, fy + 4, fz, fz + 2, M.FOX)
        p(fx, fx + 2, fy + 3, fy + 5, fz + 1, fz + 3, M.FOX)
        p(fx, fx + 2, fy + 5, fy + 6, fz + 1, fz + 2, M.FOX_WHITE)
        p(fx, fx + 1, fy + 3, fy + 4, fz + 3, fz + 4, M.FOX_DARK)
        p(fx + 1, fx + 2, fy + 3, fy + 4, fz + 3, fz + 4, M.FOX_DARK)
        p(fx, fx + 2, fy + 2, fy + 3, fz, fz + 1, M.FOX_WHITE)
        p(fx, fx + 1, fy - 3, fy, fz + 1, fz + 2, M.FOX)
        p(fx, fx + 1, fy - 4, fy - 3, fz + 1, fz + 2, M.FOX_WHITE)
