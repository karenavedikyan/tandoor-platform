/**
 * Heat-индикатор нагрузки менеджера (активные клиенты + ТТ) для списков на /main.
 */

export type ManagerHeatLevel = "high" | "medium" | "low";

export type ManagerLoadEntry = {
  id: string;
  clientsActive: number;
  tradePointsActive: number;
};

const HEAT_SORT_ORDER: Record<ManagerHeatLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function managerLoadScore(entry: ManagerLoadEntry): number {
  return entry.clientsActive + entry.tradePointsActive;
}

/** Квантили: top 33% high, middle medium, bottom 33% low. */
export function computeManagerHeatMap(managers: ManagerLoadEntry[]): Record<string, ManagerHeatLevel> {
  const result: Record<string, ManagerHeatLevel> = {};
  const n = managers.length;
  if (n === 0) return result;

  const sorted = [...managers].sort((a, b) => managerLoadScore(b) - managerLoadScore(a));

  if (n === 1) {
    result[sorted[0]!.id] = "medium";
    return result;
  }
  if (n === 2) {
    result[sorted[0]!.id] = "high";
    result[sorted[1]!.id] = "low";
    return result;
  }

  const highCount = Math.max(1, Math.floor(n / 3));
  const lowCount = Math.max(1, Math.floor(n / 3));

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const level: ManagerHeatLevel = i < highCount ? "high" : i >= n - lowCount ? "low" : "medium";
    result[row.id] = level;
  }
  return result;
}

export function managerHeatBarClass(level: ManagerHeatLevel): string {
  switch (level) {
    case "high":
      return "bg-red-500/70";
    case "medium":
      return "bg-amber-500/70";
    case "low":
      return "bg-emerald-500/70";
  }
}

export function managerHeatTooltipLabel(level: ManagerHeatLevel): string {
  switch (level) {
    case "high":
      return "Высокая нагрузка";
    case "medium":
      return "Средняя нагрузка";
    case "low":
      return "Низкая нагрузка";
  }
}

export function managerHeatAriaLabel(level: ManagerHeatLevel): string {
  switch (level) {
    case "high":
      return "Нагрузка: высокая";
    case "medium":
      return "Нагрузка: средняя";
    case "low":
      return "Нагрузка: низкая";
  }
}

/** Сортировка: high → medium → low, внутри группы по load ↓, затем по ФИО. */
export function sortManagersByHeat<T extends { id: string; fullName: string }>(
  managers: T[],
  heatMap: Record<string, ManagerHeatLevel>,
  loadEntries: ManagerLoadEntry[],
): T[] {
  const loadById = Object.fromEntries(loadEntries.map((e) => [e.id, managerLoadScore(e)])) as Record<
    string,
    number
  >;

  return [...managers].sort((a, b) => {
    const ha = heatMap[a.id] ?? "medium";
    const hb = heatMap[b.id] ?? "medium";
    const tier = HEAT_SORT_ORDER[ha] - HEAT_SORT_ORDER[hb];
    if (tier !== 0) return tier;
    const loadDiff = (loadById[b.id] ?? 0) - (loadById[a.id] ?? 0);
    if (loadDiff !== 0) return loadDiff;
    return a.fullName.localeCompare(b.fullName, "ru");
  });
}

export function buildManagerLoadEntriesFromMetrics(
  managerIds: string[],
  metricsById: Map<string, { activeClients: number; activeTradePoints: number } | null | undefined>,
): ManagerLoadEntry[] {
  return managerIds.map((id) => {
    const m = metricsById.get(id);
    return {
      id,
      clientsActive: m?.activeClients ?? 0,
      tradePointsActive: m?.activeTradePoints ?? 0,
    };
  });
}

export function orderManagersWithHeat<T extends { id: string; fullName: string }>(
  managers: T[],
  metricsById: Map<string, { activeClients: number; activeTradePoints: number } | null | undefined>,
): { managers: T[]; heatMap: Record<string, ManagerHeatLevel> } {
  const entries = buildManagerLoadEntriesFromMetrics(
    managers.map((m) => m.id),
    metricsById,
  );
  const heatMap = computeManagerHeatMap(entries);
  return {
    managers: sortManagersByHeat(managers, heatMap, entries),
    heatMap,
  };
}
