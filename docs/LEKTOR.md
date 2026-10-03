# Lektor: jak dać głos i jak działa synchronizacja

## Krótko: co mi dać

| Masz | Daj mi | Co robię |
| --- | --- | --- |
| **tylko tekst** (polecam na start) | `script.md`: zdania lektora, akapit = jedno zdanie / obraz | generuję głos (TTS), znaczniki słów, film |
| **swoje nagranie** | plik audio (wav/mp3/m4a) **+ ten sam tekst** jako `script.md` | dopasowuję każde słowo tekstu do nagrania, tnę na zdania, film |
| **samo nagranie** | plik audio | transkrybuję (do Twojej korekty), dalej jak wyżej |

Każda droga daje ten sam wynik: `voice.json`, czyli klip audio dla każdego
zdania i czas każdego słowa. Z niego powstaje film zsynchronizowany z głosem,
z napisami SRT/VTT i ścieżką dźwiękową w MP4.

## Jak to działa

```
script.md ──► TTS (lub Twoje nagranie) ──► rozpoznawanie mowy ze znacznikami słów
                                            (faster-whisper) + dopasowanie do tekstu
                                                         │
                                                    voice.json
                                                         │
        scena: sb.say(zdanie, () => { rysunek; ... cue: 'słowo' ... })
                                                         │
           Player (dźwięk = zegar animacji) / render: MP4 + lektor + napisy
```

* **Zdanie = beat.** `sb.say(voice.beat(3), () => { ... })` kładzie zdanie na
  osi czasu. Rysunek zaczyna się 0,3 s przed głosem (obraz lekko wyprzedza
  słowo).
* **Kotwica do słowa.** Krok z `cue: 'modelu'` czeka, aż padnie to słowo:
  ołówek dotyka kartki 0,3 s wcześniej.
* **Lektor czeka na rękę.** Jeśli ręka nie zdąży narysować tego, co jest przed
  kotwicą, zdanie zaczyna się później (najwyżej o 1,5 s). Tak pracuje rysownik
  z lektorem.
* **Następne zdanie** zaczyna się, gdy skończy się i głos, i rysunek.
  `lint` ostrzega, gdy rysunek ciągnie się ponad 1 s po zdaniu (cisza) albo gdy
  kotwica jest spóźniona.
* **W przeglądarce dźwięk jest zegarem animacji.** Obraz nie odjeżdża od głosu
  nawet przy gubieniu klatek.

Pomiar na demie (rozpoznawanie mowy z gotowego MP4): przy 9 z 11 słów-kotwic
ołówek dotyka kartki 0,26–0,32 s przed słowem. Pozostałe dwa przypadki to
0,19 s i 0,70 s. Zalecane okno to 0,2–0,5 s.

## Polecenia

```bash
pip install -r tools/voice/requirements.txt     # Piper (TTS) + faster-whisper (znaczniki słów)

# 1) tekst -> głos (lokalnie, bez klucza API)
python tools/voice/voice.py tts script.md --out examples/voice/moj-film [--voice pl_PL-gosia-medium] [--tempo 1.1]

# 2) Twoje nagranie + tekst
python tools/voice/voice.py align nagranie.wav script.md --out examples/voice/moj-film

# 3) samo nagranie (transkrypcja do korekty, potem jak 2)
python tools/voice/voice.py transcribe nagranie.wav --out examples/voice/moj-film [--asr medium]

# film z dźwiękiem i napisami
node tools/render.mjs examples/narrated.html --out out/moj-film --mp4
```

Demo: `examples/narrated.html` (scena `examples/scenes/narrated.js`, głos
`examples/voice/agent/`).

## Format `script.md`

```
# Tytuł (komentarz, nie jest czytany)

GŁOS: pl_PL-darkman-medium

1. Jak działa agent AI? Zajrzyjmy do środka.
[tytuł + podkreślenie]

2. Wszystko zaczyna się od obserwacji.
[ramka „obserwacja”]
```

* **Akapit = jedno zdanie lektora = jeden obraz.** Numer na początku jest
  opcjonalny.
* **`[nawiasy]` to notatki dla rysunku.** Lektor ich nie czyta.
* **Liczby i skróty zapisuj słownie** („dwa tysiące dwadzieścia sześć”,
  „ej aj”), jeśli mają brzmieć konkretnie.

## Twoje nagranie: wskazówki

* **Nagrywaj w całości**, jednym plikiem. Rób krótką pauzę (~0,5 s) między
  zdaniami, bo tam tnę nagranie.
* **Czytaj tekst ze `script.md`.** Drobne odstępstwa nie szkodzą (słowa
  dopasowuję jak `diff`), ale przestawione zdania już tak.
* **Format:** wav lub m4a z telefonu, cichy pokój, bez muzyki pod spodem.
* **Poprawka jednego zdania** to dograne tylko to zdanie. Mogę podmienić
  pojedynczy klip.

## Wybór głosu (TTS)

* **Teraz:** lokalny Piper z polskimi głosami (`darkman`, `gosia`,
  `mc_speech`). Jest darmowy, działa offline i nie wymaga klucza. Głosy są
  dotrenowane z modelu angielskiego (lessac), którego dane mają ograniczenia
  licencyjne, więc to dobra opcja do prób i animatików, nie do publikacji.
* **Do publikacji:** komercyjny TTS z polskim głosem (porównanie dostawców
  w [PRODUKCJA-research.md](PRODUKCJA-research.md) §4) albo Twój głos. Silnik
  nie zależy od dostawcy: każdy plik audio przechodzi przez to samo
  dopasowanie słów. Adapter dla wybranego API to kilkanaście linii w
  `tools/voice/voice.py` (potrzebny klucz).
