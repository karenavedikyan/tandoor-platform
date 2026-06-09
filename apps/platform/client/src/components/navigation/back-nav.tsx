import type { ReactElement } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmartBack } from "@/lib/navigation/use-smart-back";
import type { BreadcrumbItem } from "@/lib/navigation/route-hierarchy";
import { cn } from "@/lib/utils";

export type BackNavProps = {
  breadcrumbs?: BreadcrumbItem[];
  fallbackHref?: string;
  backLabel?: string;
  className?: string;
  testId?: string;
};

function collapseBreadcrumbs(items: BreadcrumbItem[]): BreadcrumbItem[] {
  if (items.length <= 3) return items;
  return [items[0]!, { label: "…" }, items[items.length - 1]!];
}

export function BackNav({
  breadcrumbs,
  fallbackHref,
  backLabel = "Назад",
  className,
  testId = "button-back-nav",
}: BackNavProps): ReactElement {
  const { goBack } = useSmartBack();
  const visibleCrumbs = breadcrumbs ? collapseBreadcrumbs(breadcrumbs) : undefined;

  return (
    <nav
      className={cn("flex min-w-0 flex-col gap-2", className)}
      aria-label="Навигация назад"
      data-testid="back-nav"
    >
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit gap-1.5 self-start px-3 font-semibold"
        onClick={() => goBack(fallbackHref)}
        data-testid={testId}
        aria-label={backLabel}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {backLabel}
      </Button>

      {visibleCrumbs && visibleCrumbs.length > 0 ? (
        <ol
          className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm"
          data-testid="back-nav-breadcrumbs"
        >
          {visibleCrumbs.map((item, idx) => {
            const isLast = idx === visibleCrumbs.length - 1;
            const isEllipsis = item.label === "…";
            return (
              <li key={`${item.label}-${idx}`} className="flex min-w-0 items-center gap-1">
                {idx > 0 ? <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden /> : null}
                {isEllipsis ? (
                  <span className="px-0.5" aria-hidden>
                    …
                  </span>
                ) : item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="max-w-[10rem] truncate font-medium text-foreground underline-offset-4 hover:underline sm:max-w-[14rem]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "max-w-[12rem] truncate",
                      isLast ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </nav>
  );
}
