import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BellRing, FileText, PackageCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ActivityEvent } from "@/lib/api-types";
import { formatDateTime, statusLabel } from "@/lib/format";

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
        <AlertTitle>Не удалось загрузить журнал событий</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : "Неизвестная ошибка"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4" data-testid="activity-page">
      <div>
        <h1 className="text-2xl font-semibold">События</h1>
        <p className="text-sm text-muted-foreground">Операционный журнал жизненного цикла заказов и рекламаций.</p>
      </div>
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
                    <CardTitle className="text-base">{statusLabel(event.eventType)}</CardTitle>
                    <CardDescription className="mt-1 text-sm">{event.message}</CardDescription>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0 text-sm text-muted-foreground sm:grid-cols-4">
              <div data-testid={`activity-entity-${event.id}`}>
                Сущность: <span className="font-medium text-foreground">{statusLabel(event.entityType)}</span> #{event.entityId}
              </div>
              <div data-testid={`activity-org-${event.id}`}>
                ID организации: <span className="font-medium text-foreground">{event.organizationId}</span>
              </div>
              <div data-testid={`activity-user-${event.id}`}>
                ID пользователя: <span className="font-medium text-foreground">{event.userId}</span>
              </div>
              <div data-testid={`activity-order-${event.id}`}>
                Связанный заказ: <span className="font-medium text-foreground">{event.orderId ?? "—"}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {!activity?.length && (
        <Card data-testid="activity-empty">
          <CardHeader>
            <CardTitle>Событий пока нет</CardTitle>
            <CardDescription>Журнал начнет наполняться по мере работы модулей платформы.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
