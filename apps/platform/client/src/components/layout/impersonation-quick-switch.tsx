import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UserRole } from "@shared/auth";
import { Eye, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientAvatar } from "@/components/ui/client-avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useStartImpersonation, useStopImpersonation } from "@/lib/use-impersonation";
import { useImpersonationTargets } from "@/lib/use-impersonation-targets";
import {
  canShowImpersonationQuickSwitch,
  filterImpersonationTargets,
  groupImpersonationTargets,
  IMPERSONATION_ROLE_LABELS_RU,
  truncateEmail,
  type ImpersonationRoleGroupKey,
} from "@/components/layout/impersonation-quick-switch-utils";

const GROUP_PAGE_SIZE = 8;

export type ImpersonationQuickSwitchUser = {
  id: string;
  fullName: string | null;
  email: string;
  role: UserRole;
};

export type ImpersonationQuickSwitchProps = {
  currentUser: ImpersonationQuickSwitchUser;
  isImpersonating: boolean;
  className?: string;
  /** Desktop sidebar (popover), mobile drawer (bottom sheet), or collapsed icon only. */
  layout?: "sidebar" | "mobile" | "collapsed";
  sidebarCollapsed?: boolean;
  onRequestExpandSidebar?: () => void;
  /** After sidebar expands, open the picker once. */
  autoOpenPicker?: boolean;
  onAutoOpenPickerConsumed?: () => void;
};

function displayName(u: ImpersonationQuickSwitchUser): string {
  return u.fullName?.trim() || u.email.trim() || "—";
}

