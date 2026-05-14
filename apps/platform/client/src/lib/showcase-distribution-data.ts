/**
 * План/факт витрины по категориям и задачи (Release 1, без backend).
 * Изменения — sessionStorage (ключ tandoor-showcase-distribution-v1).
 */

import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getSalesUserById } from "@/lib/sales-control-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";

export type ShowcaseCategoryId = "entrance_doors" | "interior_doors" | "hardware" | "molding";

export type ShowcaseRowStatus = "ok" | "attention" | "critical";

export type ShowcaseDistributionRow = {
  dealerId: string;
  categoryId: ShowcaseCategoryId;
  targetCount: number;
  actualCount: number;
  deficitCount: number;
  completionPct: number;
  status: ShowcaseRowStatus;
  updatedAt: string;
  updatedBy: string;
};

export type ShowcaseTaskStatus = "new" | "in_progress" | "done" | "postponed" | "needs_rop";

export type ShowcaseTaskPriority = "high" | "medium" | "low";

export type ShowcaseTask = {
  taskId: string;
  dealerId: string;
  categoryId: ShowcaseCategoryId;
  title: string;
  description: string;
  targetCount: number;
  actualCount: number;
  deficitCount: number;
  status: ShowcaseTaskStatus;
  priority: ShowcaseTaskPriority;
  dueDate: string;
  completedAt?: string;
  resultComment?: string;
  nextActionDate?: string;
  nextActionText?: string;
  updatedBy?: string;
  resultKind?: ShowcaseCompleteResultKind;
};

export type ShowcaseCompleteResultKind =
  | "added_models"
  | "agreed_installation"
  | "updated_samples"
  | "photo_report"
  | "client_refused";

export type ShowcaseRowOverride = {
  actualCount: number;
  status: ShowcaseRowStatus;
  comment?: string;
  updatedAt: string;
  updatedBy: string;
};

export type ShowcaseTaskUpdate = {
  status: ShowcaseTaskStatus;
  resultComment?: string;
  nextActionDate?: string;
  nextActionText?: string;
  completedAt?: string;
  updatedBy?: string;
  resultKind?: ShowcaseCompleteResultKind;
  /** После «Выполнить» — новый факт по категории */
  resolvedActualCount?: number;
};

export type ShowcaseHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

type ShowcaseStorageV1 = {
  overrides: Record<string, ShowcaseRowOverride>;
  taskUpdates: Record<string, ShowcaseTaskUpdate>;
  historyByDealer: Record<string, ShowcaseHistoryEntry[]>;
};

const STORAGE_KEY = "tandoor-showcase-distribution-v1";

/** Событие после изменения sessionStorage витрины — для обновления /tasks и кэша матрицы. */
export const SHOWCASE_STORAGE_EVENT = "tandoor-showcase-distribution-changed";

export const SHOWCASE_CATEGORIES: ShowcaseCategoryId[] = ["entrance_doors", "interior_doors", "hardware", "molding"];

export const SHOWCASE_CATEGORY_LABEL: Record<ShowcaseCategoryId, string> = {
  entrance_doors: "Входные двери",
  interior_doors: "Межкомнатные двери",
  hardware: "Фурнитура",
  molding: "Плинтусы и доборы",
};

const RESULT_LABEL: Record<ShowcaseCompleteResultKind, string> = {
  added_models: "Добавил модели",
  agreed_installation: "Согласовал установку",
  updated_samples: "Обновил образцы",
  photo_report: "Сделал фотоотчёт",
  client_refused: "Клиент отказался",
};

export function showcaseCompleteResultLabel(k: ShowcaseCompleteResultKind): string {
  return RESULT_LABEL[k];
}

function charSum(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum += s.charCodeAt(i);
  return sum;
}

function hash01(dealerId: string, categoryId: string): number {
  return (charSum(dealerId) * 31 + charSum(categoryId)) % 1000;
}

function emptyStorage(): ShowcaseStorageV1 {
  return { overrides: {}, taskUpdates: {}, historyByDealer: {} };
}

export function loadShowcaseStorage(): ShowcaseStorageV1 {
  if (typeof window === "undefined" || !window.sessionStorage) return emptyStorage();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStorage();
    const p = JSON.parse(raw) as Partial<ShowcaseStorageV1>;
    return {
      overrides: p.overrides && typeof p.overrides === "object" ? p.overrides : {},
      taskUpdates: p.taskUpdates && typeof p.taskUpdates === "object" ? p.taskUpdates : {},
      historyByDealer: p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {},
    };
  } catch {
    return emptyStorage();
  }
}

export function saveShowcaseStorage(data: ShowcaseStorageV1): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(SHOWCASE_STORAGE_EVENT));
}

function overrideKey(dealerId: string, categoryId: ShowcaseCategoryId): string {
  return `${dealerId}|${categoryId}`;
}

