---
name: malarz
description: Malowanie obrazów pędzlem z kodu — „malarz”, który kładzie tysiące pociągnięć (olej, impresjonizm, etiuda, wierna kopia) na podstawie zdjęcia albo motywu wymyślonego w kodzie, oraz film z pracowni (pędzel, paleta, lupa; pionowo 1080×1920), na którym obraz powstaje pociągnięcie po pociągnięciu. Użyj, gdy ktoś prosi o namalowanie czegoś, obraz olejny ze zdjęcia, „malowanie kodem”, film z malowania, kopię dzieła pędzlem, albo pokazuje projekt w rodzaju mona-lisa-js. To NIE jest silnik rysowanych filmów z src/ (ręka, lektor) ani skill voxel-ascii — osobne narzędzie w czystym JS (Node, bez zależności).
---

# malarz — obraz malowany pędzlem, pociągnięcie po pociągnięciu

Program patrzy na wzór tak, jak kopista siedzi przed oryginałem, i maluje go prawdziwymi
pociągnięciami pędzla: od szerokiego płaskiego do cienkiego okrągłego. Wynik to **lista
pociągnięć** (12 bajtów każde), nie siatka pikseli: można ją odtworzyć w dowolnej skali,
zatrzymać w dowolnym momencie i sfilmować.

Wzór może być **zdjęciem / reprodukcją** albo **motywem z wyobraźni** — obrazem opisanym
funkcją w kodzie (`motywy/*.js`), bez żadnego pliku graficznego. Można też malować **z ręki**:
podawać pociągnięcia wprost (`lib/reka.js`).

## Szybki start

```bash
M=.claude/skills/malarz                                  # wymaga: Node ≥ 20, ffmpeg; do filmu: playwright
node $M/maluj.mjs zdjecie.jpg --tytul "Portret" --skup 0.5,0.3,0.15,0.18,3   # → out/malarz/zdjecie/
node $M/maluj.mjs $M/motywy/jezioro.js --styl olej       # motyw z wyobraźni
node $M/film.mjs out/malarz/jezioro/obraz.json           # film.mp4 (1080×1920, ok. 34 s)
node $M/film.mjs out/malarz/jezioro/obraz.json --arkusz  # 6 klatek filmu w jednym PNG
node $M/strona.mjs out/malarz/jezioro/obraz.json         # obraz.html: jeden plik, maluje na żywo w przeglądarce
node $M/odtworz.mjs out/malarz/jezioro/obraz.json --skala 4 --okno 0.2,0.4,0.3,0.2   # detal z bliska
node --test $M/tests/*.test.mjs                          # testy (ok. 3 s)
```

`maluj.mjs` zapisuje w `out/malarz/<nazwa>/` (katalog `out/` jest w .gitignore):
`obraz.json` (pociągnięcia), `obraz.png` (skala 2, ze światłem na fakturze), `wzor.png`,
`porownanie.png` (wzór | czysty kolor | ze światłem) i `etapy.png` (stan po każdym pędzlu).

## Style (`--styl`, definicje w `lib/style.js`)

| Styl | Pociągnięć | Czas | Charakter |
|---|---|---|---|
| `olej` (domyślny) | 15 000 | ok. 1 min | alla prima: widać pędzel, drobny detal tylko w ważnych miejscach |
| `impresja` | 11 400 | ok. 45 s | krótkie, grube dotknięcia, żywszy, „rozedrgany” kolor |
| `etiuda` | 1 200 | ok. 25 s | sam układ plam szerokim pędzlem |
| `kopia` | 62 000 | ok. 1,5 min | wierna kopia aż do linera 000 (łapie nawet spękania werniksu) |

`--szczegol 1.5` mnoży liczbę pociągnięć. Styl to dane: etapy (pędzel, szerokości, długości,
liczba), cechy pędzla (włosie, suchość, smugi), światło, ewentualnie `kolor` i `wygladz`.

## Jak to działa

1. **Pędzel** (`lib/pedzel.js`) — pociągnięcie to 7 liczb + ziarno: środek, kierunek, długość,
   szerokość, wygięcie (obrót nadgarstka), kolor, krycie; do tego rodzaj: płaski (postrzępiony
   koniec), koci język (łuk), okrągły (szpic). Maska liczy korpus, włosie (kępki i pojedyncze
   włosy), wysychanie farby ku końcowi i fakturę (grubość farby). Wszystko w jednostkach
   roboczych (obraz ma ok. 536 tys. jednostek², np. 600 × 894), więc skala renderu jest dowolna.
