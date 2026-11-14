// style.js — style malowania: jakie pędzle, ile pociągnięć, jak długie, jak żywy kolor.
// Etapy idą od najszerszego pędzla do najcieńszego. Szerokości są w jednostkach roboczych
// (obraz ma ok. 536 tys. jednostek², np. 600 × 894), liczby pociągnięć mnoży --szczegol.
// wygladz: rozmycie wzoru przed malowaniem (malarz nie kopiuje spękań, kurzu i szumu zdjęcia).

import { PLASKI, KOCI, OKRAGLY } from './pedzel.js';

/** Pole robocze obrazu (jednostki²): W × H dobierane z proporcji wzoru. */
export const POLE = 600 * 894;

export const STYLE = {
  // wierna kopia: aż do włosa, 62 tys. pociągnięć; z bliska widać pędzel, z daleka — oryginał
  kopia: {
    opis: 'wierna kopia, siedem pędzli aż do linera',
    cechy: { wlosie: 1, suchosc: 1, smugi: 1 },
    swiatlo: { sila: 0.35, splot: 0.7, polysk: 0.6 },
    etapy: [
      { nazwa: 'Podmalówka', nr: '40', pedzel: PLASKI, w: [60, 118], lr: [1.4, 3.6], n: 110 },
      { nazwa: 'Duże plamy', nr: '24', pedzel: PLASKI, w: [26, 60], lr: [1.4, 4.5], n: 420 },
      { nazwa: 'Forma', nr: '14', pedzel: KOCI, w: [12, 26], lr: [1.3, 5], n: 1300 },
      { nazwa: 'Modelunek', nr: '8', pedzel: KOCI, w: [6, 12], lr: [1.2, 6], n: 3600 },
      { nazwa: 'Rysunek', nr: '4', pedzel: OKRAGLY, w: [3, 6], lr: [1.1, 7], n: 9000 },
      { nazwa: 'Detal', nr: '1', pedzel: OKRAGLY, w: [1.6, 3], lr: [1, 8], n: 18000 },
      { nazwa: 'Wykończenie', nr: '000', pedzel: OKRAGLY, w: [0.8, 1.6], lr: [1, 9], n: 30000 },
    ],
  },
  // olej alla prima: widać pociągnięcia i fakturę; drobny pędzel tylko tam, gdzie patrzy oko
  olej: {
    opis: 'olej alla prima: widoczne pociągnięcia, gruba farba, detal tylko w ważnych miejscach',
    cechy: { wlosie: 1.25, suchosc: 1.1, smugi: 1.6 },
    swiatlo: { sila: 0.6, splot: 1, polysk: 1 },
    wygladz: 1.1,
    etapy: [
      { nazwa: 'Podmalówka', nr: '40', pedzel: PLASKI, w: [60, 118], lr: [1.4, 3.6], n: 100 },
      { nazwa: 'Duże plamy', nr: '24', pedzel: PLASKI, w: [26, 60], lr: [1.4, 4.5], n: 400 },
      { nazwa: 'Forma', nr: '14', pedzel: PLASKI, w: [12, 26], lr: [1.3, 5], n: 1300 },
      { nazwa: 'Modelunek', nr: '8', pedzel: KOCI, w: [6, 12], lr: [1.2, 5.5], n: 3200 },
      { nazwa: 'Rysunek', nr: '4', pedzel: KOCI, w: [3, 6], lr: [1.2, 6], n: 5500, skup: 0.7 },
      { nazwa: 'Akcenty', nr: '1', pedzel: OKRAGLY, w: [1.5, 3], lr: [1, 7], n: 4500, skup: 1.6 },
    ],
  },
  // impresjonizm: krótkie, grube dotknięcia czystym kolorem, bez wygładzania
  impresja: {
    opis: 'impresjonizm: krótkie, grube dotknięcia, żywy, rozedrgany kolor',
    cechy: { wlosie: 1.3, suchosc: 0.9, smugi: 2.2 },
    swiatlo: { sila: 0.75, splot: 0.8, polysk: 1.2 },
    wygladz: 1.5,
    kolor: { nasycenie: 1.22, drganie: 16 },
    etapy: [
      { nazwa: 'Podmalówka', nr: '40', pedzel: PLASKI, w: [50, 110], lr: [1.2, 2.6], n: 90, pelne: 0.8 },
      { nazwa: 'Duże plamy', nr: '24', pedzel: PLASKI, w: [22, 50], lr: [1.2, 2.8], n: 380, pelne: 0.8 },
      { nazwa: 'Plamy', nr: '14', pedzel: PLASKI, w: [11, 22], lr: [1.2, 3], n: 1500, pelne: 0.85, rozrzut: 0.35 },
      { nazwa: 'Dotknięcia', nr: '8', pedzel: KOCI, w: [6, 11], lr: [1.3, 3.2], n: 4200, pelne: 0.9, rozrzut: 0.35 },
      { nazwa: 'Światła', nr: '5', pedzel: KOCI, w: [3.5, 6], lr: [1.3, 3.4], n: 5200, pelne: 0.9, skup: 0.8, rozrzut: 0.35 },
    ],
  },
  // etiuda: kilkaset szerokich pociągnięć — sam układ plam i światła
  etiuda: {
    opis: 'etiuda: kilkaset szerokich pociągnięć, sam układ plam',
    cechy: { wlosie: 1.4, suchosc: 1.25, smugi: 1.8 },
    swiatlo: { sila: 0.7, splot: 1.2, polysk: 1 },
    wygladz: 2,
    etapy: [
      { nazwa: 'Podmalówka', nr: '40', pedzel: PLASKI, w: [60, 118], lr: [1.4, 3.6], n: 110 },
      { nazwa: 'Duże plamy', nr: '24', pedzel: PLASKI, w: [26, 60], lr: [1.4, 4.5], n: 380 },
      { nazwa: 'Forma', nr: '14', pedzel: PLASKI, w: [12, 26], lr: [1.3, 5], n: 700, skup: 0.6 },
    ],
  },
  // szpachla: farba kładziona nożem — proste, krótkie płaszczyzny, gruba faktura, prawie bez włosia
  szpachla: {
    opis: 'szpachla: krótkie, proste płaszczyzny gęstej farby, mocna faktura',
    cechy: { wlosie: 0.35, suchosc: 1.5, smugi: 2.6 },
    swiatlo: { sila: 1.0, splot: 0.6, polysk: 1.5 },
    wygladz: 1.6,
    kolor: { nasycenie: 1.12, drganie: 8 },
    etapy: [
      { nazwa: 'Podmalówka', nr: '40', pedzel: PLASKI, w: [60, 118], lr: [1.2, 2.4], n: 100, prosto: 1, pelne: 1 },
      { nazwa: 'Szeroka szpachla', nr: 'S5', pedzel: PLASKI, w: [24, 52], lr: [1.0, 2.2], n: 420, prosto: 1, pelne: 0.95, rozrzut: 0.5 },
      { nazwa: 'Szpachla', nr: 'S3', pedzel: PLASKI, w: [11, 24], lr: [1.0, 2.4], n: 1500, prosto: 1, pelne: 0.95, rozrzut: 0.45 },
      { nazwa: 'Mała szpachla', nr: 'S1', pedzel: PLASKI, w: [5, 11], lr: [1.0, 2.6], n: 3600, prosto: 0.9, pelne: 0.95, rozrzut: 0.4, skup: 0.6 },
      { nazwa: 'Krawędzią', nr: 'S0', pedzel: PLASKI, w: [2, 5], lr: [2, 6], n: 2600, prosto: 0.9, skup: 1.4 },
    ],
  },
  // puentylizm: same kropki; kolor każdej odchylony od wyliczonego, więc z bliska mienią się, z daleka zlewają
  punkty: {
    opis: 'puentylizm: obraz z kropek czystego koloru, które miesza dopiero oko',
    cechy: { wlosie: 0.8, suchosc: 0.5, smugi: 1.2 },
    swiatlo: { sila: 0.55, splot: 0.9, polysk: 0.8 },
    wygladz: 1.8,
    kolor: { nasycenie: 1.3, rozszczep: 36 },
    etapy: [
      { nazwa: 'Podmalówka', nr: '24', pedzel: PLASKI, w: [40, 90], lr: [1.2, 2.6], n: 200 },
      { nazwa: 'Duże kropki', nr: '10', pedzel: OKRAGLY, w: [10, 14], lr: [1, 1.15], n: 2400, pelne: 1, prosto: 1 },
      { nazwa: 'Kropki', nr: '6', pedzel: OKRAGLY, w: [6.5, 9], lr: [1, 1.15], n: 6500, pelne: 1, prosto: 1 },
      { nazwa: 'Drobne kropki', nr: '3', pedzel: OKRAGLY, w: [4, 6], lr: [1, 1.15], n: 9000, pelne: 1, prosto: 1, skup: 0.8 },
    ],
  },
};

/** Rozmiar roboczy z proporcji wzoru (szer./wys.), o stałym polu. */
export function rozmiarRoboczy(proporcja) {
  // środek pociągnięcia mieści się w rekordzie do ok. 1980 jednostek: skrajne panoramy odpadają
  if (!(proporcja >= 1 / 7 && proporcja <= 7)) throw new Error(`proporcje ${proporcja.toFixed(2)}:1 są poza zakresem (od 1:7 do 7:1)`);
  const W = Math.round(Math.sqrt(POLE * proporcja));
  return { W, H: Math.round(W / proporcja) };
}
