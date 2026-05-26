/**
 * One-shot admin tool: merge accidentally created manual dealers into matching release cards.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { defaultHomePathForUserRole } from "@/lib/auth-access";

type ManualMergePlanRow = {
  managerUserId: string;
  managerScopeUserId: string;
  managerFullName: string;
  manualDealerId: string;
  manualInternalCode: string;
  manualName: string;
  releaseDealerId: string;
  releaseCode: string;
  releaseName: string;
  tradePointsCount: number;
  hasLegalEntities: boolean;
  hasContacts: boolean;
};

type ManualMergePlan = {
  rows: ManualMergePlanRow[];
  skipped: Array<{ managerUserId: string; manualDealerId: string; reason: string }>;
};

type DedupeResponse = {
  success: boolean;
  plans?: ManualMergePlan[];
  totals?: { managers: number; rowsToMerge: number; skipped: number };
  applied?: number;
  message?: string;
};

async function postDedupeAction(action: "actualization-dedupe-dry-run" | "actualization-dedupe-apply", body = {}): Promise<DedupeResponse> {
  const res = await fetch(`/api/admin/${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as DedupeResponse;
  if (!res.ok || json.success !== true) {
    throw new Error(json.message ?? "Не удалось выполнить операцию.");
  }
  return json;
}

function flattenPlans(plans: ManualMergePlan[] | undefined): ManualMergePlanRow[] {
  return (plans ?? []).flatMap((p) => p.rows);
}

export default function AdminActualizationDedupePage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [plans, setPlans] = useState<ManualMergePlan[] | null>(null);
  const [totals, setTotals] = useState<DedupeResponse["totals"] | null>(null);
  const [loading, setLoading] = useState<"dry" | "apply" | null>(null);
  const rows = useMemo(() => flattenPlans(plans ?? undefined), [plans]);
  const skippedCount = totals?.skipped ?? plans?.reduce((sum, p) => sum + p.skipped.length, 0) ?? 0;
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/";

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-admin-actualization-dedupe">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Дедуп актуализации доступен только администратору.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={homeHref}>На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const runDry = async () => {
    setLoading("dry");
    try {
      const r = await postDedupeAction("actualization-dedupe-dry-run");
      setPlans(r.plans ?? []);
      setTotals(r.totals ?? null);
      toast({ title: "План построен", description: `К слиянию: ${r.totals?.rowsToMerge ?? 0}.` });
    } catch (e) {
      toast({ title: "Не удалось построить план", description: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const runApply = async () => {
    const count = totals?.rowsToMerge ?? rows.length;
    if (count <= 0) return;
    if (!window.confirm(`Подтверждаете слияние ${count} клиентов? Действие необратимо.`)) return;
    setLoading("apply");
    try {
      const r = await postDedupeAction("actualization-dedupe-apply", { confirm: true });
      setPlans(r.plans ?? []);
      setTotals(r.totals ?? null);
      toast({ title: `Применено: ${r.applied ?? 0}` });
    } catch (e) {
      toast({ title: "Не удалось применить слияние", description: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-admin-actualization-dedupe">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Дедуп manual-клиентов в release-карточки</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Инструмент ищет вручную созданных клиентов с тем же нормализованным именем и менеджером, что и release-клиент,
            а затем переносит правки, торговые точки и связанные данные в release-карточку.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={runDry} disabled={loading != null} data-testid="button-actualization-dedupe-dry-run">
            {loading === "dry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Построить план (dry-run)
          </Button>
          <Button
            type="button"
            onClick={runApply}
            disabled={loading != null || !plans || (totals?.rowsToMerge ?? rows.length) === 0}
            data-testid="button-actualization-dedupe-apply"
          >
            {loading === "apply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Применить слияние
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>План слияния</CardTitle>
          <CardDescription>
            Всего к слиянию: {totals?.rowsToMerge ?? rows.length}. Пропущено: {skippedCount}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!plans ? (
            <p className="text-sm text-muted-foreground">Нажмите «Построить план», чтобы увидеть кандидатов.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Кандидатов на слияние не найдено.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Менеджер</TableHead>
                    <TableHead>Manual-клиент</TableHead>
                    <TableHead>Release-клиент</TableHead>
                    <TableHead className="text-right">ТТ переедет</TableHead>
                    <TableHead>Юрлицо</TableHead>
                    <TableHead>Контакты</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={`${row.managerScopeUserId}:${row.manualDealerId}`}>
                      <TableCell>
                        <div className="font-medium">{row.managerFullName}</div>
                        <div className="text-xs text-muted-foreground">{row.managerUserId}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.manualInternalCode || "Без кода"}</div>
                        <div className="text-xs text-muted-foreground">{row.manualName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.releaseCode}</div>
                        <div className="text-xs text-muted-foreground">{row.releaseName}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.tradePointsCount}</TableCell>
                      <TableCell>{row.hasLegalEntities ? "✓" : "—"}</TableCell>
                      <TableCell>{row.hasContacts ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
