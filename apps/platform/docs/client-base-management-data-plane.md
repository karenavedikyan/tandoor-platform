# Управленческая плоскость данных клиентской базы (РОП / директор)

Актуализация после влития **PR #195** (`feat(platform): unify ROP and director client-base data plane`).

## Назначение

Для ролей `team_lead` и `sales_director` с включённой актуализацией объединённый `ActualizationState` (merge снимков `/api/actualization/state` по менеджерам в scope) должен питать списки и KPI клиентской базы / ТТ / смежных экранов, чтобы не смешивать «только state текущего пользователя» с данными команды.

**`useClientBaseManagementMergedState`** в коде часто передаётся в переменную `managementPlane`; на страницах ниже в таблице колонка «managementPlane» означает именно этот хук (или прямой эквивалент по смыслу).

## Модули

- `apps/platform/client/src/lib/client-base-management-scope.ts` — `fetchMergedTeamActualizationForManagement`, `shouldUseTeamMergedActualizationPlane`, обёртки над merge и строками.
- `apps/platform/client/src/hooks/use-client-base-management-merged-state.ts` — хук: менеджер → `contextState`; РОП/директор → merge + подстановка живого `contextState` для текущего пользователя; `visibilitychange` → refetch команды.

## Уже подключено к `useClientBaseManagementMergedState` (после PR #195)

| Раздел | Файл | Что считается |
|--------|------|----------------|
| Навигация, бейджи | `App.tsx` | Клиенты в рабочей базе, число ТТ (через `resolveSidebarWorkingDealerClientCount`, `countWorkingTradePointsForSidebar`) |
| Главная | `components/main-role-dashboard.tsx` | KPI клиентов / внимание / задачи по витрине (через `buildDealerBaseRowsWithActualization(managementPlane.mergedState, …)`) |
| Клиентская база | `pages/dealer-base.tsx` | Строки, KPI, сегменты, витрина, архивные флаги, `DealerActualizationCreateDialog` (дубликаты) |
| Торговые точки | `pages/trade-points.tsx` | Списки ТТ, сводки, bulk-архив (persist по-прежнему через `actx.persist`) |
| Задачи по витрине | `pages/tasks.tsx` | `allowedDealerIds` из merge; `dashboardRopTeamId` = `ropTeam` страницы (в т.ч. из URL) |
| Карта клиентов | `pages/client-map.tsx` | Маркеры и список; `dashboardRopTeamId` = `ropTeam` из UI |

Ограничение PR #195 (известный follow-up): **сайдбар** использует `initialRopManagerForProfile` (у директора «все команды»), а не hash-фильтр открытой `/dealer-base` — при смене команды на странице бейдж может расходиться с KPI на `/dealer-base`.

---

## Таблица аудита управленческих вкладок (после PR #195)

Легенда колонки **managementPlane**: «Да» = используется `useClientBaseManagementMergedState`; «Аналог» = отдельный хук/поток, но merge team actualization по тем же `userId`, что и дашборд активности; «Нет» = нет merge клиентской базы.