2. **Malarz** (`lib/malarz.js`) — pętla: „gdzie obraz jest najbardziej nie taki i które jedno
   pociągnięcie naprawi najwięcej?”. Mapa błędu ważona mapą ważności → losowe miejsce o dużym
   błędzie → 28 kandydatów (kierunek zwykle wzdłuż krawędzi wzoru, z tensora struktury) →
   dla każdego najlepszy kolor w zamkniętej postaci (najmniejsze kwadraty) i zysk → 44 mutacje
   najlepszego → położenie. Kandydat jest zaokrąglany do rekordu przed oceną, więc film kładzie
   dokładnie to, co malarz ocenił. Deterministyczny (ziarno `--ziarno`).
3. **Mapa ważności** (`lib/pole.js`) — automatycznie z drobnego rysunku wzoru (`--detal`) plus
   ręczne skupienia `--skup x,y,rx,ry,waga` (ułamki szerokości i wysokości). Etapy z `skup`
   kładą drobne pędzle prawie tylko tam — jak malarz: luźne tło, dopracowany punkt uwagi.
4. **Światło** (`oswietl`) — z grubości farby i splotu płótna liczy delikatny relief oświetlony
   z lewej góry. Kolor ocenia się bez światła; światło jest tylko w podglądzie i filmie.
5. **Pracownia** (`pracownia/`) — strona, która maluje obraz jako funkcję czasu tym samym
   pędzlem: pędzel rysowany włos po włosie, lupa ×4, paleta z farbami (skupiska kolorów
   pociągnięć) i śladami mieszania, lista pędzli, licznik i 12 bajtów bieżącego pociągnięcia.
   `film.mjs` zrzuca klatki przez Chromium i koduje MP4; `strona.mjs` pakuje pracownię i obraz
   do jednego pliku HTML (bez sieci i grafik; spacja = pauza, R = od nowa).

## Procedura (zawsze w tej kolejności)

1. **Obejrzyj wzór** (Read na pliku). Zanotuj, gdzie jest punkt uwagi (twarz, oczy, dłonie,
   słońce) i podaj go przez `--skup`. Bez tego twarz dostaje tyle uwagi co tło.
2. `maluj.mjs` → **obejrzyj `porownanie.png`** i wycinek twarzy/detalu przez
   `odtworz.mjs --skala 3 --okno …`. Kryterium: z daleka obraz, z bliska pociągnięcia.
3. Dobierz styl do tematu: portret/klasyka → `olej` albo `kopia`; pejzaż, kwiaty → `impresja`;
   plakatowa prostota → `etiuda`. Zły wynik zwykle naprawia `--skup`, nie więcej pociągnięć.
4. `film.mjs --arkusz` → obejrzyj 6 klatek (czy nic się nie nakłada, czy tytuł się mieści),
   dopiero potem pełny film; na koniec `ffprobe` i 2–3 klatki z MP4.
5. Tytuł i autor: `--tytul "Dziewczyna z perłą" --autor "wg Vermeera"` (idą na planszę filmu).

## Motyw z wyobraźni

Plik `motywy/<nazwa>.js` eksportuje `wzor(W, H)` (Float32Array RGB 0..255) i opcjonalnie
`TYTUL`, `AUTOR`, `PROPORCJA` (szer./wys.), `GRUNT`, `SKUPIENIA`. Najprościej przez
szkicownik (`lib/szkic.js`): funkcja `kolor(u, v)` dla u, v w 0..1 + klocki `pasmo`
(gradient z przystanków), `fbm`/`szum` (chmury, skały, zmarszczki), `gladko`, `miesz`, `h2`.

```js
import { namaluj, pasmo, fbm, gladko, miesz } from '../lib/szkic.js';
export const TYTUL = 'Wzgórza', PROPORCJA = 2 / 3;
const kolor = (u, v) => {
  let c = pasmo([[0, [0.2, 0.3, 0.6]], [0.6, [1, 0.8, 0.6]]], v);          // niebo
  const grzbiet = 0.6 - 0.1 * fbm(u * 3, 0.5);
  if (v > grzbiet) c = miesz([0.2, 0.35, 0.25], [0.5, 0.55, 0.3], gladko(0, 0.3, v - grzbiet));
  return c;
};
export const wzor = (W, H) => namaluj(W, H, kolor);
```

Wzorzec do skopiowania: `motywy/jezioro.js` (niebo z chmurami świeconymi od dołu, dwa pasma
gór z mgłą, lasy, chata, **odbicie w wodzie przez ponowne wywołanie funkcji świata**, brzeg,
sosna). Zasady: najpierw obejrzyj `wzor.png` — pędzel dodaje fakturę, ale nie naprawi
kompozycji; buduj od tyłu do przodu (niebo → dal → plan środkowy → pierwszy plan); kontrast
ciepłe/zimne i jeden jasny punkt uwagi; kształty mogą być proste, malarz i tak je „rozmaluje”.

## Malowanie z ręki

