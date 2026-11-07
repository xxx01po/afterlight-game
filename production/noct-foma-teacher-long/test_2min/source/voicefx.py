"""Voice post-processing chain + take scoring for NOCT long-form.
usage: python3 voicefx.py score            -> picks best take per line into picks.json
       python3 voicefx.py process          -> writes proc/<id>.wav (48 kHz mono, processed)
"""
import sys, os, re, json, glob
import numpy as np, soundfile as sf, pyloudnorm as pyln, noisereduce as nr
from scipy import signal
from pedalboard import Pedalboard, HighpassFilter, PeakFilter, HighShelfFilter, Compressor, Limiter

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
LINES = {}
for l in [x for fn in ('lines.txt', 'lines2.txt') for x in open(os.path.join(HERE, fn))]:
    if l.startswith('#') or not l.strip(): continue
    k, spk, sty, text = l.strip().split('|'); LINES[k] = dict(spk=spk, sty=sty, text=text.replace("'", ''))

def load(p):
    x, sr = sf.read(p); x = x.mean(1) if x.ndim > 1 else x
    return signal.resample_poly(x, SR, sr) if sr != SR else x

def trim(x, db=-42, pad_in=0.015, pad_out=0.06):
    fr = 480; e = np.array([np.sqrt(np.mean(x[i:i + fr] ** 2) + 1e-12) for i in range(0, len(x) - fr, fr)])
    th = e.max() * 10 ** (db / 20); idx = np.where(e > th)[0]
    a = max(0, idx[0] * fr - int(pad_in * SR)); b = min(len(x), (idx[-1] + 1) * fr + int(pad_out * SR))
    y = x[a:b].copy(); n = int(0.008 * SR); y[:n] *= np.linspace(0, 1, n); m = int(0.04 * SR); y[-m:] *= np.linspace(1, 0, m)
    return y

def deess(x, lo=5000, hi=9500, thr_db=-30, ratio=4.0):
    band = signal.sosfilt(signal.butter(4, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
    env = np.maximum(signal.sosfilt(signal.butter(2, 60, fs=SR, output='sos'), np.abs(band)), 1e-9)
    env_db = 20 * np.log10(env); over = np.maximum(0, env_db - thr_db)
    g = 10 ** (-(over - over / ratio) / 20)
    return x - band + band * g

TARGET = dict(n=-20.0, s=-18.0, p=-18.5, w=-23.0)
def process(x, sty):
    x = nr.reduce_noise(y=x, sr=SR, stationary=True, prop_decrease=0.55)
    x = trim(x)
    board = Pedalboard([HighpassFilter(85), PeakFilter(250, -2.5, 1.0), PeakFilter(3200, 2.5, 0.9), HighShelfFilter(10000, 1.5, 0.7),
                        Compressor(threshold_db=-20, ratio=3.0, attack_ms=6, release_ms=90)])
    x = board(x.astype(np.float32), SR).astype(np.float64)
    x = deess(x)
    meter = pyln.Meter(SR, block_size=0.2 if len(x) / SR < 0.5 else 0.4)
    try: lu = meter.integrated_loudness(x)
    except Exception: lu = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    if not np.isfinite(lu): lu = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    x = x * 10 ** ((TARGET[sty] - lu) / 20)
    x = Limiter(threshold_db=-3.0, release_ms=60)(x.astype(np.float32), SR).astype(np.float64)
    try: lu2 = meter.integrated_loudness(x)
    except Exception: lu2 = TARGET[sty]
    if np.isfinite(lu2): x = x * 10 ** ((TARGET[sty] - lu2) / 20)
    pk = np.abs(x).max(); lim = 10 ** (-1.0 / 20)
    if pk > lim: x = x * lim / pk
    return x

def norm_words(s):
    from num2words import num2words
    s = s.lower().replace('roblox', 'роблокс').replace('36,6', 'тридцать шесть и шесть')
    s = re.sub(r'\d+', lambda m: ' ' + num2words(int(m.group()), lang='ru') + ' ', s)
    s = re.sub(r'[^а-яё ]', ' ', s.replace('ё', 'е').replace('-', ' '))
    return [w.replace('о', 'а').replace('э', 'е') for w in s.split()]  # tolerant to vowel reduction

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'score':
        from faster_whisper import WhisperModel
        wm = WhisperModel('small', device='cpu', compute_type='int8'); picks = {}; report = []
        for k, L in LINES.items():
            best = None
            for p in sorted(glob.glob(os.path.join(HERE, 'takes', f'{k}_*.wav'))):
                x = trim(load(p)); x16 = signal.resample_poly(x, 16000, SR).astype(np.float32)
                segs, _ = wm.transcribe(x16, language='ru', beam_size=5, word_timestamps=True); segs = list(segs); txt = ' '.join(s.text for s in segs)
                ws = [w for sg in segs for w in (sg.words or [])]; cut = (max(0, ws[0].start - 0.06), ws[-1].end + 0.14) if ws else (0, len(x) / SR)
                ref, hyp = norm_words(L['text']), norm_words(txt)
                acc = sum(w in hyp for w in ref) / max(1, len(ref)); extra = max(0, len(hyp) - len(ref)) / max(1, len(ref))
                dur = min(len(x) / SR, cut[1]) - cut[0]; cps = len(L['text']) / dur
                clip = np.mean(np.abs(x) > 0.99 * np.abs(x).max())
                slow = (L['sty'] != 'w' and cps < 8) or cps < 6
                score = acc - 0.5 * extra - (0.5 if slow or cps > 24 else 0) - clip * 5
                report.append(f"{os.path.basename(p):10s} acc {acc:.2f} extra {extra:.2f} {dur:4.2f}s cps {cps:4.1f} | {txt.strip()}")
                if best is None or score > best[0]: best = (score, os.path.basename(p), dur, cut)
            if best is None: continue
            picks[k] = dict(file=best[1], score=round(best[0], 2), dur=round(best[2], 2), cut=[round(best[3][0], 3), round(best[3][1], 3)])
        json.dump(picks, open(os.path.join(HERE, 'picks.json'), 'w'), indent=1, ensure_ascii=False)
        open(os.path.join(HERE, 'score_report.txt'), 'w').write('\n'.join(report)); print('\n'.join(report))
    elif mode == 'process':
        picks = json.load(open(os.path.join(HERE, 'picks.json'))); os.makedirs(os.path.join(HERE, 'proc'), exist_ok=True)
        for k, pk in picks.items():
            x = trim(load(os.path.join(HERE, 'takes', pk['file']))); a, b = pk['cut']; x = x[int(a * SR): int(b * SR)]
            y = process(x, LINES[k]['sty'])
            sf.write(os.path.join(HERE, 'proc', f'{k}.wav'), y, SR, subtype='PCM_24'); print(k, pk['file'], round(len(y) / SR, 2))
