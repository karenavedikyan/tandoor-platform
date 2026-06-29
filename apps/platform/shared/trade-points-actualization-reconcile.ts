/**
 * Реконсиляция активных ТТ из единого DB-источника в actualization-blob.
 * Идемпотентно: не перетирает локальные правки с более свежим updatedAt.
 */

import type { UnifiedActiveTradePointDetail } from "./trade-point-primary.js";

export type ActualizationTradePointReconcileSlice = {
  manuallyCreatedTradePointsById: Record<string, ManualTradePointLike>;
  tradePointOverridesById: Record<string, TradePointOverrideLike>;
  trashedTradePointsById?: Record<string, unknown>;
};

export type ManualTradePointLike = {
  id: string;
  dealerId: string;
  internalCode?: string;
  fields: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  source: "manual_actualization" | "client_soft_archive";
};

export type TradePointOverrideLike = {
  tradePointId: string;
  dealerId: string;
  fields: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  source: "manual_actualization" | "client_soft_archive";
};

export type TradePointReconcileActor = {
  userId: string;
  userName: string;
};

export type TradePointReconcileResult = {
  manuallyCreatedTradePointsById: Record<string, ManualTradePointLike>;
  tradePointOverridesById: Record<string, TradePointOverrideLike>;
  changed: boolean;
};

function parseTs(v: string | null | undefined): number {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function dbIsNewerThanLocal(dbUpdatedAt: string | null, localUpdatedAt: string | undefined): boolean {
  const dbTs = parseTs(dbUpdatedAt);
  const localTs = parseTs(localUpdatedAt);
  if (dbTs === 0) return localTs === 0;
  if (localTs === 0) return true;
  return dbTs > localTs;
}

function fieldsFromDbRow(row: UnifiedActiveTradePointDetail): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    name: row.name?.trim() || "Торговая точка",
    city: row.city?.trim() || "—",
    address: row.address?.trim() || "—",
    format: row.format?.trim() || "Розница / салон",
    contactName: row.contactName?.trim() || "",
    contactPhone: row.contactPhone?.trim() || "",
    comment: row.comment?.trim() || "",
  };
  if (row.showcaseStatus?.trim()) {
    fields.showcaseStatus = row.showcaseStatus.trim();
  }
  return fields;
}

function overrideFieldsFromDbRow(row: UnifiedActiveTradePointDetail): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (row.name != null) fields.name = row.name;
  if (row.city != null) fields.city = row.city;
  if (row.address != null) fields.address = row.address;
  if (row.format != null) fields.format = row.format;
  if (row.contactName != null) fields.contactName = row.contactName;
  if (row.contactPhone != null) fields.contactPhone = row.contactPhone;
  if (row.comment != null) fields.comment = row.comment;
  if (row.showcaseStatus != null) fields.showcaseStatus = row.showcaseStatus;
  return fields;
}

/**
 * Сливает активные ТТ из БД в срез actualization-state для одного дилера.
 * Не трогает записи в trashedTradePointsById.
 */
export function reconcileDbTradePointsIntoActualizationSlice(
  state: ActualizationTradePointReconcileSlice,
  dbRows: UnifiedActiveTradePointDetail[],
  dealerId: string,
  actor: TradePointReconcileActor,
  now: string,
): TradePointReconcileResult {
  const manualById = { ...state.manuallyCreatedTradePointsById };
  const overridesById = { ...state.tradePointOverridesById };
  let changed = false;

  for (const row of dbRows) {
    if (row.dealerId !== dealerId) continue;
    if (state.trashedTradePointsById?.[row.tpId]) continue;

    if (row.isOverrideOnly) {
      const existing = manualById[row.tpId];
      if (existing) {
        if (!dbIsNewerThanLocal(row.updatedAt, existing.updatedAt)) continue;
        manualById[row.tpId] = {
          ...existing,
          fields: { ...existing.fields, ...fieldsFromDbRow(row) },
          updatedAt: row.updatedAt ?? now,
          updatedBy: row.updatedBy ?? actor.userId,
          updatedByName: actor.userName,
        };
        changed = true;
        continue;
      }

      manualById[row.tpId] = {
        id: row.tpId,
        dealerId,
        fields: fieldsFromDbRow(row),
        createdAt: row.updatedAt ?? now,
        createdBy: row.updatedBy ?? actor.userId,
        createdByName: actor.userName,
        updatedAt: row.updatedAt ?? now,
        updatedBy: row.updatedBy ?? actor.userId,
        updatedByName: actor.userName,
        source: "manual_actualization",
      };
      changed = true;
      continue;
    }

    if (!row.hasOverrideRow) continue;

    const existingOv = overridesById[row.tpId];
    if (existingOv) {
      if (!dbIsNewerThanLocal(row.updatedAt, existingOv.updatedAt)) continue;
      overridesById[row.tpId] = {
        ...existingOv,
        fields: { ...existingOv.fields, ...overrideFieldsFromDbRow(row) },
        updatedAt: row.updatedAt ?? now,
        updatedBy: row.updatedBy ?? actor.userId,
        updatedByName: actor.userName,
      };
      changed = true;
      continue;
    }

    overridesById[row.tpId] = {
      tradePointId: row.tpId,
      dealerId,
      fields: overrideFieldsFromDbRow(row),
      updatedAt: row.updatedAt ?? now,
      updatedBy: row.updatedBy ?? actor.userId,
      updatedByName: actor.userName,
      source: "manual_actualization",
    };
    changed = true;
  }

  return { manuallyCreatedTradePointsById: manualById, tradePointOverridesById: overridesById, changed };
}
