/**
 * Кеш контактов из Postgres + синхронизация с UI.
 */

import {
  CLIENT_CONTACTS_EVENT,
  type ClientContactsState,
  loadClientContactsState,
} from "./client-contacts.js";
import {
  bundleListPayloadToState,
  fetchClientContactsList,
} from "./client-contacts-api.js";

const dbCacheByDealerId: Record<string, ClientContactsState> = {};

export function getDbContactsStateForDealer(dealerId: string): ClientContactsState | null {
  return dbCacheByDealerId[dealerId] ?? null;
}

export function setDbContactsStateForDealer(dealerId: string, state: ClientContactsState | null): void {
  if (state) dbCacheByDealerId[dealerId] = state;
  else delete dbCacheByDealerId[dealerId];
}

export function notifyClientContactsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLIENT_CONTACTS_EVENT));
  }
}

export async function refreshDbContactsForDealer(dealerId: string): Promise<boolean> {
  const payload = await fetchClientContactsList(dealerId);
  if (!payload) return false;
  setDbContactsStateForDealer(dealerId, bundleListPayloadToState(dealerId, payload));
  notifyClientContactsChanged();
  return true;
}

/** Чтение: БД-кеш → иначе localStorage (fallback). */
export function resolveContactsStateForDealer(dealerId: string, state?: ClientContactsState): ClientContactsState {
  if (state) return state;
  const db = getDbContactsStateForDealer(dealerId);
  if (db) return db;
  return loadClientContactsState();
}
