// Styl: rysunek patentowy (tusz kreślarski, przekroje kreskowane pod 45°, odsyłacze
// z numerami). "Jak działa maszyna parowa" — film techniczny z lektorem.
// Głos: examples/voice/patent/.

import { Storyboard, line, polyline, curve, arc } from '../../../src/index.js';

// kocioł z kopułą (przekrój)
const BOILER = [[110, 540], [110, 360], ...arc(215, 360, 105, Math.PI, Math.PI * 2, 24), [320, 360], [320, 540]];
const WATER = [[112, 440], [160, 434], [215, 444], [270, 436], [318, 440], [318, 538], [112, 538]];
const flame = (x, s) => Array.from({ length: 8 }, (_, i) => [x + 7 * Math.sin(i * 1.3 + s), 598 - i * 6]);
// rura parowa: dwie równoległe ścianki
const PIPE_A = [[208, 256], [208, 196], [508, 196], [508, 330]];
const PIPE_B = [[222, 256], [222, 210], [494, 210], [494, 330]];
const CYL = [[440, 330], [700, 330], [700, 470], [440, 470]];
const PISTON = [[540, 345], [575, 345], [575, 455], [540, 455]];
// koło zamachowe i czop korby
const WX = 1000, WY = 400, PIN = [1054, 355];
const ring = (r, a0) => arc(WX, WY, r, a0, a0 + Math.PI * 2, 90);

export function buildPatent(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'patent', speed: 950 });
  const B = (n) => voice.beat(n);
  // odsyłacz: numer, potem cienka linia prowadząca do części
  const callout = (n, x, y, to, seed) => {
    sb.write(String(n), x, y, { size: 30, align: 'center', color: 'ink' });
    // linia wychodzi od krawędzi numeru w stronę części, lekko wygięta
    const cx = x, cy = y - 10, d = Math.hypot(to[0] - cx, to[1] - cy);
    const ux = (to[0] - cx) / d, uy = (to[1] - cy) / d;
    const a = [cx + ux * 20, cy + uy * 18];
    sb.pen(curve([a, [(a[0] + to[0]) / 2 - uy * 10, (a[1] + to[1]) / 2 + ux * 10], to], 10), { color: 'ink', w: 1.1, seed });
  };

  // 1. "Jak działa maszyna parowa? Wszystko zaczyna się w kotle pełnym wody. Pod spodem płonie ogień i podgrzewa wodę, aż zamieni się w gorącą parę."
  sb.say(B(1), () => {
    sb.write('Maszyna parowa', 640, 100, { size: 46, font: 'title', align: 'center', color: 'ink', cue: 'Jak' });
    sb.pen(polyline(BOILER, { closed: true, seed: 3, bow: 0.004 }), { color: 'ink', w: 2.4, seed: 3, cue: 'kotle.' });
    sb.crayon(WATER, { color: 'ink', seed: 4, dur: 0.9 });
    sb.strokes([line(100, 604, 330, 604, { seed: 5, bow: 0 }), flame(160, 0), flame(215, 2), flame(270, 4)], { color: 'ink', w: 2, seed: 6, cue: 'ogień' });
    callout(10, 75, 300, [118, 380], 7);
  });

  // 2. "Para pod wysokim ciśnieniem płynie rurą do metalowego cylindra. W środku napiera na ruchomy tłok i przesuwa go do przodu."
  sb.say(B(2), () => {
    sb.strokes([PIPE_A, PIPE_B], { color: 'ink', w: 2, seed: 10, cue: 'płynie' });
    sb.pen(polyline(CYL, { seed: 11, bow: 0.003 }), { color: 'ink', w: 2.6, seed: 11, cue: 'cylindra.' });
    callout(12, 650, 285, [665, 332], 12);
    sb.pen(polyline(PISTON, { seed: 13, bow: 0.003 }), { color: 'ink', w: 2, seed: 13, cue: 'tłok' });
    sb.crayon(PISTON, { color: 'ink', seed: 14 });
    sb.arrow(line(462, 400, 530, 400, { seed: 15, bow: 0 }), { color: 'ink', w: 1.6, head: 10, seed: 15 });
    callout(14, 495, 545, [548, 452], 16);
  });

  // 3. "Tłok pcha drąg, drąg pcha korbowód, a korbowód obraca wielkie, ciężkie koło zamachowe. Koło jest tak ciężkie,
  //    że kręci się równo, nawet gdy tłok zawraca."
  sb.say(B(3), () => {
    sb.strokes([line(575, 394, 780, 394, { seed: 20, bow: 0 }), line(575, 406, 780, 406, { seed: 21, bow: 0 })], { color: 'ink', w: 1.8, seed: 20, cue: 'drąg,' });
    sb.pen(line(780, 400, PIN[0], PIN[1], { seed: 22, bow: 0 }), { color: 'ink', w: 3, seed: 22, cue: 'korbowód,' });
    callout(16, 790, 480, [808, 398], 23);
    sb.pen(ring(165, -2.2), { color: 'ink', w: 2.6, seed: 24, cue: 'koło' });
    sb.pen(ring(146, -1.4), { color: 'ink', w: 1.4, seed: 25 });
    const spokes = Array.from({ length: 6 }, (_, i) => {
      const a = i * Math.PI / 3 + 0.3;
      return line(WX + Math.cos(a) * 20, WY + Math.sin(a) * 20, WX + Math.cos(a) * 146, WY + Math.sin(a) * 146, { seed: 26 + i, bow: 0 });
    });
    sb.strokes([arc(WX, WY, 20, 0, Math.PI * 2, 24), ...spokes], { color: 'ink', w: 1.8, seed: 34, speed: 1300 });
    // korba: ramię od piasty do czopu
    sb.pen(line(WX, WY, PIN[0], PIN[1], { seed: 36, bow: 0 }), { color: 'ink', w: 3.4, seed: 36 });
    sb.dot(PIN[0], PIN[1], 6, { color: 'ink' });
    callout(18, 1215, 235, [1128, 296], 35);
  });

  // 4. "Tak ruch tam i z powrotem zamienia się w obrót. Ten prosty pomysł napędzał fabryki, statki i lokomotywy."
  sb.say(B(4), () => {
    sb.arrow(line(640, 505, 705, 505, { seed: 40, bow: 0 }), { color: 'ink', w: 1.8, head: 11, seed: 40, cue: 'tam' });
    sb.arrow(line(640, 505, 580, 505, { seed: 41, bow: 0 }), { color: 'ink', w: 1.8, head: 11, seed: 41 });
    sb.arrow(arc(WX, WY, 192, -2.6, -1.15, 30), { color: 'ink', w: 1.8, head: 13, seed: 42, cue: 'obrót.' });
    sb.write('FIG. 1.', 1010, 650, { size: 34, font: 'title', align: 'center', color: 'ink', cue: 'pomysł' });
  });
  sb.wait(0.8);
  return sb;
}
