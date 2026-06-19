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

## Источники правды по ролям

| Роль | Источник правды | Поле |
|------|-----------------|------|
| manager | `client_assignments` | `responsible_user_id` |
| team дилера | `client_assignments` | `team_id` |
| rop | `teams` (через `client_assignments.team_id`) | `rop_user_id` |
| regional_manager | `dealer_overrides` | `regional_manager_id` |

Цепочка для РОП (единственный путь после hotfix2):

```
дилер → client_assignments.team_id → teams.rop_user_id → user_id
```

## Deprecated поля

| Поле | Статус |
|------|--------|
| `dealer_overrides.rop_id` | **НЕ используется** для scope. Исторически рассинхронизирован с `client_assignments.team_id`. Колонка остаётся в схеме до отдельного промта на удаление; приложение не должно её читать для scope. |

## Откуда наполняется (миграции 435а + hotfix + hotfix2)

View читает из `responsibility_assignments` (`scope_kind = 'dealer'`). Материализация:

1. **manager** — уже были в `responsibility_assignments`; hotfix нормализовал `scope_key` с `release_code` → `external_key`
2. **RM** — из `dealer_overrides.regional_manager_id` (JOIN `dealers.external_key = dealer_overrides.dealer_id`)
3. **РОП** — **только** через `client_assignments.team_id` → `teams.rop_user_id` (hotfix2; без `dealer_overrides.rop_id`)

## История hotfix 2026-06-24 (промт 435а-hotfix)

После первого прогона миграции 435а на Production обнаружены два бага:

| Баг | Симптом | Причина | Починка |
|-----|---------|---------|---------|
| **1. RM backfill = 0** | `regional_manager`: 0 в `effective_scope` | JOIN `dealer_overrides.dealer_id = dealers.id::text` — но `dealer_id` хранит `external_key` | Hotfix: `JOIN dealers d ON d.external_key = ov.dealer_id` |
| **2. manager scope_key** | `effective_scope` manager: 2 из 2861 | 2859 manager-записей имели `scope_key = release_code`, view JOIN-ит по `external_key` | Hotfix: UPDATE `scope_key` через `dealers.release_code` → `external_key` |

Аудит-копия: `responsibility_assignments_pre_hotfix_435a`.

## История hotfix2 2026-06-24 (промт 435а-hotfix2)

Hotfix1 дополнительно сделал UPSERT rop из `dealer_overrides.rop_id` и обнажил рассинхрон: у 843 дилеров команды Скалабана в override был указан Сапожков. UI показывал 575 вместо 1241.

**Решение:** удалить все rop-записи и пересоздать **только** через team-путь (`client_assignments` → `teams.rop_user_id`). `dealer_overrides.rop_id` исключён из scope.

Ожидаемые rop-counts после hotfix2:

| РОП | Дилеров |
|-----|---------|
| Скалабан | 1241 |
| Сапожков | 970 |
| Купянский | 649 |

Аудит-копия: `responsibility_assignments_pre_hotfix2_435a`.

## Что 435а НЕ делает

- **Не переключает** `db-scope-formula`, `my-scope`, `list-scoped`, `trade-points-overview` на чтение из view.
- **Не удаляет** `client_assignments` и колонку `dealer_overrides.rop_id` (отдельный промт).
- Только материализация + диагностика: `GET /api/diag/effective-scope` (admin).

## 435b: shadow-чтение (промт 435b)

Параллельное сравнение legacy-формулы (`resolveScopeCodesMeta`) и view `effective_scope`. **Не меняет ответы API** — только server-log.

### Флаг

```bash
READ_FROM_EFFECTIVE_SCOPE_SHADOW=1   # Vercel Production (включается вручную после merge)
```

При выключенном флаге поведение байт-в-байт как до 435b.

### Формат лога

Каждый вызов `resolveScopeCodesMeta` под флагом пишет JSON:

