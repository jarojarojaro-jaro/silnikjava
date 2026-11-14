// Testy skilla malarz (bez przeglądarki, kilka sekund):
//   node --test .claude/skills/malarz/tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { Pedzel, Kod, KRYCIE, BAJTY, PLASKI, KOCI, OKRAGLY, odczytaj, odtworz, plotno, oswietl } from '../lib/pedzel.js';
import { Malarz } from '../lib/malarz.js';
import { kierunki, szarosc, waznosc, rozmyj, Los } from '../lib/pole.js';
import { STYLE, rozmiarRoboczy, POLE } from '../lib/style.js';
import { doTekstu, zTekstu } from '../lib/plik.js';
import { renderuj } from '../lib/render.js';
import { Reka } from '../lib/reka.js';
import { namaluj, fbm, pasmo } from '../lib/szkic.js';
import { zapiszPNG } from '../lib/grafika.js';

const suma = (a) => a.reduce((s, v) => s + v, 0);
// wzór testowy: ciepła lewa połowa, zimna prawa, jasne koło pośrodku
function wzorTestowy(W, H) {
  const T = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = (y * W + x) * 3, kolo = Math.hypot(x - W / 2, y - H / 2) < H / 5;
    const c = kolo ? [240, 230, 180] : x < W / 2 ? [170, 80, 50] : [40, 70, 130];
    T[q] = c[0]; T[q + 1] = c[1]; T[q + 2] = c[2];
  }
  return T;
}

test('rekord: zaokrąglenie i odczyt zgadzają się w granicach kroku', () => {
  for (const x of [-30, 0, 12.3, 599.9, 1500]) assert.ok(Math.abs(Kod.xd(Kod.xq(x)) - x) <= 1 / 64 + 1e-9);
  for (const l of [0.8, 3, 40, 300]) assert.ok(Math.abs(Kod.ld(Kod.lq(l)) / l - 1) < 0.013);
  for (const w of [0.5, 1, 9, 118]) assert.ok(Math.abs(Kod.wd(Kod.wq(w)) / w - 1) < 0.012);
  for (const b of [-0.4, -0.1, 0, 0.22, 0.4]) assert.ok(Math.abs(Kod.bd(Kod.bq(b)) - b) < 0.002);
  assert.equal(Kod.aq(Math.PI), 0);                                   // kierunek jest modulo π
  const buf = new Uint8Array(BAJTY);
  const x = Kod.xq(123.5), y = Kod.xq(77.25);
  buf.set([x & 255, x >> 8, y & 255, y >> 8, Kod.aq(1), Kod.lq(50), Kod.wq(10), Kod.bq(-0.2) & 255, 10, 20, 30, 3 | (KOCI << 2)]);
  const s = odczytaj(buf, 0);
  assert.equal(s.x, 123.5); assert.equal(s.y, 77.25); assert.equal(s.op, 1); assert.equal(s.kind, KOCI);
  assert.ok(s.bend < 0 && Math.abs(s.bend + 0.2) < 0.002);
  assert.deepEqual([s.r, s.g, s.b], [10, 20, 30]);
});

test('pędzel: maska leży tam, gdzie pociągnięcie, a rodzaje różnią się końcami', () => {
  const P = Pedzel(200, 200, 1);
  assert.ok(P.maska(100, 100, 0, 80, 20, 0, 1, KOCI, 5) > 0);
  const a = (x, y) => (x >= P.x0 && x < P.x0 + P.w && y >= P.y0 && y < P.y0 + P.h ? P.MA[(y - P.y0) * P.w + (x - P.x0)] : 0);
  assert.ok(a(100, 100) > 0.5, 'środek pokryty');
  assert.equal(a(100, 130), 0, 'poza szerokością pusto');
  assert.equal(a(20, 100), 0, 'poza długością pusto');
  const pole = (kind) => { P.maska(100, 100, 0, 80, 20, 0, 1, kind, 5); return suma(P.MA.subarray(0, P.w * P.h)); };
  assert.ok(pole(PLASKI) > pole(OKRAGLY) * 1.08, 'płaski kładzie więcej farby niż okrągły (szpice)');
  assert.equal(P.maska(900, 900, 0, 10, 4, 0, 1, KOCI, 1), 0, 'poza obrazem nic');
});

test('pędzel: wygięcie odsuwa środek pociągnięcia w bok', () => {
  const P = Pedzel(200, 200, 1);
  const srodekY = (bend) => {
    P.maska(100, 100, 0, 120, 8, bend, 1, OKRAGLY, 3);
    let s = 0, n = 0;
    for (let y = 0; y < P.h; y++) { const v = P.MA[y * P.w + (100 - P.x0)]; s += v * (P.y0 + y + 0.5); n += v; }
    return s / n;
  };
  assert.ok(Math.abs(srodekY(0) - 100) < 0.6);
  assert.ok(srodekY(0.3) > 112, 'grzbiet odszedł o ok. 0,3 × 120 / 2');
});

