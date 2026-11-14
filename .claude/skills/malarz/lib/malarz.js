// malarz.js — malarz. Patrzy na wzór, patrzy na płótno i w kółko pyta:
// „gdzie obraz jest najbardziej nie taki i które jedno pociągnięcie naprawi najwięcej?”.
//
//   1. trzyma mapę błędu między płótnem a wzorem (ważoną mapą ważności),
//   2. losuje miejsce tam, gdzie błąd jest duży,
//   3. proponuje tam K0 pociągnięć (kierunek zwykle wzdłuż krawędzi wzoru),
//   4. dla każdego wylicza najlepszy kolor farby (najmniejsze kwadraty) i ile błędu zdejmie,
//   5. najlepsze poprawia MUT małymi zmianami i kładzie zwycięzcę,
//   6. etapami: od najszerszego pędzla do najcieńszego.
//
// Każdy kandydat jest najpierw zaokrąglany do tego, co mieści 12-bajtowy rekord, więc malarz
// ocenia dokładnie to pociągnięcie, które potem zobaczy widz. Przebieg jest deterministyczny
// (ziarno, bez zegara). Metoda: zachłanne malowanie pociągnięciami, jak w mona-lisa-js (MIT)
// i wcześniej u Hertzmanna (1998) i w `primitive` Fogle­mana; tu ze stylami, automatyczną
// mapą ważności, skupianiem drobnych pędzli i rodzajami pędzli.

import { Pedzel, Kod, KRYCIE, BAJTY, plotno, hasz } from './pedzel.js';
import { kierunki, szarosc, Los } from './pole.js';

/**
 * @param {object} o
 * @param {number} o.W @param {number} o.H rozmiar roboczy
 * @param {Float32Array} o.cel wzór, RGB 0..255 (W*H*3)
 * @param {Float32Array} [o.wagi] mapa ważności (W*H)
 * @param {number[]} [o.grunt] kolor gruntu
 * @param {object} [o.cechy] cechy pędzla (wlosie, suchosc, smugi)
 * @param {{nasycenie?:number, drganie?:number, rozszczep?:number}} [o.kolor] zmiana wyliczonego koloru (styl):
 *   nasycenie, drganie (cieplej/zimniej), rozszczep (odchylenie barwy przy tej samej jasności, puentylizm)
 */
