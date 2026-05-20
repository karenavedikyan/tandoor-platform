# Актуализация клиентской базы (foundation)

## Цель

Менеджеры по продажам и руководители актуализируют клиентскую базу: правки по клиентам, новые дилеры, торговые точки, юрлица, временное закрытие / архив ТТ. Состояние и черновики должны быть **доступны с разных устройств** после входа под тем же пользователем, поэтому **localStorage не может быть единственным источником правды**.

Этот документ описывает права, feature flags, типы `ActualizationState`, HTTP API, клиентский слой с индикатором синхронизации и **персистентное хранение в Postgres (Neon)** для `/api/actualization/state`. Полноценные формы и бизнес-операции — в следующих PR; **подключение persistent storage — до форм редактирования**, чтобы менеджеры не теряли данные между деплоями и устройствами.

## Роли и права

Модуль `client-base-actualization-permissions.ts`:

| Функция | Смысл |
|--------|--------|
| `canActualizeClientBase` | Режим актуализации доступен (флаг + роль не marketer/analyst). |
| `canCreateDealerDuringActualization` | Создание нового клиента (в следующих PR будет назначение на менеджера). |
| `canEditDealerDuringActualization` | Редактирование существующего клиента. |
| `canCreateTradePointDuringActualization` | Новая ТТ у клиента. |
| `canEditTradePointDuringActualization` | Правки ТТ. |
| `canArchiveTradePointDuringActualization` | Архив / закрытие ТТ (не hard delete в терминологии). |
| `canManageLegalEntitiesDuringActualization` | Юрлица в рамках клиента. |

Правила зоны ответственности **выровнены с** `canEditClientNextStep`:

- **sales_manager** — только клиенты с `releaseManagerId === personaUserId`.
- **team_lead** — клиенты команды (`releaseTeamId` совпадает с командой РОП).
- **sales_director** — все клиенты.
- **marketer / analyst** — без прав на актуализацию.

Архив ТТ у **менеджеров** дополнительно зависит от `CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED` в `client-base-actualization-config.ts`. У **team_lead** и **sales_director** — при наличии права редактировать клиента.

## Feature flags

Файл `client-base-actualization-config.ts`:

- `CLIENT_BASE_ACTUALIZATION_ENABLED` — общий выключатель режима (типы и API можно вызывать и при `false`, но UI расширенной актуализации в следующих PR должен уважать флаг).
- `CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED` — отключить архивирование ТТ у менеджеров, поменяв один флаг на `false`.

Дополнительно для API (сервер):

- `TANDOOR_ACTUALIZATION_STORAGE=disabled|off|false` — полностью отключает запись и переводит GET в режим `not_configured` (пустое состояние), даже если задан `DATABASE_URL`.

## Типы состояния

Файл `client-base-actualization-state.ts`:

- `ACTUALIZATION_STATE_VERSION` — версия схемы.
- `ActualizationState` и вложенные типы overrides / manual / archived / legal / card view / порядки выгрузки и маршрутов.
- `createEmptyActualizationState()`, `mergeActualizationState()` — для безопасных обновлений на клиенте.

## Где хранится состояние

### API

- **GET** `/api/actualization/state?userId=<id>` — JSON с полями `success`, `storageMode`, `state`, `updatedAt`, опционально `message`, при ошибке БД — `code` (например `ACTUALIZATION_STORAGE_ERROR`).
- **POST** `/api/actualization/state` — тело `{ "userId": "<id>", "state": { ... } }`, ответ в том же формате.

Заголовок **`X-Tandoor-Demo-User-Id`** (тот же `userId`) дублирует query для единообразия. Опционально **`X-Tandoor-Demo-User-Role`** или query `role` — сохраняется в колонке `role` строки Postgres (демо; для проды заменить на сессию).

Если в теле POST передан `userId`, он **должен совпадать** с userId из заголовка/query, иначе `400` (защита от смешения scope).

### Переменные окружения (Vercel / Neon)

Поддерживаются (приоритет слева направо):

1. `DATABASE_URL`
2. `POSTGRES_URL`
3. `NEON_DATABASE_URL`

Если ни одна не задана (и не включён глобальный disable), API использует **fallback in-memory** (`storageMode: server_memory`) с явным предупреждением в `message`.

