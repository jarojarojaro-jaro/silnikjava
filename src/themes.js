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
    writeScale: 1.2,
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

  // ------------------------------------------------------------ komiks
  comic: {
    name: 'Komiks',
    palette: {
      paper: '#fffaf0', ink: '#141414', inkSoft: '#4d4d4d', pen: '#e63946', penDark: '#b71f2c',
      teal: '#2ec4b6', sky: '#3a86ff', ochre: '#ffbe0b', coral: '#ff5d8f', plum: '#8338ec', white: '#ffffff',
    },
    fonts: { hand: '"Shantell Sans", "Kalam", cursive', title: '"Bangers", "Kalam", cursive' },
    writeScale: 1.15,
    // pędzelek: gruba kreska z mocnym naciskiem i długim zwężeniem końców
    pen: { style: 'ink', width: 1.35, jitter: 0.35, pressure: 0.9, taper: 1.5 },
    // płaski kolor markera z rastrem kropek (jak w druku)
    crayon: { halftone: true, w: 24, spacing: 18, alpha: 1 },
    highlight: { blend: 'multiply', alpha: 0.45 },
    tools: { pencil: 'brushpen', crayon: 'marker' },
    outline: '#141414',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // papier gazetowy: drobne włókna i ślad rastra
      ctx.fillStyle = ctx.createPattern(texture('comic-paper', 240, (c, S, r) => {
        for (let i = 0; i < 1400; i++) {
          c.fillStyle = `rgba(120,100,60,${r() * 0.05})`;
          c.fillRect(r() * S, r() * S, 1 + r() * 2, 1);
        }
        c.fillStyle = 'rgba(230,57,70,0.035)';
        for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < S; x += 8) {
          c.beginPath();
          c.arc(x, y, 1.2, 0, Math.PI * 2);
          c.fill();
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
    },
  },

  // ------------------------------------------------------------ flipchart
  flipchart: {
    name: 'Flipchart',
    palette: {
      paper: '#fdfdfb', ink: '#1b1b1f', inkSoft: '#6b6b72', pen: '#1f5fd1', penDark: '#17479e',
      teal: '#1f9e5a', sky: '#2f8de4', ochre: '#f5a300', coral: '#e2352f', plum: '#7b3fc4', white: '#ffffff',
    },
    fonts: { hand: '"Sriracha", "Kalam", cursive', title: '"Lilita One", "Kalam", cursive' },
    // gruby marker: stała grubość, smugi, ciemniejszy tusz tam, gdzie końcówka stanęła
    pen: { style: 'marker', width: 1.55, jitter: 0.45 },
    crayon: { w: 18, spacing: 15, alpha: 0.75, grain: 0.15, wave: 0, blend: 'multiply' },
    highlight: { blend: 'multiply', alpha: 0.4 },
    tools: { pencil: 'flipmarker', crayon: 'flipmarker' },
    outline: '#2a2a2a',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = '#d9dade';
      ctx.fillRect(0, 0, w, h);
      // arkusz z bloku: biały, delikatna siatka kropek, cień pod spodem
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(14, 22, w - 28, h - 22);
      ctx.restore();
      ctx.fillStyle = 'rgba(120,140,170,0.22)';
      for (let y = 70; y < h; y += 40) for (let x = 54; x < w - 20; x += 40) ctx.fillRect(x, y, 2, 2);
      // listwa bloku u góry, perforacja
      ctx.fillStyle = '#3a3d44';
      ctx.fillRect(0, 0, w, 24);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(0, 3, w, 4);
      ctx.fillStyle = '#c9cbd0';
      for (let x = 30; x < w; x += 18) ctx.fillRect(x, 30, 8, 2);
      ctx.fillStyle = ctx.createPattern(texture('flip-paper', 256, (c, S, r) => {
        for (let i = 0; i < 900; i++) {
          c.fillStyle = `rgba(80,80,90,${r() * 0.035})`;
          c.fillRect(r() * S, r() * S, 1 + r() * 2, 1);
        }
      }), 'repeat');
      ctx.fillRect(14, 34, w - 28, h - 34);
    },
  },

  // ------------------------------------------------------------ papier pakowy
  kraft: {
    name: 'Papier pakowy',
    palette: {
      // pen = biały żelopis; reszta to kredki, które dobrze wyglądają na brązie
      paper: '#c69c6d', ink: '#1d1712', inkSoft: '#5a4330', pen: '#fbf6ec', penDark: '#efe6d4',
      teal: '#2f6f66', sky: '#3f6f96', ochre: '#f1c25b', coral: '#c4472f', plum: '#5e3d6c', white: '#ffffff',
    },
    fonts: { hand: '"Kalam", "Caveat", cursive', title: '"Caveat Brush", "Kalam", cursive' },
    // cienkopis / żelopis: średnia grubość, lekki nacisk
    pen: { style: 'ink', width: 1.2, jitter: 0.9, pressure: 0.35 },
    // kredka na szorstkim papierze: włókna przebijają przez kolor
    crayon: { w: 9, spacing: 8, alpha: 0.85, grain: 0.7, chalk: true },
    highlight: { blend: 'multiply', alpha: 0.45 },
    tools: { pencil: 'brushpen', crayon: 'pencil' },
    outline: '#1d1712',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // włókna kraftu: krótkie jasne i ciemne kreski w różnych kierunkach + nierówne zabarwienie
      ctx.fillStyle = ctx.createPattern(texture('kraft', 320, (c, S, r) => {
        for (let i = 0; i < 40; i++) {
          const x = r() * S, y = r() * S, rad = 30 + r() * 70;
          for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
            const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
            g.addColorStop(0, 'rgba(90,55,25,0.07)');
            g.addColorStop(1, 'rgba(90,55,25,0)');
            c.fillStyle = g;
            c.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
          }
        }
        c.lineCap = 'round';
        for (let i = 0; i < 1600; i++) {
          const x = r() * S, y = r() * S, a = r() * Math.PI, l = 3 + r() * 9;
          c.strokeStyle = r() > 0.45 ? `rgba(70,40,15,${0.08 + r() * 0.12})` : `rgba(255,235,200,${0.1 + r() * 0.15})`;
          c.lineWidth = 0.6 + r() * 0.8;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
          c.stroke();
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      vignette(ctx, w, h, 0.22);
      // kawałki taśmy w górnych rogach
      ctx.save();
      for (const [x, y, a] of [[70, 28, -0.6], [w - 70, 28, 0.6]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = 'rgba(245,240,225,0.55)';
        ctx.fillRect(-60, -16, 120, 32);
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(-60, 12, 120, 4);
        ctx.restore();
      }
      ctx.restore();
    },
  },

  // ------------------------------------------------------------ szkic ołówkiem
  sketch: {
    name: 'Szkic ołówkiem',
    palette: {
      // grafit w kilku twardościach + stonowane akcenty (jedna kredka na siły i strzałki)
      paper: '#f5f2ea', ink: '#3b3b3d', inkSoft: '#8c8c90', pen: '#262628', penDark: '#1b1b1d',
      teal: '#5f8a83', sky: '#6f8fb0', ochre: '#c7a052', coral: '#c0583f', plum: '#86709c', white: '#ffffff',
    },
    fonts: { hand: '"Caveat", "Kalam", cursive', title: '"Caveat", "Kalam", cursive' },
    // grafit: ziarno papieru w kresce, druga, blada linia obok (szkic)
    pen: { style: 'graphite', width: 0.85, jitter: 1.1, grain: 0.45, pressure: 0.5, sketchy: true },
    // kreskowanie ołówkiem: cienkie, gęste, równoległe linie
    crayon: { color: 'ink', w: 1.8, spacing: 6, alpha: 0.8, grain: 0.5, angle: -0.9 },
    highlight: { blend: 'multiply', alpha: 0.3 },
    tools: {},
    outline: '#3b3b3d',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // ząbek papieru do szkiców
      ctx.fillStyle = ctx.createPattern(texture('sketch-tooth', 200, (c, S, r) => {
        for (let i = 0; i < 4200; i++) {
          c.fillStyle = r() > 0.5 ? `rgba(60,55,45,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.5})`;
          c.fillRect(r() * S, r() * S, 1, 1);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      // spirala szkicownika po lewej
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 60, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 60, h);
      for (let y = 26; y < h; y += 34) {
        // otwór w kartce i zwój drutu przechodzący przez niego za krawędź
        ctx.fillStyle = '#d6d1c4';
        ctx.beginPath();
        ctx.arc(30, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineCap = 'round';
        for (const [col, lw, dy] of [['#55575d', 4, 0], ['rgba(255,255,255,0.55)', 1.2, -1.2]]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(30, y + dy);
          ctx.quadraticCurveTo(16, y - 20 + dy, -2, y - 9 + dy);
          ctx.stroke();
        }
      }
      ctx.restore();
      vignette(ctx, w, h, 0.1);
    },
  },

  // ------------------------------------------------------------ stara mapa / pergamin
  parchment: {
    name: 'Stara mapa (pergamin)',
    palette: {
      // atrament galasowy, czerwony atrament, akwarelowe podkolorowanie map
      paper: '#ead8ad', ink: '#3a2614', inkSoft: '#7a5a38', pen: '#7c1d12', penDark: '#5e140c',
      teal: '#4d7a63', sky: '#4e7396', ochre: '#c4912f', coral: '#a8402a', plum: '#5b3d63', white: '#fbf3df',
    },
    fonts: { hand: '"MedievalSharp", "Kalam", cursive', title: '"Grenze Gotisch", "Kalam", cursive' },
    writeScale: 1.15,
    // pióro gęsie: lekki nacisk, kreska blednie, gdy kończy się atrament
    pen: { style: 'ink', width: 0.9, jitter: 1, pressure: 0.5, inkFade: 0.45, inkReach: 480 },
    crayon: { wash: true, w: 30, spacing: 22, alpha: 0.75, grain: 0.45 },
    highlight: { blend: 'multiply', alpha: 0.35 },
    tools: { pencil: 'quill', crayon: 'brush' },
    outline: '#3a2614',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // plamy, przebarwienia i włókna starego papieru
      ctx.fillStyle = ctx.createPattern(texture('parchment', 480, (c, S, r) => {
        for (let i = 0; i < 26; i++) {
          // miękkie przebarwienia (bez obwódek), zawinięte na brzegach kafla
          const x = r() * S, y = r() * S, rad = 60 + r() * 140, a = 0.025 + r() * 0.04;
          for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
            const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
            g.addColorStop(0, `rgba(120,80,30,${a})`);
            g.addColorStop(1, 'rgba(120,80,30,0)');
            c.fillStyle = g;
            c.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
          }
        }
        for (let i = 0; i < 2600; i++) {
          c.fillStyle = r() > 0.5 ? `rgba(90,60,25,${r() * 0.07})` : `rgba(255,248,225,${r() * 0.3})`;
          c.fillRect(r() * S, r() * S, 1 + r() * 3, 1);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      // przypalone, ciemniejsze brzegi i ślady złożenia
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58);
      g.addColorStop(0, 'rgba(80,45,15,0)');
      g.addColorStop(1, 'rgba(80,45,15,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90,60,25,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2 + 4, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2 - 3);
      ctx.stroke();
    },
  },

  // ------------------------------------------------------------ drzeworyt
  woodcut: {
    name: 'Drzeworyt',
    palette: {
      // druk dwukolorowy: czerń i czerwień na kremowym papierze czerpanym
      paper: '#f1e6cf', ink: '#17120e', inkSoft: '#5b4b3c', pen: '#b3261e', penDark: '#8a1c16',
      teal: '#2f5d55', sky: '#3c5a7a', ochre: '#c9902c', coral: '#b3261e', plum: '#4b2f45', white: '#fbf6ea',
    },
    fonts: { hand: '"Special Elite", "Kalam", monospace', title: '"Alfa Slab One", "Kalam", serif' },
    writeScale: 1.5,
    // dłuto: gruba, pewna kreska, mało drżenia, krótkie zwężenia
    pen: { style: 'ink', width: 1.7, jitter: 0.35, pressure: 0.25, taper: 0.5 },
    // kolor = równoległe nacięcia (kreskowanie jak w klocku), bez fali
    crayon: { w: 3.4, spacing: 9, alpha: 0.95, grain: 0.3, wave: 0, angle: 0.25 },
    highlight: { blend: 'multiply', alpha: 0.4 },
    tools: { pencil: 'gouge', crayon: 'gouge' },
    outline: '#17120e',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // papier czerpany i lekki ślad słojów klocka
      ctx.fillStyle = ctx.createPattern(texture('woodcut', 360, (c, S, r) => {
        for (let y = 0; y < S; y += 3) {
          c.strokeStyle = `rgba(90,60,30,${0.012 + r() * 0.02})`;
          c.lineWidth = 1;
          c.beginPath();
          for (let x = 0; x <= S; x += 12) c.lineTo(x, y + Math.sin((x + y * 3) * 0.02) * 2.5);
          c.stroke();
        }
        for (let i = 0; i < 1800; i++) {
          c.fillStyle = `rgba(80,55,30,${r() * 0.06})`;
          c.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r());
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      // odbita ramka klocka
      ctx.save();
      ctx.strokeStyle = 'rgba(23,18,14,0.88)';
      ctx.lineWidth = 7;
      ctx.strokeRect(22, 22, w - 44, h - 44);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(34, 34, w - 68, h - 68);
      ctx.restore();
    },
  },

  // ------------------------------------------------------------ kosmos
  cosmos: {
    name: 'Kosmos',
    palette: {
      paper: '#070b1a', ink: '#eef1ff', inkSoft: '#9aa3c8', pen: '#ffd76a', penDark: '#e8b94a',
      teal: '#5ff0d2', sky: '#6cb8ff', ochre: '#ffb347', coral: '#ff7a8a', plum: '#b28dff', white: '#ffffff',
    },
    fonts: { hand: '"Comfortaa", "Kalam", sans-serif', title: '"Exo 2", "Kalam", sans-serif' },
    // pastelowa, łagodnie świecąca kreska
    pen: { style: 'neon', width: 0.95, jitter: 0.6, glow: 0.7 },
    // mgławice: miękkie plamy, które dodają światła
    crayon: { wash: true, soft: true, blend: 'screen', w: 34, spacing: 24, alpha: 0.85, grain: 0.15 },
    highlight: { blend: 'lighter', alpha: 0.3 },
    text: { glow: true },
    tools: { pencil: 'neon', crayon: 'neon' },
    outline: 'rgba(0,0,0,0.8)',
    background(sk, w, h) {
      const { ctx } = sk;
      const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 20, w * 0.5, h * 0.55, Math.hypot(w, h) * 0.6);
      g.addColorStop(0, '#141a3a');
      g.addColorStop(1, sk.col('paper'));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // pył międzygwiezdny: kilka słabych kolorowych obłoków
      const r = rng(17);
      for (const [x, y, rad, col] of [[0.2, 0.3, 0.35, '120,80,200'], [0.85, 0.7, 0.3, '40,140,200'], [0.6, 0.15, 0.25, '200,90,150']]) {
        const n = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, w * rad);
        n.addColorStop(0, `rgba(${col},0.12)`);
        n.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = n;
        ctx.fillRect(0, 0, w, h);
      }
      // gwiazdy: drobne na wzorze + kilka jasnych z poświatą
      ctx.fillStyle = ctx.createPattern(texture('stars', 400, (c, S, rr) => {
        for (let i = 0; i < 420; i++) {
          c.fillStyle = `rgba(255,255,255,${0.15 + rr() * 0.6})`;
          const s = rr() < 0.9 ? 1 : 1.8;
          c.fillRect(rr() * S, rr() * S, s, s);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const x = r() * w, y = r() * h, rad = 2 + r() * 4;
        const s = ctx.createRadialGradient(x, y, 0, x, y, rad * 4);
        s.addColorStop(0, 'rgba(255,255,255,0.9)');
        s.addColorStop(0.25, 'rgba(200,220,255,0.25)');
        s.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = s;
        ctx.fillRect(x - rad * 4, y - rad * 4, rad * 8, rad * 8);
      }
      ctx.restore();
    },
  },

  // ------------------------------------------------------------ terminal CRT
  terminal: {
    name: 'Terminal CRT',
    palette: {
      // zielony fosfor; bursztyn i czerwień tylko na alarmy
      paper: '#03110a', ink: '#7dff9b', inkSoft: '#3a9e58', pen: '#d2ffdc', penDark: '#9de6ae',
      teal: '#5dffc8', sky: '#7dff9b', ochre: '#ffc94a', coral: '#ff6a55', plum: '#9dff7d', white: '#eaffef',
    },
    fonts: { hand: '"VT323", monospace', title: '"VT323", monospace' },
    // wektorowy monitor: cienka, świecąca, równa kreska
    pen: { style: 'neon', width: 0.8, jitter: 0.25, glow: 0.8 },
    // wypełnienie świecącymi kreskami (krótkie pociągnięcia w poprzek kształtu)
    crayon: { w: 4, spacing: 8, wave: 0, alpha: 0.55, grain: 0, blend: 'lighter' },
    highlight: { blend: 'lighter', alpha: 0.3 },
    text: { glow: true },
    tools: { pencil: 'lightpen', crayon: 'lightpen' },
    outline: '#0a0a0a',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      // kineskop: zaokrąglony ekran z poświatą fosforu
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(18, 18, w - 36, h - 36, 46);
      else ctx.rect(18, 18, w - 36, h - 36);
      ctx.clip();
      const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      g.addColorStop(0, '#0b2a17');
      g.addColorStop(1, sk.col('paper'));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // linie ekranu
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      vignette(ctx, w, h, 0.6);
      ctx.restore();
      // ramka obudowy
      ctx.strokeStyle = '#1d2a22';
      ctx.lineWidth = 14;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(11, 11, w - 22, h - 22, 52);
      else ctx.rect(11, 11, w - 22, h - 22);
      ctx.stroke();
    },
  },

  // ------------------------------------------------------------ plakat konstruktywistyczny
  poster: {
    name: 'Plakat',
    palette: {
      // druk: czerwień, czerń i krem + przygaszony granat i ochra
      paper: '#eee1c4', ink: '#151414', inkSoft: '#4a4642', pen: '#cf2a1d', penDark: '#a51f15',
      teal: '#2a4656', sky: '#3c6687', ochre: '#d89b2a', coral: '#cf2a1d', plum: '#3a2c3f', white: '#f8f1e2',
    },
    fonts: { hand: '"Oswald", "Kalam", sans-serif', title: '"Bebas Neue", "Oswald", sans-serif' },
    writeScale: 1.4,
    // czysta, mocna kreska, prawie bez drżenia
    pen: { style: 'ink', width: 1.45, jitter: 0.25, pressure: 0.1, taper: 0.3 },
    // płaska, kryjąca farba drukarska z lekkim ziarnem
    crayon: { w: 28, spacing: 16, alpha: 0.97, grain: 0.3, wave: 0 },
    highlight: { blend: 'multiply', alpha: 0.45 },
    tools: { pencil: 'brushpen', crayon: 'brush' },
    outline: '#151414',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // stary druk: ziarno, przetarcia i ślady złożenia plakatu
      ctx.fillStyle = ctx.createPattern(texture('poster', 300, (c, S, r) => {
        for (let i = 0; i < 2600; i++) {
          c.fillStyle = r() > 0.6 ? `rgba(255,250,235,${r() * 0.35})` : `rgba(60,40,20,${r() * 0.06})`;
          c.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(60,40,20,0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 3, 0);
      ctx.lineTo(w / 3 - 3, h);
      ctx.moveTo((2 * w) / 3, 0);
      ctx.lineTo((2 * w) / 3 + 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2 + 3);
      ctx.stroke();
      vignette(ctx, w, h, 0.18);
    },
  },

  // ------------------------------------------------------------ tablica korkowa (śledztwo)
  corkboard: {
    name: 'Tablica korkowa',
    palette: {
      // korek, czarny marker, czerwona nitka; karteczki: żółta, różowa, niebieska, zielona, biała
      paper: '#b98858', ink: '#1d1b19', inkSoft: '#4c4038', pen: '#c62828', penDark: '#9a1d1d',
      teal: '#a6e3a1', sky: '#9fd3ff', ochre: '#ffe066', coral: '#ff9eb5', plum: '#cdb4f6', white: '#fbfaf3',
    },
    fonts: { hand: '"Kalam", "Caveat", cursive', title: '"Special Elite", "Kalam", monospace' },
    writeScale: 1.25,
    pen: { style: 'ink', width: 1.05, jitter: 0.6, pressure: 0.3 },
    // karteczka: kryjący, płaski kolor papieru
    crayon: { w: 30, spacing: 18, alpha: 1, grain: 0.12, wave: 0 },
    highlight: { blend: 'multiply', alpha: 0.4 },
    tools: { pencil: 'flipmarker', crayon: 'flipmarker' },
    outline: '#2a2a2a',
    background(sk, w, h) {
      const { ctx } = sk;
      ctx.fillStyle = sk.col('paper');
      ctx.fillRect(0, 0, w, h);
      // korek: ziarna jaśniejsze i ciemniejsze, nieregularne
      ctx.fillStyle = ctx.createPattern(texture('cork', 220, (c, S, r) => {
        for (let i = 0; i < 2600; i++) {
          const dark = r() > 0.45;
          c.fillStyle = dark ? `rgba(90,55,25,${0.1 + r() * 0.25})` : `rgba(235,195,140,${0.1 + r() * 0.3})`;
          c.beginPath();
          c.ellipse(r() * S, r() * S, 0.6 + r() * 2.2, 0.6 + r() * 1.6, r() * 3, 0, Math.PI * 2);
          c.fill();
        }
      }), 'repeat');
      ctx.fillRect(0, 0, w, h);
      vignette(ctx, w, h, 0.25);
      // drewniana rama
      ctx.save();
      ctx.strokeStyle = '#6e4a2a';
      ctx.lineWidth = 22;
      ctx.strokeRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.strokeRect(11, 11, w - 22, h - 22);
      ctx.restore();
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

