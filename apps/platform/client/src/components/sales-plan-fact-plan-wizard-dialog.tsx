import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  getTeamManagers,
  SALES_KPI_METRICS_SORTED,
  SALES_TEAMS,
  type SalesRole,
  type SalesUser,
} from "@/lib/sales-control-data";
import {
  getPreviousSalesPeriodId,
  inScopeManager,
  inScopeTeam,
  periodHasAnyPositivePlan,
} from "@/lib/sales-plan-fact-management-view-model";
import { upsertManagerMetricLine, upsertTeamPlanMetrics } from "@/lib/sales-plan-fact-mutations";
import type { SalesPlanFactLineStatus, SalesPlanFactPersistedState } from "@/lib/sales-plan-fact-types";

export type SalesPlanFactWizardInitial =
  | { scope: "all" }
  | { scope: "team"; teamId: string }
  | { scope: "manager"; teamId: string; managerId: string };

type Distribution = "team_only" | "equal" | "manual" | "share_prev";

type Phase = "target" | "kpi" | "distribution";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodId: string;
  state: SalesPlanFactPersistedState;
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null };
  profile: ReleaseDemoProfile;
  initial: SalesPlanFactWizardInitial | null;
  onSubmit: (next: SalesPlanFactPersistedState) => Promise<void>;
  saving: boolean;
};

