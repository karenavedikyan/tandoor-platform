/**
 * Unified ROP / manager scope resolution for 1C store & legal rows (fuzzy names + parent-legal).
 */

import type { OneCShowroomContext, TeamRow } from "./one-c-showroom-context.js";

export type OneCStoreScopeInput = {
  legal_regional_manager_name: string | null;
  legal_responsible_manager_name: string | null;
  parent_regional_manager_name: string | null;
  parent_responsible_manager_name: string | null;
};

export type OneCStoreScopeResolved = {
  regional_manager_user_id: string | null;
  responsible_manager_user_id: string | null;
  rop_user_id: string | null;
  rop_name: string | null;
  effective_regional_manager_name: string | null;
  effective_responsible_manager_name: string | null;
};

function findTeamForUser(ctx: OneCShowroomContext, userId: string | null): TeamRow | null {
  if (!userId) return null;
  const u = ctx.usersById.get(userId);
  if (!u?.team_id) return null;
  return ctx.teams.find((t) => t.id === u.team_id) ?? null;
}

export function resolveOneCStoreScope(
  row: OneCStoreScopeInput,
  ctx: OneCShowroomContext,
): OneCStoreScopeResolved {
  const effRm =
    row.parent_regional_manager_name?.trim() || row.legal_regional_manager_name?.trim() || null;
  const effRes =
    row.parent_responsible_manager_name?.trim() ||
    row.legal_responsible_manager_name?.trim() ||
    null;

  const regional_manager_user_id = effRm ? (ctx.userIdByRegionalName.get(effRm) ?? null) : null;
  const responsible_manager_user_id = effRes
    ? (ctx.userIdByResponsibleName.get(effRes) ?? null)
    : null;

  let team: TeamRow | null = findTeamForUser(ctx, regional_manager_user_id);
  if (!team) {
    team = findTeamForUser(ctx, responsible_manager_user_id);
  }

  const rop_user_id = team?.rop_user_id ?? null;
  const rop_name = rop_user_id ? (ctx.usersById.get(rop_user_id)?.full_name ?? null) : null;

  return {
    regional_manager_user_id,
    responsible_manager_user_id,
    rop_user_id,
    rop_name,
    effective_regional_manager_name: effRm,
    effective_responsible_manager_name: effRes,
  };
}

export function scopeInputFromLegal(
  legal: {
    regional_manager_name: string | null;
    responsible_manager_name: string | null;
    parent_1c?: string | null;
  },
  ctx: OneCShowroomContext,
): OneCStoreScopeInput {
  const parent = legal.parent_1c ? ctx.legalById.get(legal.parent_1c) : undefined;
  return {
    legal_regional_manager_name: legal.regional_manager_name,
    legal_responsible_manager_name: legal.responsible_manager_name,
    parent_regional_manager_name: parent?.regional_manager_name ?? null,
    parent_responsible_manager_name: parent?.responsible_manager_name ?? null,
  };
}
