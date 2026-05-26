import { getReleaseClients, type ReleaseClient } from "@/lib/release-client-data";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

export type ClientAssignmentLite = {
  code: string;
  responsibleUserId: string | null;
  teamId: string | null;
};

export function buildAssignmentsMap(
  assignments: ClientAssignmentLite[] | null | undefined,
): ReadonlyMap<string, { responsibleUserId: string | null; teamId: string | null }> {
  const m = new Map<string, { responsibleUserId: string | null; teamId: string | null }>();
  for (const a of assignments ?? []) {
    if (!a.code) continue;
    m.set(a.code, { responsibleUserId: a.responsibleUserId, teamId: a.teamId });
  }
  return m;
}

/**
 * Клиенты из сида, видимые текущему пользователю, с подстановкой UUID ответственного и команды из client_assignments.
 */
export function getVisibleReleaseClients(
  snap: OrgSnapshot,
  all: boolean,
  codes: string[] | null,
  assignments: ReadonlyMap<string, { responsibleUserId: string | null; teamId: string | null }> | null,
): ReleaseClient[] {
  const allRows = getReleaseClients();
  const filtered = all || codes === null ? allRows : allRows.filter((c) => codes.includes(c.code));
  if (!assignments || assignments.size === 0) return filtered;
  return filtered.map((c) => {
    const a = assignments.get(c.code);
    if (!a) return c;
    return {
      ...c,
      managerId: a.responsibleUserId ?? c.managerId,
      teamId: a.teamId ?? c.teamId,
    };
  });
}