function targetsForClientCategory(cat: ClientCategoryId): Record<ShowcaseCategoryId, number> {
  switch (cat) {
    case "top150":
      return { entrance_doors: 10, interior_doors: 8, hardware: 8, molding: 5 };
    case "top350":
      return { entrance_doors: 7, interior_doors: 5, hardware: 5, molding: 4 };
    case "top500":
    case "top500plus":
      return { entrance_doors: 5, interior_doors: 4, hardware: 4, molding: 3 };
    case "potential":
      return { entrance_doors: 4, interior_doors: 3, hardware: 3, molding: 2 };
    case "lead":
      return { entrance_doors: 3, interior_doors: 2, hardware: 2, molding: 2 };
    default:
      return { entrance_doors: 4, interior_doors: 3, hardware: 3, molding: 2 };
  }
}

function baseActualCount(dealerId: string, categoryId: ShowcaseCategoryId, target: number): number {
  const h = hash01(dealerId, categoryId);
  const span = Math.max(target + 3, 6);
  return Math.min(target, h % span);
}

function rowStatus(completionPct: number, deficit: number, target: number): ShowcaseRowStatus {
  if (deficit <= 0 || completionPct >= 95) return "ok";
  if (completionPct >= 70 || deficit <= Math.max(1, Math.floor(target * 0.25))) return "attention";
  return "critical";
}

function dueDateFor(dealerId: string, categoryId: ShowcaseCategoryId): string {
  const d = 8 + (hash01(dealerId, categoryId) % 18);
  return `${String(d).padStart(2, "0")}.05.2026`;
}

function priorityFor(deficit: number, target: number): ShowcaseTaskPriority {
  const ratio = target > 0 ? deficit / target : 0;
  if (ratio > 0.45 || deficit >= 4) return "high";
  if (ratio > 0.2 || deficit >= 2) return "medium";
  return "low";
}

export function buildBaseDistributionRows(dealer: DealerRow): ShowcaseDistributionRow[] {
  const targets = targetsForClientCategory(dealer.clientCategory);
  const now = new Date().toISOString();
  return SHOWCASE_CATEGORIES.map((categoryId) => {
    const targetCount = targets[categoryId];
    const baseActual = baseActualCount(dealer.id, categoryId, targetCount);
    const actualCount = baseActual;
    const deficitCount = Math.max(0, targetCount - actualCount);
    const completionPct = targetCount <= 0 ? 100 : Math.min(100, Math.round((actualCount / targetCount) * 100));
    const status = rowStatus(completionPct, deficitCount, targetCount);
    return {
      dealerId: dealer.id,
      categoryId,
      targetCount,
      actualCount,
      deficitCount,
      completionPct,
      status,
      updatedAt: now,
      updatedBy: "Система",
    };
  });
}

export function mergeDistributionWithOverrides(dealer: DealerRow, storage: ShowcaseStorageV1): ShowcaseDistributionRow[] {
  const base = buildBaseDistributionRows(dealer);
  return base.map((row) => {
    const o = storage.overrides[overrideKey(dealer.id, row.categoryId)];
    if (!o) return row;
    const actualCount = Math.max(0, o.actualCount);
    const deficitCount = Math.max(0, row.targetCount - actualCount);
    const completionPct =
      row.targetCount <= 0 ? 100 : Math.min(100, Math.round((actualCount / row.targetCount) * 100));
    const status = rowStatus(completionPct, deficitCount, row.targetCount);
    return {
      ...row,
      actualCount,
      deficitCount,
      completionPct,
      status,
      updatedAt: o.updatedAt,
      updatedBy: o.updatedBy,
    };
  });
}

export function buildShowcaseTasksFromRows(rows: ShowcaseDistributionRow[]): ShowcaseTask[] {
  const out: ShowcaseTask[] = [];
  for (const r of rows) {
    if (r.deficitCount <= 0) continue;
    const taskId = `sd-${r.dealerId}-${r.categoryId}`;
    const label = SHOWCASE_CATEGORY_LABEL[r.categoryId];
    out.push({
      taskId,
      dealerId: r.dealerId,
      categoryId: r.categoryId,
      title: `Витрина: ${label}`,
      description: `План ${r.targetCount} поз., факт ${r.actualCount}. Дефицит ${r.deficitCount}. Приведите выкладку к плану или зафиксируйте согласованное отклонение.`,
      targetCount: r.targetCount,
      actualCount: r.actualCount,
      deficitCount: r.deficitCount,
      status: "new",
      priority: priorityFor(r.deficitCount, r.targetCount),
      dueDate: dueDateFor(r.dealerId, r.categoryId),
    });
  }
  return out;
}

