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
| Новый клиент, созданный вручную | `manuallyCreatedDealersById[id]` — id **стабилен на время диалога**: `manual-dealer-{yyyyMMddHHmmss}-{shortRandom}`; в записи хранятся `internalCode` (например `MA-MANUAL-000001`), `createdAt`, `createdBy`, `createdByName`, `source: "manual_actualization"`, поля в `fields` (в т. ч. **паспорт:** `passportClientKind`, `passportLifecycleStatus`, `passportCategoryTier`, `territoryZone`, `logisticsComment`, плюс коммерческие характеристики и `external1cCode`) |
| Архив клиента (мягкое скрытие из рабочей базы) | `archivedDealersById[dealerId]` — запись о факте архива; данные клиента и ТТ в состоянии **не удаляются**; в списке «Клиентская база» по умолчанию клиент скрыт; режим «Показать архив» показывает **только** архивных |
| Новая торговая точка | `manuallyCreatedTradePointsById[id]` — id: `manual-tp-{dealerId}-{yyyyMMddHHmmss}-{shortRandom}`, метаданные создания, при повторном сохранении после ошибки — **тот же id** (upsert) |
| Правки существующей ТТ | `tradePointOverridesById` |
| Архив / закрытие ТТ | `archivedTradePointsById` (+ в UI точка скрыта из обычного списка) |
| Юрлица: поля записей (в т. ч. вручную созданные) | `legalEntityOverridesByDealerId[dealerId].overridesById[legalEntityId]` — объект с полями `name`, `inn`, `entityType` (`ooo` \| `ip` \| `self_employed` \| `other`), `internalCode` (`TND-LE-000001`), адреса, контакты, `comment`, метаданные `updatedAt` / `updatedBy` |
| Юрлица: мягкий архив (release и manual) | `archivedLegalEntitiesById[legalEntityId]` — `{ legalEntityId, dealerId, archivedAt, archivedBy, archivedByName, source }`; запись в `overridesById` **не удаляется** |
| Юрлица (legacy внутри dealer-блока) | `legalEntityOverridesByDealerId[dealerId].archivedById` — по-прежнему учитывается в merge; новые архивы пишутся в `archivedLegalEntitiesById` |

`mergeActualizationState()` используется при локальных обновлениях перед отправкой на сервер.

### Клиент в архиве и восстановление

- **Рабочий список:** при выключенном «Показать архив» в «Клиентской базе» показываются только клиенты **без** записи в `archivedDealersById`.
- **Режим архива:** при включённом «Показать архив» в списке только архивные клиенты; в строке — бейдж «В архиве» (`badge-dealer-archived-{dealerId}`).
- **KPI «Торговые точки» и поле `outlets`:** в управленческих списках на строке клиента считаются только **неархивные** ТТ (и ТТ клиента в архиве не попадают в рабочий список точек); проекция в `buildDealerBaseRowsWithActualization` через `applyDealerRowTradePointOutletProjection`.
- **Карточки команд / главная:** сводки команд строятся из актуализированных строк **активной** базы (`buildTeamSummaryFromRows`), а не из полного release-снимка без архива.
- **Баннер на карточке:** для архивного клиента показываются `badge-dealer-card-archived`, `text-dealer-card-archived-hint` и кнопка `button-dealer-restore-{dealerId}` (при наличии прав).
- **Восстановление:** `persist` с новым объектом `archivedDealersById` **без** `dealerId` и POST тем же API, что при архивации. Успешный toast «Клиент восстановлен» — только если `persist` вернул `success`; при ошибке сохранения — сообщение об ошибке, без успешного toast.
- **Редактирование архивного клиента** обновляет overrides, но **не снимает** архив автоматически — в рабочую базу клиент возвращается только после явного восстановления.
- **Merge:** поля `archivedDealersById`, `archivedTradePointsById`, `archivedLegalEntitiesById`, `archivedDealerContactsById` в `mergeActualizationState` подменяются целиком, если patch их передаёт — иначе удаление ключа при восстановлении не применилось бы (поверхностный spread с базой оставил бы старый id).

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

