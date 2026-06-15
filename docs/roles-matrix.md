# Матрица ролей Tandoor

Источник правды по тому, **что должен видеть пользователь каждой роли**.

Любой PR, меняющий:

- `apps/platform/shared/auth.ts` (permissions),
- `apps/platform/client/src/lib/auth-access.ts` (navigation),
- `apps/platform/client/src/lib/role-mapping.ts` (UserRole↔SalesRole),
- `apps/platform/client/src/lib/dealer-base-role-views.ts` (scope),
- `apps/platform/client/src/lib/dealer-base-real-scope.ts` (real scope),
- `apps/platform/client/src/lib/sidebar-nav-real-scope.ts` (sidebar real scope),
- `apps/platform/server/auth/handlers.ts` (visible-codes, org-snapshot),
- `apps/platform/shared/my-client-codes-handlers.ts` (my-codes),
- `apps/platform/shared/admin/actualization-dedupe.ts` (UUID→persona),

**обязан** обновить эту таблицу и обновить регресс-тесты в
`apps/platform/client/src/lib/__tests__/role-smoke.test.ts`.

## Полная матрица

| UserRole | SalesRole (через role-mapping) | Persona (SALES_USERS) | Sidebar items | Dealer scope | Trade points scope | KPI клиентской базы | Особые страницы | Корзина: видит | Корзина: удалить навсегда |
|---|---|---|---|---|---|---|---|---|---|
| admin | sales_director | user-dir-goncharenko (default) | grouped: unifiedSalesNavigation + группа «АДМИНИСТРИРОВАНИЕ» (/admin/*) | все клиенты | все ТТ | все (актуализация включена) | /admin/*, миграции, дедуп актуализации | да | да |
| director | sales_director | user-dir-goncharenko | grouped: unifiedSalesNavigation + админ-раздел (пользователи, назначения, аудит, диагностика) | все клиенты | все ТТ | все | план-факт, отчёты, /reset-requests | да | да |
| rop | team_lead | user-tl-&lt;UUID-маппинг&gt; или user-tl-kupiansky (fallback) | grouped: unifiedSalesNavigation | client_assignments where team.rop_user_id=me + rop_client_grants | то же (по кодам клиентов) | ~750–1300 (по команде) | drilldown менеджеров, /reset-requests | свой team scope | нет |
| regional_manager | team_lead | user-tl-kupiansky (fallback, нет persona в SALES_USERS) | grouped: unifiedSalesNavigation | dealer_overrides where regional_manager_id=me | то же (по кодам из overrides) | свой scope (ownCodes) | — | свой scope | нет |
| manager | sales_manager | mgr-&lt;UUID-маппинг&gt; или mgr-boyko-em (fallback) | grouped: unifiedSalesNavigation | client_assignments where responsible_user_id=me | то же | свой scope (ownCodes) | — | свой scope | нет |
| marketer | marketer | user-mkt-morozova (default) | grouped: unifiedSalesNavigation + /listings | все клиенты (read-only, access=sales_director) | все ТТ (read-only) | все (актуализация выключена) | листовки, брифы | да | нет |
| analyst | analyst | user-anl-ivanets (default) | flat: аналитика, клиенты, ТТ, дистрибуция, задачи, карта, коммуникации, каталог, брифы | все клиенты (read-only) | все ТТ (read-only) | все (актуализация выключена) | analytics-workspace, /admin/sync-health, /admin/audit, /admin/counts-diag | нет (маршрут /trash недоступен) | нет |
| category_manager | marketer (через role-mapping) | user-mkt-morozova (fallback, нет persona в SALES_USERS) | grouped: как marketer (unifiedSalesNavigation) | все клиенты (read-only, access=sales_director) | все ТТ (read-only) | все (актуализация выключена) | матрицы витрин (/distribution/matrix-catalog) | да | нет |

### Примечания к колонкам

- **Sidebar items** — `getPilotNavigation(salesRole, …, platformUserRole)` в `auth-access.ts`. Роли sales_* используют grouped layout (`unifiedSalesNavigation`); analyst — flat layout.
- **Dealer scope (real-режим)** — `roleScopedDealerRowsForReal` + `assignmentsScope` из `/api/clients/my-codes`. Для admin/director/marketer/analyst/category_manager my-codes возвращает пустые списки → видны все строки release-сидa (read-only для marketer/analyst/category_manager).
- **KPI клиентской базы** — счётчик сайдбара `resolveSidebarWorkingDealerClientCount` == KPI «Всего» на /dealer-base (промт 332). Для scoped-ролей зависит от `assignmentsScope` и `defaultDealerBasePickerArgsForCount` (в real-режиме `ropTeam: "all"`, промт 334).
- **Корзина: удалить навсегда** — `canForceDelete` в `trash-bin.tsx`: только `admin` и `director`. `canRunPurge` (cron purge) — только `admin`.

## Известные ловушки

1. **`UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE` + `LEADERS_UUID_TO_PERSONA`** — маппинг реальных UUID → persona id из `SALES_USERS`. Если новый реальный пользователь добавлен в БД, но не добавлен в маппинг, его `release-demo-profile` свалится на `defaultPersonaForRole(salesRole)`. Это ломает picker-фильтры (промт 332→334) и любую логику через `getEffectiveTeamLeadTeamId` / `getEffectiveSalesManagerId`.

   Текущий `LEADERS_UUID_TO_PERSONA`:
   - `ccffcf6e-2505-4eee-b257-ac65b60bb779` → `user-tl-kupiansky`
   - `c36f625f-730e-4ae3-b118-bdb005d10b81` → `user-tl-sapozhkov`
   - `3f67f770-f5cd-4257-a4b2-1cefa65fbfaa` → `user-tl-skalaban`

2. **`role-mapping.ts`** — текущий мост UserRole↔SalesRole. Для `category_manager` и `admin` `userRoleToSalesRole` возвращает `marketer`/`sales_director` соответственно. Любая логика, проверяющая роль через `SalesRole`, **не** различает admin/director или category_manager/marketer.

3. **`personaUserId` в real-режиме** — не должен ВЛИЯТЬ на видимость данных. Сейчас влияет в нескольких местах:
   - `defaultDealerBasePickerArgsForCount` (исправлено в промте 334 — фикс bypass для real-mode)
   - `getEffectiveTeamLeadTeamId` (используется в `team-summary`, `dealer-base-management-view-model`)
   - `getEffectiveSalesManagerId` (используется в plan-fact)
   - `roleScopedDealerRows` (demo-only, но импортируется в граничных местах)

   Долгая цель — убрать `personaUserId` из real-путей полностью (промты A/B/C, отдельно).

4. **`UserRole` "admin"** — сейчас в `userRoleToSalesRole` падает в `sales_director`. Это работает, но любой код, который проверяет «admin или director», должен явно сравнивать с `user.role === "admin" || user.role === "director"`, а **не** с salesRole.

5. **`category_manager`** — нет persona в `SALES_USERS`. Через `role-mapping` трактуется как marketer. Все попытки дать ему «права директора + матрицы витрин» через расширение marketer-логики неизбежно ломают остальных marketer-ов. Правильный путь — отдельная ветка в `auth-access.ts` для category_manager и явные проверки `user.role === "category_manager"` в server-handlers. Управление справочником матриц: `canManageShowcaseMatrixCatalog` проверяет `platformUserRole === "category_manager"` отдельно.

6. **`regional_manager` vs `rop`** — оба маппятся в `team_lead` (SalesRole), но `mapUserRoleToDealerBaseAccess` даёт `sales_manager` для regional_manager и `team_lead` только для rop. Scope regional_manager — через `dealer_overrides.regional_manager_id`, не через `teams.rop_user_id`.

## Процесс изменения матрицы

1. Открываешь PR с изменением одного из перечисленных файлов.
2. Обновляешь соответствующие строки/колонки этой таблицы.
3. Обновляешь / добавляешь смок-тесты в `role-smoke.test.ts`.
4. Запускаешь `npm run test:role-smoke` локально, проверяешь зелёный.
5. PR-template требует чек-листа: «Обновил roles-matrix.md» и «Прогнал test:role-smoke».
