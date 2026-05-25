/**
 * Управление пользователями платформы: список, фильтры, смена роли / статуса, сброс пароля.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UserRole, UserStatus } from "@shared/auth";
import { BUSINESS_ROLES } from "@shared/auth";
import {
  listUsers,
  resetUserPassword,
  updateUserRole,
  updateUserStatus,
  updateUserTelegram,
  type AdminUser,
} from "@/lib/admin-users-api";
import { createPasswordResetLink } from "@/lib/password-reset-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { Link } from "wouter";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { userHas } from "@/lib/auth-rbac";
import { canCreateResetLink, defaultHomePathForUserRole } from "@/lib/auth-access";

const rolesRu: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  admin: "Администратор",
};

function roleBadgeClass(role: UserRole): string {
  if (role === "admin") return "border-transparent bg-foreground text-background";
  if (role === "director") return "border-primary/30 bg-primary/10 text-primary";
  if (role === "rop") return "border-blue-200 bg-blue-100 text-blue-700";
  if (role === "manager" || role === "regional_manager") return "border-secondary-border bg-secondary text-secondary-foreground";
  if (role === "marketer" || role === "analyst") return "border-border bg-muted text-muted-foreground";
  return "border-border bg-muted text-muted-foreground";
}

function userStatusBadge(status: UserStatus) {
  if (status === "active") {
    return (
      <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Активен
      </span>
    );
  }
  if (status === "invited") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Приглашён
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground line-through">
      Отключён
    </span>
  );
}

const LIMIT = 50;

export default function AdminUsersPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const canList = Boolean(user && userHas(user.role, "users.list"));

  const [qInput, setQInput] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(qInput), 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [qDebounced, roleFilter, statusFilter]);

  const listQ = useQuery({
    queryKey: ["admin-users", "list", qDebounced, roleFilter, statusFilter, offset],
    queryFn: async () => {
      const r = await listUsers({
        q: qDebounced.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        limit: LIMIT,
        offset,
      });
      if (!r.ok) throw new Error(r.message);
      return r.result;
    },
    enabled: canList,
  });

  const [roleDialog, setRoleDialog] = useState<AdminUser | null>(null);
  const [rolePick, setRolePick] = useState<UserRole | "">("");
  const [roleErr, setRoleErr] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);

  const [statusDialog, setStatusDialog] = useState<AdminUser | null>(null);
  const [statusPick, setStatusPick] = useState<"active" | "disabled" | "">("");
  const [statusErr, setStatusErr] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const [pwdDialog, setPwdDialog] = useState<AdminUser | null>(null);
  const [pwdErr, setPwdErr] = useState("");
  const [pwdWorking, setPwdWorking] = useState(false);
  const [pwdResult, setPwdResult] = useState<{ tempPassword: string } | null>(null);

  const [linkDialog, setLinkDialog] = useState<AdminUser | null>(null);
  const [linkPayload, setLinkPayload] = useState<{ token: string; link: string; expiresAt: string } | null>(null);
  const [linkErr, setLinkErr] = useState("");
  const [linkWorking, setLinkWorking] = useState(false);

  const canRole = Boolean(user && userHas(user.role, "users.update_role"));
  const canStatus = Boolean(user && userHas(user.role, "users.update_status"));
  const canResetPwd = Boolean(user && userHas(user.role, "users.reset_password"));
  const canEditAdminTelegram = Boolean(user?.role === "admin" && canRole);

  const [telegramDraftByUserId, setTelegramDraftByUserId] = useState<Record<string, string>>({});
  const [telegramSavingId, setTelegramSavingId] = useState<string | null>(null);
  const [telegramErrByUserId, setTelegramErrByUserId] = useState<Record<string, string>>({});

  function openResetLink(row: AdminUser) {
    setLinkDialog(row);
    setLinkPayload(null);
    setLinkErr("");
  }

  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";

  const total = listQ.data?.total ?? 0;
  const subtitle = useMemo(() => {
    if (listQ.isLoading) return "Загрузка…";
    return `Всего: ${total}`;
  }, [listQ.isLoading, total]);

  if (!user || !canList) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-admin-users">
        <Card>
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Раздел «Пользователи платформы» доступен только при наличии права users.list.</CardDescription>
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

  const openRole = (u: AdminUser) => {
    setRoleErr("");
    const first = BUSINESS_ROLES.find((r) => r !== u.role) ?? BUSINESS_ROLES[0] ?? "";
    setRolePick(first);
    setRoleDialog(u);
  };

  const openStatus = (u: AdminUser) => {
    setStatusErr("");
    setStatusPick(u.status === "active" ? "disabled" : "active");
    setStatusDialog(u);
  };

  const openPwd = (u: AdminUser) => {
    setPwdErr("");
    setPwdResult(null);
    setPwdDialog(u);
  };

  const invalidateList = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-24" data-testid="page-admin-users">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Пользователи платформы</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="border-card-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Фильтры</CardTitle>
          <CardDescription>Поиск по email и ФИО, роль и статус.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-0 flex-1 space-y-2 md:min-w-[200px]">
            <Label htmlFor="admin-users-q">Поиск</Label>
            <Input
              id="admin-users-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Email или ФИО"
              className="min-h-11"
              data-testid="input-admin-users-search"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 md:min-w-[160px]">
            <Label htmlFor="admin-users-role">Роль</Label>
            <select
              id="admin-users-role"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
              data-testid="select-admin-users-role"
            >
              <option value="">Все</option>
              {BUSINESS_ROLES.map((r) => (
                <option key={r} value={r}>
                  {rolesRu[r] ?? r}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 space-y-2 md:min-w-[160px]">
            <Label htmlFor="admin-users-status">Статус</Label>
            <select
              id="admin-users-status"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | "")}
              data-testid="select-admin-users-status"
            >
              <option value="">Все</option>
              <option value="active">Активен</option>
              <option value="invited">Приглашён</option>
              <option value="disabled">Отключён</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:hidden">
        {listQ.isLoading ? (
          <div className="rounded-lg border border-card-border bg-card p-6 text-center text-sm text-muted-foreground">Загрузка…</div>
        ) : null}
        {listQ.isError ? (
          <div className="rounded-lg border border-destructive/40 bg-card p-6 text-center text-sm text-destructive">Не удалось загрузить список.</div>
        ) : null}
        {listQ.data && listQ.data.users.length === 0 ? (
          <div className="rounded-lg border border-card-border bg-card p-6 text-center text-sm text-muted-foreground">Пользователи не найдены.</div>
        ) : null}
        {listQ.data?.users.map((row) => (
          <div key={row.id} className="rounded-lg border border-card-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{row.fullName}</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.email}</p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm break-all">
                    {row.email}
                  </TooltipContent>
                </Tooltip>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", roleBadgeClass(row.role))}>
                    {rolesRu[row.role] ?? row.role}
                  </span>
                  {userStatusBadge(row.status)}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-11 min-h-11 w-11 min-w-11 shrink-0" aria-label="Действия">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem]">
                  {canRole ? (
                    <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openRole(row)}>
                      Сменить роль
                    </DropdownMenuItem>
                  ) : null}
                  {user && canCreateResetLink({ id: user.id, role: user.role }, { id: row.id, role: row.role }) ? (
                    <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openResetLink(row)}>
                      Сбросить пароль (ссылка)
                    </DropdownMenuItem>
                  ) : null}
                  {canResetPwd ? (
                    <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openPwd(row)}>
                      Сбросить пароль (временный)
                    </DropdownMenuItem>
                  ) : null}
                  {canStatus && row.status === "disabled" ? (
                    <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openStatus(row)}>
                      Снять блокировку входа
                    </DropdownMenuItem>
                  ) : null}
                  {canStatus && row.status !== "disabled" ? (
                    <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openStatus(row)}>
                      Изменить статус
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-card-border bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ФИО</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Команда</TableHead>
              <TableHead>Последний вход</TableHead>
              <TableHead className="min-w-[200px]">Telegram user-id</TableHead>
              <TableHead className="w-[72px] text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                  Загрузка…
                </TableCell>
              </TableRow>
            ) : listQ.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="h-24 text-center text-sm text-destructive">
                  Не удалось загрузить список.
                </TableCell>
              </TableRow>
            ) : listQ.data && listQ.data.users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                  Пользователи не найдены.
                </TableCell>
              </TableRow>
            ) : (
              listQ.data?.users.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell className="max-w-[220px] font-mono text-sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate">{row.email}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm break-all">
                        {row.email}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", roleBadgeClass(row.role))}>
                      {rolesRu[row.role] ?? row.role}
                    </span>
                  </TableCell>
                  <TableCell>{userStatusBadge(row.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.lastLoginAt ? formatDisplayDateTime(row.lastLoginAt) : "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    {row.role === "admin" && canEditAdminTelegram ? (
                      <div className="flex max-w-[260px] flex-col gap-1">
                        <Input
                          inputMode="numeric"
                          className="h-9 font-mono text-xs"
                          placeholder="Не задано"
                          data-testid={`input-user-telegram-id-${row.id}`}
                          value={
                            Object.prototype.hasOwnProperty.call(telegramDraftByUserId, row.id)
                              ? telegramDraftByUserId[row.id]!
                              : row.telegramUserId != null
                                ? String(row.telegramUserId)
                                : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setTelegramDraftByUserId((prev) => ({ ...prev, [row.id]: v }));
                            setTelegramErrByUserId((prev) => {
                              if (!prev[row.id]) return prev;
                              const next = { ...prev };
                              delete next[row.id];
                              return next;
                            });
                          }}
                        />
                        {telegramErrByUserId[row.id] ? (
                          <p className="text-xs text-destructive">{telegramErrByUserId[row.id]}</p>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 self-start"
                          disabled={telegramSavingId === row.id}
                          onClick={async () => {
                            const raw = Object.prototype.hasOwnProperty.call(telegramDraftByUserId, row.id)
                              ? telegramDraftByUserId[row.id]!.trim()
                              : row.telegramUserId != null
                                ? String(row.telegramUserId)
                                : "";
                            let next: number | null = null;
                            if (!raw) {
                              next = null;
                            } else {
                              const n = Number(raw);
                              if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
                                setTelegramErrByUserId((prev) => ({
                                  ...prev,
                                  [row.id]: "Укажите целое число больше нуля или оставьте пустым.",
                                }));
                                return;
                              }
                              next = n;
                            }
                            setTelegramSavingId(row.id);
                            setTelegramErrByUserId((prev) => {
                              const nextMap = { ...prev };
                              delete nextMap[row.id];
                              return nextMap;
                            });
                            try {
                              const r = await updateUserTelegram(row.id, next);
                              if (!r.ok) {
                                setTelegramErrByUserId((prev) => ({ ...prev, [row.id]: r.message }));
                                return;
                              }
                              setTelegramDraftByUserId((prev) => {
                                const nmap = { ...prev };
                                delete nmap[row.id];
                                return nmap;
                              });
                              await invalidateList();
                            } finally {
                              setTelegramSavingId(null);
                            }
                          }}
                        >
                          {telegramSavingId === row.id ? "Сохранение…" : "Сохранить"}
                        </Button>
                      </div>
                    ) : row.role === "admin" ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.telegramUserId != null ? String(row.telegramUserId) : "—"}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 min-h-11 w-11 min-w-11"
                          aria-label="Действия"
                          data-testid={`button-user-actions-${row.id}`}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[14rem]">
                        {canRole ? (
                          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openRole(row)}>
                            Сменить роль
                          </DropdownMenuItem>
                        ) : null}
                        {user && canCreateResetLink({ id: user.id, role: user.role }, { id: row.id, role: row.role }) ? (
                          <DropdownMenuItem
                            className="min-h-11 cursor-pointer"
                            data-testid={`button-reset-link-${row.id}`}
                            onClick={() => openResetLink(row)}
                          >
                            Сбросить пароль (ссылка)
                          </DropdownMenuItem>
                        ) : null}
                        {canResetPwd ? (
                          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openPwd(row)}>
                            Сбросить пароль (временный)
                          </DropdownMenuItem>
                        ) : null}
                        {canStatus && row.status === "disabled" ? (
                          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openStatus(row)}>
                            Снять блокировку входа
                          </DropdownMenuItem>
                        ) : null}
                        {canStatus && row.status !== "disabled" ? (
                          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => openStatus(row)}>
                            Изменить статус
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Показано {listQ.data ? `${offset + 1}–${Math.min(offset + LIMIT, total)}` : "—"} из {total}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={offset <= 0 || listQ.isLoading} onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}>
            Назад
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={listQ.isLoading || !listQ.data || offset + LIMIT >= total}
            onClick={() => setOffset((o) => o + LIMIT)}
          >
            Вперёд
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(linkDialog)}
        onOpenChange={(o) => {
          if (!o) {
            setLinkDialog(null);
            setLinkPayload(null);
            setLinkErr("");
          }
        }}
      >
        <DialogContent className="max-w-lg" data-testid="dialog-admin-users-reset-link">
          <DialogHeader>
            <DialogTitle>Ссылка для смены пароля</DialogTitle>
            <DialogDescription className="pt-1 text-left">
              {linkDialog ? (
                <>
                  <span className="font-mono text-xs">{linkDialog.email}</span>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Эта ссылка показывается один раз. Сохраните её и передайте пользователю.
                  </p>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {linkPayload ? (
            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label>Ссылка</Label>
                <Textarea readOnly className="min-h-[72px] font-mono text-xs" value={linkPayload.link} />
              </div>
              <p className="text-sm text-muted-foreground">
                Срок действия:{" "}
                {(() => {
                  const d = new Date(linkPayload.expiresAt);
                  if (!Number.isFinite(d.getTime())) return "—";
                  const dd = String(d.getDate()).padStart(2, "0");
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const yyyy = d.getFullYear();
                  const hh = String(d.getHours()).padStart(2, "0");
                  const min = String(d.getMinutes()).padStart(2, "0");
                  return `${dd}.${mm}.${yyyy}, ${hh}:${min}`;
                })()}
              </p>
              {linkErr ? <p className="text-sm text-destructive">{linkErr}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нажмите «Создать», чтобы получить ссылку.</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              data-testid="button-copy-reset-link"
              disabled={!linkPayload}
              onClick={async () => {
                if (!linkPayload) return;
                try {
                  await navigator.clipboard.writeText(linkPayload.link);
                } catch {
                  setLinkErr("Не удалось скопировать в буфер обмена.");
                }
              }}
            >
              Скопировать
            </Button>
            <Button
              type="button"
              disabled={linkWorking || !linkDialog || Boolean(linkPayload)}
              onClick={async () => {
                if (!linkDialog) return;
                setLinkWorking(true);
                setLinkErr("");
                try {
                  const r = await createPasswordResetLink(linkDialog.id);
                  if (!r.ok) {
                    setLinkErr(r.message);
                    return;
                  }
                  setLinkPayload(r.result);
                } finally {
                  setLinkWorking(false);
                }
              }}
            >
              Создать ссылку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(roleDialog)} onOpenChange={(o) => !o && setRoleDialog(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-admin-users-role">
          <DialogHeader>
            <DialogTitle>Изменить роль</DialogTitle>
            <DialogDescription className="pt-1 text-left">
              {roleDialog ? (
                <>
                  <span className="font-mono text-xs">{roleDialog.email}</span>
                  <br />
                  Текущая роль: <strong>{rolesRu[roleDialog.role] ?? roleDialog.role}</strong>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-role-pick">Новая роль</Label>
              <select
                id="admin-role-pick"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={rolePick}
                onChange={(e) => setRolePick(e.target.value as UserRole)}
              >
                {BUSINESS_ROLES.map((r) => (
                  <option key={r} value={r} disabled={roleDialog ? r === roleDialog.role : false}>
                    {rolesRu[r] ?? r}
                  </option>
                ))}
              </select>
            </div>
            {roleErr ? <p className="text-sm text-destructive">{roleErr}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoleDialog(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="font-semibold"
              disabled={roleSaving || !roleDialog || !rolePick || rolePick === roleDialog.role}
              onClick={async () => {
                if (!roleDialog || !rolePick) return;
                setRoleSaving(true);
                setRoleErr("");
                try {
                  const r = await updateUserRole(roleDialog.id, rolePick as UserRole);
                  if (!r.ok) {
                    setRoleErr(r.message);
                    return;
                  }
                  setRoleDialog(null);
                  await invalidateList();
                } finally {
                  setRoleSaving(false);
                }
              }}
            >
              {roleSaving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(statusDialog)} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-admin-users-status">
          <DialogHeader>
            <DialogTitle>Изменить статус</DialogTitle>
            <DialogDescription className="pt-1 text-left">
              {statusDialog ? (
                <>
                  <span className="font-mono text-xs">{statusDialog.email}</span>
                  <br />
                  Текущий статус: <strong>{statusDialog.status}</strong>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-status-pick">Новый статус</Label>
              <select
                id="admin-status-pick"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={statusPick}
                onChange={(e) => setStatusPick(e.target.value as "active" | "disabled")}
              >
                <option value="active">Активен</option>
                <option value="disabled">Отключён</option>
              </select>
            </div>
            {statusPick === "disabled" ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">Все сессии пользователя будут завершены.</p>
            ) : null}
            {statusErr ? <p className="text-sm text-destructive">{statusErr}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusDialog(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="font-semibold"
              disabled={statusSaving || !statusDialog || !statusPick || statusPick === statusDialog.status}
              onClick={async () => {
                if (!statusDialog || !statusPick) return;
                setStatusSaving(true);
                setStatusErr("");
                try {
                  const r = await updateUserStatus(statusDialog.id, statusPick);
                  if (!r.ok) {
                    setStatusErr(r.message);
                    return;
                  }
                  setStatusDialog(null);
                  await invalidateList();
                } finally {
                  setStatusSaving(false);
                }
              }}
            >
              {statusSaving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pwdDialog)}
        onOpenChange={(o) => {
          if (!o) {
            setPwdDialog(null);
            setPwdResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-admin-users-password">
          {!pwdResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Сбросить пароль</DialogTitle>
                <DialogDescription>
                  Будет сгенерирован временный пароль, все сессии пользователя будут завершены.
                  {pwdDialog ? (
                    <>
                      <br />
                      <span className="font-mono text-xs">{pwdDialog.email}</span>
                    </>
                  ) : null}
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                {pwdErr ? <p className="text-sm text-destructive">{pwdErr}</p> : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPwdDialog(null)}>
                  Отмена
                </Button>
                <Button
                  type="button"
                  className="font-semibold"
                  disabled={pwdWorking || !pwdDialog}
                  onClick={async () => {
                    if (!pwdDialog) return;
                    setPwdWorking(true);
                    setPwdErr("");
                    try {
                      const r = await resetUserPassword(pwdDialog.id);
                      if (!r.ok) {
                        setPwdErr(r.message);
                        return;
                      }
                      setPwdResult({ tempPassword: r.tempPassword });
                    } finally {
                      setPwdWorking(false);
                    }
                  }}
                >
                  {pwdWorking ? "Выполняется…" : "Подтвердить"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Временный пароль</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="rounded-md border bg-muted px-3 py-4 text-center font-mono text-2xl font-semibold tracking-wide">
                  {pwdResult.tempPassword}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pwdResult.tempPassword);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Скопировать
                </Button>
                <p className="text-sm text-muted-foreground">
                  Покажите пользователю один раз — пароль больше нигде не сохраняется. При входе он будет обязан сменить его.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  className="font-semibold"
                  onClick={async () => {
                    setPwdDialog(null);
                    setPwdResult(null);
                    await invalidateList();
                  }}
                >
                  Закрыть
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
