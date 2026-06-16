import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  defaultDistributionFilterState,
  DISTRIBUTION_PERIOD_OPTIONS,
  DISTRIBUTION_SEGMENT_OPTIONS,
  getDistributionClientCategoryOptions,
  getDistributionPlacementTypeOptions,
  DISTRIBUTION_STATUS_OPTIONS,
  listActiveDistributionFilterChips,
  type DistributionFilterState,
} from "@/lib/distribution-filters";

type DistributionFiltersBarProps = {
  value: DistributionFilterState;
  onChange: (next: DistributionFilterState) => void;
  regionOptions: string[];
  cityOptions: string[];
  title?: string;
  hideRegion?: boolean;
};

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FiltersGrid({
  value,
  onChange,
  regionOptions,
  cityOptions,
  hideRegion,
}: DistributionFiltersBarProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <FilterField label="Период">
        <Select
          value={value.period.kind}
          onValueChange={(kind) =>
            onChange({
              ...value,
              period: { kind: kind as DistributionFilterState["period"]["kind"], fromIso: null, toIso: null },
            })
          }
        >
          <SelectTrigger data-testid="select-distribution-filter-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISTRIBUTION_PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Сегмент">
        <Select
          value={value.segment}
          onValueChange={(segment) =>
            onChange({ ...value, segment: segment as DistributionFilterState["segment"] })
          }
        >
          <SelectTrigger data-testid="select-distribution-filter-segment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISTRIBUTION_SEGMENT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Категория клиента">
        <Select
          value={value.clientCategory}
          onValueChange={(clientCategory) =>
            onChange({
              ...value,
              clientCategory: clientCategory as DistributionFilterState["clientCategory"],
            })
          }
        >
          <SelectTrigger data-testid="select-distribution-filter-client-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getDistributionClientCategoryOptions().map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {hideRegion ? null : (
        <FilterField label="Регион">
          <Select value={value.region} onValueChange={(region) => onChange({ ...value, region })}>
            <SelectTrigger data-testid="select-distribution-filter-region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все регионы</SelectItem>
              {regionOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      )}

      <FilterField label="Город">
        <Select value={value.city} onValueChange={(city) => onChange({ ...value, city })}>
          <SelectTrigger data-testid="select-distribution-filter-city">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все города</SelectItem>
            {cityOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Тип размещения">
        <Select
          value={value.placementType}
          onValueChange={(placementType) =>
            onChange({
              ...value,
              placementType: placementType as DistributionFilterState["placementType"],
            })
          }
        >
          <SelectTrigger data-testid="select-distribution-filter-placement">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getDistributionPlacementTypeOptions().map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Статус">
        <Select
          value={value.status}
          onValueChange={(status) =>
            onChange({ ...value, status: status as DistributionFilterState["status"] })
          }
        >
          <SelectTrigger data-testid="select-distribution-filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISTRIBUTION_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}

export function DistributionFiltersBar(props: DistributionFiltersBarProps) {
  const { value, onChange, title } = props;
  const [open, setOpen] = useState(false);
  const chips = listActiveDistributionFilterChips(value);

  return (
    <CardShell data-testid="distribution-filters-bar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title ?? "Фильтры"}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => onChange(defaultDistributionFilterState())}
            data-testid="button-distribution-filters-reset"
          >
            Сбросить фильтры
          </Button>
          <Collapsible open={open} onOpenChange={setOpen} className="lg:hidden">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Фильтры
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="distribution-filter-chips">
          {chips.map((chip) => (
            <Badge key={chip.id} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
              {chip.label}
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={`Снять фильтр ${chip.label}`}
                onClick={() => onChange(chip.clear(value))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="hidden lg:block">
        <FiltersGrid {...props} />
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="lg:hidden">
        <CollapsibleContent className="pt-1">
          <FiltersGrid {...props} />
        </CollapsibleContent>
      </Collapsible>
    </CardShell>
  );
}

function CardShell({
  children,
  ...rest
}: { children: ReactNode; "data-testid"?: string }) {
  return (
    <div
      {...rest}
      className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-xs sm:p-4"
    >
      {children}
    </div>
  );
}
