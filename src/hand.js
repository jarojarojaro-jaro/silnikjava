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
  maxSpeed: 3200, // px/s — fizyczny limit ręki prowadzącej narzędzie po kartce (w szczycie)
  maxTravel: 4500, // px/s — limit ręki przelatującej nad kartką
};

/**
 * Dopasowanie odcinków czasu do `target` sekund: przy przyspieszaniu ściskamy
 * głównie rysowanie, a przeloty nad kartką najwyżej do 60% — inaczej ołówek
 * "teleportuje się". Zwraca nowy czas całkowity.
 */
function fitSegments(segs, total, target, isWork) {
  const workSum = segs.reduce((a, s) => a + (isWork(s) ? s.t1 - s.t0 : 0), 0);
  const liftSum = total - workSum;
  const ratio = target / total;
  let lf = ratio, df = ratio;
  if (ratio < 1 && workSum > 0) {
    lf = Math.min(Math.max(ratio, 0.6), (target * 0.5) / Math.max(liftSum, 1e-6));
    df = (target - liftSum * lf) / workSum;
  }
  let t = 0;
  for (const s of segs) {
    let d = (s.t1 - s.t0) * (isWork(s) ? df : lf);
    // przelot nie może być szybszy niż fizyczny limit ręki w powietrzu
    if (!isWork(s) && s.a && s.b) {
      const ax = s.a.x ?? s.a[0], ay = s.a.y ?? s.a[1], bx = s.b.x ?? s.b[0], by = s.b.y ?? s.b[1];
      d = Math.max(d, ((Math.PI / 2) * Math.hypot(bx - ax, by - ay)) / HAND.maxTravel);
    }
    s.t0 = t;
    s.t1 = t + d;
    t += d;
  }
  return Math.max(t, 1e-6);
}

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
  // przelot "sinusoidalny": szczyt prędkości = π/2 · d / T — nie szybciej niż maxTravel
  return Math.max(clamp(0.1 + 0.11 * Math.sqrt(d / 100), 0.12, 0.5), (Math.PI / 2) * d / HAND.maxTravel);
}

/**
 * Najkrótszy czas kroku, przy którym ręka nie przekroczy fizycznego limitu:
 * próbkujemy ślad (z easingiem kroku) i bierzemy największy przyrost drogi.
 * @param {(p:number)=>({x:number,y:number}|null)} trace
 */
