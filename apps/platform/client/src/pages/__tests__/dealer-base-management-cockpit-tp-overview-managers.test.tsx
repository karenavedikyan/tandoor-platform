/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientBaseOverview } from "@/lib/client-base-overview-api";
import type { TradePointsOverview } from "@/lib/trade-points-overview-api";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { DealerBaseManagementCockpit } from "@/pages/dealer-base-management-cockpit";

const TEAM_ID = "team-kupiansky";
const profile: ReleaseDemoProfile = { role: "team_lead", personaUserId: "user-tl-kupiansky" };

const clientOverview: ClientBaseOverview = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  structure: {
    activeClients: 279,
    tradePoints: 279,
    potentialClients: 0,
    attentionClients: 0,
    averageDistributionPct: 0,
    avgTpPerClient: 1,
    managersWithClientsWithoutTp: 0,
    citiesWithClientsWithoutTp: 0,
  },
  topActiveClients: [],
  cities: [],
  withoutCity: { clients: 0, tradePoints: 0 },
  ropGroups: [
    {
      teamId: TEAM_ID,
      teamName: "Купянский",
      ropFullName: "Купянский Родион",
      ropUserId: "rop-kup",
      clients: 279,
      tradePoints: 279,
      potential: 0,
      attention: 0,
      managerCount: 3,
      managersWithEmptyBase: 0,
      managers: [
        { userId: "mgr-yak", fullName: "Якубова", active: 113, tradePoints: 54, segment: null, potential: 0, attention: 0 },
        { userId: "mgr-orl", fullName: "Орлов", active: 102, tradePoints: 32, segment: null, potential: 0, attention: 0 },
        { userId: "rm-melnik", fullName: "Мельник", active: 213, tradePoints: 0, segment: null, potential: 0, attention: 0 },
      ],
    },
  ],
};

const tradePointsOverview: TradePointsOverview = {
  success: true,
  structure: {
    activeTradePoints: 279,
    clientsWithTp: 279,
    cities: 1,
    withoutPhoto: 0,
    notFilled: 0,
    withPhoto: 279,
    clientsWithoutTp: 0,
    totalActiveClients: 279,
  },
  cities: [],
  topRopTeams: [],
  ropGroups: [
    {
      teamId: TEAM_ID,
      teamName: "Купянский",
      ropUserId: "rop-kup",
      ropFullName: "Купянский Родион",
      managerCount: 2,
      tradePoints: 279,
      clientsWithTp: 279,
      cities: 1,
      withoutPhoto: 0,
      notFilled: 0,
      managers: [
        {
          userId: "mgr-yak",
          fullName: "Якубова",
          tradePoints: 177,
          clientsWithTp: 177,
          cities: 1,
          withoutPhoto: 0,
          notFilled: 0,
        },
        {
          userId: "mgr-orl",
          fullName: "Орлов",
          tradePoints: 102,
          clientsWithTp: 102,
          cities: 1,
          withoutPhoto: 0,
          notFilled: 0,
        },
      ],
    },
  ],
};

let tradePointsOverviewQueryState: {
  data: TradePointsOverview | undefined;
  isLoading: boolean;
} = { data: tradePointsOverview, isLoading: false };

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => ({ enabled: false, loading: false }),
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => ({
    dashboardRopTeamId: TEAM_ID,
    mergedState: {},
    teamFetchLoading: false,
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown[] }) => {
      if (opts.queryKey?.[0] === "trade-points-overview") {
        return {
          data: tradePointsOverviewQueryState.data,
          isLoading: tradePointsOverviewQueryState.isLoading,
          isError: false,
        };
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

vi.mock("@/lib/dealer-base-management-view-model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dealer-base-management-view-model")>();
  return {
    ...actual,
    buildRopGroups: () => [
      {
        teamId: TEAM_ID,
        ropName: "Купянский",
        managers: [
          {
            managerId: "mgr-yak",
            name: "Якубова",
            teamId: TEAM_ID,
            active: 113,
            potential: 0,
            attention: 0,
            outlets: 54,
            topSegmentLabel: "—",
            rows: [],
            isExternal: false,
          },
          {
            managerId: "mgr-orl",
            name: "Орлов",
            teamId: TEAM_ID,
            active: 102,
            potential: 0,
            attention: 0,
            outlets: 32,
            topSegmentLabel: "—",
            rows: [],
            isExternal: false,
          },
          {
            managerId: "rm-melnik",
            name: "Мельник Виктор",
            teamId: TEAM_ID,
            active: 213,
            potential: 0,
            attention: 0,
            outlets: 0,
            topSegmentLabel: "—",
            rows: [],
            isExternal: false,
          },
        ],
        active: 279,
        potential: 0,
        attention: 0,
        outlets: 86,
        managerCatalogCount: 3,
        statusLine: "",
        rows: [],
      },
    ],
    teamsForManagementView: () => [{ teamId: TEAM_ID, ropName: "Купянский" }],
  };
});

describe("DealerBaseManagementCockpit trade-points overview managers", () => {
  beforeEach(() => {
    tradePointsOverviewQueryState = { data: tradePointsOverview, isLoading: false };
  });

  afterEach(() => {
    cleanup();
  });

  it("shows overview clients/TP on manager cards and hides regional managers", async () => {
    render(
      <DealerBaseManagementCockpit rows={[]} profile={profile} overview={clientOverview} scopeTotalDealers={1000} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("card-manager-team-mgr-yak")).toBeTruthy();
    });

    expect(screen.queryByTestId("card-manager-team-rm-melnik")).toBeNull();
    expect(screen.getByTestId("card-manager-team-mgr-yak").textContent).toContain("177");
    expect(screen.getByTestId("card-manager-team-mgr-yak").textContent).toContain("177 ТТ");
    expect(screen.getByTestId("card-manager-team-mgr-orl").textContent).toContain("102");
    expect(screen.getByTestId("card-manager-team-mgr-orl").textContent).toContain("102 ТТ");
  });

  it("shows loading placeholder instead of snapshot counts while overview loads", async () => {
    tradePointsOverviewQueryState = { data: undefined, isLoading: true };

    render(
      <DealerBaseManagementCockpit rows={[]} profile={profile} overview={clientOverview} scopeTotalDealers={1000} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("card-manager-team-mgr-yak")).toBeTruthy();
    });

    const yakCard = screen.getByTestId("card-manager-team-mgr-yak");
    expect(yakCard.textContent).toContain("…");
    expect(yakCard.textContent).not.toContain("113");
    expect(yakCard.textContent).not.toContain("54");
  });
});
