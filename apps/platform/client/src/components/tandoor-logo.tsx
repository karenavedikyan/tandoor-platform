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
  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex h-8 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-border bg-white p-0.5",
          className,
        )}
        aria-hidden
      >
        <img
          src={variant === "onDark" ? logoLight : logoDark}
          alt="Tandoor"
          className="h-7 w-auto max-w-full object-contain object-left"
          width={200}
          height={40}
          loading="eager"
          decoding="async"
          data-testid={testId}
        />
      </div>
    );
  }

  return (
    <img
      src={variant === "onDark" ? logoLight : logoDark}
      alt="Tandoor"
      className={cn("h-9 w-auto max-w-[min(100%,220px)] object-left object-contain", className)}
      width={200}
      height={40}
      loading="eager"
      decoding="async"
      data-testid={testId}
    />
  );
}