| Раздел | Файл / компонент | Что показывает | Источник данных сейчас | managementPlane | Риск рассинхрона | Что делать дальше |
|--------|------------------|----------------|------------------------|-------------------|------------------|-------------------|
| Главная РОП/директора | `main-role-dashboard.tsx` | Клиенты, активные, внимание, задачи, план-график | Merge → `buildDealerBaseRowsWithActualization` | **Да** | Низкий (пока грузится команда — скелет загрузки с учётом team fetch) | Follow-up: подпись scope / синхронизация с hash команды, если понадобится |
| Клиентская база | `dealer-base.tsx` | Списки, KPI, фильтры, витрина | Merge + `actx.persist` для записи | **Да** | Низкий | Follow-up: единый контекст для сайдбара и страницы |
| Торговые точки | `trade-points.tsx` | ТТ, KPI вкладки | Merge; `dashboardRopTeamId` = **default** (`initialRopManagerForProfile`), не hash страницы | **Да** | Средний: директор на `/trade-points` всегда тянет scope «как у сайдбара», а не выбранную на `/dealer-base` команду | Подключить `dashboardRopTeamId` к URL/hash или общему store — отдельная задача |
| Задачи по витрине | `tasks.tsx` | Задачи матрицы по дилерам | Merge; `ropTeam` из state/URL | **Да** | Низкий | — |
| Карта | `client-map.tsx` | Маркеры, список | Merge + фильтры UI | **Да** | Низкий | — |
| Актуализация базы | `pages/client-base-activity-dashboard.tsx` | События, рейтинги, детализация, KPI по активности | `useClientBaseActivityTeamState` → `activityState` → `buildDealerBaseRowsWithActualization` | **Аналог** (не тот хук; **двойной** GET team state параллельно с `managementPlane` на других вкладках) | Средний: два независимых fetch/merge; возможны расхождения при отличии логики | Объединить источник с `fetchMergedTeamActualizationForManagement` или поднять React context |
| Хаб план-факт | `pages/sales-control.tsx` | Навигация по контуру | Статический UI | **Нет** | Нет | Не подключать |
| Панель директора план-факт | `pages/sales-control-director.tsx` | Планы, факт, валовая прибыль, команды | `useSalesControlStoredState` + `lib/sales-control-data` (local) | **Нет** | Нет относительно актуализации ЛК (другой домен данных) | **Класс 3** — планы продаж; не смешивать с client-base без отдельного ТЗ |
| Панель РОП план-факт | `pages/sales-control-team-lead.tsx` | То же для команды | local `sales-control` store | **Нет** | Нет | **Класс 3** |
| Панель менеджера план-факт | `pages/sales-control-manager.tsx` | План/факт менеджера | local store | **Нет** | Нет | **Класс 3** |
| Таблица планов | `pages/sales-control-plans.tsx` | Сводка планов | local store + агрегаты `sales-control-data` | **Нет** | Нет | **Класс 3** |
| Выполнение по командам | `pages/sales-control-performance.tsx` | KPI выполнения | local store | **Нет** | Нет | **Класс 3** |
| Аналитика (общая) | `pages/analytics.tsx` | Продажи, территории, топы | `lib/sales-manager-kpi-data` (мок/демо) | **Нет** | Нет связи с актуализацией клиентов | **Класс 3** или **Класс 4**, если позже стыковать с реальными продажами |
| Аналитика команды | `pages/analytics-workspace.tsx` | Таблицы по вкладкам | `lib/analytics-workspace-data` (seed + localStorage) | **Нет** | Да, с реальной клиентской базой (ручной/мок контур) | **Класс 3** для текущего прототипа; выравнивание — отдельный продуктовый объём |
| Операционная аналитика | `components/analytics/analytics-operational-panel.tsx` + `lib/analytics-operational-data.ts` | Витрина, оборудование, конверсии по клиентам | **Статический** `DEALER_BASE_ROWS` при инициализации демо-данных | **Нет** | **Высокий** с `/dealer-base` у РОП/директора (нет actualization overrides) | **Класс 2** — подключать merge только после проектирования; не править вслепую |
| Каталог | `pages/catalog.tsx` | Каталог продукции | Каталогные данные | **Нет** | Нет управленческих агрегатов клиентов | **Класс 3** |
| Бейджи навигации | `App.tsx` + `lib/dealer-base-sidebar-client-count.ts` | Счётчики клиентов / ТТ | `managementPlane.mergedState` + ожидание team fetch | **Да** | Средний: не следует за hash команды на `/dealer-base` | Follow-up: опционально синхронизировать scope с hash |

---

## Классификация (сводка)

1. **Уже подключено к `useClientBaseManagementMergedState`:** `App.tsx` (бейджи), `main-role-dashboard`, `dealer-base`, `trade-points`, `tasks`, `client-map`.

2. **Нужно подключать / выравнивать с merge (follow-up, не сделано в этом PR):**  
   - `analytics-operational-data` / `analytics-operational-panel` (сейчас база строк — `DEALER_BASE_ROWS` без актуализации).  
   - `trade-points`: привязка `dashboardRopTeamId` к выбранной команде, если UX требует паритет с `/dealer-base`.  
   - Общий контекст или dedupe запросов: `client-base-activity-dashboard` ↔ `useClientBaseManagementMergedState`.

3. **Не подключать (другой бизнес-смысл или мок без ЛК актуализации):**  
   - Все экраны **sales-control** (планы, факт, performance, manager) — локальное хранилище планов.  
   - **`analytics.tsx`**, **`analytics-workspace.tsx`** в текущем виде — демо/ручной контур.  
   - **`catalog.tsx`** — каталог без клиентских KPI.

4. **Нужен backend / нельзя свести только к клиентскому merge:**  
   - Реальная аналитика продаж и план-факт из учётных систем (сейчас в UI — мок/local). Любая интеграция — отдельные API и контракты, не подмена `ActualizationState`.

---

## Вкладки, которые **не** должны использовать client-base `managementPlane`

- Весь контур **план-факт / sales-control** (пока данные планов и факта живут в отдельном клиентском store, не в актуализации ЛК).
- **Аналитика** на базе `sales-manager-kpi-data` и **analytics-workspace** на сидированных строках — до смены доменной модели.
- Страницы без сущностей «клиент / ТТ / актуализация» (каталог, обучение, заказы и т.д.).

---

## Проверки сборки

После изменений в репозитории:

```bash
cd apps/platform && npm run check
cd apps/platform && npm run build
```

---

## Связь с дашбордом активности

`use-client-base-activity-team-state` загружает и мержит те же пользовательские снимки, что и `fetchMergedTeamActualizationForManagement`, но **реализован отдельным хуком** и не подменяет снимок текущего пользователя на живой `contextState` так же, как `useClientBaseManagementMergedState`. Имеет смысл в follow-up свести к одному источнику или к общему провайдеру, чтобы не было двойных запросов и расхождений.
