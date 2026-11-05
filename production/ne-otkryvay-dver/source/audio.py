"""Procedural sound design + voice processing for «НЕ ОТКРЫВАЙ ДВЕРЬ». Writes stems + full mix (48 kHz stereo)."""
import numpy as np, wave, os, sys
from scipy import signal

SR = 48000
DUR = 30.0
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

# ---------------- VOICES ----------------
v1 = read_wav(f'{VO}/v1_narr.wav'); voice.add(reverb(v1, 0.3, 0.08), 0.20, db(-1))
v2 = behind_door(read_wav(f'{VO}/v2_mom1.wav')); voice.add(v2, 4.45, db(-6), pan=-0.15)
m = read_wav(f'{VO}/m_2.0.wav'); m = stretch(m, 0.85); mw = 0.45 * m / np.abs(m).max() + 0.75 * whisperize(m, 1.0)
voice.add(mw / np.abs(mw).max(), 7.0, db(-10))
v4 = behind_door(read_wav(f'{VO}/v4_mom2.wav')); voice.add(v4 * np.linspace(0.85, 1.15, len(v4)), 9.45, db(-4.5), pan=-0.15)
v5 = phone_fx(read_wav(f'{VO}/v5_phone.wav')); voice.add(v5, 16.65, db(-5), pan=0.1)
v6 = phone_fx(read_wav(f'{VO}/v6_call.wav')); voice.add(v6, 26.75, db(-4), pan=0.35)
w = read_wav(f'{VO}/v7_whisper.wav'); w = stretch(w, 0.92); w = whisperize(w, 1.0, seed=9)
w = w * np.exp(-0.0 * T(len(w)))
voice.add(w, 28.55, db(-3), pan=-0.85, itd_ms=0.65)   # right behind the left ear

# ---------------- SFX ----------------
def vibration(dur, seed=0):
    n = int(dur * SR); t = T(n)
    buzz = signal.square(2 * np.pi * 172 * t) * 0.5 + np.sin(2 * np.pi * 86 * t)
    rattle = bp(rng.standard_normal(n), 900, 3000) * (0.5 + 0.5 * signal.square(2 * np.pi * 86 * t))
    pattern = ((t % 0.5) < 0.36).astype(float)
    pattern = signal.sosfilt(signal.butter(2, 60, fs=SR, output='sos'), pattern)
    return lp(buzz * 0.6 + rattle * 0.5, 3500) * pattern * env_adsr(n, 0.01, 0.05)
sfx.add(vibration(0.85), 0.0, db(-10), pan=0.3)
sfx.add(vibration(0.85), 7.45, db(-12), pan=0.2)
sfx.add(vibration(0.35), 12.0, db(-14), pan=0.2)
sfx.add(vibration(1.25), 25.0, db(-13), pan=0.3)

def ding(f1=1318, f2=1760, gap=0.09):
    out = np.zeros(int(0.7 * SR))
    for k, f in enumerate([f1, f2]):
        n = int(0.5 * SR); t = T(n); tone = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 9)
        i = int(k * gap * SR); out[i:i + n] += tone[:len(out) - i]
    return out / np.abs(out).max()
sfx.add(ding(), 0.12, db(-14), pan=0.25)
sfx.add(ding(1174, 1568), 7.55, db(-14), pan=0.2)
sfx.add(ding(880, 1318, 0.06), 12.0, db(-16), pan=0.2)

def knock(heavy=1.0, seed=0):
    r = np.random.default_rng(seed); n = int(0.5 * SR); t = T(n)
    f = 95 * (1 + 0.6 * np.exp(-t * 40))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22)
    crack = bp(r.standard_normal(n), 300, 2500) * np.exp(-t * 70)
    x = body * 1.0 + crack * 0.8 * heavy
    return reverb(x, 0.45, 0.3, 4000, seed) / 1.0
for i, k in enumerate([3.45, 3.75, 4.05]): sfx.add(knock(1.0, i), k, db(-4), pan=-0.2)
for i, k in enumerate([11.9, 12.5, 13.1, 13.6, 14.05, 14.45, 14.8, 15.1]): sfx.add(knock(0.8, 10 + i), k, db(-9 + i * 0.6), pan=-0.2)

def step(seed, soft=1.0):
    r = np.random.default_rng(seed); n = int(0.25 * SR); t = T(n)
    x = lp(r.standard_normal(n), 900) * np.exp(-t * 35) + 0.6 * np.sin(2 * np.pi * 70 * t) * np.exp(-t * 30)
    return reverb(x * soft, 0.35, 0.2, 3000, seed)
