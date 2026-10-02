// Maskotka "Kleks" — kropla atramentu z oczami. Pokazuje, jak z prymitywów
// silnika złożyć postać: kontur (pióro) -> zasłonięcie tła -> kredka ->
// detale (oczy, kropki, uśmiech) + animacja idle (oddech, mruganie, wzrok).

import { catmull, curve, ellipse, clamp, noise1, hash, lerp, StrokePlan, crayonTrace } from '../../src/index.js';

const BODY = catmull(
  [[0, -150], [26, -104], [64, -48], [84, 14], [74, 78], [36, 116], [-34, 117], [-74, 80], [-86, 16], [-66, -48], [-28, -104]],
  10,
  true,
);
const SPOTS = [[-46, -30, 7], [-58, 8, 5], [44, 60, 8], [56, 30, 5], [-20, 90, 6], [22, 96, 4], [0, -92, 6], [-14, -64, 4]];
const ARM_L = curve([[-82, 30], [-112, 66], [-104, 104]], 10);
const FEET = [curve([[-34, 116], [-40, 136], [-18, 138]], 6), curve([[34, 115], [40, 136], [18, 138]], 6)];
const armR = (raise) => curve([[80, 20], [118 + raise * 6, -8 - raise * 20], [138 + raise * 4, -46 - raise * 30]], 10);
// kontur w spoczynku — stała tablica, więc plan ruchu ręki liczy się raz
const OUTLINE = [BODY, ARM_L, armR(0), ...FEET];
const CRAYON = (seed) => ({ color: 'teal', alpha: 0.6, spacing: 10, w: 16, angle: -0.9, seed: seed + 3 });

/** Fazy rysowania postaci po kolei (jak ręka): kontur -> przelot -> kredka -> przelot -> oczy i detale. */
export function mascotPhases(p) {
  return { draw: clamp(p / 0.45), fill: clamp((p - 0.5) / 0.28), detail: clamp((p - 0.82) / 0.18) };
}

const OUT_END = () => StrokePlan.of(OUTLINE).at(1).tip;
const DETAIL_AT = (d) => ({ x: lerp(-36, 36, d), y: -6 + Math.sin(d * Math.PI * 4) * 12, angle: 0, lift: 0 });

/** Gdzie jest ręka, gdy rysuje postać z postępem p (bez rysowania) — do Storyboard.custom({ trace }). */
export function mascotTrace({ x, y, scale = 1, seed = 1 }, p) {
  const ph = mascotPhases(p);
  const hop = (a, b, q) => ({ x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q) - Math.sin(Math.PI * q) * 20, angle: 0, lift: Math.sin(Math.PI * q) });
  let l;
  if (p < 0.45) l = StrokePlan.of(OUTLINE).at(ph.draw).tip;
  else if (p < 0.5) l = hop(OUT_END(), crayonTrace(BODY, 0, CRAYON(seed)), (p - 0.45) / 0.05);
  else if (p < 0.78) l = crayonTrace(BODY, ph.fill, CRAYON(seed));
  else if (p < 0.82) l = hop(crayonTrace(BODY, 1, CRAYON(seed)), DETAIL_AT(0), (p - 0.78) / 0.04);
  else l = DETAIL_AT(ph.detail);
  return { x: x + l.x * scale, y: y + l.y * scale, angle: l.angle, lift: l.lift ?? 0 };
}

/**
 * @param {import('../../src/index.js').Sketch} sk
 * @param {object} o x, y, scale, draw (0..1 kontur), fill (0..1 kredka), detail (0..1 oczy itp.),
 *                   look [x,y] — punkt w układzie sceny, na który patrzy, wave (0..1 machanie ręką),
 *                   still (bez idle), seed
 */
export function drawMascot(sk, o) {
  const { x, y, scale = 1, draw = 1, fill = 1, detail = 1, seed = 1, still = false } = o;
  if (draw <= 0) return null;
  const t = sk.time;
  const breathe = still ? 0 : Math.sin(t * 2.1) * 0.018;
  let tip = null;
  sk.group({ x, y, sx: scale * (1 + breathe), sy: scale * (1 - breathe), rotate: still ? 0 : Math.sin(t * 1.3) * 0.015 }, () => {
    const w = 3.4 / scale ** 0.4;
    // 1) kontur ciała + ręce + nóżki jednym ruchem
    const raise = clamp(o.wave ?? 0);
    const outline = raise > 0 ? [BODY, ARM_L, armR(raise), ...FEET] : OUTLINE;
    if (draw > 0.25) sk.occlude(BODY);
    if (fill > 0) sk.crayon(BODY, fill, CRAYON(seed));
    tip = sk.strokes(outline, clamp(draw), { w, color: 'pen', seed: seed + 10, jitter: 1, plan: StrokePlan.of(OUTLINE) });

    // 2) detale
    if (detail > 0) {
      const d = clamp(detail * 1.4);
      SPOTS.forEach(([sx, sy, r], i) => sk.dot(sx, sy, r * clamp(d * 3 - i * 0.3), 'penDark', 0.75));
      // mruganie co ~4 s
      const blinkPhase = (t + hash(seed) * 3) % 4.2;
      const blink = still ? 1 : blinkPhase < 0.14 ? 0.15 : 1;
      const eyes = [[-30, -6], [30, -6]];
      // kierunek wzroku: od środka głowy do punktu `look` (już w układzie lokalnym)
      let lx = 0, ly = 0;
      if (o.look) {
        const gx = (o.look[0] - x) / scale, gy = (o.look[1] - y) / scale;
        const L = Math.hypot(gx, gy) || 1;
        lx = (gx / L) * 8;
        ly = (gy / L) * 6;
      } else if (!still) {
        lx = noise1(t * 0.5) * 5;
        ly = noise1(t * 0.4 + 9) * 3;
      }
      eyes.forEach(([ex, ey], i) => {
        const ring = ellipse(ex, ey, 21, 23 * blink, { seed: seed + 20 + i, overshoot: 0.05 });
        sk.fill(ring, 'white', clamp(d * 2));
        sk.pen(ring, clamp(d * 2 - i * 0.4), { w: 2.6, color: 'pen', seed: seed + 20 + i });
        if (d >= 0.7 && blink > 0.5) {
          sk.dot(ex + lx, ey + ly, 9, 'penDark');
          sk.dot(ex + lx + 3, ey + ly - 3, 2.6, 'white');
        }
      });
      sk.pen(curve([[-18, 38], [0, 50], [18, 38]], 8), clamp(d * 2 - 0.8), { w: 2.8, color: 'pen', seed: seed + 30 });
      sk.dot(-52, 30, 9 * clamp(d * 2 - 1), 'coral', 0.35);
      sk.dot(52, 30, 9 * clamp(d * 2 - 1), 'coral', 0.35);
    }
  });
  // końcówka kreski z układu lokalnego postaci do układu sceny (dla ołówka)
  return tip && { x: x + tip.x * scale, y: y + tip.y * scale, angle: tip.angle };
}

export { BODY as MASCOT_BODY };
