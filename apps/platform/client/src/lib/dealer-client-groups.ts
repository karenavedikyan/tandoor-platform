import type { DealerRow } from "@/lib/dealer-base-mock-data";

export const DEALER_CLIENT_GROUPS_STORAGE_KEY = "tandoor-dealer-client-groups-v1";
export const DEALER_CLIENT_GROUPS_EVENT = "tandoor-dealer-client-groups-changed";

export type DealerClientGroup = {
  id: string;
  name: string;
  dealerIds: string[];
  primaryDealerId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string;
  note?: string;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
};

type DealerClientGroupsState = {
  groupsByUser: Record<string, Record<string, DealerClientGroup>>;
};

export type DealerListRow = DealerRow & {
  _clientGroup?: DealerClientGroup;
};

function emptyState(): DealerClientGroupsState {
  return { groupsByUser: {} };
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEALER_CLIENT_GROUPS_EVENT));
}

export function loadDealerClientGroupsState(): DealerClientGroupsState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_CLIENT_GROUPS_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as DealerClientGroupsState;
    if (!parsed || typeof parsed !== "object" || !parsed.groupsByUser || typeof parsed.groupsByUser !== "object") {
      return emptyState();
    }
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveDealerClientGroupsState(state: DealerClientGroupsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEALER_CLIENT_GROUPS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  dispatchChanged();
}

export function getDealerClientGroups(userId: string): DealerClientGroup[] {
  const st = loadDealerClientGroupsState();
  const byId = st.groupsByUser[userId];
  if (!byId) return [];
  return Object.values(byId);
}

export function getActiveDealerClientGroups(userId: string): DealerClientGroup[] {
  return getDealerClientGroups(userId).filter((g) => !g.archivedAt);
}

export function findDealerClientGroupByDealerId(userId: string, dealerId: string): DealerClientGroup | undefined {
  return getActiveDealerClientGroups(userId).find((g) => g.dealerIds.includes(dealerId));
}

export function findDealerClientGroupById(userId: string, groupId: string): DealerClientGroup | undefined {
  const st = loadDealerClientGroupsState();
  return st.groupsByUser[userId]?.[groupId];
}

export function suggestDealerClientGroupName(firstRow: DealerRow): string {
  let n = firstRow.name.trim();
  n = n.replace(/\s*\([^)]*ИП[^)]*\)\s*$/i, "").trim();
  return n || firstRow.name.trim();
}

export function formatGroupCodesLine(group: DealerClientGroup, rowsById: Map<string, DealerRow>): string {
  return group.dealerIds
    .map((id) => {
      const r = rowsById.get(id);
      const c = r?.releaseCode?.trim();
      return c && c.length > 0 ? c : id;
    })
    .join(" · ");
}

/** Строка для текстового поиска по карточке (без группы). */
export function dealerRowSearchHaystack(row: DealerRow): string {
  return [
    row.name,
    row.city,
    row.manager,
    row.regionalManager,
    row.releaseCode ?? "",
    row.releaseAddress ?? "",
    row.clientTypeLabel ?? "",
    row.id,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Текстовый поиск с учётом активной группы: совпадение по любому участнику.
 */
export function rowMatchesClientBaseSearch(
  row: DealerRow,
  searchLower: string,
  userId: string,
  allById: Map<string, DealerRow>,
): boolean {
  if (!searchLower.trim()) return true;
  const q = searchLower.trim().toLowerCase();
  const g = findDealerClientGroupByDealerId(userId, row.id);
  const ids = g && !g.archivedAt ? g.dealerIds : [row.id];
  for (const id of ids) {
    const r = id === row.id ? row : allById.get(id);
    if (!r) continue;
    if (dealerRowSearchHaystack(r).includes(q)) return true;
  }
  return false;
}

export function getDealerClientGroupDisplayRow(group: DealerClientGroup, primaryRow: DealerRow): DealerListRow {
  return {
    ...primaryRow,
    name: group.name,
    _clientGroup: group,
  };
}

/**
 * После обычной фильтрации: сворачивает участников активных групп в одну строку (primary).
 * Порядок: первая по списку `filteredRows` встреча участника группы задаёт позицию строки.
 */
export function collapseRowsByClientGroups(
  filteredRows: DealerRow[],
  userId: string,
  allRowsById: Map<string, DealerRow>,
): DealerListRow[] {
  const groups = getActiveDealerClientGroups(userId);
  if (groups.length === 0) return filteredRows;

  const dealerToGroup = new Map<string, DealerClientGroup>();
  for (const g of groups) {
    for (const id of g.dealerIds) {
      if (!dealerToGroup.has(id)) dealerToGroup.set(id, g);
    }
  }

  const inList = new Set(filteredRows.map((r) => r.id));
  const firstIndexByGroup = new Map<string, number>();
  for (let i = 0; i < filteredRows.length; i++) {
    const g = dealerToGroup.get(filteredRows[i].id);
    if (!g) continue;
    const prev = firstIndexByGroup.get(g.id);
    if (prev === undefined || i < prev) firstIndexByGroup.set(g.id, i);
  }

  const out: DealerListRow[] = [];
  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i];
    const g = dealerToGroup.get(row.id);
    if (!g) {
      out.push(row);
      continue;
    }
    if (firstIndexByGroup.get(g.id) !== i) continue;
    const primary = allRowsById.get(g.primaryDealerId) ?? row;
    const membersInFilter = g.dealerIds.filter((id) => inList.has(id));
    if (membersInFilter.length === 0) continue;
    out.push(getDealerClientGroupDisplayRow(g, primary));
  }
  return out;
}

