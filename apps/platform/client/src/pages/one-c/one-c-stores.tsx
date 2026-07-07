import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCStores } from "@/lib/one-c-showroom-api";
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
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";

export default function OneCStoresPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchOneCStores>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCStores({ q: debouncedQ, limit: ONE_C_PAGE_LIMIT, offset })
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
  }, [canAccess, debouncedQ, offset]);

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
      <OneCSearchInput
        value={searchQ}
        onChange={setSearchQ}
        placeholder="Адрес, менеджер, юрлицо, ИНН…"
        testId="input-one-c-stores-search"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          <div className="rounded-md border">
            <Table data-testid="table-one-c-stores">
              <TableHeader>
                <TableRow>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Менеджер</TableHead>
                  <TableHead>Юрлицо</TableHead>
                  <TableHead>ИНН</TableHead>
                  <TableHead>Город</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id_1c} className="cursor-pointer" data-testid={`row-one-c-store-${row.id_1c}`}>
                    <TableCell>
                      <Link href={`/1c/store/${row.id_1c}`} className="text-primary hover:underline">
                        {dash(row.address)}
                      </Link>
                    </TableCell>
                    <TableCell>{dash(row.manager_name)}</TableCell>
                    <TableCell>{dash(row.legal_name)}</TableCell>
                    <TableCell className="font-mono text-xs">{dash(row.legal_inn)}</TableCell>
                    <TableCell>{dash(row.legal_city)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Ничего не найдено
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
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
