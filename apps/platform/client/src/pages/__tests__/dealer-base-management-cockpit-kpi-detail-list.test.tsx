/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientBaseClientsList, ClientBaseOverview } from "@/lib/client-base-overview-api";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { DealerBaseManagementCockpit } from "@/pages/dealer-base-management-cockpit";

const profile: ReleaseDemoProfile = { role: "sales_director", personaUserId: "user-dir-goncharenko" };

const overview: ClientBaseOverview = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  structure: {
    activeClients: 1,
    tradePoints: 0,
    potentialClients: 1,
    attentionClients: 0,
    averageDistributionPct: 0,
    avgTpPerClient: 0,
    managersWithClientsWithoutTp: 0,
    citiesWithClientsWithoutTp: 0,
  },
  topActiveClients: [],
  cities: [],
  withoutCity: { clients: 0, tradePoints: 0 },
  ropGroups: [],
};

const clientsList: ClientBaseClientsList = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  clients: [
    {
      id: "dealer-active",
      fullName: "Active dealer",
      inn: null,
      phone: null,
      legalEntity: false,
      city: "Москва",
      status: "active",
      managerUserId: null,
      managerFullName: null,
      tradePointIds: [],
      tradePointsCount: 0,
      updatedAt: null,
      inCatalog: true,
      hasManager: false,
      hasRegional: false,
      hasRop: false,
    },
    {
      id: "dealer-potential",
      fullName: "Potential dealer",
      inn: null,
      phone: null,
      legalEntity: false,
      city: null,
      status: "potential",
      managerUserId: null,
      managerFullName: null,
      tradePointIds: [],
      tradePointsCount: 0,
      updatedAt: null,
      inCatalog: false,
      hasManager: false,
      hasRegional: false,
      hasRop: false,
    },
    {
      id: "dealer-no-status",
      fullName: "No status dealer",
      inn: null,
      phone: null,
      legalEntity: false,
      city: null,
      status: null,
      managerUserId: null,
      managerFullName: null,
      tradePointIds: [],
      tradePointsCount: 0,
      updatedAt: null,
      inCatalog: true,
      hasManager: false,
      hasRegional: false,
      hasRop: false,
    },
  ],
  tradePoints: [],
  meta: { catalogTotal: 2, activeCount: 1, tradePointsCount: 0 },
};

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => ({ enabled: false, loading: false }),
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => ({
    dashboardRopTeamId: null,
    mergedState: {},
    teamFetchLoading: false,
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === "client-base-clients-list") {
        return { data: clientsList, isLoading: false, isError: false };
      }
      return { data: undefined, isLoading: false, isError: false };
    },
  };
});

vi.mock("@/hooks/use-my-client-codes", () => ({
  useMyClientCodes: () => ({ data: undefined }),
}));

vi.mock("@/hooks/use-scroll-restoration", () => ({
  useScrollRestoration: () => {},
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("wouter", () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ["/dealer-base", vi.fn()],
}));

describe("DealerBaseManagementCockpit KPI detail DB list", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows potential clients from DB list when KPI card is clicked", async () => {
    render(
      <DealerBaseManagementCockpit
        rows={[] as unknown as DealerRow[]}
        profile={profile}
        overview={overview}
        scopeTotalDealers={2}
      />,
    );

    fireEvent.click(screen.getByTestId("kpi-card-potential"));

    await waitFor(() => {
      expect(screen.getByTestId("tab-client-base-detail-clients").textContent).toContain("1");
    });
    expect(screen.getByText("Potential dealer")).toBeTruthy();
  });
});
