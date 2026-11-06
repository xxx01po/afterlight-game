"""Procedural sound design + voice processing for «НЕ ОТКРЫВАЙ ДВЕРЬ». Writes stems + full mix (48 kHz stereo)."""
import numpy as np, wave, os, sys
from scipy import signal

SR = 48000
DUR = 34.8
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

import json
VOT = {v["id"]: v for v in json.load(open(os.path.join(HERE, "timeline_vo.json")))}
vo = lambda k: VOT[k]
voice, sfx, music = Bus(), Bus(), Bus()
def comp(x, thr=0.25, ratio=3.0):
    e = signal.sosfilt(signal.butter(2, 30, fs=SR, output='sos'), np.abs(x)) + 1e-6
    g = np.where(e > thr, (thr + (e - thr) / ratio) / e, 1.0); return x * g
def load_vo(k):
    x, sr = sf.read(os.path.join(HERE, 'vo', 'proc', k + '.wav')); x = x.mean(1) if x.ndim > 1 else x
    if sr != SR: x = signal.resample_poly(x, SR, sr)
    x = hp(x, 90, 2); x = comp(x / (np.abs(x).max() + 1e-9)); return x / (np.abs(x).max() + 1e-9)
import soundfile as sf
pans = {'F': 0.0, 'C': -0.1, 'P': 0.15}
for k, v in VOT.items():
    x = load_vo(k)
    if k == 'C3': x = reverb(x, 0.6, 0.18, 6000, 3)
    voice.add(x, v["t0"], db(-3 if k in ('C3', 'F4', 'F6', 'F7') else -4), pan=pans[k[0]])

# ---------- SFX ----------
def plus(a, b):
    o = np.zeros(max(len(a), len(b))); o[:len(a)] += a; o[:len(b)] += b; return o
def tone(f, dur, decay=6, kind='sin'):
    n = int(dur * SR); t = T(n); ph = 2 * np.pi * np.cumsum(np.full(n, f) if np.isscalar(f) else f) / SR
    w = np.sin(ph) if kind == 'sin' else signal.square(ph) * 0.5 if kind == 'sq' else signal.sawtooth(ph) * 0.5
    return w * np.exp(-t * decay)
def chime(): return np.concatenate([tone(1318, 0.45, 5) + 0.3 * tone(2636, 0.45, 8), np.zeros(1)])[:int(0.45 * SR)] , tone(1047, 0.8, 4) + 0.3 * tone(2094, 0.8, 7)
a, b = chime(); sfx.add(a, 3.9, db(-14)); sfx.add(b, 4.12, db(-14))
def stepc(i):
    x = step(i) * 0.7; c = hp(rng.standard_normal(1200), 3000) * np.exp(-T(1200) * 200) * 0.3; x[:1200] += c; return x
for i, s in enumerate(np.arange(4.0, 5.55, 0.33)): sfx.add(stepc(10 + i), s, db(-20))
def kaching():
    n = int(0.9 * SR); t = T(n); drawer = bp(rng.standard_normal(int(0.25 * SR)), 300, 3000) * np.linspace(1, 0, int(0.25 * SR))
    bell = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(2637, 4), (3951, 5), (5274, 7)]); out = bell * 0.5; out[:len(drawer)] += drawer * 0.8; return out
