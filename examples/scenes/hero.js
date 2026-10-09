// Scena "Tablica" — odpowiednik animacji z nagłówka stentor.studio:
// tablica na sztaludze -> maskotka -> notatka -> v1 -> v2 (napełnia się) -> v3
// (mini-maskotka) -> gwiazdka -> nić wychodząca poza kadr. Potem idle: oddech,
// mruganie, para z kubka, drganie kresek.
//
// Zbudowana na Storyboardzie: jedna ręka rysuje wszystko po kolei (ciągły ruch
// ołówka, zmiana kredek w powietrzu), nic nie pojawia się samo (sb.lint() = 0),
// a duża maskotka śledzi ołówek wzrokiem.

import { Storyboard, StrokePlan, line, rect, curve, ellipse, polygon, star, wave } from '../../src/index.js';
import { drawMascot, mascotTrace, mascotDuration } from './mascot.js';

const W = 1240, H = 900;
const B = { x: 360, y: 80, w: 820, h: 560 };

const legs = [line(B.x + 90, B.y + B.h, B.x + 50, 890, { seed: 11 }), line(B.x + B.w - 90, B.y + B.h, B.x + B.w - 50, 890, { seed: 12 })];
const boardPath = rect(B.x, B.y, B.w, B.h, { seed: 13, wobble: 1.4 });
const tapes = [
  polygon([[B.x - 10, B.y - 12], [B.x + 45, B.y - 4], [B.x + 42, B.y + 12], [B.x - 13, B.y + 4]], { seed: 3 }),
  polygon([[B.x + B.w - 45, B.y - 4], [B.x + B.w + 10, B.y - 12], [B.x + B.w + 13, B.y + 4], [B.x + B.w - 42, B.y + 12]], { seed: 4 }),
];
const tray = polygon([[B.x - 24, B.y + B.h - 6], [B.x + B.w + 24, B.y + B.h - 6], [B.x + B.w + 24, B.y + B.h + 10], [B.x - 24, B.y + B.h + 10]], { seed: 5, wobble: 1 });
const trayLine = line(B.x - 26, B.y + B.h + 10, B.x + B.w + 26, B.y + B.h + 10, { seed: 14 });

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

// para z kubka: najpierw narysowana ołówkiem, potem faluje (ambient)
const steamBase = [0, 1].map((i) => wave(0, 0, 40, 4, 0.18).map(([x, y]) => [mug.x + 14 + i * 16 + x * 0.05 + Math.sin(y * 0.2 + i) * 3, mug.y - 10 - x]));
const steamAt = (t) => steamBase.map((s, i) => s.map(([x, y]) => [x + Math.sin((y + t * 30) * 0.15 + i) * 3, y]));

