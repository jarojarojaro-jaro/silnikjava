// Styl: flipchart (marker na arkuszu z bloku). "Lejek sprzedażowy" — ~15 s z lektorem.
// Głos: examples/voice/flipchart/. Gruby marker o stałej grubości ze smugami,
// pogrubione końce kresek, kolorowanie markerem, napisy Lilita One / Sriracha.

import { Storyboard, line, polyline } from '../../../src/index.js';

// lejek: lewa krawędź (360,170)→(590,540), prawa (920,170)→(690,540), potem wylot
const xl = (y) => 360 + ((y - 170) * 230) / 370, xr = (y) => 920 - ((y - 170) * 230) / 370;
const FUNNEL = [[360, 170], [920, 170], [690, 540], [690, 615], [590, 615], [590, 540]];
const bands = [
  { y0: 170, y1: 310, color: 'sky', n: '1000', cue: 'tysiąc' },
  { y0: 310, y1: 430, color: 'teal', n: '100', cue: 'Sto' },
  { y0: 430, y1: 540, color: 'ochre', n: '10', cue: 'dziesięć' },
];
const bandPoly = ({ y0, y1 }, i) => (i === 2
  ? [[xl(y0), y0], [xr(y0), y0], [690, 540], [690, 613], [590, 613], [590, 540]]
  : [[xl(y0), y0], [xr(y0), y0], [xr(y1), y1], [xl(y1), y1]]);

export function buildFlipchart(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'flipchart', speed: 1100 });
  const B = (n) => voice.beat(n);

  // 1. "Lejek sprzedażowy w trzech krokach."
  sb.say(B(1), () => {
    sb.write('Lejek sprzedażowy', 640, 118, { size: 62, font: 'title', align: 'center', color: 'ink' });
  });

  // kolejne pasy: kreska podziału (oprócz pierwszego), liczba na słowo lektora, kolor
  const band = (i, cue) => {
    const b = bands[i];
    if (i > 0) sb.pen(line(xl(b.y0), b.y0, xr(b.y0), b.y0, { seed: 20 + i, bow: 0.01 }), { color: 'ink', w: 3, seed: 20 + i });
    sb.write(b.n, 640, (b.y0 + Math.min(b.y1, 540)) / 2 + 20 + (i === 2 ? 14 : 0), { size: 56 - i * 6, font: 'title', align: 'center', color: 'ink', cue });
    // kolor po liczbie — marker mnoży się z tuszem, liczba zostaje czarna
    sb.crayon(bandPoly(b, i), { color: b.color, seed: 30 + i });
  };

  // 2. "Na górze lejka tysiąc osób widzi Twoją reklamę."
  sb.say(B(2), () => {
    sb.pen(polyline(FUNNEL, { seed: 10, bow: 0.008 }), { color: 'ink', w: 3.2, seed: 10 });
    band(0, 'tysiąc');
  });

  // 3. "Sto z nich klika i wchodzi na stronę, a tylko dziesięć naprawdę kupuje."
  sb.say(B(3), () => {
    band(1, 'Sto');
    band(2, 'dziesięć');
  });

  // 4. "Twoje zadanie to poszerzyć dół lejka."
  sb.say(B(4), () => {
    sb.arrow(line(575, 585, 455, 585, { seed: 40 }), { color: 'coral', w: 3.4, head: 18, seed: 40, cue: 'poszerzyć' });
    sb.arrow(line(705, 585, 825, 585, { seed: 41 }), { color: 'coral', w: 3.4, head: 18, seed: 41 });
  });
  sb.wait(0.8);
  return sb;
}