```json
{
  "evt": "effective_scope.shadow_diff",
  "endpoint": "resolveScopeCodesMeta",
  "userId": "...",
  "role": "rop",
  "equal": false,
  "legacy_count": 1241,
  "shadow_count": 1241,
  "missing_sample": ["client-ma-..."],
  "extra_sample": []
}
```

Греп в Vercel: `effective_scope.shadow_diff`.

### Как читать diff

| Поле | Значение |
|------|----------|
| `missing_in_shadow` | есть в legacy (`allCodes` → `client-{release_code}`), нет в view — shadow не догоняет |
| `extra_in_shadow` | есть в view, нет в legacy — shadow видит лишнее |

Сравнение нормализует legacy `release_code` → `client-{lowercase}` для честного diff с `dealer_external_key`.

### Диагностический endpoint

`GET /api/diag/effective-scope-shadow-stats?userId=<uuid>&role=<role>` — admin/director, синхронный отчёт без записи в лог.

```bash
curl -s -b /tmp/lk-smoke.cookies \
  "https://lk.tandoor.ru/api/diag/effective-scope-shadow-stats?userId=3f67f770-f5cd-4257-a4b2-1cefa65fbfaa&role=rop" \
  | jq '{legacy: .legacy.all_codes, shadow: .shadow.external_keys, equal}'
```

## План перехода

| Промт | Содержание |
|-------|------------|
| **435b** (текущий) | Shadow-чтение + diff-лог под флагом `READ_FROM_EFFECTIVE_SCOPE_SHADOW` |
| **435c** | Переключить `resolveScopeCodesMeta` на view как primary |
| **435d** | Удаление колонки `dealer_overrides.rop_id` |

## Дорожная карта (архив)

| Промт | Содержание |
|-------|------------|
| **435а** | View + backfill `responsibility_assignments` |
| **435а-hotfix / hotfix2** | JOIN fix, manager scope_key, rop via team only |

## Контрольные запросы

```sql
SELECT responsible_role, COUNT(*) FROM effective_scope GROUP BY 1;
```

```sql
SELECT * FROM effective_scope WHERE user_id = '<uuid>' LIMIT 10;
```

```sql
SELECT u.full_name, COUNT(*) AS dealers
FROM effective_scope es
JOIN users u ON u.id::text = es.user_id
WHERE responsible_role = 'rop'
GROUP BY 1 ORDER BY 2 DESC;
```

## Диагностика в проде

```bash
curl -s -b "$ADMIN_COOKIE" https://lk.tandoor.ru/api/diag/effective-scope | jq .

curl -s -b "$ADMIN_COOKIE" \
  'https://lk.tandoor.ru/api/diag/effective-scope?userId=3f67f770-f5cd-4257-a4b2-1cefa65fbfaa' | jq .
# ожидание perUser.count: 1241
```

Миграции (вручную на Neon):

```bash
psql "$DATABASE_URL" -f apps/platform/server/migrations/2026_06_24_effective_scope_foundation.sql
psql "$DATABASE_URL" -f apps/platform/server/migrations/2026_06_24_effective_scope_hotfix.sql
psql "$DATABASE_URL" -f apps/platform/server/migrations/2026_06_24_effective_scope_hotfix2_rop_via_team.sql
```

## Откат hotfix2 (только rop-записи)

```sql
BEGIN;
DELETE FROM responsibility_assignments WHERE scope_kind='dealer' AND responsible_role='rop';
INSERT INTO responsibility_assignments
SELECT * FROM responsibility_assignments_pre_hotfix2_435a
WHERE scope_kind='dealer' AND responsible_role='rop';
COMMIT;
```

## Откат hotfix1 (полный снапшот до hotfix)

```sql
BEGIN;
DELETE FROM responsibility_assignments;
INSERT INTO responsibility_assignments
SELECT * FROM responsibility_assignments_pre_hotfix_435a;
COMMIT;
```
