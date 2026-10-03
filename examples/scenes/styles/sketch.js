// Styl: szkic ołówkiem (szkicownik na spirali). "Jak działa dźwignia?" — ~15 s z lektorem.
// Głos: examples/voice/sketch/. Grafit z ziarnem papieru, druga blada linia obok
// (szkic), kreskowanie zamiast koloru, jasne linie konstrukcyjne, jeden akcent na siły.

import { Storyboard, line, polyline, curve, catmull } from '../../../src/index.js';

const F = [520, 460]; // punkt podparcia (wierzchołek podpory)
const L = [300, 443], R = [1080, 503]; // końce deski (przechodzi przez F)
const ROCK = catmull([[300, 432], [292, 380], [330, 340], [385, 345], [418, 385], [412, 428]], 8, true);
// wymiar: linia z kreskami na końcach + podpis pod spodem
const dim = (x0, x1, y, seed) => [
  line(x0, y, x1, y, { seed, bow: 0 }),
  line(x0, y - 9, x0, y + 9, { seed: seed + 1, bow: 0 }),
  line(x1, y - 9, x1, y + 9, { seed: seed + 2, bow: 0 }),
];

export function buildSketch(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'sketch', speed: 950 });
  const B = (n) => voice.beat(n);

  // 1. "Jak działa dźwignia?"
  sb.say(B(1), () => {
    sb.write('Jak działa dźwignia?', 640, 112, { size: 66, font: 'title', align: 'center', color: 'pen' });
  });

  // 2. "Kładziemy deskę na punkcie podparcia."
  sb.say(B(2), () => {
    // linia konstrukcyjna podłoża — jasna, cienka, jak pierwszy szkic
    sb.pen(line(140, 530, 1150, 530, { seed: 2, bow: 0.003 }), { color: 'inkSoft', w: 1.6, seed: 2, speed: 1800 });
    sb.pen(line(L[0], L[1], R[0], R[1], { seed: 3, bow: 0.004 }), { color: 'pen', w: 3.6, seed: 3, speed: 1400, cue: 'deskę' });
    sb.pen(polyline([[478, 530], F, [562, 530]], { closed: false, seed: 4 }), { color: 'pen', w: 3.2, seed: 4, cue: 'punkcie' });
    sb.crayon([[486, 528], [520, 466], [554, 528]], { seed: 5 });
  });

  // 3. "Ciężki kamień leży blisko podparcia, a my naciskamy daleko od niego."
  sb.say(B(3), () => {
    sb.pen(ROCK, { color: 'pen', w: 3.2, seed: 6, cue: 'kamień' });
    sb.crayon(ROCK, { seed: 7, angle: 0.7 });
    sb.arrow(line(1050, 340, 1050, 468, { seed: 8 }), { color: 'coral', w: 3.6, head: 18, seed: 8, cue: 'naciskamy' });
  });

  // 4. "Długie ramię sprawia, że mała siła podnosi duży ciężar."
  sb.say(B(4), () => {
    sb.strokes(dim(522, 1078, 580, 20), { color: 'inkSoft', w: 2, seed: 20, speed: 1600, cue: 'Długie' });
    sb.arrow(curve([[250, 410], [232, 360], [248, 308]], 8), { color: 'coral', w: 3.4, head: 16, seed: 9, cue: 'podnosi' });
    sb.strokes(dim(302, 518, 580, 30), { color: 'inkSoft', w: 2, seed: 30, speed: 1600 });
    sb.write('długie ramię', 800, 632, { size: 38, align: 'center', color: 'ink' });
  });
  sb.wait(0.8);
  return sb;
}
