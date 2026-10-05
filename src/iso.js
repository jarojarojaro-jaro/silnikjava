// Rzut izometryczny i zaokrąglone bryły do szkiców przedmiotów (laptop, router,
// szafa z serwerami…). Geometria przeniesiona z Hairline (MIT, Lucas Marques,
// github.com/lucasmarkes/hairline): kamera 2:1, pierścienie zaokrąglonych
// prostokątów, bryła = sylwetka (otoczka górnego i dolnego pierścienia) + jedna
// wewnętrzna krawędź. Wynik to zwykłe tablice punktów dla sb.pen / sb.strokes.
//
// Zasady rysowania brył (docs/STYLE.md, „Izometria”):
//   * mniej kresek: bryła to sylwetka i jedna krawędź górnej ścianki, bez pionowych
//     narożników i bez 12 krawędzi pudełka; rogi zawsze zaokrąglone;
//   * sylwetka mocno (`ink`), wnętrze cienko i blado (`inkSoft`);
//   * zasłonięte linie się nie rysują: najpierw bliższa bryła, potem dalsza
//     przycięta do tego, co widać (`visible`);
//   * jeden akcent: wyróżniona sylwetka w kolorze `pen` mówi, gdzie patrzeć.
//
// Świat: x/y na ziemi, z w górę. Kamera domyślna (az 45°, k 0,5): +x biegnie
// w prawo w dół, +y w lewo w dół, więc bliżej widza jest róg z największym x + y.

const rad = (d) => (d * Math.PI) / 180;

/**
 * Kamera izometryczna.
 * @param {object} o az (azymut w stopniach, 45), k (sin elewacji, 0.5 = widok 2:1), S (skala px na jednostkę świata)
 * @returns {{P: (x:number, y:number, z:number) => number[], fit: Function, az:number, k:number, S:number}}
 */
export function isoCamera({ az = 45, k = 0.5, S = 3, ox = 0, oy = 0 } = {}) {
  const C = { az: rad(az), k, S, ox, oy };
  const c = Math.cos(C.az), s = Math.sin(C.az), zf = Math.sqrt(1 - k * k);
  C.P = (x, y, z = 0) => {
    const X = x * c - y * s, Y = x * s + y * c;
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * zf)];
  };
  /** Ustawia środek ramki punktów [x, y, z] w (cx, cy) na ekranie. Nie skaluje. */
  C.fit = (pts, cx, cy) => {
    C.ox = 0;
    C.oy = 0;
    let a = Infinity, b = -Infinity, d = Infinity, e = -Infinity;
    for (const [x, y, z] of pts) {
      const [px, py] = C.P(x, y, z);
      a = Math.min(a, px); b = Math.max(b, px); d = Math.min(d, py); e = Math.max(e, py);
    }
    C.ox = cx - (a + b) / 2;
    C.oy = cy - (d + e) / 2;
    return C;
  };
  /** Czy próbka pierścienia (z normalną nu, nv) patrzy w stronę kamery. */
  C.front = (q) => q.nu * s + q.nv * c >= -1e-6;
  return C;
}

/** Zaokrąglony prostokąt na ziemi jako pierścień próbek {u, v, nu, nv}. */
export function rrect(u0, v0, u1, v1, r, n = 4) {
  r = Math.max(0, Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2));
  const out = [];
  for (const [cu, cv, a0] of [[u1 - r, v1 - r, 0], [u0 + r, v1 - r, 90], [u0 + r, v0 + r, 180], [u1 - r, v0 + r, 270]]) {
    for (let i = 0; i <= n; i++) {
      const a = rad(a0 + (90 * i) / n), ca = Math.cos(a), sa = Math.sin(a);
      out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa });
    }
  }
  return out;
}

/** Okrąg o promieniu R wokół (cx, cy) jako pierścień. */
export function circ(R, n = 48, cx = 0, cy = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    out.push({ u: cx + R * ca, v: cy + R * sa, nu: ca, nv: sa });
  }
  return out;
}

