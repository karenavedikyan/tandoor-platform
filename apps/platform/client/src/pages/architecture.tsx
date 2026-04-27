import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, CircleDashed, Layers, LockKeyhole, Package, Radar, Truck } from "lucide-react";

const layers = [
  {
    title: "Core platform",
    description:
      "Shared master data for organizations, users, roles, products, orders, documents, claims and lifecycle events.",
  },
  {
    title: "Operational modules",
    description:
      "Dealers, catalog, order operations, claims and activity monitoring are available as independent modules.",
  },
  {
    title: "Role-based interfaces",
    description:
      "MVP already models users, organizations and role assignments to support future RBAC and workspace segmentation.",
  },
];

const implemented = [
  "Data model (Drizzle SQLite schema)",
  "Demo API for organizations, users, dealers, products, orders, claims, activity",
  "Dealer data and operations overview",
  "Catalog data with SKU, category, finish and pricing",
  "Order data with statuses and order detail records",
  "Claims data with lifecycle statuses",
  "Activity events timeline for operational traceability",
];

const upcoming = [
  "Real authentication and RBAC policies",
  "Order creation and editing workflow",
  "Document generation and approval flow",
  "Claims processing workflow and SLA handling",
  "Warehouse and logistics integration",
  "BI dashboards and executive analytics",
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <Card data-testid="architecture-overview-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Layers className="h-5 w-5 text-primary" />
            Platform architecture status
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Internal view of the modular B2B2C architecture foundation for Tandoor Platform.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {layers.map((layer) => (
            <div key={layer.title} className="rounded-xl border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">{layer.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{layer.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="architecture-implemented-card">
          <CardHeader>
            <CardTitle className="text-lg">Implemented MVP blocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {implemented.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="architecture-upcoming-card">
          <CardHeader>
            <CardTitle className="text-lg">Upcoming blocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <CircleDashed className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="architecture-map-card">
        <CardHeader>
          <CardTitle className="text-lg">Module map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Core data</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Organizations, users, roles, products.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Operations</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Orders, claims, documents, statuses.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Activity</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Lifecycle events and platform log.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">RBAC (next)</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Workspace access control and policy layer.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Readiness</p>
              <Separator className="my-2" />
              <Badge className="bg-primary/90 text-primary-foreground">MVP foundation online</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
