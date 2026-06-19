import type { ActualizationState, ShowcaseMatrixTask } from "./client-base-actualization-state";
import { type DealerRow } from "./dealer-base-mock-data";
import { getCatalogDealerRows } from "./dealer-base-source";
import { getDealerTrainingAttentionSignal, TRAINING_PROGRAM_PRODUCT_BASE } from "./training-attention";
import { fetchShowcaseGlobalTasks } from "./showcase-distribution-api";
import { SHOWCASE_CATEGORY_LABEL, type ShowcaseGlobalTaskRow } from "./showcase-distribution-data";
import {
  fetchShowcaseMatrixDeficitTasksForDealers,
  getCachedShowcaseMatrixDeficitTasksForDealers,
} from "./showcase-matrix-deficit-tasks";
import {
  getTradePointMatrix,
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
  | "maintain_showcase"
  | "product_training";

export type MatrixTaskStatus = "new" | "in_progress" | "done" | "overdue";
export type MatrixTaskPriority = "high" | "medium" | "low";
export type MatrixTaskAssigneeRole = "manager" | "regional_manager" | "assistant";

/** Откуда в интерфейсе сформирован контекст задачи (для списка задач). */
export type TaskInsightDomain = "analytics" | "showcase" | "hardware" | "equipment" | "territory";

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
  source:
    | "product_matrix"
    | "product_training"
    | "showcase_distribution"
    | "showcase_matrix_deficit"
    /** Задачи, явно сохранённые в `ActualizationState.tradePointShowcaseActualizationById.*.showcaseMatrixTasks` (серверный merge). */
    | "showcase_actualization_persisted";
  /** Для задач из сигнала обучения — ссылка на программу в разделе «Обучение». */
  trainingProgramId?: string;
  zone: ShowcaseZone;
  portal: ShowcasePortal;
  targetSamples: number;
  actualSamples: number;
  insightDomain?: TaskInsightDomain;
  insightLabel?: string;
  /** Только `showcase_distribution`: отложено или запрос помощи РОПа (при этом `status` как в матрице). */
  showcaseExtraStatus?: "needs_rop" | "postponed";
  /** Только `showcase_matrix_deficit`: превью фото для списка задач. */
  showcaseMatrixImageSrc?: string;
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
  product_training: "Продуктовое обучение",
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
  if (type === "product_training") return "manager";
  return "manager";
}

function titleFor(type: MatrixTaskType, productName: string): string {
  if (type === "product_training") return "Провести продуктовое обучение Tandoor";
  if (type === "add_to_showcase") return `Добавить «${productName}» на витрину`;
  if (type === "check_presence") return `Проверить наличие «${productName}»`;
  if (type === "update_photo") return `Обновить фото «${productName}»`;
  if (type === "approve_replacement") return `Согласовать замену «${productName}»`;
  return `Поддерживать выкладку «${productName}»`;
}

