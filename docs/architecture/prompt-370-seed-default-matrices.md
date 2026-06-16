# Промт 370 — Seed 5 базовых глобальных матриц витрины ТТ (выполнен напрямую в БД)

**Дата:** 16.06.2026  
**Тип:** отчёт о ручной seed-операции в продовой Neon. **Код приложения не меняется** — только этот документ.  
**Статус:** выполнено в проде

---

## Контекст

После Промтов 363–369 управляемые матрицы (`showcase_matrix_defs` + `showcase_matrix_def_models`) стали единственным источником правды для состава матрицы ТТ:

- **365:** каталог-панель читает managed
- **366:** единые лейблы Обязательная/Рекомендованная по managed-priority
- **367:** аналитика gaps на резолвере
- **368:** формы занесения на резолвере
- **369:** удалены `categoryRules` и `isModelRecommendedForCategory`

Однако в продовой Neon была всего 1 тестовая запись `v1-test` (draft, 0 моделей). Резолвер для всех ТТ возвращал хардкод-fallback из `getShowcaseMatrixModelsForTradePoint`, плашка «не назначена матрица» висела повсеместно.

---

## Что сделано (агент выполнил напрямую в проде)

В одной транзакции в продовой Neon (`ep-patient-sound-aqsdpcta`):

1. **DELETE** старого draft `v1-test` (id `409f274a-9b2f-4058-b393-92bb450d5b54`, top150, 0 моделей, от 2026-06-03).
2. **INSERT** 5 базовых матриц по категориям клиента:
   - `new_client` (стартовая) — 4 модели (era/baget-12/panteon/grand) все high
   - `top500plus` (базовая) — 5 моделей (+ midas medium)
   - `top500` (базовая) — 5 моделей (= top500plus)
   - `top350` (средняя) — 6 моделей (+ ultra medium)
   - `top150` (расширенная) — 8 моделей (+ baget-13 medium, + m-36 low)
3. **INSERT** 28 строк в `showcase_matrix_def_models` (target_kind='model', segment='vh'|'mk', priority='high'|'medium'|'low', sort_order по MATRIX_MODEL_ORDER).

Все матрицы:

- `scope_kind='global'` (без региона/города)
- `status='published'`
- `effective_from = NULL`, `effective_to = NULL` (без срока)
- `season_label = NULL`
- автор: Karen Avedikyan (`d43940b0-f52f-413e-8de6-7d62d5dcc8b5`)
- title: `seed-370 / <Категория> / <тип> матрица`

---

## Источник истины состава

Скопировано один-в-один из хардкода:

- порядок моделей — `MATRIX_MODEL_ORDER` в `lib/server/showcase-matrix-resolver.ts`
- сегмент (vh/mk) — `MATRIX_META`
- basePriority (high/medium/low) — `MATRIX_META`
- количество по tier — `MATRIX_CATEGORY_TIER` (starter=4, base=5, medium=6, expanded=8)

---

## SQL (полный текст)

