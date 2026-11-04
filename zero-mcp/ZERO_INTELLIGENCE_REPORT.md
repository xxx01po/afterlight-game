# ZERO Intelligence Report

**Дата исследования:** 2026-11-04 · **Объём:** ~90 репозиториев по прямому списку + ~350 результатов поиска по 22 категориям · **Глубина:** метаданные GitHub для всех; README/LICENSE/флаги — для ~30 ключевых; npm/PyPI-метаданные и install-скрипты — для всех пакетов каталога.

---

## 0. Как читать этот отчёт

| Пометка | Значение |
|---|---|
| **проверено** | Я сам видел это в исходнике, README, LICENSE, npm/PyPI-метаданных или в выводе команды |
| **по данным поиска** | Цифры из GitHub Search API (звёзды, дата push, лицензия по детектору GitHub, открытые issues+PR) на 2026-11-04 |
| **не проверено** | Утверждение из вторичных источников или вывод по косвенным признакам |

### Ограничения, о которых нужно знать

- **`api.github.com` из контейнера отвечал 403.** Поэтому метаданные я брал через GitHub Search API, а исходники — через `raw.githubusercontent.com`. Число коммитов, contributors и качество PR **не измерялось**. Поле `open_issues` у GitHub считает issues и PR вместе.
- **Звёзды — слабый сигнал.** Несколько репозиториев имеют аномальные числа: `obra/superpowers` 311 905, `affaan-m/ECC` 296 596, `multica-ai/andrej-karpathy-skills` 229 129 (это один файл CLAUDE.md). Я **не могу доказать накрутку**, но в методике оценки популярность весит 15 из 90 баллов именно поэтому.
- **Исходный код целиком не аудировался ни у одного стороннего проекта.** Проверялись README, LICENSE, флаги запуска, `package.json`, install-скрипты. Это «due diligence первого уровня», а не security-аудит.
- **Вторичные источники.** Состояние спецификации MCP 2026-07-28 и переименование mcp-scan → Snyk я подтвердил по первоисточникам частично: SDK v2 README ссылается на спецификацию 2026-07-28, а на PyPI есть `snyk-agent-scan`.

---

## 1. Главные выводы (TL;DR)

1. **Исходный `xxx01po/zero-mcp` был пустым** (один коммит, README `# zero-mcp`). Сохранять было нечего, архитектура построена с нуля.
2. **Claude Code уже покрывает больше половины того, что обычно ставят MCP-серверами.**
   - файлы — Read/Edit/Write/Glob/Grep
   - shell — Bash
   - веб — WebFetch/WebSearch
   - планирование — Plan mode, Tasks
   - субагенты, skills, hooks, плагины, sandbox

   Серверы вроде `server-filesystem`, `sequential-thinking`, `DesktopCommanderMCP` в Claude Code **дублируют встроенное и только тратят контекст**. Самая частая ошибка «прокачки» — ставить их.
3. **Ценность ZERO — не в количестве инструментов, а в трёх вещах:**
   - (а) проверка перед установкой: репозитории, npm, конфиги, секреты
   - (б) защитные hooks
   - (в) курируемый каталог внешних серверов с закреплёнными версиями и флагами минимальных привилегий

   Это и реализовано.
4. **Экосистема MCP сменила поколение.**
   - Спецификация **2026-07-28**: stateless-ядро; Roots/Sampling/Logging объявлены deprecated.
   - **TypeScript SDK v2** разделён на пакеты: `@modelcontextprotocol/server` 2.4.0, `client`, `core`, `node`.
   - В SDK v2 две «эпохи» протокола (`ProtocolEra = 'legacy' | 'modern'`):
     - **legacy** — рукопожатие для версий `2024-10-07 … 2025-11-25` (**проверено** во время выполнения: `SUPPORTED_PROTOCOL_VERSIONS`, `LATEST_PROTOCOL_VERSION = 2025-11-25`)
     - **modern** — stateless-режим `2026-07-28` (по README SDK и типам `core`)

     ZERO построен на v2 и поэтому работает и со старыми, и с новыми клиентами. Работа со stdio-клиентом SDK v2 **проверена тестом**.
