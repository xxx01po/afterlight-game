# T-02 «Style Lock» — пакет промптов

Как пользоваться: копируй промпт целиком, прикладывай указанные файлы **в указанном порядке**. Сохраняй результаты в `production/ep000_test/T02/<шаг>/` с именами вида `A_master_v1.png` — я проведу QC.
Промпты на английском: модели лучше понимают английские описания.

**Блок FOMA** (вставляется в каждый промпт, где написано `{FOMA}`):

> FOMA: a 175 cm tall young guy, always in a black oversized hoodie with the hood up, messy spiky black hair strands falling from under the hood, a stitched cross on the chest, a black tactical backpack with chest straps, extremely wide floor-length black cargo pants with big side pockets and hanging straps, chunky worn off-white sneakers with thick soles. His whole face is hidden by a matte ash-grey shield-shaped mask with a pointed chin, fine dark cracks, and one tapering black wedge stripe running from the forehead (slightly right of center from the viewer) down between the eyes to a point. BOTH almond eye holes with sharp upturned outer corners glow pure white. Keep the design exactly as in the reference images.

**Хвост ограничений** (в конец каждого промпта картинки):

> Keep the mask design, wedge position, cracks, two glowing white eyes, outfit, backpack and sneakers identical to the references. No mirrored image, no visible face or skin under the mask, no text, no logos, no watermark.

---

## Шаг 1. Пакет эталонов в стиле листа

Решение автора: стиль фильма = стиль листа. Задача шага — не «переводить» Фому, а получить из листа **4 чистых отдельных изображения** без текста и коллажа (модели читают их лучше, чем лист целиком).

Приложить: `bible/reference/foma_sheet_v1.png`, `foma_turnaround.png`, `foma_mask_closeup.png`, `foma_outfit.png`.

**{STYLE}** (вставляется в каждый промпт картинки и видео):
> Dark cinematic anime illustration style exactly like the reference sheet: semi-realistic painterly rendering, deep inky blacks, desaturated cold moonlit blues and greys, rare deep red accents, sharp graphic shadows, detailed fabric folds, soft volumetric fog and haze, subtle grain, moody horror atmosphere.

| Файл | Промпт |
|---|---|
| `ref_front_full.png` | Full-body front view of the same character from the reference sheet, standing in a neutral relaxed pose, hands in hoodie pocket, plain dark background, even moody light. {STYLE} {FOMA} {хвост} |
| `ref_three_quarter.png` | Full-body three-quarter front view of the same character, neutral pose, plain dark background. {STYLE} {FOMA} {хвост} |
| `ref_mask_macro.png` | Extreme close-up of the mask only, front view, both almond eye holes glowing pure white, crack pattern and the black wedge clearly visible, hood framing the mask. {STYLE} {FOMA} {хвост} |
| `ref_back_backpack.png` | Full-body back view of the same character showing the hood, the black tactical backpack with straps, and the wide cargo pants, plain dark background. {STYLE} {FOMA} {хвост} |

Эти 4 файла = **эталон-пакет** `FomaRef_v1`, в этом порядке подаются во все дальнейшие шаги. После твоего утверждения — фиксируются в `bible/reference/pack_v1/`.

---

## Шаг 2. Ключевые кадры по направляющим кадрам превиза

Приложить: направляющий кадр (`keyframe_guides/SHxx_start_guide.jpg`) **первым**, затем эталон-пакет (4 файла).

Общая формула:
> Image 1 is a 3D previsualization frame: use it ONLY for camera angle, framing, pose and light direction. Images 2–5 define the character's exact appearance. Render this exact shot as a final film frame in the art style of the reference sheet, with cinematic depth. {сцена} {STYLE} {FOMA} {хвост} Aspect ratio 16:9.

| Кадр | `{сцена}` |
|---|---|
| SH02 start / end | Night, an abandoned Soviet-era apartment corridor with peeling patterned wallpaper and a worn parquet floor. Foma holds a flashlight at chest height; its beam cuts through thin haze toward the wall (start: toward the left wall; end: toward the right wall). Cold blue moonlight from a window at the far end rims his hood and shoulders. Medium three-quarter shot. |
| SH04 start / end | Close-up of Foma's mask in the dark corridor, lit softly from below by the lowered flashlight; both eyes glow white. Start: head straight. End: head tilted to the side with tired irony, shoulders slightly raised. |
| SH06 start / end | Extreme close-up of Foma's mask in near darkness, the two glowing eyes are the main light source. Start: eyes in normal almond shape. End: both eyes narrowed and slightly dimmed with fear. |

---

## Шаг 3. Оживление

**Kling 3.0** — режим image-to-video, начальный и конечный кадр из шага 2; в Elements — эталон-пакет. Длительность 5 с.

| Кадр | Промпт движения |
|---|---|
| SH04 | The masked character slowly lowers the flashlight and tilts his head to the side with tired irony; a small sigh lifts and drops his shoulders. Static camera. Subtle, natural motion. The mask stays rigid; both eyes keep glowing white. |
| SH06 | The masked character freezes in fear; both glowing eyes slowly narrow and dim slightly; tiny breathing motion of the hood. Very slow push-in. The mask stays rigid, no facial deformation. |

**Seedance 2.0** — изображения: эталон-пакет + ключевой кадр start; видео-референс: клип превиза этого кадра (вырезать из `previz/T01_previz_v2.mp4`: SH02 6.0–11.0 с, SH04 14.0–22.0 с, SH06 27.0–33.5 с). Промпт — тот же, что для Kling, плюс:
> Follow the reference video only for camera movement, timing and body motion; take the character's appearance only from the reference images.

**Video-to-video (путь «перерисовки» превиза)** — Kling O1 Edit или Luma Ray3 Modify, вход — клип превиза SH02:
> Replace the grey mannequin character in the video with @Foma from the reference images, keeping exactly the same movements, camera angles and timing. Render it in the dark cinematic anime illustration style of the reference sheet. {STYLE} {FOMA}

---

## Что я делаю с результатами
1. QC-бот: стоп-кадры каждые 0,5 с, сходство с эталон-пакетом, проверка маски (сторона клина, два глаза, цвет свечения).
2. Сборка с готовым голосом и звуком T-01.
3. Таблица: модель × кадр × «прошёл QC с первой попытки», дубли на годный кадр, впечатление.
