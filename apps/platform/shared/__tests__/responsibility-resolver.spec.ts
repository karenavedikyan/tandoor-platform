import { describe, expect, it } from "vitest";
import {
  cityScopeKey,
  resolveClientResponsibility,
  resolveResponsiblesForTradePoint,
  type PoolLike,
} from "../responsibility-resolver.js";

const DEALER_ID = "client-abc";
const CLIENT_CODE = "ABC";

const U_TP = "11111111-1111-4111-8111-111111111101";
const U_CLIENT = "11111111-1111-4111-8111-111111111102";
const U_CITY = "11111111-1111-4111-8111-111111111103";
const U_LEGACY_MGR = "11111111-1111-4111-8111-111111111104";
const U_RM_TP = "22222222-2222-4222-8222-222222222221";
const U_RM_DEALER = "22222222-2222-4222-8222-222222222222";
const U_ROP_TP = "33333333-3333-4333-8333-333333333331";
const U_ROP_DEALER = "33333333-3333-4333-8333-333333333332";
const U_ROP_TEAM = "33333333-3333-4333-8333-333333333333";
const U_MGR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const U_MGR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type TpRow = {
  tp_id: string;
  dealer_id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  regional_manager_id: string | null;
  regional_manager_name: string | null;
  rop_id: string | null;
  rop_name: string | null;
};

type AssignmentRow = {
  scope_kind: string;
  scope_key: string;
  responsible_role: string;
  user_id: string;
  user_name: string | null;
};

class MockResponsibilityDb implements PoolLike {
  tradePoints = new Map<string, TpRow>();
  assignments: AssignmentRow[] = [];
  dealerOverrides = new Map<
    string,
    { regional_manager_id: string | null; regional_manager_name: string | null; rop_id: string | null; rop_name: string | null }
  >();
  clientAssignments = new Map<string, { responsible_user_id: string; team_id: string | null }>();
  teams = new Map<string, { rop_user_id: string | null }>();
  users = new Map<string, string>();

  query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql.startsWith("SELECT tp_id, dealer_id, name, city, address")) {
      const tpId = String(params[0]);
      const row = this.tradePoints.get(tpId);
      return Promise.resolve({ rows: row ? [row as unknown as T] : [] });
    }

    if (sql.startsWith("SELECT scope_kind, scope_key, responsible_role")) {
      const tpId = String(params[0]);
      const dealerId = params[1] as string | null;
      const cityKey = params[2] as string | null;
      const rows = this.assignments.filter((a) => {
        if (a.scope_kind === "trade_point" && a.scope_key === tpId) return true;
        if (dealerId && a.scope_kind === "client" && a.scope_key === dealerId) return true;
        if (cityKey && a.scope_kind === "city" && a.scope_key === cityKey) return true;
        return false;
      });
      return Promise.resolve({ rows: rows as unknown as T[] });
    }

    if (sql.includes("FROM (SELECT 1) AS _one")) {
      const dealerId = params[1] as string | null;
      const clientCode = params[2] as string | null;
      const dealer = dealerId ? this.dealerOverrides.get(dealerId) : undefined;
      const ca = clientCode ? this.clientAssignments.get(clientCode) : undefined;
      const team = ca?.team_id ? this.teams.get(ca.team_id) : undefined;
      const managerName = ca ? this.users.get(ca.responsible_user_id) ?? null : null;
      const teamRopName = team?.rop_user_id ? this.users.get(team.rop_user_id) ?? null : null;
      return Promise.resolve({
        rows: [
          {
            manager_id: ca?.responsible_user_id ?? null,
            manager_name: managerName,
            dealer_rm_id: dealer?.regional_manager_id ?? null,
            dealer_rm_name: dealer?.regional_manager_name ?? null,
            dealer_rop_id: dealer?.rop_id ?? null,
            dealer_rop_name: dealer?.rop_name ?? null,
            team_rop_id: team?.rop_user_id ?? null,
            team_rop_name: teamRopName,
          },
        ] as T[],
      });
    }

    if (sql.startsWith("SELECT id::text AS id, full_name FROM users")) {
      const ids = params[0] as string[];
      const rows = ids
        .map((id) => {
          const name = this.users.get(id);
          return name ? { id, full_name: name } : null;
        })
        .filter(Boolean);
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.startsWith("SELECT tp_id, name, city FROM trade_point_overrides WHERE dealer_id")) {
      const dealerId = String(params[0]);
      const rows = Array.from(this.tradePoints.values())
        .filter((tp) => tp.dealer_id === dealerId)
        .map((tp) => ({ tp_id: tp.tp_id, name: tp.name, city: tp.city }));
      return Promise.resolve({ rows: rows as T[] });
    }

    throw new Error(`Unexpected SQL in mock: ${sql}`);
  }
}

