import * as React from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type EntityCardProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Прячет стрелку-аффорданс справа. По умолчанию видна. */
  hideChevron?: boolean;
  /** data-testid — прокидывается на корневую ссылку. */
  testId?: string;
  /** aria-label для скринридеров, если внутри одна лишь картинка/иконка */
  ariaLabel?: string;
};

/**
 * Карточка-ссылка: вся область — переход по href.
 * Внутренние интерактивные элементы должны использовать <EntityCardEscape> — он останавливает всплытие
 * клика, чтобы не улететь на переход.
 */
export function EntityCard({
  href,
  children,
  className,
  contentClassName,
  hideChevron,
  testId,
  ariaLabel,
}: EntityCardProps): React.ReactElement {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      <Card
        className={cn(
          "cursor-pointer rounded-xl border border-border bg-card p-0 transition-colors",
          "hover:border-primary/60 active:border-primary",
          className,
        )}
      >
        <CardContent className={cn("flex items-start gap-2 p-3", contentClassName)}>
          <div className="min-w-0 flex-1">{children}</div>
          {hideChevron ? null : (
            <ChevronRight
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary"
              aria-hidden
            />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

type EscapeProps = {
  children: React.ReactNode;
  className?: string;
  /** Обычно onClick фильтра. Обёртка сама останавливает всплытие + preventDefault. */
  onActivate?: () => void;
  /** aria-label для доступности, если внутри нет текста. */
  ariaLabel?: string;
  testId?: string;
  as?: "button" | "div";
};

/**
 * Обёртка внутри EntityCard для интерактивного элемента, который НЕ должен инициировать переход по карточке.
 * Кладите сюда «кнопки-фильтры» (категория, менеджер) и другие вложенные действия.
 */
export function EntityCardEscape({
  children,
  className,
  onActivate,
  ariaLabel,
  testId,
  as = "button",
}: EscapeProps): React.ReactElement {
  const stop = React.useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onActivate?.();
    },
    [onActivate],
  );

  if (as === "div") {
    return (
      <div
        className={cn("inline-flex", className)}
        onClick={stop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") stop(e);
        }}
        role={onActivate ? "button" : undefined}
        tabIndex={onActivate ? 0 : undefined}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn("inline-flex", className)}
      onClick={stop}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
