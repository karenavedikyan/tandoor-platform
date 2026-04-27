import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ChevronLeft, Copy, Download, FileText, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import type { Dealer, OrderDetail, Product, Organization, User } from "@/lib/api-types";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-80" />
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrderDetailPage() {
  const [match, params] = useRoute("/orders/:id");
  const orderId = match ? Number.parseInt(params.id, 10) : Number.NaN;

  const orderQuery = useQuery<OrderDetail>({
    queryKey: ["/api/orders", `${orderId}`],
    enabled: Number.isFinite(orderId),
  });

  const dealersQuery = useQuery<Dealer[]>({
    queryKey: ["/api/dealers"],
  });

  const organizationsQuery = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const usersQuery = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const productsQuery = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  if (!Number.isFinite(orderId)) {
    return (
      <Alert variant="destructive" data-testid="order-detail-invalid">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Некорректный ID заказа</AlertTitle>
        <AlertDescription>Запрошенный идентификатор заказа неверный.</AlertDescription>
      </Alert>
    );
  }

  if (
    orderQuery.isLoading ||
    dealersQuery.isLoading ||
    organizationsQuery.isLoading ||
    usersQuery.isLoading ||
    productsQuery.isLoading
  ) {
    return <OrderDetailSkeleton />;
  }

  if (
    orderQuery.isError ||
    dealersQuery.isError ||
    organizationsQuery.isError ||
    usersQuery.isError ||
    productsQuery.isError
  ) {
    return (
      <Alert variant="destructive" data-testid="order-detail-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить данные заказа</AlertTitle>
        <AlertDescription>Повторите попытку через несколько секунд.</AlertDescription>
      </Alert>
    );
  }

  const order = orderQuery.data;
  if (!order) {
    return (
      <Alert data-testid="order-detail-empty">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Заказ не найден</AlertTitle>
        <AlertDescription>Такого заказа нет в текущем демо-наборе данных.</AlertDescription>
      </Alert>
    );
  }

  const dealer = dealersQuery.data?.find((entry) => entry.id === order.dealerId);
  const dealerOrganization = organizationsQuery.data?.find((entry) => entry.id === dealer?.organizationId);
  const createdBy = usersQuery.data?.find((entry) => entry.id === order.createdByUserId);
  const productsById = new Map((productsQuery.data ?? []).map((product) => [product.id, product]));
  const statusPipeline = ["draft", "submitted", "reserved", "assembling", "shipped", "delivered"];

  return (
    <div className="space-y-6" data-testid="order-detail-page">
      <div className="rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-3">
            <Link href="/orders" data-testid="back-to-orders-link">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Назад к заказам
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Создан {formatDate(order.createdAt)} пользователем{" "}
            {createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : "Неизвестный пользователь"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="create-claim-action" className="rounded-xl uppercase tracking-wide">
            <ShieldAlert className="mr-2 h-4 w-4" />
            Создать рекламацию
          </Button>
          <Button variant="outline" data-testid="download-documents-action" className="rounded-xl">
            <Download className="mr-2 h-4 w-4" />
            Скачать документы
          </Button>
          <Button variant="outline" data-testid="repeat-order-action" className="rounded-xl">
            <Copy className="mr-2 h-4 w-4" />
            Повторить заказ
          </Button>
        </div>
      </div>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Карточка заказа</CardTitle>
          <CardDescription>Информация о дилере, статус и ход исполнения.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Дилер</p>
              <p className="mt-1 font-medium">{dealerOrganization?.name ?? "Неизвестный дилер"}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Желаемая доставка</p>
              <p className="mt-1 font-medium">
                {order.requestedDeliveryDate ? formatDate(order.requestedDeliveryDate) : "Не указана"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Сумма заказа</p>
              <p className="mt-1 font-medium">{formatCurrency(order.totalCents, order.currency)}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Текущий статус</p>
              <div className="mt-2">
                <StatusBadge type="order" status={order.status} />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Лента статусов</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              {statusPipeline.map((status) => {
                const currentIndex = statusPipeline.indexOf(order.status);
                const thisIndex = statusPipeline.indexOf(status);
                const isDone = currentIndex >= thisIndex;
                return (
                  <div
                    key={status}
                    className={`rounded-lg border p-3 text-center text-xs capitalize ${
                      isDone ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-muted/20 text-muted-foreground"
                    }`}
                    data-testid={`status-step-${status}`}
                  >
                    {statusLabel(status)}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Позиции заказа</CardTitle>
          <CardDescription>Товарные позиции, включенные в заказ.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-white p-4 shadow-sm"
              data-testid={`order-item-${item.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {productsById.get(item.productId)?.name ?? `Товар #${item.productId}`}
                  </p>
                  <p className="text-sm text-muted-foreground">Количество: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Цена за единицу</p>
                  <p className="font-medium">{formatCurrency(item.unitPriceCents, order.currency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Сумма позиции</p>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(item.totalPriceCents, order.currency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Связанные документы</CardTitle>
          <CardDescription>Счета, договоры и отгрузочные документы.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.documents.length ? (
            order.documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3"
                data-testid={`order-document-${document.id}`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{document.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">{statusLabel(document.type)}</p>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {statusLabel(document.status)}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Документы пока не привязаны.</p>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">Документооборот будет реализован на следующем этапе MVP.</p>
        </CardContent>
      </Card>
    </div>
  );
}
