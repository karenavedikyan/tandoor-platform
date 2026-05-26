/**
 * Управление приглашениями: список, создание ссылки, отзыв.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UserRole } from "@shared/auth";
import {
  allowedInviteTargetsFor,
  createInvitation,
  listInvitations,
  revokeInvitation,
  userCanManageInvitations,
  type Invitation,
} from "@/lib/invitations-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const rolesRu: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  admin: "Администратор",
};

function statusBadge(status: Invitation["status"]) {
  if (status === "accepted") {
    return (
      <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Принято
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Истекло
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-950 dark:text-amber-100">
      Ожидает
    </span>
  );
}

export default function AdminInvitationsPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [teamId, setTeamId] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [formError, setFormError] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [acceptUrl, setAcceptUrl] = useState("");
  const [copyHint, setCopyHint] = useState("");
  const [creating, setCreating] = useState(false);

  const canManage = user && userCanManageInvitations(user.role);
  const targets = useMemo(() => (user ? allowedInviteTargetsFor(user.role) : []), [user]);

  const listQ = useQuery({
    queryKey: ["invitations", "list"],
    queryFn: listInvitations,
    enabled: Boolean(canManage),
  });

  const openCreate = () => {
    setFormError("");
    setRole(targets[0] ?? "");
    setDialogOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!role) {
      setFormError("Выберите роль.");
      return;
    }
    const tid = teamId.trim();
    setCreating(true);
    try {
      const res = await createInvitation({
        email: email.trim(),
        role: role as UserRole,
        teamId: tid ? tid : null,
        fullName: inviteFullName.trim() ? inviteFullName.trim() : null,
      });
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setAcceptUrl(res.invitation.acceptUrl);
      setSuccessOpen(true);
      setDialogOpen(false);
      setEmail("");
      setRole("");
      setTeamId("");
      setInviteFullName("");
      await qc.invalidateQueries({ queryKey: ["invitations", "list"] });
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopyHint("Скопировано");
      window.setTimeout(() => setCopyHint(""), 2000);
    } catch {
      setCopyHint("Не удалось скопировать");
    }
  };

  if (!user || !canManage) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-invitations">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Нет доступа</CardTitle>
            <CardDescription>Раздел доступен только ролям, которые могут приглашать пользователей.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/main">На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const listBody = () => {
    if (listQ.isLoading) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
            Загрузка…
          </TableCell>
        </TableRow>
      );
    }
    if (listQ.isError) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
            Не удалось загрузить список.
          </TableCell>
        </TableRow>
      );
    }
    if (listQ.data?.length === 0) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
            Пока нет приглашений.
          </TableCell>
        </TableRow>
      );
    }
    return listQ.data?.map((row) => (
      <TableRow key={row.id} className="min-h-12 border-b border-border hover:bg-muted/40">
        <TableCell className="font-mono text-sm text-foreground">{row.email}</TableCell>
        <TableCell className="text-foreground">{rolesRu[row.role] ?? row.role}</TableCell>
        <TableCell>{statusBadge(row.status)}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{formatDisplayDateTime(row.expiresAt)}</TableCell>
        <TableCell className="text-right">
          {row.status === "pending" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              data-testid={`button-revoke-${row.id}`}
              onClick={async () => {
                const r = await revokeInvitation(row.id);
                if (r.ok) await qc.invalidateQueries({ queryKey: ["invitations", "list"] });
              }}
            >
              Отозвать
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-24" data-testid="page-invitations">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <Mail className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Приглашения</h1>
            <p className="text-sm text-muted-foreground">
              Создание ссылки и ручная передача приглашённому. Отправка email будет в отдельном этапе.
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="min-h-10 shrink-0 bg-primary font-semibold text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))]"
          onClick={openCreate}
          data-testid="button-invite-open"
        >
          Пригласить
        </Button>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Роль</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Статус</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Истекает</TableHead>
              <TableHead className="w-[140px] text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Действие
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{listBody()}</TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {listQ.isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">Загрузка…</div>
        ) : null}
        {listQ.isError ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-destructive shadow-sm">Не удалось загрузить список.</div>
        ) : null}
        {!listQ.isLoading && !listQ.isError && listQ.data?.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">Пока нет приглашений.</div>
        ) : null}
        {listQ.data?.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <p className="font-mono text-xs text-foreground break-all">{row.email}</p>
            <p className="mt-2 text-sm text-foreground">{rolesRu[row.role] ?? row.role}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">{statusBadge(row.status)}</div>
            <p className="mt-2 text-xs text-muted-foreground">Истекает: {formatDisplayDateTime(row.expiresAt)}</p>
            <div className="mt-3">
              {row.status === "pending" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                  data-testid={`button-revoke-${row.id}`}
                  onClick={async () => {
                    const r = await revokeInvitation(row.id);
                    if (r.ok) await qc.invalidateQueries({ queryKey: ["invitations", "list"] });
                  }}
                >
                  Отозвать
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-invite">
          <form onSubmit={submitCreate}>
            <DialogHeader>
              <DialogTitle>Новое приглашение</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-11 border-border bg-card focus-visible:ring-2 focus-visible:ring-primary"
                  data-testid="input-invite-email"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Роль</Label>
                <select
                  id="invite-role"
                  className={cn(
                    "flex h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  )}
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  data-testid="select-invite-role"
                >
                  {targets.map((r) => (
                    <option key={r} value={r}>
                      {rolesRu[r] ?? r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-team">Команда (UUID, необязательно)</Label>
                <Input
                  id="invite-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="min-h-11 border-border bg-card font-mono text-sm focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-fn">ФИО приглашённого (необязательно)</Label>
                <Input
                  id="invite-fn"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="min-h-11 border-border bg-card focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="min-h-11 bg-primary font-semibold text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))] disabled:opacity-60"
                disabled={creating}
                data-testid="button-invite-submit"
              >
                {creating ? "Создание…" : "Создать ссылку"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ссылка готова</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Передайте ссылку приглашённому любым способом.</p>
          <div className="rounded-md border border-border bg-muted p-3 font-mono text-xs break-all text-muted-foreground" data-testid="text-acceptUrl">
            {acceptUrl}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <span className="text-xs text-muted-foreground">{copyHint}</span>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyUrl()} data-testid="button-copy-accepturl">
              Скопировать ссылку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
