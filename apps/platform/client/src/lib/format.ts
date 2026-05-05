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

const russianLabels: Record<string, string> = {
  // Order statuses
  draft: "Черновик",
  submitted: "Отправлен",
  reserved: "Зарезервирован",
  assembling: "Комплектация",
  shipped: "Отгружен",
  delivered: "Доставлен",
  cancelled: "Отменен",
  // Claim statuses
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  in_review: "На рассмотрении",
  waiting_info: "Ожидает данные",
  resolved: "Решена",
  rejected: "Отклонена",
  // Dealer statuses
  active: "Активен",
  paused: "Приостановлен",
  inactive: "Неактивен",
  development: "В развитии",
  // Availability
  in_stock: "В наличии",
  low_stock: "Мало",
  out_of_stock: "Нет в наличии",
  expected: "Ожидается",
  limited: "Ограничено",
  backorder: "Под заказ",
  // Activity types
  order_created: "Заказ создан",
  order_status_changed: "Статус заказа изменен",
  claim_created: "Рекламация создана",
  document_added: "Документ добавлен",
  // Entity types
  order: "Заказ",
  claim: "Рекламация",
  document: "Документ",
  // Document types / statuses
  invoice: "Счет",
  contract: "Договор",
  closing_document: "Закрывающий документ",
  act: "Акт",
  shipment_document: "Отгрузочный документ",
  published: "Опубликован",
  // Claim reasons
  packaging_damage: "Повреждение упаковки",
  wrong_finish_color: "Неверный цвет отделки",
  // Dealer and CRM labels
  network: "Сетевой",
  single: "Одиночный",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
  showroom: "Шоурум",
  retail_store: "Розничный магазин",
  warehouse: "Склад",
  mixed: "Смешанный формат",
  sales_follow_up: "Доработка продаж",
  showcase_goal: "Цель по витрине",
  distribution_gap: "Пробел дистрибуции",
  visit_follow_up: "Действие после визита",
  distribution_report: "Отчёт дистрибуции",
  manual: "Вручную",
  visit: "Визит",
  sales_manager: "Менеджер продаж",
  regional_manager: "Региональный менеджер",
  sales_assistant: "Ассистент продаж",
  sales_head: "Руководитель продаж",
  system: "Система",
  call: "Звонок",
  meeting: "Встреча",
  report: "Отчёт",
  task_created: "Создана задача",
};

export function statusLabel(value: string) {
  return russianLabels[value] ?? toTitleWords(value);
}
