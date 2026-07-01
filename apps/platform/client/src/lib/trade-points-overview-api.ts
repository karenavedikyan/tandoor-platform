export type TradePointsOverviewStructure = {
  activeTradePoints: number;
  clientsWithTp: number;
  cities: number;
  withoutPhoto: number;
  notFilled: number;
  withPhoto: number;
  clientsWithoutTp: number;
  totalActiveClients: number;
};

export type TradePointsOverviewCity = {
  cityKey: string;
  cityName: string;
  tradePointsCount: number;
  clientsCount: number;
};

export type TradePointsOverviewRopManager = {
  userId: string;
  fullName: string;
  tradePoints: number;
  clientsWithTp: number;
  cities: number;
  withoutPhoto: number;
  notFilled: number;
  isRegional?: boolean;
};

export type TradePointsOverviewRopGroup = {
  teamId: string | null;
  teamName: string;
  ropUserId: string | null;
  ropFullName: string;
  managerCount: number;
  tradePoints: number;
  clientsWithTp: number;
  cities: number;
  withoutPhoto: number;
  notFilled: number;
  managers: TradePointsOverviewRopManager[];
};

export type TradePointsOverviewTopTeam = {
  teamId: string | null;
  teamName: string;
  ropFullName: string;
  tradePoints: number;
  clientsWithTp: number;
};

export type TradePointsOverview = {
  success: true;
  structure: TradePointsOverviewStructure;
  cities: TradePointsOverviewCity[];
  ropGroups: TradePointsOverviewRopGroup[];
  topRopTeams: TradePointsOverviewTopTeam[];
};

export type TradePointsManagerDetailTp = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  hasPhoto: boolean;
  notFilled: boolean;
  clientId: string;
  clientFullName: string;
  clientStatus: "active" | "potential" | "attention";
  dealerProfileId: string | null;
  updatedAt: string;
};

export type TradePointsManagerDetailClient = {
  id: string;
  fullName: string;
  city: string | null;
  status: "active" | "potential" | "attention";
  tradePointsCount: number;
  dealerProfileId: string | null;
};

export type TradePointsManagerDetail = {
  success: true;
  manager: { userId: string; fullName: string; teamId: string | null; ropFullName: string };
  tradePoints: TradePointsManagerDetailTp[];
  clients: TradePointsManagerDetailClient[];
};

export async function fetchTradePointsOverview(): Promise<TradePointsOverview> {
  const res = await fetch(`/api/admin/trade-points-overview`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as TradePointsOverview | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error(
      "message" in json && typeof json.message === "string"
        ? json.message
        : "Не удалось загрузить торговые точки.",
    );
  }
  return json;
}

export async function fetchTradePointsManagerDetail(
  managerUserId: string,
): Promise<TradePointsManagerDetail> {
  const res = await fetch(
    `/api/admin/trade-points-manager-detail?managerUserId=${encodeURIComponent(managerUserId)}`,
    {
      method: "GET",
      credentials: "same-origin",
    },
  );
  const json = (await res.json()) as TradePointsManagerDetail | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error(
      "message" in json && typeof json.message === "string"
        ? json.message
        : "Не удалось загрузить менеджера.",
    );
  }
  return json;
}
