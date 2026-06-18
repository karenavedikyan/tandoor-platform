/**
 * @vitest-environment jsdom
 *
 * Промт 395: /dealer-base не должен падать с белым экраном (ReferenceError в hooks).
 * Запуск: `npm run test:dealer-base-renders-without-crash` из каталога apps/platform.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { UserRole } from "@shared/auth";
import DealerBase from "@/pages/dealer-base";
import { DealerBaseErrorBoundary } from "@/components/dealer-base-error-boundary";

const mocks = vi.hoisted(() => ({
  authRole: "manager" as UserRole,
  authUserId: "dc958e02-d80e-4615-bb8a-8a46be70daed",
}));

function emptyMyScope() {
  return {
    success: true as const,
    loading: false,
    ready: true,
    error: false,
    forbidden: false,
    user: { id: mocks.authUserId, email: "m@test", role: "manager" as const },
    scopeSubject: { id: mocks.authUserId, email: "m@test", role: "manager" as const },
    totals: {
      active_dealers: 1,
      active_trade_points: 0,
      trashed_dealers: 0,
      trashed_trade_points: 0,
    },
    active_dealer_ids: [],
    active_dealer_external_keys: ["client-ma-ma1"],
    trashed_dealer_ids: [],
    trashed_dealer_external_keys: [],
    scope_explanation: {
      role: "manager",
      team_ids: [],
      own_codes: 1,
      team_codes: 0,
      granted_codes: 0,
      all_codes: 1,
      full_catalog: false,
    },
    activeDealerIdSet: new Set<string>(),
    trashedDealerIdSet: new Set<string>(),
    activeDealerExternalKeySet: new Set(["client-ma-ma1"]),
    trashedDealerExternalKeySet: new Set<string>(),
  };
}

function orgSnapFor(role: UserRole, userId: string) {
  return {
    me: { id: userId, role, fullName: "Тест Пользователь", teamId: "team-uuid" },
    visibility: { all: role === "admin" || role === "director", clientCodes: ["MA-MA1"], teamIds: [], visibleUserIds: [] },
    teams: [{ id: "team-uuid", name: "Команда", ropUserId: "rop-uuid", ropName: "РОП" }],
    users: [{ id: userId, fullName: "Тест Пользователь", role, teamId: "team-uuid" }],
  };
}

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({
    user: { id: mocks.authUserId, role: mocks.authRole, email: "u@test" },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/use-my-scope-from-db", () => ({
  useMyScopeFromDB: () => emptyMyScope(),
}));

vi.mock("@/lib/dealer-base-source", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dealer-base-source")>();
  return {
    ...actual,
    useDealerBaseRows: () => ({ data: [], isPending: false, isError: false }),
  };
});

vi.mock("@/hooks/use-dealer-tp-overrides-hydration", () => ({
  useDealerTpOverridesHydration: () => ({ hydrationVersion: 0 }),
}));

vi.mock("@/hooks/use-release-demo-profile", () => ({
  useReleaseDemoProfile: () => ({
    profile: { role: "sales_manager", personaUserId: "mgr-sklyarov-dv" },
  }),
}));

vi.mock("@/lib/use-org-snapshot", () => ({
  useOrgSnapshot: () => ({
    data: orgSnapFor(mocks.authRole, mocks.authUserId),
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/lib/use-my-visible-client-codes", () => ({
  useMyVisibleClientCodes: () => ({
    data: { all: false, codes: ["MA-MA1"], assignments: [] },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/use-my-client-codes", () => ({
  useMyClientCodes: () => ({
    data: {
      ownCodes: new Set(["MA-MA1"]),
      teamCodes: new Set<string>(),
      grantedCodes: new Set<string>(),
      responsibleByCode: {},
      meta: { role: "manager", userId: mocks.authUserId, isAdmin: false, isDirector: false, isRop: false, isManager: true },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => ({
    enabled: false,
    loading: false,
    state: createEmptyActualizationState(),
    meta: { updatedAt: null },
  }),
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => ({
    mergedState: createEmptyActualizationState(),
    publishDashboardRopTeamId: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-scroll-restoration", () => ({
  useScrollRestoration: () => undefined,
}));

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: ReactNode; href?: string }) => <a href={href}>{children}</a>,
  useLocation: () => ["", vi.fn()] as const,
}));

vi.mock("@/context/main-dashboard-city-filter-context", () => ({
  useMainDashboardCityFilterOptional: () => null,
}));

vi.mock("@/pages/dealer-base-management-cockpit", () => ({
  DealerBaseManagementCockpit: () => <div data-testid="mock-cockpit" />,
}));

function renderDealerBase() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DealerBase />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("dealer-base renders without crashing", () => {
  const roles: UserRole[] = ["manager", "admin", "director", "rop", "regional_manager"];

  for (const role of roles) {
    it(`${role} role`, () => {
      mocks.authRole = role;
      mocks.authUserId = role === "admin" ? "admin-uuid" : "dc958e02-d80e-4615-bb8a-8a46be70daed";
      const { container } = renderDealerBase();
      // Не белый экран: либо контент страницы, либо error-boundary fallback.
      expect(container.firstChild).not.toBeNull();
    });
  }

  it("error boundary shows fallback when child throws", () => {
    const Thrower = () => {
      throw new Error("test crash");
    };
    const { getByTestId } = render(
      <DealerBaseErrorBoundary>
        <Thrower />
      </DealerBaseErrorBoundary>,
    );
    expect(getByTestId("dealer-base-error-fallback")).toBeTruthy();
  });
});
