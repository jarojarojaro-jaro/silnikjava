#!/usr/bin/env node
// Renderuje stronę z animacją klatka po klatce do PNG i (opcjonalnie) skleja MP4 przez ffmpeg.
// Klatki liczone są deterministycznie przez window.__player.renderAt(t), więc wynik jest
// identyczny niezależnie od szybkości komputera i liczby wątków.
//
//   node tools/render.mjs examples/hero.html --out out/hero --fps 30 --mp4     # MP4 domyślnie w Full HD
//   node tools/render.mjs examples/explainer.html --width 1920 --mp4 --duration 30
//   node tools/render.mjs examples/narrated.html --mp4     # z lektorem: dźwięk + napisy (SRT/VTT i ścieżka w MP4)
//   node tools/render.mjs "examples/reels.html?r=neon" --width 1080 --mp4   # rolka: napisy wypalone, bez ścieżki napisów
//
// Szybkość: klatki liczy równolegle kilka przeglądarek (--jobs, domyślnie do 4), na przemian
// (0, 4, 8… / 1, 5, 9…), a ffmpeg koduje film w trakcie — gotowe klatki idą do niego po kolei.
//
// Wymaga: playwright (npm i -D playwright) i ffmpeg dla --mp4, ImageMagick (montage) dla --sheet.
// Dodatkowe flagi Chromium: zmienna CHROMIUM_ARGS (np. za proxy z własnym CA).

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { parseArgs, openPlayer, sizeCanvas } from './lib/page.mjs';

const { page, opt } = parseArgs(process.argv);
if (!page) {
  console.log('użycie: node tools/render.mjs <strona.html> [--out dir] [--fps 30] [--duration s] [--from s] [--width 1280] [--every n] [--jobs n] [--mp4] [--sheet] [--subs none]');
  process.exit(1);
}
const fps = Number(opt('fps', 30));
const out = resolve(opt('out', 'out/frames'));
const every = Number(opt('every', 1));
const from = Number(opt('from', 0));
const jobs = Math.max(1, Number(opt('jobs', Math.min(4, availableParallelism()))));
const wantMp4 = !!opt('mp4', false);

const t0 = Date.now();
const opened = await openPlayer(page, { width: 1280 });
const { tab, close, url, root } = opened;
// rozdzielczość: --width albo, dla MP4, Full HD (1920×1080, rolka 9:16 — 1080×1920); klatki podglądu 1280
const portrait = opened.dims.sceneH > opened.dims.sceneW;
const width = Number(opt('width', wantMp4 ? (portrait ? 1080 : 1920) : 1280));
const dims = width === 1280 ? opened.dims : await sizeCanvas(tab, width);
const duration = Number(opt('duration', dims.duration + 1));
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const frames = [];
for (let i = 0; i <= Math.ceil((duration - from) * fps); i += every) frames.push(from + i / fps);
console.log(`${page}: ${frames.length} klatek, ${dims.w}x${dims.h}, ${fps / every} fps, ${jobs} wątki -> ${out}`);

// lektor i napisy (scena ze Storyboard.say): klipy audio + SRT/VTT — potrzebne ffmpeg od startu
const extras = await tab.evaluate(() => {
  const s = window.__player.scene;
  return { audio: s.audio ?? [], srt: s.subtitles?.('srt') ?? '', vtt: s.subtitles?.('vtt') ?? '', burned: !!s.burnedCaptions };
});
const clips = extras.audio
  .map((c) => ({ ...c, file: join(root, decodeURIComponent(new URL(c.src, url).pathname)), at: c.start - from }))
  // klip zaczęty przed --from przycinamy (wchodzi od środka), zakończony przed nim pomijamy
  .filter((c) => c.at + (c.dur ?? Infinity) > 0);
if (extras.srt) {
  await writeFile(`${out}.srt`, extras.srt);
  await writeFile(`${out}.vtt`, extras.vtt);
}
// rolka z napisami wypalonymi w obraz: bez drugiej (miękkiej) ścieżki napisów — odtwarzacz
// pokazałby obie naraz, a SRT ma przerwy w pauzach lektora
const subs = extras.srt && opt('subs', true) !== 'none' && !extras.burned;

