#!/usr/bin/env python3
"""2.5D-анимация одного утверждённого ключевого кадра (бесплатно, CPU).

Принцип (как в аниме-постановке «живого кадра»): картинка не перерисовывается, а деформируется
мягкими полями смещения, разделёнными по глубине:
  - камера: наезд с параллаксом (ближние слои приближаются быстрее дальних) + лёгкий дрейф
  - голова: наклон вокруг шеи (поворот с плавным затуханием от центра головы)
  - плечи: вздох/пожатие + дыхание (вертикальный сдвиг переднего плана)
  - глаза: прищур, моргание, пульсация свечения (меняется только сама светящаяся область)
  - фонарик: мерцание; туман и пыль в воздухе; зерно
Дизайн Фомы не меняется: все пиксели берутся из утверждённого кадра.

Usage: python animate_25d.py <keyframe.png> <depth.npy> <out.mp4> --eyes x,y,w,h x,y,w,h
"""
import argparse
import subprocess

import cv2
import numpy as np

FPS, DUR = 24, 8.0


def sm(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def key(t, ks):
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * sm((t - t0) / (t1 - t0))
    return ks[-1][1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("depth")
    ap.add_argument("out")
    ap.add_argument("--eyes", nargs=2, required=True, help="x,y,w,h для каждого глаза")
    a = ap.parse_args()

    src0 = cv2.imread(a.image).astype(np.float32)
    H, W = src0.shape[:2]
    depth = np.load(a.depth).astype(np.float32)
    dsm = cv2.GaussianBlur(depth, (0, 0), 18)                    # гладкая глубина — без разрывов
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    fg = sm((dsm - 0.35) / 0.15)                                   # передний план (Фома)

    # зоны тела
    hc, hr = np.array([845, 300]), np.array([300, 330])            # голова+капюшон
    rh = np.sqrt(((xx - hc[0]) / hr[0]) ** 2 + ((yy - hc[1]) / hr[1]) ** 2)
    w_head = (1 - sm((rh - 0.7) / 0.5)) * np.clip(fg * 1.4, 0, 1)
    pivot = np.array([860.0, 600.0])                               # шея
    w_sh = sm((yy - 470) / 160) * fg                               # плечи и торс

    # глаза: маска свечения и «пустая» глазница
    eyes = []
    for e in a.eyes:
        x, y, w, h = map(int, e.split(","))
        x0, y0, x1, y1 = x - 10, y - 10, x + w + 10, y + h + 10
        patch = src0[y0:y1, x0:x1].copy()
        lum = patch.mean(2)
        g = sm((lum - 110) / 120)[..., None]                       # свечение + ореол
        socket = np.array([18, 16, 20], np.float32)
        base = patch * (1 - g) + socket * g
        eyes.append((x0, y0, x1, y1, patch, g, base))

    # фонарик (левый нижний угол): яркие пиксели
    fl = np.zeros((H, W), np.float32)
    fl[700:, 300:760] = 1
    fl *= sm((src0.mean(2) - 70) / 120)
    fl = cv2.GaussianBlur(fl, (0, 0), 6)[..., None]

    # туман: заранее сгенерированный шум, дрейфует
    rng = np.random.default_rng(7)
    fog = cv2.GaussianBlur(rng.random((H // 4, W // 2)).astype(np.float32), (0, 0), 9)
    fog = (fog - fog.min()) / (np.ptp(fog) + 1e-6)
    fog = cv2.resize(fog, (W * 2, H), interpolation=cv2.INTER_CUBIC)
    fog_amt = (1 - fg) * 0.10 + 0.02
    # пыль в луче фонарика
    P = 70
    px, py = rng.uniform(250, 900, P), rng.uniform(450, 900, P)
    pvx, pvy, pr = rng.uniform(-6, 6, P), rng.uniform(-10, -2, P), rng.uniform(1.0, 2.2, P)

    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p",
                           "-c:v", "libx264", "-crf", "17", "-preset", "slow", a.out], stdin=subprocess.PIPE)
    N = int(DUR * FPS)
    for i in range(N):
        t = i / FPS
        src = src0.copy()

        # --- глаза (до деформаций, чтобы двигались вместе с головой)
        squint = key(t, [[1.1, 1.0], [1.45, 0.72], [3.9, 0.78], [4.3, 0.92], [7.0, 1.0]])
        blink = 0.08 if abs(t - 6.0) < 0.07 else (0.4 if abs(t - 6.0) < 0.12 else 1.0)
        sy = squint * blink
        glow = 0.94 + 0.06 * np.sin(t * 2.3) + 0.02 * np.sin(t * 7.1)
        for x0, y0, x1, y1, patch, g, base in eyes:
            ph, pw = patch.shape[:2]
            M = np.float32([[1, 0, 0], [0, sy, (1 - sy) * ph / 2]])
            pg = cv2.warpAffine(patch * glow, M, (pw, ph), borderMode=cv2.BORDER_REPLICATE)
            gg = cv2.warpAffine(g[..., 0], M, (pw, ph))[..., None]
            src[y0:y1, x0:x1] = base * (1 - gg) + pg * gg

        # --- фонарик
        flick = 1.0 + 0.06 * np.sin(t * 31) * np.sin(t * 4.7) + (-0.12 if 6.9 < t < 6.97 else 0)
        src = src * (1 + fl * (flick - 1))

        # --- поле смещений (обратное отображение: откуда брать пиксель)
        ang = np.deg2rad(key(t, [[2.0, 0.0], [2.9, 5.0], [5.7, 5.4], [7.2, 1.6]]))
        nod = key(t, [[0.9, 0], [1.25, 6], [1.8, 0]])               # кивок на «Отлично»
        lift = key(t, [[4.1, 0], [4.6, -9], [5.0, -8], [5.5, 3], [6.1, 0]])
        breath = 1.6 * np.sin(2 * np.pi * t / 3.4)
        # голова: поворот вокруг шеи, сила убывает от центра головы
        th = -ang * w_head
        dx, dy = xx - pivot[0], yy - pivot[1]
        sx = pivot[0] + dx * np.cos(th) - dy * np.sin(th)
        syy = pivot[1] + dx * np.sin(th) + dy * np.cos(th) - nod * w_head
        # плечи и дыхание
        syy = syy - (lift + breath) * w_sh - 0.5 * lift * w_head
        # камера: наезд с параллаксом + дрейф
        z = 0.05 * sm(t / DUR)
        zp = 1 + z * (0.55 + 0.9 * dsm)
        cx, cy = 840 + 14 * sm(t / DUR), 360
        mx = cx + (sx - cx) / zp - 6 * sm(t / DUR)
        my = cy + (syy - cy) / zp
        frame = cv2.remap(src, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

        # --- туман
        off = int((t * 18) % W)
        f = fog[:, off:off + W][..., None]
        frame = frame + (np.array([62, 48, 40], np.float32) * f * fog_amt[..., None]) * 1.6

        # --- пыль
        dust = np.zeros((H, W), np.float32)
        for k in range(P):
            x = (px[k] + pvx[k] * t) % W
            y = (py[k] + pvy[k] * t)
            if 0 <= y < H:
                b = np.exp(-((x - 420) ** 2 + (y - 840) ** 2) / (2 * 260 ** 2))
                cv2.circle(dust, (int(x), int(y)), int(round(pr[k])), float(0.55 * b), -1, cv2.LINE_AA)
        dust = cv2.GaussianBlur(dust, (0, 0), 1.2)[..., None]
        frame = frame + dust * np.array([215, 225, 235], np.float32)

        # --- зерно, затемнение входа/выхода
        frame = frame + rng.normal(0, 3.2, (H, W, 1)).astype(np.float32)
        fade = key(t, [[0, 0], [0.5, 1]]) * key(t, [[7.4, 1], [8.0, 0]])
        frame = np.clip(frame * fade, 0, 255).astype(np.uint8)
        ff.stdin.write(frame[: H - H % 2, : W - W % 2].tobytes() if False else frame.tobytes())
        if i % 48 == 0:
            print(f"frame {i}/{N}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("done", a.out)


if __name__ == "__main__":
    main()
