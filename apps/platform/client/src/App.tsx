import { lazy, Suspense, useEffect, useMemo, type ComponentType, type LazyExoticComponent } from "react";
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
import { PageLoadingFallback } from "@/components/navigation/page-loading";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";
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
import { ThemeProvider } from "@/context/theme-provider";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { resolveSidebarWorkingDealerClientCount } from "@/lib/dealer-base-sidebar-client-count";
import { countWorkingTradePointsForSidebar } from "@/lib/trade-point-list-for-actualization";

const LazySalesManagerWorkspace = lazy(() => import("@/pages/sales-manager-workspace"));
const LazyDealerBase = lazy(() => import("@/pages/dealer-base"));
const LazyTradePoints = lazy(() => import("@/pages/trade-points"));
const LazyClientMap = lazy(() => import("@/pages/client-map"));
const LazyDealerCardFoundation = lazy(() => import("@/pages/dealer-card-foundation"));
const LazyDealerCardPage = lazy(() => import("@/pages/dealer-card-foundation").then((m) => ({ default: m.DealerCardPage })));
const LazyTradePointDetailPage = lazy(() => import("@/pages/trade-point-detail").then((m) => ({ default: m.TradePointDetailPage })));
const LazyCatalogPage = lazy(() => import("@/pages/catalog"));
const LazyProductDetailPage = lazy(() => import("@/pages/product-detail").then((m) => ({ default: m.ProductDetailPage })));
const LazyTasksPage = lazy(() => import("@/pages/tasks"));
const LazyOrdersPage = lazy(() => import("@/pages/orders"));
const LazyOrderDetailPage = lazy(() => import("@/pages/order-detail"));
const LazyAnalyticsPage = lazy(() => import("@/pages/analytics"));
const LazyTrainingPage = lazy(() => import("@/pages/training"));
const LazyTrainingProgramPage = lazy(() => import("@/pages/training-program"));
const LazyTrainingArticlePage = lazy(() => import("@/pages/training-article"));
const LazyTerritoryCardPage = lazy(() => import("@/pages/territory-card"));
const LazySalesControlHub = lazy(() => import("@/pages/sales-control"));
const LazySalesControlDirector = lazy(() => import("@/pages/sales-control-director"));
const LazySalesControlTeamLead = lazy(() => import("@/pages/sales-control-team-lead"));
const LazySalesControlManager = lazy(() => import("@/pages/sales-control-manager"));
const LazySalesControlPlans = lazy(() => import("@/pages/sales-control-plans"));
const LazySalesControlPerformance = lazy(() => import("@/pages/sales-control-performance"));
const LazySalesPlanFactManagement = lazy(() => import("@/pages/sales-plan-fact-management"));
const LazyAnalyticsWorkspace = lazy(() => import("@/pages/analytics-workspace"));
const LazyMarketingBriefs = lazy(() => import("@/pages/marketing-briefs"));
const LazyMarketingBriefPublished = lazy(() =>
  import("@/pages/marketing-briefs").then((m) => ({ default: m.MarketingBriefPublishedPage })),
);
const LazyReleaseOne = lazy(() => import("@/pages/release-one"));
const LazyReleaseClients = lazy(() => import("@/pages/release-clients"));
const LazyBitrix24Poc = lazy(() => import("@/pages/bitrix24-poc"));
const LazyCommunications = lazy(() => import("@/pages/communications"));
const LazyClientBaseActivityDashboard = lazy(() => import("@/pages/client-base-activity-dashboard"));
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
const LazyFeatureInDevelopment = lazy(() => import("@/pages/feature-in-development"));

function suspensePage(Lazy: LazyExoticComponent<ComponentType<any>>): ComponentType<any> {
  const Wrapped: ComponentType<any> = (props) => (
    <Suspense fallback={<PageLoadingFallback />}>
      <Lazy {...props} />
    </Suspense>
  );
  return Wrapped;
}

