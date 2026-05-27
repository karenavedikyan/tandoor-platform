/**
 * <ActualizationRace/> — временный соревновательный блок на главной (Промт 47 Part D).
 *
 * Источники данных (используем существующие endpoints, без новых API):
 *   - GET /api/admin/actualization-stats-overview (Промт 44)
 *     → overview.totals: activeManagers / totalManagers / clientsAdded / tradePointsAdded
 *     → overview.ropRanking[]: команды
 *     → overview.managersFeed[]: менеджеры с {clientsTotal, tpTotal, updates, status}
 *
 * Метрика гонки = `activeManagers / totalManagers` (% менеджеров с активностью за период).
 *
 * 🏅 emoji в карточках мест — контролируемое исключение от no-emoji-правила
 * платформы: гонка — намеренно «соревновательный» блок, медали оправданы.
 *
 * Авто-скрытие (D4):
 *   - pct === 100 → return null;
 *   - admin/director + pct >= 95 → compact one-liner с раскрытием.
 *
 * Виды по ролям:
 *   - admin / director — вся компания + top-3 РОПа + остальные.
 *   - team_lead — своя команда + top-3 менеджеров команды + остальные.
 *   - sales_manager — собственный прогресс + сравнение с соседом + streak.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, Flame, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchActualizationStatsOverview, type ActualizationStatsOverview } from "@/lib/actualization-stats-api";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { computeStreak } from "@/lib/actualization-streak";
import { cn } from "@/lib/utils";
import { buildHashPath } from "@/lib/hash-route-utils";

type RaceRole = "admin" | "director" | "rop" | "manager";

function resolveRaceRole(rawRole: string | undefined): RaceRole | null {
  if (rawRole === "admin") return "admin";
  if (rawRole === "director") return "director";
  if (rawRole === "rop") return "rop";
  if (rawRole === "manager") return "manager";
  return null;
}

const MEDAL = ["🥇", "🥈", "🥉"] as const;

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${safe}%` }}
        data-testid="actualization-race-progress-bar"
      />
    </div>
  );
}

function MiniTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-3 py-2.5",
        accent && "border-primary/40",
      )}
    >
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">{value}</p>
    </div>
  );
}

function MedalCard({
  rank,
  title,
  pct,
  subtitle,
  href,
}: {
  rank: 0 | 1 | 2;
  title: string;
  pct: number;
  subtitle?: string;
  href?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  const inner = (
    <Card className="rounded-lg border bg-card transition-shadow hover:shadow-sm" data-testid={`actualization-race-medal-${rank}`}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            {MEDAL[rank]}
          </span>
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</p>
        </div>
        <ProgressBar pct={safe} />
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{subtitle ?? ""}</span>
          <span className="font-semibold tabular-nums text-foreground">{safe}%</span>
        </div>
      </CardContent>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {inner}
      </Link>
    );
  }
  return inner;
}

function teamPct(team: ActualizationStatsOverview["ropRanking"][number]): number {
  if (team.managerCount <= 0) return 0;
  return (team.activeManagers / team.managerCount) * 100;
}

function managerPct(m: ActualizationStatsOverview["managersFeed"][number]): number {
  // Менеджер: «активный» = status==='active' → 100%, weak → 50%, none → 0%. Простой и понятный индикатор.
  if (m.status === "active") return 100;
  if (m.status === "weak") return 50;
  return 0;
}

function periodIsoRange7d(): { fromIso: string; toIso: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export function ActualizationRace() {
  const { user } = useAuthUser();
  const actx = useClientBaseActualization();
  const role = resolveRaceRole(user?.role);
  const [expanded, setExpanded] = useState(false);

  const overviewQ = useQuery({
    queryKey: ["actualization-race", "overview-30d"],
    queryFn: () =>
      fetchActualizationStatsOverview({
        fromIso: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        toIso: new Date().toISOString(),
      }),
    // Hold network while user has no role yet.
    enabled: Boolean(role),
  });

  if (!role) return null;
  if (overviewQ.isLoading) {
    return (
      <Card className="rounded-lg border bg-card" data-testid="actualization-race-loading">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (overviewQ.isError || !overviewQ.data) return null;
  const overview = overviewQ.data;

  const totals = overview.totals;
  const totalPct = totals.totalManagers > 0 ? (totals.activeManagers / totals.totalManagers) * 100 : 0;
  const safeTotalPct = Math.round(totalPct);

  // D4: глобальный 100% → виджет исчезает.
  if (safeTotalPct >= 100 && totals.totalManagers > 0) return null;

  // ===== DIRECTOR / ADMIN =====
  if (role === "admin" || role === "director") {
    const ranked = [...overview.ropRanking].sort((a, b) => teamPct(b) - teamPct(a));
    const top3 = ranked.slice(0, 3);
    const rest = ranked.slice(3);

    // D4: 95-99% → compact one-liner (expandable).
    if (safeTotalPct >= 95 && !expanded) {
      return (
        <Card className="rounded-lg border bg-card" data-testid="actualization-race-compact">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
            <p className="text-sm text-muted-foreground">
              База актуализирована на <span className="font-semibold text-foreground">{safeTotalPct}%</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded(true)}
              data-testid="button-actualization-race-expand"
            >
              <ChevronDown className="mr-1 h-4 w-4" aria-hidden />
              Развернуть
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="rounded-lg border bg-card" data-testid="actualization-race-director">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="text-base font-semibold text-foreground">Гонка актуализации</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Общий прогресс компании: <span className="font-semibold text-foreground">{totals.activeManagers}</span> из{" "}
                <span className="font-semibold text-foreground">{totals.totalManagers}</span> активных менеджеров ·{" "}
                <span className="font-semibold text-foreground">{safeTotalPct}%</span>
              </p>
            </div>
            {safeTotalPct >= 95 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded(false)}
                data-testid="button-actualization-race-collapse"
              >
                <ChevronUp className="mr-1 h-4 w-4" aria-hidden />
                Свернуть
              </Button>
            ) : null}
          </div>
          <ProgressBar pct={safeTotalPct} />
          {top3.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {top3.map((g, i) => (
                <MedalCard
                  key={(g.teamId ?? "__no_rop__") + i}
                  rank={(i as 0 | 1 | 2) ?? 0}
                  title={g.teamName}
                  pct={teamPct(g)}
                  subtitle={`активн. ${g.activeManagers}/${g.managerCount}`}
                />
              ))}
            </div>
          ) : null}
          {rest.length > 0 ? (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Остальные команды</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {rest.map((g) => {
                  const p = Math.round(teamPct(g));
                  return (
                    <div
                      key={g.teamId ?? g.teamName}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 truncate text-foreground">{g.teamName}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {g.activeManagers}/{g.managerCount} · <span className="font-semibold text-foreground">{p}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // ===== ROP =====
  if (role === "rop") {
    // Находим свою команду по `ropUserId === me.id` либо первой попавшейся (запасной вариант, если userId отсутствует).
    const meId = user?.id ?? null;
    const myTeam = meId
      ? overview.ropRanking.find((t) => t.ropUserId === meId) ?? overview.ropRanking[0] ?? null
      : overview.ropRanking[0] ?? null;
    if (!myTeam) return null;
    const ranked = [...overview.ropRanking].sort((a, b) => teamPct(b) - teamPct(a));
    const myRank = ranked.findIndex((t) => t === myTeam) + 1;
    const myPct = Math.round(teamPct(myTeam));
    const myMgrs = overview.managersFeed
      .filter((m) => m.teamId === myTeam.teamId)
      .sort((a, b) => managerPct(b) - managerPct(a));
    const top3 = myMgrs.slice(0, 3);
    const restMgrs = myMgrs.slice(3);
    const neighbour = myRank > 1 ? ranked[myRank - 2] ?? null : null;
    const diff = neighbour ? Math.max(0, Math.round(teamPct(neighbour)) - myPct) : 0;

    return (
      <Card className="rounded-lg border bg-card" data-testid="actualization-race-rop">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="text-base font-semibold text-foreground">Моя команда в гонке</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Место <span className="font-semibold text-foreground">{myRank}</span> из{" "}
                <span className="font-semibold text-foreground">{ranked.length}</span> · общий прогресс{" "}
                <span className="font-semibold text-foreground">{myPct}%</span>
              </p>
            </div>
            {neighbour ? (
              <Badge variant="outline" className="shrink-0 border-primary/30 text-[11px] text-primary">
                До «{neighbour.teamName}» — {diff}%
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 border-primary/30 text-[11px] text-primary">
                Вы лидируете
              </Badge>
            )}
          </div>
          <ProgressBar pct={myPct} />
          {top3.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {top3.map((m, i) => (
                <MedalCard
                  key={m.userId}
                  rank={(i as 0 | 1 | 2) ?? 0}
                  title={m.fullName}
                  pct={managerPct(m)}
                  subtitle={`клиенты ${m.clientsTotal} · ТТ ${m.tpTotal}`}
                />
              ))}
            </div>
          ) : null}
          {restMgrs.length > 0 ? (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Остальные менеджеры</p>
              <div className="space-y-1.5">
                {restMgrs.map((m) => {
                  const p = Math.round(managerPct(m));
                  return (
                    <div key={m.userId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-foreground">{m.fullName}</span>
                        <span className="shrink-0 text-muted-foreground">{p}%</span>
                      </div>
                      <ProgressBar pct={p} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // ===== MANAGER =====
  // role === "manager"
  const meId = user?.id ?? null;
  const myTeamId = (() => {
    if (!meId) return null;
    const me = overview.managersFeed.find((m) => m.userId === meId);
    return me?.teamId ?? null;
  })();
  const teamMgrs = myTeamId
    ? overview.managersFeed.filter((m) => m.teamId === myTeamId).sort((a, b) => managerPct(b) - managerPct(a))
    : overview.managersFeed.filter((m) => m.userId === meId);
  const meFeed = teamMgrs.find((m) => m.userId === meId) ?? null;
  const myRank = meFeed ? teamMgrs.indexOf(meFeed) + 1 : 0;
  const teamSize = teamMgrs.length;
  const teamName = meFeed?.teamName ?? "—";

  const myPct = meFeed ? Math.round(managerPct(meFeed)) : 0;
  const neighbour = myRank > 1 ? teamMgrs[myRank - 2] ?? null : null;
  // «До соседа сверху»: считаем разницу в клиентах (clientsTotal). Если нет — fallback на 0.
  const dealersDiff = neighbour && meFeed ? Math.max(0, neighbour.clientsTotal - meFeed.clientsTotal) : 0;

  // Период за 7д для «Добавлено» — отдельный fetch для свежести.
  const range7 = useMemo(() => periodIsoRange7d(), []);
  const overview7Q = useQuery({
    queryKey: ["actualization-race-7d"],
    queryFn: () => fetchActualizationStatsOverview(range7),
  });
  const added7 = (() => {
    if (!overview7Q.data || !meId) return 0;
    const m = overview7Q.data.managersFeed.find((x) => x.userId === meId);
    if (!m) return overview7Q.data.totals.clientsAdded ?? 0;
    // Сколько добавил именно я — считаем как m.clientsTotal в 7-дневной выборке (это уже scoped overview).
    return m.clientsTotal;
  })();

  // Streak — fallback на dealerOverrides из своего state (не из overview).
  const streakRows = useMemo(() => {
    const out: { userId: string | null; updatedAt: string | null }[] = [];
    const overrides = actx.state.dealerOverridesById ?? {};
    for (const v of Object.values(overrides)) {
      out.push({ userId: meId, updatedAt: v.updatedAt ?? null });
    }
    const manuals = actx.state.manuallyCreatedDealersById ?? {};
    for (const v of Object.values(manuals)) {
      out.push({ userId: meId, updatedAt: (v.updatedAt ?? v.createdAt) ?? null });
    }
    return out;
  }, [actx.state, meId]);
  const streak = meId ? computeStreak(meId, streakRows) : 0;

  return (
    <Card className="rounded-lg border bg-card" data-testid="actualization-race-manager">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">Моя гонка</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {teamSize > 0 ? (
                <>
                  Место <span className="font-semibold text-foreground">{myRank || "—"}</span> из{" "}
                  <span className="font-semibold text-foreground">{teamSize}</span> в команде{" "}
                  <span className="font-semibold text-foreground">{teamName}</span>
                </>
              ) : (
                <>Команда не определена</>
              )}
            </p>
          </div>
        </div>
        <ProgressBar pct={myPct} />
        <div className="grid grid-cols-3 gap-2">
          <MiniTile label="Добавлено за 7 дней" value={String(added7)} />
          <div className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-[11px] leading-tight text-muted-foreground">Серия дней с активностью</p>
            <p className="mt-0.5 flex items-baseline gap-1 text-base font-semibold tabular-nums text-foreground sm:text-lg">
              {streak}
              {streak >= 3 ? <Flame className="h-4 w-4 text-orange-500" aria-hidden /> : null}
            </p>
          </div>
          <MiniTile
            label="До соседа сверху"
            value={neighbour ? `${dealersDiff}` : "—"}
            accent={!!neighbour}
          />
        </div>
        {neighbour ? (
          <p className="text-[11px] text-muted-foreground">
            Сосед сверху: <span className="font-medium text-foreground">{neighbour.fullName}</span>
          </p>
        ) : null}
        <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
          <Link href={buildHashPath("/dealer-base")} data-testid="button-actualization-race-open-base">
            Открыть мою базу
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
