// Styl: tablica kredowa. "Twierdzenie Pitagorasa" — 15 s z lektorką.
// Głos: examples/voice/chalk/ (tools/voice/voice.py tts script.md).
// Kreda: kreska z ziarnem tablicy, kolorowa kreda do kwadratów, gąbka zamiast gumki.

import { Storyboard, polyline } from '../../../src/index.js';

// trójkąt 3 : 4 : 5 — kąt prosty w C, przyprostokątne a (pionowa) i b (pozioma)
const C = [400, 470], A = [400, 350], B = [560, 470];
const centre = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
const G = centre([A, B, C]);
// kwadrat zbudowany na boku p→q, na zewnątrz trójkąta
const sq = (p, q) => {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const side = (k) => [p, q, [q[0] + dy * k, q[1] - dx * k], [p[0] + dy * k, p[1] - dx * k]];
  const d = (pts) => Math.hypot(centre(pts)[0] - G[0], centre(pts)[1] - G[1]);
  return d(side(1)) > d(side(-1)) ? side(1) : side(-1);
};
export function buildChalk(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'chalk', speed: 950 });
  const B_ = (n) => voice.beat(n);
  const squares = [
    { pts: sq(A, C), color: 'coral', label: 'a²', seed: 11 },
    { pts: sq(C, B), color: 'sky', label: 'b²', seed: 12 },
    { pts: sq(B, A), color: 'ochre', label: 'c²', seed: 13 },
  ];

  // 1. "Twierdzenie Pitagorasa. Weźmy trójkąt prostokątny."
  sb.say(B_(1), () => {
    sb.write('Twierdzenie Pitagorasa', 640, 92, { size: 58, font: 'title', align: 'center', color: 'ink' });
    sb.pen(polyline([A, B, C], { seed: 4, overshoot: 0.05 }), { color: 'ink', w: 3.4, seed: 4, cue: 'trójkąt' });
    sb.pen(polyline([[400, 450], [420, 450], [420, 470]], { closed: false, seed: 5 }), { color: 'ink', w: 2.2, seed: 5 });
  });

  // 2. "Na każdym boku budujemy kwadrat." — kolorowa kreda, jeden kwadrat na bok
  sb.say(B_(2), () => {
    squares.forEach((s, i) => sb.pen(polyline(s.pts, { seed: s.seed, overshoot: 0.06 }), { color: s.color, w: 3, seed: s.seed, ...(i === 0 ? { cue: 'boku' } : {}) }));
  });

  // 3. "A kwadrat plus b kwadrat równa się c kwadrat. Zawsze."
  sb.say(B_(3), () => {
    const y = 400, size = 66;
    sb.write('a²', 760, y, { size, color: 'coral', cue: 'kwadrat' });
    sb.write('+', 832, y, { size, color: 'ink' });
    sb.write('b²', 890, y, { size, color: 'sky' });
    sb.write('=', 975, y, { size, color: 'ink' });
    sb.write('c²', 1030, y, { size, color: 'ochre', cue: 'c' });
    sb.pen(polyline([[735, 325], [1130, 318], [1135, 432], [740, 440]], { seed: 21, overshoot: 0.05 }), { color: 'ink', w: 2.6, seed: 21, cue: 'Zawsze' });
  });
  // po zdaniu: lekkie podkolorowanie największego kwadratu — "c²" to suma
  sb.crayon(squares[2].pts, { color: 'ochre', seed: 31 });
  sb.write('c²', ...centre(squares[2].pts).map((v, i) => v + (i ? 14 : 0)), { size: 46, align: 'center', color: 'ink' });
  sb.wait(0.8);
  return sb;
}