function seedPriorityDb(db: MockResponsibilityDb): void {
  db.tradePoints.set("tp-priority", {
    tp_id: "tp-priority",
    dealer_id: DEALER_ID,
    name: "Priority TP",
    city: "Москва",
    address: null,
    regional_manager_id: U_RM_TP,
    regional_manager_name: "RM TP Legacy",
    rop_id: U_ROP_TP,
    rop_name: "ROP TP Legacy",
  });
  db.clientAssignments.set(CLIENT_CODE, { responsible_user_id: U_LEGACY_MGR, team_id: "team-1" });
  db.teams.set("team-1", { rop_user_id: U_ROP_TEAM });
  db.users.set(U_LEGACY_MGR, "Legacy Manager");
  db.dealerOverrides.set(DEALER_ID, {
    regional_manager_id: U_RM_DEALER,
    regional_manager_name: "RM Dealer Legacy",
    rop_id: U_ROP_DEALER,
    rop_name: "ROP Dealer Legacy",
  });
  db.assignments.push(
    { scope_kind: "trade_point", scope_key: "tp-priority", responsible_role: "manager", user_id: U_TP, user_name: "TP Manager" },
    { scope_kind: "client", scope_key: DEALER_ID, responsible_role: "manager", user_id: U_CLIENT, user_name: "Client Manager" },
    { scope_kind: "city", scope_key: "москва", responsible_role: "manager", user_id: U_CITY, user_name: "City Manager" },
  );
}

