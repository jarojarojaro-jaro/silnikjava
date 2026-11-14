// lato.js — motyw z wyobraźni, 16:9: „Ostatni wieczór lata”. Wzgórze w trawie, ścieżka do małego domu
// z zapalonymi oknami, słupy z drutami schodzące ku morzu i ogromna burzowa chmura w ostatnim słońcu.
// Barwy jak w animacji z lat 90.: morski błękit i indygo w cieniach, róż i brzoskwinia w światłach.
// Chodzi o uczucie — ciepło, radość i tęsknotę za dniem, który właśnie się kończy.
//
//   node maluj.mjs motywy/lato.js --styl kredki      (albo pastele, olej)

import { namaluj, gladko, ogr, miesz, pasmo, fbm, fbm1, h2 } from '../lib/szkic.js';

export const TYTUL = 'Ostatni wieczór lata';
export const AUTOR = 'z wyobraźni';
export const PROPORCJA = 16 / 9;
export const GRUNT = [206, 176, 150];
export const SKUPIENIA = [{ x: 0.70, y: 0.56, rx: 0.08, ry: 0.10, ile: 3 }, { x: 0.66, y: 0.30, rx: 0.2, ry: 0.22, ile: 1 }];

const A = PROPORCJA, HOR = 0.615, SLONCE = [0.27, 0.635];
const grzbiet = (u) => 0.745 - 0.165 * gladko(0.22, 0.86, u) + 0.012 * fbm1(u * 5, 4, 3);     // linia wzgórza
const DOM = { u: 0.705, w: 0.046, h: 0.062 };
const SLUPY = [0.615, 0.52, 0.435, 0.36, 0.295, 0.24].map((u, i) => ({ u, y: grzbiet(u), h: 0.105 * Math.pow(0.8, i) }));
// kłęby chmury: wieża rosnąca w górę, z kowadłem; [x, y, r] w układzie, gdzie x = u · proporcja
const KLEBY = [];
for (let i = 0; i < 64; i++) {
  const t = h2(i, 1, 41), wys = Math.pow(t, 0.75), szer = 0.36 * (1 - 0.66 * wys) + (wys > 0.82 ? 0.20 : 0);
  KLEBY.push([1.22 + 0.05 * Math.sin(wys * 4) + (h2(i, 2, 41) - 0.5) * 2 * szer, 0.58 - 0.49 * wys, 0.045 + 0.075 * h2(i, 3, 41) * (1 - 0.35 * wys)]);
}

