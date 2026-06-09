/**
 * Журнал аудита (read-only) для ролей с `audit.read`.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAudit, type AuditItem } from "@/lib/admin-audit-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { userHas } from "@/lib/auth-rbac";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/format-datetime";

const LIMIT = 50;

function fromDatetimeLocalValue(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

function formatJson(meta: Record<string, unknown> | null): string {
  if (!meta) return "—";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return "—";
  }
}

const filterInputClass =
  "min-h-9 sm:min-h-11 border-border bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function AdminAuditPage() {
  const { user } = useCurrentUser();
  const canRead = Boolean(user && userHas(user.role, "audit.read"));
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/";

  const [actionInput, setActionInput] = useState("");
  const [actorInput, setActorInput] = useState("");
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [entityIdInput, setEntityIdInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const [applied, setApplied] = useState({
    action: "",
    actor: "",
    entityType: "",
    entityId: "",
    from: "" as string | undefined,
    to: "" as string | undefined,
  });
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const queryInput = useMemo(
    () => ({
      actor: applied.actor.trim() || undefined,
      action: applied.action.trim() || undefined,
      entityType: applied.entityType.trim() || undefined,
      entityId: applied.entityId.trim() || undefined,
      from: applied.from,
      to: applied.to,
      limit: LIMIT,
      offset,
    }),
    [applied, offset],
  );

  const q = useQuery({
    queryKey: ["audit-list", queryInput],
    queryFn: () => listAudit(queryInput),
    enabled: canRead,
  });

  if (!user || !canRead) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-admin-audit">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Раздел «Журнал событий» доступен только при наличии права audit.read.</CardDescription>
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

  const total = q.data?.total ?? 0;
  const items: AuditItem[] = q.data?.items ?? [];
  const canPrev = offset > 0;
  const canNext = offset + LIMIT < total;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-admin-audit">
      <BackNav breadcrumbs={breadcrumbsFor("/admin/audit")} fallbackHref="/" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">Журнал событий</h1>
        <p className="text-sm text-muted-foreground">Просмотр записей audit_log (только чтение).</p>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>Укажите критерии и нажмите «Применить».</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="audit-action">Действие (частичное совпадение)</Label>
            <Input
              id="audit-action"
              data-testid="input-audit-filter-action"
              placeholder="auth.login, users.*"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              className={filterInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-actor">Актор (UUID)</Label>
            <Input
              id="audit-actor"
              data-testid="input-audit-filter-actor"
              placeholder="uuid"
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
              className={cn(filterInputClass, "font-mono text-xs")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-entity-type">Тип сущности</Label>
            <Input
              id="audit-entity-type"
              data-testid="input-audit-filter-entity-type"
              value={entityTypeInput}
              onChange={(e) => setEntityTypeInput(e.target.value)}
              className={filterInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-entity-id">ID сущности</Label>
            <Input
              id="audit-entity-id"
              data-testid="input-audit-filter-entity-id"
              value={entityIdInput}
              onChange={(e) => setEntityIdInput(e.target.value)}
              className={cn(filterInputClass, "font-mono text-xs")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-from">С даты и времени</Label>
            <Input
              id="audit-from"
              type="datetime-local"
              data-testid="input-audit-filter-from"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className={filterInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-to">По дату и время</Label>
            <Input
              id="audit-to"
              type="datetime-local"
              data-testid="input-audit-filter-to"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className={filterInputClass}
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button
              type="button"
              className="h-9 bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))] sm:h-11"
              data-testid="button-audit-apply"
              onClick={() => {
                setOffset(0);
                setApplied({
                  action: actionInput,
                  actor: actorInput,
                  entityType: entityTypeInput,
                  entityId: entityIdInput,
                  from: fromDatetimeLocalValue(fromInput),
                  to: fromDatetimeLocalValue(toInput),
                });
              }}
            >
              Применить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Записи</CardTitle>
            <CardDescription>
              Всего: {total}
              {q.isFetching ? " (загрузка…)" : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              data-testid="button-audit-prev"
              disabled={!canPrev || q.isFetching}
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            >
              Назад
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              data-testid="button-audit-next"
              disabled={!canNext || q.isFetching}
              onClick={() => setOffset((o) => o + LIMIT)}
            >
              Вперёд
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.isError ? (
            <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Ошибка загрузки."}</p>
          ) : null}

          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <Table>
              <TableHeader>
                <TableRow className="h-10 border-b border-border hover:bg-transparent">
                  <TableHead className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Время</TableHead>
                  <TableHead className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Действие</TableHead>
                  <TableHead className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Актор</TableHead>
                  <TableHead className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Тип сущности</TableHead>
                  <TableHead className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">ID сущности</TableHead>
                  <TableHead className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Метаданные</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const ex = expanded[row.id] ?? false;
                  return (
                    <TableRow key={row.id} className="h-10 border-b border-border hover:bg-muted/40" data-testid={`row-audit-${row.id}`}>
                      <TableCell className="whitespace-nowrap px-2 py-1.5 font-mono text-xs text-foreground">
                        {formatDisplayDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 font-mono text-xs text-foreground">{row.action}</TableCell>
                      <TableCell className="px-2 py-1.5 text-xs text-foreground">
                        {row.actor ? row.actor.email : <span className="text-muted-foreground">system</span>}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-xs text-foreground">{row.entityType}</TableCell>
                      <TableCell className="max-w-[140px] truncate px-2 py-1.5 font-mono text-xs text-foreground">{row.entityId}</TableCell>
                      <TableCell className="max-w-[320px] px-2 py-1.5 align-top">
                        <div className="max-w-[320px] overflow-hidden">
                          <pre
                            className={cn(
                              "rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all",
                              ex ? "max-h-64 overflow-auto" : "max-h-16 overflow-hidden",
                            )}
                          >
                            {formatJson(row.metadata)}
                          </pre>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-0 py-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setExpanded((m) => ({ ...m, [row.id]: !ex }))}
                        >
                          {ex ? "свернуть" : "развернуть"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 && !q.isFetching ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-2 py-1.5 text-center text-sm text-muted-foreground">
                      Записей нет.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <ul className="sm:hidden divide-y divide-border">
            {items.map((row) => {
              const ex = expanded[row.id] ?? false;
              return (
                <li key={row.id} className="flex flex-col gap-0.5 px-2 py-2" data-testid={`row-audit-m-${row.id}`}>
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {formatDisplayDateTime(row.createdAt)}
                    </span>
                    <span className="min-w-0 truncate text-right font-mono text-[11px] text-foreground">{row.action}</span>
                  </div>
                  <p className="truncate text-sm text-foreground">
                    {row.actor ? row.actor.email : <span className="text-muted-foreground">system</span>}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.entityType} · <span className="font-mono">{row.entityId}</span>
                  </p>
                  {ex ? (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                      {formatJson(row.metadata)}
                    </pre>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-0.5 h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded((m) => ({ ...m, [row.id]: !ex }))}
                  >
                    {ex ? "свернуть" : "развернуть"}
                  </Button>
                </li>
              );
            })}
            {items.length === 0 && !q.isFetching ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">Записей нет.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
