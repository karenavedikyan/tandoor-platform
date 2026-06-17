/**
 * View-model управленческого cockpit план-факта: агрегаты только из persisted lines
 * + справочники команд/менеджеров; без merge с SEED/synthetic фактами.
 */

import type { DealerRow } from "./dealer-base-mock-data.js";
import type { SalesRole, SalesUser } from "./sales-control-data.js";
import {
  getAllSalesManagers,
  getTeamById,
  getTeamLeadForTeam,
  getTeamManagers,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  SALES_TEAMS,
  formatRub,
  formatSalesMetricValue,
} from "./sales-control-data.js";
import type { SalesPlanFactLine, SalesPlanFactPersistedState } from "./sales-plan-fact-types.js";

export type SalesPlanFactCockpitMode =
  | "overview"
  | "by_rop"
  | "managers"
  | "cities"
  | "products"
  | "entry";

export type AttentionKind =
  | "no_fact"
  | "low_completion"
  | "no_plan"
  | "changed_after_publish"
  | "no_team_plan";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  subtitle: string;
};

export type KpiBarModel = {
  metricId: string;
  label: string;
  unit: string;
  plan: number;
  actual: number | null;
  pct: number | null;
  remaining: number | null;
};

export type PeriodSummaryModel = {
  periodId: string;
  periodLabel: string;
  totalPlan: number;
  totalActual: number | null;
  completionPct: number | null;
  remaining: number | null;
  ropCount: number;
  managerCount: number;
  managersWithFact: number;
  managersWithoutFact: number;
};

export type RopAccordionRowModel = {
  teamId: string;
  ropName: string;
  teamName: string;
  plan: number;
  actual: number | null;
  completionPct: number | null;
  managerCount: number;
  withoutFact: number;
  managers: ManagerCardModel[];
};

export type ManagerCardModel = {
  managerId: string;
  name: string;
  teamId: string;
  plan: number;
  actual: number | null;
  completionPct: number | null;
  primaryCity: string;
  primaryCityKey: string;
};

export type CityRowModel = {
  cityKey: string;
  cityName: string;
  plan: number;
  actual: number | null;
  completionPct: number | null;
  managerCount: number;
};

export type ProductRowModel = {
  productId: string;
  productName: string;
  plan: number;
  actual: number | null;
  completionPct: number | null;
};

function slugCity(city: string): string {
  const t = city.trim() || "no-city";
  return t.replace(/\s+/g, "-").replace(/[^\w.-А-Яа-яёЁ]/gi, "").slice(0, 64) || "no-city";
}

export function buildPrimaryCityByManager(dealers: DealerRow[]): Map<string, { key: string; name: string }> {
  const map = new Map<string, { cities: Map<string, { name: string; n: number }> }>();
  for (const d of dealers) {
    const mid = d.releaseManagerId?.trim();
    if (!mid) continue;
    const cityName = (d.city ?? "").trim() || "Без города";
    const key = slugCity(cityName);
    let g = map.get(mid);
    if (!g) {
      g = { cities: new Map() };
      map.set(mid, g);
    }
    const cur = g.cities.get(key) ?? { name: cityName, n: 0 };
    cur.n += 1;
    g.cities.set(key, cur);
  }
  const out = new Map<string, { key: string; name: string }>();
  for (const [mid, g] of Array.from(map.entries())) {
    let bestKey = "";
    let bestName = "Без города";
    let bestN = -1;
    for (const [k, v] of Array.from(g.cities.entries())) {
      if (v.n > bestN) {
        bestN = v.n;
        bestKey = k;
        bestName = v.name;
      }
    }
    if (bestKey) out.set(mid, { key: bestKey, name: bestName });
  }
  return out;
}

export function inScopeTeam(teamId: string, opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null }): boolean {
  if (opts.role === "sales_director") {
    if (!opts.directorTeamFilter || opts.directorTeamFilter === "__all__") return true;
    return teamId === opts.directorTeamFilter;
  }
  if (opts.role === "team_lead") return teamId === opts.persona.teamId;
  if (opts.role === "sales_manager") return teamId === opts.persona.teamId;
  return false;
}

export function inScopeManager(managerId: string, opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null }): boolean {
  if (opts.role === "sales_manager") return managerId === opts.persona.id;
  if (opts.role === "team_lead") {
    return getTeamManagers(opts.persona.teamId ?? "").some((m) => m.id === managerId);
  }
  if (opts.role === "sales_director") {
    const m = getAllSalesManagers().find((x) => x.id === managerId);
    if (!m?.teamId) return false;
    return inScopeTeam(m.teamId, opts);
  }
  return false;
}

