#!/usr/bin/env node
// Podglądy GIF do README: renderuje filmy z rejestru stylów (i rolki) i robi z nich GIF-y
// przyspieszone 2,2×, 10 kl./s, 480 px szerokości (rolki 240 px).
//
//   node tools/gallery.mjs              # wszystkie style i rolki
//   node tools/gallery.mjs iso ascii    # wybrane style (id z rejestru)
//
// Przepis GIF: lekkie odszumienie (ziarno papieru zmienia się co klatkę i puchnie w GIF-ie),
// paleta liczona z różnic między klatkami, bez ditheringu — małe pliki, czyste kreski.

import { spawnSync } from 'node:child_process';
import { STYLES } from '../examples/scenes/styles/index.js';

const REELS = ['notebook', 'neon', 'comic'];
const want = process.argv.slice(2);
const jobs = [
  ...STYLES.filter((s) => !want.length || want.includes(s.id)).map((s) => ({ page: `examples/styles.html?s=${s.id}`, out: `out/style-${s.id}`, gif: `docs/img/styles/${s.id}.gif`, w: 480 })),
  ...REELS.filter((r) => !want.length || want.includes(`reel-${r}`)).map((r) => ({ page: `examples/reels.html?r=${r}`, out: `out/reel-${r}`, gif: `docs/img/reels/${r}.gif`, w: 240 })),
];

let failed = 0;
for (const j of jobs) {
  // podgląd z MP4 w 720p (GIF i tak ma 480 px)
  const r = spawnSync('node', ['tools/render.mjs', j.page, '--out', j.out, '--fps', '30', '--width', j.w === 240 ? '720' : '1280', '--mp4'], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) { failed++; console.error(`ŹLE  ${j.page}: render`); continue; }
  const vf = `setpts=PTS/2.2,fps=10,scale=${j.w}:-2:flags=lanczos,hqdn3d=3:3:8:8,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`;
  const g = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${j.out}.mp4`, '-vf', vf, '-an', j.gif], { stdio: 'inherit' });
  if (g.status !== 0) { failed++; console.error(`ŹLE  ${j.gif}`); continue; }
  const kb = Math.round(spawnSync('stat', ['-c', '%s', j.gif]).stdout.toString() / 1024);
  console.log(`ok   ${j.gif} (${kb} KB)`);
}
process.exit(failed ? 1 : 0);
