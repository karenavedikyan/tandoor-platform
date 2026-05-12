/**
 * План-факт продаж: mock/data-слой для контура «План-факт и управление продажами».
 * Новые KPI добавляются через массив SALES_KPI_METRICS (и при необходимости сиды).
 */

export type SalesRole = "sales_director" | "team_lead" | "sales_manager" | "marketer" | "analyst";

export type SalesKpiUnit = "units" | "money_rub" | "score";

/** Позиция KPI в справочнике — расширяйте массивом SALES_KPI_METRICS. */
export type SalesKpiMetric = {
  id: string;
  label: string;
  unit: SalesKpiUnit;
  /** Чем меньше, тем выше в списках по умолчанию */
  sortOrder: number;
};

export type SalesTeam = {
  id: string;
  name: string;
  leadId: string;
};

export type SalesUser = {
  id: string;
  name: string;
  role: SalesRole;
  /** Для руководителя команды и менеджеров */
  teamId?: string;
};

export type SalesPlanPeriod = {
  id: string;
  label: string;
};

export type SalesPlanTarget = {
  periodId: string;
  managerId: string;
  teamId: string;
  metricId: string;
  targetValue: number;
  updatedAt: string;
};

export type SalesPlanActual = {
  periodId: string;
  managerId: string;
  teamId: string;
  metricId: string;
  actualValue: number;
  updatedAt: string;
};

export type SalesPlanComment = {
  periodId: string;
  managerId: string;
  teamId: string;
  text: string;
  updatedAt: string;
};

/** Сводная строка плана (период × менеджер × метрика + валовая прибыль + комментарий). */
export type SalesPlanLine = {
  periodId: string;
  managerId: string;
  teamId: string;
  metricId: string;
  targetValue: number;
  actualValue: number;
  grossProfitTarget: number;
  grossProfitActual: number;
  comment: string;
  updatedAt: string;
};

const STORAGE_KEY = "tandoor-sales-control-overrides-v1";

export function salesControlMetricCellKey(periodId: string, managerId: string, metricId: string): string {
  return `${periodId}|${managerId}|${metricId}`;
}

export function salesControlManagerPeriodKey(periodId: string, managerId: string): string {
  return `${periodId}|${managerId}`;
}

/** Справочник KPI — для добавления позиций достаточно дописать элемент сюда. */
export const SALES_KPI_METRICS: SalesKpiMetric[] = [
  { id: "kpi-vh", label: "Продажи ВХ", unit: "units", sortOrder: 10 },
  { id: "kpi-mk", label: "Продажи МК", unit: "units", sortOrder: 20 },
  { id: "kpi-furniture", label: "Фурнитура (оборот)", unit: "money_rub", sortOrder: 30 },
  { id: "kpi-client-activity", label: "Активность по клиентам", unit: "score", sortOrder: 40 },
];

export const SALES_KPI_METRICS_SORTED: SalesKpiMetric[] = [...SALES_KPI_METRICS].sort((a, b) => a.sortOrder - b.sortOrder);

export const SALES_PLAN_PERIODS: SalesPlanPeriod[] = [
  { id: "p-2026-04", label: "Апрель 2026" },
  { id: "p-2026-05", label: "Май 2026" },
  { id: "p-2026-06", label: "Июнь 2026" },
];

const DIRECTOR: SalesUser = {
  id: "user-dir-1",
  name: "Сергей Орлов",
  role: "sales_director",
};

const TEAM_LEADS: SalesUser[] = [
  { id: "user-tl-1", name: "Марина Волкова", role: "team_lead", teamId: "team-1" },
  { id: "user-tl-2", name: "Игорь Семёнов", role: "team_lead", teamId: "team-2" },
  { id: "user-tl-3", name: "Елена Крылова", role: "team_lead", teamId: "team-3" },
];

const MARKETER: SalesUser = { id: "user-mkt-1", name: "Артём Писков", role: "marketer" };
const ANALYST: SalesUser = { id: "user-anl-1", name: "Дарья Мельник", role: "analyst" };

