// Styl: akwarela (cienkopis + plamy farby). "Obieg wody" — ~15 s z lektorką.
// Głos: examples/voice/watercolor/. Kolorowanie pędzlem: plama z rozlanym
// brzegiem i pigmentem zebranym na krawędzi, odsłaniana mokrym frontem.

import { Storyboard, ellipse, curve, catmull } from '../../../src/index.js';

const SUN = [1060, 215];
// morze: falujący brzeg u góry
const SEA = [
  ...Array.from({ length: 25 }, (_, i) => [200 + i * 40, 548 + 9 * Math.sin(i * 1.3)]),
  [1160, 655], [200, 655],
];
// chmura: owal z "kłębami" u góry i płaskim spodem
const CLOUD = catmull(Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const top = Math.sin(a) < 0;
  const k = top ? 1 + 0.22 * Math.abs(Math.sin(a * 3.5)) : 0.55;
  return [430 + Math.cos(a) * 165 * (top ? 1 : 1.02), 255 + Math.sin(a) * 70 * k];
}), 8, true);
const steam = (x, seed) => Array.from({ length: 16 }, (_, i) => [x + 9 * Math.sin(i * 0.8 + seed), 515 - i * 10]);
const rain = Array.from({ length: 7 }, (_, i) => [[330 + i * 32, 340], [312 + i * 32, 500]]);

export function buildWatercolor(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'watercolor', speed: 950 });
  const B = (n) => voice.beat(n);

  // 1. "Obieg wody w przyrodzie."
  sb.say(B(1), () => {
    sb.write('Obieg wody', 640, 104, { size: 92, font: 'title', weight: 700, align: 'center', color: 'ink', dur: 2.2 });
  });

  // 2. "Słońce ogrzewa morze, a woda powoli zamienia się w parę."
  sb.say(B(2), () => {
    sb.pen(ellipse(SUN[0], SUN[1], 58, 58, { seed: 3, overshoot: 0.08 }), { color: 'ink', w: 2.4, seed: 3, cue: 'Słońce' });
    // duża plama: szerszy pędzel, rzadsze pociągnięcia
    sb.crayon(SEA, { color: 'sky', seed: 5, w: 44, spacing: 36, cue: 'morze' });
    sb.strokes([steam(760, 0), steam(850, 2), steam(940, 4)], { color: 'inkSoft', w: 2.2, seed: 6, speed: 1500, cue: 'parę' });
    sb.crayon(ellipse(SUN[0], SUN[1], 60, 60, { seed: 4 }), { color: 'ochre', seed: 4 });
  });

  // 3. "Para unosi się, stygnie i skrapla w chmury."
  sb.say(B(3), () => {
    sb.arrow(curve([[850, 345], [760, 270], [625, 250]], 12), { color: 'ink', w: 2.2, head: 13, seed: 7, cue: 'unosi' });
    sb.pen(CLOUD, { color: 'ink', w: 2.4, seed: 8, cue: 'skrapla' });
    sb.crayon(CLOUD, { color: 'plum', seed: 9, alpha: 0.55 });
  });

  // 4. "A z chmur woda wraca do morza jako deszcz."
  sb.say(B(4), () => {
    sb.strokes(rain, { color: 'pen', w: 2.2, seed: 10, speed: 1800, dash: [12, 10], cue: 'wraca' });
  });
  sb.wait(0.8);
  return sb;
}
