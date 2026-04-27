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
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Tandoor"
        data-testid={testId}
      >
        <rect x="2" y="2" width="28" height="28" rx="8" fill="hsl(var(--foreground))" />
        <path d="M16 8L24 24H20.5L18.9 20.8H13.1L11.5 24H8L16 8Z" fill="hsl(var(--primary))" />
        <path d="M14.6 17.8H17.4L16 14.9L14.6 17.8Z" fill="hsl(var(--foreground))" />
      </svg>
    );
  }

  return (
    <svg
      className={cn("h-8 w-[168px]", className)}
      viewBox="0 0 336 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Tandoor"
      data-testid={testId}
    >
      <text
        x="2"
        y="47"
        fill="hsl(var(--foreground))"
        fontFamily="Inter, Open Sans, sans-serif"
        fontWeight="800"
        fontSize="40"
        letterSpacing="2.5"
      >
        T NDOOR
      </text>
      <path d="M108 9L126 47H117.4L113.6 38.8H101.8L98 47H89L108 9Z" fill="hsl(var(--foreground))" />
      <path d="M106.2 31.8H109.4L107.8 28L106.2 31.8Z" fill="hsl(var(--primary))" />
      <path d="M108 14L116.8 31.5H113L111.1 27.4H104.9L103 31.5H99.2L108 14Z" fill="hsl(var(--primary))" />
    </svg>
  );
}
