// Model ręki rysownika.
//
// StrokePlan — jak ręka rysuje zestaw kresek: każda kreska ma własny profil
//   prędkości (powolny start i koniec — "minimum jerk"), zwalnia na zakrętach,
//   a między kreskami ołówek się podnosi i przelatuje łukiem. Czas rośnie
//   wolniej niż długość (długie kreski rysujemy szybciej).
//
// HandTrack — ciągła trajektoria ołówka przez cały film. Zbiera ślady
//   wszystkich kroków (trace) i układa harmonogram: prowadzenie kreski,
//   przelot do następnej, spoczynek obok rysunku, wejście i zejście z kadru.
//   Ołówek nigdy nie teleportuje się ani nie znika w trakcie filmu.
//
// Wszystko jest bezstanowe: pozycja ręki to funkcja czasu, więc działa
// przewijanie, scroll i deterministyczny eksport klatek.

import { clamp, lerp, ease } from './math.js';
import { pathInfo } from './paths.js';

export const HAND = {
  speed: 650, // px/s przy pełnej prędkości ręki
  startStop: 0.05, // [s] narzut na rozpoczęcie/zakończenie kreski
};

/** Profil "minimum jerk" (Flash & Hogan) zmieszany z liniowym, żeby kreska nie startowała od zera. */
export const minJerk = (t) => 0.8 * (t * t * t * (10 - 15 * t + 6 * t * t)) + 0.2 * t;

/** Czas narysowania kreski o długości efektywnej L [px]. */
export function drawTime(effLen, speed = HAND.speed, startStop = HAND.startStop) {
  return startStop + (effLen / speed) * Math.pow(200 / Math.max(effLen, 40), 0.25);
}

/** Czas przelotu ręki nad kartką na odległość d [px] (podniesiony ołówek). */
export function liftTime(d) {
  return 0.06 + 0.1 * Math.sqrt(d / 50);
}

/** Czas przelotu między elementami sceny (dłuższy ruch całej ręki). */
export function travelTime(d) {
  return clamp(0.1 + 0.11 * Math.sqrt(d / 100), 0.12, 0.5);
}

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Indeks (ułamkowy) na ścieżce, do którego ręka doszła po czasie lokalnym s ∈ [0,1]. */
function warpIndex(info, s) {
  const { warp, n } = info;
  if (s <= 0) return 0;
  if (s >= 1) return n - 1;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (warp[mid] < s) lo = mid;
    else hi = mid;
  }
  const span = warp[hi] - warp[lo];
  return lo + (span > 0 ? (s - warp[lo]) / span : 0);
}

