// grafika.js — wejście i wyjście obrazów (Node). Wczytywanie dowolnego formatu przez ffmpeg,
// zapis PNG własnym, małym koderem (zlib z Node), bez zależności.

import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/** Rozmiar obrazu w pikselach (ffprobe). */
export function rozmiar(plik) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', plik], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`nie da się odczytać obrazu: ${plik}\n${r.stderr}`);
  const [w, h] = r.stdout.trim().split(',').map(Number);
  return { w, h };
}

/**
 * Wczytuje obraz przeskalowany do W × H jako Float32Array RGB 0..255.
 * @param {{x:number,y:number,w:number,h:number}} [kadr] wycinek źródła w pikselach
 */
export function wczytaj(plik, W, H, kadr) {
  const vf = (kadr ? `crop=${kadr.w}:${kadr.h}:${kadr.x}:${kadr.y},` : '') + `scale=${W}:${H}:flags=lanczos`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', plik, '-vf', vf, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0 || r.stdout.length !== W * H * 3) throw new Error(`ffmpeg nie wczytał ${plik}: ${r.stderr}`);
  return Float32Array.from(r.stdout);
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function kawalek(typ, dane) {
  const b = Buffer.alloc(12 + dane.length);
  b.writeUInt32BE(dane.length, 0); b.write(typ, 4, 'ascii'); dane.copy(b, 8);
  b.writeUInt32BE(crc(b.subarray(4, 8 + dane.length)), 8 + dane.length);
  return b;
}

/**
 * Zapisuje PNG. px: tablica RGB albo RGBA (kanały = 3 lub 4), wartości 0..255 (przycinane).
 */
export function zapiszPNG(plik, px, w, h, kanaly = 3) {
  const wiersz = w * 3 + 1, raw = Buffer.alloc(wiersz * h);
  for (let y = 0; y < h; y++) {
    let q = y * wiersz + 1, i = y * w * kanaly;
    for (let x = 0; x < w; x++, i += kanaly) for (let c = 0; c < 3; c++) { const v = px[i + c]; raw[q++] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(plik, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), kawalek('IHDR', ihdr), kawalek('IDAT', deflateSync(raw, { level: 6 })), kawalek('IEND', Buffer.alloc(0))]));
}

/** Skleja obrazy RGB (ta sama wysokość) obok siebie z odstępem. */
export function obok(obrazy, odstep = 12, tlo = [24, 22, 20]) {
  const h = Math.max(...obrazy.map((o) => o.h)), w = obrazy.reduce((s, o) => s + o.w, 0) + odstep * (obrazy.length + 1);
  const out = new Uint8ClampedArray(w * (h + 2 * odstep) * 3);
  for (let i = 0; i < out.length; i += 3) { out[i] = tlo[0]; out[i + 1] = tlo[1]; out[i + 2] = tlo[2]; }
  let x0 = odstep;
  for (const o of obrazy) {
    const k = o.kanaly ?? 3;
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) for (let c = 0; c < 3; c++) out[((y + odstep) * w + x0 + x) * 3 + c] = o.px[(y * o.w + x) * k + c];
    x0 += o.w + odstep;
  }
  return { px: out, w, h: h + 2 * odstep };
}

/** Wycinek obrazu RGB powiększony całkowitą liczbą razy (najbliższy sąsiad) — do oglądania detalu. */
export function wytnij(px, w, kanaly, x0, y0, cw, ch, razy = 1) {
  const out = new Uint8ClampedArray(cw * razy * ch * razy * 3);
  for (let y = 0; y < ch * razy; y++) for (let x = 0; x < cw * razy; x++) {
    const sx = x0 + ((x / razy) | 0), sy = y0 + ((y / razy) | 0);
    for (let c = 0; c < 3; c++) out[(y * cw * razy + x) * 3 + c] = px[(sy * w + sx) * kanaly + c];
  }
  return { px: out, w: cw * razy, h: ch * razy };
}
