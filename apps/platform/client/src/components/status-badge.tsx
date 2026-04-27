import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusKind = "order" | "claim" | "dealer" | "availability";

type StatusBadgeProps = {
  type?: StatusKind;
  kind?: StatusKind;
  category?: StatusKind;
  variant?: StatusKind;
  status?: string;
  value?: string;
  className?: string;
  "data-testid"?: string;
};

const orderStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-primary/10 text-primary border-primary/20",
  reserved: "bg-lime-100 text-lime-800 border-lime-200",
  assembling: "bg-amber-100 text-amber-800 border-amber-200",
  shipped: "bg-sky-100 text-sky-800 border-sky-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

const claimStyles: Record<string, string> = {
  new: "bg-primary/10 text-primary border-primary/20",
  in_review: "bg-amber-100 text-amber-800 border-amber-200",
  waiting_info: "bg-violet-100 text-violet-800 border-violet-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

const dealerStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
  paused: "bg-amber-100 text-amber-800 border-amber-200",
};

const availabilityStyles: Record<string, string> = {
  in_stock: "bg-emerald-100 text-emerald-800 border-emerald-200",
  limited: "bg-amber-100 text-amber-800 border-amber-200",
  backorder: "bg-rose-100 text-rose-800 border-rose-200",
  out_of_stock: "bg-slate-100 text-slate-700 border-slate-200",
};

const labels: Record<string, string> = {
  draft: "Черновик",
  submitted: "Отправлен",
  reserved: "Зарезервирован",
  assembling: "Комплектация",
  shipped: "Отгружен",
  delivered: "Доставлен",
  cancelled: "Отменен",
  new: "Новая",
  in_review: "На рассмотрении",
  waiting_info: "Ожидает данные",
  resolved: "Решена",
  rejected: "Отклонена",
  active: "Активен",
  paused: "Приостановлен",
  inactive: "Неактивен",
  in_stock: "В наличии",
  low_stock: "Мало",
  limited: "Мало",
  out_of_stock: "Нет в наличии",
  expected: "Ожидается",
  backorder: "Ожидается",
};

function prettify(value: string) {
  if (labels[value]) {
    return labels[value];
  }

  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function styleFor(kind: StatusKind, value: string) {
  if (kind === "order") {
    return orderStyles[value] ?? orderStyles.draft;
  }
  if (kind === "claim") {
    return claimStyles[value] ?? claimStyles.in_review;
  }
  if (kind === "dealer") {
    return dealerStyles[value] ?? dealerStyles.inactive;
  }

  return availabilityStyles[value] ?? "bg-muted text-muted-foreground border-border";
}

export function StatusBadge({
  type,
  kind,
  category,
  variant,
  status,
  value,
  className,
  "data-testid": testId,
}: StatusBadgeProps) {
  const effectiveKind = type ?? kind ?? category ?? variant ?? "availability";
  const raw = (status ?? value ?? "unknown").toLowerCase();

  return (
    <Badge
      variant="outline"
      data-testid={testId ?? `${effectiveKind}-status-${raw}`}
      className={cn("font-medium", styleFor(effectiveKind, raw), className)}
    >
      {prettify(status ?? value ?? "Неизвестно")}
    </Badge>
  );
}

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge type="order" status={status} className={className} />;
}

export function ClaimStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge type="claim" status={status} className={className} />;
}
