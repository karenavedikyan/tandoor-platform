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
        : "Unexpected error while loading catalog";

    return (
      <Alert variant="destructive" data-testid="catalog-error">
        <PackageSearch className="h-4 w-4" />
        <AlertTitle>Unable to load catalog</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  const products = productsQuery.data ?? [];

  if (products.length === 0) {
    return (
      <Card data-testid="catalog-empty">
        <CardHeader>
          <CardTitle>Catalog is empty</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Door products will appear here once they are added to the platform.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Catalog</h1>
        <StatusBadge type="availability" status={`${products.length} SKUs`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} data-testid={`catalog-card-${product.id}`} className="shadow-sm">
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
                <span className="text-muted-foreground">Finish</span>
                <span>{product.finishColor}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold">{formatCurrency(product.priceCents, product.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Availability</span>
                <StatusBadge kind="availability" status={product.availabilityStatus} />
              </div>
              <Button
                asChild
                className="mt-2 w-full rounded-xl"
                data-testid={`button-add-product-${product.id}`}
              >
                <Link href="/orders/new">Create order with this SKU</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
