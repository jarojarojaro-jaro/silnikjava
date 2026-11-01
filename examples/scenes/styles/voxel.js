// Styl: voxel (klocki w izometrii, ekran CRT). „Skąd bierze się prąd” — krótki film
// z lektorem. Głos: examples/voice/voxel/. Każdy klocek to obrys (ink), kolor kładziony
// kratka po kratce (krycie alpha daje cień bez nowych kolorów), potem detale. Żółty (pen) to jedyny akcent: prąd w przewodach i zapalone okna.

import { Storyboard, isoCamera, iso } from '../../../src/index.js';

const S = 3.0;
const cam = isoCamera({ S });
// kadr: podłoże, wieża i dach mieszczą się w ramce, a środek ląduje pod tytułem
cam.fit([[-96, -72, -8], [96, -72, -8], [96, 72, -8], [-96, 72, 0], [-30, -54, 62], [66, 56, 44], [-80, -64, 26]], 640, 410);
const P = (x, y, z = 0) => cam.P(x, y, z);
const closed = (pts) => (pts.length ? [...pts, pts[0]] : pts);
const quad = (pts) => closed(pts.map(([x, y, z]) => P(x, y, z)));

// klocek: obrys (sylwetka), ściana górna, obie ściany boczne (+x, +y) i krawędź między nimi
function block(x0, y0, x1, y1, z0, z1) {
  const corners = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push(P(x, y, z));
  return {
    sil: closed(iso.hull(corners)),
    top: quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),
    // obie ściany boczne jako jeden kształt: jedno kolorowanie zamiast dwóch
    sides: quad([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),
    edge: [P(x1, y1, z0), P(x1, y1, z1)],
  };
}

// podłoże: płyta 192 × 144 jednostki, trawa na wierzchu, ziemia po bokach
const PLINTH = block(-96, -72, 96, 72, -8, 0);

// panel słoneczny: płaski prostokąt pochylony ku słońcu (+x), siatka ogniw w środku
const panel = (x0, ya, yb) => {
  const pts = [[x0, ya, 4], [x0, yb, 4], [x0 + 14, yb, 26], [x0 + 14, ya, 26]];
  const cells = [1, 2].map((i) => {
    const y = ya + ((yb - ya) * i) / 3;
    return [P(x0, y, 4), P(x0 + 14, y, 26)];
  });
  return { body: quad(pts), cells, mid: [P(x0 + 7, ya, 15), P(x0 + 7, yb, 15)] };
};
const PANELS = [panel(-80, -64, -40), panel(-80, -36, -12)];

// wiatrak: wieża (walec), gondola na szczycie i trzy łopaty w płaszczyźnie y–z
const TX = -30, TY = -54;
const TOWER = iso.cylinder(cam, { x: TX, y: TY, R: 2.4, z0: 0, z1: 56, b: 0.6 });
const HUB = [TX + 5.5, TY, 59];
const BLADES = [[0, 0, 24], [0, 20.8, -12], [0, -20.8, -12]].map(([dx, dy, dz]) =>
  [P(...HUB), P(HUB[0] + dx, HUB[1] + dy, HUB[2] + dz)]);

// słup napowietrznej linii: rama zwężająca się ku górze, poprzeczki i ramię na przewody
const pylon = (x, y, H = 50) => {
  const w = (z) => 3.2 - (2 * z) / H;
  const frame = closed([P(x - 3.2, y, 0), P(x - 1.2, y, H), P(x + 1.2, y, H), P(x + 3.2, y, 0)]);
  const bars = [14, 28, 42].map((z) => [P(x - w(z), y, z), P(x + w(z), y, z)]);
  const arm = [P(x - 6, y, H - 4), P(x + 6, y, H - 4)];
  return { frame, bars, arm };
};
const AX = -40, AY = -4, BX = -8, BY = 14;
const PYL_A = pylon(AX, AY);
const PYL_B = pylon(BX, BY);

