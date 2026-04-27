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

export function leadershipRoleLabel(value: string): string {
  const map: Record<string, string> = {
    sales_head: "Руководитель отдела продаж",
    team_head: "Руководитель команды",
    regional_head: "Руководитель региональных менеджеров",
    sales_manager: "Менеджер продаж",
    regional_manager: "Региональный менеджер",
    sales_assistant: "Ассистент продаж",
  };
  return map[value] ?? value;
}

export function workloadStatusLabel(value: string): string {
  const map: Record<string, string> = {
    normal: "Норма",
    high: "Высокая",
    overloaded: "Перегрузка",
  };
  return map[value] ?? value;
}

export function riskLevelLabel(value: string): string {
  const map: Record<string, string> = {
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[value] ?? value;
}

export function overdueItemTypeLabel(value: string): string {
  const map: Record<string, string> = {
    showcase_goal: "Цель по витрине",
    sales_task: "Задача продаж",
    visit_follow_up: "Контроль после визита",
  };
  return map[value] ?? value;
}

export function severityLabel(value: string): string {
  const map: Record<string, string> = {
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[value] ?? value;
}

export function todayFocusTypeLabel(value: string): string {
  const map: Record<string, string> = {
    call_dealer: "Звонок дилеру",
    showcase_goal: "Цель по витрине",
    prepare_offer: "Подготовка КП",
    follow_up: "Контроль выполнения",
    check_order: "Проверка заказа",
    assistant_task: "Задача ассистенту",
  };
  return map[value] ?? value;
}

export function todayFocusSourceLabel(value: string): string {
  const map: Record<string, string> = {
    showcase_goal: "Цель по витрине",
    regional_report: "Сигнал РМ / отчет",
    manual: "Ручная постановка",
    order: "Заказ",
    leadership: "Управленческий контур",
  };
  return map[value] ?? value;
}

export function managerOverdueTypeLabel(value: string): string {
  const map: Record<string, string> = {
    sales_task: "Задача продаж",
    showcase_goal: "Цель по витрине",
    dealer_follow_up: "Follow-up по дилеру",
  };
  return map[value] ?? value;
}

export function regionalSignalTypeLabel(value: string): string {
  const map: Record<string, string> = {
    visit: "Визит РМ",
    distribution_report: "Отчет дистрибуции",
    showcase_gap: "Пробел витрины",
    comment: "Комментарий РМ",
  };
  return map[value] ?? value;
}

export function quickActionTypeLabel(value: string): string {
  const map: Record<string, string> = {
    open_showcase_goals: "Цели по витринам",
    open_sales_tasks: "Задачи продаж",
    open_dealers: "Клиентская база",
    open_leadership: "Панель руководителя",
    open_regional_route: "Маршрут РМ",
  };
  return map[value] ?? value;
}

export function importSourceLabel(value: string): string {
  const map: Record<string, string> = {
    one_c: "1С",
    bitrix24: "Битрикс24",
    excel: "Excel / CSV",
    manual: "Ручное добавление",
  };
  return map[value] ?? value;
}

export function importSourceStatusLabel(value: string): string {
  const map: Record<string, string> = {
    planned_integration: "Планируется интеграция",
    available_mvp: "Доступно в MVP",
  };
  return map[value] ?? value;
}

export function importRowStatusLabel(value: string): string {
  const map: Record<string, string> = {
    new: "Новый",
    update: "Обновление",
    duplicate: "Дубль",
    error: "Ошибка",
    skipped: "Пропущен",
  };
  return map[value] ?? value;
}

export function importIssueSeverityLabel(value: string): string {
  const map: Record<string, string> = {
    critical: "Критическая",
    high: "Высокая",
    medium: "Средняя",
  };
  return map[value] ?? value;
}

export function clientLifecycleStatusLabel(value: string): string {
  const map: Record<string, string> = {
    active: "Активный",
    potential: "Потенциальный",
    paused: "Приостановлен",
    lost: "Потерян",
    archived: "Архивный",
  };
  return map[value] ?? value;
}

export function assignmentGapTypeLabel(value: string): string {
  const map: Record<string, string> = {
    sales_manager_missing: "Без менеджера продаж",
    regional_manager_missing: "Без регионального менеджера",
    region_missing: "Без региона",
    team_unknown: "Неизвестная команда",
  };
  return map[value] ?? value;
}

export function priorityLabel(value: string): string {
  return taskPriorityLabel(value);
}