function buildManagers(teamId: string, teamIdx: number): SalesUser[] {
  const firstNames = ["Антон", "Олег", "Ксения", "Павел", "Виктор", "Наталья", "Дмитрий"];
  const lastInitials = ["И.", "П.", "С.", "К.", "Л.", "М.", "Т."];
  return firstNames.map((fn, i) => ({
    id: `user-sm-t${teamIdx}-m${i + 1}`,
    name: `${fn} ${lastInitials[i]}`,
    role: "sales_manager" as const,
    teamId,
  }));
}

export const SALES_TEAMS: SalesTeam[] = [
  { id: "team-1", name: "Команда «Север»", leadId: "user-tl-1" },
  { id: "team-2", name: "Команда «Юг»", leadId: "user-tl-2" },
  { id: "team-3", name: "Команда «Восток»", leadId: "user-tl-3" },
];

const MANAGERS_T1 = buildManagers("team-1", 1);
const MANAGERS_T2 = buildManagers("team-2", 2);
const MANAGERS_T3 = buildManagers("team-3", 3);

export const SALES_USERS: SalesUser[] = [
  DIRECTOR,
  ...TEAM_LEADS,
  ...MANAGERS_T1,
  ...MANAGERS_T2,
  ...MANAGERS_T3,
  MARKETER,
  ANALYST,
];

export function getSalesUserById(id: string): SalesUser | undefined {
  return SALES_USERS.find((u) => u.id === id);
}

export function getTeamById(teamId: string): SalesTeam | undefined {
  return SALES_TEAMS.find((t) => t.id === teamId);
}

export function getTeamManagers(teamId: string): SalesUser[] {
  return SALES_USERS.filter((u) => u.role === "sales_manager" && u.teamId === teamId);
}

export function getAllSalesManagers(): SalesUser[] {
  return SALES_USERS.filter((u) => u.role === "sales_manager");
}

export function getTeamLeadForTeam(teamId: string): SalesUser | undefined {
  return SALES_USERS.find((u) => u.role === "team_lead" && u.teamId === teamId);
}

/** Детерминированное «зерно» из строки для стабильных mock-значений */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seededNumber(seed: string, min: number, max: number): number {
  const h = hashSeed(seed);
  return min + (h % (max - min + 1));
}

function buildSeedTargetsAndActuals(): { targets: SalesPlanTarget[]; actuals: SalesPlanActual[] } {
  const targets: SalesPlanTarget[] = [];
  const actuals: SalesPlanActual[] = [];
  const managers = getAllSalesManagers();
  for (const period of SALES_PLAN_PERIODS) {
    for (const m of managers) {
      const teamId = m.teamId ?? "";
      const updatedAt = "2026-05-01T08:00:00.000Z";
      for (const metric of SALES_KPI_METRICS_SORTED) {
        const base = seededNumber(`${period.id}|${m.id}|${metric.id}|t`, 1, 999);
        let target: number;
        let actual: number;
        if (metric.unit === "units") {
          target = 30 + (base % 120);
          actual = Math.floor(target * (0.55 + (base % 40) / 100));
        } else if (metric.unit === "money_rub") {
          target = 800_000 + (base % 50) * 120_000;
          actual = Math.floor(target * (0.5 + (base % 35) / 100));
        } else {
          target = 40 + (base % 40);
          actual = Math.floor(target * (0.6 + (base % 30) / 100));
        }
        targets.push({
          periodId: period.id,
          managerId: m.id,
          teamId,
          metricId: metric.id,
          targetValue: target,
          updatedAt,
        });
        actuals.push({
          periodId: period.id,
          managerId: m.id,
          teamId,
          metricId: metric.id,
          actualValue: actual,
          updatedAt,
        });
      }
    }
  }
  return { targets, actuals };
}

const SEED = buildSeedTargetsAndActuals();

export function getSeedSalesPlanTargets(): SalesPlanTarget[] {
  return SEED.targets;
}

export function getSeedSalesPlanActuals(): SalesPlanActual[] {
  return SEED.actuals;
}

function seedGrossProfitTarget(periodId: string, managerId: string): number {
  const base = seededNumber(`${periodId}|${managerId}|gp`, 1, 500);
  return 2_400_000 + base * 18_000;
}

