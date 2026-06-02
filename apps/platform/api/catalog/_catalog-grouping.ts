import { ROOT_CATEGORY_IDS } from "./_filter-config.js";
import type { RootCategory } from "./_filter-resolve.js";

/** Альтернативный UUID межкомнатных из боевого Bitrix. */
export const INTERIOR_ROOT_ID_ALT = "342a9a43-c159-11ec-8116-00155d0a0a4e";

export type VariantOption = {
  value: string;
  product_id: string;
  image_url?: string | null;
};

export type CatalogVariantRow = {
  product_id: string;
  size: string | null;
  color: string | null;
  door_type: string | null;
  side: string | null;
  price_retail: number | null;
  price_retail_sale: number | null;
  image_url: string | null;
  total_stock: number | null;
};

export function isInteriorDoorGrouping(root: RootCategory): boolean {
  const name = root.name?.trim().toLowerCase() ?? "";
  if (name === "межкомнатные двери") return true;
  if (root.id === ROOT_CATEGORY_IDS.INTERIOR || root.id === INTERIOR_ROOT_ID_ALT) return true;
  return false;
}

/** Ключ группы вариантов (логика Bitrix getIdsProducts). */
export function computeGroupKey(
  linkVal: string | null | undefined,
  doorTypeVal: string | null | undefined,
  productId: string,
  interiorGrouping: boolean,
): string {
  const link = linkVal?.trim() ?? "";
  if (!link) return `single:${productId}`;
  if (interiorGrouping) return `${link}|${doorTypeVal?.trim() ?? ""}`;
  return link;
}

const PROP_LINK = `'СсылкаНаГлавную'`;
const PROP_MAIN = `'Главная'`;
const PROP_DOOR = `'Вид двери'`;
const PROP_SIZE = `'Размер, мм'`;
const PROP_COLOR = `'Цвет'`;
const PROP_SIDE = `'Сторона открывания'`;

export const VARIANT_IMAGE_SQL = `(
  SELECT i.blob_url FROM catalog_product_images i
  WHERE i.product_id = p.id AND i.blob_url IS NOT NULL
  ORDER BY i.sort_order ASC NULLS LAST, i.path ASC
  LIMIT 1
)`;

export const VARIANT_IMAGE_PATH_SQL = `(
  SELECT i.path FROM catalog_product_images i
  WHERE i.product_id = p.id
  ORDER BY i.sort_order ASC NULLS LAST, i.path ASC
  LIMIT 1
)`;

export const VARIANT_STOCK_SQL = `COALESCE((
  SELECT SUM(s.qty)::numeric FROM catalog_stocks s WHERE s.product_id = p.id
), 0)`;

export const VARIANT_PRICE_RETAIL_SQL = `(
  SELECT pr.value FROM catalog_prices pr
  JOIN catalog_price_types pt ON pt.id = pr.price_type_id
  WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%ррц тандор%'
  LIMIT 1
)`;

export const VARIANT_PRICE_SALE_SQL = `(
  SELECT pr.value FROM catalog_prices pr
  JOIN catalog_price_types pt ON pt.id = pr.price_type_id
  WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%акционнаяцена_тандор_розница%'
  LIMIT 1
)`;

const IS_MAIN_SQL = `EXISTS (
  SELECT 1 FROM catalog_product_properties pp
  WHERE pp.product_id = p.id AND pp.name = ${PROP_MAIN}
    AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')
)`;

const HAS_IMAGE_SQL = `EXISTS (
  SELECT 1 FROM catalog_product_images i
  WHERE i.product_id = p.id AND i.blob_url IS NOT NULL
)`;

const PHOTO_SORT_SQL = `(
  SELECT MIN(i.sort_order) FROM catalog_product_images i
  WHERE i.product_id = p.id AND i.blob_url IS NOT NULL
)`;

