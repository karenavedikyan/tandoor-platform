import { cn } from "@/lib/utils";

type TandoorLogoProps = {
  className?: string;
  compact?: boolean;
  "data-testid"?: string;
};

export function TandoorLogo({ className, compact = false, "data-testid": testId }: TandoorLogoProps) {
  if (compact) {
    return (
      <svg
        className={cn("h-8 w-8", className)}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="TANDOOR"
        data-testid={testId}
      >
        <rect x="1.5" y="1.5" width="37" height="37" rx="9" fill="white" stroke="hsl(var(--border))" />
        <text
          x="10"
          y="27"
          fill="hsl(var(--foreground))"
          fontFamily="Inter, Open Sans, sans-serif"
          fontWeight="800"
          fontSize="18"
          letterSpacing="0.6"
        >
          T
        </text>
        <path d="M20 12L24 6L28 12H20Z" fill="hsl(var(--primary))" />
      </svg>
    );
  }

  return (
    <svg
      className={cn("h-8 w-[192px]", className)}
      viewBox="0 0 252 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="TANDOOR"
      data-testid={testId}
    >
      <text
        x="0"
        y="38"
        fill="hsl(var(--foreground))"
        fontFamily="Inter, Open Sans, sans-serif"
        fontWeight="800"
        fontSize="38"
        letterSpacing="1.5"
      >
        TANDOOR
      </text>
      <path d="M46 11L53 1L60 11H46Z" fill="hsl(var(--primary))" />
    </svg>
  );
}
