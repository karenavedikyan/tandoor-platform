import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

function roleBadgeClass(role: string): string {
  const r = role as UserRole;
  if (r === "admin") return "bg-foreground text-background border-transparent";
  if (r === "director") return "bg-primary/10 text-primary border-primary/30";
  if (r === "rop") return "bg-blue-100 text-blue-700 border-blue-200";
  if (r === "manager" || r === "regional_manager") return "bg-secondary text-secondary-foreground border-secondary-border";
  if (r === "marketer" || r === "analyst") return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}

function formatRelativeRu(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true, locale: ru });
}

function RequestRowActions({
  row,
  anyBusy,
  rowBusy,
  onApprove,
  onDecline,
}: {
  row: PasswordResetRequestItem;
  anyBusy: boolean;
  rowBusy: boolean;
  onApprove: (row: PasswordResetRequestItem) => void;
  onDecline: (row: PasswordResetRequestItem) => void;
}) {
  if (row.status !== "pending") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const disabled = anyBusy;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        className="h-11 min-h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
        disabled={disabled}
        onClick={() => onApprove(row)}
      >
        {rowBusy ? "Обработка…" : "Выдать ссылку"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-11 min-h-11 rounded-md border border-destructive text-destructive hover:bg-destructive/10"
        disabled={disabled}
        onClick={() => onDecline(row)}
      >
        Отклонить
      </Button>
    </div>
  );
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
        <div className="rounded-lg border border-card-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Недостаточно прав</h1>
          <p className="mt-2 text-sm text-muted-foreground">Раздел доступен администратору, директору и РОП.</p>
          <Button asChild variant="secondary" className="mt-4 h-11 min-h-11 rounded-md">
            <Link href="/main">На главную</Link>
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 motion-reduce:transition-none md:p-8" data-testid="page-reset-requests">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Запросы на сброс пароля</h1>
          <p className="mt-1 text-sm text-muted-foreground">Одобрение восстановления доступа сотрудникам.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="reset-req-status" className="text-sm font-medium sm:sr-only">
            Статус
          </Label>
          <select
            id="reset-req-status"
            className="h-11 min-h-11 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="pending">Ожидают</option>
            <option value="approved">Одобренные</option>
            <option value="declined">Отклонённые</option>
            <option value="expired">Истёкшие</option>
          </select>
          <Button type="button" variant="outline" className="h-11 min-h-11 rounded-md" onClick={() => void refresh()} disabled={loading}>
            Обновить
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-card-border bg-card/40 px-6 py-16 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm font-medium text-foreground">Запросов нет.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="grid gap-3 md:hidden">
            {items.map((row) => (
              <div key={row.id} className="rounded-lg border border-card-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">{row.requesterFullName}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate text-xs text-muted-foreground">{row.requesterEmail}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm break-all">
                      {row.requesterEmail}
                    </TooltipContent>
                  </Tooltip>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                        roleBadgeClass(row.requesterRole),
                      )}
                    >
                      {rolesRu[row.requesterRole as UserRole] ?? row.requesterRole}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelativeRu(row.createdAt)}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <RequestRowActions row={row} anyBusy={busyId != null} rowBusy={busyId === row.id} onApprove={onApprove} onDecline={(r) => setDeclineRow(r)} />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-card-border md:block">
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
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{row.requesterFullName}</td>
                    <td className="max-w-[220px] px-3 py-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate font-mono text-xs text-muted-foreground">{row.requesterEmail}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm break-all">
                          {row.requesterEmail}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                          roleBadgeClass(row.requesterRole),
                        )}
                      >
                        {rolesRu[row.requesterRole as UserRole] ?? row.requesterRole}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="font-normal">
                        {statusRu[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatRelativeRu(row.createdAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDisplayDateTime(row.expiresAt)}</td>
                    <td className="px-3 py-2">
                      <RequestRowActions row={row} anyBusy={busyId != null} rowBusy={busyId === row.id} onApprove={onApprove} onDecline={(r) => setDeclineRow(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <AlertDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ссылка для сброса пароля</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                <p className="text-foreground">
                  Передайте ссылку сотруднику любым удобным способом. Срок действия — 60 минут. Действительна до{" "}
                  <span className="font-medium">{formatDisplayDateTime(issuedExpires)}</span>.
                </p>
                <div className="break-all rounded-md border border-input bg-muted/40 p-2 font-mono text-xs text-foreground">{issuedUrl}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 min-h-11 rounded-md">Закрыть</AlertDialogCancel>
            <AlertDialogAction type="button" className="h-11 min-h-11 rounded-md bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => void copyUrl()}>
              Скопировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={declineRow != null} onOpenChange={(o) => !o && setDeclineRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить запрос</AlertDialogTitle>
            <AlertDialogDescription>
              Запрос от {declineRow?.requesterFullName} будет отклонён. Ссылка не будет выдана.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="decline-reason">Причина (необязательно)</Label>
            <Input id="decline-reason" className={cn("h-11 min-h-11 text-base md:text-sm")} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 min-h-11 rounded-md">Нет</AlertDialogCancel>
            <AlertDialogAction type="button" className="h-11 min-h-11 rounded-md" onClick={() => void onDeclineConfirm()} disabled={busyId != null}>
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
