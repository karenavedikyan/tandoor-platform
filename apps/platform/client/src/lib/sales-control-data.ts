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
export const SALES_CONTROL_SCHEMA_VERSION = 3 as const;

/** ID пользователя-руководителя продаж (mock). */
export const SALES_DIRECTOR_USER_ID = "user-dir-goncharenko";

export function salesControlMetricCellKey(periodId: string, managerId: string, metricId: string): string {
  return `${periodId}|${managerId}|${metricId}`;
}

export function salesControlManagerPeriodKey(periodId: string, managerId: string): string {
  return `${periodId}|${managerId}`;
}

export function salesControlTeamPeriodKey(periodId: string, teamId: string): string {
  return `${periodId}|${teamId}`;
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
  id: "user-dir-goncharenko",
  name: "Гончаренко Дмитрий",
  role: "sales_director",
};

const TEAM_LEADS: SalesUser[] = [
  { id: "user-tl-kupiansky", name: "Купянский Родион", role: "team_lead", teamId: "team-kupiansky" },
  { id: "user-tl-skalaban", name: "Скалабан Александр", role: "team_lead", teamId: "team-skalaban" },
  { id: "user-tl-sapozhkov", name: "Сапожков Артем", role: "team_lead", teamId: "team-sapozhkov" },
];

const MARKETERS: SalesUser[] = [
  { id: "user-mkt-morozova", name: "Морозова Мила", role: "marketer" },
  { id: "user-mkt-kotlyarov", name: "Котляров Антон", role: "marketer" },
];

const ANALYST: SalesUser = { id: "user-anl-ivanets", name: "Иванец Данил", role: "analyst" };

const MANAGERS_K: SalesUser[] = [
  { id: "mgr-boyko-em", name: "Бойко Екатерина Михайловна", role: "sales_manager", teamId: "team-kupiansky" },
  { id: "mgr-yakubova-ys", name: "Якубова Юлия Сергеевна", role: "sales_manager", teamId: "team-kupiansky" },
  { id: "mgr-fedorov-dv", name: "Федоров Данил Владимирович", role: "sales_manager", teamId: "team-kupiansky" },
  { id: "mgr-ponkratova-vv", name: "Понкратова Василиса Владимировна", role: "sales_manager", teamId: "team-kupiansky" },
  { id: "mgr-avetisyan-rs", name: "Аветисян Рачик Сергеевич", role: "sales_manager", teamId: "team-kupiansky" },
  { id: "mgr-sklyarov-dv", name: "Скляров Давид Владимирович", role: "sales_manager", teamId: "team-kupiansky" },
  { id: "mgr-orlov-dv", name: "Орлов Денис Валерьевич", role: "sales_manager", teamId: "team-kupiansky" },
];

const MANAGERS_S: SalesUser[] = [
  { id: "mgr-agadzhanyan-rs", name: "Агаджанян Родион Самвелович", role: "sales_manager", teamId: "team-skalaban" },
  { id: "mgr-doronina-iv", name: "Доронина Ирина Васильевна (Опт)", role: "sales_manager", teamId: "team-skalaban" },
  { id: "mgr-ilyuchenko-an", name: "Илюченко Александр Николаевич", role: "sales_manager", teamId: "team-skalaban" },
  { id: "mgr-miroshnichenko-dn", name: "Мирошниченко Денис Николаевич", role: "sales_manager", teamId: "team-skalaban" },
  { id: "mgr-lysenko-eg", name: "Лысенко Екатерина Геннадьевна", role: "sales_manager", teamId: "team-skalaban" },
  { id: "mgr-kulakova-os", name: "Кулакова Олеся Сергеевна", role: "sales_manager", teamId: "team-skalaban" },
  { id: "mgr-yakubova-voronezh", name: "Якубова Юлия (Воронеж)", role: "sales_manager", teamId: "team-skalaban" },
];

