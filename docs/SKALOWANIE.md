# Skalowanie produkcji filmów: od kodu pisanego przez Opusa do specyfikacji

Pytanie: czy filmy muszą powstawać jako kod JS pisany przez duży model? Czy da
się opisać styl tak, żeby mniejsze modele (trzymające się wytycznych)
produkowały je seryjnie, po kilkanaście–kilkadziesiąt sztuk?

**Krótko: tak, ale nie przez „lepszy prompt do pisania JS”.** Trzeba przenieść
geometrię, czas i styl do silnika. Model wybiera wtedy wysokopoziomowe klocki
(węzły, strzałki między id, layout, „kamera na id”, zdanie lektora), a
kompilator zamienia je na wywołania `Storyboard`. Mały model dostaje zadanie,
w którym jest dobry (wypełnienie formularza zgodnie z regułami). Nie musi
robić tego, w czym jest słaby: liczyć pikseli, przewidywać szerokości napisów
odręcznych, planować tras strzałek.

Najważniejsze wnioski:

1. Koszt tokenów to **$0,3–0,7 za film** w każdym rozsądnym wariancie (§8).
   Zejście na mniejszy model oszczędza grosze. Liczy się **powtarzalność
   jakości i czas człowieka** na poprawki, a to daje dopiero DSL + linter.
2. Na start: DSL + kompilator + linter, Opus 5.5 jako reżyser, a wykonawcę
   wybieramy **pomiarem** (Opus na niskim effort vs Sonnet 5.5 vs Haiku 4.5)
   na wspólnym zestawie testowym.
3. Fine-tuning na razie nie ma sensu (§7). „Destylacja” odbywa się przez
   bibliotekę przykładów, reguły i komponenty silnika, które piszą Opus i
   człowiek.

Szkice: [`spec-draft/scene-spec.schema.json`](spec-draft/scene-spec.schema.json),
[`spec-draft/explainer-agent.json`](spec-draft/explainer-agent.json) (odpowiednik
`examples/scenes/explainer.js`), [`spec-draft/rag.json`](spec-draft/rag.json)
(nowy temat). Ten dokument rozwija punkt „Etap 3 — wysokopoziomowy format
sceny” z [`PLAN.md`](PLAN.md).

---

## 1. Gdzie dziś leży trudność

`examples/scenes/explainer.js` ma 71 linii, ale prawie każda zawiera decyzję,
którą model musi podjąć „w głowie”:

| Decyzja | Jak wygląda w kodzie | Trudność dla małego modelu | Docelowo robi to |
| --- | --- | --- | --- |
| Treść i dramaturgia | „Jak działa agent AI?”, 3 pudełka, pętla, „kiedy stop” | średnia: to praca twórcza | **reżyser (Opus)** |
| Wybór kompozycji | rząd 3 pudełek + pętla zwrotna; checklista + postać | średnia | reżyser → nazwa layoutu |
| Współrzędne | `x: 110, y: 270, w: 220…`, środek 640, odstępy | **wysoka**, błędy kumulują się | **layout engine** |
| Dopasowanie tekstu | `b.y + b.h/2 + b.size*0.3`, rozmiary 50/92/56 dobrane ręcznie | **wysoka**: model nie zna szerokości glifów Caveat | pomiar `measureText` + auto-rozmiar |
| Trasy strzałek | punkty kontrolne `curve([[1060,412],[1020,540],[640,585]…])` | **bardzo wysoka** | **auto-routing** między brzegami id |
| Ziarna | `seed: 10+i`, `20+i`, `30+i`… | niska, ale łatwo o kolizje | hash(id) |
| Kolory | `sky/teal/ochre`, `coral` dla akcentu | niska, ale niespójna między filmami | role semantyczne → paleta |
| Timing | `dur: 1.4`, `wait(0.3)`, `dur: 0.6` | średnia: brak wyczucia tempa | reguły tempa + długość narracji |
| Kamera | `{x:640, y:335, zoom:1.9}` | wysoka: trzeba znać bbox | `focus: "llm"` → dopasowanie kadru |
| Postać | `custom()` + `clamp(p*1.6)`, `clamp(p*2-0.8)` | **bardzo wysoka** | komponent `mascot` z emocją |
| Dymek | wielokąt `polygon([[0,0],[190,-6]…])` | wysoka | komponent `bubble` z auto-rozmiarem |

