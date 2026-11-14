// suche.js — narzędzia na papierze: ołówek, kredka, węgiel, pastel sucha i olejna, tusz, biel,
// rozcieranie palcem i farba wodna (akwarela, lawowanie). Jedna implementacja dla Node i pracowni (film kładzie te same ślady).
//
// Dlaczego to wygląda na rysunek ręczny, a nie na wektor:
//   - papier ma ZIARNO (mapa wysokości włókien). Suchy pigment łapie najpierw szczyty; im mocniejszy
//     nacisk, tym głębiej wchodzi w doliny. Lekka kreska jest więc ziarnista i prześwituje papier,
//   - ziarno się WYPEŁNIA: kolejne warstwy (zwłaszcza woskowe) kładą się coraz gładziej,
//   - pigment przezroczysty MNOŻY kolor pod spodem (żółta kredka na niebieskiej daje zieleń),
//     kryjący (pastel, biel) go zasłania; każde narzędzie ma swoje proporcje,
//   - ślad to ścieżka z NACISKIEM: ręka drży, kreska zaczyna się i kończy lżej, nacisk faluje.
//   - farba WODNA nie zna ziarna-progu: wchodzi w doliny, w nich osiada gęściej (granulacja), jedna plama
//     ma równy ton i ciemniejszy brzeg, a kolejne plamy przeświecają przez siebie jak laserunki.
//
// Wszystko w jednostkach roboczych (jak pędzel), więc rysunek renderuje się w dowolnej skali.

import { hasz } from './pedzel.js';
import { szum } from './szkic.js';

/**
 * Narzędzia. szer — szerokość śladu przy pełnym nacisku; sila — ile pigmentu zostaje w jednym
 * przejściu; krycie — 0 przezroczysty (mnoży) … 1 kryjący; ziarno — jak mocno widać papier;
 * wypelnia — jak szybko zalepia ziarno; miekko — miękkość brzegu (ułamek półszerokości);
 * drganie — drżenie ręki (jednostki); nierowno — falowanie nacisku; stozek — ciemniejszy środek kreski.
 */
export const NARZEDZIA = {
  olowek: { szer: 1.2, sila: 0.70, krycie: 0.10, ziarno: 0.75, wypelnia: 0.25, miekko: 0.55, drganie: 0.30, nierowno: 0.35, stozek: 0.4 },
  kredka: { szer: 1.9, sila: 0.55, krycie: 0.08, ziarno: 0.72, wypelnia: 0.45, miekko: 0.60, drganie: 0.35, nierowno: 0.40, stozek: 0.3 },
  wegiel: { szer: 6.0, sila: 0.80, krycie: 0.45, ziarno: 0.95, wypelnia: 0.06, miekko: 0.75, drganie: 0.55, nierowno: 0.60, stozek: 0.1 },
  pastel: { szer: 9.0, sila: 0.85, krycie: 0.86, ziarno: 0.78, wypelnia: 0.30, miekko: 0.45, drganie: 0.50, nierowno: 0.50, stozek: 0 },
  olejna: { szer: 7.0, sila: 0.92, krycie: 0.92, ziarno: 0.50, wypelnia: 0.60, miekko: 0.35, drganie: 0.45, nierowno: 0.35, stozek: 0 },
  tusz: { szer: 0.9, sila: 1.00, krycie: 0.90, ziarno: 0.06, wypelnia: 0.50, miekko: 0.35, drganie: 0.22, nierowno: 0.25, stozek: 0 },
  biel: { szer: 1.3, sila: 0.95, krycie: 1.00, ziarno: 0.15, wypelnia: 0.50, miekko: 0.40, drganie: 0.25, nierowno: 0.30, stozek: 0 },
  palec: { szer: 12.0, sila: 0.55, rozciera: 1, miekko: 0.9, drganie: 0.6, nierowno: 0.3 },
  // farba wodna (mokre: 1): nacisk to ilość pigmentu w wodzie, nie siła ręki; ziarno — granulacja (pigment
  // osiada w dolinach papieru), brzeg — ciemniejsza obwódka plamy (pigment spływa do krawędzi i tam schnie)
  akwarela: { szer: 14.0, sila: 0.50, krycie: 0, ziarno: 0.30, wypelnia: 0, miekko: 0.14, drganie: 0.9, nierowno: 0.30, mokre: 1, brzeg: 0.55 },
  lawowanie: { szer: 30.0, sila: 0.42, krycie: 0, ziarno: 0.35, wypelnia: 0, miekko: 0.85, drganie: 1.4, nierowno: 0.35, mokre: 1, brzeg: 0 },
};
export const NAZWY = Object.keys(NARZEDZIA);
/** Nazwy narzędzi do pokazania człowiekowi. */
export const ETYKIETY = { olowek: 'ołówek', kredka: 'kredka', wegiel: 'węgiel', pastel: 'pastel', olejna: 'pastel olejna', tusz: 'tusz', biel: 'biel', palec: 'palec', akwarela: 'akwarela', lawowanie: 'akwarela, lawowanie' };

