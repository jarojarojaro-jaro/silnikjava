// pedzel.js — pędzel. Jedna implementacja dla malarza (Node) i pracowni (przeglądarka),
// więc film kładzie dokładnie te pociągnięcia, które malarz ocenił.
//
// Wszystko jest w jednostkach roboczych (obraz ma W × H jednostek), więc pociągnięcie to
// mały kształt wektorowy: można je zrasteryzować w dowolnej skali S (piksele na jednostkę)
// i odtworzyć od dowolnego miejsca listy.
//
// Pociągnięcie: środek (x, y), kierunek ang, długość len, szerokość wid, wygięcie bend
// (ułamek długości, o który grzbiet odchodzi w bok — obrót nadgarstka), krycie op,
// rodzaj pędzla kind i ziarno seed (które włosy, ile farby). Pędzel zostawia:
//   - korpus: ląduje, rozpłaszcza się pod naciskiem i odrywa — płaski kończy postrzępioną
//     krawędzią, koci język łukiem, okrągły szpicem,
//   - włosie: kępki i pojedyncze włosy, trochę jaśniejsze i ciemniejsze, wędrujące w poprzek,
//   - zapas farby: ku końcowi pędzel wysycha, włosy wypadają i prześwituje spód,
//   - fakturę (grubość farby): grzbiety wzdłuż włosów, wałek na brzegach. Kolor od niej
//     nie zależy; czyta ją dopiero światło (oswietl).
//
// Pomysł i układ (pędzel jako funkcja maski + rekord 12 bajtów) za projektem
// ChetasLua/mona-lisa-js (MIT); implementacja własna, z rodzajami pędzli, stylami i światłem.

export const PLASKI = 0, KOCI = 1, OKRAGLY = 2;
export const RODZAJE = ['płaski', 'koci język', 'okrągły'];
/** Krycie: 2 bity rekordu. */
export const KRYCIE = [0.35, 0.6, 0.85, 1];

const TAB = 128;
const tabA = new Float32Array(TAB), tabB = new Float32Array(TAB);
const tabS = new Float32Array(TAB), tabR = new Float32Array(TAB);

// rodzaj → [lądowanie (× hw/len), oderwanie (× hw/len), wykładnik lądowania, wykładnik oderwania, postrzępienie]
const KSZTALT = [
  [0.4, 0.5, 0.3, 0.3, 1.0],
  [1.0, 1.7, 0.5, 0.5, 0.3],
  [1.3, 3.2, 0.8, 1.0, 0.0],
];

/** Hasz liczby całkowitej → [0, 1). */
export function hasz(n) {
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
  n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}
function szum(k, x) {
  const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f);
  const a = hasz(k + i), b = hasz(k + i + 1);
  return a + (b - a) * f;
}
function gladko(a, b, x) {
  x = (x - a) / (b - a);
  return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
}
// rząd włosów w poprzek pędzla: A przy lądowaniu, B przy oderwaniu, S odcień, R długość włosa
function wlosie(seed, wid) {
  const nb = Math.max(2, Math.min(30, wid * 0.7)), nf = Math.max(4, Math.min(90, wid * 2.4));
  const k = Math.imul(seed + 1, 131);
  for (let i = 0; i < TAB; i++) {
    const u = i / (TAB - 1);
    tabA[i] = 0.62 * szum(k, u * nb) + 0.38 * szum(k + 5003, u * nf);
    tabB[i] = 0.62 * szum(k + 9001, u * nb) + 0.38 * szum(k + 14009, u * nf);
    tabS[i] = 0.55 * szum(k + 20011, u * nb) + 0.45 * szum(k + 25013, u * nf);
    tabR[i] = 0.5 * szum(k + 30011, u * nb) + 0.5 * szum(k + 35017, u * nf);
  }
}

/**
 * Pędzel dla obrazu W × H jednostek w skali S px na jednostkę.
 * @param {number} W @param {number} H @param {number} S
 * @param {{wlosie?:number, suchosc?:number, smugi?:number}} [cechy] siła włosia, suchość, smugi odcienia
 */
