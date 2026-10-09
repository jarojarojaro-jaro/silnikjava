// Maskotka "Kleks" — kropla atramentu z oczami. Pokazuje, jak z prymitywów
// silnika złożyć postać, rysowaną w kolejności jak przez rysownika:
//   kontur -> oczy -> kolorowanie kredką (z ominięciem oczu) -> źrenice ->
//   uśmiech -> kropki -> rumieńce,
// a potem animacja "życia": oddech, mruganie, wzrok śledzący ołówek.
// Rysunek i ślad ręki pochodzą z tej samej sekwencji (Sequence), więc żaden
// detal nie pojawia się bez ręki.

import { catmull, curve, ellipse, clamp, noise1, hash, StrokePlan, Sequence, crayonTrace } from '../../src/index.js';

const BODY = catmull(
  [[0, -150], [26, -104], [64, -48], [84, 14], [74, 78], [36, 116], [-34, 117], [-74, 80], [-86, 16], [-66, -48], [-28, -104]],
  10,
  true,
);
// kropki w kolejności, w jakiej stawia je ręka: od czubka głowy w dół, najkrótszą drogą
const SPOTS = [[0, -92, 6], [-14, -64, 4], [-46, -30, 7], [-58, 8, 5], [-20, 90, 6], [22, 96, 4], [44, 60, 8], [56, 30, 5]];
const ARM_L = curve([[-82, 30], [-112, 66], [-104, 104]], 10);
const FEET = [curve([[-34, 116], [-40, 136], [-18, 138]], 6), curve([[34, 115], [40, 136], [18, 138]], 6)];
const armR = (raise) => curve([[80, 20], [118 + raise * 6, -8 - raise * 20], [138 + raise * 4, -46 - raise * 30]], 10);
// kontur w spoczynku — stała tablica, więc plan ruchu ręki liczy się raz
const OUTLINE = [BODY, ARM_L, armR(0), ...FEET];
const EYES = [[-30, -6], [30, -6]];
const RINGS = EYES.map(([ex, ey], i) => ellipse(ex, ey, 21, 23, { seed: 20 + i, overshoot: 0.05 }));
const SMILE = curve([[-18, 38], [0, 50], [18, 38]], 8);
const CHEEKS = [[-52, 30], [52, 30]];
const CRAYON = (seed) => ({ color: 'teal', alpha: 0.6, spacing: 10, w: 16, angle: -0.9, seed: seed + 3, holes: RINGS });

const PEN = { type: 'pencil', color: 'pen' };
const DARK = { type: 'pencil', color: 'penDark' };

/** Ślad stawiania kropki: małe kółko wokół środka. */
const dotTrace = (x, y, r) => (q) => {
  const a = q * Math.PI * 3;
  return { x: x + Math.cos(a) * r * 0.45, y: y + Math.sin(a) * r * 0.45, angle: 0, lift: 0 };
};
const planTrace = (list) => {
  const pl = StrokePlan.of(list);
  return { pl, trace: (q) => pl.at(q).tip };
};

const seqCache = new Map();
/**
 * Kolejność rysowania postaci (w układzie lokalnym). Wagi czasów w sekundach.
 * `dur` — czas kroku w filmie: sekwencja dopasowana tak, by przeloty nie były za szybkie.
 */
export function mascotSequence(seed = 1, dur, scale = 1) {
  const ck = `${seed}|${dur ?? ''}|${scale}`;
  let seq = seqCache.get(ck);
  if (seq) return seq;
  const out = planTrace(OUTLINE);
  const rings = RINGS.map((r) => planTrace([r]));
  const smile = planTrace([SMILE]);
  const steps = [
    { key: 'outline', dur: out.pl.total, trace: out.trace, tool: PEN },
    { key: 'ring0', dur: rings[0].pl.total, trace: rings[0].trace, tool: PEN },
    { key: 'ring1', dur: rings[1].pl.total, trace: rings[1].trace, tool: PEN },
    { key: 'fill', dur: 1.6, trace: (q) => crayonTrace(BODY, q, CRAYON(seed)), tool: { type: 'crayon', color: 'teal' } },
    { key: 'pupil0', dur: 0.14, trace: dotTrace(...EYES[0], 9), tool: DARK },
    { key: 'pupil1', dur: 0.14, trace: dotTrace(...EYES[1], 9), tool: DARK },
    { key: 'smile', dur: smile.pl.total, trace: smile.trace, tool: PEN },
    ...SPOTS.map(([sx, sy, r], i) => ({ key: `spot${i}`, dur: 0.1, trace: dotTrace(sx, sy, r), tool: DARK })),
    ...CHEEKS.map(([cx, cy], i) => ({ key: `cheek${i}`, dur: 0.16, trace: dotTrace(cx, cy, 9), tool: { type: 'pencil', color: 'coral' } })),
  ];
  // krótkie przeloty między detalami — ręka ledwo odrywa się od kartki
  seq = new Sequence(steps, { liftTime: (d) => 0.04 + 0.045 * Math.sqrt(d / 50), fit: dur, scale });
  seq.index = Object.fromEntries(steps.map((s, i) => [s.key, i]));
  seqCache.set(ck, seq);
  return seq;
}

