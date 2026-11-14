// reka.js — malowanie „z ręki”: pociągnięcia podane wprost, bez wzoru i bez malarza-optymalizatora.
// Ten sam pędzel i ten sam plik obrazu, więc obraz z ręki ogląda się i filmuje tak samo.
// Przydaje się do własnych kompozycji z kilkudziesięciu–kilkuset świadomych pociągnięć
// oraz do akcentów dopisanych na końcu (błysk w oku, podpis).

import { Kod, KRYCIE, BAJTY, PLASKI } from './pedzel.js';
import { STYLE } from './style.js';

/**
 * @param {{W:number, H:number, grunt?:number[], tytul?:string, autor?:string, styl?:string}} o
 */
export function Reka(o) {
  const styl = STYLE[o.styl ?? 'olej'], rek = [], etapy = [];
  let biezacy = null;
  const zamknij = () => { if (biezacy) { biezacy.koniec = rek.length; etapy.push(biezacy); biezacy = null; } };
  return {
    /** Zaczyna etap: nazwa na liście pędzli, numer na trzonku, rodzaj pędzla (PLASKI, KOCI, OKRAGLY). */
    etap(nazwa, nr, pedzel = PLASKI) { zamknij(); biezacy = { nazwa, nr: String(nr), pedzel }; return this; },
    /**
     * Jedno pociągnięcie w jednostkach roboczych: środek x, y; kat (rad, 0 = w prawo, rośnie w dół);
     * dlugosc, szerokosc; wygiecie (−0,4..0,4 długości); kolor [r,g,b]; krycie 0..1 (4 stopnie).
     */
    pociagnij({ x, y, kat = 0, dlugosc, szerokosc, wygiecie = 0, kolor, krycie = 1 }) {
      if (!biezacy) this.etap('Z ręki', '8');
      let oc = 0; for (let k = 1; k < 4; k++) if (Math.abs(KRYCIE[k] - krycie) < Math.abs(KRYCIE[oc] - krycie)) oc = k;
      const pi = Math.PI, a = ((kat % pi) + pi) % pi;
      rek.push([Kod.xq(x), Kod.xq(y), Kod.aq(a), Kod.lq(Math.max(dlugosc, szerokosc * 0.8)), Kod.wq(szerokosc), Kod.bq(wygiecie),
        Math.round(kolor[0]), Math.round(kolor[1]), Math.round(kolor[2]), oc | (biezacy.pedzel << 2)]);
      return this;
    },
    /** Nagłówek i bajty do zapisania przez doTekstu(). */
    obraz() {
      zamknij();
      const bajty = new Uint8Array(rek.length * BAJTY);
      rek.forEach((c, i) => {
        const q = i * BAJTY;
        bajty[q] = c[0] & 255; bajty[q + 1] = c[0] >> 8; bajty[q + 2] = c[1] & 255; bajty[q + 3] = c[1] >> 8;
        bajty[q + 4] = c[2]; bajty[q + 5] = c[3]; bajty[q + 6] = c[4]; bajty[q + 7] = c[5] & 255;
        bajty[q + 8] = c[6]; bajty[q + 9] = c[7]; bajty[q + 10] = c[8]; bajty[q + 11] = c[9];
      });
      const naglowek = { W: o.W, H: o.H, grunt: o.grunt ?? [222, 212, 190], tytul: o.tytul ?? 'Bez tytułu', autor: o.autor ?? '', styl: o.styl ?? 'olej', cechy: styl.cechy, swiatlo: styl.swiatlo, etapy: etapy.map((e) => ({ ...e })) };
      return { naglowek, bajty };
    },
  };
}
