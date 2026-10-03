import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp, prog, noise1, rng, ease, catmull, resample, pathLength, pointAt, line, rect, ellipse,
  svgPath, bounds, Timeline, Storyboard, StrokePlan, Sequence, minJerk, travelTime, thin, traceSkeleton,
} from '../src/index.js';
import { buildExplainer } from '../examples/scenes/explainer.js';
import { buildHero } from '../examples/scenes/hero.js';
import { buildScrollDiagram } from '../examples/scenes/diagram.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('clamp/prog', () => {
  assert.equal(clamp(2), 1);
  assert.equal(clamp(-1), 0);
  assert.equal(prog(1.5, 1, 1), 0.5);
  assert.equal(prog(5, 1, 0), 1);
});

test('szum i RNG są deterministyczne i w zakresie', () => {
  for (let x = 0; x < 50; x += 0.37) {
    const v = noise1(x);
    assert.ok(v >= -1 && v <= 1);
    assert.equal(v, noise1(x));
  }
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

test('easingi zaczynają w 0 i kończą w 1', () => {
  for (const [name, f] of Object.entries(ease)) {
    close(f(0), 0, 1e-9);
    close(f(1), 1, 1e-9);
    assert.ok(Number.isFinite(f(0.5)), name);
  }
});

test('catmull przechodzi przez punkty końcowe', () => {
  const c = catmull([[0, 0], [50, 40], [100, 0]], 10);
  assert.deepEqual(c[0], [0, 0]);
  assert.deepEqual(c[c.length - 1], [100, 0]);
  assert.equal(c.length, 21);
});

test('resample daje równe odstępy', () => {
  const r = resample([[0, 0], [100, 0]], 10);
  assert.equal(r.length, 11);
  for (let i = 1; i < r.length; i++) close(r[i][0] - r[i - 1][0], 10, 1e-9);
});

test('pointAt i pathLength', () => {
  const pts = [[0, 0], [100, 0], [100, 100]];
  assert.equal(pathLength(pts), 200);
  const m = pointAt(pts, 0.75);
  close(m.x, 100);
  close(m.y, 50);
  close(m.angle, Math.PI / 2);
});

test('kształty odręczne są deterministyczne dla ziarna', () => {
  assert.deepEqual(rect(0, 0, 100, 50, { seed: 3 }), rect(0, 0, 100, 50, { seed: 3 }));
  assert.notDeepEqual(rect(0, 0, 100, 50, { seed: 3 }), rect(0, 0, 100, 50, { seed: 4 }));
  const b = bounds(ellipse(100, 100, 50, 30, { seed: 1 }));
  assert.ok(Math.abs(b.cx - 100) < 8 && Math.abs(b.cy - 100) < 8);
  const l = line(0, 0, 100, 0);
  assert.deepEqual(l[0], [0, 0]);
  assert.deepEqual(l[l.length - 1], [100, 0]);
});

test('svgPath: M/L/H/V/Z, względne, krzywe i łuki', () => {
  const [sq] = svgPath('M10 10 H 50 V 50 h -40 z');
  assert.deepEqual(sq, [[10, 10], [50, 10], [50, 50], [10, 50], [10, 10]]);
  const [c] = svgPath('M0 0 C 0 100 100 100 100 0', { step: 5 });
  assert.deepEqual(c[c.length - 1], [100, 0]);
  close(Math.max(...c.map((p) => p[1])), 75, 1);
  const [a] = svgPath('M0 0 A 50 50 0 0 1 100 0', { step: 2 });
  const end = a[a.length - 1];
  close(end[0], 100, 1e-6);
  close(end[1], 0, 1e-6);
  // półokrąg: najdalszy punkt 50 od środka (50,0)
  close(Math.max(...a.map(([x, y]) => Math.abs(y))), 50, 0.5);
  assert.equal(svgPath('M0 0 L10 0 M20 0 l10 0').length, 2);
});

test('Timeline: sekwencja, with, after, gap, at', () => {
  const tl = new Timeline()
    .add('a', 1)
    .add('b', 2)
    .add('c', 1, { with: 'b', gap: 0.5 })
    .add('d', 1, { after: 'a' })
    .add('e', 1, { at: 10 });
  assert.equal(tl.start('a'), 0);
  assert.equal(tl.start('b'), 1);
  assert.equal(tl.start('c'), 1.5);
  assert.equal(tl.start('d'), 1);
  assert.equal(tl.duration, 11);
  assert.equal(tl.raw('b', 2), 0.5);
  assert.equal(tl.p('a', -1), 0);
  assert.equal(tl.p('a', 5), 1);
});

// atrapa Sketch — zapisuje wywołania zamiast rysować
function mockSketch() {
  const calls = [];
  const ctx = { save() {}, restore() {}, translate() {}, scale() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), canvas: { width: 0, height: 0 } };
  const rec = (name) => (...a) => {
    calls.push([name, ...a]);
    return null;
  };
  return {
    ctx, calls, boil: 0,
    paper: rec('paper'), pen: rec('pen'), crayon: rec('crayon'), write: rec('write'), fill: rec('fill'),
    pencil: rec('pencil'), tool: rec('tool'), arrow: rec('arrow'), strokes: rec('strokes'),
    writeTrace: (text, x, y, p) => ({ x: x + 100 * p, y, angle: 0, lift: 0 }),
  };
}

test('Storyboard: czasy kroków, opcje pędzla nie mieszają się z czasem', () => {
  const sb = new Storyboard({ w: 100, h: 100, handGaps: false });
  sb.pen([[0, 0], [650, 0]], { dur: 1 })
    .crayon([[0, 0], [10, 0], [10, 10]], { dur: 0.5, spacing: 9 })
    .wait(0.25)
    .write('abc', 0, 0, { dur: 1 });
  const segs = [...sb.tl.segments.values()];
  close(segs[0].dur, 1);
  close(segs[1].start, 1);
  close(segs[2].start, 1.75);
  close(sb.duration, 2.75);
});

test('Storyboard: naturalne czasy i przerwa na przelot ołówka', () => {
  const sb = new Storyboard({ w: 100, h: 100 });
  sb.pen([[0, 0], [600, 0]]);
  sb.pen([[0, 300], [10, 300]]); // daleko od końca poprzedniej kreski
  const [a, b] = [...sb.tl.segments.values()];
  assert.ok(a.dur > 0.5 && a.dur < 1.2, `czas kreski 600 px: ${a.dur}`);
  const gap = b.start - (a.start + a.dur);
  close(gap, travelTime(Math.hypot(600, 300)) + 0.06, 1e-9); // przelot + chwila na wycelowanie
  assert.ok(b.dur < a.dur, 'krótka kreska krócej');
});

test('Storyboard: ręka ciągła, bez skoków; kredka pod konturem', () => {
  const sb = new Storyboard({ w: 800, h: 600 });
  sb.pen([[100, 100], [400, 100]]);
  sb.crayon([[100, 100], [400, 100], [400, 300], [100, 300]]);
  sb.write('tekst', 450, 200);
  sb.wait(0.5).arrow([[500, 400], [700, 450]]);
  let sk = mockSketch();
  sb.draw(sk, 1.2);
  const names = sk.calls.map((c) => c[0]);
  assert.ok(names.indexOf('crayon') < names.indexOf('strokes'), 'kredka rysowana przed konturem');
  const hand = sb.handTrack(sk);
  const first = sb.items.reduce((m, it) => Math.min(m, it.seg.start), Infinity);
  let prev = null;
  let maxStep = 0;
  for (let t = first; t <= sb.duration; t += 1 / 60) {
    const p = hand.at(t);
    assert.ok(p, `ręka widoczna w t=${t.toFixed(2)}`);
    if (prev) maxStep = Math.max(maxStep, Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  assert.ok(maxStep < 60, `największy skok ręki ${maxStep.toFixed(1)} px/klatkę`);
  assert.equal(hand.at(sb.duration + 5), null, 'po filmie ręka schodzi z kadru');
});

test('Storyboard: clear() ukrywa poprzedni rozdział, keep zostaje', () => {
  const sb = new Storyboard({ w: 100, h: 100, pencil: false });
  sb.pen([[0, 0], [10, 0]], { dur: 0.5, name: 'stary' });
  sb.pen([[0, 5], [10, 5]], { dur: 0.5, name: 'tlo', keep: true });
  sb.clear({ dur: 1 });
  sb.pen([[0, 9], [10, 9]], { dur: 0.5, name: 'nowy' });
  const sk = mockSketch();
  sb.draw(sk, sb.duration);
  const ys = sk.calls.filter((c) => c[0] === 'strokes').map((c) => c[1][0][0][1]);
  assert.deepEqual(ys.sort(), [5, 9]);
});

test('Storyboard: kamera interpoluje do celu', () => {
  const sb = new Storyboard({ w: 200, h: 100 });
  sb.camera({ x: 50, y: 50, zoom: 2 }, { dur: 1, ease: 'linear' });
  assert.deepEqual(sb.cameraAt(0), { x: 100, y: 50, zoom: 1 });
  const m = sb.cameraAt(0.5);
  close(m.x, 75);
  close(m.zoom, 1.5);
  assert.deepEqual(sb.cameraAt(3), { x: 50, y: 50, zoom: 2 });
});

test('StrokePlan: postęp rośnie monotonicznie, ołówek unosi się między kreskami', () => {
  const plan = new StrokePlan([rect(0, 0, 200, 100), line(260, 0, 400, 60)]);
  let prev = [0, 0];
  let lifted = false;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const st = plan.at(p);
    st.progress.forEach((v, i) => assert.ok(v >= prev[i] - 1e-9, 'postęp nie cofa się'));
    prev = st.progress;
    if (st.tip.lift > 0.5) lifted = true;
  }
  assert.ok(lifted, 'między kreskami ołówek w powietrzu');
  assert.deepEqual(plan.at(1).progress, [1, 1]);
  // początek kreski wolniejszy niż środek (minimum jerk)
  const L = (p) => plan.at(p).progress[0];
  assert.ok(L(0.05) < L(0.3) - L(0.25), 'powolny start');
});

test('minJerk: 0→0, 1→1, symetryczny', () => {
  close(minJerk(0), 0);
  close(minJerk(1), 1);
  close(minJerk(0.5), 0.5);
});

test('szkielet: gruba kreska -> linia 1 px, kształt L -> łamana z końcami', () => {
  const w = 40, h = 40;
  const img = new Uint8Array(w * h);
  for (let y = 5; y < 35; y++) for (let x = 5; x < 12; x++) img[y * w + x] = 1; // pion
  for (let y = 28; y < 35; y++) for (let x = 5; x < 35; x++) img[y * w + x] = 1; // poziom
  thin(img, w, h);
  let n = 0;
  for (const v of img) n += v;
  assert.ok(n > 30 && n < 75, `pikseli szkieletu: ${n}`);
  const strokes = traceSkeleton(img, w, h);
  const long = strokes.filter((s) => s.pts.length > 10);
  assert.ok(long.length >= 1 && long.length <= 2, `kresek: ${long.length}`);
  const total = long.reduce((a, s) => a + s.pts.length, 0);
  assert.ok(total > 35, 'kreski pokrywają oba ramiona');
});

test('fizyka sceny: w demach nic nie pojawia się bez ręki (lint = 0)', () => {
  for (const sb of [buildExplainer(), buildHero(), buildScrollDiagram()]) {
    const issues = sb.lint();
    assert.deepEqual(issues.map((i) => `${i.name}: ${i.problem}`), []);
  }
});

test('lint wykrywa: magiczny pop, wyłączoną rękę, rysowanie równoległe, spóźnioną rękę', () => {
  const sb = new Storyboard({ w: 800, h: 600, warn: false });
  sb.pen([[0, 0], [300, 0]], { name: 'a' });
  sb.pop(100, 100, () => {}, { name: 'pop' });
  sb.pen([[0, 50], [300, 50]], { name: 'bez', pencil: false });
  sb.pen([[0, 100], [300, 100]], { name: 'b' });
  sb.pen([[0, 200], [300, 200]], { name: 'rownolegle', with: 'b' });
  sb.pop(100, 100, () => {}, { name: 'swiadomy', magic: true });
  const sb2 = new Storyboard({ w: 800, h: 600, warn: false });
  sb2.pen([[0, 0], [300, 0]]);
  sb2.pen([[700, 500], [790, 500]], { name: 'daleko', gap: 0 });
  const byName = Object.fromEntries([...sb.lint(), ...sb2.lint()].map((i) => [i.name, i.problem]));
  assert.match(byName.pop, /bez ręki/);
  assert.match(byName.bez, /wyłączona/);
  assert.match(byName.rownolegle, /zajęta/);
  assert.match(byName.daleko, /spóźniona|nie zdąży/);
  assert.equal(byName.a, undefined);
  assert.equal(byName.swiadomy, undefined, 'magic: true to świadomy wyjątek');
});

test('Sequence: kroki po kolei, przeloty między nimi, narzędzie kroku', () => {
  const pt = (x, y) => () => ({ x, y, angle: 0, lift: 0 });
  const seq = new Sequence([
    { dur: 1, trace: (q) => ({ x: 100 * q, y: 0, angle: 0, lift: 0 }), tool: { type: 'pencil', color: 'pen' } },
    { dur: 1, trace: pt(300, 0), tool: { type: 'pencil', color: 'coral' } },
  ]);
  assert.ok(seq.total > 2, 'jest przelot między krokami');
  const mid = seq.at(1.05 / seq.total);
  assert.ok(mid.tip.lift > 0, 'w przelocie ołówek uniesiony');
  assert.deepEqual(seq.at(0.25).local[1], 0);
  assert.equal(seq.at(1).tip.tool.color, 'coral');
  assert.equal(seq.at(0.1).tip.tool.color, 'pen');
});

test('ścieranie: ręka z gąbką przechodzi pasami przez cały kadr', () => {
  const sb = new Storyboard({ w: 1000, h: 500, warn: false });
  sb.pen([[100, 100], [400, 100]]);
  sb.clear();
  sb.pen([[100, 300], [400, 300]]);
  const hand = sb.lint() && sb.handTrack({ writeTrace: () => null });
  const clear = sb.items.find((it) => it.kind === 'clear');
  const xs = new Set();
  for (let q = 0; q <= 1; q += 0.02) {
    const t = clear.seg.start + q * clear.seg.dur;
    const h = hand.at(t);
    assert.equal(h.tool.type, 'eraser');
    xs.add(Math.round(h.x));
  }
  assert.ok(xs.size >= 5, 'gąbka odwiedza wszystkie pasy');
  assert.equal(sb.lint().length, 0);
});

test('zmiana narzędzia w powietrzu: kredka w kolorze wypełnienia', () => {
  const sb = new Storyboard({ w: 800, h: 600, warn: false });
  const box = [[100, 100], [300, 100], [300, 250], [100, 250], [100, 100]];
  sb.pen(box, { color: 'ink' });
  sb.crayon(box, { color: 'coral' });
  const hand = sb.handTrack({ writeTrace: () => null });
  const [pen, crayon] = sb.items.sort((a, b) => a.seg.start - b.seg.start);
  assert.equal(hand.at(pen.seg.start + pen.seg.dur / 2).tool.color, 'ink');
  assert.equal(hand.at(crayon.seg.start + crayon.seg.dur / 2).tool.color, 'coral');
});

// ---------------------------------------------------------------- lektor
import { readFileSync } from 'node:fs';
import { Voice, subtitleCues, toSRT } from '../src/index.js';
import { buildNarrated } from '../examples/scenes/narrated.js';

const fakeVoice = () => new Voice({
  beats: [
    { id: 'b1', text: 'Pierwsze zdanie tutaj.', audio: 'b1.ogg', duration: 2, words: [{ w: 'Pierwsze', s: 0.1, e: 0.6 }, { w: 'zdanie', s: 0.6, e: 1.1 }, { w: 'tutaj.', s: 1.1, e: 1.8 }] },
    { id: 'b2', text: 'Drugie.', audio: 'b2.ogg', duration: 1, words: [{ w: 'Drugie.', s: 0.1, e: 0.8 }] },
  ],
}, 'v/');

test('Voice: beat po numerze i id, słowo po treści/prefiksie/numerze', () => {
  const v = fakeVoice();
  assert.equal(v.beat(1).id, 'b1');
  assert.equal(v.beat('b2').src, 'v/b2.ogg');
  assert.equal(v.beat(1).word('TUTAJ').s, 1.1);
  assert.equal(v.beat(1).word('zda').s, 0.6);
  assert.equal(v.beat(1).word(0).w, 'Pierwsze');
  assert.throws(() => v.beat(1).word('nieistniejące'));
});

test('say: głos na osi czasu, kotwica do słowa, następne zdanie po głosie i rysunku', () => {
  const v = fakeVoice();
  const sb = new Storyboard({ w: 800, h: 600, warn: false });
  sb.say(v.beat(1), () => {
    sb.pen([[100, 100], [140, 100]], { name: 'kreska', cue: 'tutaj' });
  });
  sb.say(v.beat(2));
  const [c1, c2] = sb.audio;
  close(c1.start, 0.3); // głos 0,3 s po starcie rysunku
  const k = sb.tl.get('kreska');
  close(k.start, c1.start + 1.1 - 0.3, 1e-9); // ołówek 0,3 s przed słowem "tutaj"
  assert.ok(c2.start >= c1.start + c1.dur, 'drugie zdanie po pierwszym');
  assert.ok(sb.duration >= c2.start + c2.dur);
  assert.equal(sb.scene().audio.length, 2);
});

test('say: lektor czeka na rękę, gdy rysunek nie zdąży na słowo', () => {
  const v = fakeVoice();
  const sb = new Storyboard({ w: 800, h: 600, warn: false });
  sb.say(v.beat(1), () => {
    sb.pen([[0, 0], [300, 0], [300, 150], [0, 150], [0, 0]], { name: 'duza' }); // rysunek bez kotwicy, dłuższy niż czas do słowa
    sb.pen([[100, 500], [140, 500]], { name: 'na-slowo', cue: 'zdanie' });
  });
  const c = sb.audio[0];
  assert.ok(c.wait > 0, 'głos przesunięty');
  const it = sb.tl.get('na-slowo');
  const target = c.start + 0.6 - 0.3;
  assert.ok(it.start - target < 0.15, `ołówek na czas: ${(it.start - target).toFixed(2)} s`);
  assert.equal(sb.items.filter((x) => x.name === 'duza').length, 1, 'po wycofaniu brak duplikatów');
});

test('napisy: podział na linie ≤ 42 znaki, maks. 2 linie, bez nakładania', () => {
  const words = 'To jest dość długie zdanie lektora, które na pewno nie zmieści się w jednej linii napisów i musi zostać podzielone na kilka części'
    .split(' ').map((w, i) => ({ w, s: i * 0.3, e: i * 0.3 + 0.25 }));
  const cues = subtitleCues([{ start: 10, words }]);
  assert.ok(cues.length >= 2);
  for (const c of cues) {
    assert.ok(c.lines.length <= 2);
    for (const l of c.lines) assert.ok(l.length <= 42, l);
  }
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start >= cues[i - 1].end);
  assert.match(toSRT(cues), /^1\n00:00:10,000 --> /);
});

test('demo z lektorem: fizyka OK, kotwice w oknie synchronizacji', () => {
  const v = new Voice(JSON.parse(readFileSync(new URL('../examples/voice/agent/voice.json', import.meta.url), 'utf8')), 'voice/agent/');
  const sb = buildNarrated(v);
  const issues = sb.lint();
  assert.deepEqual(issues.filter((i) => i.level !== 'warn').map((i) => i.problem), []);
  for (const it of sb.items.filter((x) => x.cue)) {
    const lag = it.seg.start - it.cue.target; // >0 = później niż 0,3 s przed słowem
    assert.ok(lag < 0.85, `${it.name} „${it.cue.word}”: ${lag.toFixed(2)} s`);
  }
});

// ------------------------------------------------------------------ motywy (style)

import { THEMES, resolveTheme, themeNames, polyline, crayonTrace } from '../src/index.js';
import { buildChalk } from '../examples/scenes/styles/chalk.js';
import { buildBlueprint } from '../examples/scenes/styles/blueprint.js';
import { buildNeon } from '../examples/scenes/styles/neon.js';
import { buildNotebook } from '../examples/scenes/styles/notebook.js';
import { buildWatercolor } from '../examples/scenes/styles/watercolor.js';
import { buildComic } from '../examples/scenes/styles/comic.js';
import { buildFlipchart } from '../examples/scenes/styles/flipchart.js';
import { buildKraft } from '../examples/scenes/styles/kraft.js';
import { buildSketch } from '../examples/scenes/styles/sketch.js';

test('motywy: nazwy, uzupełnione domyślne pola, nieznany motyw to błąd', () => {
  assert.deepEqual(themeNames().map((t) => t.id).slice(0, 5), ['paper', 'chalk', 'blueprint', 'neon', 'notebook']);
  for (const id of Object.keys(THEMES)) {
    const t = resolveTheme(id);
    for (const k of ['pen', 'crayon', 'highlight', 'tools', 'text']) assert.ok(t[k], `${id}.${k}`);
  }
  assert.equal(resolveTheme('chalk').tools.pencil, 'chalk');
  assert.throws(() => resolveTheme('akwarela'), /Nieznany motyw/);
});

test('polyline: ostre rogi — przechodzi przez wierzchołki, zamknięta wraca do startu', () => {
  const pts = [[0, 0], [100, 0], [100, 60]];
  const p = polyline(pts, { seed: 3 });
  for (const [x, y] of pts) assert.ok(p.some((q) => Math.hypot(q[0] - x, q[1] - y) < 1e-6), `wierzchołek ${x},${y}`);
  assert.deepEqual(p[p.length - 1], [0, 0]);
  assert.deepEqual(polyline(pts, { closed: false }).at(-1), [100, 60]);
});

test('motyw w Storyboardzie: scena niesie motyw, ślad kredki idzie kreskowaniem motywu', () => {
  const sb = new Storyboard({ theme: 'blueprint' });
  const poly = [[0, 0], [200, 0], [200, 100], [0, 100]];
  sb.crayon(poly, { color: 'teal' });
  assert.equal(sb.scene().theme, 'blueprint');
  const it = sb.items[0];
  const o = { ...resolveTheme('blueprint').crayon, color: 'teal' };
  for (const p of [0.2, 0.5, 0.8]) {
    const a = it.trace(null, p), b = crayonTrace(poly, p, o);
    close(a.x, b.x);
    close(a.y, b.y);
  }
});

test('filmy w trzech stylach: fizyka OK, ~15–18 s, kotwice na czas', () => {
  for (const [id, build] of [['chalk', buildChalk], ['blueprint', buildBlueprint], ['neon', buildNeon], ['notebook', buildNotebook], ['watercolor', buildWatercolor], ['comic', buildComic], ['flipchart', buildFlipchart], ['kraft', buildKraft], ['sketch', buildSketch]]) {
    const v = new Voice(JSON.parse(readFileSync(new URL(`../examples/voice/${id}/voice.json`, import.meta.url), 'utf8')), `voice/${id}/`);
    const sb = build(v);
    assert.equal(sb.scene().theme, id);
    assert.deepEqual(sb.lint().filter((i) => i.level !== 'warn').map((i) => i.problem), [], id);
    assert.ok(sb.duration > 12 && sb.duration < 21, `${id}: ${sb.duration.toFixed(1)} s`);
    for (const it of sb.items.filter((x) => x.cue)) {
      assert.ok(it.seg.start - it.cue.target < 0.85, `${id} ${it.name} „${it.cue.word}”`);
    }
  }
});

test('akwarela: kolorowanie prosi o narzędzie "crayon" (motyw daje pędzel), ślad idzie zygzakiem plamy', () => {
  const sb = new Storyboard({ theme: 'watercolor' });
  const poly = [[0, 0], [300, 0], [300, 120], [0, 120]];
  sb.crayon(poly, { color: 'sky' });
  const it = sb.items[0];
  assert.equal(it.tool.type, 'crayon');
  assert.equal(resolveTheme('watercolor').tools.crayon, 'brush');
  const o = { ...resolveTheme('watercolor').crayon, color: 'sky' };
  const a = it.trace(null, 0.5), b = crayonTrace(poly, 0.5, o);
  close(a.x, b.x);
  close(a.y, b.y);
});

test('reguła kompletności obiektu: kontur → kolor bez przerw, inaczej błąd lint', () => {
  const sun = ellipse(1000, 200, 60, 60, { seed: 3 });
  const sea = [[100, 550], [900, 550], [900, 650], [100, 650]];
  const broken = (o = {}) => {
    const sb = new Storyboard();
    sb.pen(sun, { color: 'ink' });
    sb.crayon(sea, { color: 'sky' }); // inny obiekt w środku
    sb.crayon(sun, { color: 'ochre', ...o }); // powrót do słońca
    return sb.lint().filter((i) => /obiekt przerwany/.test(i.problem));
  };
  assert.equal(broken().length, 1);
  assert.match(broken()[0].problem, /pen#0.*crayon#2.*crayon#1/);
  // świadomy powrót można oznaczyć
  assert.equal(broken({ revisit: true }).length, 0);
  // poprawnie: kontur, od razu kolor, napis w środku nie przerywa
  const ok = new Storyboard();
  ok.pen(sun, { color: 'ink' });
  ok.write('☀', 1000, 210, { size: 30 });
  ok.crayon(sun, { color: 'ochre' });
  ok.crayon(sea, { color: 'sky' });
  assert.equal(ok.lint().filter((i) => /obiekt przerwany/.test(i.problem)).length, 0);
  // kółko dookoła gotowego obiektu to zaznaczenie (nowy obiekt), nie powrót
  const mark = new Storyboard();
  mark.pen(rect(500, 300, 200, 150), { color: 'ink' });
  mark.crayon(rect(500, 300, 200, 150), { color: 'teal' });
  mark.crayon(sea, { color: 'sky' });
  mark.pen(ellipse(600, 375, 150, 115), { color: 'coral' });
  assert.equal(mark.lint().filter((i) => /obiekt przerwany/.test(i.problem)).length, 0);
});

import { reelCues } from '../src/index.js';

test('rolka 9:16: kadr 720×1280, strefy bezpieczne w lint, napisy po 2–3 słowa', () => {
  const sb = new Storyboard({ format: 'reel' });
  assert.equal(sb.w, 720);
  assert.equal(sb.h, 1280);
  sb.pen(line(100, 400, 600, 400), { color: 'ink' });
  sb.pen(line(100, 1150, 600, 1150), { color: 'ink' }); // tu będzie opis i przyciski aplikacji
  const warns = sb.lint().filter((i) => /bezpieczną strefą/.test(i.problem));
  assert.deepEqual(warns.map((w) => w.name), ['pen#1']);
  assert.ok(sb.scene().fonts.captions);
  const cues = reelCues([{ start: 10, words: [
    { w: 'Nie', s: 0, e: 0.2 }, { w: 'wiesz,', s: 0.2, e: 0.5 }, { w: 'gdzie', s: 0.5, e: 0.8 },
    { w: 'znika', s: 0.8, e: 1.1 }, { w: 'wypłata?', s: 1.1, e: 1.6 }, { w: 'Zasada', s: 1.9, e: 2.3 },
  ] }]);
  assert.deepEqual(cues.map((c) => c.words.map((w) => w.w).join(' ')), ['Nie wiesz, gdzie', 'znika wypłata?', 'Zasada']);
  assert.equal(cues[0].start, 10);
  for (let i = 0; i + 1 < cues.length; i++) assert.ok(cues[i].end < cues[i + 1].start);
});