test('pędzel: ta sama plama w skali 1 i 3 (obraz nie jest siatką pikseli)', () => {
  const masa = (S) => { const P = Pedzel(120, 120, S); P.maska(60, 60, 0.6, 70, 14, 0.1, 0.85, PLASKI, 9); return suma(P.MA.subarray(0, P.w * P.h)) / (S * S); };
  const m1 = masa(1), m3 = masa(3);
  assert.ok(Math.abs(m1 / m3 - 1) < 0.04, `pokrycie ${m1.toFixed(1)} vs ${m3.toFixed(1)}`);
});

test('pędzel: pociągnięcie malowane w kawałkach daje to samo co w całości', () => {
  const P = Pedzel(100, 100, 2), cale = plotno(P.PW, P.PH, [200, 200, 200]), kaw = plotno(P.PW, P.PH, [200, 200, 200]);
  const st = [50, 50, 0.4, 60, 12, 0.15, 0.85, KOCI, 11, 30, 60, 90];
  P.maluj(cale, ...st);
  for (const [a, b] of [[0, 0.2], [0.2, 0.55], [0.55, 1]]) P.maluj(kaw, ...st, a, b);
  let maxd = 0; for (let i = 0; i < cale.length; i++) maxd = Math.max(maxd, Math.abs(cale[i] - kaw[i]));
  assert.ok(maxd < 1e-3, `różnica ${maxd}`);
  assert.ok(cale.some((v) => v < 150), 'farba położona');
});

test('światło: siła 0 oddaje czysty kolor, faktura zmienia tylko jasność', () => {
  const P = Pedzel(60, 60, 1), C = plotno(60, 60, [100, 150, 200]), Hb = new Float32Array(3600);
  P.maluj(C, 30, 30, 0, 40, 16, 0, 1, PLASKI, 2, 200, 50, 50, 0, 1, Hb);
  const bez = oswietl(C, Hb, 60, 60, 1, new Uint8ClampedArray(3600 * 4), { sila: 0 });
  for (const i of [0, 1830, 3599]) assert.equal(bez[i * 4], Math.round(C[i * 3]));
  const ze = oswietl(C, Hb, 60, 60, 1, new Uint8ClampedArray(3600 * 4), { sila: 1, splot: 0 });
  let rozne = 0; for (let i = 0; i < 3600; i++) if (ze[i * 4] !== bez[i * 4]) rozne++;
  assert.ok(rozne > 50, 'faktura widoczna w świetle');
  assert.equal(ze[0], bez[0], 'gładki grunt bez splotu się nie zmienia');
  const okno = oswietl(C, Hb, 60, 60, 1, new Uint8ClampedArray(3600 * 4), { sila: 1, splot: 0 }, { x: 20, y: 20, w: 20, h: 20 });
  assert.equal(okno[(30 * 60 + 30) * 4], ze[(30 * 60 + 30) * 4], 'prostokąt daje te same piksele co całość');
  assert.equal(okno[0], 0, 'poza prostokątem nietknięte');
});

test('pole: kierunek wzdłuż krawędzi, ważność rośnie na rysunku i w skupieniu', () => {
  const W = 64, H = 64, g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = x < 32 ? 20 : 220;      // pionowa krawędź
  const k = kierunki(g, W, H, 1.5)[32 * W + 32];
  assert.ok(Math.abs(Math.sin(k)) > 0.98, `kąt ${k} powinien być pionowy`);
  const wt = waznosc(g, W, H, 2, [{ x: 0.2, y: 0.2, rx: 0.1, ry: 0.1, ile: 3 }]);
  assert.ok(wt[32 * W + 32] > wt[32 * W + 55] + 1, 'krawędź ważniejsza niż gładkie pole');
  assert.ok(wt[13 * W + 13] > 3.5, 'skupienie dodaje wagę');
  assert.ok(Math.abs(rozmyj(g, W, H, 2)[10 * W + 5] - 20) < 1e-3);
  const a = Los(7), b = Los(7); assert.equal(a(), b());
});