Przykład błędu z obecnego filmu (widoczny w `out/explainer-sheet.png`):
podpis „myśli krok po kroku” ma rozmiar 30 px, bo był dobierany do kadru z
zoomem 1,9. Po powrocie kamery do zoom 1 jest za mały i przecina go elipsa.
Model piszący surowe współrzędne nie zauważy tego bez renderu. Linter z §6
wychwyci to regułą „efektywny rozmiar tekstu przy zoom 1 ≥ 28 px” i „brak
przecięcia tekstu z kreską”.

**Wniosek:** z 11 decyzji tylko 2 (treść, kompozycja) są naprawdę twórcze.
Resztę da się policzyć deterministycznie, więc należy ją zabrać modelowi.

---

## 2. Architektura docelowa

```
 brief (temat, odbiorca, długość)
   │  Opus 5.5 — REŻYSER (raz na film)
   ▼
 outline.json   rozdziały: cel, kluczowa myśl, wzorzec layoutu, elementy słownie, zdania lektora
   │  WYKONAWCA (raz na rozdział, równolegle) — few-shot + schemat + style guide
   ▼
 spec.json      scene-spec 0.1 (bez pikseli, bez sekund)
   │  walidacja L0–L1 (schemat, referencje, limity) ──► błędy → wykonawca (max 2×)
   ▼
 kompilator     layout → routing → rozmiary → kolory → seedy → czasy → kamera
   │  (src/spec/, nowy moduł nad Storyboard; Storyboard bez zmian)
   ▼
 Storyboard → Player → tools/render.mjs (PNG/MP4/arkusz)
   │  linter L2–L3 (geometria, czas) ──► auto-poprawki deterministyczne / wykonawca
   │  L4: arkusz klatek → ocena wizualna (model z vision) ──► poprawki / eskalacja
   ▼
 człowiek: akceptacja outline'u (1 min) + przegląd MP4 (losowo lub zawsze)
```

Ważne: kompilator stoi **nad** `Storyboard`. Zmiany z `PLAN.md`, etap 1
(ruch ręki `Hand`, pismo kreskami, profil prędkości), nie zmieniają formatu
specyfikacji. Spec nie zawiera sekund, więc nowe tempa rysowania po prostu
dają inne czasy.

---

## 3. Format specyfikacji (DSL)

Zasady projektowe:

* **JSON** (nie podzbiór JS): walidowalny schematem, nadaje się do structured
  outputs, nie da się w nim „przemycić” kodu. Człowiek też może go edytować.
* **Id zamiast współrzędnych.** Wszystko, co się odwołuje (strzałka, notatka,
  zaznaczenie, kamera, dymek), wskazuje element po `id`.
* **Role zamiast kolorów** (`main`, `input`, `output`, `alert`, `extra`,
  `neutral`). Paletę wybiera motyw.
* **Rozmiary `s/m/l`** zamiast pikseli.
* **Kroki (`beats`)**: jedno zdanie lektora + lista id do narysowania +
  opcjonalnie kamera. Brak `beats` = każdy element jest osobnym krokiem.
* Schemat używa tylko `anyOf/enum/const/$ref` i `additionalProperties:false`
  (bez rekurencji). Structured outputs w Claude API nie obsługują m.in.
  `minimum/maximum/minLength/maxLength`. SDK usuwa je ze schematu wysyłanego
  do API i sprawdza po stronie klienta, a linter i tak waliduje limity ponownie.

Fragment (uproszczony; pełny plik: `spec-draft/explainer-agent.json`):

```json
{
  "id": "petla",
  "title": { "text": "Jak działa agent AI?", "underline": true },
  "layout": { "type": "row", "items": ["obs", "llm", "act"], "density": "loose" },
  "elements": [
    { "id": "obs", "type": "box", "label": "obserwacja", "role": "input" },
    { "id": "llm", "type": "box", "label": "LLM", "role": "main", "size": "l" },
    { "id": "act", "type": "box", "label": "akcja", "role": "output" },
    { "id": "a1", "type": "arrow", "from": "obs", "to": "llm" },
    { "id": "a2", "type": "arrow", "from": "llm", "to": "act" },
    { "id": "back", "type": "arrow", "from": "act", "to": "obs", "style": "dashed",
      "route": "below", "label": "wynik wraca jako nowa obserwacja" },
    { "id": "n_think", "type": "note", "text": "myśli krok po kroku", "near": "llm", "side": "below", "role": "alert" }
  ],
  "beats": [
    { "say": "Agent zaczyna od obserwacji.", "show": ["obs"] },
    { "say": "Obserwacja trafia do modelu.", "show": ["a1", "llm"] },
    { "say": "Model wybiera akcję.", "show": ["a2", "act"] },
    { "say": "Wynik wraca jako nowa obserwacja.", "show": ["back"] },
    { "say": "Model myśli krok po kroku.", "camera": { "focus": "llm" }, "show": ["n_think"] },
    { "camera": "reset" }
  ]
}
```

