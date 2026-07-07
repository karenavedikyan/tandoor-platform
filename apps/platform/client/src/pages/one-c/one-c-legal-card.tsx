import { memo, type ReactElement } from "react";
import { Link } from "wouter";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCLegalListItem } from "@/lib/one-c-showroom-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OneCLegalDistributionSummary } from "./one-c-legal-distribution-summary";

const badgeOutline = "border-primary/35 bg-card text-foreground";
const badgeSoft = "border-primary/30 bg-primary/10 text-foreground";

type OneCLegalCardProps = {
  row: OneCLegalListItem;
  act: ActualizationState;
};

export const OneCLegalCard = memo(function OneCLegalCard({ row, act }: OneCLegalCardProps): ReactElement {
  const metaParts = [row.city, row.legal_name, row.inn ? `ИНН ${row.inn}` : null].filter(Boolean);

  return (
    <Card
      className="overflow-hidden rounded-xl border border-border border-l-4 border-l-primary bg-card shadow-sm"
      data-testid={`card-one-c-legal-${row.id_1c}`}
    >
      <CardContent className="flex flex-col gap-2 p-2.5">
        <div className="flex justify-between gap-1.5">
          <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-tight">{row.name}</p>
          <Button asChild size="sm" variant="secondary" className="h-7 shrink-0 px-2 text-[11px] font-semibold">
            <Link href={`/1c/legal/${row.id_1c}`} data-testid={`button-open-one-c-legal-${row.id_1c}`}>
              Открыть
            </Link>
          </Button>
        </div>

        {metaParts.length > 0 ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{metaParts.join(" · ")}</p>
        ) : null}

        {row.parent_name ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">Холдинг: {row.parent_name}</p>
        ) : null}

        <div className="flex flex-wrap gap-1">
          {row.client_type ? (
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", badgeOutline)}>
              {row.client_type}
            </Badge>
          ) : null}
          {row.payment_form ? (
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", badgeSoft)}>
              {row.payment_form}
            </Badge>
          ) : null}
          <Badge variant="outline" className={cn("tabular-nums px-1.5 py-0 text-[10px]", badgeOutline)}>
            {row.stores_count} ТТ
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1">
          {row.regional_manager_name ? (
            <Badge variant="outline" className={cn("text-[10px]", badgeOutline)}>
              РМ: {row.regional_manager_name}
            </Badge>
          ) : null}
        </div>

        <OneCLegalDistributionSummary
          legalId={row.id_1c}
          act={act}
          testId={`one-c-legal-tile-dist-${row.id_1c}`}
        />
      </CardContent>
    </Card>
  );
});
