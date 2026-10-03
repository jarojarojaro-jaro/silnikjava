// Styl: plakat konstruktywistyczny. "Enigma" — film o historii wojny z lektorem.
// Głos: examples/voice/poster/. Czerwień, czerń i krem, płaska kryjąca farba,
// wysoki tytuł Bebas Neue, postacie grubą kreską zamiast portretów.

import { Storyboard, line, polyline, curve, ellipse } from '../../../src/index.js';

const BAND = [[70, 70], [610, 40], [626, 146], [86, 176]]; // czerwony ukośny pas pod tytułem
const MACHINE = [[760, 250], [1170, 250], [1170, 560], [760, 560]];
const ROTOR = (i) => ellipse(860 + i * 105, 320, 34, 34, { seed: 60 + i, overshoot: 0.04 });

export function buildPoster(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'poster', speed: 1000 });
  const B = (n) => voice.beat(n);

  // 1. "Enigma. Niemiecka maszyna szyfrująca z czasów drugiej wojny światowej."
  sb.say(B(1), () => {
    sb.crayon(BAND, { color: 'pen', seed: 3, cue: 'Enigma.' });
    sb.write('ENIGMA', 105, 160, { size: 128, font: 'title', color: 'ink', dur: 2.6 });
  });

  // 2. "To skrzynia z klawiaturą i obrotowymi wirnikami, o milionach ustawień. Uważano ją za niemożliwą do złamania."
  sb.say(B(2), () => {
    // maszyna: skrzynka → kolor → wirniki
    sb.pen(polyline(MACHINE, { seed: 10, bow: 0.004 }), { color: 'ink', w: 3.4, seed: 10, cue: 'skrzynia' });
    sb.crayon(MACHINE, { color: 'teal', seed: 11, w: 36, spacing: 26 });
    sb.strokes([0, 1, 2].map(ROTOR), { color: 'ochre', w: 4, seed: 12, speed: 1400, cue: 'milionach' });
    sb.write('? ? ?', 965, 480, { size: 90, font: 'title', align: 'center', color: 'white' });
  });

  // 3. "W tysiąc dziewięćset trzydziestym drugim roku wyzwanie podjęło trzech młodych polskich matematyków z Poznania."
  sb.say(B(3), () => {
    sb.write('1932', 110, 400, { size: 140, font: 'title', color: 'pen', cue: 'tysiąc' });
    // trzy postacie grubą, plakatową kreską: głowa, tułów, ramiona
    const figure = (x, i) => [
      ellipse(x, 528, 20, 20, { seed: 20 + i }),
      line(x, 552, x, 625, { seed: 24 + i, bow: 0 }),
      line(x - 34, 640, x, 600, { seed: 28 + i, bow: 0 }), line(x, 600, x + 34, 640, { seed: 32 + i, bow: 0 }),
      line(x - 36, 580, x + 36, 580, { seed: 36 + i, bow: 0 }),
    ];
    sb.strokes([170, 300, 430].flatMap(figure), { color: 'ink', w: 7, seed: 20, speed: 1500, cue: 'trzech' });
  });

  // 4. "Rejewski, Różycki i Zygalski odtworzyli jej działanie za pomocą czystej matematyki."
  sb.say(B(4), () => {
    sb.write('Rejewski · Różycki · Zygalski', 300, 690, { size: 36, align: 'center', color: 'ink', cue: 'Rejewski,' });
    sb.arrow(curve([[500, 560], [610, 480], [745, 470]], 10), { color: 'pen', w: 6, head: 22, seed: 30, cue: 'matematyki.' });
  });

  // 5. "Ich praca pomogła aliantom wygrać wojnę."
  sb.say(B(5), () => {
    sb.write('ZŁAMANA', 965, 650, { size: 96, font: 'title', align: 'center', color: 'pen', cue: 'pomogła' });
  });
  sb.wait(0.8);
  return sb;
}
