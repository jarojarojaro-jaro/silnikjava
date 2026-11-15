// sam.js — szkicownik: malujesz sam, tymi samymi narzędziami co rysownik (ołówek, kredka, węgiel,
// pastele, tusz, biel, akwarela, lawowanie, palec) na tej samej kartce z ziarnem. Każdy ruch ręki
// zapisuje się jako ślad w formacie malarz/1, więc własny rysunek można odtworzyć, wyrenderować
// (odtworz.mjs) i sfilmować w pracowni (film.mjs) jak każdy inny.
//
// Ślad rysowany na żywo: przed dotknięciem zapamiętujemy kartkę, a przy każdym ruchu cofamy zmieniony
// prostokąt i kładziemy cały dotychczasowy ślad od nowa — dzięki temu kreska ma na końcu lżejsze
// oderwanie, a pigment nie nakłada się sam na siebie. Po oderwaniu ślad jest zaokrąglany do rekordu
// i rysowany ostatni raz dokładnie tak, jak odtworzy go film.

import { Kartka, NARZEDZIA, NAZWY, ETYKIETY, ziarnoSladu } from '../lib/suche.js';
import { zakodujSlad, odczytajSlad, indeks } from '../lib/rysunek.js';
import { doTekstu, zTekstu } from '../lib/plik.js';
import { rozmiarRoboczy } from '../lib/style.js';

const $ = (id) => document.getElementById(id);
const PAPIERY = { jasny: { kolor: [246, 241, 230], ziarno: 1 }, tonowany: { kolor: [205, 190, 168], ziarno: 1.1 }, szary: { kolor: [176, 172, 166], ziarno: 1.15 }, akwarelowy: { kolor: [250, 247, 238], ziarno: 0.85 } };
const FORMATY = { '4:3': 4 / 3, '16:9': 16 / 9, '1:1': 1, '3:4': 3 / 4 };
const KOLEJNOSC = ['olowek', 'kredka', 'wegiel', 'pastel', 'olejna', 'tusz', 'biel', 'akwarela', 'lawowanie', 'palec'];
const STALE = { olowek: [58, 57, 62], wegiel: [34, 31, 30], tusz: [24, 22, 27], biel: [255, 253, 246] };   // narzędzia o własnej barwie
const BARWY = [[196, 40, 46], [232, 92, 44], [243, 156, 42], [247, 208, 60], [250, 236, 150], [166, 196, 62], [72, 150, 70], [30, 96, 72], [44, 150, 150], [70, 160, 220], [40, 96, 190], [28, 48, 120], [112, 78, 180], [170, 92, 170], [226, 120, 160], [250, 190, 180], [236, 200, 160], [196, 140, 96], [140, 88, 56], [86, 56, 40], [150, 150, 150], [90, 92, 100], [40, 40, 46], [252, 250, 244]];
const SCHOWEK = 'szkicownik-malarza/1';

const plotno = $('kartka'), g = plotno.getContext('2d');
let K, W, H, S, img, papier = 'jasny', format = '4:3';
let slady = [];                 // rekordy śladów (Uint8Array) w kolejności rysowania
let narzedzie = 'kredka', kolor = [40, 96, 190], barwa = [40, 96, 190], grubosc = 2, nacisk = 0.8, odtwarzanie = null, przyklad = false;

