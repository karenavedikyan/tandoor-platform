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
    market_point: "Торговая точка",
    warehouse_store: "Склад-магазин",
    mixed: "Смешанный",
  };
  return map[value] ?? value;
}

export function taskStatusLabel(value: string): string {
  const map: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    done: "Выполнена",
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
    showcase_goal: "Цель по витрине",
    call: "Звонок",
    visit_followup: "Связь после визита",
    documents: "Документы",
    order_support: "Сопровождение заказа",
    other: "Другое",
  };
  return map[value] ?? value;
}

export function taskSourceLabel(value: string): string {
  const map: Record<string, string> = {
    sales_manager: "Менеджер продаж",
    regional_manager: "Региональный менеджер",
    sales_head: "Руководитель отдела",
    system: "Система",
  };
  return map[value] ?? value;
}

export function interactionTypeLabel(value: string): string {
  const map: Record<string, string> = {
    call: "Звонок",
    visit: "Визит",
    message: "Сообщение",
    meeting: "Встреча",
    task_created: "Создана задача",
    distribution_report: "Отчёт дистрибуции",
  };
  return map[value] ?? value;
}

export function roleContextLabel(value: string): string {
  const map: Record<string, string> = {
    sales_manager: "Менеджер продаж",
    regional_manager: "Региональный менеджер",
    assistant: "Ассистент",
    head: "Руководитель",
  };
  return map[value] ?? value;
}

/** Статусы торговой точки (как у дилера, без «архив» в демо). */
export function tradePointStatusLabel(value: string): string {
  const map: Record<string, string> = {
    active: "Активна",
    development: "В развитии",
    paused: "Приостановлена",
  };
  return map[value] ?? value;
}
