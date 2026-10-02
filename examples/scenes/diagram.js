// Diagram rysowany scrollem: każdy krok listy dokłada fragment rysunku.
// Czas sceny nie płynie sam — wyznacza go pozycja przewinięcia (scrollDrive).

import { Storyboard, rect, line, curve, ellipse, star, circle, polygon } from '../../src/index.js';

export const STEPS = [
  { title: 'Model', text: 'W środku siedzi model językowy — dostaje tekst, odpowiada tekstem.' },
  { title: 'Narzędzia', text: 'Zamiast tylko mówić, model może wywołać terminal, przeglądarkę albo edytor plików.' },
  { title: 'Pętla', text: 'Wynik narzędzia wraca do modelu jako nowa obserwacja. I tak w kółko.' },
  { title: 'Pamięć', text: 'Notatki z poprzednich zadań lądują poza oknem kontekstu i wracają, gdy są potrzebne.' },
  { title: 'Ocena', text: 'Coś musi powiedzieć, czy było dobrze: testy, recenzja, metryka.' },
  { title: 'Samodoskonalenie', text: 'Ocena zmienia agenta: nowe narzędzia, lepsze prompty, poprawiony kod.' },
];

export function buildScrollDiagram() {
  const sb = new Storyboard({ w: 900, h: 900, paper: false, idle: 'still' });

  // 1. model
  sb.mark('step0');
  const llm = rect(330, 330, 240, 170, { seed: 1 });
  sb.pen(llm, { color: 'ink', w: 3.6, dur: 1 });
  sb.crayon(llm, { color: 'teal', alpha: 0.55, spacing: 9, w: 13, seed: 2, dur: 0.6 });
  sb.write('LLM', 450, 438, { size: 90, align: 'center', color: 'ink', dur: 0.6 });
  sb.wait(0.4);

  // 2. narzędzia
  sb.mark('step1');
  const tools = [
    { x: 120, y: 120, label: 'terminal' },
    { x: 400, y: 90, label: 'web' },
    { x: 680, y: 120, label: 'pliki' },
  ];
  tools.forEach((tool, i) => {
    const r = rect(tool.x, tool.y, 100, 80, { seed: 10 + i });
    sb.pen(r, { color: 'ink', w: 3, dur: 0.5 });
    if (i === 0) sb.write('>_', tool.x + 22, tool.y + 52, { size: 38, font: 'mono', color: 'pen', dur: 0.3 });
    if (i === 1) {
      sb.pen(circle(tool.x + 50, tool.y + 40, 24, { seed: 3 }), { color: 'pen', w: 2.4, dur: 0.3 });
      sb.pen(ellipse(tool.x + 50, tool.y + 40, 10, 24, { seed: 4 }), { color: 'pen', w: 2, dur: 0.25 });
    }
    if (i === 2) sb.pen(polygon([[tool.x + 32, tool.y + 14], [tool.x + 60, tool.y + 14], [tool.x + 72, tool.y + 26], [tool.x + 72, tool.y + 66], [tool.x + 32, tool.y + 66]], { seed: 5 }), { color: 'pen', w: 2.4, dur: 0.3 });
    sb.write(tool.label, tool.x + 50, tool.y + 116, { size: 30, align: 'center', color: 'inkSoft', dur: 0.3 });
    sb.arrow(line(450 + (tool.x + 50 - 450) * 0.35, 322, tool.x + 50 + (450 - tool.x - 50) * 0.1, tool.y + 128, { seed: 20 + i, bow: 0.06 }), { color: 'pen', w: 2.4, head: 12, dur: 0.4 });
  });
  sb.wait(0.4);

  // 3. pętla
  sb.mark('step2');
  sb.arrow(curve([[580, 470], [720, 520], [730, 640], [600, 690], [450, 700], [300, 690], [170, 640], [180, 520], [320, 470]], 12), {
    color: 'pen', w: 2.8, dash: [14, 10], head: 16, dur: 1.4,
  });
  sb.write('obserwacja → myśl → akcja', 450, 760, { size: 36, align: 'center', color: 'pen', dur: 0.7 });
  sb.wait(0.4);

  // 4. pamięć — stos kartek
  sb.mark('step3');
  [0, 1, 2].forEach((k) => {
    const c = rect(60 + k * 10, 360 - k * 12, 110, 80, { seed: 30 + k });
    sb.fill(c, { color: '#fffdf7', dur: 0.1 });
    sb.pen(c, { color: 'ink', w: 2.6, dur: 0.35 });
  });
  sb.pen(line(90, 330, 170, 330, { seed: 33 }), { color: 'inkSoft', w: 2, dur: 0.2 });
  sb.pen(line(90, 350, 150, 350, { seed: 34 }), { color: 'inkSoft', w: 2, dur: 0.2 });
  sb.write('pamięć', 135, 470, { size: 32, align: 'center', color: 'inkSoft', dur: 0.3 });
  sb.arrow(curve([[190, 380], [260, 400], [322, 410]], 8), { color: 'pen', w: 2.4, head: 12, dur: 0.4 });
  sb.wait(0.4);

  // 5. ocena
  sb.mark('step4');
  const judge = rect(700, 340, 140, 100, { seed: 40 });
  sb.pen(judge, { color: 'ink', w: 2.8, dur: 0.6 });
  sb.crayon(judge, { color: 'ochre', alpha: 0.5, spacing: 8, w: 11, seed: 41, dur: 0.4 });
  sb.pen(curve([[735, 392], [760, 418], [805, 360]], 8), { color: 'pen', w: 6, dur: 0.35 });
  sb.write('ocena', 770, 480, { size: 32, align: 'center', color: 'inkSoft', dur: 0.3 });
  sb.arrow(curve([[578, 410], [640, 395], [692, 392]], 8), { color: 'pen', w: 2.4, head: 12, dur: 0.4 });
  sb.wait(0.4);

  // 6. samodoskonalenie — wielka strzałka od oceny z powrotem do agenta + gwiazdka
  sb.mark('step5');
  sb.arrow(curve([[790, 330], [820, 200], [700, 40], [450, 30], [210, 50], [60, 160], [40, 280], [70, 340]], 14), {
    color: 'coral', w: 3.4, head: 18, dur: 1.6,
  });
  sb.write('v2', 30, 330, { size: 40, color: 'coral', dur: 0.3 });
  sb.pop(840, 300, (sk) => {
    const s = star(0, 0, 30, 13, 5, { seed: 9 });
    sk.crayon(s, 1, { color: 'ochre', spacing: 5, w: 7, seed: 9 });
    sk.pen(s, 1, { color: 'ink', w: 2.2, seed: 9, still: true });
  }, { dur: 0.5 });
  sb.wait(0.3);
  return sb;
}
