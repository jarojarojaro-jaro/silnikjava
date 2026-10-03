# Style (motywy)

Jedna scena może mieć różne style. Styl, czyli **motyw**, to jeden obiekt w
`src/themes.js`. Opisuje, jak wygląda podłoże, kreska, kolorowanie i narzędzie
w ręce. Scena podaje tylko *co* i *kiedy* jest rysowane, i to w nazwach
kolorów z palety (`ink`, `pen`, `teal`, `sky`, `ochre`, `coral`, `plum`).
Dzięki temu ten sam kod sceny daje inny film po zmianie jednej linijki:

```js
const sb = new Storyboard({ w: 1280, h: 720, theme: 'chalk' });   // 'paper' | 'chalk' | 'blueprint' | 'neon'
```

Fizyka zostaje ta sama w każdym stylu. Każdy ślad robi ręka, `lint` działa
bez zmian i synchronizacja z lektorem też.

## Trzy nowe style

| | Tablica kredowa (`chalk`) | Blueprint (`blueprint`) | Neon / lightboard (`neon`) |
| --- | --- | --- | --- |
| podłoże | zielona tablica, kurz, ślady po gąbce, winieta, drewniana rama | granatowa kalka, siatka 24/120 px, szum, winieta | prawie czarna szyba, poświata, refleks światła |
| kreska | kreda: grubsza, z nierównym naciskiem i ziarnem tablicy (wydrapane „dziury”) | rapidograf: stała, cienka grubość, minimalne drżenie, linie wychodzą lekko za narożniki | świecąca: trzy warstwy poświaty dodawane światłem (`lighter`) + białawy rdzeń |
| kolorowanie | kolorowa kreda z ziarnem, rozjaśnia (`screen`) | kreskowanie pod 45°, równe linie (jak przekrój na rysunku technicznym) | półprzezroczysta poświata |
| pismo | Kalam / Caveat Brush, z ziarnem kredy | Architects Daughter (pismo techniczne) | Patrick Hand, ze świeceniem |
| w ręce | kawałek kredy w kolorze kreski | rapidograf z pierścieniem w kolorze | czarny pisak ze świecącą końcówką |
| do czego | lekcje, matematyka, „szkolne” objaśnienia | architektura systemów, inżynieria, produkt | technologia, AI, prezentacje „na szybie” |
| przykład | `examples/scenes/styles/chalk.js`: Pitagoras | `…/blueprint.js`: droga zapytania | `…/neon.js`: sieć neuronowa |

Podgląd: `examples/styles.html?s=chalk` (zakładki: kreda, blueprint, neon).
Każdy film ma lektora (`examples/voice/<styl>/`), napisy i ~15–18 s.

## Jak to działa w silniku

* `Sketch` dostaje motyw (`new Sketch(ctx, { theme })`). `Player` bierze go
  z `scene.theme`, a `Storyboard({ theme })` go tam wkłada.
* **Podłoże** to `theme.background(sk, w, h)`, wołane zamiast papieru.
  Tekstury (kurz, szum) są generowane raz i trzymane w pamięci.
* **Kreska** to `theme.pen.style`:
  * `ink` to pióro z naciskiem (domyślne);
  * `chalk` rysuje kreskę na warstwie pomocniczej i wydrapuje w niej ziarno;
  * `tech` daje stałą grubość i przedłużenia (`overshoot`);
  * `neon` daje stałą grubość i poświatę.

  `width` i `jitter` skalują grubość i drżenie z opcji sceny.
* **Kolorowanie** (`crayon`): `theme.crayon` to domyślne opcje (kąt, gęstość,
  ziarno, tryb mieszania). Storyboard używa ich także do śladu ręki, więc
  ręka jedzie dokładnie tym zygzakiem, który zostawia kolor.
* **Zakreślacz**: `theme.highlight.blend`. Na papierze `multiply`, na ciemnym
  tle `screen` / `lighter`, bo mnożenie na ciemnym tle nic nie widać.
* **Zasłanianie i gąbka** (`occlude`, `clear`): na podłożu z fakturą silnik
  odmalowuje fragment tła (siatkę, tablicę) zamiast kłaść płaski kolor.
* **Narzędzie**: `theme.tools` mapuje `pencil` / `marker` na sprite motywu
  (`chalk`, `techpen`, `neon`). Gąbka zostaje gąbką.

## Własny styl

```js
import { THEMES } from './src/index.js';

THEMES.kraft = {
  name: 'Papier pakowy',
  palette: { paper: '#c8a97e', ink: '#2b2118', pen: '#7a1f12', teal: '#2f5d50', ochre: '#f4e3b5' /* … */ },
  fonts: { hand: '"Kalam", cursive', title: '"Caveat Brush", cursive' },
  pen: { style: 'ink', width: 1.1, jitter: 1.2 },
  crayon: { alpha: 0.7, grain: 1 },
  highlight: { blend: 'multiply', alpha: 0.4 },
  background(sk, w, h) { /* tło: kolor + włókna */ },
};
new Storyboard({ theme: 'kraft' });
```

Na co uważać:

1. **Paleta pod tło.** Na ciemnym tle `ink` musi być jasny. Kolory akcentów
   powinny być pastelowe (kreda) albo nasycone (neon).
2. **Tryb mieszania.** `multiply` działa na jasnym tle, `screen` / `lighter`
   na ciemnym.
3. **Czcionki** trzeba dołączyć na stronie (Google Fonts). `loadFonts`
   czeka na nie, zanim liczy ślad pisma. Sprawdź też tempo pisma: lint
   powie, jeśli dla danej czcionki pismo jest za szybkie.
4. **Sprawdzenie:** `node tools/lint.mjs` (fizyka, w przeglądarce
   z czcionkami motywu) i `node tools/render.mjs strona.html --fps 2 --sheet`
   (arkusz klatek).

## Kolejne style (pomysły)

* **Papier pakowy / notatnik w kratkę.** Wystarczy tło i paleta; kreska jak
  `ink`.
* **Akwarela.** Kolorowanie miękką plamą z rozlanym brzegiem, a kontur
  cienkim piórem. Potrzebny nowy pędzel `wash`.
* **Marker na flipcharcie.** Gruba kreska o stałej grubości, smugi markera.
  Wariant `tech` z dużą grubością i teksturą.
* **Komiks.** Czarny kontur z dużą zmianą grubości, kolorowanie płaskie
  z rastrem kropek.
* **Szkic ołówkiem.** Szary grafit, `sketchy: true` (podwójna linia),
  lekkie cieniowanie.

Wszystkie korzystają z tej samej sceny, ręki, lektora i eksportu.
