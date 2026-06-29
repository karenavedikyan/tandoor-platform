/**
 * Клиентская оркестрация материализации основной торговой точки.
 */

import type { DealerRow } from "./dealer-base-mock-data.js";
import type { ActualizationState } from "./client-base-actualization-state.js";
import { mergeActualizationState } from "./client-base-actualization-state.js";
import { mergeTradePointsForActualization } from "./client-base-actualization-data-merge.js";
import { isManualActualizationDealerId, nextManualTradePointInternalCode } from "./client-base-actualization-stable-ids.js";
import { isVirtualDefaultTradePointId } from "./dealer-trade-points-overrides.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import { userLabelFromProfile } from "./showcase-distribution-data.js";
import { mapActualizationTpFieldsToOverrides, saveTradePointFields } from "./use-dealer-field-saver.js";
import {
  buildPrimaryTradePointMaterializationFields,
  primaryTradePointMaterializationId,
  type PrimaryTradePointMaterializationFields,
} from "@shared/primary-trade-point-materialization";
import type { ManualTradePoint } from "./client-base-actualization-state.js";
import { fetchUnifiedActiveTradePointsForDealer, unifiedDbTradePointIds } from "./trade-points-actualization-hydration.js";

export const PRIMARY_TRADE_POINT_MATERIALIZED_EVENT = "primary-trade-point-materialized";

export function countRealActiveTradePoints(row: DealerRow, act: ActualizationState): number {
  return mergeTradePointsForActualization(row, act).filter(
    (e) => !e.isArchived && !isVirtualDefaultTradePointId(row.id, e.point.id),
  ).length;
}

export function shouldMaterializePrimaryTradePoint(
  row: DealerRow,
  act: ActualizationState,
  opts?: { dbActiveCount?: number },
): boolean {
  if (opts?.dbActiveCount != null && opts.dbActiveCount > 0) return false;
  if (isManualActualizationDealerId(row.id)) return false;
  const tpId = primaryTradePointMaterializationId(row.id);
  if (act.manuallyCreatedTradePointsById[tpId]) return false;
  return countRealActiveTradePoints(row, act) === 0;
}

/** Есть ли активные ТТ у дилера в едином DB-источнике. */
export async function resolveDbActiveTradePointIdsForDealer(
  dealerId: string,
  prefetchedIds?: string[],
): Promise<string[]> {
  if (prefetchedIds !== undefined) return prefetchedIds;
  const rows = await fetchUnifiedActiveTradePointsForDealer(dealerId);
  return unifiedDbTradePointIds(rows);
}

export function buildManualTradePointRecordForMaterialization(args: {
  dealerId: string;
  fields: PrimaryTradePointMaterializationFields;
  act: ActualizationState;
  profile: ReleaseDemoProfile;
  now?: string;
}): ManualTradePoint {
  const { dealerId, fields, act, profile, now = new Date().toISOString() } = args;
  const id = primaryTradePointMaterializationId(dealerId);
  const existing = act.manuallyCreatedTradePointsById[id];
  return {
    id,
    dealerId,
    internalCode: existing?.internalCode ?? nextManualTradePointInternalCode(act),
    fields: {
      name: fields.name,
      city: fields.city,
      address: fields.address,
      format: fields.format,
      contactName: fields.contactName,
      contactPhone: fields.contactPhone,
      email: fields.email,
      comment: fields.comment,
    },
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? profile.personaUserId,
    createdByName: existing?.createdByName ?? userLabelFromProfile(profile),
    updatedAt: now,
    updatedBy: profile.personaUserId,
    updatedByName: userLabelFromProfile(profile),
    source: "manual_actualization",
  };
}

export async function materializePrimaryTradePointIfNeeded(args: {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  persist: (mutate: (prev: ActualizationState) => ActualizationState) => Promise<{ success: boolean }>;
  dbActiveTradePointIds?: string[];
}): Promise<{ created: boolean; tradePointId: string; skipped: boolean }> {
  const { row, profile, persist, dbActiveTradePointIds } = args;
  const tpId = primaryTradePointMaterializationId(row.id);

  const dbIds = await resolveDbActiveTradePointIdsForDealer(row.id, dbActiveTradePointIds);
  if (dbIds.length > 0 || dbIds.includes(tpId)) {
    return { created: false, tradePointId: tpId, skipped: true };
  }

  let outcome: "created" | "skipped" | "failed" = "failed";
  let materializedFields: PrimaryTradePointMaterializationFields | null = null;

  const r = await persist((prev) => {
    if (!shouldMaterializePrimaryTradePoint(row, prev)) {
      outcome = "skipped";
      return prev;
    }
    if (prev.manuallyCreatedTradePointsById[tpId]) {
      outcome = "skipped";
      return prev;
    }

    const fields = buildPrimaryTradePointMaterializationFields(row);
    const rec = buildManualTradePointRecordForMaterialization({
      dealerId: row.id,
      fields,
      act: prev,
      profile,
    });
    materializedFields = fields;
    outcome = "created";
    return mergeActualizationState(prev, {
      manuallyCreatedTradePointsById: {
        ...prev.manuallyCreatedTradePointsById,
        [tpId]: rec,
      },
    });
  });

  if (!r.success || outcome === "failed") {
    return { created: false, tradePointId: tpId, skipped: false };
  }
  if (outcome === "skipped") {
    return { created: false, tradePointId: tpId, skipped: true };
  }

  const fields = materializedFields!;
  try {
    const tpFields = mapActualizationTpFieldsToOverrides({
      name: fields.name,
      city: fields.city,
      address: fields.address,
      contactName: fields.contactName,
      contactPhone: fields.contactPhone,
      comment: fields.comment,
    });
    await saveTradePointFields(tpId, tpFields, row.id, {
      fieldLabel: "Основная торговая точка",
      source: "primary-trade-point-materialization",
    });
  } catch {
    /* очередь tp-upsert подхватит воркер */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PRIMARY_TRADE_POINT_MATERIALIZED_EVENT, {
        detail: { dealerId: row.id, tradePointId: tpId },
      }),
    );
  }

  return { created: true, tradePointId: tpId, skipped: false };
}
