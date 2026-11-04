# ZERO Architecture

## 1. Идея в одной фразе

ZERO — это **плагин Claude Code**. Он даёт модели набор проверенных read-only инструментов (MCP-сервер `zero`), защитные hooks, skills и субагентов, а внешние MCP-серверы подключает **только через курируемый каталог** с закреплёнными версиями.

Аналогия: ZERO — не склад инструментов, а **отдел закупок и охраны** при мастерской. Мастерская (Claude Code) уже хорошо оснащена. ZERO проверяет каждый новый инструмент перед покупкой, ведёт журнал, ставит замки на опасные двери и держит короткий список проверенных поставщиков.

## 2. Слои

```
┌──────────────────────────── Claude Code (клиент) ─────────────────────────────┐
│  встроенные: Read/Edit/Bash/WebFetch/WebSearch, Plan, Tasks, permissions,    │
│  sandbox                                                                      │
│                                                                               │
│  ┌──────────────── плагин "zero" (.claude-plugin/plugin.json) ──────────────┐ │
│  │ skills/   vet-dependency · github-research · mcp-config-review ·         │ │
│  │           verify-work                                                    │ │
│  │ agents/   security-auditor · repo-scout · code-reviewer · test-runner    │ │
│  │ hooks/    PreToolUse: guard-bash, guard-write │ PostToolUse: log-tool-use│ │
│  │ .mcp.json → MCP-сервер "zero" (stdio, node dist/index.js)                │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  внешние MCP-серверы (по одному, из catalog/servers.json, после проверки):    │
│  playwright · github (remote, read-only) · context7 · dbhub · …               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Почему не шлюз (gateway/proxy), который проксирует все серверы через ZERO?**

1. Claude Code сам умеет работать с несколькими серверами и даёт права на уровне каждого инструмента (`mcp__server__tool`). Прокси спрятал бы эти права за одним именем.
2. Прокси — единая точка отказа и единая точка компрометации: он видит все токены.
3. Зрелые шлюзы уже существуют (Docker MCP Gateway, ToolHive, IBM ContextForge), и писать свой было бы дублированием.

ZERO выбирает композицию на уровне плагина, а изоляцию — через sandbox Claude Code или ToolHive.

## 3. MCP-сервер `zero`

### 3.1 Конвейер вызова

Каждый инструмент проходит **один и тот же** путь (`src/core/module.ts → ModuleRegistry.invoke`):

```
вызов → схема zod (SDK) → Policy.assertTool → UsageMeter.consume → handler
      → AuditLog.record (аргументы с редакцией секретов) → ответ / [ERROR_CODE] + Hint