export function createDealerClientGroup(args: {
  userId: string;
  userName: string;
  name: string;
  dealerIds: string[];
  primaryDealerId: string;
  note?: string;
}): DealerClientGroup {
  const now = new Date().toISOString();
  const id = `dcg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const dealerIds = Array.from(new Set(args.dealerIds.map((x) => x.trim()).filter(Boolean)));
  const g: DealerClientGroup = {
    id,
    name: args.name.trim(),
    dealerIds,
    primaryDealerId: args.primaryDealerId.trim(),
    createdAt: now,
    updatedAt: now,
    createdBy: args.userId,
    createdByName: args.userName,
    note: args.note?.trim() || undefined,
  };
  const st = loadDealerClientGroupsState();
  const userMap = { ...(st.groupsByUser[args.userId] ?? {}) };
  userMap[g.id] = g;
  st.groupsByUser[args.userId] = userMap;
  saveDealerClientGroupsState(st);
  return g;
}

export function updateDealerClientGroup(
  userId: string,
  groupId: string,
  patch: Partial<Pick<DealerClientGroup, "name" | "primaryDealerId" | "note" | "dealerIds">>,
): DealerClientGroup | undefined {
  const st = loadDealerClientGroupsState();
  const g = st.groupsByUser[userId]?.[groupId];
  if (!g || g.archivedAt) return undefined;
  const next: DealerClientGroup = {
    ...g,
    ...patch,
    dealerIds: patch.dealerIds ? Array.from(new Set(patch.dealerIds)) : g.dealerIds,
    name: patch.name != null ? patch.name.trim() : g.name,
    primaryDealerId: patch.primaryDealerId != null ? patch.primaryDealerId.trim() : g.primaryDealerId,
    note: patch.note !== undefined ? patch.note?.trim() || undefined : g.note,
    updatedAt: new Date().toISOString(),
  };
  st.groupsByUser[userId] = { ...(st.groupsByUser[userId] ?? {}), [groupId]: next };
  saveDealerClientGroupsState(st);
  return next;
}

export function archiveDealerClientGroup(userId: string, groupId: string, archivedBy: string, reason?: string): void {
  const st = loadDealerClientGroupsState();
  const g = st.groupsByUser[userId]?.[groupId];
  if (!g || g.archivedAt) return;
  const now = new Date().toISOString();
  const next: DealerClientGroup = {
    ...g,
    archivedAt: now,
    archivedBy,
    archiveReason: reason?.trim() || undefined,
    updatedAt: now,
  };
  st.groupsByUser[userId] = { ...(st.groupsByUser[userId] ?? {}), [groupId]: next };
  saveDealerClientGroupsState(st);
}

export function ungroupDealerClientGroup(userId: string, groupId: string, archivedBy: string, reason?: string): void {
  archiveDealerClientGroup(userId, groupId, archivedBy, reason ?? "Разъединение группы");
}
