/**
 * Сигналы «обучение и внимание к персоналу» для клиентов и торговых точек.
 * Локальная логика под будущий API; критерии — первая версия правил на мок-данных.
 */

import { isClientTopTier } from "./client-category.js";
import { type DealerRow, type DealerTradePoint } from "./dealer-base-mock-data.js";
import { getCatalogDealerRows } from "./dealer-base-source.js";
import { getDealerAnalyticsSignalCards } from "./dealer-analytics-signals.js";
import { isManualActualizationDealerId, isManualActualizationTradePointId } from "./client-base-actualization-stable-ids.js";

export type TrainingAttentionLevel = "none" | "watch" | "recommended" | "priority";

export function trainingAttentionLevelBadgeClass(level: TrainingAttentionLevel): string {
  if (level === "priority") return "border-primary/40 bg-primary/10 text-primary";
  if (level === "recommended") return "border-border bg-muted/70 text-foreground";
  if (level === "watch") return "border-border bg-muted/50 text-muted-foreground";
  return "border-border bg-muted/60 text-muted-foreground";
}

export type TrainingAttentionSignal = {
  level: TrainingAttentionLevel;
  label: string;
  reasons: string[];
  recommendedActions: string[];
  suggestedTrainingProgramIds: string[];
};

export const TRAINING_PROGRAM_PRODUCT_BASE = "prog-product-lines";
export const TRAINING_PROGRAM_HARDWARE = "prog-hardware-sales";
export const TRAINING_PROGRAM_SALES = "prog-sales-hits";
export const TRAINING_PROGRAM_ONBOARDING = "prog-adapt-2026";

export function dealerProductTrainingStorageKey(dealerId: string): string {
  return `dealer-product-training-done-${dealerId}`;
}

export function tradePointProductTrainingStorageKey(dealerId: string, pointId: string): string {
  return `trade-point-product-training-done-${dealerId}-${pointId}`;
}

