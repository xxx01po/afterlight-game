"""Mix for the long-form test: voice (processed lines on the timeline) + SFX + music, with speech-keyed ducking.
usage: python3 audio_long.py <out_dir> [t_start t_end]   (optional excerpt)"""
import ast, os, sys, json
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy import signal
HERE = os.path.dirname(os.path.abspath(__file__))
TL = {v['id']: v for v in json.load(open(os.path.join(HERE, 'scene', 'timeline_vo.json')))}
DUR = TL['END']['t1'] + 0.5
# ---- borrow the synth helpers from the shorts pipeline (function defs + Bus only) ----
src = open(os.path.join(HERE, '..', 'kushat', 'audio.py')).read(); tree = ast.parse(src)
keep = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef, ast.Import, ast.ImportFrom))]
SR = 48000; N = int(SR * DUR); rng = np.random.default_rng(42)
exec(compile(ast.Module(body=keep, type_ignores=[]), 'helpers', 'exec'))
voice, sfx, music = Bus(), Bus(), Bus()
B = lambda k: TL['b_' + k]; L = lambda k: TL[k]
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out_audio'); os.makedirs(OUT, exist_ok=True)

# ---- voice ----
PAN = dict(foma=0.0, dir=0.12, oleg=-0.15, tim=0.2, lisa=-0.2, kesha=0.25, mom=0.0)
for k, v in TL.items():
    if 'spk' not in v: continue
    x, sr = sf.read(os.path.join(HERE, 'proc', k + '.wav'))
    if v['spk'] == 'mom': x = reverb(lp(x, 2800, 2), 0.45, 0.18, 3000, 4)   # behind the door
    room = 0.06 if k[0] in 'CDTLKF' else 0.04
    x = reverb(x, 0.35, room, 6000, 3)
    voice.add(x, v['t0'], 1.0, pan=PAN[v['spk']])

# ---- SFX ----
def bounce(seed): r = np.random.default_rng(seed); n = int(0.35 * SR); t = T(n); return (np.sin(2 * np.pi * 95 * t) * np.exp(-t * 18) + bp(r.standard_normal(n), 200, 2500) * np.exp(-t * 60) * 0.6)
def stamp(f=1200, d=0.06): n = int(d * SR); return bp(rng.standard_normal(n), f * 0.6, f * 1.8) * np.exp(-T(n) * 70)
def sting(): return tone(110, 0.6, 5, 'saw') * 0.6 + boom(0.6, 70) * 0.5
def riser(d): n = int(d * SR); t = T(n); f = 200 * np.exp(t * 2.0 / d); return bp(rng.standard_normal(n), 400, 6000) * (t / d) ** 2 * 0.6 + np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / d) * 0.3
def crowd_laugh(d): n = int(d * SR); t = T(n); x = np.zeros(n)
    # laughter: many "ha" pulses at random pitches
def ha_crowd(d, seed=3):
    r = np.random.default_rng(seed); n = int(d * SR); x = np.zeros(n)
    for v in range(7):
        f0 = r.uniform(220, 420); ph = r.uniform(0, 1)
        for k in range(int(d * 5)):
            s = int((k / 5 + r.uniform(0, 0.08)) * SR); m = int(0.12 * SR)
            if s + m >= n: break
            tt = T(m); x[s:s + m] += bp(r.standard_normal(m) * 0.4 + np.sin(2 * np.pi * f0 * tt), 300, 3000) * np.sin(np.pi * tt / 0.12) * (1 - k / (d * 5)) * 0.4
    return reverb(x, 0.6, 0.3, 5000, seed)
def paper(): n = int(0.25 * SR); return bp(rng.standard_normal(n), 2000, 8000) * np.sin(np.pi * T(n) / 0.25) * 0.5
def swoosh_long(d): return whoosh2(d)
def bell_ring(d): n = int(d * SR); t = T(n); x = signal.square(2 * np.pi * 1300 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * t))); return reverb(bp(x, 700, 5000) * env_adsr(n, 0.01, 0.1), 0.8, 0.25, 5000, 7)
def alarm_clock(d): n = int(d * SR); t = T(n); x = signal.square(2 * np.pi * 2600 * t) * (np.sin(2 * np.pi * 16 * t) > 0) * ((t % 0.5) < 0.3); return bp(x, 1500, 6000)

