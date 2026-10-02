# Jak powstaje film ze skryptu

Krótka odpowiedź na pytanie: „daję skrypt, co dalej?”. Szczegóły i źródła są w
[PRODUKCJA-research.md](PRODUKCJA-research.md) (jak robią to studia, tempo
lektora, synchronizacja, TTS, style). Produkcja seryjna mniejszymi modelami jest
opisana w [SKALOWANIE.md](SKALOWANIE.md).

## Jak jest dziś

Film to krótki skrypt JS (~60–100 linii), który model pisze ręcznie, np.
`examples/scenes/explainer.js`. Model wymyśla układ, dobiera współrzędne,
kolejność rysowania i kamerę. Silnik pilnuje reszty:

* **ręka i fizyka**: wszystko rysuje jedna ręka z narzędziem, w realnym
  tempie; `lint` wyłapuje każdy element, który pojawiłby się sam;
* **czasy**: wynikają z modelu ręki (długość kresek, przeloty, limit prędkości);
* **wygląd**: kreska, kredka, pismo kreskami liter, drganie, papier.

Czego jeszcze brakuje do filmu z głosem: ścieżki audio, synchronizacji kroków
ze zdaniami lektora, napisów i dźwięku ołówka. Do tego tylko jeden styl
wizualny („ink on cream”).

## Jak to będzie wyglądać (proponowany przepływ)

| # | Ty | Model + silnik | Twoja decyzja |
| --- | --- | --- | --- |
| 0 | temat **albo** gotowy skrypt, odbiorca, długość, styl, głos (TTS lub Twój) | | |
| 1 | | dzieli skrypt na **beaty**: zdanie lektora (≤ 15 słów) + co rysujemy | **A: akceptujesz tabelę beatów** |
| 2 | | rysuje 1–2 klatki wzorcowe w wybranym stylu | **B: akceptujesz wygląd** (raz na styl) |
| 3 | | generuje głos dla każdego beatu osobno (TTS) | |
| 4 | | pisze scenę: każdy beat trwa tyle, ile jego zdanie; rysunek startuje 0,2–0,5 s przed słowem; `lint` musi dać 0 | automatycznie |
| 5 | | animatik: szybki render z głosem + arkusz klatek | **C: oglądasz i poprawiasz** |
| 6 | | finał 1080p: obraz + głos + szum ołówka + napisy SRT | **D: akceptujesz** |

Zmiana zdania po kroku C to ponowna synteza **jednego** beatu i przeliczenie
czasów, a nie nagrywanie wszystkiego od nowa. To główna przewaga nad studiem.

## Jak napisać skrypt dla nas

Wystarczy zwykły tekst. Pomaga, jeśli każdy akapit to jedna myśl:

```
TYTUŁ: Czym jest RAG?
STYL: tablica kredowa
DŁUGOŚĆ: ok. 90 s

1. Model językowy wie tylko to, czego nauczył się na treningu.
   [obraz: głowa/model z "zamkniętą" książką]
2. RAG daje mu do ręki notatki: zanim odpowie, szuka w dokumentach.
   [obraz: lupa nad stosem kartek, strzałka do modelu]
3. …
```

Wskazówki z researchu:
* **Tempo:** polski lektor mówi ~2,1 słowa/s, czyli 90 s to ok. 190 słów.
* **Długość zdań:** jedno zdanie lektora to jeden obraz. Zdania do ~15 słów.
* **Tekst na ekranie:** tylko słowa-klucze, nie całe zdania lektora (zasada
  Mayera).
* **Początek:** pierwsze 5 sekund musi zaciekawić (pytanie, paradoks, obraz).
* **Długość filmu:** 60–150 s.

Opisy obrazów w nawiasach są opcjonalne. Jeśli ich nie dasz, model zaproponuje
obrazy w tabeli beatów (punkt A).

## Co trzeba zrobić w silniku przed pierwszym filmem z głosem

1. **Motyw (styl) jako jeden obiekt:** tło, faktura, paleta, czcionki, narzędzie
   w ręce, zachowanie gąbki. Pierwszy nowy motyw to tablica kredowa:
   ciemne tło, kreda, smuga po gąbce.
2. **Beaty z czasem z audio:** krok trwa tyle, ile zdanie lektora, plus
   kotwice w zdaniu.
3. **Audio w Playerze i eksporcie:** podgląd z głosem i MP4 z dźwiękiem
   (ffmpeg).
4. **Napisy SRT/VTT** z czasów beatów.
5. **Szum ołówka** generowany z toru ręki: silnik wie, kiedy narzędzie
   dotyka papieru i jak szybko się porusza.

Do decyzji po Twojej stronie:
* **Głos:** dostawca TTS z polskim głosem i znacznikami czasu (np. Azure,
  Amazon Polly; porównanie w researchu) i klucz API, albo nagranie własnego
  głosu.
* **Styl pierwszego filmu.** Rekomendacja researchu to tablica kredowa:
  najbardziej różna od obecnego stylu, a silnik ma już do niej większość
  narzędzi.
