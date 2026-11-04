# T-02 «Style Lock» — пакет промптов

Как пользоваться: копируй промпт целиком, прикладывай указанные файлы **в указанном порядке**. Сохраняй результаты в `production/ep000_test/T02/<шаг>/` с именами вида `A_master_v1.png` — я проведу QC.
Промпты на английском: модели лучше понимают английские описания.

**Блок FOMA** (вставляется в каждый промпт, где написано `{FOMA}`):

> FOMA: a 175 cm tall young guy, always in a black oversized hoodie with the hood up, messy spiky black hair strands falling from under the hood, a stitched cross on the chest, a black tactical backpack with chest straps, extremely wide floor-length black cargo pants with big side pockets and hanging straps, chunky worn off-white sneakers with thick soles. His whole face is hidden by a matte ash-grey shield-shaped mask with a pointed chin, fine dark cracks, and one tapering black wedge stripe running from the forehead (slightly right of center from the viewer) down between the eyes to a point. BOTH almond eye holes with sharp upturned outer corners glow pure white. Keep the design exactly as in the reference images.

**Хвост ограничений** (в конец каждого промпта картинки):

> Keep the mask design, wedge position, cracks, two glowing white eyes, outfit, backpack and sneakers identical to the references. No mirrored image, no visible face or skin under the mask, no text, no logos, no watermark.

---

## Шаг 1. Foma3D master sheet (три подачи)

Приложить: `bible/reference/foma_turnaround.png`, `foma_mask_closeup.png`, `foma_outfit.png`, `foma_sheet_v1.png`.

**A — живописное стилизованное 3D**
> Create a character turnaround sheet of the same character in the reference images, translated into high-end stylized 3D animation with a painterly, hand-crafted texture feel: sculpted volumes, brush-like texture on fabric and on the mask, soft cinematic rim light. Five views on one sheet: front, three-quarter front, side profile, three-quarter back, back. Neutral dark grey studio background, even light, full body visible in every view, same scale. {FOMA} {хвост}

**B — кинематографичное мультяшное 3D**
> Create a character turnaround sheet of the same character in the reference images, translated into a feature-film quality 3D animated movie look: stylized cartoon proportions with physically based materials — matte cracked ceramic mask, heavy cotton hoodie with folds, worn nylon backpack, scuffed rubber sneakers. Five views: front, three-quarter front, side profile, three-quarter back, back. Neutral dark grey studio background, soft key light and cool rim light. {FOMA} {хвост}

**C — аниме-3D с тун-шейдингом**
> Create a character turnaround sheet of the same character in the reference images as a cel-shaded 3D anime model: clean 3D forms with crisp ink outlines, two-tone flat shading, graphic shadows matching the reference illustration. Five views: front, three-quarter front, side profile, three-quarter back, back. Neutral dark grey background. {FOMA} {хвост}

**Дополнительно для утверждённой подачи** (тот же стиль, по одному изображению):
1. `master_front_full.png` — анфас в полный рост, нейтральная поза.
2. `master_three_quarter.png` — ¾ анфас.
3. `master_mask_macro.png` — маска крупно, анфас, оба глаза светятся: *«Extreme close-up of the mask only, front view, both eye holes glowing white, crack pattern and black wedge clearly visible, soft studio light.»*
4. `master_back_backpack.png` — спина с рюкзаком.

Эти 4 файла = **эталон-пакет**, в этом порядке подаются во все дальнейшие шаги.

---

## Шаг 2. Ключевые кадры по направляющим кадрам превиза

Приложить: направляющий кадр (`keyframe_guides/SHxx_start_guide.jpg`) **первым**, затем эталон-пакет (4 файла).

Общая формула:
> Image 1 is a 3D previsualization frame: use it ONLY for camera angle, framing, pose and light direction. Images 2–5 define the character's exact appearance. Render this exact shot as a final frame of a cinematic 3D animated horror film in the approved style. {сцена} {FOMA} {хвост} Aspect ratio 16:9.

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
> Replace the grey mannequin character in the video with @Foma from the reference images, keeping exactly the same movements, camera angles and timing. Render as a cinematic 3D animated horror film in the approved style. {FOMA}

---

## Что я делаю с результатами
1. QC-бот: стоп-кадры каждые 0,5 с, сходство с эталон-пакетом, проверка маски (сторона клина, два глаза, цвет свечения).
2. Сборка с готовым голосом и звуком T-01.
3. Таблица: модель × кадр × «прошёл QC с первой попытки», дубли на годный кадр, впечатление.
