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
  draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
  submitted: "bg-primary/15 text-foreground border-primary/35",
  reserved: "bg-[#dff2c7] text-[#37551a] border-[#cbe7a8]",
  assembling: "bg-amber-100 text-amber-800 border-amber-200",
  shipped: "bg-[#ddeffe] text-[#24537d] border-[#c4def5]",
  delivered: "bg-[#dff2c7] text-[#37551a] border-[#cbe7a8]",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

const claimStyles: Record<string, string> = {
  new: "bg-primary/15 text-foreground border-primary/35",
  in_review: "bg-amber-100 text-amber-800 border-amber-200",
  waiting_info: "bg-neutral-100 text-neutral-700 border-neutral-200",
  resolved: "bg-[#dff2c7] text-[#37551a] border-[#cbe7a8]",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

const dealerStyles: Record<string, string> = {
  active: "bg-[#dff2c7] text-[#37551a] border-[#cbe7a8]",
  development: "bg-sky-100 text-sky-900 border-sky-200",
  inactive: "bg-neutral-100 text-neutral-700 border-neutral-200",
  paused: "bg-amber-100 text-amber-800 border-amber-200",
  archived: "bg-neutral-200 text-neutral-600 border-neutral-300",
};

const availabilityStyles: Record<string, string> = {
  in_stock: "bg-[#dff2c7] text-[#37551a] border-[#cbe7a8]",
  limited: "bg-amber-100 text-amber-800 border-amber-200",
  backorder: "bg-neutral-100 text-neutral-700 border-neutral-200",
  out_of_stock: "bg-neutral-100 text-neutral-700 border-neutral-200",
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
  development: "В развитии",
  paused: "Приостановлен",
  inactive: "Неактивен",
  archived: "В архиве",
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

  return availabilityStyles[value] ?? "bg-neutral-100 text-neutral-700 border-neutral-200";
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
