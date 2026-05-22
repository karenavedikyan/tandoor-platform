# Управленческая плоскость данных клиентской базы (РОП / директор)

## Назначение

Для ролей `team_lead` и `sales_director` с включённой актуализацией один и тот же объединённый `ActualizationState` должен питать списки, KPI и счётчики, чтобы не смешивать «только state текущего пользователя» с данными менеджеров команды.

## Модули

- `client-base-management-scope.ts` — загрузка снимков по `resolveActualizationDashboardSourceUserIds`, merge через `mergeActualizationStatesForActivityDashboard`, обёртки `buildManagementDealerBaseRows`, `computeManagementDealerPickerKpis`.
- `use-client-base-management-merged-state.ts` — хук: для менеджера возвращает `contextState`; для РОП/директора мержит ответы API, подставляя в merge актуальный `contextState` текущего пользователя (свои правки без ожидания refetch). Обновление при `visibilitychange`.

## Где подключено

- `App.tsx` — бейджи навигации (клиенты, ТТ): `managementDisplayState` + `managementTeamFetchLoading` в `resolveSidebarWorkingDealerClientCount`; ТТ — `countWorkingTradePointsForSidebar(profile, mergedState)`. Scope по умолчанию: `initialRopManagerForProfile` (у директора «все команды»).
- `dealer-base.tsx` — строки/KPI/сегменты/создание клиента: `teamActualizationPlane`; индикатор загрузки/ошибки team fetch.
- `main-role-dashboard.tsx` — KPI главной.
- `trade-points.tsx` — списки и сводки ТТ (scope по умолчанию как у сайдбара).
- `tasks.tsx` — фильтрация задач по `allowedDealerIds` из merge; `dashboardRopTeamId` = фильтр команды на странице.
- `client-map.tsx` — маркеры и строки: merge + фильтр `ropTeam` из UI.

## Не покрыто этим PR (следующие шаги)

- Страницы sales-control (планы, performance), `analytics-workspace`, каталог с агрегатами — при необходимости подключить тот же хук или поднять контекст.
- Сайдбар не следует за hash-фильтром команды на `/dealer-base` (счётчик по умолчанию «все команды» для директора); согласованность с открытой страницей — возможное улучшение.

## Связь с дашбордом активности

`use-client-base-activity-team-state` решает сходную задачу для метрик активности. При желании оба хука можно свести к общему вызову `fetchMergedTeamActualizationForManagement`, оставив разную постобработку.
