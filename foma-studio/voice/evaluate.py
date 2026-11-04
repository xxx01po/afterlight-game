#!/usr/bin/env python3
"""Объективная оценка голосовых проб (я не слышу звук — поэтому меряю).

Для каждого варианта (папка с S1..S5.wav):
  cer        — ошибка распознавания (Whisper ru) по символам: разборчивость и правильность ударений/слов
  f0_med     — медиана основного тона, Гц (цель «средне-низкий молодой мужской»: ~95–140 Гц)
  hnr        — отношение гармоник к шуму, дБ (ниже = больше хрипотцы/шёпота; для обычной речи цель ~8–14 дБ)
  rate       — темп, символов/с
  loud       — громкость, LUFS-подобная RMS-оценка (дБFS)
  spk_sim    — сходство «отпечатка голоса» каждой эмоции с эталоном REF (VoiceEncoder Chatterbox), 0..1
  spread     — динамика эмоций: разброс темпа/громкости/тона между сегментами (чем больше, тем «живее»)

Usage: python evaluate.py <test_script.yaml> <ref.wav> <variant_dir> [<variant_dir> ...] --out report.json
"""
import argparse
import json
from pathlib import Path

import librosa
import numpy as np
import yaml


def cer(ref, hyp):
    import re
    n = lambda s: re.sub(r"[^а-яё ]", "", s.lower().replace("ё", "е")).split()
    r, h = " ".join(n(ref)), " ".join(n(hyp))
    d = np.arange(len(h) + 1)
    for i, rc in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (rc != hc))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(len(r), 1)


def hnr(y, sr):
    # автокорреляционный HNR по вокализованным кадрам
    fr = librosa.util.frame(y, frame_length=int(0.04 * sr), hop_length=int(0.01 * sr)).T
    vals = []
    for f in fr:
        f = f * np.hanning(len(f))
        if np.sqrt(np.mean(f ** 2)) < 0.01:
            continue
        ac = np.correlate(f, f, "full")[len(f) - 1:]
        ac /= ac[0] + 1e-9
        lo, hi = int(sr / 400), int(sr / 70)
        r = ac[lo:hi].max()
        if 0.2 < r < 0.999:
            vals.append(10 * np.log10(r / (1 - r)))
    return float(np.median(vals)) if vals else float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("ref")
    ap.add_argument("variants", nargs="+")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    cfg = yaml.safe_load(open(a.script, encoding="utf-8"))
    from faster_whisper import WhisperModel
    from chatterbox.models.voice_encoder import VoiceEncoder
    asr = WhisperModel("small", device="cpu", compute_type="int8")
    ve = VoiceEncoder()
    import os
    import torch
    ve_path = Path(os.environ.get("CHATTERBOX_DIR", ".")) / "ve.pt"
    if not ve_path.exists():
        from huggingface_hub import hf_hub_download
        ve_path = hf_hub_download("ResembleAI/chatterbox", "ve.pt")
    ve.load_state_dict(torch.load(ve_path, map_location="cpu"))
    ve.eval()
    emb = lambda y: ve.embeds_from_wavs([y], 16000, as_spk=True)
    ref16, _ = librosa.load(a.ref, sr=16000)
    e_ref = emb(ref16)
    report = {}
    for vd in a.variants:
        rows = {}
        for s in cfg["segments"]:
            p = Path(vd) / f"{s['id']}.wav"
            if not p.exists():
                continue
            y, sr = librosa.load(p, sr=24000)
            y16 = librosa.resample(y, orig_sr=24000, target_sr=16000)
            segs, _ = asr.transcribe(y16, language="ru", beam_size=5)
            hyp = " ".join(x.text for x in segs).strip()
            f0, vf, _ = librosa.pyin(y, fmin=60, fmax=400, sr=sr)
            f0 = f0[~np.isnan(f0)]
            dur = len(y) / sr
            e = emb(y16)
            rows[s["id"]] = {
                "hyp": hyp, "cer": round(cer(s["text"], hyp), 3),
                "f0_med": round(float(np.median(f0)), 1) if len(f0) else None,
                "voiced": round(float(np.mean(vf)), 2),
                "hnr": round(hnr(y, sr), 1),
                "rate": round(len(s["text"]) / dur, 1), "dur": round(dur, 2),
                "loud": round(float(20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-9)), 1),
                "spk_sim": round(float(np.dot(e, e_ref.T).squeeze() / (np.linalg.norm(e) * np.linalg.norm(e_ref))), 3),
            }
        if not rows:
            continue
        v = list(rows.values())
        summ = {
            "cer_mean": round(float(np.mean([r["cer"] for r in v])), 3),
            "f0_calm": rows.get("S1_calm", {}).get("f0_med"),
            "hnr_calm": rows.get("S1_calm", {}).get("hnr"),
            "spk_sim_mean": round(float(np.mean([r["spk_sim"] for r in v])), 3),
            "spk_sim_min": round(float(np.min([r["spk_sim"] for r in v])), 3),
            "rate_spread": round(float(np.ptp([r["rate"] for r in v])), 1),
            "loud_spread": round(float(np.ptp([r["loud"] for r in v])), 1),
            "f0_spread": round(float(np.ptp([r["f0_med"] or 0 for r in v])), 1),
            "whisper_voiced": rows.get("S4_whisper", {}).get("voiced"),
        }
        report[Path(vd).name] = {"summary": summ, "segments": rows}
        print(Path(vd).name, json.dumps(summ, ensure_ascii=False))
    Path(a.out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
