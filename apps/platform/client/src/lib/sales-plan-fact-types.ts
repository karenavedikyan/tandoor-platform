/**
 * Типы persisted план-факта продаж (организационный контур, не sessionStorage).
 */

export const SALES_PLAN_FACT_STATE_VERSION = 1 as const;

export type SalesPlanFactLineStatus =
  | "draft"
  | "published"
  | "in_progress"
  | "fact_entered"
  | "confirmed"
  | "changed_after_publish";

/** Уровень строки: команда (план директора), менеджер, распределение по городу/продукту. */
export type SalesPlanFactRollup = "team" | "manager" | "city" | "product";

export type SalesPlanFactLine = {
  id: string;
  periodId: string;
  metricId: string;
  teamId: string;
  /** Для rollup=team — null. */
  managerId: string | null;
  cityKey: string | null;
  cityName: string | null;
  productId: string | null;
  productName: string | null;
  rollup: SalesPlanFactRollup;
  planValue: number;
  /** null — факт не внесён (не показываем % выполнения как «реальный»). */
  actualValue: number | null;
  status: SalesPlanFactLineStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  comment: string;
};

export type SalesPlanFactPersistedState = {
  version: typeof SALES_PLAN_FACT_STATE_VERSION;
  updatedAt: string | null;
  updatedBy: string | null;
  lines: SalesPlanFactLine[];
};

export type SalesPlanFactStorageMode = "persistent" | "server_memory" | "not_configured";

export function createEmptySalesPlanFactState(): SalesPlanFactPersistedState {
  return {
    version: SALES_PLAN_FACT_STATE_VERSION,
    updatedAt: null,
    updatedBy: null,
    lines: [],
  };
}

const STATUS_SET = new Set<SalesPlanFactLineStatus>([
  "draft",
  "published",
  "in_progress",
  "fact_entered",
  "confirmed",
  "changed_after_publish",
]);

const ROLLUP_SET = new Set<SalesPlanFactRollup>(["team", "manager", "city", "product"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function coerceLine(raw: unknown): SalesPlanFactLine | null {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const periodId = typeof raw.periodId === "string" ? raw.periodId.trim() : "";
  const metricId = typeof raw.metricId === "string" ? raw.metricId.trim() : "";
  const teamId = typeof raw.teamId === "string" ? raw.teamId.trim() : "";
  if (!id || !periodId || !metricId || !teamId) return null;
  const rollup = raw.rollup as SalesPlanFactRollup;
  if (!ROLLUP_SET.has(rollup)) return null;
  const status = raw.status as SalesPlanFactLineStatus;
  if (!STATUS_SET.has(status)) return null;
  const planValue = typeof raw.planValue === "number" && Number.isFinite(raw.planValue) ? raw.planValue : 0;
  let actualValue: number | null = null;
  if (raw.actualValue !== undefined && raw.actualValue !== null) {
    if (typeof raw.actualValue === "number" && Number.isFinite(raw.actualValue)) actualValue = raw.actualValue;
  }
  const managerId =
    raw.managerId === null || raw.managerId === undefined
      ? null
      : typeof raw.managerId === "string"
        ? raw.managerId.trim() || null
        : null;
  const cityKey =
    raw.cityKey === null || raw.cityKey === undefined
      ? null
      : typeof raw.cityKey === "string"
        ? raw.cityKey.trim() || null
        : null;
  const cityName =
    raw.cityName === null || raw.cityName === undefined
      ? null
      : typeof raw.cityName === "string"
        ? raw.cityName.trim() || null
        : null;
  const productId =
    raw.productId === null || raw.productId === undefined
      ? null
      : typeof raw.productId === "string"
        ? raw.productId.trim() || null
        : null;
  const productName =
    raw.productName === null || raw.productName === undefined
      ? null
      : typeof raw.productName === "string"
        ? raw.productName.trim() || null
        : null;
  const createdBy = typeof raw.createdBy === "string" ? raw.createdBy : "unknown";
  const updatedBy = typeof raw.updatedBy === "string" ? raw.updatedBy : createdBy;
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt;
  const comment = typeof raw.comment === "string" ? raw.comment : "";
  return {
    id,
    periodId,
    metricId,
    teamId,
    managerId,
    cityKey,
    cityName,
    productId,
    productName,
    rollup,
    planValue,
    actualValue,
    status,
    createdBy,
    updatedBy,
    createdAt,
    updatedAt,
    comment,
  };
}

export function normalizeSalesPlanFactState(raw: unknown): SalesPlanFactPersistedState {
  const base = createEmptySalesPlanFactState();
  if (!isPlainObject(raw)) return base;
  const linesIn = raw.lines;
  const lines: SalesPlanFactLine[] = [];
  if (Array.isArray(linesIn)) {
    for (const x of linesIn) {
      const L = coerceLine(x);
      if (L) lines.push(L);
    }
  }
  return {
    version: SALES_PLAN_FACT_STATE_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
    lines,
  };
}

export function upsertSalesPlanFactLine(
  prev: SalesPlanFactPersistedState,
  line: SalesPlanFactLine,
): SalesPlanFactPersistedState {
  const others = prev.lines.filter((x) => x.id !== line.id);
  return { ...prev, lines: [...others, line] };
}

export function removeSalesPlanFactLine(prev: SalesPlanFactPersistedState, id: string): SalesPlanFactPersistedState {
  return { ...prev, lines: prev.lines.filter((x) => x.id !== id) };
}
