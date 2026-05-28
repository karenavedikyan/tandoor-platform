/**
 * /trash — Корзина клиентов и торговых точек (Промт 45).
 *
 * Иерархия видимости — за счёт `useClientBaseTeamActualization()`:
 *   - admin/director (`sales_director` плане) → видят весь sales-merge;
 *   - rop (`team_lead`) → видят свою команду + себя;
 *   - manager (`sales_manager`) → видят только свой state.
 *
 * Доступные действия:
 *   - «Восстановить» — все роли. Для ТТ блокируется, если клиент-владелец сам в корзине.
 *   - «Удалить навсегда» — только admin / director.
 *   - «Запустить очистку сейчас» — только admin: POST /api/cron/purge-trash.
 */

import { useMemo, useState, type ReactElement } from "react";
import { getReleaseClients } from "@/lib/release-client-data";
import type { ArchivedDealerInfo } from "@/lib/client-base-actualization-state";
import { Link } from "wouter";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientAvatar } from "@/components/ui/client-avatar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import {
  mergeActualizationState,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "@/lib/client-base-actualization-state";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-display-date";
import { buildHashPath } from "@/lib/hash-route-utils";

type ConfirmKind =
  | { kind: "force-delete-dealer"; dealerId: string; name: string }
  | { kind: "force-delete-tp"; tradePointId: string; name: string }
  | { kind: "restore-all-archived"; count: number };

function compareByExpires(a: TrashedDealerInfo | TrashedTradePointInfo, b: TrashedDealerInfo | TrashedTradePointInfo): number {
  return Date.parse(a.expiresAt) - Date.parse(b.expiresAt);
}

