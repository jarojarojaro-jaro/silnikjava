// Pismo odręczne "prawdziwymi kreskami".
//
// Zamiast odsłaniać literę prostokątem od lewej, zamieniamy tekst na kreski
// w kolejności, w jakiej pisze człowiek:
//   1. tekst rysowany do pomocniczego płótna (z lekkim tańcem liter),
//   2. ścienianie do szkieletu o grubości 1 px (Zhang–Suen),
//   3. szkielet -> łamane (od końców kresek, na skrzyżowaniach jedziemy prosto),
//   4. kolejność: litery od lewej, w literze od lewej/góry, kropki i ogonki
//      dopisywane na końcu słowa, kierunek kreski od lewej / z góry,
//   5. przy rysowaniu: maska z kresek do aktualnego postępu, a przez maskę
//      prześwituje prawdziwy glif czcionki (wygląd czcionki, ruch ręki).
// Wynik jest liczony raz na tekst i trzymany w cache.

import { hash, clamp } from './math.js';
import { StrokePlan } from './hand.js';
import { makeCanvas } from './canvas.js';

const cache = new Map();
export const IMG_SCALE = 3; // rozdzielczość obrazka glifów (ostrość przy zoomie kamery i DPR)

export const hasDOM = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

const canvas = makeCanvas;

/**
 * Geometria tekstu do pisania odręcznego.
 * @returns {{ strokes: number[][][], plan: StrokePlan, lines, width, size, pad, ascent, image(color): HTMLCanvasElement }}
 */
