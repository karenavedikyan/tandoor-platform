import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  getDefaultSalesPeriodId,
  getTeamById,
  getTeamManagers,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  SALES_TEAMS,
  type SalesRole,
  type SalesUser,
} from "@/lib/sales-control-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SalesPlanFactPersistedState } from "@/lib/sales-plan-fact-types";
import { upsertManagerMetricLine, upsertTeamPlanMetrics } from "@/lib/sales-plan-fact-mutations";
import {
  buildAttentionZones,
  buildCityRows,
  buildKpiBars,
  buildPeriodSummary,
  buildProductRows,
  buildRopRows,
  formatPlanFactValue,
  topRopsByCompletion,
  type SalesPlanFactCockpitMode,
} from "@/lib/sales-plan-fact-management-view-model";
import { SalesPlanFactDetailDrawer, type SalesPlanFactDetailTarget } from "@/components/sales-plan-fact-detail-drawer";

const MODE_LS_KEY = "tandoor-sales-plan-fact-mgmt-mode-v1";

function readMode(): SalesPlanFactCockpitMode {
  try {
    const r = localStorage.getItem(MODE_LS_KEY);
    if (
      r === "overview" ||
      r === "by_rop" ||
      r === "managers" ||
      r === "cities" ||
      r === "products" ||
      r === "entry"
    )
      return r;
  } catch {
    /* ignore */
  }
  return "overview";
}

function writeMode(m: SalesPlanFactCockpitMode): void {
  try {
    localStorage.setItem(MODE_LS_KEY, m);
  } catch {
    /* ignore */
  }
}

type Props = {
  profile: ReleaseDemoProfile;
  role: SalesRole;
  persona: SalesUser;
  dealers: DealerRow[];
  state: SalesPlanFactPersistedState;
  onPersist: (next: SalesPlanFactPersistedState) => Promise<void>;
  loading: boolean;
  saving: boolean;
  storageMessage: string | null;
  apiError: string | null;
};