const MANAGERS_SA: SalesUser[] = [
  { id: "mgr-koteneva-av", name: "Котенева Анастасия Валерьевна", role: "sales_manager", teamId: "team-sapozhkov" },
  { id: "mgr-netkacheva-ia", name: "Неткачева Инна Алексеевна", role: "sales_manager", teamId: "team-sapozhkov" },
  { id: "mgr-petrichenko-ev", name: "Петриченко Елена Викторовна", role: "sales_manager", teamId: "team-sapozhkov" },
  { id: "mgr-arutyunyan-oa", name: "Арутюнян Оганес Ашотович", role: "sales_manager", teamId: "team-sapozhkov" },
  { id: "mgr-osmanov-fm", name: "Османов Фарид Магомедович", role: "sales_manager", teamId: "team-sapozhkov" },
  { id: "mgr-chernousova-in", name: "Черноусова Ия Николаевна", role: "sales_manager", teamId: "team-sapozhkov" },
  { id: "mgr-yarysh-si", name: "Ярыш Сергей Игоревич", role: "sales_manager", teamId: "team-sapozhkov" },
];

export const SALES_TEAMS: SalesTeam[] = [
  { id: "team-kupiansky", name: "Команда Купянский Родион", leadId: "user-tl-kupiansky" },
  { id: "team-skalaban", name: "Команда Скалабан Александр", leadId: "user-tl-skalaban" },
  { id: "team-sapozhkov", name: "Команда Сапожков Артем", leadId: "user-tl-sapozhkov" },
];

