# План-факт продаж: рабочий экран `/sales-control/plan-fact`

## Назначение

Экран **`/sales-control/plan-fact`** (`SalesPlanFactManagementCockpit`) — единое место для директора, РОПа и менеджера: **выставить план на период**, **распределить KPI по менеджерам**, **внести факт** и видеть **выполнение** без «технических» формулировок и без подмешивания синтетики в persisted-слой.

## Источники данных

### Persisted слой (единственный источник цифр плана/факта в cockpit)

- **API:** `GET|POST /api/sales-plan-fact/state` (реализовано в **`apps/platform/api/actualization/state.ts`**, маршрут через **`vercel.json` rewrite** на общий actualization handler — отдельной Vercel function для план-факта нет).
- **Хранилище:** запись с `scope_key = org:default` в таблице **`sales_plan_fact_state`** (DDL idempotent через `CREATE TABLE IF NOT EXISTS` при обращении к Postgres). Подключение: `DATABASE_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL`.
- **Fallback:** память процесса на сервере, если Postgres не настроен (сообщение об этом в ответе API).
- **Отключение:** `TANDOOR_SALES_PLAN_FACT_STORAGE=disabled` — API возвращает пустой документ и не пишет.

Документ: **`SalesPlanFactPersistedState`** (`version`, `lines[]`). Строка **`SalesPlanFactLine`**: период, команда, менеджер (для rollup `manager`), метрика, **`planValue`**, **`actualValue` (`null` = факт не внесён)**, статус, аудит, комментарий.

### Что **не** подмешивается в цифры cockpit

- **SEED** из `sales-control-data.ts` в этот экран **не** подставляется.
- **sessionStorage** старых экранов `/sales-control/*` **не** читается.
- **localStorage** только для UI (режим просмотра, кеш последней успешной загрузки API).

### Справочники

- Команды и менеджеры: **`sales-control-data.ts`** (`SALES_TEAMS`, `getTeamById`, `getTeamManagers`, …) — для **названий** и scope, не как «факт продаж».
- Города в режиме «Города»: группировка по **`DEALER_BASE_ROWS`** для привязки к менеджерам.

## «План не задан» и «план 0»

- В persisted-слое **нет отдельного признака «пусто»**: отсутствие строк или `planValue === 0` означает **цель не задана**.
- В UI **не показывается осознанный «нулевой план»**: при отсутствии положительных планов в периоде показывается empty-state и подписи вида **«План не задан»**, а не «план 0» как будто это договорённая цель.
- **Положительный план** для empty-state: есть хотя бы одна строка с **`planValue > 0`** в scope (rollup `team` или `manager`) за выбранный период.

## Как выставить план

1. Выберите **период** и при необходимости **команду** (фильтр директора).
2. Нажмите **`+ Выставить план`** / **`Изменить план`** (тот же сценарий мастера).
3. В мастере **`Выставить план`**:
   - **Кому:** все РОПы, конкретная команда или конкретный менеджер (для РОПа/менеджера шаги сужены автоматически).
   - **KPI:** поля по списку **`SALES_KPI_METRICS_SORTED`**.
   - **Распределение** (если применимо): на уровне команды, поровну по менеджерам, вручную по менеджерам (для одной команды), по доле **прошлого периода** (если в прошлом периоде уже есть планы).
4. **`Сохранить черновик`** — статусы черновика; **`Выгрузить РОПу`** — публикация командных/менеджерских планов в persisted.

Копирование без мастера: в empty-state кнопка **`Скопировать прошлый период`** (активна, если в предыдущем периоде есть `planValue > 0` в scope). На уровне данных используется **`copySalesPlanFactPlansBetweenPeriods`**: копируются планы `team`/`manager`, **факт обнуляется** (`actualValue: null`).

## Как распределить по менеджерам

- В мастере выберите команду и вариант **«Поровну по менеджерам»**, **«Вручную по менеджерам»** или **«По доле прошлого периода»**.
- Либо режим **`Планы и факт`** — прямой ввод по менеджерам (как раньше), затем **Черновик** / **Сохранить факт** / **Подтвердить** по строкам.

## Как внести факт

- Кнопка **`Внести факт`** в верхней зоне открывает форму с полями: период, команда, менеджер, KPI, значение, комментарий. Если факт уже есть — заголовок **«Обновить факт»**.
- Быстрые кнопки **«Внести факт»** на карточках РОПа/менеджера и в drawer.

## Роли и scope

| Роль | Scope |
|------|--------|
| `sales_director` | Все команды; фильтр «Команда РОП». |
| `team_lead` | Только `persona.teamId`. |
| `sales_manager` | Только свой `persona.id`. |

## Mobile

- Режимы — **горизонтальные chips** с прокруткой без общего горизонтального скролла страницы.
- Основные действия — **крупные кнопки** в сетке 1–4 колонок.
- **`FloatingBackButton`** на этой странице **не используется**; навигация «На главную» — **ghost-ссылка** в шапке страницы.

## Test id (основные)

| Зона | `data-testid` |
|------|----------------|
| Первичные действия | `section-sales-plan-fact-primary-actions`, `button-sales-plan-fact-create-plan`, `button-sales-plan-fact-add-actual`, `button-sales-plan-fact-history` |
| Empty-state плана | `section-sales-plan-fact-empty-plan`, `button-sales-plan-fact-empty-create-plan`, `button-sales-plan-fact-copy-previous-period` |
| Режимы | `button-sales-plan-fact-mode-*` (в т.ч. `mode-entry` = «Планы и факт») |
| Мастер плана | `dialog-sales-plan-fact-plan-wizard`, `step-sales-plan-fact-plan-target`, `step-sales-plan-fact-plan-kpi`, `step-sales-plan-fact-plan-distribution`, `form-sales-plan-fact-plan-wizard`, `button-sales-plan-fact-plan-save-draft`, `button-sales-plan-fact-plan-publish` |
| Ввод факта (модалка) | `dialog-sales-plan-fact-actual-entry`, `form-sales-plan-fact-actual-entry`, `button-sales-plan-fact-actual-save` |
| Drawer | `dialog-sales-plan-fact-detail`, `section-sales-plan-fact-detail-actions`, `button-sales-plan-fact-detail-set-plan`, `button-sales-plan-fact-detail-distribute`, `button-sales-plan-fact-detail-add-actual`, вкладки `tab-sales-plan-fact-detail-plan`, `tab-sales-plan-fact-detail-fact`, `tab-sales-plan-fact-detail-history` |
| РОП (кнопки в раскрытии) | `button-sales-plan-fact-rop-set-plan-{teamId}`, `…-distribute-…`, `…-add-actual-…`, `…-detail-…` |
| Менеджер | `button-sales-plan-fact-manager-set-plan-{id}`, `…-add-actual-…`, `…-open-…` |

## Связь со старыми экранами

`/sales-control/director`, `/team-lead`, `/manager`, `/plans`, `/performance` остаются для обратной совместимости. Ссылка «К старым экранам» ведёт на **`/sales-control`**.
