import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

type OneCListKpiProps = {
  items: { label: string; value: ReactNode }[];
  className?: string;
  testId?: string;
};

export function OneCListKpi({ items, className, testId }: OneCListKpiProps): ReactElement {
  return (
    <div
      className={cn("flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground", className)}
      data-testid={testId}
    >
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? <span className="mr-3 text-border">·</span> : null}
          <span>{item.label}: </span>
          <span className="font-medium tabular-nums text-foreground">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