test('style: etapy od szerokiego do wąskiego pędzla, poprawne rodzaje', () => {
  for (const [nazwa, s] of Object.entries(STYLE)) {
    assert.ok(s.etapy.length >= 3 && s.opis && s.swiatlo && s.cechy, nazwa);
    for (let i = 0; i < s.etapy.length; i++) {
      const e = s.etapy[i];
      assert.ok(e.w[0] < e.w[1] && e.lr[0] < e.lr[1] && e.n > 0 && [PLASKI, KOCI, OKRAGLY].includes(e.pedzel), `${nazwa}/${e.nazwa}`);
      if (i) assert.ok(e.w[1] <= s.etapy[i - 1].w[0] + 1e-9, `${nazwa}: pędzle maleją`);
    }
  }
  const { W, H } = rozmiarRoboczy(16 / 9);
  assert.ok(Math.abs(W * H / POLE - 1) < 0.01 && Math.abs(W / H - 16 / 9) < 0.01);
});

test('malarz: każdy etap zbliża płótno do wzoru, przebieg jest powtarzalny', () => {
  const W = 120, H = 90, cel = wzorTestowy(W, H);
  const maluj = () => {
    const m = Malarz({ W, H, cel, wagi: waznosc(szarosc(cel, W * H), W, H, 2), K0: 14, MUT: 16 });
    const r = [m.rmse()];
    for (const e of [{ w: [30, 60], lr: [1.4, 3], n: 14, pedzel: PLASKI }, { w: [10, 26], lr: [1.3, 4], n: 60, pedzel: KOCI }, { w: [3, 9], lr: [1.2, 5], n: 240, pedzel: OKRAGLY }]) { m.etap(e); r.push(m.rmse()); }
    return { m, r, b: m.bajty() };
  };
  const a = maluj(), b = maluj();
  assert.ok(a.r[1] < a.r[0] && a.r[2] < a.r[1] && a.r[3] < a.r[2], `rmse ${a.r.map((v) => v.toFixed(1))}`);
  assert.ok(a.r[3] < 0.35 * a.r[0], 'obraz wyraźnie bliżej wzoru');
  assert.equal(a.b.length, a.m.ile * BAJTY);
  assert.deepEqual(a.b, b.b, 'ten sam wzór i ziarno → te same bajty');
  // etap kończy się wcześniej, gdy żadne pociągnięcie tym pędzlem już nie poprawia obrazu
  assert.equal(a.m.konce[0], 14); assert.ok(a.m.konce[1] > 30 && a.m.konce[1] <= 74); assert.equal(a.m.konce[2], a.m.ile);
  // odtworzenie z samych bajtów daje to samo płótno, które oceniał malarz
  const P = Pedzel(W, H, 1), C = plotno(W, H, [222, 212, 190]);
  odtworz(P, C, a.b, 0, a.m.ile);
  let maxd = 0; for (let i = 0; i < C.length; i++) maxd = Math.max(maxd, Math.abs(C[i] - a.m.C[i]));
  assert.ok(maxd < 1e-3, `odtworzenie różni się o ${maxd}`);
  const s = odczytaj(a.b, a.m.ile - 1); assert.equal(s.kind, OKRAGLY);
});

test('malarz: styl z żywym kolorem zmienia farbę, ale nadal poprawia obraz', () => {
  const W = 100, H = 80, cel = wzorTestowy(W, H);
  const m = Malarz({ W, H, cel, K0: 12, MUT: 12, kolor: { nasycenie: 1.3, drganie: 20 } }), r0 = m.rmse();
  m.etap({ w: [14, 40], lr: [1.2, 3], n: 60, pedzel: PLASKI });
  assert.ok(m.rmse() < r0 * 0.6);
});

test('malarz: rozszczepiona barwa — kropki różnią się odcieniem, średnio trzymają kolor wzoru', () => {
  const W = 100, H = 80, cel = new Float32Array(W * H * 3); for (let i = 0; i < W * H; i++) cel.set([90, 150, 110], i * 3);
  const m = Malarz({ W, H, cel, K0: 10, MUT: 10, kolor: { rozszczep: 36 } });
  m.etap({ w: [40, 80], lr: [1.2, 2.5], n: 30, pedzel: PLASKI });
  const szerokie = m.ile, b0 = m.bajty();
  for (let i = 0; i < szerokie; i++) assert.ok(Math.abs(odczytaj(b0, i).r - 90) < 12, 'podmalówka w kolorze wzoru');
  m.etap({ w: [6, 9], lr: [1, 1.15], n: 400, pedzel: OKRAGLY, pelne: 1, prosto: 1 });
  const b = m.bajty(), r = [], jas = [];
  for (let i = szerokie; i < m.ile; i++) { const s = odczytaj(b, i); r.push(s.r); jas.push(0.3 * s.r + 0.59 * s.g + 0.11 * s.b); }
  const sr = (a) => suma(a) / a.length, odch = (a) => Math.sqrt(sr(a.map((v) => (v - sr(a)) ** 2)));
  assert.ok(odch(r) > 12, `kropki mają różne odcienie (odchylenie czerwieni ${odch(r).toFixed(1)})`);
  assert.ok(odch(jas) < odch(r) * 0.6, 'jasność zmienia się mniej niż barwa');
  assert.ok(m.rmse() < 30, `z daleka nadal kolor wzoru (rmse ${m.rmse().toFixed(1)})`);
});

