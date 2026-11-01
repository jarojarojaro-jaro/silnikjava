"""Latarnia morska na klifie o zachodzie słońca (pierwszy film skilla).

Płaskowyż z jesiennym lasem, chata latarnika, latarnia w czerwono-białe pasy, kamienne
schody w dół klifu, plaża, molo z lampami, łódź, skały w morzu, boja, łódka wiosłowa, lis.
Wariant „noc”: księżyc, mocniejsze lampy i snop latarni.
"""
import numpy as np

from voxlib import materials as M
from voxlib.world import World

CONFIG = dict(
    camera=dict(az=30, el=55, scale=10, focus=(130, 136, 14), size=(1280, 2240)),
    light=dict(sun_dir=(-0.35, 0.80, 0.52), sun=(1.28, 0.95, 0.62), sky_top=(0.40, 0.46, 0.68),
               sky_side=(0.30, 0.34, 0.50), bounce=(0.12, 0.08, 0.05)),
    look=dict(effects=('birds', 'leaves', 'beam'), seconds=20),
)

VARIANTS = {
    'noc': dict(
        light=dict(sun_dir=(-0.50, 0.60, 0.62), sun=(0.24, 0.30, 0.48), sky_top=(0.10, 0.13, 0.25),
                   sky_side=(0.07, 0.09, 0.18), bounce=(0.02, 0.02, 0.03), emission=1.3),
        look=dict(effects=('beam', 'leaves'), exposure=1.45, haze=(0.10, 0.14, 0.30), haze_amount=0.5,
                  warm=(0.06, 0.03, -0.03), cool=(-0.02, 0.0, 0.05), light_gain=2.2, lamp_gain=2.6,
                  water=dict(sky=(0.16, 0.22, 0.42), glint=1.6, deep=(0.02, 0.10, 0.22), mid=(0.05, 0.25, 0.38)),
                  beam=dict(strength=1.5), bloom=0.85),
    ),
}

WL = 8