To ~25 linii bez jednej liczby, zamiast ~45 linii JS z ok. 120 liczbami.

### Katalog klocków

| Element | Pola kluczowe | Kompilator robi |
| --- | --- | --- |
| `box` | `label`, `role`, `size`, `shape` (rect/ellipse/cloud/cylinder/doc), `icon` | wymiary z pomiaru tekstu, kontur → kredka → podpis |
| `icon` | `name` z katalogu, `label` | rysunek z biblioteki (kreski w kolejności) + podpis pod spodem |
| `text` | `text`, `size` | duże zdanie/liczba (layout `statement`) |
| `checklist` | `items[{text, mark, role}]`, `reveal` | kratki, ptaszki/krzyżyki, po pozycji na krok |
| `arrow` | `from`, `to`, `style`, `route` (auto/direct/below/above), `label` | punkty zaczepienia na brzegach, łuk, objazd |
| `note` | `text`, `near`, `side` | dopisek przy elemencie, kolizje → zmiana strony |
| `mark` | `target`, `style` (circle/underline/highlight/cross/star/liquid) | zaznaczenie wokół bbox celu |
| `mascot` | `character`, `emotion`, `action`, `look_at` | postać w slocie kadru, choreografia kontur→kredka→detale |
| `bubble` | `from` (postać), `text`, `kind` (say/think) | dymek dopasowany do tekstu, „pop” |

### Layouty (zamiast współrzędnych)

| `layout.type` | Kiedy | Pojemność (16:9) |
| --- | --- | --- |
| `row` | proces, przepływ, przyczyna → skutek | 2–5 węzłów |
| `column` | warstwy, kroki od góry | 2–4 |
| `grid` | zbiór równorzędnych rzeczy (narzędzia, cechy) | 4–6 (`cols` 2–3) |
| `cycle` | pętla, cykl, sprzężenie zwrotne | 3–5 |
| `hub` | centrum + otoczenie (model + narzędzia) | 1 + 3–5 |
| `checklist` | warunki, kroki do odhaczenia | 2–5 pozycji |
| `compare` | przed/po, bez/z, A vs B | 2 × (1–4) |
| `timeline` | historia, wersje v1→v2→v3 | 3–5 punktów |
| `statement` | jedna liczba albo teza na cały kadr | 1 |
| `free` | furtka: komórki siatki 12×6 | tylko gdy nic innego nie pasuje |

`slot: "right"|"left"` rezerwuje ok. 28% szerokości na postać. Layout
ściska wtedy scenę do pozostałej części.

### Co liczy kompilator (deterministycznie)

* **Strefy kadru** (1280×720, skalowane dla 1:1 i 9:16): margines 48 px; pas
  tytułu y 40–150; scena y 170–600; pas napisów y 620–700 (gdy
  `narration ≠ none` i napisy są wypalane).
* **Rozmiar węzłów**: szerokość tekstu z `ctx.measureText` w docelowej
  czcionce (w przeglądarce, tej samej co render) + padding. Wspólna wysokość w
  rzędzie. `size` wybiera stopień typograficzny. Gdy etykieta się nie mieści:
  zmniejsz stopień o 1 → zawiń na 2 linie → błąd lintera.
* **Pozycje**: rozkład równomierny w strefie sceny (row: środki na
  `x = left + (i+0.5)·W/n`). `density` zmienia odstępy. Cykl/hub na elipsie
  wpisanej w strefę.
* **Strzałki**: zaczepienie w punkcie brzegu bbox najbliższym drugiemu
  końcowi, odsunięcie 12 px, łuk z wybrzuszeniem 8–12% długości (znak z
  hash(id)). `below/above`: trasa pod/nad wszystkimi węzłami rzędu, jak pętla
  zwrotna w explainerze. Kontrola przecięć z innymi bbox i ewentualna zmiana
  strony.
