/**
 * Загрузка дилеров и ТТ из Postgres (Промт 374).
 */

import { asc, eq } from "drizzle-orm";
import { dealers, tradePoints } from "../../shared/dealers-schema.js";
import type { DbDealerRow, DbTradePointRow } from "../../shared/dealers-trade-points-mapper.js";
import { getAuthDb } from "../auth/db.js";

export type DbDealerBundle = {
  dealer: DbDealerRow & { source: string };
  tradePoints: DbTradePointRow[];
};

function mapDealerRow(row: typeof dealers.$inferSelect): DbDealerRow & { source: string } {
  return {
    external_key: row.externalKey,
    name: row.name,
    release_code: row.releaseCode,
    city: row.city,
    region: row.region,
    client_type: row.clientType,
    client_category: row.clientCategory,
    status: row.status,
    format: row.format,
    is_active: row.isActive,
    is_priority: row.isPriority,
    is_closed: row.isClosed,
    legal_entity: row.legalEntity,
    holding: row.holding,
    comment: row.comment,
    manager_name: row.managerName,
    release_address: row.releaseAddress,
    client_type_label: row.clientTypeLabel,
    release_team_id: row.releaseTeamId,
    release_manager_id: row.releaseManagerId,
    manager_user_id: null,
    regional_manager_id: null,
    dealer_rop_id: null,
    team_rop_user_id: null,
    has_assignment_manager: false,
    has_assignment_regional: false,
    has_assignment_rop: false,
    source: row.source,
  };
}

function mapTradePointRow(
  row: typeof tradePoints.$inferSelect,
  dealerExternalKey: string,
): DbTradePointRow {
  return {
    external_key: row.externalKey,
    dealer_external_key: dealerExternalKey,
    name: row.name,
    city: row.city,
    address: row.address,
    format: row.format,
    is_active: row.isActive,
    is_primary: row.isPrimary === true,
    importance_tier: row.importanceTier,
  };
}

export async function loadAllDealersFromDb(): Promise<DbDealerBundle[]> {
  const db = getAuthDb();
  if (!db) {
    throw new Error("Auth database is not configured.");
  }

  const dealerRows = await db.select().from(dealers).orderBy(asc(dealers.name));
  const tpRows = await db.select().from(tradePoints).orderBy(asc(tradePoints.externalKey));

  const dealerUuidToKey = new Map(dealerRows.map((d) => [d.id, d.externalKey]));
  const tpByDealerKey = new Map<string, DbTradePointRow[]>();

  for (const tp of tpRows) {
    const dealerKey = dealerUuidToKey.get(tp.dealerId);
    if (!dealerKey) continue;
    const list = tpByDealerKey.get(dealerKey) ?? [];
    list.push(mapTradePointRow(tp, dealerKey));
    tpByDealerKey.set(dealerKey, list);
  }

  return dealerRows.map((d) => ({
    dealer: mapDealerRow(d),
    tradePoints: tpByDealerKey.get(d.externalKey) ?? [],
  }));
}

export async function loadDealerByExternalKey(key: string): Promise<DbDealerBundle | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;

  const db = getAuthDb();
  if (!db) {
    throw new Error("Auth database is not configured.");
  }

  const dealerRows = await db.select().from(dealers).where(eq(dealers.externalKey, trimmed)).limit(1);
  const dealer = dealerRows[0];
  if (!dealer) return null;

  const tpRows = await db
    .select()
    .from(tradePoints)
    .where(eq(tradePoints.dealerId, dealer.id))
    .orderBy(asc(tradePoints.externalKey));

  return {
    dealer: mapDealerRow(dealer),
    tradePoints: tpRows.map((tp) => mapTradePointRow(tp, dealer.externalKey)),
  };
}
