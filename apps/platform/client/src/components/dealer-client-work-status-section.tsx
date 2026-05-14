import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  manager: string;
  rop: string;
  city: string;
  categoryLabel: string;
  activityStatus: string;
  hasOpenShowcaseTasks: boolean;
  hasShowcaseDeficit: boolean;
  lastActivityLabel: string;
};

export function DealerClientWorkStatusSection({
  manager,
  rop,
  city,
  categoryLabel,
  activityStatus,
  hasOpenShowcaseTasks,
  hasShowcaseDeficit,
  lastActivityLabel,
}: Props) {
  return (
    <section data-testid="section-dealer-work-status" className="scroll-mt-28 space-y-3 sm:scroll-mt-32">
      <Card className="rounded-2xl border border-primary/25 bg-primary/5 shadow-md">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base sm:text-lg">Рабочий статус по клиенту</CardTitle>
          <CardDescription>Краткая сводка для ежедневной работы по витрине и дистрибуции.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Менеджер</p>
            <p className="mt-1 text-sm font-semibold text-foreground" data-testid="text-dealer-work-status-manager">
              {manager}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">РОП</p>
            <p className="mt-1 text-sm font-semibold text-foreground" data-testid="text-dealer-work-status-rop">
              {rop}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Город</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{city}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Категория</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{categoryLabel}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Статус активности</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{activityStatus}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Задачи по витрине</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {hasOpenShowcaseTasks ? "Есть открытые" : "Нет открытых"}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Дефицит по витрине</p>
            <p className={cn("mt-1 text-sm font-semibold", hasShowcaseDeficit ? "text-amber-900" : "text-foreground")}>
              {hasShowcaseDeficit ? "Да" : "Нет"}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3 sm:col-span-2 lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Дата последнего события в истории
            </p>
            <p
              className="mt-1 text-sm font-semibold text-foreground"
              data-testid="text-dealer-work-status-last-activity"
            >
              {lastActivityLabel}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
