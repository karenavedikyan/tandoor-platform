/**
 * Read-only диагностика расхождения числа ТТ: сайдбар vs /trade-points overview (промт 87).
 */

import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import {
  buildTradePointListForActualization,
  countWorkingTradePointsForSidebar,
} from "@/lib/trade-point-list-for-actualization";
import { cn } from "@/lib/utils";

type TpCountDiagPerUser = {
  userId: string;
  fullName: string;
  teamId: string | null;
  rawStateRecords: number;
  rawTpCountAcrossStates: number;
  uniqueTpAfterCollect: number;
  uniqueClients: number;
  withoutPhoto: number;
  notFilled: number;
};

type TpCountDiagResponse = {
  success: true;
  actorRole: string;
  actorUserId: string;
  allowedUserCount: number;
  filterUserId: string | null;
  perUser: TpCountDiagPerUser[];
  totals: {
    sumRawAcrossStates: number;
    sumUniqueAfterCollect: number;
    globalUniqueTpById: number;
  };
};

function groupClientTpByManagerName(rows: ReturnType<typeof buildTradePointListForActualization>): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const name = r.manager.trim() || "—";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return map;
}

export default function AdminTpCountDiagPage() {
  const { user } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const teamPlane = useClientBaseTeamActualization();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TpCountDiagResponse | null>(null);

  const clientSidebarTotal = useMemo(() => {
    if (!actx.enabled) return null;
    return countWorkingTradePointsForSidebar(profile, teamPlane.mergedState);
  }, [actx.enabled, profile, teamPlane.mergedState]);

  const clientList = useMemo(() => {
    if (!actx.enabled) return [];
    return buildTradePointListForActualization(teamPlane.mergedState, profile, {
      includeArchivedTradePoints: false,
    });
  }, [actx.enabled, profile, teamPlane.mergedState]);

  const clientByManagerName = useMemo(() => groupClientTpByManagerName(clientList), [clientList]);

  const comparisonRows = useMemo(() => {
    if (!data) return [];
    return data.perUser
      .map((u) => {
        const sidebarTp = clientByManagerName.get(u.fullName.trim()) ?? 0;
        const serverTp = u.uniqueTpAfterCollect;
        const diff = sidebarTp - serverTp;
        return { ...u, sidebarTp, serverTp, diff };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.fullName.localeCompare(b.fullName, "ru"));
  }, [data, clientByManagerName]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tp-count-diag", { credentials: "same-origin" });
      const json = (await res.json()) as TpCountDiagResponse & { message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Не удалось загрузить диагностику",
        description: e instanceof Error ? e.message : "Ошибка запроса",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  if (!user || !["admin", "director", "rop"].includes(user.role)) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Недостаточно прав.{" "}
        <Link href={defaultHomePathForUserRole(user?.role ?? "manager")} className="text-primary underline">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" data-testid="page-admin-tp-count-diag">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Диагностика числа ТТ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сравнение клиентского счётчика (сайдбар) и серверного overview без изменения бизнес-логики.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Загрузка отчёта</CardTitle>
          <CardDescription>GET /api/admin/tp-count-diag · read-only</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void load()} disabled={loading} data-testid="button-tp-count-diag-load">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Загрузить
          </Button>
          {clientSidebarTotal != null ? (
            <p className="text-sm text-muted-foreground">
              Клиент (сайдбар):{" "}
              <span className="font-semibold tabular-nums text-foreground">{clientSidebarTotal}</span> · список:{" "}
              <span className="font-semibold tabular-nums text-foreground">{clientList.length}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Sidebar total", clientSidebarTotal ?? "—"],
                ["Server sum (per-user unique)", data.totals.sumUniqueAfterCollect],
                ["Server global unique by tp.id", data.totals.globalUniqueTpById],
                ["Server raw sum (no dedup)", data.totals.sumRawAcrossStates],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">По менеджерам</CardTitle>
              <CardDescription>
                Sidebar TP — группировка клиентского списка по полю manager (имя); сортировка по |разница|
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>userId</TableHead>
                    <TableHead>Менеджер</TableHead>
                    <TableHead className="text-right">Sidebar TP</TableHead>
                    <TableHead className="text-right">Server TP</TableHead>
                    <TableHead className="text-right">Raw states</TableHead>
                    <TableHead className="text-right">Разница</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonRows.map((row) => (
                    <TableRow key={row.userId} data-testid={`row-tp-diag-${row.userId}`}>
                      <TableCell className="max-w-[120px] truncate font-mono text-[11px]">{row.userId}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{row.fullName}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.sidebarTp}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.serverTp}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.rawTpCountAcrossStates}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          row.diff !== 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                        )}
                      >
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Актор: {data.actorRole} · пользователей в scope: {data.allowedUserCount}
            {data.filterUserId ? ` · фильтр userId=${data.filterUserId}` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
