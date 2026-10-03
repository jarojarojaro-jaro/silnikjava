// Silnik — punkt wejścia. Importuj wszystko stąd:
//   import { Player, Storyboard, Sketch, paths, ease } from '../src/index.js';

export * from './math.js';
export * as paths from './paths.js';
export * from './paths.js';
export { THEMES, resolveTheme, themeNames } from './themes.js';
export { Sketch, PALETTE, BOIL_FPS, BOIL_CYCLE, loadFonts, arrowParts, crayonTrace } from './sketch.js';
export { StrokePlan, HandTrack, Sequence, HAND, minJerk, drawTime, liftTime, travelTime, minDuration } from './hand.js';
export { textGeometry, thin, trace as traceSkeleton } from './handwriting.js';
export { Timeline } from './timeline.js';
export { Storyboard } from './storyboard.js';
export { Player, scrollDrive } from './player.js';
export { recordWebM, download, snapshot } from './record.js';
export { Voice, Beat, subtitleCues, toSRT, toVTT, normWord } from './narration.js';
export { AudioTrack } from './audio.js';