function linesForPeriod(state: SalesPlanFactPersistedState, periodId: string): SalesPlanFactLine[] {
  return state.lines.filter((l) => l.periodId === periodId);
}

function sumManagerMetrics(
  lines: SalesPlanFactLine[],
  pred: (l: SalesPlanFactLine) => boolean,
): { plan: number; actual: number | null } {
  let plan = 0;
  let actualSum = 0;
  let missing = false;
  for (const met of SALES_KPI_METRICS_SORTED) {
    const L = lines.find((l) => l.rollup === "manager" && l.metricId === met.id && pred(l));
    const pv = L?.planValue ?? 0;
    plan += pv;
    if (L && L.actualValue !== null && L.actualValue !== undefined) actualSum += L.actualValue;
    else missing = true;
  }
  if (missing) return { plan, actual: null };
  return { plan, actual: actualSum };
}

export function buildPeriodSummary(
  state: SalesPlanFactPersistedState,
  periodId: string,
  periodLabel: string,
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null },
): PeriodSummaryModel {
  const lines = linesForPeriod(state, periodId);
  const managers = getAllSalesManagers().filter((m) => m.teamId && inScopeTeam(m.teamId, opts) && inScopeManager(m.id, opts));

  let totalPlan = 0;
  let totalActual = 0;
  let missingAny = false;
  for (const m of managers) {
    const s = sumManagerMetrics(lines, (l) => l.managerId === m.id);
    totalPlan += s.plan;
    if (s.actual === null) missingAny = true;
    else totalActual += s.actual;
  }

  const totalActualOut = missingAny ? null : totalActual;
  const completionPct =
    totalActualOut !== null && totalPlan > 0 ? Math.round((totalActualOut / totalPlan) * 1000) / 10 : totalPlan <= 0 ? null : null;
  const remaining =
    totalActualOut !== null && totalPlan > 0 ? Math.max(0, totalPlan - totalActualOut) : totalPlan > 0 ? null : null;

  let managersWithFact = 0;
  for (const m of managers) {
    const s = sumManagerMetrics(lines, (l) => l.managerId === m.id);
    if (s.actual !== null) managersWithFact += 1;
  }

  const teams = SALES_TEAMS.filter((t) => inScopeTeam(t.id, opts));

  return {
    periodId,
    periodLabel,
    totalPlan,
    totalActual: totalActualOut,
    completionPct,
    remaining,
    ropCount: teams.length,
    managerCount: managers.length,
    managersWithFact,
    managersWithoutFact: managers.length - managersWithFact,
  };
}

export function buildKpiBars(
  state: SalesPlanFactPersistedState,
  periodId: string,
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null },
): KpiBarModel[] {
  const lines = linesForPeriod(state, periodId);
  const managers = getAllSalesManagers().filter((m) => m.teamId && inScopeTeam(m.teamId, opts) && inScopeManager(m.id, opts));
  return SALES_KPI_METRICS_SORTED.map((met) => {
    let plan = 0;
    let missing = false;
    let sumAct = 0;
    for (const m of managers) {
      const L = lines.find((l) => l.rollup === "manager" && l.managerId === m.id && l.metricId === met.id);
      plan += L?.planValue ?? 0;
      if (L && L.actualValue !== null && L.actualValue !== undefined) sumAct += L.actualValue;
      else missing = true;
    }
    const actual = missing ? null : sumAct;
    const pct = actual !== null && plan > 0 ? Math.round((actual / plan) * 1000) / 10 : plan <= 0 ? null : null;
    const remaining = actual !== null && plan > 0 ? Math.max(0, plan - actual) : plan > 0 ? null : null;
    return {
      metricId: met.id,
      label: met.label,
      unit: met.unit,
      plan,
      actual,
      pct,
      remaining,
    };
  });
}

