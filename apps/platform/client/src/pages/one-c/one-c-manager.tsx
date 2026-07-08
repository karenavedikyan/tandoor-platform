import { useEffect, useState } from "react";
import { Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCManager } from "@/lib/one-c-showroom-api";
import { Badge } from "@/components/ui/badge";
import {
  dash,
  ONE_C_PAGE_LIMIT,
  OneCLoadingBlock,
  OneCPagination,
  OneCPageShell,
  OneCRefreshStubButton,
} from "./one-c-ui";
import { OneCManagerOrdersSummary } from "./one-c-manager-orders-summary";
import { OneCStoresFilters } from "./one-c-stores-filters";
import { OneCStoresTable } from "./one-c-stores-table";
import { OneCStoresCardsList } from "./one-c-stores-cards";
import { OneCListDensityToggle } from "./one-c-list-density-toggle";
import { useOneCStoresListView } from "./use-one-c-stores-list";
import { useOneCListDensity } from "./use-one-c-list-density";
import { useOneCStoresColumns } from "./use-one-c-stores-columns";
import { OneCStoresColumnPicker } from "./one-c-stores-column-picker";

export default function OneCManagerPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/manager/:id");
  const managerId = params?.id ?? "";
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<Awaited<ReturnType<typeof fetchOneCManager>>["user"] | null>(null);
  const [stores, setStores] = useState<Awaited<ReturnType<typeof fetchOneCManager>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { density, setDensity, effectiveDensity } = useOneCListDensity(`manager-${managerId}`, "grid");
  const { columns, toggleColumn, reorderColumns, resetColumns } = useOneCStoresColumns();

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;
  const nonTableView = effectiveDensity !== "table";
  const { act, filters, setFilters, filtered, distAggregates, distLoading } = useOneCStoresListView(stores, {
    serverSideSearch: true,
    nonTableView,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, managerId]);

  useEffect(() => {
    if (!canAccess || !managerId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCManager(managerId, { q: debouncedSearch, limit: ONE_C_PAGE_LIMIT, offset })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Менеджер не найден.");
          setManager(null);
          setStores([]);
          return;
        }
        setManager(res.user);
        setStores(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess, managerId, debouncedSearch, offset]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!managerId) return <Redirect to="/1c/team" />;

  return (
    <OneCPageShell
      path={`/1c/manager/${managerId}`}
      breadcrumbLabels={{ manager: manager?.fullName }}
      title={manager?.fullName ?? "Менеджер"}
      subtitle={
        manager ? (
          <span className="flex flex-col gap-1 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span>{dash(manager.phone)}</span>
              <span>{dash(manager.email)}</span>
              <Badge variant="secondary">{manager.storeCount} ТТ</Badge>
              <Badge variant="outline">{manager.legalCount} юрлиц</Badge>
            </span>
            <span>
              РОП: {dash(manager.ropName)} · РМ: {manager.rmNames.length > 0 ? manager.rmNames.join(", ") : "—"} ·
              Команда: {dash(manager.teamName)}
            </span>
          </span>
        ) : undefined
      }
      testId="page-one-c-manager"
      actions={<OneCRefreshStubButton />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          <OneCManagerOrdersSummary managerId={managerId} scope="manager" />
          <div className="mb-3 flex justify-end">
            <OneCListDensityToggle value={density} onChange={setDensity} testIdPrefix="one-c-manager-stores" />
          </div>
          <OneCStoresFilters
            items={stores}
            filters={filters}
            onFiltersChange={setFilters}
            distAggregates={distAggregates}
            distLoading={distLoading}
            disableDistributionFilters={nonTableView}
            hideManager
            serverSideSearch
            filteredCount={filtered.length}
            testIdPrefix="one-c-manager-stores"
            headerActions={
              effectiveDensity === "table" ? (
                <OneCStoresColumnPicker
                  columns={columns}
                  onToggleColumn={toggleColumn}
                  onReorderColumns={reorderColumns}
                  onResetColumns={resetColumns}
                  testIdPrefix="one-c-manager-stores"
                />
              ) : null
            }
          />
          {effectiveDensity === "table" ? (
            <OneCStoresTable
              items={filtered}
              columns={columns}
              act={act}
              emptyLabel="Торговые точки не найдены"
              testIdPrefix="one-c-manager-stores"
            />
          ) : (
            <OneCStoresCardsList
              items={filtered}
              density={effectiveDensity}
              act={act}
              emptyLabel="Торговые точки не найдены"
              testIdPrefix="one-c-manager-stores"
            />
          )}
          <OneCPagination
            total={total}
            limit={ONE_C_PAGE_LIMIT}
            offset={offset}
            onOffsetChange={setOffset}
            testIdPrefix="one-c-manager"
          />
        </>
      )}
    </OneCPageShell>
  );
}
