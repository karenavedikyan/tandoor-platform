import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Building2, ClipboardList, MapPin, UserCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  dealerStatusLabel,
  dealerTypeLabel,
  interactionTypeLabel,
  potentialLevelLabel,
  roleContextLabel,
  storeFormatLabel,
  taskPriorityLabel,
  taskSourceLabel,
  taskStatusLabel,
  taskTypeLabel,
  tradePointStatusLabel,
} from "@/lib/labels";
import type { DealerDetail, DealerInteraction, DealerTask, TradePoint, User, UserPublic } from "@/lib/api-types";
import { StatusBadge } from "@/components/status-badge";

function personName(user: UserPublic | User | undefined): string {
  if (!user) return "—";
  return `${user.firstName} ${user.lastName}`.trim();
}

export default function DealerDetailPage() {
  const [, params] = useRoute("/dealers/:id");
  const id = params?.id ? Number.parseInt(params.id, 10) : Number.NaN;

  const detailQuery = useQuery<DealerDetail>({
    queryKey: [`/api/dealers`, String(id)],
    enabled: !Number.isNaN(id) && id > 0,
  });
  const tradePointsQuery = useQuery<TradePoint[]>({
    queryKey: [`/api/dealers`, String(id), "trade-points"],
    enabled: !Number.isNaN(id) && id > 0,
  });
  const tasksQuery = useQuery<DealerTask[]>({
    queryKey: [`/api/dealers`, String(id), "tasks"],
    enabled: !Number.isNaN(id) && id > 0,
  });
  const interactionsQuery = useQuery<DealerInteraction[]>({
    queryKey: [`/api/dealers`, String(id), "interactions"],
    enabled: !Number.isNaN(id) && id > 0,
  });
  const usersQuery = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !Number.isNaN(id) && id > 0,
  });

  const userById = new Map((usersQuery.data ?? []).map((u) => [u.id, u] as const));

  if (Number.isNaN(id) || id < 1) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Некорректный идентификатор</AlertTitle>
        <AlertDescription>Выберите дилера в клиентской базе.</AlertDescription>
      </Alert>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="page-dealer-detail">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Alert variant="destructive" data-testid="page-dealer-detail">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось открыть карточку</AlertTitle>
        <AlertDescription>
          {detailQuery.error instanceof Error ? detailQuery.error.message : "Проверьте ссылку и попробуйте снова."}
        </AlertDescription>
      </Alert>
    );
  }

  const { dealer, salesManager, regionalManager } = detailQuery.data;
  const tradePoints = tradePointsQuery.data ?? [];
  const tasks = (tasksQuery.data ?? []).filter(
    (t) => t.status === "new" || t.status === "in_progress" || t.status === "overdue",
  );
  const interactions = interactionsQuery.data ?? [];

  return (
    <div className="space-y-6" data-testid="page-dealer-detail">
      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
        <Button
          asChild
          variant="ghost"
          className="-ml-2 h-9 justify-start gap-2 px-2 text-sm text-muted-foreground"
          data-testid="button-back-dealers"
        >
          <Link href="/dealers">
            <ArrowLeft className="h-4 w-4" />
            Назад к клиентской базе
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{dealer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge type="dealer" status={dealer.status} className="border-primary/30" />
              <span
                className="inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground"
                data-testid={`dealer-type-badge-${dealer.id}`}
              >
                {dealerTypeLabel(dealer.dealerType)}
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {dealer.city ?? "—"}, {dealer.region ?? "—"} · Потенциал:{" "}
          <span className="font-medium text-foreground">
            {dealer.potentialLevel ? potentialLevelLabel(dealer.potentialLevel) : "—"}
          </span>
        </p>
        {dealer.comment ? <p className="text-sm leading-relaxed text-foreground">{dealer.comment}</p> : null}
      </div>

      <section data-testid="section-dealer-responsibles" className="space-y-3">
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">Ответственные</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Один дилер ведется совместно офисным менеджером и региональным менеджером: менеджер отвечает за коммерческую
          работу и заказы, региональный менеджер — за полевые визиты, дистрибуцию и витрины.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle2 className="h-4 w-4 text-primary" />
                Менеджер продаж
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-foreground">
                {salesManager ? personName(salesManager) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Региональный менеджер
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-foreground">
                {regionalManager ? personName(regionalManager) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section data-testid="section-trade-points" className="space-y-3">
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">Торговые точки</h2>
        {tradePointsQuery.isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : (
          <div className="grid gap-3">
            {tradePoints.map((tp) => (
              <Card
                key={tp.id}
                data-testid={`card-trade-point-${tp.id}`}
                className="rounded-2xl border-border/80 shadow-sm"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tp.name}</CardTitle>
                  <CardDescription>
                    {tp.city}, {tp.address}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    <span>Формат: {storeFormatLabel(tp.storeFormat)}</span>
                    <span>Площадь: {tp.areaSqm} м²</span>
                    <span>Статус: {tradePointStatusLabel(tp.status)}</span>
                  </div>
                  <p>
                    <span className="text-muted-foreground">Ассортимент: </span>
                    {tp.assortmentProfile}
                  </p>
                  <div>
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-xl border-primary/30 bg-white"
                      data-testid={`button-visit-trade-point-${tp.id}`}
                    >
                      <Link href="/regional-manager/route">Запланировать визит</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section data-testid="section-dealer-tasks" className="space-y-3">
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">Активные задачи</h2>
        {tasksQuery.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных задач по дилеру.</p>
        ) : (
          <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Задача</TableHead>
                  <TableHead>Кому</TableHead>
                  <TableHead>Приоритет</TableHead>
                  <TableHead>Срок</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Источник</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow
                    key={t.id}
                    data-testid={`card-dealer-task-${t.id}`}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{taskTypeLabel(t.type)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {personName(userById.get(t.assignedToUserId))}
                    </TableCell>
                    <TableCell>{taskPriorityLabel(t.priority)}</TableCell>
                    <TableCell>{formatDate(t.dueDate)}</TableCell>
                    <TableCell>{taskStatusLabel(t.status)}</TableCell>
                    <TableCell>{taskSourceLabel(t.source)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <section data-testid="section-dealer-interactions" className="space-y-3">
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">История взаимодействий</h2>
        {interactionsQuery.isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : (
          <div className="space-y-3">
            {interactions.map((row) => (
              <Card
                key={row.id}
                data-testid={`card-dealer-interaction-${row.id}`}
                className="rounded-2xl border-border/80 bg-white shadow-sm"
              >
                <CardContent className="pt-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {interactionTypeLabel(row.type)}
                    </span>
                  </div>
                  <p className="mt-2 text-foreground">
                    {personName(userById.get(row.userId))} · {roleContextLabel(row.roleContext)}
                  </p>
                  <p className="mt-1 text-muted-foreground">{row.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section data-testid="section-distribution-placeholder" className="space-y-3">
        <Card className="rounded-2xl border-dashed border-primary/40 bg-[#f7f7f5]">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="h-5 w-5" />
              <ClipboardList className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Дистрибуция и витрины</CardTitle>
            <CardDescription>
              Следующий этап: отчет дистрибуции по каждой торговой точке. На его основании будут формироваться цели по
              выставлению витрин для отдела продаж.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-xl" data-testid="button-open-regional-route">
              <Link href="/regional-manager/route">Перейти к маршруту РМ</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
