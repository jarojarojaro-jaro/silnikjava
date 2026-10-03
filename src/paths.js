// Ścieżki to zwykłe tablice punktów [[x,y], ...]. Każdy kształt "ręcznie rysowany"
// powstaje tak samo: kilka punktów kontrolnych z drobnym, deterministycznym
// rozrzutem -> wygładzenie krzywą Catmulla-Roma -> równomierne próbkowanie.

import { lerp, rng } from './math.js';

/** Wygładza łamaną krzywą Catmulla-Roma (przechodzi przez wszystkie punkty). */
export function catmull(pts, seg = 12, closed = false) {
  if (pts.length < 3) return pts.map((p) => [p[0], p[1]]);
  const n = pts.length;
  const get = (i) => {
    if (closed) return pts[((i % n) + n) % n];
    return pts[Math.max(0, Math.min(n - 1, i))];
  };
  const out = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const f = (k) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  const end = closed ? pts[0] : pts[n - 1];
  out.push([end[0], end[1]]);
  return out;
}

export function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Próbkuje ścieżkę co `step` pikseli — dzięki temu postęp rysowania jest równy w czasie. */
export function resample(pts, step = 4) {
  if (pts.length < 2) return pts.slice();
  const out = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    let s = step - carry;
    while (s <= d) {
      out.push([lerp(ax, bx, s / d), lerp(ay, by, s / d)]);
      s += step;
    }
    carry = d - (s - step);
  }
  const a = pts[pts.length - 1], b = out[out.length - 1];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) > step * 0.15) out.push([a[0], a[1]]);
  return out;
}

/** Punkt i kierunek na ścieżce dla u ∈ [0,1] (po długości łuku). */
export function pointAt(pts, u) {
  if (pts.length === 1) return { x: pts[0][0], y: pts[0][1], angle: 0 };
  const total = pathLength(pts);
  let target = Math.max(0, Math.min(1, u)) * total;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    if (target <= d || i === pts.length - 1) {
      const k = d ? Math.min(1, target / d) : 0;
      return { x: lerp(ax, bx, k), y: lerp(ay, by, k), angle: Math.atan2(by - ay, bx - ax) };
    }
    target -= d;
  }
  const p = pts[pts.length - 1];
  return { x: p[0], y: p[1], angle: 0 };
}

/** Wycinek ścieżki między u0 a u1 (po długości). */
export function slice(pts, u0, u1) {
  const r = resample(pts, Math.max(0.5, pathLength(pts) / 400));
  const a = Math.floor(u0 * (r.length - 1));
  const b = Math.ceil(u1 * (r.length - 1));
  return r.slice(a, b + 1);
}

// ---------------------------------------------------------------- kształty

/** Odręczna linia: lekko wygięta w losową stronę. */
export function line(x1, y1, x2, y2, { bow = 0.02, seed = 1 } = {}) {
  const r = rng(seed);
  const k = (r() - 0.5) * 2 * bow;
  const mx = lerp(x1, x2, 0.5) - (y2 - y1) * k;
  const my = lerp(y1, y2, 0.5) + (x2 - x1) * k;
  return catmull([[x1, y1], [mx, my], [x2, y2]], 16);
}

/**
 * Łamana o ostrych rogach (trójkąt, kwadrat, wielokąt "z linijki"): każdy bok to
 * odręczna linia, rogi zostają rogami. closed — wraca do pierwszego punktu;
 * overshoot — ostatni bok lekko "przejeżdża" za róg, jak przy szybkim szkicu.
 */
export function polyline(pts, { closed = true, seed = 1, bow = 0.012, overshoot = 0 } = {}) {
  const P = closed ? [...pts, pts[0]] : pts;
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    let [x2, y2] = P[i + 1];
    if (overshoot && i === P.length - 2) {
      x2 += (x2 - P[i][0]) * overshoot;
      y2 += (y2 - P[i][1]) * overshoot;
    }
    const seg = line(P[i][0], P[i][1], x2, y2, { bow, seed: seed + i * 7.3 });
    out.push(...(i ? seg.slice(1) : seg));
  }
  return out;
}

/** Krzywa przez podane punkty. */
export const curve = (pts, seg = 12) => catmull(pts, seg);

