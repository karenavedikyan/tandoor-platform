import type { MarketingBriefCategory } from "@/lib/marketing-briefs-api";
import { cn } from "@/lib/utils";

const categoryConfig: Record<
  MarketingBriefCategory,
  { label: string; bg: string; text: string }
> = {
  brief: { label: "Бриф", bg: "#9ACA3C", text: "#0F1419" },
  promo: { label: "Акция", bg: "#FF9F1C", text: "#0F1419" },
  info: { label: "Инфо", bg: "#3B82F6", text: "#FFFFFF" },
};

export function CategoryBadge({
  category,
  className,
}: {
  category: MarketingBriefCategory;
  className?: string;
}) {
  const cfg = categoryConfig[category] ?? categoryConfig.brief;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      data-testid={`badge-brief-category-${category}`}
    >
      {cfg.label}
    </span>
  );
}
