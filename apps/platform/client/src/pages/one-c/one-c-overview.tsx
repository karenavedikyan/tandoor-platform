import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCOverview } from "@/lib/one-c-showroom-api";
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
  const [stores, setStores] = useState(0);
  const [users, setUsers] = useState(0);
  const [legals, setLegals] = useState(0);
  const [importedAt, setImportedAt] = useState<string | null>(null);
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
        setStores(res.stores);
        setUsers(res.users);
        setLegals(res.legals);
        setImportedAt(res.last_imported_at);
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

  return (
    <OneCPageShell
      path="/1c"
      title="Витрина 1С"
      subtitle={<OneCOverviewSubtitle importedAt={importedAt} />}
      testId="page-one-c-overview"
      actions={<OneCRefreshStubButton />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <OneCStatCard href="/1c/stores" label="Торговые точки" count={stores} testId="card-one-c-stores" />
          <OneCStatCard href="/1c/team" label="Менеджеры" count={users} testId="card-one-c-team" />
          <OneCStatCard href="/1c/legals" label="Юрлица" count={legals} testId="card-one-c-legals" />
        </div>
      )}
    </OneCPageShell>
  );
}
