// Scena "Tablica" — odpowiednik animacji z nagłówka stentor.studio, napisany
// ręcznie na Timeline (bez Storyboardu), żeby pokazać pełną kontrolę:
// tablica na sztaludze -> maskotka -> notatka -> v1 -> v2 (napełnia się) -> v3
// (mini-maskotka) -> gwiazdka -> nić wychodząca poza kadr. Potem idle: oddech,
// mruganie, para z kubka, drganie kresek.

import { Timeline, clamp, line, rect, curve, ellipse, polygon, star, wave } from '../../src/index.js';
import { drawMascot } from './mascot.js';

const W = 1240, H = 900;
const B = { x: 360, y: 80, w: 820, h: 560 };

const tl = new Timeline()
  .add('board', 1.5, { at: 0.2, ease: 'out' })
  .add('mascot', 2.0, { at: 0.6, ease: 'hand' })
  .add('mascotFill', 1.0, { at: 1.9 })
  .add('mascotEyes', 0.9, { at: 2.4 })
  .add('tray', 0.8, { at: 1.3 })
  .add('mug', 0.8, { at: 1.9 })
  .add('note', 1.0, { at: 2.0 })
  .add('v1', 0.9, { at: 3.0, ease: 'hand' })
  .add('link1', 0.6, { ease: 'hand' })
  .add('v2', 0.8, { ease: 'hand' })
  .add('v2fill', 1.0, { with: 'v2', gap: 0.5 })
  .add('link2', 0.6, { after: 'v2', ease: 'hand' })
  .add('v3', 1.3, { ease: 'hand' })
  .add('star', 0.5, { gap: -0.1, ease: 'back' })
  .add('thread', 1.4, { gap: 0.1, ease: 'inOut' });

const legs = [line(B.x + 90, B.y + B.h, B.x + 50, 890, { seed: 11 }), line(B.x + B.w - 90, B.y + B.h, B.x + B.w - 50, 890, { seed: 12 })];
const boardPath = rect(B.x, B.y, B.w, B.h, { seed: 13, wobble: 1.4 });
const tapes = [
  polygon([[B.x - 10, B.y - 12], [B.x + 45, B.y - 4], [B.x + 42, B.y + 12], [B.x - 13, B.y + 4]], { seed: 3 }),
  polygon([[B.x + B.w - 45, B.y - 4], [B.x + B.w + 10, B.y - 12], [B.x + B.w + 13, B.y + 4], [B.x + B.w - 42, B.y + 12]], { seed: 4 }),
];
const tray = polygon([[B.x - 24, B.y + B.h - 6], [B.x + B.w + 24, B.y + B.h - 6], [B.x + B.w + 24, B.y + B.h + 10], [B.x - 24, B.y + B.h + 10]], { seed: 5, wobble: 1 });

const note = { x: 980, y: 112, w: 160, h: 112 };
const noteRect = rect(note.x, note.y, note.w, note.h, { seed: 21, wobble: 2 });
const noteGrid = [];
for (let gx = note.x + 12; gx < note.x + note.w; gx += 12) noteGrid.push(line(gx, note.y + 4, gx, note.y + note.h - 4, { seed: gx, bow: 0.004 }));
for (let gy = note.y + 12; gy < note.y + note.h; gy += 12) noteGrid.push(line(note.x + 4, gy, note.x + note.w - 4, gy, { seed: gy, bow: 0.004 }));

const v1Box = rect(470, 372, 104, 84, { seed: 31 });
const link1 = curve([[588, 415], [622, 436], [658, 410]], 10);
const cone = polygon([[672, 330], [818, 330], [745, 505]], { seed: 41, wobble: 3 });
const link2 = curve([[830, 420], [862, 446], [900, 418]], 10);
const thread = curve([[1000, 520], [1050, 560], [1040, 615], [930, 650], [780, 668], [660, 720], [625, 800], [612, 910]], 12);

const mug = { x: 1090, y: 588 };
const mugBody = polygon([[mug.x, mug.y], [mug.x + 46, mug.y], [mug.x + 42, mug.y + 48], [mug.x + 4, mug.y + 48]], { seed: 61, wobble: 2 });
const mugHandle = ellipse(mug.x + 50, mug.y + 22, 12, 13, { seed: 62, overshoot: 0 }).slice(14, 44);

