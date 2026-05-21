# Актуализация клиентской базы

## Цель

Менеджеры по продажам и руководители актуализируют клиентскую базу: правки по клиентам, новые дилеры, торговые точки, юрлица, временное закрытие / архив ТТ. Состояние должно быть **доступно с разных устройств** после входа под тем же пользователем; **localStorage не является единственным источником правды** — основной канал: **GET/POST `/api/actualization/state`** (при сбое сети — кеш и явный индикатор `local_fallback`).

## Роли и права

Модуль `client-base-actualization-permissions.ts`:

| Функция | Смысл |
|--------|--------|
| `canActualizeClientBase` | Режим актуализации доступен (флаг + роль не marketer/analyst). |
| `canCreateDealerDuringActualization` | Создание нового клиента вручную. |
| `canEditDealerDuringActualization` | Редактирование существующего клиента. |
| `canCreateTradePointDuringActualization` | Новая ТТ у клиента. |
| `canEditTradePointDuringActualization` | Правки ТТ. |
| `canArchiveTradePointDuringActualization` | Архив / закрытие ТТ (мягкое удаление). |
| `canArchiveDealerDuringActualization` | Мягкое архивирование вручну созданного клиента (те же границы, что и правка). |
| `canManageLegalEntitiesDuringActualization` | Юрлица в рамках клиента. |

Правила зоны ответственности **выровнены с** `canEditClientNextStep`:

- **sales_manager** — только клиенты с `releaseManagerId === personaUserId`.
- **team_lead** — клиенты команды (`releaseTeamId` совпадает с командой РОП).
- **sales_director** — все клиенты.
- **marketer / analyst** — без прав на актуализацию (кнопки создания/редактирования не показываются).

Архив ТТ у **менеджеров** дополнительно зависит от `CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED` в `client-base-actualization-config.ts`. У **team_lead** и **sales_director** — при наличии права редактировать клиента.

## Feature flags

Файл `client-base-actualization-config.ts`:

- `CLIENT_BASE_ACTUALIZATION_ENABLED` — общий выключатель режима.
- `CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED` — отключить архивирование ТТ у менеджеров.
- `CLIENT_BASE_ACTUALIZATION_CLEAN_MODE` — **чистая анкета** для всех клиентов в актуализации (release и manual): карточка клиента без демо-блоков; страница ТТ — анкета витрины без матрицы/синтетических задач до ввода данных; в списке ТТ скрыты демо-индикаторы витрины.

Для API (сервер):

- `TANDOOR_ACTUALIZATION_STORAGE=disabled|off|false` — отключает запись и переводит GET в режим `not_configured`.

## Где в `ActualizationState` хранятся данные (этап 3 UI)

Типы: `client-base-actualization-state.ts`. Слияние с релизными строками и профилем: `client-base-actualization-data-merge.ts`.