function niebo(u, v) {
  let c = pasmo([[0, [0.07, 0.10, 0.30]], [0.2, [0.10, 0.25, 0.50]], [0.4, [0.16, 0.50, 0.66]], [0.52, [0.62, 0.66, 0.70]], [0.585, [1.0, 0.70, 0.55]], [0.63, [1.0, 0.56, 0.50]]], v);
  const ds = Math.hypot((u - SLONCE[0]) * A, v - SLONCE[1]);
  c = miesz(c, [1.0, 0.80, 0.50], 0.75 * Math.exp(-ds * 4.2));
  c = miesz(c, [1.0, 0.97, 0.80], gladko(0.05, 0.028, ds));
  // gwiazdy i sierp księżyca w ciemnej części nieba
  const gx = Math.floor(u * 120), gy = Math.floor(v * 68);
  if (v < 0.34 && h2(gx, gy, 51) > 0.972) { const d = Math.hypot(u * 120 - gx - 0.5, v * 68 - gy - 0.5); c = miesz(c, [1, 0.98, 0.9], gladko(0.32, 0.05, d) * (0.5 + 0.5 * h2(gx, gy, 53)) * gladko(0.34, 0.1, v)); }
  const mx = u * A - 0.16, my = v - 0.12, m1 = Math.hypot(mx, my), m2 = Math.hypot(mx - 0.016, my + 0.008);
  if (m1 < 0.034 && m2 > 0.031) c = [1.0, 0.96, 0.84];
  // płaskie pasma chmur nad horyzontem, różowe od spodu
  const pas = gladko(0.52, 0.70, fbm(u * 3.2, v * 26, 4, 61)) * gladko(0.40, 0.50, v) * gladko(0.62, 0.56, v);
  return miesz(c, miesz([0.60, 0.42, 0.62], [1.0, 0.62, 0.56], gladko(0.48, 0.60, v)), pas * 0.85);
}
// chmura burzowa: każdy kłąb to kula oświetlona nisko z lewej; kłęby zlewają się wagami (bliższy
// brzegowi bryły waży więcej), więc cieniowanie jest miękkie, a kształt „kalafiorowy”.
// Trzy tony jak w animacji rysunkowej — światło, półcień, cień — plus kremowe szczyty.
function chmura(u, v, c) {
  if (v > 0.61 || u < 0.38) return c;
  const x = u * A + 0.02 * (fbm(u * 7, v * 7, 3, 71) - 0.5) * 2, y = v + 0.02 * (fbm(u * 7 + 9, v * 7, 3, 75) - 0.5) * 2;
  let sw = 0, w = 0;
  for (const k of KLEBY) {
    const dx = (x - k[0]) / k[2], dy = (y - k[1]) / k[2], ro = dx * dx + dy * dy; if (ro > 6) continue;
    const wi = Math.exp(7 * (1 - Math.sqrt(ro)));
    sw += wi * (-dx * 0.70 - dy * 0.28 + Math.sqrt(Math.max(0, 1 - ro)) * 0.62); w += wi;
  }
  const d = Math.log(w + 1e-9) / 7 + 0.05 * (fbm(u * 26, v * 26, 3, 77) - 0.5);
  if (d <= 0) return c;
  const l = sw / w + 0.22 * (fbm(u * 6, v * 6, 3, 73) - 0.5) + 0.5 * (0.36 - y);
  let k = miesz([0.27, 0.32, 0.62], [0.50, 0.47, 0.76], gladko(-0.2, 0.2, l));
  k = miesz(k, [0.96, 0.62, 0.70], gladko(0.24, 0.36, l));
  k = miesz(k, [1.0, 0.83, 0.72], gladko(0.46, 0.58, l));
  k = miesz(k, [1.0, 0.96, 0.87], gladko(0.72, 0.86, l));
  k = miesz(k, [0.88, 0.52, 0.58], 0.65 * gladko(0.47, 0.60, y));                                 // podstawa tonie w zorzy
  return miesz(c, k, gladko(0, 0.035, d));
}
function ziemia(u, v, c) {
  const yh = grzbiet(u);
  // morze za wzgórzem i dalekie wyspy
  if (v > HOR && v < yh + 0.01) {
    const gl = (v - HOR) / 0.13, zm = fbm(u * 8, v * 190, 3, 81);
    c = miesz([0.16, 0.42, 0.60], [0.06, 0.16, 0.36], gladko(0, 1, gl));
    const sc = Math.abs(u - SLONCE[0]) * A / (0.03 + 0.28 * gl);
    c = miesz(c, [1.0, 0.80, 0.56], 0.9 * gladko(1, 0.15, sc) * gladko(0.38, 0.62, zm + 0.3 * (1 - sc)));
    c = miesz(c, [0.95, 0.70, 0.62], 0.35 * gladko(0.6, 0.85, zm) * gladko(0.5, 0, gl));
  }
  const wy = HOR - 0.035 * gladko(0.10, 0.0, Math.abs(u - 0.08)) - 0.022 * gladko(0.07, 0, Math.abs(u - 0.47)) * (0.6 + 0.4 * fbm1(u * 30, 3, 83));
  if (v > wy && v <= HOR + 0.004) c = miesz([0.20, 0.22, 0.46], [0.42, 0.30, 0.52], gladko(0.03, 0, HOR - v));
  if (v <= yh) return c;
  // trawa: złota przy grzbiecie, zielona niżej, morska w cieniu na dole; pasma wiatru
  const gl = (v - yh) / (1 - yh), wiatr = fbm(u * 3.2 + gl * 1.5, gl * 13 - u * 2, 4, 91), zdz = fbm(u * 150, v * 26, 2, 93);
  let k = pasmo([[0, [0.98, 0.74, 0.38]], [0.14, [0.62, 0.66, 0.30]], [0.45, [0.16, 0.46, 0.40]], [1, [0.03, 0.15, 0.24]]], gl + 0.10 * (wiatr - 0.5));
  k = miesz(k, [1.0, 0.86, 0.50], 0.55 * gladko(0.55, 0.78, wiatr) * gladko(0.75, 0.05, gl));
  k = miesz(k, [0.04, 0.20, 0.30], 0.45 * gladko(0.50, 0.30, wiatr) * gladko(0.0, 0.3, gl));
  k = miesz(k, k.map((x) => x * 0.8), 0.25 * gladko(0.45, 0.7, zdz));
  k = miesz(k, [1.0, 0.80, 0.52], 0.6 * gladko(0.012, 0, v - yh));                               // światło na krawędzi wzgórza
  // ścieżka od dołu kadru do domu
  const su = DOM.u - 0.30 * Math.pow(gl, 1.25) + 0.05 * Math.sin(gl * 5.5), sz = 0.004 + 0.042 * gl, ds = Math.abs(u - su) / sz;
  if (ds < 1) k = miesz(miesz([0.98, 0.80, 0.60], [0.50, 0.42, 0.52], gladko(0.0, 0.9, gl)), k, gladko(0.6, 1, ds) * 0.9 + 0.1 * zdz);
  // wysokie źdźbła na samym dole
  const zx = u * 210, zi = Math.floor(zx), zh = 0.05 + 0.13 * h2(zi, 1, 95), zs = (1 - v) / zh;
  if (zs < 1 && Math.abs(zx - zi - 0.5 - (h2(zi, 2, 95) - 0.5) * zs * 1.6) < 0.34 * (1 - zs * 0.7)) k = h2(zi, 3, 95) < 0.22 ? [0.86, 0.72, 0.36] : [0.02, 0.10, 0.17];
  return k;
}
function rzeczy(u, v, c) {
  // słupy i druty: coraz mniejsze ku morzu
  for (let i = 0; i < SLUPY.length; i++) {
    const s = SLUPY[i], gr = 0.0028 * s.h / 0.105;
    if (Math.abs(u - s.u) < gr && v < s.y + 0.004 && v > s.y - s.h) c = miesz([0.10, 0.10, 0.22], [0.80, 0.50, 0.44], gladko(0.2, -1, (u - s.u) / gr));
    if (Math.abs(v - (s.y - s.h * 0.90)) < gr * 1.3 && Math.abs(u - s.u) < s.h * 0.16) c = [0.10, 0.10, 0.22];
    if (i + 1 < SLUPY.length) {
      const n = SLUPY[i + 1], t = (u - s.u) / (n.u - s.u);
      if (t > 0 && t < 1) for (const bok of [-1, 1]) {
        const y = (s.y - s.h * 0.90) * (1 - t) + (n.y - n.h * 0.90) * t + 0.035 * s.h * 4 * t * (1 - t) * 2 + bok * 0.0045 * (s.h * (1 - t) + n.h * t) / 0.105;
        if (Math.abs(v - y) < 0.0011) c = miesz(c, [0.10, 0.10, 0.24], 0.85);
      }
    }
  }
  // dom: jasna ściana w zorzy, ciemna od strony widza, czerwony dach, dwa ciepłe okna, komin z dymem
  const yd = grzbiet(DOM.u) + 0.004, hx = (u - DOM.u) / DOM.w, hy = (yd - v) / DOM.h;
  if (Math.abs(hx) < 0.5 && hy > 0 && hy < 1) c = hx < -0.18 ? [0.96, 0.66, 0.56] : miesz([0.30, 0.26, 0.46], [0.20, 0.18, 0.36], hx + 0.2);
  if (hy >= 0.86 && hy < 1.62 && Math.abs(hx) < 0.62 * (1 - (hy - 0.86) / 0.76)) c = hx < -0.1 * (1.62 - hy) ? [0.90, 0.36, 0.30] : [0.50, 0.17, 0.24];
  for (const wx of [0.02, 0.27]) if (Math.abs(hx - wx) < 0.085 && Math.abs(hy - 0.52) < 0.17) c = miesz([1.0, 0.84, 0.36], [1.0, 0.62, 0.24], Math.abs(hy - 0.52) * 4);
  if (Math.abs(hx + 0.33) < 0.06 && hy > 0 && hy < 0.5) c = [0.36, 0.20, 0.24];
  if (Math.abs(hx - 0.3) < 0.05 && hy > 1.1 && hy < 1.5) c = [0.34, 0.20, 0.30];
  const dt = (hy - 1.5) / 2.6, dymu = DOM.u + DOM.w * (0.3 + 0.9 * dt * dt + 0.12 * Math.sin(dt * 9));
  if (dt > 0 && dt < 1) c = miesz(c, [0.96, 0.78, 0.76], 0.55 * (1 - dt) * gladko(0.004 + 0.014 * dt, 0, Math.abs(u - dymu)));
  c = miesz(c, [1.0, 0.70, 0.30], 0.28 * Math.exp(-Math.hypot((u - DOM.u - 0.006) * A / 0.05, (v - yd + 0.03) / 0.05) * 1.8) * (v < yd ? 1 : 0.6));
  // drzewo przy domu: okrągła korona w dwóch tonach z jasnym brzegiem od słońca
  const tx = (u - 0.772) * A, ty = v - (grzbiet(0.772) - 0.085), r = 0.062 + 0.012 * (fbm(u * 60, v * 60, 3, 101) - 0.5) * 2, d = Math.hypot(tx, ty * 0.9);
  if (Math.abs(u - 0.772) < 0.0035 && v < grzbiet(0.772) + 0.004 && v > grzbiet(0.772) - 0.06) c = [0.10, 0.09, 0.20];
  if (d < r) { const sw = (-tx * 0.8 - ty * 0.5) / r; c = miesz(miesz([0.05, 0.16, 0.26], [0.12, 0.36, 0.36], gladko(-0.3, 0.3, sw + 0.4 * (fbm(u * 45, v * 45, 3, 103) - 0.5))), [0.98, 0.72, 0.42], gladko(0.5, 0.8, sw) * gladko(0.6, 0.95, d / r)); }
  // papierowy samolot z kreskowanym śladem lotu
  const px = (u - 0.335) * A, py = v - 0.235, ob = px * 0.94 + py * 0.34, pp = -px * 0.34 + py * 0.94;
  if (ob > -0.034 && ob < 0.034) { const k = (0.034 - ob) / 0.068; if (pp > -0.020 * k && pp < 0.004 * k) c = pp < -0.004 * k ? [1.0, 0.95, 0.88] : [0.80, 0.70, 0.84]; }
  for (let i = 1; i < 9; i++) { const sx = px + 0.036 + i * 0.022, sy = py - 0.010 - 0.012 * Math.sin(i * 0.5) - i * 0.0052; if (Math.hypot(sx, sy * 2.2) < 0.0055) c = miesz(c, [1, 0.95, 0.9], 0.75 - i * 0.07); }
  // świetliki nad trawą
  for (let i = 0; i < 16; i++) { const fx = (u - 0.04 - 0.92 * h2(i, 1, 111)) * A, fy = v - 0.80 - 0.17 * h2(i, 2, 111), d2 = Math.hypot(fx, fy); c = miesz(c, [1.0, 0.94, 0.52], 0.9 * gladko(0.0048, 0.002, d2) + 0.3 * Math.exp(-d2 * 90)); }
  return c;
}

const kolor = (u, v) => rzeczy(u, v, ziemia(u, v, chmura(u, v, niebo(u, v))));

/** Wzór dla malarza i rysownika. */
export const wzor = (W, H) => namaluj(W, H, kolor, 3);
