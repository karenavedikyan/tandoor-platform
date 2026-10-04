/**
 * Shared manager across ROP branches — detail list scoped to viewer context.
 * Run: npx tsx shared/__tests__/wholesale-viewer-scope-detail.test.ts
 */

import assert from "node:assert/strict";
import { fetchWholesaleOneCManager } from "../wholesale-showroom-detail.js";
import type { PoolLike } from "../responsibility-resolver.js";

const ROP_A = "10000000-0000-4000-8000-000000000001";
const ROP_B = "10000000-0000-4000-8000-000000000002";
const MGR = "10000000-0000-4000-8000-000000000010";
const CLIENT_A = "20000000-0000-4000-8000-000000000001";
const CLIENT_B = "20000000-0000-4000-8000-000000000002";
const STORE_A = "30000000-0000-4000-8000-000000000001";
const STORE_B = "30000000-0000-4000-8000-000000000002";

function mockPool(): PoolLike {
  return {
    query: async (sql: string) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM wholesale_source_snapshots")) {
        return {
          rows: [
            {
              raw: {
                employeeRoster: [
                  { guid_manager: ROP_A, name_manager: "РОП А", post: "РОП" },
                  { guid_manager: ROP_B, name_manager: "РОП Б", post: "РОП" },
                  { guid_manager: MGR, name_manager: "Общий менеджер", post: "Менеджер" },
                ],
              },
              imported_at: "2026-10-04T00:00:00.000Z",
            },
          ],
        };
      }
      if (s.includes("FROM wholesale_client_metadata")) {
        return {
          rows: [
            {
              guid_client: CLIENT_A,
              external_key: `client-${CLIENT_A}`,
              name: "Клиент A",
              city: "Москва",
              region: null,
              holding: null,
              holding_link_state: null,
              pending_holding_guid: null,
              manager_roster_state: null,
              raw: {
                guid_head_of_the_sales_department: ROP_A,
                guid_manager: MGR,
              },
            },
            {
              guid_client: CLIENT_B,
              external_key: `client-${CLIENT_B}`,
              name: "Клиент B",
              city: "СПб",
              region: null,
              holding: null,
              holding_link_state: null,
              pending_holding_guid: null,
              manager_roster_state: null,
              raw: {
                guid_head_of_the_sales_department: ROP_B,
                guid_manager: MGR,
              },
            },
          ],
        };
      }
      if (s.includes("FROM wholesale_outlet_metadata")) {
        return {
          rows: [
            { guid_store: STORE_A, guid_client: CLIENT_A, closed: false, raw: {} },
            { guid_store: STORE_B, guid_client: CLIENT_B, closed: false, raw: {} },
          ],
        };
      }
      if (s.includes("employee_account_links")) return { rows: [] };
      return { rows: [] };
    },
  };
}

const pool = mockPool();
const admin = { id: "admin", role: "admin" as const };

// Admin without rop_context sees both stores for shared manager
{
  const res = await fetchWholesaleOneCManager(pool, MGR, "", 100, 0, admin);
  assert.ok(res);
  assert.equal(res!.total, 2);
}

// Admin with ROP A context sees only client A branch
{
  const res = await fetchWholesaleOneCManager(pool, MGR, "", 100, 0, admin, ROP_A);
  assert.ok(res);
  assert.equal(res!.total, 1);
  assert.equal(res!.items[0]!.clientGuid, CLIENT_A);
  assert.equal(res!.items[0]!.entityKind, "store");
  assert.equal(res!.items[0]!.id_1c, STORE_A);
}

// Store rows use store GUID, not client GUID
{
  const res = await fetchWholesaleOneCManager(pool, MGR, "", 100, 0, admin, ROP_A);
  assert.ok(res);
  const storeItem = res!.items.find((i) => i.entityKind === "store");
  assert.ok(storeItem);
  assert.equal(storeItem!.id_1c, STORE_A);
  assert.notEqual(storeItem!.id_1c, CLIENT_A);
}

console.log("wholesale-viewer-scope-detail.test.ts: ok");