export const SALES_USERS: SalesUser[] = [
  DIRECTOR,
  ...TEAM_LEADS,
  ...MANAGERS_K,
  ...MANAGERS_S,
  ...MANAGERS_SA,
  ...MARKETERS,
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

export type ManagerPlanPublishStatus = "draft" | "published" | "changed_after_publish";

/** Статус командного плана директора → РОП. */
export type TeamPlanDirectorStatus = "draft" | "published_to_rop" | "changed_after_publish";

/** Черновик плана команды от руководителя продаж (ключ — salesControlTeamPeriodKey). */
export type TeamPlanDraftRecord = {
  metricTargets: Record<string, number>;
  grossProfitTarget: number;
  directorComment: string;
  updatedBy: string;
  updatedAt: string;
};

/** Опубликованный РОПу командный план. */
export type TeamPlanPublicationRecord = {
  metricTargets: Record<string, number>;
  grossProfitTarget: number;
  directorComment: string;
  publishedBy: string;
  publishedAt: string;
};

/** План-факт в sessionStorage: черновик РОПа и опубликованная копия для ЛК менеджера. */
export type SalesControlStoredState = {
  schemaVersion: number;
  /** Черновик целей по KPI (ключ — salesControlMetricCellKey) — планы менеджеров от РОП. */
  draftTargets: Record<string, number>;
  draftGrossProfitTargets: Record<string, number>;
  draftComments: Record<string, string>;
  /** Опубликованные цели (копия на момент «Выгрузить менеджерам»). */
  publishedTargets: Record<string, number>;
  publishedGrossProfitTargets: Record<string, number>;
  publishedComments: Record<string, string>;
  /** ISO время последней выгрузки плана менеджеру (ключ — salesControlManagerPeriodKey). */
  publishedAt: Record<string, string>;
  /** Планы команд от директора (ключ — salesControlTeamPeriodKey). */
  teamPlanDrafts: Record<string, TeamPlanDraftRecord>;
  teamPlanPublications: Record<string, TeamPlanPublicationRecord>;
  /** Общий комментарий РОПа по команде за период (черновик). */
  draftTeamComments: Record<string, string>;
  publishedTeamComments: Record<string, string>;
  publishedTeamAt: Record<string, string>;
  actuals: Record<string, number>;
  grossProfitActuals: Record<string, number>;
  /** ISO время последнего сохранения по менеджеру и периоду */
  managerPeriodUpdatedAt: Record<string, string>;
};

const EMPTY_STORED: SalesControlStoredState = {
  schemaVersion: SALES_CONTROL_SCHEMA_VERSION,
  draftTargets: {},
  draftGrossProfitTargets: {},
  draftComments: {},
  publishedTargets: {},
  publishedGrossProfitTargets: {},
  publishedComments: {},
  publishedAt: {},
  teamPlanDrafts: {},
  teamPlanPublications: {},
  draftTeamComments: {},
  publishedTeamComments: {},
  publishedTeamAt: {},
  actuals: {},
  grossProfitActuals: {},
  managerPeriodUpdatedAt: {},
};

type LegacyStoredV1 = {
  targets?: Record<string, number>;
  grossProfitTargets?: Record<string, number>;
  comments?: Record<string, string>;
  actuals?: Record<string, number>;
  grossProfitActuals?: Record<string, number>;
  managerPeriodUpdatedAt?: Record<string, string>;
};

function migrateSalesControlStoredState(raw: unknown): SalesControlStoredState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STORED };
  const p = raw as Partial<SalesControlStoredState> & LegacyStoredV1;
  const schemaVersion = typeof p.schemaVersion === "number" ? p.schemaVersion : 1;
  if (
    schemaVersion >= SALES_CONTROL_SCHEMA_VERSION &&
    p.draftTargets &&
    typeof p.draftTargets === "object" &&
    p.publishedTargets &&
    typeof p.publishedTargets === "object" &&
    p.teamPlanDrafts &&
    typeof p.teamPlanDrafts === "object" &&
    p.teamPlanPublications &&
    typeof p.teamPlanPublications === "object"
  ) {
    return {
      schemaVersion: SALES_CONTROL_SCHEMA_VERSION,
      draftTargets: { ...p.draftTargets },
      draftGrossProfitTargets: { ...(p.draftGrossProfitTargets ?? {}) },
      draftComments: { ...(p.draftComments ?? {}) },
      publishedTargets: { ...p.publishedTargets },
      publishedGrossProfitTargets: { ...(p.publishedGrossProfitTargets ?? {}) },
      publishedComments: { ...(p.publishedComments ?? {}) },
      publishedAt: { ...(p.publishedAt ?? {}) },
      teamPlanDrafts: { ...(p.teamPlanDrafts ?? {}) },
      teamPlanPublications: { ...(p.teamPlanPublications ?? {}) },
      draftTeamComments: { ...(p.draftTeamComments ?? {}) },
      publishedTeamComments: { ...(p.publishedTeamComments ?? {}) },
      publishedTeamAt: { ...(p.publishedTeamAt ?? {}) },
      actuals: { ...(p.actuals ?? {}) },
      grossProfitActuals: { ...(p.grossProfitActuals ?? {}) },
      managerPeriodUpdatedAt: { ...(p.managerPeriodUpdatedAt ?? {}) },
    };
  }
  const draftTargets = { ...(p.draftTargets ?? p.targets ?? {}) };
  const draftGrossProfitTargets = { ...(p.draftGrossProfitTargets ?? p.grossProfitTargets ?? {}) };
  const draftComments = { ...(p.draftComments ?? p.comments ?? {}) };
  return {
    schemaVersion: SALES_CONTROL_SCHEMA_VERSION,
    draftTargets,
    draftGrossProfitTargets,
    draftComments,
    publishedTargets: { ...(p.publishedTargets ?? {}) },
    publishedGrossProfitTargets: { ...(p.publishedGrossProfitTargets ?? {}) },
    publishedComments: { ...(p.publishedComments ?? {}) },
    publishedAt: { ...(p.publishedAt ?? {}) },
    teamPlanDrafts: { ...((p as Partial<SalesControlStoredState>).teamPlanDrafts ?? {}) },
    teamPlanPublications: { ...((p as Partial<SalesControlStoredState>).teamPlanPublications ?? {}) },
    draftTeamComments: { ...(p.draftTeamComments ?? {}) },
    publishedTeamComments: { ...(p.publishedTeamComments ?? {}) },
    publishedTeamAt: { ...(p.publishedTeamAt ?? {}) },
    actuals: { ...(p.actuals ?? {}) },
    grossProfitActuals: { ...(p.grossProfitActuals ?? {}) },
    managerPeriodUpdatedAt: { ...(p.managerPeriodUpdatedAt ?? {}) },
  };
}

