---
name: voxel-ascii
description: Filmy i obrazy „świat z klocków w ASCII” — izometryczna diorama z wokseli (jak z gry z klocków) z prawdziwym oświetleniem (cienie, okluzja), animacją (woda, światła, snop latarni, śnieg, liście, ptaki, najazd kamery) i filtrem ASCII z tilt-shiftem, pionowo 1080×1920 (rolka). Użyj, gdy ktoś prosi o taki film/kadr, wokselową scenę, „ASCII art z gry”, klimatyczną dioramę, albo pokazuje podobny klip jako wzór. To NIE jest silnik rysowanych filmów objaśniających z src/ (ręka, lektor) — to osobne narzędzie w Pythonie.
---

# voxel-ascii — świat z klocków w ASCII

Pipeline w Pythonie (numpy, scipy, Pillow, ffmpeg), niezależny od silnika JS w `src/`.
Wynik: MP4 1080×1920 (30 kl./s) i podglądy PNG. Dwie gotowe sceny:
`lighthouse` (latarnia na klifie o zachodzie, wariant `noc`) i `shrine`
(zimowa świątynia z torii, wariant `zmierzch`).

## Szybki start

```bash
pip install -r .claude/skills/voxel-ascii/requirements.txt   # numpy, scipy, pillow (+ ffmpeg w systemie)
S=.claude/skills/voxel-ascii
python3 $S/run.py lighthouse --preview 8          # out/voxel-ascii/lighthouse/raw_008.0.png + ascii_008.0.png
python3 $S/run.py lighthouse --sheet              # 6 klatek z całego filmu w jednym pliku
python3 $S/run.py lighthouse --video              # pełny film, ok. 10 min na 4 rdzeniach
python3 $S/run.py lighthouse --variant noc --video --seconds 10
python3 -m unittest discover -s $S/tests -v       # testy biblioteki (sekundy)
```

Wyniki idą do `out/voxel-ascii/<scena>[-wariant]/` (katalog `out/` jest w .gitignore).
Świat i render 3D są w cache (`out/voxel-ascii/<scena>-cache/`): zmiana tylko `look`
(ASCII, efekty, kamera, kolorystyka) nie liczy cieni od nowa; zmiana pliku sceny, `camera`
albo `light` liczy je od nowa (ok. 3 min). `--force` wymusza wszystko.

## Jak to działa (4 etapy)

1. **Świat** (`scenes/<scena>.py: build()` → `voxlib/world.py`): siatka 256×256×96 materiałów
   (`voxlib/materials.py`) + światła punktowe + nazwane punkty (`w.marks['lamp']`).
2. **Render 3D** (`voxlib/render.py`): promień z każdego piksela przez siatkę (DDA, rzut
   ortograficzny), tekstury proceduralne na teksel, okluzja w rogach ścianek (jak gładkie
   oświetlenie w grach z klocków) + szeroka okluzja z rozmytej objętości, miękkie cienie
   słońca (3 promienie), mapy świateł w 4 grupach migotania, atrybuty wody.
3. **Klatka** (`voxlib/look.py: Look.frame`): światła z migotaniem, woda (fale, fresnel,
   odbłyski, piana od odległości od brzegu), efekty, tonowanie filmowe, kamera (najazd).
4. **ASCII**: komórka 6×10 px, znak z rampy 16 znaków wg rzeczywistego pokrycia glifu
   (DejaVu Sans Mono Bold), dither Bayera, na krawędziach znaki kierunku `- / | \`
   (tensor struktury), kolor znaku = kolor komórki (rozjaśniony, nasycony), tło między
   znakami = ten sam kolor przygaszony; potem poświata, tilt-shift, winieta, ziarno.

## Nowa scena

Skopiuj `scenes/shrine.py` albo `scenes/lighthouse.py` i zmień `build()` oraz `CONFIG`.

```python
from voxlib import materials as M
from voxlib.world import World

CONFIG = dict(
    camera=dict(az=30, el=55, scale=10, focus=(128, 130, 16), size=(1280, 2240)),
    light=dict(sun_dir=(-0.35, 0.80, 0.52), sun=(1.2, 0.95, 0.7), sky_top=(0.4, 0.46, 0.68),
               sky_side=(0.3, 0.34, 0.5), bounce=(0.12, 0.08, 0.05)),
    look=dict(effects=('leaves', 'birds'), seconds=20),
)
VARIANTS = {'noc': dict(light=dict(...), look=dict(light_gain=2.5, ...))}

def build():
    w = World(256, 256, 96, water_level=8, seed=1)
    # teren: w.H[:] = mapa wysokości, g[:] = materiały kolumn (numpy), potem w.fill_water()
    # obiekty: w.lamp_post, w.stone_lantern, w.torii, w.forest, w.tree_pine, w.tree_deciduous,
    #          w.bush, w.boat, w.rock, w.fox, w.path, w.flatten, w.put, w.light, w.marks[...]
    return w
