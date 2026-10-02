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
// Ręka (ołówek) ma ciągłą trajektorię przez cały film: prowadzi kreski,
// koloruje kredką, pisze litery, przelatuje łukiem do kolejnego elementu,
// odpoczywa obok rysunku i schodzi z kadru na końcu (HandTrack).
// Czasy kroków wynikają z modelu ręki (StrokePlan), a przed kolejnym
// elementem automatycznie jest chwila na przelot ołówka.

import { Timeline } from './timeline.js';
import { clamp, ease, lerp, noise1 } from './math.js';
import { bounds } from './paths.js';
import { StrokePlan, HandTrack, HAND, travelTime } from './hand.js';
import { arrowParts, crayonTrace } from './sketch.js';

const PEN_SPEED = HAND.speed;
// rodzaje kroków, które po zakończeniu wyglądają tak samo (poza drganiem kreski) — można je buforować
const STATIC_KINDS = new Set(['pen', 'strokes', 'arrow', 'crayon', 'fill', 'highlight', 'write', 'dot']);
const TIMING_KEYS = ['at', 'with', 'after', 'gap'];

export class Storyboard {
  /**
   * @param {object} o w, h (rozmiar sceny), pencil (czy pokazywać ołówek), paper (tło),
   *                   idle ('boil' | 'loop' | 'still'), speed (px/s ręki), background(sk,t) — własne tło,
   *                   handGaps (domyślnie true — przerwy na przelot ołówka między elementami),
   *                   cache (domyślnie true — bufor ukończonych elementów), fps (limit klatek w idle 'loop')
   */
  constructor({ w = 1280, h = 720, pencil = true, paper = true, idle = 'boil', speed = PEN_SPEED, background, handGaps = true, cache = true, fps } = {}) {
    this.fps = fps;
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
    this.handGaps = handGaps;
    this.useCache = cache;
    this.n = 0;
    this.lastPencil = null; // ostatni krok z ręką (do automatycznych przerw)
    this.hand = null; // HandTrack — budowany leniwie przy pierwszym rysowaniu
    this.caches = [];
    this.lastCamKey = null;
  }

  // ------------------------------------------------------------ rejestracja kroków

  /**
   * @param {string} kind
   * @param {number} dur
   * @param {object} o opcje (czasowe + pędzla)
   * @param {Function} render (sk, p, t) => void
   * @param {object} [hand] { trace(sk, p) => tip, from, to } — ślad ręki
   */
  #add(kind, dur, o, render, hand) {
    const name = o.name ?? `${kind}#${this.n++}`;
    const pencil = !!hand && (o.pencil ?? this.usePencil);
    const timing = { ...o };
    // automatyczna przerwa na przelot ręki od poprzedniego elementu
    if (pencil && this.handGaps && this.lastPencil && !TIMING_KEYS.some((k) => o[k] != null) && this.tl.cursor <= this.lastPencil.seg.start + this.lastPencil.seg.dur + 1e-6) {
      const a = this.lastPencil.to, b = hand.from;
      if (a && b) timing.gap = travelTime(Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    this.tl.add(name, dur, { ...timing, ease: o.ease ?? (kind === 'pop' ? 'back' : hand?.natural ? 'linear' : 'hand') });
    const seg = this.tl.get(name);
    const item = {
      name, kind, seg, render,
      chapter: this.chapter,
      keep: !!o.keep,
      // warstwa: kredka domyślnie pod konturami, nawet jeśli dodana później
      z: o.z ?? (kind === 'crayon' || kind === 'liquid' || kind === 'highlight' ? -1 : 0),
      pencil,
      static: o.static ?? STATIC_KINDS.has(kind),
      trace: hand?.trace,
      from: hand?.from,
      to: hand?.to,
    };
    this.items.push(item);
    this.items.sort((p, q) => p.z - q.z); // sort stabilny — w obrębie warstwy kolejność dodania
    if (pencil) this.lastPencil = item;
    this.hand = null;
    return this;
  }

  /** Czas z modelu ręki (albo `dur`), przeskalowany prędkością storyboardu. */
  #planDur(o, plan) {
    if (o.dur != null) return o.dur;
    return clamp(plan.total * ((PEN_SPEED / (o.speed ?? this.speed)) || 1), 0.2, 6);
  }

