/**
 * Запуск: npx tsx shared/__tests__/trade-points-actualization-reconcile.test.ts
 */
import assert from "node:assert/strict";
import type { UnifiedActiveTradePointDetail } from "../trade-point-primary.js";
import { reconcileDbTradePointsIntoActualizationSlice } from "../trade-points-actualization-reconcile.js";
import { mergeTradePointsForActualization } from "../../client/src/lib/client-base-actualization-data-merge.js";
import { createEmptyActualizationState } from "../../client/src/lib/client-base-actualization-state.js";
import type { DealerRow } from "../../client/src/lib/dealer-base-mock-data.js";

const dealerId = "client-ma-ma120571";
const tpId = `manual-tp-primary-${dealerId}`;
const actor = { userId: "u-hydrate", userName: "Гидратор" };
const now = "2026-06-16T12:00:00.000Z";

const dbPrimaryRow: UnifiedActiveTradePointDetail = {
  tpId,
  dealerId,
  name: "Основная торговая точка",
  city: "Краснодар",
  address: "ул. Тестовая 1",
  contactName: "ЛПР",
  contactPhone: "+7 900 111-22-33",
  comment: "",
  showcaseStatus: null,
  format: "Розница / салон",
  isPrimary: true,
  isOverrideOnly: true,
  hasOverrideRow: true,
  updatedAt: "2026-06-15T10:00:00.000Z",
  updatedBy: "u-creator",
};

const emptySlice = {
  manuallyCreatedTradePointsById: {},
  tradePointOverridesById: {},
  trashedTradePointsById: {},
};

const first = reconcileDbTradePointsIntoActualizationSlice(emptySlice, [dbPrimaryRow], dealerId, actor, now);
assert.equal(first.changed, true);
assert.ok(first.manuallyCreatedTradePointsById[tpId]);
assert.equal(first.manuallyCreatedTradePointsById[tpId]?.dealerId, dealerId);
assert.equal(first.manuallyCreatedTradePointsById[tpId]?.fields.name, "Основная торговая точка");
assert.equal(first.manuallyCreatedTradePointsById[tpId]?.fields.city, "Краснодар");

const second = reconcileDbTradePointsIntoActualizationSlice(
  {
    manuallyCreatedTradePointsById: first.manuallyCreatedTradePointsById,
    tradePointOverridesById: first.tradePointOverridesById,
  },
  [dbPrimaryRow],
  dealerId,
  actor,
  now,
);
assert.equal(second.changed, false, "повторная гидрация не создаёт дублей");
assert.equal(Object.keys(second.manuallyCreatedTradePointsById).length, 1);

const dealer: DealerRow = {
  id: dealerId,
  releaseCode: "MA-MA120571",
  name: "Балюк Оксана Вячеславовна ИП",
  city: "Краснодар",
  region: "Краснодарский край",
  clientCategory: "new_client",
  importanceTier: "standard",
  status: "активный",
  format: "одиночный",
  outlets: 0,
  manager: "Менеджер",
  regionalManager: "РМ",
  ropName: "РОП",
  lastActivity: "—",
  nextAction: "—",
  distribution: 0,
  showcaseStatus: "—",
  hasProblem: false,
  comment: "",
  hasRecentActivity: false,
  legalEntity: "—",
  holding: "—",
  tradePoints: [],
  responsibles: { director: "—", salesManager: "—", regionalManager: "—", assistant: "—" },
  contacts: { lpr: "ЛПР", buyer: "—", phone: "+7 900 111-22-33", email: "—", channel: "—" },
  terms: { tandoorClub: "—", special: "—", payment: "—", edo: "—", limit: "—", bonuses: "—" },
  salesKpis: { quarterRub: "—", mkUnits: "—", vhUnits: "—", furnitureRub: "—" },
  distributionDetail: { mk: 0, vh: 0, total: 0, checkDate: "—" },
  showcase: { equipment: "—", todo: "—", status: "—", goalLink: "—" },
  competitors: { list: "—", strengths: "—", mgrComment: "—", rmComment: "—" },
  issues: { summary: "—", who: "—", date: "—", next: "—", state: "—" },
  productTrainingCompleted: false,
  productTrainingStatus: "not_required",
  indigoTrainingCandidate: false,
  indigoTrainingStatus: "not_required",
  releaseAddress: "ул. Тестовая 1",
};

const actAfterHydrate = {
  ...createEmptyActualizationState(),
  manuallyCreatedTradePointsById: first.manuallyCreatedTradePointsById,
};
const merged = mergeTradePointsForActualization(dealer, actAfterHydrate).filter((e) => !e.isArchived);
assert.equal(merged.length, 1, "после гидрации merge возвращает 1 неархивную точку");
assert.equal(merged[0]?.point.name, "Основная торговая точка");
assert.equal(merged[0]?.point.city, "Краснодар");

const localNewer = reconcileDbTradePointsIntoActualizationSlice(
  {
    manuallyCreatedTradePointsById: {
      [tpId]: {
        ...first.manuallyCreatedTradePointsById[tpId]!,
        fields: { ...first.manuallyCreatedTradePointsById[tpId]!.fields, name: "Локальное имя" },
        updatedAt: "2026-06-16T13:00:00.000Z",
      },
    },
    tradePointOverridesById: {},
  },
  [dbPrimaryRow],
  dealerId,
  actor,
  now,
);
assert.equal(localNewer.changed, false, "локальная правка новее БД — не перетираем");
assert.equal(localNewer.manuallyCreatedTradePointsById[tpId]?.fields.name, "Локальное имя");

console.log("trade-points-actualization-reconcile: ok");
