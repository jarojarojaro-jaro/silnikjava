// pracownia.js — pracownia: obraz powstaje na oczach widza. Jedna funkcja czasu klatka(t):
// maluje pociągnięcia do chwili t tym samym pędzlem co malarz, oświetla fakturę i rysuje
// wszystko dookoła (ściana, pędzel, lupa, paleta, lista pędzli, licznik). Kadr 1080 × 1920.
//
// Parametry strony: ?obraz=adres.json (albo window.OBRAZ z tekstem pliku), czas=30 (s malowania),
// koniec=3.5 (s na gotowy obraz), jakosc (nadpróbkowanie obrazu: 2 w filmie, 1 na żywo), szer=1080,
// film=1 (bez pętli: klatki zamawia film.mjs). Na żywo: spacja = pauza, R = od nowa.

import { Pedzel, odczytaj, plotno, oswietl, BAJTY, RODZAJE } from '../lib/pedzel.js';
import { zTekstu } from '../lib/plik.js';
import { Kartka, ETYKIETY } from '../lib/suche.js';
import { indeks, odczytajSlad } from '../lib/rysunek.js';
import { rysujPedzel, rysujOlowek } from './narzedzie.js';

const FW = 1080, FH = 1920, WSTEP = 0.9;
const q = new URLSearchParams(location.search);
const gladko = (a, b, x) => { x = (x - a) / (b - a); return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const h01 = (n) => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
const tys = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Skupiska kolorów pociągnięć (k-średnich, deterministycznie) → farby na palecie. */
function farby(buf, N, k = 9) {
  const pr = [], s = {};
  const krok = Math.max(1, Math.floor(N / 4000));
  for (let i = 0; i < N; i += krok) { odczytaj(buf, i, s); pr.push([s.r, s.g, s.b, Math.sqrt(s.len * s.wid)]); }
  pr.sort((a, b) => (0.3 * a[0] + 0.59 * a[1] + 0.11 * a[2]) - (0.3 * b[0] + 0.59 * b[1] + 0.11 * b[2]));
  let c = Array.from({ length: k }, (_, j) => pr[Math.floor((j + 0.5) / k * pr.length)].slice(0, 3));
  for (let it = 0; it < 14; it++) {
    const sum = c.map(() => [0, 0, 0, 0]);
    for (const p of pr) {
      let b = 0, bd = 1e9;
      for (let j = 0; j < k; j++) { const d = (p[0] - c[j][0]) ** 2 + (p[1] - c[j][1]) ** 2 + (p[2] - c[j][2]) ** 2; if (d < bd) { bd = d; b = j; } }
      sum[b][0] += p[0] * p[3]; sum[b][1] += p[1] * p[3]; sum[b][2] += p[2] * p[3]; sum[b][3] += p[3];
    }
    c = c.map((old, j) => (sum[j][3] > 0 ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : old));
  }
  return c;
}

// Dwa silniki o tym samym interfejsie: olej (pociągnięcia pędzla + światło na fakturze)
// i rysunek (ślady narzędzi suchych na papierze). Reszta pracowni nie wie, który pracuje.
function silnikOleju(n, buf, S) {
  const P = Pedzel(n.W, n.H, S, null, n.cechy), PW = P.PW, PH = P.PH, s = {}; let C, Hb;
  return {
    N: n.ile, PW, PH, margines: Math.ceil(S) + 2, jednostka: 'pociągnięć',
    waga(i) { odczytaj(buf, i, s); return Math.sqrt(s.len * s.wid); },
    srodek(i) { odczytaj(buf, i, s); return [s.x, s.y]; },
    odNowa() { C = plotno(PW, PH, n.grunt); Hb = new Float32Array(PW * PH); },
    kladz(k, a, b) {
      odczytaj(buf, k, s);
      P.maluj(C, s.x, s.y, s.ang, s.len, s.wid, s.bend, s.op, s.kind, k, s.r, s.g, s.b, a, b, Hb);
      return P.w > 0 ? [P.x0, P.y0, P.x0 + P.w, P.y0 + P.h] : null;
    },
    pokaz(out, r) { oswietl(C, Hb, PW, PH, S, out, n.swiatlo, r); },
    slad(i, f, o) {
      odczytaj(buf, i, s);
      const qq = 2 * f - 1, a = (f - 0.5) * s.len, bok = s.bend * s.len * 0.5 * (1 - qq * qq), c = Math.cos(s.ang), sn = Math.sin(s.ang);
      o.x = s.x + a * c - bok * sn; o.y = s.y + a * sn + bok * c; o.kier = s.ang;
      o.wid = s.wid; o.rodzaj = s.kind; o.r = s.r; o.g = s.g; o.b = s.b;
    },
    rekord: (i) => i * BAJTY,
    narzedzie: (ie) => `pędzel ${RODZAJE[n.etapy[ie].pedzel]}`,
    kolory: () => farby(buf, n.ile).map((c) => ({ c })),
  };
}
function silnikRysunku(n, buf, S) {
  const K = Kartka(n.W, n.H, S, n.papier), ind = indeks(buf), s = {};
  return {
    N: ind.length, PW: K.PW, PH: K.PH, margines: 0, jednostka: 'kresek',
    waga(i) { odczytajSlad(buf, ind[i], s); return (s.dl + 6) * Math.sqrt(0.5 + s.szer / 3); },
    srodek(i) { odczytajSlad(buf, ind[i], s); const m = (s.pk.length / 3) >> 1; return [s.pk[m * 3], s.pk[m * 3 + 1]]; },
    odNowa() { K.czysc(); },
    kladz(k, a, b) { odczytajSlad(buf, ind[k], s); K.slad(s.nz, s.kol, s.szer, s.pk, s.seed, a, b, k); return K.x1 > K.x0 ? [K.x0, K.y0, K.x1, K.y1] : null; },
    pokaz(out, r) { if (r) K.piksele(out, r.x, r.y, r.x + r.w, r.y + r.h); else K.piksele(out); },
    slad(i, f, o) {
      odczytajSlad(buf, ind[i], s);
      const c = K.czubek(s.nz, s.szer, s.pk, s.seed, f);
      o.x = c.x; o.y = c.y; o.kier = c.kat; o.wid = s.szer; o.rodzaj = s.nazwa; o.r = s.kol[0]; o.g = s.kol[1]; o.b = s.kol[2];
    },
    rekord: (i) => ind[i],
    narzedzie: (ie, o) => ETYKIETY[o.rodzaj],
    kolory() {                                   // piórnik: kredki w kolejności pierwszego użycia
      const m = new Map();
      for (let i = 0; i < ind.length && m.size < 14; i += Math.max(1, Math.floor(ind.length / 3000))) {
        odczytajSlad(buf, ind[i], s); if (s.nazwa === 'palec') continue;
        const k = `${s.nazwa}${s.kol}`; if (!m.has(k)) m.set(k, { c: s.kol.slice(), nazwa: s.nazwa });
      }
      return [...m.values()];
    },
  };
}

export async function pracownia(canvas) {
  const tekst = window.OBRAZ ?? await (await fetch(q.get('obraz'))).text();
  const { naglowek: n, bajty: buf } = zTekstu(tekst), RYS = n.rodzaj === 'rysunek';
  const CZAS = Number(q.get('czas') ?? 30), KONIEC = Number(q.get('koniec') ?? 3.5), JAK = Number(q.get('jakosc') ?? (q.has('film') ? 2 : 1));
  const szer = Number(q.get('szer') ?? FW), u = szer / FW;
  canvas.width = szer; canvas.height = Math.round(FH * u);
  const g = canvas.getContext('2d');
  await document.fonts.ready;

  // ---- układ: obraz u góry, na dole lupa, paleta i pędzle --------------------------------
  const pole = { x: 50, y: 196, w: 980, h: 1290 };
  const sk = Math.min(pole.w / n.W, pole.h / n.H), dw = n.W * sk, dh = n.H * sk;
  const dx = pole.x + (pole.w - dw) / 2, dy = pole.y + (pole.h - dh) / 2;
  const S = JAK * sk * u, E = RYS ? silnikRysunku(n, buf, S) : silnikOleju(n, buf, S), N = E.N, PW = E.PW, PH = E.PH;
  const img = new ImageData(PW, PH), off = new OffscreenCanvas(PW, PH), og = off.getContext('2d');

  // ---- rozkład czasu: szerokie i długie ślady trwają dłużej, pierwsze widać pojedynczo -------
  const kum = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) kum[i + 1] = kum[i] + E.waga(i) * (1 + 5 * Math.exp(-i / (RYS ? 40 : 12)));
  for (let i = 0; i <= N; i++) kum[i] *= CZAS / kum[N];
  const ktory = (tp) => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (kum[m] <= tp) lo = m; else hi = m - 1; } return lo; };
  const etapOd = (i) => { let k = 0; while (k < n.etapy.length - 1 && i >= n.etapy[k].koniec) k++; return k; };

  // gdzie praca była najdrobniejsza (mediana położeń ostatniego etapu): tam lupa zagląda na koniec
  const detal = (() => {
    const od = n.etapy.length > 1 ? n.etapy[n.etapy.length - 2].koniec : 0, xs = [], ys = [];
    for (let i = od; i < N; i += Math.max(1, Math.floor((N - od) / 2000))) { const [x, y] = E.srodek(i); xs.push(x); ys.push(y); }
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
    const kw = (t, f) => t[Math.floor(t.length * f)] ?? 0;
    return { x: kw(xs, 0.5) || n.W / 2, y: kw(ys, 0.5) || n.H / 2, rx: (kw(xs, 0.7) - kw(xs, 0.3)) / 2, ry: (kw(ys, 0.7) - kw(ys, 0.3)) / 2 };
  })();

  // ---- malowanie do chwili t (tylko do przodu; cofnięcie zaczyna od pustego płótna) ------
  let ile = 0, czesc = 0, ostatni = -1;
  function odNowa() { E.odNowa(); ile = 0; czesc = 0; E.pokaz(img.data); og.putImageData(img, 0, 0); }
  function malujDo(tp) {
    let i = N, f = 0;
    if (tp < CZAS) { i = ktory(tp); f = (tp - kum[i]) / (kum[i + 1] - kum[i]); }
    let x0 = PW, y0 = PH, x1 = 0, y1 = 0;
    const kladz = (k, a, b) => { const r = E.kladz(k, a, b); if (r) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); } };
    while (ile < i) { kladz(ile, czesc, 1); ile++; czesc = 0; }
    if (i < N && f > czesc) { kladz(i, czesc, f); czesc = f; }
    if (x1 > x0) {
      const m = E.margines, r = { x: Math.max(0, x0 - m), y: Math.max(0, y0 - m) };
      r.w = Math.min(PW, x1 + m) - r.x; r.h = Math.min(PH, y1 + m) - r.y;
      E.pokaz(img.data, r); og.putImageData(img, 0, 0, r.x, r.y, r.w, r.h);
    }
  }

  // ---- gdzie jest narzędzie w chwili tp (czysta funkcja czasu) ----------------------------
  const KAT0 = 0.95;                                           // trzonek w prawo w dół, jak w prawej ręce
  function czubek(tp, o) {
    const i = Math.min(N - 1, ktory(Math.max(0, Math.min(CZAS - 1e-6, tp))));
    const f = Math.min(1, Math.max(0, (tp - kum[i]) / (kum[i + 1] - kum[i])));
    E.slad(i, f, o);
    o.kat = Math.atan2(Math.sin(KAT0) - 0.35 * Math.sin(o.kier), Math.cos(KAT0) - 0.35 * Math.cos(o.kier));
    o.i = i; o.f = f; o.trwa = kum[i + 1] - kum[i];
    return o;
  }
  const A = {}, B2 = {}, D = {}, SKOK = 0.11;
  function pedzelW(tp) {
    czubek(tp, D);
    const wolno = gladko(0.05, 0.16, D.trwa);                 // długie pociągnięcie: pędzel idzie dokładnie po nim
    const k = Math.floor(tp / SKOK), e = gladko(0, 1, tp / SKOK - k);
    czubek(k * SKOK, A); czubek((k + 1) * SKOK, B2);
    const o = { ...D };
    o.x = lerp(lerp(A.x, B2.x, e), D.x, wolno); o.y = lerp(lerp(A.y, B2.y, e), D.y, wolno);
    o.kat = lerp(lerp(A.kat, B2.kat, e), D.kat, wolno);
    o.wid = lerp(lerp(A.wid, B2.wid, e), D.wid, wolno);
    const hop = Math.sin(Math.PI * e) * 0.45 * (1 - wolno);     // między dotknięciami pędzel się unosi
    const lad = wolno * (Math.max(0, 1 - D.f / 0.1) + Math.max(0, (D.f - 0.92) / 0.08)) * 0.5;
    o.unies = Math.min(1, hop + lad); o.nacisk = (1 - o.unies) * (0.55 + 0.45 * Math.sin(Math.PI * D.f));
    return o;
  }

  // ---- stałe elementy: ściana, paleta ----------------------------------------------------
  const sciana = new OffscreenCanvas(canvas.width, canvas.height);
  {
    const b = sciana.getContext('2d'), w = canvas.width, h = canvas.height;
    let gr = b.createRadialGradient(w * 0.42, h * 0.36, 0, w * 0.5, h * 0.45, h * 0.78);
    gr.addColorStop(0, '#3a322b'); gr.addColorStop(0.5, '#231e1a'); gr.addColorStop(1, '#0d0b0a');
    b.fillStyle = gr; b.fillRect(0, 0, w, h);
    const id = b.getImageData(0, 0, w, h), d = id.data;         // ziarno tynku
    for (let i = 0; i < w * h; i++) { const v = (h01(i * 2 + 1) - 0.5) * 9 + (h01((i >> 2) * 5 + 7) - 0.5) * 5; d[i * 4] += v; d[i * 4 + 1] += v; d[i * 4 + 2] += v; }
    b.putImageData(id, 0, 0);
    gr = b.createLinearGradient(0, 1500 * u, 0, h);              // blat pod obrazem
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.12, 'rgba(8,6,5,.55)'); gr.addColorStop(1, 'rgba(4,3,3,.82)');
    b.fillStyle = gr; b.fillRect(0, 1500 * u, w, h - 1500 * u);
  }
  const PAL = E.kolory(), PX = 548, PY = 1672;
  const kupki = PAL.map(({ c }, j) => { const a = Math.PI * (1.08 + 0.84 * (j / (PAL.length - 1))); return { c, x: PX + Math.cos(a) * 172 + 6, y: PY + Math.sin(a) * 98 + 18, r: 21 + 5 * h01(j + 3) }; });
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function rysujPalete(tp, kolor, maluje) {
    g.save(); g.scale(u, u);
    g.save(); g.translate(PX, PY); g.rotate(-0.06);
    g.filter = 'blur(14px)'; g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.ellipse(10, 22, 232, 142, 0, 0, 6.2832); g.fill(); g.filter = 'none';
    const ksztalt = () => { g.beginPath(); g.ellipse(0, 0, 228, 138, 0, 0, 6.2832); g.moveTo(-118 + 30, 62); g.ellipse(-118, 62, 30, 21, 0.3, 0, 6.2832, true); };
    let gr = g.createLinearGradient(-220, -130, 200, 140);
    gr.addColorStop(0, '#c08a4e'); gr.addColorStop(0.5, '#9a6634'); gr.addColorStop(1, '#6d4320');
    g.fillStyle = gr; ksztalt(); g.fill('evenodd');
    g.save(); ksztalt(); g.clip('evenodd');
    for (let k = 0; k < 26; k++) {                                // słoje
      const yy = -140 + 280 * h01(k * 13 + 1);
      g.strokeStyle = `rgba(60,32,10,${0.06 + 0.1 * h01(k + 40)})`; g.lineWidth = 1 + 2 * h01(k + 70);
      g.beginPath(); g.moveTo(-240, yy); g.bezierCurveTo(-80, yy + 14 * (h01(k + 5) - 0.5), 80, yy + 14 * (h01(k + 9) - 0.5), 240, yy + 8 * (h01(k + 2) - 0.5)); g.stroke();
    }
    g.restore();
    g.strokeStyle = 'rgba(255,225,170,.22)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 226, 136, 0, 3.4, 5.6); g.stroke();
    g.restore();
    // ślady mieszania: co chwilę kolor z pędzla zostawia smugę; starsze giną pod nowszymi
    const co = 0.22, ost = Math.floor(tp / co), t = {};
    for (let k = Math.max(0, ost - 22); k <= ost; k++) {
      czubek(k * co, t);
      const a = h01(k * 31 + 5) * 6.2832, rr = 58 * Math.sqrt(h01(k * 17 + 9));
      g.save(); g.translate(PX + 34 + Math.cos(a) * rr * 1.5, PY + 34 + Math.sin(a) * rr * 0.7); g.rotate(h01(k + 77) * 3.14);
      g.fillStyle = css([t.r, t.g, t.b], 0.9); g.beginPath(); g.ellipse(0, 0, 26 + 16 * h01(k + 3), 11 + 7 * h01(k + 8), 0, 0, 6.2832); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, -2, 18, 6, 0, 3.6, 5.6); g.stroke();
      g.restore();
    }
    // kupki farby; najbliższa kolorowi na pędzlu ma obwódkę
    let naj = 0, nd = 1e9;
    kupki.forEach((p, j) => { const d = (p.c[0] - kolor[0]) ** 2 + (p.c[1] - kolor[1]) ** 2 + (p.c[2] - kolor[2]) ** 2; if (d < nd) { nd = d; naj = j; } });
    kupki.forEach((p, j) => {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(p.x + 3, p.y + 5, p.r, p.r * 0.8, 0, 0, 6.2832); g.fill();
      const gr = g.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, 1, p.x, p.y, p.r * 1.1);
      gr.addColorStop(0, css(p.c.map((v) => Math.min(255, v * 1.25 + 26)))); gr.addColorStop(0.55, css(p.c)); gr.addColorStop(1, css(p.c.map((v) => v * 0.62)));
      g.fillStyle = gr; g.beginPath();
      for (let a = 0; a <= 16; a++) { const an = a / 16 * 6.2832, rr = p.r * (0.86 + 0.2 * h01(j * 50 + (a % 16))); g.lineTo(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr * 0.82); }
      g.closePath(); g.fill();
      if (j === naj && maluje) { g.strokeStyle = 'rgba(255,236,190,.95)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(p.x, p.y, p.r + 6, (p.r + 6) * 0.84, 0, 0, 6.2832); g.stroke(); }
    });
    g.restore();
  }

  // piórnik: kredki i pałeczki użyte w rysunku, ta w ręce jest wysunięta
  function rysujPiornik(kolor, nazwa, rysuje) {
    g.save(); g.scale(u, u);
    const x0 = 346, x1 = 760, y0 = 1560, y1 = 1790, k = PAL.length, sz = Math.min(30, (x1 - x0 - 24) / k);
    g.filter = 'blur(12px)'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x0 + 8, y0 + 40, x1 - x0, y1 - y0 - 20); g.filter = 'none';
    let gr = g.createLinearGradient(0, y0 + 30, 0, y1);
    gr.addColorStop(0, '#3a2b20'); gr.addColorStop(1, '#1f1610');
    g.fillStyle = gr; g.beginPath(); g.roundRect(x0, y0 + 34, x1 - x0, y1 - y0 - 34, 12); g.fill();
    g.strokeStyle = 'rgba(255,225,170,.18)'; g.lineWidth = 1.5; g.stroke();
    let naj = 0, nd = 1e9;
    PAL.forEach((p, j) => { const d = (p.c[0] - kolor[0]) ** 2 + (p.c[1] - kolor[1]) ** 2 + (p.c[2] - kolor[2]) ** 2 + (p.nazwa === nazwa ? 0 : 1e5); if (d < nd) { nd = d; naj = j; } });
    PAL.forEach((p, j) => {
      const cx = x0 + 12 + sz * (j + 0.5) + (x1 - x0 - 24 - sz * k) / 2, w = sz * 0.74, gruby = p.nazwa === 'pastel' || p.nazwa === 'wegiel' || p.nazwa === 'olejna';
      const top = y0 + 52 - (j === naj && rysuje ? 26 : 0) + 8 * h01(j * 7 + 1), dol = y1 - 14;
      gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      gr.addColorStop(0, css(p.c.map((v) => Math.min(255, v * 1.15 + 20)))); gr.addColorStop(0.5, css(p.c)); gr.addColorStop(1, css(p.c.map((v) => v * 0.6)));
      if (gruby) { g.fillStyle = gr; g.beginPath(); g.roundRect(cx - w / 2, top + 30, w, dol - top - 30, 3); g.fill(); g.fillStyle = 'rgba(245,238,225,.85)'; g.fillRect(cx - w / 2, top + 84, w, 46); }
      else {
        g.fillStyle = gr; g.fillRect(cx - w / 2, top + 44, w, dol - top - 44);
        g.fillStyle = '#e3c9a0'; g.beginPath(); g.moveTo(cx - w / 2, top + 44); g.lineTo(cx - w * 0.14, top + 12); g.lineTo(cx + w * 0.14, top + 12); g.lineTo(cx + w / 2, top + 44); g.closePath(); g.fill();
        g.fillStyle = css(p.c); g.beginPath(); g.moveTo(cx - w * 0.14, top + 12); g.lineTo(cx, top); g.lineTo(cx + w * 0.14, top + 12); g.closePath(); g.fill();
      }
      if (j === naj && rysuje) { g.strokeStyle = 'rgba(255,236,190,.9)'; g.lineWidth = 2; g.beginPath(); g.roundRect(cx - w / 2 - 3, top - 4, w + 6, dol - top + 6, 4); g.stroke(); }
    });
    g.restore();
  }

  function rysujLupe(px, py) {
    const X = 172 * u, Y = 1672 * u, R = 132 * u, pow = 4;
    const zr = (2 * R) / (pow * sk * u) * S;                    // bok źródła w pikselach bufora obrazu
    g.save();
    g.filter = `blur(${12 * u}px)`; g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(X + 6 * u, Y + 12 * u, R + 6 * u, 0, 6.2832); g.fill(); g.filter = 'none';
    g.beginPath(); g.arc(X, Y, R, 0, 6.2832); g.clip();
    g.fillStyle = '#14110f'; g.fillRect(X - R, Y - R, 2 * R, 2 * R);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(off, px * S - zr / 2, py * S - zr / 2, zr, zr, X - R, Y - R, 2 * R, 2 * R);
    let gr = g.createRadialGradient(X - R * 0.4, Y - R * 0.5, R * 0.1, X, Y, R);   // szkło
    gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.34)');
    g.fillStyle = gr; g.fillRect(X - R, Y - R, 2 * R, 2 * R);
    g.restore();
    gr = g.createLinearGradient(X - R, Y - R, X + R, Y + R);                       // mosiężna oprawka
    gr.addColorStop(0, '#f1d99a'); gr.addColorStop(0.35, '#a37f3a'); gr.addColorStop(0.6, '#5d4418'); gr.addColorStop(1, '#c9a658');
    g.strokeStyle = gr; g.lineWidth = 9 * u; g.beginPath(); g.arc(X, Y, R + 3 * u, 0, 6.2832); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5 * u; g.beginPath(); g.arc(X, Y, R - 1.5 * u, 0, 6.2832); g.stroke();
    g.fillStyle = '#8f8676'; g.font = `${19 * u}px Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('lupa ×4', X, Y + R + 36 * u);
  }

  function rysujListe(ie, kolor, gotowe) {
    g.save(); g.scale(u, u);
    const x = 796, y0 = 1548, dy2 = Math.min(44, 300 / n.etapy.length);
    g.textBaseline = 'middle';
    n.etapy.forEach((e, k) => {
      const y = y0 + k * dy2, po = gotowe || k < ie, teraz = !gotowe && k === ie, od = k ? n.etapy[k - 1].koniec : 0;
      g.globalAlpha = po ? 0.78 : teraz ? 1 : 0.34;
      if (teraz) { g.fillStyle = 'rgba(255,236,190,.09)'; g.beginPath(); g.roundRect(x - 12, y - dy2 / 2 + 2, 262, dy2 - 4, 8); g.fill(); }
      g.fillStyle = teraz ? '#f3e3bd' : '#cbbd9f'; g.font = `600 21px Caladea, Georgia, serif`; g.textAlign = 'left';
      if (RYS) g.fillText(e.nazwa, x, y);
      else { g.fillText(`No. ${e.nr}`, x, y); g.font = `19px Inter, sans-serif`; g.fillStyle = teraz ? '#efe6d2' : '#a79c87'; g.fillText(e.nazwa, x + 76, y); }
      g.textAlign = 'right';
      if (po) { g.fillStyle = '#c9a658'; g.font = `600 20px Inter, sans-serif`; g.fillText('✓', x + 246, y); }
      else if (teraz) { g.fillStyle = css(kolor); g.beginPath(); g.arc(x + 236, y, 8, 0, 6.2832); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2; g.stroke(); }
      else { g.fillStyle = '#8f8676'; g.font = `16px Inter, sans-serif`; g.fillText(tys(e.koniec - od), x + 246, y); }
    });
    g.restore();
  }

  // ---- klatka -----------------------------------------------------------------------------
  const CALY = WSTEP + CZAS + KONIEC;
  function klatka(t) {
    t = Math.max(0, Math.min(CALY, t));
    const tp = Math.max(0, Math.min(CZAS, t - WSTEP));
    if (ostatni < 0 || tp < ostatni) odNowa();
    malujDo(tp); ostatni = tp;
    const gotowe = t >= WSTEP + CZAS, kon = gladko(0, 1.6, t - WSTEP - CZAS);
    const o = pedzelW(Math.min(tp, CZAS - 1e-4)), ie = etapOd(Math.min(N - 1, ile));

    g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
    g.drawImage(sciana, 0, 0);
    if (kon > 0) {                                                 // lampa nad gotowym obrazem
      const gr = g.createRadialGradient((dx + dw / 2) * u, (dy - 40) * u, 0, (dx + dw / 2) * u, (dy + dh * 0.4) * u, dh * 0.95 * u);
      gr.addColorStop(0, `rgba(255,214,150,${0.2 * kon})`); gr.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = gr; g.fillRect(0, 0, canvas.width, canvas.height);
    }
    // tytuł
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#eadcbd'; g.font = `italic ${62 * u}px Caladea, Georgia, serif`; g.fillText(n.tytul, 540 * u, 104 * u);
    g.fillStyle = '#8f8676'; g.font = `${23 * u}px Inter, sans-serif`;
    g.fillText(`${n.autor ? n.autor + '  ·  ' : ''}${RYS ? 'rysowane kodem, kreska po kresce' : 'malowane kodem, pociągnięcie po pociągnięciu'}`, 540 * u, 150 * u);

    // obraz: cień na ścianie, bok podobrazia, płótno
    g.save();
    g.filter = `blur(${22 * u}px)`; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect((dx + 10) * u, (dy + 22) * u, dw * u, dh * u); g.filter = 'none';
    g.fillStyle = '#1a1512'; g.fillRect((dx - 3) * u, (dy - 3) * u, (dw + 6) * u, (dh + 6) * u);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(off, dx * u, dy * u, dw * u, dh * u);
    if (kon > 0) {
      const gr = g.createLinearGradient(0, dy * u, 0, (dy + dh) * u);
      gr.addColorStop(0, `rgba(255,226,170,${0.10 * kon})`); gr.addColorStop(0.6, 'rgba(255,226,170,0)');
      g.fillStyle = gr; g.fillRect(dx * u, dy * u, dw * u, dh * u);
    }
    g.restore();

    const kolor = [o.r, o.g, o.b];
    const lk = gladko(0.3, 2.4, t - WSTEP - CZAS);
    const tk = t - WSTEP - CZAS;                                   // na koniec lupa wolno krąży po detalu
    rysujLupe(lerp(o.x, detal.x + detal.rx * Math.sin(tk * 0.9), lk), lerp(o.y, detal.y - detal.ry * Math.cos(tk * 0.9), lk));
    if (RYS) rysujPiornik(kolor, o.rodzaj, !gotowe); else rysujPalete(tp, kolor, !gotowe);
    rysujListe(ie, kolor, gotowe);

    // pędzel: wchodzi z prawej z dołu, maluje, po ostatnim pociągnięciu odchodzi
    const wej = gladko(0, WSTEP, t), wyj = gladko(0, 0.9, t - WSTEP - CZAS);
    if (wyj < 1) {
      const tx = (dx + o.x * sk) * u, ty = (dy + o.y * sk) * u, poza = (1 - wej) + wyj;
      g.save();
      const wsp = { x: tx + poza * 420 * u, y: ty + poza * 520 * u, kat: o.kat, u, nacisk: poza > 0 ? 0 : o.nacisk, unies: Math.min(1, o.unies + poza * 2), kolor, alfa: 1 - wyj };
      if (RYS) rysujOlowek(g, { ...wsp, narzedzie: o.rodzaj, w: Math.max(3 * u, o.wid * sk * u) });
      else rysujPedzel(g, { ...wsp, w: Math.max(7 * u, o.wid * sk * u), rodzaj: o.rodzaj, nr: n.etapy[ie].nr });
      g.restore();
    }

    // stopka: licznik, bajty bieżącego pociągnięcia, pasek postępu
    g.save(); g.scale(u, u);
    const nr = Math.min(N, gotowe ? N : ile + 1);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = '#cbbd9f'; g.font = '600 22px Inter, sans-serif';
    g.fillText(`${tys(nr)}`, 50, 1888);
    const wl = g.measureText(tys(nr)).width;
    g.fillStyle = '#7d7566'; g.font = '20px Inter, sans-serif'; g.fillText(` / ${tys(N)} ${E.jednostka}  ·  ${E.narzedzie(ie, o)}`, 50 + wl, 1888);
    const q0 = E.rekord(Math.min(N - 1, nr - 1)); let hex = '';
    for (let k = 0; k < BAJTY; k++) hex += buf[q0 + k].toString(16).padStart(2, '0').toUpperCase() + (k < BAJTY - 1 ? ' ' : '');
    g.textAlign = 'right'; g.fillStyle = '#6f685b'; g.font = '17px "JetBrains Mono", monospace'; g.fillText(hex, 1030, 1888);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(50, 1902, 980, 3);
    g.fillStyle = '#c9a658'; g.fillRect(50, 1902, 980 * (gotowe ? 1 : nr / N), 3);
    g.restore();
  }

  odNowa();
  return { klatka, czas: CALY, canvas, naglowek: n };
}

const canvas = document.getElementById('kadr');
window.__malarz = { gotowy: pracownia(canvas).then((p) => { Object.assign(window.__malarz, p); return p; }) };
if (!q.has('film')) {                                       // oglądanie na żywo: spacja pauza, R od nowa
  window.__malarz.gotowy.then((p) => {
    let t = 0, gra = true, wtedy = performance.now();
    const krok = (teraz) => { if (gra) t = Math.min(p.czas, t + (teraz - wtedy) / 1000); wtedy = teraz; p.klatka(t); requestAnimationFrame(krok); };
    addEventListener('keydown', (e) => { if (e.key === ' ') gra = !gra; if (e.key === 'r' || e.key === 'R') { t = 0; gra = true; } });
    canvas.addEventListener('click', () => { if (t >= p.czas) t = 0; else gra = !gra; });
    requestAnimationFrame(krok);
  });
}
