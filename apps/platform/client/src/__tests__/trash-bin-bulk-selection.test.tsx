/**
 * @vitest-environment jsdom
 * Промт 404: мультивыбор в корзине — select all отмечает видимые карточки.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";

const ADMIN_ID = "admin-1";
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
    ownerTeamAtTrash: null,
    ownerCode: id.toUpperCase(),
    snapshot: { fullName: id, city: null, inn: null, dealerCode: null, legalEntityName: null },
  };
}

const mergedState: ActualizationState = (() => {
  const s = createEmptyActualizationState();
  s.updatedAt = nowIso;
  s.trashedDealersById = {
    "client-a": trash("client-a", ADMIN_ID),
    "client-b": trash("client-b", ADMIN_ID),
  };
  return s;
})();

const realScope: SidebarNavRealScope = (() => {
  const role = "admin" as const;
  const access = mapUserRoleToDealerBaseAccess(role);
  const snap = {
    me: { id: ADMIN_ID, role, fullName: "Admin", teamId: null },
    visibility: { all: true, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: ADMIN_ID, role, fullName: "Admin", teamId: null }],
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
  useAuthUser: () => ({
    user: { id: ADMIN_ID, role: "admin", fullName: "Admin", email: "a@test.local" },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/use-team-context", () => ({
  useTeamContext: () => ({
    teamContext: { teamId: null, teamMemberIds: [], teamCodes: [] },
    loading: false,
  }),
}));
vi.mock("@/hooks/use-release-demo-profile", () => ({
  useReleaseDemoProfile: () => ({ profile: { role: "admin", personaUserId: ADMIN_ID } }),
}));
vi.mock("@/hooks/use-sidebar-nav-real-scope", () => ({ useSidebarNavRealScope: () => realScope }));
vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => ({
    enabled: true,
    loading: false,
    state: mergedState,
    persist: vi.fn(),
    refresh: vi.fn(),
  }),
}));
vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => ({ mergedState, teamFetchLoading: false, refresh: vi.fn() }),
}));
vi.mock("@/hooks/use-dealer-tp-overrides-hydration", () => ({ useDealerTpOverridesHydration: () => ({ ready: true }) }));
vi.mock("@/hooks/use-scroll-restoration", () => ({ useScrollRestoration: () => undefined }));
vi.mock("@/components/navigation/back-nav", () => ({ BackNav: () => null }));
vi.mock("@/lib/release-client-data", () => ({ getReleaseClients: () => [] }));
vi.mock("@/lib/window-list-virtualizer", () => ({
  VirtualizedStackList: <T,>({
    items,
    renderItem,
    getKey,
  }: {
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    getKey: (item: T) => string;
  }) => (
    <div data-testid="virtual-list-mock">
      {items.map((item) => (
        <div key={getKey(item)}>{renderItem(item)}</div>
      ))}
    </div>
  ),
}));

import { TrashBinPage } from "@/pages/trash-bin";

describe("trash-bin bulk selection", () => {
  afterEach(() => cleanup());

  it("select all marks only visible trash dealer cards", () => {
    render(<TrashBinPage />);

    fireEvent.click(screen.getByTestId("checkbox-trash-dealer-select-all"));

    expect(screen.getByTestId("checkbox-trash-dealer-client-a").getAttribute("data-state")).toBe("checked");
    expect(screen.getByTestId("checkbox-trash-dealer-client-b").getAttribute("data-state")).toBe("checked");
    expect(screen.getByText("Выбрано: 2")).toBeTruthy();
    expect(screen.getByTestId("button-trash-restore-selected-dealers").textContent).toContain("(2)");
  });

  it("deselect all clears trash dealer selection", () => {
    render(<TrashBinPage />);

    fireEvent.click(screen.getByTestId("checkbox-trash-dealer-select-all"));
    fireEvent.click(screen.getByTestId("checkbox-trash-dealer-select-all"));

    expect(screen.getByTestId("checkbox-trash-dealer-client-a").getAttribute("data-state")).toBe("unchecked");
    expect(screen.getByTestId("button-trash-restore-selected-dealers").textContent).toContain("(0)");
  });
});
