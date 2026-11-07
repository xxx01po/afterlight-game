import sys, torch, torchaudio as ta, time
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
torch.manual_seed(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
for line in open(sys.argv[1]):
    k, ref, ex, cfg, text = line.strip().split('|')
    t = time.time()
    w = m.generate(text, language_id="ru", audio_prompt_path=ref, exaggeration=float(ex), cfg_weight=float(cfg))
    ta.save(f"{k}.wav", w, m.sr); print(k, round(time.time() - t, 1), 's', flush=True)
