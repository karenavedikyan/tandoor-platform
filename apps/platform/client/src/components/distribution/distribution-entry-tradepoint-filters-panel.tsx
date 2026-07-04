import type { ReactElement, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { buildDistributionAnalyticsFilterOptionsFromDealers } from "@/lib/distribution-analytics/distribution-analytics-filter-options";
import {
  defaultDistributionEntryTradePointFilterState,
  DISTRIBUTION_STATUS_OPTIONS,
  getEntryTradePointClientCategoryOptions,
  type DistributionEntryTradePointFilterState,
} from "@/lib/distribution-filters";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { cn } from "@/lib/utils";

type DistributionEntryTradePointFiltersPanelProps = {
  scopedDealers: readonly DealerRow[];
  value: DistributionEntryTradePointFilterState;
  onChange: (next: DistributionEntryTradePointFilterState) => void;
  hideRegion?: boolean;
  className?: string;
};

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function DistributionEntryTradePointFiltersPanel({
  scopedDealers,
  value,
  onChange,
  hideRegion,
  className,
}: DistributionEntryTradePointFiltersPanelProps): ReactElement {
  const { data: snap } = useOrgSnapshot();
  const {
    cityOptions,
    regionOptions,
    managerOptions,
    regionalManagerOptions,
    ropOptions,
  } = buildDistributionAnalyticsFilterOptionsFromDealers(scopedDealers, snap);
  const categoryOptions = getEntryTradePointClientCategoryOptions();

  return (
    <div className={cn("space-y-4", className)} data-testid="distribution-entry-tt-filters-panel">
      <Section title="Команда">
        <div className="grid gap-3 md:grid-cols-2">
          <FilterField label="Менеджер">
            <MultiSelect
              options={managerOptions}
              value={value.managerIds}
              onChange={(managerIds) => onChange({ ...value, managerIds })}
              placeholder="Все менеджеры"
              allLabel="Все менеджеры"
              testId="filter-tt-managers"
              triggerClassName="w-full"
            />
          </FilterField>
          <FilterField label="Регионал">
            <MultiSelect
              options={regionalManagerOptions}
              value={value.regionalManagerIds}
              onChange={(regionalManagerIds) => onChange({ ...value, regionalManagerIds })}
              placeholder="Все регионалы"
              allLabel="Все регионалы"
              testId="filter-tt-regional"
              triggerClassName="w-full"
            />
          </FilterField>
          <FilterField label="РОП" className="md:col-span-2">
            <MultiSelect
              options={ropOptions}
              value={value.ropIds}
              onChange={(ropIds) => onChange({ ...value, ropIds })}
              placeholder="Все РОП"
              allLabel="Все РОП"
              testId="filter-tt-rop"
              triggerClassName="w-full"
            />
          </FilterField>
        </div>
      </Section>

      <Section title="География">
        <div className="grid gap-3 md:grid-cols-2">
          {hideRegion ? null : (
            <FilterField label="Регион">
              <MultiSelect
                options={regionOptions}
                value={value.regionValues}
                onChange={(regionValues) => onChange({ ...value, regionValues })}
                placeholder="Все регионы"
                allLabel="Все регионы"
                testId="filter-tt-region"
                triggerClassName="w-full"
              />
            </FilterField>
          )}
          <FilterField label="Город" className={hideRegion ? "md:col-span-2" : undefined}>
            <MultiSelect
              options={cityOptions}
              value={value.cityValues}
              onChange={(cityValues) => onChange({ ...value, cityValues })}
              placeholder="Все города"
              allLabel="Все города"
              testId="filter-tt-city"
              triggerClassName="w-full"
            />
          </FilterField>
        </div>
      </Section>

      <Section title="Клиент">
        <div className="grid gap-3 md:grid-cols-2">
          <FilterField label="Категория клиента">
            <MultiSelect
              options={categoryOptions}
              value={value.clientCategoryIds}
              onChange={(clientCategoryIds) =>
                onChange({ ...value, clientCategoryIds: clientCategoryIds as ClientCategoryId[] })
              }
              placeholder="Все категории"
              allLabel="Все категории"
              testId="filter-tt-category"
              triggerClassName="w-full"
            />
          </FilterField>
          <FilterField label="Статус матрицы">
            <Select
              value={value.status}
              onValueChange={(status) =>
                onChange({ ...value, status: status as DistributionEntryTradePointFilterState["status"] })
              }
            >
              <SelectTrigger className="w-full" data-testid="filter-tt-status">
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
      </Section>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => onChange(defaultDistributionEntryTradePointFilterState())}
        data-testid="button-distribution-entry-tt-filters-reset"
      >
        Сбросить фильтры
      </Button>
    </div>
  );
}
