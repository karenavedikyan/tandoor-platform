import { memo, useState, Fragment, type ReactElement, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import type { DistributionTradePointMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
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
import {
  STORE_COLUMN_LABELS,
  visibleStoreColumns,
  type StoreColumnKey,
  type StoreColumnsState,
} from "./one-c-stores-columns";

type OneCStoresTableProps = {
  items: OneCStoreListItem[];
  columns: StoreColumnsState;
  loading?: boolean;
  emptyLabel?: string;
  testIdPrefix?: string;
  act: ActualizationState;
};

type CellContext = {
  row: OneCStoreListItem;
  act: ActualizationState;
  testIdPrefix: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  dist: { aggregate: DistributionTradePointMetrics | null; loading: boolean };
};

function fillPercent(row: OneCStoreListItem): number {
  return row.distribution_total > 0
    ? Math.round((row.distribution_filled / row.distribution_total) * 100)
    : 0;
}

function renderContactCell(row: OneCStoreListItem): ReactNode {
  const phone = row.legal_phone?.trim();
  const email = row.legal_email?.trim();
  if (!phone && !email) return dash(null);
  return (
    <div className="min-w-0 text-xs leading-tight">
      {phone ? <div className="truncate">{phone}</div> : null}
      {email ? <div className="truncate text-muted-foreground">{email}</div> : null}
    </div>
  );
}

function renderDistributionCell(
  key: "vh" | "mk" | "hw" | "rot",
  ctx: CellContext,
): ReactNode {
  const { row, testIdPrefix, dist } = ctx;
  if (dist.loading) {
    return <BrandDistributionLoader size="sm" />;
  }
  if (!dist.aggregate) return "—";

  if (key === "vh") {
    return <DistributionPercentBadge value={dist.aggregate.byType.entrance.percent} />;
  }
  if (key === "mk") {
    return <DistributionPercentBadge value={dist.aggregate.byType.interior.percent} />;
  }
  if (key === "hw") {
    return <DistributionPercentBadge value={dist.aggregate.byType.hardware.percent} />;
  }
  const legacy = dist.aggregate.totalLegacyOurs;
  return (
    <DistributionRotationBadge count={legacy} percent={dist.aggregate.rotationPotentialPercent} />
  );
}

const CELL_RENDERERS: Record<StoreColumnKey, (ctx: CellContext) => ReactNode> = {
  holding: ({ row, testIdPrefix }) => (
    <span
      className="block truncate"
      title={row.legal_parent_name ?? undefined}
      data-testid={`cell-${testIdPrefix}-${row.id_1c}-parent`}
    >
      {dash(row.legal_parent_name)}
    </span>
  ),
  address: ({ row }) => (
    <Link
      href={`/1c/store/${row.id_1c}`}
      className="block truncate text-primary hover:underline"
      title={row.address ?? undefined}
    >
      {dash(row.address)}
    </Link>
  ),
  legal_name: ({ row }) => (
    <div className="min-w-0">
      <div className="truncate" title={row.legal_name ?? undefined}>
        {dash(row.legal_name)}
      </div>
      {row.legal_inn?.trim() ? (
        <div className="truncate font-mono text-[10px] text-muted-foreground">{row.legal_inn}</div>
      ) : null}
    </div>
  ),
  contact: ({ row, testIdPrefix }) => (
    <div data-testid={`cell-${testIdPrefix}-${row.id_1c}-contact`}>{renderContactCell(row)}</div>
  ),
  fill: ({ row, testIdPrefix }) => {
    const percent = fillPercent(row);
    if (row.distribution_total <= 0) return "—";
    return (
      <div className="flex flex-col gap-0.5" data-testid={`cell-${testIdPrefix}-${row.id_1c}-fill`}>
        <span className="text-[11px] font-medium tabular-nums">
          {row.distribution_filled}/{row.distribution_total}
        </span>
        <div className="h-1 w-full max-w-[3.5rem] overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  },
  vh: (ctx) => renderDistributionCell("vh", ctx),
  mk: (ctx) => renderDistributionCell("mk", ctx),
  hw: (ctx) => renderDistributionCell("hw", ctx),
  rot: (ctx) => renderDistributionCell("rot", ctx),
  client_type: ({ row }) =>
    row.legal_client_type?.trim() ? (
      <Badge variant="outline" className="max-w-full truncate px-1 py-0 text-[10px] font-normal">
        {row.legal_client_type}
      </Badge>
    ) : (
      dash(row.legal_client_type)
    ),
  payment: ({ row }) =>
    row.legal_payment_form?.trim() ? (
      <Badge variant="outline" className="max-w-full truncate px-1 py-0 text-[10px] font-normal">
        {row.legal_payment_form}
      </Badge>
    ) : (
      dash(row.legal_payment_form)
    ),
  city: ({ row }) => <span className="block truncate">{dash(row.legal_city)}</span>,
  rm: ({ row, testIdPrefix }) => (
    <span className="block truncate" data-testid={`cell-${testIdPrefix}-${row.id_1c}-rm`}>
      {dash(row.legal_regional_manager_name)}
    </span>
  ),
  manager: ({ row }) => <span className="block truncate">{dash(row.manager_name)}</span>,
  status: ({ row, testIdPrefix }) =>
    row.status?.trim() ? (
      <Badge variant="outline" className="px-1 py-0 text-[10px]">
        {dash(row.status)}
      </Badge>
    ) : (
      dash(row.status)
    ),
};

const COLUMN_HEAD_CLASS: Partial<Record<StoreColumnKey, string>> = {
  vh: "w-12 px-1 text-center",
  mk: "w-12 px-1 text-center",
  hw: "w-12 px-1 text-center",
  rot: "w-14 px-1 text-center",
  fill: "w-[4.5rem]",
  contact: "w-28",
  manager: "w-24",
  status: "w-20",
};

const COLUMN_CELL_CLASS: Partial<Record<StoreColumnKey, string>> = {
  holding: "max-w-0 truncate",
  address: "max-w-0 truncate",
  legal_name: "max-w-0",
  contact: "max-w-0",
  city: "max-w-0 truncate",
  rm: "max-w-0 truncate",
  manager: "max-w-0 truncate",
  client_type: "max-w-0",
  payment: "max-w-0",
  vh: "w-12 px-1 text-center",
  mk: "w-12 px-1 text-center",
  hw: "w-12 px-1 text-center",
  rot: "w-14 px-1 text-center",
  fill: "w-[4.5rem]",
  status: "w-20",
};

const StoreTableRow = memo(function StoreTableRow({
  row,
  visibleColumns,
  act,
  testIdPrefix,
  isExpanded,
  onToggleExpand,
}: {
  row: OneCStoreListItem;
  visibleColumns: StoreColumnsState;
  act: ActualizationState;
  testIdPrefix: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}): ReactElement {
  const { aggregate, loading } = useTradePointDistributionAggregate([row.id_1c], act);
  const ctx: CellContext = {
    row,
    act,
    testIdPrefix,
    isExpanded,
    onToggleExpand,
    dist: { aggregate, loading },
  };
  const colSpan = visibleColumns.length + 1;

  return (
    <Fragment>
      <TableRow data-testid={`row-${testIdPrefix}-${row.id_1c}`}>
        <TableCell className="w-8 px-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onToggleExpand}
            data-testid={`cell-${testIdPrefix}-${row.id_1c}-expand`}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Свернуть дистрибуцию" : "Развернуть дистрибуцию"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        {visibleColumns.map((col) => (
          <TableCell
            key={col.key}
            className={COLUMN_CELL_CLASS[col.key]}
            data-testid={
              col.key === "client_type"
                ? `cell-${testIdPrefix}-${row.id_1c}-client-type`
                : col.key === "payment"
                  ? `cell-${testIdPrefix}-${row.id_1c}-payment`
                  : col.key === "vh"
                    ? `cell-${testIdPrefix}-${row.id_1c}-vh`
                    : col.key === "mk"
                      ? `cell-${testIdPrefix}-${row.id_1c}-mk`
                      : col.key === "hw"
                        ? `cell-${testIdPrefix}-${row.id_1c}-hw`
                        : col.key === "rot"
                          ? `cell-${testIdPrefix}-${row.id_1c}-rot`
                          : col.key === "status"
                            ? `cell-${testIdPrefix}-${row.id_1c}-status`
                            : undefined
            }
          >
            {CELL_RENDERERS[col.key](ctx)}
          </TableCell>
        ))}
      </TableRow>
      {isExpanded ? (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={colSpan} className="py-3">
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
});

export function OneCStoresTable({
  items,
  columns,
  loading = false,
  emptyLabel = "Ничего не найдено",
  testIdPrefix = "one-c-stores",
  act,
}: OneCStoresTableProps): ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const visibleColumns = visibleStoreColumns(columns);
  const colSpan = visibleColumns.length + 1;

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
      <Table className="w-full table-fixed text-sm" data-testid={`table-${testIdPrefix}`}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 px-1" aria-label="Развернуть" />
            {visibleColumns.map((col) => (
              <TableHead key={col.key} className={COLUMN_HEAD_CLASS[col.key]}>
                {STORE_COLUMN_LABELS[col.key]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <StoreTableRow
              key={row.id_1c}
              row={row}
              visibleColumns={visibleColumns}
              act={act}
              testIdPrefix={testIdPrefix}
              isExpanded={expanded.has(row.id_1c)}
              onToggleExpand={() => toggleExpanded(row.id_1c)}
            />
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
