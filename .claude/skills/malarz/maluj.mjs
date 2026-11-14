#!/usr/bin/env node
// maluj.mjs — maluje albo rysuje obraz: wzór (zdjęcie albo motyw z kodu) → lista pociągnięć pędzla albo kresek.
//
//   node maluj.mjs zdjecie.jpg                         # styl „olej”, wynik w out/malarz/zdjecie/
//   node maluj.mjs zdjecie.jpg --styl kopia            # wierna kopia (62 tys. pociągnięć)
//   node maluj.mjs zdjecie.jpg --styl impresja --tytul "Zatoka o świcie"
//   node maluj.mjs motywy/jezioro.js --styl olej       # motyw z wyobraźni (wzór rysuje kod)
//   node maluj.mjs zdjecie.jpg --styl pastele          # praca na papierze (też: kredki, olejne, mieszane, akwarela, wegiel, olowek, szkic, tusz)
//   node maluj.mjs portret.jpg --skup 0.48,0.30,0.14,0.16,4   # twarz: środek x,y i promienie (ułamki), waga
//
// Opcje: --styl, --nazwa, --tytul, --autor, --szczegol 1 (mnożnik liczby pociągnięć), --skup (wiele razy),
//        --detal 2 (waga drobnego rysunku), --grunt r,g,b | auto, --ziarno 1503, --skala 2 (PNG), --kadr x,y,w,h, --out katalog
// Style suche: zamiast --grunt jest --papier r,g,b; --skup i --detal ich nie dotyczą (rysownik sam idzie za rysunkiem wzoru).
// Wynik: obraz.json (pociągnięcia), obraz.png (ze światłem na fakturze), porownanie.png, etapy.png.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Malarz } from './lib/malarz.js';
import { STYLE, rozmiarRoboczy } from './lib/style.js';
import { szarosc, waznosc, rozmyj } from './lib/pole.js';
import { rozmiar, wczytaj, zapiszPNG, obok } from './lib/grafika.js';
import { doTekstu } from './lib/plik.js';
import { renderuj } from './lib/render.js';
import { RODZAJE } from './lib/pedzel.js';
import { STYLE_SUCHE, rysuj } from './lib/rysownik.js';
import { zWiersza } from './lib/argumenty.js';

const { plik: wzor, opt, wiele } = zWiersza();
if (!wzor) { console.log(`użycie: node maluj.mjs <wzor.jpg | motyw.js> [--styl ${[...Object.keys(STYLE), ...Object.keys(STYLE_SUCHE)].join('|')}] [--tytul …] [--autor …] [--skup x,y,rx,ry,waga] [--papier r,g,b]`); process.exit(1); }

const stylNazwa = opt('styl', 'olej'), suchy = STYLE_SUCHE[stylNazwa], styl = STYLE[stylNazwa] ?? suchy;
if (!styl) { console.error(`nieznany styl ${stylNazwa}; dostępne: ${[...Object.keys(STYLE), ...Object.keys(STYLE_SUCHE)].join(', ')}`); process.exit(1); }
const nazwa = opt('nazwa', basename(wzor, extname(wzor)));
const out = resolve(opt('out', join('out', 'malarz', nazwa)));
mkdirSync(out, { recursive: true });
const t0 = Date.now();

