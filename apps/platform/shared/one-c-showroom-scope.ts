/**
 * Assignment-based visibility scope for /1c/* showroom.
 */

import type { PoolLike } from "../server/db/neon-client.js";
import { fetchStoreLegalManagerNames } from "./one-c-distribution-permissions.js";
import {
  storeIdsForRegionalNames,
  storeIdsForResponsibleNames,
  teamContextForUser,
  type OneCShowroomContext,
  type OneCRopNode,
} from "./one-c-showroom-context.js";

export type OneCScope = {
  /** null = без ограничений (admin/director). */
  responsibleNames: string[] | null;
  regionalNames: string[] | null;
};

export type OneCViewer = { id: string; role: string };

export function resolveOneCScope(role: string, userId: string, ctx: OneCShowroomContext): OneCScope {
  if (role === "admin" || role === "director") {
    return { responsibleNames: null, regionalNames: null };
  }

  const user = ctx.usersById.get(userId);
  if (!user) return { responsibleNames: [], regionalNames: [] };

  if (role === "manager") {
    return {
      responsibleNames: ctx.matchedResponsibleByUserId.get(userId) ?? [],
      regionalNames: [],
    };
  }

  if (role === "regional_manager" || role === "rm") {
    const regNames = ctx.matchedRegionalByUserId.get(userId) ?? [];
    const team = ctx.teams.find((t) => t.id === user.team_id);
    const teamManagerIds = team
      ? Array.from(ctx.usersById.values())
          .filter((u) => u.team_id === team.id && u.role_in_team === "manager")
          .map((u) => u.id)
      : [];
    const respNames = teamManagerIds.flatMap((mid) => ctx.matchedResponsibleByUserId.get(mid) ?? []);
    return { responsibleNames: respNames, regionalNames: regNames };
  }

  if (role === "rop") {
    const { team, rms } = teamContextForUser(userId, ctx);
    if (!team) return { responsibleNames: [], regionalNames: [] };
    const teamManagerIds = Array.from(ctx.usersById.values())
      .filter((u) => u.team_id === team.id && u.role_in_team === "manager")
      .map((u) => u.id);
    const respNames = teamManagerIds.flatMap((mid) => ctx.matchedResponsibleByUserId.get(mid) ?? []);
    const regNames = rms.flatMap((rm) => ctx.matchedRegionalByUserId.get(rm.id) ?? []);
    return { responsibleNames: respNames, regionalNames: regNames };
  }

  return { responsibleNames: [], regionalNames: [] };
}

export function scopeIsUnrestricted(scope: OneCScope): boolean {
  return scope.responsibleNames == null && scope.regionalNames == null;
}

export function scopeWhereClause(
  scope: OneCScope,
  respCol: string,
  regCol: string,
  paramStartIdx: number,
): { sql: string; params: unknown[] } {
  if (scopeIsUnrestricted(scope)) {
    return { sql: "", params: [] };
  }
  const respNames = scope.responsibleNames ?? [];
  const regNames = scope.regionalNames ?? [];
  if (respNames.length === 0 && regNames.length === 0) {
    return { sql: " AND FALSE", params: [] };
  }
  const parts: string[] = [];
  const params: unknown[] = [];
  if (respNames.length > 0) {
    parts.push(`${respCol} = ANY($${paramStartIdx + params.length}::text[])`);
    params.push(respNames);
  }
  if (regNames.length > 0) {
    parts.push(`${regCol} = ANY($${paramStartIdx + params.length}::text[])`);
    params.push(regNames);
  }
  return { sql: ` AND (${parts.join(" OR ")})`, params };
}

export function legalMatchesScope(
  legal: { regional_manager_name: string | null; responsible_manager_name: string | null },
  scope: OneCScope,
): boolean {
  if (scopeIsUnrestricted(scope)) return true;
  const resp = legal.responsible_manager_name;
  const reg = legal.regional_manager_name;
  const respNames = scope.responsibleNames ?? [];
  const regNames = scope.regionalNames ?? [];
  if (resp && respNames.includes(resp)) return true;
  if (reg && regNames.includes(reg)) return true;
  return false;
}

export function storeIdsForScope(scope: OneCScope, ctx: OneCShowroomContext): Set<string> {
  if (scopeIsUnrestricted(scope)) {
    return new Set(ctx.storeRows.map((s) => s.id_1c));
  }
  const ids = new Set<string>();
  for (const id of storeIdsForResponsibleNames(scope.responsibleNames ?? [], ctx)) ids.add(id);
  for (const id of storeIdsForRegionalNames(scope.regionalNames ?? [], ctx)) ids.add(id);
  return ids;
}

export function legalIdsForScope(scope: OneCScope, ctx: OneCShowroomContext): Set<string> {
  if (scopeIsUnrestricted(scope)) {
    return new Set(ctx.legalById.keys());
  }
  const ids = new Set<string>();
  for (const l of ctx.legalById.values()) {
    if (legalMatchesScope(l, scope)) ids.add(l.id_1c);
  }
  return ids;
}

export async function isStoreInOneCScope(
  pool: PoolLike,
  storeId1c: string,
  scope: OneCScope,
  ctx?: OneCShowroomContext,
): Promise<boolean> {
  if (scopeIsUnrestricted(scope)) return true;
  const names = await fetchStoreLegalManagerNames(pool, storeId1c);
  if (!names) return false;
  return legalMatchesScope(names, scope);
}

export function canViewOneCTeamMember(
  viewerRole: string,
  viewerUserId: string,
  targetUserId: string,
  pageKind: "rop" | "rm" | "manager",
  ctx: OneCShowroomContext,
): boolean {
  if (viewerRole === "admin" || viewerRole === "director") return true;

  if (viewerRole === "manager") {
    return pageKind === "manager" && viewerUserId === targetUserId;
  }

  if (viewerRole === "regional_manager" || viewerRole === "rm") {
    if (pageKind === "rm" && viewerUserId === targetUserId) return true;
    if (pageKind === "manager") {
      const viewer = ctx.usersById.get(viewerUserId);
      const target = ctx.usersById.get(targetUserId);
      return (
        !!viewer &&
        !!target &&
        target.role_in_team === "manager" &&
        target.team_id === viewer.team_id
      );
    }
    return false;
  }

  if (viewerRole === "rop") {
    const team = ctx.teams.find((t) => t.rop_user_id === viewerUserId);
    if (!team) return false;
    const target = ctx.usersById.get(targetUserId);
    if (!target || target.team_id !== team.id) return false;
    if (pageKind === "rop") return viewerUserId === targetUserId;
    if (pageKind === "rm") return target.role_in_team === "regional_manager";
    if (pageKind === "manager") return target.role_in_team === "manager";
  }

  return false;
}

export function filterHierarchyForViewer(
  items: OneCRopNode[],
  viewerRole: string,
  viewerUserId: string,
  ctx: OneCShowroomContext,
): OneCRopNode[] {
  if (viewerRole === "admin" || viewerRole === "director") return items;

  if (viewerRole === "rop") {
    return items.filter((n) => n.userId === viewerUserId);
  }

  if (viewerRole === "regional_manager" || viewerRole === "rm") {
    const user = ctx.usersById.get(viewerUserId);
    if (!user) return [];
    return items
      .filter((n) => n.teamId === user.team_id)
      .map((n) => ({
        ...n,
        rms: n.rms.filter((rm) => rm.userId === viewerUserId),
        managers: n.managers,
      }));
  }

  if (viewerRole === "manager") {
    return [];
  }

  return [];
}
