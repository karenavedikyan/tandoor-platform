import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartBack } from "@/lib/navigation/use-smart-back";

export interface FloatingBackButtonProps {
  /** Опциональный fallback, если внутренней истории нет. */
  href?: string;
  label: string;
  testId: string;
  ariaLabel?: string;
  showAfterPx?: number;
}

export function FloatingBackButton({
  href,
  label,
  testId,
  ariaLabel,
  showAfterPx = 240,
}: FloatingBackButtonProps) {
  const [visible, setVisible] = useState(false);
  const { goBack } = useSmartBack();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setVisible(y > showAfterPx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfterPx]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 transition-all duration-200 sm:justify-end sm:px-6",
        "bottom-[calc(env(safe-area-inset-bottom)+1rem)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
      aria-hidden={!visible}
    >
      <button
        type="button"
        data-testid={testId}
        aria-label={ariaLabel ?? label}
        tabIndex={visible ? 0 : -1}
        onClick={() => goBack(href)}
        className={cn(
          "pointer-events-auto inline-flex min-h-11 max-w-[18rem] items-center gap-2 rounded-full border border-primary-border bg-primary px-5 py-2.5",
          "text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30",
          "transition-colors hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}
