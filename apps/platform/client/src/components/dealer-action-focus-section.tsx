import { Link } from "wouter";
import { AlertCircle, CalendarClock, ClipboardList, LayoutGrid, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildHashPath } from "@/lib/hash-route-utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { clientNextStepActionLabel, type ClientNextStepRecord } from "@/lib/client-next-step-data";
import { canViewShowcaseDistribution } from "@/lib/showcase-distribution-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { cn } from "@/lib/utils";

function formatIsoDayToRu(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

const focusCardClass =
  "group flex w-full min-w-0 gap-2 rounded-lg border border-border/70 bg-card/80 p-2.5 text-left transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  primaryLine: string;
  openShowcaseTasks: number;
  hasDeficit: boolean;
  deficitTotal: number;
  nextStep: ClientNextStepRecord | null;
  nextStepOverdue: boolean;
  lastActivityLabel: string;
  onScrollToNextStep: () => void;
  onScrollToShowcase: () => void;
  onScrollToHistory: () => void;
  onOpenShowcaseDeficitFilter: () => void;
};

export function DealerActionFocusSection({
  row,
  profile,
  primaryLine,
  openShowcaseTasks,
  hasDeficit,
  deficitTotal,
  nextStep,
  nextStepOverdue,
  lastActivityLabel,
  onScrollToNextStep,
  onScrollToShowcase,
  onScrollToHistory,
  onOpenShowcaseDeficitFilter,
}: Props) {
  const canShowcase = canViewShowcaseDistribution(profile, row);

  const nextStepLine = nextStep
    ? `${clientNextStepActionLabel(nextStep.actionType)} · ${formatIsoDayToRu(nextStep.contactDate)}${nextStepOverdue ? " · просрочено" : ""}`
    : "Следующий шаг не запланирован — зафиксируйте дату контакта.";

  return (
    <section
      id="dealer-section-action-focus"
      data-testid="section-dealer-action-focus"
      className="scroll-mt-28 space-y-3 sm:scroll-mt-32"
    >
      <Card className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/6 to-card shadow-xs">
        <CardHeader className="space-y-1.5 p-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm sm:text-base">Что сделать сейчас</CardTitle>
            {nextStepOverdue ? (
              <Badge variant="destructive" className="font-semibold">
                Просрочено
              </Badge>
            ) : null}
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Сводка по витрине и запланированному контакту — начните отсюда.
          </CardDescription>
          {!canShowcase ? (
            <p className="text-sm font-medium text-muted-foreground">
              Витрина и задачи по этому клиенту в кабинете недоступны для текущего доступа — блок ниже остаётся для навигации.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0">
          <p
            className="text-sm font-semibold leading-snug text-foreground"
            data-testid="text-dealer-action-focus-primary"
          >
            {primaryLine}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              data-testid="link-dealer-focus-next-step"
              className={cn(focusCardClass, "cursor-pointer")}
              onClick={onScrollToNextStep}
            >
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Следующий шаг</p>
                  <span className="text-[10px] font-medium text-primary opacity-90 group-hover:opacity-100">Открыть →</span>
                </div>
                <p
                  className={cn(
                    "mt-1 text-sm font-medium leading-snug",
                    nextStepOverdue ? "text-destructive" : "text-foreground",
                  )}
                  data-testid="text-dealer-action-focus-next-step"
                >
                  {nextStepLine}
                </p>
              </div>
            </button>

            <Link
              href={buildHashPath("/tasks", { dealerId: row.id })}
              data-testid="link-dealer-focus-showcase-tasks"
              className={cn(focusCardClass, "cursor-pointer")}
            >
              <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Задачи по витрине</p>
                  <span className="text-[10px] font-medium text-primary opacity-90 group-hover:opacity-100">Открыть →</span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground" data-testid="text-dealer-action-focus-showcase-tasks">
                  {canShowcase
                    ? openShowcaseTasks > 0
                      ? `Открыто: ${openShowcaseTasks}`
                      : "Открытых нет"
                    : "Нет доступа к витрине в этом профиле"}
                </p>
              </div>
            </Link>

            <button
              type="button"
              data-testid="button-dealer-focus-deficit"
              disabled={!canShowcase}
              className={cn(focusCardClass, "sm:col-span-2", canShowcase ? "cursor-pointer" : "cursor-not-allowed opacity-60")}
              onClick={() => {
                if (!canShowcase) return;
                onOpenShowcaseDeficitFilter();
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Дефицит по витрине</p>
                  {canShowcase ? (
                    <span className="text-[10px] font-medium text-primary opacity-90 group-hover:opacity-100">Открыть →</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground" data-testid="text-dealer-action-focus-deficit">
                  {canShowcase ? (hasDeficit ? `Да · всего единиц: ${deficitTotal}` : "Нет") : "—"}
                </p>
              </div>
            </button>

            <button
              type="button"
              data-testid="button-dealer-focus-last-event"
              className={cn(focusCardClass, "cursor-pointer sm:col-span-2")}
              onClick={onScrollToHistory}
            >
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Последнее событие</p>
                  <span className="text-[10px] font-medium text-primary opacity-90 group-hover:opacity-100">Открыть →</span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{lastActivityLabel}</p>
              </div>
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={buildHashPath("/tasks", { dealerId: row.id })}
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "min-h-10 w-full shrink-0 justify-center text-sm font-semibold sm:min-h-9 sm:w-auto",
              )}
              data-testid="link-dealer-action-open-tasks"
            >
              Открыть задачи клиента
            </Link>
            <Button
              type="button"
              variant="secondary"
              className="min-h-10 w-full text-sm font-semibold sm:min-h-9 sm:w-auto"
              data-testid="button-dealer-action-scroll-next-step"
              onClick={onScrollToNextStep}
            >
              Запланировать следующий шаг
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full border-border bg-card text-sm font-semibold sm:min-h-9 sm:w-auto"
              data-testid="button-dealer-action-scroll-showcase"
              onClick={onScrollToShowcase}
            >
              <LayoutGrid className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Перейти к витрине
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
