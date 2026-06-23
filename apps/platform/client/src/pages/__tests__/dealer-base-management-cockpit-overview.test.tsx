/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientBaseOverview } from "@/lib/client-base-overview-api";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { DealerBaseManagementCockpit } from "@/pages/dealer-base-management-cockpit";

const profile: ReleaseDemoProfile = { role: "sales_director", personaUserId: "user-dir-goncharenko" };

function makeCatalogRow(id: string): DealerRow {
  return {
    id,
    name: `Клиент ${id}`,
    city: "Москва",
    status: "",
    outlets: 0,
    distribution: 0,
    hasProblem: false,
    hasRecentActivity: false,
    clientCategory: "top350",
    tradePoints: [],
  } as unknown as DealerRow;
}

const overview: ClientBaseOverview = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  structure: {
    activeClients: 1035,
    tradePoints: 248,
    potentialClients: 2,
    attentionClients: 122,
    averageDistributionPct: 14,
    avgTpPerClient: 0.24,
    managersWithClientsWithoutTp: 20,
    citiesWithClientsWithoutTp: 238,
  },
  topActiveClients: [],
  cities: [{ city: "Краснодар", clients: 73, tradePoints: 9 }],
  withoutCity: { clients: 0, tradePoints: 0 },
  ropGroups: [],
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
    useQuery: () => ({ data: undefined, isLoading: false }),
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

describe("DealerBaseManagementCockpit overview branch", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders client KPI cards from overview when catalog rows lack status", () => {
    const rows = Array.from({ length: 2850 }, (_, i) => makeCatalogRow(`dealer-${i}`));

    render(<DealerBaseManagementCockpit rows={rows} profile={profile} overview={overview} />);

    expect(screen.getByText("1035")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("122")).toBeTruthy();
    expect(screen.getByText("1813")).toBeTruthy();
    expect(screen.getByText("2850")).toBeTruthy();
    expect(screen.getByTestId("text-client-base-reconcile-note")).toBeTruthy();
  });

  it("renders overview cities and total city count", () => {
    const rows = [makeCatalogRow("dealer-1")];

    render(<DealerBaseManagementCockpit rows={rows} profile={profile} overview={overview} />);

    const citiesSection = screen.getByTestId("section-client-base-cities");
    expect(citiesSection.textContent).toContain("Краснодар");
    expect(citiesSection.textContent).toContain("73");
    expect(citiesSection.textContent).toMatch(/всего\s+1/);
  });
});
