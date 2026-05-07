import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ANALYTICS_PERIOD_OPTIONS,
  ANALYTICS_TERRITORY_OPTIONS,
  ANALYTICS_CITY_OPTIONS,
} from "@/lib/sales-manager-kpi-data";
import type { OperationalGlobalFilters } from "@/lib/analytics-operational-data";
import { DEALER_CATEGORY_FILTER_OPTIONS, OPERATIONAL_PRODUCT_LINE_OPTIONS } from "@/lib/analytics-operational-data";

type OperationalFiltersBarProps = {
  filters: OperationalGlobalFilters;
  setFilters: Dispatch<SetStateAction<OperationalGlobalFilters>>;
  resultCount: number;
  onReset: () => void;
};

export function OperationalFiltersBar({ filters, setFilters, resultCount, onReset }: OperationalFiltersBarProps) {
  return (
    <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]">
      <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border/60 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm font-semibold text-foreground">Фильтры</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="tabular-nums font-medium" data-testid="text-operational-results-count">
            Найдено: {resultCount}
          </Badge>
          <Button type="button" variant="outline" size="sm" className="h-9 min-h-9 border-border font-semibold" data-testid="button-operational-reset-filters" onClick={onReset}>
            Сбросить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4 pt-4" data-testid="section-operational-filters">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Период</span>
            <Select value={filters.periodKey} onValueChange={(v) => setFilters((f) => ({ ...f, periodKey: v as OperationalGlobalFilters["periodKey"] }))}>
              <SelectTrigger className="h-10 min-h-10" data-testid="select-operational-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Территория</span>
            <Select value={filters.territoryId} onValueChange={(v) => setFilters((f) => ({ ...f, territoryId: v }))}>
              <SelectTrigger className="h-10 min-h-10" data-testid="select-operational-territory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_TERRITORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Город</span>
            <Select value={filters.cityId} onValueChange={(v) => setFilters((f) => ({ ...f, cityId: v }))}>
              <SelectTrigger className="h-10 min-h-10" data-testid="select-operational-city">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_CITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Категория клиента</span>
            <Select value={filters.dealerCategory} onValueChange={(v) => setFilters((f) => ({ ...f, dealerCategory: v as OperationalGlobalFilters["dealerCategory"] }))}>
              <SelectTrigger className="h-10 min-h-10" data-testid="select-operational-client-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEALER_CATEGORY_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={String(o.value)} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Линейка</span>
            <Select value={filters.productLine} onValueChange={(v) => setFilters((f) => ({ ...f, productLine: v as OperationalGlobalFilters["productLine"] }))}>
              <SelectTrigger className="h-10 min-h-10" data-testid="select-operational-product-line">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONAL_PRODUCT_LINE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Поиск</span>
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Клиент, город, модель…"
            className="h-10 min-h-10 w-full max-w-full lg:max-w-2xl"
            data-testid="input-operational-search"
          />
        </div>
      </CardContent>
    </Card>
  );
}