for i, s in enumerate(np.arange(5.5, 6.95, 0.38)): sfx.add(step(100 + i), s, db(-15), pan=0.2 * (-1) ** i)
for i, s in enumerate(np.arange(9.6, 12.3, 0.62)): sfx.add(step(200 + i, 0.8), s, db(-17), pan=0.15 * (-1) ** i)

def creak(dur=0.9, f0=170, seed=0):
    r = np.random.default_rng(seed); n = int(dur * SR); t = T(n)
    f = f0 * (1 + 0.25 * np.sin(2 * np.pi * 1.3 * t) + 0.04 * r.standard_normal(n).cumsum() / np.sqrt(n))
    saw = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR)
    jitter = (r.random(n) < 0.002).astype(float); jitter = lp(jitter, 200, 2) * 30
    x = bp(saw * (0.5 + jitter), 200, 2500) * env_adsr(n, 0.08, 0.3)
    return reverb(x, 0.5, 0.25, 3500, seed)
sfx.add(creak(0.8, 160, 1), 4.7, db(-24), pan=0.3)        # chair as he stands
sfx.add(creak(1.1, 140, 2), 9.7, db(-21), pan=0.0)         # floorboard while backing away
def rattle(dur=1.4, seed=4):  # door handle
    r = np.random.default_rng(seed); n = int(dur * SR); t = T(n)
    clicks = np.zeros(n)
    for c in np.cumsum(r.uniform(0.06, 0.16, 30)):
        i = int(c * SR)
        if i < n - 2000: clicks[i:i + 2000] += np.exp(-np.arange(2000) / 120) * r.uniform(0.5, 1)
    x = bp(clicks * r.standard_normal(n), 1500, 7000) + 0.3 * bp(clicks, 400, 1200)
    return reverb(x * env_adsr(n, 0.05, 0.2), 0.4, 0.3, 5000, seed)
sfx.add(rattle(1.4), 10.6, db(-15), pan=-0.2)

def breath(dur, f=(500, 1800), seed=0, shake=0.0):
    r = np.random.default_rng(seed); n = int(dur * SR); t = T(n)
    x = bp(r.standard_normal(n), *f) * np.sin(np.pi * t / dur) ** 1.5
    if shake: x *= 1 + shake * np.sin(2 * np.pi * 9 * t)
    return x
for i, (s, d) in enumerate([(8.45, 0.55), (9.05, 0.4)]): sfx.add(breath(d, seed=i), s, db(-20))
sfx.add(breath(0.45, (700, 3000), 7), 15.12, db(-13))                         # gasp on the turn
for i, s in enumerate(np.arange(19.7, 22.0, 0.6)): sfx.add(breath(0.42, (500, 2000), 20 + i, 0.6), s, db(-21))
sfx.add(breath(0.35, (700, 2800), 40), 26.35, db(-19))

def whoosh(dur=0.45, seed=5):
    n = int(dur * SR); t = T(n); x = rng.standard_normal(n)
    sos_f = np.linspace(300, 3000, n)
    y = np.zeros(n)
    for k in range(0, n, 512):
        y[k:k + 512] = bp(x[k:k + 512 + 0], max(100, sos_f[k] * 0.6), sos_f[k] * 1.6, 2)[:len(y[k:k + 512])]
    return y * np.sin(np.pi * t / dur) ** 2
sfx.add(whoosh(), 15.05, db(-12), pan=0.0)

def glitch(dur=0.25, seed=6):
    r = np.random.default_rng(seed); n = int(dur * SR)
    x = signal.square(2 * np.pi * r.choice([220, 440, 880, 1760]) * T(n)) * (r.random(n // 600 + 1).repeat(600)[:n] > 0.5)
    return hp(x, 400) * 0.6 + bp(r.standard_normal(n), 2000, 8000) * 0.3
sfx.add(glitch(0.18, 1), 12.88, db(-20)); sfx.add(glitch(0.3, 2), 14.55, db(-17)); sfx.add(glitch(0.2, 3), 15.05, db(-19))

def glass_crack(seed, size=1.0):
    r = np.random.default_rng(seed); n = int(0.9 * SR); t = T(n)
    clicks = np.zeros(n); c = 0.0
    while c < 0.35 * size:
        i = int(c * SR); L = 600; clicks[i:i + L] += r.uniform(0.3, 1) * np.exp(-np.arange(L) / 40) * r.choice([-1, 1]); c += r.exponential(0.012)
    x = hp(clicks, 1800) + 0.5 * bp(clicks, 400, 1500)
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(2350, 9), (3710, 12), (5120, 15)]) * 0.05
    return reverb(x + ring, 0.8, 0.3, 9000, seed)
for i, (s, g) in enumerate([(22.08, -4), (22.43, -6), (22.73, -5), (23.05, -10)]): sfx.add(glass_crack(300 + i), s, db(g), pan=0.1 * (i - 1.5))

