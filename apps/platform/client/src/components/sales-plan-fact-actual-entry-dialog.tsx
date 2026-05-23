import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  getTeamManagers,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  SALES_TEAMS,
  type SalesRole,
  type SalesUser,
} from "@/lib/sales-control-data";
import { inScopeManager, inScopeTeam } from "@/lib/sales-plan-fact-management-view-model";
import { upsertManagerMetricLine } from "@/lib/sales-plan-fact-mutations";
import type { SalesPlanFactPersistedState } from "@/lib/sales-plan-fact-types";

export type SalesPlanFactActualInitial = {
  periodId?: string;
  teamId?: string;
  managerId?: string;
  metricId?: string;
} | null;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodId: string;
  state: SalesPlanFactPersistedState;
  opts: { role: SalesRole; persona: SalesUser; directorTeamFilter: string | null };
  profile: ReleaseDemoProfile;
  initial: SalesPlanFactActualInitial;
  onSubmit: (next: SalesPlanFactPersistedState) => Promise<void>;
  saving: boolean;
};

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(String(t).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function SalesPlanFactActualEntryDialog({
  open,
  onOpenChange,
  periodId: outerPeriodId,
  state,
  opts,
  profile,
  initial,
  onSubmit,
  saving,
}: Props) {
  const [periodId, setPeriodId] = useState(outerPeriodId);
  const [teamId, setTeamId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [metricId, setMetricId] = useState(SALES_KPI_METRICS_SORTED[0]?.id ?? "");
  const [actualRaw, setActualRaw] = useState("");
  const [comment, setComment] = useState("");

  const teams = useMemo(() => SALES_TEAMS.filter((t) => inScopeTeam(t.id, opts)), [opts]);

  useEffect(() => {
    if (!open) return;
    setPeriodId(initial?.periodId ?? outerPeriodId);
    setTeamId(initial?.teamId ?? teams[0]?.id ?? "");
    setManagerId(initial?.managerId ?? "");
    setMetricId(initial?.metricId ?? SALES_KPI_METRICS_SORTED[0]?.id ?? "");
  }, [open, initial, outerPeriodId, teams]);

  const existing = useMemo(() => {
    if (!teamId || !managerId || !metricId) return null;
    return state.lines.find(
      (l) =>
        l.periodId === periodId &&
        l.teamId === teamId &&
        l.managerId === managerId &&
        l.metricId === metricId &&
        l.rollup === "manager",
    );
  }, [state.lines, periodId, teamId, managerId, metricId]);

  useEffect(() => {
    if (!open) return;
    if (existing?.actualValue !== null && existing?.actualValue !== undefined) {
      setActualRaw(String(existing.actualValue));
    } else {
      setActualRaw("");
    }
    setComment(existing?.comment ?? "");
  }, [open, existing]);

  const managers = useMemo(() => {
    if (!teamId) return [];
    return getTeamManagers(teamId).filter((m) => inScopeManager(m.id, opts));
  }, [teamId, opts]);

  const save = () => {
    const av = parseNum(actualRaw);
    if (!teamId || !managerId || !metricId || av === null) return;
    const existingPlan = state.lines.find(
      (l) =>
        l.periodId === periodId &&
        l.teamId === teamId &&
        l.managerId === managerId &&
        l.metricId === metricId &&
        l.rollup === "manager",
    );
    const planValue = existingPlan?.planValue ?? 0;
    const next = upsertManagerMetricLine(state, {
      periodId,
      teamId,
      managerId,
      metricId,
      planValue,
      actualValue: av,
      status: "fact_entered",
      actorId: profile.personaUserId,
      comment: comment.trim(),
    });
    void onSubmit(next);
  };

  const hasFact = existing?.actualValue !== null && existing?.actualValue !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-sales-plan-fact-actual-entry">
        <DialogHeader>
          <DialogTitle>{hasFact ? "Обновить факт" : "Внести факт"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          data-testid="form-sales-plan-fact-actual-entry"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            <Label>Период</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALES_PLAN_PERIODS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>РОП / команда</Label>
            <Select value={teamId} onValueChange={(v) => { setTeamId(v); setManagerId(""); }}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
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
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>KPI</Label>
            <Select value={metricId} onValueChange={setMetricId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALES_KPI_METRICS_SORTED.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Факт</Label>
            <Input className="mt-1" inputMode="decimal" value={actualRaw} onChange={(e) => setActualRaw(e.target.value)} />
          </div>
          <div>
            <Label>Комментарий</Label>
            <Textarea className="mt-1 min-h-[72px]" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button type="button" className="bg-primary" data-testid="button-sales-plan-fact-actual-save" disabled={saving} onClick={save}>
            {hasFact ? "Обновить факт" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
