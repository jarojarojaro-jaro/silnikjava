// Storyboard — deklaratywny "scenariusz" filmu objaśniającego (explainer video).
// Zamiast pisać draw(t) ręcznie, dopisujesz kolejne kroki:
//
//   const sb = new Storyboard({ w: 1280, h: 720 });
//   sb.write('Jak działa agent?', 640, 120, { size: 64, align: 'center' });
//   sb.pen(rect(200, 250, 220, 140), { color: 'ink' });
//   sb.arrow(line(430, 320, 600, 320));
//   sb.camera({ x: 500, y: 320, zoom: 1.4 }, { dur: 1.2 });
//   sb.clear();                       // starcie tablicy gąbką -> nowy rozdział
//   player = new Player(canvas, sb.scene());
//
// Zasada fizyki sceny: NIC nie pojawia się samo. Każdy ślad na kartce robi
// jedna ręka z narzędziem — ołówkiem (w kolorze kreski), zakreślaczem albo
// gąbką. Ręka ma ciągłą trajektorię (HandTrack): prowadzi kreskę, przelatuje
// do następnego elementu, zmienia narzędzie w powietrzu, odpoczywa obok
// rysunku i schodzi z kadru. Wyjątki trzeba nazwać wprost:
//   ambient: true — animacja otoczenia już narysowanego elementu (para, oddech),
//   magic: true   — świadomy efekt "magiczny" (pop).
// sb.lint() wypisuje wszystko, co łamie tę zasadę (także kroki, do których ręka
// nie zdąży dojechać albo które są rysowane równolegle z innymi).

import { Timeline } from './timeline.js';
import { clamp, ease, easing, lerp, noise1 } from './math.js';
import { bounds } from './paths.js';
import { StrokePlan, HandTrack, HAND, travelTime, minDuration } from './hand.js';
import { arrowParts, crayonTrace } from './sketch.js';
import { subtitleCues, reelCues, toSRT, toVTT } from './narration.js';
import { resolveTheme } from './themes.js';

const PEN_SPEED = HAND.speed;
// rodzaje kroków, które po zakończeniu wyglądają tak samo (poza drganiem kreski) — można je buforować
const STATIC_KINDS = new Set(['pen', 'strokes', 'arrow', 'crayon', 'fill', 'highlight', 'write', 'dot']);
const TIMING_KEYS = ['at', 'with', 'after', 'gap'];
const SOLID = (o) => ({ spacing: 16, w: 36, angle: -0.5, ...o, solid: true });
const ERASE_PASSES = 5;
const AIM = 0.06;
// napisy rolkowe: gruby bezszeryfowy krój z pełnymi polskimi znakami (jak w aplikacjach)
const CAPTION_FONT = '"Montserrat", "Arial Black", sans-serif';

export class Storyboard {
  /**
   * @param {object} o w, h (rozmiar sceny), pencil (czy pokazywać rękę), paper (tło),
   *                   idle ('boil' | 'loop' | 'still'), speed (px/s ręki), background(sk,t) — własne tło,
   *                   handGaps (domyślnie true — przerwy na przelot ręki między elementami),
   *                   cache (domyślnie true — bufor ukończonych elementów), fps (limit klatek w idle 'loop'),
   *                   warn (domyślnie true — ostrzeżenia lint w konsoli przy pierwszym rysowaniu)
   */
  constructor({ w, h, pencil = true, paper = true, idle = 'boil', speed = PEN_SPEED, background, handGaps = true, cache = true, fps, warn = true, theme, format, safe, captions } = {}) {
    this.theme = theme;
    // format 'reel' (rolka 9:16): kadr 720×1280 (render np. 1080×1920), strefy zasłaniane
    // przez interfejs aplikacji poza rysunkiem, napisy słowo po słowie wypalone w obraz
    const reel = format === 'reel';
    w ??= reel ? 720 : 1280;
    h ??= reel ? 1280 : 720;
    this.format = format ?? 'landscape';
    this.safe = safe ?? (reel ? { x0: 36, y0: 150, x1: 640, y1: 900 } : null);
    this.captions = captions === false ? null : captions ?? (reel ? {} : null);
    this.w = w;
    this.h = h;
    this.fps = fps;
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
    this.warn = warn;
    this.n = 0;
    this.lastHand = null; // ostatni krok z ręką (do automatycznych przerw)
    this.hand = null; // HandTrack — budowany leniwie przy pierwszym rysowaniu
    this.caches = [];
    this.lastCamKey = null;
    this.audio = []; // klipy lektora na osi czasu: { id, src, start, dur, text, words }
    this.beat = null; // beat, w którym aktualnie układamy rysunek (sb.say)
  }

  // ------------------------------------------------------------ rejestracja kroków

