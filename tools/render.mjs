#!/usr/bin/env node
// Renderuje stronę z animacją klatka po klatce do PNG i (opcjonalnie) skleja MP4 przez ffmpeg.
// Klatki liczone są deterministycznie przez window.__player.renderAt(t),
// więc wynik jest identyczny niezależnie od szybkości komputera.
//
//   node tools/render.mjs examples/hero.html --out out/hero --fps 30 --mp4
//   node tools/render.mjs examples/explainer.html --width 1920 --mp4 --duration 30
//   node tools/render.mjs examples/narrated.html --mp4     # z lektorem: dźwięk + napisy (SRT/VTT i ścieżka w MP4)
//   node tools/render.mjs "examples/reels.html?r=neon" --width 1080 --mp4   # rolka: napisy wypalone, bez ścieżki napisów
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

const { tab, dims, close, url, root } = await openPlayer(page, { width });
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
// lektor i napisy (scena ze Storyboard.say): klipy audio + SRT/VTT
const extras = await tab.evaluate(() => {
  const s = window.__player.scene;
  return { audio: s.audio ?? [], srt: s.subtitles?.('srt') ?? '', vtt: s.subtitles?.('vtt') ?? '', burned: !!s.burnedCaptions };
});
await close();
const clips = extras.audio
  .map((c) => ({ ...c, file: join(root, decodeURIComponent(new URL(c.src, url).pathname)), at: c.start - from }))
  .filter((c) => c.at >= 0);
if (extras.srt) {
  await writeFile(`${out}.srt`, extras.srt);
  await writeFile(`${out}.vtt`, extras.vtt);
  console.log(`Napisy: ${out}.srt, ${out}.vtt`);
}

if (opt('mp4', false)) {
  const mp4 = `${out}.mp4`;
  const args = ['-y', '-loglevel', 'error', '-framerate', String(fps / every), '-i', join(out, 'f_%05d.png')];
  clips.forEach((c) => args.push('-i', c.file));
  // rolka z napisami wypalonymi w obraz: bez drugiej (miękkiej) ścieżki napisów — odtwarzacz
  // pokazałby obie naraz, a SRT ma przerwy w pauzach lektora
  const subs = extras.srt && opt('subs', true) !== 'none' && !extras.burned;
  if (subs) args.push('-i', `${out}.srt`);
  if (clips.length) {
    // każdy klip lektora na swoim miejscu osi czasu, zmiksowane w jedną ścieżkę
    const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`).join(';');
    const mix = clips.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0:dropout_transition=0[aout]`;
    args.push('-filter_complex', `${delays};${mix}`, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k');
  } else args.push('-map', '0:v');
  if (subs) args.push('-map', `${clips.length + 1}:s`, '-c:s', 'mov_text', '-metadata:s:s:0', 'language=pol');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', mp4);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status === 0) console.log(`MP4: ${mp4}${clips.length ? ` (lektor: ${clips.length} klipów${subs ? ', napisy jako ścieżka' : ''})` : ''}`);
  else console.error('ffmpeg nie zadziałał (czy jest zainstalowany?)');
}
if (opt('sheet', false)) {
  const sheet = `${out}-sheet.png`;
  const r = spawnSync('montage', [join(out, 'f_*.png'), '-tile', '6x', '-geometry', '320x+4+4', sheet], { stdio: 'inherit' });
  if (r.status === 0) console.log(`Arkusz klatek: ${sheet}`);
}
