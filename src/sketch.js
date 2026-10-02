// Sketch — "ręka rysownika". Zestaw pędzli rysujących na canvasie 2D w stylu
// odręcznym: pióro z naciskiem i drżeniem, kredka z ziarnem, zakreślacz,
// pismo odręczne, wypełnienie "cieczą" i rysujący ołówek.
//
// Każdy pędzel przyjmuje postęp `p` ∈ [0,1] — ile rysunku ma być już widać.
// Scena nie przechowuje stanu: w każdej klatce rysuje wszystko od nowa dla
// danego czasu t. Dzięki temu można dowolnie przewijać, zapętlać i eksportować.

import { clamp, hash, noise1, rng } from './math.js';
import { resample, pathLength, bounds } from './paths.js';

export const PALETTE = {
  paper: '#f7f3ea',
  ink: '#2a2a2a',
  inkSoft: '#5a5a5a',
  pen: '#1e706a',
  penDark: '#175b56',
  teal: '#3a9e8f',
  sky: '#8cc7bf',
  ochre: '#e3a33b',
  coral: '#e0765a',
  plum: '#7a5c99',
  white: '#ffffff',
};

/** Ile razy na sekundę kreska "drga" (line boil) — jak w ręcznej animacji poklatkowej. */
export const BOIL_FPS = 8;

let grainCache = null;
let paperCache = null;

export class Sketch {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [opts]
   * @param {object} [opts.palette] nadpisania kolorów
   * @param {object} [opts.fonts]   { hand, title, mono } — rodziny czcionek
   */
  constructor(ctx, { palette = {}, fonts = {} } = {}) {
    this.ctx = ctx;
    this.palette = { ...PALETTE, ...palette };
    this.fonts = { hand: '"Caveat", "Comic Sans MS", cursive', title: '"Caveat Brush", "Caveat", cursive', mono: 'monospace', ...fonts };
    this.boil = 0; // numer "klatki drgania" — zmienia się BOIL_FPS razy na sekundę
    this.time = 0; // aktualny czas sceny w sekundach (do animacji idle)
    this.layer = null; // pomocnicze płótno dla kredki
    this.layerCtx = null;
  }

  /** Kolor z palety po nazwie albo dosłowny CSS. */
  col(c, fallback = 'pen') {
    if (c == null) return this.palette[fallback];
    return this.palette[c] ?? c;
  }

  font(name) {
    return this.fonts[name] ?? name ?? this.fonts.hand;
  }

  // -------------------------------------------------------------- tło

