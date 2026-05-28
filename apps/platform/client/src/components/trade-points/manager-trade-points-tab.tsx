import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TradePointsTpStateMiniBar } from "@/components/trade-points/trade-points-tp-state-mini-bar";
import { buildHashPath } from "@/lib/hash-route-utils";
import { cn } from "@/lib/utils";
import {
  buildTpStateSegments,
  tpStateSegmentBarClass,
  type TpStateSegmentKey,
} from "@/lib/trade-points-overview-view-model";
import {
  fetchTradePointsManagerDetail,
  type TradePointsManagerDetailTp,
} from "@/lib/trade-points-overview-api";
import type { TradePointDetailFilter } from "@/lib/trade-points-management-view-model";

const FILTER_LABELS: Record<TradePointDetailFilter, string> = {
  all: "Все",
  no_photo: "Без фото",
  unfilled: "Не заполнены",
  with_photo: "С фото",
};

const TP_STATUS_CLASS: Record<"active" | "potential" | "attention", string> = {
  active: "text-emerald-700 dark:text-emerald-300",
  potential: "text-sky-700 dark:text-sky-300",
  attention: "text-amber-700 dark:text-amber-300",
};

const TP_STATUS_LABEL: Record<"active" | "potential" | "attention", string> = {
  active: "активный",
  potential: "потенциальный",
  attention: "внимание",
};

function tpMatchesFilter(tp: TradePointsManagerDetailTp, filter: TradePointDetailFilter): boolean {
  if (filter === "all") return true;
  if (filter === "no_photo") return !tp.hasPhoto;
  if (filter === "with_photo") return tp.hasPhoto;
  if (filter === "unfilled") return tp.notFilled;
  return true;
}

function tpStateBadge(tp: TradePointsManagerDetailTp): { label: string; className: string } {
  if (tp.notFilled) {
    return {
      label: "Не заполнена",
      className:
        "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-100",
    };
  }
  if (!tp.hasPhoto) {
    return {
      label: "Без фото",
      className:
        "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-100",
    };
  }
  return {
    label: "С фото",
    className:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-100",
  };
}

type Props = {
  managerUserId: string;
};

export function ManagerTradePointsTab({ managerUserId }: Props) {
  const [tpFilter, setTpFilter] = useState<TradePointDetailFilter>("all");
  const [search, setSearch] = useState("");

  const detailQ = useQuery({
    queryKey: ["trade-points-manager-detail", managerUserId],
    queryFn: () => fetchTradePointsManagerDetail(managerUserId),
    enabled: Boolean(managerUserId),
  });

  const data = detailQ.data;

  const segments = useMemo(() => {
    if (!data) return [];
    const withPhoto = data.tradePoints.filter((t) => t.hasPhoto && !t.notFilled).length;
    const noPhoto = data.tradePoints.filter((t) => !t.hasPhoto).length;
    const unfilled = data.tradePoints.filter((t) => t.notFilled).length;
    return buildTpStateSegments(withPhoto, noPhoto, unfilled);
  }, [data]);

  const cityCount = useMemo(() => {
    if (!data) return 0;
    const set = new Set(data.tradePoints.map((t) => t.city?.trim()).filter(Boolean));
    return set.size;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.tradePoints.filter((tp) => {
      if (!tpMatchesFilter(tp, tpFilter)) return false;
      if (!q) return true;
      const hay = [tp.name, tp.address, tp.city, tp.clientFullName].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [data, tpFilter, search]);

  if (detailQ.isLoading) {
    return (
      <div className="space-y-3" data-testid="tab-manager-trade-points-loading">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-8 rounded-lg" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (detailQ.isError || !data) {
    return (
      <Alert variant="destructive" data-testid="alert-manager-trade-points-error">
        <AlertDescription>
          {detailQ.error instanceof Error ? detailQ.error.message : "Не удалось загрузить торговые точки менеджера."}
        </AlertDescription>
      </Alert>
    );
  }

  const total = data.tradePoints.length;
  const withoutPhoto = data.tradePoints.filter((t) => !t.hasPhoto).length;
  const notFilled = data.tradePoints.filter((t) => t.notFilled).length;

  return (
    <div className="space-y-4" data-testid="tab-manager-trade-points-content">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Всего точек", total],
            ["Без фото", withoutPhoto],
            ["Не заполнены", notFilled],
            ["Городов", cityCount],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {segments.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Состояние точек</p>
          <TradePointsTpStateMiniBar segments={segments} total={total} data-testid="manager-tp-state-bar-large" />
          <ul className="space-y-1" aria-hidden>
            {segments.map((seg) => (
              <li key={seg.key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-24 shrink-0">{seg.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className={cn("rounded-full", tpStateSegmentBarClass(seg.key))} style={{ width: "100%" }} />
                  </span>
                </span>
                <span className="tabular-nums text-foreground">{seg.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(FILTER_LABELS) as TradePointDetailFilter[]).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={tpFilter === f ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs"
            data-testid={`chip-manager-tp-filter-${f}`}
            onClick={() => setTpFilter(f)}
          >
            {FILTER_LABELS[f]}
          </Button>
        ))}
      </div>

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию, адресу, городу, клиенту…"
        className="h-9"
        data-testid="input-manager-tp-search"
        aria-label="Поиск торговых точек"
      />

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">У менеджера нет торговых точек.</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Нет точек по выбранному фильтру.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="hidden sm:table-cell">Адрес</TableHead>
                <TableHead className="hidden md:table-cell">Город</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Состояние</TableHead>
                <TableHead className="w-[88px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tp) => {
                const badge = tpStateBadge(tp);
                const dealerId = tp.dealerProfileId ?? tp.clientId;
                return (
                  <TableRow key={tp.id} data-testid={`row-manager-tp-${tp.id}`}>
                    <TableCell className="max-w-[140px] truncate font-medium">{tp.name ?? "—"}</TableCell>
                    <TableCell className="hidden max-w-[160px] truncate text-sm text-muted-foreground sm:table-cell">
                      {tp.address ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{tp.city ?? "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm">
                      <span className="block truncate">{tp.clientFullName}</span>
                      <span className={cn("text-[11px]", TP_STATUS_CLASS[tp.clientStatus])}>
                        {TP_STATUS_LABEL[tp.clientStatus]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium", badge.className)}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
                        <Link
                          href={buildHashPath(
                            `/dealers/${encodeURIComponent(dealerId)}/trade-points/${encodeURIComponent(tp.id)}`,
                          )}
                        >
                          Открыть
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
