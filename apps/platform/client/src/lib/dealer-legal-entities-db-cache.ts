/**
 * Кеш юрлиц дилера из Postgres + синхронизация с UI.
 */

import {
  DEALER_LEGAL_ENTITIES_EVENT,
  type DealerLegalEntity,
  type DealerLegalEntitiesState,
  loadDealerLegalEntitiesState,
} from "@/lib/dealer-legal-entities";
import { bundleListFullToState, fetchListFull } from "@/lib/dealer-legal-entities-api";

const dbCacheByDealerId: Record<string, DealerLegalEntitiesState> = {};

export function getDbLegalEntitiesStateForDealer(dealerId: string): DealerLegalEntitiesState | null {
  return dbCacheByDealerId[dealerId] ?? null;
}

export function setDbLegalEntitiesStateForDealer(dealerId: string, state: DealerLegalEntitiesState | null): void {
  if (state) dbCacheByDealerId[dealerId] = state;
  else delete dbCacheByDealerId[dealerId];
}

export function notifyDealerLegalEntitiesChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEALER_LEGAL_ENTITIES_EVENT));
  }
}

export async function refreshDbLegalEntitiesForDealer(dealerId: string): Promise<boolean> {
  const payload = await fetchListFull(dealerId);
  if (!payload) return false;
  setDbLegalEntitiesStateForDealer(dealerId, bundleListFullToState(dealerId, payload));
  notifyDealerLegalEntitiesChanged();
  return true;
}

/** Чтение: БД-кеш → иначе localStorage (fallback). */
export function resolveLegalEntitiesStateForDealer(
  dealerId: string,
  state?: DealerLegalEntitiesState,
): DealerLegalEntitiesState {
  if (state) return state;
  const db = getDbLegalEntitiesStateForDealer(dealerId);
  if (db) return db;
  return loadDealerLegalEntitiesState();
}

export function replaceLegalEntityIdInCache(dealerId: string, oldId: string, newId: string): void {
  const st = getDbLegalEntitiesStateForDealer(dealerId);
  if (!st) return;
  const list = st.entitiesByDealer[dealerId] ?? [];
  const idx = list.findIndex((e) => e.id === oldId);
  if (idx < 0) return;
  const nextList = [...list];
  nextList[idx] = { ...nextList[idx]!, id: newId };
  setDbLegalEntitiesStateForDealer(dealerId, {
    ...st,
    entitiesByDealer: { ...st.entitiesByDealer, [dealerId]: nextList },
  });
  notifyDealerLegalEntitiesChanged();
}

export function upsertOptimisticLegalEntity(dealerId: string, entity: DealerLegalEntity): void {
  const base = getDbLegalEntitiesStateForDealer(dealerId) ?? resolveLegalEntitiesStateForDealer(dealerId);
  const list = base.entitiesByDealer[dealerId] ?? [];
  setDbLegalEntitiesStateForDealer(dealerId, {
    ...base,
    entitiesByDealer: { ...base.entitiesByDealer, [dealerId]: [entity, ...list.filter((e) => e.id !== entity.id)] },
  });
  notifyDealerLegalEntitiesChanged();
}
