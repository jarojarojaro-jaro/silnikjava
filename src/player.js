// Player — podpina scenę pod <canvas>: skalowanie do rozmiaru elementu i DPR,
// pętla requestAnimationFrame, start po wejściu w kadr, pauza/przewijanie,
// animacja "idle" po zakończeniu intro i respektowanie prefers-reduced-motion.
//
// Scena to zwykły obiekt:
//   {
//     w, h,                  // logiczny rozmiar (układ współrzędnych rysunku)
//     duration,              // długość animacji wejścia [s]
//     idle: 'boil'|'loop'|'still'|'restart',
//     fps,                   // limit klatek dla idle 'loop' (oszczędza baterię)
//     draw(sk, t, state),    // rysuje klatkę dla czasu t (bez stanu!)
//   }

import { Sketch, BOIL_FPS, BOIL_CYCLE, loadFonts, fontsLoaded } from './sketch.js';
import { AudioTrack } from './audio.js';

const ticks = new Set();
let rafId = 0;
function loop(now) {
  rafId = ticks.size ? requestAnimationFrame(loop) : 0;
  ticks.forEach((fn) => fn(now));
}
function subscribe(fn) {
  ticks.add(fn);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => ticks.delete(fn);
}

export class Player {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} scene
   * @param {object} o trigger ('mount'|'view'|'manual'), delay [s], speed, fit ('contain'|'cover'),
   *                   maxDpr, state (obiekt przekazywany do draw), sketch (opcje Sketch),
   *                   onTime(t) — callback co klatkę, restartPause [s] dla idle 'restart',
   *                   audio (false = bez dźwięku, nawet jeśli scena ma lektora)
   */
  constructor(canvas, scene, o = {}) {
    this.canvas = canvas;
    this.scene = scene;
    this.o = { trigger: 'mount', delay: 0, speed: 1, fit: 'contain', maxDpr: 2, restartPause: 1.5, ...o };
    this.state = this.o.state ?? {};
    this.ctx = canvas.getContext('2d');
    this.sk = new Sketch(this.ctx, { theme: scene.theme, ...this.o.sketch });
    this.t = 0;
    this.playing = false;
    this.inView = true;
    this.lastNow = null;
    this.lastBoil = -1;
    this.lastDraw = 0;
    this.dirty = true;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canvas.style.aspectRatio && !canvas.getAttribute('height')) {
      canvas.style.aspectRatio = `${scene.w} / ${scene.h}`;
      if (!canvas.style.width) canvas.style.width = '100%';
    }
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => { this.resize(); this.dirty = true; });
      this.ro.observe(canvas);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((es) => {
        for (const e of es) {
          this.inView = e.isIntersecting;
          if (this.inView && this.o.trigger === 'view' && !this.started) this.#start();
        }
      }, { threshold: 0.15 });
      this.io.observe(canvas);
    }
    // gotowość czcionek — po ich wczytaniu przerysowujemy klatkę. loadFonts czeka
    // najwyżej 2,5 s; czcionka, która dojdzie później, zmienia kształt liter, więc
    // ślad ręki przy piśmie i bufory klatek liczymy wtedy od nowa
    const fonts = { ...this.sk.fonts, ...(scene.fonts ?? {}) };
    this.sk.fontsReady = false;
    this.ready = loadFonts(fonts).then(() => { this.sk.fontsReady = true; this.dirty = true; });
    this.loaded = Promise.all([this.ready, fontsLoaded(fonts)]).then(() => {
      scene.storyboard?.invalidate();
      this.dirty = true;
    });
    // lektor: scena z klipami audio (Storyboard.say) dostaje ścieżkę dźwiękową
    this.audio = this.o.audio === false || !scene.audio?.length ? null : new AudioTrack(scene.audio);
    this.unsub = subscribe((now) => this.#tick(now));
    if (this.o.trigger === 'mount') this.#start();
    else this.render();
  }

  #start() {
    this.started = true;
    if (this.reduced) {
      this.t = this.duration;
      this.dirty = true;
      return;
    }
    this.t = -this.o.delay;
    this.play();
  }

  get duration() {
    return this.scene.duration ?? 0;
  }

  play() {
    this.started = true;
    if (this.t >= this.duration && this.scene.idle !== 'loop' && this.scene.idle !== 'boil') this.t = 0;
    this.playing = true;
    this.lastNow = null;
    // dźwięk startuje od bieżącego czasu (przeglądarka wymaga gestu — wołaj play() z kliknięcia)
    if (this.audio && this.o.speed === 1) {
      // obraz czeka, aż dźwięk się wczyta i ruszy — start równo z głosem
      this.waitAudio = true;
      this.audio.play(Math.max(0, this.t)).then(() => {
        this.waitAudio = false;
        this.lastNow = null;
      });
    }
    return this;
  }

  pause() {
    this.playing = false;
    this.audio?.stop();
    return this;
  }

  toggle() {
    return this.playing ? this.pause() : this.play();
  }

  /** Przewija do czasu t (w sekundach) i rysuje klatkę. */
  seek(t) {
    this.t = t;
    this.started = true;
    this.dirty = true;
    this.render();
    if (this.audio?.playing) this.audio.play(Math.max(0, t));
    return this;
  }

  resize() {
    const c = this.canvas;
    const cw = c.clientWidth || this.scene.w;
    const ch = c.clientHeight || (cw * this.scene.h) / this.scene.w;
    this.dpr = Math.min(this.o.maxDpr, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
    const W = Math.round(cw * this.dpr), H = Math.round(ch * this.dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const fit = this.o.fit === 'cover' ? Math.max : Math.min;
    this.scale = fit(cw / this.scene.w, ch / this.scene.h);
    this.ox = (cw - this.scene.w * this.scale) / 2;
    this.oy = (ch - this.scene.h * this.scale) / 2;
  }

  /** Deterministycznie rysuje klatkę dla czasu t (używane też przy eksporcie wideo). */
  renderAt(t) {
    const { ctx, sk, dpr } = this;
    sk.time = t;
    const boilIdx = this.scene.boil === false ? 0 : Math.floor(Math.max(0, t) * BOIL_FPS);
    sk.boil = boilIdx % BOIL_CYCLE;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.ox, dpr * this.oy);
    sk.base = ctx.getTransform();
    this.scene.draw(sk, Math.max(0, t), this.state);
    this.lastBoil = boilIdx;
  }

  render() {
    this.renderAt(this.sceneTime());
    this.dirty = false;
  }

  /** Czas przekazywany scenie — uwzględnia tryb idle 'restart'. */
  sceneTime() {
    if (this.scene.idle === 'restart' && this.t > this.duration) {
      return this.t % (this.duration + this.o.restartPause);
    }
    return this.t;
  }

  #tick(now) {
    if (!this.inView) { this.lastNow = null; return; }
    if (this.playing && this.waitAudio) return;
    if (this.playing) {
      const dt = this.lastNow == null ? 0 : Math.min(0.1, (now - this.lastNow) / 1000);
      this.lastNow = now;
      // gdy gra lektor, zegarem jest dźwięk — obraz nie odjeżdża od głosu
      if (this.audio?.playing) this.t = this.audio.time();
      else this.t += dt * this.o.speed;
      const idle = this.scene.idle ?? 'boil';
      if (this.t > this.duration) {
        if (idle === 'still') {
          this.t = this.duration;
          this.playing = false;
          this.dirty = true;
        } else if (idle === 'boil') {
          // po intro przerysowujemy tylko, gdy zmienia się klatka "drgania"
          if (Math.floor(this.t * BOIL_FPS) === this.lastBoil && !this.dirty) return this.o.onTime?.(this.t);
        } else if (idle === 'loop' && this.scene.fps) {
          if (now - this.lastDraw < 1000 / this.scene.fps - 2 && !this.dirty) return this.o.onTime?.(this.t);
        }
      }
      if (this.t < 0) return;
      this.lastDraw = now;
      this.render();
      this.o.onTime?.(this.t);
    } else if (this.dirty) {
      this.render();
      this.o.onTime?.(this.t);
    }
  }

  destroy() {
    this.audio?.stop();
    this.unsub?.();
    this.ro?.disconnect();
    this.io?.disconnect();
  }
}

