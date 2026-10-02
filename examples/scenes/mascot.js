// Maskotka "Kleks" — kropla atramentu z oczami. Pokazuje, jak z prymitywów
// silnika złożyć postać: kontur (pióro) -> zasłonięcie tła -> kredka ->
// detale (oczy, kropki, uśmiech) + animacja idle (oddech, mruganie, wzrok).

import { catmull, curve, ellipse, clamp, noise1, hash } from '../../src/index.js';

const BODY = catmull(
  [[0, -150], [26, -104], [64, -48], [84, 14], [74, 78], [36, 116], [-34, 117], [-74, 80], [-86, 16], [-66, -48], [-28, -104]],
  10,
  true,
);
const SPOTS = [[-46, -30, 7], [-58, 8, 5], [44, 60, 8], [56, 30, 5], [-20, 90, 6], [22, 96, 4], [0, -92, 6], [-14, -64, 4]];

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
    const armL = curve([[-82, 30], [-112, 66], [-104, 104]], 10);
    const raise = clamp(o.wave ?? 0);
    const armR = curve([[80, 20], [118 + raise * 6, -8 - raise * 20], [138 + raise * 4, -46 - raise * 30]], 10);
    const feet = [curve([[-34, 116], [-40, 136], [-18, 138]], 6), curve([[34, 115], [40, 136], [18, 138]], 6)];
    if (draw > 0.25) sk.occlude(BODY);
    if (fill > 0) {
      sk.crayon(BODY, fill, { color: 'teal', alpha: 0.6, spacing: 10, w: 16, angle: -0.9, seed: seed + 3 });
    }
    tip = sk.strokes([BODY, armL, armR, ...feet], clamp(draw), { w, color: 'pen', seed: seed + 10, jitter: 1 });

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
