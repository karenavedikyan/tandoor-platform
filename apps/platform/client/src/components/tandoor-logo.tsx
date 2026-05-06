import { cn } from "@/lib/utils";
import logoOfficial from "@/assets/brand/tandoor-logo-official.svg";
import logoLight from "@/assets/brand/tandoor-logo-light.svg";

type LogoVariant = "onLight" | "onDark";

type TandoorLogoProps = {
  className?: string;
  /** Компактный размер для встроенных мест (шапки и т.п.). */
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
  const src = variant === "onDark" ? logoLight : logoOfficial;

  return (
    <img
      src={src}
      alt="Tandoor"
      className={cn(
        "block h-auto w-auto max-w-full shrink-0 object-contain object-left",
        compact ? "max-h-8 max-w-[9.5rem]" : "max-h-[60px] max-w-[168px]",
        className,
      )}
      loading="eager"
      decoding="async"
      data-testid={testId}
    />
  );
}
