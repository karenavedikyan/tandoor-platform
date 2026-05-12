/**
 * Ролевые «рабочие режимы» страницы клиентской базы (/#/dealer-base).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { SalesRole, SalesUser } from "@/lib/sales-control-data";
import { getAllSalesManagers, getSalesUserById, getTeamManagers } from "@/lib/sales-control-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import {
  getRopOptions,
  isRopOrManagerAllFilter,
  managerDisplayMatchesCatalogName,
} from "@/lib/rop-manager-filters";

export type DealerBaseAccessRole = "sales_director" | "team_lead" | "sales_manager";

export type DealerBaseWorkView =
  | "teams"
  | "risks_all"
  | "top_all"
  | "cities_all"
  | "table_all"
  | "my_team"
  | "team_attention"
  | "by_manager"
  | "day_plan_team"
  | "table_team"
  | "my_clients"
  | "today"
  | "my_attention"
  | "my_top"
  | "my_cities";

export const DEALER_BASE_VIEW_LABELS: Record<DealerBaseWorkView, string> = {
  teams: "Команды",
  risks_all: "Риски отдела",
  top_all: "TOP/VIP отдела",
  cities_all: "Города отдела",
  table_all: "Таблица отдела",
  my_team: "Моя команда",
  team_attention: "Внимание команды",
  by_manager: "По менеджерам",
  day_plan_team: "План дня команды",
  table_team: "Таблица команды",
  my_clients: "Мои клиенты",
  today: "Сегодня",
  my_attention: "Моё внимание",
  my_top: "Мои TOP",
  my_cities: "Мои города",
};

export function mapSalesRoleToDealerBaseAccess(role: SalesRole): DealerBaseAccessRole {
  if (role === "team_lead") return "team_lead";
  if (role === "sales_manager") return "sales_manager";
  return "sales_director";
}

export function workViewsForAccess(access: DealerBaseAccessRole): DealerBaseWorkView[] {
  if (access === "sales_director") {
    return [
      "teams",
      "risks_all",
      "top_all",
      "cities_all",
      "table_all",
      "my_team",
      "team_attention",
      "by_manager",
      "day_plan_team",
      "table_team",
      "my_clients",
      "today",
      "my_attention",
      "my_top",
      "my_cities",
    ];
  }
  if (access === "team_lead") {
    return [
      "my_team",
      "team_attention",
      "by_manager",
      "day_plan_team",
      "table_team",
      "my_clients",
      "today",
      "my_attention",
      "my_top",
      "my_cities",
    ];
  }
  return ["my_clients", "today", "my_attention", "my_top", "my_cities"];
}

export function defaultWorkViewForAccess(access: DealerBaseAccessRole): DealerBaseWorkView {
  if (access === "sales_director") return "teams";
  if (access === "team_lead") return "my_team";
  return "my_clients";
}

export function workViewGroup(view: DealerBaseWorkView): "department" | "team" | "manager" {
  if (
    view === "teams" ||
    view === "risks_all" ||
    view === "top_all" ||
    view === "cities_all" ||
    view === "table_all"
  ) {
    return "department";
  }
  if (
    view === "my_team" ||
    view === "team_attention" ||
    view === "by_manager" ||
    view === "day_plan_team" ||
    view === "table_team"
  ) {
    return "team";
  }
  return "manager";
}

const DEPT_VIEWS: DealerBaseWorkView[] = ["teams", "risks_all", "top_all", "cities_all", "table_all"];

/** Режимы «команда» (карточки/группировка по команде; фильтр менеджера к ним не относится). */
export const DEALER_BASE_TEAM_WORK_VIEWS: DealerBaseWorkView[] = [
  "my_team",
  "team_attention",
  "by_manager",
  "day_plan_team",
  "table_team",
];
const TEAM_VIEWS = DEALER_BASE_TEAM_WORK_VIEWS;
const MGR_VIEWS: DealerBaseWorkView[] = [
  "my_clients",
  "today",
  "my_attention",
  "my_top",
  "my_cities",
];

export function groupLabelsForAccess(access: DealerBaseAccessRole): {
  department: boolean;
  team: boolean;
  manager: boolean;
} {
  const views = new Set(workViewsForAccess(access));
  return {
    department: DEPT_VIEWS.some((v) => views.has(v)),
    team: TEAM_VIEWS.some((v) => views.has(v)),
    manager: MGR_VIEWS.some((v) => views.has(v)),
  };
}