test('plik obrazu: zapis i odczyt, render w dwóch skalach, część pociągnięć', () => {
  const r = Reka({ W: 90, H: 60, tytul: 'Test', styl: 'etiuda' });
  r.etap('Tło', 24, PLASKI).pociagnij({ x: 45, y: 30, dlugosc: 80, szerokosc: 40, kolor: [40, 60, 120] });
  r.etap('Akcent', 4, OKRAGLY).pociagnij({ x: 45, y: 30, kat: 1, dlugosc: 20, szerokosc: 5, kolor: [250, 220, 90], krycie: 0.6 });
  const { naglowek, bajty } = r.obraz();
  const o = zTekstu(doTekstu(naglowek, bajty));
  assert.equal(o.naglowek.ile, 2); assert.deepEqual(o.bajty, bajty);
  assert.deepEqual(o.naglowek.etapy.map((e) => e.koniec), [1, 2]);
  assert.equal(odczytaj(bajty, 1).op, KRYCIE[1]);
  assert.throws(() => zTekstu('{"format":"cos"}'));
  const a = renderuj(o.naglowek, o.bajty, 1, { swiatlo: false }), b = renderuj(o.naglowek, o.bajty, 2, { swiatlo: false });
  assert.equal(b.w, 2 * a.w);
  const sr = (x) => { let s = 0; for (let i = 0; i < x.px.length; i += 4) s += x.px[i + 2]; return s / (x.px.length / 4); };
  assert.ok(Math.abs(sr(a) - sr(b)) < 2.5, 'ten sam obraz w obu skalach');
  const pol = renderuj(o.naglowek, o.bajty, 1, { swiatlo: false, ile: 1 }), q = (30 * 90 + 45) * 4;
  assert.ok(pol.px[q + 2] > pol.px[q], 'po pierwszym pociągnięciu środek niebieski');
  assert.ok(a.px[q] > a.px[q + 2], 'po drugim — żółty akcent');
});

test('szkicownik: wzór z funkcji koloru, szum powtarzalny', () => {
  const T = namaluj(20, 10, (u, v) => [u, v, 2], 2);
  assert.equal(T.length, 600);
  assert.ok(Math.abs(T[0] - 255 * 0.025) < 1 && T[2] === 255, 'u rośnie w prawo, wartości przycięte do 0..1');
  assert.ok(T[19 * 3] > 240 && T[(9 * 20) * 3 + 1] > 230);
  assert.equal(fbm(1.3, 2.7), fbm(1.3, 2.7));
  const v = fbm(4.2, 9.1); assert.ok(v >= 0 && v <= 1);
  assert.deepEqual(pasmo([[0, [0, 0, 0]], [1, [1, 1, 1]]], 2), [1, 1, 1]);
});

test('PNG: zapisany plik da się odkodować', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'malarz-')), 't.png');
  zapiszPNG(p, new Float32Array([255, 0, 0, 0, 300, -5]), 2, 1);
  const b = readFileSync(p);
  assert.deepEqual([...b.subarray(0, 4)], [137, 80, 78, 71]);
  assert.equal(b.readUInt32BE(16), 2); assert.equal(b.readUInt32BE(20), 1);
  const len = b.readUInt32BE(33), raw = inflateSync(b.subarray(41, 41 + len));
  assert.deepEqual([...raw], [0, 255, 0, 0, 0, 255, 0]);
});

// ---- narzędzia suche ---------------------------------------------------------------------------
import { Kartka, NARZEDZIA, NAZWY } from '../lib/suche.js';
import { Rysunek, indeks, odczytajSlad } from '../lib/rysunek.js';
import { STYLE_SUCHE, paleta, kontury, rysuj } from '../lib/rysownik.js';

const srednia = (k, x0, y0, x1, y1, c = 0) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += k.C[(y * k.PW + x) * 3 + c]; n++; } return s / n; };

test('papier: ziarno widać przy lekkim nacisku, mocny nacisk je zalewa', () => {
  const pokrycie = (p) => {
    const k = Kartka(80, 40, 2), przed = Float32Array.from(k.C);
    for (let i = 0; i < 12; i++) k.slad(NARZEDZIA.wegiel, [30, 30, 30], 6, [10, 8 + i * 2, p, 70, 8 + i * 2, p], i + 1);
    let n = 0, m = 0; for (let y = 24; y < 56; y++) for (let x = 40; x < 120; x++) { m++; if (przed[(y * k.PW + x) * 3] - k.C[(y * k.PW + x) * 3] > 12) n++; }
    return n / m;
  };
  const lekko = pokrycie(0.25), mocno = pokrycie(1);
  assert.ok(lekko > 0.05 && lekko < 0.75, `lekki nacisk zostawia prześwity papieru (${lekko.toFixed(2)})`);
  assert.ok(mocno > 0.93 && mocno > lekko + 0.2, `mocny nacisk kryje (${mocno.toFixed(2)})`);
});

