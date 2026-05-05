import { cn } from "@/lib/utils";
import logoDark from "@/assets/brand/tandoor-logo-dark.svg";
import logoLight from "@/assets/brand/tandoor-logo-light.svg";

type LogoVariant = "onLight" | "onDark";

type TandoorLogoProps = {
  className?: string;
  /** Mobile header: ~28px height. */
  compact?: boolean;
  variant?: LogoVariant;
  "data-testid"?: string;
};

export function TandoorLogo({
  className,
  compact = false,
  variant = "onLight",
  "data-testid": testId,
}: TandoorLogoProps) {
  return (
    <img
      src={variant === "onDark" ? logoLight : logoDark}
      alt="Tandoor"
      className={cn(
        "block h-9 w-auto max-w-full shrink-0 object-contain object-left",
        compact && "h-8",
        className,
      )}
      width={2215}
      height={632}
      loading="eager"
      decoding="async"
      data-testid={testId}
    />
  );
}
