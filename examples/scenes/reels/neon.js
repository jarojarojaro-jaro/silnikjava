// Rolka 9:16, neon: "Jak AI pisze tekst?" (~20 s z lektorem).
// Głos: examples/voice/reel-neon/. Zdanie, trzy słupki prawdopodobieństwa
// (każdy: słowo → świecący pas → procent), zwycięzca dopisany do zdania.

import { Storyboard, curve, line } from '../../../src/index.js';

const BAR_X = 250, BAR_MAX = 270;
const options = [
  { word: 'macie', p: 62, color: 'teal', y: 560, cue: 'Macie' },
  { word: 'dachu', p: 21, color: 'sky', y: 670, cue: 'Dachu' },
  { word: 'oknie', p: 9, color: 'plum', y: 780, cue: 'Oknie' },
];

export function buildReelNeon(voice) {
  const sb = new Storyboard({ format: 'reel', theme: 'neon', speed: 1000 });
  const B = (n) => voice.beat(n);
  const bar = (o, i) => {
    const x1 = BAR_X + (BAR_MAX * o.p) / 62;
    const y0 = o.y - 34, y1 = o.y + 22;
    sb.write(o.word, 70, o.y + 8, { size: 46, color: 'ink', cue: o.cue });
    // pas światła: jedno szerokie, poziome pociągnięcie pisaka (bez obrysu — na szybie świeci sam kolor)
    sb.crayon([[BAR_X, y0], [x1, y0], [x1, y1], [BAR_X, y1]], { color: o.color, seed: 20 + i, w: 22, spacing: 14, alpha: 0.55 });
    sb.write(`${o.p}%`, x1 + 16, o.y + 8, { size: 40, color: o.color });
  };

  // 1. "Jak sztuczna inteligencja pisze tekst? Zgaduje słowo po słowie."
  sb.say(B(1), () => {
    sb.write('Jak AI pisze?', 360, 250, { size: 86, font: 'title', align: 'center', color: 'ink', cue: 'Jak' });
    // „słowo po słowie”: miejsca na kolejne słowa połączone strzałkami
    sb.pen(line(80, 330, 190, 330, { seed: 3, bow: 0 }), { color: 'teal', w: 3, seed: 3, cue: 'Zgaduje' });
    sb.arrow(line(205, 330, 255, 330, { seed: 4, bow: 0 }), { color: 'teal', w: 2.4, head: 12, seed: 4 });
    sb.pen(line(270, 330, 380, 330, { seed: 5, bow: 0 }), { color: 'teal', w: 3, seed: 5 });
    sb.arrow(line(395, 330, 445, 330, { seed: 6, bow: 0 }), { color: 'teal', w: 2.4, head: 12, seed: 6 });
    sb.pen(line(460, 330, 570, 330, { seed: 7, bow: 0 }), { color: 'teal', w: 3, seed: 7 });
  });

  // 2. "Widzi początek zdania: kot siedzi na..."
  sb.say(B(2), () => {
    sb.write('Kot siedzi na', 70, 410, { size: 56, color: 'ink', cue: 'Widzi' });
  });

  // 3. "I liczy szanse każdego słowa. Macie: sześćdziesiąt dwa procent."
  sb.say(B(3), () => {
    sb.write('szanse:', 70, 490, { size: 40, color: 'inkSoft', cue: 'liczy' });
    bar(options[0], 0);
  });

  // 4. "Dachu: dwadzieścia jeden procent. Oknie: tylko dziewięć."
  sb.say(B(4), () => {
    bar(options[1], 1);
    bar(options[2], 2);
  });

  // 5. "Wybiera najbardziej prawdopodobne, dopisuje je i zgaduje dalej."
  sb.say(B(5), () => {
    sb.arrow(curve([[150, 512], [260, 462], [395, 430]], 10), { color: 'ochre', w: 3, head: 15, seed: 30, cue: 'Wybiera' });
    sb.write('macie', 410, 410, { size: 56, color: 'ochre', cue: 'dopisuje' });
    sb.write('i dalej…', 70, 880, { size: 46, color: 'coral', cue: 'zgaduje' });
  });
  sb.wait(0.8);
  return sb;
}
