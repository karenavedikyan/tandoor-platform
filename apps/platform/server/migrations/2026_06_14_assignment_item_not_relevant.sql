-- Расширяем допустимые значения item_status: добавляем 'not_relevant' (Уже не актуально)
ALTER TABLE showcase_install_assignment_items
  DROP CONSTRAINT IF EXISTS showcase_install_assignment_items_item_status_check;

ALTER TABLE showcase_install_assignment_items
  ADD CONSTRAINT showcase_install_assignment_items_item_status_check
  CHECK (item_status IN ('pending','shipped','installed','problem','not_relevant'));
