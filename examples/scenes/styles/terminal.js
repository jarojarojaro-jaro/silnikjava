// Styl: terminal CRT (wektorowy monitor z lat 60.). "Apollo 11 i alarm 1202" — film
// z historii techniki z lektorem. Głos: examples/voice/terminal/.
// Zielony fosfor, linie ekranu; w ręce pióro świetlne.

import { Storyboard, line, polyline, curve, ellipse } from '../../../src/index.js';

const SURFACE = Array.from({ length: 27 }, (_, i) => [70 + i * 44, 600 + 10 * Math.sin(i * 0.9) + 6 * Math.cos(i * 2.1)]);
const PATH = curve([[150, 170], [420, 210], [640, 360], [745, 555]], 14); // tor zejścia
const LANDER = [[722, 520], [768, 520], [778, 548], [712, 548]];
const ALARM = [[860, 170], [1180, 170], [1180, 260], [860, 260]];
const CPU = [[860, 360], [1180, 360], [1180, 400], [860, 400]];

export function buildTerminal(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'terminal', speed: 1000 });
  const B = (n) => voice.beat(n);

  // 1. "Lipiec tysiąc dziewięćset sześćdziesiątego dziewiątego. Apollo jedenaście schodzi na Księżyc."
  sb.say(B(1), () => {
    sb.write('> APOLLO 11  [1969]', 90, 110, { size: 64, color: 'ink', cue: 'Lipiec' });
    sb.pen(SURFACE, { color: 'inkSoft', w: 2.4, seed: 3, speed: 1600, cue: 'Apollo' });
    sb.pen(PATH, { color: 'ink', w: 2.2, seed: 4, dash: [10, 9], cue: 'schodzi' });
  });

  // 2. "Nagle komputer pokładowy wyświetla alarm: tysiąc dwieście dwa."
  sb.say(B(2), () => {
    sb.pen(polyline(ALARM, { seed: 10, bow: 0 }), { color: 'ochre', w: 2.6, seed: 10, cue: 'komputer' });
    sb.write('ALARM 1202', 1020, 232, { size: 60, align: 'center', color: 'ochre', cue: 'alarm:' });
  });

  // 3. "Procesor jest przeciążony do granic, ale program sprytnie odrzuca mniej ważne zadania i liczy dalej."
  sb.say(B(3), () => {
    sb.write('CPU 100%', 860, 345, { size: 40, color: 'ink', cue: 'Procesor' });
    sb.pen(polyline(CPU, { seed: 20, bow: 0 }), { color: 'ink', w: 2.4, seed: 20 });
    sb.crayon(CPU, { color: 'coral', seed: 21, alpha: 0.6, spacing: 12 });
    sb.write('- radar', 860, 450, { size: 40, color: 'inkSoft', cue: 'odrzuca' });
    sb.pen(line(855, 438, 990, 438, { seed: 22, bow: 0 }), { color: 'coral', w: 2.6, seed: 22 });
    sb.write('- lądowanie OK', 860, 495, { size: 40, color: 'ink', cue: 'liczy' });
  });

  // 4. "Lądownik siada bezpiecznie. Orzeł wylądował."
  sb.say(B(4), () => {
    sb.pen(polyline(LANDER, { seed: 30, bow: 0 }), { color: 'pen', w: 2.6, seed: 30, cue: 'Lądownik' });
    sb.strokes([line(718, 548, 700, 590, { seed: 31, bow: 0 }), line(772, 548, 790, 590, { seed: 32, bow: 0 }), ellipse(745, 506, 14, 12, { seed: 33 })], { color: 'pen', w: 2.4, seed: 31, speed: 1400 });
    sb.write('"Orzeł wylądował"', 400, 670, { size: 48, align: 'center', color: 'ink', cue: 'Orzeł' });
  });
  sb.wait(0.8);
  return sb;
}
