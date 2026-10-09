// Płótna pomocnicze w jednym miejscu: tworzenie (przeglądarka, worker z OffscreenCanvas)
// i tekstury generowane raz i trzymane w pamięci.

import { rng } from './math.js';

/**
 * Nowe płótno w×h (zaokrąglone w górę, co najmniej 1×1). W przeglądarce <canvas>,
 * w workerze OffscreenCanvas; bez żadnego z nich — czytelny błąd zamiast „document is not defined”.
 */
export function makeCanvas(w, h) {
  const W = Math.max(1, Math.ceil(w)), H = Math.max(1, Math.ceil(h));
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H);
  throw new Error('silnik: rysowanie wymaga <canvas> (przeglądarka) albo OffscreenCanvas');
}

const textures = new Map();

/**
 * Tekstura size×size (deterministyczna) generowana raz: paint(ctx, size, rand).
 * Ziarno domyślnie z klucza i rozmiaru (jak w pierwszych motywach — ich tła się nie zmieniają).
 */
export function texture(key, size, paint, seed = key.length * 97 + size) {
  const k = `${key}|${size}`;
  if (textures.has(k)) return textures.get(k);
  const c = makeCanvas(size, size);
  paint(c.getContext('2d'), size, rng(seed));
  textures.set(k, c);
  return c;
}
