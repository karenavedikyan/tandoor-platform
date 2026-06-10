-- Промт 263: доп. видимость клиентов для РОПа по client_code / trade_point_id.
-- Зона ответственности РОПа теперь = его команда (team_id) ПЛЮС явные гранты ниже.
-- Не меняет владельца (responsible_user_id) и команду (team_id) клиента — только READ-видимость.

CREATE TABLE IF NOT EXISTS rop_client_grants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rop_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- ровно одно из двух заполнено: либо клиент (client_code), либо торговая точка (trade_point_id)
  client_code  TEXT,
  trade_point_id TEXT,
  granted_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason       TEXT,
  CONSTRAINT rop_client_grants_one_target CHECK (
    (client_code IS NOT NULL)::int + (trade_point_id IS NOT NULL)::int = 1
  )
);

-- уникальность гранта на пару (роп, цель)
CREATE UNIQUE INDEX IF NOT EXISTS rop_client_grants_uq_client
  ON rop_client_grants (rop_user_id, client_code) WHERE client_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rop_client_grants_uq_tp
  ON rop_client_grants (rop_user_id, trade_point_id) WHERE trade_point_id IS NOT NULL;

-- быстрый поиск всех грантов конкретного РОПа
CREATE INDEX IF NOT EXISTS rop_client_grants_by_rop ON rop_client_grants (rop_user_id);
-- обратный поиск: кому из РОПов виден клиент / ТТ
CREATE INDEX IF NOT EXISTS rop_client_grants_by_client ON rop_client_grants (client_code) WHERE client_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS rop_client_grants_by_tp ON rop_client_grants (trade_point_id) WHERE trade_point_id IS NOT NULL;
