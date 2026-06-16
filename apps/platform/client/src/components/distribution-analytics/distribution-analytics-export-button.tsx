import type { ReactElement } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyticsTradePointRow } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import { formatDistributionPercent } from "@/lib/distribution-analytics/distribution-analytics-math";

type Props = {
  rows: AnalyticsTradePointRow[];
};

export function DistributionAnalyticsExportButton({ rows }: Props): ReactElement {
  const exportCsv = () => {
    const header = [
      "tradePointId",
      "dealerId",
      "tradePointCode",
      "tradePointName",
      "city",
      "dealerName",
      "clientCategory",
      "manager",
      "regionalManager",
      "entrancePercent",
      "entranceDetail",
      "interiorPercent",
      "interiorDetail",
      "hardwarePercent",
      "hardwareDetail",
      "averagePercent",
    ];
    const lines = rows.map(({ row, metrics }) => {
      const ent = metrics.byType.entrance;
      const int = metrics.byType.interior;
      const hw = metrics.byType.hardware;
      return [
        row.tradePointId,
        row.dealerId,
        row.tradePointDisplayCode,
        row.tradePointName,
        row.city,
        row.dealerName,
        row.clientCategoryLabel,
        row.manager,
        row.regionalManager,
        formatDistributionPercent(ent.percent),
        `${ent.tandoorOnShelf}/${ent.capacity ?? "—"}`,
        formatDistributionPercent(int.percent),
        `${int.tandoorOnShelf}/${int.capacity ?? "—"}`,
        formatDistributionPercent(hw.percent),
        `${hw.tandoorOnShelf}/${hw.capacity ?? "—"}`,
        formatDistributionPercent(metrics.averagePercent),
      ]
        .map(csvEscape)
        .join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const day = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `distribution-trade-points-${day}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportCsv} data-testid="button-distribution-analytics-export">
      <Download className="h-3.5 w-3.5" />
      Экспорт CSV
    </Button>
  );
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
