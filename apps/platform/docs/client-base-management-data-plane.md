# Управленческая плоскость данных клиентской базы (РОП / директор)

Базовая интеграция: **PR #195** (`feat(platform): unify ROP and director client-base data plane`).  
Follow-up **класса 2** (единый team-fetch, scope dealer-base ↔ trade-points, операционная аналитика по актуализированным строкам, дашборд активности): отдельный PR поверх #195 / документации #196.

**Активная база без демо-среза (директор / РОП):** при включённой актуализации (`ClientBaseActualizationProvider`) и роли `sales_director` / `team_lead` управленческие экраны **не** подставляют полный статический `DEALER_BASE_ROWS`, не раздувают задачи синтетической матрицей по всем строкам каталога и **не** показывают пустой город как «—» в городских сводках — см. раздел **«Только активная merge-база (production UI)»** ниже.

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

3. **Операционная аналитика** — в `analytics-operational-data.ts` введены **`buildOperationalAnalyticsRowSlicesFromDealers`** и опциональные аргументы «срез строк» / **`omitSyntheticOperationalKpis`**. В **`analytics-operational-panel.tsx`** при включённой актуализации и team plane срезы строятся из **`buildDealerBaseRowsWithActualization(teamCtx.mergedState, …, { includeArchivedDealers: false })`**; при отсутствии срезов fallback по клиентам для оборудования — **пустой список**, а не все строки `DEALER_BASE_ROWS`. Для РОП/директора на merge вызывается **`buildOperationalAnalyticsRowSlicesFromDealers(..., { omitSyntheticOperationalKpis: true })`**: **продажи, конверсия, демо-модели на витрине, синтетическое оборудование** не подставляются — в UI **«Нет актуальных данных»** и поясняющие карточки до подключения BI/учёта. Для остальных ролей / без team plane по-прежнему используется статический срез `DEALER_BASE_ROWS` с демо-числами (демо-контур).

4. **Актуализация базы** — селект «РОП / команда» для директора синхронизирован с контекстом (`dashboardRopTeamId` ↔ UI `__all__`); при смене команды вызывается `publishDashboardRopTeamId`.

## Только активная merge-база (production UI директор / РОП)

Единое правило: **`buildDealerBaseRowsWithActualization(mergedState, profile, { includeArchivedDealers: false })`** + **`roleScopedDealerRows`** там, где нужен scope роли. Архивные клиенты (`archivedDealersById`) и архивные ТТ не попадают в рабочие списки и KPI этих экранов; ТТ архивных клиентов исключаются вместе с клиентом.

### Задачи по витрине (без раздувания матрицей)

- **`getShowcaseBackedTasksForDealers(dealers)`** (`trade-point-task-data.ts`) — для переданных строк: только **sessionStorage витрины** + **дефицит матрицы по фактическим моделям ТТ** (без генерации десятков тысяч задач из полного каталога по каждой ТТ).
- **`getAllMatrixTasks()`** остаётся для режимов **без** включённой актуализации / демо-контуров менеджера, где нужна прежняя совместимость.
- Страница **`/tasks`**: при `actx.enabled` источник задач — showcase-backed по **working** строкам merge; иначе — прежний полный набор.

### Карточка территории

- **`territory-card.tsx`**: при выключенной актуализации для управленческих ролей страница недоступна (нет подстановки статического датасета). При включённой — **`buildTerritoryCardLivePack`** (`territory-card-live-data.ts`) из merge-строк: сводка, города, фокус, топ задач, «худшие» ТТ, KPI обучения/внимания через **`getTrainingAttentionKpisForDealers`**, риски из реальных просрочек. **План-факт:** пока нет backend — блок «План-факт пока не настроен» (пустой `planLines`).

### Главная директор / РОП

- **`main-role-dashboard.tsx`**: при `actx` и роли директор/РОП **нет** полного дампа `DEALER_BASE_ROWS` в дашборд; открытые задачи — showcase-backed по scoped клиентам. Синтетический **`MainPlanExecutionChart`** для этих ролей при активном merge заменён карточкой-заглушкой «план-факт не подключён». Подпись контекста: **«Источник: актуальная активная база»** где уместно.

### Аналитика

