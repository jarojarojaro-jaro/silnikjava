# Plan ulepszeń silnika

Punkt wyjścia: pierwsza wersja działa i wygląda dobrze, ale audyt
(`node tools/audit.mjs`, 60 fps) pokazał konkretne słabości:

| scena | render klatki (śr / p95) | ołówek widoczny | pojawia/znika | skoki > 40 px | najgorszy skok |
| --- | --- | --- | --- | --- | --- |
| explainer | 6,0 / 14,9 ms | 69,8% | 38× | 27 | 821 px |
| hero | 32,4 / 47,7 ms | 71,5% | 18× | 32 | 310 px |

## Diagnoza — dlaczego ołówek skacze i znika

1. **Ołówek wynika z rysowania, a nie odwrotnie.** Pozycja ołówka to „końcówka
   ostatnio narysowanej kreski”. Gdy nic nie jest w trakcie rysowania
   (kredka, spacja w tekście, przerwa > 1,4 s, koniec kroku), ołówek znika.
2. **Pismo zwraca końcówkę tylko w trakcie litery** — na spacjach i na granicy
   liter ołówek mruga.
3. **Kredka ma ołówek wyłączony**, więc w połowie rysowania ramki ołówek
   znika na czas zamalowania i pojawia się gdzie indziej.
4. **Kilka kresek naraz** (np. nogi statywu i rama tablicy) — końcówka skacze
   między nimi co klatkę.
5. **Rozdziały**: przy ścieraniu i zmianie kadru kamera i ołówek teleportują się.

## Diagnoza — dlaczego rysowanie bywa „mechaniczne”

1. **Stała prędkość wzdłuż ścieżki.** Ręka przyspiesza w środku kreski, zwalnia
   na zakrętach i przy końcu (prawo 2/3 potęgi), a między kreskami podnosi
   ołówek. U nas cały ciąg kresek ma jeden easing.
2. **Pismo to odsłanianie prostokątem** litera po literze — litera „wyłania
   się” z lewej, zamiast być pisana kreskami w naturalnej kolejności.
3. **Nacisk zależy tylko od położenia na ścieżce**, a nie od prędkości
   (wolniej = więcej tuszu) i krzywizny.
4. **Ołówek ma stały kąt** — nie pochyla się w kierunku ruchu, nie widać, że
   „podnosi się” między kreskami.

## Diagnoza — wydajność

1. Każda klatka próbkuje od nowa wszystkie ścieżki i liczy szum dla każdego punktu.
2. Kredka w każdej klatce generuje zygzak, przycina go i składa warstwę z
   ziarnem — w scenie hero kilkanaście razy na klatkę.
3. Ukończone elementy są przerysowywane w każdej klatce, choć zmieniają się
   tylko 8×/s (drganie kreski).

## Etap 1 — naturalna ręka (teraz)

- [x] **Ruch ręki jako osobna, ciągła ścieżka (`Hand`).** Każdy krok sceny
  opisuje swoją trajektorię (`trace(p)`) bez rysowania. Ręka w czasie t jest
  na trajektorii aktywnego kroku albo przelatuje łukiem do następnego
  (unosząc się — cień oddala się od grafitu), albo odpoczywa obok ostatniej
  kreski. Nigdy nie znika w trakcie filmu, nie teleportuje się.
- [x] **Ołówek koloruje kredką** — ręka jedzie zygzakiem kreskowania.
- [x] **Pismo prawdziwymi kreskami.** Tekst rasteryzowany, szkieletyzowany
  (Zhang–Suen), szkielet zamieniany na kreski w kolejności pisania (litery od
  lewej, w literze od góry/lewej). Odsłanianie maską wzdłuż kresek: litery są
  pisane, a nie odkrywane. Ołówek jedzie po kreskach liter, krótkie pauzy
  między słowami.
- [x] **Profil prędkości ręki** w `strokes`: każda kreska ma własny przebieg
  „minimum jerk” (powolny start i koniec), czas kreski rośnie wolniej niż jej
  długość, przerwy na podniesienie ołówka proporcjonalne do odległości.
- [x] **Nacisk z krzywizny** — na zakrętach kreska grubsza.
- [x] **Ołówek pochyla się** zgodnie z kierunkiem ruchu (z wygładzeniem).

## Etap 2 — wydajność (teraz)