export function buildRopRows(
  state: SalesPlanFactPersistedState,
  periodId: string,
  dealers: DealerRow[],
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null },
): RopAccordionRowModel[] {
  const lines = linesForPeriod(state, periodId);
  const cityByMgr = buildPrimaryCityByManager(dealers);
  const teams = SALES_TEAMS.filter((t) => inScopeTeam(t.id, opts));

  return teams.map((team) => {
    const mgrs = getTeamManagers(team.id).filter((m) => inScopeManager(m.id, opts));
    const tl = getTeamLeadForTeam(team.id);
    let plan = 0;
    let teamMissing = false;
    let actSum = 0;
    for (const m of mgrs) {
      const s = sumManagerMetrics(lines, (l) => l.managerId === m.id);
      plan += s.plan;
      if (s.actual === null) teamMissing = true;
      else actSum += s.actual;
    }
    const actual = teamMissing ? null : actSum;
    const pct = actual !== null && plan > 0 ? Math.round((actual / plan) * 1000) / 10 : null;
    let withoutFact = 0;
    const managers: ManagerCardModel[] = mgrs.map((m) => {
      const s = sumManagerMetrics(lines, (l) => l.managerId === m.id);
      if (s.actual === null) withoutFact += 1;
      const c = cityByMgr.get(m.id);
      return {
        managerId: m.id,
        name: m.name,
        teamId: team.id,
        plan: s.plan,
        actual: s.actual,
        completionPct:
          s.actual !== null && s.plan > 0 ? Math.round((s.actual / s.plan) * 1000) / 10 : s.plan <= 0 ? null : null,
        primaryCity: c?.name ?? "—",
        primaryCityKey: c?.key ?? "no-city",
      };
    });
    return {
      teamId: team.id,
      ropName: tl?.name ?? "—",
      teamName: team.name,
      plan,
      actual,
      completionPct: pct,
      managerCount: mgrs.length,
      withoutFact,
      managers,
    };
  });
}

export function buildCityRows(
  state: SalesPlanFactPersistedState,
  periodId: string,
  dealers: DealerRow[],
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null },
): CityRowModel[] {
  const byCity = new Map<string, { name: string; managers: Set<string> }>();
  for (const d of dealers) {
    const mid = d.releaseManagerId?.trim();
    if (!mid || !inScopeManager(mid, opts)) continue;
    const name = (d.city ?? "").trim() || "Без города";
    const key = slugCity(name);
    const g = byCity.get(key) ?? { name, managers: new Set() };
    g.managers.add(mid);
    byCity.set(key, g);
  }
  const lines = linesForPeriod(state, periodId);
  const rows: CityRowModel[] = [];
  for (const [cityKey, g] of Array.from(byCity.entries())) {
    const s = sumManagerMetrics(lines, (l) => Boolean(l.managerId && g.managers.has(l.managerId)));
    rows.push({
      cityKey,
      cityName: g.name,
      plan: s.plan,
      actual: s.actual,
      completionPct:
        s.actual !== null && s.plan > 0 ? Math.round((s.actual / s.plan) * 1000) / 10 : s.plan <= 0 ? null : null,
      managerCount: g.managers.size,
    });
  }
  rows.sort((a, b) => b.plan - a.plan || a.cityName.localeCompare(b.cityName, "ru"));
  return rows;
}

export function buildProductRows(
  state: SalesPlanFactPersistedState,
  periodId: string,
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null },
): ProductRowModel[] {
  const lines = linesForPeriod(state, periodId);
  const managers = getAllSalesManagers().filter((m) => m.teamId && inScopeTeam(m.teamId, opts) && inScopeManager(m.id, opts));
  return SALES_KPI_METRICS_SORTED.map((met) => {
    let plan = 0;
    let missing = false;
    let sumAct = 0;
    for (const m of managers) {
      const L = lines.find((l) => l.rollup === "manager" && l.managerId === m.id && l.metricId === met.id);
      plan += L?.planValue ?? 0;
      if (L && L.actualValue !== null && L.actualValue !== undefined) sumAct += L.actualValue;
      else missing = true;
    }
    const actual = missing ? null : sumAct;
    return {
      productId: met.id,
      productName: met.label,
      plan,
      actual,
      completionPct: actual !== null && plan > 0 ? Math.round((actual / plan) * 1000) / 10 : plan <= 0 ? null : null,
    };
  });
}