```

**Układ świata (ważne przy projektowaniu):**
- x, y na ziemi, z w górę. Kamera patrzy od +x+y+z, widać tylko ściany **+x, +y i górę**.
  Drzwi, okna, napisy, detale frontu stawiaj na ścianach +x / +y.
- `d = (x+y)/2` to głębia: mała = góra kadru (tył), duża = dół (przód). `l = (x−y)/2` to bok.
- Przy `scale=10`, `size=(1280, 2240)` w kadrze 1080×1920 mieści się mniej więcej
  `|l − l_focus| < 38` i `d` ± 80 wokół ogniska; wysokość podnosi obiekt o ok. 5,7 px na woksel.
- Linia prowadząca (schody, molo, ścieżka) wzdłuż +y biegnie na ekranie z góry na dół lekko
  w lewo — dobra oś kompozycji, jak w klipach-wzorach.

**Konfiguracja `look`** (pełna lista i wartości domyślne: `DEFAULTS` w `voxlib/look.py`):
`effects` (`beam`, `birds`, `leaves`, `snow`), `seconds`, `move` (zoom i przesunięcie kamery),
`exposure`, `contrast`, `warm`/`cool` (tonowanie świateł i cieni), `haze*` (mgiełka u góry),
`light_gain`/`lamp_gain`/`flicker` (lampy), `water` (kolory, `glint`, `foam`), `beam`
(`mark`, `period`, `strength`), `ascii` (`cell`, `bg`, `fg`, `sat`, `edge`, `coherence`,
`dither`), `tiltshift` (górna i dolna granica ostrości), `bloom`, `vignette`, `grain`, `gain`.

## Procedura jakości (zawsze w tej kolejności)

1. `--preview 8` i **najpierw obejrzyj `raw_*.png` (3D bez ASCII)**. ASCII tylko przenosi
   jakość — jeśli surowy render jest płaski, film też będzie płaski.
2. Popraw świat/światło, aż raw wygląda jak ładna gra z klocków; potem `ascii_*.png`.
3. `--sheet`: czy wszystko się rusza (snop, woda, kamera) i czy nic nie ucieka z kadru.
4. `--video`, na koniec `ffprobe` (1080×1920, 30 kl./s, liczba klatek) i 2–3 klatki z MP4.

## Pułapki (z pierwszych prób)

- **Płaskie kolory bez światła wyglądają tanio.** Jakość robią: cienie, okluzja w rogach,
  tekstury na teksel (kwiatki w trawie, plamki brzozy, fugi bruku, deski), ciepłe światło
  + chłodne cienie. Nie wracaj do rysowania płaskich wielokątów.
- **Pionowa ściana po skosie siatki = płot z kolców.** Klif wzdłuż `d = const` rób jako
  tarasowe zbocze (przejście ≥ 9 komórek, szum średniej skali, kępy trawy na półkach)
  albo prowadź ściany wzdłuż osi x / y.
- **Woda „jak śnieg”:** odbłyski muszą być rzadkie (wykładnik ~2600). Dno łagodne
  (0,15 na komórkę), wtedy jest szeroki pas turkusu przy brzegu.
- **Czarne rogi kadru:** promienie poza mapą — `Look` zamienia je w otwarte morze, gdy
  wychodzą przednią krawędzią (duże x / y) w scenie z wodą, a w mgłę (`haze`) za tylną.
  Gdy przesuwasz kamerę albo dodajesz rzeczy przy brzegu mapy, sprawdź rogi podglądu.
- **ASCII za ciemne / nieczytelne:** tło między znakami ≈ 0,5–0,6 koloru, znak ≈ 1,5×,
  pogrubiony font. Za niski próg krawędzi (`edge` < 0,09, `coherence` < 0,7) zamienia
  teksturę trawy w szum `/ | \`. Bez ditheru płaskie pola to jeden znak w kółko.
- **`taken` blokuje drzewa w całym pasie**, jeśli zapomnisz o zakresie y — korytarz w lesie.
- Kompozycja: ważne obiekty (łódź, lis, budynek) nie mogą być ucięte krawędzią ani zasłonięte
  (np. łódź pod molo); puste rogi wypełnij (skały, boja, łódka, drzewa).
- `pkill -f nazwa` zabija też własną powłokę, gdy nazwa jest w poleceniu — zabijaj po PID.

## Ograniczenia

Świat jest statyczny (ruch: woda, światła, cząsteczki i ptaki jako warstwa 2D, kamera to
najazd/przesunięcie bez obrotu). Bez dźwięku. Czas: render 3D ok. 3 min, klatka ok. 1 s
na rdzeń (20 s filmu ≈ 10 min na 4 rdzeniach).
