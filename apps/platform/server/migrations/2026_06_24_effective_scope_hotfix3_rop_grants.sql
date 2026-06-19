BEGIN;

-- =====================================================================
-- Промт 435а-hotfix3: добавить rop_client_grants как источник scope.
-- Расширяем unique constraint responsibility_assignments чтобы допустить
-- нескольких rop-пользователей на одного дилера (team-rop + granted-rop).
-- Идемпотентно.
-- =====================================================================

-- 0) Аудит-копия
CREATE TABLE IF NOT EXISTS responsibility_assignments_pre_hotfix3_435a AS
TABLE responsibility_assignments;

-- 1) Расширить unique: (scope_kind, scope_key, responsible_role) → (scope_kind, scope_key, responsible_role, user_id).
--    Прежний unique гарантировал «один scope→role→единственный user»; теперь допускаем
--    несколько user_id для одной (scope, role) пары (например, team-РОП + granted-РОП).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'responsibility_assignments_scope_role_uq'
      AND conrelid = 'responsibility_assignments'::regclass
  ) THEN
    ALTER TABLE responsibility_assignments
      DROP CONSTRAINT responsibility_assignments_scope_role_uq;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'responsibility_assignments_scope_role_user_uq'
      AND conrelid = 'responsibility_assignments'::regclass
  ) THEN
    ALTER TABLE responsibility_assignments
      ADD CONSTRAINT responsibility_assignments_scope_role_user_uq
      UNIQUE (scope_kind, scope_key, responsible_role, user_id);
  END IF;
END $$;

-- 2) Backfill grant-записей.
--    Источник: rop_client_grants с client_code (trade_point_id игнорируем — другая роль).
INSERT INTO responsibility_assignments
       (scope_kind, scope_key, responsible_role, user_id, user_name, created_at, updated_at)
SELECT 'dealer',
       d.external_key,
       'rop',
       g.rop_user_id,
       u.full_name,
       now(),
       now()
  FROM rop_client_grants g
  JOIN dealers d ON d.release_code = g.client_code
  LEFT JOIN users u ON u.id = g.rop_user_id
 WHERE g.client_code IS NOT NULL
ON CONFLICT (scope_kind, scope_key, responsible_role, user_id) DO UPDATE
  SET user_name  = EXCLUDED.user_name,
      updated_at = now();

-- 3) Источник для grant-записей помечаем в view: расширим view.
--    Раньше у view был колонка source='responsibility_assignments' — простой источник.
--    Теперь добавим различение между team-rop и granted-rop через служебную метаинформацию.
--    Делаем это через LEFT JOIN с rop_client_grants.
CREATE OR REPLACE VIEW effective_scope AS
SELECT ra.user_id::text       AS user_id,
       d.id::text              AS dealer_id,
       d.external_key          AS dealer_external_key,
       ra.responsible_role     AS responsible_role,
       CASE
         WHEN ra.responsible_role = 'rop' AND EXISTS (
           SELECT 1 FROM rop_client_grants g
            WHERE g.rop_user_id = ra.user_id
              AND g.client_code = d.release_code
         ) THEN 'rop_client_grants'
         ELSE 'responsibility_assignments'
       END AS source
  FROM responsibility_assignments ra
  JOIN dealers d ON d.external_key = ra.scope_key
 WHERE ra.scope_kind = 'dealer';

COMMENT ON VIEW effective_scope IS
  'Промт 435а+hotfix2+hotfix3: единая проекция scope. responsibility_assignments — primary source. rop_client_grants — дополнительные RM/ROP-гранты, materialized как rop-записи. В 435c view станет единственным интерфейсом чтения.';

-- 4) Валидация
DO $$
DECLARE
  v_total BIGINT;
  v_rop BIGINT;
  v_skalaban BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM effective_scope;
  SELECT COUNT(*) INTO v_rop FROM effective_scope WHERE responsible_role='rop';
  SELECT COUNT(*) INTO v_skalaban FROM effective_scope
   WHERE responsible_role='rop' AND user_id='3f67f770-f5cd-4257-a4b2-1cefa65fbfaa';

  RAISE NOTICE '[hotfix3] effective_scope total=%, rop=%, skalaban_rop=%',
    v_total, v_rop, v_skalaban;

  -- Скалабан должен теперь видеть team(1241) + grants(82) = 1323 (overlap=0)
  IF v_skalaban NOT BETWEEN 1300 AND 1330 THEN
    RAISE EXCEPTION 'Skalaban rop scope after grants merge unexpected: % (expect ~1323)', v_skalaban;
  END IF;
END $$;

COMMIT;
