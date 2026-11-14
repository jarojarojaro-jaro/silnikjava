// rysownik.js — rysownik: rysuje wzór narzędziami suchymi tak, jak robi to człowiek.
//
//   1. szkic: lekkie linie ołówkiem po krawędziach wzoru,
//   2. kilkanaście „kredek” dobranych do wzoru (skupiska jego kolorów, zagęszczone jak pigment),
//   3. warstwy szrafu: przed każdą rundą rysownik patrzy na kartkę i na wzór i dla każdej kredki liczy,
//      gdzie i jak mocno poprawi rysunek (mapa tonu). O miejsce wygrywa kredka, która sama, warstwa po
//      warstwie, doszłaby najbliżej wzoru (kolor miejscowy); pigment przezroczysty nigdy nie schodzi
//      poniżej wzoru w żadnym kanale, bo nie da się go cofnąć. Szraf idzie za mapą naciskiem, a po
//      każdej rundzie rysownik sprawdza, ile z planu zostało na papierze, i poprawia rękę. Kolejne rundy
//      mają inny kąt, gęstsze i krótsze kreski; część prowadzi kreskę po formie (pole kierunków),
//   4. akcenty: ciemne kontury kolorem miejscowym i jasne światła bielą.
//
// Pętla jest zamknięta na prawdziwej kartce (skala 1): po każdej warstwie rysownik widzi, co
// naprawdę zostało na papierze — z ziarnem, przerwami między kreskami i mieszaniem pigmentów.

import { Rysunek } from './rysunek.js';
import { NARZEDZIA } from './suche.js';
import { rozmyj, szarosc, kierunki } from './pole.js';

/**
 * Style suche. runda: kat, odstep (× szerokość narzędzia), dl [min,max], nacisk, co (odstęp punktów),
 * szer (× szerokość), poForma — kreska idzie za polem kierunków (tam, gdzie wzór ma wyraźny rysunek),
 * zysk — o ile runda musi poprawić miejsce, żeby w ogóle tam rysować (późne rundy: wyżej, mniej kresek),
 * rysunek — runda tylko tam, gdzie wzór ma rysunek (detal), ostro — runda detalu dla pigmentu kryjącego:
 * rysownik porównuje kartkę ze wzorem prawie bez rozmycia (drobne kształty: oczy, okna),
 * ciemne — rysuje tylko n najciemniejszych kredek.
 * barw — ile kredek; moc — ile razy gęstszy jest pigment kredki od koloru, który ma dać (pełny kolor robi
 * się z kilku warstw); nasycenie — rysownik przesadza kolor wzoru jak człowiek; kal — ostrożność pierwszej
 * rundy (ułamek planu); wagaBarwy — o ile ważniejszy jest odcień od jasności; zapas — o ile poziomów kanał
 * może zejść poniżej wzoru. swiatla — rundy bieli na papierze tonowanym (zysk jak wyżej).
 */
