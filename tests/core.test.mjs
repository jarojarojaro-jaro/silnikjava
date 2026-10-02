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
