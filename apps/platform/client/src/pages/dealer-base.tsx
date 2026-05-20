import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CLIENT_CATEGORY_META,
  type ClientCategoryId,
  clientCategoryMatchesFilter,
  getClientCategoryBadgeClass,
  getClientCategoryLabel,
  isClientTopTier,
} from "@/lib/client-category";
import { getDealerRegionalManagerEffectiveDisplay } from "@/lib/dealer-regional-manager-overrides";
import { DEALER_BASE_ROWS, getDealerRopDisplay, type DealerRow, type DealerStatus } from "@/lib/dealer-base-mock-data";
import {
  getManagersForRopTeam,
  getRopOptions,
  isRopOrManagerAllFilter,
  managerDisplayMatchesCatalogName,
} from "@/lib/rop-manager-filters";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { loadReleaseDemoProfile, getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getSalesUserById, getTeamManagers, getAllSalesManagers, type SalesUser } from "@/lib/sales-control-data";
import {
  buildDayPlanTeamRows,
  dealerNeedsAttention,
  DEALER_BASE_TEAM_WORK_VIEWS,
  DEALER_BASE_VIEW_LABELS,
  defaultWorkViewForAccess,
  groupLabelsForAccess,
  isDealerBusinessRisk,
  isDealerTop,
  initialRopManagerForProfile,
  managerOptionsForProfile,
  mapSalesRoleToDealerBaseAccess,
  pickTodayContactRows,
  roleScopedDealerRows,
  ropOptionsForProfile,
  viewsInGroupForAccess,
  workViewGroup,
  workViewsForAccess,
  type DealerBaseAccessRole,
  type DealerBaseWorkView,
} from "@/lib/dealer-base-role-views";
import { CityConcentrationBlock } from "@/components/city-concentration-block";
import { ClientBaseActualizationSyncStatus } from "@/components/client-base-actualization-sync-status";
import { DealerActualizationCreateDialog } from "@/components/client-base-actualization-dealer-forms";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canActualizeClientBase, canCreateDealerDuringActualization } from "@/lib/client-base-actualization-permissions";
import { buildTeamSummary } from "@/lib/team-summary";
import { TeamSummaryCard } from "@/components/team-summary-card";
import { buildCityConcentrationRows, buildDealerBaseAllCitiesHref, buildDealerBaseCityDrillHref } from "@/lib/city-concentration";
import { buildBrowserHashAppHref, buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import {
  DEALER_BASE_SEGMENT_DESCRIPTIONS,
  DEALER_BASE_SEGMENT_LABELS,
  DEALER_BASE_SEGMENT_ORDER,
  defaultDealerBaseSegmentCollapse,
  dealerBaseSegmentSectionTestId,
  dealerBaseSegmentTestSlug,
  getDealerBaseSegment,
  loadDealerBaseSegmentCollapseOverrides,
  partitionDealersBySegment,
  saveDealerBaseSegmentCollapseState,
  type DealerBaseSegmentCollapseState,
  type DealerBaseSegmentId,
} from "@/lib/dealer-base-segments";
import {
  DEALER_WORK_PLAN_EVENT,
  filterDealersByWorkPlan,
  hideDealersForUser,
  isDealerHiddenForUser,
  loadDealerWorkPlanState,
  restoreDealersForUser,
  scheduleDealersForUser,
  type DealerWorkPlanState,
  type WorkPlanListFilter,
  WORK_PLAN_FILTER_LABELS,
} from "@/lib/dealer-work-plan";
import { DealerShipmentDayPlanner } from "@/components/dealer-shipment-day-planner";
import { DealerWorkPlanBulkBar } from "@/components/dealer-work-plan-bulk-bar";
import { CLIENT_NEXT_STEP_CHANGED_EVENT } from "@/lib/client-next-step-data";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  getDealerShipmentDays,
  getDealerShipmentStatus,
  type DealerShipmentDayId,
} from "@/lib/dealer-shipment-days";
import {
  addDealersToRoute,
  computeDisplayedRouteDealerIds,
  countDealersOnRouteSettlements,
  DEALER_ROUTE_PLAN_EVENT,
  listRouteDefinitions,
  loadDealerRoutePlanState,
  type ShipmentRouteDefinition,
  type ShipmentRouteSlotId,
} from "@/lib/dealer-route-plan";
import {
  DEALER_STOCK_FILTER_LABELS,
  dealerRowMatchesStockFilter,
  getDealerStockSignal,
  type DealerStockListFilterId,
} from "@/lib/dealer-stock-signals";
import {
  DEALER_PROGRAM_FILTER_BADGE_TESTID,
  DEALER_PROGRAM_FILTER_BUTTON_TESTID,
  DEALER_PROGRAM_FILTER_LABELS,
  DEALER_PROGRAM_FILTER_ORDER,
  dealerRowMatchesProgramFilters,
  getDealerProgramSignal,
  type DealerProgramFilterId,
} from "@/lib/dealer-program-signals";
import { DEALER_CHARACTERISTICS_EVENT } from "@/lib/dealer-characteristics";
import { SHOWCASE_STORAGE_EVENT } from "@/lib/showcase-distribution-data";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";

const DEALER_BASE_DISPLAY_LIMIT = 300;
const TODAY_LIMIT = 100;

type QuickFilter = "all" | "active" | "potential" | "attention" | "top" | "no_activity" | "closed";

const QUICK_FROM_URL: Record<string, QuickFilter> = {
  all: "all",
  active: "active",
  potential: "potential",
  attention: "attention",
  top: "top",
  inactive: "no_activity",
  no_activity: "no_activity",
  closed: "closed",
};

function parseWorkViewFromQuery(raw: string | null, access: DealerBaseAccessRole): DealerBaseWorkView | null {
  if (!raw) return null;
  const v = raw.trim() as DealerBaseWorkView;
  return workViewsForAccess(access).includes(v) ? v : null;
}

function teamAllowedForProfile(
  teamId: string,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): boolean {
  if (!getRopOptions().some((o) => o.teamId === teamId)) return false;
  if (access === "sales_director") return true;
  if (access === "team_lead") return teamId === getEffectiveTeamLeadTeamId(profile);
  const u = getSalesUserById(profile.personaUserId);
  return Boolean(u?.teamId === teamId);
}

function managerAllowedForRop(
  managerId: string,
  ropTeamId: string,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): boolean {
  if (access === "sales_manager") {
    const u = getSalesUserById(profile.personaUserId);
    return Boolean(u?.id === managerId);
  }
  const pool = access === "sales_director" && isRopOrManagerAllFilter(ropTeamId)
    ? getAllSalesManagers()
    : getManagersForRopTeam(ropTeamId);
  return pool.some((m) => m.id === managerId);
}

const QUICK_FILTERS: { id: QuickFilter; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-dealers-all" },
  { id: "active", label: "Активные", testId: "filter-dealers-active" },
  { id: "potential", label: "Потенциальные", testId: "filter-dealers-potential" },
  { id: "attention", label: "Требуют внимания", testId: "filter-dealers-attention" },
  { id: "top", label: "ТОП-сегмент", testId: "filter-dealers-top" },
  { id: "closed", label: "Закрытые", testId: "filter-dealers-closed" },
];

