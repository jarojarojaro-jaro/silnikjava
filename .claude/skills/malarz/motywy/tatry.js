// tatry.js — motyw z wyobraźni, 16:9: „Tatry. Poranek nad stawem”. Granitowa ściana z poszarpaną granią
// i śniegiem w żlebach, samotna turnia nad progiem, dalsze pasmo w błękicie, świerki i kosodrzewina,
// szmaragdowy staw z odbiciem, schron nad brzegiem, a z przodu głazy, trawy i krokusy.
// Słońce świeci nisko z lewej: ciepłe światła na skale, chłodne, niebieskie cienie.
//
//   node maluj.mjs motywy/tatry.js --styl olej      (albo pastele, kredki, wegiel)

import { namaluj, gladko, miesz, pasmo, szum, fbm, fbm1, h2 } from '../lib/szkic.js';

export const TYTUL = 'Tatry. Poranek nad stawem';
export const AUTOR = 'z wyobraźni';
export const PROPORCJA = 16 / 9;
export const GRUNT = [188, 176, 160];
export const SKUPIENIA = [{ x: 0.40, y: 0.26, rx: 0.22, ry: 0.16, ile: 2 }, { x: 0.715, y: 0.36, rx: 0.06, ry: 0.12, ile: 2.5 }, { x: 0.205, y: 0.585, rx: 0.05, ry: 0.04, ile: 3 }];

const A = PROPORCJA, HOR = 0.615;                       // linia dalekiego brzegu stawu
// szum „grzbietowy”: ostre granie zamiast obłych pagórków
const gran = (x, z) => { let s = 0, a = 0.5, n = 0; for (let i = 0; i < 5; i++) { const t = 1 - Math.abs(2 * szum(x, 0.5, z + i * 9) - 1); s += a * t * t; n += a; x = x * 2.17 + 3.1; a *= 0.5; } return s / n; };
// linie grani: dalekie pasmo, główna ściana z turnią, boczne ramiona doliny
const dal = (u) => 0.40 - 0.13 * gran(u * 2.6 + 4.2, 3) - 0.04 * gladko(0.5, 1, u);
function sciana(u) {
  const przelecz = 1 - 0.5 * Math.exp(-(((u - 0.635) / 0.055) ** 2)) - 0.35 * Math.exp(-(((u - 0.80) / 0.06) ** 2));   // siodła po obu stronach turni
  const masyw = 0.53 - (0.25 + 0.15 * Math.exp(-(((u - 0.36) / 0.23) ** 2))) * (0.28 + 0.72 * gran(u * 2.5 + 0.6, 11)) * przelecz - 0.055 * gran(u * 8 + 2, 13) - 0.012 * gran(u * 31, 15);
  const d = u - 0.715, turnia = 0.47 - 0.25 * Math.pow(Math.max(0, 1 - Math.abs(d) / (d < 0 ? 0.024 : 0.058)), 0.7) - 0.01 * gran(u * 60, 17);   // iglica: stroma z lewej, łagodniejsza z prawej
  return Math.min(masyw, turnia);
}
const ramieL = (u) => HOR - 0.30 * Math.pow(gladko(0.33, 0, u), 1.25) - 0.012 * fbm1(u * 14, 3, 21);
const ramieP = (u) => HOR - 0.27 * Math.pow(gladko(0.70, 1, u), 1.3) - 0.012 * fbm1(u * 14, 3, 23);
const SCHRON = { u: 0.205, w: 0.040, h: 0.034 };