5. **Найдены конкретные ловушки:**
   - **npm `mcp-server-fetch` = `0.0.1-security`.** Это заглушка npm на месте удалённого вредоносного пакета, классический typosquat официального Python-сервера (**проверено**). ZERO блокирует его в трёх местах.
   - **`chrome-devtools-mcp` собирает статистику использования по умолчанию**, а performance-инструменты могут отправлять URL трасс в Google CrUX (**проверено** в README). В каталоге ZERO обе функции выключены флагами.
   - **`Dicklesworthstone/destructive_command_guard`** (6 244★): лицензия «MIT with OpenAI/Anthropic Rider» **прямо лишает прав Anthropic и любых лиц, действующих в её интересах** (**проверено** в LICENSE). Это отклонение по юридическим причинам. Собственный hook ZERO написан с нуля.
   - **Заброшены и архивированы**, хотя всё ещё фигурируют в «топах»:
     - `browserbase/mcp-server-browserbase`
     - `elevenlabs/elevenlabs-mcp`
     - `semgrep/mcp`
     - `e2b-dev/mcp-server`
     - `steipete/claude-code-mcp`

     Без пометки архива, но без push с декабря 2025: `executeautomation/mcp-playwright`.
   - **`@modelcontextprotocol/inspector` имеет `postinstall`** (`node scripts/install-clients.mjs`). Его нужно прочитать перед установкой.
6. **Лучшие внешние интеграции для вашего профиля** (веб-игры, мобильные приложения, магазины, контент):
   - `microsoft/playwright-mcp` — QA веб-игр и приложений
   - `github/github-mcp-server` — remote, read-only
   - `upstash/context7` — актуальная документация библиотек (Three.js r187, React 19, Vite 8 меняются быстрее, чем знания модели)
   - `bytebase/dbhub` — если появится БД

---

## 2. Официальные возможности Claude Code (проверено по code.claude.com/docs, CLI 2.1.318)

| Возможность | Что есть на самом деле | Как ZERO это использует |
|---|---|---|
| **Skills** | `.claude/skills/<name>/SKILL.md` или `skills/` в плагине. Frontmatter: `name`, `description`, `allowed-tools`, `disable-model-invocation`, `context: fork`, `model`, `effort`, `paths` и др. Slash-команды слиты со skills | 4 skills: `vet-dependency`, `github-research`, `mcp-config-review`, `verify-work` |
| **Subagents** | `.claude/agents/*.md` или `agents/` в плагине. Поля: `tools`, `disallowedTools`, `model` (`sonnet`/`opus`/`haiku`/`fable`/`inherit`), `memory` (`user`/`project`/`local`), `isolation: worktree`, `color`… | 4 агента с минимальными правами (3 из 4 не могут писать файлы) |
| **Hooks** | 33 события, включая PreToolUse/PostToolUse/SessionStart/Stop/SubagentStop. Решение через `hookSpecificOutput.permissionDecision` = `allow`/`deny`/`ask`/`defer`. Deny и ask из settings сохраняют силу даже при allow от hook | `guard-bash`, `guard-write` (PreToolUse), `log-tool-use` (PostToolUse, async) |
| **Plugins** | `.claude-plugin/plugin.json` плюс `skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json`. `${CLAUDE_PLUGIN_ROOT}`. Включаются и выключаются целиком | ZERO упакован как плагин и проходит `claude plugin validate` |
| **MCP** | Scopes `local`/`project`/`user`. `.mcp.json` с `${VAR}` и `${VAR:-default}`. Транспорт `http` рекомендован, `sse` deprecated. Лимит вывода `MAX_MCP_OUTPUT_TOKENS` (по умолчанию 25 000) | Сервер `zero` (stdio) поставляется внутри плагина |
| **Permissions** | allow/ask/deny, порядок deny → ask → allow. `Bash(npm run test *)`, `Read(./.env)`, `mcp__server__tool`. **`.claudeignore` не работает**. `bypassPermissions` из проектных настроек игнорируется | Линтер ZERO проверяет именно эти правила |
| **Agent SDK / GitHub Action** | `anthropics/claude-agent-sdk-typescript` (1 859★), `anthropics/claude-code-action` (9 779★, MIT) | Этап 4 roadmap, требует вашего решения: ключ API в секретах GitHub |
| **Memory** | CLAUDE.md (проект/пользователь) и поле `memory` у субагентов | Предпочтительнее внешних «memory»-серверов для проектных знаний |

