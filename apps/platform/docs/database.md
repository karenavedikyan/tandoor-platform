# Базы данных платформы

## Neon и Yandex

| Роль | Переменная окружения | Назначение |
|------|----------------------|------------|
| Основная | `DATABASE_URL` (или `POSTGRES_URL` / `NEON_DATABASE_URL`) | Живой прод, все API по умолчанию |
| Страховка | `YANDEX_DATABASE_URL_UNPOOLED` (или `YANDEX_DATABASE_URL`) | Горячая реплика для переключения без потери DDL/данных |

Shadow-write дублирует часть DML в Yandex автоматически, но **DDL** (CREATE TABLE, индексы) нужно применять явно к обеим базам.

## Дисциплина миграций (Neon + Yandex)

Все DDL-миграции применяются **одновременно** к обеим БД:

- Neon — основная (`DATABASE_URL`).
- Yandex — горячая страховка (`YANDEX_DATABASE_URL_UNPOOLED`).

### Шаблон для новой миграции

1. SQL-файл в `apps/platform/server/migrations/YYYY_MM_DD_*.sql` (идемпотентно: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
2. То же DDL зеркалится в `apps/platform/server/db-migrate/yandex-schema.sql` (для свежих кластеров).
3. Если миграция меняет схему уже развёрнутых прод-кластеров — добавьте стейтменты в admin-эндпоинт dual-migrate или расширьте существующий (см. `api/admin/migrate-marketing-briefs.ts` и `shared/dual-db-migrate.ts`).
4. После деплоя админ запускает **POST** `/api/admin/migrate-marketing-briefs` со страницы `/admin/migrate-marketing-briefs` и проверяет отчёт «Синхронно».

### Маркетинговые брифы (Промты 102–104)

Таблицы:

- `marketing_briefs`
- `marketing_brief_revisions`
- `marketing_brief_blocks`

Быстрый hotfix при ошибке «Внутренняя ошибка сервера» при создании брифа: таблицы есть только в Yandex, но API читает Neon — применить dual-migrate из админки.
