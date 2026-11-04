#!/usr/bin/env python3
"""Qwen3-TTS (Apache-2.0): голос Фомы.

Режимы:
  design  — VoiceDesign: голос по текстовому описанию (+ эмоция в instruct), каждая реплика заново.
            Используется для создания ЭТАЛОНА (REF) — один раз, по фиксированному seed.
  clone   — Base: клонирование из эталона REF (voice_clone_prompt). Это production-режим:
            голос одинаковый во всех сериях, потому что эталон — файл в репозитории.

Usage:
  python engine_qwen.py design-ref  <test_script.yaml> <out_dir> --seed 1234
  python engine_qwen.py design      <test_script.yaml> <out_dir> --seed 1234
  python engine_qwen.py clone       <test_script.yaml> <out_dir> --ref <REF.wav> --seed 1234
"""
import argparse
import random
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import yaml
from qwen_tts import Qwen3TTSModel

DESIGN_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
import os
BASE_MODEL = os.environ.get("QWEN_BASE_DIR", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")  # можно указать локальную папку


def seed_all(s):
    random.seed(s)
    np.random.seed(s)
    torch.manual_seed(s)


def local(name):
    """Путь к локальной копии модели (обходит лимиты HF API); иначе — имя для скачивания."""
    snaps = sorted((Path.home() / ".cache/huggingface/hub" / ("models--" + name.replace("/", "--")) / "snapshots").glob("*"))
    return str(snaps[-1]) if snaps else name


def load(name):
    name = name if Path(name).is_dir() else local(name)
    torch.set_num_threads(4)
    # fp32 по умолчанию: bf16 экономит память, но на CPU без AVX512-BF16 в ~10 раз медленнее
    dtype = torch.bfloat16 if os.environ.get("QWEN_DTYPE") == "bf16" else torch.float32
    return Qwen3TTSModel.from_pretrained(name, device_map="cpu", dtype=dtype)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["design-ref", "design", "clone"])
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--ref", help="REF wav for clone mode")
    ap.add_argument("--ref-text", help="точная расшифровка REF (если модель сказала иначе, чем в yaml)")
    ap.add_argument("--only", help="comma-separated segment ids")
    ap.add_argument("--brief", default="voice_brief_en", help="ключ описания голоса в yaml")
    a = ap.parse_args()
    cfg = yaml.safe_load(open(a.script, encoding="utf-8"))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    brief = cfg[a.brief].strip()
    segs = cfg["segments"]
    if a.only:
        keep = set(a.only.split(","))
        segs = [s for s in segs if s["id"] in keep]

    if a.mode == "design-ref":
        m = load(DESIGN_MODEL)
        r = cfg["reference"]
        seed_all(a.seed)
        t = time.time()
        wavs, sr = m.generate_voice_design(text=r["text"], language="Russian", instruct=f"{brief} {r['instruct_en']}")
        tag = "" if a.brief == "voice_brief_en" else "_" + a.brief.replace("voice_brief_", "").replace("_en", "")
        sf.write(out / f"REF{tag}_seed{a.seed}.wav", wavs[0], sr)
        print(f"REF seed={a.seed} {len(wavs[0]) / sr:.2f}s gen {time.time() - t:.0f}s")
        return

    if a.mode == "design":
        m = load(DESIGN_MODEL)
        for s in segs:
            seed_all(a.seed)
            t = time.time()
            wavs, sr = m.generate_voice_design(text=s["text"], language="Russian", instruct=f"{brief} {s['instruct_en']}")
            sf.write(out / f"{s['id']}.wav", wavs[0], sr)
            print(f"{s['id']} {len(wavs[0]) / sr:.2f}s gen {time.time() - t:.0f}s")
        return

    m = load(BASE_MODEL)
    r = cfg["reference"]
    ref_text = a.ref_text or r["text"]
    prompt = m.create_voice_clone_prompt(ref_audio=a.ref, ref_text=ref_text, x_vector_only_mode=False)
    for s in segs:
        seed_all(a.seed)
        t = time.time()
        wavs, sr = m.generate_voice_clone(text=s["text"], language="Russian", voice_clone_prompt=prompt)
        sf.write(out / f"{s['id']}.wav", wavs[0], sr)
        print(f"{s['id']} {len(wavs[0]) / sr:.2f}s gen {time.time() - t:.0f}s")


if __name__ == "__main__":
    main()
