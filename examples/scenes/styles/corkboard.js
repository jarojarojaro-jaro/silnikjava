// Styl: tablica korkowa (śledztwo). "Titanic: łańcuch błędów" — film historyczny
// z lektorką. Głos: examples/voice/corkboard/. Karteczki zamalowane markerem,
// pinezki, napisy markerem; na koniec czerwona nitka łączy błędy ze sprawą.

import { Storyboard, curve } from '../../../src/index.js';

// lekko przekrzywiony prostokąt karteczki
const note = (x, y, w, h, tilt) => [[x, y + tilt], [x + w, y - tilt], [x + w + tilt, y + h - tilt], [x + tilt, y + h + tilt]];
const CARD = note(500, 250, 280, 175, 2);
const NOTES = [
  { poly: note(140, 110, 230, 150, 5), color: 'ochre', text: 'za szybko\nmimo lodu', pin: [255, 122], cue: 'Płynął' },
  { poly: note(905, 110, 230, 150, -4), color: 'coral', text: 'brak\nlornetek', pin: [1020, 120], cue: 'Obserwatorzy' },
  { poly: note(905, 465, 230, 150, 4), color: 'sky', text: 'szalupy\ndla połowy', pin: [1020, 477], cue: 'szalup' },
];

export function buildCorkboard(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'corkboard', speed: 1000 });
  const B = (n) => voice.beat(n);
  // karteczka = jeden obiekt: papier → pinezka → napis
  const card = (n, i) => {
    sb.crayon(n.poly, { color: n.color, seed: 10 + i, cue: n.cue });
    sb.dot(n.pin[0], n.pin[1], 9, { color: 'pen' });
    const [x0, y0] = n.poly[0];
    sb.write(n.text, x0 + 118, y0 + 70, { size: 38, align: 'center', color: 'ink' });
  };

  // 1. "Titanic. Niezatapialny statek, który zatonął w pierwszym rejsie. Jak do tego doszło?"
  sb.say(B(1), () => {
    sb.crayon(CARD, { color: 'white', seed: 3, cue: 'Titanic.' });
    sb.dot(640, 262, 10, { color: 'pen' });
    sb.write('TITANIC', 640, 335, { size: 52, font: 'title', align: 'center', color: 'ink', cue: 'statek,' });
    sb.write('1912', 640, 395, { size: 40, font: 'title', align: 'center', color: 'pen', cue: 'rejsie.' });
    // „Jak do tego doszło?” — duży znak zapytania obok karty
    sb.write('?', 440, 410, { size: 110, font: 'title', align: 'center', color: 'pen', cue: 'doszło?' });
  });

  // 2. "Płynął za szybko, mimo ostrzeżeń o lodzie."
  sb.say(B(2), () => card(NOTES[0], 0));
  // 3. "Obserwatorzy nie mieli lornetek, więc górę lodową dostrzeżono za późno."
  sb.say(B(3), () => card(NOTES[1], 1));
  // 4. "A szalup ratunkowych wystarczyło tylko dla połowy ludzi na pokładzie."
  sb.say(B(4), () => card(NOTES[2], 2));

  // 5. "Żaden z tych błędów osobno nie zatopiłby statku. Razem okazały się zabójcze."
  sb.say(B(5), () => {
    // czerwona nitka od każdej pinezki do sprawy (lekko zwisa)
    const string = ([x, y], seed) => curve([[x, y], [(x + 640) / 2, (y + 262) / 2 + 30], [640, 262]], 10);
    sb.strokes(NOTES.map((n, i) => string(n.pin, i)), { color: 'pen', w: 2.4, seed: 30, speed: 1500, cue: 'błędów' });
    sb.write('ŁAŃCUCH\nBŁĘDÓW', 255, 560, { size: 46, font: 'title', align: 'center', color: 'pen', cue: 'Razem', dur: 2.4 });
  });
  sb.wait(0.8);
  return sb;
}
