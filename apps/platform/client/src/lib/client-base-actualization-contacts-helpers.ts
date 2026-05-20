/**
 * Контакты актуализации: выборка, primary, генерация id.
 */

import type { ActualizationState, DealerActualizationContact } from "@/lib/client-base-actualization-state";

export function listActiveActualizationContactsForDealer(
  act: ActualizationState,
  dealerId: string,
): DealerActualizationContact[] {
  const archived = new Set(
    Object.values(act.archivedDealerContactsById)
      .map((a) => a.contactId)
      .filter(Boolean),
  );
  const out: DealerActualizationContact[] = [];
  for (const c of Object.values(act.dealerActualizationContactsById)) {
    if (c.dealerId !== dealerId) continue;
    if (archived.has(c.id)) continue;
    out.push(c);
  }
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return out;
}

export function getPrimaryActualizationContact(
  act: ActualizationState,
  dealerId: string,
): DealerActualizationContact | undefined {
  const list = listActiveActualizationContactsForDealer(act, dealerId);
  return list.find((c) => c.isPrimary) ?? list[0];
}

export function newActualizationContactId(dealerId: string): string {
  return `ac-${dealerId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
