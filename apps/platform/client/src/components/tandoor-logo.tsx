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
  variant,
  "data-testid": testId,
}: TandoorLogoProps) {
  const sizeClass = compact ? "max-h-8 max-w-[9.5rem]" : "max-h-[60px] max-w-[168px]";
  const imgClass = cn("block h-auto w-auto max-w-full shrink-0 object-contain object-left", sizeClass, className);

  if (variant === "onDark") {
    return (
      <img
        src={logoLight}
        alt="Tandoor"
        className={imgClass}
        loading="eager"
        decoding="async"
        data-testid={testId}
      />
    );
  }

  if (variant === "onLight") {
    return (
      <img
        src={logoOfficial}
        alt="Tandoor"
        className={imgClass}
        loading="eager"
        decoding="async"
        data-testid={testId}
      />
    );
  }

  return (
    <span className={cn("relative block h-auto w-auto max-w-full shrink-0", sizeClass, className)} data-testid={testId}>
      <img
        src={logoOfficial}
        alt="Tandoor"
        className="block h-auto w-auto max-w-full object-contain object-left dark:hidden"
        loading="eager"
        decoding="async"
      />
      <img
        src={logoLight}
        alt="Tandoor"
        className="hidden h-auto w-auto max-w-full object-contain object-left dark:block"
        loading="eager"
        decoding="async"
      />
    </span>
  );
}
