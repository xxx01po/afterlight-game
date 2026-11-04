#!/usr/bin/env python3
"""Аниматик по шот-листу: карточка на каждый кадр + черновой голос + эмбиент -> MP4.

Карточка: ID, класс, ракурс/камера, действие, реплика. Тайминг = duration из shotlist.csv.
Голос: <audio_dir>/<line_id>.wav ставится в начало своего кадра (+0.4 с).
Эмбиент: синтетический «room tone» (коричневый шум + гул), стихает к финалу.
Итог нормализуется под YouTube: -14 LUFS, true peak -1 dB.

Usage: python3 tools/build_animatic.py <shotlist.csv> <out.mp4> [--audio-dir DIR] [--dialogue dialogue.csv]
"""
import argparse
import csv
import subprocess
import tempfile
import textwrap
from pathlib import Path

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
W, H, FPS = 1280, 720, 24


def card(shot, line, dur, out):
    """Тексты пишутся во временные файлы (textfile=) — так не нужно экранировать запятые/двоеточия."""
    tdir = out.parent
    n = [0]

    def txt(s, x, y, size, color):
        n[0] += 1
        p = tdir / f"{out.stem}_{n[0]}.txt"
        p.write_text(s, encoding="utf-8")
        return f"drawtext=fontfile={FONT}:textfile={p}:x={x}:y={y}:fontsize={size}:fontcolor={color}"

    parts = [
        txt(f"{shot['shot_id']}   [{shot['class']}]   {dur:g} s", 60, 50, 30, "0x9DB4CF"),
        txt(f"{shot['angle']} · {shot['camera']}", 60, 100, 22, "0x6F7782"),
        txt(shot["lighting"], 60, 132, 20, "0x5A626C"),
    ]
    for i, l in enumerate(textwrap.wrap(shot["action"], 60)):
        parts.append(txt(l, 60, 260 + i * 46, 36, "0xE6EAF0"))
    if line:
        for i, l in enumerate(textwrap.wrap(f"{line['character']}: «{line['text']}»", 58)):
            parts.append(txt(l, 60, 540 + i * 40, 30, "0xF4F8FF"))
    parts.append(txt("звук: " + shot["sound"], 60, 660, 20, "0x9E1B1B"))
    vf = ",".join(parts) + f",fade=t=in:st=0:d=0.25,fade=t=out:st={max(dur - 0.25, 0)}:d=0.25"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x0B0D10:s={W}x{H}:r={FPS}:d={dur}",
                    "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shotlist")
    ap.add_argument("out")
    ap.add_argument("--audio-dir")
    ap.add_argument("--dialogue")
    a = ap.parse_args()
    sl = Path(a.shotlist)
    base = sl.parent
    audio_dir = Path(a.audio_dir) if a.audio_dir else base / "audio" / "scratch"
    dlg_path = Path(a.dialogue) if a.dialogue else base / "dialogue.csv"
    shots = list(csv.DictReader(open(sl, encoding="utf-8")))
    lines = {r["line_id"]: r for r in csv.DictReader(open(dlg_path, encoding="utf-8"))} if dlg_path.exists() else {}

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        clips, vo, t = [], [], 0.0
        for i, s in enumerate(shots):
            dur = float(s["duration"])
            line = lines.get(s["dialogue_id"]) if s.get("dialogue_id") else None
            c = td / f"c{i:03d}.mp4"
            card(s, line, dur, c)
            clips.append(c)
            if line:
                for ext in ("wav", "mp3"):
                    if (audio_dir / f"{line['line_id']}.{ext}").exists():
                        vo.append((t + 0.4, audio_dir / f"{line['line_id']}.{ext}"))
                        break
            t += dur
        total = t
        lst = td / "list.txt"
        lst.write_text("".join(f"file '{c}'\n" for c in clips))
        video = td / "video.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(video)], check=True)

        # эмбиент: коричневый шум + низкий гул 55 Гц, уходит в тишину на последних 6 с (тишина — инструмент)
        inputs = ["-i", str(video),
                  "-f", "lavfi", "-i", f"anoisesrc=color=brown:amplitude=0.25:d={total}:r=48000",
                  "-f", "lavfi", "-i", f"sine=f=55:d={total}:r=48000"]
        fc = [f"[1]lowpass=f=400,volume=0.35,afade=t=out:st={total - 6}:d=3[n]",
              f"[2]volume=0.05,afade=t=out:st={total - 6}:d=3[h]"]
        mix = ["[n]", "[h]"]
        for j, (start, wav) in enumerate(vo):
            inputs += ["-i", str(wav)]
            ms = int(start * 1000)
            fc.append(f"[{3 + j}]adelay={ms}|{ms},apad=whole_dur={total}[v{j}]")
            mix.append(f"[v{j}]")
        fc.append("".join(mix) + f"amix=inputs={len(mix)}:normalize=0,atrim=0:{total},loudnorm=I=-14:TP=-1:LRA=11[a]")
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc),
                        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                        "-shortest", a.out], check=True)
    print(f"OK {a.out}  {total:.1f}s  {len(shots)} shots  {len(vo)} lines")


if __name__ == "__main__":
    main()
