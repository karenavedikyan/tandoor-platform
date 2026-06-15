/**
 * POST /api/_diag/real-scope-audit — append-only телеметрия Промта 338.
 */

import type { PoolLike } from "./admin/admin-auth.js";

export type RealScopeAuditPayloadEvent = {
  callSite: string;
  profileRole: string;
  personaUserId: string;
  realUserId?: string | null;
  reason: string;
  eventCount?: number;
};

export type RealScopeAuditPayload = {
  events: RealScopeAuditPayloadEvent[];
  userId?: string | null;
  timestamp?: number;
};

export function isDiagAuditEnabled(): boolean {
  return process.env.DIAG_AUDIT_ENABLED === "1";
}

export async function persistRealScopeAuditBatch(
  pool: PoolLike,
  payload: RealScopeAuditPayload,
): Promise<void> {
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (events.length === 0) return;

  const userId = payload.userId?.trim() || null;

  for (const e of events) {
    const callSite = String(e.callSite ?? "").trim();
    const profileRole = String(e.profileRole ?? "").trim();
    const personaUserId = String(e.personaUserId ?? "").trim();
    const reason = String(e.reason ?? "").trim();
    if (!callSite || !profileRole || !personaUserId || !reason) continue;

    const eventCount = Number.isFinite(e.eventCount) && (e.eventCount ?? 0) > 0 ? Math.floor(e.eventCount!) : 1;
    const realUserId = e.realUserId?.trim() || userId;

    await pool.query(
      `INSERT INTO real_scope_audit_log (
         user_id, call_site, profile_role, persona_user_id, real_user_id, reason, event_count
       ) VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6, $7)`,
      [userId, callSite, profileRole, personaUserId, realUserId, reason, eventCount],
    );
  }
}
