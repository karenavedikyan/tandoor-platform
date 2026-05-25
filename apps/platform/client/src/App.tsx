import { lazy, Suspense, useEffect, useMemo, type ComponentType, type LazyExoticComponent } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { PageLoadingFallback } from "@/components/navigation/page-loading";
import { useMockAuth } from "@/hooks/use-mock-auth";
import { canAccessPath, defaultHomePathForRole, getPilotNavigation } from "@/lib/auth-access";
import { buildHashPath } from "@/lib/hash-route-utils";
import { useBitrix24EmbeddedFlag } from "@/lib/bitrix24-integration";
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
import type { SalesUser } from "@/lib/sales-control-data";

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
const LazyLogin = lazy(() => import("@/pages/login"));
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
const FeatureInDevelopmentRoute = suspensePage(LazyFeatureInDevelopment);

function HashRedirect({ to }: { to: string }) {
  const [, setLoc] = useHashLocation();
  useEffect(() => {
    setLoc(to);
  }, [to, setLoc]);
  return <PageLoadingFallback />;
}

function AuthenticatedShell({
  user,
  shellHomeHref,
  embeddedBitrix24,
  onLogout,
}: {
  user: SalesUser;
  shellHomeHref: string;
  embeddedBitrix24: boolean;
  onLogout: () => void;
}) {
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
    () => getPilotNavigation(user.role, dealerNavCount, tradePointNavCount),
    [user.role, dealerNavCount, tradePointNavCount],
  );

  return (
    <AppShell
      navigation={navigation}
      homeHref={shellHomeHref}
      userName={user.name}
      onLogout={onLogout}
      embeddedBitrix24={embeddedBitrix24}
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
        <Route path="/users" component={UsersAndAccessRoute} />
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

function AuthenticatedApp() {
  const [loc] = useLocation();
  const [, setLoc] = useHashLocation();
  const { isAuthenticated, user, logout } = useMockAuth();
  const embeddedBitrix24 = useBitrix24EmbeddedFlag();

  const path = loc && loc.length > 0 ? loc : "/";

  if (!isAuthenticated || !user) {
    return <HashRedirect to="/login" />;
  }

  if (!canAccessPath(user.role, path)) {
    return <HashRedirect to={defaultHomePathForRole(user.role)} />;
  }

  const homeHref = defaultHomePathForRole(user.role);
  const shellHomeHref = embeddedBitrix24 ? buildHashPath(homeHref.split("?")[0] ?? homeHref, { embedded: "bitrix24" }) : homeHref;

  return (
    <ClientBaseActualizationProvider>
      <ClientBaseTeamActualizationProvider>
        <AuthenticatedShell
          user={user}
          shellHomeHref={shellHomeHref}
          embeddedBitrix24={embeddedBitrix24}
          onLogout={() => {
            logout();
            setLoc("/login");
          }}
        />
      </ClientBaseTeamActualizationProvider>
    </ClientBaseActualizationProvider>
  );
}

function AppRouter() {
  const [loc] = useLocation();
  const path = loc && loc.length > 0 ? loc : "/";

  if (path === "/login") {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LazyLogin />
      </Suspense>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
