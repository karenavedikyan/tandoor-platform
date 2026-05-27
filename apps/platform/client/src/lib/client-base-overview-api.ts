export type ClientBaseOverview = {
  success: true;
  generatedAt: string;
  structure: {
    activeClients: number;
    tradePoints: number;
    potentialClients: number;
    attentionClients: number;
    averageDistributionPct: number;
    avgTpPerClient: number;
    managersWithClientsWithoutTp: number;
    citiesWithClientsWithoutTp: number;
  };
  topActiveClients: Array<{
    clientId: string;
    fullName: string;
    tradePointsCount: number;
    managerUserId: string;
    managerFullName: string;
    city: string;
  }>;
  cities: Array<{ city: string | null; clients: number; tradePoints: number }>;
  withoutCity: { clients: number; tradePoints: number };
  ropGroups: Array<{
    ropUserId: string | null;
    ropFullName: string;
    teamId: string | null;
    teamName: string;
    clients: number;
    tradePoints: number;
    potential: number;
    attention: number;
    managerCount: number;
    managersWithEmptyBase: number;
    managers: Array<{
      userId: string;
      fullName: string;
      active: number;
      tradePoints: number;
      segment: string | null;
      potential: number;
      attention: number;
    }>;
  }>;
};

export type ClientBaseManagerDetail = {
  success: true;
  manager: { userId: string; fullName: string; teamId: string | null; ropFullName: string };
  clients: Array<{
    id: string;
    fullName: string;
    inn: string | null;
    phone: string | null;
    legalEntity: boolean;
    city: string | null;
    status: "active" | "potential" | "attention";
    tradePointIds: string[];
    tradePointsCount: number;
    updatedAt: string | null;
    dealerProfileId: string | null;
  }>;
  tradePoints: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    clientId: string;
    hasPhoto: boolean;
    hasStorefront: boolean;
    updatedAt: string | null;
  }>;
};

export async function fetchClientBaseOverview(params: {
  teamId?: string;
  managerUserId?: string;
}): Promise<ClientBaseOverview> {
  const sp = new URLSearchParams();
  if (params.teamId) sp.set("teamId", params.teamId);
  if (params.managerUserId) sp.set("managerUserId", params.managerUserId);
  const qs = sp.toString();
  const res = await fetch(`/api/admin/client-base-overview${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as ClientBaseOverview | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error("message" in json && typeof json.message === "string" ? json.message : "Не удалось загрузить клиентскую базу.");
  }
  return json;
}

export async function fetchClientBaseManagerDetail(managerUserId: string): Promise<ClientBaseManagerDetail> {
  const res = await fetch(`/api/admin/client-base-manager-detail?managerUserId=${encodeURIComponent(managerUserId)}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as ClientBaseManagerDetail | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error("message" in json && typeof json.message === "string" ? json.message : "Не удалось загрузить менеджера.");
  }
  return json;
}