test('pigment: kredka przezroczysta miesza się jak farba, pastel kryje', () => {
  const k = Kartka(60, 60, 1, { ziarno: 0 });
  const plama = (nz, kol, y) => { for (let r = 0; r < 2; r++) for (let i = 0; i < 30; i++) k.slad(nz, kol, nz.szer, [5, y + i, 1, 55, y + i, 1], r * 100 + i + y); };
  plama(NARZEDZIA.kredka, [30, 150, 220], 4); plama(NARZEDZIA.kredka, [250, 220, 40], 4);
  const [r, g, b] = [0, 1, 2].map((c) => srednia(k, 15, 10, 45, 28, c));
  assert.ok(g > r + 15 && g > b + 15, `żółta na niebieskiej daje zieleń (${[r, g, b].map(Math.round)})`);
  plama(NARZEDZIA.pastel, [40, 40, 40], 38); plama(NARZEDZIA.pastel, [250, 240, 230], 38);
  assert.ok(srednia(k, 15, 44, 45, 58) > 200, 'jasny pastel zakrywa ciemny');
});

test('ślad: ta sama kreska w kawałkach = w całości; skala nie zmienia rysunku', () => {
  const pk = [10, 20, 0.7, 40, 12, 0.9, 70, 24, 0.6];
  const a = Kartka(80, 40, 2), b = Kartka(80, 40, 2);
  a.slad(NARZEDZIA.kredka, [200, 40, 40], 2, pk, 5);
  for (const [t0, t1] of [[0, 0.3], [0.3, 0.7], [0.7, 1]]) b.slad(NARZEDZIA.kredka, [200, 40, 40], 2, pk, 5, t0, t1, 77);
  let maxd = 0; for (let i = 0; i < a.C.length; i++) maxd = Math.max(maxd, Math.abs(a.C[i] - b.C[i]));
  assert.ok(maxd < 0.5, `różnica ${maxd}`);
  assert.ok(a.x1 > a.x0 && a.y1 > a.y0, 'prostokąt zmian ustawiony');
  const ciemn = (S) => { const k = Kartka(80, 40, S); const p0 = srednia(k, 0, 0, k.PW, k.PH, 1); k.slad(NARZEDZIA.wegiel, [30, 30, 30], 6, pk, 5); return p0 - srednia(k, 0, 0, k.PW, k.PH, 1); };
  assert.ok(Math.abs(ciemn(1) / ciemn(3) - 1) < 0.12, 'tyle samo pigmentu w skali 1 i 3');
  const c = a.czubek(NARZEDZIA.kredka, 2, pk, 5, 0); assert.ok(Math.hypot(c.x - 10, c.y - 20) < 1.5);
  a.czysc(); assert.equal(a.C[0], Kartka(80, 40, 2).C[0]);
});

test('rysunek: kreski i szraf zapisują się i odtwarzają co do piksela', () => {
  const r = Rysunek({ W: 120, H: 80, tytul: 'T' });
  r.etap('Szkic', 'olowek').kreska('olowek', [60, 60, 70], [[10, 10, 0.5], [60, 30, 0.9], [110, 12, 0.4]]);
  const ton = (x) => (x < 60 ? 0.9 : 0);
  r.etap('Cień', 'kredka').szraf(ton, 'kredka', [40, 80, 200], { kat: -0.9 });
  const { naglowek, bajty } = r.obraz(), ind = indeks(bajty);
  assert.equal(ind.length, naglowek.ile); assert.ok(naglowek.ile > 20);
  assert.deepEqual(naglowek.etapy.map((e) => e.narzedzie), ['olowek', 'kredka']);
  const s = odczytajSlad(bajty, ind[0]); assert.equal(s.nazwa, 'olowek'); assert.equal(s.pk.length, 9); assert.ok(Math.abs(s.pk[5] - 0.9) < 0.01);
  const lewa = srednia(r.kartka, 10, 20, 50, 70, 0), prawa = srednia(r.kartka, 75, 40, 115, 70, 0);
  assert.ok(lewa < prawa - 20, 'szraf tylko tam, gdzie ton > 0');
  const o = zTekstu(doTekstu(naglowek, bajty)), im = renderuj(o.naglowek, o.bajty, 1);
  let maxd = 0; for (let i = 0; i < r.kartka.C.length / 3; i++) maxd = Math.max(maxd, Math.abs(im.px[i * 4] - Math.round(r.kartka.C[i * 3])));
  assert.ok(maxd <= 1, `odtworzenie różni się o ${maxd}`);
  assert.equal(renderuj(o.naglowek, o.bajty, 1, { ile: 1 }).px[(60 * 120 + 30) * 4] > 200, true, 'po samym szkicu cień jeszcze pusty');
  assert.throws(() => r.kreska('flamaster', [0, 0, 0], [[0, 0], [1, 1]]));
});

