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

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { extname, join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const page = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
if (!page) {
  console.log('użycie: node tools/render.mjs <strona.html> [--out dir] [--fps 30] [--duration s] [--from s] [--width 1280] [--every n] [--mp4] [--sheet]');
  process.exit(1);
}
const fps = Number(opt('fps', 30));
const width = Number(opt('width', 1280));
const out = resolve(opt('out', 'out/frames'));
const every = Number(opt('every', 1));
const from = Number(opt('from', 0));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Brak pakietu "playwright". Zainstaluj: npm i -D playwright');
  process.exit(1);
}

// prosty serwer statyczny (moduły ES nie działają z file://)
const root = resolve('.');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (relative(root, p).startsWith('..')) throw new Error('poza katalogiem');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/${page}`;

const extra = (process.env.CHROMIUM_ARGS ?? '').split(' ').filter(Boolean);
// Chromium sam czyta HTTPS_PROXY ze środowiska i omija proxy dla 127.0.0.1
const browser = await chromium.launch({ args: extra });
const tab = await browser.newPage({ viewport: { width, height: Math.round((width * 9) / 16) }, deviceScaleFactor: 1 });
tab.on('pageerror', (e) => console.error('błąd strony:', e.message));
tab.on('console', (m) => m.type() === 'error' && console.error('konsola:', m.text()));
tab.on('requestfailed', (r) => console.error('nieudane żądanie:', r.url(), r.failure()?.errorText));
await tab.goto(url, { waitUntil: 'load' });
await tab.waitForFunction(() => window.__player, null, { timeout: 10000 });
await tab.evaluate(() => window.__player.ready);

// canvas renderujemy w docelowej rozdzielczości niezależnie od układu strony
const dims = await tab.evaluate((w) => {
  const p = window.__player;
  p.pause();
  const c = p.canvas;
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '9999', maxWidth: 'none', aspectRatio: 'auto' });
  c.style.width = `${w}px`;
  c.style.height = `${Math.round((w * p.scene.h) / p.scene.w)}px`;
  p.resize();
  return { duration: p.duration, w: c.width, h: c.height };
}, width);
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
await browser.close();
server.close();

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