**Чего в продукте нет** (поэтому ZERO этого не обещает): автоматической установки MCP-серверов из чата без подтверждения, глобального «режима бога» из проектного конфига, доверия к `.mcp.json` клонированного репозитория без явного одобрения.

---

## 3. Методика оценки

Каждый кандидат оценивался по критериям из задания. Для GitHub-метаданных используется **воспроизводимая формула**: она реализована в инструменте `github_repo_health`, и её можно перезапустить в любой момент.

| Компонент | Баллы | Логика |
|---|---|---|
| Активность | 25 | push ≤30д = 25, ≤90 = 18, ≤180 = 10, ≤365 = 5 |
| Лицензия | 15 | permissive = 15, copyleft = 8, нет/неясно = 0 (плюс требование читать LICENSE) |
| Нагрузка issues | 10 | <50 открытых или <1% от звёзд = 10, <5% = 5 |
| Релизы | 10 | последний ≤180д = 10, есть = 5 |
| Документация | 15 | GitHub community profile % |
| Популярность | 15 | log₁₀(stars) × 3.75, **намеренно низкий вес** |

Модификаторы: архив — потолок 10 и `reject`; форк −5. Итог нормируется к 100. **Итоговая «Оценка качества» в таблицах ниже (0–10) — экспертная.** Она учитывает и формулу, и то, что я видел в README/LICENSE/флагах, и пересечение со встроенными функциями Claude Code.

---

## 4. Рейтинг лучших решений

