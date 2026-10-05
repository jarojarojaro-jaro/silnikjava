// Styl: izometria (szkice przedmiotów w 3D, src/iso.js). "Droga wiadomości" —
// krótki film techniczny z lektorem. Głos: examples/voice/iso/.
// Bryła = sylwetka (ink) + krawędź górnej ścianki i detale (inkSoft, cieniej);
// dalsze linie przycięte do tego, co widać; pomarańczowy (pen) znaczy w całym
// filmie jedno: wiadomość (dymek → paczki → złożona całość).

import { Storyboard, isoCamera, iso, arc } from '../../../src/index.js';

const cam = isoCamera({ S: 3.55 });
// telefon (lewo), router (środek), szafa z serwerami (prawo) — w jednym rzędzie na ziemi
const PHONE = { x0: -98, y0: 74, x1: -82, y1: 106, z1: 2.6, r: 3, b: 1.1 };
const ROUTER = { x0: -17, y0: -11, x1: 17, y1: 11, z1: 8, r: 2.6, b: 1.2 };
const RACK = { x0: 78, y0: -114, x1: 112, y1: -80, z1: 82, r: 2.2, b: 1.4 };
cam.fit([[PHONE.x0, PHONE.y1, 0], [RACK.x1, RACK.y0, RACK.z1], [RACK.x0, RACK.y0, 0], [PHONE.x1, PHONE.y1, 0]], 650, 395);

const phone = iso.solid(cam, PHONE);
const router = iso.solid(cam, ROUTER);
const rack = iso.solid(cam, RACK);
// ekran telefonu: wcięty prostokąt na wierzchu
const SCREEN = iso.ringAt(cam, iso.rrect(PHONE.x0 + 2, PHONE.y0 + 3, PHONE.x1 - 2, PHONE.y1 - 4, 1.5), PHONE.z1);
const antenna = (x, y) => iso.cylinder(cam, { x, y, R: 1.2, z0: ROUTER.z1 - 1, z1: 30, b: 0.5 });
const ANT = [antenna(-12, -7), antenna(9, -7)];
const cube = (x, y, z, a) => iso.solid(cam, { x0: x, y0: y, x1: x + a, y1: y + a, z0: z, z1: z + a, r: 0.8, b: 0.5 });
const PACKETS = [cube(-70, 52, 14, 5), cube(-52, 36, 18, 5), cube(-34, 20, 15, 5)];
// szczeliny serwerów na lewej ściance (y = y1) i diody na prawej (x = x1)
const SLOTS = [10, 21, 32, 43, 54, 65].map((z) => iso.seg3(cam, [RACK.x0 + 4, RACK.y1, z], [RACK.x1 - 10, RACK.y1, z]));
const LEDS = [14, 25, 36, 47, 58, 69].map((z) => iso.seg3(cam, [RACK.x1 - 6, RACK.y1, z + 2], [RACK.x1 - 4, RACK.y1, z + 2]));
// wiadomość: dymek na ekranie telefonu
const BUBBLE = iso.ringAt(cam, iso.rrect(PHONE.x0 + 4, PHONE.y0 + 8, PHONE.x1 - 4, PHONE.y0 + 15, 1.6), PHONE.z1);
// droga przez internet: przerywana linia po ziemi od routera do szafy
const ROUTE = iso.ground(cam, [[14, 8], [36, 2], [56, -22], [70, -52], [86, -76]]);
const label = (text, at, dy = 46) => [text, at[0], at[1] + dy];

