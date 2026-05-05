import { TandoorLogo } from "@/components/tandoor-logo";

/** Фирменный логотип Tandoor (SVG из ассетов бренда). */
export function BrandMark() {
  return (
    <div className="flex min-w-0 items-center" data-testid="brand-mark">
      <TandoorLogo compact data-testid="brand-logo-tandoor" className="max-h-8 sm:max-h-9" />
    </div>
  );
}
