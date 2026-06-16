# Промт 363 — Аудит: единый источник правды для матрицы ТТ

**Дата:** 16.06.2026  
**Автор:** Computer (для RemCard)  
**Тип:** md-отчёт для согласования. **Код приложения не меняется** — только этот документ.  
**Статус:** черновик на ревью

---

## Цель отчёта

Зафиксировать целевую архитектуру «один источник правды — управляемая матрица ТТ» и составить план миграции.

Сейчас в коде сосуществуют два контура:

1. **Новая БД-инфраструктура** управляемых матриц (Промты 159–160: схема, API, страница-каталог, редактор).
2. **Старый хардкод-справочник** `SHOWCASE_MATRIX_MODEL_DEFINITIONS` + функция `getShowcaseMatrixModelsForTradePoint`, которая режет этот справочник по tier клиента.

Часть UI читает только хардкод или смешивает контуры. Это порождает расхождение между блоками **«Модели на витрине»** и **«Витрина торговой точки»** (выполнение матрицы).

---

## Решения, зафиксированные пользователем (16.06)

1. **Авторы матрицы:** Директор / РОП / Аналитик / Категорийный менеджер / Админ. В UI матрицы и в выпадайке точки обязательно показывать «кем создана» и «когда».
2. **Градация:** «Обязательно» + «Рекомендовано» (две планки; третья «Нейтрально» = не в матрице, но в каталоге дилера). Вариант «Запрещено» — **не вводим**.
3. **Дистрибуция без матрицы:** считается по факту занесённых моделей; в UI — плашка «Назначьте матрицу витрины»; KPI **не** используют эту ТТ как 0% — она **выпадает** из средних по сегменту.
4. **Порядок работ:** сначала этот аудит → расширение прав и UI создания → переключение источников чтения → чистка хардкода.

---

## Текущее состояние — что уже есть

### Управляемые матрицы (Промт 159–160) — работают

| Слой | Путь |
|------|------|
| БД | миграция `server/migrations/__tests__/showcase-matrix-catalog-migration.spec.ts` — таблицы `showcase_matrix_defs`, `showcase_matrix_def_models` |
| API | `apps/platform/api/showcase-matrix-catalog/[action].ts` — `list / get / resolve / upsert / batch / delete / setStatus` |
| Shared | `shared/showcase-matrix-catalog-handlers.ts`, права `shared/showcase-matrix-catalog-access.ts` |
| Клиент API | `client/src/lib/showcase-matrix-catalog-api.ts` |
| Кэш / офлайн | `showcase-matrix-catalog-store.ts`, `showcase-matrix-catalog-resolve.ts` |
| Страница каталога | `client/src/pages/distribution-matrix-catalog.tsx` — роут `/distribution/matrix-catalog` |
| Редактор | `client/src/components/distribution/matrix-catalog-def-editor-sheet.tsx` |
| View-model | `client/src/lib/distribution-matrix-catalog-view-model.ts` + тесты |
| Резолвер ТТ | `client/src/lib/trade-point-matrix-resolver.ts` |

**Поведение резолвера** (`trade-point-matrix-resolver.ts`):

- Сначала `resolveActiveMatrixDefFromCache` (БД-кэш) → `source: "managed"`.
- При отсутствии активной управляемой матрицы — fallback на `getShowcaseMatrixModelsForTradePoint` / фильтр `SHOWCASE_MATRIX_MODEL_DEFINITIONS` по `categoryRules` → `source: "fallback"`.

Поля автора в DTO уже есть: `updatedBy`, `updatedByName` (см. `showcase-matrix-catalog-handlers.ts`). Отдельного `createdBy` в схеме пока нет — уточнить в Промте 364.

### Хардкод-справочник — старый источник, ещё активен

**Файл:** `client/src/lib/trade-point-showcase-matrix-models.ts`

