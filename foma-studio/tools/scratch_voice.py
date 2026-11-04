#!/usr/bin/env python3
"""Черновой голос для аниматиков: dialogue.csv -> WAV на каждую реплику.

ВНИМАНИЕ: edge-tts — неофициальный доступ к синтезу Microsoft Edge.
Использовать ТОЛЬКО для черновиков/аниматиков, не в опубликованных роликах.

Usage: python3 tools/scratch_voice.py <dialogue.csv> <out_dir> [--voice ru-RU-DmitryNeural]
"""
import argparse
import asyncio
import csv
import os
import ssl
import subprocess
import sys
from pathlib import Path

# В облачном контейнере исходящий HTTPS идёт через прокси со своим CA.
CA = os.environ.get("SSL_CERT_FILE") or ("/root/.ccr/ca-bundle.crt" if Path("/root/.ccr/ca-bundle.crt").exists() else None)
if CA:
    import certifi
    certifi.where = lambda: CA
    _orig = ssl.create_default_context
    ssl.create_default_context = lambda *a, **k: _orig(cafile=CA)

import edge_tts  # noqa: E402

# «Голос из-под маски»: убираем низ, лёгкая коробочность ~900 Гц, срез верха,
# очень короткое отражение (внутренняя поверхность маски), мягкая компрессия.
MASK = "highpass=f=90,equalizer=f=900:t=q:w=1.2:g=4,lowpass=f=6500,aecho=0.8:0.5:18:0.18,acompressor=threshold=-20dB:ratio=3:attack=5:release=80"
FILTERS = {
    "none": "anull",
    "mask": MASK,
    # шёпот/страх: ближе, тише, меньше середины
    "mask_whisper": MASK + ",equalizer=f=3000:t=q:w=1:g=3,volume=0.8",
    # «двойник из темноты»: ниже на полтона, длинный хвост, тёмный
    "dark_double": "asetrate=48000*0.94,aresample=48000,lowpass=f=3500,highpass=f=120,"
                   "aecho=0.8:0.7:60|140|260:0.35|0.25|0.15,volume=0.9",
}


async def synth(text, voice, rate, pitch, path, tries=4):
    for i in range(tries):  # сервис иногда отвечает пустым потоком — повторяем
        try:
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(path))
            return
        except edge_tts.exceptions.NoAudioReceived:
            if i == tries - 1:
                raise
            await asyncio.sleep(2 ** i)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dialogue_csv")
    ap.add_argument("out_dir")
    ap.add_argument("--voice", default="ru-RU-DmitryNeural")
    a = ap.parse_args()
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    with open(a.dialogue_csv, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        raw = out / f"{r['line_id']}_raw.mp3"
        wav = out / f"{r['line_id']}.wav"
        asyncio.run(synth(r["text"], a.voice, r.get("rate") or "+0%", r.get("pitch") or "+0Hz", raw))
        flt = FILTERS.get(r.get("processing") or "none", "anull")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af",
                        flt + ",loudnorm=I=-18:TP=-2:LRA=7", "-ar", "48000", "-ac", "1", str(wav)], check=True)
        raw.unlink()
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                             capture_output=True, text=True).stdout.strip()
        print(f"{r['line_id']}\t{float(dur):.2f}s\t{r['text']}")


if __name__ == "__main__":
    sys.exit(main())
