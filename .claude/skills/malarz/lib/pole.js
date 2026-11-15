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

/**
 * Gdzie w obrazie patrzy człowiek: do dwóch elips (ułamki szer./wys.) do mapy ważności. Bez „rozumienia”
 * tematu, z trzech prostych wskazówek: kolor odstający od otoczenia (obiekt na tle), barwa skóry
 * (twarz, dłonie) i lekka przewaga środka kadru. Zwraca [] dla obrazów bez wyraźnego punktu uwagi.
 * @param {Float32Array} T wzór RGB 0..255 @returns {Array<{x:number,y:number,rx:number,ry:number,ile:number}>}
 */
export function punktyUwagi(T, W, H) {
  // liczone w małej skali (ok. 96 px): chodzi o plamy, nie o detale
  const k = Math.max(1, Math.round(Math.max(W, H) / 96)), w = Math.floor(W / k), h = Math.floor(H / k), n = w * h;
  if (w < 12 || h < 12) return [];
  const kan = [0, 1, 2].map(() => new Float32Array(n)), skora = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const q = ((y * k + j) * W + x * k + i) * 3; r += T[q]; g += T[q + 1]; b += T[q + 2]; }
    const m = k * k, i = y * w + x; r /= m; g /= m; b /= m; kan[0][i] = r; kan[1][i] = g; kan[2][i] = b;
    // skóra: czerwień nad zielenią nad błękitem, średnio jasna, niezbyt jaskrawa (reguła z klasycznych detektorów RGB)
    if (r > 80 && g > 40 && b > 20 && r > g && g > b * 0.9 && r - g > 12 && r - g < 110 && r - b < 170) skora[i] = Math.min(1, (r - g) / 30);
  }
  const blisko = kan.map((c) => rozmyj(c, w, h, 1.5)), daleko = kan.map((c) => rozmyj(c, w, h, Math.max(w, h) / 3.5));
  const S = new Float32Array(n), sk = rozmyj(skora, w, h, 2);
  let udzialSkory = 0; for (let i = 0; i < n; i++) udzialSkory += skora[i] > 0 ? 1 / n : 0;
  const wagaSkory = udzialSkory > 0.45 ? 0 : 60;          // „skóra” na pół obrazu to piasek albo drewno, nie twarz
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, dx = (x + 0.5) / w - 0.5, dy = (y + 0.5) / h - 0.45;
    const kontrast = Math.hypot(blisko[0][i] - daleko[0][i], blisko[1][i] - daleko[1][i], blisko[2][i] - daleko[2][i]);
    S[i] = (kontrast + wagaSkory * sk[i]) * Math.exp(-(dx * dx + dy * dy) * 2.2);
  }
  const G = rozmyj(S, w, h, Math.max(2, Math.max(w, h) / 24)), out = [];
  let srednia = 0, szczyt = 0; for (let i = 0; i < n; i++) srednia += G[i] / n;
  for (let nr = 0; nr < 2; nr++) {
    let mx = 0, mi = 0; for (let i = 0; i < n; i++) if (G[i] > mx) { mx = G[i]; mi = i; }
    if (mx <= 1e-6 || mx < srednia * 2.2 || (nr && mx < szczyt * 0.75)) break;   // nic nie odstaje od reszty obrazu
    if (!nr) szczyt = mx;
    // plama wokół szczytu: zalewanie do połowy jego wysokości, potem środek ciężkości i rozrzut
    const w0 = new Uint8Array(n), stos = [mi]; w0[mi] = 1; let sw = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
    while (stos.length) {
      const i = stos.pop(), x = i % w, y = (i / w) | 0, g = G[i]; sw += g; sx += g * x; sy += g * y; sxx += g * x * x; syy += g * y * y;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + a, yy = y + b, j = yy * w + xx; if (xx >= 0 && yy >= 0 && xx < w && yy < h && !w0[j] && G[j] > mx * 0.5) { w0[j] = 1; stos.push(j); } }
    }
    const cx = sx / sw, cy = sy / sw, rx = Math.sqrt(Math.max(1, sxx / sw - cx * cx)) * 1.5, ry = Math.sqrt(Math.max(1, syy / sw - cy * cy)) * 1.5;
    for (let i = 0; i < n; i++) if (w0[i]) G[i] = 0;
    if (rx / w > 0.4 && ry / h > 0.4) break;                 // „temat” na cały kadr to brak tematu
    out.push({ x: (cx + 0.5) / w, y: (cy + 0.5) / h, rx: Math.max(0.05, Math.min(0.3, rx / w)), ry: Math.max(0.05, Math.min(0.3, ry / h)), ile: nr ? 1.5 : 2.5 });
  }
  return out;
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
