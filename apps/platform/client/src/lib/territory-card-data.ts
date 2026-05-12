/**
 * Агрегаты для операционной «Карточки территории» поверх существующих обезличенных данных.
 * Без дублирования крупных массивов — только вычисления и склейка.
 * Важно: не вызывать getAllMatrixTasks() в цикле по городам — один проход и карты по dealerId.
 */

import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { getAllOrders, orderNeedsManagerAttention, type OrderRow } from "@/lib/order-data";
import { getAllMatrixTasks, type MatrixTaskWithContext } from "@/lib/trade-point-task-data";
import {
  getCityAnalyticsRows,
  getSalesPlanMetrics,
  getTerritoryAnalytics,
  planCompletionPercent,
  remainingToPlan,
  type CityAnalytics,
} from "@/lib/sales-manager-kpi-data";

/** Территория по умолчанию для карточки (совпадает с аналитикой «Юг»). */
export const TERRITORY_CARD_SCOPE_ID = "south";

export type TerritoryCitySummary = {
  id: string;
  name: string;
  dealersCount: number;
  activeDealersCount: number;
  topDealersCount: number;
  attentionDealersCount: number;
  tradePointsCount: number;
  ordersCount: number;
  tasksCount: number;
  mkPlanUnits: number;
  mkFactUnits: number;
  vhPlanUnits: number;
  vhFactUnits: number;
  hardwarePlanMoney: number;
  hardwareFactMoney: number;
};

export type TerritoryRiskItem = {
  id: string;
  title: string;
  level: "critical" | "attention" | "normal";
  city: string;
  dealerId?: string;
  tradePointId?: string;
  reason: string;
  nextAction: string;
};

export type TerritoryFocusItem = {
  id: string;
  title: string;
  type: "dealer" | "trade_point" | "product" | "showcase" | "order" | "task";
  description: string;
  href: string;
};

export type TerritoryOperationalSummary = {
  territoryId: string;
  territoryLabel: string;
  dealersTotal: number;
  dealersActive: number;
  tradePointsTotal: number;
  ordersInProgress: number;
  tasksOpen: number;
  showcaseFollowUps: number;
  attentionSignals: number;
};

export type TerritoryPlanLine = {
  key: "mk" | "vh" | "hardware";
  label: string;
  unitLabel: string;
  plan: number;
  fact: number;
  completionPercent: number;
  remainder: number;
};

export type TerritoryTradePointCard = {
  pointId: string;
  dealerId: string;
  dealerLabel: string;
  city: string;
  pointLabel: string;
  status: string;
  matrixPercent: number;
  showcaseLine: string;
  lastActivity: string;
  issuesShort: string;
};

export type TerritoryShowcaseItem = {
  id: string;
  tradePointId: string;
  dealerId: string;
  city: string;
  headline: string;
  statusLine: string;
};

const IN_PROGRESS_ORDER: OrderRow["status"][] = [
  "новый",
  "на подтверждении",
  "подтверждён",
  "в комплектации",
  "частично укомплектован",
];

function slugCity(name: string): string {
  const known: Record<string, string> = {
    Ставрополь: "stavropol",
    Астрахань: "astrakhan",
  };
  if (known[name]) return known[name];
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return `city-${Math.abs(h)}`;
}

function buildTaskCountByDealerId(tasks: MatrixTaskWithContext[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) {
    m.set(t.dealerId, (m.get(t.dealerId) ?? 0) + 1);
  }
  return m;
}

function aggregateDealersForCity(
  dealers: DealerRow[],
  taskCountByDealerId: Map<string, number>,
  orders: OrderRow[],
): {
  dealersCount: number;
  activeDealersCount: number;
  topDealersCount: number;
  attentionDealersCount: number;
  tradePointsCount: number;
  ordersCount: number;
  tasksCount: number;
} {
  let ordersCount = 0;
  let tasksCount = 0;
  for (const d of dealers) {
    tasksCount += taskCountByDealerId.get(d.id) ?? 0;
  }
  const ids = new Set(dealers.map((d) => d.id));
  for (const o of orders) {
    if (ids.has(o.dealerId)) ordersCount += 1;
  }
  return {
    dealersCount: dealers.length,
    activeDealersCount: dealers.filter((d) => d.status === "активный").length,
    topDealersCount: dealers.filter((d) => d.category === "TOP").length,
    attentionDealersCount: dealers.filter((d) => d.status === "требует внимания" || d.hasProblem).length,
    tradePointsCount: dealers.reduce((s, d) => s + d.tradePoints.length, 0),
    ordersCount,
    tasksCount,
  };
}