function niebo(u, v) {
  let c = pasmo([[0, [0.28, 0.48, 0.80]], [0.22, [0.46, 0.66, 0.90]], [0.42, [0.80, 0.86, 0.94]], [0.56, [0.99, 0.90, 0.80]]], v);
  c = miesz(c, [1.0, 0.93, 0.78], 0.55 * Math.exp(-Math.hypot((u + 0.05) * A, v - 0.30) * 2.2));          // łuna od słońca zza lewego ramienia
  const ch = fbm(u * 2.4 + 1.7, v * 6.5, 5, 31), g = gladko(0.52, 0.70, ch) * gladko(0.02, 0.10, v) * gladko(0.46, 0.30, v);
  const spod = gladko(0.0, 0.07, fbm(u * 2.4 + 1.7, (v + 0.02) * 6.5, 5, 31) - ch);
  return miesz(c, miesz([1.0, 0.98, 0.95], [0.72, 0.76, 0.88], spod), g * 0.9);
}
// skała: żebra i żleby biegną w dół od grani; strona zwrócona w lewo łapie słońce
function skala(u, v, yg, ciepla, zimna, mgla, z) {
  const gl = v - yg, e = 0.004;
  // żebra o ostrych krawędziach w dwóch skalach + kierunek całego zbocza (linia grani opada w prawo = ściana w słońcu)
  const zebra = (x) => { const a = fbm(x * 30 + 1.1 * fbm(x * 6, v * 6, 3, z + 1), v * 5.5, 4, z), b = fbm(x * 95, v * 16, 3, z + 2); return (1 - Math.abs(2 * a - 1)) + 0.35 * (1 - Math.abs(2 * b - 1)); };
  const sw = 0.5 - 5.5 * (zebra(u + e) - zebra(u - e)) + 5.5 * (sciana(u + 0.012) - sciana(u - 0.012)) + 0.22 * (fbm(u * 70, v * 70, 3, z + 3) - 0.5);
  let k = miesz(zimna, ciepla, gladko(0.34, 0.60, sw));
  k = miesz(k, ciepla.map((x) => Math.min(1, x * 1.14 + 0.05)), gladko(0.78, 1.0, sw));
  k = miesz(k, zimna.map((x) => x * 0.6), gladko(0.24, 0.02, sw) * 0.85);
  // śnieg: płaty pod granią i długie żleby; w cieniu niebieski
  const zleb = gladko(0.66, 0.80, fbm(u * 46 + 1.5 * fbm(u * 6, v * 3, 2, z + 5), v * 4.2, 3, z + 7)) * gladko(0.34, 0.06, gl);
  const plat = gladko(0.60, 0.72, fbm(u * 11, v * 17, 4, z + 9) + 0.2 * (0.12 - gl) * 4) * gladko(0.22, 0.08, gl);
  k = miesz(k, miesz([0.62, 0.72, 0.92], [1.0, 0.98, 0.95], gladko(0.32, 0.6, sw)), Math.max(zleb, plat) * 0.95);
  return miesz(k, mgla, 0.10 + 0.34 * gladko(0.10, 0.42, gl));
}
// świerki na linii: wysokość grzbietu minus szpice koron
function las(u, baza, czest, wys, z) {
  const x = u * czest, i = Math.floor(x);
  const szp = (k) => wys * (0.5 + 0.7 * h2(k, z, 3)) * Math.max(0, 1 - Math.abs(x - k - 0.5 - 0.3 * (h2(k, z, 5) - 0.5)) * 2.3);
  return baza - Math.max(szp(i - 1), szp(i), szp(i + 1));
}
// wszystko nad wodą (to samo odbija się w stawie)
function swiat(u, v) {
  let c = niebo(u, v);
  const mgla = [0.80, 0.85, 0.94];
  const yd = dal(u);
  if (v > yd) c = miesz(skala(u, v, yd, [0.74, 0.74, 0.86], [0.50, 0.58, 0.80], mgla, 41), mgla, 0.45);
  const ys = sciana(u);
  if (v > ys) {
    c = skala(u, v, ys, [0.70, 0.60, 0.50], [0.26, 0.32, 0.50], mgla, 51);
    const gl = v - ys, piarg = gladko(0.455, 0.56, v + 0.03 * fbm(u * 9, 2, 3, 53));                     // piargi u podnóża
    c = miesz(c, miesz([0.56, 0.58, 0.66], [0.84, 0.80, 0.74], fbm(u * 50, v * 30, 3, 55)), piarg * 0.75);
    const kos = gladko(0.52, 0.66, fbm(u * 34, v * 34, 3, 57) + (v - 0.515) * 5.5) * gladko(0.02, 0.06, gl);   // kosodrzewina
    c = miesz(c, miesz([0.10, 0.22, 0.17], [0.30, 0.44, 0.22], fbm(u * 80, v * 80, 2, 59)), kos * 0.92);
  }
  // obłoki zaczepione o grań
  const ob = gladko(0.56, 0.74, fbm(u * 3.1 + 5, v * 9, 4, 61)) * gladko(0.16, 0.24, v) * gladko(0.40, 0.30, v);
  c = miesz(c, [0.98, 0.97, 0.96], ob * 0.72);
  // boczne ramiona doliny: lewe w cieniu, prawe w słońcu; na grzbietach świerki
  const yl = las(u, ramieL(u), 120, 0.020, 71), yp = las(u, ramieP(u), 120, 0.020, 73);
  if (v > yl && u < 0.36) c = miesz(miesz([0.05, 0.13, 0.15], [0.12, 0.25, 0.22], fbm(u * 70, v * 70, 3, 75)), mgla, 0.12 * gladko(0.3, 0, u));
  if (v > yp && u > 0.66) c = miesz(miesz([0.11, 0.24, 0.16], [0.42, 0.50, 0.24], gladko(0.35, 0.75, fbm(u * 70, v * 70, 3, 77))), [0.95, 0.80, 0.56], 0.25 * gladko(0.02, 0, v - yp));
  // mgła nad wodą i pas świerków na dalekim brzegu
  c = miesz(c, [0.93, 0.93, 0.94], 0.55 * gladko(0.065, 0, HOR - v) * (0.55 + 0.45 * fbm(u * 6, v * 40, 3, 81)));
  const yt = las(u, HOR - 0.012, 70, 0.045, 87);                                   // dalszy, jaśniejszy rząd
  if (v > yt) c = miesz([0.20, 0.32, 0.30], [0.36, 0.46, 0.40], fbm(u * 120, v * 50, 2, 89));
  const yb = las(u, HOR + 0.002, 96, 0.052 * (0.55 + 0.9 * fbm1(u * 9, 3, 86)), 83);
  if (v > yb) c = miesz([0.05, 0.14, 0.14], [0.17, 0.30, 0.20], gladko(0.5, 0.2, (v - yb) / 0.03) * 0.6 + 0.4 * fbm(u * 150, v * 60, 2, 85));
  // schron nad brzegiem: jasna ściana od słońca, ciemny szczyt, dach z gontu, dym
  const hx = (u - SCHRON.u) / SCHRON.w, hy = (HOR + 0.004 - v) / SCHRON.h;
  if (Math.abs(hx) < 0.5 && hy > 0 && hy < 1) c = hx < 0.12 ? miesz([0.74, 0.50, 0.30], [0.60, 0.38, 0.22], (Math.floor(hy * 6) % 2)) : [0.30, 0.19, 0.14];
  if (hy >= 0.9 && hy < 1.75 && Math.abs(hx - 0.02) < 0.66 * (1 - (hy - 0.9) / 0.85)) c = hx < 0.1 ? [0.44, 0.25, 0.20] : [0.20, 0.12, 0.12];
  if (Math.abs(hx + 0.2) < 0.07 && Math.abs(hy - 0.5) < 0.2) c = [0.16, 0.12, 0.12];
  const dt = (hy - 1.6) / 2.4, dx = SCHRON.u + SCHRON.w * (0.25 + 0.8 * dt * dt + 0.1 * Math.sin(dt * 9));
  if (dt > 0 && dt < 1) c = miesz(c, [0.97, 0.95, 0.94], 0.6 * (1 - dt) * gladko(0.004 + 0.012 * dt, 0, Math.abs(u - dx)));
  return c;
}
// bliski brzeg: wyżej w rogach, zatoczka pośrodku
const brzeg = (u) => 0.905 - 0.085 * gladko(0.30, 0, u) - 0.11 * gladko(0.62, 1, u) + 0.012 * fbm1(u * 7, 3, 91);
// wysoki świerk z lewej jako rama: piętra gałęzi, każda strona inaczej
function swierk(u, v, c) {
  const gora = 0.06, dol = 0.99, px = 0.062 + 0.006 * Math.sin(v * 7);
  if (v < gora || u > 0.2) return c;
  const s = (v - gora) / (dol - gora), str = u < px ? 0 : 1, p = s * 24 + 0.5 * str, nr = Math.floor(p), fr = p - nr;
  const szer = (0.006 + 0.105 * Math.pow(s, 0.8)) * (0.30 + 0.70 * Math.pow(fr, 1.4)) * (0.65 + 0.6 * h2(nr, str, 95));
  const d = Math.abs(u - px) * A / 1.4 + 0.012 * (fbm(u * 90, v * 50, 3, 97) - 0.5) * 2;
  if (d < szer) {
    const igly = fbm(u * 80, v * 80, 3, 99), sw = gladko(-0.2, 0.9, -(u - px) / (szer + 1e-4)) * 0 + gladko(0.2, 1, (px - u) / (szer + 1e-4) + 0.4) * (0.3 + 0.7 * igly);
    c = miesz(miesz([0.03, 0.08, 0.08], [0.08, 0.18, 0.13], igly), [0.58, 0.56, 0.26], 0.5 * sw * gladko(0.2, 0.75, fr));
  }
  if (Math.abs(u - px) < 0.003 + 0.004 * s && d >= szer) c = [0.16, 0.11, 0.09];
  return c;
}

