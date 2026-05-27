import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  Info,
  LayoutGrid,
  LayoutTemplate,
  List,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  getClientCategoryBadgeClass,
  getClientCategoryLabel,
  isClientTopTier,
} from "@/lib/client-category";
import { getDealerRegionalManagerEffectiveDisplay } from "@/lib/dealer-regional-manager-overrides";
import {
  buildDealerRowsFromReleaseClients,
  DEALER_BASE_ROWS,
  getDealerRopDisplay,
  type DealerRow,
  type DealerStatus,
} from "@/lib/dealer-base-mock-data";
import {
  getManagersForRopTeam,
  getRopOptions,
  isRopOrManagerAllFilter,
  managerDisplayMatchesCatalogName,
} from "@/lib/rop-manager-filters";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { loadReleaseDemoProfile, getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getSalesUserById, getTeamManagers, getAllSalesManagers, type SalesUser } from "@/lib/sales-control-data";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";
import { buildAssignmentsMap, getVisibleReleaseClients } from "@/lib/real-client-base";
import {
  realAllSalesManagers,
  realEffectiveTeamLeadTeamId,
  realInitialRopManagerDefaults,
  realManagerOptionsForAccess,
  realRopOptions,
  realRopOptionsForAccess,
  realSalesUserById,
  realTeamManagers,
} from "@/lib/real-org-adapter";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { useMyVisibleClientCodes } from "@/lib/use-my-visible-client-codes";
import { roleScopedDealerRowsForReal } from "@/lib/dealer-base-real-scope";
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
import {
  applyDealerBasePickerFilters,
  type ClientCategorySelection,
  type QuickFilter,
} from "@/lib/dealer-base-picker-filters";
import { ArchiveInArchiveBadge, archivedEntityRowClassName, isDealerArchivedInActualization } from "@/components/archive-record-visual";
import { CityConcentrationBlock } from "@/components/city-concentration-block";
import { DealerActualizationCreateDialog } from "@/components/client-base-actualization-dealer-forms";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { DealerBaseManagementCockpit } from "@/pages/dealer-base-management-cockpit";
import {
  canActualizeClientBase,
  canArchiveDealerDuringActualization,
  canCreateDealerDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { isManualActualizationDealerId } from "@/lib/client-base-actualization-stable-ids";
import { mergeActualizationState, type TrashedDealerInfo } from "@/lib/client-base-actualization-state";
import { makeTrashedDealerInfo, snapshotDealerFromRow } from "@/lib/trash-dealer-helper";
import { mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import { getManualDealerDisplayCode } from "@/lib/client-base-actualization-stable-ids";
import { countShowcaseMatrixDeficitForDealer } from "@/lib/trade-point-list-for-actualization";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import {
  clientNextStepActionLabel,
  getClientNextStepForDealer,
  loadClientNextStepsStorage,
} from "@/lib/client-next-step-data";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildTeamSummaryFromRows } from "@/lib/team-summary";
import { TeamSummaryCard } from "@/components/team-summary-card";
import { buildCityConcentrationRows, buildDealerBaseAllCitiesHref, buildDealerBaseCityDrillHref } from "@/lib/city-concentration";
import { buildBrowserHashAppHref, buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import { fetchClientBaseOverview } from "@/lib/client-base-overview-api";
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
import { DealerBulkDeleteCheckbox } from "@/components/dealer-bulk-delete-checkbox";
import { DealerBaseDealerShowcaseGrid } from "@/components/dealer-base-dealer-showcase-grid";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import { cleanContactDisplay, mailtoHref, telHref, whatsAppHref } from "@/lib/dealer-contact-links";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { normalizeGeoCompare, parseDealerGeoFromRow } from "@/lib/dealer-base-geo-parse";

const DEALER_BASE_DISPLAY_LIMIT = 300;
const TODAY_LIMIT = 100;

const DEALER_BASE_FILTERS_COLLAPSED_LS_KEY = "tandoor-dealer-base-filters-collapsed-v1";
/** Legacy: режимы «карточки / витрина / …»; мигрируем в {@link SHOWCASE_DENSITY_LS_KEY}. */
const DEALER_BASE_VIEW_MODE_LS_KEY = "tandoor-dealer-base-view-mode-v1";
const SHOWCASE_DENSITY_LS_KEY = "tandoor-dealer-showcase-density-v1";

/** Плотность отображения внутри основного режима «Витрина дилеров». */
type DealerShowcaseDensity = "large" | "grid" | "list" | "table";

function parseShowcaseDensity(raw: string | null): DealerShowcaseDensity | null {
  if (raw === "large" || raw === "grid" || raw === "list" || raw === "table") return raw;
  if (raw === "compact") return "grid";
  return null;
}

/** Миграция со старого ключа `tandoor-dealer-base-view-mode-v1`. */
function migrateLegacyDealerBaseViewMode(legacyRaw: string | null, narrowViewport: boolean): DealerShowcaseDensity {
  const legacy = legacyRaw?.trim();
  if (!legacy) return narrowViewport ? "grid" : "large";
  if (legacy === "dealer_showcase" || legacy === "cards") return narrowViewport ? "grid" : "large";
  if (legacy === "compact") return "grid";
  if (legacy === "list") return "list";
  if (legacy === "table") return "table";
  return narrowViewport ? "grid" : "large";
}

function readShowcaseDensityFromStorage(): DealerShowcaseDensity {
  if (typeof window === "undefined") return "large";
  const narrow = window.innerWidth < 768;
  try {
    const d = parseShowcaseDensity(localStorage.getItem(SHOWCASE_DENSITY_LS_KEY));
    if (d) return d;
    const old = localStorage.getItem(DEALER_BASE_VIEW_MODE_LS_KEY);
    return migrateLegacyDealerBaseViewMode(old, narrow);
  } catch {
    return narrow ? "grid" : "large";
  }
}

function formatIsoDayToRuShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth < 768;
}

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
  realCtx?: { snap: OrgSnapshot; userId: string },
): boolean {
  const ropList = realCtx ? realRopOptions(realCtx.snap) : getRopOptions();
  if (!ropList.some((o) => o.teamId === teamId)) return false;
  if (access === "sales_director") return true;
  if (access === "team_lead") {
    const eff = realCtx ? realEffectiveTeamLeadTeamId(realCtx.snap) : getEffectiveTeamLeadTeamId(profile);
    return teamId === eff;
  }
  const u = realCtx ? realSalesUserById(realCtx.snap, realCtx.userId) : getSalesUserById(profile.personaUserId);
  return Boolean(u?.teamId === teamId);
}

function managerAllowedForRop(
  managerId: string,
  ropTeamId: string,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
  realCtx?: { snap: OrgSnapshot; userId: string },
): boolean {
  if (access === "sales_manager") {
    const u = realCtx ? realSalesUserById(realCtx.snap, realCtx.userId) : getSalesUserById(profile.personaUserId);
    return Boolean(u?.id === managerId);
  }
  const pool = realCtx
    ? isRopOrManagerAllFilter(ropTeamId)
      ? realAllSalesManagers(realCtx.snap)
      : realTeamManagers(realCtx.snap, ropTeamId)
    : access === "sales_director" && isRopOrManagerAllFilter(ropTeamId)
      ? getAllSalesManagers()
      : getManagersForRopTeam(ropTeamId);
  return pool.some((m) => m.id === managerId);
}

const QUICK_FILTERS: { id: QuickFilter; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-dealers-all" },
  { id: "active", label: "Активные", testId: "filter-dealers-active" },
  { id: "potential", label: "Потенциальные", testId: "filter-dealers-potential" },
  { id: "attention", label: "Требуют внимания", testId: "filter-dealers-attention" },
  { id: "top", label: "ТОП", testId: "filter-dealers-top" },
  { id: "closed", label: "Закрытые", testId: "filter-dealers-closed" },
];

function statusBadgeClass(status: DealerStatus) {
  void status;
  return "border-primary/30 bg-card text-foreground";
}

function shipmentTrafficBadgeClass(level: "green" | "yellow" | "red"): string {
  if (level === "green") return "border-primary/40 bg-primary/10 text-foreground";
  if (level === "yellow") return "border-primary/45 bg-card text-foreground";
  return "border-destructive/45 bg-destructive/10 text-destructive";
}

type ClientCategoryRouteFilter = ClientCategoryId | "all" | "__top_tier__";

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

type DealerListArchiveBulkProps = {
  selectedIds: Set<string>;
  selectableIds: Set<string>;
  onToggle: (dealerId: string, checked: boolean) => void;
};

type DealerBaseNextStepsStorage = ReturnType<typeof loadClientNextStepsStorage>;

type DealerRowRendererBaseProps = {
  rows: DealerRow[];
  empty: string;
  profile: ReleaseDemoProfile;
  actualizationState: ActualizationState;
  workPlanUserId?: string;
  workPlanState?: DealerWorkPlanState;
  showWorkPlanSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleWorkPlanSelect?: (dealerId: string, checked: boolean) => void;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
  archiveBulk?: DealerListArchiveBulkProps;
  nextStepsStorage: DealerBaseNextStepsStorage;
};

function archivedDealerListBadge(row: DealerRow, act: ActualizationState): ReactNode {
  if (!isDealerArchivedInActualization(row.id, act)) return null;
  return <ArchiveInArchiveBadge testId={`badge-dealer-archived-${row.id}`} />;
}