function pointAtIndex(r, f) {
  const i = Math.min(r.length - 2, Math.max(0, Math.floor(f)));
  const k = f - i;
  const a = r[i], b = r[i + 1] ?? a;
  return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

const planCache = new WeakMap();

export class StrokePlan {
  /**
   * @param {number[][][]} paths kreski w kolejności rysowania
   * @param {object} o speed (px/s), step (próbkowanie), lift (false = bez przerw na podniesienie),
   *                   liftTime(d) — własny czas przelotu, pause(i) — dodatkowa pauza [s] przed
   *                   kreską i (np. między słowami), fit — dopasuj całość do tylu sekund,
   *                   startStop / dotTime — narzut na kreskę i czas kropki [s]
   */
  constructor(paths, o = {}) {
    const step = o.step ?? 2.5;
    const speed = o.speed ?? HAND.speed;
    this.strokes = paths.filter((p) => p && p.length > 0).map((p) => (p.length === 1 ? dotInfo(p[0]) : pathInfo(p, step)));
    this.segs = [];
    let t = 0;
    this.strokes.forEach((info, i) => {
      if (i > 0) {
        const a = last(this.strokes[i - 1].r), b = info.r[0];
        const lt = (o.lift === false ? 0 : (o.liftTime ?? liftTime)(dist(a, b))) + (o.pause?.(i) ?? 0);
        if (lt > 0) this.segs.push({ type: 'lift', i, t0: t, t1: t + lt, a, b });
        t += lt;
      }
      const dt = info.dot ? (o.dotTime ?? 0.08) : drawTime(info.effLen, speed, o.startStop);
      this.segs.push({ type: 'draw', i, t0: t, t1: t + dt });
      t += dt;
    });
    this.total = Math.max(t, 1e-6);
    if (o.fit > 0) this.#fit(o.fit);
  }

  /**
   * Dopasowanie do zadanego czasu: przy przyspieszaniu ściskamy głównie kreski,
   * a przeloty nad kartką najwyżej do 60% — inaczej ołówek "teleportuje się"
   * między literami.
   */
  #fit(target) {
    const drawSum = this.segs.reduce((a, s) => a + (s.type === 'draw' ? s.t1 - s.t0 : 0), 0);
    const liftSum = this.total - drawSum;
    const ratio = target / this.total;
    let lf = ratio, df = ratio;
    if (ratio < 1 && drawSum > 0) {
      lf = Math.min(Math.max(ratio, 0.6), (target * 0.5) / Math.max(liftSum, 1e-6));
      df = (target - liftSum * lf) / drawSum;
    }
    let t = 0;
    for (const s of this.segs) {
      const d = (s.t1 - s.t0) * (s.type === 'draw' ? df : lf);
      s.t0 = t;
      s.t1 = t + d;
      t += d;
    }
    this.total = Math.max(t, 1e-6);
  }

  /** Plan z cache (po tożsamości tablicy kresek). */
  static of(paths, o) {
    if (o && Object.keys(o).length) return new StrokePlan(paths, o);
    let p = planCache.get(paths);
    if (!p) {
      p = new StrokePlan(paths);
      planCache.set(paths, p);
    }
    return p;
  }

  /**
   * Stan dla postępu p ∈ [0,1] (proporcjonalnego do czasu):
   *  progress[i] — ile kreski i jest narysowane (0..1, ułamek punktów)
   *  tip — pozycja grafitu {x,y,angle,lift}; lift>0 gdy ołówek w powietrzu
   */
  at(p) {
    const T = clamp(p) * this.total;
    const progress = new Array(this.strokes.length).fill(0);
    let tip = null;
    for (const s of this.segs) {
      if (s.type === 'draw') {
        const info = this.strokes[s.i];
        if (T >= s.t1) {
          progress[s.i] = 1;
          const e = last(info.r), b = info.r[Math.max(0, info.n - 2)];
          tip = { x: e[0], y: e[1], angle: Math.atan2(e[1] - b[1], e[0] - b[0]), lift: 0 };
          continue;
        }
        if (T < s.t0) break;
        const tau = (T - s.t0) / (s.t1 - s.t0);
        const f = warpIndex(info, minJerk(tau));
        progress[s.i] = info.n > 1 ? f / (info.n - 1) : 1;
        tip = { ...pointAtIndex(info.r, f), lift: 0 };
        break;
      } else {
        if (T >= s.t1) continue;
        if (T < s.t0) break;
        const q = ease.sine((T - s.t0) / (s.t1 - s.t0));
        const d = dist(s.a, s.b);
        const arc = Math.min(18, d * 0.18) * Math.sin(Math.PI * q);
        tip = {
          x: lerp(s.a[0], s.b[0], q),
          y: lerp(s.a[1], s.b[1], q) - arc,
          angle: Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]),
          lift: Math.sin(Math.PI * q),
        };
        break;
      }
    }
    if (!tip && this.strokes.length) {
      const r0 = this.strokes[0].r[0];
      tip = { x: r0[0], y: r0[1], angle: 0, lift: 0 };
    }
    return { progress, tip };
  }

  /** Punkt startowy i końcowy całego planu (do przelotów ręki). */
  get from() {
    return this.strokes[0]?.r[0];
  }

  get to() {
    const s = this.strokes[this.strokes.length - 1];
    return s && last(s.r);
  }
}

function dotInfo(p) {
  return { r: [p, p], n: 2, len: 0, effLen: 0, warp: new Float32Array([0, 1]), dot: true };
}

function last(a) {
  return a[a.length - 1];
}

// ------------------------------------------------------------------ HandTrack

/**
 * Ciągła trajektoria ręki dla całej sceny.
 * @param {Array<{start:number,end:number,trace:(t:number)=>({x,y,angle?,lift?}|null)}>} segments
 *        kroki, które ręka rysuje (trace w czasie bezwzględnym)
 * @param {object} o enter/exit — punkty poza kadrem, skąd ręka przychodzi i dokąd odchodzi,
 *                   restOffset — gdzie ręka odpoczywa względem ostatniej kreski,
 *                   restLong — po ilu sekundach bezczynności ręka odsuwa się dalej
 */
