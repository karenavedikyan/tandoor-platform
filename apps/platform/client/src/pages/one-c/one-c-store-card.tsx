import { memo, type ReactElement } from "react";
import { Link } from "wouter";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import { DistributionCardHeaderBlock } from "@/components/distribution/distribution-card-header-block";
import { CompactDistributionBadge } from "@/components/distribution/compact-distribution-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OneCCardDensity } from "./use-one-c-list-density";

export const badgeOutline = "border-primary/35 bg-card text-foreground";
export const badgeSoft = "border-primary/30 bg-primary/10 text-foreground";

type OneCStoreCardProps = {
  row: OneCStoreListItem;
  density: OneCCardDensity;
  act: ActualizationState;
};

function buildStoreMetaLine(row: OneCStoreListItem): string {
  const fillLabel =
    row.distribution_total > 0 ? `${row.distribution_filled}/${row.distribution_total}` : null;
  return [row.legal_city, row.status, fillLabel].filter(Boolean).join(" · ");
}

const OneCStoreCardGrid = memo(function OneCStoreCardGrid({
  row,
  act,
}: {
  row: OneCStoreListItem;
  act: ActualizationState;
}): ReactElement {
  const metaLine = buildStoreMetaLine(row);

  return (
    <Card
      className="overflow-hidden rounded-xl border border-border border-l-4 border-l-primary bg-card shadow-sm"
      data-testid={`card-one-c-store-${row.id_1c}`}
      data-density="grid"
    >
      <CardContent className="flex min-h-0 flex-col gap-2 p-2.5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
              {row.address || "—"}
            </p>
          </div>
          <Button asChild size="sm" variant="secondary" className="h-7 shrink-0 px-2 text-[11px] font-semibold">
            <Link href={`/1c/store/${row.id_1c}`} data-testid={`button-open-one-c-store-${row.id_1c}`}>
              Открыть
            </Link>
          </Button>
        </div>

        {metaLine ? (
          <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">{metaLine}</p>
        ) : null}

        <div className="min-w-0 space-y-0.5">
          <p className="line-clamp-1 text-[11px] font-medium text-foreground">{row.legal_name || "—"}</p>
          {row.legal_parent_name ? (
            <p className="line-clamp-1 text-[10px] text-muted-foreground">Холдинг: {row.legal_parent_name}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {row.legal_client_type ? (
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px]", badgeOutline)}
              data-testid={`badge-one-c-client-type-${row.id_1c}`}
            >
              {row.legal_client_type}
            </Badge>
          ) : null}
          {row.legal_payment_form ? (
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px]", badgeSoft)}
              data-testid={`badge-one-c-payment-${row.id_1c}`}
            >
              {row.legal_payment_form}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {row.legal_regional_manager_name ? (
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", badgeOutline)}>
              РМ: {row.legal_regional_manager_name}
            </Badge>
          ) : null}
          {row.manager_name ? (
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", badgeOutline)}>
              Менеджер: {row.manager_name}
            </Badge>
          ) : null}
        </div>

        <CompactDistributionBadge
          externalKeys={[row.id_1c]}
          act={act}
          testId={`one-c-store-tile-distribution-${row.id_1c}`}
        />
      </CardContent>
    </Card>
  );
});

const OneCStoreCardLarge = memo(function OneCStoreCardLarge({
  row,
  act,
}: {
  row: OneCStoreListItem;
  act: ActualizationState;
}): ReactElement {
  const metaLine = buildStoreMetaLine(row);

  return (
    <Card
      className="overflow-hidden rounded-2xl border border-border border-l-4 border-l-primary bg-card shadow-sm"
      data-testid={`card-one-c-store-${row.id_1c}`}
      data-density="large"
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-semibold leading-tight">{row.address || "—"}</h3>
            {metaLine ? <p className="mt-1 text-xs text-muted-foreground">{metaLine}</p> : null}
          </div>
          <Button asChild size="default" variant="secondary" className="shrink-0">
            <Link href={`/1c/store/${row.id_1c}`} data-testid={`button-open-one-c-store-${row.id_1c}`}>
              Открыть
            </Link>
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">{row.legal_name || "—"}</p>
          {row.legal_parent_name ? (
            <p className="text-xs text-muted-foreground">Холдинг: {row.legal_parent_name}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {row.legal_client_type ? (
            <Badge variant="outline" className={cn("text-xs", badgeOutline)}>
              {row.legal_client_type}
            </Badge>
          ) : null}
          {row.legal_payment_form ? (
            <Badge variant="outline" className={cn("text-xs", badgeSoft)}>
              {row.legal_payment_form}
            </Badge>
          ) : null}
          {row.legal_regional_manager_name ? (
            <Badge variant="outline" className={cn("text-xs", badgeOutline)}>
              РМ: {row.legal_regional_manager_name}
            </Badge>
          ) : null}
          {row.manager_name ? (
            <Badge variant="outline" className={cn("text-xs", badgeOutline)}>
              Менеджер: {row.manager_name}
            </Badge>
          ) : null}
        </div>

        <DistributionCardHeaderBlock
          externalKeys={[row.id_1c]}
          act={act}
          testId={`one-c-store-large-dist-${row.id_1c}`}
        />
      </CardContent>
    </Card>
  );
});

const OneCStoreCardList = memo(function OneCStoreCardList({
  row,
  act,
}: {
  row: OneCStoreListItem;
  act: ActualizationState;
}): ReactElement {
  const subtitle = [row.legal_name, row.legal_city, row.legal_parent_name && `Холдинг: ${row.legal_parent_name}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className="overflow-hidden rounded-lg border border-border border-l-4 border-l-primary bg-card"
      data-testid={`card-one-c-store-${row.id_1c}`}
      data-density="list"
    >
      <div className="flex items-center gap-3 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold">{row.address || "—"}</p>
          {subtitle ? (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="hidden shrink-0 flex-wrap gap-1 md:flex">
          {row.legal_client_type ? (
            <Badge variant="outline" className={cn("text-[10px]", badgeOutline)}>
              {row.legal_client_type}
            </Badge>
          ) : null}
          {row.legal_payment_form ? (
            <Badge variant="outline" className={cn("text-[10px]", badgeSoft)}>
              {row.legal_payment_form}
            </Badge>
          ) : null}
        </div>
        <div className="hidden shrink-0 md:block">
          <CompactDistributionBadge
            externalKeys={[row.id_1c]}
            act={act}
            testId={`one-c-store-list-dist-${row.id_1c}`}
          />
        </div>
        <Button asChild size="sm" variant="secondary" className="h-8 shrink-0 px-3 text-xs">
          <Link href={`/1c/store/${row.id_1c}`} data-testid={`button-open-one-c-store-${row.id_1c}`}>
            Открыть
          </Link>
        </Button>
      </div>
    </Card>
  );
});

export const OneCStoreCard = memo(function OneCStoreCard({
  row,
  density,
  act,
}: OneCStoreCardProps): ReactElement {
  if (density === "large") return <OneCStoreCardLarge row={row} act={act} />;
  if (density === "list") return <OneCStoreCardList row={row} act={act} />;
  return <OneCStoreCardGrid row={row} act={act} />;
});
