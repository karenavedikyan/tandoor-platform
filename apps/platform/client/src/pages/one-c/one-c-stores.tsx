import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCStores } from "@/lib/one-c-showroom-api";
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
  OneCOnlyActiveToggle,
  OneCPageShell,
  OneCRefreshStubButton,
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";

export default function OneCStoresPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [onlyActive, setOnlyActive] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchOneCStores>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, onlyActive]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCStores({ q: debouncedQ, limit: ONE_C_PAGE_LIMIT, offset, onlyActive })
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
  }, [canAccess, debouncedQ, offset, onlyActive]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OneCSearchInput
          value={searchQ}
          onChange={setSearchQ}
          placeholder="Адрес, менеджер, юрлицо, ИНН, холдинг…"
          testId="input-one-c-stores-search"
        />
        <OneCOnlyActiveToggle
          checked={onlyActive}
          onCheckedChange={setOnlyActive}
          testId="toggle-one-c-stores-only-active"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table data-testid="table-one-c-stores">
              <TableHeader>
                <TableRow>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Холдинг</TableHead>
                  <TableHead>Юрлицо</TableHead>
                  <TableHead>Тип клиента</TableHead>
                  <TableHead>Город</TableHead>
                  <TableHead>РМ</TableHead>
                  <TableHead>Менеджер (ТТ)</TableHead>
                  <TableHead>Заполненность</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>ИНН</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const fillPercent =
                    row.distribution_total > 0
                      ? Math.round((row.distribution_filled / row.distribution_total) * 100)
                      : 0;
                  return (
                    <TableRow key={row.id_1c} className="cursor-pointer" data-testid={`row-one-c-store-${row.id_1c}`}>
                      <TableCell>
                        <Link href={`/1c/store/${row.id_1c}`} className="text-primary hover:underline">
                          {dash(row.address)}
                        </Link>
                      </TableCell>
                      <TableCell
                        className="max-w-[10rem] truncate"
                        title={row.legal_parent_name ?? undefined}
                        data-testid={`cell-one-c-store-${row.id_1c}-parent`}
                      >
                        {dash(row.legal_parent_name)}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">{dash(row.legal_name)}</TableCell>
                      <TableCell data-testid={`cell-one-c-store-${row.id_1c}-client-type`}>
                        {row.legal_client_type?.trim() ? (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {row.legal_client_type}
                          </Badge>
                        ) : (
                          dash(row.legal_client_type)
                        )}
                      </TableCell>
                      <TableCell>{dash(row.legal_city)}</TableCell>
                      <TableCell data-testid={`cell-one-c-store-${row.id_1c}-rm`}>
                        {dash(row.legal_regional_manager_name)}
                      </TableCell>
                      <TableCell>{dash(row.manager_name)}</TableCell>
                      <TableCell data-testid={`cell-one-c-store-${row.id_1c}-fill`}>
                        {row.distribution_total > 0 ? (
                          <div className="flex min-w-[4.5rem] flex-col gap-1">
                            <span className="text-xs font-medium tabular-nums">
                              {row.distribution_filled}/{row.distribution_total}
                            </span>
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${fillPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-one-c-store-${row.id_1c}-status`}>
                        {row.status?.trim() ? (
                          <Badge variant="outline">{dash(row.status)}</Badge>
                        ) : (
                          dash(row.status)
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{dash(row.legal_inn)}</TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
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
