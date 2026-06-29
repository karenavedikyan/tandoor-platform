/**
 * Запуск: npx tsx client/src/lib/__tests__/trade-points-db-display-merge.test.ts
 */
import assert from "node:assert/strict";
import type { UnifiedActiveTradePointDetail } from "@shared/trade-point-primary";
import { primaryTradePointMaterializationId } from "@shared/primary-trade-point-materialization";
import type { DealerRow } from "../dealer-base-mock-data.js";
import { createEmptyActualizationState } from "../client-base-actualization-state.js";
import { mergeTradePointsActiveFromDbWithActualizationOverlay } from "../client-base-actualization-data-merge.js";
import { isTradePointTrashedInRuntime } from "../dealer-overrides-runtime.js";

const dealerId = "client-ma-ma120571";
const tpId = primaryTradePointMaterializationId(dealerId);

const dealer: DealerRow = {
  id: dealerId,
  releaseCode: "MA-MA120571",
  name: "Балюк Оксана Вячеславовна ИП",
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
  updatedAt: "2026-06-15T10:00:00.000Z",
  updatedBy: "u-db",
};

const emptyAct = createEmptyActualizationState();

const fromDbOnly = mergeTradePointsActiveFromDbWithActualizationOverlay(dealer, emptyAct, [dbRow]);
assert.equal(fromDbOnly.length, 1, "пустой blob + DB override-only — ровно 1 точка");
assert.equal(fromDbOnly[0]?.point.id, tpId);
assert.equal(fromDbOnly[0]?.point.name, "Основная торговая точка");
assert.equal(fromDbOnly[0]?.point.city, "Луганск");

const actWithNewerLocal = {
  ...emptyAct,
  manuallyCreatedTradePointsById: {
    [tpId]: {
      id: tpId,
      dealerId,
      fields: {
        name: "Локальное имя",
        city: "Краснодар",
        address: "ул. Локальная 1",
        format: "Розница / салон",
      },
      createdAt: "2026-06-10T10:00:00.000Z",
      createdBy: "u-local",
      createdByName: "Локальный",
      updatedAt: "2026-06-16T13:00:00.000Z",
      updatedBy: "u-local",
      updatedByName: "Локальный",
      source: "manual_actualization" as const,
    },
  },
};
const withLocalOverlay = mergeTradePointsActiveFromDbWithActualizationOverlay(dealer, actWithNewerLocal, [dbRow]);
assert.equal(withLocalOverlay.length, 1);
assert.equal(withLocalOverlay[0]?.point.name, "Локальное имя", "более свежий blob перекрывает DB");
assert.equal(withLocalOverlay[0]?.point.city, "Краснодар");

const localOnlyId = "manual-tp-local-only-001";
const actWithLocalOnly = {
  ...emptyAct,
  manuallyCreatedTradePointsById: {
    [localOnlyId]: {
      id: localOnlyId,
      dealerId,
      fields: {
        name: "Новая локальная",
        city: "Ростов",
        address: "—",
        format: "Розница / салон",
      },
      createdAt: "2026-06-16T12:00:00.000Z",
      createdBy: "u1",
      createdByName: "Тест",
      source: "manual_actualization" as const,
    },
  },
};
const withLocalOnly = mergeTradePointsActiveFromDbWithActualizationOverlay(dealer, actWithLocalOnly, [dbRow]);
assert.equal(withLocalOnly.length, 2, "локальная точка без строки в БД добавляется к DB-набору");
assert.ok(withLocalOnly.some((e) => e.point.id === localOnlyId));

const actTrashed = {
  ...emptyAct,
  trashedTradePointsById: {
    [tpId]: {
      tradePointId: tpId,
      dealerId,
      trashedAt: "2026-06-16T12:00:00.000Z",
      trashedBy: "u1",
      trashedByName: "Тест",
    },
  },
};
assert.equal(isTradePointTrashedInRuntime(tpId, actTrashed), true);
const trashedExcluded = mergeTradePointsActiveFromDbWithActualizationOverlay(dealer, actTrashed, [dbRow]);
assert.equal(trashedExcluded.length, 0, "runtime-trashed исключается из списка");

console.log("trade-points-db-display-merge: ok");