  /**
   * @param {string} kind
   * @param {number} dur
   * @param {object} o opcje (czasowe + pędzla)
   * @param {Function} render (sk, p, t) => void
   * @param {object} [hand] { trace(sk, p, t) => tip, from, to, tool, natural } — ślad ręki
   */
  #add(kind, dur, o, render, hand) {
    const name = o.name ?? `${kind}#${this.n++}`;
    const useHand = !!hand && o.pencil !== false;
    const timing = { ...o };
    // kotwica do słowa lektora: ołówek dotyka kartki `lead` s przed słowem
    // (nie wcześniej, niż ręka zdąży dojechać)
    let cue = null;
    if (o.cue != null && this.beat) {
      const w = this.beat.beat.word(o.cue, o.cueNth ?? 0);
      const target = this.beat.start + w.s - (o.lead ?? this.beat.lead);
      let need = 0;
      if (useHand && this.lastHand?.to && hand.from) {
        const [ax, ay] = this.lastHand.to, [bx, by] = hand.from;
        const idle = this.tl.cursor - (this.lastHand.seg.start + this.lastHand.seg.dur);
        need = Math.max(0, travelTime(Math.hypot(bx - ax, by - ay)) + AIM - Math.max(0, idle));
      }
      timing.at = Math.max(target, this.tl.cursor + need);
      delete timing.cue;
      cue = { word: w.w, target, beat: this.beat.id };
    }
    // automatyczna przerwa na przelot ręki od poprzedniego elementu
    // (dopełnia brakujący czas, jeśli wcześniej był już wait/kamera)
    if (useHand && this.handGaps && this.lastHand && !TIMING_KEYS.some((k) => timing[k] != null)) {
      const a = this.lastHand.to, b = hand.from;
      const idle = this.tl.cursor - (this.lastHand.seg.start + this.lastHand.seg.dur);
      // + chwila na "wycelowanie" przed dotknięciem kartki (pokrywa też niedokładność szacunku pozycji)
      const need = a && b ? travelTime(Math.hypot(b[0] - a[0], b[1] - a[1])) + AIM : 0;
      if (need > idle + 1e-6) timing.gap = need - Math.max(0, idle);
    }
    const easeName = o.ease ?? (kind === 'pop' ? 'back' : hand?.natural ? 'linear' : 'inOut');
    // fizyka: krok nie może wymagać szybszej ręki niż HAND.maxSpeed — w razie
    // potrzeby wydłużamy go (pismo liczy ślad dopiero przy rysowaniu, więc pomijamy)
    if (useHand && kind !== 'write' && !o.fast) {
      const t0 = this.tl.cursor;
      const min = minDuration((p) => hand.trace(null, p, t0), easing(easeName));
      if (min > dur) dur = min;
    }
    this.tl.add(name, dur, { ...timing, ease: easeName });
    const seg = this.tl.get(name);
    const item = {
      name, kind, seg, render, cue,
      beat: this.beat?.id ?? null,
      chapter: this.chapter,
      keep: !!o.keep,
      // warstwa: kolor (kredka, zakreślacz, wypełnienie) domyślnie pod konturami
      // ciecz faluje cały czas — osobna warstwa nad kolorami, żeby nie psuła bufora
      z: o.z ?? (kind === 'liquid' ? -0.5 : ['crayon', 'highlight', 'fill'].includes(kind) ? -1 : 0),
      hand: useHand,
      visible: kind !== 'clear',
      ambient: !!o.ambient,
      magic: !!o.magic,
      static: o.static ?? STATIC_KINDS.has(kind),
      trace: hand?.trace,
      tool: hand?.tool ?? { type: 'pencil', color: o.color },
      from: hand?.from,
      to: hand?.to,
      // ramka obiektu na kartce (do reguły kompletności obiektu w lint)
      box: o.box ?? hand?.box ?? null,
      revisit: !!o.revisit,
    };
    this.items.push(item);
    this.items.sort((p, q) => p.z - q.z); // sort stabilny — w obrębie warstwy kolejność dodania
    if (useHand) this.lastHand = item;
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
      box: bounds(list.flat()),
      from: plan.from,
      to: plan.to,
      tool: { type: 'pencil', color: o.color ?? 'pen' },
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

