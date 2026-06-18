/**
 * Промт 398: единая RBAC-модель корзины и архива (клиент + сервер).
 */
import type { UserRole } from "./auth.js";

export type TrashMeta = {
  trashedBy?: string | null;
  /** Исторический slug менеджера (до backfill uuid). */
  trashedBySlug?: string | null;
  ownerTeamAtTrash?: string | null;
  ownerCode?: string | null;
};

export type ArchiveMeta = {
  archivedBy?: string | null;
  ownerTeamAtArchive?: string | null;
  ownerCode?: string | null;
};

export type TeamContext = {
  teamId: string | null;
  teamMemberIds: string[];
  teamCodes: string[];
};

export type AssignmentsScopeLite = {
  ownCodes: Set<string>;
  teamCodes: Set<string>;
  grantedCodes?: Set<string>;
};

export type TrashArchiveScopeFilter = {
  fullView: boolean;
  isDealerInScope: (dealerId: string, meta?: TrashMeta | ArchiveMeta) => boolean;
  isTradePointInScope: (tpId: string, dealerId: string | null, meta?: TrashMeta | ArchiveMeta) => boolean;
};

const FULL_VIEW_ROLES: ReadonlySet<UserRole> = new Set(["admin", "director"]);
const TEAM_LEAD_ROLES: ReadonlySet<UserRole> = new Set(["rop", "regional_manager"]);

function normalizeCodeKeys(code: string): string[] {
  const c = code.trim();
  if (!c) return [];
  const keys = new Set<string>([c, c.toUpperCase(), c.toLowerCase()]);
  const without = c.replace(/^client-/i, "");
  if (without && without !== c) {
    keys.add(without);
    keys.add(without.toUpperCase());
    keys.add(without.toLowerCase());
  }
  return [...keys];
}

function buildCodeSet(codes: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of codes) {
    for (const k of normalizeCodeKeys(raw)) out.add(k);
  }
  return out;
}

function codeInSet(code: string | null | undefined, codes: Set<string>): boolean {
  if (!code?.trim()) return false;
  for (const k of normalizeCodeKeys(code)) {
    if (codes.has(k)) return true;
  }
  return false;
}

