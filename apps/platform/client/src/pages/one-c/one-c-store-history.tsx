import { useEffect, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCStoreHistory } from "@/lib/one-c-showroom-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import {
  ONE_C_PAGE_LIMIT,
  OneCLoadingBlock,
  OneCPageShell,
  OneCPagination,
} from "./one-c-ui";

export default function OneCStoreHistoryPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/store/:id/history");
  const storeId = params?.id ?? "";
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchOneCStoreHistory>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    if (!canAccess || !storeId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCStoreHistory(storeId, { limit: ONE_C_PAGE_LIMIT, offset })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить историю.");
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
  }, [canAccess, storeId, offset]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!storeId) return <Redirect to="/1c/stores" />;

  return (
    <OneCPageShell
      path={`/1c/store/${storeId}/history`}
      breadcrumbLabels={{ tradePoint: "История" }}
      title="История дистрибуции"
      subtitle={
        <Link href={`/1c/store/${storeId}`} className="text-primary hover:underline">
          ← К карточке торговой точки
        </Link>
      }
      testId="page-one-c-store-history"
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          <ul className="space-y-2" data-testid="list-one-c-store-history">
            {items.map((h) => (
              <li key={h.id} className="rounded-md border px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{h.action}</span>
                  <span className="text-muted-foreground">{formatDisplayDateTime(h.createdAt)}</span>
                </div>
                <p className="text-muted-foreground">{h.actorFullName ?? "—"}</p>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-xs">
                  {JSON.stringify(h.payload, null, 2)}
                </pre>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="py-8 text-center text-muted-foreground">История пуста</li>
            ) : null}
          </ul>
          <OneCPagination
            total={total}
            limit={ONE_C_PAGE_LIMIT}
            offset={offset}
            onOffsetChange={setOffset}
            testIdPrefix="one-c-store-history"
          />
        </>
      )}
    </OneCPageShell>
  );
}
