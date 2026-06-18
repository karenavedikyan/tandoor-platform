/**
 * @vitest-environment jsdom
 * Промт 398: manager видит только свои удаления на /trash-bin.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";

const MGR = "mgr-self";
const OTHER = "mgr-other";
const TEAM = "team-a";
const futureIso = new Date(Date.now() + 14 * 86400000).toISOString();
const nowIso = new Date().toISOString();

function trash(id: string, by: string) {
  return {
    dealerId: id,
    trashedAt: nowIso,
    trashedBy: by,
    trashedByName: "U",
    expiresAt: futureIso,
    source: "client_bulk_delete" as const,
    ownerTeamAtTrash: TEAM,
    ownerCode: id.toUpperCase(),
    snapshot: { fullName: id, city: null, inn: null, dealerCode: null, legalEntityName: null },
  };
}

const mergedState: ActualizationState = (() => {
  const s = createEmptyActualizationState();
  s.updatedAt = nowIso;
  s.trashedDealersById = {
    "client-own": trash("client-own", MGR),
    "client-foreign": trash("client-foreign", OTHER),
  };
  return s;
})();

const realScope: SidebarNavRealScope = (() => {
  const role = "manager" as const;
  const access = mapUserRoleToDealerBaseAccess(role);
  const snap = {
    me: { id: MGR, role, fullName: "M", teamId: TEAM },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: MGR, role, fullName: "M", teamId: TEAM }],
  } as unknown as OrgSnapshot;
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: [],
    orgScope: { snap, access },
    assignmentsScope: { ownCodes: new Set(), teamCodes: new Set(), grantedCodes: new Set() },
  };
})();

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({ user: { id: MGR, role: "manager", fullName: "M", email: "m@t" }, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/use-team-context", () => ({
  useTeamContext: () => ({ teamContext: { teamId: TEAM, teamMemberIds: [MGR, OTHER], teamCodes: [] }, loading: false }),
}));
vi.mock("@/hooks/use-release-demo-profile", () => ({
  useReleaseDemoProfile: () => ({ profile: { role: "sales_manager", personaUserId: MGR } }),
}));
vi.mock("@/hooks/use-sidebar-nav-real-scope", () => ({ useSidebarNavRealScope: () => realScope }));
vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => ({ enabled: true, loading: false, state: mergedState, persist: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => ({ mergedState, teamFetchLoading: false, refresh: vi.fn() }),
}));
vi.mock("@/hooks/use-dealer-tp-overrides-hydration", () => ({ useDealerTpOverridesHydration: () => ({ ready: true }) }));
vi.mock("@/hooks/use-scroll-restoration", () => ({ useScrollRestoration: () => undefined }));
vi.mock("@/components/navigation/back-nav", () => ({ BackNav: () => null }));

import { TrashBinPage } from "@/pages/trash-bin";

describe("trash-bin-rbac", () => {
  afterEach(() => cleanup());

  it("manager sees only own row", () => {
    const { queryByTestId, container } = render(<TrashBinPage />);
    expect(queryByTestId("card-trash-dealer-client-own")).toBeTruthy();
    expect(queryByTestId("card-trash-dealer-client-foreign")).toBeNull();
    expect(container.textContent).toMatch(/В корзине:[\s\S]*1[\s\S]*клиентов/);
  });
});
