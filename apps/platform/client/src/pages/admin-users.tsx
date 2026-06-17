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
import { BackNav } from "@/components/navigation/back-nav";
import { AdminUsersSkeleton } from "@/components/skeletons/admin-users-skeleton";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { Database, LogIn, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { buildUserHierarchy } from "@/lib/admin-users-hierarchy";
import { AdminUsersDesktopPanels, AdminUsersMobilePanels } from "@/pages/admin-users-listing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { getUserTeamHistory, listTeams, reassignUserTeam } from "@/lib/client-assignments-api";

import { userHas } from "@/lib/auth-rbac";
import { useStartImpersonation } from "@/lib/use-impersonation";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";
import { canCreateResetLink, defaultHomePathForUserRole } from "@/lib/auth-access";

const rolesRu: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  category_manager: "Категорийный менеджер",
  admin: "Администратор",
};

function roleBadgeClass(role: UserRole): string {
  if (role === "admin") return "border-transparent bg-foreground text-background";
  if (role === "director") return "border-primary/30 bg-primary/10 text-primary";
  if (role === "rop") return "border-blue-200 bg-blue-100 text-blue-700";
  if (role === "manager" || role === "regional_manager") return "border-secondary-border bg-secondary text-secondary-foreground";
  if (role === "marketer" || role === "analyst" || role === "category_manager")
    return "border-border bg-muted text-muted-foreground";
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



function AdminUserActionsDropdown({
  row,
  viewer,
  canRole,
  canResetPwd,
  canStatus,
  canTeam = false,
  onRole,
  onResetLink,
  onPwd,
  onStatus,
  onTeamChange,
  onTeamHistory,
  triggerTestId,
}: {
  row: AdminUser;
  viewer?: { id: string; role: UserRole };
  canRole: boolean;
  canResetPwd: boolean;
  canStatus: boolean;
  canTeam?: boolean;
  onRole: (u: AdminUser) => void;
  onResetLink: (u: AdminUser) => void;
  onPwd: (u: AdminUser) => void;
  onStatus: (u: AdminUser) => void;
  onTeamChange?: (u: AdminUser) => void;
  onTeamHistory?: (u: AdminUser) => void;
  triggerTestId?: string;
}) {
  const canLink = Boolean(viewer && canCreateResetLink({ id: viewer.id, role: viewer.role }, { id: row.id, role: row.role }));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-11 min-h-11 w-11 min-w-11 shrink-0" aria-label="Действия" data-testid={triggerTestId}>
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        {canRole ? (
          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => onRole(row)}>
            Сменить роль
          </DropdownMenuItem>
        ) : null}
        {canLink ? (
          <DropdownMenuItem className="min-h-11 cursor-pointer" data-testid={`button-reset-link-${row.id}`} onClick={() => onResetLink(row)}>
            Сбросить пароль (ссылка)
          </DropdownMenuItem>
        ) : null}
        {canResetPwd ? (
          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => onPwd(row)}>
            Сбросить пароль (временный)
          </DropdownMenuItem>
        ) : null}
        {canStatus && row.status === "disabled" ? (
          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => onStatus(row)}>
            Снять блокировку входа
          </DropdownMenuItem>
        ) : null}
        {canStatus && row.status !== "disabled" ? (
          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => onStatus(row)}>
            Изменить статус
          </DropdownMenuItem>
        ) : null}
        {canTeam && onTeamChange ? (
          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => onTeamChange(row)}>
            Сменить команду
          </DropdownMenuItem>
        ) : null}
        {canTeam && onTeamHistory ? (
          <DropdownMenuItem className="min-h-11 cursor-pointer" onClick={() => onTeamHistory(row)}>
            История смены команды
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


const LIMIT = 50;
const HIERARCHY_LIMIT = 200;

export default function AdminUsersPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const canList = Boolean(user && userHas(user.role, "users.list"));
  const { toast } = useToast();
  const canTeamMgmt = Boolean(user && (user.role === "admin" || user.role === "director"));

  const [qInput, setQInput] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(qInput), 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [offset, setOffset] = useState(0);

  const hierarchyMode = useMemo(
    () => !qDebounced.trim() && !roleFilter && !statusFilter,
    [qDebounced, roleFilter, statusFilter],
  );

  const [expandedRop, setExpandedRop] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOffset(0);
  }, [qDebounced, roleFilter, statusFilter]);

  const listQ = useQuery({
    queryKey: ["admin-users", "list", qDebounced, roleFilter, statusFilter, offset, hierarchyMode],
    queryFn: async () => {
      const r = await listUsers({
        q: hierarchyMode ? undefined : qDebounced.trim() || undefined,
        role: hierarchyMode ? undefined : roleFilter || undefined,
        status: hierarchyMode ? undefined : statusFilter || undefined,
        limit: hierarchyMode ? HIERARCHY_LIMIT : LIMIT,
        offset: hierarchyMode ? 0 : offset,
      });
      if (!r.ok) throw new Error(r.message);
      return r.result;
    },
    enabled: canList,
  });

  const hierarchy = useMemo(() => {
    if (!hierarchyMode || !listQ.data?.users) return null;
    return buildUserHierarchy(listQ.data.users);
  }, [hierarchyMode, listQ.data?.users]);

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
  const canImpersonate = Boolean(user && userHas(user.role, "users.impersonate"));
  const startImpersonation = useStartImpersonation();
  const canEditAdminTelegram = Boolean(user?.role === "admin" && canRole);

  const [telegramDraftByUserId, setTelegramDraftByUserId] = useState<Record<string, string>>({});
  const [telegramSavingId, setTelegramSavingId] = useState<string | null>(null);
  const [telegramErrByUserId, setTelegramErrByUserId] = useState<Record<string, string>>({});
  const [teamMoveDialog, setTeamMoveDialog] = useState<AdminUser | null>(null);
  const [teamMoveToId, setTeamMoveToId] = useState<string>("");
  const [teamMoveReason, setTeamMoveReason] = useState("");
  const [teamMoveSaving, setTeamMoveSaving] = useState(false);
  const [teamHistoryUser, setTeamHistoryUser] = useState<AdminUser | null>(null);

  const teamsForMoveQ = useQuery({
    queryKey: ["admin-users", "teams-for-move"],
    queryFn: async () => {
      const r = await listTeams();
      if (!r.ok) throw new Error(r.message);
      return r.teams;
    },
    enabled: canList && canTeamMgmt,
  });

  const teamHistoryQ = useQuery({
    queryKey: ["admin-users", "team-history", teamHistoryUser?.id],
    queryFn: async () => {
      if (!teamHistoryUser) return [];
      const r = await getUserTeamHistory(teamHistoryUser.id);
      if (!r.ok) throw new Error(r.message);
      return r.items;
    },
    enabled: Boolean(teamHistoryUser),
  });

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

  const telegramInner = (row: AdminUser) => (
    <>
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
          {telegramErrByUserId[row.id] ? <p className="text-xs text-destructive">{telegramErrByUserId[row.id]}</p> : null}
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
        <span className="font-mono text-xs text-muted-foreground">{row.telegramUserId != null ? String(row.telegramUserId) : "—"}</span>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
    </>
  );
  const userActionsSlot = (row: AdminUser, triggerTestId?: string) => (
    <div className="flex items-start justify-end gap-1">
      {canImpersonate && row.role !== "admin" && user && row.id !== user.id ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 min-h-11 w-11 min-w-11 shrink-0 border-[#A6CE39]/60 text-[#A6CE39] hover:bg-[#A6CE39]/12"
              aria-label={`Войти как ${row.fullName?.trim() || row.email}`}
              disabled={startImpersonation.isPending}
              onClick={() => {
                const label = row.fullName?.trim() || row.email;
                if (
                  !window.confirm(
                    `Войти под "${label}"? Сессия 60 минут. Все действия будут залогированы.`,
                  )
                ) {
                  return;
                }
                startImpersonation.mutate(row.id, {
                  onError: (e) => {
                    toast({
                      variant: "destructive",
                      title: "Не удалось войти под пользователем",
                      description: e instanceof Error ? e.message : "Ошибка запроса",
                    });
                  },
                  onSuccess: () => {
                    window.location.assign(buildBrowserHashAppHref("/"));
                  },
                });
              }}
            >
              <LogIn className="h-5 w-5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            Войти как {row.fullName?.trim() || row.email} (только для проверки UI)
          </TooltipContent>
        </Tooltip>
      ) : null}
      <AdminUserActionsDropdown
        row={row}
        viewer={user}
        canRole={canRole}
        canResetPwd={canResetPwd}
        canStatus={canStatus}
        canTeam={canTeamMgmt && row.role !== "admin"}
        onRole={openRole}
        onResetLink={openResetLink}
        onPwd={openPwd}
        onStatus={openStatus}
        onTeamChange={(u) => {
          setTeamMoveDialog(u);
          setTeamMoveToId("");
          setTeamMoveReason("");
        }}
        onTeamHistory={(u) => setTeamHistoryUser(u)}
        triggerTestId={triggerTestId}
      />
    </div>
  );


  const showBriefMigrateLink = user?.role === "admin";

  if (listQ.isLoading && !listQ.data) {
    return <AdminUsersSkeleton />;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-24" data-testid="page-admin-users">
      <BackNav breadcrumbs={breadcrumbsFor("/admin/users")} fallbackHref="/" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {hierarchyMode ? (
            <>
              <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Структура команды</h1>
              <p className="text-sm text-muted-foreground">Нажмите на стрелку рядом с РОПом, чтобы развернуть его команду</p>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Пользователи</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </>
          )}
        </div>
        {showBriefMigrateLink ? (
          <Button asChild variant="outline" className="min-h-11 w-full shrink-0 sm:w-auto" data-testid="link-admin-brief-db-migrate">
            <Link href="/admin/migrate-marketing-briefs">
              <Database className="mr-2 h-4 w-4" aria-hidden />
              Миграции БД (брифы)
            </Link>
          </Button>
        ) : null}
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

      <AdminUsersMobilePanels
        hierarchyMode={hierarchyMode}
        hierarchy={hierarchy}
        expandedRop={expandedRop}
        setExpandedRop={setExpandedRop}
        listQ={listQ}
        telegramSlot={telegramInner}
        actionsSlot={userActionsSlot}
      />

      <AdminUsersDesktopPanels
        hierarchyMode={hierarchyMode}
        hierarchy={hierarchy}
        expandedRop={expandedRop}
        setExpandedRop={setExpandedRop}
        listQ={listQ}
        telegramSlot={telegramInner}
        actionsSlot={userActionsSlot}
      />

      {hierarchyMode && total > HIERARCHY_LIMIT ? (
        <p className="text-sm text-muted-foreground">
          В режиме структуры показаны первые {HIERARCHY_LIMIT} пользователей из {total}.
        </p>
      ) : null}
      {!hierarchyMode ? (
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
      ) : null}


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

      <Dialog
        open={Boolean(teamMoveDialog)}
        onOpenChange={(o) => {
          if (!o) {
            setTeamMoveDialog(null);
            setTeamMoveToId("");
            setTeamMoveReason("");
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-admin-users-team-move">
          <DialogHeader>
            <DialogTitle>Сменить команду</DialogTitle>
            <DialogDescription>
              {teamMoveDialog ? (
                <>
                  <span className="font-mono text-xs">{teamMoveDialog.email}</span>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Пользователь будет переведён в выбранную команду; клиенты переносятся вместе с менеджером.
                  </p>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Новая команда</Label>
              <Select value={teamMoveToId || undefined} onValueChange={(v) => setTeamMoveToId(v)}>
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder="Выберите команду" />
                </SelectTrigger>
                <SelectContent>
                  {(teamsForMoveQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-move-reason">Причина (необязательно)</Label>
              <Input id="team-move-reason" value={teamMoveReason} onChange={(e) => setTeamMoveReason(e.target.value)} className="min-h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTeamMoveDialog(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="min-h-11 bg-primary text-primary-foreground shadow-sm hover:bg-[#86B832] focus-visible:ring-primary"
              disabled={!teamMoveDialog || !teamMoveToId || teamMoveSaving}
              onClick={async () => {
                if (!teamMoveDialog || !teamMoveToId) return;
                setTeamMoveSaving(true);
                try {
                  const r = await reassignUserTeam({
                    userId: teamMoveDialog.id,
                    toTeamId: teamMoveToId,
                    reason: teamMoveReason.trim() || undefined,
                    moveClients: true,
                  });
                  if (!r.ok) {
                    toast({ title: r.message, variant: "destructive" });
                    return;
                  }
                  toast({ title: "Команда обновлена" });
                  setTeamMoveDialog(null);
                  await invalidateList();
                  await qc.invalidateQueries({ queryKey: ["client-assignments"] });
                } finally {
                  setTeamMoveSaving(false);
                }
              }}
            >
              {teamMoveSaving ? "Сохранение…" : "Перевести"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(teamHistoryUser)} onOpenChange={(o) => !o && setTeamHistoryUser(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>История смены команды</SheetTitle>
            <SheetDescription className="font-mono">{teamHistoryUser?.email}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto text-sm">
            {teamHistoryQ.isLoading ? (
              <p className="text-muted-foreground">Загрузка…</p>
            ) : teamHistoryQ.isError ? (
              <p className="text-destructive">{(teamHistoryQ.error as Error)?.message}</p>
            ) : !(teamHistoryQ.data ?? []).length ? (
              <p className="text-muted-foreground">Нет записей</p>
            ) : (
              <ul className="space-y-3">
                {(teamHistoryQ.data ?? []).map((h) => (
                  <li key={h.id} className="border-b border-border/60 pb-3 last:border-0">
                    <div className="font-medium">{formatDisplayDateTime(h.createdAt)}</div>
                    <div className="text-muted-foreground">Роль в команде: {h.roleInTeam ?? "—"}</div>
                    <div className="text-muted-foreground">{h.reason ?? "—"}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>


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
