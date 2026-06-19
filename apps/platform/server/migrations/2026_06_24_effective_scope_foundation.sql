-- ============================================================
-- Промт 435а: фундамент единого scope-слоя.
-- Идемпотентно. Безопасно перезапускать.
-- ============================================================

-- 1) Материализуем RM-назначения из dealer_overrides.regional_manager_id
--    Формируем (scope_kind=dealer, responsible_role=regional_manager, scope_key=dealers.external_key).
INSERT INTO responsibility_assignments (scope_kind, scope_key, responsible_role, user_id, user_name, created_at, updated_at)
SELECT 'dealer'                 AS scope_kind,
       d.external_key           AS scope_key,
       'regional_manager'       AS responsible_role,
       d_ov.regional_manager_id AS user_id,
       u.full_name              AS user_name,
       now()                    AS created_at,
       now()                    AS updated_at
  FROM dealers d
  JOIN dealer_overrides d_ov ON d_ov.dealer_id = d.id::text
  LEFT JOIN users u ON u.id = d_ov.regional_manager_id
 WHERE d_ov.regional_manager_id IS NOT NULL
ON CONFLICT (scope_kind, scope_key, responsible_role) DO UPDATE
  SET user_id    = EXCLUDED.user_id,
      user_name  = EXCLUDED.user_name,
      updated_at = now();

-- 2) Материализуем РОП-назначения из dealer_overrides.rop_id (если непустой)
INSERT INTO responsibility_assignments (scope_kind, scope_key, responsible_role, user_id, user_name, created_at, updated_at)
SELECT 'dealer',
       d.external_key,
       'rop',
       d_ov.rop_id,
       u.full_name,
       now(),
       now()
  FROM dealers d
  JOIN dealer_overrides d_ov ON d_ov.dealer_id = d.id::text
  LEFT JOIN users u ON u.id = d_ov.rop_id
 WHERE d_ov.rop_id IS NOT NULL
ON CONFLICT (scope_kind, scope_key, responsible_role) DO UPDATE
  SET user_id    = EXCLUDED.user_id,
      user_name  = EXCLUDED.user_name,
      updated_at = now();

-- 3) Доп. покрытие РОП через teams: для всех дилеров, привязанных к команде, у которой есть rop_user_id,
--    добавляем РОП-назначение, если в dealer_overrides.rop_id не было своего значения.
--    Источник связи дилер-команда: client_assignments.team_id (наиболее свежий).
INSERT INTO responsibility_assignments (scope_kind, scope_key, responsible_role, user_id, user_name, created_at, updated_at)
SELECT 'dealer',
       d.external_key,
       'rop',
       t.rop_user_id,
       u.full_name,
       now(),
       now()
  FROM client_assignments ca
  JOIN dealers d ON d.release_code = ca.client_code
  JOIN teams t ON t.id = ca.team_id
  LEFT JOIN users u ON u.id = t.rop_user_id
 WHERE t.rop_user_id IS NOT NULL
ON CONFLICT (scope_kind, scope_key, responsible_role) DO NOTHING;
-- Здесь NOTHING (а не UPDATE), чтобы не затирать персональный rop_id из dealer_overrides, если он отличается.

-- 4) View effective_scope: одна таблица — (user_id, dealer_id, dealer_external_key, responsible_role, source)
CREATE OR REPLACE VIEW effective_scope AS
SELECT ra.user_id::text       AS user_id,
       d.id::text              AS dealer_id,
       d.external_key          AS dealer_external_key,
       ra.responsible_role     AS responsible_role,
       'responsibility_assignments'::text AS source
  FROM responsibility_assignments ra
  JOIN dealers d ON d.external_key = ra.scope_key
 WHERE ra.scope_kind = 'dealer';

COMMENT ON VIEW effective_scope IS
  'Промт 435а: каноническая проекция scope. user_id видит dealer_id через responsible_role. Источник — responsibility_assignments. В 435b сюда добавятся остальные источники, в 435c — станет единственным.';

-- 5) Индекс на dealers.external_key (если ещё нет) — для скорости JOIN.
CREATE UNIQUE INDEX IF NOT EXISTS dealers_external_key_uq ON dealers (external_key);

-- 6) Контроль: убедимся что view создан и не пустой.
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM effective_scope;
  RAISE NOTICE '[effective_scope] rows after migration: %', v_count;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'effective_scope view is empty after migration';
  END IF;
END $$;
