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
    /** Промт 44 — ТТ-проблемные записи теперь содержат `clientId` / `dealerProfileId` для прохода в карточку клиента. */
    tradePointsWithoutAddress: Array<{
      id: string;
      name: string;
      managerFullName: string;
      clientId?: string | null;
      dealerProfileId?: string | null;
    }>;
    tradePointsWithoutPhoto: Array<{
      id: string;
      name: string;
      managerFullName: string;
      clientId?: string | null;
      dealerProfileId?: string | null;
    }>;
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

/** Промт 44 — детальная активность менеджера за период (Sheet «Активность менеджера»). */
export type ManagerActivityDetailClient = {
  id: string;
  fullName: string;
  inn: string | null;
  phone: string | null;
  legalEntity: boolean;
  city: string | null;
  status: "active" | "potential" | "attention";
  tradePointsCount: number;
  dealerProfileId: string | null;
  addedAtIso: string | null;
  updatedAtIso: string | null;
  problems: {
    noInn: boolean;
    noPhone: boolean;
    noLegalEntity: boolean;
    noTradePoint: boolean;
  };
};

export type ManagerActivityDetailTp = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  hasPhoto: boolean;
  notFilled: boolean;
  clientId: string;
  clientFullName: string;
  clientDealerProfileId: string | null;
  addedAtIso: string | null;
  updatedAtIso: string | null;
  problems: { noAddress: boolean; noPhoto: boolean };
};

export type ManagerActivityDetail = {
  success: true;
  manager: {
    userId: string;
    fullName: string;
    teamId: string | null;
    teamName: string;
    ropFullName: string;
  };
  period: { fromIso: string; toIso: string };
  stats: {
    clientsAdded: number;
    clientsUpdated: number;
    tradePointsAdded: number;
    tradePointsUpdated: number;
    lastActivityIso: string | null;
    score: number;
  };
  clients: ManagerActivityDetailClient[];
  tradePoints: ManagerActivityDetailTp[];
};

export async function fetchManagerActivityDetail(params: {
  managerUserId: string;
  fromIso?: string;
  toIso?: string;
}): Promise<ManagerActivityDetail> {
  const sp = new URLSearchParams();
  sp.set("managerUserId", params.managerUserId);
  if (params.fromIso) sp.set("fromIso", params.fromIso);
  if (params.toIso) sp.set("toIso", params.toIso);
  const res = await fetch(`/api/admin/manager-activity-detail?${sp.toString()}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as ManagerActivityDetail | { success?: false; message?: string };
  if (!res.ok || json.success !== true) {
    throw new Error(
      "message" in json && typeof json.message === "string"
        ? json.message
        : "Не удалось загрузить активность менеджера.",
    );
  }
  return json;
}