export function minDuration(trace, easeFn = (q) => q, { samples = 720, maxSpeed = HAND.maxSpeed, maxTravel = HAND.maxTravel } = {}) {
  let prev = null, need = 0;
  for (let i = 0; i <= samples; i++) {
    const p = trace(easeFn(i / samples));
    if (p && prev) {
      // w powietrzu ręka może być szybsza niż przy prowadzeniu narzędzia po kartce
      const limit = (p.lift ?? 0) > 0.05 || (prev.lift ?? 0) > 0.05 ? maxTravel : maxSpeed;
      need = Math.max(need, Math.hypot(p.x - prev.x, p.y - prev.y) / limit);
    }
    if (p) prev = p;
  }
  return need * samples;
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
    this.total = fitSegments(this.segs, this.total, target, (s) => s.type === 'draw');
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

// ------------------------------------------------------------------ Sequence

/**
 * Sekwencja pod-kroków wykonywanych jedną ręką (np. postać: kontur -> kredka ->
 * oczy -> źrenice -> uśmiech -> kropki). Między krokami ręka przelatuje nad
 * kartką, więc rysowanie i ślad ręki są zawsze zgodne.
 *   steps: [{ dur (waga w sekundach), trace(q) => {x,y,angle?,lift?}, tool? }]
 *   o.fit — dopasuj całość do tylu sekund (przeloty ściskane najwyżej do 60%)
 *   at(p) -> { local: [q0, q1, ...], tip, index }
 */
export class Sequence {
  constructor(steps, o = {}) {
    this.steps = steps;
    this.segs = [];
    let t = 0;
    steps.forEach((st, i) => {
      if (i > 0) {
        const a = steps[i - 1].trace(1), b = st.trace(0);
        const d = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
        const lt = d > 0.5 ? (o.liftTime ?? liftTime)(d) : 0;
        if (lt > 0) this.segs.push({ type: 'lift', i, t0: t, t1: t + lt, a, b });
        t += lt;
      }
      this.segs.push({ type: 'step', i, t0: t, t1: t + st.dur });
      t += st.dur;
    });
    this.total = Math.max(t, 1e-6);
    if (o.fit > 0) this.total = fitSegments(this.segs, this.total, o.fit, (s) => s.type === 'step');
  }

  at(p) {
    const T = clamp(p) * this.total;
    const local = this.steps.map(() => 0);
    let tip = null, index = 0;
    for (const s of this.segs) {
      if (s.type === 'step') {
        if (T >= s.t1) { local[s.i] = 1; continue; }
        if (T < s.t0) break;
        local[s.i] = (T - s.t0) / (s.t1 - s.t0);
        tip = this.steps[s.i].trace(local[s.i]);
        if (tip && this.steps[s.i].tool && !tip.tool) tip = { ...tip, tool: this.steps[s.i].tool };
        index = s.i;
        break;
      } else {
        if (T >= s.t1) continue;
        if (T < s.t0) break;
        const q = ease.sine((T - s.t0) / (s.t1 - s.t0));
        const d = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
        tip = {
          x: lerp(s.a.x, s.b.x, q), y: lerp(s.a.y, s.b.y, q) - Math.min(20, d * 0.2) * Math.sin(Math.PI * q), angle: 0, lift: Math.sin(Math.PI * q),
          tool: (q < 0.5 ? this.steps[s.i - 1] : this.steps[s.i]).tool,
        };
        index = s.i;
        break;
      }
    }
    if (!tip) {
      index = p >= 1 ? this.steps.length - 1 : 0;
      const st = this.steps[index];
      tip = st?.trace(p >= 1 ? 1 : 0) ?? null;
      if (tip && st.tool && !tip.tool) tip = { ...tip, tool: st.tool };
    }
    return { local, tip, index };
  }
}

// ------------------------------------------------------------------ HandTrack

/**
 * Ciągła trajektoria ręki dla całej sceny.
 * @param {Array<{start:number,end:number,trace:(t:number)=>({x,y,angle?,lift?}|null),tool?:object,name?:string}>} segments
 *        kroki, które ręka rysuje (trace w czasie bezwzględnym), tool — narzędzie w ręce
 * @param {object} o enter/exit — punkty poza kadrem, skąd ręka przychodzi i dokąd odchodzi,
 *                   restOffset — gdzie ręka odpoczywa względem ostatniej kreski,
 *                   restLong — po ilu sekundach bezczynności ręka odsuwa się dalej
 *
 * `report` — dla każdego kroku: kiedy ręka faktycznie zaczęła go prowadzić
 * (status 'ok' | 'late' | 'skipped' | 'unreachable'). Na tej podstawie Storyboard.lint() wykrywa
 * elementy, które pojawiłyby się bez ręki.
 */
export class HandTrack {
  constructor(segments, o = {}) {
    this.o = { enter: [1400, 900], exit: [1400, 900], restOffset: [34, 42], restLong: 2.5, ...o };
    const segs = segments.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
    const sched = [];
    const report = [];
    let handT = -Infinity;
    let pos = null;
    let tool = null;
    for (const s of segs) {
      if (s.end <= handT + 1e-6) {
        report.push({ seg: s, status: 'skipped', late: s.end - s.start });
        continue;
      }
      const p0 = s.trace(Math.max(s.start, handT));
      if (!p0) continue;
      let arrive = s.start;
      if (!pos) {
        // pierwsze wejście ręki do kadru
        const d = travelTime(dist(this.o.enter, [p0.x, p0.y])) * 1.6;
        sched.push({ type: 'travel', t0: s.start - d, t1: s.start, a: this.o.enter, b: () => s.trace(s.start), enter: true, toolA: s.tool, toolB: s.tool });
      } else {
        const target0 = s.trace(s.start);
        const need = travelTime(dist(pos, [target0.x, target0.y]));
        if (s.start - handT >= need) {
          const depart = s.start - need;
          let from = pos, liftA = 0;
          if (depart > handT) {
            sched.push({ type: 'rest', t0: handT, t1: depart, at: pos, tool });
            const r = this.#rest({ t0: handT, at: pos }, depart);
            from = [r.x, r.y];
            liftA = r.lift;
          }
          sched.push({ type: 'travel', t0: depart, t1: s.start, a: from, liftA, b: () => s.trace(s.start), toolA: tool, toolB: s.tool });
        } else {
          // ręka spóźniona (kroki zachodzą na siebie) — dogania kreskę w trakcie
          arrive = handT + need;
          if (arrive >= s.end) {
            report.push({ seg: s, status: 'unreachable', late: s.end - s.start });
            continue;
          }
          sched.push({ type: 'travel', t0: handT, t1: arrive, a: pos, b: () => s.trace(arrive), toolA: tool, toolB: s.tool });
        }
      }
      sched.push({ type: 'follow', t0: arrive, t1: s.end, seg: s, tool: s.tool });
      report.push({ seg: s, status: arrive > s.start + 1e-6 ? 'late' : 'ok', late: arrive - s.start });
      const pe = s.trace(s.end) ?? p0;
      pos = [pe.x, pe.y];
      handT = s.end;
      tool = s.tool;
    }
    this.sched = sched;
    this.report = report;
    this.lastPos = pos;
    this.lastTool = tool;
    this.endT = handT;
  }

  /** Pozycja ręki w czasie t ({x,y,angle,lift,tool}) albo null (ręka poza kadrem). */
  at(t) {
    const S = this.sched;
    if (!S.length || t < S[0].t0) return null;
    for (const s of S) {
      if (t > s.t1) continue;
      if (s.type === 'follow') {
        const p = s.seg.trace(t);
        // krok może zmieniać narzędzie w trakcie (np. postać: kontur, potem kredka)
        return p && { lift: 0, ...p, tool: p.tool ?? s.tool };
      }
      if (s.type === 'rest') return { ...this.#rest(s, t), tool: s.tool };
      if (s.type === 'travel') {
        // profil sinusoidalny: szczyt prędkości π/2 · średniej — zgodnie z travelTime()
        const q = ease.sine(clamp((t - s.t0) / Math.max(1e-6, s.t1 - s.t0)));
        const b = s.b();
        if (!b) return null;
        const a = s.a;
        const d = Math.hypot(b.x - a[0], b.y - a[1]);
        const arc = Math.min(70, d * 0.22) * Math.sin(Math.PI * q);
        const lift = s.enter ? 1 - q : lerp(s.liftA ?? 0, 0, q) + Math.sin(Math.PI * q) * 0.7;
        // zmiana narzędzia w powietrzu, w połowie przelotu
        return { x: lerp(a[0], b.x, q), y: lerp(a[1], b.y, q) - arc, angle: 0, lift, tool: q < 0.5 ? s.toolA : s.toolB };
      }
    }
    // po ostatnim kroku: krótki spoczynek i zejście z kadru
    if (!this.lastPos) return null;
    const restEnd = this.endT + 0.8;
    if (t < restEnd) return { ...this.#rest({ t0: this.endT, at: this.lastPos }, t), tool: this.lastTool };
    const q = clamp((t - restEnd) / 0.8);
    if (q >= 1) return null;
    const r = this.#rest({ t0: this.endT, at: this.lastPos }, restEnd);
    const e = ease.in(q);
    return { x: lerp(r.x, this.o.exit[0], e), y: lerp(r.y, this.o.exit[1], e), angle: 0, lift: lerp(r.lift, 1, q), tool: this.lastTool };
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