const SalesManagerWorkspaceRoute = suspensePage(LazySalesManagerWorkspace);
const DealerBaseRoute = suspensePage(LazyDealerBase);
const TradePointsRoute = suspensePage(LazyTradePoints);
const ClientMapRoute = suspensePage(LazyClientMap);
const DealerCardFoundationRoute = suspensePage(LazyDealerCardFoundation);
const DealerCardPageRoute = suspensePage(LazyDealerCardPage);
const TradePointDetailPageRoute = suspensePage(LazyTradePointDetailPage);
const CatalogPageRoute = suspensePage(LazyCatalogPage);
const ProductDetailPageRoute = suspensePage(LazyProductDetailPage);
const TasksPageRoute = suspensePage(LazyTasksPage);
const OrdersPageRoute = suspensePage(LazyOrdersPage);
const OrderDetailPageRoute = suspensePage(LazyOrderDetailPage);
const AnalyticsPageRoute = suspensePage(LazyAnalyticsPage);
const TrainingPageRoute = suspensePage(LazyTrainingPage);
const TrainingProgramPageRoute = suspensePage(LazyTrainingProgramPage);
const TrainingArticlePageRoute = suspensePage(LazyTrainingArticlePage);
const TerritoryCardPageRoute = suspensePage(LazyTerritoryCardPage);
const SalesControlHubRoute = suspensePage(LazySalesControlHub);
const SalesControlDirectorRoute = suspensePage(LazySalesControlDirector);
const SalesControlTeamLeadRoute = suspensePage(LazySalesControlTeamLead);
const SalesControlManagerRoute = suspensePage(LazySalesControlManager);
const SalesControlPlansRoute = suspensePage(LazySalesControlPlans);
const SalesControlPerformanceRoute = suspensePage(LazySalesControlPerformance);
const SalesPlanFactManagementRoute = suspensePage(LazySalesPlanFactManagement);
const AnalyticsWorkspaceRoute = suspensePage(LazyAnalyticsWorkspace);
const MarketingBriefsRoute = suspensePage(LazyMarketingBriefs);
const MarketingBriefPublishedRoute = suspensePage(LazyMarketingBriefPublished);
const ReleaseOneRoute = suspensePage(LazyReleaseOne);
const ReleaseClientsRoute = suspensePage(LazyReleaseClients);
const Bitrix24PocRoute = suspensePage(LazyBitrix24Poc);
const CommunicationsRoute = suspensePage(LazyCommunications);
const ClientBaseActivityDashboardRoute = suspensePage(LazyClientBaseActivityDashboard);
const UsersAndAccessRoute = suspensePage(LazyUsersAndAccess);
const MyProfileRoute = suspensePage(LazyMyProfile);
const ChangePasswordRoute = suspensePage(LazyChangePassword);
const FeatureInDevelopmentRoute = suspensePage(LazyFeatureInDevelopment);
const InviteRoute = suspensePage(LazyInvite);
const ResetPasswordRoute = suspensePage(LazyResetPassword);
const ForgotPasswordRoute = suspensePage(LazyForgotPassword);
const ResetRequestsRoute = suspensePage(LazyResetRequests);
const AdminInvitationsRoute = suspensePage(LazyAdminInvitations);
const AdminUsersRoute = suspensePage(LazyAdminUsers);
const AdminAuditRoute = suspensePage(LazyAdminAudit);
const AdminClientAssignmentsRoute = suspensePage(LazyAdminClientAssignments);
const AdminActualizationDedupeRoute = suspensePage(LazyAdminActualizationDedupe);

