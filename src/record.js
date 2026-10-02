// Eksport animacji do wideo prosto z przeglądarki (MediaRecorder -> WebM).
// Klatki są renderowane deterministycznie (renderAt), więc nagranie nie gubi
// klatek nawet przy wolnym komputerze — tylko trwa tyle, ile film.
// Do eksportu MP4 "klatka po klatce" w wysokiej jakości zob. tools/render.mjs.

/**
 * @param {import('./player.js').Player} player
 * @param {object} o fps, duration [s] (domyślnie intro + 1 s), bitrate, mimeType, onProgress(0..1)
 * @returns {Promise<Blob>}
 */
export async function recordWebM(player, o = {}) {
  const fps = o.fps ?? 30;
  const duration = o.duration ?? player.duration + 1;
  const canvas = player.canvas;
  const types = [o.mimeType, 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].filter(Boolean);
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: o.bitrate ?? 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = res));

  const wasPlaying = player.playing;
  player.pause();
  rec.start();
  const frames = Math.ceil(duration * fps);
  const t0 = performance.now();
  for (let i = 0; i <= frames; i++) {
    player.renderAt(i / fps);
    track.requestFrame?.();
    o.onProgress?.(i / frames);
    // MediaRecorder stempluje klatki czasem rzeczywistym — czekamy do momentu klatki
    const wait = t0 + ((i + 1) * 1000) / fps - performance.now();
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));
  }
  rec.stop();
  await done;
  if (wasPlaying) player.play();
  return new Blob(chunks, { type: mimeType ?? 'video/webm' });
}

/** Zapisuje Blob jako plik (pobieranie w przeglądarce). */
export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Pojedyncza klatka jako PNG (np. miniatura odcinka). */
export function snapshot(player, t) {
  player.renderAt(t ?? player.t);
  return new Promise((res) => player.canvas.toBlob(res, 'image/png'));
}