test('rysownik: paleta łapie małą plamę czystego koloru, kontury idą po krawędzi', () => {
  const W = 90, H = 60, T = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = (y * W + x) * 3, c = x > 70 && y > 44 ? [230, 30, 40] : x < 45 ? [200, 200, 205] : [60, 62, 70]; T[q] = c[0]; T[q + 1] = c[1]; T[q + 2] = c[2]; }
  const p = paleta(T, W * H, 4);
  assert.ok(p.some((c) => c[0] > 180 && c[1] < 90), 'czerwień ma własną kredkę, choć zajmuje 5% wzoru');
  assert.ok(p.length === 3 && p[0][0] > p[2][0], 'od najjaśniejszej, bez powtórzeń (wzór ma trzy barwy)');
  const g = new Float32Array(W * H); for (let i = 0; i < W * H; i++) g[i] = 0.3 * T[i * 3] + 0.59 * T[i * 3 + 1] + 0.11 * T[i * 3 + 2];
  const l = kontury(g, W, H);
  assert.ok(l.length >= 1 && l[0].pts.length > 10);
  assert.ok(l[0].pts.every((q) => Math.abs(q[0] - 45) < 4 || q[1] > 40 || q[0] > 66), 'najmocniejsza linia leży na pionowej krawędzi');
});

test('rysownik: każdy styl suchy zbliża kartkę do wzoru i jest powtarzalny', () => {
  const W = 110, H = 80, cel = wzorTestowy(W, H);
  const blad = (r) => { let s = 0; for (let i = 0; i < W * H * 3; i++) s += (r.kartka.C[i] - cel[i]) ** 2; return Math.sqrt(s / (W * H * 3)); };
  for (const styl of Object.keys(STYLE_SUCHE)) {
    const pusty = blad(Rysunek({ W, H, papier: STYLE_SUCHE[styl].papier })), r = rysuj({ W, H, cel, styl });
    // akwarela na tak małej kartce (pędzel szeroki na ćwierć obrazu) zostawia więcej białego papieru
    assert.ok(blad(r) < pusty * (STYLE_SUCHE[styl].mono ? 0.9 : styl === 'akwarela' ? 0.72 : 0.62), `${styl}: ${blad(r).toFixed(1)} vs pusta kartka ${pusty.toFixed(1)}`);
    assert.ok(NAZWY.includes(STYLE_SUCHE[styl].narzedzie) && r.ile > 200);
  }
  assert.deepEqual(rysuj({ W, H, cel, styl: 'kredki' }).obraz().bajty, rysuj({ W, H, cel, styl: 'kredki' }).obraz().bajty);
});

test('akwarela: plama ma równy ton i ciemniejszy brzeg, laserunki przeświecają, lawowanie ma miękki brzeg', () => {
  const k = Kartka(120, 60, 2, { ziarno: 0 }), pk = [15, 30, 1, 60, 30, 1, 105, 30, 1];
  k.slad(NARZEDZIA.akwarela, [40, 90, 200], 16, pk, 3);
  const sr = srednia(k, 80, 56, 160, 64), brzeg = srednia(k, 80, 44, 160, 47);
  assert.ok(brzeg < sr - 8, `brzeg plamy ciemniejszy od środka (${brzeg.toFixed(0)} vs ${sr.toFixed(0)})`);
  let mn = 255, mx = 0; for (let x = 70; x < 170; x += 4) { const v = srednia(k, x, 58, x + 4, 62); mn = Math.min(mn, v); mx = Math.max(mx, v); }
  assert.ok(mx - mn < 26, `środek plamy bez pasów na łączeniach odcinków (${(mx - mn).toFixed(0)})`);
  k.slad(NARZEDZIA.akwarela, [250, 220, 40], 16, pk, 4);
  const [r, g, b] = [0, 1, 2].map((c) => srednia(k, 80, 56, 160, 64, c));
  assert.ok(g > r && g > b, `żółty laserunek na niebieskim daje zieleń (${[r, g, b].map(Math.round)})`);
  const przejscie = (nz) => {                                   // ile pikseli zajmuje brzeg plamy (od 10% do 90% tonu)
    const q = Kartka(120, 80, 2, { ziarno: 0 }); q.slad(nz, [20, 20, 20], 24, [15, 40, 1, 105, 40, 1], 2);
    const p0 = q.kolor[0], gl = p0 - srednia(q, 110, 78, 130, 82); let n = 0;
    for (let y = 0; y < 80; y++) { const d = p0 - srednia(q, 110, y, 130, y + 1); if (d > gl * 0.1 && d < gl * 0.9) n++; }
    return n;
  };
  assert.ok(przejscie(NARZEDZIA.lawowanie) > przejscie(NARZEDZIA.akwarela) * 2, 'lawowanie rozpływa się, pędzel zostawia ostry brzeg');
  const a = Kartka(80, 40, 2), c = Kartka(80, 40, 2), p2 = [10, 20, 0.7, 40, 12, 0.9, 70, 24, 0.6];
  a.slad(NARZEDZIA.akwarela, [200, 40, 40], 8, p2, 5);
  for (const [t0, t1] of [[0, 0.4], [0.4, 1]]) c.slad(NARZEDZIA.akwarela, [200, 40, 40], 8, p2, 5, t0, t1, 9);
  let maxd = 0; for (let i = 0; i < a.C.length; i++) maxd = Math.max(maxd, Math.abs(a.C[i] - c.C[i]));
  assert.ok(maxd < 0.5, `plama w kawałkach = w całości (${maxd})`);
});

