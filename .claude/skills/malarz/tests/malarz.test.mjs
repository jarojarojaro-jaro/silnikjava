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
  assert.ok(p[0][0] > p[3][0], 'od najjaśniejszej');
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
    assert.ok(blad(r) < pusty * (STYLE_SUCHE[styl].mono ? 0.9 : 0.62), `${styl}: ${blad(r).toFixed(1)} vs pusta kartka ${pusty.toFixed(1)}`);
    assert.ok(NAZWY.includes(STYLE_SUCHE[styl].narzedzie) && r.ile > 200);
  }
  assert.deepEqual(rysuj({ W, H, cel, styl: 'kredki' }).obraz().bajty, rysuj({ W, H, cel, styl: 'kredki' }).obraz().bajty);
});
