// Rolka 9:16, komiks: "Dlaczego lód pływa?" (~18 s z lektorką).
// Głos: examples/voice/reel-comic/. Szklanka z wodą (raster), kostka lodu tuż pod
// powierzchnią, powiększenie w kółku: cząsteczki w luźnej, sześciokątnej kratce.

import { Storyboard, line, polyline, ellipse, curve } from '../../../src/index.js';

const WATER = 520; // poziom wody
const rot = ([cx, cy], s, a) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [cx + (x * Math.cos(a) - y * Math.sin(a)) * s, cy + (x * Math.sin(a) + y * Math.cos(a)) * s]);
const CUBE = rot([272, 566], 52, 0.12); // ~10% nad wodą
const LENS = [556, 680], LR = 78;
const hex = Array.from({ length: 6 }, (_, i) => [LENS[0] + Math.cos((i * Math.PI) / 3) * 46, LENS[1] + Math.sin((i * Math.PI) / 3) * 46]);

export function buildReelComic(voice) {
  const sb = new Storyboard({ format: 'reel', theme: 'comic', speed: 1000 });
  const B = (n) => voice.beat(n);

  // 1. "Dlaczego lód pływa, skoro to też woda? Weźmy zwykłą szklankę wody."
  sb.say(B(1), () => {
    sb.write('Dlaczego lód pływa?', 360, 240, { size: 66, font: 'title', align: 'center', color: 'ink', cue: 'Dlaczego' });
    // szklanka i od razu woda w niej (jeden obiekt)
    sb.pen(polyline([[120, 420], [138, 860], [414, 860], [432, 420]], { closed: false, seed: 3 }), { color: 'ink', w: 3.4, seed: 3, cue: 'szklankę' });
    sb.crayon([[127, WATER], [425, WATER], [415, 853], [137, 853]], { color: 'sky', seed: 4, w: 30, spacing: 24 });
  });

  // 2. "Bo gdy woda zamarza, wszystkie jej cząsteczki układają się w luźną kratkę."
  sb.say(B(2), () => {
    sb.pen(polyline(CUBE, { seed: 5, bow: 0.01 }), { color: 'ink', w: 3.2, seed: 5, cue: 'zamarza' });
    // lód jasny i kryjący na wodzie, z delikatnym rastrem
    sb.crayon(CUBE, { color: 'white', seed: 6, w: 32, spacing: 28, blend: 'source-over', dots: 0.12 });
    // powiększenie: kółko, kreska do kostki, w środku sześciokąt cząsteczek
    sb.strokes([ellipse(LENS[0], LENS[1], LR, LR, { seed: 7, overshoot: 0.05 }), line(322, 600, LENS[0] - LR + 4, LENS[1] - 20, { seed: 8 })], { color: 'ink', w: 2.8, seed: 7, cue: 'cząsteczki' });
    sb.strokes([polyline(hex, { seed: 9, bow: 0 }), ...hex.map(([x, y], i) => ellipse(x, y, 8, 8, { seed: 20 + i, overshoot: 0.02 }))], { color: 'pen', w: 2.6, seed: 9, speed: 1500, cue: 'luźną' });
  });

  // 3. "Lód zajmuje więcej miejsca, więc jest lżejszy od wody."
  sb.say(B(3), () => {
    sb.arrow(line(272, 500, 272, 410, { seed: 30 }), { color: 'pen', w: 4, head: 18, seed: 30, cue: 'więcej' });
    sb.write('lżejszy!', 382, 395, { size: 52, font: 'title', align: 'center', color: 'pen', cue: 'lżejszy' });
  });

  // 4. "Dlatego z góry lodowej widać tylko mały czubek!"
  sb.say(B(4), () => {
    sb.write('90%\npod wodą', 560, 815, { size: 42, font: 'title', align: 'center', color: 'ink', cue: 'Dlatego' });
    sb.arrow(curve([[492, 812], [400, 770], [318, 612]], 10), { color: 'coral', w: 3.2, head: 15, seed: 40, cue: 'czubek' });
  });
  sb.wait(0.8);
  return sb;
}
