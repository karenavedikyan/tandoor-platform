import { memo, useState, Fragment, type ReactElement } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DistributionCardHeaderBlock } from "@/components/distribution/distribution-card-header-block";
import { DistributionPercentBadge } from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";
import { DistributionRotationBadge } from "@/components/distribution-analytics/distribution-rotation-tile";
import { BrandDistributionLoader } from "@/components/distribution/brand-distribution-loader";
import { useTradePointDistributionAggregate } from "@/hooks/use-trade-point-distribution-aggregate";
import { dash } from "./one-c-ui";

const COLUMN_COUNT = 14;

type OneCStoresTableProps = {
  items: OneCStoreListItem[];
  loading?: boolean;
  emptyLabel?: string;
  testIdPrefix?: string;
  act: ActualizationState;
};

const StoreDistributionCells = memo(function StoreDistributionCells({
  storeId,
  act,
  testIdPrefix,
}: {
  storeId: string;
  act: ActualizationState;
  testIdPrefix: string;
}): ReactElement {
  const { aggregate, loading } = useTradePointDistributionAggregate([storeId], act);

  if (loading) {
    return (
      <>
        <TableCell>
          <BrandDistributionLoader size="sm" />
        </TableCell>
        <TableCell>
          <BrandDistributionLoader size="sm" />
        </TableCell>
        <TableCell>
          <BrandDistributionLoader size="sm" />
        </TableCell>
        <TableCell>
          <BrandDistributionLoader size="sm" />
        </TableCell>
      </>
    );
  }

  const legacy = aggregate.totalLegacyOurs;

  return (
    <>
      <TableCell data-testid={`cell-${testIdPrefix}-${storeId}-vh`}>
        <DistributionPercentBadge value={aggregate.byType.entrance.percent} />
      </TableCell>
      <TableCell data-testid={`cell-${testIdPrefix}-${storeId}-mk`}>
        <DistributionPercentBadge value={aggregate.byType.interior.percent} />
      </TableCell>
      <TableCell data-testid={`cell-${testIdPrefix}-${storeId}-hw`}>
        <DistributionPercentBadge value={aggregate.byType.hardware.percent} />
      </TableCell>
      <TableCell data-testid={`cell-${testIdPrefix}-${storeId}-rot`}>
        <DistributionRotationBadge
          count={legacy}
          percent={aggregate.rotationPotentialPercent}
        />
      </TableCell>
    </>
  );
});

export function OneCStoresTable({
  items,
  loading = false,
  emptyLabel = "Ничего не найдено",
  testIdPrefix = "one-c-stores",
  act,
}: OneCStoresTableProps): ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table data-testid={`table-${testIdPrefix}`}>
        <TableHeader>
          <TableRow>
            <TableHead>Адрес</TableHead>
            <TableHead>Холдинг</TableHead>
            <TableHead>Юрлицо</TableHead>
            <TableHead>Тип клиента</TableHead>
            <TableHead>Оплата</TableHead>
            <TableHead>Город</TableHead>
            <TableHead>РМ</TableHead>
            <TableHead>Менеджер (ТТ)</TableHead>
            <TableHead>ВХ</TableHead>
            <TableHead>МК</TableHead>
            <TableHead>Фурн</TableHead>
            <TableHead>Ротация</TableHead>
            <TableHead>Заполненность</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => {
            const fillPercent =
              row.distribution_total > 0
                ? Math.round((row.distribution_filled / row.distribution_total) * 100)
                : 0;
            const isExpanded = expanded.has(row.id_1c);

            return (
              <Fragment key={row.id_1c}>
                <TableRow key={row.id_1c} data-testid={`row-${testIdPrefix}-${row.id_1c}`}>
                  <TableCell>
                    <div className="flex min-w-[10rem] items-start gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => toggleExpanded(row.id_1c)}
                        data-testid={`cell-${testIdPrefix}-${row.id_1c}-expand`}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Свернуть дистрибуцию" : "Развернуть дистрибуцию"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Link href={`/1c/store/${row.id_1c}`} className="text-primary hover:underline">
                        {dash(row.address)}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell
                    className="max-w-[10rem] truncate"
                    title={row.legal_parent_name ?? undefined}
                    data-testid={`cell-${testIdPrefix}-${row.id_1c}-parent`}
                  >
                    {dash(row.legal_parent_name)}
                  </TableCell>
                  <TableCell className="max-w-[12rem]">
                    <div className="truncate">{dash(row.legal_name)}</div>
                    {row.legal_inn?.trim() ? (
                      <div className="truncate font-mono text-[10px] text-muted-foreground">{row.legal_inn}</div>
                    ) : null}
                  </TableCell>
                  <TableCell data-testid={`cell-${testIdPrefix}-${row.id_1c}-client-type`}>
                    {row.legal_client_type?.trim() ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {row.legal_client_type}
                      </Badge>
                    ) : (
                      dash(row.legal_client_type)
                    )}
                  </TableCell>
                  <TableCell data-testid={`cell-${testIdPrefix}-${row.id_1c}-payment`}>
                    {row.legal_payment_form?.trim() ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {row.legal_payment_form}
                      </Badge>
                    ) : (
                      dash(row.legal_payment_form)
                    )}
                  </TableCell>
                  <TableCell>{dash(row.legal_city)}</TableCell>
                  <TableCell data-testid={`cell-${testIdPrefix}-${row.id_1c}-rm`}>
                    {dash(row.legal_regional_manager_name)}
                  </TableCell>
                  <TableCell>{dash(row.manager_name)}</TableCell>
                  <StoreDistributionCells storeId={row.id_1c} act={act} testIdPrefix={testIdPrefix} />
                  <TableCell data-testid={`cell-${testIdPrefix}-${row.id_1c}-fill`}>
                    {row.distribution_total > 0 ? (
                      <div className="flex min-w-[4.5rem] flex-col gap-1">
                        <span className="text-xs font-medium tabular-nums">
                          {row.distribution_filled}/{row.distribution_total}
                        </span>
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell data-testid={`cell-${testIdPrefix}-${row.id_1c}-status`}>
                    {row.status?.trim() ? (
                      <Badge variant="outline">{dash(row.status)}</Badge>
                    ) : (
                      dash(row.status)
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow key={`${row.id_1c}-expanded`} className="bg-muted/30">
                    <TableCell colSpan={COLUMN_COUNT} className="py-3">
                      <DistributionCardHeaderBlock
                        externalKeys={[row.id_1c]}
                        act={act}
                        testId={`row-${row.id_1c}-dist`}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