/** Naturalny czas narysowania postaci [s] dla danej skali (większa = dłużej). */
export function mascotDuration(scale = 1, seed = 1) {
  return mascotSequence(seed).total * (0.55 + 0.45 * scale);
}

/** Gdzie jest ręka, gdy rysuje postać z postępem p — do Storyboard.custom({ trace }). */
export function mascotTrace({ x, y, scale = 1, seed = 1, dur }, p) {
  const tip = mascotSequence(seed, dur, scale).at(p).tip;
  return tip && { ...tip, x: x + tip.x * scale, y: y + tip.y * scale, lift: tip.lift ?? 0 };
}

/**
 * @param {import('../../src/index.js').Sketch} sk
 * @param {object} o x, y, scale, p (postęp rysowania 0..1), dur (czas kroku w filmie — ten sam
 *                   co w mascotTrace), look [x,y] — punkt w układzie sceny, na który patrzy,
 *                   wave (0..1 machanie ręką), still (bez "życia"), seed
 */
export function drawMascot(sk, o) {
  const { x, y, scale = 1, p = 1, seed = 1, still = false, dur } = o;
  if (p <= 0) return;
  const seq = mascotSequence(seed, dur, scale);
  const L = seq.at(p).local;
  const q = (key) => L[seq.index[key]];
  const t = sk.time;
  const alive = !still && p >= 1;
  const breathe = alive ? Math.sin(t * 2.1) * 0.018 : 0;
  sk.group({ x, y, sx: scale * (1 + breathe), sy: scale * (1 - breathe), rotate: alive ? Math.sin(t * 1.3) * 0.015 : 0 }, () => {
    const w = 3.4 / scale ** 0.4;
    const raise = clamp(o.wave ?? 0);
    const outline = raise > 0 ? [BODY, ARM_L, armR(raise), ...FEET] : OUTLINE;
    // co jest przed postacią, rysujemy wcześniej; tło za nią nie prześwituje
    if (q('outline') > 0.25) sk.occlude(BODY);
    if (q('fill') > 0) sk.crayon(BODY, q('fill'), CRAYON(seed));
    sk.strokes(outline, q('outline'), { w, color: 'pen', seed: seed + 10, jitter: 1, plan: StrokePlan.of(OUTLINE) });

    // oczy: wzrok (od środka głowy do punktu `look`) i mruganie co ~4 s
    let lx = 0, ly = 0;
    if (alive && o.look) {
      const gx = (o.look[0] - x) / scale, gy = (o.look[1] - y) / scale;
      const D = Math.hypot(gx, gy) || 1;
      lx = (gx / D) * 8;
      ly = (gy / D) * 6;
    } else if (alive) {
      lx = noise1(t * 0.5) * 5;
      ly = noise1(t * 0.4 + 9) * 3;
    }
    const blinking = alive && (t + hash(seed) * 3) % 4.2 < 0.14;
    EYES.forEach(([ex, ey], i) => {
      sk.pen(RINGS[i], q(`ring${i}`), { w: 2.6, color: 'pen', seed: seed + 20 + i });
      const pq = q(`pupil${i}`);
      if (blinking) {
        // powieka: zamknięte oko
        sk.fill(RINGS[i], 'teal', 0.55);
        sk.pen(curve([[ex - 20, ey + 2], [ex, ey + 8], [ex + 20, ey + 2]], 6), 1, { w: 2.4, color: 'pen', seed: seed + 40 + i, still: true });
      } else if (pq > 0) {
        sk.dot(ex + lx, ey + ly, 9 * Math.sqrt(pq), 'penDark');
        if (pq >= 1) sk.dot(ex + lx + 3, ey + ly - 3, 2.6, 'paper'); // błysk = nie zamalowany kawałek
      }
    });
    sk.pen(SMILE, q('smile'), { w: 2.8, color: 'pen', seed: seed + 30 });
    SPOTS.forEach(([sx, sy, r], i) => {
      const s = q(`spot${i}`);
      if (s > 0) sk.dot(sx, sy, r * Math.sqrt(s), 'penDark', 0.75);
    });
    CHEEKS.forEach(([cx, cy], i) => {
      const c = q(`cheek${i}`);
      if (c > 0) sk.dot(cx, cy, 9 * Math.sqrt(c), 'coral', 0.35);
    });
  });
}

export { BODY as MASCOT_BODY };
