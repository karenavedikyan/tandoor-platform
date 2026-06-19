# Архитектурный инвариант: БД — единственный источник правды

> **Все данные, которые видит пользователь в ЛК, читаются ТОЛЬКО из PostgreSQL. Все изменения пишутся ТОЛЬКО в PostgreSQL.**

Этот документ закрепляет инвариант навсегда. Перед мержем любого PR — пройти чек-лист ниже.

## Запрещено для отображаемых данных и счётчиков

- `client_base_actualization_state` (jsonb) как источник чисел или списков клиентов/ТТ/корзины.
- `OrgSnapshot` / release-каталог как источник чисел или scope (допустимо **только** для подписей ФИО/команд).
- Клиентские пересчёты `rows.reduce` / `rows.filter` для отображения клиентов, ТТ, корзины.
- Любые mock/hardcode/local fallback для прод-счётчиков.

## Разрешено

| Назначение | Источник |
|---|---|
| Scope и счётчики менеджера | `GET /api/dealers/my-scope` |
| Scope и счётчики команды (РОП) | `GET /api/dealers/team-scope` |
| Scope и счётчики орг-структуры (директор) | `GET /api/dealers/org-scope` |
| Подписи ФИО, названия команд | `OrgSnapshot` / release-каталог |
| Локальный буфер формы актуализации | `client_base_actualization_state` (только ввод, не чтение счётчиков) |

## Иерархия сумм (SET-union, без двойного счёта)

```
member.totals → team_totals → org_totals
```

`org_totals` = объединение всех members команд + orphan через SET-union:

- **dealers** — по `external_key` (`unionExternalKeys`);
- **trade_points** — по `tp_id` из `active_trade_points[]` (`unionTradePointIds`), **не суммой** `member.totals.active_trade_points`, потому что regional_manager покрывает тех же dealer/TP, что и менеджеры команды.

## Роли и endpoints

| Роль | Sidebar / scope | Endpoint |
|---|---|---|
| `manager` / `regional_manager` | свой scope | `/api/dealers/my-scope` |
| `rop` | своя команда | `/api/dealers/team-scope` → `team_totals` |
| `director` / `sales_director` | вся орг-структура | `/api/dealers/org-scope` → `org_totals` |
| `admin` viewing-as | тот же endpoint, что у целевого пользователя | `forUserId` / `ropUserId` |

## Admin viewing-as

Admin (и директор при просмотре чужого scope) **всегда** показывает идентичные цифры тому, что видит сам целевой пользователь:

- viewing-as менеджер → `my-scope?for_user_id=...`
- viewing-as РОП → `team-scope?ropUserId=...`

## Чек-лист перед мержем PR

- [ ] Счётчики клиентов/ТТ/корзины читаются из API scope (`my-scope` / `team-scope` / `org-scope`), не из jsonb и не из каталога.
- [ ] `roleScopedDealerRowsForReal(team_lead | sales_director)` не используется — только hooks `useMyTeamScope` / `useOrgScope`.
- [ ] Нет новых `rows.reduce(...outlets` / `rows.filter(...status.*active` для отображаемых счётчиков.
- [ ] `npm run lint:db-source-of-truth` проходит.
- [ ] Тесты scope-endpoints и client scope-тесты зелёные.

## CI

Скрипт `scripts/lint-db-source-of-truth.mjs` блокирует регрессии в `apps/platform/client/src/` (кроме `__tests__/`).
