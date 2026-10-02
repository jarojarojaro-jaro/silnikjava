// Oś czasu: nazwane odcinki [start, start+dur] z easingiem.
// Używana bezpośrednio w ręcznie pisanych scenach (tl.p('tablica', t))
// albo pośrednio przez Storyboard.

import { clamp, easing } from './math.js';

export class Timeline {
  constructor() {
    this.segments = new Map();
    this.cursor = 0; // gdzie wstawić następny odcinek "po kolei"
  }

  /**
   * Dodaje odcinek.
   * @param {string} name
   * @param {number} dur czas trwania [s]
   * @param {object} o  at (liczba albo nazwa — start razem z nią), after (nazwa — po jej końcu),
   *                    with (nazwa — razem z nią), gap (przesunięcie), ease
   */
  add(name, dur, o = {}) {
    const start = this.resolveStart(o);
    const seg = { name, start, dur: Math.max(0, dur), ease: easing(o.ease ?? 'inOut') };
    this.segments.set(name, seg);
    // odcinki "równoległe" (at/with) nie cofają kursora; sekwencyjne ustawiają go na swój koniec
    const parallel = o.at != null || o.with != null;
    this.cursor = parallel ? Math.max(this.cursor, start + seg.dur) : start + seg.dur;
    return this;
  }

  resolveStart(o) {
    const gap = o.gap ?? 0;
    const ref = (n) => {
      const s = this.segments.get(n);
      if (!s) throw new Error(`Timeline: nie ma odcinka "${n}"`);
      return s;
    };
    if (typeof o.at === 'number') return o.at + gap;
    if (typeof o.at === 'string') return ref(o.at).start + gap;
    if (o.with != null) return ref(o.with).start + gap;
    if (o.after != null) return ref(o.after).start + ref(o.after).dur + gap;
    return this.cursor + gap;
  }

  /** Pauza na osi czasu. */
  wait(sec) {
    this.cursor += sec;
    return this;
  }

  /** Znacznik w aktualnym miejscu (odcinek zerowej długości). */
  mark(name) {
    this.segments.set(name, { name, start: this.cursor, dur: 0, ease: easing('linear') });
    return this;
  }

  has(name) {
    return this.segments.has(name);
  }

  get(name) {
    return this.segments.get(name);
  }

  /** Surowy postęp 0..1 (bez easingu). */
  raw(name, t) {
    const s = this.segments.get(name);
    if (!s) return 0;
    if (s.dur === 0) return t >= s.start ? 1 : 0;
    return clamp((t - s.start) / s.dur);
  }

  /** Postęp z easingiem. */
  p(name, t) {
    const s = this.segments.get(name);
    if (!s) return 0;
    return s.ease(this.raw(name, t));
  }

  start(name) {
    return this.segments.get(name)?.start ?? 0;
  }

  end(name) {
    const s = this.segments.get(name);
    return s ? s.start + s.dur : 0;
  }

  get duration() {
    let d = this.cursor;
    for (const s of this.segments.values()) d = Math.max(d, s.start + s.dur);
    return d;
  }
}