* **Ziarna**: `seed = hash(meta.seed, id)`. Ten sam spec daje tę samą klatkę,
  inny `meta.seed` daje wariant.
* **Kolejność rysowania** w kroku: kontur → kredka (jak dziś, `z:-1`) →
  podpis → zaznaczenia. Strzałka, której cel pojawia się w tym samym kroku,
  idzie przed celem, więc ręka „prowadzi” do następnego elementu.
* **Czas** (×mnożnik tempa: calm 1,25 / normal 1 / brisk 0,8):
  * kreska: długość / 650 px/s (jak `Storyboard`), kredka 0,6 s, pismo 14 zn/s;
  * krok: `max(czas_rysowania, czas_mowy) + 0,4 s`, gdzie `czas_mowy` =
    słowa / 2,5 (PL, lektor) albo znaki / 15 (same napisy). Z TTS: rzeczywista
    długość audio;
  * kamera: najazd 1,2 s, postój ≥ 1,5 s, powrót 1,0 s; koniec rozdziału:
    postój 1,2 s → `clear` 1,0 s.
* **Kamera `focus`**: bbox elementów + 15% marginesu, zoom = dopasowanie
  ograniczone do [1; 2,2]. Przed `clear` kompilator zawsze dokłada `reset`.

### Furtka na rzeczy nietypowe

Gdy reżyser potrzebuje czegoś, czego katalog nie ma (nowa postać, nietypowy
rysunek, animacja „cieczy” w kolbie), **nie dajemy wykonawcy JS**. Opus albo
człowiek dopisuje komponent do biblioteki (`icon`, `shape`, `layout`, nowy
`character`) z testem i podglądem. Odtąd wszystkie modele używają go po
nazwie. Metryka: odsetek outline'ów, które wymagały nowego komponentu.
Powinien spadać.

---

## 4. Style guide: reguły dla wykonawcy

To jest rdzeń promptu systemowego (ok. 1,5–2 tys. tokenów). Każda reguła ma
odpowiednik w linterze. Model nie musi „pamiętać”, bo linter go poprawi.

**Kadr i gęstość**

1. Jeden rozdział = jeden kadr = jedna myśl. Maksymalnie: 6 węzłów, 6 strzałek,
   2 notatki, 1 zaznaczenie, 1 postać, 12 kroków.
2. Rozdział trwa 15–40 s, film 3–6 rozdziałów (60–150 s).
3. Nowy rozdział (starcie tablicy), gdy zmienia się temat albo gdy kadr
   doszedłby do limitu. `end: "keep"` tylko gdy następny rozdział rozbudowuje
   ten sam diagram.

**Kolor (role)**

4. `main` (teal) to pojęcie centralne, **jedno** na kadr. `input` (sky) to
   wejście/kontekst. `output` (ochre) to wynik, a podkreślenie tytułu jest
   zawsze ochre. `alert` (coral) to problem, ostrzeżenie, dopisek „aha”.
   `extra` (plum) to trzecia kategoria. Kontury i tekst zawsze `ink`, strzałki
   `pen`. Kompilator wymusza to sam.
5. Najwyżej 3 role wypełnień w kadrze plus `alert` jako akcent.

**Typografia** (w jednostkach sceny 1280×720, przy zoom 1)

6. Tytuł: font `title`, ≤ 32 znaki, jedna linia. Etykieta węzła: 1–2 słowa,
   ≤ 16 znaków. Notatka ≤ 32 znaki. Podpis strzałki ≤ 40 znaków. Dymek ≤ 3
   słowa.
7. Nic poniżej 28 px efektywnie przy zoom 1. Rzeczy pisane podczas zbliżenia
   też muszą być czytelne po powrocie kamery.
8. `mono` tylko dla kodu i komend. Liczby i skróty (LLM, API) mogą być większe.

**Tempo i kolejność**

9. Jeden krok = jedno zdanie lektora (≤ 15 słów) = 1–3 nowe elementy.
   Narracja mówi o tym, co **właśnie** się rysuje.
10. Na tablicy słowa-klucze, w narracji pełne zdanie. Nie powtarzaj zdania
    lektora na tablicy.
11. Strzałka pojawia się, gdy istnieje jej początek. Cel rysuje się w tym
    samym albo następnym kroku. Nigdy „strzałka w pustkę” na koniec kroku.
