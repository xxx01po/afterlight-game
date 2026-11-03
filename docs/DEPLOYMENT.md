# Публикация

Сборка статическая (`dist/`), пути относительные (`base: './'`) — работает в корне домена и в подпапке.

## GitHub Pages (настроено)
Workflow `.github/workflows/deploy-pages.yml` собирает и публикует при каждом push в `main`.

Однократно владельцу репозитория:
1. Слить ветку `claude/afterlight-chapter-01` в `main` (через Pull Request).
2. GitHub → репозиторий → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Дождаться зелёного запуска «Deploy to GitHub Pages» во вкладке Actions (или запустить вручную: Run workflow).
4. Адрес: `https://xxx01po.github.io/afterlight-game/`.

Бесплатно для публичных репозиториев.

## Vercel (альтернатива)
`vercel.json` уже в репозитории. vercel.com → Add New Project → импорт `afterlight-game` → Deploy (тариф Hobby бесплатный). Настройки подхватятся автоматически.

## Локально в сети (для теста на телефоне)
`npm run build && npm run preview` → открыть на iPhone адрес `http://<IP-компьютера>:4173` (телефон в той же Wi-Fi сети). Аудио и WebGL работают и по http в локальной сети; для «На экран Домой» лучше https (Pages/Vercel).

## CI
`.github/workflows/ci.yml`: typecheck, модульные тесты и сборка на каждый push/PR.
