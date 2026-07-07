import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCTeam } from "@/lib/one-c-showroom-api";
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
  OneCLoadingBlock,
  OneCPageShell,
  OneCRefreshStubButton,
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";

export default function OneCTeamPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchOneCTeam>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCTeam(debouncedQ)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить команду.");
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
  }, [canAccess, debouncedQ]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  return (
    <OneCPageShell
      path="/1c/team"
      title="Менеджеры"
      subtitle={`${total.toLocaleString("ru-RU")} сотрудников из выгрузки 1С`}
      testId="page-one-c-team"
      actions={<OneCRefreshStubButton />}
    >
      <OneCSearchInput
        value={searchQ}
        onChange={setSearchQ}
        placeholder="Поиск по ФИО…"
        testId="input-one-c-team-search"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <div className="rounded-md border">
          <Table data-testid="table-one-c-team">
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead className="text-right">Кол-во ТТ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id_1c} className="cursor-pointer" data-testid={`row-one-c-manager-${row.id_1c}`}>
                  <TableCell>
                    <Link href={`/1c/manager/${row.id_1c}`} className="font-medium text-primary hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{dash(row.phone)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.store_count}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Ничего не найдено
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </OneCPageShell>
  );
}
