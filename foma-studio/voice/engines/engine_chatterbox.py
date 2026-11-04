#!/usr/bin/env python3
"""Chatterbox Multilingual (MIT, Resemble AI): клонирование голоса Фомы из эталона REF + управление эмоцией.
exaggeration — сила эмоции (0.25–2), cfg_weight — темп/стабильность (меньше = медленнее и «свободнее»).

Usage: python engine_chatterbox.py <test_script.yaml> <out_dir> --ref REF.wav --seed 1234
"""
import argparse
import random
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import yaml
from chatterbox.mtl_tts import ChatterboxMultilingualTTS


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--temperature", type=float, default=0.8)
    a = ap.parse_args()
    torch.set_num_threads(4)
    cfg = yaml.safe_load(open(a.script, encoding="utf-8"))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    for s in cfg["segments"]:
        random.seed(a.seed); np.random.seed(a.seed); torch.manual_seed(a.seed)
        t = time.time()
        wav = m.generate(s["text"], language_id="ru", audio_prompt_path=a.ref,
                         exaggeration=s["cb_exaggeration"], cfg_weight=s["cb_cfg"], temperature=a.temperature)
        sf.write(out / f"{s['id']}.wav", wav.squeeze(0).numpy(), m.sr)
        print(f"{s['id']} {wav.shape[-1] / m.sr:.2f}s gen {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
