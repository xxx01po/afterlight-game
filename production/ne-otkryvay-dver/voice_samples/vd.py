import sys, time, torch, soundfile as sf
from qwen_tts import Qwen3TTSModel
torch.set_num_threads(4)
t0 = time.time()
m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
print('load', round(time.time() - t0), 's', flush=True)
jobs = [l.split('|', 2) for l in open(sys.argv[1]).read().strip().split('\n')]
for name, instruct, text in jobs:
    t0 = time.time()
    wavs, sr = m.generate_voice_design(text=text, instruct=instruct, language="Russian")
    sf.write(f"{name}.wav", wavs[0], sr)
    print(name, 'gen', round(time.time() - t0), 's, audio', round(len(wavs[0]) / sr, 2), 's', flush=True)
