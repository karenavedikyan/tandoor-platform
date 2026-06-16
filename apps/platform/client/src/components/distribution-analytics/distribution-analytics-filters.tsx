import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import {
  emptyDistributionAnalyticsFilters,
  resolveRegionForRow,
  type DistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import { collectAnalyticsCatalogProducts } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import { AnalyticsModelPicker } from "./analytics-model-picker";
import { CLIENT_CATEGORY_META, type ClientCategoryId } from "@/lib/client-category";
import { cn } from "@/lib/utils";

type Props = {
  scopedRows: TradePointListRow[];
  filters: DistributionAnalyticsFilters;
  filteredCount: number;
  onApply: (next: DistributionAnalyticsFilters) => void;
};

const EQUIPMENT_CHIPS: { id: EquipmentTypeKey; label: string }[] = [
  { id: "entrance", label: "ВХ" },
  { id: "interior", label: "МК" },
  { id: "hardware", label: "Фурнитура" },
];

const CATEGORY_CHIPS: { id: ClientCategoryId; label: string }[] = [
  { id: "top150", label: "TOP-150" },
  { id: "top350", label: "TOP-350" },
  { id: "top500", label: "Прочее" },
  { id: "top500plus", label: "TOP-500+" },
  { id: "new_client", label: "Новый" },
];

export function DistributionAnalyticsFiltersPanel({
  scopedRows,
  filters,
  filteredCount,
  onApply,
}: Props): ReactElement {
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState(false);

  const cityOptions = useMemo(
    () => uniqueOptions(scopedRows.map((r) => r.city).filter(Boolean)),
    [scopedRows],
  );
  const regionOptions = useMemo(
    () => uniqueOptions(scopedRows.map((r) => resolveRegionForRow(r))),
    [scopedRows],
  );
  const dealerOptions = useMemo(
    () =>
      uniqueOptions(
        scopedRows.map((r) => `${r.dealerName} (${r.dealerClientCode})`),
        scopedRows.map((r) => r.dealerId),
      ),
    [scopedRows],
  );
  const tpOptions = useMemo(
    () =>
      uniqueOptions(
        scopedRows.map((r) => `${r.tradePointDisplayCode} · ${r.tradePointName}`),
        scopedRows.map((r) => r.tradePointId),
      ),
    [scopedRows],
  );
  const managerOptions = useMemo(
    () => uniqueOptions(scopedRows.map((r) => r.manager).filter((x) => x && x !== "—"), scopedRows.map((r) => `mgr:${r.manager}`)),
    [scopedRows],
  );
  const rmOptions = useMemo(
    () =>
      uniqueOptions(
        scopedRows.map((r) => r.regionalManager).filter((x) => x && x !== "—"),
        scopedRows.map((r) => `rm:${r.regionalManager}`),
      ),
    [scopedRows],
  );
  const ropOptions = useMemo(
    () =>
      uniqueOptions(
        scopedRows.map((r) => r.rop).filter((x) => x && x !== "—"),
        scopedRows.map((r) => `rop:${r.rop}`),
      ),
    [scopedRows],
  );
  const analyticsProducts = useMemo(() => collectAnalyticsCatalogProducts(), []);

  const chips = useMemo(() => buildFilterChips(filters), [filters]);

  const filterBody = (
    <div className="space-y-4">
      <Section title="География">
        <div className="grid gap-2 sm:grid-cols-2">
          <MultiSelect options={cityOptions} value={draft.cities} onChange={(cities) => setDraft((d) => ({ ...d, cities }))} placeholder="Города" testId="filter-analytics-cities" />
          <MultiSelect options={regionOptions} value={draft.regions} onChange={(regions) => setDraft((d) => ({ ...d, regions }))} placeholder="Регионы" testId="filter-analytics-regions" />
        </div>
      </Section>
      <Section title="Клиент">
        <div className="grid gap-2 sm:grid-cols-2">
          <MultiSelect options={dealerOptions} value={draft.dealerIds} onChange={(dealerIds) => setDraft((d) => ({ ...d, dealerIds }))} placeholder="Дилеры" testId="filter-analytics-dealers" />
          <MultiSelect options={tpOptions} value={draft.tradePointIds} onChange={(tradePointIds) => setDraft((d) => ({ ...d, tradePointIds }))} placeholder="Торговые точки" testId="filter-analytics-trade-points" />
        </div>
      </Section>
      <Section title="Команда">
        <div className="grid gap-2 sm:grid-cols-3">
          <MultiSelect options={managerOptions} value={draft.managerIds} onChange={(managerIds) => setDraft((d) => ({ ...d, managerIds }))} placeholder="Менеджер" testId="filter-analytics-managers" />
          <MultiSelect options={rmOptions} value={draft.regionalManagerIds} onChange={(regionalManagerIds) => setDraft((d) => ({ ...d, regionalManagerIds }))} placeholder="РМ" testId="filter-analytics-rm" />
          <MultiSelect options={ropOptions} value={draft.ropIds} onChange={(ropIds) => setDraft((d) => ({ ...d, ropIds }))} placeholder="РОП" testId="filter-analytics-rop" />
        </div>
      </Section>
      <Section title="Категория клиента">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_CHIPS.map((chip) => {
            const active = draft.clientCategories.includes(chip.id);
            return (
              <Button
                key={chip.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-7 rounded-full px-2.5 text-[11px]"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    clientCategories: active
                      ? d.clientCategories.filter((x) => x !== chip.id)
                      : [...d.clientCategories, chip.id],
                  }))
                }
              >
                {chip.label}
              </Button>
            );
          })}
        </div>
      </Section>
      <Section title="Товар">
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_CHIPS.map((chip) => {
            const active = draft.equipmentTypes.includes(chip.id);
            return (
              <Button
                key={chip.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-7 rounded-full px-2.5 text-[11px]"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    equipmentTypes: active
                      ? d.equipmentTypes.filter((x) => x !== chip.id)
                      : [...d.equipmentTypes, chip.id],
                  }))
                }
              >
                {chip.label}
              </Button>
            );
          })}
        </div>
        <AnalyticsModelPicker
          products={analyticsProducts}
          activeEquipmentTypes={draft.equipmentTypes}
          value={draft.modelIds}
          onChange={(modelIds) => setDraft((d) => ({ ...d, modelIds }))}
          testId="filter-analytics-models"
        />
      </Section>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const empty = emptyDistributionAnalyticsFilters();
            setDraft(empty);
            onApply(empty);
          }}
        >
          Сбросить
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onApply(draft);
            setOpen(false);
          }}
        >
          Применить
        </Button>
      </div>
    </div>
  );

  return (
    <div className="sticky top-0 z-20 space-y-2 border-b border-border/60 bg-background/95 pb-2 pt-1 backdrop-blur" data-testid="distribution-analytics-filters-bar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Collapsible className="hidden lg:block">
            <CollapsibleTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-8" data-testid="button-distribution-analytics-filters">
                Фильтры
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 rounded-xl border border-border/70 bg-card p-3">{filterBody}</CollapsibleContent>
          </Collapsible>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-8 lg:hidden" data-testid="button-distribution-analytics-filters-mobile">
                Фильтры
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Фильтры аналитики</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{filterBody}</div>
            </SheetContent>
          </Sheet>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="text-distribution-analytics-count">
          <span className="font-semibold text-foreground">{filteredCount}</span> ТТ в выборке
        </p>
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1" data-testid="distribution-analytics-filter-chips">
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 font-normal">
              {chip.label}
              <button
                type="button"
                className="rounded p-0.5 hover:bg-muted"
                aria-label="Убрать фильтр"
                onClick={() => onApply(chip.remove(filters))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function uniqueOptions(labels: string[], values?: string[]) {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  labels.forEach((label, i) => {
    const value = values?.[i] ?? label;
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({ value, label });
  });
  out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return out;
}

function buildFilterChips(filters: DistributionAnalyticsFilters): { key: string; label: string; remove: (f: DistributionAnalyticsFilters) => DistributionAnalyticsFilters }[] {
  const chips: { key: string; label: string; remove: (f: DistributionAnalyticsFilters) => DistributionAnalyticsFilters }[] = [];
  for (const city of filters.cities) {
    chips.push({ key: `city:${city}`, label: `Город: ${city}`, remove: (f) => ({ ...f, cities: f.cities.filter((x) => x !== city) }) });
  }
  for (const id of filters.dealerIds) {
    chips.push({ key: `dealer:${id}`, label: `Дилер: ${id}`, remove: (f) => ({ ...f, dealerIds: f.dealerIds.filter((x) => x !== id) }) });
  }
  for (const cat of filters.clientCategories) {
    chips.push({
      key: `cat:${cat}`,
      label: CLIENT_CATEGORY_META[cat]?.shortLabel ?? cat,
      remove: (f) => ({ ...f, clientCategories: f.clientCategories.filter((x) => x !== cat) }),
    });
  }
  for (const t of filters.equipmentTypes) {
    chips.push({
      key: `type:${t}`,
      label: t === "entrance" ? "ВХ" : t === "interior" ? "МК" : "Фурнитура",
      remove: (f) => ({ ...f, equipmentTypes: f.equipmentTypes.filter((x) => x !== t) }),
    });
  }
  return chips;
}
