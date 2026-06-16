-- Промт 378: денормализованная активность менеджеров (уже на проде; файл для документации).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS activity_summary jsonb,
  ADD COLUMN IF NOT EXISTS activity_summary_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.manager_activity_daily (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  events_overrides integer NOT NULL DEFAULT 0,
  events_contacts integer NOT NULL DEFAULT 0,
  events_tp integer NOT NULL DEFAULT 0,
  clients_touched integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_user ON public.client_assignments (responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_doe_changed_by_at ON public.dealer_override_events (changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cce_actor_at ON public.client_contact_events (actor_user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_tpo_updated_by_at ON public.trade_point_overrides (updated_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_do_updated_by_at ON public.dealer_overrides (updated_by, updated_at DESC);
