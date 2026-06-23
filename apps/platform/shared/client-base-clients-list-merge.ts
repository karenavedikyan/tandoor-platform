/**
 * Слияние каталожного scope и actualization для списка KPI клиентской базы.
 */

export type ClientBaseListStatus = "active" | "potential" | "attention" | null;

export type ClientBaseCatalogDealerMeta = {
  externalKey: string;
  fullName: string;
  city: string | null;
  managerUserId: string | null;
  managerFullName: string | null;
  inn: string | null;
  phone: string | null;
  legalEntity: boolean;
  tradePointIds: string[];
  tradePointsCount: number;
};

export type ClientBaseActualizationClient = {
  id: string;
  fullName: string;
  city: string | null;
  managerUserId: string | null;
  managerFullName: string | null;
  inn: string | null;
  phone: string | null;
  legalEntity: boolean;
  normalizedStatus: "active" | "potential" | "attention" | "archived";
  updatedAt: string | null;
  tradePointIds: string[];
};

export type ClientBaseClientsListClient = {
  id: string;
  fullName: string;
  inn: string | null;
  phone: string | null;
  legalEntity: boolean;
  city: string | null;
  status: ClientBaseListStatus;
  managerUserId: string | null;
  managerFullName: string | null;
  tradePointIds: string[];
  tradePointsCount: number;
  updatedAt: string | null;
  inCatalog: boolean;
};

export function resolveClientExternalKey(id: string, catalogKeys: Set<string>): string {
  if (catalogKeys.has(id)) return id;
  if (id.startsWith("client-")) {
    const stripped = id.slice("client-".length);
    if (catalogKeys.has(stripped)) return stripped;
  }
  return id;
}

export function effectiveClientListStatus(
  normalized: "active" | "potential" | "attention" | "archived",
  updatedAt: string | null,
  staleCutoffMs: number,
): ClientBaseListStatus | "skip" {
  if (normalized === "archived") return "skip";
  if (normalized === "attention" || (updatedAt != null && Date.parse(updatedAt) < staleCutoffMs)) {
    return "attention";
  }
  if (normalized === "potential") return "potential";
  if (normalized === "active") return "active";
  return "active";
}

export function mergeClientBaseClientsList(params: {
  catalogKeys: Set<string>;
  catalogMeta: Map<string, ClientBaseCatalogDealerMeta>;
  actualizationClients: ClientBaseActualizationClient[];
  staleCutoffMs: number;
}): ClientBaseClientsListClient[] {
  const { catalogKeys, catalogMeta, actualizationClients, staleCutoffMs } = params;
  const actualByKey = new Map<string, ClientBaseActualizationClient>();
  for (const ac of actualizationClients) {
    const key = resolveClientExternalKey(ac.id, catalogKeys);
    const prev = actualByKey.get(key);
    if (!prev || (ac.updatedAt ?? "") > (prev.updatedAt ?? "")) {
      actualByKey.set(key, { ...ac, id: key });
    }
  }

  const out = new Map<string, ClientBaseClientsListClient>();

  for (const key of catalogKeys) {
    const meta = catalogMeta.get(key);
    const ac = actualByKey.get(key);
    const status = ac
      ? effectiveClientListStatus(ac.normalizedStatus, ac.updatedAt, staleCutoffMs)
      : null;
    if (status === "skip") continue;
    const tpIds = new Set<string>([...(meta?.tradePointIds ?? []), ...(ac?.tradePointIds ?? [])]);
    out.set(key, {
      id: key,
      fullName: ac?.fullName ?? meta?.fullName ?? key,
      inn: ac?.inn ?? meta?.inn ?? null,
      phone: ac?.phone ?? meta?.phone ?? null,
      legalEntity: ac?.legalEntity ?? meta?.legalEntity ?? false,
      city: ac?.city ?? meta?.city ?? null,
      status: status === "skip" ? null : status,
      managerUserId: ac?.managerUserId ?? meta?.managerUserId ?? null,
      managerFullName: ac?.managerFullName ?? meta?.managerFullName ?? null,
      tradePointIds: Array.from(tpIds),
      tradePointsCount: tpIds.size || meta?.tradePointsCount || ac?.tradePointIds.length || 0,
      updatedAt: ac?.updatedAt ?? null,
      inCatalog: true,
    });
  }

  for (const ac of actualizationClients) {
    const key = resolveClientExternalKey(ac.id, catalogKeys);
    if (out.has(key)) continue;
    const status = effectiveClientListStatus(ac.normalizedStatus, ac.updatedAt, staleCutoffMs);
    if (status === "skip") continue;
    out.set(key, {
      id: key,
      fullName: ac.fullName,
      inn: ac.inn,
      phone: ac.phone,
      legalEntity: ac.legalEntity,
      city: ac.city,
      status,
      managerUserId: ac.managerUserId,
      managerFullName: ac.managerFullName,
      tradePointIds: ac.tradePointIds,
      tradePointsCount: ac.tradePointIds.length,
      updatedAt: ac.updatedAt,
      inCatalog: catalogKeys.has(key),
    });
  }

  return Array.from(out.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
}

export function countClientsByListStatus(clients: ClientBaseClientsListClient[]): {
  all: number;
  active: number;
  potential: number;
  attention: number;
  noStatus: number;
} {
  const inCatalog = clients.filter((c) => c.inCatalog);
  const active = clients.filter((c) => c.status === "active").length;
  const potential = clients.filter((c) => c.status === "potential").length;
  const attention = clients.filter((c) => c.status === "attention").length;
  const noStatus = inCatalog.filter((c) => c.status !== "active" && c.status !== "potential").length;
  return {
    all: inCatalog.length,
    active,
    potential,
    attention,
    noStatus,
  };
}