// ---- wzór: plik graficzny albo motyw (moduł z funkcją wzor(W, H) → Float32Array RGB) ----------
let W, H, cel, motyw = null;
if (wzor.endsWith('.js') || wzor.endsWith('.mjs')) {
  motyw = await import(pathToFileURL(resolve(wzor)).href);
  ({ W, H } = rozmiarRoboczy(motyw.PROPORCJA ?? 2 / 3));
  cel = motyw.wzor(W, H);
} else {
  const kadr = opt('kadr') ? (([x, y, w, h]) => ({ x, y, w, h }))(opt('kadr').split(',').map(Number)) : null;
  const r = kadr ?? rozmiar(wzor);
  ({ W, H } = rozmiarRoboczy(r.w / r.h));
  cel = wczytaj(wzor, W, H, kadr);
}
const N = W * H;
zapiszPNG(join(out, 'wzor.png'), cel, W, H);            // na co malarz patrzy (zostaje w out/, nie w pliku obrazu)
if (styl.wygladz && !motyw) {                       // malarz patrzy na formę, nie na szum zdjęcia
  for (let c = 0; c < 3; c++) {
    const k = new Float32Array(N); for (let i = 0; i < N; i++) k[i] = cel[i * 3 + c];
    const r = rozmyj(k, W, H, styl.wygladz); for (let i = 0; i < N; i++) cel[i * 3 + c] = r[i];
  }
}
const szczegol = Number(opt('szczegol', 1));
const wz = new Uint8ClampedArray(N * 3); for (let i = 0; i < N * 3; i++) wz[i] = cel[i];
// ---- praca na papierze (kredki, pastele, węgiel, ołówek, tusz, akwarela, technika mieszana) ---
if (suchy) {
  console.log(`${nazwa}: ${W}×${H}, styl ${stylNazwa} (${suchy.opis})`);
  const r = rysuj({ W, H, cel, styl: stylNazwa, tytul: opt('tytul', motyw?.TYTUL ?? nazwa), autor: opt('autor', motyw?.AUTOR ?? ''), ziarno: Number(opt('ziarno', 2024)), szczegol, papier: opt('papier') ? { kolor: opt('papier').split(',').map(Number) } : undefined, log: console.log });
  const { naglowek, bajty } = r.obraz();
  writeFileSync(join(out, 'obraz.json'), doTekstu(naglowek, bajty));
  const S = Number(opt('skala', 2)), fin = renderuj(naglowek, bajty, S);
  zapiszPNG(join(out, 'obraz.png'), fin.px, fin.w, fin.h, 4);
  const por = obok([{ px: wz, w: W, h: H }, { px: r.kartka.piksele(), w: W, h: H, kanaly: 4 }]);
  zapiszPNG(join(out, 'porownanie.png'), por.px, por.w, por.h);
  const et = obok(naglowek.etapy.map((e) => { const k = renderuj(naglowek, bajty, 0.5, { ile: e.koniec }); return { px: k.px, w: k.w, h: k.h, kanaly: 4 }; }), 8);
  zapiszPNG(join(out, 'etapy.png'), et.px, et.w, et.h);
  console.log(`gotowe: ${naglowek.ile} kresek (${(bajty.length / 1024).toFixed(0)} KB), ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
  process.exit(0);
}
const gray = szarosc(cel, N);
const skupienia = [...(motyw?.SKUPIENIA ?? []), ...wiele('skup').map((s) => { const [x, y, rx, ry, ile] = s.split(',').map(Number); return { x, y, rx, ry, ile: ile ?? 3 }; })];
const wagi = waznosc(gray, W, H, Number(opt('detal', 2)), skupienia);

let grunt = [222, 212, 190];                       // ciepły gesso
const g = opt('grunt', motyw?.GRUNT);
if (g === 'auto') {                                // imprimatura: przygaszony, średni ton wzoru
  const m = [0, 0, 0]; for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) m[c] += cel[i * 3 + c] / N;
  const sz = 0.3 * m[0] + 0.59 * m[1] + 0.11 * m[2];
  grunt = m.map((v) => Math.round(150 + (v - sz) * 0.55 + (sz - 128) * 0.25));
} else if (Array.isArray(g)) grunt = g;
else if (g) grunt = g.split(',').map(Number);

// ---- malowanie ------------------------------------------------------------------------------
const m = Malarz({ W, H, cel, wagi, grunt, ziarno: Number(opt('ziarno', 1503)), cechy: styl.cechy, kolor: styl.kolor });
console.log(`${nazwa}: ${W}×${H}, styl ${stylNazwa} (${styl.opis}), grunt ${grunt}`);
const etapy = [];
for (const e of styl.etapy) {
  const t = Date.now(), r = m.etap({ ...e, n: Math.round(e.n * szczegol) });
  etapy.push({ nazwa: e.nazwa, nr: e.nr, pedzel: e.pedzel, koniec: m.ile });
  console.log(`  ${e.nazwa.padEnd(12)} nr ${e.nr.padEnd(3)} ${RODZAJE[e.pedzel].padEnd(10)} ${String(e.w[0]).padStart(4)}–${String(e.w[1]).padEnd(4)} +${String(r.zrobione).padStart(5)}  razem ${String(m.ile).padStart(5)}  rmse ${m.rmse().toFixed(2)}  ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
const bajty = m.bajty();
const naglowek = { W, H, grunt, tytul: opt('tytul', motyw?.TYTUL ?? nazwa), autor: opt('autor', motyw?.AUTOR ?? ''), styl: stylNazwa, cechy: styl.cechy, swiatlo: styl.swiatlo, etapy, rmse: Number(m.rmse().toFixed(2)) };
writeFileSync(join(out, 'obraz.json'), doTekstu(naglowek, bajty));

// ---- podglądy --------------------------------------------------------------------------------
const S = Number(opt('skala', 2));
const fin = renderuj(naglowek, bajty, S);
zapiszPNG(join(out, 'obraz.png'), fin.px, fin.w, fin.h, 4);
const plaski = renderuj(naglowek, bajty, 1, { swiatlo: false });
const jeden = renderuj(naglowek, bajty, 1);
const por = obok([{ px: wz, w: W, h: H }, { px: plaski.px, w: W, h: H, kanaly: 4 }, { px: jeden.px, w: W, h: H, kanaly: 4 }]);
zapiszPNG(join(out, 'porownanie.png'), por.px, por.w, por.h);
const kl = etapy.map((e) => { const r = renderuj(naglowek, bajty, 0.5, { ile: e.koniec }); return { px: r.px, w: r.w, h: r.h, kanaly: 4 }; });
const et = obok(kl, 8);
zapiszPNG(join(out, 'etapy.png'), et.px, et.w, et.h);
console.log(`gotowe: ${m.ile} pociągnięć (${(bajty.length / 1024).toFixed(0)} KB), rmse ${m.rmse().toFixed(2)}, ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
