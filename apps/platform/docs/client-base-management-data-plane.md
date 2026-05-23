# Управленческая плоскость данных клиентской базы (РОП / директор)

Базовая интеграция: **PR #195** (`feat(platform): unify ROP and director client-base data plane`).  
Follow-up **класса 2** (единый team-fetch, scope dealer-base ↔ trade-points, операционная аналитика по актуализированным строкам, дашборд активности): отдельный PR поверх #195 / документации #196.

## Назначение

Для ролей `team_lead` и `sales_director` с включённой актуализацией объединённый `ActualizationState` (merge снимков `/api/actualization/state` по менеджерам в scope) должен питать списки и KPI клиентской базы / ТТ / смежных экранов, чтобы не смешивать «только state текущего пользователя» с данными команды.

**`useClientBaseManagementMergedState`** в коде часто передаётся в переменную `managementPlane`; фактически это тонкая обёртка над **`useClientBaseTeamActualization()`** (единый React-context с merge и refetch).

## Модули (актуально)

- `apps/platform/client/src/lib/client-base-management-scope.ts` — `fetchMergedTeamActualizationForManagement`, `shouldUseTeamMergedActualizationPlane`, обёртки над merge и строками.
- `apps/platform/client/src/context/client-base-team-actualization-context.tsx` — **`ClientBaseTeamActualizationProvider`**: один merge на scope команды, `mergedState`, `activitySourceSnapshots` / `activityDiagnostics`, `publishDashboardRopTeamId`, refetch по `visibilitychange`.
- `apps/platform/client/src/lib/client-base-management-team-scope-storage.ts` — ключ **`tandoor-client-base-management-team-scope-v1`** (localStorage для директора), событие **`tandoor-management-team-scope-v1`**, чтение `?team=` / `?rop=` на `/dealer-base`, `/trade-points`, `/client-base-activity`.
- `apps/platform/client/src/hooks/use-client-base-management-merged-state.ts` — совместимость API: делегирует в `useClientBaseTeamActualization`.
- `apps/platform/client/src/hooks/use-client-base-activity-team-state.ts` — при team plane и наличии провайдера **не** дублирует fetch: берёт `mergedState`, `activitySourceSnapshots` и диагностику из контекста.

## Follow-up класс 2: что сделано

1. **Один механизм загрузки user states команды** — `ClientBaseTeamActualizationProvider` в `App.tsx` (внутри `ClientBaseActualizationProvider`). `useClientBaseActivityTeamState` в режиме team plane использует этот контекст (`activitySources` = `activitySourceSnapshots` провайдера), отдельный параллельный merge отключён.

2. **Синхронизация scope команды** — директор: persist выбранной команды в LS + broadcast; стартовый scope из LS или из URL (`team` / `rop`) на страницах управления; `dealer-base`, `trade-points`, сайдбар и дашборд активности вызывают **`publishDashboardRopTeamId`** при смене фильтра команды (где применимо). РОП: scope зафиксирован своей командой. Менеджер: только свой снимок.

3. **Операционная аналитика (безопасный шаг)** — в `analytics-operational-data.ts` введены **`buildOperationalAnalyticsRowSlicesFromDealers`** и опциональный аргумент «срез строк» у фильтров. В **`analytics-operational-panel.tsx`** при включённой актуализации и team plane срезы строятся из **`buildDealerBaseRowsWithActualization(teamCtx.mergedState, …, { includeArchivedDealers: false })`** (только рабочая база, как в ЛК без «Показать архив»); числовые поля витрины/конверсии по-прежнему **синтетика** поверх строк (как и раньше), но **состав клиентов** совпадает с активным merge ЛК. Селект «Клиент» на вкладке оборудования использует тот же набор id.

4. **Актуализация базы** — селект «РОП / команда» для директора синхронизирован с контекстом (`dashboardRopTeamId` ↔ UI `__all__`); при смене команды вызывается `publishDashboardRopTeamId`.

## Закрытые риски (класс 2)

- Двойной GET team state между «Клиентская база» и «Актуализация базы» при team plane.
- Расхождение снимков активности и merge для РОП/директора при той же логике `userId`.
- Директор: несовпадение scope между `/dealer-base` и `/trade-points` и счётчиками сайдбара при сохранённом фильтре команды (без отдельного URL — за счёт LS + события).
- Операционная панель: полностью статический список клиентов из `DEALER_BASE_ROWS` при наличии актуализированного merge.

## Ограничения (намеренно не трогали или отдельный домен)

- **`analytics.tsx`**, **`analytics-workspace.tsx`**, **sales-control** — без management plane; другие датасеты / планы.
- **`analytics-infographics-panel.tsx`** — по-прежнему вызывает `getInfographic*` со **статическим** срезом по умолчанию (не подключали к merge в этом шаге).
- Поля **продаж / конверсии / оборудование** в операционных таблицах остаются **детерминированной синтетикой** от индекса строки; они **не** отражают исторический факт продаж из backend — для этого нужны отдельные API.
- Реальная аналитика продаж и план-факт из учётных систем — вне объёма client-base merge.

## Таблица: раздел | до | после | проверка

