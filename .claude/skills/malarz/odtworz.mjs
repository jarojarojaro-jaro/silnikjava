#!/usr/bin/env node
// odtworz.mjs — odtwarza obraz z pliku pociągnięć do PNG, w dowolnej skali i w dowolnym momencie.
//
//   node odtworz.mjs out/malarz/perla/obraz.json                  # obok: obraz@2x.png
//   node odtworz.mjs obraz.json --skala 4 --okno 0.3,0.25,0.3,0.3 # wycinek (ułamki obrazu) w skali 4
//   node odtworz.mjs obraz.json --ile 1500 --out etap.png         # pierwsze 1500 pociągnięć
//   node odtworz.mjs obraz.json --swiatlo 0                       # czysty kolor, bez światła na fakturze
//
// Skala nie dodaje szczegółów wzoru — pokazuje pociągnięcia z bliska (obraz nie jest siatką pikseli).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { zTekstu } from './lib/plik.js';
import { renderuj } from './lib/render.js';
import { zapiszPNG, wytnij } from './lib/grafika.js';
import { zWiersza } from './lib/argumenty.js';

const { plik, opt } = zWiersza();
if (!plik) { console.log('użycie: node odtworz.mjs <obraz.json> [--skala 2] [--ile n] [--okno x,y,w,h] [--swiatlo 0..2] [--out plik.png]'); process.exit(1); }
const { naglowek: n, bajty } = zTekstu(readFileSync(plik, 'utf8'));
const S = Number(opt('skala', 2)), sw = opt('swiatlo');
const swiatlo = sw === undefined ? true : Number(sw) === 0 ? false : { ...n.swiatlo, sila: Number(sw) };
const t0 = Date.now();
let r = renderuj(n, bajty, S, { ile: opt('ile') ? Number(opt('ile')) : undefined, swiatlo }), kan = 4;
if (opt('okno')) {
  const [x, y, w, h] = opt('okno').split(',').map(Number);      // okno przycięte do obrazu
  const x0 = Math.max(0, Math.min(r.w - 1, Math.round(x * r.w))), y0 = Math.max(0, Math.min(r.h - 1, Math.round(y * r.h)));
  r = wytnij(r.px, r.w, 4, x0, y0, Math.max(1, Math.min(r.w - x0, Math.round(w * r.w))), Math.max(1, Math.min(r.h - y0, Math.round(h * r.h)))); kan = 3;
}
const out = opt('out', join(dirname(plik), `obraz@${S}x.png`));
zapiszPNG(out, r.px, r.w, r.h, kan);
console.log(`${n.tytul}: ${opt('ile') ?? n.ile} pociągnięć w skali ${S} → ${out} (${r.w}×${r.h}, ${Date.now() - t0} ms)`);
