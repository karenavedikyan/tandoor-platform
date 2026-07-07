import { memo, type ReactElement } from "react";
import { Link } from "wouter";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCLegalListItem } from "@/lib/one-c-showroom-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OneCLegalDistributionSummary } from "./one-c-legal-distribution-summary";
import { badgeOutline, badgeSoft } from "./one-c-store-card";
import type { OneCCardDensity } from "./use-one-c-list-density";

type OneCLegalCardProps = {
  row: OneCLegalListItem;
  density: OneCCardDensity;
  act: ActualizationState;
};

const OneCLegalCardGrid = memo(function OneCLegalCardGrid({
  row,
  act,
}: {
  row: OneCLegalListItem;
  act: ActualizationState;
}): ReactElement {
  const metaParts = [row.city, row.legal_name, row.inn ? `ИНН ${row.inn}` : null].filter(Boolean);

  return (
    <Card
      className="overflow-hidden rounded-xl border border-border border-l-4 border-l-primary bg-card shadow-sm"
      data-testid={`card-one-c-legal-${row.id_1c}`}
      data-density="grid"
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
          variant="compact"
          testId={`one-c-legal-tile-dist-${row.id_1c}`}
        />
      </CardContent>
    </Card>
  );
});

const OneCLegalCardLarge = memo(function OneCLegalCardLarge({
  row,
  act,
}: {
  row: OneCLegalListItem;
  act: ActualizationState;
}): ReactElement {
  const metaParts = [row.city, row.legal_name, row.inn ? `ИНН ${row.inn}` : null].filter(Boolean);

  return (
    <Card
      className="overflow-hidden rounded-2xl border border-border border-l-4 border-l-primary bg-card shadow-sm"
      data-testid={`card-one-c-legal-${row.id_1c}`}
      data-density="large"
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-semibold leading-tight">{row.name}</h3>
            {metaParts.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
            ) : null}
          </div>
          <Button asChild size="default" variant="secondary" className="shrink-0">
            <Link href={`/1c/legal/${row.id_1c}`} data-testid={`button-open-one-c-legal-${row.id_1c}`}>
              Открыть
            </Link>
          </Button>
        </div>

        {row.parent_name ? (
          <p className="text-xs text-muted-foreground">Холдинг: {row.parent_name}</p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {row.client_type ? (
            <Badge variant="outline" className={cn("text-xs", badgeOutline)}>
              {row.client_type}
            </Badge>
          ) : null}
          {row.payment_form ? (
            <Badge variant="outline" className={cn("text-xs", badgeSoft)}>
              {row.payment_form}
            </Badge>
          ) : null}
          <Badge variant="outline" className={cn("tabular-nums text-xs", badgeOutline)}>
            {row.stores_count} ТТ
          </Badge>
          {row.regional_manager_name ? (
            <Badge variant="outline" className={cn("text-xs", badgeOutline)}>
              РМ: {row.regional_manager_name}
            </Badge>
          ) : null}
        </div>

        <OneCLegalDistributionSummary
          legalId={row.id_1c}
          act={act}
          variant="full"
          testId={`one-c-legal-large-dist-${row.id_1c}`}
        />
      </CardContent>
    </Card>
  );
});

const OneCLegalCardList = memo(function OneCLegalCardList({
  row,
  act,
}: {
  row: OneCLegalListItem;
  act: ActualizationState;
}): ReactElement {
  const subtitle = [row.legal_name, row.city, row.parent_name && `Холдинг: ${row.parent_name}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className="overflow-hidden rounded-lg border border-border border-l-4 border-l-primary bg-card"
      data-testid={`card-one-c-legal-${row.id_1c}`}
      data-density="list"
    >
      <div className="flex items-center gap-3 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold">{row.name}</p>
          {subtitle ? (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="hidden shrink-0 flex-wrap gap-1 md:flex">
          {row.client_type ? (
            <Badge variant="outline" className={cn("text-[10px]", badgeOutline)}>
              {row.client_type}
            </Badge>
          ) : null}
          <Badge variant="outline" className={cn("tabular-nums text-[10px]", badgeOutline)}>
            {row.stores_count} ТТ
          </Badge>
        </div>
        <div className="hidden shrink-0 md:block">
          <OneCLegalDistributionSummary
            legalId={row.id_1c}
            act={act}
            variant="compact"
            testId={`one-c-legal-list-dist-${row.id_1c}`}
          />
        </div>
        <Button asChild size="sm" variant="secondary" className="h-8 shrink-0 px-3 text-xs">
          <Link href={`/1c/legal/${row.id_1c}`} data-testid={`button-open-one-c-legal-${row.id_1c}`}>
            Открыть
          </Link>
        </Button>
      </div>
    </Card>
  );
});

export const OneCLegalCard = memo(function OneCLegalCard({
  row,
  density,
  act,
}: OneCLegalCardProps): ReactElement {
  if (density === "large") return <OneCLegalCardLarge row={row} act={act} />;
  if (density === "list") return <OneCLegalCardList row={row} act={act} />;
  return <OneCLegalCardGrid row={row} act={act} />;
});
