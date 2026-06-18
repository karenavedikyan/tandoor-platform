/**
 * @vitest-environment jsdom
 *
 * Промт 396: менеджер видит все записи из персонального trash-state,
 * даже если releaseDealerRows пуст (бэклог-коды без 1С-карточек).
 *
 * Запуск: `npm run test:trash-bin-shows-personal-deletions` из каталога apps/platform.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";

const futureIso = new Date(Date.now() + 14 * 86400000).toISOString();
const nowIso = new Date().toISOString();

function trashDealer(id: string) {
  return {
    dealerId: id,
    trashedAt: nowIso,
    trashedBy: "mgr-test",
    trashedByName: "Менеджер",
    expiresAt: futureIso,
    source: "client_bulk_delete" as const,
    snapshot: {
      fullName: `Клиент ${id}`,
      city: "Москва",
      inn: null,
      dealerCode: id.replace(/^client-/i, "").toUpperCase(),
      legalEntityName: null,
    },
  };
}

function buildMergedState(): ActualizationState {
  const state = createEmptyActualizationState();
  state.trashedDealersById = {
    "client-ma-001": trashDealer("client-ma-001"),
    "client-ma-002": trashDealer("client-ma-002"),
    "client-ma-003": trashDealer("client-ma-003"),
  };
  return state;
}

const mergedState = buildMergedState();

const realScope: SidebarNavRealScope = (() => {
  const meId = "mgr-test-uuid";
  const role = "manager" as const;
  const access = mapUserRoleToDealerBaseAccess(role);
  const snap = {
    me: { id: meId, role, fullName: "Менеджер", teamId: null },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: meId, role, fullName: "Менеджер", teamId: null }],
  } as unknown as OrgSnapshot;
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: [],
    orgScope: { snap, access },
    assignmentsScope: {
      ownCodes: new Set(["MA-001", "MA-002", "MA-003"]),
      teamCodes: new Set<string>(),
      grantedCodes: new Set<string>(),
    },
  };
})();

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({
    user: {
      id: "mgr-test-uuid",
      role: "manager",
      fullName: "Менеджер",
      email: "mgr@test.local",
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-release-demo-profile", () => ({
  useReleaseDemoProfile: () => ({
    profile: { role: "sales_manager", personaUserId: "mgr-test-uuid" },
    setProfile: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-sidebar-nav-real-scope", () => ({
  useSidebarNavRealScope: () => realScope,
}));

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => ({
    enabled: true,
    loading: false,
    state: mergedState,
    meta: { success: true, storageMode: "postgres", state: mergedState, updatedAt: nowIso },
    syncStatus: "api_ok",
    refresh: vi.fn(),
    persist: vi.fn(),
    mergedDealerRows: [],
  }),
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => ({
    dashboardRopTeamId: "all",
    publishDashboardRopTeamId: vi.fn(),
    mergedState,
    teamParts: [],
    teamFetchLoading: false,
    refresh: vi.fn(),
    activitySourceSnapshots: [],
    activityDiagnostics: {
      mode: "self",
      requestedUserIds: [],
      loadedSnapshots: 0,
      failedSnapshots: 0,
      emptySnapshots: 0,
      sumManualDealersAcrossSources: 0,
      mergedManualDealers: 0,
      mergedManualTradePoints: 0,
      lastMergedUpdatedAt: null,
    },
  }),
}));

vi.mock("@/hooks/use-dealer-tp-overrides-hydration", () => ({
  useDealerTpOverridesHydration: () => ({ ready: true, hydrationVersion: 0 }),
}));

vi.mock("@/hooks/use-scroll-restoration", () => ({
  useScrollRestoration: () => undefined,
}));

vi.mock("@/components/navigation/back-nav", () => ({
  BackNav: () => null,
}));

vi.mock("@/lib/dealer-overrides-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dealer-overrides-runtime")>();
  return {
    ...actual,
    mergeTrashedDealersForUi: (act: ActualizationState) => ({ ...(act.trashedDealersById ?? {}) }),
    mergeTrashedTradePointsForUi: (act: ActualizationState) => ({ ...(act.trashedTradePointsById ?? {}) }),
  };
});

import { TrashBinPage } from "../trash-bin";

describe("trash-bin-shows-personal-deletions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("manager sees all 3 personal deletions when releaseDealerRows is empty", () => {
    const { container, getByTestId } = render(<TrashBinPage />);

    expect(container.textContent).toContain("В корзине:");
    expect(container.textContent).toMatch(/В корзине:[\s\S]*3[\s\S]*клиентов/);

    expect(getByTestId("card-trash-dealer-client-ma-001")).toBeTruthy();
    expect(getByTestId("card-trash-dealer-client-ma-002")).toBeTruthy();
    expect(getByTestId("card-trash-dealer-client-ma-003")).toBeTruthy();
  });
});
