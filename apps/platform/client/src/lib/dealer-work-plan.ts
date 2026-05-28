/**
 * Рабочий план клиентов.
 * Чтение: Postgres (кеш) + LS fallback. Запись: оптимистично в LS + API.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  apiClearSchedule,
  apiHide,
  apiRestore,
  apiSchedule,
} from "@/lib/dealer-work-plan-api";
import { refreshWorkPlanFromApi, resolveWorkPlanState } from "@/lib/dealer-work-plan-db-cache";

export const DEALER_WORK_PLAN_STORAGE_KEY = "tandoor-dealer-work-plan-v1";
export const DEALER_WORK_PLAN_EVENT = "tandoor-dealer-work-plan-changed";

export type DealerWorkPlanScheduleEntry = {
  date: string;
  note?: string;
  updatedAt: string;
};

export type DealerWorkPlanState = {
  hiddenByUser: Record<string, Record<string, true>>;
  scheduledByUser: Record<string, Record<string, DealerWorkPlanScheduleEntry>>;
};

export type WorkPlanListFilter =
  | "active"
  | "all"
  | "hidden"
  | "scheduled"
  | "today"
  | "week"
  | "unscheduled";

export const WORK_PLAN_FILTER_LABELS: Record<WorkPlanListFilter, string> = {
  active: "В работе",
  all: "Все",
  hidden: "Скрытые",
  scheduled: "Запланированы",
  today: "Сегодня",
  week: "Эта неделя",
  unscheduled: "Без даты",
};

function emptyState(): DealerWorkPlanState {
  return { hiddenByUser: {}, scheduledByUser: {} };
}

export function loadDealerWorkPlanState(): DealerWorkPlanState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_WORK_PLAN_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerWorkPlanState>;
    return {
      hiddenByUser: p.hiddenByUser && typeof p.hiddenByUser === "object" ? p.hiddenByUser : {},
      scheduledByUser:
        p.scheduledByUser && typeof p.scheduledByUser === "object" ? p.scheduledByUser : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveDealerWorkPlanState(state: DealerWorkPlanState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_WORK_PLAN_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_WORK_PLAN_EVENT));
}

function fireAndRefresh(localUserKey: string, run: () => Promise<boolean>): void {
  void run()
    .then((ok) => {
      if (ok) void refreshWorkPlanFromApi(localUserKey);
    })
    .catch((e) => {
      console.warn("[dealer-work-plan] API sync failed", e);
    });
}

export function getDealerWorkPlanForUser(
  userId: string,
  state?: DealerWorkPlanState,
): {
  hidden: Record<string, true>;
  scheduled: Record<string, DealerWorkPlanScheduleEntry>;
} {
  const st = resolveWorkPlanState(state);
  return {
    hidden: st.hiddenByUser[userId] ?? {},
    scheduled: st.scheduledByUser[userId] ?? {},
  };
}

export function isDealerHiddenForUser(userId: string, dealerId: string, state?: DealerWorkPlanState): boolean {
  const st = resolveWorkPlanState(state);
  return Boolean(st.hiddenByUser[userId]?.[dealerId]);
}

export function getDealerScheduledDateForUser(
  userId: string,
  dealerId: string,
  state?: DealerWorkPlanState,
): DealerWorkPlanScheduleEntry | null {
  const st = resolveWorkPlanState(state);
  return st.scheduledByUser[userId]?.[dealerId] ?? null;
}

export function hideDealersForUser(userId: string, dealerIds: string[]): void {
  if (!dealerIds.length) return;
  const state = loadDealerWorkPlanState();
  const prev = state.hiddenByUser[userId] ?? {};
  const next = { ...prev };
  for (const id of dealerIds) next[id] = true;
  state.hiddenByUser[userId] = next;
  saveDealerWorkPlanState(state);
  fireAndRefresh(userId, () => apiHide(dealerIds));
}

export function restoreDealersForUser(userId: string, dealerIds: string[]): void {
  if (!dealerIds.length) return;
  const state = loadDealerWorkPlanState();
  const prev = state.hiddenByUser[userId] ?? {};
  const next = { ...prev };
  for (const id of dealerIds) delete next[id];
  state.hiddenByUser[userId] = next;
  saveDealerWorkPlanState(state);
  fireAndRefresh(userId, () => apiRestore(dealerIds));
}

export function scheduleDealersForUser(userId: string, dealerIds: string[], dateIso: string, note?: string): void {
  if (!dealerIds.length || !dateIso.trim()) return;
  const state = loadDealerWorkPlanState();
  const prev = state.scheduledByUser[userId] ?? {};
  const next = { ...prev };
  const updatedAt = new Date().toISOString();
  const n = note?.trim() || undefined;
  for (const id of dealerIds) {
    next[id] = { date: dateIso.trim(), ...(n ? { note: n } : {}), updatedAt };
  }
  state.scheduledByUser[userId] = next;
  saveDealerWorkPlanState(state);
  fireAndRefresh(userId, () => apiSchedule(dealerIds, dateIso.trim(), n));
}

export function clearDealerScheduleForUser(userId: string, dealerIds: string[]): void {
  if (!dealerIds.length) return;
  const state = loadDealerWorkPlanState();
  const prev = state.scheduledByUser[userId] ?? {};
  const next = { ...prev };
  for (const id of dealerIds) delete next[id];
  state.scheduledByUser[userId] = next;
  saveDealerWorkPlanState(state);
  fireAndRefresh(userId, () => apiClearSchedule(dealerIds));
}

/** DD.MM.YYYY из YYYY-MM-DD */
export function formatWorkPlanDateRu(isoDay: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
  if (!m) return isoDay.trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function parseIsoDayLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

export function localTodayIsoDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function addDaysLocal(isoStart: string, days: number): string {
  const p = parseIsoDayLocal(isoStart);
  if (!p) return isoStart;
  p.setDate(p.getDate() + days);
  const y = p.getFullYear();
  const mo = String(p.getMonth() + 1).padStart(2, "0");
  const day = String(p.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function compareIsoDays(a: string, b: string): number {
  const da = parseIsoDayLocal(a);
  const db = parseIsoDayLocal(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}

export function filterDealersByWorkPlan(
  rows: DealerRow[],
  userId: string,
  filter: WorkPlanListFilter,
  state?: DealerWorkPlanState,
): DealerRow[] {
  const st = resolveWorkPlanState(state);
  const hidden = st.hiddenByUser[userId] ?? {};
  const sched = st.scheduledByUser[userId] ?? {};
  const today = localTodayIsoDay();
  const weekEnd = addDaysLocal(today, 7);

  switch (filter) {
    case "all":
      return rows;
    case "active":
      return rows.filter((r) => !hidden[r.id]);
    case "hidden":
      return rows.filter((r) => hidden[r.id]);
    case "scheduled":
      return rows.filter((r) => Boolean(sched[r.id]?.date));
    case "today":
      return rows.filter((r) => sched[r.id]?.date === today);
    case "week": {
      return rows.filter((r) => {
        const d = sched[r.id]?.date;
        if (!d) return false;
        return compareIsoDays(d, today) >= 0 && compareIsoDays(d, weekEnd) <= 0;
      });
    }
    case "unscheduled":
      return rows.filter((r) => !sched[r.id]?.date && !hidden[r.id]);
    default:
      return rows;
  }
}

export type DealerWorkPlanCopyOptions = {
  /** Если задано — строка «Дата работы» в тексте */
  workDateIso?: string;
  /** Комментарий к плану */
  note?: string;
  /** Полная ссылка на карточку (hash app) */
  buildDealerHref: (dealerId: string) => string;
};

export function buildDealerWorkPlanCopyText(rows: DealerRow[], options: DealerWorkPlanCopyOptions): string {
  const lines: string[] = ["Клиенты в работу:"];
  rows.forEach((row, idx) => {
    const href = options.buildDealerHref(row.id);
    lines.push(`${idx + 1}. ${row.name} — ${row.city} — ${row.manager} — ${href}`);
  });
  if (options.workDateIso?.trim()) {
    lines.push("");
    lines.push(`Дата работы: ${formatWorkPlanDateRu(options.workDateIso.trim())}`);
  }
  const note = options.note?.trim();
  if (note) {
    lines.push("");
    lines.push(`Комментарий: ${note}`);
  }
  return lines.join("\n");
}