  /** Papier: kolor bazowy + ziarno + delikatne włókna. */
  paper(w, h, { color = 'paper', grain = 1 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = this.col(color);
    ctx.fillRect(0, 0, w, h);
    if (grain > 0) {
      ctx.globalAlpha = 0.55 * grain;
      ctx.fillStyle = ctx.createPattern(paperTexture(), 'repeat');
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------- pióro

  /**
   * Kreska piórem. Zwraca położenie końcówki ({x,y,angle}) — tam można postawić ołówek.
   * @param {number[][]} pts ścieżka
   * @param {number} p postęp 0..1
   * @param {object} o w (grubość), color, jitter, seed, still (bez drgania),
   *                   alpha, taper (px zwężenia końców), dash ([kreska, przerwa]),
   *                   sketchy (druga, blada kreska obok — efekt szkicu)
   */
  pen(pts, p = 1, o = {}) {
    if (p <= 0 || !pts || pts.length < 2) return null;
    const { ctx } = this;
    const step = o.step ?? 2.5;
    const r = o.resample === false ? pts : resample(pts, step);
    const n = r.length;
    if (n < 2) return null;
    const w = o.w ?? 3.2;
    const jitter = o.jitter ?? 1.1;
    const seed = o.seed ?? 3;
    const boil = o.still ? 0 : this.boil;
    const L = (n - 1) * step;
    const taper = o.taper ?? Math.min(26, L * 0.3);
    const last = p >= 1 ? n - 1 : Math.max(1, Math.floor((n - 1) * p));

    const base = seed * 13.17 + boil * 7.31;
    const J = (i) => {
      const q = r[i];
      const k = (i * step) / 40;
      return [q[0] + noise1(base + k) * jitter, q[1] + noise1(base + 61.3 + k) * jitter];
    };

    ctx.save();
    ctx.strokeStyle = this.col(o.color);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;

    const dash = o.dash;
    let prev = J(0);
    for (let i = 1; i <= last; i += 2) {
      const end = Math.min(last, i + 1);
      const d = i * step;
      if (dash && d % (dash[0] + dash[1]) > dash[0]) {
        prev = J(end);
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      for (let k = i; k <= end; k++) {
        prev = J(k);
        ctx.lineTo(prev[0], prev[1]);
      }
      // nacisk: zwężenie na końcach + lekkie wahania jak przy prawdziwym piórze
      const press = taper > 0 ? Math.min(1, d / taper + 0.3, (L - d) / taper + 0.3) : 1;
      const wob = 0.84 + 0.26 * noise1(seed * 3.7 + d * 0.02);
      ctx.lineWidth = Math.max(0.4, w * press * wob);
      ctx.stroke();
    }
    ctx.restore();

    if (o.sketchy) {
      this.pen(pts, p, { ...o, sketchy: false, seed: seed + 101, w: w * 0.45, alpha: (o.alpha ?? 1) * 0.45, jitter: jitter * 2.2 });
    }
    const a = r[last], b = r[Math.max(0, last - 1)];
    return { x: a[0], y: a[1], angle: Math.atan2(a[1] - b[1], a[0] - b[0]), done: p >= 1 };
  }

  /**
   * Kilka kresek rysowanych po kolei jednym ruchem ręki (wspólny postęp
   * dzielony proporcjonalnie do długości). Zwraca końcówkę aktywnej kreski.
   */
  strokes(list, p = 1, o = {}) {
    const lens = list.map((s) => Math.max(1, pathLength(s)));
    const total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    let tip = null;
    list.forEach((s, i) => {
      const a = acc / total;
      const b = (acc + lens[i]) / total;
      acc += lens[i];
      const local = clamp((p - a) / Math.max(1e-6, b - a));
      const t = this.pen(s, local, { ...o, seed: (o.seed ?? 1) + 17 * i });
      if (t && local < 1) tip = t;
    });
    return tip;
  }

  /** Strzałka: kreska, a gdy dojdzie do końca — grot. */
  arrow(pts, p = 1, o = {}) {
    const bodyP = clamp(p / 0.82);
    const tip = this.pen(pts, bodyP, o);
    const hp = clamp((p - 0.82) / 0.18);
    if (hp > 0) {
      const r = resample(pts, 3);
      const e = r[r.length - 1];
      const s = r[Math.max(0, r.length - 6)];
      const ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
      const size = o.head ?? 16;
      const h1 = [[e[0] + Math.cos(ang + 2.6) * size, e[1] + Math.sin(ang + 2.6) * size], e];
      const h2 = [e, [e[0] + Math.cos(ang - 2.6) * size, e[1] + Math.sin(ang - 2.6) * size]];
      this.pen(h1, clamp(hp * 2), { ...o, seed: (o.seed ?? 1) + 5, taper: 6 });
      this.pen(h2, clamp(hp * 2 - 1), { ...o, seed: (o.seed ?? 1) + 6, taper: 6 });
    }
    return tip;
  }

  // -------------------------------------------------------------- kredka

  /**
   * Zamalowanie kredką: zygzak kreskowania przycięty do konturu + ziarno papieru.
   * @param {number[][]} poly zamknięty kontur
   * @param {number} p postęp zamalowywania
   * @param {object} o color, alpha, spacing (odstęp kresek), w (grubość), angle, seed, grain
   */
  crayon(poly, p = 1, o = {}) {
    if (p <= 0 || !poly || poly.length < 3) return;
    const { ctx } = this;
    this.#ensureLayer();
    const lc = this.layerCtx;
    const gap = o.spacing ?? 10;
    const angle = o.angle ?? -0.6;
    const seed = o.seed ?? 5;
    const width = o.w ?? 14;
    const b = bounds(poly);
    const R = Math.hypot(b.w, b.h) / 2 + width;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const rand = rng(seed);

    // zygzak w układzie obróconym o `angle`
    const zig = [];
    const rows = Math.ceil((2 * R) / gap);
    for (let i = 0; i <= rows; i++) {
      const off = -R + i * gap + (rand() - 0.5) * gap * 0.45;
      const [s0, s1] = i % 2 ? [R, -R] : [-R, R];
      zig.push([b.cx + s0 * ca - off * sa, b.cy + s0 * sa + off * ca]);
      const off2 = off + gap / 2;
      zig.push([b.cx + s1 * ca - off2 * sa, b.cy + s1 * sa + off2 * ca]);
    }
    const path = resample(zig, 7);
    const count = Math.floor(path.length * clamp(p));
    if (count < 2) return;

    // obszar w pikselach urządzenia
    const T = ctx.getTransform();
    const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => [
      T.a * x + T.c * y + T.e,
      T.b * x + T.d * y + T.f,
    ]);
    const pad = 4 + width * Math.max(Math.abs(T.a), Math.abs(T.d));
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])) - pad));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])) - pad));
    const x1 = Math.min(this.layer.width, Math.ceil(Math.max(...corners.map((c) => c[0])) + pad));
    const y1 = Math.min(this.layer.height, Math.ceil(Math.max(...corners.map((c) => c[1])) + pad));
    if (x1 <= x0 || y1 <= y0) return;

    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(x0, y0, x1 - x0, y1 - y0);
    lc.setTransform(T);
    lc.beginPath();
    poly.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y)));
    lc.closePath();
    lc.clip();
    lc.strokeStyle = this.col(o.color, 'teal');
    lc.lineCap = 'round';
    lc.lineJoin = 'round';
    lc.lineWidth = width;
    lc.beginPath();
    for (let i = 0; i < count; i++) {
      const wv = 2.2 * noise1(seed + i * 0.17);
      const [x, y] = path[i];
      i ? lc.lineTo(x + wv, y - wv) : lc.moveTo(x, y);
    }
    lc.stroke();
    lc.globalAlpha = 0.55;
    lc.lineWidth = width * 0.5;
    lc.stroke();
    lc.restore();

    // ziarno: wydrapujemy drobne białe rysy jak przy kredce na fakturze papieru
    if ((o.grain ?? 1) > 0) {
      lc.save();
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'destination-out';
      lc.globalAlpha = clamp(o.grain ?? 1);
      lc.fillStyle = lc.createPattern(grainTexture(), 'repeat');
      lc.fillRect(x0, y0, x1 - x0, y1 - y0);
      lc.restore();
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= o.alpha ?? 0.85;
    ctx.drawImage(this.layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  #ensureLayer() {
    const c = this.ctx.canvas;
    if (!this.layer) {
      this.layer = makeCanvas(c.width, c.height);
      this.layerCtx = this.layer.getContext('2d');
    } else if (this.layer.width !== c.width || this.layer.height !== c.height) {
      this.layer.width = c.width;
      this.layer.height = c.height;
    }
  }

  // -------------------------------------------------------------- wypełnienia

  /** Płaskie wypełnienie konturu. */
  fill(poly, color = 'paper', alpha = 1) {
    if (!poly || poly.length < 3 || alpha <= 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = this.col(color);
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Zasłania to, co pod spodem, kolorem papieru (np. tablica przed nogami statywu). */
  occlude(poly, color = 'paper') {
    this.fill(poly, color, 1);
  }

  /**
   * "Ciecz" wlewana do konturu — poziom rośnie od dołu, powierzchnia faluje.
   * @param {number} level 0..1 poziom napełnienia
   */
  liquid(poly, level = 1, o = {}) {
    if (level <= 0 || !poly || poly.length < 3) return;
    const { ctx } = this;
    const b = bounds(poly);
    const top = b.y + b.h * (1 - clamp(level));
    const amp = (o.wave ?? 3) * (level < 1 ? 1 : 0.4);
    const ph = (o.seed ?? 1) + this.time * (o.speed ?? 3);
    ctx.save();
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha *= o.alpha ?? 0.6;
    ctx.fillStyle = this.col(o.color, 'sky');
    ctx.beginPath();
    ctx.moveTo(b.x - 5, b.y + b.h + 5);
    for (let x = b.x - 5; x <= b.x + b.w + 5; x += 4) ctx.lineTo(x, top + Math.sin(x * 0.06 + ph) * amp);
    ctx.lineTo(b.x + b.w + 5, b.y + b.h + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Zakreślacz: szeroki półprzezroczysty pas wzdłuż ścieżki. */
  highlight(pts, width = 22, p = 1, o = {}) {
    if (p <= 0) return;
    const { ctx } = this;
    const r = resample(pts, 3);
    const last = Math.max(1, Math.floor((r.length - 1) * clamp(p)));
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha *= o.alpha ?? 0.45;
    ctx.strokeStyle = this.col(o.color, 'ochre');
    ctx.lineWidth = width;
    ctx.lineCap = o.cap ?? 'butt';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= last; i++) {
      const y = r[i][1] + noise1((o.seed ?? 1) + i * 0.05) * 1.5;
      i ? ctx.lineTo(r[i][0], y) : ctx.moveTo(r[i][0], y);
    }
    ctx.stroke();
    ctx.restore();
  }

  dot(x, y, rad, color = 'pen', alpha = 1) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = this.col(color);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, rad), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // -------------------------------------------------------------- pismo

  /**
   * Pismo odręczne pojawiające się litera po literze (każda litera "dopisywana"
   * od lewej). Litery lekko tańczą — każda ma własny przechył i wysokość.
   * Zwraca pozycję końcówki pisaka.
   * @param {object} o size, font ('hand'|'title'|'mono'|CSS), color, align, alpha, bold, lineHeight
   */
  write(text, x, y, p = 1, o = {}) {
    if (p <= 0) return null;
    const { ctx } = this;
    const size = o.size ?? 32;
    const fontCss = `${o.weight ?? ''} ${size}px ${this.font(o.font)}`.trim();
    const lines = String(text).split('\n');
    const total = lines.reduce((a, l) => a + l.length, 0) || 1;
    let shown = clamp(p) * (total + 0.999);
    let tip = null;
    const textSeed = hashString(text) + (o.seed ?? 0);
    ctx.save();
    ctx.font = fontCss;
    ctx.fillStyle = this.col(o.color, 'ink');
    ctx.textBaseline = 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    lines.forEach((lineText, li) => {
      const ly = y + li * size * (o.lineHeight ?? 1.15);
      const width = ctx.measureText(lineText).width;
      const lx = o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x;
      let acc = '';
      for (let i = 0; i < lineText.length; i++) {
        const ch = lineText[i];
        const cx = lx + ctx.measureText(acc).width;
        acc += ch;
        const cw = ctx.measureText(ch).width;
        const k = clamp(shown);
        shown -= 1;
        if (k <= 0) return;
        if (ch === ' ') continue;
        const s = textSeed + i * 3.1 + li * 31;
        const dy = (hash(s) - 0.5) * size * 0.06 + (o.still ? 0 : noise1(this.boil * 2.3 + i * 1.3) * 0.5);
        const dx = o.still ? 0 : noise1(this.boil * 1.7 + i) * 0.5;
        ctx.save();
        ctx.translate(cx + dx, ly + dy);
        ctx.rotate((hash(s + 5.7) - 0.5) * 0.07);
        if (k < 1) {
          ctx.beginPath();
          ctx.rect(-3, -size * 1.2, (cw + 6) * k, size * 1.7);
          ctx.clip();
          tip = { x: cx + cw * k, y: ly - size * 0.25, angle: 0 };
        }
        ctx.fillText(ch, 0, 0);
        if (o.bold) ctx.fillText(ch, 0.9, 0.4);
        ctx.restore();
      }
    });
    ctx.restore();
    return tip;
  }

  // -------------------------------------------------------------- narzędzie

  /**
   * Rysujący ołówek — grafit dokładnie w (x,y). `angle` to kierunek od grafitu
   * do gumki (domyślnie w górę i w prawo, jak trzymany w prawej ręce).
   */
  pencil(x, y, o = {}) {
    const { ctx } = this;
    const size = o.size ?? 1;
    const t = this.time;
    // ręka lekko "pracuje"
    const ang = (o.angle ?? -1.05) + (o.still ? 0 : noise1(t * 2.1) * 0.06);
    const len = 120 * size;
    const wd = 13 * size;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    // cień
    ctx.save();
    ctx.globalAlpha *= 0.12;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(len * 0.55, wd * 1.4, len * 0.45, wd * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const cone = 24 * size;
    // drewno
    ctx.fillStyle = '#f0d3a8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cone, -wd / 2);
    ctx.lineTo(cone, wd / 2);
    ctx.closePath();
    ctx.fill();
    // grafit
    ctx.fillStyle = this.col('ink');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cone * 0.35, -wd * 0.18);
    ctx.lineTo(cone * 0.35, wd * 0.18);
    ctx.closePath();
    ctx.fill();
    // korpus
    ctx.fillStyle = this.col(o.color, 'ochre');
    ctx.fillRect(cone, -wd / 2, len - cone - 22 * size, wd);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cone, -wd / 2 + 2 * size, len - cone - 22 * size, wd * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(cone, wd * 0.18, len - cone - 22 * size, wd * 0.32);
    // skuwka
    ctx.fillStyle = '#b9b4ab';
    ctx.fillRect(len - 22 * size, -wd / 2 - 0.5, 9 * size, wd + 1);
    // gumka
    ctx.fillStyle = this.col('coral');
    ctx.beginPath();
    ctx.roundRect?.(len - 13 * size, -wd / 2, 13 * size, wd, [0, 4 * size, 4 * size, 0]);
    if (!ctx.roundRect) ctx.rect(len - 13 * size, -wd / 2, 13 * size, wd);
    ctx.fill();
    // kontur
    ctx.strokeStyle = this.col('ink');
    ctx.lineWidth = 1.6 * size;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cone, -wd / 2);
    ctx.lineTo(len, -wd / 2);
    ctx.lineTo(len, wd / 2);
    ctx.lineTo(cone, wd / 2);
    ctx.closePath();
    ctx.moveTo(cone, -wd / 2);
    ctx.lineTo(cone, wd / 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Rysuje fn w lokalnym układzie (przesunięcie, skala, obrót). */
  group({ x = 0, y = 0, scale = 1, sx, sy, rotate = 0, alpha = 1 } = {}, fn) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    if (rotate) ctx.rotate(rotate);
    ctx.scale(sx ?? scale, sy ?? scale);
    ctx.globalAlpha *= alpha;
    fn(this);
    ctx.restore();
  }
}

/**
 * Czcionki z CSS ładują się leniwie — canvas nie czeka na nie sam. Ta funkcja
 * wymusza ich pobranie (z limitem czasu), żeby pismo odręczne nie mignęło
 * czcionką zastępczą.
 */
export function loadFonts(fonts, timeout = 2500) {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const sample = 'Aa Ąą Ćć Ęę Łł Óó Śś Żż 0123';
  const loads = Object.values(fonts).map((f) => document.fonts.load(`32px ${f}`, sample).catch(() => null));
  return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeout))]);
}

// ------------------------------------------------------------------ tekstury

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/** Tekstura "rys" kredki: krótkie ukośne kreski o losowej jasności. */
function grainTexture() {
  if (grainCache) return grainCache;
  const S = 192;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(77);
  g.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = r() * S, y = r() * S;
    const a = -0.5 + (r() - 0.5) * 0.5;
    const l = 2 + r() * 7;
    g.strokeStyle = `rgba(0,0,0,${0.35 + r() * 0.65})`;
    g.lineWidth = 0.6 + r() * 1.1;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      g.stroke();
    }
  }
  grainCache = c;
  return c;
}

/** Faktura papieru: drobne plamki i włókna. */
function paperTexture() {
  if (paperCache) return paperCache;
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(11);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? `rgba(120,100,70,${0.05 + r() * 0.07})` : `rgba(255,255,255,${0.2 + r() * 0.3})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  g.lineWidth = 0.6;
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, a = r() * Math.PI, l = 4 + r() * 14;
    g.strokeStyle = `rgba(110,90,60,${0.05 + r() * 0.06})`;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 2, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  paperCache = c;
  return c;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h % 1000) / 7;
}
