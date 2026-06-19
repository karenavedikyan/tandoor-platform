/**
 * Промт 422: UI-хелперы для основной ТТ и защиты trash.
 */

import type { DealerTradePoint } from "./dealer-base-mock-data.js";
import { getTradePointIsPrimary } from "./dealer-overrides-runtime.js";

export const TRADE_POINT_LAST_TP_TOOLTIP =
  "Нельзя удалить единственную точку клиента";
export const TRADE_POINT_PRIMARY_TP_TOOLTIP = "Сначала назначьте основной другую точку";

export function resolveTradePointIsPrimary(tp: DealerTradePoint, activeCount: number): boolean {
  if (activeCount === 1) return true;
  return getTradePointIsPrimary(tp.id, tp.isPrimary === true);
}

export function tradePointTrashDisabledReason(
  tp: DealerTradePoint,
  activeCount: number,
): string | null {
  if (activeCount <= 1) return TRADE_POINT_LAST_TP_TOOLTIP;
  if (resolveTradePointIsPrimary(tp, activeCount)) return TRADE_POINT_PRIMARY_TP_TOOLTIP;
  return null;
}

export function canTrashTradePointUi(tp: DealerTradePoint, activeCount: number): boolean {
  return tradePointTrashDisabledReason(tp, activeCount) === null;
}
