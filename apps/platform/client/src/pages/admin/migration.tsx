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
const DUMP_TIMEOUT_MS = 360_000;

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

  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";

  useEffect(() => {
    setSecret(readStoredSecret());
  }, []);

  const onSecretChange = useCallback((value: string) => {
    setSecret(value);
    writeStoredSecret(value);
  }, []);

  const sortedRowCounts = useMemo(() => {
    if (!success?.rowCounts) return [];
    return Object.entries(success.rowCounts).sort((a, b) => b[1] - a[1]);
  }, [success]);

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

      {error ? (
        <Card
          className={cn("rounded-xl border border-destructive/40 bg-destructive/10 shadow-sm")}
          data-testid="migration-dump-error"
        >
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Ошибка бэкапа</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              Тип: <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">{error.kind}</code>
            </div>
            <div>Длительность: {(error.durationMs / 1000).toFixed(1)} сек</div>

            {error.kind === "http-error" ? (
              <>
                <div>
                  HTTP {error.status} {error.statusText}
                </div>
                <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-background/80 p-3 font-mono text-xs text-destructive">
                  {error.body}
                </pre>
              </>
            ) : null}

            {error.kind === "non-json" ? (
              <>
                <div>HTTP {error.status} (ответ не JSON)</div>
                <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-background/80 p-3 font-mono text-xs text-destructive">
                  {error.bodyPreview}
                </pre>
              </>
            ) : null}

            {error.kind === "network-or-abort" ? (
              <>
                <div>
                  {error.errorName}: {error.errorMessage}
                </div>
                {error.httpStatus !== null ? <div>HTTP до прерывания: {error.httpStatus}</div> : null}
                {error.rawBodySoFar ? (
                  <>
                    <div>Полученный частичный ответ:</div>
                    <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-background/80 p-3 font-mono text-xs text-destructive">
                      {error.rawBodySoFar}
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
              onClick={() => void copyToClipboard(JSON.stringify(error, null, 2), "Диагностика ошибки в буфере обмена.")}
              data-testid="button-migration-copy-error"
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Скопировать всё
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