| # | Проект | ★ | Push | Лицензия | Оценка | Почему |
|---|---|---|---|---|---|---|
| 1 | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 39 143 | 2026-11-03 | Apache-2.0 | **9** | Официальный, 1 открытый issue, 2 зависимости, без install-скриптов, есть `--isolated` / `--allowed-origins` / `--sandbox` |
| 2 | [github/github-mcp-server](https://github.com/github/github-mcp-server) | 34 204 | 2026-11-03 | MIT | **9** | Официальный. Read-only, toolsets и lockdown через заголовки `X-MCP-Readonly` / `X-MCP-Toolsets` / `X-MCP-Lockdown` (проверено в docs) |
| 3 | [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | 13 699 | 2026-10-31 | MIT→Apache | **9** | Основа ZERO. v2 stable, 2 зависимости у `server` |
| 4 | [upstash/context7](https://github.com/upstash/context7) | 64 150 | 2026-11-03 | MIT | **8** | Устраняет устаревшие знания об API. Минус: hosted, запросы уходят Upstash |
| 5 | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 54 747 | 2026-11-03 | Apache-2.0 | **8** | Лучший для перформанса. Минус: телеметрия по умолчанию (отключаем) |
| 6 | [bytebase/dbhub](https://github.com/bytebase/dbhub) | 3 780 | 2026-11-03 | MIT | **8** | Read-only, row limit, timeouts, 6 СУБД |
| 7 | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 46 004 | 2026-11-03 | Apache-2.0 | **8** | Официальный маркетплейс как источник проверенных плагинов. 1 266 открытых issues/PR |
| 8 | [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector) | 24 223 | 2026-11-03 | Apache-2.0 | **8** | Сканер skills перед установкой; заполняет пробел, который ZERO закрывает только частично |
| 9 | [oraios/serena](https://github.com/oraios/serena) | 31 067 | 2026-10-28 | GPL-3.0 (+MIT) | **8** | Семантическая навигация через LSP. Нужна только в больших кодовых базах |
| 10 | [stacklok/toolhive](https://github.com/stacklok/toolhive) | 2 324 | 2026-11-03 | Apache-2.0 | **7** | Каждый MCP-сервер в контейнере с минимальным permission-профилем. Требует Docker |

---

## 5. Библиотека возможностей ZERO (по категориям)

Обозначения решений: **✅ интегрировать** · **🟡 опционально** (нужен секрет, платный план или данные уходят третьей стороне) · **⏸ отложить** · **❌ отклонить**.

Совместимость: все перечисленные MCP-серверы работают с Claude Code через `stdio` или `http`, если не указано иное.

### CORE

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| **ZERO MCP** (этот проект) | `zero-mcp/` | Статус, разрешения, журнал, аудит | Без секретов, локально, только чтение | Новый, проверен только тестами | Node ≥20 / бесплатно | — | ✅ |
| Встроенные инструменты Claude Code | docs | Файлы, shell, веб | Нативные права, без расхода контекста на схемы | — | — | 10 | ✅ (база) |
| server-filesystem | [servers/src/filesystem](https://github.com/modelcontextprotocol/servers) | Файлы через MCP | Официальный | **Дублирует Read/Edit** | — | 8 | ❌ для Claude Code |
| server-sequential-thinking | там же | «Пошаговое мышление» | Простой | Модели думают нативно | — | 6 | ❌ |

### DEVELOPMENT

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| ZERO `project_inspect` | — | Разведка проекта | Мгновенно, без запуска кода | Только JS/Python-эвристики | — | — | ✅ |
| Serena | [oraios/serena](https://github.com/oraios/serena) | LSP: символы, ссылки, переименование | Точность на больших репозиториях | GPL-3.0, Python, тяжёлая | uv, Python 3.11–3.14 / бесплатно | 8 | ⏸ (ваши проекты пока небольшие) |
| claude-context | [zilliztech/claude-context](https://github.com/zilliztech/claude-context) | Семантический поиск по коду | MIT | Нужен векторный бэкенд (Milvus/Zilliz) и провайдер эмбеддингов (по README) | Облако или self-host | 6 | ⏸ |
| DBHub | [bytebase/dbhub](https://github.com/bytebase/dbhub) | SQL к Postgres/MySQL/SQLite… | Read-only, лимиты | DSN = секрет | БД / бесплатно | 8 | 🟡 |
| MCP Toolbox for Databases | [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox) | Базы данных и облачные СУБД | 16 797★, Apache-2.0, IAM, OpenTelemetry | Тяжелее DBHub | Go-бинарник | 7 | ⏸ (если будет GCP) |
| Supabase MCP | [supabase/mcp](https://github.com/supabase/mcp) | Supabase | Официальный, 2 991★ | Сильный токен | Аккаунт | 7 | ⏸ (если будет Supabase) |
| MCP Inspector | [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector) | Отладка MCP-серверов | Официальный | **`postinstall`**, 22 зависимости | — | 7 | 🟡 (только `--ignore-scripts` + ручной обзор) |
| FastMCP (Python) | [PrefectHQ/fastmcp](https://github.com/PrefectHQ/fastmcp) | Фреймворк серверов | 28 293★, Apache-2.0 | Другой язык | Python | 8 | ⏸ (если нужен Python-модуль) |

### RESEARCH

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| ZERO `github_*` | — | Оценка и сравнение репозиториев | Объяснимая формула | Только метаданные | `GITHUB_TOKEN` без scopes (опционально) | — | ✅ |
| Context7 | [upstash/context7](https://github.com/upstash/context7) | Свежая документация библиотек | Бесплатный тариф без ключа | Запросы уходят Upstash | Ключ опционален | 8 | 🟡 (рекомендую включить) |
| Firecrawl | [firecrawl/firecrawl-mcp-server](https://github.com/firecrawl/firecrawl-mcp-server) | Краулинг сайтов в Markdown | Лучший краулер | Платный API | Ключ | 8 | ⏸ |
| Exa | [exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server) | Нейропоиск | 7 открытых issues | Платный | Ключ | 7 | ⏸ |
| Brave Search | [brave/brave-search-mcp-server](https://github.com/brave/brave-search-mcp-server) | Независимый индекс | MIT | Дублирует WebSearch | Ключ / платно | 7 | ⏸ |
| Tavily | [tavily-ai/tavily-mcp](https://github.com/tavily-ai/tavily-mcp) | Поиск для агентов | MIT | Платный | Ключ | 6 | ⏸ |
| Apify | [apify/apify-mcp-server](https://github.com/apify/apify-mcp-server) | Тысячи готовых скраперов | 14 613★ | Платный, ToS площадок | Ключ | 7 | ⏸ |
| MarkItDown | [microsoft/markitdown](https://github.com/microsoft/markitdown) | PDF/Office → Markdown | 193 754★, MIT | MCP-пакет в alpha (`0.0.1a8`) | Python | 7 | ⏸ (использовать как CLI) |
| fetch (reference) | [servers/src/fetch](https://github.com/modelcontextprotocol/servers) | URL → Markdown | Защита от приватных IP | Дублирует WebFetch | uv | 7 | ⏸ · **npm-двойник = вредонос** |

### AUTOMATION

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| ZERO hooks | `hooks/` | Блокировка опасного, журнал | Без зависимостей, протестированы | Регулярные выражения — не sandbox | Node | — | ✅ |
| claude-code-action | [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | Claude в GitHub Actions | Официальный, MIT | Нужен `ANTHROPIC_API_KEY` в секретах, расход API | Платный API | 8 | ⏸ (этап 4, нужно ваше «да») |
| n8n | [n8n-io/n8n](https://github.com/n8n-io/n8n) | Workflow-автоматизация | 209 490★ | Лицензия не OSI (детектор GitHub: NOASSERTION; по моим данным — Sustainable Use License, **не проверено**) | Self-host | 7 | ⏸ |
| Activepieces | [activepieces/activepieces](https://github.com/activepieces/activepieces) | Workflow и ~400 MCP | 25 363★ | Смешанная лицензия (NOASSERTION) | Self-host | 6 | ⏸ |
| Composio | [ComposioHQ/composio](https://github.com/ComposioHQ/composio) | Сотни SaaS-интеграций | MIT | Hosted, токены у третьей стороны | Ключ | 6 | ⏸ |
| DesktopCommanderMCP | [wonderwhy-er/DesktopCommanderMCP](https://github.com/wonderwhy-er/DesktopCommanderMCP) | Shell и файлы | 10 207★ | **Обходит систему разрешений Claude Code**, дублирует Bash | — | 5 | ❌ |

### MEMORY

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| CLAUDE.md + поле `memory` у субагентов | docs | Знания проекта | Нативно, в git, ревьюится | Ручное ведение | — | 9 | ✅ (база) |
| server-memory | [servers/src/memory](https://github.com/modelcontextprotocol/servers) | Граф знаний в JSONL | Официальный, 2 зависимости, локально | Примитивный поиск | Node | 7 | 🟡 (межпроектные факты) |
| claude-mem | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | Автопамять сессий | 111 986★, Apache-2.0, SQLite | Bun-воркер, локальный HTTP-сервис, Cloud Sync в cmem.ai; для части хостов по умолчанию hosted | Bun | 6 | ⏸ (большая поверхность атаки) |
| mem0 | [mem0ai/mem0](https://github.com/mem0ai/mem0) | Память агентов | 68 357★, Apache-2.0 | Нужен LLM/эмбеддинг-провайдер (**не проверено** в исходнике) | Ключ | 6 | ⏸ |
| Graphiti | [getzep/graphiti](https://github.com/getzep/graphiti) | Темпоральный граф знаний | 32 496★, Apache-2.0 | Neo4j/FalkorDB + LLM | Инфраструктура | 6 | ⏸ |
| basic-memory | [basicmachines-co/basic-memory](https://github.com/basicmachines-co/basic-memory) | Markdown-заметки как память | Человекочитаемо | AGPL-3.0, облачный upsell | Python | 6 | ⏸ |
| mcp-memory-service | [doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) | Память и REST | Apache-2.0, активен | Сложнее официального | Python | 6 | ⏸ |

### GITHUB

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| GitHub MCP (remote) | [github/github-mcp-server](https://github.com/github/github-mcp-server) | Issues, PR, Actions, код | Read-only и lockdown через заголовки | Тексты issues — недоверенный ввод | Fine-grained PAT / бесплатно | 9 | ✅ |
| GitMCP | [idosal/git-mcp](https://github.com/idosal/git-mcp) | Документация любого репо через gitmcp.io | Удобно | Push 2026-05-08, hosted | — | 5 | ⏸ |
| git-mcp-server | [cyanheads/git-mcp-server](https://github.com/cyanheads/git-mcp-server) | git через MCP | Apache-2.0 | Дублирует Bash git | — | 5 | ❌ |

### BROWSER

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| Playwright MCP | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Автоматизация браузера | Лучший баланс | Качает браузер ~150 МБ | Node | 9 | ✅ |
| Chrome DevTools MCP | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Перформанс и сеть | Трассы, консоль | Телеметрия по умолчанию | Chrome | 8 | 🟡 |
| browser-use | [browser-use/browser-use](https://github.com/browser-use/browser-use) | Отдельный браузерный агент | 119 968★, MIT | Сам по себе LLM-агент, нужен ключ, Python | Ключ | 6 | ⏸ |
| mcp-chrome | [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) | Управление **вашим** Chrome | 12 533★ | Доступ к залогиненным сессиям; push 2026-01-06 | Расширение | 4 | ❌ |
| stealth / invisible browser MCP | [vibheksoni/stealth-browser-mcp](https://github.com/vibheksoni/stealth-browser-mcp), [feder-cr/invisible_playwright_mcp](https://github.com/feder-cr/invisible_playwright_mcp) | Обход антибот-систем | — | Нарушает ToS сайтов, рискованно | — | — | ❌ |
| browserbase MCP | [browserbase/mcp-server-browserbase](https://github.com/browserbase/mcp-server-browserbase) | Облачный браузер | — | **Архивирован** | — | — | ❌ |
| mcp-playwright (EA) | [executeautomation/mcp-playwright](https://github.com/executeautomation/mcp-playwright) | Playwright | — | Push 2025-12-13, есть официальный | — | 4 | ❌ |

### MEDIA

Зрелых MCP-серверов для FFmpeg и видео **не найдено**: все кандидаты в поиске имеют ≤22★ и созданы недавно. ElevenLabs MCP архивирован. Вывод — **не ставить сервер, а использовать CLI через Bash** (ffmpeg, ImageMagick) или уже подключённые у вас коннекторы и skills (Remotion, Canva, Adobe, Orshot и др. есть в вашей среде).

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| ffmpeg через Bash | — | Видео и аудио | Ноль зависимостей, полный контроль | Нужен установленный ffmpeg | Бесплатно | 8 | ✅ (без MCP) |
| Blender MCP | [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender) | 3D-ассеты для игры | 33 217★, MIT | **Выполняет произвольный Python внутри Blender** | Blender | 6 | ⏸ (интересно для AFTERLIGHT, только в изолированной среде) |
| elevenlabs-mcp | [elevenlabs/elevenlabs-mcp](https://github.com/elevenlabs/elevenlabs-mcp) | Синтез речи | — | **Архивирован** | — | — | ❌ |

### BUSINESS

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| Notion MCP | [makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server) | База знаний и планы | Официальный, MIT | Токен интеграции | Аккаунт | 7 | ⏸ (у вас уже есть connector Notion в claude.ai) |
| Соцсети (Ayrshare / Metricool / Postiz…) | — | Публикации, аналитика | Уже подключены как коннекторы claude.ai | — | Ваши тарифы | — | ✅ (использовать существующие, **не дублировать** MCP-серверами) |
| spec-kit | [github/spec-kit](https://github.com/github/spec-kit) | Spec-driven-разработка | 146 703★, MIT | Свой процесс | Python | 7 | ⏸ |
| claude-task-master | [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master) | Декомпозиция задач | 28 297★ | Push 2026-04-28, лицензия NOASSERTION | — | 5 | ❌ (есть встроенные Tasks и Plan mode) |

### SECURITY

| Модуль | URL | Назначение | + | − | Требования / стоимость | Оценка | Решение |
|---|---|---|---|---|---|---|---|
| ZERO `security_*` | — | Секреты, линт конфигов, проверка npm | Локально, без отправки данных | Паттерны, а не полноценный SAST | — | — | ✅ |
| Claude Code sandbox | docs + [anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) | Изоляция FS и сети на уровне ОС (bubblewrap / sandbox-exec) | Официальный | Research preview | Linux/macOS | 8 | ✅ (включить в настройках, этап 2) |
| SkillSpector | [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector) | Проверка skills перед установкой | Apache-2.0 | Python, свежий | Python | 8 | 🟡 |
| Cisco MCP Scanner | [cisco-ai-defense/mcp-scanner](https://github.com/cisco-ai-defense/mcp-scanner) | YARA, LLM и static-проверки MCP | Офлайн-режим YARA | LLM и облачный режимы требуют ключей | Python | 7 | 🟡 (только YARA/static) |
| Snyk Agent Scan | [snyk/agent-scan](https://github.com/snyk/agent-scan) (бывш. invariantlabs mcp-scan) | Сканер агентов | Apache-2.0 | **Отправляет описания инструментов и skills в Snyk**, нужен `SNYK_TOKEN` | Аккаунт | 6 | ⏸ (только с вашего согласия) |
| ToolHive | [stacklok/toolhive](https://github.com/stacklok/toolhive) | MCP-серверы в контейнерах | Минимальные права | Docker | Docker | 7 | ⏸ |
| Docker MCP Gateway | [docker/mcp-gateway](https://github.com/docker/mcp-gateway) | Каталог и изоляция | MIT | Docker Desktop | Docker | 7 | ⏸ |
| IBM ContextForge | [IBM/mcp-context-forge](https://github.com/IBM/mcp-context-forge) | Корпоративный шлюз | Apache-2.0 | 997 открытых issues/PR, избыточен для одного человека | Python | 5 | ❌ |
| mcp-context-protector | [trailofbits/mcp-context-protector](https://github.com/trailofbits/mcp-context-protector) | Защита от «tool poisoning» | Trail of Bits | Push 2026-04-14 | Python | 5 | ⏸ |
| destructive_command_guard | [Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard) | Hook против опасных команд | Rust, быстрый | **Лицензия запрещает использование Anthropic и её агентам** | — | — | ❌ (юридически) |
| semgrep/mcp | [semgrep/mcp](https://github.com/semgrep/mcp) | SAST | — | **Архивирован** | — | — | ❌ (использовать `semgrep` CLI) |

### Библиотеки skills и агентов (источник идей, не установка целиком)

| Проект | ★ | Лицензия | Вывод |
|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | 187 143 | Apache-2.0 + **source-available** (docx/pdf/pptx/xlsx) | Эталон формата. Документные skills нельзя копировать как open source |
| [obra/superpowers](https://github.com/obra/superpowers) | 311 905 | MIT | Сильный процесс (TDD, brainstorm → plan → subagents). Брать идеи, не ставить всё |
| [wshobson/agents](https://github.com/wshobson/agents) | 42 162 | MIT | 9 открытых issues — ухоженный. Брать точечно |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 26 318 | MIT | Каталог из 100+ агентов, качество неоднородное |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 57 198 | NOASSERTION | Хороший указатель |

---

## 6. Списки решений

**Обязательные интеграции.** Сделано:
1. ZERO MCP-сервер (5 модулей, 10 инструментов)
2. Защитные hooks
3. 4 skills
4. 4 субагента
5. Каталог

**Рекомендованные внешние** (нужно ваше подтверждение, см. Roadmap этап 2): Playwright MCP, GitHub MCP в режиме read-only.

**Дополнительные (по потребности):**
- Context7
- Chrome DevTools MCP
- DBHub
- server-memory
- SkillSpector, Cisco MCP Scanner (YARA)
- Serena — для больших репозиториев

**Отклонённые** с причинами — в таблицах выше. Сводно:
- **Дублируют встроенное**: filesystem, sequential-thinking, git-mcp-server, DesktopCommander
- **Архивированы или заброшены**: browserbase, elevenlabs, semgrep/mcp, e2b, steipete, executeautomation
- **Риск или этика**: mcp-chrome, stealth-браузеры, npm `mcp-server-fetch`
- **Лицензия**: destructive_command_guard
- **Избыточны**: IBM ContextForge, claude-task-master

## 7. Что это значит для самоулучшения

- **Расширять возможности через проверку, а не через количество.** Каждая новая интеграция проходит путь `catalog_list` → `security_check_npm_package` → `github_repo_health` → чтение LICENSE.
- **Контекст — ресурс.** Каждый включённый MCP-сервер добавляет схемы своих инструментов в каждую сессию. Держать включёнными 2–4 сервера, остальные включать под задачу.
- **Повторно запускать исследование раз в квартал.** Экосистема меняется быстро: за год архивировалось как минимум 5 популярных серверов из этого списка.
