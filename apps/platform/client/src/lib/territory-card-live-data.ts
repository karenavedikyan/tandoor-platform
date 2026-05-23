/**
 * «Карточка территории» для РОП/директора: агрегаты по активной merge-клиентской базе.
 * Режим {@link BuildTerritoryCardLivePackOptions.directorRopFactualUi}: без псевдо-KPI из мок-строк;
 * задачи витрины — только записи плана из sessionStorage; витрина/матрица — только сохранённые данные;
 * зоны внимания — просрочки плана витрины и явные задачи матрицы из актуализации state.
 */

import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import { isClientTopTier } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { loadShowcaseMatrixStorage, type ShowcaseMatrixEntryStored } from "@/lib/trade-point-showcase-matrix-storage";
import { getTrainingAttentionKpisForDealers, type TerritoryTrainingAttentionKpis } from "@/lib/training-attention";
import {
  getShowcaseBackedTasksForDealers,
  getShowcaseDistributionPlanTasksForDealers,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";
import type {
  TerritoryCitySummary,
  TerritoryFocusItem,
  TerritoryOperationalSummary,
  TerritoryPlanLine,
  TerritoryRiskItem,
  TerritoryShowcaseItem,
  TerritoryTradePointCard,
} from "@/lib/territory-card-data";

export type BuildTerritoryCardLivePackOptions = {
  /** РОП/директор в production: только фактические счётчики базы и данные из сохранённых сущностей. */
  directorRopFactualUi?: boolean;
  /** Объединённый state актуализации команды (сохранённые витрины ТТ, задачи матрицы из форм). */
  mergedActualization?: ActualizationState;
};

/** Строка контроля витрины/матрицы с метаданными сохранения (cockpit drill-down). */
export type TerritoryShowcaseControlDetail = {
  tradePointId: string;
  dealerId: string;
  dealerName: string;
  tpName: string;
  city: string;
  source: "actualization" | "matrix";
  updatedAt: string;
  updatedByName: string;
};

export type TerritoryCardLivePack = {
  summary: TerritoryOperationalSummary;
  planLines: TerritoryPlanLine[];
  cities: TerritoryCitySummary[];
  focus: TerritoryFocusItem[];
  tasks: MatrixTaskWithContext[];
  tradePoints: TerritoryTradePointCard[];
  showcases: TerritoryShowcaseItem[];
  risks: TerritoryRiskItem[];
  trainingKpis: TerritoryTrainingAttentionKpis;
  directorRopFactualUi: boolean;
  /** Торговые точки в scope с сохранённой актуализацией витрины или ячейкой матрицы в localStorage (с меткой времени/автора). */
  factualShowcaseMatrixControlledTpCount: number;
  /** Cockpit: снимок дилеров merge (пустой массив вне factual-режима). */
  cockpitDealers: DealerRow[];
  /** Cockpit: все persisted-задачи плана витрины (factual); иначе []. */
  cockpitPersistedTasksAll: MatrixTaskWithContext[];
  /** Cockpit: ТТ с сохранённым контролем и метаданными (factual); иначе []. */
  cockpitShowcaseControlDetails: TerritoryShowcaseControlDetail[];
};

const NO_CITY = "__no_city__";

function bucketCity(dealer: DealerRow): string {
  const t = dealer.city?.trim();
  if (!t || t === "—" || t === "-") return NO_CITY;
  return t;
}

/** Совпадение с `TerritoryCitySummary.name` («Без города» для пустого города). */
export function dealerBelongsToTerritoryCityDisplayName(dealer: DealerRow, cityDisplayName: string): boolean {
  const k = bucketCity(dealer);
  if (cityDisplayName === "Без города") return k === NO_CITY;
  return k === cityDisplayName;
}

function slugCity(name: string): string {
  if (name === NO_CITY) return "no-city";
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

function aggregateCityBucket(
  dealers: DealerRow[],
  taskCountByDealerId: Map<string, number>,
): {
  dealersCount: number;
  activeDealersCount: number;
  topDealersCount: number;
  attentionDealersCount: number;
  tradePointsCount: number;
  ordersCount: number;
  tasksCount: number;
} {
  let tasksCount = 0;
  for (const d of dealers) {
    tasksCount += taskCountByDealerId.get(d.id) ?? 0;
  }
  return {
    dealersCount: dealers.length,
    activeDealersCount: dealers.filter((d) => d.status === "активный").length,
    topDealersCount: dealers.filter((d) => isClientTopTier(d.clientCategory)).length,
    attentionDealersCount: dealers.filter((d) => d.status === "требует внимания" || d.hasProblem).length,
    tradePointsCount: dealers.reduce((s, d) => s + d.tradePoints.length, 0),
    ordersCount: 0,
    tasksCount,
  };
}

function buildCitySummary(displayName: string, cityKey: string, dealers: DealerRow[], taskMap: Map<string, number>): TerritoryCitySummary {
  const agg = aggregateCityBucket(dealers, taskMap);
  const mkFact = Math.round(dealers.reduce((s, d) => s + d.distributionDetail.mk, 0));
  const vhFact = Math.round(dealers.reduce((s, d) => s + d.distributionDetail.vh, 0));
  return {
    id: slugCity(cityKey),
    name: displayName,
    ...agg,
    mkPlanUnits: mkFact,
    mkFactUnits: mkFact,
    vhPlanUnits: vhFact,
    vhFactUnits: vhFact,
    hardwarePlanMoney: 0,
    hardwareFactMoney: 0,
  };
}

/** Город без сегментов/плана-факта: только состав базы и счётчик задач плана витрины (если factual — taskMap уже отфильтрован). */
function buildCitySummaryFactual(displayName: string, cityKey: string, dealers: DealerRow[], taskMap: Map<string, number>): TerritoryCitySummary {
  const agg = aggregateCityBucket(dealers, taskMap);
  return {
    id: slugCity(cityKey),
    name: displayName,
    dealersCount: agg.dealersCount,
    activeDealersCount: agg.activeDealersCount,
    topDealersCount: 0,
    attentionDealersCount: 0,
    tradePointsCount: agg.tradePointsCount,
    ordersCount: 0,
    tasksCount: agg.tasksCount,
    mkPlanUnits: 0,
    mkFactUnits: 0,
    vhPlanUnits: 0,
    vhFactUnits: 0,
    hardwarePlanMoney: 0,
    hardwareFactMoney: 0,
  };
}

function territoryTaskRank(t: MatrixTaskWithContext): number {
  return (t.status === "overdue" ? 4 : 0) + (t.priority === "high" ? 2 : 0) + (t.status === "new" ? 1 : 0);
}

function pickTopTasks(tasks: MatrixTaskWithContext[], limit: number): MatrixTaskWithContext[] {
  const buf: MatrixTaskWithContext[] = [];
  for (const t of tasks) {
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

function pickWorstTradePoints(dealers: DealerRow[], limit: number): TerritoryTradePointCard[] {
  const buf: TerritoryTradePointCard[] = [];
  const makeCard = (d: DealerRow, p: DealerRow["tradePoints"][number]): TerritoryTradePointCard => ({
    pointId: p.id,
    dealerId: d.id,
    dealerLabel: d.name,
    city: p.city?.trim() && p.city.trim() !== "—" ? p.city.trim() : "Без города",
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
  for (const d of dealers) {
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

/** Плоский список точек для фактического режима (без отбора «худших» по мок-матрице). */
function pickTradePointsFactualList(dealers: DealerRow[], limit: number): TerritoryTradePointCard[] {
  const out: TerritoryTradePointCard[] = [];
  for (const d of dealers) {
    for (const p of d.tradePoints) {
      out.push({
        pointId: p.id,
        dealerId: d.id,
        dealerLabel: d.name,
        city: p.city?.trim() && p.city.trim() !== "—" ? p.city.trim() : "Без города",
        pointLabel: p.name,
        status: p.status,
        matrixPercent: 0,
        showcaseLine: "",
        lastActivity: "",
        issuesShort: "",
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function buildFocus(dealers: DealerRow[]): TerritoryFocusItem[] {
  const sorted = [...dealers].sort((a, b) => {
    const score = (x: DealerRow) => (x.hasProblem ? 4 : 0) + (x.status === "требует внимания" ? 3 : 0) + (isClientTopTier(x.clientCategory) ? 2 : 0);
    return score(b) - score(a);
  });
  return sorted.slice(0, 8).map((d) => ({
    id: `focus-dealer-${d.id}`,
    title: d.name,
    type: "dealer" as const,
    description: `${bucketCity(d) === NO_CITY ? "Без города" : d.city?.trim() || "Без города"} · ${d.nextAction}`,
    href: `/dealers/${d.id}`,
  }));
}

function buildRisks(dealers: DealerRow[], tasks: MatrixTaskWithContext[]): TerritoryRiskItem[] {
  const risks: TerritoryRiskItem[] = [];
  let n = 0;
  for (const d of dealers.filter((x) => x.hasProblem || x.status === "требует внимания").slice(0, 4)) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: `${d.name}: статус клиента`,
      level: d.hasProblem ? "critical" : "attention",
      city: bucketCity(d) === NO_CITY ? "Без города" : d.city?.trim() || "Без города",
      dealerId: d.id,
      reason: "Клиент в зоне внимания по данным актуальной базы.",
      nextAction: d.nextAction,
    });
  }
  for (const t of tasks.filter((x) => x.status === "overdue").slice(0, 3)) {
    n += 1;
    const d = dealers.find((x) => x.id === t.dealerId);
    risks.push({
      id: `risk-${n}`,
      title: t.title,
      level: "attention",
      city: d ? (bucketCity(d) === NO_CITY ? "Без города" : d.city?.trim() || "Без города") : "Без города",
      dealerId: t.dealerId,
      tradePointId: t.tradePointId,
      reason: "Просрочена задача по витрине / матрице.",
      nextAction: "Проверьте статус в списке задач по витрине.",
    });
  }
  return risks.slice(0, 8);
}

function tradePointIdsInScope(dealers: DealerRow[]): Set<string> {
  const s = new Set<string>();
  for (const d of dealers) {
    for (const p of d.tradePoints) s.add(p.id);
  }
  return s;
}

function countTradePointsWithPersistedShowcaseOrMatrix(
  dealers: DealerRow[],
  merged: ActualizationState,
  matrixStorage: ReturnType<typeof loadShowcaseMatrixStorage>,
): number {
  const keys = new Set<string>();
  for (const d of dealers) {
    for (const tp of d.tradePoints) {
      const composite = `${d.id}|${tp.id}`;
      const sh = merged.tradePointShowcaseActualizationById[tp.id];
      if (sh?.updatedAt?.trim()) {
        keys.add(composite);
        continue;
      }
      const prefix = `${d.id}|${tp.id}|`;
      for (const [entryKey, entry] of Object.entries(matrixStorage.entries)) {
        if (!entryKey.startsWith(prefix)) continue;
        if (entry.updatedAt?.trim() || entry.updatedBy?.trim()) {
          keys.add(composite);
          break;
        }
      }
    }
  }
  return keys.size;
}

function buildShowcaseControlDetails(
  dealers: DealerRow[],
  merged: ActualizationState,
  matrixStorage: ReturnType<typeof loadShowcaseMatrixStorage>,
): TerritoryShowcaseControlDetail[] {
  const out: TerritoryShowcaseControlDetail[] = [];
  for (const d of dealers) {
    for (const tp of d.tradePoints) {
      const city = tp.city?.trim() && tp.city.trim() !== "—" ? tp.city.trim() : "Без города";
      const sh = merged.tradePointShowcaseActualizationById[tp.id];
      if (sh?.updatedAt?.trim()) {
        out.push({
          tradePointId: tp.id,
          dealerId: d.id,
          dealerName: d.name,
          tpName: tp.name,
          city,
          source: "actualization",
          updatedAt: sh.updatedAt.trim(),
          updatedByName: (sh.updatedByName ?? sh.updatedBy ?? "").trim(),
        });
        continue;
      }
      const prefix = `${d.id}|${tp.id}|`;
      let matrixHit: ShowcaseMatrixEntryStored | null = null;
      for (const [entryKey, entry] of Object.entries(matrixStorage.entries)) {
        if (!entryKey.startsWith(prefix)) continue;
        if (entry.updatedAt?.trim() || entry.updatedBy?.trim()) {
          matrixHit = entry;
          break;
        }
      }
      if (matrixHit) {
        out.push({
          tradePointId: tp.id,
          dealerId: d.id,
          dealerName: d.name,
          tpName: tp.name,
          city,
          source: "matrix",
          updatedAt: (matrixHit.updatedAt ?? "").trim(),
          updatedByName: (matrixHit.updatedByName ?? matrixHit.updatedBy ?? "").trim(),
        });
      }
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function buildShowcaseSummaryFromActualization(dealers: DealerRow[], merged: ActualizationState): TerritoryShowcaseItem[] {
  const tpScope = tradePointIdsInScope(dealers);
  const dealerByTp = new Map<string, { dealer: DealerRow; tp: DealerRow["tradePoints"][number] }>();
  for (const d of dealers) {
    for (const tp of d.tradePoints) {
      dealerByTp.set(tp.id, { dealer: d, tp });
    }
  }
  const out: TerritoryShowcaseItem[] = [];
  let i = 0;
  for (const [tpId, sh] of Object.entries(merged.tradePointShowcaseActualizationById)) {
    if (!tpScope.has(tpId) || !sh.updatedAt?.trim()) continue;
    const pair = dealerByTp.get(tpId);
    if (!pair) continue;
    const { dealer, tp } = pair;
    const parts: string[] = [];
    if (sh.firstPriorityNeed?.trim()) parts.push(sh.firstPriorityNeed.trim());
    if (sh.fillingComment?.trim()) parts.push(sh.fillingComment.trim());
    if (sh.showcaseComment?.trim()) parts.push(sh.showcaseComment.trim());
    const city = tp.city?.trim() && tp.city.trim() !== "—" ? tp.city.trim() : "Без города";
    out.push({
      id: `sh-act-${tpId}-${i}`,
      tradePointId: tpId,
      dealerId: dealer.id,
      city,
      headline: `${tp.name} · ${dealer.name}`,
      statusLine: parts.length > 0 ? parts.join(" · ") : "Сохранён контроль витрины в актуализации",
    });
    i += 1;
  }
  return out.slice(0, 16);
}

function buildPersistedAttentionRisks(
  dealers: DealerRow[],
  persistedPlanTasks: MatrixTaskWithContext[],
  merged: ActualizationState,
): TerritoryRiskItem[] {
  const risks: TerritoryRiskItem[] = [];
  const dealerById = new Map(dealers.map((d) => [d.id, d] as const));
  const tpScope = tradePointIdsInScope(dealers);

  for (const t of persistedPlanTasks.filter((x) => x.status === "overdue")) {
    const d = dealerById.get(t.dealerId);
    risks.push({
      id: `risk-plan-${t.taskId}`,
      title: t.title,
      level: "attention",
      city: d ? (bucketCity(d) === NO_CITY ? "Без города" : d.city?.trim() || "Без города") : "Без города",
      dealerId: t.dealerId,
      tradePointId: t.tradePointId,
      reason: "Просрочена задача плана витрины (запись в системе задач витрины).",
      nextAction: "Откройте раздел «Задачи по витрине» или карточку точки.",
    });
  }

  for (const [tpId, sh] of Object.entries(merged.tradePointShowcaseActualizationById)) {
    if (!tpScope.has(tpId)) continue;
    const tasks = sh.showcaseMatrixTasks ?? [];
    for (const mt of tasks) {
      if (mt.status !== "new") continue;
      const d = dealerById.get(mt.dealerId);
      risks.push({
        id: `risk-mtx-${mt.id}`,
        title: `Матрица витрины: ${mt.productName}`,
        level: "attention",
        city: d ? (bucketCity(d) === NO_CITY ? "Без города" : d.city?.trim() || "Без города") : "Без города",
        dealerId: mt.dealerId,
        tradePointId: mt.tradePointId,
        reason: "Открытая задача из актуализации витрины торговой точки (создана вручную в форме).",
        nextAction: "Выполните или закройте задачу в карточке торговой точки.",
      });
    }
  }

  return risks.slice(0, 12);
}

export function buildTerritoryCardLivePack(
  dealers: DealerRow[],
  territoryLabel: string,
  options?: BuildTerritoryCardLivePackOptions,
): TerritoryCardLivePack {
  const directorRopFactualUi = Boolean(options?.directorRopFactualUi);
  const merged = options?.mergedActualization ?? createEmptyActualizationState();

  if (directorRopFactualUi) {
    const matrixStorage = loadShowcaseMatrixStorage();
    const persistedPlanTasks = getShowcaseDistributionPlanTasksForDealers(dealers);
    const taskMap = buildTaskCountByDealerId(persistedPlanTasks);
    const factualShowcaseMatrixControlledTpCount = countTradePointsWithPersistedShowcaseOrMatrix(dealers, merged, matrixStorage);
    const cockpitShowcaseControlDetails = buildShowcaseControlDetails(dealers, merged, matrixStorage);

    const byCity = new Map<string, DealerRow[]>();
    for (const d of dealers) {
      const k = bucketCity(d);
      const arr = byCity.get(k);
      if (arr) arr.push(d);
      else byCity.set(k, [d]);
    }
    const cities: TerritoryCitySummary[] = [];
    for (const [key, group] of Array.from(byCity.entries())) {
      const display = key === NO_CITY ? "Без города" : key;
      cities.push(buildCitySummaryFactual(display, key, group, taskMap));
    }
    cities.sort((a, b) => b.dealersCount - a.dealersCount || a.name.localeCompare(b.name, "ru"));

    const tasksOpenPersisted = persistedPlanTasks.filter((t) => t.status !== "done").length;
    const risks = buildPersistedAttentionRisks(dealers, persistedPlanTasks, merged);

    const summary: TerritoryOperationalSummary = {
      territoryId: "active-base",
      territoryLabel,
      dealersTotal: dealers.length,
      dealersActive: dealers.filter((d) => d.status === "активный").length,
      tradePointsTotal: dealers.reduce((s, d) => s + d.tradePoints.length, 0),
      ordersInProgress: 0,
      tasksOpen: tasksOpenPersisted,
      showcaseFollowUps: factualShowcaseMatrixControlledTpCount,
      attentionSignals: risks.length,
    };

    return {
      summary,
      planLines: [],
      cities,
      focus: [],
      tasks: pickTopTasks(persistedPlanTasks, 10),
      tradePoints: pickTradePointsFactualList(dealers, 24),
      showcases: buildShowcaseSummaryFromActualization(dealers, merged),
      risks,
      trainingKpis: getTrainingAttentionKpisForDealers(dealers),
      directorRopFactualUi: true,
      factualShowcaseMatrixControlledTpCount,
      cockpitDealers: dealers,
      cockpitPersistedTasksAll: persistedPlanTasks,
      cockpitShowcaseControlDetails,
    };
  }

  const tasks = getShowcaseBackedTasksForDealers(dealers);
  const taskMap = buildTaskCountByDealerId(tasks);
  const byCity = new Map<string, DealerRow[]>();
  for (const d of dealers) {
    const k = bucketCity(d);
    const arr = byCity.get(k);
    if (arr) arr.push(d);
    else byCity.set(k, [d]);
  }
  const cities: TerritoryCitySummary[] = [];
  for (const [key, group] of Array.from(byCity.entries())) {
    const display = key === NO_CITY ? "Без города" : key;
    cities.push(buildCitySummary(display, key, group, taskMap));
  }
  cities.sort((a, b) => b.dealersCount - a.dealersCount || a.name.localeCompare(b.name, "ru"));

  const tasksOpen = tasks.filter((t) => t.status !== "done").length;
  const showcaseFollowUps = dealers.reduce((sum, d) => {
    return (
      sum +
      d.tradePoints.filter((p) => {
        const dist = p.distribution?.total ?? 0;
        const iss = (p.issues ?? "").toLowerCase();
        return dist < 72 || iss.includes("витрин");
      }).length
    );
  }, 0);
  const attentionSignals =
    dealers.filter((d) => d.hasProblem || d.status === "требует внимания").length + tasks.filter((t) => t.status === "overdue").length;

  const summary: TerritoryOperationalSummary = {
    territoryId: "active-base",
    territoryLabel,
    dealersTotal: dealers.length,
    dealersActive: dealers.filter((d) => d.status === "активный").length,
    tradePointsTotal: dealers.reduce((s, d) => s + d.tradePoints.length, 0),
    ordersInProgress: 0,
    tasksOpen,
    showcaseFollowUps,
    attentionSignals,
  };

  const tradePoints = pickWorstTradePoints(dealers, 12);
  const showcases: TerritoryShowcaseItem[] = tradePoints.slice(0, 16).map((tp, i) => ({
    id: `showcase-${tp.pointId}-${i}`,
    tradePointId: tp.pointId,
    dealerId: tp.dealerId,
    city: tp.city,
    headline: `${tp.pointLabel} · ${tp.dealerLabel}`,
    statusLine: tp.showcaseLine,
  }));

  return {
    summary,
    planLines: [],
    cities,
    focus: buildFocus(dealers),
    tasks: pickTopTasks(tasks, 10),
    tradePoints,
    showcases,
    risks: buildRisks(dealers, tasks),
    trainingKpis: getTrainingAttentionKpisForDealers(dealers),
    directorRopFactualUi: false,
    factualShowcaseMatrixControlledTpCount: 0,
    cockpitDealers: [],
    cockpitPersistedTasksAll: [],
    cockpitShowcaseControlDetails: [],
  };
}
