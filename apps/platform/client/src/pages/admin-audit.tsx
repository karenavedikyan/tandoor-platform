/**
 * Журнал аудита (read-only) для ролей с `audit.read`.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAudit, type AuditItem } from "@/lib/admin-audit-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { userHas } from "@/lib/auth-rbac";
import { defaultHomePathForUserRole } from "@/lib/auth-access";

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
        <Card>
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
    <div className="space-y-6" data-testid="page-admin-audit">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Журнал событий</h1>
        <p className="text-sm text-muted-foreground">Просмотр записей audit_log (только чтение).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>Укажите критерии и нажмите «Применить».</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="audit-action">Действие (частичное совпадение)</Label>
            <Input
              id="audit-action"
              data-testid="input-audit-filter-action"
              placeholder="auth.login, users.*"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-entity-type">Тип сущности</Label>
            <Input
              id="audit-entity-type"
              data-testid="input-audit-filter-entity-type"
              value={entityTypeInput}
              onChange={(e) => setEntityTypeInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-entity-id">ID сущности</Label>
            <Input
              id="audit-entity-id"
              data-testid="input-audit-filter-entity-id"
              value={entityIdInput}
              onChange={(e) => setEntityIdInput(e.target.value)}
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
            />
          </div>
          <div className="flex items-end md:col-span-2 lg:col-span-3">
            <Button
              type="button"
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

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Записи</CardTitle>
            <CardDescription>
              Всего: {total}
              {q.isFetching ? " (загрузка…)" : null}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              data-testid="button-audit-next"
              disabled={!canNext || q.isFetching}
              onClick={() => setOffset((o) => o + LIMIT)}
            >
              Вперёд
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Ошибка загрузки."}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Время</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Актор</TableHead>
                <TableHead>Тип сущности</TableHead>
                <TableHead>ID сущности</TableHead>
                <TableHead>Метаданные</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const ex = expanded[row.id] ?? false;
                return (
                  <TableRow key={row.id} data-testid={`row-audit-${row.id}`}>
                    <TableCell className="whitespace-nowrap text-xs">{row.createdAt}</TableCell>
                    <TableCell className="font-mono text-xs">{row.action}</TableCell>
                    <TableCell className="text-xs">
                      {row.actor ? row.actor.email : <span className="text-muted-foreground">system</span>}
                    </TableCell>
                    <TableCell className="text-xs">{row.entityType}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-xs">{row.entityId}</TableCell>
                    <TableCell className="max-w-[320px]">
                      <pre
                        className={`font-mono text-[11px] ${ex ? "max-h-64 overflow-auto" : "max-h-16 overflow-hidden"}`}
                      >
                        {formatJson(row.metadata)}
                      </pre>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-1 text-xs"
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
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Записей нет.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
