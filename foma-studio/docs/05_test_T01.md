# 05. Тест T-01 «Дверь» — первый анимационный фрагмент

## Цель теста

Это не «мини-серия», а **измерительный прибор**. Он должен ответить на 5 вопросов до того, как мы потратим деньги на выпуск:

1. Держит ли выбранная модель внешность Фомы (маска, асимметрия, глаза, одежда) в разных ракурсах и при разном свете?
2. Сколько дублей в среднем нужно на годный кадр (→ реальная стоимость выпуска)?
3. Какая модель лучше для нас: **Kling vs Seedance** (A/B на одних и тех же ключевых кадрах)?
4. Как Фома «играет» без лица: хватает ли языка тела + глаз, чтобы передать иронию и страх?
5. Работает ли связка «картинка → звук → монтаж» без ручных костылей?

## Параметры

- Одна локация: коридор заброшенной квартиры в панельном доме, ночь.
- Длительность: ≈ 48 с, 10 кадров (A — 5, B — 3, C — 2).
- Персонаж: только Фома (+ голос из темноты).
- Звук: эмбиент, скрипы, дыхание, тишина, 5 реплик.

## Сюжет (микро-структура из 9 элементов ТЗ, сжатая)

Фома заходит в пустую квартиру (завязка, обстоятельства) → окликает, никто не отвечает, шутит, чтобы не бояться (тревога) → дверь в конце коридора открывается сама (необъяснимое) → он пытается себя успокоить (усиление) → свет фонарика тонет в проёме (опасность) → отступает → **на его вопрос «Есть тут кто-нибудь?» из темноты отвечают его же голосом: «Есть.»** (поворот) → чёрный экран.

Поворот работает на будущее канала: в нём нет объяснения, нет биографии Фомы, но есть крючок — «что-то знает его голос».

## Раскадровка

Полный шот-лист: [`production/ep000_test/shotlist.csv`](../production/ep000_test/shotlist.csv). Реплики: [`dialogue.csv`](../production/ep000_test/dialogue.csv). Аниматик: `production/ep000_test/animatic/T01_animatic.mp4`.

| Кадр | с | Класс | Что происходит | Ракурс / камера | Свет | Эмоция | Звук / реплика |
|---|---|---|---|---|---|---|---|
| SH01 | 6 | A | Фома входит, включает фонарик | общий, уровень глаз / наезд | луна в окне + фонарик | настороженность | скрип входной двери, ветер, доски |
| SH02 | 5 | A | Ведёт лучом, оглядывается | средний 3/4 / панорама за лучом | фонарик ключевой, луна контровая | любопытство | L01 «Эй! Есть тут кто-нибудь?» |
| SH03 | 3 | B | Луч по обоям, календарь с красным кружком | деталь / проводка | фонарик | тревога | гул тишины |
| SH04 | 8 | A | Опускает фонарик, иронично наклоняет голову | крупный маски / статика | нижний отсвет + глаза | нервная ирония | L02 «…Отлично. Разговариваю с пустым домом. Нормальный вечер.» |
| SH05 | 5 | B | Дальняя дверь открывается сама | через плечо, симметрия / статика | луна за дверью гаснет | испуг | долгий скрип, ветер стихает |
| SH06 | 6.5 | A | Замирает, глаза сужаются и тускнеют | крупный маски / медленный наезд | глаза — главный свет | страх | L03 «Так. Спокойно. Это просто дверь.» |
| SH07 | 5 | B | Дрожащий луч тонет в проёме | POV / наезд | фонарик в темноте | ужас | L04 «Двери не открываются сами… ведь правда?» |
| SH08 | 4 | A | Шаг назад, почти роняет фонарик | средний / статика | фонарик дёргается | паника | шаг, удар фонарика о ладонь |
| SH09 | 4 | C | Темнота проёма | общий / параллакс тумана | почти темнота | поворот | тишина → L05 «Есть.» (голос Фомы, ниже, с хвостом) |
| SH10 | 2 | C | Чёрный экран | — | — | — | тишина |

**Находка аниматика (уже исправлена):** реплики L02 (7 с) и L03 (6 с) не помещались в кадры 6 и 4 с. Кадры удлинены до 8 и 6.5 с. Ровно для этого аниматик и делается до генерации.

## Промпты

Структура промпта ключевого кадра: `[FOMA lock] + [style lock] + [кадр]`. Блоки `lock_prompt_en` и `style_lock_en` — из `bible/foma.yaml` и `style/look.yaml`, вставляются дословно. Ниже — только часть «кадр».

**Локация-плейт (генерируется один раз, без Фомы, затем используется как референс во всех кадрах):**
> Interior of an abandoned Soviet-era panel apartment at night: a long narrow corridor with peeling patterned wallpaper, a worn parquet floor with scattered debris, an old wall calendar, a coat rack with one forgotten coat. At the far end, a closed wooden door with chipped white paint; to its left a window lets in cold blue moonlight that lays a pale rectangle on the floor. Thin haze in the air. Wide symmetrical composition, eye-level, 24mm lens. 16:9.

