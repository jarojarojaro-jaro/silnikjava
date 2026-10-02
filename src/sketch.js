// Sketch — "ręka rysownika". Zestaw pędzli rysujących na canvasie 2D w stylu
// odręcznym: pióro z naciskiem i drżeniem, kredka z ziarnem, zakreślacz,
// pismo odręczne, wypełnienie "cieczą" i rysujący ołówek.
//
// Każdy pędzel przyjmuje postęp `p` ∈ [0,1] — ile rysunku ma być już widać.
// Scena nie przechowuje stanu: w każdej klatce rysuje wszystko od nowa dla
// danego czasu t. Dzięki temu można dowolnie przewijać, zapętlać i eksportować.

import { clamp, hash, noise1, rng } from './math.js';
import { resample, bounds, pathInfo } from './paths.js';
import { StrokePlan } from './hand.js';
import { textGeometry, hasDOM, IMG_SCALE } from './handwriting.js';

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
/**
 * Drganie to cykl kilku "rysunków" (jak u animatorów: 3–4 wersje kreski w pętli).
 * Dzięki temu ukończone elementy da się zbuforować raz na każdą wersję.
 */
export const BOIL_CYCLE = 4;

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
   * Kreska piórem. Zwraca położenie końcówki ({x,y,angle,done}) — tam można postawić ołówek.
   * @param {number[][]} pts ścieżka
   * @param {number} p postęp 0..1 (ułamek długości; dla ruchu "jak ręka" użyj strokes/StrokePlan)
   * @param {object} o w (grubość), color, jitter, seed, still (bez drgania),
   *                   alpha, taper (px zwężenia końców), dash ([kreska, przerwa]),
   *                   sketchy (druga, blada kreska obok — efekt szkicu),
   *                   pressure (0..1 — ile pogrubiać na zakrętach, domyślnie 0.35)
   */
  pen(pts, p = 1, o = {}) {
    if (p <= 0 || !pts || pts.length < 2) return null;
    const { ctx } = this;
    const step = o.step ?? 2.5;
    const info = pathInfo(pts, step);
    const { r, n, curv } = info;
    if (n < 2) return null;
    const w = o.w ?? 3.2;
    const jitter = o.jitter ?? 1.1;
    const seed = o.seed ?? 3;
    const boil = o.still ? 0 : this.boil;
    const L = info.len;
    const taper = o.taper ?? Math.min(26, L * 0.3);
    const pressure = o.pressure ?? 0.35;
    // ułamkowy indeks końca: ostatni odcinek dorysowujemy częściowo — płynny ruch końcówki
    const f = p >= 1 ? n - 1 : Math.max(0.0001, (n - 1) * p);
    const last = Math.ceil(f);

    const base = seed * 13.17 + boil * 7.31;
    const J = (i, k = 1) => {
      const q = i >= n - 1 ? r[n - 1] : r[i];
      const qq = k < 1 ? [q[0] + (r[i + 1][0] - q[0]) * k, q[1] + (r[i + 1][1] - q[1]) * k] : q;
      const u = ((i + (k < 1 ? k : 0)) * step) / 40;
      return [qq[0] + noise1(base + u) * jitter, qq[1] + noise1(base + 61.3 + u) * jitter];
    };
    const pt = (i) => (i <= Math.floor(f) ? J(i) : J(Math.floor(f), f - Math.floor(f)));

    ctx.save();
    ctx.strokeStyle = this.col(o.color);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;

    const dash = o.dash;
    let prev = pt(0);
    for (let i = 1; i <= last; i += 2) {
      const end = Math.min(last, i + 1);
      const d = i * step;
      if (dash && d % (dash[0] + dash[1]) > dash[0]) {
        prev = pt(end);
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      for (let k = i; k <= end; k++) {
        prev = pt(k);
        ctx.lineTo(prev[0], prev[1]);
      }
      // nacisk: zwężenie na końcach, więcej tuszu na zakrętach (ręka tam zwalnia),
      // lekkie wahania jak przy prawdziwym piórze
      const press = taper > 0 ? Math.min(1, d / taper + 0.3, (L - d) / taper + 0.3) : 1;
      const bend = 1 + pressure * Math.min(1, curv[Math.min(i, n - 1)] * 8);
      const wob = 0.84 + 0.26 * noise1(seed * 3.7 + d * 0.02);
      ctx.lineWidth = Math.max(0.4, w * press * wob * bend);
      ctx.stroke();
    }
    ctx.restore();

    if (o.sketchy) {
      this.pen(pts, p, { ...o, sketchy: false, seed: seed + 101, w: w * 0.45, alpha: (o.alpha ?? 1) * 0.45, jitter: jitter * 2.2 });
    }
    const a = pt(last), b = pt(Math.max(0, last - 1));
    return { x: a[0], y: a[1], angle: Math.atan2(a[1] - b[1], a[0] - b[0]), done: p >= 1 };
  }

  /**
   * Kilka kresek rysowanych po kolei jak przez rękę: każda kreska ma swój
   * profil prędkości, między kreskami ołówek się podnosi (StrokePlan).
   * Postęp p jest proporcjonalny do czasu. Zwraca końcówkę (z `lift`) albo null po zakończeniu.
   */
  strokes(list, p = 1, o = {}) {
    if (p <= 0 || !list.length) return null;
    const plan = o.plan ?? StrokePlan.of(list);
    const st = plan.at(p);
    list.forEach((s, i) => {
      if (st.progress[i] > 0) this.pen(s, st.progress[i], { ...o, seed: (o.seed ?? 1) + 17 * i });
    });
    return p >= 1 ? null : st.tip;
  }

  /** Strzałka: kreska, potem dwa ramiona grota (z podniesieniem ołówka między nimi). */
  arrow(pts, p = 1, o = {}) {
    const parts = arrowParts(pts, o.head ?? 16);
    if (p <= 0) return null;
    const plan = StrokePlan.of(parts);
    const st = plan.at(p);
    parts.forEach((s, i) => {
      if (st.progress[i] > 0) this.pen(s, st.progress[i], { ...o, seed: (o.seed ?? 1) + (i ? 4 + i : 0), taper: i ? 6 : o.taper });
    });
    return p >= 1 ? null : st.tip;
  }

  // -------------------------------------------------------------- kredka

  /**
   * Zamalowanie kredką: zygzak kreskowania przycięty do konturu + ziarno papieru.
   * @param {number[][]} poly zamknięty kontur
   * @param {number} p postęp zamalowywania
   * @param {object} o color, alpha, spacing (odstęp kresek), w (grubość), angle, seed, grain,
   *                   solid (kryjące zamalowanie szerokim pisakiem, bez ziarna),
   *                   holes (kontury, które kredka omija)
   */
  crayon(poly, p = 1, o = {}) {
    if (p <= 0 || !poly || poly.length < 3) return null;
    const { ctx } = this;
    this.#ensureLayer();
    const lc = this.layerCtx;
    const seed = o.seed ?? 5;
    const width = o.w ?? 14;
    const z = zigzag(poly, o);
    const count = Math.floor(z.path.length * clamp(p));
    if (count < 2) return null;
    const box = this.#deviceBox(z.b, width);
    if (!box) return null;
    const [x0, y0, x1, y1] = box;
    const T = ctx.getTransform();

    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(x0, y0, x1 - x0, y1 - y0);
    lc.setTransform(T);
    lc.beginPath();
    poly.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y)));
    lc.closePath();
    // otwory (np. oczy postaci) — kredka je omija, jak rysownik
    for (const hole of o.holes ?? []) {
      hole.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y)));
      lc.closePath();
    }
    lc.clip(o.holes ? 'evenodd' : 'nonzero');
    lc.strokeStyle = this.col(o.color, 'teal');
    lc.lineCap = 'round';
    lc.lineJoin = 'round';
    lc.lineWidth = width;
    lc.beginPath();
    for (let i = 0; i < count; i++) {
      const wv = z.wave[i];
      const [x, y] = z.path[i];
      i ? lc.lineTo(x + wv, y - wv) : lc.moveTo(x, y);
    }
    lc.stroke();
    if (!o.solid) {
      lc.globalAlpha = 0.55;
      lc.lineWidth = width * 0.5;
      lc.stroke();
    }
    lc.restore();

    // ziarno: wydrapujemy drobne białe rysy jak przy kredce na fakturze papieru
    if (!o.solid && (o.grain ?? 1) > 0) {
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
    ctx.globalAlpha *= o.alpha ?? (o.solid ? 1 : 0.85);
    ctx.drawImage(this.layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    return p >= 1 ? null : crayonTip(z, p, seed);
  }

  /** Gdzie jest ręka przy kolorowaniu kredką (bez rysowania) — jedzie zygzakiem wewnątrz konturu. */
  crayonTrace(poly, p, o = {}) {
    return crayonTrace(poly, p, o);
  }

  /** Prostokąt w pikselach urządzenia obejmujący bbox (w układzie bieżącej transformacji) + margines. */
  #deviceBox(b, margin) {
    const T = this.ctx.getTransform();
    const xs = [], ys = [];
    for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
      xs.push(T.a * x + T.c * y + T.e);
      ys.push(T.b * x + T.d * y + T.f);
    }
    const pad = 4 + margin * Math.max(Math.abs(T.a), Math.abs(T.d));
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
    const x1 = Math.min(this.layer.width, Math.ceil(Math.max(...xs) + pad));
    const y1 = Math.min(this.layer.height, Math.ceil(Math.max(...ys) + pad));
    return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
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
   * Pismo odręczne pisane prawdziwymi kreskami liter (szkielet glifów, kolejność
   * jak u człowieka, pauzy między słowami). Postęp p jest proporcjonalny do czasu.
   * Zwraca pozycję grafitu {x,y,angle,lift} albo null po zakończeniu.
   * @param {object} o size, font ('hand'|'title'|'mono'|CSS), color, align, alpha,
   *                   weight, lineHeight, still, speed (px/s ręki), mode ('strokes'|'wipe'),
   *                   fit (czas [s], w którym tekst ma być napisany — tempo ręki dopasowane)
   */
  write(text, x, y, p = 1, o = {}) {
    if (p <= 0) return null;
    if (o.mode === 'wipe' || !hasDOM()) return this.#writeWipe(text, x, y, p, o);
    const { ctx } = this;
    const geo = this.#textGeo(text, o);
    const color = this.col(o.color, 'ink');
    const st = p >= 1 ? null : geo.planFor(o.fit).at(p);
    // całe słowo lekko "drga" razem z kreskami
    const jx = o.still ? 0 : noise1(this.boil * 1.7 + geo.size) * 0.45;
    const jy = o.still ? 0 : noise1(this.boil * 2.3 + 7) * 0.45;
    const images = geo.image(color);

    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x + jx, y + jy);
    const drawImages = (g) => geo.lines.forEach((ln, i) => {
      const im = images[i];
      g.drawImage(im, ln.dx - ln.pad, ln.dy - ln.asc, im.width / IMG_SCALE, im.height / IMG_SCALE);
    });
    if (!st) {
      drawImages(ctx);
      ctx.restore();
      return null;
    }
    // maska z kresek do aktualnego postępu, przez nią prześwituje glif
    this.#ensureLayer();
    const lc = this.layerCtx;
    const b = { x: Math.min(...geo.lines.map((l) => l.dx - l.pad)), y: -geo.size * 1.05, w: geo.width + geo.size, h: geo.lines[geo.lines.length - 1].dy + geo.size * 1.5 };
    b.w = Math.max(...geo.lines.map((l) => l.dx + l.width + l.pad)) - b.x;
    const box = this.#deviceBox(b, 2);
    if (box) {
      const [x0, y0, x1, y1] = box;
      lc.save();
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(x0, y0, x1 - x0, y1 - y0);
      lc.setTransform(ctx.getTransform());
      lc.strokeStyle = '#000';
      lc.fillStyle = '#000';
      lc.lineCap = 'round';
      lc.lineJoin = 'round';
      const mw = geo.weight * 1.8 + 1.5;
      lc.lineWidth = mw;
      geo.strokes.forEach((s, i) => {
        const q = st.progress[i];
        if (q <= 0) return;
        if (s.length < 2) {
          lc.beginPath();
          lc.arc(s[0][0], s[0][1], mw * 0.75, 0, Math.PI * 2);
          lc.fill();
          return;
        }
        const r = pathInfo(s, 1.5).r;
        const f = q * (r.length - 1);
        const k = Math.floor(f);
        lc.beginPath();
        lc.moveTo(r[0][0], r[0][1]);
        for (let j = 1; j <= k; j++) lc.lineTo(r[j][0], r[j][1]);
        if (k < r.length - 1) lc.lineTo(r[k][0] + (r[k + 1][0] - r[k][0]) * (f - k), r[k][1] + (r[k + 1][1] - r[k][1]) * (f - k));
        lc.stroke();
      });
      lc.globalCompositeOperation = 'source-in';
      drawImages(lc);
      lc.restore();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
    ctx.restore();
    const t = st.tip;
    return t && { x: x + t.x, y: y + t.y, angle: t.angle, lift: t.lift };
  }

  /** Gdzie jest ręka przy pisaniu (bez rysowania). */
  writeTrace(text, x, y, p, o = {}) {
    if (o.mode === 'wipe' || !hasDOM()) {
      const size = o.size ?? 32;
      const w = String(text).length * size * 0.45;
      const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
      return { x: x0 + w * clamp(p), y: y - size * 0.25, angle: 0, lift: 0 };
    }
    const t = this.#textGeo(text, o).planFor(o.fit).at(clamp(p)).tip;
    return t && { x: x + t.x, y: y + t.y, angle: t.angle, lift: t.lift };
  }

  /** Naturalny czas pisania tekstu [s] (z modelu ręki). */
  writeTime(text, o = {}) {
    if (o.mode === 'wipe' || !hasDOM()) return String(text).length / 14;
    return this.#textGeo(text, o).plan.total;
  }

  #textGeo(text, o) {
    const size = o.size ?? 32;
    const fontCss = `${o.weight ?? ''} ${size}px ${this.font(o.font)}`.trim();
    return textGeometry(text, { fontCss, size, align: o.align, lineHeight: o.lineHeight, seed: hashString(String(text)) + (o.seed ?? 0), speed: o.speed });
  }

  /** Stary tryb: litera odsłaniana prostokątem (gdy brak DOM albo mode: 'wipe'). */
  #writeWipe(text, x, y, p, o) {
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
   * Narzędzie w ręce, z końcówką dokładnie w (x,y):
   *   type 'pencil' — ołówek; `color` to kolor rysika: dla czerni grafit w żółtym
   *                   ołówku, dla koloru kredka w tym kolorze,
   *   type 'marker' — zakreślacz ze ściętą końcówką,
   *   type 'eraser' — gąbka do tablicy (środek w x,y).
   * `angle` — kierunek od końcówki do tyłu narzędzia, `lean` — przechył od ruchu,
   * `lift` 0..1 — uniesienie nad kartką (cień odsuwa się i rozmywa).
   */
  tool(x, y, o = {}) {
    const { ctx } = this;
    const type = o.type ?? 'pencil';
    const lift = clamp(o.lift ?? 0);
    const size = (o.size ?? 1) * (1 + 0.07 * lift); // uniesione narzędzie jest bliżej "kamery"
    const t = this.time;
    const ang = (o.angle ?? -1.05) + (o.lean ?? 0) + (o.still ? 0 : noise1(t * 2.1) * 0.06);
    ctx.save();
    ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.lineJoin = 'round';
    if (type === 'eraser') this.#eraserSprite(size, lift, o);
    else {
      const len = (type === 'marker' ? 110 : 120) * size;
      const wd = (type === 'marker' ? 20 : 13) * size;
      // cień na kartce — im wyżej narzędzie, tym dalej i bardziej rozmyty
      ctx.save();
      ctx.rotate(ang);
      ctx.globalAlpha *= 0.12 * (1 - 0.4 * lift);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(len * 0.55 + lift * 10, wd * (1.4 + lift * 1.6), len * 0.45, wd * (0.45 + 0.2 * lift), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.translate(0, -lift * 12);
      ctx.rotate(ang);
      if (type === 'marker') this.#markerSprite(len, wd, size, o);
      else this.#pencilSprite(len, wd, size, o);
    }
    ctx.restore();
  }

  /** Ołówek (zgodność wstecz) — to samo co tool(x, y, { type: 'pencil', ... }). */
  pencil(x, y, o = {}) {
    this.tool(x, y, { ...o, type: 'pencil' });
  }

  #pencilSprite(len, wd, size, o) {
    const { ctx } = this;
    const lead = this.col(o.color, 'ink');
    const graphite = o.color == null || ['ink', 'inkSoft'].includes(o.color) || lead === this.palette.ink;
    const body = graphite ? this.col('ochre') : lead;
    const cone = 24 * size;
    // drewno
    ctx.fillStyle = '#f0d3a8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cone, -wd / 2);
    ctx.lineTo(cone, wd / 2);
    ctx.closePath();
    ctx.fill();
    // rysik w kolorze kreski
    ctx.fillStyle = graphite ? this.col('ink') : lead;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cone * 0.38, -wd * 0.2);
    ctx.lineTo(cone * 0.38, wd * 0.2);
    ctx.closePath();
    ctx.fill();
    // korpus
    const bodyLen = len - cone - (graphite ? 22 : 4) * size;
    ctx.fillStyle = body;
    ctx.fillRect(cone, -wd / 2, bodyLen, wd);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cone, -wd / 2 + 2 * size, bodyLen, wd * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(cone, wd * 0.18, bodyLen, wd * 0.32);
    if (graphite) {
      // skuwka i gumka
      ctx.fillStyle = '#b9b4ab';
      ctx.fillRect(len - 22 * size, -wd / 2 - 0.5, 9 * size, wd + 1);
      ctx.fillStyle = this.col('coral');
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(len - 13 * size, -wd / 2, 13 * size, wd, [0, 4 * size, 4 * size, 0]);
      else ctx.rect(len - 13 * size, -wd / 2, 13 * size, wd);
      ctx.fill();
    } else {
      // kredka: denko w kolorze
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(len - 4 * size, -wd / 2, 4 * size, wd);
    }
    ctx.strokeStyle = this.col('ink');
    ctx.lineWidth = 1.6 * size;
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
  }

  #markerSprite(len, wd, size, o) {
    const { ctx } = this;
    const ink = this.col(o.color, 'ochre');
    const tip = 14 * size;
    // ścięta końcówka w kolorze tuszu
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-1 * size, -wd * 0.05);
    ctx.lineTo(tip, -wd * 0.32);
    ctx.lineTo(tip, wd * 0.32);
    ctx.lineTo(2 * size, wd * 0.22);
    ctx.closePath();
    ctx.fill();
    // obsadka
    ctx.fillStyle = '#e9e4da';
    ctx.fillRect(tip, -wd * 0.42, 8 * size, wd * 0.84);
    // korpus z paskiem koloru
    ctx.fillStyle = '#fbfaf6';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(tip + 8 * size, -wd / 2, len - tip - 8 * size, wd, [2 * size, 7 * size, 7 * size, 2 * size]);
    else ctx.rect(tip + 8 * size, -wd / 2, len - tip - 8 * size, wd);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.globalAlpha *= 0.85;
    ctx.fillRect(len * 0.45, -wd / 2, len * 0.32, wd);
    ctx.globalAlpha /= 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(tip + 8 * size, wd * 0.15, len - tip - 10 * size, wd * 0.3);
    ctx.strokeStyle = this.col('ink');
    ctx.lineWidth = 1.6 * size;
    ctx.beginPath();
    ctx.moveTo(-1 * size, -wd * 0.05);
    ctx.lineTo(tip, -wd * 0.32);
    ctx.lineTo(tip, -wd / 2);
    ctx.lineTo(len, -wd / 2);
    ctx.lineTo(len, wd / 2);
    ctx.lineTo(tip, wd / 2);
    ctx.lineTo(tip, wd * 0.32);
    ctx.lineTo(2 * size, wd * 0.22);
    ctx.closePath();
    ctx.stroke();
  }

  /** Gąbka do tablicy: filc na dole, drewniany grzbiet; środek filcu w (0,0). */
  #eraserSprite(size, lift, o) {
    const { ctx } = this;
    const w = (o.width ?? 150) * size, h = 30 * size, back = 26 * size;
    const tilt = (o.lean ?? 0) * 0.5 + noise1(this.time * 1.3) * 0.03;
    ctx.save();
    ctx.globalAlpha *= 0.13 * (1 - 0.4 * lift);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(10 + lift * 8, 12 + lift * 14, w * 0.55, h * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.translate(0, -lift * 10);
    ctx.rotate(tilt);
    ctx.fillStyle = '#d9d4ca'; // filc
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + (i * w) / 6 + 3 * size, -h / 2, 2 * size, h);
    ctx.fillStyle = '#b07d4f'; // drewno
    ctx.fillRect(-w / 2 + 6 * size, -h / 2 - back, w - 12 * size, back);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-w / 2 + 6 * size, -h / 2 - back, w - 12 * size, back * 0.3);
    ctx.strokeStyle = this.col('ink');
    ctx.lineWidth = 1.6 * size;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2 + 6 * size, -h / 2 - back, w - 12 * size, back);
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

