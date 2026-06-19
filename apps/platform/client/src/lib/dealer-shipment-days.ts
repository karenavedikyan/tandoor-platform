/**
 * Дни отгрузки и «светофор» готовности к работе в выбранный день (без backend).
 * Не отражает фактическую отгрузку — только подготовку к визиту/работе в этот день.
 */

import type { DealerRow } from "./dealer-base-mock-data.js";
import { getClientNextStepForDealer, loadClientNextStepsStorage } from "./client-next-step-data.js";
import { getDistributionSnapshotForCard } from "./dealer-card-release-signals.js";
import {
  getShowcaseKpis,
  getShowcaseTasksForDealerDisplay,
  mergeDistributionWithOverrides,
  type ShowcaseStorageV1Dto,
} from "./showcase-distribution-data.js";
import { isDealerHiddenForUser, loadDealerWorkPlanState, type DealerWorkPlanState } from "./dealer-work-plan.js";

export type DealerShipmentDayId =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type DealerShipmentTrafficLight = "green" | "yellow" | "red";

export const DEALER_SHIPMENT_DAY_ORDER: readonly DealerShipmentDayId[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export const DEALER_SHIPMENT_DAY_LABELS: Record<DealerShipmentDayId, string> = {
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота",
};

/** Короткие подписи для узких экранов (карточки дней в планировщике). */
export const DEALER_SHIPMENT_DAY_SHORT_LABELS: Record<DealerShipmentDayId, string> = {
  monday: "Пн",
  tuesday: "Вт",
  wednesday: "Ср",
  thursday: "Чт",
  friday: "Пт",
  saturday: "Сб",
};

const DAY_INDEX: Record<DealerShipmentDayId, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
};

function charSum(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) n += s.charCodeAt(i);
  return n;
}

export function isDealerShipmentDayId(v: unknown): v is DealerShipmentDayId {
  return (
    v === "monday" ||
    v === "tuesday" ||
    v === "wednesday" ||
    v === "thursday" ||
    v === "friday" ||
    v === "saturday"
  );
}

export function sortDealerShipmentDayIds(ids: DealerShipmentDayId[]): DealerShipmentDayId[] {
  const uniq: DealerShipmentDayId[] = [];
  for (const d of ids) {
    if (isDealerShipmentDayId(d) && !uniq.includes(d)) uniq.push(d);
  }
  return uniq.sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
}

/** Поля актуализации, в которых могли задать дни отгрузки (в т. ч. пустой массив — сброс). */
export function dealerFieldsIncludeShipmentKeys(f: Record<string, unknown>): boolean {
  return "shipmentDayIds" in f || "shipmentDayId" in f || "shipmentDayLabel" in f;
}

const RU_LABEL_TO_ID: Record<string, DealerShipmentDayId> = Object.fromEntries(
  DEALER_SHIPMENT_DAY_ORDER.map((d) => [DEALER_SHIPMENT_DAY_LABELS[d].toLowerCase(), d]),
) as Record<string, DealerShipmentDayId>;

/** Нормализация из manual / override: массив id, одиночный id или подписи через запятую. */
export function normalizeManualDealerShipmentDayIdsFromFields(f: Record<string, unknown>): DealerShipmentDayId[] {
  const rawIds = f.shipmentDayIds;
  if (Array.isArray(rawIds)) {
    return sortDealerShipmentDayIds(rawIds.filter(isDealerShipmentDayId));
  }
  if (isDealerShipmentDayId(f.shipmentDayId)) {
    return [f.shipmentDayId];
  }
  const lab = typeof f.shipmentDayLabel === "string" ? f.shipmentDayLabel.trim() : "";
  if (lab) {
    const parts = lab
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const fromLabels: DealerShipmentDayId[] = [];
    for (const p of parts) {
      const id = RU_LABEL_TO_ID[p.toLowerCase()];
      if (id) fromLabels.push(id);
    }
    return sortDealerShipmentDayIds(fromLabels);
  }
  return [];
}

export function formatShipmentDaysForDisplay(ids: DealerShipmentDayId[]): string {
  return sortDealerShipmentDayIds(ids)
    .map((d) => DEALER_SHIPMENT_DAY_LABELS[d])
    .join(", ");
}

/** Текст для сводок / карточки: из нормализованных id или сырого label. */
export function logisticsShipmentDaysTextFromManualFields(f: Record<string, unknown>): string {
  const ids = normalizeManualDealerShipmentDayIdsFromFields(f);
  if (ids.length > 0) return formatShipmentDaysForDisplay(ids);
  const lab = typeof f.shipmentDayLabel === "string" ? f.shipmentDayLabel.trim() : "";
  return lab;
}