### DaData (поиск юрлица по ИНН и подсказки адресов)

Секрет **`DADATA_API_KEY`** задаётся только в переменных окружения сервера (например Vercel); в клиентский бандл не попадает.

- **Поиск организации по ИНН:** при `DADATA_PARTY_LOOKUP_ENABLED=true` и наличии ключа ответы DaData (`findById/party`) дополняют локальный поиск в форме юрлица; кнопка «Найти по ИНН» объединяет локальные совпадения и строки из DaData.
- **Подсказки адреса:** при наличии ключа вызывается `POST /api/dadata/address-suggest` (обёртка над `suggest/address`). Опционально можно отключить подсказки, задав `DADATA_ADDRESS_SUGGEST_ENABLED=false` (при отсутствии ключа сервис всё равно считается неподключённым).
- **Ручной ввод:** поля адреса остаются обычными текстовыми областями с подсказками; если DaData недоступна или не настроена, формы не ломаются — пользователь вводит адрес вручную.

### storageMode

| Значение | Смысл |
|----------|--------|
| `persistent` | Postgres; чтение/запись между устройствами. |
| `server_memory` | Нет env БД: in-memory в процессе. |
| `not_configured` | Хранение отключено конфигом. |
| `local_fallback` | Клиент: API недоступен, использован кеш `localStorage`. |

Индикатор: `client-base-actualization-sync-status.tsx` (`text-actualization-sync-status`, `text-actualization-offline-fallback`).

### Защита от stale-state overwrite (Промт 331)

**Инцидент 13.06.2026, 03:00:48 UTC.** У восьми менеджеров параллельно сброшены поля `archivedDealersById` (у части также `dealerOverridesById` и другие manager-only словари). В БД изменился `updated_at` строки, но внутренний `state.updatedAt` в JSONB остался от 06.06–12.06 — классический **stale-state overwrite**: фоновая вкладка/PWA отправила устаревший снапшот, сервер записал его поверх свежей версии.

До Промта 331 от случайной потери защищены были только `trashedDealersById` / `trashedTradePointsById` (`applyTrashProtection` в `shared/actualization-trash.ts`). Остальные manager-only id-словари перезаписывались полным POST без проверки.

**Механизм (только сервер, `api/actualization/state.ts`):**

1. **Stale-POST detection.** После чтения `prevState` из Postgres (или memory store) сравнивается `prevState.updatedAt` с **входящим** `body.state.updatedAt` — тем, что клиент прислал **до** перезаписи сервером на `now`. Если оба значения — валидные ISO-строки и `incoming.updatedAt < prev.updatedAt`, запрос считается устаревшим.
2. **Defensive merge** (`applyStaleStateMerge` в `shared/actualization-merge.ts`). Для каждого поля из `MANAGER_ID_DICT_FIELDS`: если ключ есть в `prevState`, но отсутствует в incoming — запись **восстанавливается** в итоговый state. Ключи, явно присутствующие во incoming, **не перезаписываются** (легитимное обновление или намеренное удаление при свежем снапшоте).
3. Порядок в POST: `prevState` → stale merge (если нужно) → `applyTrashProtection` → `INSERT ... ON CONFLICT`.

**Защищённые поля** (15 id-словарей): `archivedDealersById`, `archivedTradePointsById`, `archivedLegalEntitiesById`, `archivedDealerContactsById`, `dealerOverridesById`, `manuallyCreatedDealersById`, `tradePointOverridesById`, `manuallyCreatedTradePointsById`, `legalEntityOverridesByDealerId`, `dealerActualizationContactsById`, `dealerActualizationAuditByDealerId`, `unloadingOrderByDealerId`, `dealerPhotosByDealerId`, `tradePointPhotosByTradePointId`, `tradePointShowcaseActualizationById`.

**Поведение для клиента:**

| Ситуация | Результат |
|----------|-----------|
| Свежий POST (`incoming.updatedAt ≥ prev.updatedAt`) | Как раньше: удаления и правки применяются. |
| Stale POST (`incoming.updatedAt < prev.updatedAt`) | Пропавшие ключи в id-словарях восстанавливаются из `prevState`; явные ключи во incoming сохраняются. |
| POST без `updatedAt` | Merge **не** активируется (нет сигнала устаревания). |

