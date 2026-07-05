import { Link } from "wouter";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TrashHeaderButtonProps = {
  dealersCount?: number | null;
  tradePointsCount?: number | null;
  className?: string;
  variant?: "desktop" | "mobile";
};

export function TrashHeaderButton({
  dealersCount,
  tradePointsCount,
  className,
  variant = "desktop",
}: TrashHeaderButtonProps) {
  const loading = dealersCount === null || tradePointsCount === null;
  const d = dealersCount ?? 0;
  const tp = tradePointsCount ?? 0;
  const total = d + tp;
  const showBadge = !loading && total > 0;
  const label = `${d}/${tp}`;

  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className={cn("relative h-9 w-9 shrink-0 border-border/80 bg-card", className)}
      data-testid="button-trash-header"
      aria-label={`Корзина${showBadge ? ` (${label})` : ""}`}
    >
      <Link href="/trash">
        <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        {showBadge ? (
          <span
            className={cn(
              "absolute -top-1 -right-1 min-w-[18px] rounded-full bg-primary px-1 text-[10px] font-medium leading-[16px] text-primary-foreground",
              variant === "mobile" ? "text-[9px]" : "",
            )}
            data-testid="badge-trash-header"
          >
            {label}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