/**
 * Если в строке задано `releaseShipmentDayIds` (Excel / актуализация) — используем эти дни.
 * Иначе детерминированно по id, городу и менеджеру (без Math.random).
 */
export function getDealerShipmentDays(row: DealerRow): DealerShipmentDayId[] {
  const ext = row.releaseShipmentDayIds;
  if (Array.isArray(ext) && ext.length > 0) {
    const picked = ext.filter(isDealerShipmentDayId);
    const uniq = sortDealerShipmentDayIds(picked);
    if (uniq.length >= 1) {
      return uniq;
    }
  }

  const base = charSum(row.id) + charSum(row.city) + charSum(row.releaseManagerId ?? row.manager);
  const primary = DEALER_SHIPMENT_DAY_ORDER[base % DEALER_SHIPMENT_DAY_ORDER.length]!;
  const secondIdx = (base + 13 + charSum(row.name)) % DEALER_SHIPMENT_DAY_ORDER.length;
  const secondary = DEALER_SHIPMENT_DAY_ORDER[secondIdx]!;
  if (secondary === primary || base % 4 === 0) return [primary];
  return [primary, secondary].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
}

export type DealerShipmentStatusResult = {
  level: DealerShipmentTrafficLight;
  label: string;
  reason: string;
};

const EMPTY_SHOWCASE_STORAGE: ShowcaseStorageV1Dto = {
  overrides: {},
  taskUpdates: {},
  historyByDealer: {},
  recommendationTaskEntries: {},
};

function showcaseSignals(row: DealerRow, storage: ShowcaseStorageV1Dto = EMPTY_SHOWCASE_STORAGE) {
  const tasks = getShowcaseTasksForDealerDisplay(row, storage);
  const rows = mergeDistributionWithOverrides(row, storage);
  return getShowcaseKpis(rows, tasks);
}

/**
 * Готовность к работе в день отгрузки (не статус реальной отгрузки).
 * `dayId` зарезервирован под будущие правила по дню; сейчас не влияет на уровень.
 */
export function getDealerShipmentStatus(
  row: DealerRow,
  _dayId: DealerShipmentDayId,
  userId: string,
  workPlanState: DealerWorkPlanState = loadDealerWorkPlanState(),
  showcaseStorage?: ShowcaseStorageV1Dto,
): DealerShipmentStatusResult {
  const hidden = userId ? isDealerHiddenForUser(userId, row.id, workPlanState) : false;
  const snap = getDistributionSnapshotForCard(row);
  const { deficitTotal, openTasks, criticalZones } = showcaseSignals(row, showcaseStorage);
  const next = getClientNextStepForDealer(row.id, loadClientNextStepsStorage());
  const hasNextDate = Boolean(next?.contactDate?.trim());

  if (hidden) {
    return {
      level: "red",
      label: "Не готов",
      reason: "Клиент скрыт из рабочего списка — верните в фокус или уточните план.",
    };
  }
  if (row.status === "требует внимания" || row.hasProblem) {
    return {
      level: "red",
      label: "Не готов",
      reason: "Статус «требует внимания» или отмечен риск по точке — нужна разборка до визита.",
    };
  }
  if (deficitTotal > 0 || criticalZones > 0) {
    return {
      level: "red",
      label: "Не готов",
      reason: "Есть дефицит по витрине или критичные зоны выкладки — закройте до дня работы.",
    };
  }
  if (snap.isStale) {
    return {
      level: "red",
      label: "Не готов",
      reason: "Срез дистрибуции устарел — запланируйте актуализацию перед выездом.",
    };
  }

  if (row.status === "активный" && hasNextDate && openTasks === 0) {
    return {
      level: "green",
      label: "Готов",
      reason: "Активный клиент, есть следующий шаг, открытых задач по витрине нет.",
    };
  }

  if (row.status === "активный" && (openTasks > 0 || !hasNextDate)) {
    return {
      level: "yellow",
      label: "Проверить",
      reason: openTasks > 0
        ? "Есть открытые задачи по витрине — приведите в порядок или перенесите срок."
        : "Нет запланированного следующего шага — зафиксируйте контакт или визит.",
    };
  }

  return {
    level: "yellow",
    label: "Проверить",
    reason: "Статус не «активный» или нужно уточнить план работы перед днём отгрузки.",
  };
}