export const STYLE_SUCHE = {
  kredki: {
    opis: 'kredki na jasnym papierze: warstwy szrafu, kolory mieszają się jak pigmenty',
    papier: { kolor: [246, 241, 230], ziarno: 1 }, narzedzie: 'kredka', barw: 16, moc: 1.4, nasycenie: 1.12, kal: 0.95, szkic: 'olowek', akcent: 'kredka',
    rundy: [
      { nazwa: 'Podkład', kat: -0.95, odstep: 0.8, dl: [40, 80], co: 8, szer: 1.7 },      // bokiem grafitu: miękki, ziarnisty ton
      { nazwa: 'Druga warstwa', kat: -0.30, odstep: 0.8, dl: [22, 46], co: 5, szer: 1.25 },
      { nazwa: 'Po formie', poForma: true, odstep: 0.9, dl: [10, 24], co: 3.5, szer: 0.85 },
      { nazwa: 'Dociemnienie', kat: -1.35, odstep: 0.9, dl: [8, 20], co: 3, szer: 0.7, zysk: 70 },
      { nazwa: 'Detal', poForma: true, odstep: 0.9, dl: [5, 12], co: 2.2, szer: 0.5, zysk: 110, rysunek: true },   // zaostrzoną kredką, tylko tam, gdzie wzór ma rysunek
    ],
  },
  pastele: {
    opis: 'suche pastele na tonowanym papierze: szerokie plamy bokiem pałeczki, potem krawędzią',
    papier: { kolor: [178, 164, 148], ziarno: 1.15 }, narzedzie: 'pastel', barw: 16, moc: 1, nasycenie: 1.2, kryjace: true, szkic: 'wegiel', akcent: 'wegiel', biel: 'pastel',
    swiatla: [{ poForma: true, szer: 0.3, odstep: 1.3, dl: [6, 18], co: 3, prog: 0.3, zysk: 900 }],        // biel tylko jako akcent
    rundy: [
      { nazwa: 'Plamy', kat: -0.9, odstep: 0.8, dl: [36, 80], nacisk: 0.85, co: 9, szer: 1.2 },
      { nazwa: 'Forma', kat: -0.2, odstep: 0.8, dl: [18, 40], nacisk: 1, co: 6, szer: 0.7 },
      { nazwa: 'Krawędzią', poForma: true, odstep: 0.9, dl: [8, 20], nacisk: 1.1, co: 3.5, szer: 0.36 },
      { nazwa: 'Detal', poForma: true, odstep: 0.9, dl: [4, 10], nacisk: 1.1, co: 1.8, szer: 0.2, ostro: true },   // rogiem pałeczki
    ],
  },
  wegiel: {
    opis: 'węgiel i biała kreda na szarym papierze: sam walor',
    papier: { kolor: [196, 190, 180], ziarno: 1.2 }, narzedzie: 'wegiel', mono: [34, 31, 30], szkic: 'wegiel', akcent: 'wegiel', biel: 'pastel',
    swiatla: [                                              // kreda kładziona jak węgiel: najpierw szeroko, potem krawędzią
      { kat: -0.95, szer: 0.75, odstep: 0.8, dl: [30, 70], co: 8, prog: 0.1, zysk: 250, nacisk: 0.8 },
      { poForma: true, szer: 0.3, odstep: 0.9, dl: [8, 20], co: 3.5, prog: 0.2, zysk: 400 },
    ],
    rundy: [
      { nazwa: 'Walor', kat: -0.95, odstep: 0.75, dl: [30, 70], nacisk: 0.8, co: 8 },
      { nazwa: 'Cienie', kat: -0.3, odstep: 0.7, dl: [16, 36], nacisk: 1, co: 5, szer: 0.6 },
      { nazwa: 'Po formie', poForma: true, odstep: 0.8, dl: [8, 20], nacisk: 1.15, co: 3.5, szer: 0.3 },
    ],
  },
  olowek: {
    opis: 'ołówek na białym papierze: szraf krzyżowy, sam walor',
    papier: { kolor: [248, 246, 240], ziarno: 0.9 }, narzedzie: 'olowek', mono: [58, 57, 62], szkic: 'olowek', akcent: 'olowek',
    rundy: [
      { nazwa: 'Szraf', kat: -0.95, odstep: 1.5, dl: [30, 64], nacisk: 0.8, co: 7 },
      { nazwa: 'Szraf krzyżowy', kat: 0.45, odstep: 1.3, dl: [20, 40], nacisk: 0.9, co: 5 },
      { nazwa: 'Po formie', poForma: true, odstep: 1.1, dl: [10, 22], nacisk: 1, co: 3.5 },
      { nazwa: 'Dociemnienie', kat: -1.4, odstep: 1.0, dl: [8, 18], nacisk: 1, co: 3 },
    ],
  },
};

/**
 * Kredki do wzoru: k kolorów możliwie różnych (najpierw najdalsze od siebie próbki, potem k-średnich
 * z wagą nasycenia), od najjaśniejszego. Mała plama czystego koloru (usta, turban) dostaje własną kredkę.
 */
