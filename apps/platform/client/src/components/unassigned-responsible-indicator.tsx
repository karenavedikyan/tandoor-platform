import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type UnassignedResponsibleIndicatorProps = {
  count: number;
  active: boolean;
  onToggle: () => void;
  testId?: string;
};

export function UnassignedResponsibleIndicator({
  count,
  active,
  onToggle,
  testId = "badge-unassigned-responsible",
}: UnassignedResponsibleIndicatorProps): ReactElement | null {
  if (count === 0 && !active) return null;

  return (
    <button
      type="button"
      className="inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={testId}
      aria-pressed={active}
      onClick={onToggle}
    >
      <Badge
        variant={count > 0 ? "secondary" : "outline"}
        className={cn(
          "cursor-pointer px-2.5 py-0.5 text-xs font-semibold",
          count === 0 && "text-muted-foreground",
          active && count > 0 && "ring-2 ring-primary ring-offset-1",
        )}
      >
        Без ответственного: {count}
      </Badge>
    </button>
  );
}