function descriptionFor(item: TradePointProductMatrixItem, type: MatrixTaskType): string {
  if (type === "product_training") {
    return "Согласовать визит или сессию для персонала партнёра: ассортимент, витрина, ответы на типовые вопросы покупателя.";
  }
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

const TASK_INSIGHT_LABEL: Record<TaskInsightDomain, string> = {
  analytics: "Аналитика",
  showcase: "Витрина",
  hardware: "Фурнитура",
  equipment: "Оборудование",
  territory: "Карточка территории",
};

function insightForTaskId(taskId: string): { insightDomain: TaskInsightDomain; insightLabel: string } {
  const pool: TaskInsightDomain[] = [
    "showcase",
    "showcase",
    "showcase",
    "analytics",
    "hardware",
    "equipment",
    "territory",
  ];
  const domain = pool[charSum(taskId) % pool.length]!;
  return { insightDomain: domain, insightLabel: TASK_INSIGHT_LABEL[domain] };
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
    const ins = insightForTaskId(taskId);
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
      insightDomain: ins.insightDomain,
      insightLabel: ins.insightLabel,
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

export type MatrixTaskWithContext = MatrixTask & {
  dealerName: string;
};

function mapShowcaseGlobalToMatrixTask(g: ShowcaseGlobalTaskRow): MatrixTaskWithContext {
  let matrixStatus: MatrixTaskStatus = "new";
  let showcaseExtraStatus: "needs_rop" | "postponed" | undefined;
  if (g.showcaseStatus === "needs_rop") {
    matrixStatus = "in_progress";
    showcaseExtraStatus = "needs_rop";
  } else if (g.showcaseStatus === "in_progress") {
    matrixStatus = "in_progress";
  } else if (g.showcaseStatus === "postponed") {
    matrixStatus = "new";
    showcaseExtraStatus = "postponed";
  } else {
    matrixStatus = "new";
  }
  return {
    taskId: g.taskId,
    productId: g.categoryId,
    productName: SHOWCASE_CATEGORY_LABEL[g.categoryId],
    productArticle: "SHOWCASE",
    dealerId: g.dealerId,
    tradePointId: g.tradePointId,
    tradePointName: g.tradePointName,
    type: "maintain_showcase",
    title: g.title,
    description: g.description,
    priority: g.priority,
    status: matrixStatus,
    assigneeRole: "manager",
    dueDate: g.dueDate,
    source: "showcase_distribution",
    zone: "A",
    portal: "Стенд / зона",
    targetSamples: g.targetCount,
    actualSamples: g.actualCount,
    insightDomain: "showcase",
    insightLabel: "Витрина (план)",
    dealerName: g.dealerName,
    showcaseExtraStatus,
  };
}

async function computeShowcaseMatrixTasksForDealers(dealers: DealerRow[]): Promise<MatrixTaskWithContext[]> {
  if (dealers.length === 0) return [];
  const globalRows = await fetchShowcaseGlobalTasks();
  const allowed = new Set(dealers.map((d) => d.id));
  return globalRows.filter((g) => allowed.has(g.dealerId)).map(mapShowcaseGlobalToMatrixTask);
}

/**
 * Дефицит по точке из локального backend-кэша (без сети).
 * Для актуального списка на `/tasks` используйте {@link fetchShowcaseMatrixDeficitTasksForDealers}.
 */
export function getShowcaseMatrixDeficitTasksForTradePoint(dealer: DealerRow, pointId: string): MatrixTaskWithContext[] {
  return getCachedShowcaseMatrixDeficitTasksForDealers([dealer]).filter((t) => t.tradePointId === pointId.trim());
}

/**
 * Реальные открытые задачи по витрине: план витрины (БД) + дефицит матрицы из БД.
 */
export async function getShowcaseBackedTasksForDealers(dealers: DealerRow[]): Promise<MatrixTaskWithContext[]> {
  if (dealers.length === 0) return [];
  const [plan, deficit] = await Promise.all([
    computeShowcaseMatrixTasksForDealers(dealers),
    fetchShowcaseMatrixDeficitTasksForDealers(dealers),
  ]);
  return [...plan, ...deficit];
}

/**
 * Только записи плана витрины из БД (`source: showcase_distribution`).
 * Без автогенерации дефицита матрицы по каталогу — для KPI РОП/директора, где нельзя показывать вычисленные «задачи» как факт.
 */
export async function getShowcaseDistributionPlanTasksForDealers(dealers: DealerRow[]): Promise<MatrixTaskWithContext[]> {
  if (dealers.length === 0) return [];
  return computeShowcaseMatrixTasksForDealers(dealers);
}

function formatPersistedShowcaseTaskDueLabel(iso: string): string {
  const t = iso?.trim();
  if (!t) return "—";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return "—";
  const dt = new Date(ms);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function mapShowcaseMatrixTaskToMatrixContext(
  mt: ShowcaseMatrixTask,
  dealer: DealerRow,
  tradePointName: string,
): MatrixTaskWithContext {
  const status: MatrixTaskStatus = mt.status === "done" ? "done" : "new";
  const title =
    mt.reason === "matrix_required_missing"
      ? `Обязательная модель матрицы: ${mt.productName}`
      : `Задача витрины: ${mt.productName}`;
  return {
    taskId: mt.id,
    productId: mt.productId,
    productName: mt.productName,
    productArticle: "MATRIX",
    dealerId: mt.dealerId,
    tradePointId: mt.tradePointId,
    tradePointName,
    type: "add_to_showcase",
    title,
    description: "Задача создана в форме актуализации витрины торговой точки и сохранена в базе актуализации.",
    priority: "high",
    status,
    assigneeRole: "manager",
    dueDate: formatPersistedShowcaseTaskDueLabel(mt.createdAt),
    source: "showcase_actualization_persisted",
    zone: "A",
    portal: "Стенд / зона",
    targetSamples: 1,
    actualSamples: status === "done" ? 1 : 0,
    insightDomain: "showcase",
    insightLabel: "Актуализация витрины",
    dealerName: dealer.name,
  };
}

/**
 * Только задачи витрины, сохранённые в merge актуализации (`showcaseMatrixTasks` по точкам).
 * Без sessionStorage-плана, без автогенерации дефицита по локальной матрице — для РОП/директора на team plane.
 */
export function getActualizationPersistedShowcaseMatrixTasksForDealers(
  dealers: DealerRow[],
  act: ActualizationState,
): MatrixTaskWithContext[] {
  if (dealers.length === 0) return [];
  const out: MatrixTaskWithContext[] = [];
  for (const dealer of dealers) {
    if (act.trashedDealersById?.[dealer.id]) continue;
    for (const point of dealer.tradePoints) {
      if (point.status?.trim() === "Архив") continue;
      if (act.trashedTradePointsById?.[point.id]) continue;
      if (act.trashedTradePointsById?.[point.id]) continue;
      const sh = act.tradePointShowcaseActualizationById[point.id];
      for (const mt of sh?.showcaseMatrixTasks ?? []) {
        if (mt.dealerId !== dealer.id || mt.tradePointId !== point.id) continue;
        out.push(mapShowcaseMatrixTaskToMatrixContext(mt, dealer, point.name?.trim() || point.id));
      }
    }
  }
  return out;
}

/**
 * Управленческий контур директора/РОП (team merge): тот же набор, что {@link getActualizationPersistedShowcaseMatrixTasksForDealers}.
 * Использовать для сводок на главной, в analytics overview и на `/tasks`, чтобы цифры не расходились с sessionStorage/дефицитом.
 */
export function getManagementFactualShowcaseTasksForDealers(
  dealers: DealerRow[],
  act: ActualizationState,
): MatrixTaskWithContext[] {
  return getActualizationPersistedShowcaseMatrixTasksForDealers(dealers, act);
}

/** Ленивый кэш только матрицы товаров (без задач витрины из sessionStorage). */
let matrixBaseTasksCache: MatrixTaskWithContext[] | null = null;

export function invalidateMatrixTasksCache(): void {
  matrixBaseTasksCache = null;
}

function computeAllMatrixTasks(): MatrixTaskWithContext[] {
  const result: MatrixTaskWithContext[] = [];
  for (const dealer of getCatalogDealerRows()) {
    for (const point of dealer.tradePoints) {
      const matrix = getTradePointMatrix(dealer.id, point.id);
      const recs = buildRecommendedMatrixTasks(dealer.id, point.id, point.name, matrix);
      for (const r of recs) {
        result.push({
          taskId: `${dealer.id}|${r.taskId}`,
          productId: r.productId,
          productName: r.productName,
          productArticle: r.productArticle,
          dealerId: r.dealerId,
          tradePointId: r.tradePointId,
          tradePointName: r.tradePointName,
          type: r.type,
          title: r.title,
          description: r.description,
          priority: r.priority,
          status: r.status,
          assigneeRole: r.assigneeRole,
          dueDate: r.dueDate,
          source: r.source,
          zone: r.zone,
          portal: r.portal,
          targetSamples: r.targetSamples,
          actualSamples: r.actualSamples,
          insightDomain: r.insightDomain,
          insightLabel: r.insightLabel,
          dealerName: dealer.name,
        });
      }
    }
  }
  result.push(...buildProductTrainingTasks(getCatalogDealerRows()));
  return result;
}

/**
 * Сводный список задач по всем дилерам и их торговым точкам (матрица товаров).
 * Задачи плана витрины подгружаются отдельно через API (`getShowcaseDistributionPlanTasksForDealers`).
 */
export function getAllMatrixTasks(): MatrixTaskWithContext[] {
  if (!matrixBaseTasksCache) matrixBaseTasksCache = computeAllMatrixTasks();
  return matrixBaseTasksCache;
}

function buildProductTrainingTasks(dealers: DealerRow[]): MatrixTaskWithContext[] {
  const out: MatrixTaskWithContext[] = [];
  for (const dealer of dealers) {
    const sig = getDealerTrainingAttentionSignal(dealer);
    if (sig.level !== "priority") continue;
    if (dealer.productTrainingCompleted) continue;
    const point = dealer.tradePoints[0];
    if (!point) continue;
    const programId = sig.suggestedTrainingProgramIds[0] ?? TRAINING_PROGRAM_PRODUCT_BASE;
    const taskId = `training-${dealer.id}-${point.id}`;
    out.push({
      taskId,
      productId: "mk-grand-3-mk",
      productName: "Продуктовое обучение Tandoor",
      productArticle: "TRAINING",
      dealerId: dealer.id,
      tradePointId: point.id,
      tradePointName: point.name,
      type: "product_training",
      title: "Провести продуктовое обучение Tandoor",
      description:
        "Согласовать визит или сессию для персонала партнёра: ассортимент, витрина, ответы на типовые вопросы покупателя.",
      priority: "high",
      status: "new",
      assigneeRole: "manager",
      dueDate: `${String(10 + (dealer.id.charCodeAt(2) % 12)).padStart(2, "0")}.05.2026`,
      source: "product_training",
      zone: "A",
      portal: "Стенд / зона",
      targetSamples: 0,
      actualSamples: 0,
      insightDomain: "territory",
      insightLabel: "Обучение",
      dealerName: dealer.name,
      trainingProgramId: programId,
    });
  }
  return out;
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
