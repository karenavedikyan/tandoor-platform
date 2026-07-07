import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCLegals } from "@/lib/one-c-showroom-api";
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
  formatPlanSum,
  ONE_C_PAGE_LIMIT,
  OneCLoadingBlock,
  OneCPagination,
  OneCOnlyActiveToggle,
  OneCPageShell,
  OneCRefreshStubButton,
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";

export default function OneCLegalsPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [onlyActive, setOnlyActive] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchOneCLegals>>["items"]>([]);
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
    void fetchOneCLegals({ q: debouncedQ, limit: ONE_C_PAGE_LIMIT, offset, onlyActive })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить юрлица.");
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
      path="/1c/legals"
      title="Юрлица"
      subtitle={`${total.toLocaleString("ru-RU")} записей из выгрузки 1С`}
      testId="page-one-c-legals"
      actions={<OneCRefreshStubButton />}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OneCSearchInput
          value={searchQ}
          onChange={setSearchQ}
          placeholder="Название, полное наименование, ИНН…"
          testId="input-one-c-legals-search"
        />
        <OneCOnlyActiveToggle
          checked={onlyActive}
          onCheckedChange={setOnlyActive}
          testId="toggle-one-c-legals-only-active"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          <div className="rounded-md border">
            <Table data-testid="table-one-c-legals">
              <TableHeader>
                <TableRow>
                  <TableHead>Краткое имя</TableHead>
                  <TableHead>Полное наименование</TableHead>
                  <TableHead>ИНН</TableHead>
                  <TableHead>КПП</TableHead>
                  <TableHead>Город</TableHead>
                  <TableHead>Ответственный</TableHead>
                  <TableHead className="text-right">План</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id_1c} className="cursor-pointer" data-testid={`row-one-c-legal-${row.id_1c}`}>
                    <TableCell>
                      <Link href={`/1c/legal/${row.id_1c}`} className="font-medium text-primary hover:underline">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate">{dash(row.legal_name)}</TableCell>
                    <TableCell className="font-mono text-xs">{dash(row.inn)}</TableCell>
                    <TableCell className="font-mono text-xs">{dash(row.kpp)}</TableCell>
                    <TableCell>{dash(row.city)}</TableCell>
                    <TableCell>{dash(row.responsible_manager_name)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPlanSum(row.plan_sum)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
            testIdPrefix="one-c-legals"
          />
        </>
      )}
    </OneCPageShell>
  );
}