export function Pedzel(W, H, S, cechy = {}) {
  const PW = Math.round(W * S), PH = Math.round(H * S);
  const MA = new Float32Array(PW * PH), MS = new Float32Array(PW * PH), MR = new Float32Array(PW * PH);
  const kWl = cechy.wlosie ?? 1, kSu = cechy.suchosc ?? 1, kSm = cechy.smugi ?? 1;
  const o = { PW, PH, S, MA, MS, MR, x0: 0, y0: 0, w: 0, h: 0, grubosc: 0 };

  /**
   * Rasteryzuje pociągnięcie do maski: krycie MA, odcień MS, faktura MR (prostokąt x0,y0,w,h).
   * tA..tB ogranicza je do części długości (film pokazuje pędzel w trakcie ruchu).
   * @returns {number} liczba pikseli prostokąta maski (0 = nic)
   */
  o.maska = (x, y, ang, len, wid, bend, op, kind, seed, tA = 0, tB = 1) => {
    const c = Math.cos(ang), s = Math.sin(ang), hw = wid * 0.5;
    const miekko = Math.min(2.5, Math.max(0.8, wid * 0.22));
    const bok = hw + Math.abs(bend) * len * 0.5 + miekko, wzdluz = len * 0.5;
    const ex = Math.abs(c) * wzdluz + Math.abs(s) * bok, ey = Math.abs(s) * wzdluz + Math.abs(c) * bok;
    let x0 = Math.floor((x - ex) * S), x1 = Math.ceil((x + ex) * S);
    let y0 = Math.floor((y - ey) * S), y1 = Math.ceil((y + ey) * S);
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
    if (x1 > PW) x1 = PW; if (y1 > PH) y1 = PH;
    const w = x1 - x0, h = y1 - y0;
    o.x0 = x0; o.y0 = y0; o.w = w; o.h = h;
    if (w <= 0 || h <= 0) { o.w = o.h = 0; return 0; }
    const K = KSZTALT[kind], wl = gladko(1.5, 7, wid) * kWl;
    if (wl > 0) wlosie(seed, wid);
    const such = (0.5 + 0.55 * hasz(Math.imul(seed + 1, 7919) + 3)) * kSu;   // 0,5 mokry … 1,05 suchy
    const ampS = 0.2 * wl * kSm;
    // gruby pędzel zostawia grubą farbę, cienki prawie płaską (laserunek detalu nie robi „gniecionego papieru”)
    o.grubosc = Math.min(1.7, 0.36 * Math.sqrt(wid)) * gladko(0.8, 9, wid);
    const walek = gladko(2, 8, wid);
    const e0 = Math.min(0.5, K[0] * hw / len), e1 = Math.min(0.5, K[1] * hw / len);
    const p0 = K[2], p1 = K[3], strz = K[4] * Math.min(0.35, 1.1 * hw / len);
    const iS = 1 / S, iL = 1 / len, bl = bend * len * 0.5, ihw = 0.5 / hw, im = 1 / miekko;
    const ie0 = 1 / e0, ie1 = 1 / e1, t1 = 1 - e1, iStrz = strz > 0 ? 1 / (0.35 * strz) : 0;
    let k = 0;
    for (let py = y0; py < y1; py++) {
      const wy = (py + 0.5) * iS - y, ub = wy * s, vb = wy * c;
      for (let px = x0; px < x1; px++, k++) {
        const wx = (px + 0.5) * iS - x;
        const t = (wx * c + ub) * iL + 0.5;
        if (t <= tA || t > tB) { MA[k] = 0; continue; }
        const q = 2 * t - 1;
        const v = vb - wx * s - bl * (1 - q * q);
        let hh = hw * (1 - 0.1 * q * q), z;                       // brzuch pod naciskiem
        if (t < e0) { z = 1 - t * ie0; hh *= Math.pow(1 - z * z, p0); }
        else if (t > t1) { z = (t - t1) * ie1; hh *= Math.pow(1 - z * z, p1); }
        const av = v < 0 ? -v : v;
        let a = (hh - av) * im + 0.5;
        if (a <= 0) { MA[k] = 0; continue; }
        if (a > 1) a = 1;
        const czubek = 2 * hh * im; if (czubek < 1) a *= czubek;
        let sh = 1, rg = 0.2;
        if (wl > 0) {
          const vn = v * ihw + 0.5;
          const fi = vn <= 0 ? 0 : vn >= 1 ? TAB - 1 : (vn * (TAB - 1)) | 0;
          const hr = tabA[fi] + (tabB[fi] - tabA[fi]) * t;          // włosy wędrują wzdłuż pociągnięcia
          const zapas = 1 - such * t * Math.sqrt(t);                // farba, która została na pędzlu
          let luka = (hr - zapas + 0.16) * 3.4;                     // włosy ponad tą linią już wyschły
          luka = luka <= 0 ? 0 : luka >= 1 ? 1 : luka * luka * (3 - 2 * luka);
          a *= (1 - 0.16 * wl * hr) * (1 - 0.86 * wl * luka);
          if (strz > 0) {                                           // płaski: włosy kończą w różnych miejscach
            const kon = (1 - strz * tabR[fi] - t) * iStrz + 0.5;
            if (kon < 1) a *= kon <= 0 ? 0 : kon;
          }
          sh = 1 + ampS * (tabS[fi] - 0.5);
          rg = (0.2 + 0.9 * (tabS[fi] - 0.5)) * (1 - 0.7 * luka);   // bruzdy wzdłuż włosów, bez „płaskowyżu”
        }
        let en = av / hh;
        if (en > 0.55) { en = en > 0.95 ? 1 : (en - 0.55) * 2.5; rg += 0.22 * walek * en * en * (3 - 2 * en); }
        MA[k] = a * op; MS[k] = sh; MR[k] = rg;
      }
    }
    return w * h;
  };

  /**
   * Kładzie pociągnięcie na płótnie C (float RGB 0..255, PW*PH*3).
   * Hb (opcjonalnie, PW*PH) zbiera grubość farby dla światła.
   */
  o.maluj = (C, x, y, ang, len, wid, bend, op, kind, seed, r, g, b, tA, tB, Hb) => {
    if (!o.maska(x, y, ang, len, wid, bend, op, kind, seed, tA, tB)) return;
    const { x0, y0, w, h, grubosc } = o;
    let k = 0;
    for (let yy = 0; yy < h; yy++) {
      let i = (y0 + yy) * PW + x0, j = i * 3;
      for (let xx = 0; xx < w; xx++, k++, i++, j += 3) {
        const a = MA[k]; if (a === 0) continue;
        const ia = 1 - a, as = a * MS[k]; let n;
        n = C[j] * ia + r * as; C[j] = n > 255 ? 255 : n;
        n = C[j + 1] * ia + g * as; C[j + 1] = n > 255 ? 255 : n;
        n = C[j + 2] * ia + b * as; C[j + 2] = n > 255 ? 255 : n;
        if (Hb) Hb[i] += a * (grubosc * MR[k] - 0.55 * Hb[i]);
      }
    }
  };
  return o;
}

