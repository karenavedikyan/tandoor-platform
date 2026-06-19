/**
 * /admin/audit — read-only журнал аудита (Промт 430).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AUDIT_SOURCE_OPTIONS,
  downloadAuditCsv,
  listAdminAudit,
  type AuditRowDto,
  type AuditSource,
} from "@/lib/admin-audit-api";
import { listUsers } from "@/lib/admin-users-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/format-datetime";
import {
  defaultAdminAuditUrlState,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  useAdminAuditUrlState,
} from "@/hooks/use-admin-audit-url";
import { ChevronDown, Download, RefreshCw, Shield } from "lucide-react";

const PAGE_SIZE = 50;

const rolesRu: Record<string, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "РМ",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  category_manager: "КатМен",
  admin: "Админ",
};

function canAccessAdminAudit(role: string | undefined): boolean {
  return role === "admin" || role === "director";
}

function actorLabel(row: AuditRowDto): string {
  if (row.actorFullName?.trim()) return row.actorFullName.trim();
  if (row.actorEmail?.trim()) return row.actorEmail.trim();
  if (row.actorUserId) return row.actorUserId;
  return "system";
}

function formatJson(details: Record<string, unknown>): string {
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return "—";
  }
}

const filterInputClass =
  "min-h-9 sm:min-h-11 border-border bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function SourceSpecificFilters({
  source,
  draft,
  setDraft,
}: {
  source: AuditSource;
  draft: ReturnType<typeof useAdminAuditUrlState>["state"];
  setDraft: React.Dispatch<React.SetStateAction<typeof draft>>;
}) {
  if (source === "general") {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="audit-action">Действие (точное)</Label>
          <Input
            id="audit-action"
            data-testid="input-audit-filter-action"
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            className={filterInputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-entity-type">Тип сущности</Label>
          <Input
            id="audit-entity-type"
            data-testid="input-audit-filter-entity-type"
            value={draft.entityType}
            onChange={(e) => setDraft((d) => ({ ...d, entityType: e.target.value }))}
            className={filterInputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-entity-id">ID сущности</Label>
          <Input
            id="audit-entity-id"
            data-testid="input-audit-filter-entity-id"
            value={draft.entityId}
            onChange={(e) => setDraft((d) => ({ ...d, entityId: e.target.value }))}
            className={cn(filterInputClass, "font-mono text-xs")}
          />
        </div>
      </>
    );
  }
  if (source === "client_assignments") {
    return (
      <div className="space-y-2">
        <Label htmlFor="audit-client-code">Код клиента</Label>
        <Input
          id="audit-client-code"
          data-testid="input-audit-filter-client-code"
          value={draft.clientCode}
          onChange={(e) => setDraft((d) => ({ ...d, clientCode: e.target.value }))}
          className={filterInputClass}
        />
      </div>
    );
  }
  if (source === "dealer_responsibility") {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="audit-dealer-id">ID дилера</Label>
          <Input
            id="audit-dealer-id"
            data-testid="input-audit-filter-dealer-id"
            value={draft.dealerId}
            onChange={(e) => setDraft((d) => ({ ...d, dealerId: e.target.value }))}
            className={cn(filterInputClass, "font-mono text-xs")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-responsible-role">Роль ответственного</Label>
          <Input
            id="audit-responsible-role"
            data-testid="input-audit-filter-responsible-role"
            value={draft.responsibleRole}
            onChange={(e) => setDraft((d) => ({ ...d, responsibleRole: e.target.value }))}
            className={filterInputClass}
          />
        </div>
      </>
    );
  }
  if (source === "overrides_api") {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="audit-route">Маршрут</Label>
          <Input
            id="audit-route"
            data-testid="input-audit-filter-route"
            value={draft.route}
            onChange={(e) => setDraft((d) => ({ ...d, route: e.target.value }))}
            className={filterInputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-response-status">HTTP статус</Label>
          <Input
            id="audit-response-status"
            data-testid="input-audit-filter-response-status"
            inputMode="numeric"
            value={draft.responseStatus}
            onChange={(e) => setDraft((d) => ({ ...d, responseStatus: e.target.value }))}
            className={filterInputClass}
          />
        </div>
      </>
    );
  }
  return null;
}

function AuditTable({
  rows,
  onRowClick,
}: {
  rows: AuditRowDto[];
  onRowClick: (row: AuditRowDto) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualize = rows.length > 100;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
    enabled: virtualize,
  });

  const renderRow = (row: AuditRowDto) => (
    <button
      key={row.id}
      type="button"
      data-testid={`row-audit-${row.id}`}
      className="grid w-full grid-cols-[minmax(9rem,1fr)_minmax(8rem,1.2fr)_minmax(6rem,0.8fr)_minmax(5rem,0.6fr)_minmax(8rem,1.5fr)] items-start gap-2 border-b border-border px-2 py-2 text-left text-xs hover:bg-muted/40"
      onClick={() => onRowClick(row)}
    >
      <span className="whitespace-nowrap font-mono tabular-nums text-muted-foreground">
        {formatDisplayDateTime(row.occurredAt)}
      </span>
      <span className="min-w-0 truncate text-foreground">
        {actorLabel(row)}
        {row.actorRole ? (
          <span className="ml-1 text-muted-foreground">({rolesRu[row.actorRole] ?? row.actorRole})</span>
        ) : null}
      </span>
      <span className="min-w-0 truncate font-mono text-foreground">{row.action}</span>
      <span className="min-w-0 truncate text-muted-foreground">{row.entityType ?? "—"}</span>
      <span className="min-w-0 truncate text-foreground">{row.summary}</span>
    </button>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[minmax(9rem,1fr)_minmax(8rem,1.2fr)_minmax(6rem,0.8fr)_minmax(5rem,0.6fr)_minmax(8rem,1.5fr)] gap-2 border-b border-border bg-muted/30 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Время</span>
        <span>Актор</span>
        <span>Действие</span>
        <span>Объект</span>
        <span>Сводка</span>
      </div>
      {virtualize ? (
        <div ref={parentRef} className="max-h-[min(70vh,720px)] overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {renderRow(row)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>{rows.map((row) => renderRow(row))}</div>
      )}
      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">Записей нет.</p>
      ) : null}
    </div>
  );
}

export default function AdminAuditPage() {
  const { user } = useCurrentUser();
  const canRead = canAccessAdminAudit(user?.role);
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/";
  const { state: urlState, setState: setUrlState } = useAdminAuditUrlState();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [draft, setDraft] = useState(urlState);
  const [actorPickerOpen, setActorPickerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AuditRowDto | null>(null);

  useEffect(() => {
    setDraft(urlState);
  }, [urlState]);

  const usersQ = useQuery({
    queryKey: ["admin-users-picker-audit"],
    queryFn: () => listUsers({ limit: 500 }),
    enabled: canRead,
    staleTime: 60_000,
  });

  const queryInput = useMemo(
    () => ({
      source: urlState.source,
      actorUserId: urlState.actorUserId.trim() || undefined,
      from: urlState.from || undefined,
      to: urlState.to || undefined,
      limit: PAGE_SIZE,
      offset: urlState.offset,
      action: urlState.action.trim() || undefined,
      entityType: urlState.entityType.trim() || undefined,
      entityId: urlState.entityId.trim() || undefined,
      clientCode: urlState.clientCode.trim() || undefined,
      dealerId: urlState.dealerId.trim() || undefined,
      responsibleRole: urlState.responsibleRole.trim() || undefined,
      route: urlState.route.trim() || undefined,
      responseStatus:
        urlState.responseStatus.trim() !== "" ? Number.parseInt(urlState.responseStatus, 10) : undefined,
    }),
    [urlState],
  );

  const q = useQuery({
    queryKey: ["admin-audit-list", queryInput],
    queryFn: () => listAdminAudit(queryInput),
    enabled: canRead,
  });

  const selectedActor = useMemo(() => {
    if (!draft.actorUserId) return null;
    return usersQ.data?.users.find((u) => u.id === draft.actorUserId) ?? null;
  }, [draft.actorUserId, usersQ.data?.users]);

  if (!user || !canRead) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-admin-audit">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Раздел «Аудит» доступен только администратору и директору.</CardDescription>
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
  const rows = q.data?.rows ?? [];
  const canPrev = urlState.offset > 0;
  const canNext = urlState.offset + PAGE_SIZE < total;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-admin-audit">
      <BackNav breadcrumbs={breadcrumbsFor("/admin/audit")} fallbackHref="/" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            <Shield className="h-6 w-6 text-primary" aria-hidden />
            Аудит
          </h1>
          <p className="text-sm text-muted-foreground">Просмотр журналов аудита (только чтение).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="button-audit-refresh"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", q.isFetching && "animate-spin")} />
            Обновить
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="button-audit-csv"
            disabled={rows.length === 0}
            onClick={() => downloadAuditCsv(rows)}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Скачать CSV (текущая страница)
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Источник аудита" className="flex flex-wrap gap-1 rounded-md bg-muted/50 p-1">
        {AUDIT_SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={urlState.source === opt.id}
            data-testid={`tab-audit-source-${opt.id}`}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              urlState.source === opt.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => {
              setDraft((d) => ({ ...d, source: opt.id, offset: 0 }));
              setUrlState({ source: opt.id, offset: 0 });
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between text-left">
                <div>
                  <CardTitle>Фильтры</CardTitle>
                  <CardDescription>Период, актор и поля источника.</CardDescription>
                </div>
                <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", filtersOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="audit-from">С даты и времени</Label>
                <Input
                  id="audit-from"
                  type="datetime-local"
                  data-testid="input-audit-filter-from"
                  value={toDatetimeLocalValue(draft.from)}
                  onChange={(e) => {
                    const iso = fromDatetimeLocalValue(e.target.value);
                    if (iso) setDraft((d) => ({ ...d, from: iso }));
                  }}
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-to">По дату и время</Label>
                <Input
                  id="audit-to"
                  type="datetime-local"
                  data-testid="input-audit-filter-to"
                  value={toDatetimeLocalValue(draft.to)}
                  onChange={(e) => {
                    const iso = fromDatetimeLocalValue(e.target.value);
                    if (iso) setDraft((d) => ({ ...d, to: iso }));
                  }}
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>Актор</Label>
                <Popover open={actorPickerOpen} onOpenChange={setActorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-audit-actor-picker"
                      className={cn("w-full justify-between font-normal", filterInputClass)}
                    >
                      <span className="truncate">
                        {selectedActor
                          ? `${selectedActor.fullName} (${selectedActor.email})`
                          : draft.actorUserId
                            ? draft.actorUserId
                            : "Все акторы"}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Поиск по имени или email…" />
                      <CommandList>
                        <CommandEmpty>Не найдено.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all-actors"
                            onSelect={() => {
                              setDraft((d) => ({ ...d, actorUserId: "" }));
                              setActorPickerOpen(false);
                            }}
                          >
                            Все акторы
                          </CommandItem>
                          {(usersQ.data?.users ?? []).map((u) => (
                            <CommandItem
                              key={u.id}
                              value={`${u.fullName} ${u.email}`}
                              onSelect={() => {
                                setDraft((d) => ({ ...d, actorUserId: u.id }));
                                setActorPickerOpen(false);
                              }}
                            >
                              {u.fullName} · {u.email}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <SourceSpecificFilters source={urlState.source} draft={draft} setDraft={setDraft} />
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
                <Button
                  type="button"
                  className="h-9 bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))] sm:h-11"
                  data-testid="button-audit-apply"
                  onClick={() => {
                    setUrlState({
                      ...draft,
                      source: urlState.source,
                      offset: 0,
                    });
                  }}
                >
                  Применить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="button-audit-reset"
                  onClick={() => {
                    const next = {
                      source: urlState.source,
                      actorUserId: "",
                      from: defaultAdminAuditUrlState().from,
                      to: defaultAdminAuditUrlState().to,
                      offset: 0,
                      action: "",
                      entityType: "",
                      entityId: "",
                      clientCode: "",
                      dealerId: "",
                      responsibleRole: "",
                      route: "",
                      responseStatus: "",
                    };
                    setDraft(next);
                    setUrlState(next);
                  }}
                >
                  Сбросить
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
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
              onClick={() => setUrlState({ offset: Math.max(0, urlState.offset - PAGE_SIZE) })}
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
              onClick={() => setUrlState({ offset: urlState.offset + PAGE_SIZE })}
            >
              Вперёд
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.isError ? (
            <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Ошибка загрузки."}</p>
          ) : null}
          <AuditTable rows={rows} onRowClick={setSelectedRow} />
        </CardContent>
      </Card>

      <Sheet open={selectedRow != null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl" data-testid="sheet-audit-details">
          <SheetHeader>
            <SheetTitle>Детали события</SheetTitle>
          </SheetHeader>
          {selectedRow ? (
            <div className="mt-4 space-y-3 overflow-auto">
              <p className="text-sm text-muted-foreground">{selectedRow.summary}</p>
              <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-all">
                {formatJson(selectedRow.details)}
              </pre>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
