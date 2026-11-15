// rysunek.js — rysunek narzędziami suchymi jako lista śladów: ręka (kreska, szraf, rozcieranie),
// zapis do bajtów i odtwarzanie. Ślad = narzędzie, kolor, szerokość, ziarno i punkty z naciskiem.
//
// Rekord śladu (zmienna długość): narzędzie u8, r, g, b, szerokość u8 (log), ziarno u16, n u8,
// potem n × (x u16, y u16, nacisk u8). Punkty są zaokrąglane już przy rysowaniu, więc film i podgląd
// odtwarzają dokładnie to, co powstało.

import { Kod } from './pedzel.js';
import { Kartka, NARZEDZIA, NAZWY, ziarnoSladu } from './suche.js';
import { Los } from './pole.js';

/** Początki rekordów śladów w buforze (do odtwarzania od dowolnego miejsca). */
export function indeks(bajty) {
  const od = [];
  for (let q = 0; q < bajty.length; q += 8 + 5 * bajty[q + 7]) od.push(q);
  return Uint32Array.from(od);
}
/** Odczytuje ślad zaczynający się w bajcie q. */
export function odczytajSlad(bajty, q, out = {}) {
  const n = bajty[q + 7], pk = new Float32Array(n * 3);
  for (let i = 0, p = q + 8; i < n; i++, p += 5) {
    pk[i * 3] = Kod.xd(bajty[p] | (bajty[p + 1] << 8)); pk[i * 3 + 1] = Kod.xd(bajty[p + 2] | (bajty[p + 3] << 8)); pk[i * 3 + 2] = bajty[p + 4] / 255;
  }
  out.nazwa = NAZWY[bajty[q]]; out.nz = NARZEDZIA[out.nazwa]; out.kol = [bajty[q + 1], bajty[q + 2], bajty[q + 3]];
  out.szer = Kod.wd(bajty[q + 4]); out.seed = bajty[q + 5] | (bajty[q + 6] << 8); out.pk = pk;
  let dl = 0; for (let i = 1; i < n; i++) dl += Math.hypot(pk[i * 3] - pk[i * 3 - 3], pk[i * 3 + 1] - pk[i * 3 - 2]);
  out.dl = dl;
  return out;
}
/** Odtwarza ślady [od, do) na kartce. */
export function odtworzSlady(kartka, bajty, ind, od, doo) {
  const s = {};
  for (let i = od; i < doo; i++) { odczytajSlad(bajty, ind[i], s); kartka.slad(s.nz, s.kol, s.szer, s.pk, s.seed); }
}

/**
 * Zapisuje jeden ślad do rekordu. Punkty są zaokrąglane do tego, co mieści rekord, a lista dłuższa niż
 * 255 punktów równo przerzedzana (krzywa i tak je wygładza) — zwracane `pk`, `szer` i `kol` to dokładnie
 * to, co potem odtworzy film, więc tym trzeba rysować.
 * @param {string} narzedzie @param {number[]} kolor @param {number[][]} punkty [[x, y, nacisk], …] @param {number} [szer] @param {number} seed
 * @returns {{b:Uint8Array, pk:Float32Array, szer:number, kol:number[], nz:object}|null} null, gdy punktów jest mniej niż 2
 */
export function zakodujSlad(narzedzie, kolor, punkty, szer, seed) {
  const nz = NARZEDZIA[narzedzie]; if (!nz) throw new Error(`nieznane narzędzie: ${narzedzie}`);
  if (punkty.length > 255) punkty = Array.from({ length: 255 }, (_, i) => punkty[Math.round(i * (punkty.length - 1) / 254)]);
  const n = punkty.length; if (n < 2) return null;
  const bajt = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(v))) : 0);
  const b = new Uint8Array(8 + 5 * n), pk = new Float32Array(n * 3), wc = Kod.wq(szer ?? nz.szer);
  b[0] = NAZWY.indexOf(narzedzie); b[1] = bajt(kolor[0]); b[2] = bajt(kolor[1]); b[3] = bajt(kolor[2]); b[4] = wc; b[5] = seed & 255; b[6] = (seed >> 8) & 255; b[7] = n;
  for (let i = 0, p = 8; i < n; i++, p += 5) {
    if (!Number.isFinite(punkty[i][0]) || !Number.isFinite(punkty[i][1])) throw new Error(`kreska: punkt ${i} nie ma współrzędnych (${punkty[i]})`);
    const x = Kod.xq(punkty[i][0]), y = Kod.xq(punkty[i][1]), pr = bajt((punkty[i][2] ?? 0.6) * 255);
    b[p] = x & 255; b[p + 1] = x >> 8; b[p + 2] = y & 255; b[p + 3] = y >> 8; b[p + 4] = pr;
    pk[i * 3] = Kod.xd(x); pk[i * 3 + 1] = Kod.xd(y); pk[i * 3 + 2] = pr / 255;
  }
  return { b, pk, szer: Kod.wd(wc), kol: [b[1], b[2], b[3]], nz };
}

/**
 * Rysunek: kartka robocza (skala 1, żeby rysownik widział, co już narysował) + lista śladów.
 * @param {{W:number, H:number, papier?:object, tytul?:string, autor?:string, styl?:string, ziarno?:number}} o
 */
