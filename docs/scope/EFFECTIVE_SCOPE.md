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

## Откуда наполняется (миграция 435а)

View читает из `responsibility_assignments` (`scope_kind = 'dealer'`). Перед созданием view миграция материализует:

1. **RM** — из `dealer_overrides.regional_manager_id`
2. **РОП** — из `dealer_overrides.rop_id` (UPSERT)
3. **РОП (добор)** — из `teams.rop_user_id` через `client_assignments.team_id` (INSERT … ON CONFLICT DO NOTHING, чтобы не затирать персональный `rop_id`)

Строки `manager` уже были в `responsibility_assignments` до 435а (совпадают с `client_assignments`).

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

## Диагностика в проде

```bash
# totals + legacy counts (только admin)
curl -s -b "$ADMIN_COOKIE" https://lk.tandoor.ru/api/diag/effective-scope | jq .

# per-user sample
curl -s -b "$ADMIN_COOKIE" \
  'https://lk.tandoor.ru/api/diag/effective-scope?userId=3f67f770-f5cd-4257-a4b2-1cefa65fbfaa' | jq .
```

Миграция (вручную на Neon):

```bash
psql "$DATABASE_URL" -f apps/platform/server/migrations/2026_06_24_effective_scope_foundation.sql
```
