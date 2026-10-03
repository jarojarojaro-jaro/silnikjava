// Styl: tusz i pędzel (sumi-e). "Jak rosną góry" — film o przyrodzie z lektorką.
// Głos: examples/voice/sumi/. Kreska pędzla: gruba w poprzek ostrza, cienka wzdłuż;
// laweowanie rozcieńczonym tuszem; czerwona pieczęć na koniec.

import { Storyboard, line, polyline, curve, catmull } from '../../../src/index.js';

const LEFT = [[110, 520], [600, 520], [600, 590], [110, 590]];
const RIGHT = [[680, 520], [1170, 520], [1170, 590], [680, 590]];
// szczyt wypiętrzony nad zderzeniem płyt
const PEAK = catmull([[470, 520], [560, 380], [600, 300], [640, 250], [690, 320], [730, 400], [810, 520]], 8);
const PEAK2 = catmull([[790, 520], [860, 420], [905, 370], [950, 430], [1010, 520]], 8);
const SEAL = [[1110, 600], [1170, 600], [1170, 660], [1110, 660]];

export function buildSumi(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'sumi', speed: 950 });
  const B = (n) => voice.beat(n);
  const mountain = (pts, seed, cue) => {
    sb.pen(pts, { color: 'ink', w: 3.4, seed, ...(cue ? { cue } : {}) });
    sb.crayon([...pts, [pts[pts.length - 1][0], 520], [pts[0][0], 520]], { color: 'inkSoft', seed: seed + 1, alpha: 0.5 });
  };

  // 1. "Jak rosną góry? Powoli, przez miliony lat."
  sb.say(B(1), () => {
    sb.write('Jak rosną góry?', 640, 115, { size: 76, font: 'title', align: 'center', color: 'ink', cue: 'Jak' });
  });

  // 2. "Skorupa Ziemi to wielkie płyty skalne. Pływają po gorącym, gęstym płaszczu, który powoli krąży jak woda w garnku."
  sb.say(B(2), () => {
    sb.pen(polyline(LEFT, { seed: 3, bow: 0.01 }), { color: 'ink', w: 3, seed: 3, cue: 'płyty,' });
    sb.crayon(LEFT, { color: 'ochre', seed: 4, alpha: 0.55, w: 44, spacing: 34 });
    sb.pen(polyline(RIGHT, { seed: 5, bow: 0.01 }), { color: 'ink', w: 3, seed: 5 });
    sb.crayon(RIGHT, { color: 'ochre', seed: 6, alpha: 0.55, w: 44, spacing: 34 });
    // prądy w płaszczu
    sb.arrow(curve([[300, 660], [470, 690], [620, 655]], 10), { color: 'pen', w: 2.6, head: 12, seed: 7, cue: 'woda' });
    sb.arrow(curve([[980, 660], [810, 690], [660, 655]], 10), { color: 'pen', w: 2.6, head: 12, seed: 8 });
  });

  // 3. "Gdy dwie płyty się zderzają, skały zgniatają się i wypiętrzają ku niebu."
  sb.say(B(3), () => {
    sb.arrow(line(230, 555, 500, 555, { seed: 20, bow: 0 }), { color: 'ink', w: 3, head: 16, seed: 20, cue: 'zderzają,' });
    sb.arrow(line(1050, 555, 780, 555, { seed: 21, bow: 0 }), { color: 'ink', w: 3, head: 16, seed: 21 });
    mountain(PEAK, 22, 'wypiętrzają');
  });

  // 4. "Tak powstały Himalaje, najwyższe góry świata. I wciąż rosną, o kilka milimetrów rocznie."
  sb.say(B(4), () => {
    mountain(PEAK2, 30, 'Himalaje.');
    sb.write('+5 mm / rok', 1000, 250, { size: 48, align: 'center', color: 'ink', cue: 'rosną,' });
    // pieczęć: czerwony kwadrat
    sb.crayon(SEAL, { color: 'pen', seed: 40, alpha: 0.95 });
  });
  sb.wait(0.8);
  return sb;
}
