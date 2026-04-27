import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import DashboardPage from "@/pages/dashboard";
import DealersPage from "@/pages/dealers";
import DealerDetailPage from "@/pages/dealer-detail";
import CatalogPage from "@/pages/catalog";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import NewOrderPage from "@/pages/new-order";
import ClaimsPage from "@/pages/claims";
import ActivityPage from "@/pages/activity";
import ArchitecturePage from "@/pages/architecture";
import SalesDepartmentPage from "@/pages/sales-department";
import SalesLeadershipDashboardPage from "@/pages/sales-leadership-dashboard";
import SalesManagerWorkspacePage from "@/pages/sales-manager-workspace";
import SalesClientImportPage from "@/pages/sales-client-import";
import RegionalManagerRoutePage from "@/pages/regional-manager-route";
import RegionalManagerVisitPage from "@/pages/regional-manager-visit";
import RegionalManagerWorkspacePage from "@/pages/regional-manager-workspace";
import ShowcaseGoalsPage from "@/pages/showcase-goals";
import ShowcaseGoalDetailPage from "@/pages/showcase-goal-detail";
import SalesTasksPage from "@/pages/sales-tasks";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/dealers/:id" component={DealerDetailPage} />
        <Route path="/dealers" component={DealersPage} />
        <Route path="/catalog" component={CatalogPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/orders/new" component={NewOrderPage} />
        <Route path="/orders/:id" component={OrderDetailPage} />
        <Route path="/claims" component={ClaimsPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/architecture" component={ArchitecturePage} />
        <Route path="/sales-department" component={SalesDepartmentPage} />
        <Route path="/sales/client-import" component={SalesClientImportPage} />
        <Route path="/sales/manager-workspace" component={SalesManagerWorkspacePage} />
        <Route path="/sales/leadership" component={SalesLeadershipDashboardPage} />
        <Route path="/regional-manager/workspace" component={RegionalManagerWorkspacePage} />
        <Route path="/sales/showcase-goals" component={ShowcaseGoalsPage} />
        <Route path="/sales/showcase-goals/:id" component={ShowcaseGoalDetailPage} />
        <Route path="/sales/tasks" component={SalesTasksPage} />
        <Route path="/regional-manager/route" component={RegionalManagerRoutePage} />
        <Route path="/regional-manager/visits/:id" component={RegionalManagerVisitPage} />
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
