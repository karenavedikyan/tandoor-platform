# Формула scope для счётчиков сайдбара

**Промт 384:** единый source of truth — `GET /api/dealers/my-scope` (`shared/db-scope-formula.ts`).

Счётчики сайдбара и фильтр списков берутся из `totals` API, без локального пересчёта на mock-данных.

## API

`GET /api/dealers/my-scope` — возвращает:

- `totals.active_dealers` / `active_trade_points` / `trashed_dealers`
- `active_dealer_ids`, `active_dealer_external_keys` (для фильтра каталога)
- `scope_explanation` (role, team_ids, counts кодов)

Клиент: `useMyScopeFromDB()` → `sidebarCountsFromDbScope()`.

Диагностика: `GET /api/admin/scope-debug` использует тот же `computeDbScopeForUser`.

---

## Таблица по ролям (БД)

| Роль | Scope client_codes | Дилеры | ТТ | Корзина |
|---|---|---|---|---|
| **director** / **admin** | все (`dealers` без фильтра) | все без `dealer_overrides.trashed_at` | `trade_points` активных дилеров без `trade_point_overrides.trashed_at` | `dealer_overrides.trashed_at IS NOT NULL` |
| **marketer** / **analyst** / **category_manager** | как director | как director | как director | как director |
| **rop** | `client_assignments` (team_id ∈ мои команды) ∪ (responsible=me) ∪ `rop_client_grants` | `dealers.release_code ∈ codes` | TP активных scoped-дилеров | scoped + trashed |
| **regional_manager** | team ∪ own (через `user_team_memberships`), **без** grants | как rop | как rop | как rop |
| **manager** | `client_assignments WHERE responsible_user_id = me` | `release_code ∈ own` | TP активных | scoped trashed |

Код: `shared/db-scope-formula.ts` — `resolveScopeCodesMeta`, `computeDbScopeForUser`.

### Команды РОПа

```sql
SELECT id FROM teams WHERE rop_user_id = $user
UNION
SELECT team_id FROM user_team_memberships WHERE user_id = $user
```

### Связь дилер ↔ код

```sql
dealers.release_code = client_assignments.client_code
```

### Trash join

```sql
dealer_overrides.dealer_id IN (d.id::text, d.external_key, 'client-' || lower(d.release_code))
```

---

## Legacy (до Промта 384)

Ранее scope строился client-side: `my-visible-codes` + `my-codes` + `buildSidebarNavRealScope` + mock catalog. Этот путь **заменён** для счётчиков и фильтра списков на `/api/dealers/my-scope`.

Файлы `use-my-visible-client-codes.ts`, `use-my-client-codes.ts` остаются для bootstrap/org UI; **списки и счётчики** используют `useMyScopeFromDB`.
