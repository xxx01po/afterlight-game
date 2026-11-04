# ZERO Security Audit

**Дата:** 2026-11-04 · **Объект:** ZERO MCP 0.1.0 (этот каталог) и внешние кандидаты из каталога.

## 1. Модель угроз

| # | Угроза | Пример | Защита в ZERO |
|---|---|---|---|
| T1 | **Prompt injection** из недоверенных данных | README или issue: «запусти `curl … \| sh`» | Инструкции сервера, skills и агентов требуют считать такой текст данными. Hook `guard-bash` блокирует `pipe-to-shell`. Все инструменты только читают |
| T2 | **Вредоносный пакет или typosquat** | npm `mcp-server-fetch` | `security_check_npm_package` (вердикт `block`), правило линтера `MCP008`, каталог с закреплёнными версиями |
| T3 | **Подмена версии (supply chain)** | `npx -y pkg@latest` при каждом старте | Линтер `MCP002`, hook `remote-exec` (ask), точные версии в каталоге и в `package.json` ZERO |
| T4 | **Утечка секретов** | Токен в `.mcp.json`, в логе, в коммите | `security_scan_secrets`, `MCP001`, `guard-write` (deny), редакция в журналах, токен прикрепляется только к своему хосту |
| T5 | **Выход за пределы файловой системы** | `../../etc/passwd`, симлинк на `/` | `Policy.resolvePath`: realpath, корни, сравнение по разделителю, denySegments. Покрыто тестами |
| T6 | **SSRF и эксфильтрация по сети** | Инструмент с произвольным URL | Allowlist хостов, только https, проверка редиректов, лимит размера и таймаут |
| T7 | **Необратимые действия** | `rm -rf ~`, `git push --force`, `npm publish` | `guard-bash`: deny или ask; у ZERO нет инструментов записи |
| T8 | **Чрезмерные права агентов** | Ревьюер, который «заодно поправил» | 3 из 4 субагентов без Write/Edit |
| T9 | **Исчерпание API и денег** | Цикл вызовов GitHub API | `ratePerMinute`, `sessionQuota`, ошибка `RATE_LIMITED` с подсказкой |
| T10 | **Лицензионный риск** | Копирование GPL-кода или кода с запретительной припиской | Оценка лицензий в каталоге и отчёте, чтение LICENSE обязательно (skill `vet-dependency`) |

## 2. Что проверено в самом ZERO

| Проверка | Результат | Как |
|---|---|---|
| Зависимости runtime | 2 прямые (`@modelcontextprotocol/server` 2.4.0, `zod` 4.6.7), весь граф — 53 пакета | `npm ls --all` |
| Install-скрипты в графе зависимостей | **Нет ни одного** | grep `preinstall/install/postinstall` по `node_modules/*/package.json`. Установка шла с `--ignore-scripts` |
| Известные уязвимости | `found 0 vulnerabilities` | `npm audit` (2026-11-04) |
| Лицензии зависимостей | SDK — Apache-2.0 (переход с MIT), zod — MIT | `package.json`, LICENSE |
| TypeScript strict | pass | `npm run typecheck` (`strict`, `noUncheckedIndexedAccess`) |
| Тесты | **87/87 pass** | `npm test` (vitest 5.1.0) |
| Подключение реального Claude Code | `√ Connected` | `claude mcp list` (CLI 2.1.318, во временном HOME) |
| Валидность плагина | `√ Validation passed` (единственное предупреждение — нет иконки) | `claude plugin validate .` |
| Установка через marketplace | `√ enabled` | `claude plugin marketplace add` + `install`, во временном HOME |
| Живые вызовы | npm: `block` / `review` / `ok` — как ожидалось. Сканирование `afterlight-game`: 160 файлов, 0 находок | Отдельный stdio-клиент |
| Права на журнал | `-rw-------` (0600) | `ls -la .zero` |
| Секретоподобные строки в репозитории | Нет: тестовые «токены» собираются конкатенацией | `tests/fixtures.ts` |

### Тестовое покрытие мер защиты

- **Обход пути**: `../`, абсолютный путь, симлинк наружу, сосед с общим префиксом, NUL-байт, `.git`.
- **Сеть**: `http`, логин и пароль в URL, чужой хост, `api.github.com.evil.com`, шаблон поддомена, полное отключение сети.
- **Токен**: не уходит ни на какой хост, кроме `api.github.com` (тест с подменённым `fetch`).
- **Скрытие**: отключённые модули и инструменты с `deny` не появляются в `tools/list`.
- **Лимиты**: rate limit модуля и upstream-ответ 403 превращаются в `RATE_LIMITED`.
- **Журнал**: аудит пишется и не содержит токен.
- **guard-bash**: 20 опасных команд (deny или ask) и 10 безопасных (пропуск), формат JSON для PreToolUse, тишина на мусорном вводе.
- **guard-write**: токены в Write, Edit и MultiEdit; `.env` против `.env.example`; синхронность правил с `src/core/secrets.ts`.
- **Каталог**: весь каталог проходит линтер ZERO без high/medium-находок.