# hook: crowd chaos bed + freeze
sfx.add(lp(rng.standard_normal(int(0.25 * SR)), 1200) * np.exp(-T(int(0.25 * SR)) * 6), 0.0, db(-12))      # ball whoosh into lens
sfx.add(dun() * 1.3, 0.12, db(-8)); sfx.add(tone(1800, 1.2, 3) * 0.2, 0.15, db(-22))                        # freeze ping
sfx.add(swish(), L('H2')['t0'] + 0.6, db(-18))                                                                # badge push
sfx.add(dun(), L('H3')['t0'] + 0.05, db(-12))
for i in range(4): sfx.add(whoosh2(0.3), B('montage')['t0'] + i * 0.4 - 0.12, db(-14)); sfx.add(stamp(900 + i * 300), B('montage')['t0'] + i * 0.4, db(-14))
ch0, ch1 = B('montage')['t1'], B('rewind')['t0']
sfx.add(murmur(ch1 - ch0) * 0.9, ch0, db(-17))
for i, s0 in enumerate(np.arange(ch0 + 0.1, ch1, 0.33)): sfx.add(bounce(i), s0, db(-14), pan=0.5 * np.sin(i))
sfx.add(boom(1.0, 60), L('H5')['t0'], db(-11))
sfx.add(rewind(B('rewind')['t1'] - B('rewind')['t0']), B('rewind')['t0'], db(-9))
# room
sfx.add(alarm_clock(L('M1')['t0'] + 0.3 - B('room')['t0']), B('room')['t0'], db(-18))
sfx.add(knock(1.0, 2), L('M1b')['t0'] - 0.25, db(-12), pan=0.4); sfx.add(knock(1.0, 3), L('M1b')['t0'] - 0.05, db(-12), pan=0.4)
sfx.add(tick(), B('logic')['t0'] + 0.15, db(-20)); sfx.add(tick(), B('logic')['t0'] + 0.5, db(-20))
sfx.add(dun() * 0.9, L('M4')['t1'] + 0.02, db(-14))
sfx.add(tone(880, 0.5, 6) * 0.4, B('tie')['t0'], db(-16)); sfx.add(dun(), L('S4')['t0'] + 0.1, db(-12))
sfx.add(whoosh2(0.45), B('whoosh')['t0'], db(-10))
# hall
for i, s0 in enumerate(np.arange(B('hall')['t0'], L('O1')['t1'], 0.22)): sfx.add(step(300 + i, 0.8), s0, db(-17), pan=-0.3)
sfx.add(murmur(B('class')['t0'] - B('hall')['t0']) * 0.5, B('hall')['t0'], db(-26))
sfx.add(tone(1568, 0.35, 8) * 0.5, B('badge')['t0'], db(-14)); sfx.add(swish(), B('badge')['t0'] - 0.05, db(-16))
sfx.add(scratch(), L('F6')['t1'] - 0.05, db(-14))                                                                 # record scratch on the slip
for s0, a in [(B('risk1')['t0'], 0)] + []: pass
sfx.add(tone(330, 0.4, 5, 'sq') * 0.5, B('freeze1')['t0'], db(-16)); sfx.add(tone(311, 0.6, 4, 'sq') * 0.5, B('freeze1')['t0'] + 0.25, db(-16))
sfx.add(slap(), L('O6')['t0'] + 0.02, db(-10)); sfx.add(bell_ring(B('class')['t0'] - B('bell')['t0'] + 0.3), B('bell')['t0'], db(-15))
# class
sfx.add(creak(0.6, 200, 5), B('class')['t0'], db(-14)); sfx.add(murmur(0.5) * 0.8, B('class')['t0'], db(-20))
sfx.add(dun(), B('namefreeze')['t0'] + 0.1, db(-11)); sfx.add(tone(1200, 0.25, 12), B('namefreeze')['t0'] + 0.35, db(-18))
sfx.add(ha_crowd(B('laugh')['t1'] - L('T6')['t1'] + 0.6), L('T6')['t1'] - 0.1, db(-10))
for i, k in enumerate(['T3', 'K1', 'T4']): sfx.add(swish(0.15), L(k)['t0'] - 0.04, db(-20))
sfx.add(tone(1046, 0.4, 7) * 0.5, L('L1')['t0'] + 0.1, db(-18))
sfx.add(tick(), B('deal')['t0'] + 0.2, db(-18)); sfx.add(tick(), B('deal')['t0'] + 0.5, db(-18))
for i, s0 in enumerate(np.arange(B('teach')['t0'] + 0.5, B('teach')['t1'], 0.18)): sfx.add(stamp(2500 + 300 * (i % 3), 0.05), s0, db(-22))   # chalk
sfx.add(crunch() if 'crunch' in dir() else stamp(800, 0.15), L('K2')['t0'] - 0.2, db(-14))
for i, s0 in enumerate(np.arange(L('D1')['t0'] - 0.1, L('D1')['t1'] + 0.1, 0.42)): sfx.add(step(800 + i, 1.1), s0, db(-14), pan=-0.2)
sfx.add(paper(), B('plane')['t0'] + 0.2, db(-14)); sfx.add(whoosh2(1.5) * 0.6, B('plane')['t0'] + 0.75, db(-16)); sfx.add(creak(0.5, 220, 2), B('plane')['t0'] + 0.9, db(-16))
sfx.add(bonk(), B('hit')['t0'], db(-8)); sfx.add(dun() * 1.2, B('score')['t0'], db(-11))
sfx.add(boom(1.2, 55) * 0.7, L('D3')['t1'], db(-12)); sfx.add(riser(1.2), B('outro')['t0'] - 0.4, db(-16))
for s0 in np.arange(L('D3')['t1'] + 0.4, TL['END']['t1'], 1.0): sfx.add(tick() * 1.4, s0, db(-14))

