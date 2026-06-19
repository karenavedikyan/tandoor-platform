-- Промт 430: индексы для admin audit UI (фильтры по актору и времени).

CREATE INDEX IF NOT EXISTS idx_cah_actor_created_at
  ON client_assignment_history (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drh_actor_created_at
  ON dealer_responsibility_history (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_scope_audit_log_user_occurred_at
  ON real_scope_audit_log (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_user_id_idx
  ON audit_log (actor_user_id, created_at DESC);
