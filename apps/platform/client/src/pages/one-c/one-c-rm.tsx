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
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";

export default function OneCRmPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/rm/:id");
  const rmId = params?.id ?? "";
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Awaited<ReturnType<typeof fetchOneCRm>>["user"] | null>(null);
  const [managers, setManagers] = useState<Awaited<ReturnType<typeof fetchOneCRm>>["managers"]>([]);
  const [stores, setStores] = useState<Awaited<ReturnType<typeof fetchOneCRm>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [ropName, setRopName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, rmId]);

  useEffect(() => {
    if (!canAccess || !rmId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCRm(rmId, { q: debouncedQ, limit: ONE_C_PAGE_LIMIT, offset })
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
  }, [canAccess, rmId, debouncedQ, offset]);

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
            <h2 className="mb-3 text-lg font-semibold">Все ТТ РМа</h2>
            <OneCSearchInput
              value={searchQ}
              onChange={setSearchQ}
              placeholder="Адрес, юрлицо, ИНН…"
              testId="input-one-c-rm-search"
            />
            <div className="mt-3 rounded-md border">
              <Table data-testid="table-one-c-rm-stores">
                <TableHeader>
                  <TableRow>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Юрлицо</TableHead>
                    <TableHead>ИНН</TableHead>
                    <TableHead>Город</TableHead>
                    <TableHead>Ответственный</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((row) => (
                    <TableRow key={row.id_1c}>
                      <TableCell>
                        <Link href={`/1c/store/${row.id_1c}`} className="text-primary hover:underline">
                          {dash(row.address)}
                        </Link>
                      </TableCell>
                      <TableCell>{dash(row.legal_short)}</TableCell>
                      <TableCell className="font-mono text-xs">{dash(row.inn)}</TableCell>
                      <TableCell>{dash(row.legal_city)}</TableCell>
                      <TableCell>{dash(row.resp)}</TableCell>
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
              testIdPrefix="one-c-rm"
            />
          </section>
        </div>
      )}
    </OneCPageShell>
  );
}
