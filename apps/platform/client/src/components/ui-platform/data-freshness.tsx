/**
 * <DataFreshness/> — единая строка-индикатор «когда обновлены данные».
 * Заменяет старые «Сохранено · POSTGRES» / «in-memory» индикаторы (Промт 47 Part B/C).
 *
 * UI: одна строка `text-xs text-muted-foreground` с цветной точкой:
 *   - зелёная если updatedAt задан;
 *   - оранжевая + «Данные не загружены» если updatedAt === null.
 *
 * Технические термины (POSTGRES / Neon / sessionStorage / in-memory) НЕ упоминаем.
 * Если sourceLabel передан И текущая роль admin/director — рендерим муто-bracket
 * с этим лейблом (например «[Postgres]») как служебную подсказку. Иначе скрываем.
 */

import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";

export type DataFreshnessProps = {
  updatedAt?: Date | string | null;
  /** Технический лейбл источника (показывается только admin/director как подсказка). */
  sourceLabel?: string;
  className?: string;
  testId?: string;
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t) : null;
}

function formatRu(date: Date): string {
  // «27 мая, 13:00» — Europe/Moscow по умолчанию для русской локали клиента.
  const day = date.getDate();
  const month = date.toLocaleString("ru-RU", { month: "long" });
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month}, ${hh}:${mm}`;
}

export function DataFreshness({
  updatedAt,
  sourceLabel,
  className,
  testId = "data-freshness",
}: DataFreshnessProps): ReactElement {
  const { user } = useAuthUser();
  const allowSourceLabel = user?.role === "admin" || user?.role === "director";
  const d = toDate(updatedAt ?? null);

  return (
    <p
      className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      data-testid={testId}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
          d ? "bg-primary" : "bg-amber-500",
        )}
      />
      {d ? (
        <span>
          Обновлено: <span className="text-foreground">{formatRu(d)}</span>
        </span>
      ) : (
        <span>Данные не загружены</span>
      )}
      {allowSourceLabel && sourceLabel ? (
        <span className="ml-1 text-[11px] text-muted-foreground/80" data-testid="data-freshness-source">
          [{sourceLabel}]
        </span>
      ) : null}
    </p>
  );
}