  /** Zamalowanie kredką w kolorze — ręka jedzie środkiem kolorowanego pasa. */
  crayon(poly, o = {}) {
    // domyślne kreskowanie motywu (np. 45° w blueprincie) — ślad ręki musi iść tym samym zygzakiem
    if (this.theme) o = { ...resolveTheme(this.theme).crayon, ...o };
    const b = bounds(poly);
    const from = crayonTrace(poly, 0, o), to = crayonTrace(poly, 1, o);
    return this.#add('crayon', o.dur ?? clamp(0.35 + Math.sqrt(b.w * b.h) / 400, 0.4, 1.4), { ease: 'inOut', ...o }, (sk, p) => {
      sk.crayon(poly, p, o);
    }, {
      from: [from.x, from.y],
      to: [to.x, to.y],
      box: b,
      // 'crayon': motyw może dać do koloru inne narzędzie (pędzel, marker); domyślnie kredka
      tool: { type: 'crayon', color: o.color ?? 'teal' },
      trace: (sk, p) => crayonTrace(poly, p, o),
    });
  }

  /**
   * Kryjące wypełnienie — zamalowane szerokim pisakiem, pas po pasie;
   * po skończeniu dokładnie płaskie.
   */
  fill(poly, o = {}) {
    const so = SOLID({ seed: 7, ...o, color: o.color ?? 'paper' });
    const b = bounds(poly);
    const from = crayonTrace(poly, 0, so), to = crayonTrace(poly, 1, so);
    return this.#add('fill', o.dur ?? clamp(0.3 + Math.sqrt(b.w * b.h) / 500, 0.35, 1.2), { ease: 'inOut', ...o }, (sk, p) => {
      if (p >= 1) sk.fill(poly, so.color, o.alpha ?? 1);
      else sk.crayon(poly, p, { ...so, alpha: o.alpha ?? 1 });
    }, {
      from: [from.x, from.y],
      to: [to.x, to.y],
      box: b,
      tool: { type: 'marker', color: so.color },
      trace: (sk, p) => crayonTrace(poly, p, so),
    });
  }

  /**
   * "Napełnianie" kształtu — ręka koloruje warstwami od dołu; po skończeniu
   * powierzchnia delikatnie faluje.
   */
  liquid(poly, o = {}) {
    const b = bounds(poly);
    const level = o.level ?? 1;
    const rows = Math.max(2, Math.round((b.h * level) / 14));
    const at = (p) => {
      const y = b.y + b.h - b.h * level * p;
      const x = b.cx + Math.sin(p * rows * Math.PI) * b.w * 0.28 * (1 - 0.6 * p);
      return { x, y, angle: 0, lift: 0 };
    };
    return this.#add('liquid', o.dur ?? clamp(0.4 + rows * 0.08, 0.5, 2), { ease: 'inOut', ...o }, (sk, p) => sk.liquid(poly, p * level, o), {
      from: [at(0).x, at(0).y],
      to: [at(1).x, at(1).y],
      box: b,
      tool: { type: 'pencil', color: o.color ?? 'sky' },
      trace: (sk, p) => at(p),
    });
  }

  highlight(pts, width = 22, o = {}) {
    return this.#add('highlight', o.dur ?? 0.6, o, (sk, p) => sk.highlight(pts, width, p, o), {
      from: pts[0],
      to: pts[pts.length - 1],
      box: (() => { const b = bounds(pts); return { x: b.x - width / 2, y: b.y - width / 2, w: b.w + width, h: b.h + width }; })(),
      tool: { type: 'marker', color: o.color ?? 'ochre' },
      trace: (sk, p) => {
        const f = p * (pts.length - 1);
        const i = Math.min(pts.length - 2, Math.floor(f));
        const k = f - i;
        return { x: lerp(pts[i][0], pts[i + 1][0], k), y: lerp(pts[i][1], pts[i + 1][1], k) + width * 0.15, angle: 0, lift: 0 };
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
    // droga ręki rośnie proporcjonalnie do wielkości liter — kalibracja z pomiarów
    // minimalnego czasu (lint w przeglądarce): ~0,0019 s na znak i piksel wysokości
    // tempo sceny (`speed`) dotyczy kresek; pismo ma własne tempo — zmienia je tylko o.speed
    // writeScale motywu: czcionki o bardziej złożonych literach pisze się wolniej
    const scale = this.theme ? resolveTheme(this.theme).writeScale ?? 1 : 1;
    const est = scale * (0.1 + chars * (0.012 + size * 0.0019) + (String(text).split(/\s+/).length - 1) * 0.08) * ((PEN_SPEED / (o.speed ?? PEN_SPEED)) || 1);
    const dur = o.dur ?? clamp(est, 0.3, 8);
    // szacunek szerokości linii (pismo odręczne ~0,4 em na znak); dokładny ślad liczy się przy rysowaniu
    const lines = String(text).split('\n');
    const w = Math.max(...lines.map((l) => l.length)) * size * 0.4;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const wo = { ...o, fit: dur };
    return this.#add('write', dur, { ease: 'linear', ...o }, (sk, p) => sk.write(text, x, y, p, wo), {
      from: [x0 + size * 0.1, y - size * 0.45],
      to: [x0 + w * 0.95, y - size * 0.3 + (lines.length - 1) * size * (o.lineHeight ?? 1.15)],
      box: { x: x0, y: y - size * 0.8, w, h: size * (1.05 + (lines.length - 1) * (o.lineHeight ?? 1.15)) },
      tool: { type: 'pencil', color: o.color ?? 'ink' },
      trace: (sk, p) => sk.writeTrace(text, x, y, p, wo),
    });
  }

  /** Kropka — ręka stawia ją małym kółkiem. */
  dot(x, y, r, o = {}) {
    const at = (p) => {
      const a = p * Math.PI * 3;
      return { x: x + Math.cos(a) * r * 0.45 * (1 - p * 0.5), y: y + Math.sin(a) * r * 0.45 * (1 - p * 0.5), angle: 0, lift: 0 };
    };
    return this.#add('dot', o.dur ?? clamp(0.15 + r * 0.02, 0.18, 0.5), { ease: 'out', ...o }, (sk, p) => sk.dot(x, y, r * Math.sqrt(p), o.color ?? 'pen', o.alpha ?? 1), {
      from: [at(0).x, at(0).y],
      to: [at(1).x, at(1).y],
      box: { x: x - r, y: y - r, w: 2 * r, h: 2 * r },
      tool: { type: 'pencil', color: o.color ?? 'pen' },
      trace: (sk, p) => at(p),
    });
  }

  /**
   * Element "wyskakujący" — rysowany przez fn(sk, t) w skali rosnącej od 0.
   * To efekt magiczny (bez ręki): lint go zgłosi, chyba że podasz magic: true.
   */
  pop(x, y, fn, o = {}) {
    return this.#add('pop', o.dur ?? 0.45, o, (sk, p, t) => {
      if (p <= 0) return;
      sk.group({ x, y, scale: Math.max(0, p) }, () => fn(sk, t));
    });
  }

  /**
   * Dowolne rysowanie: fn(sk, p, t) — p to postęp tego kroku.
   * Ręka prowadzi rysunek, jeśli podasz o.trace(p) => {x, y, tool?} (opcjonalnie o.from/o.to, o.tool).
   * Animacja otoczenia, która niczego nie rysuje (np. para nad narysowanym kubkiem): o.ambient = true.
   * Wskazówka: elementy, które animują się bez końca, daj na osobną warstwę (np. z: 1) —
   * wtedy nie przerywają buforowania ukończonych kresek pod nimi.
   */
  custom(fn, o = {}) {
    const hand = o.trace && {
      from: o.from ?? (() => { const a = o.trace(0); return [a.x, a.y]; })(),
      to: o.to ?? (() => { const a = o.trace(1); return [a.x, a.y]; })(),
      tool: o.tool ?? { type: 'pencil', color: o.color ?? 'pen' },
      trace: (sk, p) => o.trace(p),
    };
    return this.#add('custom', o.dur ?? 1, o, fn, hand);
  }

  /**
   * Zdanie lektora (beat z Voice) i rysunek, który mu towarzyszy.
   * Głos startuje `lead` s po tym, jak ręka zacznie rysować (obraz lekko wyprzedza
   * słowo). Kroki dodane w `build` idą po kolei; krok z opcją `cue: 'słowo'` czeka
   * na to słowo. Następne zdanie zaczyna się dopiero, gdy skończy się i głos,
   * i rysunek — jeśli rysunek jest dłuższy niż zdanie, powstaje pauza
   * (lint ostrzeże, gdy przekracza ~1 s).
   * @param {import('./narration.js').Beat} beat
   * @param {(beat) => void} [build]
   * @param {object} o lead (0.3 s), after (pauza po zdaniu, 0.25 s), gap (przed zdaniem),
   *                   maxWait (1,5 s — o ile lektor może poczekać na rękę), voiceWaits (false = nie czekaj)
   *
   * Lektor czeka na rękę: jeśli rysunek nie zdąży na swoje słowo (`cue`), zdanie
   * zaczyna się odpowiednio później (maks. maxWait) — tak pracuje rysownik z lektorem.
   */
  say(beat, build, o = {}) {
    const lead = o.lead ?? 0.3;
    const maxWait = o.maxWait ?? 1.5;
    // stan do wycofania, gdy trzeba przesunąć głos (lektor czeka na rękę)
    const snap = {
      names: new Set(this.items.map((it) => it.name)), segs: new Set(this.tl.segments.keys()), cursor: this.tl.cursor,
      lastHand: this.lastHand, n: this.n, cams: new Set(this.cams), clears: this.clears.length, chapter: this.chapter, audio: this.audio.length,
    };
    const rollback = () => {
      this.items = this.items.filter((it) => snap.names.has(it.name));
      for (const k of [...this.tl.segments.keys()]) if (!snap.segs.has(k)) this.tl.segments.delete(k);
      this.tl.cursor = snap.cursor;
      this.lastHand = snap.lastHand;
      this.n = snap.n;
      this.cams = this.cams.filter((c) => snap.cams.has(c));
      this.clears.length = snap.clears;
      this.chapter = snap.chapter;
      this.audio.length = snap.audio;
      this.hand = null;
    };
    let wait = 0;
    for (let attempt = 0; ; attempt++) {
      const start = snap.cursor + (o.gap ?? 0) + lead + wait;
      const clip = { id: beat.id, src: beat.src, start, dur: beat.duration, text: beat.text, words: beat.words, wait };
      this.audio.push(clip);
      const outer = this.beat;
      this.beat = { ...clip, beat, lead };
      this.tl.cursor += o.gap ?? 0;
      build?.(beat);
      this.beat = outer;
      const mine = this.items.filter((it) => !snap.names.has(it.name));
      // o ile pierwsza kotwica spóźnia się względem swojego słowa — o tyle przesuwamy głos
      // (kolejnych kotwic w tym samym zdaniu przesunięcie nie naprawi: słowa padają
      // szybciej, niż ręka rysuje to, co między nimi — to zgłasza lint)
      const firstCue = mine.filter((it) => it.cue).sort((p, q) => p.seg.start - q.seg.start)[0];
      const late = firstCue ? Math.max(0, firstCue.seg.start - firstCue.cue.target) : 0;
      if (late > 0.12 && wait + late <= maxWait && attempt < 3 && o.voiceWaits !== false) {
        rollback();
        wait += late;
        continue;
      }
      clip.drawEnd = mine.reduce((m, it) => Math.max(m, it.seg.start + it.seg.dur), start);
      this.tl.cursor = Math.max(this.tl.cursor, start + beat.duration + (o.after ?? 0.25));
      return this;
    }
  }

  /** Napisy z lektora: 'srt' | 'vtt' | 'cues' (tablica). */
  subtitles(format = 'srt', opts) {
    const cues = subtitleCues(this.audio, opts);
    return format === 'vtt' ? toVTT(cues) : format === 'cues' ? cues : toSRT(cues);
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

  /**
   * Starcie tablicy gąbką i nowy rozdział. Gąbka przechodzi pionowymi pasami
   * (w dół, w górę, …) — zmazane jest dokładnie to, przez co przeszła.
   */
  clear(o = {}) {
    // czas: długość trasy gąbki przy ~2000 px/s (fizyka i tak pilnuje limitu)
    const dur = o.dur ?? this.#eraser(this.cameraAt(this.tl.cursor), 0).length / 2000;
    const chapter = this.chapter;
    const name = o.name ?? `clear#${this.n++}`;
    const at = (p, t) => this.#eraser(this.cameraAt(t), p);
    const start = at(0, this.tl.cursor);
    // przerwa na przelot ręki do gąbki liczy się automatycznie (handGaps)
    const gap = o.gap ?? (this.lastHand && this.handGaps ? undefined : 0.2);
    this.#add('clear', dur, { ...o, gap, name, ease: 'linear' }, () => {}, {
      from: [start.x, start.y],
      to: null,
      tool: { type: 'eraser' },
      trace: (sk, p, t) => {
        const e = at(p, t);
        return { x: e.x, y: e.y, angle: 0, lift: 0, width: e.width };
      },
    });
    const item = this.items.find((it) => it.name === name);
    const end = at(1, item.seg.start + item.seg.dur);
    item.to = [end.x, end.y];
    this.clears.push({ item, chapter });
    this.chapter++;
    return this;
  }

  get duration() {
    let d = this.tl.duration;
    for (const c of this.cams) d = Math.max(d, c.start + c.dur);
    for (const c of this.audio) d = Math.max(d, c.start + c.dur);
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
      theme: this.theme,
      fonts: this.captions ? { captions: this.captions.font ?? CAPTION_FONT } : undefined,
      audio: this.audio.map(({ src, start, dur }) => ({ src, start, dur })),
      subtitles: (format, opts) => this.subtitles(format, opts),
      draw: (sk, t) => this.draw(sk, t),
    };
  }

  /** Ciągła trajektoria ręki (budowana raz, po wczytaniu czcionek). */
  handTrack(sk) {
    if (this.hand) return this.hand;
    this.hand = this.#buildTrack(sk);
    if (this.warn && !this.warned && typeof console !== 'undefined') {
      this.warned = true;
      const issues = this.lint(sk);
      if (issues.length) console.warn(`Storyboard.lint: ${issues.length} problem(ów)\n` + issues.map((i) => `  ${i.name} (${i.time.toFixed(2)} s): ${i.problem}`).join('\n'));
    }
    return this.hand;
  }

  #buildTrack(sk) {
    const segs = this.items
      .filter((it) => it.hand && it.trace)
      .map((it) => ({
        name: it.name,
        item: it,
        start: it.seg.start,
        end: it.seg.start + it.seg.dur,
        tool: it.tool,
        trace: (t) => it.trace(sk, it.seg.ease(clamp((t - it.seg.start) / (it.seg.dur || 1))), t),
      }));
    const off = [this.w + 90, this.h + 110];
    return new HandTrack(segs, { enter: off, exit: off });
  }

  /**
   * Kontrola "fizyki" sceny. Zwraca listę problemów:
   *  - element pojawia się bez ręki (a nie jest ambient/magic),
   *  - ręka nie zdąży dojechać na początek kroku (część narysowałaby się sama),
   *  - krok rysowany w czasie, gdy ręka jest zajęta innym (równolegle).
   * @param {object} [sk] Sketch (dla dokładnego śladu pisma); bez niego — przybliżenie.
   */
  lint(sk, { tolerance = 0.06 } = {}) {
    const issues = [];
    const add = (it, problem) => issues.push({ name: it.name, kind: it.kind, time: it.seg.start, problem });
    for (const it of this.items) {
      if (!it.visible || it.hand || it.ambient || it.magic) continue;
      add(it, it.trace ? 'ręka wyłączona (pencil: false) — element pojawi się sam' : 'element bez ręki — pojawi się sam; dodaj trace albo oznacz ambient/magic');
    }
    const stub = {
      writeTrace: (text, x, y, p, o = {}) => ({ x: x + String(text).length * (o.size ?? 32) * 0.45 * p, y, angle: 0, lift: 0 }),
    };
    const hand = sk?.writeTrace ? (this.hand ?? this.#buildTrack(sk)) : this.#buildTrack(stub);
    // pismo: ślad liter znamy dopiero z prawdziwą czcionką — sprawdzamy tempo ręki tutaj
    if (sk?.writeTrace) {
      for (const it of this.items) {
        if (it.kind !== 'write' || !it.hand) continue;
        const min = minDuration((p) => it.trace(sk, p, it.seg.start), easing('linear'));
        if (min > it.seg.dur * 1.05) add(it, `pismo za szybkie dla ręki — potrzeba co najmniej ${min.toFixed(2)} s (jest ${it.seg.dur.toFixed(2)} s)`);
      }
    }
    for (const r of hand.report) {
      const it = r.seg.item;
      if (r.status === 'skipped') add(it, 'ręka zajęta innym krokiem — element narysowałby się sam (rysowanie równoległe)');
      else if (r.status === 'unreachable') add(it, 'ręka nie zdąży dojechać przed końcem kroku — element narysowałby się sam (dodaj gap)');
      else if (r.status === 'late' && r.late > tolerance) add(it, `ręka spóźniona o ${r.late.toFixed(2)} s — początek narysowałby się sam (dodaj gap lub usuń at/with)`);
    }
    // kompletność obiektu: kontur i jego wypełnienie to jedna czynność — rysownik,
    // który wie, że słońce będzie żółte, maluje je zaraz po obrysie, a nie wraca
    // do niego po narysowaniu czegoś innego
    for (const p of this.objectBreaks()) {
      add(p.item, `obiekt przerwany: między „${p.first.name}” a „${p.item.name}” (ten sam obiekt) narysowano „${p.between.name}” poza nim — dokończ obiekt od razu (kontur → kolor → detale) albo oznacz świadomy powrót revisit: true`);
    }
    // synchronizacja z lektorem (ostrzeżenia o tempie, nie błędy fizyki)
    const warn = (name, kind, time, problem) => issues.push({ name, kind, time, problem, level: 'warn' });
    for (const it of this.items) {
      if (it.cue && it.seg.start - it.cue.target > 0.35) {
        warn(it.name, it.kind, it.seg.start, `rysunek spóźniony o ${(it.seg.start - it.cue.target).toFixed(2)} s względem słowa „${it.cue.word}” (${it.cue.beat}) — za dużo rysunku przed nim`);
      }
    }
    // rolka: rysunek w strefie, którą zasłoni interfejs (nick, opis, przyciski)
    if (this.safe) {
      const z = this.safe;
      for (const it of this.items) {
        if (!it.visible || !it.box) continue;
        const b = it.box;
        if (b.x < z.x0 - 4 || b.y < z.y0 - 4 || b.x + b.w > z.x1 + 4 || b.y + b.h > z.y1 + 4) {
          warn(it.name, it.kind, it.seg.start, `poza bezpieczną strefą (${z.x0}–${z.x1} × ${z.y0}–${z.y1}) — interfejs aplikacji to zasłoni`);
        }
      }
    }
    for (const c of this.audio) {
      const lag = c.drawEnd - (c.start + c.dur);
      if (lag > 1.0) warn(c.id, 'say', c.start, `rysunek kończy się ${lag.toFixed(1)} s po zdaniu — następne zdanie czeka w ciszy (skróć rysunek albo dopisz zdanie)`);
    }
    for (const i of issues) i.level ??= 'error';
    return issues.sort((a, b) => a.time - b.time);
  }

  /**
   * Pary kontur–wypełnienie tego samego obiektu, między którymi ręka narysowała
   * coś innego poza obiektem. Obiekt = kontur (pen/strokes) + kolor (crayon/fill/liquid),
   * którego ramka leży w większości w ramce konturu (a kontur nie jest wielką ramą
   * na pół kadru). Elementy ze środkiem wewnątrz obiektu (napis w środku, bruzda,
   * kreska podziału) go nie przerywają.
   */
  objectBreaks() {
    const FILL = new Set(['crayon', 'fill', 'liquid']), LINE = new Set(['pen', 'strokes']);
    const list = this.items.filter((i) => i.visible && i.box && i.hand).sort((a, b) => a.seg.start - b.seg.start);
    const area = (b) => Math.max(1, b.w * b.h);
    const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    // a — wcześniejszy, b — późniejszy krok
    const partners = (a, b) => {
      // kontur, potem kolor: kolor leży w większości w ramce konturu
      if (LINE.has(a.kind) && FILL.has(b.kind)) return inter(a.box, b.box) >= 0.6 * area(b.box) && area(a.box) < 4 * area(b.box);
      // kolor, potem kontur: kontur musi pasować do koloru (kółko dookoła to już zaznaczenie, nowy obiekt)
      if (FILL.has(a.kind) && LINE.has(b.kind)) {
        const i = inter(a.box, b.box);
        return i / (area(a.box) + area(b.box) - i) >= 0.75;
      }
      return false;
    };
    const out = [];
    for (let k = 0; k < list.length; k++) {
      const b = list[k];
      if (b.revisit || !(FILL.has(b.kind) || LINE.has(b.kind))) continue;
      let j = k - 1;
      while (j >= 0 && !(list[j].chapter === b.chapter && partners(list[j], b))) j--;
      if (j < 0) continue;
      const a = list[j];
      const x0 = Math.min(a.box.x, b.box.x) - 10, y0 = Math.min(a.box.y, b.box.y) - 10;
      const x1 = Math.max(a.box.x + a.box.w, b.box.x + b.box.w) + 10, y1 = Math.max(a.box.y + a.box.h, b.box.y + b.box.h) + 10;
      const between = list.slice(j + 1, k).find((it) => {
        const cx = it.box.x + it.box.w / 2, cy = it.box.y + it.box.h / 2;
        return !(cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1);
      });
      if (between) out.push({ first: a, item: b, between });
    }
    return out;
  }

  draw(sk, t) {
    const { ctx } = sk;
    const cam = this.cameraAt(t);

    // który rozdział jest widoczny i czy trwa ścieranie
    let wipe = null;
    let visibleChapter = 0;
    for (const c of this.clears) {
      const s = c.item.seg;
      if (t >= s.start + s.dur) visibleChapter = c.chapter + 1;
      else if (t >= s.start) wipe = { q: clamp((t - s.start) / s.dur) };
    }

    const main = [];
    const kept = [];
    for (const it of this.items) {
      if (!it.visible) continue;
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

    // bufor: ukończone elementy kopiujemy z bitmapy (osobnej dla każdej wersji
    // drgania kreski), na bieżąco rysujemy tylko resztę
    const camKey = `${cam.x.toFixed(2)},${cam.y.toFixed(2)},${cam.zoom.toFixed(4)}`;
    const camStill = camKey === this.lastCamKey;
    this.lastCamKey = camKey;
    const canCache = this.useCache && camStill && typeof document !== 'undefined' && ctx.canvas?.width > 0 && !this.background;

    const base = ctx.getTransform();
    sk.base = base; // occlude() odmalowuje tło (siatkę, tablicę) w układzie sceny
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

    const W = ctx.canvas?.width ?? 0, H = ctx.canvas?.height ?? 0;
    // osobna bitmapa na każdą wersję drgania (gdy płótno nie jest ogromne)
    const slot = W * H <= 4.2e6 ? sk.boil : 0;
    groups.forEach((g, gi) => {
      let k = 0;
      while (k < g.items.length && settled(g.items[k])) k++;
      const withPaper = gi === 0 && this.paper;
      if (canCache && (k > 0 || withPaper)) {
        // klucz bez liczby elementów: gdy przybywa ukończonych elementów, tylko je dorysowujemy
        const key = `${visibleChapter}|${sk.boil}|${camKey}|${W}x${H}|${base.a.toFixed(4)},${base.e.toFixed(1)},${base.f.toFixed(1)}`;
        const slots = (this.caches[gi] ??= []);
        const c = (slots[slot] ??= { canvas: document.createElement('canvas'), key: null, k: 0 });
        if (c.key !== key || c.k > k) {
          c.canvas.width = W;
          c.canvas.height = H;
          c.k = 0;
          c.fresh = true;
        }
        if (c.fresh || c.k < k) {
          const cc = c.canvas.getContext('2d');
          cc.setTransform(base);
          sk.ctx = cc;
          try {
            if (c.fresh && withPaper) sk.paper(this.w, this.h);
            cc.save();
            applyCam(cc);
            for (let i = c.k; i < k; i++) drawItem(g.items[i]);
            cc.restore();
          } finally {
            sk.ctx = ctx;
          }
          c.key = key;
          c.k = k;
          c.fresh = false;
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
    if (wipe) this.#wipe(sk, cam, wipe.q);
    kept.forEach(drawItem);

    // ręka — dopiero gdy czcionki są gotowe (ślad pisma zależy od kształtu liter)
    if (this.usePencil && sk.fontsReady !== false && sk.writeTrace) {
      const hand = this.handTrack(sk);
      const pos = hand.at(t);
      if (pos) {
        const prev = hand.at(t - 1 / 30) ?? pos;
        const vx = (pos.x - prev.x) * 30;
        const tool = pos.tool ?? { type: 'pencil' };
        sk.tool(pos.x, pos.y, {
          type: tool.type,
          color: tool.color,
          width: pos.width ?? this.#eraser(cam, 0).width,
          size: tool.type === 'eraser' ? 1 : 0.9 / cam.zoom ** 0.3,
          lift: pos.lift ?? 0,
          lean: -clamp(vx / 4000, -0.22, 0.22),
        });
      }
    }
    ctx.restore();
    // napisy rolkowe: warstwa interfejsu nad tablicą (bez kamery i bez ręki — to nie rysunek)
    if (this.captions && this.audio.length) {
      ctx.save();
      ctx.setTransform(base);
      this.#drawCaptions(sk, t);
      ctx.restore();
    }
  }

  /** Porcja napisu na czas t: 2–3 słowa, słowo mówione podświetlone i lekko powiększone. */
  #drawCaptions(sk, t) {
    const o = this.captions;
    this.reelCues ??= reelCues(this.audio, o);
    const cue = this.reelCues.find((c) => t >= c.start && t <= c.end);
    if (!cue) return;
    const { ctx } = sk;
    const size = o.size ?? Math.round(this.w * 0.078);
    const font = `${o.weight ?? 700} ${size}px ${o.font ?? CAPTION_FONT}`;
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    // odstęp między słowami: część czcionek ma prawie zerową spację
    const space = Math.max(ctx.measureText(' ').width, size * 0.4);
    const pop = 0.86 + 0.14 * ease.out(clamp((t - cue.start) / 0.12));
    // każde słowo z własną skalą (mówione większe); układ liczony po skali, żeby nic nie nachodziło
    const words = cue.words.map((w) => {
      const text = o.upper === false ? w.w : w.w.toUpperCase();
      const active = t >= w.s - 0.05 && t <= w.e + 0.05;
      const k = (active ? 1.1 : 1) * pop;
      return { text, active, k, width: ctx.measureText(text).width * k };
    });
    // zawijanie do szerokości strefy bezpiecznej
    const maxW = (this.safe ? this.safe.x1 - this.safe.x0 : this.w) * 0.94;
    const lines = [[]];
    let lw = 0;
    for (const w of words) {
      if (lines[lines.length - 1].length && lw + space + w.width > maxW) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(w);
      lw += (lw ? space : 0) + w.width;
    }
    const cx = this.safe ? (this.safe.x0 + this.safe.x1) / 2 : this.w / 2;
    const y0 = o.y ?? (this.safe ? this.safe.y1 + 70 : this.h * 0.86);
    lines.forEach((ln, li) => {
      const width = ln.reduce((a, w) => a + w.width, 0) + space * (ln.length - 1);
      let x = cx - width / 2;
      const y = y0 + (li - (lines.length - 1) / 2) * size * 1.08;
      for (const w of ln) {
        ctx.save();
        ctx.translate(x, y - size * 0.35 * (w.k - 1));
        ctx.scale(w.k, w.k);
        ctx.lineWidth = size * 0.15;
        ctx.strokeStyle = o.stroke ?? '#111111';
        ctx.strokeText(w.text, 0, 0);
        ctx.fillStyle = w.active ? o.highlight ?? '#ffd23f' : o.color ?? '#ffffff';
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
        x += w.width + space;
      }
    });
  }

  /**
   * Geometria gąbki dla postępu p: ciągła trasa zygzakiem — pas w dół, przesunięcie
   * w bok, pas w górę, … — ze stałą prędkością (łagodny start i koniec całości).
   */
  #eraser(cam, p) {
    const vw = this.w / cam.zoom, vh = this.h / cam.zoom;
    const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
    const band = vw / ERASE_PASSES;
    // gąbka zawsze w kadrze (filc sięga do krawędzi), zmazany pas obejmuje całą wysokość
    const top = y0 + 22, bottom = y0 + vh - 22;
    const V = bottom - top, S = band;
    const L = ERASE_PASSES * V + (ERASE_PASSES - 1) * S;
    const s = ease.sine(clamp(p)) * L;
    const k = Math.min(ERASE_PASSES - 1, Math.floor(s / (V + S)));
    const r = s - k * (V + S);
    const down = k % 2 === 0;
    const q = Math.min(1, r / V); // postęp pionowy w pasie k
    const side = r > V ? (r - V) / S : 0; // przesunięcie w bok do pasa k+1
    return {
      x0, y0, vw, vh, band, k, q, top, bottom, down, length: L,
      x: x0 + band * (k + 0.5 + side),
      y: down ? lerp(top, bottom, q) : lerp(bottom, top, q),
      width: band + 24,
    };
  }

  /** Zmazany obszar = pasy, przez które przeszła gąbka (z lekko poszarpanymi brzegami). */
  #wipe(sk, cam, q) {
    const e = this.#eraser(cam, q);
    const strip = (xa, xb, ya, yb, seed) => {
      const poly = [];
      for (let y = ya; y <= yb; y += 24) poly.push([xa + noise1(seed + y * 0.03) * 5, y]);
      poly.push([xa, yb]);
      for (let y = yb; y >= ya; y -= 24) poly.push([xb + noise1(seed + 9 + y * 0.03) * 5, y]);
      poly.push([xb, ya]);
      sk.occlude(poly);
    };
    const y0 = e.y0 - 40, y1 = e.y0 + e.vh + 40;
    for (let i = 0; i < e.k; i++) {
      const cx = e.x0 + e.band * (i + 0.5);
      strip(cx - e.band / 2 - 8, cx + e.band / 2 + 8, y0, y1, i * 7);
    }
    // bieżący pas: od krawędzi, z której gąbka ruszyła, do jej filcu
    const cx = e.x0 + e.band * (e.k + 0.5);
    const reach = e.q >= 1 ? (e.down ? y1 : y0) : e.y + (e.down ? 15 : -15);
    if (e.down) strip(cx - e.band / 2 - 8, cx + e.band / 2 + 8, y0, reach, e.k * 7);
    else strip(cx - e.band / 2 - 8, cx + e.band / 2 + 8, reach, y1, e.k * 7);
  }
}
