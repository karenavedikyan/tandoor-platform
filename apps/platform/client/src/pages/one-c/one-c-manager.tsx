import { useEffect, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCManager } from "@/lib/one-c-showroom-api";
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
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";

export default function OneCManagerPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/manager/:id");
  const managerId = params?.id ?? "";
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<Awaited<ReturnType<typeof fetchOneCManager>>["user"] | null>(null);
  const [stores, setStores] = useState<Awaited<ReturnType<typeof fetchOneCManager>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, managerId]);

  useEffect(() => {
    if (!canAccess || !managerId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCManager(managerId, { q: debouncedQ, limit: ONE_C_PAGE_LIMIT, offset })
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
  }, [canAccess, managerId, debouncedQ, offset]);

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
      <OneCSearchInput
        value={searchQ}
        onChange={setSearchQ}
        placeholder="Адрес, юрлицо, ИНН…"
        testId="input-one-c-manager-search"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          <div className="rounded-md border">
            <Table data-testid="table-one-c-manager-stores">
              <TableHeader>
                <TableRow>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Юрлицо</TableHead>
                  <TableHead>ИНН</TableHead>
                  <TableHead>КПП</TableHead>
                  <TableHead>Город</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((row) => (
                  <TableRow key={row.id_1c} className="cursor-pointer" data-testid={`row-one-c-store-${row.id_1c}`}>
                    <TableCell>
                      <Link href={`/1c/store/${row.id_1c}`} className="text-primary hover:underline">
                        {dash(row.address)}
                      </Link>
                    </TableCell>
                    <TableCell>{dash(row.legal_short)}</TableCell>
                    <TableCell className="font-mono text-xs">{dash(row.inn)}</TableCell>
                    <TableCell className="font-mono text-xs">{dash(row.kpp)}</TableCell>
                    <TableCell>{dash(row.legal_city)}</TableCell>
                  </TableRow>
                ))}
                {stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Торговые точки не найдены
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
            testIdPrefix="one-c-manager"
          />
        </>
      )}
    </OneCPageShell>
  );
}