export function loadSalesControlStoredState(): SalesControlStoredState {
  if (typeof window === "undefined" || !window.sessionStorage) return { ...EMPTY_STORED };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STORED };
    const parsed = JSON.parse(raw) as unknown;
    return migrateSalesControlStoredState(parsed);
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
  return mergeStoredNumber(stored.draftTargets, key, getSeedTarget(periodId, managerId, metricId));
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
  return mergeStoredNumber(stored.draftGrossProfitTargets, key, seedGrossProfitTarget(periodId, managerId));
}

export function getGrossProfitActual(periodId: string, managerId: string, stored: SalesControlStoredState): number {
  const key = salesControlManagerPeriodKey(periodId, managerId);
  return mergeStoredNumber(stored.grossProfitActuals, key, seedGrossProfitActual(periodId, managerId));
}

export function getPlanComment(periodId: string, managerId: string, stored: SalesControlStoredState): string {
  const key = salesControlManagerPeriodKey(periodId, managerId);
  return mergeStoredString(stored.draftComments, key, seedComment(periodId, managerId));
}

export function getPlanUpdatedAt(periodId: string, managerId: string, stored: SalesControlStoredState): string {
  const key = salesControlManagerPeriodKey(periodId, managerId);
  if (stored.managerPeriodUpdatedAt[key]) return stored.managerPeriodUpdatedAt[key];
  return "2026-05-01T08:00:00.000Z";
}

export function hasPublishedManagerPlan(periodId: string, managerId: string, stored: SalesControlStoredState): boolean {
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  return Boolean(stored.publishedAt[mp]);
}

export function getPublishedPlanMetric(
  periodId: string,
  managerId: string,
  metricId: string,
  stored: SalesControlStoredState,
): number | undefined {
  if (!hasPublishedManagerPlan(periodId, managerId, stored)) return undefined;
  const key = salesControlMetricCellKey(periodId, managerId, metricId);
  const v = stored.publishedTargets[key];
  return v !== undefined && !Number.isNaN(v) ? v : undefined;
}

export function getPublishedGrossProfitTarget(
  periodId: string,
  managerId: string,
  stored: SalesControlStoredState,
): number | undefined {
  if (!hasPublishedManagerPlan(periodId, managerId, stored)) return undefined;
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  const v = stored.publishedGrossProfitTargets[mp];
  return v !== undefined && !Number.isNaN(v) ? v : undefined;
}

export function getPublishedPlanComment(periodId: string, managerId: string, stored: SalesControlStoredState): string | undefined {
  if (!hasPublishedManagerPlan(periodId, managerId, stored)) return undefined;
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  return stored.publishedComments[mp] ?? "";
}

export function getPublishedAtIso(periodId: string, managerId: string, stored: SalesControlStoredState): string | undefined {
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  return stored.publishedAt[mp];
}

export function getDraftTeamPeriodComment(periodId: string, teamId: string, stored: SalesControlStoredState): string {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  return mergeStoredString(stored.draftTeamComments, tk, "");
}

export function getPublishedTeamPeriodComment(periodId: string, teamId: string, stored: SalesControlStoredState): string | undefined {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  if (!stored.publishedTeamAt[tk]) return undefined;
  return stored.publishedTeamComments[tk] ?? "";
}

/** Сумма сидов менеджеров команды по метрике — стартовая база плана директора. */
export function seedDirectorTeamMetricAggregate(periodId: string, teamId: string, metricId: string): number {
  let s = 0;
  for (const m of getTeamManagers(teamId)) {
    s += getSeedTarget(periodId, m.id, metricId) ?? 0;
  }
  return s;
}

