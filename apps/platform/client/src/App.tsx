import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import NotFound from "@/pages/not-found";
import DealerBase from "@/pages/dealer-base";
import DealerCardFoundation, { DealerCardPage } from "@/pages/dealer-card-foundation";
import { TradePointDetailPage } from "@/pages/trade-point-detail";
import CatalogPage from "@/pages/catalog";
import { ProductDetailPage } from "@/pages/product-detail";
import TasksPage from "@/pages/tasks";
import PreviewUnavailable from "@/pages/preview-unavailable";
import InternalPrototypePlaceholder from "@/pages/internal-prototype-placeholder";
import { INTERNAL_PROTOTYPE_ROUTES } from "@/lib/preview-config";

function AppRouter() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DealerBase} />
        <Route path="/dealer-base" component={DealerBase} />
        <Route path="/catalog/:productId" component={ProductDetailPage} />
        <Route path="/catalog" component={CatalogPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/dealers/:dealerId/trade-points/:pointId" component={TradePointDetailPage} />
        <Route path="/dealers/:id" component={DealerCardPage} />
        <Route path="/dealer-card-foundation" component={DealerCardFoundation} />
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
