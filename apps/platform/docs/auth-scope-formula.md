# Формула scope для счётчиков сайдбара

Документ фиксирует **точные** правила, по которым формируются visible-набор дилеров, торговых точек (ТТ) и корзины для бейджей навигации. Источник истины — код; ссылки вида `file.ts:line` указывают на реализацию.

## Важно: не `dealers.manager_id` / `dealers.team_id`

Счётчики в UI **не** строятся прямым JOIN `dealers` с пользователем по `manager_id` / `team_id` (эти поля в БД почти везде NULL). Цепочка:

1. **Каталог** — `GET /api/dealers-trade-points/list` → `DealerRow[]` с `releaseCode`, `tradePoints`.
2. **Visible codes** — `GET /api/auth/my-visible-codes` → пересечение каталога с кодами (`getVisibleDealerRows`).
3. **Assignments scope** — `GET /api/clients/my-codes` → `ownCodes` / `teamCodes` / `grantedCodes`.
4. **Org snapshot** — `GET /api/auth/my-org-snapshot` → `roleScopedDealerRowsForReal`.
5. **Счётчики** — `buildSidebarNavRealScope` → `resolveSidebarWorkingDealerClientCount` / `resolveSidebarTradePointsCount` / `resolveSidebarTrashCount`.

Единый pipeline для диагностики: `sidebar-scope-counter-math.ts` и `GET /api/admin/scope-debug`.

---

## Таблица по ролям

| Роль | Источник «своих» дилеров | Источник «командных» дилеров | Источник ТТ | Корзина |
|---|---|---|---|---|
| **director** | — (весь каталог API) | — | Все ТТ scoped-дилеров (`includeArchivedTradePoints=false`) | Все `dealer_overrides` / `trade_point_overrides` с `trashed_at IS NOT NULL` (`FULL_VIEW_ROLES`) |
| **admin** | — (как director) | — | Как director | Как director |
| **analyst** | — (как director) | — | Как director | Не в `FULL_VIEW_ROLES` — scope по assignments, если есть |
| **marketer** | — (как director) | — | Как director | Как analyst |
| **category_manager** | — (как director) | — | Как director | Как director (`FULL_VIEW_ROLES`) |
| **rop** | `client_assignments WHERE responsible_user_id = me` → `ownCodes` | `client_assignments` команд, где `teams.rop_user_id = me` → `teamCodes` | ТТ дилеров после `catalog ∩ visible_codes ∩ roleScopedDealerRowsForReal(team_lead) ∩ assignmentsScope` | Trashed-сущности, чей `dealer_id` / `releaseCode` ∈ scope РОПа (`buildTrashScopeFilter`, team_lead) |
| **manager** | `client_assignments WHERE responsible_user_id = me` → `ownCodes` | — | ТТ scoped-дилеров (`sales_manager` + `assignmentsScope.ownCodes`) | Trashed в `ownCodes` (+ `grantedCodes`, если есть) |
| **regional_manager** | `dealer_overrides WHERE regional_manager_id = me` → client codes в `ownCodes` | — | ТТ дилеров с `releaseCode ∈ ownCodes` | Trashed по `releaseCode ∈ ownCodes` |

---

## Детализация по шагам

### 1. Visible client codes (`my-visible-codes`)

| Роль | SQL / логика | Код |
|---|---|---|
| director, admin, analyst, marketer, category_manager | `{ all: true, codes: null }` | `auth-bootstrap-handlers.ts:178` |
| rop | `client_assignments` JOIN `teams` ON `teams.rop_user_id = me` ∪ `rop_client_grants` | `auth-bootstrap-handlers.ts:181` |
| manager | `client_assignments WHERE responsible_user_id = me` | `auth-bootstrap-handlers.ts:212` |
| regional_manager | `dealer_overrides WHERE regional_manager_id = me` → upper client_code | `auth-bootstrap-handlers.ts:231` |

Клиент: `use-my-visible-client-codes.ts:40` (хук), `dealer-base-source.ts:96` (`getVisibleDealerRows` — пересечение каталога с codes).

### 2. Assignments scope (`my-codes`)