/** Otoczka wypukła punktów ekranu (monotone chain). */
export function hull(input) {
  const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) {
    while (lo.length > 1 && x(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length > 1 && x(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

/** Pierścień zrzutowany na wysokości z. */
export const ringAt = (cam, ring, z) => ring.map((q) => cam.P(q.u, q.v, z));

/** Jeden ciągły (cyklicznie) odcinek próbek pierścienia, które spełniają keep. */
export function run(ring, keep) {
  const n = ring.length;
  let s = -1;
  for (let i = 0; i < n; i++) if (keep(ring[i]) && !keep(ring[(i + n - 1) % n])) { s = i; break; }
  if (s < 0) return keep(ring[0]) ? ring.slice() : [];
  const out = [];
  for (let i = 0; i < n && keep(ring[(s + i) % n]); i++) out.push(ring[(s + i) % n]);
  return out;
}

/** Zaokrągla każdy wierzchołek zamkniętego wielokąta (radii: promień na wierzchołek). */
export function fillet(pts, radii, n = 4) {
  const m = pts.length, out = [];
  const rs = typeof radii === 'number' ? pts.map(() => radii) : radii;
  for (let i = 0; i < m; i++) {
    const a = pts[(i + m - 1) % m], p = pts[i], b = pts[(i + 1) % m];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const t = Math.min(rs[i], la / 2, lb / 2);
    const p1 = [p[0] + ((a[0] - p[0]) / la) * t, p[1] + ((a[1] - p[1]) / la) * t];
    const p2 = [p[0] + ((b[0] - p[0]) / lb) * t, p[1] + ((b[1] - p[1]) / lb) * t];
    for (let k = 0; k <= n; k++) {
      const s = k / n, w = 1 - s;
      out.push([w * w * p1[0] + 2 * w * s * p[0] + s * s * p2[0], w * w * p1[1] + 2 * w * s * p[1] + s * s * p2[1]]);
    }
  }
  return out;
}

const close = (pts) => (pts.length ? [...pts, pts[0]] : pts);

/**
 * Bryła o zaokrąglonych rogach stojąca od z0 do z1 (prostopadłościan, płyta, wieża).
 * @param {object} cam isoCamera
 * @param {object} o x0, y0, x1, y1 (podstawa na ziemi), z0, z1, r (promień rogu), b (wcięcie krawędzi, 0.6–2.2),
 *                   top: [x0, y0, x1, y1] węższa góra (stożek, dach) — domyślnie jak podstawa
 * @returns {{sil:number[][], crease:number[][], top:number[][], P:Function}}
 *   sil — zamknięta sylwetka (mocna kreska), crease — krawędź górnej ścianki (blada),
 *   top — obrys górnej ścianki (do detali na wierzchu)
 */
export function solid(cam, { x0, y0, x1, y1, z0 = 0, z1, r = 3, b = 1.4, top }) {
  const foot = rrect(x0, y0, x1, y1, r);
  const [tx0, ty0, tx1, ty1] = top ?? [x0, y0, x1, y1];
  const topRing = rrect(tx0, ty0, tx1, ty1, r);
  const inner = rrect(tx0 + b, ty0 + b, tx1 - b, ty1 - b, Math.max(0.3, r - b));
  const sil = close(hull(ringAt(cam, topRing, z1).concat(ringAt(cam, foot, z0))));
  const crease = ringAt(cam, run(inner, cam.front), z1);
  return { sil, crease, top: close(ringAt(cam, topRing, z1)) };
}

/** Walec (antena, puszka, kubek): sylwetka + krawędź wieczka. */
export function cylinder(cam, { x, y, R, z0 = 0, z1, b = 0.8 }) {
  const ring = circ(R, 32, x, y);
  const inner = circ(Math.max(0.2, R - b), 32, x, y);
  const sil = close(hull(ringAt(cam, ring, z1).concat(ringAt(cam, ring, z0))));
  const crease = ringAt(cam, run(inner, cam.front), z1);
  return { sil, crease, top: close(ringAt(cam, ring, z1)) };
}

/** Odcinek w świecie (np. szczelina na ściance, kreska na ziemi) jako dwa punkty ekranu. */
export const seg3 = (cam, a, b) => [cam.P(...a), cam.P(...b)];

/** Krzywa na ziemi (z = 0 albo podane) przez punkty świata [x, y] → punkty ekranu. */
export const ground = (cam, pts, z = 0) => pts.map(([x, y]) => cam.P(x, y, z));

function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * Widoczne kawałki linii: części ścieżki poza sylwetkami brył, które ją zasłaniają.
 * Rysownik nie rysuje tego, czego nie widać — ręka podnosi się nad zasłoniętym
 * fragmentem (sb.strokes z wynikiem).
 * @param {number[][]} path ścieżka na ekranie
 * @param {number[][][]} occluders sylwetki bliższych brył
 * @param {number} step co ile px sprawdzać (2)
 * @returns {number[][][]} lista widocznych odcinków (każdy ≥ 2 punkty)
 */
export function visible(path, occluders, step = 2) {
  if (!occluders?.length) return [path];
  const pts = [];
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) pts.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  const out = [];
  let cur = [];
  for (const p of pts) {
    if (occluders.some((o) => inside(p, o))) {
      if (cur.length > 2) out.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length > 2) out.push(cur);
  return out;
}
