#!/usr/bin/env python3
"""Piper TTS (движок MIT, голоса ru_RU-denis / ru_RU-dmitri — датасеты CC0).
Эмоции Piper не понимает; эмулируем темпом (length_scale) и вариативностью (noise_scale).
ru_RU-ruslan НЕ использовать: датасет CC BY-NC-SA (некоммерческий).

Usage: python engine_piper.py <test_script.yaml> <out_dir> --model ru_RU-denis-medium.onnx
"""
import argparse
import subprocess
import sys
from pathlib import Path

import yaml

# темп/вариативность под эмоцию сегмента
PROSODY = {
    "S1_calm": (1.10, 0.667, 0.8),
    "S2_joke": (1.00, 0.75, 0.9),
    "S3_fear": (0.90, 0.80, 0.9),
    "S4_whisper": (1.25, 0.50, 0.6),
    "S5_panic": (0.75, 0.85, 1.0),
    "REF": (1.0, 0.667, 0.8),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--model", required=True)
    a = ap.parse_args()
    cfg = yaml.safe_load(open(a.script, encoding="utf-8"))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    piper = str(Path(sys.executable).parent / "piper")
    for s in cfg["segments"]:
        ls, ns, nw = PROSODY[s["id"]]
        subprocess.run([piper, "-m", a.model, "--length-scale", str(ls), "--noise-scale", str(ns),
                        "--noise-w-scale", str(nw), "-f", str(out / f"{s['id']}.wav")],
                       input=s["text"].encode(), check=True, capture_output=True)
        print(s["id"], "ok")


if __name__ == "__main__":
    main()
