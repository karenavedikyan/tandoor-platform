export function dealerTypeLabel(value: string): string {
  const map: Record<string, string> = {
    network: "Сетевой",
    single: "Одиночный",
  };
  return map[value] ?? value;
}

export function dealerStatusLabel(value: string): string {
  const map: Record<string, string> = {
    active: "Активен",
    development: "В развитии",
    paused: "Приостановлен",
    archived: "В архиве",
  };
  return map[value] ?? value;
}

export function potentialLevelLabel(value: string): string {
  const map: Record<string, string> = {
    high: "Высокий",
    medium: "Средний",
    low: "Низкий",
  };
  return map[value] ?? value;
}

export function storeFormatLabel(value: string): string {
  const map: Record<string, string> = {
    showroom: "Шоурум",
    retail_store: "Розничный магазин",
    warehouse: "Склад",
    mixed: "Смешанный формат",
  };
  return map[value] ?? value;
}

export function taskStatusLabel(value: string): string {
  const map: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    done: "Выполнена",
    rejected: "Отклонена",
    overdue: "Просрочена",
  };
  return map[value] ?? value;
}

export function taskPriorityLabel(value: string): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
  };
  return map[value] ?? value;
}

export function taskTypeLabel(value: string): string {
  const map: Record<string, string> = {
    sales_follow_up: "Контроль продаж",
    showcase_goal: "Цель по витрине",
    distribution_gap: "Пробел дистрибуции",
    visit_follow_up: "Связь после визита",
    document: "Документы",
    other: "Другое",
  };
  return map[value] ?? value;
}

export function taskSourceLabel(value: string): string {
  const map: Record<string, string> = {
    manual: "Ручной ввод",
    distribution_report: "Отчёт дистрибуции",
    visit: "Визит",
    order: "Заказ",
  };
  return map[value] ?? value;
}

export function interactionTypeLabel(value: string): string {
  const map: Record<string, string> = {
    call: "Звонок",
    meeting: "Встреча",
    visit: "Визит",
    report: "Отчёт",
    task_created: "Создана задача",
    order: "Заказ",
    claim: "Рекламация",
  };
  return map[value] ?? value;
}

export function roleContextLabel(value: string): string {
  const map: Record<string, string> = {
    sales_manager: "Менеджер продаж",
    regional_manager: "Региональный менеджер",
    sales_assistant: "Ассистент продаж",
    sales_head: "Руководитель продаж",
    system: "Система",
  };
  return map[value] ?? value;
}

/** Статусы торговой точки (как у дилера, без «архив» в демо). */
export function tradePointStatusLabel(value: string): string {
  const map: Record<string, string> = {
    active: "Активна",
    inactive: "Неактивна",
  };
  return map[value] ?? value;
}