- **`analytics.tsx`**: для директор/РОП + `actx` — короткий экран без демо-аналитики (вместо полной seeded-страницы).
- **`analytics-workspace.tsx`**: флаг **`suppressSeededRows`** — таблица/сводка без подмешивания статических строк; пустой баннер при отсутствии данных.
- **`analytics-workspace-release-overview.tsx`**: `workingRows` из merge при `actx`; команды/менеджеры — **`buildTeamSummaryFromRows`**, **`aggregateManagersForTeamFromRows`**; задачи — showcase-backed vs полная матрица по тому же правилу; строка **«Источник: актуальная активная база»** для dept/ROP.

### Города и концентрация

- **`city-concentration.ts`**: пустое значение города, «—», `-` нормализуются в метку **«Без города»** (не отдельный фиктивный город «—» в UI).

### Обучение / зоны внимания (KPI)

- **`training-attention.ts`**: бейджи уровней — **primary / muted** (без красного/янтарного как обязательного акцента). **`getTrainingAttentionKpisForDealers(dealers)`** — агрегация только по переданным активным строкам; **`getTerritoryTrainingAttentionKpis()`** делегирует к нему при необходимости согласованного среза.

## Закрытые риски (класс 2)

- Двойной GET team state между «Клиентская база» и «Актуализация базы» при team plane.
- Расхождение снимков активности и merge для РОП/директора при той же логике `userId`.
- Директор: несовпадение scope между `/dealer-base` и `/trade-points` и счётчиками сайдбара при сохранённом фильтре команды (без отдельного URL — за счёт LS + события).
- Операционная панель: полностью статический список клиентов из `DEALER_BASE_ROWS` при наличии актуализированного merge.
- Дашборд/территория/задачи: гигантские числа из **синтетической матрицы задач** по всему мок-каталогу.

## Ограничения (намеренно не трогали или отдельный домен)

- **`analytics.tsx`**, **sales-control** — без management plane; другие датасеты / планы.
- Для **РОП/директора** на team merge поля **продаж / конверсии / витрина / оборудование** в операционном блоке **не** заполняются синтетикой от индекса (`omitSyntheticOperationalKpis`); для **менеджера и демо** без merge по-прежнему — детерминированная синтетика на `DEALER_BASE_ROWS` (не факт из backend).
- Реальная аналитика продаж и план-факт из учётных систем — вне объёма client-base merge; до появления API соответствующие блоки показывают **empty-state** или скрыты на директорских/РОП экранах.
- **`analytics-infographics-panel.tsx`** — по-прежнему вызывает `getInfographic*` со **статическим** срезом по умолчанию (демо-инфографика там, где доступна полная страница «Аналитика»); в merge-контуре операционной панели типы KPI допускают `null`, инфографика остаётся на `STATIC_OPERATIONAL_ROW_SLICES` — отдельный контур.

## Скрытые до backend показатели (РОП / директор, `omitSyntheticOperationalKpis`)

При `buildOperationalAnalyticsRowSlicesFromDealers(..., { omitSyntheticOperationalKpis: true })` в типах строк допускается `null` для полей, которые раньше считались от индекса строки:

| Область | Поля / блоки | Поведение |
|--------|----------------|-----------|
| Витрина клиента | `totalSales`, `showcaseSales`, `conversionPercent`, `unitsOnShowcase`, даты проверки, модели МК/ВХ/фурнитуры из каталога | `null` / пустые массивы; в таблице — «Нет актуальных данных» |
| Рентабельность витрин | `totalSales`, `showcaseSales`, `shareShowcasePercent`, `profitabilityScore`, `competitorShowcases` | `null`; сохраняются `ourShowcases` (число ТТ в merge) и `attentionZone` по полям `DealerRow` |
| Конверсия фурнитуры | `mkSales`, `hardwareSales`, `conversionPercent`, тексты конкурентов | `null` / пусто; уровень конверсии `none` |
| Оборудование | весь срез `equipment` | пустой массив; вкладка с пояснением empty-state |
| KPI strip / карточки | агрегаты продаж | текстовые empty-state, без нулей как «факта» |

Менеджер и демо-режим без merge по-прежнему используют полный синтетический расчёт на `DEALER_BASE_ROWS`.

## Таблица: раздел | до | после | проверка