function buildCityFromKpi(
  row: CityAnalytics,
  dealers: DealerRow[],
  taskCountByDealerId: Map<string, number>,
  orders: OrderRow[],
): TerritoryCitySummary {
  const agg = aggregateDealersForCity(dealers, taskCountByDealerId, orders);
  const mkPlan = Math.max(row.mkUnits, Math.round(row.mkUnits * 1.08));
  const vhPlan = Math.max(row.vhUnits, Math.round(row.vhUnits * 1.1));
  const hwPlan = Math.max(row.hardwareTurnoverRub, Math.round(row.hardwareTurnoverRub * 1.1));
  return {
    id: row.cityId,
    name: row.name,
    ...agg,
    mkPlanUnits: mkPlan,
    mkFactUnits: row.mkUnits,
    vhPlanUnits: vhPlan,
    vhFactUnits: row.vhUnits,
    hardwarePlanMoney: hwPlan,
    hardwareFactMoney: row.hardwareTurnoverRub,
  };
}

function buildCityFromDealersOnly(
  cityName: string,
  dealers: DealerRow[],
  taskCountByDealerId: Map<string, number>,
  orders: OrderRow[],
): TerritoryCitySummary {
  const agg = aggregateDealersForCity(dealers, taskCountByDealerId, orders);
  const avgMk = dealers.length ? Math.round(dealers.reduce((s, d) => s + d.distributionDetail.mk, 0) / dealers.length) : 0;
  const avgVh = dealers.length ? Math.round(dealers.reduce((s, d) => s + d.distributionDetail.vh, 0) / dealers.length) : 0;
  const mkFact = Math.max(40, Math.round(avgMk * 2.4));
  const vhFact = Math.max(35, Math.round(avgVh * 2.1));
  const hwFact = Math.max(800_000, dealers.length * 620_000 + (cityName.length % 7) * 120_000);
  return {
    id: slugCity(cityName),
    name: cityName,
    ...agg,
    mkPlanUnits: Math.round(mkFact * 1.1),
    mkFactUnits: mkFact,
    vhPlanUnits: Math.round(vhFact * 1.12),
    vhFactUnits: vhFact,
    hardwarePlanMoney: Math.round(hwFact * 1.09),
    hardwareFactMoney: hwFact,
  };
}

function groupDealersByCity(): Map<string, DealerRow[]> {
  const byCity = new Map<string, DealerRow[]>();
  for (const d of DEALER_BASE_ROWS) {
    const arr = byCity.get(d.city);
    if (arr) arr.push(d);
    else byCity.set(d.city, [d]);
  }
  return byCity;
}

export function getTerritorySummary(): TerritoryOperationalSummary {
  const territory = getTerritoryAnalytics(TERRITORY_CARD_SCOPE_ID);
  const dealers = DEALER_BASE_ROWS;
  const orders = getAllOrders();
  const matrixTasks = getAllMatrixTasks();

  const ordersInProgress = orders.filter((o) => IN_PROGRESS_ORDER.includes(o.status)).length;
  const tasksOpen = matrixTasks.filter((t) => t.status !== "done").length;

  const showcaseFollowUps = dealers.reduce((sum, d) => {
    return (
      sum +
      d.tradePoints.filter((p) => p.distribution.total < 72 || p.issues.includes("витрин")).length
    );
  }, 0);

  let overdueCount = 0;
  for (const t of matrixTasks) {
    if (t.status === "overdue") overdueCount += 1;
  }

  const attentionSignals =
    dealers.filter((d) => d.hasProblem || d.status === "требует внимания").length +
    overdueCount +
    orders.filter((o) => orderNeedsManagerAttention(o)).length;

  return {
    territoryId: territory.territoryId,
    territoryLabel: territory.territoryLabel,
    dealersTotal: dealers.length,
    dealersActive: dealers.filter((d) => d.status === "активный").length,
    tradePointsTotal: dealers.reduce((s, d) => s + d.tradePoints.length, 0),
    ordersInProgress,
    tasksOpen,
    showcaseFollowUps,
    attentionSignals,
  };
}

