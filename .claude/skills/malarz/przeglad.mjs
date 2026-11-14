#!/usr/bin/env node
// przeglad.mjs — ten sam wzór we wszystkich stylach na jednym arkuszu z podpisami: do wyboru stylu.
//
//   node przeglad.mjs zdjecie.jpg                          # wszystkie style oprócz „kopia” (ta trwa najdłużej)
//   node przeglad.mjs motywy/tatry.js --style olej,akwarela,tusz,kredki
//   node przeglad.mjs zdjecie.jpg --szczegol 0.6 --kolumny 4 --out out/malarz/przeglad
//
// Każdy styl maluje osobny proces maluj.mjs (--watki naraz, domyślnie 4); prace zostają w
// <out>/<styl>/ (obraz.json do filmu), a arkusz w <out>/przeglad.jpg. Wymaga: ffmpeg.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLE } from './lib/style.js';
import { STYLE_SUCHE } from './lib/rysownik.js';
import { zWiersza } from './lib/argumenty.js';

const TU = dirname(fileURLToPath(import.meta.url));
const { plik: wzor, opt } = zWiersza();
const WSZYSTKIE = { ...STYLE, ...STYLE_SUCHE };
if (!wzor) { console.log(`użycie: node przeglad.mjs <wzor.jpg | motyw.js> [--style ${Object.keys(WSZYSTKIE).join(',')}] [--szczegol 1] [--kolumny n] [--watki 4] [--out katalog]`); process.exit(1); }
const style = opt('style') ? String(opt('style')).split(',') : Object.keys(WSZYSTKIE).filter((s) => s !== 'kopia');
for (const s of style) if (!WSZYSTKIE[s]) { console.error(`nieznany styl ${s}; dostępne: ${Object.keys(WSZYSTKIE).join(', ')}`); process.exit(1); }
const out = resolve(opt('out', join('out', 'malarz', `${basename(wzor, extname(wzor))}-przeglad`)));
mkdirSync(out, { recursive: true });

// ---- malowanie: po kilka stylów naraz -------------------------------------------------------------
const t0 = Date.now(), kolejka = style.slice(), wyniki = {};
const jeden = (s) => new Promise((gotowe) => {
  const p = spawn(process.execPath, [join(TU, 'maluj.mjs'), wzor, '--styl', s, '--skala', '1', '--szczegol', String(opt('szczegol', 1)), '--out', join(out, s)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let tekst = ''; p.stdout.on('data', (d) => { tekst += d; }); p.stderr.on('data', (d) => { tekst += d; });
  p.on('close', (kod) => { wyniki[s] = kod === 0 ? tekst.trim().split('\n').pop() : null; console.log(kod === 0 ? `  ${s.padEnd(9)} ${wyniki[s].replace(/ → .*/, '')}` : `  ${s}: błąd\n${tekst}`); gotowe(); });
});
console.log(`${style.length} stylów → ${out}`);
await Promise.all(Array.from({ length: Math.min(Number(opt('watki', 4)), style.length) }, async () => { while (kolejka.length) await jeden(kolejka.shift()); }));
const udane = style.filter((s) => wyniki[s]);
if (!udane.length) { console.error('żaden styl się nie namalował'); process.exit(1); }

// ---- arkusz: kafelki z podpisem (nazwa stylu i jego opis) ------------------------------------------
const czcionka = ['/usr/share/fonts/opentype/inter/Inter-Regular.otf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/System/Library/Fonts/Helvetica.ttc', 'C:/Windows/Fonts/arial.ttf'].find(existsSync);
const SZER = 640, kafle = [];
const ff = (argi) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...argi], { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status !== 0) throw new Error('ffmpeg nie złożył arkusza'); };
for (const s of udane) {
  const kafel = join(out, s, 'kafel.png'), nazwa = join(out, s, 'nazwa.txt'), opis = join(out, s, 'opis.txt');
  writeFileSync(nazwa, s); writeFileSync(opis, WSZYSTKIE[s].opis.replace(/^[^:]+: /, ''));
  const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:');
  const podpis = czcionka ? `,drawtext=fontfile='${esc(czcionka)}':textfile='${esc(nazwa)}':fontcolor=0xEADCBD:fontsize=26:x=14:y=h-58,drawtext=fontfile='${esc(czcionka)}':textfile='${esc(opis)}':fontcolor=0x9A917F:fontsize=15:x=14:y=h-24` : '';
  ff(['-i', join(out, s, 'obraz.png'), '-vf', `scale=${SZER}:-2,pad=${SZER}:ih+70:0:0:color=0x16130F${podpis}`, kafel]);
  kafle.push(kafel);
}
const kol = Number(opt('kolumny', Math.ceil(Math.sqrt(kafle.length)))), wys = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=height', '-of', 'csv=p=0', kafle[0]]).stdout.toString().trim());
const uklad = kafle.map((_, i) => `${(i % kol) * (SZER + 12)}_${Math.floor(i / kol) * (wys + 12)}`).join('|');
const arkusz = join(out, 'przeglad.jpg');
ff([...kafle.flatMap((k) => ['-i', k]), '-filter_complex', kafle.length > 1 ? `xstack=inputs=${kafle.length}:layout=${uklad}:fill=0x0D0B0A` : 'null', '-q:v', '3', arkusz]);
if (!czcionka) console.log(`(bez podpisów: nie znalazłem czcionki) kolejność: ${udane.join(', ')}`);
console.log(`przegląd → ${arkusz} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