export const heroScene = {
  w: W,
  h: H,
  duration: tl.duration,
  idle: 'loop',
  fps: 24,
  draw(sk, t) {
    sk.paper(W, H);
    const P = (n) => tl.p(n, t);
    let tip = null;
    const use = (r) => { if (r && !r.done) tip = r; };

    // --- tablica na sztaludze
    const b = P('board');
    legs.forEach((l, i) => use(sk.pen(l, clamp(b * 2 - 0.6), { w: 5, color: 'ink', seed: 11 + i })));
    sk.fill(boardPath, '#fbf8f1', clamp(b * 2.2 - 0.9));
    use(sk.pen(boardPath, clamp(b * 1.3), { w: 4.2, color: 'ink', seed: 13 }));
    tapes.forEach((tp, i) => sk.crayon(tp, clamp(b * 2 - 1 - i * 0.1), { color: 'sky', alpha: 0.8, spacing: 6, w: 8, seed: 7 + i }));

    const tr = P('tray');
    sk.crayon(tray, tr, { color: 'ochre', alpha: 0.9, spacing: 6, w: 9, angle: 0.15, seed: 9 });
    sk.pen(line(B.x - 26, B.y + B.h + 10, B.x + B.w + 26, B.y + B.h + 10, { seed: 14 }), tr, { w: 2.4, color: 'ink', seed: 14 });

    // --- notatka przypięta do tablicy
    const n = P('note');
    if (n > 0) {
      sk.fill(noteRect, '#fffdf7', clamp(n * 3));
      noteGrid.forEach((g, i) => sk.pen(g, clamp(n * 2 - i * 0.03), { w: 0.9, color: 'pen', alpha: 0.35, jitter: 0.3, taper: 0, seed: i }));
      sk.pen(noteRect, clamp(n * 1.5), { w: 2.6, color: 'ink', seed: 21 });
      sk.dot(note.x + note.w / 2, note.y + 2, 7 * clamp(n * 3 - 1.5), 'coral');
      use(sk.write('plan.md', note.x + 14, note.y + 38, clamp(n * 1.6 - 0.3), { size: 28, color: 'ink' }));
      [0, 1, 2].forEach((i) => sk.highlight(line(note.x + 16, note.y + 60 + i * 16, note.x + 130 - i * 25, note.y + 60 + i * 16, { seed: i }), 4, clamp(n * 2 - 1 - i * 0.2), { color: i === 1 ? 'ochre' : 'inkSoft', alpha: 0.6, seed: i }));
    }

    // --- kubek z parą
    const m = P('mug');
    sk.crayon(mugBody, m, { color: 'coral', alpha: 0.85, spacing: 6, w: 9, seed: 63 });
    sk.pen(mugBody, m, { w: 2.4, color: 'ink', seed: 61 });
    sk.pen(mugHandle, clamp(m * 2 - 1), { w: 2.4, color: 'ink', seed: 62 });
    if (m >= 1) {
      [0, 1].forEach((i) => {
        const s = wave(0, 0, 40, 4, 0.18).map(([x, y]) => [mug.x + 14 + i * 16 + Math.sin(y * 0.2 + t * 2 + i) * 3 + x * 0.05, mug.y - 10 - x]);
        sk.pen(s.map(([x, y]) => [x + Math.sin((y + t * 30) * 0.15) * 3, y]), 1, { w: 1.6, color: 'inkSoft', alpha: 0.5 + 0.2 * Math.sin(t * 3 + i), seed: 70 + i });
      });
    }

    // --- v1: pierwsza, kanciasta wersja
    const v1 = P('v1');
    use(sk.write('v1', 466, 356, clamp(v1 * 2.5), { size: 46, color: 'pen' }));
    use(sk.pen(v1Box, clamp(v1 * 1.6 - 0.5), { w: 2.8, color: 'pen', seed: 31 }));
    if (v1 >= 1) {
      sk.dot(503, 405, 6, 'pen');
      sk.dot(541, 405, 6, 'pen');
      sk.pen(line(506, 431, 538, 431, { seed: 33 }), 1, { w: 2.4, color: 'pen', seed: 33 });
    }
    use(sk.arrow(link1, P('link1'), { w: 2.4, color: 'pen', seed: 34, head: 12 }));

    // --- v2: lejek, który napełnia się "wiedzą"
    const v2 = P('v2');
    use(sk.write('v2', 662, 316, clamp(v2 * 2.5), { size: 46, color: 'pen' }));
    sk.liquid(cone, P('v2fill') * 0.85, { color: 'teal', alpha: 0.45, seed: 2 });
    use(sk.pen(cone, clamp(v2 * 1.6 - 0.5), { w: 3, color: 'pen', seed: 41 }));
    if (v2 >= 1) {
      sk.pen(ellipse(726, 380, 11, 12, { seed: 42 }), 1, { w: 2.2, color: 'pen', seed: 42 });
      sk.pen(ellipse(764, 380, 11, 12, { seed: 43 }), 1, { w: 2.2, color: 'pen', seed: 43 });
      sk.pen(curve([[730, 412], [745, 421], [760, 412]], 6), 1, { w: 2.2, color: 'pen', seed: 44 });
    }
    use(sk.arrow(link2, P('link2'), { w: 2.4, color: 'pen', seed: 45, head: 12 }));

    // --- v3: mini-maskotka, czyli docelowa wersja
    const v3 = P('v3');
    use(sk.write('v3', 900, 288, clamp(v3 * 3), { size: 46, color: 'pen' }));
    use(drawMascot(sk, {
      x: 1010, y: 400, scale: 0.62, seed: 5,
      draw: clamp(v3 * 1.6 - 0.25), fill: clamp(v3 * 2 - 1), detail: clamp(v3 * 2.5 - 1.5),
      wave: t > tl.end('v3') ? 0.5 + 0.5 * Math.sin(t * 6) : 0,
    }));

    // --- gwiazdka za sukces
    const s = P('star');
    if (s > 0) {
      sk.group({ x: 1110, y: 290, scale: s, rotate: (1 - s) * 1.5 + Math.sin(t * 2) * 0.05 }, () => {
        const st = star(0, 0, 28, 12, 5, { seed: 8 });
        sk.crayon(st, 1, { color: 'ochre', spacing: 5, w: 7, seed: 81 });
        sk.pen(st, 1, { w: 2.2, color: 'ink', seed: 81 });
      });
    }

    // --- nić: ołówek wyprowadza linię poza kadr (dalej podejmuje ją strona przy scrollu)
    const th = P('thread');
    use(sk.pen(thread, th, { w: 3, color: 'pen', seed: 91, taper: 10 }));

    // --- maskotka na pierwszym planie, patrzy na ołówek
    use(drawMascot(sk, {
      x: 250, y: 560, scale: 1.25, seed: 1,
      draw: P('mascot'), fill: P('mascotFill'), detail: P('mascotEyes'),
      look: tip ? [tip.x, tip.y] : null,
    }));

    // --- ołówek na końcówce aktualnej kreski
    if (tip && t < tl.duration) sk.pencil(tip.x, tip.y);
  },
};

export { tl as heroTimeline };
export const heroThreadEnd = thread[thread.length - 1];
