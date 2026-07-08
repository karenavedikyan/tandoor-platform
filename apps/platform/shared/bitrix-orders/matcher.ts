import type { PrismaClient } from "@prisma/client";
import { materializedStoreManagerUuid } from "../exchange-store-manager.js";

export type OrderContext = {
  storeUuid: string | null;
  legalUuid: string | null;
  managerUuid: string | null;
};

type StoreRow = {
  id_1c: string;
  manager_1c: string | null;
};

const EMPTY_CONTEXT: OrderContext = {
  storeUuid: null,
  legalUuid: null,
  managerUuid: null,
};

export async function resolveOrderContext(
  prisma: PrismaClient,
  clientNumber1c: string | null,
): Promise<OrderContext> {
  if (!clientNumber1c?.trim()) return { ...EMPTY_CONTEXT };

  const legals = await prisma.$queryRaw<{ id_1c: string }[]>`
    SELECT id_1c::text
    FROM exchange_legals_raw
    WHERE ma_number = ${clientNumber1c.trim()}
    ORDER BY imported_at DESC NULLS LAST
    LIMIT 1
  `;
  const legal = legals[0];
  if (!legal) return { ...EMPTY_CONTEXT };

  const stores = await prisma.$queryRaw<StoreRow[]>`
    SELECT id_1c::text, manager_1c::text
    FROM exchange_stores_raw
    WHERE legal_entity_1c = ${legal.id_1c}::uuid
    ORDER BY imported_at DESC NULLS LAST
  `;

  if (stores.length === 1) {
    const store = stores[0]!;
    return {
      storeUuid: store.id_1c,
      legalUuid: legal.id_1c,
      managerUuid: materializedStoreManagerUuid(store.manager_1c),
    };
  }

  return {
    storeUuid: null,
    legalUuid: legal.id_1c,
    managerUuid: null,
  };
}
