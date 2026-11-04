"""Original sound design + score for «Последнее сообщение». Pure synthesis (numpy/scipy)."""
import json, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
C = json.load(open(sys.argv[1]))
DUR = C['duration']
N = int(DUR * SR)
rng = np.random.default_rng(7)
T = np.arange(N) / SR

def buf(): return np.zeros((N, 2))
def at(s): return int(s * SR)

def env_curve(points):
    """piecewise-linear gain curve from [(t, g), ...]"""
    ts, gs = zip(*points)
    return np.interp(T, ts, gs)

def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x, axis=0)
def bp(x, a, b, o=2): return signal.sosfilt(signal.butter(o, [a, b], 'band', fs=SR, output='sos'), x, axis=0)

def add(dst, src, t0, gain=1.0, pan=0.0):
    i = at(t0)
    if i >= N: return
    if src.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
        src = np.stack([src * l * 1.414, src * r * 1.414], 1)
    n = min(len(src), N - i)
    dst[i:i + n] += src[:n] * gain

def reverb_ir(sec=2.8, decay=3.0, bright=6000, seed=1):
    r = np.random.default_rng(seed)
    n = int(sec * SR); tt = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-decay * tt)[:, None]
    ir = lp(ir, bright)
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0))

def reverb(x, wet=0.35, **kw):
    ir = reverb_ir(**kw)
    y = np.stack([signal.fftconvolve(x[:, k], ir[:, k])[:N] for k in range(2)], 1)
    return x * (1 - wet) + y * wet * 2.2

# ---------------- instruments ----------------
NOTE = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'Bb': 1, 'B': 2}
def hz(n):
    name, octv = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((NOTE[name] + (octv - 4) * 12) / 12)

def piano(n, vel=0.5, dur=4.0):
    f = hz(n); L = int(dur * SR); tt = np.arange(L) / SR
    y = np.zeros(L)
    B = 0.0004
    for k in range(1, 12):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 16000: break
        amp = (1 / k ** 1.25) * (0.6 + 0.4 * vel) ** (k * 0.3)
        dec = 0.9 + k * 0.55 + f / 900
        y += amp * np.sin(2 * np.pi * fk * tt + rng.random() * 6) * (0.75 * np.exp(-dec * tt) + 0.25 * np.exp(-dec * 0.18 * tt))
    att = np.minimum(1, tt / 0.004)
    y *= att
    ham = rng.standard_normal(int(0.02 * SR)) * np.exp(-np.arange(int(0.02 * SR)) / (0.003 * SR)) * 0.08
    y[:len(ham)] += bp(ham, 300, 3000)
    y *= np.exp(-np.maximum(0, tt - (dur - 0.6)) * 8)
    return y * vel * 0.32

def pad(freqs, dur, cutoff=900, detune=0.006, att=1.5, rel=2.0, bright_lfo=0.15):
    L = int(dur * SR); tt = np.arange(L) / SR
    y = np.zeros((L, 2))
    for f in freqs:
        for d, ch in ((-detune, 0), (detune, 1), (0, 0), (0, 1)):
            ph = rng.random()
            saw = 2 * ((tt * f * (1 + d) + ph) % 1) - 1
            y[:, ch] += saw * 0.5
    y = lp(y, cutoff, 2)
    e = np.minimum(1, tt / att) * np.minimum(1, np.maximum(0, (dur - tt) / rel))
    y *= (e * (1 + 0.25 * np.sin(2 * np.pi * bright_lfo * tt)))[:, None]
    return y / max(1, len(freqs)) * 0.18

def ping(f1=1318.5, f2=1760, gain=1.0, soft=False):
    L = int(0.9 * SR); tt = np.arange(L) / SR
    y = np.zeros(L)
    for f, t0 in ((f1, 0), (f2, 0.09)):
        s = tt - t0; m = s >= 0
        y[m] += np.sin(2 * np.pi * f * s[m]) * np.exp(-s[m] * (9 if not soft else 4)) + 0.25 * np.sin(2 * np.pi * f * 2 * s[m]) * np.exp(-s[m] * 16)
    y *= np.minimum(1, tt / 0.002)
    return y * 0.22 * gain

def click(f=4000, gain=1.0, L=0.025):
    n = int(L * SR)
    y = rng.standard_normal(n) * np.exp(-np.arange(n) / (0.004 * SR))
    return bp(y, f * 0.6, min(f * 1.6, 20000)) * 0.25 * gain