export function Malarz(o) {
  const { W, H, cel: T } = o, N = W * H;
  const K0 = o.K0 ?? 28, MUT = o.MUT ?? 44, grunt = o.grunt ?? [222, 212, 190];
  const WT = o.wagi ?? new Float32Array(N).fill(1);
  const rnd = Los(o.ziarno ?? 1503);
  const B = Pedzel(W, H, 1, o.cechy), MA = B.MA, MS = B.MS;
  const C = plotno(W, H, grunt);
  const gray = szarosc(T, N);
  const POLA = [kierunki(gray, W, H, 1.2), kierunki(gray, W, H, 3), kierunki(gray, W, H, 8)];
  const nas = o.kolor?.nasycenie ?? 1, drg = o.kolor?.drganie ?? 0, roz = o.kolor?.rozszczep ?? 0;
  const maxL = Math.min(380, 0.55 * Math.max(W, H));

  // mapa błędu + siatka komórek G×G do losowania miejsca
  const E = new Float32Array(N), BR = new Float32Array(N).fill(1);
  const G = 4, GW = Math.ceil(W / G), GH = Math.ceil(H / G);
  const kom = new Float64Array(GW * GH), kum = new Float64Array(GW * GH);
  let suma = 0;
  const blad = (i) => { const j = i * 3, a = C[j] - T[j], b = C[j + 1] - T[j + 1], c = C[j + 2] - T[j + 2]; return WT[i] * (a * a + b * b + c * c); };
  function odswiez(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) E[y * W + x] = blad(y * W + x);
    const gx0 = (x0 / G) | 0, gy0 = (y0 / G) | 0, gx1 = Math.min(GW, Math.ceil(x1 / G)), gy1 = Math.min(GH, Math.ceil(y1 / G));
    for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
      let s = 0; const ye = Math.min(H, gy * G + G), xe = Math.min(W, gx * G + G);
      for (let y = gy * G; y < ye; y++) for (let x = gx * G; x < xe; x++) s += E[y * W + x] * BR[y * W + x];
      kom[gy * GW + gx] = s;
    }
  }
  function przelicz() { let s = 0; for (let i = 0; i < kom.length; i++) { s += kom[i]; kum[i] = s; } suma = s; }
  function wybierz() {
    const r = rnd() * suma; let lo = 0, hi = kum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (kum[m] < r) lo = m + 1; else hi = m; }
    const gx = lo % GW, gy = (lo / GW) | 0;
    let bx = 0, by = 0, be = -1;
    for (let k = 0; k < 4; k++) {
      const x = Math.min(W - 1, gx * G + ((rnd() * G) | 0)), y = Math.min(H - 1, gy * G + ((rnd() * G) | 0));
      const e = E[y * W + x]; if (e > be) { be = e; bx = x; by = y; }
    }
    return [bx + 0.5, by + 0.5];
  }

  const rekordy = [];   // tablice 10 kodów
  const konce = [];     // liczba pociągnięć po każdym etapie
  // zaokrąglenie kandydata do tego, co mieści rekord
  function przytnij(p) {
    p.xc = Kod.xq(p.x); p.x = Kod.xd(p.xc);
    p.yc = Kod.xq(p.y); p.y = Kod.xd(p.yc);
    p.ac = Kod.aq(p.ang); p.ang = Kod.ad(p.ac);
    p.wc = Kod.wq(p.wid); p.wid = Kod.wd(p.wc);
    if (p.len < p.wid * 0.8) p.len = p.wid * 0.8;
    if (p.len > maxL) p.len = maxL;
    p.lc = Kod.lq(p.len); p.len = Kod.ld(p.lc);
    p.bc = Kod.bq(p.bend); p.bend = Kod.bd(p.bc);
    p.op = KRYCIE[p.oc];
    return p;
  }
  const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  // najlepszy kolor dla tego kształtu i zmiana łącznego błędu (ujemna = lepszy obraz)
  function ocen(p, seed) {
    if (!B.maska(p.x, p.y, p.ang, p.len, p.wid, p.bend, p.op, p.kind, seed)) return 0;
    const { x0, y0, w, h } = B;
    let nr = 0, ng = 0, nb = 0, den = 0, k = 0, szczyt = 0;
    for (let y = 0; y < h; y++) {
      let i = (y0 + y) * W + x0, j = i * 3;
      for (let x = 0; x < w; x++, k++, i++, j += 3) {
        const a = MA[k]; if (a === 0) continue;
        if (a > szczyt) szczyt = a;
        const as = a * MS[k], ia = 1 - a, wa = WT[i] * as;
        den += wa * as;
        nr += wa * (T[j] - C[j] * ia); ng += wa * (T[j + 1] - C[j + 1] * ia); nb += wa * (T[j + 2] - C[j + 2] * ia);
      }
    }
    // ślad, którego siatka prawie nie łapie (wpada między środki pikseli), dostałby dziki kolor
    if (den < 1e-4 || szczyt < 0.5 * p.op) return 0;
    let r = nr / den, g = ng / den, b = nb / den;
    if (nas !== 1 || drg > 0) {           // styl: żywszy kolor, co pociągnięcie trochę cieplejszy albo zimniejszy
      const m = 0.3 * r + 0.59 * g + 0.11 * b, hs = Math.imul(seed + 1, 2654435761) ^ (p.xc * 31 + p.yc);
      const d = drg * (hasz(hs) - 0.5) * 2;
      r = m + (r - m) * nas + d * (hasz(hs + 1) - 0.3); g = m + (g - m) * nas + d * (hasz(hs + 2) - 0.5); b = m + (b - m) * nas + d * (hasz(hs + 3) - 0.7);
    }
    r = Math.round(c255(r)); g = Math.round(c255(g)); b = Math.round(c255(b));
    p.r = r; p.g = g; p.b = b;
    let d = 0; k = 0;
    for (let y = 0; y < h; y++) {
      let i = (y0 + y) * W + x0, j = i * 3;
      for (let x = 0; x < w; x++, k++, i++, j += 3) {
        const a = MA[k]; if (a === 0) continue;
        const as = a * MS[k], ia = 1 - a;
        let n, e = 0, t;
        n = C[j] * ia + r * as; if (n > 255) n = 255; t = n - T[j]; e += t * t;
        n = C[j + 1] * ia + g * as; if (n > 255) n = 255; t = n - T[j + 1]; e += t * t;
        n = C[j + 2] * ia + b * as; if (n > 255) n = 255; t = n - T[j + 2]; e += t * t;
        d += WT[i] * e - E[i];
      }
    }
    return d;
  }
  function poloz(p) {
    if (roz > 0 && p.wid < 20) {                      // szeroka podmalówka zostaje w kolorze wzoru
      // puentylizm: kolor rozszczepiony — każda kropka odchylona w inną stronę koła barw przy tej samej
      // jasności. Malarz wybiera kropkę według koloru wzoru, a odchylenie dostaje ona dopiero na płótnie,
      // więc nie da się go „odsiać” wyborem kandydata; z daleka kropki zlewają się z powrotem w kolor wzoru.
      const hs = Math.imul(rekordy.length + 7, 2246822519), kat = hasz(hs) * 6.2832, ile = roz * (0.45 + 0.55 * hasz(hs + 1));
      const u = Math.cos(kat) * ile, v = Math.sin(kat) * ile, dr = u, dg = -0.5 * u + 0.866 * v, db = -0.5 * u - 0.866 * v, dl = 0.3 * dr + 0.59 * dg + 0.11 * db;
      p.r = Math.round(c255(p.r + dr - dl)); p.g = Math.round(c255(p.g + dg - dl)); p.b = Math.round(c255(p.b + db - dl));
    }
    B.maluj(C, p.x, p.y, p.ang, p.len, p.wid, p.bend, p.op, p.kind, rekordy.length, p.r, p.g, p.b);
    odswiez(B.x0, B.y0, B.x0 + B.w, B.y0 + B.h);
    rekordy.push([p.xc, p.yc, p.ac, p.lc, p.wc, p.bc, p.r, p.g, p.b, p.oc | (p.kind << 2)]);
  }
  const kopia = (p) => ({ x: p.x, y: p.y, ang: p.ang, len: p.len, wid: p.wid, bend: p.bend, oc: p.oc, kind: p.kind, r: 0, g: 0, b: 0 });

  /**
   * Jeden etap: n pociągnięć pędzlem o szerokości w[0]..w[1].
   * @param {{w:number[], lr:number[], n:number, pedzel:number, skup?:number, pole?:number, prosto?:number, pelne?:number, rozrzut?:number, proby?:number}} e
   *   lr — długość jako wielokrotność szerokości; skup — potęga mapy ważności przy losowaniu miejsca
   *   (0 = cały obraz, 2 = prawie tylko ważne miejsca); pole — które pole kierunków (0 drobne … 2 ogólne);
   *   prosto — udział pociągnięć bez wygięcia; pelne — udział pełnego krycia; rozrzut — odchyłka kąta od krawędzi;
   *   proby — ile razy więcej prób niż pociągnięć wolno zrobić (domyślnie 3; kropki o odchylonej barwie częściej odpadają)
   */
  function etap(e) {
    const [wmin, wmax] = e.w, [lrmin, lrmax] = e.lr, kind = e.pedzel;
    const fld = POLA[e.pole ?? (wmax < 5 ? 0 : wmax < 20 ? 1 : 2)];
    const prosto = e.prosto ?? 0.4, pelne = e.pelne ?? 0.6, rozrzut = e.rozrzut ?? 0.22;
    const skup = e.skup ?? 0;
    if (skup > 0) { let mx = 0; for (let i = 0; i < N; i++) if (WT[i] > mx) mx = WT[i]; for (let i = 0; i < N; i++) BR[i] = Math.pow(WT[i] / mx, skup); } else BR.fill(1);
    odswiez(0, 0, W, H);
    const co = wmax > 20 ? 1 : wmax > 6 ? 4 : 16;
    let zrobione = 0, proby = 0, odPrzel = 1e9;
    while (zrobione < e.n && proby < e.n * (e.proby ?? 3)) {
      proby++;
      if (odPrzel >= co) { przelicz(); odPrzel = 0; }
      if (suma <= 0) break;
      const [px, py] = wybierz(), seed = rekordy.length;
      const fa = fld[(py | 0) * W + (px | 0)];
      let best = null, bd = 0;
      for (let i = 0; i < K0; i++) {
        const wid = wmin * Math.pow(wmax / wmin, rnd());
        const p = przytnij({
          x: px + rnd.gauss() * wid * 0.3, y: py + rnd.gauss() * wid * 0.3,
          ang: rnd() < 0.65 ? fa + rnd.gauss() * rozrzut : rnd() * Math.PI,
          len: wid * (lrmin + rnd() * (lrmax - lrmin)), wid,
          bend: rnd() < prosto ? 0 : (rnd() - 0.5) * 0.45, oc: rnd() < pelne ? 3 : (rnd() * 4) | 0, kind, r: 0, g: 0, b: 0,
        });
        const d = ocen(p, seed);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) continue;
      for (let i = 0; i < MUT; i++) {
        const p = kopia(best), m = (rnd() * 6) | 0, sc = i < MUT / 2 ? 1 : 0.45;
        if (m === 0) { p.x += rnd.gauss() * p.wid * 0.35 * sc; p.y += rnd.gauss() * p.wid * 0.35 * sc; }
        else if (m === 1) p.ang += rnd.gauss() * 0.22 * sc;
        else if (m === 2) p.len = Math.min(p.wid * lrmax * 1.6, p.len * Math.exp(rnd.gauss() * 0.28 * sc));
        else if (m === 3) p.wid = Math.min(wmax * 1.25, Math.max(wmin * 0.7, p.wid * Math.exp(rnd.gauss() * 0.2 * sc)));
        else if (m === 4) p.bend += rnd.gauss() * 0.09 * sc;
        else { p.oc = Math.max(0, Math.min(3, p.oc + (rnd() < 0.5 ? -1 : 1))); p.x += rnd.gauss() * p.wid * 0.15; p.y += rnd.gauss() * p.wid * 0.15; }
        przytnij(p);
        const d = ocen(p, seed);
        if (d < bd) { bd = d; best = p; }
      }
      poloz(best); zrobione++; odPrzel++;
    }
    konce.push(rekordy.length);
    return { zrobione, proby };
  }

  /** RMSE płótna względem wzoru (0..255), opcjonalnie w prostokącie. */
  function rmse(x0 = 0, y0 = 0, x1 = W, y1 = H) {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) {
      const d = Math.min(255, C[(y * W + x) * 3 + c]) - T[(y * W + x) * 3 + c]; s += d * d; n++;
    }
    return Math.sqrt(s / n);
  }

  /** Wszystkie pociągnięcia jako rekordy 12-bajtowe. */
  function bajty() {
    const out = new Uint8Array(rekordy.length * BAJTY);
    rekordy.forEach((c, i) => {
      const q = i * BAJTY;
      out[q] = c[0] & 255; out[q + 1] = c[0] >> 8; out[q + 2] = c[1] & 255; out[q + 3] = c[1] >> 8;
      out[q + 4] = c[2]; out[q + 5] = c[3]; out[q + 6] = c[4]; out[q + 7] = c[5] & 255;
      out[q + 8] = c[6]; out[q + 9] = c[7]; out[q + 10] = c[8]; out[q + 11] = c[9];
    });
    return out;
  }

  return { C, etap, rmse, bajty, konce, get ile() { return rekordy.length; } };
}