- Массив `SHOWCASE_MATRIX_MODEL_DEFINITIONS` — **8 моделей** (`MATRIX_MODEL_ORDER`).
- Привязка к категориям клиента через `categoryRules: ClientCategoryId[]` в `MATRIX_META`.
- `getShowcaseMatrixModelsForTradePoint(dealerId, tradePointId, clientCategory)` — **чистый хардкод**: берёт первые N моделей по tier (`top150` → 8, `top350` → 6, …) и ротирует сдвигом от `dealerId|tradePointId`. **Резолвер БД не вызывает.**

**Файл:** `client/src/lib/trade-point-showcase-matrix-required.ts`

```ts
export function getRequiredShowcaseMatrixDefinitions(clientCategory, scope?) {
  if (scope) return resolveRequiredTradePointMatrixModels({ ...scope, clientCategory });
  return SHOWCASE_MATRIX_MODEL_DEFINITIONS.filter((m) => m.categoryRules.includes(clientCategory));
}
```

- **Без `scope`** — только хардкод + `categoryRules`.
- **Со `scope`** — через резолвер (managed → high-priority; иначе fallback на `categoryRules`).

Нейтральные хелперы (не зависят от источника матрицы): `inferShowcasePortalTypeFromCatalogProduct`, `effectivePortalTypeForSelectedModel`, capacity-математика в `showcase-type-capacity.ts`.

**Корень проблемы:** поле `categoryRules` в `ShowcaseMatrixModelDefinition` «зашивает» в код правило «для TOP-N нужны вот эти модели». Это должно быть **редактируемым контентом** в `showcase_matrix_def_models`.

### Доступы — кто сейчас редактирует каталог матриц

**Клиент:** `canManageShowcaseMatrixCatalog` (`auth-access.ts:321`)

- `admin` (platform + sales role)
- `marketer`, `analyst`, `category_manager`

**Сервер:** `canManageShowcaseMatrixCatalogServer` (`showcase-matrix-catalog-access.ts`)

- `MANAGE_MATRIX_CATALOG_ROLES = admin, marketer, analyst, category_manager`

**Чего не хватает по запросу пользователя:** `sales_director` (Директор), `team_lead` (РОП).

---

## Ключевое расхождение UI (подтверждено по коду)

| Блок | Файл | Источник матрицы сегодня |
|------|------|--------------------------|
| **«Модели на витрине»** | `trade-point-showcase-catalog-panel.tsx:257–259` | `getRequiredShowcaseMatrixDefinitions(matrixClientCategory)` **БЕЗ scope** → только хардкод `categoryRules` |
| **«Витрина торговой точки»** | `trade-point-showcase-matrix-section.tsx:413–424` | `resolveTradePointMatrixWithSource({ dealerId, tradePointId, region, city, clientCategory })` → managed или пусто |
| **Счётчик шаблона / заглушка** | `distribution-tradepoint-matrix-entry.tsx:76–78` | `getShowcaseMatrixModelsForTradePoint(...).length` → **чистый хардкод tier** |

Итог: каталог-панель показывает «обязательные» по `categoryRules`, а секция матрицы при отсутствии managed-матрицы показывает `models = []` (режим без списка из хардкода). Пользователь видит **два разных мира**.

---

## Где справочник читается напрямую (минуя резолвер со scope)

Полный список файлов с зависимостью (команда от 16.06.2026):

```bash
grep -rn "SHOWCASE_MATRIX_MODEL_DEFINITIONS\|getRequiredShowcaseMatrixDefinitions\|categoryRules\|trade-point-showcase-matrix-required\|trade-point-showcase-matrix-models\|resolveRequiredTradePointMatrixModels\|trade-point-matrix-resolver" apps/platform --include="*.ts" --include="*.tsx" -l | sort -u
```

**34 файла** (актуально на main):

### Критичные — отображение / гейт / математика

