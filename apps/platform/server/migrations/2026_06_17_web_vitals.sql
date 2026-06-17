-- Промт 382: Web Vitals events (агент накатывает в БД).
CREATE TABLE IF NOT EXISTS public.web_vitals_events (
  id bigserial PRIMARY KEY,
  metric_name text NOT NULL,
  metric_value double precision NOT NULL,
  rating text,
  pathname text NOT NULL,
  role text,
  user_hash text,
  user_agent text,
  connection text,
  viewport_width int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wv_pathname_metric_created
  ON public.web_vitals_events (pathname, metric_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wv_created_at
  ON public.web_vitals_events (created_at DESC);
