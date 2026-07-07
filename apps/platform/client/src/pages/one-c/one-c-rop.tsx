import { useEffect, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCRop } from "@/lib/one-c-showroom-api";
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
  OneCLoadingBlock,
  OneCPageShell,
  OneCRefreshStubButton,
} from "./one-c-ui";

export default function OneCRopPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/rop/:id");
  const ropId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchOneCRop>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    if (!canAccess || !ropId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCRop(ropId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "РОП не найден.");
          setData(null);
          return;
        }
        setData(res);
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
  }, [canAccess, ropId]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!ropId) return <Redirect to="/1c/team" />;

  const card = data?.user;

  return (
    <OneCPageShell
      path={`/1c/rop/${ropId}`}
      breadcrumbLabels={{ rop: card?.fullName }}
      title={card?.fullName ?? "РОП"}
      subtitle={
        card ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span>{dash(card.phone)}</span>
            <span>{dash(card.email)}</span>
            <span>Команда: {dash(card.teamName)}</span>
            <Badge variant="secondary">{card.storeCount} ТТ</Badge>
            <Badge variant="outline">{card.legalCount} юрлиц</Badge>
          </span>
        ) : undefined
      }
      testId="page-one-c-rop"
      actions={<OneCRefreshStubButton />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : data ? (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">РМы команды</h2>
            <div className="rounded-md border">
              <Table data-testid="table-one-c-rop-rms">
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead className="text-right">ТТ</TableHead>
                    <TableHead className="text-right">Юрлиц</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rms.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <Link href={`/1c/rm/${row.userId}`} className="text-primary hover:underline">
                          {row.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{dash(row.phone)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.storeCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.legalCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Менеджеры команды</h2>
            <div className="rounded-md border">
              <Table data-testid="table-one-c-rop-managers">
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead className="text-right">ТТ</TableHead>
                    <TableHead className="text-right">Юрлиц</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.managers.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <Link href={`/1c/manager/${row.userId}`} className="text-primary hover:underline">
                          {row.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{dash(row.phone)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.storeCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.legalCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      ) : null}
    </OneCPageShell>
  );
}
