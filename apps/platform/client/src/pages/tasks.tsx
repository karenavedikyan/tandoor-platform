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
  MATRIX_TASK_STATUS_LABEL,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import {
  getManagersForRopTeam,
  getRopOptions,
  isRopOrManagerAllFilter,
  managerDisplayMatchesCatalogName,
} from "@/lib/rop-manager-filters";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import {
  initialRopManagerForProfile,
  managerOptionsForProfile,
  mapSalesRoleToDealerBaseAccess,
  ropOptionsForProfile,
  roleScopedDealerRows,
  type DealerBaseAccessRole,
} from "@/lib/dealer-base-role-views";
import { SHOWCASE_STORAGE_EVENT } from "@/lib/showcase-distribution-data";
import { getShowcaseOnlyTasks, getTaskCategoryMeta } from "@/lib/task-classification";
import { taskMatchesUrgentPresetForBadge } from "@/lib/task-presets";
import { useRouteSearchParams, buildHashPath } from "@/lib/hash-route-utils";
import { getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getAllSalesManagers, getSalesUserById } from "@/lib/sales-control-data";

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
  if (s === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  if (s === "overdue") return "border-red-200 bg-red-50 text-red-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function priorityTone(p: MatrixTaskWithContext["priority"]) {
  if (p === "high") return "border-red-200 bg-red-50 text-red-900";
  if (p === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
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

function managerLabelForDealer(dealerId: string, dealerById: Map<string, (typeof DEALER_BASE_ROWS)[number]>): string {
  const d = dealerById.get(dealerId);
  if (!d) return "—";
  const u = d.releaseManagerId ? getSalesUserById(d.releaseManagerId) : undefined;
  return u?.name ?? d.manager ?? "—";
}

function ShowcaseTasksKpis({ tasks }: { tasks: MatrixTaskWithContext[] }) {
  const k = useMemo(() => computeShowcaseTaskKpis(tasks), [tasks]);
  const tiles = [
    { label: "Всего витринных", value: k.total, tone: "border-border bg-muted/40 text-foreground" },
    { label: "Новые", value: k.newCount, tone: "border-primary/40 bg-primary/10 text-primary" },
    { label: "В работе", value: k.inProgress, tone: "border-amber-200 bg-amber-50 text-amber-950" },
    { label: "Просроченные", value: k.overdue, tone: "border-red-200 bg-red-50 text-red-900" },
    { label: "Выполненные", value: k.done, tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
    { label: "Нужна помощь РОПа", value: k.needsRop, tone: "border-violet-200 bg-violet-50 text-violet-950" },
  ];
  return (
    <Card
      className="rounded-2xl border border-border/80 bg-card shadow-md"
      data-testid="section-tasks-kpis"
    >
      <CardContent className="space-y-3 pt-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-xl border px-3 py-2.5", t.tone)}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{t.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
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
  dealerById: Map<string, (typeof DEALER_BASE_ROWS)[number]>;
  presetClock: Date;
}) {
  const catMeta = getTaskCategoryMeta("showcase");
  const deficit = Math.max(0, task.targetSamples - task.actualSamples);
  const urgent = taskMatchesUrgentPresetForBadge(task, presetClock);
  const manager = managerLabelForDealer(task.dealerId, dealerById);

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md border-l-4",
        catMeta.borderLeftClass,
      )}
      data-testid={`card-task-${task.taskId}`}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-foreground">{task.dealerName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Менеджер: {manager}</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
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
                className="border-amber-300 bg-amber-50 font-semibold text-amber-950 dark:bg-amber-950/30 dark:text-amber-50"
                data-testid={`badge-task-preset-urgent-${task.taskId}`}
              >
                Горящая
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn("font-medium", statusTone(task.status))}>
              {MATRIX_TASK_STATUS_LABEL[task.status]}
            </Badge>
            {task.showcaseExtraStatus === "needs_rop" ? (
              <Badge variant="outline" className="border-violet-300 bg-violet-50 font-medium text-violet-950">
                Нужна помощь РОПа
              </Badge>
            ) : null}
            {task.showcaseExtraStatus === "postponed" ? (
              <Badge variant="outline" className="border-border bg-muted font-medium">
                Отложена
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn("font-medium", priorityTone(task.priority))}>
              {task.priority === "high" ? "Высокий" : task.priority === "medium" ? "Средний" : "Низкий"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Категория витрины
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{task.productName}</p>
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
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Срок</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{task.dueDate}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{task.title}</p>

        <Button
          asChild
          variant="default"
          className="min-h-10 w-full font-semibold sm:w-auto"
          data-testid={`button-task-open-client-${task.taskId}`}
        >
          <Link href={`/dealers/${task.dealerId}`}>Открыть клиента</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ShowcaseTaskListRow({
  task,
  dealerById,
  presetClock,
}: {
  task: MatrixTaskWithContext;
  dealerById: Map<string, (typeof DEALER_BASE_ROWS)[number]>;
  presetClock: Date;
}) {
  const catMeta = getTaskCategoryMeta("showcase");
  const deficit = Math.max(0, task.targetSamples - task.actualSamples);
  const urgent = taskMatchesUrgentPresetForBadge(task, presetClock);
  const manager = managerLabelForDealer(task.dealerId, dealerById);

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm border-l-4",
        catMeta.borderLeftClass,
      )}
      data-testid={`card-task-${task.taskId}`}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("font-medium", catMeta.badgeClass)}
              data-testid={`badge-task-category-${task.taskId}`}
            >
              Витрина
            </Badge>
            {urgent ? (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-xs font-semibold text-amber-950"
                data-testid={`badge-task-preset-urgent-${task.taskId}`}
              >
                Горящая
              </Badge>
            ) : null}
            <span className="font-semibold text-foreground">{task.dealerName}</span>
            <Badge variant="outline" className={cn("font-medium", statusTone(task.status))}>
              {MATRIX_TASK_STATUS_LABEL[task.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Менеджер: {manager} · {task.productName} · план {task.targetSamples} · факт {task.actualSamples} · дефицит{" "}
            {deficit} · срок {task.dueDate}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="min-h-9 shrink-0 border-border bg-card"
          data-testid={`button-task-open-client-${task.taskId}`}
        >
          <Link href={`/dealers/${task.dealerId}`}>Клиент</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const { profile } = useReleaseDemoProfile();
  const access = useMemo(() => mapSalesRoleToDealerBaseAccess(profile.role), [profile.role]);

  const allowedDealerIds = useMemo(() => {
    const scoped = roleScopedDealerRows(DEALER_BASE_ROWS, profile);
    return new Set(scoped.map((d) => d.id));
  }, [profile]);

  const [showcaseTick, setShowcaseTick] = useState(0);
  useEffect(() => {
    const onBump = () => setShowcaseTick((n) => n + 1);
    window.addEventListener(SHOWCASE_STORAGE_EVENT, onBump);
    return () => window.removeEventListener(SHOWCASE_STORAGE_EVENT, onBump);
  }, []);

  const showcaseTasks = useMemo(() => {
    const raw = sortTasks(getAllMatrixTasks()).filter((t) => allowedDealerIds.has(t.dealerId));
    return getShowcaseOnlyTasks(raw);
  }, [allowedDealerIds, showcaseTick]);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("cards");
  const [showcaseViewId, setShowcaseViewId] = useState<ShowcaseTasksViewId>("all");
  const [presetClock] = useState(() => new Date());

  const dealerById = useMemo(() => new Map(DEALER_BASE_ROWS.map((d) => [d.id, d])), []);
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

  return (
    <div
      className="min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6"
      data-testid="page-tasks"
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

        <ShowcaseTasksKpis tasks={dealerScoped} />

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
              data-testid="button-tasks-view-cards"
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid className="mr-1.5 h-4 w-4" aria-hidden />
              Карточки
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "outline"}
              className={cn("min-h-10", view === "list" ? "font-semibold" : "border-border bg-card")}
              data-testid="button-tasks-view-list"
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
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
          <div className="min-w-0 space-y-3">
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
