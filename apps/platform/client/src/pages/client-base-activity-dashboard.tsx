/**
 * Реальная статистика актуализации клиентской базы из client_base_actualization_state.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  fetchActualizationStatsOverview,
  type ActualizationStatsOverview,
} from "@/lib/actualization-stats-api";

type PeriodPreset = "7d" | "30d" | "90d" | "custom";

function periodRange(preset: PeriodPreset): { fromIso: string; toIso: string } {
  const to = new Date();
  const days = preset === "30d" ? 30 : preset === "90d" ? 90 : 7;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function statusBadge(status: "active" | "weak" | "none") {
  if (status === "active") return <Badge className="bg-emerald-600 text-white">Активно</Badge>;
  if (status === "weak") return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Слабо</Badge>;
  return <Badge variant="outline" className="border-border bg-muted text-muted-foreground">Нет активности</Badge>;
}

function KpiCard({ title, value, description }: { title: string; value: number; description?: string }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-foreground tabular-nums">{value}</div>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

function QualityLine({ label, value, total }: { label: string; value: number; total: number }) {
  const p = pct(value, total);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">{p}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function ProblemList({
  title,
  items,
  render,
}: {
  title: string;
  items: unknown[];
  render: (item: any) => string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{items.length} записей</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет проблем.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
            {items.slice(0, 10).map((item, i) => (
              <li key={i} className="rounded border border-border bg-muted/20 p-2 text-muted-foreground">
                {render(item)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClientBaseActivityDashboardPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("7d");
  const [teamId, setTeamId] = useState("__all__");
  const [managerUserId, setManagerUserId] = useState("__all__");
  const range = useMemo(() => periodRange(periodPreset), [periodPreset]);

  const query = useQuery({
    queryKey: ["actualization-stats-overview", range.fromIso, range.toIso, teamId, managerUserId],
    queryFn: () =>
      fetchActualizationStatsOverview({
        fromIso: range.fromIso,
        toIso: range.toIso,
        teamId: teamId === "__all__" ? undefined : teamId,
        managerUserId: managerUserId === "__all__" ? undefined : managerUserId,
      }),
  });

  const data = query.data;
  const teams = useMemo(
    () =>
      (data?.ropRanking ?? [])
        .filter((r) => r.teamId)
        .map((r) => ({ id: r.teamId!, name: r.teamName }))
        .filter((row, index, arr) => arr.findIndex((x) => x.id === row.id) === index),
    [data],
  );
  const managers = useMemo(
    () =>
      (data?.managersFeed ?? [])
        .filter((m) => teamId === "__all__" || m.teamId === teamId)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru")),
    [data, teamId],
  );

  return (
    <div className="min-w-0 space-y-5 px-3 pb-10 sm:px-0" data-testid="page-client-base-activity-dashboard">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Актуализация базы</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Реальная статистика по сохранённым manager state в Postgres: новые клиенты, торговые точки, активность и качество базы.
          </p>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
            <SelectTrigger data-testid="select-activity-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 дней</SelectItem>
              <SelectItem value="30d">30 дней</SelectItem>
              <SelectItem value="90d">90 дней</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={teamId}
            onValueChange={(v) => {
              setTeamId(v);
              setManagerUserId("__all__");
            }}
          >
            <SelectTrigger data-testid="select-activity-rop"><SelectValue placeholder="Все команды" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все команды</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={managerUserId} onValueChange={setManagerUserId}>
            <SelectTrigger data-testid="select-activity-manager"><SelectValue placeholder="Все менеджеры" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все менеджеры</SelectItem>
              {managers.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <Card className="border-border bg-card"><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Загрузка…</CardContent></Card>
      ) : query.isError ? (
        <Card className="border-border bg-card"><CardContent className="p-6 text-sm text-destructive">{(query.error as Error).message}</CardContent></Card>
      ) : data ? (
        <DashboardData data={data} />
      ) : null}
    </div>
  );
}

function DashboardData({ data }: { data: ActualizationStatsOverview }) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Клиентов добавлено" value={data.totals.clientsAdded} />
        <KpiCard title="ТТ добавлено" value={data.totals.tradePointsAdded} />
        <KpiCard title="Активных менеджеров" value={data.totals.activeManagers} />
        <KpiCard title="Без активности" value={data.totals.inactiveManagers} />
        <KpiCard title="Всего менеджеров" value={data.totals.totalManagers} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base">Рейтинг по РОП</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.ropRanking.map((r) => (
              <div key={r.teamId ?? "no-rop"} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{r.teamName}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.ropFullName}</p>
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums">{r.totalAdded}</div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Клиенты: {r.clientsAdded} · ТТ: {r.tradePointsAdded} · Активные: {r.activeManagers}/{r.managerCount}</p>
                <p className="text-xs text-muted-foreground">Лидер: {r.leaderFullName ?? "—"} ({r.leaderTotal})</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base">Динамика по дням</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dynamicsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateIso" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="clients" name="Клиенты" fill="hsl(var(--primary))" />
                <Bar dataKey="tradePoints" name="ТТ" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base">Клиенты и ТТ по менеджерам</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.managersChart} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="fullName" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip />
                <Bar dataKey="clients" name="Клиенты" fill="hsl(var(--primary))" />
                <Bar dataKey="tradePoints" name="ТТ" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base">Качество базы</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <QualityLine label="Клиенты с ИНН" value={data.baseQuality.clientsWithInn} total={data.baseQuality.clientsTotal} />
            <QualityLine label="Клиенты с телефоном" value={data.baseQuality.clientsWithPhone} total={data.baseQuality.clientsTotal} />
            <QualityLine label="Клиенты с юрлицом" value={data.baseQuality.clientsWithLegalEntity} total={data.baseQuality.clientsTotal} />
            <QualityLine label="Клиенты с ТТ" value={data.baseQuality.clientsWithTradePoint} total={data.baseQuality.clientsTotal} />
            <QualityLine label="ТТ с адресом" value={data.baseQuality.tradePointsWithAddress} total={data.baseQuality.tradePointsTotal} />
            <QualityLine label="ТТ с фото" value={data.baseQuality.tradePointsWithPhoto} total={data.baseQuality.tradePointsTotal} />
          </CardContent>
        </Card>
      </section>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Score менеджеров</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader><TableRow><TableHead>Менеджер</TableHead><TableHead>Score</TableHead><TableHead>Факторы</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.scoreByManager.slice(0, 20).map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>{m.fullName}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{m.score}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Клиенты {m.factors.clientsAdded} · ТТ {m.factors.tpAdded} · Обновления {m.factors.updates}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <ProblemList title="Менеджеры без активности" items={data.problemZones.inactiveManagers} render={(m) => `${m.fullName} · ${m.teamName}`} />
        <ProblemList title="Клиенты без ИНН" items={data.problemZones.clientsWithoutInn} render={(c) => `${c.fullName} · ${c.managerFullName}`} />
        <ProblemList title="Клиенты без телефона" items={data.problemZones.clientsWithoutPhone} render={(c) => `${c.fullName} · ${c.managerFullName}`} />
        <ProblemList title="Клиенты без юрлица" items={data.problemZones.clientsWithoutLegalEntity} render={(c) => `${c.fullName} · ${c.managerFullName}`} />
        <ProblemList title="ТТ без адреса" items={data.problemZones.tradePointsWithoutAddress} render={(tp) => `${tp.name} · ${tp.managerFullName}`} />
        <ProblemList title="ТТ без фото" items={data.problemZones.tradePointsWithoutPhoto} render={(tp) => `${tp.name} · ${tp.managerFullName}`} />
      </section>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Расширенная сводка</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.managersFeed.map((m) => (
            <div key={m.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/10 p-3" data-testid={`row-manager-${m.userId}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{m.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{m.teamName} · Клиенты всего {m.clientsTotal} · ТТ всего {m.tpTotal}</p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(m.status)}
                <Button asChild size="sm" variant="outline" data-testid={`button-manager-open-${m.userId}`}>
                  <Link href="/admin/users">Открыть</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
