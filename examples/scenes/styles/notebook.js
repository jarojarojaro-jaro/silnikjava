// Styl: zeszyt w kratkę. "Procent składany" — ~15 s z lektorem.
// Głos: examples/voice/notebook/. Długopis (cienko, prawie bez nacisku), czerwony
// długopis do poprawek, zakreślacz, kredka; kratka 5 mm i margines.

import { Storyboard, line, polyline, curve, ellipse } from '../../../src/index.js';

const O = [190, 610]; // początek osi
const years = [0, 2, 4, 6, 8];
const value = (n) => 1000 * 1.1 ** n;
const bars = years.map((n, i) => {
  const h = (value(n) / value(8)) * 300, x = 240 + i * 115;
  return { x, h, top: [x + 32, O[1] - h] };
});

export function buildNotebook(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'notebook', speed: 900 });
  const B = (n) => voice.beat(n);

  // 1. "Procent składany, czyli odsetki od odsetek."
  sb.say(B(1), () => {
    sb.write('Procent składany', 130, 92, { size: 62, font: 'title', color: 'ink' });
    sb.highlight(line(126, 80, 536, 77, { seed: 3 }), 34, { color: 'ochre', dur: 0.6, cue: 'odsetek' });
  });

  // 2. "Wpłacasz tysiąc złotych na dziesięć procent rocznie."
  sb.say(B(2), () => {
    sb.write('1000 zł  ·  10% rocznie', 130, 172, { size: 42, color: 'ink', cue: 'Wpłacasz' });
  });

  // 3. "Odsetki dopisują się do kwoty, więc słupki rosną coraz szybciej."
  sb.say(B(3), () => {
    // osie jednym pociągnięciem (od góry osi Y przez początek w prawo)
    sb.pen(polyline([[O[0], 250], O, [860, O[1]]], { closed: false, seed: 5 }), { color: 'ink', w: 2.6, seed: 5, speed: 1400, cue: 'Odsetki' });
    // słupki jedną kreską "schodkami": w górę, w prawo, w dół, po osi do następnego
    const skyline = bars.flatMap((b) => [[b.x, O[1]], [b.x, O[1] - b.h], [b.x + 64, O[1] - b.h], [b.x + 64, O[1]]]);
    sb.pen(polyline(skyline, { closed: false, seed: 10 }), { color: 'ink', w: 2.4, seed: 10, speed: 1400, cue: 'kwoty' });
    sb.arrow(curve(bars.map((b) => [b.top[0], b.top[1] - 18]), 10), { color: 'pen', w: 2.6, head: 13, seed: 20, cue: 'szybciej' });
    sb.write('lata', 820, 650, { size: 32, color: 'inkSoft' });
  });

  // 4. "Po ośmiu latach masz już ponad dwa razy więcej."
  sb.say(B(4), () => {
    const last = bars[bars.length - 1];
    sb.highlight(line(last.x + 32, O[1] - 6, last.x + 32, O[1] - last.h + 8, { bow: 0, seed: 29 }), 52, { color: 'teal', dur: 0.5, cue: 'latach' });
    sb.write('×2', 990, 330, { size: 92, color: 'pen', cue: 'dwa' });
    sb.pen(ellipse(1030, 300, 92, 70, { seed: 30, overshoot: 0.12 }), { color: 'pen', w: 2.6, seed: 30 });
  });
  sb.wait(0.8);
  return sb;
}
