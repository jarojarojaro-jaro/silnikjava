---
name: malarz
description: Silnik malarski w kodzie — maluje i rysuje obrazy tak, jak robi to ręka. „Malarz” kładzie tysiące pociągnięć pędzla (olej, impresjonizm, etiuda, wierna kopia), „rysownik” rysuje narzędziami suchymi na papierze z ziarnem (kredki, suche pastele, węgiel, ołówek); wzorem jest zdjęcie albo motyw wymyślony w kodzie, można też rysować z ręki. Do tego film z pracowni (pionowy 1080×1920 albo poziomy 1920×1080), na którym praca powstaje kreska po kresce. Użyj, gdy ktoś prosi o namalowanie albo narysowanie czegoś, obraz ze zdjęcia, „sztukę rysowaną kodem / JavaScriptem”, rysunek wyglądający na ręczny, film z malowania, albo pokazuje projekt w rodzaju mona-lisa-js czy p5.brush. To NIE jest silnik rysowanych filmów z src/ (ręka, lektor) ani skill voxel-ascii — osobne narzędzie w czystym JS (Node, bez zależności).
---

# malarz — obraz malowany pędzlem, pociągnięcie po pociągnięciu

Program patrzy na wzór tak, jak kopista siedzi przed oryginałem, i maluje go prawdziwymi
pociągnięciami pędzla: od szerokiego płaskiego do cienkiego okrągłego. Wynik to **lista
pociągnięć** (12 bajtów każde), nie siatka pikseli: można ją odtworzyć w dowolnej skali,
zatrzymać w dowolnym momencie i sfilmować.

Są dwie „ręce”: **malarz** (pędzel i farba olejna, `lib/malarz.js`) i **rysownik** (kredki, pastele,
węgiel, ołówek na papierze z ziarnem, `lib/rysownik.js`). Obie zapisują pracę jako listę ruchów ręki.

Wzór może być **zdjęciem / reprodukcją** albo **motywem z wyobraźni** — obrazem opisanym
funkcją w kodzie (`motywy/*.js`), bez żadnego pliku graficznego. Można też malować **z ręki**:
podawać pociągnięcia wprost (`lib/reka.js`).

## Szybki start

