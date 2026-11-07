import sys, torch, torchaudio as ta, time, os
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
C = os.path.abspath('cast')
REF = dict(foma='foma_a', dir='dir_b', oleg='oleg_e', tim='tim_a', lisa='lisa_a', kesha='kesha_d', mom='mom')
WREF = dict(foma='foma_w', oleg='oleg_w', lisa='lisa_w')
P = dict(n=(0.5, 0.5), s=(0.85, 0.3), p=(1.0, 0.3), w=(0.45, 0.5))
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
for line in open(os.environ.get('LINES', 'lines.txt')):
    if line.startswith('#') or not line.strip(): continue
    k, spk, sty, text = line.strip().split('|')
    if only and k not in only: continue
    text = text.replace("'", '́')
    ref = WREF.get(spk, REF[spk]) if sty == 'w' else REF[spk]
    ex, cfg = P[sty]
    if spk == 'kesha': ex, cfg = min(ex, 0.4), 0.55
    for s in range(1, int(os.environ.get('NT', '3')) + 1):
        torch.manual_seed(s * 7 + 1)
        t0 = time.time()
        try: w = m.generate(text, language_id='ru', audio_prompt_path=f'{C}/{ref}.wav', exaggeration=ex, cfg_weight=cfg)
        except Exception as e: print(k, s, 'FAIL', e, flush=True); continue
        ta.save(f'takes/{k}_{s}.wav', w, m.sr); print(k, s, round(time.time() - t0, 1), flush=True)
    if k == 'H5':
        for s in (1, 2):
            torch.manual_seed(s); w = m.generate(text, language_id='ru', audio_prompt_path=f'{C}/dir_s.wav', exaggeration=1.0, cfg_weight=0.3); ta.save(f'takes/H5_s{s}.wav', w, m.sr)
print('ALLDONE', flush=True)
