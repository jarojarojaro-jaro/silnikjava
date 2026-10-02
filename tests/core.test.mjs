import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp, prog, noise1, rng, ease, catmull, resample, pathLength, pointAt, line, rect, ellipse,
  svgPath, bounds, Timeline, Storyboard,
} from '../src/index.js';

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
  const ctx = { save() {}, restore() {}, translate() {}, scale() {} };
  const rec = (name) => (...a) => {
    calls.push([name, ...a]);
    return name === 'pen' && a[1] > 0 && a[1] < 1 ? { x: 1, y: 2 } : null;
  };
  return { ctx, calls, paper: rec('paper'), pen: rec('pen'), crayon: rec('crayon'), write: rec('write'), fill: rec('fill'), pencil: rec('pencil'), arrow: rec('arrow'), strokes: rec('strokes') };
}

test('Storyboard: czasy kroków, opcje pędzla nie mieszają się z czasem', () => {
  const sb = new Storyboard({ w: 100, h: 100 });
  sb.pen([[0, 0], [650, 0]]) // 1 s przy domyślnej prędkości
    .crayon([[0, 0], [10, 0], [10, 10]], { dur: 0.5, spacing: 9 })
    .wait(0.25)
    .write('abc', 0, 0, { dur: 1 });
  const segs = [...sb.tl.segments.values()];
  close(segs[0].dur, 1);
  close(segs[1].start, 1);
  close(segs[2].start, 1.75);
  close(sb.duration, 2.75);
});

test('Storyboard: ołówek tylko podczas rysowania, kredka pod konturem', () => {
  const sb = new Storyboard({ w: 100, h: 100 });
  sb.pen([[0, 0], [650, 0]], { dur: 1 });
  sb.crayon([[0, 0], [10, 0], [10, 10]], { dur: 1 });
  let sk = mockSketch();
  sb.draw(sk, 0.5);
  assert.ok(sk.calls.some((c) => c[0] === 'pencil'));
  sk = mockSketch();
  sb.draw(sk, 1.5);
  const names = sk.calls.map((c) => c[0]);
  assert.ok(names.indexOf('crayon') < names.indexOf('pen'), 'kredka rysowana przed konturem');
  sk = mockSketch();
  sb.draw(sk, 5);
  assert.ok(!sk.calls.some((c) => c[0] === 'pencil'));
});

test('Storyboard: clear() ukrywa poprzedni rozdział, keep zostaje', () => {
  const sb = new Storyboard({ w: 100, h: 100, pencil: false });
  sb.pen([[0, 0], [10, 0]], { dur: 0.5, name: 'stary' });
  sb.pen([[0, 5], [10, 5]], { dur: 0.5, name: 'tlo', keep: true });
  sb.clear({ dur: 1 });
  sb.pen([[0, 9], [10, 9]], { dur: 0.5, name: 'nowy' });
  const sk = mockSketch();
  sb.draw(sk, sb.duration);
  const ys = sk.calls.filter((c) => c[0] === 'pen').map((c) => c[1][0][1]);
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
