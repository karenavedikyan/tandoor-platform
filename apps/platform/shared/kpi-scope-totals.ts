/**
 * KPI-агрегаты scope (Промт 3 / server KPI aggregates).
 *
 * Поля `tp_status_*` названы по контракту API; для KPI-карточек `/dealer-base`
 * считаются по **дилерам** в scope (как `pickerFiltered` по статусу строки-дилера),
 * не по торговым точкам. `total` KPI = `active_dealers` (совпадает с бейджем сайдбара).
 */

export type KpiScopeTotalsFields = {
  /** Дилеры со status = «активный» (может пересекаться с attention при has_problem). */
  tp_status_active: number;
  /** Дилеры со status = «потенциальный». */
  tp_status_potential: number;
  /** Дилеры со status = «требует внимания» ИЛИ has_problem. */
  tp_status_attention: number;
  /**
   * Дилеры без классификации активный/потенциальный/требует внимания и без has_problem
   * (напр. «приостановлен»).
   */
  dealer_no_status: number;
  /** Среднее distribution по дилерам scope; округлено. */
  avg_distribution: number;
};

/** Внутренние поля для взвешенной агрегации team/org. */
export type KpiScopeTotalsInternal = KpiScopeTotalsFields & {
  _distribution_sum: number;
  _distribution_weight: number;
};

export const EMPTY_KPI_SCOPE_TOTALS: KpiScopeTotalsInternal = {
  tp_status_active: 0,
  tp_status_potential: 0,
  tp_status_attention: 0,
  dealer_no_status: 0,
  avg_distribution: 0,
  _distribution_sum: 0,
  _distribution_weight: 0,
};

export function roundAvgDistribution(sum: number, weight: number): number {
  if (weight <= 0) return 0;
  return Math.round(sum / weight);
}

export function finalizeKpiScopeTotals(raw: KpiScopeTotalsInternal): KpiScopeTotalsFields {
  return {
    tp_status_active: raw.tp_status_active,
    tp_status_potential: raw.tp_status_potential,
    tp_status_attention: raw.tp_status_attention,
    dealer_no_status: raw.dealer_no_status,
    avg_distribution: roundAvgDistribution(raw._distribution_sum, raw._distribution_weight),
  };
}

/** Суммирует счётчики; avg_distribution — взвешенное по числу дилеров в каждом блоке. */
export function aggregateKpiScopeTotals(parts: readonly KpiScopeTotalsInternal[]): KpiScopeTotalsFields {
  const acc: KpiScopeTotalsInternal = { ...EMPTY_KPI_SCOPE_TOTALS };
  for (const p of parts) {
    acc.tp_status_active += p.tp_status_active;
    acc.tp_status_potential += p.tp_status_potential;
    acc.tp_status_attention += p.tp_status_attention;
    acc.dealer_no_status += p.dealer_no_status;
    acc._distribution_sum += p._distribution_sum;
    acc._distribution_weight += p._distribution_weight;
  }
  return finalizeKpiScopeTotals(acc);
}

export type DealerKpiRow = {
  status: string | null;
  has_problem: boolean;
  distribution: number | null;
};

/**
 * Чистая агрегация по строкам дилеров (для тестов и SQL-маппинга).
 * Статусы из БД (`dealers.status`); has_problem = nonTarget | is_closed.
 */
export function computeDealerKpiTotalsFromRows(rows: readonly DealerKpiRow[]): KpiScopeTotalsInternal {
  let tp_status_active = 0;
  let tp_status_potential = 0;
  let tp_status_attention = 0;
  let dealer_no_status = 0;
  let distribution_sum = 0;
  let distribution_weight = 0;

  for (const row of rows) {
    const status = (row.status ?? "").trim() || "активный";
    const hasProblem = row.has_problem;
    const dist = typeof row.distribution === "number" && Number.isFinite(row.distribution) ? row.distribution : 0;

    distribution_sum += dist;
    distribution_weight += 1;

    if (status === "требует внимания" || hasProblem) {
      tp_status_attention += 1;
    }
    if (status === "активный") {
      tp_status_active += 1;
    } else if (status === "потенциальный") {
      tp_status_potential += 1;
    } else if (status !== "требует внимания" && !hasProblem) {
      dealer_no_status += 1;
    }
  }

  return {
    tp_status_active,
    tp_status_potential,
    tp_status_attention,
    dealer_no_status,
    avg_distribution: roundAvgDistribution(distribution_sum, distribution_weight),
    _distribution_sum: distribution_sum,
    _distribution_weight: distribution_weight,
  };
}
