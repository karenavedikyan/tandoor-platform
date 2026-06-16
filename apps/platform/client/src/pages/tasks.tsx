import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { LayoutGrid, List, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { cn } from "@/lib/utils";
import {
  getAllMatrixTasks,
  getManagementFactualShowcaseTasksForDealers,
  getShowcaseDistributionPlanTasksForDealers,
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";
import { fetchShowcaseMatrixDeficitTasksForDealers } from "@/lib/showcase-matrix-deficit-tasks";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { useDealerBaseRows } from "@/lib/dealer-base-source";
import {
  getManagersForRopTeam,
  getRopOptions,
  isRopOrManagerAllFilter,
  managerDisplayMatchesCatalogName,
} from "@/lib/rop-manager-filters";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import {
  initialRopManagerForProfile,
  managerOptionsForProfile,
  mapSalesRoleToDealerBaseAccess,
  ropOptionsForProfile,
  type DealerBaseAccessRole,
} from "@/lib/dealer-base-role-views";
import { useRoleScopedDealerRowsAuto } from "@/hooks/use-role-scoped-dealer-rows-auto";
import { SHOWCASE_STORAGE_EVENT } from "@/lib/showcase-distribution-data";
import { SHOWCASE_MATRIX_CHANGED_EVENT } from "@/lib/trade-point-showcase-matrix-storage";
import {
  SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import { getShowcaseOnlyTasks, getTaskCategoryMeta } from "@/lib/task-classification";
import { taskMatchesUrgentPresetForBadge } from "@/lib/task-presets";
import { useRouteSearchParams, buildHashPath } from "@/lib/hash-route-utils";
import { getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getAllSalesManagers, getSalesUserById } from "@/lib/sales-control-data";
import {
  buildCatalogProductSearchHaystack,
  CATALOG_PRODUCTS,
  getProductById,
} from "@/lib/catalog-data";
import { resolveTradePointMatrixModels } from "@/lib/trade-point-matrix-resolver";

type ViewMode = "cards" | "list";

/** Максимум карточек/строк задач в DOM; фильтры и поиск по полному списку. */
const TASKS_DISPLAY_LIMIT = 300;

type ShowcaseTasksViewId = "all" | "urgent" | "overdue" | "in_progress" | "done" | "needs_rop";

const SHOWCASE_VIEW_CHIPS: {
  id: ShowcaseTasksViewId;
  label: string;
  testId: string;
}[] = [
  { id: "all", label: "Все витринные", testId: "chip-tasks-showcase-all" },
  { id: "urgent", label: "Горящие", testId: "chip-tasks-showcase-urgent" },
  { id: "overdue", label: "Просроченные", testId: "chip-tasks-showcase-overdue" },
  { id: "in_progress", label: "В работе", testId: "chip-tasks-showcase-in-progress" },
  { id: "done", label: "Выполненные", testId: "chip-tasks-showcase-done" },
  { id: "needs_rop", label: "Нужна помощь РОПа", testId: "chip-tasks-showcase-needs-rop" },
];

function tasksUrlTeamAllowed(teamId: string, profile: ReleaseDemoProfile, access: DealerBaseAccessRole): boolean {
  if (!getRopOptions().some((o) => o.teamId === teamId)) return false;
  if (access === "sales_director") return true;
  if (access === "team_lead") return teamId === getEffectiveTeamLeadTeamId(profile);
  const u = getSalesUserById(profile.personaUserId);
  return Boolean(u?.teamId === teamId);
}

function tasksUrlManagerAllowed(
  managerId: string,
  ropTeamId: string,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): boolean {
  if (access === "sales_manager") {
    return getSalesUserById(profile.personaUserId)?.id === managerId;
  }
  const pool =
    access === "sales_director" && isRopOrManagerAllFilter(ropTeamId)
      ? getAllSalesManagers()
      : getManagersForRopTeam(ropTeamId);
  return pool.some((m) => m.id === managerId);
}

function statusTone(s: MatrixTaskWithContext["status"]) {
  if (s === "new") return "border-primary/40 bg-primary/10 text-primary";
  if (s === "in_progress") return "border-border bg-muted/70 text-foreground";
  if (s === "overdue") return "border-primary/30 bg-muted text-foreground";
  return "border-border bg-muted/50 text-muted-foreground";
}

function priorityTone(p: MatrixTaskWithContext["priority"]) {
  if (p === "high") return "border-primary/40 bg-primary/10 text-primary";
  if (p === "medium") return "border-border bg-muted/70 text-foreground";
  return "border-border bg-muted text-muted-foreground";
}

function applyShowcaseView(
  tasks: MatrixTaskWithContext[],
  view: ShowcaseTasksViewId,
  now: Date,
): MatrixTaskWithContext[] {
  switch (view) {
    case "all":
      return tasks;
    case "urgent":
      return tasks.filter((t) => taskMatchesUrgentPresetForBadge(t, now));
    case "overdue":
      return tasks.filter((t) => t.status === "overdue");
    case "in_progress":
      return tasks.filter(
        (t) =>
          (t.status === "in_progress" && t.showcaseExtraStatus !== "needs_rop") ||
          t.showcaseExtraStatus === "postponed",
      );
    case "done":
      return tasks.filter((t) => t.status === "done");
    case "needs_rop":
      return tasks.filter((t) => t.showcaseExtraStatus === "needs_rop");
    default:
      return tasks;
  }
}

function countShowcaseView(tasks: MatrixTaskWithContext[], view: ShowcaseTasksViewId, now: Date): number {
  return applyShowcaseView(tasks, view, now).length;
}

function computeShowcaseTaskKpis(tasks: MatrixTaskWithContext[]) {
  let newCount = 0;
  let inProgress = 0;
  let overdue = 0;
  let done = 0;
  let needsRop = 0;
  for (const t of tasks) {
    if (t.status === "done") {
      done += 1;
      continue;
    }
    if (t.status === "overdue") {
      overdue += 1;
      continue;
    }
    if (t.showcaseExtraStatus === "needs_rop") {
      needsRop += 1;
      continue;
    }
    if (t.status === "in_progress") {
      inProgress += 1;
      continue;
    }
    if (t.status === "new" && t.showcaseExtraStatus === "postponed") {
      inProgress += 1;
      continue;
    }
    if (t.status === "new" && t.showcaseExtraStatus !== "postponed") {
      newCount += 1;
    }
  }
  return {
    total: tasks.length,
    newCount,
    inProgress,
    overdue,
    done,
    needsRop,
  };
}

function applySearch(tasks: MatrixTaskWithContext[], q: string) {
  const norm = q.trim().toLowerCase();
  if (!norm) return tasks;
  return tasks.filter((t) => {
    return (
      t.dealerName.toLowerCase().includes(norm) ||
      t.tradePointName.toLowerCase().includes(norm) ||
      t.productName.toLowerCase().includes(norm) ||
      t.productArticle.toLowerCase().includes(norm) ||
      t.title.toLowerCase().includes(norm)
    );
  });
}

function sortTasks(tasks: MatrixTaskWithContext[]) {
  const statusOrder = (s: MatrixTaskWithContext["status"]) => {
    if (s === "overdue") return 0;
    if (s === "new") return 1;
    if (s === "in_progress") return 2;
    return 3;
  };
  const priorityOrder = (p: MatrixTaskWithContext["priority"]) => {
    if (p === "high") return 0;
    if (p === "medium") return 1;
    return 2;
  };
  return [...tasks].sort((a, b) => {
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    const po = priorityOrder(a.priority) - priorityOrder(b.priority);
    if (po !== 0) return po;
    return a.taskId.localeCompare(b.taskId);
  });
}

function managerLabelForDealer(dealerId: string, dealerById: Map<string, DealerRow>): string {
  const d = dealerById.get(dealerId);
  if (!d) return "—";
  const u = d.releaseManagerId ? getSalesUserById(d.releaseManagerId) : undefined;
  return u?.name ?? d.manager ?? "—";
}

/** Безопасный суффикс для data-testid (taskId может содержать `|`, `/` и т.д.). */
function safeShowcaseTaskSlug(taskId: string): string {
  const s = taskId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s.length > 0 ? s : "task";
}

function findCatalogImageByProductNameHint(productName: string): string {
  const raw = productName.trim();
  if (raw.length < 2) return "";
  const n = raw.toLowerCase();
  const tokens = n
    .split(/[\s/·.,:;|–—()-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    .slice(0, 5);
  if (!tokens.length) return "";
  let i = 0;
  for (const p of CATALOG_PRODUCTS) {
    i += 1;
    if (i > 400) break;
    const h = buildCatalogProductSearchHaystack(p);
    if (tokens.some((t) => h.includes(t))) return p.image?.trim() ?? "";
  }
  return "";
}

function resolveShowcaseTaskDoorImage(
  task: MatrixTaskWithContext,
  dealer: DealerRow | undefined,
): string {
  const direct = getProductById(task.productId)?.image?.trim() ?? "";
  if (direct) return direct;
  const matrixStored = task.showcaseMatrixImageSrc?.trim() ?? "";
  if (matrixStored) return matrixStored;
  if (dealer) {
    try {
      const tp = dealer.tradePoints.find((p) => p.id === task.tradePointId);
      const models = resolveTradePointMatrixModels({
        dealerId: task.dealerId,
        tradePointId: task.tradePointId,
        clientCategory: dealer.clientCategory,
        region: dealer.region,
        city: tp?.city ?? dealer.city,
      });
      const byId = models.find((m) => m.id === task.productId);
      const byName = models.find((m) => m.name.trim() === task.productName.trim());
      const m = byId ?? byName;
      if (m?.imageUrl?.trim()) return m.imageUrl.trim();
      if (m?.id) {
        const img = getProductById(m.id)?.image?.trim() ?? "";
        if (img) return img;
      }
    } catch {
      /* ignore */
    }
  }
  return findCatalogImageByProductNameHint(task.productName);
}

function modelTitleForShowcaseTask(task: MatrixTaskWithContext): string {
  return getProductById(task.productId)?.name?.trim() || task.productName;
}

function showcaseTaskVisualShell(task: MatrixTaskWithContext, urgent: boolean): string {
  if (task.status === "done") {
    return "border-border/60 bg-muted/20 opacity-[0.92] ring-1 ring-border/25";
  }
  if (task.showcaseExtraStatus === "needs_rop") {
    return "border-violet-300/75 bg-violet-50/45 ring-1 ring-violet-200/55";
  }
  if (task.status === "overdue") {
    return "border-rose-300/85 bg-rose-50/35 ring-1 ring-rose-200/60";
  }
  if (urgent && task.status === "new") {
    return "border-amber-400/80 bg-amber-50/40 ring-1 ring-amber-300/45";
  }
  if (task.status === "new") {
    return "border-primary/30 bg-primary/[0.06] ring-1 ring-primary/20";
  }
  if (task.status === "in_progress" || task.showcaseExtraStatus === "postponed") {
    return "border-amber-200/90 bg-amber-50/25";
  }
  return "border-border/80 bg-card";
}

function TaskDoorPhoto({
  src,
  slug,
  frameClass,
  densePlaceholder,
}: {
  src: string;
  slug: string;
  frameClass: string;
  densePlaceholder?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/40",
        frameClass,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          data-testid={`img-showcase-task-${slug}`}
          className={cn(
            "absolute inset-0 box-border h-full w-full object-contain object-center",
            densePlaceholder ? "p-0.5" : "p-2",
          )}
          loading="lazy"
        />
      ) : (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-muted-foreground",
            densePlaceholder ? "text-[8px]" : "text-[9px]",
          )}
        >
          Нет фото
        </span>
      )}
    </div>
  );
}

function ShowcaseTasksKpis({
  tasks,
  variant,
}: {
  tasks: MatrixTaskWithContext[];
  variant: "legacy" | "management_factual";
}) {
  const k = useMemo(() => computeShowcaseTaskKpis(tasks), [tasks]);
  const sectionTid = variant === "management_factual" ? "section-showcase-tasks-kpi" : "section-tasks-kpis";
  const tiles: {
    label: string;
    value: number;
    tone: string;
    testId?: string;
  }[] = [
    {
      label: "Всего витринных",
      value: k.total,
      tone: "border-border bg-muted/40 text-foreground",
      testId: variant === "management_factual" ? "card-showcase-tasks-total" : undefined,
    },
    {
      label: "Новые",
      value: k.newCount,
      tone: "border-primary/40 bg-primary/10 text-primary",
      testId: variant === "management_factual" ? "card-showcase-tasks-new" : undefined,
    },
    {
      label: "В работе",
      value: k.inProgress,
      tone: "border-amber-200 bg-amber-50 text-amber-950",
      testId: variant === "management_factual" ? "card-showcase-tasks-in-progress" : undefined,
    },
    {
      label: "Просроченные",
      value: k.overdue,
      tone: "border-red-200 bg-red-50 text-red-900",
      testId: variant === "management_factual" ? "card-showcase-tasks-overdue" : undefined,
    },
    {
      label: "Выполненные",
      value: k.done,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      testId: variant === "management_factual" ? "card-showcase-tasks-done" : undefined,
    },
    {
      label: "Нужна помощь РОПа",
      value: k.needsRop,
      tone: "border-violet-200 bg-violet-50 text-violet-950",
      testId: variant === "management_factual" ? "card-showcase-tasks-needs-rop" : undefined,
    },
  ];
  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-md" data-testid={sectionTid}>
      <CardContent className="space-y-3 pt-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => (
            <div
              key={t.label}
              className={cn("rounded-xl border px-3 py-2.5", t.tone)}
              {...(t.testId ? { "data-testid": t.testId } : {})}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{t.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
        {variant === "management_factual" ? (
          <p className="text-xs text-muted-foreground" data-testid="text-showcase-tasks-source-note">
            Источник: сохранённые задачи актуализации
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ShowcaseTaskCard({
  task,
  dealerById,
  presetClock,
}: {
  task: MatrixTaskWithContext;
  dealerById: Map<string, DealerRow>;
  presetClock: Date;
}) {
  const catMeta = getTaskCategoryMeta("showcase");
  const deficit = Math.max(0, task.targetSamples - task.actualSamples);
  const urgent = taskMatchesUrgentPresetForBadge(task, presetClock);
  const manager = managerLabelForDealer(task.dealerId, dealerById);
  const dealer = dealerById.get(task.dealerId);
  const img = resolveShowcaseTaskDoorImage(task, dealer);
  const slug = safeShowcaseTaskSlug(task.taskId);
  const modelTitle = modelTitleForShowcaseTask(task);
  const shell = showcaseTaskVisualShell(task, urgent);
  const canOpenShowcaseTp = Boolean(task.tradePointId?.trim());

  return (
    <div data-testid={`card-showcase-task-${slug}`} className="min-w-0">
      <Card
        className={cn("min-w-0 overflow-hidden rounded-2xl border shadow-md border-l-4", catMeta.borderLeftClass, shell)}
        data-testid={`card-task-${task.taskId}`}
      >
        <CardContent className="flex min-w-0 flex-col gap-3 p-0">
          <div className="relative w-full shrink-0 border-b border-border/50 bg-muted/20">
            <TaskDoorPhoto src={img} slug={slug} frameClass="h-44 w-full sm:h-48" />
          </div>
          <div className="space-y-3 px-4 pb-4 pt-1">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground" title={modelTitle}>
                  {modelTitle}
                </p>
                <p className="mt-1 text-xs font-semibold leading-snug text-foreground">{task.dealerName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Менеджер: {manager}</p>
                {task.source === "showcase_matrix_deficit" || task.source === "showcase_actualization_persisted" ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">Точка: {task.tradePointName}</p>
                ) : null}
              </div>
              <div className="flex max-w-[11rem] shrink-0 flex-col items-end gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("font-medium", catMeta.badgeClass)}
                  data-testid={`badge-task-category-${task.taskId}`}
                  data-task-category="showcase"
                >
                  Витрина
                </Badge>
                {urgent ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-950"
                    data-testid={`badge-task-preset-urgent-${task.taskId}`}
                  >
                    Горящая
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-medium", statusTone(task.status))}
                  data-testid={`badge-showcase-task-status-${slug}`}
                >
                  {MATRIX_TASK_STATUS_LABEL[task.status]}
                </Badge>
                {task.showcaseExtraStatus === "needs_rop" ? (
                  <Badge variant="outline" className="border-violet-300 bg-violet-50 text-[10px] font-medium text-violet-950">
                    Нужна помощь РОПа
                  </Badge>
                ) : null}
                {task.showcaseExtraStatus === "postponed" ? (
                  <Badge variant="outline" className="border-border bg-muted text-[10px] font-medium">
                    Отложена
                  </Badge>
                ) : null}
                <Badge variant="outline" className={cn("text-[10px] font-medium", priorityTone(task.priority))}>
                  {MATRIX_TASK_PRIORITY_LABEL[task.priority]}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {task.source === "showcase_matrix_deficit" || task.source === "showcase_actualization_persisted"
                    ? "Модель / зона"
                    : "Категория витрины"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs font-medium text-foreground">{task.productName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">План</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{task.targetSamples}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Факт</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{task.actualSamples}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Дефицит</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{deficit}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Срок</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{task.dueDate}</p>
              </div>
            </div>

            <p className="line-clamp-2 text-xs text-muted-foreground">{task.title}</p>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canOpenShowcaseTp ? (
                <Button
                  asChild
                  variant="default"
                  className="min-h-10 w-full font-semibold sm:w-auto"
                  data-testid={`button-task-open-trade-point-showcase-${task.taskId}`}
                >
                  <Link
                    href={buildHashPath(`/dealers/${task.dealerId}/trade-points/${task.tradePointId}`, {
                      tradePointShowcase: "1",
                    })}
                    data-testid={`button-showcase-task-open-trade-point-${slug}`}
                  >
                    Открыть витрину точки
                  </Link>
                </Button>
              ) : null}
              <Button
                asChild
                variant={canOpenShowcaseTp ? "outline" : "default"}
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid={`button-task-open-client-${task.taskId}`}
              >
                <Link href={`/dealers/${task.dealerId}`} data-testid={`button-showcase-task-open-client-${slug}`}>
                  Открыть клиента
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ShowcaseTaskListRow({
  task,
  dealerById,
  presetClock,
}: {
  task: MatrixTaskWithContext;
  dealerById: Map<string, DealerRow>;
  presetClock: Date;
}) {
  const catMeta = getTaskCategoryMeta("showcase");
  const deficit = Math.max(0, task.targetSamples - task.actualSamples);
  const urgent = taskMatchesUrgentPresetForBadge(task, presetClock);
  const manager = managerLabelForDealer(task.dealerId, dealerById);
  const dealer = dealerById.get(task.dealerId);
  const img = resolveShowcaseTaskDoorImage(task, dealer);
  const slug = safeShowcaseTaskSlug(task.taskId);
  const modelTitle = modelTitleForShowcaseTask(task);
  const shell = showcaseTaskVisualShell(task, urgent);
  const canOpenShowcaseTp = Boolean(task.tradePointId?.trim());

  return (
    <div data-testid={`card-showcase-task-${slug}`} className="min-w-0">
      <Card
        className={cn("min-w-0 overflow-hidden rounded-xl border shadow-sm border-l-4", catMeta.borderLeftClass, shell)}
        data-testid={`card-task-${task.taskId}`}
      >
        <CardContent className="flex min-w-0 flex-row items-stretch gap-3 p-3 sm:items-center sm:justify-between sm:p-3.5">
          <div className="shrink-0 self-center">
            <TaskDoorPhoto src={img} slug={slug} frameClass="h-12 w-10 sm:h-14 sm:w-11" densePlaceholder />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{modelTitle}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{task.dealerName}</span>
                <span className="text-muted-foreground"> · </span>
                Менеджер: {manager}
                {task.source === "showcase_matrix_deficit" || task.source === "showcase_actualization_persisted"
                  ? ` · ${task.tradePointName}`
                  : ""}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-medium", catMeta.badgeClass)}
                  data-testid={`badge-task-category-${task.taskId}`}
                >
                  Витрина
                </Badge>
                {urgent ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-950"
                    data-testid={`badge-task-preset-urgent-${task.taskId}`}
                  >
                    Горящая
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-medium", statusTone(task.status))}
                  data-testid={`badge-showcase-task-status-${slug}`}
                >
                  {MATRIX_TASK_STATUS_LABEL[task.status]}
                </Badge>
                {task.showcaseExtraStatus === "needs_rop" ? (
                  <Badge variant="outline" className="border-violet-300 bg-violet-50 text-[10px] text-violet-950">
                    РОП
                  </Badge>
                ) : null}
                <span className="text-[10px] text-muted-foreground">
                  план {task.targetSamples} · факт {task.actualSamples} · деф. {deficit} · до {task.dueDate}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 self-stretch sm:flex-row sm:items-center">
              {canOpenShowcaseTp ? (
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="h-9 min-h-9 shrink-0 px-3 text-xs font-semibold"
                  data-testid={`button-task-open-trade-point-showcase-${task.taskId}`}
                >
                  <Link
                    href={buildHashPath(`/dealers/${task.dealerId}/trade-points/${task.tradePointId}`, {
                      tradePointShowcase: "1",
                    })}
                    data-testid={`button-showcase-task-open-trade-point-${slug}`}
                  >
                    Витрина
                  </Link>
                </Button>
              ) : null}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 min-h-9 shrink-0 border-border bg-card px-3 text-xs"
                data-testid={`button-task-open-client-${task.taskId}`}
              >
                <Link href={`/dealers/${task.dealerId}`} data-testid={`button-showcase-task-open-client-${slug}`}>
                  Клиент
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TasksPage() {
  const catalogQ = useDealerBaseRows();
  const catalogRows = catalogQ.data ?? DEALER_BASE_ROWS;
  const { profile } = useReleaseDemoProfile();
  const access = useMemo(() => mapSalesRoleToDealerBaseAccess(profile.role), [profile.role]);
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const { publishDashboardRopTeamId } = managementPlane;

  const [showcaseTick, setShowcaseTick] = useState(0);
  const [backendDeficitTasks, setBackendDeficitTasks] = useState<MatrixTaskWithContext[]>([]);

  useEffect(() => {
    const onBump = () => setShowcaseTick((n) => n + 1);
    window.addEventListener(SHOWCASE_STORAGE_EVENT, onBump);
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, onBump);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onBump);
    window.addEventListener(SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT, onBump);
    return () => {
      window.removeEventListener(SHOWCASE_STORAGE_EVENT, onBump);
      window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, onBump);
      window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onBump);
      window.removeEventListener(SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT, onBump);
    };
  }, []);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("cards");
  const [showcaseViewId, setShowcaseViewId] = useState<ShowcaseTasksViewId>("all");
  const [presetClock] = useState(() => new Date());

  const dealerById = useMemo(() => {
    const rows = actx.enabled
      ? buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, { includeArchivedDealers: false })
      : catalogRows;
    return new Map(rows.map((d) => [d.id, d]));
  }, [actx.enabled, managementPlane.mergedState, profile, catalogRows]);
  const [ropTeam, setRopTeam] = useState<string>("all");
  const [mgrFilter, setMgrFilter] = useState<string>("all");

  const routeQs = useRouteSearchParams();
  const routeKey = useMemo(() => routeQs.toString(), [routeQs]);

  const ropSelectOptions = useMemo(() => ropOptionsForProfile(profile, access), [profile, access]);
  const mgrOptions = useMemo(() => managerOptionsForProfile(profile, access, ropTeam), [profile, access, ropTeam]);

  useEffect(() => {
    const d = initialRopManagerForProfile(profile, access);
    if (!routeKey) {
      setRopTeam(d.ropTeam);
      setMgrFilter(d.manager);
      setQuery("");
      setShowcaseViewId("all");
      return;
    }

    let rop = d.ropTeam;
    let mgr = d.manager;
    let qv = "";

    const teamRaw = (routeQs.get("team") ?? routeQs.get("rop"))?.trim() ?? "";
    const managerRaw = routeQs.get("manager")?.trim() ?? "";
    if (teamRaw && tasksUrlTeamAllowed(teamRaw, profile, access)) {
      rop = teamRaw;
      mgr = "all";
    }
    if (managerRaw && tasksUrlManagerAllowed(managerRaw, rop, profile, access)) {
      mgr = managerRaw;
    }

    const viewRaw = (routeQs.get("showcaseView") ?? routeQs.get("tab") ?? "").trim();
    const VIEW_MAP: Record<string, ShowcaseTasksViewId> = {
      all: "all",
      urgent: "urgent",
      overdue: "overdue",
      in_progress: "in_progress",
      done: "done",
      needs_rop: "needs_rop",
    };
    const sv = viewRaw && VIEW_MAP[viewRaw] ? VIEW_MAP[viewRaw]! : "all";

    const searchRaw = routeQs.get("search")?.trim();
    if (searchRaw) qv = searchRaw;

    setRopTeam(rop);
    setMgrFilter(mgr);
    setQuery(qv);
    setShowcaseViewId(sv);
  }, [profile.personaUserId, profile.role, access, routeKey, routeQs]);

  const onRopChange = (v: string) => {
    setRopTeam(v);
    setMgrFilter((prev) => {
      if (prev === "all") return prev;
      const allowed = getManagersForRopTeam(v).some((m) => m.id === prev);
      return allowed ? prev : "all";
    });
  };

  useEffect(() => {
    if (mgrFilter === "all") return;
    if (!mgrOptions.some((m) => m.id === mgrFilter)) setMgrFilter("all");
  }, [ropTeam, mgrOptions, mgrFilter]);

  useEffect(() => {
    if (access !== "sales_director" && access !== "team_lead") return;
    publishDashboardRopTeamId(ropTeam);
  }, [ropTeam, access, publishDashboardRopTeamId]);

  const workingDealerRows = useMemo(
    () =>
      actx.enabled
        ? buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, { includeArchivedDealers: false })
        : catalogRows,
    [actx.enabled, managementPlane.mergedState, profile, catalogRows],
  );

  const scopedDealerRows = useRoleScopedDealerRowsAuto(workingDealerRows, profile);

  const allowedDealerIds = useMemo(() => new Set(scopedDealerRows.map((d) => d.id)), [scopedDealerRows]);

  const actualizationLoading =
    (actx.enabled && actx.loading) ||
    (actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && managementPlane.teamFetchLoading);

  const directorRopFactualShowcaseTasks = actx.enabled && shouldUseTeamMergedActualizationPlane(profile);

  useEffect(() => {
    if (actualizationLoading) {
      setBackendDeficitTasks([]);
      return;
    }
    let cancelled = false;
    void fetchShowcaseMatrixDeficitTasksForDealers(scopedDealerRows).then((tasks) => {
      if (!cancelled) setBackendDeficitTasks(tasks);
    });
    return () => {
      cancelled = true;
    };
  }, [actualizationLoading, scopedDealerRows, showcaseTick]);

  const hasPersistedShowcaseTasksInRoleScope = useMemo(() => {
    if (!directorRopFactualShowcaseTasks || actualizationLoading) return false;
    const raw = getManagementFactualShowcaseTasksForDealers(
      workingDealerRows,
      managementPlane.mergedState,
    ).filter((t) => allowedDealerIds.has(t.dealerId));
    return raw.length > 0;
  }, [
    directorRopFactualShowcaseTasks,
    actualizationLoading,
    workingDealerRows,
    managementPlane.mergedState,
    allowedDealerIds,
  ]);

  const hasAnyShowcaseTasksInScope = useMemo(() => {
    if (hasPersistedShowcaseTasksInRoleScope) return true;
    return backendDeficitTasks.some((t) => allowedDealerIds.has(t.dealerId));
  }, [hasPersistedShowcaseTasksInRoleScope, backendDeficitTasks, allowedDealerIds]);

  const showcaseTasks = useMemo(() => {
    if (actualizationLoading) return [] as MatrixTaskWithContext[];
    let rawSource: MatrixTaskWithContext[];
    if (!actx.enabled) {
      rawSource = getAllMatrixTasks();
    } else if (directorRopFactualShowcaseTasks) {
      rawSource = getManagementFactualShowcaseTasksForDealers(workingDealerRows, managementPlane.mergedState);
    } else {
      rawSource = getShowcaseDistributionPlanTasksForDealers(workingDealerRows);
    }
    const rawWithDeficit = [...rawSource, ...backendDeficitTasks];
    const raw = sortTasks(rawWithDeficit).filter((t) => allowedDealerIds.has(t.dealerId));
    return getShowcaseOnlyTasks(raw);
  }, [
    actualizationLoading,
    actx.enabled,
    directorRopFactualShowcaseTasks,
    workingDealerRows,
    managementPlane.mergedState,
    allowedDealerIds,
    showcaseTick,
    backendDeficitTasks,
  ]);

  const filteredByScope = useMemo(() => {
    let list = showcaseTasks;
    if (!isRopOrManagerAllFilter(ropTeam) || !isRopOrManagerAllFilter(mgrFilter)) {
      list = list.filter((t) => {
        const d = dealerById.get(t.dealerId);
        if (!d) return false;
        if (!isRopOrManagerAllFilter(ropTeam) && d.releaseTeamId !== ropTeam) return false;
        if (!isRopOrManagerAllFilter(mgrFilter)) {
          if (d.releaseManagerId === mgrFilter) return true;
          const cat = mgrOptions.find((m) => m.id === mgrFilter);
          return Boolean(cat && managerDisplayMatchesCatalogName(d.manager, cat.name));
        }
        return true;
      });
    }
    return list;
  }, [showcaseTasks, ropTeam, mgrFilter, dealerById, mgrOptions]);

  const searched = useMemo(() => applySearch(filteredByScope, query), [filteredByScope, query]);

  const dealerIdFilterRaw = (routeQs.get("dealerId") ?? "").trim();
  const dealerFilterActive = dealerIdFilterRaw.length > 0 && allowedDealerIds.has(dealerIdFilterRaw);
  const dealerFilterDenied = dealerIdFilterRaw.length > 0 && !allowedDealerIds.has(dealerIdFilterRaw);

  const dealerScoped = useMemo(() => {
    if (dealerFilterDenied) return [];
    if (dealerFilterActive) return searched.filter((t) => t.dealerId === dealerIdFilterRaw);
    return searched;
  }, [searched, dealerFilterActive, dealerFilterDenied, dealerIdFilterRaw]);

  const resetClientFilterHref = useMemo(() => {
    const entries: Record<string, string> = {};
    routeQs.forEach((v, k) => {
      if (k === "dealerId" || !v) return;
      entries[k] = v;
    });
    return buildHashPath("/tasks", Object.keys(entries).length > 0 ? entries : undefined);
  }, [routeQs]);

  const filtered = useMemo(
    () => applyShowcaseView(dealerScoped, showcaseViewId, presetClock),
    [dealerScoped, showcaseViewId, presetClock],
  );

  const visibleTasks = useMemo(() => filtered.slice(0, TASKS_DISPLAY_LIMIT), [filtered]);

  const taskRowKey = (t: MatrixTaskWithContext) => `${t.dealerId}|${t.tradePointId}|${t.taskId}`;

  const selectShowcaseView = useCallback((id: ShowcaseTasksViewId) => {
    setShowcaseViewId(id);
  }, []);

  const showFullShowcaseTaskUi =
    !directorRopFactualShowcaseTasks || (!actualizationLoading && hasAnyShowcaseTasksInScope);
  const showFactualShowcaseEmpty =
    directorRopFactualShowcaseTasks && !actualizationLoading && !hasAnyShowcaseTasksInScope;

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6"
      data-testid="page-showcase-tasks"
    >
      <section data-testid="section-tasks-showcase-focus" className="space-y-4 sm:space-y-6">
        <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
          <div
            className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary"
            aria-hidden
          />
          <div className="relative min-w-0 pl-3 sm:pl-4">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Задачи по витрине
            </h1>
            <p
              className="mt-1 text-sm text-muted-foreground sm:text-base"
              data-testid="text-tasks-showcase-goal"
            >
              Цель: выставить образцы на витрину у клиентов.
            </p>
          </div>
        </header>

        {directorRopFactualShowcaseTasks && actualizationLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка актуализации команды…</p>
        ) : null}

        {showFactualShowcaseEmpty ? (
          <Card
            className="rounded-2xl border border-border/80 bg-card shadow-md"
            data-testid="section-showcase-tasks-factual-empty"
          >
            <CardContent className="space-y-4 pt-5">
              <h2 className="text-lg font-semibold text-foreground">Задачи по витрине пока не сформированы</h2>
              <p className="text-sm text-muted-foreground">
                Задачи по витрине появятся здесь, как только их добавят менеджеры.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="min-h-10 w-full font-semibold sm:w-auto">
                  <Link href={buildHashPath("/trade-points")} data-testid="button-showcase-tasks-to-trade-points">
                    К торговым точкам
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showFullShowcaseTaskUi ? (
          <>
            <ShowcaseTasksKpis
              tasks={dealerScoped}
              variant={directorRopFactualShowcaseTasks ? "management_factual" : "legacy"}
            />

        {dealerFilterActive ? (
          <div
            className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid="text-tasks-client-filter"
          >
            <p className="text-sm font-medium text-foreground">
              Показаны задачи клиента:{" "}
              <span className="text-foreground">{dealerById.get(dealerIdFilterRaw)?.name ?? dealerIdFilterRaw}</span>
            </p>
            <Button asChild variant="outline" size="sm" className="min-h-10 w-full shrink-0 sm:w-auto" data-testid="button-tasks-client-filter-reset">
              <Link href={resetClientFilterHref}>Сбросить фильтр клиента</Link>
            </Button>
          </div>
        ) : null}
        {dealerFilterDenied ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Запрошенный клиент недоступен для вашей роли.
          </p>
        ) : null}

        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Быстрый фильтр</p>
          <div className="flex flex-wrap gap-2">
            {SHOWCASE_VIEW_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                data-testid={c.testId}
                onClick={() => selectShowcaseView(c.id)}
                className={cn(
                  "min-h-9 max-w-full rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition-colors sm:text-sm",
                  showcaseViewId === c.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {c.label}{" "}
                <span className="tabular-nums">({countShowcaseView(dealerScoped, c.id, presetClock)})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              inputMode="search"
              placeholder="Поиск по клиенту, категории витрины или названию"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9"
              data-testid="input-tasks-search"
              aria-label="Поиск задач по витрине"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant={view === "cards" ? "default" : "outline"}
              className={cn("min-h-10", view === "cards" ? "font-semibold" : "border-border bg-card")}
              data-testid="button-showcase-task-view-photo"
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid className="mr-1.5 h-4 w-4" aria-hidden />
              С фото
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "outline"}
              className={cn("min-h-10", view === "list" ? "font-semibold" : "border-border bg-card")}
              data-testid="button-showcase-task-view-list"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List className="mr-1.5 h-4 w-4" aria-hidden />
              Список
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-3">
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">РОП</Label>
            <Select value={ropTeam} onValueChange={onRopChange}>
              <SelectTrigger className="min-h-11 min-w-0" data-testid="select-tasks-rop">
                <SelectValue placeholder="РОП" />
              </SelectTrigger>
              <SelectContent>
                {access === "sales_director" ? <SelectItem value="all">Все РОПы</SelectItem> : null}
                {ropSelectOptions.map((r) => (
                  <SelectItem key={r.teamId} value={r.teamId}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Менеджер</Label>
            <Select value={mgrFilter} onValueChange={setMgrFilter}>
              <SelectTrigger className="min-h-11 min-w-0" data-testid="select-tasks-manager">
                <SelectValue placeholder="Менеджер" />
              </SelectTrigger>
              <SelectContent>
                {access === "sales_director" || access === "team_lead" ? (
                  <SelectItem value="all">Все менеджеры</SelectItem>
                ) : null}
                {mgrOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground" data-testid="text-tasks-count">
          Показано{" "}
          <span className="font-semibold tabular-nums text-foreground">{visibleTasks.length}</span> из{" "}
          <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span>
          {dealerFilterActive ? " по выбранному клиенту и фильтрам" : " по фильтру витрины, команде и поиску"}
        </p>
        {filtered.length > TASKS_DISPLAY_LIMIT ? (
          <p className="text-sm text-muted-foreground" data-testid="text-tasks-display-cap">
            Уточните фильтр или поиск — в интерфейсе не более {TASKS_DISPLAY_LIMIT} карточек одновременно.
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardContent className="pt-5 text-sm text-muted-foreground">
              По выбранным условиям витринных задач нет. Измените РОП, менеджера, быстрый фильтр или поиск.
            </CardContent>
          </Card>
        ) : view === "cards" ? (
          <div
            data-testid="section-showcase-tasks-visual-list"
            className="grid min-w-0 grid-cols-1 gap-3 overflow-x-hidden sm:grid-cols-2 lg:grid-cols-2"
          >
            {visibleTasks.map((t) => (
              <ShowcaseTaskCard
                key={taskRowKey(t)}
                task={t}
                dealerById={dealerById}
                presetClock={presetClock}
              />
            ))}
          </div>
        ) : (
          <div data-testid="section-showcase-tasks-visual-list" className="min-w-0 space-y-2 overflow-x-hidden sm:space-y-2.5">
            {visibleTasks.map((t) => (
              <ShowcaseTaskListRow
                key={taskRowKey(t)}
                task={t}
                dealerById={dealerById}
                presetClock={presetClock}
              />
            ))}
          </div>
        )}
          </>
        ) : null}
      </section>

      <FloatingBackButton
        href="/dealer-base"
        label="К клиентской базе"
        testId="floating-back-to-dealer-base"
        ariaLabel="Назад к клиентской базе"
      />
    </div>
  );
}