export function getTerritoryCities(): TerritoryCitySummary[] {
  const matrixTasks = getAllMatrixTasks();
  const taskCountByDealerId = buildTaskCountByDealerId(matrixTasks);
  const orders = getAllOrders();
  const dealersByCity = groupDealersByCity();

  const kpiNames = new Set(getCityAnalyticsRows("all").map((c) => c.name));
  const list: TerritoryCitySummary[] = [];
  for (const row of getCityAnalyticsRows("all")) {
    const dealers = dealersByCity.get(row.name) ?? [];
    list.push(buildCityFromKpi(row, dealers, taskCountByDealerId, orders));
  }
  const extraCityNames = Array.from(dealersByCity.keys()).filter((n) => !kpiNames.has(n));
  for (const name of extraCityNames) {
    const dealers = dealersByCity.get(name) ?? [];
    list.push(buildCityFromDealersOnly(name, dealers, taskCountByDealerId, orders));
  }
  return list.sort((a, b) => b.dealersCount - a.dealersCount);
}

export function getTerritoryRisks(): TerritoryRiskItem[] {
  const risks: TerritoryRiskItem[] = [];
  let n = 0;
  const mkMetric = getSalesPlanMetrics().find((m) => m.category === "mk");
  if (mkMetric && mkMetric.monthFact < mkMetric.monthPlan * 0.92) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: "Отставание по МК от месячного плана",
      level: "attention",
      city: "Территория",
      reason: "Факт ниже плана более чем на 8% при активных заказах в работе.",
      nextAction: "Согласовать отгрузки с клиентами в фокусе и проверить незакрытые строки заказов.",
    });
  }
  for (const d of DEALER_BASE_ROWS.filter((x) => x.hasProblem).slice(0, 3)) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: `${d.name}: витрина и поставки`,
      level: "attention",
      city: d.city,
      dealerId: d.id,
      reason: "Зафиксированы замечания по витрине или циклу поставок.",
      nextAction: d.nextAction,
    });
  }
  const matrixTasks = getAllMatrixTasks();
  const overdue: MatrixTaskWithContext[] = [];
  for (const t of matrixTasks) {
    if (t.status === "overdue") {
      overdue.push(t);
      if (overdue.length >= 2) break;
    }
  }
  for (const t of overdue) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: t.title,
      level: "critical",
      city: dCityFromPoint(t) || "—",
      dealerId: t.dealerId,
      tradePointId: t.tradePointId,
      reason: "Задача по матрице просрочена относительно срока визита.",
      nextAction: "Назначить визит или закрыть задачу после факта выкладки.",
    });
  }
  const stuck = getAllOrders().filter((o) => o.status === "на подтверждении").slice(0, 2);
  for (const o of stuck) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: `Заказ ${o.number} без движения`,
      level: "normal",
      city: o.warehouseCity,
      dealerId: o.dealerId,
      reason: "Долгое ожидание подтверждения со стороны клиента.",
      nextAction: o.nextAction,
    });
  }
  return risks.slice(0, 8);
}

function dCityFromPoint(t: MatrixTaskWithContext): string {
  const d = DEALER_BASE_ROWS.find((x) => x.id === t.dealerId);
  return d?.city ?? "";
}

export function getTerritoryFocusItems(): TerritoryFocusItem[] {
  const dealers = [...DEALER_BASE_ROWS].sort((a, b) => {
    const score = (x: DealerRow) => (x.hasProblem ? 4 : 0) + (x.status === "требует внимания" ? 3 : 0) + (x.category === "TOP" ? 2 : 0);
    return score(b) - score(a);
  });
  return dealers.slice(0, 8).map((d) => ({
    id: `focus-dealer-${d.id}`,
    title: d.name,
    type: "dealer" as const,
    description: `${d.city} · ${d.nextAction}`,
    href: `/dealers/${d.id}`,
  }));
}