describe("responsibility-resolver", () => {
  it("cityScopeKey returns null for «Без города»", () => {
    expect(cityScopeKey("—", null)).toBeNull();
    expect(cityScopeKey(null, "—")).toBeNull();
  });

  it("prefers trade_point assignment over client, city and legacy", async () => {
    const db = new MockResponsibilityDb();
    seedPriorityDb(db);
    const resolved = await resolveResponsiblesForTradePoint(db, "tp-priority");
    expect(resolved.manager).toEqual({
      userId: U_TP,
      userName: "TP Manager",
      source: "assignment",
      sourceLevel: "trade_point",
    });
    expect(resolved.regional_manager.userId).toBe(U_RM_TP);
    expect(resolved.regional_manager.source).toBe("legacy");
    expect(resolved.rop.userId).toBe(U_ROP_TP);
    expect(resolved.rop.source).toBe("legacy");
  });

  it("falls back client assignment, then city assignment, then legacy", async () => {
    const db = new MockResponsibilityDb();
    db.tradePoints.set("tp-fallback", {
      tp_id: "tp-fallback",
      dealer_id: DEALER_ID,
      name: "Fallback TP",
      city: "Москва",
      address: null,
      regional_manager_id: null,
      regional_manager_name: null,
      rop_id: null,
      rop_name: null,
    });
    db.clientAssignments.set(CLIENT_CODE, { responsible_user_id: U_LEGACY_MGR, team_id: null });
    db.users.set(U_LEGACY_MGR, "Legacy Manager");

    db.assignments.push(
      { scope_kind: "client", scope_key: DEALER_ID, responsible_role: "manager", user_id: U_CLIENT, user_name: "Client Manager" },
      { scope_kind: "city", scope_key: "москва", responsible_role: "regional_manager", user_id: U_RM_DEALER, user_name: "RM City Assign" },
      { scope_kind: "city", scope_key: "москва", responsible_role: "rop", user_id: U_ROP_DEALER, user_name: "ROP City Assign" },
    );

    const resolved = await resolveResponsiblesForTradePoint(db, "tp-fallback");
    expect(resolved.manager.userId).toBe(U_CLIENT);
    expect(resolved.manager.sourceLevel).toBe("client");
    expect(resolved.regional_manager.userId).toBe(U_RM_DEALER);
    expect(resolved.regional_manager.sourceLevel).toBe("city");
    expect(resolved.rop.userId).toBe(U_ROP_DEALER);
    expect(resolved.rop.sourceLevel).toBe("city");

    db.assignments = db.assignments.filter((a) => !(a.scope_kind === "client" && a.responsible_role === "manager"));
    const withoutClient = await resolveResponsiblesForTradePoint(db, "tp-fallback");
    expect(withoutClient.manager.userId).toBe(U_LEGACY_MGR);
    expect(withoutClient.manager.source).toBe("legacy");
    expect(withoutClient.manager.sourceLevel).toBe("client");
  });

  it("legacy rop resolves tp → dealer → team", async () => {
    const db = new MockResponsibilityDb();
    db.tradePoints.set("tp-rop-chain", {
      tp_id: "tp-rop-chain",
      dealer_id: DEALER_ID,
      name: "ROP chain",
      city: "Самара",
      address: null,
      regional_manager_id: null,
      regional_manager_name: null,
      rop_id: null,
      rop_name: null,
    });
    db.dealerOverrides.set(DEALER_ID, {
      regional_manager_id: null,
      regional_manager_name: null,
      rop_id: null,
      rop_name: null,
    });
    db.clientAssignments.set(CLIENT_CODE, { responsible_user_id: U_LEGACY_MGR, team_id: "team-rop" });
    db.teams.set("team-rop", { rop_user_id: U_ROP_TEAM });
    db.users.set(U_ROP_TEAM, "Team ROP");

    let resolved = await resolveResponsiblesForTradePoint(db, "tp-rop-chain");
    expect(resolved.rop).toEqual({
      userId: U_ROP_TEAM,
      userName: "Team ROP",
      source: "legacy",
      sourceLevel: "team",
    });

    const tp = db.tradePoints.get("tp-rop-chain")!;
    tp.rop_id = U_ROP_TP;
    tp.rop_name = "ROP TP";
    resolved = await resolveResponsiblesForTradePoint(db, "tp-rop-chain");
    expect(resolved.rop.userId).toBe(U_ROP_TP);
    expect(resolved.rop.sourceLevel).toBe("trade_point");

    tp.rop_id = null;
    tp.rop_name = null;
    db.dealerOverrides.set(DEALER_ID, {
      regional_manager_id: null,
      regional_manager_name: null,
      rop_id: U_ROP_DEALER,
      rop_name: "ROP Dealer",
    });
    resolved = await resolveResponsiblesForTradePoint(db, "tp-rop-chain");
    expect(resolved.rop.userId).toBe(U_ROP_DEALER);
    expect(resolved.rop.sourceLevel).toBe("client");
  });

  it("sharedByRole is true when trade points have different responsible users", async () => {
    const db = new MockResponsibilityDb();
    db.tradePoints.set("tp-a", {
      tp_id: "tp-a",
      dealer_id: DEALER_ID,
      name: "A",
      city: "Казань",
      address: null,
      regional_manager_id: null,
      regional_manager_name: null,
      rop_id: null,
      rop_name: null,
    });
    db.tradePoints.set("tp-b", {
      tp_id: "tp-b",
      dealer_id: DEALER_ID,
      name: "B",
      city: "Казань",
      address: null,
      regional_manager_id: null,
      regional_manager_name: null,
      rop_id: null,
      rop_name: null,
    });
    db.assignments.push(
      { scope_kind: "trade_point", scope_key: "tp-a", responsible_role: "manager", user_id: U_MGR_A, user_name: "Mgr A" },
      { scope_kind: "trade_point", scope_key: "tp-b", responsible_role: "manager", user_id: U_MGR_B, user_name: "Mgr B" },
      { scope_kind: "trade_point", scope_key: "tp-a", responsible_role: "rop", user_id: U_ROP_TP, user_name: "ROP" },
      { scope_kind: "trade_point", scope_key: "tp-b", responsible_role: "rop", user_id: U_ROP_TP, user_name: "ROP" },
    );

    const mixed = await resolveClientResponsibility(db, DEALER_ID);
    expect(mixed.sharedByRole.manager).toBe(true);
    expect(mixed.sharedByRole.rop).toBeUndefined();

    db.assignments = db.assignments.map((a) =>
      a.scope_key === "tp-b" && a.responsible_role === "manager"
        ? { ...a, user_id: U_MGR_A, user_name: "Mgr A" }
        : a,
    );
    const same = await resolveClientResponsibility(db, DEALER_ID);
    expect(same.sharedByRole.manager).toBeUndefined();
  });
});