| Файл | Зависимость | Приоритет миграции |
|------|-------------|-------------------|
| `components/trade-point-showcase-catalog-panel.tsx` | `getRequiredShowcaseMatrixDefinitions` без scope | **P0 — главный кандидат** |
| `components/distribution/distribution-tradepoint-matrix-entry.tsx` | `getShowcaseMatrixModelsForTradePoint` (hardcode count) | **P0** |
| `components/trade-point-showcase-matrix-section.tsx` | `resolveTradePointMatrixWithSource` (уже с scope; при fallback models=[]) | **P1 — доработать UX «нет матрицы»** |
| `components/distribution/distribution-fullscreen-entry.tsx` | косвенно через матрицу / пустые `categoryRules` в stub-моделях | P1 |
| `components/trade-point-showcase-catalog-slot.tsx` | обёртка каталог-панели | P1 (следует за панелью) |
| `components/trade-point-manual-actualization-view.tsx` | импорт цепочки matrix-required | P1 |

### Аналитика дистрибуции

| Файл | Зависимость |
|------|-------------|
| `lib/distribution-analytics/distribution-analytics-view-models.ts:189–193` | `isModelRequiredForDealerCategory` → `model.categoryRules.includes(clientCategory)` |
| `lib/distribution-entry-product-view-model.ts:53` | то же |
| `lib/distribution-entry-tradepoint-view-model.ts` | цепочка matrix-required |
| `lib/distribution-filters.ts` | цепочка matrix-required |
| `lib/distribution-scope-summary-view-model.ts` | `SHOWCASE_MATRIX_MODEL_DEFINITIONS.find` по targetId |
| `lib/distribution-analytics/distribution-analytics-math.ts` | только `effectivePortalTypeForSelectedModel` — **нейтрально** |

### Контент / презентация (оставить как справочник картинок и текстов)

| Файл | Назначение |
|------|------------|
| `lib/trade-point-showcase-matrix-models.ts` | источник определений + tier-slice |
| `lib/trade-point-showcase-segment-models.ts` | lookup def по id |
| `lib/trade-point-showcase-matrix-storage.ts` | презентация при сохранении |
| `components/model-card/model-card-header.tsx` | контент матричной карточки |
| `components/showcase-model-presentation-dialog.tsx` | презентация |
| `pages/model-card.tsx`, `pages/assignment-detail.tsx`, `pages/tasks.tsx`, `pages/catalog-product-1c.tsx` | косвенные импорты |

### Прочие lib / инфраструктура

| Файл |
|------|
| `lib/trade-point-matrix-resolver.ts` |
| `lib/trade-point-showcase-matrix-required.ts` |
| `lib/trade-point-showcase-matrix-filters.ts` |
| `lib/trade-point-list-for-actualization.ts` |
| `lib/showcase-matrix-deficit-tasks.ts` |
| `lib/showcase-type-capacity.ts` |
| `components/distribution/matrix-catalog-def-editor-sheet.tsx` |

### Тесты (переписать на fixture после миграции)

| Файл |
|------|
| `lib/__tests__/distribution-entry-product-view-model.test.ts` |
| `lib/__tests__/distribution-filters.test.ts` |
| `lib/__tests__/trade-point-matrix-resolver.test.ts` |
| `lib/__tests__/trade-point-showcase-distribution-from-matrix.test.ts` |
| `lib/__tests__/trade-point-showcase-matrix-filters.test.ts` |

### Уточнение по ложным срабатываниям grep

- `components/distribution-analytics/analytics-model-picker.tsx` — попадает в grep из‑за `inferShowcasePortalTypeFromCatalogProduct` (тип ВХ/МК/фурнитура из каталога). **К матрице ТТ не привязан** — миграция не требуется.

---

## Где хардкод нужен как контент (картинки, описания)

В `ShowcaseMatrixModelDefinition` поля контента: `imageUrl`, `importanceReason`, `characteristics`, `advantages`, `benefitsDealer`, `benefitsBuyer`, `objections`, `objectionAnswers`, `copyMessage`.

**Они должны остаться** (seed или отдельная таблица контента), но **независимо** от `categoryRules`.

