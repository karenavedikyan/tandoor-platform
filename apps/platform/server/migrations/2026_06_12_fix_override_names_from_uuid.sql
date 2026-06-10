-- Fix: dealer_overrides.regional_manager_name / rop_name содержат UUID пользователя
-- вместо ФИО (306 и 281 строк). Из-за этого в фильтрах «Назначения клиентов»
-- (Регионал / РОП) показываются «иероглифы» — сырые UUID.
-- Заменяем UUID на users.full_name. Только строки, где значение похоже на UUID
-- и существует соответствующий пользователь. Идемпотентно.

UPDATE dealer_overrides t
SET regional_manager_name = u.full_name, updated_at = now()
FROM users u
WHERE t.regional_manager_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.id = t.regional_manager_name::uuid
  AND u.full_name IS NOT NULL AND btrim(u.full_name) <> '';

UPDATE dealer_overrides t
SET rop_name = u.full_name, updated_at = now()
FROM users u
WHERE t.rop_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.id = t.rop_name::uuid
  AND u.full_name IS NOT NULL AND btrim(u.full_name) <> '';

UPDATE trade_point_overrides t
SET regional_manager_name = u.full_name, updated_at = now()
FROM users u
WHERE t.regional_manager_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.id = t.regional_manager_name::uuid
  AND u.full_name IS NOT NULL AND btrim(u.full_name) <> '';

UPDATE trade_point_overrides t
SET rop_name = u.full_name, updated_at = now()
FROM users u
WHERE t.rop_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.id = t.rop_name::uuid
  AND u.full_name IS NOT NULL AND btrim(u.full_name) <> '';
