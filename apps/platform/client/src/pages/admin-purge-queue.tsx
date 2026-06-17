/**
 * /admin/purge-queue — корзина админа (Промт 386).
 */

import { useCallback, useState, type ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { userHas } from "@/lib/auth-rbac";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import {
  ADMIN_PURGE_QUEUE_QUERY_KEY,
  fetchAdminPurgeQueue,
  type AdminPurgeQueueDealer,
  type AdminPurgeQueueTradePoint,
} from "@/lib/admin-purge-queue-api";
import { purgeDealerStrict, restoreDealerStrict } from "@/lib/dealer-overrides-api";
import { purgeTradePointStrict, restoreTradePointStrict } from "@/lib/trade-point-overrides-api";
import { invalidateMyDealerScope } from "@/lib/dealers-my-scope-api";
import NotFound from "@/pages/not-found";

type ConfirmKind =
  | { kind: "purge-dealer"; dealerId: string; name: string }
  | { kind: "purge-tp"; tpId: string; name: string }
  | { kind: "restore-dealer"; dealerId: string; name: string }
  | { kind: "restore-tp"; tpId: string; name: string };

function displayActor(name: string | null | undefined): string {
  return name?.trim() || "—";
}

export function AdminPurgeQueuePage(): ReactElement {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"clients" | "tps">("clients");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  const canAccess = Boolean(user && userHas(user.role, "admin.purge_dealer"));

  const queueQ = useQuery({
    queryKey: ADMIN_PURGE_QUEUE_QUERY_KEY,
    queryFn: fetchAdminPurgeQueue,
    enabled: canAccess,
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    invalidateMyDealerScope(qc);
    await qc.invalidateQueries({ queryKey: ADMIN_PURGE_QUEUE_QUERY_KEY });
    void queueQ.refetch();
  }, [qc, queueQ]);

  const onPurgeDealer = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`purge-dealer:${dealerId}`);
    const r = await purgeDealerStrict(dealerId);
    setBusy(null);
    if (r.ok) {
      toast({ title: "Клиент удалён навсегда (soft-delete)" });
      await refresh();
    } else {
      toast({ title: r.message ?? "Не удалось удалить", variant: "destructive" });
    }
  };

  const onPurgeTp = async (tpId: string): Promise<void> => {
    if (busy) return;
    setBusy(`purge-tp:${tpId}`);
    const r = await purgeTradePointStrict(tpId);
    setBusy(null);
    if (r.ok) {
      toast({ title: "Торговая точка удалена навсегда (soft-delete)" });
      await refresh();
    } else {
      toast({ title: r.message ?? "Не удалось удалить", variant: "destructive" });
    }
  };

  const onRestoreDealer = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`restore-dealer:${dealerId}`);
    const r = await restoreDealerStrict(dealerId, "employee_trash");
    setBusy(null);
    if (r.ok) {
      toast({ title: "Клиент возвращён в корзину сотрудника" });
      await refresh();
    } else {
      toast({ title: r.message ?? "Не удалось вернуть", variant: "destructive" });
    }
  };

  const onRestoreTp = async (tpId: string): Promise<void> => {
    if (busy) return;
    setBusy(`restore-tp:${tpId}`);
    const r = await restoreTradePointStrict(tpId, "employee_trash");
    setBusy(null);
    if (r.ok) {
      toast({ title: "Торговая точка возвращена в корзину сотрудника" });
      await refresh();
    } else {
      toast({ title: r.message ?? "Не удалось вернуть", variant: "destructive" });
    }
  };

  if (!canAccess) return <NotFound />;

  const dealers = queueQ.data?.dealers ?? [];
  const tradePoints = queueQ.data?.trade_points ?? [];

  const confirmTitle = (() => {
    if (!confirm) return "";
    switch (confirm.kind) {
      case "purge-dealer":
      case "purge-tp":
        return "Удалить навсегда?";
      case "restore-dealer":
      case "restore-tp":
        return "Вернуть в корзину сотрудника?";
      default:
        return "Подтвердите действие";
    }
  })();

  const confirmDescription = (() => {
    if (!confirm) return "";
    switch (confirm.kind) {
      case "purge-dealer":
        return `Клиент «${confirm.name}» станет невидимым везде. Это действие можно откатить только обращением к разработке. Продолжить?`;
      case "purge-tp":
        return `Торговая точка «${confirm.name}» станет невидимой везде. Это действие можно откатить только обращением к разработке. Продолжить?`;
      case "restore-dealer":
        return `Клиент «${confirm.name}» вернётся в корзину сотрудника.`;
      case "restore-tp":
        return `Торговая точка «${confirm.name}» вернётся в корзину сотрудника.`;
      default:
        return "";
    }
  })();

  const onConfirm = () => {
    if (!confirm) return;
    switch (confirm.kind) {
      case "purge-dealer":
        void onPurgeDealer(confirm.dealerId);
        break;
      case "purge-tp":
        void onPurgeTp(confirm.tpId);
        break;
      case "restore-dealer":
        void onRestoreDealer(confirm.dealerId);
        break;
      case "restore-tp":
        void onRestoreTp(confirm.tpId);
        break;
    }
    setConfirm(null);
  };

  const renderDealerRow = (row: AdminPurgeQueueDealer) => {
    const name = row.name?.trim() || row.external_key || row.id;
    return (
      <Card key={row.id} className="rounded-xl border border-border bg-card" data-testid={`card-admin-purge-dealer-${row.id}`}>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="text-[11px] text-muted-foreground">
              код {row.release_code ?? row.external_key ?? "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              в корзину: {displayActor(row.trashed_by_name)}
              {row.trashed_at ? ` · ${formatDisplayDateTime(row.trashed_at)}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              запросил удаление: {displayActor(row.purge_requested_by_name)}
              {row.purge_requested_at ? ` · ${formatDisplayDateTime(row.purge_requested_at)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setConfirm({ kind: "restore-dealer", dealerId: row.id, name })}
            >
              Вернуть
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy === `purge-dealer:${row.id}`}
              onClick={() => setConfirm({ kind: "purge-dealer", dealerId: row.id, name })}
              data-testid={`button-admin-purge-dealer-${row.id}`}
            >
              Удалить навсегда
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTpRow = (row: AdminPurgeQueueTradePoint) => {
    const tpId = String(row.tp_id);
    const name = tpId;
    return (
      <Card key={tpId} className="rounded-xl border border-border bg-card" data-testid={`card-admin-purge-tp-${tpId}`}>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{tpId}</p>
            <p className="text-[11px] text-muted-foreground">клиент: {row.dealer_id ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">
              в корзину: {displayActor(row.trashed_by_name)}
              {row.trashed_at ? ` · ${formatDisplayDateTime(row.trashed_at)}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              запросил удаление: {displayActor(row.purge_requested_by_name)}
              {row.purge_requested_at ? ` · ${formatDisplayDateTime(row.purge_requested_at)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setConfirm({ kind: "restore-tp", tpId, name })}
            >
              Вернуть
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy === `purge-tp:${tpId}`}
              onClick={() => setConfirm({ kind: "purge-tp", tpId, name })}
            >
              Удалить навсегда
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-20" data-testid="page-admin-purge-queue">
      <BackNav breadcrumbs={breadcrumbsFor("/admin/purge-queue")} fallbackHref="/dealer-base" />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          <Trash2 className="h-5 w-5 text-primary" aria-hidden />
          Корзина админа
        </h1>
        <p className="text-xs text-muted-foreground">
          Записи, ожидающие окончательного удаления после запроса сотрудников.
        </p>
      </div>

      {queueQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : queueQ.isError ? (
        <p className="text-sm text-destructive">Не удалось загрузить очередь удаления.</p>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "clients" | "tps")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clients" className="text-xs" data-testid="tab-admin-purge-clients">
              Клиенты ({dealers.length})
            </TabsTrigger>
            <TabsTrigger value="tps" className="text-xs" data-testid="tab-admin-purge-tps">
              Торговые точки ({tradePoints.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="clients" className="mt-3 space-y-2">
            {dealers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Очередь пуста</p>
            ) : (
              dealers.map(renderDealerRow)
            )}
          </TabsContent>
          <TabsContent value="tps" className="mt-3 space-y-2">
            {tradePoints.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Очередь пуста</p>
            ) : (
              tradePoints.map(renderTpRow)
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant={confirm?.kind === "purge-dealer" || confirm?.kind === "purge-tp" ? "destructive" : "default"}
                onClick={onConfirm}
              >
                {confirm?.kind === "purge-dealer" || confirm?.kind === "purge-tp" ? "Удалить навсегда" : "Вернуть"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminPurgeQueuePage;