Резолвер при managed-матрице подмешивает контент из хардкода по `HARDCODED_BY_ID` (`trade-point-matrix-resolver.ts:35, 88–102`). Если модели только в БД — описания могут быть пустыми (`emptyPresentation`). **Отдельная задача:** связать `targetId` (`catalog1cId` / id каталога 1С) с `TANDOOR_REAL_CATALOG_SEED` для имён и картинок.

---

## Целевая архитектура

### Слои источника правды

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Каталог моделей (товары)                                 │
│    TANDOOR_REAL_CATALOG_SEED + 1С                           │
│    имена, фото, doorKind, тип                               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│ 2. Матрицы витрин (планы выкладки)                          │
│    БД showcase_matrix_defs + showcase_matrix_def_models     │
│    обязательно/рекомендовано, сегмент, регион, период       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│ 3. Назначение матрицы конкретной ТТ                         │
│    resolveActiveMatrixDef(clientCategory, region, city, date)│
│    ОДИН источник. Без categoryRules в коде.                 │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│ 4. Факт витрины ТТ                                          │
│    selectedShowcaseModels + showcase_matrix_entries         │
│    что реально стоит / статусы позиций                      │
└─────────────────────────────────────────────────────────────┘
```

### Изменения в UI (целевое)

**«Модели на витрине»** (`trade-point-showcase-catalog-panel.tsx`)

- Заголовок: «Выбор моделей для витрины».
- Список и фильтры «Обязательные» / «Нужно поставить» — из матрицы ТТ через резолвер со scope.
- Бейджи: `high` → «Обязательно», `medium` → «Рекомендовано» (разные цвета).
- Нет матрицы → плашка «Назначьте матрицу витрины»; фильтры обязательных disabled/скрыты.

**«Витрина торговой точки»** (`trade-point-showcase-matrix-section.tsx`)

- Заголовок: «Выполнение матрицы».
- KPI из управляемой матрицы (есть managed).
- Нет матрицы → режим «По факту»: только `selectedShowcaseModels`, без % выполнения, плашка «Назначьте матрицу».

**Карточка модели**

- Бейдж «Обязательно для матрицы №N от {автор} ({дата})» со ссылкой на определение матрицы.

### Изменения в правах

| | Сейчас | Цель (Промт 364) |
|---|--------|------------------|
| Роли | admin, marketer, analyst, category_manager | + **sales_director**, **team_lead** |
| Синхронизация | client `auth-access.ts` + server `showcase-matrix-catalog-access.ts` | оба файла |

**РОП scope по региону** — вынести отдельно: на этапе 364 РОП видит все матрицы; ограничение `scopeRegion` — позже.

### Изменения в БД (обсуждение)

| Тема | Сейчас | Предложение |
|------|--------|-------------|
| Автор | `updatedBy`, `updatedByName` | UI «кем / когда»; опционально `createdBy` в Промте 364 |
| Градация | `showcase_matrix_def_models.priority` | `high` → Обязательно, `medium` → Рекомендовано, `low` — резерв |
| Сегмент | `segment: vh \| mk \| hardware` | маппинг в резолвере `catalogSegmentToModelType` |

---

## План миграции — Промты 364–370

### Промт 364 — Расширение прав + UI «автор матрицы» (S)

**Файлы:** `auth-access.ts`, `showcase-matrix-catalog-access.ts`, `distribution-matrix-catalog.tsx`, `matrix-catalog-def-editor-sheet.tsx`, тесты прав.

Без изменений источников чтения в каталог-панели.

### Промт 365 — Каталог-панель на матрицу ТТ (M)

**Файл:** `trade-point-showcase-catalog-panel.tsx`

- `requiredDefs` через `getRequiredShowcaseMatrixDefinitions(category, { dealerId, tradePointId, region, city })`.
- `hasManagedMatrix = resolved.source === "managed"`.
- Ветвление UI: плашка / disabled фильтры / бейджи по `priority`.

### Промт 366 — Секция «Витрина ТТ» (M)

**Файл:** `trade-point-showcase-matrix-section.tsx`

- KPI из managed-матрицы и `showcase_matrix_entries`.
- Режим «По факту» без % при отсутствии матрицы.
- `distribution-tradepoint-matrix-entry.tsx`: `templateModelsCount` через резолвер, не `getShowcaseMatrixModelsForTradePoint`.

### Промт 367 — Аналитика дистрибуции (L)

**Файлы:** `distribution-analytics-view-models.ts`, `distribution-entry-*-view-model.ts`, `distribution-filters.ts`, `distribution-scope-summary-view-model.ts`

- Убрать `categoryRules.includes`; «обязательность» = позиция в активной матрице ТТ.
- ТТ без матрицы — исключать из KPI-средних (не 0%).

### Промт 368 — Чистка `categoryRules` (S)

- Удалить `categoryRules` из типа / убрать fallback без scope.
- `SHOWCASE_MATRIX_MODEL_DEFINITIONS` — только контент-справочник.
- Обновить ~5 тестов.

### Промт 369 — Seed управляемых матриц для прод-демо (M)

- Миграция/сид: 4–5 матриц (по clientCategory + global) с моделями из текущего `MATRIX_META` / `categoryRules`.

### Промт 370 — Финальная чистка fallback (XS, опционально)

- Резолвер без fallback на хардкод; при недоступности БД — error-state + retry.

---

## Риски и нюансы

1. **Тесты завязаны на хардкод** — после 367–368 нужны injectable fixtures.
2. **`canEditTradePointShowcaseMatrix`** (`trade-point-showcase-matrix-storage.ts`) — кто редактирует **выбор на ТТ**, не определение матрицы. **Не трогаем** в этом плане.
3. **РОП scope-RBAC** — отдельно от 364.
4. **Промты 351, 355–361** (scope РОП, capacity, копирайтинг формы) — не пересекаются.
5. **Capacity / evaluateSelectionGate** — переживут миграцию без изменений.
6. **Два fallback-пути в резолвере:** `resolveTradePointMatrixModels` → tier-slice; `resolveRequiredTradePointMatrixModels` без managed → `categoryRules`. Оба нужно выключить после seed (369) и чистки (368–370).

---

## Что НЕ трогаем в рамках плана 364–370

- Схема `showcase_matrix_defs` / `showcase_matrix_def_models` (полей достаточно).
- Поля capacity: `entrancePortals`, `interiorPortals`, `hardwareSections`.
- `evaluateSelectionGate`, `showcase-type-capacity.ts`.
- Промты 351–362 (уже в main).

---

## Резюме объёма работ

| Промт | Объём | Затрагивает |
|-------|-------|-------------|
| 364 (права + автор) | S | ~5 файлов |
| 365 (каталог-панель) | M | 1 ключевой + 3 связанных |
| 366 (матрица-секция + entry count) | M | 2 ключевых |
| 367 (аналитика) | L | 5–7 файлов |
| 368 (чистка categoryRules) | S | 2 файла + тесты |
| 369 (seed) | M | миграция + сидинг |
| 370 (убрать fallback) | XS | резолвер |

**Итого:** ~7 итераций. Рекомендуется выкатывать по одной с проверкой на проде после каждой.

---

## Что дальше

1. Согласовать этот документ с RemCard / продуктом.
2. При принятии — **Промт 364** (права + отображение автора в каталоге матриц).
3. Правки к плану — комментарии в PR к этому файлу или обновление документа.

---

## Приложение: команда для повторного аудита

```bash
cd apps/platform
grep -rn "SHOWCASE_MATRIX_MODEL_DEFINITIONS\|getRequiredShowcaseMatrixDefinitions\|categoryRules\|getShowcaseMatrixModelsForTradePoint" \
  --include="*.ts" --include="*.tsx" . | grep -v __tests__ | sort
```

```bash
# Единственное место без scope (на момент аудита):
grep -n "getRequiredShowcaseMatrixDefinitions(matrixClientCategory)" client/src/components/trade-point-showcase-catalog-panel.tsx
```
