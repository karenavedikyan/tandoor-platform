import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import type { DistributionTradePointMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import { OneCSearchInput } from "./one-c-ui";
import {
  emptyOneCStoresFilters,
  hasActiveOneCStoresFilters,
  type MatrixFillFilter,
  type OneCStoresFilterState,
  type SegmentPresenceFilter,
  uniqueStoreFilterOptions,
} from "./one-c-stores-filter-logic";

type OneCStoresFiltersProps = {
  items: OneCStoreListItem[];
  filters: OneCStoresFilterState;
  onFiltersChange: (next: OneCStoresFilterState) => void;
  distAggregates: Map<string, DistributionTradePointMetrics>;
  distLoading?: boolean;
  hideManager?: boolean;
  hideRm?: boolean;
  serverSideSearch?: boolean;
  disableDistributionFilters?: boolean;
  filteredCount: number;
  testIdPrefix?: string;
};

const MATRIX_FILL_OPTIONS: { value: MatrixFillFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "empty", label: "Пустые (0)" },
  { value: "partial", label: "Частично" },
  { value: "full", label: "Полные (100%)" },
];

function SegmentPresenceToggle({
  label,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: SegmentPresenceFilter;
  onChange: (next: SegmentPresenceFilter) => void;
  disabled?: boolean;
  testId?: string;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as SegmentPresenceFilter);
        }}
        className="justify-start"
        disabled={disabled}
        data-testid={testId}
      >
        <ToggleGroupItem value="all" className="h-7 px-2 text-xs">
          Все
        </ToggleGroupItem>
        <ToggleGroupItem value="yes" className="h-7 px-2 text-xs">
          Есть
        </ToggleGroupItem>
        <ToggleGroupItem value="no" className="h-7 px-2 text-xs">
          Нет
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function OneCStoresFilters({
  items,
  filters,
  onFiltersChange,
  distAggregates: _distAggregates,
  distLoading = false,
  hideManager = false,
  hideRm = false,
  serverSideSearch = false,
  disableDistributionFilters = false,
  filteredCount,
  testIdPrefix = "one-c-stores",
}: OneCStoresFiltersProps): ReactElement {
  const patch = (partial: Partial<OneCStoresFilterState>) => onFiltersChange({ ...filters, ...partial });
  const holdings = uniqueStoreFilterOptions(items, (i) => i.legal_parent_name);
  const clientTypes = uniqueStoreFilterOptions(items, (i) => i.legal_client_type);
  const paymentForms = uniqueStoreFilterOptions(items, (i) => i.legal_payment_form || "н/у");
  const regionalManagers = uniqueStoreFilterOptions(items, (i) => i.legal_regional_manager_name);
  const managers = uniqueStoreFilterOptions(items, (i) => i.manager_name);
  const statuses = uniqueStoreFilterOptions(items, (i) => i.status);
  const showReset = hasActiveOneCStoresFilters(filters, { skipSearch: serverSideSearch });

  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-filters`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <OneCSearchInput
          value={filters.search}
          onChange={(search) => patch({ search })}
          placeholder="Адрес, менеджер, юрлицо, ИНН, холдинг…"
          testId={`input-${testIdPrefix}-search`}
        />
        {showReset ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onFiltersChange(emptyOneCStoresFilters())}
            data-testid={`${testIdPrefix}-filters-reset`}
          >
            Сбросить
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MultiSelect
          options={holdings}
          value={filters.holdings}
          onChange={(holdings) => patch({ holdings })}
          placeholder="Холдинг"
          testId={`filter-${testIdPrefix}-holding`}
          triggerClassName="h-9 min-h-9 text-xs"
        />
        <MultiSelect
          options={clientTypes}
          value={filters.clientTypes}
          onChange={(clientTypes) => patch({ clientTypes })}
          placeholder="Тип клиента"
          testId={`filter-${testIdPrefix}-client-type`}
          triggerClassName="h-9 min-h-9 text-xs"
        />
        <MultiSelect
          options={paymentForms}
          value={filters.paymentForms}
          onChange={(paymentForms) => patch({ paymentForms })}
          placeholder="Оплата"
          testId={`filter-${testIdPrefix}-payment`}
          triggerClassName="h-9 min-h-9 text-xs"
        />
        {hideRm ? null : (
          <MultiSelect
            options={regionalManagers}
            value={filters.regionalManagers}
            onChange={(regionalManagers) => patch({ regionalManagers })}
            placeholder="РМ"
            testId={`filter-${testIdPrefix}-rm`}
            triggerClassName="h-9 min-h-9 text-xs"
          />
        )}
        {hideManager ? null : (
          <MultiSelect
            options={managers}
            value={filters.managers}
            onChange={(managers) => patch({ managers })}
            placeholder="Менеджер"
            testId={`filter-${testIdPrefix}-manager`}
            triggerClassName="h-9 min-h-9 text-xs"
          />
        )}
        <MultiSelect
          options={statuses}
          value={filters.statuses}
          onChange={(statuses) => patch({ statuses })}
          placeholder="Статус"
          testId={`filter-${testIdPrefix}-status`}
          triggerClassName="h-9 min-h-9 text-xs"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Заполненность матрицы</span>
          <ToggleGroup
            type="single"
            value={filters.matrixFill}
            onValueChange={(next) => next && patch({ matrixFill: next as MatrixFillFilter })}
            data-testid={`filter-${testIdPrefix}-matrix-fill`}
          >
            {MATRIX_FILL_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.value} value={opt.value} className="h-7 px-2 text-xs">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Дистрибуция</span>
          {distLoading && !disableDistributionFilters ? (
            <Badge variant="outline" className="text-[10px] font-normal">
              загружается
            </Badge>
          ) : null}
          {disableDistributionFilters ? (
            <Badge variant="outline" className="text-[10px] font-normal">
              в режиме карточек
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SegmentPresenceToggle
            label="ВХ"
            value={filters.vhPresence}
            onChange={(vhPresence) => patch({ vhPresence })}
            disabled={distLoading || disableDistributionFilters}
            testId={`filter-${testIdPrefix}-vh`}
          />
          <SegmentPresenceToggle
            label="МК"
            value={filters.mkPresence}
            onChange={(mkPresence) => patch({ mkPresence })}
            disabled={distLoading || disableDistributionFilters}
            testId={`filter-${testIdPrefix}-mk`}
          />
          <SegmentPresenceToggle
            label="Фурн"
            value={filters.hwPresence}
            onChange={(hwPresence) => patch({ hwPresence })}
            disabled={distLoading || disableDistributionFilters}
            testId={`filter-${testIdPrefix}-hw`}
          />
          <SegmentPresenceToggle
            label="Ротация"
            value={filters.rotPresence}
            onChange={(rotPresence) => patch({ rotPresence })}
            disabled={distLoading || disableDistributionFilters}
            testId={`filter-${testIdPrefix}-rot`}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground" data-testid={`${testIdPrefix}-filters-count`}>
        Показано {filteredCount.toLocaleString("ru-RU")} из {items.length.toLocaleString("ru-RU")}
      </p>
    </div>
  );
}
