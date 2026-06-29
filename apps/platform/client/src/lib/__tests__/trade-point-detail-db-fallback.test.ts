/**
 * Запуск: npx tsx client/src/lib/__tests__/trade-point-detail-db-fallback.test.ts
 */
import assert from "node:assert/strict";
import type { UnifiedActiveTradePointDetail } from "@shared/trade-point-primary";
import { primaryTradePointMaterializationId } from "@shared/primary-trade-point-materialization";
import type { DealerRow } from "../dealer-base-mock-data.js";
import { setDealerBaseRowsCache } from "../dealer-base-source.js";
import { createEmptyActualizationState } from "../client-base-actualization-state.js";
import {
  mergeTradePointsForActualization,
  resolveActualizationTradePointDetail,
  resolveActualizationTradePointDetailFromDbOverlay,
} from "../client-base-actualization-data-merge.js";
import type { ReleaseDemoProfile } from "../release-demo-profile.js";
import {
  findUnifiedTradePointInDbRows,
  reconcileUnifiedTradePointsIntoActualizationState,
} from "../trade-points-actualization-hydration.js";

const dealerId = "client-ma-ma085529";

const dealerRow: DealerRow = {
  id: dealerId,
  releaseCode: "TND-CL-000001",
  name: "Тестовый клиент",
  city: "Луганск",
  region: "ЛНР",
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

const tpId = primaryTradePointMaterializationId(dealerId);

const dbOverrideRow: UnifiedActiveTradePointDetail = {
  tpId,
  dealerId,
  name: "Основная торговая точка",
  city: "Луганск",
  address: "Адрес не указан",
  contactName: null,
  contactPhone: null,
  comment: null,
  showcaseStatus: null,
  format: "Розница / салон",
  isPrimary: false,
  isOverrideOnly: true,
  hasOverrideRow: true,
  updatedAt: "2026-06-16T10:00:00.000Z",
  updatedBy: "u-db",
};

const realTpId = "tp-real-001";
const dealerWithRealTp: DealerRow = {
  ...dealerRow,
  id: "client-ma-real-tp",
  tradePoints: [
    {
      id: realTpId,
      name: "Реальная точка",
      city: "Краснодар",
      address: "ул. Реальная 1",
      format: "Розница / салон",
      status: "Активна",
      equipment: "—",
      hardwareStockStatus: "—",
      doorsStockStatus: "—",
      distribution: { mk: 0, vh: 0, total: 0 },
      showcaseStatus: "—",
      showcaseNeeds: "",
      lastVisitDate: "—",
      nextVisitDate: "—",
      responsibleRegionalManager: "—",
      issues: "",
      tasks: [],
      activityHistory: [],
      photos: { attached: false },
      productTrainingStatus: "not_required",
      productTrainingCompleted: false,
    },
  ],
  outlets: 1,
};

setDealerBaseRowsCache([dealerRow, dealerWithRealTp]);

const dbRealRow: UnifiedActiveTradePointDetail = {
  tpId: realTpId,
  dealerId: dealerWithRealTp.id,
  name: "Реальная точка",
  city: "Краснодар",
  address: "ул. Реальная 1",
  contactName: "ЛПР",
  contactPhone: "+7 900 000-00-00",
  comment: null,
  showcaseStatus: null,
  format: "Розница / салон",
  isPrimary: true,
  isOverrideOnly: false,
  hasOverrideRow: false,
  updatedAt: "2026-06-16T10:00:00.000Z",
  updatedBy: "u-db",
};

const profile = { personaUserId: "u1", personaUserName: "Тест" } as ReleaseDemoProfile;
const emptyAct = createEmptyActualizationState();

assert.equal(
  resolveActualizationTradePointDetail(dealerId, tpId, emptyAct, profile),
  undefined,
  "пустой blob — blob-резолв не находит override-only",
);

const dbOverlayResolved = resolveActualizationTradePointDetailFromDbOverlay(
  dealerId,
  tpId,
  emptyAct,
  profile,
  [dbOverrideRow],
);
assert.ok(dbOverlayResolved, "DB-overlay резолв находит override-only при пустом blob");
assert.equal(dbOverlayResolved!.point.id, tpId);
assert.equal(dbOverlayResolved!.point.name, "Основная торговая точка");
assert.equal(dbOverlayResolved!.point.city, "Луганск");

assert.ok(findUnifiedTradePointInDbRows([dbOverrideRow], dealerId, tpId));

const { next, changed } = reconcileUnifiedTradePointsIntoActualizationState(emptyAct, [dbOverrideRow], dealerId, profile);
assert.equal(changed, true);

const resolved = resolveActualizationTradePointDetail(dealerId, tpId, next, profile);
assert.ok(resolved, "после DB-реконсиляции blob-резолв находит точку");
assert.equal(resolved!.point.name, "Основная торговая точка");
assert.equal(resolved!.point.city, "Луганск");

const merged = mergeTradePointsForActualization(resolved!.dealer, next).filter((e) => !e.isArchived);
assert.equal(merged.length, 1);

const realResolved = resolveActualizationTradePointDetailFromDbOverlay(
  dealerWithRealTp.id,
  realTpId,
  emptyAct,
  profile,
  [dbRealRow],
);
assert.ok(realResolved, "DB-overlay резолв находит реальную trade_points");
assert.equal(realResolved!.point.name, "Реальная точка");
assert.equal(realResolved!.point.city, "Краснодар");

console.log("trade-point-detail-db-fallback: ok");