function ImpersonationPickerBody({
  currentUserId,
  viewerRole,
  onPick,
  pendingId,
}: {
  currentUserId: string;
  viewerRole: UserRole;
  onPick: (targetUserId: string) => void;
  pendingId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Partial<Record<ImpersonationRoleGroupKey, boolean>>>({});
  const targetsQ = useImpersonationTargets(viewerRole);

  const filtered = useMemo(() => {
    const list = targetsQ.data ?? [];
    return filterImpersonationTargets(list, search);
  }, [targetsQ.data, search]);

  const groups = useMemo(() => groupImpersonationTargets(filtered), [filtered]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, email или роли"
          className="h-9 pl-8 text-sm"
          data-testid="input-impersonation-quick-search"
          autoFocus
        />
      </div>

      {targetsQ.isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Загрузка пользователей…</p>
      ) : targetsQ.isError ? (
        <p className="py-6 text-center text-sm text-destructive">Не удалось загрузить список</p>
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground" data-testid="text-impersonation-quick-empty">
          Никого не нашли по запросу
        </p>
      ) : (
        <div className="flex max-h-[min(60vh,420px)] flex-col gap-4 overflow-y-auto pr-0.5">
          {groups.map((group) => {
            const showAll = expandedGroups[group.key] === true;
            const visible = showAll ? group.users : group.users.slice(0, GROUP_PAGE_SIZE);
            const hasMore = group.users.length > GROUP_PAGE_SIZE;

            return (
              <section key={group.key} className="min-w-0">
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h4>
                <ul className="flex flex-col gap-1">
                  {visible.map((row) => {
                    const isSelf = row.id === currentUserId;
                    const name = row.fullName.trim() || row.email;
                    return (
                      <li
                        key={row.id}
                        className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5"
                        data-testid={`impersonation-target-row-${row.id}`}
                      >
                        <ClientAvatar size={32} shape="circle" name={name} seed={row.id} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-tight">{name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {IMPERSONATION_ROLE_LABELS_RU[row.role]} · {truncateEmail(row.email)}
                          </p>
                        </div>
                        {isSelf ? (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            Это вы
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 border-[#9ACA3C]/50 px-2 text-xs text-[#6B8F2E] hover:bg-[#9ACA3C]/10"
                            disabled={pendingId != null}
                            data-testid={`button-impersonation-start-${row.id}`}
                            onClick={() => onPick(row.id)}
                          >
                            Войти →
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {hasMore && !showAll ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 w-full text-xs text-muted-foreground"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: true }))}
                  >
                    Показать ещё
                  </Button>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ImpersonatingBlock({
  currentUser,
  onStop,
  stopping,
}: {
  currentUser: ImpersonationQuickSwitchUser;
  onStop: () => void;
  stopping: boolean;
}) {
  const name = displayName(currentUser);
  return (
    <div
      className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid="impersonation-quick-active"
    >
      <div className="flex gap-2">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">Просмотр от лица: {name}</p>
          <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
            {IMPERSONATION_ROLE_LABELS_RU[currentUser.role]} · {truncateEmail(currentUser.email)}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2.5 h-8 w-full border-amber-400/80 bg-white text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-900/30"
        disabled={stopping}
        data-testid="button-impersonation-stop-sidebar"
        onClick={onStop}
      >
        Вернуться как админ
      </Button>
    </div>
  );
}

export function ImpersonationQuickSwitch({
  currentUser,
  isImpersonating,
  className,
  layout = "sidebar",
  sidebarCollapsed = false,
  onRequestExpandSidebar,
  autoOpenPicker = false,
  onAutoOpenPickerConsumed,
}: ImpersonationQuickSwitchProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const start = useStartImpersonation();
  const stop = useStopImpersonation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);

  const canImpersonate = canShowImpersonationQuickSwitch(currentUser.role);

  useEffect(() => {
    if (!autoOpenPicker || sidebarCollapsed) return;
    setPickerOpen(true);
    onAutoOpenPickerConsumed?.();
  }, [autoOpenPicker, sidebarCollapsed, onAutoOpenPickerConsumed]);

  if (!canImpersonate && !isImpersonating) {
    return null;
  }

  const reloadMain = () => {
    qc.clear();
    window.location.assign("/");
  };

  const handleStart = async (targetUserId: string) => {
    setPendingTargetId(targetUserId);
    try {
      await start.mutateAsync(targetUserId);
      setPickerOpen(false);
      reloadMain();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Не удалось войти под пользователем",
        description: e instanceof Error ? e.message : "Ошибка запроса",
      });
    } finally {
      setPendingTargetId(null);
    }
  };

  const handleStop = async () => {
    try {
      await stop.mutateAsync();
      reloadMain();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Не удалось выйти из режима наблюдения",
        description: e instanceof Error ? e.message : "Ошибка запроса",
      });
    }
  };

  if (isImpersonating) {
    return (
      <div className={className} data-testid="sidebar-impersonation-quick">
        <ImpersonatingBlock currentUser={currentUser} onStop={() => void handleStop()} stopping={stop.isPending} />
      </div>
    );
  }

  if (!canImpersonate) {
    return null;
  }

  const pickerBody = (
    <ImpersonationPickerBody
      currentUserId={currentUser.id}
      viewerRole={currentUser.role}
      onPick={(id) => void handleStart(id)}
      pendingId={pendingTargetId}
    />
  );

  if (layout === "collapsed") {
    return (
      <div className={cn("flex justify-center", className)} data-testid="sidebar-impersonation-quick-collapsed">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-[#8F96B0] hover:bg-[#EEEFF6]/80 hover:text-[#222631]"
              aria-label="Войти как…"
              data-testid="button-impersonation-quick-collapsed"
              onClick={() => {
                onRequestExpandSidebar?.();
              }}
            >
              <Users className="h-5 w-5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Войти как…</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  if (layout === "mobile") {
    return (
      <div className={className} data-testid="sidebar-impersonation-quick">
        <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-[#9ACA3C]/60 bg-[#9ACA3C]/10 text-[#5a7a28] hover:bg-[#9ACA3C]/20"
              data-testid="button-impersonation-quick-open-mobile"
            >
              <span aria-hidden>👤</span>
              Войти как…
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[88vh] rounded-t-2xl border-border p-0">
            <SheetHeader className="border-b border-border/60 px-4 pb-3 pt-4 text-left">
              <SheetTitle className="text-base">Войти как пользователь</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 py-3">{pickerBody}</div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className={className} data-testid="sidebar-impersonation-quick">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full gap-2 border-[#9ACA3C]/60 bg-[#9ACA3C]/10 text-sm text-[#5a7a28] hover:bg-[#9ACA3C]/20"
            data-testid="button-impersonation-quick-open"
          >
            <span aria-hidden>👤</span>
            Войти как…
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,320px)] p-3" align="start" side="bottom">
          <p className="mb-2 text-sm font-medium">Выберите пользователя</p>
          {pickerBody}
        </PopoverContent>
      </Popover>
    </div>
  );
}
