import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { TeamActivityRow } from "@shared/team-activity-types";
import { cn } from "@/lib/utils";

export function formatTeamActivityRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true, locale: ru });
}

export function teamActivityEventsTone(total: number): string {
  if (total <= 0) return "text-destructive font-semibold";
  if (total <= 10) return "text-amber-700 dark:text-amber-400 font-medium";
  return "text-emerald-700 dark:text-emerald-400 font-medium";
}

export function teamActivityEventsBadgeClass(total: number): string {
  if (total <= 0) return "border-destructive/40 bg-destructive/10 text-destructive";
  if (total <= 10) return "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";
  return "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
}

export type TeamActivityTableProps = {
  rows: TeamActivityRow[];
  showTeamColumn: boolean;
  onRowClick: (row: TeamActivityRow) => void;
};

export function TeamActivityTable({ rows, showTeamColumn, onRowClick }: TeamActivityTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        За выбранный период активности нет
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full text-sm" data-testid="table-team-activity">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Менеджер</th>
            {showTeamColumn ? <th className="px-3 py-2.5 font-medium">Команда</th> : null}
            <th className="px-3 py-2.5 font-medium text-right tabular-nums">Клиентов</th>
            <th className="px-3 py-2.5 font-medium text-right tabular-nums">Событий</th>
            <th className="px-3 py-2.5 font-medium text-right tabular-nums">Правки клиентов</th>
            <th className="px-3 py-2.5 font-medium text-right tabular-nums">Контакты</th>
            <th className="px-3 py-2.5 font-medium text-right tabular-nums">Правки ТТ</th>
            <th className="px-3 py-2.5 font-medium text-right tabular-nums">Охвачено</th>
            <th className="px-3 py-2.5 font-medium">Последняя активность</th>
            <th className="px-3 py-2.5 font-medium">Последний вход</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.user_id}
              className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/30"
              data-testid={`row-team-activity-${row.user_id}`}
              onClick={() => onRowClick(row)}
            >
              <td className="px-3 py-2.5 font-medium text-foreground">{row.full_name}</td>
              {showTeamColumn ? (
                <td className="px-3 py-2.5 text-muted-foreground">{row.team_name ?? "—"}</td>
              ) : null}
              <td className="px-3 py-2.5 text-right tabular-nums">{row.clients_count}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", teamActivityEventsTone(row.events_total))}>
                {row.events_total}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.events_overrides}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.events_contacts}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.events_tp}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.clients_touched}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{formatTeamActivityRelative(row.last_activity_at)}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{formatTeamActivityRelative(row.last_login_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