12. Zaznaczenia (`mark`) i notatki dopiero po tym, jak cel jest narysowany.
    Najwyżej jedno zaznaczenie na rozdział.
12a. **Obiekt w całości, zanim zacznie się następny: kontur → kolor → detale
    → podpis** (sprawdza lint). Pełna lista zasad rysownika, gotowa do
    wklejenia w prompt: [ZASADY.md](ZASADY.md).

**Kamera**

13. Najwyżej 1–2 najazdy na rozdział: przy dopisywaniu detalu albo przy
    puencie. Zawsze z powrotem (`reset`) przed końcem rozdziału. Zoom ≤ 2,2.
14. Nie ruszaj kamerą w krokach, w których nic się nie rysuje i nikt nic nie
    mówi.

**Postać**

15. Najwyżej jedna postać w filmie, w slocie bocznym. Emocja zgodna z
    narracją (`confused` przy problemie, `happy` przy rozwiązaniu). Pojawia
    się najwyżej raz na rozdział, nie w każdym.

**Napisy**

16. Napis ≤ 2 linie po ≤ 42 znaki. Jeśli zdanie jest dłuższe, podziel krok na
    dwa.

---

## 5. Przykłady few-shot i podział ról

### Biblioteka przykładów

* **10–12 złotych przykładów** na start, każdy jako para *wejście
  (rozdział outline'u) → wyjście (rozdział spec)*. Pokrycie: każdy layout co
  najmniej raz, do tego postać z emocją, kamera `focus`, `end:"keep"`, pętla
  `route:"below"`, `compare`, checklista z `reveal:"item"`.
* **1 pełny film kanoniczny** (`explainer-agent.json`) w stałej części
  promptu, żeby model widział proporcje całości.
* **2 anty-przykłady**: spec z błędami lintera i jego poprawiona wersja. Uczą
  czytać komunikaty lintera.
* **Dobór dynamiczny po tagach, nie embeddingach.** Reżyser podaje w outline
  `layout` rozdziału. Do promptu wykonawcy trafiają 2–3 przykłady z tym samym
  layoutem i (jeśli jest) z postacią. Deterministyczne i tanie.
* **Kolejność w prompcie pod cache**: style guide + schemat + katalog ikon +
  film kanoniczny w stałym prefiksie (`cache_control`), a dobrane przykłady i
  rozdział outline'u za nim.
* **Biblioteka rośnie z produkcji**: każdy rozdział zaakceptowany przez
  człowieka bez poprawek trafia do puli kandydatów. Raz na jakiś czas
  wymieniamy najsłabsze przykłady. Ta sama pula to zestaw testowy (eval) i
  ewentualne dane do fine-tuningu w przyszłości.

### Reżyser vs wykonawca

| | Reżyser (Opus 5.5) | Wykonawca (do wyboru pomiarem) |
| --- | --- | --- |
| Wejście | brief, odbiorca, długość, styl | 1 rozdział outline'u + przykłady + reguły |
| Decyzje | o czym jest film, metafory, podział na rozdziały, wzorzec layoutu, zdania lektora, co jest `main` | id, role, rozmiary, kolejność w `beats`, kamera, długości tekstów |
| Wyjście | `outline.json` (krótki, czytelny dla człowieka) | `spec.json` rozdziału (structured outputs) |
| Wywołania | 1 na film | 1 na rozdział (równolegle) + poprawki |

Przykład rozdziału outline'u (wejście wykonawcy):

```json
{ "id": "potok", "goal": "pokazać kolejność: najpierw szukaj, potem generuj",
  "layout": "row", "title": "Najpierw szukaj, potem pisz",
  "elements": ["pytanie (ikona chat)", "wyszukiwarka (box, extra)", "3 fragmenty (ikona files)",
               "LLM (main)", "odpowiedź (ikona check, output)", "dopisek: ze źródłami!"],
  "narration": ["RAG odwraca kolejność: najpierw szukamy.", "Wyszukiwarka wybiera kilka fragmentów.",
                "Fragmenty i pytanie trafiają do modelu.", "Model pisze odpowiedź.", "I pokazuje źródła."],
  "emphasis": "zbliżenie na odpowiedź ze źródłami" }
```

Przy tak szczegółowym outline'ie wykonawca robi niemal tłumaczenie
1:1, więc jego rola może przypaść małemu modelowi. Rzeczy twórcze (co
narysować, jaka metafora) zostają u Opusa. **Nie każ małemu modelowi wymyślać
metafor.**

---

## 6. Walidacja i pętla jakości

| Poziom | Co sprawdza | Gdzie | Kto poprawia |
| --- | --- | --- | --- |
| L0 | JSON + schemat | structured outputs przy generacji + ajv | (wymuszone) |
| L1 | semantyka: unikalne id, referencje istnieją, każdy element pokazany dokładnie raz (checklista: tyle razy, ile pozycji), strzałka po swoim początku, ikony z katalogu, limity z §4, długości tekstów | Node, przed kompilacją | wykonawca (lista błędów) |
| L2 | geometria po kompilacji: tekst mieści się w węźle, kolizje bbox (tekst/węzeł/notatka/postać), wyjście poza bezpieczny kadr, strzałka przecina obcy węzeł, efektywny rozmiar tekstu < 28 px, `focus` celuje w niewidoczny element | **w przeglądarce** (Playwright, prawdziwe czcionki) | najpierw kompilator, potem wykonawca |
| L3 | czas: krok krótszy niż narracja, rozdział > 40 s, film poza 60–150 s, postój kamery < 1,5 s | Node | kompilator (wydłuża) / wykonawca (dzieli krok) |
| L4 | wizualnie: czytelność, równowaga kadru, zgodność z narracją, „czy to wygląda jak nasz styl” | render arkusza + model z vision | wykonawca / eskalacja do Opusa / człowiek |

**Komunikaty lintera piszemy dla modelu**: z id, przyczyną i proponowaną
poprawką.

```
E201 chapter=potok id=search: etykieta "wyszukiwarka" 312 px > 260 px dostępne w row(5).
     Popraw: skróć etykietę (≤ 9 znaków) LUB size "s" LUB layout.density "tight".
E310 chapter=petla id=n_think: efektywny rozmiar 26 px przy zoom 1 (min 28).
     Popraw: usuń "size" (domyślnie m) — notatka jest pisana podczas zbliżenia.
W402 chapter=potok beat=2: narracja 3,4 s > rysowanie 1,1 s — OK, krok wydłużony.
```

**Auto-poprawki** w kolejności: (1) deterministyczne w kompilatorze (stopień
pisma w dół, zawinięcie, zmiana strony notatki, objazd strzałki, zagęszczenie
layoutu); (2) wykonawca dostaje swój spec + listę błędów i zwraca poprawiony
rozdział, najwyżej 2 rundy; (3) eskalacja do Opusa; (4) człowiek.

**Ocena wizualna (L4)**:

* Render **klatek końcowych każdego kroku** (nie co N sekund), sklejonych w
  arkusz na rozdział. `tools/render.mjs --sheet` już skleja klatki. Brakuje
  wyboru czasów (`--times` albo `--beats` z czasami z kompilatora). Arkusz
  zmniejszamy do ok. 1280×720. Obraz kosztuje wtedy około 1,2 tys. tokenów.
* **Tryb debug** w kompilatorze: cienkie ramki bbox z id. Model oceniający
  wskazuje wtedy problem po id („n_think nachodzi na m_llm”) i poprawka trafia
  w konkretny element.
* Rubryka jako structured output, np. `{czytelnosc:1-5, kolizje:1-5,
  rownowaga:1-5, zgodnosc_z_narracja:1-5, styl:1-5, problemy:[{beat, id,
  opis, poprawka}]}`. Próg akceptacji kalibrujemy na ~30 arkuszach ocenionych
  ręcznie.
* Geometria (L2) jest głównym sitem, bo jest deterministyczna i tania. L4
  łapie to, czego reguły nie widzą (pusty kadr, chaos, zła metafora).
  Modelowi oceniającemu nie ufamy bezwarunkowo.

**Regresja silnika**: złote speci renderowane w testach (klatki są
deterministyczne). Zmiana w `src/` (np. etap 1 z PLAN.md) pokazuje różnice na
arkuszach przed i po.

---

## 7. Prompting, fine-tuning czy destylacja?

| Podejście | Ocena na start |
| --- | --- |
| **Prompting: reguły + schemat + few-shot + linter** | **Tak.** Tanie, natychmiastowe, łatwe do zmiany. Structured outputs gwarantują zgodność ze schematem, linter resztę. |
| Mniejszy model jako wykonawca | **Tak, ale dopiero po pomiarze.** Dokumentacja Claude API radzi, żeby przed kaskadą modeli zmierzyć najmocniejszy model na niższym effort, bo często dorównuje i daje jedną przestrzeń cache. Porównać na tym samym evalu: Opus 5.5 (`low`/`medium`), Sonnet 5.5, Haiku 4.5. |
| Fine-tuning modelu Claude | **Nie planować.** Dokumentacja Claude API, z której korzystałem, nie opisuje fine-tuningu jako funkcji API. Przy DSL-u nie jest też potrzebny: zadanie wykonawcy jest wąskie i dobrze opisane regułami. |
| Fine-tuning małego modelu open-weights | Dopiero przy tysiącach filmów lub wymogu on-prem. Dane zbieramy już teraz za darmo (pary outline→spec zaakceptowane przez człowieka); próg sensowności to kilkaset–tysiąc par. |
| „Destylacja” przez przykłady | **Tak, ciągle.** Opus produkuje i poprawia speci, człowiek akceptuje, najlepsze idą do biblioteki few-shot. Wiedza Opusa trafia też do kodu: nowe layouty, ikony i reguły auto-poprawek. To najtrwalsza forma destylacji. |

---

## 8. Koszt na film (orientacyjnie)

Ceny z dokumentacji Claude API (stan cache: 2026-09-25), za 1 mln tokenów
wejście / wyjście: **Opus 5.5** (`claude-opus-5-5`) $4 / $20, odczyt z cache
$0,20; **Sonnet 5.5** (`claude-sonnet-5-5`) $2 / $10, odczyt z cache $0,20;
**Haiku 4.5** (`claude-haiku-4-5`) $1 / $5. Zapis do cache to 1,25× ceny
wejścia (TTL 5 min). Batch API to −50%. Uwaga: Opus 5.5 ma domyślny effort
`medium`, więc ustawiać go jawnie. Haiku 4.5 cache'uje dopiero prefiks
≥ 4096 tokenów (nasz ma ok. 12 tys., więc OK).

Założenia: film 4 rozdziały, ok. 90 s. Stały prefiks wykonawcy ok. 12 tys.
tokenów. Rozdział spec ok. 3 tys. tokenów wyjścia razem z myśleniem. Reżyser:
15 tys. wejścia i ok. 6 tys. wyjścia. Ocena wizualna: 4 arkusze po ok. 1,5 tys.
tokenów.

| Wariant | Reżyser | Wykonawca (4 rozdz.) | Poprawki | QA wizualne | **Razem** | Batch |
| --- | --- | --- | --- | --- | --- | --- |
| A. Dziś: Opus pisze JS (+2 iteracje z zrzutami) | – | ~$0,70 (50k we / 25k wy) | w cenie | ręcznie | **~$0,70 + czas człowieka** | – |
| B. Opus + Opus (effort `low/medium`) | $0,18 | $0,33 | $0,10 | $0,07 (Opus) | **~$0,70** | ~$0,35 |
| C. Opus + Sonnet 5.5 | $0,18 | $0,16 | $0,05 | $0,04 (Sonnet) | **~$0,45** | ~$0,23 |
| D. Opus + Haiku 4.5 | $0,18 | $0,08 | $0,04 (więcej rund) | $0,04 (Sonnet) | **~$0,35** | ~$0,18 |

Wnioski:

* 50 filmów to **$10–35 za tokeny**. Różnica między B i D to ok. $17 na 50
  filmów. Wybór wykonawcy rozstrzyga więc **jakość i liczba rund**, nie cena.
* Render jest lokalny: ok. 2700 klatek dla 90 s × 30 fps przez Playwright, to
  minuty CPU. Koszt pomijalny, ale to on ogranicza przepustowość. Renderować
  równolegle (kilka przeglądarek).
* Dominującym kosztem jest dziś **czas człowieka** na poprawianie
  współrzędnych i timingu. DSL ma zbić go z „poprawiam kod” do „czytam outline
  (1 min) i oglądam MP4”.

---

## 9. Ryzyka

| Ryzyko | Skutek | Środek zaradczy |
| --- | --- | --- |
| DSL za ubogi → filmy monotonne | „wszystko wygląda tak samo” | warianty layoutów i `meta.seed`, motywy, rosnąca biblioteka komponentów (§3, furtka); metryka różnorodności layoutów |
| Złożoność layout engine'u (routing, dopasowanie) | opóźnienie MVP | start od 5 layoutów (row, column, checklist, cycle, statement); `route` ręcznie wskazywany (`below/above`) zanim powstanie pełny routing |
| Pomiar tekstu w Node ≠ przeglądarka | fałszywe OK/błędy lintera | L2 zawsze w Playwright z tymi samymi czcionkami co render |
| Model oceniający (vision) myli się | przepuszczone błędy albo fałszywe alarmy | L2 jako główne sito, kalibracja progu, losowy przegląd ludzki 10–20% |
| Błędy merytoryczne w treści | film ładny, ale nieprawdziwy | akceptacja outline'u przez człowieka: najtańszy punkt kontroli |
| Zmiany silnika (PLAN.md etap 1) zmieniają czasy | rozjazd z narracją | spec bez sekund, czasy liczone w kompilatorze; regresja na złotych specach |
| TTS: długość zdań trudna do przewidzenia | narracja wyprzedza rysunek | czas kroku z faktycznej długości audio (faza 3) |
| Ograniczenia structured outputs (brak min/max, rekurencji) | schemat odrzucony albo luźniejszy | schemat płaski (anyOf, bez rekurencji), limity sprawdzane przez SDK i linter |
| Za bliskie naśladowanie cudzego stylu (stentor.studio) | ryzyko wizerunkowe | własna paleta, maskotka i motywy; analiza służy technice, nie kopiowaniu |

---

## 10. Kolejność wdrożenia

**Faza 0 (ten dokument).** Style guide, szkic schematu, 2 przykładowe speci.
Do decyzji: nazwy ról, lista ikon, które layouty w MVP.

**Faza 1: MVP kompilatora (ok. 1–2 tyg.).**
`src/spec/` (spec → `Storyboard`): layouty `row`, `column`, `checklist`,
`cycle`, `statement`; elementy `box`, `text`, `arrow` (auto/below/above),
`note`, `mark` (circle/underline/highlight), `checklist`, `mascot` (Kleks:
neutral/happy + wave), `bubble`; 8–10 ikon; `camera.focus`; reguły czasu; L0–L1.
Narzędzie `tools/spec.mjs validate|lint|render|sheet` i strona
`examples/spec.html?spec=…`. **Kryterium:** `explainer-agent.json` daje film
porównywalny z `explainer.js` (arkusze obok siebie) bez ręcznych liczb.

**Faza 2: pipeline i pomiar (ok. 1 tydz.).** Prompty reżysera i wykonawcy,
8–10 złotych przykładów, L2–L3 w Playwright, pętla auto-poprawek. **Eval: 15
tematów** (różne layouty). Porównanie wykonawców B/C/D. Metryki:
*czysty lint za 1. razem*, *czysty po poprawkach*, *ocena L4*, *akceptacja
człowieka bez edycji*, *minuty przeglądu na film*.

**Faza 3: jakość i skala.** L4 z trybem debug, wybór klatek po krokach w
`render.mjs`, Batch API, layouty `hub`/`compare`/`timeline`/`grid`, 30+ ikon,
emocje postaci, narracja: TTS → czasy kroków, napisy VTT/SRT (PLAN.md etap 3).

**Faza 4: dalej.** Edytor (podgląd + przeciąganie → zapis do spec), motywy
(tablica kredowa), formaty 1:1 i 9:16. Fine-tuning open-weights tylko gdy
wolumen i dane to uzasadnią.

---

## Załącznik: `explainer.js` → `explainer-agent.json`

* Co się zgadza: tytuł z podkreśleniem, 3 węzły w rzędzie z rolami
  input/main/output, 2 strzałki, przerywana pętla zwrotna pod spodem z
  podpisem, najazd na LLM z dopiskiem i kółkiem, starcie tablicy, checklista
  odsłaniana po pozycji, maskotka machająca z dymkiem „gotowe!”.
* Co się zmienia: zero współrzędnych i sekund. Ptaszki mają kolor z roli (dziś
  pierwszy `pen`, reszta `coral`, w spec `main` / `alert`). Dopisek przy LLM
  dostaje rozmiar czytelny także po powrocie kamery. Doszła narracja (`say`),
  której dziś nie ma.
* Czego DSL nie wyrazi bez nowego komponentu: dowolnego kształtu dymka i
  ręcznie dobranej choreografii postaci (`clamp(p*1.6)`). Obie rzeczy stają
  się parametrami komponentów `bubble` i `mascot`.