```js
import { Reka } from './lib/reka.js'; import { doTekstu } from './lib/plik.js'; import { PLASKI, OKRAGLY } from './lib/pedzel.js';
const r = Reka({ W: 600, H: 894, tytul: 'Jabłko', styl: 'olej' });
r.etap('Tło', 40, PLASKI).pociagnij({ x: 300, y: 450, kat: 0.3, dlugosc: 500, szerokosc: 110, kolor: [60, 70, 90] });
r.etap('Błysk', 1, OKRAGLY).pociagnij({ x: 280, y: 380, kat: 1.2, dlugosc: 18, szerokosc: 3, wygiecie: 0.2, kolor: [255, 250, 235], krycie: 0.85 });
const { naglowek, bajty } = r.obraz();      // writeFileSync('obraz.json', doTekstu(naglowek, bajty))
```

Jednostki robocze: środek `x`, `y`, `kat` w radianach (0 = w prawo, rośnie w dół),
`wygiecie` −0,4…0,4. Plik działa z `odtworz.mjs` i `film.mjs` jak każdy inny.
Z ręki dobrze wychodzą akcenty i proste układy; cały obraz z kilkudziesięciu pociągnięć wymaga
wielu poprawek „na oko” (render → obejrzyj → popraw) — do pełnych kompozycji lepszy jest motyw.

## Pułapki (z prób)

- **Światło na fakturze łatwo przesadzić.** Pierwsza wersja dawała „pognieciony papier” na
  twarzy: każde pociągnięcie miało płaskowyż i ostry brzeg. Teraz faktura to bruzdy włosia
  o średniej zero, cienkie pędzle są prawie płaskie, a mapa wysokości jest wygładzana.
  `swiatlo.sila` trzymaj w 0,3–0,75; ocena koloru zawsze bez światła.
- **Zdjęcie ma szum, spękania i kurz** — malarz je skopiuje jako ciemne kropki. Style poza
  `kopia` rozmywają wzór (`wygladz`), żeby malować formę.
- **Splot płótna jako `sin·sin` daje ukośne prążki** na pustym płótnie; ma być siatka wzdłuż
  osi (`cos x + cos y`).
- **Tempo filmu:** czas pociągnięcia ∝ √(długość × szerokość); przy wykładniku 0,75 podmalówka
  zjadała połowę filmu i obraz „pojawiał się” dopiero pod koniec.
- **RMSE to nie jakość.** `kopia` na ostrej reprodukcji ma ok. 3–4 (bo wzór ma spękania),
  `olej` 5–7 — i wygląda bardziej malarsko. Patrz na obraz, nie na liczbę.
- Etap może położyć mniej pociągnięć, niż zapisano (gdy żadne już nie poprawia obrazu) — to
  nie błąd; na ciemnych, gładkich tłach szerokie pędzle kończą wcześniej.
- Paczka `playwright` z repo może chcieć innej wersji Chromium niż zainstalowana: `film.mjs`
  sam próbuje `/opt/pw-browsers/chromium`; inaczej ustaw `CHROMIUM_PATH`.

## Ograniczenia

- Kadr filmu jest pionowy (1080×1920); obraz poziomy mieści się, ale zostaje dużo ściany.
- Malarz nie „rozumie” tematu: twarz trzeba mu wskazać (`--skup`). Farby mieszają się jak
  kolory RGB (krycie), nie jak pigmenty; nie ma rozcierania mokrej farby.
- Film bez dźwięku. Czas: malowanie 0,5–1,5 min, film 34 s ≈ 2,5 min na 4 rdzeniach.
- Wzoru (zdjęcia) nie ma w `obraz.json` — zostaje tylko w `out/…/wzor.png`. Reprodukcje
  cudzych dzieł bierz z domeny publicznej.

## Źródła i licencje

Pomysł i układ rozwiązania (pędzel jako maska, rekord 12 bajtów, zachłanny malarz z kolorem
z najmniejszych kwadratów, pracownia z lupą i paletą) pochodzą z projektu
[ChetasLua/mona-lisa-js](https://github.com/ChetasLua/mona-lisa-js) (MIT, © 2026 Chetas Lua),
który sam powołuje się na wpis Kevina T. Ngo. Kod tutaj jest napisany od nowa i rozszerzony
(rodzaje pędzli, style, automatyczna mapa ważności, skupianie detalu, wygładzanie wzoru,
światło na fakturze, motywy z wyobraźni, malowanie z ręki, film pionowy), z zachowaniem
noty MIT w `LICENCJE.md`. Pokrewne prace: A. Hertzmann, „Painterly Rendering with Curved Brush
Strokes of Multiple Sizes” (1998); `primitive` M. Fogle­mana; „Learning to Paint” (ICCV 2019).
