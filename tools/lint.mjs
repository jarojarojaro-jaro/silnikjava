#!/usr/bin/env node
// Kontrola "fizyki" scen w prawdziwej przeglądarce (z prawdziwymi czcionkami):
// czy każdy element rysuje ręka, czy ręka zdąży dojechać, czy nic nie jest
// rysowane równolegle. Kod wyjścia 1, gdy są problemy (do CI / pętli poprawek).
//
//   node tools/lint.mjs examples/scenes/explainer.js:buildExplainer [inne...]
//   node tools/lint.mjs examples/scenes/styles/neon.js:buildNeon:examples/voice/neon/voice.json   # scena z lektorem
//   node tools/lint.mjs            # wszystkie dema
//   --items                        # dodatkowo czasy kroków (start +czas, zdanie, kotwica)

import { parseArgs, openPlayer } from './lib/page.mjs';

const { opt } = parseArgs(process.argv);
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const list = targets.length
  ? targets
  : [
      'examples/scenes/explainer.js:buildExplainer',
      'examples/scenes/hero.js:buildHero',
      'examples/scenes/diagram.js:buildScrollDiagram',
      'examples/scenes/narrated.js:buildNarrated:examples/voice/agent/voice.json',
      'examples/scenes/styles/chalk.js:buildChalk:examples/voice/chalk/voice.json',
      'examples/scenes/styles/blueprint.js:buildBlueprint:examples/voice/blueprint/voice.json',
      'examples/scenes/styles/neon.js:buildNeon:examples/voice/neon/voice.json',
      'examples/scenes/styles/notebook.js:buildNotebook:examples/voice/notebook/voice.json',
      'examples/scenes/styles/watercolor.js:buildWatercolor:examples/voice/watercolor/voice.json',
      'examples/scenes/styles/comic.js:buildComic:examples/voice/comic/voice.json',
      'examples/scenes/styles/flipchart.js:buildFlipchart:examples/voice/flipchart/voice.json',
      'examples/scenes/styles/kraft.js:buildKraft:examples/voice/kraft/voice.json',
      'examples/scenes/styles/sketch.js:buildSketch:examples/voice/sketch/voice.json',
      'examples/scenes/styles/parchment.js:buildParchment:examples/voice/parchment/voice.json',
      'examples/scenes/reels/notebook.js:buildReelNotebook:examples/voice/reel-notebook/voice.json',
      'examples/scenes/reels/neon.js:buildReelNeon:examples/voice/reel-neon/voice.json',
      'examples/scenes/reels/comic.js:buildReelComic:examples/voice/reel-comic/voice.json',
    ];

// strona-gospodarz: ładuje czcionki wszystkich motywów i Player (Sketch z prawdziwym canvasem)
const { tab, close } = await openPlayer(opt('host', 'examples/styles.html'), { width: 1280 });
let total = 0;
for (const target of list) {
  const [file, fn, voice] = target.split(':');
  const res = await tab.evaluate(async ({ file, fn, voice }) => {
    const m = await import(`/${file}`);
    const { Voice, Sketch, loadFonts } = await import('/src/index.js');
    const sb = m[fn](voice ? await Voice.load(`/${voice}`) : undefined);
    // ślad pisma zależy od czcionek motywu sceny
    const sk = new Sketch(window.__player.ctx, { theme: sb.theme ?? 'paper' });
    await loadFonts(sk.fonts);
    const issues = sb.lint(sk);
    const steps = [...sb.items].sort((a, b) => a.seg.start - b.seg.start).map((i) =>
      `${i.seg.start.toFixed(2).padStart(6)} +${i.seg.dur.toFixed(2)}  ${i.name.padEnd(14)} ${i.beat ?? ''}${i.cue ? `  „${i.cue.word}” @${i.cue.target.toFixed(2)}` : ''}`);
    return { duration: sb.duration, items: sb.items.length, issues, steps };
  }, { file, fn, voice });
  const errors = res.issues.filter((i) => i.level !== 'warn');
  const warns = res.issues.length - errors.length;
  total += errors.length;
  console.log(`${target}: ${res.items} kroków, ${res.duration.toFixed(1)} s — ${errors.length ? `${errors.length} błąd(ów) fizyki` : 'fizyka OK'}${warns ? `, ${warns} ostrzeżeń o tempie` : ''}`);
  if (opt('items')) for (const l of res.steps) console.log(`    ${l}`);
  for (const i of res.issues) console.log(`  ${i.level === 'warn' ? 'uwaga' : 'BŁĄD '}  ${i.time.toFixed(2)} s  ${i.name}: ${i.problem}`);
}
await close();
process.exit(total ? 1 : 0);
