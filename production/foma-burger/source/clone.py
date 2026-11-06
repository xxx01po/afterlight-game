import sys, time, torch, soundfile as sf
from qwen_tts import Qwen3TTSModel
torch.set_num_threads(4)
m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cpu", dtype=torch.float32)
jobs = [l.split('|', 3) for l in open(sys.argv[1]).read().strip().split('\n')]
for name, ref, ref_text, text in jobs:
    t0 = time.time()
    wavs, sr = m.generate_voice_clone(text=text, language="Russian", ref_audio=ref, ref_text=ref_text)
    sf.write(f"{name}.wav", wavs[0], sr)
    print(name, round(time.time() - t0), 's ->', round(len(wavs[0]) / sr, 2), 's', flush=True)
