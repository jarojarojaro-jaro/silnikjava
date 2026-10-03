#!/usr/bin/env python3
"""
Lektor dla silnika: skrypt/nagranie -> klipy audio per beat + znaczniki czasu słów (voice.json).

Trzy drogi, jeden wynik:

  tts        skrypt -> synteza mowy (Piper, lokalnie, bez klucza API) -> znaczniki słów
  align      Twoje nagranie + skrypt -> znaczniki słów dopasowane do tekstu skryptu
  transcribe samo nagranie -> transkrypcja; beaty = zdania

Znaczniki słów zawsze liczymy tak samo: rozpoznawanie mowy (faster-whisper,
word_timestamps) i dopasowanie do słów skryptu. Dzięki temu dowolny głos —
lokalny TTS, zewnętrzne API, nagranie lektora — daje identyczny voice.json.

  python tools/voice/voice.py tts examples/voice/agent/script.md --out examples/voice/agent
  python tools/voice/voice.py align nagranie.wav script.md --out out/voice
  python tools/voice/voice.py transcribe nagranie.wav --out out/voice

Format skryptu (script.md): akapity oddzielone pustą linią = beaty (jedno zdanie
lektora = jeden obraz). Linie zaczynające się od '#' to komentarze/tytuł.
Nawiasy [obraz: ...] to notatki dla rysunku — nie są czytane. Pierwszy akapit
może zawierać nagłówki KLUCZ: wartość (np. GŁOS: pl_PL-darkman-medium).

Wymagania: pip install -r tools/voice/requirements.txt, ffmpeg.
"""

import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

VOICES_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
CACHE = Path(os.environ.get("SILNIK_VOICES", Path.home() / ".cache" / "silnik" / "voices"))


# ------------------------------------------------------------------ skrypt

def parse_script(text):
    meta, beats = {}, []
    blocks = re.split(r"\n\s*\n", text.strip())
    first = True
    for block in blocks:
        lines = [l for l in block.splitlines() if l.strip() and not l.strip().startswith("#")]
        if not lines:
            continue
        is_meta = first and all(re.match(r"^[A-ZĄĆĘŁŃÓŚŹŻ ]{3,}:\s", l) for l in lines)
        first = False
        if is_meta:
            for l in lines:
                k, v = l.split(":", 1)
                meta[k.strip().lower()] = v.strip()
            continue
        raw = " ".join(l.strip() for l in lines)
        notes = re.findall(r"\[([^\]]*)\]", raw)
        say = re.sub(r"\[[^\]]*\]", "", raw)
        say = re.sub(r"^\s*\d+[.)]\s*", "", say)
        say = re.sub(r"\s+", " ", say).strip()
        if say:
            beats.append({"id": f"b{len(beats) + 1}", "text": say, "notes": notes})
    return meta, beats


def norm(word):
    w = unicodedata.normalize("NFC", word.lower())
    return re.sub(r"[^\w]", "", w)


def tokens(text):
    return [t for t in re.findall(r"\S+", text) if norm(t)]


# ------------------------------------------------------------------ narzędzia

def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.exit(f"błąd: {' '.join(map(str, cmd))}\n{r.stderr[-2000:]}")
    return r.stdout


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


