// Rejestr stylów: jedno miejsce, z którego korzystają galeria (examples/styles.html),
// lint (tools/lint.mjs) i testy. Nowy styl = motyw w src/themes.js + scena tutaj
// (examples/scenes/styles/<id>.js, eksport build<Id>) + głos (examples/voice/<id>/).

import { buildChalk } from './chalk.js';
import { buildBlueprint } from './blueprint.js';
import { buildNeon } from './neon.js';
import { buildNotebook } from './notebook.js';
import { buildWatercolor } from './watercolor.js';
import { buildComic } from './comic.js';
import { buildFlipchart } from './flipchart.js';
import { buildKraft } from './kraft.js';
import { buildSketch } from './sketch.js';
import { buildParchment } from './parchment.js';
import { buildWoodcut } from './woodcut.js';
import { buildCosmos } from './cosmos.js';
import { buildTerminal } from './terminal.js';
import { buildPoster } from './poster.js';
import { buildCorkboard } from './corkboard.js';
import { buildSumi } from './sumi.js';
import { buildPatent } from './patent.js';
import { buildPixel } from './pixel.js';
import { buildCharcoal } from './charcoal.js';
import { buildIso } from './iso.js';
import { buildAscii } from './ascii.js';

/** @type {{id:string, name:string, build:(voice:any)=>any, about:string}[]} */
export const STYLES = [
  { id: 'chalk', name: 'Tablica kredowa', build: buildChalk, about: 'Kreda na zielonej tablicy: ziarnista kreska, kolorowa kreda, w ręce kawałek kredy. Lekcja, matematyka, edukacja.' },
  { id: 'blueprint', name: 'Blueprint', build: buildBlueprint, about: 'Kalka techniczna: siatka, rapidograf o stałej grubości, kreślarskie przedłużenia linii, kreskowanie pod 45°, pismo techniczne. Architektura systemów, inżynieria, produkt.' },
  { id: 'neon', name: 'Neon (lightboard)', build: buildNeon, about: 'Pisanie na podświetlonej szybie: świecące kreski na prawie czarnym tle, pisak z poświatą. Technologia, AI, prezentacje.' },
  { id: 'notebook', name: 'Zeszyt w kratkę', build: buildNotebook, about: 'Notatki ucznia: kratka 5 mm i margines, niebieski długopis, czerwony do poprawek, zakreślacz i kredki. Finanse osobiste, nauka, „wytłumacz jak na lekcji”.' },
  { id: 'watercolor', name: 'Akwarela', build: buildWatercolor, about: 'Cienkopis i plamy farby: rozlany brzeg, pigment zebrany na krawędzi, przejaśnienia, ziarno papieru; w ręce pędzel. Przyroda, podróże, opowieści.' },
  { id: 'comic', name: 'Komiks', build: buildComic, about: 'Kadry, gruba kreska pędzelkiem z mocnym naciskiem, płaski kolor markera z rastrem kropek, dymki i napisy Bangers. Ciekawostki, popularyzacja nauki, social media.' },
  { id: 'flipchart', name: 'Flipchart', build: buildFlipchart, about: 'Arkusz z bloku na sztaludze: gruby marker o stałej grubości ze smugami filcu, mocne kolory, wyraźne liczby. Warsztaty, sprzedaż, strategia, szkolenia.' },
  { id: 'kraft', name: 'Papier pakowy', build: buildKraft, about: 'Brązowy papier kraft z włóknami i taśmą w rogach: czarny cienkopis, biały żelopis, kredki, przez które przebija papier. Przepisy, kawiarnie, rękodzieło, marki „eko”.' },
  { id: 'sketch', name: 'Szkic ołówkiem', build: buildSketch, about: 'Szkicownik na spirali: grafit z ziarnem papieru, druga blada linia obok, kreskowanie zamiast koloru, jasne linie konstrukcyjne i jeden akcent koloru. Fizyka, technika, „jak to działa”.' },
  { id: 'parchment', name: 'Stara mapa', build: buildParchment, about: 'Pergamin z plamami i przypalonymi brzegami, pióro gęsie z kałamarza (kreska blednie, gdy kończy się atrament), akwarelowe podkolorowanie map. Historia, bitwy, podróże.' },
  { id: 'woodcut', name: 'Drzeworyt', build: buildWoodcut, about: 'Druk z klocka: gruba rytowana kreska, kolor jako równoległe nacięcia dłuta, czerń i czerwień na papierze czerpanym, odbita ramka. Dawne techniki, rzemiosło, legendy.' },
  { id: 'cosmos', name: 'Kosmos', build: buildCosmos, about: 'Rozgwieżdżone niebo, pastelowa świecąca kreska, mgławice malowane plamą, która dodaje światła. Astronomia, fizyka, science fiction.' },
  { id: 'terminal', name: 'Terminal CRT', build: buildTerminal, about: 'Wektorowy monitor z lat 60.: zielony fosfor, linie ekranu, zaokrąglony kineskop, w ręce pióro świetlne. Historia techniki, komputery, kosmos.' },
  { id: 'poster', name: 'Plakat', build: buildPoster, about: 'Plakat konstruktywistyczny: czerwień, czerń i krem, płaska kryjąca farba z ziarnem druku, wysoki tytuł, sylwetki. Historia XX wieku, wojna, manifesty, kampanie.' },
  { id: 'corkboard', name: 'Tablica korkowa', build: buildCorkboard, about: 'Tablica śledczego: korek w drewnianej ramie, kolorowe karteczki, pinezki, napisy markerem i czerwona nitka łącząca wątki. Zagadki historii, śledztwa, analizy przyczyn.' },
  { id: 'sumi', name: 'Tusz i pędzel', build: buildSumi, about: 'Pędzel z tuszem na papierze ryżowym: kreska gruba w poprzek ostrza i cienka wzdłuż, laweowanie rozcieńczonym tuszem, czerwona pieczęć. Przyroda, geografia, spokojne opowieści.' },
  { id: 'patent', name: 'Rysunek patentowy', build: buildPatent, about: 'Arkusz patentowy z XIX wieku: cienki tusz kreślarski, przekroje kreskowane pod 45°, numerowane odsyłacze i podpis FIG. 1. Technika, wynalazki, budowa maszyn.' },
  { id: 'pixel', name: 'Pixel art', build: buildPixel, about: 'Ekran automatu z lat 70.: każda kreska przyciągnięta do siatki 8 px, kolor kładziony kratka po kratce, pikselowa czcionka i pikselowy ołówek w ręce. Historia gier i komputerów, technologia z przymrużeniem oka.' },
  { id: 'charcoal', name: 'Węgiel', build: buildCharcoal, about: 'Rysunek węglem na szarym papierze Ingres: gruba, ziarnista kreska, cienie roztarte palcem, sangwina jako jedyny kolor. Historia, katastrofy, poważne i dramatyczne tematy.' },
  { id: 'iso', name: 'Izometria', build: buildIso, about: 'Szkice przedmiotów w 3D (src/iso.js): bryły o zaokrąglonych rogach, mocna sylwetka i blade detale, zasłonięte linie się nie rysują, jeden pomarańczowy akcent. Technologia, sprzęt, architektura systemów.' },
  { id: 'ascii', name: 'ASCII', build: buildAscii, about: 'Ekran ze znaków: ręka rysuje zwykłe kreski, a filtr klatki (src/ascii.js) zamienia je w znaki — kreska w - / | \\, plama w . : = + * # @, kolor zostaje. Kursor-blok w ręce. Historia komputerów, internet, kultura cyfrowa.' },
];

/** Ścieżki dla narzędzi: scena, nazwa funkcji, głos (względem katalogu repozytorium). */
export const styleTargets = () => STYLES.map((s) => `examples/scenes/styles/${s.id}.js:${s.build.name}:examples/voice/${s.id}/voice.json`);
