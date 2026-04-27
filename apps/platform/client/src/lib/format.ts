export function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCurrencyRub(cents: number) {
  return formatCurrency(cents, "RUB");
}

export function formatMoney(cents: number, currency = "RUB") {
  return formatCurrency(cents, currency);
}

export function formatDate(dateLike: string | null | undefined) {
  if (!dateLike) {
    return "—";
  }

  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return dateLike;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(dateLike: string | null | undefined) {
  return formatDate(dateLike);
}

export function formatDateTime(dateLike: string | null | undefined) {
  if (!dateLike) {
    return "—";
  }

  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return dateLike;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toTitleWords(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusLabel(value: string) {
  return toTitleWords(value);
}
