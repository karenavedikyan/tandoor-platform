import { Building2, ChevronRight, MapPin, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type DistributionEntryAxis = "tradePoint" | "product" | "city";

type AxisCard = {
  axis: DistributionEntryAxis;
  title: string;
  description: string;
  icon: typeof MapPin;
  testId: string;
};

const AXIS_CARDS: AxisCard[] = [
  {
    axis: "tradePoint",
    title: "По торговой точке",
    description: "Выбрать конкретную ТТ и внести что стоит на витрине",
    icon: MapPin,
    testId: "distribution-entry-mode-tradepoint",
  },
  {
    axis: "product",
    title: "По продукту",
    description: "Выбрать модель (ВХ, МК двери, фурнитура) и увидеть, где она стоит и где должна стоять",
    icon: Package,
    testId: "distribution-entry-mode-product",
  },
  {
    axis: "city",
    title: "По городу",
    description: "Выбрать город, затем ТТ внутри него",
    icon: Building2,
    testId: "distribution-entry-mode-city",
  },
];

const axisButtonClass = cn(
  "w-full rounded-xl border border-border bg-card text-left shadow-xs transition-colors",
  "hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "active:bg-muted/40",
);

type DistributionEntryAxisPickerProps = {
  onSelect: (axis: DistributionEntryAxis) => void;
};

export function DistributionEntryAxisPicker({ onSelect }: DistributionEntryAxisPickerProps) {
  return (
    <div className="space-y-2 sm:space-y-4" data-testid="distribution-entry-axis-picker">
      <div className="space-y-0.5 sm:space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg lg:text-xl">
          Как вести дистрибуцию?
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Выберите удобный способ найти торговую точку и внести факт по витрине.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {AXIS_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.axis}
              type="button"
              onClick={() => onSelect(card.axis)}
              className={axisButtonClass}
              data-testid={card.testId}
            >
              <span className="flex min-h-16 items-center gap-3 p-3 sm:hidden">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug text-foreground">{card.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {card.description}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </span>

              <span className="hidden min-h-[11rem] flex-col p-4 sm:flex">
                <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-base font-semibold text-foreground">{card.title}</span>
                <span className="mt-2 text-sm leading-snug text-muted-foreground">{card.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
