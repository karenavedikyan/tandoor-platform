/**
 * Промт 440: full scope для admin/director в distribution.
 * Запуск: `npm run test:use-distribution-scoped-dealers` из apps/platform.
 *
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";
import { useDistributionScopedDealers } from "@/hooks/use-distribution-scoped-dealers";

const DEALER_A = {
  id: "client-a",
  name: "Клиент A",
  city: "Москва",
  releaseCode: "MA0001",
  releaseTeamId: "team-kupiansky",
  releaseManagerId: "mgr-1",
  tradePoints: [],
} as DealerRow;

const DEALER_B = {
  id: "client-b",
  name: "Клиент B",
  city: "Казань",
  releaseCode: "MA0002",
  releaseTeamId: "team-other",
  releaseManagerId: "mgr-2",
  tradePoints: [],
} as DealerRow;

const DEALER_RM = {
  id: "client-rm",
  name: "Клиент RM",
  city: "Ростов",
  releaseCode: "RM0001",
  releaseTeamId: "team-sapozhkov",
  releaseManagerId: "mgr-rm",
  tradePoints: [],
} as DealerRow;

const FIXTURE_ROWS = [DEALER_A, DEALER_B, DEALER_RM];

function directorSnap(): OrgSnapshot {
  return {
    me: { id: "director-1", role: "director", fullName: "Директор", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as unknown as OrgSnapshot;
}

function directorRealScope(rows = FIXTURE_ROWS): SidebarNavRealScope {
  const access = mapUserRoleToDealerBaseAccess("director");
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: rows,
    orgScope: { snap: directorSnap(), access },
  };
}

const mergedState = createEmptyActualizationState();

let mockActx = { enabled: false, loading: false, state: mergedState, persist: vi.fn(), refresh: vi.fn() };
let mockTeam = { mergedState };
let mockRealScope: SidebarNavRealScope = directorRealScope();
let mockUser: { role: string; id: string } | null = { role: "director", id: "director-1" };

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => mockActx,
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => mockTeam,
}));

vi.mock("@/hooks/use-sidebar-nav-real-scope", () => ({
  useSidebarNavRealScope: () => mockRealScope,
}));

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({ user: mockUser }),
}));

function profile(role: ReleaseDemoProfile["role"], personaUserId = "demo-user"): ReleaseDemoProfile {
  return { role, personaUserId };
}

describe("useDistributionScopedDealers (440)", () => {
  beforeEach(() => {
    mockActx = { enabled: false, loading: false, state: mergedState, persist: vi.fn(), refresh: vi.fn() };
    mockTeam = { mergedState };
    mockRealScope = directorRealScope();
    mockUser = { role: "director", id: "director-1" };
  });

  it("sales_director profile (admin/director) returns all working rows", () => {
    const { result } = renderHook(() => useDistributionScopedDealers(profile("sales_director", "user-dir")));
    expect(result.current.length).toBe(FIXTURE_ROWS.length);
  });

  it("admin auth maps to sales_director profile and returns all working rows", () => {
    mockUser = { role: "admin", id: "admin-1" };
    const { result } = renderHook(() => useDistributionScopedDealers(profile("sales_director", "admin-1")));
    expect(result.current.length).toBe(FIXTURE_ROWS.length);
  });

  it("director profile returns all working rows", () => {
    mockUser = { role: "director", id: "director-1" };
    const { result } = renderHook(() => useDistributionScopedDealers(profile("sales_director", "user-dir-goncharenko")));
    expect(result.current.length).toBe(FIXTURE_ROWS.length);
  });

  it("category_manager platform role returns all working rows", () => {
    mockUser = { role: "category_manager", id: "cat-1" };
    const { result } = renderHook(() => useDistributionScopedDealers(profile("marketer", "cat-demo")));
    expect(result.current.length).toBe(FIXTURE_ROWS.length);
  });

  it("sales_manager without assignments returns empty array", () => {
    mockUser = { role: "manager", id: "mgr-empty" };
    mockRealScope = {
      isRealUser: true,
      loading: false,
      ready: true,
      releaseDealerRows: FIXTURE_ROWS,
      orgScope: {
        snap: {
          me: { id: "mgr-empty", role: "manager", fullName: "Менеджер", teamId: null },
          visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
          teams: [],
          users: [{ id: "mgr-empty", role: "manager", fullName: "Менеджер", teamId: null, status: "active" }],
        } as unknown as OrgSnapshot,
        access: "sales_manager",
      },
      assignmentsScope: { ownCodes: new Set<string>(), teamCodes: new Set(), grantedCodes: new Set() },
    };
    const { result } = renderHook(() => useDistributionScopedDealers(profile("sales_manager", "mgr-empty")));
    expect(result.current).toEqual([]);
  });

  it("team_lead returns team portfolio", () => {
    const ROP_ID = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
    const TEAM_UUID = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";
    mockUser = { role: "rop", id: ROP_ID };
    mockRealScope = {
      isRealUser: true,
      loading: false,
      ready: true,
      releaseDealerRows: FIXTURE_ROWS,
      orgScope: {
        snap: {
          me: { id: ROP_ID, role: "rop", fullName: "РОП", teamId: TEAM_UUID },
          visibility: { all: false, clientCodes: null, teamIds: [TEAM_UUID], visibleUserIds: [] },
          teams: [{ id: TEAM_UUID, name: "Команда", ropUserId: ROP_ID, ropName: "РОП" }],
          users: [],
        } as unknown as OrgSnapshot,
        access: "team_lead",
      },
    };
    const { result } = renderHook(() =>
      useDistributionScopedDealers(profile("team_lead", "user-tl-kupiansky")),
    );
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.every((d) => d.releaseTeamId === "team-kupiansky")).toBe(true);
  });

  it("regional_manager returns dealers from ownCodes assignments", () => {
    mockUser = { role: "regional_manager", id: "rm-1" };
    mockRealScope = {
      isRealUser: true,
      loading: false,
      ready: true,
      releaseDealerRows: FIXTURE_ROWS,
      orgScope: {
        snap: {
          me: { id: "rm-1", role: "regional_manager", fullName: "РМ", teamId: "team-sapozhkov" },
          visibility: { all: false, clientCodes: ["RM0001"], teamIds: [], visibleUserIds: [] },
          teams: [],
          users: [{ id: "rm-1", role: "regional_manager", fullName: "РМ", teamId: "team-sapozhkov", status: "active" }],
        } as unknown as OrgSnapshot,
        access: "sales_manager",
      },
      assignmentsScope: {
        ownCodes: new Set(["RM0001"]),
        teamCodes: new Set(),
        grantedCodes: new Set(),
      },
    };
    const { result } = renderHook(() =>
      useDistributionScopedDealers(profile("team_lead", "rm-persona")),
    );
    expect(result.current.map((d) => d.id)).toEqual(["client-rm"]);
  });
});
