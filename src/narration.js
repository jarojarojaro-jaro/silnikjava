// Lektor: dane z tools/voice/voice.py (voice.json) i napisy.
//
//   const voice = await Voice.load('voice/agent/voice.json');
//   sb.say(voice.beat(1), () => {
//     sb.write('Jak działa agent AI?', 640, 100, { size: 72 });
//     sb.pen(rect(...), { cue: 'obserwacji' });   // ołówek dotyka kartki tuż przed tym słowem
//   });
//
// Każdy beat to jedno zdanie lektora: osobny klip audio + czasy słów (sekundy od
// początku klipu). Storyboard kładzie klip na osi czasu, a rysunek układa wokół
// niego (zob. Storyboard.say).

export const normWord = (w) => String(w).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');

export class Beat {
  constructor(data, base = '') {
    Object.assign(this, data);
    this.src = data.audio ? base + data.audio : null;
    this.words = data.words ?? [];
  }

  /**
   * Czas słowa w klipie: `query` to słowo (porównanie bez wielkości liter i interpunkcji,
   * dopuszczalny początek słowa, np. 'obserw'), numer słowa albo liczba sekund {t}.
   * `nth` — które wystąpienie (od 0).
   */
  word(query, nth = 0) {
    if (typeof query === 'number') {
      const w = this.words[query];
      if (!w) throw new Error(`Beat ${this.id}: nie ma słowa nr ${query}`);
      return w;
    }
    if (query && typeof query === 'object' && 't' in query) return { w: '', s: query.t, e: query.t };
    const q = normWord(query);
    const hits = this.words.filter((w) => normWord(w.w) === q);
    const pref = hits.length ? hits : this.words.filter((w) => normWord(w.w).startsWith(q));
    const w = pref[nth];
    if (!w) throw new Error(`Beat ${this.id}: nie znaleziono słowa "${query}" w: ${this.text}`);
    return w;
  }
}

export class Voice {
  /**
   * @param {object} data zawartość voice.json
   * @param {string} base prefiks ścieżek klipów (katalog voice.json)
   */
  constructor(data, base = '') {
    this.data = data;
    this.base = base;
    this.beats = data.beats.map((b) => new Beat(b, base));
  }

  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Voice.load: ${url} → ${res.status}`);
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    return new Voice(await res.json(), base);
  }

  /** Beat po numerze (od 1, jak w skrypcie) albo id ('b3'). */
  beat(ref) {
    const b = typeof ref === 'number' ? this.beats[ref - 1] : this.beats.find((x) => x.id === ref);
    if (!b) throw new Error(`Voice: nie ma beatu ${ref}`);
    return b;
  }
}

// ------------------------------------------------------------------ napisy

const fmt = (t, sep) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const pad = (n, k = 2) => String(n).padStart(k, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
};

/**
 * Podział zdań lektora na napisy: maks. `maxChars` znaków w linii, `maxLines` linie
 * (domyślnie jak u Netflixa dla polskiego: 42 znaki, 2 linie). Czasy z czasów słów.
 * @param {Array<{start:number, words:Array<{w,s,e}>}>} clips klipy na osi czasu
 * @returns {Array<{start:number,end:number,lines:string[]}>}
 */
export function subtitleCues(clips, { maxChars = 42, maxLines = 2, minDur = 1.0 } = {}) {
  const cues = [];
  for (const c of clips) {
    let lines = [''], first = null, last = null;
    const flush = () => {
      if (first == null) return;
      cues.push({ start: c.start + first.s, end: c.start + Math.max(last.e, first.s + minDur), lines: lines.filter(Boolean) });
      lines = [''];
      first = last = null;
    };
    for (const w of c.words) {
      const cur = lines[lines.length - 1];
      if ((cur + ' ' + w.w).trim().length > maxChars) {
        if (lines.length >= maxLines) flush();
        else lines.push('');
      }
      lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w.w).trim();
      first ??= w;
      last = w;
    }
    flush();
  }
  // napisy nie mogą na siebie nachodzić
  for (let i = 0; i + 1 < cues.length; i++) cues[i].end = Math.min(cues[i].end, cues[i + 1].start - 0.04);
  return cues;
}

/**
 * Napisy "rolkowe": krótkie porcje po 2–3 słowa (wypalane w obraz), każde słowo
 * z własnym czasem — do podświetlania słowa, które właśnie pada.
 * Zwraca [{ start, end, words: [{ w, s, e }] }] (czasy bezwzględne).
 */
export function reelCues(clips, { maxChars = 16, maxWords = 3, hold = 0.8, bridge = 3 } = {}) {
  const cues = [];
  for (const c of clips) {
    let cur = null;
    for (const w of c.words) {
      const word = { w: w.w, s: c.start + w.s, e: c.start + w.e };
      const text = cur ? cur.words.map((x) => x.w).join(' ') + ' ' + w.w : w.w;
      if (!cur || cur.words.length >= maxWords || text.length > maxChars || /[.!?…]$/.test(cur.words[cur.words.length - 1].w)) {
        cur = { start: word.s, clip: c, words: [] };
        cues.push(cur);
      }
      cur.words.push(word);
    }
  }
  // napis trzyma się do następnej porcji — bez mrugania w pauzach lektora:
  // w zdaniu zawsze ciągle, między zdaniami gdy przerwa ≤ bridge, inaczej `hold` po ostatnim słowie
  for (let i = 0; i < cues.length; i++) {
    const last = cues[i].words[cues[i].words.length - 1];
    const next = cues[i + 1];
    if (!next) cues[i].end = last.e + hold;
    else if (next.clip === cues[i].clip || next.start - last.e <= bridge) cues[i].end = next.start;
    else cues[i].end = last.e + hold;
  }
  for (const c of cues) delete c.clip;
  return cues;
}

export function toSRT(cues) {
  return cues.map((c, i) => `${i + 1}\n${fmt(c.start, ',')} --> ${fmt(c.end, ',')}\n${c.lines.join('\n')}\n`).join('\n');
}

export function toVTT(cues) {
  return 'WEBVTT\n\n' + cues.map((c) => `${fmt(c.start, '.')} --> ${fmt(c.end, '.')}\n${c.lines.join('\n')}\n`).join('\n');
}
