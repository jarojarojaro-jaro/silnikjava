// narzedzie.js — pędzel, który widać nad obrazem. Rysowany ścieżkami canvas co klatkę
// (bez grafik): kita z włosami i farbą, skuwka, lakierowany trzonek z numerem, cień.
// Oś x biegnie od czubka włosia w górę trzonka. Budowa rysunku (kita → skuwka → trzonek)
// za src/tool.js z ChetasLua/mona-lisa-js (MIT); tu z dwoma rodzajami włosia i własnym cieniem.

function h01(n) { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }

/**
 * @param {CanvasRenderingContext2D} g
 * @param {object} o
 * @param {number} o.x @param {number} o.y czubek (px)
 * @param {number} o.kat kierunek czubek → koniec trzonka (rad)
 * @param {number} o.w szerokość kity przy skuwce (px)
 * @param {number} o.rodzaj 0 płaski, 1 koci język, 2 okrągły
 * @param {number} o.u skala interfejsu (1 = projekt 1080 px)
 * @param {number} o.nacisk 0..1 @param {number} o.unies 0..1 wysokość nad obrazem
 * @param {number[]} o.kolor farba na włosiu @param {string} o.nr numer na trzonku
 */
export function rysujPedzel(g, o) {
  const { u, w, rodzaj } = o, nacisk = o.nacisk ?? 0, unies = o.unies ?? 0;
  const tepy = rodzaj === 0 ? 0.85 : rodzaj === 1 ? 0.5 : 0;             // jak tępy jest koniec kity
  const tl = ((1.9 - 0.9 * tepy) * w + (10 + 8 * tepy) * u) * (1 - 0.12 * nacisk);
  const brzuch = w * 0.5 * (1.04 + 0.22 * nacisk), ey = brzuch * tepy;
  const fr0 = w * 0.5, fr1 = Math.max(3 * u, Math.min(w * 0.42, 9 * u + w * 0.08));
  const fl = Math.min(1.2 * w + 12 * u, 0.5 * w + 40 * u), hl = 400 * u + Math.min(2 * w, 60 * u);
  const hr1 = Math.max(fr1 * 1.25, 4.4 * u), hr2 = Math.max(fr1 * 0.5, 2 * u);
  const x1 = tl + fl, x2 = x1 + hl;
  const kita = () => {
    const cx = tl * 0.16 * (1 - tepy), cy = brzuch * (0.62 + 0.38 * tepy);
    g.beginPath(); g.moveTo(tl, -fr0);
    g.bezierCurveTo(tl * 0.62, -brzuch, cx, -cy, 0, -ey);
    if (tepy > 0) g.quadraticCurveTo(-ey * (1 - tepy) * (1 - tepy) * 3, 0, 0, ey);
    g.bezierCurveTo(cx, cy, tl * 0.62, brzuch, tl, fr0); g.closePath();
  };
  const skuwka = () => {
    g.beginPath(); g.moveTo(tl, -fr0);
    g.bezierCurveTo(tl + fl * 0.5, -fr0, tl + fl * 0.6, -fr1, x1, -fr1); g.lineTo(x1, fr1);
    g.bezierCurveTo(tl + fl * 0.6, fr1, tl + fl * 0.5, fr0, tl, fr0); g.closePath();
  };
  const trzonek = () => {
    g.beginPath(); g.moveTo(x1, -fr1);
    g.bezierCurveTo(x1 + hl * 0.16, -hr1, x1 + hl * 0.34, -hr1, x1 + hl * 0.6, -(hr1 + hr2) * 0.5);
    g.quadraticCurveTo(x2 - hr2, -hr2, x2, 0); g.quadraticCurveTo(x2 - hr2, hr2, x1 + hl * 0.6, (hr1 + hr2) * 0.5);
    g.bezierCurveTo(x1 + hl * 0.34, hr1, x1 + hl * 0.16, hr1, x1, fr1); g.closePath();
  };
  const [cr, cg, cb] = o.kolor ?? [120, 90, 50], rgb = `${cr | 0},${cg | 0},${cb | 0}`;
  let gr;
  g.save();
  g.globalAlpha = o.alfa ?? 1;

  // cień: pędzel odchyla się od obrazu, więc cień styka się z nim przy czubku i odjeżdża wzdłuż trzonka
  g.save();
  g.translate(o.x + (5 + 34 * unies) * u, o.y + (8 + 44 * unies) * u); g.rotate(o.kat + 0.1 + 0.1 * unies);
  g.filter = `blur(${((6 + 20 * unies) * u).toFixed(1)}px)`; g.fillStyle = `rgba(0,0,0,${0.5 - 0.2 * unies})`;
  kita(); g.fill(); skuwka(); g.fill(); trzonek(); g.fill();
  g.restore();

  g.translate(o.x, o.y); g.rotate(o.kat);
  // trzonek: lakierowane drewno ze słojami, ciemna końcówka, złota obrączka, połysk lakieru
  gr = g.createLinearGradient(0, -hr1, 0, hr1);
  gr.addColorStop(0, '#d9a56a'); gr.addColorStop(0.25, '#a86f38'); gr.addColorStop(0.6, '#6b411d'); gr.addColorStop(1, '#27160a');
  g.fillStyle = gr; trzonek(); g.fill();
  g.save(); trzonek(); g.clip();
  const xd = x1 + hl * 0.84;
  for (let k = 0; k < 7; k++) {
    const gy = (h01(k * 7 + 3) - 0.5) * 1.6 * hr1;
    g.strokeStyle = `rgba(58,30,8,${0.08 + 0.1 * h01(k + 11)})`; g.lineWidth = Math.max(0.4, 0.7 * u);
    g.beginPath(); g.moveTo(x1, gy); g.quadraticCurveTo((x1 + xd) / 2, gy + (h01(k + 29) - 0.5) * 4 * u, xd, gy); g.stroke();
  }
  gr = g.createLinearGradient(0, -hr1, 0, hr1);
  gr.addColorStop(0, '#55555b'); gr.addColorStop(0.3, '#222225'); gr.addColorStop(1, '#070708');
  g.fillStyle = gr; g.fillRect(xd, -hr1 - 1, x2 - xd + 2, hr1 * 2 + 2);
  gr = g.createLinearGradient(0, -hr1, 0, hr1);
  gr.addColorStop(0, '#fff0b8'); gr.addColorStop(0.4, '#c89a48'); gr.addColorStop(1, '#5a3d12');
  g.fillStyle = gr; g.fillRect(xd - 2.2 * u, -hr1 - 1, 2.2 * u, hr1 * 2 + 2);
  g.restore();
  gr = g.createLinearGradient(x1, 0, x1 + hl * 0.8, 0);
  gr.addColorStop(0, 'rgba(255,248,230,0)'); gr.addColorStop(0.2, 'rgba(255,248,230,.42)'); gr.addColorStop(0.8, 'rgba(255,248,230,.3)'); gr.addColorStop(1, 'rgba(255,248,230,0)');
  g.strokeStyle = gr; g.lineWidth = Math.max(0.6, hr1 * 0.2); g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1 + hl * 0.03, -fr1 * 0.5); g.quadraticCurveTo(x1 + hl * 0.3, -hr1 * 0.62, x1 + hl * 0.8, -hr2 * 0.9); g.stroke();
  if (o.nr && hr1 > 3.4 * u) {
    g.font = `600 ${Math.max(7, Math.min(hr1 * 1.05, 13 * u)).toFixed(1)}px Caladea, Georgia, serif`;
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = 'rgba(246,220,150,.85)';
    g.fillText(`No. ${o.nr}`, x1 + hl * 0.2, hr1 * 0.1);
  }
  // skuwka: nikiel (jasny pas u góry, odbite światło u dołu), dwa zaciski, farba, która podeszła
  gr = g.createLinearGradient(0, -fr0, 0, fr0);
  gr.addColorStop(0, '#8d897f'); gr.addColorStop(0.12, '#fdfbf4'); gr.addColorStop(0.3, '#cfcabd'); gr.addColorStop(0.5, '#6f6c64');
  gr.addColorStop(0.72, '#3a3835'); gr.addColorStop(0.9, '#8a8375'); gr.addColorStop(1, '#2a2826');
  g.fillStyle = gr; skuwka(); g.fill();
  g.save(); skuwka(); g.clip();
  for (const cz of [0.7, 0.86]) {
    const cx = tl + fl * cz;
    g.fillStyle = 'rgba(0,0,0,.36)'; g.fillRect(cx, -fr0, Math.max(0.8, 1.4 * u), fr0 * 2);
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(cx + Math.max(0.8, 1.4 * u), -fr0, Math.max(0.6, u), fr0 * 2);
  }
  for (let k = 0; k < 3; k++) {
    g.fillStyle = `rgba(${rgb},.8)`; g.beginPath();
    g.ellipse(tl + fl * (0.03 + 0.12 * h01(k)), (h01(k + 17) - 0.5) * 1.4 * fr0, (0.1 + 0.1 * h01(k + 5)) * fr0 * 1.6, (0.1 + 0.1 * h01(k + 5)) * fr0, 0, 0, 6.2832); g.fill();
  }
  g.restore();
  // włosie: szczecina (jasna) w płaskich i kocich językach, sobol (ciemny) w okrągłych
  gr = g.createLinearGradient(0, 0, tl, 0);
  if (rodzaj === 2) { gr.addColorStop(0, '#8a5f38'); gr.addColorStop(0.55, '#5f3d20'); gr.addColorStop(1, '#2a180b'); }
  else { gr.addColorStop(0, '#e6d3a8'); gr.addColorStop(0.55, '#c9b081'); gr.addColorStop(1, '#8c7248'); }
  g.fillStyle = gr; kita(); g.fill();
  g.save(); kita(); g.clip();
  gr = g.createLinearGradient(0, 0, tl, 0);                                 // farba, najwięcej przy czubku
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.42, `rgba(${rgb},.92)`); gr.addColorStop(0.72, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(-brzuch - 2, -brzuch - 2, tl + brzuch + 4, 2 * brzuch + 4);
  const n = Math.max(7, Math.min(46, Math.round(w / u * 0.95 + 6)));
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n * 2 - 1, as = Math.abs(s), j = h01(i * 97 + 13);
    const ex = tl * (0.03 + (as * as * 0.2 + j * 0.06) * (1 - tepy * 0.85)), eyy = s * (brzuch * 0.2 * (1 - tepy) + ey * 0.96 * (tepy > 0 ? 1 : 0));
    g.strokeStyle = (i & 1) ? `rgba(20,10,4,${0.18 + 0.2 * j})` : `rgba(255,240,205,${0.1 + 0.16 * j})`;
    g.lineWidth = Math.max(0.4, (0.5 + 0.5 * j) * u);
    g.beginPath(); g.moveTo(tl, s * fr0 * 0.94); g.quadraticCurveTo(tl * 0.5, s * brzuch * (0.94 + 0.1 * j), ex, eyy); g.stroke();
  }
  gr = g.createLinearGradient(tl * 0.08, 0, tl * 0.44, 0);                  // mokry błysk na czubku
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.4, 'rgba(255,255,255,.34)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.strokeStyle = gr; g.lineWidth = Math.max(0.6, brzuch * 0.09);
  g.beginPath(); g.moveTo(tl * 0.08, -brzuch * 0.3); g.quadraticCurveTo(tl * 0.24, -brzuch * 0.52, tl * 0.44, -brzuch * 0.5); g.stroke();
  g.restore();
  kita(); g.strokeStyle = 'rgba(20,10,4,.5)'; g.lineWidth = Math.max(0.7, u); g.stroke();
  gr = g.createLinearGradient(tl * 0.7, 0, tl, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.42)');
  g.fillStyle = gr; kita(); g.fill();
  g.restore();
}
