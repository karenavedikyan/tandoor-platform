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

export function routeStatusLabel(value: string): string {
  const map: Record<string, string> = {
    planned: "Запланирован",
    in_progress: "В работе",
    completed: "Завершен",
  };
  return map[value] ?? value;
}

export function visitStatusLabel(value: string): string {
  const map: Record<string, string> = {
    planned: "Запланирован",
    in_progress: "В процессе",
    completed: "Завершен",
    skipped: "Пропущен",
  };
  return map[value] ?? value;
}

export function visitPurposeLabel(value: string): string {
  const map: Record<string, string> = {
    distribution_check: "Проверка дистрибуции",
    showcase_check: "Проверка витрины",
    training: "Обучение команды",
    order_follow_up: "Контроль заказа",
    claim_follow_up: "Контроль рекламации",
  };
  return map[value] ?? value;
}

export function visitPriorityLabel(value: string): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
  };
  return map[value] ?? value;
}

export function reportStatusLabel(value: string): string {
  const map: Record<string, string> = {
    draft: "Черновик",
    submitted: "Отправлен",
    reviewed: "Проверен",
  };
  return map[value] ?? value;
}

export function displayQualityLabel(value: string): string {
  const map: Record<string, string> = {
    excellent: "Отлично",
    good: "Хорошо",
    average: "Средне",
    poor: "Слабо",
  };
  return map[value] ?? value;
}

export function competitorPresenceLabel(value: string): string {
  const map: Record<string, string> = {
    none: "Нет",
    low: "Низкое",
    medium: "Среднее",
    high: "Высокое",
  };
  return map[value] ?? value;
}

export function stockStatusLabel(value: string): string {
  const map: Record<string, string> = {
    in_stock: "В наличии",
    low_stock: "Остаток низкий",
    out_of_stock: "Нет в наличии",
    unknown: "Неизвестно",
  };
  return map[value] ?? value;
}

export function showcaseGoalStatusLabel(value: string): string {
  const map: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    agreed: "Согласована",
    completed: "Выполнена",
    rejected: "Отклонена",
    overdue: "Просрочена",
  };
  return map[value] ?? value;
}

export function showcaseGoalSourceLabel(value: string): string {
  const map: Record<string, string> = {
    distribution_report: "Отчет дистрибуции",
    sales_head: "Руководитель продаж",
    regional_manager: "Региональный менеджер",
    manual: "Ручная постановка",
  };
  return map[value] ?? value;
}

export function showcaseGoalItemStatusLabel(value: string): string {
  const map: Record<string, string> = {
    new: "Новая",
    agreed: "Согласована",
    ordered: "Заказана",
    completed: "Выполнена",
    rejected: "Отклонена",
  };
  return map[value] ?? value;
}

export function showcaseGoalCurrentStateLabel(value: string): string {
  const map: Record<string, string> = {
    missing: "Отсутствует",
    in_stock_not_showcase: "Есть в наличии, не на витрине",
    on_showcase: "На витрине",
    unknown: "Неизвестно",
  };
  return map[value] ?? value;
}

export function showcaseGoalTargetStateLabel(value: string): string {
  const map: Record<string, string> = {
    on_showcase: "Выставить на витрину",
    in_stock: "Поддерживать в наличии",
    ordered: "Заказать",
  };
  return map[value] ?? value;
}

export function salesTaskTypeLabel(value: string): string {
  const map: Record<string, string> = {
    showcase_goal: "Цель по витрине",
    call_dealer: "Звонок дилеру",
    prepare_offer: "Подготовка КП",
    coordinate_delivery: "Координация доставки",
    update_documents: "Документы и POSM",
    follow_up: "Контроль выполнения",
    other: "Другое",
  };
  return map[value] ?? value;
}

export function salesTaskStatusLabel(value: string): string {
  const map: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    waiting_dealer: "Ожидает дилера",
    done: "Выполнена",
    overdue: "Просрочена",
    cancelled: "Отменена",
  };
  return map[value] ?? value;
}

export function priorityLabel(value: string): string {
  return taskPriorityLabel(value);
}
