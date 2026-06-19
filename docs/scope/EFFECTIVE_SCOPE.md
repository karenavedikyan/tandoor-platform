# effective_scope (промт 435а)

## Что это

Read-only SQL-view `effective_scope` — единая проекция «какой `user_id` видит какого дилера и через какую роль».

| Столбец | Тип | Описание |
|---------|-----|----------|
| `user_id` | text | UUID ответственного пользователя |
| `dealer_id` | text | UUID дилера в `dealers` |
| `dealer_external_key` | text | `dealers.external_key` (канонический ключ scope) |
| `responsible_role` | text | `manager` \| `regional_manager` \| `rop` |
| `source` | text | Сейчас всегда `responsibility_assignments` |

## Канонический ключ дилера в scope-записях = `external_key`

**Инвариант:** в `responsibility_assignments` для `scope_kind = 'dealer'` поле `scope_key` всегда хранит `dealers.external_key` (формат `client-ma-…`, lowercase с префиксом `client-`).

- `release_code` (`MA-MA085529`, uppercase) **не используется** как `scope_key`.
- `dealer_overrides.dealer_id` ссылается на `dealers.external_key`, **не** на uuid дилера.
- View `effective_scope` JOIN-ит `responsibility_assignments.scope_key = dealers.external_key`.

При смене `release_code` scope-записи остаются корректными, пока `external_key` стабилен.

## Откуда наполняется (миграция 435а + hotfix)

View читает из `responsibility_assignments` (`scope_kind = 'dealer'`). Материализация:

1. **manager** — уже были в `responsibility_assignments` (совпадают с `client_assignments`); hotfix нормализовал `scope_key` с `release_code` → `external_key`
2. **RM** — из `dealer_overrides.regional_manager_id` (JOIN `dealers.external_key = dealer_overrides.dealer_id`)
3. **РОП** — из `teams.rop_user_id` через `client_assignments` + персональные override из `dealer_overrides.rop_id`

## История hotfix 2026-06-24 (промт 435а-hotfix)

После первого прогона миграции 435а на Production обнаружены два бага:

| Баг | Симптом | Причина | Починка |
|-----|---------|---------|---------|
| **1. RM backfill = 0** | `regional_manager`: 0 в `effective_scope` | JOIN `dealer_overrides.dealer_id = dealers.id::text` — но `dealer_id` хранит `external_key` | Hotfix: `JOIN dealers d ON d.external_key = ov.dealer_id` |
| **2. manager scope_key** | `effective_scope` manager: 2 из 2861 | 2859 manager-записей имели `scope_key = release_code`, view JOIN-ит по `external_key` | Hotfix: UPDATE `scope_key` через `dealers.release_code` → `external_key` |

Миграция hotfix также создаёт аудит-копию `responsibility_assignments_pre_hotfix_435a` для отката.

Ожидаемые counts после hotfix:

```
manager           ~2861
regional_manager  ~2595
rop               ~2860
total effective_scope ~8316
```

## Что 435а НЕ делает

- **Не переключает** `db-scope-formula`, `my-scope`, `list-scoped`, `trade-points-overview` на чтение из view.
- **Не удаляет** `client_assignments` и legacy-пути в `dealer_overrides`.
- Только материализация + диагностика: `GET /api/diag/effective-scope` (admin).

## Дорожная карта

| Промт | Содержание |
|-------|------------|
| **435b** | Переключить `computeDbScopeForUser` и связанные читалки на `effective_scope` + shadow-сравнение со старым путём + diff в `real_scope_audit_log` |
| **435c** | После нескольких дней чистого shadow — удалить JOIN-ы через `client_assignments` / прямые читалки `dealer_overrides.rop_id` |

## Контрольные запросы

```sql
SELECT responsible_role, COUNT(*) FROM effective_scope GROUP BY 1;
```

```sql
SELECT * FROM effective_scope WHERE user_id = '<uuid>' LIMIT 10;
```

```sql
-- scope_key вне канона (после hotfix должно быть 0–2)
SELECT COUNT(*) FROM responsibility_assignments
 WHERE scope_kind = 'dealer' AND scope_key NOT LIKE 'client-%';
```

## Диагностика в проде

```bash
# totals + legacy counts (только admin)
curl -s -b "$ADMIN_COOKIE" https://lk.tandoor.ru/api/diag/effective-scope | jq .

# per-user sample
curl -s -b "$ADMIN_COOKIE" \
  'https://lk.tandoor.ru/api/diag/effective-scope?userId=3f67f770-f5cd-4257-a4b2-1cefa65fbfaa' | jq .
```

Миграции (вручную на Neon):

```bash
psql "$DATABASE_URL" -f apps/platform/server/migrations/2026_06_24_effective_scope_foundation.sql
psql "$DATABASE_URL" -f apps/platform/server/migrations/2026_06_24_effective_scope_hotfix.sql
```

## Откат hotfix

```sql
BEGIN;
DELETE FROM responsibility_assignments;
INSERT INTO responsibility_assignments
SELECT * FROM responsibility_assignments_pre_hotfix_435a;
COMMIT;
```