export class HandTrack {
  constructor(segments, o = {}) {
    this.o = { enter: [1400, 900], exit: [1400, 900], restOffset: [34, 42], restLong: 2.5, ...o };
    const segs = segments.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
    const sched = [];
    let handT = -Infinity;
    let pos = null;
    for (const s of segs) {
      if (s.end <= handT + 1e-6) continue; // narysowane, gdy ręka była zajęta — pomijamy
      const p0 = s.trace(Math.max(s.start, handT));
      if (!p0) continue;
      if (!pos) {
        // pierwsze wejście ręki do kadru
        const d = travelTime(dist(this.o.enter, [p0.x, p0.y])) * 1.6;
        sched.push({ type: 'travel', t0: s.start - d, t1: s.start, a: this.o.enter, b: () => s.trace(s.start), enter: true });
        sched.push({ type: 'follow', t0: s.start, t1: s.end, seg: s });
      } else {
        const target0 = s.trace(s.start);
        const need = travelTime(dist(pos, [target0.x, target0.y]));
        if (s.start - handT >= need) {
          const depart = s.start - need;
          let from = pos, liftA = 0;
          if (depart > handT) {
            sched.push({ type: 'rest', t0: handT, t1: depart, at: pos });
            const r = this.#rest({ t0: handT, at: pos }, depart);
            from = [r.x, r.y];
            liftA = r.lift;
          }
          sched.push({ type: 'travel', t0: depart, t1: s.start, a: from, liftA, b: () => s.trace(s.start) });
          sched.push({ type: 'follow', t0: s.start, t1: s.end, seg: s });
        } else {
          // ręka spóźniona (kroki zachodzą na siebie) — dogania kreskę w trakcie
          const arrive = handT + need;
          if (arrive >= s.end) continue;
          sched.push({ type: 'travel', t0: handT, t1: arrive, a: pos, b: () => s.trace(arrive) });
          sched.push({ type: 'follow', t0: arrive, t1: s.end, seg: s });
        }
      }
      const pe = s.trace(s.end) ?? p0;
      pos = [pe.x, pe.y];
      handT = s.end;
    }
    this.sched = sched;
    this.lastPos = pos;
    this.endT = handT;
  }

  /** Pozycja ręki w czasie t albo null (ręka poza kadrem). */
  at(t) {
    const S = this.sched;
    if (!S.length || t < S[0].t0) return null;
    for (const s of S) {
      if (t > s.t1) continue;
      if (s.type === 'follow') {
        const p = s.seg.trace(t);
        return p && { lift: 0, ...p };
      }
      if (s.type === 'rest') return this.#rest(s, t);
      if (s.type === 'travel') {
        const q = ease.inOut(clamp((t - s.t0) / Math.max(1e-6, s.t1 - s.t0)));
        const b = s.b();
        if (!b) return null;
        const a = s.a;
        const d = Math.hypot(b.x - a[0], b.y - a[1]);
        const arc = Math.min(70, d * 0.22) * Math.sin(Math.PI * q);
        const lift = s.enter ? 1 - q : lerp(s.liftA ?? 0, 0, q) + Math.sin(Math.PI * q) * 0.7;
        return { x: lerp(a[0], b.x, q), y: lerp(a[1], b.y, q) - arc, angle: 0, lift };
      }
    }
    // po ostatnim kroku: krótki spoczynek i zejście z kadru
    if (!this.lastPos) return null;
    const restEnd = this.endT + 0.8;
    if (t < restEnd) return this.#rest({ t0: this.endT, at: this.lastPos }, t);
    const q = clamp((t - restEnd) / 0.8);
    if (q >= 1) return null;
    const r = this.#rest({ t0: this.endT, at: this.lastPos }, restEnd);
    const e = ease.in(q);
    return { x: lerp(r.x, this.o.exit[0], e), y: lerp(r.y, this.o.exit[1], e), angle: 0, lift: lerp(r.lift, 1, q) };
  }

  /** Spoczynek: ręka odsuwa się trochę od kreski, unosi i lekko "oddycha". */
  #rest(s, t) {
    const k = ease.out(clamp((t - s.t0) / 0.35));
    const far = ease.inOut(clamp((t - s.t0 - this.o.restLong) / 0.8)) * 0.8;
    const [ox, oy] = this.o.restOffset;
    const bob = Math.sin(t * 1.7) * 2;
    return { x: s.at[0] + ox * k * (1 + far * 2), y: s.at[1] + oy * k * (1 + far * 2) + bob, angle: 0, lift: 0.5 * k + 0.3 * far };
  }

  /** Czy ręka jest w kadrze w czasie t. */
  visible(t) {
    return !!this.at(t);
  }
}
