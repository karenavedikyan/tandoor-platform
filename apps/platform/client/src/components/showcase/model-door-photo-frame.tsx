import { cn } from "@/lib/utils";

export type ModelDoorPhotoFrameSize = "list" | "m" | "s";

export type ModelDoorPhotoPlaceholderDensity = "comfortable" | "compact" | "micro";

const SIZE_FRAME_CLASS: Record<ModelDoorPhotoFrameSize, string> = {
  list: "h-14 w-10 shrink-0",
  m: "h-24 w-[4.5rem] shrink-0",
  s: "h-16 w-12 shrink-0",
};

/** Фото двери: фиксированная рамка + object-contain (как в матрице витрины). */
export function ModelDoorPhotoFrame({
  src,
  alt,
  frameClass,
  size,
  imgTestId,
  imgPaddingClass = "p-2",
  placeholderDensity = "comfortable",
}: {
  src?: string | null;
  alt?: string;
  frameClass?: string;
  size?: ModelDoorPhotoFrameSize;
  imgTestId?: string;
  imgPaddingClass?: string;
  placeholderDensity?: ModelDoorPhotoPlaceholderDensity;
}) {
  const resolvedFrameClass = frameClass ?? (size ? SIZE_FRAME_CLASS[size] : "h-20 w-16 shrink-0");
  const emptyClass =
    placeholderDensity === "micro"
      ? "text-[8px] font-medium text-muted-foreground/80"
      : placeholderDensity === "compact"
        ? "text-[8px] text-muted-foreground"
        : "text-[9px] text-muted-foreground";
  const emptyLabel = placeholderDensity === "micro" ? "—" : "Нет фото";
  const imageSrc = src?.trim() || null;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40",
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
            "absolute inset-0 flex items-center justify-center bg-muted/25 px-0.5 text-center leading-none",
            emptyClass,
          )}
        >
          {emptyLabel}
        </span>
      )}
    </div>
  );
}