function parseNum(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function teamsInScope(opts: Props["opts"]) {
  return SALES_TEAMS.filter((t) => inScopeTeam(t.id, opts));
}

function buildPhases(role: SalesRole, targetKind: "all" | "team" | "manager"): Phase[] {
  if (role === "sales_manager") return ["kpi"];
  if (role === "team_lead") return ["kpi", "distribution"];
  if (targetKind === "manager") return ["target", "kpi"];
  return ["target", "kpi", "distribution"];
}

export function SalesPlanFactPlanWizardDialog({
  open,
  onOpenChange,
  periodId,
  state,
  opts,
  profile,
  initial,
  onSubmit,
  saving,
}: Props) {
  const [targetKind, setTargetKind] = useState<"all" | "team" | "manager">("all");
  const phases = useMemo(() => buildPhases(opts.role, targetKind), [opts.role, targetKind]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phase = phases[phaseIdx] ?? "kpi";
  const [teamId, setTeamId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [kpiRaw, setKpiRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(SALES_KPI_METRICS_SORTED.map((m) => [m.id, ""])),
  );
  const [distribution, setDistribution] = useState<Distribution>("team_only");
  const [manual, setManual] = useState<Record<string, Record<string, string>>>({});

  const prevPeriodId = useMemo(() => getPreviousSalesPeriodId(periodId), [periodId]);
  const prevHasPlans = useMemo(
    () => (prevPeriodId ? periodHasAnyPositivePlan(state, prevPeriodId, opts) : false),
    [state, prevPeriodId, opts],
  );

  const scopedTeams = useMemo(() => teamsInScope(opts), [opts]);
  const managersForTeam = useMemo(() => {
    if (!teamId) return [];
    return getTeamManagers(teamId).filter((m) => inScopeManager(m.id, opts));
  }, [teamId, opts]);

  useEffect(() => {
    if (!open) return;
    setPhaseIdx(0);
    const ini = initial;
    if (opts.role === "sales_manager") {
      setTargetKind("manager");
      setTeamId(opts.persona.teamId ?? "");
      setManagerId(opts.persona.id);
    } else if (opts.role === "team_lead") {
      setTargetKind("team");
      setTeamId(opts.persona.teamId ?? scopedTeams[0]?.id ?? "");
      setManagerId("");
    } else if (ini?.scope === "manager") {
      setTargetKind("manager");
      setTeamId(ini.teamId);
      setManagerId(ini.managerId);
    } else if (ini?.scope === "team") {
      setTargetKind("team");
      setTeamId(ini.teamId);
      setManagerId("");
    } else {
      setTargetKind("all");
      setTeamId(scopedTeams[0]?.id ?? "");
      setManagerId("");
    }
    setKpiRaw(Object.fromEntries(SALES_KPI_METRICS_SORTED.map((m) => [m.id, ""])));
    setDistribution("team_only");
    setManual({});
  }, [open, initial, opts.role, opts.persona.teamId, opts.persona.id, scopedTeams]);

  useEffect(() => {
    setPhaseIdx((i) => Math.min(i, Math.max(0, phases.length - 1)));
  }, [phases]);

  useEffect(() => {
    if (!teamId || managersForTeam.length === 0) return;
    setManual((prev) => {
      const next = { ...prev };
      for (const m of managersForTeam) {
        next[m.id] = { ...(next[m.id] ?? {}) };
        for (const met of SALES_KPI_METRICS_SORTED) {
          if (next[m.id][met.id] === undefined) next[m.id][met.id] = "";
        }
      }
      return next;
    });
  }, [teamId, managersForTeam]);

  const readMetrics = useCallback((): Record<string, number> => {
    const o: Record<string, number> = {};
    for (const met of SALES_KPI_METRICS_SORTED) {
      o[met.id] = Math.max(0, parseNum(kpiRaw[met.id] ?? "0"));
    }
    return o;
  }, [kpiRaw]);

  const applyToState = useCallback(
    (publish: boolean): SalesPlanFactPersistedState => {
      const metrics = readMetrics();
      const teamStatus: SalesPlanFactLineStatus = publish ? "published" : "draft";
      const managerStatus: SalesPlanFactLineStatus = publish ? "published" : "draft";
      let next = state;

      const applyTeam = (tid: string) => {
        next = upsertTeamPlanMetrics(next, {
          periodId,
          teamId: tid,
          metricPlans: metrics,
          actorId: profile.personaUserId,
          status: teamStatus,
        });
      };

      const applyManager = (tid: string, mid: string, metId: string, val: number) => {
        const existing = next.lines.find(
          (l) =>
            l.periodId === periodId &&
            l.teamId === tid &&
            l.managerId === mid &&
            l.metricId === metId &&
            l.rollup === "manager",
        );
        next = upsertManagerMetricLine(next, {
          periodId,
          teamId: tid,
          managerId: mid,
          metricId: metId,
          planValue: val,
          actualValue: existing?.actualValue ?? null,
          status: managerStatus,
          actorId: profile.personaUserId,
          comment: existing?.comment ?? "",
        });
      };

      if (targetKind === "manager" && teamId && managerId) {
        for (const met of SALES_KPI_METRICS_SORTED) {
          applyManager(teamId, managerId, met.id, metrics[met.id] ?? 0);
        }
        return next;
      }

      const dist: Distribution =
        targetKind === "all" && distribution === "manual"
          ? "equal"
          : targetKind === "team" && distribution === "manual"
            ? "manual"
            : distribution;

      if (targetKind === "all") {
        const tids = scopedTeams.map((t) => t.id);
        if (dist === "team_only") {
          for (const tid of tids) applyTeam(tid);
        } else if (dist === "equal") {
          for (const tid of tids) {
            const mgrs = getTeamManagers(tid).filter((m) => inScopeManager(m.id, opts));
            const n = Math.max(1, mgrs.length);
            for (const m of mgrs) {
              for (const met of SALES_KPI_METRICS_SORTED) {
                const total = metrics[met.id] ?? 0;
                applyManager(tid, m.id, met.id, Math.round(total / n));
              }
            }
          }
        } else if (dist === "share_prev" && prevPeriodId && prevHasPlans) {
          for (const tid of tids) {
            const mgrs = getTeamManagers(tid).filter((m) => inScopeManager(m.id, opts));
            for (const met of SALES_KPI_METRICS_SORTED) {
              const totalTarget = metrics[met.id] ?? 0;
              const weights = mgrs.map((m) => {
                const L = state.lines.find(
                  (l) =>
                    l.periodId === prevPeriodId &&
                    l.teamId === tid &&
                    l.managerId === m.id &&
                    l.metricId === met.id &&
                    l.rollup === "manager",
                );
                return Math.max(0, L?.planValue ?? 0);
              });
              const sumW = weights.reduce((a, b) => a + b, 0);
              if (sumW <= 0) {
                const n = Math.max(1, mgrs.length);
                for (const m of mgrs) applyManager(tid, m.id, met.id, Math.round(totalTarget / n));
              } else {
                mgrs.forEach((m, i) => {
                  applyManager(tid, m.id, met.id, Math.round((totalTarget * weights[i]) / sumW));
                });
              }
            }
          }
        }
        return next;
      }

      if (targetKind === "team" && teamId) {
        if (dist === "team_only") {
          applyTeam(teamId);
        } else if (dist === "equal") {
          const mgrs = managersForTeam;
          const n = Math.max(1, mgrs.length);
          for (const m of mgrs) {
            for (const met of SALES_KPI_METRICS_SORTED) {
              const total = metrics[met.id] ?? 0;
              applyManager(teamId, m.id, met.id, Math.round(total / n));
            }
          }
        } else if (dist === "manual") {
          for (const m of managersForTeam) {
            for (const met of SALES_KPI_METRICS_SORTED) {
              const raw = manual[m.id]?.[met.id] ?? "0";
              applyManager(teamId, m.id, met.id, Math.max(0, parseNum(raw)));
            }
          }
        } else if (dist === "share_prev" && prevPeriodId && prevHasPlans) {
          const mgrs = managersForTeam;
          for (const met of SALES_KPI_METRICS_SORTED) {
            const totalTarget = metrics[met.id] ?? 0;
            const weights = mgrs.map((m) => {
              const L = state.lines.find(
                (l) =>
                  l.periodId === prevPeriodId &&
                  l.teamId === teamId &&
                  l.managerId === m.id &&
                  l.metricId === met.id &&
                  l.rollup === "manager",
              );
              return Math.max(0, L?.planValue ?? 0);
            });
            const sumW = weights.reduce((a, b) => a + b, 0);
            if (sumW <= 0) {
              const n = Math.max(1, mgrs.length);
              for (const m of mgrs) applyManager(teamId, m.id, met.id, Math.round(totalTarget / n));
            } else {
              mgrs.forEach((m, i) => {
                applyManager(teamId, m.id, met.id, Math.round((totalTarget * weights[i]) / sumW));
              });
            }
          }
        }
      }

      return next;
    },
    [
      state,
      periodId,
      profile.personaUserId,
      readMetrics,
      targetKind,
      teamId,
      managerId,
      distribution,
      scopedTeams,
      opts,
      managersForTeam,
      manual,
      prevPeriodId,
      prevHasPlans,
    ],
  );

  const canGoFromTarget =
    targetKind === "all" || (targetKind === "team" && Boolean(teamId)) || (targetKind === "manager" && Boolean(teamId && managerId));

  const showDistPhase = targetKind !== "manager";
  const manualAllowed = targetKind === "team";

  const goNext = () => {
    if (phaseIdx >= phases.length - 1) return;
    if (phase === "target" && !canGoFromTarget) return;
    setPhaseIdx((i) => Math.min(phases.length - 1, i + 1));
  };

  const goBack = () => setPhaseIdx((i) => Math.max(0, i - 1));

  const isLastPhase = phaseIdx >= phases.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-sales-plan-fact-plan-wizard">
        <DialogHeader>
          <DialogTitle>Выставить план</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          data-testid="form-sales-plan-fact-plan-wizard"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {phase === "target" ? (
            <div className="space-y-3" data-testid="step-sales-plan-fact-plan-target">
              <p className="text-sm text-muted-foreground">Шаг 1. Кому ставим план?</p>
              <RadioGroup value={targetKind} onValueChange={(v) => setTargetKind(v as typeof targetKind)} className="grid gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3">
                  <RadioGroupItem value="all" id="wiz-all" />
                  <span className="text-sm">Все РОПы</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3">
                  <RadioGroupItem value="team" id="wiz-team" />
                  <span className="text-sm">Конкретный РОП / команда</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3">
                  <RadioGroupItem value="manager" id="wiz-mgr" />
                  <span className="text-sm">Конкретный менеджер</span>
                </label>
              </RadioGroup>
              {targetKind === "team" ? (
                <div>
                  <Label>Команда</Label>
                  <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {targetKind === "manager" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label>Команда</Label>
                    <Select
                      value={teamId}
                      onValueChange={(v) => {
                        setTeamId(v);
                        setManagerId("");
                      }}
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {scopedTeams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Менеджер</Label>
                    <Select value={managerId} onValueChange={setManagerId}>
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        {getTeamManagers(teamId)
                          .filter((m) => inScopeManager(m.id, opts))
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "kpi" ? (
            <div className="space-y-3" data-testid="step-sales-plan-fact-plan-kpi">
              <p className="text-sm text-muted-foreground">
                {opts.role === "sales_manager"
                  ? "Ваши KPI за период"
                  : opts.role === "team_lead"
                    ? "Шаг 1. KPI команды"
                    : "Шаг 2. KPI"}
              </p>
              {opts.role === "team_lead" ? (
                <p className="text-xs text-muted-foreground">
                  Команда: {scopedTeams.find((t) => t.id === teamId)?.name ?? teamId}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {SALES_KPI_METRICS_SORTED.map((met) => (
                  <div key={met.id}>
                    <Label className="text-xs">{met.label}</Label>
                    <Input
                      className="mt-1"
                      inputMode="decimal"
                      value={kpiRaw[met.id] ?? ""}
                      onChange={(e) => setKpiRaw((p) => ({ ...p, [met.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {phase === "distribution" && showDistPhase ? (
            <div className="space-y-3" data-testid="step-sales-plan-fact-plan-distribution">
              <p className="text-sm text-muted-foreground">
                {opts.role === "team_lead" ? "Шаг 2. Распределение" : "Шаг 3. Распределение"}
              </p>
              <RadioGroup value={distribution} onValueChange={(v) => setDistribution(v as Distribution)} className="grid gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2">
                  <RadioGroupItem value="team_only" id="dist-team" />
                  <span className="text-sm">Оставить на уровне команды</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2">
                  <RadioGroupItem value="equal" id="dist-eq" />
                  <span className="text-sm">Поровну по менеджерам</span>
                </label>
                {manualAllowed ? (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2">
                    <RadioGroupItem value="manual" id="dist-man" />
                    <span className="text-sm">Вручную по менеджерам</span>
                  </label>
                ) : null}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2">
                  <RadioGroupItem value="share_prev" id="dist-share" disabled={!prevPeriodId || !prevHasPlans} />
                  <span className="text-sm text-muted-foreground">По доле прошлого периода</span>
                </label>
              </RadioGroup>
              {distribution === "manual" && manualAllowed ? (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                  {managersForTeam.map((m) => (
                    <div key={m.id} className="space-y-1">
                      <p className="text-xs font-medium">{m.name}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {SALES_KPI_METRICS_SORTED.map((met) => (
                          <Input
                            key={met.id}
                            className="h-8 text-xs"
                            inputMode="decimal"
                            placeholder={met.label}
                            value={manual[m.id]?.[met.id] ?? ""}
                            onChange={(e) =>
                              setManual((prev) => ({
                                ...prev,
                                [m.id]: { ...(prev[m.id] ?? {}), [met.id]: e.target.value },
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Отмена
            </Button>
            {phaseIdx > 0 ? (
              <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
                Назад
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!isLastPhase ? (
              <Button
                type="button"
                className="bg-primary"
                disabled={saving || (phase === "target" && !canGoFromTarget)}
                onClick={goNext}
              >
                Далее
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="button-sales-plan-fact-plan-save-draft"
                  disabled={saving}
                  onClick={() => void onSubmit(applyToState(false))}
                >
                  Сохранить черновик
                </Button>
                <Button
                  type="button"
                  className="bg-primary"
                  data-testid="button-sales-plan-fact-plan-publish"
                  disabled={saving}
                  onClick={() => void onSubmit(applyToState(true))}
                >
                  Выгрузить РОПу
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
