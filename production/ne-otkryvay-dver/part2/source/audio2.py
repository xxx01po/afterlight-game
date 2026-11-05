"""Procedural sound design + voice processing for «НЕ ОТКРЫВАЙ ДВЕРЬ». Writes stems + full mix (48 kHz stereo)."""
import numpy as np, wave, os, sys
from scipy import signal

SR = 48000
DUR = 32.0
N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'audio')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)

def T(n): return np.arange(n) / SR
def env_adsr(n, a=0.005, r=0.1):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def bp(x, lo, hi, order=4): return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=4): return signal.sosfilt(signal.butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=4): return signal.sosfilt(signal.butter(order, f, 'highpass', fs=SR, output='sos'), x)
def db(x): return 10 ** (x / 20)

def reverb_ir(sec=0.6, damp=6000, seed=1):
    r = np.random.default_rng(seed); n = int(sec * SR)
    ir = r.standard_normal(n) * np.exp(-np.linspace(0, 7, n)); ir = lp(ir, damp, 2); ir[0] = 1.0
    return ir / np.abs(ir).sum() * 6
def reverb(x, sec=0.6, wet=0.25, damp=6000, seed=1):
    y = signal.fftconvolve(x, reverb_ir(sec, damp, seed))[:len(x)]
    return x * (1 - wet) + y * wet

class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, x, t, gain=1.0, pan=0.0, itd_ms=0.0):
        i = int(t * SR); x = np.asarray(x) * gain
        if x.ndim == 2: l, r = x[0], x[1]
        else:
            gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            l, r = x * gl * 1.414, x * gr * 1.414
            if itd_ms:
                d = int(abs(itd_ms) * SR / 1000)
                if itd_ms > 0: r = np.concatenate([np.zeros(d), r])[:len(r)]
                else: l = np.concatenate([np.zeros(d), l])[:len(l)]
        n = max(0, min(len(l), N - i))
        if n <= 0 or i < 0: return
        self.L[i:i + n] += l[:n]; self.R[i:i + n] += r[:n]
    def st(self): return np.stack([self.L, self.R])

def read_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
        if w.getnchannels() == 2: x = x.reshape(-1, 2).mean(1)
    x = signal.resample_poly(x, SR, sr) if sr != SR else x
    # trim leading/trailing silence
    a = np.abs(x); th = a.max() * 0.02; idx = np.where(a > th)[0]
    x = x[max(0, idx[0] - 200): idx[-1] + 2400]
    return x / (np.abs(x).max() + 1e-9)
def write_wav(path, st):
    st = np.clip(st, -1, 1); d = (st.T * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())

def whisperize(x, amount=1.0, seed=3):
    f, t, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    r = np.random.default_rng(seed); mag = np.abs(Z)
    ph = np.angle(Z) * (1 - amount) + r.uniform(-np.pi, np.pi, Z.shape) * amount
    _, y = signal.istft(mag * np.exp(1j * ph), SR, nperseg=1024, noverlap=768)
    y = hp(y[:len(x)], 300, 2); return y / (np.abs(y).max() + 1e-9)
def phone_fx(x):
    y = bp(x, 320, 3400, 4)
    y = np.tanh(y * 2.2) / np.tanh(2.2)
    # sample-rate reduction (digital grit)
    hold = 4; y = np.repeat(y[::hold], hold)[:len(x)]
    y = bp(y, 300, 3600, 2)
    y *= 1 + 0.12 * np.sin(2 * np.pi * 7 * T(len(y)))
    return y / (np.abs(y).max() + 1e-9)
def behind_door(x):
    y = lp(x, 1800, 4); y = reverb(y, 0.5, 0.35, 3000, 5)
    return y / (np.abs(y).max() + 1e-9)
def stretch(x, rate):  # simple resample-based slow-down (also lowers pitch slightly)
    return signal.resample(x, int(len(x) / rate))

VO = os.path.join(HERE, 'vo')
voice, sfx, music = Bus(), Bus(), Bus()

def vibration(dur, seed=0):
    n = int(dur * SR); t = T(n)
    buzz = signal.square(2 * np.pi * 172 * t) * 0.5 + np.sin(2 * np.pi * 86 * t)
    rattle = bp(rng.standard_normal(n), 900, 3000) * (0.5 + 0.5 * signal.square(2 * np.pi * 86 * t))
    pattern = ((t % 0.5) < 0.36).astype(float)
    pattern = signal.sosfilt(signal.butter(2, 60, fs=SR, output='sos'), pattern)
    return lp(buzz * 0.6 + rattle * 0.5, 3500) * pattern * env_adsr(n, 0.01, 0.05)

