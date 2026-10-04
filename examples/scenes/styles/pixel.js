// Styl: pixel art (ekran automatu, siatka 8 px). "Pong 1972" — film o historii gier
// z lektorem. Głos: examples/voice/pixel/. Każda kreska to schodki kratek,
// kolor kładziony kratka po kratce, w ręce pikselowy ołówek.

import { Storyboard, line, arc } from '../../../src/index.js';

// kontury idą środkami kratek (kratka 8 px), kolor wypełnia kratki w granicach bryły
const PAD_L = [[160, 328], [184, 328], [184, 424], [160, 424]];
const PAD_R = [[904, 376], [928, 376], [928, 472], [904, 472]];
// piłka leży na swoim torze (odbicie od dolnej ściany)
const BALL = [[704, 480], [728, 480], [728, 504], [704, 504]];
const cells = (poly) => {
  const [[x0, y0], , [x1, y1]] = poly;
  return [[x0 + 4, y0 + 4], [x1 - 4, y0 + 4], [x1 - 4, y1 - 4], [x0 + 4, y1 - 4], [x0 + 4, y0 + 4]];
};
// automat do gry (prawa kolumna): obudowa, podświetlony szyld, ekran, pulpit
const CABINET = [[1016, 216], [1184, 216], [1184, 600], [1016, 600]];
const MARQUEE = [[1016, 216], [1184, 216], [1184, 264], [1016, 264]];
const SCREEN = [[1040, 288], [1160, 288], [1160, 392], [1040, 392]];
const COIN = arc(1100, 528, 36, -Math.PI / 2, Math.PI * 1.5, 40);
// pokrętło gracza pod boiskiem
const KNOB = arc(172, 660, 22, -Math.PI / 2, Math.PI * 1.5, 32);

export function buildPixel(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'pixel', speed: 950 });
  const B = (n) => voice.beat(n);

  // 1. "W tysiąc dziewięćset siedemdziesiątym drugim roku powstała gra, która zmieniła rozrywkę na zawsze. Nazywała się Pong."
  sb.say(B(1), () => {
    sb.write('1972', 640, 128, { size: 64, weight: 700, align: 'center', color: 'ochre', cue: 'tysiąc' });
    // automat: od razu po dacie, bez czekania — ręka nie stoi na początku filmu
    sb.pen(cells(CABINET), { color: 'ink', w: 3, seed: 1 });
    sb.crayon(MARQUEE, { color: 'pen', seed: 2 });
    sb.pen(cells(SCREEN), { color: 'inkSoft', w: 3, seed: 3 });
    sb.strokes([line(1020, 420, 1180, 420, { seed: 4, bow: 0 }), line(1092, 452, 1108, 452, { seed: 5, bow: 0 })], { color: 'ink', w: 3, seed: 4 });
    sb.write('PONG', 380, 135, { size: 104, font: 'title', weight: 700, align: 'center', color: 'ink', cue: 'zawsze.' });
  });

  // 2. "Zasady były bardzo proste. Boisko z dwiema ścianami, linia na środku, dwie białe paletki, po jednej dla każdego gracza, i kwadratowa piłka."
  sb.say(B(2), () => {
    sb.strokes([line(120, 204, 960, 204, { seed: 3, bow: 0 }), line(960, 596, 120, 596, { seed: 4, bow: 0 })], { color: 'ink', w: 6, seed: 3, cue: 'Zasady' });
    sb.pen(line(540, 224, 540, 584, { seed: 5, bow: 0 }), { color: 'inkSoft', w: 3, seed: 5, dash: [16, 16], cue: 'linia' });
    sb.pen(cells(PAD_L), { color: 'ink', w: 3, seed: 6, cue: 'paletki' });
    sb.crayon(PAD_L, { color: 'ink', seed: 7 });
    sb.pen(cells(PAD_R), { color: 'ink', w: 3, seed: 8 });
    sb.crayon(PAD_R, { color: 'ink', seed: 9 });
    sb.pen(cells(BALL), { color: 'ink', w: 3, seed: 10, cue: 'piłka.' });
    sb.crayon(BALL, { color: 'ink', seed: 11 });
  });

  // 3. "Gracz kręcił pokrętłem, a paletka jeździła w górę i w dół. Piłka odbijała się od ściany i leciała na drugą stronę."
  sb.say(B(3), () => {
    sb.pen(KNOB, { color: 'teal', w: 3, seed: 19, cue: 'kręcił' });
    sb.pen(line(172, 660, 186, 646, { seed: 18, bow: 0 }), { color: 'teal', w: 3, seed: 18 });
    sb.arrow(line(224, 368, 224, 288, { seed: 20, bow: 0 }), { color: 'teal', w: 3, head: 16, seed: 20, cue: 'jeździła' });
    sb.arrow(line(224, 384, 224, 464, { seed: 21, bow: 0 }), { color: 'teal', w: 3, head: 16, seed: 21 });
    // tor piłki: przerywana linia, na końcu pełny grot
    sb.pen([[184, 376], [480, 580], [860, 432]], { color: 'ochre', w: 3, seed: 22, dash: [12, 10], cue: 'Piłka' });
    sb.arrow(line(860, 432, 896, 418, { seed: 23, bow: 0 }), { color: 'ochre', w: 3, head: 16, seed: 23 });
    // błysk odbicia przy ścianie
    sb.strokes([line(456, 560, 440, 544, { seed: 24, bow: 0 }), line(480, 556, 480, 532, { seed: 25, bow: 0 }), line(504, 560, 520, 544, { seed: 26, bow: 0 })], { color: 'ochre', w: 3, seed: 24, cue: 'ściany' });
  });

  // 4. "Kto nie odbił piłki, tracił punkt. Pierwszy automat stanął w barze w Kalifornii i po dwóch dniach
  //    przestał działać, bo był pełen monet."
  sb.say(B(4), () => {
    sb.write('3', 440, 290, { size: 80, align: 'center', color: 'ink', cue: 'Kto' });
    sb.write('2', 640, 290, { size: 80, align: 'center', color: 'ink' });
    sb.pen(COIN, { color: 'ochre', w: 6, seed: 30, cue: 'automat' });
    sb.crayon(COIN, { color: 'ochre', seed: 31 });
    sb.write('25¢', 1100, 540, { size: 30, weight: 700, align: 'center', color: 'paper' });
  });
  sb.wait(0.8);
  return sb;
}