| Раздел | До | После | Проверка |
|--------|----|---------|----------|
| Team-fetch РОП/директор | Два потока: `useClientBaseManagementMergedState` и `useClientBaseActivityTeamState` | Один `ClientBaseTeamActualizationProvider` + activity hook читает контекст | Открыть `/dealer-base` и `/client-base-activity`: сеть — один набор запросов state на команду (при той же роли и включённой актуализации). |
| Актуализация базы / снимки для «кто добавил» | Отдельный merge в хуке | `activitySourceSnapshots` из провайдера | KPI «добавлено вручную» / диалоги детализации согласованы с теми же снимками, что и merge. |
| Scope директора dealer-base ↔ trade-points | Разный default для trade-points и hash dealer-base | Общий LS + `publishDashboardRopTeamId`; URL `team`/`rop` на обеих страницах | Выбрать команду на `/dealer-base` → открыть `/trade-points`: те же клиенты/ТТ в scope; сброс — снова все команды. |
| Сайдбар счётчики | Не следовали за выбором команды | `useClientBaseTeamActualization` в `AuthenticatedShell` | Смена команды на dealer-base обновляет бейджи без перезагрузки. |
| Операционная аналитика | Только `DEALER_BASE_ROWS` | При team plane: срезы из merge **без архивных клиентов**; пустой fallback вместо всех строк | Под РОП/директором с актуализацией списки клиентов совпадают с активной базой по id. |
| Задачи / главная / территория | `getAllMatrixTasks()` по всему моку | При `actx`: showcase-backed по merge-строкам | Числа задач масштаба «десятки тысяч» не воспроизводятся из матрицы каталога. |
| Инфографика аналитики | Статический срез | **Без изменений в merge** (отдельный контур) | Регрессии инфографики смотреть отдельно. |

## Таблица аудита управленческих вкладок (текущее состояние)

Легенда **managementPlane**: «Да» = данные merge через `useClientBaseTeamActualization` / `useClientBaseManagementMergedState`; «Частично» = merge для списков/KPI клиентов, но часть метрик — синтетика поверх строк или отдельный домен; «Нет» = другой домен / выключенная актуализация.

| Раздел | Файл / компонент | Источник данных | managementPlane | Примечание |
|--------|------------------|-----------------|-----------------|------------|
| Навигация | `App.tsx` | merge + счётчики | **Да** | |
| Главная | `main-role-dashboard.tsx` | merge → строки; задачи showcase-backed при `actx` | **Да** / **Частично** | План-факт: заглушка для директор/РОП при `actx` |
| Клиентская база | `dealer-base.tsx` | merge + persist | **Да** | Публикация scope команды |
| Торговые точки | `trade-points.tsx` | merge | **Да** | Тот же scope, что dealer-base |
| Задачи | `tasks.tsx` | merge + showcase-backed при `actx` | **Да** | |
| Карточка территории | `territory-card.tsx` | merge + `buildTerritoryCardLivePack` | **Да** | Без актуализации — недоступно для director/ROP |
| Карта | `client-map.tsx` | merge | **Да** | |
| Актуализация базы | `client-base-activity-dashboard.tsx` | merge + `activitySources` из провайдера | **Да** | Селект команды директора → `publishDashboardRopTeamId` |
| Операционная аналитика | `analytics-operational-panel.tsx` | merge → срезы без архива; **`omitSyntheticOperationalKpis`** при team plane | **Да** | Состав id — активная база; KPI продаж/конверсии/витрины/оборудования — empty-state до BI |
| Аналитика (страница) | `analytics.tsx` | при director/ROP + `actx` — empty / без демо | **Да** (ограниченно) | Не подменяет полный демо-экран |
| Рабочая область аналитики | `analytics-workspace.tsx`, `analytics-workspace-release-overview.tsx` | merge + suppress seeded при `actx` | **Частично** | Сводка ТОП 500 без фейковых сумм; таблицы пустые до выгрузки |
| План-факт / sales-control | sales-control, проч. | local / мок | **Нет** | На главной директора при `actx` — отдельная заглушка план-факта |

---

## Классификация (сводка)

1. **Подключено к team actualization / active merge:** `App.tsx`, `main-role-dashboard`, `dealer-base`, `trade-points`, `tasks`, `territory-card`, `client-map`, `client-base-activity-dashboard`, операционная панель (срезы при team plane, **`omitSyntheticOperationalKpis`** для РОП/директора), обзор release в analytics-workspace при `actx`, упрощённый `analytics.tsx` для director/ROP.

2. **Инфографика** (`analytics-infographics-panel`) остаётся на статическом срезе; при необходимости отдельный PR — merge + скрытие демо для руководителя.

3. **Синтетика намеренно остаётся (до backend) там, где нет merge РОП/директора:** демо-операционные числа на `DEALER_BASE_ROWS` для менеджера и демо-контуров.

