"""Zimowa świątynia na wzgórzu (test skilla: inna sceneria, bez morza, ze strumieniem).

Wzgórze z lasem (złote miłorzęby, czerwone klony, ośnieżone sosny), płaty śniegu,
kamienne schody z trzema bramami torii i latarniami tōrō, sanktuarium z zieloną
miedzianą dachówką i podświetlonym papierem, strumień z łukowym mostkiem, lis na schodach.
"""
import numpy as np

from voxlib import materials as M
from voxlib.world import World

CONFIG = dict(
    camera=dict(az=20, el=55, scale=9.2, focus=(126, 110, 22), size=(1280, 2240)),
    light=dict(sun_dir=(-0.35, 0.80, 0.52), sun=(1.15, 0.98, 0.82), sky_top=(0.48, 0.54, 0.72),
               sky_side=(0.36, 0.40, 0.56), bounce=(0.10, 0.09, 0.08)),
    look=dict(effects=('snow', 'leaves'), seconds=20, haze=(0.82, 0.84, 0.92), haze_amount=0.45,
              warm=(0.03, 0.015, -0.02), cool=(-0.03, 0.0, 0.05), leaves=40,
              leaf_colors=((1.10, 0.80, 0.22), (0.95, 0.25, 0.12)),
              water=dict(sky=(0.80, 0.86, 0.96), shallow=(0.36, 0.66, 0.70), mid=(0.16, 0.42, 0.52)),
              move=dict(zoom=0.07, start=(10, 50), end=(-10, -40))),
)

VARIANTS = {
    'zmierzch': dict(
        light=dict(sun=(0.85, 0.55, 0.40), sky_top=(0.26, 0.28, 0.44), sky_side=(0.18, 0.20, 0.32), emission=1.2),
        look=dict(light_gain=1.3, exposure=1.32, haze=(0.45, 0.38, 0.50), bloom=0.6),
    ),
}

WL = 7
SX0, SX1 = 125, 131  # schody wzdłuż +y


