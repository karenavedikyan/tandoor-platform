import { CATALOG_PRODUCTS, type CatalogProduct } from "./catalog-data.js";
import { type DealerRow, type DealerTradePoint } from "./dealer-base-mock-data.js";
import { getCatalogDealerRows } from "./dealer-base-source.js";
import { getAllMatrixTasks, type MatrixTaskWithContext } from "./trade-point-task-data.js";

/** Имя менеджера продаж для привязки «моих» клиентов в публичном сценарии (Release 1 / Excel). */
export const SALES_MANAGER_PUBLIC_NAME = "Бойко Екатерина Михайловна";

function parseDue(due: string): Date {
  const parts = due.split(".");
  if (parts.length !== 3) return new Date(0);
  const d = Number(parts[0]);
  const m = Number(parts[1]);
  const y = Number(parts[2]);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return new Date(0);
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function isMatrixTaskOverdue(due: string): boolean {
  return parseDue(due) < startOfToday();
}

export function isMatrixTaskDueToday(due: string): boolean {
  const d = parseDue(due);
  const t = startOfToday();
  return d.getTime() === t.getTime();
}

/** Задачи матрицы, назначенные на роль «менеджер» (зона ответственности менеджера продаж). */
export function getSalesManagerMatrixTasks(): MatrixTaskWithContext[] {
  return getAllMatrixTasks().filter((t) => t.assigneeRole === "manager" && t.status !== "done");
}

export function getMyDealers(): DealerRow[] {
  const rows = getCatalogDealerRows();
  const mine = rows.filter((r) => r.manager === SALES_MANAGER_PUBLIC_NAME);
  if (mine.length >= 6) return mine.slice(0, 10);
  return rows.slice(0, 8);
}

export function matrixCompletionPercent(tp: DealerTradePoint): number {
  return tp.distribution.total;
}

export type TradePointAttentionRow = {
  dealerId: string;
  dealerName: string;
  point: DealerTradePoint;
  matrixPercent: number;
  zoneLabel: string;
  reason: string;
};

export function getTradePointsNeedingAttention(max = 8): TradePointAttentionRow[] {
  const out: TradePointAttentionRow[] = [];
  const zones = ["Юг · портал", "Юг · розница", "Регион · ключевые"];
  const allTasks = getAllMatrixTasks();

  for (const dealer of getCatalogDealerRows()) {
    for (const tp of dealer.tradePoints) {
      const pct = matrixCompletionPercent(tp);
      const pointTasks = allTasks.filter((t) => t.tradePointId === tp.id && t.status !== "done");
      const overdueHigh = pointTasks.some((t) => t.priority === "high" && isMatrixTaskOverdue(t.dueDate));
      const lowMatrix = pct < 62;
      const showcase = tp.showcaseNeeds.length > 0;
      if (lowMatrix || overdueHigh || showcase) {
        const reason = overdueHigh
          ? "Есть просроченные задачи высокого приоритета"
          : lowMatrix
            ? "Неполная матрица / низкая дистрибуция"
            : "Рекомендации по витрине";
        out.push({
          dealerId: dealer.id,
          dealerName: dealer.name,
          point: tp,
          matrixPercent: pct,
          zoneLabel: zones[(dealer.id.charCodeAt(2) + tp.id.length) % zones.length],
          reason,
        });
      }
    }
  }
  return out.slice(0, max);
}

export function getFocusProducts(max = 8): CatalogProduct[] {
  return [...CATALOG_PRODUCTS].sort((a, b) => {
    if (b.relatedTaskCount !== a.relatedTaskCount) return b.relatedTaskCount - a.relatedTaskCount;
    if (b.salesPriority !== a.salesPriority) return b.salesPriority - a.salesPriority;
    return a.name.localeCompare(b.name);
  }).slice(0, max);
}

export function matrixTaskContextHref(t: MatrixTaskWithContext): string {
  return `/dealers/${t.dealerId}/trade-points/${t.tradePointId}`;
}

export function getWorkspaceKpis() {
  const mgrTasks = getSalesManagerMatrixTasks();
  const overdue = mgrTasks.filter(
    (t) => t.status === "overdue" || (t.status !== "done" && isMatrixTaskOverdue(t.dueDate)),
  ).length;
  const today = mgrTasks.filter((t) => isMatrixTaskDueToday(t.dueDate) && t.status !== "done").length;
  const myDealers = getMyDealers();
  const inactive = myDealers.filter((d) => !d.hasRecentActivity).length;
  const matrixGaps = getTradePointsNeedingAttention(100).filter((r) => r.matrixPercent < 62).length;
  const focusCount = getFocusProducts(20).filter((p) => p.relatedTaskCount > 0 || p.isTop).length;
  return {
    clients: myDealers.length,
    tasksOpen: mgrTasks.length,
    tradePointsIssues: getTradePointsNeedingAttention(100).length,
    focusProducts: focusCount,
    overdue,
    today,
    inactiveDealers: inactive,
    matrixGaps,
  };
}