function ClientCompactGridBlock({
  rows,
  empty,
  profile,
  actualizationState,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  shipmentActiveDayId,
  shipmentUserId,
  archiveBulk,
  nextStepsStorage: _nextStepsStorage,
}: DealerRowRendererBaseProps) {
  const wp = workPlanUserId && workPlanState;
  void _nextStepsStorage;
  void shipmentActiveDayId;
  void shipmentUserId;
  if (rows.length === 0) {
    if (!empty.trim()) return null;
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </Card>
    );
  }
  const badgeOutline = "border-primary/35 bg-card text-foreground";
  const badgeSoft = "border-primary/30 bg-primary/10 text-foreground";

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => {
        const hidden = wp ? isDealerHiddenForUser(workPlanUserId, row.id, workPlanState) : false;
        const checked = Boolean(selectedIds?.has(row.id));
        const stockSig = getDealerStockSignal(row);
        const programSig = getDealerProgramSignal(row);
        const codeStr = showcaseClientCode(row, actualizationState);
        const metaLine = [row.city?.trim() || "—", codeStr, getClientCategoryLabel(row.clientCategory)].join(" · ");
        const rowArchived = isDealerArchivedInActualization(row.id, actualizationState);

        const extraBadges: ReactNode[] = [];
        if (stockSig.hasMainWarehouse) {
          extraBadges.push(
            <Badge key="mw" variant="outline" className={cn("px-1 py-0 text-[9px] font-semibold", badgeSoft)} data-testid={`badge-dealer-main-warehouse-${row.id}`}>
              Склад
            </Badge>,
          );
        }
        if (stockSig.hasHardwareWarehouse) {
          extraBadges.push(
            <Badge key="hw" variant="outline" className={cn("px-1 py-0 text-[9px] font-semibold", badgeSoft)} data-testid={`badge-dealer-hardware-warehouse-${row.id}`}>
              Фурн
            </Badge>,
          );
        }
        if (programSig.hasTandoorClub) {
          extraBadges.push(
            <Badge key="tc" variant="outline" className={cn("px-1 py-0 text-[9px] font-semibold", badgeSoft)} data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.tandoor_club}-${row.id}`}>
              ТК
            </Badge>,
          );
        }
        if (programSig.hasCashbackAgent) {
          extraBadges.push(
            <Badge key="cb" variant="outline" className={cn("px-1 py-0 text-[9px] font-semibold", badgeSoft)} data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.cashback_agent}-${row.id}`}>
              КБ
            </Badge>,
          );
        }
        if (programSig.hasSpecialConditions) {
          extraBadges.push(
            <Badge key="su" variant="outline" className={cn("px-1 py-0 text-[9px] font-semibold", badgeSoft)} data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.special_conditions}-${row.id}`}>
              СУ
            </Badge>,
          );
        }
        const badgeCap = 4;
        const visExtra = extraBadges.slice(0, badgeCap);
        const extraRest = extraBadges.length - visExtra.length;

        return (
          <Card
            key={row.id}
            className={cn(
              "overflow-hidden rounded-xl border border-border border-l-4 border-l-primary bg-card shadow-sm",
              archivedEntityRowClassName(rowArchived),
            )}
            data-testid={`card-dealer-compact-${row.id}`}
          >
            <CardContent
              className="flex min-h-0 flex-col gap-2 p-2.5"
              data-testid={`section-dealer-showcase-card-grid-${row.id}`}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-1.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                  {showWorkPlanSelect && wp && onToggleWorkPlanSelect ? (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => onToggleWorkPlanSelect(row.id, v === true)}
                      className="h-4 w-4 shrink-0"
                      data-testid={`checkbox-dealer-workplan-select-${row.id}`}
                      aria-label={`Выбрать клиента ${row.name} для плана работ`}
                    />
                  ) : null}
                  {archiveBulk?.selectableIds.has(row.id) ? (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded border border-destructive/45 bg-destructive/[0.06] px-1 py-0.5",
                        showWorkPlanSelect && wp && onToggleWorkPlanSelect && "border-l-2 border-l-destructive/50 pl-1",
                      )}
                      data-testid={`wrap-dealer-bulk-select-${row.id}`}
                    >
                      <span className="text-[9px] font-semibold uppercase leading-none text-destructive">Удал.</span>
                      <DealerBulkDeleteCheckbox
                        checked={archiveBulk.selectedIds.has(row.id)}
                        onCheckedChange={(v) => archiveBulk.onToggle(row.id, v === true)}
                        data-testid={`checkbox-dealer-select-${row.id}`}
                        aria-label={`Удалить клиента ${row.name} из рабочей базы`}
                      />
                    </span>
                  ) : null}
                </div>
                <Button asChild size="sm" variant="secondary" className="h-7 shrink-0 px-2 text-[11px] font-semibold">
                  <Link href={`/dealers/${row.id}`} data-testid={`button-open-dealer-${row.id}`}>
                    Открыть
                  </Link>
                </Button>
              </div>
              <ShowcaseCoverPhotoSlot kind="dealer" dealer={row} profile={profile} size="grid" rounded="lg" className="w-full shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{row.name}</p>
                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground min-[380px]:line-clamp-1">{metaLine}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge
                    variant="outline"
                    className={cn("px-1.5 py-0 text-[10px] font-medium", badgeOutline)}
                    data-testid={`badge-dealer-client-category-${row.id}`}
                  >
                    {getClientCategoryLabel(row.clientCategory)}
                  </Badge>
                  <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", statusBadgeClass(row.status))}>
                    {row.status}
                  </Badge>
                  {archivedDealerListBadge(row, actualizationState)}
                </div>
                {row.outlets > 1 ? (
                  <Badge variant="outline" className={cn("w-fit px-1.5 py-0 text-[10px] tabular-nums", badgeOutline)}>
                    Сеть · {row.outlets} ТТ
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn("w-fit px-1.5 py-0 text-[10px] tabular-nums", badgeOutline)}>
                    {row.outlets} ТТ
                  </Badge>
                )}
                {hidden ? (
                  <Badge variant="secondary" className="w-fit text-[10px]" data-testid={`badge-dealer-hidden-${row.id}`}>
                    Скрыт
                  </Badge>
                ) : null}
                <div className="flex max-w-full flex-wrap gap-1">
                  {visExtra}
                  {extraRest > 0 ? (
                    <Badge variant="outline" className={cn("px-1 py-0 text-[9px] font-semibold tabular-nums", badgeOutline)}>
                      +{extraRest}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function innCell(row: DealerRow): string {
  const t = (row.actualizationInn ?? "").trim();
  return t || "—";
}

function showcaseClientCode(row: DealerRow, act: ActualizationState): string {
  const rel = row.releaseCode?.trim();
  if (rel) return rel;
  const m = act.manuallyCreatedDealersById[row.id];
  if (m) return getManualDealerDisplayCode(m);
  return "—";
}

function dealerShowcaseAggregateHint(row: DealerRow, act: ActualizationState): string | null {
  const merged = mergeTradePointsForActualization(row, act).filter((e) => !e.isArchived);
  if (merged.length === 0) return null;
  for (const e of merged) {
    const sh = act.tradePointShowcaseActualizationById[e.point.id];
    if (countShowcaseMatrixDeficitForDealer(row, act, sh) > 0) return "Дефицит витрины";
  }
  const anyFilled = merged.some((e) => {
    const sh = act.tradePointShowcaseActualizationById[e.point.id];
    return sh?.hasShowcase != null;
  });
  if (!anyFilled) return "Витрина не заполнена";
  return "Витрина";
}

function ClientListRowsBlock({
  rows,
  empty,
  profile,
  actualizationState,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  shipmentActiveDayId,
  shipmentUserId,
  archiveBulk,
  nextStepsStorage,
}: DealerRowRendererBaseProps) {
  const wp = workPlanUserId && workPlanState;
  void shipmentActiveDayId;
  void shipmentUserId;
  if (rows.length === 0) {
    if (!empty.trim()) return null;
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </Card>
    );
  }

  const badgeOutline = "border-primary/35 bg-card text-foreground";
  const badgeSoft = "border-primary/30 bg-primary/10 text-foreground";

  const iconBtnClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-primary/10";

  return (
    <div className="min-w-0 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {rows.map((row) => {
        const hidden = wp ? isDealerHiddenForUser(workPlanUserId, row.id, workPlanState) : false;
        const checked = Boolean(selectedIds?.has(row.id));
        const ns = getClientNextStepForDealer(row.id, nextStepsStorage);
        const nextLine = ns ? `${clientNextStepActionLabel(ns.actionType)} · ${formatIsoDayToRuShort(ns.contactDate)}` : null;
        const phone = cleanContactDisplay(row.contacts?.phone);
        const email = cleanContactDisplay(row.contacts?.email);
        const tel = phone ? telHref(phone) : null;
        const wa = phone ? whatsAppHref(phone) : null;
        const mail = email ? mailtoHref(email) : null;
        const showcaseHint = dealerShowcaseAggregateHint(row, actualizationState);
        const codeStr = showcaseClientCode(row, actualizationState);
        const innLine = innCell(row);
        const rowArchived = isDealerArchivedInActualization(row.id, actualizationState);
        return (
          <div
            key={row.id}
            className={cn(
              "flex min-w-0 items-stretch gap-1.5 p-2 sm:gap-2 sm:p-2.5",
              archivedEntityRowClassName(rowArchived),
            )}
            data-testid={`row-dealer-showcase-list-${row.id}`}
          >
            <div className="flex shrink-0 flex-col items-start gap-1 pt-0.5">
              {showWorkPlanSelect && wp && onToggleWorkPlanSelect ? (
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => onToggleWorkPlanSelect(row.id, v === true)}
                  className="h-4 w-4"
                  data-testid={`checkbox-dealer-workplan-select-${row.id}`}
                  aria-label={`Выбрать клиента ${row.name} для плана работ`}
                />
              ) : null}
              {archiveBulk?.selectableIds.has(row.id) ? (
                <span className="inline-flex flex-col items-center gap-0.5 rounded-md border border-destructive/35 bg-destructive/[0.04] px-1 py-1" data-testid={`wrap-dealer-bulk-select-${row.id}`}>
                  <span className="text-[8px] font-bold uppercase text-destructive">Del</span>
                  <DealerBulkDeleteCheckbox
                    checked={archiveBulk.selectedIds.has(row.id)}
                    onCheckedChange={(v) => archiveBulk.onToggle(row.id, v === true)}
                    data-testid={`checkbox-dealer-select-${row.id}`}
                    aria-label={`Удалить клиента ${row.name} из рабочей базы`}
                  />
                </span>
              ) : null}
            </div>
            <Link
              href={`/dealers/${row.id}`}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg pr-1 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary sm:gap-3"
              data-testid={`link-dealer-list-open-${row.id}`}
            >
              <ShowcaseCoverPhotoSlot kind="dealer" dealer={row} profile={profile} size="list" rounded="md" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{row.name}</p>
                <p className="line-clamp-1 text-[11px] text-muted-foreground">{row.city}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                  {[innLine !== "—" ? `ИНН ${innLine}` : null, `Код ${codeStr}`].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-0.5 flex max-w-full flex-wrap items-center gap-1">
                  <span data-testid={`text-dealer-client-category-${row.id}`}>
                    <Badge variant="outline" className={cn("text-[10px]", badgeOutline)} data-testid={`badge-dealer-client-category-${row.id}`}>
                      {getClientCategoryLabel(row.clientCategory)}
                    </Badge>
                  </span>
                  <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(row.status))}>
                    {row.status}
                  </Badge>
                  {archivedDealerListBadge(row, actualizationState)}
                  <Badge variant="outline" className={cn("text-[10px] tabular-nums", badgeOutline)}>
                    {row.outlets} ТТ
                  </Badge>
                  {showcaseHint ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "max-w-full truncate text-[9px]",
                        showcaseHint === "Дефицит витрины" ? badgeSoft : badgeOutline,
                      )}
                    >
                      {showcaseHint}
                    </Badge>
                  ) : null}
                  {hidden ? (
                    <Badge variant="secondary" className="text-[10px]" data-testid={`badge-dealer-hidden-${row.id}`}>
                      Скрыт
                    </Badge>
                  ) : null}
                </div>
                {nextLine ? <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{nextLine}</p> : null}
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
              {tel ? (
                <a href={tel} className={iconBtnClass} data-testid={`link-dealer-list-call-${row.id}`} aria-label="Позвонить" onClick={(e) => e.stopPropagation()}>
                  <Phone className="h-4 w-4 text-primary" />
                </a>
              ) : (
                <span className={cn(iconBtnClass, "cursor-not-allowed opacity-45")} title="Телефон не указан" aria-hidden>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </span>
              )}
              {wa ? (
                <a href={wa} className={iconBtnClass} data-testid={`link-dealer-list-whatsapp-${row.id}`} aria-label="WhatsApp" onClick={(e) => e.stopPropagation()}>
                  <MessageCircle className="h-4 w-4 text-primary" />
                </a>
              ) : (
                <span className={cn(iconBtnClass, "cursor-not-allowed opacity-45")} title="Телефон не указан" aria-hidden>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </span>
              )}
              {mail ? (
                <a href={mail} className={cn(iconBtnClass, "hidden sm:inline-flex")} data-testid={`link-dealer-list-email-${row.id}`} aria-label="Email" onClick={(e) => e.stopPropagation()}>
                  <Mail className="h-4 w-4 text-primary" />
                </a>
              ) : null}
              <Button asChild size="sm" variant="secondary" className="h-9 shrink-0 px-2 text-xs font-semibold sm:hidden">
                <Link href={`/dealers/${row.id}`} data-testid={`button-open-dealer-mobile-${row.id}`} onClick={(e) => e.stopPropagation()}>
                  Открыть
                </Link>
              </Button>
              <Button asChild size="sm" variant="secondary" className="hidden h-9 shrink-0 px-2 text-xs font-semibold sm:inline-flex">
                <Link href={`/dealers/${row.id}`} data-testid={`button-open-dealer-${row.id}`} onClick={(e) => e.stopPropagation()}>
                  Открыть
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type TableSortKey = "name" | "city" | "category" | "manager";

function sortDealerRowsForTable(rows: DealerRow[], key: TableSortKey, dir: "asc" | "desc"): DealerRow[] {
  const mul = dir === "asc" ? 1 : -1;
  const cmp = (a: string, b: string) => a.localeCompare(b, "ru") * mul;
  return [...rows].sort((ra, rb) => {
    switch (key) {
      case "name":
        return cmp(ra.name, rb.name);
      case "city":
        return cmp(ra.city, rb.city);
      case "category":
        return cmp(ra.clientCategory, rb.clientCategory);
      case "manager":
        return cmp(ra.manager, rb.manager);
      default:
        return 0;
    }
  });
}

function DealerBaseDataTable({
  rows,
  empty,
  profile,
  actualizationState,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  shipmentActiveDayId,
  shipmentUserId,
  archiveBulk,
  nextStepsStorage,
}: DealerRowRendererBaseProps) {
  const wp = workPlanUserId && workPlanState;
  const [sortKey, setSortKey] = useState<TableSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const onHeaderClick = (key: TableSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  };

  const sortedRows = useMemo(() => sortDealerRowsForTable(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  if (rows.length === 0) {
    if (!empty.trim()) return null;
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </Card>
    );
  }

  const showArchiveBulkCol = Boolean(archiveBulk && rows.some((r) => archiveBulk.selectableIds.has(r.id)));

  const sortableTh = (key: TableSortKey, label: string, className?: string) => (
    <th className={cn("whitespace-nowrap px-2 py-2", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-muted/80"
        onClick={() => onHeaderClick(key)}
      >
        {label}
        {sortKey === key ? <span className="text-[10px] text-muted-foreground">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
      <table className="w-full min-w-[72rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {showWorkPlanSelect ? <th className="w-10 px-2 py-2" aria-label="Выбор" /> : null}
            {showArchiveBulkCol ? (
              <th className="w-14 px-2 py-2 text-center text-destructive">Удал.</th>
            ) : null}
            <th className="w-11 px-1 py-2 text-center font-normal normal-case" aria-label="Фото" />
            <th className="px-2 py-2">Код</th>
            {sortableTh("name", "Клиент")}
            <th className="px-2 py-2">ИНН</th>
            {sortableTh("city", "Город")}
            {sortableTh("category", "Категория")}
            <th className="px-2 py-2">РОП</th>
            {sortableTh("manager", "Менеджер")}
            <th className="px-2 py-2">Склад</th>
            <th className="px-2 py-2">Tandoor Club</th>
            <th className="px-2 py-2">Cashback</th>
            <th className="px-2 py-2">ТТ</th>
            <th className="min-w-[9rem] px-2 py-2">След. шаг</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const hidden = wp ? isDealerHiddenForUser(workPlanUserId, row.id, workPlanState) : false;
            const checked = Boolean(selectedIds?.has(row.id));
            const stockSig = getDealerStockSignal(row);
            const programSig = getDealerProgramSignal(row);
            const ns = getClientNextStepForDealer(row.id, nextStepsStorage);
            const nextLine = ns ? `${clientNextStepActionLabel(ns.actionType)} · ${formatIsoDayToRuShort(ns.contactDate)}` : "—";
            const ship =
              shipmentActiveDayId && shipmentUserId
                ? getDealerShipmentStatus(row, shipmentActiveDayId, shipmentUserId, workPlanState)
                : null;
            const stockShort = [stockSig.hasMainWarehouse ? "Д" : "", stockSig.hasHardwareWarehouse ? "Ф" : ""].filter(Boolean).join("+") || "—";
            const rowArchived = isDealerArchivedInActualization(row.id, actualizationState);
            return (
              <tr
                key={row.id}
                className={cn("border-b border-border/80 last:border-0", archivedEntityRowClassName(rowArchived))}
                data-testid={`row-dealer-table-${row.id}`}
              >
                {showWorkPlanSelect && wp && onToggleWorkPlanSelect ? (
                  <td className="px-2 py-1.5 align-middle">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => onToggleWorkPlanSelect(row.id, v === true)}
                      className="h-4 w-4"
                      data-testid={`checkbox-dealer-workplan-select-${row.id}`}
                      aria-label={`Выбрать клиента ${row.name} для плана работ`}
                    />
                  </td>
                ) : null}
                {showArchiveBulkCol && archiveBulk ? (
                  <td className="bg-destructive/[0.04] px-2 py-1.5 text-center align-middle">
                    {archiveBulk.selectableIds.has(row.id) ? (
                      <DealerBulkDeleteCheckbox
                        checked={archiveBulk.selectedIds.has(row.id)}
                        onCheckedChange={(v) => archiveBulk.onToggle(row.id, v === true)}
                        data-testid={`checkbox-dealer-select-${row.id}`}
                        aria-label={`Удалить клиента ${row.name} из рабочей базы`}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className="px-1 py-1.5 align-middle" data-testid={`cell-dealer-showcase-table-photo-${row.id}`}>
                  <div className="flex justify-center">
                    <ShowcaseCoverPhotoSlot kind="dealer" dealer={row} profile={profile} size="table" rounded="md" />
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs text-muted-foreground">{row.releaseCode ?? "—"}</td>
                <td className="max-w-[11rem] px-2 py-1.5 align-top text-xs">
                  <div className="line-clamp-2 font-medium" title={row.name}>
                    {row.name}
                  </div>
                  {archivedDealerListBadge(row, actualizationState)}
                  {hidden ? (
                    <Badge variant="secondary" className="mt-0.5 w-fit text-[10px]" data-testid={`badge-dealer-hidden-${row.id}`}>
                      Скрыт
                    </Badge>
                  ) : null}
                  {ship ? (
                    <div className="mt-0.5 space-y-0.5">
                      <Badge variant="outline" className={cn("text-[10px]", shipmentTrafficBadgeClass(ship.level))} data-testid={`badge-dealer-shipment-status-${row.id}`}>
                        {ship.label}
                      </Badge>
                    </div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">{innCell(row)}</td>
                <td className="max-w-[6rem] truncate px-2 py-1.5 text-xs" title={row.city}>
                  {row.city}
                </td>
                <td className="max-w-[7rem] px-2 py-1.5 text-xs" data-testid={`text-dealer-client-category-${row.id}`}>
                  <span className="line-clamp-2">{getClientCategoryLabel(row.clientCategory)}</span>
                </td>
                <td className="max-w-[7rem] truncate px-2 py-1.5 text-xs" title={getDealerRopDisplay(row) || ""}>
                  {getDealerRopDisplay(row) || "—"}
                </td>
                <td className="max-w-[7rem] truncate px-2 py-1.5 text-xs" title={row.manager}>
                  {row.manager}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs">{stockShort}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs">{programSig.hasTandoorClub ? "Да" : "—"}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs">{programSig.hasCashbackAgent ? "Да" : "—"}</td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-xs">{row.outlets}</td>
                <td className="max-w-[11rem] px-2 py-1.5 text-xs text-muted-foreground" title={nextLine}>
                  <span className="line-clamp-2">{nextLine}</span>
                </td>
                <td className="px-2 py-1.5">
                  <Button asChild size="sm" variant="secondary" className="h-8 text-xs font-semibold">
                    <Link href={`/dealers/${row.id}`} data-testid={`button-open-dealer-${row.id}`}>
                      Открыть
                    </Link>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DealerBaseSegmentGroups({
  rows,
  showcaseDensity,
  narrowViewport,
  nextStepsStorage,
  segmentCollapse,
  onToggleSegmentCollapse,
  profile,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  emptyMessage,
  shipmentActiveDayId,
  shipmentUserId,
  archiveBulk,
  actualizationState,
}: {
  rows: DealerRow[];
  showcaseDensity: DealerShowcaseDensity;
  narrowViewport: boolean;
  nextStepsStorage: DealerBaseNextStepsStorage;
  segmentCollapse: DealerBaseSegmentCollapseState;
  onToggleSegmentCollapse: (id: DealerBaseSegmentId) => void;
  profile: ReleaseDemoProfile;
  workPlanUserId?: string;
  workPlanState?: DealerWorkPlanState;
  showWorkPlanSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleWorkPlanSelect?: (dealerId: string, checked: boolean) => void;
  emptyMessage: string;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
  archiveBulk?: DealerListArchiveBulkProps;
  actualizationState: ActualizationState;
}) {
  const buckets = useMemo(() => partitionDealersBySegment(rows), [rows]);

  const renderRows = (segRows: DealerRow[]) => {
    const common: DealerRowRendererBaseProps = {
      rows: segRows,
      empty: "",
      profile,
      actualizationState,
      workPlanUserId,
      workPlanState,
      showWorkPlanSelect,
      selectedIds,
      onToggleWorkPlanSelect,
      shipmentActiveDayId,
      shipmentUserId,
      archiveBulk,
      nextStepsStorage,
    };
    const effectiveDensity: DealerShowcaseDensity =
      showcaseDensity === "table" && narrowViewport ? "list" : showcaseDensity;
    if (effectiveDensity === "large") {
      return (
        <DealerBaseDealerShowcaseGrid
          rows={segRows}
          empty=""
          profile={profile}
          actualizationState={actualizationState}
          workPlanUserId={workPlanUserId}
          workPlanState={workPlanState}
          showWorkPlanSelect={showWorkPlanSelect}
          selectedIds={selectedIds}
          onToggleWorkPlanSelect={onToggleWorkPlanSelect}
          shipmentActiveDayId={shipmentActiveDayId}
          shipmentUserId={shipmentUserId}
          archiveBulk={archiveBulk}
        />
      );
    }
    if (effectiveDensity === "grid") {
      return <ClientCompactGridBlock {...common} />;
    }
    if (effectiveDensity === "list") {
      return <ClientListRowsBlock {...common} />;
    }
    return <DealerBaseDataTable {...common} />;
  };

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
              <div className="min-w-0 border-t border-border/40 p-2 sm:p-3">{renderRows(segRows)}</div>
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
  const { user: me, isLoading: authLoading, isError: authError } = useAuthUser();
  const isRealUser = Boolean(me?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });
  const visCodesQ = useMyVisibleClientCodes({ enabled: isRealUser });
  const snap = orgSnapQ.data ?? null;
  const visPayload = visCodesQ.data ?? null;

  const useReal = Boolean(
    isRealUser &&
      !authLoading &&
      !authError &&
      snap &&
      visPayload &&
      !orgSnapQ.isError &&
      !visCodesQ.isError,
  );

  const realCtxForRoute = useMemo(
    () => (useReal && snap ? { snap, userId: snap.me.id } : undefined),
    [useReal, snap],
  );

  const access = useMemo(() => {
    if (isRealUser && me?.role) return mapUserRoleToDealerBaseAccess(me.role);
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [isRealUser, me?.role, profile.role]);

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
  const [geoRegion, setGeoRegion] = useState("");
  const [geoDistrict, setGeoDistrict] = useState("");
  const [geoLocality, setGeoLocality] = useState("");
  const [advancedFiltersCollapsed, setAdvancedFiltersCollapsed] = useState(true);
  const [showcaseDensity, setShowcaseDensity] = useState<DealerShowcaseDensity>(() => readShowcaseDensityFromStorage());

  const [viewportNarrow, setViewportNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setViewportNarrow(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const routeQs = useRouteSearchParams();
  const routeKey = useMemo(() => routeQs.toString(), [routeQs]);
  const [, setLocation] = useLocation();
  const actx = useClientBaseActualization();
  const teamCtx = useClientBaseTeamActualization();
  const teamActualizationPlane = teamCtx.mergedState;
  const { publishDashboardRopTeamId } = teamCtx;
  const overviewTeamId = access === "sales_director" && ropTeam !== "all" ? ropTeam : undefined;
  const overviewManagerId = access === "sales_manager" && me?.id ? me.id : undefined;
  const overviewQ = useQuery({
    queryKey: ["client-base-overview", overviewTeamId, overviewManagerId],
    queryFn: () => fetchClientBaseOverview({ teamId: overviewTeamId, managerUserId: overviewManagerId }),
    enabled: actx.enabled,
  });

  useEffect(() => {
    if (access !== "sales_director" && access !== "team_lead") return;
    publishDashboardRopTeamId(ropTeam);
  }, [ropTeam, access, publishDashboardRopTeamId]);

  const showActualizationSync = useMemo(() => canActualizeClientBase(profile), [profile]);

  const [createDealerOpen, setCreateDealerOpen] = useState(false);
  const [showArchivedDealers, setShowArchivedDealers] = useState(false);

  const mergedRowsForDealerBase = useMemo(() => {
    if (isRealUser && !authLoading && !authError && snap && visPayload && !orgSnapQ.isError && !visCodesQ.isError) {
      const clients = getVisibleReleaseClients(
        snap,
        visPayload.all,
        visPayload.codes,
        buildAssignmentsMap(visPayload.assignments),
      );
      const releaseRows = buildDealerRowsFromReleaseClients(clients);
      if (!actx.enabled) return releaseRows;
      return buildDealerBaseRowsWithActualization(teamActualizationPlane, profile, {
        includeArchivedDealers: showArchivedDealers,
        releaseDealerRows: releaseRows,
      });
    }
    if (isRealUser && !authLoading && !authError && (!snap || !visPayload)) return [];
    if (!actx.enabled) return DEALER_BASE_ROWS;
    return buildDealerBaseRowsWithActualization(teamActualizationPlane, profile, {
      includeArchivedDealers: showArchivedDealers,
    });
  }, [
    isRealUser,
    authLoading,
    authError,
    snap,
    visPayload,
    orgSnapQ.isError,
    visCodesQ.isError,
    actx.enabled,
    teamActualizationPlane,
    profile,
    showArchivedDealers,
  ]);

  useEffect(() => {
    const allowed = workViewsForAccess(access);
    setWorkView((prev) => (allowed.includes(prev) ? prev : defaultWorkViewForAccess(access)));
  }, [access]);

  const managerCatalogForRop = useMemo(
    () => (useReal && snap ? realTeamManagers(snap, ropTeam) : getManagersForRopTeam(ropTeam)),
    [useReal, snap, ropTeam],
  );
  const managerOptions = useMemo(
    () =>
      useReal && snap
        ? realManagerOptionsForAccess(snap, access, ropTeam)
        : managerOptionsForProfile(profile, access, ropTeam),
    [useReal, snap, profile, access, ropTeam],
  );
  const ropSelectOptions = useMemo(
    () => (useReal && snap ? realRopOptionsForAccess(snap, access) : ropOptionsForProfile(profile, access)),
    [useReal, snap, profile, access],
  );

  const scopedRows = useMemo(() => {
    if (useReal && snap) return roleScopedDealerRowsForReal(mergedRowsForDealerBase, snap, access);
    return roleScopedDealerRows(mergedRowsForDealerBase, profile);
  }, [useReal, snap, mergedRowsForDealerBase, profile, access]);

  /** Рабочая портфельная база (без архивных клиентов): KPI команд и карточки менеджеров всегда от неё, не от режима списка «архив». */
  const mergedRowsActivePortfolio = useMemo(() => {
    if (isRealUser && !authLoading && !authError && snap && visPayload && !orgSnapQ.isError && !visCodesQ.isError) {
      const clients = getVisibleReleaseClients(
        snap,
        visPayload.all,
        visPayload.codes,
        buildAssignmentsMap(visPayload.assignments),
      );
      const releaseRows = buildDealerRowsFromReleaseClients(clients);
      if (!actx.enabled) return releaseRows;
      return buildDealerBaseRowsWithActualization(teamActualizationPlane, profile, {
        includeArchivedDealers: false,
        releaseDealerRows: releaseRows,
      });
    }
    if (isRealUser && !authLoading && !authError && (!snap || !visPayload)) return [];
    if (!actx.enabled) return DEALER_BASE_ROWS;
    return buildDealerBaseRowsWithActualization(teamActualizationPlane, profile, { includeArchivedDealers: false });
  }, [
    isRealUser,
    authLoading,
    authError,
    snap,
    visPayload,
    orgSnapQ.isError,
    visCodesQ.isError,
    actx.enabled,
    teamActualizationPlane,
    profile,
  ]);

  const scopedActivePortfolioRows = useMemo(() => {
    if (useReal && snap) return roleScopedDealerRowsForReal(mergedRowsActivePortfolio, snap, access);
    return roleScopedDealerRows(mergedRowsActivePortfolio, profile);
  }, [useReal, snap, mergedRowsActivePortfolio, profile, access]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEALER_BASE_FILTERS_COLLAPSED_LS_KEY);
      if (raw === "true" || raw === "false") {
        setAdvancedFiltersCollapsed(raw === "true");
      } else {
        setAdvancedFiltersCollapsed(isNarrowViewport());
      }
    } catch {
      setAdvancedFiltersCollapsed(isNarrowViewport());
    }
  }, []);

  const persistAdvancedFiltersCollapsed = useCallback((collapsed: boolean) => {
    setAdvancedFiltersCollapsed(collapsed);
    try {
      localStorage.setItem(DEALER_BASE_FILTERS_COLLAPSED_LS_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, []);

  const persistShowcaseDensity = useCallback((d: DealerShowcaseDensity) => {
    setShowcaseDensity(d);
    try {
      localStorage.setItem(SHOWCASE_DENSITY_LS_KEY, d);
      localStorage.removeItem(DEALER_BASE_VIEW_MODE_LS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /** Однократно переносим legacy `tandoor-dealer-base-view-mode-v1` в новый ключ и удаляем старый. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(SHOWCASE_DENSITY_LS_KEY)) return;
      const narrow = window.innerWidth < 768;
      const old = localStorage.getItem(DEALER_BASE_VIEW_MODE_LS_KEY);
      const migrated = migrateLegacyDealerBaseViewMode(old, narrow);
      localStorage.setItem(SHOWCASE_DENSITY_LS_KEY, migrated);
      localStorage.removeItem(DEALER_BASE_VIEW_MODE_LS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /** Миграция сохранённого значения `compact` → `grid` (переименование режима). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(SHOWCASE_DENSITY_LS_KEY) !== "compact") return;
      localStorage.setItem(SHOWCASE_DENSITY_LS_KEY, "grid");
      setShowcaseDensity("grid");
    } catch {
      /* ignore */
    }
  }, []);

  const defaultRopManager = useMemo(
    () => (useReal && snap ? realInitialRopManagerDefaults(snap, access) : initialRopManagerForProfile(profile, access)),
    [useReal, snap, profile, access],
  );

  const pickerArgs = useMemo(
    () => ({
      search,
      quick,
      cities,
      categories,
      ropTeam,
      manager,
      managerCatalogForRop,
      geoRegion,
      geoDistrict,
      geoLocality,
    }),
    [
      search,
      quick,
      cities,
      categories,
      ropTeam,
      manager,
      managerCatalogForRop,
      geoRegion,
      geoDistrict,
      geoLocality,
    ],
  );

  const pickerFiltered = useMemo(() => applyDealerBasePickerFilters(scopedRows, pickerArgs), [scopedRows, pickerArgs]);

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

  /** Варианты геофильтров и счётчики по строкам в зоне видимости (без геофильтра). */
  const dealerBaseGeoCatalog = useMemo(() => {
    const rowsWithGeo = scopedRows.map((row) => ({ row, p: parseDealerGeoFromRow(row) }));

    const regionCounts = new Map<string, number>();
    for (const { p } of rowsWithGeo) {
      if (!p.region) continue;
      regionCounts.set(p.region, (regionCounts.get(p.region) ?? 0) + 1);
    }
    const regionList = Array.from(regionCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));

    const districtSource = rowsWithGeo.filter(({ p }) => {
      if (!geoRegion.trim()) return true;
      return normalizeGeoCompare(p.region) === normalizeGeoCompare(geoRegion);
    });
    const districtCounts = new Map<string, number>();
    for (const { p } of districtSource) {
      if (!p.district) continue;
      districtCounts.set(p.district, (districtCounts.get(p.district) ?? 0) + 1);
    }
    const districtList = Array.from(districtCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));

    const localitySource = rowsWithGeo.filter(({ p }) => {
      if (geoRegion.trim() && normalizeGeoCompare(p.region) !== normalizeGeoCompare(geoRegion)) return false;
      if (geoDistrict.trim() && normalizeGeoCompare(p.district) !== normalizeGeoCompare(geoDistrict)) return false;
      return true;
    });
    const localityCounts = new Map<string, number>();
    for (const { p, row } of localitySource) {
      const loc = (p.locality || row.city || "").trim();
      if (!loc) continue;
      localityCounts.set(loc, (localityCounts.get(loc) ?? 0) + 1);
    }
    const localityList = Array.from(localityCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));

    return { regionList, districtList, localityList };
  }, [scopedRows, geoRegion, geoDistrict]);

  useEffect(() => {
    const d = useReal && snap ? realInitialRopManagerDefaults(snap, access) : initialRopManagerForProfile(profile, access);
    if (!routeKey) {
      setRopTeam(d.ropTeam);
      setManager(d.manager);
      setQuick("all");
      setCities([]);
      setCategories([]);
      setSearch("");
      setWorkView(defaultWorkViewForAccess(access));
      setProgramFilters([]);
      setGeoRegion("");
      setGeoDistrict("");
      setGeoLocality("");
      return;
    }

    let rop = d.ropTeam;
    let mgr = d.manager;
    let qv: QuickFilter = "all";
    let cityV: string[] = [];
    let catV: ClientCategorySelection[] = [];
    let searchV = "";
    let vw: DealerBaseWorkView = defaultWorkViewForAccess(access);

    const scoped =
      useReal && snap
        ? roleScopedDealerRowsForReal(mergedRowsForDealerBase, snap, access)
        : roleScopedDealerRows(mergedRowsForDealerBase, profile);
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

    if (teamRaw && teamAllowedForProfile(teamRaw, profile, access, realCtxForRoute)) {
      rop = teamRaw;
      mgr = "all";
    }

    if (managerRaw && managerAllowedForRop(managerRaw, rop, profile, access, realCtxForRoute)) {
      mgr = managerRaw;
    }

    if (viewParsed) {
      vw = viewParsed;
    } else if (mgr !== "all" && !isRopOrManagerAllFilter(mgr) && (access === "sales_director" || access === "team_lead")) {
      vw = "my_clients";
    } else if (
      teamRaw &&
      teamAllowedForProfile(teamRaw, profile, access, realCtxForRoute) &&
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
  }, [
    profile.personaUserId,
    profile.role,
    access,
    routeKey,
    routeQs,
    mergedRowsForDealerBase,
    useReal,
    snap,
    realCtxForRoute,
    me?.id,
  ]);

  const firstRopTeamId = useMemo(
    () => (useReal && snap ? realRopOptions(snap) : getRopOptions())[0]?.teamId ?? "",
    [useReal, snap],
  );

  const effectiveTeamIdForTeamModes = useMemo(() => {
    if (useReal && snap) {
      if (access === "team_lead") return realEffectiveTeamLeadTeamId(snap);
      if (access === "sales_manager") {
        return snap.users.find((u) => u.id === snap.me.id)?.teamId ?? firstRopTeamId;
      }
      if (!isRopOrManagerAllFilter(ropTeam)) return ropTeam;
      return firstRopTeamId;
    }
    if (access === "team_lead") return getEffectiveTeamLeadTeamId(profile);
    if (access === "sales_manager") {
      return getSalesUserById(profile.personaUserId)?.teamId ?? firstRopTeamId;
    }
    if (!isRopOrManagerAllFilter(ropTeam)) return ropTeam;
    return firstRopTeamId;
  }, [useReal, snap, access, profile, ropTeam, firstRopTeamId]);

  const teamRowsForModes = useMemo(
    () => scopedActivePortfolioRows.filter((r) => r.releaseTeamId === effectiveTeamIdForTeamModes),
    [scopedActivePortfolioRows, effectiveTeamIdForTeamModes],
  );

  const teamSummaryForCompactBanner = useMemo(() => {
    if (access !== "sales_director" && access !== "team_lead") return null;
    if (!DEALER_BASE_TEAM_WORK_VIEWS.includes(workView)) return null;
    const rows = scopedActivePortfolioRows.filter((r) => r.releaseTeamId === effectiveTeamIdForTeamModes);
    return buildTeamSummaryFromRows(effectiveTeamIdForTeamModes, rows);
  }, [access, workView, effectiveTeamIdForTeamModes, scopedActivePortfolioRows]);

  const teamRopDisplayLabel = useMemo(
    () => ropSelectOptions.find((o) => o.teamId === effectiveTeamIdForTeamModes)?.label ?? "—",
    [ropSelectOptions, effectiveTeamIdForTeamModes],
  );

  const selectedManagerLabel = useMemo(() => {
    if (isRopOrManagerAllFilter(manager)) return null;
    const fromCat = managerCatalogForRop.find((m) => m.id === manager);
    if (fromCat) return fromCat.name;
    return (useReal && snap ? realSalesUserById(snap, manager) : getSalesUserById(manager))?.name ?? null;
  }, [manager, managerCatalogForRop, useReal, snap]);

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
    if (actx.enabled && showArchivedDealers) {
      if ((access === "sales_director" || access === "team_lead") && DEALER_BASE_TEAM_WORK_VIEWS.includes(workView)) {
        return `Режим архива · команда: ${teamRopDisplayLabel}`;
      }
      return "Режим архива: показаны только архивные клиенты.";
    }
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
  }, [actx.enabled, showArchivedDealers, access, workView, manager, selectedManagerLabel, teamRopDisplayLabel]);

  const managerScopedRows = useMemo(() => {
    if (isRopOrManagerAllFilter(manager)) return pickerFiltered;
    const cat = managerCatalogForRop.find((m) => m.id === manager);
    return pickerFiltered.filter((row) => {
      if (row.releaseManagerId === manager) return true;
      return Boolean(cat && managerDisplayMatchesCatalogName(row.manager, cat.name));
    });
  }, [pickerFiltered, manager, managerCatalogForRop]);

  const teamTablePickerRows = useMemo(
    () => applyDealerBasePickerFilters(teamRowsForModes, pickerArgs),
    [teamRowsForModes, pickerArgs],
  );

  const cityRowsDept = useMemo(
    () => buildCityConcentrationRows(pickerFiltered, actx.enabled ? teamActualizationPlane : undefined),
    [pickerFiltered, actx.enabled, teamActualizationPlane],
  );
  const cityRowsTeam = useMemo(
    () => buildCityConcentrationRows(teamTablePickerRows, actx.enabled ? teamActualizationPlane : undefined),
    [teamTablePickerRows, actx.enabled, teamActualizationPlane],
  );
  const cityRowsManager = useMemo(
    () => buildCityConcentrationRows(managerScopedRows, actx.enabled ? teamActualizationPlane : undefined),
    [managerScopedRows, actx.enabled, teamActualizationPlane],
  );

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
      return applyDealerBasePickerFilters(teamRowsForModes, pickerArgs).slice(0, limit);
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

  const managersOfRopTeam = useCallback(
    (teamId: string) => (useReal && snap ? realTeamManagers(snap, teamId) : getTeamManagers(teamId)),
    [useReal, snap],
  );

  const onRopChange = useCallback(
    (v: string) => {
      setRopTeam(v);
      setManager((prev) => {
        if (prev === "all") return prev;
        const allowed = managersOfRopTeam(v).some((m) => m.id === prev);
        return allowed ? prev : "all";
      });
    },
    [managersOfRopTeam],
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
        return applyDealerBasePickerFilters(teamRowsForModes, pickerArgs).length;
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
        {ropSelectOptions.find((o) => o.teamId === effectiveTeamIdForTeamModes)?.label ?? "—"}».
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
  const [selectedBulkArchiveDealerIds, setSelectedBulkArchiveDealerIds] = useState<Set<string>>(() => new Set());
  /** Режим массового удаления: чекбоксы архива показываются только после явного включения. */
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [bulkArchiveDealerDialogOpen, setBulkArchiveDealerDialogOpen] = useState(false);
  const [bulkArchiveDealerBusy, setBulkArchiveDealerBusy] = useState(false);
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
  const nextStepsStorage = useMemo(() => loadClientNextStepsStorage(), [trafficBump]);
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

  const defaultWorkPlanFilterValue = profile.role === "marketer" || profile.role === "analyst" ? "all" : "active";

  const dealerBaseActiveFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    const q = search.trim();
    if (q) {
      const short = q.length > 40 ? `${q.slice(0, 37)}…` : q;
      chips.push({
        key: "search",
        label: `Поиск: ${short}`,
        onRemove: () => setSearch(""),
      });
    }
    if (quick !== "all") {
      const lab = QUICK_FILTERS.find((f) => f.id === quick)?.label ?? quick;
      chips.push({
        key: "quick",
        label: `Статус: ${lab}`,
        onRemove: () => setQuick("all"),
      });
    }
    for (const id of programFilters) {
      chips.push({
        key: `program-${id}`,
        label: `Признак: ${DEALER_PROGRAM_FILTER_LABELS[id]}`,
        onRemove: () => setProgramFilters((prev) => prev.filter((x) => x !== id)),
      });
    }
    if (workPlanFilter !== defaultWorkPlanFilterValue) {
      chips.push({
        key: "work-plan",
        label: `Рабочий план: ${WORK_PLAN_FILTER_LABELS[workPlanFilter]}`,
        onRemove: () => setWorkPlanFilter(defaultWorkPlanFilterValue as WorkPlanListFilter),
      });
    }
    if (segmentList.length > 0) {
      for (const seg of segmentList) {
        chips.push({
          key: `segment-${seg}`,
          label: `Сегмент: ${DEALER_BASE_SEGMENT_LABELS[seg]}`,
          onRemove: () => setSegmentList((prev) => prev.filter((x) => x !== seg)),
        });
      }
    }
    if (stockListFilter !== "all") {
      chips.push({
        key: "stock",
        label: `Склад: ${DEALER_STOCK_FILTER_LABELS[stockListFilter]}`,
        onRemove: () => setStockListFilter("all"),
      });
    }
    if (geoRegion.trim()) {
      chips.push({
        key: "geo-region",
        label: `Регион: ${geoRegion.trim()}`,
        onRemove: () => {
          setGeoRegion("");
          setGeoDistrict("");
          setGeoLocality("");
        },
      });
    }
    if (geoDistrict.trim()) {
      chips.push({
        key: "geo-district",
        label: `Район: ${geoDistrict.trim()}`,
        onRemove: () => {
          setGeoDistrict("");
          setGeoLocality("");
        },
      });
    }
    if (geoLocality.trim()) {
      chips.push({
        key: "geo-locality",
        label: `Населённый пункт: ${geoLocality.trim()}`,
        onRemove: () => setGeoLocality(""),
      });
    }
    for (const c of cities) {
      chips.push({
        key: `city-${c}`,
        label: `Город: ${c}`,
        onRemove: () => setCities((prev) => prev.filter((x) => x !== c)),
      });
    }
    for (const cat of categories) {
      const catLabel = cat === "__top_tier__" ? "ТОП-сегмент" : getClientCategoryLabel(cat);
      chips.push({
        key: `category-${cat}`,
        label: `Категория: ${catLabel}`,
        onRemove: () => setCategories((prev) => prev.filter((x) => x !== cat)),
      });
    }
    if (ropTeam !== defaultRopManager.ropTeam) {
      const lab = ropSelectOptions.find((o) => o.teamId === ropTeam)?.label ?? ropTeam;
      chips.push({
        key: "rop",
        label: `РОП: ${lab}`,
        onRemove: () => {
          setRopTeam(defaultRopManager.ropTeam);
          setManager(defaultRopManager.manager);
        },
      });
    }
    if (manager !== defaultRopManager.manager && !hideManagerFilterInTeamView) {
      const lab =
        managerCatalogForRop.find((m) => m.id === manager)?.name ?? getSalesUserById(manager)?.name ?? manager;
      chips.push({
        key: "manager",
        label: `Менеджер: ${lab}`,
        onRemove: () => setManager(defaultRopManager.manager),
      });
    }
    return chips;
  }, [
    search,
    quick,
    programFilters,
    workPlanFilter,
    defaultWorkPlanFilterValue,
    segmentList,
    stockListFilter,
    geoRegion,
    geoDistrict,
    geoLocality,
    cities,
    categories,
    ropTeam,
    manager,
    defaultRopManager,
    managerCatalogForRop,
    hideManagerFilterInTeamView,
  ]);

  const dealerBaseActiveFilterCount = dealerBaseActiveFilterChips.length;

  const resetDealerBaseFilters = useCallback(() => {
    setSearch("");
    setQuick("all");
    setProgramFilters([]);
    setWorkPlanFilter(profile.role === "marketer" || profile.role === "analyst" ? "all" : "active");
    setSegmentList([]);
    setStockListFilter("all");
    setCities([]);
    setCategories([]);
    setGeoRegion("");
    setGeoDistrict("");
    setGeoLocality("");
    setRopTeam(defaultRopManager.ropTeam);
    setManager(defaultRopManager.manager);
  }, [profile.role, defaultRopManager]);

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
    if (showArchivedDealers) {
      setBulkDeleteMode(false);
      setSelectedBulkArchiveDealerIds(new Set());
    }
  }, [showArchivedDealers]);

  const exitBulkDeleteMode = useCallback(() => {
    setBulkDeleteMode(false);
    setSelectedBulkArchiveDealerIds(new Set());
  }, []);

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

  const archivableDealerIdsInView = useMemo(() => {
    if (!actx.enabled || !canActualizeClientBase(profile) || showArchivedDealers) return new Set<string>();
    const s = new Set<string>();
    for (const r of rowsFinalForList) {
      if (teamActualizationPlane.archivedDealersById[r.id]) continue;
      if (teamActualizationPlane.trashedDealersById?.[r.id]) continue;
      if (canArchiveDealerDuringActualization(profile, r)) s.add(r.id);
    }
    return s;
  }, [
    actx.enabled,
    teamActualizationPlane.archivedDealersById,
    teamActualizationPlane.trashedDealersById,
    profile,
    rowsFinalForList,
    showArchivedDealers,
  ]);

  useEffect(() => {
    setSelectedBulkArchiveDealerIds((prev) => {
      const n = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (archivableDealerIdsInView.has(id)) n.add(id);
        else changed = true;
      });
      if (!changed && n.size === prev.size) return prev;
      return n;
    });
  }, [archivableDealerIdsInView]);

  const toggleBulkArchiveDealer = useCallback((dealerId: string, checked: boolean) => {
    setSelectedBulkArchiveDealerIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(dealerId);
      else next.delete(dealerId);
      return next;
    });
  }, []);

  const allVisibleArchiveDealersSelected = useMemo(() => {
    if (archivableDealerIdsInView.size === 0) return false;
    for (const id of Array.from(archivableDealerIdsInView)) {
      if (!selectedBulkArchiveDealerIds.has(id)) return false;
    }
    return true;
  }, [archivableDealerIdsInView, selectedBulkArchiveDealerIds]);

  const someVisibleArchiveDealersSelected = useMemo(() => {
    for (const id of Array.from(archivableDealerIdsInView)) {
      if (selectedBulkArchiveDealerIds.has(id)) return true;
    }
    return false;
  }, [archivableDealerIdsInView, selectedBulkArchiveDealerIds]);

  const archiveBulkListProps = useMemo((): DealerListArchiveBulkProps | undefined => {
    if (!actx.enabled || !canActualizeClientBase(profile) || showArchivedDealers || !bulkDeleteMode) return undefined;
    return {
      selectedIds: selectedBulkArchiveDealerIds,
      selectableIds: archivableDealerIdsInView,
      onToggle: toggleBulkArchiveDealer,
    };
  }, [
    actx.enabled,
    profile,
    showArchivedDealers,
    bulkDeleteMode,
    selectedBulkArchiveDealerIds,
    archivableDealerIdsInView,
    toggleBulkArchiveDealer,
  ]);

  const bulkArchiveDealerDialogCount = useMemo(() => {
    let n = 0;
    for (const id of Array.from(selectedBulkArchiveDealerIds)) {
      if (archivableDealerIdsInView.has(id)) n += 1;
    }
    return n;
  }, [selectedBulkArchiveDealerIds, archivableDealerIdsInView]);

  /**
   * Bulk-delete отправляет клиентов в КОРЗИНУ (`trashedDealersById`).
   * Снапшоты — через хелпер `snapshotDealerFromRow` (Промт 46).
   */
  const confirmBulkArchiveDealers = useCallback(async () => {
    const ids = Array.from(selectedBulkArchiveDealerIds).filter((id) => archivableDealerIdsInView.has(id));
    if (ids.length === 0) {
      setBulkArchiveDealerDialogOpen(false);
      return;
    }
    setBulkArchiveDealerBusy(true);
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const rowById = new Map<string, DealerRow>(rowsFinalForList.map((r) => [r.id, r]));
    const snapshotFor = (id: string): TrashedDealerInfo["snapshot"] => {
      const row = rowById.get(id);
      const manual = actx.state.manuallyCreatedDealersById?.[id];
      const manualFields = (manual?.fields ?? {}) as Record<string, unknown>;
      const fullName = row?.name ?? (typeof manualFields.name === "string" ? (manualFields.name as string) : null);
      const city = row?.city ?? (typeof manualFields.city === "string" ? (manualFields.city as string) : null);
      const inn = row?.actualizationInn ?? (typeof manualFields.inn === "string" ? (manualFields.inn as string) : null);
      const dealerCode = row?.releaseCode ?? manual?.internalCode ?? null;
      const legalEntityName = (() => {
        const le = actx.state.legalEntityOverridesByDealerId?.[id];
        if (!le) return null;
        const ov = le.overridesById as Record<string, unknown> | undefined;
        if (!ov) return null;
        const first = Object.values(ov)[0];
        if (first && typeof first === "object" && first !== null) {
          const f = first as Record<string, unknown>;
          if (typeof f.name === "string") return f.name as string;
          if (typeof f.fullName === "string") return f.fullName as string;
        }
        return null;
      })();
      return snapshotDealerFromRow({ fullName, city, inn, dealerCode, legalEntityName });
    };
    const r = await actx.persist((prev) => {
      const nextTrash = { ...prev.trashedDealersById };
      for (const id of ids) {
        nextTrash[id] = makeTrashedDealerInfo({
          dealerId: id,
          by: { userId: uid, userName: uname },
          snapshot: snapshotFor(id),
          source: "client_bulk_delete",
        });
      }
      return mergeActualizationState(prev, { trashedDealersById: nextTrash });
    });
    setBulkArchiveDealerBusy(false);
    if (r.success) {
      toast({ title: "Клиенты перемещены в корзину", description: "Хранятся 14 дней. Восстановить можно из раздела «Корзина»." });
      setSelectedBulkArchiveDealerIds(new Set());
      setBulkDeleteMode(false);
      setBulkArchiveDealerDialogOpen(false);
    } else {
      toast({ title: "Не удалось сохранить", variant: "destructive" });
    }
  }, [selectedBulkArchiveDealerIds, archivableDealerIdsInView, actx, profile, rowsFinalForList]);

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

  useEffect(() => {
    if (!showClientShipmentAndSegments) {
      setBulkDeleteMode(false);
      setSelectedBulkArchiveDealerIds(new Set());
    }
  }, [showClientShipmentAndSegments]);

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

  const canShowBulkDeleteEntry = actx.enabled && canActualizeClientBase(profile) && !showArchivedDealers;
  const bulkDeleteHasTargets = archivableDealerIdsInView.size > 0;

  if (actx.enabled && shouldUseTeamMergedActualizationPlane(profile)) {
    return (
      <DealerBaseManagementCockpit
        profile={profile}
        rows={scopedActivePortfolioRows}
        orgTeamCtx={useReal && snap ? { snap, access } : undefined}
        overview={overviewQ.data ?? null}
        mergedDealerRowsForCreate={
          useReal && snap && visPayload && !orgSnapQ.isError && !visCodesQ.isError ? mergedRowsActivePortfolio : undefined
        }
      />
    );
  }

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
        <div className="space-y-3">
          {actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && teamCtx.teamFetchLoading ? (
            <Alert className="border-primary/30 bg-primary/5" data-testid="alert-dealer-base-team-state-loading">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Загружаются данные актуализации команды… Счётчики и списки обновятся после получения всех снимков.
              </AlertDescription>
            </Alert>
          ) : null}
          {actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && teamCtx.teamFetchError ? (
            <Alert variant="destructive" data-testid="alert-dealer-base-team-state-error">
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{teamCtx.teamFetchError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-destructive/40"
                  onClick={() => void teamCtx.refresh()}
                >
                  Повторить загрузку команды
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {actx.enabled ? (
            <div
              className="flex max-w-lg flex-col gap-2 rounded-xl border border-border/80 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              data-testid="section-dealers-archived-toggle"
            >
              <div className="min-w-0 space-y-1">
                <Label htmlFor="toggle-dealers-show-archived" className="cursor-pointer text-sm font-medium text-foreground">
                  Режим архива клиентов
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Включено — в списке <span className="font-medium text-foreground">только архивные</span> клиенты. Выключено — только активная рабочая база (KPI команд и карточки менеджеров всегда по активной базе).
                </p>
              </div>
              <Switch
                id="toggle-dealers-show-archived"
                checked={showArchivedDealers}
                onCheckedChange={(v) => setShowArchivedDealers(v === true)}
                data-testid="toggle-dealers-show-archived"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <DealerActualizationCreateDialog
        open={createDealerOpen}
        onOpenChange={setCreateDealerOpen}
        profile={profile}
        mergedDealerRows={
          actx.enabled
            ? buildDealerBaseRowsWithActualization(teamActualizationPlane, profile, { includeArchivedDealers: false })
            : DEALER_BASE_ROWS
        }
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
        <CardContent className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-3" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск: название, код, город, РОП, менеджер, тип, адрес, ИНН"
                className="min-h-9 rounded-lg border-border pl-9 text-sm sm:min-h-10 sm:rounded-xl sm:pl-10"
                data-testid="input-dealer-base-search"
              />
            </div>
            <div
              className="flex min-w-0 shrink-0 flex-col gap-2 sm:ml-auto sm:items-end"
              data-testid="section-dealer-showcase-mode-toolbar"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Витрина дилеров</p>
                <p className="hidden text-[11px] text-muted-foreground sm:block">Рабочий вид списка клиентов</p>
              </div>
              <div
                className="flex min-w-0 items-center justify-end gap-0.5 rounded-lg border border-border bg-card p-0.5"
                data-testid="section-dealer-showcase-density-icons"
                role="radiogroup"
                aria-label="Плотность отображения витрины дилеров"
              >
                {(
                  [
                    { id: "large" as const, label: "Крупно", tid: "button-dealer-showcase-density-large", icon: LayoutTemplate },
                    { id: "grid" as const, label: "Сетка", tid: "button-dealer-showcase-density-grid", icon: LayoutGrid },
                    { id: "list" as const, label: "Список", tid: "button-dealer-showcase-density-list", icon: List },
                    { id: "table" as const, label: "Таблица", tid: "button-dealer-showcase-density-table", icon: Table2 },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = showcaseDensity === opt.id;
                  return (
                    <Button
                      key={opt.id}
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-9 w-9 shrink-0 rounded-md border",
                        active
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-transparent bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      data-testid={opt.tid}
                      aria-label={opt.label}
                      aria-pressed={active}
                      role="radio"
                      aria-checked={active}
                      onClick={() => persistShowcaseDensity(opt.id)}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {QUICK_FILTERS.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  size="sm"
                  variant={quick === f.id ? "default" : "outline"}
                  className={cn(
                    "h-8 shrink-0 rounded-full px-2.5 text-xs font-medium sm:h-9 sm:px-3",
                    quick === f.id ? "" : "border-border bg-card",
                  )}
                  onClick={() => setQuick(f.id)}
                  data-testid={f.testId}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 self-start text-xs font-semibold sm:self-center"
              data-testid="button-dealer-base-filters-toggle"
              aria-expanded={!advancedFiltersCollapsed}
              onClick={() => persistAdvancedFiltersCollapsed(!advancedFiltersCollapsed)}
            >
              {advancedFiltersCollapsed ? "Показать фильтры" : "Свернуть фильтры"}
            </Button>
          </div>

          {advancedFiltersCollapsed ? (
            <section
              className="rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2 sm:px-3"
              data-testid="section-dealer-base-filters-summary"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-foreground">Фильтры: {dealerBaseActiveFilterCount} активных</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-semibold"
                  data-testid="button-dealer-base-filters-reset"
                  onClick={resetDealerBaseFilters}
                >
                  Сбросить
                </Button>
              </div>
              {dealerBaseActiveFilterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5" data-testid="panel-dealer-base-active-filter-chips">
                  {dealerBaseActiveFilterChips.map((c) => (
                    <span
                      key={c.key}
                      className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-border/80 bg-background py-0.5 pl-2 pr-0.5 text-[11px] font-medium leading-tight text-foreground sm:text-xs"
                      data-testid={`chip-dealer-base-filter-${c.key}`}
                    >
                      <span className="min-w-0 max-w-[min(14rem,70vw)] truncate">{c.label}</span>
                      <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Снять: ${c.label}`}
                        data-testid={`button-dealer-base-filter-chip-remove-${c.key}`}
                        onClick={c.onRemove}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <Collapsible open={!advancedFiltersCollapsed}>
            <CollapsibleContent className="space-y-3 data-[state=closed]:hidden">
              <section className="space-y-2" data-testid="section-dealer-base-advanced-filters">
                {!advancedFiltersCollapsed && dealerBaseActiveFilterChips.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="panel-dealer-base-active-filter-chips">
                    {dealerBaseActiveFilterChips.map((c) => (
                      <span
                        key={`open-${c.key}`}
                        className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-border/80 bg-muted/20 py-0.5 pl-2 pr-0.5 text-[11px] font-medium leading-tight sm:text-xs"
                        data-testid={`chip-dealer-base-filter-${c.key}`}
                      >
                        <span className="min-w-0 max-w-[min(14rem,70vw)] truncate">{c.label}</span>
                        <button
                          type="button"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Снять: ${c.label}`}
                          data-testid={`button-dealer-base-filter-chip-remove-${c.key}`}
                          onClick={c.onRemove}
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs font-semibold"
                      onClick={resetDealerBaseFilters}
                    >
                      Сбросить все
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-1.5" data-testid="section-dealer-base-program-filters">
                  <p className="text-xs font-medium text-muted-foreground">Признаки</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DEALER_PROGRAM_FILTER_ORDER.map((id) => {
                      const active = programFilters.includes(id);
                      return (
                        <Button
                          key={id}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className={cn(
                            "h-8 rounded-full px-2.5 text-xs font-medium sm:h-9 sm:px-3",
                            active ? "" : "border-border bg-card",
                          )}
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
                        className="h-8 rounded-full px-2 text-xs"
                        onClick={() => setProgramFilters([])}
                        data-testid="filter-programs-reset"
                      >
                        Сбросить
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="min-w-0 space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Рабочий план</Label>
                    <Select value={workPlanFilter} onValueChange={(v) => setWorkPlanFilter(v as WorkPlanListFilter)}>
                      <SelectTrigger
                        className="h-9 min-h-0 w-full min-w-0 rounded-lg text-sm sm:rounded-xl"
                        data-testid="select-dealer-work-plan-filter"
                      >
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
                      triggerClassName="h-9 min-h-9 w-full max-w-none rounded-lg text-sm sm:rounded-xl"
                      testId="select-dealer-segment-filter"
                      ariaLabel="Сегмент списка"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Склад</Label>
                    <Select value={stockListFilter} onValueChange={(v) => setStockListFilter(v as DealerStockListFilterId)}>
                      <SelectTrigger
                        className="h-9 min-h-0 w-full min-w-0 rounded-lg text-sm sm:rounded-xl"
                        data-testid="select-dealer-stock-filter"
                      >
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

                <div className="space-y-2 border-t border-border/60 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground">География</p>
                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Регион / край / область</Label>
                      <Select
                        value={geoRegion ? geoRegion : "__all__"}
                        onValueChange={(v) => {
                          const next = v === "__all__" ? "" : v;
                          setGeoRegion(next);
                          setGeoDistrict("");
                          setGeoLocality("");
                        }}
                      >
                        <SelectTrigger
                          className="h-9 min-h-0 w-full min-w-0 rounded-lg text-sm sm:rounded-xl"
                          data-testid="select-dealer-base-region"
                        >
                          <SelectValue placeholder="Все регионы" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Все регионы</SelectItem>
                          {dealerBaseGeoCatalog.regionList.map((r) => (
                            <SelectItem key={r.label} value={r.label}>
                              {r.label} ({r.count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Район</Label>
                      <Select
                        value={geoDistrict ? geoDistrict : "__all__"}
                        onValueChange={(v) => {
                          const next = v === "__all__" ? "" : v;
                          setGeoDistrict(next);
                          setGeoLocality("");
                        }}
                      >
                        <SelectTrigger
                          className="h-9 min-h-0 w-full min-w-0 rounded-lg text-sm sm:rounded-xl"
                          data-testid="select-dealer-base-district"
                        >
                          <SelectValue placeholder="Все районы" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Все районы</SelectItem>
                          {dealerBaseGeoCatalog.districtList.map((r) => (
                            <SelectItem key={r.label} value={r.label}>
                              {r.label} ({r.count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Город / населённый пункт</Label>
                      <Select
                        value={geoLocality ? geoLocality : "__all__"}
                        onValueChange={(v) => {
                          setGeoLocality(v === "__all__" ? "" : v);
                        }}
                      >
                        <SelectTrigger
                          className="h-9 min-h-0 w-full min-w-0 rounded-lg text-sm sm:rounded-xl"
                          data-testid="select-dealer-base-locality"
                        >
                          <SelectValue placeholder="Все населённые пункты" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Все населённые пункты</SelectItem>
                          {dealerBaseGeoCatalog.localityList.map((r) => (
                            <SelectItem key={r.label} value={r.label}>
                              {r.label} ({r.count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/60 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground">Ответственные</p>
                  <div
                    className={cn(
                      "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2",
                      hideManagerFilterInTeamView ? "lg:grid-cols-3" : "lg:grid-cols-4",
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Город</Label>
                      <MultiSelect
                        options={cityOptions.map((c) => ({ value: c, label: c }))}
                        value={cities}
                        onChange={setCities}
                        placeholder="Все города"
                        allLabel="Все города"
                        triggerClassName="h-9 min-h-9 w-full rounded-lg text-sm sm:rounded-xl"
                        testId="select-dealer-base-city"
                        ariaLabel="Город"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Категория клиента</Label>
                      <MultiSelect
                        options={categoryOptions.map((c) => ({ value: c, label: getClientCategoryLabel(c) }))}
                        value={categories as string[]}
                        onChange={(next) => setCategories(next as ClientCategorySelection[])}
                        placeholder="Все категории"
                        allLabel="Все категории"
                        triggerClassName="h-9 min-h-9 w-full rounded-lg text-sm sm:rounded-xl"
                        testId="select-dealer-base-category"
                        ariaLabel="Категория клиента"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">РОП</Label>
                      <Select value={ropTeam} onValueChange={onRopChange}>
                        <SelectTrigger
                          className="h-9 min-h-0 w-full min-w-0 rounded-lg text-sm sm:rounded-xl"
                          data-testid="select-dealer-base-rop"
                        >
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
                    {!hideManagerFilterInTeamView ? (
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">Менеджер</Label>
                        <Select value={manager} onValueChange={handleManagerChange}>
                          <SelectTrigger
                            className="h-9 min-h-0 w-full min-w-0 rounded-lg text-sm sm:rounded-xl"
                            data-testid="select-dealer-base-manager"
                          >
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
                </div>

                {hideManagerFilterInTeamView ? (
                  <p className="text-xs text-muted-foreground" data-testid="text-dealer-base-manager-filter-hint">
                    Выберите режим менеджера, чтобы смотреть клиентов конкретного менеджера.
                  </p>
                ) : null}

                <div className="space-y-2 border-t border-border/60 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground">Рабочий режим</p>
                  <section className="space-y-3" data-testid="section-dealer-base-role-views">
                    <div className="flex min-w-0 flex-col gap-4">
                      {groupUi.department ? (
                        <div className="min-w-0 space-y-1.5" data-testid="section-dealer-base-role-group-department">
                          <p className="text-xs font-semibold text-foreground sm:text-sm">Отдел</p>
                          <div className="flex flex-wrap gap-1.5">
                            {viewsInGroupForAccess(access, "department").map((vid) => (
                              <Button
                                key={vid}
                                type="button"
                                size="sm"
                                variant={workView === vid ? "default" : "outline"}
                                className={cn(
                                  "h-8 rounded-full px-2.5 text-xs sm:h-9 sm:px-3",
                                  workView !== vid && "border-border bg-card",
                                )}
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
                        <div className="min-w-0 space-y-1.5" data-testid="section-dealer-base-role-group-team">
                          <p className="text-xs font-semibold text-foreground sm:text-sm">Команда</p>
                          <div className="flex flex-wrap gap-1.5">
                            {viewsInGroupForAccess(access, "team").map((vid) => (
                              <Button
                                key={vid}
                                type="button"
                                size="sm"
                                variant={workView === vid ? "default" : "outline"}
                                className={cn(
                                  "h-8 rounded-full px-2.5 text-xs sm:h-9 sm:px-3",
                                  workView !== vid && "border-border bg-card",
                                )}
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
                        <div className="min-w-0 space-y-1.5" data-testid="section-dealer-base-role-group-manager">
                          <p className="text-xs font-semibold text-foreground sm:text-sm">Менеджер</p>
                          <div className="flex flex-wrap gap-1.5">
                            {viewsInGroupForAccess(access, "manager").map((vid) => (
                              <Button
                                key={vid}
                                type="button"
                                size="sm"
                                variant={workView === vid ? "default" : "outline"}
                                className={cn(
                                  "h-8 rounded-full px-2.5 text-xs sm:h-9 sm:px-3",
                                  workView !== vid && "border-border bg-card",
                                )}
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
                </div>
              </section>
            </CollapsibleContent>
          </Collapsible>
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
        {showArchivedDealers && actx.enabled ? (
          <Alert className="mb-3 border-primary/30 bg-primary/5" data-testid="text-dealer-base-archive-mode-hint">
            <Info className="h-4 w-4 text-primary" aria-hidden />
            <AlertDescription>
              Вы смотрите архивных клиентов. Изменения в карточках сохраняются, но клиент не вернётся в рабочую базу без восстановления.
            </AlertDescription>
          </Alert>
        ) : null}
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
        {canShowBulkDeleteEntry && showClientShipmentAndSegments ? (
          <div className="mb-3 min-w-0 space-y-2 rounded-xl border border-border/70 bg-muted/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {!bulkDeleteMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10 shrink-0 gap-2 font-semibold"
                  data-testid="button-dealer-bulk-delete-mode"
                  disabled={!bulkDeleteHasTargets}
                  title={
                    !bulkDeleteHasTargets
                      ? "В текущей выборке нет клиентов, которых можно удалить из рабочей базы."
                      : undefined
                  }
                  onClick={() => setBulkDeleteMode(true)}
                >
                  <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Выбрать для удаления</span>
                  <span className="sm:hidden">Удалить</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10 shrink-0 font-semibold"
                  data-testid="button-dealer-bulk-delete-mode-cancel"
                  onClick={exitBulkDeleteMode}
                >
                  Отменить выбор
                </Button>
              )}
            </div>
            {bulkDeleteMode ? (
              <p className="text-sm leading-snug text-destructive/95" data-testid="text-dealer-bulk-delete-mode-hint">
                Красным отметьте клиентов, которых нужно удалить из рабочей базы.
              </p>
            ) : null}
          </div>
        ) : null}
        {archiveBulkListProps && archivableDealerIdsInView.size > 0 && selectedBulkArchiveDealerIds.size > 0 ? (
          <div
            className="mb-3 flex min-w-0 flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            data-testid="panel-dealer-bulk-actions"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <p className="text-sm font-semibold text-foreground" data-testid="text-dealer-bulk-selected-count">
                Выбрано: {selectedBulkArchiveDealerIds.size}
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/[0.06] px-2 py-1.5">
                <DealerBulkDeleteCheckbox
                  id="dealer-bulk-select-all-visible"
                  checked={
                    allVisibleArchiveDealersSelected
                      ? true
                      : someVisibleArchiveDealersSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(v) => {
                    if (v === true) {
                      setSelectedBulkArchiveDealerIds(new Set(archivableDealerIdsInView));
                    } else {
                      setSelectedBulkArchiveDealerIds(new Set());
                    }
                  }}
                  data-testid="checkbox-dealer-select-all-visible"
                  aria-label="Выбрать всех доступных клиентов на экране для удаления из рабочей базы"
                />
                <Label
                  htmlFor="dealer-bulk-select-all-visible"
                  className="cursor-pointer text-sm font-medium text-destructive"
                >
                  Все на экране
                </Label>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid="button-dealer-bulk-clear-selection"
                onClick={() => setSelectedBulkArchiveDealerIds(new Set())}
              >
                Снять выбор
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid="button-dealer-bulk-archive"
                onClick={() => setBulkArchiveDealerDialogOpen(true)}
              >
                Удалить / в архив
              </Button>
            </div>
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
              footnote={
                actx.enabled
                  ? "Показаны только активные клиенты и точки команды (архив не учитывается)."
                  : undefined
              }
            />
          </div>
        ) : null}
        {workView === "teams" ? (
          <div className="space-y-6" data-testid={viewSectionDataTestId("teams")}>
            {ropSelectOptions.map((rop) => {
              const mgrs = managersOfRopTeam(rop.teamId);
              return (
                <Card key={rop.teamId} className="rounded-2xl border border-border/80 bg-card shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{rop.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">Команда · карточки менеджеров</p>
                    {actx.enabled ? (
                      <p className="text-[11px] text-muted-foreground">
                        Счётчики по активной базе (без архивных клиентов и точек).
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {mgrs.map((m) => {
                      const rows = mergedRowsActivePortfolio.filter(
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
              {managersOfRopTeam(effectiveTeamIdForTeamModes).map((m) => {
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
                profile={profile}
                showcaseDensity={showcaseDensity}
                narrowViewport={viewportNarrow}
                nextStepsStorage={nextStepsStorage}
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Нет клиентов по выбранным фильтрам."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                actualizationState={teamActualizationPlane}
                {...workPlanListProps}
                archiveBulk={archiveBulkListProps}
              />
            ) : (
              <DealerBaseSegmentGroups
                rows={rowsFinalForList}
                profile={profile}
                showcaseDensity={showcaseDensity}
                narrowViewport={viewportNarrow}
                nextStepsStorage={nextStepsStorage}
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Нет записей."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                actualizationState={teamActualizationPlane}
                {...workPlanListProps}
                archiveBulk={archiveBulkListProps}
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
                profile={profile}
                showcaseDensity={showcaseDensity}
                narrowViewport={viewportNarrow}
                nextStepsStorage={nextStepsStorage}
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Ничего не найдено."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                actualizationState={teamActualizationPlane}
                {...workPlanListProps}
                archiveBulk={archiveBulkListProps}
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
                profile={profile}
                showcaseDensity={showcaseDensity}
                narrowViewport={viewportNarrow}
                nextStepsStorage={nextStepsStorage}
                segmentCollapse={segmentCollapse}
                onToggleSegmentCollapse={toggleSegmentCollapse}
                emptyMessage="Нет клиентов команды по фильтрам."
                shipmentActiveDayId={activeShipmentDayId}
                shipmentUserId={profile.personaUserId}
                actualizationState={teamActualizationPlane}
                {...workPlanListProps}
                archiveBulk={archiveBulkListProps}
              />
            )}
          </div>
        ) : null}
      </section>

      <AlertDialog
        open={bulkArchiveDealerDialogOpen}
        onOpenChange={(open) => {
          if (bulkArchiveDealerBusy) return;
          setBulkArchiveDealerDialogOpen(open);
        }}
      >
        <AlertDialogContent data-testid="dialog-dealer-bulk-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Переместить {bulkArchiveDealerDialogCount} клиентов в корзину?</AlertDialogTitle>
            <AlertDialogDescription>
              Клиенты будут храниться в корзине 14 дней. Восстановить можно в любой момент на странице «Корзина». Через 14 дней удалятся окончательно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid="button-dealer-bulk-archive-cancel"
              >
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-bulk-archive-confirm"
              disabled={bulkArchiveDealerBusy || bulkArchiveDealerDialogCount === 0}
              onClick={() => void confirmBulkArchiveDealers()}
            >
              {bulkArchiveDealerBusy ? "Сохранение…" : "Переместить в корзину"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
