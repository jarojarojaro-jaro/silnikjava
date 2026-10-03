// Styl: stara mapa na pergaminie. "Grunwald 1410" — film historyczny z lektorem.
// Głos: examples/voice/parchment/. Pióro gęsie z kałamarza (kreska blednie, gdy
// kończy się atrament), akwarelowe podkolorowanie jak na dawnych mapach.

import { Storyboard, line, polyline, curve, star } from '../../../src/index.js';

const ZAKON = [720, 360, 1010, 470], KROL = [230, 400, 540, 510]; // x0, y0, x1, y1
const box = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// krzyż zakonny: dwie krótkie kreski
const cross = (x, y, s, seed) => [line(x - s, y, x + s, y, { seed, bow: 0 }), line(x, y - s, x, y + s, { seed: seed + 1, bow: 0 })];

export function buildParchment(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'parchment', speed: 900 });
  const B = (n) => voice.beat(n);
  // czworobok wojska: obrys → kolor → znaki wewnątrz → podpis → dodatki obok (chorągiew)
  const army = (r, color, label, seed, cue, { inside, after } = {}) => {
    sb.pen(polyline(box(r), { seed, bow: 0.012 }), { color: 'ink', w: 3, seed, cue });
    sb.crayon(box(r), { color, seed: seed + 1 });
    inside?.();
    sb.write(label, (r[0] + r[2]) / 2, r[3] + 42, { size: 34, align: 'center', color: 'ink' });
    after?.();
  };

  // 1. "Piętnasty lipca tysiąc czterysta dziesiątego roku. Pola pod Grunwaldem."
  sb.say(B(1), () => {
    sb.write('Grunwald 1410', 640, 108, { size: 78, font: 'title', align: 'center', color: 'ink', cue: 'Piętnasty' });
    sb.dot(560, 250, 8, { color: 'ink', cue: 'Pola' });
    sb.write('Grunwald', 580, 260, { size: 34, color: 'inkSoft' });
    // rzeka przecinająca pola
    sb.pen(curve([[60, 640], [300, 600], [520, 650], [760, 610], [1000, 655], [1240, 620]], 12), { color: 'sky', w: 3, seed: 45, speed: 1400 });
  });

  // 2. "Po jednej stronie stają wojska zakonu krzyżackiego, w białych płaszczach z czarnym krzyżem."
  sb.say(B(2), () => {
    army(ZAKON, 'coral', 'Zakon', 10, 'stają', {
      inside: () => sb.strokes([...cross(790, 415, 16, 30), ...cross(865, 415, 16, 32), ...cross(940, 415, 16, 34)], { color: 'ink', w: 3, seed: 30, speed: 1400, cue: 'krzyżem' }),
    });
  });

  // 3. "Naprzeciw armia polsko-litewska króla Władysława Jagiełły, pod czerwoną chorągwią z białym orłem."
  sb.say(B(3), () => {
    army(KROL, 'sky', 'Polska i Litwa', 20, 'armia', { after: () => {
      // chorągiew: drzewce, płat, zaraz kolor
      sb.pen(line(300, 400, 300, 300, { seed: 50, bow: 0 }), { color: 'ink', w: 3, seed: 50, cue: 'chorągwią' });
      sb.pen(polyline([[300, 302], [372, 310], [366, 348], [300, 340]], { seed: 51 }), { color: 'ink', w: 2.6, seed: 51 });
      sb.crayon([[302, 304], [370, 312], [364, 346], [302, 338]], { color: 'pen', seed: 52, w: 20, spacing: 14 });
    } });
  });

  // 4. "Po całodniowej bitwie Zakon ponosi klęskę, a jego potęga słabnie na zawsze."
  sb.say(B(4), () => {
    sb.arrow(curve([[550, 430], [630, 395], [705, 400]], 10), { color: 'pen', w: 3.4, head: 16, seed: 40, cue: 'bitwie' });
    sb.strokes([line(735, 372, 995, 458, { seed: 42 }), line(995, 372, 735, 458, { seed: 43 })], { color: 'pen', w: 4, seed: 42, cue: 'klęskę' });
    // róża wiatrów w rogu mapy
    sb.pen(star(1150, 200, 46, 14, 4, { seed: 44 }), { color: 'ink', w: 2.4, seed: 44, cue: 'potęga' });
  });
  sb.wait(0.8);
  return sb;
}
