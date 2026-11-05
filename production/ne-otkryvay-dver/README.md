# «НЕ ОТКРЫВАЙ ДВЕРЬ» — Roblox Horror Short

- `final/ne_otkryvay_dver_1080x1920.mp4` — готовый ролик (9:16, 1080×1920, 30 fps, 30 с, AAC, −14 LUFS)
- `final/ne_otkryvay_dver_video_only.mp4` — та же картинка без звука (для пересборки с ElevenLabs в CapCut)
- `audio/` — стемы (голос / SFX / музыка) и мастер-микс
- `subtitles.srt` — субтитры
- `refs/` — референсы персонажей (спереди, сбоку, сзади, лицо; фигура)
- `PRODUCTION_BIBLE.md` — раскадровка, промпты для AI-видео, сценарий ElevenLabs, звуковая карта, план монтажа CapCut, QA
- `source/` — исходники; всё перегенерируется детерминированно

## Пересборка
```bash
cd source
npm i three@0.170.0           # + системный playwright с Chromium
pip install piper-tts scipy numpy
# голоса Piper: ru_RU-dmitri-medium, ru_RU-irina-medium → source/voices/, реплики → source/vo/ (см. PRODUCTION_BIBLE, раздел 8)
node render.mjs full ../video_raw.mp4      # ~15 мин на 4 ядрах (SwiftShader)
python3 audio.py ../audio
./assemble.sh ../video_raw.mp4 ../audio/mix.wav ../final
```
Тест отдельных кадров: `node render.mjs test ../test 0.4,14.0,21.7`.
Тексты субтитров и тайминги лежат в `subs.json`, сообщения телефона — константы `MSG1`/`MSG2` в `scene.js`.
