import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, statusLabel } from "@/lib/format";
import type {
  CreateOrderPayload,
  DealerListItem,
  OrderDetail,
  Organization,
  Product,
  User,
} from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";

type DraftItem = {
  productId: number;
  quantity: number;
};

export default function NewOrderPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [dealerId, setDealerId] = useState<number | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const dealersQuery = useQuery<DealerListItem[]>({ queryKey: ["/api/dealers"] });
  const organizationsQuery = useQuery<Organization[]>({ queryKey: ["/api/organizations"] });
  const productsQuery = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const usersQuery = useQuery<User[]>({ queryKey: ["/api/users"] });

  const organizationById = useMemo(
    () => new Map((organizationsQuery.data ?? []).map((organization) => [organization.id, organization])),
    [organizationsQuery.data],
  );
  const productById = useMemo(
    () => new Map((productsQuery.data ?? []).map((product) => [product.id, product])),
    [productsQuery.data],
  );

  const dealers = dealersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const salesManager =
    (usersQuery.data ?? []).find((user) => user.email === "a.kravchenko@tandoor.ru") ??
    (usersQuery.data ?? [])[0];

  const summaryRows = draftItems
    .map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        return null;
      }

      const lineTotalCents = product.priceCents * item.quantity;
      return {
        ...item,
        product,
        lineTotalCents,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const orderTotalCents = summaryRows.reduce((total, row) => total + row.lineTotalCents, 0);
  const hasInvalidQuantity = draftItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1);

  const createOrderMutation = useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const response = await apiRequest("POST", "/api/orders", payload);
      return (await response.json()) as OrderDetail;
    },
    onSuccess: async (createdOrder) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.setQueryData(["/api/orders", String(createdOrder.id)], createdOrder);

      toast({
        title: "Заказ создан",
        description: `${createdOrder.orderNumber} успешно отправлен.`,
      });
      navigate(`/orders/${createdOrder.id}`);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Не удалось создать заказ. Проверьте данные и повторите попытку.";
      setFormError(message);
    },
  });

  const isSubmitDisabled =
    !dealerId || draftItems.length === 0 || hasInvalidQuantity || !salesManager || createOrderMutation.isPending;

  function handleAddProduct(productId: number) {
    setFormError(null);
    setDraftItems((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        return current.map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  }

  function handleQuantityChange(productId: number, value: string) {
    const parsed = Number.parseInt(value, 10);
    setDraftItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: Number.isNaN(parsed) ? 0 : parsed,
            }
          : item,
      ),
    );
  }

  function handleRemoveProduct(productId: number) {
    setDraftItems((current) => current.filter((item) => item.productId !== productId));
  }

  function onSubmit() {
    setFormError(null);

    if (!dealerId) {
      setFormError("Выберите дилера перед отправкой заказа.");
      return;
    }
    if (!salesManager) {
      setFormError("В системе нет пользователя для создания заказа.");
      return;
    }
    if (draftItems.length === 0) {
      setFormError("Добавьте хотя бы один товар для создания заказа.");
      return;
    }
    if (hasInvalidQuantity) {
      setFormError("Количество по каждому товару должно быть не меньше 1.");
      return;
    }

    createOrderMutation.mutate({
      dealerId,
      createdByUserId: salesManager.id,
      items: draftItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      comment: comment.trim() || undefined,
    });
  }

  const isLoading = dealersQuery.isLoading || organizationsQuery.isLoading || productsQuery.isLoading || usersQuery.isLoading;
  const hasLoadingError = dealersQuery.isError || organizationsQuery.isError || productsQuery.isError || usersQuery.isError;

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="new-order-loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (hasLoadingError) {
    return (
      <Alert variant="destructive" data-testid="new-order-load-error">
        <AlertTitle>Не удалось загрузить данные для создания заказа</AlertTitle>
        <AlertDescription>
          Проверьте, что дилеры, товары и пользователи доступны перед созданием заказа.
        </AlertDescription>
      </Alert>
    );
  }

  if (!dealers.length || !products.length) {
    return (
      <Card data-testid="new-order-empty-state">
        <CardHeader>
          <CardTitle>Создание заказа недоступно</CardTitle>
          <CardDescription>
            {dealers.length === 0
              ? "Дилеры не найдены. Сначала добавьте дилерские данные."
              : "Товары не найдены. Сначала добавьте каталог."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="new-order-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-[0.02em] text-foreground">Создание заказа дилера</h1>
          <p className="text-sm text-muted-foreground">
            Сформируйте новый заказ Tandoor на основе активного каталога.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/orders")}
          data-testid="button-back-orders"
        >
          К списку заказов
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Дилер</CardTitle>
          <CardDescription>Выберите дилерскую компанию для этого заказа.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="dealer-select">Дилер</Label>
          <Select
            value={dealerId ? String(dealerId) : undefined}
            onValueChange={(value) => {
              setDealerId(Number.parseInt(value, 10));
              setFormError(null);
            }}
          >
            <SelectTrigger id="dealer-select" data-testid="select-dealer" className="mt-2 max-w-xl">
              <SelectValue placeholder="Выберите дилера" />
            </SelectTrigger>
            <SelectContent>
              {dealers.map((dealer) => {
                const dealerOrg = organizationById.get(dealer.organizationId);
                return (
                  <SelectItem key={dealer.id} value={String(dealer.id)}>
                    {dealer.name ?? dealerOrg?.name ?? `Дилер #${dealer.id}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Товары</CardTitle>
          <CardDescription>Выберите товары и укажите количество для заказа.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {products.map((product) => {
            const selectedItem = draftItems.find((item) => item.productId === product.id);
            return (
              <div
                key={product.id}
                className="rounded-2xl border border-border bg-muted/30 p-4"
                data-testid={`product-card-${product.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.sku} · {product.finishColor} · {statusLabel(product.availabilityStatus)}
                  </p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatCurrency(product.priceCents, product.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedItem ? (
                      <>
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={selectedItem.quantity}
                          onChange={(event) =>
                            handleQuantityChange(product.id, event.target.value)
                          }
                          data-testid={`input-product-quantity-${product.id}`}
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleRemoveProduct(product.id)}
                          data-testid={`button-remove-product-${product.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Удалить
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleAddProduct(product.id)}
                        data-testid={`button-add-product-${product.id}`}
                        className="uppercase tracking-wide"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить товар
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Сводка заказа</CardTitle>
          <CardDescription>Выбранные товары и итоговая сумма.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summaryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Товары пока не выбраны.</p>
          ) : (
            summaryRows.map((row) => (
              <div
                key={row.productId}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3"
              >
                <div>
                  <p className="font-medium">{row.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Кол-во {row.quantity} × {formatCurrency(row.product.priceCents, row.product.currency)}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatCurrency(row.lineTotalCents, row.product.currency)}
                </p>
              </div>
            ))
          )}
          <div className="flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <span className="font-medium">Сумма заказа</span>
            <span className="text-lg font-semibold" data-testid="text-order-total">
              {formatCurrency(orderTotalCents, "RUB")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Комментарий и отправка</CardTitle>
          <CardDescription>Добавьте комментарий и отправьте заказ.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="order-comment">Комментарий (необязательно)</Label>
            <Textarea
              id="order-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Окно доставки, условия монтажа или примечание дилера"
              className="mt-2"
            />
          </div>

          {formError && (
            <Alert variant="destructive" data-testid="new-order-submit-error">
              <AlertTitle>Не удалось отправить заказ</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-[0.08em]"
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            data-testid="button-submit-order"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {createOrderMutation.isPending ? "Создаем заказ..." : "Отправить заказ"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