```bash
M=.claude/skills/malarz                                  # wymaga: Node ≥ 20, ffmpeg; do filmu: playwright
node $M/maluj.mjs zdjecie.jpg --tytul "Portret" --skup 0.5,0.3,0.15,0.18,3   # → out/malarz/zdjecie/
node $M/maluj.mjs $M/motywy/jezioro.js --styl olej       # motyw z wyobraźni
node $M/maluj.mjs $M/motywy/lato.js --styl pastele       # to samo narzędziami suchymi (16:9)
node $M/film.mjs out/malarz/jezioro/obraz.json           # film.mp4 (ok. 34 s; pion 1080×1920, panorama 1920×1080)
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

Style suche (definicje w `lib/rysownik.js`; wynik to kreski, nie pociągnięcia pędzla):

| Styl | Kresek | Czas | Charakter |
|---|---|---|---|
| `pastele` | 45–120 tys. | ok. 20–40 s | suche pastele na tonowanym papierze: kryją, żywe kolory, najlepsze do pejzaży i barwnych motywów |
| `kredki` | 110–145 tys. | ok. 30 s | kredki na jasnym papierze: warstwy szrafu, pigmenty mieszają się przez nakładanie; wychodzi ciemniej i spokojniej niż wzór |
| `wegiel` | 30–50 tys. | ok. 15 s | węgiel i biała kreda na szarym papierze, sam walor |
| `olowek` | 60–120 tys. | ok. 20 s | ołówek, szraf krzyżowy |

`--szczegol 1.5` mnoży liczbę pociągnięć. Style suche biorą `--papier r,g,b` (kolor arkusza) zamiast
`--grunt`; `--skup` i `--detal` ich nie dotyczą — rysownik sam idzie za rysunkiem wzoru. Styl to dane: etapy (pędzel, szerokości, długości,
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
5. **Narzędzia suche** (`lib/suche.js`) — papier ma mapę ziarna; suchy pigment łapie najpierw szczyty,
   a im mocniejszy nacisk (i im bardziej ziarno już zalepione), tym głębiej wchodzi w doliny.
   Pigment przezroczysty mnoży kolor pod spodem (żółta kredka na błękitnej daje zieleń), kryjący
   go zasłania; każde narzędzie (`olowek`, `kredka`, `wegiel`, `pastel`, `olejna`, `tusz`, `biel`,
   `palec` do rozcierania) ma własne proporcje. Ślad to ścieżka z naciskiem: gładka krzywa przez
   punkty, drżenie ręki, lżejsze wejście i oderwanie, falowanie nacisku.
6. **Rysownik** (`lib/rysownik.js`) — szkic ołówkiem po krawędziach wzoru → kredki dobrane do wzoru
   (kolory możliwie różne, mała plama czystego koloru dostaje własną kredkę) → rundy szrafu
   (podkład bokiem grafitu, druga warstwa pod innym kątem, kreska po formie, dociemnienie, detal)
   → kontury kolorem miejscowym i światła bielą. Przed każdą rundą rysownik patrzy na prawdziwą
   kartkę i liczy dla każdej kredki mapę tonu; w danym miejscu rysuje tylko ta, która najlepiej
   trafia w kolor, a nacisk kreski idzie za mapą.
7. **Pracownia** (`pracownia/`) — strona, która maluje obraz jako funkcję czasu tym samym
   pędzlem: pędzel rysowany włos po włosie, lupa ×4, paleta z farbami (skupiska kolorów
   pociągnięć) i śladami mieszania, lista pędzli, licznik i 12 bajtów bieżącego pociągnięcia.
   Dla rysunków: ołówek albo pałeczka w kadrze, piórnik z użytymi kredkami zamiast palety.
   Kadr jest pionowy (1080×1920), a dla prac szerszych niż 1,2:1 sam przechodzi w poziomy
   (1920×1080: praca z lewej, narzędzia w kolumnie z prawej); `--uklad pion|poziom` wymusza.
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

## Rysowanie z ręki narzędziami suchymi

```js
import { Rysunek } from './lib/rysunek.js'; import { doTekstu } from './lib/plik.js';
const r = Rysunek({ W: 977, H: 549, tytul: 'Kula', papier: { kolor: [244, 238, 226] } });
r.etap('Szkic', 'olowek').kreska('olowek', [80, 78, 84], [[100, 300, 0.4], [300, 180, 0.6], [520, 300, 0.4]]);
const ton = (x, y) => Math.max(0, 1 - Math.hypot(x - 300, y - 300) / 160);      // 0..1: ile pigmentu
r.etap('Błękit', 'kredka').szraf(ton, 'kredka', [50, 90, 190], { kat: -0.95 })   // szraf sam cieniuje naciskiem
                          .szraf(ton, 'kredka', [50, 90, 190], { kat: -0.4, dl: [16, 34] });