// ---- kartka ---------------------------------------------------------------------------------
function nowaKartka() {
  ({ W, H } = rozmiarRoboczy(FORMATY[format]));
  const pole = $('pole').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const css = Math.min(pole.width / W, pole.height / H);
  S = Math.max(0.6, Math.min(2, css * dpr, Math.sqrt(1.5e6 / (W * H))));        // najwyżej ok. 1,5 mln pikseli: płynnie także na telefonie
  K = Kartka(W, H, S, PAPIERY[papier]);
  plotno.width = K.PW; plotno.height = K.PH;
  plotno.style.width = `${Math.floor(W * css)}px`; plotno.style.height = `${Math.floor(H * css)}px`;
  $('kalka').style.width = plotno.style.width; $('kalka').style.height = plotno.style.height;
  img = new ImageData(K.PW, K.PH);
  pokaz();
}
function pokaz(x0 = 0, y0 = 0, x1 = K.PW, y1 = K.PH) {
  x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(K.PW, Math.ceil(x1)); y1 = Math.min(K.PH, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;
  K.piksele(img.data, x0, y0, x1, y1); g.putImageData(img, 0, 0, x0, y0, x1 - x0, y1 - y0);
}
const s = {};
function odtworzWszystko(doo = slady.length) {
  K.czysc();
  for (let i = 0; i < doo; i++) { odczytajSlad(slady[i], 0, s); K.slad(s.nz, s.kol, s.szer, s.pk, s.seed); }
  pokaz();
}

// ---- rysowanie -------------------------------------------------------------------------------
let ruch = null;                // ślad w trakcie: { pts, migawka, brud: [x0,y0,x1,y1], … }
const naKartce = (e) => { const r = plotno.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
const szerokosc = () => NARZEDZIA[narzedzie].szer * grubosc;
function naciskZ(e, v) {        // rysik podaje nacisk sam; przy palcu i myszy lżej, gdy ręka idzie szybko
  if (e.pointerType === 'pen' && e.pressure > 0) return Math.min(1, 0.15 + e.pressure * 1.1) * nacisk;
  return nacisk * Math.max(0.5, Math.min(1, 1.15 - v / 2600));
}
function rysujRuch(koniec) {
  const r = ruch, nz = NARZEDZIA[r.narzedzie];
  if (r.brud) K.przywroc(r.migawka, ...r.brud);
  let stary = r.brud;
  if (r.pts.length >= 2) {
    let pk, szer = r.szer, kol = r.kolor, seed = r.seed;
    if (koniec) { const z = zakodujSlad(r.narzedzie, r.kolor, r.pts, r.szer, r.seed); pk = z.pk; szer = z.szer; kol = z.kol; r.rekord = z.b; }
    else { pk = new Float32Array(r.pts.length * 3); r.pts.forEach((p, i) => pk.set(p, i * 3)); }
    K.slad(nz, kol, szer, pk, seed);
    r.brud = K.x1 > K.x0 ? [K.x0 - 2, K.y0 - 2, K.x1 + 2, K.y1 + 2] : null;
  }
  const b = r.brud;
  if (stary && b) pokaz(Math.min(stary[0], b[0]), Math.min(stary[1], b[1]), Math.max(stary[2], b[2]), Math.max(stary[3], b[3]));
  else if (stary || b) pokaz(...(stary ?? b));
}
plotno.addEventListener('pointerdown', (e) => {
  if (odtwarzanie) { stopOdtwarzania(); return; }
  if (e.button > 0 || ruch) return;
  e.preventDefault(); plotno.setPointerCapture(e.pointerId);
  if (przyklad) { slady = []; przyklad = false; K.czysc(); pokaz(); $('wzmianka').hidden = true; }
  const [x, y] = naKartce(e);
  ruch = { id: e.pointerId, narzedzie, kolor: kolor.slice(), szer: szerokosc(), seed: ziarnoSladu(slady.length), pts: [[x, y, naciskZ(e, 0)]], migawka: K.migawka(), brud: null, t: e.timeStamp, x, y };
});
plotno.addEventListener('pointermove', (e) => {
  if (!ruch || e.pointerId !== ruch.id) return;
  e.preventDefault();
  for (const q of (e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e])) {
    const [x, y] = naKartce(q), d = Math.hypot(x - ruch.x, y - ruch.y), co = Math.max(1.6, ruch.szer * 0.3);
    if (d < co) continue;
    const dt = Math.max(1, q.timeStamp - ruch.t), v = d / dt * 1000;
    ruch.pts.push([x, y, naciskZ(q, v)]); ruch.x = x; ruch.y = y; ruch.t = q.timeStamp;
  }
  rysujRuch(false);
});
function koniecRuchu(e) {
  if (!ruch || e.pointerId !== ruch.id) return;
  if (ruch.pts.length === 1) ruch.pts.push([ruch.x + 0.6, ruch.y + 0.6, ruch.pts[0][2]]);       // samo dotknięcie zostawia kropkę
  rysujRuch(true);
  if (ruch.rekord) { slady.push(ruch.rekord); zapamietaj(); }
  ruch = null; licznik();
}
plotno.addEventListener('pointerup', koniecRuchu); plotno.addEventListener('pointercancel', koniecRuchu);

// ---- plik rysunku (malarz/1) ------------------------------------------------------------------
function plik() {
  let dl = 0; for (const b of slady) dl += b.length;
  const bajty = new Uint8Array(dl); let q = 0; for (const b of slady) { bajty.set(b, q); q += b.length; }
  // etapy do filmu: kolejne ciągi śladów tym samym narzędziem (najwyżej 8 pozycji na liście)
  let etapy = [];
  slady.forEach((b, i) => { const nz = NAZWY[b[0]] ?? 'olowek'; if (etapy.at(-1)?.narzedzie === nz) etapy.at(-1).koniec = i + 1; else etapy.push({ nazwa: ETYKIETY[nz][0].toUpperCase() + ETYKIETY[nz].slice(1), narzedzie: nz, koniec: i + 1 }); });
  if (etapy.length > 8) { const n = slady.length; etapy = Array.from({ length: 6 }, (_, k) => { const koniec = Math.round((k + 1) * n / 6), e = etapy.find((x) => x.koniec >= koniec) ?? etapy.at(-1); return { nazwa: `Część ${k + 1}`, narzedzie: e.narzedzie, koniec }; }); }
  const naglowek = { rodzaj: 'rysunek', W, H, papier: { ...PAPIERY[papier], seed: 7 }, tytul: $('tytul').value.trim() || 'Bez tytułu', autor: $('autor').value.trim(), styl: 'z ręki', etapy, ile: slady.length, szkicownik: { papier, format } };
  return doTekstu(naglowek, bajty);
}
function wczytaj(tekst) {
  const { naglowek: n, bajty } = zTekstu(tekst);
  if (n.rodzaj !== 'rysunek') throw new Error('to obraz olejny — szkicownik otwiera rysunki');
  papier = n.szkicownik?.papier ?? 'jasny'; format = n.szkicownik?.format ?? '4:3';
  nowaKartka();
  const ind = indeks(bajty); slady = Array.from(ind, (q, i) => bajty.slice(q, i + 1 < ind.length ? ind[i + 1] : bajty.length));
  if (n.tytul && n.tytul !== 'Bez tytułu') $('tytul').value = n.tytul; $('autor').value = n.autor ?? '';
  odtworzWszystko(); licznik(); ustawPola();
}
function zapamietaj() { try { localStorage.setItem(SCHOWEK, plik()); } catch { /* bez schowka też działa */ } }

// ---- odtwarzanie: rysunek powstaje jeszcze raz, ślad po śladzie -------------------------------
function odtworz() {
  if (odtwarzanie || !slady.length) return;
  const wagi = slady.map((b) => { odczytajSlad(b, 0, s); return (s.dl + 8) * Math.sqrt(0.5 + s.szer / 3); }), suma = wagi.reduce((a, b) => a + b, 0);
  const czas = Math.max(2500, Math.min(22000, slady.length * 260)), t0 = performance.now(); let i = 0, cz = 0, kum = 0;
  K.czysc(); pokaz(); $('odtworz').textContent = 'Stop'; document.body.classList.add('gra');
  const krok = (teraz) => {
    const cel = (teraz - t0) / czas * suma; let x0 = K.PW, y0 = K.PH, x1 = 0, y1 = 0;
    while (i < slady.length && kum + wagi[i] * cz < cel) {
      const f = Math.min(1, (cel - kum) / wagi[i]); odczytajSlad(slady[i], 0, s);
      K.slad(s.nz, s.kol, s.szer, s.pk, s.seed, cz, f, i);
      if (K.x1 > K.x0) { x0 = Math.min(x0, K.x0); y0 = Math.min(y0, K.y0); x1 = Math.max(x1, K.x1); y1 = Math.max(y1, K.y1); }
      if (f >= 1) { kum += wagi[i]; i++; cz = 0; } else { cz = f; break; }
    }
    pokaz(x0, y0, x1, y1);
    if (i < slady.length) odtwarzanie = requestAnimationFrame(krok); else stopOdtwarzania();
  };
  odtwarzanie = requestAnimationFrame(krok);
}
function stopOdtwarzania() {
  if (!odtwarzanie) return;
  cancelAnimationFrame(odtwarzanie); odtwarzanie = null; $('odtworz').textContent = 'Odtwórz'; document.body.classList.remove('gra');
  odtworzWszystko();
}

// ---- interfejs --------------------------------------------------------------------------------
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
function licznik() { $('ile').textContent = slady.length ? `${slady.length} ${slady.length === 1 ? 'ślad' : slady.length < 5 ? 'ślady' : 'śladów'}` : 'czysta kartka'; $('cofnij').disabled = !slady.length; $('odtworz').disabled = !slady.length; }
function ustawNarzedzie(n) {
  narzedzie = n; kolor = STALE[n] ?? barwa;
  for (const b of $('narzedzia').children) b.setAttribute('aria-pressed', b.dataset.n === n);
  $('barwy').classList.toggle('stala', !!STALE[n] || n === 'palec');
  $('probka').style.background = n === 'palec' ? 'transparent' : css(kolor);
  $('gruboscW').textContent = `${(NARZEDZIA[n].szer * grubosc).toFixed(1)}`;
}
function ustawBarwe(c) {
  barwa = c.slice(); if (!STALE[narzedzie]) kolor = barwa;
  for (const b of $('barwy').querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.c === c.join(','));
  $('probka').style.background = narzedzie === 'palec' ? 'transparent' : css(kolor);
}
function ustawPola() { for (const b of $('papiery').children) b.setAttribute('aria-pressed', b.dataset.p === papier); for (const b of $('formaty').children) b.setAttribute('aria-pressed', b.dataset.f === format); }
for (const n of KOLEJNOSC) { const b = document.createElement('button'); b.type = 'button'; b.dataset.n = n; b.textContent = n === 'lawowanie' ? 'lawowanie' : ETYKIETY[n]; b.addEventListener('click', () => ustawNarzedzie(n)); $('narzedzia').append(b); }
for (const c of BARWY) { const b = document.createElement('button'); b.type = 'button'; b.dataset.c = c.join(','); b.style.background = css(c); b.setAttribute('aria-label', `kolor ${c.join(', ')}`); b.addEventListener('click', () => ustawBarwe(c)); $('barwy').append(b); }
$('wlasna').addEventListener('input', (e) => { const h = e.target.value; ustawBarwe([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))); });
$('grubosc').addEventListener('input', (e) => { grubosc = Number(e.target.value); ustawNarzedzie(narzedzie); });
$('nacisk').addEventListener('input', (e) => { nacisk = Number(e.target.value); $('naciskW').textContent = `${Math.round(nacisk * 100)}%`; });
$('cofnij').addEventListener('click', () => { if (odtwarzanie || !slady.length) return; slady.pop(); odtworzWszystko(); zapamietaj(); licznik(); });
$('odtworz').addEventListener('click', () => (odtwarzanie ? stopOdtwarzania() : odtworz()));
addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('cofnij').click(); } });