| Данные | Поле в `ActualizationState` |
|--------|-----------------------------|
| Правки полей карточки клиента (название, ИНН, город, адрес, телефон, email, ответственные, день отгрузки, порядок выгрузки, комментарий и др.) | `dealerOverridesById[id]`, при необходимости `unloadingOrderByDealerId`, `dealerShipmentDayLabelByDealerId` и связанные override-поля в override-объекте |
| ИНН для отображения в краткой информации (если вынесено отдельно от mock) | `dealerOverridesById` / поле `inn` в override; на строке списка — `actualizationInn` после merge |
| Новый клиент, созданный вручную | `manuallyCreatedDealersById[id]` — id **стабилен на время диалога**: `manual-dealer-{yyyyMMddHHmmss}-{shortRandom}`; в записи хранятся `internalCode` (например `MA-MANUAL-000001`), `createdAt`, `createdBy`, `createdByName`, `source: "manual_actualization"`, поля в `fields` |
| Архив вручну созданного клиента | `archivedDealersById[dealerId]` — запись о мягком архиве; клиент остаётся в `manuallyCreatedDealersById`, но **скрыт** из списка клиентской базы |
| Новая торговая точка | `manuallyCreatedTradePointsById[id]` — id: `manual-tp-{dealerId}-{yyyyMMddHHmmss}-{shortRandom}`, метаданные создания, при повторном сохранении после ошибки — **тот же id** (upsert) |
| Правки существующей ТТ | `tradePointOverridesById` |
| Архив / закрытие ТТ | `archivedTradePointsById` (+ в UI точка скрыта из обычного списка) |
| Юрлица: поля записей (в т. ч. вручную созданные) | `legalEntityOverridesByDealerId[dealerId].overridesById[legalEntityId]` — объект с полями `name`, `inn`, `entityType` (`ooo` \| `ip` \| `self_employed` \| `other`), `internalCode` (`TND-LE-000001`), адреса, контакты, `comment`, метаданные `updatedAt` / `updatedBy` |
| Юрлица: мягкий архив (release и manual) | `archivedLegalEntitiesById[legalEntityId]` — `{ legalEntityId, dealerId, archivedAt, archivedBy, archivedByName, source }`; запись в `overridesById` **не удаляется** |
| Юрлица (legacy внутри dealer-блока) | `legalEntityOverridesByDealerId[dealerId].archivedById` — по-прежнему учитывается в merge; новые архивы пишутся в `archivedLegalEntitiesById` |

`mergeActualizationState()` используется при локальных обновлениях перед отправкой на сервер.

### Юрлица: id, код, merge, восстановление

- **Технический id** вручную добавленного юрлица: `manual-legal-entity-{yyyyMMddHHmmss}-{random}` — задаётся один раз при открытии диалога «Добавить» и сохраняется в `overridesById` при первом успешном сохранении (повторный submit после ошибки не создаёт новый id).
- **Код в UI:** `TND-LE-000006` — выдаётся функцией `allocateNextLegalEntityDisplayCode` в `client-base-actualization-legal-entities.ts` по максимуму уже занятых кодов в состоянии актуализации.
- **Слияние:** `mergeLegalEntitiesForActualization` в `client-base-actualization-data-merge.ts` — база из паспорта + LS (`getMergedDealerLegalEntities`) для release-клиентов, только overrides для manual-клиента; архив: `isLegalEntityArchivedInActualization` (новый top-level + legacy `archivedById`).
- **Восстановление:** `restoreLegalEntityFromArchive(state, dealerId, legalEntityId)` в `client-base-actualization-legal-entities.ts` — снимает запись из `archivedLegalEntitiesById` и legacy-архива; в UI кнопка «Восстановить» в раскрытом списке архива при включённой актуализации.
- **Права на кнопки добавления / редактирования / архива:** при включённой актуализации — `canActualizeClientBase(profile) && canEditDealerDuringActualization(profile, row)`; без актуализации — прежний `canEditDealerLegalEntities` (зона ответственности как у карточки). Контакты по юрлицу редактируются по `canEditDealerLegalEntities` отдельно.
- **Проверка вручную:** режим актуализации → карточка клиента → блок «Юридические лица» → «Добавить юрлицо» → заполнить обязательные поля → сохранить → F5 → юрлицо и код на месте → «В архив» → подтвердить → F5 не возвращает в активный список → «Архив» → «Восстановить» → снова в активном списке.

## API и персистентность

- **GET** `/api/actualization/state?userId=<id>` — JSON: `success`, `storageMode`, `state`, `updatedAt`, при ошибке БД — `code` (например `ACTUALIZATION_STORAGE_ERROR`).
- **POST** `/api/actualization/state` — тело `{ "userId": "<id>", "state": { ... } }`.

Заголовок **`X-Tandoor-Demo-User-Id`**, опционально **`X-Tandoor-Demo-User-Role`** / query `role` (демо).

### Переменные окружения (Neon / Postgres)

