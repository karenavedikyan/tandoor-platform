# Tandoor — Архитектурный инвариант: БД — единственный источник правды

**Статус:** обязательное правило. Любой PR, нарушающий этот инвариант, должен быть отклонён.

## Правило

> **Все данные, которые видит пользователь в ЛК (клиенты, ТТ, корзина, счётчики, скоп, команда, виды/витрины, признаки, аналитика, состояния), читаются ТОЛЬКО из PostgreSQL. Все изменения пишутся в PostgreSQL.**

Никаких альтернативных источников для отображаемых данных:

- ❌ `client_base_actualization_state` (jsonb) — НЕ источник для счётчиков и видимости.
- ❌ `OrgSnapshot` / release-каталог — НЕ источник для счётчиков/скопа/команд (только справочник имён и связей, не данные).
- ❌ Мок-данные / hardcoded fallback'и в коде.
- ❌ LocalStorage / SessionStorage / IndexedDB как источник правды.
- ❌ Клиентские пересчёты `rows.reduce/filter` для отображения чисел КЛИЕНТОВ / ТТ / КОРЗИНЫ — только агрегаты из API.

## Что считается «данными ЛК»

| Сущность | Таблица БД (источник) |
|---|---|
| Клиенты (дилеры) | `dealers` + `dealer_overrides` |
| Торговые точки | `trade_points` + `trade_point_overrides` |
| Статус (active/in_trash/purged) | `*_overrides.status` |
| Основная ТТ | `trade_point_overrides.is_primary` |
| Скоп менеджера/РМ | `responsibility_assignments` |
| Команды | `teams` + `user_team_memberships` |
| Корзина | `*_overrides.status='in_trash'` + `trashed_by` |
| Аудит | `audit_log` |
| Витрина/showcase/distribution | соответствующие таблицы БД |

## Что считается «не данные» и где можно использовать non-DB источники

- Имена / catalog-id / связи в `OrgSnapshot` — **только** для отображения подписей (ФИО, название команды), **не** для подсчёта строк.
- `client_base_actualization_state` — **только** локальный буфер ввода (черновики формы до отправки на сервер). После submit — всё в БД, на следующем рендере читать из БД.
- LocalStorage — UI-настройки (открытые секции, режим View, фильтры). Никогда не данные.

## Архитектурные слои

```
┌──────────────────────────────────────────┐
│  UI (React)                              │
│  ↓ читает агрегаты из API hooks          │
│  ↓ пишет через API mutations             │
├──────────────────────────────────────────┤
│  API hooks (TanStack Query)              │
│  - useMyScopeFromDB                      │
│  - useMyTeamScope (новый, промт 423)     │
│  - useDealerById / useTradePointById     │
│  ↓                                       │
├──────────────────────────────────────────┤
│  /api/* endpoints (Express)              │
│  - /api/dealers/my-scope                 │
│  - /api/dealers/team-scope (новый)       │
│  - /api/dealer-overrides/*               │
│  - /api/trade-point-overrides/*          │
│  ↓                                       │
├──────────────────────────────────────────┤
│  PostgreSQL — ЕДИНСТВЕННЫЙ источник       │
└──────────────────────────────────────────┘
```

Каждый счётчик в UI обязан иметь чёткий путь до конкретной SQL-агрегации.

## Чек-лист ревью (для каждого PR)

Перед мержем PR в `main`, проверить:

- [ ] Все новые/изменённые экраны читают данные через API hook, который ходит в БД.
- [ ] Все счётчики (active, in_trash, ТТ, корзина) приходят из API ответом, не вычисляются на клиенте через `rows.reduce/filter`.
- [ ] При записи (move-to-trash, restore, set-primary, edit) — POST/PUT/PATCH в БД, без записи в jsonb.
- [ ] Нет новых обращений к `client_base_actualization_state` для отображения данных (только как локальный черновик формы).
- [ ] Нет новых обращений к `OrgSnapshot.users[i]` или каталогу для подсчёта чего-либо.
- [ ] Нет hardcode-fallback'ов (`if (env !== 'production') return mockData`).
- [ ] Тесты проверяют, что **сумма по детям = тоталу родителя** (manager.totals → team.totals → org.totals).
- [ ] У РОПа/admin'а в viewing-as режиме те же цифры, что у самого пользователя.

## Запрещённые паттерны (grep-стопы)

CI должен падать, если в diff появляются:

```bash
# В НОВОМ коде нельзя:
grep -E "rows\.reduce\(.*outlets" apps/platform/client/src
grep -E "rows\.filter\(.*status.*active.*\)\.length" apps/platform/client/src
grep -E "actualizationState\.trashedDealersById" apps/platform/client/src
grep -E "OrgSnapshot.*\.length" apps/platform/client/src   # для счётчиков
```

(Существующие места — выпилить по плану промта 423. Новые — блокировать.)

## История нарушений (учиться на ошибках)

- **2026-06-19 — РОП vs менеджер 79 ≠ 33 ТТ.** Причина: `roleScopedDealerRowsForReal` для `team_lead` фильтровал по `release_team_id` из `OrgSnapshot`. Closed by promпт 423.
- **2026-06-18 — каскад trash падал `INTERNAL_ERROR`.** Причина: SQL делал `WHERE dealer_id = $1::uuid`, а UI присылал text. Closed by промт 422-hotfix.
- **2026-06-17 — login outage.** Причина: jsonb-источник видимости не отдавался. Closed by постмортем + промт 380.

## Принцип эволюции

При добавлении новой сущности (например, контактов клиента):

1. Сначала — миграция БД (таблица, индексы, FK).
2. Затем — серверный endpoint (`/api/contacts/*`) с RBAC.
3. Затем — клиентский hook на TanStack Query.
4. Затем — UI, который использует ТОЛЬКО hook.

Нельзя начинать с UI + jsonb + «потом перепишем». Этот путь приводит к двум источникам правды.
