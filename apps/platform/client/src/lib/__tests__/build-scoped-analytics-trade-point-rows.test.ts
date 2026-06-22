/**
 * Промт 441-fix7: analytics rows must not pass orgScope (RoleScope throw for sales_director).
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import { buildScopedAnalyticsTradePointRows } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import * as tradePointList from "@/lib/trade-point-list-for-actualization";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

function makeRow(dealerId: string): TradePointListRow {
  return {
    tradePointId: `tp-${dealerId}`,
    dealerId,
    hasShowcase: true,
    isArchived: false,
  } as TradePointListRow;
}

function directorRealScope(dealers: DealerRow[]): SidebarNavRealScope {
  const snap = {
    me: { id: "admin-1", role: "director", fullName: "Карен", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as unknown as OrgSnapshot;
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: dealers,
    orgScope: { snap, access: "sales_director" },
  };
}

describe("buildScopedAnalyticsTradePointRows (441-fix7)", () => {
  it("does not pass orgScope and filters by scopedDealers", () => {
    const buildSpy = vi.spyOn(tradePointList, "buildTradePointListForActualization").mockReturnValue([
      makeRow("d1"),
      makeRow("d2"),
    ]);

    const dealers = [{ id: "d1" }, { id: "d2" }] as DealerRow[];
    const act = createEmptyActualizationState();
    const profile = { role: "sales_director", personaUserId: "admin-1" } as const;
    const realScope = directorRealScope(dealers);

    const rows = buildScopedAnalyticsTradePointRows(act, profile, [dealers[0]], realScope);

    expect(buildSpy).toHaveBeenCalledTimes(1);
    const options = buildSpy.mock.calls[0]?.[2];
    expect(options).toBeDefined();
    expect(options).not.toHaveProperty("orgScope");
    expect(options?.releaseDealerRows).toBe(dealers);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dealerId).toBe("d1");

    buildSpy.mockRestore();
  });
});
