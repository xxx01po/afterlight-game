#!/usr/bin/env python3
"""Финальная сборка теста T-01: видео превиза + реплики + звуковые слои → MP4, -14 LUFS (двухпроходный loudnorm).

Реплики: <voice_dir>/L01..L05.wav, ставятся по таймингу кадров из shotlist.csv (+0.4 с от начала кадра).
Обработка речи: лёгкая «маска» + ранние отражения узкого коридора. L05 — «двойник из темноты».

Usage: python mix_t01.py <video.mp4> <sfx_dir> <voice_dir> <shotlist.csv> <dialogue.csv> <out.mp4>
"""
import csv
import json
import subprocess
import sys

MASK = "highpass=f=90,equalizer=f=900:t=q:w=1.2:g=3,lowpass=f=7500,acompressor=threshold=-22dB:ratio=3:attack=5:release=90"
ROOM = "aecho=0.85:0.55:23|41|67:0.22|0.14|0.08"            # узкий коридор
FX = {
    "mask": f"{MASK},{ROOM}",
    "mask_whisper": f"{MASK},equalizer=f=3200:t=q:w=1:g=2,{ROOM}",
    # «двойник из темноты»: сухой голос + тот же голос на 3 полутона ниже, глухой, тихий (проверено: слово остаётся разборчивым)
    "dark_double": "asplit[dd][dw];[dw]rubberband=pitch=0.84:formant=preserved,lowpass=f=3000,volume=0.5[dw2];[dd][dw2]amix=inputs=2:normalize=0,aecho=0.8:0.6:60|140:0.22|0.1",
}
# уровни слоёв, дБ относительно полной шкалы слоя
LAYERS = {"amb_room": -20, "amb_wind": -24, "sfx_steps": -11, "sfx_doors": -7, "sfx_foley": -9, "sfx_body": -15, "sfx_drone": -17}
VO_GAIN = {"L04": 2, "L05": 4}


def main():
    video, sfx, vdir, shotlist, dialogue, out = sys.argv[1:7]
    shots = list(csv.DictReader(open(shotlist, encoding="utf-8")))
    lines = {r["line_id"]: r for r in csv.DictReader(open(dialogue, encoding="utf-8"))}
    t, starts = 0.0, {}
    for s in shots:
        if s["dialogue_id"]:
            starts[s["dialogue_id"]] = t + 0.4
        t += float(s["duration"])
    total = t
    inputs, fc, mix = ["-i", video], [], []
    k = 1
    for name, db in LAYERS.items():
        inputs += ["-i", f"{sfx}/{name}.wav"]
        fc.append(f"[{k}]aresample=48000,volume={db}dB[l{k}]"); mix.append(f"[l{k}]"); k += 1
    for lid, st in starts.items():
        inputs += ["-i", f"{vdir}/{lid}.wav"]
        ms = int(st * 1000)
        fc.append(f"[{k}]aresample=48000,{FX[lines[lid]['processing']]},volume={VO_GAIN.get(lid, 0)}dB,adelay={ms}|{ms}[l{k}]")
        mix.append(f"[l{k}]"); k += 1
    fc.append("".join(mix) + f"amix=inputs={len(mix)}:normalize=0:duration=longest,atrim=0:{total},afade=t=out:st={total - 0.3}:d=0.3,acompressor=threshold=-24dB:ratio=2:attack=10:release=200,alimiter=limit=0.35:attack=3:release=60:level=false")
    graph = ";".join(fc)
    # проход 1: измерение
    r = subprocess.run(["ffmpeg", "-hide_banner", "-y", *inputs, "-filter_complex", graph + ",loudnorm=I=-14:TP=-1.5:LRA=14:print_format=json[a]",
                        "-map", "[a]", "-f", "null", "-"], capture_output=True, text=True)
    js = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=14:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
          f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    # проход 2: применение
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph + f",{ln},aresample=48000[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", out], check=True)
    print("measured", js["input_i"], "LUFS ->", out)


if __name__ == "__main__":
    main()
