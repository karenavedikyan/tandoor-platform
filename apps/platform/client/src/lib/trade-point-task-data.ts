import {
  type MatrixActionKind,
  type ShowcasePortal,
  type ShowcaseZone,
  type TradePointProductMatrixItem,
} from "./trade-point-matrix-data";

export type MatrixTaskType =
  | "add_to_showcase"
  | "check_presence"
  | "update_photo"
  | "approve_replacement"
  | "maintain_showcase";

export type MatrixTaskStatus = "new" | "in_progress" | "done" | "overdue";
export type MatrixTaskPriority = "high" | "medium" | "low";
export type MatrixTaskAssigneeRole = "manager" | "regional_manager" | "assistant";

export type MatrixTask = {
  taskId: string;
  productId: string;
  productName: string;
  productArticle: string;
  dealerId: string;
  tradePointId: string;
  tradePointName: string;
  type: MatrixTaskType;
  title: string;
  description: string;
  priority: MatrixTaskPriority;
  status: MatrixTaskStatus;
  assigneeRole: MatrixTaskAssigneeRole;
  dueDate: string;
  source: "product_matrix";
  zone: ShowcaseZone;
  portal: ShowcasePortal;
  targetSamples: number;
  actualSamples: number;
};

export type MatrixTaskRecommendation = MatrixTask & {
  /** Признак того, что задача ещё не «создана» пользователем (исходная рекомендация). */
  recommended: true;
};

export type MatrixTaskCreated = MatrixTask & {
  recommended: false;
};

export type MatrixTaskSummary = {
  total: number;
  newCount: number;
  inProgressCount: number;
  overdueCount: number;
  highPriorityCount: number;
};

export const MATRIX_TASK_TYPE_LABEL: Record<MatrixTaskType, string> = {
  add_to_showcase: "Добавить на витрину",
  check_presence: "Проверить наличие",
  update_photo: "Обновить фото",
  approve_replacement: "Согласовать замену",
  maintain_showcase: "Поддерживать выкладку",
};

export const MATRIX_TASK_STATUS_LABEL: Record<MatrixTaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Закрыта",
  overdue: "Просрочена",
};

export const MATRIX_TASK_PRIORITY_LABEL: Record<MatrixTaskPriority, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

export const MATRIX_TASK_ROLE_LABEL: Record<MatrixTaskAssigneeRole, string> = {
  manager: "Менеджер",
  regional_manager: "Региональный менеджер",
  assistant: "Ассистент",
};

function typeFromAction(action: MatrixActionKind): MatrixTaskType {
  if (action === "Добавить") return "add_to_showcase";
  if (action === "Проверить") return "check_presence";
  if (action === "Обновить фото") return "update_photo";
  if (action === "Согласовать замену") return "approve_replacement";
  return "maintain_showcase";
}

function priorityFromMatrix(p: TradePointProductMatrixItem["priority"]): MatrixTaskPriority {
  if (p === "Высокий") return "high";
  if (p === "Средний") return "medium";
  return "low";
}

function roleFromType(type: MatrixTaskType): MatrixTaskAssigneeRole {
  if (type === "approve_replacement") return "regional_manager";
  if (type === "update_photo") return "assistant";
  return "manager";
}

function titleFor(type: MatrixTaskType, productName: string): string {
  if (type === "add_to_showcase") return `Добавить «${productName}» на витрину`;
  if (type === "check_presence") return `Проверить наличие «${productName}»`;
  if (type === "update_photo") return `Обновить фото «${productName}»`;
  if (type === "approve_replacement") return `Согласовать замену «${productName}»`;
  return `Поддерживать выкладку «${productName}»`;
}

function descriptionFor(item: TradePointProductMatrixItem, type: MatrixTaskType): string {
  const base = `${item.portal}, зона ${item.zone}. Образцы: ${item.actualSamples} / ${item.targetSamples}.`;
  if (type === "add_to_showcase") {
    return `${base} Разместить модель в матрице торговой точки и обеспечить целевое количество образцов.`;
  }
  if (type === "check_presence") {
    return `${base} Подтвердить фактическое наличие модели и актуализировать статус матрицы.`;
  }
  if (type === "update_photo") {
    return `${base} Сделать актуальные фото выкладки и приложить к карточке точки.`;
  }
  if (type === "approve_replacement") {
    return `${base} Согласовать с РМ замену образца или выводимую позицию.`;
  }
  return `${base} Контролировать сохранение выкладки в текущем цикле.`;
}

