// Styl: kosmos. "Jak powstaje gwiazda" — film popularnonaukowy z lektorką.
// Głos: examples/voice/cosmos/. Pastelowa, świecąca kreska na rozgwieżdżonym niebie,
// mgławica malowana plamą, która dodaje światła.

import { Storyboard, line, curve, ellipse, spiral, catmull } from '../../../src/index.js';

const C = [640, 410];
// obłok gazu i pyłu: nieregularna plama wokół środka
const CLOUD = catmull(Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const k = 1 + 0.18 * Math.sin(i * 2.3) + 0.1 * Math.cos(i * 1.7);
  return [C[0] + Math.cos(a) * 300 * k, C[1] + Math.sin(a) * 170 * k];
}), 8, true);
// strzałki grawitacji: z brzegu obłoku łukiem do środka
const pull = (a, seed) => {
  const r0 = 250, r1 = 105;
  const p = (r, t) => [C[0] + Math.cos(a + t) * r, C[1] + Math.sin(a + t) * r * 0.6];
  return curve([p(r0, 0), p((r0 + r1) / 2, 0.35), p(r1, 0.6)], 10);
};

export function buildCosmos(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'cosmos', speed: 1000 });
  const B = (n) => voice.beat(n);

  // 1. "Jak powstaje gwiazda? Wszystko zaczyna się od ogromnego obłoku gazu i pyłu."
  sb.say(B(1), () => {
    sb.write('Jak powstaje gwiazda?', 640, 110, { size: 64, font: 'title', weight: 700, align: 'center', color: 'ink', cue: 'Jak' });
    sb.crayon(CLOUD, { color: 'plum', seed: 3, cue: 'obłoku' });
  });

  // 2. "Grawitacja ściąga obłok do środka, a ten kurczy się i coraz szybciej wiruje."
  sb.say(B(2), () => {
    [0.3, 1.9, 3.5, 5.1].forEach((a, i) => sb.arrow(pull(a, i), { color: 'teal', w: 2.6, head: 13, seed: 10 + i, speed: 1500, ...(i ? {} : { cue: 'ściąga' }) }));
    sb.pen(spiral(C[0], C[1], 18, 95, 2.2).map(([x, y]) => [x, C[1] + (y - C[1]) * 0.62]), { color: 'sky', w: 2.4, seed: 20, cue: 'wiruje' });
  });

  // 3. "W jądrze rośnie temperatura, aż do piętnastu milionów stopni."
  sb.say(B(3), () => {
    sb.pen(ellipse(C[0], C[1], 46, 46, { seed: 30, overshoot: 0.05 }), { color: 'ochre', w: 3, seed: 30, cue: 'jądrze' });
    sb.crayon(ellipse(C[0], C[1], 48, 48, { seed: 31 }), { color: 'ochre', seed: 31, alpha: 1, soft: 4 });
    sb.write('15 mln °C', 1010, 300, { size: 52, font: 'title', weight: 700, align: 'center', color: 'ochre', cue: 'piętnastu' });
  });

  // 4. "Wtedy wodór zaczyna zamieniać się w hel i rodzi się nowa gwiazda."
  sb.say(B(4), () => {
    sb.write('H → He', 260, 610, { size: 56, font: 'title', weight: 700, align: 'center', color: 'teal', cue: 'wodór' });
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.2, r0 = 62, r1 = i % 2 ? 120 : 150;
      return line(C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0, C[0] + Math.cos(a) * r1, C[1] + Math.sin(a) * r1, { seed: 40 + i, bow: 0 });
    });
    sb.strokes(rays, { color: 'pen', w: 3.4, seed: 40, speed: 1600, cue: 'rodzi' });
  });
  sb.wait(0.8);
  return sb;
}