def whoosh(dur=0.4, f0=400, f1=4000, gain=1.0, rev=False):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n); blk = 1024
    for i in range(0, n, blk):
        k = i / n
        fc = f0 * (f1 / f0) ** k
        seg = x[max(0, i - 4096):i + blk]
        y = bp(seg, max(40, fc * 0.6), min(fc * 1.5, 20000))
        out[i:i + blk] = y[-len(out[i:i + blk]):]
    e = np.sin(np.pi * np.minimum(1, tt / dur)) ** 2
    if rev: e = (tt / dur) ** 2.5
    return out * e * 0.5 * gain

def heartbeat(gain=1.0):
    L = int(0.6 * SR); tt = np.arange(L) / SR
    y = np.zeros(L)
    for t0, a in ((0, 1), (0.22, 0.7)):
        s = tt - t0; m = s >= 0
        y[m] += a * np.sin(2 * np.pi * (58 - 18 * s[m] * 4) * s[m]) * np.exp(-s[m] * 18)
    return lp(y, 200) * 0.9 * gain

def rustle(dur=0.6, gain=1.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = rng.standard_normal(n)
    am = np.abs(signal.sosfilt(signal.butter(2, 18, 'low', fs=SR, output='sos'), rng.standard_normal(n))) * 8
    y = bp(x, 900, 6000) * am * np.sin(np.pi * tt / dur) ** 1.5
    return y * 0.12 * gain

def vibrate(gain=1.0):
    L = int(0.75 * SR); tt = np.arange(L) / SR
    y = np.sin(2 * np.pi * 172 * tt) * (np.sign(np.sin(2 * np.pi * 172 * tt)) * 0.3 + 0.7)
    gate = ((tt < 0.28) | ((tt > 0.42) & (tt < 0.7))).astype(float)
    gate = lp(gate, 60)
    return lp(y * gate, 900) * 0.25 * gain

# ---------------- layers ----------------
fx = buf()     # dry effects
mus = buf()    # music
amb = buf()    # ambience

# rain: indoor muffled + droplet ticks
noise = rng.standard_normal((N, 2))
rain = bp(noise, 300, 7000) * 0.06 + lp(noise, 600) * 0.05
drops = np.zeros((N, 2))
for k in range(int(DUR * 45)):
    t0 = rng.random() * DUR
    add(drops, click(f=1500 + rng.random() * 4000, gain=0.25 + rng.random() * 0.5, L=0.012), t0, pan=rng.random() * 1.6 - 0.8)
rain = rain + drops
rain_g = env_curve([(0, 0), (0.15, 0.9), (5, 0.9), (5.05, 0.7), (20.4, 0.7), (21.2, 0.25), (32.3, 0.25), (32.9, 0.0), (33.0, 0.8),
                    (40.3, 0.85), (42.8, 0.85), (50, 0.6), (64, 0.5), (66.5, 0.15), (70, 0.06), (72.6, 0.0), (DUR, 0)])
amb += rain * rain_g[:, None]
# muffle during memories -> outdoor warm rain lighter
city = lp(np.cumsum(rng.standard_normal((N, 2)) * 0.02, 0), 140)
city = hp(city, 25)
city /= np.abs(city).max() + 1e-9
amb += city * 0.05 * env_curve([(0, 0), (0.2, 1), (20.6, 1), (21, 0.3), (33, 1), (64, 1), (68, 0.3), (72.6, 0), (DUR, 0)])[:, None]
# distant cars passing
for t0 in (3.0, 16.0, 37.0, 47.0, 56.0):
    add(amb, lp(whoosh(3.5, 200, 900, 0.5), 1200), t0, pan=rng.random() - 0.5)
# dawn birds (soft)
for k in range(9):
    t0 = 66.5 + k * 0.6 + rng.random() * 0.4
    L = int(0.12 * SR); tt = np.arange(L) / SR
    f = 3200 + rng.random() * 1500
    chirp = np.sin(2 * np.pi * (f + 1800 * tt / 0.12) * tt) * np.sin(np.pi * tt / 0.12) ** 2
    add(amb, chirp * 0.025, t0, pan=0.5 - rng.random())

# phone sounds
add(fx, vibrate(1.2), C['vibrate'][0])
add(fx, ping(gain=1.0), C['notif'][0])
for t0 in C['msgIn']:
    if abs(t0 - 1.0) < 0.1: continue
    soft = t0 > 50
    add(fx, ping(f1=1318.5 if not soft else 987.8, f2=1760 if not soft else 1318.5, gain=0.85, soft=soft), t0)
add(fx, ping(gain=0.9), 17.3)  # photo arrives
for kt in C['keys']:
    add(fx, click(3500, 0.9), kt, pan=0.2)
add(fx, whoosh(0.28, 600, 5000, 0.6), C['send'] - 0.02, pan=0.3)
add(fx, whoosh(0.5, 300, 3000, 0.5), C['photoOpen'] - 0.05)
add(fx, whoosh(1.2, 2000, 8000, 0.35, rev=True), C['memStart'] - 1.0)  # shimmer into memories
for hb in C['heartbeat']:
    add(fx, heartbeat(0.9), hb)
for r in C['rustle']:
    add(fx, rustle(0.7, 1.0), r, pan=rng.random() - 0.5)
# power off: click + low thunk
add(fx, click(2500, 1.6, 0.04), C['powerOff'])
th = np.sin(2 * np.pi * 70 * np.arange(int(0.2 * SR)) / SR) * np.exp(-np.arange(int(0.2 * SR)) / (0.04 * SR)) * 0.25
add(fx, th, C['powerOff'] + 0.01)
# screen back on by itself: reversed swell + detuned low ping
add(fx, whoosh(1.0, 300, 2500, 0.5, rev=True), C['screenBack'] - 0.95)
add(fx, ping(f1=659.3, f2=698.5, gain=1.0, soft=True), C['screenBack'])
# ghost flicker shimmer
L = int(1.4 * SR); tt = np.arange(L) / SR
glass = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3) for f in (2637, 3520, 4186)) * 0.04
add(fx, glass, C['ghostFlicker'], pan=0.3)
# headlight flash: rising swell + hit, then cut
add(fx, whoosh(0.75, 200, 6000, 1.0, rev=True), C['flash'])
L = int(0.08 * SR)
add(fx, rng.standard_normal(L) * np.exp(-np.arange(L) / (0.01 * SR)) * 0.2, C['cutToPresent'] - 0.04)