`DATABASE_URL`, `POSTGRES_URL` или `NEON_DATABASE_URL`. SQL: **`apps/platform/docs/sql/client_base_actualization_state.sql`**.

### storageMode

| Значение | Смысл |
|----------|--------|
| `persistent` | Postgres; чтение/запись между устройствами. |
| `server_memory` | Нет env БД: in-memory в процессе. |
| `not_configured` | Хранение отключено конфигом. |
| `local_fallback` | Клиент: API недоступен, использован кеш `localStorage`. |

Индикатор: `client-base-actualization-sync-status.tsx` (`text-actualization-sync-status`, `text-actualization-offline-fallback`).

## Ручной клиент / ТТ без подмешивания release

Идентификаторы: префиксы `manual-dealer-` и `manual-tp-` (см. `isManualActualizationDealerId` / `isManualActualizationTradePointId` в `client-base-actualization-stable-ids.ts`).

- **Строка дилера** (`manualDealerToRow`): не копируется первая строка `DEALER_BASE_ROWS`; витрина, конкуренты, KPI, дистрибуция и связанные поля — нейтральные пустые значения, чтобы детерминированные «пилотные» хелперы не подставляли демо.
- **Нет виртуальной ТТ** без явных точек: `mergeTradePointsForActualization` и `getEffectiveDealerTradePoints` не добавляют «Основную торговую точку» с адресом из карточки дилера.
- **Юрлица из release** не подмешиваются: `mergeLegalEntitiesForActualization` для ручного дилера стартует с пустого списка.
- **Синтетика по id** отключена в общих модулях: `dealer-card-release-signals`, `dealer-stock-signals`, `dealer-equipment-signals`, `showcase-distribution-data` (план витрины и задачи), `trade-point-matrix-data` (матрица для `manual-tp-`), `training-attention.ts`.
- **Карточка клиента** (`dealer-card-foundation.tsx`): отдельные empty state для витрины, конкурентов, истории; блок Bitrix24 и характеристики скрыты, чтобы не вводить в заблуждение.

## Клиентский слой (этап 3)

- **Контекст:** `context/client-base-actualization-context.tsx` — загрузка, `persist(updater)`, `mergedDealerRows`, статус синхронизации.
- **API:** `lib/client-base-actualization-api.ts` — вызовы GET/POST и разбор `storageMode` / ошибок.
- **Стабильные id и проверки дублей:** `lib/client-base-actualization-stable-ids.ts` — генерация id, поиск дублей по ИНН / названию+городу.
- **Список клиентов:** `pages/dealer-base.tsx` — строки из merge, кнопка «Добавить клиента», синхронизация.
- **Карточка:** `pages/dealer-card-foundation.tsx` — merge строки, кнопка «Редактировать», счётчики ТТ/юрлиц.
- **Торговые точки:** `components/dealer-trade-points-section.tsx` — добавление / редактирование / архив при включённой актуализации и правах.
- **Юрлица:** `components/dealer-legal-entities-section.tsx` — диалог формы, сохранение в `legalEntityOverridesByDealerId`, архив в `archivedLegalEntitiesById`, дубль ИНН, `SectionSaveButton` при актуализации; хелперы в `lib/client-base-actualization-legal-entities.ts`. Тот же блок подключён в **чистой анкете** `components/dealer-manual-actualization-page.tsx` (аккордеон «Юридические лица»), а не только в полной карточке `dealer-card-foundation.tsx`.
- **Провайдер в дереве:** `App.tsx` оборачивает маршруты в `ClientBaseActualizationProvider`.

После каждого сохранения: обновление локального `state`, вызов сохранения через API, тост «Сохранено» или сообщение об ошибке на русском.

## `data-testid` (основные)

