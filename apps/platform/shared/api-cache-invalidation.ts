/**
 * Инвалидация LRU-кэша при мутациях (Промт 380).
 */

import { invalidate } from "./api-lru-cache.js";

export function invalidateDealerCatalogCaches(): void {
  invalidate("dealers-trade-points:");
  invalidate("bootstrap:");
  invalidate("my-visible-codes:");
}

export function invalidateTradePointOverrideCaches(): void {
  invalidate("dealers-trade-points:");
  invalidate("bootstrap:");
}

export function invalidateAssignmentCaches(): void {
  invalidate("my-codes:");
  invalidate("my-org-snapshot:");
  invalidate("my-visible-codes:");
  invalidate("bootstrap:");
}

export function invalidateResponsibilityCaches(): void {
  invalidate("my-codes:");
  invalidate("my-visible-codes:");
  invalidate("bootstrap:");
}

export function invalidateAuthSessionCaches(userId?: string): void {
  if (userId) {
    invalidate(`auth-me:${userId}:`);
    invalidate(`bootstrap:${userId}:`);
  } else {
    invalidate("auth-me:");
    invalidate("bootstrap:");
  }
}

export function invalidateAllBootstrapCaches(): void {
  invalidate("bootstrap:");
  invalidate("auth-me:");
}

export function invalidateActualizationCaches(userId?: string): void {
  if (userId) {
    invalidate(`actualization-state:${userId}:`);
    invalidate(`bootstrap:${userId}:`);
  } else {
    invalidate("actualization-state:");
    invalidate("bootstrap:");
  }
}
