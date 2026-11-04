# Установка и подключение ZERO к Claude Code

## Требования

- Node.js ≥ 20. Проверено на 22.23.
- Claude Code CLI. Проверено на 2.1.318.
- Опционально: переменная окружения `ZERO_GITHUB_TOKEN`. Это fine-grained PAT **без прав**, только для публичных данных, — он поднимает лимит GitHub API с 60 до 5 000 запросов в час.

## 1. Сборка

```bash
cd zero-mcp
npm ci --ignore-scripts   # в дереве нет install-скриптов, флаг — страховка
npm run check             # typecheck + build + 87 тестов
node dist/index.js --doctor
```

`--doctor` печатает статус модулей и возвращает код 1, если какой-то модуль заблокирован.

## 2. Подключение к Claude Code

Выберите **один** из трёх способов.

### Способ A — плагин целиком (рекомендуется): MCP-сервер, hooks, skills и агенты

```bash
claude plugin marketplace add /полный/путь/к/zero-mcp
claude plugin install zero@zero-local
claude plugin list        # zero@zero-local … √ enabled
```

Отключить без удаления — `claude plugin disable zero`, удалить — `claude plugin uninstall zero`.

### Способ B — попробовать без установки (одна сессия)

```bash
claude --plugin-dir /полный/путь/к/zero-mcp
```

### Способ C — только MCP-сервер, без hooks, skills и агентов

```bash
claude mcp add zero --scope user -e ZERO_PROJECT_DIR='${CLAUDE_PROJECT_DIR:-.}' -- node /полный/путь/к/zero-mcp/dist/index.js
claude mcp list           # zero: … √ Connected
```

## 3. Проверка внутри Claude Code

1. `/mcp` — сервер `zero` подключён, у него 10 инструментов.
2. Попросите: *«вызови zero_status»*. Все модули должны быть `ok` или `degraded`. `degraded` у github без токена — это нормально.
3. Попросите: *«проверь npm-пакет mcp-server-fetch через ZERO»*. Ожидаемый вердикт — `block`.
4. Попросите: *«выполни rm -rf ~»*. Hook должен отказать с пометкой `ZERO guard [rm-root]`. **Только способ A или B.**
5. Skills: `/zero:vet-dependency`, `/zero:github-research`, `/zero:mcp-config-review`, `/zero:verify-work`.
6. Агенты: «используй агента security-auditor для этого проекта».

## 4. Настройка

Скопируйте `config/zero.config.example.json` в корень проекта под именем `zero.config.json` и отредактируйте. Без файла работают безопасные значения по умолчанию:

- чтение только в пределах проекта
- сеть только к `api.github.com` и `registry.npmjs.org`
- журнал в `.zero/audit.jsonl`

Добавьте `.zero/` в `.gitignore` проекта.

## 5. Внешние MCP-серверы из каталога

В Claude Code попросите: *«покажи каталог ZERO»* (`catalog_list`), затем *«сгенерируй .mcp.json для playwright и github»* (`catalog_render_mcp_json`). ZERO **только печатает** фрагмент; куда его вставить, решаете вы. Секреты задаются переменными окружения, в JSON попадают только `${VAR}`.

## Устранение неполадок

| Симптом | Причина / решение |
|---|---|
| `zero: ✗ Failed to connect` | Не выполнен `npm run build`: нет `dist/index.js` |
| `[RATE_LIMITED] api.github.com returned 403` | Лимит неаутентифицированных запросов. Задайте `ZERO_GITHUB_TOKEN` |
| `[PERMISSION_DENIED] Path is outside allowed roots` | Путь вне проекта. Добавьте корень в `filesystem.allowedRoots` |
| `[PERMISSION_DENIED] Host not on allowlist` | Хост не разрешён. Добавьте его в `network.allowedHosts`, если доверяете |
| Hook ничего не блокирует | Подключён способ C (только MCP). Hooks работают только с плагином |
