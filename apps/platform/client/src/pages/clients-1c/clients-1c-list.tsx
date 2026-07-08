import { useEffect, useMemo, useState } from "react";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessClients1cForUser } from "@/lib/auth-access";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  fetchClients1cList,
  type Clients1cListItem,
  type Clients1cListSort,
  type Clients1cTriFilter,
} from "@/lib/clients-1c-api";
import {
  OneCLoadingBlock,
  OneCPagination,
  OneCPageShell,
  OneCSearchInput,
  useDebouncedSearch,
} from "@/pages/one-c/one-c-ui";
import { OneCListDensityToggle } from "@/pages/one-c/one-c-list-density-toggle";
import { useOneCListDensity } from "@/pages/one-c/use-one-c-list-density";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clients1cListTable } from "./clients-1c-list-table";
import { Clients1cRefreshButton } from "./clients-1c-refresh-button";

const PAGE_SIZE = 50;

function triSelectValue(v: Clients1cTriFilter): string {
  return v;
}

export default function Clients1cListPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [hasDistribution, setHasDistribution] = useState<Clients1cTriFilter>("any");
  const [hasOrders, setHasOrders] = useState<Clients1cTriFilter>("any");
  const [sort, setSort] = useState<Clients1cListSort>("name");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Clients1cListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { density, setDensity } = useOneCListDensity("clients-1c", "table");

  const canAccess = user ? canAccessClients1cForUser(user.role) : false;

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, city, region, hasDistribution, hasOrders, sort]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchClients1cList({
      search: debouncedQ,
      city: city.trim(),
      region: region.trim(),
      hasDistribution,
      hasOrders,
      sort,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        if (!("ok" in res) || !res.ok) {
          setError("message" in res ? res.message ?? "Не удалось загрузить клиентов." : "Ошибка");
          return;
        }
        setItems(res.items);
        setTotal(res.total);
        setRefreshedAt(res.refreshedAt);
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
  }, [canAccess, debouncedQ, city, region, hasDistribution, hasOrders, sort, page, reloadKey]);

  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  return (
    <OneCPageShell
      path="/clients-1c"
      title="Клиенты/ТТ 1С"
      subtitle={`${total.toLocaleString("ru-RU")} клиентов${refreshedAt ? ` · обновлено ${refreshedAt}` : ""}`}
      testId="page-clients-1c-list"
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHashPath("/clients-1c/overview")} data-testid="button-clients-1c-overview">
              Клиентская база 1С
            </Link>
          </Button>
          <Clients1cRefreshButton onRefreshed={() => setReloadKey((k) => k + 1)} />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <OneCSearchInput
            value={searchQ}
            onChange={setSearchQ}
            placeholder="Название, ИНН, город…"
            testId="input-clients-1c-search"
          />
          <OneCListDensityToggle value={density} onChange={setDensity} testIdPrefix="clients-1c" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="clients-1c-city">Город</Label>
            <input
              id="clients-1c-city"
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="clients-1c-region">Регион</Label>
            <input
              id="clients-1c-region"
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Дистрибуция</Label>
            <Select value={triSelectValue(hasDistribution)} onValueChange={(v) => setHasDistribution(v as Clients1cTriFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Все</SelectItem>
                <SelectItem value="true">С дистрибуцией</SelectItem>
                <SelectItem value="false">Без дистрибуции</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Заказы 90д</Label>
            <Select value={triSelectValue(hasOrders)} onValueChange={(v) => setHasOrders(v as Clients1cTriFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Все</SelectItem>
                <SelectItem value="true">С заказами</SelectItem>
                <SelectItem value="false">Без заказов</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Сортировка</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as Clients1cListSort)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">По названию</SelectItem>
                <SelectItem value="stores_desc">По числу ТТ</SelectItem>
                <SelectItem value="distribution_desc">По дистрибуции</SelectItem>
                <SelectItem value="orders_desc">По заказам</SelectItem>
                <SelectItem value="last_order_desc">По последнему заказу</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground" data-testid="empty-clients-1c">
          Клиенты не найдены
        </p>
      ) : density === "table" ? (
        <Clients1cListTable items={items} />
      ) : (
        <Clients1cListTable items={items} />
      )}

      <OneCPagination
        total={total}
        limit={PAGE_SIZE}
        offset={offset}
        onOffsetChange={(o) => setPage(Math.floor(o / PAGE_SIZE) + 1)}
        testIdPrefix="clients-1c"
      />
    </OneCPageShell>
  );
}