def ding(f1=1318, f2=1760, gap=0.09):
    out = np.zeros(int(0.7 * SR))
    for k, f in enumerate([f1, f2]):
        n = int(0.5 * SR); t = T(n); tone = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 9)
        i = int(k * gap * SR); out[i:i + n] += tone[:len(out) - i]
    return out / np.abs(out).max()

def knock(heavy=1.0, seed=0):
    r = np.random.default_rng(seed); n = int(0.5 * SR); t = T(n)
    f = 95 * (1 + 0.6 * np.exp(-t * 40))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22)
    crack = bp(r.standard_normal(n), 300, 2500) * np.exp(-t * 70)
    x = body * 1.0 + crack * 0.8 * heavy
    return reverb(x, 0.45, 0.3, 4000, seed) / 1.0

def step(seed, soft=1.0):
    r = np.random.default_rng(seed); n = int(0.25 * SR); t = T(n)
    x = lp(r.standard_normal(n), 900) * np.exp(-t * 35) + 0.6 * np.sin(2 * np.pi * 70 * t) * np.exp(-t * 30)
    return reverb(x * soft, 0.35, 0.2, 3000, seed)

def creak(dur=0.9, f0=170, seed=0):
    r = np.random.default_rng(seed); n = int(dur * SR); t = T(n)
    f = f0 * (1 + 0.25 * np.sin(2 * np.pi * 1.3 * t) + 0.04 * r.standard_normal(n).cumsum() / np.sqrt(n))
    saw = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR)
    jitter = (r.random(n) < 0.002).astype(float); jitter = lp(jitter, 200, 2) * 30
    x = bp(saw * (0.5 + jitter), 200, 2500) * env_adsr(n, 0.08, 0.3)
    return reverb(x, 0.5, 0.25, 3500, seed)

def rattle(dur=1.4, seed=4):  # door handle
    r = np.random.default_rng(seed); n = int(dur * SR); t = T(n)
    clicks = np.zeros(n)
    for c in np.cumsum(r.uniform(0.06, 0.16, 30)):
        i = int(c * SR)
        if i < n - 2000: clicks[i:i + 2000] += np.exp(-np.arange(2000) / 120) * r.uniform(0.5, 1)
    x = bp(clicks * r.standard_normal(n), 1500, 7000) + 0.3 * bp(clicks, 400, 1200)
    return reverb(x * env_adsr(n, 0.05, 0.2), 0.4, 0.3, 5000, seed)

def breath(dur, f=(500, 1800), seed=0, shake=0.0):
    r = np.random.default_rng(seed); n = int(dur * SR); t = T(n)
    x = bp(r.standard_normal(n), *f) * np.sin(np.pi * t / dur) ** 1.5
    if shake: x *= 1 + shake * np.sin(2 * np.pi * 9 * t)
    return x

def whoosh(dur=0.45, seed=5):
    n = int(dur * SR); t = T(n); x = rng.standard_normal(n)
    sos_f = np.linspace(300, 3000, n)
    y = np.zeros(n)
    for k in range(0, n, 512):
        y[k:k + 512] = bp(x[k:k + 512 + 0], max(100, sos_f[k] * 0.6), sos_f[k] * 1.6, 2)[:len(y[k:k + 512])]
    return y * np.sin(np.pi * t / dur) ** 2

def glitch(dur=0.25, seed=6):
    r = np.random.default_rng(seed); n = int(dur * SR)
    x = signal.square(2 * np.pi * r.choice([220, 440, 880, 1760]) * T(n)) * (r.random(n // 600 + 1).repeat(600)[:n] > 0.5)
    return hp(x, 400) * 0.6 + bp(r.standard_normal(n), 2000, 8000) * 0.3

def glass_crack(seed, size=1.0):
    r = np.random.default_rng(seed); n = int(0.9 * SR); t = T(n)
    clicks = np.zeros(n); c = 0.0
    while c < 0.35 * size:
        i = int(c * SR); L = 600; clicks[i:i + L] += r.uniform(0.3, 1) * np.exp(-np.arange(L) / 40) * r.choice([-1, 1]); c += r.exponential(0.012)
    x = hp(clicks, 1800) + 0.5 * bp(clicks, 400, 1500)
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(2350, 9), (3710, 12), (5120, 15)]) * 0.05
    return reverb(x + ring, 0.8, 0.3, 9000, seed)

