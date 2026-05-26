/**
 * One-shot admin tool: merge accidentally created manual dealers into matching release cards.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveList, ResponsiveListDesktop, ResponsiveListMobile, ResponsiveListMobileItem } from "@/components/ui/responsive-list";
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

type ContactMigrationPlanRow = {
  managerScopeUserId: string;
  dealerId: string;
  contactId: string;
  fullName: string;
  phone: string;
  email: string;
  source: "from_override" | "from_manual_dealer";
};

type ContactMigrationPlan = {
  rows: ContactMigrationPlanRow[];
  skipped: Array<{ managerScopeUserId: string; dealerId: string; reason: string }>;
};

type ContactsMigrationResponse = {
  success: boolean;
  plans?: ContactMigrationPlan[];
  totals?: { managers: number; contactsToMigrate: number; skipped: number };
  applied?: number;
  message?: string;
};

async function postAdminAction<T extends DedupeResponse | ContactsMigrationResponse>(
  action:
    | "actualization-dedupe-dry-run"
    | "actualization-dedupe-apply"
    | "actualization-contacts-migration-dry-run"
    | "actualization-contacts-migration-apply",
  body = {},
): Promise<T> {
  const res = await fetch(`/api/admin/${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok || json.success !== true) {
    throw new Error(json.message ?? "Не удалось выполнить операцию.");
  }
  return json;
}

function flattenPlans(plans: ManualMergePlan[] | undefined): ManualMergePlanRow[] {
  return (plans ?? []).flatMap((p) => p.rows);
}

function flattenContactPlans(plans: ContactMigrationPlan[] | undefined): ContactMigrationPlanRow[] {
  return (plans ?? []).flatMap((p) => p.rows);
}

export default function AdminActualizationDedupePage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [plans, setPlans] = useState<ManualMergePlan[] | null>(null);
  const [totals, setTotals] = useState<DedupeResponse["totals"] | null>(null);
  const [loading, setLoading] = useState<"dry" | "apply" | null>(null);
  const [contactPlans, setContactPlans] = useState<ContactMigrationPlan[] | null>(null);
  const [contactTotals, setContactTotals] = useState<ContactsMigrationResponse["totals"] | null>(null);
  const [contactLoading, setContactLoading] = useState<"dry" | "apply" | null>(null);
  const rows = useMemo(() => flattenPlans(plans ?? undefined), [plans]);
  const contactRows = useMemo(() => flattenContactPlans(contactPlans ?? undefined), [contactPlans]);
  const skippedCount = totals?.skipped ?? plans?.reduce((sum, p) => sum + p.skipped.length, 0) ?? 0;
  const contactSkippedCount =
    contactTotals?.skipped ?? contactPlans?.reduce((sum, p) => sum + p.skipped.length, 0) ?? 0;
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
      const r = await postAdminAction<DedupeResponse>("actualization-dedupe-dry-run");
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
      const r = await postAdminAction<DedupeResponse>("actualization-dedupe-apply", { confirm: true });
      setPlans(r.plans ?? []);
      setTotals(r.totals ?? null);
      toast({ title: `Применено: ${r.applied ?? 0}` });
    } catch (e) {
      toast({ title: "Не удалось применить слияние", description: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const runContactsDry = async () => {
    setContactLoading("dry");
    try {
      const r = await postAdminAction<ContactsMigrationResponse>("actualization-contacts-migration-dry-run");
      setContactPlans(r.plans ?? []);
      setContactTotals(r.totals ?? null);
      toast({ title: "План миграции контактов построен", description: `К созданию: ${r.totals?.contactsToMigrate ?? 0}.` });
    } catch (e) {
      toast({ title: "Не удалось построить план контактов", description: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setContactLoading(null);
    }
  };

  const runContactsApply = async () => {
    const count = contactTotals?.contactsToMigrate ?? contactRows.length;
    if (count <= 0) return;
    if (!window.confirm(`Подтверждаете создание ${count} primary-контактов?`)) return;
    setContactLoading("apply");
    try {
      const r = await postAdminAction<ContactsMigrationResponse>("actualization-contacts-migration-apply", { confirm: true });
      setContactPlans(r.plans ?? []);
      setContactTotals(r.totals ?? null);
      toast({ title: `Контактов создано: ${r.applied ?? 0}` });
    } catch (e) {
      toast({ title: "Не удалось применить миграцию контактов", description: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setContactLoading(null);
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
            <ResponsiveList>
              <ResponsiveListDesktop>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="px-2 py-1.5 text-xs">Менеджер</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Manual-клиент</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Release-клиент</TableHead>
                    <TableHead className="px-2 py-1.5 text-right text-xs">ТТ</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Юрлицо</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Контакты</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={`${row.managerScopeUserId}:${row.manualDealerId}`} className="h-10">
                      <TableCell className="px-2 py-1.5">
                        <div className="font-medium">{row.managerFullName}</div>
                        <div className="text-xs text-muted-foreground">{row.managerUserId}</div>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <div className="font-medium">{row.manualInternalCode || "Без кода"}</div>
                        <div className="text-xs text-muted-foreground">{row.manualName}</div>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <div className="font-medium">{row.releaseCode}</div>
                        <div className="text-xs text-muted-foreground">{row.releaseName}</div>
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right tabular-nums">{row.tradePointsCount}</TableCell>
                      <TableCell className="px-2 py-1.5">{row.hasLegalEntities ? "✓" : "—"}</TableCell>
                      <TableCell className="px-2 py-1.5">{row.hasContacts ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
              </ResponsiveListDesktop>
              <ResponsiveListMobile>
                {rows.map((row) => (
                  <ResponsiveListMobileItem key={`${row.managerScopeUserId}:${row.manualDealerId}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-xs font-semibold">{row.manualInternalCode || "Без кода"}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">ТТ: {row.tradePointsCount}</span>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-foreground">{row.manualName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.releaseCode} · {row.managerFullName}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Юрлицо: {row.hasLegalEntities ? "да" : "нет"} · Контакты: {row.hasContacts ? "да" : "нет"}
                      </div>
                    </div>
                  </ResponsiveListMobileItem>
                ))}
              </ResponsiveListMobile>
            </ResponsiveList>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Миграция контактов</CardTitle>
          <CardDescription>
            После слияния manual-клиентов в release-карточки телефоны/email остались в overrides, но UI читает их из
            отдельной таблицы контактов. Эта операция создаёт primary-контакт для каждого клиента с данными в overrides.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={runContactsDry}
              disabled={contactLoading != null}
              data-testid="button-actualization-contacts-migration-dry-run"
            >
              {contactLoading === "dry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Построить план миграции контактов (dry-run)
            </Button>
            <Button
              type="button"
              onClick={runContactsApply}
              disabled={contactLoading != null || !contactPlans || (contactTotals?.contactsToMigrate ?? contactRows.length) === 0}
              data-testid="button-actualization-contacts-migration-apply"
            >
              {contactLoading === "apply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Применить миграцию
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Контактов к созданию: {contactTotals?.contactsToMigrate ?? contactRows.length}. Пропущено: {contactSkippedCount}.
          </div>
          {!contactPlans ? (
            <p className="text-sm text-muted-foreground">Нажмите «Построить план миграции контактов», чтобы увидеть кандидатов.</p>
          ) : contactRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Контактов для миграции не найдено.</p>
          ) : (
            <ResponsiveList>
              <ResponsiveListDesktop>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="px-2 py-1.5 text-xs">Менеджер</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Клиент</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Имя контакта</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Телефон</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Email</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Источник</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactRows.map((row) => (
                    <TableRow key={`${row.managerScopeUserId}:${row.contactId}`} className="h-10">
                      <TableCell className="px-2 py-1.5 font-mono text-xs">{row.managerScopeUserId}</TableCell>
                      <TableCell className="max-w-[180px] truncate px-2 py-1.5 font-mono text-xs">{row.dealerId}</TableCell>
                      <TableCell className="max-w-[180px] truncate px-2 py-1.5 text-sm">{row.fullName}</TableCell>
                      <TableCell className="px-2 py-1.5 text-sm">{row.phone || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate px-2 py-1.5 text-sm">{row.email || "—"}</TableCell>
                      <TableCell className="px-2 py-1.5 text-sm">{row.source === "from_override" ? "override" : "manual"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
              </ResponsiveListDesktop>
              <ResponsiveListMobile>
                {contactRows.map((row) => (
                  <ResponsiveListMobileItem key={`${row.managerScopeUserId}:${row.contactId}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-xs font-semibold">{row.dealerId}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{row.source === "from_override" ? "override" : "manual"}</span>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-foreground">{row.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.phone || "—"} · {row.email || "—"}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{row.managerScopeUserId}</div>
                    </div>
                  </ResponsiveListMobileItem>
                ))}
              </ResponsiveListMobile>
            </ResponsiveList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
