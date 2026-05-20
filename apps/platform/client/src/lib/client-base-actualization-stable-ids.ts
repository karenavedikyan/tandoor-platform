/**
 * Стабильные идентификаторы и проверки дублей для ручной актуализации клиентской базы.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ActualizationState, ManualDealer, ManualTradePoint } from "@/lib/client-base-actualization-state";

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

const TND_CL_RE = /^TND-CL-(\d{6})$/i;
const TND_TP_RE = /^TND-TP-(\d{6})$/i;
const MA_MANUAL_RE = /^MA-MANUAL-(\d+)$/i;

function parseTndClSerial(raw: string): number | null {
  const m = TND_CL_RE.exec(raw.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

function parseTndTpSerial(raw: string): number | null {
  const m = TND_TP_RE.exec(raw.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

function parseMaManualSerial(raw: string): number | null {
  const m = MA_MANUAL_RE.exec(raw.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

function fnv1a32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Стабильный показ кода до первой записи TND-CL в состояние (не меняет id). */
export function stableProvisionalTndClFromDealerId(dealerId: string): string {
  const n = 100000 + (fnv1a32(`TND-CL:${dealerId}`) % 900000);
  return `TND-CL-${String(n).padStart(6, "0")}`;
}

export function stableProvisionalTndTpFromTradePointId(tradePointId: string): string {
  const n = 100000 + (fnv1a32(`TND-TP:${tradePointId}`) % 900000);
  return `TND-TP-${String(n).padStart(6, "0")}`;
}

function maxDealerCodeSerial(state: ActualizationState): number {
  let max = 0;
  for (const m of Object.values(state.manuallyCreatedDealersById)) {
    const raw = (m.internalCode ?? "").trim();
    let n = parseTndClSerial(raw);
    if (n == null) n = parseMaManualSerial(raw);
    if (n != null) max = Math.max(max, n);
  }
  return max;
}

/** Следующий свободный код TND-CL-000001 по ручным клиентам (учитывает legacy MA-MANUAL-*). */
export function nextManualDealerInternalCode(state: ActualizationState): string {
  return `TND-CL-${String(maxDealerCodeSerial(state) + 1).padStart(6, "0")}`;
}

function maxTradePointCodeSerial(state: ActualizationState): number {
  let max = 0;
  for (const m of Object.values(state.manuallyCreatedTradePointsById)) {
    const raw = (m.internalCode ?? "").trim();
    let n = parseTndTpSerial(raw);
    if (n == null) n = parseMaManualSerial(raw);
    if (n != null) max = Math.max(max, n);
  }
  return max;
}

export function nextManualTradePointInternalCode(state: ActualizationState): string {
  return `TND-TP-${String(maxTradePointCodeSerial(state) + 1).padStart(6, "0")}`;
}

/** Код клиента для UI (TND-CL или стабильный provisional, пока не сохранён internalCode). */
export function getManualDealerDisplayCode(m: ManualDealer): string {
  const raw = (m.internalCode ?? "").trim();
  const tnd = parseTndClSerial(raw);
  if (tnd != null) return `TND-CL-${String(tnd).padStart(6, "0")}`;
  const ma = parseMaManualSerial(raw);
  if (ma != null) return `TND-CL-${String(ma).padStart(6, "0")}`;
  if (raw && !raw.toLowerCase().startsWith("manual-")) return raw;
  return stableProvisionalTndClFromDealerId(m.id);
}

/** @deprecated используйте getManualDealerDisplayCode */
export function manualDealerDisplayInternalCode(m: ManualDealer): string {
  return getManualDealerDisplayCode(m);
}

export function getManualTradePointDisplayCode(m: ManualTradePoint): string {
  const raw = (m.internalCode ?? "").trim();
  const tnd = parseTndTpSerial(raw);
  if (tnd != null) return `TND-TP-${String(tnd).padStart(6, "0")}`;
  const ma = parseMaManualSerial(raw);
  if (ma != null) return `TND-TP-${String(ma).padStart(6, "0")}`;
  if (raw && !raw.toLowerCase().startsWith("manual-")) return raw;
  return stableProvisionalTndTpFromTradePointId(m.id);
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
