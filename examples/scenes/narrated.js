// "Jak działa agent AI?" z lektorem — demo synchronizacji obrazu z głosem.
// Głos: examples/voice/agent/voice.json (z tools/voice/voice.py tts script.md).
// Każde zdanie lektora to sb.say(beat, () => { ...rysunek... }); `cue: 'słowo'`
// ustawia moment, w którym ołówek dotyka kartki (0,3 s przed tym słowem).
// Na tablicy tylko słowa-klucze — pełne zdania są w głosie i w napisach.

import { Storyboard, rect, line, curve, ellipse, polygon, star } from '../../src/index.js';

export function buildNarrated(voice) {
  const sb = new Storyboard({ w: 1280, h: 720 });
  const B = (n) => voice.beat(n);

  const boxes = [
    { x: 110, y: 270, w: 220, h: 130, label: 'obserwacja', color: 'sky', size: 50 },
    { x: 530, y: 245, w: 220, h: 180, label: 'LLM', color: 'teal', size: 92 },
    { x: 950, y: 270, w: 220, h: 130, label: 'akcja', color: 'ochre', size: 56 },
  ];
  const box = (i, cue) => {
    const b = boxes[i];
    const r = rect(b.x, b.y, b.w, b.h, { seed: 10 + i });
    sb.pen(r, { color: 'ink', w: 3.4, seed: 10 + i, ...(cue ? { cue } : {}) });
    sb.write(b.label, b.x + b.w / 2, b.y + b.h / 2 + b.size * 0.3, { size: b.size, align: 'center', color: 'ink' });
    sb.crayon(r, { color: b.color, alpha: 0.55, spacing: 9, w: 13, seed: 20 + i, dur: 0.6 });
  };
  const link = (i) => {
    const b = boxes[i], n = boxes[i + 1], y = b.y + b.h / 2;
    return curve([[b.x + b.w + 12, y], [(b.x + b.w + n.x) / 2, y - 22], [n.x - 14, n.y + n.h / 2]], 10);
  };

  // 1. "Jak działa agent AI? Zajrzyjmy do środka."
  sb.say(B(1), () => {
    sb.write('Jak działa agent AI?', 640, 100, { size: 72, font: 'title', align: 'center', color: 'ink' });
    sb.highlight(line(390, 112, 890, 108, { seed: 2 }), 18, { dur: 0.5, color: 'ochre', cue: 'środka' });
  });

  // 2. "Wszystko zaczyna się od obserwacji: agent widzi zadanie i to, co dzieje się wokół."
  sb.say(B(2), () => box(0, 'obserwacji'));

  // 3. "Obserwacja trafia do modelu językowego, który decyduje, co zrobić dalej."
  sb.say(B(3), () => {
    sb.arrow(link(0), { w: 3, color: 'pen', seed: 30, head: 18, cue: 'trafia' });
    box(1);
  });

  // 4. "Model wybiera akcję: uruchamia narzędzie, pisze kod albo szuka w sieci."
  sb.say(B(4), () => {
    sb.arrow(link(1), { w: 3, color: 'pen', seed: 31, head: 18, cue: 'wybiera' });
    box(2);
  });

  // 5. "Wynik akcji wraca jako nowa obserwacja. I tak w kółko."
  sb.say(B(5), () => {
    sb.arrow(curve([[1060, 412], [1020, 540], [640, 585], [260, 540], [220, 414]], 14), { w: 2.6, color: 'pen', dash: [14, 10], seed: 40, head: 16, cue: 'wraca' });
    sb.write('pętla', 640, 640, { size: 46, align: 'center', color: 'pen', cue: 'kółko' });
  });

  // 6. "A w środku model myśli krok po kroku." — zbliżenie na model
  sb.camera({ x: 640, y: 335, zoom: 1.9 }, { dur: 1.0 });
  sb.say(B(6), () => {
    sb.pen(ellipse(640, 335, 150, 115, { seed: 50 }), { color: 'coral', w: 2.6, seed: 50, cue: 'myśli' });
    sb.write('krok po kroku', 640, 458, { size: 30, align: 'center', color: 'coral' });
  });
  sb.camera({ x: 640, y: 360, zoom: 1 }, { dur: 1.0 });

  // 7. "Kiedy taka pętla się kończy?" — gąbka, nowy rozdział
  sb.clear();
  sb.say(B(7), () => {
    sb.write('Kiedy stop?', 80, 120, { size: 64, font: 'title', color: 'ink' });
  });

  // 8. "Gdy zadanie jest wykonane, gdy agent nie robi postępów albo gdy skończy się limit kroków."
  //    każdy punkt: ptaszek dokładnie na swoim słowie, potem krótkie słowo-klucz
  //    (punkty padają co ~1,9 s — tyle ręka ma na ptaszka i słowo)
  const items = [['zrobione', 'wykonane'], ['bez postępu', 'postępów'], ['limit', 'limit']];
  sb.say(B(8), () => {
    items.forEach(([txt, cue], i) => {
      const y = 230 + i * 110;
      sb.pen(curve([[98, y - 16], [112, y + 2], [150, y - 58]], 8), { color: i === 0 ? 'pen' : 'coral', w: 5, seed: 70 + i, cue });
      sb.write(txt, 170, y + 4, { size: 48, color: 'ink' });
    });
  });

  // 9. "I wtedy agent mówi: gotowe!"
  sb.say(B(9), () => {
    const bubble = polygon([[860, 300], [1120, 292], [1132, 400], [960, 408], [920, 452], [928, 404], [852, 398]], { seed: 80, wobble: 4 });
    sb.pen(bubble, { color: 'ink', w: 2.8, seed: 80 });
    sb.write('gotowe!', 992, 368, { size: 64, align: 'center', color: 'pen', cue: 'gotowe' });
  });
  const st = star(1150, 250, 32, 14, 5, { seed: 9 });
  sb.pen(st, { color: 'ink', w: 2.2, seed: 9 });
  sb.crayon(st, { color: 'ochre', spacing: 5, w: 7, seed: 9, dur: 0.35 });
  sb.wait(1.2);
  return sb;
}
