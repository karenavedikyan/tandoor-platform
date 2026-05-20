import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const bulkDeleteToggleClass = cn(
  "peer inline-flex shrink-0 items-center justify-center rounded-full border-2 border-destructive/75 bg-background",
  "h-6 w-6 min-h-6 min-w-6 touch-manipulation",
  "text-destructive-foreground ring-offset-background transition-colors",
  "hover:border-destructive hover:bg-destructive/10",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "data-[state=checked]:border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-primary-foreground",
  "data-[state=indeterminate]:border-destructive data-[state=indeterminate]:bg-destructive data-[state=indeterminate]:text-primary-foreground",
);

export type DealerBulkDeleteCheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "className" | "children"
> & {
  className?: string;
};

/**
 * Круглый красный переключатель выбора клиента на удаление из рабочей базы (bulkDeleteMode).
 * Не заменяет общий {@link @/components/ui/checkbox}.
 */
export const DealerBulkDeleteCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  DealerBulkDeleteCheckboxProps
>(({ className, checked, ...props }, ref) => (
  <CheckboxPrimitive.Root ref={ref} checked={checked} className={cn(bulkDeleteToggleClass, className)} {...props}>
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current" asChild>
      <span>
        {checked === "indeterminate" ? (
          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        )}
      </span>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
DealerBulkDeleteCheckbox.displayName = "DealerBulkDeleteCheckbox";
