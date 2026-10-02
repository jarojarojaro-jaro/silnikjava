# Od skryptu do filmu: jak powstaje rysowany film objaśniający (research)

Stan na 2026-10-02. Dokument odpowiada na pytanie „jak wygląda zrobienie
filmiku, gdy dam skrypt?”. Opisuje praktykę studiów i narzędzi, reguły pisania
skryptu, synchronizację obrazu z głosem, wybór głosu, style wizualne i
proponowany przepływ pracy. Format sceny (DSL), linter i podział ról
reżyser/wykonawca opisuje [`SKALOWANIE.md`](SKALOWANIE.md). Tu do niego tylko
nawiązuję.

**Najważniejsze w skrócie**

* W studiu **głos nagrywa się przed animacją**, bo to on wyznacza czas
  każdej kreski. Zmiana tekstu po nagraniu oznacza ponowne nagranie i jest
  najczęstszą przyczyną opóźnień. Nasz silnik automatyzuje najdroższy etap
  (rysunek i animację). Wąskim gardłem zostają skrypt i głos.
* Polszczyzna jest „wolniejsza w słowach” niż angielski. Do szacowania
  przyjmij **ok. 2,0–2,2 słowa/s (120–130 słów/min)**, a nie 2,5 słowa/s
  (150/min) z poradników anglojęzycznych.
* Jedno zdanie lektora = jeden beat = 1–3 nowe elementy, zwykle 3–8 s. Na
  tablicy tylko słowa-klucze, pełne zdanie w głosie (Mayer).
* Synchronizacja: rysunek **zaczyna się tuż przed** słowem, które go nazywa,
  i nie powinien zostawać w tyle. Najprostsza technika to **synteza osobnego
  pliku audio dla każdego beatu**. Długość beatu znamy wtedy dokładnie, bez
  wyrównywania.
* Spośród sprawdzonych dostawców polski TTS ze znacznikami czasu dają **Azure**
  (WordBoundary, bookmark), **Amazon Polly** (speech marks), **ElevenLabs**
  (znaczniki na poziomie znaków) i **Google** (SSML `<mark>`, ale nie dla
  głosów Chirp 3 HD). Lektora nagranego przez człowieka wyrównujemy
  **WhisperX** (ma domyślny model wyrównania dla `pl`) albo **aeneas**.
* Styl obecnego silnika to „atrament na kremowym papierze + kredka”. Na
  pierwszy wspólny film w zupełnie innym stylu proponuję **tablicę kredową**
  (najmocniejszy kontrast, mało pracy w silniku). Alternatywy to **blueprint**
  albo **notatnik w kratkę**.

---

## 1. Jak to robią profesjonaliści

### Etapy, role, czasy

| # | Etap | Kto | Co powstaje | Uwagi |
| --- | --- | --- | --- | --- |
| 1 | Brief | klient + producent | cel, odbiorca, długość, kanały, wytyczne marki | |
| 2 | Skrypt | scenarzysta | tekst lektora, opis scen, napisy ekranowe, orientacyjny czas | ~150 słów/min (EN) |
| 3 | Storyboard | scenarzysta + ilustrator | kadr na każdą „zmianę obrazu” + zdanie VO + czas | 60–90 s to zwykle 10–20 kadrów |
| 4 | Nagranie lektora | lektor + realizator | finalna ścieżka głosu | **zamyka timing** |
| 5 | Animatik | montażysta/animator | plansze storyboardu zmontowane do VO (często z roboczym „scratch” VO) | test tempa przed kosztowną animacją |
| 6 | Ilustracje i assety | ilustrator | grafiki, często wektorowe, ze ścieżkami rysowania | |
| 7 | Animacja | animator | ręka rysuje w synchronizacji z VO | |
| 8 | Dźwięk i kompozycja | realizator dźwięku | muzyka, efekty, miks, eksport | |
| 9 | Poprawki | wszyscy | rundy akceptacji po skrypcie, storyboardzie, animatiku i wersji końcowej | |

