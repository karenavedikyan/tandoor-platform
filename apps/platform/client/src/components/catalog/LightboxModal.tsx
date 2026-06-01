import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LightboxImage = { blob_url: string; path?: string };

type LightboxModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: LightboxImage[];
  activeIdx: number;
  onActiveIdxChange: (idx: number) => void;
  alt?: string;
};

export function LightboxModal({
  open,
  onOpenChange,
  images,
  activeIdx,
  onActiveIdxChange,
  alt = "",
}: LightboxModalProps) {
  const count = images.length;
  const safeIdx = count > 0 ? ((activeIdx % count) + count) % count : 0;

  const goPrev = useCallback(() => {
    if (count < 2) return;
    onActiveIdxChange((safeIdx - 1 + count) % count);
  }, [count, onActiveIdxChange, safeIdx]);

  const goNext = useCallback(() => {
    if (count < 2) return;
    onActiveIdxChange((safeIdx + 1) % count);
  }, [count, onActiveIdxChange, safeIdx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, goPrev, goNext]);

  if (count === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-screen-lg border-0 bg-black/95 p-2 sm:p-4 [&>button]:text-white"
        aria-describedby={undefined}
      >
        <div className="relative flex min-h-[50vh] items-center justify-center">
          {count > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={goPrev}
              aria-label="Предыдущее фото"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          ) : null}
          <img
            src={images[safeIdx].blob_url}
            alt={alt}
            className="max-h-[85vh] w-full object-contain"
          />
          {count > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={goNext}
              aria-label="Следующее фото"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          ) : null}
        </div>
        <p className={cn("pb-1 text-center text-xs text-white/70", count < 2 && "sr-only")}>
          {safeIdx + 1} / {count}
        </p>
      </DialogContent>
    </Dialog>
  );
}
