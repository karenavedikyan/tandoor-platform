# Актуализация клиентской базы (foundation)

## Цель

Менеджеры по продажам и руководители актуализируют клиентскую базу: правки по клиентам, новые дилеры, торговые точки, юрлица, временное закрытие / архив ТТ. Состояние и черновики должны быть **доступны с разных устройств** после входа под тем же пользователем, поэтому **localStorage не может быть единственным источником правды**.

Этот документ описывает **первый PR серии**: права, feature flags, типы `ActualizationState`, HTTP API и клиентский слой с индикатором синхронизации. Полноценные формы и бизнес-операции — в следующих PR.

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

## Типы состояния

Файл `client-base-actualization-state.ts`:

- `ACTUALIZATION_STATE_VERSION` — версия схемы.
- `ActualizationState` и вложенные типы overrides / manual / archived / legal / card view / порядки выгрузки и маршрутов.
- `createEmptyActualizationState()`, `mergeActualizationState()` — для безопасных обновлений на клиенте.

## Где хранится состояние

### API

- **GET** `/api/actualization/state?userId=<id>` — JSON с полями `success`, `storageMode`, `state`, `updatedAt`, опционально `message`.
- **POST** `/api/actualization/state` — тело `{ "userId": "<id>", "state": { ... } }`, ответ в том же формате.

Заголовок **`X-Tandoor-Demo-User-Id`** (тот же `userId`) дублирует query для единообразия.

### storageMode

| Значение | Смысл (текущий MVP) |
|----------|---------------------|
| `server_memory` | In-memory `Map` в процессе serverless. На Vercel **нет гарантии** ни между инстансами, ни между устройствами. |
| `not_configured` | `TANDOOR_ACTUALIZATION_STORAGE=disabled` — запись отключена, GET отдаёт пустое состояние. |
| `local_fallback` | Только на клиенте: API недоступен, использован кеш `localStorage` (см. ниже). |
| `persistent` | Зарезервировано для Postgres / Vercel KV / Blob и т.д. — **сейчас не используется**. |

### Клиентский fallback

Ключ кеша: `tandoor-client-base-actualization-state-cache-v1`. Используется **только** если запрос к API не удался. UI обязан показывать, что это **не** кросс-девайс синхронизация (`text-actualization-offline-fallback`).

## Безопасность (демо)

Идентификация пользователя для API — **демо**: `userId` из профиля передаётся клиентом. Это **не** production-grade RBAC. Для прода нужны сессия / JWT и проверка прав на сервере.

## Следующие шаги для production-grade хранения

1. Подключить **Postgres** (уже есть паттерн SQLite в Express — для Vercel лучше внешняя БД).
2. Или **Vercel KV / Blob** для JSON-документа на пользователя.
3. Серверная проверка: роль и зона ответственности **до** записи state.

## Ручные проверки

1. Клиентская база: блок «Актуализация» для ролей с правами.
2. `GET /api/actualization/state?userId=mgr-boyko-em` + заголовок `X-Tandoor-Demo-User-Id` — JSON.
3. `POST` с телом `{"userId":"mgr-boyko-em","state":{...}}` — JSON с обновлённым `updatedAt`.
4. Отключить сеть / сломать URL — локальный fallback и предупреждение в UI.

## Ограничения текущего PR

- Нет форм редактирования клиента / ТТ / юрлиц.
- Нет скрытия блоков карточки (только тип `DealerCardViewSettings` в state).
- Чат Bitrix24, Коммуникации, каталог, матрица витрины, задачи Bitrix24 **не затрагиваются**.