function charSum(str: string): number {
  let sum = 0;
  for (let i = 0; i < str.length; i += 1) sum += str.charCodeAt(i);
  return sum;
}

function dueDateFor(dealerId: string, pointId: string, productId: string, type: MatrixTaskType): string {
  const seed = (charSum(dealerId) + charSum(pointId) + charSum(productId)) % 21;
  const offset = type === "add_to_showcase" || type === "approve_replacement" ? 5 : 12;
  const day = ((seed + offset) % 27) + 1;
  const month = ((seed + offset) % 4) + 5;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.2026`;
}

function statusFor(item: TradePointProductMatrixItem): MatrixTaskStatus {
  if (item.presence === "на проверке") return "in_progress";
  if (item.presence === "нужно добавить" && item.priority === "Высокий") {
    return item.actualSamples === 0 && item.targetSamples >= 2 ? "overdue" : "new";
  }
  return "new";
}

function tradePointDisplayName(pointId: string): string {
  return `ТТ ${pointId}`;
}

function shouldGenerateTask(item: TradePointProductMatrixItem): boolean {
  if (item.presence === "есть на витрине" && item.action === "Поддерживать") return false;
  return true;
}

/**
 * Сгенерировать рекомендованные задачи из матрицы товаров.
 * Каждая позиция, требующая действия, превращается в задачу-рекомендацию.
 */
export function buildRecommendedMatrixTasks(
  dealerId: string,
  pointId: string,
  pointName: string,
  matrix: TradePointProductMatrixItem[],
): MatrixTaskRecommendation[] {
  const result: MatrixTaskRecommendation[] = [];
  for (const item of matrix) {
    if (!shouldGenerateTask(item)) continue;
    const type = typeFromAction(item.action);
    const priority = priorityFromMatrix(item.priority);
    const status = statusFor(item);
    const taskId = `${pointId}-${item.productId}-${type}`;
    result.push({
      taskId,
      productId: item.productId,
      productName: item.productName,
      productArticle: item.productArticle,
      dealerId,
      tradePointId: pointId,
      tradePointName: pointName ? pointName : tradePointDisplayName(pointId),
      type,
      title: titleFor(type, item.productName),
      description: descriptionFor(item, type),
      priority,
      status,
      assigneeRole: roleFromType(type),
      dueDate: dueDateFor(dealerId, pointId, item.productId, type),
      source: "product_matrix",
      zone: item.zone,
      portal: item.portal,
      targetSamples: item.targetSamples,
      actualSamples: item.actualSamples,
      recommended: true,
    });
  }
  return result;
}

export function summarizeMatrixTasks(tasks: MatrixTask[]): MatrixTaskSummary {
  let newCount = 0;
  let inProgressCount = 0;
  let overdueCount = 0;
  let highPriorityCount = 0;
  for (const t of tasks) {
    if (t.status === "new") newCount += 1;
    else if (t.status === "in_progress") inProgressCount += 1;
    else if (t.status === "overdue") overdueCount += 1;
    if (t.priority === "high") highPriorityCount += 1;
  }
  return {
    total: tasks.length,
    newCount,
    inProgressCount,
    overdueCount,
    highPriorityCount,
  };
}

/**
 * Получить статус задачи матрицы для конкретной модели в конкретной точке —
 * используется в карточке товара. Возвращает только рекомендованные задачи
 * (без пользовательских изменений), это нужно лишь как индикатор.
 */
export function getMatrixTaskHintForProductInPoint(
  matrix: TradePointProductMatrixItem[],
  productId: string,
): { type: MatrixTaskType; priority: MatrixTaskPriority } | undefined {
  const item = matrix.find((i) => i.productId === productId);
  if (!item) return undefined;
  if (!shouldGenerateTask(item)) return undefined;
  const type = typeFromAction(item.action);
  const priority = priorityFromMatrix(item.priority);
  return { type, priority };
}
