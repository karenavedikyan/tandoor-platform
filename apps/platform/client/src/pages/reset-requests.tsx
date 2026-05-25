import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TandoorLogo } from "@/components/tandoor-logo";
import {
  approvePasswordResetRequest,
  declinePasswordResetRequest,
  listPasswordResetRequests,
  type PasswordResetRequestItem,
} from "@/lib/reset-requests-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import type { UserRole } from "@shared/auth";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const rolesRu: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  admin: "Администратор",
};

const statusRu: Record<string, string> = {
  pending: "Ожидает",
  approved: "Одобрен",
  declined: "Отклонён",
  expired: "Истёк",
  cancelled: "Отменён",
};

function canOpenResetRequests(role: string | undefined): boolean {
  return role === "admin" || role === "director" || role === "rop";
}

export default function ResetRequestsPage() {
  const { user: apiUser, isLoading: authLoading } = useAuthUser();
  const allowed = useMemo(() => canOpenResetRequests(apiUser?.role), [apiUser?.role]);
  const [items, setItems] = useState<PasswordResetRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState("");
  const [issuedExpires, setIssuedExpires] = useState("");
  const [declineRow, setDeclineRow] = useState<PasswordResetRequestItem | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const r = await listPasswordResetRequests({ status: statusFilter, limit: 100 });
    setLoading(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setItems(r.items);
  }, [allowed, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onApprove = async (row: PasswordResetRequestItem) => {
    setBusyId(row.id);
    setError("");
    try {
      const r = await approvePasswordResetRequest(row.id);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setIssuedUrl(r.url);
      setIssuedExpires(r.expiresAt);
      setLinkDialogOpen(true);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const onDeclineConfirm = async () => {
    if (!declineRow) return;
    setBusyId(declineRow.id);
    setError("");
    try {
      const r = await declinePasswordResetRequest(declineRow.id, declineReason);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDeclineRow(null);
      setDeclineReason("");
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(issuedUrl);
    } catch {
      /* ignore */
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground" data-testid="page-reset-requests">
        Загрузка…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg p-6" data-testid="page-reset-requests">
        <Card>
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Раздел доступен администратору, директору и РОП.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/main">На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8" data-testid="page-reset-requests">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <TandoorLogo className="h-8 w-auto" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Запросы на сброс</h1>
            <p className="text-sm text-muted-foreground">Одобрение восстановления доступа сотрудникам.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="reset-req-status" className="sr-only">
            Статус
          </Label>
          <select
            id="reset-req-status"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="pending">Ожидают</option>
            <option value="approved">Одобренные</option>
            <option value="declined">Отклонённые</option>
            <option value="expired">Истёкшие</option>
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            Обновить
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список</CardTitle>
          <CardDescription>Для ожидающих запросов можно выдать ссылку или отклонить.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
          {!loading && items.length === 0 ? <p className="text-sm text-muted-foreground">Нет записей.</p> : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">ФИО</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Роль</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                  <th className="px-3 py-2 font-medium">Создан</th>
                  <th className="px-3 py-2 font-medium">Истекает</th>
                  <th className="px-3 py-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.requesterFullName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.requesterEmail}</td>
                    <td className="px-3 py-2">{rolesRu[row.requesterRole as UserRole] ?? row.requesterRole}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{statusRu[row.status] ?? row.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDisplayDateTime(row.createdAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDisplayDateTime(row.expiresAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {row.status === "pending" ? (
                          <>
                            <Button type="button" size="sm" disabled={busyId === row.id} onClick={() => void onApprove(row)}>
                              Выдать ссылку
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busyId === row.id}
                              onClick={() => {
                                setDeclineRow(row);
                                setDeclineReason("");
                              }}
                            >
                              Отклонить
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ссылка для сброса пароля</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>Действительна до {formatDisplayDateTime(issuedExpires)}.</p>
                <div className="break-all rounded-md border bg-muted/40 p-2 font-mono text-xs text-foreground">{issuedUrl}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Закрыть</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => void copyUrl()}>
              Скопировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={declineRow != null} onOpenChange={(o) => !o && setDeclineRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить запрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Запрос от {declineRow?.requesterFullName} будет отклонён. Ссылка не будет выдана.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="decline-reason">Причина (необязательно)</Label>
            <Input id="decline-reason" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => void onDeclineConfirm()} disabled={busyId != null}>
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