def build():
    w = World(256, 256, 96, water_level=WL, seed=11)
    X, Y, Z = w.X, w.Y, w.Z
    g = w.g
    d = (w.xs + w.ys) / 2.0
    l = (w.xs - w.ys) / 2.0
    n3, n6, n12, n24 = (w.noise(s) for s in (3, 6, 12, 24))

    # wzgórze: łagodny stok ku widzowi, strumień w poprzek, łąka na dole
    hill = 8 + 30 * np.clip((152 - d) / 62, 0, 1) ** 1.25
    H = hill + 1.6 * n12 + 0.8 * n6
    ds = 166 + 4 * np.sin(l * 0.06) + 1.5 * n24
    dist = np.abs(d - ds)
    H = np.where(dist < 5, 4 + 0.5 * n6, np.where(dist < 7.5, np.minimum(H, 7 + 0.4 * n6), H))
    H = np.where(d > ds + 7.5, 8.4 + 0.5 * n12, H)
    H = np.clip(np.round(H), 1, Z - 40).astype(int)
    w.H[:] = H

    zz = np.arange(Z)[None, None, :]
    Hb = H[:, :, None]
    depth = Hb - 1 - zz
    strata = ((zz + np.round(n6[:, :, None] * 1.5)) // 3) % 2
    mat = np.where(strata == 0, M.STONE, M.STONE_D).astype(np.uint8)
    mat = np.where((depth >= 1) & (depth <= 3), M.DIRT, mat)
    snowy = (n6 > 0.25) | ((d > ds + 7.5) & (n6 > -0.2)) | (n12 > 1.1)
    top = np.where(snowy, M.SNOW, M.GRASS)
    top = np.where(dist < 7.5, M.SAND, top)
    mat = np.where(depth == 0, top[:, :, None], mat)
    mat = np.where((dist[:, :, None] < 7.5) & (depth >= 1) & (depth <= 2), M.SAND, mat)
    g[:] = np.where(zz < Hb, mat, M.AIR)
    w.fill_water()

    # sanktuarium na szczycie: kamienna platforma, ściany z papierem, zielony dach czterospadowy
    zt = int(np.max(w.H[112:146, 32:64]))
    w.flatten(110, 147, 30, 66, zt, top=M.SNOW)
    w.put(114, 143, 36, 60, zt, zt + 2, M.LANT_STONE)
    zb = zt + 2
    w.put(118, 139, 40, 56, zb, zb + 8, M.PLASTER)
    w.put(119, 138, 41, 55, zb, zb + 8, M.AIR)
    for x in range(118, 139, 4):
        w.put(x, x + 1, 55, 56, zb, zb + 8, M.WOOD_DARK)
    for y in range(40, 56, 4):
        w.put(138, 139, y, y + 1, zb, zb + 8, M.WOOD_DARK)
    for x in range(119, 138, 4):
        w.put(x, x + 3, 55, 56, zb + 2, zb + 6, M.PAPER_LIGHT)
    for y in range(41, 55, 4):
        w.put(138, 139, y, y + 3, zb + 2, zb + 6, M.PAPER_LIGHT)
    w.put(118, 139, 55, 56, zb + 7, zb + 8, M.WOOD_DARK)
    for k in range(7):
        w.put(115 + k, 142 - k, 37 + k, 59 - k, zb + 8 + k, zb + 9 + k, M.ROOF_GREEN)
    w.put(121, 136, 47, 49, zb + 15, zb + 17, M.WOOD_DARK)
    for (lx, ly) in ((128, 57), (140, 48)):
        w.light(lx, ly, zb + 4, (1.0, 0.72, 0.40), 9.0, 1)
    w.put(126, 130, 56, 60, zb - 1, zb, M.LANT_STONE)  # stopień przed wejściem

    # kamienne schody od sanktuarium do strumienia (wysokość = teren, nie rośnie w dół)
    sy0 = 60
    col = (SX0 + SX1) // 2
    ys = [y for y in range(sy0, Y) if dist[col, y] >= 7.5 and (col + y) / 2 < ds[col, y]]
    sy1 = ys[-1] if ys else 180
    zc = zt
    stair = {}
    for y in range(sy0, sy1 + 1):
        zc = min(zc, int(w.H[col, y]) if y > sy0 + 3 else zt)
        zc = max(zc, 8)
        stair[y] = zc
        g[SX0:SX1, y, zc:] = M.AIR
        g[SX0:SX1, y, :zc] = M.STONE
        g[SX0:SX1, y, zc - 1] = M.COBBLE
        w.H[SX0:SX1, y] = zc
        for cx in (SX0 - 1, SX1):  # kamienne obrzeża
            g[cx, y, zc:zc + 1] = M.LANT_STONE
            g[cx, y, :zc] = np.where(g[cx, y, :zc] == M.AIR, M.STONE, g[cx, y, :zc])
            w.H[cx, y] = max(int(w.H[cx, y]), zc + 1)
            g[cx, y, zc + 1:] = np.where(np.isin(g[cx, y, zc + 1:], (M.SNOW, M.GRASS, M.DIRT)), M.AIR, g[cx, y, zc + 1:])

    # mostek nad strumieniem: łuk z desek, czerwone poręcze
    by0, by1 = sy1 + 1, sy1 + 1
    while by1 < Y - 2 and dist[col, by1] < 7.5:
        by1 += 1
    span = max(1, by1 - by0)
    for y in range(by0 - 1, by1 + 2):
        s = np.clip((y - by0) / span, 0, 1)
        zd = 9 + int(round(2.2 * np.sin(np.pi * s)))
        w.put(SX0, SX1, y, y + 1, zd - 1, zd, M.PLANKS)
        w.put(SX0 - 1, SX0, y, y + 1, zd, zd + 2, M.LACQUER if y % 3 == 0 else M.AIR)
        w.put(SX1, SX1 + 1, y, y + 1, zd, zd + 2, M.LACQUER if y % 3 == 0 else M.AIR)
        w.put(SX0 - 1, SX0, y, y + 1, zd + 2, zd + 3, M.LACQUER)
        w.put(SX1, SX1 + 1, y, y + 1, zd + 2, zd + 3, M.LACQUER)
        if y % 6 == 0:
            for px in (SX0, SX1 - 1):
                w.put(px, px + 1, y, y + 1, 3, zd - 1, M.WOOD_DARK)
    # ścieżka za mostkiem przez łąkę
    w.path([(col, by1 + 2), (col - 4, by1 + 30), (col - 14, Y - 10)], width=2.4, mat=M.COBBLE, wobble=n3)

    # bramy torii nad schodami i kamienne latarnie po bokach
    for ty in (sy0 + 14, sy0 + (sy1 - sy0) // 2, sy1 - 6):
        w.torii(SX0 - 3, SX1 + 3, ty, stair[ty], height=14)
    for i, ly in enumerate(range(sy0 + 8, sy1 - 2, 13)):
        w.stone_lantern(SX0 - 4, ly, stair[ly], group=i % 3)
        w.stone_lantern(SX1 + 3, ly, stair[ly], group=(i + 1) % 3)

    # las na wzgórzu i kilka drzew na łące
    w.taken[SX0 - 8:SX1 + 8, :] = True
    w.taken[104:153, 24:72] = True
    w.taken |= dist < 9
    w.forest(lambda x, y: abs((x - y) / 2) <= 80 and (x + y) / 2 >= 20 and dist[x, y] >= 9,
             spacing=lambda x, y: 8.5 if (x + y) / 2 < ds[x, y] else 14,
             kinds=(0.30, 0.68), leaves=(M.LEAF_GOLD, M.LEAF_RED), snow=0.18)
    for _ in range(90):
        x, y = int(w.rng.integers(10, X - 10)), int(w.rng.integers(10, Y - 10))
        if not w.taken[x, y] and abs((x - y) / 2) <= 80 and dist[x, y] > 9:
            w.bush(x, y, M.LEAF_RED if w.rng.random() < 0.4 else M.LEAF_PINE)

    fy = sy0 + int((sy1 - sy0) * 0.62)
    w.fox(SX0 + 2, fy, stair[fy])
    return w
