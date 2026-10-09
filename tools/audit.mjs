#!/usr/bin/env node
// Audyt płynności: klatka po klatce mierzy czas renderu i śledzi rękę — skoki
// (teleporty), znikanie i największą prędkość. Kod wyjścia 1, gdy film łamie
// budżet (do CI i do `npm run audit`).
//
//   node tools/audit.mjs                         # wszystkie style, rolki i dema
//   node tools/audit.mjs examples/explainer.html # jedna strona
//   --fps 30  --jump 70  --budget 33  --json
//
// Skok = izolowane przesunięcie ręki między klatkami większe niż --jump px i ponad
// 2,5× większe niż w sąsiednich klatkach (szybki, ciągły ruch się nie liczy).
// Budżet = p95 czasu klatki [ms]; pojedyncze klatki budujące cache (pierwsza
// klatka plamy) mogą być dłuższe — liczy się to, co widz odczuje jako szarpanie.

import { parseArgs, openPlayer } from './lib/page.mjs';
import { STYLES } from '../examples/scenes/styles/index.js';

const { page, opt } = parseArgs(process.argv);
const fps = Number(opt('fps', 30));
const width = Number(opt('width', 1280));
const jumpPx = Number(opt('jump', 70));
const budget = Number(opt('budget', 33));
const pages = page
  ? [page]
  : [
      ...STYLES.map((s) => `examples/styles.html?s=${s.id}`),
      ...['notebook', 'neon', 'comic'].map((r) => `examples/reels.html?r=${r}`),
      'examples/narrated.html',
      'examples/hero.html',
      'examples/explainer.html',
    ];

let failed = 0;
const rows = [];
for (const p of pages) {
  const { tab, dims, close } = await openPlayer(p, { width });
  const res = await tab.evaluate(({ fps, jumpPx }) => {
    const pl = window.__player;
    const sk = pl.sk;
    // skoki liczymy w jednostkach sceny (rolka 9:16 renderuje się w powiększeniu)
    const sc = pl.scene.w / (sk.ctx.canvas.width || pl.scene.w);
    let pos = null;
    const orig = sk.tool.bind(sk);
    sk.tool = (x, y, o) => {
      const m = sk.ctx.getTransform();
      pos = { x: (m.a * x + m.c * y + m.e) * sc, y: (m.b * x + m.d * y + m.f) * sc };
      return orig(x, y, o);
    };
    for (let i = 0; i < 10; i++) pl.renderAt(i / fps); // rozgrzewka (JIT, czcionki, cache)
    const times = [];
    const track = [];
    const n = Math.ceil(pl.duration * fps);
    for (let i = 0; i <= n; i++) {
      const t = i / fps;
      pos = null;
      const t0 = performance.now();
      pl.renderAt(t);
      times.push(performance.now() - t0);
      track.push(pos && { t, ...pos });
    }
    sk.tool = orig;
    const step = track.map((q, i) => (i && q && track[i - 1] ? Math.hypot(q.x - track[i - 1].x, q.y - track[i - 1].y) : 0));
    const jumps = [];
    let visible = 0, maxSpeed = 0;
    for (let i = 0; i < track.length; i++) {
      if (track[i]) visible++;
      maxSpeed = Math.max(maxSpeed, step[i] * fps);
      const around = Math.max(step[i - 1] ?? 0, step[i + 1] ?? 0);
      if (step[i] > jumpPx && step[i] > 2.5 * around) jumps.push({ t: +track[i].t.toFixed(2), px: Math.round(step[i]) });
    }
    const sorted = [...times].sort((a, b) => a - b);
    const q = (k) => sorted[Math.min(sorted.length - 1, Math.floor(k * sorted.length))];
    return {
      frames: times.length,
      avg: times.reduce((a, b) => a + b, 0) / times.length, p95: q(0.95), max: sorted[sorted.length - 1],
      visiblePct: (100 * visible) / track.length, maxSpeed, jumps,
    };
  }, { fps, jumpPx });
  await close();
  const bad = res.p95 > budget || res.jumps.length > 0;
  if (bad) failed++;
  rows.push({ page: p, dims, ...res, bad });
}

if (opt('json', false)) console.log(JSON.stringify(rows));
else {
  for (const r of rows) {
    const name = r.page.replace(/^examples\//, '').padEnd(32);
    const jumps = r.jumps.length ? `  skoki: ${r.jumps.slice(0, 5).map((j) => `${j.t}s:${j.px}px`).join(' ')}` : '';
    console.log(`${r.bad ? 'ŹLE' : 'ok '}  ${name} klatka śr ${r.avg.toFixed(1).padStart(5)} ms, p95 ${r.p95.toFixed(1).padStart(5)} ms, max ${r.max.toFixed(0).padStart(4)} ms | ręka ${r.visiblePct.toFixed(0)}%, vmax ${Math.round(r.maxSpeed)} px/s${jumps}`);
  }
  console.log(`\n${rows.length - failed}/${rows.length} w budżecie (p95 ≤ ${budget} ms, bez skoków ręki > ${jumpPx} px)`);
}
process.exit(failed ? 1 : 0);
