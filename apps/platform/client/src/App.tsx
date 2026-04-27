import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import DashboardPage from "@/pages/dashboard";
import DealersPage from "@/pages/dealers";
import CatalogPage from "@/pages/catalog";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import ClaimsPage from "@/pages/claims";
import ActivityPage from "@/pages/activity";
import ArchitecturePage from "@/pages/architecture";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/dealers" component={DealersPage} />
        <Route path="/catalog" component={CatalogPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/orders/:id" component={OrderDetailPage} />
        <Route path="/claims" component={ClaimsPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/architecture" component={ArchitecturePage} />
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
