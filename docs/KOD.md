# Zasady kodu

[ZASADY.md](ZASADY.md) mówi, **co** rysownik robi na ekranie. Ten plik mówi,
**jak** piszemy silnik i sceny, żeby wszystko działało płynnie, szybko
i przewidywalnie. Reguły oznaczone **[check]** sprawdza `npm run check`.

## 1. Architektura

1. **Scena jest czystą funkcją czasu.** `draw(sk, t)` rysuje klatkę od zera
   dla czasu `t`, bez stanu między klatkami. Dzięki temu można przewijać,
   zapętlać i eksportować klatka po klatce.
2. **Losowość tylko z ziaren.** Każde drganie, tekstura i rozrzut pochodzą
   z `rng(seed)`, `noise1`, `hash`. Ta sama klatka zawsze wygląda tak samo.
3. **Silnik bez zależności.** `src/` używa tylko przeglądarki (canvas 2D,
   Web Audio). Narzędzia (`tools/`) mogą używać Playwright i ffmpeg.
4. **Jeden moduł, jedno zadanie.** Zanim dopiszesz pomocnika, sprawdź, czy
   już go nie ma:

   | moduł | co w nim jest |
   | --- | --- |
   | `math.js` | `clamp`, `lerp`, easingi, `rng`, `noise1`, `hash` |
   | `paths.js` | ścieżki jako tablice punktów, `pointInPoly`, `chain` |
   | `canvas.js` | `makeCanvas`, `texture` (tekstury z cache) |
   | `hand.js` | model ręki: `HAND`, `StrokePlan`, `Sequence`, `HandTrack` |
   | `sketch.js` | pędzle i narzędzia w ręce |
   | `storyboard.js` | scenariusz, lektor, lint |
   | `themes.js` | motywy (wygląd) |
   | `iso.js` | bryły w izometrii |
   | `ascii.js` | filtr klatki ASCII |
   | `narration.js` / `audio.js` | głos i napisy |
   | `player.js` | odtwarzanie |

## 2. Płynność ręki

5. **[check] Bez skoków.** Ręka nie może przeskoczyć w jednej klatce
   (30 kl./s) o więcej niż 70 px. Lint (`Storyboard.handJumps`) i audyt to
   wykrywają.
6. **Limity są w `HAND`, nie w scenach:**
   * `maxSpeed` 3200 px/s: kreska po kartce;
   * `maxTravel` 4500 px/s: przelot między elementami;
   * `maxLift` 2200 px/s: krótki przelot w obrębie kroku (między literami
     i kreskami), czyli limit płynności obrazu.

   Nie obchodź ich w scenach (`speed`, `dur` ściskają tylko rysowanie, nigdy
   przeloty).
7. **Ślad z własnym planem czasu idzie liniowo.** Krok z `trace`, który ma
   w środku własne tempo (`Sequence`, postać), dostaje `natural: true` (domyślne
   w `custom`). Easing kroku przyspieszałby wtedy przeloty.
8. **Kreski bez kierunku układaj w kolejności najkrótszych przelotów**
   (`chain`): połączenia, kolumny, kreskowanie. Człowiek nie skacze po kartce.
9. **Ślad ręki musi być ciągły.** Gdy kształt ma dziurę (wklęsła plama),
   ręka przelatuje nad nią płynnie, a nie czeka i przeskakuje.

## 3. Wydajność

10. **[check] Budżet klatki:** p95 ≤ 33 ms przy 1280×720 (cel ≤ 20 ms).
    `npm run audit` mierzy wszystkie filmy.
11. **Drogie liczymy raz.** Rozmycie (`filter: blur`), gradienty i odczyt
    pikseli (`getImageData`) kosztują najwięcej. Wynik, który nie zależy od
    postępu kroku, trzymaj w cache (np. gotowa plama akwareli). W każdej
    klatce zostaje tylko to, co się zmienia (np. maska mokrego frontu).
12. **Cache kluczuj tym, od czego zależy wynik** (kształt, kolor, ułożenie
    na ekranie) i ograniczaj jego rozmiar. Rozmycie o dużym promieniu licz
    w połowie rozdzielczości: różnicy nie widać, a pikseli jest 4× mniej.
13. **Ukończone elementy nie rysują się od nowa.** Storyboard buforuje je
    w bitmapie (`static`). Nie wyłączaj tego bez powodu.

## 4. Czcionki i zasoby

14. **Ślad pisma zależy od czcionki.** Geometrię tekstu liczymy dopiero po
    wczytaniu czcionki. Gdy czcionka dojdzie po starcie, `Player.loaded`
    wywołuje `Storyboard.invalidate()`. Narzędzia czekają na `Player.loaded`.
15. **Zasób może nie dojść.** Brak klipu lektora nie zatrzymuje filmu: gra on
    dalej bez głosu, a w konsoli pojawia się ostrzeżenie.
16. **Bez DOM: czytelny błąd.** `makeCanvas` mówi wprost, czego brakuje,
    zamiast `document is not defined`. Logika (scenariusz, lint, ślad ręki)
    działa w Node, więc testy uruchamiamy bez przeglądarki.

## 5. Styl kodu

17. Komentarze i dokumentacja po polsku. Komentarz mówi **dlaczego**, a nie
    co robi linijka.
18. Publiczne funkcje i opcje mają JSDoc zgodny z kodem. Zmieniasz opcję,
    to zmieniasz też jej opis.
19. Liczba powtarzana w kilku miejscach dostaje nazwę (`HAND_JUMP`,
    `ASCII_CELL`, `OPENING`).
20. Bez martwego kodu: nieużywaną funkcję usuń. Historia jest w gicie.
21. Nowa funkcja w silniku dostaje test w `tests/core.test.mjs`, jeśli da się
    ją sprawdzić bez przeglądarki.

## 6. Nowy styl: lista kontrolna

1. Motyw w `src/themes.js`: paleta, czcionki, `pen`, `crayon`, `tools`,
   `background`, w razie potrzeby `writeScale` i `post`.
2. Scena `examples/scenes/styles/<id>.js` z funkcją `build<Id>(voice)`.
3. Głos: `examples/voice/<id>/script.md`, potem
   `tools/voice/voice.py tts … --out examples/voice/<id>`.
4. Wpis w rejestrze `examples/scenes/styles/index.js`. Galeria, lint, audyt
   i testy biorą styl stamtąd.
5. Czcionki w linku Google Fonts w `examples/styles.html`.
6. `npm run check`: 0 błędów, 0 ostrzeżeń, wszystko w budżecie.
7. Arkusz klatek (`tools/render.mjs … --fps 2 --sheet`) obejrzany.
8. README: wpis w galerii i GIF (`npm run gallery -- <id>`), opis w `docs/STYLE.md`.
9. Osobny commit na styl. Zmiany silnika idą osobnym commitem przed nim.

## 7. Kontrola

```bash
npm test          # testy jednostkowe (Node, bez przeglądarki)
npm run lint      # fizyka, kolejność, tempo, przestoje, skoki ręki (przeglądarka)
npm run audit     # czas klatki i płynność ręki wszystkich filmów
npm run check     # wszystko powyżej; musi przejść przed każdym pushem
npm run gallery   # podglądy GIF do README (wszystkie albo: npm run gallery -- iso ascii)
```