const LINK_VAL_SQL = `(
  SELECT NULLIF(TRIM(pp.value), '') FROM catalog_product_properties pp
  WHERE pp.product_id = p.id AND pp.name = ${PROP_LINK}
  LIMIT 1
)`;

const DOOR_TYPE_VAL_SQL = `(
  SELECT NULLIF(TRIM(pp.value), '') FROM catalog_product_properties pp
  WHERE pp.product_id = p.id AND pp.name = ${PROP_DOOR}
  LIMIT 1
)`;

const ARTICLE_VAL_SQL = `(
  SELECT NULLIF(TRIM(pp.value), '') FROM catalog_product_properties pp
  WHERE pp.product_id = p.id AND pp.name = 'Артикул'
  LIMIT 1
)`;

export type CatalogListSort = "default" | "name" | "stock" | "price_asc" | "price_desc";

/** Боевой default: акция → новинка → хит; фурнитура/прочее — производитель → артикул. */
export type CatalogDefaultSortMode = "promo" | "article";

export function parseCatalogListSort(raw: unknown): CatalogListSort {
  const s = String(raw ?? "default").trim();
  if (s === "name" || s === "stock" || s === "price_asc" || s === "price_desc") return s;
  return "default";
}

export function resolveDefaultSortMode(
  rootCategoryId: string | null,
  rootCategoryName: string | null,
): CatalogDefaultSortMode {
  if (rootCategoryId === ROOT_CATEGORY_IDS.HARDWARE) return "article";
  const name = rootCategoryName?.trim().toLowerCase() ?? "";
  if (name.includes("фурнитур")) return "article";

  if (
    rootCategoryId === ROOT_CATEGORY_IDS.ENTRANCE ||
    rootCategoryId === ROOT_CATEGORY_IDS.INTERIOR ||
    rootCategoryId === INTERIOR_ROOT_ID_ALT ||
    isInteriorDoorGrouping({ id: rootCategoryId, name: rootCategoryName })
  ) {
    return "promo";
  }
  const doorNames = ["входные", "межкомнатные"];
  if (doorNames.some((d) => name.includes(d))) return "promo";

  if (!rootCategoryId) return "promo";

  return "article";
}

function buildGroupOrderSql(sort: CatalogListSort, defaultMode: CatalogDefaultSortMode): string {
  if (sort === "stock") {
    return `ORDER BY group_total_stock DESC NULLS LAST, rep_name ASC`;
  }
  if (sort === "price_asc") {
    return `ORDER BY rep_price_retail ASC NULLS LAST, rep_name ASC`;
  }
  if (sort === "price_desc") {
    return `ORDER BY rep_price_retail DESC NULLS LAST, rep_name ASC`;
  }
  if (sort === "name") {
    return `ORDER BY rep_name ASC`;
  }
  if (defaultMode === "article") {
    return `ORDER BY rep_brand ASC NULLS LAST, rep_article ASC NULLS LAST, rep_name ASC`;
  }
  return `ORDER BY grp_is_sale DESC, grp_is_new DESC, grp_is_hit DESC, rep_name ASC`;
}

/** JSON-массив вариантов свойства по группе. */
function variantJsonAgg(propName: string, includeImage: boolean): string {
  const imageSelect = includeImage
    ? `, (SELECT i.blob_url FROM catalog_product_images i WHERE i.product_id = v.id AND i.blob_url IS NOT NULL ORDER BY i.sort_order ASC NULLS LAST LIMIT 1) AS image_url`
    : "";
  return `(
    SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.value), '[]'::json)
    FROM (
      SELECT DISTINCT ON (NULLIF(TRIM(pp.value), ''))
        NULLIF(TRIM(pp.value), '') AS value,
        v.id AS product_id
        ${imageSelect}
      FROM group_variants v
      INNER JOIN catalog_product_properties pp ON pp.product_id = v.id AND pp.name = ${propName}
      WHERE v.group_key = g.group_key
        AND NULLIF(TRIM(pp.value), '') IS NOT NULL
      ORDER BY NULLIF(TRIM(pp.value), ''), v.id
    ) x
  )`;
}

