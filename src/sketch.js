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
import { resolveTheme } from './themes.js';

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
  constructor(ctx, { palette = {}, fonts = {}, theme = 'paper' } = {}) {
    this.ctx = ctx;
    this.theme = resolveTheme(theme);
    this.palette = { ...PALETTE, ...this.theme.palette, ...palette };
    this.fonts = { hand: '"Caveat", "Comic Sans MS", cursive', title: '"Caveat Brush", "Caveat", cursive', mono: 'monospace', ...this.theme.fonts, ...fonts };
    this.base = null; // transformacja "ekranu" sceny (ustawia Player) — do odmalowania tła
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
    this.paperSize = [w, h];
    if (this.theme.background && color === 'paper') {
      ctx.save();
      this.theme.background(this, w, h);
      ctx.restore();
      return;
    }
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
    const style = this.theme.pen;
    const kind = style.style ?? 'ink';
    const w = (o.w ?? 3.2) * (style.width ?? 1);
    const jitter = (o.jitter ?? 1.1) * (style.jitter ?? 1);
    const seed = o.seed ?? 3;
    const boil = o.still ? 0 : this.boil;
    const L = info.len;
    // kreślarski cienkopis i neon mają stałą grubość (bez nacisku i zwężeń)
    const uniform = kind === 'tech' || kind === 'neon' || kind === 'marker';
    const taper = uniform ? 0 : (o.taper ?? Math.min(26, L * 0.3)) * (style.taper ?? 1);
    const pressure = uniform ? 0 : o.pressure ?? style.pressure ?? 0.35;
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

    const color = this.col(o.color);
    const dash = o.dash;
    const P = [];
    for (let i = 0; i <= last; i++) P.push(pt(i));
    const visible = (i) => !dash || (i * step) % (dash[0] + dash[1]) <= dash[0];

    if (kind === 'pixel') {
      // piksele: ślad pióra przyciągnięty do siatki ekranu, kwadrat po kwadracie
      const g = style.grid ?? 8;
      const k = Math.max(1, Math.round(w / g));
      const sh = (k - 1) / 2;
      const seen = new Set();
      const path = new Path2D();
      for (let i = 0; i < P.length; i++) {
        if (!visible(i)) continue;
        const cx = Math.round(P[i][0] / g - 0.5 - sh), cy = Math.round(P[i][1] / g - 0.5 - sh);
        for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
          const key = (cx + a) * 4096 + cy + b;
          if (seen.has(key)) continue;
          seen.add(key);
          path.rect((cx + a) * g, (cy + b) * g, g, g);
        }
      }
      ctx.save();
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.fillStyle = color;
      ctx.fill(path);
      ctx.restore();
    } else if (uniform) {
      // jedna ścieżka o stałej grubości (szybko; neon i cienkopis tak wyglądają)
      const path = new Path2D();
      let open = false;
      for (let i = 0; i < P.length; i++) {
        if (!visible(i)) { open = false; continue; }
        if (!open) { path.moveTo(P[i][0], P[i][1]); open = true; } else path.lineTo(P[i][0], P[i][1]);
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      if (kind === 'neon') {
        // poświata: szerokie, przezroczyste warstwy dodawane światłem + białawy rdzeń
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = color;
        for (const [k, a] of [[5, 0.07], [3, 0.14], [1.8, 0.35]]) {
          ctx.globalAlpha = (o.alpha ?? 1) * a * (style.glow ?? 1);
          ctx.lineWidth = w * k;
          ctx.stroke(path);
        }
        ctx.globalAlpha = o.alpha ?? 1;
        ctx.lineWidth = w;
        ctx.stroke(path);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = Math.max(0.6, w * 0.38);
        ctx.stroke(path);
      } else if (kind === 'marker') {
        // marker: tusz kryje prawie całkiem, przez środek idą jaśniejsze smugi filcu
        ctx.strokeStyle = color;
        ctx.globalAlpha = (o.alpha ?? 1) * 0.94;
        ctx.lineWidth = w;
        ctx.stroke(path);
        ctx.globalAlpha = (o.alpha ?? 1) * 0.16;
        ctx.strokeStyle = this.col('paper');
        ctx.lineWidth = Math.max(0.6, w * 0.13);
        ctx.setLineDash([w * 3.5, w * 1.8]);
        ctx.stroke(path);
        ctx.setLineDash([]);
        // na początku i końcu kreski końcówka postała chwilę — tusz wsiąka głębiej
        ctx.fillStyle = color;
        ctx.globalAlpha = (o.alpha ?? 1) * 0.35;
        const ends = p >= 1 ? [P[0], P[P.length - 1]] : [P[0]];
        for (const [x, y] of ends) {
          ctx.beginPath();
          ctx.arc(x, y, w * 0.62, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke(path);
        // kreślarskie przedłużenia: linie konstrukcyjne wychodzą lekko poza końce
        const ov = style.overshoot ?? 0;
        if (ov && p >= 1 && n > 4 && Math.hypot(r[n - 1][0] - r[0][0], r[n - 1][1] - r[0][1]) > 6) {
          ctx.globalAlpha *= 0.45;
          ctx.lineWidth = w * 0.6;
          const ext = (a, b) => {
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(a[0] + ((a[0] - b[0]) / d) * ov, a[1] + ((a[1] - b[1]) / d) * ov);
            ctx.stroke();
          };
          ext(P[0], P[Math.min(3, P.length - 1)]);
          ext(P[P.length - 1], P[Math.max(0, P.length - 4)]);
        }
      }
      ctx.restore();
    } else {
      // pióro / kreda / grafit: grubość zależna od nacisku, krzywizny i drżenia ręki;
      // kreda i grafit idą przez warstwę, w której ziarno podłoża wydrapuje "dziury"
      const chalk = kind === 'chalk' || kind === 'graphite';
      let target = ctx, box = null;
      if (chalk) {
        this.#ensureLayer();
        info.bounds ??= bounds(r);
        box = this.#deviceBox(info.bounds, w + jitter + 2);
        if (box) {
          target = this.layerCtx;
          target.save();
          target.setTransform(1, 0, 0, 1, 0, 0);
          target.clearRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
          target.setTransform(ctx.getTransform());
        }
      }
      if (!chalk || box) {
        if (!chalk) target.save();
        target.strokeStyle = color;
        target.lineCap = 'round';
        target.lineJoin = 'round';
        if (o.alpha != null && !chalk) target.globalAlpha *= o.alpha;
        const alpha0 = target.globalAlpha;
        for (let i = 1; i <= last; i += 2) {
          const end = Math.min(last, i + 1);
          if (!visible(i)) continue;
          const d = i * step;
          target.beginPath();
          target.moveTo(P[i - 1][0], P[i - 1][1]);
          for (let k = i; k <= end; k++) target.lineTo(P[k][0], P[k][1]);
          const press = taper > 0 ? Math.min(1, d / taper + 0.3, (L - d) / taper + 0.3) : 1;
          const bend = 1 + pressure * Math.min(1, curv[Math.min(i, n - 1)] * 8);
          const wob = 0.84 + 0.26 * noise1(seed * 3.7 + d * 0.02);
          // pędzel / ścięta stalówka: kreska grubsza w poprzek "ostrza", cieniutka wzdłuż
          let nib = 1;
          if (style.nib != null) {
            const a = Math.atan2(P[end][1] - P[i - 1][1], P[end][0] - P[i - 1][0]);
            const k = style.nibMin ?? 0.25;
            nib = k + (1 - k) * Math.abs(Math.sin(a - style.nib));
          }
          target.lineWidth = Math.max(0.4, w * press * wob * bend * nib);
          // pióro z kałamarza: atrament z każdą kreską się wyczerpuje (kreska blednie), nowa kreska = nowe zanurzenie
          if (style.inkFade) target.globalAlpha = alpha0 * (1 - style.inkFade * Math.min(1, d / (style.inkReach ?? 520)));
          target.stroke();
        }
        target.restore();
        // kreda: ziarno tablicy wydrapuje "dziury" w kresce
        if (chalk) this.#composite(box, { grain: style.grain ?? 0.6, chalk: kind === 'chalk', granule: kind === 'graphite', alpha: o.alpha ?? 0.95 });
      }
    }

    if (o.sketchy ?? style.sketchy) {
      this.pen(pts, p, { ...o, sketchy: false, seed: seed + 101, w: (o.w ?? 3.2) * 0.45, alpha: (o.alpha ?? 1) * 0.45, jitter: (o.jitter ?? 1.1) * 2.2 });
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
    const plan = o.plan ?? StrokePlan.of(parts);
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
    if (!o.solid) o = { ...this.theme.crayon, ...o };
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
    if (o.wash) {
      this.#wash(poly, p, o, z, count, box, width);
      return p >= 1 ? null : crayonTip(z, p, seed);
    }
    if (o.halftone) {
      this.#halftone(poly, p, o, z, count, box, width);
      return p >= 1 ? null : crayonTip(z, p, seed);
    }
    if (o.pixel) {
      this.#pixelFill(poly, o, z, count, width);
      return p >= 1 ? null : crayonTip(z, p, seed);
    }

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
      const wv = o.wave === 0 ? 0 : z.wave[i];
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

    // ziarno: wydrapujemy drobne rysy jak przy kredce/kredzie na fakturze podłoża
    this.#composite(box, {
      grain: o.solid ? 0 : o.grain ?? 1,
      chalk: !!o.chalk,
      alpha: o.alpha ?? (o.solid ? 1 : 0.85),
      blend: o.blend,
    });
    return p >= 1 ? null : crayonTip(z, p, seed);
  }

  /** Wypełnienie pikselami: kratki siatki, przez które przeszedł zygzak, o ile leżą w konturze. */
  #pixelFill(poly, o, z, count, width) {
    const { ctx } = this;
    const g = this.theme.pen.grid ?? 8;
    const r = Math.max(g / 2, width / 2);
    const seen = new Set();
    const path = new Path2D();
    for (let i = 0; i < count; i++) {
      const [x, y] = z.path[i];
      for (let cx = Math.floor((x - r) / g); cx <= Math.floor((x + r) / g); cx++) {
        for (let cy = Math.floor((y - r) / g); cy <= Math.floor((y + r) / g); cy++) {
          const key = cx * 4096 + cy;
          if (seen.has(key)) continue;
          seen.add(key);
          if (pointInPoly([(cx + 0.5) * g, (cy + 0.5) * g], poly)) path.rect(cx * g, cy * g, g, g);
        }
      }
    }
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.fillStyle = this.col(o.color, 'teal');
    ctx.fill(path);
    ctx.restore();
  }

  /**
   * Akwarela: plama farby o nieregularnym brzegu, z ciemniejszym pigmentem przy
   * krawędzi, przejaśnieniami i ziarnem papieru. Odsłania się mokrym, rozmytym
   * frontem za pędzlem (ten sam zygzak co ślad ręki).
   */
  #wash(poly, p, o, z, count, box, width) {
    const { ctx } = this;
    const lc = this.layerCtx;
    const [x0, y0, x1, y1] = box;
    const g = washGeometry(poly, o.seed ?? 5, o.holes);
    const col = this.col(o.color, 'sky');
    const shape = () => {
      lc.beginPath();
      for (const ring of g.rings) {
        ring.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y)));
        lc.closePath();
      }
    };
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(x0, y0, x1 - x0, y1 - y0);
    lc.setTransform(ctx.getTransform());
    // warstwa farby (soft: mgławica — mocno rozmyta, bez brzegu)
    if (o.soft) lc.filter = `blur(${o.soft === true ? 14 : o.soft}px)`;
    shape();
    lc.fillStyle = col;
    lc.globalAlpha = 0.5;
    lc.fill('evenodd');
    lc.filter = 'none';
    // nierówne rozłożenie pigmentu: kilka miękkich plam ciemniej i jaśniej
    lc.save();
    lc.clip('evenodd');
    for (const b of g.blots) {
      const gr = lc.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lc.globalAlpha = b.a;
      lc.globalCompositeOperation = b.a > 0.2 ? 'source-over' : 'destination-out';
      lc.fillStyle = gr;
      lc.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    lc.restore();
    // pigment zbiera się na brzegu wysychającej plamy
    if (!o.soft) {
      shape();
      lc.strokeStyle = col;
      lc.globalAlpha = 0.75;
      lc.lineWidth = 2.4;
      lc.filter = 'blur(1px)';
      lc.stroke();
      lc.filter = 'none';
    }
    // mokry front: widać tylko to, przez co przeszedł pędzel
    if (p < 1) {
      lc.globalCompositeOperation = 'destination-in';
      lc.globalAlpha = 1;
      lc.filter = 'blur(5px)';
      lc.strokeStyle = '#000';
      lc.lineCap = 'round';
      lc.lineJoin = 'round';
      lc.lineWidth = width * 1.7;
      lc.beginPath();
      for (let i = 0; i < count; i++) {
        const [x, y] = z.path[i];
        i ? lc.lineTo(x, y) : lc.moveTo(x, y);
      }
      lc.stroke();
      lc.filter = 'none';
    }
    lc.restore();
    // na jasnym papierze farba mnoży się z podłożem; na ciemnym (kosmos) — świeci (blend: 'screen'/'lighter')
    this.#composite(box, { grain: o.grain ?? 0.35, granule: true, alpha: o.alpha ?? 0.9, blend: o.blend ?? 'multiply' });
  }

  /**
   * Komiks: płaski kolor markera w konturze + raster kropek (cień drukarski),
   * odsłaniany pasami markera (ten sam zygzak co ślad ręki). Mnożenie — czarny
   * kontur pod spodem zostaje czarny.
   */
  #halftone(poly, p, o, z, count, box, width) {
    const { ctx } = this;
    const lc = this.layerCtx;
    const [x0, y0, x1, y1] = box;
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(x0, y0, x1 - x0, y1 - y0);
    lc.setTransform(ctx.getTransform());
    lc.beginPath();
    poly.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y)));
    lc.closePath();
    for (const hole of o.holes ?? []) {
      hole.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y)));
      lc.closePath();
    }
    lc.clip('evenodd');
    lc.fillStyle = this.col(o.color, 'sky');
    lc.globalAlpha = 0.88;
    lc.fill('evenodd');
    // raster w układzie urządzenia (kropki nie skalują się z kamerą — jak w druku)
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalAlpha = o.dots ?? 0.3;
    lc.fillStyle = lc.createPattern(halftoneTexture(), 'repeat');
    lc.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (p < 1) {
      lc.setTransform(ctx.getTransform());
      lc.globalCompositeOperation = 'destination-in';
      lc.globalAlpha = 1;
      lc.strokeStyle = '#000';
      lc.lineCap = 'round';
      lc.lineJoin = 'round';
      lc.lineWidth = width * 1.25;
      lc.beginPath();
      for (let i = 0; i < count; i++) {
        const [x, y] = z.path[i];
        i ? lc.lineTo(x, y) : lc.moveTo(x, y);
      }
      lc.stroke();
    }
    lc.restore();
    // domyślnie mnożenie (czarny kontur pod kolorem zostaje czarny); blend 'source-over' — kolor kryjący (np. biały lód na wodzie)
    this.#composite(box, { alpha: o.alpha ?? 1, blend: o.blend ?? 'multiply' });
  }

  /** Gdzie jest ręka przy kolorowaniu kredką (bez rysowania) — jedzie zygzakiem wewnątrz konturu. */
  crayonTrace(poly, p, o = {}) {
    return crayonTrace(poly, p, o);
  }

  /**
   * Przenosi fragment pomocniczego płótna (warstwy) na scenę z efektem motywu:
   * grain — wydrapanie ziarna (kredka/kreda), glow — poświata (neon), blend — tryb mieszania.
   */
  #composite(box, { grain = 0, chalk = false, granule = false, alpha = 1, blend, glow = false } = {}) {
    if (!box) return;
    const [x0, y0, x1, y1] = box;
    const lc = this.layerCtx, ctx = this.ctx;
    if (grain > 0) {
      lc.save();
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'destination-out';
      lc.globalAlpha = clamp(grain);
      lc.fillStyle = lc.createPattern(chalk ? chalkTexture() : granule ? granuleTexture() : grainTexture(), 'repeat');
      lc.fillRect(x0, y0, x1 - x0, y1 - y0);
      lc.restore();
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= alpha;
    if (blend) ctx.globalCompositeOperation = blend;
    if (glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(7px)';
      ctx.drawImage(this.layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      ctx.filter = 'none';
    }
    ctx.drawImage(this.layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
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
    // tło z fakturą (siatka, tablica, papier) odmalowujemy w kształcie — płaski kolor by je zakrył
    if (color === 'paper' && this.base && this.paperSize) {
      const { ctx } = this;
      ctx.save();
      ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      ctx.setTransform(this.base);
      this.paper(...this.paperSize);
      ctx.restore();
      return;
    }
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
    ctx.globalCompositeOperation = o.blend ?? this.theme.highlight.blend ?? 'multiply';
    ctx.globalAlpha *= o.alpha ?? this.theme.highlight.alpha ?? 0.45;
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
    if (this.theme.pen.style === 'neon' && rad > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = this.col(color);
      for (const [k, a] of [[2.6, 0.12], [1.7, 0.25]]) {
        ctx.globalAlpha = alpha * a;
        ctx.beginPath();
        ctx.arc(x, y, rad * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }
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
    const fx = this.#textFx();

    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x + jx, y + jy);
    const drawImages = (g) => geo.lines.forEach((ln, i) => {
      const im = images[i];
      g.drawImage(im, ln.dx - ln.pad, ln.dy - ln.asc, im.width / IMG_SCALE, im.height / IMG_SCALE);
    });
    if (!st && !fx) {
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
      if (!st) drawImages(lc);
      else geo.strokes.forEach((s, i) => {
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
      if (st) {
        lc.globalCompositeOperation = 'source-in';
        drawImages(lc);
      }
      lc.restore();
      this.#composite(box, fx ?? {});
    }
    ctx.restore();
    if (!st) return null;
    const t = st.tip;
    return t && { x: x + t.x, y: y + t.y, angle: t.angle, lift: t.lift };
  }

  /** Efekt motywu dla pisma: ziarno kredy, poświata neonu (null = zwykły tusz). */
  #textFx() {
    const kind = this.theme.pen.style;
    if (kind === 'chalk') return { grain: (this.theme.pen.grain ?? 0.6) * 0.8, chalk: true, alpha: 0.95 };
    if (kind === 'graphite') return { grain: (this.theme.pen.grain ?? 0.4) * 0.7, granule: true, alpha: 0.95 };
    if (kind === 'neon' || this.theme.text.glow) return { glow: true };
    return null;
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
    // motyw podmienia narzędzie: na tablicy kreda, na kalce rapidograf, na szybie neonowy pisak
    const req = o.type ?? 'pencil';
    // 'crayon' (kolorowanie) bez własnego narzędzia w motywie = to samo co ołówek motywu
    const type = this.theme.tools[req] ?? (req === 'crayon' ? this.theme.tools.pencil ?? 'pencil' : req);
    const lift = clamp(o.lift ?? 0);
    const size = (o.size ?? 1) * (1 + 0.07 * lift); // uniesione narzędzie jest bliżej "kamery"
    const t = this.time;
    const ang = (o.angle ?? -1.05) + (o.lean ?? 0) + (o.still ? 0 : noise1(t * 2.1) * 0.06);
    ctx.save();
    ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.lineJoin = 'round';
    if (type === 'eraser') this.#eraserSprite(size, lift, o);
    else if (type === 'pixelpencil') this.#pixelPencilSprite(size, lift, o);
    else if (type === 'caret') this.#caretSprite(size, lift, o);
    else {
      const len = ({ marker: 110, chalk: 62, techpen: 132, neon: 118, ballpoint: 128, brush: 150, brushpen: 124, flipmarker: 118, quill: 150, gouge: 112, lightpen: 120, charcoal: 96 }[type] ?? 120) * size;
      const wd = ({ marker: 20, chalk: 15, techpen: 12, neon: 18, ballpoint: 11, brush: 9, brushpen: 13, flipmarker: 22, quill: 26, gouge: 12, lightpen: 14, charcoal: 15 }[type] ?? 13) * size;
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
      else if (type === 'chalk') this.#chalkSprite(len, wd, size, o);
      else if (type === 'techpen') this.#techpenSprite(len, wd, size, o);
      else if (type === 'neon') this.#neonSprite(len, wd, size, o);
      else if (type === 'ballpoint') this.#ballpointSprite(len, wd, size, o);
      else if (type === 'brush') this.#brushSprite(len, wd, size, o);
      else if (type === 'brushpen') this.#brushpenSprite(len, wd, size, o);
      else if (type === 'flipmarker') this.#flipmarkerSprite(len, wd, size, o);
      else if (type === 'quill') this.#quillSprite(len, wd, size, o);
      else if (type === 'gouge') this.#gougeSprite(len, wd, size, o);
      else if (type === 'lightpen') this.#lightpenSprite(len, wd, size, o);
      else if (type === 'charcoal') this.#charcoalSprite(len, wd, size, o);
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
    ctx.strokeStyle = this.theme.outline ?? this.col('ink');
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
    ctx.strokeStyle = this.theme.outline ?? this.col('ink');
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

  /** Kawałek kredy w kolorze kreski: starta, zaokrąglona końcówka, matowa faktura. */
  #chalkSprite(len, wd, size, o) {
    const { ctx } = this;
    const col = this.col(o.color, 'ink');
    ctx.fillStyle = col;
    ctx.beginPath();
    // starty czubek (skos), dalej walec
    ctx.moveTo(0, -wd * 0.12);
    ctx.quadraticCurveTo(-1 * size, wd * 0.2, 6 * size, wd * 0.5);
    ctx.lineTo(len - wd * 0.3, wd / 2);
    ctx.quadraticCurveTo(len + wd * 0.15, 0, len - wd * 0.3, -wd / 2);
    ctx.lineTo(9 * size, -wd / 2);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, -wd / 2, len, wd * 0.28);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, wd * 0.18, len, wd * 0.32);
    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = ctx.createPattern(chalkTexture(), 'repeat');
    ctx.fillRect(0, -wd / 2, len, wd);
    ctx.restore();
    ctx.strokeStyle = 'rgba(20,24,22,0.55)';
    ctx.lineWidth = 1.2 * size;
    ctx.stroke();
  }

  /** Rapidograf (cienkopis kreślarski): stalowa rurka, ciemny korpus, kolorowy pierścień. */
  #techpenSprite(len, wd, size, o) {
    const { ctx } = this;
    const ring = this.col(o.color, 'teal');
    const tube = 16 * size, cone = 16 * size;
    ctx.strokeStyle = 'rgba(5,15,30,0.7)';
    ctx.lineWidth = 1.2 * size;
    // stalowa rurka
    ctx.fillStyle = '#d7dee6';
    ctx.fillRect(0, -1.2 * size, tube, 2.4 * size);
    ctx.strokeRect(0, -1.2 * size, tube, 2.4 * size);
    // stożek
    ctx.fillStyle = '#9aa6b2';
    ctx.beginPath();
    ctx.moveTo(tube, -2.2 * size);
    ctx.lineTo(tube + cone, -wd * 0.42);
    ctx.lineTo(tube + cone, wd * 0.42);
    ctx.lineTo(tube, 2.2 * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // korpus
    const x0 = tube + cone;
    ctx.fillStyle = '#20262e';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, -wd / 2, len - x0, wd, [1, 4 * size, 4 * size, 1]);
    else ctx.rect(x0, -wd / 2, len - x0, wd);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ring;
    ctx.fillRect(x0 + 6 * size, -wd / 2, 6 * size, wd);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x0, -wd / 2 + 1.5 * size, len - x0, wd * 0.22);
  }

  /** Pisak do szyby (lightboard): czarny korpus, świecąca końcówka w kolorze kreski. */
  #neonSprite(len, wd, size, o) {
    const { ctx } = this;
    const ink = this.col(o.color, 'pen');
    const tip = 12 * size;
    // poświata wokół końcówki
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * size);
    g.addColorStop(0, ink);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha *= 0.45;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tip, -wd * 0.3);
    ctx.lineTo(tip, wd * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#16181f';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(tip, -wd / 2, len - tip, wd, [3 * size, 7 * size, 7 * size, 3 * size]);
    else ctx.rect(tip, -wd / 2, len - tip, wd);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.globalAlpha *= 0.9;
    ctx.fillRect(len - 26 * size, -wd / 2, 10 * size, wd);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(tip, -wd / 2 + 2 * size, len - tip, wd * 0.2);
  }

  /** Długopis: metalowa końcówka, przezroczysty sześciokątny korpus z wkładem, zatyczka w kolorze tuszu. */
  #ballpointSprite(len, wd, size, o) {
    const { ctx } = this;
    const ink = this.col(o.color, 'ink');
    const tip = 7 * size, cone = 15 * size;
    ctx.strokeStyle = this.theme.outline ?? '#333';
    ctx.lineWidth = 1.2 * size;
    // metalowa kulka i stożek
    ctx.fillStyle = '#c9ccd1';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tip, -1.6 * size);
    ctx.lineTo(tip, 1.6 * size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(235,240,245,0.92)';
    ctx.beginPath();
    ctx.moveTo(tip, -1.8 * size);
    ctx.lineTo(tip + cone, -wd / 2);
    ctx.lineTo(len - 8 * size, -wd / 2);
    ctx.lineTo(len - 8 * size, wd / 2);
    ctx.lineTo(tip + cone, wd / 2);
    ctx.lineTo(tip, 1.8 * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // wkład z tuszem widoczny przez korpus
    ctx.fillStyle = ink;
    ctx.globalAlpha *= 0.8;
    ctx.fillRect(tip + cone * 0.6, -1.4 * size, len - tip - cone * 0.6 - 12 * size, 2.8 * size);
    ctx.globalAlpha /= 0.8;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(tip + cone, -wd / 2 + 1.2 * size, len - tip - cone - 10 * size, wd * 0.18);
    // zatyczka
    ctx.fillStyle = ink;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(len - 10 * size, -wd * 0.38, 10 * size, wd * 0.76, [1, 3 * size, 3 * size, 1]);
    else ctx.rect(len - 10 * size, -wd * 0.38, 10 * size, wd * 0.76);
    ctx.fill();
    ctx.stroke();
  }

  /** Pędzel do akwareli: włosie nasączone farbą, srebrna skuwka, długa drewniana rączka. */
  #brushSprite(len, wd, size, o) {
    const { ctx } = this;
    const paint = this.col(o.color, 'sky');
    const hair = 26 * size, ferrule = 20 * size;
    ctx.strokeStyle = this.theme.outline ?? '#333';
    ctx.lineWidth = 1.2 * size;
    // włosie: kropla, czubek w (0,0)
    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(hair * 0.45, -wd * 0.75, hair, -wd * 0.42);
    ctx.lineTo(hair, wd * 0.42);
    ctx.quadraticCurveTo(hair * 0.45, wd * 0.75, 0, 0);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = paint;
    ctx.globalAlpha *= 0.9;
    ctx.fillRect(0, -wd, hair * 0.6, wd * 2);
    ctx.restore();
    ctx.stroke();
    // skuwka
    ctx.fillStyle = '#c9ccd1';
    ctx.fillRect(hair, -wd * 0.45, ferrule, wd * 0.9);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(hair, -wd * 0.4, ferrule, wd * 0.2);
    ctx.strokeRect(hair, -wd * 0.45, ferrule, wd * 0.9);
    // rączka zwężająca się ku końcowi
    const x0 = hair + ferrule;
    ctx.fillStyle = '#b5683a';
    ctx.beginPath();
    ctx.moveTo(x0, -wd * 0.45);
    ctx.lineTo(len - 6 * size, -wd * 0.28);
    ctx.quadraticCurveTo(len, 0, len - 6 * size, wd * 0.28);
    ctx.lineTo(x0, wd * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /** Pisak pędzelkowy (komiks): elastyczna końcówka w kolorze tuszu, czarny korpus z kolorowym paskiem. */
  #brushpenSprite(len, wd, size, o) {
    const { ctx } = this;
    const ink = this.col(o.color, 'ink');
    const tip = 20 * size, grip = 18 * size;
    ctx.strokeStyle = this.theme.outline ?? '#141414';
    ctx.lineWidth = 1.4 * size;
    // końcówka-pędzelek
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(tip * 0.5, -wd * 0.45, tip, -wd * 0.3);
    ctx.lineTo(tip, wd * 0.3);
    ctx.quadraticCurveTo(tip * 0.5, wd * 0.45, 0, 0);
    ctx.fill();
    ctx.stroke();
    // uchwyt i korpus
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(tip, -wd * 0.38, grip, wd * 0.76);
    ctx.strokeRect(tip, -wd * 0.38, grip, wd * 0.76);
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(tip + grip, -wd / 2, len - tip - grip, wd, [2 * size, 6 * size, 6 * size, 2 * size]);
    else ctx.rect(tip + grip, -wd / 2, len - tip - grip, wd);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink === this.col('ink') ? this.col('pen') : ink;
    ctx.fillRect(len - 30 * size, -wd / 2, 9 * size, wd);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(tip + grip, -wd / 2 + 2 * size, len - tip - grip, wd * 0.2);
  }

  /** Marker do flipchartu: okrągła filcowa końcówka, gruby korpus, skuwka w kolorze tuszu. */
  #flipmarkerSprite(len, wd, size, o) {
    const { ctx } = this;
    const ink = this.col(o.color, 'ink');
    const tip = 10 * size, neck = 16 * size;
    ctx.strokeStyle = this.theme.outline ?? '#2a2a2a';
    ctx.lineWidth = 1.4 * size;
    // filc
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(tip, -wd * 0.22);
    ctx.quadraticCurveTo(-2 * size, -wd * 0.2, 0, 0);
    ctx.quadraticCurveTo(-2 * size, wd * 0.2, tip, wd * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // szyjka
    ctx.fillStyle = '#e8e8ea';
    ctx.beginPath();
    ctx.moveTo(tip, -wd * 0.28);
    ctx.lineTo(tip + neck, -wd / 2);
    ctx.lineTo(tip + neck, wd / 2);
    ctx.lineTo(tip, wd * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // korpus z etykietą w kolorze
    const x0 = tip + neck;
    ctx.fillStyle = '#f4f4f6';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, -wd / 2, len - x0, wd, [2 * size, 8 * size, 8 * size, 2 * size]);
    else ctx.rect(x0, -wd / 2, len - x0, wd);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillRect(x0 + 14 * size, -wd / 2 + 1, (len - x0) * 0.45, wd - 2);
    ctx.fillRect(len - 12 * size, -wd / 2 + 1, 10 * size, wd - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x0, wd * 0.15, len - x0, wd * 0.3);
  }

  /** Pióro gęsie: stalówka z kropelką atramentu, dutka, chorągiewka pióra z promieniami. */
  #quillSprite(len, wd, size, o) {
    const { ctx } = this;
    const nib = 16 * size, shaft = 46 * size;
    ctx.strokeStyle = this.theme.outline ?? '#3a2614';
    ctx.lineWidth = 1.2 * size;
    // stalówka (zacięta dutka) z atramentem na czubku
    ctx.fillStyle = '#d9c8a2';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(nib, -3 * size);
    ctx.lineTo(nib, 3 * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.col(o.color, 'ink');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(nib * 0.45, -1.4 * size);
    ctx.lineTo(nib * 0.45, 1.4 * size);
    ctx.closePath();
    ctx.fill();
    // dutka
    ctx.fillStyle = '#efe4c8';
    ctx.fillRect(nib, -2.6 * size, shaft, 5.2 * size);
    ctx.strokeRect(nib, -2.6 * size, shaft, 5.2 * size);
    // chorągiewka: łukowate pióro z promieniami
    const x0 = nib + shaft * 0.35, x1 = len;
    ctx.fillStyle = '#f4ecda';
    ctx.beginPath();
    ctx.moveTo(x0, -2 * size);
    ctx.quadraticCurveTo((x0 + x1) / 2, -wd * 1.1, x1, -wd * 0.25);
    ctx.quadraticCurveTo(x1 - 8 * size, 0, x1, wd * 0.15);
    ctx.quadraticCurveTo((x0 + x1) / 2, wd * 0.55, x0 + 10 * size, 2 * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,70,40,0.35)';
    ctx.lineWidth = 0.8 * size;
    for (let i = 1; i < 9; i++) {
      const x = x0 + ((x1 - x0) * i) / 9;
      ctx.beginPath();
      ctx.moveTo(x, -1 * size);
      ctx.lineTo(x + 10 * size, -wd * (0.55 + 0.35 * Math.sin((i / 9) * Math.PI)));
      ctx.stroke();
    }
    ctx.strokeStyle = this.theme.outline ?? '#3a2614';
    ctx.beginPath();
    ctx.moveTo(nib, 0);
    ctx.lineTo(x1 - 4 * size, -wd * 0.05);
    ctx.stroke();
  }

  /** Dłuto do drzeworytu: stalowe ostrze w kształcie V, ferrula, gruszkowa drewniana rączka. */
  #gougeSprite(len, wd, size, o) {
    const { ctx } = this;
    const blade = 44 * size, ferrule = 10 * size;
    ctx.strokeStyle = this.theme.outline ?? '#17120e';
    ctx.lineWidth = 1.3 * size;
    ctx.fillStyle = '#b8bcc2';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(6 * size, -3.4 * size);
    ctx.lineTo(blade, -3 * size);
    ctx.lineTo(blade, 3 * size);
    ctx.lineTo(6 * size, 3.4 * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(6 * size, -2.6 * size, blade - 8 * size, 1.4 * size);
    ctx.fillStyle = '#8e9298';
    ctx.fillRect(blade, -4.5 * size, ferrule, 9 * size);
    ctx.strokeRect(blade, -4.5 * size, ferrule, 9 * size);
    // rączka: gruszka
    const x0 = blade + ferrule;
    ctx.fillStyle = '#a8703f';
    ctx.beginPath();
    ctx.moveTo(x0, -5 * size);
    ctx.bezierCurveTo(x0 + 20 * size, -wd * 0.9, len - 8 * size, -wd * 1.4, len, 0);
    ctx.bezierCurveTo(len - 8 * size, wd * 1.4, x0 + 20 * size, wd * 0.9, x0, 5 * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse((x0 + len) / 2 + 6 * size, -wd * 0.45, (len - x0) * 0.3, wd * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Pióro świetlne (lata 60.): szary walec z przyciskiem, świecący czubek, kabel do komputera. */
  #lightpenSprite(len, wd, size, o) {
    const { ctx } = this;
    const ink = this.col(o.color, 'ink');
    // poświata czubka na ekranie
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 18 * size);
    g.addColorStop(0, ink);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = g;
    ctx.fillRect(-18 * size, -18 * size, 36 * size, 36 * size);
    ctx.restore();
    ctx.strokeStyle = this.theme.outline ?? '#0a0a0a';
    ctx.lineWidth = 1.2 * size;
    const tip = 14 * size;
    ctx.fillStyle = '#9aa0a6';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tip, -wd * 0.36);
    ctx.lineTo(tip, wd * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9cdd1';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(tip, -wd / 2, len - tip, wd, [2 * size, 6 * size, 6 * size, 2 * size]);
    else ctx.rect(tip, -wd / 2, len - tip, wd);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b3f44';
    ctx.fillRect(tip + 18 * size, -wd / 2 - 2 * size, 12 * size, 4 * size);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(tip, -wd / 2 + 2 * size, len - tip, wd * 0.2);
    // kabel
    ctx.strokeStyle = '#2b2f33';
    ctx.lineWidth = 3 * size;
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.bezierCurveTo(len + 30 * size, 6 * size, len + 40 * size, 50 * size, len + 80 * size, 70 * size);
    ctx.stroke();
  }

  /** Gąbka do tablicy: filc na dole, drewniany grzbiet; środek filcu w (0,0). */
  /** Węgiel rysunkowy: nierówny, matowy patyk ze skośnie startym czubkiem. */
  #charcoalSprite(len, wd, size, o) {
    const { ctx } = this;
    const r = rng(7);
    ctx.fillStyle = '#1c1a19';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7 * size, -wd * 0.5);
    // nierówny brzeg zwęglonej gałązki
    for (let x = 12; x <= len; x += 10) ctx.lineTo(x, -wd * (0.48 + r() * 0.08));
    ctx.lineTo(len + 2 * size, 0);
    for (let x = len; x >= 12; x -= 10) ctx.lineTo(x, wd * (0.46 + r() * 0.08));
    ctx.lineTo(9 * size, wd * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    // matowy połysk wzdłuż i ziarno
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, -wd / 2, len, wd * 0.22);
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = ctx.createPattern(chalkTexture(), 'repeat');
    ctx.fillRect(0, -wd / 2, len, wd);
    ctx.restore();
    // starta, szara płaszczyzna czubka
    ctx.fillStyle = 'rgba(120,115,110,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7 * size, -wd * 0.5);
    ctx.lineTo(9 * size, wd * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  /** Kursor terminala: jasny blok wielkości znaku, czubek w lewym dolnym rogu. */
  #caretSprite(size, lift, o) {
    const { ctx } = this;
    const [cw, ch] = this.theme.ascii?.cell ?? [9, 16];
    ctx.translate(0, -lift * 8);
    ctx.globalAlpha *= 0.9;
    ctx.fillStyle = this.col(o.color && !['ink', 'inkSoft'].includes(o.color) ? o.color : 'ink');
    ctx.fillRect(0, -ch * size, cw * size, ch * size);
  }

  /** Ołówek z pikseli, jak kursor w programie do rysowania: zawsze ukośnie, grot w (0,0). */
  #pixelPencilSprite(size, lift, o) {
    const { ctx } = this;
    const cs = 4 * size;
    const cells = pixelPencil();
    ctx.translate(0, -lift * 10);
    const lead = o.color && !['ink', 'inkSoft'].includes(o.color) ? this.col(o.color) : '#3a3a3a';
    const map = { K: '#101010', G: lead, W: '#e8c48a', Y: '#f4c430', D: '#c99a10', S: '#b8bcc8', P: '#ff8fa3' };
    for (const [i, j, c] of cells) {
      ctx.fillStyle = map[c];
      ctx.fillRect(i * cs, (j - 1) * cs, cs, cs);
    }
  }

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
    ctx.strokeStyle = this.theme.outline ?? this.col('ink');
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
  // zwykła i pogrubiona waga (tytuły pisane `weight: 700`)
  const loads = Object.values(fonts).flatMap((f) => [`32px ${f}`, `700 32px ${f}`]).map((css) => document.fonts.load(css, sample).catch(() => null));
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
  // dziury (fragmenty zygzaka całkiem poza konturem, np. wklęsły kształt): ręka
  // przelatuje płynnie od ostatniego do następnego znanego punktu, zamiast czekać
  // i przeskoczyć; przed pierwszym i po ostatnim — stoi w znanym punkcie
  const first = raw.find(Boolean) ?? [b.cx, b.cy];
  const filled = raw.slice();
  let prev = -1;
  for (let i = 0; i <= n; i++) {
    if (i < n && !raw[i]) continue;
    const a = prev >= 0 ? raw[prev] : null, c = i < n ? raw[i] : null;
    for (let j = prev + 1; j < i; j++) {
      const q = (j - prev) / (i - prev);
      filled[j] = a && c ? [a[0] + (c[0] - a[0]) * q, a[1] + (c[1] - a[1]) * q] : a ?? c ?? first;
    }
    prev = i;
  }
  // drugie wygładzenie (okno ±W, czyli jeden rząd) — bez szarpnięć przy zmianie
  // liczby punktów w oknie (wklęsłe kształty, rzędy o bardzo różnej długości)
  const h = Math.max(1, W);
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
const washCache = new WeakMap();
/** Kształt plamy akwareli: brzeg lekko rozlany (szum wzdłuż normalnej) + plamy pigmentu. */
function washGeometry(poly, seed, holes = []) {
  const key = `${seed}|${holes.length}`;
  let m = washCache.get(poly);
  if (m?.has(key)) return m.get(key);
  const bleed = (ring, k) => {
    const r = resample([...ring, ring[0]], 5);
    const n = r.length;
    return r.map(([x, y], i) => {
      const a = r[(i - 1 + n) % n], c = r[(i + 1) % n];
      const tx = c[0] - a[0], ty = c[1] - a[1], d = Math.hypot(tx, ty) || 1;
      const off = 3.2 * noise1(seed * 7.1 + k * 31 + i * 0.09) + 1.4 * noise1(seed + i * 0.43);
      return [x - (ty / d) * off, y + (tx / d) * off];
    });
  };
  const b = bounds(poly);
  const r = rng(seed * 13 + 1);
  const blots = Array.from({ length: 7 }, (_, i) => {
    let pt;
    for (let t = 0; t < 12; t++) {
      pt = [b.x + r() * b.w, b.y + r() * b.h];
      if (pointInPoly(pt, poly)) break;
    }
    return { x: pt[0], y: pt[1], r: Math.max(16, Math.min(b.w, b.h) * (0.5 + r() * 0.45)), a: i % 3 === 2 ? 0.12 : 0.13 + r() * 0.12 };
  });
  const g = { rings: [bleed(poly, 0), ...holes.map((h, k) => bleed(h, k + 1))], blots };
  if (!m) washCache.set(poly, (m = new Map()));
  m.set(key, g);
  return g;
}

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

