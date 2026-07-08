/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientBaseOverview } from "@/lib/client-base-overview-api";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { ClientsOneCManagementCockpit } from "@/pages/clients-1c-management-cockpit";

const profile: ReleaseDemoProfile = { role: "sales_director", personaUserId: "admin-clients-1c" };

const overview: ClientBaseOverview = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  structure: {
    activeClients: 120,
    tradePoints: 340,
    potentialClients: 15,
    attentionClients: 8,
    averageDistributionPct: 42,
    avgTpPerClient: 2.1,
    managersWithClientsWithoutTp: 0,
    citiesWithClientsWithoutTp: 0,
  },
  topActiveClients: [],
  cities: [{ city: "Москва", clients: 40, tradePoints: 90 }],
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
  useLocation: () => ["/clients-1c/overview", vi.fn()],
}));

describe("ClientsOneCManagementCockpit overview branch", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders 1c overview KPI cards without errors", () => {
    render(
      <ClientsOneCManagementCockpit rows={[]} profile={profile} overview={overview} scopeTotalDealers={143} />,
    );

    expect(screen.getByTestId("page-clients-1c-overview")).toBeTruthy();
    expect(screen.getByText("Клиентская база 1С")).toBeTruthy();
    expect(screen.getByTestId("kpi-card-active").textContent).toContain("120");
    expect(screen.getByTestId("kpi-card-potential").textContent).toContain("15");
    expect(screen.getByTestId("kpi-card-attention").textContent).toContain("8");
    expect(screen.getByTestId("button-clients-1c-flat-list")).toBeTruthy();
    expect(screen.queryByTestId("button-dealer-create")).toBeNull();
  });
});
