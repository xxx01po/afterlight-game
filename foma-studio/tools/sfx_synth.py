#!/usr/bin/env python3
"""Процедурный звук для теста T-01. Всё синтезируется с нуля (numpy) — оригинально, без лицензий.

Слои (48 кГц, моно WAV, длина = длине ролика):
  amb_room   — тон комнаты: коричневый шум + сетевой гул + хиссы; уходит в тишину перед финалом
  amb_wind   — порывы ветра в щелях окна; стихает, когда открывается дверь (SH05)
  sfx_steps  — шаги по паркету (из той же кривой движения, что и анимация)
  sfx_doors  — скрип входной двери (SH01) и долгий скрип дальней двери (SH05)
  sfx_foley  — щелчок фонарика, удар фонарика о ладонь, вздох
  sfx_body   — сердцебиение и испуганное дыхание (SH06–SH08)
  sfx_drone  — низкий нарастающий гул 24→42.4 с, обрыв в тишину перед «Есть.», тёмный хвост

Usage: python sfx_synth.py <out_dir> [--dur 48.5]
"""
import argparse
import wave
from pathlib import Path

import numpy as np

SR = 48000
R = np.random.default_rng(1977)


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def key(t, ks):
    t = np.asarray(t, dtype=float)
    out = np.full_like(t, ks[0][1])
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        m = (t > t0) & (t <= t1)
        out[m] = v0 + (v1 - v0) * smooth((t[m] - t0) / (t1 - t0))
    out[t > ks[-1][0]] = ks[-1][1]
    return out


def band(x, lo, hi, order=4):
    """Полосовой фильтр через FFT с мягкими краями."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X = np.fft.rfft(x)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi:
        m *= 1 / (1 + (f / hi) ** (2 * order))
    return np.fft.irfft(X * m, n)


def brown(n):
    w = R.standard_normal(n)
    b = np.cumsum(w)
    b -= np.convolve(b, np.ones(4801) / 4801, mode="same")  # убрать дрейф
    return b / (np.abs(b).max() + 1e-9)


def env_ad(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(t / max(a, 1e-4), 1) * np.exp(-np.maximum(t - a, 0) / d)


def place(track, sig, t, gain=1.0):
    i = int(t * SR)
    j = min(len(track), i + len(sig))
    if i < len(track):
        track[i:j] += sig[: j - i] * gain


def resonator_ir(freqs, decays, gains, dur=0.25):
    t = np.arange(int(dur * SR)) / SR
    ir = sum(g * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d, g in zip(freqs, decays, gains))
    return ir / np.abs(ir).max()


def creak(dur, rate_curve, wood=(310, 720, 1350, 2450, 3900)):
    """Скрип: трение stick-slip — нерегулярная серия импульсов через резонансы дерева."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = rate_curve(t / dur)                       # частота «срывов», Гц
    rate = rate * (1 + 0.25 * band(R.standard_normal(n), None, 6))  # дрожание
    phase = np.cumsum(rate / SR)
    imp = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(phase)) > 0)[0]
    imp[idx] = 0.5 + 0.5 * R.random(len(idx))
    ir = resonator_ir(wood, [0.03, 0.02, 0.012, 0.008, 0.005], [1, 0.8, 0.6, 0.35, 0.2], 0.12)
    y = np.convolve(imp, ir)[:n]
    y += band(R.standard_normal(n), 900, 5000) * 0.04   # шорох
    y *= smooth(t / 0.08) * smooth((dur - t) / 0.25)
    return y / (np.abs(y).max() + 1e-9)


def step(heavy=1.0):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (95 - 40 * t) * t) * np.exp(-t / 0.045) * heavy
    click = band(R.standard_normal(n), 1200, 5000) * np.exp(-t / 0.012) * 0.35
    scuff = band(R.standard_normal(n), 400, 2500) * np.exp(-np.maximum(t - 0.03, 0) / 0.06) * (t > 0.03) * 0.12
    y = thump + click + scuff
    if R.random() < 0.5:  # половица
        c = creak(0.3, lambda u: 60 + 40 * u)
        y[: len(c)] += c * 0.12
    return y


