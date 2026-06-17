/**
 * /admin/performance — Web Vitals dashboard (Промт 382).
 */

import { useCallback, useMemo, useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Gauge } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { AdminPerformanceSkeleton } from "@/components/skeletons/admin-performance-skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { fetchPerfSummary, perfSummaryToCsv, type PerfSummaryResponse } from "@/lib/perf-api";
import { cn } from "@/lib/utils";

function formatMs(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v)} мс`;
}

function formatCls(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(3);
}

function lcpTone(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  if (v < 2500) return "text-emerald-700";
  if (v <= 4000) return "text-amber-700";
  return "text-red-700";
}

function inpTone(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  if (v < 200) return "text-emerald-700";
  if (v <= 500) return "text-amber-700";
  return "text-red-700";
}

function clsTone(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  if (v < 0.1) return "text-emerald-700";
  if (v <= 0.25) return "text-amber-700";
  return "text-red-700";
}

function ratingBadgeClass(rating: string): string {
  if (rating === "good") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (rating === "needs-improvement") return "border-amber-200 bg-amber-50 text-amber-950";
  if (rating === "poor") return "border-red-200 bg-red-50 text-red-900";
  return "border-border bg-muted text-muted-foreground";
}

function MetricCard({
  title,
  value,
  hint,
  toneClass,
}: {
  title: string;
  value: string;
  hint: string;
  toneClass: string;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminPerformancePage(): ReactElement {
  const { user } = useCurrentUser();
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";
  const canView = user?.role === "admin" || user?.role === "director";
  const [range, setRange] = useState("7d");

  const summaryQ = useQuery({
    queryKey: ["perf-summary", range],
    queryFn: () => fetchPerfSummary(range),
    enabled: canView,
    staleTime: 30_000,
  });

  const exportCsv = useCallback((data: PerfSummaryResponse) => {
    const blob = new Blob([perfSummaryToCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web-vitals-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [range]);

  const trendChartData = useMemo(
    () =>
      (summaryQ.data?.trend ?? []).map((row) => ({
        day: row.day.slice(5),
        all: row.p75_lcp,
        mobile: row.p75_lcp_mobile,
        desktop: row.p75_lcp_desktop,
      })),
    [summaryQ.data?.trend],
  );

  if (!user || !canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-admin-performance">
        <Card>
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Раздел «Производительность» доступен только admin и director.</p>
            <Button asChild variant="outline">
              <a href={homeHref}>На главную</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summaryQ.isLoading && !summaryQ.data) {
    return <AdminPerformanceSkeleton />;
  }

  const data = summaryQ.data;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-24" data-testid="page-admin-performance">
      <BackNav breadcrumbs={breadcrumbsFor("/admin/performance")} fallbackHref="/" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Производительность</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Web Vitals за {range}: LCP, INP, CLS по страницам и ролям (100% событий, без PII).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px]" data-testid="select-perf-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1 день</SelectItem>
              <SelectItem value="7d">7 дней</SelectItem>
              <SelectItem value="30d">30 дней</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            disabled={!data}
            onClick={() => data && exportCsv(data)}
            data-testid="button-perf-export-csv"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Экспорт CSV
          </Button>
        </div>
      </div>

      {summaryQ.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{summaryQ.error instanceof Error ? summaryQ.error.message : "Ошибка загрузки"}</AlertDescription>
        </Alert>
      ) : null}

      {data?.budget_violations?.length ? (
        <div className="space-y-2" data-testid="section-perf-budget-violations">
          {data.budget_violations.map((v) => (
            <Alert key={`${v.pathname}-${v.metric}`} variant="destructive">
              <AlertDescription>{v.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="section-perf-kpis">
        <MetricCard
          title="p75 LCP"
          value={formatMs(data?.overall.p75_lcp)}
          hint="цель < 2500 мс"
          toneClass={lcpTone(data?.overall.p75_lcp)}
        />
        <MetricCard
          title="p75 INP"
          value={formatMs(data?.overall.p75_inp)}
          hint="цель < 200 мс"
          toneClass={inpTone(data?.overall.p75_inp)}
        />
        <MetricCard
          title="p75 CLS"
          value={formatCls(data?.overall.p75_cls)}
          hint="цель < 0.1"
          toneClass={clsTone(data?.overall.p75_cls)}
        />
        <MetricCard
          title="Событий"
          value={data ? data.overall.events.toLocaleString("ru-RU") : "—"}
          hint="все метрики за период"
          toneClass="text-foreground"
        />
      </div>

      <Card data-testid="section-perf-trend">
        <CardHeader>
          <CardTitle className="text-base">Тренд LCP (p75) за период</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {trendChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет данных — события появятся после первых заходов пользователей.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit=" ms" />
                <Tooltip formatter={(v: number) => `${Math.round(v)} мс`} />
                <Legend />
                <Line type="monotone" dataKey="all" name="Всё ЛК" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="mobile" name="Мобиль" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="desktop" name="Десктоп" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-perf-slow-pages">
        <CardHeader>
          <CardTitle className="text-base">Топ-10 медленных страниц (p75 LCP)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Страница</TableHead>
                <TableHead className="text-right">Событий</TableHead>
                <TableHead className="text-right">p75 LCP</TableHead>
                <TableHead className="text-right">p75 INP</TableHead>
                <TableHead>Рейтинг</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.by_pathname ?? []).map((row) => (
                <TableRow key={row.pathname} data-testid={`row-perf-path-${row.pathname.replace(/\//g, "-") || "root"}`}>
                  <TableCell className="font-mono text-xs">{row.pathname}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.events}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", lcpTone(row.p75_lcp))}>{formatMs(row.p75_lcp)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", inpTone(row.p75_inp))}>{formatMs(row.p75_inp)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ratingBadgeClass(row.rating)}>
                      {row.rating}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-testid="section-perf-by-role">
        <CardHeader>
          <CardTitle className="text-base">p75 LCP по роли</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Роль</TableHead>
                <TableHead className="text-right">Событий</TableHead>
                <TableHead className="text-right">p75 LCP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.by_role ?? []).map((row) => (
                <TableRow key={row.role}>
                  <TableCell>{row.role}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.events}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", lcpTone(row.p75_lcp))}>{formatMs(row.p75_lcp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
