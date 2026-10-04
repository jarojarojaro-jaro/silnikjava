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

Scena jest gotowa dopiero, gdy `node tools/lint.mjs` daje 0 błędów i 0 ostrzeżeń,
`npm test` przechodzi, a arkusz klatek (`tools/render.mjs … --fps 2 --sheet`)
został obejrzany.

## Repozytorium

- Commituj jako użytkownik: `jarojarojaro-jaro <miki.jaroszek@gmail.com>`
  (autor i committer), push na `main`.
- **Każdy styl/film osobnym commitem.** Zmiany silnika wspólne dla wielu
  stylów idą osobnym commitem przed nimi.
- Głosy: `tools/voice/voice.py tts examples/voice/<film>/script.md --out examples/voice/<film>`.
- Przeglądarka do lint/render: Playwright (Chromium), za proxy z
  `CHROMIUM_ARGS=--ignore-certificate-errors-spki-list=…`.