function kolor(u, v) {
  let c;
  if (v < HOR) c = swiat(u, v);
  else {
    // staw: odbicie świata, szmaragd głębi, turkus płycizny przy bliskim brzegu
    const gl = v - HOR, fala = gl * (0.8 + 4 * gl);
    const du = fala * 0.03 * (fbm(u * 7, v * 240 / (1 + gl * 3), 3, 101) - 0.5) * 2;
    c = swiat(Math.max(0, Math.min(1, u + du)), Math.max(0.02, HOR - gl * 0.95));
    c = miesz(c, [0.05, 0.30, 0.33], 0.30 + 0.25 * gladko(0, 0.3, gl)).map((x) => x * (0.94 - 0.14 * gladko(0, 0.3, gl)));
    const zm = fbm(u * 5, v * 170 / (1 + gl * 5), 3, 103);
    c = miesz(c, [0.82, 0.92, 0.92], 0.24 * gladko(0.62, 0.8, zm) * gladko(0, 0.08, gl));
    const plycizna = gladko(0.10, 0.0, brzeg(u) - v);
    c = miesz(c, miesz([0.20, 0.62, 0.58], [0.62, 0.72, 0.60], gladko(0.5, 0.75, fbm(u * 40, v * 60, 3, 105))), plycizna * 0.8);
    c = miesz(c, [0.95, 0.95, 0.94], 0.5 * gladko(0.010, 0, gl));
  }
  // bliski brzeg: trawa, kępy, krokusy, granitowe głazy
  const yb = brzeg(u);
  if (v > yb) {
    const gl = v - yb, t = fbm(u * 30, v * 30, 4, 111);
    let k = miesz(miesz([0.14, 0.26, 0.10], [0.50, 0.58, 0.22], gladko(0.3, 0.75, t)), [0.74, 0.70, 0.36], 0.4 * gladko(0.6, 0.85, fbm(u * 9, v * 20, 3, 113)));
    k = miesz(k, [0.20, 0.16, 0.13], 0.55 * gladko(0.52, 0.34, fbm(u * 14, v * 22, 3, 115)));             // prześwity ziemi
    const fx = u * 40, fy = v * 40 / A * 1.25, ix = Math.floor(fx), iy = Math.floor(fy);              // krokusy w kępach
    for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {
      if (h2(i, j, 121) > 0.55 * gladko(0.38, 0.6, fbm(i / 5, j / 5, 2, 123))) continue;
      const cx = i + 0.2 + 0.6 * h2(i, j, 125), cy = j + 0.3 + 0.5 * h2(i, j, 127), ex = (fx - cx) / 0.24, ey = (fy - cy) / 0.40;
      if (ex * ex + ey * ey < 1) k = ey > 0.55 ? [0.95, 0.62, 0.12] : miesz([0.40, 0.22, 0.66], [0.80, 0.66, 0.98], gladko(0.4, -0.7, ex + ey * 0.5));
      else if (Math.abs(ex) < 0.2 && ey > 1 && ey < 2.2) k = [0.24, 0.40, 0.16];
    }
    const gx = u * 7, gy = v * 7 / A * 1.5, kx = Math.floor(gx), ky = Math.floor(gy);                    // głazy
    for (let j = ky - 1; j <= ky + 1; j++) for (let i = kx - 1; i <= kx + 1; i++) {
      if (h2(i, j, 131) < 0.30) continue;
      const cx = i + 0.25 + 0.5 * h2(i, j, 133), cy = j + 0.3 + 0.4 * h2(i, j, 135), r = 0.22 + 0.34 * h2(i, j, 137);
      const ex = (gx - cx) / r, ey = (gy - cy) / (r * 0.66), d = Math.pow(Math.abs(ex), 2.6) + Math.pow(Math.abs(ey), 2.6) + 0.25 * (fbm(u * 60, v * 60, 2, 139) - 0.5);
      if (d < 1) {
        const sw = Math.max(0, Math.min(1, 0.52 - 0.5 * ex - 0.62 * ey + 0.3 * (fbm(u * 45, v * 45, 3, 141) - 0.5)));
        k = miesz(miesz([0.20, 0.23, 0.32], [0.62, 0.61, 0.62], gladko(0.2, 0.6, sw)), [0.97, 0.90, 0.80], gladko(0.66, 0.95, sw));
        k = miesz(k, [0.62, 0.66, 0.30], 0.6 * gladko(0.66, 0.8, fbm(u * 70, v * 70, 2, 143)));           // porosty
        if (d > 0.82) k = miesz(k, [0.07, 0.08, 0.10], (d - 0.82) * 4);
      }
    }
    c = miesz(miesz(c, [0.90, 0.92, 0.88], 0.4), k, gladko(0, 0.007, gl));
  }
  // kosodrzewina w prawym rogu
  const kd = Math.hypot((u - 0.985) * A / 1.5, (v - 0.86) * 1.5) + 0.03 * (fbm(u * 50, v * 50, 3, 151) - 0.5) * 2;
  if (kd < 0.13) c = miesz(miesz([0.04, 0.11, 0.09], [0.13, 0.27, 0.15], fbm(u * 120, v * 60, 2, 153)), [0.50, 0.56, 0.24], 0.5 * gladko(0.6, 0.85, fbm(u * 90, v * 90, 2, 155)) * gladko(0.02, -0.1, u - 0.94 + (v - 0.8)));
  return swierk(u, v, c);
}

/** Wzór dla malarza i rysownika. */
export const wzor = (W, H) => namaluj(W, H, kolor, 3);
