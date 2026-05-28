/**
 * Админ-страница миграции Neon → Yandex: запуск бэкапа в Vercel Blob.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Copy, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { cn } from "@/lib/utils";

const SECRET_STORAGE_KEY = "tandoor:migration:secret";
const BLOB_URL_STORAGE_KEY = "tandoor:migration:blob-url";
const DUMP_TIMEOUT_MS = 360_000;
const RESTORE_TIMEOUT_MS = 360_000;

type RestoreMode = "truncate-and-load" | "append";

type RestoreRowError = { table: string; rowIndex: number; error: string };

type RestoreResultPayload = {
  durationMs: number;
  rowCounts: Record<string, number>;
  errors: RestoreRowError[];
};

type RestoreSuccess = {
  ok: true;
  result: RestoreResultPayload;
};

type ProxyHealthResult = {
  ok: true;
  configured: boolean;
  proxyReachable: boolean;
  pgReachable: boolean;
  shadowWriteEnabled: boolean;
  durationMs: number;
  counts?: Array<{
    table: string;
    neon: number | null;
    yandex: number | null;
    delta: number | null;
    error?: string;
  }>;
};

type DumpSuccess = {
  ok: true;
  blobUrl: string;
  filename: string;
  sizeBytes: number;
  rowCounts: Record<string, number>;
  durationMs: number;
};

type MigrationError =
  | { kind: "http-error"; status: number; statusText: string; body: string; durationMs: number }
  | { kind: "non-json"; status: number; bodyPreview: string; durationMs: number }
  | {
      kind: "network-or-abort";
      errorName: string;
      errorMessage: string;
      httpStatus: number | null;
      rawBodySoFar: string;
      durationMs: number;
    };

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function readStoredSecret(): string {
  try {
    return sessionStorage.getItem(SECRET_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredSecret(value: string): void {
  try {
    if (value.trim()) sessionStorage.setItem(SECRET_STORAGE_KEY, value);
    else sessionStorage.removeItem(SECRET_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readStoredBlobUrl(): string {
  try {
    return sessionStorage.getItem(BLOB_URL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredBlobUrl(value: string): void {
  try {
    if (value.trim()) sessionStorage.setItem(BLOB_URL_STORAGE_KEY, value);
    else sessionStorage.removeItem(BLOB_URL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function parseRestoreSuccess(parsed: unknown): RestoreSuccess | null {
  if (!parsed || typeof parsed !== "object") return null;
  const data = parsed as { ok?: unknown; result?: unknown };
  if (data.ok !== true || !data.result || typeof data.result !== "object") return null;
  const result = data.result as Partial<RestoreResultPayload>;
  const rowCounts =
    result.rowCounts && typeof result.rowCounts === "object"
      ? (result.rowCounts as Record<string, number>)
      : {};
  const errors = Array.isArray(result.errors)
    ? result.errors.filter(
        (e): e is RestoreRowError =>
          !!e &&
          typeof e === "object" &&
          typeof (e as RestoreRowError).table === "string" &&
          typeof (e as RestoreRowError).rowIndex === "number",
      )
    : [];
  return {
    ok: true,
    result: {
      durationMs: Number(result.durationMs ?? 0),
      rowCounts,
      errors,
    },
  };
}

function parseDumpSuccess(parsed: unknown): DumpSuccess | null {
  if (!parsed || typeof parsed !== "object") return null;
  const data = parsed as Partial<DumpSuccess>;
  if (data.ok !== true) return null;
  return {
    ok: true,
    blobUrl: String(data.blobUrl ?? ""),
    filename: String(data.filename ?? ""),
    sizeBytes: Number(data.sizeBytes ?? 0),
    rowCounts:
      data.rowCounts && typeof data.rowCounts === "object" ? (data.rowCounts as Record<string, number>) : {},
    durationMs: Number(data.durationMs ?? 0),
  };
}

export default function AdminMigrationPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [success, setSuccess] = useState<DumpSuccess | null>(null);
  const [error, setError] = useState<MigrationError | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("truncate-and-load");
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<RestoreSuccess | null>(null);
  const [restoreError, setRestoreError] = useState<MigrationError | null>(null);
  const [restoreErrorsOpen, setRestoreErrorsOpen] = useState(false);
  const [proxyHealth, setProxyHealth] = useState<ProxyHealthResult | null>(null);
  const [proxyHealthLoading, setProxyHealthLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);

  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";

  useEffect(() => {
    setSecret(readStoredSecret());
    setBlobUrl(readStoredBlobUrl());
  }, []);

  const onSecretChange = useCallback((value: string) => {
    setSecret(value);
    writeStoredSecret(value);
  }, []);

  const sortedRowCounts = useMemo(() => {
    if (!success?.rowCounts) return [];
    return Object.entries(success.rowCounts).sort((a, b) => b[1] - a[1]);
  }, [success]);

  const sortedRestoreRowCounts = useMemo(() => {
    if (!restoreSuccess?.result.rowCounts) return [];
    return Object.entries(restoreSuccess.result.rowCounts).sort((a, b) => b[1] - a[1]);
  }, [restoreSuccess]);

  const restoreRowErrorsPreview = useMemo(() => {
    return (restoreSuccess?.result.errors ?? []).slice(0, 50);
  }, [restoreSuccess]);

  const copyToClipboard = useCallback(
    async (text: string, description: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "Скопировано", description });
      } catch {
        toast({ variant: "destructive", title: "Не удалось скопировать" });
      }
    },
    [toast],
  );

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4 sm:p-6" data-testid="page-admin-migration">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Раздел миграции БД доступен только администратору.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href={homeHref}>На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const runBackup = async () => {
    const trimmed = secret.trim();
    if (!trimmed) return;
    setRunning(true);
    setSuccess(null);
    setError(null);

    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let httpStatusText = "";
    let rawBody = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new DOMException("client-timeout-360s", "TimeoutError")),
        DUMP_TIMEOUT_MS,
      );
      try {
        const r = await fetch("/api/admin/db-migrate/dump", {
          method: "POST",
          headers: {
            "x-migration-secret": trimmed,
            "Content-Type": "application/json",
          },
          credentials: "include",
          signal: controller.signal,
        });
        httpStatus = r.status;
        httpStatusText = r.statusText;
        rawBody = await r.text();

        if (!r.ok) {
          setError({
            kind: "http-error",
            status: httpStatus,
            statusText: httpStatusText,
            body: rawBody.slice(0, 4000),
            durationMs: Date.now() - startedAt,
          });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          setError({
            kind: "non-json",
            status: httpStatus,
            bodyPreview: rawBody.slice(0, 4000),
            durationMs: Date.now() - startedAt,
          });
          return;
        }

        const result = parseDumpSuccess(parsed);
        if (!result) {
          setError({
            kind: "http-error",
            status: httpStatus,
            statusText: httpStatusText,
            body: rawBody.slice(0, 4000),
            durationMs: Date.now() - startedAt,
          });
          return;
        }

        setSuccess(result);
        writeStoredBlobUrl(result.blobUrl);
        setBlobUrl(result.blobUrl);
      } finally {
        clearTimeout(timeout);
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      setError({
        kind: "network-or-abort",
        errorName: err?.name || "Unknown",
        errorMessage: err?.message || String(e),
        httpStatus,
        rawBodySoFar: rawBody.slice(0, 2000),
        durationMs: Date.now() - startedAt,
      });
    } finally {
      setRunning(false);
    }
  };

  const fetchProxyHealth = async (compare: boolean) => {
    if (compare) setCompareLoading(true);
    else setProxyHealthLoading(true);
    try {
      const url = compare
        ? "/api/admin/db-migrate/proxy-health?compare=1"
        : "/api/admin/db-migrate/proxy-health";
      const r = await fetch(url, { credentials: "include" });
      const data = (await r.json()) as ProxyHealthResult & { error?: string };
      if (!r.ok || data.ok !== true) {
        toast({
          variant: "destructive",
          title: "Проверка прокси",
          description: data.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      setProxyHealth(data);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Проверка прокси",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setProxyHealthLoading(false);
      setCompareLoading(false);
    }
  };

  const runRestore = async () => {
    const trimmedSecret = secret.trim();
    const trimmedUrl = blobUrl.trim();
    if (!trimmedSecret || !trimmedUrl) return;
    setRestoreRunning(true);
    setRestoreSuccess(null);
    setRestoreError(null);
    setRestoreErrorsOpen(false);

    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let httpStatusText = "";
    let rawBody = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new DOMException("client-timeout-360s", "TimeoutError")),
        RESTORE_TIMEOUT_MS,
      );
      try {
        const r = await fetch("/api/admin/db-migrate/restore", {
          method: "POST",
          headers: {
            "x-migration-secret": trimmedSecret,
            "Content-Type": "application/json",
          },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({ blobUrl: trimmedUrl, mode: restoreMode }),
        });
        httpStatus = r.status;
        httpStatusText = r.statusText;
        rawBody = await r.text();

        if (!r.ok) {
          setRestoreError({
            kind: "http-error",
            status: httpStatus,
            statusText: httpStatusText,
            body: rawBody.slice(0, 4000),
            durationMs: Date.now() - startedAt,
          });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          setRestoreError({
            kind: "non-json",
            status: httpStatus,
            bodyPreview: rawBody.slice(0, 4000),
            durationMs: Date.now() - startedAt,
          });
          return;
        }

        const result = parseRestoreSuccess(parsed);
        if (!result) {
          setRestoreError({
            kind: "http-error",
            status: httpStatus,
            statusText: httpStatusText,
            body: rawBody.slice(0, 4000),
            durationMs: Date.now() - startedAt,
          });
          return;
        }

        setRestoreSuccess(result);
        if (result.result.errors.length > 0) {
          setRestoreErrorsOpen(true);
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      setRestoreError({
        kind: "network-or-abort",
        errorName: err?.name || "Unknown",
        errorMessage: err?.message || String(e),
        httpStatus,
        rawBodySoFar: rawBody.slice(0, 2000),
        durationMs: Date.now() - startedAt,
      });
    } finally {
      setRestoreRunning(false);
    }
  };

  const renderMigrationErrorCard = (
    title: string,
    err: MigrationError,
    testId: string,
    copyTestId: string,
  ) => (
    <Card className={cn("rounded-xl border border-destructive/40 bg-destructive/10 shadow-sm")} data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-lg text-destructive">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          Тип: <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">{err.kind}</code>
        </div>
        <div>Длительность: {(err.durationMs / 1000).toFixed(1)} сек</div>
        {err.kind === "http-error" ? (
          <>
            <div>
              HTTP {err.status} {err.statusText}
            </div>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-background/80 p-3 font-mono text-xs text-destructive">
              {err.body}
            </pre>
          </>
        ) : null}
        {err.kind === "non-json" ? (
          <>
            <div>HTTP {err.status} (ответ не JSON)</div>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-background/80 p-3 font-mono text-xs text-destructive">
              {err.bodyPreview}
            </pre>
          </>
        ) : null}
        {err.kind === "network-or-abort" ? (
          <>
            <div>
              {err.errorName}: {err.errorMessage}
            </div>
            {err.httpStatus !== null ? <div>HTTP до прерывания: {err.httpStatus}</div> : null}
            {err.rawBodySoFar ? (
              <>
                <div>Полученный частичный ответ:</div>
                <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-background/80 p-3 font-mono text-xs text-destructive">
                  {err.rawBodySoFar}
                </pre>
              </>
            ) : null}
          </>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          onClick={() => void copyToClipboard(JSON.stringify(err, null, 2), "Диагностика ошибки в буфере обмена.")}
          data-testid={copyTestId}
        >
          <Copy className="mr-2 h-4 w-4" aria-hidden />
          Скопировать всё
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6" data-testid="page-admin-migration">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Миграция БД</h1>
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">Neon → Yandex PostgreSQL. Только для администратора.</p>
      </header>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg sm:text-xl">Этап 1 — Бэкап Neon</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Сохранить полный снимок текущей Neon БД в Vercel Blob. Безопасно, read-only, можно нажимать сколько угодно
            раз — каждый раз создаётся новый файл с уникальным именем.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="migration-secret" className="text-sm">
              Секрет миграции
            </Label>
            <Input
              id="migration-secret"
              type="password"
              autoComplete="off"
              placeholder="MIGRATION_DUMP_SECRET"
              value={secret}
              onChange={(e) => onSecretChange(e.target.value)}
              className="min-h-11 text-base"
              data-testid="input-migration-secret"
            />
          </div>

          <Button
            type="button"
            className="min-h-11 w-full text-base font-semibold sm:w-auto"
            disabled={!secret.trim() || running}
            onClick={() => void runBackup()}
            data-testid="button-migration-run-dump"
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Дамп идёт… это может занять до 5 минут
              </>
            ) : (
              "Запустить бэкап"
            )}
          </Button>

          {running ? (
            <p className="text-sm text-muted-foreground" role="status">
              Не закрывайте вкладку до завершения операции.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg sm:text-xl">Этап 2 — Восстановить в Yandex</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Загрузить JSONL.gz дамп из Vercel Blob в Yandex Managed PostgreSQL. Секрет — тот же, что в этапе 1.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="migration-blob-url" className="text-sm">
              URL дампа в Blob
            </Label>
            <Input
              id="migration-blob-url"
              type="url"
              autoComplete="off"
              placeholder="https://…/tandoor-neon-dump-….jsonl.gz"
              value={blobUrl}
              onChange={(e) => {
                setBlobUrl(e.target.value);
                writeStoredBlobUrl(e.target.value);
              }}
              className="min-h-11 text-base"
              data-testid="input-migration-blob-url"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Режим</Label>
            <RadioGroup
              value={restoreMode}
              onValueChange={(v) => setRestoreMode(v as RestoreMode)}
              className="grid gap-3"
            >
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="truncate-and-load" id="restore-mode-truncate" className="mt-1" />
                <Label htmlFor="restore-mode-truncate" className="cursor-pointer font-normal leading-snug">
                  Очистить и загрузить заново
                  <span className="mt-1 block text-xs text-muted-foreground">TRUNCATE всех таблиц из дампа, затем INSERT</span>
                </Label>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="append" id="restore-mode-append" className="mt-1" />
                <Label htmlFor="restore-mode-append" className="cursor-pointer font-normal leading-snug">
                  Только добавить новое
                  <span className="mt-1 block text-xs text-muted-foreground">ON CONFLICT DO NOTHING — существующие строки не трогаем</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Button
            type="button"
            className="min-h-11 w-full text-base font-semibold sm:w-auto"
            disabled={!secret.trim() || !blobUrl.trim() || restoreRunning || running}
            onClick={() => void runRestore()}
            data-testid="button-migration-run-restore"
          >
            {restoreRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Идёт восстановление… это может занять до 5 минут
              </>
            ) : (
              "Восстановить в Yandex"
            )}
          </Button>

          {restoreRunning ? (
            <p className="text-sm text-muted-foreground" role="status">
              Не закрывайте вкладку до завершения операции.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card
        className={cn(
          "rounded-xl border shadow-sm",
          proxyHealth?.proxyReachable && proxyHealth.shadowWriteEnabled
            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-border bg-card",
        )}
        data-testid="migration-shadow-write"
      >
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg sm:text-xl">Этап 3 — Shadow-write активен</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Запись идёт параллельно в Neon (primary) и Yandex (shadow). Через ~7 дней переключим чтения на Yandex.
            Секрет миграции для этой проверки не нужен — только сессия admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                proxyHealth?.shadowWriteEnabled
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                  : "bg-muted text-muted-foreground",
              )}
            >
              Shadow-write: {proxyHealth?.shadowWriteEnabled === false ? "Выключен" : proxyHealth ? "Включён" : "—"}
            </span>
            {proxyHealth ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  proxyHealth.proxyReachable && proxyHealth.pgReachable
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                Прокси: {proxyHealth.proxyReachable && proxyHealth.pgReachable ? "OK" : "Недоступен"}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={proxyHealthLoading || compareLoading}
              onClick={() => void fetchProxyHealth(false)}
              data-testid="button-migration-proxy-health"
            >
              {proxyHealthLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Проверка…
                </>
              ) : (
                "Проверить связь"
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={proxyHealthLoading || compareLoading}
              onClick={() => void fetchProxyHealth(true)}
              data-testid="button-migration-compare-counts"
            >
              {compareLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Сравнение…
                </>
              ) : (
                "Сравнить счётчики"
              )}
            </Button>
          </div>

          {proxyHealth?.counts && proxyHealth.counts.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Таблица</TableHead>
                    <TableHead className="text-right">Neon</TableHead>
                    <TableHead className="text-right">Yandex</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proxyHealth.counts.map((row) => (
                    <TableRow key={row.table}>
                      <TableCell className="font-mono text-xs">{row.table}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.neon ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.yandex ?? "—"}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.delta !== null && row.delta !== 0 ? "text-amber-700 dark:text-amber-300" : "",
                        )}
                      >
                        {row.delta ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {success ? (
        <Card
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          data-testid="migration-dump-success"
        >
          <CardHeader>
            <CardTitle className="text-lg text-emerald-900 dark:text-emerald-50">Бэкап готов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-emerald-800/80 dark:text-emerald-200/80">Имя файла</dt>
                <dd className="break-all font-medium">{success.filename}</dd>
              </div>
              <div>
                <dt className="text-emerald-800/80 dark:text-emerald-200/80">Размер</dt>
                <dd className="font-medium tabular-nums">{formatBytes(success.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-emerald-800/80 dark:text-emerald-200/80">Длительность</dt>
                <dd className="font-medium tabular-nums">{(success.durationMs / 1000).toFixed(1)} сек</dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">
                Blob URL (приватный)
              </p>
              <p className="break-all rounded-md border border-emerald-200/80 bg-white/60 p-2 font-mono text-xs dark:border-emerald-800 dark:bg-black/20">
                {success.blobUrl}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 border-emerald-300 bg-white dark:border-emerald-800 dark:bg-transparent"
                onClick={() => void copyToClipboard(success.blobUrl, "URL бэкапа в буфере обмена.")}
                data-testid="button-migration-copy-blob-url"
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden />
                Скопировать blobUrl
              </Button>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Таблицы</p>
              <div className="overflow-x-auto rounded-md border border-emerald-200/80 bg-white/60 dark:border-emerald-800 dark:bg-black/20">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Таблица</TableHead>
                      <TableHead className="text-right">Строк</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRowCounts.map(([name, count]) => (
                      <TableRow key={name}>
                        <TableCell className="font-mono text-xs sm:text-sm">{name}</TableCell>
                        <TableCell className="text-right tabular-nums">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? renderMigrationErrorCard("Ошибка бэкапа", error, "migration-dump-error", "button-migration-copy-error") : null}

      {restoreSuccess ? (
        <Card
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          data-testid="migration-restore-success"
        >
          <CardHeader>
            <CardTitle className="text-lg text-emerald-900 dark:text-emerald-50">Восстановление завершено</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Длительность:{" "}
              <span className="font-medium tabular-nums">
                {(restoreSuccess.result.durationMs / 1000).toFixed(1)} сек
              </span>
            </p>
            <div className="space-y-2">
              <p className="font-medium">Строк в Yandex после загрузки</p>
              <div className="overflow-x-auto rounded-md border border-emerald-200/80 bg-white/60 dark:border-emerald-800 dark:bg-black/20">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Таблица</TableHead>
                      <TableHead className="text-right">Строк</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRestoreRowCounts.map(([name, count]) => (
                      <TableRow key={name}>
                        <TableCell className="font-mono text-xs sm:text-sm">{name}</TableCell>
                        <TableCell className="text-right tabular-nums">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {restoreSuccess.result.errors.length > 0 ? (
              <Collapsible open={restoreErrorsOpen} onOpenChange={setRestoreErrorsOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="min-h-10 w-full justify-between sm:w-auto">
                    Ошибки в строках ({restoreSuccess.result.errors.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-amber-300/80 bg-white/80 p-3 font-mono text-xs dark:border-amber-800 dark:bg-black/20">
                    {restoreRowErrorsPreview
                      .map((e) => `${e.table}#${e.rowIndex}: ${e.error}`)
                      .join("\n")}
                    {restoreSuccess.result.errors.length > 50
                      ? `\n… и ещё ${restoreSuccess.result.errors.length - 50}`
                      : ""}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {restoreError
        ? renderMigrationErrorCard(
            "Ошибка восстановления",
            restoreError,
            "migration-restore-error",
            "button-migration-copy-restore-error",
          )
        : null}
    </div>
  );
}