const mp4 = `${out}.mp4`;
const ffmpeg = wantMp4 ? startFfmpeg() : null;

// klatki: kilka przeglądarek na przemian, do ffmpeg w kolejności (bufor na klatki „z przyszłości”)
const workers = [{ tab }, ...(await Promise.all(Array.from({ length: Math.min(jobs, frames.length) - 1 }, async () => {
  const w = await openPlayer(page, { width: 1280 });
  if (width !== 1280) await sizeCanvas(w.tab, width);
  return w;
})))];
const ready = new Map();
let next = 0, done = 0;
const flush = async () => {
  while (ready.has(next)) {
    const buf = ready.get(next);
    ready.delete(next);
    next++;
    if (ffmpeg && !ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  }
};
await Promise.all(workers.map(async (w, wi) => {
  for (let k = wi; k < frames.length; k += workers.length) {
    const data = await w.tab.evaluate((tt) => {
      window.__player.renderAt(tt);
      return window.__player.canvas.toDataURL('image/png');
    }, frames[k]);
    const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    await writeFile(join(out, `f_${String(k).padStart(5, '0')}.png`), buf);
    ready.set(k, buf);
    await flush();
    if (++done % 30 === 0) process.stdout.write(`\r  ${done} / ${frames.length}`);
  }
}));
process.stdout.write(`\r  ${done} / ${frames.length}\n`);
await Promise.all([close(), ...workers.slice(1).map((w) => w.close())]);
if (extras.srt) console.log(`Napisy: ${out}.srt, ${out}.vtt`);

if (ffmpeg) {
  ffmpeg.stdin.end();
  const code = await new Promise((r) => ffmpeg.on('close', r));
  if (code === 0) console.log(`MP4: ${mp4}${clips.length ? ` (lektor: ${clips.length} klipów${subs ? ', napisy jako ścieżka' : ''})` : ''}`);
  else console.error('ffmpeg nie zadziałał (czy jest zainstalowany?)');
}
if (opt('sheet', false)) {
  const sheet = `${out}-sheet.png`;
  const r = spawnSync('montage', [join(out, 'f_*.png'), '-tile', '6x', '-geometry', '320x+4+4', sheet], { stdio: 'inherit' });
  if (r.status === 0) console.log(`Arkusz klatek: ${sheet}`);
}
console.log(`czas: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

/** ffmpeg czytający klatki PNG ze strumienia, z lektorem i napisami. */
function startFfmpeg() {
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps / every), '-i', '-'];
  clips.forEach((c) => (c.at < 0 ? args.push('-ss', (-c.at).toFixed(3), '-i', c.file) : args.push('-i', c.file)));
  if (subs) args.push('-i', `${out}.srt`);
  if (clips.length) {
    // każdy klip lektora na swoim miejscu osi czasu, zmiksowane w jedną ścieżkę i wyrównane
    // do jednej głośności (EBU R128, -16 LUFS jak w serwisach wideo)
    const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(Math.max(0, c.at) * 1000)}:all=1[a${i}]`).join(';');
    const mix = clips.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[aout]`;
    args.push('-filter_complex', `${delays};${mix}`, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000');
  } else args.push('-map', '0:v');
  if (subs) args.push('-map', `${clips.length + 1}:s`, '-c:s', 'mov_text', '-metadata:s:s:0', 'language=pol');
  // -tune animation: płaskie plamy i ostre kreski (mniej artefaktów); +faststart: odtwarzanie
  // w sieci rusza od razu; -t: film trwa dokładnie tyle co obraz (dźwięk dopełniony ciszą — apad,
  // w wycinku --from/--duration przycięty razem z napisami)
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-tune', 'animation', '-movflags', '+faststart',
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-t', (frames.length / (fps / every)).toFixed(3), mp4);
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  p.on('error', () => console.error('nie da się uruchomić ffmpeg (czy jest zainstalowany?)'));
  p.stdin.on('error', () => {}); // ffmpeg, który skończył wcześniej (błąd), zgłosi to kodem wyjścia
  return p;
}