export function getTerritoryRecentOrders(limit = 8): OrderRow[] {
  const pool = [...getAllOrders()].sort((a, b) => {
    const aw = orderNeedsManagerAttention(a) ? 1 : 0;
    const bw = orderNeedsManagerAttention(b) ? 1 : 0;
    if (bw !== aw) return bw - aw;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return pool.slice(0, limit);
}

function territoryTaskRank(t: MatrixTaskWithContext): number {
  return (t.status === "overdue" ? 4 : 0) + (t.priority === "high" ? 2 : 0) + (t.status === "new" ? 1 : 0);
}

/** Топ задач без сортировки всего массива (~27k). */
export function getTerritoryTasks(limit = 10): MatrixTaskWithContext[] {
  const buf: MatrixTaskWithContext[] = [];
  for (const t of getAllMatrixTasks()) {
    buf.push(t);
    if (buf.length > limit) {
      let minI = 0;
      let minR = territoryTaskRank(buf[0]!);
      for (let i = 1; i < buf.length; i += 1) {
        const r = territoryTaskRank(buf[i]!);
        if (r < minR || (r === minR && buf[i]!.taskId.localeCompare(buf[minI]!.taskId) < 0)) {
          minR = r;
          minI = i;
        }
      }
      buf.splice(minI, 1);
    }
  }
  buf.sort((a, b) => {
    const d = territoryTaskRank(b) - territoryTaskRank(a);
    if (d !== 0) return d;
    return a.taskId.localeCompare(b.taskId);
  });
  return buf;
}

function tradePointSortKey(a: TerritoryTradePointCard, b: TerritoryTradePointCard): number {
  const cmp = a.matrixPercent - b.matrixPercent;
  if (cmp !== 0) return cmp;
  const ai = a.issuesShort.includes("Требуется") ? -1 : 0;
  const bi = b.issuesShort.includes("Требуется") ? -1 : 0;
  return ai - bi;
}

/**
 * Худшие точки по матрице без материализации массива по всем ТТ (~27k).
 */
export function getTerritoryTradePoints(limit = 12): TerritoryTradePointCard[] {
  const buf: TerritoryTradePointCard[] = [];

  const makeCard = (d: DealerRow, p: DealerRow["tradePoints"][number]): TerritoryTradePointCard => ({
    pointId: p.id,
    dealerId: d.id,
    dealerLabel: d.name,
    city: p.city,
    pointLabel: p.name,
    status: p.status,
    matrixPercent: p.distribution.total,
    showcaseLine: p.showcaseStatus,
    lastActivity: p.activityHistory[0]?.date ?? p.lastVisitDate,
    issuesShort: p.issues.length > 72 ? `${p.issues.slice(0, 69)}…` : p.issues,
  });

  const refreshWorstIdx = () => {
    let worst = 0;
    for (let i = 1; i < buf.length; i += 1) {
      if (buf[i]!.matrixPercent > buf[worst]!.matrixPercent) worst = i;
    }
    return worst;
  };

  let worstIdx = 0;
  for (const d of DEALER_BASE_ROWS) {
    for (const p of d.tradePoints) {
      const card = makeCard(d, p);
      if (buf.length < limit) {
        buf.push(card);
        if (buf.length === limit) worstIdx = refreshWorstIdx();
      } else if (
        card.matrixPercent < buf[worstIdx]!.matrixPercent ||
        (card.matrixPercent === buf[worstIdx]!.matrixPercent &&
          card.issuesShort.includes("Требуется") &&
          !buf[worstIdx]!.issuesShort.includes("Требуется"))
      ) {
        buf[worstIdx] = card;
        worstIdx = refreshWorstIdx();
      }
    }
  }
  buf.sort(tradePointSortKey);
  return buf;
}

export function getTerritoryShowcases(): TerritoryShowcaseItem[] {
  return getTerritoryTradePoints(16).map((tp, i) => ({
    id: `showcase-${tp.pointId}-${i}`,
    tradePointId: tp.pointId,
    dealerId: tp.dealerId,
    city: tp.city,
    headline: `${tp.pointLabel} · ${tp.dealerLabel}`,
    statusLine: tp.showcaseLine,
  }));
}

export function getTerritoryPlanLines(): TerritoryPlanLine[] {
  const metrics = getSalesPlanMetrics();
  return metrics.map((m) => ({
    key: m.category,
    label: m.label,
    unitLabel: m.unit === "units" ? "шт." : "₽",
    plan: m.monthPlan,
    fact: m.monthFact,
    completionPercent: planCompletionPercent(m.monthPlan, m.monthFact),
    remainder: remainingToPlan(m.monthPlan, m.monthFact),
  }));
}
