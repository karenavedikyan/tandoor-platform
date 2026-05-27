/**
 * <PageHeader/> — единая шапка страницы. Используется на главной, /dealer-base,
 * /trade-points, /client-base-activity, /trash, /profile (Промт 47 Part B).
 *
 * Никакой Card-обёртки: компонент сидит на верху контента страницы и не вводит
 * собственный фон. Margin-bottom задаётся компонентом (16px), чтобы вызывающим
 * не приходилось каждый раз заводить отступ.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const DESCRIPTION_SOFT_LIMIT = 90;

export type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
  /** data-testid для корневого элемента. По умолчанию: page-header. */
  testId?: string;
};

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
  testId = "page-header",
}: PageHeaderProps): ReactElement {
  useEffect(() => {
    if (
      description &&
      description.length > DESCRIPTION_SOFT_LIMIT &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      console.warn(
        `[PageHeader] description длиннее ${DESCRIPTION_SOFT_LIMIT} символов (${description.length}). ` +
          "Сократите для единообразия макета.",
      );
    }
  }, [description]);

  return (
    <div className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", className)} data-testid={testId}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden /> : null}
          <h1 className="line-clamp-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
