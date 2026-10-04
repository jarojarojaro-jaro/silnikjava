// Styl: blueprint (kalka techniczna). "Droga zapytania" — 15 s z lektorem.
// Głos: examples/voice/blueprint/. Rapidograf: stała grubość, kreślarskie
// przedłużenia linii, kreskowanie pod 45°, podpisy pismem technicznym.

import { Storyboard, line, polyline, curve, ellipse } from '../../../src/index.js';

// prostokąt kreślarski: jedna kreska z linijki, ostre rogi; rapidograf przedłuża
// koniec lekko za narożnik (linie konstrukcyjne krzyżują się w rogu)
const edges = (x, y, w, h, seed) => polyline([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { seed, bow: 0.004 });
const box = (sb, x, y, w, h, label, o = {}) => {
  sb.pen(edges(x, y, w, h, o.seed ?? 1), { color: 'ink', w: 2.6, seed: o.seed, cue: o.cue });
  // zwraca funkcję dopisującą podpis — można go postawić od razu albo później
  return () => sb.write(label, x + w / 2, y + h + 34, { size: 26, align: 'center', color: 'teal' });
};

export function buildBlueprint(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'blueprint', speed: 1300 });
  const B = (n) => voice.beat(n);

  // 1. "Co się dzieje, gdy klikasz przycisk?"
  sb.say(B(1), () => {
    sb.write('Co się dzieje po kliknięciu?', 80, 100, { size: 44, color: 'ink' });
  });

  // 2. "Przeglądarka pakuje kliknięcie w zapytanie i wysyła je do serwera."
  sb.say(B(2), () => {
    box(sb, 90, 250, 220, 150, 'przeglądarka', { seed: 3, cue: 'Przeglądarka' })();
    sb.arrow(line(325, 300, 495, 300, { bow: 0, seed: 4 }), { color: 'white', w: 2.4, head: 14, seed: 4, cue: 'zapytanie' });
    box(sb, 510, 230, 200, 190, 'serwer', { seed: 5, cue: 'wysyła' })();
  });

  // 3. "Serwer najpierw zagląda do pamięci podręcznej, a jeśli tam nic nie ma, dopiero potem do bazy danych, która trzyma wszystko."
  sb.say(B(3), () => {
    sb.arrow(line(725, 270, 885, 210, { bow: 0, seed: 6 }), { color: 'white', w: 2.4, head: 14, seed: 6, cue: 'zagląda' });
    const cacheLabel = box(sb, 900, 150, 200, 110, 'cache', { seed: 7, cue: 'pamięci' });
    // kreskowanie pod 45° od razu po konturze — pamięć podręczna wyróżniona jak przekrój
    sb.crayon([[902, 152], [1098, 152], [1098, 258], [902, 258]], { color: 'teal', seed: 7, spacing: 13 });
    cacheLabel();
    sb.arrow(line(725, 380, 885, 470, { bow: 0, seed: 8 }), { color: 'white', w: 2.4, head: 14, seed: 8, cue: 'potem' });
    // baza: walec
    sb.strokes([
      ellipse(1000, 430, 90, 22, { seed: 9, overshoot: 0.02 }),
      line(910, 430, 910, 540, { bow: 0, seed: 9 }),
      Array.from({ length: 31 }, (_, i) => [1000 - 90 * Math.cos((Math.PI * i) / 30), 540 + 22 * Math.sin((Math.PI * i) / 30)]),
      line(1090, 540, 1090, 430, { bow: 0, seed: 10 }),
    ], { color: 'ink', w: 2.6, seed: 9, cue: 'bazy' });
    sb.write('baza', 1000, 596, { size: 26, align: 'center', color: 'teal' });
  });

  // 4. "Odpowiedź wraca w kilkadziesiąt milisekund."
  sb.say(B(4), () => {
    sb.arrow(curve([[600, 478], [430, 548], [240, 530], [200, 462]], 12), { color: 'ochre', w: 2.4, dash: [12, 8], head: 14, seed: 11, cue: 'wraca' });
    sb.write('~40 ms', 420, 600, { size: 34, align: 'center', color: 'ochre' });
  });
  sb.wait(0.8);
  return sb;
}
