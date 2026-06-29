/**
 * Запуск: `npm run test:server-kpi-aggregates` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  aggregateKpiScopeTotals,
  computeDealerKpiTotalsFromRows,
  roundAvgDistribution,
} from "../../../../shared/kpi-scope-totals.js";
import { kpiCountsFromDbScope, type MyScopeFromDB } from "../../hooks/use-my-scope-from-db.js";
import { sidebarCountsFromDbScope } from "../../hooks/use-my-scope-from-db.js";

// 1) Статусная разбивка по дилерам
{
  const kpi = computeDealerKpiTotalsFromRows([
    { status: "активный", has_problem: false, distribution: 40 },
    { status: "потенциальный", has_problem: false, distribution: 60 },
    { status: "активный", has_problem: true, distribution: 20 },
    { status: "приостановлен", has_problem: false, distribution: 10 },
  ]);
  assert.equal(kpi.tp_status_active, 2);
  assert.equal(kpi.tp_status_potential, 1);
  assert.equal(kpi.tp_status_attention, 1);
  assert.equal(kpi.dealer_no_status, 1);
  assert.equal(kpi.avg_distribution, 33);
}

// 2) Инвариант no_status: не пересекающиеся «прочие» без attention
{
  const kpi = computeDealerKpiTotalsFromRows([
    { status: "активный", has_problem: false, distribution: 0 },
    { status: "потенциальный", has_problem: false, distribution: 0 },
    { status: "требует внимания", has_problem: false, distribution: 0 },
    { status: "приостановлен", has_problem: false, distribution: 0 },
  ]);
  const classified = kpi.tp_status_active + kpi.tp_status_potential + kpi.tp_status_attention + kpi.dealer_no_status;
  assert.equal(classified, 4);
}

// 3) Взвешенное avg_distribution при team→org (не среднее средних)
{
  const m1Kpi = computeDealerKpiTotalsFromRows([{ status: "активный", has_problem: false, distribution: 20 }]);
  const m2Kpi = computeDealerKpiTotalsFromRows([
    { status: "активный", has_problem: false, distribution: 80 },
    { status: "активный", has_problem: false, distribution: 80 },
  ]);
  const teamKpi = aggregateKpiScopeTotals([m1Kpi, m2Kpi]);
  assert.equal(teamKpi.avg_distribution, 60);
  assert.notEqual(teamKpi.avg_distribution, roundAvgDistribution(20 + 80, 2));
}

// 4) aggregateKpiScopeTotals взвешенное среднее
{
  const a = computeDealerKpiTotalsFromRows([
    { status: "активный", has_problem: false, distribution: 10 },
    { status: "активный", has_problem: false, distribution: 30 },
  ]);
  const b = computeDealerKpiTotalsFromRows([{ status: "активный", has_problem: false, distribution: 90 }]);
  const merged = aggregateKpiScopeTotals([a, b]);
  assert.equal(merged.avg_distribution, 43);
}

// 5) kpi.total == sidebar.dealers для одного scope
{
  const scope = {
    ready: true,
    totals: {
      active_dealers: 12,
      active_trade_points: 20,
      trashed_dealers: 1,
      trashed_trade_points: 2,
      tp_status_active: 8,
      tp_status_potential: 2,
      tp_status_attention: 3,
      dealer_no_status: 1,
      avg_distribution: 45,
    },
  } as Pick<MyScopeFromDB, "ready" | "totals">;

  const kpi = kpiCountsFromDbScope(scope as MyScopeFromDB);
  const sidebar = sidebarCountsFromDbScope(scope as MyScopeFromDB);
  assert.ok(kpi);
  assert.equal(kpi!.total, sidebar.dealers);
  assert.equal(kpi!.total, 12);
}

console.log("server-kpi-aggregates: ok");
