// Storyboard — deklaratywny "scenariusz" filmu objaśniającego (explainer video).
// Zamiast pisać draw(t) ręcznie, dopisujesz kolejne kroki:
//
//   const sb = new Storyboard({ w: 1280, h: 720 });
//   sb.write('Jak działa agent?', 640, 120, { size: 64, align: 'center' });
//   sb.pen(rect(200, 250, 220, 140), { color: 'ink' });
//   sb.arrow(line(430, 320, 600, 320));
//   sb.camera({ x: 500, y: 320, zoom: 1.4 }, { dur: 1.2 });
//   sb.clear();                       // starcie tablicy -> nowy rozdział
//   player = new Player(canvas, sb.scene());
//
// Ołówek sam podąża za aktualnie rysowaną kreską i przelatuje między kolejnymi.

import { Timeline } from './timeline.js';
import { clamp, ease, lerp, noise1 } from './math.js';
import { pathLength, bounds } from './paths.js';

const PEN_SPEED = 650; // px/s — domyślna prędkość ręki przy rysowaniu
const WRITE_SPEED = 14; // znaków/s przy piśmie odręcznym
const TRAVEL_MAX = 1.4; // [s] — dłuższej przerwy ołówek nie przelatuje, tylko znika

export class Storyboard {
  /**
   * @param {object} o w, h (rozmiar sceny), pencil (czy pokazywać ołówek), paper (tło),
   *                   idle ('boil' | 'loop' | 'still'), speed (px/s), background(sk,t) — własne tło
   */
  constructor({ w = 1280, h = 720, pencil = true, paper = true, idle = 'boil', speed = PEN_SPEED, background } = {}) {
    this.w = w;
    this.h = h;
    this.tl = new Timeline();
    this.items = [];
    this.cams = [];
    this.clears = [];
    this.chapter = 0;
    this.usePencil = pencil;
    this.paper = paper;
    this.idle = idle;
    this.speed = speed;
    this.background = background;
    this.n = 0;
  }

  // ------------------------------------------------------------ rejestracja kroków

