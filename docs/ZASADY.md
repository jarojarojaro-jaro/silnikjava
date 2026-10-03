# Zasady rysownika (source prompt)

Ten plik to **prompt źródłowy** dla każdego, kto pisze sceny dla silnika:
dla człowieka, dla Claude Code i dla mniejszego modelu w produkcji seryjnej
(zob. [SKALOWANIE.md](SKALOWANIE.md)). Wklej go do promptu systemowego bez
zmian. Reguły oznaczone **[lint]** sprawdza `node tools/lint.mjs`, więc złamanie
ich to błąd, a nie kwestia gustu.

Wyobraź sobie jednego rysownika z jedną ręką przy tablicy. Wszystko, co widz
zobaczy, ten rysownik musi fizycznie zrobić, po kolei i w ludzkim tempie.
A zanim zacznie, wie już, jak każda rzecz ma wyglądać na końcu.

## 1. Fizyka ręki

1. **[lint] Nic nie pojawia się samo.** Każdy ślad robi ręka z narzędziem:
   ołówkiem albo kredką w kolorze kreski, zakreślaczem albo gąbką (w motywie
   kredą, pędzlem, markerem…). Wyjątki trzeba nazwać: `ambient: true` dla
   animacji już narysowanego elementu, `magic: true` dla świadomego efektu bez
   ręki.
2. **[lint] Jedna ręka.** Nie rysuj dwóch rzeczy naraz. Każdy krok zaczyna się,
   gdy ręka dojedzie, a narzędzie zmienia się w powietrzu.
3. **[lint] Ludzkie tempo.** Ręka po kartce ma najwyżej ~3200 px/s, w powietrzu
   4500 px/s, a pismo ma własne tempo. Nie skracaj kroków na siłę (`dur`).
   Silnik sam wydłuży za krótki krok, a lint zgłosi za szybkie pismo.

## 2. Kompletność obiektu (najważniejsza reguła kolejności)

4. **[lint] Obiekt rysujesz w całości, zanim zaczniesz następny.** Jeśli
   wiesz, że słońce będzie żółte, malujesz je **zaraz po obrysie**, a nie po
   narysowaniu morza i pary. Kolejność wewnątrz obiektu:

   **kontur → kolor → detale wewnątrz → podpis**

   Dopiero potem rysujesz następny obiekt. Lint zgłasza „obiekt przerwany”,
   gdy między konturem a kolorem tego samego obiektu (w dowolnej kolejności)
   ręka narysowała coś poza nim.
5. **Zaplanuj obiekt, zanim go narysujesz.** Dla każdego obiektu ustal od razu:
   kształt, kolor wypełnienia (albo „bez koloru”), detale, podpis i słowo
   lektora, na które się pojawia. W kodzie najlepiej jedna funkcja na obiekt
   (np. `sun()` rysuje obrys i zaraz kolor). Wtedy nie da się go rozdzielić.
6. **Zaznaczenia to nowe obiekty.** Zakreślenie, kółko wokół czegoś czy
   strzałka „patrz tutaj” rysuje się po tym, jak cel jest gotowy, i nie
   łamie reguły 4.
7. **Świadomy powrót do obiektu tylko z powodu fabularnego** (np. kawa nalewa
   się do filiżanki „po trzech minutach”). Oznacz go `revisit: true`
   i komentarzem, dlaczego. Na pewno nie po to, żeby zdążyć z lektorem.
   Wtedy zmień kolejność albo tekst (reguła 12).

## 3. Kolejność w kadrze

8. Pierwszy plan rysuj najpierw: linie tła chowają się wtedy za nim i nie
   trzeba niczego wymazywać. Nie rysuj linii, które byłyby zakryte.
9. Strzałka pojawia się, gdy istnieje jej początek. Cel rysuje się w tym samym
   albo następnym zdaniu, nigdy „strzałka w pustkę” na koniec.
10. Kreskę konstrukcyjną (oś, linia podłoża, ramka) rysuj przed tym, co na
    niej stoi.

## 4. Lektor i tempo

11. **Słowo-kotwica (`cue`) przy obiekcie, który lektor nazywa.** Ręka dotyka
    kartki ~0,3 s przed słowem. Kotwica należy do **pierwszego** kroku obiektu
    (konturu), a nie do koloru czy podpisu.
12. **[lint, ostrzeżenie] Rysunek i głos idą razem.** Gdy rysunek jest dłuższy
    niż zdanie, **dopisz lektorowi kilka naturalnych słów** albo przesuń część
    rysunku do następnego zdania. Nie przyspieszaj ręki i nie łam reguły 4.
    Film ma być bez ostrzeżeń o ciszy i spóźnionych kotwicach.
13. Na tablicy tylko słowa-klucze. Pełne zdania są w głosie i w napisach.

## 5. Wygląd

14. Kolory tylko z nazw palety (`ink`, `pen`, `teal`, `sky`, `ochre`, `coral`,
    `plum`, `inkSoft`, `white`). Wtedy ta sama scena działa w każdym motywie
    ([STYLE.md](STYLE.md)).
15. Wielokąty „z linijki” (trójkąt, kwadrat, schemat) rysuj przez `polyline`
    (ostre rogi), a nie przez `polygon` (zaokrąglony szkic).
16. Treść nie dotyka krawędzi kadru (margines ≥ 60 px) i wypełnia kadr
    równo, bez pustej połowy.

## 6. Procedura (zawsze w tej kolejności)

```bash
node tools/lint.mjs scena.js:buildScena:voice.json --items   # 0 błędów, 0 ostrzeżeń; --items = czasy kroków
node tools/render.mjs "strona.html" --fps 2 --sheet           # arkusz klatek: obejrzyj każdy kadr
npm test
node tools/render.mjs "strona.html" --fps 30 --mp4            # dopiero teraz film
```

Na arkuszu klatek sprawdź szczególnie: czy każdy obiekt jest skończony, zanim
ręka przejdzie dalej; czy nic nie nachodzi na podpisy; czy kompozycja jest
równa.