/**
 * SQL листинга: одна строка = модель (группа вариантов).
 * @param scopeWhereSql — WHERE только active + hidden (без листинг-фильтров)
 * @param filterWhereSql — полный WHERE для прохождения варианта
 */
export function buildGroupedProductsQuery(
  scopeWhereSql: string,
  filterWhereSql: string,
  interiorParamIndex: number,
  sort: CatalogListSort,
  defaultSortMode: CatalogDefaultSortMode,
): { sql: string; sortSql: string } {
  const repPriority = `(
    CASE
      WHEN ${IS_MAIN_SQL} AND ${HAS_IMAGE_SQL} THEN 0
      WHEN ${HAS_IMAGE_SQL} THEN 1
      WHEN ${IS_MAIN_SQL} THEN 2
      ELSE 3
    END
  )`;

  const groupKeySql = `(
    CASE
      WHEN ${LINK_VAL_SQL} IS NULL THEN 'single:' || p.id::text
      WHEN $${interiorParamIndex}::boolean THEN ${LINK_VAL_SQL} || '|' || COALESCE(${DOOR_TYPE_VAL_SQL}, '')
      ELSE ${LINK_VAL_SQL}
    END
  )`;

  const sortSql = buildGroupOrderSql(sort, defaultSortMode);

  const sql = `
    WITH scoped AS (
      SELECT
        p.id,
        p.name,
        p.display_name,
        p.brand,
        p.is_on_site,
        ${LINK_VAL_SQL} AS link_val,
        ${DOOR_TYPE_VAL_SQL} AS door_type_val,
        ${groupKeySql} AS group_key,
        ${VARIANT_STOCK_SQL} AS variant_stock,
        ${VARIANT_IMAGE_PATH_SQL} AS image_path,
        ${VARIANT_IMAGE_SQL} AS image_url,
        ${VARIANT_PRICE_RETAIL_SQL} AS price_retail,
        ${VARIANT_PRICE_SALE_SQL} AS price_retail_sale,
        ${IS_MAIN_SQL} AS is_main,
        ${HAS_IMAGE_SQL} AS has_image,
        ${PHOTO_SORT_SQL} AS photo_sort,
        ${ARTICLE_VAL_SQL} AS article_val,
        EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'новинка' AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')) AS is_new,
        EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'хит продаж' AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')) AS is_hit,
        EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'акция' AND NULLIF(TRIM(pp.value), '') IS NOT NULL) AS is_sale
      FROM catalog_products p
      ${scopeWhereSql}
    ),
    passing AS (
      SELECT s.id, s.group_key
      FROM scoped s
      INNER JOIN catalog_products p ON p.id = s.id
      ${filterWhereSql}
    ),
    eligible_groups AS (
      SELECT DISTINCT group_key FROM passing
    ),
    group_variants AS (
      SELECT s.*
      FROM scoped s
      INNER JOIN eligible_groups eg ON eg.group_key = s.group_key
    ),
    ranked AS (
      SELECT
        gv.*,
        COUNT(*) OVER (PARTITION BY gv.group_key)::int AS variant_count,
        SUM(gv.variant_stock) OVER (PARTITION BY gv.group_key) AS group_total_stock,
        ROW_NUMBER() OVER (
          PARTITION BY gv.group_key
          ORDER BY
            (CASE
              WHEN gv.is_main AND gv.has_image THEN 0
              WHEN gv.has_image THEN 1
              WHEN gv.is_main THEN 2
              ELSE 3
            END),
            gv.photo_sort ASC NULLS LAST,
            gv.name ASC
        ) AS rn
      FROM group_variants gv
    ),
    representatives AS (
      SELECT
        r.id AS rep_id,
        r.name AS rep_name,
        r.display_name AS rep_display_name,
        r.brand AS rep_brand,
        r.is_on_site AS rep_is_on_site,
        r.image_path AS rep_image_path,
        r.image_url AS rep_image_url,
        r.price_retail AS rep_price_retail,
        r.price_retail_sale AS rep_price_retail_sale,
        r.is_new AS rep_is_new,
        r.is_hit AS rep_is_hit,
        r.is_sale AS rep_is_sale,
        r.article_val AS rep_article,
        r.group_key,
        r.variant_count,
        r.group_total_stock,
        (SELECT MAX(CASE WHEN v.is_sale THEN 1 ELSE 0 END) FROM group_variants v WHERE v.group_key = r.group_key) AS grp_is_sale,
        (SELECT MAX(CASE WHEN v.is_new THEN 1 ELSE 0 END) FROM group_variants v WHERE v.group_key = r.group_key) AS grp_is_new,
        (SELECT MAX(CASE WHEN v.is_hit THEN 1 ELSE 0 END) FROM group_variants v WHERE v.group_key = r.group_key) AS grp_is_hit
      FROM ranked r
      WHERE r.rn = 1
    ),
    paged AS (
      SELECT
        g.*,
        COUNT(*) OVER ()::text AS total_count,
        ${variantJsonAgg(PROP_SIZE, true)} AS sizes,
        ${variantJsonAgg(PROP_COLOR, true)} AS colors,
        (
          SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.value), '[]'::json)
          FROM (
            SELECT DISTINCT ON (NULLIF(TRIM(pp.value), ''))
              NULLIF(TRIM(pp.value), '') AS value,
              v.id AS product_id
            FROM group_variants v
            INNER JOIN catalog_product_properties pp ON pp.product_id = v.id AND pp.name = ${PROP_DOOR}
            WHERE v.group_key = g.group_key AND NULLIF(TRIM(pp.value), '') IS NOT NULL
            ORDER BY NULLIF(TRIM(pp.value), ''), v.id
          ) x
        ) AS door_types,
        (
          SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.value), '[]'::json)
          FROM (
            SELECT DISTINCT ON (NULLIF(TRIM(pp.value), ''))
              NULLIF(TRIM(pp.value), '') AS value,
              v.id AS product_id
            FROM group_variants v
            INNER JOIN catalog_product_properties pp ON pp.product_id = v.id AND pp.name = ${PROP_SIDE}
            WHERE v.group_key = g.group_key AND NULLIF(TRIM(pp.value), '') IS NOT NULL
            ORDER BY NULLIF(TRIM(pp.value), ''), v.id
          ) x
        ) AS sides,
        (
          SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.product_id), '[]'::json)
          FROM (
            SELECT
              v.id AS product_id,
              (SELECT NULLIF(TRIM(pp.value), '') FROM catalog_product_properties pp
               WHERE pp.product_id = v.id AND pp.name = ${PROP_SIZE} LIMIT 1) AS size,
              (SELECT NULLIF(TRIM(pp.value), '') FROM catalog_product_properties pp
               WHERE pp.product_id = v.id AND pp.name = ${PROP_COLOR} LIMIT 1) AS color,
              COALESCE(
                v.door_type_val,
                (SELECT NULLIF(TRIM(pp.value), '') FROM catalog_product_properties pp
                 WHERE pp.product_id = v.id AND pp.name = ${PROP_DOOR} LIMIT 1)
              ) AS door_type,
              (SELECT NULLIF(TRIM(pp.value), '') FROM catalog_product_properties pp
               WHERE pp.product_id = v.id AND pp.name = ${PROP_SIDE} LIMIT 1) AS side,
              v.price_retail,
              v.price_retail_sale,
              v.image_url,
              v.variant_stock AS total_stock
            FROM group_variants v
            WHERE v.group_key = g.group_key
          ) x
        ) AS variants
      FROM representatives g
      ${sortSql}
    )
    SELECT * FROM paged
  `;

  return { sql, sortSql };
}
