/**
 * Дни отгрузки и «светофор» готовности к работе в выбранный день (без backend).
 * Не отражает фактическую отгрузку — только подготовку к визиту/работе в этот день.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getClientNextStepForDealer, loadClientNextStepsStorage } from "@/lib/client-next-step-data";
import { getDistributionSnapshotForCard } from "@/lib/dealer-card-release-signals";
import {
  getShowcaseKpis,
  getShowcaseTasksForDealerDisplay,
  loadShowcaseStorage,
  mergeDistributionWithOverrides,
} from "@/lib/showcase-distribution-data";
import { isDealerHiddenForUser, loadDealerWorkPlanState, type DealerWorkPlanState } from "@/lib/dealer-work-plan";

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

function isShipmentDayId(v: unknown): v is DealerShipmentDayId {
  return (
    v === "monday" ||
    v === "tuesday" ||
    v === "wednesday" ||
    v === "thursday" ||
    v === "friday" ||
    v === "saturday"
  );
}

/**
 * Если в строке задано `releaseShipmentDayIds` (данные Excel/API) — используем 1–2 дня.
 * Иначе детерминированно по id, городу и менеджеру (без Math.random).
 */
export function getDealerShipmentDays(row: DealerRow): DealerShipmentDayId[] {
  const ext = (row as DealerRow & { releaseShipmentDayIds?: unknown }).releaseShipmentDayIds;
  if (Array.isArray(ext)) {
    const picked = ext.filter(isShipmentDayId);
    const uniq: DealerShipmentDayId[] = [];
    for (const d of picked) {
      if (!uniq.includes(d)) uniq.push(d);
    }
    if (uniq.length >= 1) return uniq.slice(0, 2).sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
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

function showcaseSignals(row: DealerRow) {
  const s = loadShowcaseStorage();
  const tasks = getShowcaseTasksForDealerDisplay(row, s);
  const rows = mergeDistributionWithOverrides(row, s);
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
): DealerShipmentStatusResult {
  const hidden = userId ? isDealerHiddenForUser(userId, row.id, workPlanState) : false;
  const snap = getDistributionSnapshotForCard(row);
  const { deficitTotal, openTasks, criticalZones } = showcaseSignals(row);
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