sfx.add(kaching(), 8.05, db(-8))
def slide_down(dur=0.9):  # comedic slide whistle falling
    n = int(dur * SR); t = T(n); f = 1800 * np.exp(-t * 2.2) + 300; f *= 1 + 0.02 * np.sin(2 * np.pi * 7 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 0.5
sfx.add(slide_down(), 8.25, db(-13))
def crickets(dur):
    n = int(dur * SR); t = T(n); env = ((t * 14) % 1 < 0.35).astype(float) * ((t * 1.6) % 1 < 0.55)
    env = signal.sosfilt(signal.butter(2, 120, fs=SR, output='sos'), env); return np.sin(2 * np.pi * 4300 * t) * env
sfx.add(crickets(0.95), vo('C2')["t1"] + 0.03, db(-24), pan=0.3)
def boom(dur=1.6, f0=55):
    n = int(dur * SR); t = T(n); f = f0 + 120 * np.exp(-t * 18); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    x += lp(rng.standard_normal(n), 400) * np.exp(-t * 14) * 0.6; return reverb(np.tanh(x * 1.8), 1.0, 0.25, 3000, 5)
sfx.add(boom(1.2, 60), vo('F3')["t0"] + 1.95, db(-12))   # "...квартиру?" punch
sfx.add(plus(knock(1.2, 31), bp(rng.standard_normal(2000), 2000, 6000) * np.exp(-T(2000) * 120) * 0.5), vo('F3')["t1"] + 0.12, db(-6))  # button slam
def siren(dur):
    n = int(dur * SR); t = T(n); f = np.where((t * 1.6) % 1 < 0.5, 960, 770); f = signal.sosfilt(signal.butter(1, 15, fs=SR, output='sos'), f.astype(float))
    x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * 0.5; x = bp(x, 400, 4000); return reverb(x, 0.5, 0.2, 5000, 9)
ss = vo('F3')["t1"] + 0.3; sr_ = siren(20.4 - ss) * np.interp(np.arange(int((20.4 - ss) * SR)) / SR, [0, 0.1, 5.4, 5.9, 6.1], [0, 1, 1, 0.45, 0.25]); sfx.add(sr_, ss, db(-17))
sfx.add(knock(1.6, 41), ss + 0.05, db(-7)); sfx.add(knock(1.4, 42), ss + 0.12, db(-9))   # kitchen doors bang
for i, s in enumerate(np.arange(ss + 0.15, vo('F4')["t1"], 0.19)): sfx.add(lp(knock(0.4, 50 + i), 600), s, db(-12 - (i % 3)), pan=0.3 * np.sin(i))  # chef stomps
for i, s in enumerate(np.arange(vo('F4')["t1"], 20.75, 0.14)):
    if 18.0 <= s <= 18.5 or 19.15 <= s <= 19.95: continue
    sfx.add(step(80 + i), s, db(-17), pan=0.15 * (-1) ** i)
def whoosh2(dur=0.4):
    n = int(dur * SR); t = T(n); x = rng.standard_normal(n); y = np.zeros(n); fc = np.linspace(500, 3500, n)
    for k in range(0, n, 480): y[k:k + 480] = bp(x[k:k + 480], fc[k] * 0.5, min(fc[k] * 1.8, 20000), 2)[:len(y[k:k + 480])]
    return y * np.sin(np.pi * t / dur) ** 2
sfx.add(whoosh2(0.45), 17.95, db(-11)); sfx.add(lp(knock(1.0, 61), 900), 18.47, db(-8))   # jump + landing
def crash(seed, dur=0.6):
    r = np.random.default_rng(seed); n = int(dur * SR); out = np.zeros(n); c = 0.0
    while c < dur * 0.7: i = int(c * SR); L = 2400; out[i:i + L] += bp(r.standard_normal(L), 200, 2500) * np.exp(-np.arange(L) / 260) * r.uniform(0.4, 1); c += r.exponential(0.05)
    return reverb(out, 0.5, 0.25, 4000, seed)
for i, s in enumerate([18.58, 18.7, 18.82, 18.95]): sfx.add(crash(70 + i), s, db(-8), pan=0.3 * (i - 1.5))
sfx.add(whoosh2(0.8), 19.15, db(-9))
def clang(seed):
    n = int(0.9 * SR); t = T(n); r = np.random.default_rng(seed); x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(r.uniform(700, 900), 6), (r.uniform(1900, 2300), 9), (r.uniform(3300, 3900), 12)]); return x * 0.4 + hp(r.standard_normal(n), 3000) * np.exp(-t * 60) * 0.4
for i, s in enumerate(np.linspace(19.35, 19.9, 6)): sfx.add(clang(90 + i), s, db(-14), pan=0.2 * (i - 2.5))
sfx.add(knock(1.6, 99), 19.95, db(-7))   # side door burst
sfx.add(whoosh2(0.5), 20.8, db(-11)); sfx.add(lp(knock(0.8, 101), 500), 21.32, db(-10))
def engine(dur, rpm0, rpm1):
    n = int(dur * SR); t = T(n); f = np.linspace(rpm0, rpm1, n); x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 0.5) / SR)
    return lp(x, 900) * (1 + 0.25 * np.sin(2 * np.pi * np.cumsum(f / 4) / SR))
L_ = vo('F6')["t1"]
crank = engine(0.5, 18, 24) * (0.6 + 0.4 * ((T(int(0.5 * SR)) * 12) % 1 < 0.5)); sfx.add(crank, L_ - 0.55, db(-14))
sfx.add(engine(0.9, 45, 140) * np.linspace(1, 0.2, int(0.9 * SR)), L_, db(-7))
def screech(dur):
    n = int(dur * SR); t = T(n); f = 2600 + 300 * np.sin(2 * np.pi * 3 * t); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * rng.random(n)); return bp(x, 1500, 5000) * np.sin(np.pi * t / dur) ** 0.4
sfx.add(screech(0.6), L_, db(-15)); sfx.add(screech(0.75), 26.65, db(-12))
sfx.add(engine(0.7, 120, 40), 26.65, db(-12))
def scratch():
    n = int(0.45 * SR); t = T(n); f = 300 + 900 * np.abs(np.sin(2 * np.pi * 3.2 * t)); return bp(rng.standard_normal(n) * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR), 200, 4000) * np.sin(np.pi * t / 0.45)