def breath(dur, lo=500, hi=2200, inhale=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    shape = np.sin(np.pi * t / dur) ** (1.5 if inhale else 0.8)
    return band(R.standard_normal(n), lo, hi) * shape


def heartbeat(bpm_from, bpm_to, t0, t1, track, gain):
    t = t0
    while t < t1:
        k = (t - t0) / (t1 - t0)
        bpm = bpm_from + (bpm_to - bpm_from) * k
        for off, g in ((0, 1.0), (0.28 * 60 / bpm, 0.7)):
            n = int(0.18 * SR)
            tt = np.arange(n) / SR
            s = np.sin(2 * np.pi * 52 * tt) * np.exp(-tt / 0.05) * g
            place(track, s, t + off, gain * smooth(np.array([k * 3]))[0])
        t += 60 / bpm


def fomaZ(t):  # та же кривая, что в previz/scene.js
    return key(t, [[0.8, 0.55], [2.6, -0.95], [3.2, -0.95], [5.8, -2.0], [39.15, -2.0], [39.75, -1.62]])


def write(path, x, peak=0.9):
    x = x / (np.abs(x).max() + 1e-9) * peak
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--dur", type=float, default=48.5)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    N = int(a.dur * SR)
    T = np.arange(N) / SR

    # --- тон комнаты
    room = band(brown(N), 25, 320) * 0.8 + np.sin(2 * np.pi * 50 * T) * 0.02 + np.sin(2 * np.pi * 100 * T) * 0.008
    room += band(R.standard_normal(N), 4000, 9000) * 0.01
    room *= key(T, [[0, 0], [1.0, 1], [41.8, 1], [42.5, 0.15], [46.5, 0.1], [48.5, 0]])
    write(out / "amb_room.wav", room, 0.5)

    # --- ветер
    gust = band(R.standard_normal(N), None, 0.25)
    gust = (gust - gust.min()) / (np.ptp(gust) + 1e-9)
    wind = band(R.standard_normal(N), 180, 900) * (0.3 + 0.7 * gust)
    whistle_f = 650 + 220 * gust
    wind += np.sin(2 * np.pi * np.cumsum(whistle_f) / SR) * 0.06 * gust ** 2
    wind *= key(T, [[0, 0.3], [0.8, 1], [22.8, 1], [26.5, 0.0]])
    write(out / "amb_wind.wav", wind, 0.5)

    # --- шаги: моменты, когда фаза походки проходит kπ
    steps = np.zeros(N)
    ph = (0.55 - fomaZ(T)) / 0.62
    k = np.floor(ph)
    hits = np.nonzero(np.diff(k) != 0)[0]
    last = -1
    for h in hits:
        t = h / SR
        if t - last > 0.25:
            place(steps, step(1.0 if t < 30 else 1.3), t, 0.8 if t < 30 else 1.0)
            last = t
    write(out / "sfx_steps.wav", steps, 0.8)

    # --- двери
    doors = np.zeros(N)
    place(doors, creak(1.6, lambda u: 70 + 50 * np.sin(np.pi * u)), 0.55, 0.55)            # входная
    far = creak(3.6, lambda u: 35 + 90 * u ** 1.5 + 25 * np.sin(9 * u), wood=(240, 560, 1120, 2100, 3300))
    place(doors, far, 22.8, 1.0)                                                            # дальняя
    write(out / "sfx_doors.wav", doors, 0.85)

    # --- фоли
    foley = np.zeros(N)
    clk = band(R.standard_normal(int(0.04 * SR)), 2000, 9000) * env_ad(int(0.04 * SR), 0.0005, 0.004)
    place(foley, clk, 2.98, 0.9)
    place(foley, clk * 0.6, 3.12, 0.9)
    tap = band(R.standard_normal(int(0.08 * SR)), 300, 3000) * env_ad(int(0.08 * SR), 0.001, 0.015)
    place(foley, tap, 39.62, 1.0)
    m = int(0.1 * SR)
    palm = np.sin(2 * np.pi * 140 * np.arange(m) / SR) * env_ad(m, 0.002, 0.03)
    palm[: len(tap)] += tap[:m] * 0.6
    place(foley, palm, 40.02, 1.0)
    place(foley, breath(1.1, 300, 1500, inhale=False), 17.0, 0.35)                       # вздох на пожатии плеч
    write(out / "sfx_foley.wav", foley, 0.8)

    # --- тело: сердце и дыхание страха
    body = np.zeros(N)
    heartbeat(68, 96, 27.2, 42.3, body, 0.9)
    for i, t in enumerate(np.arange(24.0, 42.2, 1.35)):
        place(body, breath(0.55, 600, 2600, inhale=(i % 2 == 0)), t, 0.25 + 0.15 * (t > 38.5))
    place(body, breath(0.35, 700, 3000, True), 39.3, 0.6)                                 # резкий вдох на шаге назад
    write(out / "sfx_body.wav", body, 0.6)

    # --- гул
    drone = (np.sin(2 * np.pi * 41 * T) + 0.7 * np.sin(2 * np.pi * 41.6 * T) + 0.4 * np.sin(2 * np.pi * 61.5 * T))
    drone += band(brown(N), 30, 160) * 0.8
    drone *= key(T, [[22.5, 0], [27, 0.35], [38.5, 0.7], [42.3, 1.0], [42.45, 0.0], [43.6, 0.0], [44.2, 0.55], [46.5, 0.0]])
    write(out / "sfx_drone.wav", drone, 0.7)
    print("ok", out)


if __name__ == "__main__":
    main()
