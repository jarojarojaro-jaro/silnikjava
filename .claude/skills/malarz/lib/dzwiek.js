// dzwiek.js — ścieżka dźwiękowa filmu z pracowni: szelest narzędzia na papierze albo płótnie.
// Bez próbek i bez zależności: szum przepuszczony przez trzy pasma, a głośność każdej chwili bierze
// się z ruchu narzędzia (pracownia podaje, jak szybko idzie czubek, jak mocno dociska i czym rysuje).
// Ołówek i kredka skrzypią wysoko i ziarniście, węgiel i pastel szorują niżej, pędzel szumi miękko.
// Ta sama lista ruchów daje zawsze ten sam dźwięk (szum z ziarna).

import { Los } from './pole.js';

/** Klasy narzędzi: [pasmo niskie, średnie, wysokie, ziarnistość, głośność]. */
export const BRZMIENIA = [
  [0.80, 0.45, 0.05, 0.15, 0.80],     // 0 pędzel olejny: miękki szum włosia
  [0.05, 0.45, 0.90, 0.65, 0.70],     // 1 ołówek, kredka, piórko: wysoko i ziarniście
  [0.35, 0.90, 0.35, 0.80, 1.00],     // 2 węgiel, pastel: szorstko, niżej
  [0.70, 0.20, 0.02, 0.05, 0.45],     // 3 akwarela: ledwie słyszalny mokry pędzel
  [0.90, 0.15, 0.00, 0.10, 0.35],     // 4 palec: głuche rozcieranie
];

// filtr pasmowy drugiego rzędu (wzory RBJ), w miejscu
function pasmo(x, sr, f0, Q) {
  const w = 2 * Math.PI * f0 / sr, al = Math.sin(w) / (2 * Q), a0 = 1 + al, b0 = al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * (x[i] - x2) - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}

/**
 * Próbki dźwięku (mono, −1..1) z ruchu narzędzia.
 * @param {number[]|Float32Array} ruch co 1/hz s cztery liczby: prędkość czubka (jedn./s), nacisk 0..1, szerokość śladu, klasa narzędzia
 * @param {number} hz ile razy na sekundę podany jest ruch
 * @param {{sr?:number, ziarno?:number, glosnosc?:number}} [o] sr — próbkowanie; glosnosc — poziom szczytów 0..1
 */
export function szelest(ruch, hz, o = {}) {
  const sr = o.sr ?? 44100, n = Math.floor(ruch.length / 4), N = Math.round(n / hz * sr), rnd = Los(o.ziarno ?? 77);
  const bialy = new Float32Array(N); for (let i = 0; i < N; i++) bialy[i] = rnd() * 2 - 1;
  const P = [pasmo(bialy, sr, 520, 0.7), pasmo(bialy, sr, 1900, 0.8), pasmo(bialy, sr, 4600, 0.9)];
  const ziarno = pasmo(bialy, sr, 90, 0.5);                    // wolne falowanie: grudki papieru pod czubkiem
  const out = new Float32Array(N), ob = [0, 0, 0]; let zi = 0;
  const kAtak = 1 - Math.exp(-1 / (0.004 * sr)), kZan = 1 - Math.exp(-1 / (0.035 * sr));
  for (let i = 0; i < N; i++) {
    const t = i / sr * hz, k = Math.min(n - 1, t | 0), k2 = Math.min(n - 1, k + 1), f = t - k;
    const v = ruch[k * 4] + (ruch[k2 * 4] - ruch[k * 4]) * f, nac = ruch[k * 4 + 1] + (ruch[k2 * 4 + 1] - ruch[k * 4 + 1]) * f;
    const B = BRZMIENIA[ruch[k * 4 + 3] | 0] ?? BRZMIENIA[0], szer = ruch[k * 4 + 2];
    // głośniej, gdy narzędzie idzie szybciej, dociska mocniej i jest szersze; uniesione milczy
    const a = Math.min(1, Math.sqrt(v / 500)) * nac * B[4] * (0.7 + 0.3 * Math.min(1, szer / 12));
    let s = 0;
    for (let b = 0; b < 3; b++) { const cel = a * B[b]; ob[b] += (cel - ob[b]) * (cel > ob[b] ? kAtak : kZan); s += P[b][i] * ob[b]; }
    zi += (B[3] - zi) * kZan;
    out[i] = s * (1 - zi + zi * Math.min(2, Math.abs(ziarno[i]) * 9));
  }
  let szczyt = 0; for (let i = 0; i < N; i++) if (Math.abs(out[i]) > szczyt) szczyt = Math.abs(out[i]);
  if (szczyt > 0) { const g = (o.glosnosc ?? 0.5) / szczyt; for (let i = 0; i < N; i++) out[i] *= g; }
  return out;
}

/** Plik WAV (16 bitów, mono) z próbek −1..1. */
export function wav(probki, sr = 44100) {
  const b = Buffer.alloc(44 + probki.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + probki.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(probki.length * 2, 40);
  for (let i = 0; i < probki.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, probki[i])) * 32767), 44 + i * 2);
  return b;
}