В логах сервера при срабатывании: `[actualization-api] STALE POST scope=... incoming=... prev=... recovered=...`.

Клиентский код не меняется; защита работает для любых клиентов (веб, PWA, фоновые вкладки). Восстановление данных, уже потерянных в инциденте 13.06, — отдельная задача (PITR / ручное восстановление).

## Ручной клиент / ТТ без подмешивания release

Идентификаторы: префиксы `manual-dealer-` и `manual-tp-` (см. `isManualActualizationDealerId` / `isManualActualizationTradePointId` в `client-base-actualization-stable-ids.ts`).

- **Паспорт и логистика в `fields`:** анкета `dealer-manual-actualization-page.tsx` читает блок «Паспорт клиента» из `manuallyCreatedDealersById[id].fields` (слияние с `dealerOverridesById[id].fields` для правок). При **создании** клиента (`DealerActualizationCreateDialog`) в `fields` должны попадать те же ключи, что и при редактировании: `passportClientKind`, `passportLifecycleStatus`, `passportCategoryTier`, `territoryZone`, `logisticsComment`, а также `name`, `inn`, `clientCategory`, `status`, `city`, `address`, ответственные, день отгрузки, маршрут, порядок выгрузки, комментарий, контакты и коммерческие поля. **Проверка:** «Добавить клиента» → заполнить «Паспорт клиента» и логистику → Сохранить → открыть клиента из списка → значения в аккордеоне «Паспорт клиента» / «Адрес и логистика» → F5 → без потерь.
- **Строка дилера** (`manualDealerToRow`): не копируется первая строка `DEALER_BASE_ROWS`; витрина, конкуренты, KPI, дистрибуция и связанные поля — нейтральные пустые значения, чтобы детерминированные «пилотные» хелперы не подставляли демо.
- **Коммерческие признаки** (склады двери/фурнитуры, Tandoor Club, спецусловия, КЭШБЭК, код 1С): хранятся в `manuallyCreatedDealersById` / `dealerOverridesById` в `fields`, мержатся в `DealerRow` (`mergeDealerRowWithActualization`). По умолчанию для ручного клиента все три-state поля — **`null` («не указано»)**. В списке «Клиентская база» бейджи «Tandoor Club», «Спецусловия», «Кешбек агент» и склады показываются **только при явном `true`** (`getDealerProgramSignal` / `getDealerStockSignal` для `manual-dealer-*` не используют эвристики от категории и `dealer-characteristics`).
- **Карта клиентов** (`pages/client-map.tsx`): при включённой актуализации строки берутся из `buildDealerBaseRowsWithActualization(state, profile, { includeArchivedDealers: false })`, поэтому клиенты из `archivedDealersById` **не попадают на карту** по умолчанию; ручные клиенты — в наборе, если проходят роль и фильтры (координаты — по прежней логике `client-map-data`). Параметр `includeArchivedDealers: true` используется только на странице клиентской базы в режиме «Показать архив» и означает **список только архивных** клиентов.
- **Нет виртуальной ТТ** без явных точек: `mergeTradePointsForActualization` и `getEffectiveDealerTradePoints` не добавляют «Основную торговую точку» с адресом из карточки дилера.
- **Юрлица из release** не подмешиваются: `mergeLegalEntitiesForActualization` для ручного дилера стартует с пустого списка.
- **Синтетика по id** отключена в общих модулях: `dealer-card-release-signals`, `dealer-stock-signals`, `dealer-equipment-signals`, `showcase-distribution-data` (план витрины и задачи), `trade-point-matrix-data` (матрица для `manual-tp-`), `training-attention.ts`.
- **Карточка клиента** (`dealer-card-foundation.tsx`): отдельные empty state для витрины, конкурентов, истории; блок Bitrix24 и характеристики скрыты, чтобы не вводить в заблуждение.

## Клиентский слой (этап 3)