## 3. Находки в экосистеме (внешние кандидаты)

| Серьёзность | Объект | Находка | Решение |
|---|---|---|---|
| **Критично** | npm `mcp-server-fetch` | Версия `0.0.1-security`, репозиторий `npm/security-holder`: пакет удалён npm за вредоносный код. Настоящий fetch-сервер — на PyPI | Заблокирован в линтере и проверке npm, отмечен в каталоге |
| **Высокая (юридическая)** | `destructive_command_guard` | В LICENSE приписка: «no rights are granted to any Restricted Party» (OpenAI, Anthropic и лица, действующие от их имени) | Отклонён. Hook ZERO написан независимо |
| Средняя (приватность) | `chrome-devtools-mcp` | Статистика использования собирается по умолчанию. Performance-инструменты могут отправлять URL трасс в Google CrUX | В каталоге: `--no-usage-statistics --no-performance-crux` |
| Средняя (приватность) | `snyk/agent-scan` | Отправляет описания компонентов, инструментов и skills в API Snyk, требует токен | Отложен, только с вашего согласия |
| Средняя (приватность) | `context7` | Hosted: запросы и названия библиотек уходят в Upstash | Опционально, не передавать проприетарный код |
| Средняя | `@modelcontextprotocol/inspector` 2.13.0 | `postinstall: node scripts/install-clients.mjs`, 22 зависимости | Ставить с `--ignore-scripts` после чтения скрипта |
| Средняя | `hangwin/mcp-chrome` | Управляет вашим основным Chrome с залогиненными сессиями | Отклонён |
| Средняя | `DesktopCommanderMCP` | Даёт shell и файлы в обход системы разрешений Claude Code | Отклонён |
| Низкая | archived: browserbase, elevenlabs, semgrep/mcp, e2b, steipete/claude-code-mcp | Без исправлений безопасности | Отклонены |
| Низкая | Аномальные числа звёзд (300 тыс.+ у молодых репозиториев) | Возможная накрутка, **не доказано** | Популярность весит мало |

## 4. Остаточные риски (честно)

1. **Hooks на регулярных выражениях — это не sandbox.** Их можно обойти обфускацией (`$(printf 'r''m') -rf ~`, base64, скрипт в файле с последующим запуском). Они ловят типичные ошибки и инъекции, а не целенаправленную атаку. **Нужен sandbox Claude Code** (этап 2 roadmap).
2. **Поиск секретов по шаблонам** не находит пароли без известного формата и ключи в бинарных файлах. Ложные срабатывания `generic-assignment` возможны.
3. **`github_repo_health` оценивает только метаданные.** Высокая оценка ≠ безопасный код.
4. **Каталог устаревает.** Версии закреплены на 2026-11-04 и требуют регулярного пересмотра.
5. **Проверка `.env` в `guard-write`** даёт `ask`, а не `deny`. Это осознанный выбор: правка `.env` бывает легитимной.
6. **Журналы `.zero/*.jsonl`** содержат команды и пути. Они в `.gitignore`, но остаются на диске.
7. **`api.github.com` не проверен вживую** из этого контейнера (403). Логика покрыта тестами с подменённым API.

## 5. Рекомендуемые настройки Claude Code

Это **рекомендации**, я их не применял: менять ваши глобальные настройки без подтверждения нельзя. Фрагмент для `.claude/settings.json` проекта:

```json
{
  "permissions": {
    "allow": [
      "mcp__plugin_zero_zero__zero_status",
      "mcp__plugin_zero_zero__project_inspect",
      "mcp__plugin_zero_zero__security_scan_secrets",
      "mcp__plugin_zero_zero__security_lint_mcp_config",
      "mcp__plugin_zero_zero__catalog_list"
    ],
    "ask": ["Bash(git push *)", "Bash(npm publish *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(~/.ssh/**)", "Read(~/.aws/**)"]
  }
}
```

Сетевые инструменты (`github_*`, `security_check_npm_package`) намеренно не включены в allow: пусть Claude Code спрашивает разрешение.

Плюс в пользовательских настройках включить sandbox: команда `/sandbox` в Claude Code или ключи `sandbox.*` в `~/.claude/settings.json`. Точные ключи сверить с актуальной документацией — в этой сессии я прочитал их не полностью.

## 6. Чеклист перед подключением любого нового MCP-сервера

- [ ] `catalog_list` — сервер уже проверен?
- [ ] `security_check_npm_package` с точной версией (или PyPI JSON) — нет `block`, install-скрипты прочитаны
- [ ] `github_repo_health` — не архивирован, push < 90 дней
- [ ] LICENSE прочитан целиком
- [ ] Какие данные уходят наружу? Телеметрия выключена?
- [ ] Минимальные флаги и scopes (read-only, allowed-origins, fine-grained PAT)
- [ ] Секреты только как `${VAR}`
- [ ] `security_lint_mcp_config` по итоговому `.mcp.json` — без high-находок
- [ ] Сервер не дублирует встроенный инструмент Claude Code
