// Styl: komiks. "Dlaczego niebo jest niebieskie?" — ~15 s z lektorem.
// Głos: examples/voice/comic/. Pędzelek z mocnym naciskiem, płaski kolor
// z rastrem kropek (marker), dymek i napisy Bangers.

import { Storyboard, line, polyline, curve, ellipse } from '../../../src/index.js';

const P2 = [665, 160, 1220, 650]; // prawy "kadr": niebo w rastrze nad linią horyzontu
const SUN = [300, 400];
// dymek: owal z ogonkiem w stronę postaci
const bubble = (() => {
  const [cx, cy, rx, ry] = [1095, 568, 100, 48];
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * 0.72 + (i / 40) * Math.PI * 1.78;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return [...pts, [990, 640], pts[0]];
})();

export function buildComic(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'comic', speed: 1000 });
  const B = (n) => voice.beat(n);

  // 1. "Dlaczego niebo jest niebieskie?"
  sb.say(B(1), () => {
    sb.write('Dlaczego niebo jest niebieskie?', 640, 104, { size: 48, font: 'title', align: 'center', color: 'ink' });
  });

  // 2. "Światło słońca to mieszanka wszystkich kolorów."
  sb.say(B(2), () => {
    sb.pen(ellipse(SUN[0], SUN[1], 78, 78, { seed: 3, overshoot: 0.06 }), { color: 'ink', w: 3, seed: 3, cue: 'słońca' });
    [['pen', -0.35], ['teal', 0], ['sky', 0.35]].forEach(([color, a], i) => {
      const [sx, sy] = [SUN[0] + Math.cos(a) * 95, SUN[1] + Math.sin(a) * 95];
      sb.pen(line(sx, sy, sx + Math.cos(a) * 170, sy + Math.sin(a) * 170, { seed: 5 + i }), { color, w: 4, seed: 5 + i, speed: 1600, ...(i ? {} : { cue: 'wszystkich' }) });
    });
    sb.crayon(ellipse(SUN[0], SUN[1], 80, 80, { seed: 4 }), { color: 'ochre', seed: 4 });
  });

  // 3. "Powietrze rozprasza niebieski najmocniej, więc widzimy go na całym niebie, z każdej strony."
  sb.say(B(3), () => {
    sb.crayon([[P2[0] + 2, P2[1] + 2], [P2[2] - 2, P2[1] + 2], [P2[2] - 2, 450], [P2[0] + 2, 450]], { color: 'sky', seed: 10, w: 34, spacing: 28, cue: 'niebieski' });
    // rozproszone światło: krótkie zygzaki we wszystkie strony
    // ramka kadru nieba — szybkie, proste pociągnięcia
    sb.pen(polyline([[P2[0], P2[1]], [P2[2], P2[1]], [P2[2], 450], [P2[0], 450]], { seed: 9, bow: 0.006 }), { color: 'ink', w: 3.6, seed: 9 });
    // promień zygzakiem od środka na zewnątrz: co krok odchylenie ±9 px w poprzek
    const zig = (a) => Array.from({ length: 8 }, (_, i) => {
      const r = 40 + i * 13, off = i % 2 ? 9 : -9;
      return [940 + Math.cos(a) * r - Math.sin(a) * off, 305 + Math.sin(a) * r + Math.cos(a) * off];
    });
    sb.strokes([-2.6, -1.57, -0.5, 0.45, 2.7].map(zig), { color: 'white', w: 3.4, seed: 12, speed: 1600, cue: 'każdej' });
  });

  // 4. "I właśnie dlatego niebo jest niebieskie!"
  sb.say(B(4), () => {
    sb.strokes([ellipse(930, 615, 30, 30, { seed: 13 }), curve([[915, 622], [930, 633], [946, 621]], 8)], { color: 'ink', w: 3, seed: 13, cue: 'właśnie' });
    sb.pen(bubble, { color: 'ink', w: 3, seed: 14, cue: 'niebo' });
    sb.write('AHA!', 1095, 588, { size: 58, font: 'title', align: 'center', color: 'pen', dur: 0.7 });
  });
  sb.wait(0.8);
  return sb;
}