export function seedDirectorTeamGrossAggregate(periodId: string, teamId: string): number {
  let s = 0;
  for (const m of getTeamManagers(teamId)) {
    s += seedGrossProfitTarget(periodId, m.id);
  }
  return s;
}

export function resolveDirectorTeamDraftFull(
  periodId: string,
  teamId: string,
  stored: SalesControlStoredState,
): { metricTargets: Record<string, number>; grossProfitTarget: number; directorComment: string } {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  const draft = stored.teamPlanDrafts[tk];
  const metricTargets: Record<string, number> = {};
  for (const met of SALES_KPI_METRICS_SORTED) {
    const seedAgg = seedDirectorTeamMetricAggregate(periodId, teamId, met.id);
    const override = draft?.metricTargets[met.id];
    metricTargets[met.id] = override !== undefined && !Number.isNaN(override) ? override : seedAgg;
  }
  const seedGross = seedDirectorTeamGrossAggregate(periodId, teamId);
  const grossProfitTarget =
    draft?.grossProfitTarget !== undefined && !Number.isNaN(draft.grossProfitTarget) ? draft.grossProfitTarget : seedGross;
  const directorComment = draft?.directorComment ?? "";
  return { metricTargets, grossProfitTarget, directorComment };
}

export function applyDirectorTeamPlanSave(
  prev: SalesControlStoredState,
  periodId: string,
  teamId: string,
  metricTargets: Record<string, number>,
  grossProfitTarget: number,
  directorComment: string,
  updatedBy: string,
): SalesControlStoredState {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  const now = new Date().toISOString();
  const rec: TeamPlanDraftRecord = {
    metricTargets: { ...metricTargets },
    grossProfitTarget,
    directorComment,
    updatedBy,
    updatedAt: now,
  };
  return {
    ...prev,
    teamPlanDrafts: { ...prev.teamPlanDrafts, [tk]: rec },
  };
}

export function publishTeamPlanToRop(
  prev: SalesControlStoredState,
  periodId: string,
  teamId: string,
  publishedBy: string,
): SalesControlStoredState {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  const resolved = resolveDirectorTeamDraftFull(periodId, teamId, prev);
  const now = new Date().toISOString();
  const pub: TeamPlanPublicationRecord = {
    metricTargets: { ...resolved.metricTargets },
    grossProfitTarget: resolved.grossProfitTarget,
    directorComment: resolved.directorComment,
    publishedBy,
    publishedAt: now,
  };
  return {
    ...prev,
    teamPlanPublications: { ...prev.teamPlanPublications, [tk]: pub },
  };
}

export function hasPublishedDirectorTeamPlan(periodId: string, teamId: string, stored: SalesControlStoredState): boolean {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  return Boolean(stored.teamPlanPublications[tk]);
}

export function getPublishedDirectorTeamPlan(
  periodId: string,
  teamId: string,
  stored: SalesControlStoredState,
): TeamPlanPublicationRecord | undefined {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  return stored.teamPlanPublications[tk];
}

function numEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

function directorTeamDraftMatchesPublication(periodId: string, teamId: string, stored: SalesControlStoredState): boolean {
  const pub = getPublishedDirectorTeamPlan(periodId, teamId, stored);
  if (!pub) return false;
  const d = resolveDirectorTeamDraftFull(periodId, teamId, stored);
  for (const met of SALES_KPI_METRICS_SORTED) {
    if (!numEq(pub.metricTargets[met.id] ?? 0, d.metricTargets[met.id] ?? 0)) return false;
  }
  if (!numEq(pub.grossProfitTarget, d.grossProfitTarget)) return false;
  return pub.directorComment === d.directorComment;
}

