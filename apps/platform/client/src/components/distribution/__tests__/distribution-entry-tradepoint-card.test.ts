/**
 * @vitest-environment jsdom
 * Запуск: npm run test:distribution-entry-tradepoint-card
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DistributionEntryTradePointCard } from "../distribution-entry-tradepoint-card";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { DistributionEntryTradePointRow } from "@/lib/distribution-entry-tradepoint-view-model";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

const dealer = { id: "d1", name: "Клиент", tradePoints: [] } as DealerRow;
const point = { id: "tp-1", name: "ТТ", city: "Город", address: "", status: "активный" } as DealerTradePoint;
const profile = { personaUserId: "u1" } as ReleaseDemoProfile;

function renderRow(row: DistributionEntryTradePointRow): string {
  return renderToStaticMarkup(
    createElement(DistributionEntryTradePointCard, {
      row,
      dealer,
      point,
      profile,
      view: "list",
      onSelect: () => {},
    }),
  );
}

const baseRow: DistributionEntryTradePointRow = {
  dealerId: "d1",
  tradePointId: "tp-1",
  tradePointName: "ТТ",
  clientName: "Клиент",
  city: "Город",
  clientCategory: "top350",
  managerName: null,
  templateModelsCount: 0,
  filledCount: 0,
  coveragePct: 0,
  lastUpdatedAt: "2026-06-16T10:00:00.000Z",
  installedOursTotal: 30,
  installedOursBySegment: { vh: 9, mk: 11, hardware: 10 },
};

describe("DistributionEntryTradePointCard", () => {
  it("shows installed count when no matrix", () => {
    const html = renderRow(baseRow);
    expect(html).toContain("На витрине: 30");
    expect(html).not.toContain("нет матрицы");
  });

  it("shows no matrix badge when nothing installed", () => {
    const html = renderRow({
      ...baseRow,
      installedOursTotal: 0,
      installedOursBySegment: { vh: 0, mk: 0, hardware: 0 },
    });
    expect(html).toContain("нет матрицы");
    expect(html).not.toContain("На витрине:");
  });
});