| Роль | ownCodes | teamCodes | grantedCodes | Код |
|---|---|---|---|---|
| director/admin/… | `[]` | `[]` | `[]` | `my-client-codes-handlers.ts:44` |
| rop | responsible = me | team assignments где rop = me | `rop_client_grants` | `my-client-codes-handlers.ts:54` |
| manager | responsible = me | `[]` | `[]` | `my-client-codes-handlers.ts:92` |
| regional_manager | codes из `dealer_overrides` | `[]` | `[]` | `my-client-codes-handlers.ts:110` |

Клиент: `use-my-client-codes.ts` → `use-sidebar-nav-real-scope.ts:17`.

### 3. Sidebar real scope (`buildSidebarNavRealScope`)

```
releaseDealerRows = getVisibleDealerRows(catalog, vis.all, vis.codes)
orgScope = { snap, mapUserRoleToDealerBaseAccess(role) }
assignmentsScope = own/team/granted Sets (если не пусто)
```

Код: `sidebar-nav-real-scope.ts:39`, `dealer-base-source.ts:96`.

### 4. Role-scoped dealers (счётчик «Клиенты-дилеры»)

После merge actualization (без архивных дилеров):

- `roleScopedDealerRowsForReal(releaseDealerRows, snap, access, …, assignmentsScope)`
- director → все строки (`dealer-base-real-scope.ts:241`)
- rop → `rowsForAssignmentsScope` team_lead: `teamCodes ∪ ownCodes ∪ grantedCodes` (`dealer-base-real-scope.ts:68`, `dealer-base-real-scope.ts:238`)
- manager → `ownCodes ∪ grantedCodes` (`dealer-base-real-scope.ts:71`)
- regional_manager → `releaseCode ∈ ownCodes` (`dealer-base-real-scope.ts:220`)

Счётчик: `dealer-base-sidebar-client-count.ts:36` → `dealer-base-working-rows.ts:66` → `countDealerBaseHeaderTotal`.

### 5. Торговые точки

`buildTradePointListForActualization(state, profile, { includeArchivedTradePoints: false, releaseDealerRows, orgScope, assignmentsScope })` → `rows.length`.

Код: `trade-points-working-rows.ts:33`, `sidebar-trade-points-count.ts:19`.

### 6. Корзина

Источник данных: `dealer_overrides.trashed_at`, `trade_point_overrides.trashed_at` (загружается в actualization state).

Фильтр: `buildTrashScopeFilter` — симметрия dealer scope (`dealer-trash-scope.ts:114`).

- director/admin/category_manager → `fullView: true` (`dealer-trash-scope.ts:28`, `dealer-trash-scope.ts:126`)
- rop → teamCodes ∪ ownCodes ∪ granted
- manager → ownCodes ∪ granted

Счётчик: `dealer-base-sidebar-client-count.ts:59` → `countScopedTrashItems`.

---

## Диагностика

### Endpoint

`GET /api/admin/scope-debug?user_id=<uuid>` или `?email=<email>`

- Доступ: `director`, `admin` (`scope-debug-handlers.ts:61`)
- Возвращает разложение codes + счётчики, совпадающие с сайдбаром (`scope-debug-core.ts:buildScopeDebugPayload`)

### UI

`/admin/counts-diag` → кнопка «Объяснить scope» (director/admin).

### Тест

`npm run test:scope-debug-counters` — сверка `buildScopeDebugPayload` с `computeSidebarScopeCountersFromRealScope`.

---

## Почему прямой SQL по `dealers.manager_id` даёт 0

В проде привязка идёт через:

- `client_assignments.client_code` + `client_assignments.team_id` + `teams.rop_user_id`
- `rop_client_grants.client_code`
- `dealer_overrides.regional_manager_id` (регионалы)
- `dealers.release_team_id` (текст, не FK на `teams.id`) — используется только как fallback в legacy team-scope, когда assignments ещё не загружены

Поэтому для РОПа Скалабана (~844) корректный запрос — COUNT DISTINCT `client_code` из assignments команд с `rop_user_id = <uuid>`, а не JOIN по `dealers.manager_id`.
