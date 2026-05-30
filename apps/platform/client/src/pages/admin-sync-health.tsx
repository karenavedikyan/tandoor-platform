/**
 * /admin/sync-health — диагностика overrides API (Промт 113.1).
 */

import { useMemo, useState, type ReactElement } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { clearOverridesErrorLog, OVERRIDES_ERROR_LOG_KEY, readOverridesErrorLog } from "@/lib/overrides-api-result";
import {
  listPendingSyncItems,
  OVERRIDES_PENDING_STORAGE_KEY,
  pendingSyncCount,
} from "@/lib/overrides-pending-sync";
import {
  OVERRIDES_BACKFILL_CONFLICTS_KEY,
  OVERRIDES_BACKFILL_DONE_KEY,
  readBackfillConflicts,
} from "@/lib/overrides-backfill-on-login";

export default function AdminSyncHealthPage(): ReactElement {
  const { user } = useCurrentUser();
  const [, bump] = useState(0);
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";
  const isAdmin = user?.role === "admin";

  const pending = useMemo(() => listPendingSyncItems(), [bump]);
  const errors = useMemo(() => readOverridesErrorLog(), [bump]);
  const conflicts = useMemo(() => readBackfillConflicts(), [bump]);

  if (!user) return <div className="p-6">Загрузка…</div>;
  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Доступ только для администратора.</div>;
  }

  const backfillDone = typeof localStorage !== "undefined" && localStorage.getItem(OVERRIDES_BACKFILL_DONE_KEY) === "1";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6" data-testid="page-admin-sync-health">
      <div>
        <h1 className="text-2xl font-semibold text-[#222631]">Состояние синхронизации overrides</h1>
        <p className="mt-1 text-sm text-[#8F96B0]">
          Очередь отложенных записей, журнал ошибок API и конфликты бэкфила (локальное хранилище браузера).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Сводка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Элементов в очереди: <strong>{pendingSyncCount()}</strong>
          </p>
          <p>
            Бэкфил выполнен: <strong>{backfillDone ? "да" : "нет"}</strong> ({OVERRIDES_BACKFILL_DONE_KEY})
          </p>
          <p>
            Конфликтов бэкфила: <strong>{conflicts.length}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Ключи: {OVERRIDES_PENDING_STORAGE_KEY}, {OVERRIDES_ERROR_LOG_KEY}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Последние 50 ошибок overrides API</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              clearOverridesErrorLog();
              bump((n) => n + 1);
            }}
          >
            Очистить
          </Button>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ошибок нет.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
              {errors.map((e, i) => (
                <li key={`${e.at}-${i}`} className="rounded border border-border/60 bg-muted/30 p-2">
                  <div className="font-medium">{e.at}</div>
                  <div>
                    {e.scope} · {e.action} · {e.status ?? "—"} {e.network ? "· network" : ""}
                  </div>
                  <div className="text-muted-foreground">{e.message}</div>
                  {e.entityId ? <div>entity: {e.entityId}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Очередь pendingSyncStore</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Очередь пуста.</p>
          ) : (
            <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">{JSON.stringify(pending, null, 2)}</pre>
          )}
        </CardContent>
      </Card>

      {conflicts.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Конфликты бэкфила</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">{JSON.stringify(conflicts, null, 2)}</pre>
          </CardContent>
        </Card>
      ) : null}

      <Button asChild variant="outline" size="sm">
        <Link href={homeHref}>На главную</Link>
      </Button>
    </div>
  );
}