- [x] Cache próbkowania ścieżek (WeakMap po tablicy punktów).
- [x] Cache zygzaków kredki.
- [x] **Warstwa statyczna w Storyboardzie**: ukończone elementy rysowane do
  bufora raz na klatkę drgania (8×/s) i gdy kamera stoi; w pozostałych
  klatkach tylko kopiowanie bufora + elementy w trakcie.
- [x] `tools/audit.mjs` — pomiar przed/po (czas klatki, skoki ołówka).

## Wynik etapów 1–2

`node tools/audit.mjs` (60 fps, 1280 px). Teleport to izolowany skok ołówka
> 40 px między klatkami, a szybki ciągły ruch się nie liczy. Stary kod jest
zmierzony tym samym audytem.

| scena | | render klatki śr / p95 | ołówek widoczny | pojawia/znika | teleporty | najgorszy skok |
| --- | --- | --- | --- | --- | --- | --- |
| explainer | przed | 5,6 / 13,2 ms | 69,8% | 38× | 27 | 821 px |
| explainer | po | **3,2 / 11,3 ms** | **99%** | **1×** | **4** | 69 px |
| hero | przed | 30,1 / 44,8 ms | 71,5% | 18× | 9 | 310 px |
| hero | po | **9,0 / 38,5 ms** | **100%** | **0×** | **1** | 44 px |

W hero p95 jest wysokie, bo co 1/8 s (zmiana klatki drgania) bufor
przerysowuje całą scenę. Średnia jest ponad 3× lepsza. Następny krok to
osobne drganie dla ukończonych elementów (np. 4×/s) albo drganie przez
przesunięcie bitmapy zamiast przerysowania.

Zmiany w zachowaniu, o których trzeba wiedzieć:

* Czasy kroków w `Storyboard` wynikają z modelu ręki, a między elementami jest
  automatyczna przerwa na przelot ołówka (`handGaps: false` ją wyłącza).
  Filmy są przez to trochę dłuższe i spokojniejsze.
* `Sketch.strokes` i `arrow` mają postęp proporcjonalny do czasu: profil
  prędkości jest liczony w środku. `Sketch.pen` dalej przyjmuje postęp po
  długości.
* `Sketch.write` domyślnie pisze kreskami. Stary tryb to `mode: 'wipe'`.
* Opcja kredki `gap` ma teraz nazwę `spacing`. Kolidowała z `gap` na osi czasu,
  co w pierwszej wersji dawało 9-sekundowe przerwy w filmie.

## Etap 2b — fizyka sceny (zrobione)

Zasada: **nic nie pojawia się samo**. Każdy ślad robi jedna ręka z narzędziem:
ołówkiem w kolorze kreski, zakreślaczem albo gąbką. Narzędzie zmienia się
w powietrzu.

- [x] Wypełnienie, kropka, ciecz i zakreślacz prowadzone ręką; `pop` jest
  oznaczony jako magiczny.
- [x] Ścieranie gąbką, ciągłą trasą pasami (zmazane to, przez co przeszła).
- [x] Postać rysowana sekwencją (`Sequence`): kontur → oczy → kredka
  z ominięciem oczu → źrenice → detale. Ślad ręki i rysunek mają jedno źródło.
- [x] Pierwszy plan rysowany przed tłem; brak zakrytych linii (stos kartek).
- [x] Fizyczny limit prędkości ręki: ~3200 px/s po kartce, 4500 px/s
  w powietrzu. Kroki wymagające szybszej ręki dostają automatycznie dłuższy
  czas.
- [x] `lint()` i `tools/lint.mjs` (w przeglądarce): element bez ręki, ręka
  spóźniona albo niezdążająca, rysowanie równoległe, za szybkie pismo.
  Wszystkie dema: 0 problemów.
- [x] Wydajność: cykliczne drganie (4 wersje kreski, jak u animatorów)
  i bufor przyrostowy ukończonych elementów.

| scena | render klatki śr / p50 / p95 | ołówek widoczny | pojawia/znika | teleporty | maks. prędkość ręki |
| --- | --- | --- | --- | --- | --- |
| explainer | 3,0 / 2,3 / 12,9 ms | 100% | 0× | 1 (47 px) | 4459 px/s |
| hero | 7,1 / 5,0 / 20,5 ms | 100% | 0× | 3 (≤ 61 px) | 4711 px/s* |

\* hero renderowany w skali 1280/1240, więc limit 4500 px/s daje tu ~4650 px/s.

