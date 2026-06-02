import { optimizedImage } from "@/lib/catalog-image";
import { cn } from "@/lib/utils";
import {
  doorTypeShortLabel,
  isDoorTypeAvailable,
  isSideAvailable,
  sideShortLabel,
  type CatalogVariant,
  type VariantSelection,
} from "@/lib/catalog-variant-resolve";

type AxisOption = { value: string; product_id: string; image_url?: string | null };

type Props = {
  variants: CatalogVariant[];
  selection: VariantSelection;
  onSelectionChange: (next: VariantSelection) => void;
  sizes: AxisOption[];
  colors: AxisOption[];
  doorTypes: Array<{ value: string; product_id: string }>;
  sides: Array<{ value: string; product_id: string }>;
  compact?: boolean;
  /** Палитра цветов вынесена в Card-product — не дублировать здесь */
  hideColors?: boolean;
};

export function VariantSwitchers({
  variants,
  selection,
  onSelectionChange,
  sizes,
  colors,
  doorTypes,
  sides,
  compact = false,
  hideColors = false,
}: Props) {
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (doorTypes.length > 1) {
    return (
      <div className={cn("space-y-1.5", compact && "space-y-1")} onClick={stop}>
        <div className="flex flex-wrap gap-1">
          {doorTypes.map((dt) => {
            const short = doorTypeShortLabel(dt.value);
            const active = selection.door_type === dt.value;
            const disabled = !isDoorTypeAvailable(variants, dt.value, selection);
            return (
              <button
                key={dt.value}
                type="button"
                disabled={disabled}
                title={dt.value}
                className={cn(
                  "min-w-[2rem] rounded border px-1.5 py-0.5 text-[10px] font-medium transition",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted",
                  disabled && "cursor-not-allowed opacity-40",
                )}
                onClick={() => onSelectionChange({ ...selection, door_type: dt.value })}
              >
                {short}
              </button>
            );
          })}
        </div>
        <AxisRows
          compact={compact}
          sizes={sizes}
          colors={colors}
          sides={sides}
          variants={variants}
          selection={selection}
          onSelectionChange={onSelectionChange}
          showSides={false}
          hideColors={hideColors}
        />
      </div>
    );
  }

  return (
    <AxisRows
      compact={compact}
      sizes={sizes}
      colors={colors}
      sides={sides}
      variants={variants}
      selection={selection}
      onSelectionChange={onSelectionChange}
      showSides={sides.length > 1}
      hideColors={hideColors}
      onClickStop={stop}
    />
  );
}

function AxisRows({
  sizes,
  colors,
  sides,
  variants,
  selection,
  onSelectionChange,
  showSides,
  compact,
  hideColors,
  onClickStop,
}: {
  sizes: AxisOption[];
  colors: AxisOption[];
  sides: Array<{ value: string; product_id: string }>;
  variants: CatalogVariant[];
  selection: VariantSelection;
  onSelectionChange: (next: VariantSelection) => void;
  showSides: boolean;
  compact?: boolean;
  hideColors?: boolean;
  onClickStop?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")} onClick={onClickStop}>
      {showSides && sides.length > 1 ? (
        <div className="flex gap-1">
          {sides.map((s) => {
            const short = sideShortLabel(s.value);
            const active = selection.side === s.value;
            const disabled = !isSideAvailable(variants, s.value, selection);
            return (
              <button
                key={s.value}
                type="button"
                disabled={disabled}
                className={cn(
                  "min-w-[2rem] rounded border px-2 py-0.5 text-[10px] font-semibold",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background",
                  disabled && "cursor-not-allowed opacity-40",
                )}
                onClick={() => onSelectionChange({ ...selection, side: s.value })}
              >
                {short}
              </button>
            );
          })}
        </div>
      ) : null}

      {sizes.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {sizes.map((sz) => {
            const active = selection.size === sz.value;
            return (
              <button
                key={sz.value}
                type="button"
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px]",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted",
                )}
                onClick={() => onSelectionChange({ ...selection, size: sz.value })}
              >
                {sz.value}
              </button>
            );
          })}
        </div>
      ) : null}

      {!hideColors && colors.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {colors.map((c) => {
            const active = selection.color === c.value;
            const thumbRaw = c.image_url ?? variants.find((v) => v.color === c.value)?.image_url;
            const thumb = optimizedImage(thumbRaw, 96);
            return (
              <button
                key={c.value}
                type="button"
                title={c.value}
                className={cn(
                  "h-7 w-7 overflow-hidden rounded border-2 bg-white",
                  active ? "border-foreground" : "border-transparent opacity-80 hover:opacity-100",
                )}
                onClick={() => onSelectionChange({ ...selection, color: c.value })}
              >
                {thumb ? (
                  <img src={thumb} alt={c.value} className="h-full w-full object-contain p-0.5" loading="lazy" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[8px]">{c.value.slice(0, 2)}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
