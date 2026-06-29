/**
 * Запуск: npx tsx client/src/lib/__tests__/primary-trade-point-materialization-client.test.ts
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data.js";
import { createEmptyActualizationState } from "../client-base-actualization-state.js";
import {
  buildManualTradePointRecordForMaterialization,
  countRealActiveTradePoints,
  shouldMaterializePrimaryTradePoint,
} from "../primary-trade-point-materialization.js";
import {
  buildPrimaryTradePointMaterializationFields,
  primaryTradePointMaterializationId,
} from "@shared/primary-trade-point-materialization";
import { mergeTradePointsForActualization } from "../client-base-actualization-data-merge.js";
import type { ReleaseDemoProfile } from "../release-demo-profile.js";

const dealer: DealerRow = {
  id: "client-ma-test",
  releaseCode: "TND-CL-000001",
  name: "Тестовый клиент",
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

const profile = { personaUserId: "u1", personaUserName: "Тест" } as ReleaseDemoProfile;
const act = createEmptyActualizationState();

assert.equal(countRealActiveTradePoints(dealer, act), 0);
assert.equal(shouldMaterializePrimaryTradePoint(dealer, act), true);
assert.equal(mergeTradePointsForActualization(dealer, act).filter((e) => !e.isArchived).length, 0);

const fields = buildPrimaryTradePointMaterializationFields(dealer);
const rec = buildManualTradePointRecordForMaterialization({
  dealerId: dealer.id,
  fields,
  act,
  profile,
  now: "2026-01-01T00:00:00.000Z",
});
const tpId = primaryTradePointMaterializationId(dealer.id);
assert.equal(rec.id, tpId);

const actWithTp = {
  ...act,
  manuallyCreatedTradePointsById: { [tpId]: rec },
};
assert.equal(countRealActiveTradePoints(dealer, actWithTp), 1);
assert.equal(shouldMaterializePrimaryTradePoint(dealer, actWithTp), false);

const rec2 = buildManualTradePointRecordForMaterialization({
  dealerId: dealer.id,
  fields,
  act: actWithTp,
  profile,
  now: "2026-01-02T00:00:00.000Z",
});
assert.equal(rec2.id, tpId);
assert.equal(rec2.internalCode, rec.internalCode);
assert.equal(rec2.createdAt, rec.createdAt);

console.log("primary-trade-point-materialization-client: ok");
