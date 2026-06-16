import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import { inferShowcasePortalTypeFromCatalogProduct } from "@/lib/trade-point-showcase-matrix-required";
import { SHOWCASE_MATRIX_MODEL_DEFINITIONS } from "@/lib/trade-point-showcase-matrix-models";

const TYPE_LABEL = { entrance: "ВХ", interior: "МК", hardware: "Фурнитура", other: "—" } as const;

export function ModelCardHeader({ product }: { product: CatalogProduct }): ReactElement {
  const portalType = inferShowcasePortalTypeFromCatalogProduct(product);
  const matrixDef = SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.id === product.id);
  const priority = matrixDef?.basePriority;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start" data-testid="model-card-header">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/30">
        {product.image ? <img src={product.image} alt="" className="max-h-full max-w-full object-contain" /> : null}
      </div>
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold leading-tight">{product.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{product.id}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{TYPE_LABEL[portalType === "hardware" || portalType === "entrance" || portalType === "interior" ? portalType : "other"]}</Badge>
          {priority ? (
            <Badge variant="secondary">
              Приоритет: {priority === "high" ? "высокий" : priority === "medium" ? "средний" : "низкий"}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
