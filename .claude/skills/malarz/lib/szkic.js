// szkic.js — szkicownik do motywów „z wyobraźni”: wzór obrazu opisany funkcją koloru punktu.
// Motyw podaje kolor(u, v) dla u, v w 0..1 (u w prawo, v w dół), szkicownik próbkuje go
// z wygładzaniem krawędzi i oddaje malarzowi jako wzór. Do tego klocki: szum, gradienty, kształty.

import { hasz } from './pedzel.js';

export const gladko = (a, b, x) => { x = (x - a) / (b - a); return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const ogr = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
/** Mieszanie dwóch kolorów [r,g,b]. */
export const miesz = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Kolor z kilku przystanków: [[pozycja, [r,g,b]], …] rosnąco. */
export function pasmo(przystanki, x) {
  if (x <= przystanki[0][0]) return przystanki[0][1];
  for (let i = 1; i < przystanki.length; i++) {
    if (x <= przystanki[i][0]) return miesz(przystanki[i - 1][1], przystanki[i][1], gladko(przystanki[i - 1][0], przystanki[i][0], x));
  }
  return przystanki[przystanki.length - 1][1];
}

/** Hasz 2D → [0,1). */
export const h2 = (x, y, z = 0) => hasz((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) | 0);
/** Szum wartości 2D (gładki), 0..1. */
export function szum(x, y, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, z), b = h2(xi + 1, yi, z), c = h2(xi, yi + 1, z), d = h2(xi + 1, yi + 1, z);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** Szum fraktalny (suma oktaw), 0..1. */
export function fbm(x, y, okt = 5, z = 0) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < okt; i++) { s += a * szum(x, y, z + i * 17); n += a; x = x * 2.03 + 11.7; y = y * 2.03 + 5.3; a *= 0.5; }
  return s / n;
}
/** Szum fraktalny 1D (grzbiety gór, linie brzegu), 0..1. */
export function fbm1(x, okt = 4, z = 0) { return fbm(x, 0.37, okt, z); }

/**
 * Próbkuje funkcję koloru do wzoru W × H (Float32Array RGB 0..255), nad × nad próbek na piksel.
 * @param {(u:number, v:number) => number[]} kolor zwraca [r,g,b] w 0..1
 */
export function namaluj(W, H, kolor, nad = 3) {
  const T = new Float32Array(W * H * 3), k = 255 / (nad * nad);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < nad; j++) for (let i = 0; i < nad; i++) {
      const c = kolor((x + (i + 0.5) / nad) / W, (y + (j + 0.5) / nad) / H);
      r += ogr(c[0]); g += ogr(c[1]); b += ogr(c[2]);
    }
    const q = (y * W + x) * 3; T[q] = r * k; T[q + 1] = g * k; T[q + 2] = b * k;
  }
  return T;
}
