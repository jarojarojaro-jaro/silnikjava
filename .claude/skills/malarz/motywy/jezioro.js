// jezioro.js — motyw z wyobraźni: górskie jezioro o świcie. Nie ma zdjęcia: wzór to funkcja
// koloru punktu (niebo, chmury, dwa pasma gór, mgła, lasy, chata z oknem, odbicie w wodzie,
// brzeg z trzcinami, sosna na pierwszym planie). Malarz maluje go pędzlem jak każdy inny wzór.
//
//   node maluj.mjs motywy/jezioro.js --styl olej

import { namaluj, gladko, ogr, miesz, pasmo, fbm, fbm1, h2 } from '../lib/szkic.js';

export const TYTUL = 'Jezioro o świcie';
export const AUTOR = 'z wyobraźni';
export const PROPORCJA = 2 / 3;
export const GRUNT = [196, 170, 140];                       // ciepła imprimatura
export const SKUPIENIA = [{ x: 0.27, y: 0.50, rx: 0.10, ry: 0.05, ile: 3 }, { x: 0.62, y: 0.40, rx: 0.2, ry: 0.08, ile: 1.5 }];

const HOR = 0.535;                                          // linia wody
const grzbiet1 = (u) => 0.40 - 0.16 * fbm1(u * 2.2 + 1.3, 5, 11) - 0.05 * gladko(0.5, 0.0, Math.abs(u - 0.30) * 2.2) + 0.03 * gladko(0.17, 0.0, Math.abs(u - 0.63));
const SLONCE = [0.63, grzbiet1(0.63) - 0.008];     // słońce wychyla się zza przełęczy
const CHATA = { x: 0.265, y: 0.512, w: 0.052, h: 0.03 };