function seedGrossProfitActual(periodId: string, managerId: string): number {
  const t = seedGrossProfitTarget(periodId, managerId);
  const k = 0.62 + (seededNumber(`${periodId}|${managerId}|gpa`, 0, 35) / 100);
  return Math.floor(t * k);
}

function seedComment(periodId: string, managerId: string): string {
  const variants = [
    "Держим фокус на витрине ВХ и обучении персонала точки.",
    "Нужна поддержка по фурнитуре — донабор ассортимента.",
    "План выполним при усилении визитов в ТОП-точки.",
  ];
  return variants[seededNumber(`${periodId}|${managerId}|c`, 0, variants.length - 1)];
}

export type SalesControlStoredState = {
  targets: Record<string, number>;
  actuals: Record<string, number>;
  grossProfitTargets: Record<string, number>;
  grossProfitActuals: Record<string, number>;
  comments: Record<string, string>;
  /** ISO время последнего сохранения по менеджеру и периоду */
  managerPeriodUpdatedAt: Record<string, string>;
};

const EMPTY_STORED: SalesControlStoredState = {
  targets: {},
  actuals: {},
  grossProfitTargets: {},
  grossProfitActuals: {},
  comments: {},
  managerPeriodUpdatedAt: {},
};

export function loadSalesControlStoredState(): SalesControlStoredState {
  if (typeof window === "undefined" || !window.sessionStorage) return { ...EMPTY_STORED };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STORED };
    const parsed = JSON.parse(raw) as Partial<SalesControlStoredState>;
    return {
      targets: parsed.targets ?? {},
      actuals: parsed.actuals ?? {},
      grossProfitTargets: parsed.grossProfitTargets ?? {},
      grossProfitActuals: parsed.grossProfitActuals ?? {},
      comments: parsed.comments ?? {},
      managerPeriodUpdatedAt: parsed.managerPeriodUpdatedAt ?? {},
    };
  } catch {
    return { ...EMPTY_STORED };
  }
}

export function saveSalesControlStoredState(state: SalesControlStoredState): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getSeedTarget(periodId: string, managerId: string, metricId: string): number | undefined {
  return SEED.targets.find((t) => t.periodId === periodId && t.managerId === managerId && t.metricId === metricId)?.targetValue;
}

export function getSeedActual(periodId: string, managerId: string, metricId: string): number | undefined {
  return SEED.actuals.find((a) => a.periodId === periodId && a.managerId === managerId && a.metricId === metricId)?.actualValue;
}

export function mergeStoredNumber(
  stored: Record<string, number>,
  key: string,
  seed: number | undefined,
): number {
  if (stored[key] !== undefined && !Number.isNaN(stored[key])) return stored[key];
  return seed ?? 0;
}

export function mergeStoredString(stored: Record<string, string>, key: string, seed: string): string {
  if (Object.prototype.hasOwnProperty.call(stored, key)) return stored[key];
  return seed;
}

export function getTargetValue(
  periodId: string,
  managerId: string,
  metricId: string,
  stored: SalesControlStoredState,
): number {
  const key = salesControlMetricCellKey(periodId, managerId, metricId);
  return mergeStoredNumber(stored.targets, key, getSeedTarget(periodId, managerId, metricId));
}

export function getActualValue(
  periodId: string,
  managerId: string,
  metricId: string,
  stored: SalesControlStoredState,
): number {
  const key = salesControlMetricCellKey(periodId, managerId, metricId);
  return mergeStoredNumber(stored.actuals, key, getSeedActual(periodId, managerId, metricId));
}

export function getGrossProfitTarget(periodId: string, managerId: string, stored: SalesControlStoredState): number {
  const key = salesControlManagerPeriodKey(periodId, managerId);
  return mergeStoredNumber(stored.grossProfitTargets, key, seedGrossProfitTarget(periodId, managerId));
}

export function getGrossProfitActual(periodId: string, managerId: string, stored: SalesControlStoredState): number {
  const key = salesControlManagerPeriodKey(periodId, managerId);
  return mergeStoredNumber(stored.grossProfitActuals, key, seedGrossProfitActual(periodId, managerId));
}

