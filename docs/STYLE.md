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

Kolejne style:

| | Zeszyt w kratkę (`notebook`) | Akwarela (`watercolor`) | Komiks (`comic`) |
| --- | --- | --- | --- |
| podłoże | biała kartka, kratka 5 mm, czerwony margines | ciepły papier akwarelowy, miękkie nierówności, ziarno | kremowy papier gazetowy, ślad rastra |
| kreska | długopis: cienko, lekki nacisk, prawie bez zwężeń; czerwony długopis do poprawek | cienkopis w kolorze sepii | pędzelek: gruba, mocny nacisk na zakrętach, długie zwężenia końców |
| kolorowanie | kredki; zakreślacze (`highlight`) żółty, zielony, różowy | plama farby (`wash`): rozlany brzeg, pigment zebrany na krawędzi, przejaśnienia, granulacja; odsłaniana mokrym, rozmytym frontem za pędzlem | płaski kolor markera z rastrem kropek (`halftone`), mnożony — czarny kontur zostaje czarny |
| pismo | Shadows Into Light Two (pismo ucznia) | Amatic SC (tytuły), Mynerve | Bangers (tytuły, onomatopeje), Shantell Sans |
| w ręce | długopis z przezroczystym korpusem, wkład i zatyczka w kolorze tuszu | cienkopis do kresek, pędzel z farbą do kolorowania (zmiana w powietrzu) | pisak pędzelkowy; do koloru marker |
| do czego | „wytłumacz jak na lekcji”, finanse osobiste, notatki | przyroda, podróże, opowieści, łagodne tematy | ciekawostki, popularyzacja nauki, social media |
| przykład | `examples/scenes/styles/notebook.js`: procent składany | `…/watercolor.js`: obieg wody | `…/comic.js`: dlaczego niebo jest niebieskie |

| | Flipchart (`flipchart`) | Papier pakowy (`kraft`) | Szkic ołówkiem (`sketch`) |
| --- | --- | --- | --- |
| podłoże | arkusz z bloku na szarym tle, listwa i perforacja u góry, siatka kropek | brązowy kraft: włókna, nierówne zabarwienie, taśma w rogach | szkicownik na spirali, ząbek papieru |
| kreska | marker (`style: 'marker'`): stała, gruba kreska, jaśniejsza smuga filcu, ciemniejsze końce (tusz wsiąka, gdy końcówka stoi) | czarny cienkopis z lekkim naciskiem; biały żelopis (`pen`) do podpisów | grafit (`style: 'graphite'`): ziarno papieru w kresce, druga blada linia obok (`sketchy`) |
| kolorowanie | marker szerokimi pasami, mnożony (liczby pod kolorem zostają czarne) | kredki: włókna papieru przebijają przez kolor | kreskowanie ołówkiem zamiast koloru; jeden kolorowy akcent na siły i strzałki |
| pismo | Lilita One (nagłówki, liczby), Sriracha | Caveat Brush, Kalam | Caveat |
| w ręce | marker z okrągłym filcem, etykieta i skuwka w kolorze tuszu | pisak do kresek, kredka do koloru | ołówek |
| do czego | warsztaty, sprzedaż, strategia, szkolenia | przepisy, kawiarnie, rękodzieło, marki „eko” | fizyka, technika, „jak to działa” |
| przykład | `examples/scenes/styles/flipchart.js`: lejek sprzedażowy | `…/kraft.js`: kawa z dripa | `…/sketch.js`: dźwignia |

Podgląd: `examples/styles.html?s=chalk` (zakładki z wszystkimi stylami).
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
  * `neon` daje stałą grubość i poświatę;
  * `marker` daje grubą kreskę ze smugą filcu i ciemniejszymi końcami;
  * `graphite` daje grafit z ziarnem papieru; `pen.sketchy` dodaje drugą, bladą linię.

  `width` i `jitter` skalują grubość i drżenie z opcji sceny.
* **Kolorowanie** (`crayon`): `theme.crayon` to domyślne opcje (kąt, gęstość,
  ziarno, tryb mieszania; `wash: true` to plama akwareli, `halftone: true`
  kolor z rastrem). Storyboard używa
  ich także do śladu ręki, więc ręka jedzie dokładnie tym zygzakiem, który
  zostawia kolor.
* **Zakreślacz**: `theme.highlight.blend`. Na papierze `multiply`, na ciemnym
  tle `screen` / `lighter`, bo mnożenie na ciemnym tle nic nie widać.
* **Zasłanianie i gąbka** (`occlude`, `clear`): na podłożu z fakturą silnik
  odmalowuje fragment tła (siatkę, tablicę) zamiast kłaść płaski kolor.
* **Narzędzie**: `theme.tools` mapuje `pencil` / `marker` / `crayon`
  (kolorowanie) na sprite motywu (`chalk`, `techpen`, `neon`, `ballpoint`,
  `brush`, `brushpen`, `marker`, `flipmarker`). Gąbka zostaje gąbką.

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

* **Karteczki samoprzylepne.** Kolorowe kwadraty przyklejane ręką, pismo
  markerem; dobre do burzy mózgów i list.
* **Retro terminal.** Zielony fosfor na czarnym tle, poświata i linie
  ekranu, pismo „maszynowe” znak po znaku.
* **Stara mapa / pergamin.** Sepia, przybrudzone brzegi, kreska piórkiem
  z kałamarza, która blednie, gdy kończy się atrament.

Wszystkie korzystają z tej samej sceny, ręki, lektora i eksportu.
