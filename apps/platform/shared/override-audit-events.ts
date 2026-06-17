/**
 * Аудит событий оверрайдов с event_kind (Промт 386).
 */

import type { PoolLike } from "./responsibility-resolver.js";

export type DealerAuditEventKind =
  | "dealer_purge_requested"
  | "dealer_restored_to_active"
  | "dealer_restored_to_employee_trash"
  | "dealer_purged"
  | "dealer_admin_restored"
  | "field_change";

export type TradePointAuditEventKind =
  | "tp_purge_requested"
  | "tp_restored_to_active"
  | "tp_restored_to_employee_trash"
  | "tp_purged"
  | "tp_admin_restored"
  | "field_change";

export async function logDealerAuditEvent(
  pool: PoolLike,
  input: {
    dealerId: string;
    eventKind: DealerAuditEventKind;
    userId: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO dealer_override_events (dealer_id, field, old_value, new_value, changed_by, event_kind, payload)
     VALUES ($1, $2, NULL, NULL, $3::uuid, $4, $5::jsonb)`,
    [
      input.dealerId,
      input.eventKind,
      input.userId,
      input.eventKind,
      input.payload ? JSON.stringify(input.payload) : null,
    ],
  );
}

export async function logTradePointAuditEvent(
  pool: PoolLike,
  input: {
    tpId: string;
    eventKind: TradePointAuditEventKind;
    userId: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO trade_point_override_events (tp_id, field, old_value, new_value, changed_by, event_kind, payload)
     VALUES ($1, $2, NULL, NULL, $3::uuid, $4, $5::jsonb)`,
    [
      input.tpId,
      input.eventKind,
      input.userId,
      input.eventKind,
      input.payload ? JSON.stringify(input.payload) : null,
    ],
  );
}