export function buildAttentionZones(
  state: SalesPlanFactPersistedState,
  periodId: string,
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null },
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const lines = linesForPeriod(state, periodId);
  const teams = SALES_TEAMS.filter((t) => inScopeTeam(t.id, opts));

  for (const team of teams) {
    const pub = lines.some((l) => l.rollup === "team" && l.teamId === team.id);
    const mgrs = getTeamManagers(team.id).filter((m) => inScopeManager(m.id, opts));
    if (!pub && mgrs.length > 0 && opts.role === "sales_director") {
      items.push({
        id: `no-team-plan-${team.id}`,
        kind: "no_team_plan",
        title: getTeamById(team.id)?.name ?? team.id,
        subtitle: "Командный план директора не зафиксирован в persisted-слое за период.",
      });
    }
  }

  for (const m of getAllSalesManagers()) {
    if (!inScopeManager(m.id, opts)) continue;
    const s = sumManagerMetrics(lines, (l) => l.managerId === m.id);
    if (s.plan <= 0) {
      items.push({
        id: `noplan-${m.id}`,
        kind: "no_plan",
        title: m.name,
        subtitle: "Нет сохранённого плана по KPI за период.",
      });
      continue;
    }
    if (s.actual === null) {
      items.push({
        id: `nofact-${m.id}`,
        kind: "no_fact",
        title: m.name,
        subtitle: "Факт не внесён по одному или нескольким KPI.",
      });
    } else if (s.plan > 0 && s.actual < s.plan * 0.7) {
      items.push({
        id: `low-${m.id}`,
        kind: "low_completion",
        title: m.name,
        subtitle: "Выполнение ниже 70% по сумме KPI.",
      });
    }
    for (const met of SALES_KPI_METRICS_SORTED) {
      const L = lines.find((l) => l.rollup === "manager" && l.managerId === m.id && l.metricId === met.id);
      if (L?.status === "changed_after_publish") {
        items.push({
          id: `chg-${m.id}-${met.id}`,
          kind: "changed_after_publish",
          title: `${m.name} · ${met.label}`,
          subtitle: "Статус: изменено после выгрузки.",
        });
      }
    }
  }

  return items.slice(0, 12);
}

export function formatPlanFactValue(metricId: string, value: number): string {
  const met = SALES_KPI_METRICS_SORTED.find((m) => m.id === metricId);
  if (!met) return String(value);
  if (met.unit === "money_rub") return formatRub(value);
  return formatSalesMetricValue(met, value);
}

export function topRopsByCompletion(rows: RopAccordionRowModel[], n = 3): RopAccordionRowModel[] {
  const ranked = [...rows].filter((r) => r.completionPct !== null).sort((a, b) => (b.completionPct ?? 0) - (a.completionPct ?? 0));
  return ranked.slice(0, n);
}

export function getPreviousSalesPeriodId(periodId: string): string | null {
  const idx = SALES_PLAN_PERIODS.findIndex((p) => p.id === periodId);
  if (idx <= 0) return null;
  return SALES_PLAN_PERIODS[idx - 1]?.id ?? null;
}

/** Есть ли в периоде хотя бы одна сохранённая цель planValue &gt; 0 в текущем scope (команда или менеджер). */
export function periodHasAnyPositivePlan(
  state: SalesPlanFactPersistedState,
  periodId: string,
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null },
): boolean {
  for (const l of state.lines) {
    if (l.periodId !== periodId || l.planValue <= 0) continue;
    if (l.rollup === "team" && inScopeTeam(l.teamId, opts)) return true;
    if (l.rollup === "manager" && l.managerId && inScopeManager(l.managerId, opts)) return true;
  }
  return false;
}

/** Краткая подпись для шапки карточки РОПа: без «план 0» как будто это осознанный ноль. */
export function formatRopAggregatePlanFactLine(plan: number, actual: number | null, completionPct: number | null): string {
  if (plan <= 0) {
    return actual === null ? "План не задан · Факт не внесён" : "План не задан · Факт внесён";
  }
  if (actual === null) {
    return `План ${plan.toLocaleString("ru-RU")} · Факт не внесён`;
  }
  const pct =
    completionPct !== null && completionPct !== undefined
      ? ` · Выполнение ${completionPct}%`
      : "";
  return `План ${plan.toLocaleString("ru-RU")} · Факт ${actual.toLocaleString("ru-RU")}${pct}`;
}

export function formatManagerPlanFactShort(plan: number, actual: number | null): string {
  const planPart = plan > 0 ? `план ${plan.toLocaleString("ru-RU")}` : "план не задан";
  const actPart = actual === null ? "факт не внесён" : `факт ${actual.toLocaleString("ru-RU")}`;
  return `${planPart} · ${actPart}`;
}
