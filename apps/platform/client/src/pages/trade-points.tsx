/**
 * Список торговых точек по всем доступным клиентам (актуализация).
 */

import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { mergeActualizationState, createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import { canArchiveTradePointDuringActualization, canEditDealerDuringActualization } from "@/lib/client-base-actualization-permissions";
import {
  buildTradePointListForActualization,
  type TradePointListRow,
  type TradePointShowcaseBucket,
} from "@/lib/trade-point-list-for-actualization";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { type ClientCategoryId } from "@/lib/client-category";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";

type ViewMode = "cards" | "list" | "compact";

type SortKey =
  | "city"
  | "dealer"
  | "tpName"
  | "showcase"
  | "deficit"
  | "updated"
  | "unloading";

type ShowcaseStatusFilter = "all" | TradePointShowcaseBucket;
type TasksFilter = "all" | "deficit" | "no_deficit" | "has_tasks" | "no_tasks";
type PortalFilter = "all" | "has_portals" | "no_portals" | "unfilled" | "free" | "overflow";

const SHOWCASE_FILTER_LABELS: Record<Exclude<ShowcaseStatusFilter, "all">, string> = {
  not_filled: "Не заполнена",
  no_showcase: "Нет витрины",
  has_showcase: "Есть витрина",
  partial: "Заполнена частично",
  needs_attention: "Требует заполнения",
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function searchMatches(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every((p) => haystack.includes(p));
}

function showcaseRank(b: TradePointShowcaseBucket): number {
  const order: TradePointShowcaseBucket[] = ["not_filled", "needs_attention", "partial", "no_showcase", "has_showcase"];
  const i = order.indexOf(b);
  return i === -1 ? 99 : i;
}

export default function TradePointsPage(): ReactElement {
  const actx = useClientBaseActualization();
  const { profile } = useReleaseDemoProfile();
  const { user } = useCurrentUser();
  const actState = actx.enabled ? actx.state : createEmptyActualizationState();

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [dealerFilter, setDealerFilter] = useState<string>("__all__");
  const [categoryFilter, setCategoryFilter] = useState<ClientCategoryId | "all">("all");
  const [pointFormatFilter, setPointFormatFilter] = useState<string>("__all__");
  const [showcaseFilter, setShowcaseFilter] = useState<ShowcaseStatusFilter>("all");
  const [portalFilter, setPortalFilter] = useState<PortalFilter>("all");
  const [tasksFilter, setTasksFilter] = useState<TasksFilter>("all");
  const [mgrFilter, setMgrFilter] = useState("");
  const [rmFilter, setRmFilter] = useState("");
  const [ropFilter, setRopFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("tpName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [archiveTarget, setArchiveTarget] = useState<TradePointListRow | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const baseRows = useMemo(
    () => buildTradePointListForActualization(actState, profile, { includeArchivedTradePoints: showArchived }),
    [actState, profile, showArchived],
  );

  const workingRows = useMemo(
    () => buildTradePointListForActualization(actState, profile, { includeArchivedTradePoints: false }),
    [actState, profile],
  );

  const summary = useMemo(() => {
    let filled = 0;
    let missing = 0;
    let noShow = 0;
    let deficit = 0;
    let tasks = 0;
    for (const r of workingRows) {
      if (r.showcaseBucket === "has_showcase") filled += 1;
      if (r.showcaseBucket === "no_showcase") noShow += 1;
      if (r.showcaseBucket === "not_filled" || r.showcaseBucket === "partial" || r.showcaseBucket === "needs_attention") {
        missing += 1;
      }
      if (r.matrixDeficitCount > 0) deficit += 1;
      if (r.showcaseNewTasksCount > 0) tasks += 1;
    }
    return {
      total: workingRows.length,
      filled,
      noShow,
      missing,
      deficit,
      tasks,
    };
  }, [workingRows]);

  const cityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of baseRows) {
      if (r.city && r.city !== "—") s.add(r.city);
    }
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((c) => ({ value: c, label: c }));
  }, [baseRows]);

  const dealerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of baseRows) m.set(r.dealerId, r.dealerName);
    return Array.from(m.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ru"))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [baseRows]);

  const formatOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of baseRows) {
      if (r.tradePointFormatLabel) s.add(r.tradePointFormatLabel);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [baseRows]);

  const filteredSorted = useMemo(() => {
    let list = baseRows.slice();

    if (search.trim()) list = list.filter((r) => searchMatches(r.searchHaystack, search));
    if (cityFilter.length) list = list.filter((r) => cityFilter.includes(r.city));
    if (dealerFilter !== "__all__") list = list.filter((r) => r.dealerId === dealerFilter);
    if (categoryFilter !== "all") list = list.filter((r) => r.clientCategory === categoryFilter);
    if (pointFormatFilter !== "__all__") {
      list = list.filter((r) => (r.tradePointFormatLabel ?? "") === pointFormatFilter);
    }
    if (showcaseFilter !== "all") list = list.filter((r) => r.showcaseBucket === showcaseFilter);

    if (portalFilter === "has_portals") list = list.filter((r) => r.portalsTotal != null && r.portalsTotal > 0);
    else if (portalFilter === "no_portals") list = list.filter((r) => r.hasShowcase === true && (r.portalsTotal == null || r.portalsTotal === 0));
    else if (portalFilter === "unfilled") list = list.filter((r) => r.portalsUnfilled);
    else if (portalFilter === "free") list = list.filter((r) => r.hasFreePortals);
    else if (portalFilter === "overflow") list = list.filter((r) => r.portalOverfill);

    if (tasksFilter === "deficit") list = list.filter((r) => r.matrixDeficitCount > 0);
    else if (tasksFilter === "no_deficit") list = list.filter((r) => r.matrixDeficitCount === 0);
    else if (tasksFilter === "has_tasks") list = list.filter((r) => r.showcaseNewTasksCount > 0);
    else if (tasksFilter === "no_tasks") list = list.filter((r) => r.showcaseNewTasksCount === 0);

    const mf = norm(mgrFilter);
    if (mf) list = list.filter((r) => norm(r.manager).includes(mf));
    const rf = norm(rmFilter);
    if (rf) list = list.filter((r) => norm(r.regionalManager).includes(rf));
    const pf = norm(ropFilter);
    if (pf) list = list.filter((r) => norm(r.rop).includes(pf));

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "city":
          cmp = a.city.localeCompare(b.city, "ru");
          break;
        case "dealer":
          cmp = a.dealerName.localeCompare(b.dealerName, "ru");
          break;
        case "tpName":
          cmp = a.tradePointName.localeCompare(b.tradePointName, "ru");
          break;
        case "showcase":
          cmp = showcaseRank(a.showcaseBucket) - showcaseRank(b.showcaseBucket);
          break;
        case "deficit":
          cmp = a.matrixDeficitCount - b.matrixDeficitCount;
          break;
        case "updated": {
          const ta = a.showcaseUpdatedAt ?? "";
          const tb = b.showcaseUpdatedAt ?? "";
          cmp = ta < tb ? -1 : ta > tb ? 1 : 0;
          break;
        }
        case "unloading": {
          const ua = a.unloadingOrder ?? 999999;
          const ub = b.unloadingOrder ?? 999999;
          cmp = ua - ub;
          break;
        }
        default:
          cmp = 0;
      }
      if (cmp === 0) cmp = a.tradePointId.localeCompare(b.tradePointId);
      return cmp * dir;
    });

    return list;
  }, [
    baseRows,
    search,
    cityFilter,
    dealerFilter,
    categoryFilter,
    pointFormatFilter,
    showcaseFilter,
    portalFilter,
    tasksFilter,
    mgrFilter,
    rmFilter,
    ropFilter,
    sortKey,
    sortDir,
  ]);

  const canEdit = useCallback((row: TradePointListRow) => canEditDealerDuringActualization(profile, row.dealer), [profile]);

  const canArchiveRow = useCallback(
    (row: TradePointListRow) =>
      actx.enabled &&
      canEdit(row) &&
      !row.isVirtual &&
      canArchiveTradePointDuringActualization(profile, row.dealer, row.point) &&
      !row.isArchived,
    [actx.enabled, profile, canEdit],
  );

  const confirmArchive = useCallback(async () => {
    if (!archiveTarget || !actx.enabled) return;
    setArchiveBusy(true);
    const tp = archiveTarget.point;
    const now = new Date().toISOString();
    const uid = user?.id ?? profile.personaUserId;
    const uname = user?.name?.trim() || userLabelFromProfile(profile);
    const r = await actx.persist((prev) =>
      mergeActualizationState(prev, {
        archivedTradePointsById: {
          ...prev.archivedTradePointsById,
          [tp.id]: {
            tradePointId: tp.id,
            dealerId: archiveTarget.dealerId,
            archivedAt: now,
            archivedBy: uid,
            archivedByName: uname,
            source: "manual_actualization" as const,
          },
        },
      }),
    );
    setArchiveBusy(false);
    setArchiveTarget(null);
    if (r.success) toast({ title: "Торговая точка в архиве" });
    else toast({ title: "Не удалось сохранить", variant: "destructive" });
  }, [archiveTarget, actx, profile, user]);

  const tpHref = (r: TradePointListRow) => `/dealers/${encodeURIComponent(r.dealerId)}/trade-points/${encodeURIComponent(r.tradePointId)}`;
  const dealerHref = (r: TradePointListRow) => `/dealers/${encodeURIComponent(r.dealerId)}`;

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden px-1 sm:space-y-6 sm:px-0" data-testid="page-trade-points">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Торговые точки</h1>
          </div>
          <p className="text-sm text-muted-foreground">Все точки клиентов, доступные по вашей зоне ответственности</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "cards" ? "default" : "outline"}
            data-testid="button-trade-points-view-cards"
            onClick={() => setViewMode("cards")}
          >
            Карточки
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "default" : "outline"}
            data-testid="button-trade-points-view-list"
            onClick={() => setViewMode("list")}
          >
            Список
          </Button>
          <Button type="button" size="sm" variant={viewMode === "compact" ? "default" : "outline"} onClick={() => setViewMode("compact")}>
            Компактно
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <p className="text-sm" data-testid="text-trade-points-total-count">
          <span className="font-medium text-foreground">Всего рабочих ТТ:</span> {summary.total}
        </p>
        <p className="text-sm" data-testid="text-trade-points-showcase-filled-count">
          <span className="font-medium text-foreground">С заполненной витриной:</span> {summary.filled}
        </p>
        <p className="text-sm">
          <span className="font-medium text-foreground">Без витрины:</span> {summary.noShow}
        </p>
        <p className="text-sm" data-testid="text-trade-points-showcase-missing-count">
          <span className="font-medium text-foreground">Витрина не заполнена / частично:</span> {summary.missing}
        </p>
        <p className="text-sm" data-testid="text-trade-points-matrix-deficit-count">
          <span className="font-medium text-foreground">С дефицитом по матрице:</span> {summary.deficit}
        </p>
        <p className="text-sm">
          <span className="font-medium text-foreground">С задачами по витрине:</span> {summary.tasks}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs">Поиск</Label>
            <Input
              className="min-h-10"
              value={search}
              data-testid="input-trade-points-search"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ТТ, адрес, город, клиент, коды…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Город</Label>
            <MultiSelect
              options={cityOptions}
              value={cityFilter}
              onChange={setCityFilter}
              placeholder="Все города"
              testId="filter-trade-points-city"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Клиент</Label>
            <Select value={dealerFilter} onValueChange={setDealerFilter}>
              <SelectTrigger className="min-h-10" data-testid="filter-trade-points-client">
                <SelectValue placeholder="Все клиенты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все клиенты</SelectItem>
                {dealerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Категория клиента</Label>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as ClientCategoryId | "all")}
            >
              <SelectTrigger className="min-h-10" data-testid="filter-trade-points-client-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="top150">ТОП 150</SelectItem>
                <SelectItem value="top350">ТОП 350</SelectItem>
                <SelectItem value="top500">ТОП 500</SelectItem>
                <SelectItem value="top500plus">ТОП 500+</SelectItem>
                <SelectItem value="uncategorized">Без категории</SelectItem>
                <SelectItem value="potential">Потенциальный</SelectItem>
                <SelectItem value="lead">Лид</SelectItem>
                <SelectItem value="no_sales">Б/П</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Формат ТТ</Label>
            <Select value={pointFormatFilter} onValueChange={setPointFormatFilter}>
              <SelectTrigger className="min-h-10" data-testid="filter-trade-points-point-category">
                <SelectValue placeholder={formatOptions.length ? "Все форматы" : "Нет данных в анкетах"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все / не указано</SelectItem>
                {formatOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Статус витрины</Label>
            <Select value={showcaseFilter} onValueChange={(v) => setShowcaseFilter(v as ShowcaseStatusFilter)}>
              <SelectTrigger className="min-h-10" data-testid="filter-trade-points-showcase-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {(Object.keys(SHOWCASE_FILTER_LABELS) as Exclude<ShowcaseStatusFilter, "all">[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SHOWCASE_FILTER_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Порталы</Label>
            <Select value={portalFilter} onValueChange={(v) => setPortalFilter(v as PortalFilter)}>
              <SelectTrigger className="min-h-10" data-testid="filter-trade-points-portals">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="has_portals">Есть порталы (число заполнено)</SelectItem>
                <SelectItem value="no_portals">Нет порталов (0)</SelectItem>
                <SelectItem value="unfilled">Порталы не заполнены</SelectItem>
                <SelectItem value="free">Есть свободные порталы</SelectItem>
                <SelectItem value="overflow">Превышение моделей над порталами</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Задачи по витрине</Label>
            <Select value={tasksFilter} onValueChange={(v) => setTasksFilter(v as TasksFilter)}>
              <SelectTrigger className="min-h-10" data-testid="filter-trade-points-showcase-tasks">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="deficit">Есть дефицит по матрице</SelectItem>
                <SelectItem value="no_deficit">Нет дефицита</SelectItem>
                <SelectItem value="has_tasks">Есть созданные задачи</SelectItem>
                <SelectItem value="no_tasks">Нет задач</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Менеджер</Label>
            <Input className="min-h-10" value={mgrFilter} data-testid="filter-trade-points-manager" onChange={(e) => setMgrFilter(e.target.value)} placeholder="Часть имени" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Региональный менеджер</Label>
            <Input className="min-h-10" value={rmFilter} data-testid="filter-trade-points-regional-manager" onChange={(e) => setRmFilter(e.target.value)} placeholder="Часть имени" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">РОП</Label>
            <Input className="min-h-10" value={ropFilter} data-testid="filter-trade-points-rop" onChange={(e) => setRopFilter(e.target.value)} placeholder="Часть имени" />
          </div>
          <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-3">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-archived-tp" className="text-xs">
                Показать архивные ТТ
              </Label>
              <p className="text-[11px] text-muted-foreground">По умолчанию скрыты архивные точки и клиенты в архиве не попадают в список.</p>
            </div>
            <Switch id="toggle-archived-tp" checked={showArchived} data-testid="toggle-trade-points-show-archived" onCheckedChange={(v) => setShowArchived(v === true)} />
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
            <div className="space-y-1">
              <Label className="text-xs">Сортировка</Label>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="min-h-10 w-[200px] max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="city">По городу</SelectItem>
                  <SelectItem value="dealer">По клиенту</SelectItem>
                  <SelectItem value="tpName">По названию ТТ</SelectItem>
                  <SelectItem value="showcase">По статусу витрины</SelectItem>
                  <SelectItem value="deficit">По дефициту матрицы</SelectItem>
                  <SelectItem value="updated">По дате актуализации витрины</SelectItem>
                  <SelectItem value="unloading">По порядку выгрузки</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? "По возрастанию" : "По убыванию"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border border-border/80">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] gap-2 border-b bg-muted/40 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground max-md:hidden">
            <span>ТТ</span>
            <span>Клиент</span>
            <span>Город</span>
            <span>Адрес</span>
            <span>Витрина</span>
            <span className="text-right">Действия</span>
          </div>
          <ul className="divide-y divide-border/70">
            {filteredSorted.map((r) => (
              <li
                key={`${r.dealerId}-${r.tradePointId}`}
                data-testid={`row-trade-point-${r.tradePointId}`}
                className="flex flex-col gap-2 px-2 py-3 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] sm:items-center sm:gap-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium" data-testid={`text-trade-point-list-code-${r.tradePointId}`}>
                    {r.tradePointDisplayCode}
                  </p>
                  <p className="truncate text-sm font-medium">{r.tradePointName}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm" data-testid={`text-trade-point-list-dealer-${r.tradePointId}`}>
                    {r.dealerName}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.dealerClientCode}</p>
                </div>
                <p className="text-sm">{r.city}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{r.address}</p>
                <div className="text-xs">
                  <p>{r.showcaseBucketLabel}</p>
                  {r.portalsTotal != null ? <p className="text-muted-foreground">Порталов: {r.portalsTotal}</p> : null}
                  <p className="text-muted-foreground">Моделей: {r.modelsOnShowcaseCount}</p>
                  {r.matrixDeficitCount > 0 ? <p className="text-amber-900">Дефицит: {r.matrixDeficitCount}</p> : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button asChild size="sm" variant="default" data-testid={`button-trade-point-list-open-${r.tradePointId}`}>
                    <Link href={tpHref(r)}>Открыть ТТ</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" data-testid={`button-trade-point-list-open-dealer-${r.dealerId}-${r.tradePointId}`}>
                    <Link href={dealerHref(r)}>Клиент</Link>
                  </Button>
                  {canArchiveRow(r) ? (
                    <Button type="button" size="sm" variant="destructive" data-testid={`button-trade-point-list-delete-${r.tradePointId}`} onClick={() => setArchiveTarget(r)}>
                      В архив
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={cn("grid gap-3", viewMode === "compact" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
          {filteredSorted.map((r) => (
            <Card key={`${r.dealerId}-${r.tradePointId}`} data-testid={`card-trade-point-${r.tradePointId}`} className="overflow-hidden">
              <CardHeader className="space-y-1 pb-2">
                <p className="font-mono text-xs text-muted-foreground">{r.tradePointDisplayCode}</p>
                <CardTitle className="text-base leading-snug">{r.tradePointName}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {r.city} · {r.address}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Клиент:</span> {r.dealerName}{" "}
                  <span className="text-xs text-muted-foreground">({r.dealerClientCode})</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Категория:</span> {r.clientCategoryLabel}
                </p>
                {r.tradePointFormatLabel ? (
                  <p>
                    <span className="text-muted-foreground">Формат ТТ:</span> {r.tradePointFormatLabel}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Витрина:</span> {r.showcaseBucketLabel}
                  {r.portalsTotal != null ? ` · порталов: ${r.portalsTotal}` : ""} · моделей: {r.modelsOnShowcaseCount}
                </p>
                {r.matrixDeficitCount > 0 ? <p className="text-xs text-amber-900">Дефицит матрицы: {r.matrixDeficitCount}</p> : null}
                {r.showcaseNewTasksCount > 0 ? <p className="text-xs text-emerald-800">Задач по витрине: {r.showcaseNewTasksCount}</p> : null}
                {r.showcaseUpdatedAt ? (
                  <p className="text-xs text-muted-foreground">Обновлено: {new Date(r.showcaseUpdatedAt).toLocaleString("ru-RU")}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="default">
                    <Link href={tpHref(r)}>Открыть ТТ</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={dealerHref(r)}>Открыть клиента</Link>
                  </Button>
                  {canArchiveRow(r) ? (
                    <Button type="button" size="sm" variant="destructive" onClick={() => setArchiveTarget(r)}>
                      В архив
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredSorted.length === 0 ? <p className="text-sm text-muted-foreground">Нет торговых точек по выбранным фильтрам.</p> : null}

      <AlertDialog open={archiveTarget != null} onOpenChange={(o) => !o && !archiveBusy && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>В архив торговую точку?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget ? `Точка «${archiveTarget.tradePointName}» будет скрыта из рабочей карточки клиента.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={archiveBusy} onClick={() => void confirmArchive()}>
              {archiveBusy ? "…" : "В архив"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
