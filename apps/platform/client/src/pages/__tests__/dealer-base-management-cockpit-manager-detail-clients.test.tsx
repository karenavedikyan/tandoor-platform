/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientBaseOverview } from "@/lib/client-base-overview-api";
import type { TradePointsOverview } from "@/lib/trade-points-overview-api";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { DealerBaseManagementCockpit } from "@/pages/dealer-base-management-cockpit";

const TEAM_ID = "team-kupiansky";
const YAK_USER_ID = "0481a81d-160b-422e-8257-cf21d134cd42";
const profile: ReleaseDemoProfile = { role: "team_lead", personaUserId: "user-tl-kupiansky" };

const clientOverview: ClientBaseOverview = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  structure: {
    activeClients: 177,
    tradePoints: 177,
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
      clients: 177,
      tradePoints: 177,
      potential: 0,
      attention: 0,
      managerCount: 1,
      managersWithEmptyBase: 0,
      managers: [
        {
          userId: YAK_USER_ID,
          fullName: "Якубова Юлия Сергеевна",
          active: 177,
          tradePoints: 177,
          segment: null,
          potential: 0,
          attention: 0,
        },
      ],
    },
  ],
};

const tradePointsOverview: TradePointsOverview = {
  success: true,
  structure: {
    activeTradePoints: 177,
    clientsWithTp: 177,
    cities: 1,
    withoutPhoto: 0,
    notFilled: 0,
    withPhoto: 177,
    clientsWithoutTp: 0,
    totalActiveClients: 177,
  },
  cities: [],
  topRopTeams: [],
  ropGroups: [
    {
      teamId: TEAM_ID,
      teamName: "Купянский",
      ropUserId: "rop-kup",
      ropFullName: "Купянский Родион",
      managerCount: 1,
      tradePoints: 177,
      clientsWithTp: 177,
      cities: 1,
      withoutPhoto: 0,
      notFilled: 0,
      managers: [
        {
          userId: YAK_USER_ID,
          fullName: "Якубова Юлия Сергеевна",
          tradePoints: 177,
          clientsWithTp: 177,
          cities: 1,
          withoutPhoto: 0,
          notFilled: 0,
        },
      ],
    },
  ],
};

const serverClients = [
  {
    id: "client-ma-yak-1",
    fullName: "Клиент Якубовой",
    city: "Москва",
    status: "active" as const,
    tradePointsCount: 1,
    dealerProfileId: "client-ma-yak-1",
  },
];

let tradePointsOverviewQueryState: {
  data: TradePointsOverview | undefined;
  isLoading: boolean;
} = { data: tradePointsOverview, isLoading: false };

let managerDetailQueryState: {
  data: { success: true; manager: Record<string, unknown>; tradePoints: unknown[]; clients: typeof serverClients } | undefined;
  isLoading: boolean;
} = {
  data: {
    success: true,
    manager: { userId: YAK_USER_ID, fullName: "Якубова Юлия Сергеевна", teamId: TEAM_ID, ropFullName: "Купянский" },
    tradePoints: [],
    clients: serverClients,
  },
  isLoading: false,
};

vi.mock("@/lib/trade-points-overview-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trade-points-overview-api")>();
  return {
    ...actual,
    fetchTradePointsManagerDetail: vi.fn(async (managerUserId: string) => {
      if (managerUserId !== YAK_USER_ID) {
        return { success: true, manager: { userId: managerUserId }, tradePoints: [], clients: [] };
      }
      if (managerDetailQueryState.isLoading) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return (
        managerDetailQueryState.data ?? {
          success: true,
          manager: { userId: YAK_USER_ID, fullName: "Якубова", teamId: TEAM_ID, ropFullName: "Купянский" },
          tradePoints: [],
          clients: serverClients,
        }
      );
    }),
  };
});

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
    useQuery: (opts: { queryKey?: unknown[]; enabled?: boolean }) => {
      if (opts.queryKey?.[0] === "trade-points-overview") {
        return {
          data: tradePointsOverviewQueryState.data,
          isLoading: tradePointsOverviewQueryState.isLoading,
          isError: false,
        };
      }
      if (opts.queryKey?.[0] === "trade-points-manager-detail") {
        if (opts.enabled === false) {
          return { data: undefined, isLoading: false, isError: false };
        }
        return {
          data: managerDetailQueryState.data,
          isLoading: managerDetailQueryState.isLoading,
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
            managerId: "mgr-yakubova-ys",
            name: "Якубова Юлия Сергеевна",
            teamId: TEAM_ID,
            active: 177,
            potential: 0,
            attention: 0,
            outlets: 177,
            topSegmentLabel: "—",
            rows: [
              {
                id: "client-ma0002241",
                name: "ИП Баранова Татьяна Игоревна",
                city: "Москва",
                status: "активный",
                outlets: 1,
              },
            ],
            isExternal: false,
          },
        ],
        active: 177,
        potential: 0,
        attention: 0,
        outlets: 177,
        managerCatalogCount: 1,
        statusLine: "",
        rows: [],
      },
    ],
    teamsForManagementView: () => [{ teamId: TEAM_ID, ropName: "Купянский" }],
  };
});

async function openYakubovaManagerOverview(): Promise<void> {
  render(
    <DealerBaseManagementCockpit rows={[]} profile={profile} overview={clientOverview} scopeTotalDealers={1000} />,
  );

  await waitFor(() => {
    expect(screen.getByTestId(`button-client-base-rop-details-${TEAM_ID}`)).toBeTruthy();
  });

  fireEvent.click(screen.getByTestId(`button-client-base-rop-details-${TEAM_ID}`));

  const dialog = await screen.findByTestId("dialog-client-base-group-detail");
  fireEvent.click(within(dialog).getByText("Якубова Юлия Сергеевна"));
}

describe("DealerBaseManagementCockpit manager_overview clients", () => {
  beforeEach(() => {
    tradePointsOverviewQueryState = { data: tradePointsOverview, isLoading: false };
    managerDetailQueryState = {
      data: {
        success: true,
        manager: { userId: YAK_USER_ID, fullName: "Якубова Юлия Сергеевна", teamId: TEAM_ID, ropFullName: "Купянский" },
        tradePoints: [],
        clients: serverClients,
      },
      isLoading: false,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders clients from fetchTradePointsManagerDetail, not snapshot rows", async () => {
    await openYakubovaManagerOverview();

    await waitFor(() => {
      expect(screen.getByText("Клиент Якубовой")).toBeTruthy();
    });

    expect(screen.queryByText("ИП Баранова Татьяна Игоревна")).toBeNull();
  });

  it("shows loading state instead of snapshot while manager detail loads", async () => {
    managerDetailQueryState = { data: undefined, isLoading: true };

    await openYakubovaManagerOverview();

    expect(screen.getByText("Загрузка…")).toBeTruthy();
    expect(screen.queryByText("ИП Баранова Татьяна Игоревна")).toBeNull();
    expect(screen.queryByText("Клиент Якубовой")).toBeNull();
  });
});
