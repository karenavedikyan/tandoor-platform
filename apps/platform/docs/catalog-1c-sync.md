# Каталог 1С — импорт (промт 117)

## Скрытие категорий в `/catalog` (промт 122)

`CATALOG_HIDDEN_CATEGORY_IDS` — UUID категорий `catalog_categories` через запятую. Пусто = показывать всё. Данные в БД не удаляются.

## Скрипт

```bash
cd apps/platform
export FTP_USER=... FTP_PASSWORD=...
export DATABASE_URL_UNPOOLED=...   # Neon
export PG_PROXY_URL=https://tandoor-proxy.84-252-129-233.sslip.io
export PG_PROXY_TOKEN=...
npm run sync:catalog-1c
```

Локальный XML без FTP:

```bash
CATALOG_XML_PATH=scripts/catalog-1c/fixtures/sample-catalog1.xml TARGET_DB=neon npm run sync:catalog-1c
```

Dry-run (только лог, без записи товаров):

```bash
DRY_RUN=1 CATALOG_XML_PATH=... npm run sync:catalog-1c
```

## Yandex VM runner

- `yandex-vm/sync-1c-runner.mjs` — `POST /run/catalog`, `GET /status`, `GET /health`
- Env: `SYNC_1C_RUNNER_URL`, `SYNC_RUNNER_TOKEN`
- Установка: `bash apps/platform/scripts/install-vm-cron.sh`
- Cron: `sync-1c-catalog.timer` (hourly)

## Admin UI

- `/admin/migrate` — DDL (116) + кнопка импорта + журнал `catalog_sync_log`
- `POST /api/admin/sync-catalog-1c`
- `GET /api/admin/catalog-1c-sync-log?limit=10`