# ---------------- score ----------------
def pn(n, t0, vel=0.5, dur=4.0, pan=0.0):
    add(mus, piano(n, vel, dur), t0, pan=pan)
def chord(notes, t0, vel=0.35, dur=4.0, spread=0.025):
    for i, n in enumerate(notes):
        pn(n, t0 + i * spread, vel, dur, pan=(i / max(1, len(notes) - 1) - 0.5) * 0.6)

AM = ['A2', 'E3', 'A3', 'C4']; FM = ['F2', 'C3', 'A3', 'E4']; CM = ['C3', 'G3', 'C4', 'E4']; GM = ['G2', 'D3', 'G3', 'B3']
# 0-20: dark pad
add(mus, pad([hz('A2'), hz('E3'), hz('C4')], 10.5, cutoff=500, att=2.0), 0.0)
add(mus, pad([hz('F2'), hz('C3'), hz('A3')], 10.5, cutoff=550, att=2.5), 9.5)
add(mus, pad([hz('A2'), hz('E3'), hz('B3')], 3.5, cutoff=600, att=1.0), 17.5)
# opening motif (sparse, after the first message)
motif = [('E5', 0), ('D5', 0.62), ('C5', 1.24), ('B4', 2.5), ('C5', 3.12), ('A4', 3.74)]
for n, d in motif: pn(n, 5.2 + d, 0.38, 3.5, 0.15)
chord(['A2', 'E3'], 5.2, 0.3, 5.0); chord(['F2', 'C3'], 8.7, 0.3, 4.0)
# tension: high sparse notes
pn('A5', 12.5, 0.25, 3); pn('E5', 14.1, 0.22, 3); pn('Bb4', 15.8, 0.2, 3)
# 18-20.6: arpeggio begins
arp = ['A3', 'C4', 'E4', 'A4']
for i in range(9): pn(arp[i % 4], 18.0 + i * 0.3, 0.2 + i * 0.02, 1.5, 0.3 * ((i % 2) * 2 - 1))
# 20.6-32.3: memories – build up
prog = [(FM, 'F'), (CM, 'C'), (GM, 'G'), (AM, 'A'), (FM, 'F')]
for ci, (ch, nm) in enumerate(prog):
    t0 = 20.6 + ci * 2.4
    v = 0.3 + ci * 0.06
    chord(ch[:2], t0, v, 3.0)
    up = [ch[1], ch[2], ch[3], ch[2]]
    for i in range(8):
        n = up[i % 4]
        pn(n[:-1] + str(int(n[-1]) + (1 if i >= 4 and ci >= 3 else 0)), t0 + i * 0.3, 0.18 + ci * 0.04, 1.2, 0.35 * ((i % 2) * 2 - 1))
    pad_f = [hz(x) for x in ch[:3]]
    add(mus, pad(pad_f, 2.9, cutoff=900 + ci * 500, att=0.4, rel=0.6), t0)
