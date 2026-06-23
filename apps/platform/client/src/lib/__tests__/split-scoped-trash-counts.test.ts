import { describe, expect, it } from "vitest";
import type { UserRole } from "@shared/auth";
import { buildTrashScopeFilterRbac, type TeamContext } from "@shared/trash-archive-rbac";
import type { TrashedDealerInfo, TrashedTradePointInfo } from "../client-base-actualization-state";
import { buildTrashNavBadge } from "../auth-access";
import { splitScopedTrashCounts } from "../dealer-trash-scope";

const TEAM = "team-a";
const MGR = "mgr-self";
const OTHER = "mgr-other";
const ROP = "rop-1";

const teamCtx: TeamContext = {
  teamId: TEAM,
  teamMemberIds: [MGR, OTHER, ROP],
  teamCodes: ["MA-001", "MA-002"],
};

const futureIso = new Date(Date.now() + 86400000).toISOString();

function dealerInfo(id: string, trashedBy: string, ownerTeamAtTrash = TEAM): TrashedDealerInfo {
  return {
    dealerId: id,
    trashedAt: new Date().toISOString(),
    trashedBy,
    trashedByName: "Тест",
    expiresAt: futureIso,
    source: "test",
    ownerTeamAtTrash,
    snapshot: {},
  };
}

function tpInfo(id: string, dealerId: string, trashedBy: string, ownerTeamAtTrash = TEAM): TrashedTradePointInfo {
  return {
    tradePointId: id,
    dealerId,
    trashedAt: new Date().toISOString(),
    trashedBy,
    trashedByName: "Тест",
    expiresAt: futureIso,
    source: "test",
    ownerTeamAtTrash,
    snapshot: {},
  };
}

function filterDealers(dealers: TrashedDealerInfo[], filter: ReturnType<typeof buildTrashScopeFilterRbac>) {
  return dealers.filter(
    (d) => filter.fullView || filter.isDealerInScope(d.dealerId, { trashedBy: d.trashedBy, ownerTeamAtTrash: d.ownerTeamAtTrash }),
  );
}

function filterTps(tps: TrashedTradePointInfo[], filter: ReturnType<typeof buildTrashScopeFilterRbac>) {
  return tps.filter(
    (t) =>
      filter.fullView ||
      filter.isTradePointInScope(t.tradePointId, t.dealerId ?? null, {
        trashedBy: t.trashedBy,
        ownerTeamAtTrash: t.ownerTeamAtTrash,
      }),
  );
}

describe("splitScopedTrashCounts", () => {
  it("fullView returns full array lengths", () => {
    const dealers = [dealerInfo("d1", MGR), dealerInfo("d2", OTHER)];
    const tps = [tpInfo("tp1", "d1", MGR), tpInfo("tp2", "d2", OTHER), tpInfo("tp3", "d1", MGR)];
    const filter = buildTrashScopeFilterRbac({
      role: "director" as UserRole,
      userId: "dir-1",
      teamContext: teamCtx,
    });
    expect(filter.fullView).toBe(true);
    expect(splitScopedTrashCounts(dealers, tps, filter)).toEqual({ dealers: 2, tradePoints: 3 });
  });

  it("ROP filter counts dealers and TPs independently (3 clients, 6 TPs)", () => {
    const inScopeDealers = [dealerInfo("d1", MGR), dealerInfo("d2", OTHER), dealerInfo("d3", MGR)];
    const outScopeDealers = [dealerInfo("d4", "outsider", "team-z"), dealerInfo("d5", "outsider", "team-z")];
    const dealers = [...inScopeDealers, ...outScopeDealers];

    const inScopeTps = [
      tpInfo("tp1", "d1", MGR),
      tpInfo("tp2", "d1", MGR),
      tpInfo("tp3", "d2", OTHER),
      tpInfo("tp4", "d3", MGR),
      tpInfo("tp5", "d3", OTHER),
      tpInfo("tp6", "d2", MGR),
    ];
    const outScopeTps = [tpInfo("tp7", "d4", "outsider", "team-z")];
    const tps = [...inScopeTps, ...outScopeTps];

    const filter = buildTrashScopeFilterRbac({
      role: "rop",
      userId: ROP,
      teamContext: teamCtx,
    });

    const counts = splitScopedTrashCounts(dealers, tps, filter);
    expect(counts.dealers).toBe(3);
    expect(counts.tradePoints).toBe(6);
    expect(counts.dealers).toBe(filterDealers(dealers, filter).length);
    expect(counts.tradePoints).toBe(filterTps(tps, filter).length);
  });

  it("empty scope returns zeros", () => {
    const filter = {
      isDealerInScope: () => false,
      isTradePointInScope: () => false,
      fullView: false,
    };
    const dealers = [dealerInfo("d1", MGR)];
    const tps = [tpInfo("tp1", "d1", MGR)];
    expect(splitScopedTrashCounts(dealers, tps, filter)).toEqual({ dealers: 0, tradePoints: 0 });
  });

  it("buildTrashNavBadge formats split counts as N/M or single number", () => {
    const dealers = [dealerInfo("d1", MGR), dealerInfo("d2", MGR), dealerInfo("d3", MGR)];
    const tps = Array.from({ length: 6 }, (_, i) => tpInfo(`tp${i}`, "d1", MGR));
    const filter = buildTrashScopeFilterRbac({ role: "rop", userId: ROP, teamContext: teamCtx });
    const counts = splitScopedTrashCounts(dealers, tps, filter);
    expect(buildTrashNavBadge(counts.dealers, counts.tradePoints)).toEqual({ badge: "3/6" });
    expect(buildTrashNavBadge(counts.dealers, 0)).toEqual({ badge: 3 });
    expect(buildTrashNavBadge(0, counts.tradePoints)).toEqual({ badge: 6 });
    expect(buildTrashNavBadge(0, 0)).toEqual({});
  });

  it("sidebar badge count matches page filter for same inputs", () => {
    const dealers = [dealerInfo("d1", MGR), dealerInfo("d2", OTHER), dealerInfo("d3", "outsider", "team-z")];
    const tps = [tpInfo("tp1", "d1", MGR), tpInfo("tp2", "d2", OTHER), tpInfo("tp3", "d3", "outsider", "team-z")];
    const filter = buildTrashScopeFilterRbac({ role: "manager", userId: MGR, teamContext: teamCtx });
    const counts = splitScopedTrashCounts(dealers, tps, filter);
    const pageDealers = filterDealers(dealers, filter).length;
    const pageTps = filterTps(tps, filter).length;
    expect(counts.dealers).toBe(pageDealers);
    expect(counts.tradePoints).toBe(pageTps);
    expect(buildTrashNavBadge(counts.dealers, counts.tradePoints)).toEqual(
      buildTrashNavBadge(pageDealers, pageTps),
    );
  });
});
