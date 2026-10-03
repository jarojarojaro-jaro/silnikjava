# silnikjava

Silnik JavaScript do **rysowanych animacji i filmów objaśniających** (explainer
videos): kreska piórem z naciskiem i drganiem, zamalowywanie kredką z ziarnem
papieru, pismo odręczne, ołówek rysujący na oczach widza, kamera, ścieranie
tablicy, sterowanie scrollem i eksport do wideo. Czysty JS (moduły ES), canvas
2D, bez zależności i bez kroku budowania.

![Scena Tablica](docs/img/silnik-hero.gif)

Styl i technika wzorowane na animacjach z [stentor.studio](https://stentor.studio)
— szczegółowa analiza klatka po klatce w [docs/ANALIZA.md](docs/ANALIZA.md).

## Start

```bash
npm start            # serwer statyczny na http://localhost:8080
npm test             # testy jednostkowe (node:test)
```

Otwórz `http://localhost:8080` — galeria z demami:

| demo | co pokazuje |
| --- | --- |
| `examples/hero.html` | nagłówek w stylu stentor.studio: jedna ręka prowadzi główny wątek, tło dorysowuje się równolegle, maskotka śledzi ołówek wzrokiem |
| `examples/explainer.html` | film ze `Storyboard`: kamera, ścieranie, odtwarzacz z suwakiem, nagrywanie WebM |
| `examples/narrated.html` | explainer z lektorem: głos, synchronizacja ze słowami, napisy na żywo |
| `examples/scroll.html` | diagram budujący się podczas przewijania (sticky canvas + lista) |
| `examples/styles.html` | trzy style (kreda, blueprint, neon), każdy jako ~15 s film z lektorem |

## Najkrótszy film

```html
<link href="https://fonts.googleapis.com/css2?family=Caveat&family=Caveat+Brush&display=swap" rel="stylesheet" />
<canvas id="c"></canvas>
<script type="module">
  import { Player, Storyboard, rect, line, curve } from './src/index.js';

  const sb = new Storyboard({ w: 1280, h: 720 });
  sb.write('Jak działa agent?', 640, 110, { size: 72, font: 'title', align: 'center' });
  const box = rect(520, 260, 240, 160);
  sb.pen(box, { color: 'ink' });                       // ołówek obrysowuje
  sb.crayon(box, { color: 'teal' });                    // kredka zamalowuje (pod konturem)
  sb.write('LLM', 640, 365, { size: 80, align: 'center' });
  sb.arrow(curve([[770, 340], [900, 300], [1000, 340]]));
  sb.camera({ x: 640, y: 340, zoom: 1.8 }, { dur: 1.2 });
  sb.wait(1).camera({ zoom: 1 }).clear();               // zjazd kamerą i starcie tablicy
  sb.write('Koniec!', 640, 360, { size: 90, align: 'center' });

  new Player(document.getElementById('c'), sb.scene());
</script>
```

Ołówek ma ciągłą trajektorię przez cały film (`HandTrack`). Prowadzi kreski,
koloruje kredką, pisze litery, przelatuje łukiem do kolejnego elementu, czeka
obok rysunku i na końcu schodzi z kadru. Czas kroku wynika z modelu ręki: każda
kreska ma powolny start i koniec, ręka zwalnia na zakrętach, a między kreskami
podnosi ołówek. Można też podać czas wprost przez `dur`.

## Architektura

```
src/
  math.js        clamp, lerp, szum 1D, RNG z ziarnem, easingi
  paths.js       ścieżki jako tablice punktów: catmull, resample, pointAt,
                 line/polyline/rect/ellipse/circle/arc/polygon/star/wave/spiral, svgPath(d)
  sketch.js      Sketch — pędzle: pen, strokes, arrow, crayon, fill, liquid,
                 highlight, dot, write, pencil, paper, group, occlude
  hand.js        model ręki: StrokePlan (profil prędkości, podnoszenie ołówka),
                 HandTrack (ciągła trajektoria ołówka przez cały film)
  handwriting.js pismo kreskami: szkielet glifów (Zhang–Suen) -> kreski w
                 kolejności pisania -> odsłanianie maską wzdłuż kresek
  timeline.js    Timeline — nazwane odcinki czasu (at / with / after / gap / ease)
  storyboard.js  Storyboard — deklaratywny scenariusz filmu + kamera + rozdziały
  player.js      Player (canvas, DPR, rAF, start w kadrze, idle, reduced motion),
                 scrollDrive (czas sceny = pozycja scrolla)
  record.js      recordWebM, snapshot, download
  narration.js   Voice/Beat (voice.json: klipy zdań + czasy słów), napisy SRT/VTT
  audio.js       AudioTrack — ścieżka lektora (Web Audio), zegar animacji
  themes.js      style: papier, tablica kredowa, blueprint, neon (tło, kreska, narzędzie)
tools/render.mjs render klatka po klatce (Playwright) -> PNG / MP4 (ffmpeg)
tools/audit.mjs  pomiar: czas renderu klatki, teleporty, prędkość i znikanie ręki
tools/lint.mjs   kontrola fizyki scen w przeglądarce (nic nie pojawia się bez ręki)
tools/voice/     voice.py: skrypt -> głos (TTS) / nagranie -> czasy słów (voice.json)
```

**Zasada:** scena jest czystą funkcją czasu. `draw(sk, t)` rysuje wszystko od
zera dla czasu `t`, a każdy pędzel dostaje postęp `p ∈ [0,1]`. Wszystkie
„losowe” drgania pochodzą z ziaren, więc ta sama klatka zawsze wygląda tak samo
— można przewijać, zapętlać, sterować scrollem i eksportować bez gubienia klatek.

### Scena pisana ręcznie (pełna kontrola)

```js
import { Timeline, Player, rect, clamp } from './src/index.js';

const tl = new Timeline().add('box', 1.2).add('fill', 0.8, { gap: -0.3 });
const box = rect(100, 100, 300, 200);

const scene = {
  w: 600, h: 400, duration: tl.duration, idle: 'boil',
  draw(sk, t) {
    sk.paper(600, 400);
    sk.crayon(box, tl.p('fill', t), { color: 'ochre' });
    const tip = sk.pen(box, tl.p('box', t), { color: 'ink', w: 4 });
    if (tip && !tip.done) sk.pencil(tip.x, tip.y);
  },
};
new Player(canvas, scene, { trigger: 'view' });
```

### Pędzle (`Sketch`)

| metoda | opis | ważne opcje |
| --- | --- | --- |
| `pen(pts, p, o)` | kreska z naciskiem, zwraca końcówkę `{x,y,angle,done}` | `w`, `color`, `jitter`, `seed`, `taper`, `dash:[on,off]`, `sketchy`, `still` |
| `strokes(list, p, o)` | kilka kresek jak ręka: profil prędkości, podnoszenie ołówka; zwraca końcówkę z `lift` | jak `pen`, `plan` |
| `arrow(pts, p, o)` | trzon + dwa ramiona grota (osobne ruchy ręki) | `head` |
| `crayon(poly, p, o)` | zamalowanie zygzakiem z ziarnem (długie kształty — krótkimi ruchami w poprzek) | `color`, `alpha`, `spacing`, `w`, `angle`, `grain`, `holes`, `solid` |
| `liquid(poly, level, o)` | napełnianie od dołu z falą | `color`, `alpha`, `wave`, `speed` |
| `highlight(pts, width, p, o)` | zakreślacz (`multiply`) | `color`, `alpha` |
| `write(text, x, y, p, o)` | pismo prawdziwymi kreskami liter (kropki i ogonki na końcu słowa), zwraca pozycję pisaka | `size`, `font` (`hand`/`title`/`mono`/CSS), `align`, `color`, `\n`, `fit`, `mode: 'wipe'` |
| `tool(x, y, o)` | narzędzie w ręce z końcówką w (x,y): `type` `pencil` (kolor rysika = `color`), `marker`, `eraser` | `type`, `color`, `angle`, `lean`, `lift` (0..1), `size`, `width` |
| `fill`, `occlude`, `dot`, `paper`, `group` | wypełnienia, zasłanianie tła, kropki, papier, układ lokalny | |

Kolory: nazwy z palety (`ink`, `pen`, `teal`, `sky`, `ochre`, `coral`, `plum`,
`paper`, …) albo dowolny CSS. Paletę i czcionki można nadpisać:
`new Player(canvas, scene, { sketch: { palette: {...}, fonts: { hand: '"Moja", cursive' } } })`.

### Storyboard — kroki

`pen`, `strokes`, `arrow`, `crayon`, `fill`, `liquid`, `highlight`, `write`,
`dot`, `pop(x, y, fn)` (wyskakuje z przestrzeleniem), `custom(fn(sk, p, t), { trace })`,
`wait(s)`, `mark(name)`, `camera({x,y,zoom}, {dur})`, `clear({dur})`.

**Zasada fizyki sceny: nic nie pojawia się samo.** Każdy ślad robi jedna ręka
z narzędziem:
* **ołówek w kolorze kreski**: grafit dla czerni, kredka dla koloru
  (`pen`, `strokes`, `arrow`, `write`, `crayon`, `dot`, `liquid`);
* **zakreślacz**: `highlight` i kryjące `fill`;
* **gąbka**: `clear` ściera pasami, a zmazane jest dokładnie to, przez co
  przeszła.

Ręka zmienia narzędzie w powietrzu między krokami. Krok nie może wymagać
szybszej ręki niż fizyczny limit (`HAND.maxSpeed`, ~3200 px/s po kartce,
4500 px/s w powietrzu); w razie potrzeby czas kroku się wydłuża. Kroki `custom`
prowadzi ręka, jeśli podasz `trace(p) => {x, y, tool?}`. Przykład: postać
w `examples/scenes/mascot.js` (`Sequence`: kontur → oczy → kredka z ominięciem
oczu → źrenice → detale).

Świadome wyjątki trzeba nazwać:
* `ambient: true`: animacja już narysowanego elementu (para z kubka, oddech);
* `magic: true`: efekt bez ręki (`pop`);
* `fast: true`: wyłącza limit prędkości.

`sb.lint()` zwraca listę problemów: element bez ręki, ręka spóźniona albo
niezdążająca, rysowanie równoległe, a w przeglądarce także za szybkie pismo.
Przy pierwszym rysowaniu problemy trafiają do konsoli. Pełna kontrola
z prawdziwymi czcionkami:

```bash
node tools/lint.mjs                                   # wszystkie dema
node tools/lint.mjs examples/scenes/moja.js:buildMoja # własna scena (kod wyjścia 1 przy problemach)
```

Zasady rysownika, których silnik nie wymusi, ale warto ich pilnować:
* **pierwszy plan rysuj najpierw:** linie tła chowają się wtedy za nim i nie
  trzeba niczego wymazywać;
* **nie rysuj zakrytych linii:** np. stos kartek to kartka z przodu i widoczne
  brzegi kartek pod spodem.

Opcje storyboardu: `handGaps` (przerwa na przelot ołówka przed kolejnym
elementem, domyślnie włączona), `speed` (tempo ręki w px/s), `cache` (bufor
ukończonych elementów, przerysowywany tylko przy zmianie klatki drgania lub
ruchu kamery), `idle`, `fps`.

Opcje czasu w każdym kroku: `dur`, `at` (sekunda albo nazwa kroku), `with`
(razem z krokiem), `after`, `gap` (przesunięcie, może być ujemne), `ease`,
`name`, `keep` (przetrwa `clear`), `pencil` (pokaż/ukryj ołówek), `z` (warstwa).

### Odtwarzacz

```js
const player = new Player(canvas, scene, {
  trigger: 'view',      // 'mount' | 'view' | 'manual'
  delay: 0.3,
  speed: 1,
  onTime: (t) => {},
});
player.play(); player.pause(); player.seek(3.2); player.renderAt(5);
```

`idle` sceny: `'boil'` (po intro kreski dalej drgają 8×/s), `'loop'` (czas płynie
dalej — oddech, mruganie; `fps` ogranicza klatki), `'still'` (stop),
`'restart'` (zapętlenie całości).

Sterowanie scrollem:

```js
const player = new Player(canvas, scene, { trigger: 'manual' });
scrollDrive(player, document.querySelector('#sekcja'), { smooth: 0.15 });
```

## Pomiar jakości ruchu

```bash
node tools/audit.mjs examples/explainer.html   # czas klatki, widoczność ołówka, teleporty
```

Wyniki przed i po przebudowie ręki są w [docs/PLAN.md](docs/PLAN.md).

## Lektor i napisy

Każde zdanie lektora to `sb.say(beat, () => { ...rysunek... })`. Krok
z `cue: 'słowo'` czeka na to słowo: ołówek dotyka kartki 0,3 s przed nim, a
lektor czeka na rękę, jeśli ta nie zdąży. Głos pochodzi z syntezy mowy albo
z Twojego nagrania; w obu przypadkach czasy słów daje `tools/voice/voice.py`.
W przeglądarce dźwięk jest zegarem animacji. `tools/render.mjs` składa MP4
z lektorem i ścieżką napisów oraz zapisuje pliki SRT i VTT.

```js
const voice = await Voice.load('voice/agent/voice.json');
sb.say(voice.beat(3), () => {
  sb.arrow(strzalka, { cue: 'trafia' });   // "Obserwacja TRAFIA do modelu…"
  sb.pen(ramka);
});
new Player(canvas, sb.scene()).play();     // play() z kliknięcia — przeglądarka wymaga gestu
```

Jak dać głos, format skryptu i polecenia: [docs/LEKTOR.md](docs/LEKTOR.md).
Demo: `examples/narrated.html`.

## Style

Ta sama scena w innym stylu wymaga zmiany jednej linijki:
`new Storyboard({ theme: 'chalk' })`. Wbudowane style:

* `paper`: pióro na kremowym papierze (domyślny);
* `chalk`: kreda na tablicy;
* `blueprint`: rapidograf na kalce z siatką, kreskowanie 45°;
* `neon`: świecące kreski na szybie.

![Trzy style](docs/img/style-sheet.png)

Co zmienia motyw, jak zrobić własny i pomysły na kolejne style:
[docs/STYLE.md](docs/STYLE.md). Demo: `examples/styles.html`.

## Od skryptu do filmu

Jak wygląda zrobienie filmu z Twojego skryptu: [docs/PRODUKCJA.md](docs/PRODUKCJA.md)
(research: [docs/PRODUKCJA-research.md](docs/PRODUKCJA-research.md)).
Produkcja seryjna mniejszymi modelami: [docs/SKALOWANIE.md](docs/SKALOWANIE.md).

## Eksport wideo

* **W przeglądarce**: `const blob = await recordWebM(player, { fps: 30 }); download(blob, 'film.webm')`
  (przyciski „nagraj WebM” w demach).
* **Klatka po klatce do MP4** (wymaga `npm i -D playwright` i ffmpeg):

  ```bash
  node tools/render.mjs examples/explainer.html --out out/explainer --fps 30 --width 1920 --mp4
  node tools/render.mjs examples/hero.html --fps 4 --sheet   # arkusz klatek do podglądu
  ```

  Strona musi wystawiać `window.__player`.

## Własna postać

`examples/scenes/mascot.js` pokazuje przepis na postać: kontur `strokes`
→ `occlude` (zasłania tło) → `crayon` → detale (`dot`, oczy z `fill`) → idle
(oddech przez skalę `group`, mruganie co kilka sekund, wzrok śledzący ołówek).
Gotowe rysunki z Figmy/Inkscape można wczytać przez `svgPath(d)` i animować
ołówkiem jak każdą inną ścieżkę.
