import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Info, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessTeamActivityForUser } from "@/lib/auth-access";
import { fetchTeamActivityList } from "@/lib/team-activity-api";
import type { TeamActivityRange, TeamActivityRow } from "@shared/team-activity-types";
import { TeamActivityTable } from "@/components/team-activity/team-activity-table";
import { TeamActivityEventsSheet } from "@/components/team-activity/team-activity-events-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDisplayDateTime } from "@/lib/format-display-date";

export default function TeamActivityPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [range, setRange] = useState<TeamActivityRange>("7d");
  const [teamId, setTeamId] = useState<string>("__all__");
  const [selectedManager, setSelectedManager] = useState<TeamActivityRow | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);

  const canAccess = user ? canAccessTeamActivityForUser(user.role) : false;
  const isDirector = user?.role === "director" || user?.role === "admin";

  const listQ = useQuery({
    queryKey: ["team-activity", range, isDirector ? teamId : "scoped"],
    enabled: Boolean(user && canAccess),
    queryFn: async () => {
      const res = await fetchTeamActivityList({
        range,
        teamId: isDirector && teamId !== "__all__" ? teamId : null,
      });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    staleTime: 60_000,
  });

  const rows = useMemo(() => listQ.data?.rows ?? [], [listQ.data?.rows]);
  const teams = listQ.data?.teams ?? [];

  if (userLoading) {
    return (
      <div className="space-y-4 p-4" data-testid="page-team-activity-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user || !canAccess) {
    return <Redirect to="/dealer-base" />;
  }

  const generatedAt = listQ.data?.generated_at;

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden pb-12" data-testid="page-team-activity">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Активность команды</h1>
        <p className="text-sm text-muted-foreground">Сводка работы менеджеров с клиентской базой</p>
      </div>

      <Alert data-testid="alert-team-activity-info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Данные обновляются каждую ночь в 03:00 МСК.
          {generatedAt ? (
            <>
              {" "}
              Последнее обновление: {formatDisplayDateTime(generatedAt)}
            </>
          ) : null}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex rounded-lg border border-border p-0.5">
          {(["7d", "30d"] as const).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={range === r ? "default" : "ghost"}
              className="min-h-9"
              data-testid={`button-team-activity-range-${r}`}
              onClick={() => setRange(r)}
            >
              {r === "7d" ? "7 дней" : "30 дней"}
            </Button>
          ))}
        </div>

        {isDirector && teams.length > 0 ? (
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-full sm:w-[240px]" data-testid="select-team-activity-team">
              <SelectValue placeholder="Все команды" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все команды</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.team_id} value={t.team_id}>
                  {t.team_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {listQ.isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Загрузка данных
        </div>
      ) : listQ.isError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">
          Не удалось загрузить активность команды
        </p>
      ) : (
        <TeamActivityTable
          rows={rows}
          showTeamColumn={isDirector}
          onRowClick={(row) => {
            setSelectedManager(row);
            setEventsOpen(true);
          }}
        />
      )}

      <TeamActivityEventsSheet
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        manager={selectedManager}
        range={range}
      />
    </div>
  );
}
