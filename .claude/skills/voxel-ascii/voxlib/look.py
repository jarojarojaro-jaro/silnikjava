"""Klatka filmu: światła (migotanie), woda (fale, odbłyski, piana), efekty (snop latarni, mewy,
liście, śnieg), tonowanie, kamera (najazd), potem filtr ASCII, poświata i tilt-shift.

Look(static_npz, cfg).frame(i) → uint8 (H, W, 3). Konfiguracja: patrz DEFAULTS i scenes/*.py.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.ndimage import gaussian_filter

from .render import Camera

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'

DEFAULTS = dict(
    out=(1080, 1920), fps=30, seconds=20,
    exposure=1.25, contrast=1.08, warm=(0.05, 0.02, -0.04), cool=(-0.03, 0.0, 0.04),
    haze=(0.95, 0.72, 0.55), haze_amount=0.55, haze_extent=0.42,
    light_gain=1.0, lamp_gain=1.25, flicker=1.0,
    water=dict(shallow=(0.32, 0.76, 0.72), mid=(0.10, 0.50, 0.62), deep=(0.05, 0.25, 0.42),
               sky=(0.98, 0.70, 0.52), glint=4.0, foam=1.0),
    effects=('birds', 'leaves'),
    beam=dict(mark='lamp', period=7.0, strength=0.85, reach=95),
    birds=5, leaves=70, leaf_colors=((1.10, 0.78, 0.22), (1.05, 0.52, 0.16), (0.95, 0.30, 0.12)),
    snow=320,
    move=dict(zoom=0.07, start=(-24, 40), end=(16, -30)),
    ascii=dict(cell=(6, 10), bg=0.58, fg=1.5, sat=1.25, edge=0.09, coherence=0.72, dither=0.075),
    tiltshift=(0.19, 0.87),
    bloom=0.55, vignette=0.26, grain=0.012, gain=1.08,
)


def merge(base, over):
    out = dict(base)
    for k, v in (over or {}).items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def build_atlas(cw, ch):
    """Atlas znaków: rampa 16 znaków wg rzeczywistego pokrycia glifu + 4 znaki kierunku."""
    cand = " .`',:;-~=+*^!/\\|()<>icloxsaeuvnrzCOSG0Q#%&@$"
    f = ImageFont.truetype(FONT, int(round(ch * 2.9)))
    masks = {}
    for c in cand:
        im = Image.new('L', (cw * 3, ch * 3), 0)
        ImageDraw.Draw(im).text((cw * 1.5, ch * 1.5), c, font=f, fill=255, anchor='mm')
        masks[c] = np.asarray(im.resize((cw, ch), Image.BOX)).astype(np.float32) / 255
    cov = {c: m.mean() for c, m in masks.items()}
    src = sorted((c for c in cand if c not in '/\\|-()<>^~`'), key=lambda c: cov[c])
    lo, hi = cov[src[0]], cov[src[-1]]
    ramp = [min(src, key=lambda c: abs(cov[c] - (lo + (hi - lo) * (i / 15) ** 0.9))) for i in range(16)]
    glyphs = ramp + ['-', '/', '|', '\\']
    return np.stack([masks[c] for c in glyphs]), ''.join(glyphs), [cov[c] for c in ramp]


def edge_glyph(edge_dir):
    """Kąt linii krawędzi w stopniach (0 poziomo, oś y ekranu w dół) → indeks znaku 16..19."""
    return np.select([(edge_dir < 22.5) | (edge_dir >= 157.5), edge_dir < 67.5, edge_dir < 112.5], [16, 19, 18], 17)


def ascii_pass(img, atlas, o):
    cw, ch = o['cell']
    H, Wd = img.shape[:2]
    R_, C_ = H // ch, Wd // cw
    cells = img[:R_ * ch, :C_ * cw].reshape(R_, ch, C_, cw, 3).mean((1, 3))
    Y = np.array([0.299, 0.587, 0.114])
    lum = cells @ Y
    hc = img[:R_ * ch, :C_ * cw].reshape(R_ * 2, ch // 2, C_ * 2, cw // 2, 3).mean((1, 3)) @ Y
    gx = np.zeros_like(hc)
    gy = np.zeros_like(hc)
    gx[:, 1:-1] = (hc[:, 2:] - hc[:, :-2]) / (2 * cw / 2)
    gy[1:-1, :] = (hc[2:, :] - hc[:-2, :]) / (2 * ch / 2)
    jxx = (gx * gx).reshape(R_, 2, C_, 2).sum((1, 3))
    jyy = (gy * gy).reshape(R_, 2, C_, 2).sum((1, 3))
    jxy = (gx * gy).reshape(R_, 2, C_, 2).sum((1, 3))
    energy = np.sqrt(jxx + jyy)
    coh = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-9)
    edge_dir = (0.5 * np.degrees(np.arctan2(2 * jxy, jxx - jyy)) + 90) % 180
    bay = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.47
    bay = np.tile(bay, (R_ // 4 + 1, C_ // 4 + 1))[:R_, :C_]
    idx = np.clip((lum ** 0.7 + bay * o['dither']) * 15.99, 0, 15).astype(int)
    edge = (energy > o['edge']) & (coh > o['coherence']) & (lum > 0.12)
    idx = np.where(edge, edge_glyph(edge_dir), idx)
    mask = atlas[idx]
    cl = lum[..., None]
    sat = cl + (cells - cl) * o['sat']
    fg = np.clip(sat * o['fg'] + 0.08, 0, 1)
    bg = np.clip(sat, 0, 1) * o['bg']
    out = bg[:, :, None, None, :] + (fg - bg)[:, :, None, None, :] * mask[..., None]
    full = img.copy()
    full[:R_ * ch, :C_ * cw] = out.transpose(0, 2, 1, 3, 4).reshape(R_ * ch, C_ * cw, 3)
    return full, idx


class Look:
    def __init__(self, static_path, cfg):
        self.cfg = cfg
        self.o = o = merge(DEFAULTS, cfg.get('look'))
        self.light_cfg = cfg['light']
        D = np.load(static_path)
        p = D['cam']
        self.cam = Camera(p[0], p[1], p[2], tuple(p[3:6]), (int(p[6]), int(p[7])))
        self.base, self.alb = D['base'], D['alb'].astype(np.float32)
        self.groups = D['groups'].astype(np.float32)
        self.WL = int(D['WL'])
        self.marks = {k[3:]: D[k] for k in D.files if k.startswith('px_')}
        water = D['water'].copy()
        RH, RW = water.shape
        self.RH, self.RW = RH, RW
        wxy, wdep, wsh, wsun = D['wxy'].copy(), D['depth'].copy(), D['shore'].copy(), D['sh'].copy()
        Xw, Yw = D['world'][:2]
        # promienie, które minęły świat albo weszły bokiem mapy: dalekie otwarte morze (albo mgła)
        miss = (~water) & (np.abs(self.base).sum(-1) == 0)
        edge = (wxy[..., 0] > Xw - 4) | (wxy[..., 1] > Yw - 4)
        if self.WL > 0:
            # za przednią krawędzią mapy (duże x albo y) jest dalsze morze, za tylną — mgła
            my, mx = np.nonzero(miss)
            ux, uy = self.cam.unproject(mx, my, self.WL)
            front = (ux > Xw - 4) | (uy > Yw - 4)
            sea = np.zeros_like(miss)
            sea[my[front], mx[front]] = True
            sea |= edge & ~water & ~miss
            sy, sx = np.nonzero(sea)
            wxy[sy, sx, 0], wxy[sy, sx, 1] = self.cam.unproject(sx, sy, self.WL)
            water |= sea
            for a, v in ((wdep, 7.0), (wsh, 60.0), (wsun, 1.0)):
                a[sea | (edge & water)] = v
            miss &= ~sea
        self.base[miss] = np.array(o['haze'], np.float32) * 0.8
        self.widx = np.flatnonzero(water.ravel())
        self.wxy = wxy.reshape(-1, 2)[self.widx]
        self.wdep, self.wsh, self.wsun = wdep.ravel()[self.widx], wsh.ravel()[self.widx], wsun.ravel()[self.widx]
        r0 = np.random.default_rng(3)
        nt = gaussian_filter(r0.standard_normal((256, 256)), 2.0, mode='wrap')
        self.nt = nt / nt.std()
        self.ngx = (np.roll(self.nt, -1, 0) - np.roll(self.nt, 1, 0)) / 2
        self.ngy = (np.roll(self.nt, -1, 1) - np.roll(self.nt, 1, 1)) / 2
        self.atlas, self.glyphs, _ = build_atlas(*o['ascii']['cell'])
        rb = np.random.default_rng(9)
        self.birds = [dict(x0=rb.uniform(-200, RW), y0=rb.uniform(300, RH - 500), vx=rb.uniform(26, 44), vy=rb.uniform(-14, 6),
                           ph=rb.uniform(0, 6.28), sz=rb.uniform(11, 16), alt=rb.uniform(6, 11)) for _ in range(o['birds'])]
        self.leaves = [dict(x0=rb.uniform(0, RW), y0=rb.uniform(-200, RH * 0.55), sp=rb.uniform(18, 34), sw=rb.uniform(8, 22),
                            ph=rb.uniform(0, 6.28), c=int(rb.integers(0, len(o['leaf_colors'])))) for _ in range(o['leaves'])]
        self.flakes = np.column_stack([rb.uniform(0, RW, o['snow']), rb.uniform(0, RH, o['snow']),
                                       rb.uniform(0.4, 1.0, o['snow']), rb.uniform(0, 6.28, o['snow'])])
        sd = np.array(self.light_cfg['sun_dir'], float)
        sd /= np.linalg.norm(sd)
        self.sun_dir = sd
        x0, y0 = self.cam.project(0, 0, 0)
        x1, y1 = self.cam.project(-sd[0] / sd[2], -sd[1] / sd[2], -1)
        self.shadow_dir = (x1 - x0, y1 - y0)  # przesunięcie cienia na jednostkę wysokości

    # ------------------------------------------------------------ woda
    def bilerp(self, tex, x, y):
        x0 = np.floor(x).astype(int)
        y0 = np.floor(y).astype(int)
        fx, fy = x - x0, y - y0
        x0 %= 256; y0 %= 256
        x1, y1 = (x0 + 1) % 256, (y0 + 1) % 256
        return tex[x0, y0] * (1 - fx) * (1 - fy) + tex[x1, y0] * fx * (1 - fy) + tex[x0, y1] * (1 - fx) * fy + tex[x1, y1] * fx * fy

    def water(self, t):
        wo = self.o['water']
        x, y = self.wxy[:, 0], self.wxy[:, 1]
        hx = np.zeros_like(x)
        hy = np.zeros_like(x)
        for A, kx, ky, w, ph in ((0.050, -0.55, -0.62, 1.30, 0.0), (0.035, -0.95, -0.35, 1.90, 1.3),
                                 (0.028, -0.30, -1.10, 2.30, 2.1), (0.020, 1.40, -1.10, 2.90, 0.7)):
            c = A * np.cos(kx * x + ky * y - w * t + ph)
            hx += c * kx
            hy += c * ky
        for amp, s, vx, vy in ((0.035, 2.2, 1.1, 0.6), (0.02, 4.7, -0.9, 1.3)):
            hx += amp * self.bilerp(self.ngx, x * s + t * vx, y * s + t * vy) * s
            hy += amp * self.bilerp(self.ngy, x * s + t * vx, y * s + t * vy) * s
        n = np.stack([-hx, -hy, np.ones_like(x)], 1)
        n /= np.linalg.norm(n, axis=1, keepdims=True)
        dep = np.clip(self.wdep / 5.5, 0, 1)[:, None]
        sh_, mid, deep = (np.array(wo[k]) for k in ('shallow', 'mid', 'deep'))
        col = np.where(dep < 0.4, sh_ + (mid - sh_) * (dep / 0.4), mid + (deep - mid) * ((dep - 0.4) / 0.6))
        see = np.clip(1 - self.wdep / 1.4, 0, 1)[:, None] ** 1.5
        col = col * (1 - see * 0.6) + np.array([0.80, 0.70, 0.50]) * see * 0.6
        sun_l = self.wsun[:, None]
        lc = self.light_cfg
        lit = col * (np.array(lc['sky_top']) + np.array(lc['sun']) * 0.45 * sun_l)
        fres = 0.06 + 0.5 * (1 - np.clip(n @ self.cam.view, 0, 1)) ** 3
        lit = lit * (1 - fres[:, None]) + np.array(wo['sky']) * fres[:, None]
        hvec = np.array([0.10, -0.12, 1.0])
        hvec /= np.linalg.norm(hvec)
        spec = np.clip(n @ hvec, 0, 1) ** 2600 * wo['glint'] * (0.35 + 0.65 * self.wsun)
        lit += np.array([1.0, 0.9, 0.7]) * spec[:, None]
        ns = self.bilerp(self.nt, x * 0.9 + t * 0.2, y * 0.9)
        band = 0.5 + 0.5 * np.sin(self.wsh * 1.6 + t * 2.0 + ns * 1.8)
        foam = np.clip((band - 0.62) / 0.2, 0, 1) * np.exp(-self.wsh / 2.6)
        foam = np.maximum(foam, np.clip(1.4 - self.wsh, 0, 1) * (0.6 + 0.4 * band)) * wo['foam']
        fcol = np.array([0.95, 0.95, 0.92]) * (0.55 + 0.6 * sun_l) * min(1.0, sum(lc['sun']) / 2.5 + 0.35)
        return (lit * (1 - foam[:, None]) + fcol * foam[:, None]).astype(np.float32)

    # ------------------------------------------------------------ efekty
    def beam(self, img, t):
        b = self.o['beam']
        if b['mark'] not in self.marks:
            return
        lx, ly = self.marks[b['mark']]
        cam = self.cam
        th0 = t * 2 * math.pi / b['period']
        ys, xs = np.mgrid[0:self.RH:2, 0:self.RW:2]
        acc = np.zeros(xs.shape, np.float32)
        view = cam.view
        for th in (th0, th0 + math.pi):
            dx3, dy3 = math.cos(th), math.sin(th)
            ex = (dx3 * cam.ca - dy3 * cam.sa) * cam.S
            ey = ((dx3 * cam.sa + dy3 * cam.ca) * cam.se + 0.06 * cam.ce) * cam.S
            ln = math.hypot(ex, ey) + 1e-6
            ux, uy = ex / ln, ey / ln
            reach = b['reach'] * ln
            px, py = xs - lx, ys - ly
            along = px * ux + py * uy
            perp = np.abs(-px * uy + py * ux)
            inten = np.exp(-(perp / np.maximum(6 + along * 0.13, 1)) ** 2) * np.clip(along / 30, 0, 1) * np.clip(1 - along / reach, 0, 1) ** 1.4
            acc += inten * (0.55 + 0.6 * max(0.0, dx3 * view[0] + dy3 * view[1]))
        c, s = math.cos(th0), math.sin(th0)
        face = max(0.0, c * view[0] + s * view[1], -c * view[0] - s * view[1])
        r2 = (xs - lx) ** 2 + (ys - ly) ** 2
        acc += np.exp(-r2 / (2 * 22 ** 2)) * (1.1 + 2.5 * face ** 6) + np.exp(-r2 / (2 * 70 ** 2)) * 0.35 * (0.4 + face ** 4)
        big = np.repeat(np.repeat(acc, 2, 0), 2, 1)[:self.RH, :self.RW]
        img += big[..., None] * np.array([1.0, 0.86, 0.6], np.float32) * b['strength']

    def birds_draw(self, img, t):
        over = Image.new('RGBA', (self.RW, self.RH), (0, 0, 0, 0))
        dr = ImageDraw.Draw(over)
        sdx, sdy = self.shadow_dir
        for b in self.birds:
            x = (b['x0'] + b['vx'] * t) % (self.RW + 400) - 200
            y = b['y0'] + b['vy'] * t + 8 * math.sin(t * 0.7 + b['ph'])
            s = b['sz']
            wing = s * (0.35 + 0.45 * math.sin(t * 7.0 + b['ph']))
            sx, sy = x + sdx * b['alt'], y + sdy * b['alt']
            dr.line([(sx - s, sy - wing * 0.6), (sx, sy), (sx + s, sy - wing * 0.6)], fill=(0, 0, 0, 70), width=4)
            dr.line([(x - s, y - wing), (x - s * 0.35, y - wing * 0.2), (x, y)], fill=(250, 250, 245, 255), width=3)
            dr.line([(x, y), (x + s * 0.35, y - wing * 0.2), (x + s, y - wing)], fill=(250, 250, 245, 255), width=3)
            dr.ellipse([x - 2.5, y - 2, x + 2.5, y + 2.5], fill=(235, 235, 230, 255))
        arr = np.asarray(over).astype(np.float32) / 255
        a = arr[..., 3:4]
        img[:] = img * (1 - a) + arr[..., :3] * 1.15 * a

    def leaves_draw(self, img, t):
        cols = self.o['leaf_colors']
        for lf in self.leaves:
            y = (lf['y0'] + lf['sp'] * t) % (self.RH * 0.75)
            x = (lf['x0'] + lf['sw'] * math.sin(t * 1.3 + lf['ph']) + 10 * t) % self.RW
            s = int(2.5 + 1.5 * abs(math.sin(t * 2.2 + lf['ph'])))
            xi, yi = int(x), int(y)
            img[max(0, yi - 2):yi + 2, max(0, xi - s):xi + s] = cols[lf['c']]

    def snow_draw(self, img, t):
        f = self.flakes
        y = (f[:, 1] + (40 + 60 * f[:, 2]) * t) % self.RH
        x = (f[:, 0] + 14 * np.sin(t * (0.6 + f[:, 2]) + f[:, 3]) + 8 * t) % self.RW
        for xi, yi, z in zip(x.astype(int), y.astype(int), f[:, 2]):
            r = 1 if z < 0.7 else 2
            img[max(0, yi - r):yi + r, max(0, xi - r):xi + r] = img[max(0, yi - r):yi + r, max(0, xi - r):xi + r] * 0.2 + 0.95 * 0.8

    # ------------------------------------------------------------ klatka
    def compose(self, t):
        o = self.o
        fl = o['flicker']
        k = np.array([o['light_gain'] * (1 + fl * (0.10 * math.sin(t * 6.1 + g * 1.9) + 0.06 * math.sin(t * 13.7 + g * 0.7)))
                      for g in range(3)] + [o['lamp_gain']])
        light = (self.groups * k[:, None, None, None]).sum(0)
        img = self.base + self.alb * light
        if self.widx.size:
            flat = img.reshape(-1, 3)
            flat[self.widx] = self.water(t) + light.reshape(-1, 3)[self.widx] * np.array([0.55, 0.42, 0.30])
        fx = o['effects']
        if 'snow' in fx:
            self.snow_draw(img, t)
        if 'birds' in fx:
            self.birds_draw(img, t)
        if 'leaves' in fx:
            self.leaves_draw(img, t)
        if 'beam' in fx:
            self.beam(img, t)
        return img

    def grade(self, img):
        o = self.o
        c = 1 - np.exp(-img * o['exposure'])
        lum = c @ np.array([0.299, 0.587, 0.114])
        c = c + np.clip(lum - 0.5, 0, 1)[..., None] * np.array(o['warm']) + np.clip(0.5 - lum, 0, 1)[..., None] * np.array(o['cool'])
        yy = np.linspace(0, 1, c.shape[0])[:, None, None]
        haze = np.clip(o['haze_extent'] - yy, 0, 1) ** 1.6 * o['haze_amount']
        c = c * (1 - haze) + np.array(o['haze']) * haze
        return np.clip((c - 0.5) * o['contrast'] + 0.5, 0, 1)

    def camera(self, img01, t):
        o = self.o
        W, H = o['out']
        p = t / o['seconds']
        e = p * p * (3 - 2 * p)
        mv = o['move']
        zoom = 1.0 + mv['zoom'] * e
        cx = self.RW / 2 + mv['start'][0] + (mv['end'][0] - mv['start'][0]) * e
        cy = self.RH / 2 + mv['start'][1] + (mv['end'][1] - mv['start'][1]) * e
        w, h = W / zoom, H / zoom
        im = Image.fromarray((img01 * 255 + 0.5).astype(np.uint8))
        a = w / W
        return np.asarray(im.transform((W, H), Image.AFFINE, (a, 0, cx - w / 2, 0, a, cy - h / 2), resample=Image.BICUBIC)).astype(np.float32) / 255

    def finish(self, asc, pre, i):
        o = self.o
        W, H = o['out']
        bright = np.clip(pre - 0.72, 0, 1)
        small = Image.fromarray((np.clip(bright * 2, 0, 1) * 255).astype(np.uint8)).resize((W // 4, H // 4), Image.BILINEAR)
        bl = np.asarray(small.filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255
        img = np.clip(asc + bl * o['bloom'], 0, 1)
        u8 = Image.fromarray((img * 255).astype(np.uint8))
        b1 = np.asarray(u8.filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32) / 255
        b2 = np.asarray(u8.filter(ImageFilter.GaussianBlur(6.5))).astype(np.float32) / 255
        top, bot = o['tiltshift']
        yy = np.linspace(0, 1, H)[:, None, None]
        wt = np.maximum(np.clip((top - yy) / max(top - 0.02, 1e-3), 0, 1), np.clip((yy - bot) / max(1 - bot, 1e-3), 0, 1) * 0.8)
        a, c = np.clip(wt * 2, 0, 1), np.clip(wt * 2 - 1, 0, 1)
        img = img * (1 - a) + b1 * a
        img = img * (1 - c) + b2 * c
        xx = np.linspace(-1, 1, W)[None, :, None]
        yv = np.linspace(-1, 1, H)[:, None, None]
        img *= o['gain'] * (1 - o['vignette'] * (xx ** 2 * 0.8 + yv ** 2 * 0.6))
        img += np.random.default_rng(i).normal(0, o['grain'], img.shape)
        return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)

    def frame(self, i, raw=False):
        t = i / self.o['fps']
        pre = self.camera(self.grade(self.compose(t)), t)
        out = self.finish(ascii_pass(pre, self.atlas, self.o['ascii'])[0], pre, i)
        return (out, pre) if raw else out