export function TrashBinPage(): ReactElement {
  const { user } = useAuthUser();
  const actx = useClientBaseActualization();
  const teamPlane = useClientBaseTeamActualization();
  const [tab, setTab] = useState<"clients" | "tps">("clients");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmFD, setConfirmFD] = useState<ConfirmKind | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);

  const canForceDelete = user?.role === "admin" || user?.role === "director";
  const canRunPurge = user?.role === "admin";

  const stateForRead = teamPlane.mergedState;
  const trashedDealers = useMemo(() => {
    const map = stateForRead.trashedDealersById ?? {};
    return Object.values(map).sort(compareByExpires);
  }, [stateForRead.trashedDealersById]);
  const trashedTps = useMemo(() => {
    const map = stateForRead.trashedTradePointsById ?? {};
    return Object.values(map).sort(compareByExpires);
  }, [stateForRead.trashedTradePointsById]);

  const archivedDealers = useMemo(() => {
    const map = stateForRead.archivedDealersById ?? {};
    return Object.values(map).sort((a, b) => Date.parse(b.archivedAt) - Date.parse(a.archivedAt));
  }, [stateForRead.archivedDealersById]);

  const releaseNameByDealerId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of getReleaseClients()) {
      const name = c.name?.trim();
      if (name) m.set(c.id, name);
    }
    return m;
  }, []);

  const fieldName = (fields: Record<string, unknown> | undefined): string => {
    const n = fields?.name;
    return typeof n === "string" ? n.trim() : "";
  };

  const resolveArchivedDealerName = (dealerId: string): string => {
    const manual = stateForRead.manuallyCreatedDealersById?.[dealerId];
    const manualName = fieldName(manual?.fields);
    if (manualName) return manualName;
    const override = stateForRead.dealerOverridesById?.[dealerId];
    const overrideName = fieldName(override?.fields);
    if (overrideName) return overrideName;
    return releaseNameByDealerId.get(dealerId) ?? dealerId;
  };

  const earliestExpires = useMemo(() => {
    const all = [...trashedDealers, ...trashedTps];
    if (all.length === 0) return null;
    const ms = all
      .map((t) => Date.parse(t.expiresAt))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0];
    return ms ? new Date(ms).toISOString() : null;
  }, [trashedDealers, trashedTps]);

  const onRestoreDealer = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`restore-dealer:${dealerId}`);
    const r = await actx.persist(
      (prev) => {
        const next = { ...prev.trashedDealersById };
        delete next[dealerId];
        return mergeActualizationState(prev, { trashedDealersById: next });
      },
      { unTrash: { dealers: [dealerId] } },
    );
    setBusy(null);
    if (r.success) {
      toast({ title: "Клиент восстановлен в рабочую базу" });
      void teamPlane.refresh();
    } else {
      toast({ title: "Не удалось восстановить", variant: "destructive" });
    }
  };

  const onRestoreTp = async (tp: TrashedTradePointInfo): Promise<void> => {
    if (busy) return;
    // Защита: если клиент-владелец сам в корзине — не восстанавливаем ТТ висящей.
    if (actx.state.trashedDealersById?.[tp.dealerId] || stateForRead.trashedDealersById?.[tp.dealerId]) {
      toast({
        title: "Сначала восстановите клиента",
        description: "Клиент-владелец этой точки находится в корзине.",
        variant: "destructive",
      });
      return;
    }
    setBusy(`restore-tp:${tp.tradePointId}`);
    const r = await actx.persist(
      (prev) => {
        const next = { ...prev.trashedTradePointsById };
        delete next[tp.tradePointId];
        return mergeActualizationState(prev, { trashedTradePointsById: next });
      },
      { unTrash: { tradePoints: [tp.tradePointId] } },
    );
    setBusy(null);
    if (r.success) {
      toast({ title: "Торговая точка восстановлена" });
      void teamPlane.refresh();
    } else {
      toast({ title: "Не удалось восстановить", variant: "destructive" });
    }
  };

  const onForceDeleteDealer = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`force-dealer:${dealerId}`);
    const r = await actx.persist(
      (prev) => {
        const next = { ...prev.trashedDealersById };
        delete next[dealerId];
        return mergeActualizationState(prev, { trashedDealersById: next });
      },
      { unTrash: { dealers: [dealerId] } },
    );
    setBusy(null);
    if (r.success) {
      toast({ title: "Клиент удалён окончательно" });
      void teamPlane.refresh();
    } else {
      toast({ title: "Не удалось удалить", variant: "destructive" });
    }
  };

  const onForceDeleteTp = async (tradePointId: string): Promise<void> => {
    if (busy) return;
    setBusy(`force-tp:${tradePointId}`);
    const r = await actx.persist(
      (prev) => {
        const next = { ...prev.trashedTradePointsById };
        delete next[tradePointId];
        return mergeActualizationState(prev, { trashedTradePointsById: next });
      },
      { unTrash: { tradePoints: [tradePointId] } },
    );
    setBusy(null);
    if (r.success) {
      toast({ title: "Торговая точка удалена окончательно" });
      void teamPlane.refresh();
    } else {
      toast({ title: "Не удалось удалить", variant: "destructive" });
    }
  };

  const onRestoreAllArchived = async (count: number): Promise<void> => {
    if (busy || count === 0) return;
    setBusy("restore-all-archived");
    try {
      const r = await actx.persist((prev) => mergeActualizationState(prev, { archivedDealersById: {} }));
      if (r.success) {
        toast({ title: `Восстановлено ${count} клиентов. Они снова в активной базе.` });
        void teamPlane.refresh();
      } else {
        toast({ title: "Не удалось восстановить", variant: "destructive" });
      }
    } finally {
      setBusy(null);
    }
  };

  const onRestoreOneArchived = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`restore-archived:${dealerId}`);
    try {
      const r = await actx.persist((prev) => {
        const next = { ...prev.archivedDealersById };
        delete next[dealerId];
        return mergeActualizationState(prev, { archivedDealersById: next });
      });
      if (r.success) {
        toast({ title: "Клиент восстановлен в активную базу" });
        void teamPlane.refresh();
      } else {
        toast({ title: "Не удалось восстановить", variant: "destructive" });
      }
    } finally {
      setBusy(null);
    }
  };

  const onRunPurge = async (): Promise<void> => {
    if (purgeBusy) return;
    setPurgeBusy(true);
    try {
      const res = await fetch("/api/cron/purge-trash", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success?: boolean;
        purgedDealers?: number;
        purgedTradePoints?: number;
        message?: string;
      };
      if (!res.ok || json.success !== true) {
        toast({
          title: "Не удалось запустить очистку",
          description: json.message ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Очистка выполнена",
          description: `Клиентов удалено: ${json.purgedDealers ?? 0}, ТТ: ${json.purgedTradePoints ?? 0}`,
        });
        void teamPlane.refresh();
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "Сетевая ошибка";
      toast({ title: "Не удалось запустить очистку", description: m, variant: "destructive" });
    } finally {
      setPurgeBusy(false);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden pb-20" data-testid="page-trash-bin">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <Trash2 className="h-5 w-5 text-primary" aria-hidden />
            Корзина
          </h1>
          <p className="text-xs text-muted-foreground">
            Удалённые клиенты и ТТ. Хранятся 14 дней, затем удаляются окончательно.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHashPath("/dealer-base")}>К рабочей базе</Link>
          </Button>
          {canRunPurge ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={purgeBusy}
              onClick={() => void onRunPurge()}
              data-testid="button-trash-purge-now"
            >
              {purgeBusy ? "Очистка…" : "Запустить очистку сейчас"}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="rounded-xl border border-border bg-card text-card-foreground">
        <CardContent className="space-y-1 p-3 text-sm">
          <p className="text-foreground">
            В корзине: <span className="font-semibold tabular-nums">{trashedDealers.length}</span> клиентов,{" "}
            <span className="font-semibold tabular-nums">{trashedTps.length}</span> ТТ.
          </p>
          {earliestExpires ? (
            <p className="text-[11px] text-muted-foreground">
              Ближайшее окончательное удаление: {formatDisplayDate(earliestExpires)}.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">В корзине пусто.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card text-card-foreground" data-testid="section-trash-archived-clients">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-base font-semibold text-foreground">Архив клиентов</h2>
          <p className="text-sm text-muted-foreground">
            В архиве сейчас {archivedDealers.length} клиентов. Архивные клиенты не отображаются в активной базе. Если
            архив получился случайно (массовое архивирование, миграция и т.п.) — нажмите «Восстановить всех», чтобы все
            клиенты вернулись в активную базу.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={archivedDealers.length === 0 || busy === "restore-all-archived"}
            onClick={() => setConfirmFD({ kind: "restore-all-archived", count: archivedDealers.length })}
            data-testid="button-trash-restore-all-archived"
          >
            {busy === "restore-all-archived"
              ? "Восстановление…"
              : `Восстановить всех (${archivedDealers.length})`}
          </Button>
          {archivedDealers.length > 0 ? (
            <details className="group rounded-lg border border-border/80 bg-muted/10">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                Список архивных клиентов ({archivedDealers.length})
              </summary>
              <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto border-t border-border/60 p-3">
                {archivedDealers.slice(0, 200).map((t: ArchivedDealerInfo) => (
                  <li
                    key={t.dealerId}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-2 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={`row-trash-archived-${t.dealerId}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{resolveArchivedDealerName(t.dealerId)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.dealerId} · архивировал {t.archivedByName} · {formatDisplayDateTime(t.archivedAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === `restore-archived:${t.dealerId}`}
                      onClick={() => void onRestoreOneArchived(t.dealerId)}
                      data-testid={`button-trash-archived-restore-${t.dealerId}`}
                    >
                      Восстановить
                    </Button>
                  </li>
                ))}
                {archivedDealers.length > 200 ? (
                  <li className="text-center text-xs text-muted-foreground">и ещё {archivedDealers.length - 200}</li>
                ) : null}
              </ul>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "clients" | "tps")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clients" className="text-xs" data-testid="tab-trash-clients">
            Клиенты ({trashedDealers.length})
          </TabsTrigger>
          <TabsTrigger value="tps" className="text-xs" data-testid="tab-trash-tps">
            Торговые точки ({trashedTps.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-3 space-y-2">
          {trashedDealers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              В корзине пусто. Удалённые клиенты будут появляться здесь.
            </p>
          ) : (
            trashedDealers.map((t) => (
              <Card
                key={t.dealerId}
                className="rounded-xl border border-border bg-card text-card-foreground"
                data-testid={`card-trash-dealer-${t.dealerId}`}
              >
                <CardContent className="flex items-start justify-between gap-2 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ClientAvatar size={36} shape="circle" name={t.snapshot.fullName ?? "—"} seed={t.dealerId} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{t.snapshot.fullName ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.snapshot.city ?? "—"} · ИНН {t.snapshot.inn ?? "—"} · код {t.snapshot.dealerCode ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        удалил {t.trashedByName} · {formatDisplayDateTime(t.trashedAt)} · истекает{" "}
                        {formatDisplayDate(t.expiresAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === `restore-dealer:${t.dealerId}`}
                      onClick={() => void onRestoreDealer(t.dealerId)}
                      data-testid={`button-trash-dealer-restore-${t.dealerId}`}
                    >
                      Восстановить
                    </Button>
                    {canForceDelete ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy === `force-dealer:${t.dealerId}`}
                        onClick={() =>
                          setConfirmFD({
                            kind: "force-delete-dealer",
                            dealerId: t.dealerId,
                            name: t.snapshot.fullName ?? t.dealerId,
                          })
                        }
                        data-testid={`button-trash-dealer-force-delete-${t.dealerId}`}
                      >
                        Удалить навсегда
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="tps" className="mt-3 space-y-2">
          {trashedTps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              В корзине пусто. Удалённые торговые точки будут появляться здесь.
            </p>
          ) : (
            trashedTps.map((t) => (
              <Card
                key={t.tradePointId}
                className="rounded-xl border border-border bg-card text-card-foreground"
                data-testid={`card-trash-tp-${t.tradePointId}`}
              >
                <CardContent className="flex items-start justify-between gap-2 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ClientAvatar size={32} shape="circle" name={t.snapshot.dealerFullName ?? t.snapshot.name ?? "—"} seed={t.dealerId} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{t.snapshot.name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.snapshot.city ?? "—"}
                        {t.snapshot.address ? ` · ${t.snapshot.address}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        клиент: {t.snapshot.dealerFullName ?? t.dealerId}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        удалил {t.trashedByName} · {formatDisplayDateTime(t.trashedAt)} · истекает{" "}
                        {formatDisplayDate(t.expiresAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === `restore-tp:${t.tradePointId}`}
                      onClick={() => void onRestoreTp(t)}
                      data-testid={`button-trash-tp-restore-${t.tradePointId}`}
                    >
                      Восстановить
                    </Button>
                    {canForceDelete ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy === `force-tp:${t.tradePointId}`}
                        onClick={() =>
                          setConfirmFD({
                            kind: "force-delete-tp",
                            tradePointId: t.tradePointId,
                            name: t.snapshot.name ?? t.tradePointId,
                          })
                        }
                        data-testid={`button-trash-tp-force-delete-${t.tradePointId}`}
                      >
                        Удалить навсегда
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmFD !== null} onOpenChange={(o) => !o && setConfirmFD(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmFD?.kind === "restore-all-archived"
                ? `Восстановить ${confirmFD.count} клиентов из архива?`
                : "Удалить навсегда?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmFD?.kind === "force-delete-dealer"
                ? `Клиент «${confirmFD.name}» будет удалён окончательно. Восстановить будет невозможно.`
                : confirmFD?.kind === "force-delete-tp"
                  ? `Торговая точка «${confirmFD.name}» будет удалена окончательно. Восстановить будет невозможно.`
                  : confirmFD?.kind === "restore-all-archived"
                    ? `Все клиенты вернутся в активную базу. Это действие не удаляет данные карточек, контакты, изменения — только снимает пометку «архив». Восстановить?`
                    : ""}
            </AlertDialogDescription>
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
                variant={confirmFD?.kind === "restore-all-archived" ? "default" : "destructive"}
                onClick={() => {
                  if (confirmFD?.kind === "force-delete-dealer") void onForceDeleteDealer(confirmFD.dealerId);
                  else if (confirmFD?.kind === "force-delete-tp") void onForceDeleteTp(confirmFD.tradePointId);
                  else if (confirmFD?.kind === "restore-all-archived") void onRestoreAllArchived(confirmFD.count);
                  setConfirmFD(null);
                }}
              >
                {confirmFD?.kind === "restore-all-archived" ? "Восстановить всех" : "Удалить навсегда"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TrashBinPage;
