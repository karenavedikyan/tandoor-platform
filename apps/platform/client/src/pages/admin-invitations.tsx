/**
 * Управление приглашениями: список, создание ссылки, отзыв.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
        Accepted
      </Badge>
    );
  }
  if (status === "expired") {
    return <Badge variant="secondary">Expired</Badge>;
  }
  return <Badge variant="outline">Pending</Badge>;
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
        <Card>
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

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-24" data-testid="page-invitations">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-[#222631]">Приглашения</h1>
          <p className="text-sm text-[#8F96B0]">Создание ссылки и ручная передача приглашённому. Отправка email будет в отдельном этапе.</p>
        </div>
        <Button type="button" className="min-h-10 font-semibold" onClick={openCreate} data-testid="button-invite-open">
          Пригласить
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E3E6F3] bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Истекает</TableHead>
              <TableHead className="w-[140px] text-right">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  Загрузка…
                </TableCell>
              </TableRow>
            ) : listQ.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  Не удалось загрузить список.
                </TableCell>
              </TableRow>
            ) : listQ.data?.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  Пока нет приглашений.
                </TableCell>
              </TableRow>
            ) : (
              listQ.data?.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-sm">{row.email}</TableCell>
                  <TableCell>{rolesRu[row.role] ?? row.role}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDisplayDateTime(row.expiresAt)}</TableCell>
                  <TableCell className="text-right">
                    {row.status === "pending" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9"
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
              ))
            )}
          </TableBody>
        </Table>
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
                  className="min-h-11"
                  data-testid="input-invite-email"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Роль</Label>
                <select
                  id="invite-role"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="min-h-11 font-mono text-sm"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-fn">ФИО приглашённого (необязательно)</Label>
                <Input
                  id="invite-fn"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="min-h-11"
                />
              </div>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11 font-semibold" disabled={creating} data-testid="button-invite-submit">
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
          <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs break-all" data-testid="text-acceptUrl">
            {acceptUrl}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <span className="text-xs text-muted-foreground">{copyHint}</span>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => void copyUrl()} data-testid="button-copy-accepturl">
              Скопировать ссылку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
