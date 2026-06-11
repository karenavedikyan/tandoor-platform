-- Промт 317: добавить категорию 'letter' (Информационные письма) к маркетинговым брифам
ALTER TABLE marketing_briefs
  DROP CONSTRAINT IF EXISTS marketing_briefs_category_check;

ALTER TABLE marketing_briefs
  DROP CONSTRAINT IF EXISTS marketing_briefs_category_check1;

ALTER TABLE marketing_briefs
  ADD CONSTRAINT marketing_briefs_category_check
  CHECK (category IN ('brief', 'promo', 'info', 'letter'));
