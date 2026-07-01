/**
 * Пересечение клиентов/ТТ штаба менеджера с зоной наблюдающего РОП.
 * Нормализация ключей — как normalizeAssignmentLookupCode / dealerIdToClientCode (#974).
 */

import { dealerIdToClientCode } from "./responsibility-resolver.js";

export function buildNormalizedDealerScopeSet(externalKeys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of Array.from(externalKeys)) {
    const t = raw.trim();
    if (!t) continue;
    out.add(dealerIdToClientCode(t));
  }
  return out;
}

export function clientIdMatchesNormalizedScope(clientId: string, scopeNorm: Set<string>): boolean {
  const t = clientId.trim();
  if (!t || scopeNorm.size === 0) return false;
  return scopeNorm.has(dealerIdToClientCode(t));
}

/** Только наблюдающий РОП (не сам менеджер) — пересечение с его зоной. */
export function shouldIntersectManagerDetailWithRopViewerScope(
  viewerRole: string,
  viewerId: string,
  managerUserId: string,
): boolean {
  return viewerRole === "rop" && viewerId !== managerUserId;
}

export function filterManagerDetailByRopViewerScope<
  C extends { id: string },
  T extends { clientId: string },
>(input: {
  clientsById: Map<string, C>;
  tradePoints: T[];
  viewerScopeExternalKeys: string[];
}): { clientsById: Map<string, C>; tradePoints: T[] } {
  const scopeNorm = buildNormalizedDealerScopeSet(input.viewerScopeExternalKeys);
  if (scopeNorm.size === 0) {
    return { clientsById: new Map(), tradePoints: [] };
  }

  const clientsById = new Map<string, C>();
  for (const [id, client] of Array.from(input.clientsById.entries())) {
    if (clientIdMatchesNormalizedScope(id, scopeNorm)) clientsById.set(id, client);
  }

  const tradePoints = input.tradePoints.filter((tp) => clientIdMatchesNormalizedScope(tp.clientId, scopeNorm));
  return { clientsById, tradePoints };
}
