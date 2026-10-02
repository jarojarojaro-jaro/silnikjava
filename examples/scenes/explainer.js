// Film objaśniający "Jak działa agent AI?" złożony deklaratywnie ze Storyboardu.
// Każda linijka to jeden krok — ołówek sam wędruje od kreski do kreski.

import { Storyboard, rect, line, curve, ellipse, polygon, clamp } from '../../src/index.js';
import { drawMascot } from './mascot.js';

export function buildExplainer() {
  const sb = new Storyboard({ w: 1280, h: 720 });

  // ---------------------------------------------------------- rozdział 1: pętla agenta
  sb.write('Jak działa agent AI?', 640, 100, { size: 72, font: 'title', align: 'center', color: 'ink', dur: 1.4 });
  sb.highlight(line(390, 112, 890, 108, { seed: 2 }), 18, { dur: 0.5, color: 'ochre' });
  sb.wait(0.3);

  const boxes = [
    { x: 110, y: 270, w: 220, h: 130, label: 'obserwacja', color: 'sky', size: 50 },
    { x: 530, y: 245, w: 220, h: 180, label: 'LLM', color: 'teal', size: 92 },
    { x: 950, y: 270, w: 220, h: 130, label: 'akcja', color: 'ochre', size: 56 },
  ];
  boxes.forEach((b, i) => {
    const r = rect(b.x, b.y, b.w, b.h, { seed: 10 + i });
    sb.pen(r, { color: 'ink', w: 3.4, seed: 10 + i });
    sb.crayon(r, { color: b.color, alpha: 0.55, spacing: 9, w: 13, seed: 20 + i, dur: 0.6 });
    sb.write(b.label, b.x + b.w / 2, b.y + b.h / 2 + b.size * 0.3, { size: b.size, align: 'center', color: 'ink' });
    if (i < boxes.length - 1) {
      const n = boxes[i + 1];
      const y = b.y + b.h / 2;
      sb.arrow(curve([[b.x + b.w + 12, y], [(b.x + b.w + n.x) / 2, y - 22], [n.x - 14, n.y + n.h / 2]], 10), { w: 3, color: 'pen', seed: 30 + i, head: 18 });
    }
  });

  // pętla wraca od akcji do obserwacji (linia przerywana)
  sb.arrow(curve([[1060, 412], [1020, 540], [640, 585], [260, 540], [220, 414]], 14), { w: 2.6, color: 'pen', dash: [14, 10], seed: 40, head: 16, dur: 1.6 });
  sb.write('wynik wraca jako nowa obserwacja', 640, 645, { size: 42, align: 'center', color: 'pen' });
  sb.wait(0.4);

  // zbliżenie na model
  sb.camera({ x: 640, y: 335, zoom: 1.9 }, { dur: 1.2 });
  sb.write('myśli krok po kroku', 640, 458, { size: 30, align: 'center', color: 'coral' });
  sb.pen(ellipse(640, 335, 150, 115, { seed: 50 }), { color: 'coral', w: 2.6, seed: 50 });
  sb.wait(0.6);
  sb.camera({ x: 640, y: 360, zoom: 1 }, { dur: 1.1 });
  sb.wait(0.8);

  // ---------------------------------------------------------- rozdział 2: kiedy stop
  sb.clear({ dur: 1 });
  sb.write('Kiedy pętla się kończy?', 80, 120, { size: 64, font: 'title', color: 'ink' });
  const items = ['zadanie wykonane', 'brak postępu', 'limit kroków'];
  items.forEach((txt, i) => {
    const y = 230 + i * 110;
    const box = rect(90, y - 40, 52, 52, { seed: 60 + i });
    sb.pen(box, { color: 'ink', w: 3, seed: 60 + i });
    sb.write(txt, 170, y + 4, { size: 58, color: 'ink' });
    sb.pen(curve([[98, y - 16], [112, y + 2], [150, y - 58]], 8), { color: i === 0 ? 'pen' : 'coral', w: 5, seed: 70 + i, dur: 0.35 });
  });

  // maskotka wychodzi zza krawędzi i mówi "gotowe!"
  sb.custom((sk, p, t) => drawMascot(sk, {
    x: 960, y: 450, scale: 1.1, seed: 9,
    draw: clamp(p * 1.6), fill: clamp(p * 2 - 0.8), detail: clamp(p * 2.5 - 1.5),
    wave: t > 0 && p >= 1 ? 0.5 + 0.5 * Math.sin(t * 5) : 0,
  }), { dur: 2.4, pencil: true });
  const bubble = polygon([[0, 0], [190, -6], [200, 70], [60, 76], [30, 108], [36, 74], [-6, 70]], { seed: 80, wobble: 4 });
  sb.pop(1010, 200, (sk) => {
    sk.fill(bubble, '#fffdf7');
    sk.pen(bubble, 1, { color: 'ink', w: 2.6, seed: 80 });
    sk.write('gotowe!', 96, 50, 1, { size: 44, align: 'center', color: 'pen' });
  }, { dur: 0.5 });
  sb.wait(1.5);
  return sb;
}
