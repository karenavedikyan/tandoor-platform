/**
 * /admin/sync-health — диагностика overrides API (Промт 113.1 / 113.2).
 */

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  clearOverridesTraceLog,
  downloadOverridesTraceLogJson,
  OVERRIDES_TRACE_LOG_KEY,
  readOverridesTraceLog,
} from "@/lib/overrides-trace-log";
import {
  runOverridesPendingSyncOnce,
  type OverridesPendingSyncRunResult,
} from "@/lib/overrides-pending-sync-worker";

type AccessLogRow = {
  id: string;
  route: string;
  method: string;
  actor_user_id: string | null;
  body_summary: Record<string, unknown> | null;
  response_status: number | null;
  response_code: string | null;
  duration_ms: number | null;
  created_at: string;
};

type OverridesDebugData = {
  override_row: unknown;
  training_row: unknown;
  recent_events: unknown[];
  access_log: AccessLogRow[];
};

export default function AdminSyncHealthPage(): ReactElement {
  const { user } = useCurrentUser();
  const [, bump] = useState(0);
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";
  const canView = user?.role === "admin" || user?.role === "director";

  const pending = useMemo(() => listPendingSyncItems(), [bump]);
  const errors = useMemo(() => readOverridesErrorLog(), [bump]);
  const conflicts = useMemo(() => readBackfillConflicts(), [bump]);
  const trace = useMemo(() => readOverridesTraceLog(), [bump]);

  const [accessLog, setAccessLog] = useState<AccessLogRow[]>([]);
  const [accessLogError, setAccessLogError] = useState<string | null>(null);
  const [forceSyncResult, setForceSyncResult] = useState<OverridesPendingSyncRunResult | null>(null);
  const [forceSyncBusy, setForceSyncBusy] = useState(false);
  const [debugDealerId, setDebugDealerId] = useState("");
  const [debugData, setDebugData] = useState<OverridesDebugData | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [debugBusy, setDebugBusy] = useState(false);

  const loadAccessLog = useCallback(async () => {
    setAccessLogError(null);
    try {
      const res = await fetch("/api/admin/overrides-access-log?limit=100", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { success?: boolean; data?: AccessLogRow[]; message?: string };
      if (!res.ok || !data.success) {
        setAccessLogError(data.message ?? `HTTP ${res.status}`);
        setAccessLog([]);
        return;
      }
      setAccessLog(data.data ?? []);
    } catch (e) {
      setAccessLogError(e instanceof Error ? e.message : String(e));
      setAccessLog([]);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void loadAccessLog();
  }, [canView, loadAccessLog, bump]);

  const onForceSync = useCallback(async () => {
    setForceSyncBusy(true);
    const r = await runOverridesPendingSyncOnce();
    setForceSyncResult(r);
    setForceSyncBusy(false);
    bump((n) => n + 1);
  }, []);

  const onLoadDebug = useCallback(async () => {
    const id = debugDealerId.trim();
    if (!id) return;
    setDebugBusy(true);
    setDebugError(null);
    try {
      const res = await fetch(`/api/admin/overrides-debug?dealer_id=${encodeURIComponent(id)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { success?: boolean; data?: OverridesDebugData; message?: string };
      if (!res.ok || !data.success) {
        setDebugError(data.message ?? `HTTP ${res.status}`);
        setDebugData(null);
      } else {
        setDebugData(data.data ?? null);
      }
    } catch (e) {
      setDebugError(e instanceof Error ? e.message : String(e));
      setDebugData(null);
    } finally {
      setDebugBusy(false);
    }
  }, [debugDealerId]);

  if (!user) return <div className="p-6">Загрузка…</div>;
  if (!canView) {
    return <div className="p-6 text-sm text-muted-foreground">Доступ только для admin/director.</div>;
  }

  const backfillDone = typeof localStorage !== "undefined" && localStorage.getItem(OVERRIDES_BACKFILL_DONE_KEY) === "1";
  const tracePreview = trace.slice(0, 100);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6" data-testid="page-admin-sync-health">
      <div>
        <h1 className="text-2xl font-semibold text-[#222631]">Состояние синхронизации overrides</h1>
        <p className="mt-1 text-sm text-[#8F96B0]">
          Очередь, журналы ошибок, клиентская трассировка и серверный access-log (диагностика записи в БД).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Сводка</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={forceSyncBusy}
            onClick={() => void onForceSync()}
            data-testid="button-force-overrides-sync"
          >
            {forceSyncBusy ? "Синхронизация…" : "Принудительно прогнать pendingSyncStore сейчас"}
          </Button>
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
          {forceSyncResult ? (
            <div className="rounded border border-border/60 bg-muted/30 p-2 text-xs">
              <p>
                Force sync: обработано {forceSyncResult.processed}, успешно {forceSyncResult.succeeded}, ошибок{" "}
                {forceSyncResult.failed}
              </p>
              {forceSyncResult.errors.length > 0 ? (
                <pre className="mt-1 max-h-32 overflow-auto">{JSON.stringify(forceSyncResult.errors, null, 2)}</pre>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Ключи: {OVERRIDES_PENDING_STORAGE_KEY}, {OVERRIDES_ERROR_LOG_KEY}, {OVERRIDES_TRACE_LOG_KEY}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Клиентская трассировка overrides (текущая сессия)</CardTitle>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => downloadOverridesTraceLogJson()}>
              Скачать JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                clearOverridesTraceLog();
                bump((n) => n + 1);
              }}
            >
              Очистить трассировку
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tracePreview.length === 0 ? (
            <p className="text-sm text-muted-foreground">Записей нет. Измените категорию дилера или комментарий ТТ.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-1">ts</th>
                    <th className="p-1">fn</th>
                    <th className="p-1">stage</th>
                    <th className="p-1">id</th>
                    <th className="p-1">detail</th>
                  </tr>
                </thead>
                <tbody>
                  {tracePreview.map((e, i) => (
                    <tr key={`${e.ts}-${i}`} className="border-b border-border/40 align-top">
                      <td className="p-1 whitespace-nowrap">{e.ts.slice(11, 23)}</td>
                      <td className="p-1">{e.fn}</td>
                      <td className="p-1 font-medium">{e.stage}</td>
                      <td className="p-1">{e.dealerId ?? e.tpId ?? "—"}</td>
                      <td className="p-1 text-muted-foreground">
                        {[e.status, e.code, e.message, e.reason, e.pendingId].filter(Boolean).join(" · ") ||
                          (e.fieldsKeys ? `keys: ${e.fieldsKeys.join(",")}` : "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Серверный access-log overrides</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadAccessLog()}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          {accessLogError ? <p className="text-sm text-destructive">{accessLogError}</p> : null}
          {accessLog.length === 0 && !accessLogError ? (
            <p className="text-sm text-muted-foreground">Записей нет (миграция применена? был POST upsert?).</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-1">created</th>
                    <th className="p-1">route</th>
                    <th className="p-1">actor</th>
                    <th className="p-1">body</th>
                    <th className="p-1">status</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLog.map((row) => {
                    const bs = row.body_summary ?? {};
                    const keys = Array.isArray(bs.fields_keys) ? (bs.fields_keys as string[]).join(",") : "";
                    return (
                      <tr key={row.id} className="border-b border-border/40 align-top">
                        <td className="p-1 whitespace-nowrap">{row.created_at.slice(0, 19)}</td>
                        <td className="p-1">
                          {row.method} {row.route}
                        </td>
                        <td className="p-1">{row.actor_user_id?.slice(0, 8) ?? "—"}</td>
                        <td className="p-1">
                          {(bs.dealer_id as string) ?? (bs.tp_id as string) ?? "—"}
                          {keys ? ` [${keys}]` : ""}
                        </td>
                        <td className="p-1">
                          {row.response_status} {row.response_code} ({row.duration_ms}ms)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overrides debug по dealer_id</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md"
              placeholder="dealer_id, напр. client-ma-ma017341"
              value={debugDealerId}
              onChange={(e) => setDebugDealerId(e.target.value)}
              data-testid="input-overrides-debug-dealer-id"
            />
            <Button type="button" size="sm" disabled={debugBusy} onClick={() => void onLoadDebug()}>
              {debugBusy ? "Загрузка…" : "Загрузить"}
            </Button>
          </div>
          {debugError ? <p className="text-sm text-destructive">{debugError}</p> : null}
          {debugData ? (
            <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">{JSON.stringify(debugData, null, 2)}</pre>
          ) : null}
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
