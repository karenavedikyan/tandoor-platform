/**
 * Промт 423: admin/director viewing-as используют те же scope endpoints.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchTeamScope = vi.fn();
const fetchMyDealerScope = vi.fn();

vi.mock("../lib/dealers-team-scope-api", () => ({
  fetchTeamScope,
  teamScopeQueryKey: (id?: string) => ["dealers", "scope", "team", id ?? "self"],
  SCOPE_FORBIDDEN_ERROR: "SCOPE_FORBIDDEN",
}));

vi.mock("../lib/dealers-my-scope-api", () => ({
  fetchMyDealerScope,
  myDealerScopeQueryKey: (id?: string) => ["dealers", "my-scope", id ?? "self"],
  SCOPE_FORBIDDEN_ERROR: "SCOPE_FORBIDDEN",
}));

const ROP_ID = "rop-x";
const MGR_ID = "mgr-y";

const teamPayload = {
  success: true as const,
  team: { id: "team-1", name: "T", rop: { id: ROP_ID, name: "ROP", email: "" } },
  members: [],
  team_totals: { active_dealers: 637, active_trade_points: 269, trashed_dealers: 12, trashed_trade_points: 0 },
};

const mgrPayload = {
  success: true as const,
  user: { id: MGR_ID, email: "", role: "manager" as const },
  totals: { active_dealers: 54, active_trade_points: 33, trashed_dealers: 0, trashed_trade_points: 0 },
  active_dealer_ids: [],
  active_dealer_external_keys: [],
  trashed_dealer_ids: [],
  trashed_dealer_external_keys: [],
  active_trade_points: [],
  scope_explanation: {
    role: "manager",
    team_ids: [],
    own_codes: 0,
    team_codes: 0,
    granted_codes: 0,
    all_codes: 0,
    full_catalog: false,
  },
};

describe("viewing-as by admin", () => {
  beforeEach(() => {
    fetchTeamScope.mockReset();
    fetchMyDealerScope.mockReset();
    fetchTeamScope.mockResolvedValue(teamPayload);
    fetchMyDealerScope.mockResolvedValue(mgrPayload);
  });

  it("admin viewing-as ropId=X → same team-scope payload", async () => {
    const { fetchTeamScope: fetchTs } = await import("../lib/dealers-team-scope-api");
    const adminAsRop = await fetchTs(ROP_ID);
    const ropSelf = await fetchTs();
    fetchTeamScope.mockResolvedValueOnce(teamPayload);
    const ropDirect = await fetchTs();
    expect(adminAsRop.team_totals).toEqual(ropSelf.team_totals);
    expect(adminAsRop.team_totals.active_trade_points).toBe(269);
    expect(ropDirect.team_totals.active_trade_points).toBe(269);
  });

  it("admin viewing-as managerId=Y → same my-scope payload", async () => {
    const { fetchMyDealerScope: fetchMs } = await import("../lib/dealers-my-scope-api");
    const adminAsMgr = await fetchMs(MGR_ID);
    const mgrSelf = await fetchMs();
    expect(adminAsMgr.totals).toEqual(mgrSelf.totals);
    expect(adminAsMgr.totals.active_trade_points).toBe(33);
  });

  it("director viewing-as ropId=X → same team-scope payload", async () => {
    const { fetchTeamScope: fetchTs } = await import("../lib/dealers-team-scope-api");
    const directorAsRop = await fetchTs(ROP_ID);
    expect(directorAsRop.team_totals.active_dealers).toBe(637);
  });
});