// panele: nowa kartka, zapis
const otworz = (id) => { stopOdtwarzania(); for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== id; $('zaslona').hidden = false; };
const zamknij = () => { for (const p of document.querySelectorAll('.panel')) p.hidden = true; $('zaslona').hidden = true; };
$('zaslona').addEventListener('click', (e) => { if (e.target === $('zaslona')) zamknij(); });
for (const b of document.querySelectorAll('[data-zamknij]')) b.addEventListener('click', zamknij);
$('nowa').addEventListener('click', () => { ustawPola(); otworz('panelNowa'); });
for (const b of $('papiery').children) b.addEventListener('click', () => { papier = b.dataset.p; ustawPola(); });
for (const b of $('formaty').children) b.addEventListener('click', () => { format = b.dataset.f; ustawPola(); });
$('zacznij').addEventListener('click', () => { slady = []; przyklad = false; $('wzmianka').hidden = true; nowaKartka(); zapamietaj(); licznik(); zamknij(); });
// Zapis plików: strona opublikowana jako artefakt nie może sama niczego pobrać — prosi o to gospodarza
// (widz potwierdza zapis); strona otwarta z dysku pobiera zwyczajnie.
let zapisGospodarza = null; window.claude?.use?.('downloads').then((d) => { zapisGospodarza = d; });
const zDysku = location.protocol === 'file:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const nazwaPliku = () => ($('tytul').value.trim() || 'rysunek').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, '-').replace(/^-|-$/g, '') || 'rysunek';
async function zapiszPlik(nazwa, dane) {
  if (zapisGospodarza) {
    try { await zapisGospodarza.save({ filename: nazwa, data: dane }); $('skopiowano').textContent = `Zapisano ${nazwa}.`; }
    catch (e) { $('skopiowano').textContent = e?.code === 'declined' ? 'Zapis anulowany.' : 'Tutaj nie da się zapisać pliku. Przytrzymaj obraz albo skopiuj plik rysunku.'; }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(dane); a.download = nazwa; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$('pobierzPng').addEventListener('click', () => plotno.toBlob((b) => zapiszPlik(`${nazwaPliku()}.png`, b), 'image/png'));
$('pobierzJson').addEventListener('click', () => zapiszPlik(`${nazwaPliku()}.json`, new Blob([plik()], { type: 'application/json' })));
$('zapisz').addEventListener('click', () => {
  $('podglad').src = plotno.toDataURL('image/png'); $('skopiowano').textContent = '';
  $('pobieranie').hidden = !(zapisGospodarza || zDysku);
  otworz('panelZapisz');
});
$('kopiuj').addEventListener('click', async () => {
  const t = plik();
  try { await navigator.clipboard.writeText(t); $('skopiowano').textContent = `Skopiowano plik rysunku (${Math.ceil(t.length / 1024)} KB).`; }
  catch { $('tekstPliku').value = t; $('tekstPliku').hidden = false; $('tekstPliku').select(); $('skopiowano').textContent = 'Zaznaczyłem plik niżej — skopiuj go ręcznie.'; }
});
$('wklej').addEventListener('click', () => { $('tekstPliku').hidden = false; $('tekstPliku').value = ''; $('tekstPliku').placeholder = 'Wklej tutaj plik rysunku i naciśnij „Otwórz wklejony”.'; $('otworzWklejony').hidden = false; $('tekstPliku').focus(); });
$('otworzWklejony').addEventListener('click', () => { try { wczytaj($('tekstPliku').value); przyklad = false; $('wzmianka').hidden = true; zapamietaj(); zamknij(); } catch (e) { $('skopiowano').textContent = `Nie udało się otworzyć: ${e.message}`; } });
// kalka: zdjęcie pod spodem do odrysowania (nie trafia do rysunku)
$('kalkaPlik').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('kalka').src = r.result; $('kalka').hidden = false; $('kalkaWyl').hidden = false; }; r.readAsDataURL(f); e.target.value = ''; });
$('kalkaWyl').addEventListener('click', () => { $('kalka').hidden = true; $('kalkaWyl').hidden = true; });