| Кадр | Ключевой кадр (start) | Промпт движения (image-to-video) |
|---|---|---|
| SH01 | Foma stands in the open front doorway in the foreground, seen from inside the corridor, his silhouette backlit by the dim stairwell light, a switched-off flashlight in his right hand. Wide shot, eye level. | Foma steps into the corridor and clicks the flashlight on; the beam cuts through the haze. Slow camera push-in. Natural, cautious walking pace. |
| SH02 | Medium three-quarter shot of Foma in the corridor holding the flashlight at chest height, beam pointing at the left wall, moonlight rim-lighting his hood. | Foma slowly sweeps the beam from left to right and turns his head to follow it, shoulders tense. Camera pans gently with the beam. |
| SH03 | (без Фомы) Close detail of peeling wallpaper and an old paper wall calendar with one date circled in red ink, lit only by a flashlight beam from the right. | The flashlight beam slides slowly across the wallpaper and stops on the red circle. Dust particles drift in the beam. |
| SH04 | Close-up of Foma's mask, lit from below by the lowered flashlight, his white eyes glowing softly; corridor dark behind him. | Foma lowers the flashlight a little and tilts his head to the side with tired irony; his shoulders drop in a small sigh. Static camera. Subtle motion only. |
| SH05 | Over-the-shoulder shot from behind Foma, his hood and shoulder in the left foreground, the corridor in perfect symmetry, the far door closed, moonlight on the floor. | The far door slowly swings open by itself into pitch darkness; the moonlight rectangle on the floor fades away. Foma stays still. Static camera. |
| SH06 | Extreme close-up of Foma's mask in near darkness, the glowing eyes as the main light source. | Foma freezes; his glowing eyes slowly narrow and dim slightly. Very slow push-in. Tiny breathing motion of the hood. |
| SH07 | (POV) Point-of-view shot down the corridor toward the open dark doorway, the end of a flashlight beam trembling on the frame. | The flashlight beam trembles and reaches into the doorway, but the darkness swallows it completely. Slow push-in. |
| SH08 | Medium shot of Foma facing the far doorway, flashlight raised. | Foma takes one sudden step back, the flashlight slips in his hand and he catches it clumsily. Static camera. |
| SH09 | (без Фомы, класс C) Wide shot of the open doorway at the end of the corridor, pure black inside, thin haze in front. | Композитинг: слой тумана с параллаксом, лёгкое «дыхание» темноты (виньетка ±3%), зерно. |

Для каждого кадра A генерируются 3 дубля в Kling и 3 в Seedance с **одним и тем же** ключевым кадром.

## Порядок работ

| Шаг | Что | Кто | Статус |
|---|---|---|---|
| 0 | Сценарий, шот-лист, реплики, аниматик, черновой голос | я | ✅ готово |
| 1 | Получить утверждённый дизайн Фомы → заполнить TBD в `foma.yaml` | ты → я | ✅ лист получен, паспорт v1.0 |
| 2 | Эталонный пакет: master, turnaround, лист маски, позы, 3 схемы света (≈40–80 генераций, отбор ~15) | я (через API) + ты (утверждение) | ⏳ ждёт доступа к генерации |
| 3 | Плейт локации, 9 ключевых кадров, QC-1 | я | ⏳ |
| 4 | A/B-генерация: 5 кадров A × 3 дубля × 2 модели + кадры B | я (через API) или ты (по моим промптам в веб-интерфейсе) | ⏳ |
| 5 | QC-2: стоп-кадры каждые 0.5 с, таблица ошибок по чеклисту `03_foma_consistency.md` | я | ⏳ |
| 6 | Кастинг голоса: Qwen3-TTS (дизайн и клон), Chatterbox, Piper — 4 движка, 2 раунда, замеры | я + ты (выбор) | ✅ кандидат `FOMA_VOICE_V1`, ждёт утверждения на слух (`voice/README.md`) |
| 7 | Звук: процедурный синтез 7 слоёв (`tools/sfx_synth.py`) + микс (`tools/mix_t01.py`) | я | ✅ |
| 8 | Сборка 2 версий (Kling-версия и Seedance-версия) | я | ⏳ |
| 9 | Отчёт: стабильность %, дублей на кадр, стоимость, выбор модели, рекомендации | я | ⏳ |

## Критерии приёмки теста

| Метрика | Цель | Если не достигнута |
|---|---|---|
| Дубли кадров A, прошедшие «критично» с первой попытки | ≥ 60% | < 60% → LoRA; < 30% → 3D-манекен |
| Асимметрия маски верна во всех принятых кадрах | 100% | обязательный повтор |
| Среднее число дублей на годный кадр A | ≤ 4 | пересчёт бюджета выпуска |
| Читаемость эмоций без лица (оцениваешь ты) | ирония в SH04 и страх в SH06 считываются без звука | ищем язык глаз: размер/яркость/мерцание, при необходимости — дорисовка свечения в посте |
| Звук | речь разборчива, музыка/эмбиент не перекрывают, нет скачков громкости | перемикс |
| Монтаж | нет скачков между кадрами, действие непрерывно | перегенерация стыков (end frame → start frame) |

**Только после прохождения T-01** — планируем пилотный выпуск (рекомендую 12–15 минут).

## Статус на 04.11.2026: собран 3D-превиз v2

Генерация видео по-прежнему недоступна (нет GPU и оплаченного сервиса), поэтому тест собран как **3D-превиз**: манекен по утверждённому листу, тайминг и камера из шот-листа, финальный голос, процедурный звук. Результат и QC: [`production/ep000_test/QC_T01_v2.md`](../production/ep000_test/QC_T01_v2.md).
Шаги 2–5 (эталоны и генерация видео в стиле листа, A/B Kling vs Seedance) ждут доступа к генерации.
