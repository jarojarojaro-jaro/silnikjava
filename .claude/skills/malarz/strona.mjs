#!/usr/bin/env node
// strona.mjs — pakuje pracownię i jeden obraz do pojedynczego pliku HTML, który maluje go na żywo
// (bez sieci, bez grafik: sam kod i lista pociągnięć). Spacja = pauza, R = od nowa, klik = pauza.
//
//   node strona.mjs out/malarz/jezioro/obraz.json            # obok: obraz.html
//   node strona.mjs obraz.json --out pokaz.html
//   node strona.mjs --sam                                    # szkicownik: strona, na której maluje się samemu (out/malarz/szkicownik.html)
//   node strona.mjs --sam --artefakt                         # to samo bez szkieletu <html> (do opublikowania jako artefakt)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zWiersza } from './lib/argumenty.js';

const TU = dirname(fileURLToPath(import.meta.url));
const { plik, opt } = zWiersza(['sam', 'artefakt']);
if (!plik && !opt('sam')) { console.log('użycie: node strona.mjs <obraz.json> [--out plik.html]   |   node strona.mjs --sam [--artefakt] [--out plik.html]'); process.exit(1); }
const out = opt('out', opt('sam') ? join('out', 'malarz', 'szkicownik.html') : join(dirname(plik), 'obraz.html'));

/** Moduł ES → wyrażenie zwracające jego eksporty (importy stają się odwołaniami do wcześniejszych modułów). */
function modul(sciezka) {
  const nazwy = [];
  const kod = readFileSync(join(TU, sciezka), 'utf8').split('\n').map((l) => {
    const imp = /^import \{([^}]+)\} from '.*\/(\w+)\.js';$/.exec(l);
    if (imp) return `const {${imp[1].replace(/ as /g, ': ')}} = M.${imp[2]};`;      // „a as b” → „a: b”
    const wiele = /^export const ((?:\w+ = [\w.-]+, )+\w+ = [\w.-]+);$/.exec(l);
    if (wiele) { for (const m of wiele[1].matchAll(/(\w+) =/g)) nazwy.push(m[1]); return l.slice(7); }
    const jeden = /^export (?:async )?(?:const|function|let) (\w+)/.exec(l);
    if (jeden) { nazwy.push(jeden[1]); return l.slice(7); }
    if (l.startsWith('import ') || l.startsWith('export ')) throw new Error(`${sciezka}: nieobsługiwana linia: ${l}`);
    return l;
  }).join('\n');
  return `M.${basename(sciezka, '.js')} = (() => {\n${kod}\nreturn { ${nazwy.join(', ')} };\n})();`;
}
const zloz = (moduly) => `<script type="module">\nconst M = {};\n${moduly.map(modul).join('\n').replace(/<\/script/g, '<\\/script')}\n</script>`;
if (opt('sam')) {
  // szkicownik: silnik papieru + strona do rysowania w jednym pliku
  const skrypt = zloz(['lib/pedzel.js', 'lib/szkic.js', 'lib/pole.js', 'lib/suche.js', 'lib/rysunek.js', 'lib/plik.js', 'lib/style.js', 'pracownia/sam.js']);
  const zrodlo = readFileSync(join(TU, 'pracownia/sam.html'), 'utf8'), miedzy = (a, b) => zrodlo.slice(zrodlo.indexOf(a) + a.length, zrodlo.indexOf(b));
  const html = opt('artefakt')
    ? `${miedzy('<!-- glowa -->', '<!-- /glowa -->').trim()}\n${miedzy('<!-- tresc -->', '<!-- /tresc -->').trim()}\n${skrypt}\n`
    : zrodlo.replace('<script type="module" src="./sam.js"></script>', () => skrypt);
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, html);
  console.log(`Szkicownik malarza: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
  process.exit(0);
}
const obraz = readFileSync(plik, 'utf8'), tytul = JSON.parse(obraz).tytul;
const html = readFileSync(join(TU, 'pracownia/pracownia.html'), 'utf8')
  .replace('<title>Pracownia malarza</title>', () => `<title>${tytul.replace(/[<&]/g, '')}</title>`)
  .replace('<script type="module" src="./pracownia.js"></script>', () => `<script>window.OBRAZ = ${JSON.stringify(obraz).replace(/</g, '\\u003c')};</script>\n${zloz(['lib/pedzel.js', 'lib/szkic.js', 'lib/pole.js', 'lib/suche.js', 'lib/rysunek.js', 'lib/plik.js', 'pracownia/narzedzie.js', 'pracownia/pracownia.js'])}`);
writeFileSync(out, html);
console.log(`${tytul}: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
