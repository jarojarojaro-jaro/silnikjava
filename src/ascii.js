// Filtr klatki „ASCII”: narysowana klatka zamienia się w siatkę znaków.
// Każda komórka patrzy, ile w niej tuszu (różnica od koloru papieru) i w którą
// stronę biegnie kreska (główna oś rozkładu tuszu w komórce):
//   * cienka, wyraźnie skierowana kreska → znak kierunku  -  /  |  \
//   * plama albo gęste kreskowanie        → znak gęstości  . : = + * # @
// Kolor znaku to średni kolor tuszu w komórce, więc akcenty zostają kolorowe.
// Ręka rysuje normalnie (scena powstaje kreska po kresce), a znaki pojawiają
// się dokładnie tam, gdzie przybywa tuszu.
//
// Własny kod silnika — bez zewnętrznych usług (inspiracja: edytory ASCII art).

const RAMP = ' .:-=+*#%@';

/**
 * Zamienia zawartość płótna w znaki. Wołane przez motyw (theme.post) po
 * narysowaniu sceny, przed ręką.
 * @param {import('./sketch.js').Sketch} sk
 * @param {object} o cell [szer, wys] komórki w px sceny, font (CSS), paper (kolor tła),
 *                   min (próg pokrycia, od którego stawiamy znak), line (próg „kierunkowości”)
 */
export function asciiFilter(sk, o = {}) {
  const { ctx } = sk;
  const canvas = ctx.canvas;
  if (!canvas?.width || typeof ctx.getImageData !== 'function') return;
  const W = canvas.width, H = canvas.height;
  const base = sk.base ?? ctx.getTransform();
  const scale = Math.hypot(base.a, base.b) || 1;
  const [cw0, ch0] = o.cell ?? [9, 16];
  const cw = Math.max(3, Math.round(cw0 * scale)), ch = Math.max(5, Math.round(ch0 * scale));
  const paper = parseColor(sk.col(o.paper ?? 'paper'));
  // odczyt pikseli z GPU jest drogi: czytamy kopię w rozdzielczości sceny (9 × 16 px na
  // komórkę), także przy eksporcie w większym rozmiarze; mniej niż 1:1 psuje rozpoznawanie
  // kierunku (poziome linie dostają wtedy znaki gęstości)
  const k = Math.min(1, 1 / scale);
  const SW = Math.ceil(W * k), SH = Math.ceil(H * k);
  const small = (sample ??= makeCanvas(SW, SH));
  if (small.width !== SW || small.height !== SH) { small.width = SW; small.height = SH; }
  const sc = small.getContext('2d', { willReadFrequently: true });
  sc.drawImage(canvas, 0, 0, W, H, 0, 0, SW, SH);
  const img = sc.getImageData(0, 0, SW, SH).data;
  const cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
  const glyphs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cw * k), y0 = Math.floor(r * ch * k);
      const x1 = Math.min(SW, Math.floor((c + 1) * cw * k)), y1 = Math.min(SH, Math.floor((r + 1) * ch * k));
      let n = 0, sw = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, cr = 0, cg = 0, cb = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * SW + x) * 4;
          const dr = img[i] - paper[0], dg = img[i + 1] - paper[1], db = img[i + 2] - paper[2];
          const w = Math.min(1, Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) / 140);
          n++;
          if (w < 0.08) continue;
          const u = x - x0, v = y - y0;
          sw += w; sx += w * u; sy += w * v;
          sxx += w * u * u; syy += w * v * v; sxy += w * u * v;
          cr += w * img[i]; cg += w * img[i + 1]; cb += w * img[i + 2];
        }
      }
      const cover = sw / n;
      if (cover < (o.min ?? 0.035)) continue;
      // kierunek kreski: główna oś momentów bezwładności tuszu w komórce
      const mx = sx / sw, my = sy / sw;
      const vxx = sxx / sw - mx * mx, vyy = syy / sw - my * my, vxy = sxy / sw - mx * my;
      const spread = vxx + vyy || 1;
      const aniso = Math.hypot(vxx - vyy, 2 * vxy) / spread;
      let g;
      if (cover < 0.75 && aniso > (o.line ?? 0.42)) {
        const a = (0.5 * Math.atan2(2 * vxy, vxx - vyy) * 180) / Math.PI; // -90..90, oś y w dół
        // komórka jest wyższa niż szersza: kąt na ekranie liczymy w pikselach, więc wprost
        g = Math.abs(a) < 22.5 ? '-' : Math.abs(a) > 67.5 ? '|' : a > 0 ? '\\' : '/';
      } else {
        g = RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.round(Math.sqrt(cover) * (RAMP.length - 1) * 1.15)))];
      }
      glyphs.push([c, r, g, `rgb(${(cr / sw) | 0},${(cg / sw) | 0},${(cb / sw) | 0})`, Math.min(1, 0.45 + cover * 1.6)]);
    }
  }
  // tło od nowa i znaki w siatce
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = sk.col(o.paper ?? 'paper');
  ctx.fillRect(0, 0, W, H);
  ctx.font = `${o.weight ?? 600} ${Math.round(ch * 0.82)}px ${o.font ?? '"JetBrains Mono", monospace'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [c, r, g, color, a] of glyphs) {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillText(g, c * cw + cw / 2, r * ch + ch / 2 + 1);
  }
  ctx.restore();
  return { cols, rows, glyphs: glyphs.length };
}

let sample = null;
function makeCanvas(w, h) {
  if (typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function parseColor(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
  const r = /rgba?\((\d+)\D+(\d+)\D+(\d+)/i.exec(c);
  return r ? [+r[1], +r[2], +r[3]] : [0, 0, 0];
}
