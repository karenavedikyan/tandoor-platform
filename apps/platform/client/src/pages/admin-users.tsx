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
import { Badge } from "@/components/ui/badge";
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
  type AdminUser,
} from "@/lib/admin-users-api";
import { createPasswordResetLink } from "@/lib/password-reset-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { Link } from "wouter";
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

function userStatusBadge(status: UserStatus) {
  if (status === "active") {
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
        Активен
      </Badge>
    );
  }
  if (status === "invited") {
    return (
      <Badge variant="secondary" className="bg-amber-400 text-amber-950 hover:bg-amber-400">
        Приглашён
      </Badge>
    );
  }
  return <Badge variant="secondary">Отключён</Badge>;
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

  function openResetLink(row: AdminUser) {
    setLinkDialog(row);
    setLinkPayload(null);
    setLinkErr("");
  }

  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/main";

  const total = listQ.data?.total ?? 0;
  const subtitle = useMemo(() => {
    if (listQ.isLoading) return "Загрузка…";
    return `Всего записей: ${total}`;
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
        <h1 className="text-xl font-semibold text-[#222631]">Пользователи платформы</h1>
        <p className="text-sm text-[#8F96B0]">{subtitle}</p>
      </div>

      <Card className="border-[#E3E6F3]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Фильтры</CardTitle>
          <CardDescription>Поиск по email и ФИО, роль и статус.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
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
          <div className="space-y-2">
            <Label htmlFor="admin-users-role">Роль</Label>
            <select
              id="admin-users-role"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="space-y-2">
            <Label htmlFor="admin-users-status">Статус</Label>
            <select
              id="admin-users-status"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      <div className="overflow-hidden rounded-lg border border-[#E3E6F3] bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ФИО</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Последний вход</TableHead>
              <TableHead className="w-[220px] text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  Загрузка…
                </TableCell>
              </TableRow>
            ) : listQ.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-sm text-destructive">
                  Не удалось загрузить список.
                </TableCell>
              </TableRow>
            ) : listQ.data && listQ.data.users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  Пользователи не найдены.
                </TableCell>
              </TableRow>
            ) : (
              listQ.data?.users.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell className="font-mono text-sm">{row.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{rolesRu[row.role] ?? row.role}</Badge>
                  </TableCell>
                  <TableCell>{userStatusBadge(row.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.lastLoginAt ? formatDisplayDateTime(row.lastLoginAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canRole ? (
                        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => openRole(row)}>
                          Изменить роль
                        </Button>
                      ) : null}
                      {canStatus ? (
                        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => openStatus(row)}>
                          Изменить статус
                        </Button>
                      ) : null}
                      {canResetPwd ? (
                        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => openPwd(row)}>
                          Сбросить пароль
                        </Button>
                      ) : null}
                      {user && canCreateResetLink({ id: user.id, role: user.role }, { id: row.id, role: row.role }) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9"
                          data-testid={`button-reset-link-${row.id}`}
                          onClick={() => openResetLink(row)}
                        >
                          Ссылка для смены пароля
                        </Button>
                      ) : null}
                    </div>
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
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