- **Тема интерфейса (светлая / тёмная / системная):** см. `docs/theme-ui.md` — `ThemeProvider`, ключ `tandoor-theme-v1`, переключатель в шапке и в мобильном меню; витрина дилеров использует семантические классы темы.
- **Контекст:** `context/client-base-actualization-context.tsx` — загрузка, `persist(updater)`, `mergedDealerRows`, статус синхронизации.
- **API:** `lib/client-base-actualization-api.ts` — вызовы GET/POST и разбор `storageMode` / ошибок.
- **Стабильные id и проверки дублей:** `lib/client-base-actualization-stable-ids.ts` — генерация id, поиск дублей по ИНН / названию+городу.
- **Список клиентов:** `pages/dealer-base.tsx` — строки из merge, кнопка «Добавить клиента», синхронизация. Поиск (`lib/dealer-base-picker-filters.ts`) ищет по названию, коду, городу, РОП, менеджеру, типу, адресу, идентификатору и `actualizationInn` (с нормализацией к цифрам — можно вводить ИНН с пробелами/дефисами или только цифры). **Фильтры:** расширенный блок (признаки, план, сегмент, склад, география, ответственные, рабочий режим) сворачивается; строка поиска и быстрые статусы остаются на виду. На узком экране по умолчанию блок свёрнут, на широком — развёрнут при первом визите; состояние «свёрнуто» хранится в `localStorage` (`tandoor-dealer-base-filters-collapsed-v1`). **Витрина дилеров** — основной режим списка; три плотности (как в RemCard по механике, палитра Tandoor): **Крупно**, **Сетка**, **Список**; дополнительно **Таблица**. Переключатель иконками: `section-dealer-showcase-density-icons`, кнопки `button-dealer-showcase-density-large|grid|list|table`. Быстрое фото клиента и ТТ из витрины: `components/showcase-cover-photo-slot.tsx` + `EntityActualizationPhotoGallery` (обложка из merge, первое загруженное фото становится главным через `appendDealerPhoto` / `appendTradePointPhoto`). Подробные `data-testid`, миграция `compact`→`grid` в `localStorage`, проверки light/dark/mobile — см. `docs/dealer-showcase-density-ux.md`. Крупный вид — карточки в одну колонку; внутри — торговые точки как филиалы. **Геофильтры** (регион, район, населённый пункт): значения строятся из полей `city` и адреса строки без внешней геокодировки (`lib/dealer-base-geo-parse.ts`), эвристический разбор строки адреса; фильтрация подключена в `applyDealerBasePickerFilters`.
- **Карточка:** `pages/dealer-card-foundation.tsx` — merge строки, кнопка «Редактировать», счётчики ТТ/юрлиц.
- **Торговые точки:** `components/dealer-trade-points-section.tsx` — добавление / редактирование / архив при включённой актуализации и правах.

### Отображение торговых точек

Страница **`pages/trade-points.tsx`** — сводный список по зоне ответственности (`buildTradePointListForActualization`).

- **Режимы:** Крупно, Сетка, Список, Таблица — как у «Витрины дилеров»; блок `section-trade-points-density-icons`, кнопки `button-trade-points-density-large|grid|list|table`.
- **localStorage:** ключ **`tandoor-trade-points-density-v1`**. Миграция с **`tandoor-trade-points-view-mode-v1`**: `cards`→`large`, `compact`→`grid`, `list`→`list`; старый ключ удаляется при переносе или при следующем сохранении плотности.
- **Mobile:** режим «Таблица» на узком экране отображается как «Список», без горизонтального скролла.
- **Фото:** `ShowcaseCoverPhotoSlot` с `kind="trade_point"` и размерами `large` / `grid` / `list` / `table`; тексты плейсхолдера «Добавьте фото точки» / «Покажите фасад или витрину».
- **Контакты:** `lib/dealer-contact-links.ts` — ссылки tel / WhatsApp / mailto в карточках и строках.
- **Тесты / разметка:** `card-trade-point-large-{id}`, `card-trade-point-grid-{id}`, `row-trade-point-list-{id}`, `row-trade-point-table-{id}`, `cell-trade-point-table-photo-{id}`.
- **Архив:** подсказка `text-trade-points-archived-dealers-hidden-hint`; точки архивных клиентов не в рабочем списке до восстановления клиента. Режим «Показать архив» на странице ТТ: **только архивный срез** — отдельно архивированные ТТ у **активных** клиентов и **все** ТТ клиентов из `archivedDealersById` (без смешения с рабочим списком).
- **Массовый выбор:** `panel-trade-points-bulk-actions`, чекбоксы во всех режимах плотности.