// ---- rekord pociągnięcia: 12 bajtów ----------------------------------------------------
// x u16, y u16, ang u8, len u8 (log), wid u8 (log), bend i8, r, g, b, flagi u8 (krycie | rodzaj << 2)
export const BAJTY = 12;
const LB = Math.log(1.0245), WB = Math.log(1.0225);
const u8 = (c) => (c < 0 ? 0 : c > 255 ? 255 : c);
export const Kod = {
  xq: (x) => { const c = Math.round((x + 64) * 32); return c < 0 ? 0 : c > 65535 ? 65535 : c; },
  xd: (c) => c / 32 - 64,
  aq: (a) => Math.round(a / Math.PI * 256) & 255,
  ad: (c) => c * Math.PI / 256,
  lq: (l) => u8(Math.round(Math.log(l / 0.8) / LB)),
  ld: (c) => 0.8 * Math.exp(c * LB),
  wq: (w) => u8(Math.round(Math.log(w / 0.5) / WB)),
  wd: (c) => 0.5 * Math.exp(c * WB),
  bq: (b) => { const c = Math.round(b / 0.4 * 127); return c < -127 ? -127 : c > 127 ? 127 : c; },
  bd: (c) => c / 127 * 0.4,
};

/** Odczytuje rekord i (0..n-1) z bufora bajtów. */
export function odczytaj(buf, i, out = {}) {
  const o = i * BAJTY;
  out.x = Kod.xd(buf[o] | (buf[o + 1] << 8)); out.y = Kod.xd(buf[o + 2] | (buf[o + 3] << 8));
  out.ang = Kod.ad(buf[o + 4]); out.len = Kod.ld(buf[o + 5]); out.wid = Kod.wd(buf[o + 6]);
  out.bend = Kod.bd((buf[o + 7] << 24) >> 24);
  out.r = buf[o + 8]; out.g = buf[o + 9]; out.b = buf[o + 10];
  out.op = KRYCIE[buf[o + 11] & 3]; out.kind = (buf[o + 11] >> 2) & 3;
  return out;
}

/**
 * Odtwarza pociągnięcia [od, do) na płótnie C pędzlem P (ziarno = numer pociągnięcia).
 * @param {Uint8Array} buf rekordy @param {Float32Array} [Hb] grubość farby
 */
export function odtworz(P, C, buf, od, doo, Hb) {
  const s = {};
  for (let i = od; i < doo; i++) {
    odczytaj(buf, i, s);
    P.maluj(C, s.x, s.y, s.ang, s.len, s.wid, s.bend, s.op, s.kind, i, s.r, s.g, s.b, 0, 1, Hb);
  }
}