test('szraf: tusz ma kreskę albo jej nie ma; szeroki pędzel nie wjeżdża w jasne miejsce obok', () => {
  const r = Rysunek({ W: 120, H: 80 });
  r.szraf((x) => (x < 60 ? 0.2 : 0.9), 'tusz', [20, 20, 20], { staly: 0.8, odstep: 3 });
  const { bajty } = r.obraz(), ind = indeks(bajty);
  for (let i = 0; i < ind.length; i++) { const s = odczytajSlad(bajty, ind[i]); for (let j = 2; j < s.pk.length; j += 3) assert.ok(s.pk[j] === 0 || Math.abs(s.pk[j] - 0.8) < 0.01, 'stały nacisk'); }
  const wjechalo = (poprzek) => {
    const q = Rysunek({ W: 120, H: 80, papier: { ziarno: 0 } });
    q.szraf((x, y) => (y > 36 && y < 44 ? 0 : 1), 'akwarela', [30, 60, 160], { kat: 0, szer: 14, odstep: 10, poprzek });
    return q.kartka.kolor[0] - srednia(q.kartka, 20, 38, 100, 42);
  };
  assert.ok(wjechalo(0) > 25 && wjechalo(14) < wjechalo(0) * 0.35, `jasny pas zostaje papierem (${wjechalo(14).toFixed(0)} vs ${wjechalo(0).toFixed(0)})`);
});

test('rysownik: przezroczysty pigment trzyma barwę wzoru i nie przeciemnia', () => {
  const W = 120, H = 80, cel = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const c = (i % W) < 60 ? [40, 150, 90] : [235, 120, 60]; cel.set(c, i * 3); }   // zieleń i oranż
  for (const styl of ['kredki', 'akwarela']) {
    const r = rysuj({ W, H, cel, styl: styl }), K = r.kartka, n = STYLE_SUCHE[styl].nasycenie;
    const z = [0, 1, 2].map((c) => srednia(K, 10, 10, 50, 70, c)), o = [0, 1, 2].map((c) => srednia(K, 70, 10, 110, 70, c));
    assert.ok(z[1] > z[0] + 40 && z[1] > z[2] + 25, `${styl}: zieleń została zielenią (${z.map(Math.round)})`);
    assert.ok(o[0] > o[1] + 50 && o[1] > o[2] + 25, `${styl}: oranż został oranżem (${o.map(Math.round)})`);
    const cz = [40, 150, 90].map((v) => 127 + (v - 127) * n);        // wzór po przesadzeniu barwy przez rysownika
    assert.ok(z[0] > Math.max(0, cz[0]) - 22 && z[2] > cz[2] - 22, `${styl}: żaden kanał nie zszedł wyraźnie poniżej wzoru (${z.map(Math.round)})`);
  }
});

test('rysownik: tusz zostawia jasne tony papierowi', () => {
  const W = 120, H = 80, cel = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const c = (i % W) < 60 ? [215, 220, 230] : [50, 45, 60]; cel.set(c, i * 3); }
  const t = rysuj({ W, H, cel, styl: 'tusz' }), pap = t.kartka.kolor[0];
  assert.ok(pap - srednia(t.kartka, 8, 8, 50, 72) < 14, 'jasna połowa prawie bez kresek');
  assert.ok(pap - srednia(t.kartka, 70, 8, 112, 72) > 70, 'ciemna połowa gęsto zaszrafowana');
});

