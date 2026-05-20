/**
 * Стабильные идентификаторы и проверки дублей для ручной актуализации клиентской базы.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ActualizationState, ManualDealer } from "@/lib/client-base-actualization-state";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Метка времени для id: yyyyMMddHHmmss (локальное время браузера). */
export function formatManualIdTimestamp(d = new Date()): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function shortRandom(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function generateStableManualDealerId(now = new Date()): string {
  return `manual-dealer-${formatManualIdTimestamp(now)}-${shortRandom()}`;
}

export function generateStableManualTradePointId(dealerId: string, now = new Date()): string {
  return `manual-tp-${dealerId}-${formatManualIdTimestamp(now)}-${shortRandom()}`;
}

/** Клиент, созданный только через актуализацию (не release-строка). */
export function isManualActualizationDealerId(dealerId: string): boolean {
  return dealerId.trim().startsWith("manual-dealer-");
}

/** Торговая точка, созданная только через актуализацию. */
export function isManualActualizationTradePointId(tradePointId: string): boolean {
  return tradePointId.trim().startsWith("manual-tp-");
}

export function normalizeInnDigits(inn: string): string {
  return inn.replace(/\D/g, "");
}

/** Следующий человекочитаемый код MA-MANUAL-000001 по уже созданным ручным клиентам. */
export function nextManualDealerInternalCode(state: ActualizationState): string {
  let max = 0;
  for (const m of Object.values(state.manuallyCreatedDealersById)) {
    const raw = (m.internalCode ?? "").trim();
    const m1 = /^MA-MANUAL-(\d+)$/i.exec(raw);
    if (m1) max = Math.max(max, parseInt(m1[1], 10));
  }
  return `MA-MANUAL-${String(max + 1).padStart(6, "0")}`;
}

export type InnDuplicateMatch = {
  dealerId: string;
  name: string;
};

/** Поиск клиента с тем же ИНН (цифры) в merged-строках и ручных дилерах. */
export function findInnDuplicateInActualization(
  innRaw: string,
  mergedRows: DealerRow[],
  act: ActualizationState,
  excludeDealerId?: string,
): InnDuplicateMatch | null {
  const digits = normalizeInnDigits(innRaw);
  if (digits.length < 10) return null;

  for (const row of mergedRows) {
    if (excludeDealerId && row.id === excludeDealerId) continue;
    const rowInn = normalizeInnDigits(row.actualizationInn ?? "");
    if (rowInn && rowInn === digits) {
      return { dealerId: row.id, name: row.name };
    }
  }

  for (const m of Object.values(act.manuallyCreatedDealersById)) {
    if (excludeDealerId && m.id === excludeDealerId) continue;
    const f = (m.fields ?? {}) as Record<string, unknown>;
    const inn = typeof f.inn === "string" ? f.inn : "";
    if (normalizeInnDigits(inn) === digits) {
      const name = typeof f.name === "string" ? f.name : "Клиент";
      return { dealerId: m.id, name };
    }
  }

  return null;
}

export type NameCityDuplicateMatch = { dealerId: string; name: string };

export function findNameCityDuplicateInActualization(
  nameRaw: string,
  cityRaw: string,
  mergedRows: DealerRow[],
  act: ActualizationState,
  excludeDealerId?: string,
): NameCityDuplicateMatch | null {
  const name = nameRaw.trim().toLowerCase();
  const city = cityRaw.trim().toLowerCase();
  if (!name || !city) return null;

  for (const row of mergedRows) {
    if (excludeDealerId && row.id === excludeDealerId) continue;
    if (row.name.trim().toLowerCase() === name && row.city.trim().toLowerCase() === city) {
      return { dealerId: row.id, name: row.name };
    }
  }

  for (const m of Object.values(act.manuallyCreatedDealersById)) {
    if (excludeDealerId && m.id === excludeDealerId) continue;
    const f = (m.fields ?? {}) as Record<string, unknown>;
    const n = typeof f.name === "string" ? f.name.trim().toLowerCase() : "";
    const c = typeof f.city === "string" ? f.city.trim().toLowerCase() : "";
    if (n === name && c === city) {
      return { dealerId: m.id, name: typeof f.name === "string" ? f.name : "Клиент" };
    }
  }

  return null;
}

export function manualDealerDisplayInternalCode(m: ManualDealer): string {
  const c = m.internalCode?.trim();
  if (c) return c;
  return `MANUAL-${m.id.replace(/^manual-dealer-/, "").slice(0, 24)}`;
}