export function getPlanComment(periodId: string, managerId: string, stored: SalesControlStoredState): string {
  const key = salesControlManagerPeriodKey(periodId, managerId);
  return mergeStoredString(stored.comments, key, seedComment(periodId, managerId));
}

export function getPlanUpdatedAt(periodId: string, managerId: string, stored: SalesControlStoredState): string {
  const key = salesControlManagerPeriodKey(periodId, managerId);
  if (stored.managerPeriodUpdatedAt[key]) return stored.managerPeriodUpdatedAt[key];
  return "2026-05-01T08:00:00.000Z";
}

export function buildPlanLine(
  periodId: string,
  managerId: string,
  teamId: string,
  metricId: string,
  stored: SalesControlStoredState,
): SalesPlanLine {
  return {
    periodId,
    managerId,
    teamId,
    metricId,
    targetValue: getTargetValue(periodId, managerId, metricId, stored),
    actualValue: getActualValue(periodId, managerId, metricId, stored),
    grossProfitTarget: getGrossProfitTarget(periodId, managerId, stored),
    grossProfitActual: getGrossProfitActual(periodId, managerId, stored),
    comment: getPlanComment(periodId, managerId, stored),
    updatedAt: getPlanUpdatedAt(periodId, managerId, stored),
  };
}

export function completionPercent(target: number, actual: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 1000) / 10);
}

export function formatSalesMetricValue(metric: SalesKpiMetric, value: number): string {
  if (metric.unit === "units") return `${Math.round(value)} шт.`;
  if (metric.unit === "money_rub") {
    if (value >= 1_000_000) return `${(Math.round((value / 1_000_000) * 10) / 10).toLocaleString("ru-RU")} млн ₽`;
    if (value >= 1000) return `${Math.round(value / 1000).toLocaleString("ru-RU")} тыс. ₽`;
    return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
  }
  return `${Math.round(value)} баллов`;
}

