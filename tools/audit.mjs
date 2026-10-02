#!/usr/bin/env node
// Audyt animacji: klatka po klatce mierzy czas renderu i śledzi ołówek —
// skoki (teleportacje), znikanie/pojawianie się i jak długo jest widoczny.
//
//   node tools/audit.mjs examples/explainer.html [--fps 60] [--width 1280] [--jump 40] [--json]
//
// Teleport = izolowane przesunięcie ołówka między klatkami większe niż --jump px
// i ponad 2,5× większe niż w sąsiednich klatkach (szybki ciągły ruch się nie liczy).

import { parseArgs, openPlayer } from './lib/page.mjs';

const { page, opt } = parseArgs(process.argv);
if (!page) {
  console.log('użycie: node tools/audit.mjs <strona.html> [--fps 60] [--width 1280] [--jump 40] [--json]');
  process.exit(1);
}
const fps = Number(opt('fps', 60));
const width = Number(opt('width', 1280));
const jumpPx = Number(opt('jump', 40));

const { tab, dims, close } = await openPlayer(page, { width });

const res = await tab.evaluate(({ fps, jumpPx }) => {
  const p = window.__player;
  const sk = p.sk;
  let pos = null;
  const orig = sk.pencil.bind(sk);
  sk.pencil = (x, y, o) => {
    const m = sk.ctx.getTransform();
    pos = { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
    return orig(x, y, o);
  };
  // rozgrzewka (JIT, czcionki, cache)
  for (let i = 0; i < 10; i++) p.renderAt(i / fps);
  const times = [];
  const track = [];
  const n = Math.ceil(p.duration * fps);
  for (let i = 0; i <= n; i++) {
    const t = i / fps;
    pos = null;
    const t0 = performance.now();
    p.renderAt(t);
    times.push(performance.now() - t0);
    track.push(pos && { t, ...pos });
  }
  sk.pencil = orig;
  // teleport = izolowany skok: duże przesunięcie, a sąsiednie klatki ruszają się dużo mniej
  // (szybki, ale ciągły ruch ręki ma podobne przesunięcia w kolejnych klatkach)
  const step = track.map((p, i) => (i && p && track[i - 1] ? Math.hypot(p.x - track[i - 1].x, p.y - track[i - 1].y) : 0));
  const jumps = [];
  let toggles = 0;
  let visible = 0;
  let maxSpeed = 0;
  for (let i = 0; i < track.length; i++) {
    if (track[i]) visible++;
    if (i && !!track[i] !== !!track[i - 1]) toggles++;
    maxSpeed = Math.max(maxSpeed, step[i] * fps);
    const around = Math.max(step[i - 1] ?? 0, step[i + 1] ?? 0);
    if (step[i] > jumpPx && step[i] > 2.5 * around) jumps.push({ t: +track[i].t.toFixed(3), px: Math.round(step[i]) });
  }
  const sorted = [...times].sort((a, b) => a - b);
  const q = (k) => sorted[Math.min(sorted.length - 1, Math.floor(k * sorted.length))];
  return {
    frames: times.length,
    frameMs: { avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +sorted[sorted.length - 1].toFixed(2) },
    pencil: { visiblePct: +((100 * visible) / track.length).toFixed(1), toggles, maxSpeed: Math.round(maxSpeed), jumps: jumps.length, worst: jumps.sort((a, b) => b.px - a.px).slice(0, 8) },
  };
}, { fps, jumpPx });

await close();
if (opt('json', false)) console.log(JSON.stringify(res));
else {
  console.log(`${page}  (${dims.w}x${dims.h}, ${res.frames} klatek @ ${fps} fps)`);
  console.log(`  render klatki [ms]: śr ${res.frameMs.avg}  p50 ${res.frameMs.p50}  p95 ${res.frameMs.p95}  max ${res.frameMs.max}`);
  console.log(`  ołówek: widoczny ${res.pencil.visiblePct}% klatek, pojawia/znika ${res.pencil.toggles}×, teleporty (> ${jumpPx}px): ${res.pencil.jumps}, maks. prędkość ${res.pencil.maxSpeed} px/s`);
  if (res.pencil.worst.length) console.log(`  największe skoki: ${res.pencil.worst.map((j) => `${j.t}s:${j.px}px`).join('  ')}`);
}