/** Puste płótno w kolorze gruntu. */
export function plotno(PW, PH, grunt) {
  const C = new Float32Array(PW * PH * 3);
  for (let i = 0; i < PW * PH; i++) { C[i * 3] = grunt[0]; C[i * 3 + 1] = grunt[1]; C[i * 3 + 2] = grunt[2]; }
  return C;
}

/**
 * Światło na fakturze: z koloru C i grubości farby Hb robi obraz 8-bit RGBA.
 * Faktura jest najpierw lekko wygładzana (farba się zlewa), potem oświetlana z lewej góry;
 * splot płótna prześwituje tam, gdzie farby jest mało. sila = 0 daje czysty kolor.
 * @param {{sila?:number, splot?:number, polysk?:number, kat?:number}} [o]
 * @param {{x:number,y:number,w:number,h:number}} [rect] tylko ten prostokąt (px)
 */
export function oswietl(C, Hb, PW, PH, S, out, o = {}, rect) {
  const sila = o.sila ?? 1, splot = o.splot ?? 1, polysk = o.polysk ?? 1, kat = o.kat ?? -2.3;
  const X0 = rect ? Math.max(0, rect.x) : 0, Y0 = rect ? Math.max(0, rect.y) : 0;
  const X1 = rect ? Math.min(PW, rect.x + rect.w) : PW, Y1 = rect ? Math.min(PH, rect.y + rect.h) : PH;
  if (!(sila > 0) || !Hb) {
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
      const j = (y * PW + x) * 3, q = (y * PW + x) * 4;
      out[q] = C[j]; out[q + 1] = C[j + 1]; out[q + 2] = C[j + 2]; out[q + 3] = 255;
    }
    return out;
  }
  const lx = Math.cos(kat) * 0.78, ly = Math.sin(kat) * 0.78, lz = 0.62;      // światło z lewej góry, nisko
  const hx = lx, hy = ly, hz = lz + 1, hn = 1 / Math.hypot(hx, hy, hz), plasko = hz * hn;
  // wysokość w oknie z marginesem: farba (wygładzona) + splot płótna, który ginie pod grubą farbą
  const r = Math.max(1, Math.round(0.55 * S)), m = r + 1;
  const ax = Math.max(0, X0 - m), ay = Math.max(0, Y0 - m), bx = Math.min(PW, X1 + m), by = Math.min(PH, Y1 + m);
  const w = bx - ax, h = by - ay, A = new Float32Array(w * h), T = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) A[y * w + x] = Hb[(ay + y) * PW + ax + x];
  const usrednij = (src, dst, dx, dy) => {             // rozmycie pudełkowe w jednym kierunku
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k * dx, yy = y + k * dy; if (xx >= 0 && xx < w && yy >= 0 && yy < h) { s += src[yy * w + xx]; n++; } }
      dst[y * w + x] = s / n;
    }
  };
  usrednij(A, T, 1, 0); usrednij(T, A, 0, 1);
  const kw = Math.PI * 2 / (2.6 * S);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hb = A[y * w + x];
    // splot płócienny: nitki osnowy i wątku (siatka wzdłuż osi, nie po skosie)
    A[y * w + x] = hb + splot * 0.045 * (Math.cos((ax + x) * kw) + Math.cos((ay + y) * kw)) * (1 - Math.min(1, hb * 1.3));
  }
  const gs = S * 0.5 * 0.55 * sila;
  for (let y = Y0; y < Y1; y++) {
    const yy = y - ay, yu = yy > 0 ? yy - 1 : yy, yd = yy < h - 1 ? yy + 1 : yy;
    for (let x = X0; x < X1; x++) {
      const xx = x - ax, xl = xx > 0 ? xx - 1 : xx, xr = xx < w - 1 ? xx + 1 : xx;
      const gx = (A[yy * w + xr] - A[yy * w + xl]) * gs, gy = (A[yd * w + xx] - A[yu * w + xx]) * gs;
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      let f = (-gx * lx - gy * ly + lz) * inv / lz;
      if (f < 0.4) f = 0.4;
      let nh = ((-gx * hx - gy * hy + hz) * inv * hn - plasko) / (1 - plasko), sp = 0;
      if (nh > 0) { nh *= nh; sp = 38 * polysk * nh * nh; }
      const j = (y * PW + x) * 3, q = (y * PW + x) * 4;
      out[q] = C[j] * f + sp; out[q + 1] = C[j + 1] * f + sp; out[q + 2] = C[j + 2] * f + sp; out[q + 3] = 255;
    }
  }
  return out;
}
