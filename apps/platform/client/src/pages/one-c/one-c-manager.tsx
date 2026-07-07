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
import { OneCStoresFilters } from "./one-c-stores-filters";
import { OneCStoresTable } from "./one-c-stores-table";
import { useOneCStoresListView } from "./use-one-c-stores-list";

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

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;
  const { act, filters, setFilters, filtered, distAggregates, distLoading } = useOneCStoresListView(stores, {
    serverSideSearch: true,
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
          <OneCStoresFilters
            items={stores}
            filters={filters}
            onFiltersChange={setFilters}
            distAggregates={distAggregates}
            distLoading={distLoading}
            hideManager
            serverSideSearch
            filteredCount={filtered.length}
            testIdPrefix="one-c-manager-stores"
          />
          <OneCStoresTable
            items={filtered}
            act={act}
            emptyLabel="Торговые точки не найдены"
            testIdPrefix="one-c-manager-stores"
          />
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
