#!/usr/bin/env node
// film.mjs — film z pracowni: obraz powstaje pociągnięcie po pociągnięciu (MP4, 30 kl./s).
// Kadr pionowy 1080 × 1920, a dla prac panoramicznych poziomy 1920 × 1080 (--uklad pion|poziom wymusza).
//
//   node film.mjs out/malarz/perla/obraz.json                 # obok pliku: film.mp4
//   node film.mjs obraz.json --czas 40 --koniec 4             # 40 s malowania + 4 s gotowego obrazu
//   node film.mjs obraz.json --klatki 2,8,20,33               # tylko podglądy PNG w tych sekundach
//   node film.mjs obraz.json --arkusz                         # 6 klatek z całego filmu w jednym PNG
//
// Klatki liczy strona pracownia/pracownia.html w Chromium (Playwright) jako czystą funkcję czasu,
// kilka kart na przemian (--watki, domyślnie 4), ffmpeg koduje w trakcie. Wymaga: playwright, ffmpeg.

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const TU = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), plik = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1] === undefined || args[i + 1].startsWith('--') ? true : args[i + 1]; };
if (!plik) { console.log('użycie: node film.mjs <obraz.json> [--czas 30] [--koniec 3.5] [--fps 30] [--uklad pion|poziom] [--szer px] [--jakosc 2] [--watki 4] [--klatki t1,t2] [--arkusz] [--out film.mp4]'); process.exit(1); }
const fps = Number(opt('fps', 30)), watki = Number(opt('watki', 4));
const out = resolve(opt('out', join(dirname(plik), 'film.mp4')));

// serwer: pliki skilla + wskazany obraz pod /obraz.json (moduły ES nie działają z file://)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const serwer = createServer(async (req, res) => {
  try {
    const sciezka = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (sciezka === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const p = sciezka === '/obraz.json' ? resolve(plik) : join(TU, sciezka);
    if (sciezka !== '/obraz.json' && relative(TU, p).startsWith('..')) throw new Error('poza katalogiem');
    const tresc = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(tresc);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => serwer.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${serwer.address().port}/pracownia/pracownia.html?film=1&obraz=/obraz.json&czas=${opt('czas', 30)}&koniec=${opt('koniec', 3.5)}&jakosc=${opt('jakosc', 2)}${opt('szer') ? `&szer=${opt('szer')}` : ''}${opt('uklad') ? `&uklad=${opt('uklad')}` : ''}`;

const { chromium } = await import('playwright');
const flagi = (process.env.CHROMIUM_ARGS ?? '').split(' ').filter(Boolean);
async function przegladarka() {
  try { return await chromium.launch({ args: flagi, executablePath: process.env.CHROMIUM_PATH }); } catch (e) {
    // paczka playwright z repo może chcieć innej wersji Chromium niż zainstalowana w systemie
    const sys = '/opt/pw-browsers/chromium';
    if (!process.env.CHROMIUM_PATH && existsSync(sys)) return chromium.launch({ args: flagi, executablePath: sys });
    throw e;
  }
}
const br = await przegladarka();
async function karta() {
  const k = await br.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });   // klatki idą z canvasu, okno nie ma znaczenia
  k.on('pageerror', (e) => console.error('błąd strony:', e.message));
  k.on('console', (m) => m.type() === 'error' && console.error('konsola:', m.text()));
  await k.goto(url);
  await k.waitForFunction(() => window.__malarz, null, { timeout: 15000 });
  await k.evaluate(() => window.__malarz.gotowy.then(() => true));
  return k;
}
const zrzut = async (k, t, typ = 'image/jpeg') => {
  const d = await k.evaluate(([tt, ty]) => { window.__malarz.klatka(tt); return window.__malarz.canvas.toDataURL(ty, 0.95); }, [t, typ]);
  return Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
};
const t0 = Date.now(), pierwsza = await karta();
const { czas, kw, kh } = await pierwsza.evaluate(() => ({ czas: window.__malarz.czas, kw: window.__malarz.canvas.width, kh: window.__malarz.canvas.height }));

if (opt('klatki') || opt('arkusz')) {
  const ts = opt('arkusz') ? [0.03, 0.12, 0.3, 0.55, 0.8, 1].map((f) => f * czas) : String(opt('klatki')).split(',').map(Number);
  const pliki = [];
  for (const t of ts) {
    const p = join(dirname(out), `klatka_${t.toFixed(1).padStart(5, '0')}.png`);
    await writeFile(p, await zrzut(pierwsza, t, 'image/png')); pliki.push(p); console.log(`klatka ${t.toFixed(1)} s → ${p}`);
  }
  if (opt('arkusz')) {
    const ark = join(dirname(out), 'arkusz.png');
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...pliki.flatMap((p) => ['-i', p]), '-filter_complex', `${pliki.map((_, i) => `[${i}]scale=360:-1[v${i}]`).join(';')};${pliki.map((_, i) => `[v${i}]`).join('')}hstack=${pliki.length}`, ark], { stdio: 'inherit' });
    console.log(`arkusz → ${ark}`);
  }
} else {
  const n = Math.round(czas * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.stdin.on('error', () => {});
  const karty = [pierwsza, ...(await Promise.all(Array.from({ length: Math.min(watki, n) - 1 }, karta)))];
  const gotowe = new Map(); let nast = 0, zrobione = 0;
  const wyslij = async () => { while (gotowe.has(nast)) { const b = gotowe.get(nast); gotowe.delete(nast); nast++; if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r)); } };
  console.log(`${plik}: ${n} klatek (${czas.toFixed(1)} s), ${kw}×${kh}, ${karty.length} karty`);
  await Promise.all(karty.map(async (k, wi) => {
    for (let i = wi; i < n; i += karty.length) {
      gotowe.set(i, await zrzut(k, i / fps)); await wyslij();
      if (++zrobione % 90 === 0) console.log(`  ${zrobione} / ${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }));
  ff.stdin.end();
  const kod = await new Promise((r) => ff.on('close', r));
  console.log(kod === 0 ? `film → ${out} (${((Date.now() - t0) / 1000).toFixed(0)} s)` : 'ffmpeg zakończył się błędem');
}
await br.close(); serwer.close();
