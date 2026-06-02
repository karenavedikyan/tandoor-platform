import type { Pool } from "pg";

export type RootCategory = { id: string | null; name: string | null };

/** Поднимается до корневой категории по category_id или group_id. */
export async function resolveRootCategory(
  pool: Pool,
  categoryId?: string,
  groupId?: string,
): Promise<RootCategory> {
  let startId = categoryId;
  if (!startId && groupId) {
    const gr = await pool.query<{ category_id: string }>(
      `SELECT pc.category_id
       FROM catalog_products p
       INNER JOIN catalog_product_categories pc ON pc.product_id = p.id
       INNER JOIN catalog_categories cat ON cat.id = pc.category_id
       WHERE p.group_id = $1::uuid AND p.active = TRUE
       ORDER BY cat.parent_id NULLS FIRST
       LIMIT 1`,
      [groupId],
    );
    startId = gr.rows[0]?.category_id;
    if (startId) {
      const root = await pool.query<{ id: string; name: string }>(
        `WITH RECURSIVE ancestry AS (
           SELECT id, parent_id, name FROM catalog_categories WHERE id = $1::uuid
           UNION ALL
           SELECT c.id, c.parent_id, c.name
           FROM catalog_categories c
           INNER JOIN ancestry a ON c.id = a.parent_id
         )
         SELECT id, name FROM ancestry WHERE parent_id IS NULL LIMIT 1`,
        [startId],
      );
      if (root.rows[0]) return { id: root.rows[0].id, name: root.rows[0].name };
    }
  }
  if (!startId) return { id: null, name: null };

  const r = await pool.query<{ id: string; name: string }>(
    `WITH RECURSIVE ancestry AS (
       SELECT id, parent_id, name FROM catalog_categories WHERE id = $1::uuid
       UNION ALL
       SELECT c.id, c.parent_id, c.name
       FROM catalog_categories c
       INNER JOIN ancestry a ON c.id = a.parent_id
     )
     SELECT id, name FROM ancestry WHERE parent_id IS NULL
     ORDER BY name ASC
     LIMIT 1`,
    [startId],
  );
  const row = r.rows[0];
  return row ? { id: row.id, name: row.name } : { id: startId, name: null };
}
