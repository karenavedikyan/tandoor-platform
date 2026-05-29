import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getClientCategoryBadgeClass, getClientCategoryLabel, isNewClientCategory } from "@/lib/client-category";
import {
  newClientCategoryTooltip,
  resolveEffectiveClientCategory,
} from "@/lib/effective-client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ActualizationState } from "@/lib/client-base-actualization-state";

type Props = {
  dealer: Pick<DealerRow, "id" | "clientCategory">;
  state: ActualizationState | null;
  className?: string;
  "data-testid"?: string;
};

export function ClientCategoryBadge({ dealer, state, className, "data-testid": testId }: Props) {
  const category = resolveEffectiveClientCategory(dealer, state);
  const label = getClientCategoryLabel(category);
  const tip = isNewClientCategory(category) ? newClientCategoryTooltip(dealer, state) : null;

  const badge = (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", getClientCategoryBadgeClass(category), className)}
      data-testid={testId}
    >
      {label}
    </Badge>
  );

  if (!tip) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