4. **Удалено или отключено для director/ROP + `actx`:** полный `DEALER_BASE_ROWS` на главной; полный `getAllMatrixTasks` для KPI задач; демо-страница `analytics` целиком; seeded строки и фейковая сводка ТОП 500 в `analytics-workspace`; синтетические KPI операционного блока (`omitSyntheticOperationalKpis`); синтетический план-факт chart на главной; фиктивный город «—» как отдельная сущность в концентрации.

5. **Не подключать без отдельного ТЗ:** sales-control, полный `analytics.tsx`, каталог — см. выше.

6. **Нужен backend:** фактические продажи, настоящий план-факт, исторические заказы, отгрузки оборудования, конкурентная аналитика по витрине, реальные открытые задачи вне витрины/sessionStorage.

---

## Активная рабочая база vs архив (управленческие экраны)

- **Рабочая база по умолчанию:** клиент не в `archivedDealersById`; в строке `DealerRow` поля `tradePoints`, `outlets` и `format` считаются только по **неархивным** ТТ (`archivedTradePointsById` и `entry.isArchived` исключаются), см. `applyDealerRowTradePointOutletProjection` в `client-base-actualization-data-merge.ts`.
- **Режим «архив» в клиентской базе:** только клиенты из `archivedDealersById`; для карточки архивного клиента в проекцию ТТ попадают **все** точки merge (включая помеченные архивом), чтобы не терять контекст карточки.
- **Торговые точки:** в рабочем режиме список — только неархивные клиенты и неархивные ТТ; при включённом переключателе «архив» — **только архивный срез:** ТТ с флагом архива у **активных** клиентов **и** все ТТ клиентов из `archivedDealersById` (без смешения с рабочим списком), см. `buildTradePointListForActualization` с `archivedTradePointsOnly`.
- **Сводки по командам:** `buildTeamSummaryFromRows` использует переданные строки (актуализация); **`aggregateManagersForTeamFromRows`** — агрегаты менеджеров по переданным scoped-строкам.
- **Сайдбар:** счётчики уже через `includeArchivedDealers: false` и список ТТ без архива — согласованы с рабочей базой.
- **Актуализация базы:** текущие KPI/гео по `scopedRows` — только активные клиенты; для подписей событий по id используется объединение активных + только архивных строк (`buildDealerBaseRowsUnionForActivityLabels`), чтобы не терять имена после архивации клиента.

---

## Вкладки, которые **не** должны использовать client-base `managementPlane`

- Весь контур **план-факт / sales-control** (кроме явных empty-state / заглушек на дашборде директора при `actx`).
- **`analytics.tsx`** (полная демо-страница) для руководителя с `actx` упрощена отдельно; **табличный** `analytics-workspace` при `actx` скрывает демо-строки и фейковую сводку для РОП/директора.
- Страницы без сущностей «клиент / ТТ / актуализация» (каталог, обучение, заказы и т.д.) — по роли и маршруту.

---

## Проверки сборки

```bash
cd apps/platform && npm run check
cd apps/platform && npm run build
```

---

## Связь с дашбордом активности

`use-client-base-activity-team-state` при **`shouldUseTeamMergedActualizationPlane(profile)`** и наличии **`ClientBaseTeamActualizationProvider`** использует **`teamCtx.mergedState`**, **`teamCtx.activitySourceSnapshots`** и **`teamCtx.activityDiagnostics`** — без второго независимого merge. Для менеджера и при выключенной актуализации остаётся прежняя логика (self / пусто).

---

## Ручная проверка (директор и РОП, актуализация включена)

1. **Главная:** счётчики клиентов/ТТ и задач согласованы с `/dealer-base` и `/tasks` (порядок величин — сотни/тысячи по реальной базе, не «30k+» задач из матрицы). Есть строка про источник данных / план-факт не подключён.
2. **`/dealer-base`, `/trade-points`:** только активные клиенты и ТТ; смена команды директора синхронизирует scope.
3. **`/tasks`:** список задач меняется при данных витрины в sessionStorage; нет всплеска при первом заходе из генерации по всему каталогу.
4. **Карточка территории:** города без строки «—»; группа «Без города» только при реальных пустых городах; план-факт — пустое состояние, если нет линий.
5. **`/client-base-activity`:** KPI и гео по активной базе в scope.
6. **Операционная аналитика:** выпадающий список клиентов — из активной базы; при пустом merge — пусто, не весь мок.
7. **`/analytics` и analytics-workspace:** нет полного демо-дампа строк для director/ROP; при отсутствии данных — баннеры empty-state.
