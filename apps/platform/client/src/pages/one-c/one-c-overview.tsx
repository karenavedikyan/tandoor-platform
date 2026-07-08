import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCOverview } from "@/lib/one-c-showroom-api";
import { Card, CardContent } from "@/components/ui/card";
import {
  OneCLoadingBlock,
  OneCOverviewSubtitle,
  OneCPageShell,
  OneCRefreshStubButton,
  OneCStatCard,
} from "./one-c-ui";

export default function OneCOverviewPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchOneCOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCOverview()
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить обзор.");
          return;
        }
        setData(res);
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
  }, [canAccess]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  const visibility = data?.visibility ?? {
    showRops: false,
    showRms: false,
    showManagers: false,
    showTeamLink: false,
  };

  return (
    <OneCPageShell
      path="/1c"
      title="Витрина 1С"
      subtitle={<OneCOverviewSubtitle importedAt={data?.last_imported_at} />}
      testId="page-one-c-overview"
      actions={<OneCRefreshStubButton />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {visibility.showRops && data.rops != null ? (
              <OneCStatCard href="/1c/team" label="РОПы" count={data.rops} testId="card-one-c-rops" />
            ) : null}
            {visibility.showRms && data.rms != null ? (
              <OneCStatCard href="/1c/team" label="РМы" count={data.rms} testId="card-one-c-rms" />
            ) : null}
            {visibility.showManagers && data.managers != null ? (
              <OneCStatCard href="/1c/team" label="Менеджеры" count={data.managers} testId="card-one-c-managers" />
            ) : null}
            <OneCStatCard href="/1c/stores" label="ТТ (активные)" count={data.storesActive} testId="card-one-c-stores" />
            <OneCStatCard href="/1c/orders" label="Заказы 1С" count={data.ordersTotal} testId="card-one-c-orders" />
          </div>
          <Card>
            <CardContent className="flex flex-wrap gap-4 pt-6 text-sm">
              <Link href="/1c/stores" className="text-primary hover:underline">
                Торговые точки →
              </Link>
              <Link href="/1c/legals" className="text-primary hover:underline">
                Юрлица →
              </Link>
              <Link href="/1c/orders" className="text-primary hover:underline">
                Заказы 1С →
              </Link>
              {visibility.showTeamLink ? (
                <Link href="/1c/team" className="text-primary hover:underline">
                  Команда →
                </Link>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Данные из 1С</p>
              <p className="mt-1">
                Всего в 1С: {data.storesTotal.toLocaleString("ru-RU")} ТТ /{" "}
                {data.legalsTotal.toLocaleString("ru-RU")} юрлиц.
              </p>
              <p>
                По действующим сотрудникам ЛК: {data.storesActive.toLocaleString("ru-RU")} ТТ /{" "}
                {data.legalsActive.toLocaleString("ru-RU")} юрлиц.
              </p>
              {visibility.showTeamLink ? (
                <p className="mt-2">
                  <Link href="/1c/team" className="text-primary hover:underline">
                    Команда →
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </OneCPageShell>
  );
}
