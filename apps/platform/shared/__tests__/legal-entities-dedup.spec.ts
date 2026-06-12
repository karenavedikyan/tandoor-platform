import { describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import {
  handleLegalEntitiesCreateFull,
  normalizeLegalEntityNameForDedup,
} from "../legal-entities-full-handlers.js";

const ENTITY_ID = "8b2d51d7-284a-4ee2-87ad-6d809c3488f1";
const CLIENT_ID = "client-ma-ma138425";

type MockRes = {
  statusCode: number;
  body: Record<string, unknown> | null;
  setHeader: ReturnType<typeof vi.fn>;
  status(code: number): MockRes;
  json(payload: Record<string, unknown>): MockRes;
};

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
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
  return res;
}

function asRes(res: MockRes): VercelResponse {
  return res as unknown as VercelResponse;
}

function archivedRow(name: string) {
  return {
    id: ENTITY_ID,
    client_id: CLIENT_ID,
    name,
    inn: null,
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
    payment_form: null,
    payment_delay_days: null,
    credit_limit_rub: null,
    edo_enabled: null,
    edo_operator: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("normalizeLegalEntityNameForDedup", () => {
  it("treats quoted and punctuated variants as the same key", () => {
    const a = normalizeLegalEntityNameForDedup('АО "ВЕЗУМАТЕРИАЛЫ.РФ"');
    const b = normalizeLegalEntityNameForDedup("ао   везуматериалы.рф");
    expect(a).toBe(b);
    expect(a).toBe("ао везуматериалы рф");
  });

  it("keeps different parenthetical notes as distinct keys", () => {
    const a = normalizeLegalEntityNameForDedup("Иванов ИП (склад 1)");
    const b = normalizeLegalEntityNameForDedup("Иванов ИП (склад 2)");
    expect(a).not.toBe(b);
    expect(a).toBe("иванов ип склад 1");
    expect(b).toBe("иванов ип склад 2");
  });
});

describe("handleLegalEntitiesCreateFull dedup", () => {
  it("restores archived duplicate instead of creating a new row", async () => {
    const row = archivedRow("Хачкиев Виталий Сергеевич ИП");
    let historyBody: string | null = null;

    const pool: PoolLike = {
      query: (vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM client_assignments")) {
          return { rows: [{ n: "1" }] };
        }
        if (sql.includes("translate(") && sql.includes("regexp_replace")) {
          return { rows: [row] };
        }
        if (sql.includes("SELECT * FROM legal_entities WHERE id = $1")) {
          return { rows: [row] };
        }
        if (sql.includes("UPDATE legal_entities SET") && sql.includes("is_archived = false")) {
          return {
            rows: [{ ...row, is_archived: false, status: "additional", name: params?.[1] ?? row.name }],
          };
        }
        if (sql.includes("UPDATE legal_entities SET") && sql.includes("name = $2")) {
          return { rows: [{ ...row, name: "Хачкиев Виталий Сергеевич ИП" }] };
        }
        if (sql.includes("INSERT INTO legal_entity_events")) {
          historyBody = String(params?.[2] ?? "");
          return { rows: [] };
        }
        if (sql.includes("INSERT INTO legal_entities")) {
          throw new Error("should not insert when archived duplicate exists");
        }
        return { rows: [] };
      }) as unknown) as PoolLike["query"],
    };

    const req = {
      body: {
        clientId: CLIENT_ID,
        name: "Хачкиев Виталий Сергеевич ИП",
        updatedByName: "Тест",
      },
    } as VercelRequest;

    const res = mockRes();
    await handleLegalEntitiesCreateFull(
      req,
      asRes(res),
      pool,
      { id: "00000000-0000-4000-8000-000000000001", role: "admin", status: "active" },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.deduplicated).toBe(true);
    expect(res.body?.restoredFromArchive).toBe(true);
    const item = res.body?.item as { isArchived?: boolean; status?: string };
    expect(item.isArchived).toBe(false);
    expect(item.status).toBe("additional");
    expect(historyBody).toContain("восстановлено из архива при повторном добавлении");
  });
});