function HashRedirect({ to }: { to: string }) {
  const [, setLoc] = useHashLocation();
  useEffect(() => {
    setLoc(to);
  }, [to, setLoc]);
  return <PageLoadingFallback />;
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
  const actx = useClientBaseActualization();
  const teamPlane = useClientBaseTeamActualization();
  const dealerNavCount = useMemo(
    () =>
      resolveSidebarWorkingDealerClientCount(profile, {
        enabled: actx.enabled,
        loading: actx.loading,
        state: actx.state,
        managementDisplayState: teamPlane.mergedState,
        managementTeamFetchLoading: teamPlane.teamFetchLoading,
      }),
    [
      profile,
      actx.enabled,
      actx.loading,
      actx.state,
      teamPlane.mergedState,
      teamPlane.teamFetchLoading,
    ],
  );
  const tradePointNavCount = useMemo(() => {
    if (!actx.enabled) return undefined;
    if (actx.loading || teamPlane.teamFetchLoading) return null;
    return countWorkingTradePointsForSidebar(profile, teamPlane.mergedState);
  }, [actx.enabled, actx.loading, teamPlane.mergedState, teamPlane.teamFetchLoading, profile]);
  const navigation = useMemo(
    () => getPilotNavigation(salesRole, dealerNavCount, tradePointNavCount, user.role),
    [salesRole, dealerNavCount, tradePointNavCount, user.role],
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
    >
      <Switch>
        <Route path="/" component={SalesManagerWorkspaceRoute} />
        <Route path="/main" component={SalesManagerWorkspaceRoute} />
        <Route path="/sales-manager" component={SalesManagerWorkspaceRoute} />
        <Route path="/bitrix24" component={Bitrix24PocRoute} />
        <Route path="/embedded/bitrix24" component={Bitrix24PocRoute} />
        <Route path="/feature-in-development" component={FeatureInDevelopmentRoute} />
        <Route path="/communications" component={CommunicationsRoute} />
        <Route path="/client-base-activity" component={ClientBaseActivityDashboardRoute} />
        <Route path="/admin/users" component={AdminUsersRoute} />
        <Route path="/admin/invitations" component={AdminInvitationsRoute} />
        <Route path="/admin/audit" component={AdminAuditRoute} />
        <Route path="/admin/client-assignments" component={AdminClientAssignmentsRoute} />
        <Route path="/admin/actualization/dedupe" component={AdminActualizationDedupeRoute} />
        <Route path="/reset-requests" component={ResetRequestsRoute} />
        <Route path="/users" component={UsersAndAccessRoute} />
        <Route path="/profile/change-password" component={ChangePasswordRoute} />
        <Route path="/profile" component={MyProfileRoute} />
        <Route path="/dealer-base" component={DealerBaseRoute} />
        <Route path="/trade-points" component={TradePointsRoute} />
        <Route path="/client-map" component={ClientMapRoute} />
        <Route path="/catalog/:productId" component={ProductDetailPageRoute} />
        <Route path="/catalog" component={CatalogPageRoute} />
        <Route path="/tasks" component={TasksPageRoute} />
        <Route path="/training/programs/:programId" component={TrainingProgramPageRoute} />
        <Route path="/training/:articleId" component={TrainingArticlePageRoute} />
        <Route path="/training" component={TrainingPageRoute} />
        <Route path="/territory-card" component={TerritoryCardPageRoute} />
        <Route path="/sales-control/plan-fact" component={SalesPlanFactManagementRoute} />
        <Route path="/sales-control/director" component={SalesControlDirectorRoute} />
        <Route path="/sales-control/team-lead" component={SalesControlTeamLeadRoute} />
        <Route path="/sales-control/manager" component={SalesControlManagerRoute} />
        <Route path="/sales-control/plans" component={SalesControlPlansRoute} />
        <Route path="/sales-control/performance" component={SalesControlPerformanceRoute} />
        <Route path="/sales-control" component={SalesControlHubRoute} />
        <Route path="/analytics-workspace" component={AnalyticsWorkspaceRoute} />
        <Route path="/marketing-briefs/view/:id" component={MarketingBriefPublishedRoute} />
        <Route path="/marketing-briefs" component={MarketingBriefsRoute} />
        <Route path="/release-one/clients" component={ReleaseClientsRoute} />
        <Route path="/release-one" component={ReleaseOneRoute} />
        <Route path="/analytics" component={AnalyticsPageRoute} />
        <Route path="/orders/:orderId" component={OrderDetailPageRoute} />
        <Route path="/orders" component={OrdersPageRoute} />
        <Route path="/dealers/:dealerId/trade-points/:pointId" component={TradePointDetailPageRoute} />
        <Route path="/dealers/:id" component={DealerCardPageRoute} />
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

  const path = loc && loc.length > 0 ? loc : "/";
  const normPath = normRoutePath(path);

  if (!canAccessPathForUser(user.role, path)) {
    return <HashRedirect to={defaultHomePathForUserRole(user.role)} />;
  }

  const homeHref = defaultHomePathForUserRole(user.role);
  const shellHomeHref = embeddedBitrix24 ? buildHashPath(homeHref.split("?")[0] ?? homeHref, { embedded: "bitrix24" }) : homeHref;

  return (
    <ClientBaseActualizationProvider>
      <ClientBaseTeamActualizationProvider>
        <AuthenticatedShell user={user} shellHomeHref={shellHomeHref} embeddedBitrix24={embeddedBitrix24} onLogout={logout} />
      </ClientBaseTeamActualizationProvider>
    </ClientBaseActualizationProvider>
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
