/**
 * Назначения клиентов: список, фильтры, массовое переназначение, история.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { History, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveList, ResponsiveListDesktop, ResponsiveListMobile, ResponsiveListMobileItem } from "@/components/ui/responsive-list";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { listUsers, type AdminUser } from "@/lib/admin-users-api";
import {
  getClientHistory,
  listAssignments,
  listTeams,
  reassignClients,
  type ClientAssignmentHistoryRow,
  type ClientAssignmentRow,
  type AdminTeamOption,
} from "@/lib/client-assignments-api";
import { userCanManageInvitations, userHas } from "@/lib/auth-rbac";
import { canManageClientAssignments, defaultHomePathForUserRole } from "@/lib/auth-access";
import { cn } from "@/lib/utils";

const LIMIT = 50;

const ctaButtonClass =
  "min-h-11 bg-primary text-primary-foreground shadow-sm hover:bg-[#86B832] focus-visible:ring-primary";

function AssignmentHistoryPopover({ clientCode }: { clientCode: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["client-assignments", "history-preview", clientCode],
    queryFn: async () => {
      const r = await getClientHistory(clientCode);
      if (!r.ok) throw new Error(r.message);
      return r.items.slice(0, 5);
    },
    enabled: open,
    staleTime: 30_000,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="История назначений">
          <History className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        ) : q.isError ? (
          <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Ошибка"}</p>
        ) : !q.data?.length ? (
          <p className="text-sm text-muted-foreground">Нет записей</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
            {q.data.map((h) => (
              <li key={h.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <div className="font-medium text-foreground">{formatDisplayDateTime(h.createdAt)}</div>
                <div className="text-muted-foreground">{h.reason ?? "—"}</div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function AdminClientAssignmentsPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canPage = Boolean(user && canManageClientAssignments(user.role));
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/";

  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(searchInput), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [teamIdFilter, setTeamIdFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [searchDebounced, userIdFilter, teamIdFilter]);

  const teamsQ = useQuery({
    queryKey: ["client-assignments", "teams"],
    queryFn: async () => {
      const r = await listTeams();
      if (!r.ok) throw new Error(r.message);
      return r.teams;
    },
    enabled: canPage,
  });

  const usersQ = useQuery({
    queryKey: ["client-assignments", "users-active"],
    queryFn: async () => {
      const r = await listUsers({ status: "active", limit: 200, offset: 0 });
      if (!r.ok) throw new Error(r.message);
      return r.result.users;
    },
    enabled: canPage,
  });

  const listQ = useQuery({
    queryKey: ["client-assignments", "list", searchDebounced, userIdFilter, teamIdFilter, offset],
    queryFn: async () => {
      const r = await listAssignments({
        limit: LIMIT,
        offset,
        search: searchDebounced.trim() || undefined,
        userId: userIdFilter || undefined,
        teamId: teamIdFilter || undefined,
      });
      if (!r.ok) throw new Error(r.message);
      return r;
    },
    enabled: canPage,
  });

  const items: ClientAssignmentRow[] = listQ.data?.ok ? listQ.data.items : [];
  const total = listQ.data?.ok ? listQ.data.total : 0;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setSelected({});
  }, [items, offset, searchDebounced, userIdFilter, teamIdFilter]);

  const selectedCodes = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedCount = selectedCodes.length;

  const allOnPageSelected = items.length > 0 && items.every((r) => selected[r.clientCode]);
  const toggleAllOnPage = (checked: boolean) => {
    const next: Record<string, boolean> = { ...selected };
    for (const r of items) {
      if (checked) next[r.clientCode] = true;
      else delete next[r.clientCode];
    }
    setSelected(next);
  };

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkToUserId, setBulkToUserId] = useState<string>("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [sheetCode, setSheetCode] = useState<string | null>(null);
  const sheetQ = useQuery({
    queryKey: ["client-assignments", "history-full", sheetCode],
    queryFn: async () => {
      if (!sheetCode) return [] as ClientAssignmentHistoryRow[];
      const r = await getClientHistory(sheetCode);
      if (!r.ok) throw new Error(r.message);
      return r.items;
    },
    enabled: Boolean(sheetCode),
  });

  const canPrev = offset > 0;
  const canNext = offset + LIMIT < total;

  const teams: AdminTeamOption[] = teamsQ.data ?? [];
  const users: AdminUser[] = usersQ.data ?? [];

  if (!user || !canManageClientAssignments(user.role)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-admin-client-assignments">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Раздел доступен только администратору, директору или РОПу.</CardDescription>
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-admin-client-assignments">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {userHas(user.role, "users.list") ? (
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/admin/users">Пользователи</Link>
          </Button>
        ) : null}
        {userCanManageInvitations(user.role) ? (
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/admin/invitations">Приглашения</Link>
          </Button>
        ) : null}
        {userHas(user.role, "audit.read") ? (
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/admin/audit">Журнал событий</Link>
          </Button>
        ) : null}
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">Назначения клиентов</h1>
        <p className="text-sm text-muted-foreground">
          Актуальные ответственные по кодам клиентов. РОП видит только свою команду (ограничение на сервере).
        </p>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>Поиск по коду клиента, ответственный и команда (необязательно).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[200px]">
            <Label htmlFor="ca-search">Поиск по коду</Label>
            <Input
              id="ca-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Например MA-MA085529"
              className="min-h-11"
              data-testid="input-client-assignments-search"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[220px]">
            <Label>Ответственный</Label>
            <Select value={userIdFilter || "all"} onValueChange={(v) => setUserIdFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="min-h-11" data-testid="select-client-assignments-user">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[220px]">
            <Label>Команда</Label>
            <Select value={teamIdFilter || "all"} onValueChange={(v) => setTeamIdFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="min-h-11" data-testid="select-client-assignments-team">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedCount > 0 ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
          data-testid="toolbar-client-assignments-bulk"
        >
          <div className="text-sm text-muted-foreground">
            Выбрано: <span className="font-semibold text-foreground">{selectedCount}</span>
          </div>
          <Button type="button" className={ctaButtonClass} onClick={() => setBulkOpen(true)} data-testid="button-client-assignments-bulk">
            Переназначить выбранных
          </Button>
        </div>
      ) : null}

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Список</CardTitle>
            <CardDescription>
              {listQ.isFetching ? "Обновление…" : null} Всего: {total}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={!canPrev || listQ.isFetching}
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              data-testid="button-client-assignments-prev"
            >
              Назад
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={!canNext || listQ.isFetching}
              onClick={() => setOffset((o) => o + LIMIT)}
              data-testid="button-client-assignments-next"
            >
              Вперёд
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          {listQ.isError ? (
            <p className="p-4 text-sm text-destructive">{(listQ.error as Error)?.message ?? "Ошибка загрузки"}</p>
          ) : listQ.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загрузка…
            </div>
          ) : (
            <ResponsiveList>
              <ResponsiveListDesktop>
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(v) => toggleAllOnPage(v === true)}
                        aria-label="Выбрать все на странице"
                        data-testid="checkbox-client-assignments-select-all"
                      />
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Код клиента</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Ответственный</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Команда</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Назначен с</TableHead>
                    <TableHead className="w-24 px-2 py-1.5 text-right text-xs">История</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.clientCode} className="h-10">
                      <TableCell className="px-2 py-1.5">
                        <Checkbox
                          checked={Boolean(selected[row.clientCode])}
                          onCheckedChange={(v) => {
                            setSelected((prev) => {
                              const n = { ...prev };
                              if (v === true) n[row.clientCode] = true;
                              else delete n[row.clientCode];
                              return n;
                            });
                          }}
                          aria-label={`Выбрать ${row.clientCode}`}
                          data-testid={`checkbox-client-${row.clientCode}`}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <button
                          type="button"
                          className={cn("font-mono text-sm text-primary underline-offset-4 hover:underline")}
                          onClick={() => setSheetCode(row.clientCode)}
                          data-testid={`link-client-code-${row.clientCode}`}
                        >
                          {row.clientCode}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate px-2 py-1.5 text-sm">{row.responsibleFullName}</TableCell>
                      <TableCell className="max-w-[220px] truncate px-2 py-1.5 text-sm">{row.teamName ?? row.teamId ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap px-2 py-1.5 text-xs text-muted-foreground">
                        {formatDisplayDateTime(row.since)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right">
                        <AssignmentHistoryPopover clientCode={row.clientCode} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </ResponsiveListDesktop>
              <ResponsiveListMobile>
                {items.map((row) => (
                  <ResponsiveListMobileItem key={row.clientCode}>
                    <Checkbox
                      checked={Boolean(selected[row.clientCode])}
                      onCheckedChange={(v) => {
                        setSelected((prev) => {
                          const n = { ...prev };
                          if (v === true) n[row.clientCode] = true;
                          else delete n[row.clientCode];
                          return n;
                        });
                      }}
                      aria-label={`Выбрать ${row.clientCode}`}
                      data-testid={`checkbox-client-m-${row.clientCode}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 truncate font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline"
                          onClick={() => setSheetCode(row.clientCode)}
                          data-testid={`link-client-code-m-${row.clientCode}`}
                        >
                          {row.clientCode}
                        </button>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatDisplayDateTime(row.since)}</span>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-foreground">{row.responsibleFullName}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.teamName ?? row.teamId ?? "—"}</div>
                    </div>
                    <div className="shrink-0">
                      <AssignmentHistoryPopover clientCode={row.clientCode} />
                    </div>
                  </ResponsiveListMobileItem>
                ))}
              </ResponsiveListMobile>
            </ResponsiveList>
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Переназначить выбранных</DialogTitle>
            <DialogDescription>Будет переназначено клиентов: {selectedCount}. Целевой пользователь должен состоять в команде.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Новый ответственный</Label>
              <Select value={bulkToUserId || undefined} onValueChange={(v) => setBulkToUserId(v)}>
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Причина (необязательно)</Label>
              <Input id="bulk-reason" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} className="min-h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              className={ctaButtonClass}
              disabled={!bulkToUserId || selectedCount === 0 || bulkLoading}
              onClick={async () => {
                if (!bulkToUserId || selectedCount === 0) return;
                setBulkLoading(true);
                try {
                  const r = await reassignClients({
                    clientCodes: selectedCodes,
                    toUserId: bulkToUserId,
                    reason: bulkReason.trim() || undefined,
                  });
                  if (!r.ok) {
                    toast({ title: r.message, variant: "destructive" });
                    return;
                  }
                  toast({ title: `Переназначено: ${r.reassigned}` });
                  setBulkOpen(false);
                  setBulkReason("");
                  setBulkToUserId("");
                  await qc.invalidateQueries({ queryKey: ["client-assignments"] });
                } finally {
                  setBulkLoading(false);
                }
              }}
            >
              {bulkLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение…
                </>
              ) : (
                "Переназначить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetCode != null} onOpenChange={(o) => !o && setSheetCode(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>История клиента</SheetTitle>
            <SheetDescription className="font-mono">{sheetCode}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto">
            {sheetQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка…
              </div>
            ) : sheetQ.isError ? (
              <p className="text-sm text-destructive">{(sheetQ.error as Error)?.message}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Когда</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead>Кто</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sheetQ.data ?? []).map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDisplayDateTime(h.createdAt)}</TableCell>
                      <TableCell className="text-xs">{h.reason ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.actorFullName ?? h.actorUserId ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