  #add(kind, dur, o, render, from, to) {
    const name = o.name ?? `${kind}#${this.n++}`;
    this.tl.add(name, dur, { ...o, ease: o.ease ?? (kind === 'pop' ? 'back' : 'hand') });
    const seg = this.tl.get(name);
    const item = {
      name, kind, seg, render,
      chapter: this.chapter,
      keep: !!o.keep,
      // warstwa: kredka domyślnie pod konturami, nawet jeśli dodana później
      z: o.z ?? (kind === 'crayon' || kind === 'liquid' || kind === 'highlight' ? -1 : 0),
      pencil: o.pencil ?? (this.usePencil && ['pen', 'arrow', 'strokes', 'write', 'crayon'].includes(kind)),
      from, to,
    };
    this.items.push(item);
    this.items.sort((p, q) => p.z - q.z); // sort stabilny — w obrębie warstwy kolejność dodania
    return this;
  }

  #dur(o, pts) {
    if (o.dur != null) return o.dur;
    const L = Array.isArray(pts[0]?.[0]) ? pts.reduce((a, s) => a + pathLength(s), 0) : pathLength(pts);
    return clamp(L / (o.speed ?? this.speed), 0.25, 4);
  }

  /** Kreska piórem. Opcje pędzla jak w Sketch.pen + czasowe: dur, at, with, after, gap, ease, keep, name. */
  pen(pts, o = {}) {
    return this.#add('pen', this.#dur(o, pts), o, (sk, p) => sk.pen(pts, p, o), pts[0], pts[pts.length - 1]);
  }

  /** Kilka kresek jednym ciągiem. */
  strokes(list, o = {}) {
    const last = list[list.length - 1];
    return this.#add('strokes', this.#dur(o, list), o, (sk, p) => sk.strokes(list, p, o), list[0][0], last[last.length - 1]);
  }

  arrow(pts, o = {}) {
    return this.#add('arrow', this.#dur(o, pts) + 0.2, o, (sk, p) => sk.arrow(pts, p, o), pts[0], pts[pts.length - 1]);
  }

  crayon(poly, o = {}) {
    const b = bounds(poly);
    return this.#add('crayon', o.dur ?? 0.9, { pencil: false, ...o }, (sk, p) => {
      sk.crayon(poly, p, o);
      return null;
    }, [b.x, b.y], [b.x + b.w, b.y + b.h]);
  }

  fill(poly, o = {}) {
    return this.#add('fill', o.dur ?? 0.4, { ease: 'out', ...o }, (sk, p) => sk.fill(poly, o.color ?? 'paper', p * (o.alpha ?? 1)));
  }

  liquid(poly, o = {}) {
    return this.#add('liquid', o.dur ?? 1, { ease: 'inOut', ...o }, (sk, p) => sk.liquid(poly, p * (o.level ?? 1), o));
  }

  highlight(pts, width = 22, o = {}) {
    return this.#add('highlight', o.dur ?? 0.6, o, (sk, p) => sk.highlight(pts, width, p, o));
  }

  write(text, x, y, o = {}) {
    const dur = o.dur ?? clamp(String(text).length / (o.cps ?? WRITE_SPEED), 0.3, 6);
    return this.#add('write', dur, { ease: 'linear', ...o }, (sk, p) => sk.write(text, x, y, p, o), [x, y], [x, y]);
  }

  dot(x, y, r, o = {}) {
    return this.#add('pop', o.dur ?? 0.35, o, (sk, p) => sk.dot(x, y, r * p, o.color ?? 'pen', o.alpha ?? 1));
  }

  /**
   * Element "wyskakujący" — rysowany przez fn(sk, t) w skali rosnącej od 0 z
   * lekkim przestrzeleniem, wokół punktu (x,y).
   */
  pop(x, y, fn, o = {}) {
    return this.#add('pop', o.dur ?? 0.45, o, (sk, p, t) => {
      if (p <= 0) return null;
      sk.group({ x, y, scale: Math.max(0, p) }, () => fn(sk, t));
      return null;
    });
  }

  /** Dowolne rysowanie: fn(sk, p, t) — p to postęp tego kroku. Może zwrócić końcówkę dla ołówka. */
  custom(fn, o = {}) {
    return this.#add('custom', o.dur ?? 1, o, fn);
  }

  wait(sec) {
    this.tl.wait(sec);
    return this;
  }

  mark(name) {
    this.tl.mark(name);
    return this;
  }

  /** Ruch kamery: x,y — środek kadru w układzie sceny, zoom — przybliżenie. */
  camera({ x = this.w / 2, y = this.h / 2, zoom = 1 } = {}, o = {}) {
    const dur = o.dur ?? 1.2;
    const start = this.tl.resolveStart(o);
    this.cams.push({ start, dur, to: { x, y, zoom }, ease: ease[o.ease ?? 'inOut'] ?? ease.inOut });
    this.cams.sort((a, b) => a.start - b.start);
    if (!o.parallel) this.tl.cursor = Math.max(this.tl.cursor, start + dur);
    return this;
  }

  /** Starcie tablicy (gumka przechodzi od lewej do prawej) i nowy rozdział. */
  clear(o = {}) {
    const dur = o.dur ?? 0.9;
    const start = this.tl.cursor + (o.gap ?? 0.2);
    this.clears.push({ start, dur, chapter: this.chapter });
    this.chapter++;
    this.tl.cursor = start + dur + 0.15;
    return this;
  }

  get duration() {
    let d = this.tl.duration;
    for (const c of this.cams) d = Math.max(d, c.start + c.dur);
    return d;
  }

  // ------------------------------------------------------------ odtwarzanie

  cameraAt(t) {
    let cam = { x: this.w / 2, y: this.h / 2, zoom: 1 };
    for (const k of this.cams) {
      if (t <= k.start) break;
      const q = k.ease(clamp((t - k.start) / k.dur));
      cam = { x: lerp(cam.x, k.to.x, q), y: lerp(cam.y, k.to.y, q), zoom: lerp(cam.zoom, k.to.zoom, q) };
    }
    return cam;
  }

  /** Zwraca obiekt sceny dla Playera. */
  scene() {
    return {
      w: this.w,
      h: this.h,
      duration: this.duration,
      idle: this.idle,
      draw: (sk, t) => this.draw(sk, t),
    };
  }

  draw(sk, t) {
    const { ctx } = sk;
    if (this.paper) sk.paper(this.w, this.h);
    this.background?.(sk, t);

    const cam = this.cameraAt(t);
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // który rozdział jest widoczny i czy trwa ścieranie
    let wipe = null;
    let visibleChapter = 0;
    for (const c of this.clears) {
      if (t >= c.start + c.dur) visibleChapter = c.chapter + 1;
      else if (t >= c.start) wipe = c;
    }

    let tip = null;
    let tipStart = -Infinity;
    const drawItem = (it) => {
      const s = it.seg;
      if (t < s.start) return;
      const raw = s.dur === 0 ? 1 : clamp((t - s.start) / s.dur);
      const res = it.render(sk, s.ease(raw), t);
      if (it.pencil && res && raw < 1 && s.start >= tipStart) {
        tip = res;
        tipStart = s.start;
      }
    };

    const kept = [];
    for (const it of this.items) {
      if (it.keep) { kept.push(it); continue; }
      if (it.chapter === visibleChapter) drawItem(it);
    }
    if (wipe) this.#wipe(sk, cam, clamp((t - wipe.start) / wipe.dur), t);
    kept.forEach(drawItem);

    if (this.usePencil) {
      const pos = tip ?? this.#travel(t, visibleChapter);
      if (pos) sk.pencil(pos.x, pos.y, { size: 0.9 / cam.zoom ** 0.3 });
    }
    ctx.restore();
  }

  /** Gumka: falisty pas koloru papieru przesuwający się przez kadr. */
  #wipe(sk, cam, q, t) {
    const vw = this.w / cam.zoom, vh = this.h / cam.zoom;
    const x0 = cam.x - vw / 2 - 40, y0 = cam.y - vh / 2 - 40;
    const edge = x0 + (vw + 160) * ease.inOut(q);
    const poly = [[x0, y0]];
    for (let y = y0; y <= y0 + vh + 80; y += 20) poly.push([edge + noise1(y * 0.02 + t) * 30, y]);
    poly.push([x0, y0 + vh + 80]);
    sk.fill(poly, 'paper', 1);
  }

  /** Między kreskami ołówek przelatuje łukiem od końca poprzedniej do początku następnej. */
  #travel(t, chapter) {
    let prev = null, next = null;
    for (const it of this.items) {
      if (!it.pencil || !it.from || (it.chapter !== chapter && !it.keep)) continue;
      const end = it.seg.start + it.seg.dur;
      if (end <= t && (!prev || end > prev.seg.start + prev.seg.dur)) prev = it;
      if (it.seg.start > t && (!next || it.seg.start < next.seg.start)) next = it;
    }
    if (!prev || !next) return null;
    const t0 = prev.seg.start + prev.seg.dur;
    const t1 = next.seg.start;
    if (t1 - t0 > TRAVEL_MAX) return null;
    const q = ease.inOut(clamp((t - t0) / Math.max(1e-3, t1 - t0)));
    const [ax, ay] = prev.to, [bx, by] = next.from;
    const lift = Math.min(60, Math.hypot(bx - ax, by - ay) * 0.25);
    return { x: lerp(ax, bx, q), y: lerp(ay, by, q) - Math.sin(Math.PI * q) * lift };
  }
}
