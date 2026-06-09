import { describe, expect, it, vi } from "vitest";
import type { VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import { handleLegalEntitiesUnarchive } from "../legal-entities-full-handlers.js";

const ENTITY_ID = "8b2d51d7-284a-4ee2-87ad-6d809c3488f1";
const CLIENT_ID = "client-ma-ma138425";

function mockRes(): VercelResponse {
  const res = {
    statusCode: 200,
    body: null as Record<string, unknown> | null,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as VercelResponse;
}

describe("handleLegalEntitiesUnarchive", () => {
  it("sets is_archived=false and restores additional status", async () => {
    const row = {
      id: ENTITY_ID,
      client_id: CLIENT_ID,
      name: "ООО Тест",
      inn: "7701234567",
      kpp: null,
      ogrn: null,
      legal_address: null,
      actual_address: null,
      entity_type: null,
      primary_contact: null,
      phone: null,
      email: null,
      internal_code: null,
      status: "archived",
      comment: null,
      updated_by_user_id: null,
      updated_by_name: null,
      source: "manual",
      is_archived: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const pool: PoolLike = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM legal_entities WHERE id")) {
          return { rows: [row] };
        }
        if (sql.includes("UPDATE legal_entities")) {
          return {
            rows: [{ ...row, is_archived: false, status: "additional" }],
          };
        }
        if (sql.includes("INSERT INTO legal_entity_events")) {
          return { rows: [] };
        }
        if (sql.includes("FROM client_assignments")) {
          return { rows: [{ n: "1" }] };
        }
        return { rows: [] };
      }),
    };

    const res = mockRes();
    await handleLegalEntitiesUnarchive(
      res,
      pool,
      { id: "00000000-0000-4000-8000-000000000001", role: "admin", status: "active" },
      ENTITY_ID,
      { updatedByName: "Тест", updatedByUserId: "00000000-0000-4000-8000-000000000001" },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    const item = res.body?.item as { isArchived?: boolean; status?: string };
    expect(item.isArchived).toBe(false);
    expect(item.status).toBe("additional");
  });

  it("rejects non-uuid id", async () => {
    const res = mockRes();
    const pool: PoolLike = { query: vi.fn(async () => ({ rows: [] })) };
    await handleLegalEntitiesUnarchive(
      res,
      pool,
      { id: "00000000-0000-4000-8000-000000000001", role: "admin", status: "active" },
      "manual-legal-entity-1",
      {},
    );
    expect(res.statusCode).toBe(400);
    expect(res.body?.code).toBe("VALIDATION_ERROR");
  });
});