// ---- przykład na start: kilka śladów każdym rodzajem narzędzia ---------------------------------
function rysujPrzyklad() {
  const kr = (nz, kol, pts, szer) => { const z = zakodujSlad(nz, kol, pts, szer ?? NARZEDZIA[nz].szer, ziarnoSladu(slady.length)); K.slad(z.nz, z.kol, z.szer, z.pk, ziarnoSladu(slady.length)); slady.push(z.b); };
  const fala = (x0, x1, y, amp, n, f = 1, p = 0.8) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [x0 + (x1 - x0) * t, y + amp * Math.sin(t * Math.PI * f + y), p * (0.7 + 0.3 * Math.sin(t * Math.PI))]; });
  for (let i = 0; i < 9; i++) kr('lawowanie', [70, 150, 215], fala(-10, W + 10, H * (0.04 + i * 0.042), 5, 9, 1.3, 0.8 - i * 0.075), 34);     // niebo: lawowania zachodzą na siebie
  for (let i = 0; i < 5; i++) kr('lawowanie', [247, 186, 120], fala(-10, W + 10, H * (0.40 + i * 0.04), 4, 9, 1, 0.3 + i * 0.09), 30);
  const sx = W * 0.68, sy = H * 0.33, r = H * 0.07;
  for (let i = 0; i < 7; i++) kr('pastel', [250, 214, 90], Array.from({ length: 12 }, (_, k) => { const a = k / 11 * 5.5 + i; return [sx + Math.cos(a) * r * (0.2 + i * 0.12), sy + Math.sin(a) * r * (0.2 + i * 0.12), 0.9]; }), 7);
  const grzbiet = (x) => H * (0.62 - 0.1 * Math.sin(x / W * 3.4 + 0.6) - 0.05 * Math.sin(x / W * 9));
  for (let i = 0; i < 12; i++) kr('akwarela', i < 5 ? [96, 150, 96] : [52, 108, 84], Array.from({ length: 11 }, (_, k) => { const x = -10 + (W + 20) * k / 10; return [x, grzbiet(x) + 13 + i * H * 0.036, 0.7 + 0.02 * i]; }), 30);
  kr('olowek', STALE.olowek, Array.from({ length: 24 }, (_, k) => { const x = W * k / 23; return [x, grzbiet(x), 0.6]; }), 1.6);
  const dx = W * 0.26, dy = grzbiet(dx) + 4, korona = dy - H * 0.17;           // drzewo: pień węglem, korona kredkami
  kr('wegiel', STALE.wegiel, [[dx - 1, dy, 0.95], [dx + 1, dy - H * 0.07, 0.85], [dx, korona + 6, 0.6]], 5);
  for (let i = 0; i < 46; i++) { const a = i * 2.4, rr = H * 0.085 * Math.sqrt((i + 1) / 46), cx = dx + Math.cos(a) * rr * 1.15, cy = korona + Math.sin(a) * rr; kr('kredka', i % 3 ? [30, 96, 72] : [86, 160, 70], [[cx - 10, cy + 8, 0.7], [cx, cy, 1], [cx + 10, cy - 8, 0.7]], 4.2); }
  for (let i = 0; i < 11; i++) kr('tusz', STALE.tusz, [[W * 0.52 + i * 12, H * 0.93, 0.8], [W * 0.52 + i * 12 + 5, H * 0.93 - 18 - (i % 3) * 8, 0.5]], 1.4);    // trawy piórkiem
  kr('biel', STALE.biel, fala(W * 0.56, W * 0.82, H * 0.2, 5, 8, 1, 0.9), 4);                 // smuga chmury białą kredką
  pokaz();
}

// ---- start -------------------------------------------------------------------------------------
let zapisany = null; try { zapisany = localStorage.getItem(SCHOWEK); } catch { /* brak schowka */ }
let wznowiono = false;
if (zapisany) { try { wczytaj(zapisany); wznowiono = slady.length > 0; } catch { /* stary albo zepsuty szkic: zaczynamy od przykładu */ } }
if (!wznowiono) { slady = []; if (innerWidth < innerHeight * 0.8) format = '3:4'; nowaKartka(); rysujPrzyklad(); przyklad = true; $('wzmianka').hidden = false; }
ustawNarzedzie(narzedzie); ustawBarwe(barwa); ustawPola(); licznik();
let czekaj = 0; addEventListener('resize', () => { clearTimeout(czekaj); czekaj = setTimeout(() => { if (!ruch && !odtwarzanie) { nowaKartka(); odtworzWszystko(); } }, 200); });
window.__szkicownik = { plik, wczytaj, get ile() { return slady.length; }, get przyklad() { return przyklad; } };