export function buildHero() {
  const sb = new Storyboard({ w: W, h: H, idle: 'loop', fps: 24, speed: 1400 });
  // czas postaci z jej naturalnego tempa (przeloty ręki w obrysie nie mogą się ścisnąć)
  const BIG = { x: 250, y: 560, scale: 1.25, seed: 1, dur: Math.max(5, mascotDuration(1.25, 1)) };
  const MINI = { x: 1010, y: 400, scale: 0.62, seed: 5, dur: 3.2 };
  const pen = (c, w, seed) => ({ color: c, w, seed });

  // --- 1. postać na pierwszym planie — rysowana PRZED tablicą, więc linie tła
  //        chowają się za nią (jak u ilustratora, bez wymazywania)
  sb.custom((sk, p, t) => {
    const h = sk.fontsReady !== false ? sb.handTrack(sk).at(t) : null;
    drawMascot(sk, { ...BIG, p, look: h ? [h.x, h.y] : null });
  }, { dur: BIG.dur, z: 2, at: 0.3, trace: (p) => mascotTrace(BIG, p), name: 'mascot' });

  // --- 2. tablica na sztaludze za postacią
  sb.pen(boardPath, { ...pen('ink', 4.2, 13), name: 'board' });
  sb.strokes(legs, pen('ink', 5, 11));
  sb.crayon(tray, { color: 'ochre', alpha: 0.9, spacing: 6, w: 9, seed: 9, dur: 0.9 });
  sb.pen(trayLine, pen('ink', 2.4, 14));
  tapes.forEach((tp, i) => sb.crayon(tp, { color: 'sky', alpha: 0.8, spacing: 6, w: 8, seed: 7 + i, dur: 0.3 }));

  // --- 3. notatka przypięta do tablicy
  sb.pen(noteRect, pen('ink', 2.6, 21));
  sb.dot(note.x + note.w / 2, note.y + 2, 7, { color: 'coral' });
  sb.write('plan.md', note.x + 14, note.y + 38, { size: 28, color: 'ink' });
  [0, 1, 2].forEach((i) => sb.highlight(line(note.x + 16, note.y + 60 + i * 16, note.x + 130 - i * 25, note.y + 60 + i * 16, { seed: i }), 4, { color: i === 1 ? 'ochre' : 'inkSoft', alpha: 0.6, seed: i, dur: 0.25 }));

  // --- 4. kubek z parą
  sb.crayon(mugBody, { color: 'coral', alpha: 0.85, spacing: 6, w: 9, seed: 63, dur: 0.4 });
  sb.strokes([mugBody, mugHandle], pen('ink', 2.4, 61));
  const steamPlan = StrokePlan.of(steamBase);
  sb.custom((sk, p, t) => {
    sk.strokes(steamAt(t), p, { w: 1.6, color: 'inkSoft', alpha: 0.6, seed: 70, plan: steamPlan });
  }, { dur: 0.6, color: 'inkSoft', trace: (p) => steamPlan.at(p).tip, z: 1 }); // faluje bez końca — osobna warstwa

  // --- 5. v1: pierwsza, kanciasta wersja
  sb.write('v1', 466, 356, { size: 46, color: 'pen' });
  sb.pen(v1Box, pen('pen', 2.8, 31));
  sb.dot(503, 405, 6).dot(541, 405, 6);
  sb.pen(line(506, 431, 538, 431, { seed: 33 }), pen('pen', 2.4, 33));
  sb.arrow(link1, { ...pen('pen', 2.4, 34), head: 12 });

  // --- 6. v2: lejek, który napełnia się "wiedzą"
  sb.write('v2', 662, 316, { size: 46, color: 'pen' });
  sb.pen(cone, pen('pen', 3, 41));
  sb.liquid(cone, { color: 'teal', alpha: 0.45, seed: 2, level: 0.85, dur: 1.0 });
  sb.strokes([ellipse(726, 380, 11, 12, { seed: 42 }), ellipse(764, 380, 11, 12, { seed: 43 }), curve([[730, 412], [745, 421], [760, 412]], 6)], pen('pen', 2.2, 42));
  sb.arrow(link2, { ...pen('pen', 2.4, 45), head: 12 });

  // --- 7. v3: mini-maskotka, czyli docelowa wersja, i gwiazdka za sukces
  sb.write('v3', 900, 288, { size: 46, color: 'pen' });
  sb.custom((sk, p, t) => {
    drawMascot(sk, { ...MINI, p, wave: p >= 1 ? 0.5 + 0.5 * Math.sin(t * 6) : 0 });
  }, { dur: MINI.dur, trace: (p) => mascotTrace(MINI, p), z: 1 });
  const st = star(1110, 290, 28, 12, 5, { seed: 8 });
  sb.pen(st, pen('ink', 2.2, 81));
  sb.crayon(st, { color: 'ochre', spacing: 5, w: 7, seed: 81, dur: 0.35 });

  // --- 8. nić: ołówek wyprowadza linię poza kadr (dalej podejmuje ją strona przy scrollu)
  sb.pen(thread, { ...pen('pen', 3, 91), taper: 10 });
  return sb;
}

export const heroScene = buildHero().scene();
export const heroThreadEnd = thread[thread.length - 1];
