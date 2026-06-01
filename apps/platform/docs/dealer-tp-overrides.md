# Оверрайды дилера и торговых точек (Промт 113 / 113.1)

## Источник правды

**Postgres** — таблицы `dealer_overrides`, `trade_point_overrides`, `dealer_training_state`, `trade_point_training_state`, `manual_dealers`, журналы `*_override_events`.

`localStorage` / `sessionStorage` — только **оптимистический кеш** и офлайн-очередь. После гидрации с API серверные значения имеют приоритет.

## Чтение overrides (гидрация и UI)

При старте сессии `OverridesSessionBootstrap` вызывает `hydrateAllOverridesFromServer()` **до** бэкфила. На карточке дилера/ТТ — `useDealerTpOverridesHydration({ dealerId, tpId })` (перестраховка + `visibilitychange`).

Трассировка в `tandoor:overrides:trace-log`: `hydrate_started` / `hydrate_finished` с `count_loaded`.

```ts
import { useDealerOverride, useTradePointOverride } from "@/lib/dealer-overrides-runtime";
import { resolveEffectiveClientCategory } from "@/lib/effective-client-category";

// Категория: DB-оверрайд приоритетнее seed и blob
const category = resolveEffectiveClientCategory(dealerRow, actx.state);

// Произвольное поле из строки dealer_overrides
const override = useDealerOverride(dealerId);
const displayName = override?.name ?? dealerRow.name;

const tp = useTradePointOverride(tpId);
const comment = tp?.comment ?? point.tpComment;
```

`useDealerOverride` / `useTradePointOverride` подписаны на `useSyncExternalStore` и перерисовывают UI после `apply*OverridesRuntime` и событий гидрации.

## Клиентский поток сохранения

1. UI пишет в LS сразу (optimistic).
2. `*Strict` API (`upsertDealerOverrideStrict`, …) → POST `/api/dealer-overrides/*`.
3. При ошибке — запись в `pendingSyncStore` (`tandoor:overrides:pending-v1`), тост, воркер повторяет каждые 15 с. Legacy persona-коды (`mgr-*`) перед отправкой маппятся в UUID; ответ **400 INVALID_UUID_FIELD** помечает запись как `dead` (без ретраев). См. Промт 114.4.
4. Ошибки HTTP логируются в `tandoor:overrides:error-log` (50 последних). Трассировка strict/UI — `tandoor:overrides:trace-log` (200).

## Бэкфил при первом входе

`runOverridesBackfillIfNeeded(userId)` после логина (см. `OverridesSessionBootstrap`):

1. Гидрация с сервера.
2. Сравнение локальных ключей с сервером.
3. Пустой сервер + локальные данные → enqueue в pending.
4. Конфликт → `tandoor:overrides:backfill-conflicts` (сервер не перезаписывается).
5. Флаг `tandoor:overrides:backfill-v1:done`.

## Диагностика

- **Админ:** `/admin/sync-health` — очередь, ошибки API, конфликты бэкфила.
- **Миграции:** `/admin/migrate-dealer-tp` (включая `overrides_write_errors`).
- **Консоль:** `[overrides-api] upsert failed` с `status`, `body`, `dealerId`, `fields`.

## Статус в UI

- `scope="dealer-tp-overrides"` на `ClientBaseActualizationSyncStatus` / `DealerTpOverridesSyncStatus`.
- Зелёный: «Сохранено в облаке»; жёлтый: «Сохраняем…»; красный: «Ошибка сохранения» + «Повторить».

Legacy actualization blob (`scope="actualization-blob"`) — отдельный канал, не относится к полям 113.

## Добавление нового поля

1. Колонка в `server/migrations/2026_05_31_dealer_tp_overrides.sql` (или новая миграция).
2. `DEALER_OVERRIDE_FIELDS` / типы в `shared/dealer-overrides-types.ts`.
3. Маппинг в LS-сторе + `dealer-overrides-sync.ts` hydrate.
4. `upsertDealerOverrideStrict(dealerId, { new_field })` из UI через `handleOverridesStrictResult`.

## CI

`node scripts/check-no-void-overrides-calls.mjs` — запрещает `void upsertDealerOverride(...)` и аналоги в `client/src`.

## Smoke

```bash
DATABASE_URL=... node scripts/smoke-overrides-api.mjs
```
