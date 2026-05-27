/**
 * /client-base-activity — «Статистика обновления базы».
 *
 * Компактный drill-down:
 *   1. Шапка + фильтры (период / команда / менеджер) — h-9, grid-cols-3.
 *   2. KPI-сетка 2×5.
 *   3. Accordion РОП-команд — раскрытие → карточки менеджеров со статусом.
 *   4. Sheet «Активность менеджера» — клик по менеджеру → клиенты + ТТ за период.
 *   5. Проблемные зоны — один Card с Tabs (6 табов).
 *   6. Графики «Динамика по дням» + «Качество базы» — компактно ниже.
 *
 * RBAC:
 *   - admin / director — видят всё.
 *   - rop — видит только свою команду (селект команд disabled).
 *   - manager — только себя (селекты команд / менеджеров скрыты), Accordion с одной командой раскрыт по умолчанию.
 *
 * Серверная фильтрация уже встроена в `actualization-stats-overview` (по `me.role`),
 * UI просто реагирует на то, что приходит.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientAvatar } from "@/components/ui/client-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-display-date";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  fetchActualizationStatsOverview,
  fetchManagerActivityDetail,
  type ActualizationStatsOverview,
  type ManagerActivityDetail,
} from "@/lib/actualization-stats-api";

type PeriodPreset = "7d" | "14d" | "30d";

function periodRange(preset: PeriodPreset): { fromIso: string; toIso: string } {
  const to = new Date();
  const days = preset === "30d" ? 30 : preset === "14d" ? 14 : 7;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function statusLabel(status: "active" | "potential" | "attention"): string {
  if (status === "active") return "активный";
  if (status === "potential") return "потенциальный";
  return "внимание";
}

type DetailUserRef = {
  userId: string;
  fullName: string;
  teamName: string;
  ropFullName: string;
};

type ScopeRole = "admin" | "director" | "rop" | "manager" | null;

function resolveScopeRole(rawRole: string | undefined): ScopeRole {
  if (!rawRole) return null;
  if (rawRole === "admin" || rawRole === "director" || rawRole === "rop" || rawRole === "manager") return rawRole;
  return null;
}

const PROBLEM_TAB_KEYS = [
  "inactiveManagers",
  "clientsWithoutInn",
  "clientsWithoutPhone",
  "clientsWithoutLegalEntity",
  "tradePointsWithoutAddress",
  "tradePointsWithoutPhoto",
] as const;
type ProblemTabKey = (typeof PROBLEM_TAB_KEYS)[number];

const PROBLEM_TAB_LABELS: Record<ProblemTabKey, string> = {
  inactiveManagers: "Без активности",
  clientsWithoutInn: "Без ИНН",
  clientsWithoutPhone: "Без тел.",
  clientsWithoutLegalEntity: "Без юр.",
  tradePointsWithoutAddress: "ТТ без адр.",
  tradePointsWithoutPhoto: "ТТ без фото",
};

export default function ClientBaseActivityDashboardPage() {
  const { user } = useAuthUser();
  const scopeRole = resolveScopeRole(user?.role);
  const isManager = scopeRole === "manager";
  const isRop = scopeRole === "rop";
  const showTeamSelect = scopeRole === "admin" || scopeRole === "director";
  const showManagerSelect = scopeRole === "admin" || scopeRole === "director" || scopeRole === "rop";

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("7d");
  const [teamId, setTeamId] = useState("__all__");
  const [managerUserId, setManagerUserId] = useState("__all__");
  const [detailUser, setDetailUser] = useState<DetailUserRef | null>(null);
  const range = useMemo(() => periodRange(periodPreset), [periodPreset]);

  const overviewQ = useQuery({
    queryKey: ["actualization-stats-overview", range.fromIso, range.toIso, teamId, managerUserId],
    queryFn: () =>
      fetchActualizationStatsOverview({
        fromIso: range.fromIso,
        toIso: range.toIso,
        teamId: teamId === "__all__" ? undefined : teamId,
        managerUserId: managerUserId === "__all__" ? undefined : managerUserId,
      }),
  });
  const data = overviewQ.data ?? null;

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

  /**
   * Для manager-роли единственная команда (своя) должна быть автоматически раскрыта,
   * чтобы пользователь сразу видел свою же карточку.
   */
  const [openTeams, setOpenTeams] = useState<string[]>([]);
  useEffect(() => {
    if (!data) return;
    if (isManager && data.ropRanking.length === 1) {
      const only = data.ropRanking[0]!.teamId ?? "__no_rop__";
      setOpenTeams((prev) => (prev.includes(only) ? prev : [only]));
    }
  }, [data, isManager]);

  return (
    <div
      className="min-w-0 space-y-4 px-3 pb-10 sm:px-0"
      data-testid="page-client-base-activity-dashboard"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Статистика обновления базы
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {isManager
            ? "Ваши клиенты и ТТ за выбранный период."
            : isRop
              ? "Ваша команда за выбранный период."
              : "Что добавили и обновили команды за выбранный период."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="section-activity-filters">
        <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
          <SelectTrigger className="h-9" data-testid="select-activity-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 дней</SelectItem>
            <SelectItem value="14d">14 дней</SelectItem>
            <SelectItem value="30d">30 дней</SelectItem>
          </SelectContent>
        </Select>
        {showTeamSelect ? (
          <Select
            value={teamId}
            onValueChange={(v) => {
              setTeamId(v);
              setManagerUserId("__all__");
            }}
          >
            <SelectTrigger className="h-9" data-testid="select-activity-rop">
              <SelectValue placeholder="Все команды" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все команды</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : isRop && data?.ropRanking[0] ? (
          <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-xs text-muted-foreground" data-testid="badge-activity-rop-team">
            Команда: <span className="ml-1 truncate font-medium text-foreground">{data.ropRanking[0].teamName}</span>
          </div>
        ) : null}
        {showManagerSelect ? (
          <Select value={managerUserId} onValueChange={setManagerUserId}>
            <SelectTrigger className="h-9" data-testid="select-activity-manager">
              <SelectValue placeholder="Все менеджеры" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все менеджеры</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {overviewQ.isLoading ? (
        <Card className="rounded-xl border border-border bg-card">
          <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Загрузка статистики…
          </CardContent>
        </Card>
      ) : overviewQ.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{(overviewQ.error as Error).message}</AlertDescription>
        </Alert>
      ) : data ? (
        <DashboardBody
          data={data}
          openTeams={openTeams}
          setOpenTeams={setOpenTeams}
          setDetailUser={setDetailUser}
        />
      ) : null}

      <Sheet open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
        <SheetContent
          side="right"
          className="w-full max-w-xl overflow-y-auto bg-card p-4 text-card-foreground sm:max-w-2xl"
          data-testid="sheet-activity-manager"
        >
          {detailUser ? (
            <ManagerDetailSheet
              detailUser={detailUser}
              range={range}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DashboardBody({
  data,
  openTeams,
  setOpenTeams,
  setDetailUser,
}: {
  data: ActualizationStatsOverview;
  openTeams: string[];
  setOpenTeams: (next: string[]) => void;
  setDetailUser: (next: DetailUserRef | null) => void;
}) {
  const managersByTeam = useMemo(() => {
    const acc = new Map<string, ActualizationStatsOverview["managersFeed"]>();
    for (const m of data.managersFeed) {
      const key = m.teamId ?? "__no_rop__";
      const arr = acc.get(key) ?? [];
      arr.push(m);
      acc.set(key, arr);
    }
    return acc;
  }, [data.managersFeed]);

  const kpis: Array<[string, number]> = [
    ["Клиентов добавлено", data.totals.clientsAdded],
    ["ТТ добавлено", data.totals.tradePointsAdded],
    ["Активных менеджеров", data.totals.activeManagers],
    ["Без активности", data.totals.inactiveManagers],
    ["Всего менеджеров", data.totals.totalManagers],
  ];

  return (
    <>
      <section
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        data-testid="section-activity-kpi"
      >
        {kpis.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-card-foreground"
          >
            <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2" data-testid="section-activity-rop-ranking">
        <h2 className="text-sm font-semibold text-foreground">Рейтинг по РОП</h2>
        {data.ropRanking.length === 0 ? (
          <Card className="rounded-xl border border-border bg-card">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Нет данных за выбранный период.
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" value={openTeams} onValueChange={setOpenTeams} className="space-y-2">
            {data.ropRanking.map((g) => {
              const teamKey = g.teamId ?? "__no_rop__";
              const teamManagers = (managersByTeam.get(teamKey) ?? []).slice().sort(
                (a, b) => (b.updates ?? 0) - (a.updates ?? 0),
              );
              return (
                <AccordionItem
                  key={teamKey}
                  value={teamKey}
                  className="rounded-xl border border-border bg-card text-card-foreground"
                  data-testid={`card-activity-rop-${teamKey}`}
                >
                  <AccordionTrigger
                    className="px-4 py-3 hover:no-underline"
                    data-testid={`button-activity-rop-toggle-${teamKey}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{g.teamName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          добавлено {g.totalAdded} · клиенты {g.clientsAdded} · ТТ {g.tradePointsAdded}
                        </p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-1 sm:flex">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          активн. {g.activeManagers}/{g.managerCount}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0">
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Лидер: {g.leaderFullName ?? "—"} ({g.leaderTotal})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {teamManagers.map((m) => (
                        <button
                          key={m.userId}
                          type="button"
                          className="rounded-xl border border-border bg-card p-3 text-left text-card-foreground transition-colors hover:bg-primary/10"
                          data-testid={`button-activity-manager-open-${m.userId}`}
                          onClick={() =>
                            setDetailUser({
                              userId: m.userId,
                              fullName: m.fullName,
                              teamName: m.teamName,
                              ropFullName: m.ropFullName,
                            })
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{m.fullName}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-5 shrink-0 text-[10px]",
                                m.status === "active"
                                  ? "border-primary/40 text-primary"
                                  : m.status === "weak"
                                    ? "border-amber-500/40 text-amber-500"
                                    : "border-border text-muted-foreground",
                              )}
                            >
                              {m.status === "active" ? "активен" : m.status === "weak" ? "слаб" : "нет акт."}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            клиенты {m.clientsTotal} · ТТ {m.tpTotal} · обновлений {m.updates}
                          </p>
                          {m.lastActivityIso ? (
                            <p className="text-[11px] text-muted-foreground">
                              посл. активность: {formatDisplayDateTime(m.lastActivityIso)}
                            </p>
                          ) : null}
                        </button>
                      ))}
                      {teamManagers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">В команде нет менеджеров.</p>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </section>

      <ProblemZonesSection data={data} onSelectManager={setDetailUser} />

      <section className="grid gap-4 lg:grid-cols-2" data-testid="section-activity-charts">
        <Card className="rounded-xl border border-border bg-card text-card-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Динамика по дням</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {data.dynamicsByDay.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет данных за период.</p>
            ) : (
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
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border bg-card text-card-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Качество базы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QualityLine label="Клиенты с ИНН" value={data.baseQuality.clientsWithInn} total={data.baseQuality.clientsTotal} />
            <QualityLine
              label="Клиенты с телефоном"
              value={data.baseQuality.clientsWithPhone}
              total={data.baseQuality.clientsTotal}
            />
            <QualityLine
              label="Клиенты с юрлицом"
              value={data.baseQuality.clientsWithLegalEntity}
              total={data.baseQuality.clientsTotal}
            />
            <QualityLine
              label="Клиенты с ТТ"
              value={data.baseQuality.clientsWithTradePoint}
              total={data.baseQuality.clientsTotal}
            />
            <QualityLine
              label="ТТ с адресом"
              value={data.baseQuality.tradePointsWithAddress}
              total={data.baseQuality.tradePointsTotal}
            />
            <QualityLine
              label="ТТ с фото"
              value={data.baseQuality.tradePointsWithPhoto}
              total={data.baseQuality.tradePointsTotal}
            />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function QualityLine({ label, value, total }: { label: string; value: number; total: number }) {
  const p = pct(value, total);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">{p}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function ProblemZonesSection({
  data,
  onSelectManager,
}: {
  data: ActualizationStatsOverview;
  onSelectManager: (next: DetailUserRef | null) => void;
}) {
  const pz = data.problemZones;
  const counts: Record<ProblemTabKey, number> = {
    inactiveManagers: pz.inactiveManagers.length,
    clientsWithoutInn: pz.clientsWithoutInn.length,
    clientsWithoutPhone: pz.clientsWithoutPhone.length,
    clientsWithoutLegalEntity: pz.clientsWithoutLegalEntity.length,
    tradePointsWithoutAddress: pz.tradePointsWithoutAddress.length,
    tradePointsWithoutPhoto: pz.tradePointsWithoutPhoto.length,
  };

  return (
    <Card className="rounded-xl border border-border bg-card text-card-foreground" data-testid="section-activity-problem-zones">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Проблемные зоны</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="inactiveManagers">
          <TabsList className="grid w-full grid-cols-3 gap-1 sm:grid-cols-6">
            {PROBLEM_TAB_KEYS.map((k) => (
              <TabsTrigger key={k} value={k} className="text-[11px]" data-testid={`tab-problem-${k}`}>
                {PROBLEM_TAB_LABELS[k]} · {counts[k]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="inactiveManagers" className="space-y-1 pt-2">
            {pz.inactiveManagers.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">Нет менеджеров без активности.</p>
            ) : null}
            {pz.inactiveManagers.slice(0, 10).map((m) => (
              <button
                key={m.userId}
                type="button"
                className="flex w-full items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-left hover:bg-muted/70"
                data-testid={`button-problem-inactive-${m.userId}`}
                onClick={() =>
                  onSelectManager({
                    userId: m.userId,
                    fullName: m.fullName,
                    teamName: m.teamName,
                    ropFullName: "—",
                  })
                }
              >
                <span className="truncate text-xs text-foreground">{m.fullName}</span>
                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                  {m.lastActivityIso ? formatDisplayDateTime(m.lastActivityIso) : "—"}
                </span>
              </button>
            ))}
            {pz.inactiveManagers.length > 10 ? (
              <p className="px-1 text-[11px] text-muted-foreground">
                …и ещё {pz.inactiveManagers.length - 10}
              </p>
            ) : null}
          </TabsContent>

          {(["clientsWithoutInn", "clientsWithoutPhone", "clientsWithoutLegalEntity"] as const).map((key) => (
            <TabsContent key={key} value={key} className="space-y-1 pt-2">
              {pz[key].length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">Нет проблемных клиентов.</p>
              ) : null}
              {pz[key].slice(0, 10).map((c) => (
                <Link
                  key={c.clientId}
                  href={buildHashPath(`/dealers/${encodeURIComponent(c.clientId)}`)}
                  className="flex w-full items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-left hover:bg-muted/70"
                  data-testid={`link-problem-client-${c.clientId}`}
                >
                  <span className="truncate text-xs text-foreground">{c.fullName}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{c.managerFullName}</span>
                </Link>
              ))}
              {pz[key].length > 10 ? (
                <p className="px-1 text-[11px] text-muted-foreground">…и ещё {pz[key].length - 10}</p>
              ) : null}
            </TabsContent>
          ))}

          {(["tradePointsWithoutAddress", "tradePointsWithoutPhoto"] as const).map((key) => (
            <TabsContent key={key} value={key} className="space-y-1 pt-2">
              {pz[key].length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">Нет проблемных торговых точек.</p>
              ) : null}
              {pz[key].slice(0, 10).map((tp) => {
                const dealerId = tp.dealerProfileId ?? tp.clientId ?? null;
                const inner = (
                  <>
                    <span className="truncate text-xs text-foreground">{tp.name}</span>
                    <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{tp.managerFullName}</span>
                  </>
                );
                return dealerId ? (
                  <Link
                    key={tp.id}
                    href={buildHashPath(`/dealers/${encodeURIComponent(dealerId)}`)}
                    className="flex w-full items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-left hover:bg-muted/70"
                    data-testid={`link-problem-tp-${tp.id}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={tp.id}
                    className="flex w-full items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-left"
                    data-testid={`row-problem-tp-${tp.id}`}
                  >
                    {inner}
                  </div>
                );
              })}
              {pz[key].length > 10 ? (
                <p className="px-1 text-[11px] text-muted-foreground">…и ещё {pz[key].length - 10}</p>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ManagerDetailSheet({
  detailUser,
  range,
}: {
  detailUser: DetailUserRef;
  range: { fromIso: string; toIso: string };
}) {
  const q = useQuery({
    queryKey: ["manager-activity-detail", detailUser.userId, range.fromIso, range.toIso],
    queryFn: () =>
      fetchManagerActivityDetail({
        managerUserId: detailUser.userId,
        fromIso: range.fromIso,
        toIso: range.toIso,
      }),
    enabled: !!detailUser.userId,
  });

  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="text-base text-foreground">{detailUser.fullName}</SheetTitle>
        <SheetDescription>
          Команда: {detailUser.teamName ?? "—"} · РОП: {detailUser.ropFullName ?? "—"}
        </SheetDescription>
      </SheetHeader>

      {q.isLoading ? (
        <div className="mt-4 space-y-2" data-testid="sheet-activity-manager-loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : q.isError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{(q.error as Error).message}</AlertDescription>
        </Alert>
      ) : q.data ? (
        <ManagerDetailContent detail={q.data} />
      ) : null}
    </>
  );
}

function ManagerDetailContent({ detail }: { detail: ManagerActivityDetail }) {
  const miniKpis: Array<[string, number]> = [
    ["Клиенты добавл.", detail.stats.clientsAdded],
    ["Клиенты обновл.", detail.stats.clientsUpdated],
    ["ТТ добавл.", detail.stats.tradePointsAdded],
    ["ТТ обновл.", detail.stats.tradePointsUpdated],
  ];
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {miniKpis.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {detail.stats.lastActivityIso ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Последняя активность: {formatDisplayDateTime(detail.stats.lastActivityIso)}
        </p>
      ) : null}

      <Tabs defaultValue="clients" className="mt-3">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="clients" className="text-xs" data-testid="tab-activity-manager-clients">
            Клиенты ({detail.clients.length})
          </TabsTrigger>
          <TabsTrigger value="trade-points" className="text-xs" data-testid="tab-activity-manager-tps">
            ТТ ({detail.tradePoints.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-2 pt-2">
          {detail.clients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">За период нет клиентов</p>
          ) : (
            detail.clients.map((c) => (
              <Card
                key={c.id}
                className="rounded-xl border border-border bg-card text-card-foreground"
                data-testid={`card-activity-manager-client-${c.id}`}
              >
                <CardContent className="flex items-start justify-between gap-2 p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <ClientAvatar size={32} shape="circle" name={c.fullName} seed={c.id} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{c.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.city ?? "—"} · ИНН {c.inn ?? "—"} · ТТ {c.tradePointsCount}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        статус: {statusLabel(c.status)}
                        {c.updatedAtIso ? ` · обн. ${formatDisplayDate(c.updatedAtIso)}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.problems.noInn ? (
                          <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">без ИНН</span>
                        ) : null}
                        {c.problems.noPhone ? (
                          <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">без телеф.</span>
                        ) : null}
                        {c.problems.noLegalEntity ? (
                          <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">без юр.</span>
                        ) : null}
                        {c.problems.noTradePoint ? (
                          <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">без ТТ</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={buildHashPath(`/dealers/${encodeURIComponent(c.dealerProfileId ?? c.id)}`)}>
                      Карточка
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="trade-points" className="space-y-2 pt-2">
          {detail.tradePoints.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">За период нет ТТ</p>
          ) : (
            detail.tradePoints.map((tp) => (
              <Card
                key={tp.id}
                className="rounded-xl border border-border bg-card text-card-foreground"
                data-testid={`card-activity-manager-tp-${tp.id}`}
              >
                <CardContent className="flex items-start justify-between gap-2 p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <ClientAvatar size={24} shape="circle" name={tp.clientFullName} seed={tp.clientId} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {tp.name ?? tp.address ?? "ТТ"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {tp.city ?? "—"}
                        {tp.address ? ` · ${tp.address}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">клиент: {tp.clientFullName}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {!tp.hasPhoto ? (
                          <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">без фото</span>
                        ) : null}
                        {tp.notFilled ? (
                          <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">не заполнено</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link
                      href={buildHashPath(
                        `/dealers/${encodeURIComponent(tp.clientDealerProfileId ?? tp.clientId)}`,
                      )}
                    >
                      Клиент
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