| Элемент | testid |
|---------|--------|
| Редактировать клиента | `button-dealer-edit` |
| Диалог редактирования | `dialog-dealer-edit` |
| Сохранить правки клиента | `button-dealer-save` |
| Открыть «Добавить клиента» | `button-dealer-create` |
| Диалог создания | `dialog-dealer-create` |
| Подтвердить создание в диалоге | `button-dealer-create-submit` |
| ТТ: добавить | `button-trade-point-create` |
| ТТ: диалог | `dialog-trade-point-create` |
| ТТ: редактировать | `button-trade-point-edit-{tradePointId}` |
| ТТ: удалить / в архив (список в карточке клиента) | `button-trade-point-delete-{tradePointId}` |
| ТТ: подтверждение удаления из карточки | `dialog-trade-point-delete-confirm`, `button-trade-point-delete-confirm`, `button-trade-point-delete-cancel` |
| ТТ: архив (страница точки) | `button-trade-point-archive-{tradePointId}` |
| Юрлицо: секция | `section-dealer-legal-entities` |
| Юрлицо: добавить | `button-legal-entity-add` |
| Юрлицо: форма (диалог) | `dialog-legal-entity-form` |
| Юрлицо: поля | `input-legal-entity-name`, `input-legal-entity-inn`, `select-legal-entity-type`, `input-legal-entity-kpp`, `input-legal-entity-ogrn`, `input-legal-entity-legal-address`, `input-legal-entity-actual-address`, `input-legal-entity-contact` (основной контакт), `input-legal-entity-phone`, `input-legal-entity-email`, `textarea-legal-entity-comment` |
| Юрлицо: сохранить | `button-legal-entity-save` |
| Юрлицо: карточка в списке | `card-legal-entity-{legalEntityId}` |
| Юрлицо: код | `text-legal-entity-code-{legalEntityId}` |
| Юрлицо: редактировать | `button-legal-entity-edit-{legalEntityId}` |
| Юрлицо: в архив | `button-legal-entity-delete-{legalEntityId}` |
| Юрлицо: подтверждение архива | `dialog-legal-entity-delete-confirm`, `button-legal-entity-delete-confirm`, `button-legal-entity-delete-cancel` |
| Юрлицо: пустой список | `text-legal-entities-empty-state` |
| Юрлицо: восстановить из архива | `button-legal-entity-restore-{legalEntityId}` |
| Статус синхронизации | `text-actualization-sync-status` |

## Ручные проверки (acceptance)

1. Под менеджером открыть своего клиента, изменить город / телефон / комментарий, сохранить, обновить страницу — изменения на месте.
2. Тот же логин в другом браузере или после очистки `localStorage` — данные подтянулись с API (`persistent`).
3. Создать нового клиента — появился в списке, карточка открывается по ссылке.
4. Добавить ТТ — отображается во вкладке «Торговые точки».
5. Отредактировать ТТ — после обновления страницы правки сохранены.
6. Удалить ТТ из карточки клиента (с подтверждением) — точка скрыта из обычного списка; после обновления страницы не возвращается.
7. Добавить юрлицо в актуализации — диалог, код `TND-LE-…`, после F5 на месте; дубль ИНН — предупреждение; «В архив» с подтверждением — скрыто из активного списка, после F5 не возвращается; в архиве — «Восстановить».
8. Маркетолог / аналитик — нет кнопок создания/редактирования актуализации.
9. `cd apps/platform && npm run check` — успех.
10. `npm run build` — успех.

## Безопасность (демо)

Идентификация для API — демо: `userId` из профиля. Для прода нужны сессия и серверная проверка прав.

## Ограничения по охвату репозитория

Чат Bitrix24, OAuth, Коммуникации, каталог, карта клиентов и смежные модули **вне** задач актуализации — изменения сосредоточены в `apps/platform` и описанных выше файлах. Для **ручного** клиента/ТТ изоляция от демо-данных витрины/матрицы выполняется в перечисленных выше файлах актуализации и карточки.

## Технический выбор драйвера БД

`@neondatabase/serverless` — использование внутри обработчика после проверки env.