function uniq(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function baseProgramsForDealer(dealer: DealerRow): string[] {
  const ids: string[] = [TRAINING_PROGRAM_PRODUCT_BASE, TRAINING_PROGRAM_SALES];
  if (dealer.distributionDetail.mk >= 40) ids.push(TRAINING_PROGRAM_PRODUCT_BASE);
  if (dealer.showcase.todo.toLowerCase().includes("фурнитур") || dealer.hasProblem) {
    ids.push(TRAINING_PROGRAM_HARDWARE);
  }
  return uniq(ids);
}

function scoreDealerPriorityFactors(dealer: DealerRow, analyticsCount: number): number {
  let s = 0;
  if (isClientTopTier(dealer.clientCategory)) s += 2;
  if (dealer.clientCategory === "new_client" && dealer.distribution >= 50) s += 1;
  if (dealer.format === "сетевой" && dealer.outlets >= 3) s += 1;
  if (dealer.distributionDetail.total < 62) s += 1;
  if (dealer.hasProblem || dealer.status === "требует внимания") s += 1;
  if (analyticsCount >= 1) s += 1;
  if (analyticsCount >= 2) s += 1;
  const weakShowcase = dealer.tradePoints.some((p) => p.distribution.total < 65 || p.issues.toLowerCase().includes("витрин"));
  if (weakShowcase) s += 1;
  if (dealer.regionalManager && dealer.outlets >= 2) s += 0;
  return s;
}

function mergeCompleted(dealer: DealerRow, completedOverride?: boolean): boolean {
  if (typeof completedOverride === "boolean") return completedOverride;
  return dealer.productTrainingCompleted === true;
}

/**
 * Сигнал на уровне клиента. `productTrainingCompletedOverride` — локальное состояние UI / sessionStorage.
 */
export function getDealerTrainingAttentionSignal(
  dealer: DealerRow,
  productTrainingCompletedOverride?: boolean,
): TrainingAttentionSignal {
  if (isManualActualizationDealerId(dealer.id)) {
    return {
      level: "none",
      label: "Обучение и сигналы появятся после данных по точкам и витрине",
      reasons: [],
      recommendedActions: [],
      suggestedTrainingProgramIds: [],
    };
  }
  const completed = mergeCompleted(dealer, productTrainingCompletedOverride);
  if (completed) {
    return {
      level: "none",
      label: "Потребность закрыта",
      reasons: [],
      recommendedActions: ["Периодически обновляйте материалы для персонала точек."],
      suggestedTrainingProgramIds: [],
    };
  }

  const analytics = getDealerAnalyticsSignalCards(dealer);
  const score = scoreDealerPriorityFactors(dealer, analytics.length);
  const programs = baseProgramsForDealer(dealer);
  if (dealer.indigoTrainingCandidate) {
    programs.push(TRAINING_PROGRAM_ONBOARDING);
  }

  if (dealer.clientCategory === "new_client" && dealer.distribution >= 70 && !dealer.hasProblem && analytics.length === 0) {
    return {
      level: "none",
      label: "Обучение не требуется по текущему срезу",
      reasons: ["Нет выраженных сигналов по витрине и ассортименту."],
      recommendedActions: ["Держите стандартные материалы в доступе для новых сотрудников."],
      suggestedTrainingProgramIds: [TRAINING_PROGRAM_PRODUCT_BASE],
    };
  }

  if (score >= 4) {
    return {
      level: "priority",
      label: "Кандидат на обучение",
      reasons: [
        "Клиент объёмообразующий или показательный по текущим правилам.",
        ...(analytics.length ? ["Есть сигналы по витрине, фурнитуре или оборудованию."] : []),
        ...(dealer.distributionDetail.total < 62 ? ["Доля представленности ниже ожидаемой по дистрибуции."] : []),
      ],
      recommendedActions: [
        "Запланировать визит с продуктовым блоком и практикой на витрине.",
        "Согласовать с руководителем точки участие ключевых продавцов.",
      ],
      suggestedTrainingProgramIds: programs,
    };
  }

  if (score >= 2 || dealer.status === "активный") {
    return {
      level: "recommended",
      label: "Рекомендуется провести продуктовое обучение от Tandoor",
      reasons: [
        "Есть потенциал усилить знания персонала по ассортименту и комплектации.",
        ...(dealer.tradePoints.some((p) => p.status === "Активна") ? ["Есть активные торговые точки."] : []),
      ],
      recommendedActions: ["Подключить программы по продукту и технике продаж.", "Зафиксировать дату и ответственных."],
      suggestedTrainingProgramIds: programs,
    };
  }

  if (score >= 1 || dealer.clientCategory === "new_client") {
    return {
      level: "watch",
      label: "Внимание к персоналу",
      reasons: ["Пока без обязательного обучения, но точку стоит держать в поле зрения."],
      recommendedActions: ["Короткий созвон с залом и список тем для следующего визита."],
      suggestedTrainingProgramIds: [TRAINING_PROGRAM_PRODUCT_BASE],
    };
  }

  return {
    level: "none",
    label: "Обучение не требуется по текущему срезу",
    reasons: ["Недостаточно оснований для отдельного продуктового выезда."],
    recommendedActions: [],
    suggestedTrainingProgramIds: [TRAINING_PROGRAM_PRODUCT_BASE],
  };
}

function tpCompleted(point: DealerTradePoint, dealerId: string, override?: boolean): boolean {
  if (typeof override === "boolean") return override;
  return point.productTrainingCompleted === true;
}

export function getTradePointTrainingAttentionSignal(
  dealer: DealerRow,
  point: DealerTradePoint,
  productTrainingCompletedOverride?: boolean,
): TrainingAttentionSignal {
  if (isManualActualizationTradePointId(point.id) || isManualActualizationDealerId(dealer.id)) {
    return {
      level: "none",
      label: "Обучение и сигналы появятся после заполнения витрины и матрицы",
      reasons: [],
      recommendedActions: [],
      suggestedTrainingProgramIds: [],
    };
  }
  const completed = tpCompleted(point, dealer.id, productTrainingCompletedOverride);
  if (completed) {
    return {
      level: "none",
      label: "Потребность закрыта",
      reasons: [],
      recommendedActions: [],
      suggestedTrainingProgramIds: [],
    };
  }

  const dealerSig = getDealerTrainingAttentionSignal(dealer);
  const programs = baseProgramsForDealer(dealer);
  const weak = point.distribution.total < 68 || point.issues.toLowerCase().includes("витрин");
  const active = point.status === "Активна" || point.status === "В работе";

  if (dealerSig.level === "priority" && weak) {
    return {
      level: "priority",
      label: "Рекомендуется прогрузить точку обучением",
      reasons: [
        "Точка важна для клиента и по витрине есть зона роста.",
        "Персоналу полезно синхронизировать знания по МК, ВХ и фурнитуре.",
      ],
      recommendedActions: ["Согласовать мини-сессию на месте или короткий онлайн-блок."],
      suggestedTrainingProgramIds: programs,
    };
  }

  if (dealerSig.level === "recommended" || (active && weak)) {
    return {
      level: "recommended",
      label: "Рекомендуется провести продуктовое обучение от Tandoor",
      reasons: [
        "Активная точка: усиление знаний персонала поддержит конверсию.",
        ...(weak ? ["По витрине или дистрибуции есть заметные вопросы."] : []),
      ],
      recommendedActions: ["Дать ссылки на программы и закрепить контроль руководителя партнёра."],
      suggestedTrainingProgramIds: programs,
    };
  }

  if (active) {
    return {
      level: "watch",
      label: "Внимание к персоналу",
      reasons: ["Имеет смысл планово напомнить о материалах Tandoor."],
      recommendedActions: [],
      suggestedTrainingProgramIds: [TRAINING_PROGRAM_PRODUCT_BASE],
    };
  }

  return {
    level: "none",
    label: "Обучение не требуется по текущему срезу",
    reasons: ["Точка не в фокусе активных сигналов."],
    recommendedActions: [],
    suggestedTrainingProgramIds: [],
  };
}

export type TerritoryTrainingAttentionKpis = {
  recommended: number;
  priority: number;
  indigoCandidates: number;
  completed: number;
};

export function getTerritoryTrainingAttentionKpis(rows: DealerRow[] = getCatalogDealerRows()): TerritoryTrainingAttentionKpis {
  return getTrainingAttentionKpisForDealers(rows);
}

/** KPI обучения по произвольному набору строк клиентской базы (актуализация / активные клиенты). */
export function getTrainingAttentionKpisForDealers(dealers: DealerRow[]): TerritoryTrainingAttentionKpis {
  let recommended = 0;
  let priority = 0;
  let indigoCandidates = 0;
  let completed = 0;

  for (const d of dealers) {
    if (d.productTrainingCompleted) completed += 1;
    if (d.indigoTrainingCandidate) indigoCandidates += 1;
    const sig = getDealerTrainingAttentionSignal(d);
    if (sig.level === "priority") priority += 1;
    else if (sig.level === "recommended") recommended += 1;
  }

  return { recommended, priority, indigoCandidates, completed };
}
