// Styl: neon / lightboard (pisanie na podświetlonej szybie). "Jak uczy się sieć
// neuronowa?" — 15 s z lektorką. Głos: examples/voice/neon/.
// Kreska świeci (warstwy poświaty dodawane światłem), tło prawie czarne.

import { Storyboard, line, ellipse, curve } from '../../../src/index.js';

const layer = (x, n, gap) => Array.from({ length: n }, (_, i) => [x, 380 + (i - (n - 1) / 2) * gap]);
const node = (sb, [x, y], color, seed, o = {}) =>
  sb.pen(ellipse(x, y, 26, 26, { seed, overshoot: 0.06 }), { color, w: 3, seed, ...o });
// połączenia: krótkie, szybkie pociągnięcia od krawędzi do krawędzi kółek
const links = (from, to, seed) => from.flatMap(([x1, y1], i) => to.map(([x2, y2], j) => {
  const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
  return line(x1 + ux * 32, y1 + uy * 32, x2 - ux * 32, y2 - uy * 32, { bow: 0.01, seed: seed + i * 7 + j });
}));

export function buildNeon(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'neon', speed: 1000 });
  const B = (n) => voice.beat(n);
  const inp = layer(330, 3, 120), hid = layer(640, 3, 120), out = [[950, 380]];

  // 1. "Jak uczy się sieć neuronowa?"
  sb.say(B(1), () => {
    sb.write('Jak uczy się sieć?', 640, 110, { size: 60, align: 'center', color: 'ink', cue: 'Jak' });
  });

  // 2. "Dane trafiają do warstwy wejściowej."
  sb.say(B(2), () => {
    inp.forEach((p, i) => node(sb, p, 'teal', 10 + i, i === 0 ? { cue: 'trafiają' } : {}));
    sb.write('wejście', 292, 392, { size: 34, align: 'right', color: 'teal' });
  });

  // 3. "Każdy neuron waży sygnały i przekazuje je dalej."
  sb.say(B(3), () => {
    hid.forEach((p, i) => node(sb, p, 'sky', 20 + i, i === 0 ? { cue: 'Każdy' } : {}));
    sb.strokes(links(inp, hid, 40), { color: 'plum', w: 1.6, seed: 40, speed: 2600, cue: 'przekazuje' });
  });

  // 4. "Na końcu sieć zgaduje wynik, a błąd poprawia wagi."
  sb.say(B(4), () => {
    sb.strokes(links(hid, out, 60), { color: 'plum', w: 1.6, seed: 60, speed: 2600, cue: 'końcu' });
    node(sb, out[0], 'ochre', 30);
    sb.write('?', 950, 400, { size: 44, align: 'center', color: 'ochre', cue: 'wynik' });
    sb.arrow(curve([[940, 560], [640, 625], [340, 560]], 12), { color: 'coral', w: 3, head: 16, seed: 70, cue: 'błąd' });
    sb.write('błąd', 640, 670, { size: 36, align: 'center', color: 'coral' });
  });
  sb.wait(0.8);
  return sb;
}
