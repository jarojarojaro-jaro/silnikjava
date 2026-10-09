// Podstawowa matematyka silnika: interpolacje, deterministyczny szum, RNG, easingi.
// Wszystko jest deterministyczne (te same ziarna => ten sam rysunek), dzięki czemu
// każda klatka da się odtworzyć dokładnie tak samo przy eksporcie wideo.

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);

/** Postęp 0..1 odcinka czasu [start, start+dur]. */
export const prog = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / dur));

/** Hash liczby -> [0,1). Stabilny, bez stanu. */
export function hash(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453123;
  return s - Math.floor(s);
}

/** Gładki szum 1D w zakresie [-1,1] (value noise z interpolacją smoothstep). */
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash(i), hash(i + 1), smoothstep(f)) * 2 - 1;
}

/** Generator liczb pseudolosowych mulberry32 -> funkcja zwracająca [0,1). */
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  // lekkie "przestrzelenie" — dobre do wyskakujących elementów (gwiazdka, dymek)
  back: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  // ręka rysownika: szybki start, zwolnienie pod koniec kreski
  hand: (t) => 1 - Math.pow(1 - t, 1.8),
};

/** Zwraca funkcję easingu po nazwie albo samą funkcję. */
export function easing(e) {
  if (typeof e === 'function') return e;
  return ease[e ?? 'linear'] ?? ease.linear;
}
