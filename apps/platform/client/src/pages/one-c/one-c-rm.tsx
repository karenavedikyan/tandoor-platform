import { useEffect, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCRm } from "@/lib/one-c-showroom-api";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default function OneCRmPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/rm/:id");
  const rmId = params?.id ?? "";
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Awaited<ReturnType<typeof fetchOneCRm>>["user"] | null>(null);
  const [managers, setManagers] = useState<Awaited<ReturnType<typeof fetchOneCRm>>["managers"]>([]);
  const [stores, setStores] = useState<Awaited<ReturnType<typeof fetchOneCRm>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [ropName, setRopName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { density, setDensity, effectiveDensity } = useOneCListDensity(`rm-${rmId}`, "grid");
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
  }, [debouncedSearch, rmId]);

  useEffect(() => {
    if (!canAccess || !rmId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCRm(rmId, { q: debouncedSearch, limit: ONE_C_PAGE_LIMIT, offset })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "РМ не найден.");
          return;
        }
        setCard(res.user);
        setManagers(res.managers);
        setStores(res.items);
        setTotal(res.total);
        setRopName(res.ropName);
        setTeamName(res.teamName);
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
  }, [canAccess, rmId, debouncedSearch, offset]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!rmId) return <Redirect to="/1c/team" />;

  return (
    <OneCPageShell
      path={`/1c/rm/${rmId}`}
      breadcrumbLabels={{ rm: card?.fullName }}
      title={card?.fullName ?? "РМ"}
      subtitle={
        card ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span>{dash(card.phone)}</span>
            <span>РОП: {dash(ropName)}</span>
            <span>Команда: {dash(teamName)}</span>
            <Badge variant="secondary">{card.storeCount} ТТ</Badge>
            <Badge variant="outline">{card.legalCount} юрлиц</Badge>
          </span>
        ) : undefined
      }
      testId="page-one-c-rm"
      actions={<OneCRefreshStubButton />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <div className="space-y-6">
          <OneCManagerOrdersSummary managerId={rmId} scope="rm" />
          <section>
            <h2 className="mb-3 text-lg font-semibold">Менеджеры под ним</h2>
            <div className="rounded-md border">
              <Table data-testid="table-one-c-rm-managers">
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead className="text-right">ТТ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <Link href={`/1c/manager/${row.userId}`} className="text-primary hover:underline">
                          {row.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{dash(row.phone)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.storeCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Все ТТ РМа</h2>
              <OneCListDensityToggle value={density} onChange={setDensity} testIdPrefix="one-c-rm-stores" />
            </div>
            <OneCStoresFilters
              items={stores}
              filters={filters}
              onFiltersChange={setFilters}
              distAggregates={distAggregates}
              distLoading={distLoading}
              disableDistributionFilters={nonTableView}
              hideRm
              serverSideSearch
              filteredCount={filtered.length}
              testIdPrefix="one-c-rm-stores"
              headerActions={
                effectiveDensity === "table" ? (
                  <OneCStoresColumnPicker
                    columns={columns}
                    onToggleColumn={toggleColumn}
                    onReorderColumns={reorderColumns}
                    onResetColumns={resetColumns}
                    testIdPrefix="one-c-rm-stores"
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
                testIdPrefix="one-c-rm-stores"
              />
            ) : (
              <OneCStoresCardsList
                items={filtered}
                density={effectiveDensity}
                act={act}
                emptyLabel="Торговые точки не найдены"
                testIdPrefix="one-c-rm-stores"
              />
            )}
            <OneCPagination
              total={total}
              limit={ONE_C_PAGE_LIMIT}
              offset={offset}
              onOffsetChange={setOffset}
              testIdPrefix="one-c-rm"
            />
          </section>
        </div>
      )}
    </OneCPageShell>
  );
}
