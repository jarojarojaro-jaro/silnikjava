// Styl: ASCII (filtr klatki src/ascii.js). "ASCII: alfabet komputerów" — film
// o historii techniki z lektorem. Głos: examples/voice/ascii/.
// Ręka rysuje zwykłe kreski, a ekran pokazuje je jako znaki: kreska → - / | \,
// plama → . : = + * # @. Napisy duże (≥ 48 px), bo litera to kilka komórek siatki.

import { Storyboard, line, polyline, circle } from '../../../src/index.js';

const box = (x, y, w, h, seed) => polyline([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { seed, bow: 0 });
// linie proste kładziemy na środkach komórek siatki 9 × 16 (x = 9k + 4,5, y = 16k + 8),
// inaczej krawędź wypada na granicy dwóch rzędów i dubluje się
const MONITOR = box(445.5, 120, 396, 224, 3);
const STAND = polyline([[608, 344], [598, 376], [684, 376], [670, 344]], { closed: false, seed: 4, bow: 0 });
// klawiatura pod ekranem: obrys i rzędy klawiszy
const KEYS = box(472.5, 408, 333, 32, 5);
const KEY_LINES = Array.from({ length: 8 }, (_, i) => line(472.5 + 36 * (i + 1), 411, 472.5 + 36 * (i + 1), 437, { seed: 6 + i, bow: 0 }));
// pole na siedem bitów: krok bitu = dwa znaki pisma mono (0,6 em × 2), więc „1 0 0 …” wypełnia pole równo
const BIT_SIZE = 58, BIT_W = BIT_SIZE * 0.6 * 2, BIT_X = 589.5;
const BITS = box(BIT_X, 456, 486, 80, 30);

// kot: głowa, uszy, wąsy, pyszczek, oczy
const CAT = {
  head: circle(1055, 250, 95, { seed: 40, overshoot: 0.04 }),
  ears: [polyline([[985, 190], [975, 118], [1030, 160]], { closed: false, seed: 41 }), polyline([[1080, 160], [1135, 118], [1125, 190]], { closed: false, seed: 42 })],
  face: [
    line(975, 296, 925, 286, { seed: 45 }), line(975, 310, 925, 320, { seed: 46 }),
    line(1135, 296, 1185, 286, { seed: 47 }), line(1135, 310, 1185, 320, { seed: 48 }),
    polyline([[1040, 315], [1055, 328], [1070, 315]], { closed: false, seed: 49 }),
    circle(1022, 240, 7, { seed: 43, overshoot: 0.05 }), circle(1088, 240, 7, { seed: 44, overshoot: 0.05 }),
  ],
};

export function buildAscii(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'ascii', speed: 950 });
  const B = (n) => voice.beat(n);

  // 1. "W tysiąc dziewięćset sześćdziesiątym trzecim roku inżynierowie ustalili wspólny alfabet dla komputerów. Nazwali go ASCII."
  sb.say(B(1), () => {
    sb.write('1963', 110, 150, { size: 72, font: 'title', weight: 700, color: 'ochre', cue: 'tysiąc' });
    // komputer: ekran i nóżka od razu po dacie
    sb.pen(MONITOR, { color: 'ink', w: 4, seed: 3 });
    sb.pen(STAND, { color: 'ink', w: 4, seed: 4 });
    sb.pen(KEYS, { color: 'ink', w: 3.4, seed: 5 });
    sb.strokes(KEY_LINES, { color: 'inkSoft', w: 3, seed: 6, speed: 1400 });
    sb.write('ASCII', 643, 274, { size: 120, font: 'title', weight: 700, align: 'center', color: 'ink', cue: 'Nazwali' });
  });

  // 2. "Każdy znak dostał swój numer. Wielkie A to sześćdziesiąt pięć, a wielkie B to sześćdziesiąt sześć."
  sb.say(B(2), () => {
    sb.write('znak → kod', 90, 425, { size: 34, color: 'inkSoft', cue: 'Każdy' });
    sb.write('A = 65', 90, 510, { size: 76, font: 'title', weight: 700, color: 'pen', cue: 'Wielkie' });
    sb.write('B = 66', 90, 625, { size: 76, font: 'title', weight: 700, color: 'ink', cue: 'B' });
  });

  // 3. "Komputer zapisuje ten numer w bitach, czyli zerach i jedynkach. Siedem bitów wystarcza na sto dwadzieścia osiem znaków."
  sb.say(B(3), () => {
    // akcent (pomarańczowy = litera A): jej numer w bitach
    sb.pen(BITS, { color: 'pen', w: 3.4, seed: 30, cue: 'Komputer' });
    sb.write('1 0 0 0 0 0 1', BIT_X + BIT_W / 4, 517, { size: BIT_SIZE, font: 'title', weight: 700, color: 'pen', cue: 'bitach,' });
    sb.write('7 bitów = 128', 885, 640, { size: 64, font: 'title', weight: 700, align: 'center', color: 'ink', cue: 'Siedem' });
  });

  // 4. "Szybko okazało się, że ze znaków można też rysować obrazki. Tak narodził się ASCII art."
  sb.say(B(4), () => {
    sb.pen(CAT.head, { color: 'ink', w: 4, seed: 40, cue: 'Szybko' });
    sb.strokes(CAT.ears, { color: 'ink', w: 4, seed: 41 });
    sb.strokes(CAT.face, { color: 'ink', w: 3, seed: 45 });
    sb.write('ASCII art', 1055, 400, { size: 44, align: 'center', color: 'inkSoft' });
  });
  sb.wait(0.8);
  return sb;
}
