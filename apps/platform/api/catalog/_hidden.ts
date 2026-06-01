const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID категорий catalog_categories, скрытых из /catalog (ENV, через запятую). */
export function getHiddenCategoryIds(): string[] {
  const raw = process.env.CATALOG_HIDDEN_CATEGORY_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => UUID_RE.test(s));
}

/**
 * Исключает товары, привязанные к скрытой категории или любому её потомку
 * (catalog_product_categories).
 */
export function hiddenCategoryFilterSql(startParamIndex: number): {
  sql: string;
  params: unknown[];
} {
  const ids = getHiddenCategoryIds();
  if (ids.length === 0) return { sql: "", params: [] };

  const sql = `
    AND NOT EXISTS (
      SELECT 1
      FROM catalog_product_categories pc
      INNER JOIN (
        WITH RECURSIVE hidden_tree AS (
          SELECT id FROM catalog_categories WHERE id = ANY($${startParamIndex}::uuid[])
          UNION ALL
          SELECT c.id
          FROM catalog_categories c
          INNER JOIN hidden_tree ht ON c.parent_id = ht.id
        )
        SELECT id FROM hidden_tree
      ) ht ON ht.id = pc.category_id
      WHERE pc.product_id = p.id
    )`;

  return { sql, params: [ids] };
}

/** SQL `AND c.id NOT IN (hidden tree)` для списка категорий. */
export function hiddenCategoriesExcludeSql(
  categoryAlias: string,
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const ids = getHiddenCategoryIds();
  if (ids.length === 0) return { sql: "", params: [] };

  const sql = `
    AND ${categoryAlias}.id NOT IN (
      WITH RECURSIVE hidden_tree AS (
        SELECT id FROM catalog_categories WHERE id = ANY($${startParamIndex}::uuid[])
        UNION ALL
        SELECT c.id
        FROM catalog_categories c
        INNER JOIN hidden_tree ht ON c.parent_id = ht.id
      )
      SELECT id FROM hidden_tree
    )`;

  return { sql, params: [ids] };
}
