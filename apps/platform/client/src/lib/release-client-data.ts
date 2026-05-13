import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getSalesUserById } from "@/lib/sales-control-data";
import {
  RELEASE_CLIENT_ROWS,
  type ReleaseClientNormalizedType,
  type ReleaseClientSeedRow,
} from "@/lib/release-client-seed.generated";

export type ReleaseClient = ReleaseClientSeedRow;
export type { ReleaseClientNormalizedType };

export type ReleaseClientSearchFilters = {
  query?: string;
  teamId?: string;
  managerId?: string;
  city?: string;
  clientType?: ReleaseClientNormalizedType | "all";
  priorityOnly?: boolean;
  activeOnly?: boolean;
  includeClosed?: boolean;
};

export type ReleaseClientSummary = {
  total: number;
  active: number;
  priority: number;
  closed: number;
  unknownType: number;
};

export function getReleaseClients(): ReleaseClient[] {
  return RELEASE_CLIENT_ROWS;
}

export function getReleaseClientSummary(rows?: ReleaseClient[]): ReleaseClientSummary {
  const list = rows ?? RELEASE_CLIENT_ROWS;
  let active = 0;
  let priority = 0;
  let closed = 0;
  let unknownType = 0;
  for (const c of list) {
    if (c.isActive) active += 1;
    if (c.isPriority) priority += 1;
    if (c.isClosed) closed += 1;
    if (c.normalizedClientType === "unknown") unknownType += 1;
  }
  return { total: list.length, active, priority, closed, unknownType };
}

function normQ(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesQuery(c: ReleaseClient, q: string): boolean {
  if (!q) return true;
  return c.searchText.includes(q);
}

export function searchReleaseClients(filters: ReleaseClientSearchFilters, source?: ReleaseClient[]): ReleaseClient[] {
  const list = source ?? RELEASE_CLIENT_ROWS;
  const q = normQ(filters.query ?? "");
  const teamId = filters.teamId && filters.teamId !== "all" ? filters.teamId : undefined;
  const managerId = filters.managerId && filters.managerId !== "all" ? filters.managerId : undefined;
  const city = filters.city && filters.city !== "all" ? filters.city : undefined;
  const clientType = filters.clientType && filters.clientType !== "all" ? filters.clientType : undefined;
  const priorityOnly = filters.priorityOnly === true;
  const activeOnly = filters.activeOnly === true;
  const includeClosed = filters.includeClosed === true;

  return list.filter((c) => {
    if (!matchesQuery(c, q)) return false;
    if (teamId && c.teamId !== teamId) return false;
    if (managerId && c.managerId !== managerId) return false;
    if (city && c.city !== city) return false;
    if (clientType && c.normalizedClientType !== clientType) return false;
    if (priorityOnly && !c.isPriority) return false;
    if (activeOnly && !c.isActive) return false;
    if (!includeClosed && c.isClosed) return false;
    return true;
  });
}

export function getReleaseClientsByManager(managerId: string): ReleaseClient[] {
  return RELEASE_CLIENT_ROWS.filter((c) => c.managerId === managerId);
}

export function getReleaseClientsByTeam(teamId: string): ReleaseClient[] {
  return RELEASE_CLIENT_ROWS.filter((c) => c.teamId === teamId);
}

export function getReleaseClientTypeLabel(type: ReleaseClientNormalizedType): string {
  switch (type) {
    case "volume":
      return "Объемообразующий";
    case "top150":
      return "ТОП 150";
    case "top350":
      return "ТОП 350";
    case "top500":
      return "ТОП 500";
    case "active":
      return "Активный";
    case "potential":
      return "Потенциальный";
    case "closed":
      return "Закрытый";
    case "nonTarget":
      return "Нецелевой клиент";
    default:
      return "Без типа";
  }
}

export type ReleaseClientTypeTone = "default" | "secondary" | "destructive" | "outline";

export function getReleaseClientTypeTone(type: ReleaseClientNormalizedType): ReleaseClientTypeTone {
  if (type === "closed" || type === "nonTarget") return "destructive";
  if (type === "volume" || type === "top150" || type === "top350" || type === "top500") return "default";
  if (type === "active") return "secondary";
  if (type === "potential") return "outline";
  return "outline";
}

/** Ограничение видимости по демо-роли (без backend). */
export function filterReleaseClientsForDemoProfile(rows: ReleaseClient[], profile: ReleaseDemoProfile): ReleaseClient[] {
  if (profile.role === "sales_director" || profile.role === "analyst" || profile.role === "marketer") {
    return rows;
  }
  const persona = getSalesUserById(profile.personaUserId);
  if (profile.role === "team_lead" && persona?.teamId) {
    return rows.filter((c) => c.teamId === persona.teamId);
  }
  if (profile.role === "sales_manager" && persona?.role === "sales_manager") {
    return rows.filter((c) => c.managerId === persona.id);
  }
  return rows;
}

export function clientStatusLabel(c: ReleaseClient): string {
  if (c.isClosed) return "Закрытый";
  if (!c.isActive) return "Неактивен";
  if (c.isPriority) return "Приоритетный";
  return "Активный";
}

/** Источник координат на карте клиентов (см. release-client-address-coordinates.generated.ts). */
export type CoordinatesSource = "address" | "city" | "missing";

/**
 * Опциональные поля для карты: в seed не хранятся, могут появляться после слияния
 * с `RELEASE_CLIENT_ADDRESS_COORDINATES` или будущего импорта в тип строки.
 */
export type ReleaseClientOptionalMapCoords = {
  addressLat?: number;
  addressLng?: number;
  coordinatesSource?: CoordinatesSource;
};

export type ReleaseClientWithOptionalCoords = ReleaseClient & ReleaseClientOptionalMapCoords;
