// pole.js — to, co malarz „widzi” w obrazie-wzorze: rozmycie, kierunki krawędzi, mapa ważności.
// Czysta matematyka na tablicach (działa w Node i w przeglądarce).

/** Rozmycie Gaussa jednego kanału (Float32Array W*H), brzegi powielone. */
export function rozmyj(src, W, H, sigma) {
  const r = Math.max(1, Math.ceil(sigma * 2.5)), k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(W * H), dst = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) { const xx = x + i < 0 ? 0 : x + i >= W ? W - 1 : x + i; a += src[y * W + xx] * k[i + r]; }
    tmp[y * W + x] = a;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) { const yy = y + i < 0 ? 0 : y + i >= H ? H - 1 : y + i; a += tmp[yy * W + x] * k[i + r]; }
    dst[y * W + x] = a;
  }
  return dst;
}

/** Jasność (0..255) z RGB float. */
export function szarosc(T, N) {
  const g = new Float32Array(N);
  for (let i = 0; i < N; i++) g[i] = 0.3 * T[i * 3] + 0.59 * T[i * 3 + 1] + 0.11 * T[i * 3 + 2];
  return g;
}

/**
 * Pole kierunków: kąt (0..π) wzdłuż krawędzi w każdym pikselu (tensor struktury w skali sigma).
 * Pędzel prowadzony tym kątem idzie po formie, nie w poprzek.
 */
export function kierunki(gray, W, H, sigma) {
  const N = W * H, g = rozmyj(gray, W, H, sigma);
  const jxx = new Float32Array(N), jyy = new Float32Array(N), jxy = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, gx = g[i + 1] - g[i - 1], gy = g[i + W] - g[i - W];
    jxx[i] = gx * gx; jyy[i] = gy * gy; jxy[i] = gx * gy;
  }
  const a = rozmyj(jxx, W, H, sigma * 2), b = rozmyj(jyy, W, H, sigma * 2), c = rozmyj(jxy, W, H, sigma * 2);
  const ang = new Float32Array(N);
  for (let i = 0; i < N; i++) ang[i] = 0.5 * Math.atan2(2 * c[i], a[i] - b[i]) + Math.PI / 2;
  return ang;
}

/**
 * Mapa ważności: 1 wszędzie + więcej tam, gdzie wzór ma drobny rysunek (oczy, krawędzie, faktura)
 * + ręcznie wskazane skupienia (twarz, dłonie).
 * @param {number} detal ile dodać w najbogatszych miejscach (0 = bez)
 * @param {Array<{x:number,y:number,rx:number,ry:number,ile:number}>} skupienia elipsy w ułamkach szer./wys. obrazu
 */
export function waznosc(gray, W, H, detal = 2, skupienia = []) {
  const N = W * H, wt = new Float32Array(N).fill(1);
  if (detal > 0) {
    const g = rozmyj(gray, W, H, 1.2), m = new Float32Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      m[i] = Math.hypot(g[i + 1] - g[i - 1], g[i + W] - g[i - W]);
    }
    const e = rozmyj(m, W, H, 7), pr = Float32Array.from(e).sort();
    const top = pr[Math.floor(N * 0.97)] || 1;
    for (let i = 0; i < N; i++) wt[i] += detal * Math.min(1, e[i] / top);
  }
  for (const s of skupienia) {
    const cx = s.x * W, cy = s.y * H, rx = s.rx * W, ry = s.ry * H;
    const x0 = Math.max(0, Math.floor(cx - 2 * rx)), x1 = Math.min(W, Math.ceil(cx + 2 * rx));
    const y0 = Math.max(0, Math.floor(cy - 2 * ry)), y1 = Math.min(H, Math.ceil(cy + 2 * ry));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
      if (d < 4) wt[y * W + x] += s.ile * Math.exp(-d * 1.2);
    }
  }
  return wt;
}

/** Generator losowy z ziarna (mulberry32) + przybliżony rozkład normalny. */
export function Los(ziarno) {
  let s = ziarno >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rnd.gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.22;
  return rnd;
}