  #strokeItem(kind, list, o, draw) {
    const plan = StrokePlan.of(list);
    return this.#add(kind, this.#planDur(o, plan), o, draw, {
      natural: true,
      from: plan.from,
      to: plan.to,
      trace: (sk, p) => plan.at(p).tip,
    });
  }

  /** Kreska piórem. Opcje pędzla jak w Sketch.pen + czasowe: dur, at, with, after, gap, ease, keep, name, pencil, z. */
  pen(pts, o = {}) {
    const list = [pts];
    return this.#strokeItem('pen', list, o, (sk, p) => sk.strokes(list, p, o));
  }

  /** Kilka kresek po kolei, z podnoszeniem ołówka między nimi. */
  strokes(list, o = {}) {
    return this.#strokeItem('strokes', list, o, (sk, p) => sk.strokes(list, p, o));
  }

  arrow(pts, o = {}) {
    return this.#strokeItem('arrow', arrowParts(pts, o.head ?? 16), o, (sk, p) => sk.arrow(pts, p, o));
  }

  /** Zamalowanie kredką — ręka jedzie zygzakiem wewnątrz konturu. */
  crayon(poly, o = {}) {
    const b = bounds(poly);
    const from = crayonTrace(poly, 0, o), to = crayonTrace(poly, 1, o);
    return this.#add('crayon', o.dur ?? clamp(0.35 + Math.sqrt(b.w * b.h) / 400, 0.4, 1.4), { ease: 'inOut', ...o }, (sk, p) => {
      sk.crayon(poly, p, o);
    }, {
      from: [from.x, from.y],
      to: [to.x, to.y],
      trace: (sk, p) => crayonTrace(poly, p, o),
    });
  }

  fill(poly, o = {}) {
    return this.#add('fill', o.dur ?? 0.4, { ease: 'out', ...o }, (sk, p) => sk.fill(poly, o.color ?? 'paper', p * (o.alpha ?? 1)));
  }

  liquid(poly, o = {}) {
    return this.#add('liquid', o.dur ?? 1, { ease: 'inOut', ...o }, (sk, p) => sk.liquid(poly, p * (o.level ?? 1), o));
  }

  highlight(pts, width = 22, o = {}) {
    return this.#add('highlight', o.dur ?? 0.6, o, (sk, p) => sk.highlight(pts, width, p, o), {
      from: pts[0],
      to: pts[pts.length - 1],
      trace: (sk, p) => {
        const i = Math.min(pts.length - 1, Math.floor(p * (pts.length - 1)));
        return { x: pts[i][0], y: pts[i][1], angle: 0, lift: 0 };
      },
    });
  }

  /**
   * Pismo odręczne. Czas: `dur`, albo szacunek z długości tekstu i rozmiaru
   * (tempo ręki ~ jak człowiek piszący markerem na tablicy).
   */
  write(text, x, y, o = {}) {
    const size = o.size ?? 32;
    const chars = String(text).replace(/\s/g, '').length;
    const est = (chars * (0.06 + size / 1500) + (String(text).split(/\s+/).length - 1) * 0.08) * ((PEN_SPEED / (o.speed ?? this.speed)) || 1);
    const dur = o.dur ?? clamp(est, 0.3, 8);
    const w = String(text).length * size * 0.45;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const wo = { ...o, fit: dur };
    return this.#add('write', dur, { ease: 'linear', ...o }, (sk, p) => sk.write(text, x, y, p, wo), {
      from: [x0, y - size * 0.4],
      to: [x0 + w, y],
      trace: (sk, p) => sk.writeTrace(text, x, y, p, wo),
    });
  }

  dot(x, y, r, o = {}) {
    return this.#add('dot', o.dur ?? 0.35, { ease: 'back', ...o }, (sk, p) => sk.dot(x, y, r * p, o.color ?? 'pen', o.alpha ?? 1));
  }

  /**
   * Element "wyskakujący" — rysowany przez fn(sk, t) w skali rosnącej od 0 z
   * lekkim przestrzeleniem, wokół punktu (x,y).
   */
  pop(x, y, fn, o = {}) {
    return this.#add('pop', o.dur ?? 0.45, o, (sk, p, t) => {
      if (p <= 0) return;
      sk.group({ x, y, scale: Math.max(0, p) }, () => fn(sk, t));
    });
  }

  /**
   * Dowolne rysowanie: fn(sk, p, t) — p to postęp tego kroku.
   * Żeby ręka prowadziła rysunek, podaj o.trace(p) => {x,y} oraz o.from/o.to.
   */
  custom(fn, o = {}) {
    const hand = o.trace && {
      from: o.from ?? (() => { const a = o.trace(0); return [a.x, a.y]; })(),
      to: o.to ?? (() => { const a = o.trace(1); return [a.x, a.y]; })(),
      trace: (sk, p) => o.trace(p),
    };
    return this.#add('custom', o.dur ?? 1, o, fn, hand);
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
    this.lastPencil = null;
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
      fps: this.fps,
      draw: (sk, t) => this.draw(sk, t),
    };
  }

  /** Ciągła trajektoria ręki (budowana raz, po wczytaniu czcionek). */
  handTrack(sk) {
    if (this.hand) return this.hand;
    const segs = this.items
      .filter((it) => it.pencil && it.trace)
      .map((it) => ({
        start: it.seg.start,
        end: it.seg.start + it.seg.dur,
        trace: (t) => it.trace(sk, it.seg.ease(clamp((t - it.seg.start) / (it.seg.dur || 1)))),
      }));
    const off = [this.w + 90, this.h + 110];
    this.hand = new HandTrack(segs, { enter: off, exit: off });
    return this.hand;
  }

  draw(sk, t) {
    const { ctx } = sk;
    const cam = this.cameraAt(t);

    // który rozdział jest widoczny i czy trwa ścieranie
    let wipe = null;
    let visibleChapter = 0;
    for (const c of this.clears) {
      if (t >= c.start + c.dur) visibleChapter = c.chapter + 1;
      else if (t >= c.start) wipe = c;
    }

    const main = [];
    const kept = [];
    for (const it of this.items) {
      if (it.keep) kept.push(it);
      else if (it.chapter === visibleChapter) main.push(it);
    }
    const drawItem = (it) => {
      const s = it.seg;
      if (t < s.start) return;
      const raw = s.dur === 0 ? 1 : clamp((t - s.start) / s.dur);
      it.render(sk, s.ease(raw), t);
    };
    const settled = (it) => it.static && t >= it.seg.start + it.seg.dur;

    // bufor: ukończone elementy kopiujemy z bitmapy (odświeżanej, gdy zmienia się
    // klatka drgania, rozmiar albo kamera), na bieżąco rysujemy tylko resztę
    const camKey = `${cam.x.toFixed(2)},${cam.y.toFixed(2)},${cam.zoom.toFixed(4)}`;
    const camStill = camKey === this.lastCamKey;
    this.lastCamKey = camKey;
    const canCache = this.useCache && camStill && typeof document !== 'undefined' && ctx.canvas?.width > 0 && !this.background;

    const base = ctx.getTransform();
    const applyCam = (c) => {
      c.translate(this.w / 2, this.h / 2);
      c.scale(cam.zoom, cam.zoom);
      c.translate(-cam.x, -cam.y);
    };

    // grupy kolejnych elementów o tym samym z
    const groups = [];
    for (const it of main) {
      const g = groups[groups.length - 1];
      if (g && g.z === it.z) g.items.push(it);
      else groups.push({ z: it.z, items: [it] });
    }
    if (!groups.length) groups.push({ z: 0, items: [] });

    groups.forEach((g, gi) => {
      let k = 0;
      while (k < g.items.length && settled(g.items[k])) k++;
      const withPaper = gi === 0 && this.paper;
      if (canCache && (k > 0 || withPaper)) {
        const key = `${visibleChapter}|${k}|${sk.boil}|${camKey}|${ctx.canvas.width}x${ctx.canvas.height}|${base.a.toFixed(4)},${base.e.toFixed(1)},${base.f.toFixed(1)}`;
        const c = (this.caches[gi] ??= { canvas: document.createElement('canvas'), key: null });
        if (c.key !== key) {
          c.canvas.width = ctx.canvas.width;
          c.canvas.height = ctx.canvas.height;
          const cc = c.canvas.getContext('2d');
          cc.setTransform(base);
          sk.ctx = cc;
          try {
            if (withPaper) sk.paper(this.w, this.h);
            cc.save();
            applyCam(cc);
            for (let i = 0; i < k; i++) drawItem(g.items[i]);
            cc.restore();
          } finally {
            sk.ctx = ctx;
          }
          c.key = key;
        }
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(c.canvas, 0, 0);
        ctx.restore();
      } else {
        k = 0;
        if (withPaper) sk.paper(this.w, this.h);
        if (gi === 0) this.background?.(sk, t);
      }
      ctx.save();
      applyCam(ctx);
      for (let i = k; i < g.items.length; i++) drawItem(g.items[i]);
      ctx.restore();
    });

    ctx.save();
    applyCam(ctx);
    if (wipe) this.#wipe(sk, cam, clamp((t - wipe.start) / wipe.dur), t);
    kept.forEach(drawItem);

    // ołówek — dopiero gdy czcionki są gotowe (ślad pisma zależy od kształtu liter)
    if (this.usePencil && sk.fontsReady !== false && sk.writeTrace) {
      const hand = this.handTrack(sk);
      const pos = hand.at(t);
      if (pos) {
        const prev = hand.at(t - 1 / 30) ?? pos;
        const vx = (pos.x - prev.x) * 30;
        sk.pencil(pos.x, pos.y, { size: 0.9 / cam.zoom ** 0.3, lift: pos.lift ?? 0, lean: -clamp(vx / 4000, -0.22, 0.22) });
      }
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
}