- **Юрлица:** `components/dealer-legal-entities-section.tsx` — диалог формы, сохранение в `legalEntityOverridesByDealerId`, архив в `archivedLegalEntitiesById`, дубль ИНН, `SectionSaveButton` при актуализации; хелперы в `lib/client-base-actualization-legal-entities.ts`. Тот же блок подключён в **чистой анкете** `components/dealer-manual-actualization-page.tsx` (аккордеон «Юридические лица»), а не только в полной карточке `dealer-card-foundation.tsx`.

### Карточка клиента в clean mode (`dealer-manual-actualization-page.tsx`)

Используется для **вручную созданного** клиента и для **release-клиента** при `CLIENT_BASE_ACTUALIZATION_CLEAN_MODE` (без демо-блоков).

- **Верх страницы:** компактная ссылка «Назад к клиентской базе», кнопка «Редактировать» (`button-dealer-edit`), «Удалить клиента» — компактная outline-кнопка с акцентом destructive (`button-dealer-delete-{id}`).
- **Hero-блок:** название, код клиента (`text-dealer-internal-code`), код 1С (`text-dealer-external-1c-code`), основной контакт и контакты (`text-dealer-primary-*`).
- **Синхронизация:** компактный режим `ClientBaseActualizationSyncStatus` с `compact` — статус, время обновления, кратко про хранение (Postgres / память сервера и т.д.).
- **Секции анкеты:** внешний вид — отдельные карточки-аккордеоны; в свёрнутом заголовке — краткая строка-summary и текстовый бейдж («Не заполнено» / «Есть данные» / «Заполнено» / «Требует внимания»), плюс стандартный chevron.
- **По умолчанию все секции свёрнуты.** Кнопка **«Развернуть всё» / «Свернуть всё»** (`button-dealer-sections-expand-all`). Состояние раскрытия сохраняется в `localStorage` по ключу `tandoor-dealer-clean-card-sections-v1-{dealerId}` (массив id открытых секций). После сохранения данных секции **сами по себе не раскрываются** — только меняется контент и summary.
- **Контейнер:** на широком экране контент ограничен `max-w-5xl`, фон страницы слегка отличается от карточек для читаемости.
- **Провайдер в дереве:** `App.tsx` оборачивает маршруты в `ClientBaseActualizationProvider`.

После каждого сохранения по карточке клиента: обновление локального `state`, вызов сохранения через API, тост «Сохранено» или сообщение об ошибке на русском.

### Карточка торговой точки в clean mode (`trade-point-manual-actualization-view.tsx`)

Используется на странице ТТ при `CLIENT_BASE_ACTUALIZATION_CLEAN_MODE` и правах актуализации (см. `trade-point-detail.tsx`).