const { naglowek, bajty } = r.obraz();      // writeFileSync('obraz.json', doTekstu(naglowek, bajty))
```

`kreska(narzedzie, kolor, [[x, y, nacisk], …], szer?)` to jeden ruch ręki; `szraf(ton, narzedzie, kolor,
{ kat, odstep, dl, nacisk, co, kierunek })` kładzie równoległe kreski tam, gdzie funkcja `ton` jest dodatnia
(nierówny odstęp, kąt, długość i łuk — ręka nie jest liniałem). Ciemniej = więcej warstw pod innym
kątem, nie mocniejsza kreska. `r.kartka.C` to bieżący stan kartki (do pętli „spójrz i popraw”).

## Malowanie z ręki

```js
import { Reka } from './lib/reka.js'; import { doTekstu } from './lib/plik.js'; import { PLASKI, OKRAGLY } from './lib/pedzel.js';
const r = Reka({ W: 600, H: 894, tytul: 'Jabłko', styl: 'olej' });
r.etap('Tło', 40, PLASKI).pociagnij({ x: 300, y: 450, kat: 0.3, dlugosc: 360, szerokosc: 110, kolor: [60, 70, 90] });
r.etap('Błysk', 1, OKRAGLY).pociagnij({ x: 280, y: 380, kat: 1.2, dlugosc: 18, szerokosc: 3, wygiecie: 0.2, kolor: [255, 250, 235], krycie: 0.85 });
const { naglowek, bajty } = r.obraz();      // writeFileSync('obraz.json', doTekstu(naglowek, bajty))
```

Jednostki robocze: środek `x`, `y`, `kat` w radianach (0 = w prawo, rośnie w dół),
`wygiecie` −0,4…0,4; długość najwyżej 383, szerokość 145 (tyle mieści rekord). Plik działa z `odtworz.mjs` i `film.mjs` jak każdy inny.
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

- **Narzędzia suche — czego nauczyły próby:**
  - biel jako „poprawka” zamienia rysunek w drapankę: na jasnym papierze światło to papier, którego
    się nie tknęło; biel tylko jako rzadki akcent na papierze tonowanym;
  - gdy każda kredka poprawia jasność po swojemu, kolory idą w brąz, a podobne kredki nakładają tę
    samą poprawkę kilka razy (za ciemno). Dlatego w rundzie rysuje jedna kredka na miejsce;
  - paleta dobierana samą częstością gubi małe, ważne plamy (usta, turban) — stąd wybór „najdalszych”;
  - ziarno o zbyt ostrym progu daje „sól i pieprz”; próg ma być miękki, a ziarno ma się wypełniać;
  - cienkie, rzadkie kreski wyglądają jak druciki: podkład kładzie się szeroko (bokiem grafitu),
    dopiero detal zaostrzoną kredką; kreska po formie tylko tam, gdzie wzór ma wyraźny rysunek;
  - szeroka kreska przezroczystym pigmentem zalewa drobne jasne kształty (oko, okno) na zawsze:
    tam, gdzie wzór ma rysunek, podkład kładzie się wąsko; nacisk przezroczystych kredek ≤ 1,
    a ciemne rysują tylko tam, gdzie wygrywają ze wszystkimi. `maluj.mjs` wypisuje jasność wzoru
    i rysunku — rysunek wyraźnie ciemniejszy znaczy, że pigmentu jest za dużo;
  - ostra runda detalu (porównanie bez rozmycia) pomaga pastelom, a kredkom szkodzi: gonią ziarno
    papieru i liczba kresek rośnie trzykrotnie bez zysku;
  - część śladu rysowana w filmie nie może nachodzić na poprzednią (ziarno już zalepione dałoby
    więcej pigmentu niż w całości) — odcinki dzieli się bez zakładek.

## Ograniczenia

- Kredki (pigment przezroczysty) nie rozjaśnią tego, co już położone: rysunek wychodzi ciemniejszy
  i mniej nasycony niż wzór; do jaskrawych motywów lepsze są `pastele`.
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
noty MIT w `LICENCJE.md`. Do części suchej przejrzane zostały: [p5.brush](https://github.com/acamposuribe/p5.brush)
(ślad jako chmura kropek, krzywe nacisku, szraf z losowością, akwarela), agentowe „umiejętności
malarskie” (generative-painting-skills, drawn-by-code, pencil-case) i środowisko HuggingEnvs
02-watercolour (model uczony pisać kod p5.brush). Stamtąd wzięte zasady: ton = liczba warstw, a nie
czarniejsza kreska; ziarno papieru działa na ślad, nie na gotowy obraz; kierunek kreski stały dla
powierzchni; mało dużych kształtów zamiast wielu małych; oglądać wynik w pełnej rozdzielczości i
poprawiać najwyżej 2–3 razy. Kod jest własny (model ziarna z wypełnianiem i mieszanie pigmentów
przez mnożenie zamiast chmury kropek i Kubelki–Munka).

Pokrewne prace: A. Hertzmann, „Painterly Rendering with Curved Brush
Strokes of Multiple Sizes” (1998); `primitive` M. Fogle­mana; „Learning to Paint” (ICCV 2019).
