import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCStores } from "@/lib/one-c-showroom-api";
import {
  ONE_C_PAGE_LIMIT,
  OneCLoadingBlock,
  OneCPagination,
  OneCOnlyActiveToggle,
  OneCPageShell,
  OneCRefreshStubButton,
} from "./one-c-ui";
import { OneCStoresFilters } from "./one-c-stores-filters";
import { OneCStoresTable } from "./one-c-stores-table";
import { useOneCStoresListView } from "./use-one-c-stores-list";

export default function OneCStoresPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [onlyActive, setOnlyActive] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchOneCStores>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;
  const { act, filters, setFilters, filtered, distAggregates, distLoading } = useOneCStoresListView(items, {
    serverSideSearch: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, onlyActive]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCStores({ q: debouncedSearch, limit: ONE_C_PAGE_LIMIT, offset, onlyActive })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить список ТТ.");
          return;
        }
        setItems(res.items);
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
  }, [canAccess, debouncedSearch, offset, onlyActive]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  return (
    <OneCPageShell
      path="/1c/stores"
      title="Торговые точки"
      subtitle={`${total.toLocaleString("ru-RU")} записей из выгрузки 1С`}
      testId="page-one-c-stores"
      actions={<OneCRefreshStubButton />}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <OneCOnlyActiveToggle
          checked={onlyActive}
          onCheckedChange={setOnlyActive}
          testId="toggle-one-c-stores-only-active"
        />
      </div>
      <OneCStoresFilters
        items={items}
        filters={filters}
        onFiltersChange={setFilters}
        distAggregates={distAggregates}
        distLoading={distLoading}
        serverSideSearch
        filteredCount={filtered.length}
        testIdPrefix="one-c-stores"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          <OneCStoresTable items={filtered} act={act} testIdPrefix="one-c-stores" />
          <OneCPagination
            total={total}
            limit={ONE_C_PAGE_LIMIT}
            offset={offset}
            onOffsetChange={setOffset}
            testIdPrefix="one-c-stores"
          />
        </>
      )}
    </OneCPageShell>
  );
}
