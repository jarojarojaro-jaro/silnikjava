#!/usr/bin/env node
// Kontrola "fizyki" scen w prawdziwej przeglądarce (z prawdziwymi czcionkami):
// czy każdy element rysuje ręka, czy ręka zdąży dojechać, czy nic nie jest
// rysowane równolegle. Kod wyjścia 1, gdy są problemy (do CI / pętli poprawek).
//
//   node tools/lint.mjs examples/scenes/explainer.js:buildExplainer [inne...]
//   node tools/lint.mjs            # wszystkie dema

import { parseArgs, openPlayer } from './lib/page.mjs';

const { opt } = parseArgs(process.argv);
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const list = targets.length
  ? targets
  : ['examples/scenes/explainer.js:buildExplainer', 'examples/scenes/hero.js:buildHero', 'examples/scenes/diagram.js:buildScrollDiagram'];

// strona-gospodarz: ładuje czcionki i Player (Sketch z prawdziwym canvasem)
const { tab, close } = await openPlayer(opt('host', 'examples/explainer.html'), { width: 1280 });
let total = 0;
for (const target of list) {
  const [file, fn] = target.split(':');
  const res = await tab.evaluate(async ({ file, fn }) => {
    const m = await import(`/${file}`);
    const sb = m[fn]();
    const issues = sb.lint(window.__player.sk);
    return { duration: sb.duration, items: sb.items.length, issues };
  }, { file, fn });
  const errors = res.issues.filter((i) => i.level !== 'warn');
  const warns = res.issues.length - errors.length;
  total += errors.length;
  console.log(`${target}: ${res.items} kroków, ${res.duration.toFixed(1)} s — ${errors.length ? `${errors.length} błąd(ów) fizyki` : 'fizyka OK'}${warns ? `, ${warns} ostrzeżeń o tempie` : ''}`);
  for (const i of res.issues) console.log(`  ${i.level === 'warn' ? 'uwaga' : 'BŁĄD '}  ${i.time.toFixed(2)} s  ${i.name}: ${i.problem}`);
}
await close();
process.exit(total ? 1 : 0);
