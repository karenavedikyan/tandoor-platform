import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { PageLoadingFallback } from "@/components/navigation/page-loading";
import { getProductById } from "@/lib/catalog-data";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResolveResponse =
  | { success: true; result: "matched"; productId: string }
  | { success: true; result: "ambiguous" | "not_found" }
  | { success: false };

export function CatalogLegacyRedirect() {
  const params = useParams<{ productId: string }>();
  const [, setLocation] = useLocation();
  const productId = params.productId?.trim() ?? "";
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!productId) {
      setNotFound(true);
      return;
    }

    if (UUID_RE.test(productId)) {
      setLocation(`/catalog/1c/${productId}`, { replace: true });
      return;
    }

    const seedName = getProductById(productId)?.name?.trim();
    if (!seedName) {
      setNotFound(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/catalog/resolve-by-name?name=${encodeURIComponent(seedName)}`, {
          credentials: "include",
        });
        const data = (await r.json()) as ResolveResponse;
        if (cancelled) return;
        if (r.ok && data.success && data.result === "matched" && data.productId) {
          setLocation(`/catalog/1c/${data.productId}`, { replace: true });
          return;
        }
        setNotFound(true);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, setLocation]);

  if (notFound) {
    return (
      <div
        className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center"
        data-testid="page-catalog-legacy-not-found"
      >
        <p className="text-sm text-muted-foreground">Модель не найдена в каталоге 1С</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/catalog">Перейти в каталог</Link>
        </Button>
      </div>
    );
  }

  return <PageLoadingFallback />;
}
