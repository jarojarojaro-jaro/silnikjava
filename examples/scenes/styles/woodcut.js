// Styl: drzeworyt (druk z klocka, czerń + czerwień). "Jak dawniej wytapiano żelazo"
// — film o dawnej technice z lektorem. Głos: examples/voice/woodcut/.
// Dłuto: gruba, pewna kreska; kolor jako równoległe nacięcia.

import { Storyboard, line, polyline, curve, ellipse, catmull } from '../../../src/index.js';

// dymarka: gliniany, zwężający się ku górze piec z otworem
const FURNACE = [[575, 260], [705, 260], [790, 590], [490, 590]];
const BELLOWS = [[250, 520], [400, 548], [400, 572], [250, 600], [222, 560]];
const BLOOM = catmull([[960, 560], [1000, 530], [1060, 540], [1080, 580], [1040, 610], [980, 605]], 8, true);
const flame = (x, s) => Array.from({ length: 10 }, (_, i) => [x + 9 * Math.sin(i * 1.1 + s), 565 - i * 9]);

export function buildWoodcut(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'woodcut', speed: 950 });
  const B = (n) => voice.beat(n);

  // 1. "Jak dawniej wytapiano żelazo? Służył do tego gliniany piec, zwany dymarką."
  sb.say(B(1), () => {
    sb.write('Żelazo z dymarki', 640, 120, { size: 62, font: 'title', align: 'center', color: 'ink', cue: 'Jak' });
    // piec: obrys i od razu rytowane kreskowanie gliny
    sb.pen(polyline(FURNACE, { seed: 3, bow: 0.01 }), { color: 'ink', w: 3.6, seed: 3, cue: 'piec,' });
    sb.crayon(FURNACE, { color: 'ink', seed: 4, alpha: 0.55, spacing: 13 });
  });

  // 2. "Od góry sypano na zmianę rudę żelaza i węgiel drzewny."
  sb.say(B(2), () => {
    sb.arrow(curve([[400, 205], [500, 190], [600, 245]], 10), { color: 'ink', w: 3.4, head: 16, seed: 10, cue: 'sypano' });
    sb.write('ruda', 330, 220, { size: 40, align: 'center', color: 'ink', cue: 'rudę' });
    sb.arrow(curve([[880, 205], [780, 190], [680, 245]], 10), { color: 'ink', w: 3.4, head: 16, seed: 11, cue: 'węgiel' });
    sb.write('węgiel', 960, 220, { size: 40, align: 'center', color: 'ink' });
  });

  // 3. "Miechy tłoczyły powietrze, a w środku ogień dochodził do tysiąca dwustu stopni."
  sb.say(B(3), () => {
    sb.pen(polyline(BELLOWS, { seed: 20, bow: 0.02 }), { color: 'ink', w: 3.2, seed: 20, cue: 'Miechy' });
    sb.arrow(line(405, 560, 500, 562, { seed: 22, bow: 0 }), { color: 'ink', w: 3, head: 14, seed: 22, cue: 'powietrze' });
    sb.strokes([flame(600, 0), flame(640, 2), flame(680, 4)], { color: 'pen', w: 5, seed: 23, speed: 1400, cue: 'ogień' });
    sb.write('1200°C', 960, 420, { size: 64, font: 'title', align: 'center', color: 'pen', cue: 'tysiąca' });
  });

  // 4. "Na dnie zostawał gąbczasty kęs żelaza, który kowal wykuwał na metal."
  sb.say(B(4), () => {
    sb.arrow(curve([[790, 590], [870, 620], [945, 585]], 10), { color: 'ink', w: 3, head: 14, seed: 30, cue: 'dnie' });
    sb.pen(BLOOM, { color: 'ink', w: 3.4, seed: 31, cue: 'gąbczasty' });
    sb.crayon(BLOOM, { color: 'ink', seed: 32, angle: -0.6 });
    sb.write('kęs żelaza', 1020, 665, { size: 38, align: 'center', color: 'ink', cue: 'kowal' });
  });
  sb.wait(0.8);
  return sb;
}
