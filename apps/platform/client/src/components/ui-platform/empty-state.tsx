/**
 * <EmptyState/> — единый «пустой» плейсхолдер. Используется на главной и в карточках
 * Без инженерных терминов; одна-две строки + одна primary кнопка (опционально).
 * Промт 47 Part B.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  cta?: ReactNode;
  className?: string;
  testId?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  hint,
  cta,
  className,
  testId = "empty-state",
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-[420px] flex-col items-center gap-2 px-3 py-6 text-center",
        className,
      )}
      data-testid={testId}
    >
      {Icon ? <Icon className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden /> : null}
      <p className="text-base font-medium text-foreground">{title}</p>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {cta ? <div className="mt-1">{cta}</div> : null}
    </div>
  );
}