export function getTeamPlanPublicationStatus(periodId: string, teamId: string, stored: SalesControlStoredState): TeamPlanDirectorStatus {
  if (!hasPublishedDirectorTeamPlan(periodId, teamId, stored)) return "draft";
  if (!directorTeamDraftMatchesPublication(periodId, teamId, stored)) return "changed_after_publish";
  return "published_to_rop";
}

export function managerDraftMatchesPublished(periodId: string, managerId: string, stored: SalesControlStoredState): boolean {
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  if (!stored.publishedAt[mp]) return false;
  for (const met of SALES_KPI_METRICS_SORTED) {
    const key = salesControlMetricCellKey(periodId, managerId, met.id);
    const pub = stored.publishedTargets[key];
    const draft = getTargetValue(periodId, managerId, met.id, stored);
    if (pub === undefined || !numEq(pub, draft)) return false;
  }
  const pg = stored.publishedGrossProfitTargets[mp];
  const dg = getGrossProfitTarget(periodId, managerId, stored);
  if (pg === undefined || !numEq(pg, dg)) return false;
  const dc = getPlanComment(periodId, managerId, stored);
  const pc = stored.publishedComments[mp] ?? "";
  return dc === pc;
}

export function getManagerPlanPublishStatus(
  periodId: string,
  managerId: string,
  stored: SalesControlStoredState,
): ManagerPlanPublishStatus {
  if (!hasPublishedManagerPlan(periodId, managerId, stored)) return "draft";
  if (!managerDraftMatchesPublished(periodId, managerId, stored)) return "changed_after_publish";
  return "published";
}

export function publishTeamPlansForTeam(prev: SalesControlStoredState, periodId: string, teamId: string): SalesControlStoredState {
  const managers = getTeamManagers(teamId);
  const now = new Date().toISOString();
  const next: SalesControlStoredState = {
    ...prev,
    publishedTargets: { ...prev.publishedTargets },
    publishedGrossProfitTargets: { ...prev.publishedGrossProfitTargets },
    publishedComments: { ...prev.publishedComments },
    publishedAt: { ...prev.publishedAt },
    publishedTeamComments: { ...prev.publishedTeamComments },
    publishedTeamAt: { ...prev.publishedTeamAt },
  };
  for (const m of managers) {
    const mp = salesControlManagerPeriodKey(periodId, m.id);
    for (const met of SALES_KPI_METRICS_SORTED) {
      const key = salesControlMetricCellKey(periodId, m.id, met.id);
      next.publishedTargets[key] = getTargetValue(periodId, m.id, met.id, prev);
    }
    next.publishedGrossProfitTargets[mp] = getGrossProfitTarget(periodId, m.id, prev);
    next.publishedComments[mp] = getPlanComment(periodId, m.id, prev);
    next.publishedAt[mp] = now;
  }
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  next.publishedTeamComments[tk] = getDraftTeamPeriodComment(periodId, teamId, prev);
  next.publishedTeamAt[tk] = now;
  return next;
}