def encode(src, dst, start=None, end=None):
    """WAV/dowolne -> Ogg Opus (mały plik, gra w przeglądarce), opcjonalnie wycinek."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    if start is not None:
        cmd += ["-ss", f"{start:.3f}"]
    if end is not None:
        cmd += ["-to", f"{end:.3f}"]
    cmd += ["-i", str(src), "-ac", "1", "-c:a", "libopus", "-b:a", "48k", str(dst)]
    run(cmd)


def voice_model(name):
    """Pobiera głos Piper (np. pl_PL-darkman-medium) do cache, jeśli go nie ma."""
    CACHE.mkdir(parents=True, exist_ok=True)
    onnx = CACHE / f"{name}.onnx"
    if not onnx.exists():
        lang, speaker, quality = name.split("-")
        base = f"{VOICES_URL}/{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}"
        for ext in (".onnx", ".onnx.json"):
            print(f"  pobieram {name}{ext} …", file=sys.stderr)
            urllib.request.urlretrieve(base + ext, CACHE / f"{name}{ext}")
    return onnx


_asr = None


def asr_model(size):
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel
        _asr = WhisperModel(size, device="cpu", compute_type="int8")
    return _asr


def transcribe(path, size, prompt=None):
    """Słowa z czasami [{w, s, e}] (sekundy od początku pliku)."""
    segs, _ = asr_model(size).transcribe(str(path), language="pl", word_timestamps=True, initial_prompt=prompt, vad_filter=False)
    return [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words if w.word.strip()]


def align(script_words, heard):
    """
    Dopasowanie słów skryptu do usłyszanych (z czasami). Zwraca czasy dla KAŻDEGO
    słowa skryptu: dopasowane bierzemy wprost, resztę interpolujemy między sąsiadami.
    """
    a = [norm(w) for w in script_words]
    b = [norm(h["w"]) for h in heard]
    times = [None] * len(a)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k]["s"], heard[j1 + k]["e"])
        elif op == "replace" and j2 > j1:
            # inne brzmienie (liczby, skróty): rozkładamy fragment proporcjonalnie
            s, e = heard[j1]["s"], heard[j2 - 1]["e"]
            n = i2 - i1
            if e - s < 0.08 * n:
                continue  # zdegenerowane czasy — lepiej interpolować między sąsiadami
            for k in range(n):
                times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    matched = sum(1 for t in times if t)
    # interpolacja brakujących
    for i in range(len(times)):
        if times[i] is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), heard[0]["s"] if heard else 0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev + 0.3)
            times[i] = (prev, max(prev, nxt))
    return [{"w": w, "s": round(t[0], 3), "e": round(t[1], 3)} for w, t in zip(script_words, times)], matched / max(1, len(a))


# ------------------------------------------------------------------ tryby

def cmd_tts(args):
    meta, beats = parse_script(Path(args.script).read_text(encoding="utf-8"))
    name = args.voice or meta.get("głos") or "pl_PL-darkman-medium"
    model = voice_model(name)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    result = []
    with tempfile.TemporaryDirectory() as tmp:
        for b in beats:
            wav = Path(tmp) / f"{b['id']}.wav"
            run([sys.executable, "-m", "piper", "-m", str(model), "-f", str(wav), "--length-scale", str(args.tempo)], input=b["text"])
            words = tokens(b["text"])
            heard = transcribe(wav, args.asr, prompt=b["text"])
            timed, score = align(words, heard)
            if score < 0.6:
                # podpowiedź potrafi zamienić mowę na symbole ("a kwadrat" -> "A²"); bez niej
                # rozpoznanie jest dosłowne — bierzemy lepsze dopasowanie
                t2, s2 = align(words, transcribe(wav, args.asr))
                if s2 > score:
                    timed, score = t2, s2
            dst = out / f"{b['id']}.ogg"
            encode(wav, dst)
            result.append({**b, "audio": dst.name, "duration": round(duration(wav), 3), "words": timed, "match": round(score, 2)})
            print(f"  {b['id']}: {result[-1]['duration']:.2f} s, dopasowanie słów {score:.0%} — {b['text'][:60]}", file=sys.stderr)
    write(out, {"source": "tts", "voice": name, "meta": meta, "beats": result})


def cmd_align(args):
    meta, beats = parse_script(Path(args.script).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    full = " ".join(b["text"] for b in beats)
    heard = transcribe(args.audio, args.asr, prompt=full[:800])
    all_words = [w for b in beats for w in tokens(b["text"])]
    timed, score = align(all_words, heard)
    total = duration(args.audio)
    # granice beatów: w połowie ciszy między ostatnim słowem beatu a pierwszym następnego
    result, k = [], 0
    spans = []
    for b in beats:
        n = len(tokens(b["text"]))
        spans.append((k, k + n))
        k += n
    for i, (b, (i1, i2)) in enumerate(zip(beats, spans)):
        ws = timed[i1:i2]
        start = 0.0 if i == 0 else (timed[spans[i - 1][1] - 1]["e"] + ws[0]["s"]) / 2
        end = total if i == len(beats) - 1 else (ws[-1]["e"] + timed[spans[i + 1][0]]["s"]) / 2
        dst = out / f"{b['id']}.ogg"
        encode(args.audio, dst, start, end)
        rel = [{"w": w["w"], "s": round(w["s"] - start, 3), "e": round(w["e"] - start, 3)} for w in ws]
        result.append({**b, "audio": dst.name, "duration": round(end - start, 3), "words": rel})
    print(f"  dopasowanie słów skryptu do nagrania: {score:.0%}", file=sys.stderr)
    write(out, {"source": "recording", "file": Path(args.audio).name, "meta": meta, "match": round(score, 2), "beats": result})


def cmd_transcribe(args):
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    heard = transcribe(args.audio, args.asr)
    # beaty = zdania (koniec na . ! ?)
    script, cur = [], []
    for h in heard:
        cur.append(h["w"])
        if re.search(r"[.!?…]$", h["w"]):
            script.append(" ".join(cur))
            cur = []
    if cur:
        script.append(" ".join(cur))
    md = out / "script.md"
    md.write_text("\n\n".join(script) + "\n", encoding="utf-8")
    print(f"  transkrypcja zapisana do {md} — popraw literówki i uruchom: align {args.audio} {md}", file=sys.stderr)
    args.script = str(md)
    cmd_align(args)


def write(out, data):
    path = Path(out) / "voice.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(b["duration"] for b in data["beats"])
    print(f"zapisano {path}: {len(data['beats'])} beatów, {total:.1f} s mowy", file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("tts", help="skrypt -> głos (Piper) + znaczniki słów")
    t.add_argument("script")
    t.add_argument("--voice", help="głos Piper, np. pl_PL-darkman-medium, pl_PL-gosia-medium, pl_PL-mc_speech-medium")
    t.add_argument("--tempo", type=float, default=1.0, help="length_scale Piper: >1 wolniej, <1 szybciej")
    a = sub.add_parser("align", help="nagranie + skrypt -> klipy per beat + znaczniki słów")
    a.add_argument("audio")
    a.add_argument("script")
    r = sub.add_parser("transcribe", help="samo nagranie -> transkrypcja (beaty = zdania) + znaczniki")
    r.add_argument("audio")
    for s in (t, a, r):
        s.add_argument("--out", required=True)
        s.add_argument("--asr", default="small", help="model faster-whisper: tiny/base/small/medium/large-v3")
    args = p.parse_args()
    {"tts": cmd_tts, "align": cmd_align, "transcribe": cmd_transcribe}[args.cmd](args)


if __name__ == "__main__":
    main()