/** Odręczny prostokąt — rogi i środki boków lekko "uciekają". */
export function rect(x, y, w, h, { seed = 1, wobble = 1, overshoot = 0.06 } = {}) {
  const r = rng(seed);
  const j = () => (r() - 0.5) * Math.min(7, 0.05 * w, 0.05 * h) * wobble;
  const o = overshoot * Math.min(w, h, 80);
  return catmull(
    [
      [x + j(), y + j()], [x + w * 0.5, y + j() * 0.6], [x + w + j(), y + j()],
      [x + w + j() * 0.6, y + h * 0.5], [x + w + j(), y + h + j()], [x + w * 0.5, y + h + j() * 0.6],
      [x + j(), y + h + j()], [x + j() * 0.6, y + h * 0.5], [x + j(), y + j()], [x + o, y + j() * 0.5],
    ],
    8,
  );
}

/** Odręczna elipsa: zaczyna się w losowym miejscu i lekko "zachodzi" na początek. */
export function ellipse(cx, cy, rx, ry, { seed = 1, overshoot = 0.1, start, steps = 56 } = {}) {
  const r = rng(seed);
  const a0 = start ?? -2.2 + (r() - 0.5);
  const amp = 0.02 + 0.05 * r();
  const ph = r() * 6;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * Math.PI * 2 * (1 + overshoot);
    const k = 1 + amp * Math.sin(2 * a + ph) + (i / steps) * 0.035;
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

export const circle = (cx, cy, rad, opts) => ellipse(cx, cy, rad, rad, opts);

export function arc(cx, cy, rad, a0, a1, steps = 40) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return out;
}

/** Zamknięty wielokąt z wygładzonymi rogami i drobnym rozrzutem. */
export function polygon(pts, { seed = 1, wobble = 2, seg = 6 } = {}) {
  const r = rng(seed);
  const j = pts.map(([x, y]) => [x + (r() - 0.5) * wobble, y + (r() - 0.5) * wobble]);
  return catmull([...j, j[0]], seg);
}

export function star(cx, cy, r1, r2 = r1 * 0.45, n = 5, { rotation = -Math.PI / 2, seed = 1 } = {}) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rotation + (i * Math.PI) / n;
    const rr = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return polygon(pts, { seed, wobble: r1 * 0.06, seg: 3 });
}

/** Grot strzałki w punkcie (x,y) skierowany pod kątem `angle`. */
export function arrowHead(x, y, angle, size = 18, spread = 2.55) {
  return [
    [x + Math.cos(angle + spread) * size, y + Math.sin(angle + spread) * size],
    [x, y],
    [x + Math.cos(angle - spread) * size, y + Math.sin(angle - spread) * size],
  ];
}

export function wave(x1, y, x2, amp = 6, freq = 0.05, step = 4) {
  const out = [];
  for (let x = x1; x <= x2; x += step) out.push([x, y + Math.sin((x - x1) * freq) * amp]);
  return out;
}

export function spiral(cx, cy, r0, r1, turns = 3, steps = 120) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const rr = lerp(r0, r1, t);
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
}

// ---------------------------------------------------------------- transformacje

export const translate = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
export const scale = (pts, sx, sy = sx, ox = 0, oy = 0) => pts.map(([x, y]) => [ox + (x - ox) * sx, oy + (y - oy) * sy]);
export function rotate(pts, a, ox = 0, oy = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]);
}
export const reverse = (pts) => pts.slice().reverse();

export function bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// ---------------------------------------------------------------- SVG

/**
 * Parsuje atrybut `d` ze ścieżki SVG do listy podścieżek (tablic punktów).
 * Pozwala importować gotowe rysunki (np. z Figmy/Inkscape) i animować je ołówkiem.
 * Obsługuje M L H V C S Q T A Z (wielkie i małe litery).
 */