let pencilCells = null;
/** Komórki pikselowego ołówka [i, j, kolor]; grot w (0,0), oś ukośnie w górę i w prawo. */
function pixelPencil() {
  if (pencilCells) return pencilCells;
  const fill = new Map();
  for (let i = -2; i < 18; i++) {
    for (let j = -18; j < 2; j++) {
      const vx = i + 0.5, vy = j - 0.5;
      const along = (vx - vy) / Math.SQRT2, across = (vx + vy) / Math.SQRT2;
      const hw = along < 4.5 ? along * 0.5 : 2.3;
      if (along < 0 || along > 19 || Math.abs(across) > hw) continue;
      const c = along < 1.6 ? 'G' : along < 4.5 ? 'W' : along < 15 ? (across > 0.7 ? 'D' : 'Y') : along < 16.6 ? 'S' : 'P';
      fill.set(i * 64 + j, [i, j, c]);
    }
  }
  // obrys: czarne komórki dookoła wypełnionych
  const body = [...fill.values()];
  const out = [];
  for (const [i, j] of body) {
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = (i + a) * 64 + j + b;
      if (!fill.has(key)) { fill.set(key, null); out.push([i + a, j + b, 'K']); }
    }
  }
  out.push(...body);
  return (pencilCells = out);
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

let chalkCache = null;
/** Ziarno kredy na tablicy: gęste drobne "dziury" i krótkie poziome przetarcia. */
function chalkTexture() {
  if (chalkCache) return chalkCache;
  const S = 160;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(31);
  for (let i = 0; i < 2300; i++) {
    g.fillStyle = `rgba(0,0,0,${0.4 + r() * 0.6})`;
    const x = r() * S, y = r() * S, s = 0.6 + r() * 1.6;
    g.fillRect(x, y, s * (1 + r() * 2.5), s);
  }
  chalkCache = c;
  return c;
}

let halftoneCache = null;
/** Raster drukarski: kropki w siatce przesuniętej co drugi rząd (układ 45°). */
function halftoneTexture() {
  if (halftoneCache) return halftoneCache;
  const S = 14;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) {
    g.beginPath();
    g.arc(x, y, 2.6, 0, Math.PI * 2);
    g.fill();
  }
  halftoneCache = c;
  return c;
}

let granuleCache = null;
/** Granulacja akwareli: pigment osiada w zagłębieniach papieru — drobne, nieregularne kropki. */
function granuleTexture() {
  if (granuleCache) return granuleCache;
  const S = 192;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(77);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`;
    g.beginPath();
    g.arc(r() * S, r() * S, 0.5 + r() * 1.3, 0, Math.PI * 2);
    g.fill();
  }
  granuleCache = c;
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