```sql
BEGIN;

-- 0. Удалить старый тестовый draft 'v1-test' от 2026-06-03
DELETE FROM showcase_matrix_defs WHERE id = '409f274a-9b2f-4058-b393-92bb450d5b54';

-- 1. new_client (starter, 4 модели — все high)
WITH inserted AS (
  INSERT INTO showcase_matrix_defs (
    client_category, scope_kind, scope_region, scope_city,
    effective_from, effective_to, season_label, status, title, comment,
    updated_by, updated_by_name
  ) VALUES (
    'new_client', 'global', NULL, NULL,
    NULL, NULL, NULL, 'published',
    'seed-370 / Новый клиент / стартовая матрица',
    'Базовая стартовая матрица для новых/потенциальных клиентов. 4 модели (2 ВХ + 2 МК) с высоким приоритетом.',
    'd43940b0-f52f-413e-8de6-7d62d5dcc8b5', 'Karen Avedikyan'
  ) RETURNING id
)
INSERT INTO showcase_matrix_def_models (def_id, target_kind, target_id, priority, segment, sort_order)
SELECT id, 'model', target_id, priority, segment, sort_order FROM inserted, (VALUES
  ('tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya'::TEXT, 'high'::TEXT, 'vh'::TEXT, 0),
  ('tc-mk-baget-12-mokko-pet-dg-2000-800-94', 'high', 'mk', 1),
  ('tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya', 'high', 'vh', 2),
  ('tc-mk-grand-13-medzhik-pet-dg-2000-800', 'high', 'mk', 3)
) AS m(target_id, priority, segment, sort_order);

-- 2. top500plus (base, 5 моделей)
WITH inserted AS (
  INSERT INTO showcase_matrix_defs (
    client_category, scope_kind, scope_region, scope_city,
    effective_from, effective_to, season_label, status, title, comment,
    updated_by, updated_by_name
  ) VALUES (
    'top500plus', 'global', NULL, NULL,
    NULL, NULL, NULL, 'published',
    'seed-370 / ТОП 500+ / базовая матрица',
    'Базовая матрица для категории ТОП 500+. 5 моделей: 4 обязательных + 1 рекомендованная.',
    'd43940b0-f52f-413e-8de6-7d62d5dcc8b5', 'Karen Avedikyan'
  ) RETURNING id
)
INSERT INTO showcase_matrix_def_models (def_id, target_kind, target_id, priority, segment, sort_order)
SELECT id, 'model', target_id, priority, segment, sort_order FROM inserted, (VALUES
  ('tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya'::TEXT, 'high'::TEXT, 'vh'::TEXT, 0),
  ('tc-mk-baget-12-mokko-pet-dg-2000-800-94', 'high', 'mk', 1),
  ('tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya', 'high', 'vh', 2),
  ('tc-mk-grand-13-medzhik-pet-dg-2000-800', 'high', 'mk', 3),
  ('tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya', 'medium', 'vh', 4)
) AS m(target_id, priority, segment, sort_order);

-- 3. top500 (base, 5 моделей — = top500plus)
WITH inserted AS (
  INSERT INTO showcase_matrix_defs (
    client_category, scope_kind, scope_region, scope_city,
    effective_from, effective_to, season_label, status, title, comment,
    updated_by, updated_by_name
  ) VALUES (
    'top500', 'global', NULL, NULL,
    NULL, NULL, NULL, 'published',
    'seed-370 / ТОП 500 / базовая матрица',
    'Базовая матрица для категории ТОП 500. 5 моделей: 4 обязательных + 1 рекомендованная.',
    'd43940b0-f52f-413e-8de6-7d62d5dcc8b5', 'Karen Avedikyan'
  ) RETURNING id
)
INSERT INTO showcase_matrix_def_models (def_id, target_kind, target_id, priority, segment, sort_order)
SELECT id, 'model', target_id, priority, segment, sort_order FROM inserted, (VALUES
  ('tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya'::TEXT, 'high'::TEXT, 'vh'::TEXT, 0),
  ('tc-mk-baget-12-mokko-pet-dg-2000-800-94', 'high', 'mk', 1),
  ('tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya', 'high', 'vh', 2),
  ('tc-mk-grand-13-medzhik-pet-dg-2000-800', 'high', 'mk', 3),
  ('tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya', 'medium', 'vh', 4)
) AS m(target_id, priority, segment, sort_order);

-- 4. top350 (medium, 6 моделей)
WITH inserted AS (
  INSERT INTO showcase_matrix_defs (
    client_category, scope_kind, scope_region, scope_city,
    effective_from, effective_to, season_label, status, title, comment,
    updated_by, updated_by_name
  ) VALUES (
    'top350', 'global', NULL, NULL,
    NULL, NULL, NULL, 'published',
    'seed-370 / ТОП 350 / средняя матрица',
    'Средняя матрица для категории ТОП 350. 6 моделей: 4 обязательных + 2 рекомендованных.',
    'd43940b0-f52f-413e-8de6-7d62d5dcc8b5', 'Karen Avedikyan'
  ) RETURNING id
)
INSERT INTO showcase_matrix_def_models (def_id, target_kind, target_id, priority, segment, sort_order)
SELECT id, 'model', target_id, priority, segment, sort_order FROM inserted, (VALUES
  ('tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya'::TEXT, 'high'::TEXT, 'vh'::TEXT, 0),
  ('tc-mk-baget-12-mokko-pet-dg-2000-800-94', 'high', 'mk', 1),
  ('tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya', 'high', 'vh', 2),
  ('tc-mk-grand-13-medzhik-pet-dg-2000-800', 'high', 'mk', 3),
  ('tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya', 'medium', 'vh', 4),
  ('tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya', 'medium', 'vh', 5)
) AS m(target_id, priority, segment, sort_order);

-- 5. top150 (expanded, 8 моделей — все)
WITH inserted AS (
  INSERT INTO showcase_matrix_defs (
    client_category, scope_kind, scope_region, scope_city,
    effective_from, effective_to, season_label, status, title, comment,
    updated_by, updated_by_name
  ) VALUES (
    'top150', 'global', NULL, NULL,
    NULL, NULL, NULL, 'published',
    'seed-370 / ТОП 150 / расширенная матрица',
    'Расширенная матрица для категории ТОП 150. Все 8 моделей: 4 обязательных + 3 рекомендованных + 1 опциональная.',
    'd43940b0-f52f-413e-8de6-7d62d5dcc8b5', 'Karen Avedikyan'
  ) RETURNING id
)
INSERT INTO showcase_matrix_def_models (def_id, target_kind, target_id, priority, segment, sort_order)
SELECT id, 'model', target_id, priority, segment, sort_order FROM inserted, (VALUES
  ('tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya'::TEXT, 'high'::TEXT, 'vh'::TEXT, 0),
  ('tc-mk-baget-12-mokko-pet-dg-2000-800-94', 'high', 'mk', 1),
  ('tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya', 'high', 'vh', 2),
  ('tc-mk-grand-13-medzhik-pet-dg-2000-800', 'high', 'mk', 3),
  ('tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya', 'medium', 'vh', 4),
  ('tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya', 'medium', 'vh', 5),
  ('tc-mk-baget-13-makiato-pet-dg-2000-800-91', 'medium', 'mk', 6),
  ('tc-mk-m-36-emal-belaya-dg-2000-800', 'low', 'mk', 7)
) AS m(target_id, priority, segment, sort_order);

COMMIT;
```