def build():
    w = World(256, 256, 96, water_level=WL, seed=4)
    X, Y, Z = w.X, w.Y, w.Z
    g = w.g
    d = (w.xs + w.ys) / 2.0
    l = (w.xs - w.ys) / 2.0
    n3, n6, n12, n24 = (w.noise(s) for s in (3, 6, 12, 24))

    # teren: płaskowyż → tarasowe zbocze klifu → plaża → dno morza
    cd = 124 + 4.0 * np.sin(l * 0.08) + 2.6 * n24 + 1.0 * n6
    zp = 30 + 1.3 * n24 + 0.8 * n12 + np.clip((cd - d) * 0.035, 0, 3)
    shore = cd + 21 + 3.0 * np.sin(l * 0.11 + 1.0) + 2.0 * n12
    beach = 9.2 + 0.6 * (n24 > 0.85) - 0.9 * np.clip(1 - (shore - d) / 5, 0, 1)
    sea = 7.6 - (d - shore) * 0.15 + 0.9 * n12 + 0.4 * n6
    t = np.clip((d - cd) / 9.0, 0, 1)
    cliff = zp + (beach - zp) * t ** 0.75 + 1.4 * n6 * (t > 0) * (t < 1)
    H = np.where(d < cd, zp, np.where(d < cd + 9, cliff, np.where(d < shore, beach, sea)))
    H = np.clip(np.round(H), 1, Z - 30).astype(int)
    w.H[:] = H
    region = np.where(d < cd - 0.5, 0, np.where(d < cd + 9.5, 1, np.where(d < shore, 2, 3)))

    zz = np.arange(Z)[None, None, :]
    Hb = H[:, :, None]
    depth = Hb - 1 - zz
    strata = ((zz + np.round(n6[:, :, None] * 1.5)) // 3) % 2
    mat = np.where(strata == 0, M.STONE, M.STONE_D).astype(np.uint8)
    reg = region[:, :, None]
    mat = np.where((reg == 0) & (depth >= 1) & (depth <= 3), M.DIRT, mat)
    mat = np.where((reg == 0) & (depth == 0), M.GRASS, mat)
    cliff_top = (reg == 1) & (depth == 0)
    mat = np.where((reg == 1) & (zz > 20) & (n3[:, :, None] > 0.6), M.MOSS, mat)
    mat = np.where(cliff_top & (Hb > 14) & (n6[:, :, None] > -0.3), M.GRASS, mat)
    mat = np.where((reg >= 2) & (depth <= 2), M.SAND, mat)
    mat = np.where(cliff_top & (Hb <= 11), M.SAND, mat)
    g[:] = np.where(zz < Hb, mat, M.AIR)
    w.fill_water()

    # schody w klifie (wzdłuż +y), lampy co 5 stopni
    SX0, SX1, SY0 = 124, 129, 108
    zc, y = int(H[SX0 + 2, SY0]), SY0
    steps = []
    while zc > 10 and y < Y - 2:
        for yy in (y, y + 1):
            g[SX0:SX1, yy, zc:] = M.AIR
            g[SX0:SX1, yy, :zc] = M.STONE
            g[SX0:SX1, yy, zc - 1] = M.COBBLE
            w.H[SX0:SX1, yy] = zc
        steps.append((y, zc))
        y += 2
        zc -= 1
    stairs_end = y
    for i, (sy, sz) in enumerate(steps):
        if i % 5 == 2:
            w.lamp_post(SX1, sy, sz, group=i % 3)

    # latarnia morska: wieża w pasy, galeria, laterna, kopuła
    LX, LY = 140, 90
    base = int(np.max(w.H[LX - 9:LX + 10, LY - 9:LY + 10]))
    w.flatten(LX - 9, LX + 10, LY - 9, LY + 10, base)
    top_z = base + 36
    for z in range(base, top_z):
        r = 6.2 - 1.6 * (z - base) / (top_z - base)
        band = ((z - base) // 5) % 2
        for x in range(LX - 8, LX + 9):
            for yy in range(LY - 8, LY + 9):
                if np.hypot(x - LX, yy - LY) <= r:
                    g[x, yy, z] = M.BRICK_RED if band == 0 else M.PLASTER
    for z in range(base, base + 4):
        g[LX + 4, LY + 4, z] = M.DOOR
        g[LX + 3, LY + 5, z] = M.DOOR
    for zw in (base + 12, base + 22):
        g[LX + 5, LY + 2, zw:zw + 3] = M.WINDOW
        g[LX + 2, LY + 5, zw:zw + 3] = M.WINDOW
    for x in range(LX - 8, LX + 9):
        for yy in range(LY - 8, LY + 9):
            dd = np.hypot(x - LX, yy - LY)
            if dd <= 6.4:
                g[x, yy, top_z] = M.IRON
            if 5.6 <= dd <= 6.4:
                g[x, yy, top_z + 1] = M.IRON
            if dd <= 3.3:
                g[x, yy, top_z + 1:top_z + 6] = M.GLASS_LAMP if dd >= 2.3 else M.IRON
            for k, z in enumerate(range(top_z + 6, top_z + 11)):
                if dd <= 4.4 - k * 1.0:
                    g[x, yy, z] = M.ROOF
    g[LX, LY, top_z + 11:top_z + 13] = M.IRON
    w.marks['lamp'] = (LX + 0.5, LY + 0.5, top_z + 3.5)
    w.light(LX + 0.5, LY + 0.5, top_z + 3.5, (1.0, 0.85, 0.55), 26.0, 3)

    # chata latarnika: ściany, dach dwuspadowy, okna świecą, komin
    CX0, CX1, CY0, CY1 = 70, 85, 116, 127
    cb = int(np.max(w.H[CX0 - 2:CX1 + 2, CY0 - 3:CY1 + 3]))
    w.flatten(CX0 - 2, CX1 + 2, CY0 - 3, CY1 + 3, cb)
    w.put(CX0, CX1, CY0, CY1, cb, cb + 7, M.PLASTER)
    w.put(CX0 + 1, CX1 - 1, CY0 + 1, CY1 - 1, cb, cb + 7, M.AIR)
    w.put(CX0, CX1, CY0, CY1, cb, cb + 1, M.STONE)
    ym = (CY0 + CY1 - 1) / 2
    for yy in range(CY0 - 2, CY1 + 2):
        hr = int(round(6.5 - abs(yy - ym)))
        if hr < 0:
            continue
        w.put(CX0 - 1, CX1 + 1, yy, yy + 1, cb + 7 + max(0, hr - 1), cb + 7 + hr + 1, M.ROOF)
        if CY0 <= yy < CY1:
            w.put(CX0, CX1, yy, yy + 1, cb + 7, cb + 7 + hr, M.PLASTER)
    for wx in (CX0 + 2, CX0 + 3, CX1 - 4, CX1 - 3):
        w.put(wx, wx + 1, CY1 - 1, CY1, cb + 2, cb + 5, M.WINDOW)
    w.put(CX0 + 7, CX0 + 9, CY1 - 1, CY1, cb + 1, cb + 5, M.DOOR)
    w.put(CX1 - 1, CX1, CY0 + 4, CY0 + 6, cb + 2, cb + 5, M.WINDOW)
    w.put(CX0 + 2, CX0 + 4, CY0 + 2, CY0 + 4, cb + 7, cb + 16, M.CHIMNEY)
    for wx in (CX0 + 3, CX1 - 3):
        w.light(wx, CY1 + 0.8, cb + 3.5, (1.0, 0.6, 0.25), 8.0, 1)
    w.light(CX1 + 0.8, CY0 + 5, cb + 3.5, (1.0, 0.6, 0.25), 7.0, 1)

    # ścieżki i latarnie przy nich
    p1 = w.path([(CX0 + 8, CY1 + 2), (100, 126), (118, 112), (SX0 + 2, SY0 - 1)], wobble=n3)
    p2 = w.path([(SX0 + 2, SY0 - 1), (132, 102), (LX + 5, LY + 7)], wobble=n3)
    for (px, py) in [(102, 124), (117, 114), (133, 104)]:
        w.lamp_post(px, py, group=2)

    # molo z lampami, chodnik przez plażę
    PX0, PX1 = 122, 129
    deck = WL + 2
    py0, py1 = stairs_end + 4, 218
    for yy in range(py0, py1):
        w.put(PX0, PX1, yy, yy + 1, deck - 1, deck, M.PLANKS)
        if (yy - py0) % 6 == 0:
            for px in (PX0, PX1 - 1):
                w.put(px, px + 1, yy, yy + 1, max(1, int(w.H[px, yy]) - 1), deck - 1, M.LOG_OAK)
    w.put(PX0 - 6, PX1 + 6, py1 - 8, py1, deck - 1, deck, M.PLANKS)
    for (px, yy) in [(PX0 - 6, py1 - 8), (PX1 + 5, py1 - 8), (PX0 - 6, py1 - 1), (PX1 + 5, py1 - 1)]:
        w.put(px, px + 1, yy, yy + 1, max(1, int(w.H[px, yy]) - 1), deck - 1, M.LOG_OAK)
    for yy in range(stairs_end, py0):
        h = max(int(w.H[SX0 + 2, yy]), deck - 1)
        w.put(PX0 + 1, PX1 - 1, yy, yy + 1, h, h + 1, M.PLANKS)
    for py in range(py0 + 8, py1 - 8, 14):
        w.lamp_post(PX1 - 1, py, deck, group=py % 3)

    w.boat(PX1 + 4, 186, 14)
    for (rx, ry, rr, rh) in [(152, 192, 3.2, 3), (160, 200, 2.2, 2), (98, 206, 3.6, 4), (104, 214, 2.0, 2),
                             (178, 186, 3.6, 4), (188, 177, 2.4, 2), (172, 199, 2.0, 2), (196, 192, 3.0, 3)]:
        w.rock(rx, ry, rr, rh, n3)
    # boja i łódka wiosłowa
    w.put(166, 168, 214, 216, WL - 1, WL + 1, M.BOAT_RED)
    w.put(166, 168, 214, 216, WL + 1, WL + 2, M.PLASTER)
    w.put(166, 168, 214, 216, WL + 2, WL + 3, M.BOAT_RED)
    w.put(166, 167, 214, 215, WL + 3, WL + 4, M.LANT_LIGHT)
    w.light(166.5, 214.5, WL + 3.5, (1.0, 0.35, 0.25), 6.0, 0)
    w.boat(178, 210, 8, along='x', mast=False)

    # las na płaskowyżu, krzaki przy krawędzi klifu
    w.taken[SX0 - 3:SX1 + 4, SY0 - 4:] = True
    w.taken[LX - 11:LX + 12, LY - 11:LY + 12] = True
    w.taken[CX0 - 5:CX1 + 5, CY0 - 5:CY1 + 5] = True
    w.taken |= np.minimum(p1, p2) < 4
    w.forest(lambda x, y: region[x, y] == 0 and abs((x - y) / 2) <= 75 and 20 <= (x + y) / 2 <= cd[x, y] - 4,
             spacing=lambda x, y: 6.5 if (x + y) / 2 < 100 else 9)
    for _ in range(140):
        x, y = int(w.rng.integers(10, X - 10)), int(w.rng.integers(10, Y - 10))
        if region[x, y] == 0 and not w.taken[x, y] and abs((x - y) / 2) <= 75 and cd[x, y] - 10 < (x + y) / 2 < cd[x, y] - 1:
            w.bush(x, y, M.LEAF_GREEN if w.rng.random() < 0.6 else M.LEAF_GOLD)

    w.fox(SX0 - 4, stairs_end + 1)
    return w
