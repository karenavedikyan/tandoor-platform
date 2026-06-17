import { lazy, Suspense, useEffect, useMemo, type ComponentType, type LazyExoticComponent, type ReactElement } from "react";
import { Switch, Route, Router, useLocation, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { OnboardingUiProvider } from "@/context/onboarding-ui-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { NavigationDepthTracker } from "@/components/navigation/navigation-depth-tracker";
import { PageLoadingFallback } from "@/components/navigation/page-loading";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";
import { useDealerWorkPlanHydration } from "@/hooks/use-dealer-work-plan-hydration";
import { OverridesSessionBootstrap } from "@/components/overrides-session-bootstrap";
import {
  canAccessPathForUser,
  defaultHomePathForUserRole,
  getPilotNavigation,
} from "@/lib/auth-access";
import { buildBrowserHashAppHref, buildHashPath } from "@/lib/hash-route-utils";
import { useBitrix24EmbeddedFlag } from "@/lib/bitrix24-integration";
import { isDemoAuthBypassEnabled } from "@/lib/release-demo-bypass";
import { userRoleToSalesRole } from "@/lib/role-mapping";
import { userHas } from "@/lib/auth-rbac";
import type { AuthUserDTO } from "@/lib/auth-api";
import type { UserRole } from "@shared/auth";
import { useStopImpersonation } from "@/lib/use-impersonation";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import PreviewUnavailable from "@/pages/preview-unavailable";
import InternalPrototypePlaceholder from "@/pages/internal-prototype-placeholder";
import { INTERNAL_PROTOTYPE_ROUTES } from "@/lib/preview-config";
import { ClientBaseActualizationProvider, useClientBaseActualization } from "@/context/client-base-actualization-context";
import { ClientBaseTeamActualizationProvider, useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { MainDashboardCityFilterProvider } from "@/context/main-dashboard-city-filter-context";
import { ProfileShell } from "@/components/profile/profile-shell";
import { ThemeProvider } from "@/context/theme-provider";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { resolveSidebarTrashCount, resolveSidebarWorkingDealerClientCount } from "@/lib/dealer-base-sidebar-client-count";
import { resolveSidebarTradePointsCount } from "@/lib/sidebar-trade-points-count";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { DealerBaseRowsProvider } from "@/context/dealer-base-rows-provider";
import { setRealScopeAuditUserId } from "@/lib/real-scope-audit";
import { initWebVitalsReporter } from "@/lib/web-vitals-reporter";

const LazySalesManagerWorkspace = lazy(() => import("@/pages/sales-manager-workspace"));
const LazyMainManagerDetail = lazy(() => import("@/pages/main-manager-detail"));
const LazyMainRopDetail = lazy(() => import("@/pages/main-rop-detail"));
const LazyDealerBase = lazy(() => import("@/pages/dealer-base"));
const LazyDealerBaseCityDetail = lazy(() => import("@/pages/dealer-base-city-detail"));
const LazyDealerBaseManagerDetail = lazy(() => import("@/pages/dealer-base-manager-detail"));
const LazyTradePoints = lazy(() => import("@/pages/trade-points"));
const LazyClientMap = lazy(() => import("@/pages/client-map"));
const LazyDealerCardFoundation = lazy(() => import("@/pages/dealer-card-foundation"));
const LazyDealerCardPage = lazy(() => import("@/pages/dealer-card-foundation").then((m) => ({ default: m.DealerCardPage })));
const LazyTradePointDetailPage = lazy(() => import("@/pages/trade-point-detail").then((m) => ({ default: m.TradePointDetailPage })));
const LazyCatalogPage = lazy(() => import("@/pages/catalog"));
const LazyCatalogProduct1cPage = lazy(() => import("@/pages/catalog-product-1c"));
const LazyCatalogLegacyRedirect = lazy(() =>
  import("@/pages/catalog-legacy-redirect").then((m) => ({ default: m.CatalogLegacyRedirect })),
);
const LazyTasksPage = lazy(() => import("@/pages/tasks"));
const LazyDistributionPage = lazy(() => import("@/pages/distribution"));
const LazyDistributionMatrixCatalogPage = lazy(() => import("@/pages/distribution-matrix-catalog"));
const LazyModelCardPage = lazy(() => import("@/pages/model-card"));
const LazyOrdersPage = lazy(() => import("@/pages/orders"));
const LazyOrderDetailPage = lazy(() => import("@/pages/order-detail"));
const LazyAnalyticsPage = lazy(() => import("@/pages/analytics"));
const LazyTrainingPage = lazy(() => import("@/pages/training"));
const LazyTrainingProgramPage = lazy(() => import("@/pages/training-program"));
const LazyTrainingArticlePage = lazy(() => import("@/pages/training-article"));
const LazySalesControlHub = lazy(() => import("@/pages/sales-control"));
const LazySalesControlDirector = lazy(() => import("@/pages/sales-control-director"));
const LazySalesControlTeamLead = lazy(() => import("@/pages/sales-control-team-lead"));
const LazySalesControlManager = lazy(() => import("@/pages/sales-control-manager"));
const LazySalesControlPlans = lazy(() => import("@/pages/sales-control-plans"));
const LazySalesControlPerformance = lazy(() => import("@/pages/sales-control-performance"));
const LazySalesPlanFactManagement = lazy(() => import("@/pages/sales-plan-fact-management"));
const LazyMarketingBriefs = lazy(() => import("@/pages/marketing-briefs"));
const LazyMarketingBriefEditor = lazy(() => import("@/pages/marketing-brief-editor"));
const LazyMarketingBriefPublished = lazy(() =>
  import("@/pages/marketing-briefs").then((m) => ({ default: m.MarketingBriefPublishedPage })),
);
const LazyMarketingBriefPublic = lazy(() => import("@/pages/marketing-brief-public"));
const LazyReleaseOne = lazy(() => import("@/pages/release-one"));
const LazyReleaseClients = lazy(() => import("@/pages/release-clients"));
const LazyBitrix24Poc = lazy(() => import("@/pages/bitrix24-poc"));
const LazyCommunications = lazy(() => import("@/pages/communications"));
const LazyClientBaseActivityDashboard = lazy(() => import("@/pages/client-base-activity-dashboard"));
const LazyTrashBin = lazy(() => import("@/pages/trash-bin"));
const LazyTeamActivity = lazy(() => import("@/pages/team-activity"));
const LazyUsersAndAccess = lazy(() => import("@/pages/users-and-access"));
const LazyMyProfile = lazy(() => import("@/pages/my-profile"));
const LazyChangePassword = lazy(() => import("@/pages/change-password"));
const LazyLogin = lazy(() => import("@/pages/login"));
const LazyInvite = lazy(() => import("@/pages/invite"));
const LazyResetPassword = lazy(() => import("@/pages/reset-password"));
const LazyForgotPassword = lazy(() => import("@/pages/forgot-password"));
const LazyResetRequests = lazy(() => import("@/pages/reset-requests"));
const LazyAdminInvitations = lazy(() => import("@/pages/admin-invitations"));
const LazyAdminUsers = lazy(() => import("@/pages/admin-users"));
const LazyAdminAudit = lazy(() => import("@/pages/admin-audit"));
const LazyAdminClientAssignments = lazy(() => import("@/pages/admin-client-assignments"));
const LazyAdminActualizationDedupe = lazy(() => import("@/pages/admin-actualization-dedupe"));
const LazyAdminMigration = lazy(() => import("@/pages/admin/migration"));
const LazyAdminMigrateMarketingBriefs = lazy(() => import("@/pages/admin-migrate-marketing-briefs"));
const LazyAdminMigrateDealerTp = lazy(() => import("@/pages/admin-migrate-dealer-tp"));
const LazyAdminMigrateCatalog1c = lazy(() => import("@/pages/admin-migrate-catalog-1c"));
const LazyAdminSyncHealth = lazy(() => import("@/pages/admin-sync-health"));
const LazyAdminPerformance = lazy(() => import("@/pages/admin-performance"));
const LazyAdminTpCountDiag = lazy(() => import("@/pages/admin-tp-count-diag"));
const LazyAdminCountsDiag = lazy(() => import("@/pages/admin-counts-diag"));
const LazyFeatureInDevelopment = lazy(() => import("@/pages/feature-in-development"));
const LazyListings = lazy(() => import("@/pages/listings"));
const LazyAssignmentDetail = lazy(() => import("@/pages/assignment-detail"));
const LazyTasksInbox = lazy(() => import("@/pages/tasks-inbox"));

function suspensePage(Lazy: LazyExoticComponent<ComponentType<any>>): ComponentType<any> {
  const Wrapped: ComponentType<any> = (props) => (
    <Suspense fallback={<PageLoadingFallback />}>
      <Lazy {...props} />
    </Suspense>
  );
  return Wrapped;
}

const SalesManagerWorkspaceRoute = suspensePage(LazySalesManagerWorkspace);
const MainManagerDetailRoute = suspensePage(LazyMainManagerDetail);
const MainRopDetailRoute = suspensePage(LazyMainRopDetail);
const DealerBaseRoute = suspensePage(LazyDealerBase);
const DealerBaseCityDetailRoute = suspensePage(LazyDealerBaseCityDetail);
const DealerBaseManagerDetailRoute = suspensePage(LazyDealerBaseManagerDetail);
const TradePointsRoute = suspensePage(LazyTradePoints);
const ClientMapRoute = suspensePage(LazyClientMap);
const DealerCardFoundationRoute = suspensePage(LazyDealerCardFoundation);
const DealerCardPageRoute = suspensePage(LazyDealerCardPage);
const TradePointDetailPageRoute = suspensePage(LazyTradePointDetailPage);
const CatalogPageRoute = suspensePage(LazyCatalogPage);
const CatalogProduct1cPageRoute = suspensePage(LazyCatalogProduct1cPage);
const CatalogLegacyRedirectRoute = suspensePage(LazyCatalogLegacyRedirect);
const TasksPageRoute = suspensePage(LazyTasksPage);
const DistributionPageRoute = suspensePage(LazyDistributionPage);
const DistributionMatrixCatalogPageRoute = suspensePage(LazyDistributionMatrixCatalogPage);
const ModelCardPageRoute = suspensePage(LazyModelCardPage);
const OrdersPageRoute = suspensePage(LazyOrdersPage);
const OrderDetailPageRoute = suspensePage(LazyOrderDetailPage);
const AnalyticsPageRoute = suspensePage(LazyAnalyticsPage);
const TrainingPageRoute = suspensePage(LazyTrainingPage);
const TrainingProgramPageRoute = suspensePage(LazyTrainingProgramPage);
const TrainingArticlePageRoute = suspensePage(LazyTrainingArticlePage);
const SalesControlHubRoute = suspensePage(LazySalesControlHub);
const SalesControlDirectorRoute = suspensePage(LazySalesControlDirector);
const SalesControlTeamLeadRoute = suspensePage(LazySalesControlTeamLead);
const SalesControlManagerRoute = suspensePage(LazySalesControlManager);
const SalesControlPlansRoute = suspensePage(LazySalesControlPlans);
const SalesControlPerformanceRoute = suspensePage(LazySalesControlPerformance);
const SalesPlanFactManagementRoute = suspensePage(LazySalesPlanFactManagement);
const MarketingBriefsRoute = suspensePage(LazyMarketingBriefs);
const MarketingBriefEditorRoute = suspensePage(LazyMarketingBriefEditor);
const MarketingBriefPublishedRoute = suspensePage(LazyMarketingBriefPublished);
const ReleaseOneRoute = suspensePage(LazyReleaseOne);
const ReleaseClientsRoute = suspensePage(LazyReleaseClients);
const Bitrix24PocRoute = suspensePage(LazyBitrix24Poc);
const CommunicationsRoute = suspensePage(LazyCommunications);
const ClientBaseActivityDashboardRoute = suspensePage(LazyClientBaseActivityDashboard);
const TrashBinRoute = suspensePage(LazyTrashBin);
const TeamActivityRoute = suspensePage(LazyTeamActivity);
const UsersAndAccessRoute = suspensePage(LazyUsersAndAccess);
// Промт 47: страницы профиля и админки оборачиваем в общий ProfileShell.
const wrapProfileShell = (Comp: ComponentType<unknown>): ComponentType<unknown> => {
  return function ProfileShellWrapped(): ReactElement {
    return (
      <ProfileShell>
        <Comp />
      </ProfileShell>
    );
  };
};
const MyProfileRoute = wrapProfileShell(suspensePage(LazyMyProfile));
const ChangePasswordRoute = wrapProfileShell(suspensePage(LazyChangePassword));
const FeatureInDevelopmentRoute = suspensePage(LazyFeatureInDevelopment);
const ListingsRoute = suspensePage(LazyListings);
const AssignmentDetailRoute = suspensePage(LazyAssignmentDetail);
const TasksInboxRoute = suspensePage(LazyTasksInbox);
const InviteRoute = suspensePage(LazyInvite);
const MarketingBriefPublicRoute = suspensePage(LazyMarketingBriefPublic);
const ResetPasswordRoute = suspensePage(LazyResetPassword);
const ForgotPasswordRoute = suspensePage(LazyForgotPassword);
const ResetRequestsRoute = wrapProfileShell(suspensePage(LazyResetRequests));
const AdminInvitationsRoute = wrapProfileShell(suspensePage(LazyAdminInvitations));
const AdminUsersRoute = wrapProfileShell(suspensePage(LazyAdminUsers));
const AdminAuditRoute = wrapProfileShell(suspensePage(LazyAdminAudit));
const AdminClientAssignmentsRoute = wrapProfileShell(suspensePage(LazyAdminClientAssignments));
const AdminActualizationDedupeRoute = wrapProfileShell(suspensePage(LazyAdminActualizationDedupe));
const AdminMigrationRoute = wrapProfileShell(suspensePage(LazyAdminMigration));
const AdminMigrateMarketingBriefsRoute = wrapProfileShell(suspensePage(LazyAdminMigrateMarketingBriefs));
const AdminMigrateDealerTpRoute = wrapProfileShell(suspensePage(LazyAdminMigrateDealerTp));
const AdminMigrateCatalog1cRoute = wrapProfileShell(suspensePage(LazyAdminMigrateCatalog1c));
const AdminSyncHealthRoute = wrapProfileShell(suspensePage(LazyAdminSyncHealth));
const AdminPerformanceRoute = wrapProfileShell(suspensePage(LazyAdminPerformance));
const AdminTpCountDiagRoute = wrapProfileShell(suspensePage(LazyAdminTpCountDiag));
const AdminCountsDiagRoute = wrapProfileShell(suspensePage(LazyAdminCountsDiag));

function HashRedirect({ to }: { to: string }) {
  const [, setLoc] = useHashLocation();
  useEffect(() => {
    setLoc(to);
  }, [to, setLoc]);
  return <PageLoadingFallback />;
}

function HomeRedirect() {
  const { user } = useCurrentUser();
  if (!user) return <PageLoadingFallback />;
  const to = defaultHomePathForUserRole(user.role);
  const safeTo = to === "/" ? "/dealer-base" : to;
  return <HashRedirect to={safeTo} />;
}

function normRoutePath(path: string): string {
  const p = path.split("?")[0] || "/";
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p || "/";
}

function isReleaseDemoPath(path: string): boolean {
  const p = normRoutePath(path);
  return p === "/release-one" || p.startsWith("/release-one/");
}

function ReleaseDemoRoutes() {
  return (
    <Switch>
      <Route path="/release-one/clients" component={ReleaseClientsRoute} />
      <Route path="/release-one" component={ReleaseOneRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AccountDisabledScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl border border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Учётка отключена</CardTitle>
          <CardDescription>Доступ к платформе для этой учётной записи заблокирован.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Обратитесь к администратору, если это ошибка.</p>
        </CardContent>
        <CardFooter>
          <Button className="w-full font-semibold" type="button" onClick={() => void onLogout()}>
            Выйти
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}



const IMPERSONATION_ROLE_LABELS_RU: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  category_manager: "Категорийный менеджер",
  admin: "Администратор",
};

function AuthenticatedShell({
  user,
  shellHomeHref,
  embeddedBitrix24,
  onLogout,
}: {
  user: AuthUserDTO;
  shellHomeHref: string;
  embeddedBitrix24: boolean;
  onLogout: () => void | Promise<void>;
}) {
  const salesRole = useMemo(() => userRoleToSalesRole(user.role), [user.role]);
  const { profile } = useReleaseDemoProfile();
  useEffect(() => {
    setRealScopeAuditUserId(user.id);
    attachRealScopeAuditUnloadFlush();
  }, [user.id]);
  useDealerWorkPlanHydration(user.id, profile.personaUserId);
  const overridesBootstrap = (
    <OverridesSessionBootstrap userId={user.id} localUserId={profile.personaUserId} />
  );
  const actx = useClientBaseActualization();
  const teamPlane = useClientBaseTeamActualization();
  const showTradePointsNav =
    salesRole === "sales_director" ||
    salesRole === "team_lead" ||
    salesRole === "sales_manager" ||
    salesRole === "marketer" ||
    salesRole === "analyst";
  const sidebarRealScope = useSidebarNavRealScope(showTradePointsNav || actx.enabled);
  const sidebarCountCtx = useMemo(
    () => ({
      enabled: actx.enabled,
      loading: actx.loading,
      state: actx.state,
      managementDisplayState: teamPlane.mergedState,
      managementTeamFetchLoading: teamPlane.teamFetchLoading,
      realScope: sidebarRealScope,
      role: user.role,
    }),
    [
      actx.enabled,
      actx.loading,
      actx.state,
      teamPlane.mergedState,
      teamPlane.teamFetchLoading,
      sidebarRealScope,
      user.role,
    ],
  );
  const dealerNavCount = useMemo(
    () => resolveSidebarWorkingDealerClientCount(profile, sidebarCountCtx),
    [profile, sidebarCountCtx],
  );
  const tradePointNavCount = useMemo(() => {
    if (!showTradePointsNav) return undefined;
    return resolveSidebarTradePointsCount(profile, sidebarCountCtx);
  }, [showTradePointsNav, profile, sidebarCountCtx]);
  const trashNavCount = useMemo(
    () => resolveSidebarTrashCount(profile, sidebarCountCtx),
    [profile, sidebarCountCtx],
  );
  const navigation = useMemo(
    () => getPilotNavigation(salesRole, dealerNavCount, tradePointNavCount, user.role, trashNavCount),
    [salesRole, dealerNavCount, tradePointNavCount, user.role, trashNavCount],
  );

  const showAuditLogLink = userHas(user.role, "audit.read");
  const { toast } = useToast();
  const stopImpersonation = useStopImpersonation();

  const impersonationBanner =
    user.impersonatedBy ? (
      <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900 shadow-sm">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 leading-snug">
            <span aria-hidden>🛈 </span>
            Вы наблюдаете за <strong>{displayUserName(user)}</strong> · {IMPERSONATION_ROLE_LABELS_RU[user.role]}. Все действия
            логируются.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-400 bg-white text-amber-900 hover:bg-amber-50"
            disabled={stopImpersonation.isPending}
            onClick={() => {
              void stopImpersonation
                .mutateAsync()
                .then(() => {
                  window.location.assign(buildBrowserHashAppHref("/admin/users"));
                })
                .catch((e: unknown) => {
                  toast({
                    variant: "destructive",
                    title: "Не удалось выйти из режима наблюдения",
                    description: e instanceof Error ? e.message : "Ошибка запроса",
                  });
                });
            }}
          >
            Вернуться в свой аккаунт
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <AppShell
      navigation={navigation}
      homeHref={shellHomeHref}
      userName={displayUserName(user)}
      onLogout={() => void onLogout()}
      showAuditLogLink={showAuditLogLink}
      embeddedBitrix24={embeddedBitrix24}
      impersonationBanner={impersonationBanner}
      navDebugRoles={{ salesRole, platformUserRole: user.role }}
      shellUser={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      }}
      isImpersonating={Boolean(user.impersonatedBy)}
    >
      {overridesBootstrap}
      <NavigationDepthTracker />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/main/rop/:ropId" component={MainRopDetailRoute} />
        <Route path="/main/manager/:managerId" component={MainManagerDetailRoute} />
        <Route path="/main" component={HomeRedirect} />
        <Route path="/sales-manager" component={HomeRedirect} />
        <Route path="/bitrix24" component={Bitrix24PocRoute} />
        <Route path="/embedded/bitrix24" component={Bitrix24PocRoute} />
        <Route path="/feature-in-development" component={FeatureInDevelopmentRoute} />
        <Route path="/communications" component={CommunicationsRoute} />
        <Route path="/client-base-activity" component={ClientBaseActivityDashboardRoute} />
        <Route path="/trash" component={TrashBinRoute} />
        <Route path="/team-activity" component={TeamActivityRoute} />
        <Route path="/admin/users" component={AdminUsersRoute} />
        <Route path="/admin/invitations" component={AdminInvitationsRoute} />
        <Route path="/admin/audit" component={AdminAuditRoute} />
        <Route path="/admin/client-assignments" component={AdminClientAssignmentsRoute} />
        <Route path="/admin/actualization/dedupe" component={AdminActualizationDedupeRoute} />
        <Route path="/admin/migration" component={AdminMigrationRoute} />
        <Route path="/admin/migrate-marketing-briefs" component={AdminMigrateMarketingBriefsRoute} />
        <Route path="/admin/migrate-dealer-tp" component={AdminMigrateDealerTpRoute} />
        <Route path="/admin/migrate-catalog-1c" component={AdminMigrateCatalog1cRoute} />
        <Route path="/admin/migrate" component={AdminMigrateCatalog1cRoute} />
        <Route path="/admin/sync-health" component={AdminSyncHealthRoute} />
        <Route path="/admin/performance" component={AdminPerformanceRoute} />
        <Route path="/admin/tp-count-diag" component={AdminTpCountDiagRoute} />
        <Route path="/admin/counts-diag" component={AdminCountsDiagRoute} />
        <Route path="/reset-requests" component={ResetRequestsRoute} />
        <Route path="/users" component={UsersAndAccessRoute} />
        <Route path="/profile/change-password" component={ChangePasswordRoute} />
        <Route path="/profile" component={MyProfileRoute} />
        <Route path="/dealer-base/city/:cityKey" component={DealerBaseCityDetailRoute} />
        <Route path="/dealer-base/manager/:managerId" component={DealerBaseManagerDetailRoute} />
        <Route path="/dealer-base" component={DealerBaseRoute} />
        <Route path="/trade-points" component={TradePointsRoute} />
        <Route path="/client-map" component={ClientMapRoute} />
        <Route path="/catalog/1c/:productId" component={CatalogProduct1cPageRoute} />
        <Route path="/catalog/:productId" component={CatalogLegacyRedirectRoute} />
        <Route path="/catalog" component={CatalogPageRoute} />
        <Route path="/tasks" component={TasksPageRoute} />
        <Route path="/distribution/matrix-catalog" component={DistributionMatrixCatalogPageRoute} />
        <Route path="/model/:modelId" component={ModelCardPageRoute} />
        <Route path="/distribution" component={DistributionPageRoute} />
        <Route path="/training/programs/:programId" component={TrainingProgramPageRoute} />
        <Route path="/training/:articleId" component={TrainingArticlePageRoute} />
        <Route path="/training" component={TrainingPageRoute} />
        <Route path="/sales-control/plan-fact" component={SalesPlanFactManagementRoute} />
        <Route path="/sales-control/director" component={SalesControlDirectorRoute} />
        <Route path="/sales-control/team-lead" component={SalesControlTeamLeadRoute} />
        <Route path="/sales-control/manager" component={SalesControlManagerRoute} />
        <Route path="/sales-control/plans" component={SalesControlPlansRoute} />
        <Route path="/sales-control/performance" component={SalesControlPerformanceRoute} />
        <Route path="/sales-control" component={SalesControlHubRoute} />
        <Route path="/marketing-briefs/view/:id" component={MarketingBriefPublishedRoute} />
        <Route path="/marketing-briefs/:id" component={MarketingBriefEditorRoute} />
        <Route path="/marketing-briefs" component={MarketingBriefsRoute} />
        <Route path="/listings" component={ListingsRoute} />
        <Route path="/release-one/clients" component={ReleaseClientsRoute} />
        <Route path="/release-one" component={ReleaseOneRoute} />
        <Route path="/analytics" component={AnalyticsPageRoute} />
        <Route path="/orders/:orderId" component={OrderDetailPageRoute} />
        <Route path="/orders" component={OrdersPageRoute} />
        <Route path="/dealers/:dealerId/trade-points/:pointId" component={TradePointDetailPageRoute} />
        <Route path="/dealers/:id" component={DealerCardPageRoute} />
        <Route path="/assignments" component={TasksInboxRoute} />
        <Route path="/assignment/:id" component={AssignmentDetailRoute} />
        <Route path="/dealer-card-foundation" component={DealerCardFoundationRoute} />
        <Route path="/platform-architecture" component={PreviewUnavailable} />
        {INTERNAL_PROTOTYPE_ROUTES.map((path) => (
          <Route key={path} path={path} component={InternalPrototypePlaceholder} />
        ))}
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function AuthenticatedApp({ user, logout }: { user: AuthUserDTO; logout: () => Promise<void> }) {
  const [loc] = useLocation();
  const embeddedBitrix24 = useBitrix24EmbeddedFlag();

  useEffect(() => {
    initWebVitalsReporter(user.id, user.role);
  }, [user.id, user.role]);

  const path = loc && loc.length > 0 ? loc : "/";
  const normPath = normRoutePath(path);

  if (!canAccessPathForUser(user.role, path)) {
    return <HashRedirect to={defaultHomePathForUserRole(user.role)} />;
  }

  const homeHref = defaultHomePathForUserRole(user.role);
  const shellHomeHref = embeddedBitrix24 ? buildHashPath(homeHref.split("?")[0] ?? homeHref, { embedded: "bitrix24" }) : homeHref;

  return (
    <DealerBaseRowsProvider>
      <ClientBaseActualizationProvider>
        <ClientBaseTeamActualizationProvider>
          <MainDashboardCityFilterProvider>
            <AuthenticatedShell user={user} shellHomeHref={shellHomeHref} embeddedBitrix24={embeddedBitrix24} onLogout={logout} />
          </MainDashboardCityFilterProvider>
        </ClientBaseTeamActualizationProvider>
      </ClientBaseActualizationProvider>
    </DealerBaseRowsProvider>
  );
}

function AppRouter() {
  const [loc] = useLocation();
  const path = loc && loc.length > 0 ? loc : "/";
  const { user, isAuthenticated, isLoading, logout } = useCurrentUser();
  const bypass = isDemoAuthBypassEnabled();
  const demoOnly = bypass && isReleaseDemoPath(path) && !isAuthenticated && !isLoading;

  if (normRoutePath(path) === "/reset") {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <ResetPasswordRoute />
      </Suspense>
    );
  }

  if (normRoutePath(path) === "/forgot") {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <ForgotPasswordRoute />
      </Suspense>
    );
  }

  if (path === "/login") {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LazyLogin />
      </Suspense>
    );
  }

  if (normRoutePath(path).startsWith("/p/brief/")) {
    const legacyId = normRoutePath(path).replace(/^\/p\/brief\//, "").split("/")[0] ?? "";
    if (legacyId) {
      return <HashRedirect to={`/marketing-briefs/public/${legacyId}`} />;
    }
  }

  if (normRoutePath(path).startsWith("/marketing-briefs/public/")) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <Route path="/marketing-briefs/public/:id" component={MarketingBriefPublicRoute} />
      </Suspense>
    );
  }

  if (normRoutePath(path).startsWith("/invite/")) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <Switch>
          <Route path="/invite/:token" component={InviteRoute} />
          <Route>
            <div className="flex min-h-screen items-center justify-center bg-background px-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-lg">Некорректная ссылка</CardTitle>
                  <CardDescription>Ожидается полная ссылка приглашения.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href="/login">На страницу входа</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </Route>
        </Switch>
      </Suspense>
    );
  }

  if (demoOnly) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <ReleaseDemoRoutes />
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Загрузка…</div>
    );
  }

  if (user && user.status === "disabled") {
    return <AccountDisabledScreen onLogout={logout} />;
  }

  if (!isAuthenticated || !user) {
    return <HashRedirect to="/login" />;
  }

  return <AuthenticatedApp user={user} logout={logout} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <OnboardingUiProvider>
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </OnboardingUiProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