# ---- risk meter beeps (tied to the on-screen events) ----
RISK = [B('risk1')['t0'], B('risk2')['t0'], B('laugh')['t0'] + 0.2, L('F11')['t0'] + 0.1, B('hit')['t0'] + 0.1, B('risk5')['t0']]
for r in RISK: sfx.add(tone(660, 0.12, 15, 'sq') * 0.6, r, db(-15)); sfx.add(tone(990, 0.15, 12, 'sq') * 0.6, r + 0.1, db(-15))

# ---- music: hook tension -> rewind -> sleepy morning -> school bounce -> tense outro ----
def pad(d, f, gain=1.0):
    n = int(d * SR); t = T(n); x = sum(np.sin(2 * np.pi * f * m * t + m) / (i + 1) for i, m in enumerate([1, 1.5, 2, 3])); return lp(x, 900) * env_adsr(n, 0.3, 0.6) * gain
music.add(pad(B('montage')['t1'], 55, 0.5), 0.0, db(-12))
drums(140, ch0, B('rewind')['t0'], gain=1.0); bassline(140, ch0, B('rewind')['t0'], [73.4, 73.4, 87.3, 98], 0.9, 'saw')
lead(96, B('room')['t0'] + 0.4, B('whoosh')['t0'], [523, 0, 659, 0, 784, 0, 659, 0, 587, 0, 0, 0, 523, 0, 0, 0], 0.55)
bassline(96, B('room')['t0'] + 0.4, B('whoosh')['t0'], [130.8, 0.0001, 164.8, 0.0001], 0.5, 'sq')
drums(120, B('hall')['t0'], B('freeze1')['t0'], gain=0.55); bassline(120, B('hall')['t0'], B('freeze1')['t0'], [98, 98, 123.5, 110], 0.7, 'saw'); lead(120, B('hall')['t0'], B('freeze1')['t0'], [784, 0, 880, 0, 988, 0, 880, 784, 659, 0, 0, 0, 587, 0, 659, 0], 0.55)
drums(120, B('freeze1')['t1'], B('bell')['t0'], gain=0.5); bassline(120, B('freeze1')['t1'], B('bell')['t0'], [98, 98, 123.5, 110], 0.6, 'saw')
drums(124, B('class')['t0'] + 0.9, B('namefreeze')['t0'], gain=0.5); bassline(124, B('class')['t0'] + 0.9, B('namefreeze')['t0'], [110, 110, 130.8, 146.8], 0.6, 'saw')
drums(124, B('laugh')['t1'], L('D1')['t0'], gain=0.5); bassline(124, B('laugh')['t1'], L('D1')['t0'], [110, 110, 130.8, 146.8], 0.6, 'saw'); lead(124, B('teach')['t0'], L('D1')['t0'], [880, 0, 988, 0, 1046, 0, 988, 880, 784, 0, 0, 0, 880, 0, 784, 0], 0.5)
music.add(pad(B('plane')['t0'] - L('D1')['t0'], 49, 0.6), L('D1')['t0'], db(-10))
music.add(pad(B('outro')['t1'] - L('D3')['t1'], 46, 0.8), L('D3')['t1'], db(-9)); drums(150, B('outro')['t0'], B('outro')['t1'], gain=0.8)

# ---- mix: speech-keyed ducking; voice sits on top ----
V_, S_, Mu = voice.st(), sfx.st(), music.st()
venv = signal.sosfilt(signal.butter(2, 8, fs=SR, output='sos'), np.abs(V_).mean(0)); duck = 1 - 0.6 * np.clip(venv / (np.percentile(venv, 95) * 0.25 + 1e-9), 0, 1)
mix = V_ * 1.0 + S_ * (0.55 + 0.25 * duck) * 0.55 + Mu * duck * 0.42
a, b = (float(sys.argv[2]), float(sys.argv[3])) if len(sys.argv) > 3 else (0, DUR)
seg_ = lambda x: x[:, int(a * SR): int(b * SR)]
meter = pyln.Meter(SR); g = 10 ** ((-14 - meter.integrated_loudness(seg_(mix).T)) / 20)
for name, st in [('mix', mix), ('stem_voice', V_), ('stem_sfx', S_ * 0.55), ('stem_music', Mu * 0.42)]:
    y = np.clip(seg_(st) * g, -0.97, 0.97); sf.write(os.path.join(OUT, name + '.wav'), y.T, SR, subtype='PCM_24')
print('ok', round(b - a, 2), 's; voice LUFS', round(meter.integrated_loudness((seg_(V_) * g).T), 1), 'music LUFS', round(meter.integrated_loudness((seg_(Mu * 0.42 * duck) * g).T), 1))
