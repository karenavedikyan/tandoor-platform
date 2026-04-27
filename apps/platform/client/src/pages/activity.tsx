import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BellRing, FileText, PackageCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ActivityEvent } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

function eventIcon(type: string) {
  switch (type) {
    case "order_created":
    case "order_status_changed":
      return PackageCheck;
    case "claim_created":
      return ShieldAlert;
    case "document_added":
      return FileText;
    default:
      return BellRing;
  }
}

export default function ActivityPage() {
  const {
    data: activity,
    isLoading,
    isError,
    error,
  } = useQuery<ActivityEvent[]>({
    queryKey: ["/api/activity"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton
            key={idx}
            className="h-24 w-full rounded-xl bg-white"
            data-testid={`activity-loading-${idx}`}
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" data-testid="activity-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unable to load activity log</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : "Unknown error"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4" data-testid="activity-page">
      {activity?.map((event) => {
        const Icon = eventIcon(event.eventType);
        return (
          <Card key={event.id} className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full border border-border bg-muted p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base capitalize">{event.eventType.replaceAll("_", " ")}</CardTitle>
                    <CardDescription className="mt-1 text-sm">{event.message}</CardDescription>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0 text-sm text-muted-foreground sm:grid-cols-4">
              <div data-testid={`activity-entity-${event.id}`}>
                Entity: <span className="font-medium text-foreground">{event.entityType}</span> #{event.entityId}
              </div>
              <div data-testid={`activity-org-${event.id}`}>
                Org ID: <span className="font-medium text-foreground">{event.organizationId}</span>
              </div>
              <div data-testid={`activity-user-${event.id}`}>
                Actor user ID: <span className="font-medium text-foreground">{event.userId}</span>
              </div>
              <div data-testid={`activity-order-${event.id}`}>
                Related order: <span className="font-medium text-foreground">{event.orderId ?? "—"}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {!activity?.length && (
        <Card data-testid="activity-empty">
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>Operational lifecycle events will appear here as modules start writing logs.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
