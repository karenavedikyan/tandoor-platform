import { useMemo } from "react";
import { Link } from "wouter";
import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import { cn } from "@/lib/utils";
import { buildTerritoryCardLivePack } from "@/lib/territory-card-live-data";
import {
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  MATRIX_TASK_TYPE_LABEL,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";
import { formatCompactRub, formatPercent, formatUnits, planCompletionPercent } from "@/lib/sales-manager-kpi-data";
import type { TerritoryCitySummary, TerritoryPlanLine, TerritoryRiskItem } from "@/lib/territory-card-data";

function riskTone(level: TerritoryRiskItem["level"]) {
  if (level === "critical") return "border-primary/50 bg-primary/10 text-foreground";
  if (level === "attention") return "border-border bg-muted/60 text-foreground";
  return "border-border bg-muted/50 text-foreground";
}

function planCardTestId(key: TerritoryPlanLine["key"]) {
  if (key === "mk") return "card-territory-plan-mk";
  if (key === "vh") return "card-territory-plan-vh";
  return "card-territory-plan-hardware";
}

function formatPlanValue(line: TerritoryPlanLine): string {
  if (line.key === "hardware") return formatCompactRub(line.plan);
  return formatUnits(line.plan);
}

function formatFactValue(line: TerritoryPlanLine): string {
  if (line.key === "hardware") return formatCompactRub(line.fact);
  return formatUnits(line.fact);
}

function formatRemainder(line: TerritoryPlanLine): string {
  if (line.key === "hardware") return formatCompactRub(line.remainder);
  return formatUnits(line.remainder);
}

function cityCompletion(plan: number, fact: number) {
  return planCompletionPercent(plan, fact);
}

export default function TerritoryCardPage() {
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const teamPlane = useClientBaseTeamActualization();

  const mergedLoading =
    (actx.enabled && actx.loading) ||
    (actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && teamPlane.teamFetchLoading);

  const directorRopFactual = shouldUseTeamMergedActualizationPlane(profile);

  const livePack = useMemo(() => {
    if (!actx.enabled) {
      return null;
    }
    const rows = buildDealerBaseRowsWithActualization(teamPlane.mergedState, profile, { includeArchivedDealers: false });
    const scoped = roleScopedDealerRows(rows, profile);
    const label =
      profile.role === "team_lead"
        ? "Моя команда (активная база)"
        : "Отдел продаж (активная база)";
    return buildTerritoryCardLivePack(scoped, label, {
      directorRopFactualUi: directorRopFactual,
      mergedActualization: directorRopFactual ? teamPlane.mergedState : undefined,
    });
  }, [actx.enabled, teamPlane.mergedState, profile, actx.loading, teamPlane.teamFetchLoading, directorRopFactual]);

  const factual = Boolean(livePack?.directorRopFactualUi);
  const summary = livePack?.summary;
  const planLines = livePack?.planLines ?? [];
  const cities = livePack?.cities ?? [];
  const focus = livePack?.focus ?? [];
  const tasks = livePack?.tasks ?? [];
  const tradePoints = livePack?.tradePoints ?? [];
  const showcases = livePack?.showcases ?? [];
  const risks = livePack?.risks ?? [];
  const trainingKpis = livePack?.trainingKpis;

  if (!actx.enabled) {
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28" data-testid="page-territory-card">
        <Card className="border-dashed border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Карточка территории</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Раздел доступен при включённой актуализации клиентской базы.</p>
            <Button asChild className="min-h-11 font-semibold">
              <Link href="/main">К главному</Link>
            </Button>
          </CardContent>
        </Card>
        <FloatingBackButton href="/main" label="К главному" testId="floating-back-to-main" ariaLabel="К главному экрану" />
      </div>
    );
  }

  if (mergedLoading || !livePack || !summary || !trainingKpis) {
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28" data-testid="page-territory-card-loading">
        <p className="text-sm text-muted-foreground">Загрузка актуальной базы…</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-8 overflow-x-hidden pb-28 sm:space-y-10" data-testid="page-territory-card">
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-territory-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative flex flex-col gap-5 pl-3 sm:flex-row sm:items-start sm:justify-between sm:pl-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <MapPinned className="h-7 w-7 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Территория «{summary.territoryLabel}»
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Карточка территории</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              {factual
                ? "Сводка по активной клиентской базе и торговым точкам. Расчётные KPI по витрине и «сигналы» скрыты до появления данных в системе задач и сохранённой актуализации."
                : "Операционная сводка по клиентам, задачам по витрине и торговым точкам территории."}
            </p>
            <p className="text-xs font-medium text-primary" data-testid="text-territory-data-source">
              Источник: актуальная активная база (актуализация, без архива и без демо-заказов).
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:min-w-[220px]">
            <Button asChild className="min-h-11 w-full font-semibold" data-testid="button-territory-open-main">
              <Link href="/main">К главному</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-territory-open-dealers">
              <Link href="/dealer-base">К клиентам</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-territory-open-client-map">
              <Link href="/client-map">Карта клиентов</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-territory-open-analytics">
              <Link href="/analytics">К аналитике</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-territory-summary">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Сводка территории</h2>
        <p className="text-xs text-muted-foreground">
          {factual
            ? "Только фактические счётчики активной базы. Задачи витрины, контроль матрицы и зоны внимания — в блоке ниже, если есть сохранённые записи."
            : "Показатели считаются по объединённому state команды и только активным клиентам/точкам."}
        </p>
        <div
          className={
            factual ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          }
        >
          {factual ? (
            <>
              <Card className="border-border/70 shadow-xs" data-testid="card-territory-dealers-active">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Активные клиенты</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.dealersActive}</p>
                  <p className="text-xs text-muted-foreground">в зоне ответственности (merge, без архива)</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-xs" data-testid="card-territory-trade-points-active">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Активные торговые точки</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.tradePointsTotal}</p>
                  <p className="text-xs text-muted-foreground">по активным клиентам в merge</p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="border-border/70 shadow-xs" data-testid="card-territory-dealers">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Клиенты</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 pb-4 pt-0">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.dealersTotal}</p>
                  <p className="text-xs text-muted-foreground">активных: {summary.dealersActive}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-xs" data-testid="card-territory-trade-points">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Торговые точки</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.tradePointsTotal}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-xs" data-testid="card-territory-tasks">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Задачи по витрине</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.tasksOpen}</p>
                  <p className="text-xs text-muted-foreground">открыто по витрине и матрице</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-xs" data-testid="card-territory-showcases">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Витрины и матрица</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.showcaseFollowUps}</p>
                  <p className="text-xs text-muted-foreground">точек с контролем выкладки</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-xs" data-testid="card-territory-attention">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Зоны внимания</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.attentionSignals}</p>
                  <p className="text-xs text-muted-foreground">сигналов по клиентам</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </section>

      {factual ? (
        <section className="space-y-4" data-testid="section-territory-operational-factual">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Задачи и контроль витрины</h2>
          <p className="text-xs text-muted-foreground">
            Цифры ниже появляются только при наличии записей в системе задач витрины (план в sessionStorage), сохранённой
            актуализации витрины ТТ или явных ячеек контроля матрицы в браузере.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/70 shadow-xs" data-testid="card-territory-tasks-factual">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Задачи по витрине</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 pt-0">
                {summary.tasksOpen > 0 ? (
                  <>
                    <p className="text-2xl font-semibold tabular-nums text-foreground">{summary.tasksOpen}</p>
                    <p className="text-xs text-muted-foreground">открытых записей плана витрины (не закрыты в системе задач)</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет актуальных задач по витрине</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-territory-showcases-factual">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Витрины и матрица</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 pt-0">
                {livePack.factualShowcaseMatrixControlledTpCount > 0 ? (
                  <>
                    <p className="text-2xl font-semibold tabular-nums text-foreground">
                      {livePack.factualShowcaseMatrixControlledTpCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      торговых точек с сохранённым контролем витрины (актуализация) или внесённой ячейкой матрицы
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Нет сохранённых данных контроля витрины и матрицы для точек в этой зоне ответственности
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-territory-attention-factual">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Зоны внимания</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 pt-0">
                {risks.length > 0 ? (
                  <>
                    <p className="text-2xl font-semibold tabular-nums text-foreground">{risks.length}</p>
                    <p className="text-xs text-muted-foreground">просрочки плана витрины или открытые задачи матрицы из актуализации</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Нет сохранённых зон внимания: нет просроченных задач плана витрины и открытых задач матрицы из форм
                    актуализации
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {!factual ? (
      <section className="space-y-4" data-testid="section-territory-training-attention">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Обучение и внимание к персоналу</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Сводка по клиентам территории: кому рекомендуется продуктовое обучение от Tandoor и сколько потребностей уже закрыто.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 shadow-xs" data-testid="card-territory-training-recommended">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Рекомендуется обучение</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{trainingKpis.recommended}</p>
              <p className="text-xs text-muted-foreground">клиентов по текущим правилам</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-xs" data-testid="card-territory-training-priority">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Приоритет на обучение</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{trainingKpis.priority}</p>
              <p className="text-xs text-muted-foreground">ключевые кандидаты</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-xs" data-testid="card-territory-training-indigo">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">VIP · ИНДИГО</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{trainingKpis.indigoCandidates}</p>
              <p className="text-xs text-muted-foreground">кандидатов на подборку</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-xs" data-testid="card-territory-training-completed">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Потребность закрыта</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{trainingKpis.completed}</p>
              <p className="text-xs text-muted-foreground">отмечено «обучение проведено»</p>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold" data-testid="button-territory-open-training">
            <Link href="/training">К разделу обучения</Link>
          </Button>
        </div>
      </section>
      ) : null}

      <section className="space-y-4" data-testid="section-territory-plan">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Выполнение плана территории</h2>
        {planLines.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/10 shadow-xs">
            <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">План-факт пока не настроен</p>
              <p>
                {factual
                  ? "Блок скрыт до подключения реальных планов и факта из учётных систем. Сводка территории отражает только состав активной клиентской базы и торговых точек."
                  : "Блок скрыт до подключения реальных планов и факта из учётных систем. Сводка выше и списки ниже отражают только клиентскую базу и задачи по витрине."}
              </p>
            </CardContent>
          </Card>
        ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {planLines.map((line) => (
            <Card key={line.key} className="border-border/70 shadow-xs" data-testid={planCardTestId(line.key)}>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base">{line.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{line.unitLabel === "₽" ? "Оборот" : "Объём в штуках"}</p>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    План: <span className="font-semibold text-foreground">{formatPlanValue(line)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Факт: <span className="font-semibold text-foreground">{formatFactValue(line)}</span>
                  </span>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Выполнение</span>
                    <span className="font-semibold text-foreground">{formatPercent(line.completionPercent)}</span>
                  </div>
                  <Progress value={Math.min(100, line.completionPercent)} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Остаток до плана: <span className="font-medium text-foreground">{formatRemainder(line)}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </section>

      <section className="space-y-4" data-testid="section-territory-cities">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Города и населённые пункты</h2>
        {cities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            Нет актуальных данных по городам: в зоне ответственности пока нет активных клиентов.
          </p>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cities.map((c: TerritoryCitySummary) => (
            <Card key={c.id} className="border-border/70 shadow-xs" data-testid={`card-territory-city-${c.id}`}>
              <CardHeader className="space-y-1 pb-2 pt-4">
                <CardTitle className="text-lg">{c.name}</CardTitle>
                {factual ? (
                  <p className="text-xs text-muted-foreground">
                    Клиенты: <span className="font-semibold text-foreground">{c.dealersCount}</span> · активные:{" "}
                    <span className="font-semibold text-foreground">{c.activeDealersCount}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Клиенты: <span className="font-semibold text-foreground">{c.dealersCount}</span> · активные:{" "}
                    <span className="font-semibold text-foreground">{c.activeDealersCount}</span> · ТОП-сегмент:{" "}
                    <span className="font-semibold text-foreground">{c.topDealersCount}</span> · внимание:{" "}
                    <span className="font-semibold text-foreground">{c.attentionDealersCount}</span>
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3 pb-4 text-sm text-muted-foreground">
                <p>
                  Торговые точки: <span className="font-medium text-foreground">{c.tradePointsCount}</span>
                  {" · "}
                  Задачи по витрине: <span className="font-medium text-foreground">{c.tasksCount}</span>
                  {factual ? (
                    <span className="block pt-1 text-xs text-muted-foreground">
                      (только записи плана витрины из системы задач, без автогенерации по каталогу)
                    </span>
                  ) : null}
                </p>
                {!factual ? (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
                    <p>
                      МК: план {formatUnits(c.mkPlanUnits)}, факт {formatUnits(c.mkFactUnits)} (
                      {formatPercent(cityCompletion(c.mkPlanUnits, c.mkFactUnits))})
                    </p>
                    <p className="mt-1">
                      ВХ: план {formatUnits(c.vhPlanUnits)}, факт {formatUnits(c.vhFactUnits)} (
                      {formatPercent(cityCompletion(c.vhPlanUnits, c.vhFactUnits))})
                    </p>
                    <p className="mt-1">
                      Фурнитура: план {formatCompactRub(c.hardwarePlanMoney)}, факт {formatCompactRub(c.hardwareFactMoney)} (
                      {formatPercent(cityCompletion(c.hardwarePlanMoney, c.hardwareFactMoney))})
                    </p>
                  </div>
                ) : null}
                <Button asChild variant="outline" className="w-full min-h-11 border-border font-semibold" data-testid={`button-open-city-dealers-${c.id}`}>
                  <Link href="/dealer-base">Открыть клиентов</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </section>

      {!factual ? (
      <section className="space-y-4" data-testid="section-territory-focus-dealers">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Клиенты в фокусе</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {focus.map((f) => {
            const dealerId = f.href.replace("/dealers/", "");
            return (
              <Card key={f.id} className="border-border/70 shadow-xs" data-testid={`card-territory-focus-dealer-${dealerId}`}>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base leading-snug">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                  <Button asChild className="w-full min-h-11 font-semibold" data-testid={`button-open-territory-dealer-${dealerId}`}>
                    <Link href={f.href}>Карточка клиента</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      ) : null}

      <section className="space-y-4" data-testid="section-territory-tasks">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Задачи территории</h2>
        <p className="text-sm text-muted-foreground">
          {factual
            ? "Список ниже — только открытые записи плана витрины из системы задач (sessionStorage). Автоматически сгенерированные строки по каталогу не показываются."
            : "Витрины, матрица и сопровождение — через общий список задач по витрине."}
        </p>
        {factual && tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            Нет актуальных задач по витрине
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((t: MatrixTaskWithContext) => (
            <Card key={`${t.dealerId}-${t.taskId}`} className="border-border/70 shadow-xs" data-testid={`card-territory-task-${t.taskId}`}>
              <CardHeader className="space-y-2 pb-2 pt-4">
                <CardTitle className="text-base leading-snug">{t.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[11px] font-medium">
                    {MATRIX_TASK_TYPE_LABEL[t.type]}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-medium">
                    {MATRIX_TASK_STATUS_LABEL[t.status]}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-medium">
                    {MATRIX_TASK_PRIORITY_LABEL[t.priority]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 text-sm text-muted-foreground">
                <p>{t.dealerName}</p>
                <p>Срок: {t.dueDate}</p>
                <Button asChild variant="outline" className="mt-2 w-full min-h-11 font-semibold sm:w-auto" data-testid={`button-open-territory-task-${t.taskId}`}>
                  <Link href="/tasks">К задачам по витрине</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-territory-trade-points">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Торговые точки и витрины</h2>
        {factual ? (
          <p className="text-xs text-muted-foreground">
            Список точек из активной базы. Показатели матрицы и «витрина» из мок-данных скрыты; детали контроля — в карточке точки
            и в блоке сводки по сохранённой актуализации ниже.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {tradePoints.map((tp) => (
            <Card key={tp.pointId} className="border-border/70 shadow-xs" data-testid={`card-territory-trade-point-${tp.pointId}`}>
              <CardHeader className="space-y-1 pb-2 pt-4">
                <CardTitle className="text-base">{tp.pointLabel}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {tp.city} · {tp.dealerLabel}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 text-sm text-muted-foreground">
                <p>
                  Статус: <span className="font-medium text-foreground">{tp.status}</span>
                </p>
                {!factual ? (
                  <>
                    <p>
                      Матрица (сводно): <span className="font-medium text-foreground">{tp.matrixPercent}%</span>
                    </p>
                    <p className="text-xs leading-relaxed">Витрина: {tp.showcaseLine}</p>
                    <p className="text-xs">Активность: {tp.lastActivity}</p>
                    <p className="text-xs leading-relaxed">{tp.issuesShort}</p>
                  </>
                ) : null}
                <Button
                  asChild
                  variant="outline"
                  className="mt-2 w-full min-h-11 border-border font-semibold"
                  data-testid={`button-open-territory-trade-point-${tp.pointId}`}
                >
                  <Link href={`/dealers/${tp.dealerId}/trade-points/${tp.pointId}`}>Открыть точку</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">Витрины (сводка)</h3>
          {showcases.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {factual
                ? "Нет строк из сохранённой актуализации витрины по точкам в этой зоне ответственности."
                : "Нет данных для сводки."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {showcases.slice(0, 6).map((s) => (
                <li key={s.id} className="flex flex-col gap-1 border-b border-border/60 pb-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 font-medium text-foreground">{s.headline}</span>
                  <span className="shrink-0 text-xs">{s.statusLine}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-territory-risks">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Зоны внимания</h2>
        {factual ? (
          <p className="text-xs text-muted-foreground">
            Только просроченные задачи плана витрины (записи в системе задач) и открытые задачи матрицы, явно созданные в
            актуализации торговой точки. Сигналы по статусу клиента из мок-строк не показываются.
          </p>
        ) : null}
        {factual && risks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            Нет сохранённых зон внимания по правилам выше.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {risks.map((r: TerritoryRiskItem) => (
            <Card key={r.id} className={cn("border shadow-xs", riskTone(r.level))} data-testid={`card-territory-risk-${r.id}`}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base leading-snug">{r.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                    {r.level === "critical" ? "Критично" : r.level === "attention" ? "Внимание" : "Норма"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.city}</p>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 text-sm">
                <p>
                  <span className="font-semibold text-foreground">Причина: </span>
                  {r.reason}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Следующий шаг: </span>
                  {r.nextAction}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6" data-testid="section-territory-quick-actions">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Быстрые действия</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline" className="min-h-11 w-full border-border font-semibold sm:w-auto" data-testid="button-territory-quick-dealers">
            <Link href="/dealer-base">К клиентской базе</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 w-full border-border font-semibold sm:w-auto" data-testid="button-territory-quick-client-map">
            <Link href="/client-map">Карта клиентов</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 w-full border-border font-semibold sm:w-auto" data-testid="button-territory-quick-tasks">
            <Link href="/tasks">К задачам по витрине</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 w-full border-border font-semibold sm:w-auto" data-testid="button-territory-quick-analytics">
            <Link href="/analytics">К аналитике</Link>
          </Button>
          <Button asChild className="min-h-11 w-full font-semibold sm:w-auto" data-testid="button-territory-quick-training">
            <Link href="/training">К обучению</Link>
          </Button>
        </div>
      </section>

      <FloatingBackButton href="/main" label="К главному" testId="floating-back-to-main" ariaLabel="К главному экрану" />
    </div>
  );
}