// Motywy (style wizualne). Motyw to jeden obiekt: tło, paleta, czcionki,
// charakter kreski, kolorowanie, mieszanie zakreślacza, narzędzie w ręce.
// Sceny używają nazw kolorów z palety (ink, pen, teal, sky, ochre, coral, …),
// więc ta sama scena renderuje się w każdym motywie.
//
//   new Storyboard({ theme: 'chalk' })            // albo
//   new Player(canvas, scene, { sketch: { theme: 'neon' } })

import { rng } from './math.js';

const cache = new Map();
/** Wzór (deterministyczny) generowany raz i trzymany w pamięci. */
function texture(key, size, paint) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size, rng(key.length * 97 + size));
  cache.set(key, c);
  return c;
}

const vignette = (ctx, w, h, strength) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const THEMES = {
  // ------------------------------------------------------------ papier (domyślny)
  paper: {
    name: 'Ink on cream',
    pen: { style: 'ink' },
  },

  // ------------------------------------------------------------ tablica kredowa
  chalk: {
    name: 'Tablica kredowa',
    palette: {
      paper: '#2e4a3e', ink: '#f3f1ea', inkSoft: '#c9cfc6', pen: '#f6e7a1', penDark: '#e9d98a',
      teal: '#9ad8cc', sky: '#a8cbe8', ochre: '#f2cf72', coral: '#f3a49c', plum: '#cdb3e6', white: '#ffffff',
    },
    fonts: { hand: '"Kalam", "Caveat", cursive', title: '"Caveat Brush", "Kalam", cursive' },
    pen: { style: 'chalk', width: 1.45, jitter: 1.2, grain: 0.6 },
    crayon: { alpha: 0.6, grain: 0.8, chalk: true, blend: 'screen' },
    highlight: { blend: 'screen', alpha: 0.35 },
    tools: { pencil: 'chalk', marker: 'chalk' },
    outline: 'rgba(20,24,22,0.6)',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // kurz kredy i ślady dawnego ścierania
      ctx.fillStyle = ctx.createPattern(texture('chalk-dust', 256, (g, S, r) => {
        for (let i = 0; i < 2600; i++) {
          g.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.05})`;
          g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      const r = rng(5);
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.025 + r() * 0.03})`;
        ctx.lineWidth = 50 + r() * 70;
        const x = r() * w, y = r() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 120, y - 60 * r(), x + 260, y + 80 * r(), x + 320 + r() * 200, y + (r() - 0.5) * 120);
        ctx.stroke();
      }
      ctx.restore();
      vignette(ctx, w, h, 0.45);
      // drewniana rama
      ctx.save();
      ctx.strokeStyle = '#6b4a2b';
      ctx.lineWidth = 18;
      ctx.strokeRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(9, 9, w - 18, h - 18);
      ctx.restore();
    },
  },

  // ------------------------------------------------------------ blueprint
  blueprint: {
    name: 'Blueprint',
    palette: {
      paper: '#13406f', ink: '#eaf3ff', inkSoft: '#a9c6ea', pen: '#ffffff', penDark: '#d6e8ff',
      teal: '#7fe0ff', sky: '#9cc9ff', ochre: '#ffd479', coral: '#ff9d8a', plum: '#c9b6ff', white: '#ffffff',
    },
    fonts: { hand: '"Architects Daughter", "Kalam", cursive', title: '"Architects Daughter", "Kalam", cursive', mono: '"Courier Prime", monospace' },
    pen: { style: 'tech', width: 0.62, jitter: 0.28, overshoot: 9 },
    crayon: { w: 1.4, spacing: 8, grain: 0, alpha: 0.75, angle: 0.785, wave: 0 },
    highlight: { blend: 'screen', alpha: 0.3 },
    tools: { pencil: 'techpen', marker: 'techpen' },
    outline: 'rgba(5,15,30,0.7)',
    background(sk, w, h) {
      const { ctx } = sk;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#174a80');
      g.addColorStop(1, '#0f355f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      for (const [step, a] of [[24, 0.09], [120, 0.2]]) {
        ctx.strokeStyle = `rgba(190,220,255,${a})`;
        ctx.lineWidth = step > 24 ? 1.2 : 0.8;
        ctx.beginPath();
        for (let x = 0; x <= w; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
        for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = ctx.createPattern(texture('bp-noise', 256, (c, S, r) => {
        for (let i = 0; i < 1800; i++) {
          c.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * 0.04})` : `rgba(0,0,30,${r() * 0.08})`;
          c.fillRect(r() * S, r() * S, 1.5, 1.5);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      vignette(ctx, w, h, 0.35);
    },
  },

  // ------------------------------------------------------------ neon / lightboard
  neon: {
    name: 'Neon (lightboard)',
    palette: {
      paper: '#07080c', ink: '#f4f6ff', inkSoft: '#9aa3c7', pen: '#38f2e0', penDark: '#2bd4c4',
      teal: '#3cff9e', sky: '#56b4ff', ochre: '#ffe14f', coral: '#ff4fa3', plum: '#b46bff', white: '#ffffff',
    },
    fonts: { hand: '"Patrick Hand", "Kalam", cursive', title: '"Patrick Hand", "Kalam", cursive' },
    pen: { style: 'neon', width: 1.1, jitter: 0.6 },
    crayon: { alpha: 0.32, grain: 0, blend: 'lighter', w: 16, spacing: 10 },
    highlight: { blend: 'lighter', alpha: 0.35 },
    text: { glow: true },
    tools: { pencil: 'neon', marker: 'neon' },
    outline: 'rgba(0,0,0,0.8)',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(40,48,80,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // refleks na szybie
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(w * 0.62, 0);
      ctx.lineTo(w * 0.7, 0);
      ctx.lineTo(w * 0.42, h);
      ctx.lineTo(w * 0.36, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = ctx.createPattern(texture('neon-noise', 256, (c, S, r) => {
        for (let i = 0; i < 1500; i++) {
          c.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
          c.fillRect(r() * S, r() * S, 1, 1);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
    },
  },

  // ------------------------------------------------------------ zeszyt w kratkę
  notebook: {
    name: 'Zeszyt w kratkę',
    palette: {
      paper: '#fdfdf8', ink: '#1f3a93', inkSoft: '#5d6fa8', pen: '#d13434', penDark: '#a82222',
      // zakreślacze i kredki z piórnika
      teal: '#33cc7a', sky: '#4aa8ff', ochre: '#ffe03a', coral: '#ff6fae', plum: '#9d74ff', white: '#ffffff',
    },
    fonts: { hand: '"Shadows Into Light Two", "Kalam", cursive', title: '"Shadows Into Light Two", "Kalam", cursive' },
    // długopis: cienko, lekki nacisk, prawie bez zwężeń
    pen: { style: 'ink', width: 0.6, jitter: 0.5, pressure: 0.2, taper: 0.4 },
    crayon: { w: 6, spacing: 6, alpha: 0.6, grain: 0.7 },
    highlight: { blend: 'multiply', alpha: 0.5 },
    tools: { pencil: 'ballpoint' },
    outline: '#3a3a3a',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // kratka 5 mm (co 24 px) i czerwony margines
      ctx.save();
      ctx.strokeStyle = 'rgba(80,140,215,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
      for (let y = 0; y <= h; y += 24) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,60,60,0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(98.5, 0);
      ctx.lineTo(98.5, h);
      ctx.stroke();
      ctx.restore();
      // włókna papieru
      ctx.fillStyle = ctx.createPattern(texture('note-paper', 256, (c, S, r) => {
        for (let i = 0; i < 1600; i++) {
          c.fillStyle = `rgba(90,80,60,${r() * 0.05})`;
          c.fillRect(r() * S, r() * S, 1 + r() * 2, 1);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
    },
  },

  // ------------------------------------------------------------ akwarela
  watercolor: {
    name: 'Akwarela',
    palette: {
      paper: '#fbf6ec', ink: '#3b2f2a', inkSoft: '#8c7f76', pen: '#2f5d8a', penDark: '#22476b',
      teal: '#4fa39a', sky: '#5d9fd8', ochre: '#f0b445', coral: '#e57b62', plum: '#9a78b8', white: '#ffffff',
    },
    fonts: { hand: '"Mynerve", "Kalam", cursive', title: '"Amatic SC", "Kalam", cursive' },
    // cienkopis (sepia): cienko, prawie bez nacisku
    pen: { style: 'ink', width: 0.55, jitter: 0.7, pressure: 0.15, taper: 0.5 },
    // pędzel: szeroki, rzadki zygzak — plama, nie kreskowanie
    crayon: { wash: true, w: 30, spacing: 22, alpha: 0.9, grain: 0.35 },
    highlight: { blend: 'multiply', alpha: 0.35 },
    tools: { pencil: 'techpen', crayon: 'brush' },
    outline: '#3b2f2a',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // papier czerpany: duże, miękkie nierówności + drobne ziarno
      ctx.fillStyle = ctx.createPattern(texture('wc-mottle', 512, (c, S, r) => {
        for (let i = 0; i < 70; i++) {
          const x = r() * S, y = r() * S, rad = 30 + r() * 80;
          const rgb = r() > 0.5 ? '150,120,80' : '255,255,255';
          const a = rgb[0] === '1' ? 0.035 : 0.22;
          // plama zawinięta na brzegach kafla (bez szwów); gradient do przezroczystego TEGO SAMEGO koloru
          for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
            const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
            g.addColorStop(0, `rgba(${rgb},${a})`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            c.fillStyle = g;
            c.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
          }
        }
        for (let i = 0; i < 5000; i++) {
          c.fillStyle = r() > 0.5 ? `rgba(110,90,60,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.4})`;
          c.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      vignette(ctx, w, h, 0.08);
    },
  },
};

/** Motyw po nazwie albo obiekt (uzupełniony o domyślne pola). */
export function resolveTheme(t) {
  const th = typeof t === 'string' ? THEMES[t] : t;
  if (!th) throw new Error(`Nieznany motyw: ${t} (dostępne: ${Object.keys(THEMES).join(', ')})`);
  return { pen: { style: 'ink' }, crayon: {}, highlight: {}, tools: {}, text: {}, ...th };
}

/** Lista motywów do wyboru (np. w UI). */
export const themeNames = () => Object.entries(THEMES).map(([id, t]) => ({ id, name: t.name }));

