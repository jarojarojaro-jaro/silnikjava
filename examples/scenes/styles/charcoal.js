// Styl: węgiel (rysunek węglem na papierze Ingres, roztarcia palcem, sangwina
// jako jedyny kolor). "Pompeje: ostatni dzień" — film historyczny z lektorką.
// Głos: examples/voice/charcoal/.

import { Storyboard, line, polyline, catmull, chain } from '../../../src/index.js';

// stożek z płaskim kraterem
const VOLCANO = polyline([[500, 600], [700, 420], [815, 305], [835, 298], [905, 298], [925, 305], [1040, 420], [1250, 600]], { closed: false, seed: 2, bow: 0.012 });
// słup erupcji: kłębiasta chmura (brzeg z "kalafiorowych" garbów) na krótkim pniu nad kraterem
const CLOUD = (() => {
  const out = [[838, 298]];
  for (let i = 0; i <= 60; i++) {
    const a = Math.PI * 0.62 + (i / 60) * Math.PI * 1.76;
    const k = 1 + 0.12 * Math.abs(Math.sin(a * 4.5));
    out.push([880 + Math.cos(a) * 165 * k, 168 + Math.sin(a) * 100 * k]);
  }
  out.push([902, 298]);
  return catmull(out, 3, true);
})();
// spływ piroklastyczny: dół po zboczu, góra kłębiasta
const FLOW = catmull([[850, 300], [815, 306], [700, 420], [500, 600], [400, 602], [425, 560], [490, 530], [545, 482], [600, 455], [642, 405], [700, 370], [742, 322], [790, 282], [832, 284]], 6, true);
const ASH = [[60, 545], [200, 528], [350, 538], [500, 524], [660, 545], [660, 612], [60, 612]];
// popiół: krótkie, ukośne kreski nad miastem
const flakes = Array.from({ length: 12 }, (_, i) => {
  const x = 95 + ((i * 197) % 470), y = 215 + ((i * 89) % 180);
  return [[x, y], [x - 7, y + 16]];
});

export function buildCharcoal(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'charcoal', speed: 950 });
  const B = (n) => voice.beat(n);

  // 1. "Rok siedemdziesiąty dziewiąty naszej ery. Pompeje, bogate rzymskie miasto u stóp Wezuwiusza, żyje zwykłym, spokojnym dniem.
  //    Na targu gwar, w łaźniach tłok."
  sb.say(B(1), () => {
    sb.write('Pompeje, 79 n.e.', 60, 100, { size: 50, font: 'title', weight: 700, color: 'ink', cue: 'Rok' });
    // świątynia: fronton, belka, kolumny, stopień
    sb.strokes([
      polyline([[90, 470], [210, 415], [330, 470]], { closed: true, seed: 5, bow: 0.01 }),
      line(100, 482, 320, 482, { seed: 6 }),
      // kolumny na zmianę z góry i z dołu — krótkie przeloty ręki
      ...chain([125, 185, 245, 305].map((x, i) => line(x, 488, x, 590, { seed: 7 + i, bow: 0.01 })), [320, 482]),
    ], { color: 'ink', w: 2.8, seed: 5, speed: 1250, cue: 'Pompeje,' });
    sb.strokes([
      polyline([[360, 515], [450, 515], [450, 600], [360, 600]], { seed: 14, bow: 0.01 }),
      line(40, 600, 500, 600, { seed: 16 }),
    ], { color: 'ink', w: 2.6, seed: 14, speed: 1250 });
    // wulkan: zbocze, potem roztarty cień
    sb.pen(VOLCANO, { color: 'ink', w: 3.6, seed: 3, cue: 'Wezuwiusza,' });
    sb.crayon(VOLCANO, { color: 'inkSoft', seed: 4, alpha: 0.55, w: 70, spacing: 60 });
    // „Na targu gwar”: ludzie na placu przed świątynią (głowa, tułów, nogi)
    const person = (x, h) => [
      [[x, 600 - h], [x, 600 - h * 0.45]],
      [[x - 7, 600], [x, 600 - h * 0.45], [x + 7, 600]],
      [[x - 9, 600 - h * 0.72], [x + 9, 600 - h * 0.62]],
    ];
    sb.strokes([...person(470, 46), ...person(498, 40), ...person(522, 44)], { color: 'ink', w: 2.4, seed: 17, cue: 'targu' });
  });

  // 2. "W południe góra wybucha. Ogromny słup popiołu i kamieni wznosi się na trzydzieści kilometrów w niebo."
  sb.say(B(2), () => {
    sb.pen(CLOUD, { color: 'ink', w: 3.2, seed: 20, cue: 'południe' });
    sb.crayon(CLOUD, { color: 'ink', seed: 21, alpha: 0.7 });
    sb.pen(line(1095, 300, 1125, 300, { seed: 22, bow: 0 }), { color: 'ink', w: 2.4, seed: 22, cue: 'trzydzieści' });
    sb.arrow(line(1110, 300, 1110, 95, { seed: 23, bow: 0 }), { color: 'ink', w: 2.4, head: 14, seed: 23 });
    sb.write('30 km', 1180, 210, { size: 38, align: 'center', color: 'ink' });
  });

  // 3. "Popiół spada na ulice jak gęsty, szary śnieg. Następnego ranka zboczem spływa rozżarzona chmura gorącego gazu
  //    i pyłu, szybsza niż koń w galopie."
  sb.say(B(3), () => {
    sb.strokes(chain(flakes), { color: 'inkSoft', w: 2.4, seed: 30, speed: 1500, cue: 'Popiół' });
    sb.pen(FLOW, { color: 'pen', w: 3, seed: 31, cue: 'zboczem' });
    sb.crayon(FLOW, { color: 'pen', seed: 32, alpha: 0.9, w: 50, spacing: 40 });
  });

  // 4. "Miasto znika pod grubą warstwą popiołu na prawie dwa tysiące lat. Dziś archeolodzy odkopują je ulica po ulicy."
  sb.say(B(4), () => {
    sb.pen(catmull(ASH.slice(0, 5), 8), { color: 'ink', w: 3, seed: 40, cue: 'Miasto' });
    // popiół wraca na już narysowane miasto — świadomy powrót
    sb.crayon(ASH, { color: 'inkSoft', seed: 41, alpha: 0.75, w: 50, spacing: 40, revisit: true });
    sb.write('pod popiołem 1700 lat', 360, 668, { size: 34, align: 'center', color: 'ink', cue: 'tysiące' });
  });
  sb.wait(0.8);
  return sb;
}