def ringtone(dur=1.25):
    out = np.zeros(int(dur * SR)); notes = [(0, 988), (0.15, 1319), (0.3, 1175), (0.45, 1568), (0.75, 988), (0.9, 1319), (1.05, 1175)]
    for s, f in notes:
        n = int(0.28 * SR); t = T(n); tone = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 30)) * np.exp(-t * 11)
        i = int(s * SR); out[i:i + n] += tone[:max(0, len(out) - i)]
    return out / np.abs(out).max()

def click(): n = int(0.05 * SR); return hp(rng.standard_normal(n), 2000) * np.exp(-T(n) * 120)

def sting():
    n = int(2.2 * SR); tt = T(n)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 1.8)
    clus = sum(np.sin(2 * np.pi * f * tt) for f in [311, 329.6, 349, 466, 493.9]) * np.exp(-tt * 1.5) * 0.25
    hit = bp(rng.standard_normal(n), 100, 4000) * np.exp(-tt * 12)
    return reverb(boom + clus + hit * 0.6, 1.4, 0.35, 5000, 77)

voice, sfx, music = Bus(), Bus(), Bus()

# ================= PART 2 =================
K = [(0, -1.3), (3.2, 3.4), (7.0, 7.6), (11.5, 15.1), (11.9, 16.65), (14.9, 19.65), (19.0, 23.6), (22.5, 25.0), (24.3, 26.75), (25.5, 27.9)]
def t2_of(t1):  # inverse of the video's part-2 -> part-1 time map
    for (a, x), (b, y) in zip(K, K[1:]):
        if x <= t1 <= y: return a + (b - a) * (t1 - x) / (y - x)
    return None
def glass(x): y = lp(x, 900, 4); y = reverb(y, 0.6, 0.4, 1500, 8); return y / (np.abs(y).max() + 1e-9)
def double_voice(x):
    y = signal.resample(x, int(len(x) * 1.05))           # ~4% lower, slower
    d = int(0.013 * SR); y2 = np.concatenate([np.zeros(d), y])[:len(y)] * 0.3   # faint doubling
    y = reverb(y + y2, 0.5, 0.18, 4000, 21); return y / (np.abs(y).max() + 1e-9)

voice, sfx, music = Bus(), Bus(), Bus()
VO = os.path.join(HERE, 'vo')
for f, t, g in [('p2_l1', 0.25, -2), ('p2_l2', 3.4, -2), ('p2_l3', 7.3, -2), ('v5_phone', 11.9, -2), ('p2_l5', 16.2, -3), ('v6_call', 24.35, -2)]:
    voice.add(double_voice(read_wav(f'{VO}/{f}.wav')), t, db(g), pan=-0.05)
w = whisperize(stretch(read_wav(f'{VO}/v7_whisper.wav'), 0.92), 1.0, seed=9)
voice.add(w, 27.5, db(-3), pan=-0.85, itd_ms=0.65)

# the real room heard through the glass (same events as Part 1)
for i, k in enumerate([3.45, 3.75, 4.05]): sfx.add(glass(knock(1.0, i)), t2_of(k), db(-12), pan=-0.1)
for i, k in enumerate([11.9, 12.5, 13.1, 13.6, 14.05, 14.45, 14.8, 15.1]): sfx.add(glass(knock(0.8, 10 + i)), t2_of(k), db(-17), pan=-0.1)
sfx.add(glass(read_wav(f'{VO}/v2_mom1.wav')), t2_of(4.45), db(-15), pan=-0.1)
sfx.add(glass(read_wav(f'{VO}/m_2.0.wav')), t2_of(7.0), db(-20))
sfx.add(glass(read_wav(f'{VO}/v4_mom2.wav')), t2_of(9.45), db(-15), pan=-0.1)

def tap(seed):
    r = np.random.default_rng(seed); n = int(0.03 * SR); return hp(r.standard_normal(n), 2500) * np.exp(-T(n) * 260)
def typing(t0, t1, seed=0):
    r = np.random.default_rng(seed); t = t0
    while t < t1: sfx.add(tap(int(t * 1000)), t, db(-24), pan=0.15); t += r.uniform(0.045, 0.11)
typing(0.1, 0.95, 1); typing(6.2, 6.9, 2); typing(30.5, 32.0, 3)
def send():
    n = int(0.25 * SR); t = T(n); f = np.linspace(600, 1800, n); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
