// Styl: papier pakowy (kraft). "Kawa z dripa" — ~15 s z lektorką.
// Głos: examples/voice/kraft/. Czarny cienkopis, biały żelopis do podpisów,
// kredki z włóknami papieru przebijającymi przez kolor, taśma w rogach.

import { Storyboard, line, curve, ellipse, polyline, catmull } from '../../../src/index.js';

// ziarno kawy: owal pod kątem + bruzda przez środek
const BEAN = ellipse(250, 360, 50, 72, { seed: 4, overshoot: 0.05 }).map(([x, y]) => {
  const a = 0.5, dx = x - 250, dy = y - 360;
  return [250 + dx * Math.cos(a) - dy * Math.sin(a), 360 + dx * Math.sin(a) + dy * Math.cos(a)];
});
const CREASE = curve([[222, 308], [262, 345], [238, 380], [278, 412]], 10);
// drip: lejek z filtrem nad dzbankiem
const DRIP = [[555, 295], [725, 295], [672, 392], [608, 392]];
// filiżanka i jej wnętrze (na kawę)
const CUP = catmull([[940, 325], [948, 420], [1030, 445], [1112, 420], [1120, 325]], 10);
// wnętrze: ta sama krzywa, odsunięta o kilka pikseli do środka
const CUP_IN = catmull([[947, 330], [955, 416], [1030, 438], [1105, 416], [1113, 330]], 10);
const HANDLE = curve([[1118, 345], [1158, 352], [1152, 392], [1110, 400]], 10);
const steam = (x, s) => Array.from({ length: 12 }, (_, i) => [x + 7 * Math.sin(i * 0.9 + s), 308 - i * 8]);

export function buildKraft(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'kraft', speed: 950 });
  const B = (n) => voice.beat(n);
  const label = (text, x, cue) => sb.write(text, x, 535, { size: 50, align: 'center', color: 'pen', font: 'title', ...(cue ? { cue } : {}) });

  // 1. "Kawa z dripa w trzech prostych krokach."
  sb.say(B(1), () => {
    sb.write('Kawa z dripa', 640, 118, { size: 84, font: 'title', align: 'center', color: 'ink' });
    // podkreślenie tytułu białym żelopisem — ręka nie stoi, zanim padną „trzy kroki”
    sb.pen(curve([[430, 150], [640, 160], [850, 148]], 12), { color: 'pen', w: 3, seed: 2 });
  });

  // 2. "Weź ziarna kawy, zmiel je średnio grubo, wystarczy piętnaście gramów."
  sb.say(B(2), () => {
    sb.pen(BEAN, { color: 'ink', w: 3, seed: 4, cue: 'Weź' });
    sb.pen(CREASE, { color: 'ink', w: 2.6, seed: 5 });
    sb.crayon(BEAN, { color: 'inkSoft', seed: 6 });
    label('15 g', 250, 'wystarczy');
  });

  // 3. "Zalej ją wodą o temperaturze dziewięćdziesięciu czterech stopni."
  sb.say(B(3), () => {
    sb.pen(polyline(DRIP, { seed: 7, bow: 0.01 }), { color: 'ink', w: 3, seed: 7, cue: 'Zalej' });
    sb.strokes([line(640, 272, 640, 240, { seed: 8 }), line(615, 265, 610, 240, { seed: 9 }), line(665, 265, 670, 240, { seed: 10 })], { color: 'sky', w: 3, seed: 8, speed: 1500 });
    sb.dot(640, 420, 7, { color: 'sky' });
    label('94°C', 640, 'dziewięćdziesięciu');
  });

  // 4. "Kawa przecieka do filiżanki i po trzech minutach jest gotowa. Smacznego!"
  sb.say(B(4), () => {
    // filiżanka i od razu kawa w niej — jeden obiekt, bez wracania
    sb.strokes([CUP, HANDLE], { color: 'ink', w: 3, seed: 11, cue: 'Kawa' });
    sb.liquid(CUP_IN, { color: 'inkSoft', level: 0.8, alpha: 0.85, cue: 'filiżanki' });
    label('3 min', 1030, 'trzech');
    sb.strokes([steam(1000, 0), steam(1040, 2), steam(1080, 4)], { color: 'pen', w: 2.4, seed: 12, speed: 1500, cue: 'Smacznego' });
  });
  sb.wait(0.8);
  return sb;
}