Koszt fizyki: filmy są dłuższe (explainer ~60 s, hero ~44 s), bo ręka nie
może rysować szybciej niż człowiek. Krótszy film to mniej elementów albo
mniej detali postaci, a nie szybsza ręka.

## Etap 2c — lektor (zrobione)

- [x] `tools/voice/voice.py`: tekst → głos (Piper lokalnie), nagranie +
  tekst → znaczniki słów, samo nagranie → transkrypcja. Wspólny wynik:
  `voice.json`.
- [x] `sb.say(beat, build)`, kotwice `cue: 'słowo'`; lektor czeka na rękę
  (do 1,5 s); `lint` ostrzega o ciszy i spóźnionych kotwicach.
- [x] `AudioTrack` w Playerze (dźwięk jest zegarem animacji), napisy SRT/VTT,
  eksport MP4 z lektorem i ścieżką napisów.
- [x] Pomiar na gotowym MP4: przy 9 z 11 kotwic ołówek dotyka kartki
  0,26–0,32 s przed słowem; pozostałe dwie to 0,19 s i 0,70 s.

## Etap 2d — style (zrobione)

- [x] Motywy (`src/themes.js`): podłoże, paleta, czcionki, rodzaj kreski
  (`ink` / `chalk` / `tech` / `neon`), kolorowanie, tryb zakreślacza,
  narzędzie w ręce. `Storyboard({ theme })` → `scene.theme` → `Player`.
- [x] Trzy style z filmami ~15–18 s z lektorem: tablica kredowa, blueprint,
  neon (`examples/styles.html`). Fizyka: 0 błędów; kotwice na czas.
- [x] Ślad ręki przy kolorowaniu idzie zygzakiem motywu; `occlude` i gąbka
  odmalowują tło z fakturą; tempo pisma nie zależy od tempa kresek sceny.
- [x] `polyline()` — wielokąty o ostrych rogach (geometria, schematy).
- [x] Kolejne trzy style: zeszyt w kratkę (długopis, zakreślacze), akwarela
  (nowy pędzel `wash`), komiks (nowy pędzel `halftone`, pędzelek z naciskiem).
  Każdy z filmem z lektorem; fizyka 0 błędów, 0 ostrzeżeń o tempie.
- [x] `tools/lint.mjs --items`: czasy kroków i kotwic (strojenie tempa).
- [x] Kolejne trzy: flipchart (kreska `marker`), papier pakowy, szkic ołówkiem
  (kreska `graphite`, szkicowe linie). Razem dziewięć stylów z filmami.
- [x] Dziesięć kolejnych, z dłuższymi filmami (historia, technika, przyroda):
  stara mapa (pióro z kałamarza, `inkFade`), drzeworyt, kosmos (miękka plama
  `soft`, `blend: 'screen'`), terminal CRT, plakat, tablica korkowa, tusz
  i pędzel (ostrze `nib`), rysunek patentowy, pixel art (kreska `pixel`,
  `crayon.pixel`), węgiel. Razem dziewiętnaście stylów.
- [x] Bryły w izometrii (`src/iso.js`, geometria z Hairline, MIT) i styl
  „Izometria” z filmem „Droga wiadomości”. Razem dwadzieścia stylów.
- Opis i przepis na własny styl: [STYLE.md](STYLE.md).

## Etap 3 — rozbudowa (kolejne iteracje)

- Wysokopoziomowy format sceny (węzły z id, strzałki między id z
  auto-routingiem, checklisty, ikony, „kamera na id”, automatyczny layout) —
  szczegóły i uzasadnienie w `docs/SKALOWANIE.md` (analiza pod produkcję
  mniejszymi modelami).
- Biblioteka ikon rysowanych (terminal, globus, plik, chmura, baza, żarówka,
  zębatka, człowiek…), każda jako zestaw kresek z kolejnością rysowania.
- Narzędzia: dłoń trzymająca pisak; kolejne style (karteczki, retro
  terminal, stara mapa — patrz STYLE.md).
- Przejścia: przesunięcie kartki, przewrócenie strony, zoom-through.
- Postacie: rig z emocjami (radość, zdziwienie, myślenie), gesty wskazywania.
- Eksport: WebCodecs (szybszy niż MediaRecorder), dźwięk w eksporcie.
- Edytor: podgląd z osią czasu i przeciąganiem elementów → zapis do specyfikacji.
