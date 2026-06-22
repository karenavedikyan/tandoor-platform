/**
 * Промт 441-fix5: unified scope formula in buildSidebarNavRealScope.
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  buildSidebarNavRealScope,
  type BuildSidebarNavRealScopeInput,
} from "@/lib/sidebar-nav-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

const CATALOG = [
  { id: "d1", name: "Dealer 1" },
  { id: "d2", name: "Dealer 2" },
  { id: "d3", name: "Dealer 3" },
] as DealerRow[];

const SNAP = {
  me: { id: "admin-1", role: "admin", fullName: "Admin", teamId: null },
  visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [],
} as OrgSnapshot;

function baseInput(overrides: Partial<BuildSidebarNavRealScopeInput> = {}): BuildSidebarNavRealScopeInput {
  return {
    isRealUser: true,
    authLoading: false,
    authError: false,
    role: "admin",
    snap: SNAP,
    visPayload: { all: false, codes: ["d1"], assignments: null },
    orgSnapError: false,
    visCodesError: false,
    orgSnapLoading: false,
    visCodesLoading: false,
    assignmentsScope: undefined,
    catalogRows: CATALOG,
    ...overrides,
  };
}

describe("buildSidebarNavRealScope (441-fix5)", () => {
  it("dbFullCatalog true with non-empty dbScopedExternalKeys returns full catalog", () => {
    const scope = buildSidebarNavRealScope(
      baseInput({
        dbFullCatalog: true,
        dbScopedExternalKeys: new Set(["d1", "d2"]),
      }),
    );
    expect(scope.ready).toBe(true);
    expect(scope.releaseDealerRows?.length).toBe(CATALOG.length);
    expect(scope.dbScopeDirect).toBe(false);
  });

  it("dbFullCatalog true without dbScopedExternalKeys returns full catalog", () => {
    const scope = buildSidebarNavRealScope(
      baseInput({
        dbFullCatalog: true,
        dbScopedExternalKeys: undefined,
      }),
    );
    expect(scope.releaseDealerRows?.length).toBe(CATALOG.length);
    expect(scope.dbScopeDirect).toBe(false);
  });

  it("visPayload.all true without dbFullCatalog flag still returns full catalog", () => {
    const scope = buildSidebarNavRealScope(
      baseInput({
        visPayload: { all: true, codes: null, assignments: null },
        dbScopedExternalKeys: new Set(["d1", "d2"]),
      }),
    );
    expect(scope.releaseDealerRows?.length).toBe(CATALOG.length);
    expect(scope.dbScopeDirect).toBe(false);
  });

  it("dbFullCatalog false with non-empty dbScopedExternalKeys filters rows", () => {
    const scope = buildSidebarNavRealScope(
      baseInput({
        dbFullCatalog: false,
        dbScopedExternalKeys: new Set(["d1", "d2"]),
      }),
    );
    expect(scope.releaseDealerRows?.map((r) => r.id)).toEqual(["d1", "d2"]);
    expect(scope.dbScopeDirect).toBe(true);
  });

  it("dbFullCatalog false with empty Set returns zero rows deterministically", () => {
    const scope = buildSidebarNavRealScope(
      baseInput({
        dbFullCatalog: false,
        dbScopedExternalKeys: new Set(),
      }),
    );
    expect(scope.releaseDealerRows).toEqual([]);
    expect(scope.dbScopeDirect).toBe(true);
  });

  it("returns ready false while org snapshot is loading", () => {
    const scope = buildSidebarNavRealScope(
      baseInput({
        snap: null,
        visPayload: null,
        orgSnapLoading: true,
      }),
    );
    expect(scope.ready).toBe(false);
    expect(scope.loading).toBe(true);
    expect(scope.releaseDealerRows).toBeUndefined();
  });
});
