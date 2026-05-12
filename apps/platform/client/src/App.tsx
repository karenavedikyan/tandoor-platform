import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { PageLoadingFallback } from "@/components/navigation/page-loading";
import NotFound from "@/pages/not-found";
import PreviewUnavailable from "@/pages/preview-unavailable";
import InternalPrototypePlaceholder from "@/pages/internal-prototype-placeholder";
import { INTERNAL_PROTOTYPE_ROUTES } from "@/lib/preview-config";

const LazySalesManagerWorkspace = lazy(() => import("@/pages/sales-manager-workspace"));
const LazyDealerBase = lazy(() => import("@/pages/dealer-base"));
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
const LazyAnalyticsWorkspace = lazy(() => import("@/pages/analytics-workspace"));
const LazyMarketingBriefs = lazy(() => import("@/pages/marketing-briefs"));
const LazyMarketingBriefPublished = lazy(() =>
  import("@/pages/marketing-briefs").then((m) => ({ default: m.MarketingBriefPublishedPage })),
);
const LazyReleaseOne = lazy(() => import("@/pages/release-one"));

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
const AnalyticsWorkspaceRoute = suspensePage(LazyAnalyticsWorkspace);
const MarketingBriefsRoute = suspensePage(LazyMarketingBriefs);
const MarketingBriefPublishedRoute = suspensePage(LazyMarketingBriefPublished);
const ReleaseOneRoute = suspensePage(LazyReleaseOne);

function AppRouter() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={SalesManagerWorkspaceRoute} />
        <Route path="/main" component={SalesManagerWorkspaceRoute} />
        <Route path="/sales-manager" component={SalesManagerWorkspaceRoute} />
        <Route path="/dealer-base" component={DealerBaseRoute} />
        <Route path="/catalog/:productId" component={ProductDetailPageRoute} />
        <Route path="/catalog" component={CatalogPageRoute} />
        <Route path="/tasks" component={TasksPageRoute} />
        <Route path="/training/programs/:programId" component={TrainingProgramPageRoute} />
        <Route path="/training/:articleId" component={TrainingArticlePageRoute} />
        <Route path="/training" component={TrainingPageRoute} />
        <Route path="/territory-card" component={TerritoryCardPageRoute} />
        <Route path="/sales-control/director" component={SalesControlDirectorRoute} />
        <Route path="/sales-control/team-lead" component={SalesControlTeamLeadRoute} />
        <Route path="/sales-control/manager" component={SalesControlManagerRoute} />
        <Route path="/sales-control/plans" component={SalesControlPlansRoute} />
        <Route path="/sales-control/performance" component={SalesControlPerformanceRoute} />
        <Route path="/sales-control" component={SalesControlHubRoute} />
        <Route path="/analytics-workspace" component={AnalyticsWorkspaceRoute} />
        <Route path="/marketing-briefs/view/:id" component={MarketingBriefPublishedRoute} />
        <Route path="/marketing-briefs" component={MarketingBriefsRoute} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
