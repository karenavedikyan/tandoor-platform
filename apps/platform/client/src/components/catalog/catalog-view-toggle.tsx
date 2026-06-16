import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CatalogViewToggle({
  active,
  onClick,
  title,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  "aria-label": string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition",
        active
          ? "border-[#9aca3c] bg-[#9aca3c] text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          : "border-[#eeeff7] bg-white text-[#8f96b0] hover:border-[#9aca3c]",
        className,
      )}
    >
      {children}
    </button>
  );
}
