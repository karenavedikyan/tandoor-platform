# Каталог 1С — импорт (промт 117)

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

## Фото в Vercel Blob (промт 120)

- `scripts/sync-1c-photos.mjs` + `scripts/catalog-1c/photo-sync.mjs`
- `POST /api/admin/sync-catalog-1c-photos` — `{ target, limit, dry }`
- Cron: `GET /api/cron/sync-catalog-1c-photos` (`0 4 * * *` UTC), env `PHOTO_SYNC_LIMIT` (default 500)
- Runner: `POST /run/photos`
- Миграция blob-колонок входит в `POST /api/admin/migrate-catalog-1c`

## Yandex VM runner

- `yandex-vm/sync-1c-runner.mjs` — `POST /run/catalog`, `POST /run/photos`, `GET /status`, `GET /health`
- Env: `SYNC_1C_RUNNER_URL`, `SYNC_RUNNER_TOKEN`
- Установка: `bash apps/platform/scripts/install-vm-cron.sh`
- Cron: `sync-1c-catalog.timer` (hourly)

## Admin UI

- `/admin/migrate` — DDL (116) + кнопка импорта + журнал `catalog_sync_log`
- `POST /api/admin/sync-catalog-1c`
- `GET /api/admin/catalog-1c-sync-log?limit=10`