// stacja transformatorowa: skrzynia z ochrą, przewody schodzą na jej dach (16, 27, 16)
const SUB = block(6, 20, 22, 34, 0, 16);

// dom w prawym przednim rogu, z dala od stacji: ściany, dach dwuspadowy (koralowy), szczyt w płaszczyźnie x = HX1
const HX0 = 60, HX1 = 84, HY0 = 6, HY1 = 30, HZ = 30, HM = 18, RZ = 44; // HM: oś kalenicy, RZ: szczyt dachu
const HOUSE = block(HX0, HY0, HX1, HY1, 0, HZ);
const ROOF_S = quad([[HX0 - 2, HY1 + 3, HZ], [HX1 + 2, HY1 + 3, HZ], [HX1 + 2, HM, RZ], [HX0 - 2, HM, RZ]]);
// ściany domu jako jeden kształt: front (y = HY1) i szczyt (x = HX1) z trójkątem dachu
const WALLS = quad([[HX0, HY1, 0], [HX1, HY1, 0], [HX1, HY0, 0], [HX1, HY0, HZ], [HX1, HM, RZ], [HX1, HY1, HZ], [HX0, HY1, HZ]]);
const RIDGE = [P(HX0 - 2, HM, RZ), P(HX1 + 2, HM, RZ)];
// pędzle: duże pola szerszą kredką (krótsza ścieżka), mniejsze węższą
const BIG = { w: 40, spacing: 34 };
const MID = { w: 14, spacing: 12 };
const DOOR = quad([[66, HY1, 0], [72, HY1, 0], [72, HY1, 13], [66, HY1, 13]]);
const WIN = [[62, 15, 68, 24], [76, 15, 82, 24]].map(([x0, z0, x1, z1]) =>
  quad([[x0, HY1, z0], [x1, HY1, z0], [x1, HY1, z1], [x0, HY1, z1]]));

// przewody: wiszące łuki między punktami (sag — ugięcie w środku)
function wire(a, b, sag) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t);
    pts.push(P(x, y, z));
  }
  return pts;
}
const W1 = wire([TX, TY, 60], [AX, AY, 50], 8);
const W2 = wire([AX, AY, 50], [BX, BY, 50], 10);
const W3 = wire([BX, BY, 50], [16, 27, 16], 4);
const W4 = wire([16, 27, 16], [HX0, HM, RZ], 3);
// symbol napięcia przy stacji: błyskawica w płaszczyźnie y = 38, z lewej strony stacji
const BOLT = [[4, 38, 26], [9, 38, 20], [5, 38, 18], [10, 38, 9]].map(([x, y, z]) => P(x, y, z));

// napis przy obiekcie: tekst pod punktem świata
const label = (text, x, y, z = 0, dy = 34) => {
  const [px, py] = P(x, y, z);
  return [text, px, py + dy];
};