export function formatRub(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export type SalesDirectorAggregate = {
  metricId: string;
  label: string;
  unit: SalesKpiUnit;
  targetSum: number;
  actualSum: number;
  pct: number;
};

export function aggregateDirectorKpis(
  periodId: string,
  managerIds: string[] | null,
  stored: SalesControlStoredState,
): SalesDirectorAggregate[] {
  const managers =
    managerIds == null ? getAllSalesManagers().map((m) => m.id) : managerIds.filter((id) => getSalesUserById(id)?.role === "sales_manager");
  return SALES_KPI_METRICS_SORTED.map((metric) => {
    let targetSum = 0;
    let actualSum = 0;
    for (const mid of managers) {
      targetSum += getTargetValue(periodId, mid, metric.id, stored);
      actualSum += getActualValue(periodId, mid, metric.id, stored);
    }
    return {
      metricId: metric.id,
      label: metric.label,
      unit: metric.unit,
      targetSum,
      actualSum,
      pct: completionPercent(targetSum, actualSum),
    };
  });
}

export function aggregateGrossProfit(
  periodId: string,
  managerIds: string[] | null,
  stored: SalesControlStoredState,
): { target: number; actual: number; pct: number } {
  const managers =
    managerIds == null ? getAllSalesManagers().map((m) => m.id) : managerIds.filter((id) => getSalesUserById(id)?.role === "sales_manager");
  let target = 0;
  let actual = 0;
  for (const mid of managers) {
    target += getGrossProfitTarget(periodId, mid, stored);
    actual += getGrossProfitActual(periodId, mid, stored);
  }
  return { target, actual, pct: completionPercent(target, actual) };
}

export type SalesTeamPeriodRollup = {
  teamId: string;
  teamName: string;
  metrics: SalesDirectorAggregate[];
  gross: { target: number; actual: number; pct: number };
  avgMetricPct: number;
};

export function rollupTeam(
  teamId: string,
  periodId: string,
  stored: SalesControlStoredState,
): SalesTeamPeriodRollup {
  const mgrs = getTeamManagers(teamId).map((m) => m.id);
  const metrics = aggregateDirectorKpis(periodId, mgrs, stored);
  const gross = aggregateGrossProfit(periodId, mgrs, stored);
  const avgMetricPct =
    metrics.length === 0 ? 0 : Math.round((metrics.reduce((s, m) => s + m.pct, 0) / metrics.length) * 10) / 10;
  const team = getTeamById(teamId);
  return {
    teamId,
    teamName: team?.name ?? teamId,
    metrics,
    gross,
    avgMetricPct,
  };
}

export type SalesManagerPeriodRollup = {
  managerId: string;
  managerName: string;
  teamId: string;
  teamName: string;
  metrics: { metric: SalesKpiMetric; target: number; actual: number; pct: number }[];
  gross: { target: number; actual: number; pct: number };
  comment: string;
  updatedAt: string;
};

export function rollupManager(managerId: string, periodId: string, stored: SalesControlStoredState): SalesManagerPeriodRollup | undefined {
  const u = getSalesUserById(managerId);
  if (!u || u.role !== "sales_manager" || !u.teamId) return undefined;
  const team = getTeamById(u.teamId);
  const metrics = SALES_KPI_METRICS_SORTED.map((metric) => {
    const target = getTargetValue(periodId, managerId, metric.id, stored);
    const actual = getActualValue(periodId, managerId, metric.id, stored);
    return { metric, target, actual, pct: completionPercent(target, actual) };
  });
  const gt = getGrossProfitTarget(periodId, managerId, stored);
  const ga = getGrossProfitActual(periodId, managerId, stored);
  return {
    managerId,
    managerName: u.name,
    teamId: u.teamId,
    teamName: team?.name ?? u.teamId,
    metrics,
    gross: { target: gt, actual: ga, pct: completionPercent(gt, ga) },
    comment: getPlanComment(periodId, managerId, stored),
    updatedAt: getPlanUpdatedAt(periodId, managerId, stored),
  };
}

function touchManagerPeriod(
  prev: SalesControlStoredState,
  periodId: string,
  managerId: string,
): SalesControlStoredState {
  const mk = salesControlManagerPeriodKey(periodId, managerId);
  return {
    ...prev,
    managerPeriodUpdatedAt: {
      ...prev.managerPeriodUpdatedAt,
      [mk]: new Date().toISOString(),
    },
  };
}

/** Руководитель команды: сохранить планы (цели по KPI, валовая прибыль, комментарий). */
export function applyTeamLeadPlanSave(
  prev: SalesControlStoredState,
  periodId: string,
  managerId: string,
  metricTargets: Record<string, number>,
  grossProfitTarget: number,
  comment: string,
): SalesControlStoredState {
  let next: SalesControlStoredState = { ...prev, targets: { ...prev.targets }, comments: { ...prev.comments } };
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  for (const [metricId, value] of Object.entries(metricTargets)) {
    const key = salesControlMetricCellKey(periodId, managerId, metricId);
    next.targets[key] = value;
  }
  next.grossProfitTargets = { ...next.grossProfitTargets, [mp]: grossProfitTarget };
  next.comments = { ...next.comments, [mp]: comment };
  next = touchManagerPeriod(next, periodId, managerId);
  return next;
}

/** Менеджер: сохранить факт по KPI и валовой прибыли. */
export function applyManagerActualsSave(
  prev: SalesControlStoredState,
  periodId: string,
  managerId: string,
  metricActuals: Record<string, number>,
  grossProfitActual: number,
): SalesControlStoredState {
  let next: SalesControlStoredState = { ...prev, actuals: { ...prev.actuals } };
  for (const [metricId, value] of Object.entries(metricActuals)) {
    const key = salesControlMetricCellKey(periodId, managerId, metricId);
    next.actuals[key] = value;
  }
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  next.grossProfitActuals = { ...next.grossProfitActuals, [mp]: grossProfitActual };
  next = touchManagerPeriod(next, periodId, managerId);
  return next;
}

/** Дефолтный период — последний в списке (текущий контурный месяц). */
export function getDefaultSalesPeriodId(): string {
  return SALES_PLAN_PERIODS[SALES_PLAN_PERIODS.length - 1]?.id ?? "p-2026-05";
}
