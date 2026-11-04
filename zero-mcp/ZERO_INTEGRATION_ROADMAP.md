# ZERO Integration Roadmap

Принцип: каждая интеграция — отдельный, обратимый шаг с проверкой. Пункты с пометкой **🔐 нужно подтверждение** я **не выполнял**: они требуют секретов, платных сервисов, изменения ваших глобальных настроек или публичных действий.

## Этап 0 — Аудит ✅ выполнено

- `xxx01po/zero-mcp` оказался пустым: один коммит, README `# zero-mcp`.
- Права на запись в `xxx01po/zero-mcp` в этой сессии не выданы. Поэтому ZERO лежит в `afterlight-game/zero-mcp/` на ветке `claude/zero-mcp-github-research-1it2rx`.
- Проведено исследование экосистемы, его результаты — в `ZERO_INTELLIGENCE_REPORT.md`.

## Этап 1 — Ядро ZERO ✅ выполнено и проверено

| Результат | Проверка |
|---|---|
| MCP-сервер на SDK v2: 5 модулей, 10 read-only инструментов | `npm run typecheck`, `npm run build` |
| Конфиг, разрешения, журнал, ошибки, лимиты, проверка зависимостей | 87/87 тестов, включая интеграцию через MCP-клиент (in-memory и stdio) |
| Hooks `guard-bash`, `guard-write`, `log-tool-use` | Тесты и ручной прогон через stdin |
| 4 skills и 4 субагента | `claude plugin validate .` → passed; `claude plugin details` → все компоненты загружаются |
| Каталог из 12 внешних серверов | Каталог проходит собственный линтер |
| Подключение к реальному Claude Code | `claude mcp list` → `√ Connected` |
| CI | `.github/workflows/zero-mcp.yml`, запускается только при изменениях в `zero-mcp/` |

## Этап 2 — Безопасная база на вашей машине 🔐 нужно подтверждение

Нужно ваше подтверждение, потому что меняются ваши глобальные настройки.

1. **Установить плагин** (инструкция — в `INSTALL.md`):

   ```bash
   cd zero-mcp && npm ci --ignore-scripts && npm run build
   claude plugin marketplace add ./zero-mcp
   claude plugin install zero@zero-local
   ```

2. **Включить sandbox Claude Code.** Он изолирует файловую систему и сеть для Bash на уровне ОС — то, чего hooks дать не могут.
3. **Добавить `deny` для `.env`, `~/.ssh` и `~/.aws`** в `~/.claude/settings.json` (фрагмент — в `ZERO_SECURITY_AUDIT.md` §5).
4. **Опционально:** экспортировать `ZERO_GITHUB_TOKEN`. Это fine-grained PAT **без каких-либо прав** (только публичные данные); он поднимает лимит с 60 до 5 000 запросов в час.

Стоимость: 0 ₽. Риск: низкий, всё обратимо (`claude plugin uninstall zero`).

## Этап 3 — Первые внешние серверы 🔐 нужно подтверждение

Нужно ваше подтверждение: нужен PAT, а у Context7 запросы уходят третьей стороне.

| Сервер | Зачем вам | Секрет | Стоимость | Команда |
|---|---|---|---|---|
| **Playwright MCP** `0.0.84` | Автоматическое прохождение и визуальная проверка AFTERLIGHT и других веб-проектов | — | 0 | `catalog_render_mcp_json { ids: ["playwright"] }` → в `.mcp.json` проекта |
| **GitHub MCP (remote, read-only)** | Issues, PR и CI по всем 8 вашим репозиториям | `GITHUB_PAT` (fine-grained, Read-only) | 0 | `claude mcp add --transport http github https://api.githubcopilot.com/mcp/ -H "Authorization: Bearer ${GITHUB_PAT}" -H "X-MCP-Readonly: true" -H "X-MCP-Lockdown: true" --scope user` |
| **Context7** | Свежая документация Three.js r187, React 19, Vite 8, Zustand 5 | опционально `CONTEXT7_API_KEY` | 0 (free tier) | `catalog_render_mcp_json { ids: ["context7"] }` |

После каждого сервера:

1. `security_lint_mcp_config` по итоговому файлу.
2. `/mcp` в Claude Code — убедиться, что сервер подключился.
3. Один реальный вызов.

## Этап 4 — Автоматизация разработки 🔐 нужно подтверждение

Нужно ваше подтверждение: это платный API и секреты в GitHub.

1. **`anthropics/claude-code-action`** — автоматическое ревью PR и исправление CI.
   - Нужен `ANTHROPIC_API_KEY` в Secrets репозитория, это платный расход API.
   - Рекомендую начать с одного репозитория и запуска по метке или упоминанию, а не на каждый push.
2. **Skill `verify-work` + субагент `test-runner`** как обязательный шаг перед коммитом. Можно сделать hook `Stop`, который напоминает о проверке. Требует решения, насколько это навязчиво.
3. **Исправить найденное в `afterlight-game`:** `npm run test:e2e` ссылается на несуществующий `tests/e2e/smoke.mjs`. Это ваш проект; правку делаю только по вашему слову.

## Этап 5 — Расширение по потребности ⏸

| Когда | Что | Секрет / стоимость |
|---|---|---|
| Появится база данных | DBHub `1.5.1` с read-only ролью | DSN / 0 |
| Кодовая база > 100 тыс. строк | Serena (GPL, отдельный процесс) | — / 0 |
| Нужен краулинг сайтов | Firecrawl | ключ / платно |
| Ставите чужие skills | SkillSpector, Cisco MCP Scanner (YARA, офлайн) | — / 0 |
| Много внешних серверов | ToolHive или Docker MCP Gateway (контейнерная изоляция) | Docker / 0 |
| 3D-ассеты для игры | Blender MCP — только в отдельной VM или контейнере | — / 0 |

## Этап 6 — Новые модули ZERO (идеи, реализуются по запросу)

1. **`pypi_check_package`** — аналог проверки npm для PyPI: yanked, возраст, typosquat, sdist против wheel.
2. **`skills_scan`** — статическая проверка `SKILL.md`, агентов и hooks чужого плагина перед установкой: shell-команды, сетевые вызовы, `bypassPermissions`, скрытые инструкции. Сейчас этот пробел частично закрывает SkillSpector.
3. **`catalog_diff`** — сравнение закреплённых версий каталога с актуальными в npm/PyPI и отчёт «что обновилось и что изменилось в install-скриптах».
4. **`lockfile_audit`** — разбор `package-lock.json` без `npm audit`: install-скрипты во всём дереве, пакеты не из registry.npmjs.org, git-зависимости.

## Оценка затрат и внешних зависимостей

| Компонент | Деньги | Внешние сервисы | Данные уходят наружу |
|---|---|---|---|
| ZERO (этапы 0–1) | 0 | registry.npmjs.org, api.github.com (только чтение) | Имена пакетов и репозиториев |
| Этап 2 | 0 | — | — |
| Playwright | 0 | Сайты, которые вы тестируете | — |
| GitHub MCP | 0 | api.githubcopilot.com | Запросы к вашим репозиториям |
| Context7 | 0 (free) / план Upstash | mcp.context7.com | Названия библиотек и запросы |
| claude-code-action | По тарифу Anthropic API | api.anthropic.com | Код в PR |
| Firecrawl / Exa / Brave | Платные тарифы | Их API | URL и запросы |

## Как перенести ZERO в `xxx01po/zero-mcp`

Перенос требует права записи в тот репозиторий; в этой сессии его не дали. Варианты:

```bash
# Вариант А — с сохранением истории каталога
git subtree split --prefix=zero-mcp -b zero-mcp-export
git push git@github.com:xxx01po/zero-mcp.git zero-mcp-export:main   # перезапишет README "# zero-mcp" — подтвердите

# Вариант Б — просто скопировать
cp -r zero-mcp/. ../zero-mcp/ && cd ../zero-mcp && git add . && git commit -m "Import ZERO MCP"
```

После переноса папку `zero-mcp/` и `.github/workflows/zero-mcp.yml` из `afterlight-game` можно удалить. Это тоже ваше решение.