test('rysownik: technika mieszana używa kilku narzędzi', () => {
  const W = 120, H = 80;
  const m = rysuj({ W, H, cel: wzorTestowy(W, H), styl: 'mieszane' }).obraz(), ind = indeks(m.bajty), uzyte = new Set();
  for (let i = 0; i < ind.length; i++) uzyte.add(odczytajSlad(m.bajty, ind[i]).nazwa);
  assert.ok(uzyte.has('pastel') && uzyte.has('kredka') && uzyte.size >= 3, `narzędzia: ${[...uzyte]}`);
  assert.ok(new Set(m.naglowek.etapy.map((e) => e.narzedzie)).size >= 3);
});

// ---- przypadki brzegowe (z recenzji) -------------------------------------------------------------
import { argumenty } from '../lib/argumenty.js';

test('argumenty: przełącznik nie zjada pliku, opcja bez wartości to błąd', () => {
  const a = argumenty(['--arkusz', 'obraz.json', '--czas', '40', '--skup', '1,2', '--skup', '3,4'], ['arkusz']);
  assert.equal(a.plik, 'obraz.json'); assert.equal(a.opt('arkusz'), true); assert.equal(a.opt('czas'), '40');
  assert.deepEqual(a.wiele('skup'), ['1,2', '3,4']); assert.equal(a.opt('brak', 7), 7); assert.deepEqual(a.wiele('brak'), []);
  assert.throws(() => argumenty(['x.json', '--styl', '--tytul', 'T']), /wymaga wartości/);
  assert.throws(() => argumenty(['x.json', '--out']), /wymaga wartości/);
});

test('kreska: zły nacisk, za dużo punktów i kolor spoza zakresu nie psują zapisu', () => {
  const r = Rysunek({ W: 400, H: 60 });
  r.kreska('kredka', [300, -20, 127.6], [[10, 30, NaN], [60, 30, 0.8], [110, 30, 2]]);
  r.kreska('olowek', [60, 60, 70], Array.from({ length: 400 }, (_, i) => [5 + i * 0.95, 45, 0.8]));
  const { naglowek, bajty } = r.obraz(), ind = indeks(bajty), a = odczytajSlad(bajty, ind[0]), b = odczytajSlad(bajty, ind[1]);
  assert.deepEqual(a.kol, [255, 0, 128]); assert.equal(a.pk[2], 0); assert.equal(a.pk[8], 1);
  assert.equal(b.pk.length / 3, 255); assert.ok(Math.abs(b.pk[254 * 3] - (5 + 399 * 0.95)) < 0.05, 'długa kreska sięga do końca');
  const im = renderuj(naglowek, bajty, 1); let maxd = 0;
  for (let i = 0; i < r.kartka.C.length / 3; i++) maxd = Math.max(maxd, Math.abs(im.px[i * 4] - Math.round(r.kartka.C[i * 3])));
  assert.ok(maxd <= 1, `kartka robocza i odtworzenie różnią się o ${maxd}`);
  assert.throws(() => r.kreska('kredka', [0, 0, 0], [[NaN, 1, 1], [2, 2, 1]]), /współrzędnych/);
});

test('z ręki i proporcje: wartości poza rekordem są zgłaszane, nie obcinane po cichu', () => {
  const r = Reka({ W: 600, H: 894 });
  assert.throws(() => r.pociagnij({ x: 300, y: 400, dlugosc: 500, szerokosc: 40, kolor: [0, 0, 0] }), /najwyżej/);
  assert.throws(() => r.pociagnij({ x: 300, y: NaN, dlugosc: 50, szerokosc: 40, kolor: [0, 0, 0] }), /liczbami/);
  r.pociagnij({ x: 300, y: 400, dlugosc: 100, szerokosc: 40, kolor: [255.6, 300, -5] });
  const s = odczytaj(r.obraz().bajty, 0); assert.deepEqual([s.r, s.g, s.b], [255, 255, 0]);
  assert.throws(() => rozmiarRoboczy(8), /zakresem/); assert.throws(() => rozmiarRoboczy(NaN), /zakresem/);
  assert.ok(rozmiarRoboczy(7).W < 1980);
});

test('kontury: na płaskim wzorze linia nie stoi w miejscu', () => {
  const W = 80, H = 60, g = new Float32Array(W * H).fill(100);
  for (let y = 20; y < 40; y++) for (let x = 30; x < 50; x++) g[y * W + x] = 220;       // mały kwadrat na gładkim tle
  for (const l of kontury(g, W, H)) for (let i = 1; i < l.pts.length; i++) assert.ok(Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]) > 0.2, 'kolejne punkty linii się różnią');
});
