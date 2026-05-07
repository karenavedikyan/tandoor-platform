import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  filterEquipmentRows,
  filterHardwareRows,
  filterShowcaseProfitabilityRows,
} from "@/lib/analytics-operational-data";

export type DealerAnalyticsSignalKind = "showcase" | "hardware" | "equipment";

export type DealerAnalyticsSignalCard = {
  kind: DealerAnalyticsSignalKind;
  title: string;
  metric: string;
  actionHint: string;
  tradePointId?: string;
};

/**
 * Компактные сигналы по клиенту на основе тех же обезличенных агрегатов, что в аналитике.
 */
export function getDealerAnalyticsSignalCards(row: DealerRow): DealerAnalyticsSignalCard[] {
  const filters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS;
  const dealerId = row.id;
  const out: DealerAnalyticsSignalCard[] = [];

  const profRows = filterShowcaseProfitabilityRows(filters, "all").filter((r) => r.dealerId === dealerId);
  const profMain = profRows.find((r) => !r.tradePointId) ?? profRows[0];
  const profTp = profRows.find((r) => r.tradePointId);

  if (profMain) {
    const needsAttention =
      profMain.attentionZone !== "high_profit" ||
      profMain.profitabilityScore < 55 ||
      profMain.shareShowcasePercent < 25 ||
      profMain.competitorShowcases >= 3;

    if (needsAttention) {
      const parts: string[] = [];
      if (profMain.profitabilityScore < 55 || profMain.attentionZone === "low_profit") {
        parts.push("низкая рентабельность витрины");
      }
      if (profMain.competitorShowcases >= 2 || profMain.attentionZone === "many_competitors") {
        parts.push("витрины конкурентов");
      }
      if (profMain.shareShowcasePercent < 25 || profMain.attentionZone === "no_showcase_sales") {
        parts.push("слабая доля продаж с витрины");
      }
      let actionHint = `Рекомендуется: ${parts.length ? parts.join("; ") : "согласовать план по витрине с региональным менеджером"}.`;
      if (profMain.shareShowcasePercent < 30) {
        actionHint += " Есть модели на витрине с низкой отдачей по продажам.";
      }
      out.push({
        kind: "showcase",
        title: "Витрина и маржа",
        metric: `Рентабельность: ${profMain.profitabilityLabel} · доля с витрины ${profMain.shareShowcasePercent}% · наши / конкуренты ${profMain.ourShowcases} / ${profMain.competitorShowcases}`,
        actionHint,
        tradePointId: profTp?.tradePointId,
      });
    }
  }

  const hw = filterHardwareRows(filters, "all", null, null).find((r) => r.dealerId === dealerId);
  if (hw && (hw.conversionLevel === "low" || hw.conversionLevel === "none")) {
    out.push({
      kind: "hardware",
      title: "Конверсия фурнитуры",
      metric: `Конверсия ${hw.conversionPercent}% · МК ${hw.mkSales} шт., фурнитура ${hw.hardwareSales} шт.`,
      actionHint:
        "Рекомендуется: согласовать выкладку фурнитуры и закрыть возражения по причинам не у нас.",
    });
  }

  const eqRows = filterEquipmentRows(filters, "all", "", "all").filter((r) => r.dealerId === dealerId);
  if (eqRows.length > 0) {
    const sum = eqRows.reduce((s, r) => s + r.amountRub, 0);
    out.push({
      kind: "equipment",
      title: "Оборудование",
      metric: `Отгрузки на сумму ${Math.round(sum / 1000)} тыс. ₽ · позиций ${eqRows.length}`,
      actionHint: "Рекомендуется: проверить актуальность договора и условий сервиса по оборудованию.",
    });
  }

  return out;
}