export function textGeometry(text, { fontCss, size, align = 'left', lineHeight = 1.15, seed = 0, speed } = {}) {
  const key = `${text}|${fontCss}|${size}|${align}|${lineHeight}|${seed}|${speed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const lines = String(text).split('\n').map((t, li) => {
    const g = lineGeometry(t, fontCss, size, seed + li * 31);
    const dx = align === 'center' ? -g.width / 2 : align === 'right' ? -g.width : 0;
    const dy = li * size * lineHeight;
    return { ...g, dx, dy };
  });
  // wszystkie kreski w jednym układzie (początek = (x,y) z wywołania write)
  const strokes = [];
  const wordStart = new Set(); // indeksy kresek zaczynających nowe słowo — tam pauza ręki
  lines.forEach((ln) => {
    ln.strokes.forEach((s, i) => {
      if (ln.wordStarts.has(i) || (i === 0 && strokes.length)) wordStart.add(strokes.length);
      strokes.push(s.map(([x, y]) => [x + ln.dx, y + ln.dy]));
    });
  });
  const width = Math.max(...lines.map((l) => l.width));
  const images = new Map();
  const fitted = new Map();
  // tempo pisma skalibrowane na ~10 znaków/s (jak w filmach whiteboard);
  // ręka podnosi się nisko i krótko, kreski liter są krótkie, więc mały narzut
  const planOpts = {
    step: 1.5,
    speed: speed ?? Math.max(400, size * 30),
    startStop: 0.008,
    dotTime: 0.035,
    pause: (i) => (wordStart.has(i) ? 0.07 : 0),
    liftTime: (d) => 0.018 + 0.035 * Math.sqrt(d / 50),
  };
  const plan = new StrokePlan(strokes, planOpts);
  const geo = {
    strokes, plan, lines, width, size,
    /** Plan dopasowany do czasu kroku [s] (cache per czas). */
    planFor(dur) {
      if (!(dur > 0)) return plan;
      const k = dur.toFixed(3);
      let pl = fitted.get(k);
      if (!pl) fitted.set(k, (pl = new StrokePlan(strokes, { ...planOpts, fit: dur })));
      return pl;
    },
    weight: lines.reduce((a, l) => Math.max(a, l.weight), 1),
    image(color) {
      let im = images.get(color);
      if (!im) {
        im = lines.map((l) => l.render(color));
        images.set(color, im);
      }
      return im;
    },
  };
  // cache tylko z wczytaną czcionką (inaczej zapamiętalibyśmy kształty czcionki zastępczej)
  if (!document.fonts || document.fonts.check(fontCss, text)) cache.set(key, geo);
  return geo;
}

/** Układ liter jednej linii: pozycja, przechył, przesunięcie w pionie (deterministyczne). */
function layoutLine(text, fontCss, size, seed) {
  const m = canvas(1, 1).getContext('2d');
  m.font = fontCss;
  const chars = [];
  let acc = '';
  for (let i = 0; i < text.length; i++) {
    const x = m.measureText(acc).width;
    acc += text[i];
    const s = seed + i * 3.1;
    chars.push({ c: text[i], x, w: m.measureText(text[i]).width, dy: (hash(s) - 0.5) * size * 0.06, rot: (hash(s + 5.7) - 0.5) * 0.07 });
  }
  return { chars, width: m.measureText(text).width };
}

function drawChars(ctx, chars, fontCss, k, ox, oy) {
  ctx.font = fontCss;
  ctx.textBaseline = 'alphabetic';
  for (const ch of chars) {
    if (ch.c === ' ') continue;
    ctx.save();
    ctx.translate((ox + ch.x) * k, (oy + ch.dy) * k);
    ctx.rotate(ch.rot);
    ctx.scale(k, k);
    ctx.fillText(ch.c, 0, 0);
    ctx.restore();
  }
}

function lineGeometry(text, fontCss, size, seed) {
  const { chars, width } = layoutLine(text, fontCss, size, seed);
  const pad = Math.ceil(size * 0.35);
  const asc = Math.ceil(size * 1.05); // zapas nad linią bazową
  const desc = Math.ceil(size * 0.45);
  const W = width + pad * 2, H = asc + desc;

  // szkielet liczony w skali, w której kreska czcionki ma ~4–6 px
  const ks = clamp(48 / size, 0.6, 2);
  const sw = Math.ceil(W * ks), sh = Math.ceil(H * ks);
  const sc = canvas(sw, sh);
  const sctx = sc.getContext('2d', { willReadFrequently: true });
  sctx.fillStyle = '#000';
  drawChars(sctx, chars, fontCss, ks, pad, asc);
  const data = sctx.getImageData(0, 0, sw, sh).data;
  const img = new Uint8Array(sw * sh);
  let ink = 0;
  for (let i = 0; i < img.length; i++) if (data[i * 4 + 3] > 110) { img[i] = 1; ink++; }
  thin(img, sw, sh);
  let bones = 0;
  for (let i = 0; i < img.length; i++) bones += img[i];
  const weight = bones ? ink / bones / ks : size * 0.08; // średnia grubość kreski [px tekstu]

  const raw = trace(img, sw, sh);
  // do układu tekstu: (0,0) = początek linii bazowej
  const toText = ([x, y]) => [x / ks - pad, y / ks - asc];
  const minLen = size * 0.1;
  let strokes = raw
    .map((s) => ({ pts: s.pts.map(toText), connected: s.connected }))
    .map((s) => ({ ...s, len: polyLen(s.pts) }))
    .filter((s) => s.len >= minLen || !s.connected); // drobne odgałęzienia szkieletu wyrzucamy, kropki zostają

  // przypisanie do liter i słów
  const charOf = (s) => {
    const cx = s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length;
    let best = 0;
    chars.forEach((ch, i) => { if (ch.c !== ' ' && cx >= ch.x - 1) best = i; });
    return best;
  };
  const wordOf = (ci) => text.slice(0, ci + 1).split(' ').length - 1;
  strokes.forEach((s) => {
    s.ci = charOf(s);
    s.word = wordOf(s.ci);
    const ys = s.pts.map((p) => p[1]);
    s.minX = Math.min(...s.pts.map((p) => p[0]));
    s.minY = Math.min(...ys);
    s.cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    // kropki nad i/j, kreski nad ż/ź, kropki :) — dopisujemy po słowie
    s.mark = s.len < size * 0.3 && s.cy < -size * 0.5 && s.minY < -size * 0.55;
  });
  strokes.sort((a, b) =>
    a.word - b.word || (a.mark - b.mark) || a.ci - b.ci || a.minX - b.minX || a.minY - b.minY);

  // kierunek pisania: od lewej, pionowe od góry
  const out = strokes.map((s) => {
    let p = s.pts;
    const a = p[0], b = p[p.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.abs(dx) > Math.abs(dy) * 0.6 ? dx < 0 : dy < 0) p = p.slice().reverse();
    return smooth(p);
  });
  // kreski, które stykają się końcem z początkiem następnej, łączymy w jedną (bez podnoszenia)
  const merged = [];
  const mergedWord = [];
  out.forEach((p, i) => {
    const prev = merged[merged.length - 1];
    if (prev && strokes[i].word === mergedWord[mergedWord.length - 1] && p.length > 1 && prev.length > 1) {
      const a = prev[prev.length - 1], b = p[0];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < size * 0.06) {
        merged[merged.length - 1] = prev.concat(p.slice(1));
        return;
      }
    }
    merged.push(p);
    mergedWord.push(strokes[i].word);
  });
  const wordStarts = new Set();
  mergedWord.forEach((w, i) => { if (i > 0 && w !== mergedWord[i - 1]) wordStarts.add(i); });

  return {
    strokes: merged,
    wordStarts,
    width,
    weight,
    pad,
    asc,
    // obrazek glifów w danym kolorze (w skali IMG_SCALE)
    render(color) {
      const c = canvas(W * IMG_SCALE, H * IMG_SCALE);
      const g = c.getContext('2d');
      g.fillStyle = color;
      drawChars(g, chars, fontCss, IMG_SCALE, pad, asc);
      return c;
    },
  };
}

function polyLen(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}

/** Wygładzenie schodków szkieletu (średnia krocząca, końce zostają). */
function smooth(p) {
  if (p.length < 5) return p;
  const out = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 2)], b = p[i - 1], c = p[i], d = p[i + 1], e = p[Math.min(p.length - 1, i + 2)];
    out.push([(a[0] + b[0] * 2 + c[0] * 3 + d[0] * 2 + e[0]) / 9, (a[1] + b[1] * 2 + c[1] * 3 + d[1] * 2 + e[1]) / 9]);
  }
  out.push(p[p.length - 1]);
  return out;
}

// ------------------------------------------------------------------ szkielet

/** Ścienianie Zhang–Suen (in place) obrazu binarnego 0/1. */
export function thin(img, w, h) {
  const del = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!img[i]) continue;
          const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1];
          const p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if (A !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(i);
        }
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
  return img;
}

const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * Szkielet -> łamane. Startujemy z końców kresek (od lewej), na skrzyżowaniach
 * wybieramy kierunek najbardziej "prosto"; resztę (pętle jak "o") zaczynamy
 * od najbardziej lewego piksela. `connected` = kreska dochodzi do innej.
 */
export function trace(img, w, h) {
  const nb = (i) => {
    const x = i % w, y = (i / w) | 0;
    const out = [];
    for (const [dx, dy] of N8) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && img[Y * w + X]) out.push(Y * w + X);
    }
    return out;
  };
  const pixels = [];
  for (let i = 0; i < img.length; i++) if (img[i]) pixels.push(i);
  const seen = new Uint8Array(img.length);
  const deg = new Map(pixels.map((i) => [i, nb(i).length]));
  const xy = (i) => [i % w, (i / w) | 0];

  const walk = (start) => {
    const pts = [xy(start)];
    seen[start] = 1;
    let cur = start;
    let dir = null;
    let connected = false;
    for (;;) {
      const cand = nb(cur).filter((j) => !seen[j]);
      if (!cand.length) {
        // dociągnięcie do już narysowanej kreski (skrzyżowanie)
        const join = nb(cur).find((j) => seen[j] && (pts.length < 2 || j !== idx(pts[pts.length - 2])));
        if (join != null && pts.length > 1) {
          pts.push(xy(join));
          connected = true;
        } else if (nb(cur).length > 1 && pts.length === 1) connected = true;
        break;
      }
      let best = cand[0], bestScore = Infinity;
      const [cx, cy] = xy(cur);
      for (const j of cand) {
        const [jx, jy] = xy(j);
        const a = Math.atan2(jy - cy, jx - cx);
        let turn = dir == null ? 0 : Math.abs(a - dir);
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        const score = turn + (jx !== cx && jy !== cy ? 0.05 : 0);
        if (score < bestScore) { bestScore = score; best = j; }
      }
      const [bx, by] = xy(best);
      const k = Math.max(0, pts.length - 3);
      const [px, py] = pts[k];
      dir = Math.atan2(by - py, bx - px);
      pts.push([bx, by]);
      seen[best] = 1;
      cur = best;
    }
    return { pts, connected };
  };
  const idx = ([x, y]) => y * w + x;

  const ends = pixels.filter((i) => deg.get(i) === 1).sort((a, b) => (a % w) - (b % w) || a - b);
  const strokes = [];
  for (const e of ends) if (!seen[e]) strokes.push(walk(e));
  // pętle i pozostałości: od najbardziej lewego piksela
  const rest = pixels.filter((i) => !seen[i]).sort((a, b) => (a % w) - (b % w) || a - b);
  for (const r of rest) if (!seen[r]) strokes.push(walk(r));
  return strokes;
}