def ringtone(dur=1.25):
    out = np.zeros(int(dur * SR)); notes = [(0, 988), (0.15, 1319), (0.3, 1175), (0.45, 1568), (0.75, 988), (0.9, 1319), (1.05, 1175)]
    for s, f in notes:
        n = int(0.28 * SR); t = T(n); tone = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 30)) * np.exp(-t * 11)
        i = int(s * SR); out[i:i + n] += tone[:max(0, len(out) - i)]
    return out / np.abs(out).max()
sfx.add(ringtone(), 25.0, db(-9), pan=0.3)
def click(): n = int(0.05 * SR); return hp(rng.standard_normal(n), 2000) * np.exp(-T(n) * 120)
sfx.add(click(), 26.3, db(-14), pan=0.3)

# room tone (stops dead on the black cut)
rt = lp(rng.standard_normal(N), 400) * 0.08 + 0.015 * np.sin(2 * np.pi * 50 * T(N))
rt[int(28.0 * SR):] = 0
sfx.add(rt, 0, db(-14))

# ---------------- MUSIC / DRONE ----------------
t = T(N)
intensity = np.interp(t, [0, 3.4, 8.0, 9.4, 12.5, 15.1, 16.5, 20.5, 22, 25, 28.0, 28.0001, 30], [0.25, 0.35, 0.45, 0.3, 0.6, 0.75, 0.45, 0.8, 1.0, 0.7, 0.9, 0, 0])
drone = (np.sin(2 * np.pi * 55 * t) + 0.7 * np.sin(2 * np.pi * 58.3 * t) + 0.35 * np.sin(2 * np.pi * 110.6 * t + np.sin(2 * np.pi * 0.2 * t)))
cluster = sum(np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * (4.5 + k) * t)) for k, f in enumerate([622, 659, 698, 740])) * 0.2
cluster *= np.clip((t - 8.0) / 6, 0, 1) * 0.5
air = bp(rng.standard_normal(N), 2000, 6000) * 0.25 * np.clip((t - 16) / 4, 0, 1)
mus = (drone * 0.35 + cluster + air) * intensity
music.add(mus, 0, db(-17))
# heartbeat
def beat():
    n = int(0.35 * SR); tt = T(n)
    a = np.sin(2 * np.pi * 52 * tt) * np.exp(-tt * 18); b = np.sin(2 * np.pi * 46 * tt) * np.exp(-tt * 14)
    o = np.zeros(int(0.6 * SR)); o[:n] += a; o[int(0.18 * SR):int(0.18 * SR) + n] += 0.7 * b; return o
bt = 16.6; period = 0.95
while bt < 27.8:
    music.add(beat(), bt, db(-8)); period = max(0.55, period * 0.975); bt += period
# riser into the mirror reveal + sting
n = int(1.0 * SR); tt = T(n); riser = bp(rng.standard_normal(n), 800, 5000) * (tt / 1.0) ** 3 + np.sin(2 * np.pi * np.cumsum(np.linspace(200, 900, n)) / SR) * (tt / 1.0) ** 3 * 0.4
music.add(riser, 19.6, db(-16))
def sting():
    n = int(2.2 * SR); tt = T(n)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 1.8)
    clus = sum(np.sin(2 * np.pi * f * tt) for f in [311, 329.6, 349, 466, 493.9]) * np.exp(-tt * 1.5) * 0.25
    hit = bp(rng.standard_normal(n), 100, 4000) * np.exp(-tt * 12)
    return reverb(boom + clus + hit * 0.6, 1.4, 0.35, 5000, 77)
music.add(sting(), 20.6, db(-6))
# sub drop on the black cut, very low
n = int(1.6 * SR); tt = T(n); music.add(np.sin(2 * np.pi * 32 * tt) * np.exp(-tt * 2.2), 28.0, db(-9))

# ---------------- MIX ----------------
V, S, Mu = voice.st(), sfx.st(), music.st()
# duck music & sfx under dialogue
venv = np.abs(V).mean(0); venv = signal.sosfilt(signal.butter(2, 6, fs=SR, output='sos'), venv)
duck = 1 - 0.45 * np.clip(venv / (venv.max() * 0.25 + 1e-9), 0, 1)
mix = V * 1.8 + S * (0.6 + 0.4 * duck) + Mu * duck
peak = np.abs(mix).max(); mix = mix / peak * 0.89
for name, st in [('stem_voice', V), ('stem_sfx', S), ('stem_music', Mu)]: write_wav(os.path.join(OUT, name + '.wav'), st / peak * 0.89)
write_wav(os.path.join(OUT, 'mix.wav'), mix)
print('ok', OUT)