sfx.add(scratch(), 27.33, db(-10))
pop = vo('P2')["t1"] + 0.04
sfx.add(tone(880, 0.12, 4, 'sq') , pop, db(-16)); sfx.add(tone(660, 0.12, 4, 'sq'), pop + 0.13, db(-16)); sfx.add(tone(440, 0.25, 4, 'sq'), pop + 0.26, db(-16))
def trombone():  # wah wah wah waaah
    out = np.zeros(int(1.4 * SR))
    for i, (f, d) in enumerate([(311, 0.24), (294, 0.24), (277, 0.24), (262, 0.55)]):
        n = int(d * SR); t = T(n); vib = 1 + (0.03 * np.sin(2 * np.pi * 6 * t) if i == 3 else 0); ff = f * vib * (1 - (0.04 * t if i == 3 else 0))
        x = signal.sawtooth(2 * np.pi * np.cumsum(ff) / SR) * np.sin(np.pi * np.minimum(t / d, 1)) ** 0.6; x = lp(x, 1800); s0 = int(sum([0.26, 0.26, 0.26][:i]) * SR); out[s0:s0 + n] += x[:len(out) - s0]
    return out
sfx.add(trombone(), pop + 0.05, db(-12))
sfx.add(boom(1.6, 48), vo('F8')["t1"] + 0.02, db(-4)); sfx.add(whoosh2(0.3), vo('F8')["t1"] - 0.25, db(-12))

# ---------- MUSIC ----------
t = T(N)
def drums(bpm, t0, t1, hats=True, gain=1.0):
    beat = 60 / bpm; s = t0; i = 0
    while s < t1:
        k = int(0.25 * SR); tt = T(k)
        if i % 4 in (0, 2): music.add(np.sin(2 * np.pi * np.cumsum(50 + 110 * np.exp(-tt * 35)) / SR) * np.exp(-tt * 9) * gain, s, db(-6))
        if i % 4 in (1, 3): music.add(bp(rng.standard_normal(k), 900, 6000) * np.exp(-tt * 22) * 0.8 * gain + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 25) * 0.5 * gain, s, db(-10))
        if hats: music.add(hp(rng.standard_normal(int(0.05 * SR)), 7000) * np.exp(-T(int(0.05 * SR)) * 90) * gain, s + beat / 2, db(-20))
        s += beat; i += 1
def bassline(bpm, t0, t1, notes, gain=1.0, wave='sq'):
    beat = 60 / bpm; s = t0; i = 0
    while s < t1:
        f = notes[i % len(notes)]; d = beat * 0.9; n = int(d * SR); tt = T(n)
        x = (signal.square(2 * np.pi * f * tt) if wave == 'sq' else signal.sawtooth(2 * np.pi * f * tt)) * np.exp(-tt * 3)
        music.add(lp(x, 700) * gain, s, db(-14)); s += beat / 2 if wave == 'saw' else beat; i += 1
def lead(bpm, t0, t1, mel, gain=1.0):
    beat = 60 / bpm; s = t0; i = 0
    while s < t1:
        f = mel[i % len(mel)]
        if f: n = int(beat * 0.45 * SR); tt = T(n); music.add((signal.square(2 * np.pi * f * tt, 0.25) * 0.5) * np.exp(-tt * 9) * gain, s, db(-20))
        s += beat / 2; i += 1
cut = vo('C2')["t1"]
# chill groove (C major, 112 bpm), dead stop on the comedic pause
drums(112, 0.0, cut, gain=0.8); bassline(112, 0.0, cut, [65.4, 65.4, 98, 87.3, 73.4, 73.4, 98, 82.4], 0.9); lead(112, 0.0, cut, [523, 0, 659, 0, 784, 659, 0, 587, 523, 0, 440, 0, 494, 523, 0, 0])
# resumes softly for "Брат..."
bassline(112, vo('F3')["t0"], ss - 0.05, [65.4, 98, 87.3, 98], 0.6)
# chase (A minor, 168 bpm)
drums(168, ss + 0.1, L_ + 0.85, gain=1.1); bassline(168, ss + 0.1, L_ + 0.85, [110, 110, 130.8, 110, 146.8, 110, 164.8, 155.6], 1.0, 'saw')
lead(168, ss + 0.1, L_ + 0.85, [880, 0, 880, 1046, 0, 988, 880, 0, 784, 0, 880, 0, 659, 698, 784, 0])
# awkward return groove, stops for the popup
drums(100, 27.6, pop, hats=False, gain=0.6); bassline(100, 27.6, pop, [55, 55, 61.7, 65.4], 0.7)

V_, S_, Mu = voice.st(), sfx.st(), music.st()
venv = np.abs(V_).mean(0); venv = signal.sosfilt(signal.butter(2, 6, fs=SR, output='sos'), venv)
duck = 1 - 0.55 * np.clip(venv / (venv.max() * 0.2 + 1e-9), 0, 1)
mix = V_ * 1.9 + S_ * (0.65 + 0.35 * duck) + Mu * duck * 0.9
peak = np.abs(mix).max(); mix = mix / peak * 0.89
for name, st in [('stem_voice', V_ * 1.9), ('stem_sfx', S_), ('stem_music', Mu * 0.9)]: write_wav(os.path.join(OUT, name + '.wav'), st / peak * 0.89)
write_wav(os.path.join(OUT, 'mix.wav'), mix); print('ok')
