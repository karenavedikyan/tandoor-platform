import type { FilterGroupDef } from "./_filter-config.js";
import { findFilterGroupDef, propNamesForGroup } from "./_filter-config.js";
import {
  BOOLEAN_YES_SQL,
  PROP_VALUE_NORM_SQL,
  PROP_VALUE_NUMERIC_SQL,
  normalizeValueKey,
} from "./_filter-values.js";

export function buildGroupFilterClause(
  groupKey: string,
  selectedValues: string[],
  groupDefs: FilterGroupDef[],
  params: unknown[],
): string | null {
  if (!selectedValues.length) return null;
  const def = findFilterGroupDef(groupDefs, groupKey);
  if (!def) return null;

  if (def.kind === "boolean") {
    params.push(propNamesForGroup(def));
    const namesIdx = params.length;
    return `EXISTS (
      SELECT 1 FROM catalog_product_properties pp
      WHERE pp.product_id = p.id
        AND pp.name = ANY($${namesIdx}::text[])
        AND ${BOOLEAN_YES_SQL}
    )`;
  }

  if (def.kind === "range_buckets" && def.buckets?.length) {
    const bucketConds: string[] = [];
    for (const label of selectedValues) {
      const bucket = def.buckets.find((b) => b.label === label);
      if (!bucket) continue;
      const parts: string[] = [`${PROP_VALUE_NUMERIC_SQL} IS NOT NULL`];
      if (bucket.min != null) {
        params.push(bucket.min);
        parts.push(`${PROP_VALUE_NUMERIC_SQL} >= $${params.length}`);
      }
      if (bucket.max != null) {
        params.push(bucket.max);
        parts.push(`${PROP_VALUE_NUMERIC_SQL} <= $${params.length}`);
      }
      bucketConds.push(`(${parts.join(" AND ")})`);
    }
    if (!bucketConds.length) return null;
    params.push(def.propName);
    const propIdx = params.length;
    return `EXISTS (
      SELECT 1 FROM catalog_product_properties pp
      WHERE pp.product_id = p.id
        AND pp.name = $${propIdx}
        AND (${bucketConds.join(" OR ")})
    )`;
  }

  // checkbox (и бренд)
  const normSelected = selectedValues.map((v) => normalizeValueKey(v));
  params.push(propNamesForGroup(def));
  const namesIdx = params.length;
  params.push(normSelected);
  const valsIdx = params.length;

  if (def.key === "Бренд" || def.propName === "Бренд") {
    return `(
      LOWER(REPLACE(REPLACE(TRIM(COALESCE(p.brand, '')),'ё','е'),'Ё','Е')) = ANY($${valsIdx}::text[])
      OR EXISTS (
        SELECT 1 FROM catalog_product_properties pp
        WHERE pp.product_id = p.id
          AND pp.name = ANY($${namesIdx}::text[])
          AND ${PROP_VALUE_NORM_SQL} = ANY($${valsIdx}::text[])
      )
    )`;
  }

  return `EXISTS (
    SELECT 1 FROM catalog_product_properties pp
    WHERE pp.product_id = p.id
      AND pp.name = ANY($${namesIdx}::text[])
      AND ${PROP_VALUE_NORM_SQL} = ANY($${valsIdx}::text[])
  )`;
}