export function mergeTasksWithStorage(tasks: ShowcaseTask[], storage: ShowcaseStorageV1): ShowcaseTask[] {
  return tasks.map((t) => {
    const u = storage.taskUpdates[t.taskId];
    if (!u) return t;
    const actualCount = u.resolvedActualCount ?? t.actualCount;
    return {
      ...t,
      status: u.status ?? t.status,
      resultComment: u.resultComment ?? t.resultComment,
      nextActionDate: u.nextActionDate ?? t.nextActionDate,
      nextActionText: u.nextActionText ?? t.nextActionText,
      completedAt: u.completedAt ?? t.completedAt,
      updatedBy: u.updatedBy ?? t.updatedBy,
      resultKind: u.resultKind ?? t.resultKind,
      actualCount,
      deficitCount: Math.max(0, t.targetCount - actualCount),
    };
  });
}

/** Активные и выполненные задачи по витрине для карточки клиента. */
export function getShowcaseTasksForDealerDisplay(dealer: DealerRow, storage: ShowcaseStorageV1): ShowcaseTask[] {
  const rows = mergeDistributionWithOverrides(dealer, storage);
  const fromDeficit = mergeTasksWithStorage(buildShowcaseTasksFromRows(rows), storage);
  const seen = new Set(fromDeficit.map((t) => t.taskId));
  const extra: ShowcaseTask[] = [];
  for (const cat of SHOWCASE_CATEGORIES) {
    const taskId = `sd-${dealer.id}-${cat}`;
    const u = storage.taskUpdates[taskId];
    if (u?.status !== "done" || seen.has(taskId)) continue;
    const row = rows.find((r) => r.categoryId === cat);
    const targetCount = row?.targetCount ?? targetsForClientCategory(dealer.clientCategory)[cat];
    const actualCount = u.resolvedActualCount ?? row?.actualCount ?? 0;
    extra.push({
      taskId,
      dealerId: dealer.id,
      categoryId: cat,
      title: `Витрина: ${SHOWCASE_CATEGORY_LABEL[cat]}`,
      description: "Задача выполнена.",
      targetCount,
      actualCount,
      deficitCount: Math.max(0, targetCount - actualCount),
      status: "done",
      priority: "low",
      dueDate: "—",
      completedAt: u.completedAt,
      resultComment: u.resultComment,
      nextActionDate: u.nextActionDate,
      nextActionText: u.nextActionText,
      updatedBy: u.updatedBy,
      resultKind: u.resultKind,
    });
    seen.add(taskId);
  }
  const all = [...fromDeficit, ...extra];
  return all.sort((a, b) => {
    const ad = a.status === "done" ? 1 : 0;
    const bd = b.status === "done" ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return a.taskId.localeCompare(b.taskId);
  });
}

export function getShowcaseKpis(rows: ShowcaseDistributionRow[], tasks: ShowcaseTask[]) {
  const totalTarget = rows.reduce((s, r) => s + r.targetCount, 0);
  const totalActual = rows.reduce((s, r) => s + r.actualCount, 0);
  const deficitTotal = rows.reduce((s, r) => s + r.deficitCount, 0);
  const completionPct =
    totalTarget <= 0 ? 100 : Math.min(100, Math.round((totalActual / totalTarget) * 100));
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "postponed").length;
  const criticalZones = rows.filter((r) => r.status === "critical").length;
  return { completionPct, deficitTotal, openTasks, criticalZones };
}

