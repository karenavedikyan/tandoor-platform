import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactElement } from "react";

export function formatBitrixOrderDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatBitrixOrderMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

export function bitrixOrderStatusClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "новый") return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200";
  if (s === "закрыт") return "border-muted bg-muted/40 text-muted-foreground";
  if (s.includes("отмен")) return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200";
  return "border-border bg-background text-foreground";
}

export function BitrixOrderStatusBadge({ status }: { status: string }): ReactElement {
  return (
    <Badge variant="outline" className={cn("font-normal", bitrixOrderStatusClass(status))}>
      {status || "—"}
    </Badge>
  );
}