// niebo: granat u góry → lawenda → brzoskwinia nad górami, poświata słońca, chmury świecone od dołu
function niebo(u, v) {
  let c = pasmo([[0, [0.15, 0.24, 0.47]], [0.12, [0.33, 0.40, 0.66]], [0.22, [0.74, 0.57, 0.70]], [0.30, [1.0, 0.72, 0.56]], [0.38, [1.0, 0.88, 0.62]]], v);
  const ds = Math.hypot((u - SLONCE[0]) * 0.75, v - SLONCE[1]);
  c = miesz(c, [1.0, 0.90, 0.64], 0.9 * Math.exp(-ds * 6.5));
  c = miesz(c, [1.0, 0.99, 0.88], gladko(0.034, 0.02, ds));
  const ch = fbm(u * 2.6 + 3, v * 9.5, 5, 7), gest = gladko(0.45, 0.66, ch + 0.10 * Math.sin(v * 22 + u * 3)) * gladko(0.40, 0.27, v) * gladko(-0.02, 0.05, v);
  const spod = gladko(0.0, 0.10, fbm(u * 2.6 + 3, (v + 0.012) * 9.5, 5, 7) - ch);    // dół chmury łapie światło
  const chm = miesz(miesz([0.42, 0.38, 0.56], [0.74, 0.56, 0.66], gladko(0.05, 0.36, v)), [1.0, 0.72, 0.56], ogr(spod * 1.5 + 0.5 * Math.exp(-ds * 4)));
  return miesz(c, chm, gest * 0.9);
}
// las świerkowy: linia grzbietu + szpice drzew o różnej wysokości
function las(u, baza, ampl, czest, wys, z) {
  const x = u * czest, i = Math.floor(x);
  const szp = (k) => { const hh = wys * (0.5 + 0.7 * h2(k, z, 3)), d = Math.abs(x - k - 0.5 - 0.3 * (h2(k, z, 5) - 0.5)); return hh * Math.max(0, 1 - d * 2.3); };
  return baza - ampl * fbm1(u * 3.1 + z, 4, z) - Math.max(szp(i - 1), szp(i), szp(i + 1));
}
// wszystko nad wodą (to samo odbija się w jeziorze)
function swiat(u, v) {
  let c = niebo(u, v);
  const ds = Math.hypot((u - SLONCE[0]) * 0.75, v - SLONCE[1]), mgla = [0.93, 0.80, 0.72];
  // dalekie góry: blade, ze śniegiem różowym od słońca
  const g1 = grzbiet1(u);
  if (v > g1) {
    const gl = v - g1, zb = fbm(u * 9, v * 14, 4, 21), snieg = gladko(0.055, 0.0, gl - 0.05 * zb);
    const stok = fbm(u * 14 + v * 9, v * 20 - u * 6, 3, 23);                           // żebra skał: światło / cień
    let k = miesz([0.36, 0.38, 0.62], [0.66, 0.56, 0.72], gladko(0.3, 0.7, stok));
    k = miesz(k, miesz([0.80, 0.78, 0.92], [1.0, 0.84, 0.80], gladko(0.35, 0.7, stok + 0.3 * (u - 0.3))), snieg);
    c = miesz(k, mgla, ogr(0.04 + 0.36 * gladko(0.06, 0.2, gl) + 0.5 * Math.exp(-ds * 7)));
  }
  // bliższe pasmo: ciemniejsze, z jasną krawędzią od słońca
  const g2 = 0.475 - 0.10 * fbm1(u * 3.4 + 7.7, 5, 31) - 0.035 * gladko(0.45, 0.0, Math.abs(u - 0.86) * 2);
  if (v > g2) {
    const gl = v - g2, stok = fbm(u * 18 - v * 8, v * 26 + u * 5, 3, 33);
    let k = miesz([0.26, 0.30, 0.46], [0.40, 0.40, 0.55], stok);
    k = miesz(k, [0.98, 0.72, 0.58], 0.55 * gladko(0.012, 0.0, gl) * gladko(0.45, 0.1, Math.abs(u - SLONCE[0])));
    c = miesz(k, mgla, 0.12 + 0.62 * gladko(0.0, 0.085, gl));
  }
  // mgła nad wodą
  c = miesz(c, [0.97, 0.86, 0.76], 0.55 * gladko(0.075, 0.0, HOR - v) * (0.6 + 0.4 * fbm(u * 5, v * 30, 3, 41)));
  // lasy: daleki pas, potem bliższe cyple z lewej i prawej
  const l1 = las(u, 0.522, 0.012, 95, 0.016, 51);
  if (v > l1) c = miesz([0.20, 0.30, 0.36], [0.34, 0.40, 0.44], gladko(0.0, 0.02, v - l1));
  const cypL = las(u, 0.545 - 0.075 * gladko(0.52, 0.0, u) , 0.014, 58, 0.034, 61);
  if (v > cypL && u < 0.56) c = miesz([0.07, 0.15, 0.17], [0.13, 0.22, 0.22], fbm(u * 60, v * 60, 2, 63) * 0.8 + 0.2 * gladko(0, 0.03, v - cypL));
  const cypP = las(u, 0.548 - 0.10 * gladko(0.60, 1.0, u), 0.016, 46, 0.042, 71);
  if (v > cypP && u > 0.58) c = miesz([0.06, 0.13, 0.15], [0.12, 0.20, 0.20], fbm(u * 60, v * 60, 2, 73) * 0.8 + 0.2 * gladko(0, 0.03, v - cypP));
  // chata na lewym brzegu: ciemne bale, czerwony dach, świecące okno, dym
  const hx = (u - CHATA.x) / CHATA.w, hy = (v - CHATA.y) / CHATA.h;
  if (Math.abs(hx) < 0.5 && hy > 0 && hy < 1) c = miesz([0.30, 0.19, 0.13], [0.20, 0.13, 0.10], gladko(-0.5, 0.5, hx));
  const dach = hy + 0.75 - Math.abs(hx) * 1.25;
  if (dach > 0 && hy <= 0.08 && Math.abs(hx) < 0.62) c = miesz([0.62, 0.20, 0.14], [0.42, 0.13, 0.11], gladko(-0.6, 0.6, hx));
  if (Math.abs(hx + 0.12) < 0.13 && Math.abs(hy - 0.52) < 0.24) c = [1.0, 0.80, 0.36];
  if (Math.abs(hx - 0.27) < 0.07 && hy > 0.38 && hy < 1) c = [0.14, 0.09, 0.07];
  const dv = (CHATA.y - 0.022 - v) / 0.09, dymx = CHATA.x + 0.016 + 0.035 * dv * dv + 0.006 * Math.sin(dv * 9);
  if (dv > 0 && dv < 1) c = miesz(c, [0.93, 0.86, 0.84], 0.5 * (1 - dv) * gladko(0.006 + 0.016 * dv, 0.0, Math.abs(u - dymx)));
  c = miesz(c, [1.0, 0.72, 0.34], 0.30 * Math.exp(-Math.hypot((u - CHATA.x + 0.006) / 0.03, (v - CHATA.y - 0.016) / 0.03) * 1.6));
  return c;
}
// linia bliskiego brzegu: wyżej z lewej i pod sosną z prawej, zatoczka pośrodku
const liniaBrzegu = (u) => 0.93 - 0.115 * gladko(0.62, 0.0, u) - 0.085 * gladko(0.60, 0.92, u);
// duża sosna z prawej na pierwszym planie (rama kompozycji): piętra gałęzi, każda strona inaczej
function sosna(u, v, c) {
  const gora = 0.10, dol = 0.905, px = 0.868 + 0.010 * Math.sin(v * 6);
  if (v < gora || v > dol) return c;
  const s = (v - gora) / (dol - gora), str = u < px ? 0 : 1;
  const pietro = s * 21 + 0.5 * str, nr = Math.floor(pietro), fr = pietro - nr;
  const zasieg = (0.010 + 0.150 * Math.pow(s, 0.8)) * gladko(0.93, 0.80, s);
  const szer = zasieg * (0.30 + 0.70 * Math.pow(fr, 1.4)) * (0.65 + 0.6 * h2(nr, str, 9));
  const d = Math.abs(u - px) + 0.016 * (fbm(u * 85, v * 45, 3, 81) - 0.5) * 2;
  if (d < szer) {
    const igly = fbm(u * 70, v * 70, 3, 83), sw = gladko(0.25, -0.9, (u - px) / (szer + 1e-4)) * (0.3 + 0.7 * igly);
    c = miesz(miesz([0.03, 0.075, 0.08], [0.08, 0.16, 0.12], igly), [0.56, 0.44, 0.24], 0.6 * sw * gladko(0.15, 0.7, fr));
  }
  if (Math.abs(u - px) < 0.0045 + 0.0055 * s && (s > 0.80 || d >= szer)) c = miesz([0.11, 0.075, 0.06], [0.40, 0.25, 0.16], gladko(0.003, -0.005, u - px));
  return c;
}

