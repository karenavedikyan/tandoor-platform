import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { TeamActivityEventRow, TeamActivityRange, TeamActivityRow } from "@shared/team-activity-types";
import { fetchTeamActivityEvents } from "@/lib/team-activity-api";
import { formatTeamActivityRelative } from "@/components/team-activity/team-activity-table";

const EVENT_TYPE_LABEL: Record<TeamActivityEventRow["type"], string> = {
  override: "Правка клиента",
  contact: "Контакт",
  tp: "Правка ТТ",
};

type TeamActivityEventsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manager: TeamActivityRow | null;
  range: TeamActivityRange;
};

export function TeamActivityEventsSheet({ open, onOpenChange, manager, range }: TeamActivityEventsSheetProps) {
  const userId = manager?.user_id ?? "";
  const eventsQ = useQuery({
    queryKey: ["team-activity-events", userId, range],
    enabled: open && Boolean(userId),
    queryFn: async () => {
      const res = await fetchTeamActivityEvents(userId, { range, limit: 50 });
      if (!res.success) throw new Error(res.message);
      return res.events;
    },
    staleTime: 30_000,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg" data-testid="sheet-team-activity-events">
        <SheetHeader>
          <SheetTitle>{manager?.full_name ?? "Менеджер"}</SheetTitle>
          <SheetDescription>Последние события за {range === "30d" ? "30 дней" : "7 дней"}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {eventsQ.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Загрузка событий
            </div>
          ) : eventsQ.isError ? (
            <p className="py-8 text-center text-sm text-destructive">Не удалось загрузить события</p>
          ) : !eventsQ.data || eventsQ.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">За выбранный период активности нет</p>
          ) : (
            <ul className="space-y-2">
              {eventsQ.data.map((ev, idx) => (
                <li
                  key={`${ev.at}-${ev.type}-${idx}`}
                  className="rounded-lg border border-border bg-card px-3 py-2.5"
                  data-testid="row-team-activity-event"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {EVENT_TYPE_LABEL[ev.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatTeamActivityRelative(ev.at)}</span>
                  </div>
                  {ev.field ? <p className="mt-1 text-xs text-muted-foreground">Поле: {ev.field}</p> : null}
                  {ev.dealer_id ? <p className="mt-1 text-xs text-foreground">Клиент: {ev.dealer_id}</p> : null}
                  {ev.client_id ? <p className="mt-1 text-xs text-foreground">Код: {ev.client_id}</p> : null}
                  {ev.body_preview ? (
                    <p className="mt-1 line-clamp-3 text-sm text-foreground">{ev.body_preview}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
