// Ścieżka dźwiękowa sceny: klipy lektora rozłożone na osi czasu, odtwarzane
// przez Web Audio. Gdy dźwięk gra, to ON jest zegarem animacji (Player bierze
// czas z time()), więc obraz nie rozjeżdża się z głosem nawet przy gubieniu klatek.

export class AudioTrack {
  /** @param {Array<{src:string,start:number,dur?:number}>} clips */
  constructor(clips) {
    this.clips = clips.filter((c) => c.src);
    this.ctx = null;
    this.buffers = new Map();
    this.nodes = [];
    this.playing = false;
    this.ready = null;
    this.t0 = 0; // czas sceny i zegara audio w chwili startu
    this.c0 = 0;
  }

  /** Pobiera i dekoduje klipy (raz). */
  load() {
    if (this.ready) return this.ready;
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return (this.ready = Promise.resolve(false));
    this.ctx = new AC();
    // każdy klip osobno: brak jednego pliku nie wyłącza całego lektora
    this.ready = Promise.allSettled(
      [...new Set(this.clips.map((c) => c.src))].map(async (src) => {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(src, buf);
      }),
    ).then((r) => {
      for (const x of r) if (x.status === 'rejected' && typeof console !== 'undefined') console.warn('lektor:', x.reason?.message ?? x.reason);
      return this.buffers.size > 0;
    });
    return this.ready;
  }

  /** Czy przeglądarka pozwala grać (autoplay wymaga gestu użytkownika). */
  get unlocked() {
    return this.ctx?.state === 'running';
  }

  /** Startuje odtwarzanie od czasu sceny t (sekundy). */
  async play(t) {
    await this.load();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    this.stop();
    const now = this.ctx.currentTime + 0.05;
    this.t0 = t;
    this.c0 = now;
    for (const c of this.clips) {
      const buf = this.buffers.get(c.src);
      if (!buf) continue;
      const end = c.start + buf.duration;
      if (end <= t) continue;
      const node = this.ctx.createBufferSource();
      node.buffer = buf;
      node.connect(this.ctx.destination);
      const offset = Math.max(0, t - c.start);
      node.start(now + Math.max(0, c.start - t), offset);
      this.nodes.push(node);
    }
    this.playing = this.ctx.state === 'running';
    return this.playing;
  }

  stop() {
    for (const n of this.nodes) {
      try { n.stop(); } catch { /* już zatrzymany */ }
    }
    this.nodes = [];
    this.playing = false;
  }

  /** Bieżący czas sceny według zegara audio. */
  time() {
    return this.ctx ? this.t0 + (this.ctx.currentTime - this.c0) : this.t0;
  }
}
