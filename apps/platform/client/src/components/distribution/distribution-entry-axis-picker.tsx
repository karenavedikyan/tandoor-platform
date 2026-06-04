import { Building2, MapPin, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

type DistributionEntryAxisPickerProps = {
  onSelect: (axis: DistributionEntryAxis) => void;
};

export function DistributionEntryAxisPicker({ onSelect }: DistributionEntryAxisPickerProps) {
  return (
    <div className="space-y-4" data-testid="distribution-entry-axis-picker">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Как вести дистрибуцию?</h2>
        <p className="text-sm text-muted-foreground">Выберите удобный способ найти торговую точку и внести факт по витрине.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AXIS_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.axis}
              type="button"
              onClick={() => onSelect(card.axis)}
              className={cn(
                "flex min-h-[11rem] flex-col rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-colors",
                "hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              data-testid={card.testId}
            >
              <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-base font-semibold text-foreground">{card.title}</span>
              <span className="mt-2 text-sm leading-snug text-muted-foreground">{card.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