Źródła: proces Sliced Bread Animation ([sbanimation.com](https://sbanimation.com/production-process-whiteboard-animation/):
skrypt → storyboard → VO → animatik „panels timed to the VO” → assety →
animacja „drawn up in sync with the VO” → kompozycja),
[Blue Carrot](https://bluecarrot.io/blog/everything-you-need-to-know-about-whiteboard-animation/)
(zespół: producent, scenarzysta, artysta, motion designer, lektor, realizator
dźwięku; **86–174 godzin pracy** i **do 5–6 tygodni** na film 1–3 min),
[DrawStory](https://www.drawstory.ai/blog/whiteboard-animation-guide)
(film 90 s w **2–3 tygodnie**, 150 słów/min),
[Hatch Studios](https://hatchstudios.com/what-is-a-whiteboard-animation-and-how-to-create-one-yourself/)
(głos musi być finalny przed animacją, zmiana skryptu po nagraniu to
najczęstsza przyczyna opóźnień), animatik i „scratch VO”
([Motif Motion](https://motifmotion.com/what-is-an-animatic),
[Moonb](https://www.moonb.io/blog/how-to-make-an-animatic)), liczba kadrów
storyboardu ([Vidico](https://vidico.com/explainer-video-production/explainer-video-storyboard/)).

### Jak powstały znane realizacje

* **RSA Animate** (Andrew Park, Cognitive Media, od 2010): ilustrator rysuje na
  tablicy lub papierze do gotowego wykładu, nagranie przyspiesza się w
  montażu tak, by obraz rozwijał się razem z mową
  ([Wikipedia: Whiteboard animation](https://en.wikipedia.org/wiki/Whiteboard_animation),
  [Andrew Park](https://en.wikipedia.org/wiki/Andrew_Park_(animator))).
  Pierwsze 14 filmów zebrało 46 mln wyświetleń w 2011 r.
* **MinutePhysics** (Henry Reich): markery i papier, „time-lapsed drawing”, a
  nie animacja. Autor szkicuje i przyspiesza nagranie rysowania pod
  przeczytany skrypt ([Wikipedia](https://en.wikipedia.org/wiki/MinutePhysics),
  [The Blaze](https://www.theblaze.com/news/2011/09/15/minute-physics-student-explains-tough-science-using-time-lapsed-drawing)).
* **Common Craft** („… in Plain English”, od 2007): animacja poklatkowa z
  tablicą i papierowymi wycinankami. Wszystkie rysunki robi jedna osoba i
  trafiają do biblioteki „Cut-outs”
  ([Wikipedia](https://en.wikipedia.org/wiki/Common_Craft),
  [Common Craft Cut-Outs](https://www.commoncraft.com/common-craft-cut-outs-now-available-your-projects)).
* **Khan Academy**: wirtualna czarna tablica, kolorowe pióro na tablecie
  graficznym, nagrywanie ekranu (SmoothDraw, Camtasia)
  ([Khan Academy Help](https://support.khanacademy.org/hc/en-us/articles/202483430-What-software-program-equipment-is-used-to-make-Khan-Academy-videos)).

### Jak to robią narzędzia

* **VideoScribe**: elementy kładzie się na płótnie w kolejności rysowania.
  Każdy ma własny czas animacji, kamera robi pan/zoom między elementami, a oś
  czasu służy do dopasowania do narracji
  ([VideoScribe](https://www.videoscribe.co/en/using-videoscribe/),
  [blog audio](https://blog.videoscribe.co/videoscribe-audio-features-ai-voiceover-music-editing)).
* **Doodly**: gotowe obrazki i ręka. Dla obrazów rastrowych ścieżkę rysowania
  wyznacza się punktami kontrolnymi, SVG rysuje się po swoich ścieżkach. Głos
  można nagrać w programie podczas odtwarzania podglądu animacji
  ([Voomly: draw paths](https://www.voomly.com/blog/importing-assets-and-creating-draw-paths-in-doodly),
  [voice-over](https://www.voomly.com/blog/working-with-doodlys-voice-over)).
* **Vyond**: zaleca nagranie audio **przed** budową scen, a w trakcie pracy
  głos TTS jako zastępczy, podmieniany na koniec. Postacie same synchronizują
  usta ([Vyond: voice-over](https://www.vyond.com/blog/add-voice-over-in-vyond/),
  [Vyond: storyboard](https://www.vyond.com/blog/making-an-explainer-video-storyboard/)).

**Wniosek dla nas:** etapy 6–7 (assety, animacja) silnik robi sam, w sekundach.
Storyboard i animatik możemy zastąpić **arkuszem klatek i szybkim renderem z
głosem**. Ludzki czas idzie na skrypt, akceptację wyglądu i obejrzenie
animatiku.

---

## 2. Jak pisać skrypt pod explainer

### Tempo mowy i budżet słów

* Angielskie poradniki: **~150 słów/min (2,5 słowa/s)**, czyli 60 s ≈ 140–160
  słów ([Breadnbeyond](https://breadnbeyond.com/articles/how-many-words-does-a-60-seconds-explainer-video-needs/),
  [DrawStory](https://www.drawstory.ai/blog/whiteboard-animation-guide)).
* Polski: w mowie potocznej średnio **10–12 głosek, czyli 4–5 sylab na
  sekundę** ([Wikipedia: tempo wypowiedzi](https://pl.wikipedia.org/wiki/Tempo_wypowiedzi)
  i [Michalik, „Tempo wypowiedzi jako kategoria badawcza”](https://rep.up.krakow.pl/xmlui/bitstream/handle/11716/11246/AF261--08--Tempo-wypowiedzi--Michalik.pdf)).
  Polskie słowa są dłuższe. Policzyłem zdania `say` z `spec-draft/*.json`
  (139 słów): **~2,1 sylaby i 5,4 znaku na słowo**. Przy 4–4,5 sylaby/s daje to
  **~1,9–2,1 słowa/s ≈ 115–130 słów/min**. Zgadza się to z polskimi głosami
  Azure, które serwis json2video opisuje jako **~127–128 słów/min**
  ([Agnieszka/Marek/Zofia](https://json2video.com/ai-voices/azure/voices/pl-pl-marekneural/)).
* **Korekta do SKALOWANIE.md §3:** przyjęte tam 2,5 słowa/s dla polskiego
  lektora jest optymistyczne. Do szacunków przed TTS lepiej brać ~2,1 słowa/s
  (albo ~14–15 znaków/s z interpunkcją). Po syntezie i tak liczy się
  rzeczywista długość audio.

| Długość filmu | Słowa (EN, 150/min) | Słowa (PL, ~125/min) |
| --- | --- | --- |
| 30 s | ~75 | ~60 |
| 60 s | ~150 | ~120–130 |
| 90 s | ~225 | ~180–190 |
| 2 min | ~300 | ~250 |

Zostaw zapas 10–15% na pauzy: ręka musi dokończyć rysunek, a widz go obejrzeć.

### Zdania, beaty, sceny

* **Jedna myśl = jeden obraz.** Skrypt dzieli się tam, gdzie kończy się jedna
  myśl, a zaczyna następna. Każdy taki beat to co najmniej jeden kadr
  storyboardu. Film 60–90 s ma zwykle 10–20 scen po kilka sekund
  ([Vidico](https://vidico.com/explainer-video-production/explainer-video-storyboard/)).
* Praktycznie (zgodnie z regułami 1, 2 i 9 w SKALOWANIE.md): beat = jedno
  zdanie **≤ 15 słów** (~5–7 s mowy po polsku) = 1–3 nowe elementy. Rozdział
  (jedna tablica, potem ścieranie) to 3–6 beatów, czyli 15–40 s.
* Pisz pod ucho: czytaj na głos i skracaj
  ([Vyond](https://www.vyond.com/blog/everything-you-need-make-a-video-in-vyond/)).
  Unikaj wtrąceń i nawiasów, zostaw jedną liczbę na zdanie. Skróty i liczby
  zapisuj tak, jak mają zabrzmieć („dwa tysiące”, „el-el-em”), bo TTS
  normalizuje je po swojemu.
* Mów do widza, nie o nim („zobacz”, „wyobraź sobie”). To zasada
  personalizacji Mayera (niżej).

### Tekst na ekranie a głos: zasady Mayera

| Zasada | Treść | Co z tego wynika dla silnika |
| --- | --- | --- |
| Redundancja | lepiej uczy grafika + narracja niż grafika + narracja + ten sam tekst na ekranie | **nie wypisuj zdania lektora na tablicy** |
| …wyjątek | krótkie słowo-klucz lub fraza **obok** odpowiedniego elementu grafiki poprawia zapamiętywanie (Mayer i Johnson 2008, d = 0,47 i 0,70) | etykiety 1–3 słowa przy węzłach są OK, a nawet pomagają |
| Sygnalizacja | strzałki, podkreślenia, wyróżnienia i akcent głosu kierują uwagę | `highlight`, `mark`, najazd kamery w chwili, gdy głos to akcentuje |
| Spójność (coherence) | zbędne ozdobniki, ciekawostki i muzyka w tle szkodzą | jedna myśl na kadr, muzyka cicho albo wcale |
| Ciągłość czasowa | słowo i obraz jednocześnie, nie po kolei | patrz §3 |
| Ciągłość przestrzenna | podpis przy obiekcie, nie w legendzie | `note` z `near` |
| Segmentacja | krótkie, wyraźnie oddzielone części | rozdziały + ścieranie tablicy |
| Wstępne przygotowanie | najpierw nazwy i cechy pojęć, potem mechanizm | pierwszy rozdział: „kto jest kim” |
| Modalność | złożony obraz objaśniaj głosem, nie tekstem | film z lektorem > film z samymi napisami |
| Personalizacja / głos | styl rozmowy, ludzki głos | poprawiony TTS wypada coraz lepiej, ale to wciąż ryzyko |

Źródła: [Devlin Peck: 12 zasad](https://www.devlinpeck.com/content/mayers-principles-of-multimedia-learning),
[UVic: coherence/signaling/redundancy/contiguity (PDF)](https://edtechuvic.ca/wp-content/uploads/sites/11/2022/09/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles.pdf),
wyjątek od redundancji: Mayer i Johnson 2008, za [Toh i in., ASCILITE 2010](https://ascilite.org/conferences/sydney10/Ascilite%20conference%20proceedings%202010/Toh-full.pdf).

### Hook, struktura, długość

* **Pierwsze sekundy decydują.** Typowa struktura reklamowego explainera to
  hook (do ~8–10 s) → problem → rozwiązanie/mechanizm → dowód → wezwanie do
  działania ([Biteable](https://biteable.com/blog/explainer-video-script-template/),
  [Leadde](https://leadde.ai/blog/explainer-video-script-examples)). W wersji
  edukacyjnej zamiast CTA dajemy **puentę lub podsumowanie**. Hook to pytanie
  albo paradoks, który obraz od razu zaczyna rysować. Nie zaczynamy od tytułu
  i 2 s ciszy.
* **Długość a uwaga.** Guo, Kim i Rubin (2014; 6,9 mln sesji edX): krótsze
  filmy angażują dużo bardziej, zaangażowanie wyraźnie spada powyżej ~6 min,
  a rysunki w stylu Khan Academy angażują bardziej niż slajdy
  ([ACM L@S 2014](https://pure.kaist.ac.kr/en/publications/how-video-production-affects-student-engagement-an-empirical-stud/),
  [omówienie SUNY](https://oscqr.suny.edu/how-long-should-instructional-videos-be/)).
  Wistia (2026, >13 mln filmów): filmy < 1 min mają średnio 52% zaangażowania,
  edukacyjne 1–5 min trzymają > 50%, po 5 min zaangażowanie spada
  ([Wistia](https://wistia.com/learn/marketing/optimal-video-length)).
* **Rekomendacja:** 60–150 s na film (jak w SKALOWANIE.md), maksymalnie 3–4
  min. Dłuższy temat lepiej podzielić na serię.

---

## 3. Synchronizacja obrazu z głosem

### Wyprzedzać czy podążać?

* Zasada ciągłości czasowej Mayera: słowo i odpowiadający mu obraz mają się
  pojawiać **jednocześnie**, nie po kolei (źródła jak wyżej).
* Praktyka animatorów: kluczowe ruchy ustawia się na początkach sylab lub
  słów. Gest można „przesunąć o kilka klatek wcześniej”, bo widz odczytuje
  intencję, zanim rozłoży ją na szczegóły
  ([Sunstrike Studios, timing](https://sunstrikestudios.com/en/blog/timing_in_animation/)).
  W explainerze to głos wyznacza okno czasowe, w którym obraz ma „wylądować”
  ([Educational Voice](https://educationalvoice.co.uk/animated-explainer-videos-2/)).
* **Reguła dla nas** (wniosek z powyższego, nie liczba z badań):
  * rysowanie elementu zaczyna się **0,2–0,5 s przed** słowem, które go
    nazywa. Kiedy widz słyszy „model”, widzi już, że coś powstaje w tym
    miejscu;
  * najważniejsza kreska (np. kontur węzła albo grot strzałki) kończy się
    najpóźniej **~1 s po** słowie. Rysunek nie może zostawać za głosem o całe
    zdanie, bo widz słucha o czymś, czego jeszcze nie ma;
  * pisany na tablicy podpis-klucz zaczyna się razem ze słowem (pismo w
    silniku ma ok. 14 znaków/s, więc 10-literowe słowo zajmuje ~0,7 s);
  * po puencie lub dłuższym rysunku: **0,5–1 s ciszy** („oddech”), a
    przejście do nowego rozdziału (ścieranie) w ciszy albo pod jednym krótkim
    zdaniem.

### Skąd brać znaczniki czasu

1. **Synteza per beat (najprostsze, polecane na start).** Każde zdanie `say`
   to osobne wywołanie TTS i osobny plik. Czas beatu = `max(długość audio,
   czas rysowania) + pauza`. Pliki skleja się ffmpeg-iem z ciszą tam, gdzie
   rysunek trwa dłużej. Nie trzeba żadnego wyrównywania. Przy zmianie jednego
   zdania syntezujemy tylko jeden plik.
2. **Kotwice w zdaniu.** Gdy element ma wejść na konkretne słowo w środku
   zdania (np. „…trafia do `[[llm]]`modelu”), potrzebujemy czasu tego słowa:
   * TTS z bookmarkiem lub `<mark>` w miejscu kotwicy (Azure, Polly, Google
     WaveNet/Standard, patrz §4);
   * albo znaczniki słów lub znaków (Azure WordBoundary, Polly word speech
     marks, ElevenLabs) i dopasowanie kotwicy po pozycji w tekście.
3. **Lektor nagrany przez człowieka: wymuszone wyrównanie (forced
   alignment).** Znamy tekst i nagranie, szukamy czasów:
   * **WhisperX**: rozpoznawanie Whisper + wyrównanie słów modelem wav2vec2.
     W kodzie (`whisperx/alignment.py`, `DEFAULT_ALIGN_MODELS_HF`) jest
     domyślny model dla `pl`: `jonatasgrosman/wav2vec2-large-xlsr-53-polish`
     ([GitHub](https://github.com/m-bain/whisperx)). Daje czasy słów. Wyrównuje
     jednak swoją transkrypcję, nie nasz skrypt, więc słowa trzeba
     dopasować do tekstu (prosty diff).
   * **aeneas**: wyrównuje **nasz** tekst (fragmenty: zdania lub frazy) do
     audio przez syntezę eSpeak + MFCC/DTW. Polski (`pol`) jest na liście
     języków, a wynik zapisuje m.in. do SRT/VTT/JSON. README zaznacza, że
     narzędzie **nie było projektowane do wyrównania słów**. Słowa da się
     wyrównać (tryb `--presets-word`, multilevel), ale z gorszą jakością
     ([GitHub](https://github.com/readbeyond/aeneas),
     [języki](https://www.readbeyond.it/aeneas/docs/language.html)).
   * Zalecenie: aeneas na poziomie beatów (zdań), WhisperX gdy potrzebne są
     kotwice w zdaniu.

### Napisy (SRT/VTT)

* Generujemy je z tych samych czasów co beaty. **WebVTT** na stronę
  (`<track>`), **SRT** na YouTube i media społecznościowe.
* Polskie reguły Netflix: **≤ 42 znaki w linii, ≤ 2 linie, ≤ 17 znaków/s**
  dla dorosłych (13 zn/s dla dzieci)
  ([Netflix Polish Timed Text Style Guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/216787928-Polish-Timed-Text-Style-Guide)).
  Zgadza się to z regułą 16 w SKALOWANIE.md.
* Mayer (redundancja): napisy domyślnie **jako ścieżka do włączenia**, nie
  wypalone w obrazie. Wyjątek to wersje na sociale z autoodtwarzaniem bez
  dźwięku. Wtedy wypalamy je w pasie y 620–700 (SKALOWANIE §3).

---

## 4. Głos, muzyka, efekty

### Lektor czy TTS

| | Lektor (człowiek) | TTS |
| --- | --- | --- |
| Jakość, emocja | najlepsza (zasada głosu Mayera) | dobra, nierówna na nazwach własnych i skrótach |
| Zmiana skryptu | ponowne nagranie (sesja, koszt, czas) | sekundy; per beat tylko zmienione zdanie |
| Znaczniki czasu | trzeba wyrównać (WhisperX/aeneas) | często od razu z API |
| Spójność w serii | zależy od dostępności lektora | identyczny głos zawsze |
| Wymogi | umowa i prawa do nagrania | warunki dostawcy, np. OpenAI **wymaga** jasnej informacji dla odbiorcy, że głos jest wygenerowany przez AI ([docs](https://developers.openai.com/api/docs/guides/text-to-speech)) |

Praktyka z Vyond pasuje do nas: **TTS w trakcie pracy, lektor (opcjonalnie)
na końcu**. Animatik z TTS ustala tempo. Lektor czyta zaakceptowany tekst,
a czasy beatów bierzemy z wyrównania.

### TTS z polskim: znaczniki czasu (sprawdzone w dokumentacji)

| Dostawca | Polskie głosy | Znaczniki czasu | Granulacja / uwagi |
| --- | --- | --- | --- |
| **Azure AI Speech** | `pl-PL-AgnieszkaNeural`, `MarekNeural`, `ZofiaNeural` ([lista](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)) | tak: zdarzenie `WordBoundary` (typ Word/Punctuation/Sentence, `AudioOffset`, `Duration`, `TextOffset`) i `BookmarkReached` dla SSML `<bookmark>` ([docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis)) | słowa + własne kotwice; zgłaszano błędne offsety dla pt-PT ([Q&A](https://learn.microsoft.com/en-us/answers/questions/5552260/word-boundary-events-return-zero-audiooffset-for-p)), więc przetestować pl-PL |
| **Amazon Polly** | Ewa, Maja, Jacek, Jan (standard), **Ola** (neural) ([lista](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html), [Ola](https://aws.amazon.com/about-aws/whats-new/2022/11/amazon-polly-neural-tts-support-polish-arabic/)) | tak: speech marks `sentence`, `word`, `viseme`, `ssml` (`<mark>`) dla silników neural, long-form i standard ([docs](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html)) | metadane to osobne wywołanie (zwraca JSON zamiast audio); silnik generative nie jest wymieniony |
| **ElevenLabs** | polski w Multilingual v2 ([modele](https://elevenlabs.io/docs/overview/models)) | tak: endpoint `/with-timestamps` (także strumieniowy) zwraca `alignment` i `normalized_alignment` ([docs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)) | **na poziomie znaków**; słowa składamy sami |
| **Google Cloud TTS** | `pl-PL` Standard, WaveNet, **Chirp3-HD** (30 głosów) ([lista](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)) | tylko dla SSML `<mark>` przez `enableTimePointing=SSML_MARK` w API v1beta1 ([SSML](https://docs.cloud.google.com/text-to-speech/docs/ssml)) | lista obsługiwanych tagów SSML Chirp 3 HD **nie zawiera `<mark>`** ([Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)), więc dla kotwic WaveNet/Standard albo synteza per beat |
| **OpenAI TTS** | polski na liście języków (głosy „zoptymalizowane pod angielski”) ([docs](https://developers.openai.com/api/docs/guides/text-to-speech)) | brak w dokumentacji | per beat + ewentualnie WhisperX; wymagana informacja o głosie AI |

Ceny celowo pomijam, bo zmieniają się często. Przy wyborze dostawcy sprawdzić
aktualne warunki i licencję na użycie komercyjne.

### Muzyka i efekty

* **Szum ołówka, markera, kredy** to najtańszy sposób na „żywy” film. Silnik
  wie, kiedy grafit dotyka papieru (`HandTrack`: kreska vs przelot z
  podniesionym ołówkiem). Ścieżkę efektów można więc **wygenerować z osi
  czasu**: pętla 3–5 próbek drapania z losowym przesunięciem, głośność zależna
  od prędkości ręki, cisza przy `lift`. Kreda i marker brzmią inaczej, więc
  próbki są częścią motywu.
* Licencje:
  [Freesound](https://freesound.org/help/faq/): **CC0** (bez warunków),
  **CC BY** (wymagane przypisanie, komercyjnie OK), **CC BY-NC** (bez użycia
  komercyjnego, więc dla nas odpada).
  [Pixabay](https://pixabay.com/sound-effects/): jedna licencja treści, bez
  przypisania, użycie komercyjne OK. Nie wolno odsprzedawać ani
  redystrybuować samych plików, więc nie wolno ich też wkładać do repo jako
  „biblioteki”. Lepiej trzymać listę źródeł w manifeście albo nagrać własne
  próbki (5 minut z mikrofonem i kartką).
* Muzyka: zasada spójności Mayera mówi, że muzyka w tle może szkodzić
  uczeniu. W filmach edukacyjnych dajemy ją cicho pod głosem albo tylko w
  intro i outro.

---

## 5. Style wizualne możliwe w tym silniku

Silnik ma już wszystko, czego te style wymagają u podstaw: kreskę z
naciskiem i drganiem, kredkę z ziarnem, pismo odręczne z dowolnego fontu,
rękę z narzędziem, kamerę i ścieranie. Styl to w praktyce **motyw**: tło i
faktura, paleta, fonty, parametry pędzli, narzędzie w ręce, tryb mieszania
zakreślacza i dźwięk.

**Uwaga o fontach:** pismo powstaje ze szkieletu glifów fontu, więc font musi
mieć polskie znaki. Sprawdziłem pliki z Google Fonts (cmap):
**ąćęłńóśźż mają** Caveat, Caveat Brush, Kalam, Patrick Hand, Indie Flower,
Gloria Hallelujah, Shadows Into Light, Amatic SC, Architects Daughter, Mynerve,
Playpen Sans, Covered By Your Grace, Just Another Hand, Special Elite, Courier
Prime, Space Mono. **Nie mają** (brak ą ę ś ź ż ń ć): Fredericka the Great,
Klee One, Sniglet. Bez rozszerzonej łaciny w ogóle są Permanent Marker, Rock
Salt, Cabin Sketch, Gochi Hand, Schoolbell. Sama obecność podzbioru
`latin-ext` nie wystarcza (Fredericka go ma, a ogonków nie).

| Styl | Tło / faktura | Narzędzie i kreska | Paleta | Typografia (z PL) | Przykłady | Czego brakuje w silniku |
| --- | --- | --- | --- | --- | --- | --- |
| **Tablica kredowa** | ciemna zieleń lub grafit (`#24312b`, `#263238`), smugi po gąbce, pył | kreda: ziarnista, z przerwami, nierówne krycie, zaokrąglone końce, brak cienia | biała kreda + pastelowe kredy (żółta, róż, błękit) | Shadows Into Light, Caveat Brush, Amatic SC (tytuły) | szkolna tablica; cyfrowa czarna tablica Khan Academy | tło + tekstura pyłu; zakreślacz `screen` zamiast `multiply`; kredka jako „kreda płaska”; ręka z kredą; **ścieranie zostawiające smugę (ghosting)** |
| **Whiteboard + marker** | biel, lekki połysk, bez faktury | marker: stała grubość, okrągłe końce, bez zwężeń, lekkie nasiąkanie | czarny + 1–2 akcenty (czerwony, niebieski) | Patrick Hand, Kalam, Gloria Hallelujah | RSA Animate, MinutePhysics (marker na papierze) | `taper: 0`, mniej drgań; ręka z markerem (jest w PLAN.md, etap 3) |
| **Notatnik w kratkę / linie** | złamana biel, kratka 5 mm w błękicie, czerwony margines, czasem dziurki | długopis: cienka, równa kreska, lekko zmienne krycie; ołówek do szkiców; zakreślacze | niebieski długopis + grafit + 1–2 zakreślacze | Indie Flower, Kalam, Mynerve | Vi Hart „Doodling in Math Class” ([Wikipedia](https://en.wikipedia.org/wiki/Vi_Hart)) | generator kratki; **przyciąganie linii pisma do linii zeszytu** w layoucie; „doodle” na marginesach |
| **Blueprint / kalka techniczna** | błękit pruski (`#1d4e89`) z jaśniejszą siatką, lekkie przetarcia | cienka biała kreska „od linijki”: małe drganie, linie konstrukcyjne wystające za narożniki, wymiarowanie, kreskowanie | biel + jasny cyjan; akcent: żółty lub pomarańczowy | Architects Daughter, Courier Prime / Space Mono (opisy) | estetyka blueprint w tutorialach ([captions.ai](https://captions.ai/styles/blueprint)) | pędzel „linijka” (prosto + przestrzał narożników); komponent `dimension`; kreskowanie zamiast kredki |
| **Wycinanka papierowa** | biel albo papier pakowy | elementy to „kartki” z cieniem; wjeżdżają z krawędzi pchnięte ręką, a nie są rysowane; poklatkowo ~12 kl./s | nasycone płaskie kolory, czarny kontur markera | Patrick Hand, Just Another Hand | Common Craft „… in Plain English” | element-karta (`fill` + cień + krawędź), ruch wsuwania i `pop`, tryb „stop-motion” (`fps`), ręka bez narzędzia |
| **Ink on cream (minimal)** | krem z ziarnem | pióro z naciskiem, kredka | atrament + 2–3 stonowane kolory | Caveat | stentor.studio, xkcd | **to obecny styl silnika**, więc nie nadaje się na „zupełnie inny” |
| **Sketchnote kolorowy** | biel lub krem | czarny cienkopis na kontury, szary marker na cienie pod kontenerami, 1 kolor akcentu | czerń + szarość + 1 akcent + zakreślacz | Amatic SC lub Oswald (banery) + Kalam (tekst) | M. Rohde, „The Sketchnote Handbook” ([Goodreads](https://www.goodreads.com/book/show/15858089-the-sketchnote-handbook)) | szary cień przesunięty pod kształtem; banery i wstęgi; numerowane punkty; mieszane kroje |

**Co wybrać na pierwszy wspólny film „zupełnie inny”:**

1. **Tablica kredowa** (rekomendacja). Daje odwrócony kontrast, więc różnica
   jest widoczna od pierwszej klatki. Ziarno kredki już przypomina kredę,
   styl jest zapowiedziany w PLAN.md (etap 3), a wymaga głównie motywu (tło,
   blend, pędzel, narzędzie) i efektownego ścierania ze smugą. Ryzyko: przy
   ciemnym tle trzeba sprawdzić kontrast pastelowych kolorów i czytelność
   cienkich kresek po kompresji wideo.
2. **Blueprint.** Najbardziej „inżynierski”, dobry dla tematów technicznych.
   Wymaga nowego pędzla (precyzja zamiast drgania) i wymiarowania, czyli
   więcej pracy, ale też najwięcej się nauczymy o parametryzacji kreski.
3. **Notatnik w kratkę.** Najmniej pracy (tło + kolor długopisu), ale jest
   wizualnie najbliżej obecnego stylu.

---

## 6. Proponowany przepływ pracy dla tego projektu

Nawiązuje do architektury z [`SKALOWANIE.md`](SKALOWANIE.md) §2 (reżyser →
outline → spec → kompilator → render → linter). Dokłada **głos** i dwa punkty
akceptacji, których tam brakuje: wygląd i animatik.

| Krok | Kto | Wejście → wyjście | Akceptacja |
| --- | --- | --- | --- |
| 0. Zamówienie | **człowiek** | temat **albo** gotowy skrypt; odbiorca; docelowa długość; styl z §5; głos (TTS/lektor) | |
| 1. Skrypt na beaty | Opus (reżyser) | skrypt → tabela: beat, zdanie VO (≤ 15 słów), co widać, layout rozdziału, szacowany czas (2,1 słowa/s). Gdy człowiek dał skrypt, model **tylko redaguje** (dzieli, skraca, zaznacza zdania > 15 słów, liczby do zapisania słownie) i nie zmienia treści bez pytania | **A: skrypt** (najtańsza poprawka; łapie błędy merytoryczne) |
| 2. Klatka-wzór stylu | model + silnik | motyw (paleta, fonty, tło, pędzel) → 1–2 nieruchome klatki z typowym kadrem | **B: wygląd** (raz na styl, potem motyw jest stały) |
| 3. Głos | TTS (lub lektor) | zdania beatów → pliki audio per beat (+ znaczniki kotwic); dla lektora: nagranie → aeneas/WhisperX | |
| 4. Spec i kompilacja | wykonawca + kompilator | outline + **długości audio** → spec → Storyboard; reguła L3 z SKALOWANIE liczy czasy z audio, a nie ze słów | linter L0–L3 automatycznie |
| 5. Animatik | silnik | szybki render (niska rozdzielczość lub 12 kl./s) + audio + arkusz klatek końcowych beatów | **C: animatik** (tempo, zgodność obraz–głos, czytelność) |
| 6. Finał | silnik + ffmpeg | render 1080p, zmiks VO + szum narzędzia (+ muzyka), plik SRT/VTT | **D: wersja końcowa** (szybki przegląd) |

Zasady:

* Poprawka po kroku C, która zmienia zdanie, oznacza ponowną syntezę **tylko
  tego beatu** i przeliczenie czasów. Poprawka obrazu nie rusza audio. Tak
  rozdzielony pipeline jest głównym zyskiem nad studiem, gdzie zmiana tekstu
  po nagraniu jest najdroższa.
* Lektor-człowiek nagrywa dopiero tekst zaakceptowany w C (na animatiku z
  TTS). Wtedy zmiany kosztują jedno nagranie, a nie kilka.
* Przy produkcji seryjnej punkty B i A stają się rzadkie (motyw stały,
  outline czytany w minutę), a C i D przechodzą w przegląd losowy (jak w
  SKALOWANIE §6).

**Czego silnik potrzebuje do pierwszego filmu z głosem** (zakres do ustalenia,
nie plan): (1) motyw jako jeden obiekt (paleta, `paper()` z teksturą, fonty,
blend zakreślacza, narzędzie w ręce, próbki dźwięku); (2) kroki Storyboardu
z czasem narzuconym z zewnątrz (`dur` beatu = długość audio) i kotwice w
zdaniu; (3) ścieżka audio w `Player` i w `tools/render.mjs` (mux ffmpeg);
(4) eksport SRT/VTT z czasów beatów; (5) generator ścieżki „szumu narzędzia”
z osi ręki. Do decyzji właściciela przed startem: **dostawca TTS i klucz API**
(albo nagranie własnego głosu) oraz **styl** (rekomendacja: tablica kredowa).
