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

setDealerBaseRowsCache([dealerRow]);
const tpId = primaryTradePointMaterializationId(dealerId);

const dbRow: UnifiedActiveTradePointDetail = {
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

const profile = { personaUserId: "u1", personaUserName: "Тест" } as ReleaseDemoProfile;
const emptyAct = createEmptyActualizationState();

assert.equal(
  resolveActualizationTradePointDetail(dealerId, tpId, emptyAct, profile),
  undefined,
  "пустой blob — точка не резолвится",
);

assert.ok(findUnifiedTradePointInDbRows([dbRow], dealerId, tpId));

const { next, changed } = reconcileUnifiedTradePointsIntoActualizationState(emptyAct, [dbRow], dealerId, profile);
assert.equal(changed, true);

const resolved = resolveActualizationTradePointDetail(dealerId, tpId, next, profile);
assert.ok(resolved, "после DB-реконсиляции точка резолвится");
assert.equal(resolved!.point.name, "Основная торговая точка");
assert.equal(resolved!.point.city, "Луганск");

const merged = mergeTradePointsForActualization(resolved!.dealer, next).filter((e) => !e.isArchived);
assert.equal(merged.length, 1);

console.log("trade-point-detail-db-fallback: ok");