function dealerIdMatchesCodes(dealerId: string, codes: Set<string>): boolean {
  return codeInSet(dealerId, codes);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function managerTrashMatchesUser(
  meta: TrashMeta | undefined,
  userId: string | null,
  userSlug: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (meta?.trashedBy === userId) return true;
  const slug = meta?.trashedBySlug?.trim();
  if (slug && userSlug && slug === userSlug.trim()) return true;
  if (meta?.trashedBy && !isUuidLike(meta.trashedBy) && userSlug && meta.trashedBy.trim() === userSlug.trim()) {
    return true;
  }
  return false;
}

export function buildTrashScopeFilterRbac(opts: {
  role: UserRole | null;
  userId: string | null;
  userSlug?: string | null;
  teamContext: TeamContext;
}): TrashArchiveScopeFilter {
  const { role, userId, userSlug, teamContext } = opts;

  if (!role || FULL_VIEW_ROLES.has(role)) {
    return {
      fullView: true,
      isDealerInScope: () => true,
      isTradePointInScope: () => true,
    };
  }

  if (TEAM_LEAD_ROLES.has(role)) {
    const memberSet = new Set(teamContext.teamMemberIds);
    if (userId) memberSet.add(userId);
    const teamId = teamContext.teamId;
    return {
      fullView: false,
      isDealerInScope: (_id, meta) => {
        const m = meta as TrashMeta | undefined;
        if (m?.trashedBy && memberSet.has(m.trashedBy)) return true;
        if (teamId && m?.ownerTeamAtTrash === teamId) return true;
        return false;
      },
      isTradePointInScope: (_tpId, _dealerId, meta) => {
        const m = meta as TrashMeta | undefined;
        if (m?.trashedBy && memberSet.has(m.trashedBy)) return true;
        if (teamId && m?.ownerTeamAtTrash === teamId) return true;
        return false;
      },
    };
  }

  return {
    fullView: false,
    isDealerInScope: (_id, meta) => managerTrashMatchesUser(meta as TrashMeta | undefined, userId, userSlug),
    isTradePointInScope: (_tpId, _dealerId, meta) =>
      managerTrashMatchesUser(meta as TrashMeta | undefined, userId, userSlug),
  };
}

export function buildArchiveScopeFilterRbac(opts: {
  role: UserRole | null;
  assignmentsScope: AssignmentsScopeLite | undefined;
  teamContext: TeamContext;
}): TrashArchiveScopeFilter {
  const { role, assignmentsScope, teamContext } = opts;

  if (!role || FULL_VIEW_ROLES.has(role)) {
    return {
      fullView: true,
      isDealerInScope: () => true,
      isTradePointInScope: () => true,
    };
  }

  if (TEAM_LEAD_ROLES.has(role)) {
    const codeSet = buildCodeSet(teamContext.teamCodes);
    const teamId = teamContext.teamId;
    return {
      fullView: false,
      isDealerInScope: (dealerId, meta) => {
        const m = meta as ArchiveMeta | undefined;
        if (m?.ownerCode && codeInSet(m.ownerCode, codeSet)) return true;
        if (teamId && m?.ownerTeamAtArchive === teamId) return true;
        return dealerIdMatchesCodes(dealerId, codeSet);
      },
      isTradePointInScope: (tpId, dealerId, meta) => {
        const m = meta as ArchiveMeta | undefined;
        if (dealerId && codeInSet(m?.ownerCode ?? null, codeSet)) return true;
        if (teamId && m?.ownerTeamAtArchive === teamId) return true;
        if (dealerId && dealerIdMatchesCodes(dealerId, codeSet)) return true;
        return dealerIdMatchesCodes(tpId, codeSet);
      },
    };
  }

  const myCodes = buildCodeSet(assignmentsScope?.ownCodes ?? []);
  const granted = buildCodeSet(assignmentsScope?.grantedCodes ?? []);
  const allMy = new Set([...myCodes, ...granted]);

  return {
    fullView: false,
    isDealerInScope: (dealerId, meta) => {
      const m = meta as ArchiveMeta | undefined;
      if (m?.ownerCode && codeInSet(m.ownerCode, allMy)) return true;
      return dealerIdMatchesCodes(dealerId, allMy);
    },
    isTradePointInScope: (tpId, dealerId, meta) => {
      const m = meta as ArchiveMeta | undefined;
      if (m?.ownerCode && codeInSet(m.ownerCode, allMy)) return true;
      if (dealerId && dealerIdMatchesCodes(dealerId, allMy)) return true;
      return dealerIdMatchesCodes(tpId, allMy);
    },
  };
}

export function trashMetaFromRecord(rec: {
  trashedBy?: string;
  ownerTeamAtTrash?: string | null;
  ownerCode?: string | null;
  snapshot?: { dealerCode?: string | null };
}): TrashMeta {
  const trashedBy = rec.trashedBy ?? null;
  const trashedBySlug =
    trashedBy && !isUuidLike(trashedBy) ? trashedBy.trim() : null;
  return {
    trashedBy,
    trashedBySlug,
    ownerTeamAtTrash: rec.ownerTeamAtTrash ?? null,
    ownerCode: rec.ownerCode ?? rec.snapshot?.dealerCode ?? null,
  };
}

export function archiveMetaFromRecord(rec: {
  archivedBy?: string;
  ownerTeamAtArchive?: string | null;
  ownerCode?: string | null;
}): ArchiveMeta {
  return {
    archivedBy: rec.archivedBy ?? null,
    ownerTeamAtArchive: rec.ownerTeamAtArchive ?? null,
    ownerCode: rec.ownerCode ?? null,
  };
}

export function canMutateTrashEntry(
  role: UserRole,
  userId: string,
  teamContext: TeamContext,
  meta: TrashMeta,
): boolean {
  const filter = buildTrashScopeFilterRbac({ role, userId, teamContext });
  if (filter.fullView) return true;
  return filter.isDealerInScope("", meta);
}

export function canMutateArchiveEntry(
  role: UserRole,
  assignmentsScope: AssignmentsScopeLite | undefined,
  teamContext: TeamContext,
  dealerId: string,
  meta: ArchiveMeta,
): boolean {
  const filter = buildArchiveScopeFilterRbac({ role, assignmentsScope, teamContext });
  if (filter.fullView) return true;
  return filter.isDealerInScope(dealerId, meta);
}

export function normalizePlatformRole(role: string | null | undefined): UserRole {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (r === "director" || r === "sales_director") return "director";
  if (r === "rop" || r === "team_lead") return "rop";
  if (r === "regional_manager") return "regional_manager";
  if (r === "category_manager") return "category_manager";
  if (r === "manager" || r === "sales_manager") return "manager";
  return "manager";
}

export const EMPTY_TEAM_CONTEXT: TeamContext = {
  teamId: null,
  teamMemberIds: [],
  teamCodes: [],
};
