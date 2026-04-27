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
        className={cn("h-8 w-[40px]", className)}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="TANDOOR"
        data-testid={testId}
      >
        <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="white" stroke="hsl(var(--border))" />
        <text
          x="6.5"
          y="27.5"
          fill="hsl(var(--foreground))"
          fontFamily="Nunito, Montserrat, Inter, Open Sans, sans-serif"
          fontWeight="800"
          fontSize="18.2"
          letterSpacing="1.1"
        >
          TD
        </text>
        <path d="M16.2 14L20 8L23.8 14H16.2Z" fill="#7DC400" />
      </svg>
    );
  }

  return (
    <svg
      className={cn("h-8 w-[206px]", className)}
      viewBox="0 0 270 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="TANDOOR"
      data-testid={testId}
    >
      <text
        x="0"
        y="40"
        fill="hsl(var(--foreground))"
        fontFamily="Nunito, Montserrat, Inter, Open Sans, sans-serif"
        fontWeight="800"
        fontSize="39"
        letterSpacing="1.35"
      >
        TANDOOR
      </text>
      <path d="M50 13L56.7 2L63.4 13H50Z" fill="#7DC400" />
    </svg>
  );
}