// ------------------------------------------------------------------ geometria pędzli (z cache)

const arrowCache = new WeakMap();

/** Strzałka jako trzy kreski: trzon i dwa ramiona grota (cache po ścieżce). */
export function arrowParts(pts, size = 16) {
  let m = arrowCache.get(pts);
  if (m?.has(size)) return m.get(size);
  const r = resample(pts, 3);
  const e = r[r.length - 1];
  const s = r[Math.max(0, r.length - 6)];
  const ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
  const parts = [
    pts,
    [[e[0] + Math.cos(ang + 2.6) * size, e[1] + Math.sin(ang + 2.6) * size], [e[0], e[1]]],
    [[e[0], e[1]], [e[0] + Math.cos(ang - 2.6) * size, e[1] + Math.sin(ang - 2.6) * size]],
  ];
  if (!m) arrowCache.set(pts, (m = new Map()));
  m.set(size, parts);
  return parts;
}

const zigCache = new WeakMap();

/** Zygzak kreskowania kredki dla konturu (cache po konturze i parametrach). */
function zigzag(poly, o) {
  const gap = o.spacing ?? 10;
  const seed = o.seed ?? 5;
  const width = o.w ?? 14;
  const b = bounds(poly);
  // kierunek kreskowania: długie, wąskie kształty kolorujemy krótkimi ruchami
  // w poprzek, przesuwając rękę wzdłuż (jak człowiek), resztę ukośnie
  const angle = o.angle ?? (b.w > 2.5 * b.h ? 1.22 : b.h > 2.5 * b.w ? -0.35 : -0.6);
  const key = `${gap}|${angle}|${seed}|${width}`;
  let m = zigCache.get(poly);
  if (m?.has(key)) return m.get(key);
  const R = Math.hypot(b.w, b.h) / 2 + width;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const rand = rng(seed);
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
  const wave = Float32Array.from(path, (_, i) => 2.2 * noise1(seed + i * 0.17));
  // ślad ręki: zamiast skakać po całym zygzaku (dziesiątki przejść na sekundę),
  // ręka sunie środkiem kolorowanego pasa — średnia punktów wewnątrz konturu
  // z okna ±1 rzędu kreskowania
  const W = Math.max(3, Math.round((2 * R) / 7));
  const n = path.length;
  const cx = new Float64Array(n + 1), cy = new Float64Array(n + 1), cnt = new Float64Array(n + 1);
  path.forEach((pt, i) => {
    const ins = pointInPoly(pt, poly) ? 1 : 0;
    cx[i + 1] = cx[i] + pt[0] * ins;
    cy[i + 1] = cy[i] + pt[1] * ins;
    cnt[i + 1] = cnt[i] + ins;
  });
  const raw = path.map((_, i) => {
    const a = Math.max(0, i - W), e = Math.min(n, i + W + 1);
    const c = cnt[e] - cnt[a];
    return c > 0 ? [(cx[e] - cx[a]) / c, (cy[e] - cy[a]) / c] : null;
  });
  // dziury (fragmenty zygzaka całkiem poza konturem) wypełniamy ciągle: ręka czeka
  // w ostatnim miejscu, zamiast przeskakiwać; na początku — pierwszy znany punkt
  const first = raw.find(Boolean) ?? [b.cx, b.cy];
  let last = first;
  const filled = raw.map((e) => (e ? (last = e) : last));
  // drugie wygładzenie (okno ±W/2) — bez szarpnięć przy zmianie liczby punktów w oknie
  const h = Math.max(1, W >> 1);
  const sx = new Float64Array(n + 1), sy = new Float64Array(n + 1);
  filled.forEach(([x, y], i) => { sx[i + 1] = sx[i] + x; sy[i + 1] = sy[i] + y; });
  const env = filled.map((_, i) => {
    const a = Math.max(0, i - h), e = Math.min(n, i + h + 1);
    return [(sx[e] - sx[a]) / (e - a), (sy[e] - sy[a]) / (e - a)];
  });
  const z = { b, path, wave, env, W, angle };
  if (!m) zigCache.set(poly, (m = new Map()));
  m.set(key, z);
  return z;
}

/** Pozycja ręki przy kolorowaniu kredką (bez rysowania). */
export function crayonTrace(poly, p, o = {}) {
  return crayonTip(zigzag(poly, o), p, o.seed ?? 5);
}

function crayonTip(z, p, seed) {
  const n = z.path.length;
  // ułamkowy indeks — płynna interpolacja między punktami pasa
  const f = Math.min(n - 1, Math.max(0, n * clamp(p) - 1));
  const i = Math.floor(f), k = f - i;
  const a = z.env[i], c = z.env[Math.min(n - 1, i + 1)];
  const e = [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k];
  // drobne drganie ręki wzdłuż kierunku kreskowania (jeden ruch tam-z-powrotem na dwa rzędy)
  const osc = 9 * Math.sin((f / z.W) * Math.PI) + noise1(seed + f * 0.05) * 1.5;
  return { x: e[0] + Math.cos(z.angle) * osc, y: e[1] + Math.sin(z.angle) * osc, angle: z.angle, lift: 0 };
}

function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
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