export function paleta(T, N, k) {
  const pr = [];
  for (let i = 0; i < N; i += Math.max(1, Math.floor(N / 6000))) {
    const r = T[i * 3], g = T[i * 3 + 1], b = T[i * 3 + 2];
    pr.push([r, g, b, 0.3 + (Math.max(r, g, b) - Math.min(r, g, b)) / 255 * 3]);
  }
  const jas = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], d2 = (p, c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
  let c = [pr.reduce((a, p) => (p[3] > a[3] ? p : a)).slice(0, 3)];
  while (c.length < k) {                                   // następna kredka: próbka najdalsza od już wybranych
    let naj = pr[0], nd = -1;
    for (const p of pr) { let m = 1e9; for (const q of c) m = Math.min(m, d2(p, q)); if (m * p[3] > nd) { nd = m * p[3]; naj = p; } }
    c.push(naj.slice(0, 3));
  }
  for (let it = 0; it < 12; it++) {
    const s = c.map(() => [0, 0, 0, 0]);
    for (const p of pr) {
      let b = 0, bd = 1e9;
      for (let j = 0; j < k; j++) { const d = d2(p, c[j]); if (d < bd) { bd = d; b = j; } }
      s[b][0] += p[0] * p[3]; s[b][1] += p[1] * p[3]; s[b][2] += p[2] * p[3]; s[b][3] += p[3];
    }
    c = c.map((old, j) => (s[j][3] ? [s[j][0] / s[j][3], s[j][1] / s[j][3], s[j][2] / s[j][3]] : old));
  }
  return c.sort((a, b) => jas(b) - jas(a));
}

/** Linie wzdłuż krawędzi wzoru: [{ pts: [[x, y, siła 0..1], …] }], najmocniejsze najpierw. */
export function kontury(gray, W, H, maks = 2400, minDl = 9) {
  const N = W * H, g = rozmyj(gray, W, H, 1.3), G = new Float32Array(N), tx = new Float32Array(N), ty = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, gx = g[i + 1] - g[i - 1], gy = g[i + W] - g[i - W], m = Math.hypot(gx, gy);
    G[i] = m; if (m > 1e-6) { tx[i] = -gy / m; ty[i] = gx / m; }
  }
  const pr = Float32Array.from(G).sort(), hi = pr[Math.floor(N * 0.93)], lo = pr[Math.floor(N * 0.82)], top = pr[Math.floor(N * 0.995)] || 1;
  const ziarna = [];
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) if (G[y * W + x] > hi) ziarna.push(y * W + x);
  ziarna.sort((a, b) => G[b] - G[a]);
  const zaj = new Uint8Array(N), out = [];
  const idz = (x, y, zn) => {
    const pts = []; let dx = tx[(y | 0) * W + (x | 0)] * zn, dy = ty[(y | 0) * W + (x | 0)] * zn;
    for (let k = 0; k < 150; k++) {
      x += dx * 1.2; y += dy * 1.2;
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) break;
      const i = (y | 0) * W + (x | 0);
      if (G[i] < lo || zaj[i]) break;
      let nx = tx[i], ny = ty[i]; if (nx === 0 && ny === 0) break;         // płaskie pole: nie ma dokąd iść
      if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
      dx = nx; dy = ny; pts.push([x, y, Math.min(1, (G[i] - lo) / (top - lo))]);
    }
    return pts;
  };
  for (const z of ziarna) {
    if (zaj[z] || out.length >= maks) continue;
    const x = (z % W) + 0.5, y = ((z / W) | 0) + 0.5;
    const pts = [...idz(x, y, -1).reverse(), [x, y, Math.min(1, (G[z] - lo) / (top - lo))], ...idz(x, y, 1)];
    for (const p of pts) for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      const xx = (p[0] | 0) + a, yy = (p[1] | 0) + b; if (xx >= 0 && yy >= 0 && xx < W && yy < H) zaj[yy * W + xx] = 1;
    }
    if (pts.length * 1.2 >= minDl) out.push({ pts });
  }
  return out;
}

/**
 * Rysuje wzór w stylu suchym.
 * @param {{W:number, H:number, cel:Float32Array, styl:string, tytul?:string, autor?:string, ziarno?:number, papier?:object, szczegol?:number, log?:(s:string)=>void}} o
 * @returns {ReturnType<typeof Rysunek>} rysunek gotowy do obraz()
 */
