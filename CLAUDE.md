# silnikjava — instrukcje dla Claude Code

Silnik rysowanych filmów objaśniających (JS, canvas 2D). Dokumentacja i
komunikacja po polsku.

## Zanim napiszesz albo zmienisz scenę

Przeczytaj i stosuj [docs/ZASADY.md](docs/ZASADY.md) (zasady rysownika).
Najważniejsze:
- nic nie pojawia się samo: każdy ślad robi jedna ręka w ludzkim tempie;
- **obiekt w całości, zanim zaczniesz następny: kontur → kolor → detale →
  podpis** (np. słońce maluj zaraz po obrysie, nie po morzu);
- **coś dzieje się cały czas**: na początku filmu ręka rysuje bez przerwy
  (przestój > 1 s to ostrzeżenie), później najwyżej 3 s oddechu;
- kotwica lektora (`cue`) na pierwszym kroku obiektu. Gdy rysunek jest
  dłuższy niż zdanie, dopisz lektorowi słowa zamiast przyspieszać rękę.

Scena jest gotowa dopiero, gdy `npm run check` przechodzi (testy, lint z 0 błędów
i 0 ostrzeżeń, audyt płynności i czasu klatki), a arkusz klatek
(`tools/render.mjs … --fps 2 --sheet`) został obejrzany.

## Zanim zmienisz silnik

Przeczytaj [docs/KOD.md](docs/KOD.md) (zasady kodu). Najważniejsze:
- scena to czysta funkcja czasu, losowość tylko z ziaren;
- ręka bez skoków: limity w `HAND`, nie obchodzić ich w scenach;
- budżet klatki p95 ≤ 33 ms: drogie efekty raz, w cache;
- pomocnik raz (math/paths/canvas), bez martwego kodu, JSDoc zgodny z kodem;
- nowy styl: wpis w rejestrze `examples/scenes/styles/index.js`.

## Inne narzędzie: filmy wokselowe w ASCII

`.claude/skills/voxel-ascii/` (skill `voxel-ascii`) to osobny pipeline w Pythonie:
świat z klocków 3D z cieniami → animacja → filtr ASCII, rolka 1080×1920. Nie używa
silnika z `src/` i jego zasad rysownika. Instrukcja i pułapki: jego `SKILL.md`.

## Repozytorium

- Commituj jako użytkownik: `jarojarojaro-jaro <miki.jaroszek@gmail.com>`
  (autor i committer), push na `main`.
- **Każdy styl/film osobnym commitem.** Zmiany silnika wspólne dla wielu
  stylów idą osobnym commitem przed nimi.
- Głosy: `tools/voice/voice.py tts examples/voice/<film>/script.md --out examples/voice/<film>`.
- Przeglądarka do lint/render: Playwright (Chromium), za proxy z
  `CHROMIUM_ARGS=--ignore-certificate-errors-spki-list=…`.