---

## Результат выполнения в проде

```
=== showcase_matrix_defs (5 строк) ===
  new_client   | global | published | seed-370 / Новый клиент / стартовая матрица
  top150       | global | published | seed-370 / ТОП 150 / расширенная матрица
  top350       | global | published | seed-370 / ТОП 350 / средняя матрица
  top500       | global | published | seed-370 / ТОП 500 / базовая матрица
  top500plus   | global | published | seed-370 / ТОП 500+ / базовая матрица

=== def_models по категориям ===
  new_client   | 4 моделей
  top150       | 8 моделей
  top350       | 6 моделей
  top500       | 5 моделей
  top500plus   | 5 моделей
  ИТОГО: 28 моделей (ожидалось 28)
```

---

## Smoke-инструкция

1. Зайти под админом на прод → карточка любой ТТ → блок «Витрина торговой точки»: должен показывать managed-матрицу (плашка «не назначена матрица» исчезает).
2. `/distribution/matrix-catalog` — каталог-панель показывает 5 матриц.
3. `/distribution/analytics` — gaps считаются по managed-матрице (по 28 строкам).
4. Формы занесения витрины — состав моделей берётся из managed.

---

## Откат

```sql
DELETE FROM showcase_matrix_defs WHERE title LIKE 'seed-370%';
-- CASCADE автоматически удалит showcase_matrix_def_models
```

---

## Что НЕ менял (не ломаем работающее)

- хардкод `getShowcaseMatrixModelsForTradePoint` оставлен как fallback на случай, если для ТТ нет подходящей managed-матрицы (удалим в Промте 371)
- `MATRIX_MODEL_ORDER`, `MATRIX_META`, `MATRIX_CATEGORY_TIER` — **не трогали**
- никаких миграций схемы — только данные

---

## Связанные документы

- [Промт 363 — Аудит: единый источник правды для матрицы ТТ](./prompt-363-showcase-matrix-single-source-of-truth-audit.md)