В Vercel: Project → Settings → Environment Variables — добавьте строку подключения Neon в одно из этих имён. После деплоя без миграции таблицы ответ может быть `success: false`, `code: ACTUALIZATION_STORAGE_ERROR` — выполните SQL (см. ниже).

### SQL-схема и миграция

Файл: **`apps/platform/docs/sql/client_base_actualization_state.sql`**

Выполнение один раз (Neon SQL Editor или локально):

```bash
psql "$DATABASE_URL" -f apps/platform/docs/sql/client_base_actualization_state.sql
```

Таблица `client_base_actualization_state`: `scope_key` (уникальный, например `user:mgr-boyko-em`), `user_id`, `role`, `state` JSONB (весь `ActualizationState`), `version`, `created_at`, `updated_at`, индексы по `user_id` и `updated_at`.

### storageMode

| Значение | Смысл |
|----------|--------|
| `persistent` | Строка подключения к Postgres задана; чтение/запись через Neon serverless driver (`@neondatabase/serverless`). |
| `server_memory` | Нет env БД: in-memory `Map` в процессе serverless. На Vercel **нет гарантии** между инстансами и устройствами. |
| `not_configured` | `TANDOOR_ACTUALIZATION_STORAGE` отключён или GET в режиме «хранение выключено». |
| `local_fallback` | Только на клиенте: API недоступен, использован кеш `localStorage` (см. ниже). |

Индикатор UI (`client-base-actualization-sync-status.tsx`):

- **persistent** + успех → «Сохранено»
- **server_memory** + успех → «Временное серверное хранение, синхронизация между устройствами не гарантирована»
- **not_configured** → «Серверное хранение не настроено»
- **local_fallback** → «Работает локально, синхронизация недоступна»

### Ошибки хранилища (Postgres)

Если env для БД задан, но запрос к БД падает (нет таблицы, сеть, права):

- HTTP `200`, тело JSON: `success: false`, `storageMode: "persistent"`, `code: "ACTUALIZATION_STORAGE_ERROR"`, `message` на русском, **без** раскрытия connection string.
- Клиент (`client-base-actualization-api.ts`) отображает это как `syncStatus: "error"`.

### Клиентский fallback

Ключ кеша: `tandoor-client-base-actualization-state-cache-v1`. Используется **только** если запрос к API не удался (сеть, не-JSON). UI обязан показывать, что это **не** кросс-девайс синхронизация (`text-actualization-offline-fallback`).

## Безопасность (демо)

Идентификация пользователя для API — **демо**: `userId` из профиля передаётся клиентом (header/query). Это **не** production-grade RBAC. Для прода нужны сессия / JWT и проверка прав на сервере; колонки `scope_key` и `user_id` рассчитаны на замену источника идентичности без смены формата таблицы.

Сервер не отдаёт состояние другого пользователя: строка выбирается строго по `scope_key = user:{resolvedUserId}`.

## Ручные проверки

### Без `DATABASE_URL` локально

- `npm run check`, `npm run build`
- Импорт модуля: `npx tsx -e "import('./api/actualization/state.ts').then(() => console.log('ok'))"` из `apps/platform`
- `GET /api/actualization/state?userId=test-manager` + заголовок `X-Tandoor-Demo-User-Id` — JSON, `storageMode: server_memory`, не падает.

### С Neon после деплоя

1. Задать env, выполнить SQL из `docs/sql/client_base_actualization_state.sql`.
2. `GET /api/actualization/state?userId=test-manager` → `storageMode: persistent`, пустое или сохранённое состояние.
3. `POST` с телом `{"userId":"test-manager","state":{...}}` → `success: true`, обновлённый `updatedAt`.
4. Повторный `GET` — тот же `state` / `updatedAt` (в т.ч. после нового deploy — данные в БД, не в памяти процесса).

## Ограничения текущего PR

- Нет форм редактирования клиента / ТТ / юрлиц.
- Нет скрытия блоков карточки (только тип `DealerCardViewSettings` в state).
- Чат Bitrix24, Коммуникации, каталог, матрица витрины, задачи Bitrix24 **не затрагиваются**.

## Технический выбор драйвера

Используется **`@neondatabase/serverless`**: HTTP/WebSocket-совместимый драйвер для serverless (Vercel), без долгоживущего пула на уровне модуля. Импорт драйвера и создание клиента выполняются **внутри** обработчика после проверки env, чтобы отсутствие пакета или некорректный env не ломали cold start до входа в handler.
