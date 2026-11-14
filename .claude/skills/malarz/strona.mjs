#!/usr/bin/env node
// strona.mjs — pakuje pracownię i jeden obraz do pojedynczego pliku HTML, który maluje go na żywo
// (bez sieci, bez grafik: sam kod i lista pociągnięć). Spacja = pauza, R = od nowa, klik = pauza.
//
//   node strona.mjs out/malarz/jezioro/obraz.json            # obok: obraz.html
//   node strona.mjs obraz.json --out pokaz.html

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TU = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), plik = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
if (!plik) { console.log('użycie: node strona.mjs <obraz.json> [--out plik.html]'); process.exit(1); }
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(dirname(plik), 'obraz.html');

/** Moduł ES → wyrażenie zwracające jego eksporty (importy stają się odwołaniami do wcześniejszych modułów). */
function modul(sciezka) {
  const nazwy = [];
  const kod = readFileSync(join(TU, sciezka), 'utf8').split('\n').map((l) => {
    const imp = /^import \{([^}]+)\} from '.*\/(\w+)\.js';$/.exec(l);
    if (imp) return `const {${imp[1]}} = M.${imp[2]};`;
    const wiele = /^export const ((?:\w+ = [\w.-]+, )+\w+ = [\w.-]+);$/.exec(l);
    if (wiele) { for (const m of wiele[1].matchAll(/(\w+) =/g)) nazwy.push(m[1]); return l.slice(7); }
    const jeden = /^export (?:async )?(?:const|function|let) (\w+)/.exec(l);
    if (jeden) { nazwy.push(jeden[1]); return l.slice(7); }
    if (l.startsWith('import ') || l.startsWith('export ')) throw new Error(`${sciezka}: nieobsługiwana linia: ${l}`);
    return l;
  }).join('\n');
  return `M.${basename(sciezka, '.js')} = (() => {\n${kod}\nreturn { ${nazwy.join(', ')} };\n})();`;
}
const kod = ['lib/pedzel.js', 'lib/plik.js', 'pracownia/narzedzie.js', 'pracownia/pracownia.js'].map(modul).join('\n');
const obraz = readFileSync(plik, 'utf8'), tytul = JSON.parse(obraz).tytul;
const html = readFileSync(join(TU, 'pracownia/pracownia.html'), 'utf8')
  .replace('<title>Pracownia malarza</title>', () => `<title>${tytul.replace(/[<&]/g, '')}</title>`)
  .replace('<script type="module" src="./pracownia.js"></script>', () => `<script>window.OBRAZ = ${JSON.stringify(obraz).replace(/</g, '\\u003c')};</script>\n<script type="module">\nconst M = {};\n${kod.replace(/<\/script/g, '<\\/script')}\n</script>`);
writeFileSync(out, html);
console.log(`${tytul}: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
