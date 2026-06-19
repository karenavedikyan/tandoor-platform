BEGIN;

-- =====================================================================
-- Промт 435а-hotfix: починка backfill RM и нормализация manager scope_key.
-- Идемпотентно. Перед DML создаём аудит-копию responsibility_assignments
-- для возможного отката.
-- =====================================================================

-- 0) Аудит-копия (создаётся один раз; при повторных прогонах не пересоздаётся,
--    чтобы сохранить исходный снапшот ДО hotfix).
CREATE TABLE IF NOT EXISTS responsibility_assignments_pre_hotfix_435a AS
TABLE responsibility_assignments;

-- 1) Нормализация scope_key менеджеров к external_key.
--    Сейчас 2859 manager-записей имеют scope_key = release_code.
--    Переводим их к external_key через JOIN по release_code → external_key.
WITH to_fix AS (
  SELECT ra.id, d.external_key AS new_scope_key
  FROM responsibility_assignments ra
  JOIN dealers d ON d.release_code = ra.scope_key
  WHERE ra.scope_kind = 'dealer'
    AND ra.responsible_role = 'manager'
    AND NOT EXISTS (
      -- если уже есть запись с тем же external_key + manager — пропускаем,
      -- чтобы не словить unique conflict
      SELECT 1 FROM responsibility_assignments ra2
       WHERE ra2.scope_kind = 'dealer'
         AND ra2.responsible_role = 'manager'
         AND ra2.scope_key = d.external_key
         AND ra2.id <> ra.id
    )
)
UPDATE responsibility_assignments ra
   SET scope_key = tf.new_scope_key,
       updated_at = now()
  FROM to_fix tf
 WHERE ra.id = tf.id;

-- 2) Backfill RM (regional_manager) с правильным JOIN: dealer_overrides.dealer_id = dealers.external_key.
INSERT INTO responsibility_assignments
       (scope_kind, scope_key, responsible_role, user_id, user_name, created_at, updated_at)
SELECT 'dealer',
       d.external_key,
       'regional_manager',
       ov.regional_manager_id,
       u.full_name,
       now(),
       now()
  FROM dealer_overrides ov
  JOIN dealers d ON d.external_key = ov.dealer_id
  LEFT JOIN users u ON u.id = ov.regional_manager_id
 WHERE ov.regional_manager_id IS NOT NULL
ON CONFLICT (scope_kind, scope_key, responsible_role) DO UPDATE
  SET user_id    = EXCLUDED.user_id,
      user_name  = EXCLUDED.user_name,
      updated_at = now();

-- 3) Дополнительный backfill РОП из dealer_overrides.rop_id (тоже с правильным JOIN).
--    Шаг 3 миграции 435а уже наполнил rop через teams, но dealer_overrides.rop_id может содержать
--    персональные override-значения, отличающиеся от team-РОП.
INSERT INTO responsibility_assignments
       (scope_kind, scope_key, responsible_role, user_id, user_name, created_at, updated_at)
SELECT 'dealer',
       d.external_key,
       'rop',
       ov.rop_id,
       u.full_name,
       now(),
       now()
  FROM dealer_overrides ov
  JOIN dealers d ON d.external_key = ov.dealer_id
  LEFT JOIN users u ON u.id = ov.rop_id
 WHERE ov.rop_id IS NOT NULL
ON CONFLICT (scope_kind, scope_key, responsible_role) DO UPDATE
  SET user_id    = EXCLUDED.user_id,
      user_name  = EXCLUDED.user_name,
      updated_at = now();

-- 4) View не меняем (он уже JOIN-ит по external_key и теперь подхватит все записи).
--    Проверим, что view вернул ожидаемое число строк.
DO $$
DECLARE
  v_total BIGINT;
  v_manager BIGINT;
  v_rop BIGINT;
  v_rm BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM effective_scope;
  SELECT COUNT(*) INTO v_manager FROM effective_scope WHERE responsible_role = 'manager';
  SELECT COUNT(*) INTO v_rop FROM effective_scope WHERE responsible_role = 'rop';
  SELECT COUNT(*) INTO v_rm FROM effective_scope WHERE responsible_role = 'regional_manager';

  RAISE NOTICE '[hotfix] effective_scope total: % (manager=%, rop=%, regional_manager=%)',
    v_total, v_manager, v_rop, v_rm;

  IF v_manager < 2800 THEN
    RAISE EXCEPTION 'manager rows in effective_scope < 2800 (got %), abort', v_manager;
  END IF;
  IF v_rm < 2500 THEN
    RAISE EXCEPTION 'regional_manager rows in effective_scope < 2500 (got %), abort', v_rm;
  END IF;
END $$;

COMMIT;
