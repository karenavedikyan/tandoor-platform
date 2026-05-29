/**
 * Рабочие признаки склада для пилотной фильтрации (без backend и без подтверждения остатков).
 */

import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerCharacteristicValue } from "@/lib/dealer-characteristics";
import { isManualActualizationDealerId } from "@/lib/client-base-actualization-stable-ids";

export type DealerStockSignal = {
  hasMainWarehouse: boolean;
  hasHardwareWarehouse: boolean;
  mainWarehouseLabel: string;
  hardwareWarehouseLabel: string;
  reason: string;
};

export type DealerStockListFilterId = "all" | "main" | "hardware" | "any" | "none";

export const DEALER_STOCK_FILTER_LABELS: Record<DealerStockListFilterId, string> = {
  all: "Все",
  main: "Есть склад",
  hardware: "Есть склад по фурнитуре",
  any: "Есть любой склад",
  none: "Склад не указан",
};

function charSum(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) n += s.charCodeAt(i);
  return n;
}

const CAT_WEIGHT: Record<ClientCategoryId, number> = {
  top150: 11,
  top350: 13,
  top500: 17,
  top500plus: 19,
  new_client: 41,
};

/** true / false / null = не удалось прочитать из строки */
function parseStockHint(raw: string | undefined): boolean | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t || t === "—" || t === "-" || t === "n/a" || t === "нет данных") return null;
  if (
    t.includes("нет") ||
    t.includes("отсут") ||
    t.includes("не вед") ||
    t === "0" ||
    t === "no"
  ) {
    return false;
  }
  if (
    t.includes("есть") ||
    t.includes("склад") ||
    t.includes("налич") ||
    t.includes("да") ||
    t.includes("+") ||
    t.includes("ведётся") ||
    t.includes("ведется")
  ) {
    return true;
  }
  return null;
}

function deriveFromTradePoints(row: DealerRow): { main?: boolean; hw?: boolean } {
  let mainTrue = false;
  let mainFalseSeen = false;
  let hwTrue = false;
  let hwFalseSeen = false;
  for (const tp of row.tradePoints) {
    const d = parseStockHint(tp.doorsStockStatus);
    const h = parseStockHint(tp.hardwareStockStatus);
    if (d === true) mainTrue = true;
    if (d === false) mainFalseSeen = true;
    if (h === true) hwTrue = true;
    if (h === false) hwFalseSeen = true;
  }
  let main: boolean | undefined;
  if (mainTrue) main = true;
  else if (mainFalseSeen) main = false;
  let hw: boolean | undefined;
  if (hwTrue) hw = true;
  else if (hwFalseSeen) hw = false;
  return { main, hw };
}

function deterministicFallback(row: DealerRow): { main: boolean; hw: boolean } {
  const cat = CAT_WEIGHT[row.clientCategory] ?? 0;
  const h =
    charSum(row.id) +
    charSum(row.city) * 3 +
    charSum(row.name) +
    Math.round(row.distribution) * 7 +
    cat * 5;
  const main = (h % 5) !== 0;
  const hw = (h % 7) !== 1;
  return { main, hw };
}

export function getDealerStockSignal(row: DealerRow): DealerStockSignal {
  if (isManualActualizationDealerId(row.id)) {
    const door = row.hasDoorWarehouse === true;
    const hw = row.hasHardwareWarehouse === true;
    const doorUnset = row.hasDoorWarehouse == null;
    const hwUnset = row.hasHardwareWarehouse == null;
    return {
      hasMainWarehouse: door,
      hasHardwareWarehouse: hw,
      mainWarehouseLabel: door ? "Есть склад двери" : doorUnset ? "Склад двери не указан" : "Нет склада двери",
      hardwareWarehouseLabel: hw ? "Есть склад фурнитуры" : hwUnset ? "Склад фурнитуры не указан" : "Нет склада фурнитуры",
      reason: "Признаки склада задаются в блоке «Коммерческие характеристики» актуализации.",
    };
  }
  const ovMain = getDealerCharacteristicValue(row.id, "has_warehouse");
  const ovHw = getDealerCharacteristicValue(row.id, "has_hardware_warehouse");

  const ext = row as DealerRow & { releaseHasMainWarehouse?: boolean; releaseHasHardwareWarehouse?: boolean };
  let baseMain: boolean;
  let baseHw: boolean;
  let baseReason: string;
  if (typeof ext.releaseHasMainWarehouse === "boolean" || typeof ext.releaseHasHardwareWarehouse === "boolean") {
    baseMain = Boolean(ext.releaseHasMainWarehouse);
    baseHw = Boolean(ext.releaseHasHardwareWarehouse);
    baseReason = "Признак из полей данных клиента (пилот).";
  } else {
    const fromTp = deriveFromTradePoints(row);
    const fb = deterministicFallback(row);
    baseMain = fromTp.main ?? fb.main;
    baseHw = fromTp.hw ?? fb.hw;
    const fromFields = fromTp.main !== undefined || fromTp.hw !== undefined;
    baseReason = fromFields
      ? "Частично из полей точки, дальше — рабочая эвристика для пилота."
      : "Рабочий признак для фильтрации в пилоте, без подтверждения фактических остатков.";
  }

  const hasMain = ovMain === "yes" ? true : ovMain === "no" ? false : baseMain;
  const hasHw = ovHw === "yes" ? true : ovHw === "no" ? false : baseHw;
  const overridden = ovMain !== "unset" || ovHw !== "unset";
  const reason = overridden ? "Отмечено вручную в карточке клиента." : baseReason;
  return {
    hasMainWarehouse: hasMain,
    hasHardwareWarehouse: hasHw,
    mainWarehouseLabel: hasMain ? "Есть склад" : "Склад не указан",
    hardwareWarehouseLabel: hasHw ? "Есть склад по фурнитуре" : "Склад не указан",
    reason,
  };
}

export function dealerRowMatchesStockFilter(row: DealerRow, filter: DealerStockListFilterId): boolean {
  if (filter === "all") return true;
  const s = getDealerStockSignal(row);
  if (filter === "main") return s.hasMainWarehouse;
  if (filter === "hardware") return s.hasHardwareWarehouse;
  if (filter === "any") return s.hasMainWarehouse || s.hasHardwareWarehouse;
  return !s.hasMainWarehouse && !s.hasHardwareWarehouse;
}
