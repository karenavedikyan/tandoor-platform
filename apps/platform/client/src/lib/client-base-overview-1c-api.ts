import type {
  ClientBaseClientsList,
  ClientBaseManagerDetail,
  ClientBaseOverview,
} from "@/lib/client-base-overview-api";
import type {
  TradePointsManagerDetail,
  TradePointsOverview,
} from "@/lib/trade-points-overview-api";

export type { ClientBaseOverview, ClientBaseManagerDetail, ClientBaseClientsList };

export async function fetchClientBaseOverview1c(params: {
  teamId?: string;
  managerUserId?: string;
}): Promise<ClientBaseOverview> {
  const sp = new URLSearchParams();
  if (params.teamId) sp.set("teamId", params.teamId);
  if (params.managerUserId) sp.set("managerUserId", params.managerUserId);
  const qs = sp.toString();
  const res = await fetch(`/api/admin/client-base-overview-1c${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as ClientBaseOverview | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error(
      "message" in json && typeof json.message === "string"
        ? json.message
        : "Не удалось загрузить клиентскую базу 1С.",
    );
  }
  return json;
}

export async function fetchClientBaseManagerDetail1c(
  managerUserId: string,
): Promise<ClientBaseManagerDetail> {
  const res = await fetch(
    `/api/admin/client-base-manager-detail-1c?managerUserId=${encodeURIComponent(managerUserId)}`,
    {
      method: "GET",
      credentials: "same-origin",
    },
  );
  const json = (await res.json()) as ClientBaseManagerDetail | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error(
      "message" in json && typeof json.message === "string"
        ? json.message
        : "Не удалось загрузить менеджера 1С.",
    );
  }
  return json;
}

export async function fetchClientBaseClientsList1c(params: {
  teamId?: string;
  managerUserId?: string;
}): Promise<ClientBaseClientsList> {
  const sp = new URLSearchParams();
  if (params.teamId) sp.set("teamId", params.teamId);
  if (params.managerUserId) sp.set("managerUserId", params.managerUserId);
  const qs = sp.toString();
  const res = await fetch(`/api/admin/client-base-clients-list-1c${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as ClientBaseClientsList | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error(
      "message" in json && typeof json.message === "string"
        ? json.message
        : "Не удалось загрузить список клиентов 1С.",
    );
  }
  return json;
}

function buildTradePointsOverviewFromClientBase1c(
  overview: ClientBaseOverview,
  list: ClientBaseClientsList,
): TradePointsOverview {
  const cityCount =
    overview.cities.length + (overview.withoutCity.clients > 0 ? 1 : 0);
  const totalHoldings =
    overview.structure.activeClients +
    overview.structure.potentialClients +
    overview.structure.attentionClients;

  return {
    success: true,
    structure: {
      activeTradePoints: overview.structure.tradePoints,
      clientsWithTp: totalHoldings,
      cities: cityCount,
      withoutPhoto: list.tradePoints.length,
      notFilled: 0,
      withPhoto: 0,
      clientsWithoutTp: 0,
      totalActiveClients: overview.structure.activeClients,
    },
    cities: [
      ...overview.cities.map((c) => ({
        cityKey: c.city ?? "__no_city__",
        cityName: c.city ?? "Без города",
        tradePointsCount: c.tradePoints,
        clientsCount: c.clients,
      })),
      ...(overview.withoutCity.clients > 0
        ? [
            {
              cityKey: "__no_city__",
              cityName: "Без города",
              tradePointsCount: overview.withoutCity.tradePoints,
              clientsCount: overview.withoutCity.clients,
            },
          ]
        : []),
    ],
    ropGroups: overview.ropGroups.map((g) => ({
      teamId: g.teamId,
      teamName: g.teamName,
      ropUserId: g.ropUserId,
      ropFullName: g.ropFullName,
      managerCount: g.managerCount,
      tradePoints: g.tradePoints,
      clientsWithTp: g.clients + g.potential + g.attention,
      cities: 0,
      withoutPhoto: g.tradePoints,
      notFilled: 0,
      managers: g.managers.map((m) => ({
        userId: m.userId,
        fullName: m.fullName,
        tradePoints: m.tradePoints,
        clientsWithTp: m.active + m.potential + m.attention,
        cities: 0,
        withoutPhoto: m.tradePoints,
        notFilled: 0,
      })),
    })),
    topRopTeams: [...overview.ropGroups]
      .sort((a, b) => b.tradePoints - a.tradePoints)
      .slice(0, 5)
      .map((g) => ({
        teamId: g.teamId,
        teamName: g.teamName,
        ropFullName: g.ropFullName,
        tradePoints: g.tradePoints,
        clientsWithTp: g.clients + g.potential + g.attention,
      })),
  };
}

export async function fetchTradePointsOverview1c(): Promise<TradePointsOverview> {
  const [overview, list] = await Promise.all([
    fetchClientBaseOverview1c({}),
    fetchClientBaseClientsList1c({}),
  ]);
  return buildTradePointsOverviewFromClientBase1c(overview, list);
}

export async function fetchTradePointsManagerDetail1c(
  managerUserId: string,
): Promise<TradePointsManagerDetail> {
  const detail = await fetchClientBaseManagerDetail1c(managerUserId);
  const clientsById = new Map(detail.clients.map((c) => [c.id, c]));

  return {
    success: true,
    manager: detail.manager,
    clients: detail.clients.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      city: c.city,
      status: c.status,
      tradePointsCount: c.tradePointsCount,
      dealerProfileId: c.dealerProfileId,
    })),
    tradePoints: detail.tradePoints.map((tp) => {
      const client = clientsById.get(tp.clientId);
      return {
        id: tp.id,
        name: tp.name,
        address: tp.address,
        city: tp.city,
        hasPhoto: false,
        notFilled: false,
        clientId: tp.clientId,
        clientFullName: client?.fullName ?? "",
        clientStatus: client?.status ?? "attention",
        dealerProfileId: client?.dealerProfileId ?? null,
        updatedAt: tp.updatedAt ?? "",
      };
    }),
  };
}
