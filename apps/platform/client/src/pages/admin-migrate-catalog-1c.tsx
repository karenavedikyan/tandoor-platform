/**
 * Admin: DDL каталога 1С → Neon + Yandex (Промт 116).
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type StmtResult = { sql: string; ok: boolean; error?: string };

type DbPanelRun = {
  applied: StmtResult[];
  tables: string[];
};

type DbPanelError = { error: string };

type DbPanelSkipped = { skipped: true; reason: string };

type DbPanel = DbPanelRun | DbPanelError | DbPanelSkipped;

type SmokeCounts = { cats: number; products: number; warehouses: number };

type MigrateResponse = {
  success: boolean;
  neon: DbPanel;
  yandex: DbPanel;
  expected_tables: string[];
  tables_applied?: number;
  smoke_counts_neon?: SmokeCounts | { error: string };
  code?: string;
  message?: string;
};

const DEFAULT_EXPECTED = [
  "catalog_categories",
  "catalog_groups",
  "catalog_products",
  "catalog_product_properties",
  "catalog_product_categories",
  "catalog_product_images",
  "catalog_warehouses",
  "catalog_stocks",
  "catalog_price_types",
  "catalog_prices",
  "catalog_sync_log",
];

function panelHasError(panel: DbPanel): panel is DbPanelError {
  return "error" in panel;
}

function panelIsSkipped(panel: DbPanel): panel is DbPanelSkipped {
  return "skipped" in panel && panel.skipped === true;
}

function truncateSqlDisplay(sql: string, max = 50): string {
  const t = sql.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function DbResultPanel({
  title,
  panel,
  expectedTables,
}: {
  title: string;
  panel: DbPanel | null;
  expectedTables: string[];
}) {
  if (!panel) {
    return (
      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ожидание запуска</p>
        </CardContent>
      </Card>
    );
  }

  if (panelIsSkipped(panel)) {
    return (
      <Card className="border-border/80 bg-muted/30" data-testid={`migrate-panel-${title}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {title}
            <Badge variant="secondary">Пропущено</Badge>
          </CardTitle>
          <CardDescription className="text-xs leading-snug">{panel.reason}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MinusCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Yandex DDL — через HTTPS-прокси вне Vercel или вручную.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (panelHasError(panel)) {
    return (
      <Card className="border-destructive/40" data-testid={`migrate-panel-${title}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {title}
            <Badge variant="destructive">Ошибка</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{panel.error}</p>
        </CardContent>
      </Card>
    );
  }

  const tablesOk = expectedTables.every((t) => panel.tables.includes(t));
  const stmtsOk = panel.applied.every((r) => r.ok);
  const ready = tablesOk && stmtsOk;

  return (
    <Card className="border-border/80" data-testid={`migrate-panel-${title}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Badge variant={ready ? "default" : "destructive"} className={ready ? "bg-[#9ACA3C]/20 text-[#5a7a28]" : ""}>
            {ready ? "Готово" : "Ошибка"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Применено стейтментов: {panel.applied.filter((r) => r.ok).length}/{panel.applied.length} · таблиц:{" "}
          {panel.tables.length}
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {panel.applied.map((row, i) => (
            <li key={i} className="flex gap-2">
              {row.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
              )}
              <span className="min-w-0 flex-1 font-mono text-[10px] text-muted-foreground" title={row.sql}>
                {truncateSqlDisplay(row.sql)}
                {row.error ? <span className="block text-destructive">{row.error}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <ul className="text-sm">
          {expectedTables.map((t) => (
            <li key={t} className={panel.tables.includes(t) ? "text-foreground" : "text-destructive"}>
              {panel.tables.includes(t) ? "✓" : "✗"} {t}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SmokeCountsCard({ smoke }: { smoke: MigrateResponse["smoke_counts_neon"] }) {
  if (!smoke) return null;
  if ("error" in smoke) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-3 text-sm text-amber-900">Smoke SQL (Neon): {smoke.error}</CardContent>
      </Card>
    );
  }
  const ok = smoke.cats === 0 && smoke.products === 0 && smoke.warehouses === 0;
  return (
    <Card className="border-border/80" data-testid="catalog-smoke-counts">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Smoke (Neon)</CardTitle>
        <CardDescription>Ожидается 0/0/0 до синка catalog1.xml (промт 117)</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <p>
          Разделы: <strong>{smoke.cats}</strong> · Товары: <strong>{smoke.products}</strong> · Склады:{" "}
          <strong>{smoke.warehouses}</strong>
        </p>
        {ok ? (
          <p className="mt-1 text-emerald-700">✓ Счётчики пустые — схема готова к импорту</p>
        ) : (
          <p className="mt-1 text-muted-foreground">Таблицы уже содержат данные (повторный запуск допустим)</p>
        )}
      </CardContent>
    </Card>
  );
}

type SyncLogRow = {
  id: string;
  source_file: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  rows_total: number;
  rows_upserted: number;
  rows_skipped: number;
  error: string | null;
  duration_ms: number | null;
};

type SyncLogResponse = {
  success: boolean;
  has_running?: boolean;
  logs?: SyncLogRow[];
  message?: string;
};

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms} мс`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  return `${Math.floor(s / 60)} мин ${s % 60} с`;
}

export default function AdminMigrateCatalog1cPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrateResponse | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([]);
  const [hasRunningSync, setHasRunningSync] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchSyncLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/catalog-1c-sync-log?limit=10", { credentials: "include" });
      const json = (await res.json()) as SyncLogResponse;
      if (res.ok && json.success && json.logs) {
        setSyncLogs(json.logs);
        setHasRunningSync(Boolean(json.has_running));
      }
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchSyncLogs();
    const t = window.setInterval(() => {
      void fetchSyncLogs();
    }, hasRunningSync ? 5000 : 30000);
    return () => window.clearInterval(t);
  }, [isAdmin, hasRunningSync, fetchSyncLogs]);

  async function runCatalogSync() {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/admin/sync-catalog-1c", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "both", dry: false }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        toast({
          variant: "destructive",
          title: "Не удалось запустить импорт",
          description: json.message ?? `HTTP ${res.status}`,
        });
      } else {
        toast({
          title: "Импорт запущен на Yandex VM",
          description: json.message ?? "Обновление лога каждые 5 с",
        });
        setHasRunningSync(true);
        void fetchSyncLogs();
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка запроса",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSyncLoading(false);
    }
  }

  async function runMigrate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/migrate-catalog-1c", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as MigrateResponse;
      setResult(json);
      if (!res.ok || !json.success) {
        toast({
          variant: "destructive",
          title: "Миграция не завершена",
          description: json.message ?? "Проверьте отчёт по базам",
        });
      } else {
        toast({
          title: panelIsSkipped(json.yandex) ? "Neon: каталог 1С применён" : "Neon + Yandex: каталог 1С применён",
        });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка запроса",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!isAdmin) return null;

  const expected = result?.expected_tables ?? DEFAULT_EXPECTED;
  const inSync = result?.success === true;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 p-4 sm:p-6" data-testid="page-admin-migrate-catalog-1c">
      <div>
        <h1 className="text-2xl font-semibold text-[#222631]">Каталог 1С: схема и импорт</h1>
        <p className="mt-1 text-sm text-[#8F96B0]">
          Промт 116 — DDL · Промт 117 — импорт <code className="text-xs">catalog1.xml</code> с FTP (runner на Yandex VM, cron hourly).
        </p>
      </div>

      <Card className="border-border/80" data-testid="section-catalog-1c-sync">
        <CardHeader>
          <CardTitle className="text-base">Импорт данных</CardTitle>
          <CardDescription>
            Запускает <code className="text-xs">sync-1c-catalog.mjs</code> на VM (не Vercel). Требуется{" "}
            <code className="text-xs">SYNC_1C_RUNNER_URL</code> в env.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="default"
            className="w-full bg-[#222631] text-white hover:bg-[#333a4d] sm:w-auto"
            disabled={syncLoading || hasRunningSync}
            data-testid="button-sync-catalog-1c-now"
            onClick={() => void runCatalogSync()}
          >
            {syncLoading || hasRunningSync ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {hasRunningSync ? "Импорт выполняется…" : "Импортировать каталог 1С сейчас"}
          </Button>

          <div className="overflow-x-auto rounded-md border border-border/60">
            <Table data-testid="table-catalog-sync-log">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Файл</TableHead>
                  <TableHead>Старт</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Upserted</TableHead>
                  <TableHead>Длительность</TableHead>
                  <TableHead>Ошибка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Нет записей в catalog_sync_log
                    </TableCell>
                  </TableRow>
                ) : (
                  syncLogs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell>{row.source_file}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{row.started_at}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "ok"
                              ? "default"
                              : row.status === "running"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{row.rows_upserted}</TableCell>
                      <TableCell>{formatDuration(row.duration_ms)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-destructive" title={row.error ?? ""}>
                        {row.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          className="h-14 min-h-[56px] w-full bg-[#9ACA3C] text-base text-[#222631] hover:bg-[#8AB835]"
          disabled={loading}
          data-testid="button-run-catalog-1c-migrate"
          onClick={() => void runMigrate()}
        >
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : null}
          {loading ? "Применяю…" : "Применить миграцию каталога 1С"}
        </Button>
        <p className="text-center text-xs text-[#8F96B0]">Идемпотентно (IF NOT EXISTS)</p>
      </div>

      {result ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-4 text-center text-base font-semibold",
            inSync ? "border-[#9ACA3C]/50 bg-[#9ACA3C]/15 text-[#222631]" : "border-amber-200 bg-amber-50 text-amber-900",
          )}
          data-testid="migrate-dual-status"
        >
          {inSync ? `Схема применена (${result.tables_applied ?? expected.length} таблиц)` : "Требуется внимание"}
        </div>
      ) : null}

      {result?.smoke_counts_neon ? <SmokeCountsCard smoke={result.smoke_counts_neon} /> : null}

      <div className="flex flex-col gap-4">
        <DbResultPanel title="Neon (основная)" panel={result?.neon ?? null} expectedTables={expected} />
        <DbResultPanel title="Yandex (страховка)" panel={result?.yandex ?? null} expectedTables={expected} />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/migrate-marketing-briefs">Миграции брифов</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/migrate-dealer-tp">Миграции дилер/ТТ</Link>
        </Button>
      </div>
    </div>
  );
}
