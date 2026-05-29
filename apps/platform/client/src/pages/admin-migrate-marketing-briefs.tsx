/**
 * Admin: синхронное применение DDL маркетинговых брифов к Neon и Yandex (Промт 104.1 / 104.4).
 */

import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
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

type MigrateResponse = {
  success: boolean;
  neon: DbPanel;
  yandex: DbPanel;
  expected_tables: string[];
  code?: string;
  message?: string;
};

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
            <Badge variant="secondary" data-testid={`migrate-panel-${title}-status`}>
              Пропущено
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs leading-snug">{panel.reason}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MinusCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Пропущено (уже применено руками или через HTTPS-прокси вне Vercel).</span>
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
            <Badge variant="destructive" data-testid={`migrate-panel-${title}-status`}>
              Ошибка
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
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
          <Badge
            variant={ready ? "default" : "destructive"}
            className={ready ? "bg-[#9ACA3C]/20 text-[#5a7a28]" : ""}
            data-testid={`migrate-panel-${title}-status`}
          >
            {ready ? "Готово" : "Ошибка"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Стейтменты</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {panel.applied.map((row, i) => (
              <li key={i} className="flex gap-2">
                {row.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate font-mono text-[10px] text-muted-foreground"
                    title={row.sql}
                  >
                    {truncateSqlDisplay(row.sql)}
                  </span>
                  {row.error ? <span className="block text-destructive">{row.error}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Таблицы после миграции</p>
          <ul className="text-sm">
            {expectedTables.map((t) => (
              <li key={t} className={panel.tables.includes(t) ? "text-foreground" : "text-destructive"}>
                {panel.tables.includes(t) ? "✓" : "✗"} {t}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminMigrateMarketingBriefsPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrateResponse | null>(null);

  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";
  const isAdmin = user?.role === "admin";

  async function runMigrate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/migrate-marketing-briefs", {
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
        const yandexSkipped = json.yandex && panelIsSkipped(json.yandex);
        toast({
          title: yandexSkipped ? "Neon: миграция применена" : "Миграции применены",
          description: yandexSkipped ? "Yandex пропущен (настроен вручную или через прокси)." : undefined,
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

  if (!isAdmin) {
    return null;
  }

  const expected = result?.expected_tables ?? [
    "marketing_briefs",
    "marketing_brief_revisions",
    "marketing_brief_blocks",
  ];

  const inSync = result?.success === true;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 p-4 sm:p-6" data-testid="page-admin-migrate-marketing-briefs">
      <div>
        <h1 className="text-2xl font-semibold text-[#222631]">Миграции маркетинговых брифов</h1>
        <p className="mt-1 text-sm text-[#8F96B0]">
          Neon применяется с Vercel. Yandex — через HTTPS-прокси (если настроен) или пропускается. Безопасно повторять.
        </p>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          className="h-14 min-h-[56px] w-full bg-[#9ACA3C] text-base text-[#222631] hover:bg-[#8AB835]"
          disabled={loading}
          data-testid="button-run-dual-migrate"
          onClick={() => void runMigrate()}
        >
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : null}
          {loading ? "Применяю…" : "Применить миграции"}
        </Button>
        <p className="text-center text-xs text-[#8F96B0]">Можно нажимать многократно, всё идемпотентно</p>
      </div>

      {result ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-4 text-center text-base font-semibold",
            inSync
              ? "border-[#9ACA3C]/50 bg-[#9ACA3C]/15 text-[#222631]"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
          data-testid="migrate-dual-status"
        >
          {inSync ? "Neon готов ✓" : "Требуется внимание"}
          {!inSync ? (
            <p className="mt-2 text-xs font-normal">Проверьте панель Neon и переменную DATABASE_URL</p>
          ) : panelIsSkipped(result.yandex) ? (
            <p className="mt-2 text-xs font-normal">Yandex пропущен — DDL уже на стороне Yandex</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <DbResultPanel title="Neon (основная)" panel={result?.neon ?? null} expectedTables={expected} />
        <DbResultPanel title="Yandex (страховка)" panel={result?.yandex ?? null} expectedTables={expected} />
      </div>

      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
        <Link href="/marketing-briefs">К маркетинговым брифам</Link>
      </Button>
    </div>
  );
}