export function svgPath(d, { step = 3 } = {}) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const subpaths = [];
  let cur = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  let lastC = null, lastQ = null; // odbicia punktów kontrolnych dla S/T
  let cmd = '';
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  const push = (px, py) => cur.push([px, py]);
  const bez = (pts, n) => {
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      if (pts.length === 4) {
        push(
          u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0],
          u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1],
        );
      } else {
        push(
          u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0],
          u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1],
        );
      }
    }
  };
  const segs = (...pts) => {
    let L = 0;
    for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    return Math.max(2, Math.ceil(L / step));
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') {
      if (cur && cur.length) push(sx, sy);
      x = sx; y = sy;
      lastC = lastQ = null;
      continue;
    }
    if (C === 'M') {
      x = ox + num(); y = oy + num();
      sx = x; sy = y;
      cur = [[x, y]];
      subpaths.push(cur);
      cmd = rel ? 'l' : 'L'; // kolejne pary liczb po M to linie
      lastC = lastQ = null;
      continue;
    }
    if (!cur) { cur = [[x, y]]; subpaths.push(cur); }
    if (C === 'L') { x = ox + num(); y = oy + num(); push(x, y); lastC = lastQ = null; }
    else if (C === 'H') { x = ox + num(); push(x, y); lastC = lastQ = null; }
    else if (C === 'V') { y = (rel ? y : 0) + num(); push(x, y); lastC = lastQ = null; }
    else if (C === 'C' || C === 'S') {
      let c1;
      if (C === 'C') c1 = [ox + num(), oy + num()];
      else c1 = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
      const c2 = [ox + num(), oy + num()];
      const e = [ox + num(), oy + num()];
      bez([[x, y], c1, c2, e], segs([x, y], c1, c2, e));
      lastC = c2; lastQ = null;
      x = e[0]; y = e[1];
    } else if (C === 'Q' || C === 'T') {
      let c;
      if (C === 'Q') c = [ox + num(), oy + num()];
      else c = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
      const e = [ox + num(), oy + num()];
      bez([[x, y], c, e], segs([x, y], c, e));
      lastQ = c; lastC = null;
      x = e[0]; y = e[1];
    } else if (C === 'A') {
      const rx0 = num(), ry0 = num(), phi = (num() * Math.PI) / 180, large = num(), sweep = num();
      const ex = ox + num(), ey = oy + num();
      arcTo(x, y, rx0, ry0, phi, large, sweep, ex, ey, step, push);
      x = ex; y = ey;
      lastC = lastQ = null;
    } else {
      i++; // nieznany token — pomijamy
    }
  }
  return subpaths.filter((p) => p.length > 1);
}

// Łuk eliptyczny SVG (parametryzacja punktami końcowymi -> środkowa), wg specyfikacji SVG F.6.
function arcTo(x1, y1, rx, ry, phi, large, sweep, x2, y2, step, push) {
  if (!rx || !ry) { push(x2, y2); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  const c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = c * dx + s * dy, y1p = -s * dx + c * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let k = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) k = -k;
  const cxp = (k * rx * y1p) / ry, cyp = (-k * ry * x1p) / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= Math.PI * 2;
  if (sweep && dt < 0) dt += Math.PI * 2;
  const n = Math.max(4, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / step));
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n;
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    push(c * ex - s * ey + cx, s * ex + c * ey + cy);
  }
}

// ---------------------------------------------------------------- analiza (z cache)

const infoCache = new WeakMap();

/**
 * Analiza ścieżki liczona raz i zapamiętywana (WeakMap po tablicy punktów):
 * równomiernie spróbkowane punkty `r`, długość `len`, krzywizna w punktach
 * `curv` oraz `warp` — skumulowany, znormalizowany czas przejścia ręki
 * (ręka zwalnia na zakrętach: v ≈ 1 / (1 + 6·κ^0.66), wzorowane na prawie 2/3 potęgi).
 * `effLen` — długość "efektywna" (ile px przy pełnej prędkości zajmuje przejście).
 */
export function pathInfo(pts, step = 2.5) {
  let byStep = infoCache.get(pts);
  if (byStep?.has(step)) return byStep.get(step);
  const r = resample(pts, step);
  const n = r.length;
  const curv = new Float32Array(n);
  for (let i = 1; i < n - 1; i++) {
    const a = Math.atan2(r[i][1] - r[i - 1][1], r[i][0] - r[i - 1][0]);
    const b = Math.atan2(r[i + 1][1] - r[i][1], r[i + 1][0] - r[i][0]);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    curv[i] = d / step;
  }
  // wygładzenie krzywizny (okno ±3 punkty)
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) { s += curv[k]; c++; }
    sm[i] = s / c;
  }
  const warp = new Float32Array(n);
  let acc = 0;
  for (let i = 1; i < n; i++) {
    const v = 1 / (1 + 6 * Math.pow(sm[i], 0.66));
    acc += step / v;
    warp[i] = acc;
  }
  if (acc > 0) for (let i = 1; i < n; i++) warp[i] /= acc;
  const info = { r, n, step, len: (n - 1) * step, effLen: acc, curv: sm, warp };
  if (!byStep) {
    byStep = new Map();
    infoCache.set(pts, byStep);
  }
  byStep.set(step, info);
  return info;
}