```

Внутри handler инструмент обращается к ресурсам **только** через `ctx.policy` (пути и URL) и `ctx.http` (сеть). Прямого `process.env` у инструментов нет: модуль получает только те переменные, которые объявил в `requires.env`.

### 3.2 Модули

| Модуль | Инструменты | Сеть | Секреты |
|---|---|---|---|
| `zero` | `zero_status`, `zero_audit_tail` | — | — |
| `project` | `project_inspect` | — | — |
| `security` | `security_scan_secrets`, `security_lint_mcp_config`, `security_check_npm_package` | registry.npmjs.org | — |
| `github` | `github_repo_health`, `github_compare_repos` | api.github.com | `GITHUB_TOKEN` (опционально, без scopes) |
| `catalog` | `catalog_list`, `catalog_render_mcp_json` | — | — |

Все инструменты помечены `readOnlyHint: true`. Сетевые дополнительно помечены `openWorldHint: true`.

**Модуль** — это объект `ZeroModule`:

```ts
{
  name,
  description,
  defaultEnabled,
  requires: { env, hosts },
  tools: ToolDef[],
}
```

Модули независимы: один модуль не импортирует другой. Общий код живёт только в `core/`.

### 3.3 Единая конфигурация

Конфигурация лежит в файле `zero.config.json`: в корне проекта, по пути из `$ZERO_CONFIG` или в `.zero/config.json`. Если файла нет, работают безопасные значения по умолчанию. Конфиг валидируется схемой zod, и ошибка сообщает конкретное поле. JSON Schema для автодополнения в редакторе лежит в `config/zero.config.schema.json`, пример — в `config/zero.config.example.json`.

```jsonc
{
  "modules": {
    "github": { "enabled": true, "ratePerMinute": 20, "sessionQuota": 300 },
    "catalog": { "tools": { "catalog_render_mcp_json": "deny" } } // инструмент исчезает из списка
  },
  "filesystem": { "allowedRoots": ["."], "denySegments": [".git", "node_modules", ".ssh"] },
  "network": { "enabled": true, "allowedHosts": ["api.github.com", "registry.npmjs.org"] },
  "audit": { "enabled": true, "path": ".zero/audit.jsonl" }
}
```

**Секретов в конфиге нет по построению.** Они приходят только из переменных окружения.

### 3.4 Централизованные разрешения (`core/permissions.ts`)

- **Модуль и инструмент.** Отключённый модуль или инструмент с `deny` **не регистрируется вовсе**: модель его не видит, и контекст не тратится. При вызове проверка повторяется ещё раз, это вторая линия защиты.
- **Файлы:**
  - путь вычисляется относительно проекта
  - симлинки раскрываются через `realpath` до проверки
  - путь должен лежать внутри `allowedRoots`
  - сравнение идёт по разделителю пути, поэтому `/proj-evil` не считается частью `/proj`
  - `denySegments` закрывают `.git`, `node_modules`, `.ssh` и подобные каталоги
  - при обходе каталогов симлинки не раскрываются
- **Сеть:**
  - только `https`
  - логин и пароль в URL запрещены
  - хост должен совпадать с allowlist точно или по шаблону `*.domain`
  - редиректы проверяются заново на каждом шаге
  - таймаут и лимит размера ответа
- **Токены.** `GITHUB_TOKEN` прикрепляется **только** к `api.github.com`. Тест проверяет, что запросы никуда больше не уходят.

### 3.5 Журналирование

- **`.zero/audit.jsonl`** — JSONL с правами `0600`. Поля: `ts`, `module`, `tool`, `outcome` (`ok` / `error` / `denied` / `rate_limited`), `durationMs`, `args` (после глубокой редакции секретов), `errorCode`.
- **Кольцевой буфер** на 200 записей, который читает `zero_audit_tail`.
- **Hook `log-tool-use`** пишет в `.zero/claude-actions.jsonl` журнал **всех** действий Claude Code: инструмент и короткое отредактированное описание, без содержимого файлов.

### 3.6 Обработка ошибок

Все ошибки приводятся к `ZeroError` с кодом:

`PERMISSION_DENIED` · `INVALID_INPUT` · `RATE_LIMITED` · `NOT_FOUND` · `UPSTREAM_ERROR` · `TIMEOUT` · `DEPENDENCY_MISSING` · `INTERNAL`

Модель получает ответ `isError: true` с текстом `[CODE] сообщение\nHint: что сделать`. Стек вызовов пишется только в stderr и только для `INTERNAL`. Stdout зарезервирован под протокол MCP.

### 3.7 Проверка зависимостей

- `zero_status` (из чата) и `node dist/index.js --doctor` (из терминала, код выхода 1 при `blocked`) проверяют для каждого модуля объявленные переменные окружения и хосты.
- Статусы: `ok` / `degraded` (нет опционального) / `blocked` (нет обязательного) / `disabled`.
- Каталог при загрузке валидируется схемой и проверкой «нет литеральных секретов». Тест прогоняет весь каталог через линтер ZERO.

### 3.8 Контроль использования API

`UsageMeter`:

- **token bucket `ratePerMinute`** сглаживает всплески. Неаутентифицированный GitHub API даёт всего 60 запросов в час.
- **`sessionQuota`** — жёсткий потолок на время жизни процесса, то есть на одну сессию Claude Code.
- Счётчики видны в `zero_status`. Upstream-ответы 403 и 429 превращаются в `RATE_LIMITED` с временем сброса.

## 4. Как добавить модуль (расширение)

1. Создайте файл `src/modules/<name>.ts` и экспортируйте из него `ZeroModule`. Имена инструментов должны начинаться с `<name>_`, иначе реестр не запустится.
2. Опишите `input` через zod с `.describe()`, а `description` пишите для модели: что делает инструмент, когда его вызывать и что он возвращает.
3. Обращайтесь к ресурсам только через `ctx.policy` и `ctx.http`. Новые хосты добавьте в `requires.hosts`, а пользователь включит их в `network.allowedHosts`.
4. Добавьте модуль в `src/modules/index.ts`.
5. Напишите модульный тест и интеграционный тест через `InMemoryTransport`.

Если функция уже есть во внешнем сервере, **сначала добавьте его в `catalog/servers.json`** (решение, закреплённая версия, флаги) и не переписывайте.

## 5. Компоненты Claude Code

| Компонент | Файл | Права |
|---|---|---|
| `vet-dependency` | `skills/vet-dependency/SKILL.md` | `allowed-tools: Read Grep Glob WebFetch WebSearch` |
| `github-research` | `skills/github-research/SKILL.md` | по умолчанию |
| `mcp-config-review` | `skills/mcp-config-review/SKILL.md` | `Read Grep Glob` |
| `verify-work` | `skills/verify-work/SKILL.md` | по умолчанию |
| `security-auditor` | `agents/security-auditor.md` | без Write/Edit, `model: inherit` |
| `repo-scout` | `agents/repo-scout.md` | без Write/Edit, `model: sonnet` |
| `code-reviewer` | `agents/code-reviewer.md` | без Write/Edit, `model: inherit` |
| `test-runner` | `agents/test-runner.md` | без Write/Edit (Bash разрешён), `model: sonnet` |
| hooks | `hooks/hooks.json` | `${CLAUDE_PLUGIN_ROOT}/hooks/*.mjs`, таймаут 10 с |

Имена MCP-инструментов в Claude Code: при установке плагином — `mcp__plugin_zero_zero__<tool>`, при ручном `claude mcp add zero` — `mcp__zero__<tool>`. Поэтому агенты ограничены через `disallowedTools`, а не через список `tools`: MCP-инструменты наследуются при любом способе подключения.

Измеренная стоимость контекста (`claude plugin details`): **≈631 токен всегда** плюс 270–1 000 токенов при вызове конкретного skill или агента.

## 6. Структура каталога

```
zero-mcp/
├── .claude-plugin/{plugin.json, marketplace.json}
├── .mcp.json                     # запуск сервера zero внутри плагина
├── src/
│   ├── index.ts                  # stdio, --doctor, --version
│   ├── server.ts                 # buildServer(): сборка зависимостей
│   ├── core/                     # config, permissions, http, audit, ratelimit, secrets, errors, module
│   └── modules/                  # zero, project, security, github, catalog
├── hooks/                        # hooks.json + guard-bash.mjs, guard-write.mjs, log-tool-use.mjs
├── skills/<name>/SKILL.md
├── agents/<name>.md
├── catalog/servers.json          # курируемые внешние MCP-серверы
├── config/                       # example + JSON Schema
├── tests/                        # 87 тестов: unit, hooks, интеграция MCP (in-memory + stdio)
└── ZERO_*.md, README.md, INSTALL.md
```

## 7. Принятые компромиссы

| Решение | Альтернатива | Почему так |
|---|---|---|
| SDK v2 (`@modelcontextprotocol/server` 2.4.0) | v1 `@modelcontextprotocol/sdk` 1.32.2 | v2 — stable-линия под спецификацию 2026-07-28, 2 зависимости против 17 |
| Точные версии зависимостей (`2.4.0`, `4.6.7`) | `^` | Воспроизводимость и защита от компрометации цепочки поставок |
| Hooks без зависимостей (`.mjs`) | TypeScript и сборка | Hook должен работать даже при сломанном `node_modules` |
| Счётчики лимитов в памяти | Файл или БД | Нечему утекать; лимиты на сессию — нужная гранулярность |
| Нет инструментов записи | `write_file` и т. п. | Запись уже есть в Claude Code, где её контролируют permissions |
| Hooks на регулярных выражениях | Полноценный парсер shell | Быстро и прозрачно. **Это не sandbox**: обход возможен, поэтому этап 2 включает sandbox |
