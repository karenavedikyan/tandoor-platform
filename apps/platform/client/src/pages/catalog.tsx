import { useQuery } from "@tanstack/react-query";
import { DoorOpen, PackageSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import type { Product } from "@/lib/api-types";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";

function CatalogSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CatalogPage() {
  const productsQuery = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  if (productsQuery.isLoading) {
    return <CatalogSkeleton />;
  }

  if (productsQuery.isError) {
    const errorMessage =
      productsQuery.error instanceof Error
        ? productsQuery.error.message
        : "Непредвиденная ошибка при загрузке каталога";

    return (
      <Alert variant="destructive" data-testid="catalog-error">
        <PackageSearch className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить каталог</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  const products = productsQuery.data ?? [];

  if (products.length === 0) {
    return (
      <Card data-testid="catalog-empty">
        <CardHeader>
          <CardTitle>Каталог пуст</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Товары появятся здесь после добавления в платформу.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-sm">
        <h1 className="text-2xl font-semibold uppercase text-foreground">Каталог</h1>
        <StatusBadge type="availability" status={`${products.length} товар(ов)`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} data-testid={`catalog-card-${product.id}`} className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {product.category.replace(/_/g, " ")}
                  </p>
                </div>
                <DoorOpen className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SKU</span>
                <span className="font-medium">{product.sku}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Отделка</span>
                <span>{product.finishColor}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Цена</span>
                <span className="font-semibold">{formatCurrency(product.priceCents, product.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Наличие</span>
                <StatusBadge kind="availability" status={product.availabilityStatus} />
              </div>
              <Button
                asChild
                className="mt-2 w-full rounded-xl bg-primary font-bold uppercase text-primary-foreground"
                data-testid={`button-add-product-${product.id}`}
              >
                <Link href="/orders/new">Создать заказ с этим артикулом</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
