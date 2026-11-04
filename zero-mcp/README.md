# ZERO MCP

Модульная и безопасная персональная AI-инфраструктура для Claude Code. Это **плагин**: MCP-сервер с read-only инструментами, защитные hooks, skills и субагенты, плюс курируемый каталог внешних MCP-серверов.

| Документ | Что внутри |
|---|---|
| [ZERO_INTELLIGENCE_REPORT.md](ZERO_INTELLIGENCE_REPORT.md) | Исследование экосистемы, рейтинг, библиотека возможностей по 10 категориям, решения с причинами |
| [ZERO_ARCHITECTURE.md](ZERO_ARCHITECTURE.md) | Слои, конвейер вызова, конфигурация, разрешения, журнал, как добавить модуль |
| [ZERO_SECURITY_AUDIT.md](ZERO_SECURITY_AUDIT.md) | Модель угроз, что проверено, находки в экосистеме, остаточные риски |
| [ZERO_INTEGRATION_ROADMAP.md](ZERO_INTEGRATION_ROADMAP.md) | Этапы, что требует подтверждения, затраты, перенос в `xxx01po/zero-mcp` |
| [INSTALL.md](INSTALL.md) | Установка и подключение к Claude Code |

## Инструменты MCP-сервера `zero`

Все инструменты только читают.

| Инструмент | Что делает |
|---|---|
| `zero_status` | Версия, источник конфига, статус и зависимости модулей, лимиты, использование |
| `zero_audit_tail` | Последние действия ZERO (аргументы с редакцией секретов) |
| `project_inspect` | Стек, скрипты проверки, lockfile, CI, конфиг Claude Code, проблемы гигиены |
| `security_scan_secrets` | Поиск утёкших ключей и токенов (в отчёте значения замаскированы) |
| `security_lint_mcp_config` | Аудит `.mcp.json` и `settings.json`: секреты, версии без закрепления, `curl \| sh`, `bypassPermissions`… |
| `security_check_npm_package` | Проверка npm-пакета **до установки**: install-скрипты, заглушки npm на месте вредоносных пакетов, typosquat, лицензия |
| `github_repo_health` | Объяснимая оценка репозитория 0–100 и рекомендация |
| `github_compare_repos` | Ранжирование 2–8 альтернатив |
| `catalog_list` | Проверенные внешние MCP-серверы: решения, риски, флаги |
| `catalog_render_mcp_json` | Готовый к ревью `.mcp.json` с закреплёнными версиями и `${VAR}` вместо секретов |

## Быстрый старт

```bash
cd zero-mcp && npm ci --ignore-scripts && npm run check
claude plugin marketplace add "$PWD" && claude plugin install zero@zero-local
```

## Разработка

```bash
npm run typecheck   # TypeScript strict
npm run build       # → dist/
npm test            # 87 тестов: unit, hooks, MCP in-memory и stdio
npm run doctor      # проверка зависимостей модулей
```

Лицензия: **не выбрана** (`UNLICENSED`). Выбор за владельцем. Зависимости: `@modelcontextprotocol/server` (Apache-2.0), `zod` (MIT).