export function completionPercentUncapped(target: number, actual: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

export function managerKpiProgressTone(pct: number): "green" | "yellow" | "red" {
  if (pct >= 100) return "green";
  if (pct >= 70) return "yellow";
  return "red";
}

export type TeamPublicationMetrics = {
  teamId: string;
  teamName: string;
  managerCount: number;
  published: number;
  draftOnly: number;
  changedAfterPublish: number;
};

export function teamPublicationMetrics(teamId: string, periodId: string, stored: SalesControlStoredState): TeamPublicationMetrics {
  const mgrs = getTeamManagers(teamId);
  let published = 0;
  let draftOnly = 0;
  let changedAfterPublish = 0;
  for (const m of mgrs) {
    const s = getManagerPlanPublishStatus(periodId, m.id, stored);
    if (s === "published") published += 1;
    else if (s === "draft") draftOnly += 1;
    else changedAfterPublish += 1;
  }
  const team = getTeamById(teamId);
  return {
    teamId,
    teamName: team?.name ?? teamId,
    managerCount: mgrs.length,
    published,
    draftOnly,
    changedAfterPublish,
  };
}

export function applyTeamLeadTeamCommentDraft(
  prev: SalesControlStoredState,
  periodId: string,
  teamId: string,
  text: string,
): SalesControlStoredState {
  const tk = salesControlTeamPeriodKey(periodId, teamId);
  return {
    ...prev,
    draftTeamComments: { ...prev.draftTeamComments, [tk]: text },
  };
}

export type TeamDistributionRow = {
  metricId: string;
  metricLabel: string;
  metricUnit: SalesKpiUnit;
  teamPlan: number;
  managersSum: number;
  delta: number;
  relativeDeviationPct: number;
  tone: "green" | "yellow" | "red";
  summaryLabel: "Осталось распределить" | "План распределён" | "Превышение";
};

export type TeamDistributionSummary = {
  periodId: string;
  teamId: string;
  rows: TeamDistributionRow[];
  gross: TeamDistributionRow;
};

export function sumManagerDraftTargetsForTeam(
  periodId: string,
  teamId: string,
  stored: SalesControlStoredState,
): { metricTotals: Record<string, number>; grossTotal: number } {
  const mgrs = getTeamManagers(teamId);
  const metricTotals: Record<string, number> = {};
  for (const met of SALES_KPI_METRICS_SORTED) {
    let s = 0;
    for (const m of mgrs) {
      s += getTargetValue(periodId, m.id, met.id, stored);
    }
    metricTotals[met.id] = s;
  }
  let grossTotal = 0;
  for (const m of mgrs) {
    grossTotal += getGrossProfitTarget(periodId, m.id, stored);
  }
  return { metricTotals, grossTotal };
}

function distributionToneForRow(teamPlan: number, managersSum: number): "green" | "yellow" | "red" {
  if (teamPlan <= 0) {
    if (managersSum <= 0) return "green";
    return "red";
  }
  const ratio = managersSum / teamPlan;
  if (ratio >= 0.98 && ratio <= 1.02) return "green";
  if (ratio < 0.98) return "yellow";
  return "red";
}

function distributionLabel(
  teamPlan: number,
  managersSum: number,
): "Осталось распределить" | "План распределён" | "Превышение" {
  if (teamPlan <= 0) {
    if (managersSum <= 0) return "План распределён";
    return "Превышение";
  }
  const ratio = managersSum / teamPlan;
  if (ratio >= 0.98 && ratio <= 1.02) return "План распределён";
  if (ratio < 0.98) return "Осталось распределить";
  return "Превышение";
}

export function getTeamDistributionSummary(
  periodId: string,
  teamId: string,
  stored: SalesControlStoredState,
): TeamDistributionSummary | null {
  const pub = getPublishedDirectorTeamPlan(periodId, teamId, stored);
  if (!pub) return null;
  const { metricTotals, grossTotal } = sumManagerDraftTargetsForTeam(periodId, teamId, stored);
  const rows: TeamDistributionRow[] = SALES_KPI_METRICS_SORTED.map((met) => {
    const teamPlan = pub.metricTargets[met.id] ?? 0;
    const managersSum = metricTotals[met.id] ?? 0;
    const delta = teamPlan - managersSum;
    const relativeDeviationPct =
      teamPlan > 0 ? Math.round((Math.abs(managersSum - teamPlan) / teamPlan) * 1000) / 10 : managersSum > 0 ? 100 : 0;
    return {
      metricId: met.id,
      metricLabel: met.label,
      metricUnit: met.unit,
      teamPlan,
      managersSum,
      delta,
      relativeDeviationPct,
      tone: distributionToneForRow(teamPlan, managersSum),
      summaryLabel: distributionLabel(teamPlan, managersSum),
    };
  });
  const teamGross = pub.grossProfitTarget;
  const gross: TeamDistributionRow = {
    metricId: "gross-profit",
    metricLabel: "Валовая прибыль",
    metricUnit: "money_rub",
    teamPlan: teamGross,
    managersSum: grossTotal,
    delta: teamGross - grossTotal,
    relativeDeviationPct:
      teamGross > 0 ? Math.round((Math.abs(grossTotal - teamGross) / teamGross) * 1000) / 10 : grossTotal > 0 ? 100 : 0,
    tone: distributionToneForRow(teamGross, grossTotal),
    summaryLabel: distributionLabel(teamGross, grossTotal),
  };
  return { periodId, teamId, rows, gross };
}

export function compareTeamPlanToManagerDrafts(
  periodId: string,
  teamId: string,
  stored: SalesControlStoredState,
): TeamDistributionSummary | null {
  return getTeamDistributionSummary(periodId, teamId, stored);
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

export function rollupManager(
  managerId: string,
  periodId: string,
  stored: SalesControlStoredState,
  planSource: "draft" | "published" = "draft",
): SalesManagerPeriodRollup | undefined {
  const u = getSalesUserById(managerId);
  if (!u || u.role !== "sales_manager" || !u.teamId) return undefined;
  if (planSource === "published" && !hasPublishedManagerPlan(periodId, managerId, stored)) return undefined;
  const team = getTeamById(u.teamId);
  const metrics = SALES_KPI_METRICS_SORTED.map((metric) => {
    let target: number;
    if (planSource === "published") {
      const pv = getPublishedPlanMetric(periodId, managerId, metric.id, stored);
      target = pv !== undefined ? pv : 0;
    } else {
      target = getTargetValue(periodId, managerId, metric.id, stored);
    }
    const actual = getActualValue(periodId, managerId, metric.id, stored);
    const pct =
      planSource === "published" ? completionPercentUncapped(target, actual) : completionPercent(target, actual);
    return { metric, target, actual, pct };
  });
  const ga = getGrossProfitActual(periodId, managerId, stored);
  let gt: number;
  if (planSource === "published") {
    const pg = getPublishedGrossProfitTarget(periodId, managerId, stored);
    gt = pg !== undefined ? pg : 0;
  } else {
    gt = getGrossProfitTarget(periodId, managerId, stored);
  }
  const grossPct =
    planSource === "published" ? completionPercentUncapped(gt, ga) : completionPercent(gt, ga);
  const comment =
    planSource === "published" ? (getPublishedPlanComment(periodId, managerId, stored) ?? "") : getPlanComment(periodId, managerId, stored);
  const updatedAt =
    planSource === "published"
      ? (getPublishedAtIso(periodId, managerId, stored) ?? "")
      : getPlanUpdatedAt(periodId, managerId, stored);
  return {
    managerId,
    managerName: u.name,
    teamId: u.teamId,
    teamName: team?.name ?? u.teamId,
    metrics,
    gross: { target: gt, actual: ga, pct: grossPct },
    comment,
    updatedAt,
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

/** Руководитель команды: сохранить черновик плана (цели по KPI, валовая прибыль, комментарий). */
export function applyTeamLeadPlanSave(
  prev: SalesControlStoredState,
  periodId: string,
  managerId: string,
  metricTargets: Record<string, number>,
  grossProfitTarget: number,
  comment: string,
): SalesControlStoredState {
  let next: SalesControlStoredState = {
    ...prev,
    draftTargets: { ...prev.draftTargets },
    draftComments: { ...prev.draftComments },
    draftGrossProfitTargets: { ...prev.draftGrossProfitTargets },
  };
  const mp = salesControlManagerPeriodKey(periodId, managerId);
  for (const [metricId, value] of Object.entries(metricTargets)) {
    const key = salesControlMetricCellKey(periodId, managerId, metricId);
    next.draftTargets[key] = value;
  }
  next.draftGrossProfitTargets = { ...next.draftGrossProfitTargets, [mp]: grossProfitTarget };
  next.draftComments = { ...next.draftComments, [mp]: comment };
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