mel = [('E5', 20.9), ('D5', 21.5), ('C5', 22.1), ('C5', 23.3), ('D5', 23.9), ('E5', 24.5), ('G5', 25.7), ('F5', 26.3), ('E5', 26.9),
       ('E5', 28.1), ('D5', 28.7), ('C5', 29.3), ('A5', 30.5), ('G5', 31.1), ('E5', 31.7)]
for n, t0 in mel: pn(n, t0, 0.5, 2.5, -0.1)
# low pulse (heartbeat-like) under the memories
for k in range(int((32.3 - 22.0) / 0.85)):
    add(mus, heartbeat(0.25 + 0.45 * k / 12), 22.0 + k * 0.85)
# string swell (bright pad) to the flash
add(mus, pad([hz('F3'), hz('A3'), hz('C4'), hz('E4')], 4.2, cutoff=2500, att=3.5, rel=0.05), 28.8)
# hard cut at 33 handled by gain curve
# 33-40.3: drone + sparse
add(mus, pad([hz('A1'), hz('E2')], 7.5, cutoff=300, att=1.0, rel=1.0), 33.0)
pn('C5', 36.1, 0.25, 3); pn('B4', 37.6, 0.22, 3); pn('A4', 39.0, 0.2, 2)
# 42.8-50: eerie return, then fade
add(mus, pad([hz('A2'), hz('Bb2'), hz('E3')], 7.5, cutoff=700, att=0.8, rel=4.0), 42.8)
chord(['A1', 'Bb1'], 42.85, 0.3, 4)
for i, n in enumerate(['E5', 'D5', 'C5', 'B4', 'A4']): pn(n, 45.2 + i * 1.05, 0.34 - i * 0.05, 3)
# 50-65 near silence
pn('A4', 62.5, 0.28, 6); pn('A3', 62.5, 0.18, 6)
add(mus, pad([hz('A3'), hz('E4')], 9, cutoff=400, att=4, rel=3), 54.0)
# 65-72: dawn resolution in C major
add(mus, pad([hz('C3'), hz('G3'), hz('E4')], 4.0, cutoff=1400, att=1.2, rel=1.5), 64.8)
add(mus, pad([hz('F2'), hz('C3'), hz('A3')], 3.5, cutoff=1400, att=1.0, rel=1.5), 67.4)
add(mus, pad([hz('C3'), hz('G3'), hz('E4')], 3.0, cutoff=1200, att=1.0, rel=2.5), 69.8)
chord(CM, 65.0, 0.35, 5); chord(FM, 67.4, 0.3, 5); chord(['C3', 'G3', 'E4', 'G4'], 69.8, 0.28, 5)
dawn = [('E5', 65.6), ('D5', 66.2), ('C5', 66.8), ('G4', 68.0), ('A4', 68.6), ('C5', 69.2), ('E5', 70.4), ('C6', 71.2)]
for n, t0 in dawn: pn(n, t0, 0.4, 3.5, 0.1)
pn('E5', 72.85, 0.15, 1.6)

mus_g = env_curve([(0, 0.8), (20.0, 0.85), (25, 1.0), (32.3, 1.25), (32.98, 1.25), (33.0, 0.0), (33.15, 0.55), (40.2, 0.5), (40.3, 0.0), (42.75, 0.0), (42.8, 0.8),
                   (44.5, 0.75), (50.0, 0.0), (54.0, 0.25), (61.5, 0.25), (62.4, 0.6), (64.6, 0.75), (65.0, 0.9), (71.5, 0.9), (72.6, 0.0), (72.8, 0.5), (DUR, 0.5)])
mus = reverb(mus, wet=0.38, sec=3.4, decay=2.2) * mus_g[:, None]
fx = reverb(fx, wet=0.18, sec=1.6, decay=4.0)
amb[:, :] = amb
mix = mus + fx + amb
# end fade
mix *= env_curve([(0, 1), (DUR - 0.25, 1), (DUR, 0)])[:, None]
mix = np.tanh(mix * 1.1) / 1.1
mix /= np.abs(mix).max() / 0.89
wavfile.write(sys.argv[2], SR, (mix * 32767).astype(np.int16))
print('ok', mix.shape, DUR)
