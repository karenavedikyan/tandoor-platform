export type ActualizationStatsOverview = {
  success: true;
  generatedAt: string;
  period: { fromIso: string; toIso: string };
  totals: {
    clientsAdded: number;
    tradePointsAdded: number;
    activeManagers: number;
    inactiveManagers: number;
    totalManagers: number;
  };
  ropRanking: Array<{
    ropUserId: string | null;
    ropFullName: string;
    teamId: string | null;
    teamName: string;
    totalAdded: number;
    clientsAdded: number;
    tradePointsAdded: number;
    activeManagers: number;
    inactiveManagers: number;
    leaderUserId: string | null;
    leaderFullName: string | null;
    leaderTotal: number;
    managerCount: number;
  }>;
  dynamicsByDay: Array<{ dateIso: string; clients: number; tradePoints: number }>;
  managersChart: Array<{ userId: string; fullName: string; clients: number; tradePoints: number }>;
  scoreByManager: Array<{
    userId: string;
    fullName: string;
    score: number;
    factors: { clientsAdded: number; tpAdded: number; updates: number; lastActivityHours: number };
  }>;
  actionStructure: { items: Array<{ type: string; count: number }> };
  baseQuality: {
    clientsTotal: number;
    clientsWithInn: number;
    clientsWithPhone: number;
    clientsWithLegalEntity: number;
    clientsWithTradePoint: number;
    tradePointsTotal: number;
    tradePointsWithAddress: number;
    tradePointsWithPhoto: number;
    tradePointsWithStorefront: number;
  };
  problemZones: {
    inactiveManagers: Array<{ userId: string; fullName: string; teamName: string; lastActivityIso: string | null }>;
    clientsWithoutInn: Array<{ clientId: string; fullName: string; managerUserId: string; managerFullName: string }>;
    clientsWithoutPhone: Array<{ clientId: string; fullName: string; managerUserId: string; managerFullName: string }>;
    clientsWithoutLegalEntity: Array<{ clientId: string; fullName: string; managerUserId: string; managerFullName: string }>;
    tradePointsWithoutAddress: Array<{ id: string; name: string; managerFullName: string }>;
    tradePointsWithoutPhoto: Array<{ id: string; name: string; managerFullName: string }>;
  };
  managersFeed: Array<{
    userId: string;
    fullName: string;
    teamId: string | null;
    teamName: string;
    ropUserId: string | null;
    ropFullName: string;
    clientsTotal: number;
    tpTotal: number;
    updates: number;
    lastActivityIso: string | null;
    status: "active" | "weak" | "none";
  }>;
};

export async function fetchActualizationStatsOverview(params: {
  fromIso?: string;
  toIso?: string;
  teamId?: string;
  managerUserId?: string;
}): Promise<ActualizationStatsOverview> {
  const sp = new URLSearchParams();
  if (params.fromIso) sp.set("fromIso", params.fromIso);
  if (params.toIso) sp.set("toIso", params.toIso);
  if (params.teamId) sp.set("teamId", params.teamId);
  if (params.managerUserId) sp.set("managerUserId", params.managerUserId);
  const qs = sp.toString();
  const res = await fetch(`/api/admin/actualization-stats-overview${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as ActualizationStatsOverview | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error("message" in json && typeof json.message === "string" ? json.message : "Не удалось загрузить статистику.");
  }
  return json;
}
