// Filtr klatki „CRT”: ekran z kineskopu albo automatu — pikselowa siatka (scena
// zgrubiona do kratek i powiększona bez wygładzania), linie skanowania i maska
// fosforu (paski R G B). Działa jak asciiFilter: po narysowaniu sceny, przed ręką,
// więc pisak zostaje ostry na wierzchu, a ekran ma fakturę.
//
// Koszt klatki to dwa drawImage na płótnie i jeden wypełniony wzór (bez odczytu
// pikseli z GPU), więc mieści się w budżecie 33 ms (docs/KOD.md, punkt 10).

import { makeCanvas, texture } from './canvas.js';

// bufor pikselizacji trzymany między klatkami (rozmiar zmienia się tylko przy zmianie płótna)
let pixelBuf = null;

/**
 * Rozmiar bufora pikselizacji: płótno zgrubione do kratek o boku `pixel` px sceny.
 * @param {number} W szerokość płótna (px urządzenia)
 * @param {number} H wysokość płótna
 * @param {number} pixel bok kratki w px sceny (1 = bez pikselizacji)
 * @param {number} scale przelicznik px sceny → px urządzenia
 * @returns {[number, number]} szerokość i wysokość bufora (co najmniej 1×1)
 */
export function crtBuffer(W, H, pixel, scale = 1) {
  const cell = Math.max(1, pixel * scale);
  return [Math.max(1, Math.round(W / cell)), Math.max(1, Math.round(H / cell))];
}

/**
 * Nakłada ekran CRT na narysowaną klatkę.
 * @param {import('./sketch.js').Sketch} sk
 * @param {object} o
 *   pixel  — bok kratki w px sceny (domyślnie 1: bez pikselizacji; 3–4 daje wyraźną siatkę)
 *   gap    — odstęp linii skanowania w px sceny (domyślnie 3)
 *   dark   — siła zaciemnienia linii, 0–1 (domyślnie 0.28)
 *   mask   — siła maski fosforu, 0–1 (domyślnie 0.07; 0 wyłącza)
 */
export function crtFilter(sk, o = {}) {
  const { ctx } = sk;
  const canvas = ctx.canvas;
  if (!canvas?.width || typeof ctx.drawImage !== 'function') return;
  const W = canvas.width, H = canvas.height;
  const base = sk.base ?? ctx.getTransform();
  const scale = Math.hypot(base.a, base.b) || 1;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (o.pixel > 1) {
    // zgrubienie: kopia w kratkach, potem powiększenie z powrotem na całe płótno
    const [sw, sh] = crtBuffer(W, H, o.pixel, scale);
    const small = (pixelBuf ??= makeCanvas(sw, sh));
    if (small.width !== sw || small.height !== sh) { small.width = sw; small.height = sh; }
    const sc = small.getContext('2d');
    sc.imageSmoothingEnabled = false;
    sc.drawImage(canvas, 0, 0, W, H, 0, 0, sw, sh);
    ctx.drawImage(small, 0, 0, sw, sh, 0, 0, W, H);
  }
  // wzór linii i maski: jedna kafelka, powtarzana po całym płótnie
  const gap = Math.max(2, Math.round((o.gap ?? 3) * scale));
  const dark = o.dark ?? 0.28, mask = o.mask ?? 0.07;
  const key = `crt|${gap}|${dark}|${mask}`;
  // kafelka gap×gap: trzy kolumny R G B i jeden ciemny wiersz skanowania na dole
  ctx.fillStyle = ctx.createPattern(texture(key, gap, (c, S) => {
    if (mask > 0) {
      const cols = ['255,70,70', '70,255,90', '80,140,255'];
      for (let i = 0; i < 3; i++) {
        c.fillStyle = `rgba(${cols[i]},${mask})`;
        c.fillRect(Math.floor((i * S) / 3), 0, Math.ceil(S / 3), S);
      }
    }
    c.fillStyle = `rgba(0,0,0,${dark})`;
    c.fillRect(0, S - 1, S, 1);
  }), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