/**
 * Animacja sterowana scrollem: postęp przewinięcia elementu `track` mapowany
 * na czas sceny (jak rysunek budujący się w trakcie przewijania listy).
 * @param {Player} player
 * @param {HTMLElement} track element, przez który się przewija (np. wysoka sekcja ze sticky canvasem)
 * @param {object} o smooth (0..1, wygładzanie), from/to — zakres czasu sceny,
 *                   map(progress) — własne mapowanie postępu 0..1 na czas sceny,
 *                   sticky (false = postęp liczony od wejścia do wyjścia sekcji z ekranu)
 */
export function scrollDrive(player, track, o = {}) {
  const smooth = o.smooth ?? 0.18;
  const from = o.from ?? 0;
  const to = o.to ?? player.duration;
  player.pause();
  let target = from;
  let current = null;
  const measure = () => {
    const r = track.getBoundingClientRect();
    const vh = innerHeight;
    // sticky: 0 gdy góra sekcji dotyka góry ekranu, 1 gdy dół sekcji dotyka dołu ekranu
    // przelot: 0 gdy sekcja wchodzi od dołu, 1 gdy znika u góry
    const raw = o.sticky === false ? (vh - r.top) / (r.height + vh) : -r.top / Math.max(1, r.height - vh);
    const q = Math.max(0, Math.min(1, raw));
    target = o.map ? o.map(q) : from + q * (to - from);
  };
  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', measure);
  measure();
  const unsub = subscribe(() => {
    if (current !== null && Math.abs(target - current) < 1e-3) return;
    current = current === null ? target : current + (target - current) * smooth;
    if (Math.abs(target - current) < 1e-3) current = target;
    player.seek(current);
    o.onProgress?.((current - from) / (to - from || 1));
  });
  return () => {
    unsub();
    removeEventListener('scroll', measure);
    removeEventListener('resize', measure);
  };
}
