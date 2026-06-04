/**
 * Запуск: npm run test:distribution-excel-export
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  buildDistributionWorkbook,
  DISTRIBUTION_EXPORT_SHEET_NAMES,
  distributionExportFileName,
} from "../distribution-excel-export";
import { defaultDistributionFilterState } from "../distribution-filters";
import type { DistributionScope } from "../distribution-tree-data";

const dealer: DealerRow = {
  id: "d1",
  name: "Клиент А",
  city: "Краснодар",
  status: "активный",
  clientCategory: "top350",
  tradePoints: [{ id: "tp1", name: "ТТ 1", city: "Краснодар", address: "", status: "активный" }],
} as DealerRow;

const scope: DistributionScope = { kind: "global", dealers: [dealer] };

const wb = buildDistributionWorkbook({
  scope,
  filter: defaultDistributionFilterState(),
  generatedAt: new Date("2026-06-04T15:30:00.000Z"),
});

assert.deepEqual(wb.SheetNames, [...DISTRIBUTION_EXPORT_SHEET_NAMES]);

const summaryAoA = XLSX.utils.sheet_to_json(wb.Sheets["Сводка"]!, { header: 1 }) as unknown[][];
const chdRow = summaryAoA.find((row) => row[0] === "ЧД, %");
const kdRow = summaryAoA.find((row) => row[0] === "КД, %");
assert.ok(chdRow);
assert.ok(kdRow);

const managersHeader = XLSX.utils.sheet_to_json(wb.Sheets["Менеджеры"]!, { header: 1 })[0] as string[];
assert.equal(managersHeader[0], "Наименование");
assert.equal(managersHeader[4], "ЧД, %");

const fileName = distributionExportFileName(scope, new Date("2026-06-04T15:30:00.000Z"));
assert.ok(fileName.endsWith(".xlsx"));
assert.ok(fileName.startsWith("distribution_"));

console.log("distribution-excel-export: ok");
