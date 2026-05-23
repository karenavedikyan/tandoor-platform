# План-факт продаж: управленческий cockpit

## Назначение

Экран **`/sales-control/plan-fact`** (`SalesPlanFactManagementCockpit`) даёт директору, РОПу и менеджеру единый управленческий обзор: план, факт, выполнение, зоны внимания и drill-down без «таблиц ради таблиц» на mobile.

## Источники данных

### Persisted слой (основа cockpit)

- **API:** `GET|POST /api/sales-plan-fact/state` (`apps/platform/api/sales-plan-fact/state.ts`).
- **Хранилище:** одна запись с `scope_key = org:default` в таблице **`sales_plan_fact_state`** (см. `apps/platform/docs/sql/sales_plan_fact_state.sql`) при наличии `DATABASE_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL`.
- **Fallback:** in-memory на сервере (демо), если Postgres не настроен.
- **Отключение:** переменная окружения `TANDOOR_SALES_PLAN_FACT_STORAGE=disabled` — API возвращает пустой документ и не пишет.

Документ состояния: **`SalesPlanFactPersistedState`** (`version`, `lines[]`). Каждая строка **`SalesPlanFactLine`** содержит период, команду, опционально менеджера, метрику, `planValue`, **`actualValue` (null = факт не внесён)**, статус, аудит `createdBy` / `updatedBy` / даты, комментарий.

### Что **не** является источником факта в cockpit

- **SEED** (`getSeedActual`, `getSeedTarget` в `sales-control-data.ts`) в cockpit **не используется**.
- **sessionStorage** `tandoor-sales-control-overrides-v1` — это legacy-контур старых страниц `/sales-control/director` и др.; в новом cockpit не читается для KPI.
- Локальный **localStorage** используется только для UI: режим просмотра (`tandoor-sales-plan-fact-mgmt-mode-v1`), плюс **кеш** последней успешной загрузки API (`sales-plan-fact-api.ts`) при сетевой ошибке (аналогично актуализации клиентской базы).

### Справочники оргструктуры и география

- Команды и менеджеры: **`sales-control-data.ts`** (`SALES_TEAMS`, `getTeamManagers`, …) — это справочник ролей демо, не «факт продаж».
- Города для режима «По городам»: агрегация по **`DEALER_BASE_ROWS`** (`releaseManagerId`, `city`) — только для группировки и rollup **уже внесённых** планов/фактов из persisted lines.

## Метрики (KPI)

Список метрик общий с контуром продаж: **`SALES_KPI_METRICS`** / **`SALES_KPI_METRICS_SORTED`** (включая ВХ, МК, валовую прибыль, фурнитуру, активность). Расширение — добавлением записи в справочник метрик и поддержкой в формах ввода.

## Поведение по ролям

| Роль | Scope |
|------|--------|
| `sales_director` | Все команды; фильтр «Команда РОП» на экране. |
| `team_lead` | Только `persona.teamId`. |
| `sales_manager` | Только свой `persona.id`. |

## Процент выполнения и empty-state

- Если по менеджеру **хотя бы по одному KPI** нет `actualValue`, суммарный факт по этому менеджеру считается **неполным** → в агрегатах верхнего уровня факт может стать **`null`**, процент **не** показывается как число (подпись «факт не внесён» / «—»).
- Планы команд (rollup `team`) влияют на зоны внимания «план директора не зафиксирован»; они **не** суммируются в факт (факт только у менеджерских строк).

## UI и test id

См. разметку `sales-plan-fact-management-cockpit.tsx` и `sales-plan-fact-detail-drawer.tsx`: `page-sales-plan-fact-management`, `section-sales-plan-fact-cockpit`, переключатели режимов, строки городов/продуктов, диалог детализации.

## Связь со старыми экранами

`/sales-control/director`, `/team-lead`, `/manager`, `/plans`, `/performance` сохранены для обратной совместимости и работы с sessionStorage. Навигация «План-факт продаж» ведёт на **`/sales-control/plan-fact`**.
