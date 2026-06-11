import { cn } from "@/lib/utils";

export type ModelDoorPhotoFrameSize = "list" | "m" | "s";

export type ModelDoorPhotoPlaceholderDensity = "comfortable" | "compact" | "micro";

const SIZE_FRAME_CLASS: Record<ModelDoorPhotoFrameSize, string> = {
  list: "h-16 w-12 shrink-0",
  m: "aspect-[3/4] h-32 w-full shrink-0",
  s: "aspect-[3/4] h-24 w-full shrink-0",
};

/** Фото двери: фиксированная рамка + object-contain (как в матрице витрины). */
export function ModelDoorPhotoFrame({
  src,
  alt,
  frameClass,
  size,
  variant = "default",
  imgTestId,
  imgPaddingClass = "p-2",
  placeholderDensity = "comfortable",
}: {
  src?: string | null;
  alt?: string;
  frameClass?: string;
  size?: ModelDoorPhotoFrameSize;
  variant?: "default" | "assignment";
  imgTestId?: string;
  imgPaddingClass?: string;
  placeholderDensity?: ModelDoorPhotoPlaceholderDensity;
}) {
  const resolvedFrameClass = frameClass ?? (size ? SIZE_FRAME_CLASS[size] : "h-20 w-16 shrink-0");
  const emptyClass =
    placeholderDensity === "micro"
      ? "text-[8px] font-medium text-muted-foreground/60"
      : placeholderDensity === "compact"
        ? "text-[9px] text-muted-foreground/60"
        : "text-[9px] text-muted-foreground/60";
  const emptyLabel = placeholderDensity === "micro" ? "—" : "Нет фото";
  const imageSrc = src?.trim() || null;
  const isAssignment = variant === "assignment";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        isAssignment ? "rounded-lg border border-border/50 bg-muted/30" : "rounded-md border border-border/60 bg-muted/40",
        resolvedFrameClass,
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt ?? ""}
          data-testid={imgTestId}
          className={cn(
            "absolute inset-0 box-border h-full w-full object-contain object-center",
            imgPaddingClass,
          )}
          loading="lazy"
        />
      ) : (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center px-0.5 text-center leading-none",
            isAssignment ? "bg-transparent" : "bg-muted/25",
            emptyClass,
          )}
        >
          {emptyLabel}
        </span>
      )}
    </div>
  );
}