export function viewsInGroupForAccess(
  access: DealerBaseAccessRole,
  group: "department" | "team" | "manager",
): DealerBaseWorkView[] {
  const allowed = new Set(workViewsForAccess(access));
  const pool = group === "department" ? DEPT_VIEWS : group === "team" ? TEAM_VIEWS : MGR_VIEWS;
  return pool.filter((v) => allowed.has(v));
}

/** Строки с «риском» для режима рисков отдела. */
export function isDealerBusinessRisk(row: DealerRow): boolean {
  return row.hasProblem || row.status === "требует внимания";
}

/** Сигналы внимания (обучение / риск) для режимов «внимание». */
export function dealerNeedsAttention(row: DealerRow): boolean {
  if (row.status === "требует внимания" || row.hasProblem) return true;
  if (row.productTrainingStatus === "recommended") return true;
  if (row.indigoTrainingStatus === "recommended" || row.indigoTrainingStatus === "in_progress") return true;
  return false;
}

export function isDealerTop(row: DealerRow): boolean {
  return row.category === "TOP";
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Детерминированный «контакт сегодня» (до maxRows строк). */
export function pickTodayContactRows(rows: DealerRow[], maxRows: number, daySeed?: number): DealerRow[] {
  const d = typeof daySeed === "number" ? daySeed : new Date().getDate() + new Date().getMonth() * 31;
  const scored = rows
    .map((r) => ({ r, s: (hashId(r.id) + d) % 997 }))
    .filter((x) => x.s < 130)
    .sort((a, b) => a.s - b.s || a.r.id.localeCompare(b.r.id))
    .map((x) => x.r);
  return scored.slice(0, maxRows);
}

export function buildDayPlanTeamRows(rows: DealerRow[], maxRows: number): DealerRow[] {
  const pick = (pred: (r: DealerRow) => boolean) => rows.filter(pred);
  const top = pick(isDealerTop);
  const att = pick(dealerNeedsAttention);
  const pot = pick((r) => r.status === "потенциальный");
  const idle = pick((r) => !r.hasRecentActivity);
  const seen = new Set<string>();
  const out: DealerRow[] = [];
  const push = (arr: DealerRow[]) => {
    for (const r of arr) {
      if (out.length >= maxRows) return;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  };
  push(top);
  push(att);
  push(pot);
  push(idle);
  return out;
}

export function roleScopedDealerRows(rows: DealerRow[], profile: ReleaseDemoProfile): DealerRow[] {
  const access = mapSalesRoleToDealerBaseAccess(profile.role);
  if (access === "sales_director") return rows;
  if (access === "team_lead") {
    const tid = getEffectiveTeamLeadTeamId(profile);
    return rows.filter((r) => r.releaseTeamId === tid);
  }
  const u = getSalesUserById(profile.personaUserId);
  if (u?.role === "sales_manager" && u.id) {
    return rows.filter((r) => {
      if (r.releaseManagerId === u.id) return true;
      return managerDisplayMatchesCatalogName(r.manager, u.name);
    });
  }
  return rows;
}

export type DealerBaseRopManagerDefaults = { ropTeam: string; manager: string };

export function initialRopManagerForProfile(
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): DealerBaseRopManagerDefaults {
  if (access === "sales_director") {
    return { ropTeam: "all", manager: "all" };
  }
  if (access === "team_lead") {
    const tid = getEffectiveTeamLeadTeamId(profile);
    return { ropTeam: tid, manager: "all" };
  }
  const u = getSalesUserById(profile.personaUserId);
  if (u?.role === "sales_manager" && u.teamId && u.id) {
    return { ropTeam: u.teamId, manager: u.id };
  }
  return { ropTeam: "all", manager: "all" };
}

export function ropOptionsForProfile(
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): { teamId: string; label: string }[] {
  const all = getRopOptions();
  if (access === "sales_director") return all;
  if (access === "team_lead") {
    const tid = getEffectiveTeamLeadTeamId(profile);
    return all.filter((o) => o.teamId === tid);
  }
  const u = getSalesUserById(profile.personaUserId);
  if (u?.teamId) return all.filter((o) => o.teamId === u.teamId);
  return all;
}

export function managerOptionsForProfile(
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
  ropTeamId: string,
): SalesUser[] {
  if (access === "sales_manager") {
    const u = getSalesUserById(profile.personaUserId);
    return u && u.role === "sales_manager" ? [u] : getTeamManagers(ropTeamId);
  }
  if (access === "team_lead") {
    return getTeamManagers(getEffectiveTeamLeadTeamId(profile));
  }
  if (isRopOrManagerAllFilter(ropTeamId)) return getAllSalesManagers();
  return getTeamManagers(ropTeamId);
}
