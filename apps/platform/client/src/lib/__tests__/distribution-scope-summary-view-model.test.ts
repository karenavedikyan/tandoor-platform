/**
 * Запуск: `npm run test:distribution-scope-summary-view-model` из каталога apps/platform.
 */
import { describe, expect, it } from "vitest";
import type { TradePointListRow } from "../dealer-base-management-view-model.js";
import {
  buildDistributionScopeSummary,
  filterSummaryRows,
} from "../distribution-scope-summary-view-model.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";

const VH_MODEL = "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya";
const VH_MODEL_2 = "tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya";
const VH_MODEL_3 = "tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya";
const MK_MODEL = "tc-mk-baget-12-mokko-pet-dg-2000-800-94";
const MK_MODEL_2 = "tc-mk-grand-13-medzhik-pet-dg-2000-800";
const MK_MODEL_3 = "tc-mk-baget-13-makiato-pet-dg-2000-800-91";

function tp(
  tpId: string,
  dealerId: string,
  dealerName: string,
  name = `ТТ ${tpId}`,
): TradePointListRow {
  return {
    tpId,
    name,
    city: "Москва",
    dealerId,
    dealerName,
    manager: "",
  };
}

function makePlacement(
  tpId: string,
  segment: "vh" | "mk" | "hardware",
  opts: {
    capacity?: number;
    actual?: number;
    updatedAt?: string;
    placementType?: ShowcaseMatrixEntryDto["placementType"];
  } = {},
): ShowcaseMatrixEntryDto {
  return {
    id: `p-${Math.random()}`,
    dealerId: "d",
    tradePointId: tpId,
    targetKind: "placement",
    targetId: "block-1",
    status: "installed",
    comment: null,
    updatedAt: opts.updatedAt ?? "2026-06-01T10:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    placementType: opts.placementType ?? "portal",
    placementSegment: segment,
    placementCapacity: opts.capacity ?? 4,
    placementActual: opts.actual ?? 0,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
  };
}

function makeModel(
  tpId: string,
  targetId: string,
  updatedAt = "2026-06-01T12:00:00.000Z",
): ShowcaseMatrixEntryDto {
  return {
    id: `m-${Math.random()}`,
    dealerId: "d",
    tradePointId: tpId,
    targetKind: "model",
    targetId,
    status: "installed",
    comment: null,
    updatedAt,
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
  };
}

describe("buildDistributionScopeSummary", () => {
  it("пустой скоуп", () => {
    const { rows, totals } = buildDistributionScopeSummary([], new Map());
    expect(rows.length).toBe(0);
    expect(totals.tradePointsInScope).toBe(0);
    expect(totals.averagePercent).toBe(0);
  });

  it("ТТ без entries — три пустых сегмента", () => {
    const tradePoints = [tp("tp-1", "d-1", "Дилер А")];
    const { rows, totals } = buildDistributionScopeSummary(tradePoints, new Map());
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.source === "empty")).toBe(true);
    expect(totals.tradePointsInScope).toBe(1);
    expect(totals.tradePointsWithData).toBe(0);
    expect(totals.tradePointsEmpty).toBe(1);
  });

  it("ТТ с placement-блоками VH", () => {
    const tradePoints = [tp("tp-1", "d-1", "Дилер А")];
    const entries = [makePlacement("tp-1", "vh", { capacity: 8, actual: 5 })];
    const map = new Map([["tp-1", entries]]);
    const { rows, totals } = buildDistributionScopeSummary(tradePoints, map);
    const vh = rows.find((r) => r.segment === "vh");
    expect(vh?.source).toBe("blocks");
    expect(vh?.blockCount).toBe(1);
    expect(vh?.totalCapacity).toBe(8);
    expect(vh?.totalOurs).toBe(5);
    expect(vh?.distributionPercent).toBe(62);
    expect(rows.find((r) => r.segment === "mk")?.source).toBe("empty");
    expect(rows.find((r) => r.segment === "hardware")?.source).toBe("empty");
    expect(totals.tradePointsWithData).toBe(1);
  });

  it("ТТ с installed-моделями без блоков", () => {
    const tradePoints = [tp("tp-1", "d-1", "Дилер А")];
    const entries = [
      makeModel("tp-1", VH_MODEL),
      makeModel("tp-1", VH_MODEL_2),
      makeModel("tp-1", VH_MODEL_3),
      makeModel("tp-1", MK_MODEL),
      makeModel("tp-1", MK_MODEL_2),
      makeModel("tp-1", MK_MODEL_3),
    ];
    const map = new Map([["tp-1", entries]]);
    const { rows } = buildDistributionScopeSummary(tradePoints, map);
    const vh = rows.find((r) => r.segment === "vh");
    const mk = rows.find((r) => r.segment === "mk");
    expect(vh?.source).toBe("models");
    expect(vh?.totalOurs).toBe(3);
    expect(vh?.blockCount).toBe(0);
    expect(vh?.distributionPercent).toBe(0);
    expect(mk?.source).toBe("models");
    expect(mk?.totalOurs).toBe(3);
    expect(mk?.blockCount).toBe(0);
    expect(mk?.distributionPercent).toBe(0);
    expect(rows.find((r) => r.segment === "hardware")?.source).toBe("empty");
  });

  it("lastUpdatedAt — max по placement VH", () => {
    const tradePoints = [tp("tp-1", "d-1", "Дилер А")];
    const entries = [
      makePlacement("tp-1", "vh", { updatedAt: "2026-06-01T10:00:00.000Z" }),
      makePlacement("tp-1", "vh", { updatedAt: "2026-06-03T15:00:00.000Z" }),
    ];
    const map = new Map([["tp-1", entries]]);
    const { rows } = buildDistributionScopeSummary(tradePoints, map);
    expect(rows.find((r) => r.segment === "vh")?.lastUpdatedAt).toBe("2026-06-03T15:00:00.000Z");
  });

  it("averagePercent по VH+MK с данными", () => {
    const tradePoints = [
      tp("tp-1", "d-1", "Дилер А"),
      tp("tp-2", "d-2", "Дилер Б"),
    ];
    const map = new Map<string, ShowcaseMatrixEntryDto[]>([
      [
        "tp-1",
        [
          makePlacement("tp-1", "vh", { capacity: 10, actual: 8 }),
          makePlacement("tp-1", "mk", { capacity: 10, actual: 5 }),
        ],
      ],
      ["tp-2", [makePlacement("tp-2", "mk", { capacity: 10, actual: 2 })]],
    ]);
    const { totals } = buildDistributionScopeSummary(tradePoints, map);
    expect(totals.averagePercent).toBe(50);
  });
});

describe("filterSummaryRows", () => {
  const baseRows = buildDistributionScopeSummary(
    [tp("tp-1", "d-1", "А"), tp("tp-2", "d-2", "Б")],
    new Map([
      ["tp-1", [makePlacement("tp-1", "vh", { capacity: 4, actual: 2 })]],
      ["tp-2", [makeModel("tp-2", MK_MODEL)]],
    ]),
  ).rows;

  it("только пустые", () => {
    const filtered = filterSummaryRows(baseRows, { emptyOnly: true });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => r.source === "empty")).toBe(true);
  });

  it("по дилеру и сегменту vh", () => {
    const filtered = filterSummaryRows(baseRows, {
      dealerIds: ["d-1"],
      segments: ["vh"],
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.dealerId).toBe("d-1");
    expect(filtered[0]?.segment).toBe("vh");
  });
});