export function Rysunek(o) {
  const papier = { kolor: [244, 238, 226], ziarno: 1, seed: 7, ...o.papier };
  const kartka = Kartka(o.W, o.H, 1, papier), rnd = Los(o.ziarno ?? 2024), czesci = [], etapy = [];
  let ile = 0, biezacy = null;
  const zamknij = () => { if (biezacy && ile > (etapy.at(-1)?.koniec ?? 0)) { biezacy.koniec = ile; etapy.push(biezacy); } biezacy = null; };
  const api = {
    kartka,
    get ile() { return ile; },
    /** Zaczyna etap (pozycja na liście w filmie): nazwa i narzędzie, którym się w nim głównie rysuje. */
    etap(nazwa, narzedzie) { zamknij(); biezacy = { nazwa, narzedzie }; return api; },
    /**
     * Jedna kreska. punkty: [[x, y, nacisk], …] (nacisk 0..1, domyślnie 0.6); szer domyślnie z narzędzia.
     */
    kreska(narzedzie, kolor, punkty, szer) {
      const z = zakodujSlad(narzedzie, kolor, punkty, szer, ziarnoSladu(ile)); if (!z) return api;
      if (!biezacy) api.etap('Rysunek', narzedzie);
      kartka.slad(z.nz, z.kol, z.szer, z.pk, ziarnoSladu(ile));
      czesci.push(z.b); ile++;
      return api;
    },
    /**
     * Szrafowanie: równoległe kreski tam, gdzie ton(x, y) > próg; nacisk każdej kreski idzie za tonem,
     * więc szraf sam cieniuje. Ręka nie jest liniałem: odstęp, kąt, długość i łuk kresek są nierówne.
     * @param {(x:number, y:number) => number} ton 0..1 — ile pigmentu ma tu trafić
     * @param {{obszar?:number[], kat?:number, odstep?:number, dl?:number[], nacisk?:number, prog?:number, luk?:number, co?:number, szer?:number, staly?:number, poprzek?:number, kierunek?:(x:number,y:number)=>number}} [u]
     *   obszar [x0,y0,x1,y1]; kat (rad); odstep między kreskami; dl [min,max] długość kreski; nacisk — mnożnik;
     *   co — odstęp punktów kontrolnych; kierunek — zamiast stałego kąta kreska idzie za polem kierunków
     *   staly — tusz: kreska ma stały nacisk albo jej nie ma (ton robi gęstość kresek, nie nacisk);
     *   poprzek — szerokość pędzla: ton brany jako najmniejszy z całej szerokości śladu (szeroka plama
     *   przezroczystej farby nie wjedzie w jasne miejsce obok swojej osi)
     */
    szraf(ton, narzedzie, kolor, u = {}) {
      const nz = NARZEDZIA[narzedzie], [x0, y0, x1, y1] = u.obszar ?? [0, 0, o.W, o.H];
      const odstep = u.odstep ?? nz.szer * 1.5, [dmin, dmax] = u.dl ?? [28, 60], nac = u.nacisk ?? 1, prog = u.prog ?? 0.06, co = u.co ?? 6, luk = u.luk ?? 0.04;
      const pop = (u.poprzek ?? 0) * 0.36;
      const kat = u.kat ?? -0.95, c = Math.cos(kat), s = Math.sin(kat), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
      for (let v = -R; v < R; v += odstep * (0.75 + 0.5 * rnd())) {
        let t = -R - dmax * rnd();
        while (t < R) {
          const dl = dmin + (dmax - dmin) * rnd(), odch = (rnd() - 0.5) * 0.10, vv = v + (rnd() - 0.5) * odstep * 0.5;
          let ax = cx + c * t - s * vv, ay = cy + s * t + c * vv, k = kat + odch;
          if (u.kierunek) k = u.kierunek(ax, ay) + odch;
          const kc = Math.cos(k), ks = Math.sin(k), wyg = (rnd() - 0.5) * 2 * luk * dl, n = Math.max(2, Math.round(dl / co) + 1), pts = [];
          let mx = 0;
          for (let i = 0; i < n; i++) {
            const f = i / (n - 1), bok = wyg * 4 * f * (1 - f), x = ax + kc * dl * f - ks * bok, y = ay + ks * dl * f + kc * bok;
            let tn = x < x0 || y < y0 || x > x1 || y > y1 ? 0 : ton(x, y);
            if (pop > 0 && tn > 0) tn = Math.min(tn, ton(x - ks * pop, y + kc * pop), ton(x + ks * pop, y - kc * pop));
            if (tn > mx) mx = tn;
            pts.push([x, y, u.staly ? (tn > prog ? u.staly : 0) : Math.min(1, tn * nac)]);
          }
          // jasne miejsca dostają rzadsze kreski, nie tylko lżejsze
          if (mx > prog && rnd() < 0.25 + mx * 2.2) {
            let a = 0, b = n - 1; while (a < b && pts[a][2] < prog * 0.5) a++; while (b > a && pts[b][2] < prog * 0.5) b--;
            if (b - a >= 1) api.kreska(narzedzie, kolor, pts.slice(Math.max(0, a - 1), Math.min(n, b + 2)), u.szer);
          }
          t += dl * (0.8 + 0.3 * rnd());
        }
      }
      return api;
    },
    /** Nagłówek i bajty do zapisania przez doTekstu(). */
    obraz() {
      zamknij();
      let dl = 0; for (const b of czesci) dl += b.length;
      const bajty = new Uint8Array(dl); let q = 0; for (const b of czesci) { bajty.set(b, q); q += b.length; }
      return { naglowek: { rodzaj: 'rysunek', W: o.W, H: o.H, papier, tytul: o.tytul ?? 'Bez tytułu', autor: o.autor ?? '', styl: o.styl ?? 'z ręki', etapy: etapy.map((e) => ({ ...e })), ile }, bajty };
    },
  };
  return api;
}
