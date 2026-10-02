#!/usr/bin/env node
// Renderuje stronę z animacją klatka po klatce do PNG i (opcjonalnie) skleja MP4 przez ffmpeg.
// Klatki liczone są deterministycznie przez window.__player.renderAt(t),
// więc wynik jest identyczny niezależnie od szybkości komputera.
//
//   node tools/render.mjs examples/hero.html --out out/hero --fps 30 --mp4
//   node tools/render.mjs examples/explainer.html --width 1920 --mp4 --duration 30
//
// Wymaga: playwright (npm i -D playwright) i ffmpeg dla --mp4.
// Dodatkowe flagi Chromium: zmienna CHROMIUM_ARGS (np. za proxy z własnym CA).

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, openPlayer } from './lib/page.mjs';

const { page, opt } = parseArgs(process.argv);
if (!page) {
  console.log('użycie: node tools/render.mjs <strona.html> [--out dir] [--fps 30] [--duration s] [--from s] [--width 1280] [--every n] [--mp4] [--sheet]');
  process.exit(1);
}
const fps = Number(opt('fps', 30));
const width = Number(opt('width', 1280));
const out = resolve(opt('out', 'out/frames'));
const every = Number(opt('every', 1));
const from = Number(opt('from', 0));

const { tab, dims, close } = await openPlayer(page, { width });
const duration = Number(opt('duration', dims.duration + 1));

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const total = Math.ceil((duration - from) * fps);
console.log(`${page}: ${total + 1} klatek, ${dims.w}x${dims.h}, ${fps} fps -> ${out}`);
let k = 0;
for (let i = 0; i <= total; i += every) {
  const t = from + i / fps;
  const data = await tab.evaluate((tt) => {
    window.__player.renderAt(tt);
    return window.__player.canvas.toDataURL('image/png');
  }, t);
  await writeFile(join(out, `f_${String(k++).padStart(5, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
  if (k % 30 === 0) process.stdout.write(`\r  ${k} / ${Math.floor(total / every) + 1}`);
}
process.stdout.write('\n');
await close();

if (opt('mp4', false)) {
  const mp4 = `${out}.mp4`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps / every), '-i', join(out, 'f_%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', mp4], { stdio: 'inherit' });
  if (r.status === 0) console.log(`MP4: ${mp4}`);
  else console.error('ffmpeg nie zadziałał (czy jest zainstalowany?)');
}
if (opt('sheet', false)) {
  const sheet = `${out}-sheet.png`;
  const r = spawnSync('montage', [join(out, 'f_*.png'), '-tile', '6x', '-geometry', '320x+4+4', sheet], { stdio: 'inherit' });
  if (r.status === 0) console.log(`Arkusz klatek: ${sheet}`);
}
