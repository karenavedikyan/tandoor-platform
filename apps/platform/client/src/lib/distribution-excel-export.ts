/**
 * Сборка многолистовой книги Excel для раздела «Дистрибуция».
 */

import * as XLSX from "xlsx";
import {
  aggregateByCity,
  aggregateByDealer,
  aggregateByManager,
  aggregateByModel,
  aggregateByTradePoint,
  computeNetworkSummary,
  listDeficitPositions,
  type DistributionAnalyticsRow,
  type DistributionCoverage,
  type ManagerAggregationOptions,
} from "@/lib/distribution-analytics";
import {
  createFilteredMetricsContextBuilder,
  listActiveDistributionFilterChips,
  type DistributionFilterState,
} from "@/lib/distribution-filters";
import { collectScopeTradePoints, type DistributionScope } from "@/lib/distribution-tree-data";
import type { ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import { statusLabelRu, type ShowcaseMatrixStatusId } from "@/lib/trade-point-showcase-matrix-storage";

export type DistributionExportInput = {
  scope: DistributionScope;
  filter: DistributionFilterState;
  managerOptions?: ManagerAggregationOptions;
  generatedAt?: Date;
};

const BREAKDOWN_HEADERS = [
  "Наименование",
  "План",
  "Факт",
  "Дефицит",
  "ЧД, %",
  "КД, %",
  "Охват данными, %",
  "Всего ТТ",
  "ТТ с данными",
  "Обновлено",
] as const;

const SHEET_SUMMARY = "Сводка";
const SHEET_MANAGERS = "Менеджеры";
const SHEET_CLIENTS = "Клиенты";
const SHEET_TRADE_POINTS = "Торговые точки";
const SHEET_PRODUCTS = "Продукты";
const SHEET_CITIES = "Города";
const SHEET_DEFICIT = "Дефицит";

export const DISTRIBUTION_EXPORT_SHEET_NAMES = [
  SHEET_SUMMARY,
  SHEET_MANAGERS,
  SHEET_CLIENTS,
  SHEET_TRADE_POINTS,
  SHEET_PRODUCTS,
  SHEET_CITIES,
  SHEET_DEFICIT,
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatExportDateTime(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatCoverageDate(iso: string | null): string {
  if (!iso?.trim()) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function pctCell(value: number | null): string | number {
  return value == null ? "" : value;
}

function sortByQuantitativeAsc<T extends { coverage: DistributionCoverage }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const av = a.coverage.quantitativePct ?? 999;
    const bv = b.coverage.quantitativePct ?? 999;
    return av - bv;
  });
}

function coverageToRow(label: string, c: DistributionCoverage): (string | number)[] {
  return [
    label,
    c.planCount,
    c.factCount,
    c.deficitCount,
    pctCell(c.quantitativePct),
    pctCell(c.qualitativePct),
    pctCell(c.dataCoveragePct),
    c.tradePointsTotal,
    c.tradePointsWithData,
    formatCoverageDate(c.lastUpdatedAt),
  ];
}

function breakdownSheetFromRows(rows: DistributionAnalyticsRow<unknown>[]): XLSX.WorkSheet {
  const body = sortByQuantitativeAsc(rows).map((r) => coverageToRow(r.label, r.coverage));
  return XLSX.utils.aoa_to_sheet([BREAKDOWN_HEADERS.slice(), ...body]);
}

function scopeDescription(scope: DistributionScope): string {
  if (scope.kind === "global") {
    return `Глобальный скоуп, клиентов: ${scope.dealers.length}`;
  }
  if (scope.kind === "dealer") {
    return `Клиент: ${scope.dealer.name?.trim() || scope.dealer.id}`;
  }
  return `Торговая точка: ${scope.point.name?.trim() || scope.point.id}`;
}

function filtersDescription(filter: DistributionFilterState): string {
  const chips = listActiveDistributionFilterChips(filter);
  if (chips.length === 0) return "Без дополнительных фильтров";
  return chips.map((c) => c.label).join("; ");
}

function sanitizeFileToken(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 48);
  return cleaned || "scope";
}

function scopeTokenForFile(scope: DistributionScope): string {
  if (scope.kind === "global") return `global_${scope.dealers.length}`;
  if (scope.kind === "dealer") return `dealer_${sanitizeFileToken(scope.dealer.id)}`;
  return `tp_${sanitizeFileToken(scope.point.id)}`;
}

export function distributionExportFileName(scope: DistributionScope, generatedAt?: Date): string {
  const at = generatedAt ?? new Date();
  const stamp = `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}_${pad2(at.getHours())}${pad2(at.getMinutes())}`;
  return `distribution_${scopeTokenForFile(scope)}_${stamp}.xlsx`;
}

function deficitStatusLabel(status: ShowcaseMatrixStatus | null): string {
  if (!status) return statusLabelRu("need_install");
  return statusLabelRu(status as ShowcaseMatrixStatusId);
}

export function buildDistributionWorkbook(input: DistributionExportInput): XLSX.WorkBook {
  const generatedAt = input.generatedAt ?? new Date();
  const refs = collectScopeTradePoints(input.scope);
  const ctxBuilder = createFilteredMetricsContextBuilder(input.filter, generatedAt.getTime());
  const summary = computeNetworkSummary(refs, ctxBuilder);

  const wb = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ["Параметр", "Значение"],
    ["Скоуп", scopeDescription(input.scope)],
    ["Фильтры", filtersDescription(input.filter)],
    ["Дата выгрузки", formatExportDateTime(generatedAt)],
    [],
    ["План (позиций)", summary.planCount],
    ["Факт (позиций)", summary.factCount],
    ["Дефицит (позиций)", summary.deficitCount],
    ["ЧД, %", pctCell(summary.quantitativePct)],
    ["КД, %", pctCell(summary.qualitativePct)],
    ["Охват данными, %", pctCell(summary.dataCoveragePct)],
    ["Всего ТТ", summary.tradePointsTotal],
    ["ТТ с данными", summary.tradePointsWithData],
    ["Обновлено", formatCoverageDate(summary.lastUpdatedAt)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), SHEET_SUMMARY);

  XLSX.utils.book_append_sheet(
    wb,
    breakdownSheetFromRows(aggregateByManager(refs, ctxBuilder, input.managerOptions)),
    SHEET_MANAGERS,
  );
  XLSX.utils.book_append_sheet(wb, breakdownSheetFromRows(aggregateByDealer(refs, ctxBuilder)), SHEET_CLIENTS);
  XLSX.utils.book_append_sheet(
    wb,
    breakdownSheetFromRows(aggregateByTradePoint(refs, ctxBuilder)),
    SHEET_TRADE_POINTS,
  );
  XLSX.utils.book_append_sheet(wb, breakdownSheetFromRows(aggregateByModel(refs, ctxBuilder)), SHEET_PRODUCTS);
  XLSX.utils.book_append_sheet(wb, breakdownSheetFromRows(aggregateByCity(refs, ctxBuilder)), SHEET_CITIES);

  const deficits = listDeficitPositions(refs, ctxBuilder);
  const deficitRows: (string | number)[][] = [
    ["Клиент", "Торговая точка", "Продукт", "Статус"],
    ...deficits.map((d) => [
      d.dealerName,
      d.tradePointName,
      d.productName,
      deficitStatusLabel(d.status),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deficitRows), SHEET_DEFICIT);

  return wb;
}