export function getShowcaseHistoryForDealer(dealerId: string, storage: ShowcaseStorageV1): ShowcaseHistoryEntry[] {
  return [...(storage.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export type ShowcaseCompletePayload = {
  taskId: string;
  dealerId: string;
  categoryId: ShowcaseCategoryId;
  newActualCount: number;
  resultKind: ShowcaseCompleteResultKind;
  comment: string;
  nextActionDate: string;
  nextActionText: string;
  actorUserId: string;
  actorLabel: string;
};

/** Упрощённый пересчёт override status после смены actual (без лишней рекурсии). */
function recomputeOverrideStatus(target: number, actual: number): ShowcaseRowStatus {
  const deficit = Math.max(0, target - actual);
  const completionPct = target <= 0 ? 100 : Math.min(100, Math.round((actual / target) * 100));
  return rowStatus(completionPct, deficit, target);
}

export function applyShowcaseTaskCompleteSafe(
  dealer: DealerRow,
  payload: Omit<ShowcaseCompletePayload, "dealerId" | "categoryId"> & { categoryId: ShowcaseCategoryId },
): ShowcaseStorageV1 {
  const storage = loadShowcaseStorage();
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const target =
    buildBaseDistributionRows(dealer).find((r) => r.categoryId === payload.categoryId)?.targetCount ?? 0;

  storage.taskUpdates[payload.taskId] = {
    status: "done",
    resultComment: payload.comment,
    nextActionDate: payload.nextActionDate,
    nextActionText: payload.nextActionText,
    completedAt: day,
    updatedBy: payload.actorLabel,
    resultKind: payload.resultKind,
    resolvedActualCount: payload.newActualCount,
  };

  storage.overrides[overrideKey(dealer.id, payload.categoryId)] = {
    actualCount: payload.newActualCount,
    status: recomputeOverrideStatus(target, payload.newActualCount),
    comment: payload.comment,
    updatedAt: now,
    updatedBy: payload.actorLabel,
  };

  const catLabel = SHOWCASE_CATEGORY_LABEL[payload.categoryId];
  const hist: ShowcaseHistoryEntry = {
    id: `sh-${dealer.id}-${payload.taskId}-${Date.now()}`,
    at: now,
    meta: `${day} · ${payload.actorLabel}`,
    body: `Менеджер обновил витрину: ${catLabel}, факт ${payload.newActualCount} из плана ${target}. Результат: ${showcaseCompleteResultLabel(payload.resultKind)}. Комментарий: ${payload.comment}`,
  };
  const prev = storage.historyByDealer[dealer.id] ?? [];
  storage.historyByDealer[dealer.id] = [hist, ...prev].slice(0, 40);

  saveShowcaseStorage(storage);
  return storage;
}

export function applyShowcaseTaskStatus(
  taskId: string,
  status: ShowcaseTaskStatus,
  actorLabel: string,
): ShowcaseStorageV1 {
  const storage = loadShowcaseStorage();
  const prev = storage.taskUpdates[taskId] ?? {};
  storage.taskUpdates[taskId] = {
    ...prev,
    status,
    updatedBy: actorLabel,
  };
  saveShowcaseStorage(storage);
  return storage;
}

/** Глобальный список для /tasks — плоские строки (маппинг в Matrix в trade-point-task-data). */
export type ShowcaseGlobalTaskRow = {
  taskId: string;
  dealerId: string;
  dealerName: string;
  tradePointId: string;
  tradePointName: string;
  categoryId: ShowcaseCategoryId;
  title: string;
  description: string;
  priority: ShowcaseTaskPriority;
  showcaseStatus: ShowcaseTaskStatus;
  dueDate: string;
  targetCount: number;
  actualCount: number;
  deficitCount: number;
};

export function getAllShowcaseGlobalTaskRows(dealers: DealerRow[]): ShowcaseGlobalTaskRow[] {
  const storage = loadShowcaseStorage();
  const out: ShowcaseGlobalTaskRow[] = [];
  for (const dealer of dealers) {
    const rows = mergeDistributionWithOverrides(dealer, storage);
    const tasks = mergeTasksWithStorage(buildShowcaseTasksFromRows(rows), storage);
    const tp = dealer.tradePoints[0];
    const tpId = tp?.id ?? `${dealer.id}-tp`;
    const tpName = tp?.name ?? "Торговая точка";
    for (const t of tasks) {
      if (t.status === "done") continue;
      out.push({
        taskId: t.taskId,
        dealerId: dealer.id,
        dealerName: dealer.name,
        tradePointId: tpId,
        tradePointName: tpName,
        categoryId: t.categoryId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        showcaseStatus: t.status,
        dueDate: t.dueDate,
        targetCount: t.targetCount,
        actualCount: t.actualCount,
        deficitCount: t.deficitCount,
      });
    }
  }
  return out;
}

export function userLabelFromProfile(profile: ReleaseDemoProfile): string {
  const u = getSalesUserById(profile.personaUserId);
  return u?.name ?? profile.personaUserId;
}

/** Закрытие задачи с вводом факта — только менеджер «своего» клиента. */
export function canCompleteShowcaseTask(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return profile.role === "sales_manager" && dealer.releaseManagerId === profile.personaUserId;
}

/** Смена статуса (в работу, РОП, отложить) — менеджер своего клиента или РОП команды. */
export function canWorkflowShowcaseTask(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  if (profile.role === "sales_manager") return dealer.releaseManagerId === profile.personaUserId;
  if (profile.role === "team_lead") return dealer.releaseTeamId === getEffectiveTeamLeadTeamId(profile);
  return false;
}

export function canViewShowcaseDistribution(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  const access = mapSalesRoleToDealerBaseAccess(profile.role);
  if (access === "sales_manager") return dealer.releaseManagerId === profile.personaUserId;
  if (access === "team_lead") return dealer.releaseTeamId === getEffectiveTeamLeadTeamId(profile);
  if (access === "sales_director") return true;
  if (access === "marketer" || access === "analyst") return true;
  return false;
}

export function isShowcaseReadOnly(profile: ReleaseDemoProfile): boolean {
  const r = profile.role;
  return r === "analyst" || r === "marketer" || r === "sales_director";
}