function statusBadgeClass(status: DealerStatus) {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

type ClientCategoryRouteFilter = ClientCategoryId | "all" | "__top_tier__";
type ClientCategorySelection = Exclude<ClientCategoryRouteFilter, "all">;
function applyQuickFilter(row: DealerRow, q: QuickFilter): boolean {
  switch (q) {
    case "all":
      return row.status !== "приостановлен";
    case "active":
      return row.status === "активный";
    case "potential":
      return row.status === "потенциальный";
    case "attention":
      return row.status === "требует внимания" || row.hasProblem;
    case "top":
      return isClientTopTier(row.clientCategory);
    case "no_activity":
      return !row.hasRecentActivity;
    case "closed":
      return row.status === "приостановлен";
    default:
      return true;
  }
}

type PickerArgs = {
  search: string;
  quick: QuickFilter;
  cities: string[];
  categories: ClientCategorySelection[];
  ropTeam: string;
  manager: string;
  managerCatalogForRop: ReturnType<typeof getManagersForRopTeam>;
};

function applyPickerFilters(rows: DealerRow[], args: PickerArgs): DealerRow[] {
  const q = args.search.trim().toLowerCase();
  const citySet = args.cities.length > 0 ? new Set(args.cities) : null;
  const categorySelections = args.categories;
  return rows.filter((row) => {
    if (!applyQuickFilter(row, args.quick)) return false;
    if (citySet && !citySet.has(row.city)) return false;
    if (categorySelections.length > 0) {
      const ok = categorySelections.some((c) => clientCategoryMatchesFilter(row.clientCategory, c));
      if (!ok) return false;
    }
    if (!isRopOrManagerAllFilter(args.ropTeam)) {
      if (row.releaseTeamId !== args.ropTeam) return false;
    }
    if (!isRopOrManagerAllFilter(args.manager)) {
      let mgrOk = row.releaseManagerId === args.manager;
      if (!mgrOk) {
        const cat = args.managerCatalogForRop.find((m) => m.id === args.manager);
        mgrOk = Boolean(cat && managerDisplayMatchesCatalogName(row.manager, cat.name));
      }
      if (!mgrOk) return false;
    }
    if (!q) return true;
    const hay = [
      row.name,
      row.city,
      row.manager,
      getDealerRegionalManagerEffectiveDisplay(row),
      getDealerRopDisplay(row),
      row.releaseCode ?? "",
      row.releaseAddress ?? "",
      row.clientTypeLabel ?? "",
      row.id,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function managerStatsForRows(rows: DealerRow[]) {
  const total = rows.length;
  const active = rows.filter((r) => r.status === "активный").length;
  const top = rows.filter(isDealerTop).length;
  const attention = rows.filter(dealerNeedsAttention).length;
  const potential = rows.filter((r) => r.status === "потенциальный").length;
  return { total, active, top, attention, potential };
}

function groupRowsByManagerKey(rows: DealerRow[]): { key: string; label: string; rows: DealerRow[] }[] {
  const m = new Map<string, { label: string; rows: DealerRow[] }>();
  for (const r of rows) {
    const key = r.releaseManagerId ?? r.manager;
    const label = r.manager || "—";
    const cur = m.get(key) ?? { label, rows: [] as DealerRow[] };
    cur.rows.push(r);
    if (label !== "—") cur.label = label;
    m.set(key, cur);
  }
  return Array.from(m.entries())
    .map(([key, v]) => ({ key, label: v.label, rows: v.rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
}

function viewSectionDataTestId(view: DealerBaseWorkView): string {
  return `section-dealer-base-view-${view.replace(/_/g, "-")}`;
}

function rowBelongsToManager(row: DealerRow, m: Pick<SalesUser, "id" | "name">): boolean {
  if (row.releaseManagerId === m.id) return true;
  return managerDisplayMatchesCatalogName(row.manager, m.name);
}

function OpenDealerButton({ id }: { id: string }) {
  return (
    <Button asChild className="min-h-11 shrink-0 font-semibold" data-testid={`button-open-dealer-${id}`}>
      <Link href={`/dealers/${id}`}>Открыть</Link>
    </Button>
  );
}

function shipmentTrafficBadgeClass(level: "green" | "yellow" | "red"): string {
  if (level === "green") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (level === "yellow") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-rose-300 bg-rose-50 text-rose-950";
}

function ClientListBlock({
  rows,
  empty,
  compact,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  shipmentActiveDayId,
  shipmentUserId,
}: {
  rows: DealerRow[];
  empty: string;
  compact?: boolean;
  workPlanUserId?: string;
  workPlanState?: DealerWorkPlanState;
  showWorkPlanSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleWorkPlanSelect?: (dealerId: string, checked: boolean) => void;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
}) {
  const wp = workPlanUserId && workPlanState;
  if (rows.length === 0) {
    if (!empty.trim()) return null;
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </Card>
    );
  }
  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {rows.map((row) => {
        const hidden = wp ? isDealerHiddenForUser(workPlanUserId, row.id, workPlanState) : false;
        const checked = Boolean(selectedIds?.has(row.id));
        const ship =
          shipmentActiveDayId && shipmentUserId
            ? getDealerShipmentStatus(row, shipmentActiveDayId, shipmentUserId, workPlanState)
            : null;
        const stockSig = getDealerStockSignal(row);
        const programSig = getDealerProgramSignal(row);
        return (
          <Card
            key={row.id}
            className="rounded-2xl border border-border/80 bg-card shadow-sm"
            data-testid={`row-dealer-${row.id}`}
          >
            <CardContent
              className={cn(
                "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                compact ? "p-3 sm:gap-3" : "p-4 sm:gap-4",
              )}
            >
              <div className={cn("min-w-0 flex-1", compact ? "space-y-1" : "space-y-2")}>
                <div className="flex flex-wrap items-center gap-2">
                  {showWorkPlanSelect && wp && onToggleWorkPlanSelect ? (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => onToggleWorkPlanSelect(row.id, v === true)}
                      className="h-5 w-5 shrink-0 touch-manipulation sm:h-4 sm:w-4"
                      data-testid={`checkbox-dealer-select-${row.id}`}
                      aria-label={`Выбрать клиента ${row.name}`}
                    />
                  ) : null}
                  <span className={cn("font-semibold text-foreground", compact && "text-sm")}>{row.name}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getClientCategoryBadgeClass(row.clientCategory))}
                    data-testid={`badge-dealer-client-category-${row.id}`}
                  >
                    {getClientCategoryLabel(row.clientCategory)}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                    {row.status}
                  </Badge>
                  {row.hasProblem ? (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-800">
                      Есть вопрос
                    </Badge>
                  ) : null}
                  {hidden ? (
                    <Badge variant="secondary" className="text-xs font-medium" data-testid={`badge-dealer-hidden-${row.id}`}>
                      Скрыт из рабочего списка
                    </Badge>
                  ) : null}
                  {stockSig.hasMainWarehouse ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-900"
                      data-testid={`badge-dealer-main-warehouse-${row.id}`}
                    >
                      Есть склад
                    </Badge>
                  ) : null}
                  {stockSig.hasHardwareWarehouse ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-violet-300 bg-violet-50 text-[10px] font-medium text-violet-950"
                      data-testid={`badge-dealer-hardware-warehouse-${row.id}`}
                    >
                      Фурнитура
                    </Badge>
                  ) : null}
                  {programSig.hasSpecialConditions ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.special_conditions}-${row.id}`}
                    >
                      Спецусловия
                    </Badge>
                  ) : null}
                  {programSig.hasFranchise ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-cyan-300 bg-cyan-50 text-[10px] font-medium text-cyan-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.franchise}-${row.id}`}
                    >
                      Франшиза
                    </Badge>
                  ) : null}
                  {programSig.hasTandoorClub ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-indigo-300 bg-indigo-50 text-[10px] font-medium text-indigo-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.tandoor_club}-${row.id}`}
                    >
                      Tandoor Club
                    </Badge>
                  ) : null}
                  {programSig.hasCashbackAgent ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-emerald-300 bg-emerald-50 text-[10px] font-medium text-emerald-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.cashback_agent}-${row.id}`}
                    >
                      Кешбек агент
                    </Badge>
                  ) : null}
                  {ship ? (
                    <>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-semibold", shipmentTrafficBadgeClass(ship.level))}
                        data-testid={`badge-dealer-shipment-status-${row.id}`}
                      >
                        {ship.label}
                      </Badge>
                      <p
                        className="w-full basis-full text-[10px] leading-snug text-muted-foreground"
                        data-testid={`text-dealer-shipment-status-reason-${row.id}`}
                      >
                        {ship.reason}
                      </p>
                    </>
                  ) : null}
                </div>
                <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                  Код: {row.releaseCode ?? "—"} · {row.city} · {row.manager}
                </p>
                {!compact ? (
                  <>
                    <p className="text-xs text-muted-foreground">РОП: {getDealerRopDisplay(row) || "—"}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-dealer-client-category-${row.id}`}>
                      Категория клиента: {getClientCategoryLabel(row.clientCategory)}
                      {row.clientTypeLabel ? ` · тип в данных: ${row.clientTypeLabel}` : ""} · ТТ: {row.outlets}
                    </p>
                    {row.releaseAddress ? (
                      <p className="text-xs text-muted-foreground">Адрес: {row.releaseAddress}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Адрес не указан</p>
                    )}
                  </>
                ) : null}
              </div>
              <OpenDealerButton id={row.id} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ClientTableBlock({
  rows,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  shipmentActiveDayId,
  shipmentUserId,
}: {
  rows: DealerRow[];
  workPlanUserId?: string;
  workPlanState?: DealerWorkPlanState;
  showWorkPlanSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleWorkPlanSelect?: (dealerId: string, checked: boolean) => void;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
}) {
  const wp = workPlanUserId && workPlanState;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => {
          const hidden = wp ? isDealerHiddenForUser(workPlanUserId, row.id, workPlanState) : false;
          const checked = Boolean(selectedIds?.has(row.id));
          const ship =
            shipmentActiveDayId && shipmentUserId
              ? getDealerShipmentStatus(row, shipmentActiveDayId, shipmentUserId, workPlanState)
              : null;
          const stockSig = getDealerStockSignal(row);
          const programSig = getDealerProgramSignal(row);
          return (
            <Card key={row.id} className="rounded-2xl border border-border/80 bg-card shadow-sm" data-testid={`row-dealer-${row.id}`}>
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {showWorkPlanSelect && wp && onToggleWorkPlanSelect ? (
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => onToggleWorkPlanSelect(row.id, v === true)}
                        className="h-5 w-5 shrink-0 touch-manipulation sm:h-4 sm:w-4"
                        data-testid={`checkbox-dealer-select-${row.id}`}
                        aria-label={`Выбрать клиента ${row.name}`}
                      />
                    ) : null}
                    <span className="font-semibold">{row.name}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getClientCategoryBadgeClass(row.clientCategory))}
                    data-testid={`badge-dealer-client-category-${row.id}`}
                  >
                    {getClientCategoryLabel(row.clientCategory)}
                  </Badge>
                </div>
                {hidden ? (
                  <Badge variant="secondary" className="w-fit text-xs" data-testid={`badge-dealer-hidden-${row.id}`}>
                    Скрыт из рабочего списка
                  </Badge>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {stockSig.hasMainWarehouse ? (
                    <Badge
                      variant="outline"
                      className="border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-900"
                      data-testid={`badge-dealer-main-warehouse-${row.id}`}
                    >
                      Есть склад
                    </Badge>
                  ) : null}
                  {stockSig.hasHardwareWarehouse ? (
                    <Badge
                      variant="outline"
                      className="border-violet-300 bg-violet-50 text-[10px] font-medium text-violet-950"
                      data-testid={`badge-dealer-hardware-warehouse-${row.id}`}
                    >
                      Фурнитура
                    </Badge>
                  ) : null}
                  {programSig.hasSpecialConditions ? (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.special_conditions}-${row.id}`}
                    >
                      Спецусловия
                    </Badge>
                  ) : null}
                  {programSig.hasFranchise ? (
                    <Badge
                      variant="outline"
                      className="border-cyan-300 bg-cyan-50 text-[10px] font-medium text-cyan-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.franchise}-${row.id}`}
                    >
                      Франшиза
                    </Badge>
                  ) : null}
                  {programSig.hasTandoorClub ? (
                    <Badge
                      variant="outline"
                      className="border-indigo-300 bg-indigo-50 text-[10px] font-medium text-indigo-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.tandoor_club}-${row.id}`}
                    >
                      Tandoor Club
                    </Badge>
                  ) : null}
                  {programSig.hasCashbackAgent ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-300 bg-emerald-50 text-[10px] font-medium text-emerald-950"
                      data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.cashback_agent}-${row.id}`}
                    >
                      Кешбек агент
                    </Badge>
                  ) : null}
                </div>
                {ship ? (
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className={cn("w-fit text-[10px] font-semibold", shipmentTrafficBadgeClass(ship.level))}
                      data-testid={`badge-dealer-shipment-status-${row.id}`}
                    >
                      {ship.label}
                    </Badge>
                    <p className="text-[10px] leading-snug text-muted-foreground" data-testid={`text-dealer-shipment-status-reason-${row.id}`}>
                      {ship.reason}
                    </p>
                  </div>
                ) : null}
                <p className="text-muted-foreground">
                  {row.city} · {row.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.manager} · РОП: {getDealerRopDisplay(row) || "—"}
                </p>
                {row.releaseAddress ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">{row.releaseAddress}</p>
                ) : (
                  <p className="text-xs text-muted-foreground line-clamp-2">Адрес не указан</p>
                )}
                <OpenDealerButton id={row.id} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="hidden min-w-0 sm:block sm:max-w-full sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-border/80 sm:bg-card sm:shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {showWorkPlanSelect ? (
                <th className="w-10 px-2 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" aria-label="Выбор" />
              ) : null}
              {["Код", "Клиент", "Город", "РОП", "Менеджер", "Категория клиента", "Адрес", "Статус", ""].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hidden = wp ? isDealerHiddenForUser(workPlanUserId, row.id, workPlanState) : false;
              const checked = Boolean(selectedIds?.has(row.id));
              const ship =
                shipmentActiveDayId && shipmentUserId
                  ? getDealerShipmentStatus(row, shipmentActiveDayId, shipmentUserId, workPlanState)
                  : null;
              const stockSig = getDealerStockSignal(row);
              const programSig = getDealerProgramSignal(row);
              return (
                <tr key={row.id} className="border-b border-border last:border-0" data-testid={`row-dealer-${row.id}`}>
                  {showWorkPlanSelect && wp && onToggleWorkPlanSelect ? (
                    <td className="px-2 py-3 align-middle">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => onToggleWorkPlanSelect(row.id, v === true)}
                        className="h-5 w-5 shrink-0 touch-manipulation sm:h-4 sm:w-4"
                        data-testid={`checkbox-dealer-select-${row.id}`}
                        aria-label={`Выбрать клиента ${row.name}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.releaseCode ?? "—"}</td>
                  <td className="max-w-[160px] px-3 py-3 align-top" title={row.name}>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-medium">{row.name}</span>
                      {hidden ? (
                        <Badge variant="secondary" className="w-fit text-[10px]" data-testid={`badge-dealer-hidden-${row.id}`}>
                          Скрыт из рабочего списка
                        </Badge>
                      ) : null}
                      <div className="flex flex-wrap gap-1">
                        {stockSig.hasMainWarehouse ? (
                          <Badge
                            variant="outline"
                            className="border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-900"
                            data-testid={`badge-dealer-main-warehouse-${row.id}`}
                          >
                            Есть склад
                          </Badge>
                        ) : null}
                        {stockSig.hasHardwareWarehouse ? (
                          <Badge
                            variant="outline"
                            className="border-violet-300 bg-violet-50 text-[10px] font-medium text-violet-950"
                            data-testid={`badge-dealer-hardware-warehouse-${row.id}`}
                          >
                            Фурнитура
                          </Badge>
                        ) : null}
                        {programSig.hasSpecialConditions ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-950"
                            data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.special_conditions}-${row.id}`}
                          >
                            Спецусловия
                          </Badge>
                        ) : null}
                        {programSig.hasFranchise ? (
                          <Badge
                            variant="outline"
                            className="border-cyan-300 bg-cyan-50 text-[10px] font-medium text-cyan-950"
                            data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.franchise}-${row.id}`}
                          >
                            Франшиза
                          </Badge>
                        ) : null}
                        {programSig.hasTandoorClub ? (
                          <Badge
                            variant="outline"
                            className="border-indigo-300 bg-indigo-50 text-[10px] font-medium text-indigo-950"
                            data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.tandoor_club}-${row.id}`}
                          >
                            Tandoor Club
                          </Badge>
                        ) : null}
                        {programSig.hasCashbackAgent ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-[10px] font-medium text-emerald-950"
                            data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.cashback_agent}-${row.id}`}
                          >
                            Кешбек агент
                          </Badge>
                        ) : null}
                      </div>
                      {ship ? (
                        <>
                          <Badge
                            variant="outline"
                            className={cn("w-fit text-[10px] font-semibold", shipmentTrafficBadgeClass(ship.level))}
                            data-testid={`badge-dealer-shipment-status-${row.id}`}
                          >
                            {ship.label}
                          </Badge>
                          <p className="text-[10px] leading-snug text-muted-foreground" data-testid={`text-dealer-shipment-status-reason-${row.id}`}>
                            {ship.reason}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{row.city}</td>
                  <td className="max-w-[120px] truncate px-3 py-3 text-xs" title={getDealerRopDisplay(row) || "—"}>
                    {getDealerRopDisplay(row) || "—"}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-3 text-xs" title={row.manager}>
                    {row.manager}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-3 py-3 text-xs"
                    title={getClientCategoryLabel(row.clientCategory)}
                    data-testid={`text-dealer-client-category-${row.id}`}
                  >
                    {getClientCategoryLabel(row.clientCategory)}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-xs text-muted-foreground" title={row.releaseAddress}>
                    {row.releaseAddress ?? "Адрес не указан"}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Button asChild size="sm" className="font-semibold" data-testid={`button-open-dealer-${row.id}`}>
                      <Link href={`/dealers/${row.id}`}>Открыть</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DealerBaseSegmentGroups({
  rows,
  compact,
  variant,
  segmentCollapse,
  onToggleSegmentCollapse,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  emptyMessage,
  shipmentActiveDayId,
  shipmentUserId,
}: {
  rows: DealerRow[];
  compact?: boolean;
  variant: "cards" | "table";
  segmentCollapse: DealerBaseSegmentCollapseState;
  onToggleSegmentCollapse: (id: DealerBaseSegmentId) => void;
  workPlanUserId?: string;
  workPlanState?: DealerWorkPlanState;
  showWorkPlanSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleWorkPlanSelect?: (dealerId: string, checked: boolean) => void;
  emptyMessage: string;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
}) {
  const buckets = useMemo(() => partitionDealersBySegment(rows), [rows]);

  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {DEALER_BASE_SEGMENT_ORDER.map((seg) => {
        const segRows = buckets[seg];
        if (!segRows.length) return null;
        const slug = dealerBaseSegmentTestSlug(seg);
        const collapsed = segmentCollapse[seg];
        return (
          <section
            key={seg}
            data-testid={dealerBaseSegmentSectionTestId(seg)}
            className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
          >
            <div className="flex min-w-0 gap-2 border-b border-border/70 bg-muted/15 p-2.5 sm:gap-3 sm:p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 touch-manipulation sm:h-9 sm:w-9"
                aria-expanded={!collapsed}
                aria-label={collapsed ? `Развернуть: ${DEALER_BASE_SEGMENT_LABELS[seg]}` : `Свернуть: ${DEALER_BASE_SEGMENT_LABELS[seg]}`}
                data-testid={`button-dealer-segment-toggle-${slug}`}
                onClick={() => onToggleSegmentCollapse(seg)}
              >
                {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-sm font-semibold leading-tight text-foreground sm:text-base">{DEALER_BASE_SEGMENT_LABELS[seg]}</h3>
                  <span
                    className="text-xs font-medium tabular-nums text-muted-foreground sm:text-sm"
                    data-testid={`text-dealer-segment-count-${slug}`}
                  >
                    {segRows.length}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{DEALER_BASE_SEGMENT_DESCRIPTIONS[seg]}</p>
              </div>
            </div>
            {!collapsed ? (
              <div className="min-w-0 border-t border-border/40 p-2 sm:p-3">
                {variant === "cards" ? (
                  <ClientListBlock
                    rows={segRows}
                    empty=""
                    compact={compact}
                    workPlanUserId={workPlanUserId}
                    workPlanState={workPlanState}
                    showWorkPlanSelect={showWorkPlanSelect}
                    selectedIds={selectedIds}
                    onToggleWorkPlanSelect={onToggleWorkPlanSelect}
                    shipmentActiveDayId={shipmentActiveDayId}
                    shipmentUserId={shipmentUserId}
                  />
                ) : (
                  <ClientTableBlock
                    rows={segRows}
                    workPlanUserId={workPlanUserId}
                    workPlanState={workPlanState}
                    showWorkPlanSelect={showWorkPlanSelect}
                    selectedIds={selectedIds}
                    onToggleWorkPlanSelect={onToggleWorkPlanSelect}
                    shipmentActiveDayId={shipmentActiveDayId}
                    shipmentUserId={shipmentUserId}
                  />
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function ruClientNoun(n: number): "клиент" | "клиента" | "клиентов" {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "клиент";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "клиента";
  return "клиентов";
}

export default function DealerBase() {
  const { profile } = useReleaseDemoProfile();
  const access = useMemo(() => mapSalesRoleToDealerBaseAccess(profile.role), [profile.role]);

  const [workView, setWorkView] = useState<DealerBaseWorkView>(() => {
    const p = loadReleaseDemoProfile();
    return defaultWorkViewForAccess(mapSalesRoleToDealerBaseAccess(p.role));
  });
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [cities, setCities] = useState<string[]>([]);
  const [categories, setCategories] = useState<ClientCategorySelection[]>([]);
  const [ropTeam, setRopTeam] = useState<string>(() => {
    const p = loadReleaseDemoProfile();
    return initialRopManagerForProfile(p, mapSalesRoleToDealerBaseAccess(p.role)).ropTeam;
  });
  const [manager, setManager] = useState<string>(() => {
    const p = loadReleaseDemoProfile();
    return initialRopManagerForProfile(p, mapSalesRoleToDealerBaseAccess(p.role)).manager;
  });

  const routeQs = useRouteSearchParams();
  const routeKey = useMemo(() => routeQs.toString(), [routeQs]);
  const [, setLocation] = useLocation();
  const actx = useClientBaseActualization();

  const showActualizationSync = useMemo(() => canActualizeClientBase(profile), [profile]);

  const [createDealerOpen, setCreateDealerOpen] = useState(false);

  useEffect(() => {
    const allowed = workViewsForAccess(access);
    setWorkView((prev) => (allowed.includes(prev) ? prev : defaultWorkViewForAccess(access)));
  }, [access]);

  const managerCatalogForRop = useMemo(() => getManagersForRopTeam(ropTeam), [ropTeam]);
  const managerOptions = useMemo(
    () => managerOptionsForProfile(profile, access, ropTeam),
    [profile, access, ropTeam],
  );
  const ropSelectOptions = useMemo(() => ropOptionsForProfile(profile, access), [profile, access]);

  const scopedRows = useMemo(
    () => roleScopedDealerRows(actx.enabled ? actx.mergedDealerRows : DEALER_BASE_ROWS, profile),
    [actx.enabled, actx.mergedDealerRows, profile],
  );

  const pickerArgs = useMemo(
    () => ({ search, quick, cities, categories, ropTeam, manager, managerCatalogForRop }),
    [search, quick, cities, categories, ropTeam, manager, managerCatalogForRop],
  );

  const pickerFiltered = useMemo(() => applyPickerFilters(scopedRows, pickerArgs), [scopedRows, pickerArgs]);

  const kpis = useMemo(() => {
    const total = pickerFiltered.length;
    const active = pickerFiltered.filter((r) => r.status === "активный").length;
    const potential = pickerFiltered.filter((r) => r.status === "потенциальный").length;
    const attention = pickerFiltered.filter((r) => r.status === "требует внимания" || r.hasProblem).length;
    const outlets = pickerFiltered.reduce((a, r) => a + r.outlets, 0);
    const avgDist =
      total > 0 ? Math.round(pickerFiltered.reduce((a, r) => a + r.distribution, 0) / total) : 0;
    return { total, active, potential, attention, outlets, avgDist };
  }, [pickerFiltered]);

  const categoryOptions = useMemo(() => {
    const s = new Set<ClientCategoryId>();
    for (const r of scopedRows) s.add(r.clientCategory);
    const order = new Map(CLIENT_CATEGORY_META.map((m) => [m.id, m.order]));
    return Array.from(s).sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
  }, [scopedRows]);

  const cityOptions = useMemo(() => {
    const s = new Set(scopedRows.map((r) => r.city));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [scopedRows]);

  useEffect(() => {
    const d = initialRopManagerForProfile(profile, access);
    if (!routeKey) {
      setRopTeam(d.ropTeam);
      setManager(d.manager);
      setQuick("all");
      setCities([]);
      setCategories([]);
      setSearch("");
      setWorkView(defaultWorkViewForAccess(access));
      setProgramFilters([]);
      return;
    }

    let rop = d.ropTeam;
    let mgr = d.manager;
    let qv: QuickFilter = "all";
    let cityV: string[] = [];
    let catV: ClientCategorySelection[] = [];
    let searchV = "";
    let vw: DealerBaseWorkView = defaultWorkViewForAccess(access);

    const scoped = roleScopedDealerRows(actx.enabled ? actx.mergedDealerRows : DEALER_BASE_ROWS, profile);
    const catOpts = Array.from(new Set(scoped.map((r) => r.clientCategory)));

    const teamRaw = (routeQs.get("team") ?? routeQs.get("rop"))?.trim() ?? "";
    const managerRaw = routeQs.get("manager")?.trim() ?? "";
    const viewRaw = routeQs.get("view")?.trim() ?? "";
    const viewNorm =
      viewRaw.toLowerCase() === "cities"
        ? access === "sales_director"
          ? "cities_all"
          : access === "team_lead"
            ? "team_cities"
            : "my_cities"
        : viewRaw;
    const viewParsed = parseWorkViewFromQuery(viewNorm || null, access);
    const quickRaw = (routeQs.get("quick") ?? "").trim().toLowerCase();
    if (quickRaw && QUICK_FROM_URL[quickRaw]) qv = QUICK_FROM_URL[quickRaw]!;

    if (teamRaw && teamAllowedForProfile(teamRaw, profile, access)) {
      rop = teamRaw;
      mgr = "all";
    }

    if (managerRaw && managerAllowedForRop(managerRaw, rop, profile, access)) {
      mgr = managerRaw;
    }

    if (viewParsed) {
      vw = viewParsed;
    } else if (mgr !== "all" && !isRopOrManagerAllFilter(mgr) && (access === "sales_director" || access === "team_lead")) {
      vw = "my_clients";
    } else if (
      teamRaw &&
      teamAllowedForProfile(teamRaw, profile, access) &&
      !managerRaw &&
      (access === "sales_director" || access === "team_lead")
    ) {
      vw = "my_team";
    }

    const cityRaws = routeQs.getAll("city");
    const cityParsed: string[] = [];
    for (const raw of cityRaws) {
      for (const part of raw.split(",")) {
        const trimmed = part.trim();
        if (!trimmed || trimmed === "all") continue;
        if (scoped.some((r) => r.city === trimmed) && !cityParsed.includes(trimmed)) {
          cityParsed.push(trimmed);
        }
      }
    }
    cityV = cityParsed;

    const catRaws = routeQs.getAll("category");
    const catParsed: ClientCategorySelection[] = [];
    for (const raw of catRaws) {
      for (const part of raw.split(",")) {
        const trimmed = part.trim();
        if (!trimmed || trimmed === "all") continue;
        if (trimmed === "TOP" || trimmed === "top") {
          if (!catParsed.includes("__top_tier__")) catParsed.push("__top_tier__");
        } else if (catOpts.includes(trimmed as ClientCategoryId)) {
          const id = trimmed as ClientCategoryId;
          if (!catParsed.includes(id)) catParsed.push(id);
        }
      }
    }
    catV = catParsed;

    const searchRaw = routeQs.get("search")?.trim();
    if (searchRaw) searchV = searchRaw;

    const programRaws = routeQs.getAll("program");
    const programParsed: DealerProgramFilterId[] = [];
    const programAllowed: DealerProgramFilterId[] = [...DEALER_PROGRAM_FILTER_ORDER];
    for (const raw of programRaws) {
      for (const part of raw.split(",")) {
        const trimmed = part.trim();
        if (!trimmed || trimmed === "all") continue;
        if ((programAllowed as string[]).includes(trimmed) && !programParsed.includes(trimmed as DealerProgramFilterId)) {
          programParsed.push(trimmed as DealerProgramFilterId);
        }
      }
    }

    setRopTeam(rop);
    setManager(mgr);
    setQuick(qv);
    setCities(cityV);
    setCategories(catV);
    setSearch(searchV);
    setWorkView(vw);
    setProgramFilters(programParsed);
  }, [profile.personaUserId, profile.role, access, routeKey, routeQs, actx.enabled, actx.mergedDealerRows]);

  const firstRopTeamId = useMemo(() => getRopOptions()[0]?.teamId ?? "", []);

  const effectiveTeamIdForTeamModes = useMemo(() => {
    if (access === "team_lead") return getEffectiveTeamLeadTeamId(profile);
    if (access === "sales_manager") {
      return getSalesUserById(profile.personaUserId)?.teamId ?? firstRopTeamId;
    }
    if (!isRopOrManagerAllFilter(ropTeam)) return ropTeam;
    return firstRopTeamId;
  }, [access, profile, ropTeam, firstRopTeamId]);

  const teamRowsForModes = useMemo(
    () => scopedRows.filter((r) => r.releaseTeamId === effectiveTeamIdForTeamModes),
    [scopedRows, effectiveTeamIdForTeamModes],
  );

  const teamSummaryForCompactBanner = useMemo(() => {
    if (access !== "sales_director" && access !== "team_lead") return null;
    if (!DEALER_BASE_TEAM_WORK_VIEWS.includes(workView)) return null;
    return buildTeamSummary(effectiveTeamIdForTeamModes);
  }, [access, workView, effectiveTeamIdForTeamModes]);

  const teamRopDisplayLabel = useMemo(
    () => getRopOptions().find((o) => o.teamId === effectiveTeamIdForTeamModes)?.label ?? "—",
    [effectiveTeamIdForTeamModes],
  );

  const selectedManagerLabel = useMemo(() => {
    if (isRopOrManagerAllFilter(manager)) return null;
    const fromCat = managerCatalogForRop.find((m) => m.id === manager);
    if (fromCat) return fromCat.name;
    return getSalesUserById(manager)?.name ?? null;
  }, [manager, managerCatalogForRop]);

  const hideManagerFilterInTeamView =
    (access === "sales_director" || access === "team_lead") &&
    DEALER_BASE_TEAM_WORK_VIEWS.includes(workView);

  const needsManagerSelection =
    (access === "sales_director" || access === "team_lead") &&
    (workView === "my_clients" ||
      workView === "today" ||
      workView === "my_attention" ||
      workView === "my_top" ||
      workView === "my_cities") &&
    isRopOrManagerAllFilter(manager);

  const resultsContextLine = useMemo(() => {
    if ((access === "sales_director" || access === "team_lead") && DEALER_BASE_TEAM_WORK_VIEWS.includes(workView)) {
      return `Показана команда: ${teamRopDisplayLabel}`;
    }
    if (selectedManagerLabel && !isRopOrManagerAllFilter(manager)) {
      if (access === "sales_manager") {
        return `Показаны клиенты: ${selectedManagerLabel}`;
      }
      if (workViewGroup(workView) === "manager") {
        return `Показаны клиенты: ${selectedManagerLabel}`;
      }
      if (
        workView === "table_all" ||
        workView === "table_team" ||
        workView === "risks_all" ||
        workView === "top_all" ||
        workView === "cities_all" ||
        workView === "team_cities"
      ) {
        return `Показаны клиенты: ${selectedManagerLabel}`;
      }
    }
    return null;
  }, [access, workView, manager, selectedManagerLabel, teamRopDisplayLabel]);

  const managerScopedRows = useMemo(() => {
    if (isRopOrManagerAllFilter(manager)) return pickerFiltered;
    const cat = managerCatalogForRop.find((m) => m.id === manager);
    return pickerFiltered.filter((row) => {
      if (row.releaseManagerId === manager) return true;
      return Boolean(cat && managerDisplayMatchesCatalogName(row.manager, cat.name));
    });
  }, [pickerFiltered, manager, managerCatalogForRop]);

  const teamTablePickerRows = useMemo(
    () => applyPickerFilters(teamRowsForModes, pickerArgs),
    [teamRowsForModes, pickerArgs],
  );

  const cityRowsDept = useMemo(() => buildCityConcentrationRows(pickerFiltered), [pickerFiltered]);
  const cityRowsTeam = useMemo(() => buildCityConcentrationRows(teamTablePickerRows), [teamTablePickerRows]);
  const cityRowsManager = useMemo(() => buildCityConcentrationRows(managerScopedRows), [managerScopedRows]);

  const allCitiesHref = useMemo(() => buildDealerBaseAllCitiesHref(profile.role, profile), [profile]);
  const cityRowHref = useCallback(
    (city: string) => buildDealerBaseCityDrillHref(profile.role, profile, city, { ropTeamId: ropTeam }),
    [profile, ropTeam],
  );
  const cityActiveHref = useCallback(
    (city: string) => buildDealerBaseCityDrillHref(profile.role, profile, city, { quick: "active", ropTeamId: ropTeam }),
    [profile, ropTeam],
  );
  const cityAttentionHref = useCallback(
    (city: string) => buildDealerBaseCityDrillHref(profile.role, profile, city, { quick: "attention", ropTeamId: ropTeam }),
    [profile, ropTeam],
  );

  const viewRows = useMemo(() => {
    const limit = DEALER_BASE_DISPLAY_LIMIT;
    const pick = pickerFiltered;
    switch (workView) {
      case "risks_all":
        return pick.filter(isDealerBusinessRisk).slice(0, limit);
      case "top_all":
        return pick.filter(isDealerTop).slice(0, limit);
      case "team_attention":
        return teamRowsForModes.filter(dealerNeedsAttention).slice(0, limit);
      case "day_plan_team":
        return buildDayPlanTeamRows(teamRowsForModes, limit);
      case "today":
        return pickTodayContactRows(needsManagerSelection ? [] : managerScopedRows, TODAY_LIMIT);
      case "my_attention":
        return (needsManagerSelection ? [] : managerScopedRows).filter(dealerNeedsAttention).slice(0, limit);
      case "my_top":
        return (needsManagerSelection ? [] : managerScopedRows).filter(isDealerTop).slice(0, limit);
      case "my_cities":
      case "cities_all":
      case "team_cities":
      case "by_manager":
      case "teams":
      case "my_team":
        return [];
      default:
        return [];
    }
  }, [
    workView,
    pickerFiltered,
    teamRowsForModes,
    managerScopedRows,
    needsManagerSelection,
  ]);

  const displayRows = useMemo(() => {
    const limit = DEALER_BASE_DISPLAY_LIMIT;
    if (
      workView === "risks_all" ||
      workView === "top_all" ||
      workView === "team_attention" ||
      workView === "day_plan_team" ||
      workView === "today" ||
      workView === "my_attention" ||
      workView === "my_top"
    ) {
      return viewRows;
    }
    if (workView === "my_clients") {
      if (needsManagerSelection) return [];
      return managerScopedRows.slice(0, limit);
    }
    if (workView === "table_all") {
      return pickerFiltered.slice(0, limit);
    }
    if (workView === "table_team") {
      return applyPickerFilters(teamRowsForModes, pickerArgs).slice(0, limit);
    }
    return [];
  }, [
    workView,
    viewRows,
    pickerFiltered,
    pickerArgs,
    teamRowsForModes,
    managerScopedRows,
    needsManagerSelection,
  ]);

  const cap = DEALER_BASE_DISPLAY_LIMIT;

  const onRopChange = useCallback(
    (v: string) => {
      setRopTeam(v);
      setManager((prev) => {
        if (prev === "all") return prev;
        const allowed = getManagersForRopTeam(v).some((m) => m.id === prev);
        return allowed ? prev : "all";
      });
    },
    [],
  );

  const handleSelectWorkView = useCallback(
    (v: DealerBaseWorkView) => {
      setWorkView(v);
      if (workViewGroup(v) === "team" && (access === "sales_director" || access === "team_lead")) {
        setManager("all");
      }
    },
    [access],
  );

  const handleManagerChange = useCallback(
    (v: string) => {
      setManager(v);
      if (!isRopOrManagerAllFilter(v)) {
        if (workViewsForAccess(access).includes("my_clients")) setWorkView("my_clients");
      } else if (workViewsForAccess(access).includes("my_team")) {
        setWorkView("my_team");
      }
    },
    [access],
  );

  const resultsCapTotal = useMemo(() => {
    switch (workView) {
      case "risks_all":
        return pickerFiltered.filter(isDealerBusinessRisk).length;
      case "top_all":
        return pickerFiltered.filter(isDealerTop).length;
      case "team_attention":
        return teamRowsForModes.filter(dealerNeedsAttention).length;
      case "day_plan_team":
        return buildDayPlanTeamRows(teamRowsForModes, 1_000_000).length;
      case "today":
        if (needsManagerSelection) return 0;
        return managerScopedRows.length;
      case "my_attention":
        if (needsManagerSelection) return 0;
        return managerScopedRows.filter(dealerNeedsAttention).length;
      case "my_top":
        if (needsManagerSelection) return 0;
        return managerScopedRows.filter(isDealerTop).length;
      case "my_clients":
        if (needsManagerSelection) return 0;
        return managerScopedRows.length;
      case "table_all":
        return pickerFiltered.length;
      case "table_team":
        return applyPickerFilters(teamRowsForModes, pickerArgs).length;
      default:
        return null;
    }
  }, [
    workView,
    pickerFiltered,
    teamRowsForModes,
    managerScopedRows,
    needsManagerSelection,
    pickerArgs,
  ]);

  const setRopManagerFromClick = (tid: string, mid: string) => {
    setRopTeam(tid);
    setManager(mid);
    if (workViewsForAccess(access).includes("my_clients")) setWorkView("my_clients");
  };

  const hintSelectRop =
    access === "sales_director" && workView === "my_team" && isRopOrManagerAllFilter(ropTeam) ? (
      <p className="text-sm text-muted-foreground">
        Выберите РОПа в фильтре выше, чтобы посмотреть команду. Превью: команда «
        {getRopOptions().find((o) => o.teamId === effectiveTeamIdForTeamModes)?.label ?? "—"}».
      </p>
    ) : null;

  const groupUi = groupLabelsForAccess(access);

  const hideResultsCap =
    needsManagerSelection &&
    (workView === "my_clients" || workView === "today" || workView === "my_attention" || workView === "my_top");

  const canMutateWorkPlan = profile.role !== "marketer" && profile.role !== "analyst";

  const [workPlanBump, setWorkPlanBump] = useState(0);
  const [workPlanFilter, setWorkPlanFilter] = useState<WorkPlanListFilter>(() =>
    profile.role === "marketer" || profile.role === "analyst" ? "all" : "active",
  );
  const [selectedWpIds, setSelectedWpIds] = useState<Set<string>>(() => new Set());
  const [wpScheduleDate, setWpScheduleDate] = useState("");
  const [wpNote, setWpNote] = useState("");
  const [segmentList, setSegmentList] = useState<DealerBaseSegmentId[]>([]);
  const [stockListFilter, setStockListFilter] = useState<DealerStockListFilterId>("all");
  const [programFilters, setProgramFilters] = useState<DealerProgramFilterId[]>([]);
  const [segmentCollapse, setSegmentCollapse] = useState<DealerBaseSegmentCollapseState>(() => {
    const narrow = typeof window !== "undefined" && window.innerWidth < 768;
    return { ...defaultDealerBaseSegmentCollapse(narrow), ...loadDealerBaseSegmentCollapseOverrides() };
  });
  const [activeShipmentDayId, setActiveShipmentDayId] = useState<DealerShipmentDayId | null>(null);
  const [routeBump, setRouteBump] = useState(0);
  const [trafficBump, setTrafficBump] = useState(0);
  const [characteristicsBump, setCharacteristicsBump] = useState(0);
  const [activeRouteSlotForBulk, setActiveRouteSlotForBulk] = useState<ShipmentRouteSlotId>("slot1");
  const [shipmentRouteCityFilter, setShipmentRouteCityFilter] = useState<null | {
    slotId: ShipmentRouteSlotId;
    routeName: string;
    settlements: string[];
    previousCities: string[];
    /** В маршруте заданы НП, но в текущем scope/дне нет клиентов — не оставляем фильтр прошлого маршрута. */
    noClientsInCurrentScope?: boolean;
  }>(null);

  const toggleSegmentCollapse = useCallback((id: DealerBaseSegmentId) => {
    setSegmentCollapse((prev) => {
      const n = { ...prev, [id]: !prev[id] };
      saveDealerBaseSegmentCollapseState(n);
      return n;
    });
  }, []);

  useEffect(() => {
    const h = () => setWorkPlanBump((n) => n + 1);
    window.addEventListener(DEALER_WORK_PLAN_EVENT, h);
    return () => window.removeEventListener(DEALER_WORK_PLAN_EVENT, h);
  }, []);

  useEffect(() => {
    const h = () => setRouteBump((n) => n + 1);
    window.addEventListener(DEALER_ROUTE_PLAN_EVENT, h);
    return () => window.removeEventListener(DEALER_ROUTE_PLAN_EVENT, h);
  }, []);

  useEffect(() => {
    const h = () => setTrafficBump((n) => n + 1);
    window.addEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, h);
    window.addEventListener(SHOWCASE_STORAGE_EVENT, h);
    return () => {
      window.removeEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, h);
      window.removeEventListener(SHOWCASE_STORAGE_EVENT, h);
    };
  }, []);

  useEffect(() => {
    const h = () => setCharacteristicsBump((n) => n + 1);
    window.addEventListener(DEALER_CHARACTERISTICS_EVENT, h);
    return () => window.removeEventListener(DEALER_CHARACTERISTICS_EVENT, h);
  }, []);

  const workPlanState = useMemo(() => loadDealerWorkPlanState(), [workPlanBump]);

  const rowsForWorkPlan = useMemo(
    () => filterDealersByWorkPlan(displayRows, profile.personaUserId, workPlanFilter, workPlanState),
    [displayRows, profile.personaUserId, workPlanFilter, workPlanState],
  );

  const rowsAfterSegmentFilter = useMemo(() => {
    if (segmentList.length === 0) return rowsForWorkPlan;
    const set = new Set(segmentList);
    return rowsForWorkPlan.filter((r) => set.has(getDealerBaseSegment(r)));
  }, [rowsForWorkPlan, segmentList]);

  /** Для маршрутов: те же права/рабочий план, но без фильтра ТОП-сегмента — чтобы не «терялись» клиенты. */
  const rowsForRoutePlanning = useMemo(() => rowsForWorkPlan, [rowsForWorkPlan]);

  const rowsAfterShipmentDay = useMemo(() => {
    if (!activeShipmentDayId) return rowsAfterSegmentFilter;
    return rowsAfterSegmentFilter.filter((r) => getDealerShipmentDays(r).includes(activeShipmentDayId));
  }, [rowsAfterSegmentFilter, activeShipmentDayId]);

  const rowsAfterPrograms = useMemo(() => {
    if (programFilters.length === 0) return rowsAfterShipmentDay;
    return rowsAfterShipmentDay.filter((r) => dealerRowMatchesProgramFilters(r, programFilters));
  }, [rowsAfterShipmentDay, programFilters, characteristicsBump]);

  const programCounts = useMemo(() => {
    let special = 0;
    let franchise = 0;
    let club = 0;
    let cashback = 0;
    for (const r of rowsAfterShipmentDay) {
      const s = getDealerProgramSignal(r);
      if (s.hasSpecialConditions) special += 1;
      if (s.hasFranchise) franchise += 1;
      if (s.hasTandoorClub) club += 1;
      if (s.hasCashbackAgent) cashback += 1;
    }
    return {
      special_conditions: special,
      franchise,
      tandoor_club: club,
      cashback_agent: cashback,
    };
  }, [rowsAfterShipmentDay, characteristicsBump]);

  const toggleProgramFilter = useCallback((id: DealerProgramFilterId) => {
    setProgramFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const rowsFinalForList = useMemo(() => {
    if (stockListFilter === "all") return rowsAfterPrograms;
    return rowsAfterPrograms.filter((r) => dealerRowMatchesStockFilter(r, stockListFilter));
  }, [rowsAfterPrograms, stockListFilter]);

  const stockFilterSummary = useMemo(() => {
    let main = 0;
    let hw = 0;
    for (const r of rowsAfterShipmentDay) {
      const s = getDealerStockSignal(r);
      if (s.hasMainWarehouse) main += 1;
      if (s.hasHardwareWarehouse) hw += 1;
    }
    return { main, hardware: hw };
  }, [rowsAfterShipmentDay]);

  useEffect(() => {
    const allowed = new Set(rowsFinalForList.map((r) => r.id));
    setSelectedWpIds((prev) => {
      let changed = false;
      const n = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) n.add(id);
        else changed = true;
      });
      if (!changed && n.size === prev.size) return prev;
      return n;
    });
  }, [rowsFinalForList]);

  const selectedWpRows = useMemo(
    () => rowsFinalForList.filter((r) => selectedWpIds.has(r.id)),
    [rowsFinalForList, selectedWpIds],
  );

  const routePlanState = useMemo(() => loadDealerRoutePlanState(), [routeBump]);
  const routeDefsByDay = useMemo(() => {
    const uid = profile.personaUserId;
    const out: Record<DealerShipmentDayId, ShipmentRouteDefinition[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    };
    for (const d of DEALER_SHIPMENT_DAY_ORDER) {
      out[d] = listRouteDefinitions(uid, d, routePlanState);
    }
    return out;
  }, [profile.personaUserId, routePlanState]);

  const dealerById = useMemo(() => new Map(DEALER_BASE_ROWS.map((r) => [r.id, r])), []);

  const routeRowsBySlot = useMemo((): Record<ShipmentRouteSlotId, DealerRow[]> => {
    if (!activeShipmentDayId) return { slot1: [], slot2: [] };
    const uid = profile.personaUserId;
    const defs = listRouteDefinitions(uid, activeShipmentDayId, routePlanState);
    const out: Record<ShipmentRouteSlotId, DealerRow[]> = { slot1: [], slot2: [] };
    for (const def of defs) {
      const ids = computeDisplayedRouteDealerIds(uid, activeShipmentDayId, def, rowsForRoutePlanning, routePlanState);
      out[def.slotId] = ids.map((id) => dealerById.get(id)).filter((r): r is DealerRow => Boolean(r));
    }
    return out;
  }, [activeShipmentDayId, profile.personaUserId, routePlanState, dealerById, rowsForRoutePlanning]);

  const settlementRowsBySlot = useMemo((): Record<ShipmentRouteSlotId, DealerRow[]> => {
    return { ...routeRowsBySlot };
  }, [routeRowsBySlot]);

  const shipmentDaySummary = useMemo(() => {
    if (!activeShipmentDayId) return null;
    const label = DEALER_SHIPMENT_DAY_LABELS[activeShipmentDayId];
    const defs = listRouteDefinitions(profile.personaUserId, activeShipmentDayId, routePlanState);
    if (defs.length === 0) {
      return `День отгрузки: ${label}`;
    }
    const parts = defs.map((def) => {
      const cnt = countDealersOnRouteSettlements(profile.personaUserId, activeShipmentDayId, def, rowsForRoutePlanning);
      return `${def.name}: ${cnt} ${ruClientNoun(cnt)}`;
    });
    return `День отгрузки: ${label} · ${parts.join(" · ")}`;
  }, [activeShipmentDayId, profile.personaUserId, routePlanState, rowsForRoutePlanning]);

  const shipmentRouteFilterBanner = useMemo(() => {
    if (!shipmentRouteCityFilter) return null;
    if (shipmentRouteCityFilter.noClientsInCurrentScope) {
      return `В выбранном маршруте нет клиентов в текущей выборке (${shipmentRouteCityFilter.routeName}).`;
    }
    const settlementsText = shipmentRouteCityFilter.settlements.filter(Boolean).join(", ");
    return `Показаны клиенты маршрута: ${shipmentRouteCityFilter.routeName} · ${settlementsText}`;
  }, [shipmentRouteCityFilter]);

  const clearShipmentRouteCityFilter = useCallback(() => {
    setShipmentRouteCityFilter((prev) => {
      if (prev) setCities(prev.previousCities);
      return null;
    });
  }, []);

  const handleSelectShipmentDay = useCallback((d: DealerShipmentDayId) => {
    setShipmentRouteCityFilter((prev) => {
      if (prev) setCities(prev.previousCities);
      return null;
    });
    setActiveShipmentDayId(d);
    setActiveRouteSlotForBulk("slot1");
  }, []);

  const handleResetShipmentDay = useCallback(() => {
    setShipmentRouteCityFilter((prev) => {
      if (prev) setCities(prev.previousCities);
      return null;
    });
    setActiveShipmentDayId(null);
    setActiveRouteSlotForBulk("slot1");
  }, []);

  const handleShowRouteClients = useCallback(
    (slotId: ShipmentRouteSlotId, settlements: string[]) => {
      if (!activeShipmentDayId) return;
      const trimmed = settlements.map((s) => s.trim()).filter(Boolean);
      const lc = (s: string) => s.trim().toLowerCase();
      const valid = trimmed.filter((c) => {
        const target = lc(c);
        return rowsForRoutePlanning.some(
          (r) => lc(r.city) === target && getDealerShipmentDays(r).includes(activeShipmentDayId),
        );
      });
      const defs = listRouteDefinitions(profile.personaUserId, activeShipmentDayId, routePlanState);
      const defMeta = defs.find((x) => x.slotId === slotId);
      const routeName = defMeta?.name ?? "Маршрут";
      const noClients = valid.length === 0;
      setShipmentRouteCityFilter((prev) => ({
        slotId,
        routeName,
        settlements: trimmed,
        previousCities: prev ? prev.previousCities : [...cities],
        noClientsInCurrentScope: noClients,
      }));
      setCities(noClients ? [] : [...valid]);
      setActiveRouteSlotForBulk(slotId);
    },
    [activeShipmentDayId, profile.personaUserId, routePlanState, rowsForRoutePlanning, cities],
  );

  const canMutateRoute = canMutateWorkPlan;

  const showClientShipmentAndSegments = useMemo(
    () =>
      !needsManagerSelection &&
      (workView === "risks_all" ||
        workView === "top_all" ||
        workView === "team_attention" ||
        workView === "day_plan_team" ||
        workView === "today" ||
        workView === "my_attention" ||
        workView === "my_top" ||
        workView === "my_clients" ||
        workView === "table_all" ||
        workView === "table_team"),
    [needsManagerSelection, workView],
  );

  const getShipmentStatusForRow = useCallback(
    (row: DealerRow) =>
      getDealerShipmentStatus(row, activeShipmentDayId ?? "monday", profile.personaUserId, workPlanState),
    [activeShipmentDayId, profile.personaUserId, workPlanState, trafficBump],
  );

  const toggleWpSelect = useCallback((dealerId: string, checked: boolean) => {
    setSelectedWpIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(dealerId);
      else n.delete(dealerId);
      return n;
    });
  }, []);

  const buildDealerAbsHref = useCallback((dealerId: string) => {
    const rel = buildBrowserHashAppHref(`/dealers/${dealerId}`);
    if (typeof window === "undefined") return rel;
    try {
      return new URL(rel, window.location.origin).href;
    } catch {
      return rel;
    }
  }, []);

  const workPlanListProps = useMemo(
    () => ({
      workPlanUserId: profile.personaUserId,
      workPlanState,
      showWorkPlanSelect: canMutateWorkPlan,
      selectedIds: selectedWpIds,
      onToggleWorkPlanSelect: toggleWpSelect,
    }),
    [profile.personaUserId, workPlanState, canMutateWorkPlan, selectedWpIds, toggleWpSelect],
  );

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6 sm:space-y-8" data-testid="page-dealer-base">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Клиентская база</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Клиентская база: поиск, фильтры и переход в карточку клиента.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
          {canCreateDealerDuringActualization(profile) && actx.enabled ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-create"
              onClick={() => setCreateDealerOpen(true)}
            >
              Добавить клиента
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-start" asChild>
            <Link
              href={buildHashPath("/client-map", {
                ...(cities.length > 0 ? { city: cities.join(",") } : {}),
                ...(isRopOrManagerAllFilter(ropTeam) ? {} : { team: ropTeam }),
                ...(isRopOrManagerAllFilter(manager) ? {} : { manager }),
                ...(quick !== "all" ? { quick } : {}),
              })}
              data-testid="button-dealer-base-open-client-map"
            >
              Карта клиентов
            </Link>
          </Button>
        </div>
      </div>

      {showActualizationSync ? (
        <ClientBaseActualizationSyncStatus
          isLoading={actx.loading}
          meta={actx.meta}
          syncStatus={actx.syncStatus}
          onRetry={() => void actx.refresh()}
        />
      ) : null}

      <DealerActualizationCreateDialog
        open={createDealerOpen}
        onOpenChange={setCreateDealerOpen}
        profile={profile}
        onCreated={(id) => setLocation(`/dealers/${encodeURIComponent(id)}`)}
      />

      <section className="space-y-3" data-testid="section-dealer-base-kpis">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Всего клиентов", value: String(kpis.total) },
            { label: "Активные", value: String(kpis.active) },
            { label: "Потенциальные", value: String(kpis.potential) },
            { label: "Требуют внимания", value: String(kpis.attention) },
            { label: "Торговые точки", value: String(kpis.outlets) },
            { label: "Средняя дистрибуция", value: `${kpis.avgDist}%` },
          ].map((k) => (
            <Card key={k.label} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardHeader className="p-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{k.value}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span data-testid="text-dealer-stock-main-count">Со складом: {stockFilterSummary.main}</span>
          <span data-testid="text-dealer-stock-hardware-count">Склад фурнитуры: {stockFilterSummary.hardware}</span>
        </div>
      </section>

      <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: название, код, город, РОП, менеджер, тип, адрес"
              className="min-h-11 rounded-xl border-border pl-10"
              data-testid="input-dealer-base-search"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={quick === f.id ? "default" : "outline"}
                className={cn("rounded-full", quick === f.id ? "" : "border-border bg-card")}
                onClick={() => setQuick(f.id)}
                data-testid={f.testId}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5" data-testid="section-dealer-base-program-filters">
            <p className="text-xs font-medium text-muted-foreground">Признаки</p>
            <div className="flex flex-wrap gap-2">
              {DEALER_PROGRAM_FILTER_ORDER.map((id) => {
                const active = programFilters.includes(id);
                return (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={cn("rounded-full", active ? "" : "border-border bg-card")}
                    onClick={() => toggleProgramFilter(id)}
                    aria-pressed={active}
                    data-testid={DEALER_PROGRAM_FILTER_BUTTON_TESTID[id]}
                  >
                    {DEALER_PROGRAM_FILTER_LABELS[id]} · {programCounts[id]}
                  </Button>
                );
              })}
              {programFilters.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-xs"
                  onClick={() => setProgramFilters([])}
                  data-testid="filter-programs-reset"
                >
                  Сбросить
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Рабочий план</Label>
              <Select value={workPlanFilter} onValueChange={(v) => setWorkPlanFilter(v as WorkPlanListFilter)}>
                <SelectTrigger className="min-h-10 w-full min-w-0 max-w-[16rem] rounded-xl" data-testid="select-dealer-work-plan-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(WORK_PLAN_FILTER_LABELS) as WorkPlanListFilter[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {WORK_PLAN_FILTER_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Сегмент списка</Label>
              <MultiSelect
                options={DEALER_BASE_SEGMENT_ORDER.map((s) => ({ value: s, label: DEALER_BASE_SEGMENT_LABELS[s] }))}
                value={segmentList}
                onChange={(next) => setSegmentList(next as DealerBaseSegmentId[])}
                placeholder="Все сегменты"
                allLabel="Все сегменты"
                triggerClassName="min-h-10 max-w-[16rem]"
                testId="select-dealer-segment-filter"
                ariaLabel="Сегмент списка"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Склад</Label>
              <Select value={stockListFilter} onValueChange={(v) => setStockListFilter(v as DealerStockListFilterId)}>
                <SelectTrigger className="min-h-10 w-full min-w-0 max-w-[16rem] rounded-xl" data-testid="select-dealer-stock-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DEALER_STOCK_FILTER_LABELS) as DealerStockListFilterId[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {DEALER_STOCK_FILTER_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div
            className={cn(
              "grid min-w-0 gap-4 sm:grid-cols-2",
              hideManagerFilterInTeamView ? "lg:grid-cols-3" : "lg:grid-cols-4",
            )}
          >
            <div className="min-w-0 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Город</Label>
              <MultiSelect
                options={cityOptions.map((c) => ({ value: c, label: c }))}
                value={cities}
                onChange={setCities}
                placeholder="Все города"
                allLabel="Все города"
                testId="select-dealer-base-city"
                ariaLabel="Город"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Категория клиента</Label>
              <MultiSelect
                options={categoryOptions.map((c) => ({ value: c, label: getClientCategoryLabel(c) }))}
                value={categories as string[]}
                onChange={(next) => setCategories(next as ClientCategorySelection[])}
                placeholder="Все категории"
                allLabel="Все категории"
                testId="select-dealer-base-category"
                ariaLabel="Категория клиента"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">РОП</Label>
              <Select value={ropTeam} onValueChange={onRopChange}>
                <SelectTrigger className="min-h-11 min-w-0 rounded-xl" data-testid="select-dealer-base-rop">
                  <SelectValue placeholder="РОП" />
                </SelectTrigger>
                <SelectContent>
                  {access === "sales_director" ? (
                    <SelectItem value="all">Все РОПы</SelectItem>
                  ) : null}
                  {ropSelectOptions.map((r) => (
                    <SelectItem key={r.teamId} value={r.teamId}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!hideManagerFilterInTeamView ? (
              <div className="min-w-0 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Менеджер</Label>
                <Select value={manager} onValueChange={handleManagerChange}>
                  <SelectTrigger className="min-h-11 min-w-0 rounded-xl" data-testid="select-dealer-base-manager">
                    <SelectValue placeholder="Менеджер" />
                  </SelectTrigger>
                  <SelectContent>
                    {access === "sales_director" || access === "team_lead" ? (
                      <SelectItem value="all">Все менеджеры</SelectItem>
                    ) : null}
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {hideManagerFilterInTeamView ? (
            <p className="text-xs text-muted-foreground" data-testid="text-dealer-base-manager-filter-hint">
              Выберите режим менеджера, чтобы смотреть клиентов конкретного менеджера.
            </p>
          ) : null}

          <section className="space-y-4 border-t border-border pt-4" data-testid="section-dealer-base-role-views">
            <p className="text-xs font-medium text-muted-foreground">Рабочий режим:</p>
            <div className="flex min-w-0 flex-col gap-6">
              {groupUi.department ? (
                <div className="min-w-0 space-y-2" data-testid="section-dealer-base-role-group-department">
                  <p className="text-sm font-semibold text-foreground">Отдел</p>
                  <div className="flex flex-wrap gap-2">
                    {viewsInGroupForAccess(access, "department").map((vid) => (
                      <Button
                        key={vid}
                        type="button"
                        size="sm"
                        variant={workView === vid ? "default" : "outline"}
                        className={cn("rounded-full", workView !== vid && "border-border bg-card")}
                        onClick={() => handleSelectWorkView(vid)}
                        data-testid={`button-dealer-base-view-${vid}`}
                      >
                        {DEALER_BASE_VIEW_LABELS[vid]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {groupUi.team ? (
                <div className="min-w-0 space-y-2" data-testid="section-dealer-base-role-group-team">
                  <p className="text-sm font-semibold text-foreground">Команда</p>
                  <div className="flex flex-wrap gap-2">
                    {viewsInGroupForAccess(access, "team").map((vid) => (
                      <Button
                        key={vid}
                        type="button"
                        size="sm"
                        variant={workView === vid ? "default" : "outline"}
                        className={cn("rounded-full", workView !== vid && "border-border bg-card")}
                        onClick={() => handleSelectWorkView(vid)}
                        data-testid={`button-dealer-base-view-${vid}`}
                      >
                        {DEALER_BASE_VIEW_LABELS[vid]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {groupUi.manager ? (
                <div className="min-w-0 space-y-2" data-testid="section-dealer-base-role-group-manager">
                  <p className="text-sm font-semibold text-foreground">Менеджер</p>
                  <div className="flex flex-wrap gap-2">
                    {viewsInGroupForAccess(access, "manager").map((vid) => (
                      <Button
                        key={vid}
                        type="button"
                        size="sm"
                        variant={workView === vid ? "default" : "outline"}
                        className={cn("rounded-full", workView !== vid && "border-border bg-card")}
                        onClick={() => handleSelectWorkView(vid)}
                        data-testid={`button-dealer-base-view-${vid}`}
                      >
                        {DEALER_BASE_VIEW_LABELS[vid]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </CardContent>
      </Card>

      {resultsCapTotal !== null && !hideResultsCap ? (
        <p className="text-sm text-muted-foreground" data-testid="text-dealer-base-display-cap">
          Показано {rowsFinalForList.length} из {resultsCapTotal}
          {workView === "today" ? ` (лимит режима «Сегодня» ${TODAY_LIMIT})` : ""}
          {workView !== "today" && resultsCapTotal > cap ? ` (лимит отображения ${cap})` : ""}.
          {resultsCapTotal > displayRows.length && workView !== "today"
            ? " Уточните поиск или фильтры, чтобы сузить список."
            : null}
        </p>
      ) : null}

      <section className="min-w-0" data-testid="section-dealer-base-results">
        {showClientShipmentAndSegments ? (
          <div className="mb-3 min-w-0 space-y-3">
            <DealerShipmentDayPlanner
              userId={profile.personaUserId}
              rowsForRouteSettlementCounts={rowsForRoutePlanning}
              routeDefsByDay={routeDefsByDay}
              settlementOptions={cityOptions}
              activeShipmentDayId={activeShipmentDayId}
              onSelectDay={handleSelectShipmentDay}
              onResetDay={handleResetShipmentDay}
              activeDaySummaryLine={shipmentDaySummary}
              routeFilterBanner={shipmentRouteFilterBanner}
              onClearRouteFilter={clearShipmentRouteCityFilter}
              canEditRoute={canMutateRoute}
              routeRowsBySlot={routeRowsBySlot}
              settlementRowsBySlot={settlementRowsBySlot}
              onShowRouteClients={handleShowRouteClients}
              getShipmentStatus={getShipmentStatusForRow}
              buildDealerHref={buildDealerAbsHref}
            />
          </div>
        ) : null}
        {canMutateWorkPlan && selectedWpIds.size > 0 ? (
          <div className="mb-3 min-w-0">
            <DealerWorkPlanBulkBar
              selectedRows={selectedWpRows}
              scheduleDate={wpScheduleDate}
              onScheduleDateChange={setWpScheduleDate}
              note={wpNote}
              onNoteChange={setWpNote}
              onSchedule={() => {
                if (!wpScheduleDate.trim()) return;
                scheduleDealersForUser(profile.personaUserId, Array.from(selectedWpIds), wpScheduleDate, wpNote);
                setSelectedWpIds(new Set());
              }}
              onHide={() => {
                hideDealersForUser(profile.personaUserId, Array.from(selectedWpIds));
                setSelectedWpIds(new Set());
              }}
              onRestore={() => {
                restoreDealersForUser(profile.personaUserId, Array.from(selectedWpIds));
                setSelectedWpIds(new Set());
              }}
              onCopy={() => {}}
              onClearSelection={() => setSelectedWpIds(new Set())}
              buildDealerHref={buildDealerAbsHref}
              showAddToRoute={Boolean(activeShipmentDayId && canMutateRoute)}
              onAddToRoute={() => {
                if (!activeShipmentDayId || !canMutateRoute) return;
                addDealersToRoute(profile.personaUserId, activeShipmentDayId, Array.from(selectedWpIds), activeRouteSlotForBulk);
                setSelectedWpIds(new Set());
              }}
              addToRouteDisabled={selectedWpIds.size === 0}
            />
          </div>
        ) : null}
        {resultsContextLine ? (
          <p className="mb-3 text-sm font-medium text-foreground" data-testid="text-dealer-base-results-context">
            {resultsContextLine}
          </p>
        ) : null}
        {teamSummaryForCompactBanner ? (
          <div className="mb-4 min-w-0 max-w-full" data-testid="section-dealer-base-team-compact-summary">
            <TeamSummaryCard
              variant="compact"
              summary={teamSummaryForCompactBanner}
              ctaHref={buildBrowserHashAppHref("/dealer-base", { team: teamSummaryForCompactBanner.teamId })}
              ctaLabel="Открыть команду"
              showCta={false}
            />
          </div>
        ) : null}
        {workView === "teams" ? (
          <div className="space-y-6" data-testid={viewSectionDataTestId("teams")}>
            {getRopOptions().map((rop) => {
              const mgrs = getTeamManagers(rop.teamId);
              return (
                <Card key={rop.teamId} className="rounded-2xl border border-border/80 bg-card shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{rop.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">Команда · карточки менеджеров</p>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {mgrs.map((m) => {
                      const rows = DEALER_BASE_ROWS.filter(
                        (r) => r.releaseTeamId === rop.teamId && rowBelongsToManager(r, m),
                      );
                      const st = managerStatsForRows(rows);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="rounded-xl border border-border/80 bg-muted/20 p-4 text-left transition hover:bg-muted/40"
                          onClick={() => setRopManagerFromClick(rop.teamId, m.id)}
                        >
                          <p className="font-semibold text-foreground">{m.name}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <span>Всего: {st.total}</span>
                            <span>Активные: {st.active}</span>
                            <span>ТОП-сегмент: {st.top}</span>
                            <span>Внимание: {st.attention}</span>
                            <span className="col-span-2">Потенциальные: {st.potential}</span>
                          </div>
                          <p className="mt-2 text-[11px] text-primary">Нажмите, чтобы применить РОП + менеджера</p>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {workView === "cities_all" ? (
          <CityConcentrationBlock
            variant="dealer"
            rows={cityRowsDept}
            showAllHref={allCitiesHref}
            cityHref={cityRowHref}
            activeHref={cityActiveHref}
            attentionHref={cityAttentionHref}
            showAllLink={false}
          />
        ) : null}

        {workView === "team_cities" ? (
          <CityConcentrationBlock
            variant="dealer"
            rows={cityRowsTeam}
            showAllHref={allCitiesHref}
            cityHref={cityRowHref}
            activeHref={cityActiveHref}
            attentionHref={cityAttentionHref}
            showAllLink={false}
          />
        ) : null}

        {workView === "my_team" ? (
          <div className="space-y-3" data-testid={viewSectionDataTestId("my_team")}>
            {hintSelectRop}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {getTeamManagers(effectiveTeamIdForTeamModes).map((m) => {
                const rows = teamRowsForModes.filter((r) => rowBelongsToManager(r, m));
                const st = managerStatsForRows(rows);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition hover:border-primary/40"
                    onClick={() => setRopManagerFromClick(effectiveTeamIdForTeamModes, m.id)}
                  >
                    <p className="font-semibold text-foreground">{m.name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Всего: {st.total}</span>
                      <span>Активные: {st.active}</span>
                      <span>ТОП-сегмент: {st.top}</span>
                      <span>Внимание: {st.attention}</span>
                      <span className="col-span-2">Потенциальные: {st.potential}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {workView === "by_manager" ? (
          <div className="space-y-6" data-testid={viewSectionDataTestId("by_manager")}>
            {groupRowsByManagerKey(teamRowsForModes).map((g) => (
              <Card key={g.key} className="rounded-2xl border border-border/80 bg-card shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{g.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">{g.rows.length} клиентов</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.rows.slice(0, 40).map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                      data-testid={`row-dealer-${row.id}`}
                    >
                      <span className="min-w-0 font-medium">{row.name}</span>
                      <OpenDealerButton id={row.id} />
                    </div>
                  ))}
                  {g.rows.length > 40 ? (
                    <p className="text-xs text-muted-foreground">Показаны 40 из {g.rows.length} в группе.</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {workView === "my_cities" ? (
          <div className="space-y-3" data-testid={viewSectionDataTestId("my_cities")}>
            {needsManagerSelection ? (
              <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Выберите менеджера в фильтре выше, чтобы увидеть группировку по городам.
              </Card>
            ) : (
              <CityConcentrationBlock
                variant="dealer"
                rows={cityRowsManager}
                showAllHref={allCitiesHref}
                cityHref={cityRowHref}
                activeHref={cityActiveHref}
                attentionHref={cityAttentionHref}
                showAllLink={false}
              />
            )}
          </div>
        ) : null}

        {needsManagerSelection && workView !== "my_cities" ? (
          <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Выберите менеджера в фильтре выше, чтобы увидеть данные в этом режиме.
          </Card>
        ) : null}

        {!needsManagerSelection &&
        (workView === "risks_all" ||
          workView === "top_all" ||
          workView === "team_attention" ||
          workView === "day_plan_team" ||
          workView === "today" ||
          workView === "my_attention" ||
          workView === "my_top" ||
          workView === "my_clients") ? (
          <div
            data-testid={viewSectionDataTestId(workView)}
            className={workView === "my_clients" ? "space-y-2" : "space-y-3"}
          >
            {workView === "my_clients" ? (
              <DealerBaseSegmentGroups
                rows={rowsFinalForList}
                compact
                variant="cards"
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Нет клиентов по выбранным фильтрам."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                {...workPlanListProps}
              />
            ) : (
              <DealerBaseSegmentGroups
                rows={rowsFinalForList}
                variant="cards"
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Нет записей."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                {...workPlanListProps}
              />
            )}
          </div>
        ) : null}

        {workView === "table_all" ? (
          <div data-testid={viewSectionDataTestId("table_all")}>
            {rowsFinalForList.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Ничего не найдено.
              </Card>
            ) : (
              <DealerBaseSegmentGroups
                rows={rowsFinalForList}
                variant="table"
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Ничего не найдено."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                {...workPlanListProps}
              />
            )}
          </div>
        ) : null}

        {workView === "table_team" ? (
          <div data-testid={viewSectionDataTestId("table_team")}>
            {rowsFinalForList.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Нет клиентов команды по фильтрам.
              </Card>
            ) : (
              <DealerBaseSegmentGroups
                rows={rowsFinalForList}
                variant="table"
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Нет клиентов команды по фильтрам."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                {...workPlanListProps}
              />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