export function buildVoxel(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'voxel', speed: 950 });
  const B = (n) => voice.beat(n);
  // podpis w kolorze ink: zostaje czytelny nad filtrem CRT (postText: 'above')
  const tag = ([text, x, y]) => sb.write(text, x, y, { size: 26, align: 'center', color: 'ink' });
  const edge = { color: 'inkSoft', w: 1.6 };

  // 1. "Skąd bierze się prąd w gniazdku? Zacznijmy od kawałka ziemi, na którym stoi cała okolica."
  sb.say(B(1), () => {
    // podłoże: kontur, trawa na wierzchu, ziemia po bokach
    sb.pen(PLINTH.sil, { color: 'ink', w: 2.6, seed: 1, cue: 'Skąd' });
    sb.crayon(PLINTH.top, { color: 'teal', seed: 2, ...BIG });
    sb.crayon(PLINTH.sides, { color: 'ochre', alpha: 0.6, seed: 3, ...BIG });
    // tytuł po obiekcie: nie przerywa konturu z kolorem
    sb.write('Skąd bierze się prąd?', 640, 72, { size: 46, font: 'title', weight: 700, align: 'center', color: 'ink' });
  });

  // 2. "Prąd produkują elektrownie. Panele słoneczne łapią światło, a obok kręci się wiatrak."
  sb.say(B(2), () => {
    // wiatrak od razu po obrysie podłoża (ręka nie czeka na pierwsze słowo zdania)
    sb.pen(TOWER.sil, { color: 'ink', w: 2.6, seed: 20 });
    sb.strokes(BLADES, { color: 'ink', w: 2.4, seed: 24 });
    PANELS.forEach((p, i) => {
      sb.pen(p.body, { color: 'ink', w: 2.2, seed: 10 + i, cue: i ? undefined : 'Panele' });
      sb.crayon(p.body, { color: 'sky', seed: 12 + i, ...MID });
    });
    tag(label('panele', -66, -66, 0, 44));
    tag(label('wiatrak', TX, TY, 60, -20));
  });

  // 3. "Linia wysokiego napięcia niesie prąd przez pola, na wysokich słupach, do stacji transformatorowej."
  sb.say(B(3), () => {
    sb.pen(PYL_A.frame, { color: 'ink', w: 2.4, seed: 31, cue: 'Linia' });
    sb.strokes([...PYL_A.bars, PYL_A.arm], { ...edge, seed: 32 });
    sb.pen(W1, { color: 'pen', w: 2.2, seed: 30 });
    sb.pen(PYL_B.frame, { color: 'ink', w: 2.4, seed: 33 });
    sb.strokes([...PYL_B.bars, PYL_B.arm], { ...edge, seed: 34 });
    sb.pen(W2, { color: 'pen', w: 2.2, seed: 35 });
    sb.pen(SUB.sil, { color: 'ink', w: 2.6, seed: 36, cue: 'stacji' });
    sb.crayon(SUB.top, { color: 'ochre', seed: 37, ...MID });
    sb.crayon(SUB.sides, { color: 'ochre', alpha: 0.6, seed: 38, ...MID });
    sb.pen(W3, { color: 'pen', w: 2.2, seed: 41 });
    // podpis napięcia nad pierwszym przewodem (na końcu zdania, bez kotwicy)
    const [vx, vy] = P(-24, 5, 72);
    sb.write('wysokie napięcie', vx, vy, { size: 26, align: 'center', color: 'ink' });
  });

  // 4. "Stacja obniża napięcie, a prąd płynie do domu. Gdy zapalisz światło, okna rozbłysną jak latarnie."
  sb.say(B(4), () => {
    // stacja zaczyna zdanie: symbol napięcia (błyskawica) i podpis, zanim ręka dojdzie do przewodu
    sb.pen(BOLT, { color: 'pen', w: 2.4, seed: 47, cue: 'Stacja' });
    tag(label('stacja', 14, 27, 0, 46));
    // przewód z kotwicą na „prąd”, potem dom, na końcu okna na słowo „okna”
    sb.pen(W4, { color: 'pen', w: 2.2, seed: 57, cue: 'prąd' });
    sb.pen(HOUSE.sil, { color: 'ink', w: 2.6, seed: 50 });
    sb.crayon(WALLS, { color: 'white', alpha: 0.42, seed: 51, ...BIG });
    sb.crayon(ROOF_S, { color: 'coral', seed: 53, ...BIG });
    sb.strokes([RIDGE], { ...edge, seed: 55 });
    // okna zapalają się: żółty (akcent prądu)
    WIN.forEach((w, i) => {
      sb.pen(w, { color: 'pen', w: 2, seed: 60 + i, cue: i ? undefined : 'okna' });
      sb.crayon(w, { color: 'pen', seed: 62 + i, w: 8, spacing: 7 });
    });
    sb.pen(DOOR, { color: 'inkSoft', w: 1.8, seed: 56 });
    tag(label('dom', 72, HM, HZ, 40));
  });
  sb.wait(0.8);
  return sb;
}