export function buildIso(voice) {
  const sb = new Storyboard({ w: 1280, h: 720, theme: 'iso', speed: 950 });
  const B = (n) => voice.beat(n);
  const thin = { color: 'inkSoft', w: 2 };
  const write = ([text, x, y], o = {}) => sb.write(text, x, y, { size: 26, align: 'center', color: 'ink', ...o });

  // 1. "Co się dzieje, gdy wysyłasz wiadomość? Wszystko zaczyna się w telefonie, który trzymasz w dłoni."
  sb.say(B(1), () => {
    sb.write('Droga wiadomości', 80, 112, { size: 54, font: 'title', weight: 700, color: 'ink', cue: 'Co' });
    sb.pen(phone.sil, { color: 'ink', w: 3, seed: 1, cue: 'Wszystko' });
    sb.strokes([phone.crease, [...SCREEN, SCREEN[0]]], { ...thin, seed: 2 });
    write(label('telefon', cam.P(PHONE.x1, PHONE.y1, 0)));
    // akcent: wiadomość na ekranie
    sb.pen([...BUBBLE, BUBBLE[0]], { color: 'pen', w: 2.4, seed: 3 });
    sb.strokes([0, 1].map((i) => iso.seg3(cam, [PHONE.x0 + 6, PHONE.y0 + 10.5 + i * 2.2, PHONE.z1], [PHONE.x1 - 6 - i * 2, PHONE.y0 + 10.5 + i * 2.2, PHONE.z1])), { color: 'pen', w: 1.8, seed: 4 });
  });

  // 2. "Wiadomość dzieli się na małe paczki danych. Lecą one falami radiowymi do domowego routera."
  sb.say(B(2), () => {
    // akcent: paczki danych
    sb.strokes(PACKETS.flatMap((c) => [c.sil, c.crease]), { color: 'pen', w: 2.4, seed: 10, cue: 'Wiadomość' });
    const [px, py] = cam.P((PHONE.x0 + PHONE.x1) / 2, PHONE.y0, PHONE.z1);
    sb.strokes([30, 48, 66].map((r) => arc(px + 10, py - 8, r, -1.05, -0.15, 16)), { ...thin, seed: 11, cue: 'falami' });
    // router: najpierw korpus (bliżej), potem anteny przycięte do tego, co widać
    sb.pen(router.sil, { color: 'ink', w: 3, seed: 12, cue: 'do' });
    sb.strokes([router.crease, ...ANT.flatMap((a) => iso.visible(a.sil, [router.sil]))], { ...thin, seed: 13, speed: 1300 });
    write(label('router', cam.P(ROUTER.x1, ROUTER.y1, 0)));
  });

  // 3. "Router wysyła paczki przez internet do serwerowni. Tam czeka wysoka szafa pełna serwerów, ułożonych jeden nad drugim."
  sb.say(B(3), () => {
    sb.strokes(iso.visible(ROUTE, [router.sil, rack.sil]), { ...thin, dash: [9, 8], seed: 20, cue: 'wysyła' });
    write(label('internet', cam.P(56, -22, 0), 34), { color: 'inkSoft', size: 24 });
    sb.pen(rack.sil, { color: 'ink', w: 3, seed: 21, cue: 'serwerowni.' });
    sb.strokes([rack.crease, ...SLOTS, ...LEDS], { ...thin, seed: 22 });
    write(label('serwer', cam.P(RACK.x1, RACK.y1, 0)));
  });

  // 4. "Serwer składa paczki z powrotem w całość. Wszystko trwa ułamek sekundy."
  sb.say(B(4), () => {
    // akcent (pomarańczowy = wiadomość): paczki złożone w jedną, nad serwerem
    const whole = cube(89, -103, 94, 12);
    sb.arrow(iso.seg3(cam, [95, -97, 84], [95, -97, 92]), { color: 'inkSoft', w: 2, head: 9, seed: 30, cue: 'Serwer' });
    sb.strokes([whole.sil, whole.crease], { color: 'pen', w: 2.8, seed: 31, cue: 'składa' });
    const [tx, ty] = cam.P(89, -91, 100);
    sb.write('< 0,1 s', tx - 34, ty + 14, { size: 44, font: 'title', weight: 700, align: 'right', color: 'ink', cue: 'ułamek' });
  });
  sb.wait(0.8);
  return sb;
}