| Раздел | До | После | Проверка |
|--------|----|---------|----------|
| Team-fetch РОП/директор | Два потока: `useClientBaseManagementMergedState` и `useClientBaseActivityTeamState` | Один `ClientBaseTeamActualizationProvider` + activity hook читает контекст | Открыть `/dealer-base` и `/client-base-activity`: сеть — один набор запросов state на команду (при той же роли и включённой актуализации). |
| Актуализация базы / снимки для «кто добавил» | Отдельный merge в хуке | `activitySourceSnapshots` из провайдера | KPI «добавлено вручную» / диалоги детализации согласованы с теми же снимками, что и merge. |
| Scope директора dealer-base ↔ trade-points | Разный default для trade-points и hash dealer-base | Общий LS + `publishDashboardRopTeamId`; URL `team`/`rop` на обеих страницах | Выбрать команду на `/dealer-base` → открыть `/trade-points`: те же клиенты/ТТ в scope; сброс — снова все команды. |
| Сайдбар счётчики | Не следовали за выбором команды | `useClientBaseTeamActualization` в `AuthenticatedShell` | Смена команды на dealer-base обновляет бейджи без перезагрузки. |
| Операционная аналитика | Только `DEALER_BASE_ROWS` | При team plane: срезы из merge **без архивных клиентов** (`includeArchivedDealers: false`) | Под РОП/директором с актуализацией списки клиентов в операционных вкладках совпадают с активной клиентской базой по составу id; фильтры страницы не сломаны. |
| Инфографика аналитики | Статический срез | **Без изменений** (как было) | Убедиться, что блоки инфографики не регрессировали (отдельный контур). |

## Таблица аудита управленческих вкладок (текущее состояние)

Легенда **managementPlane**: «Да» = данные merge через `useClientBaseTeamActualization` / `useClientBaseManagementMergedState`; «Частично» = merge для списков клиентов, но часть метрик — синтетика/мок; «Нет» = другой домен.

| Раздел | Файл / компонент | Источник данных | managementPlane | Примечание |
|--------|------------------|-----------------|-----------------|------------|
| Навигация | `App.tsx` | merge + счётчики | **Да** | |
| Главная | `main-role-dashboard.tsx` | merge → строки | **Да** | |
| Клиентская база | `dealer-base.tsx` | merge + persist | **Да** | Публикация scope команды |
| Торговые точки | `trade-points.tsx` | merge | **Да** | Тот же scope, что dealer-base (LS / URL) |
| Задачи | `tasks.tsx` | merge | **Да** | |
| Карта | `client-map.tsx` | merge | **Да** | |
| Актуализация базы | `client-base-activity-dashboard.tsx` | merge + `activitySources` из провайдера | **Да** | Селект команды директора → `publishDashboardRopTeamId` |
| Операционная аналитика | `analytics-operational-panel.tsx` | merge → срезы операционных строк | **Частично** | Состав клиентов — только **активные** из ЛК; «продажи по витрине» в строках — синтетика |
| План-факт / прочая аналитика | sales-control, `analytics.tsx`, `analytics-workspace.tsx` | local / мок | **Нет** | Класс 3 |

---

## Классификация (сводка)

1. **Подключено к team actualization / management plane:** `App.tsx`, `main-role-dashboard`, `dealer-base`, `trade-points`, `tasks`, `client-map`, `client-base-activity-dashboard` (через контекст), операционная панель (срезы строк при team plane).

2. **Следующие follow-up (не класс 2):** инфографика (`analytics-infographics-panel`) на актуализированные строки; любая замена синтетических sales-полей на backend.

3. **Не подключать без отдельного ТЗ:** sales-control, `analytics.tsx`, `analytics-workspace`, `catalog` — см. выше.

4. **Нужен backend:** фактические продажи, план-факт, исторические заказы.

---

## Активная рабочая база vs архив (управленческие экраны)

- **Рабочая база по умолчанию:** клиент не в `archivedDealersById`; в строке `DealerRow` поля `tradePoints`, `outlets` и `format` считаются только по **неархивным** ТТ (`archivedTradePointsById` и `entry.isArchived` исключаются), см. `applyDealerRowTradePointOutletProjection` в `client-base-actualization-data-merge.ts`.
- **Режим «архив» в клиентской базе:** только клиенты из `archivedDealersById`; для карточки архивного клиента в проекцию ТТ попадают **все** точки merge (включая помеченные архивом), чтобы не терять контекст карточки.
- **Торговые точки:** в рабочем режиме список — только неархивные клиенты и неархивные ТТ; при включённом переключателе «архив» — **только архивный срез:** ТТ с флагом архива у **активных** клиентов **и** все ТТ клиентов из `archivedDealersById` (без смешения с рабочим списком), см. `buildTradePointListForActualization` с `archivedTradePointsOnly`.
- **Сводки по командам:** `buildTeamSummaryFromRows` использует переданные строки (актуализация); на главной и в компактной карточке `/dealer-base` для РОП/директора берётся **активная** портфельная выборка, а не статический `DEALER_BASE_ROWS`.
- **Сайдбар:** счётчики уже через `includeArchivedDealers: false` и список ТТ без архива — согласованы с рабочей базой.
- **Актуализация базы:** текущие KPI/гео по `scopedRows` — только активные клиенты; для подписей событий по id используется объединение активных + только архивных строк (`buildDealerBaseRowsUnionForActivityLabels`), чтобы не терять имена после архивации клиента.

---

## Вкладки, которые **не** должны использовать client-base `managementPlane`

- Весь контур **план-факт / sales-control**.
- **`analytics.tsx`**, **`analytics-workspace.tsx`** в текущем виде.
- Страницы без сущностей «клиент / ТТ / актуализация» (каталог, обучение, заказы и т.д.).

---

## Проверки сборки

```bash
cd apps/platform && npm run check
cd apps/platform && npm run build
```

---

## Связь с дашбордом активности

`use-client-base-activity-team-state` при **`shouldUseTeamMergedActualizationPlane(profile)`** и наличии **`ClientBaseTeamActualizationProvider`** использует **`teamCtx.mergedState`**, **`teamCtx.activitySourceSnapshots`** и **`teamCtx.activityDiagnostics`** — без второго независимого merge. Для менеджера и при выключенной актуализации остаётся прежняя логика (self / пусто).