- **Второй визуальный polish (после карточки клиента #165):** та же плотность и спокойная палитра — аккордеон-триггеры с `font-semibold` и muted summary `text-sm`, компактные отступы, бейджи секций в едином стиле с клиентской карточкой, без крупных серых плиток в hero; числовые и текстовые пустые значения в сводках показываются как **«Не указано»**, даты витрины и Bitrix24 в UI через `formatDisplayDate` / `formatDisplayDateTime` (без сырых ISO).
- **Верх страницы:** компактная строка — «Назад» (ghost), «К клиенту» (outline), «Редактировать» (emerald primary, раскрывает паспорт и адрес), «В архив» — **outline** destructive, не крупный блок (`button-trade-point-archive-{tradePointId}`). Диалог подтверждения архива рендерится в `trade-point-detail.tsx`.
- **Hero:** как у клиента — левый emerald accent, белая карточка, название + код ТТ (mono/emerald), сетка полей без тяжёлых `bg-muted` плиток; бейджи витрины / дефицита / порталов компактные; **фото точки** — `TradePointPhotoBlock` с `compact`, под основным блоком, не доминирует по высоте.
- **Синхронизация:** компактный `ClientBaseActualizationSyncStatus` с `compact` (тот же вид, что на карточке клиента).
- **Секции:** карточки-аккордеоны `rounded-lg`, плотный триггер (title + badge в одной строке); внутри секций подписи полей uppercase micro, поля ввода `min-h-9` где уместно.
- **По умолчанию все секции свёрнуты.** Кнопка **«Развернуть всё» / «Свернуть всё»** (`button-trade-point-sections-expand-all`) — компактный ghost в строке заголовка «Разделы анкеты». Состояние раскрытия в `localStorage`: **`tandoor-trade-point-clean-card-sections-v1-{tradePointId}`**. Сохранение анкеты **не меняет** раскрытие секций.
- **Разделы:** «Паспорт торговой точки», «Адрес и формат», «Ответственные», «Витрина и порталы», при наличии открытых задач из актуализации — «Задачи по витрине» (компактный список без демо-данных), «Комментарии», **Bitrix24** — панель `compact`, по умолчанию свёрнута (`Bitrix24TasksPanel`), даты задач в человекочитаемом формате.
- **Витрина:** короткий summary в заголовке секции; внутри — уплотнённая сводка KPI, строка «Обновлено витрины» с форматированной датой при наличии `updatedAt`; логика порталов/каталога/`selectedShowcaseModels` без изменений.
- **Сохранение основных полей:** `button-trade-point-section-save-main` в «Адрес и формат»; комментарий — `button-trade-point-section-save-comments` в «Комментарии».

После каждого сохранения по карточке ТТ: обновление локального `state`, вызов сохранения через API, тост «Сохранено» или сообщение об ошибке на русском.

### Главная и «Задачи по витрине» в чистом режиме

При включённой актуализации KPI и виджеты главной и страницы задач должны соответствовать рабочей базе клиента, а не релизному mock:

- **`components/main-role-dashboard.tsx`** — KPI «Мои клиенты / Клиентов команды / Всего клиентов», «Активные клиенты», «Требуют внимания», «Открытые задачи по витрине», а также «Менеджеров в команде» / «Команд (РОПы)» считаются по `buildDealerBaseRowsWithActualization(state, profile, { includeArchivedDealers: false })`. Если после ролевого фильтра рабочих клиентов нет, виджет «План-факт» и блок «Команды РОПов» скрываются, вместо них показывается подсказка `card-main-empty-working-base` со ссылкой вернуться к клиентской базе. План-факт — синтетический сценарный показатель и не отображается в пустой рабочей базе.
- **`pages/tasks.tsx`** — список и KPI «Задач по витрине» считаются по идентификаторам клиентов из той же merge-выборки (`workingDealerRows`), архивированные клиенты исключаются. При первичной загрузке актуализации (`actx.loading`) задачи временно пустые, пока state не подгрузится, чтобы не показывать устаревшие цифры. Если в рабочей базе нет клиентов, KPI 0/пустой список, как и должно быть в чистом состоянии.

## `data-testid` (основные)

| Элемент | testid |
|---------|--------|
| Редактировать клиента | `button-dealer-edit` |
| Развернуть / свернуть все секции clean-карточки клиента | `button-dealer-sections-expand-all` |
| Развернуть / свернуть все секции clean-карточки ТТ | `button-trade-point-sections-expand-all` |
| Секция «Адрес и формат» (ТТ clean) | `section-trade-point-address-format` |
| Секция «Комментарии» (ТТ clean) | `section-trade-point-comments` |
| Сводная секция задач витрины (ТТ clean) | `section-trade-point-showcase-tasks-summary` |
| Сохранить комментарий ТТ (clean) | `button-trade-point-section-save-comments` |
| Диалог редактирования | `dialog-dealer-edit` |
| Сохранить правки клиента | `button-dealer-save` |
| Открыть «Добавить клиента» | `button-dealer-create` |
| Диалог создания | `dialog-dealer-create` |
| Подтвердить создание в диалоге | `button-dealer-create-submit` |
| ТТ: добавить | `button-trade-point-create` |
| ТТ: диалог | `dialog-trade-point-create` |
| ТТ: редактировать (список / полная карточка) | `button-trade-point-edit-{tradePointId}` |
| ТТ: редактировать (clean-карточка актуализации) | `button-trade-point-edit` |
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
| Коммерческие характеристики (форма / анкета) | `section-dealer-commercial-characteristics`, `select-dealer-door-warehouse`, `textarea-dealer-door-warehouse-comment`, `select-dealer-hardware-warehouse`, `textarea-dealer-hardware-warehouse-comment`, `select-dealer-tandoor-club`, `textarea-dealer-tandoor-club-comment`, `select-dealer-special-terms`, `textarea-dealer-special-terms-comment`, `select-dealer-cashback-client`, `textarea-dealer-cashback-client-comment`, `input-dealer-external-1c-code`, `text-dealer-external-1c-code` |
| Бейджи в списке клиентской базы (программы) | `badge-dealer-special-terms-{id}`, `badge-dealer-tandoor-club-{id}`, `badge-dealer-cashback-client-{id}` (суффикс `id` клиента для уникальности в списке) |

## Дашборд активности актуализации

**Назначение.** Отдельный экран для **директора продаж** (`sales_director`) и **РОП / руководителя команды** (`team_lead`): на период ручного заполнения клиентской базы видно, кто из менеджеров вносит данные, сводные KPI, динамику по дням, доли видов активности, качество заполнения и список типовых проблемных карточек. Менеджерам пункт меню и маршрут **не показываются** (см. `canAccessClientBaseActivityDashboard` и навигацию в `auth-access.ts`).

**Маршрут и UI.** Страница: `apps/platform/client/src/pages/client-base-activity-dashboard.tsx`, путь **`/client-base-activity`**, заголовок в интерфейсе — «Актуализация базы». Корневой контейнер: `data-testid="page-client-base-activity-dashboard"`.

**Источники данных.** Снимок `ActualizationState` и список клиентов после merge с актуализацией. Псевдо-события собираются в `client-base-activity-metrics.ts` из:

- `manuallyCreatedDealersById`, `dealerOverridesById`;
- `manuallyCreatedTradePointsById`, `tradePointOverridesById`;
- `legalEntityOverridesByDealerId`;
- архивов: `archivedDealersById`, `archivedTradePointsById`, `archivedLegalEntitiesById`, `archivedDealerContactsById`;
- `dealerPhotosByDealerId`, `tradePointPhotosByTradePointId`;
- `tradePointShowcaseActualizationById` (заполненная витрина, задачи матрицы `showcaseMatrixTasks`);
- `dealerActualizationContactsById` (атрибуция по `updatedBy` / `updatedByName`).

Если имя пользователя не передано в данных, используется справочник `getSalesUserById`, затем эвристика по строке клиента, иначе подпись «Не определён».

**Метрики (KPI в шапке).** За выбранный период (или «всё время»): созданные вручную клиенты, обновления клиента (override), ручные ТТ, касания юрлиц (по датам в overrides), загруженные фото (клиент + ТТ), число ТТ с заполненной витриной (с учётом периода по `showcaseUpdatedAt` из строки списка ТТ), текущие показатели дефицита матрицы и открытых задач, число менеджеров с хотя бы одним действием в периоде. При необходимости сравнение с предыдущим таким же по длине интервалом — для подписи «к предыдущему периоду» на карточках KPI.

**Score активности.** Условный балл по менеджеру: веса за виды событий заданы в `SCORE` в `client-base-activity-metrics.ts` (создание клиента, обновление, ТТ, юрлицо, контакт, фото, витрина, архивы, задачи матрицы и т. д.). Рейтинг сортируется по score и дате последней активности. Статусы «Активно» / «Слабо» / «Нет активности» зависят от числа действий в выбранном периоде и давности последнего события (пороги в `activityStatusForManager`).

**Графики (Recharts).** Динамика по дням (стек по типам), горизонтальные бары по score, круговая/кольцевая доля структуры активности — `data-testid`: `chart-activity-by-day`, `chart-activity-by-manager`, `chart-activity-breakdown`. Блок качества базы — `section-activity-quality`, проблемные зоны — `section-activity-problems`.

**Фильтры.** Период (сегодня / вчера / 7 / 30 / всё время), РОП, менеджер, региональный менеджер, город, тип активности, переключатель «только с активностью» — `data-testid`: `select-activity-period`, `select-activity-rop`, `select-activity-manager`, `select-activity-regional-manager`, `select-activity-city`, `select-activity-type`, `switch-activity-only-active`.

**Drilldown по менеджеру.** Клик по строке рейтинга открывает диалог с хронологией псевдо-событий: `dialog-activity-manager-detail`, `list-activity-manager-events`, строки `row-activity-event-{eventId}`.

**Mobile.** KPI в две колонки, графики с адаптивной высотой без горизонтального скролла, таблица менеджеров заменяется карточками, фильтры в `Collapsible`, детализация в `Dialog`.

## Архив клиентов и торговых точек

- **Архив клиента** (`archivedDealersById`) — это soft-delete: клиент **скрыт** из рабочей клиентской базы; в **рабочем** списке торговых точек точки этого клиента не строятся, пока клиент в архиве. В **режиме архива** на странице ТТ они снова доступны в составе архивного среза (см. `buildTradePointListForActualization` с `archivedTradePointsOnly`).
- **Рабочая база** (`includeArchivedDealers` не задан или `false` в `buildDealerBaseRowsWithActualization`) — архивные клиенты в выдачу **не попадают**.
- **Режим «Показать архив»** на странице клиентской базы — в списке **только** клиенты из `archivedDealersById`; подсказка в UI поясняет, что правки карточки не возвращают клиента в рабочую базу.
- **Карточка архивного клиента** открывается для просмотра и редактирования: `persist` сохраняет изменения, запись остаётся в `archivedDealersById` — клиент **не возвращается** в общую базу автоматически.
- **Восстановление** — явное действие «Восстановить клиента» (снятие `dealerId` из `archivedDealersById`). После восстановления снова в рабочем списке появляются **только неархивные** торговые точки клиента (точки, у которых отдельно есть запись в `archivedTradePointsById`, **остаются** архивными и не «откатываются» вместе с клиентом).
- **Список торговых точек**: переключатель «Показать архивные ТТ» относится к архиву **точек**; точки клиентов, самих находящихся в архиве, в рабочем списке не показываются независимо от этого переключателя.

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
11. Архивировать клиента → в обычной базе не отображается → «Показать архив» — только архивные, есть баннер и бейдж «В архиве».
12. Открыть архивного клиента → видна панель с подсказкой и «Восстановить клиента»; сохранить правку → клиент остаётся в архиве; восстановить → снова в рабочей базе.
13. При архивном клиенте его ТТ нет в рабочем списке «Торговые точки»; после восстановления клиента неархивные ТТ снова в списке; ТТ, заархивированные отдельно, остаются скрытыми.
14. Кнопка «В архив» / «Удалить клиента» не показывается (или не применима), если клиент уже в архиве.

## Безопасность (демо)

Идентификация для API — демо: `userId` из профиля. Для прода нужны сессия и серверная проверка прав.

## Ограничения по охвату репозитория

Чат Bitrix24, OAuth, Коммуникации, каталог и смежные модули **вне** задач актуализации — изменения сосредоточены в `apps/platform` и описанных выше файлах. **Карта клиентов** при включённой актуализации использует merge-строки без архивированных клиентов. Для **ручного** клиента/ТТ изоляция от демо-данных витрины/матрицы выполняется в перечисленных выше файлах актуализации и карточки.

## Технический выбор драйвера БД

`@neondatabase/serverless` — использование внутри обработчика после проверки env.
