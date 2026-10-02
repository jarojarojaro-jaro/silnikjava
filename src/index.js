// Silnik — punkt wejścia. Importuj wszystko stąd:
//   import { Player, Storyboard, Sketch, paths, ease } from '../src/index.js';

export * from './math.js';
export * as paths from './paths.js';
export * from './paths.js';
export { Sketch, PALETTE, BOIL_FPS, loadFonts, arrowParts, crayonTrace } from './sketch.js';
export { StrokePlan, HandTrack, HAND, minJerk, drawTime, liftTime, travelTime } from './hand.js';
export { textGeometry, thin, trace as traceSkeleton } from './handwriting.js';
export { Timeline } from './timeline.js';
export { Storyboard } from './storyboard.js';
export { Player, scrollDrive } from './player.js';
export { recordWebM, download, snapshot } from './record.js';
