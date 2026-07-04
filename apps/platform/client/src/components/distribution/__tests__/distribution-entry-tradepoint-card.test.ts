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
import type { DistributionEntryTradePointView } from "@/lib/distribution-entry-tradepoint-view";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

const dealer = { id: "d1", name: "Клиент", tradePoints: [] } as DealerRow;
const point = {
  id: "tp-1",
  name: "ТТ",
  city: "Казань",
  address: "ул. Баумана, 12",
  status: "активный",
} as DealerTradePoint;
const profile = { personaUserId: "u1" } as ReleaseDemoProfile;

const baseRow: DistributionEntryTradePointRow = {
  dealerId: "d1",
  tradePointId: "tp-1",
  tradePointName: "ТТ Центральная",
  clientName: "Клиент ООО",
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

function renderRow(view: DistributionEntryTradePointView, row = baseRow, tradePoint = point): string {
  return renderToStaticMarkup(
    createElement(DistributionEntryTradePointCard, {
      row,
      dealer,
      point: tradePoint,
      profile,
      view,
      onSelect: () => {},
    }),
  );
}

function classListForTestId(html: string, testId: string): string {
  const re = new RegExp(`data-testid="${testId}"[^>]*class="([^"]*)"`);
  const match = html.match(re);
  return match?.[1] ?? "";
}

describe("DistributionEntryTradePointCard", () => {
  it("shows installed count when no matrix", () => {
    const html = renderRow("compact");
    expect(html).toContain("На витрине: 30");
    expect(html).not.toContain("нет матрицы");
  });

  it("shows no matrix badge when nothing installed", () => {
    const html = renderRow("compact", {
      ...baseRow,
      installedOursTotal: 0,
      installedOursBySegment: { vh: 0, mk: 0, hardware: 0 },
    });
    expect(html).toContain("нет матрицы");
    expect(html).not.toContain("На витрине:");
  });

  it("compact mode avoids truncate on trade point name and client", () => {
    const html = renderRow("compact");
    expect(classListForTestId(html, "distribution-entry-tradepoint-name-tp-1")).not.toContain("truncate");
    expect(classListForTestId(html, "distribution-entry-tradepoint-client-tp-1")).not.toContain("truncate");
    expect(html).toContain("Клиент ООО");
    expect(html).toContain("ТТ Центральная");
  });

  it("detailed mode renders city and address from point", () => {
    const html = renderRow("detailed");
    expect(html).toContain("Казань, ул. Баумана, 12");
    expect(html).toContain("Клиент ООО");
    expect(html).toContain("ТТ Центральная");
    expect(classListForTestId(html, "distribution-entry-tradepoint-name-tp-1")).not.toContain("truncate");
    expect(classListForTestId(html, "distribution-entry-tradepoint-client-tp-1")).not.toContain("truncate");
  });
});