const fbm1 = (x, z) => 0.6 * szum(x, 0.5, z) + 0.3 * szum(x * 2.3, 1.5, z + 7) + 0.1 * szum(x * 5.1, 2.5, z + 13);

/**
 * Kartka papieru W × H jednostek w skali S (px na jednostkę).
 * @param {{kolor?:number[], ziarno?:number, seed?:number}} [papier] kolor arkusza, siła faktury 0..1.5
 */
export function Kartka(W, H, S, papier = {}) {
  const PW = Math.round(W * S), PH = Math.round(H * S), N = PW * PH;
  const kol = papier.kolor ?? [244, 238, 226], kz = papier.ziarno ?? 1, seed = papier.seed ?? 7;
  const C = new Float32Array(N * 3), Z = new Float32Array(N), F = new Float32Array(N);
  const ID = new Int32Array(N).fill(-1), MX = new Float32Array(N);
  // ziarno papieru: drobne grudki + grubsza faktura + pojedyncze włókna; wartości rozciągnięte do 0..1
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const u = (x + 0.5) / S, v = (y + 0.5) / S;
    let z = 0.50 * szum(u / 0.85, v / 0.85, seed) + 0.32 * szum(u / 2.4, v / 2.4, seed + 3) + 0.18 * szum(u / 7, v / 7, seed + 5);
    z += 0.10 * (szum(u / 14 + v / 3.1, v / 0.6 - u / 9, seed + 9) - 0.5);
    z = (z - 0.5) * 1.8 * kz + 0.5;
    const i = y * PW + x; Z[i] = z < 0 ? 0 : z > 1 ? 1 : z;
    const t = 1 - 0.035 * kz * (1 - Z[i]) + 0.006 * (szum(u / 30, v / 30, seed + 11) - 0.5);   // doliny minimalnie ciemniejsze
    C[i * 3] = kol[0] * t; C[i * 3 + 1] = kol[1] * t; C[i * 3 + 2] = kol[2] * t;
  }
  const C0 = Float32Array.from(C);
  const o = { W, H, S, PW, PH, C, Z, F, kolor: kol, x0: 0, y0: 0, x1: 0, y1: 0 };
  let nrSladu = 0;
  /** Czysta kartka od nowa (film cofnięty na początek). */
  o.czysc = () => { C.set(C0); F.fill(0); ID.fill(-1); nrSladu = 0; };

  /**
   * Przygotowuje ślad: gładka krzywa przez punkty kontrolne, drżenie ręki, profil nacisku.
   * @param {Float32Array|number[]} pk punkty kontrolne [x, y, nacisk, …]
   * @returns {Float32Array} punkty gęste [x, y, nacisk, …] co ok. pół szerokości
   */
  function sciezka(nz, szer, pk, seed) {
    const n = pk.length / 3, out = [];
    const P = (i, c) => pk[Math.max(0, Math.min(n - 1, i)) * 3 + c];
    const krok = Math.max(0.6, szer * 0.45), z = (seed * 37) % 9973;
    let s = 0, px = P(0, 0), py = P(0, 1);
    for (let i = 0; i < Math.max(1, n - 1); i++) {
      const odc = Math.hypot(P(i + 1, 0) - P(i, 0), P(i + 1, 1) - P(i, 1)), m = Math.max(1, Math.ceil(odc / krok));
      for (let j = i ? 1 : 0; j <= m; j++) {
        const t = j / m, t2 = t * t, t3 = t2 * t;                    // Catmull–Rom
        const f = (c) => 0.5 * (2 * P(i, c) + (P(i + 1, c) - P(i - 1, c)) * t + (2 * P(i - 1, c) - 5 * P(i, c) + 4 * P(i + 1, c) - P(i + 2, c)) * t2 + (3 * P(i, c) - P(i - 1, c) - 3 * P(i + 1, c) + P(i + 2, c)) * t3);
        const x = f(0), y = f(1);
        s += Math.hypot(x - px, y - py); px = x; py = y;
        out.push(x, y, P(i, 2) + (P(i + 1, 2) - P(i, 2)) * t, s);
      }
    }
    const k = out.length / 4, res = new Float32Array(k * 3), cal = Math.max(1e-6, s);
    for (let i = 0; i < k; i++) {
      const a = Math.max(0, i - 1) * 4, b = Math.min(k - 1, i + 1) * 4;
      let tx = out[b] - out[a], ty = out[b + 1] - out[a + 1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const si = out[i * 4 + 3], u = si / cal;
      const boc = nz.drganie * ((fbm1(si / 16 + z, z) - 0.5) * 2 + 0.35 * (szum(si / 2.2, 3.5, z + 5) - 0.5) * 2);
      const koniec = Math.min(1, 0.45 + u / 0.10) * Math.min(1, 0.30 + (1 - u) / 0.14);     // lżej na wejściu i przy oderwaniu
      const fala = 1 + nz.nierowno * (fbm1(si / 9 + z * 1.7, z + 21) - 0.5) * 1.6;
      res[i * 3] = out[i * 4] - ty * boc; res[i * 3 + 1] = out[i * 4 + 1] + tx * boc;
      res[i * 3 + 2] = Math.max(0, Math.min(1, out[i * 4 + 2] * koniec * fala));
    }
    return res;
  }

  /**
   * Rysuje ślad narzędziem nz w kolorze kol przez punkty kontrolne pk; tA..tB — część długości (film).
   * Zostawia w o.x0..o.y1 prostokąt zmienionych pikseli. Kolejne części tego samego śladu podawaj
   * z tym samym `nr`, żeby miejsca styku nie dostały pigmentu dwa razy.
   */
  o.slad = (nz, kol, szer, pk, seed, tA = 0, tB = 1, nr = nrSladu++) => {
    const p = sciezka(nz, szer, pk, seed), k = p.length / 3;
    // odcinki dzielone bez zakładek: kolejne części śladu (film) dają razem dokładnie to, co całość
    const iA = Math.round(tA * (k - 1)), iB = Math.round(tB * (k - 1));
    const Tr = kol[0] / 255, Tg = kol[1] / 255, Tb = kol[2] / 255, kr = nz.krycie ?? 0, g = nz.ziarno ?? 0, stoz = nz.stozek ?? 0;
    const mokre = nz.mokre ?? 0, brz = (nz.brzeg ?? 0) * Math.min(1, szer / 9), zs = (seed * 13) % 977, wA = mokre ? 0.85 : 0.5, wB = mokre ? 0.25 : 0.6;
    let X0 = PW, Y0 = PH, X1 = 0, Y1 = 0;
    for (let q = iA; q < iB; q++) {
      const ax = p[q * 3], ay = p[q * 3 + 1], ap = p[q * 3 + 2], bx = p[q * 3 + 3], by = p[q * 3 + 4], bp = p[q * 3 + 5];
      const hwA = 0.5 * szer * (wA + wB * ap), hwB = 0.5 * szer * (wA + wB * bp), hm = Math.max(hwA, hwB);
      const mk = Math.max(0.45 / S, nz.miekko * hm), r = hm + mk;
      let x0 = Math.floor((Math.min(ax, bx) - r) * S), x1 = Math.ceil((Math.max(ax, bx) + r) * S);
      let y0 = Math.floor((Math.min(ay, by) - r) * S), y1 = Math.ceil((Math.max(ay, by) + r) * S);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > PW) x1 = PW; if (y1 > PH) y1 = PH;
      if (x1 <= x0 || y1 <= y0) continue;
      const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy || 1e-9, imk = 1 / mk;
      for (let y = y0; y < y1; y++) {
        const wy = (y + 0.5) / S - ay;
        for (let x = x0; x < x1; x++) {
          const wx = (x + 0.5) / S - ax;
          const tr = (wx * dx + wy * dy) / d2; let t = tr < 0 ? 0 : tr > 1 ? 1 : tr;
          const ex = wx - dx * t, ey = wy - dy * t, d = Math.sqrt(ex * ex + ey * ey), hw = hwA + (hwB - hwA) * t;
          let cov = (hw - d) * imk + 0.5; if (cov <= 0) continue; if (cov > 1) cov = 1;
          const pr = ap + (bp - ap) * t; if (pr <= 0.004) continue;
          const i = y * PW + x;
          if (nz.rozciera) {                                         // palec: uśrednia kolor z otoczenia, wygładza ziarno
            const a = cov * nz.sila * pr; if (ID[i] === nr && MX[i] >= a) continue; ID[i] = nr; MX[i] = a;
            const rr = Math.max(1, Math.round(szer * 0.22 * S)); let sr = 0, sg = 0, sb = 0, nn = 0;
            for (let m = 0; m < 8; m++) {
              const xx = x + Math.round(Math.cos(m * 0.785 + i) * rr), yy = y + Math.round(Math.sin(m * 0.785 + i) * rr);
              if (xx < 0 || yy < 0 || xx >= PW || yy >= PH) continue;
              const j = (yy * PW + xx) * 3; sr += C[j]; sg += C[j + 1]; sb += C[j + 2]; nn++;
            }
            const j = i * 3; C[j] += (sr / nn - C[j]) * a; C[j + 1] += (sg / nn - C[j + 1]) * a; C[j + 2] += (sb / nn - C[j + 2]) * a;
            F[i] += (1 - F[i]) * a * 0.5;
          } else if (mokre) {
            // plama farby wodnej: równy ton, ciemniejszy brzeg (tylko na obrysie plamy, nie na łączeniach
            // odcinków), granulacja w dolinach papieru i łagodne zacieki
            let a = cov * nz.sila * (0.08 + 0.92 * pr);
            if (brz > 0 && d < hw && ((tr >= 0 && tr <= 1) || (q === 0 && tr < 0) || (q === k - 2 && tr > 1))) { let rg = (d / hw - 0.6) * 2.5; if (rg > 0) { if (rg > 1) rg = 1; a *= 1 - 0.3 * brz + 1.3 * brz * rg * rg; } else a *= 1 - 0.3 * brz; } else if (brz > 0) a *= 1 - 0.3 * brz;
            a *= (1 + g * (0.5 - Z[i]) * 1.4) * (0.82 + 0.36 * szum((x + 0.5) / S / 11, (y + 0.5) / S / 11, zs));
            if (a < 0.003) continue; if (a > 0.98) a = 0.98;
            let da = a;
            if (ID[i] === nr) { if (a <= MX[i]) continue; da = (a - MX[i]) / (1 - MX[i] + 1e-6); MX[i] = a; } else { ID[i] = nr; MX[i] = a; }
            const j = i * 3;
            C[j] *= 1 - da * (1 - Tr); C[j + 1] *= 1 - da * (1 - Tg); C[j + 2] *= 1 - da * (1 - Tb);
          } else {
            if (stoz > 0) cov *= 1 - stoz * (d / hw) * (d / hw) * 0.8;
            // pigment sięga w doliny papieru tym głębiej, im mocniejszy nacisk i im bardziej ziarno jest już zalepione
            let zl = (Z[i] - (1 - pr * 1.08 - 0.6 * F[i])) * 2.6 + 0.5; zl = zl < 0 ? 0 : zl > 1 ? 1 : zl;
            const a = cov * nz.sila * (0.3 + 0.7 * pr) * (1 - g + g * zl);
            if (a < 0.003) continue;
            let da = a;
            if (ID[i] === nr) { if (a <= MX[i]) continue; da = (a - MX[i]) / (1 - MX[i] + 1e-6); MX[i] = a; } else { ID[i] = nr; MX[i] = a; }
            const am = da * (1 - kr), ao = da * kr, j = i * 3;
            C[j] = C[j] * (1 - am * (1 - Tr)) * (1 - ao) + kol[0] * ao;
            C[j + 1] = C[j + 1] * (1 - am * (1 - Tg)) * (1 - ao) + kol[1] * ao;
            C[j + 2] = C[j + 2] * (1 - am * (1 - Tb)) * (1 - ao) + kol[2] * ao;
            F[i] += (1 - F[i]) * da * nz.wypelnia;
          }
          if (x < X0) X0 = x; if (x >= X1) X1 = x + 1; if (y < Y0) Y0 = y; if (y >= Y1) Y1 = y + 1;
        }
      }
    }
    o.x0 = X0; o.y0 = Y0; o.x1 = X1; o.y1 = Y1;
    return nr;
  };
  /** Końcówka narzędzia w ułamku f długości śladu: { x, y, kat } (dla filmu). */
  o.czubek = (nz, szer, pk, seed, f) => {
    const p = sciezka(nz, szer, pk, seed), k = p.length / 3, q = Math.min(k - 1, Math.max(0, f * (k - 1))), i = Math.min(k - 2, Math.floor(q)), t = q - i;
    if (k < 2) return { x: p[0], y: p[1], kat: 0 };
    return { x: p[i * 3] + (p[i * 3 + 3] - p[i * 3]) * t, y: p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * t, kat: Math.atan2(p[i * 3 + 4] - p[i * 3 + 1], p[i * 3 + 3] - p[i * 3]) };
  };
  /** Obraz 8-bit RGBA (cały albo prostokąt). */
  o.piksele = (out = new Uint8ClampedArray(N * 4), x0 = 0, y0 = 0, x1 = PW, y1 = PH) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * PW + x; out[i * 4] = C[i * 3]; out[i * 4 + 1] = C[i * 3 + 1]; out[i * 4 + 2] = C[i * 3 + 2]; out[i * 4 + 3] = 255; }
    return out;
  };
  return o;
}

/** Ziarno śladu z jego numeru (powtarzalne). */
export const ziarnoSladu = (i) => (hasz(i * 2654435761 | 0) * 65535) | 0;