function kolor(u, v) {
  let c;
  if (v < HOR) c = swiat(u, v);
  else {
    // jezioro: odbicie świata, rozmyte zmarszczkami tym mocniej, im bliżej widza
    const gl = v - HOR, fala = gl * (0.9 + 5.0 * gl);
    const du = fala * 0.035 * (fbm(u * 7, v * 260 / (1 + gl * 3), 3, 93) - 0.5) * 2;
    const vo = HOR - gl * 0.92 - fala * 0.012 * Math.sin(v * 300 + u * 20);
    c = swiat(ogr(u + du), Math.max(0.02, vo));
    c = miesz(c, [0.20, 0.28, 0.40], 0.16 + 0.30 * gladko(0.0, 0.42, gl));
    c = c.map((x) => x * (0.93 - 0.18 * gladko(0, 0.4, gl)));
    const zm = fbm(u * 5, v * 150 / (1 + gl * 5), 3, 95);                           // jasne pasemka zmarszczek
    c = miesz(c, [0.86, 0.80, 0.84], 0.20 * gladko(0.62, 0.8, zm) * gladko(0.0, 0.1, gl));
    const sc = Math.abs(u - SLONCE[0] - 0.01 * Math.sin(v * 90)) / (0.016 + 0.11 * gl);     // ścieżka słońca
    c = miesz(c, [1.0, 0.90, 0.66], 0.80 * gladko(1, 0.1, sc) * gladko(0.40, 0.72, zm + 0.25 * (1 - sc)) * gladko(0.33, 0.02, gl));
    c = miesz(c, [0.96, 0.86, 0.78], 0.5 * gladko(0.012, 0.0, gl));                  // jasna kreska przy brzegu
    const oy = (v - (2 * HOR - CHATA.y - CHATA.h * 0.5)) / CHATA.h;                 // odbicie okna
    c = miesz(c, [1.0, 0.74, 0.34], 0.75 * gladko(0.14, 0.03, Math.abs(u + du * 0.5 - CHATA.x + 0.006) / CHATA.w) * gladko(1.8, 0.0, Math.abs(oy - 0.6)) * (0.5 + 0.5 * Math.sin(v * 520)));
  }
  // bliski brzeg: ciemna ziemia, kępy trawy i otoczaki oświetlone z lewej góry
  const brzeg = liniaBrzegu(u) - 0.02 * fbm1(u * 6, 4, 101);
  if (v > brzeg) {
    const gl = v - brzeg, t = fbm(u * 26, v * 26, 4, 103);
    let k = miesz([0.07, 0.08, 0.09], [0.21, 0.17, 0.14], t);
    k = miesz(k, miesz([0.13, 0.20, 0.11], [0.36, 0.38, 0.17], fbm(u * 50, v * 80, 2, 109)), gladko(0.42, 0.7, fbm(u * 10, v * 24, 3, 105)));
    const gx = u * 11, gy = v * 16.5, ix = Math.floor(gx), iy = Math.floor(gy);
    for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {      // otoczaki: jeden na kratkę
      if (h2(i, j, 131) < 0.45) continue;
      const cx = i + 0.2 + 0.6 * h2(i, j, 133), cy = j + 0.2 + 0.6 * h2(i, j, 135), r = 0.22 + 0.26 * h2(i, j, 137);
      const ex = (gx - cx) / r, ey = (gy - cy) / (r * 0.72), d = ex * ex + ey * ey;
      if (d < 1) { const sw = ogr(0.5 - 0.55 * ex - 0.75 * ey); k = miesz(miesz([0.10, 0.10, 0.13], [0.40, 0.38, 0.42], sw), [0.95, 0.74, 0.60], gladko(0.72, 1.0, sw) * 0.8); if (d > 0.8) k = miesz(k, [0.05, 0.05, 0.06], (d - 0.8) * 3); }
    }
    c = miesz(miesz(c, [0.92, 0.84, 0.76], 0.5), k, gladko(0.0, 0.006, gl));
  }
  // trzciny i trawy na brzegu: cienkie, wygięte źdźbła, część łapie światło
  for (let i = 0; i < 60; i++) {
    const bx = h2(i, 1, 111) * 0.74 - 0.02, by = liniaBrzegu(bx) + 0.012;
    const wys = 0.035 + 0.075 * h2(i, 2, 111), s = (by - v) / wys;
    if (s < 0 || s > 1) continue;
    const x = bx + (h2(i, 3, 111) - 0.4) * 0.05 * s * s;
    if (Math.abs(u - x) < 0.0028 * (1.05 - s)) c = h2(i, 4, 111) < 0.3 ? [0.82, 0.66, 0.36] : [0.09, 0.13, 0.09];
  }
  c = sosna(u, v, c);
  // ptaki nad górami
  for (let i = 0; i < 5; i++) {
    const bx = 0.30 + 0.07 * i + 0.03 * h2(i, 1, 121), by = 0.19 + 0.045 * h2(i, 2, 121) + 0.012 * i, r = 0.012 + 0.004 * h2(i, 3, 121);
    const x = (u - bx) / r, y = (v - by) / r;
    if (Math.abs(x) < 1 && Math.abs(y - 0.55 * (1 - Math.abs(x)) * (1 - Math.abs(x)) + 0.2) < 0.13) c = [0.16, 0.15, 0.24];
  }
  return c;
}

/** Wzór dla malarza. */
export const wzor = (W, H) => namaluj(W, H, kolor, 3);
