import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-datetime";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  type NotificationDto,
} from "@/lib/notifications-api";

const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;
const LIST_KEY = ["notifications", "list"] as const;

function notificationHref(link: string | null): string {
  if (!link?.trim()) return "#";
  const t = link.trim();
  if (t.startsWith("#/")) return t.slice(1);
  if (t.startsWith("/")) return t;
  return "#";
}

function unreadBadgeLabel(count: number): string {
  if (count > 9) return "9+";
  return String(count);
}

export function NotificationsBell() {
  const { user } = useAuthUser();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const unreadQ = useQuery({
    queryKey: [...UNREAD_COUNT_KEY],
    queryFn: getUnreadCount,
    enabled: Boolean(user && user.status === "active"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const listQ = useQuery({
    queryKey: [...LIST_KEY],
    queryFn: () => listNotifications({ limit: 20 }),
    enabled: open && Boolean(user && user.status === "active"),
    staleTime: 10_000,
  });

  if (!user || user.status !== "active") {
    return null;
  }

  const unreadCount = unreadQ.data ?? 0;

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: [...UNREAD_COUNT_KEY] }),
      qc.invalidateQueries({ queryKey: [...LIST_KEY] }),
    ]);
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    await invalidate();
  };

  const handleItemClick = async (n: NotificationDto) => {
    if (!n.read) {
      await markNotificationsRead([n.id]);
      await invalidate();
    }
    setOpen(false);
    const href = notificationHref(n.link);
    if (href !== "#") {
      setLocation(href);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0 border-border/80"
          aria-label="Уведомления"
          data-testid="button-notifications-bell"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
              data-testid="notifications-unread-badge"
            >
              {unreadBadgeLabel(unreadCount)}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(calc(100vw-2rem),22rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
          <p className="text-sm font-semibold">Уведомления</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={unreadCount === 0}
            onClick={() => void handleMarkAll()}
            data-testid="button-notifications-mark-all"
          >
            Отметить все
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          {listQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : listQ.isError ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">
              {(listQ.error as Error)?.message ?? "Ошибка загрузки"}
            </p>
          ) : !listQ.data?.notifications.length ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Нет уведомлений</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {listQ.data.notifications.map((n) => {
                const href = notificationHref(n.link);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                        !n.read && "bg-primary/5",
                      )}
                      onClick={() => void handleItemClick(n)}
                      data-testid={`notification-item-${n.id}`}
                    >
                      <p className={cn("text-sm leading-snug", !n.read ? "font-semibold" : "font-medium")}>
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {n.actorName ? `${n.actorName} · ` : ""}
                        {formatRelativeTime(n.createdAt)}
                      </p>
                      {href !== "#" ? (
                        <Link href={href} className="sr-only">
                          {n.title}
                        </Link>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
