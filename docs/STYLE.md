# Style (motywy)

Jedna scena może mieć różne style. Styl, czyli **motyw**, to jeden obiekt w
`src/themes.js`. Opisuje, jak wygląda podłoże, kreska, kolorowanie i narzędzie
w ręce. Scena podaje tylko *co* i *kiedy* jest rysowane, i to w nazwach
kolorów z palety (`ink`, `pen`, `teal`, `sky`, `ochre`, `coral`, `plum`).
Dzięki temu ten sam kod sceny daje inny film po zmianie jednej linijki:

```js
const sb = new Storyboard({ w: 1280, h: 720, theme: 'chalk' });   // 'paper' | 'chalk' | 'blueprint' | … (20 stylów)
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

Dziesięć stylów do dłuższych opowieści (historia, technika, przyroda):

| | Stara mapa (`parchment`) | Drzeworyt (`woodcut`) | Kosmos (`cosmos`) |
| --- | --- | --- | --- |
| podłoże | pergamin: plamy, przypalone brzegi, zagięcia | papier czerpany, ślad słojów klocka, odbita ramka | gradient nocnego nieba, mgławice, gwiazdy z poświatą |
| kreska | pióro gęsie (`inkFade`): atrament blednie wzdłuż kreski, nowa kreska = nowe zanurzenie | dłuto: gruba, pewna, mało drżenia | neon o łagodnej poświacie (`glow: 0.7`) |
| kolorowanie | akwarelowe podkolorowanie mapy (`wash`) | równoległe nacięcia (kreskowanie bez fali) | miękka plama bez brzegu (`soft`), dodaje światła (`blend: 'screen'`) |
| pismo | Grenze Gotisch (tytuły), MedievalSharp | Alfa Slab One, Special Elite | Exo 2, Comfortaa, ze świeceniem |
| w ręce | gęsie pióro (`quill`), pędzel do koloru | dłuto (`gouge`) | świecący pisak |
| przykład | `…/parchment.js`: Grunwald 1410 | `…/woodcut.js`: dymarka | `…/cosmos.js`: jak powstaje gwiazda |

| | Terminal CRT (`terminal`) | Plakat (`poster`) | Tablica korkowa (`corkboard`) |
| --- | --- | --- | --- |
| podłoże | zaokrąglony kineskop, fosfor, linie ekranu, obudowa | kremowy papier drukarski, ziarno, zagięcia | korek w drewnianej ramie |
| kreska | zielony fosfor (`neon`) | gruba, równa kreska tuszu | pisak z lekkim naciskiem |
| kolorowanie | paski światła (`blend: 'lighter'`) | płaska kryjąca farba szerokimi pasami | karteczki zamalowane kryjąco, pinezka, potem tekst |
| pismo | VT323 | Bebas Neue, Oswald | Kalam, Special Elite |
| w ręce | pióro świetlne na kablu (`lightpen`) | pisak pędzelkowy | marker |
| przykład | `…/terminal.js`: Apollo 11, alarm 1202 | `…/poster.js`: Enigma | `…/corkboard.js`: Titanic |

| | Tusz i pędzel (`sumi`) | Rysunek patentowy (`patent`) | Pixel art (`pixel`) | Węgiel (`charcoal`) |
| --- | --- | --- | --- | --- |
| podłoże | papier ryżowy z włóknami | biały karton, podwójna ramka arkusza | ekran automatu: siatka pikseli, linie skanowania | szary papier Ingres z żeberkowaniem i pyłem |
| kreska | pędzel z ostrzem (`nib`, `nibMin`): gruba w poprzek, cienka wzdłuż | cienki tusz kreślarski, prawie bez drżenia | `pixel`: ślad przyciągnięty do siatki (`grid: 8`), schodki zamiast skosów | `graphite` gruba i ziarnista |
| kolorowanie | laweowanie rozcieńczonym tuszem | przekroje kreskowane pod 45° | kratki zamalowane zygzakiem (`crayon.pixel`) | roztarty pył (`wash` + `soft`) |
| pismo | Kaushan Script, Spectral | Libre Baskerville, EB Garamond | Pixelify Sans | Cinzel, Spectral |
| w ręce | pędzel | rapidograf | pikselowy ołówek (`pixelpencil`) | patyk węgla (`charcoal`) |
| przykład | `…/sumi.js`: jak rosną góry | `…/patent.js`: maszyna parowa | `…/pixel.js`: Pong 1972 | `…/charcoal.js`: Pompeje |

Podgląd: `examples/styles.html?s=chalk` (zakładki z wszystkimi stylami).
Każdy film ma lektora (`examples/voice/<styl>/`) i napisy; pierwsze dziewięć
trwa 15–20 s, kolejne 22–37 s.

### Izometria (`iso`) — szkice przedmiotów w 3D

| | Izometria (`iso`) |
| --- | --- |
| podłoże | jasny karton z siatką izometrycznych kropek (krok 32 px, osie 2:1) |
| kreska | grafion (`tech`): cienka, równa, bez przedłużeń |
| bryły | `src/iso.js`: `isoCamera({ S })`, `solid(cam, { x0, y0, x1, y1, z1, r, b })`, `cylinder`, `seg3`, `ground`; sylwetka `ink`, krawędź górnej ścianki i detale `inkSoft` |
| zasłanianie | najpierw bliższa bryła, dalsza linia przez `visible(ścieżka, [sylwetki])` → `sb.strokes`, ręka podnosi się nad zasłoniętym kawałkiem |
| akcent | `pen` (pomarańczowy) znaczy w całym filmie jedną rzecz |
| pismo | Space Grotesk (tytuły), IBM Plex Mono (podpisy) |
| w ręce | rapidograf |
| do czego | sprzęt, sieci, architektura systemów, „jak to działa” w technice |
| przykład | `…/iso.js`: droga wiadomości (telefon → router → serwer) |

Geometria brył pochodzi z Hairline (MIT, Lucas Marques). Zasady rysowania brył
(mniej kresek, mocno na zewnątrz i blado w środku, nie rysuj tego, czego nie
widać, jeden akcent) są w [ZASADY.md](ZASADY.md), sekcja 7.

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
  * `pixel` przyciąga ślad do siatki `pen.grid` (px) i rysuje go kratkami.

  Dodatki kreski `ink`: `inkFade` / `inkReach` (atrament blednie wzdłuż
  kreski), `nib` / `nibMin` (ostrze pod kątem: grubość zależy od kierunku).

  `width` i `jitter` skalują grubość i drżenie z opcji sceny.
* **Kolorowanie** (`crayon`): `theme.crayon` to domyślne opcje (kąt, gęstość,
  ziarno, tryb mieszania `blend`; `wash: true` to plama akwareli, z `soft`
  miękka plama bez brzegu; `halftone: true` kolor z rastrem; `pixel: true`
  kratki siatki). Storyboard używa
  ich także do śladu ręki, więc ręka jedzie dokładnie tym zygzakiem, który
  zostawia kolor.
* **Zakreślacz**: `theme.highlight.blend`. Na papierze `multiply`, na ciemnym
  tle `screen` / `lighter`, bo mnożenie na ciemnym tle nic nie widać.
* **Zasłanianie i gąbka** (`occlude`, `clear`): na podłożu z fakturą silnik
  odmalowuje fragment tła (siatkę, tablicę) zamiast kłaść płaski kolor.
* **Narzędzie**: `theme.tools` mapuje `pencil` / `marker` / `crayon`
  (kolorowanie) na sprite motywu (`chalk`, `techpen`, `neon`, `ballpoint`,
  `brush`, `brushpen`, `marker`, `flipmarker`, `quill`, `gouge`, `lightpen`,
  `pixelpencil`, `charcoal`). Gąbka zostaje gąbką.

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
   powie, jeśli dla danej czcionki pismo jest za szybkie. Wtedy ustaw
   w motywie `writeScale` (np. 1.2 = pismo o 20% wolniej).
4. **Sprawdzenie:** `node tools/lint.mjs` (fizyka, w przeglądarce
   z czcionkami motywu) i `node tools/render.mjs strona.html --fps 2 --sheet`
   (arkusz klatek).

## Kolejne style (pomysły)

* **Karteczki samoprzylepne.** Kolorowe kwadraty przyklejane ręką, pismo
  markerem; dobre do burzy mózgów i list.
* **Witraż.** Grube ołowiane kontury i świecące szkło w kolorze; legendy,
  średniowiecze.
* **Kreda na asfalcie.** Gruba, pastelowa kreda na szorstkim, szarym tle;
  dzieci, zabawy, sport.

Wszystkie korzystają z tej samej sceny, ręki, lektora i eksportu.