export function SalesPlanFactManagementCockpit({
  profile,
  role,
  persona,
  dealers,
  state,
  onPersist,
  loading,
  saving,
  storageMessage,
  apiError,
}: Props) {
  const [mode, setMode] = useState<SalesPlanFactCockpitMode>(() => readMode());
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const [directorTeamFilter, setDirectorTeamFilter] = useState<string>("__all__");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<SalesPlanFactDetailTarget | null>(null);

  useEffect(() => {
    writeMode(mode);
  }, [mode]);

  const opts = useMemo(() => ({ role, persona, directorTeamFilter: role === "sales_director" ? directorTeamFilter : null }), [role, persona, directorTeamFilter]);

  const periodLabel = SALES_PLAN_PERIODS.find((p) => p.id === periodId)?.label ?? periodId;

  const summary = useMemo(
    () => buildPeriodSummary(state, periodId, periodLabel, opts),
    [state, periodId, periodLabel, opts],
  );
  const kpiBars = useMemo(() => buildKpiBars(state, periodId, opts), [state, periodId, opts]);
  const ropRows = useMemo(() => buildRopRows(state, periodId, dealers, opts), [state, periodId, dealers, opts]);
  const cityRows = useMemo(() => buildCityRows(state, periodId, dealers, opts), [state, periodId, dealers, opts]);
  const productRows = useMemo(() => buildProductRows(state, periodId, opts), [state, periodId, opts]);
  const attention = useMemo(() => buildAttentionZones(state, periodId, opts), [state, periodId, opts]);
  const topRop = useMemo(() => topRopsByCompletion(ropRows, 3), [ropRows]);

  const maxCityPlan = useMemo(() => Math.max(1, ...cityRows.map((c) => c.plan)), [cityRows]);
  const maxProductPlan = useMemo(() => Math.max(1, ...productRows.map((c) => c.plan)), [productRows]);

  const openDetail = useCallback((t: SalesPlanFactDetailTarget) => {
    setDetailTarget(t);
    setDetailOpen(true);
  }, []);

  /** Ввод: локальные строки форм */
  const [teamMetricDraft, setTeamMetricDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const team of SALES_TEAMS) {
      for (const met of SALES_KPI_METRICS_SORTED) {
        const L = state.lines.find(
          (l) =>
            l.periodId === periodId &&
            l.teamId === team.id &&
            l.rollup === "team" &&
            l.metricId === met.id &&
            l.managerId === null,
        );
        next[`${team.id}:${met.id}`] = L ? String(L.planValue) : "";
      }
    }
    setTeamMetricDraft(next);
  }, [state.lines, periodId]);
  const [mgrDraft, setMgrDraft] = useState<Record<string, Record<string, { plan: string; actual: string }>>>({});

  useEffect(() => {
    const nextM: Record<string, Record<string, { plan: string; actual: string }>> = {};
    const all = SALES_TEAMS.flatMap((t) => getTeamManagers(t.id));
    for (const m of all) {
      const o: Record<string, { plan: string; actual: string }> = {};
      for (const met of SALES_KPI_METRICS_SORTED) {
        const L = state.lines.find(
          (l) =>
            l.periodId === periodId &&
            l.managerId === m.id &&
            l.metricId === met.id &&
            l.rollup === "manager",
        );
        o[met.id] = {
          plan: String(L?.planValue ?? ""),
          actual: L?.actualValue === null || L?.actualValue === undefined ? "" : String(L.actualValue),
        };
      }
      nextM[m.id] = o;
    }
    setMgrDraft(nextM);
  }, [state.lines, periodId, role, persona.teamId, directorTeamFilter]);

  const persistWrap = useCallback(
    async (next: SalesPlanFactPersistedState) => {
      await onPersist(next);
    },
    [onPersist],
  );

  const saveTeamPlans = useCallback(async () => {
    if (role !== "sales_director") return;
    let next = state;
    const teams = SALES_TEAMS.filter((t) => directorTeamFilter === "__all__" || t.id === directorTeamFilter);
    for (const team of teams) {
      const metrics: Record<string, number> = {};
      for (const met of SALES_KPI_METRICS_SORTED) {
        const raw = teamMetricDraft[`${team.id}:${met.id}`] ?? "0";
        const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
        metrics[met.id] = Number.isFinite(n) ? n : 0;
      }
      next = upsertTeamPlanMetrics(next, {
        periodId,
        teamId: team.id,
        metricPlans: metrics,
        actorId: profile.personaUserId,
        status: "published",
      });
    }
    await persistWrap(next);
  }, [role, state, teamMetricDraft, periodId, persistWrap, profile.personaUserId, directorTeamFilter]);

  const saveManagerEntry = useCallback(
    async (teamId: string, managerId: string, status: "draft" | "fact_entered" | "confirmed") => {
      const draft = mgrDraft[managerId];
      if (!draft) return;
      let next = state;
      for (const met of SALES_KPI_METRICS_SORTED) {
        const cell = draft[met.id] ?? { plan: "0", actual: "" };
        const pv = Number(String(cell.plan).replace(/\s/g, "").replace(",", "."));
        const avRaw = cell.actual.trim();
        const av = avRaw === "" ? null : Number(avRaw.replace(/\s/g, "").replace(",", "."));
        next = upsertManagerMetricLine(next, {
          periodId,
          teamId,
          managerId,
          metricId: met.id,
          planValue: Number.isFinite(pv) ? pv : 0,
          actualValue: av !== null && Number.isFinite(av) ? av : null,
          status: av === null ? "draft" : status,
          actorId: profile.personaUserId,
        });
      }
      await persistWrap(next);
    },
    [mgrDraft, state, periodId, persistWrap, profile.personaUserId],
  );

  const modeButton = (m: SalesPlanFactCockpitMode, label: string, testId: string) => (
    <Button
      key={m}
      type="button"
      size="sm"
      variant={mode === m ? "default" : "outline"}
      className={cn("min-h-9 shrink-0 font-semibold", mode === m ? "bg-primary text-primary-foreground hover:bg-[#86B832]" : "border-border")}
      data-testid={testId}
      onClick={() => setMode(m)}
    >
      {label}
    </Button>
  );

  const scopedManagers = useMemo(() => {
    const all = SALES_TEAMS.flatMap((t) => getTeamManagers(t.id).map((m) => ({ ...m, teamId: t.id })));
    return all.filter((m) => {
      if (role === "sales_manager") return m.id === persona.id;
      if (role === "team_lead") return m.teamId === persona.teamId;
      if (directorTeamFilter === "__all__") return true;
      return m.teamId === directorTeamFilter;
    });
  }, [role, persona, directorTeamFilter]);

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden pb-24 text-[#222631]" data-testid="section-sales-plan-fact-cockpit">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">План-факт продаж</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Управленческий cockpit: план и факт только из сохранённого серверного слоя. Синтетические сиды и sessionStorage-наслоения сюда не подмешиваются.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 border-border">
          <Link href="/sales-control">К старым экранам</Link>
        </Button>
      </div>

      {apiError ? (
        <Alert className="border-border bg-muted/30">
          <AlertDescription className="text-foreground">{apiError}</AlertDescription>
        </Alert>
      ) : null}
      {storageMessage ? <p className="text-xs text-muted-foreground">{storageMessage}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" data-testid="section-sales-plan-fact-mode-toggle">
        {modeButton("overview", "Обзор", "button-sales-plan-fact-mode-overview")}
        {modeButton("by_rop", "По РОП", "button-sales-plan-fact-mode-rop")}
        {modeButton("managers", "По менеджерам", "button-sales-plan-fact-mode-managers")}
        {modeButton("cities", "По городам", "button-sales-plan-fact-mode-cities")}
        {modeButton("products", "По продуктам", "button-sales-plan-fact-mode-products")}
        {modeButton("entry", "Ввод", "button-sales-plan-fact-mode-entry")}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-full min-w-0 sm:w-[220px]" aria-label="Период">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            {SALES_PLAN_PERIODS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {role === "sales_director" ? (
          <Select value={directorTeamFilter} onValueChange={setDirectorTeamFilter}>
            <SelectTrigger className="w-full min-w-0 sm:w-[260px]" aria-label="Команда">
              <SelectValue placeholder="Команда РОП" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все команды</SelectItem>
              {SALES_TEAMS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}

      {mode === "overview" ? (
        <>
          <section className="rounded-xl border border-[#E3E6F3] bg-white p-4 shadow-sm" data-testid="section-sales-plan-fact-period-summary">
            <h2 className="text-sm font-semibold text-foreground">Итоги периода · {periodLabel}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-[#EEEFF6] p-3">
                <p className="text-xs text-muted-foreground">План суммарно</p>
                <p className="text-lg font-semibold tabular-nums">{summary.totalPlan.toLocaleString("ru-RU")}</p>
              </div>
              <div className="rounded-lg bg-[#EEEFF6] p-3">
                <p className="text-xs text-muted-foreground">Факт</p>
                <p className="text-lg font-semibold tabular-nums">
                  {summary.totalActual === null ? "—" : summary.totalActual.toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="rounded-lg bg-[#EEEFF6] p-3">
                <p className="text-xs text-muted-foreground">Выполнение</p>
                <p className="text-lg font-semibold tabular-nums">{summary.completionPct === null ? "—" : `${summary.completionPct}%`}</p>
              </div>
              <div className="rounded-lg bg-[#EEEFF6] p-3">
                <p className="text-xs text-muted-foreground">Осталось</p>
                <p className="text-lg font-semibold tabular-nums">{summary.remaining === null ? "—" : summary.remaining.toLocaleString("ru-RU")}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>РОПов в scope: {summary.ropCount}</span>
              <span>Менеджеров: {summary.managerCount}</span>
              <span>С фактом: {summary.managersWithFact}</span>
              <span>Без факта: {summary.managersWithoutFact}</span>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-[#E3E6F3]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">План / факт по KPI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {kpiBars.map((k) => (
                  <div key={k.metricId} className="min-w-0 space-y-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{k.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {k.actual === null ? "факт не внесён" : `${k.pct ?? 0}%`}
                      </span>
                    </div>
                    <Progress value={k.pct === null ? 0 : Math.min(100, k.pct)} className="h-2 bg-[#EEEFF6]" />
                    <p className="text-xs text-muted-foreground">
                      План {formatPlanFactValue(k.metricId, k.plan)}
                      {k.actual !== null ? ` · факт ${formatPlanFactValue(k.metricId, k.actual)}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#E3E6F3]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Топ команд по выполнению</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {topRop.length === 0 ? (
                  <p className="text-muted-foreground">Нет данных для рейтинга (нужен факт по всем KPI менеджеров).</p>
                ) : (
                  topRop.map((r, i) => (
                    <div key={r.teamId} className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-[#EEEFF6]/50 px-3 py-2">
                      <span className="min-w-0 truncate">
                        {i + 1}. {r.ropName}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{r.completionPct}%</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-[#E3E6F3]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Зоны внимания</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Критичных сигналов нет.</p>
              ) : (
                attention.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {mode === "by_rop" ? (
        <section data-testid="section-sales-plan-fact-rop-groups" className="space-y-2">
          <Accordion type="multiple" className="min-w-0 space-y-2">
            {ropRows.map((r) => (
              <AccordionItem
                key={r.teamId}
                value={r.teamId}
                className="rounded-xl border border-[#E3E6F3] bg-white px-3 shadow-sm"
                data-testid={`card-sales-plan-fact-rop-${r.teamId}`}
              >
                <AccordionTrigger
                  className="min-w-0 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180"
                  data-testid={`button-sales-plan-fact-rop-toggle-${r.teamId}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="truncate font-semibold">{r.ropName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      план {r.plan.toLocaleString("ru-RU")} · факт {r.actual === null ? "—" : r.actual.toLocaleString("ru-RU")} ·{" "}
                      {r.completionPct === null ? "—" : `${r.completionPct}%`}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3" data-testid={`section-sales-plan-fact-rop-members-${r.teamId}`}>
                  <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openDetail({ kind: "rop", teamId: r.teamId })}>
                    Детали команды
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {r.managers.map((m) => (
                      <div
                        key={m.managerId}
                        className="rounded-lg border border-border bg-[#EEEFF6]/40 p-3"
                        data-testid={`card-sales-plan-fact-manager-${m.managerId}`}
                      >
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          план {m.plan.toLocaleString("ru-RU")} · факт {m.actual === null ? "—" : m.actual.toLocaleString("ru-RU")}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="mt-1 h-auto px-0 text-xs text-primary underline-offset-2 hover:underline"
                          data-testid={`button-sales-plan-fact-manager-open-${m.managerId}`}
                          onClick={() => openDetail({ kind: "manager", teamId: r.teamId, managerId: m.managerId })}
                        >
                          Открыть
                        </Button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}

      {mode === "managers" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {scopedManagers.map((m) => {
            const row = ropRows.find((x) => x.teamId === m.teamId)?.managers.find((x) => x.managerId === m.id);
            return (
              <Card
                key={m.id}
                className="border-[#E3E6F3] transition hover:border-primary/30"
                data-testid={`card-sales-plan-fact-manager-${m.id}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{getTeamById(m.teamId ?? "")?.name ?? m.teamId}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    План суммарно: {row?.plan.toLocaleString("ru-RU") ?? "—"}
                    <br />
                    Факт:{" "}
                    {!row
                      ? "—"
                      : row.actual === null
                        ? "не внесён"
                        : row.actual.toLocaleString("ru-RU")}
                  </p>
                  {row?.completionPct !== null && row?.completionPct !== undefined ? (
                    <Progress value={Math.min(100, row.completionPct)} className="h-2 bg-[#EEEFF6]" />
                  ) : null}
                  <Button type="button" variant="secondary" size="sm" onClick={() => openDetail({ kind: "manager", teamId: m.teamId!, managerId: m.id })} data-testid={`button-sales-plan-fact-manager-open-${m.id}`}>
                    Детали
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : null}

      {mode === "cities" ? (
        <section className="space-y-4" data-testid="section-sales-plan-fact-city-chart">
          <div className="space-y-2">
            {cityRows.slice(0, 8).map((c) => (
              <div key={c.cityKey} className="min-w-0 space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{c.cityName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.plan.toLocaleString("ru-RU")}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EEEFF6]">
                  <div
                    className="h-2 rounded-full bg-[#9ACA3C]"
                    style={{ width: `${Math.min(100, (c.plan / maxCityPlan) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border rounded-xl border border-[#E3E6F3] bg-white">
            {cityRows.map((c) => (
              <button
                key={c.cityKey}
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#EEEFF6]/50"
                data-testid={`row-sales-plan-fact-city-${c.cityKey}`}
                onClick={() => openDetail({ kind: "city", cityKey: c.cityKey })}
              >
                <span className="truncate">{c.cityName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.actual === null ? "факт —" : `${c.completionPct ?? 0}%`}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "products" ? (
        <section className="space-y-4" data-testid="section-sales-plan-fact-product-chart">
          <div className="space-y-2">
            {productRows.map((p) => (
              <div key={p.productId} className="min-w-0 space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{p.productName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.plan.toLocaleString("ru-RU")}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EEEFF6]">
                  <div
                    className="h-2 rounded-full bg-[#9ACA3C]"
                    style={{ width: `${Math.min(100, (p.plan / maxProductPlan) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border rounded-xl border border-[#E3E6F3] bg-white">
            {productRows.map((p) => (
              <button
                key={p.productId}
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#EEEFF6]/50"
                data-testid={`row-sales-plan-fact-product-${p.productId}`}
                onClick={() => openDetail({ kind: "product", productId: p.productId })}
              >
                <span className="truncate">{p.productName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.actual === null ? "факт —" : `${p.completionPct ?? 0}%`}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "entry" ? (
        <section className="space-y-6">
          {role === "sales_director" ? (
            <Card className="border-[#E3E6F3]">
              <CardHeader>
                <CardTitle className="text-base">Планы команд (директор)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {SALES_TEAMS.filter((t) => directorTeamFilter === "__all__" || t.id === directorTeamFilter).map((team) => (
                  <div key={team.id} className="space-y-2 rounded-lg border border-border/80 p-3" data-testid={`card-sales-plan-fact-rop-${team.id}`}>
                    <p className="text-sm font-semibold">{team.name}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SALES_KPI_METRICS_SORTED.map((met) => (
                        <div key={met.id}>
                          <Label className="text-xs">{met.label}</Label>
                          <Input
                            inputMode="decimal"
                            className="mt-1"
                            value={teamMetricDraft[`${team.id}:${met.id}`] ?? ""}
                            onChange={(e) =>
                              setTeamMetricDraft((prev) => ({ ...prev, [`${team.id}:${met.id}`]: e.target.value }))
                            }
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" data-testid="button-sales-plan-fact-save-draft" disabled={saving} onClick={() => void saveTeamPlans()}>
                    Сохранить планы команд
                  </Button>
                  <Button type="button" className="bg-[#9ACA3C] text-[#222631] hover:bg-[#86B832]" data-testid="button-sales-plan-fact-submit" disabled={saving} onClick={() => void saveTeamPlans()}>
                    Выгрузить в persisted
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-[#E3E6F3]">
            <CardHeader>
              <CardTitle className="text-base">План и факт по менеджерам</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {scopedManagers.map((m) => (
                <div key={m.id} className="space-y-2 rounded-lg border border-border/80 p-3" data-testid={`card-sales-plan-fact-manager-${m.id}`}>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <div data-testid="form-sales-plan-fact-plan-entry" className="grid gap-2 sm:grid-cols-2">
                    {SALES_KPI_METRICS_SORTED.map((met) => (
                      <div key={met.id}>
                        <Label className="text-xs">{met.label} — план</Label>
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          value={mgrDraft[m.id]?.[met.id]?.plan ?? ""}
                          onChange={(e) =>
                            setMgrDraft((prev) => ({
                              ...prev,
                              [m.id]: { ...(prev[m.id] ?? {}), [met.id]: { plan: e.target.value, actual: prev[m.id]?.[met.id]?.actual ?? "" } },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div data-testid="form-sales-plan-fact-actual-entry" className="grid gap-2 sm:grid-cols-2">
                    {SALES_KPI_METRICS_SORTED.map((met) => (
                      <div key={met.id}>
                        <Label className="text-xs">{met.label} — факт</Label>
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          value={mgrDraft[m.id]?.[met.id]?.actual ?? ""}
                          onChange={(e) =>
                            setMgrDraft((prev) => ({
                              ...prev,
                              [m.id]: { ...(prev[m.id] ?? {}), [met.id]: { plan: prev[m.id]?.[met.id]?.plan ?? "", actual: e.target.value } },
                            }))
                          }
                          placeholder="пусто = не внесено"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="button-sales-plan-fact-save-draft"
                      disabled={saving}
                      onClick={() => void saveManagerEntry(m.teamId!, m.id, "draft")}
                    >
                      Черновик
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#9ACA3C] text-[#222631] hover:bg-[#86B832]"
                      data-testid="button-sales-plan-fact-submit"
                      disabled={saving}
                      onClick={() => void saveManagerEntry(m.teamId!, m.id, "fact_entered")}
                    >
                      Сохранить факт
                    </Button>
                    {(role === "sales_director" || role === "team_lead") && (
                      <Button type="button" variant="outline" size="sm" data-testid="button-sales-plan-fact-approve" disabled={saving} onClick={() => void saveManagerEntry(m.teamId!, m.id, "confirmed")}>
                        Подтвердить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <SalesPlanFactDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        target={detailTarget}
        periodId={periodId}
        state={state}
        dealers={dealers}
        role={role}
        persona={persona}
        directorTeamFilter={role === "sales_director" ? directorTeamFilter : null}
      />
    </div>
  );
}
