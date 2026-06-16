import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { hasManagerActualization } from "@/lib/client-base-actualization-visibility";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { deriveReleaseClientCategory, getClientCategoryLabel, type ClientCategoryId } from "@/lib/client-category";
import { getSalesUserById } from "@/lib/sales-control-data";
import {
  RELEASE_CLIENT_ROWS,
  type ReleaseClientNormalizedType,
  type ReleaseClientSeedRow,
} from "@/lib/release-client-seed.generated";
import { RELEASE_CLIENT_ROWS_KOTENEVA, type KotenevaTradePointStop } from "@/lib/release-client-seed-koteneva.generated";

const kotenevaCodes = new Set(RELEASE_CLIENT_ROWS_KOTENEVA.map((r) => r.code).filter(Boolean));
/** Основной сид без кодов, переопределённых импортом Котеневой (одна запись на код в объединённом списке). */
const BASE_RELEASE_CLIENT_ROWS: ReleaseClientSeedRow[] = RELEASE_CLIENT_ROWS.filter((r) => !r.code || !kotenevaCodes.has(r.code));

/** Клиенты основного сида + импорт Котеневой (Excel / JSON / служебный slice). */
const ALL_RELEASE_CLIENT_ROWS: ReleaseClient[] = [...BASE_RELEASE_CLIENT_ROWS, ...RELEASE_CLIENT_ROWS_KOTENEVA];

export type ReleaseClient = ReleaseClientSeedRow & { parsedTradePoints?: KotenevaTradePointStop[] };
export type { ReleaseClientNormalizedType };

export type ReleaseClientSearchFilters = {
  query?: string;
  teamId?: string;
  managerId?: string;
  /** Одиночный город (обратная совместимость). */
  city?: string;
  /** Мульти-выбор городов. Имеет приоритет над `city`. */
  cities?: string[];
  /** @deprecated предпочтительно clientCategory */
  clientType?: ReleaseClientNormalizedType | "all";
  /** Фильтр по бизнес-категории клиента (одиночный, обратная совместимость). */
  clientCategory?: ClientCategoryId | "all";
  /** Мульти-выбор бизнес-категорий. Имеет приоритет над `clientCategory`. */
  clientCategories?: ClientCategoryId[];
  priorityOnly?: boolean;
  activeOnly?: boolean;
  includeClosed?: boolean;
  /** Промт 349: закрытые seed-клиенты с актуализацией менеджера остаются в выдаче. */
  actualization?: ActualizationState | null;
};

export type ReleaseClientSummary = {
  total: number;
  active: number;
  priority: number;
  closed: number;
  unknownType: number;
};

export function getReleaseClients(): ReleaseClient[] {
  return ALL_RELEASE_CLIENT_ROWS;
}

export function getReleaseClientSummary(rows?: ReleaseClient[]): ReleaseClientSummary {
  const list = rows ?? ALL_RELEASE_CLIENT_ROWS;
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
  const catLabel = getClientCategoryLabel(deriveReleaseClientCategory(c)).toLowerCase();
  return c.searchText.includes(q) || catLabel.includes(q);
}

export function searchReleaseClients(filters: ReleaseClientSearchFilters, source?: ReleaseClient[]): ReleaseClient[] {
  const list = source ?? ALL_RELEASE_CLIENT_ROWS;
  const q = normQ(filters.query ?? "");
  const teamId = filters.teamId && filters.teamId !== "all" ? filters.teamId : undefined;
  const managerId = filters.managerId && filters.managerId !== "all" ? filters.managerId : undefined;
  const cities = filters.cities && filters.cities.length > 0 ? new Set(filters.cities) : null;
  const city = !cities && filters.city && filters.city !== "all" ? filters.city : undefined;
  const clientType = filters.clientType && filters.clientType !== "all" ? filters.clientType : undefined;
  const clientCategories =
    filters.clientCategories && filters.clientCategories.length > 0 ? new Set(filters.clientCategories) : null;
  const clientCategory =
    !clientCategories && filters.clientCategory && filters.clientCategory !== "all" ? filters.clientCategory : undefined;
  const priorityOnly = filters.priorityOnly === true;
  const activeOnly = filters.activeOnly === true;
  const includeClosed = filters.includeClosed === true;

  return list.filter((c) => {
    if (!matchesQuery(c, q)) return false;
    if (teamId && c.teamId !== teamId) return false;
    if (managerId && c.managerId !== managerId) return false;
    if (cities && !cities.has(c.city ?? "")) return false;
    if (city && c.city !== city) return false;
    if (clientCategories) {
      if (!clientCategories.has(deriveReleaseClientCategory(c))) return false;
    } else if (clientCategory && deriveReleaseClientCategory(c) !== clientCategory) {
      return false;
    }
    if (!clientCategory && !clientCategories && clientType && c.normalizedClientType !== clientType) return false;
    if (priorityOnly && !c.isPriority) return false;
    if (activeOnly && !c.isActive) return false;
    if (!includeClosed && c.isClosed && !hasManagerActualization(c.id, filters.actualization)) return false;
    return true;
  });
}

export function getReleaseClientsByManager(managerId: string): ReleaseClient[] {
  return ALL_RELEASE_CLIENT_ROWS.filter((c) => c.managerId === managerId);
}

export function getReleaseClientsByTeam(teamId: string): ReleaseClient[] {
  return ALL_RELEASE_CLIENT_ROWS.filter((c) => c.teamId === teamId);
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

export function getReleaseClientBusinessCategory(c: ReleaseClient): ClientCategoryId {
  return deriveReleaseClientCategory(c);
}

export function getReleaseClientBusinessCategoryLabel(c: ReleaseClient): string {
  return getClientCategoryLabel(deriveReleaseClientCategory(c));
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

/**
 * Фильтрация клиентов по разрешённым клиентским кодам, полученным с бэка
 * (/api/auth/my-visible-codes). Используется для РЕАЛЬНЫХ залогиненных юзеров.
 * Если codes === null → видны все (admin/director/analyst/marketer).
 */
export function filterReleaseClientsByVisibleCodes(rows: ReleaseClient[], codes: string[] | null): ReleaseClient[] {
  if (codes === null) return rows;
  const allow = new Set(codes);
  return rows.filter((c) => allow.has(c.code));
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