for t in [1.05, 7.0, 9.3]: sfx.add(send(), t, db(-18), pan=0.15)
sfx.add(ding(1568, 2093, 0.05), 11.85, db(-20))                         # voice-record start
def ticks():  # the 3:17 clock motif
    n = int(0.02 * SR); return bp(rng.standard_normal(n), 2500, 6000) * np.exp(-T(n) * 300)
for t in np.arange(0.5, 27.2, 1.0): sfx.add(ticks(), t, db(-30), pan=0.4)
for i, s in enumerate(np.arange(20.35, 22.4, 0.7)): sfx.add(knock(0.3, 400 + i) * 0.6, s, db(-15))  # figure steps
for i, (s, g) in enumerate([(17.38, -5), (17.73, -7), (18.03, -6), (18.35, -11)]): sfx.add(glass_crack(300 + i), s, db(g), pan=0.1 * (i - 1.5))
def dial():
    o = np.zeros(int(1.1 * SR))
    for s in [0.0, 0.55]:
        n = int(0.4 * SR); t = T(n); i = int(s * SR); o[i:i + n] += (np.sin(2 * np.pi * 425 * t)) * env_adsr(n, 0.01, 0.02)
    return o
sfx.add(bp(dial(), 300, 3400), 22.6, db(-20), pan=0.3); sfx.add(click(), 23.7, db(-16), pan=0.3)
sfx.add(creak(1.4, 120, 9), 25.6, db(-12), pan=-0.1)                   # the real door opens by itself
hall = lp(rng.standard_normal(int(1.6 * SR)), 300) * np.linspace(0, 1, int(1.6 * SR)); sfx.add(hall, 25.6, db(-20))
for i, s in enumerate([28.85, 29.25, 29.65, 30.05]): sfx.add(glass(knock(1.0, 500 + i)), s, db(-9))   # palms on the glass
rt = lp(rng.standard_normal(N), 400) * 0.08; rt[int(27.2 * SR):int(28.6 * SR)] = 0; sfx.add(rt, 0, db(-15))

# music: lower mirror-world drone with reverse swells; dead silence on black; returns for the swap
t = T(N)
inten = np.interp(t, [0, 7, 11.5, 14.9, 15.5, 17.3, 22.5, 27.19, 27.2, 28.6, 28.61, 32], [0.3, 0.45, 0.55, 0.5, 0.9, 1.0, 0.75, 0.9, 0, 0, 0.8, 1.0])
drone = np.sin(2 * np.pi * 49 * t) + 0.7 * np.sin(2 * np.pi * 51.6 * t) + 0.3 * np.sin(2 * np.pi * 98.3 * t + np.sin(2 * np.pi * 0.17 * t))
swell = np.zeros(N)
for s0 in [3.2, 9.0, 13.0, 22.5]:   # reverse-reverb style swells that cut off
    n = int(1.8 * SR); tt = T(n); i = int(s0 * SR - n); sw = bp(rng.standard_normal(n), 300, 3000) * (tt / 1.8) ** 3
    swell[max(0, i):i + n] += sw[-(min(n, i + n)):] if i < 0 else sw
music.add((drone * 0.35 + swell * 0.5) * inten, 0, db(-17))
music.add(sting(), 14.95, db(-6))
n = int(1.6 * SR); tt = T(n); music.add(np.sin(2 * np.pi * 32 * tt) * np.exp(-tt * 2.2), 27.2, db(-9))
music.add(sting(), 28.6, db(-9))

V, S, Mu = voice.st(), sfx.st(), music.st()
venv = np.abs(V).mean(0); venv = signal.sosfilt(signal.butter(2, 6, fs=SR, output='sos'), venv)
duck = 1 - 0.45 * np.clip(venv / (venv.max() * 0.25 + 1e-9), 0, 1)
mix = V * 1.8 + S * (0.6 + 0.4 * duck) + Mu * duck
mix[:, int(31.98 * SR):] = 0   # hard cut on the last keystroke
peak = np.abs(mix).max(); mix = mix / peak * 0.89
for name, st in [('stem_voice', V * 1.8), ('stem_sfx', S), ('stem_music', Mu)]: write_wav(os.path.join(OUT, name + '.wav'), st / peak * 0.89)
write_wav(os.path.join(OUT, 'mix.wav'), mix)
print('ok', OUT)
