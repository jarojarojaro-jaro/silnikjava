// Rolka 9:16, zeszyt w kratkę: "Zasada 50/30/20" (~18 s z lektorką).
// Głos: examples/voice/reel-notebook/. Kadr 720×1280, rysunek w strefie bezpiecznej
// (x 36–640, y 150–900), pod nim napisy słowo po słowie.
// Każdy segment to osobny obiekt: obrys → kolor → podpis, dopiero potem następny.

import { Storyboard, line, polyline } from '../../../src/index.js';

const X0 = 90, X1 = 300, BOTTOM = 880, TOTAL = 480;
const segs = [
  { pct: 50, label: '50% potrzeby', color: 'sky', cue: 'Połowa' },
  { pct: 30, label: '30% przyjemności', color: 'coral', cue: 'Trzydzieści' },
  { pct: 20, label: '20% oszczędności', color: 'teal', cue: 'dwadzieścia' },
];
let y = BOTTOM;
for (const s of segs) {
  s.y1 = y;
  s.y0 = y - (TOTAL * s.pct) / 100;
  y = s.y0;
}

export function buildReelNotebook(voice) {
  const sb = new Storyboard({ format: 'reel', theme: 'notebook', speed: 900 });
  const B = (n) => voice.beat(n);
  const segment = (s, i) => {
    sb.pen(polyline([[X0, s.y0], [X1, s.y0], [X1, s.y1], [X0, s.y1]], { seed: 10 + i, overshoot: 0.04 }), { color: 'ink', w: 2.6, seed: 10 + i, cue: s.cue });
    sb.crayon([[X0 + 3, s.y0 + 3], [X1 - 3, s.y0 + 3], [X1 - 3, s.y1 - 3], [X0 + 3, s.y1 - 3]], { color: s.color, seed: 20 + i, w: 9, spacing: 10 });
    sb.write(s.label, 318, (s.y0 + s.y1) / 2 + 15, { size: 44, color: 'ink' });
  };

  // 1. "Nie wiesz, gdzie znika wypłata? Poznaj zasadę pięćdziesiąt, trzydzieści, dwadzieścia."
  sb.say(B(1), () => {
    sb.write('gdzie znika wypłata?', 360, 222, { size: 56, align: 'center', color: 'pen', cue: 'Nie' });
    sb.write('50 / 30 / 20', 360, 335, { size: 96, font: 'title', align: 'center', color: 'ink', cue: 'pięćdziesiąt' });
    sb.highlight(line(150, 318, 572, 314, { seed: 3 }), 40, { color: 'ochre', dur: 0.6 });
  });

  // 2. "Połowa pensji idzie na potrzeby: czynsz, jedzenie i rachunki."
  sb.say(B(2), () => segment(segs[0], 0));

  // 3. "Trzydzieści procent wydajesz na przyjemności: kino, wyjścia, hobby."
  sb.say(B(3), () => segment(segs[1], 1));

  // 4. "A dwadzieścia procent od razu odkładasz na oszczędności."
  sb.say(B(4), () => {
    segment(segs[2], 2);
    // ptaszek przy oszczędnościach — zaznaczenie, nowy obiekt
    sb.pen(polyline([[600, 452], [614, 470], [638, 424]], { closed: false, seed: 40 }), { color: 'pen', w: 4, seed: 40 });
  });
  sb.wait(0.8);
  return sb;
}
