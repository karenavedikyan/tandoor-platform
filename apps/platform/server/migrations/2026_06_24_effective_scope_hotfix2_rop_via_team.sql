BEGIN;

-- =====================================================================
-- Промт 435а-hotfix2: rop-записи через team-путь, выпил dealer_overrides.rop_id из scope.
-- Идемпотентно. Безопасно перезапускать.
-- =====================================================================

-- 0) Аудит-копия состояния ДО изменений (если ещё нет).
CREATE TABLE IF NOT EXISTS responsibility_assignments_pre_hotfix2_435a AS
TABLE responsibility_assignments;

-- 1) Удалить ВСЕ существующие rop-записи в responsibility_assignments
--    (они пришли смесью из dealer_overrides.rop_id и teams через client_assignments).
DELETE FROM responsibility_assignments
WHERE scope_kind = 'dealer'
  AND responsible_role = 'rop';

-- 2) Пересоздать rop-записи ТОЛЬКО через team-путь.
--    дилер → client_assignments.team_id → teams.rop_user_id.
INSERT INTO responsibility_assignments
       (scope_kind, scope_key, responsible_role, user_id, user_name, created_at, updated_at)
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
ON CONFLICT (scope_kind, scope_key, responsible_role) DO UPDATE
  SET user_id    = EXCLUDED.user_id,
      user_name  = EXCLUDED.user_name,
      updated_at = now();

-- 3) Валидация — ожидаем строгое соответствие команд.
DO $$
DECLARE
  v_total BIGINT;
  v_manager BIGINT;
  v_rop BIGINT;
  v_rm BIGINT;
  v_skalaban BIGINT;
  v_sapozhkov BIGINT;
  v_kupyanskiy BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM effective_scope;
  SELECT COUNT(*) INTO v_manager FROM effective_scope WHERE responsible_role='manager';
  SELECT COUNT(*) INTO v_rop FROM effective_scope WHERE responsible_role='rop';
  SELECT COUNT(*) INTO v_rm FROM effective_scope WHERE responsible_role='regional_manager';

  SELECT COUNT(*) INTO v_skalaban FROM effective_scope
   WHERE responsible_role='rop' AND user_id='3f67f770-f5cd-4257-a4b2-1cefa65fbfaa';
  SELECT COUNT(*) INTO v_sapozhkov FROM effective_scope
   WHERE responsible_role='rop' AND user_id='c36f625f-730e-4ae3-b118-bdb005d10b81';
  SELECT COUNT(*) INTO v_kupyanskiy FROM effective_scope
   WHERE responsible_role='rop' AND user_id='ccffcf6e-2505-4eee-b257-ac65b60bb779';

  RAISE NOTICE '[hotfix2] effective_scope total=% (manager=%, rop=%, regional_manager=%)',
    v_total, v_manager, v_rop, v_rm;
  RAISE NOTICE '[hotfix2] rop scope: Skalaban=%, Sapozhkov=%, Kupyanskiy=%',
    v_skalaban, v_sapozhkov, v_kupyanskiy;

  -- Strict invariants
  IF v_rop NOT BETWEEN 2800 AND 2900 THEN
    RAISE EXCEPTION 'rop rows out of range: % (expect ~2860)', v_rop;
  END IF;
  IF v_skalaban NOT BETWEEN 1200 AND 1280 THEN
    RAISE EXCEPTION 'Skalaban rop scope unexpected: % (expect ~1241)', v_skalaban;
  END IF;
  IF v_sapozhkov NOT BETWEEN 940 AND 1000 THEN
    RAISE EXCEPTION 'Sapozhkov rop scope unexpected: % (expect ~970)', v_sapozhkov;
  END IF;
  IF v_kupyanskiy NOT BETWEEN 620 AND 680 THEN
    RAISE EXCEPTION 'Kupyanskiy rop scope unexpected: % (expect ~649)', v_kupyanskiy;
  END IF;
END $$;

COMMIT;