export function rysuj(o) {
  const { W, H } = o, N = W * H, st = STYLE_SUCHE[o.styl], nz = NARZEDZIA[st.narzedzie], szcz = o.szczegol ?? 1;
  const T = Float32Array.from(o.cel);
  if (st.nasycenie) for (let i = 0; i < N; i++) { const m = 0.3 * T[i * 3] + 0.59 * T[i * 3 + 1] + 0.11 * T[i * 3 + 2]; for (let c = 0; c < 3; c++) T[i * 3 + c] = Math.max(0, Math.min(255, m + (T[i * 3 + c] - m) * st.nasycenie)); }
  if (st.mono) for (let i = 0; i < N; i++) T[i * 3] = T[i * 3 + 1] = T[i * 3 + 2] = 0.3 * T[i * 3] + 0.59 * T[i * 3 + 1] + 0.11 * T[i * 3 + 2];   // sam walor
  const r = Rysunek({ W, H, papier: { ...st.papier, ...o.papier }, tytul: o.tytul, autor: o.autor, styl: o.styl, ziarno: o.ziarno });
  const K = r.kartka, gray = szarosc(T, N), pole = kierunki(gray, W, H, 2.2);
  const kanal = (src, c) => { const k = new Float32Array(N); for (let i = 0; i < N; i++) k[i] = src[i * 3 + c]; return k; };
  const Tm = [0, 1, 2].map((c) => rozmyj(kanal(T, c), W, H, 1.2)), To = [0, 1, 2].map((c) => rozmyj(kanal(T, c), W, H, 0.6));
  const probka = (m, x, y) => {                          // dwuliniowo z mapy W×H
    const xx = Math.max(0, Math.min(W - 1.001, x - 0.5)), yy = Math.max(0, Math.min(H - 1.001, y - 0.5)), xi = xx | 0, yi = yy | 0, fx = xx - xi, fy = yy - yi, i = yi * W + xi;
    return m[i] * (1 - fx) * (1 - fy) + m[i + 1] * fx * (1 - fy) + m[i + W] * (1 - fx) * fy + m[i + W + 1] * fx * fy;
  };
  // dla jednej kredki: ile jej (0..1 pełnego przejścia) najbardziej zbliży kartkę do wzoru i jaki błąd zostanie
  const rozmyta = (sigma) => [0, 1, 2].map((c) => rozmyj(kanal(K.C, c), W, H, sigma));
  // błąd barwy: różnica RGB + osobno liczona różnica samej barwy (bez jasności). Bez tej wagi rysownik
  // „naprawia” jasność kredką o złym odcieniu i kolory szarzeją.
  const WB = st.wagaBarwy ?? 2, ZAPAS = st.zapas ?? 8, JAS = [0.3, 0.59, 0.11];
  const blad = (dr, dg, db) => { const l = 0.3 * dr + 0.59 * dg + 0.11 * db; return dr * dr + dg * dg + db * db + WB * ((dr - l) ** 2 + (dg - l) ** 2 + (db - l) ** 2); };
  // Jedna kredka w jednym miejscu: D — ile jej położyć w tej rundzie (ułamek pełnego przejścia), E — błąd,
  // jaki zostanie po tej rundzie, Ew — błąd, do jakiego ta kredka doszłaby SAMA, gdyby kłaść ją warstwami
  // do skutku. O miejsce wygrywa kredka z najmniejszym Ew: ta, która jest tu kolorem miejscowym. Wybór
  // według samego E brał najciemniejszą kredkę (zysk od razu), a ona zjadała zapas na właściwą barwę.
  function proba(kol, narz, Cb, Tb) {
    const D = new Float32Array(N), E = new Float32Array(N), Ew = new Float32Array(N), E0 = new Float32Array(N), kr = narz.krycie, Tk = kol.map((v) => v / 255), am = narz.sila * 0.95;
    const ostroznie = kr < 0.5, KR = ostroznie ? 24 : 6, d = am / 6, m = d * (1 - kr), ok = d * kr;
    const f0 = 1 - m * (1 - Tk[0]), f1 = 1 - m * (1 - Tk[1]), f2 = 1 - m * (1 - Tk[2]);
    for (let i = 0; i < N; i++) {
      let c0 = Cb[0][i], c1 = Cb[1][i], c2 = Cb[2][i]; const t0 = Tb[0][i], t1 = Tb[1][i], t2 = Tb[2][i];
      const e0 = blad(c0 - t0, c1 - t1, c2 - t2); let be = e0, bg = 0, e1 = e0;
      const l0 = Math.min(0, c0 - t0) - ZAPAS, l1 = Math.min(0, c1 - t1) - ZAPAS, l2 = Math.min(0, c2 - t2) - ZAPAS;   // dokąd wolno zejść
      for (let g = 1; g <= KR; g++) {
        if (ostroznie) { c0 = c0 * f0 * (1 - ok) + kol[0] * ok; c1 = c1 * f1 * (1 - ok) + kol[1] * ok; c2 = c2 * f2 * (1 - ok) + kol[2] * ok; }   // warstwa na warstwie
        else { const a = d * g, mm = a * (1 - kr), oo = a * kr; c0 = Cb[0][i] * (1 - mm * (1 - Tk[0])) * (1 - oo) + kol[0] * oo; c1 = Cb[1][i] * (1 - mm * (1 - Tk[1])) * (1 - oo) + kol[1] * oo; c2 = Cb[2][i] * (1 - mm * (1 - Tk[2])) * (1 - oo) + kol[2] * oo; }
        const d0 = c0 - t0, d1 = c1 - t1, d2 = c2 - t2;
        // pigmentu przezroczystego nie da się cofnąć: żaden kanał nie może zejść poniżej wzoru. Kredka o
        // złym odcieniu zatrzymuje się więc wcześnie, a resztę dokłada ta, która pochłania właściwą barwę.
        if (ostroznie && (d0 < l0 || d1 < l1 || d2 < l2)) break;
        const e = blad(d0, d1, d2);
        if (e < be) { be = e; bg = g; if (g <= 6) e1 = e; } else if (e > be * 1.5 + 50) break;
      }
      D[i] = Math.min(6, bg) / 6; E[i] = e1; Ew[i] = be; E0[i] = e0;
    }
    return { D, E, Ew, E0 };
  }
  // mapy tonu dla zestawu kredek: w każdym miejscu rysuje tylko ta, która trafia w kolor najlepiej.
  // Bez tego kredki o złym odcieniu „poprawiają” jasność (kolory idą w brąz), a podobne kredki
  // nakładają tę samą poprawkę kilka razy (rysunek wychodzi za ciemny). Mieszanie robi się między rundami.
  function tony(kredki, narz, minZysk = 30, ostro = false) {
    const Tb = ostro ? To : Tm, Cb = rozmyta(ostro ? 0.6 : 1.2), pr = kredki.map((k) => proba(k, narz, Cb, Tb)), naj = new Float32Array(N).fill(1e12);
    for (const p of pr) for (let i = 0; i < N; i++) if (p.Ew[i] < naj[i]) naj[i] = p.Ew[i];
    let plan = 0;
    const mapy = pr.map((p, nr) => {
      const kol = kredki[nr], kr = narz.krycie, am = narz.sila * 0.95;
      for (let i = 0; i < N; i++) {
        if (p.Ew[i] > naj[i] || p.E0[i] - p.E[i] <= minZysk) { p.D[i] = 0; continue; }   // jedna kredka na miejsce w rundzie: suchego pigmentu nie da się cofnąć
        const a = am * p.D[i], m = a * (1 - kr), ok = a * kr;
        for (let c = 0; c < 3; c++) plan += JAS[c] * Math.abs(Cb[c][i] - (Cb[c][i] * (1 - m * (1 - kol[c] / 255)) * (1 - ok) + kol[c] * ok));
      }
      return rozmyj(p.D, W, H, 0.8);
    });
    mapy.plan = plan; mapy.przed = Cb;
    return mapy;
  }
  // ile z planu naprawdę trafiło na kartkę (szraf ma przerwy i zakładki, ziarno łapie różnie): rysownik
  // sprawdza to po każdej rundzie i w następnej prowadzi rękę odpowiednio lżej albo mocniej
  let kal = st.kal ?? 0.95;
  const rozlicz = (mapy) => {
    if (!(mapy.plan > N * 0.02)) return;
    const po = rozmyta(1.2); let zrob = 0;
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) zrob += JAS[c] * Math.abs(mapy.przed[c][i] - po[c][i]);
    const ile = zrob / mapy.plan;
    kal = Math.max(0.35, Math.min(1.25, kal / Math.pow(Math.max(0.2, ile), 0.8)));
    o.log?.(`    plan wykonany w ${(ile * 100).toFixed(0)}%, następna runda × ${kal.toFixed(2)}`);
  };
  // nacisk, który zostawia zadany ułamek pełnego przejścia: odwrócenie wzoru śladu, średnio po ziarnie papieru
  const naciskDla = (narz) => {
    const zs = []; for (let i = 0; i < N; i += Math.max(1, Math.floor(N / 1500))) zs.push(K.Z[i]);
    const g = narz.ziarno ?? 0, tab = new Float32Array(33);
    for (let k = 0; k <= 32; k++) {
      const p = k / 32; let m = 0;
      for (const z of zs) { const zl = (z - (1 - p * 1.08 - 0.15)) * 2.6 + 0.5; m += zl < 0 ? 0 : zl > 1 ? 1 : zl; }
      tab[k] = (0.3 + 0.7 * p) * (1 - g + g * m / zs.length);
    }
    return (d) => { const cel = Math.max(0, Math.min(1, d)) * tab[32]; let k = 0; while (k < 32 && tab[k + 1] < cel) k++; return k >= 32 ? 1 : Math.min(1, (k + (cel - tab[k]) / Math.max(1e-6, tab[k + 1] - tab[k])) / 32); };
  };
  const jas = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  // gdzie wzór ma wyraźny rysunek (tam kreska idzie po formie; na gładkich polach trzyma kąt rundy)
  const wyr = (() => {
    const g = rozmyj(gray, W, H, 1.5), m = new Float32Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; m[i] = Math.hypot(g[i + 1] - g[i - 1], g[i + W] - g[i - W]); }
    const e = rozmyj(m, W, H, 3), prog = Float32Array.from(e).sort()[Math.floor(N * 0.6)];
    return (x, y) => e[Math.max(0, Math.min(H - 1, y | 0)) * W + Math.max(0, Math.min(W - 1, x | 0))] > prog;
  })();
  const poFormie = (kat) => (x, y) => (wyr(x, y) ? pole[Math.max(0, Math.min(H - 1, y | 0)) * W + Math.max(0, Math.min(W - 1, x | 0))] : kat);

  // 1. szkic
  const linie = kontury(gray, W, H, Math.round(2400 * szcz));
  const sz = NARZEDZIA[st.szkic];
  r.etap('Szkic', st.szkic);
  for (const l of linie) {
    const pts = l.pts.filter((_, i) => i % 4 === 0 || i === l.pts.length - 1).slice(0, 250).map((p) => [p[0], p[1], 0.14 + 0.3 * p[2]]);
    r.kreska(st.szkic, st.mono ?? [92, 88, 92], pts, sz.szer * (st.szkic === 'wegiel' ? 0.22 : 0.9));
  }
  o.log?.(`  Szkic: ${r.ile} linii`);

  // 2–3. kredki i warstwy szrafu. Kredka to pigment mocniejszy od koloru, który ma dać: jedno przejście
  // zostawia go tylko na szczytach ziarna, pełny kolor robi się z kilku warstw (moc = ile razy gęstszy).
  const K0 = r.kartka.kolor, pigment = (c, pap, moc) => (st.kryjace ? c.map((v) => Math.round(255 * Math.pow(v / 255, moc))) : c.map((v, j) => Math.round(255 * Math.pow(Math.min(1, v / pap[j]), moc))));
  let kredki = st.mono ? [st.mono] : paleta(T, N, st.barw).map((c) => pigment(c, K0, st.moc));
  if (st.kryjace) kredki = kredki.slice().reverse();          // pastel: od ciemnych do jasnych, światła na wierzchu
  const nac = naciskDla(nz);
  for (const ru of st.rundy) {
    const przed = r.ile; r.etap(ru.nazwa, st.narzedzie);
    // ciemne kredki rysują tylko tam, gdzie wygrywają ze wszystkimi — inaczej „poprawiałyby” jasność czernią
    const mapy = tony(kredki, nz, ru.zysk ?? (ru.ostro ? 120 : 30), ru.ostro), prog = ru.ciemne ? kredki.map(jas).sort((a, b) => a - b)[Math.min(kredki.length, ru.ciemne) - 1] : Infinity;
    kredki.forEach((kol, nr) => {
      if (jas(kol) > prog) return;
      const D = mapy[nr], ton = st.kryjace ? (x, y) => Math.pow(Math.min(1, probka(D, x, y) * 1.15), 0.62) : (x, y) => (ru.rysunek && !wyr(x, y) ? 0 : nac(probka(D, x, y) * kal));
      const szrafuj = (t, szer) => r.szraf(t, st.narzedzie, kol, {
        kat: ru.kat, odstep: szer * ru.odstep / Math.sqrt(szcz), dl: ru.dl, nacisk: ru.nacisk, co: ru.co, szer,
        kierunek: ru.poForma ? poFormie(-0.7) : undefined,
      });
      const szer = nz.szer * (ru.szer ?? 1);
      if (!st.kryjace && (ru.szer ?? 1) > 1) {
        // szeroka kreska przezroczystym pigmentem zalałaby drobne jasne kształty (oko, okno) na zawsze:
        // tam, gdzie wzór ma rysunek, podkład kładzie się wąsko
        szrafuj((x, y) => (wyr(x, y) ? 0 : ton(x, y)), szer);
        szrafuj((x, y) => (wyr(x, y) ? ton(x, y) : 0), nz.szer * 0.8);
      } else szrafuj(ton, szer);
    });
    o.log?.(`  ${ru.nazwa}: +${r.ile - przed} kresek`);
    if (!st.kryjace) rozlicz(mapy);
  }

  // 4. akcenty: kontury kolorem miejscowym (ciemniejszym), światła bielą
  const ak = NARZEDZIA[st.akcent]; let przed = r.ile;
  r.etap('Kontury', st.akcent);
  for (const l of linie.slice(0, Math.round(linie.length * 0.6))) {
    const s = l.pts[l.pts.length >> 1], kol = st.mono ?? [0, 1, 2].map((c) => Math.round(probka(Tm[c], s[0], s[1]) * 0.5));
    const pts = l.pts.filter((_, i) => i % 3 === 0 || i === l.pts.length - 1).slice(0, 250).map((p) => [p[0], p[1], 0.3 + 0.6 * p[2]]);
    r.kreska(st.akcent, kol, pts, ak.szer * (st.akcent === 'wegiel' ? 0.2 : 0.75));
  }
  o.log?.(`  Kontury: +${r.ile - przed}`);
  if (st.biel) {
    przed = r.ile; r.etap('Światła', st.biel);
    const b = NARZEDZIA[st.biel], biel = [255, 253, 246];
    for (const ru of st.swiatla) {
      const D = tony([biel], b, ru.zysk)[0], szer = b.szer * ru.szer;
      r.szraf((x, y) => Math.pow(probka(D, x, y), 0.7), st.biel, biel, { kat: ru.kat, odstep: szer * ru.odstep, dl: ru.dl, co: ru.co, szer, prog: ru.prog, nacisk: ru.nacisk, kierunek: ru.poForma ? poFormie(-0.7) : undefined });
    }
    o.log?.(`  Światła: +${r.ile - przed}`);
  }
  // jasność wzoru i rysunku (0..255): rysunek wyraźnie ciemniejszy od wzoru znaczy, że pigmentu jest za dużo
  const sr = (f) => { let m = 0; for (let i = 0; i < N; i++) m += f(i); return m / N; };
  o.log?.(`  jasność: wzór ${sr((i) => 0.3 * T[i * 3] + 0.59 * T[i * 3 + 1] + 0.11 * T[i * 3 + 2]).toFixed(0)}, rysunek ${sr((i) => 0.3 * K.C[i * 3] + 0.59 * K.C[i * 3 + 1] + 0.11 * K.C[i * 3 + 2]).toFixed(0)}`);
  return r;
}
